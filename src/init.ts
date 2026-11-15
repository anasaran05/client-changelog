import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline/promises";
import { CONFIG_FILE, SCHEMA_URL, DEFAULT_CONFIG, loadConfig, validateConfig, type Config } from "./config.js";
import { newMonth } from "./new-month.js";
import { currentMonth } from "./parse.js";
import { MARKER_START, renderLogCommand, renderMonthTemplate, renderReadme, renderRuleBlock } from "./templates.js";

export type AgentChoice = "CLAUDE.md" | "AGENTS.md" | "both" | "none";

export interface InitAnswers {
  dir: string;
  title: string;
  currency: string;
  extraSources: string[];
  agentFiles: AgentChoice;
  logCommand: boolean;
}

export interface InitOptions {
  root: string;
  /** Use defaults without asking. */
  yes: boolean;
  /** Where to print progress. */
  log?: (line: string) => void;
  /** Override the prompt (tests). */
  ask?: (question: string, fallback: string) => Promise<string>;
}

type Outcome = { path: string; status: "created" | "updated" | "skipped"; note?: string };

/** Agent file(s) to use by default: whichever already exist, else CLAUDE.md. */
export function defaultAgentChoice(root: string): AgentChoice {
  const claude = existsSync(join(root, "CLAUDE.md"));
  const agents = existsSync(join(root, "AGENTS.md"));
  if (claude && agents) return "both";
  if (agents) return "AGENTS.md";
  return "CLAUDE.md";
}

function parseAgentChoice(answer: string, fallback: AgentChoice): AgentChoice {
  const a = answer.trim().toLowerCase();
  if (!a) return fallback;
  if (a.startsWith("c")) return "CLAUDE.md";
  if (a.startsWith("a")) return "AGENTS.md";
  if (a.startsWith("b")) return "both";
  if (a.startsWith("n")) return "none";
  return fallback;
}

const parseYesNo = (answer: string, fallback: boolean) => {
  const a = answer.trim().toLowerCase();
  if (!a) return fallback;
  return a.startsWith("y");
};

function writeNew(root: string, path: string, content: string, outcomes: Outcome[]) {
  const abs = join(root, path);
  if (existsSync(abs)) {
    outcomes.push({ path, status: "skipped", note: "already exists" });
    return;
  }
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content, { flag: "wx" });
  outcomes.push({ path, status: "created" });
}

function addRuleBlock(root: string, file: string, config: Config, outcomes: Outcome[]) {
  const abs = join(root, file);
  const block = renderRuleBlock(config);
  if (!existsSync(abs)) {
    writeFileSync(abs, block, { flag: "wx" });
    outcomes.push({ path: file, status: "created", note: "with the change-log rules" });
    return;
  }
  const current = readFileSync(abs, "utf8");
  if (current.includes(MARKER_START)) {
    outcomes.push({ path: file, status: "skipped", note: "change-log rules already present" });
    return;
  }
  const sep = current.length === 0 ? "" : current.endsWith("\n\n") ? "" : current.endsWith("\n") ? "\n" : "\n\n";
  writeFileSync(abs, current + sep + block);
  outcomes.push({ path: file, status: "updated", note: "appended the change-log rules" });
}

