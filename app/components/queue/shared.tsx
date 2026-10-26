import { Check, Hand, LockSimple, Question } from "@phosphor-icons/react";
import { useCallback, useEffect, useState, type ReactNode } from "react";

export type Decision = "change" | "keep" | "unsure";
export type DecisionKey = Decision | "undecided";

export interface Mention {
  start: number;
  end: number;
}

const DECISIONS: Record<DecisionKey, { word: string; icon: ReactNode }> = {
  change: { word: "Change", icon: <Check size={13} weight="light" /> },
  keep: { word: "Keep", icon: <LockSimple size={13} weight="light" /> },
  unsure: { word: "Needs you", icon: <Hand size={13} weight="light" /> },
  undecided: { word: "Undecided", icon: <Question size={13} weight="light" /> },
};

export function decisionWord(decision: DecisionKey): string {
  return DECISIONS[decision].word;
}

export function DecisionChip({ decision }: { decision: Decision | null }) {
  const key: DecisionKey = decision ?? "undecided";
  return (
    <span className={`ab-decision ab-dec-${key}`}>
      {DECISIONS[key].icon}
      {DECISIONS[key].word}
    </span>
  );
}

// The old name is marked in its decision's colour; only a Change is struck.
export function markClass(decision: Decision | null): string {
  return decision === "change" ? "ab-strike" : `ab-${decision ?? "undecided"}`;
}

// Mentions arrive as JSON text with offsets relative to the sentence.
export function parseMentions(raw: unknown): Mention[] {
  if (Array.isArray(raw)) return raw as Mention[];
  if (typeof raw !== "string") return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? (value as Mention[]) : [];
  } catch {
    return [];
  }
}

// Wraps each mention of the old name; everything else stays plain text.
export function MarkedText({
  text,
  mentions,
  className,
}: {
  text: string;
  mentions: Mention[];
  className?: string;
}) {
  const parts: ReactNode[] = [];
  let cursor = 0;
  for (const [i, m] of [...mentions].sort((a, b) => a.start - b.start).entries()) {
    if (m.start < cursor || m.end > text.length) continue;
    parts.push(text.slice(cursor, m.start));
    parts.push(
      <mark key={i} className={className}>
        {text.slice(m.start, m.end)}
      </mark>,
    );
    cursor = m.end;
  }
  parts.push(text.slice(cursor));
  return <>{parts}</>;
}

// Highlights the new name inside the proposed sentence.
export function ProposalText({ text, newName }: { text: string; newName: string }) {
  const pieces = text.split(newName);
  return (
    <>
      {pieces.map((piece, i) => (
        <span key={i}>
          {piece}
          {i < pieces.length - 1 ? <ins>{newName}</ins> : null}
        </span>
      ))}
    </>
  );
}

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

const DAY_FORMAT = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "No date";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "No date";
  // A bare day ("2026-09-10") parses as UTC midnight; show that same day
  // instead of the previous one in time zones west of UTC.
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? DAY_FORMAT.format(date) : DATE_FORMAT.format(date);
}

// Framework errors read "Action <name> failed: <reason>"; a reviewer needs the reason.
export function errorMessage(error: unknown, fallback = "Something went wrong. Try again."): string {
  if (!(error instanceof Error) || !error.message) return fallback;
  return error.message.replace(/^Action [\w-]+ failed:\s*/, "");
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

// Micro-sounds (Kenney CC0, public/sfx). They only play after a gesture and
// the mute choice is remembered in this browser.
export type SoundName = "accept" | "keep" | "undo" | "select";
const MUTE_KEY = "afterbrand.sound.muted";
const SOUND_VOLUME = 0.28;

export function useSounds() {
  const [muted, setMuted] = useState(false);
  useEffect(() => {
    try {
      setMuted(window.localStorage.getItem(MUTE_KEY) === "1");
    } catch {
      // Storage can be blocked; sound simply stays on.
    }
  }, []);
  const toggle = useCallback(() => {
    setMuted((value) => {
      try {
        window.localStorage.setItem(MUTE_KEY, value ? "0" : "1");
      } catch {
        // Ignore storage errors; the toggle still works for this visit.
      }
      return !value;
    });
  }, []);
  const play = useCallback(
    (name: SoundName) => {
      if (muted) return;
      const audio = new Audio(`/sfx/${name}.mp3`);
      audio.volume = SOUND_VOLUME;
      void audio.play().catch(() => undefined);
    },
    [muted],
  );
  return { muted, toggle, play };
}
