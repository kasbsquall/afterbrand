import { defineAction } from "@agent-native/core/action";
import { and, asc, count, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { requireOwner } from "../server/lib/owner.js";
import { findPublication, loadUnpublished, publishSetCode } from "../server/lib/publish.js";

type DecisionCounts = { change: number; keep: number; unsure: number; undecided: number };

const emptyCounts = (): DecisionCounts => ({ change: 0, keep: 0, unsure: 0, undecided: 0 });

export default defineAction({
  description:
    "Summarize the whole rename job: pages in the library, pages with findings, findings per decision (change, keep, unsure, undecided) and per status, the decision split of pending findings, accepted changes not yet published, the pages they touch and the publishSet code that publish-changes needs, the latest publication, and the same decision counts for every page with findings, in queue order. Use it to answer how much is left.",
  schema: z.object({}),
  http: { method: "GET" },
  readOnly: true,
  run: async (_args, ctx) => {
    const ownerEmail = requireOwner(ctx);
    const db = getDb();
    const [{ pagesInLibrary }] = await db
      .select({ pagesInLibrary: count() })
      .from(schema.pages)
      .where(eq(schema.pages.ownerEmail, ownerEmail));

    const rows = await db
      .select({
        pageId: schema.pages.id,
        title: schema.pages.title,
        publishedAt: schema.pages.publishedAt,
        readOnly: schema.pages.readOnly,
        decision: schema.findings.decision,
        status: schema.findings.status,
        n: count(),
      })
      .from(schema.findings)
      .innerJoin(
        schema.pages,
        and(eq(schema.findings.pageId, schema.pages.id), eq(schema.pages.ownerEmail, ownerEmail)),
      )
      .where(eq(schema.findings.ownerEmail, ownerEmail))
      .groupBy(
        schema.pages.id,
        schema.pages.title,
        schema.pages.publishedAt,
        schema.pages.readOnly,
        schema.findings.decision,
        schema.findings.status,
      )
      .orderBy(asc(schema.pages.title));

    const totals = emptyCounts();
    // Same split, pending findings only: what is still in the queue.
    const pending = emptyCounts();
    const statuses = { pending: 0, accepted: 0, rejected: 0 };
    const pages = new Map<
      string,
      { id: string; title: string; publishedAt: string | null; readOnly: boolean; total: number; counts: DecisionCounts }
    >();
    for (const row of rows) {
      const key = row.decision ?? "undecided";
      totals[key] += row.n;
      statuses[row.status] += row.n;
      if (row.status === "pending") pending[key] += row.n;
      const page = pages.get(row.pageId) ?? {
        id: row.pageId,
        title: row.title,
        publishedAt: row.publishedAt,
        readOnly: row.readOnly,
        total: 0,
        counts: emptyCounts(),
      };
      page.counts[key] += row.n;
      page.total += row.n;
      pages.set(row.pageId, page);
    }

    const unpublished = await loadUnpublished(ownerEmail);
    const last = await findPublication(ownerEmail);

    const all = totals.change + totals.keep + totals.unsure + totals.undecided;
    return {
      pagesInLibrary,
      pagesWithFindings: pages.size,
      findings: { all, ...totals },
      statuses,
      pending,
      unpublishedChanges: unpublished.length,
      unpublishedPages: new Set(unpublished.map((row) => row.change.pageId)).size,
      // What a person sees on the publish card; publish-changes refuses any other set.
      publishSet: unpublished.length > 0 ? publishSetCode(unpublished.map((row) => row.change)) : null,
      lastPublication: last
        ? { id: last.id, code: last.code, changes: last.changes, pages: last.pages, publishedAt: last.publishedAt }
        : null,
      pages: [...pages.values()],
    };
  },
});
