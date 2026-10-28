import { defineAction, fail } from "@agent-native/core/action";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { nowIso, requireOwner, stableId } from "../server/lib/owner.js";
import { assertCanPublish, assertPagesWritable } from "../server/lib/policy.js";
import { loadUnpublished, publishSetCode, type PublishedPage } from "../server/lib/publish.js";

export default defineAction({
  description:
    "Publish every accepted change that is not published yet, by the set code get-library-overview returns as publishSet: saves the updated pages and their changes as a publication the person downloads from the app, then locks those changes. If any change was accepted or undone since the code was read, nothing is published. A person approves every call. Use only when the person asks to publish or ship.",
  schema: z.object({
    set: z
      .string()
      .regex(/^[0-9a-f]{12}$/)
      .describe("publishSet from get-library-overview: the accepted changes the person sees"),
  }),
  needsApproval: true,
  run: async ({ set }, ctx) => {
    const ownerEmail = requireOwner(ctx);
    const db = getDb();
    const pending = await loadUnpublished(ownerEmail);
    assertCanPublish(pending.map((p) => p.findingStatus));
    if (publishSetCode(pending.map((p) => p.change)) !== set) {
      fail(
        `The accepted changes changed since that set was read: ${pending.length} ${pending.length === 1 ? "is" : "are"} waiting now. Nothing was published. Read the set again and show the person what it holds.`,
      );
    }

    const pageIds = [...new Set(pending.map((p) => p.change.pageId))];
    const pages = await db
      .select()
      .from(schema.pages)
      .where(and(eq(schema.pages.ownerEmail, ownerEmail), inArray(schema.pages.id, pageIds)));
    if (pages.length !== pageIds.length) fail("A page with accepted changes is missing.");
    assertPagesWritable(pages);

    const now = nowIso();
    const content: PublishedPage[] = pages.map((page) => ({
      url: page.url,
      title: page.title,
      body: page.body,
      changes: pending
        .filter((p) => p.change.pageId === page.id)
        .map((p) => ({ before: p.change.before, after: p.change.after, appliedBy: p.change.appliedBy })),
    }));
    const id = stableId("pub", ownerEmail, set, now);
    await db.insert(schema.publications).values({
      id,
      ownerEmail,
      code: set,
      changes: pending.length,
      pages: pages.length,
      content: JSON.stringify(content),
      publishedAt: now,
    });
    await db
      .update(schema.changes)
      .set({ publishedAt: now })
      .where(
        and(
          eq(schema.changes.ownerEmail, ownerEmail),
          inArray(
            schema.changes.id,
            pending.map((p) => p.change.id),
          ),
        ),
      );

    return {
      message: `Published set ${set}: ${pending.length} change${pending.length === 1 ? "" : "s"} across ${pages.length} page${pages.length === 1 ? "" : "s"}. The person can download it from the publish card.`,
      published: pending.length,
      pages: pages.length,
      publication: id,
    };
  },
});
