/**
 * Devpost participants scraper (Phase 3). Logs in once, paginates the AABW
 * participants directory behind AWS WAF, parses each card per PRD §3.1, and
 * writes packages/core/data/participants.json + downloads one avatar per person
 * into apps/web/public/participants/. A separate transform step turns the JSON
 * into RAG chunks (transform-participants.ts).
 *
 * ⚠️ RUNTIME: Playwright `chromium.launch()` HANGS under Bun's native runtime
 * (microsoft/playwright#35259, oven-sh/bun#23826 — open as of Mar 2026). This
 * file MUST run under Node via `npx tsx`, wired as `bun run crawl:participants`
 * (which shells out to `npx tsx`). `bun install` for deps is fine; only the
 * browser launch is Bun-incompatible. Operator must run
 * `npx playwright install chromium --only-shell` once (headless shell only).
 *
 * Auth: login-once + cached storageState in playwright/.auth/devpost.json
 * (gitignored). Creds are env-only (DEVPOST_EMAIL / DEVPOST_PASSWORD) — NO
 * hardcoded fallback. The old committed JWT/creds are considered leaked.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { type Participant, ParticipantSchema } from "@event/core";
import { type Browser, type BrowserContext, type Page, chromium } from "playwright-core";
import { participantsToChunks } from "./transform-participants";

const BASE_URL = "https://agentic-ai-build-week-2026.devpost.com";
const PARTICIPANTS_URL = `${BASE_URL}/participants`;
const LOGIN_URL = "https://secure.devpost.com/users/login?ref=top-nav-login";
const SETTINGS_URL = "https://devpost.com/settings";
const PER_PAGE = 20; // Devpost serves 20 participant cards per ?page=N.

// A realistic desktop Chrome UA (matches the headless-shell engine closely).
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..", "..");
const AUTH_FILE = join(repoRoot, "playwright", ".auth", "devpost.json");
const PARTICIPANTS_OUT = join(repoRoot, "packages", "core", "data", "participants.json");
const CHUNKS_OUT = join(
  repoRoot,
  "packages",
  "ingest",
  "data",
  "devpost",
  "participant_retrieval_chunks.json",
);
const AVATAR_DIR = join(repoRoot, "apps", "web", "public", "participants");

// Avatar CDN hosts that actually appear on Devpost cards. Anything else is
// skipped + warned (mirrors fetch-images.ts host pinning). Devpost serves
// uploaded photos from S3/challengepost, Google-auth users from googleusercontent,
// and the email-hash fallback from gravatar.
const ALLOWED_AVATAR_HOSTS = new Set([
  "lh3.googleusercontent.com",
  "secure.gravatar.com",
  "www.gravatar.com",
  "challengepost-s3-challengepost.netdna-ssl.com",
  "d112y698adiu2z.cloudfront.net",
  "devpost.com",
  "secure.devpost.com",
]);
const MAX_AVATAR_BYTES = 4 * 1024 * 1024; // 4MB ceiling per avatar.
const MAX_PAGES = 50; // safety cap when "Participants (N)" count is unreadable.

/** Read DEVPOST_EMAIL / DEVPOST_PASSWORD from env — throws if either is unset. */
function readCredentials(): { email: string; password: string } {
  const email = process.env.DEVPOST_EMAIL;
  const password = process.env.DEVPOST_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "DEVPOST_EMAIL and DEVPOST_PASSWORD must be set in the environment (no hardcoded fallback). " +
        "e.g. DEVPOST_EMAIL=you@example.com DEVPOST_PASSWORD=... bun run crawl:participants",
    );
  }
  return { email, password };
}

/** True if the context's cookies still authenticate (no redirect to /users/login). */
async function isLoggedIn(context: BrowserContext): Promise<boolean> {
  const page = await context.newPage();
  try {
    const res = await page.goto(SETTINGS_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });
    const url = page.url();
    // A valid session stays on /settings; an expired one bounces to the login page.
    return res != null && !url.includes("/users/login") && url.includes("/settings");
  } catch {
    return false;
  } finally {
    await page.close();
  }
}

