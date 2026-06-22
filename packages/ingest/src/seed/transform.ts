/**
 * Seed transform — pure (no fs) mappers from the raw AABW crawl into the
 * @event/core typed shapes (Session/Venue/Perk/Deadline/RetrievalChunk).
 *
 * The bundle_schedule is treated as the canonical schedule (it contains every
 * block, incl. lunches / signature nights / detail-less workshops). events.json
 * is used to *enrich* the matching block (description, speakers, registration
 * url, …). Times are resolved to TZ-correct epoch ms via @event/core's
 * eventTimeToEpoch (GMT+7).
 */

import {
  type Deadline,
  type Perk,
  type RetrievalChunk,
  type Session,
  type Venue,
  eventTimeToEpoch,
} from "@event/core";

// ---------------------------------------------------------------------------
// Raw input shapes (only the fields the transform reads).
// ---------------------------------------------------------------------------

export interface RawBlock {
  time: string | null;
  end: string | null;
  host: string | null;
  label: string | null;
  tone: string; // break | workshop | signature
  luma: string | null;
  lumaId: string | null;
}

export interface RawBundleDay {
  day: string; // "01" … "05"
  weekday?: string;
  dateLabel?: string;
  theme: string;
  venue: string;
  venueImage?: string;
  workshop_partners?: string[];
  blocks: RawBlock[];
}

export interface RawProgrammeDay {
  day_number: number;
  theme: string;
  date: string; // ISO 2026-07-08
  display_date?: string;
  category?: string;
  venue: string;
  partners?: string[];
  source_url?: string;
  summary_markdown?: string;
}

export interface RawEvent {
  id: string;
  type: string | null;
  day_number: number;
  day_theme: string | null;
  date: string | null;
  title: string;
  venue: string | null;
  registration_url: string | null;
  event_detail_url: string | null;
  description: string;
  speakers: string[];
  requirements: string[];
  organizer_or_partner?: string | null;
  start_time: string | null;
  end_time: string | null;
  quality_level: string | null;
  source_urls: string[];
  cover_image?: string | null;
}

export interface RawRetrievalChunk {
  id: string;
  type: string;
  text: string;
  source_url: string | null;
}

export interface RawBuilderTrack {
  markdown: string;
  url: string;
  title?: string;
}

export interface RawFaq {
  markdown: string;
  url: string;
  metadata?: { sourceURL?: string };
}

