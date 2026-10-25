import type { ActionRunContext } from "@agent-native/core/action";
import { getRequestUserEmail } from "@agent-native/core/server";
import { createHash } from "node:crypto";

// Every Afterbrand table is private to its owner. Fail closed without one.
export function requireOwner(ctx?: ActionRunContext): string {
  const email = ctx?.userEmail ?? getRequestUserEmail();
  if (!email) throw new Error("Sign in first: Afterbrand data belongs to a user.");
  return email;
}

export function stableId(prefix: string, ...parts: string[]): string {
  return `${prefix}_${createHash("sha1").update(parts.join("\u0000")).digest("hex").slice(0, 20)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
