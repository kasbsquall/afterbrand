// Small database helper for the eval runner, against the eval database only.
//   reset {ids}  clears decisions so a repeat starts from nothing
//   read  {ids}  prints the saved decisions as JSON
import { and, eq, inArray } from "drizzle-orm";

import { getDb, schema } from "../server/db/index.js";

async function main() {
  if (!process.env.DATABASE_URL?.includes("pglite-eval")) throw new Error("db-tool only runs on the eval database.");
  const ownerEmail = process.env.AGENT_USER_EMAIL;
  if (!ownerEmail) throw new Error("Set AGENT_USER_EMAIL.");
  const [command, raw] = process.argv.slice(2);
  const { ids } = JSON.parse(raw) as { ids: string[] };
  const where = and(eq(schema.findings.ownerEmail, ownerEmail), inArray(schema.findings.id, ids));
  const db = getDb();
  if (command === "reset") {
    await db
      .update(schema.findings)
      .set({ decision: null, reason: null, proposal: null, decidedBy: null, status: "pending" })
      .where(where);
  } else if (command === "read") {
    const rows = await db
      .select({ id: schema.findings.id, decision: schema.findings.decision, reason: schema.findings.reason, proposal: schema.findings.proposal })
      .from(schema.findings)
      .where(where);
    process.stdout.write(
      "\n" +
        JSON.stringify(rows.map((r) => ({ id: r.id, decision: r.decision, reason: r.reason, hasProposal: Boolean(r.proposal) }))),
    );
  } else {
    throw new Error(`Unknown command ${command}`);
  }
  process.exit(0);
}

void main();
