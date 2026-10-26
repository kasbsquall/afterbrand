import { describe, expect, it } from "vitest";

import { findSentenceCandidates } from "./mentions.js";
import { assertCanApply, assertCanPublish, isAgentCaller } from "./policy.js";
import { replaceSentence, verifyRewrite } from "./rewrite.js";

const body = [
  "Fusion lets designers ship to production. We launched Fusion in 2024.",
  "Click publish to make your page live, or use Publish for scheduling.",
  "The fusion of design and code is the goal.",
].join("\n");

describe("findSentenceCandidates", () => {
  it("returns one candidate per sentence with exact offsets", () => {
    const found = findSentenceCandidates(body, "Fusion");
    expect(found.map((c) => c.sentence)).toEqual([
      "Fusion lets designers ship to production.",
      "We launched Fusion in 2024.",
      "The fusion of design and code is the goal.",
    ]);
    for (const c of found) {
      expect(body.slice(c.sentenceStart, c.sentenceStart + c.sentence.length)).toBe(c.sentence);
      for (const m of c.mentions) expect(body.slice(m.start, m.end).toLowerCase()).toBe("fusion");
    }
  });

  it("groups two mentions in the same sentence and ignores inflections", () => {
    const found = findSentenceCandidates(body, "Publish");
    expect(found).toHaveLength(1);
    expect(found[0].mentions.map((m) => m.text)).toEqual(["publish", "Publish"]);
    expect(findSentenceCandidates("Publishing and published are verbs.", "Publish")).toEqual([]);
  });

  it("matches multi-word names across whitespace", () => {
    const found = findSentenceCandidates("Try Visual  Copilot today.", "Visual Copilot");
    expect(found).toHaveLength(1);
  });
});

describe("verifyRewrite", () => {
  const sentence = "Fusion lets designers ship to production.";
  const base = { sentence, oldName: "Fusion", newName: "Builder Code", mentionOffsets: [{ start: 0, end: 6 }] };

  it("accepts a rewrite confined to the mention", () => {
    expect(verifyRewrite({ ...base, proposal: "Builder Code lets designers ship to production." }).ok).toBe(true);
  });

  it("rejects a rewrite without the new name", () => {
    const check = verifyRewrite({ ...base, proposal: "It lets designers ship to production." });
    expect(check.ok).toBe(false);
  });

  it("rejects edits far from the mention", () => {
    const long = "Fusion lets designers ship to production, and the rest of this long sentence stays as it was written.";
    const check = verifyRewrite({
      ...base,
      sentence: long,
      proposal: "Builder Code lets designers ship to production, and the rest of this long sentence stays as it was rewritten.",
    });
    expect(check.problems).toContain("The rewrite edits text far from the old name.");
  });

  it("protects URLs and inline code", () => {
    const s = "Fusion docs live at https://www.builder.io/c/docs/fusion and in `fusion.config`.";
    const check = verifyRewrite({
      ...base,
      sentence: s,
      proposal: "Builder Code docs live at https://www.builder.io/c/docs/code and in `fusion.config`.",
    });
    expect(check.ok).toBe(false);
  });
});

describe("replaceSentence", () => {
  it("replaces the sentence at its offset", () => {
    expect(replaceSentence("A. Fusion rocks. B.", 3, "Fusion rocks.", "Builder Code rocks.")).toBe(
      "A. Builder Code rocks. B.",
    );
  });

  it("fails closed when the page changed", () => {
    expect(() => replaceSentence("A. Other text. B.", 3, "Fusion rocks.", "x")).toThrow(/page changed/);
  });
});

describe("policy", () => {
  const ok = {
    decision: "change" as const,
    status: "pending" as const,
    proposal: "Builder Code lets designers ship.",
    pageReadOnly: false,
  };

  it("allows applying a pending change", () => {
    expect(() => assertCanApply(ok)).not.toThrow();
  });

  it("blocks read-only pages for every caller", () => {
    expect(() => assertCanApply({ ...ok, pageReadOnly: true })).toThrow(/read-only/);
  });

  it("refuses keep and unsure findings until someone writes a rewrite", () => {
    expect(() => assertCanApply({ ...ok, decision: "keep" })).toThrow(/marked keep/);
    expect(() => assertCanApply({ ...ok, decision: "unsure" })).toThrow(/needs a decision/);
    expect(() => assertCanApply({ ...ok, proposal: null })).toThrow(/no rewrite/);
  });

  it("refuses to apply twice", () => {
    expect(() => assertCanApply({ ...ok, status: "accepted" })).toThrow(/already accepted/);
  });

  it("publishes only accepted findings", () => {
    expect(() => assertCanPublish([])).toThrow();
    expect(() => assertCanPublish(["accepted", "pending"])).toThrow(/Only accepted/);
    expect(() => assertCanPublish(["accepted"])).not.toThrow();
  });

  it("treats tool, MCP, A2A and automation callers as agents", () => {
    expect(isAgentCaller("tool")).toBe(true);
    expect(isAgentCaller("mcp")).toBe(true);
    expect(isAgentCaller("frontend")).toBe(false);
    expect(isAgentCaller("cli")).toBe(false);
  });
});
