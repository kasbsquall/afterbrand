import { fail } from "@agent-native/core/action";

import { mentionPattern } from "./mentions.js";

export interface RewriteCheck {
  ok: boolean;
  problems: string[];
}

// Spans a rewrite must leave untouched: URLs, inline code, quoted strings.
const PROTECTED = /https?:\/\/\S+|`[^`]+`|"[^"]*"|“[^”]*”/g;
// URLs, HTML tags and Markdown links.
const LINK_OR_MARKUP = /https?:\/\/|www\.|\b[a-z0-9-]+\.(?:com|io|net|org|dev|ai|co|app)\b|<\/?[a-z][^>]*>|\]\(/gi;
// How far beyond the mentions an edit may reach (articles, verb agreement).
const SLACK_CHARS = 40;

function changedRegion(before: string, after: string): { start: number; endBefore: number; endAfter: number } {
  let prefix = 0;
  while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) prefix++;
  let suffix = 0;
  while (
    suffix < before.length - prefix &&
    suffix < after.length - prefix &&
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  )
    suffix++;
  return { start: prefix, endBefore: before.length - suffix, endAfter: after.length - suffix };
}

// Code, not the agent, has the last word on whether a rewrite is safe to apply.
export function verifyRewrite(input: {
  sentence: string;
  proposal: string;
  oldName: string;
  newName: string;
  mentionOffsets: { start: number; end: number }[]; // relative to the sentence
}): RewriteCheck {
  const { sentence, proposal, oldName, newName, mentionOffsets } = input;
  const problems: string[] = [];
  if (!proposal.trim()) return { ok: false, problems: ["The rewrite is empty."] };
  if (proposal === sentence) problems.push("The rewrite does not change the sentence.");
  if (!proposal.includes(newName)) problems.push(`The rewrite does not contain "${newName}".`);

  for (const span of sentence.match(PROTECTED) ?? []) {
    if (span.match(mentionPattern(oldName))) continue; // a quoted product name may change
    if (!proposal.includes(span)) problems.push(`A protected span changed: ${span}`);
  }

  // The blog text is untrusted, so a rewrite may not smuggle in links or markup.
  const count = (text: string) => (text.match(LINK_OR_MARKUP) ?? []).length;
  if (count(proposal) > count(sentence)) problems.push("The rewrite adds a link or markup.");

  if (mentionOffsets.length > 0 && proposal !== sentence) {
    const first = Math.min(...mentionOffsets.map((m) => m.start));
    const last = Math.max(...mentionOffsets.map((m) => m.end));
    const region = changedRegion(sentence, proposal);
    if (region.start < first - SLACK_CHARS || region.endBefore > last + SLACK_CHARS) {
      problems.push("The rewrite edits text far from the old name.");
    }
    // Room for the longer name plus small grammar fixes, not new claims.
    const grown = region.endAfter - region.start - (region.endBefore - region.start);
    const allowed = mentionOffsets.length * Math.max(0, newName.length - oldName.length) + SLACK_CHARS / 2;
    if (grown > allowed) problems.push("The rewrite adds text beyond the new name.");
  }
  return { ok: problems.length === 0, problems };
}

// Replace one sentence in a page body, failing closed if the page changed.
export function replaceSentence(
  body: string,
  sentenceStart: number,
  before: string,
  after: string,
): string {
  if (body.slice(sentenceStart, sentenceStart + before.length) !== before) {
    fail("The page changed since this finding was created. Run find-candidates again.");
  }
  return body.slice(0, sentenceStart) + after + body.slice(sentenceStart + before.length);
}
