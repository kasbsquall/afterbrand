import { defineAction } from "@agent-native/core/action";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { nowIso, requireOwner } from "../server/lib/owner.js";

export default defineAction({
  description: "Reopen closed (rejected) findings so they are pending again. Undo target of reject-findings.",
  schema: z.object({
    ids: z.array(z.string()).min(1).max(50),
  }),
  run: async ({ ids }, ctx) => {
    const ownerEmail = requireOwner(ctx);
    const where = and(
      eq(schema.findings.ownerEmail, ownerEmail),
      inArray(schema.findings.id, ids),
      eq(schema.findings.status, "rejected"),
    );
    const db = getDb();
    const rows = await db.select({ id: schema.findings.id }).from(schema.findings).where(where);
    await db.update(schema.findings).set({ status: "pending", updatedAt: nowIso() }).where(where);
    return { reopened: rows.length };
  },
});
