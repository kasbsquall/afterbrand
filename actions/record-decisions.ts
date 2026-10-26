import { defineAction, type WriteReceipt } from "@agent-native/core/action";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { loadFindings, mentionOffsets } from "../server/lib/findings-read.js";
import { nowIso, requireOwner } from "../server/lib/owner.js";
import { isAgentCaller } from "../server/lib/policy.js";
import { verifyRewrite } from "../server/lib/rewrite.js";

const MAX_BATCH = 50;

export default defineAction({
  description:
    'Record decisions for pending findings, up to 50 per call. For each: decision "change" (the sentence names the current product; include proposal, the full rewritten sentence), "keep" (historical, changelog, URL or code, contract language, common word, another company\'s product) or "unsure" (a person should look). Reason is one short line. A change whose rewrite fails the safety check is not saved and is reported back.',
  schema: z.object({
    decisions: z
      .array(
        z.object({
          id: z.string().describe("Finding id"),
          decision: z.enum(["change", "keep", "unsure"]),
          reason: z.string().min(1).max(200).describe("One line, for the reviewer"),
          proposal: z.string().optional().describe('Full rewritten sentence; required for "change"'),
        }),
      )
      .min(1)
      .max(MAX_BATCH),
  }),
  run: async ({ decisions }, ctx) => {
    const ownerEmail = requireOwner(ctx);
    const loaded = new Map(
      (await loadFindings(ownerEmail, decisions.map((d) => d.id))).map((r) => [r.finding.id, r]),
    );
    const decidedBy = isAgentCaller(ctx?.caller) ? "agent" : "person";
    const db = getDb();
    const saved: string[] = [];
    const rejected: { id: string; problem: string }[] = [];

    for (const d of decisions) {
      const row = loaded.get(d.id);
      if (!row) {
        rejected.push({ id: d.id, problem: "Finding not found." });
        continue;
      }
      if (row.finding.status !== "pending") {
        rejected.push({ id: d.id, problem: `Already ${row.finding.status}.` });
        continue;
      }
      let proposal: string | null = null;
      if (d.decision === "change") {
        const check = verifyRewrite({
          sentence: row.finding.sentence,
          proposal: d.proposal ?? "",
          oldName: row.rule.oldName,
          newName: row.rule.newName,
          mentionOffsets: mentionOffsets(row.finding),
        });
        if (!check.ok) {
          rejected.push({ id: d.id, problem: check.problems.join(" ") });
          continue;
        }
        proposal = d.proposal ?? null;
      }
      await db
        .update(schema.findings)
        .set({ decision: d.decision, reason: d.reason, proposal, decidedBy, updatedAt: nowIso() })
        .where(eq(schema.findings.id, d.id));
      saved.push(d.id);
    }

    const _receipt: WriteReceipt = {
      changed: saved.length > 0,
      verified: rejected.length === 0 ? true : false,
      summary: `Saved ${saved.length} of ${decisions.length} decisions.${rejected.length ? ` ${rejected.length} need a fix.` : ""}`,
      checks: rejected.slice(0, 8).map((r) => ({ id: r.id, ok: false, detail: r.problem })),
    };
    return { saved: saved.length, rejected, _receipt };
  },
});
