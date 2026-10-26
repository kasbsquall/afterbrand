// Runs the app's own agent, headless, on one split of the sample, k times.
// Each repeat clears the decisions of those findings in the eval database,
// asks the agent to decide them in batches through the same actions and skill
// the chat uses, then reads back what was saved. Writes one JSON file per run
// to eval/results/ (keys, decisions, reasons, usage; no blog text).
// Run: node node_modules/tsx/dist/cli.mjs eval/run-agent.ts --split dev --k 1
import { spawn, spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const EVAL_ENV = { DATABASE_URL: "pglite:./data/pglite-eval", AGENT_USER_EMAIL: "eval@local.test" };
const BATCH = 50;
const AGENT_TIMEOUT_MS = 15 * 60 * 1000;

type SampleItem = { key: string; findingId: string; split: "dev" | "test"; stratum: string };

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}

function run(args: string[]) {
  const started = Date.now();
  const out = spawnSync(process.execPath, args, {
    env: { ...process.env, ...EVAL_ENV },
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
  if (out.status !== 0) throw new Error(`Command failed (${out.status}): ${out.stderr.slice(-2000)}`);
  return { stdout: out.stdout, ms: Date.now() - started };
}

// The headless agent prints its JSON result and then keeps the process alive
// (open handles in 0.220.0), so stop it once the document is complete.
function runAgent(args: string[]): Promise<{ result: any; ms: number }> {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { env: { ...process.env, ...EVAL_ENV } });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Agent timed out after ${AGENT_TIMEOUT_MS} ms: ${stderr.slice(-1000)}`));
    }, AGENT_TIMEOUT_MS);
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      try {
        const result = jsonFrom(stdout, "{");
        clearTimeout(timer);
        child.kill();
        resolve({ result, ms: Date.now() - started });
      } catch {
        // Not complete yet.
      }
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      try {
        resolve({ result: jsonFrom(stdout, "{"), ms: Date.now() - started });
      } catch {
        reject(new Error(`Agent exited (${code}) without a result: ${stderr.slice(-1000)}`));
      }
    });
  });
}

// Log lines come before the JSON document; it starts on its own line.
function jsonFrom(stdout: string, open: "{" | "["): any {
  const start = stdout.search(open === "{" ? /^\{/m : /^\[/m);
  if (start === -1) throw new Error(`No JSON in output: ${stdout.slice(0, 500)}`);
  return JSON.parse(stdout.slice(start));
}

function action(name: string, payload: unknown) {
  return run(["node_modules/tsx/dist/cli.mjs", "eval/db-tool.ts", name, JSON.stringify(payload)]).stdout;
}

const prompt = (ids: string[]) =>
  `Decide exactly these ${ids.length} findings with record-decisions, following the afterbrand-decide skill (read it once with docs-search slug "skill-afterbrand-decide"). Read them with list-findings using the ids filter. Do not decide any other finding and do not accept, reject or publish anything. If record-decisions refuses a rewrite, fix it and resend that finding. Finding ids: ${ids.join(", ")}`;

async function main() {
  const split = arg("split", "dev");
  const k = Number(arg("k", "1"));
  const sample = JSON.parse(await readFile("eval/sample.json", "utf8")) as { testHash: string; items: SampleItem[] };
  const items = sample.items.filter((i) => i.split === split);
  const ids = items.map((i) => i.findingId);
  await mkdir("eval/results", { recursive: true });

  for (let repeat = 1; repeat <= k; repeat++) {
    action("reset", { ids });
    const usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, llmCalls: 0, ms: 0, model: "" };
    const refused: { id: string; problem: string }[] = [];
    let attemptedChanges = 0;
    for (let i = 0; i < ids.length; i += BATCH) {
      const batch = ids.slice(i, i + BATCH);
      const { result, ms } = await runAgent([
        "--import",
        "tsx",
        "node_modules/@agent-native/core/bin/agent-native.js",
        "agent",
        prompt(batch),
        "--json",
      ]);
      usage.ms += ms;
      usage.inputTokens += result.usage?.inputTokens ?? 0;
      usage.outputTokens += result.usage?.outputTokens ?? 0;
      usage.cacheReadTokens += result.usage?.cacheReadTokens ?? 0;
      usage.llmCalls += result.usage?.llmCalls ?? 0;
      usage.model = result.usage?.model ?? usage.model;
      for (const event of result.events ?? []) {
        if (event.type !== "tool_done" || event.tool !== "record-decisions") continue;
        attemptedChanges += (event.input?.decisions ?? []).filter((d: any) => d.decision === "change").length;
        refused.push(...(event.result?.rejected ?? []));
      }
    }
    const decided = jsonFrom(action("read", { ids }), "[") as {
      id: string;
      decision: string | null;
      reason: string | null;
      hasProposal: boolean;
    }[];
    const byId = new Map(decided.map((d) => [d.id, d]));
    const records = items.map((item) => {
      const d = byId.get(item.findingId);
      return { key: item.key, stratum: item.stratum, decision: d?.decision ?? null, reason: d?.reason ?? null };
    });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const file = `eval/results/${stamp}-afterbrand-${split}-r${repeat}.json`;
    await writeFile(
      file,
      `${JSON.stringify({ system: "afterbrand", split, repeat, testHash: sample.testHash, usage, attemptedChanges, refused, records }, null, 1)}\n`,
    );
    console.log(`${file}: ${records.filter((r) => r.decision).length} of ${records.length} decided, ${usage.ms} ms`);
  }
  process.exit(0);
}

void main();
