import { ArrowClockwise, ChatCircleText, CheckCircle, FunnelSimple, Tray, WarningCircle } from "@phosphor-icons/react";
import { sendToAgentChat } from "@agent-native/core/client/agent-chat";

export function QueueSkeleton() {
  return (
    <div className="ab-app" aria-busy="true" aria-label="Loading the queue">
      <div className="ab-queue">
        <div className="ab-skel" style={{ height: 34, width: "60%" }} />
        <div className="ab-panel ab-focus">
          <div className="ab-skel ab-skel-line" style={{ width: "45%" }} />
          <div className="ab-skel" style={{ height: 30, width: "92%", marginTop: 26 }} />
          <div className="ab-skel" style={{ height: 30, width: "70%", marginTop: 10 }} />
          <div className="ab-skel" style={{ height: 22, width: "80%", marginTop: 22 }} />
          <div className="ab-skel" style={{ height: 38, width: 260, marginTop: 30 }} />
        </div>
        <div className="ab-panel" style={{ height: 300 }} />
      </div>
      <div className="ab-side">
        <div className="ab-panel ab-core">
          <div className="ab-skel" style={{ height: 64, width: 150 }} />
          <div className="ab-skel" style={{ height: 150, marginTop: 24 }} />
        </div>
      </div>
    </div>
  );
}

export function QueueError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="ab-app">
      <div className="ab-panel ab-state ab-state-error" role="alert">
        <WarningCircle size={28} weight="light" className="ab-state-icon" />
        <h2>The queue did not load.</h2>
        <p>{message}</p>
        <button type="button" className="ab-btn" onClick={onRetry}>
          <ArrowClockwise size={16} weight="light" />
          Try again
        </button>
      </div>
    </div>
  );
}

// No findings at all: either no rules yet, or no page uses the old names.
export function QueueEmpty({ hasRules }: { hasRules: boolean }) {
  const title = hasRules
    ? "No page in the library uses the retired names."
    : "Add the names you retired. Afterbrand will find every page that still uses them.";
  const body = hasRules
    ? "The agent scanned every page and found nothing to review. Add another rule or import more pages."
    : "A rule is a retired name, its replacement, the date it took effect and any exceptions in plain words.";
  return (
    <div className="ab-app">
      <div className="ab-panel ab-state">
        <Tray size={28} weight="light" className="ab-state-icon" />
        <h2>{title}</h2>
        <p>{body}</p>
        <button
          type="button"
          className="ab-btn ab-btn-primary"
          onClick={() =>
            sendToAgentChat({
              message: hasRules ? "Help me add another rename rule." : "Help me add my first rename rule.",
              submit: false,
              openSidebar: true,
            })
          }
        >
          <ChatCircleText size={16} weight="light" />
          Add a rule with the agent
        </button>
      </div>
    </div>
  );
}

export function QueueDone({ reviewed, unpublished }: { reviewed: number; unpublished: number }) {
  return (
    <div className="ab-panel ab-state">
      <CheckCircle size={28} weight="light" className="ab-state-icon" />
      <h2>
        All {reviewed} findings are reviewed.
      </h2>
      <p>
        {unpublished > 0
          ? `${unpublished} accepted changes are waiting to be published.`
          : "Nothing is waiting to be published."}
      </p>
    </div>
  );
}

export function FilterEmpty({ label, onShowAll }: { label: string; onShowAll: () => void }) {
  return (
    <div className="ab-panel ab-state">
      <FunnelSimple size={28} weight="light" className="ab-state-icon" />
      <h2>No pending findings marked {label}.</h2>
      <button type="button" className="ab-btn" onClick={onShowAll}>
        Show all pending findings
      </button>
    </div>
  );
}
