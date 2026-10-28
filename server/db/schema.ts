import { boolean, integer, pgTable, text, uniqueIndex, index } from "drizzle-orm/pg-core";

// A page of the content library. `body` is the article text only (no nav,
// footer or site promos), one paragraph per line, so offsets are stable.
export const pages = pgTable(
  "pages",
  {
    id: text("id").primaryKey(),
    ownerEmail: text("owner_email").notNull(),
    url: text("url").notNull(),
    title: text("title").notNull(),
    publishedAt: text("published_at"),
    body: text("body").notNull(),
    contentHash: text("content_hash").notNull(),
    source: text("source").notNull(),
    snapshotDate: text("snapshot_date").notNull(),
    readOnly: boolean("read_only").notNull().default(false),
    createdAt: text("created_at").notNull(),
  },
  (t) => ({
    ownerUrl: uniqueIndex("pages_owner_url_idx").on(t.ownerEmail, t.url),
  }),
);

// One retired name and what replaces it. `exceptions` is plain language the
// agent applies when it decides a mention; people and the agent both edit it.
export const rules = pgTable("rules", {
  id: text("id").primaryKey(),
  ownerEmail: text("owner_email").notNull(),
  oldName: text("old_name").notNull(),
  newName: text("new_name").notNull(),
  effectiveDate: text("effective_date"),
  exceptions: text("exceptions").notNull().default(""),
  sourceUrl: text("source_url"),
  enabled: boolean("enabled").notNull().default(true),
  createdBy: text("created_by", { enum: ["person", "agent"] }).notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// One mention of a retired name on a page, and what to do with it.
export const findings = pgTable(
  "findings",
  {
    id: text("id").primaryKey(),
    ownerEmail: text("owner_email").notNull(),
    pageId: text("page_id")
      .notNull()
      .references(() => pages.id),
    ruleId: text("rule_id")
      .notNull()
      .references(() => rules.id),
    matchText: text("match_text").notNull(),
    startOffset: integer("start_offset").notNull(),
    endOffset: integer("end_offset").notNull(),
    sentence: text("sentence").notNull(),
    sentenceStart: integer("sentence_start").notNull(),
    // JSON array of { start, end } relative to the sentence.
    mentions: text("mentions").notNull().default("[]"),
    decision: text("decision", { enum: ["change", "keep", "unsure"] }),
    reason: text("reason"),
    proposal: text("proposal"),
    status: text("status", { enum: ["pending", "accepted", "rejected"] })
      .notNull()
      .default("pending"),
    decidedBy: text("decided_by", { enum: ["agent", "person"] }),
    sweepId: text("sweep_id"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => ({
    page: index("findings_page_idx").on(t.ownerEmail, t.pageId),
    queue: index("findings_queue_idx").on(t.ownerEmail, t.status, t.decision),
  }),
);

// A rewrite that was applied to a page body, kept so it can be undone.
export const changes = pgTable("changes", {
  id: text("id").primaryKey(),
  ownerEmail: text("owner_email").notNull(),
  findingId: text("finding_id")
    .notNull()
    .references(() => findings.id),
  pageId: text("page_id")
    .notNull()
    .references(() => pages.id),
  before: text("before").notNull(),
  after: text("after").notNull(),
  appliedBy: text("applied_by", { enum: ["agent", "person"] }).notNull(),
  appliedAt: text("applied_at").notNull(),
  revertedAt: text("reverted_at"),
  publishedAt: text("published_at"),
});

// Changes the agent staged for a person to review as one unit. `code` is the
// start of `digest`, the hash of every staged sentence and rewrite; applying
// recomputes it, so an approval never runs on a set that differs from the one
// on screen. `items` is the JSON snapshot the screen shows.
export const batches = pgTable(
  "batches",
  {
    id: text("id").primaryKey(),
    ownerEmail: text("owner_email").notNull(),
    code: text("code").notNull(),
    digest: text("digest").notNull(),
    items: text("items").notNull(),
    stagedBy: text("staged_by", { enum: ["agent", "person"] }).notNull(),
    status: text("status", { enum: ["staged", "applied", "discarded"] }).notNull(),
    createdAt: text("created_at").notNull(),
    closedAt: text("closed_at"),
  },
  (t) => ({
    ownerCode: index("batches_owner_code_idx").on(t.ownerEmail, t.code),
  }),
);

export const sweeps = pgTable("sweeps", {
  id: text("id").primaryKey(),
  ownerEmail: text("owner_email").notNull(),
  ruleIds: text("rule_ids").notNull(), // JSON array
  status: text("status", { enum: ["running", "done", "failed"] }).notNull(),
  pagesCount: integer("pages_count").notNull().default(0),
  findingsCount: integer("findings_count").notNull().default(0),
  startedAt: text("started_at").notNull(),
  finishedAt: text("finished_at"),
});
