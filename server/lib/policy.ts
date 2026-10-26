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

// Agent callers arrive as tool calls; MCP and A2A are other agents too.
export function isAgentCaller(caller: string | undefined): boolean {
  return caller === "tool" || caller === "mcp" || caller === "a2a" || caller === "automation";
}
