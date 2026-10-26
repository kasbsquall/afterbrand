import { createToolkitI18nCatalog } from "@agent-native/toolkit/app/i18n";

import enUS from "./en-US";

// English only: the queue copy, the agent skill and the eval are written in
// English, and a half-translated screen reads as broken.
export const i18nCatalog = createToolkitI18nCatalog({
  messages: enUS,
  supportedLocales: ["en-US"],
  localeLoaders: {},
});
