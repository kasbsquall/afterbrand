---
name: Afterbrand
description: Rename review queue where the whole library reads as a core sample and one finding is decided at a time.
colors:
  ground: "oklch(22% .035 200)"
  rail: "oklch(19% .034 200)"
  layer: "oklch(27% .038 200)"
  layer-2: "oklch(31% .04 200)"
  well: "oklch(20% .03 200)"
  ink: "oklch(94% .012 200)"
  ink-soft: "oklch(72% .02 200)"
  ink-faint: "oklch(58% .022 200)"
  line: "oklch(94% .012 200 / .09)"
  line-strong: "oklch(94% .012 200 / .16)"
  change: "oklch(78% .13 75)"
  change-hover: "oklch(82% .13 78)"
  change-ink: "oklch(24% .05 75)"
  keep: "oklch(70% .07 180)"
  keep-text: "oklch(80% .07 180)"
  needs: "oklch(72% .15 25)"
  needs-text: "oklch(80% .11 28)"
  undecided: "oklch(42% .02 200)"
  undecided-2: "oklch(37% .02 200)"
  focus: "oklch(86% .1 85)"
typography:
  display:
    fontFamily: "Hanken Grotesk Variable, Hanken Grotesk"
    fontSize: "76px"
    fontWeight: 600
    lineHeight: 0.84
    letterSpacing: "-0.03em"
    fontFeature: "tnum, lnum"
  reading:
    fontFamily: "Hanken Grotesk Variable, Hanken Grotesk"
    fontSize: "28px"
    fontWeight: 500
    lineHeight: 1.32
    letterSpacing: "-0.016em"
  headline:
    fontFamily: "Hanken Grotesk Variable, Hanken Grotesk"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.018em"
  proposal:
    fontFamily: "Hanken Grotesk Variable, Hanken Grotesk"
    fontSize: "19px"
    fontWeight: 400
    lineHeight: 1.4
  title:
    fontFamily: "Hanken Grotesk Variable, Hanken Grotesk"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Hanken Grotesk Variable, Hanken Grotesk"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
    fontFeature: "tnum, lnum"
  control:
    fontFamily: "Hanken Grotesk Variable, Hanken Grotesk"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.3
  label:
    fontFamily: "Hanken Grotesk Variable, Hanken Grotesk"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.35
  key:
    fontFamily: "Hanken Grotesk Variable, Hanken Grotesk"
    fontSize: "11.5px"
    fontWeight: 600
    lineHeight: 1
rounded:
  key: "4px"
  control: "8px"
  well: "10px"
  panel: "12px"
spacing:
  "1": "4px"
  "1.5": "6px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "7": "28px"
components:
  button-primary:
    backgroundColor: "{colors.change}"
    textColor: "{colors.change-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "38px"
  button-primary-hover:
    backgroundColor: "{colors.change-hover}"
  button-secondary:
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "38px"
  button-bulk:
    rounded: "{rounded.control}"
    padding: "0 11px"
    height: "32px"
  rule-chip:
    textColor: "{colors.ink-soft}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 10px"
    height: "28px"
  filter-tabs:
    backgroundColor: "{colors.well}"
    rounded: "{rounded.well}"
    padding: "3px"
  filter-tab-selected:
    backgroundColor: "{colors.layer-2}"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    height: "28px"
  decision-chip:
    typography: "{typography.control}"
    rounded: "{rounded.key}"
    padding: "0 10px"
    height: "26px"
  focus-card:
    backgroundColor: "{colors.layer}"
    rounded: "{rounded.panel}"
    padding: "22px 28px"
  list-row:
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    padding: "0 16px"
    height: "50px"
  bulk-bar:
    backgroundColor: "{colors.layer-2}"
    padding: "10px 12px 10px 16px"
  core-sample:
    backgroundColor: "{colors.layer}"
    rounded: "{rounded.panel}"
    padding: "20px 20px 16px"
  agent-panel:
    backgroundColor: "{colors.layer}"
    rounded: "{rounded.panel}"
  top-bar:
    backgroundColor: "{colors.rail}"
    height: "56px"
    padding: "0 20px"
---

# Design System: Afterbrand

## Overview

**Creative North Star: "The Core Sample"**

Afterbrand reads a content library the way a geologist reads drill cores laid out in a tray: one column per page, one layer per finding, each layer coloured by the decision made about it. The whole remaining job is visible as a shape, and next to it one sentence at a time is read and decided at reading scale. The system exists so a content lead can tell at a glance how much of a rename is left and trust each decision on its own.

