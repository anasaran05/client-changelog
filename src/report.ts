import type { CheckReport } from "./check.js";

/** Human-readable report, matching the original script's layout. */
export function renderText(report: CheckReport, fixed?: number): string {
  const out: string[] = [];
  const say = (s = "") => out.push(s);
  const section = (title: string, items: string[]) => {
    say(`${title}: ${items.length ? "" : "none"}`.trimEnd());
    for (const item of items) say(item);
    say();
  };

  say(`Changelog check for ${report.month}`);
  say(`  file:    ${report.file}${report.fileExists ? "" : " (missing)"}`);
  say(`  commits: ${report.commits.length} (excluding merges, empty and changelog-only commits)`);
  say(`  entries: ${report.entries.length}`);
  say();

  section("Unlogged commits", report.unlogged.map((c) => `  ${c.short} ${c.date} ${c.subject}`));
  section("Unknown hashes", report.unknown.map(({ hash, entry }) => `  ${hash} (line ${entry.line + 1}: ${entry.text})`));
  section("Malformed entries", report.malformed.map((m) => `  line ${m.line + 1}: ${m.text}`));

  const { resolved, unresolved, uncommitted } = report.pending;
  if (resolved.length || unresolved.length || uncommitted.length) {
    section(
      "Pending entries matched to commits",
      resolved.map(({ entry, commit }) => `  line ${entry.line + 1}: ${entry.text}\n    -> ${commit.short} ${commit.subject}`),
    );
    section("Pending entries with no confident match", unresolved.map((e) => `  line ${e.line + 1}: ${e.date} ${e.text}`));
    section(
      "Pending entries not committed yet (left as pending)",
      uncommitted.map((e) => `  line ${e.line + 1}: ${e.date} ${e.text}`),
    );
    if (fixed !== undefined && fixed > 0) {
      say(`Filled in ${fixed} hash(es) in ${report.file}.`);
      say();
    } else if (resolved.length && fixed === undefined) {
      say("Run again with --fix to write these hashes into the changelog.");
      say();
    }
  }

  say(report.ok ? "OK: changelog matches git." : "Changelog does not match git.");
  return out.join("\n");
}

/** Machine-readable report. */
export function renderJson(report: CheckReport, fixed?: number): string {
  const commit = (c: CheckReport["commits"][number]) => ({ hash: c.hash, short: c.short, date: c.date, subject: c.subject });
  const entry = (e: CheckReport["entries"][number]) => ({ line: e.line + 1, date: e.date, text: e.text, sources: e.sources });
  return JSON.stringify(
    {
      month: report.month,
      file: report.file,
      fileExists: report.fileExists,
      commits: report.commits.length,
      entries: report.entries.length,
      unlogged: report.unlogged.map(commit),
      unknown: report.unknown.map(({ hash, entry: e }) => ({ hash, line: e.line + 1, text: e.text })),
      malformed: report.malformed.map((m) => ({ line: m.line + 1, text: m.text })),
      pending: {
        resolved: report.pending.resolved.map(({ entry: e, commit: c }) => ({ ...entry(e), commit: commit(c) })),
        unresolved: report.pending.unresolved.map(entry),
        uncommitted: report.pending.uncommitted.map(entry),
      },
      fixed: fixed ?? 0,
      ok: report.ok,
    },
    null,
    2,
  );
}
