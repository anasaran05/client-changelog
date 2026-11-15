#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { applyFix, check } from "./check.js";
import { ConfigError, loadConfig } from "./config.js";
import { repoRoot } from "./git.js";
import { init } from "./init.js";
import { newMonth } from "./new-month.js";
import { MONTH, currentMonth } from "./parse.js";
import { renderJson, renderText } from "./report.js";

const HELP = `client-changelog: client-readable monthly changelogs, cross-checked against git

Usage:
  client-changelog init [--yes]                    Set up in the current git repo
  client-changelog check [--month YYYY-MM] [--fix] [--json]
                                                   Cross-check a month's file against git
  client-changelog new-month [--month YYYY-MM]     Create a month file from the template
  client-changelog --help | --version

Options:
  --month YYYY-MM   Month to work on (default: the current month, local time)
  --fix             check: replace "pending" with the matched commit hashes
  --json            check: print a machine-readable report
  -y, --yes         init: use the defaults without asking

Exit codes: 0 everything matches, 1 the changelog doesn't match git, 2 usage or setup error.
Docs: https://github.com/anasaran05/client-changelog#readme`;

class UsageError extends Error {}

function version(): string {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string };
  return pkg.version;
}

function resolveMonth(value: string | undefined): string {
  const month = value ?? currentMonth();
  if (!MONTH.test(month)) throw new UsageError(`Invalid --month "${month}", expected YYYY-MM`);
  return month;
}

function requireRoot(): string {
  const root = repoRoot(process.cwd());
  if (!root) throw new UsageError("Not inside a git repository. Run this from your project folder (or `git init` first).");
  return root;
}

async function main(argv: string[]): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      strict: true,
      options: {
        help: { type: "boolean", short: "h" },
        version: { type: "boolean", short: "v" },
        month: { type: "string" },
        fix: { type: "boolean" },
        json: { type: "boolean" },
        yes: { type: "boolean", short: "y" },
      },
    });
  } catch (err) {
    throw new UsageError((err as Error).message);
  }
  const { values, positionals } = parsed;

  if (values.version) {
    console.log(version());
    return 0;
  }
  const [command, ...extra] = positionals;
  if (values.help || !command) {
    console.log(HELP);
    return command || values.help ? 0 : 2;
  }
  if (extra.length) throw new UsageError(`Unexpected argument "${extra[0]}"`);

  const allowed: Record<string, string[]> = {
    init: ["yes"],
    check: ["month", "fix", "json"],
    "new-month": ["month"],
  };
  const flags = allowed[command];
  if (!flags) throw new UsageError(`Unknown command "${command}". Run \`client-changelog --help\`.`);
  for (const key of Object.keys(values)) {
    if (!flags.includes(key)) throw new UsageError(`Option --${key} doesn't apply to "${command}"`);
  }

  switch (command) {
    case "check": {
      const month = resolveMonth(values.month);
      const root = requireRoot();
      const { config } = loadConfig(root);
      const report = check({ root, month, config });
      const fixed = values.fix ? applyFix(root, report) : undefined;
      console.log(values.json ? renderJson(report, fixed) : renderText(report, fixed));
      return report.ok ? 0 : 1;
    }
    case "new-month": {
      const month = resolveMonth(values.month);
      const root = repoRoot(process.cwd()) ?? process.cwd();
      const { config } = loadConfig(root);
      const result = newMonth(root, month, config);
      if (!result.created) {
        console.error(`${result.file} already exists. Not overwriting it.`);
        return 1;
      }
      console.log(`Created ${result.file}`);
      return 0;
    }
    case "init": {
      const root = requireRoot();
      let yes = Boolean(values.yes);
      if (!yes && !process.stdin.isTTY) {
        console.log("No interactive terminal; using the defaults (same as --yes).\n");
        yes = true;
      }
      await init({ root, yes });
      return 0;
    }
  }
  return 2;
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (err: unknown) => {
    if (err instanceof UsageError || err instanceof ConfigError) {
      console.error(`client-changelog: ${err.message}`);
      process.exitCode = 2;
    } else {
      console.error(err);
      process.exitCode = 2;
    }
  },
);
