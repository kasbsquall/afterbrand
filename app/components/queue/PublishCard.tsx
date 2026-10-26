import { CircleNotch, PaperPlaneTilt, ShieldCheck } from "@phosphor-icons/react";
import { useActionMutation } from "@agent-native/core/client/hooks";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { errorMessage, plural } from "./shared";

type Props = {
  changes: number;
  pages: number;
};

// Publishing locks the accepted changes and exports them. A click here is the
// person approving; when the agent asks to publish, the chat shows the same
// approval before the action runs (needsApproval on publish-changes).
export function PublishCard({ changes, pages }: Props) {
  const [isConfirming, setIsConfirming] = useState(false);
  const publish = useActionMutation("publish-changes");

  // A confirm prompt never survives a change in what it would publish.
  useEffect(() => {
    setIsConfirming(false);
  }, [changes, pages]);

  if (changes === 0) return null;

  const run = async () => {
    try {
      const result = await publish.mutateAsync({});
      setIsConfirming(false);
      toast(`${result.message} The export holds one Markdown file per page and a diff manifest.`);
    } catch (error) {
      toast.error(errorMessage(error, "Nothing was published."));
    }
  };

  const label = `Publish ${plural(changes, "accepted change")} across ${plural(pages, "page")}`;

  return (
    <section className="ab-panel ab-publish ab-rise" style={{ ["--b" as string]: 2 }} aria-label="Publish">
      {isConfirming ? (
        <>
          <p>
            <ShieldCheck size={16} weight="light" />
            Publishing writes {plural(pages, "page")} to the export folder and locks {plural(changes, "change")}. Undo
            stops working for them.
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
    </section>
  );
}
