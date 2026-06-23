-- Cue FEATURE seed data (dev / demo). Hand-written, NOT generated.
-- Loaded by scripts/db-reset-local.ts AFTER the generated drizzle/seed.sql.
-- Provides: a seeded "mock account" user, sample Cue Pulse announcements,
-- mentors with office-hours slots, and a demo team + build log so every
-- feature has something to show in the browser without real sign-in/data.
--
-- Times are epoch ms (GMT+7), during Day 1–2 of the event (Jul 8–9 2026), so
-- they line up with the demo clock (DEMO_NOW=2026-07-08T10:30:00+07:00).

-- Mock account (matches MOCK_USER in apps/web/auth.ts).
DELETE FROM users WHERE id = 'mock-builder';
INSERT INTO users (id, email, name, image, google_sub, preferences, created_at, updated_at)
VALUES (
  'mock-builder',
  'builder@cue.dev',
  'Demo Builder',
  NULL,
  'mock-builder',
  '{"language":"en","skills":["typescript","react"],"topics":["ai","web"],"teamStatus":"looking"}',
  1783476000000,
  1783476000000
);

-- A second seeded user so team membership/build-log feed looks alive.
DELETE FROM users WHERE id = 'mock-builder-2';
INSERT INTO users (id, email, name, image, google_sub, preferences, created_at, updated_at)
VALUES (
  'mock-builder-2', 'mai@cue.dev', 'Mai Tran', NULL, 'mock-builder-2',
  NULL, 1783476000000, 1783476000000
);

-- ---- Cue Pulse: baseline announcements -----------------------------------
-- Real event data (deadline, schedule, perks, venues) drawn from the crawler's
-- snapshot — NOT mock copy. These give the feed useful content from the start of
-- the event; the auto-crawl→/api/ingest/hook loop adds further items only when it
-- detects a genuine change. Every row cites its real source_url.
--
-- created_at is RELATIVE to the moment this seed runs: `unixepoch('now')*1000`
-- minus a per-row offset (newest first). The app's Pulse feed shows "Xm ago"
-- from a real wall clock (DEMO_NOW is unset in prod), so absolute epoch values
-- baked to July 8 would render as "now" forever (15 days in the future). Anchor
-- to now instead, staggered ~3 min apart, so the feed always reads a sensible
-- "2m / 5m / 8m ago" ladder no matter when the DB is (re)seeded: action-first
-- deadline on top, then schedule, then perks, then venues.
DELETE FROM announcements;
INSERT INTO announcements (id, kind, title, body, severity, target_id, source_url, created_at) VALUES
  ('reg-deadline', 'deadline', 'Register for Agentic AI Build Week', 'RSVP to secure your spot. Registration is open now on Luma — badge pickup is at Tasco Office.', 'important', NULL, 'https://luma.com/gaf-hm61?utm_source=landing_page', unixepoch('now') * 1000 - 120000),
  ('day1-live', 'schedule', 'Day 1 schedule is live', 'Day 1 (July 8) sessions from BytePlus, Tencent Cloud and NVIDIA are now published. Doors and registration open at 09:00.', 'info', NULL, 'https://agenticaibuildweek.genaifund.ai/#daily_schedule', unixepoch('now') * 1000 - 300000),
  ('perk-builder-prize', 'perk', 'Builder Experience Track Prize', 'Win $900 + an AABW tee, and the winning build gets deployed live to thousands.', 'important', NULL, 'https://agenticaibuildweek.genaifund.ai/builder-experience-track', unixepoch('now') * 1000 - 480000),
  ('perk-byteplus', 'perk', 'BytePlus V-START credits', 'Up to $15,000 in AI & cloud credits for qualifying startups — apply via the BytePlus workshop on Day 1.', 'info', NULL, 'https://luma.com/gaf-vbkf', unixepoch('now') * 1000 - 660000),
  ('perk-nvidia', 'perk', 'NVIDIA Inception benefits', 'Free NVIDIA DLI course for every participant, plus Inception startup benefits: compute, capital and connections.', 'info', NULL, 'https://luma.com/gaf-t4bs', unixepoch('now') * 1000 - 840000),
  ('perk-apify', 'perk', 'Apify platform credits', '$25 in Apify platform credits, with top-ups available at the Apify booth.', 'info', NULL, 'https://luma.com/gaf-umu5', unixepoch('now') * 1000 - 1020000),
  ('venues-confirmed', 'venue', 'Venues confirmed across HCMC', 'Sessions run at Tasco Office (main hub), AWS Office at Bitexco Tower, VNG Campus (Q7) and Galaxy Innovation Park. Check the Map tab for directions.', 'info', NULL, 'https://agenticaibuildweek.genaifund.ai/', unixepoch('now') * 1000 - 1200000);

-- ---- Mentors --------------------------------------------------------------
-- Mentors are now GENERATED from real event speakers by the seed transform
-- (packages/ingest/src/seed/buildMentors) and live in drizzle/seed.sql, which
-- db-reset-local.ts applies BEFORE this file. We must NOT re-DELETE/INSERT them
-- here or the crawl-derived rows get clobbered by stale hand-written ones.
-- (Office-hours bookings FK to mentors(id); the generated ids are stable slugs.)

-- ---- Demo team + build log (public feed) ---------------------------------
DELETE FROM build_logs;
DELETE FROM team_members;
DELETE FROM teams;
INSERT INTO teams (id, name, tagline, looking_for, created_by, created_at) VALUES
  ('team-cue', 'Team Cue', 'Building the event copilot for AABW', '["designer","ml engineer"]', 'mock-builder', 1783476000000),
  ('team-vectorize', 'Vectorize', 'Realtime RAG over conference data', '["frontend"]', 'mock-builder-2', 1783476600000);

INSERT INTO team_members (team_id, user_id, role, joined_at) VALUES
  ('team-cue', 'mock-builder', 'founder', 1783476000000),
  ('team-cue', 'mock-builder-2', 'member', 1783477000000),
  ('team-vectorize', 'mock-builder-2', 'founder', 1783476600000);

INSERT INTO build_logs (id, team_id, user_id, body, created_at) VALUES
  ('log-1', 'team-cue', 'mock-builder', 'Day 1: scaffolded the PWA, wired Google sign-in, and got the now/next home screen rendering. Next up: chat agent.', 1783480000000),
  ('log-2', 'team-cue', 'mock-builder-2', 'Hooked up the schedule navigator and bookmarking. Checklist progress bar feels great.', 1783488000000),
  ('log-3', 'team-vectorize', 'mock-builder-2', 'Embedded the conference docs into the vector store; retrieval is returning solid citations.', 1783489000000);
