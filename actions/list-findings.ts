import { defineAction } from "@agent-native/core/action";
import { and, asc, count, eq, ilike, inArray, isNull, or } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { requireOwner } from "../server/lib/owner.js";

export default defineAction({
  description:
    'List findings (sentences that mention a retired name) with page title, URL, rule, decision, reason and proposed rewrite. Filter by status ("pending", "accepted", "rejected"), decision ("change", "keep", "unsure" or "undecided"), ruleId, pageId, or pageQuery (words in the page title or URL, for example "introducing" to find launch posts). Returns counts per decision for the current filter.',
  schema: z.object({
    status: z.enum(["pending", "accepted", "rejected"]).optional().describe('Finding status; omit for all'),
    decision: z
      .enum(["change", "keep", "unsure", "undecided"])
      .optional()
      .describe('Agent decision; "undecided" means not decided yet'),
    ruleId: z.string().optional(),
    pageId: z.string().optional(),
    pageQuery: z.string().trim().min(2).max(80).optional().describe("Case-insensitive text in the page title or URL"),
    limit: z.coerce.number().int().min(1).max(200).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  }),
  http: { method: "GET" },
  readOnly: true,
  run: async ({ status, decision, ruleId, pageId, pageQuery, limit, offset }, ctx) => {
    const ownerEmail = requireOwner(ctx);
    const db = getDb();
    // Escape LIKE wildcards so the text matches literally.
    const pattern = pageQuery ? `%${pageQuery.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;
    const matchingPages = pattern
      ? await db
          .select({ id: schema.pages.id })
          .from(schema.pages)
          .where(
            and(
              eq(schema.pages.ownerEmail, ownerEmail),
              or(ilike(schema.pages.title, pattern), ilike(schema.pages.url, pattern)),
            ),
          )
      : null;
    const base = and(
      eq(schema.findings.ownerEmail, ownerEmail),
      status ? eq(schema.findings.status, status) : undefined,
      ruleId ? eq(schema.findings.ruleId, ruleId) : undefined,
      pageId ? eq(schema.findings.pageId, pageId) : undefined,
      matchingPages ? inArray(schema.findings.pageId, matchingPages.map((p) => p.id)) : undefined,
    );
    const where = and(
      base,
      decision === "undecided"
        ? isNull(schema.findings.decision)
        : decision
          ? eq(schema.findings.decision, decision)
          : undefined,
    );
    const byDecision = await db
      .select({ decision: schema.findings.decision, n: count() })
      .from(schema.findings)
      .where(base)
      .groupBy(schema.findings.decision);
    const findings = await db
      .select({
        id: schema.findings.id,
        pageId: schema.findings.pageId,
        pageTitle: schema.pages.title,
        pageUrl: schema.pages.url,
        pagePublishedAt: schema.pages.publishedAt,
        pageReadOnly: schema.pages.readOnly,
        ruleId: schema.findings.ruleId,
        oldName: schema.rules.oldName,
        newName: schema.rules.newName,
        sentence: schema.findings.sentence,
        mentions: schema.findings.mentions,
        decision: schema.findings.decision,
        reason: schema.findings.reason,
        proposal: schema.findings.proposal,
        status: schema.findings.status,
        decidedBy: schema.findings.decidedBy,
      })
      .from(schema.findings)
      .innerJoin(
        schema.pages,
        and(eq(schema.findings.pageId, schema.pages.id), eq(schema.pages.ownerEmail, ownerEmail)),
      )
      .innerJoin(
        schema.rules,
        and(eq(schema.findings.ruleId, schema.rules.id), eq(schema.rules.ownerEmail, ownerEmail)),
      )
      .where(where)
      .orderBy(asc(schema.pages.title), asc(schema.findings.sentenceStart))
      .limit(limit)
      .offset(offset);
    const counts = { change: 0, keep: 0, unsure: 0, undecided: 0 };
    for (const row of byDecision) counts[row.decision ?? "undecided"] += row.n;
    return { counts, total: Object.values(counts).reduce((a, b) => a + b, 0), findings };
  },
});
