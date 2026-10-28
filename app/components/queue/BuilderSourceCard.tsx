import { CheckCircle, CircleNotch, CloudArrowDown, Copy, Plugs, WebhooksLogo } from "@phosphor-icons/react";
import { useActionMutation, useActionQuery } from "@agent-native/core/client/hooks";
import { useState } from "react";
import { toast } from "sonner";

import { errorMessage, formatDate, plural } from "./shared";

interface Source {
  connected: boolean;
  canSave: boolean;
  models: { model: string; pages: number; lastImportAt: string | null }[];
  hooks: { model: string; createdAt: string; lastCalledAt: string | null }[];
}

const MODEL = /^[A-Za-z0-9][\w-]{0,63}$/;

// Where the library's Builder pages come from, and the webhook link that keeps
// them current: Builder calls it on every publish.
export function BuilderSourceCard() {
  const { data, isLoading, error } = useActionQuery("get-builder-source", {}) as {
    data?: Source;
    isLoading: boolean;
    error: unknown;
  };
  const importEntries = useActionMutation("import-builder-entries");
  const createHook = useActionMutation("create-builder-webhook");
  const [model, setModel] = useState("");
  const [link, setLink] = useState<{ model: string; url: string } | null>(null);

  const chosen = model.trim() || data?.models[0]?.model || "";
  const isValid = MODEL.test(chosen);

  const runImport = async (name: string) => {
    try {
      const result = await importEntries.mutateAsync({ model: name });
      toast(result.message);
    } catch (e) {
      toast.error(errorMessage(e, "Nothing was imported."));
    }
  };

  const runHook = async (name: string) => {
    try {
      const result = await createHook.mutateAsync({ model: name });
      setLink({ model: name, url: `${window.location.origin}${result.path}` });
    } catch (e) {
      toast.error(errorMessage(e, "The webhook link could not be created."));
    }
  };

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast("Webhook link copied.");
    } catch {
      toast.error("Copy failed. Select the link and copy it by hand.");
    }
  };

  const status = !data ? null : data.connected ? (data.canSave ? "Reads and saves edits" : "Reads only") : "Not connected";

  return (
    <section className="ab-panel ab-builder ab-rise" style={{ ["--b" as string]: 4 }} aria-labelledby="ab-builder-h">
      <div className="ab-ahead">
        <h2 id="ab-builder-h">Builder space</h2>
        {status ? (
          <span className="ab-status">
            {data?.connected ? <CheckCircle size={14} weight="light" /> : <Plugs size={14} weight="light" />}
            {status}
          </span>
        ) : null}
      </div>
      {isLoading && !data ? (
        <div className="ab-abody" aria-busy="true" aria-label="Loading the Builder connection">
          <div className="ab-skel ab-skel-line" style={{ width: "70%" }} />
        </div>
      ) : error && !data ? (
        <p className="ab-abody ab-blocked">{errorMessage(error, "The Builder connection could not be read.")}</p>
      ) : !data?.connected ? (
        <p className="ab-abody ab-builder-note">
          Add your Builder space's public and private API keys in <a href="/settings">Settings</a>. Afterbrand then imports
          its entries and saves accepted changes there as unpublished edits. It never publishes in Builder.
        </p>
      ) : (
        <div className="ab-abody">
          {data.models.length > 0 ? (
            <ul className="ab-builder-models">
              {data.models.map((m) => {
                const hook = data.hooks.find((h) => h.model === m.model);
                return (
                  <li key={m.model}>
                    <span>
                      <b>{m.model}</b>: {plural(m.pages, "page")}
                      {m.lastImportAt ? `, read ${formatDate(m.lastImportAt)}` : ""}
                      <small>
                        <WebhooksLogo size={13} weight="light" />
                        {hook
                          ? hook.lastCalledAt
                            ? `Webhook last called ${formatDate(hook.lastCalledAt)}`
                            : "Webhook set, not called yet"
                          : "No webhook yet"}
                      </small>
                    </span>
                    <button
                      type="button"
                      className="ab-chip"
                      aria-disabled={createHook.isPending}
                      onClick={() => !createHook.isPending && void runHook(m.model)}
                    >
                      {hook ? "New link" : "Webhook link"}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
          {link ? (
            <div className="ab-builder-link">
              <p>
                In Builder, open Models, then {link.model}, Advanced, Webhooks, and add this link. It is shown once.
              </p>
              <div className="ab-edit-row">
                <input readOnly value={link.url} aria-label={`Webhook link for ${link.model}`} onFocus={(e) => e.currentTarget.select()} />
                <button type="button" className="ab-chip" onClick={() => void copy(link.url)}>
                  <Copy size={14} weight="light" />
                  Copy
                </button>
              </div>
            </div>
          ) : null}
          <div className="ab-edit-row">
            <input
              value={model}
              placeholder={data.models[0]?.model ?? "blog-article"}
              aria-label="Builder model name"
              onChange={(e) => setModel(e.target.value)}
            />
            <button
              type="button"
              className="ab-btn ab-btn-sm"
              aria-disabled={!isValid || importEntries.isPending}
              onClick={() => isValid && !importEntries.isPending && void runImport(chosen)}
            >
              {importEntries.isPending ? <CircleNotch size={16} weight="light" className="ab-spin" /> : <CloudArrowDown size={16} weight="light" />}
              Import
            </button>
          </div>
          {!data.canSave ? (
            <p className="ab-blocked">Add the private API key too, so publishing can save edits in Builder.</p>
          ) : null}
        </div>
      )}
    </section>
  );
}
