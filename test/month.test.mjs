// The default month must come from local time, not UTC.
// Pacific/Kiritimati is UTC+14, so just after local midnight on 1 December it is still
// 30 November in UTC.
process.env.TZ = "Pacific/Kiritimati";

import assert from "node:assert/strict";
import { test } from "node:test";
import { currentMonth } from "../dist/index.js";
import { makeRepo } from "./helpers.mjs";

test("currentMonth uses local time", () => {
  const justAfterMidnight = new Date(2026, 11, 1, 0, 30);
  assert.equal(justAfterMidnight.toISOString().slice(0, 7), "2026-11", "sanity: UTC is still November");
  assert.equal(currentMonth(justAfterMidnight), "2026-12");
  assert.equal(currentMonth(new Date(2026, 10, 30, 23, 59)), "2026-11");
});

test("the CLI's default month follows the local time zone", () => {
  const repo = makeRepo();
  for (const tz of ["Pacific/Kiritimati", "Pacific/Pago_Pago", "UTC"]) {
    const r = repo.run(["check", "--json"], { TZ: tz });
    const now = new Date();
    const local = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit" }).format(now);
    assert.equal(JSON.parse(r.stdout).month, local.slice(0, 7), tz);
  }
});
