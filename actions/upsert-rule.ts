import { defineAction, fail } from "@agent-native/core/action";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { nowIso, requireOwner, stableId } from "../server/lib/owner.js";
import { isAgentCaller } from "../server/lib/policy.js";

export default defineAction({
  description:
    "Create or update a rebrand rule. Pass id to update. Use it to add an exception the person described in plain words (append to exceptions, keep the old text), or to enable or disable a rule. After a change, run find-candidates and re-decide the affected findings.",
  schema: z.object({
    id: z.string().optional().describe("Rule id to update; omit to create"),
    oldName: z.string().min(1).optional().describe("Retired name, required when creating"),
    newName: z.string().min(1).optional().describe("Replacement name, required when creating"),
    effectiveDate: z.string().optional().describe("Date the rename took effect, YYYY-MM-DD"),
    exceptions: z.string().optional().describe("Full plain-language exceptions text; replaces the current text"),
    sourceUrl: z.string().url().optional().describe("Where the rename was announced"),
    enabled: z.boolean().optional().describe("Whether the rule is active"),
    expectedUpdatedAt: z
      .string()
      .optional()
      .describe("updatedAt the caller last read; the update is refused if the rule changed since"),
  }),
  run: async (args, ctx) => {
    const ownerEmail = requireOwner(ctx);
    const db = getDb();
    const now = nowIso();
    const createdBy = isAgentCaller(ctx?.caller) ? "agent" : "person";

    if (args.id) {
      const [current] = await db
        .select()
        .from(schema.rules)
        .where(and(eq(schema.rules.ownerEmail, ownerEmail), eq(schema.rules.id, args.id)));
      if (!current) fail("Rule not found.");
      if (args.expectedUpdatedAt && args.expectedUpdatedAt !== current.updatedAt) {
        fail("The rule changed while you were editing it. Reload it and apply your edit again.");
      }
      const { id, expectedUpdatedAt: _seen, ...patch } = args;
      await db
        .update(schema.rules)
        .set({ ...patch, updatedAt: now })
        .where(eq(schema.rules.id, id));
      return { id, message: `Updated the rule for ${current.oldName}.`, nextRequiredAction: "find-candidates" };
    }

    if (!args.oldName || !args.newName) fail("A new rule needs oldName and newName.");
    const id = stableId("rule", ownerEmail, args.oldName);
    const [duplicate] = await db.select({ id: schema.rules.id }).from(schema.rules).where(eq(schema.rules.id, id));
    if (duplicate) fail(`There is already a rule for ${args.oldName}. Pass its id to update it.`);
    await db.insert(schema.rules).values({
      id,
      ownerEmail,
      oldName: args.oldName,
      newName: args.newName,
      effectiveDate: args.effectiveDate ?? null,
      exceptions: args.exceptions ?? "",
      sourceUrl: args.sourceUrl ?? null,
      enabled: args.enabled ?? true,
      createdBy,
      createdAt: now,
      updatedAt: now,
    });
    return { id, message: `Added ${args.oldName} -> ${args.newName}.`, nextRequiredAction: "find-candidates" };
  },
});
