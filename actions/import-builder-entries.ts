import { defineAction, fail } from "@agent-native/core/action";
import { z } from "zod";

import { builderKeys, builderModelName, listEntries } from "../server/lib/builder-api.js";
import { importEntries } from "../server/lib/builder-source.js";
import { requireOwner } from "../server/lib/owner.js";

export default defineAction({
  description:
    "Import the published entries of a Builder model from the connected Builder space into the library, then find the sentences with retired names in them. Reads the Text blocks of each entry; a page with accepted changes that Builder does not publish yet is left as it is. Use when the person asks to bring in or refresh their Builder content.",
  schema: z.object({
    model: builderModelName,
    limit: z.coerce.number().int().min(1).max(300).default(100).describe("Most entries to read"),
  }),
  run: async ({ model, limit }, ctx) => {
    const ownerEmail = requireOwner(ctx);
    const { publicKey } = await builderKeys();
    if (!publicKey) fail("Connect a Builder space first: add its public API key in Settings.");
    const entries = await listEntries(publicKey, model, limit);
    const { pageIds, ...s } = await importEntries(ownerEmail, model, entries);
    const kept = s.kept > 0 ? ` ${s.kept} kept as they are, because they have accepted changes Builder does not publish yet.` : "";
    return {
      model,
      read: entries.length,
      pages: pageIds.length,
      ...s,
      message: `Read ${entries.length} entries of ${model}: ${s.created} new pages, ${s.updated} updated, ${s.unchanged} unchanged, ${s.empty} without text.${kept} ${s.newFindings} new findings.`,
    };
  },
});
