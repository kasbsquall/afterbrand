import { parse, type HTMLElement } from "node-html-parser";

export interface ExtractedArticle {
  title: string;
  publishedAt: string | null;
  paragraphs: string[];
}

const TEXT_TAGS = "h1, h2, h3, h4, h5, h6, p, li, blockquote";

function clean(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function readPublishedAt(root: HTMLElement): string | null {
  for (const node of root.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const data: unknown = JSON.parse(node.text);
      if (data && typeof data === "object" && "datePublished" in data) {
        const value = (data as { datePublished: unknown }).datePublished;
        if (typeof value === "string") return value;
      }
    } catch {
      // A malformed JSON-LD block is not fatal; try the next one.
    }
  }
  return null;
}

function readTitle(root: HTMLElement): string {
  const og = root.querySelector('meta[property="og:title"]')?.getAttribute("content");
  if (og) return clean(og);
  return clean(root.querySelector("h1")?.text ?? root.querySelector("title")?.text ?? "");
}

// Builder.io blog posts keep the article inside `.article-builder-content`,
// one `.builder-text` block per paragraph group. Related posts and site
// promos live outside it or are removed later by `dropBoilerplate`.
export function extractArticle(html: string): ExtractedArticle {
  const root = parse(html);
  const container = root.querySelector(".article-builder-content");
  const paragraphs: string[] = [];
  if (container) {
    for (const block of container.querySelectorAll(".builder-text")) {
      const parts = block.querySelectorAll(TEXT_TAGS);
      const texts = parts.length > 0 ? parts.map((p) => p.text) : [block.text];
      for (const text of texts) {
        const line = clean(text);
        if (line) paragraphs.push(line);
      }
    }
  }
  return { title: readTitle(root), publishedAt: readPublishedAt(root), paragraphs };
}

// Paragraphs repeated across many pages are site chrome (promos, CTAs),
// not article text. Remove any paragraph found on at least `minShare` of pages.
export function dropBoilerplate(
  articles: readonly ExtractedArticle[],
  minShare = 0.1,
): ExtractedArticle[] {
  const counts = new Map<string, number>();
  for (const article of articles) {
    for (const p of new Set(article.paragraphs)) counts.set(p, (counts.get(p) ?? 0) + 1);
  }
  const threshold = Math.max(2, Math.ceil(articles.length * minShare));
  return articles.map((article) => ({
    ...article,
    paragraphs: article.paragraphs.filter((p) => (counts.get(p) ?? 0) < threshold),
  }));
}

// Only single-segment post URLs; listing, topic and author pages are skipped.
export function isPostUrl(url: string): boolean {
  const match = /^https:\/\/www\.builder\.io\/blog\/([^/?#]+)\/?$/.exec(url);
  if (!match) return false;
  return !["page", "topics", "authors", "tags"].includes(match[1]);
}
