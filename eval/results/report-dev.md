# Eval report, dev split

Test set hash: `1676b998893beda6595d54936474bac45edb69a863b536045aeb8643efb139da`

60 mentions on 40 pages. Gold labels: 41 change, 17 keep, 2 unsure (2 of them provisional, waiting for adjudication).

| System | Run | Wrong edits (should stay, was changed) | Misses (should change, was kept) | Sent to a person | Of those, truly ambiguous | Agrees with gold |
|---|---|---|---|---|---|---|
| find-replace | - | 17 of 17 (100.0%) | 0 of 41 (0.0%) | 0 of 60 | 0 of 0 | 41 of 60 (68.3%) |
| regex-any-date | - | 8 of 17 (47.1%) | 0 of 41 (0.0%) | 0 of 60 | 0 of 0 | 50 of 60 (83.3%) |
| regex | - | 5 of 17 (29.4%) | 41 of 41 (100.0%) | 0 of 60 | 0 of 0 | 12 of 60 (20.0%) |
| afterbrand | r1 | 0 of 17 (0.0%) | 0 of 41 (0.0%) | 1 of 60 | 0 of 1 | 57 of 60 (95.0%) |

## Afterbrand details

- r1: model claude-sonnet-5-5, 8 model calls, 412114 input tokens (338583 from cache), 8882 output tokens, 97 s. Rewrites refused by the verifier: 0 of 41 attempted. Per 100 mentions: 686857 input tokens, 161 s.

## Failure catalog (last run)

Each wrong edit, miss and disagreement about what needs a person, by URL and sentence offset, with the agent's reason. The sentences stay in the snapshot, not in this repo.

- sent to a person, labels say change: https://www.builder.io/blog/figma-to-website#4407#Publish. Agent: Quoted 'Publish' workflow may name the Builder product or a UI label; person should decide
- decided change, labels say unsure: https://www.builder.io/blog/create-full-stack-app-ai#2108#Fusion. Agent: Current: product behavior review
- decided keep, labels say unsure: https://www.builder.io/blog/designers-ship-code-with-ai#4763#Fusion. Agent: Historical: narrates a past event in a 2025 post, before the rename
