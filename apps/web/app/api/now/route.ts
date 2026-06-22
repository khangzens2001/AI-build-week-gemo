import { getNowSessions, getVenueById } from "@event/core";

export const runtime = "nodejs";
// Snapshot is hot-reloaded from a runtime file on the VM; keep this dynamic.
export const dynamic = "force-dynamic";

/** Sessions happening right now. The client forwards its demo clock via `?now=`
 * (the server's own clock is frozen); falls back to the server default. */
export function GET(req: Request) {
  const nowParam = Number(new URL(req.url).searchParams.get("now"));
  const now = Number.isNaN(nowParam) ? undefined : nowParam;
  const sessions = getNowSessions(now).map((s) => {
    const venue = getVenueById(s.venueId);
    return {
      id: s.id,
      title: s.title,
      startTimeLabel: s.startTimeLabel,
      endTimeLabel: s.endTimeLabel,
      partner: s.partner,
      type: s.type,
      venue: venue ? { id: venue.id, name: venue.name, mapUrl: venue.mapUrl } : null,
      coverImage: s.coverImage ?? null,
    };
  });
  return Response.json({ sessions });
}
