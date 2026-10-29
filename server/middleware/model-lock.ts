import { defineEventHandler, getRequestURL } from "h3";

// The client can name any model in a chat request and the framework honours
// it. A public deploy pays for every run, so only the model the eval measured
// and the cheaper Haiku run. Anything else runs as Sonnet 5.5 rather than being
// refused: a fresh browser sends the framework default (gpt-6-luna) until the
// model picker loads, and a visitor who types fast would get an error.
const ALLOWED_MODELS = new Set(["claude-sonnet-5-5", "claude-haiku-5-5"]);
const LOCKED_MODEL = "claude-sonnet-5-5";
const LOCKED_ENGINE = "anthropic";

function isSet(value: unknown): boolean {
  return value !== undefined && value !== "";
}

export default defineEventHandler(async (event) => {
  if (event.method !== "POST") return;
  if (!getRequestURL(event).pathname.includes("/_agent-native/agent-chat")) return;
  // Read a clone: the chat handler still needs the original body.
  const body = (await event.req
    .clone()
    .json()
    .catch(() => undefined)) as Record<string, unknown> | undefined;
  if (!body || typeof body !== "object") return;
  const { model, engine } = body;
  const modelAllowed = !isSet(model) || ALLOWED_MODELS.has(String(model));
  const engineAllowed = !isSet(engine) || engine === LOCKED_ENGINE;
  if (modelAllowed && engineAllowed) return;
  const locked = { ...body, model: modelAllowed ? model : LOCKED_MODEL, engine: LOCKED_ENGINE };
  const headers = new Headers(event.req.headers);
  headers.delete("content-length");
  // h3 types `req` as read-only, but swapping it is how the framework itself
  // hands a handler a different request (see its generated server entry).
  (event as { req: Request }).req = new Request(event.req.url, { method: event.req.method, headers, body: JSON.stringify(locked) });
});
