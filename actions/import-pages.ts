import { defineAction } from "@agent-native/core/action";
import { sql } from "drizzle-orm";
import { readdir, readFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { nowIso, requireOwner, stableId } from "../server/lib/owner.js";

const SNAPSHOT_ROOT = resolve("data", "snapshots");
const BATCH = 100;

const pageLine = z.object({
  url: z.string().url(),
  title: z.string(),
  publishedAt: z.string().nullable(),
  body: z.string(),
  contentHash: z.string(),
  snapshotDate: z.string(),
});

async function latestSnapshot(): Promise<string> {
  const dirs = (await readdir(SNAPSHOT_ROOT)).filter((d) => d.startsWith("builder-blog-")).sort();
  const last = dirs[dirs.length - 1];
  if (!last) throw new Error("No snapshot found. Run scripts/fetch-snapshot.ts first.");
  return last;
}

export default defineAction({
  description:
    "Import a local content snapshot into the page library. Existing pages with the same URL are replaced. Use only when the person asks to load or refresh the library.",
  schema: z.object({
    snapshot: z
      .string()
      .regex(/^[\w.-]+$/, "Snapshot is a folder name inside data/snapshots")
      .optional()
      .describe("Snapshot folder name, for example builder-blog-2026-10-25. Defaults to the latest."),
  }),
  http: false,
  run: async ({ snapshot }, ctx) => {
    const ownerEmail = requireOwner(ctx);
    const folder = snapshot ?? (await latestSnapshot());
    const dir = resolve(SNAPSHOT_ROOT, folder);
    if (!dir.startsWith(SNAPSHOT_ROOT + sep)) throw new Error("Snapshot must be inside data/snapshots.");

    const raw = await readFile(join(dir, "pages.jsonl"), "utf8");
    const lines = raw.split("\n").filter(Boolean).map((l) => pageLine.parse(JSON.parse(l)));
    const createdAt = nowIso();
    const rows = lines
      .filter((p) => p.body.length > 0)
      .map((p) => ({
        id: stableId("pg", ownerEmail, p.url),
        ownerEmail,
        url: p.url,
        title: p.title,
        publishedAt: p.publishedAt,
        body: p.body,
        contentHash: p.contentHash,
        source: folder,
        snapshotDate: p.snapshotDate,
        createdAt,
      }));

    const db = getDb();
    for (let i = 0; i < rows.length; i += BATCH) {
      const chunk = rows.slice(i, i + BATCH);
      await db
        .insert(schema.pages)
        .values(chunk)
        .onConflictDoUpdate({
          target: schema.pages.id,
          set: {
            title: sql`excluded.title`,
            publishedAt: sql`excluded.published_at`,
            body: sql`excluded.body`,
            contentHash: sql`excluded.content_hash`,
            source: sql`excluded.source`,
            snapshotDate: sql`excluded.snapshot_date`,
          },
        });
    }
    return {
      snapshot: folder,
      imported: rows.length,
      skippedWithoutText: lines.length - rows.length,
    };
  },
});
