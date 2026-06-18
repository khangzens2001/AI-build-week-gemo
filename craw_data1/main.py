"""
AABW Web Scraper — Main Entry Point
Usage:
    python main.py --once       # Run once and exit
    python main.py              # Run on schedule (every 15 min)
"""
import argparse
import json
import logging
import os
from datetime import datetime

import config
from scraper import FirecrawlScraper, extract_home_sections
from change_detector import ChangeDetector
from event_pipeline import EventPipeline

# --- Logging setup ---
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(
            f"{config.LOGS_DIR}/scraper.log", encoding="utf-8"
        ),
    ],
)
logger = logging.getLogger(__name__)


def save_json(path: str, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def save_text(path: str, text: str):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)


def build_aggregates(pages: dict, sections: dict, skipped: dict) -> dict:
    all_items = {**pages, **{f"section_{k}": v for k, v in sections.items()}}
    links_by_url = {}
    assets = []
    all_content_parts = []

    for name, data in all_items.items():
        title = data.get("title", name)
        url = data.get("url", "")
        markdown = data.get("markdown", "")
        all_content_parts.append(f"# {title}\n\nSource: {url}\n\n{markdown}\n")

        for link in data.get("links", []):
            key = link.get("url")
            if not key:
                continue
            record = links_by_url.setdefault(key, {"url": key, "type": link.get("type"), "text_variants": [], "appearances": []})
            if link.get("text") and link["text"] not in record["text_variants"]:
                record["text_variants"].append(link["text"])
            record["appearances"].append({"source": name, "source_url": url})
        for image in data.get("images", []):
            image_url = image.get("url", "")
            if image_url.startswith("data:image"):
                assets.append({"alt": image.get("alt", ""), "type": "inline_data_uri", "omitted": True, "source": name, "source_url": url})
            else:
                assets.append({**image, "source": name, "source_url": url})

    all_links = list(links_by_url.values())

    report = {
        "generated_at": datetime.now().isoformat(),
        "scraped_ok": len(pages),
        "sections_extracted": len(sections),
        "skipped": skipped,
        "total_links": len(all_links),
        "total_assets": len(assets),
        "pages": [
            {
                "name": name,
                "url": data.get("url"),
                "title": data.get("title"),
                "markdown_chars": len(data.get("markdown", "")),
                "links": len(data.get("links", [])),
                "images": len(data.get("images", [])),
            }
            for name, data in pages.items()
        ],
        "sections": [
            {
                "name": name,
                "url": data.get("url"),
                "title": data.get("title"),
                "markdown_chars": len(data.get("markdown", "")),
                "links": len(data.get("links", [])),
                "images": len(data.get("images", [])),
            }
            for name, data in sections.items()
        ],
    }

    return {
        "all_links": all_links,
        "assets": assets,
        "all_content": "\n\n---\n\n".join(all_content_parts),
        "site_index": report,
        "report": report,
    }


def run_scrape_job():
    """Execute one full scrape cycle."""
    logger.info("=" * 50)
    logger.info("Starting scrape job...")

    try:
        scraper = FirecrawlScraper()
    except RuntimeError as e:
        logger.error(str(e))
        raise SystemExit(1) from None
    detector = ChangeDetector()

    # 1. Discover URLs via /map
    urls = scraper.discover_urls()

    # 2. Scrape all pages
    results = scraper.scrape_all(urls)

    # 3. Check for changes and save only valid pages
    changed_count = 0
    saved_pages = {}
    skipped = {}
    for page_name, data in results.items():
        if data.get("status") != "ok":
            skipped[page_name] = {
                "url": data.get("url"),
                "status": data.get("status"),
                "reason": data.get("status_reason"),
            }
            logger.warning(f"[SKIP] {page_name}: {data.get('status_reason')}")
            continue

        changed = detector.process_and_save(page_name, data)
        saved_pages[page_name] = data
        if changed:
            changed_count += 1
            logger.info(f"[UPDATE] {page_name}")
        else:
            logger.info(f"[NO CHANGE] {page_name}")

    # 4. Extract homepage sections and write aggregate outputs
    sections = extract_home_sections(saved_pages["home"]) if "home" in saved_pages else {}
    for section_name, data in sections.items():
        detector.process_and_save(f"section_{section_name}", data)
        
    if sections:
        bundle_schedule = scraper.scrape_bundle_schedule()
        if bundle_schedule:
            sections["bundle_schedule"] = bundle_schedule

    event_outputs = EventPipeline(scraper).run(sections) if sections else {}

    # Exclude non-section data before building aggregates
    aggregate_sections = {k: v for k, v in sections.items() if isinstance(v, dict)}
    aggregates = build_aggregates(saved_pages, aggregate_sections, skipped)
    if event_outputs:
        aggregates["report"]["event_report"] = event_outputs["event_report"]
        aggregates["site_index"]["event_report"] = event_outputs["event_report"]
    save_json(os.path.join(config.LATEST_DIR, "all_links.json"), aggregates["all_links"])
    save_json(os.path.join(config.LATEST_DIR, "assets.json"), aggregates["assets"])
    save_json(os.path.join(config.LATEST_DIR, "site_index.json"), aggregates["site_index"])
    save_json(os.path.join(config.LATEST_DIR, "report.json"), aggregates["report"])
    save_text(os.path.join(config.LATEST_DIR, "all_content.md"), aggregates["all_content"])

    logger.info(
        f"Scrape job completed. {len(saved_pages)} ok, {len(sections)} sections, {len(skipped)} skipped, {changed_count} pages updated."
    )
    logger.info("=" * 50)


def start_scheduler():
    """Run scraper on a recurring schedule."""
    from apscheduler.schedulers.blocking import BlockingScheduler

    scheduler = BlockingScheduler()
    scheduler.add_job(
        run_scrape_job,
        "interval",
        minutes=config.SCRAPE_INTERVAL_MINUTES,
        next_run_time=datetime.now(),  # Run immediately on start
    )

    logger.info(
        f"Scheduler started. Interval: {config.SCRAPE_INTERVAL_MINUTES} min. Ctrl+C to stop."
    )
    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        logger.info("Scheduler stopped.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="AABW Web Scraper (Firecrawl)")
    parser.add_argument(
        "--once", action="store_true", help="Run scraper once and exit"
    )
    args = parser.parse_args()

    if args.once:
        run_scrape_job()
    else:
        start_scheduler()
