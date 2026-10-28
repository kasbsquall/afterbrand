import { describe, expect, it } from "vitest";

import { BATCH_CODE_LENGTH, batchDigest, batchItems } from "./batch.js";
import type { FindingWithContext } from "./findings-read.js";

const a = { findingId: "f_a", before: "Fusion lets designers ship.", after: "Builder Code lets designers ship." };
const b = { findingId: "f_b", before: "Try Fusion free.", after: "Try Builder Code free." };

function row(id: string, pageTitle: string, sentenceStart: number, sentence: string, proposal: string) {
  return {
    finding: { id, sentence, sentenceStart, proposal, mentions: "[]" },
    page: { id: `p_${pageTitle}`, title: pageTitle },
    rule: { oldName: "Fusion", newName: "Builder Code" },
  } as unknown as FindingWithContext;
}

describe("batchDigest", () => {
  it("names the same set the same way in any order", () => {
    expect(batchDigest([a, b])).toBe(batchDigest([b, a]));
    expect(batchDigest([a, b])).toMatch(/^[0-9a-f]{64}$/);
    expect(batchDigest([a, b]).slice(0, BATCH_CODE_LENGTH)).toMatch(/^[0-9a-f]{12}$/);
  });

  it("changes when a rewrite, a sentence or the set changes", () => {
    const digest = batchDigest([a, b]);
    expect(batchDigest([a, { ...b, after: "Try Builder Code for free." }])).not.toBe(digest);
    expect(batchDigest([{ ...a, before: "Fusion lets teams ship." }, b])).not.toBe(digest);
    expect(batchDigest([a])).not.toBe(digest);
    expect(batchDigest([a, { ...b, findingId: "f_c" }])).not.toBe(digest);
  });

  it("does not let text shift between fields to forge the same code", () => {
    const left = { findingId: "f_a", before: "x y", after: "z" };
    const right = { findingId: "f_a", before: "x", after: "y z" };
    expect(batchDigest([left])).not.toBe(batchDigest([right]));
  });
});

describe("batchItems", () => {
  it("lists page by page, top to bottom, with the before and after the person reviews", () => {
    const items = batchItems([
      row("f_2", "Zeta post", 40, "Fusion again.", "Builder Code again."),
      row("f_3", "Alpha post", 90, "Later Fusion.", "Later Builder Code."),
      row("f_1", "Alpha post", 10, "Early Fusion.", "Early Builder Code."),
    ]);
    expect(items.map((item) => item.findingId)).toEqual(["f_1", "f_3", "f_2"]);
    expect(items[0]).toMatchObject({ pageTitle: "Alpha post", before: "Early Fusion.", after: "Early Builder Code." });
  });
});
