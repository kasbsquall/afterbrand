// The text a Builder entry shows, read from its Text blocks, and the edit that
// makes that text read as new text while leaving links, bold and every other
// tag where they were. Pure: no network, no database.

const TEXT_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6", "p", "li", "blockquote"]);
const NAMED: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const ELEMENT = "@builder.io/sdk:Element";

// A paragraph's plain text, with the HTML span each character came from.
export interface MappedText {
  text: string;
  starts: number[];
  ends: number[];
}

function decodeEntity(entity: string): string | null {
  const body = entity.slice(1, -1);
  if (body[0] === "#") {
    const code = body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
    return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : null;
  }
  return NAMED[body.toLowerCase()] ?? null;
}

// Tags dropped, entities decoded, whitespace (and <br>) collapsed to one
// space, ends trimmed: the same reading for import and for write-back.
export function htmlToText(html: string, from = 0, to = html.length): MappedText {
  const raw: { ch: string; s: number; e: number }[] = [];
  let i = from;
  while (i < to) {
    if (html.startsWith("<!--", i)) {
      const close = html.indexOf("-->", i + 4);
      i = close === -1 || close + 3 > to ? to : close + 3;
      continue;
    }
    if (html[i] === "<") {
      const close = html.indexOf(">", i);
      const end = close === -1 || close >= to ? to : close + 1;
      if (/^<br\b/i.test(html.slice(i, end))) raw.push({ ch: " ", s: i, e: end });
      i = end;
      continue;
    }
    if (html[i] === "&") {
      const entity = /^&(?:#x[0-9a-f]+|#\d+|[a-z]+);/i.exec(html.slice(i, Math.min(to, i + 12)))?.[0];
      const decoded = entity ? decodeEntity(entity) : null;
      if (entity && decoded !== null) {
        raw.push({ ch: decoded, s: i, e: i + entity.length });
        i += entity.length;
        continue;
      }
    }
    raw.push({ ch: html[i], s: i, e: i + 1 });
    i++;
  }

  const out: MappedText = { text: "", starts: [], ends: [] };
  let space: { s: number; e: number } | null = null;
  for (const r of raw) {
    if (/\s/.test(r.ch)) {
      space = space ? { s: space.s, e: r.e } : { s: r.s, e: r.e };
      continue;
    }
    if (space && out.text.length > 0) {
      out.text += " ";
      out.starts.push(space.s);
      out.ends.push(space.e);
    }
    space = null;
    out.text += r.ch;
    out.starts.push(r.s);
    out.ends.push(r.e);
  }
  return out;
}

// Inner HTML spans of the innermost paragraph-like elements, in order. A block
// with none of them reads as one paragraph, like the blog scraper does.
export function paragraphSpans(html: string): { start: number; end: number }[] {
  const tag = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g;
  const stack: { name: string; start: number; nested: boolean }[] = [];
  const found: { start: number; end: number }[] = [];
  let sawTextTag = false;
  for (const m of html.matchAll(tag)) {
    const name = m[2]?.toLowerCase();
    if (!name || !TEXT_TAGS.has(name)) continue;
    sawTextTag = true;
    const index = m.index ?? 0;
    if (m[1] !== "/") {
      for (const open of stack) open.nested = true;
      stack.push({ name, start: index + m[0].length, nested: false });
      continue;
    }
    const at = stack.map((s) => s.name).lastIndexOf(name);
    if (at === -1) continue;
    const [open] = stack.splice(at);
    if (!open.nested) found.push({ start: open.start, end: index });
  }
  for (const open of stack) if (!open.nested) found.push({ start: open.start, end: html.length });
  if (!sawTextTag) return [{ start: 0, end: html.length }];
  return found.sort((a, b) => a.start - b.start);
}

type Path = (string | number)[];

// Every Text block's HTML in reading order, with the path to its text option.
export function textBlocks(data: unknown): { path: Path; html: string }[] {
  const out: { path: Path; html: string }[] = [];
  const walk = (value: unknown, path: Path) => {
    if (Array.isArray(value)) {
      value.forEach((item, i) => walk(item, [...path, i]));
      return;
    }
    if (!value || typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    const component = record.component as { name?: unknown; options?: { text?: unknown } } | undefined;
    if (record["@type"] === ELEMENT && component?.name === "Text" && typeof component.options?.text === "string") {
      out.push({ path: [...path, "component", "options", "text"], html: component.options.text });
    }
    for (const [key, child] of Object.entries(record)) walk(child, [...path, key]);
  };
  walk(data, []);
  return out;
}

export interface EntryText {
  lines: string[];
  spans: { block: number; mapped: MappedText }[];
}

// One line per paragraph, which is how a page body is stored.
export function entryText(data: unknown): EntryText {
  const lines: string[] = [];
  const spans: EntryText["spans"] = [];
  textBlocks(data).forEach(({ html }, block) => {
    for (const { start, end } of paragraphSpans(html)) {
      const mapped = htmlToText(html, start, end);
      if (!mapped.text) continue;
      lines.push(mapped.text);
      spans.push({ block, mapped });
    }
  });
  return { lines, spans };
}

// Replace a[start, end) with text. Regions are in order and do not overlap.
export interface Region {
  start: number;
  end: number;
  text: string;
}

const TOKEN = /\s+|[\p{L}\p{N}'’_-]+|[^\s\p{L}\p{N}]/gu;
const MAX_DIFF_CELLS = 4_000_000;

function tokenize(s: string) {
  return [...s.matchAll(TOKEN)].map((m) => ({ t: m[0], s: m.index ?? 0 }));
}

// Word-level difference between two lines, so "Fusion" becomes "Builder
// Code" as one replacement instead of scattered letters.
export function diffRegions(a: string, b: string): Region[] {
  if (a === b) return [];
  const x = tokenize(a);
  const y = tokenize(b);
  const n = x.length;
  const m = y.length;
  if ((n + 1) * (m + 1) > MAX_DIFF_CELLS) {
    let pre = 0;
    while (pre < a.length && pre < b.length && a[pre] === b[pre]) pre++;
    let suf = 0;
    while (suf < a.length - pre && suf < b.length - pre && a[a.length - 1 - suf] === b[b.length - 1 - suf]) suf++;
    return [{ start: pre, end: a.length - suf, text: b.slice(pre, b.length - suf) }];
  }
  const w = m + 1;
  const lcs = new Int32Array((n + 1) * w);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i * w + j] = x[i].t === y[j].t ? lcs[(i + 1) * w + j + 1] + 1 : Math.max(lcs[(i + 1) * w + j], lcs[i * w + j + 1]);
    }
  }
  const regions: Region[] = [];
  let open: Region | null = null;
  const at = (i: number) => (i < n ? x[i].s : a.length);
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && x[i].t === y[j].t) {
      if (open) regions.push(open);
      open = null;
      i++;
      j++;
    } else if (j < m && (i === n || lcs[i * w + j + 1] >= lcs[(i + 1) * w + j])) {
      open ??= { start: at(i), end: at(i), text: "" };
      open.text += y[j].t;
      j++;
    } else {
      open ??= { start: at(i), end: at(i), text: "" };
      open.end = at(i) + x[i].t.length;
      i++;
    }
  }
  if (open) regions.push(open);
  return regions;
}

