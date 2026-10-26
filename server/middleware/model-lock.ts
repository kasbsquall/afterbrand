import { createError, defineEventHandler, getRequestURL } from "h3";

// The client can name any model in a chat request and the framework honours
// it. A public deploy pays for every run, so only the model the eval measured
// and the cheaper Haiku are accepted; anything else is refused before it runs.
const ALLOWED_MODELS = new Set(["claude-sonnet-5-5", "claude-haiku-5-5"]);
const ALLOWED_ENGINES = new Set(["anthropic"]);

export default defineEventHandler(async (event) => {
  if (event.method !== "POST") return;
  if (!getRequestURL(event).pathname.includes("/_agent-native/agent-chat")) return;
  // Read a clone: the chat handler still needs the original body.
  const body = (await event.req
    .clone()
    .json()
    .catch(() => undefined)) as { model?: unknown; engine?: unknown } | undefined;
  if (!body || typeof body !== "object") return;
  const { model, engine } = body;
  if (model !== undefined && model !== "" && !ALLOWED_MODELS.has(String(model))) {
    throw createError({ statusCode: 400, statusMessage: "This deployment only runs Claude Sonnet 5.5 or Claude Haiku 5.5." });
  }
  if (engine !== undefined && engine !== "" && !ALLOWED_ENGINES.has(String(engine))) {
    throw createError({ statusCode: 400, statusMessage: "This deployment only runs the Anthropic engine." });
  }
});
