# Evaluation

How Afterbrand's decisions compare with find-and-replace and with a regex, on the same mentions of Builder.io's public blog, labeled by two independent language-model labelers (Claude Opus and Claude Fable) who never saw the agent's output.

## What is in this folder

| File | What it holds |
|---|---|
| `LABELING.md` | The guideline the labelers followed. Same rules as the agent's skill (`.agents/skills/afterbrand-decide/SKILL.md`). |
| `sample.ts` | Draws the stratified sample from a fresh eval database and freezes the test set hash. |
| `sample.json` | The sample: URL, sentence offset, page hash, stratum and split per mention. No blog text. |
| `labels/labeler-a.json`, `labels/labeler-b.json` | Two independent label sets, by URL and offset. |
| `labels/adjudication.json` | The mentions the labelers disagreed on. Until a person adjudicates them they count as unsure. |
| `baselines.ts` | find-and-replace, the regex as specified (skips posts before the rename), and the same regex on every date. |
| `run-agent.ts` | Runs the app's own agent headless on a split, k times, through the same actions and skill as the chat. |
| `score.ts` | Scores every run in `results/` and writes `results/report-<split>.md`. |
| `results/` | One JSON file per run, plus the reports. |

The blog text never enters the repo. `eval/.local/` (git-ignored) holds the sentences the labelers read, rebuilt from the snapshot.

## Reproduce

```bash
node node_modules/tsx/dist/cli.mjs scripts/fetch-snapshot.ts
export DATABASE_URL=pglite:./data/pglite-eval AGENT_USER_EMAIL=eval@local.test
node node_modules/tsx/dist/cli.mjs actions/run.ts import-pages '{"snapshot":"builder-blog-2026-10-25"}'
node node_modules/tsx/dist/cli.mjs actions/run.ts seed-rules '{}'
node node_modules/tsx/dist/cli.mjs actions/run.ts find-candidates '{}'
node node_modules/tsx/dist/cli.mjs eval/sample.ts
unset DATABASE_URL AGENT_USER_EMAIL
node node_modules/tsx/dist/cli.mjs eval/baselines.ts
node node_modules/tsx/dist/cli.mjs eval/run-agent.ts --split test --k 3
node node_modules/tsx/dist/cli.mjs eval/score.ts --split test
```

The snapshot is dated Oct 25, 2026. Every item in `sample.json` carries the content hash of its page, and `sample.ts` prints the test set hash, built from keys and page hashes: if a post changed since then, the hash will not match the one committed in `sample.json`.

## Limits

- The labels are ours, made for this evaluation. They are not Builder's.
- Two strata are small because the blog is: only 5 Fusion mentions and 13 Publish mentions appear in posts published after the rename. They are all in the sample.
- The labelers are language models (Claude Opus and Claude Fable), different from the model under test (Claude Sonnet 5.5).
