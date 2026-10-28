import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { builderModelName } from "../server/lib/builder-api.js";
import { createHook } from "../server/lib/builder-source.js";
import { requireOwner } from "../server/lib/owner.js";

export default defineAction({
  description:
    "Create the webhook link Builder calls when an entry of a model is published; Afterbrand then imports that entry and finds its retired names. Replaces the model's previous link. The link is shown once.",
  schema: z.object({ model: builderModelName }),
  // The link is a credential: it goes to the person's screen, never the chat.
  uiOnly: true,
  run: async ({ model }, ctx) => ({ model, path: await createHook(requireOwner(ctx), model) }),
});
