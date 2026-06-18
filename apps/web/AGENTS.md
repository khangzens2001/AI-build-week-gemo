# apps/web — Next.js PWA + API (Vercel)

**Responsibility:** mobile-first PWA UI + Next.js Route Handlers, including the chat/agent endpoint.

## Key facts
- Runs on **Vercel Node runtime**; Bun is for local dev/build only.
- `app/api/chat/route.ts`: `streamText({ model: google(process.env.GEMINI_CHAT_MODEL), tools, stopWhen: stepCountIs(5), providerOptions: { google: { thinkingConfig: { thinkingLevel: 'low' } } } }).toUIMessageStreamResponse()`. Spec: plan §10.2.
- Client chat uses **`useChat` from `@ai-sdk/react`**; render `message.parts` (text + tool parts), not a plain string. Plan §10.3.
- **Data access:** call `workers/data-api` (Option A) or `d1Query` REST helper from `packages/core` (Option B). Do **not** import `drizzle-orm/d1` here.
- PWA via **Serwist** (`@serwist/next`): manifest + service worker, offline-cache the schedule.
- Set `export const maxDuration` on streaming routes to avoid function timeouts.
- Dev: `bun run dev`.
