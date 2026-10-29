// Copies Afterbrand's own tables from the local demo database into a deployed
// one, so the deploy starts with the library already decided instead of paying
// the agent to decide it again. Framework tables (accounts, chats, settings,
// keys) are not copied, and neither are Builder webhooks, whose links belong to
// the local app.
// Usage: SOURCE_DATABASE_URL=pglite:./data/pglite DATABASE_URL=<target> \
//        OWNER_TO=<jury account email> pnpm exec tsx scripts/copy-demo-data.ts
// The target must already be migrated (pnpm migrate:production) and empty.
// Stop the dev server first: PGlite opens its folder for one process only.
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { schema } from "../server/db/index.js";

const CHUNK = 200;
// Parents before children, so the copy reads the same in any order of checks.
const TABLES = [
  ["rules", schema.rules],
  ["pages", schema.pages],
  ["findings", schema.findings],
  ["changes", schema.changes],
  ["batches", schema.batches],
  ["publications", schema.publications],
  ["sweeps", schema.sweeps],
  ["builder_entries", schema.builderEntries],
] as const;

type Db = ReturnType<typeof drizzlePglite<typeof schema>>;

function open(url: string): { db: Db; close: () => Promise<void> } {
  if (url.startsWith("pglite:")) {
    const client = new PGlite(url.slice("pglite:".length));
    return { db: drizzlePglite(client, { schema }), close: () => client.close() };
  }
  const client = postgres(url, { max: 1 });
  // Both drivers expose the same query builder; the cast only names it once.
  return { db: drizzlePostgres(client, { schema }) as unknown as Db, close: () => client.end() };
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Set ${name}.`);
  return value;
}

async function main(): Promise<void> {
  const sourceUrl = required("SOURCE_DATABASE_URL");
  const targetUrl = required("DATABASE_URL");
  const ownerTo = required("OWNER_TO");
  const ownerFrom = process.env.OWNER_FROM?.trim() || "dev@local.test";
  if (sourceUrl === targetUrl) throw new Error("Source and target are the same database.");

  const source = open(sourceUrl);
  const target = open(targetUrl);
  try {
    for (const [name, table] of TABLES) {
      const existing = await target.db.select().from(table).limit(1);
      if (existing.length) throw new Error(`The target already has rows in ${name}. Nothing was copied.`);
    }
    await target.db.transaction(async (tx) => {
      for (const [name, table] of TABLES) {
        const rows = (await source.db.select().from(table)).filter((row) => row.ownerEmail === ownerFrom);
        const moved = rows.map((row) => ({ ...row, ownerEmail: ownerTo }));
        for (let i = 0; i < moved.length; i += CHUNK) {
          await tx.insert(table).values(moved.slice(i, i + CHUNK) as never);
        }
        console.log(`${name}: ${moved.length}`);
      }
    });
  } finally {
    await source.close();
    await target.close();
  }
}

await main();
