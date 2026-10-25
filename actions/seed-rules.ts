import { defineAction } from "@agent-native/core/action";
import { and, eq } from "drizzle-orm";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { nowIso, requireOwner, stableId } from "../server/lib/owner.js";

const seedFile = z.object({
  source: z.string().url(),
  rules: z.array(
    z.object({
      oldName: z.string().min(1),
      newName: z.string().min(1),
      effectiveDate: z.string(),
      exceptions: z.string(),
    }),
  ),
});

export default defineAction({
  description:
    "Load the example rebrand rules (Builder.io renamed Fusion to Builder Code and Publish to Builder Content on 2026-09-10). Skips names that already have a rule.",
  schema: z.object({}),
  http: false,
  run: async (_args, ctx) => {
    const ownerEmail = requireOwner(ctx);
    const seed = seedFile.parse(
      JSON.parse(await readFile(resolve("seed", "rules.seed.json"), "utf8")),
    );
    const db = getDb();
    const added: string[] = [];
    for (const rule of seed.rules) {
      const existing = await db
        .select({ id: schema.rules.id })
        .from(schema.rules)
        .where(and(eq(schema.rules.ownerEmail, ownerEmail), eq(schema.rules.oldName, rule.oldName)));
      if (existing.length > 0) continue;
      const now = nowIso();
      await db.insert(schema.rules).values({
        id: stableId("rule", ownerEmail, rule.oldName),
        ownerEmail,
        oldName: rule.oldName,
        newName: rule.newName,
        effectiveDate: rule.effectiveDate,
        exceptions: rule.exceptions,
        sourceUrl: seed.source,
        createdBy: "person",
        createdAt: now,
        updatedAt: now,
      });
      added.push(`${rule.oldName} -> ${rule.newName}`);
    }
    return { added, source: seed.source };
  },
});
