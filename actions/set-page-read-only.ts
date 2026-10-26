import { defineAction, fail } from "@agent-native/core/action";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { requireOwner } from "../server/lib/owner.js";
import { unlockNeedsApproval } from "../server/lib/policy.js";

export default defineAction({
  description:
    "Mark a page read-only (nothing on it can be changed by anyone, for example a dated changelog or a legal page) or editable again.",
  schema: z.object({
    pageId: z.string(),
    readOnly: z.boolean(),
  }),
  needsApproval: (args, ctx) => unlockNeedsApproval(args, ctx?.caller),
  run: async ({ pageId, readOnly }, ctx) => {
    const ownerEmail = requireOwner(ctx);
    const where = and(eq(schema.pages.ownerEmail, ownerEmail), eq(schema.pages.id, pageId));
    const db = getDb();
    const [page] = await db.select({ title: schema.pages.title }).from(schema.pages).where(where);
    if (!page) fail("Page not found.");
    await db.update(schema.pages).set({ readOnly }).where(where);
    return {
      id: pageId,
      change: {
        verb: "updated" as const,
        kind: "page",
        title: `${page.title} is now ${readOnly ? "read-only" : "editable"}`,
        undo: { action: "set-page-read-only", args: { pageId, readOnly: !readOnly } },
      },
    };
  },
});
