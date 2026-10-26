import { defineAgentNativeConfig } from "@agent-native/core/config";

export default defineAgentNativeConfig({
  changelog: { enabled: false },
  harness: true,
  // The UI copy, the agent skill and the eval are English; one language end to end.
  translations: { locales: ["en"] },
});
