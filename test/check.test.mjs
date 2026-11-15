import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { CLI, makeRepo, monthFile } from "./helpers.mjs";

const LOG = "changelog/2026-11.md";

test("unlogged commits are reported; logged ones aren't", () => {
  const repo = makeRepo();
  repo.write("src/booking.js", "booking\n");
  const logged = repo.commit("Add booking form", "2026-11-03");
  repo.write(LOG, monthFile([`- 2026-11-03 — Added an online booking form (${logged})`]));
  repo.commit("Log booking form", "2026-11-03");
  repo.write("src/footer.js", "footer\n");
  const unlogged = repo.commit("Tweak footer spacing", "2026-11-04");

  const r = repo.run(["check", "--month", "2026-11"]);
  assert.equal(r.code, 1, r.stdout);
  assert.match(r.stdout, new RegExp(`Unlogged commits:\\n  ${unlogged} 2026-11-04 Tweak footer spacing`));
  assert.doesNotMatch(r.stdout, new RegExp(`  ${logged} `));
  assert.match(r.stdout, /commits: 2 /);
  assert.match(r.stdout, /Changelog does not match git\./);
});

test("changelog-only, ignored-path, merge and empty commits are ignored", () => {
  const repo = makeRepo();
  repo.write("changelog.config.json", JSON.stringify({ ignorePaths: ["docs/"] }));
  repo.write("src/a.js", "a\n");
  const a = repo.commit("Initial site", "2026-11-01");

  repo.write("docs/notes.md", "notes\n");
  repo.commit("Docs only", "2026-11-02");
  repo.commit("Nothing", "2026-11-02", "--allow-empty");

  repo.git("checkout", "-q", "-b", "feature");
  repo.write("src/b.js", "b\n");
  const b = repo.commit("Add gallery", "2026-11-03");
  repo.git("checkout", "-q", "main");
  repo.write("src/c.js", "c\n");
  const c = repo.commit("Add map", "2026-11-03");
  const stamp = "2026-11-03T13:00:00+00:00";
  spawnSync("git", ["merge", "-q", "--no-ff", "-m", "Merge feature", "feature"], {
    cwd: repo.dir,
    env: { ...process.env, GIT_AUTHOR_DATE: stamp, GIT_COMMITTER_DATE: stamp, GIT_CONFIG_GLOBAL: "/dev/null" },
  });
  assert.match(repo.git("log", "-1", "--format=%s"), /Merge feature/);

  repo.write(LOG, monthFile([`- 2026-11-01 — Launched the site (${a})`, `- 2026-11-03 — Added a photo gallery and a map (${b}, ${c})`]));
  repo.commit("Log changes", "2026-11-04");

  const r = repo.run(["check", "--month", "2026-11"]);
  assert.equal(r.code, 0, r.stdout);
  assert.match(r.stdout, /commits: 3 /);
  assert.match(r.stdout, /Unlogged commits: none/);
  assert.match(r.stdout, /OK: changelog matches git\./);
});

test("unknown hashes are reported", () => {
  const repo = makeRepo();
  repo.write("src/a.js", "a\n");
  const a = repo.commit("Initial site", "2026-11-01");
  repo.write(LOG, monthFile([`- 2026-11-01 — Launched the site (${a})`, "- 2026-11-02 — Something else (deadbee)"]));
  repo.commit("Log", "2026-11-02");

  const r = repo.run(["check", "--month", "2026-11"]);
  assert.equal(r.code, 1);
  assert.match(r.stdout, /Unknown hashes:\n  deadbee \(line 6: Something else\)/);
});

test("malformed and custom-source entries via the CLI", () => {
  const repo = makeRepo();
  repo.write("changelog.config.json", JSON.stringify({ sources: ["manual", "webflow"] }));
  repo.write(LOG, monthFile(["- 2026-11-02 — Edited the team page (webflow)", "- 2026-11-02 — Edited the blog (sanity)"]));
  repo.commit("Log", "2026-11-02");

  const r = repo.run(["check", "--month", "2026-11"]);
  assert.equal(r.code, 1);
  assert.match(r.stdout, /commits: 0 /, "a commit touching only the changelog and its config is ignored");
  assert.match(r.stdout, /entries: 1/);
  assert.match(r.stdout, /Malformed entries:\n  line 6: - 2026-11-02 — Edited the blog \(sanity\)/);
});

test("pending entry is resolved; --fix changes only that token", () => {
  const repo = makeRepo();
  repo.write("changelog.config.json", JSON.stringify({ currency: "€" }));
  const before = monthFile([
    "- 2026-11-05 — Changed the opening hours on the contact page (pending)",
    "- 2026-11-05 — Made a holiday banner (pending) — complimentary, worth €150",
    "- 2026-11-05 — Unrelated manual note about (pending) things (manual)",
  ]) + "- 2026-11-05 — Below the notes line (pending)\n";
  repo.write("src/contact.html", "hours\n");
  repo.write(LOG, before);
  const hash = repo.commit("Update contact page hours and add banner", "2026-11-05");

  const dry = repo.run(["check", "--month", "2026-11"]);
  assert.equal(dry.code, 0, dry.stdout);
  assert.match(dry.stdout, new RegExp(`Pending entries matched to commits:\\n  line 5: Changed the opening hours on the contact page\\n    -> ${hash} `));
  assert.match(dry.stdout, /Run again with --fix/);
  assert.equal(repo.read(LOG), before, "check without --fix must not write");

  const fixed = repo.run(["check", "--month", "2026-11", "--fix"]);
  assert.equal(fixed.code, 0, fixed.stdout);
  assert.match(fixed.stdout, /Filled in 2 hash\(es\) in changelog\/2026-11\.md\./);

  const expected = before
    .replace("contact page (pending)", `contact page (${hash})`)
    .replace("banner (pending) —", `banner (${hash}) —`);
  assert.equal(repo.read(LOG), expected);
  assert.equal(Buffer.compare(Buffer.from(repo.read(LOG)), Buffer.from(expected)), 0);
});

