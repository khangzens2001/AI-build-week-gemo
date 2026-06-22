import { getUpcomingDeadlines } from "@event/core";

export const runtime = "nodejs";
// Snapshot is hot-reloaded from a runtime file on the VM; keep this dynamic.
export const dynamic = "force-dynamic";

/** Upcoming deadlines. The client forwards its demo clock via `?now=` (the
 * server's own clock is frozen); falls back to the server default. */
export function GET(req: Request) {
  const nowParam = Number(new URL(req.url).searchParams.get("now"));
  const now = Number.isNaN(nowParam) ? undefined : nowParam;
  return Response.json({ deadlines: getUpcomingDeadlines(now) });
}
