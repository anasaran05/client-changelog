import assert from "node:assert/strict";
import { test } from "node:test";
import { fillPending, isValidSource, monthName, parseMonth, validateConfig, ConfigError } from "../dist/index.js";
import { monthFile } from "./helpers.mjs";

const cfg = (extra = {}) => validateConfig(extra);

test("valid entries, comma-separated hashes and complimentary lines", () => {
  const { entries, malformed } = parseMonth(
    monthFile([
      "- 2026-11-02 — Added an online booking form to the contact page (3f9c2ab)",
      "- 2026-11-03 — Updated the opening hours (3f9c2ab, 81d0e4c1)",
      "- 2026-11-04 — Fixed the menu on phones (the small screen one) (pending)",
      "- 2026-11-05 — Designed a holiday banner (manual) — complimentary, worth $1,000",
      "- 2026-11-06 — Resized the gallery photos (a1b2c3d) — complimentary, worth $12.50",
      "- 2026-11-07 — Wrote alt text for photos (a1b2c3d) — complimentary, worth $4000",
    ]),
    cfg(),
  );
  assert.deepEqual(malformed, []);
  assert.equal(entries.length, 6);
  assert.deepEqual(entries[1].sources, ["3f9c2ab", "81d0e4c1"]);
  assert.equal(entries[2].text, "Fixed the menu on phones (the small screen one)");
  assert.deepEqual(entries[2].sources, ["pending"]);
  assert.equal(entries[3].complimentary, "1,000");
  assert.equal(entries[4].complimentary, "12.50");
  assert.equal(entries[5].complimentary, "4000");
  assert.equal(entries[0].line, 4);
});

test("complimentary lines use the configured currency", () => {
  const euro = parseMonth(monthFile(["- 2026-11-05 — Free logo tweak (manual) — complimentary, worth €250"]), cfg({ currency: "€" }));
  assert.equal(euro.entries.length, 1);
  const rupee = parseMonth(monthFile(["- 2026-11-05 — Free logo tweak (manual) — complimentary, worth ₹4,000"]), cfg({ currency: "₹" }));
  assert.equal(rupee.entries[0].complimentary, "4,000");
  // Wrong currency for this config is malformed.
  const wrong = parseMonth(monthFile(["- 2026-11-05 — Free logo tweak (manual) — complimentary, worth $250"]), cfg({ currency: "€" }));
  assert.equal(wrong.malformed.length, 1);
  // Regex metacharacters in the currency are escaped.
  const dollarDot = parseMonth(monthFile(["- 2026-11-05 — Free tweak (manual) — complimentary, worth A$.250"]), cfg({ currency: "A$." }));
  assert.equal(dollarDot.entries.length, 1);
  const notEscaped = parseMonth(monthFile(["- 2026-11-05 — Free tweak (manual) — complimentary, worth AXx250"]), cfg({ currency: "A$." }));
  assert.equal(notEscaped.malformed.length, 1);
});

test("malformed lines are reported", () => {
  const { entries, malformed } = parseMonth(
    monthFile([
      "- 2026-11-02 — Added a booking form",
      "- 2026-11-02 - Added a booking form (3f9c2ab)",
      "- 2026-11-02 — Added a booking form (sanity)",
      "- 2026-11-02 — Added a booking form (3F9C2AB)",
      "- 02/11/2026 — Added a booking form (3f9c2ab)",
      "- 2026-11-02 — Added a booking form (manual) — complimentary, worth $",
    ]),
    cfg(),
  );
  assert.equal(entries.length, 0);
  assert.deepEqual(
    malformed.map((m) => m.line),
    [4, 5, 6, 7, 8, 9],
  );
});

test("custom sources from config are accepted", () => {
  const text = monthFile(["- 2026-11-02 — Added two new cakes to the menu (sanity)", "- 2026-11-02 — New product photos (shopify, 3f9c2ab)"]);
  assert.equal(parseMonth(text, cfg()).malformed.length, 2);
  const parsed = parseMonth(text, cfg({ sources: ["manual", "sanity", "shopify"] }));
  assert.equal(parsed.malformed.length, 0);
  assert.equal(parsed.entries.length, 2);
  assert.ok(isValidSource("pending", cfg({ sources: [] })));
});

test("notes below --- are ignored", () => {
  const text = monthFile(["- 2026-11-02 — Added a booking form (3f9c2ab)"]) + "- not an entry at all\n- 2026-11-09 — Also ignored (zzz)\n";
  const { entries, malformed } = parseMonth(text, cfg());
  assert.equal(entries.length, 1);
  assert.equal(malformed.length, 0);
});

test("fillPending replaces only the token in the last group", () => {
  assert.equal(
    fillPending("- 2026-11-04 — Tidied the (pending) list (pending) — complimentary, worth $10", "abc1234"),
    "- 2026-11-04 — Tidied the (pending) list (abc1234) — complimentary, worth $10",
  );
  assert.equal(fillPending("- 2026-11-04 — Two things (3f9c2ab, pending)", "abc1234"), "- 2026-11-04 — Two things (3f9c2ab, abc1234)");
  assert.equal(fillPending("- 2026-11-04 — Done (3f9c2ab)\r", "abc1234"), "- 2026-11-04 — Done (3f9c2ab)\r");
});

test("monthName uses English month names", () => {
  assert.equal(monthName("2026-11"), "November 2026");
  assert.equal(monthName("2027-01"), "January 2027");
});

test("config validation gives clear errors", () => {
  assert.throws(() => validateConfig({ currency: "" }), ConfigError);
  assert.throws(() => validateConfig({ sources: ["Sanity"] }), /sources/);
  assert.throws(() => validateConfig({ sources: ["deadbeef"] }), /commit hashes/);
  assert.throws(() => validateConfig({ dir: "../outside" }), /dir/);
  assert.throws(() => validateConfig({ dir: "/abs" }), /relative/);
  assert.throws(() => validateConfig({ sections: [] }), /sections/);
  assert.throws(() => validateConfig({ titel: "x" }), /unknown option "titel"/);
  assert.throws(() => validateConfig([]), /JSON object/);
  const ok = validateConfig({ dir: "./docs/changes/", ignorePaths: ["./assets/"] });
  assert.equal(ok.dir, "docs/changes");
  assert.deepEqual(ok.ignorePaths, ["assets"]);
});
