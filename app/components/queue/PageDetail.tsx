import { ArrowSquareOut, ArrowUUpLeft, CalendarBlank, CircleNotch, LockSimple, LockSimpleOpen } from "@phosphor-icons/react";
import { useActionMutation, useActionQuery } from "@agent-native/core/client/hooks";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { QueueError } from "./QueueStates";
import { decisionWord, errorMessage, formatDate, parseMentions, plural, useSounds, type Decision } from "./shared";
import { TopBar } from "./TopBar";
import "./queue.css";

interface PageFinding {
  id: string;
  sentence: string;
  sentenceStart: number;
  mentions: unknown;
  decision: Decision | null;
  reason: string | null;
  proposal: string | null;
  status: string;
  oldName: string;
  newName: string;
}

function safeHttpUrl(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? url : undefined;
  } catch {
    return undefined;
  }
}

// One finding inside the article: the old sentence with its mentions marked,
// and for a pending Change the proposed sentence right after it.
function InlineFinding({ finding }: { finding: PageFinding }) {
  const key = finding.decision ?? "undecided";
  const mentions = parseMentions(finding.mentions);
  const parts: ReactNode[] = [];
  let cursor = 0;
  for (const m of mentions) {
    parts.push(finding.sentence.slice(cursor, m.start));
    parts.push(
      <mark key={m.start} className={key === "change" ? "ab-old" : `ab-${key}`}>
        {finding.sentence.slice(m.start, m.end)}
      </mark>,
    );
    cursor = m.end;
  }
  parts.push(finding.sentence.slice(cursor));
  const label = `${decisionWord(key)}${finding.reason ? `: ${finding.reason}` : ""}`;
  return (
    <span className="ab-hit" title={label}>
      <span className="ab-sr">Finding, {label}. </span>
      {finding.decision === "change" && finding.proposal ? <del>{parts}</del> : parts}
      {finding.decision === "change" && finding.proposal ? (
        <>
          {" "}
          <ins>{finding.proposal}</ins>
        </>
      ) : null}
    </span>
  );
}

// Splits the body into paragraphs and places each pending finding at its
// offset. A finding whose sentence no longer sits at its offset (the body
// changed after the scan) is listed under the article instead of dropped.
function Article({ body, findings }: { body: string; findings: PageFinding[] }) {
  const pending = findings.filter((f) => f.status === "pending");
  const placed = new Set<string>();
  let offset = 0;
  const paragraphs = body.split("\n").map((paragraph, i) => {
    const start = offset;
    offset += paragraph.length + 1;
    const inside = pending.filter((f) => f.sentenceStart >= start && f.sentenceStart < start + paragraph.length);
    const parts: ReactNode[] = [];
    let cursor = 0;
    for (const f of inside) {
      const local = f.sentenceStart - start;
      if (local < cursor || paragraph.slice(local, local + f.sentence.length) !== f.sentence) continue;
      parts.push(paragraph.slice(cursor, local));
      parts.push(<InlineFinding key={f.id} finding={f} />);
      placed.add(f.id);
      cursor = local + f.sentence.length;
    }
    parts.push(paragraph.slice(cursor));
    return <p key={i}>{parts}</p>;
  });
  const unplaced = pending.filter((f) => !placed.has(f.id));
  return (
    <>
      {paragraphs}
      {unplaced.length > 0 ? (
        <section className="ab-unplaced" aria-label="Findings not found in the current text">
          <h2>{plural(unplaced.length, "finding")} not found in the current text</h2>
          {unplaced.map((f) => (
            <p key={f.id}>
              <InlineFinding finding={f} />
            </p>
          ))}
        </section>
      ) : null}
    </>
  );
}

