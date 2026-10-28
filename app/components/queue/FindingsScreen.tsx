import { X } from "@phosphor-icons/react";
import { sendToAgentChat } from "@agent-native/core/client/agent-chat";
import { useActionMutation, useActionQuery, writeClientAppState } from "@agent-native/core/client/hooks";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { TAB_ID } from "@/lib/tab-id";

import { AgentCard } from "./AgentCard";
import { BatchReview } from "./BatchReview";
import { CoreSample } from "./CoreSample";
import { canAccept, FindingList } from "./FindingList";
import { FocusCard, type BusyAction, type Finding } from "./FocusCard";
import { PublishCard } from "./PublishCard";
import { FilterEmpty, QueueDone, QueueEmpty, QueueError, QueueSkeleton } from "./QueueStates";
import { RulesPanel } from "./RulesPanel";
import { decisionWord, errorMessage, plural, useSounds, type DecisionKey } from "./shared";
import { TopBar } from "./TopBar";
import "./queue.css";

type Filter = "all" | DecisionKey;
const TABS: Filter[] = ["all", "unsure", "change", "keep", "undecided"];
const PAGE_SIZE = 50;
// list-findings accepts at most 200 rows per call.
const MAX_ROWS = 200;
const PRESS_MS = 120;
// Long enough to notice and reach the Undo button.
const UNDO_TOAST_MS = 8000;

