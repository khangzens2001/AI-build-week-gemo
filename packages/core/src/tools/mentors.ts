import { tool } from "ai";
import { z } from "zod";
import { getMentorById, listMentors } from "../userdata";

/**
 * Mentor / office-hours agent tools (AI SDK v6: `tool({ description,
 * inputSchema, execute })`).
 *
 * `findMentor` is a pure read over the mentors table (only free slots). Every
 * mentor carries `sourceUrl` so the client can render a citation.
 *
 * `bookOfficeHours` is an INTENT tool — like `setReminder`/`addChecklistItem`,
 * it returns a structured intent the UI renders as a one-tap confirm action.
 * The authenticated write happens in the API route (`/api/office-hours/book`),
 * so chat tools stay auth-free.
 */
export const mentorTools = {
  findMentor: tool({
    description:
      "Find a mentor by expertise/topic for office hours when a builder is stuck. Returns matching mentors with their free slots.",
    inputSchema: z.object({
      query: z.string().describe("the problem area, e.g. 'postgres scaling' or 'pitch'"),
    }),
    execute: async ({ query }) => {
      const mentors = await listMentors(query);
      return {
        mentors: mentors.map((m) => ({
          id: m.id,
          name: m.name,
          title: m.title,
          org: m.org,
          expertise: m.expertise,
          slots: m.slots.map((s) => ({
            id: s.id,
            startsAt: s.startsAt,
            endsAt: s.endsAt,
          })),
          sourceUrl: m.sourceUrl,
        })),
      };
    },
  }),

  bookOfficeHours: tool({
    description:
      "Propose booking a mentor office-hours slot. Returns an intent the user taps to confirm.",
    inputSchema: z.object({
      mentorId: z.string(),
      slotId: z.string(),
      topic: z.string().nullable().default(null),
    }),
    execute: async ({ mentorId, slotId, topic }) => {
      const mentor = await getMentorById(mentorId);
      const matched = mentor?.slots.find((s) => s.id === slotId) ?? null;
      return {
        intent: {
          mentorId,
          slotId,
          topic,
          mentorName: mentor?.name ?? null,
          slot: matched ?? null,
        },
        confirmable: Boolean(mentor && matched),
        message: matched ? "Tap to book this slot." : "That slot isn't available.",
      };
    },
  }),
};
