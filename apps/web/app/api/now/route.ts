import { getNowSessions, getVenueById } from "@event/core";

export const runtime = "nodejs";
// Snapshot is hot-reloaded from a runtime file on the VM; keep this dynamic.
export const dynamic = "force-dynamic";

/** Sessions happening right now, on the server's real wall clock. */
export function GET() {
  const sessions = getNowSessions().map((s) => {
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
