import {
  ArrowDown,
  ArrowUp,
  CalendarBlank,
  Check,
  CircleNotch,
  FileText,
  LockSimple,
  PencilSimpleLine,
  Swap,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";

import { DecisionChip, formatDate, markClass, MarkedText, parseMentions, ProposalText, type Decision } from "./shared";

export interface Finding {
  id: string;
  pageId: string;
  pageTitle: string;
  pageUrl: string;
  pagePublishedAt: string | null;
  pageReadOnly: boolean;
  oldName: string;
  newName: string;
  sentence: string;
  mentions: unknown;
  decision: Decision | null;
  reason: string | null;
  proposal: string | null;
  status: string;
}

export type BusyAction = "accept" | "keep" | "edit" | null;

type Props = {
  finding: Finding;
  position: string;
  isEditing: boolean;
  busy: BusyAction;
  pressedKey: string | null;
  onAccept: () => void;
  onKeep: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: (proposal: string) => void;
  shouldFocus: boolean;
  onFocused: () => void;
};

// Why Accept is unavailable, in the words a reviewer needs.
function acceptBlocker(finding: Finding): string | null {
  if (finding.pageReadOnly) return "This page is read-only, nothing on it can change.";
  if (finding.decision === null) return "The agent has not decided this one yet.";
  if (finding.decision === "keep") return "The agent says keep. Edit the rewrite to change it anyway.";
  if (finding.decision === "unsure") return "Needs you: write the rewrite with Edit, or keep it.";
  if (!finding.proposal) return "There is no rewrite yet. Write one with Edit.";
  return null;
}

function EditBox({
  finding,
  isSaving,
  onCancel,
  onSave,
}: {
  finding: Finding;
  isSaving: boolean;
  onCancel: () => void;
  onSave: (proposal: string) => void;
}) {
  const [text, setText] = useState(finding.proposal ?? finding.sentence);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  const changed = text.trim().length > 0 && text.trim() !== finding.sentence;
  return (
    <form
      className="ab-edit"
      onSubmit={(event) => {
        event.preventDefault();
        if (changed && !isSaving) onSave(text.trim());
      }}
    >
      <label className="ab-lbl" htmlFor="ab-edit-text">
        Your rewrite. It must use {finding.newName} and change only text near {finding.oldName}.
      </label>
      <textarea
        id="ab-edit-text"
        ref={ref}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") onCancel();
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && changed) onSave(text.trim());
        }}
      />
      <div className="ab-edit-row">
        <button type="submit" className="ab-btn ab-btn-primary" aria-disabled={!changed || isSaving}>
          {isSaving ? <CircleNotch size={16} weight="light" className="ab-spin" /> : <Check size={16} weight="light" />}
          Save rewrite
        </button>
        <button type="button" className="ab-btn" onClick={onCancel}>
          Cancel <kbd>Esc</kbd>
        </button>
      </div>
    </form>
  );
}

export function FocusCard({
  finding,
  position,
  isEditing,
  busy,
  pressedKey,
  onAccept,
  onKeep,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  shouldFocus,
  onFocused,
}: Props) {
  const cardRef = useRef<HTMLElement>(null);
  // After an action the card remounts; move focus to it so the keyboard
  // and screen readers follow the queue instead of falling back to the body.
  useEffect(() => {
    if (!shouldFocus) return;
    cardRef.current?.focus();
    onFocused();
  }, [shouldFocus, onFocused]);
  const mentions = parseMentions(finding.mentions);
  const blocker = acceptBlocker(finding);
  const pressed = (key: string) => (pressedKey === key ? " ab-pressed" : "");

  return (
    <article
      ref={cardRef}
      tabIndex={-1}
      className="ab-panel ab-focus ab-rise"
      style={{ ["--b" as string]: 1 }}
      aria-label="Finding in focus"
    >
      <div className="ab-meta">
        <Link to={`/pages/${finding.pageId}`}>
          <FileText size={16} weight="light" />
          {finding.pageTitle}
        </Link>
        <span>
          <CalendarBlank size={16} weight="light" />
          Published {formatDate(finding.pagePublishedAt)}
        </span>
        <span>
          <Swap size={16} weight="light" />
          {finding.oldName} to {finding.newName}
        </span>
        <span className="ab-pos">{position}</span>
      </div>
      <p className="ab-sentence">
        <MarkedText
          text={finding.sentence}
          mentions={mentions}
          className={markClass(finding.decision)}
        />
      </p>
      {isEditing ? (
        <div className="ab-proposal">
          <span className="ab-lbl">Proposed</span>
          <EditBox finding={finding} isSaving={busy === "edit"} onCancel={onCancelEdit} onSave={onSaveEdit} />
        </div>
      ) : finding.decision === null ? null : (
        // Nothing is proposed for a sentence the agent has not read yet.
        <div className="ab-proposal">
          <span className="ab-lbl">Proposed</span>
          {finding.proposal ? (
            <p>
              <ProposalText text={finding.proposal} newName={finding.newName} />
            </p>
          ) : (
            <p className="ab-noproposal">
              {finding.decision === "keep"
                ? "No rewrite. The sentence stays as it is."
                : "No rewrite yet. Write one with Edit, or keep it."}
            </p>
          )}
        </div>
      )}
      <div className="ab-why">
        <DecisionChip decision={finding.decision} />
        <p>{finding.reason ?? "Waiting for the agent to read this sentence."}</p>
      </div>
      <div className="ab-actions">
        <button
          type="button"
          className={`ab-btn ab-btn-primary${pressed("a")}`}
          aria-disabled={blocker !== null || busy !== null}
          title={blocker ?? undefined}
          onClick={() => blocker === null && busy === null && onAccept()}
        >
          {busy === "accept" ? <CircleNotch size={16} weight="light" className="ab-spin" /> : <Check size={16} weight="light" />}
          Accept <kbd>A</kbd>
        </button>
        <button
          type="button"
          className={`ab-btn${pressed("k")}`}
          aria-disabled={busy !== null}
          onClick={() => busy === null && onKeep()}
        >
          {busy === "keep" ? <CircleNotch size={16} weight="light" className="ab-spin" /> : <LockSimple size={16} weight="light" />}
          Keep <kbd>K</kbd>
        </button>
        <button
          type="button"
          className={`ab-btn${pressed("e")}`}
          aria-disabled={finding.pageReadOnly || busy !== null}
          onClick={() => !finding.pageReadOnly && busy === null && onStartEdit()}
        >
          <PencilSimpleLine size={16} weight="light" />
          Edit <kbd>E</kbd>
        </button>
        <div className="ab-hint">
          <span>
            <kbd aria-label="Up">
              <ArrowUp size={12} weight="light" />
            </kbd>
            <kbd aria-label="Down">
              <ArrowDown size={12} weight="light" />
            </kbd>
            Move
          </span>
          <span>
            <kbd>X</kbd>Select
          </span>
        </div>
      </div>
      {blocker ? <p className="ab-blocked">{blocker}</p> : null}
    </article>
  );
}
