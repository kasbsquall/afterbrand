import { describe, expect, it } from "vitest";

import { locateLiveChange } from "./positions.js";

const rewrite = "Try Builder Code free.";
// The same rewrite twice on one page: the second one is the live change.
const body = `${rewrite}\nSome other text.\n${rewrite}`;
const second = body.lastIndexOf(rewrite);

describe("locateLiveChange", () => {
  it("finds a change at its recorded position, not the first identical sentence", () => {
    expect(locateLiveChange(body, { after: rewrite, bodyStart: second })).toBe(second);
  });

  it("refuses when the text at the recorded position is no longer the rewrite", () => {
    const edited = body.slice(0, second) + "Try Builder Code for free.";
    expect(locateLiveChange(edited, { after: rewrite, bodyStart: second })).toBeNull();
    expect(locateLiveChange(body, { after: rewrite, bodyStart: second + 1 })).toBeNull();
  });

  it("finds a change without a recorded position only when its text appears once", () => {
    expect(locateLiveChange(`Intro.\n${rewrite}`, { after: rewrite, bodyStart: null })).toBe(7);
    expect(locateLiveChange(body, { after: rewrite, bodyStart: null })).toBeNull();
    expect(locateLiveChange("Nothing here.", { after: rewrite, bodyStart: null })).toBeNull();
  });
});
