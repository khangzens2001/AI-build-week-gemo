# AABW Scraper

Scrapes `https://agenticaibuildweek.genaifund.ai/` into clean page, section, event, link, asset, and Q&A-ready JSON outputs.

For a detailed explanation of the output structure and why `data/latest/events/` currently only contains Day 01 event files, see [`DATA_GUIDE.md`](DATA_GUIDE.md).

## Setup

You can run this project either natively using Python or via Docker.

### Option 1: Docker (Recommended)

1. Make sure you have Docker and Docker Compose installed.
2. Create `.env` file from example:

   ```bash
   cp .env.example .env
   ```

3. Edit `.env` to add your `FIRECRAWL_API_KEY`.
4. Start the scraper in the background:

   ```bash
   docker-compose up -d
   ```

   *By default, the Docker container runs in scheduler mode (scrapes every 15 minutes). Data will be saved to the `./data` folder on your host machine.*

To view logs:

```bash
docker-compose logs -f
```

### Option 2: Native Python

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env
```

Set environment variables in your `.env` file before running:

```bash
FIRECRAWL_API_KEY="your_firecrawl_api_key_here"
EXTERNAL_EVENT_RECHECK_HOURS=6
```

## Run (Native)

Run once:

```bash
.venv/bin/python main.py --once
```

Run scheduler (15 min loop):

```bash
.venv/bin/python main.py
```

## Validate

Offline parser tests:

```bash
FIRECRAWL_API_KEY=test .venv/bin/python -m unittest discover -s tests
```

Latest data sanity check:

```bash
FIRECRAWL_API_KEY=test .venv/bin/python sanity_check.py
```

## Outputs

Core page data:

```text
data/latest/home.json
data/latest/partners.json
data/latest/leaderboard.json
data/latest/builder_experience_track.json
```

Homepage sections:

```text
data/latest/section_programme.json
data/latest/section_daily_schedule.json
data/latest/section_faq.json
```

Event data:

```text
data/latest/programme_days.json
data/latest/events.json
data/latest/events/*.json
data/latest/external_events/*.json
data/latest/registration_links.json
data/latest/locations.json
data/latest/retrieval_chunks.json
data/latest/event_report.json
data/latest/source_manifest.json
```

Aggregate data:

```text
data/latest/all_content.md
data/latest/all_links.json
data/latest/assets.json
data/latest/report.json
data/latest/site_index.json
```

## Event Quality

`quality_level` values:

```text
full: workshop has detail page, registration, speakers, requirements, and map/location
partial: event has some external detail but is missing important fields
summary_only: event is only known from homepage schedule
stale: event existed previously but is no longer listed on homepage
```

## Change Detection

Events use two hashes:

```text
important_hash: schedule/identity fields such as title, date, time, venue, registration, speakers, location
content_hash: Q&A fields such as description, takeaways, requirements, cover image, external time/location text
```

If neither hash changes, the existing event file is not overwritten. If either hash changes, the old event is archived under `data/history/events/`.

External Luma pages are controlled by `source_manifest.json` and `EXTERNAL_EVENT_RECHECK_HOURS`. If the cached parse is still fresh, the scraper reuses it without calling Firecrawl for that external event.
