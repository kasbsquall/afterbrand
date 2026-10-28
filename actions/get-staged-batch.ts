import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { checkBatch, findStagedBatch, parseBatchItems } from "../server/lib/batch.js";
import { requireOwner } from "../server/lib/owner.js";

export default defineAction({
  description:
    "The batch waiting for a person's review, with every sentence before and after, and whether it still matches the queue. Null when nothing is staged.",
  schema: z.object({}),
  http: { method: "GET" },
  readOnly: true,
  uiOnly: true,
  run: async (_args, ctx) => {
    const ownerEmail = requireOwner(ctx);
    const batch = await findStagedBatch(ownerEmail);
    if (!batch) return { batch: null };
    const items = parseBatchItems(batch);
    const { problem, problems } = await checkBatch(ownerEmail, batch);
    return {
      batch: {
        code: batch.code,
        stagedBy: batch.stagedBy,
        createdAt: batch.createdAt,
        pages: new Set(items.map((item) => item.pageId)).size,
        items: items.map((item) => ({ ...item, problem: problems[item.findingId] ?? null })),
        problem,
      },
    };
  },
});
