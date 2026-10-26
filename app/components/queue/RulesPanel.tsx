import { ArrowRight, ArrowSquareOut, CalendarBlank, CircleNotch, ClockCounterClockwise, PencilSimpleLine } from "@phosphor-icons/react";
import { sendToAgentChat } from "@agent-native/core/client/agent-chat";
import { useActionMutation, useActionQuery } from "@agent-native/core/client/hooks";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { errorMessage, formatDate, plural } from "./shared";

interface Rule {
  id: string;
  oldName: string;
  newName: string;
  effectiveDate: string | null;
  exceptions: string;
  sourceUrl: string | null;
  updatedAt: string;
}

function safeHttpUrl(url: string | null): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? url : undefined;
  } catch {
    return undefined;
  }
}

// Each line of the exceptions text is one exception; the agent appends lines.
function exceptionLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);
}

function askToRedecide(rule: Rule) {
  sendToAgentChat({
    message: `The exceptions for ${rule.oldName} changed. Read the rule again with list-rules, then re-decide the pending findings it affects with record-decisions.`,
    contextLabel: `Rule ${rule.oldName} to ${rule.newName}`,
    submit: true,
    openSidebar: true,
  });
}

function RuleEditor({
  rule,
  onDone,
  onSaved,
}: {
  rule: Rule;
  onDone: () => void;
  onSaved: (exceptions: string) => void;
}) {
  const [text, setText] = useState(rule.exceptions);
  // The rule as it was when editing started; a save is refused if the agent
  // or another tab changed it meanwhile, so nobody's exception is lost.
  const [startedAt] = useState(rule.updatedAt);
  const upsert = useActionMutation("upsert-rule");
  const isStale = rule.updatedAt !== startedAt;
  const save = async () => {
    try {
      const exceptions = text.trim();
      await upsert.mutateAsync({ id: rule.id, exceptions, expectedUpdatedAt: startedAt });
      onSaved(exceptions);
      onDone();
      toast("Rule saved. Findings already decided keep their decision until the agent re-decides them.", {
        action: { label: "Ask the agent", onClick: () => askToRedecide(rule) },
      });
    } catch (error) {
      toast.error(errorMessage(error, "The rule was not saved."));
    }
  };
  return (
    <form
      className="ab-edit"
      onSubmit={(event) => {
        event.preventDefault();
        if (!upsert.isPending && !isStale) void save();
      }}
    >
      <label className="ab-sr" htmlFor={`ab-exc-${rule.id}`}>
        Exceptions for {rule.oldName}, one per line
      </label>
      <textarea
        id={`ab-exc-${rule.id}`}
        className="ab-exc-input"
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") onDone();
        }}
        autoFocus
      />
      {isStale ? (
        <p className="ab-blocked" role="status">
          The agent or another tab changed this rule while you were editing. Cancel and edit again to keep both.
        </p>
      ) : null}
      <div className="ab-edit-row">
        <button
          type="submit"
          className="ab-btn ab-btn-sm ab-btn-primary"
          aria-disabled={upsert.isPending || isStale}
        >
          {upsert.isPending ? <CircleNotch size={16} weight="light" className="ab-spin" /> : null}
          Save rule
        </button>
        <button type="button" className="ab-btn ab-btn-sm" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function RuleItem({
  rule,
  firstSeen,
  onSaved,
}: {
  rule: Rule;
  firstSeen: string[];
  onSaved: (exceptions: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const editRef = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);
  // Closing the editor removes the focused field; put focus back on Edit.
  useEffect(() => {
    if (wasEditing.current && !isEditing) editRef.current?.focus();
    wasEditing.current = isEditing;
  }, [isEditing]);
  const lines = exceptionLines(rule.exceptions);
  const source = safeHttpUrl(rule.sourceUrl);
  return (
    <li className="ab-rule-item">
      <div className="ab-rule-name">
        <span>{rule.oldName}</span>
        <ArrowRight size={14} weight="light" aria-label="becomes" />
        <b>{rule.newName}</b>
      </div>
      <div className="ab-rule-meta">
        <span>
          <CalendarBlank size={14} weight="light" />
          Effective {formatDate(rule.effectiveDate)}
        </span>
        {source ? (
          <a href={source} target="_blank" rel="noopener noreferrer">
            <ArrowSquareOut size={14} weight="light" />
            Announcement
          </a>
        ) : null}
      </div>
      {isEditing ? (
        <RuleEditor rule={rule} onDone={() => setIsEditing(false)} onSaved={onSaved} />
      ) : (
        <>
          <h3 className="ab-exc-h">Never change when</h3>
          {lines.length === 0 ? (
            <p className="ab-exc-none">No exceptions yet. Every mention is a candidate.</p>
          ) : (
            <ul className="ab-exc">
              {lines.map((line, i) => {
                const isNew = !firstSeen.includes(line);
                return (
                  <li key={`${i}-${line}`} className={isNew ? "ab-exc-new" : undefined}>
                    {isNew ? <span className="ab-sr">New exception: </span> : null}
                    {line}
                  </li>
                );
              })}
            </ul>
          )}
          <div className="ab-rule-foot">
            <span>
              <ClockCounterClockwise size={14} weight="light" />
              Updated {formatDate(rule.updatedAt)}
            </span>
            <button
              ref={editRef}
              type="button"
              className="ab-chip"
              aria-label={`Edit the exceptions for ${rule.oldName}`}
              onClick={() => setIsEditing(true)}
            >
              <PencilSimpleLine size={14} weight="light" />
              Edit
            </button>
          </div>
        </>
      )}
    </li>
  );
}

export function RulesPanel() {
  const { data, isLoading, error } = useActionQuery("list-rules", {});
  // Exceptions present when the screen opened, plus the person's own saves;
  // anything else added later (by the agent or a teammate) is marked new.
  const firstSeen = useRef(new Map<string, string[]>());
  const rules = (data?.rules ?? []) as Rule[];
  for (const rule of rules) {
    if (!firstSeen.current.has(rule.id)) firstSeen.current.set(rule.id, exceptionLines(rule.exceptions));
  }

  return (
    <section className="ab-panel ab-rules ab-rise" style={{ ["--b" as string]: 3 }} aria-labelledby="ab-rules-h">
      <div className="ab-ahead">
        <h2 id="ab-rules-h">Rules</h2>
        {data ? <span className="ab-status">{plural(rules.length, "retired name")}</span> : null}
      </div>
      {isLoading && !data ? (
        <div className="ab-abody" aria-busy="true" aria-label="Loading the rules">
          <div className="ab-skel ab-skel-line" style={{ width: "60%" }} />
          <div className="ab-skel ab-skel-line" style={{ width: "90%" }} />
        </div>
      ) : error && !data ? (
        <p className="ab-abody ab-blocked">{errorMessage(error, "The rules could not be read.")}</p>
      ) : rules.length === 0 ? (
        <p className="ab-abody ab-blocked">No retired names yet. Ask the agent to add one, with its replacement.</p>
      ) : (
        <ul className="ab-rule-list">
          {rules.map((rule) => (
            <RuleItem
              key={rule.id}
              rule={rule}
              firstSeen={firstSeen.current.get(rule.id) ?? []}
              onSaved={(exceptions) => firstSeen.current.set(rule.id, exceptionLines(exceptions))}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
