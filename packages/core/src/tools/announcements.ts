import { tool } from "ai";
import { z } from "zod";
import { listAnnouncements } from "../userdata";

/**
 * Cue Pulse agent tool (AI SDK v6: `tool({ description, inputSchema, execute })`).
 *
 * Read-only over the announcements table via the `listAnnouncements` userdata
 * helper. Every announcement carries `sourceUrl` so the client can render a
 * citation — the agent must never fabricate a change without a source.
 */
export const announcementTools = {
  getAnnouncements: tool({
    description:
      "Get the latest live event announcements and schedule/room/perk changes (Cue Pulse). Use when the user asks 'any updates?', 'what changed?', or about room moves.",
    inputSchema: z.object({
      limit: z.number().int().min(1).max(20).default(10),
    }),
    execute: async ({ limit }) => {
      const rows = await listAnnouncements(limit);
      return {
        announcements: rows.map((row) => ({
          title: row.title,
          body: row.body,
          kind: row.kind,
          severity: row.severity,
          sourceUrl: row.source_url,
          createdAt: row.created_at,
        })),
      };
    },
  }),
};
