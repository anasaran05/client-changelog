# {{title}}: monthly change log

This folder records, month by month, what changed on the project, in plain English the client
can read. It is checked against git with
[`client-changelog`](https://www.npmjs.com/package/client-changelog).

## Files

- `YYYY-MM.md`: one file per month, e.g. `{{exampleMonth}}.md`.
- `_template.md`: the starting point for a new month. Create the next one with
  `npx client-changelog new-month`.
- `README.md`: this file.

## Sections

Every month file has these sections, in this order:

{{sectionsBullets}}

Entries go above the `---` line. Everything below it ("Month-end notes") is free-form and isn't
checked.

## Entry format

```
- YYYY-MM-DD — <plain-English description> (<source>)
```

For example:

```
- {{exampleDate}} — Added an online booking form to the contact page (3f9c2ab)
- {{exampleDate}} — Designed a seasonal offer banner for the home page (pending) — complimentary, worth {{currency}}150
```

- The separators are an em dash `—` with a space on each side.
- Write for a non-technical reader: no jargon, file names or code terms.
- Complimentary (free) work ends with `— complimentary, worth {{currency}}<amount>`, e.g.
  `{{currency}}1,000` or `{{currency}}12.50`.

## Sources

The text in brackets at the end of an entry says where the change came from:

- A commit hash such as `3f9c2ab` (7 to 40 characters). Several can be listed, separated by
  commas: `(3f9c2ab, 81d0e4c)`.
- `pending`: the commit's hash isn't known yet. An entry is written in the same commit as the
  change, so it can't contain its own hash. `npx client-changelog check --fix` fills it in later.
{{sourceBullets}}

## Workflow

1. **Code changes**: the AI coding agent adds an entry in the same commit as each change (see the
   change-log rules in the project's agent instructions).
2. **Everything else** (CMS edits, hosting, domain, email, Google and so on): log it with the
   `/log` command in Claude Code, or add the line by hand.
3. **Cross-check**: `npx client-changelog check` compares this month's file with git and lists
   commits that have no entry, unknown hashes and malformed lines. Use `--month YYYY-MM` for
   another month.
4. **Fill in hashes**: `npx client-changelog check --fix` replaces `pending` with the real commit
   hash, and changes nothing else.

## Rules

- Append only. Never rewrite or delete past entries. The one exception is `check --fix` replacing
  `pending`.
- Don't log changes to the change log itself. Commits that only touch `{{dir}}/` are ignored by
  the check.
