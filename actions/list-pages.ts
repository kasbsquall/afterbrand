import { defineAction } from "@agent-native/core/action";
import { and, asc, count, eq, ilike } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { requireOwner } from "../server/lib/owner.js";

export default defineAction({
  description:
    "List pages in the content library (title, URL, publish date), optionally filtered by text in the title. Returns the total count too.",
  schema: z.object({
    query: z.string().optional().describe("Text to match in the page title"),
    limit: z.number().int().min(1).max(100).default(25),
    offset: z.number().int().min(0).default(0),
  }),
  http: { method: "GET" },
  readOnly: true,
  run: async ({ query, limit, offset }, ctx) => {
    const ownerEmail = requireOwner(ctx);
    const where = and(
      eq(schema.pages.ownerEmail, ownerEmail),
      query ? ilike(schema.pages.title, `%${query}%`) : undefined,
    );
    const db = getDb();
    const [{ total }] = await db.select({ total: count() }).from(schema.pages).where(where);
    const pages = await db
      .select({
        id: schema.pages.id,
        title: schema.pages.title,
        url: schema.pages.url,
        publishedAt: schema.pages.publishedAt,
        readOnly: schema.pages.readOnly,
      })
      .from(schema.pages)
      .where(where)
      .orderBy(asc(schema.pages.title))
      .limit(limit)
      .offset(offset);
    return { total, pages };
  },
});
