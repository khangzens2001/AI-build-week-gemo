import { getNextSessions, getVenueById } from "@event/core";

export const runtime = "nodejs";
// Snapshot is hot-reloaded from a runtime file on the VM; keep this dynamic.
export const dynamic = "force-dynamic";

/** Upcoming sessions after now, on the server's real wall clock. */
export function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit") ?? "5");
  const sessions = getNextSessions(undefined, Number.isNaN(limit) ? 5 : limit).map((s) => {
    const venue = getVenueById(s.venueId);
    return {
      id: s.id,
      title: s.title,
      day: s.day,
      startsAt: s.startsAt,
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
