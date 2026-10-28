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

export const PAGE_PUBLISHED_EVENT = "afterbrand.page.published";

export const pagePublishedPayload = z.object({
  pageId: z.string(),
  title: z.string(),
  model: z.string().describe("Builder model the entry belongs to"),
  newFindings: z.number().describe("Sentences with a retired name found on the page"),
});

export type PagePublishedPayload = z.infer<typeof pagePublishedPayload>;
