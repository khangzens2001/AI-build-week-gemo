import { ensureFeatureSchema } from "@event/core";

/**
 * Next.js instrumentation hook — runs once when the server process starts
 * (before handling requests). We use it to make the feature tables (Cue Pulse,
 * checklist, mentors, teams) self-healing on the VM deploy: the CI deploy key is
 * rsync-only and can't run migrations, and every deploy restarts this container,
 * so creating the tables here (idempotent, IF NOT EXISTS) means new schema lands
 * automatically without a manual SQL step.
 *
 * Only runs on the Node.js server runtime (not Edge / browser). Best-effort:
 * ensureFeatureSchema swallows + logs its own errors so a transient D1 outage
 * never blocks startup.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await ensureFeatureSchema();
  }
}
