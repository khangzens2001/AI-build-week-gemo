import { tool } from "ai";
import { z } from "zod";
import {
  allPerks,
  findSessions,
  getDeadlineById,
  getNextSessions,
  getNowSessions,
  getSessionById,
  getUpcomingDeadlines,
  getVenueById,
  sessionsOnDay,
} from "./data";
import { retrieve } from "./retrieve";
import { formatTimeLabel, getCurrentTime } from "./time";
import { announcementTools } from "./tools/announcements";
import { checklistTools } from "./tools/checklist";
import { mentorTools } from "./tools/mentors";

/**
 * Agent tools (AI SDK v6: `tool({ description, inputSchema, execute })`).
 *
 * All tools are pure reads over the bundled snapshot / Chroma except
 * `setReminder`, which returns a structured intent the UI renders as a confirm
 * action — the authenticated write happens in the API route, so chat tools stay
 * auth-free. Every tool returns `sourceUrl`s where available so the client can
 * render citations from tool output.
 */

function sessionView(s: ReturnType<typeof getSessionById>) {
  if (!s) return null;
  const venue = getVenueById(s.venueId);
  return {
    id: s.id,
    title: s.title,
    day: s.day,
    dayTheme: s.dayTheme,
    time:
      s.startTimeLabel && s.endTimeLabel
        ? `${s.startTimeLabel}–${s.endTimeLabel}`
        : (s.startTimeLabel ?? null),
    startsAt: s.startsAt ?? null,
    partner: s.partner,
    type: s.type,
    venue: venue ? { id: venue.id, name: venue.name, mapUrl: venue.mapUrl } : null,
    registrationUrl: s.registrationUrl,
    sourceUrl: s.sourceUrl,
  };
}

