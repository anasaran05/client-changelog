import assert from "node:assert/strict";
import { test } from "node:test";
import { makeRepo } from "./helpers.mjs";

test("new-month fills title and month name", () => {
  const repo = makeRepo();
  repo.write("changelog.config.json", JSON.stringify({ title: "Clinic Website Updates", sections: ["New", "Changed", "Internal"] }));
  const r = repo.run(["new-month", "--month", "2027-02"]);
  assert.equal(r.code, 0, r.stderr);
  assert.match(r.stdout, /Created changelog\/2027-02\.md/);
  assert.equal(
    repo.read("changelog/2027-02.md"),
    "# Clinic Website Updates — February 2027\n\n## New\n\n## Changed\n\n## Internal\n\n---\n\n## Month-end notes\n\n### Insights\n\n### Next month actions\n",
  );
});

test("new-month uses <dir>/_template.md when present", () => {
  const repo = makeRepo();
  repo.write("changelog.config.json", JSON.stringify({ dir: "docs/changes", title: "Bakery Site" }));
  repo.write("docs/changes/_template.md", "# <Title> — <Month YYYY>\n\n## Done\n\n---\n<Title> notes\n");
  assert.equal(repo.run(["new-month", "--month", "2026-12"]).code, 0);
  assert.equal(repo.read("docs/changes/2026-12.md"), "# Bakery Site — December 2026\n\n## Done\n\n---\nBakery Site notes\n");
});

test("new-month refuses to overwrite", () => {
  const repo = makeRepo();
  repo.write("changelog/2026-11.md", "keep me\n");
  const r = repo.run(["new-month", "--month", "2026-11"]);
  assert.equal(r.code, 1);
  assert.match(r.stderr, /already exists/);
  assert.equal(repo.read("changelog/2026-11.md"), "keep me\n");
});
