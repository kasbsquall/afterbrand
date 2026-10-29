import { afterEach, describe, expect, it, vi } from "vitest";

import { listEntries, publishedEntry } from "./builder-api.js";

const entry = (n: number) => ({ id: `e${n}`, name: `Entry ${n}`, published: "published", data: { blocks: [] } });

// A stand-in for the content API of a space that refuses any list of more than
// one entry, as a free space did in October 2026.
function oneAtATime(total: number) {
  return vi.fn(async (input: URL | string) => {
    const url = new URL(String(input));
    const limit = Number(url.searchParams.get("limit"));
    const offset = Number(url.searchParams.get("offset"));
    if (limit > 1) return new Response(JSON.stringify({ status: 401, code: "e892" }), { status: 401 });
    const results = offset < total ? [entry(offset)] : [];
    return new Response(JSON.stringify({ results }), { status: 200 });
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("listing a model's entries", () => {
  it("reads them one at a time when Builder refuses a longer list", async () => {
    vi.stubGlobal("fetch", oneAtATime(3));
    const entries = await listEntries("public-key", "page", 100);
    expect(entries.map((e) => e.id)).toEqual(["e0", "e1", "e2"]);
  });

  it("still reports a refused key when one entry is refused too", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 401 })));
    await expect(listEntries("wrong-key", "page", 100)).rejects.toThrow(/refused the key/);
  });
});

const EL = "@builder.io/sdk:Element";
const textBlock = (html: string) => ({ "@type": EL, id: "t1", component: { name: "Text", options: { text: html } } });

describe("reading the entry a webhook announced", () => {
  it("reads the entry back from the content API when the webhook body has no text blocks", async () => {
    // A live space sent the published entry without its blocks (October 2026).
    const sent = { id: "abc123", name: "Launch notes", published: "published", data: { title: "Launch notes" } };
    const full = { ...sent, data: { blocks: [textBlock("<p>Teams moved to Fusion in March.</p>")] } };
    const fetch = vi.fn(async (input: URL | string) => {
      expect(new URL(String(input)).searchParams.get("query.id")).toBe("abc123");
      return new Response(JSON.stringify({ results: [full] }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetch);
    expect(await publishedEntry("public-key", "page", sent)).toEqual(full);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("uses the webhook body as it is when it already carries text", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const sent = { id: "abc123", published: "published", data: { blocks: [textBlock("<p>Fusion is here.</p>")] } };
    expect(await publishedEntry("public-key", "page", sent)).toEqual(sent);
    expect(fetch).not.toHaveBeenCalled();
  });
});
