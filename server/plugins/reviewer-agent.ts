import { resourceGetByPath, resourcePut, SHARED_OWNER } from "@agent-native/core/resources/store";
import { defineNitroPlugin } from "@agent-native/core/server";

import { REVIEWER_PATH, REVIEWER_PROFILE } from "../lib/reviewer-profile.js";

// The reviewer's profile lives in the code; each start writes it to the shared
// agent resources when it differs, so every user's agent can spawn it.
export default defineNitroPlugin(() => {
  void (async () => {
    const current = await resourceGetByPath(SHARED_OWNER, REVIEWER_PATH);
    if (current?.content === REVIEWER_PROFILE) return;
    await resourcePut(SHARED_OWNER, REVIEWER_PATH, REVIEWER_PROFILE, "text/markdown");
  })().catch((error) => console.warn("[afterbrand] The reviewer profile could not be saved.", error));
});
