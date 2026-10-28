import { fail } from "@agent-native/core/action";
import { and, desc, eq } from "drizzle-orm";
import { createHash } from "node:crypto";

import { getDb, schema } from "../db/index.js";
import { loadFindings, mentionOffsets, type FindingWithContext } from "./findings-read.js";
import { assertCanApply } from "./policy.js";

// One staged change as the person sees it: the sentence and its rewrite.
export interface BatchItem {
  findingId: string;
  pageId: string;
  pageTitle: string;
  oldName: string;
  newName: string;
  before: string;
  after: string;
  mentions: { start: number; end: number }[];
}

export type BatchRow = typeof schema.batches.$inferSelect;

// Long enough that nobody can make two batches share a code, short enough to
// compare by eye between the screen and the approval in the chat.
export const BATCH_CODE_LENGTH = 12;

// The hash of exactly what a person reviews: each finding's sentence and
// rewrite. Order does not matter; any edited rewrite or changed sentence does.
export function batchDigest(items: readonly Pick<BatchItem, "findingId" | "before" | "after">[]): string {
  const lines = items.map((item) => JSON.stringify([item.findingId, item.before, item.after])).sort();
  return createHash("sha256").update(lines.join("\n")).digest("hex");
}

// Snapshot in reading order: page by page, top to bottom.
export function batchItems(rows: readonly FindingWithContext[]): BatchItem[] {
  return [...rows]
    .sort((a, b) => a.page.title.localeCompare(b.page.title) || a.finding.sentenceStart - b.finding.sentenceStart)
    .map(({ finding, page, rule }) => ({
      findingId: finding.id,
      pageId: page.id,
      pageTitle: page.title,
      oldName: rule.oldName,
      newName: rule.newName,
      before: finding.sentence,
      after: finding.proposal ?? "",
      mentions: mentionOffsets(finding),
    }));
}

export function assertAllApplicable(rows: readonly FindingWithContext[]): void {
  for (const { finding, page } of rows) {
    assertCanApply({
      decision: finding.decision,
      status: finding.status,
      proposal: finding.proposal,
      pageReadOnly: page.readOnly,
    });
  }
}

export function parseBatchItems(batch: BatchRow): BatchItem[] {
  return JSON.parse(batch.items) as BatchItem[];
}

export async function findStagedBatch(ownerEmail: string, code?: string): Promise<BatchRow | undefined> {
  const [batch] = await getDb()
    .select()
    .from(schema.batches)
    .where(
      and(
        eq(schema.batches.ownerEmail, ownerEmail),
        eq(schema.batches.status, "staged"),
        code ? eq(schema.batches.code, code) : undefined,
      ),
    )
    .orderBy(desc(schema.batches.createdAt))
    .limit(1);
  return batch;
}

// The staged findings as they read now, what changed for each one, and
// whether the batch still matches what was staged and can all be applied. A
// finding re-synced away counts as changed. The digest has the last word: it
// is what the approval names.
export async function checkBatch(ownerEmail: string, batch: BatchRow) {
  const staged = parseBatchItems(batch);
  const rows = await loadFindings(
    ownerEmail,
    staged.map((item) => item.findingId),
  );
  const rowById = new Map(rows.map((row) => [row.finding.id, row]));
  const nowById = new Map(batchItems(rows).map((item) => [item.findingId, item]));
  const problems: Record<string, string> = {};
  for (const item of staged) {
    const row = rowById.get(item.findingId);
    const now = nowById.get(item.findingId);
    if (!row || !now) {
      problems[item.findingId] = "This finding is no longer in the queue.";
    } else if (now.before !== item.before || now.after !== item.after) {
      problems[item.findingId] = "Its sentence or rewrite changed.";
    } else {
      try {
        assertAllApplicable([row]);
      } catch (error) {
        problems[item.findingId] = error instanceof Error ? error.message : "It can no longer be applied.";
      }
    }
  }
  const changed = Object.keys(problems).length;
  const matches = changed === 0 && batchDigest([...nowById.values()]) === batch.digest;
  const problem = matches
    ? null
    : changed > 0
      ? `${changed} of ${staged.length} findings changed after this batch was staged.`
      : "This batch no longer matches the queue.";
  return { rows, problems, problem };
}

// Fails closed: a missing batch, a missing finding or any changed text refuses
// the whole batch before anything is applied.
export async function loadBatchForApply(ownerEmail: string, code: string) {
  const batch = await findStagedBatch(ownerEmail, code);
  if (!batch) fail("No batch is waiting with that code. Stage the findings again.");
  const { rows, problem } = await checkBatch(ownerEmail, batch);
  if (problem) fail(`${problem} Nothing was applied. Stage it again so the person reviews the current text.`);
  return { batch, rows };
}