function addScript(root: string, outcomes: Outcome[]) {
  const abs = join(root, "package.json");
  if (!existsSync(abs)) return;
  const text = readFileSync(abs, "utf8");
  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(text);
  } catch {
    outcomes.push({ path: "package.json", status: "skipped", note: "couldn't parse it; add the script by hand" });
    return;
  }
  const scripts = (pkg.scripts ?? {}) as Record<string, string>;
  if (typeof scripts !== "object" || Array.isArray(scripts)) {
    outcomes.push({ path: "package.json", status: "skipped", note: '"scripts" isn\'t an object' });
    return;
  }
  if ("changelog:check" in scripts) {
    outcomes.push({ path: "package.json", status: "skipped", note: '"changelog:check" script already exists' });
    return;
  }
  pkg.scripts = { ...scripts, "changelog:check": "client-changelog check" };
  const indent = text.match(/^[ \t]+(?=")/m)?.[0] ?? "  ";
  writeFileSync(abs, JSON.stringify(pkg, null, indent) + (text.endsWith("\n") ? "\n" : ""));
  outcomes.push({ path: "package.json", status: "updated", note: 'added the "changelog:check" script' });
}

async function promptAnswers(opts: InitOptions, existing: Config | undefined): Promise<InitAnswers> {
  const agentDefault = defaultAgentChoice(opts.root);
  const defaults: InitAnswers = {
    dir: existing?.dir ?? DEFAULT_CONFIG.dir,
    title: existing?.title ?? DEFAULT_CONFIG.title,
    currency: existing?.currency ?? DEFAULT_CONFIG.currency,
    extraSources: existing?.sources.filter((s) => s !== "manual") ?? [],
    agentFiles: agentDefault,
    logCommand: true,
  };
  if (opts.yes) return defaults;

  const ask = opts.ask ?? (await makeAsker());
  try {
    const a = { ...defaults };
    if (!existing) {
      a.dir = (await ask("Changelog folder", defaults.dir)).trim() || defaults.dir;
      a.title = (await ask("Title for month files", defaults.title)).trim() || defaults.title;
      a.currency = (await ask("Currency symbol for complimentary work (e.g. $, €, £, ₹)", defaults.currency)).trim() || defaults.currency;
      const extra = await ask("Extra source keywords, comma-separated (e.g. sanity, shopify)", "");
      a.extraSources = extra.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    }
    a.agentFiles = parseAgentChoice(
      await ask("Add the change-log rules to which agent file? CLAUDE.md / AGENTS.md / both / none", agentDefault),
      agentDefault,
    );
    a.logCommand = parseYesNo(await ask("Install the /log command for Claude Code? (y/n)", "y"), true);
    return a;
  } finally {
    (ask as { close?: () => void }).close?.();
  }
}

async function makeAsker() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = async (question: string, fallback: string) => {
    const answer = await rl.question(`${question}${fallback ? ` (${fallback})` : ""}: `);
    return answer.trim() === "" ? fallback : answer;
  };
  return Object.assign(ask, { close: () => rl.close() });
}

/** Set up client-changelog in a repo. Never overwrites existing files. */
export async function init(opts: InitOptions): Promise<Outcome[]> {
  const log = opts.log ?? ((line: string) => console.log(line));
  const { root } = opts;
  const outcomes: Outcome[] = [];

  const { config: existing, found } = loadConfig(root);
  if (found) log(`Using the existing ${CONFIG_FILE}.\n`);
  const answers = await promptAnswers(opts, found ? existing : undefined);

  let config: Config;
  if (found) {
    config = existing;
    outcomes.push({ path: CONFIG_FILE, status: "skipped", note: "already exists" });
  } else {
    const raw = {
      $schema: SCHEMA_URL,
      dir: answers.dir,
      title: answers.title,
      currency: answers.currency,
      sources: [...new Set(["manual", ...answers.extraSources])],
      ignorePaths: [] as string[],
      sections: DEFAULT_CONFIG.sections,
    };
    config = validateConfig(raw, "your answers");
    writeNew(root, CONFIG_FILE, JSON.stringify({ ...raw, dir: config.dir }, null, 2) + "\n", outcomes);
  }

  const month = currentMonth();
  writeNew(root, `${config.dir}/README.md`, renderReadme(config, month), outcomes);
  writeNew(root, `${config.dir}/_template.md`, renderMonthTemplate(config), outcomes);
  const nm = newMonth(root, month, config);
  outcomes.push(nm.created ? { path: nm.file, status: "created" } : { path: nm.file, status: "skipped", note: "already exists" });

  if (answers.logCommand) writeNew(root, ".claude/commands/log.md", renderLogCommand(config), outcomes);

  const agentFiles =
    answers.agentFiles === "both" ? ["CLAUDE.md", "AGENTS.md"] : answers.agentFiles === "none" ? [] : [answers.agentFiles];
  for (const f of agentFiles) addRuleBlock(root, f, config, outcomes);

  addScript(root, outcomes);

  // --- summary ---
  const label = { created: "created ", updated: "updated ", skipped: "skipped " } as const;
  for (const o of outcomes) log(`  ${label[o.status]} ${o.path}${o.note ? ` (${o.note})` : ""}`);
  const changed = outcomes.some((o) => o.status !== "skipped");
  log("");
  if (!changed) {
    log("client-changelog is already set up here. Nothing changed.");
  } else {
    log("Next steps:");
    log("  1. npm i -D client-changelog     # so `npm run changelog:check` works offline");
    log(`  2. Commit the new files. Your agent will now log changes in ${config.dir}/${month}.md.`);
    if (answers.logCommand) log("  3. Use /log in Claude Code for changes made outside the code.");
    log(`  ${answers.logCommand ? 4 : 3}. Run \`npx client-changelog check\` to cross-check the month against git.`);
  }
  return outcomes;
}
