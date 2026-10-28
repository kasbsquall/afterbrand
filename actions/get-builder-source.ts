import { defineAction } from "@agent-native/core/action";
import { and, count, eq, max } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { builderKeys } from "../server/lib/builder-api.js";
import { requireOwner } from "../server/lib/owner.js";

export default defineAction({
  description:
    "Whether a Builder space is connected (its public key to read, its private key to save edits), the Builder models already imported with their page counts, and the webhook links set up per model.",
  schema: z.object({}),
  http: { method: "GET" },
  readOnly: true,
  run: async (_args, ctx) => {
    const ownerEmail = requireOwner(ctx);
    const db = getDb();
    const { publicKey, privateKey } = await builderKeys();
    const models = await db
      .select({ model: schema.builderEntries.model, pages: count(), lastImportAt: max(schema.builderEntries.importedAt) })
      .from(schema.builderEntries)
      .where(eq(schema.builderEntries.ownerEmail, ownerEmail))
      .groupBy(schema.builderEntries.model);
    const hooks = await db
      .select({ model: schema.builderHooks.model, createdAt: schema.builderHooks.createdAt, lastCalledAt: schema.builderHooks.lastCalledAt })
      .from(schema.builderHooks)
      .where(and(eq(schema.builderHooks.ownerEmail, ownerEmail)));
    return { connected: Boolean(publicKey), canSave: Boolean(privateKey), models, hooks };
  },
});