export interface RawRegistrationLinks {
  main_event_registration: string | null;
  devpost: string | null;
  workshop_rsvps?: { event_id: string; url: string }[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** URL/identifier-safe slug. */
export function slug(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * The local public path a session's cover image is stored at (downloaded from
 * its remote `cover_image` by `scripts/fetch-images.ts`). Pure: derived only
 * from the event id, so the transform stays deterministic and offline.
 */
export function coverLocalPath(eventId: string): string {
  return `/covers/${eventId}.png`;
}

/**
 * The remote→local image mapping the downloader consumes. The single source of
 * truth for which images exist and where they land, so transform + downloader
 * can't drift. Venue images already use relative paths that resolve locally
 * once the files are in public/, so only their remote base needs joining.
 */
export const VENUE_IMAGE_BASE = "https://agenticaibuildweek.genaifund.ai";

export interface ImageSource {
  remote: string;
  local: string; // path under apps/web/public
}

export function imageSources(events: RawEvent[], bundle: RawBundleDay[]): ImageSource[] {
  const out: ImageSource[] = [];
  const seen = new Set<string>();
  const add = (remote: string, local: string) => {
    if (seen.has(local)) return;
    seen.add(local);
    out.push({ remote, local });
  };
  for (const e of events) {
    if (e.cover_image) add(e.cover_image, coverLocalPath(e.id));
  }
  for (const d of bundle) {
    // venueImage is a site-relative path like "/venues/tasco-office.webp".
    if (d.venueImage) add(`${VENUE_IMAGE_BASE}${d.venueImage}`, d.venueImage);
  }
  return out;
}

function normTitle(input: string): string {
  return input.toLowerCase().replace(/\s+/g, " ").trim();
}

function truncate(text: string, max: number): string {
  const t = text.trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

/** Map bundle day "01".."05" → ISO date, preferring programme_days. */
function dayIso(day: string, programmeDays: RawProgrammeDay[]): string {
  const n = Number(day);
  const prog = programmeDays.find((p) => p.day_number === n);
  if (prog?.date) return prog.date;
  // AABW runs Jul 8–12 2026: day01 → 2026-07-08.
  return `2026-07-${String(7 + n).padStart(2, "0")}`;
}

function tone_to_type(tone: string): string {
  if (tone === "break" || tone === "signature") return tone;
  return "workshop";
}

// ---------------------------------------------------------------------------
// Venues — bundle-first, with a curated registry for canonical name + coords.
// ---------------------------------------------------------------------------

/**
 * Curated registry for the (few, fixed) event venues, keyed by `slug(day.venue)`
 * — the SAME id sessions derive their `venueId` from (see buildSessions). Keying
 * on the bundle's venue slug guarantees `venue.id === session.venueId` by
 * construction, so the orphan filter in run.ts keeps every attended venue no
 * matter how the upstream parser spells the name.
 *
 * Why a registry instead of locations.json: the crawled locations.json is noisy
 * (city-only rows, address_text mistaken for venue_name, split/missing coords —
 * e.g. AWS Office has NO coordinates in any row), and its `venue_name` values
 * ("Tasco Office", "AWS Office, Bitexco Tower") don't match the bundle's short
 * names ("Tasco", "AWS Office"), which is exactly what silently dropped Tasco +
 * AWS from the map. For a fixed, ~4-venue event these canonical coords are more
 * correct and fully deterministic. A venue NOT in the registry still appears
 * (from the bundle) with null coords → it lists but shows no map pin.
 *
 * Keyed on the live short-name slugs the json5 schedule parser emits. If those
 * names change upstream, a miss degrades gracefully (null coords), never a drop.
 */
const VENUE_REGISTRY: Record<string, { name: string; lat: number; lng: number; address: string }> =
  {
    tasco: {
      name: "Tasco Office",
      lat: 10.8243,
      lng: 106.6303,
      address: "Tasco Office, Ho Chi Minh City",
    },
    "aws-office": {
      name: "AWS Office, Bitexco Tower",
      lat: 10.7717,
      lng: 106.7042,
      address: "Bitexco Financial Tower, 2 Hải Triều, Bến Nghé, Quận 1, Ho Chi Minh City",
    },
    "vng-campus": {
      name: "VNG Campus",
      lat: 10.7573,
      lng: 106.7444,
      address: "VNG Campus, Tân Thuận Đông, Quận 7, Ho Chi Minh City",
    },
    "galaxy-innovation-park": {
      name: "Galaxy Innovation Park",
      lat: 10.8231,
      lng: 106.6297,
      address: "Galaxy Innovation Park, Ho Chi Minh City",
    },
  };

/** Build a deterministic Google Maps search link from any query string. */
function mapsSearch(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function buildVenues(bundle: RawBundleDay[]): Venue[] {
  const byId = new Map<string, Venue>();
  for (const d of bundle) {
    if (!d.venue) continue;
    const id = slug(d.venue);
    if (byId.has(id)) continue; // e.g. day04 + day05 both at Galaxy
    const reg = VENUE_REGISTRY[id];
    const name = reg?.name ?? d.venue;
    const lat = reg?.lat ?? null;
    const lng = reg?.lng ?? null;
    byId.set(id, {
      id,
      name,
      address: reg?.address ?? null,
      // All AABW venues are in Ho Chi Minh City.
      city: "Ho Chi Minh City",
      country: "Vietnam",
      lat,
      lng,
      // getDirections relies on a usable mapUrl: exact coords when known, else a
      // name search so an unregistered venue still links somewhere sensible.
      mapUrl:
        lat != null && lng != null
          ? mapsSearch(`${lat},${lng}`)
          : mapsSearch(`${name} Ho Chi Minh City`),
      imageUrl: d.venueImage ?? null,
    });
  }
  return [...byId.values()];
}

// ---------------------------------------------------------------------------
// Sessions — bundle blocks are canonical; enrich from events.json.
// ---------------------------------------------------------------------------

export function buildSessions(
  events: RawEvent[],
  bundle: RawBundleDay[],
  programmeDays: RawProgrammeDay[],
): Session[] {
  const sessions: Session[] = [];
  const usedIds = new Set<string>();

  const findMatch = (dayNum: number, block: RawBlock): RawEvent | undefined => {
    // 1) Match by Luma registration url (most reliable). Skip stale rows.
    if (block.luma) {
      const byLuma = events.filter((e) => e.registration_url === block.luma);
      return byLuma.find((e) => e.quality_level !== "stale") ?? byLuma[0];
    }
    // 2) Match by day + title + start time.
    const label = block.label ?? block.host ?? "";
    return events.find(
      (e) =>
        e.day_number === dayNum &&
        normTitle(e.title) === normTitle(label) &&
        e.start_time === block.time,
    );
  };

  for (const day of bundle) {
    const dayNum = Number(day.day);
    const iso = dayIso(day.day, programmeDays);
    const prog = programmeDays.find((p) => p.day_number === dayNum);
    const venueId = slug(day.venue);

    for (const block of day.blocks) {
      const match = findMatch(dayNum, block);

      // Stable id, preferring the host slug (aligns with events.json ids).
      const idBase = `day${day.day}-${slug(block.host ?? block.label ?? "session")}`;
      let id = idBase;
      if (usedIds.has(id)) id = `${idBase}-${(block.time ?? "").replace(":", "")}`;
      let bump = 2;
      while (usedIds.has(id)) id = `${idBase}-${bump++}`;
      usedIds.add(id);

      const title = match?.title ?? block.label ?? block.host ?? "Session";
      const description =
        match?.description && match.description.trim().length > 0 ? match.description : null;

      sessions.push({
        id,
        title,
        day: iso,
        dayNumber: dayNum,
        dayTheme: day.theme ?? prog?.theme ?? null,
        startsAt: eventTimeToEpoch(iso, block.time),
        endsAt: eventTimeToEpoch(iso, block.end),
        startTimeLabel: block.time ?? null,
        endTimeLabel: block.end ?? null,
        venueId,
        partner: block.host ?? match?.organizer_or_partner ?? null,
        track: day.theme ?? prog?.theme ?? match?.type ?? null,
        type: match?.type ?? tone_to_type(block.tone),
        tone: block.tone ?? null,
        description,
        speakers: match?.speakers ?? [],
        requirements: match?.requirements ?? [],
        registrationUrl: match?.registration_url ?? block.luma ?? null,
        tags: [],
        qualityLevel: match?.quality_level ?? null,
        sourceUrl: match?.source_urls?.[0] ?? prog?.source_url ?? null,
        // Deterministic local path; the file is fetched separately by
        // scripts/fetch-images.ts. Null when the source event had no cover.
        coverImage: match?.cover_image ? coverLocalPath(match.id) : null,
      });
    }
  }

  return sessions;
}

// ---------------------------------------------------------------------------
// Perks — hand-curated from clearly-stated offers in the crawl.
// ---------------------------------------------------------------------------

export function buildPerks(events: RawEvent[], builderTrack: RawBuilderTrack): Perk[] {
  const byId = (id: string) => events.find((e) => e.id === id);
  const perks: Perk[] = [];

  const byteplus = byId("day01-byteplus");
  perks.push({
    id: slug("BytePlus V-START Global Accelerator"),
    title: "BytePlus V-START Global Accelerator",
    provider: "BytePlus",
    value: "Up to $15,000 in AI & cloud credits",
    howToClaim:
      "Qualifying startups get a path into the V-START Global Accelerator via the BytePlus workshop on Day 01.",
    eligibility: "Qualifying startups (apply via the BytePlus session)",
    link: byteplus?.registration_url ?? "https://luma.com/gaf-vbkf",
    expiresAt: null,
    sourceUrl: byteplus?.source_urls?.[1] ?? "https://luma.com/gaf-vbkf",
  });

  perks.push({
    id: slug("Builder Experience Track"),
    title: "Builder Experience Track Prize",
    provider: "AABW / GenAI Fund",
    value: "$900 + AABW tee — winner deployed live to thousands",
    howToClaim:
      "Ship an AI tool that improves the builder experience and submit it on Devpost (first come, first served, 60 teams).",
    eligibility: "Solo or small team; AI tool for builders (not a chatbot wrapper)",
    link: "https://agentic-ai-build-week-2026.devpost.com/",
    expiresAt: null,
    sourceUrl: builderTrack.url,
  });

  const nvidia = byId("day01-nvidia");
  perks.push({
    id: slug("NVIDIA Inception Program"),
    title: "NVIDIA Inception Program",
    provider: "NVIDIA",
    value:
      "Free NVIDIA DLI course for every participant + Inception startup benefits (compute, capital, connections)",
    howToClaim: "Attend the NVIDIA Inception workshop on Day 01 to learn how to join the program.",
    eligibility: "AI startups",
    link: nvidia?.registration_url ?? "https://luma.com/gaf-t4bs",
    expiresAt: null,
    sourceUrl: nvidia?.source_urls?.[1] ?? "https://luma.com/gaf-t4bs",
  });

  const apify = byId("day03-apify");
  perks.push({
    id: slug("Apify Platform Credits"),
    title: "Apify Platform Credits",
    provider: "Apify",
    value: "$25 in Apify platform credits (with top-ups at the Apify booth)",
    howToClaim:
      "Register for the Apify workshop on Day 03; credits are granted to every registered builder.",
    eligibility: "Every registered builder",
    link: apify?.registration_url ?? "https://luma.com/gaf-umu5",
    expiresAt: null,
    sourceUrl: apify?.source_urls?.[1] ?? "https://luma.com/gaf-umu5",
  });

  return perks;
}

// ---------------------------------------------------------------------------
// Deadlines
// ---------------------------------------------------------------------------

export function buildDeadlines(
  events: RawEvent[],
  bundle: RawBundleDay[],
  programmeDays: RawProgrammeDay[],
  registration: RawRegistrationLinks,
): Deadline[] {
  const deadlines: Deadline[] = [];

  // Submission deadline — Day 05 "Submission Deadline" block.
  const day05 = bundle.find((d) => d.day === "05");
  const subBlock = day05?.blocks.find(
    (b) => b.label && normTitle(b.label) === "submission deadline",
  );
  const subEvent = events.find((e) => e.id === "day05-submission-deadline");
  if (day05 && subBlock) {
    const iso = dayIso("05", programmeDays);
    deadlines.push({
      id: slug("Submission Deadline"),
      title: "Hackathon Submission Deadline",
      dueAt: eventTimeToEpoch(iso, subBlock.time),
      type: "submission",
      link: registration.devpost ?? null,
      sourceUrl:
        subEvent?.source_urls?.[0] ?? "https://agenticaibuildweek.genaifund.ai/#daily_schedule",
    });
  }

  // Main event registration (RSVP).
  if (registration.main_event_registration) {
    deadlines.push({
      id: slug("Main Event Registration"),
      title: "Register for Agentic AI Build Week",
      dueAt: null,
      type: "rsvp",
      link: registration.main_event_registration,
      sourceUrl: registration.main_event_registration,
    });
  }

  return deadlines;
}

// ---------------------------------------------------------------------------
// Retrieval chunks — base corpus + event descriptions + perk brief + FAQ.
// ---------------------------------------------------------------------------

/**
 * On-the-ground logistics ("Survival Pack") — the small, high-frequency
 * questions builders ask at the venue (wifi, food, badge, parking, charging,
 * support). These are stable across the event, so they're authored here as a
 * static knowledge pack rather than crawled, and embedded alongside the rest so
 * `searchKnowledge` / the logistics quick-chips answer them with a citation.
 */
const LOGISTICS_SOURCE = "https://agenticaibuildweek.genaifund.ai/#faq";

const LOGISTICS_CHUNKS: { id: string; text: string }[] = [
  {
    id: "logistics-wifi",
    text: "Wifi at Agentic AI Build Week: each venue has builder wifi. The network name and password are printed on your badge and on signage at the registration/welcome desk. If you can't connect, ask a staff member at the front desk or in the Discord #support channel.",
  },
  {
    id: "logistics-food",
    text: "Food & drinks: lunch and coffee are provided at the venue on workshop days, served near the main hall (lunch around 12:00). Water and snacks are available throughout the day. On the on-site build day there is late-night food for builders working through the evening.",
  },
  {
    id: "logistics-badge",
    text: "Badges & check-in: collect your badge at the Registration & Welcome desk on Day 1 from 09:00 at Tasco Office. Wear your badge at all times — it's your entry to sessions and shows your builder tier. Lost your badge? Go back to the registration desk for a replacement.",
  },
  {
    id: "logistics-toilet",
    text: "Restrooms / toilets are on every floor of each venue, signposted near the lifts. Ask any staff member or check the venue signage if you can't find them.",
  },
  {
    id: "logistics-parking",
    text: "Getting there & parking: venues are in Ho Chi Minh City (Tasco Office, AWS Office at Bitexco Tower, VNG Campus, Galaxy Innovation Park). Use the in-app map and the Google Maps link on each session for directions. Grab/taxi is the easiest way between venues; motorbike parking is available at each venue.",
  },
  {
    id: "logistics-charging",
    text: "Power & charging: bring your laptop charger and a power strip if you can — outlets fill up fast during build sessions. Charging stations and extra outlets are set up near the work areas. A portable battery is handy when moving between venues.",
  },
  {
    id: "logistics-support",
    text: "Getting help / support: for any issue during the event — schedule questions, lost items, technical help, or finding a room — ask a staff member at the desk or post in the Discord #support channel. The Cue app's Pulse feed also shows live announcements and room changes.",
  },
];

export function buildChunks(
  retrievalChunks: RawRetrievalChunk[],
  events: RawEvent[],
  builderTrack: RawBuilderTrack,
  faq: RawFaq,
): RetrievalChunk[] {
  const chunks: RetrievalChunk[] = [];
  const seen = new Set<string>();

  const push = (c: RetrievalChunk) => {
    if (seen.has(c.id)) return;
    seen.add(c.id);
    chunks.push(c);
  };

  // 1) Primary corpus from retrieval_chunks.json.
  for (const rc of retrievalChunks) {
    push({
      id: rc.id,
      type: rc.type,
      text: rc.text,
      sourceUrl: rc.source_url ?? null,
    });
  }

  // 2) Raw event descriptions (only the ones with real content).
  for (const e of events) {
    if (!e.description || e.description.trim().length === 0) continue;
    push({
      id: `event-${e.id}`,
      type: "event",
      text: `${e.title}\n${truncate(e.description, 1500)}`,
      sourceUrl: e.source_urls?.[0] ?? null,
    });
  }

  // 3) Builder Experience Track brief (powers the award/perk answers).
  push({
    id: "builder-experience-track",
    type: "perk",
    text: truncate(builderTrack.markdown, 1500),
    sourceUrl: builderTrack.url,
  });

  // 4) FAQ — split by "### " headings.
  const faqSource = faq.metadata?.sourceURL ?? faq.url;
  const sections = faq.markdown
    .split(/\n(?=###\s)/)
    .map((s) => s.trim())
    .filter((s) => s.startsWith("### "));
  sections.forEach((section, i) => {
    const heading =
      section
        .split("\n")[0]
        ?.replace(/^###\s+/, "")
        .trim() ?? `${i}`;
    push({
      id: `faq-${slug(heading) || i}`,
      type: "faq",
      text: truncate(section, 1500),
      sourceUrl: faqSource,
    });
  });

  // 5) Logistics / Survival Pack — static on-the-ground knowledge.
  for (const l of LOGISTICS_CHUNKS) {
    push({ id: l.id, type: "logistics", text: l.text, sourceUrl: LOGISTICS_SOURCE });
  }

  return chunks;
}
