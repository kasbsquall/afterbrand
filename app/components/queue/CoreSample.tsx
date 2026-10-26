import { ArrowDown, Stack } from "@phosphor-icons/react";

import type { KeyboardEvent } from "react";

import { plural } from "./shared";

export interface StripPage {
  id: string;
  title: string;
  total: number;
  counts: { change: number; keep: number; unsure: number; undecided: number };
}

type Props = {
  pages: StripPage[];
  pagesInLibrary: number;
  findings: { all: number; change: number; keep: number; unsure: number; undecided: number };
  leftToReview: number;
  activePageId: string | null;
  onSelectPage: (pageId: string) => void;
};

const COL_W = 4;
const GAP = 1;
const LAYER = 5;
const TOP = 6;
const MAX_LAYERS = 60;

// Two shades per decision so adjacent layers read as separate findings.
const SHADES = {
  change: ["oklch(78% .13 75)", "oklch(72% .12 70)"],
  keep: ["oklch(70% .07 180)", "oklch(64% .065 182)"],
  unsure: ["oklch(72% .15 25)", "oklch(66% .14 25)"],
} as const;

function columnLabel(page: StripPage): string {
  const { change, keep, unsure, undecided } = page.counts;
  return `${page.title}: ${plural(page.total, "finding")}, ${change} Change, ${keep} Keep, ${unsure} Needs you, ${undecided} undecided`;
}

function Column({
  page,
  index,
  isActive,
  isTabStop,
  onSelect,
}: {
  page: StripPage;
  index: number;
  isActive: boolean;
  isTabStop: boolean;
  onSelect: () => void;
}) {
  const x = index * COL_W + GAP / 2;
  const w = COL_W - GAP;
  const layers = Math.min(page.total, MAX_LAYERS);
  const height = layers * LAYER;
  const strata: { fill: string; y: number }[] = [];
  let y = TOP;
  let k = 0;
  for (const key of ["change", "keep", "unsure"] as const) {
    for (let j = 0; j < page.counts[key] && strata.length < layers; j++) {
      strata.push({ fill: SHADES[key][k++ % 2], y });
      y += LAYER;
    }
  }
  return (
    <g
      className="ab-col"
      tabIndex={isTabStop ? 0 : -1}
      role="button"
      aria-label={columnLabel(page)}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
    >
      <title>{columnLabel(page)}</title>
      <rect className="ab-base" x={x} y={TOP} width={w} height={height} rx={1} fill="oklch(42% .02 200)" />
      <g className="ab-strata" style={{ ["--c" as string]: index }}>
        {strata.map((s) => (
          <rect key={s.y} x={x} y={s.y} width={w} height={LAYER - 0.5} fill={s.fill} />
        ))}
      </g>
      {Array.from({ length: Math.max(0, layers - strata.length - 1) }, (_, j) => (
        <rect
          key={`u${j}`}
          x={x}
          y={y + (j + 1) * LAYER - 0.5}
          width={w}
          height={0.5}
          fill="oklch(30% .02 200)"
        />
      ))}
      {isActive ? (
        <>
          <rect
            className="ab-ring"
            x={x - 1.2}
            y={TOP - 1.5}
            width={w + 2.4}
            height={height + 3}
            rx={1.6}
            fill="none"
            stroke="oklch(94% .012 200)"
            strokeWidth={0.7}
          />
          <path d={`M${x + w / 2 - 2.2} 0 L${x + w / 2 + 2.2} 0 L${x + w / 2} 3.4 Z`} fill="oklch(94% .012 200)" />
        </>
      ) : null}
    </g>
  );
}

// Roving focus: one column is in the tab order, arrows move between columns.
function moveColumnFocus(event: KeyboardEvent<SVGSVGElement>) {
  const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
  const isEdge = event.key === "Home" || event.key === "End";
  if (step === undefined && !isEdge) return;
  const columns = [...event.currentTarget.querySelectorAll<SVGGElement>(".ab-col")];
  const current = columns.indexOf(event.target as SVGGElement);
  if (current === -1) return;
  event.preventDefault();
  const next = isEdge
    ? event.key === "Home"
      ? 0
      : columns.length - 1
    : Math.max(0, Math.min(columns.length - 1, current + (step ?? 0)));
  columns[current].tabIndex = -1;
  columns[next].tabIndex = 0;
  columns[next].focus();
}

export function CoreSample({ pages, pagesInLibrary, findings, leftToReview, activePageId, onSelectPage }: Props) {
  const tallest = Math.min(MAX_LAYERS, Math.max(1, ...pages.map((p) => p.total)));
  const width = Math.max(1, pages.length) * COL_W;
  const height = TOP + tallest * LAYER + 6;
  const active = pages.find((p) => p.id === activePageId) ?? null;
  const cut = pages.some((p) => p.total > MAX_LAYERS);
  const tabStopId = active?.id ?? pages[0]?.id;

  return (
    <section className="ab-panel ab-core ab-rise" style={{ ["--b" as string]: 1 }} aria-labelledby="ab-core-h">
      <h2 className="ab-sr" id="ab-core-h">
        Library core sample
      </h2>
      <div className="ab-core-top">
        <div className="ab-big">{leftToReview}</div>
        <div className="ab-big-lbl">
          <b>left for you to review</b>of {plural(findings.all, "finding")}
        </div>
        <div className="ab-legend" aria-label="The agent's decisions on the findings left to review">
          <span>
            <span className="ab-dot ab-d-change" />
            Change<b>{findings.change}</b>
          </span>
          <span>
            <span className="ab-dot ab-d-keep" />
            Keep<b>{findings.keep}</b>
          </span>
          <span>
            <span className="ab-dot ab-d-unsure" />
            Needs you<b>{findings.unsure}</b>
          </span>
          <span>
            <span className="ab-dot ab-d-undecided" />
            Undecided<b>{findings.undecided}</b>
          </span>
        </div>
      </div>
      <div className="ab-strip-cap">
        <span className="ab-act">
          <Stack size={16} weight="light" />
          <span>{active ? active.title : "Library, one column per page"}</span>
        </span>
        <span>
          {pages.length} of {pagesInLibrary} pages
        </span>
      </div>
      <svg
        className="ab-strip"
        viewBox={`0 0 ${width} ${height}`}
        role="group"
        aria-label="One column per page with findings, one layer per finding, coloured by the agent's decision. Arrow keys move between pages, Enter shows a page's findings"
        onKeyDown={moveColumnFocus}
      >
        {pages.map((page, i) => (
          <Column
            key={page.id}
            page={page}
            index={i}
            isActive={page.id === activePageId}
            isTabStop={page.id === tabStopId}
            onSelect={() => onSelectPage(page.id)}
          />
        ))}
      </svg>
      <div className="ab-strip-foot">
        <span>
          <ArrowDown size={14} weight="light" />
          Each column is a page, each layer a finding{cut ? `, tall pages cut at ${MAX_LAYERS}` : ""}
        </span>
        <span>
          {active
            ? `${plural(active.total, "finding")} on this page, ${active.counts.undecided} undecided`
            : "Pages in queue order"}
        </span>
      </div>
    </section>
  );
}
