// Fetches Builder.io blog posts into a local, dated snapshot.
// Usage: pnpm exec tsx scripts/fetch-snapshot.ts [--limit N]
//        pnpm exec tsx scripts/fetch-snapshot.ts --snapshot builder-blog-2026-10-25
//        (re-extracts an existing snapshot from its raw cache, same URLs, no network)
// The snapshot stays in data/ (git-ignored): the blog text is Builder's, so the
// public repo only carries this script, the URL list and content hashes.
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  dropBoilerplate,
  extractArticle,
  isPostUrl,
  type ExtractedArticle,
} from "../server/lib/extract-article.js";

const SITEMAP = "https://www.builder.io/sitemap.blog.xml";
const DELAY_MS = 500;
const USER_AGENT = "AfterbrandSnapshot/0.1 (hackathon research; one request every 0.5 s)";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "user-agent": USER_AGENT } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

async function sitemapUrls(limit: number): Promise<string[]> {
  const sitemap = await fetchText(SITEMAP);
  return [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => m[1].trim())
    .filter(isPostUrl)
    .slice(0, limit);
}

// The URLs an existing snapshot already covers, so a rebuild keeps the same set.
async function snapshotUrls(dir: string): Promise<string[]> {
  const pages = (await readFile(join(dir, "pages.jsonl"), "utf8"))
    .split("\n")
    .filter(Boolean)
    .map((line) => (JSON.parse(line) as { url: string }).url);
  const failed = JSON.parse(await readFile(join(dir, "failures.json"), "utf8")) as { url: string }[];
  return [...pages, ...failed.map((f) => f.url)];
}

async function main(): Promise<void> {
  const limitArg = process.argv.indexOf("--limit");
  const limit = limitArg > 0 ? Number(process.argv[limitArg + 1]) : Infinity;
  const snapshotArg = process.argv.indexOf("--snapshot");
  const snapshot = snapshotArg > 0 ? process.argv[snapshotArg + 1] : undefined;
  if (snapshot !== undefined && !/^builder-blog-\d{4}-\d{2}-\d{2}$/.test(snapshot)) {
    throw new Error("--snapshot takes a folder name like builder-blog-2026-10-25");
  }
  const date = snapshot ? snapshot.slice("builder-blog-".length) : new Date().toISOString().slice(0, 10);
  const dir = join("data", "snapshots", snapshot ?? `builder-blog-${date}`);
  const rawDir = join(dir, "raw");
  await mkdir(rawDir, { recursive: true });

  const urls = snapshot ? await snapshotUrls(dir) : await sitemapUrls(limit);
  console.info(`[snapshot] ${urls.length} post URLs`);

  const fetched: { url: string; article: ExtractedArticle }[] = [];
  const failures: { url: string; error: string }[] = [];
  for (const [i, url] of urls.entries()) {
    const rawPath = join(rawDir, `${createHash("sha1").update(url).digest("hex")}.html`);
    try {
      let html: string;
      try {
        html = await readFile(rawPath, "utf8");
      } catch {
        html = await fetchText(url);
        await writeFile(rawPath, html);
        await sleep(DELAY_MS);
      }
      fetched.push({ url, article: extractArticle(html) });
    } catch (err) {
      failures.push({ url, error: err instanceof Error ? err.message : String(err) });
    }
    if ((i + 1) % 50 === 0) console.info(`[snapshot] ${i + 1}/${urls.length}`);
  }

  const cleaned = dropBoilerplate(fetched.map((f) => f.article));
  const lines = fetched.map(({ url }, i) => {
    const article = cleaned[i];
    const body = article.paragraphs.join("\n");
    return JSON.stringify({
      url,
      title: article.title,
      publishedAt: article.publishedAt,
      body,
      contentHash: createHash("sha256").update(body).digest("hex"),
      snapshotDate: date,
    });
  });
  await writeFile(join(dir, "pages.jsonl"), lines.join("\n") + "\n");
  await writeFile(join(dir, "failures.json"), JSON.stringify(failures, null, 2));
  const empty = cleaned.filter((a) => a.paragraphs.length === 0).length;
  console.info(
    `[snapshot] wrote ${lines.length} pages to ${dir} (${empty} with no article text, ${failures.length} failed)`,
  );
}

main().catch((err) => {
  console.error("[snapshot] failed:", err);
  process.exitCode = 1;
});
