---
description: Log a non-code change in this month's changelog
argument-hint: <what changed, e.g. "added 2 menu items: Sourdough Loaf, Almond Croissant">
allowed-tools: Read, Write, Edit, Bash(date:*), Bash(npx client-changelog:*)
---

Log this non-code change in the monthly change log: $ARGUMENTS

Steps:

1. Read `{{dir}}/README.md` for the format rules.
2. Get today's date with `date +%Y-%m-%d`. The target file is `{{dir}}/YYYY-MM.md` for the current
   month. If it doesn't exist, run `npx client-changelog new-month`.
3. Turn the text into one or more entries. Split it when it names several separate things.
4. Pick each entry's section: {{sectionsComma}}.
5. Pick the source from:
{{sourceHints}}
   Use `manual` only when no more specific keyword fits.
6. Write each entry as `- YYYY-MM-DD — <description> (<source>)`. Plain English a non-technical
   business owner understands. Tidy the wording, but don't invent details.
7. If the work was free or complimentary, put it under {{complimentarySection}} and end the line with
   `— complimentary, worth {{currency}}<amount>`. If no amount was given, ask for it before writing.
8. Append each entry at the end of its section. Never change or remove existing lines.
9. Don't commit. Show the lines you added and which section each went into.
