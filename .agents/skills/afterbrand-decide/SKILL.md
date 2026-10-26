---
name: afterbrand-decide
description: >-
  How to decide a finding: whether a sentence that mentions a retired product
  name should change, be kept, or go to a person, and how to write the rewrite.
  Read before calling record-decisions.
scope: runtime
---

# Deciding a finding

A finding is one sentence on one page that mentions a retired name. Decide it from the sentence, the page (title and publish date) and the rule (new name, effective date, exceptions). The rule's exceptions are the team's own instructions and win over this guide.

## change

The sentence uses the retired name for the product as it exists today, so a reader in the present would see the old name.

- "Fusion lets designers ship to production." -> "Builder Code lets designers ship to production."
- A how-to or product description, even in an older post, if it describes how the product works now.
- A sentence that mixes history and present ("Since we launched Fusion in 2024, it has become the way teams ship"): the present clause names the current product, so it changes.

## keep

The old name is correct where it is.

- **Historical.** The sentence describes something that happened before the effective date: a launch, an announcement, a past event ("We launched Fusion in 2024", "last week we released Fusion 1.0" in a post dated before the rename).
- **Dated changelogs and release notes.** They record what shipped under the name of the time.
- **Not text.** URLs, slugs, file names, code identifiers, command names, quoted UI labels.
- **Contracts, invoices, pricing records**, when the rule says references to the old name stay valid.
- **Common word.** The word is not the product: "the fusion of design and code", "click publish", "publish your page", "publishing workflow".
- **Someone else's product** with the same word.

## unsure

You cannot tell from the sentence and the page. Examples: a heading with no verb ("Fusion"), a sentence that could be historical or current, a capitalized "Publish" at the start of a sentence that may be the verb. Say what is missing in the reason. A person decides.

## The rewrite (only for change)

- Return the full sentence with the new name in place of the old one. Change nothing else, except what grammar strictly needs nearby (an article, a verb ending, a possessive).
- Keep capitalization and punctuation. Keep "Builder.io" prefixes as the source wrote them ("Builder.io Fusion" -> "Builder.io Builder Code" reads badly: prefer "Builder Code" and say so in the reason).
- Never touch URLs, code or quoted strings in the same sentence.
- The app checks every rewrite. A rewrite that edits text far from the name, drops the new name or changes a URL is refused and comes back to you; fix it and resend that finding.

## The reason

One line a reviewer can check in a second: "Historical: describes the 2024 launch", "Current: product how-to", "Verb, not the product", "Heading without context".

## Working through many findings

List undecided findings with list-findings (decision "undecided"), decide them in batches of up to 50 with record-decisions, and repeat until none are left or the person stops you. Report "decided N of M" at the end, with how many were change, keep and unsure.
