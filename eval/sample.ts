// Draws the evaluation sample from the candidate findings of a fresh eval
// database (snapshot import + seed rules + find-candidates, no decisions).
// Stratified by retired name and by whether the post predates the rename,
// split into dev and test with a fixed seed. Writes:
//   eval/sample.json        committed: ids, URLs, offsets, hashes, no text
//   eval/.local/items.json  local only: sentence and context for labelers
// Run: DATABASE_URL=pglite:./data/pglite-eval AGENT_USER_EMAIL=eval@local.test \
//      node node_modules/tsx/dist/cli.mjs eval/sample.ts
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";

import { and, eq } from "drizzle-orm";

import { getDb, schema } from "../server/db/index.js";

const SEED = 20261026;
const TARGET = 200;
const MIN_PER_STRATUM = 25;
const DEV_SHARE = 0.3;
const CONTEXT_CHARS = 700;

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// The paragraph around the sentence, trimmed to a readable window.
function contextOf(body: string, start: number, length: number): string {
  const lineStart = body.lastIndexOf("\n", start - 1) + 1;
  const lineEndRaw = body.indexOf("\n", start + length);
  const lineEnd = lineEndRaw === -1 ? body.length : lineEndRaw;
  const from = Math.max(lineStart, start - CONTEXT_CHARS / 2);
  const to = Math.min(lineEnd, start + length + CONTEXT_CHARS / 2);
  return `${from > lineStart ? "..." : ""}${body.slice(from, to)}${to < lineEnd ? "..." : ""}`;
}

async function main() {
  const ownerEmail = process.env.AGENT_USER_EMAIL;
  if (!ownerEmail) throw new Error("Set AGENT_USER_EMAIL to the eval database owner.");
  const rows = await getDb()
    .select({ finding: schema.findings, page: schema.pages, rule: schema.rules })
    .from(schema.findings)
    .innerJoin(schema.pages, and(eq(schema.findings.pageId, schema.pages.id), eq(schema.pages.ownerEmail, ownerEmail)))
    .innerJoin(schema.rules, and(eq(schema.findings.ruleId, schema.rules.id), eq(schema.rules.ownerEmail, ownerEmail)))
    .where(eq(schema.findings.ownerEmail, ownerEmail));

  const strata = new Map<string, typeof rows>();
  for (const row of rows) {
    const effective = row.rule.effectiveDate ?? "";
    const when = (row.page.publishedAt ?? "").slice(0, 10) < effective ? "before" : "after";
    const key = `${row.rule.oldName}|${when}`;
    strata.set(key, [...(strata.get(key) ?? []), row]);
  }

  // Proportional allocation with a floor, so small strata still get measured.
  const random = mulberry32(SEED);
  const keys = [...strata.keys()].sort();
  const floors = new Map(keys.map((k) => [k, Math.min(MIN_PER_STRATUM, strata.get(k)!.length)]));
  const floorTotal = [...floors.values()].reduce((a, b) => a + b, 0);
  const rest = Math.max(0, TARGET - floorTotal);
  const spare = keys.map((k) => strata.get(k)!.length - floors.get(k)!);
  const spareTotal = spare.reduce((a, b) => a + b, 0);
  const picked: (typeof rows)[number][] = [];
  const allocation: Record<string, { population: number; sampled: number }> = {};
  keys.forEach((key, i) => {
    const extra = spareTotal === 0 ? 0 : Math.round((rest * spare[i]) / spareTotal);
    const n = Math.min(strata.get(key)!.length, floors.get(key)! + extra);
    const chosen = shuffle(strata.get(key)!, random).slice(0, n);
    allocation[key] = { population: strata.get(key)!.length, sampled: chosen.length };
    picked.push(...chosen);
  });

  const ordered = shuffle(picked, random);
  const devCount = Math.round(ordered.length * DEV_SHARE);
  const sample = ordered.map((row, i) => {
    const [oldName, when] = [row.rule.oldName, (row.page.publishedAt ?? "").slice(0, 10) < (row.rule.effectiveDate ?? "") ? "before" : "after"];
    return {
      key: `${row.page.url}#${row.finding.sentenceStart}#${row.rule.oldName}`,
      findingId: row.finding.id,
      url: row.page.url,
      contentHash: row.page.contentHash,
      sentenceStart: row.finding.sentenceStart,
      sentenceLength: row.finding.sentence.length,
      oldName,
      newName: row.rule.newName,
      publishedAt: row.page.publishedAt,
      stratum: `${oldName}|${when}`,
      split: i < devCount ? "dev" : "test",
    };
  });

  const test = sample.filter((s) => s.split === "test").map((s) => `${s.key}|${s.contentHash}`).sort();
  const testHash = createHash("sha256").update(test.join("\n")).digest("hex");

  await mkdir("eval/.local", { recursive: true });
  await writeFile(
    "eval/sample.json",
    `${JSON.stringify({ seed: SEED, target: TARGET, population: rows.length, allocation, testHash, items: sample }, null, 1)}\n`,
  );
  const byId = new Map(rows.map((r) => [r.finding.id, r]));
  const items = sample.map((s) => {
    const row = byId.get(s.findingId)!;
    return {
      key: s.key,
      split: s.split,
      pageTitle: row.page.title,
      publishedAt: s.publishedAt,
      oldName: s.oldName,
      newName: s.newName,
      sentence: row.finding.sentence,
      context: contextOf(row.page.body, row.finding.sentenceStart, row.finding.sentence.length),
    };
  });
  await writeFile("eval/.local/items.json", `${JSON.stringify(items, null, 1)}\n`);
  console.log(JSON.stringify({ population: rows.length, sampled: sample.length, dev: devCount, allocation, testHash }, null, 2));
  process.exit(0);
}

void main();
