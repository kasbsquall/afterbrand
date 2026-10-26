# Afterbrand

## One-liner

Afterbrand finds every page that still uses your old product name, decides in context which mentions should change, and drafts the fix. Your team approves every change before it ships.

## Audience

The content lead or content ops manager at a software company that just renamed one or more products. They own a library of hundreds of blog posts, docs pages and landing pages. They are not engineers. They review copy all day, care about tone and accuracy, and have been burned by find-and-replace before.

Secondary viewer: the hackathon jury (Builder.io founders and DevRel), who will see the product only through a 2:30 screen recording. The key screen must read at a glance in a video.

## Purpose

After a rename, the old name lives on next to uses that must not change: historical posts, dated changelogs, URLs, code identifiers, quoted UI labels, the common word ("publish your page"). The agent decides each mention with a one-line reason and drafts a rewrite; the person accepts, rejects or edits, alone or in bulk; nothing ships without their approval.

## Key screen

The findings queue. Each row is one sentence on one page: the sentence with the old name highlighted, the proposed sentence below it, the decision as a word (Change, Keep, Needs you), the reason in one line, and the page title and publish date. A bulk bar acts on the selection ("Accept 12", "Keep 3", "Ask the agent about these"). The agent chat sits beside the queue and reads the selection.

Real data for the demo: Builder.io renamed Fusion to Builder Code and Publish to Builder Content on 2026-09-10. Their public blog has 537 posts with article text; 996 findings across 132 pages. Seeded data carries a visible "Demo data" label.

## Voice

Plain, exact, calm. Sentence case. Numbers always with unit and denominator ("41 of 63 findings reviewed"). No hype words, no exclamation marks.

## Mode

operate. A daily tool: dense, quiet, scannable. Not a landing page.

## Constraints

- Public repo: fonts with OFL license only. No Inter, Roboto or system fonts.
- Icons: Phosphor Light only. No emojis anywhere.
- Built on the Agent-Native framework (React Router, Tailwind, shadcn primitives); the AgentSidebar and app chrome stay.
- Light and dark must both work if both are shipped.
