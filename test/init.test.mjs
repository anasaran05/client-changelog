import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";
import { currentMonth } from "../dist/index.js";
import { makeRepo } from "./helpers.mjs";

/** Every file under the repo (except .git) with its contents. */
function snapshot(dir) {
  const out = {};
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      if (name === ".git") continue;
      const abs = join(d, name);
      if (statSync(abs).isDirectory()) walk(abs);
      else out[relative(dir, abs)] = readFileSync(abs, "utf8");
    }
  };
  walk(dir);
  return out;
}

const month = currentMonth();

test("init --yes creates the expected files", () => {
  const repo = makeRepo();
  repo.write("package.json", '{\n    "name": "bakery-site",\n    "scripts": {\n        "build": "vite build"\n    }\n}\n');
  const r = repo.run(["init", "--yes"]);
  assert.equal(r.code, 0, r.stderr);

  for (const f of ["changelog.config.json", "changelog/README.md", "changelog/_template.md", `changelog/${month}.md`, ".claude/commands/log.md", "CLAUDE.md"]) {
    assert.ok(existsSync(join(repo.dir, f)), `${f} should exist`);
  }
  assert.ok(!existsSync(join(repo.dir, "AGENTS.md")));

  const config = JSON.parse(repo.read("changelog.config.json"));
  assert.equal(config.$schema, "https://unpkg.com/client-changelog/schema.json");
  assert.equal(config.dir, "changelog");
  assert.equal(config.currency, "$");
  assert.deepEqual(config.sources, ["manual"]);

  const claude = repo.read("CLAUDE.md");
  assert.ok(claude.startsWith("<!-- client-changelog:start -->\n## Change log"));
  assert.ok(claude.trimEnd().endsWith("<!-- client-changelog:end -->"));
  assert.match(claude, /Dependency bumps, refactors, config\n  and tooling go under Internal\./);

  assert.match(repo.read("changelog/_template.md"), /^# <Title> — <Month YYYY>\n/);
  assert.match(repo.read(`changelog/${month}.md`), /^# Website Changes — \w+ \d{4}\n/);
  assert.match(repo.read(".claude/commands/log.md"), /`manual`: anything done outside the code/);

  const pkg = repo.read("package.json");
  assert.equal(JSON.parse(pkg).scripts["changelog:check"], "client-changelog check");
  assert.match(pkg, /^ {4}"name"/m, "keeps the file's indentation");
  assert.match(r.stdout, /npm i -D client-changelog/);
});

test("a second init changes nothing", () => {
  const repo = makeRepo();
  repo.write("package.json", '{ "name": "x" }\n');
  assert.equal(repo.run(["init", "--yes"]).code, 0);
  const first = snapshot(repo.dir);
  const r = repo.run(["init", "--yes"]);
  assert.equal(r.code, 0);
  assert.deepEqual(snapshot(repo.dir), first);
  assert.match(r.stdout, /already set up/);
  assert.equal(first["CLAUDE.md"].split("client-changelog:start").length, 2, "marker block once");
});

test("init never overwrites existing files", () => {
  const repo = makeRepo();
  repo.write("changelog/README.md", "my own readme\n");
  repo.write(".claude/commands/log.md", "my own command\n");
  repo.write("CLAUDE.md", "# Project notes\n\nUse tabs.");
  repo.write("package.json", '{"scripts":{"changelog:check":"something-else"}}');
  const r = repo.run(["init", "--yes"]);
  assert.equal(r.code, 0);
  assert.equal(repo.read("changelog/README.md"), "my own readme\n");
  assert.equal(repo.read(".claude/commands/log.md"), "my own command\n");
  assert.equal(repo.read("package.json"), '{"scripts":{"changelog:check":"something-else"}}');
  const claude = repo.read("CLAUDE.md");
  assert.ok(claude.startsWith("# Project notes\n\nUse tabs.\n\n<!-- client-changelog:start -->"));
  assert.match(r.stdout, /skipped\s+changelog\/README\.md \(already exists\)/);
});

test("init picks AGENTS.md when that's the agent file in use, and respects an existing config", () => {
  const repo = makeRepo();
  repo.write("AGENTS.md", "# Agents\n");
  repo.write("changelog.config.json", JSON.stringify({ dir: "client-log", currency: "€", sources: ["manual", "shopify"] }));
  const r = repo.run(["init", "--yes"]);
  assert.equal(r.code, 0, r.stderr);
  assert.ok(!existsSync(join(repo.dir, "CLAUDE.md")));
  const agents = repo.read("AGENTS.md");
  assert.match(agents, /`client-log\/YYYY-MM\.md`/);
  assert.match(agents, /worth €<amount>/);
  assert.match(repo.read(".claude/commands/log.md"), /`shopify`: changes made in the Shopify admin/);
  assert.match(repo.read("client-log/README.md"), /`shopify`: changes made in the Shopify admin\./);
  assert.ok(existsSync(join(repo.dir, `client-log/${month}.md`)));
  assert.ok(!existsSync(join(repo.dir, "package.json")), "no package.json is created");
});

test("init outside a git repo exits 2", async () => {
  const { mkdtempSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { spawnSync } = await import("node:child_process");
  const { CLI } = await import("./helpers.mjs");
  const dir = mkdtempSync(join(tmpdir(), "client-changelog-nogit-"));
  try {
    const r = spawnSync(process.execPath, [CLI, "init", "--yes"], { cwd: dir, encoding: "utf8", env: { ...process.env, GIT_CEILING_DIRECTORIES: tmpdir() } });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /Not inside a git repository/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
