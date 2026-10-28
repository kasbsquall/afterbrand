import { fail } from "@agent-native/core/action";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";

import { getDb, schema } from "../db/index.js";
import { builderKeys, editorUrl, getEntry, saveUnpublishedEdit, type BuilderEntry } from "./builder-api.js";
import { entryText, rewriteEntryData } from "./builder-text.js";
import { loadEnabledRules, syncPageFindings } from "./findings-sync.js";
import { nowIso, stableId } from "./owner.js";

type Page = typeof schema.pages.$inferSelect;
type Link = typeof schema.builderEntries.$inferSelect;

// created and updated pages are scanned for findings; kept means the page has
// accepted changes Builder does not publish yet, so the import leaves it alone.
export type ImportOutcome = "created" | "updated" | "unchanged" | "kept" | "empty";

const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");
const iso = (ms?: number) => (ms ? new Date(ms).toISOString() : null);

export function entryTitle(entry: BuilderEntry): string {
  const title = entry.data?.title;
  return (typeof title === "string" && title.trim()) || entry.name || entry.id;
}

async function saveLink(ownerEmail: string, pageId: string, model: string, entry: BuilderEntry, baseline: string) {
  const now = nowIso();
  const values = { baseline, builderUpdatedAt: iso(entry.lastUpdated), importedAt: now };
  await getDb()
    .insert(schema.builderEntries)
    .values({ pageId, ownerEmail, model, entryId: entry.id, ...values })
    .onConflictDoUpdate({ target: schema.builderEntries.pageId, set: values });
}

// Brings one published entry into the library. A page with accepted changes
// is never overwritten: when Builder publishes those changes the baseline
// catches up, and until then the page stays as it is.
export async function upsertEntryPage(
  ownerEmail: string,
  model: string,
  entry: BuilderEntry,
): Promise<{ outcome: ImportOutcome; pageId: string | null }> {
  const body = entryText(entry.data ?? {}).lines.join("\n");
  if (!body) return { outcome: "empty", pageId: null };
  const db = getDb();
  const url = editorUrl(entry.id);
  const pageId = stableId("pg", ownerEmail, url);
  const title = entryTitle(entry);
  const snapshotDate = (iso(entry.lastUpdated) ?? nowIso()).slice(0, 10);
  const [page] = await db
    .select()
    .from(schema.pages)
    .where(and(eq(schema.pages.ownerEmail, ownerEmail), eq(schema.pages.id, pageId)));

  if (!page) {
    await db.insert(schema.pages).values({
      id: pageId,
      ownerEmail,
      url,
      title,
      publishedAt: iso(entry.firstPublished),
      body,
      contentHash: sha256(body),
      source: `builder:${model}`,
      snapshotDate,
      createdAt: nowIso(),
    });
    await saveLink(ownerEmail, pageId, model, entry, body);
    return { outcome: "created", pageId };
  }

  const [link] = await db
    .select()
    .from(schema.builderEntries)
    .where(and(eq(schema.builderEntries.ownerEmail, ownerEmail), eq(schema.builderEntries.pageId, pageId)));
  if (link && body === link.baseline) {
    await db.update(schema.pages).set({ title }).where(eq(schema.pages.id, pageId));
    await saveLink(ownerEmail, pageId, model, entry, body);
    return { outcome: "unchanged", pageId };
  }
  if (body === page.body) {
    // Builder now publishes the text Afterbrand holds.
    await saveLink(ownerEmail, pageId, model, entry, body);
    return { outcome: "updated", pageId };
  }
  const live = await db
    .select({ id: schema.changes.id })
    .from(schema.changes)
    .where(and(eq(schema.changes.ownerEmail, ownerEmail), eq(schema.changes.pageId, pageId), isNull(schema.changes.revertedAt)))
    .limit(1);
  if (live.length > 0) return { outcome: "kept", pageId };
  await db
    .update(schema.pages)
    .set({ title, body, contentHash: sha256(body), snapshotDate })
    .where(eq(schema.pages.id, pageId));
  await saveLink(ownerEmail, pageId, model, entry, body);
  return { outcome: "updated", pageId };
}

export interface ImportSummary {
  created: number;
  updated: number;
  unchanged: number;
  kept: number;
  empty: number;
  newFindings: number;
  pageIds: string[];
}

