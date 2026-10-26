import { defineAction } from "@agent-native/core/action";
import { readAppState, readAppStateForCurrentTab } from "@agent-native/core/application-state";
import { z } from "zod";

import { loadFindings } from "../server/lib/findings-read.js";
import { requireOwner } from "../server/lib/owner.js";

const MAX_SELECTED = 50;

export default defineAction({
  description:
    "Read what the person is looking at: the current view and the findings they selected, with each sentence, page, rule, decision and proposed rewrite. Use it when they say this, these or the selected ones.",
  schema: z.object({}),
  http: false,
  readOnly: true,
  run: async (_args, ctx) => {
    const navigation = await readAppState("navigation");
    const selection = await readAppStateForCurrentTab("selection");
    const screen: Record<string, unknown> = {};
    if (navigation) screen.navigation = navigation;

    const ids = Array.isArray(selection?.findingIds)
      ? (selection.findingIds as unknown[]).filter((v): v is string => typeof v === "string").slice(0, MAX_SELECTED)
      : [];
    if (ids.length > 0) {
      const rows = await loadFindings(requireOwner(ctx), ids);
      screen.selectedFindings = rows.map(({ finding, page, rule }) => ({
        id: finding.id,
        page: page.title,
        url: page.url,
        publishedAt: page.publishedAt,
        readOnly: page.readOnly,
        rule: `${rule.oldName} -> ${rule.newName}`,
        sentence: finding.sentence,
        decision: finding.decision,
        reason: finding.reason,
        proposal: finding.proposal,
        status: finding.status,
      }));
    }

    if (Object.keys(screen).length === 0) return "No application state found. Is the app open?";
    return screen;
  },
});
