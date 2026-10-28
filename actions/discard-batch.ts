import { defineAction } from "@agent-native/core/action";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { nowIso, requireOwner } from "../server/lib/owner.js";

export default defineAction({
  description: "Discard the staged batch with this code. Nothing on any page changes.",
  schema: z.object({
    batch: z.string().regex(/^[0-9a-f]{12}$/),
  }),
  uiOnly: true,
  run: async ({ batch }, ctx) => {
    const ownerEmail = requireOwner(ctx);
    const where = and(
      eq(schema.batches.ownerEmail, ownerEmail),
      eq(schema.batches.code, batch),
      eq(schema.batches.status, "staged"),
    );
    const db = getDb();
    const rows = await db.select({ id: schema.batches.id }).from(schema.batches).where(where);
    await db.update(schema.batches).set({ status: "discarded", closedAt: nowIso() }).where(where);
    return { discarded: rows.length };
  },
});
