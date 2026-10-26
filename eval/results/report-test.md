# Eval report, test split

Test set hash: `1676b998893beda6595d54936474bac45edb69a863b536045aeb8643efb139da`

140 mentions on 70 pages. Gold labels: 102 change, 35 keep, 3 unsure (2 of them provisional, waiting for adjudication).

| System | Run | Wrong edits (should stay, was changed) | Misses (should change, was kept) | Sent to a person | Of those, truly ambiguous | Agrees with gold |
|---|---|---|---|---|---|---|
| find-replace | - | 35 of 35 (100.0%) | 0 of 102 (0.0%) | 0 of 140 | 0 of 0 | 102 of 140 (72.9%) |
| regex-any-date | - | 8 of 35 (22.9%) | 1 of 102 (1.0%) | 0 of 140 | 0 of 0 | 128 of 140 (91.4%) |
| regex | - | 5 of 35 (14.3%) | 102 of 102 (100.0%) | 0 of 140 | 0 of 0 | 30 of 140 (21.4%) |
| afterbrand | r1 | 0 of 35 (0.0%) | 0 of 102 (0.0%) | 5 of 140 | 2 of 5 | 136 of 140 (97.1%) |
| afterbrand | r2 | 0 of 35 (0.0%) | 0 of 102 (0.0%) | 6 of 140 | 2 of 6 | 135 of 140 (96.4%) |
| afterbrand | r3 | 0 of 35 (0.0%) | 0 of 102 (0.0%) | 7 of 140 | 2 of 7 | 134 of 140 (95.7%) |

## Afterbrand details

- r1: model claude-sonnet-5-5, 9 model calls, 503191 input tokens (429255 from cache), 20631 output tokens, 173 s. Rewrites refused by the verifier: 0 of 100 attempted. Per 100 mentions: 359422 input tokens, 123 s.
- r2: model claude-sonnet-5-5, 11 model calls, 631920 input tokens (552521 from cache), 20458 output tokens, 160 s. Rewrites refused by the verifier: 0 of 99 attempted. Per 100 mentions: 451371 input tokens, 114 s.
- r3: model claude-sonnet-5-5, 11 model calls, 650371 input tokens (568685 from cache), 20280 output tokens, 178 s. Rewrites refused by the verifier: 0 of 98 attempted. Per 100 mentions: 464551 input tokens, 127 s.
- Stability: the same decision in all 3 runs for 136 of 140 mentions (97.1%).

## Failure catalog (last run)

Each wrong edit, miss and disagreement about what needs a person, by URL and sentence offset, with the agent's reason. The sentences stay in the snapshot, not in this repo.

- sent to a person, labels say change: https://www.builder.io/blog/context-engineering#2345#Fusion. Agent: 'We built Fusion' could be history or the present product; a person should decide
- sent to a person, labels say change: https://www.builder.io/blog/ai-ux-design#1038#Fusion. Agent: Heading with no verb or context: just the product name
- decided change, labels say unsure: https://www.builder.io/blog/how-product-teams-built-with-builder#3141#Fusion. Agent: Current: product feature description
- sent to a person, labels say change: https://www.builder.io/blog/cursor-alternatives-2026#6871#Fusion. Agent: Heading fragment "Fusion vs." with no verb or context; a person should check it
- sent to a person, labels say change: https://www.builder.io/blog/ai-prototyping-guide#2111#Fusion. Agent: Bare label "Builder.io Fusion" with no verb; prefix handling needs a person (would read "Builder Code")
- sent to a person, labels say change: https://www.builder.io/blog/react-ai-stack#5798#Fusion. Agent: Short label "Prompt to build: Fusion" with no sentence context; could be a UI/step label
