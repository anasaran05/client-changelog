// Shared helpers: throwaway git repos in os.tmpdir() and a runner for the compiled CLI.
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { after } from "node:test";

export const CLI = fileURLToPath(new URL("../dist/cli.js", import.meta.url));

const made = [];
after(() => {
  for (const dir of made) rmSync(dir, { recursive: true, force: true });
});

// Fixed identity and dates so tests don't depend on the machine's git config or clock.
const GIT_ENV = {
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null",
};

export function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), "client-changelog-test-"));
  made.push(dir);
  const repo = new Repo(dir);
  repo.git("init", "-q", "-b", "main");
  repo.git("config", "user.name", "Test User");
  repo.git("config", "user.email", "test@example.com");
  repo.git("config", "commit.gpgsign", "false");
  return repo;
}

export class Repo {
  constructor(dir) {
    this.dir = dir;
  }

  git(...args) {
    return execFileSync("git", args, {
      cwd: this.dir,
      encoding: "utf8",
      env: { ...process.env, ...GIT_ENV },
      stdio: ["ignore", "pipe", "pipe"],
    });
  }

  write(path, content) {
    const abs = join(this.dir, path);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  }

  read(path) {
    return readFileSync(join(this.dir, path), "utf8");
  }

  /** Commit everything with a fixed author/committer date (YYYY-MM-DD, noon UTC). Returns the short hash. */
  commit(message, date, ...extra) {
    const stamp = `${date}T12:00:00+00:00`;
    this.git("add", "-A");
    execFileSync("git", ["commit", "-q", "-m", message, ...extra], {
      cwd: this.dir,
      env: { ...process.env, ...GIT_ENV, GIT_AUTHOR_DATE: stamp, GIT_COMMITTER_DATE: stamp },
      stdio: ["ignore", "pipe", "pipe"],
    });
    return this.git("rev-parse", "--short", "HEAD").trim();
  }

  /** Run the CLI in this repo. Returns { code, stdout, stderr }. */
  run(args, env = {}) {
    const r = spawnSync(process.execPath, [CLI, ...args], {
      cwd: this.dir,
      encoding: "utf8",
      env: { ...process.env, ...GIT_ENV, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: r.status, stdout: r.stdout, stderr: r.stderr };
  }
}

export const HEADER = (month = "2026-11") => `# Website Changes — ${month}\n\n## Added\n\n`;
export const NOTES = "\n---\n\n## Month-end notes\n\n- This line (abc) is a note, not an entry\n";

/** A month file with the given entry lines under "## Added". */
export const monthFile = (lines, month) => HEADER(month) + lines.map((l) => `${l}\n`).join("") + NOTES;
