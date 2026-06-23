import { getUpcomingDeadlines } from "@event/core";

export const runtime = "nodejs";
// Snapshot is hot-reloaded from a runtime file on the VM; keep this dynamic.
export const dynamic = "force-dynamic";

/** Upcoming deadlines, on the server's real wall clock. */
export function GET() {
  return Response.json({ deadlines: getUpcomingDeadlines() });
}
