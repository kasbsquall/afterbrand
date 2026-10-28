import { emit } from "@agent-native/core/event-bus";
import { createError, defineEventHandler, getRouterParam } from "h3";
import { z } from "zod";

import { builderEntry } from "../../../lib/builder-api.js";
import { entryTitle, findHook, importEntries, touchHook } from "../../../lib/builder-source.js";
import { PAGE_PUBLISHED_EVENT } from "../../../lib/events.js";

// A full entry with its blocks; far above any article, far below a flood.
const MAX_BODY_BYTES = 5_000_000;

const payload = z
  .object({
    operation: z.string(),
    modelName: z.string().optional(),
    newValue: builderEntry.nullable().optional(),
  })
  .passthrough();

// Builder calls this when an entry of the hooked model is published. The
// link's token is the only credential, and the entry in the body is content to
// scan, never an instruction.
export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, "token") ?? "";
  const hook = /^[A-Za-z0-9_-]{32}$/.test(token) ? await findHook(token) : null;
  if (!hook) throw createError({ statusCode: 404, statusMessage: "Not found" });
  if (Number(event.req.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    throw createError({ statusCode: 413, statusMessage: "Payload too large" });
  }
  const parsed = payload.safeParse(await event.req.json().catch(() => null));
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: "Expected a Builder webhook payload." });
  const { operation, modelName, newValue } = parsed.data;
  await touchHook(hook.id, hook.ownerEmail);
  if (modelName && modelName !== hook.model) return { ok: true, ignored: "another model" };
  if (operation !== "publish" || !newValue) return { ok: true, ignored: operation };

  const summary = await importEntries(hook.ownerEmail, hook.model, [newValue]);
  const pageId = summary.pageIds[0];
  if (pageId && summary.created + summary.updated > 0) {
    // A failed emit never fails the import.
    try {
      emit(
        PAGE_PUBLISHED_EVENT,
        { pageId, title: entryTitle(newValue), model: hook.model, newFindings: summary.newFindings },
        { owner: hook.ownerEmail },
      );
    } catch (error) {
      console.warn(`[builder-webhook] ${PAGE_PUBLISHED_EVENT} emit failed:`, error instanceof Error ? error.message : error);
    }
  }
  return { ok: true, created: summary.created, updated: summary.updated, kept: summary.kept, newFindings: summary.newFindings };
});
