import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { requireOwner } from "../server/lib/owner.js";
import { reopenFindings } from "../server/lib/undo.js";

export default defineAction({
  description: "Reopen closed (rejected) findings so they are pending again. Undo target of reject-findings.",
  schema: z.object({
    ids: z.array(z.string()).min(1).max(50),
  }),
  run: async ({ ids }, ctx) => reopenFindings(requireOwner(ctx), ids),
});
