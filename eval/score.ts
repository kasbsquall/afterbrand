// Scores every system in eval/results/ against the gold labels, on one split.
// Gold: labeler A and B agree, else Kevin's adjudication, else unsure.
// Writes eval/results/report-<split>.md and report-<split>.json.
// Run: node node_modules/tsx/dist/cli.mjs eval/score.ts --split test
import { readdir, readFile, writeFile } from "node:fs/promises";

type Label = "change" | "keep" | "unsure";
type Run = {
  system: string;
  split?: string;
  repeat?: number;
  usage?: { inputTokens: number; outputTokens: number; cacheReadTokens: number; ms: number; model: string; llmCalls: number };
  attemptedChanges?: number;
  refused?: { id: string; problem: string }[];
  records: { key: string; decision: Label | null; reason?: string | null; stratum?: string }[];
};

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
};
const pct = (n: number, d: number) => (d === 0 ? "n/a" : `${((100 * n) / d).toFixed(1)}%`);

async function json<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

async function gold() {
  const a = (await json<{ labels: { key: string; label: Label }[] }>("eval/labels/labeler-a.json")).labels;
  const b = new Map(
    (await json<{ labels: { key: string; label: Label }[] }>("eval/labels/labeler-b.json")).labels.map((l) => [l.key, l.label]),
  );
  const adjudicated = new Map(
    (await json<{ items: { key: string; kevin: Label | null }[] }>("eval/labels/adjudication.json")).items.map((i) => [
      i.key,
      i.kevin,
    ]),
  );
  const out = new Map<string, { label: Label; source: string }>();
  for (const l of a) {
    if (l.label === b.get(l.key)) out.set(l.key, { label: l.label, source: "agreed" });
    else {
      const kevin = adjudicated.get(l.key);
      out.set(l.key, kevin ? { label: kevin, source: "kevin" } : { label: "unsure", source: "provisional" });
    }
  }
  return out;
}

function score(records: Run["records"], truth: Map<string, { label: Label }>) {
  const s = { n: 0, goldChange: 0, goldKeep: 0, goldUnsure: 0, wrongEdits: 0, misses: 0, toHuman: 0, toHumanAmbiguous: 0, correct: 0, undecided: 0 };
  for (const r of records) {
    const g = truth.get(r.key)?.label;
    if (!g) continue;
    s.n++;
    if (g === "change") s.goldChange++;
    if (g === "keep") s.goldKeep++;
    if (g === "unsure") s.goldUnsure++;
    const d = r.decision;
    if (d === null) s.undecided++;
    if (d === "unsure") {
      s.toHuman++;
      if (g === "unsure") s.toHumanAmbiguous++;
    }
    if (d === "change" && g === "keep") s.wrongEdits++;
    if (d === "keep" && g === "change") s.misses++;
    if (d === g || (g === "unsure" && d === "unsure")) s.correct++;
  }
  return s;
}

