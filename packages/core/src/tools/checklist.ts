import { tool } from "ai";
import { z } from "zod";
import { getDeadlineById, getSessionById } from "../data";

/**
 * Checklist ("FOMO Killer") agent tool (AI SDK v6: `tool({ description,
 * inputSchema, execute })`).
 *
 * `addChecklistItem` is an INTENT tool — like `setReminder`, it returns a
 * structured intent the UI renders as a one-tap confirm action. The
 * authenticated write happens in the API route (`/api/checklist`), so chat
 * tools stay auth-free. For session/deadline targets it resolves the
 * start/due time and computes a `fireAt` when `minutesBefore` is set.
 */
export const checklistTools = {
  addChecklistItem: tool({
    description:
      "Propose adding a session, deadline, or custom task to the user's checklist. Returns an intent the user taps to confirm; the app saves it.",
    inputSchema: z.object({
      title: z.string().describe("The checklist item title"),
      targetId: z
        .string()
        .nullable()
        .default(null)
        .describe("The session/deadline id this item bookmarks, if any"),
      targetType: z.enum(["session", "deadline", "perk", "submission", "custom"]).default("custom"),
      notes: z.string().nullable().default(null).describe("Optional freeform notes"),
      minutesBefore: z
        .number()
        .int()
        .min(0)
        .max(1440)
        .nullable()
        .default(null)
        .describe("Minutes before the session start / deadline due time to fire a reminder"),
    }),
    execute: async ({ title, targetId, targetType, notes, minutesBefore }) => {
      // Resolve a base time for session/deadline targets, then compute fireAt
      // when the user wants a reminder ahead of it.
      let baseAt: number | null = null;
      if (targetId) {
        if (targetType === "session") {
          baseAt = getSessionById(targetId)?.startsAt ?? null;
        } else if (targetType === "deadline") {
          baseAt = getDeadlineById(targetId)?.dueAt ?? null;
        }
      }
      const fireAt =
        baseAt != null && minutesBefore != null ? baseAt - minutesBefore * 60_000 : null;
      return {
        intent: { title, targetId, targetType, notes, fireAt },
        confirmable: true,
        message: "Tap to add to your checklist.",
      };
    },
  }),
};
