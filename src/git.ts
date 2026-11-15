import { execFileSync } from "node:child_process";

/** Run git with literal arguments (never through a shell) and return stdout. */
export function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", ["-c", "core.quotePath=false", ...args], {
    cwd,
    encoding: "utf8",
    maxBuffer: 64 << 20,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

/** The repository root containing `cwd`, or `undefined` outside a git repo. */
export function repoRoot(cwd: string): string | undefined {
  try {
    return git(cwd, "rev-parse", "--show-toplevel").trim();
  } catch {
    return undefined;
  }
}

/** True when the repo has at least one commit. */
export function hasCommits(root: string): boolean {
  try {
    git(root, "rev-parse", "--verify", "--quiet", "HEAD");
    return true;
  } catch {
    return false;
  }
}

/** True when `ref` resolves to a commit. */
export function commitExists(root: string, ref: string): boolean {
  try {
    git(root, "rev-parse", "--verify", "--quiet", `${ref}^{commit}`);
    return true;
  } catch {
    return false;
  }
}
