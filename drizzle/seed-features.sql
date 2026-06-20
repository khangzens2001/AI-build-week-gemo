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

-- ---- Cue Pulse: sample announcements -------------------------------------
DELETE FROM announcements;
INSERT INTO announcements (id, kind, title, body, severity, target_id, source_url, created_at) VALUES
  ('ann-welcome', 'general', 'Welcome to Day 1 — Enable', 'Registration is open at Tasco Office. Grab your badge, find the wifi card at the desk, and head up for the kickoff.', 'info', NULL, 'https://agenticaibuildweek.genaifund.ai/#daily_schedule', 1783477800000),
  ('ann-byteplus-room', 'venue', 'BytePlus workshop room moved', 'The BytePlus AI Stack workshop (10:00–12:00) is now in the main hall on level 2, Tasco Office.', 'important', 'day01-byteplus', 'https://luma.com/gaf-vbkf', 1783485900000),
  ('ann-lunch', 'schedule', 'Lunch served from 12:00', 'Lunch is now being served on the ground floor. Sessions resume at 14:00 with NVIDIA Inception.', 'info', 'day01-lunch', 'https://agenticaibuildweek.genaifund.ai/#daily_schedule', 1783490400000);

-- ---- Mentors with office-hours slots -------------------------------------
DELETE FROM mentors;
INSERT INTO mentors (id, name, title, org, bio, avatar_url, expertise, slots, source_url) VALUES
  ('mentor-anh', 'Anh Nguyen', 'Staff Engineer', 'Cloud Partner', 'Backend & data infra. Happy to unblock scaling, queues, and Postgres pain.', NULL,
    '["backend","postgres","infra","scaling","typescript"]',
    '[{"id":"anh-1","startsAt":1783479600000,"endsAt":1783483200000},{"id":"anh-2","startsAt":1783497600000,"endsAt":1783501200000}]',
    'https://agenticaibuildweek.genaifund.ai/'),
  ('mentor-priya', 'Priya Shah', 'AI Researcher', 'Model Partner', 'RAG, agents, evaluation. Ask me about grounding, citations, and tool-calling.', NULL,
    '["ai","rag","agents","llm","evaluation","python"]',
    '[{"id":"priya-1","startsAt":1783483200000,"endsAt":1783486800000},{"id":"priya-2","startsAt":1783566000000,"endsAt":1783569600000}]',
    'https://agenticaibuildweek.genaifund.ai/'),
  ('mentor-leo', 'Leo Tran', 'Product Designer', 'Design Studio', 'Mobile-first UX, demo polish, and pitch storytelling for Demo Day.', NULL,
    '["design","ux","mobile","pitch","frontend"]',
    '[{"id":"leo-1","startsAt":1783580400000,"endsAt":1783584000000}]',
    'https://agenticaibuildweek.genaifund.ai/');

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