export const tools = {
  searchKnowledge: tool({
    description:
      "Search the Agentic AI Build Week knowledge base (sessions, FAQ, perks, partners) for anything not covered by the structured tools. Returns text chunks with source URLs to cite.",
    inputSchema: z.object({
      query: z.string().describe("The user's question or search terms"),
    }),
    execute: async ({ query }) => {
      const chunks = await retrieve(query, 6);
      return {
        chunks: chunks.map((c) => ({ text: c.text, type: c.type, sourceUrl: c.sourceUrl })),
      };
    },
  }),

  getNow: tool({
    description:
      "Get the sessions happening right now at the event. Use for 'what's on now' / 'what's happening'.",
    inputSchema: z.object({}),
    execute: async () => {
      const now = getCurrentTime();
      return {
        now: formatTimeLabel(now),
        sessions: getNowSessions(now).map(sessionView),
      };
    },
  }),

  getNext: tool({
    description:
      "Get the upcoming sessions starting after now. Use for 'what's next' / 'what should I do next'.",
    inputSchema: z.object({
      limit: z.number().int().min(1).max(10).default(5),
    }),
    execute: async ({ limit }) => {
      const now = getCurrentTime();
      return {
        now: formatTimeLabel(now),
        sessions: getNextSessions(now, limit).map(sessionView),
      };
    },
  }),

  findWorkshops: tool({
    description:
      "Find sessions/workshops matching a keyword, partner, theme, or topic. Optionally filter to a specific event day.",
    inputSchema: z.object({
      query: z.string().describe("Keyword, partner name, theme, or topic"),
      day: z
        .string()
        .nullable()
        .default(null)
        .describe("Optional ISO date filter, e.g. 2026-07-08"),
    }),
    execute: async ({ query, day }) => {
      let results = findSessions(query);
      if (day) results = results.filter((s) => s.day === day);
      return { sessions: results.map(sessionView) };
    },
  }),

  getSchedule: tool({
    description: "Get the full schedule for a specific event day (ISO date).",
    inputSchema: z.object({
      day: z.string().describe("ISO date, e.g. 2026-07-08 (Day 1) through 2026-07-12 (Day 5)"),
    }),
    execute: async ({ day }) => {
      return { day, sessions: sessionsOnDay(day).map(sessionView) };
    },
  }),

  getDirections: tool({
    description:
      "Get the venue location and a Google Maps link for a session (or venue). Use for 'where is X' / 'how do I get there'.",
    inputSchema: z.object({
      sessionId: z
        .string()
        .nullable()
        .default(null)
        .describe("Session id to locate; omit to resolve by query"),
      query: z
        .string()
        .nullable()
        .default(null)
        .describe("Session title/keyword if no id is known"),
    }),
    execute: async ({ sessionId, query }) => {
      const session = sessionId
        ? getSessionById(sessionId)
        : query
          ? findSessions(query)[0]
          : undefined;
      // Fallback chain: session → venue → coords/mapUrl.
      const venue = getVenueById(session?.venueId);
      if (!venue) {
        return { found: false, message: "No venue found for that session." };
      }
      const mapUrl =
        venue.mapUrl ??
        (venue.lat != null && venue.lng != null
          ? `https://www.google.com/maps/search/?api=1&query=${venue.lat}%2C${venue.lng}`
          : null);
      return {
        found: true,
        session: session ? { id: session.id, title: session.title } : null,
        venue: {
          name: venue.name,
          address: venue.address,
          city: venue.city,
          lat: venue.lat,
          lng: venue.lng,
          mapUrl,
        },
      };
    },
  }),

  listPerks: tool({
    description:
      "List the sponsor/partner perks and credits available to builders (e.g. cloud credits, accelerator access, prizes). Includes how to claim and source links.",
    inputSchema: z.object({}),
    execute: async () => {
      return {
        perks: allPerks().map((p) => ({
          title: p.title,
          provider: p.provider,
          value: p.value,
          howToClaim: p.howToClaim,
          eligibility: p.eligibility,
          link: p.link,
          sourceUrl: p.sourceUrl,
        })),
      };
    },
  }),

  getDeadlines: tool({
    description:
      "Get upcoming deadlines (hackathon submission, registration). Use for 'when is X due' / 'deadlines'.",
    inputSchema: z.object({}),
    execute: async () => {
      const now = getCurrentTime();
      return {
        deadlines: getUpcomingDeadlines(now).map((d) => ({
          title: d.title,
          type: d.type,
          due: d.dueAt ? formatTimeLabel(d.dueAt) : "open",
          dueAt: d.dueAt,
          link: d.link,
          sourceUrl: d.sourceUrl,
        })),
      };
    },
  }),

  setReminder: tool({
    description:
      "Propose a reminder for a session or deadline. Returns a reminder intent the user confirms with one tap (the app then schedules it). Use when the user asks to be reminded.",
    inputSchema: z.object({
      targetId: z.string().describe("The session or deadline id to be reminded about"),
      targetKind: z.enum(["session", "deadline"]).default("session"),
      minutesBefore: z
        .number()
        .int()
        .min(0)
        .max(1440)
        .default(15)
        .describe("How many minutes before the start/due time to fire"),
    }),
    execute: async ({ targetId, targetKind, minutesBefore }) => {
      // Resolve the fire time from a session start or a deadline due time.
      const startsAt =
        targetKind === "deadline"
          ? (getDeadlineById(targetId)?.dueAt ?? null)
          : (getSessionById(targetId)?.startsAt ?? null);
      const title =
        targetKind === "deadline"
          ? getDeadlineById(targetId)?.title
          : getSessionById(targetId)?.title;
      const fireAt = startsAt != null ? startsAt - minutesBefore * 60_000 : null;
      return {
        intent: {
          targetId,
          targetKind,
          minutesBefore,
          fireAt,
          label: title ? `${title} starts soon` : "Reminder",
        },
        confirmable: fireAt != null,
        message: fireAt
          ? `Tap to set a reminder ${minutesBefore} min before.`
          : "This item has no scheduled time to remind on.",
      };
    },
  }),

  // Feature tools (Cue Pulse, Checklist, Mentors) live in ./tools/* and are
  // merged here so the agent sees one flat tool set. Each group keeps its own
  // file so feature lanes never edit this barrel in parallel.
  ...announcementTools,
  ...checklistTools,
  ...mentorTools,
};

export type EventTools = typeof tools;
