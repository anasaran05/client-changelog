import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Config } from "./config.js";
import { monthName } from "./parse.js";
import { fillMonthTemplate, renderMonthTemplate } from "./templates.js";

export interface NewMonthResult {
  /** Path relative to the repo root. */
  file: string;
  created: boolean;
}

/** Month file contents for `month`, from `<dir>/_template.md` if present, else the built-in template. */
export function monthFileContent(root: string, month: string, config: Config): string {
  const custom = join(root, config.dir, "_template.md");
  const template = existsSync(custom) ? readFileSync(custom, "utf8") : renderMonthTemplate(config);
  return fillMonthTemplate(template, config.title, monthName(month));
}

/** Create `<dir>/<month>.md`. Never overwrites an existing file. */
export function newMonth(root: string, month: string, config: Config): NewMonthResult {
  const file = `${config.dir}/${month}.md`;
  const abs = join(root, file);
  if (existsSync(abs)) return { file, created: false };
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, monthFileContent(root, month, config), { flag: "wx" });
  return { file, created: true };
}
