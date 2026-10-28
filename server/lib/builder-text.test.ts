import { describe, expect, it } from "vitest";

import { diffRegions, entryText, htmlToText, paragraphSpans, rewriteEntryData, textBlocks } from "./builder-text.js";

const EL = "@builder.io/sdk:Element";
const text = (id: string, html: string) => ({ "@type": EL, id, component: { name: "Text", options: { text: html } } });

// Shaped like a Builder entry's data: Text blocks at the top and nested, plus a
// block that is not text.
const data = {
  title: "Ship with Fusion",
  blocks: [
    text("b1", '<h2>Ship with Fusion</h2><p>Fusion lets designers <a href="https://example.test/fusion">try Fusion</a> today.</p>'),
    { "@type": EL, id: "b2", children: [text("b3", "<p>Plain &amp; simple: Fusion&nbsp;works.</p><ul><li>One</li><li>Two <b>Fusion</b></li></ul>")] },
    { "@type": EL, id: "b4", component: { name: "Image", options: { image: "https://example.test/a.png" } } },
  ],
};

const lines = ["Ship with Fusion", "Fusion lets designers try Fusion today.", "Plain & simple: Fusion works.", "One", "Two Fusion"];

describe("reading an entry", () => {
  it("reads one line per paragraph, in order, without tags or entities", () => {
    expect(entryText(data).lines).toEqual(lines);
  });

  it("decodes entities and reads a line break as a space", () => {
    expect(htmlToText("a&amp;b &#39;c&#x27;<br>d  e").text).toBe("a&b 'c' d e");
  });

  it("counts a paragraph inside a quote once", () => {
    const html = "<blockquote><p>Quote</p></blockquote>";
    expect(paragraphSpans(html).map((s) => html.slice(s.start, s.end))).toEqual(["Quote"]);
  });
});

describe("diffRegions", () => {
  it("replaces whole words", () => {
    expect(diffRegions("Fusion lets designers ship.", "Builder Code lets designers ship.")).toEqual([
      { start: 0, end: 6, text: "Builder Code" },
    ]);
  });
});

describe("rewriteEntryData", () => {
  const target = lines.map((line) => line.replace(/Fusion/g, "Builder Code"));

  it("changes only the words, keeping links, bold and entities", () => {
    const out = rewriteEntryData(data, target);
    expect(textBlocks(out).map((b) => b.html)).toEqual([
      '<h2>Ship with Builder Code</h2><p>Builder Code lets designers <a href="https://example.test/fusion">try Builder Code</a> today.</p>',
      "<p>Plain &amp; simple: Builder Code&nbsp;works.</p><ul><li>One</li><li>Two <b>Builder Code</b></li></ul>",
    ]);
    expect(entryText(out).lines).toEqual(target);
    expect(textBlocks(data)[0].html).toContain("Ship with Fusion");
  });

  it("refuses a change that crosses a tag instead of guessing", () => {
    const crossing = [...lines];
    // Joins the link text to the word after the link: no edit can stay on one side.
    crossing[1] = "Fusion lets designers try Fusiontoday.";
    expect(() => rewriteEntryData(data, crossing)).toThrow(/crosses formatting/);
  });

  it("refuses when the page and the entry do not have the same paragraphs", () => {
    expect(() => rewriteEntryData(data, lines.slice(1))).toThrow(/paragraphs/);
  });
});
