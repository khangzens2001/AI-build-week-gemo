/**
 * Client-facing shapes returned by the app's API routes. These mirror the
 * route handlers in app/api/** (which project @event/core records down to just
 * what the UI needs). Kept here so components import from one place.
 */

export type VenueRef = { id: string; name: string; mapUrl: string | null };

export type SessionType =
  | "workshop"
  | "keynote"
  | "session"
  | "break"
  | "networking"
  | "administrative"
  | (string & {});

export type Tone = "workshop" | "signature" | "break" | (string & {});

/** /api/now row */
export type NowSession = {
  id: string;
  title: string;
  startTimeLabel: string | null;
  endTimeLabel: string | null;
  partner: string | null;
  type: SessionType | null;
  venue: VenueRef | null;
  coverImage: string | null;
};

/** /api/next row */
export type NextSession = {
  id: string;
  title: string;
  day: string | null;
  startsAt: number | null;
  startTimeLabel: string | null;
  endTimeLabel: string | null;
  partner: string | null;
  type: SessionType | null;
  venue: VenueRef | null;
  coverImage: string | null;
};

/** /api/schedule row */
export type ScheduleSession = {
  id: string;
  title: string;
  day: string | null;
  dayNumber: number | null;
  dayTheme: string | null;
  startsAt: number | null;
  endsAt: number | null;
  startTimeLabel: string | null;
  endTimeLabel: string | null;
  partner: string | null;
  type: SessionType | null;
  tone: Tone | null;
  venue: VenueRef | null;
  registrationUrl: string | null;
  coverImage: string | null;
};

export type Venue = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
  mapUrl: string | null;
  imageUrl: string | null;
};

export type Perk = {
  id: string;
  title: string;
  provider: string | null;
  value: string | null;
  howToClaim: string | null;
  eligibility: string | null;
  link: string | null;
  sourceUrl: string | null;
};

export type Deadline = {
  id: string;
  title: string;
  dueAt: number | null;
  type: string | null;
  link: string | null;
  sourceUrl: string | null;
};

export type Reminder = {
  id: string;
  targetId: string;
  targetKind: string;
  fireAt: number;
  label: string | null;
};

/** The five event days, with themes — used by the schedule switcher. */
export const EVENT_DAYS = [
  { day: "2026-07-08", number: 1, theme: "Enable" },
  { day: "2026-07-09", number: 2, theme: "Integrate" },
  { day: "2026-07-10", number: 3, theme: "Design" },
  { day: "2026-07-11", number: 4, theme: "Build" },
  { day: "2026-07-12", number: 5, theme: "Demo" },
] as const;

export type EventDay = (typeof EVENT_DAYS)[number];
