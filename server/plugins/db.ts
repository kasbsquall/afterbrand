import { runMigrations } from "@agent-native/core/db";

// Every entry carries a stable `name`; append new ones, never edit applied ones.
export default runMigrations(
  [
    {
      version: 1,
      name: "afterbrand-pages",
      sql: `CREATE TABLE IF NOT EXISTS pages (
        id TEXT PRIMARY KEY,
        owner_email TEXT NOT NULL,
        url TEXT NOT NULL,
        title TEXT NOT NULL,
        published_at TEXT,
        body TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        source TEXT NOT NULL,
        snapshot_date TEXT NOT NULL,
        read_only BOOLEAN NOT NULL DEFAULT false,
        created_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS pages_owner_url_idx ON pages (owner_email, url)`,
    },
    {
      version: 2,
      name: "afterbrand-rules",
      sql: `CREATE TABLE IF NOT EXISTS rules (
        id TEXT PRIMARY KEY,
        owner_email TEXT NOT NULL,
        old_name TEXT NOT NULL,
        new_name TEXT NOT NULL,
        effective_date TEXT,
        exceptions TEXT NOT NULL DEFAULT '',
        source_url TEXT,
        enabled BOOLEAN NOT NULL DEFAULT true,
        created_by TEXT NOT NULL CHECK (created_by IN ('person', 'agent')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
    },
    {
      version: 3,
      name: "afterbrand-findings",
      sql: `CREATE TABLE IF NOT EXISTS findings (
        id TEXT PRIMARY KEY,
        owner_email TEXT NOT NULL,
        page_id TEXT NOT NULL REFERENCES pages(id),
        rule_id TEXT NOT NULL REFERENCES rules(id),
        match_text TEXT NOT NULL,
        start_offset INTEGER NOT NULL,
        end_offset INTEGER NOT NULL,
        sentence TEXT NOT NULL,
        sentence_start INTEGER NOT NULL,
        decision TEXT CHECK (decision IN ('change', 'keep', 'unsure')),
        reason TEXT,
        proposal TEXT,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
        decided_by TEXT CHECK (decided_by IN ('agent', 'person')),
        sweep_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS findings_mention_idx ON findings (owner_email, page_id, rule_id, start_offset);
      CREATE INDEX IF NOT EXISTS findings_queue_idx ON findings (owner_email, status, decision)`,
    },
    {
      version: 4,
      name: "afterbrand-changes-sweeps",
      sql: `CREATE TABLE IF NOT EXISTS changes (
        id TEXT PRIMARY KEY,
        owner_email TEXT NOT NULL,
        finding_id TEXT NOT NULL REFERENCES findings(id),
        page_id TEXT NOT NULL REFERENCES pages(id),
        before TEXT NOT NULL,
        after TEXT NOT NULL,
        applied_by TEXT NOT NULL CHECK (applied_by IN ('agent', 'person')),
        applied_at TEXT NOT NULL,
        reverted_at TEXT
      );
      CREATE TABLE IF NOT EXISTS sweeps (
        id TEXT PRIMARY KEY,
        owner_email TEXT NOT NULL,
        rule_ids TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('running', 'done', 'failed')),
        pages_count INTEGER NOT NULL DEFAULT 0,
        findings_count INTEGER NOT NULL DEFAULT 0,
        started_at TEXT NOT NULL,
        finished_at TEXT
      )`,
    },
    {
      version: 5,
      name: "afterbrand-findings-identity-by-sentence",
      sql: `DROP INDEX IF EXISTS findings_mention_idx;
      ALTER TABLE findings ADD COLUMN IF NOT EXISTS mentions TEXT NOT NULL DEFAULT '[]';
      CREATE INDEX IF NOT EXISTS findings_page_idx ON findings (owner_email, page_id);
      ALTER TABLE changes ADD COLUMN IF NOT EXISTS published_at TEXT`,
    },
    {
      version: 6,
      name: "afterbrand-staged-batches",
      sql: `CREATE TABLE IF NOT EXISTS batches (
        id TEXT PRIMARY KEY,
        owner_email TEXT NOT NULL,
        code TEXT NOT NULL,
        digest TEXT NOT NULL,
        items TEXT NOT NULL,
        staged_by TEXT NOT NULL CHECK (staged_by IN ('agent', 'person')),
        status TEXT NOT NULL CHECK (status IN ('staged', 'applied', 'discarded')),
        created_at TEXT NOT NULL,
        closed_at TEXT
      );
      CREATE INDEX IF NOT EXISTS batches_owner_code_idx ON batches (owner_email, code)`,
    },
    {
      version: 7,
      name: "afterbrand-publications",
      sql: `CREATE TABLE IF NOT EXISTS publications (
        id TEXT PRIMARY KEY,
        owner_email TEXT NOT NULL,
        code TEXT NOT NULL,
        changes INTEGER NOT NULL,
        pages INTEGER NOT NULL,
        content TEXT NOT NULL,
        published_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS publications_owner_idx ON publications (owner_email, published_at)`,
    },
    {
      version: 8,
      name: "afterbrand-change-positions",
      sql: `ALTER TABLE changes ADD COLUMN IF NOT EXISTS body_start INTEGER`,
    },
    {
      version: 9,
      name: "afterbrand-builder-source",
      sql: `CREATE TABLE IF NOT EXISTS builder_entries (
        page_id TEXT PRIMARY KEY REFERENCES pages(id),
        owner_email TEXT NOT NULL,
        model TEXT NOT NULL,
        entry_id TEXT NOT NULL,
        baseline TEXT NOT NULL,
        builder_updated_at TEXT,
        imported_at TEXT NOT NULL,
        saved_at TEXT
      );
      CREATE UNIQUE INDEX IF NOT EXISTS builder_entries_owner_entry_idx ON builder_entries (owner_email, model, entry_id);
      CREATE TABLE IF NOT EXISTS builder_hooks (
        id TEXT PRIMARY KEY,
        owner_email TEXT NOT NULL,
        model TEXT NOT NULL,
        token_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        last_called_at TEXT
      );
      CREATE UNIQUE INDEX IF NOT EXISTS builder_hooks_token_idx ON builder_hooks (token_hash)`,
    },
  ],
  { table: "afterbrand_migrations" },
);
