import { and, eq, inArray } from "drizzle-orm";

import { getDb, schema } from "../db/index.js";
import { findSentenceCandidates } from "./mentions.js";
import { nowIso, stableId } from "./owner.js";

type Page = typeof schema.pages.$inferSelect;
type Rule = typeof schema.rules.$inferSelect;

export interface SyncCounts {
  created: number;
  kept: number;
  removed: number;
}

// A finding is identified by its sentence text and its occurrence on the page,
// not by offset, so applying a change elsewhere on the page only moves offsets
// and keeps every decision already made.
export async function syncPageFindings(
  ownerEmail: string,
  page: Page,
  rules: Rule[],
  sweepId?: string,
): Promise<SyncCounts> {
  const db = getDb();
  const counts: SyncCounts = { created: 0, kept: 0, removed: 0 };
  const now = nowIso();

  for (const rule of rules) {
    const existing = await db
      .select()
      .from(schema.findings)
      .where(
        and(
          eq(schema.findings.ownerEmail, ownerEmail),
          eq(schema.findings.pageId, page.id),
          eq(schema.findings.ruleId, rule.id),
        ),
      );
    const byId = new Map(existing.map((f) => [f.id, f]));
    const seen = new Set<string>();
    const occurrences = new Map<string, number>();

    for (const candidate of findSentenceCandidates(page.body, rule.oldName)) {
      const n = occurrences.get(candidate.sentence) ?? 0;
      occurrences.set(candidate.sentence, n + 1);
      const id = stableId("fd", ownerEmail, page.id, rule.id, candidate.sentence, String(n));
      seen.add(id);
      const first = candidate.mentions[0];
      const position = {
        matchText: first.text,
        startOffset: first.start,
        endOffset: first.end,
        sentenceStart: candidate.sentenceStart,
        mentions: JSON.stringify(
          candidate.mentions.map((m) => ({
            start: m.start - candidate.sentenceStart,
            end: m.end - candidate.sentenceStart,
          })),
        ),
      };
      const previous = byId.get(id);
      if (previous) {
        await db
          .update(schema.findings)
          .set({ ...position, updatedAt: now })
          .where(eq(schema.findings.id, id));
        counts.kept++;
      } else {
        await db.insert(schema.findings).values({
          id,
          ownerEmail,
          pageId: page.id,
          ruleId: rule.id,
          sentence: candidate.sentence,
          ...position,
          status: "pending",
          sweepId: sweepId ?? null,
          createdAt: now,
          updatedAt: now,
        });
        counts.created++;
      }
    }

    // Pending findings whose sentence is gone are stale. Decided history
    // (accepted or rejected) stays.
    const stale = existing.filter((f) => !seen.has(f.id) && f.status === "pending").map((f) => f.id);
    if (stale.length > 0) {
      await db.delete(schema.findings).where(inArray(schema.findings.id, stale));
      counts.removed += stale.length;
    }
  }
  return counts;
}

export async function loadEnabledRules(ownerEmail: string, ruleIds?: string[]): Promise<Rule[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.rules)
    .where(
      and(
        eq(schema.rules.ownerEmail, ownerEmail),
        eq(schema.rules.enabled, true),
        ruleIds && ruleIds.length > 0 ? inArray(schema.rules.id, ruleIds) : undefined,
      ),
    );
  return rows;
}
