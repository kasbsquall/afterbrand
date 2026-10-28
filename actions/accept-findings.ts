import { defineAction, fail } from "@agent-native/core/action";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { assertAllApplicable, loadBatchForApply, type BatchRow } from "../server/lib/batch.js";
import { loadFindings, type FindingWithContext } from "../server/lib/findings-read.js";
import { loadEnabledRules, syncPageFindings } from "../server/lib/findings-sync.js";
import { nowIso, requireOwner, stableId } from "../server/lib/owner.js";
import { assertAgentAppliesBatch, isAgentCaller } from "../server/lib/policy.js";
import { replaceSentence } from "../server/lib/rewrite.js";
import { revertChanges } from "../server/lib/undo.js";

export default defineAction({
  description:
    "Apply a batch of rewrites. Agents pass batch, the code stage-changes returned: a person approves that exact batch, and if any sentence or rewrite in it changed since it was staged, nothing is applied. People in the app pass ids. Each applied change can be undone with revert-change until it is published. Keep and unsure findings are refused; a person overrides them by editing the rewrite. Pass undoChangeIds to undo changes this action applied (the chat card's Undo).",
  schema: z.object({
    ids: z.array(z.string()).min(1).max(50).optional().describe("Finding ids to apply (people in the app only)"),
    batch: z
      .string()
      .regex(/^[0-9a-f]{12}$/)
      .optional()
      .describe("Batch code from stage-changes: applies exactly the staged batch"),
    undoChangeIds: z
      .array(z.string())
      .min(1)
      .max(50)
      .optional()
      .describe("Undo mode: change ids returned by an earlier call"),
  }),
  // The agent applies only a batch a person can see before and after, and the
  // person approves that batch by its code. Buttons in the UI are that person.
  // A bare list of ids from an agent is refused in run, so it needs no prompt;
  // undo mode only restores sentences.
  needsApproval: (args) => args.batch !== undefined,
  run: async ({ ids, batch, undoChangeIds }, ctx) => {
    const ownerEmail = requireOwner(ctx);
    if ([ids, batch, undoChangeIds].filter((mode) => mode !== undefined).length !== 1) {
      fail("Pass exactly one of ids, batch or undoChangeIds.");
    }
    if (undoChangeIds) return revertChanges(ownerEmail, undoChangeIds);
    const callerIsAgent = isAgentCaller(ctx?.caller);
    assertAgentAppliesBatch(ctx?.caller, batch !== undefined);
    let staged: BatchRow | null = null;
    let rows: FindingWithContext[];
    if (batch) {
      // Validates every finding first, so a batch never half-applies on a rule break.
      ({ batch: staged, rows } = await loadBatchForApply(ownerEmail, batch));
    } else {
      if (!ids) fail("Pass ids to apply, or undoChangeIds to undo.");
      rows = await loadFindings(ownerEmail, ids);
      if (rows.length !== ids.length) fail("Some findings were not found. Refresh the queue and try again.");
      assertAllApplicable(rows);
    }

    const db = getDb();
    const changeIds: string[] = [];
    const touchedPages = new Set<string>();
    // Apply later sentences first so earlier offsets on the same page stay valid.
    const ordered = [...rows].sort(
      (a, b) => a.page.id.localeCompare(b.page.id) || b.finding.sentenceStart - a.finding.sentenceStart,
    );
    for (const { finding } of ordered) {
      const [page] = await db
        .select()
        .from(schema.pages)
        .where(and(eq(schema.pages.ownerEmail, ownerEmail), eq(schema.pages.id, finding.pageId)));
      const proposal = finding.proposal as string;
      const body = replaceSentence(page.body, finding.sentenceStart, finding.sentence, proposal);
      const now = nowIso();
      const changeId = stableId("ch", ownerEmail, finding.id, now);
      await db.update(schema.pages).set({ body }).where(eq(schema.pages.id, page.id));
      await db.insert(schema.changes).values({
        id: changeId,
        ownerEmail,
        findingId: finding.id,
        pageId: page.id,
        before: finding.sentence,
        after: proposal,
        appliedBy: callerIsAgent ? "agent" : "person",
        appliedAt: now,
      });
      await db
        .update(schema.findings)
        .set({ status: "accepted", updatedAt: now })
        .where(eq(schema.findings.id, finding.id));
      changeIds.push(changeId);
      touchedPages.add(page.id);
    }

    if (staged) {
      await db
        .update(schema.batches)
        .set({ status: "applied", closedAt: nowIso() })
        .where(and(eq(schema.batches.ownerEmail, ownerEmail), eq(schema.batches.id, staged.id)));
    }

    // Offsets moved on the touched pages; resync keeps every other decision.
    const rules = await loadEnabledRules(ownerEmail);
    for (const pageId of touchedPages) {
      const [page] = await db.select().from(schema.pages).where(eq(schema.pages.id, pageId));
      await syncPageFindings(ownerEmail, page, rules);
    }

    const first = rows[0];
    const summary = `${rows.length} changes on ${touchedPages.size} page${touchedPages.size === 1 ? "" : "s"}`;
    return {
      applied: changeIds.length,
      changeIds,
      ...(staged ? { batch: staged.code } : {}),
      change: {
        verb: "updated" as const,
        kind: "page",
        title:
          rows.length === 1
            ? `Changed "${first.rule.oldName}" on ${first.page.title}${staged ? ` (batch ${staged.code})` : ""}`
            : staged
              ? `Applied batch ${staged.code}: ${summary}`
              : `Applied ${summary}`,
        detail: rows.length === 1 ? (first.finding.proposal ?? undefined) : undefined,
        // The chat card undoes through this same action (undo mode).
        undo: { action: "accept-findings", args: { undoChangeIds: changeIds } },
      },
    };
  },
});
