import { registerEvent } from "@agent-native/core/event-bus";
import { getOrgContext } from "@agent-native/core/org";
import {
  createAgentChatPlugin,
  loadActionsFromStaticRegistry,
} from "@agent-native/core/server";

import actionsRegistry from "../../.generated/actions-registry.js";
import { RULE_CHANGED_EVENT, ruleChangedPayload } from "../lib/events.js";

// Automations can re-scan the library when a rule is added or edited.
registerEvent({
  name: RULE_CHANGED_EVENT,
  description:
    "A rebrand rule was created or changed (names, date, exceptions or enabled). Pages may have new or different mentions to review.",
  payloadSchema: ruleChangedPayload,
  example: {
    ruleId: "rule_123",
    oldName: "Fusion",
    newName: "Builder Code",
    change: "updated",
    fields: ["exceptions"],
    changedBy: "person",
  },
});

// Everything the agent needs for its usual jobs is loaded up front. When a
// tool is loaded mid-turn through tool-search, the tool list changes and the
// Anthropic API rejects the earlier thinking blocks of that turn (400, "The
// tools list differs from the one this block was created with").
const INITIAL_TOOL_NAMES = [
  "docs-search",
  "manage-automations",
  "get-page",
  "reopen-findings",
  "view-screen",
  "get-library-overview",
  "navigate",
  "list-rules",
  "upsert-rule",
  "find-candidates",
  "list-findings",
  "record-decisions",
  "accept-findings",
  "reject-findings",
  "edit-finding",
  "revert-change",
  "publish-changes",
  "set-page-read-only",
];

export default createAgentChatPlugin({
  appId: "afterbrand",
  actions: loadActionsFromStaticRegistry(actionsRegistry),
  // What MCP clients such as Claude Code can call: the queue read-outs.
  // Writes stay inside the app, where approvals and undo cards live.
  mcp: {
    connectorCatalog: ["get-library-overview", "list-findings", "list-rules", "list-pages", "get-page"],
  },
  // The model the eval measured (eval/results/report-test.md).
  model: "claude-sonnet-5-5",
  initialToolNames: INITIAL_TOOL_NAMES,
  // Afterbrand's work happens in its own actions. Groups it never uses stay
  // off, so a public deploy cannot browse the web, query the raw database or
  // reach other apps through the agent.
  frameworkTools: {
    database: "off",
    web: false,
    browserSessions: false,
    workspaceApps: false,
    email: false,
    emailCatalog: false,
    launchDarkly: false,
    labs: false,
    extensions: false,
  },
  codeExecution: { production: "off" },
  resolveOrgId: async (event) => (await getOrgContext(event)).orgId,
  systemPrompt: `You are the Afterbrand agent. A company renamed products; you help its content team find every sentence in their library that still uses a retired name, decide in context what to do with each one, and draft the fix. People review and approve every change.

Your job, in order:
1. Read the rules with list-rules. Each rule has a retired name, its replacement, an effective date and plain-language exceptions. The exceptions are the team's instructions; follow them literally.
2. Run find-candidates after rules change. It finds sentences; it decides nothing.
3. Decide undecided findings with record-decisions, in batches of up to 50, following the afterbrand-decide skill (read it once with docs-search slug "skill-afterbrand-decide"). Every decision gets a one-line reason a reviewer can check in a second.
4. When the person selects findings and gives a plain-language instruction ("these are changelogs, never touch changelogs"), read the selection with view-screen, then turn the instruction into one exception per affected rule with upsert-rule: send the full exceptions text with the current text kept as it is and the new exception appended on its own line, written as a short rule a reviewer can read ("Launch announcement posts: keep the old name, they record what shipped."). Then find every pending finding the new exception covers, the selection and the same kind of page elsewhere (list-findings with pageQuery or pageId), and re-decide them with record-decisions, citing the new exception in the reason. Report how many you re-decided and on how many pages.
5. Apply (accept-findings) or publish (publish-changes) only when the person asks. Publishing sends what is already accepted, nothing more: never accept a finding in order to publish it, and never re-apply a change a person undid unless they ask for that finding by name. Both need their approval. So do creating a rule, renaming one, moving its date, disabling it, rewriting exceptions it already has, unlocking a read-only page and writing your own rewrite with edit-finding; appending an exception the person asked for does not. Never re-decide a finding a person decided; record-decisions refuses it.

Never decide without reading the sentence. Never invent a rewrite that changes meaning. When in doubt, decide unsure: a person looks at it. Report counts with their denominator ("decided 48 of 50"). Talk in the screen's words: Change, Keep and Needs you (never "unsure"), page titles (never finding, change or rule ids), and plain dates.`,
});
