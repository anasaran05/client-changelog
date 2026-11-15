import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const CONFIG_FILE = "changelog.config.json";
export const SCHEMA_URL = "https://unpkg.com/client-changelog/schema.json";

export interface Config {
  /** Folder (relative to the repo root) that holds the month files. */
  dir: string;
  /** Title used in month file headings: "# <title> — November 2026". */
  title: string;
  /** Currency symbol for complimentary entries, e.g. "$", "€", "₹". */
  currency: string;
  /** Source keywords accepted besides commit hashes and `pending`. */
  sources: string[];
  /** Paths (relative to the repo root) whose commits never need an entry. */
  ignorePaths: string[];
  /** Entry sections, in order. */
  sections: string[];
}

export const DEFAULT_SECTIONS = [
  "Added",
  "Updated",
  "Removed",
  "Fixed",
  "Complimentary",
  "Internal (not shown to client)",
];

export const DEFAULT_CONFIG: Config = {
  dir: "changelog",
  title: "Website Changes",
  currency: "$",
  sources: ["manual"],
  ignorePaths: [],
  sections: DEFAULT_SECTIONS,
};

export class ConfigError extends Error {
  override name = "ConfigError";
}

const KEYWORD = /^[a-z][a-z0-9_-]*$/;
const HASH_LIKE = /^[0-9a-f]{7,40}$/;
const KNOWN_KEYS = new Set(["$schema", "dir", "title", "currency", "sources", "ignorePaths", "sections"]);

const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((s) => typeof s === "string");

/** Normalise a repo-relative path: forward slashes, no leading "./" or "/", no trailing "/". */
export function normalisePath(p: string): string {
  return p.replace(/\\/g, "/").replace(/^(\.\/)+/, "").replace(/^\/+/, "").replace(/\/+$/, "");
}

/** Validate a parsed config object, merging it over the defaults. Throws ConfigError. */
export function validateConfig(raw: unknown, where = CONFIG_FILE): Config {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new ConfigError(`${where}: expected a JSON object`);
  }
  const obj = raw as Record<string, unknown>;
  const errors: string[] = [];

  for (const key of Object.keys(obj)) {
    if (!KNOWN_KEYS.has(key)) errors.push(`unknown option "${key}"`);
  }

  const config: Config = { ...DEFAULT_CONFIG, sources: [...DEFAULT_CONFIG.sources], sections: [...DEFAULT_SECTIONS] };

  if ("dir" in obj) {
    const dir = obj.dir;
    if (typeof dir !== "string" || !normalisePath(dir) || normalisePath(dir).split("/").includes("..")) {
      errors.push(`"dir" must be a folder path inside the repo, e.g. "changelog"`);
    } else if (/^([a-zA-Z]:)?[\\/]/.test(dir)) {
      errors.push(`"dir" must be relative to the repo root, not an absolute path`);
    } else config.dir = normalisePath(dir);
  }

  if ("title" in obj) {
    if (typeof obj.title !== "string" || !obj.title.trim() || /[\r\n]/.test(obj.title)) {
      errors.push(`"title" must be a non-empty single-line string`);
    } else config.title = obj.title.trim();
  }

  if ("currency" in obj) {
    const c = obj.currency;
    if (typeof c !== "string" || !c.trim() || /[\s\d]/.test(c) || c.length > 5) {
      errors.push(`"currency" must be a short symbol or code without spaces or digits, e.g. "$", "€", "₹" or "USD"`);
    } else config.currency = c;
  }

  if ("sources" in obj) {
    if (!isStringArray(obj.sources)) {
      errors.push(`"sources" must be an array of strings`);
    } else {
      const bad = obj.sources.filter((s) => !KEYWORD.test(s) || HASH_LIKE.test(s));
      if (bad.length) {
        errors.push(
          `"sources" entries must be lowercase keywords (letters, digits, "-" or "_", starting with a letter) ` +
            `that don't look like commit hashes; invalid: ${bad.map((s) => JSON.stringify(s)).join(", ")}`,
        );
      } else config.sources = [...new Set(obj.sources.filter((s) => s !== "pending"))];
    }
  }

  if ("ignorePaths" in obj) {
    if (!isStringArray(obj.ignorePaths) || obj.ignorePaths.some((p) => !normalisePath(p))) {
      errors.push(`"ignorePaths" must be an array of non-empty paths relative to the repo root`);
    } else config.ignorePaths = obj.ignorePaths.map(normalisePath);
  }

  if ("sections" in obj) {
    const s = obj.sections;
    if (!isStringArray(s) || s.length === 0 || s.some((x) => !x.trim() || /[\r\n]/.test(x))) {
      errors.push(`"sections" must be a non-empty array of single-line section names`);
    } else config.sections = s.map((x) => x.trim());
  }

  if (errors.length) {
    throw new ConfigError(`Invalid ${where}:\n${errors.map((e) => `  - ${e}`).join("\n")}`);
  }
  return config;
}

/** Load `changelog.config.json` from the repo root, or return the defaults if it doesn't exist. */
export function loadConfig(root: string): { config: Config; found: boolean } {
  const path = join(root, CONFIG_FILE);
  if (!existsSync(path)) return { config: validateConfig({}), found: false };
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    throw new ConfigError(`Could not parse ${CONFIG_FILE}: ${(err as Error).message}`);
  }
  return { config: validateConfig(raw), found: true };
}
