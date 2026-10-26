import { defineAction, fail } from "@agent-native/core/action";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { nowIso, requireOwner } from "../server/lib/owner.js";
import { assertCanPublish, assertPagesWritable } from "../server/lib/policy.js";

const EXPORT_ROOT = resolve("data", "exports");

export default defineAction({
  description:
    "Publish every accepted change that is not published yet: writes one updated Markdown file per page plus a diff manifest to the export folder, then locks those changes. A person approves every call. Use only when the person asks to publish or ship.",
  schema: z.object({}),
  needsApproval: true,
  run: async (_args, ctx) => {
    const ownerEmail = requireOwner(ctx);
    const db = getDb();
    const pending = await db
      .select({ change: schema.changes, findingStatus: schema.findings.status })
      .from(schema.changes)
      .innerJoin(schema.findings, eq(schema.changes.findingId, schema.findings.id))
      .where(
        and(
          eq(schema.changes.ownerEmail, ownerEmail),
          isNull(schema.changes.revertedAt),
          isNull(schema.changes.publishedAt),
        ),
      );
    assertCanPublish(pending.map((p) => p.findingStatus));

    const pageIds = [...new Set(pending.map((p) => p.change.pageId))];
    const pages = await db
      .select()
      .from(schema.pages)
      .where(and(eq(schema.pages.ownerEmail, ownerEmail), inArray(schema.pages.id, pageIds)));
    if (pages.length !== pageIds.length) fail("A page with accepted changes is missing.");
    assertPagesWritable(pages);

    const now = nowIso();
    const dir = join(EXPORT_ROOT, now.replace(/[:.]/g, "-"));
    await mkdir(dir, { recursive: true });
    const manifest = pages.map((page) => {
      const slug = page.url.split("/").filter(Boolean).pop() ?? page.id;
      return {
        url: page.url,
        file: `${slug}.md`,
        changes: pending
          .filter((p) => p.change.pageId === page.id)
          .map((p) => ({ before: p.change.before, after: p.change.after, appliedBy: p.change.appliedBy })),
      };
    });
    for (const [i, page] of pages.entries()) {
      await writeFile(join(dir, manifest[i].file), `# ${page.title}\n\n${page.body.split("\n").join("\n\n")}\n`);
    }
    await writeFile(join(dir, "changes.json"), JSON.stringify({ publishedAt: now, pages: manifest }, null, 2));
    await db
      .update(schema.changes)
      .set({ publishedAt: now })
      .where(inArray(schema.changes.id, pending.map((p) => p.change.id)));

    return {
      message: `Published ${pending.length} change${pending.length === 1 ? "" : "s"} across ${pages.length} page${pages.length === 1 ? "" : "s"}.`,
      published: pending.length,
      pages: pages.length,
      exportFolder: dir,
    };
  },
});
