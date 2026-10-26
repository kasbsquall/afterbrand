// The baselines Afterbrand is measured against, on the same mentions.
//   find-replace: changes every match, the way a CMS search-and-replace does.
//   regex: what a competent engineer would write in an afternoon. Exact
//   capitalized name as a whole word, never inside a URL, a code span or a
//   quoted string, never in a post published before the rename took effect,
//   and for "Publish" never as the first word of a sentence (likely the verb).
//   regex-any-date: the same regex without the date filter, so it also edits
//   older posts. It is the stronger of the two; we report both.
// Reads eval/.local/items.json (local only) and writes eval/results/ files
// with keys and decisions, no text.
// Run: node node_modules/tsx/dist/cli.mjs eval/baselines.ts
import { mkdir, readFile, writeFile } from "node:fs/promises";

type Item = { key: string; split: string; publishedAt: string | null; oldName: string; sentence: string };
type Decision = "change" | "keep";

const EFFECTIVE_DATE = "2026-09-10";

function findReplace(): Decision {
  return "change";
}

function insideUrl(sentence: string, at: number): boolean {
  const before = sentence.slice(0, at);
  const token = before.slice(Math.max(before.lastIndexOf(" "), before.lastIndexOf("("), before.lastIndexOf("<")) + 1);
  return /https?:\/\/|www\.|\/$|\.\w+\/\S*$/.test(token) || sentence[at - 1] === "/" || sentence[at - 1] === "-";
}

function insideDelimiters(sentence: string, at: number, open: string, close = open): boolean {
  const before = sentence.slice(0, at);
  const opens = before.split(open).length - 1;
  if (open === close) return opens % 2 === 1;
  return opens > before.split(close).length - 1;
}

function regex(item: Item): Decision {
  if ((item.publishedAt ?? "").slice(0, 10) < EFFECTIVE_DATE) return "keep";
  return regexAnyDate(item);
}

function regexAnyDate(item: Item): Decision {
  const pattern = new RegExp(`(?<![\\w-])${item.oldName}(?![\\w-])`, "g");
  for (const match of item.sentence.matchAll(pattern)) {
    const at = match.index ?? 0;
    if (insideUrl(item.sentence, at)) continue;
    if (insideDelimiters(item.sentence, at, "`")) continue;
    if (insideDelimiters(item.sentence, at, '"') || insideDelimiters(item.sentence, at, "“", "”")) continue;
    if (item.oldName === "Publish" && item.sentence.slice(0, at).trim() === "") continue;
    return "change";
  }
  return "keep";
}

async function main() {
  const items = JSON.parse(await readFile("eval/.local/items.json", "utf8")) as Item[];
  await mkdir("eval/results", { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  for (const [system, decide] of [
    ["find-replace", findReplace],
    ["regex", regex],
    ["regex-any-date", regexAnyDate],
  ] as const) {
    const records = items.map((item) => ({ key: item.key, split: item.split, decision: decide(item) }));
    await writeFile(`eval/results/${stamp}-${system}.json`, `${JSON.stringify({ system, records }, null, 1)}\n`);
    const changed = records.filter((r) => r.decision === "change").length;
    console.log(`${system}: change ${changed} of ${records.length}`);
  }
}

void main();
