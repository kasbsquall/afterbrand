import { defineAction, fail } from "@agent-native/core/action";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { loadEnabledRules, syncPageFindings } from "../server/lib/findings-sync.js";
import { nowIso, requireOwner } from "../server/lib/owner.js";

export default defineAction({
  description:
    "Undo applied changes before they are published: restores each original sentence and puts its finding back to pending.",
  schema: z.object({
    changeIds: z.array(z.string()).min(1).max(50).describe("Change ids returned by accept-findings"),
  }),
  run: async ({ changeIds }, ctx) => {
    const ownerEmail = requireOwner(ctx);
    const db = getDb();
    const rows = await db
      .select()
      .from(schema.changes)
      .where(and(eq(schema.changes.ownerEmail, ownerEmail), inArray(schema.changes.id, changeIds)));
    if (rows.length !== changeIds.length) fail("Some changes were not found.");
    if (rows.some((c) => c.publishedAt)) fail("A published change cannot be undone here.");
    if (rows.some((c) => c.revertedAt)) fail("Some of these changes were already undone.");

    const touched = new Set<string>();
    for (const change of rows) {
      const [page] = await db.select().from(schema.pages).where(eq(schema.pages.id, change.pageId));
      const at = page.body.indexOf(change.after);
      if (at === -1) fail(`The page "${page.title}" changed again; undo the later change first.`);
      const body = page.body.slice(0, at) + change.before + page.body.slice(at + change.after.length);
      const now = nowIso();
      await db.update(schema.pages).set({ body }).where(eq(schema.pages.id, page.id));
      await db.update(schema.changes).set({ revertedAt: now }).where(eq(schema.changes.id, change.id));
      await db
        .update(schema.findings)
        .set({ status: "pending", sentence: change.before, updatedAt: now })
        .where(eq(schema.findings.id, change.findingId));
      touched.add(page.id);
    }

    const rules = await loadEnabledRules(ownerEmail);
    for (const pageId of touched) {
      const [page] = await db.select().from(schema.pages).where(eq(schema.pages.id, pageId));
      await syncPageFindings(ownerEmail, page, rules);
    }
    return { reverted: rows.length, message: `Undid ${rows.length} change${rows.length === 1 ? "" : "s"}.` };
  },
});