The shell is flooded with a deep mineral teal. Every raised surface is the same hue a few steps lighter, and depth comes from those tinted layers and a shadow cast in the ground colour itself. Colour is reserved for state: four minerals mark the four decisions, and nothing decorative competes with them. Type is one family, Hanken Grotesk, at two scales that matter: the focused sentence at 28 px and the remaining count at 76 px. Everything else stays small, quiet and tabular.

The mode is dark only, chosen for long review sessions in low light. A light theme has not been built and is not defined here.

**Key Characteristics:**
- One hue (200) for ground, layers, ink and lines; four mineral state colours on top.
- One sentence in focus at 28 px, the rest of the queue as 50 px rows.
- A generated core-sample strip computed from real findings, never an illustration.
- Every number tabular and carrying its unit or denominator.
- Keyboard first: A, K, E, arrows and X are always labelled with visible keys.

## Colors

A flooded mineral-teal ground with tinted layers, and four mineral state colours that carry all meaning.

### Primary
- **Amber Ore** (change): the Change decision, the primary action (Accept, send), the progress fill, checked checkboxes, the active nav underline, the caret and the text selection tint. Amber means "this will be rewritten" or "do it".
- **Amber Ore Bright** (change-hover): hover of the primary button only.
- **Amber Ink** (change-ink): text and keys sitting on amber.

### Secondary
- **Mineral Green** (keep, keep-text): the Keep decision. The fill is used for dots and strata; the lighter keep-text is used for chip text on its 16% tint. Also the live-status icon in the agent header.

### Tertiary
- **Coral** (needs, needs-text): the Needs you decision, the hard cases a person must decide. Fill for dots and strata, needs-text for chip text on its 16% tint.

### Neutral
- **Deep Teal Ground** (ground): page background, floods the whole shell.
- **Rail** (rail): top bar, a step darker than the ground.
- **Layer** (layer): every panel (focus card, list, core sample, agent).
- **Raised Layer** (layer-2): selected filter tab and the bulk bar.
- **Well** (well): inset surfaces: filter tab track, search and sort fields, agent context note, composer, strip background.
- **Ink, Soft Ink, Faint Ink** (ink, ink-soft, ink-faint): primary text, secondary text, labels and counts.
- **Line, Strong Line** (line at 9%, line-strong at 16%): dividers and control borders, both drawn from ink with alpha.
- **Undecided Grey** (undecided, undecided-2): undecided findings in the strip, dots and the empty part of the progress bar; undecided-2 for unswept columns.
- **Focus Gold** (focus): focus-visible outline and focused field border.

### Tints
State tints are the state colour at fixed alpha over a layer: 15 to 16% for decision chips, 16% for the old-name mark, 10% for the proposed-name ins, 6% for selected rows, 35% for text selection. Hover washes are ink at 3% (rows), 5% (tabs, chips), 7 to 8% (buttons, icon buttons).

### Named Rules
**The Mineral Ledger Rule.** Green, coral and grey mean Keep, Needs you and undecided, and nothing else. Amber means Change and doubles as the action colour (Accept, send, checked, current nav), because accepting is choosing Change. A new surface never borrows a state colour for decoration.

**The One Hue Rule.** Ground, layers, ink, lines and shadows all sit on hue 200. No pure black, no pure white, no neutral grey from another family.

## Typography

**Display Font:** Hanken Grotesk (OFL), loaded as `@fontsource-variable/hanken-grotesk`
**Body Font:** Hanken Grotesk
**Label/Mono Font:** none; keys and numbers use the same family with tabular figures.

**Character:** a calm humanist grotesk at reading weights (400 to 600). Hierarchy comes from scale and weight, never from a second family.

### Hierarchy
- **Display** (600, 76 px, line-height 0.84, -0.03em): the remaining count beside its 12 to 13 px label. 64 px under 640 px.
- **Reading** (500, 28 px, 1.32, -0.016em, max 40ch, `text-wrap: pretty`): the focused finding's sentence. 22 px under 640 px.
- **Headline** (600, 20 px, -0.018em): screen title.
- **Proposal** (400, 19 px, 1.4, max 46ch): the proposed sentence under the focused one, in soft ink with the new name in ink at 600. 17 px under 640 px.
- **Title** (600, 15 px, -0.01em): product name and panel titles.
- **Body** (400, 14 px, 1.45): rows, buttons, agent text (13.5 px, 1.5, max 60ch).
- **Control** (500, 13 px): tabs, meta line, decision chips, bulk buttons.
- **Label** (500, 12 to 12.5 px): column heads, captions, rule chips, legend, counts.
- **Key** (600, 11.5 px): keyboard keys and the Demo data label.

