// Fetches Builder.io blog posts into a local, dated snapshot.
// Usage: pnpm exec tsx scripts/fetch-snapshot.ts [--limit N]
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

async function main(): Promise<void> {
  const limitArg = process.argv.indexOf("--limit");
  const limit = limitArg > 0 ? Number(process.argv[limitArg + 1]) : Infinity;
  const date = new Date().toISOString().slice(0, 10);
  const dir = join("data", "snapshots", `builder-blog-${date}`);
  const rawDir = join(dir, "raw");
  await mkdir(rawDir, { recursive: true });

  const sitemap = await fetchText(SITEMAP);
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => m[1].trim())
    .filter(isPostUrl)
    .slice(0, limit);
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
