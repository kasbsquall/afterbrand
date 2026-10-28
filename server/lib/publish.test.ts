import { describe, expect, it } from "vitest";

import { publicationMarkdown, publishSetCode } from "./publish.js";

const one = { id: "ch_1", before: "Fusion lets designers ship.", after: "Builder Code lets designers ship." };
const two = { id: "ch_2", before: "Try Fusion free.", after: "Try Builder Code free." };

describe("publishSetCode", () => {
  it("names the same accepted changes the same way in any order", () => {
    expect(publishSetCode([one, two])).toBe(publishSetCode([two, one]));
    expect(publishSetCode([one, two])).toMatch(/^[0-9a-f]{12}$/);
  });

  it("changes when a change is accepted or undone in between", () => {
    expect(publishSetCode([one])).not.toBe(publishSetCode([one, two]));
    expect(publishSetCode([one, { ...two, after: "Try Builder Code for free." }])).not.toBe(publishSetCode([one, two]));
  });
});

describe("publicationMarkdown", () => {
  it("lists each page with its changes, then its updated text, and no file paths", () => {
    const md = publicationMarkdown({ publishedAt: "2026-10-28T19:05:42.000Z", changes: 2, pages: 1 }, [
      {
        url: "https://www.builder.io/blog/post",
        title: "A post",
        body: "Builder Code lets designers ship.\nTry Builder Code free.",
        changes: [
          { before: one.before, after: one.after, appliedBy: "agent" },
          { before: two.before, after: two.after, appliedBy: "person" },
        ],
      },
    ]);
    expect(md).toContain("# Afterbrand publish, 2026-10-28 19:05 UTC");
    expect(md).toContain("2 changes on 1 page.");
    expect(md).toContain("1. Before: Fusion lets designers ship.\n   After: Builder Code lets designers ship.\n   Applied by: agent");
    expect(md).toContain("### Updated text\n\nBuilder Code lets designers ship.\n\nTry Builder Code free.");
    expect(md).not.toMatch(/[A-Z]:\|\/Users\//);
  });
});