test("pending added in a changelog-only commit falls back to the best same-day wording", () => {
  const repo = makeRepo();
  repo.write("src/menu.js", "menu\n");
  const menu = repo.commit("Add seasonal menu page", "2026-11-06");
  repo.write("src/x.js", "x\n");
  repo.commit("Bump build tooling", "2026-11-06");
  repo.write(LOG, monthFile(["- 2026-11-06 — Added a seasonal menu page (pending)"]));
  repo.commit("Log", "2026-11-06");

  const r = repo.run(["check", "--month", "2026-11", "--json"]);
  const json = JSON.parse(r.stdout);
  assert.equal(json.pending.resolved.length, 1);
  assert.equal(json.pending.resolved[0].commit.short, menu);
  assert.equal(json.unlogged.length, 1);
  assert.equal(json.unlogged[0].subject, "Bump build tooling");
});

test("uncommitted pending entry stays pending and doesn't fail the check", () => {
  const repo = makeRepo();
  repo.write("src/a.js", "a\n");
  const a = repo.commit("Initial site", "2026-11-01");
  repo.write(LOG, monthFile([`- 2026-11-01 — Launched the site (${a})`]));
  repo.commit("Log", "2026-11-01");
  const content = monthFile([`- 2026-11-01 — Launched the site (${a})`, "- 2026-11-02 — Work in progress (pending)"]);
  repo.write(LOG, content);

  const r = repo.run(["check", "--month", "2026-11", "--fix"]);
  assert.equal(r.code, 0, r.stdout);
  assert.match(r.stdout, /Pending entries not committed yet \(left as pending\):\n  line 6: 2026-11-02 Work in progress/);
  assert.equal(repo.read(LOG), content);
});

test("--json output shape", () => {
  const repo = makeRepo();
  repo.write("src/a.js", "a\n");
  repo.commit("Initial site", "2026-11-01");
  const r = repo.run(["check", "--month", "2026-11", "--json"]);
  assert.equal(r.code, 1);
  const json = JSON.parse(r.stdout);
  assert.deepEqual(Object.keys(json), [
    "month", "file", "fileExists", "commits", "entries", "unlogged", "unknown", "malformed", "pending", "fixed", "ok",
  ]);
  assert.deepEqual(Object.keys(json.pending), ["resolved", "unresolved", "uncommitted"]);
  assert.equal(json.month, "2026-11");
  assert.equal(json.file, "changelog/2026-11.md");
  assert.equal(json.fileExists, false);
  assert.equal(json.commits, 1);
  assert.equal(json.ok, false);
  assert.deepEqual(Object.keys(json.unlogged[0]), ["hash", "short", "date", "subject"]);
});

test("exit codes: 0 ok, 1 mismatch, 2 usage errors", () => {
  const repo = makeRepo();
  repo.write(LOG, monthFile([]));
  repo.commit("Log", "2026-11-01");
  assert.equal(repo.run(["check", "--month", "2026-11"]).code, 0);
  assert.equal(repo.run(["check", "--month", "2026-10"]).code, 1, "missing month file");

  const bad = repo.run(["check", "--month", "2026-13"]);
  assert.equal(bad.code, 2);
  assert.match(bad.stderr, /Invalid --month "2026-13"/);
  assert.equal(repo.run(["check", "--nope"]).code, 2);
  assert.equal(repo.run(["frobnicate"]).code, 2);
  assert.equal(repo.run(["new-month", "--fix"]).code, 2);
  assert.equal(repo.run([]).code, 2);
  assert.equal(repo.run(["--help"]).code, 0);
  assert.match(repo.run(["--version"]).stdout, /^\d+\.\d+\.\d+\n$/);

  repo.write("changelog.config.json", "{ not json");
  const cfg = repo.run(["check"]);
  assert.equal(cfg.code, 2);
  assert.match(cfg.stderr, /Could not parse changelog\.config\.json/);

  const outside = mkdtempSync(join(tmpdir(), "client-changelog-nogit-"));
  try {
    const r = spawnSync(process.execPath, [CLI, "check"], { cwd: outside, encoding: "utf8", env: { ...process.env, GIT_CEILING_DIRECTORIES: tmpdir() } });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /Not inside a git repository/);
  } finally {
    rmSync(outside, { recursive: true, force: true });
  }
});

test("works in a repo with no commits yet", () => {
  const repo = makeRepo();
  repo.write(LOG, monthFile(["- 2026-11-01 — Draft (pending)"]));
  const r = repo.run(["check", "--month", "2026-11", "--json"]);
  assert.equal(r.code, 0, r.stdout + r.stderr);
  assert.equal(JSON.parse(r.stdout).pending.uncommitted.length, 1);
});
