## Change log

This project keeps a monthly, client-readable change log in `{{dir}}/` (format and workflow in
`{{dir}}/README.md`). Keep it current as you work:

- After any change to code, content or config that is committed (or that the user asks you
  to commit), append an entry to the current month's file, `{{dir}}/YYYY-MM.md`, in the same
  commit. If the file doesn't exist yet, run `npx client-changelog new-month`.
- Put each entry in the right section: {{sectionsList}}.{{internalRule}}
- Format: `- YYYY-MM-DD — <description> (<source>)`, using today's date. The source is the
  commit's short hash, or `pending` when the hash isn't known yet (always the case for the commit
  that contains the entry). Complimentary entries end with `— complimentary, worth {{currency}}<amount>`.
- Write descriptions for a non-technical business owner: no jargon, file names or code terms.
  "Updated the price and photos of the product page", not "edited data/products.ts".
- One commit may need several entries if it changes several things a client would notice.
- Never rewrite or delete past entries; only append. The exception is
  `npx client-changelog check --fix`, which replaces `pending` with real hashes.
- Don't log changes to the change log itself.
- `npx client-changelog check --month YYYY-MM` cross-checks entries against git.
