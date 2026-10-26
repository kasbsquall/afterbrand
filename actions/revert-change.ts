import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { requireOwner } from "../server/lib/owner.js";
import { revertChanges } from "../server/lib/undo.js";

export default defineAction({
  description:
    "Undo applied changes before they are published: restores each original sentence and puts its finding back to pending.",
  schema: z.object({
    changeIds: z.array(z.string()).min(1).max(50).describe("Change ids returned by accept-findings"),
  }),
  run: async ({ changeIds }, ctx) => revertChanges(requireOwner(ctx), changeIds),
});
