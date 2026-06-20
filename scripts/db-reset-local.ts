/**
 * Reset the LOCAL dev D1 (bun:sqlite file) to a clean migrated + seeded state.
 * Deletes the db file, applies the Drizzle migration(s), then loads the
 * generated seed.sql — so it is fully idempotent (safe to run any time you want
 * to wipe local user data + reload event rows). It is NOT part of `dev:local`,
 * so reminders you create while testing survive normal restarts.
 *
 * Usage:  bun run scripts/db-reset-local.ts        (db: .local/d1.sqlite)
 *         D1_LOCAL_DB=/tmp/x.sqlite bun run scripts/db-reset-local.ts
 */

import { Database } from "bun:sqlite";
import { readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { localDbPath, repoRoot } from "./local-db-path";

const dbPath = localDbPath();
const root = repoRoot();
const migrationsDir = join(root, "drizzle", "migrations");
const seedFile = join(root, "drizzle", "seed.sql");

// Always rebuild from scratch — the migrations use plain CREATE TABLE (no
// IF NOT EXISTS), so re-applying onto an existing db would throw. Deleting first
// makes "reset" truly idempotent and sidesteps partial-application on error.
for (const suffix of ["", "-wal", "-shm"]) {
  rmSync(`${dbPath}${suffix}`, { force: true });
}

const db = new Database(dbPath);
db.exec("PRAGMA foreign_keys = ON;");

// Apply every .sql migration in order. Drizzle separates statements with a
// `--> statement-breakpoint` marker; bun:sqlite's exec runs multi-statement SQL,
// so we just strip the markers and exec the whole file.
const migrations = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

for (const file of migrations) {
  const sql = readFileSync(join(migrationsDir, file), "utf8").replaceAll(
    "--> statement-breakpoint",
    "",
  );
  db.exec(sql);
  console.log(`[db:reset:local] applied migration ${file}`);
}

// Load the generated seed rows (DELETE + INSERT batch).
db.exec(readFileSync(seedFile, "utf8"));
console.log("[db:reset:local] applied drizzle/seed.sql");

// Load hand-written feature seed (mock account, announcements, mentors, teams).
// Runs AFTER seed.sql since it references users/teams. Optional — skip if absent.
const featureSeedFile = join(root, "drizzle", "seed-features.sql");
try {
  db.exec(readFileSync(featureSeedFile, "utf8"));
  console.log("[db:reset:local] applied drizzle/seed-features.sql");
} catch (err) {
  if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  console.log("[db:reset:local] no seed-features.sql — skipped");
}

const count = (t: string) => (db.query(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n;
console.log(
  `[db:reset:local] done → sessions ${count("sessions")}, venues ${count("venues")}, ` +
    `perks ${count("perks")}, deadlines ${count("deadlines")}  (db: ${dbPath})`,
);
