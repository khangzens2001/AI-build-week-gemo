# Crawl AABW Devpost Participants

> Hướng dẫn chi tiết cào dữ liệu người tham gia từ trang **Agentic AI Build Week 2026** trên Devpost.
>
> URL: `https://agentic-ai-build-week-2026.devpost.com/participants`

---

## 1. Tổng quan

| Item | Detail |
|---|---|
| Tổng participants | **420** (tính đến 19/06/2026) |
| Phân trang | 20 participants/page, **21 pages** |
| Yêu cầu auth | ✅ — Cần login để xem danh sách |
| WAF | ⚠️ AWS WAF chặn pagination khi dùng curl/fetch — cần Puppeteer/Playwright |
| Infinite scroll | Trang dùng **infinite scroll** (class `infscr-loading`) |

---

## 2. Authentication Flow

### 2.1. Login Endpoint

```
POST https://secure.devpost.com/users/login
Content-Type: application/x-www-form-urlencoded
```

**Form fields:**
| Field | Value |
|---|---|
| `utf8` | `✓` |
| `authenticity_token` | Lấy từ trang login (CSRF token) |
| `user[email]` | `rithamto@gmail.com` |
| `user[password]` | `123123aC` |
| `return_to` | `https://devpost.com/` |

### 2.2. Quy trình lấy CSRF Token

1. **GET** `https://secure.devpost.com/users/login?ref=top-nav-login`
2. Parse HTML, tìm: `<input type="hidden" name="authenticity_token" value="..."/>`
3. Dùng value này cho POST login

### 2.3. Cookies nhận được sau login

| Cookie | Domain | Mô tả | Expiry |
|---|---|---|---|
| `jwt` | `.devpost.com` | JWT token chứa user ID | 30 ngày |
| `remember_user_token` | `.devpost.com` | Remember me token | 14 ngày |
| `_devpost` | `.devpost.com` | Session cookie (Rails) | Session |
| `AWSALB` / `AWSALBCORS` | `devpost.com` | Load balancer cookies | 7 ngày |

### 2.4. JWT Token (đã xác minh)

```
eyJhbGciOiJIUzI1NiJ9.eyJpZCI6MTA0MDM5MTB9.gPd29RYL-O7kVN6ONatfHnz787EL1tYGLqW6O45lxyM
```

Payload decoded: `{"id": 10403910}` — User ID trên Devpost.

> ⚠️ **Token này có hạn.** Cần login lại nếu expired (30 ngày từ 19/06/2026).

---

## 3. HTML Structure — Participant Card

Mỗi participant card có cấu trúc HTML như sau:

```html
<div class="participant full-stack-developer"
     data-participant-id="2911425"
     data-registrations="registrant">
  <div class="user-profile" data-user-profile>
    <div class="avatar-column">
      <a class="user-profile-link" href="https://devpost.com/{username}">
        <img alt="{Display Name}"
             class="user_photo user-photo ... image-replacement"
             title="{Display Name}"
             src="{avatar_url}" />
      </a>
    </div>
    <div>
      <div class="user-name">
        <h5 class="inline-block">
          <a class="user-profile-link" href="https://devpost.com/{username}">
            {Display Name}
          </a>
        </h5>
        <span class="follow-button-wrapper" data-follow-through-id="{pid}"></span>
        <span class="{role-class} role">
          <i class="fas fa-tag"></i> {Role Text}
        </span>
      </div>
      <ul class="counts no-bullet">
        <li class="participant-software-count">
          <strong class="participant-stat">{N} <i class="fas fa-code"></i></strong>
          <span>projects</span>
        </li>
        <li class="participant-followers-count">
          <strong class="participant-stat">{N} <i class="fas fa-user"></i></strong>
          <span>followers</span>
        </li>
        <li class="participant-achievements-count">
          <strong class="participant-stat">{N} <i class="far fa-star"></i></strong>
          <span>achievement(s)</span>
        </li>
      </ul>
    </div>

    <!-- ⭐ TEAM STATUS — nằm trong .request-actions -->
    <div class="request-actions" data-registrations="request-actions">
      <div>
        <span class="faded cp-tag bordered">{Has a team | Working solo | Looking for teammates}</span>
      </div>
    </div>
  </div>

  <div class="main-content">
    <div class="row">
      <div class="large-6 columns">
        <h6><i class="fas fa-tools"></i> Skills</h6>
        <ul class="no-bullet inline-list">
          <li><span class="cp-tag recognized-tag">
            <a href="...">{skill_name}</a>
          </span></li>
          <!-- ... more skills -->
        </ul>
      </div>
      <div class="large-6 columns">
        <h6><i class="far fa-heart"></i> Interests</h6>
        <ul class="no-bullet inline-list">
          <li><span class="cp-tag recognized-tag">
            <a href="...">{interest_name}</a>
          </span></li>
        </ul>
      </div>
    </div>
  </div>
</div>
```