export function FindingsScreen() {
  const [filter, setFilter] = useState<Filter>("all");
  const [pageFilter, setPageFilter] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [isEditing, setIsEditing] = useState(false);
  const [busy, setBusy] = useState<BusyAction>(null);
  // Set after an action so the next card takes keyboard focus.
  const [refocus, setRefocus] = useState(false);
  const [pressedKey, setPressedKey] = useState<string | null>(null);
  const sounds = useSounds();

  const overview = useActionQuery("get-library-overview", {});
  const rules = useActionQuery("list-rules", {});
  const list = useActionQuery(
    "list-findings",
    {
      status: "pending",
      decision: filter === "all" ? undefined : filter,
      pageId: pageFilter ?? undefined,
      limit,
      offset: 0,
    },
    { placeholderData: (previous) => previous },
  );
  const accept = useActionMutation("accept-findings");
  const keep = useActionMutation("reject-findings");
  const edit = useActionMutation("edit-finding");
  const revert = useActionMutation("revert-change");
  const reopen = useActionMutation("reopen-findings");

  const findings = (list.data?.findings ?? []) as Finding[];
  const focused = findings.find((f) => f.id === focusedId) ?? findings[0] ?? null;
  const selectedFindings = useMemo(() => findings.filter((f) => selected.has(f.id)), [findings, selected]);

  // The agent reads this tab's selection through view-screen; it is cleared
  // when the screen closes so the agent never reads a stale selection.
  useEffect(() => {
    void writeClientAppState(
      `selection:${TAB_ID}`,
      { kind: "findings", findingIds: [...selected] },
      { requestSource: TAB_ID },
    );
  }, [selected]);
  useEffect(
    () => () => {
      void writeClientAppState(
        `selection:${TAB_ID}`,
        { kind: "findings", findingIds: [] },
        { requestSource: TAB_ID, keepalive: true },
      );
    },
    [],
  );

  const changeScope = (next: { filter?: Filter; pageId?: string | null }) => {
    if (next.filter !== undefined) setFilter(next.filter);
    if (next.pageId !== undefined) setPageFilter(next.pageId);
    setLimit(PAGE_SIZE);
    setFocusedId(null);
    setSelected(new Set());
    setIsEditing(false);
  };

  const focusAfter = (ids: string[]) => {
    const gone = new Set(ids);
    const start = focused ? findings.indexOf(focused) : 0;
    const next = findings.slice(start).find((f) => !gone.has(f.id)) ?? findings.find((f) => !gone.has(f.id));
    setFocusedId(next?.id ?? null);
    setSelected((current) => new Set([...current].filter((id) => !gone.has(id))));
    setRefocus(true);
  };

  const undoWith = (run: () => Promise<unknown>) => () => {
    run()
      .then(() => sounds.play("undo"))
      .catch((error: unknown) => toast.error(errorMessage(error, "Undo failed. The change is still applied.")));
  };

  // A staged batch is applied by its code, so it runs only as it was shown.
  const runAccept = async (ids: string[], batch?: string) => {
    setBusy("accept");
    try {
      const result = await accept.mutateAsync(batch ? { batch } : { ids });
      // Apply mode always returns changeIds; undo mode is only used by chat cards.
      if (!("changeIds" in result)) return;
      sounds.play("accept");
      focusAfter(ids);
      toast(`Applied ${plural(result.applied, "change")}. Nothing ships until you publish.`, {
        duration: UNDO_TOAST_MS,
        action: {
          label: "Undo",
          onClick: undoWith(() => revert.mutateAsync({ changeIds: result.changeIds })),
        },
      });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  const runKeep = async (ids: string[]) => {
    setBusy("keep");
    try {
      await keep.mutateAsync({ ids });
      sounds.play("keep");
      focusAfter(ids);
      toast(`Kept ${plural(ids.length, "sentence")} as written.`, {
        duration: UNDO_TOAST_MS,
        action: {
          label: "Undo",
          onClick: undoWith(() => reopen.mutateAsync({ ids })),
        },
      });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  const runEdit = async (proposal: string) => {
    if (!focused) return;
    setBusy("edit");
    try {
      await edit.mutateAsync({ id: focused.id, proposal });
      setIsEditing(false);
      setRefocus(true);
      toast("Rewrite saved. Accept it to apply.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  const toggle = (id: string) => {
    sounds.play("select");
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // A K E act on the focused finding; arrows move; X selects.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.isContentEditable || target?.closest("input, textarea, select, [role='textbox']")) return;
      if (event.metaKey || event.ctrlKey || event.altKey || !focused || isEditing) return;
      const key = event.key.toLowerCase();
      const index = findings.indexOf(focused);
      const press = () => {
        setPressedKey(key);
        window.setTimeout(() => setPressedKey(null), PRESS_MS);
      };
      if (key === "a" && canAccept(focused) && busy === null) {
        press();
        void runAccept([focused.id]);
      } else if (key === "k" && busy === null) {
        press();
        void runKeep([focused.id]);
      } else if (key === "e" && !focused.pageReadOnly && busy === null) {
        // Keep the "e" out of the textarea that opens next.
        event.preventDefault();
        press();
        setIsEditing(true);
      } else if (key === "x") {
        toggle(focused.id);
      } else if (event.key === "ArrowDown" && index < findings.length - 1) {
        event.preventDefault();
        setFocusedId(findings[index + 1].id);
      } else if (event.key === "ArrowUp" && index > 0) {
        event.preventDefault();
        setFocusedId(findings[index - 1].id);
      } else return;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const top = (
    <TopBar
      // Same denominator as the big number: what is still waiting for a person.
      decided={overview.data ? overview.data.statuses.pending - overview.data.pending.undecided : undefined}
      all={overview.data?.statuses.pending}
      muted={sounds.muted}
      onToggleMute={sounds.toggle}
    />
  );

  if ((overview.isLoading && !overview.data) || (rules.isLoading && !rules.data) || (list.isLoading && !list.data)) {
    return (
      <div className="ab">
        {top}
        <QueueSkeleton />
      </div>
    );
  }
  const loadError = overview.error ?? rules.error ?? list.error;
  if (!overview.data || !list.data) {
    return (
      <div className="ab">
        {top}
        <QueueError
          message={errorMessage(loadError)}
          onRetry={() => {
            void overview.refetch();
            void rules.refetch();
            void list.refetch();
          }}
        />
      </div>
    );
  }
  const stats = overview.data;
  if (stats.findings.all === 0) {
    return (
      <div className="ab">
        {top}
        <QueueEmpty hasRules={(rules.data?.rules ?? []).length > 0} />
      </div>
    );
  }

  const counts = list.data.counts;
  const tabCount = (tab: Filter) => (tab === "all" ? list.data.total : counts[tab]);
  const shown = filter === "all" ? list.data.total : counts[filter];
  const activePage = stats.pages.find((p) => p.id === (pageFilter ?? focused?.pageId)) ?? null;
  const position = focused
    ? `${findings.indexOf(focused) + 1} of ${shown} ${pageFilter ? "on this page" : "to review"}`
    : "";

  let main;
  if (stats.statuses.pending === 0) {
    main = <QueueDone reviewed={stats.findings.all} unpublished={stats.unpublishedChanges} />;
  } else if (!focused) {
    main = (
      <FilterEmpty
        label={filter === "all" ? "on this page" : decisionWord(filter)}
        onShowAll={() => changeScope({ filter: "all", pageId: null })}
      />
    );
  } else {
    main = (
      <>
        <FocusCard
          key={focused.id}
          finding={focused}
          shouldFocus={refocus}
          onFocused={() => setRefocus(false)}
          position={position}
          isEditing={isEditing}
          busy={busy}
          pressedKey={pressedKey}
          onAccept={() => void runAccept([focused.id])}
          onKeep={() => void runKeep([focused.id])}
          onStartEdit={() => setIsEditing(true)}
          onCancelEdit={() => setIsEditing(false)}
          onSaveEdit={(proposal) => void runEdit(proposal)}
        />
        <FindingList
          findings={findings}
          total={shown}
          selected={selected}
          focusedId={focused.id}
          busy={busy}
          onToggle={toggle}
          onToggleAll={() =>
            setSelected(selectedFindings.length === findings.length ? new Set() : new Set(findings.map((f) => f.id)))
          }
          onFocus={(id) => {
            setIsEditing(false);
            setFocusedId(id);
          }}
          onAccept={(ids) => void runAccept(ids)}
          onKeep={(ids) => void runKeep(ids)}
          onAsk={() =>
            sendToAgentChat({
              message: `About the ${plural(selectedFindings.length, "selected finding")}: `,
              context: selectedFindings.map((f) => `- ${f.id} on "${f.pageTitle}": ${f.sentence}`).join("\n"),
              contextLabel: plural(selectedFindings.length, "selected finding"),
              submit: false,
              openSidebar: true,
            })
          }
          onClear={() => setSelected(new Set())}
          canLoadMore={limit < MAX_ROWS}
          onLoadMore={() => setLimit((n) => Math.min(n + PAGE_SIZE, MAX_ROWS))}
          isLoadingMore={list.isFetching}
        />
      </>
    );
  }

  return (
    <div className="ab">
      {top}
      <main className="ab-app">
        <section className="ab-queue" aria-label="Findings queue">
          <div className="ab-qhead ab-rise">
            <h1>Findings</h1>
            <div className="ab-tabs" role="group" aria-label="Filter by the agent's decision">
              {TABS.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className="ab-tab"
                  aria-pressed={filter === tab}
                  onClick={() => changeScope({ filter: tab })}
                >
                  {tab === "all" ? null : <span className={`ab-dot ab-d-${tab}`} />}
                  {tab === "all" ? "To review" : decisionWord(tab)} <span className="ab-c">{tabCount(tab)}</span>
                </button>
              ))}
            </div>
            {pageFilter && activePage ? (
              <button type="button" className="ab-chip" onClick={() => changeScope({ pageId: null })}>
                {activePage.title}
                <X size={14} weight="light" aria-label="Show every page" />
              </button>
            ) : null}
          </div>
          <BatchReview busy={busy} onAccept={(code, ids) => void runAccept(ids, code)} />
          {main}
        </section>
        <aside className="ab-side" aria-label="Library and agent">
          <CoreSample
            pages={stats.pages}
            pagesInLibrary={stats.pagesInLibrary}
            findings={{ ...stats.pending, all: stats.findings.all }}
            leftToReview={stats.statuses.pending}
            activePageId={activePage?.id ?? null}
            onSelectPage={(pageId) => changeScope({ pageId })}
          />
          <PublishCard changes={stats.unpublishedChanges} pages={stats.unpublishedPages} />
          <RulesPanel />
          <AgentCard
            selected={selectedFindings}
            undecided={stats.pending.undecided}
            decided={stats.statuses.pending - stats.pending.undecided}
            pending={stats.statuses.pending}
          />
        </aside>
      </main>
    </div>
  );
}
