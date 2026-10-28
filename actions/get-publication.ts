import { defineAction, fail } from "@agent-native/core/action";
import { z } from "zod";

import { requireOwner } from "../server/lib/owner.js";
import { findPublication, publicationMarkdown, type PublishedPage } from "../server/lib/publish.js";

export default defineAction({
  description: "A publication as one Markdown file to download: each page with its changes, then its updated text.",
  schema: z.object({
    id: z.string().min(1).optional().describe("Publication id; omit for the latest"),
  }),
  http: { method: "GET" },
  readOnly: true,
  uiOnly: true,
  run: async ({ id }, ctx) => {
    const ownerEmail = requireOwner(ctx);
    const publication = await findPublication(ownerEmail, id);
    if (!publication) fail("Nothing has been published yet.");
    const pages = JSON.parse(publication.content) as PublishedPage[];
    const stamp = publication.publishedAt.slice(0, 16).replace(/[:T]/g, "-");
    return {
      fileName: `afterbrand-publish-${stamp}.md`,
      markdown: publicationMarkdown(publication, pages),
    };
  },
});
