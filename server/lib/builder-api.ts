import { fail } from "@agent-native/core/action";
import { registerRequiredSecret } from "@agent-native/core/secrets";
import { resolveSecretDetailed } from "@agent-native/core/server";
import { z } from "zod";

import { textBlocks } from "./builder-text.js";

// A Builder space connects with its own two keys, saved by the person in
// Settings. They are app keys, not the framework's Builder.io connection, so
// they never change which model runs the agent.
export const BUILDER_PUBLIC_KEY = "BUILDER_SPACE_PUBLIC_KEY";
export const BUILDER_PRIVATE_KEY = "BUILDER_SPACE_PRIVATE_KEY";

registerRequiredSecret({
  key: BUILDER_PUBLIC_KEY,
  label: "Builder space public API key",
  description: "Lets Afterbrand read the entries of your Builder space.",
  docsUrl: "https://www.builder.io/c/docs/using-your-api-key",
  scope: "user",
  kind: "api-key",
  required: false,
  usedFor: [{ appId: "afterbrand", feature: "Importing Builder entries", effectWhenRemoved: "Afterbrand stops reading your Builder space." }],
});
registerRequiredSecret({
  key: BUILDER_PRIVATE_KEY,
  label: "Builder space private API key",
  description: "Lets Afterbrand save accepted changes in your Builder space as unpublished edits. It never publishes them.",
  docsUrl: "https://www.builder.io/c/docs/using-your-api-key",
  scope: "user",
  kind: "api-key",
  required: false,
  usedFor: [{ appId: "afterbrand", feature: "Saving changes in Builder", effectWhenRemoved: "Publishing only offers the download." }],
});

// Tests point these at a local stand-in for Builder; a deploy leaves them unset.
const CDN_ORIGIN = process.env.AFTERBRAND_BUILDER_CDN_ORIGIN ?? "https://cdn.builder.io"; // guard:allow-env-credential — an endpoint origin, not a credential
const API_ORIGIN = process.env.AFTERBRAND_BUILDER_API_ORIGIN ?? "https://builder.io"; // guard:allow-env-credential — an endpoint origin, not a credential
const TIMEOUT_MS = 20_000;
const PAGE_SIZE = 100;

export const builderModelName = z
  .string()
  .regex(/^[A-Za-z0-9][\w-]{0,63}$/, "A Builder model name has letters, numbers, dashes or underscores")
  .describe("Builder model name, for example blog-article or page");

export const builderEntry = z
  .object({
    // Ids go into request paths, so only Builder's id characters are accepted.
    id: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
    name: z.string().optional(),
    published: z.string().optional(),
    lastUpdated: z.number().optional(),
    firstPublished: z.number().optional(),
    data: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();
export type BuilderEntry = z.infer<typeof builderEntry>;

export function editorUrl(entryId: string): string {
  return `https://builder.io/content/${entryId}`;
}

export async function builderKeys(): Promise<{ publicKey: string | null; privateKey: string | null }> {
  const [pub, priv] = await Promise.all([
    resolveSecretDetailed(BUILDER_PUBLIC_KEY),
    resolveSecretDetailed(BUILDER_PRIVATE_KEY),
  ]);
  if (pub.lookupFailed || priv.lookupFailed) fail("Afterbrand could not read the Builder keys right now. Try again in a moment.");
  return { publicKey: pub.value?.trim() || null, privateKey: priv.value?.trim() || null };
}

const REFUSED = Symbol("refused");

async function call(url: URL, what: string, init: RequestInit = {}, refusedIsAnswer = false): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    fail(`Afterbrand could not reach Builder while ${what}. Nothing changed; try again.`);
  }
  if (refusedIsAnswer && response.status === 401) return REFUSED;
  if (response.status === 401 || response.status === 403) {
    fail(`Builder refused the key while ${what}. Check the Builder space keys in Settings.`);
  }
  if (response.status === 404) fail(`Builder found no such model or entry while ${what}.`);
  if (!response.ok) fail(`Builder answered ${response.status} while ${what}. Nothing changed.`);
  try {
    return await response.json();
  } catch {
    fail(`Builder sent an answer Afterbrand could not read while ${what}.`);
  }
}

const results = z.object({ results: z.array(builderEntry) });

// Published entries of a model, newest first, at most `max`. Some spaces refuse
// a public-key list of more than one entry (401, code e892, seen on a free
// space in October 2026) yet serve the same entries one per request, so a
// refused page is asked for again one entry at a time.
export async function listEntries(publicKey: string, model: string, max: number): Promise<BuilderEntry[]> {
  const out: BuilderEntry[] = [];
  let size = PAGE_SIZE;
  for (let offset = 0; offset < max; offset += size) {
    const limit = Math.min(size, max - offset);
    const url = new URL(`/api/v3/content/${model}`, CDN_ORIGIN);
    url.search = new URLSearchParams({ apiKey: publicKey, limit: String(limit), offset: String(offset), cachebust: "true" }).toString();
    const answer = await call(url, "reading entries", {}, limit > 1);
    if (answer === REFUSED) {
      size = 1;
      offset -= size;
      continue;
    }
    const page = results.safeParse(answer);
    if (!page.success) fail("Builder's list of entries did not have the expected shape.");
    out.push(...page.data.results);
    if (page.data.results.length < limit) break;
  }
  return out;
}

export async function getEntry(publicKey: string, model: string, id: string): Promise<BuilderEntry | null> {
  const url = new URL(`/api/v3/content/${model}`, CDN_ORIGIN);
  url.search = new URLSearchParams({ apiKey: publicKey, "query.id": id, limit: "1", cachebust: "true" }).toString();
  const page = results.safeParse(await call(url, "reading an entry"));
  if (!page.success) fail("Builder's entry did not have the expected shape.");
  return page.data.results[0] ?? null;
}

// The entry a webhook announced, with its blocks. A live space sent the
// published entry without them (October 2026), so an entry with no Text block
// is read back from the content API, the shape a manual import reads.
export async function publishedEntry(publicKey: string, model: string, sent: BuilderEntry): Promise<BuilderEntry> {
  if (textBlocks(sent.data ?? {}).length > 0) return sent;
  return (await getEntry(publicKey, model, sent.id)) ?? sent;
}

// Saves new data on an entry as unpublished edits (`autoSaveOnly`): the live
// entry keeps serving the old text until a person publishes in Builder. PUT
// replaces the whole entry, so every field read from Builder is sent back.
export async function saveUnpublishedEdit(privateKey: string, model: string, entry: BuilderEntry, data: unknown) {
  const url = new URL(`/api/v1/write/${model}/${entry.id}`, API_ORIGIN);
  url.search = new URLSearchParams({ autoSaveOnly: "true", triggerWebhooks: "false" }).toString();
  await call(url, `saving "${entry.name ?? entry.id}"`, {
    method: "PUT",
    headers: { authorization: `Bearer ${privateKey}`, "content-type": "application/json" },
    body: JSON.stringify({ ...entry, data }),
  });
}
