import { defineAction, fail } from "@agent-native/core/action";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { requireOwner } from "../server/lib/owner.js";

export default defineAction({
  description:
    "Read one page of the library: title, URL, publish date, read-only flag, the current article text, every finding on it with its position, and the changes applied to it (before and after, reverted or published).",
  schema: z.object({
    id: z.string().describe("Page id"),
  }),
  http: { method: "GET" },
  readOnly: true,
  run: async ({ id }, ctx) => {
    const ownerEmail = requireOwner(ctx);
    const db = getDb();
    const [page] = await db
      .select()
      .from(schema.pages)
      .where(and(eq(schema.pages.ownerEmail, ownerEmail), eq(schema.pages.id, id)));
    if (!page) fail("Page not found.");

    const findings = await db
      .select({
        id: schema.findings.id,
        sentence: schema.findings.sentence,
        sentenceStart: schema.findings.sentenceStart,
        mentions: schema.findings.mentions,
        decision: schema.findings.decision,
        reason: schema.findings.reason,
        proposal: schema.findings.proposal,
        status: schema.findings.status,
        oldName: schema.rules.oldName,
        newName: schema.rules.newName,
      })
      .from(schema.findings)
      .innerJoin(
        schema.rules,
        and(eq(schema.findings.ruleId, schema.rules.id), eq(schema.rules.ownerEmail, ownerEmail)),
      )
      .where(and(eq(schema.findings.ownerEmail, ownerEmail), eq(schema.findings.pageId, id)))
      .orderBy(asc(schema.findings.sentenceStart));

    const changes = await db
      .select({
        id: schema.changes.id,
        findingId: schema.changes.findingId,
        before: schema.changes.before,
        after: schema.changes.after,
        appliedBy: schema.changes.appliedBy,
        appliedAt: schema.changes.appliedAt,
        revertedAt: schema.changes.revertedAt,
        publishedAt: schema.changes.publishedAt,
      })
      .from(schema.changes)
      .where(and(eq(schema.changes.ownerEmail, ownerEmail), eq(schema.changes.pageId, id)))
      .orderBy(desc(schema.changes.appliedAt));

    return {
      page: {
        id: page.id,
        title: page.title,
        url: page.url,
        publishedAt: page.publishedAt,
        readOnly: page.readOnly,
        body: page.body,
      },
      findings,
      changes,
    };
  },
});