### 3.1. Data Fields có thể extract

| Field | Selector / Pattern | Type |
|---|---|---|
| `participant_id` | `data-participant-id` attribute | string |
| `name` | `.user-name h5 a.user-profile-link` text | string |
| `profile_url` | `.user-name h5 a.user-profile-link[href]` | URL |
| `username` | Extract from `profile_url` (`/devpost.com\/(.+)$/`) | string |
| `avatar_url` | `.user_photo[src]` | URL |
| `role` | `.role` span text (e.g. "Full-stack developer") | string |
| `role_class` | Outer `div.participant` class (e.g. `full-stack-developer`) | string |
| `projects` | `.participant-software-count strong` number | number |
| `followers` | `.participant-followers-count strong` number | number |
| `achievements` | `.participant-achievements-count strong` number | number |
| `teamStatus` | `.request-actions .faded.cp-tag.bordered` text | `"Has a team"` \| `"Working solo"` \| `"Looking for teammates"` \| `null` |
| `skills` | `.main-content` Skills section `a` tags | string[] |
| `interests` | `.main-content` Interests section `a` tags | string[] |

---

## 4. Pagination & AWS WAF

### 4.1. Vấn đề

- Trang dùng **infinite scroll** (pagination URLs: `/participants?page=1..21`)
- **AWS WAF** chặn các request pagination bằng curl/fetch đơn giản
- Page 1 trả về đúng HTML, nhưng page 2+ bị WAF challenge (require JS)
- WAF challenge page trả HTML với `AwsWafIntegration.getToken()` — cần JS runtime

### 4.2. Giải pháp: Dùng Puppeteer/Playwright

Cần dùng headless browser để:
1. Login qua form
2. Navigate đến participants page
3. Scroll xuống (hoặc navigate từng page)
4. Parse HTML sau khi page load xong

---

## 5. Code Implementation (TypeScript + Playwright)

### 5.1. Dependencies

```bash
bun add playwright cheerio
# Hoặc:
# npm install playwright cheerio
```

### 5.2. Participant Schema (Zod)

```typescript
// packages/ingest/src/devpost/participant-schema.ts
import { z } from "zod";

export const TeamStatus = z.enum([
  "Has a team",
  "Working solo",
  "Looking for teammates",
]);
export type TeamStatus = z.infer<typeof TeamStatus>;

export const ParticipantSchema = z.object({
  participantId: z.string(),
  name: z.string(),
  username: z.string(),
  profileUrl: z.string().url(),
  avatarUrl: z.string(),
  role: z.string().default(""),
  teamStatus: TeamStatus.nullable().default(null),
  projects: z.number().int().default(0),
  followers: z.number().int().default(0),
  achievements: z.number().int().default(0),
  skills: z.array(z.string()).default([]),
  interests: z.array(z.string()).default([]),
  scrapedAt: z.string().datetime(),
});

export type Participant = z.infer<typeof ParticipantSchema>;
```

### 5.3. Scraper Script

