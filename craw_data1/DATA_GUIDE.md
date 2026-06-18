# AABW Data Guide

This guide explains the current scraper output structure and why `data/latest/events/` currently contains only Day 01 event files while Day 02-05 still have useful information elsewhere.

## Run Scraper

```bash
cd aabw_scraper
.venv/bin/python main.py --once
```

## Current Output Structure

The scraper writes the latest successful crawl into:

```text
data/latest/
```

The most important files are:

```text
data/latest/report.json
data/latest/event_report.json
data/latest/programme_days.json
data/latest/events.json
data/latest/events/
data/latest/external_events/
data/latest/registration_links.json
data/latest/locations.json
data/latest/retrieval_chunks.json
data/latest/section_programme.json
data/latest/section_daily_schedule.json
```

## Page-Level Data

These files are direct page scrape outputs:

```text
data/latest/home.json
data/latest/partners.json
data/latest/leaderboard.json
data/latest/builder_experience_track.json
```

They contain raw page-level markdown, page metadata, extracted links, and image references.

## Section-Level Data

The homepage contains important anchor sections that are not standalone routes. The scraper extracts them into section files:

```text
data/latest/section_programme.json
data/latest/section_daily_schedule.json
data/latest/section_faq.json
data/latest/section_partners_preview.json
data/latest/section_referral_programme.json
data/latest/section_scale.json
```

Important note: `/workshops` and `/attending` are not real pages on the current website. They are homepage anchors or labels, so the scraper intentionally does not save them as standalone page files.

## How Event Files Are Generated (`data/latest/events/`)

`data/latest/events/` contains structured event records extracted from the daily schedule and external Luma pages.

The scraper now uses two main strategies to discover events across all 5 days:

1. **Multi-Day Tab Scraping:** The scraper uses Firecrawl to click through all Day 1-5 tabs on the website to extract the schedule. It parses session times, titles, organizers, and RSVP links across all days.
2. **Luma Auto-Discovery:** Since some events (like Networking Night or specific workshops) might not be explicitly linked in the schedule yet, the scraper automatically checks the GenAI Fund Luma Organization page (`https://luma.com/gaf?k=c`) to discover and ingest any new events in the July 8-12 timeframe.

Therefore, `data/latest/events/` will contain events like:

```text
day01-registration-and-welcome.json
day01-byteplus.json
day04-agentic-ai-build-week-networking-night.json
```

If specific days (e.g. Day 05) appear to have fewer events, it simply means detailed sessions have not been published on the website or Luma page yet.

## Where Day 02-05 Data Exists Today

Day 02-05 are not missing. They exist as programme-level summaries in:

```text
data/latest/programme_days.json
data/latest/section_programme.json
data/latest/retrieval_chunks.json
```

Current programme-level data:

```text
Day 01 Enable    Wed · July 8   Tasco Office                  Partners: BytePlus, NVIDIA, TRAE, Apify
Day 02 Integrate Thu · July 9   AWS Office, Bitexco Tower     Partners: AWS
Day 03 Design    Fri · July 10  VNG Campus                    Partners: Agora, Google for Developers, TinyFish
Day 04 Build     Sat · July 11  Galaxy Innovation Park        Category: Keynotes, Networking, Late-night build
Day 05 Demo      Sun · July 12  Galaxy Innovation Park        Category: Demo Day, Award Ceremony
```

This data is useful for answering questions like:

```text
What is Day 2 about?
Where is Day 3?
Which partners are listed for Day 3?
When is Demo Day?
```

It is not enough to answer detailed event questions like:

```text
What time is the Day 2 AWS workshop?
Who is speaking on Day 2?
What is the Day 2 RSVP link?
What is the Google Maps link for the Day 2 session?
```

Those fields require the website to publish detailed schedule rows or an external event detail link.

## Difference Between Programme Days And Events

`programme_days.json` is the day-level schedule summary.

Example fields:

```text
day_number
theme
date
display_date
category
venue
partners
summary_markdown
```

`events.json` and `events/*.json` are session-level structured records.

Example fields:

```text
id
title
day_number
start_time
end_time
venue
registration_url
event_detail_url
speakers
requirements
location.google_maps_url
location.latitude
location.longitude
quality_level
important_hash
content_hash
```

## Event Quality Levels

Events have a `quality_level` field:

```text
full: has event detail, registration, speaker data, requirements, and map/location
partial: has some detail but misses important fields
summary_only: only known from homepage schedule
stale: existed previously but is no longer listed on homepage
```

Current state:

```text
full: day01-byteplus, day01-nvidia, day01-trae
summary_only: day01-registration-and-welcome, day01-lunch
```

Day 02-05 are programme summaries, not event records, so they do not appear in `events/` yet.

## How Future Day 02 Updates Will Be Captured

Run:

```bash
.venv/bin/python main.py --once
```

If the website adds Day 02 details to the daily schedule in a format similar to Day 01, the scraper will:

```text
detect the changed homepage
update section_daily_schedule.json
parse new Day 02 event rows
create new data/latest/events/day02-*.json files
update data/latest/events.json
update data/latest/registration_links.json
update data/latest/locations.json
update data/latest/retrieval_chunks.json
update data/latest/event_report.json
```

If Day 02 includes new Luma RSVP links, the scraper will crawl those external event pages, enrich the event records, and cache the parsed result under:

```text
data/latest/external_events/
```

If the website only updates the day-level programme card, the scraper will update:

```text
data/latest/programme_days.json
data/latest/section_programme.json
data/latest/retrieval_chunks.json
```

It will not create `events/day02-*.json` until actual session-level data appears.

## Why Data Looks Scattered

The live website itself splits information across different UI areas:

```text
Programme section: day theme, venue, partner logos, high-level category
Daily Schedule section: concrete sessions, times, RSVP links
Luma event pages: speaker, description, requirements, coordinates, cover image
```

The scraper preserves each layer and also merges them where possible:

```text
programme_days.json: normalized day summaries
events.json: merged structured event records
external_events/*.json: cached Luma details
retrieval_chunks.json: Q&A-ready text summaries
```

This is intentional. It keeps source-level traceability while still producing app-friendly merged files.

## Recommended Files For App Or Q&A Use

Use these first:

```text
data/latest/retrieval_chunks.json
data/latest/events.json
data/latest/programme_days.json
data/latest/registration_links.json
data/latest/locations.json
```

Use these for debugging/source inspection:

```text
data/latest/section_programme.json
data/latest/section_daily_schedule.json
data/latest/external_events/*.json
data/latest/report.json
data/latest/event_report.json
```

## Quick Health Check

Run:

```bash
.venv/bin/python sanity_check.py
```

Expected current result:

```text
Sanity check passed
```
