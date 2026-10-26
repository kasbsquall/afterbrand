import { z } from "zod";

export const RULE_CHANGED_EVENT = "afterbrand.rule.changed";

export const ruleChangedPayload = z.object({
  ruleId: z.string(),
  oldName: z.string(),
  newName: z.string(),
  change: z.enum(["created", "updated"]),
  fields: z.array(z.string()).describe("Rule fields that changed"),
  changedBy: z.enum(["person", "agent"]),
});

export type RuleChangedPayload = z.infer<typeof ruleChangedPayload>;
