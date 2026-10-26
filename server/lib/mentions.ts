// Deterministic candidate extraction. Code finds every mention; the agent
// decides what each one means. One candidate per sentence and rule, so a
// rewrite always replaces a whole sentence.

export interface SentenceCandidate {
  sentence: string;
  sentenceStart: number;
  mentions: { start: number; end: number; text: string }[];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Whole word, any case: "Fusion", "fusion" and "FUSION" are candidates,
// "Fusions" or "publishing" are not. Spaces in a name match any whitespace.
export function mentionPattern(name: string): RegExp {
  const body = escapeRegExp(name.trim()).replace(/\s+/g, "\\s+");
  return new RegExp(`(?<![\\w-])${body}(?![\\w-])`, "giu");
}

// Sentence bounds inside one paragraph line. Splits after . ! ? followed by
// whitespace; good enough for blog prose, and offsets stay exact.
function sentenceBounds(body: string, index: number): { start: number; end: number } {
  const lineStart = body.lastIndexOf("\n", index - 1) + 1;
  const lineEndRaw = body.indexOf("\n", index);
  const lineEnd = lineEndRaw === -1 ? body.length : lineEndRaw;
  const line = body.slice(lineStart, lineEnd);
  const rel = index - lineStart;
  let start = 0;
  const splitter = /[.!?]["')\]]*\s+/g;
  let match: RegExpExecArray | null;
  while ((match = splitter.exec(line)) !== null) {
    const boundary = match.index + match[0].length;
    if (boundary > rel) {
      return { start: lineStart + start, end: lineStart + match.index + match[0].trimEnd().length };
    }
    start = boundary;
  }
  return { start: lineStart + start, end: lineEnd };
}

export function findSentenceCandidates(body: string, name: string): SentenceCandidate[] {
  const bySentence = new Map<number, SentenceCandidate>();
  for (const match of body.matchAll(mentionPattern(name))) {
    const index = match.index ?? 0;
    const { start, end } = sentenceBounds(body, index);
    const existing = bySentence.get(start);
    const mention = { start: index, end: index + match[0].length, text: match[0] };
    if (existing) {
      existing.mentions.push(mention);
    } else {
      bySentence.set(start, {
        sentence: body.slice(start, end),
        sentenceStart: start,
        mentions: [mention],
      });
    }
  }
  return [...bySentence.values()].sort((a, b) => a.sentenceStart - b.sentenceStart);
}