/** Fresh login through the form, then persist storageState for next time. */
async function login(context: BrowserContext): Promise<void> {
  const { email, password } = readCredentials();
  const page = await context.newPage();
  try {
    console.log("Logging in to Devpost...");
    await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded" });

    // Resilient locators first (labels/role), CSS ids as a fallback — the form
    // markup (#user_email / #user_password / #submit-form) may drift.
    await fillField(page, page.getByLabel(/email/i), "#user_email", email);
    await fillField(page, page.getByLabel(/password/i), "#user_password", password);
    await clickSubmit(page);

    // Successful login redirects back to a devpost.com page (not secure.devpost.com).
    await page.waitForURL(/^https:\/\/(www\.)?devpost\.com\//, { timeout: 30_000 });
    console.log("Login successful.");

    mkdirSync(dirname(AUTH_FILE), { recursive: true });
    await context.storageState({ path: AUTH_FILE });
  } finally {
    await page.close();
  }
}

/** Fill via a resilient locator, falling back to a CSS selector if it's absent. */
async function fillField(
  page: Page,
  primary: ReturnType<Page["getByLabel"]>,
  fallbackSelector: string,
  value: string,
): Promise<void> {
  try {
    await primary.fill(value, { timeout: 5_000 });
  } catch {
    await page.fill(fallbackSelector, value);
  }
}

/** Click the submit button via role, falling back to the #submit-form id. */
async function clickSubmit(page: Page): Promise<void> {
  try {
    await page.getByRole("button", { name: /log ?in|sign ?in/i }).click({ timeout: 5_000 });
  } catch {
    await page.click("#submit-form");
  }
}

/**
 * Read the "Participants (N)" count on page 1 → total page count. Returns 0 when
 * the count text is absent so the caller can fall back to "paginate until a
 * short/empty page" instead of silently scraping only page 1 (20 of N).
 */
async function readTotalPages(page: Page): Promise<number> {
  const total = await page
    .locator("body")
    .innerText()
    .then((t) => {
      const m = /Participants?\s*\((\d[\d,]*)\)/i.exec(t);
      return m ? Number.parseInt(m[1].replace(/,/g, ""), 10) : 0;
    })
    .catch(() => 0);
  if (!total) return 0; // unknown → caller paginates until a short page
  return Math.ceil(total / PER_PAGE);
}

/**
 * Parse every participant card on the current page entirely in-browser via
 * $$eval (no cheerio). Selectors follow PRD §3.1. Returns loosely-typed records
 * that we then validate with ParticipantSchema (avatarLocal=null at scrape time).
 */
async function parsePage(page: Page): Promise<unknown[]> {
  const now = new Date().toISOString();
  const records = await page.$$eval(
    "div.participant[data-participant-id]",
    (cards, scrapedAt) => {
      const text = (el: Element | null): string => (el?.textContent ?? "").trim();
      const intOf = (el: Element | null): number =>
        Number.parseInt(text(el).replace(/[^\d]/g, ""), 10) || 0;

      const VALID_TEAM = ["Has a team", "Working solo", "Looking for teammates"];

      return cards.map((card) => {
        const participantId = card.getAttribute("data-participant-id") ?? "";

        const profileLink = card.querySelector(".user-name h5 a.user-profile-link");
        const name = text(profileLink);
        const profileUrl = profileLink?.getAttribute("href") ?? "";
        const username = profileUrl.replace(/^https:\/\/devpost\.com\//, "").replace(/\/$/, "");

        const avatarUrl = card.querySelector(".user_photo")?.getAttribute("src") ?? "";
        const role = text(card.querySelector(".role"));

        const projects = intOf(card.querySelector(".participant-software-count strong"));
        const followers = intOf(card.querySelector(".participant-followers-count strong"));
        const achievements = intOf(card.querySelector(".participant-achievements-count strong"));

        const teamRaw = text(card.querySelector(".request-actions .faded.cp-tag.bordered"));
        const teamStatus = VALID_TEAM.includes(teamRaw) ? teamRaw : null;

        // Skills/Interests: find the h6 whose text contains the label, then read
        // the sibling list's tag anchors. Headings + lists are siblings inside
        // the same `.columns` block.
        const tagsUnder = (label: RegExp): string[] => {
          const headings = Array.from(card.querySelectorAll("h6"));
          const h6 = headings.find((h) => label.test(h.textContent ?? ""));
          const container = h6?.closest(".columns") ?? h6?.parentElement ?? null;
          if (!container) return [];
          return Array.from(container.querySelectorAll(".cp-tag a"))
            .map((a) => (a.textContent ?? "").trim())
            .filter(Boolean);
        };

        return {
          participantId,
          name,
          username,
          profileUrl,
          avatarUrl,
          avatarLocal: null,
          role,
          teamStatus,
          projects,
          followers,
          achievements,
          skills: tagsUnder(/skills/i),
          interests: tagsUnder(/interests/i),
          scrapedAt,
        };
      });
    },
    now,
  );
  return records;
}

/** Navigate ?page=N, wait for cards (NOT networkidle), parse, validate, jitter. */
async function scrapeAllPages(page: Page): Promise<Participant[]> {
  console.log("Navigating to participants page 1...");
  await page.goto(`${PARTICIPANTS_URL}?page=1`, { waitUntil: "domcontentloaded" });
  // WAF escalation ladder (if pages start returning 202 / a CAPTCHA challenge):
  //   1. retry with an explicit `chromium` channel + a fresh headless context,
  //   2. drop to headless:false (visible window often clears the challenge),
  //   3. add a stealth plugin (playwright-extra + stealth) as a last resort.
  // We wait on the card selector (not networkidle) because the WAF's 202
  // interstitial never reaches networkidle and would hang the wait.
  await page.waitForSelector("div.participant[data-participant-id]", { timeout: 30_000 });

  const totalPages = await readTotalPages(page);
  // When the count is unknown (0), paginate defensively up to a hard ceiling and
  // stop on the first short/empty page rather than silently scraping only page 1.
  const knownTotal = totalPages > 0;
  const lastPage = knownTotal ? totalPages : MAX_PAGES;
  console.log(
    knownTotal ? `Total pages: ${totalPages}` : `Unknown total — paginating up to ${MAX_PAGES}`,
  );

  const all: Participant[] = [];
  for (let n = 1; n <= lastPage; n++) {
    // Per-page resilience: a WAF challenge / timeout on ONE page must not discard
    // the pages already collected. On any nav/parse failure we log + break and
    // return what we have (partial-save) rather than aborting the whole run.
    try {
      if (n > 1) {
        await page.goto(`${PARTICIPANTS_URL}?page=${n}`, { waitUntil: "domcontentloaded" });
        await page.waitForSelector("div.participant[data-participant-id]", { timeout: 30_000 });
      }

      const raw = await parsePage(page);
      let ok = 0;
      for (const rec of raw) {
        const parsed = ParticipantSchema.safeParse(rec);
        if (parsed.success) {
          all.push(parsed.data);
          ok++;
        } else {
          const id =
            rec && typeof rec === "object" && "participantId" in rec
              ? String((rec as { participantId: unknown }).participantId)
              : "?";
          console.warn(`  [skip] invalid participant ${id}: ${parsed.error.issues[0]?.message}`);
        }
      }
      console.log(`  page ${n}/${knownTotal ? totalPages : "?"}: ${ok}/${raw.length} valid`);
      // A page that yields 0 cards (challenge served an empty list, or the roster
      // ended). When the total is unknown this is our stop signal; when known it's
      // a suspicious gap worth a loud warning.
      if (raw.length === 0) {
        if (!knownTotal) {
          console.log(`  page ${n} empty — assuming end of roster.`);
          break;
        }
        console.warn(`  [warn] page ${n} returned 0 participant cards (possible WAF challenge).`);
      }
      // Unknown-total stop: a short page (< PER_PAGE) is the last page.
      if (!knownTotal && raw.length > 0 && raw.length < PER_PAGE) break;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(
        `  [warn] page ${n} failed (${msg}) — stopping, keeping ${all.length} collected.`,
      );
      break;
    }

    // Polite jittered delay between pages (1.5–3.0s) to avoid tripping the WAF.
    if (n < lastPage) await page.waitForTimeout(1500 + Math.random() * 1500);
  }

  return all;
}

/**
 * Download one avatar, reusing fetch-images.ts guards: https only, host-pinned,
 * image content-type assert, byte cap, atomic temp+rename. Non-fatal — returns
 * a status so the caller can leave avatarLocal=null on skip/fail.
 */
async function downloadAvatar(remote: string, destAbs: string): Promise<"ok" | "skip" | "fail"> {
  let url: URL;
  try {
    url = new URL(remote);
  } catch {
    return "skip";
  }
  if (url.protocol !== "https:") {
    console.warn(`  [skip] non-https avatar: ${remote}`);
    return "skip";
  }
  if (!ALLOWED_AVATAR_HOSTS.has(url.hostname)) {
    console.warn(`  [skip] avatar host not allowed: ${url.hostname}`);
    return "skip";
  }

  try {
    const res = await fetch(remote);
    if (!res.ok) {
      console.error(`  [fail] ${res.status} ${remote}`);
      return "fail";
    }
    const ctype = res.headers.get("content-type") ?? "";
    if (!ctype.startsWith("image/")) {
      console.error(`  [fail] not an image (${ctype}): ${remote}`);
      return "fail";
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > MAX_AVATAR_BYTES) {
      console.error(`  [fail] too large (${buf.byteLength}b): ${remote}`);
      return "fail";
    }

    mkdirSync(dirname(destAbs), { recursive: true });
    // Atomic write: temp sibling + rename so a reader never sees a partial file.
    const tmp = `${destAbs}.tmp`;
    writeFileSync(tmp, buf);
    renameSync(tmp, destAbs);
    return "ok";
  } catch (err) {
    console.error(`  [fail] ${err instanceof Error ? err.message : err}: ${remote}`);
    return "fail";
  }
}

/**
 * Avatar pass — runs AFTER participants.json is written, mirroring how
 * fetch-images is separate from seed. Mutates each participant's avatarLocal in
 * place on success; leaves null on skip/fail. Never throws (non-fatal).
 */
async function downloadAvatars(participants: Participant[]): Promise<void> {
  mkdirSync(AVATAR_DIR, { recursive: true });
  console.log(`Downloading avatars → ${AVATAR_DIR}`);
  let ok = 0;
  let fail = 0;
  let skip = 0;
  for (const p of participants) {
    if (!p.avatarUrl) {
      skip++;
      continue;
    }
    const local = `/participants/${p.participantId}.png`;
    const status = await downloadAvatar(p.avatarUrl, join(AVATAR_DIR, `${p.participantId}.png`));
    if (status === "ok") {
      p.avatarLocal = local;
      ok++;
    } else if (status === "fail") {
      fail++;
    } else {
      skip++;
    }
  }
  console.log(`Avatars: ${ok} ok, ${fail} failed, ${skip} skipped.`);
}

/** Log a role-distribution summary (matches PRD §5.3 output). */
function logRoleDistribution(participants: Participant[]): void {
  const roles = new Map<string, number>();
  for (const p of participants) {
    const r = p.role || "Unknown";
    roles.set(r, (roles.get(r) ?? 0) + 1);
  }
  console.log("\nRole distribution:");
  for (const [role, count] of [...roles.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${role}: ${count}`);
  }
}

async function main(): Promise<void> {
  // `--disable-blink-features=AutomationControlled` hides the navigator.webdriver
  // flag the WAF/login flow may sniff for.
  const browser: Browser = await chromium.launch({
    headless: true,
    args: ["--disable-blink-features=AutomationControlled"],
  });

  let context: BrowserContext | null = null;
  try {
    // Reuse a cached session if it's still valid; else fresh login.
    if (existsSync(AUTH_FILE)) {
      context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent: USER_AGENT,
        storageState: AUTH_FILE,
      });
      if (await isLoggedIn(context)) {
        console.log("Reusing cached Devpost session.");
      } else {
        console.log("Cached session expired — re-authenticating.");
        await context.close();
        context = await browser.newContext({
          viewport: { width: 1920, height: 1080 },
          userAgent: USER_AGENT,
        });
        await login(context);
      }
    } else {
      context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent: USER_AGENT,
      });
      await login(context);
    }

    const page = await context.newPage();
    const participants = await scrapeAllPages(page);

    // Write participants.json BEFORE avatars so a failed avatar pass can't lose
    // the scrape; downloadAvatars then patches avatarLocal in place and we rewrite.
    mkdirSync(dirname(PARTICIPANTS_OUT), { recursive: true });
    writeFileSync(PARTICIPANTS_OUT, `${JSON.stringify(participants, null, 2)}\n`, "utf-8");
    console.log(`\nSaved ${participants.length} participants → ${PARTICIPANTS_OUT}`);

    await downloadAvatars(participants);
    // Rewrite with the patched avatarLocal paths.
    writeFileSync(PARTICIPANTS_OUT, `${JSON.stringify(participants, null, 2)}\n`, "utf-8");

    // Emit RAG chunks alongside the Devpost page chunks (embed.ts reads them via
    // PARTICIPANT_CHUNKS_FILE).
    const chunks = participantsToChunks(participants);
    mkdirSync(dirname(CHUNKS_OUT), { recursive: true });
    writeFileSync(CHUNKS_OUT, `${JSON.stringify(chunks, null, 2)}\n`, "utf-8");
    console.log(`Wrote ${chunks.length} participant chunk(s) → ${CHUNKS_OUT}`);

    logRoleDistribution(participants);
  } finally {
    if (context) await context.close();
    await browser.close();
  }
}

main().catch((err) => {
  console.error("Participants scrape failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
