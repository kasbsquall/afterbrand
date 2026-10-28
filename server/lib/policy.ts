import { fail } from "@agent-native/core/action";

// Business rules that every caller (UI, agent, MCP, CLI) goes through.
// They live here, called from inside the actions, so no surface can skip them.

export type Decision = "change" | "keep" | "unsure";
export type Status = "pending" | "accepted" | "rejected";

export interface ApplyInput {
  decision: Decision | null;
  status: Status;
  proposal: string | null;
  pageReadOnly: boolean;
}

export function assertCanApply(input: ApplyInput): void {
  if (input.status !== "pending") fail(`This finding is already ${input.status}.`);
  if (input.pageReadOnly) fail("This page is read-only. Nothing on it can be changed.");
  // A keep is overridden only by writing a rewrite (edit-finding), which turns
  // the finding into a change decided by whoever wrote it.
  if (input.decision === "keep") fail("This mention is marked keep. Edit the rewrite to change it anyway.");
  if (input.decision === "unsure") fail("This mention needs a decision first. Edit the rewrite or decide it.");
  if (!input.proposal) fail("There is no rewrite to apply. Ask the agent to decide this finding first.");
}

export function assertCanPublish(statuses: Status[]): void {
  if (statuses.length === 0) fail("There are no accepted changes to publish.");
  if (statuses.some((s) => s !== "accepted")) {
    fail("Only accepted findings can be published.");
  }
}

// Publish and undo write page bodies too, so they respect read-only like accept.
export function assertPagesWritable(pages: { title: string; readOnly: boolean }[]): void {
  const locked = pages.find((p) => p.readOnly);
  if (locked) fail(`The page "${locked.title}" is read-only. Make it editable first.`);
}

// Agent callers arrive as tool calls; MCP and A2A are other agents too.
export function isAgentCaller(caller: string | undefined): boolean {
  return caller === "tool" || caller === "mcp" || caller === "a2a" || caller === "automation";
}

// A decision a person made is theirs: the agent may not overwrite it.
export function agentMayRedecide(decidedBy: string | null, caller: string | undefined): boolean {
  return !(isAgentCaller(caller) && decidedBy === "person");
}

// Locking a page is always safe; an agent unlocking one asks a person first.
export function unlockNeedsApproval(args: { readOnly: boolean }, caller: string | undefined): boolean {
  return isAgentCaller(caller) && !args.readOnly;
}

export interface RuleFields {
  oldName: string;
  newName: string;
  effectiveDate: string | null;
  exceptions: string;
  sourceUrl: string | null;
  enabled: boolean;
}

// Rules steer every decision, and the pages the agent reads could ask it to
// add one, so any rule change from an agent goes to a person first, appended
// exceptions included. A call that changes nothing needs no approval.
const RULE_FIELDS = ["oldName", "newName", "effectiveDate", "sourceUrl", "enabled", "exceptions"] as const;

export function ruleEditNeedsApproval(
  current: RuleFields | null,
  patch: Partial<RuleFields>,
  caller: string | undefined,
): boolean {
  if (!isAgentCaller(caller)) return false;
  if (!current) return true;
  return RULE_FIELDS.some((key) => patch[key] !== undefined && patch[key] !== current[key]);
}
