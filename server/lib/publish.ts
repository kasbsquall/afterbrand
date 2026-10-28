import { and, desc, eq, isNull } from "drizzle-orm";
import { createHash } from "node:crypto";

import { getDb, schema } from "../db/index.js";
import { BATCH_CODE_LENGTH } from "./batch.js";

type ChangeRow = typeof schema.changes.$inferSelect;
export type PublicationRow = typeof schema.publications.$inferSelect;

export interface PublishedPage {
  url: string;
  title: string;
  body: string;
  // Saved in Builder as unpublished edits.
  savedInBuilder?: boolean;
  changes: { before: string; after: string; appliedBy: "agent" | "person" }[];
}

// The code of the accepted changes waiting to be published: a hash of each
// change and its text. A person publishes the set they saw by this code; a
// change accepted or undone in between gives another code.
export function publishSetCode(changes: readonly Pick<ChangeRow, "id" | "before" | "after">[]): string {
  const lines = changes.map((change) => JSON.stringify([change.id, change.before, change.after])).sort();
  return createHash("sha256").update(lines.join("\n")).digest("hex").slice(0, BATCH_CODE_LENGTH);
}

// Accepted changes not published or undone yet, with their finding's status.
export function loadUnpublished(ownerEmail: string) {
  return getDb()
    .select({ change: schema.changes, findingStatus: schema.findings.status })
    .from(schema.changes)
    .innerJoin(schema.findings, eq(schema.changes.findingId, schema.findings.id))
    .where(
      and(
        eq(schema.changes.ownerEmail, ownerEmail),
        isNull(schema.changes.revertedAt),
        isNull(schema.changes.publishedAt),
      ),
    );
}

export async function findPublication(ownerEmail: string, id?: string): Promise<PublicationRow | undefined> {
  const [row] = await getDb()
    .select()
    .from(schema.publications)
    .where(and(eq(schema.publications.ownerEmail, ownerEmail), id ? eq(schema.publications.id, id) : undefined))
    .orderBy(desc(schema.publications.publishedAt))
    .limit(1);
  return row;
}

const count = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

// What a person downloads: each page with its changes, then its updated text.
export function publicationMarkdown(publication: Pick<PublicationRow, "publishedAt" | "changes" | "pages">, pages: PublishedPage[]): string {
  const when = `${publication.publishedAt.slice(0, 16).replace("T", " ")} UTC`;
  const out = [
    `# Afterbrand publish, ${when}`,
    "",
    `${count(publication.changes, "change")} on ${count(publication.pages, "page")}. Each page lists its changes, then its full updated text.`,
  ];
  for (const page of pages) {
    out.push("", "---", "", `## ${page.title}`, "", page.url);
    if (page.savedInBuilder) out.push("", "Saved in Builder as unpublished edits. It goes live when someone publishes it in Builder.");
    out.push("", "### Changes", "");
    page.changes.forEach((change, i) => {
      out.push(`${i + 1}. Before: ${change.before}`, `   After: ${change.after}`, `   Applied by: ${change.appliedBy}`);
    });
    out.push("", "### Updated text", "", page.body.split("\n").join("\n\n"));
  }
  return `${out.join("\n")}\n`;
}
