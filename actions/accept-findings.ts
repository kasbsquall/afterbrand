import { defineAction, fail } from "@agent-native/core/action";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { loadEnabledRules, syncPageFindings } from "../server/lib/findings-sync.js";
import { loadFindings } from "../server/lib/findings-read.js";
import { nowIso, requireOwner, stableId } from "../server/lib/owner.js";
import { assertCanApply, isAgentCaller } from "../server/lib/policy.js";
import { replaceSentence } from "../server/lib/rewrite.js";

export default defineAction({
  description:
    "Apply the proposed rewrite of up to 50 findings decided as change. Each applied change can be undone with revert-change until it is published. Keep and unsure findings are refused; a person overrides them by editing the rewrite. When the agent calls this, a person approves the call first.",
  schema: z.object({
    ids: z.array(z.string()).min(1).max(50).describe("Finding ids to apply"),
  }),
  // The agent may prepare and apply changes, but never without a person
  // approving the specific call. Buttons in the UI are that person.
  needsApproval: true,
  run: async ({ ids }, ctx) => {
    const ownerEmail = requireOwner(ctx);
    const callerIsAgent = isAgentCaller(ctx?.caller);
    const rows = await loadFindings(ownerEmail, ids);
    if (rows.length !== ids.length) fail("Some findings were not found. Refresh the queue and try again.");

    // Validate everything first so a batch never half-applies on a rule break.
    for (const { finding, page } of rows) {
      assertCanApply({
        decision: finding.decision,
        status: finding.status,
        proposal: finding.proposal,
        pageReadOnly: page.readOnly,
      });
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

    // Offsets moved on the touched pages; resync keeps every other decision.
    const rules = await loadEnabledRules(ownerEmail);
    for (const pageId of touchedPages) {
      const [page] = await db.select().from(schema.pages).where(eq(schema.pages.id, pageId));
      await syncPageFindings(ownerEmail, page, rules);
    }

    const first = rows[0];
    return {
      applied: changeIds.length,
      changeIds,
      change: {
        verb: "updated" as const,
        kind: "page",
        title:
          rows.length === 1
            ? `Changed "${first.rule.oldName}" on ${first.page.title}`
            : `Applied ${rows.length} changes on ${touchedPages.size} pages`,
        detail: rows.length === 1 ? (first.finding.proposal ?? undefined) : undefined,
        undo: { action: "revert-change", args: { changeIds } },
      },
    };
  },
});