// Imports entries in one transaction and scans the new or changed pages.
export async function importEntries(ownerEmail: string, model: string, entries: BuilderEntry[]): Promise<ImportSummary> {
  return getDb().transaction(async (tx) => {
    const summary: ImportSummary = { created: 0, updated: 0, unchanged: 0, kept: 0, empty: 0, newFindings: 0, pageIds: [] };
    const scan: string[] = [];
    for (const entry of entries) {
      const { outcome, pageId } = await upsertEntryPage(ownerEmail, model, entry);
      summary[outcome]++;
      if (pageId) summary.pageIds.push(pageId);
      if (pageId && (outcome === "created" || outcome === "updated")) scan.push(pageId);
    }
    const rules = await loadEnabledRules(ownerEmail);
    if (scan.length > 0 && rules.length > 0) {
      const pages = await tx
        .select()
        .from(schema.pages)
        .where(and(eq(schema.pages.ownerEmail, ownerEmail), inArray(schema.pages.id, scan)));
      for (const page of pages) summary.newFindings += (await syncPageFindings(ownerEmail, page, rules)).created;
    }
    return summary;
  });
}

export interface PreparedEdit {
  page: Page;
  link: Link;
  entry: BuilderEntry;
  data: unknown;
}

// Reads every Builder page about to be published and builds its new entry
// data, before anything is written: a page that changed in Builder since its
// import, or whose new text cannot be placed, stops the publish here.
export async function prepareBuilderEdits(ownerEmail: string, pages: Page[]) {
  const ids = pages.map((page) => page.id);
  const links =
    ids.length === 0
      ? []
      : await getDb()
          .select()
          .from(schema.builderEntries)
          .where(and(eq(schema.builderEntries.ownerEmail, ownerEmail), inArray(schema.builderEntries.pageId, ids)));
  if (links.length === 0) return { edits: [] as PreparedEdit[], privateKey: null, alreadyLive: [] as Page[] };
  const { publicKey, privateKey } = await builderKeys();
  if (!publicKey || !privateKey) {
    fail("Some of these pages came from Builder. Add the Builder space's public and private API keys in Settings, then publish again. Nothing was published.");
  }
  const edits: PreparedEdit[] = [];
  const alreadyLive: Page[] = [];
  for (const link of links) {
    const page = pages.find((p) => p.id === link.pageId) as Page;
    const entry = await getEntry(publicKey, link.model, link.entryId);
    if (!entry) fail(`"${page.title}" is no longer published in Builder. Nothing was published.`);
    const live = entryText(entry.data ?? {}).lines.join("\n");
    if (live === page.body) {
      alreadyLive.push(page);
      continue;
    }
    if (live !== link.baseline) {
      fail(`"${page.title}" changed in Builder since it was imported. Undo its changes here, import it again and accept them again. Nothing was published.`);
    }
    try {
      edits.push({ page, link, entry, data: rewriteEntryData(entry.data ?? {}, page.body.split("\n")) });
    } catch (error) {
      fail(`"${page.title}": ${error instanceof Error ? error.message : "its new text could not be placed."} Nothing was published.`);
    }
  }
  return { edits, privateKey, alreadyLive };
}

export async function writeBuilderEdits(privateKey: string | null, edits: PreparedEdit[]) {
  let saved = 0;
  for (const edit of edits) {
    try {
      await saveUnpublishedEdit(privateKey as string, edit.link.model, edit.entry, edit.data);
      saved++;
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Builder did not save it.";
      const before = saved > 0 ? ` ${saved} of ${edits.length} pages were already saved in Builder; publishing again saves the same edits.` : "";
      fail(`${reason}${before} Nothing was locked here.`);
    }
  }
}

const hashToken = (token: string) => sha256(`afterbrand-builder-hook:${token}`);

// One webhook link per model; a new link replaces the old one. The token is
// shown once and only its hash is kept.
export async function createHook(ownerEmail: string, model: string): Promise<string> {
  const token = randomBytes(24).toString("base64url");
  const db = getDb();
  await db
    .delete(schema.builderHooks)
    .where(and(eq(schema.builderHooks.ownerEmail, ownerEmail), eq(schema.builderHooks.model, model)));
  const now = nowIso();
  await db.insert(schema.builderHooks).values({
    id: stableId("hk", ownerEmail, model, now),
    ownerEmail,
    model,
    tokenHash: hashToken(token),
    createdAt: now,
  });
  return `/api/builder-webhook/${token}`;
}

export async function findHook(token: string) {
  const [hook] = await getDb()
    .select()
    .from(schema.builderHooks)
    .where(eq(schema.builderHooks.tokenHash, hashToken(token)))
    .limit(1);
  return hook ?? null;
}

export async function touchHook(hookId: string, ownerEmail: string) {
  await getDb()
    .update(schema.builderHooks)
    .set({ lastCalledAt: nowIso() })
    .where(and(eq(schema.builderHooks.ownerEmail, ownerEmail), eq(schema.builderHooks.id, hookId)));
}
