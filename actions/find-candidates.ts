import { defineAction, fail } from "@agent-native/core/action";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { loadEnabledRules, syncPageFindings } from "../server/lib/findings-sync.js";
import { requireOwner } from "../server/lib/owner.js";

export default defineAction({
  description:
    "Find every sentence in the library that mentions a retired name, one finding per sentence and rule. Deterministic: it does not decide anything. Keeps decisions already made on unchanged sentences. Run it after adding or editing a rule, before deciding findings.",
  schema: z.object({
    ruleIds: z.array(z.string()).optional().describe("Rules to scan for; defaults to every enabled rule"),
    pageIds: z.array(z.string()).optional().describe("Pages to scan; defaults to the whole library"),
  }),
  run: async ({ ruleIds, pageIds }, ctx) => {
    const ownerEmail = requireOwner(ctx);
    const rules = await loadEnabledRules(ownerEmail, ruleIds);
    if (rules.length === 0) fail("There are no enabled rules. Add the names you retired first.");

    const db = getDb();
    const pages = await db
      .select()
      .from(schema.pages)
      .where(
        and(
          eq(schema.pages.ownerEmail, ownerEmail),
          pageIds && pageIds.length > 0 ? inArray(schema.pages.id, pageIds) : undefined,
        ),
      );

    const totals = { created: 0, kept: 0, removed: 0 };
    let pagesWithFindings = 0;
    for (const page of pages) {
      const counts = await syncPageFindings(ownerEmail, page, rules);
      totals.created += counts.created;
      totals.kept += counts.kept;
      totals.removed += counts.removed;
      if (counts.created + counts.kept > 0) pagesWithFindings++;
    }
    return {
      message: `Scanned ${pages.length} pages for ${rules.map((r) => r.oldName).join(", ")}: ${totals.created} new findings, ${totals.kept} unchanged, ${totals.removed} removed.`,
      pagesScanned: pages.length,
      pagesWithFindings,
      ...totals,
      nextRequiredAction: "list-findings",
    };
  },
});
