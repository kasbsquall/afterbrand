import { defineAction, fail } from "@agent-native/core/action";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { nowIso, requireOwner } from "../server/lib/owner.js";
import { reopenFindings } from "../server/lib/undo.js";

export default defineAction({
  description:
    "Close up to 50 pending findings without changing the page (the old name stays where it is). Use for mentions that should be kept. Pass reopenIds instead of ids to reopen findings this action closed (the chat card's Undo).",
  schema: z.object({
    ids: z.array(z.string()).min(1).max(50).optional().describe("Finding ids to close"),
    reopenIds: z.array(z.string()).min(1).max(50).optional().describe("Undo mode: finding ids to reopen"),
  }),
  run: async ({ ids, reopenIds }, ctx) => {
    const ownerEmail = requireOwner(ctx);
    if (ids && reopenIds) fail("Pass ids to close or reopenIds to undo, not both.");
    if (reopenIds) return reopenFindings(ownerEmail, reopenIds);
    if (!ids) fail("Pass ids to close, or reopenIds to undo.");
    const db = getDb();
    const where = and(
      eq(schema.findings.ownerEmail, ownerEmail),
      inArray(schema.findings.id, ids),
      eq(schema.findings.status, "pending"),
    );
    const pending = await db.select({ id: schema.findings.id }).from(schema.findings).where(where);
    if (pending.length === 0) fail("None of these findings are pending.");
    await db.update(schema.findings).set({ status: "rejected", updatedAt: nowIso() }).where(where);
    return {
      closed: pending.length,
      skipped: ids.length - pending.length,
      change: {
        verb: "updated" as const,
        kind: "finding",
        title: `Kept the old name in ${pending.length} sentence${pending.length === 1 ? "" : "s"}`,
        // The chat card undoes through this same action (undo mode).
        undo: { action: "reject-findings", args: { reopenIds: pending.map((p) => p.id) } },
      },
    };
  },
});
