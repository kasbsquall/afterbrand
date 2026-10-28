import { defineAction, fail } from "@agent-native/core/action";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { assertAllApplicable, BATCH_CODE_LENGTH, batchDigest, batchItems } from "../server/lib/batch.js";
import { loadFindings } from "../server/lib/findings-read.js";
import { nowIso, requireOwner, stableId } from "../server/lib/owner.js";
import { isAgentCaller } from "../server/lib/policy.js";

export default defineAction({
  description:
    "Stage up to 50 findings decided as change, each with a rewrite, as one batch for a person to review. Changes nothing on any page. The queue screen then shows every sentence before and after with the batch code; the person accepts it there, or you call accept-findings with that code and they approve exactly that batch. Staging replaces the batch that was waiting.",
  schema: z.object({
    ids: z.array(z.string()).min(1).max(50).describe("Finding ids decided as change, with a rewrite"),
  }),
  run: async ({ ids }, ctx) => {
    const ownerEmail = requireOwner(ctx);
    const unique = [...new Set(ids)];
    const rows = await loadFindings(ownerEmail, unique);
    if (rows.length !== unique.length) fail("Some findings were not found. Refresh the queue and try again.");
    assertAllApplicable(rows);

    const items = batchItems(rows);
    const digest = batchDigest(items);
    const code = digest.slice(0, BATCH_CODE_LENGTH);
    const now = nowIso();
    const db = getDb();
    // One batch waits at a time, so the screen and the approval never disagree on which.
    await db
      .update(schema.batches)
      .set({ status: "discarded", closedAt: now })
      .where(and(eq(schema.batches.ownerEmail, ownerEmail), eq(schema.batches.status, "staged")));
    await db.insert(schema.batches).values({
      id: stableId("b", ownerEmail, digest, now),
      ownerEmail,
      code,
      digest,
      items: JSON.stringify(items),
      stagedBy: isAgentCaller(ctx?.caller) ? "agent" : "person",
      status: "staged",
      createdAt: now,
    });

    const pages = new Set(items.map((item) => item.pageId)).size;
    return {
      batch: code,
      staged: items.length,
      pages,
      message: `Staged ${items.length} change${items.length === 1 ? "" : "s"} on ${pages} page${pages === 1 ? "" : "s"} as batch ${code}. The queue shows each sentence before and after.`,
    };
  },
});
