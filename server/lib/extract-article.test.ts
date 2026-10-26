import { describe, expect, it } from "vitest";

import { dropBoilerplate, extractArticle, isPostUrl } from "./extract-article.js";

const html = `<html><head>
<meta property="og:title" content="Same Products, Clearer Names"/>
<script type="application/ld+json">{"datePublished":"2026-09-10T16:00:00.000Z"}</script>
</head><body>
<nav><div class="builder-text"><p>Fusion in the nav</p></div></nav>
<main><div class="article-builder-content">
  <div class="builder-text"><h2>Why</h2></div>
  <div class="builder-text"><p>Fusion is now   Builder Code.</p><ul><li>Same pricing</li></ul></div>
</div>
<section class="b-media-grid"><div class="builder-text"><p>Related post</p></div></section>
</main></body></html>`;

describe("extractArticle", () => {
  it("reads title, date and only article paragraphs", () => {
    const article = extractArticle(html);
    expect(article.title).toBe("Same Products, Clearer Names");
    expect(article.publishedAt).toBe("2026-09-10T16:00:00.000Z");
    expect(article.paragraphs).toEqual(["Why", "Fusion is now Builder Code.", "Same pricing"]);
  });

  it("reads nested blocks once, as their own paragraphs", () => {
    const nested = `<div class="article-builder-content"><div class="builder-text"><blockquote><p><strong>Same repo?</strong></p><p>Builder Fusion opens a PR.</p></blockquote></div></div>`;
    expect(extractArticle(nested).paragraphs).toEqual(["Same repo?", "Builder Fusion opens a PR."]);
  });

  it("returns no paragraphs when the article container is missing", () => {
    expect(extractArticle("<html><body><p>x</p></body></html>").paragraphs).toEqual([]);
  });
});

describe("dropBoilerplate", () => {
  it("removes paragraphs repeated across many pages", () => {
    const promo = "Design interactive prototypes for free";
    const articles = Array.from({ length: 10 }, (_, i) => ({
      title: `t${i}`,
      publishedAt: null,
      paragraphs: [`unique ${i}`, promo],
    }));
    const cleaned = dropBoilerplate(articles);
    expect(cleaned.every((a) => !a.paragraphs.includes(promo))).toBe(true);
    expect(cleaned[3].paragraphs).toEqual(["unique 3"]);
  });
});

describe("isPostUrl", () => {
  it("accepts posts and rejects listings", () => {
    expect(isPostUrl("https://www.builder.io/blog/builder-product-name-change")).toBe(true);
    expect(isPostUrl("https://www.builder.io/blog/page/22")).toBe(false);
    expect(isPostUrl("https://www.builder.io/blog/topics/agent-native")).toBe(false);
  });
});
