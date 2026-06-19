import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/**
 * Single source of truth for the local dev D1 sqlite file path, so the shim
 * (scripts/d1-local.ts) and the reset script (scripts/db-reset-local.ts) never
 * diverge. Anchored to the repo root (not CWD) so it resolves to the same file
 * regardless of where the script is invoked from. Override with `D1_LOCAL_DB`.
 */
export function localDbPath(): string {
  const repoRoot = resolve(import.meta.dir, "..");
  const path = process.env.D1_LOCAL_DB ?? join(repoRoot, ".local/d1.sqlite");
  const resolved = resolve(path);
  mkdirSync(dirname(resolved), { recursive: true });
  return resolved;
}

export function repoRoot(): string {
  return resolve(import.meta.dir, "..");
}
