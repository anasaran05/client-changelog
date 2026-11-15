import type { Config } from "./config.js";

export interface Entry {
  /** 0-based line index in the file. */
  line: number;
  /** Entry date, YYYY-MM-DD. */
  date: string;
  /** Plain-English description. */
  text: string;
  /** Sources from the trailing "(...)": hashes, `pending`, or configured keywords. */
  sources: string[];
  /** Complimentary amount as written (e.g. "4,000"), if the entry is complimentary. */
  complimentary?: string;
}

export interface MalformedLine {
  /** 0-based line index in the file. */
  line: number;
  text: string;
}

export interface ParsedMonth {
  lines: string[];
  entries: Entry[];
  malformed: MalformedLine[];
}

export const HASH = /^[0-9a-f]{7,40}$/;
export const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Regex for one entry line, with the configured currency. */
export function entryPattern(currency: string): RegExp {
  return new RegExp(
    `^- (\\d{4}-\\d{2}-\\d{2}) — (.+) \\(([^()]+)\\)(?: — complimentary, worth ${escapeRegExp(currency)}(\\d[\\d,]*(?:\\.\\d+)?))?\\s*$`,
  );
}

/** True when `s` is a valid source for this config. */
export function isValidSource(s: string, config: Pick<Config, "sources">): boolean {
  return s === "pending" || HASH.test(s) || config.sources.includes(s);
}

/**
 * Parse a month file. Only lines starting with "- " above the first "---" line are entries;
 * everything below "---" is free-form notes and is ignored.
 */
export function parseMonth(content: string, config: Pick<Config, "currency" | "sources">): ParsedMonth {
  const lines = content.split("\n");
  const entries: Entry[] = [];
  const malformed: MalformedLine[] = [];
  const pattern = entryPattern(config.currency);

  for (const [i, raw] of lines.entries()) {
    if (raw.trim() === "---") break;
    if (!raw.startsWith("- ")) continue;
    const m = raw.match(pattern);
    const sources = m ? m[3]!.split(",").map((s) => s.trim()) : [];
    if (!m || !sources.every((s) => isValidSource(s, config))) {
      malformed.push({ line: i, text: raw.replace(/\r$/, "") });
    } else {
      const entry: Entry = { line: i, date: m[1]!, text: m[2]!, sources };
      if (m[4] !== undefined) entry.complimentary = m[4];
      entries.push(entry);
    }
  }
  return { lines, entries, malformed };
}

/**
 * Replace the `pending` token inside the last "(...)" group of a line with `hash`.
 * Nothing else on the line changes.
 */
export function fillPending(line: string, hash: string): string {
  return line.replace(/\(([^()]*)\bpending\b([^()]*)\)(?=[^()]*$)/, `($1${hash}$2)`);
}

/** English month name for "YYYY-MM", e.g. "November 2026". */
export function monthName(month: string): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const names = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${names[m - 1]} ${y}`;
}

/** The month containing `date`, in local time, as "YYYY-MM". */
export function currentMonth(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