```typescript
// packages/ingest/src/devpost/scrape-participants.ts
import { chromium, type Page } from "playwright";
import * as cheerio from "cheerio";
import { ParticipantSchema, type Participant } from "./participant-schema";
import { writeFileSync } from "node:fs";

const BASE_URL = "https://agentic-ai-build-week-2026.devpost.com";
const LOGIN_URL = "https://secure.devpost.com/users/login?ref=top-nav-login";
const PARTICIPANTS_URL = `${BASE_URL}/participants`;

const EMAIL = process.env.DEVPOST_EMAIL ?? "rithamto@gmail.com";
const PASSWORD = process.env.DEVPOST_PASSWORD ?? "123123aC";

async function login(page: Page): Promise<void> {
  console.log("🔑 Logging in to Devpost...");
  await page.goto(LOGIN_URL, { waitUntil: "networkidle" });

  // Fill login form
  await page.fill("#user_email", EMAIL);
  await page.fill("#user_password", PASSWORD);

  // Submit
  await page.click("#submit-form");

  // Wait for redirect after login
  await page.waitForURL("https://devpost.com/**", { timeout: 15_000 });
  console.log("✅ Login successful!");
}

function parseParticipantsFromHTML(html: string): Participant[] {
  const $ = cheerio.load(html);
  const participants: Participant[] = [];
  const now = new Date().toISOString();

  $("div.participant[data-participant-id]").each((_, el) => {
    const $el = $(el);
    const participantId = $el.attr("data-participant-id") ?? "";

    // Name & profile
    const $profileLink = $el.find(".user-name h5 a.user-profile-link");
    const name = $profileLink.text().trim();
    const profileUrl = $profileLink.attr("href") ?? "";
    const username = profileUrl.replace(/^https:\/\/devpost\.com\//, "");

    // Avatar
    const avatarUrl = $el.find(".user_photo").attr("src") ?? "";

    // Role
    const roleText = $el.find(".role").text().trim().replace(/^\s*/, "");

    // Stats
    const projects = parseInt(
      $el.find(".participant-software-count strong").text().trim(),
      10,
    ) || 0;
    const followers = parseInt(
      $el.find(".participant-followers-count strong").text().trim(),
      10,
    ) || 0;
    const achievements = parseInt(
      $el.find(".participant-achievements-count strong").text().trim(),
      10,
    ) || 0;

    // Skills
    const skills: string[] = [];
    $el.find("h6:contains('Skills')")
      .closest(".columns")
      .find(".cp-tag a")
      .each((_, a) => {
        const skill = $(a).text().trim();
        if (skill) skills.push(skill);
      });

    // Interests
    const interests: string[] = [];
    $el.find("h6:contains('Interests')")
      .closest(".columns")
      .find(".cp-tag a")
      .each((_, a) => {
        const interest = $(a).text().trim();
        if (interest) interests.push(interest);
      });

    // Team status: "Has a team" | "Working solo" | "Looking for teammates" | null
    const teamStatusEl = $el.find(".request-actions .faded.cp-tag.bordered");
    const teamStatusText = teamStatusEl.text().trim() || null;
    // Validate against known values
    const validStatuses = ["Has a team", "Working solo", "Looking for teammates"];
    const teamStatus = validStatuses.includes(teamStatusText ?? "")
      ? (teamStatusText as "Has a team" | "Working solo" | "Looking for teammates")
      : null;

    try {
      const participant = ParticipantSchema.parse({
        participantId,
        name,
        username,
        profileUrl,
        avatarUrl,
        role: roleText,
        teamStatus,
        projects,
        followers,
        achievements,
        skills,
        interests,
        scrapedAt: now,
      });
      participants.push(participant);
    } catch (e) {
      console.warn(`⚠️ Skipping invalid participant ${participantId}:`, e);
    }
  });

  return participants;
}

async function scrapeAllPages(page: Page): Promise<Participant[]> {
  console.log("📋 Navigating to participants page...");
  await page.goto(PARTICIPANTS_URL, { waitUntil: "networkidle" });

  // Wait for participant list to load
  await page.waitForSelector(".participants-list", { timeout: 10_000 });

  const allParticipants: Participant[] = [];
  let currentPage = 1;
  const totalPages = 21; // 420 participants / 20 per page

  while (currentPage <= totalPages) {
    console.log(`📄 Scraping page ${currentPage}/${totalPages}...`);

    // Get page HTML
    const html = await page.content();
    const participants = parseParticipantsFromHTML(html);
    console.log(`   Found ${participants.length} participants on this page`);

    allParticipants.push(...participants);

    if (currentPage >= totalPages) break;

    // Navigate to next page
    currentPage++;
    const nextUrl = `${PARTICIPANTS_URL}?page=${currentPage}`;
    await page.goto(nextUrl, { waitUntil: "networkidle" });

    // Wait for content to load (WAF challenge should auto-resolve in real browser)
    await page.waitForSelector(".participants-list", { timeout: 30_000 });

    // Rate limiting — be polite
    await page.waitForTimeout(1500);
  }

  return allParticipants;
}

/**
 * Alternative approach: Use infinite scroll instead of pagination
 */
async function scrapeWithInfiniteScroll(page: Page): Promise<Participant[]> {
  console.log("📋 Navigating to participants page...");
  await page.goto(PARTICIPANTS_URL, { waitUntil: "networkidle" });
  await page.waitForSelector(".participants-list", { timeout: 10_000 });

  let previousCount = 0;
  let retries = 0;
  const maxRetries = 5;

  while (retries < maxRetries) {
    // Scroll to bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);

    // Count current participants
    const currentCount = await page.$$eval(
      "div.participant[data-participant-id]",
      (els) => els.length,
    );

    console.log(`   Loaded ${currentCount} participants...`);

    if (currentCount === previousCount) {
      retries++;
      console.log(`   No new participants loaded. Retry ${retries}/${maxRetries}`);
    } else {
      retries = 0;
      previousCount = currentCount;
    }
  }

  console.log(`✅ Total loaded: ${previousCount} participants`);

  const html = await page.content();
  return parseParticipantsFromHTML(html);
}

async function main() {
  const browser = await chromium.launch({
    headless: true, // Set false for debugging
  });

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
      "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });

  const page = await context.newPage();

  try {
    // Step 1: Login
    await login(page);

    // Step 2: Scrape participants
    // Option A: Page-by-page navigation
    // const participants = await scrapeAllPages(page);

    // Option B: Infinite scroll (recommended — avoids WAF issues on page nav)
    const participants = await scrapeWithInfiniteScroll(page);

    // Step 3: Save results
    const outputPath = "packages/core/data/participants.json";
    writeFileSync(outputPath, JSON.stringify(participants, null, 2));
    console.log(`\n🎉 Saved ${participants.length} participants to ${outputPath}`);

    // Also save a summary
    const roles = new Map<string, number>();
    for (const p of participants) {
      const r = p.role || "Unknown";
      roles.set(r, (roles.get(r) ?? 0) + 1);
    }
    console.log("\n📊 Role Distribution:");
    for (const [role, count] of [...roles.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`   ${role}: ${count}`);
    }
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
```

