import { and, eq, gt, isNull, sql } from "drizzle-orm";

import { getDb, schema } from "../db/index.js";

type LiveChange = Pick<typeof schema.changes.$inferSelect, "after" | "bodyStart">;

// Where a live change's rewrite starts in the page body, or null when the text
// there is no longer the rewrite (the page changed again). A change from before
// positions were recorded is found by its text only when that text is unique.
export function locateLiveChange(body: string, change: LiveChange): number | null {
  if (change.bodyStart !== null) {
    const at = change.bodyStart;
    return body.slice(at, at + change.after.length) === change.after ? at : null;
  }
  const at = body.indexOf(change.after);
  if (at === -1 || body.indexOf(change.after, at + 1) !== -1) return null;
  return at;
}

// A replacement at `from` that changes the body length by `delta` moves every
// live change after it on the same page.
export async function shiftLiveChanges(ownerEmail: string, pageId: string, from: number, delta: number) {
  if (delta === 0) return;
  await getDb()
    .update(schema.changes)
    .set({ bodyStart: sql`${schema.changes.bodyStart} + ${delta}` })
    .where(
      and(
        eq(schema.changes.ownerEmail, ownerEmail),
        eq(schema.changes.pageId, pageId),
        isNull(schema.changes.revertedAt),
        gt(schema.changes.bodyStart, from),
      ),
    );
}
