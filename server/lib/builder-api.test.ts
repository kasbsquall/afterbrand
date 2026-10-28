import { afterEach, describe, expect, it, vi } from "vitest";

import { listEntries } from "./builder-api.js";

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
