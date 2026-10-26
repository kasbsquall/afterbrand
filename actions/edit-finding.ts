import { defineAction, fail } from "@agent-native/core/action";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { loadFindings, mentionOffsets } from "../server/lib/findings-read.js";
import { nowIso, requireOwner } from "../server/lib/owner.js";
import { isAgentCaller } from "../server/lib/policy.js";
import { verifyRewrite } from "../server/lib/rewrite.js";

export default defineAction({
  description:
    "Replace the proposed rewrite of one pending finding with new text. The finding becomes a change decided by whoever edits it. The new text must pass the same safety check as the agent's rewrites.",
  schema: z.object({
    id: z.string().describe("Finding id"),
    proposal: z.string().min(1).describe("Full rewritten sentence"),
  }),
  run: async ({ id, proposal }, ctx) => {
    const ownerEmail = requireOwner(ctx);
    const [row] = await loadFindings(ownerEmail, [id]);
    if (!row) fail("Finding not found.");
    if (row.finding.status !== "pending") fail(`This finding is already ${row.finding.status}.`);
    const check = verifyRewrite({
      sentence: row.finding.sentence,
      proposal,
      oldName: row.rule.oldName,
      newName: row.rule.newName,
      mentionOffsets: mentionOffsets(row.finding),
    });
    if (!check.ok) fail(check.problems.join(" "));
    await getDb()
      .update(schema.findings)
      .set({
        decision: "change",
        proposal,
        reason: row.finding.reason ?? "Edited by hand",
        decidedBy: isAgentCaller(ctx?.caller) ? "agent" : "person",
        updatedAt: nowIso(),
      })
      .where(eq(schema.findings.id, id));
    return { id, message: "Rewrite saved." };
  },
});
