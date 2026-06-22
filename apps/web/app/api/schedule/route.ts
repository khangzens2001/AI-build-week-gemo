import { getVenueById, sessionsByStart, sessionsOnDay } from "@event/core";

export const runtime = "nodejs";
// Snapshot is hot-reloaded from a runtime file on the VM (crawl→re-ingest loop),
// so the response must never be statically cached or new sessions won't show.
export const dynamic = "force-dynamic";

function withVenue(s: ReturnType<typeof sessionsByStart>[number]) {
  const venue = getVenueById(s.venueId);
  return {
    id: s.id,
    title: s.title,
    day: s.day,
    dayNumber: s.dayNumber,
    dayTheme: s.dayTheme,
    startsAt: s.startsAt,
    endsAt: s.endsAt,
    startTimeLabel: s.startTimeLabel,
    endTimeLabel: s.endTimeLabel,
    partner: s.partner,
    type: s.type,
    tone: s.tone,
    venue: venue ? { id: venue.id, name: venue.name, mapUrl: venue.mapUrl } : null,
    registrationUrl: s.registrationUrl,
    coverImage: s.coverImage ?? null,
  };
}

/** Full schedule, or a single day via ?day=2026-07-08. Public, snapshot-backed. */
export function GET(req: Request) {
  const day = new URL(req.url).searchParams.get("day");
  const sessions = (day ? sessionsOnDay(day) : sessionsByStart()).map(withVenue);
  return Response.json({ day: day ?? null, sessions });
}