### 5.4. Chạy scraper

```bash
# Install playwright browsers (first time only)
npx playwright install chromium

# Run scraper
bun run packages/ingest/src/devpost/scrape-participants.ts
```

---

## 6. Alternative: curl + Cookie Jar (Page 1 Only)

Nếu chỉ cần page 1 (20 participants đầu tiên), có thể dùng curl không cần browser:

```bash
# Step 1: Get CSRF token
curl -s -c cookies.txt "https://secure.devpost.com/users/login?ref=top-nav-login" \
  | grep -o 'name="authenticity_token" value="[^"]*"' \
  | sed 's/.*value="//' | sed 's/"$//' > csrf_token.txt

# Step 2: Login
CSRF=$(cat csrf_token.txt)
curl -s -c cookies.txt -b cookies.txt -L \
  -X POST "https://secure.devpost.com/users/login" \
  --data-urlencode "utf8=✓" \
  --data-urlencode "authenticity_token=${CSRF}" \
  --data-urlencode "user[email]=rithamto@gmail.com" \
  --data-urlencode "user[password]=123123aC" \
  --data-urlencode "return_to=https://devpost.com/" \
  -o /dev/null

# Step 3: Fetch participants page
curl -s -b cookies.txt \
  "https://agentic-ai-build-week-2026.devpost.com/participants" \
  -o participants.html

# Step 4: Parse with Python/Node
# (See section 5.3 for parsing logic)
```

> ⚠️ **Hạn chế:** curl chỉ lấy được page 1. Page 2+ bị AWS WAF block vì thiếu JavaScript runtime.

---

## 7. Data Pipeline Integration

### 7.1. Vị trí lưu trữ trong monorepo

```
packages/core/data/participants.json   ← Raw scraped data
packages/ingest/src/devpost/           ← Scraper code
  ├── participant-schema.ts            ← Zod schema
  ├── scrape-participants.ts           ← Playwright scraper
  └── transform-participants.ts        ← Transform cho RAG/DB
```

### 7.2. Transform cho Vector DB (Chroma)

