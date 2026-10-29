import { H3 } from "h3";
import { describe, expect, it } from "vitest";

import modelLock from "./model-lock";

const app = new H3()
  .use(modelLock)
  .post("/_agent-native/agent-chat", async (event) => await event.req.json());

async function send(body: Record<string, unknown>) {
  const response = await app.fetch(
    new Request("http://localhost/_agent-native/agent-chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
  return (await response.json()) as Record<string, unknown>;
}

describe("model lock", () => {
  it("runs a model it does not allow as Sonnet 5.5 instead of refusing the chat", async () => {
    // The picker sends the framework default before its catalog loads.
    const body = await send({ message: "hi", model: "gpt-6-luna", engine: "builder" });
    expect(body).toMatchObject({ message: "hi", model: "claude-sonnet-5-5", engine: "anthropic" });
  });

  it("leaves an allowed model and the rest of the request untouched", async () => {
    const body = await send({ message: "hi", model: "claude-haiku-5-5", engine: "anthropic", effort: "high" });
    expect(body).toEqual({ message: "hi", model: "claude-haiku-5-5", engine: "anthropic", effort: "high" });
  });

  it("leaves a request that names no model to the server default", async () => {
    expect(await send({ message: "hi" })).toEqual({ message: "hi" });
  });
});
