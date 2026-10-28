import { CircleNotch, DownloadSimple, PaperPlaneTilt, ShieldCheck } from "@phosphor-icons/react";
import { callAction, useActionMutation } from "@agent-native/core/client/hooks";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { errorMessage, formatDate, plural } from "./shared";

export interface LastPublication {
  id: string;
  code: string;
  changes: number;
  pages: number;
  publishedAt: string;
}

type Props = {
  changes: number;
  pages: number;
  // Pages that publishing saves in Builder as unpublished edits.
  builderPages: number;
  // The code of exactly these accepted changes; publish-changes refuses any other.
  set: string | null;
  last: LastPublication | null;
};

async function download(id: string) {
  try {
    const file = await callAction("get-publication", { id }, { method: "GET", uiOnly: true });
    const url = URL.createObjectURL(new Blob([file.markdown], { type: "text/markdown;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = file.fileName;
    link.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    toast.error(errorMessage(error, "The download failed. Try again."));
  }
}

// Publishing locks the accepted changes and saves them as a download. A click
// here is the person approving; when the agent asks to publish, the chat shows
// the same approval before the action runs (needsApproval on publish-changes).
export function PublishCard({ changes, pages, builderPages, set, last }: Props) {
  const [isConfirming, setIsConfirming] = useState(false);
  const publish = useActionMutation("publish-changes");

  // A confirm prompt never survives a change in what it would publish.
  useEffect(() => {
    setIsConfirming(false);
  }, [set]);

  if (changes === 0 && !last) return null;

  const run = async () => {
    if (!set) return;
    try {
      const result = await publish.mutateAsync({ set });
      setIsConfirming(false);
      const inBuilder = result.savedInBuilder > 0 ? ` ${plural(result.savedInBuilder, "page")} saved in Builder as unpublished edits.` : "";
      toast(`Published ${plural(result.published, "change")} across ${plural(result.pages, "page")}.${inBuilder}`, {
        action: { label: "Download", onClick: () => void download(result.publication) },
      });
    } catch (error) {
      toast.error(errorMessage(error, "Nothing was published."));
    }
  };

  const label = `Publish ${plural(changes, "accepted change")} across ${plural(pages, "page")}`;

  return (
    <section className="ab-panel ab-publish ab-rise" style={{ ["--b" as string]: 2 }} aria-label="Publish">
      {changes === 0 ? null : isConfirming ? (
        <>
          <p>
            <ShieldCheck size={16} weight="light" />
            <span>
              Publishing set <b>{set}</b> saves {plural(pages, "page")} with {plural(changes, "change")} as a download
              and locks them. Undo stops working for them.
              {builderPages > 0
                ? ` ${builderPages === pages ? "Every page" : plural(builderPages, "page")} also goes to Builder as unpublished edits, live only when someone publishes there.`
                : null}
            </span>
          </p>
          <div className="ab-edit-row">
            <button
              type="button"
              className="ab-btn ab-btn-sm ab-btn-primary"
              aria-disabled={publish.isPending}
              onClick={() => !publish.isPending && void run()}
            >
              {publish.isPending ? <CircleNotch size={16} weight="light" className="ab-spin" /> : null}
              Publish now
            </button>
            <button type="button" className="ab-btn ab-btn-sm" onClick={() => setIsConfirming(false)}>
              Cancel
            </button>
          </div>
        </>
      ) : (
        <button type="button" className="ab-btn ab-btn-primary ab-publish-btn" onClick={() => setIsConfirming(true)}>
          <PaperPlaneTilt size={16} weight="light" />
          {label}
        </button>
      )}
      {last ? (
        <div className="ab-publish-last">
          <span>
            Last published {formatDate(last.publishedAt)}: {plural(last.changes, "change")} on{" "}
            {plural(last.pages, "page")}
          </span>
          <button type="button" className="ab-chip" onClick={() => void download(last.id)}>
            <DownloadSimple size={14} weight="light" />
            Download
          </button>
        </div>
      ) : null}
    </section>
  );
}