```typescript
// packages/ingest/src/devpost/transform-participants.ts
import type { Participant } from "./participant-schema";

export function participantToChunk(p: Participant) {
  const text = [
    `Participant: ${p.name}`,
    `Username: ${p.username}`,
    `Role: ${p.role || "Not specified"}`,
    `Team Status: ${p.teamStatus || "Not specified"}`,
    `Profile: ${p.profileUrl}`,
    `Projects: ${p.projects}`,
    `Followers: ${p.followers}`,
    `Achievements: ${p.achievements}`,
    p.skills.length > 0 ? `Skills: ${p.skills.join(", ")}` : "",
    p.interests.length > 0 ? `Interests: ${p.interests.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    id: `participant-${p.participantId}`,
    text,
    metadata: {
      source: "devpost",
      type: "participant",
      participantId: p.participantId,
      name: p.name,
      username: p.username,
      role: p.role,
      teamStatus: p.teamStatus ?? "",
      skills: p.skills.join(","),
      interests: p.interests.join(","),
    },
  };
}
```

### 7.3. Seed vào D1 Database

```sql
-- drizzle/schema — thêm bảng participants
CREATE TABLE IF NOT EXISTS participants (
  id TEXT PRIMARY KEY,           -- participant_id từ Devpost
  name TEXT NOT NULL,
  username TEXT NOT NULL,
  profile_url TEXT NOT NULL,
  avatar_url TEXT DEFAULT '',
  role TEXT DEFAULT '',
  team_status TEXT DEFAULT NULL,  -- 'Has a team' | 'Working solo' | 'Looking for teammates'
  projects INTEGER DEFAULT 0,
  followers INTEGER DEFAULT 0,
  achievements INTEGER DEFAULT 0,
  skills TEXT DEFAULT '',        -- JSON array as string
  interests TEXT DEFAULT '',     -- JSON array as string
  scraped_at TEXT NOT NULL
);
```

---

## 8. Lưu ý quan trọng

1. **Rate Limiting**: Devpost có AWS WAF — delay ít nhất 1-2s giữa các request
2. **Token Expiry**: JWT token hết hạn sau 30 ngày — cần re-login
3. **Dynamic Count**: Số participants (420) thay đổi theo thời gian, check `.pagination` hoặc text `Participants (N)` để biết tổng
4. **Privacy**: Dữ liệu participant là public với authenticated users. Chỉ sử dụng cho mục đích event copilot.
5. **Infinite Scroll vs Pagination**: Recommend dùng infinite scroll approach (Playwright scroll) vì ít bị WAF chặn hơn so với navigate giữa các pages
6. **Headless mode**: Nên chạy `headless: false` khi debug để thấy WAF challenge xử lý như thế nào

---

## 9. Sample Data (Page 1 — 21 participants đã extracted)

Đã verified extract thành công từ page 1 với `curl` login:

| # | Name | Role | Team Status | Projects | Skills |
|---|---|---|---|---|---|
| 1 | DO KHANG | Full-stack developer | Working solo *(current-user)* | 0 | ailun |
| 2 | MADHAN KUMAR N AIML | Full-stack developer | Has a team | 0 | — |
| 3 | Diwan J | Full-stack developer | Working solo | 0 | — |
| 4 | Fahid Ammanullah | cybersecurity | Looking for teammates | 0 | python, c++, linux |
| 5 | Shyam Kumar | Full-stack developer | — | 0 | — |
| 6 | Sheshakanth Ra | Business | Has a team | 2 | — |
| 7 | Mark Arevada | Business | Looking for teammates | 0 | — |
| 8 | Olabode Aka | Full-stack developer | — | 5 | python |
| 9 | Ademola Balogun | Full-stack developer | Has a team | 32 | — |
| 10 | kalent Chia | Full-stack developer | — | 2 | python, java, sqlite, firebase |
| 11 | Bhavarth Bhangdia | Data scientist | Working solo | 0 | pytorch, python, ML, scikit-learn, pandas |
| 12 | My Hạ | Business | Has a team | 1 | — |
| 13 | jimmy XD | Full-stack developer | Looking for teammates | 16 | python, javascript |
| 14 | Ecom Easy Nhật Phương | Full-stack developer | Has a team | 1 | — |
| 15 | Trọng Trần | Data scientist | Working solo | 0 | — |
| 16 | Manikant Kella | Data scientist | Working solo | 12 | — |
| 17 | Vinh Nguyễn Phương | Back-end developer | — | 0 | — |
| 18 | Điền Trần | Full-stack developer | — | 0 | — |
| 19 | Dang Phan | Full-stack developer | Looking for teammates | 1 | — |
| 20 | xuan quy | — | — | 1 | — |
| 21 | (no name) | Full-stack developer | Working solo | 6 | c++ |
