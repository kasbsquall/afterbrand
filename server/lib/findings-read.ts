import { and, eq, inArray } from "drizzle-orm";

import { getDb, schema } from "../db/index.js";

export type FindingRow = typeof schema.findings.$inferSelect;
export type PageRow = typeof schema.pages.$inferSelect;
export type RuleRow = typeof schema.rules.$inferSelect;

export interface FindingWithContext {
  finding: FindingRow;
  page: PageRow;
  rule: RuleRow;
}

// Loads findings with their page and rule, scoped to the owner. Missing ids
// are simply absent from the result; callers report them.
export async function loadFindings(ownerEmail: string, ids: string[]): Promise<FindingWithContext[]> {
  if (ids.length === 0) return [];
  const rows = await getDb()
    .select({ finding: schema.findings, page: schema.pages, rule: schema.rules })
    .from(schema.findings)
    .innerJoin(schema.pages, eq(schema.findings.pageId, schema.pages.id))
    .innerJoin(schema.rules, eq(schema.findings.ruleId, schema.rules.id))
    .where(and(eq(schema.findings.ownerEmail, ownerEmail), inArray(schema.findings.id, ids)));
  return rows;
}

export function mentionOffsets(finding: FindingRow): { start: number; end: number }[] {
  try {
    const parsed: unknown = JSON.parse(finding.mentions);
    return Array.isArray(parsed) ? (parsed as { start: number; end: number }[]) : [];
  } catch {
    return [];
  }
}
