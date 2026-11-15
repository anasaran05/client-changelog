# Changelog

All notable changes to this package are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the package follows
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] - 2026-11-15

### Added

- `init`: sets up `changelog.config.json`, the changelog folder, this month's file, agent rules in
  `CLAUDE.md` / `AGENTS.md`, a `/log` command for Claude Code and a `changelog:check` script.
  Never overwrites existing files.
- `check`: cross-checks a month's file against git and reports unlogged commits, unknown hashes,
  malformed entries and `pending` entries. `--fix` fills in hashes; `--json` prints a
  machine-readable report. Exit codes 0 / 1 / 2.
- `new-month`: creates a month file from the template.
- Configurable folder, title, currency, source keywords, ignored paths and sections, with a JSON
  Schema for editor autocomplete.
- Programmatic API with type declarations.

[Unreleased]: https://github.com/anasaran05/client-changelog/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/anasaran05/client-changelog/releases/tag/v0.1.0