export function PageDetail({ pageId }: { pageId: string }) {
  const sounds = useSounds();
  const query = useActionQuery("get-page", { id: pageId });
  const revert = useActionMutation("revert-change");
  const setReadOnly = useActionMutation("set-page-read-only");
  const data = query.data;

  const top = (
    <TopBar
      muted={sounds.muted}
      onToggleMute={sounds.toggle}
      crumb={{ to: "/findings", label: "Findings", current: data?.page.title ?? "Page" }}
    />
  );

  if (query.isLoading) {
    return (
      <div className="ab">
        {top}
        <div className="ab-app" aria-busy="true" aria-label="Loading the page">
          <div className="ab-panel ab-doc">
            <div className="ab-skel" style={{ height: 30, width: "70%" }} />
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="ab-skel ab-skel-line" style={{ width: `${90 - i * 6}%` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }
  if (query.error || !data) {
    return (
      <div className="ab">
        {top}
        <QueueError
          message={errorMessage(query.error, "The page could not be read.")}
          onRetry={() => void query.refetch()}
        />
      </div>
    );
  }

  const { page, findings, changes } = data;
  const findingsList = findings as PageFinding[];
  const pending = findingsList.filter((f) => f.status === "pending");
  const url = safeHttpUrl(page.url);
  const live = changes.filter((c) => !c.revertedAt);

  const undo = async (changeId: string) => {
    try {
      await revert.mutateAsync({ changeIds: [changeId] });
      sounds.play("undo");
      toast("Change undone. The original sentence is back.");
    } catch (error) {
      toast.error(errorMessage(error, "The change could not be undone."));
    }
  };

  return (
    <div className="ab">
      {top}
      <main className="ab-app">
        <article className="ab-panel ab-doc ab-rise" aria-label={page.title}>
          <div className="ab-meta">
            <span>
              <CalendarBlank size={16} weight="light" />
              Published {formatDate(page.publishedAt)}
            </span>
            {url ? (
              <a href={url} target="_blank" rel="noopener noreferrer">
                <ArrowSquareOut size={16} weight="light" />
                Open the live page
              </a>
            ) : null}
            <span className="ab-pos">
              {pending.length} to review of {plural(findingsList.length, "finding")}
            </span>
          </div>
          <h1>{page.title}</h1>
          <Article body={page.body} findings={findingsList} />
        </article>
        <aside className="ab-side" aria-label="Page controls and changes">
          <section className="ab-panel ab-changes ab-rise" style={{ ["--b" as string]: 1 }}>
            <h2>Page</h2>
            <p className="ab-blocked">
              {page.readOnly
                ? "Read-only: nobody can change this page, the agent included."
                : "Editable: accepted changes apply to this page."}
            </p>
            <button
              type="button"
              className="ab-btn ab-btn-sm"
              aria-disabled={setReadOnly.isPending}
              onClick={() =>
                !setReadOnly.isPending &&
                void setReadOnly
                  .mutateAsync({ pageId: page.id, readOnly: !page.readOnly })
                  .catch((error: unknown) => toast.error(errorMessage(error, "Not saved.")))
              }
            >
              {setReadOnly.isPending ? (
                <CircleNotch size={16} weight="light" className="ab-spin" />
              ) : page.readOnly ? (
                <LockSimpleOpen size={16} weight="light" />
              ) : (
                <LockSimple size={16} weight="light" />
              )}
              {page.readOnly ? "Make editable" : "Make read-only"}
            </button>
          </section>
          <section className="ab-panel ab-changes ab-rise" style={{ ["--b" as string]: 2 }}>
            <h2>Applied changes</h2>
            {live.length === 0 ? (
              <p className="ab-blocked">No change applied to this page yet.</p>
            ) : (
              live.map((change) => (
                <div key={change.id} className="ab-change">
                  <del>{change.before}</del>
                  <ins>{change.after}</ins>
                  <div className="ab-change-foot">
                    <span>
                      {change.publishedAt
                        ? `Published ${formatDate(change.publishedAt)}`
                        : `Applied by ${change.appliedBy} on ${formatDate(change.appliedAt)}`}
                    </span>
                    {change.publishedAt ? null : (
                      <button
                        type="button"
                        className="ab-chip"
                        aria-label={`Undo the change "${change.after}"`}
                        onClick={() => void undo(change.id)}
                      >
                        <ArrowUUpLeft size={14} weight="light" />
                        Undo
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </section>
        </aside>
      </main>
    </div>
  );
}
