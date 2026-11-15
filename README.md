# client-changelog

**Client-readable monthly changelogs, cross-checked against git.**

Keep one plain-English Markdown file per month for the website (or app) you maintain for a client.
Your AI coding agent writes the entries as it works, and `client-changelog check` proves that every
commit is accounted for.

```
npx client-changelog init
```

[![npm](https://img.shields.io/npm/v/client-changelog)](https://www.npmjs.com/package/client-changelog)
[![CI](https://github.com/anasaran05/client-changelog/actions/workflows/ci.yml/badge.svg)](https://github.com/anasaran05/client-changelog/actions/workflows/ci.yml)
![zero dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)

## Why

Freelancers and small agencies need to show clients what was done each month. A git log doesn't
work for that:

| Git log | client-changelog |
| --- | --- |
| `fix: z-index on .nav-mobile` | Fixed the menu covering the page on phones |
| `chore(deps): bump next` | Kept out of the client's view under *Internal* |
| Nothing for CMS, DNS or Google work | `/log` records changes made outside the code |
| No record of free work | `— complimentary, worth $150` |

Each entry still points at the commit that made the change, so `check` can catch commits that
were never logged and hashes that don't exist.

## Quick start

```sh
cd your-project          # must be a git repo
npx client-changelog init
npm i -D client-changelog   # optional: so `npm run changelog:check` works offline
```

`init` asks a few questions (or use `--yes` for the defaults) and creates:

| File | What it is |
| --- | --- |
| `changelog.config.json` | Settings: folder, title, currency, sources, sections |
| `changelog/README.md` | The format and workflow, for people and agents |
| `changelog/_template.md` | Starting point for each month |
| `changelog/2026-11.md` | This month's file |
| `CLAUDE.md` and/or `AGENTS.md` | Rules telling your agent to log every change (appended between markers) |
| `.claude/commands/log.md` | A `/log` command for Claude Code |
| `package.json` script | `"changelog:check": "client-changelog check"`, if `package.json` exists |

`init` never overwrites anything. Running it again changes nothing.

## Example month file

`changelog/2026-11.md` for a bakery's website:

```markdown
# Website Changes — November 2026

## Added

- 2026-11-03 — Added an online order form for celebration cakes (3f9c2ab)
- 2026-11-12 — Added four new pastries to the menu (manual)

## Updated

- 2026-11-05 — Updated the opening hours for the holidays (81d0e4c)

## Removed

## Fixed

- 2026-11-09 — Fixed the menu covering the page on phones (a17be02)

## Complimentary

- 2026-11-20 — Designed a Christmas offer banner for the home page (c4d5e6f) — complimentary, worth $150

## Internal (not shown to client)

- 2026-11-21 — Updated the website's building blocks to their latest versions (9b8a7c6)

---

## Month-end notes

### Insights

The cake order form brought in 14 orders in its first two weeks.

### Next month actions

- Add a gift card page before the holidays.
```

Everything below the `---` line is free-form and isn't checked.

## Entry format

```
- YYYY-MM-DD — <plain-English description> (<source>)
- YYYY-MM-DD — <plain-English description> (<source>) — complimentary, worth <currency><amount>
```

- The separators are an em dash `—` with a space on each side.
- `<source>` is one of:
  - a commit hash, 7 to 40 hex characters, e.g. `3f9c2ab`. Several can be listed: `(3f9c2ab, 81d0e4c)`
  - `pending`: the hash isn't known yet (see below)
  - `manual`, or any keyword you add in the config, e.g. `sanity`, `shopify`, `webflow`, `wordpress`
- Amounts may be written `1000`, `1,000` or `12.50`.

### Why `pending`?

A commit can't contain its own hash. When the agent writes the entry in the same commit as the
change, it uses `pending`. `check` then finds the commit that added that line, and
`check --fix` writes in the real short hash. It changes nothing else in the file.

## Commands

```
npx client-changelog init [--yes]
npx client-changelog check [--month YYYY-MM] [--fix] [--json]
npx client-changelog new-month [--month YYYY-MM]
npx client-changelog --help | --version
```

### `check`

Compares the month's file with the month's commits and reports:

- **Unlogged commits**: commits in the month that no entry points at.
- **Unknown hashes**: entries pointing at a commit that doesn't exist.
- **Malformed entries**: lines starting with `- ` above `---` that don't match the format.
- **Pending entries**: matched to the commit that added them (fixable with `--fix`), with no
  confident match, or not committed yet. Uncommitted entries stay `pending` and don't fail the check.

These commits never need an entry: merge commits, empty commits, and commits that only touch the
changelog folder, `changelog.config.json` or your `ignorePaths`.

| Flag | |
| --- | --- |
| `--month YYYY-MM` | Month to check. Defaults to the current month in **local** time. |
| `--fix` | Replace `pending` with the matched hashes. |
| `--json` | Print a machine-readable report instead of text. |

Exit codes: `0` everything matches, `1` the changelog doesn't match git, `2` usage or setup error.

<details>
<summary>JSON report shape</summary>

```json
{
  "month": "2026-11",
  "file": "changelog/2026-11.md",
  "fileExists": true,
  "commits": 12,
  "entries": 14,
  "unlogged": [{ "hash": "…", "short": "a17be02", "date": "2026-11-09", "subject": "…" }],
  "unknown": [{ "hash": "deadbee", "line": 8, "text": "…" }],
  "malformed": [{ "line": 11, "text": "- 2026-11-12 - …" }],
  "pending": {
    "resolved": [{ "line": 7, "date": "…", "text": "…", "sources": ["pending"], "commit": { "hash": "…", "short": "…", "date": "…", "subject": "…" } }],
    "unresolved": [],
    "uncommitted": []
  },
  "fixed": 0,
  "ok": false
}
```

Line numbers are 1-based.
</details>

### `new-month`

Creates `<dir>/YYYY-MM.md` from `<dir>/_template.md` (or the built-in template), filling in
`<Title>` and `<Month YYYY>`. It refuses to overwrite an existing file.

## Configuration

`changelog.config.json` at the repo root. Every option is optional.

```json
{
  "$schema": "https://unpkg.com/client-changelog/schema.json",
  "dir": "changelog",
  "title": "Website Changes",
  "currency": "$",
  "sources": ["manual"],
  "ignorePaths": [],
  "sections": ["Added", "Updated", "Removed", "Fixed", "Complimentary", "Internal (not shown to client)"]
}
```

| Option | Default | |
| --- | --- | --- |
| `dir` | `"changelog"` | Folder for the month files, relative to the repo root. |
| `title` | `"Website Changes"` | Heading of each month file. |
| `currency` | `"$"` | Symbol for complimentary amounts: `"€"`, `"£"`, `"₹"`, `"A$"`… |
| `sources` | `["manual"]` | Source keywords besides hashes and `pending`, e.g. `["manual", "sanity"]`. Lowercase. |
| `ignorePaths` | `[]` | Files or folders whose commits never need an entry, e.g. `["docs/", "README.md"]`. |
| `sections` | as above | Section names for new month files and the agent rules. |

The config is validated on every run, and a bad value stops with a clear error.

## AI agent setup

### Claude Code

`init` appends a short **Change log** section to `CLAUDE.md` and installs `/log`:

- After every change, Claude adds an entry to this month's file **in the same commit**, written for
  a non-technical reader, with source `pending`.
- For work done outside the code, run `/log` with a description:

  ```
  /log added 2 menu items: Sourdough Loaf, Almond Croissant
  /log moved the domain's email to the new provider
  ```

  Claude picks the section and source, asks for an amount if the work was complimentary, and
  appends the lines without committing.

### Other agents (Cursor, Codex, Copilot, Aider…)

Choose `AGENTS.md` (or `both`) when `init` asks. The same rules are appended there. Any agent
that reads `AGENTS.md` will follow them.

The rules sit between `<!-- client-changelog:start -->` and `<!-- client-changelog:end -->`, so
you can edit them or find them later.

## CI

Fail the build when a month's changelog falls behind:

```yaml
# .github/workflows/changelog.yml
name: Changelog
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0 # check needs the full history
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npx client-changelog check --month $(date +%Y-%m)
```

## Programmatic API

```js
import { loadConfig, check, applyFix, parseMonth, renderText } from "client-changelog";

const root = process.cwd();
const { config } = loadConfig(root);
const report = check({ root, month: "2026-11", config });

if (!report.ok) console.log(renderText(report));
for (const c of report.unlogged) console.log("No entry for", c.short, c.subject);

applyFix(root, report); // fill in pending hashes
```

Also exported: `validateConfig`, `parseMonth`, `fillPending`, `entryPattern`, `currentMonth`,
`monthName`, `newMonth`, `renderJson`, and the template renderers. Type declarations are included.

## Requirements

Node.js 18.18 or newer, and git. No runtime dependencies.

## License

[MIT](LICENSE)
