import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CONFIG_FILE, type Config } from "./config.js";
import { git, hasCommits, commitExists } from "./git.js";
import { fillPending, parseMonth, type Entry, type MalformedLine } from "./parse.js";

export interface Commit {
  hash: string;
  short: string;
  /** Author date, YYYY-MM-DD. */
  date: string;
  subject: string;
  files: string[];
}

export interface UnknownHash {
  hash: string;
  entry: Entry;
}

export interface ResolvedPending {
  entry: Entry;
  commit: Commit;
}

export interface CheckReport {
  month: string;
  /** Month file path relative to the repo root, with forward slashes. */
  file: string;
  fileExists: boolean;
  /** Commits in the month that need an entry. */
  commits: Commit[];
  entries: Entry[];
  unlogged: Commit[];
  unknown: UnknownHash[];
  malformed: MalformedLine[];
  pending: {
    resolved: ResolvedPending[];
    unresolved: Entry[];
    uncommitted: Entry[];
  };
  ok: boolean;
}

export interface CheckOptions {
  root: string;
  month: string;
  config: Config;
}

const isUnder = (file: string, path: string) => file === path || file.startsWith(`${path}/`);

/**
 * True when a commit touching `files` needs no changelog entry: it is empty, or only touches the
 * changelog folder, `changelog.config.json` and `ignorePaths`.
 */
export function isIgnorable(files: string[], config: Pick<Config, "dir" | "ignorePaths">): boolean {
  const paths = [config.dir, CONFIG_FILE, ...config.ignorePaths];
  return files.length === 0 || files.every((f) => paths.some((p) => isUnder(f, p)));
}

/** Non-merge commits authored in `month` that change something outside the changelog/ignored paths. */
export function monthCommits(root: string, month: string, config: Config): Commit[] {
  if (!hasCommits(root)) return [];
  return git(root, "log", "--no-merges", "--date=short", "--name-only", "--format=%x00%H%x1f%h%x1f%ad%x1f%s")
    .split("\0")
    .filter(Boolean)
    .map((chunk) => {
      const [head = "", ...rest] = chunk.split("\n");
      const [hash = "", short = "", date = "", subject = ""] = head.split("\x1f");
      return { hash, short, date, subject, files: rest.filter(Boolean) };
    })
    .filter((c) => c.date.startsWith(month))
    .filter((c) => !isIgnorable(c.files, config))
    .reverse();
}

const words = (s: string) => new Set(s.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []);
const overlap = (a: string, b: string) => {
  const wb = words(b);
  return [...words(a)].filter((w) => wb.has(w)).length;
};

/** Cross-check a month file against git. Reads only; never writes. */
export function check({ root, month, config }: CheckOptions): CheckReport {
  const file = `${config.dir}/${month}.md`;
  const abs = join(root, file);
  const fileExists = existsSync(abs);
  const { entries, malformed } = parseMonth(fileExists ? readFileSync(abs, "utf8") : "", config);
  const commits = monthCommits(root, month, config);
  const committed = hasCommits(root);

  // --- hashes ---
  const hashRefs = entries.flatMap((entry) =>
    entry.sources.filter((s) => /^[0-9a-f]+$/.test(s)).map((hash) => ({ entry, hash })),
  );
  const unknown = hashRefs.filter(({ hash }) => !committed || !commitExists(root, hash));
  const logged = new Set(
    commits.filter((c) => hashRefs.some(({ hash }) => c.hash.startsWith(hash))).map((c) => c.hash),
  );

  // --- pending: the commit that added the entry line, else date + word overlap ---
  // Entries are written in the same commit as the change, so the commit that first added the
  // entry's text is its source. An entry not in any commit yet is uncommitted work and stays
  // pending, even if a commit from the same day is still unlogged.
  const addedIn = (text: string) =>
    committed
      ? git(root, "log", "--format=%H", "-S", text, "--", file).trim().split("\n").filter(Boolean).at(-1)
      : undefined;

  const pending = entries.filter((e) => e.sources.includes("pending"));
  const resolved: ResolvedPending[] = [];
  const unresolved: Entry[] = [];
  const uncommitted: Entry[] = [];

  for (const entry of pending) {
    const introducedBy = addedIn(entry.text);
    if (!introducedBy) {
      uncommitted.push(entry);
      continue;
    }
    const direct = commits.find((c) => c.hash === introducedBy);
    if (direct) {
      resolved.push({ entry, commit: direct });
      continue;
    }
    // Added in a changelog-only commit: fall back to a same-day commit with clearly the best wording.
    const scored = commits
      .filter((c) => c.date === entry.date && !logged.has(c.hash))
      .map((c) => ({ c, score: overlap(entry.text, c.subject) }))
      .sort((a, b) => b.score - a.score);
    const [best, next] = scored;
    if (best && best.score > 0 && best.score > (next?.score ?? 0)) resolved.push({ entry, commit: best.c });
    else unresolved.push(entry);
  }
  for (const { commit } of resolved) logged.add(commit.hash);

  const unlogged = commits.filter((c) => !logged.has(c.hash));
  const ok = fileExists && !unlogged.length && !unknown.length && !malformed.length && !unresolved.length;

  return {
    month,
    file,
    fileExists,
    commits,
    entries,
    unlogged,
    unknown,
    malformed,
    pending: { resolved, unresolved, uncommitted },
    ok,
  };
}

/**
 * Write the resolved hashes into the month file, replacing only the `pending` token on each
 * resolved line. Returns the number of lines changed.
 */
export function applyFix(root: string, report: CheckReport): number {
  if (!report.pending.resolved.length || !report.fileExists) return 0;
  const abs = join(root, report.file);
  const lines = readFileSync(abs, "utf8").split("\n");
  let changed = 0;
  for (const { entry, commit } of report.pending.resolved) {
    const before = lines[entry.line];
    if (before === undefined) continue;
    const after = fillPending(before, commit.short);
    if (after !== before) {
      lines[entry.line] = after;
      changed++;
    }
  }
  if (changed) writeFileSync(abs, lines.join("\n"));
  return changed;
}
