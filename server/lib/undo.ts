import { fail } from "@agent-native/core/action";
import { and, eq, inArray } from "drizzle-orm";

import { getDb, schema } from "../db/index.js";
import { loadEnabledRules, syncPageFindings } from "./findings-sync.js";
import { nowIso } from "./owner.js";
import { assertPagesWritable } from "./policy.js";
import { locateLiveChange, shiftLiveChanges } from "./positions.js";

type ChangeRow = typeof schema.changes.$inferSelect;

// Later positions first, and the newest of two changes at one position first,
// so each undo leaves the text the next one expects.
function undoOrder(a: ChangeRow, b: ChangeRow): number {
  return (
    a.pageId.localeCompare(b.pageId) ||
    (b.bodyStart ?? -1) - (a.bodyStart ?? -1) ||
    b.appliedAt.localeCompare(a.appliedAt)
  );
}

// Restores each original sentence at the position it was changed and puts its
// finding back to pending, in one transaction: if any sentence cannot be
// restored, nothing is. Shared by revert-change and the undo mode of
// accept-findings, whose chat card can only undo through the action that made
// the change.
export async function revertChanges(ownerEmail: string, changeIds: string[]) {
  return getDb().transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(schema.changes)
      .where(and(eq(schema.changes.ownerEmail, ownerEmail), inArray(schema.changes.id, changeIds)));
    if (rows.length !== changeIds.length) fail("Some changes were not found.");
    if (rows.some((c) => c.publishedAt)) fail("A published change cannot be undone here.");
    if (rows.some((c) => c.revertedAt)) fail("Some of these changes were already undone.");

    const touched = new Set<string>();
    for (const change of [...rows].sort(undoOrder)) {
      const [page] = await tx
        .select()
        .from(schema.pages)
        .where(and(eq(schema.pages.ownerEmail, ownerEmail), eq(schema.pages.id, change.pageId)));
      assertPagesWritable([page]);
      const at = locateLiveChange(page.body, change);
      if (at === null) fail(`The page "${page.title}" changed again; undo the later change first. Nothing was undone.`);
      const body = page.body.slice(0, at) + change.before + page.body.slice(at + change.after.length);
      const now = nowIso();
      await tx.update(schema.pages).set({ body }).where(eq(schema.pages.id, page.id));
      await tx.update(schema.changes).set({ revertedAt: now }).where(eq(schema.changes.id, change.id));
      await shiftLiveChanges(ownerEmail, page.id, at, change.before.length - change.after.length);
      await tx
        .update(schema.findings)
        .set({ status: "pending", sentence: change.before, updatedAt: now })
        .where(eq(schema.findings.id, change.findingId));
      touched.add(page.id);
    }

    const rules = await loadEnabledRules(ownerEmail);
    for (const pageId of touched) {
      const [page] = await tx.select().from(schema.pages).where(eq(schema.pages.id, pageId));
      await syncPageFindings(ownerEmail, page, rules);
    }
    return { reverted: rows.length, message: `Undid ${rows.length} change${rows.length === 1 ? "" : "s"}.` };
  });
}

// Reopens rejected findings so they are pending again.
export async function reopenFindings(ownerEmail: string, ids: string[]) {
  const where = and(
    eq(schema.findings.ownerEmail, ownerEmail),
    inArray(schema.findings.id, ids),
    eq(schema.findings.status, "rejected"),
  );
  const db = getDb();
  const rows = await db.select({ id: schema.findings.id }).from(schema.findings).where(where);
  await db.update(schema.findings).set({ status: "pending", updatedAt: nowIso() }).where(where);
  return { reopened: rows.length };
}