### Named Rules
**The Denominator Rule.** Every number is set with `font-variant-numeric: tabular-nums lining-nums` and travels with its unit or its total: "541 of 996 findings decided", "455 left of 996 findings", "132 of 537 pages", "Accept 3". A bare number is a defect.

**The Reading Scale Rule.** Only the focused sentence is set at 28 px. The old name is marked in amber with a strike-through; the new name is underlined from below in amber. Lists stay at 14 px.

## Layout

Two columns on desktop: the queue at 62% and the side column at 38% (`grid-template-columns: minmax(0,62fr) minmax(0,38fr)`), with 16 px gutters and 16/20/20 px page padding under a 56 px top bar. The side column holds the core sample above the agent panel, which grows to fill the height. Panels stack with 12 px gaps.

Spacing steps observed and reused: 4, 6, 8, 12, 16, 20, 28 px, with 22 and 26 px used only inside the focus card to separate meta, sentence and the decision line. Rows are 50 px tall with a 28 / 104 / flexible / 200 px grid (28 / 96 / flexible / 150 px under 1180 px).

Breakpoints: under 1180 px the second rule chip hides; under 1024 px the layout becomes one column, nav and progress bar hide and a menu button appears; under 640 px rows reflow to a checkbox column plus stacked decision, sentence and page, the column header and key hints hide, and the focus card pads to 18/16 px.

## Elevation & Depth

Depth is tonal first: rail below ground, ground below layer, layer below raised layer, wells sunk below their parent. Panels add one shadow cast in the ground hue, never black.

### Shadow Vocabulary
- **Panel** (`box-shadow: 0 1px 0 oklch(94% .012 200 / .04) inset, 0 18px 40px -24px oklch(12% .04 200 / .9)`): every panel, a top highlight plus a soft teal drop.
- **Key** (`box-shadow: 0 -1px 0 oklch(12% .03 200 / .5) inset`): keyboard keys.

### Named Rules
**The Tinted Depth Rule.** A shadow is always a darker step of hue 200. If a surface needs more lift, move it one layer up in tone before adding shadow.

## Shapes

Panels round at 12 px, controls at 8 px, small tags and keys at 4 px. Inset tracks nest concentrically: the tab track and composer at 10 px hold children at 7 px. The strip well rounds at 6 px and strata at 1 px. Checkboxes are 16 px squares at 4 px with a 1.5 px faint border. Dots are 7 px circles. Borders are 1 px lines from ink alpha; no coloured side borders.

## Components

### Top bar
56 px rail with a 1 px bottom line. Left: the strata mark (three bars in the state colours) and "Afterbrand" in Title. Nav links in soft ink at 500 with a Phosphor Light icon; the current one turns ink and gets a 2 px amber underline. Right: rule chips, progress ("541 of 996 findings decided" with a 96 x 4 px bar filled by `scaleX`), the Demo data label, and a menu button under 1024 px.

### Rule chips
28 px, 8 px radius, strong-line border, no fill. Swap icon, old name in soft ink, arrow, new name in ink at 500. The effective date sits in the title attribute. Read-only.

### Filter tabs with counts
A well track (3 px padding, 10 px radius) of 28 px tabs at 7 px radius. Each tab: state dot, word, count in faint ink. Selected: raised layer with ink text and soft-ink count. Hover: ink text on a 5% wash. Order: All, Needs you, Change, Keep, Undecided. Counts must sum to All.

### Focused finding
Layer panel, 22/28 px padding, panel shadow. Meta line (page link with file icon, publish date, rule, position count pushed right), the sentence at Reading scale, the "Proposed" label beside the proposal, a divider, the decision chip with its one-line reason, then the actions: Accept (primary, key A), Keep (key K), Edit (key E), with Move and Select key hints on the right.

### Decision chip
26 px (24 px in rows), 4 px radius, Control type at 600, Phosphor Light icon plus the word. Never a colour without the word.
- **Change:** amber at 15% tint, amber text, check icon.
- **Keep:** green at 16% tint, keep-text, lock-simple icon.
- **Needs you:** coral at 16% tint, needs-text, hand icon.
- **Undecided:** undecided grey dot with a 1 px inset ring and soft-ink text on the undecided tint. The prototype shows this state only as a dot in tabs and legend; the chip form follows the same recipe.

### Bulk bar
Raised layer strip at the top of the list, 1 px bottom line. Tri-state select-all checkbox with "3 of 5 selected", then 32 px buttons whose counts follow the selection ("Accept 3" primary, "Keep 3", "Ask the agent about these"), and Clear pushed right. Under 640 px the ask button hides.

