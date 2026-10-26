import { ChatCircleText, Check, CircleNotch, LockSimple, X } from "@phosphor-icons/react";
import { useEffect, useRef } from "react";

import type { BusyAction, Finding } from "./FocusCard";
import { DecisionChip, formatDate, markClass, MarkedText, parseMentions } from "./shared";

type Props = {
  findings: Finding[];
  total: number;
  selected: ReadonlySet<string>;
  focusedId: string | null;
  busy: BusyAction;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onFocus: (id: string) => void;
  onAccept: (ids: string[]) => void;
  onKeep: (ids: string[]) => void;
  onAsk: () => void;
  onClear: () => void;
  canLoadMore: boolean;
  onLoadMore: () => void;
  isLoadingMore: boolean;
};

export function canAccept(finding: Finding): boolean {
  return finding.decision === "change" && Boolean(finding.proposal) && !finding.pageReadOnly;
}

const ROW_STAGGER_CAP = 7;
const SNIPPET_CHARS = 60;

// Checkbox labels need the sentence: many rows share a page title.
function snippet(sentence: string): string {
  return sentence.length > SNIPPET_CHARS ? `${sentence.slice(0, SNIPPET_CHARS).trimEnd()}...` : sentence;
}

export function FindingList({
  findings,
  total,
  selected,
  focusedId,
  busy,
  onToggle,
  onToggleAll,
  onFocus,
  onAccept,
  onKeep,
  onAsk,
  onClear,
  canLoadMore,
  onLoadMore,
  isLoadingMore,
}: Props) {
  const allRef = useRef<HTMLInputElement>(null);
  const picked = findings.filter((f) => selected.has(f.id));
  const acceptable = picked.filter(canAccept).map((f) => f.id);
  const allPicked = findings.length > 0 && picked.length === findings.length;
  const somePicked = picked.length > 0 && !allPicked;

  useEffect(() => {
    if (allRef.current) allRef.current.indeterminate = somePicked;
  }, [somePicked]);

  const skipped = picked.length - acceptable.length;
  const acceptTitle =
    picked.length > 0 && acceptable.length === 0
      ? "None of the selected findings is marked Change with a valid rewrite"
      : skipped > 0
        ? `${skipped} of the ${picked.length} selected are not marked Change and will be left out`
        : undefined;

  return (
    <div className="ab-panel ab-list ab-rise" style={{ ["--b" as string]: 2 }}>
      <div className="ab-bulk" role="toolbar" aria-label="Bulk actions">
        <span className="ab-sel">
          <input
            ref={allRef}
            type="checkbox"
            className="ab-cb"
            id="ab-all"
            checked={allPicked}
            onChange={onToggleAll}
            aria-label="Select all shown"
          />
          <label htmlFor="ab-all">
            {picked.length} of {findings.length} selected
          </label>
        </span>
        <button
          type="button"
          className="ab-btn ab-btn-primary ab-btn-sm"
          aria-disabled={acceptable.length === 0 || busy !== null}
          title={acceptTitle}
          onClick={() => acceptable.length > 0 && busy === null && onAccept(acceptable)}
        >
          {busy === "accept" ? <CircleNotch size={16} weight="light" className="ab-spin" /> : <Check size={16} weight="light" />}
          {acceptable.length > 0 ? `Accept ${acceptable.length}` : "Accept"}
        </button>
        <button
          type="button"
          className="ab-btn ab-btn-sm"
          aria-disabled={picked.length === 0 || busy !== null}
          onClick={() => picked.length > 0 && busy === null && onKeep(picked.map((f) => f.id))}
        >
          {busy === "keep" ? <CircleNotch size={16} weight="light" className="ab-spin" /> : <LockSimple size={16} weight="light" />}
          {picked.length > 0 ? `Keep ${picked.length}` : "Keep"}
        </button>
        <button
          type="button"
          className="ab-btn ab-btn-sm ab-ask-btn"
          aria-disabled={picked.length === 0}
          onClick={() => picked.length > 0 && onAsk()}
        >
          <ChatCircleText size={16} weight="light" />
          Ask the agent about these
        </button>
        {picked.length > 0 ? (
          <button type="button" className="ab-clear" onClick={onClear}>
            <X size={16} weight="light" />
            Clear
          </button>
        ) : null}
      </div>
      <div className="ab-lhead" aria-hidden="true">
        <span />
        <span>Decision</span>
        <span>Sentence</span>
        <span>Page</span>
      </div>
      <div role="list" aria-label="Findings">
        {findings.map((finding, i) => {
          const isSelected = selected.has(finding.id);
          return (
            <div
              key={finding.id}
              role="listitem"
              className="ab-row"
              data-selected={isSelected}
              data-focused={finding.id === focusedId}
              aria-current={finding.id === focusedId ? "true" : undefined}
              style={{ ["--i" as string]: Math.min(i, ROW_STAGGER_CAP) }}
              onClick={() => onFocus(finding.id)}
            >
              <input
                type="checkbox"
                className="ab-cb"
                checked={isSelected}
                onClick={(event) => event.stopPropagation()}
                onChange={() => onToggle(finding.id)}
                aria-label={`Select "${snippet(finding.sentence)}" on ${finding.pageTitle}`}
              />
              <DecisionChip decision={finding.decision} />
              <button
                type="button"
                className="ab-s"
                onClick={(event) => {
                  event.stopPropagation();
                  onFocus(finding.id);
                }}
              >
                <MarkedText
                  text={finding.sentence}
                  mentions={parseMentions(finding.mentions)}
                  className={markClass(finding.decision)}
                />
              </button>
              <span className="ab-pg">
                {finding.pageTitle}
                <small>{formatDate(finding.pagePublishedAt)}</small>
              </span>
            </div>
          );
        })}
      </div>
      <div className="ab-more">
        <span>
          Showing {findings.length} of {total} findings
        </span>
        {findings.length < total && canLoadMore ? (
          <button type="button" className="ab-btn ab-btn-sm" aria-disabled={isLoadingMore} onClick={onLoadMore}>
            {isLoadingMore ? <CircleNotch size={16} weight="light" className="ab-spin" /> : null}
            Show 50 more
          </button>
        ) : findings.length < total ? (
          <span>Act on these to bring in the next ones.</span>
        ) : null}
      </div>
    </div>
  );
}