const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function setAt(target: unknown, path: Path, value: string) {
  let node = target as Record<string | number, unknown>;
  for (const key of path.slice(0, -1)) node = node[key] as Record<string | number, unknown>;
  node[path[path.length - 1]] = value;
}

// A copy of `data` whose Text blocks read as `target`, line for line. Only the
// words that differ are replaced inside the HTML; a change that would cross a
// tag (half inside a link, say) is refused rather than guessed.
export function rewriteEntryData<T>(data: T, target: readonly string[]): T {
  const { lines, spans } = entryText(data);
  if (target.length !== lines.length) {
    throw new Error(`The entry has ${lines.length} paragraphs and the page has ${target.length}.`);
  }
  const blocks = textBlocks(data);
  const edits = new Map<number, { s: number; e: number; html: string }[]>();
  lines.forEach((line, k) => {
    if (line === target[k]) return;
    const { block, mapped } = spans[k];
    const html = blocks[block].html;
    for (const region of diffRegions(line, target[k])) {
      let s: number;
      let e: number;
      if (region.end > region.start) {
        s = mapped.starts[region.start];
        e = mapped.ends[region.end - 1];
      } else {
        s = e = region.start > 0 ? mapped.ends[region.start - 1] : mapped.starts[0];
      }
      if (html.slice(s, e).includes("<")) {
        throw new Error(`A change in "${line.slice(0, 60)}" crosses formatting; edit it in Builder.`);
      }
      const list = edits.get(block) ?? [];
      list.push({ s, e, html: escapeHtml(region.text) });
      edits.set(block, list);
    }
  });

  const copy = structuredClone(data);
  for (const [block, list] of edits) {
    let html = blocks[block].html;
    const ordered = [...list].sort((p, q) => q.s - p.s);
    ordered.forEach((edit, k) => {
      if (k > 0 && edit.e > ordered[k - 1].s) throw new Error("Two changes overlap in one block.");
      html = html.slice(0, edit.s) + edit.html + html.slice(edit.e);
    });
    setAt(copy, blocks[block].path, html);
  }
  const check = entryText(copy).lines;
  if (check.length !== target.length || check.some((line, k) => line !== target[k])) {
    throw new Error("The new text could not be placed in this entry without changing its formatting.");
  }
  return copy;
}
