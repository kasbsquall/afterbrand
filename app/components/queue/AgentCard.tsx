import { ArrowUp, Play, Question, Selection, Sparkle } from "@phosphor-icons/react";
import { sendToAgentChat } from "@agent-native/core/client/agent-chat";
import { useState } from "react";

import type { Finding } from "./FocusCard";
import { plural } from "./shared";

type Props = {
  selected: Finding[];
  // Counts over pending findings: the queue the agent still works on.
  undecided: number;
  decided: number;
  pending: number;
};

function selectionContext(selected: Finding[]): string {
  return selected
    .map((f) => `- ${f.id} on "${f.pageTitle}": ${f.sentence} (decision: ${f.decision ?? "undecided"})`)
    .join("\n");
}

function describeSelection(selected: Finding[]): string {
  const pages = new Set(selected.map((f) => f.pageTitle));
  return `${plural(selected.length, "finding")} on ${plural(pages.size, "page")}`;
}

export function AgentCard({ selected, undecided, decided, pending }: Props) {
  const [text, setText] = useState("");
  const hasSelection = selected.length > 0;

  const ask = (message: string) => {
    sendToAgentChat({
      message,
      context: hasSelection ? `Selected findings (also readable with view-screen):\n${selectionContext(selected)}` : undefined,
      contextLabel: hasSelection ? describeSelection(selected) : undefined,
      submit: true,
      openSidebar: true,
    });
  };

  const placeholder = hasSelection
    ? `Ask about the ${plural(selected.length, "selected finding")}`
    : "Ask about the queue";

  return (
    <section className="ab-panel ab-agent ab-rise" style={{ ["--b" as string]: 4 }} aria-labelledby="ab-agent-h">
      <div className="ab-ahead">
        <h2 id="ab-agent-h">Agent</h2>
        <span className="ab-status ab-live">
          <Sparkle size={14} weight="light" />
          Decided {decided} of {pending} pending
        </span>
      </div>
      <div className="ab-abody">
        <div className="ab-ctx">
          <Selection size={16} weight="light" />
          {hasSelection ? (
            <p>
              Reading your selection: <b>{describeSelection(selected)}</b>. Ask in plain words, for example
              "these are changelogs, never touch changelogs".
            </p>
          ) : (
            <p>Nothing selected. The agent reads the whole queue. Select findings to ask about them.</p>
          )}
        </div>
        <div className="ab-sugg">
          {hasSelection ? (
            <button
              type="button"
              className="ab-chip"
              onClick={() => ask("Explain your decision on each selected finding and say if any should change.")}
            >
              <Question size={14} weight="light" />
              Why these decisions?
            </button>
          ) : null}
          {undecided > 0 ? (
            <button
              type="button"
              className="ab-chip"
              onClick={() =>
                ask("Decide the next 50 undecided findings with record-decisions, following the afterbrand-decide skill.")
              }
            >
              <Play size={14} weight="light" />
              Decide the next 50 of {undecided} undecided
            </button>
          ) : null}
        </div>
      </div>
      <form
        className="ab-ask"
        onSubmit={(event) => {
          event.preventDefault();
          const message = text.trim();
          if (!message) return;
          ask(message);
          setText("");
        }}
      >
        <label className="ab-sr" htmlFor="ab-ask-input">
          Ask the agent
        </label>
        <input id="ab-ask-input" value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} />
        <button type="submit" className="ab-send" aria-label="Send to the agent">
          <ArrowUp size={16} weight="light" />
        </button>
      </form>
    </section>
  );
}
