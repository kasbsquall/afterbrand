import { Check, CircleNotch, FileText, ListChecks, Warning, X } from "@phosphor-icons/react";
import { useActionMutation, useActionQuery } from "@agent-native/core/client/hooks";
import { toast } from "sonner";

import type { BusyAction } from "./FocusCard";
import { errorMessage, MarkedText, plural, ProposalText, type Mention } from "./shared";

interface BatchItem {
  findingId: string;
  pageId: string;
  pageTitle: string;
  newName: string;
  before: string;
  after: string;
  mentions: Mention[];
  problem: string | null;
}

type Props = {
  busy: BusyAction;
  onAccept: (code: string, findingIds: string[]) => void;
};

function byPage(items: BatchItem[]) {
  const groups: { pageId: string; pageTitle: string; items: BatchItem[] }[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last?.pageId === item.pageId) last.items.push(item);
    else groups.push({ pageId: item.pageId, pageTitle: item.pageTitle, items: [item] });
  }
  return groups;
}

// A batch staged for review: every sentence before and after, and the code a
// person finds again in the chat's approval. The code is a hash of exactly
// what is listed here, so approving it can only apply what this panel shows.
export function BatchReview({ busy, onAccept }: Props) {
  const { data } = useActionQuery("get-staged-batch", {});
  const discard = useActionMutation("discard-batch");
  const batch = data?.batch;
  if (!batch) return null;

  const items = batch.items as BatchItem[];
  const isBlocked = batch.problem !== null || busy !== null;
  const heading =
    batch.stagedBy === "agent"
      ? `The agent staged ${plural(items.length, "change")} on ${plural(batch.pages, "page")}`
      : `${plural(items.length, "change")} staged on ${plural(batch.pages, "page")}`;

  const runDiscard = async () => {
    try {
      await discard.mutateAsync({ batch: batch.code });
      toast("Batch discarded. Nothing on any page changed.");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <section className="ab-panel ab-batch ab-rise" aria-labelledby="ab-batch-h">
      <div className="ab-batch-head">
        <ListChecks size={20} weight="light" />
        <div>
          <h2 id="ab-batch-h">{heading}</h2>
          <p>
            Approve batch <b>{batch.code}</b> in the chat, or accept it here. If a sentence or rewrite below changes
            first, the batch will not run.
          </p>
        </div>
        <span className="ab-batch-code" title="The start of a hash of every sentence and rewrite in this batch">
          {batch.code}
        </span>
      </div>
      <div className="ab-batch-list" tabIndex={0} aria-label={`Batch ${batch.code}, before and after`}>
        {byPage(items).map((group) => (
          <div key={group.pageId} className="ab-batch-group">
            <h3>
              <FileText size={15} weight="light" />
              <span>{group.pageTitle}</span>
              <small>{plural(group.items.length, "change")}</small>
            </h3>
            <ol>
              {group.items.map((item) => (
                <li key={item.findingId} data-problem={item.problem ? "true" : undefined}>
                  <span className="ab-lbl">Before</span>
                  <p className="ab-batch-before">
                    <MarkedText text={item.before} mentions={item.mentions} className="ab-strike" />
                  </p>
                  <span className="ab-lbl">After</span>
                  <p>
                    <ProposalText text={item.after} newName={item.newName} />
                  </p>
                  {item.problem ? (
                    <p className="ab-batch-flag">
                      <Warning size={14} weight="light" />
                      {item.problem}
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
      {batch.problem ? (
        <p className="ab-batch-problem" role="status">
          <Warning size={16} weight="light" />
          {batch.problem} Ask the agent to stage it again.
        </p>
      ) : null}
      <div className="ab-batch-foot">
        <button
          type="button"
          className="ab-btn ab-btn-primary"
          aria-disabled={isBlocked}
          onClick={() =>
            !isBlocked &&
            onAccept(
              batch.code,
              items.map((item) => item.findingId),
            )
          }
        >
          {busy === "accept" ? (
            <CircleNotch size={16} weight="light" className="ab-spin" />
          ) : (
            <Check size={16} weight="light" />
          )}
          Accept these {items.length}
        </button>
        <button
          type="button"
          className="ab-btn"
          aria-disabled={discard.isPending}
          onClick={() => !discard.isPending && void runDiscard()}
        >
          <X size={16} weight="light" />
          Discard
        </button>
      </div>
    </section>
  );
}