### List row
50 px grid row with a 1 px divider: checkbox, decision chip, sentence (single line, ellipsis, old name marked without strike), page title over its date in faint ink. Hover: 3% ink wash. Selected: 6% amber wash. Every row is selectable and opens the finding.

### Core-sample strip
Layer panel. Top: the remaining count at Display scale with "left of 996 findings", and a two-column legend with dot, word and count. Below: caption "Library, one column per page" with "132 of 537 pages", the generated SVG in a well, and a foot caption. Each column is 4 px wide with 1 px gap; each finding is a 3 px layer, alternating two shades of its state colour. Undecided columns show the grey base with hairline layer marks. A dashed hairline separates swept from unswept pages. The active page carries an ink ring and a small ink pointer above it, plus an annotation. Columns are focusable and carry a title with their counts.

### Agent panel
Layer panel that fills the side column. Header: "Agent", a status with a live icon ("Sweep paused at 541 of 996"), and a settings icon button. Body: a well note describing what the agent is reading (the selection, or the whole queue when nothing is selected), messages in Body at max 60ch, and suggestion chips (30 px, 8 px radius, strong-line border). Composer: a well at 10 px radius with a 30 px amber send button. The framework AgentSidebar stays; this panel is how the queue presents it.

### Buttons
- **Shape:** 8 px radius, 38 px tall (32 px in the bulk bar), 14 px horizontal padding, icon plus label plus optional key.
- **Primary:** amber fill, amber-ink text, transparent border.
- **Secondary:** 3% ink wash, strong-line border, ink text.
- **Default / Hover:** hover lifts the wash to 8% (primary goes to Amber Ore Bright).
- **Focus visible:** 2 px focus-gold outline, 2 px offset.
- **Active:** `scale(.97)` over 120 ms; the same press plays when the shortcut key fires.
- **Disabled:** not present in the prototype. Keep the shape, drop to faint ink and the line border, no press, `aria-disabled`.
- **Loading:** not present in the prototype. Keep width and label, swap the icon for Phosphor Light circle-notch, block repeat presses.

### Inputs
32 px well fields with 1 px line border, faint icon and placeholder, ink text; focus-within turns the border focus gold. Composer follows the same rule.

### Demo data label
22 px, 4 px radius, flask icon, Key type. Present on every surface showing seeded content, in the top bar at minimum.

## Do's and Don'ts

### Do:
- **Do** load Hanken Grotesk from `@fontsource-variable/hanken-grotesk` (OFL) and use it for every role.
- **Do** use Phosphor Light icons only, at 16 px (13 px inside chips, 12 px inside keys), one weight across the product.
- **Do** set `tabular-nums lining-nums` on every number and give each one its unit or denominator.
- **Do** keep motion under 300 ms and on `transform`, `opacity` or `stroke-dashoffset`: block entrance `rise` 260 ms (opacity plus `translateY(6px)`, 60 ms between blocks), row entrance 240 ms (30 ms per row, capped at 8), progress `scaleX` 280 ms, strata sweep 220 ms (3.6 ms per column), settle 180 ms on a manual decision, press 120 ms. Entrance easing `cubic-bezier(.23,1,.32,1)`; settle `cubic-bezier(.34,1.56,.64,1)`.
- **Do** put all of it inside `@media (prefers-reduced-motion: no-preference)` so the default state is the final state.
- **Do** keep slow ambient loops (the 3.2 s breathe on the live agent icon) on icons and strata only, never on text.
- **Do** play micro-sounds on key events (accept, keep, bulk apply, sweep finished) and show a mute toggle in the top bar.
- **Do** show the Demo data label wherever seeded content appears.
- **Do** expose tokens as CSS custom properties and map them for Tailwind v4, for example `--ab-ground: oklch(22% .035 200)` on `:root` and `@theme inline { --color-ab-ground: var(--ab-ground); --radius-panel: 12px; --font-sans: "Hanken Grotesk Variable", sans-serif; }`, so utilities like `bg-ab-layer` and `rounded-panel` resolve to the system.

### Don't:
- **Don't** use Inter, Roboto, Arial, Helvetica or system fonts, or any font without an OFL licence.
- **Don't** use emojis anywhere, in UI, copy, data, commits or captures.
- **Don't** use pure black or pure white; ink and shadows stay on hue 200.
- **Don't** use a state colour without its word, or for anything other than its decision.
- **Don't** cast shadows in neutral black; use the panel shadow.
- **Don't** animate width, height, top, left, margin, padding or colour, and don't exceed 300 ms outside the ambient loop.
- **Don't** show a bare number, or a default 0 while data loads; use a skeleton.
- **Don't** remove the AgentSidebar or replace framework chrome; restyle it through the tokens.
