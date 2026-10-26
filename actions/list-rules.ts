import { defineAction } from "@agent-native/core/action";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { requireOwner } from "../server/lib/owner.js";

export default defineAction({
  description:
    "List the rebrand rules: each retired name, its replacement, effective date, plain-language exceptions, source and whether it is enabled.",
  schema: z.object({}),
  http: { method: "GET" },
  readOnly: true,
  run: async (_args, ctx) => {
    const ownerEmail = requireOwner(ctx);
    const rules = await getDb()
      .select()
      .from(schema.rules)
      .where(eq(schema.rules.ownerEmail, ownerEmail))
      .orderBy(asc(schema.rules.createdAt));
    return { rules };
  },
});
