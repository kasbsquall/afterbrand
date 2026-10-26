import { defineAction, fail } from "@agent-native/core/action";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { nowIso, requireOwner } from "../server/lib/owner.js";

export default defineAction({
  description:
    "Close up to 50 pending findings without changing the page (the old name stays where it is). Use for mentions that should be kept.",
  schema: z.object({
    ids: z.array(z.string()).min(1).max(50).describe("Finding ids to close"),
  }),
  run: async ({ ids }, ctx) => {
    const ownerEmail = requireOwner(ctx);
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
        undo: { action: "reopen-findings", args: { ids: pending.map((p) => p.id) } },
      },
    };
  },
});