async function main() {
  const split = arg("split", "test");
  const sample = await json<{ testHash: string; items: { key: string; split: string; url: string }[] }>("eval/sample.json");
  const keys = new Set(sample.items.filter((i) => i.split === split).map((i) => i.key));
  const truth = await gold();
  const files = (await readdir("eval/results")).filter((f) => f.endsWith(".json") && !f.startsWith("report"));
  const runs: (Run & { file: string })[] = [];
  for (const file of files.sort()) {
    const run = await json<Run>(`eval/results/${file}`);
    const records = run.records.filter((r) => keys.has(r.key));
    if (records.length === 0) continue;
    runs.push({ ...run, file, records });
  }

  const lines: string[] = [];
  const goldCounts = [...keys].map((k) => truth.get(k)!.label);
  const pages = new Set(sample.items.filter((i) => keys.has(i.key)).map((i) => i.url)).size;
  lines.push(`# Eval report, ${split} split`, "");
  lines.push(`Test set hash: \`${sample.testHash}\``, "");
  lines.push(
    `${keys.size} mentions on ${pages} pages. Gold labels: ${goldCounts.filter((l) => l === "change").length} change, ${goldCounts.filter((l) => l === "keep").length} keep, ${goldCounts.filter((l) => l === "unsure").length} unsure (${[...keys].filter((k) => truth.get(k)!.source === "provisional").length} of them provisional, waiting for adjudication).`,
    "",
  );
  lines.push("| System | Run | Wrong edits (should stay, was changed) | Misses (should change, was kept) | Sent to a person | Of those, truly ambiguous | Agrees with gold |");
  lines.push("|---|---|---|---|---|---|---|");
  const summary: unknown[] = [];
  for (const run of runs) {
    const s = score(run.records, truth);
    const label = run.repeat ? `r${run.repeat}` : "-";
    lines.push(
      `| ${run.system} | ${label} | ${s.wrongEdits} of ${s.goldKeep} (${pct(s.wrongEdits, s.goldKeep)}) | ${s.misses} of ${s.goldChange} (${pct(s.misses, s.goldChange)}) | ${s.toHuman} of ${s.n} | ${s.toHumanAmbiguous} of ${s.toHuman} | ${s.correct} of ${s.n} (${pct(s.correct, s.n)}) |`,
    );
    summary.push({ file: run.file, system: run.system, repeat: run.repeat ?? null, ...s, usage: run.usage ?? null, attemptedChanges: run.attemptedChanges ?? null, refused: run.refused?.length ?? null });
  }

  const agentRuns = runs.filter((r) => r.system === "afterbrand");
  if (agentRuns.length > 0) {
    lines.push("", "## Afterbrand details", "");
    for (const run of agentRuns) {
      const u = run.usage!;
      lines.push(
        `- r${run.repeat}: model ${u.model}, ${u.llmCalls} model calls, ${u.inputTokens} input tokens (${u.cacheReadTokens} from cache), ${u.outputTokens} output tokens, ${(u.ms / 1000).toFixed(0)} s. Rewrites refused by the verifier: ${run.refused?.length ?? 0} of ${run.attemptedChanges ?? 0} attempted. Per 100 mentions: ${Math.round((100 * u.inputTokens) / run.records.length)} input tokens, ${((u.ms / 1000) * 100 / run.records.length).toFixed(0)} s.`,
      );
    }
    if (agentRuns.length > 1) {
      const byKey = new Map<string, Set<string>>();
      for (const run of agentRuns) for (const r of run.records) byKey.set(r.key, (byKey.get(r.key) ?? new Set()).add(String(r.decision)));
      const stable = [...byKey.values()].filter((v) => v.size === 1).length;
      lines.push(`- Stability: the same decision in all ${agentRuns.length} runs for ${stable} of ${byKey.size} mentions (${pct(stable, byKey.size)}).`);
    }
    lines.push("", "## Failure catalog (last run)", "", "Each wrong edit, miss and disagreement about what needs a person, by URL and sentence offset, with the agent's reason. The sentences stay in the snapshot, not in this repo.", "");
    const last = agentRuns[agentRuns.length - 1];
    for (const r of last.records) {
      const g = truth.get(r.key)!.label;
      const kind =
        r.decision === "change" && g === "keep"
          ? "wrong edit"
          : r.decision === "keep" && g === "change"
            ? "miss"
            : r.decision === "unsure" && g !== "unsure"
              ? `sent to a person, labels say ${g}`
              : r.decision !== "unsure" && g === "unsure"
                ? `decided ${r.decision}, labels say unsure`
                : null;
      if (kind) lines.push(`- ${kind}: ${r.key}. Agent: ${r.reason ?? "(no reason)"}`);
    }
  }

  await writeFile(`eval/results/report-${split}.md`, `${lines.join("\n")}\n`);
  await writeFile(`eval/results/report-${split}.json`, `${JSON.stringify({ split, testHash: sample.testHash, runs: summary }, null, 1)}\n`);
  console.log(lines.join("\n"));
}

void main();
