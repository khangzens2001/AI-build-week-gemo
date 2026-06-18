import json
import os
import sys

import config


def load_json(name):
    path = os.path.join(config.LATEST_DIR, name)
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def fail(message, failures):
    failures.append(message)


def main():
    failures = []
    report = load_json("report.json")
    event_report = load_json("event_report.json")
    events = load_json("events.json")
    programme_days = load_json("programme_days.json")
    links = load_json("all_links.json")
    assets = load_json("assets.json")

    if report.get("skipped"):
        fail(f"unexpected skipped pages: {report['skipped']}", failures)
    if report.get("scraped_ok") != 4:
        fail(f"expected 4 scraped pages, got {report.get('scraped_ok')}", failures)
    if len(programme_days) != 5:
        fail(f"expected 5 programme days, got {len(programme_days)}", failures)
    if len({event["id"] for event in events}) != len(events):
        fail("event ids are not unique", failures)
    if event_report.get("events_incomplete") != 0:
        fail("event report contains incomplete events", failures)
    if event_report.get("events_full", 0) < 3:
        fail("expected at least 3 full events", failures)
    if len({link["url"] for link in links}) != len(links):
        fail("all_links.json contains duplicate URLs", failures)
    for event in events:
        if event.get("quality_level") == "full":
            if not event.get("registration_url"):
                fail(f"full event missing registration_url: {event['id']}", failures)
            if event.get("type") == "workshop" and not event.get("speakers"):
                fail(f"full event missing speakers: {event['id']}", failures)
            if not event.get("location", {}).get("google_maps_url"):
                fail(f"full event missing Google Maps URL: {event['id']}", failures)
    if any(asset.get("url", "").startswith("data:image") for asset in assets):
        fail("assets.json still contains full inline data URI", failures)

    if failures:
        for message in failures:
            print(f"FAIL: {message}")
        return 1
    print("Sanity check passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
