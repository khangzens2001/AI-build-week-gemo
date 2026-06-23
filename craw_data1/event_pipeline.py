import hashlib
import json
import logging
import os
import re
from datetime import datetime, timedelta
from urllib.parse import urlparse, parse_qs, unquote

import config
from scraper import extract_markdown_links, validate_page

logger = logging.getLogger(__name__)


DAY_META = {
    1: {"theme": "Enable", "date": "2026-07-08", "display_date": "Wed · July 8", "category": "Workshops", "venue": "Tasco Office"},
    2: {"theme": "Integrate", "date": "2026-07-09", "display_date": "Thu · July 9", "category": "Workshops", "venue": "AWS Office, Bitexco Tower"},
    3: {"theme": "Design", "date": "2026-07-10", "display_date": "Fri · July 10", "category": "Workshops", "venue": "VNG Campus"},
    4: {"theme": "Build", "date": "2026-07-11", "display_date": "Sat · July 11", "category": "Keynotes · Networking · Late-night build", "venue": "Galaxy Innovation Park"},
    5: {"theme": "Demo", "date": "2026-07-12", "display_date": "Sun · July 12", "category": "Demo Day · Award Ceremony", "venue": "Galaxy Innovation Park"},
}
DATE_TO_DAY = {meta["date"]: day_number for day_number, meta in DAY_META.items()}
PARSER_VERSION = 4


def slugify(value: str) -> str:
    value = value.lower().replace("&", "and")
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-") or "event"


def compute_hash(data) -> str:
    payload = json.dumps(data, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def load_json(path: str, default):
    if not os.path.exists(path):
        return default
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default


def write_json(path: str, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def normalize_markdown(text: str) -> str:
    text = text.replace("\u200b", "")
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()


def parse_programme_days(programme_markdown: str) -> list[dict]:
    days = []
    text = normalize_markdown(programme_markdown)
    for day_number, meta in DAY_META.items():
        day_pattern = re.compile(rf"(?:###\s*)?Day\s*{day_number:02d}\s*:\s*{meta['theme']}", re.I)
        next_pattern = re.compile(rf"(?:###\s*)?Day\s*{day_number + 1:02d}\s*:", re.I) if day_number < 5 else None
        start_match = day_pattern.search(text)
        next_match = next_pattern.search(text, start_match.end()) if start_match and next_pattern else None
        next_date_match = None
        if start_match and day_number < 5:
            next_display = DAY_META[day_number + 1]["display_date"]
            next_date_match = re.search(re.escape(next_display), text[start_match.end():])
        end_candidates = []
        if next_match:
            end_candidates.append(next_match.start())
        if next_date_match and start_match:
            end_candidates.append(start_match.end() + next_date_match.start())
        end_index = min(end_candidates) if end_candidates else len(text)
        chunk = text[start_match.start():end_index] if start_match else ""
        venue_match = re.search(r"Venue:\s*([^\n]+)", chunk)
        category_match = re.search(r"\n(Workshops|Keynotes|Networking|Demo Day|Award Ceremony)\n", chunk)
        _, images = extract_markdown_links(chunk)
        partners = []
        for image in images:
            alt = image.get("alt", "").replace(" logo", "").strip()
            if alt and alt not in partners:
                partners.append(alt)
        days.append({
            "day_number": day_number,
            "theme": meta["theme"],
            "date": meta["date"],
            "display_date": meta["display_date"],
            "category": category_match.group(1) if category_match else meta["category"],
            "venue": venue_match.group(1).strip() if venue_match else meta["venue"],
            "partners": partners,
            "source": "homepage_programme",
            "source_url": f"{config.BASE_URL}/#programme",
            "summary_markdown": chunk,
        })
    return days


def base_event(day_number: int, title: str, event_type: str = "session") -> dict:
    meta = DAY_META[day_number]
    return {
        "id": f"day{day_number:02d}-{slugify(title)}",
        "source": "homepage_daily_schedule",
        "source_urls": [f"{config.BASE_URL}/#daily_schedule"],
        "type": event_type,
        "day_number": day_number,
        "day_theme": meta["theme"],
        "date": meta["date"],
        "display_date": meta["display_date"],
        "timezone": "Indochina Time, GMT+7",
        "title": title,
        "venue": meta["venue"],
        "city": "Ho Chi Minh City",
        "country": "Vietnam",
        "registration_url": None,
        "event_detail_url": None,
        "description": "",
        "takeaways": [],
        "speakers": [],
        "hosts": [],
        "presented_by": "GenAI Fund - Official",
        "requirements": [],
        "location": {
            "venue_name": meta["venue"],
            "address_visibility": "public_summary",
            "address_text": meta["venue"],
            "city": "Ho Chi Minh City",
            "country": "Vietnam",
            "latitude": None,
            "longitude": None,
            "google_maps_url": None,
            "source": "homepage",
        },
        "status": "scheduled",
        "confidence": "homepage",
    }


def parse_daily_schedule_events(day_schedules: dict[int, str]) -> list[dict]:
    events = []

    workshop_pattern = re.compile(
        r"(?P<time>\d{1,2}:\d{2}\s*[–-]\s*\d{1,2}:\d{2})·(?P<partner>[^\n]+)\n+\s*(?P<title>.+?)\n+\s*\[RSVP\]\((?P<url>https://luma\.com/[^)]+)\)",
        re.S,
    )
    
    generic_session_pattern = re.compile(
        r"(?P<time>\d{1,2}:\d{2}(?:\s*[–-]\s*\d{1,2}:\d{2})?)·(?P<title>[^\n]+)",
    )

    for day_number, schedule_markdown in day_schedules.items():
        text = normalize_markdown(schedule_markdown)
        if not text:
            continue
            
        if day_number == 1 and "Registration & Welcome" in text:
            registration = base_event(1, "Registration & Welcome", "administrative")
            reg_match = re.search(r"(\d{1,2}:\d{2})\s*Registration & Welcome", text)
            registration["start_time"] = reg_match.group(1) if reg_match else "09:00"
            registration["end_time"] = None
            events.append(registration)
            
        if day_number == 1 and "Lunch" in text:
            lunch = base_event(1, "Lunch", "break")
            lunch_match = re.search(r"(\d{1,2}:\d{2})\s*Lunch", text)
            lunch["start_time"] = lunch_match.group(1) if lunch_match else "12:00"
            lunch["end_time"] = None
            events.append(lunch)

        for match in workshop_pattern.finditer(text):
            partner = match.group("partner").strip()
            title = normalize_markdown(match.group("title"))
            event = base_event(day_number, title, "workshop")
            event["id"] = f"day{day_number:02d}-{slugify(partner)}"
            event["organizer_or_partner"] = partner
            event["start_time"], event["end_time"] = [part.strip() for part in re.split(r"[–-]", match.group("time"), maxsplit=1)]
            event["registration_url"] = match.group("url")
            event["event_detail_url"] = match.group("url")
            event["status"] = "registration_required"
            event["confidence"] = "homepage_schedule"
            event["source_urls"].append(match.group("url"))
            events.append(event)
            
        text_without_workshops = workshop_pattern.sub("", text)
        for match in generic_session_pattern.finditer(text_without_workshops):
            title = match.group("title").strip()
            if title in ["Registration & Welcome", "Lunch"]:
                continue
            event_type = "session"
            if "networking" in title.lower():
                event_type = "networking"
            elif "keynote" in title.lower():
                event_type = "keynote"
                
            event = base_event(day_number, title, event_type)
            event["id"] = f"day{day_number:02d}-{slugify(title)}"
            time_str = match.group("time")
            if "–" in time_str or "-" in time_str:
                event["start_time"], event["end_time"] = [part.strip() for part in re.split(r"[–-]", time_str, maxsplit=1)]
            else:
                event["start_time"] = time_str.strip()
            event["confidence"] = "homepage_schedule"
            events.append(event)

    return sorted(events, key=lambda item: (item["day_number"], item.get("start_time") or "99:99"))


def parse_bundle_schedule_events(bundle_days: list[dict]) -> list[dict]:
    """Convert structured JS bundle schedule data into event records.
    
    Each bundle day has:
      day, weekday, dateLabel, theme, venue, venueImage, workshop_partners, blocks
    Each block has:
      time, end, host, label, tone, luma, lumaId
    """
    events = []
    
    for day_data in bundle_days:
        day_number = int(day_data.get("day", 0))
        if day_number == 0:
            continue
        venue = day_data.get("venue", "")
        
        for block in day_data.get("blocks", []):
            time_start = block.get("time", "")
            time_end = block.get("end")
            host = block.get("host") or ""
            label = block.get("label") or ""
            tone = block.get("tone", "")
            luma_url = block.get("luma")
            
            title = label if label else host
            if not title:
                continue
            
            # Determine event type from tone
            if tone == "break":
                event_type = "break" if "Lunch" in title else "administrative"
            elif tone == "signature":
                if "networking" in title.lower():
                    event_type = "networking"
                elif "keynot" in title.lower() or "ceremony" in title.lower():
                    event_type = "keynote"
                else:
                    event_type = "session"
            elif tone == "workshop":
                event_type = "workshop"
            else:
                event_type = "session"
            
            event = base_event(day_number, title, event_type)
            slug_base = host if host else title
            event["id"] = f"day{day_number:02d}-{slugify(slug_base)}"
            event["start_time"] = time_start
            event["end_time"] = time_end
            event["venue"] = venue
            event["confidence"] = "bundle_schedule"
            event["source"] = "js_bundle_schedule"
            
            if host:
                event["organizer_or_partner"] = host
            if luma_url:
                event["registration_url"] = luma_url
                event["event_detail_url"] = luma_url
                event["status"] = "registration_required"
                event["source_urls"].append(luma_url)
            
            events.append(event)
    
    return sorted(events, key=lambda e: (e["day_number"], e.get("start_time") or "99:99"))


def extract_section(markdown: str, start_marker: str, end_markers: list[str]) -> str:
    start = markdown.find(start_marker)
    if start < 0:
        return ""
    start += len(start_marker)
    end = len(markdown)
    for marker in end_markers:
        idx = markdown.find(marker, start)
        if idx >= 0:
            end = min(end, idx)
    return normalize_markdown(markdown[start:end])


def parse_names_from_bullets(section: str) -> list[str]:
    names = []
    for line in section.splitlines():
        line = line.strip(" -\t")
        if not line:
            continue
        line = re.sub(r"\*+", "", line).strip()
        if line.lower() in {"s", "speaker", "speakers"}:
            continue
        if " — " in line:
            names.append(line)
        elif line and not line.startswith("["):
            names.append(line)
    return names


def parse_requirements(markdown: str, about: str) -> list[str]:
    text = f"{markdown}\n{about}".lower()
    requirements = []
    if "must be registered for agentic ai build week" in text:
        requirements.append("Must be registered for Agentic AI Build Week")
    if "seats are prioritised" in text or "seats are prioritized" in text:
        requirements.append("Seats are prioritised for Builder or Founding Builder ticket holders")
    if "devpost" in text:
        requirements.append("AABW Buildathon Devpost signup is recommended")
    if "private event" in text or "approval required" in text or "require approval" in text:
        requirements.append("Private event; approval required; limited seats")
    return requirements


def parse_google_maps(markdown: str) -> tuple[str | None, float | None, float | None]:
    matches = re.findall(r"\]\((https://www\.google\.com/maps/search/\?[^)]+)\)", markdown)
    fallback_url = matches[0] if matches else None
    for url in matches:
        parsed = urlparse(url)
        query = parse_qs(parsed.query).get("query", [""])[0]
        decoded = unquote(query)
        parts = decoded.split(",")
        if len(parts) != 2:
            continue
        try:
            return url, float(parts[0]), float(parts[1])
        except ValueError:
            continue
    return fallback_url, None, None


def parse_luma_date(date_text: str) -> str | None:
    cleaned = re.sub(r"^[📅\s]+", "", date_text).strip()
    for fmt in ("%A, %B %d, %Y", "%d %B %Y", "%B %d, %Y"):
        try:
            return datetime.strptime(cleaned, fmt).date().isoformat()
        except ValueError:
            continue
    return None


def parse_luma_time_range(time_text: str) -> tuple[str | None, str | None]:
    match = re.search(r"(\d{1,2}:\d{2})\s*(AM|PM)?\s*[–-]\s*(\d{1,2}:\d{2})\s*(AM|PM)?", time_text, re.I)
    if not match:
        return None, None
    start, start_period, end, end_period = match.groups()
    if not start_period and end_period:
        start_period = end_period

    def to_24h(value: str, period: str | None) -> str:
        if not period:
            return value
        hour, minute = [int(part) for part in value.split(":")]
        period = period.upper()
        if period == "PM" and hour != 12:
            hour += 12
        if period == "AM" and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute:02d}"

    return to_24h(start, start_period), to_24h(end, end_period)


def parse_luma_event(data: dict) -> dict:
    markdown = normalize_markdown(data.get("markdown", ""))
    links, images = extract_markdown_links(markdown)
    title_match = re.search(r"^#\s+(.+)$", markdown, re.M)
    title = title_match.group(1).strip() if title_match else data.get("title", "")
    about = extract_section(markdown, "About Event", ["Location", "Presented by", "Hosted By"])
    takeaways = parse_names_from_bullets(extract_section(about, "What you'll take away", ["Your speaker", "Your speakers", "Event details", "Before you apply"]))
    speakers = parse_names_from_bullets(extract_section(about, "Your speakers", ["Event details", "Before you apply"]))
    if not speakers:
        speakers = parse_names_from_bullets(extract_section(about, "Your speaker", ["Event details", "Before you apply"]))
    requirements = parse_requirements(markdown, about)
    map_url, latitude, longitude = parse_google_maps(markdown)
    date_match = re.search(r"📅\s*([^\n]+)", markdown)
    
    time_text = ""
    time_header_match = re.search(r"(\d{1,2}:\d{2}\s*(?:AM|PM)?\s*[-–]\s*\d{1,2}:\d{2}\s*(?:AM|PM)?(?:\s*[A-Z+0-9]+)?)", markdown[:1000], re.I)
    if time_header_match:
        time_text = time_header_match.group(1).strip()
    else:
        time_match = re.search(r"[🕐⏰]\s*([^\n]+)", markdown)
        if time_match:
            time_text = time_match.group(1).strip()
            
    location_match = re.search(r"📍\s*([^\n]+)", markdown)
    cover_image = images[0]["url"] if images else None
    status, reason = validate_page({"markdown": markdown, "title": title})

    return {
        "url": data.get("url"),
        "title": title,
        "markdown": markdown,
        "status": status,
        "status_reason": reason,
        "description": about,
        "takeaways": takeaways,
        "speakers": speakers,
        "requirements": requirements,
        "date_text": date_match.group(1).strip() if date_match else "",
        "date": parse_luma_date(date_match.group(1).strip()) if date_match else None,
        "time_text": time_text,
        "location_text": location_match.group(1).strip() if location_match else "",
        "google_maps_url": map_url,
        "latitude": latitude,
        "longitude": longitude,
        "cover_image": cover_image,
        "links": links,
        "images": images,
        "raw_hash": compute_hash(markdown),
    }


def merge_event_details(event: dict, detail: dict | None) -> dict:
    if not detail or detail.get("status") != "ok":
        return event
    merged = dict(event)
    merged["source"] = "homepage_daily_schedule+luma"
    merged["confidence"] = "homepage+external"
    merged["description"] = detail.get("description") or merged.get("description", "")
    merged["takeaways"] = detail.get("takeaways", [])
    merged["speakers"] = detail.get("speakers", [])
    merged["requirements"] = detail.get("requirements", [])
    merged["cover_image"] = detail.get("cover_image")
    if detail.get("time_text"):
        merged["external_time_text"] = detail["time_text"]
    if detail.get("location_text"):
        merged["external_location_text"] = detail["location_text"]
    if detail.get("google_maps_url"):
        merged["location"] = {
            **merged["location"],
            "address_visibility": "register_to_see_address",
            "address_text": detail.get("location_text") or merged["city"],
            "latitude": detail.get("latitude"),
            "longitude": detail.get("longitude"),
            "google_maps_url": detail.get("google_maps_url"),
            "source": "luma",
        }
    return merged


def score_event_completeness(event: dict) -> tuple[float, list[str], list[str]]:
    fields = ["title", "date", "start_time", "day_number", "day_theme", "venue", "city"]
    if event.get("type") == "workshop":
        fields.extend(["registration_url", "event_detail_url", "description", "speakers", "requirements"])
    missing = []
    for field in fields:
        value = event.get(field)
        if value in (None, "", []):
            missing.append(field)
    if event.get("type") == "workshop" and not event.get("location", {}).get("google_maps_url"):
        missing.append("google_maps_url")
    expected_count = len(fields) + (1 if event.get("type") == "workshop" else 0)
    score = round((expected_count - len(missing)) / expected_count, 2)
    warnings = []
    if event.get("confidence") == "homepage":
        warnings.append("summary-only event from homepage")
    if event.get("location", {}).get("address_visibility") == "register_to_see_address":
        warnings.append("exact address hidden until registration")
    return score, missing, warnings


def important_event_payload(event: dict) -> dict:
    return {
        key: event.get(key)
        for key in ["title", "date", "start_time", "end_time", "venue", "registration_url", "event_detail_url", "speakers"]
    } | {"location": event.get("location", {})}


def content_event_payload(event: dict) -> dict:
    return {
        key: event.get(key)
        for key in ["description", "takeaways", "requirements", "cover_image", "external_time_text", "external_location_text"]
    }


def event_quality_level(event: dict) -> str:
    if event.get("status") == "not_listed_on_homepage":
        return "stale"
    if event.get("type") not in {"workshop", "networking", "external_event"}:
        return "summary_only"
    required = [event.get("registration_url"), event.get("description"), event.get("requirements")]
    if event.get("type") == "workshop":
        required.append(event.get("speakers"))
    if all(required) and event.get("location", {}).get("google_maps_url"):
        return "full"
    if event.get("registration_url") or event.get("event_detail_url"):
        return "partial"
    return "summary_only"


def build_event_from_external_detail(detail: dict, source_config: dict) -> dict | None:
    if not detail or detail.get("status") != "ok":
        return None
    event_date = detail.get("date")
    day_number = DATE_TO_DAY.get(event_date, source_config.get("day_number"))
    if not day_number:
        return None
    meta = DAY_META[day_number]
    start_time, end_time = parse_luma_time_range(detail.get("time_text", ""))
    if not start_time:
        desc_time_match = re.search(r"[🕐⏰]\s*([^\n]+)", detail.get("description", ""))
        if desc_time_match:
            start_time, end_time = parse_luma_time_range(desc_time_match.group(1).strip())
            
    title = detail.get("title", "External Event")
    event_type = "networking" if "networking" in f"{title} {detail.get('description', '')}".lower() else "external_event"
    location_text = detail.get("location_text") or meta["venue"]
    event = {
        "id": f"day{day_number:02d}-{slugify(title)}",
        "source": source_config.get("source", "known_external_event"),
        "source_urls": [detail.get("url")],
        "type": event_type,
        "day_number": day_number,
        "day_theme": meta["theme"],
        "date": event_date or meta["date"],
        "display_date": meta["display_date"],
        "timezone": "Indochina Time, GMT+7",
        "title": title,
        "venue": location_text,
        "city": "Ho Chi Minh City",
        "country": "Vietnam",
        "registration_url": detail.get("url"),
        "event_detail_url": detail.get("url"),
        "description": detail.get("description", ""),
        "takeaways": detail.get("takeaways", []),
        "speakers": detail.get("speakers", []),
        "hosts": [],
        "presented_by": "GenAI Fund - Official",
        "requirements": detail.get("requirements", []),
        "location": {
            "venue_name": location_text,
            "address_visibility": "public_summary",
            "address_text": location_text,
            "city": "Ho Chi Minh City",
            "country": "Vietnam",
            "latitude": detail.get("latitude"),
            "longitude": detail.get("longitude"),
            "google_maps_url": detail.get("google_maps_url"),
            "source": "luma",
        },
        "status": "registration_required",
        "confidence": source_config.get("confidence", "known_external_event"),
        "start_time": start_time,
        "end_time": end_time,
        "cover_image": detail.get("cover_image"),
        "external_time_text": detail.get("time_text", ""),
        "external_location_text": location_text,
        "source_note": source_config.get("note", ""),
    }
    return event


def archive_if_changed(event_id: str, old_event: dict, new_event: dict):
    if not old_event:
        return
    old_important = old_event.get("important_hash") or compute_hash(important_event_payload(old_event))
    new_important = new_event.get("important_hash") or compute_hash(important_event_payload(new_event))
    old_content = old_event.get("content_hash") or compute_hash(content_event_payload(old_event))
    new_content = new_event.get("content_hash") or compute_hash(content_event_payload(new_event))
    if old_important == new_important and old_content == new_content:
        return
    timestamp = datetime.fromisoformat(old_event.get("scraped_at", datetime.now().isoformat())).strftime("%Y%m%dT%H%M%S")
    path = os.path.join(config.HISTORY_DIR, "events", timestamp, f"{event_id}.json")
    write_json(path, old_event)


def build_retrieval_chunks(programme_days: list[dict], events: list[dict]) -> list[dict]:
    chunks = []
    for day in programme_days:
        text = f"Day {day['day_number']:02d} {day['theme']} is on {day['display_date']} ({day['date']}) at {day['venue']}. Category: {day['category']}. Partners: {', '.join(day.get('partners', [])) or 'TBC'}."
        chunks.append({"id": f"day{day['day_number']:02d}", "type": "programme_day", "text": text, "source_url": day["source_url"]})
    for event in events:
        location = event.get("location", {})
        text = (
            f"{event['title']} is on Day {event['day_number']:02d} {event['day_theme']}, {event['display_date']} ({event['date']}), "
            f"from {event.get('start_time') or 'TBC'} to {event.get('end_time') or 'TBC'} {event.get('timezone', '')}. "
            f"Venue: {event.get('venue')}. Registration: {event.get('registration_url') or 'not provided'}. "
            f"Speakers: {', '.join(event.get('speakers', [])) or 'TBC'}. "
            f"Google Maps: {location.get('google_maps_url') or 'not provided'}. "
            f"Description: {event.get('description') or 'No detailed description yet.'}"
        )
        chunks.append({"id": event["id"], "type": "event", "text": text, "source_url": event.get("event_detail_url") or event["source_urls"][0]})
    return chunks


class EventPipeline:
    def __init__(self, scraper):
        self.scraper = scraper
        self.manifest_path = os.path.join(config.LATEST_DIR, "source_manifest.json")
        self.manifest = load_json(self.manifest_path, {"sources": {}})

    def scrape_external_event(self, url: str) -> dict | None:
        source_id = f"luma_{url.rstrip('/').split('/')[-1]}"
        old = self.manifest.get("sources", {}).get(source_id, {})
        cached_path = os.path.join(config.LATEST_DIR, "external_events", f"{source_id}.json")
        cached = load_json(cached_path, None)
        last_scraped_at = old.get("last_scraped_at")
        if cached and old.get("parser_version") == PARSER_VERSION and last_scraped_at:
            try:
                next_recheck = datetime.fromisoformat(last_scraped_at) + timedelta(hours=config.EXTERNAL_EVENT_RECHECK_HOURS)
                if datetime.now() < next_recheck:
                    cached["unchanged"] = True
                    cached["skipped_by_ttl"] = True
                    return cached
            except ValueError:
                pass

        data = self.scraper.scrape_page(url)
        if data.get("status") != "ok":
            return cached
        raw_hash = compute_hash(data.get("markdown", ""))
        if old.get("raw_hash") == raw_hash and old.get("parser_version") == PARSER_VERSION:
            if cached:
                cached["unchanged"] = True
                return cached
        parsed = parse_luma_event(data)
        write_json(cached_path, parsed)
        self.manifest.setdefault("sources", {})[source_id] = {
            "url": url,
            "type": "external_event",
            "raw_hash": raw_hash,
            "parser_version": PARSER_VERSION,
            "last_scraped_at": datetime.now().isoformat(),
            "status": parsed.get("status"),
        }
        return parsed

    def discover_luma_events(self) -> list[str]:
        if not hasattr(config, "LUMA_ORG_PAGE") or not config.LUMA_ORG_PAGE:
            return []
            
        source_id = "luma_org_page"
        old = self.manifest.get("sources", {}).get(source_id, {})
        cached_path = os.path.join(config.LATEST_DIR, "external_events", f"{source_id}.json")
        cached = load_json(cached_path, None)
        last_scraped_at = old.get("last_scraped_at")
        
        if cached and last_scraped_at:
            try:
                next_recheck = datetime.fromisoformat(last_scraped_at) + timedelta(hours=config.EXTERNAL_EVENT_RECHECK_HOURS)
                if datetime.now() < next_recheck:
                    return [link["url"] for link in cached.get("links", []) if link.get("type") == "registration" and link.get("url") != config.LUMA_ORG_PAGE]
            except ValueError:
                pass

        data = self.scraper.scrape_page(config.LUMA_ORG_PAGE)
        if data.get("status") != "ok":
            return []
            
        write_json(cached_path, data)
        self.manifest.setdefault("sources", {})[source_id] = {
            "url": config.LUMA_ORG_PAGE,
            "type": "discovery_page",
            "last_scraped_at": datetime.now().isoformat(),
            "status": "ok",
        }
        
        urls = [link["url"] for link in data.get("links", []) if link.get("type") == "registration" and link.get("url") != config.LUMA_ORG_PAGE]
        return list(set(urls))

    def run(self, sections: dict) -> dict:
        programme_days = parse_programme_days(sections.get("programme", {}).get("markdown", ""))
        
        # Prefer bundle schedule (all 5 days) over markdown parsing (Day 1 only)
        bundle_schedule = sections.get("bundle_schedule", [])
        if bundle_schedule:
            events = parse_bundle_schedule_events(bundle_schedule)
            logger.info(f"Parsed {len(events)} events from JS bundle schedule")
        else:
            day_schedules = sections.get("daily_schedules", {1: sections.get("daily_schedule", {}).get("markdown", "")})
            events = parse_daily_schedule_events(day_schedules)
            logger.info(f"Parsed {len(events)} events from markdown schedule (fallback)")
        
        # Save the bundle schedule data for reference
        if bundle_schedule:
            write_json(os.path.join(config.LATEST_DIR, "bundle_schedule.json"), bundle_schedule)
            
        details_by_url = {}
        for event in events:
            url = event.get("event_detail_url")
            if url and url not in details_by_url:
                details_by_url[url] = self.scrape_external_event(url)
        existing_urls = {event.get("event_detail_url") for event in events if event.get("event_detail_url")}
        
        discovered_urls = self.discover_luma_events()
        source_configs = list(config.KNOWN_EXTERNAL_EVENTS)
        known_urls = {sc["url"] for sc in source_configs}
        
        for d_url in discovered_urls:
            # We don't want to re-add the main AABW landing page Luma registration if it's there
            if d_url not in known_urls and "gaf-hm61" not in d_url:
                source_configs.append({
                    "url": d_url,
                    "source": "discovered_external_event",
                    "note": "Auto-discovered from GenAI Fund Luma page",
                    "confidence": "discovered_external_event"
                })
        
        for source_config in source_configs:
            url = source_config["url"]
            if url in existing_urls:
                continue
            details_by_url[url] = self.scrape_external_event(url)
            external_event = build_event_from_external_detail(details_by_url[url], source_config)
            if external_event:
                events.append(external_event)
        merged_events = []
        changed_counts = {"events_changed": 0, "events_content_changed": 0, "events_schedule_changed": 0, "events_stale": 0}
        # Human-readable titles of events that are genuinely new (first time seen)
        # or whose important/content fields changed this cycle. These drive the
        # Cue Pulse announcement text so a builder sees "X added / Y updated"
        # instead of a generic page-changed blurb.
        new_event_titles: list[str] = []
        changed_event_titles: list[str] = []
        latest_events_dir = os.path.join(config.LATEST_DIR, "events")
        os.makedirs(latest_events_dir, exist_ok=True)
        previous_event_ids = {
            filename[:-5]
            for filename in os.listdir(latest_events_dir)
            if filename.endswith(".json")
        }
        current_event_ids = set()
        for event in events:
            merged = merge_event_details(event, details_by_url.get(event.get("event_detail_url")))
            score, missing, warnings = score_event_completeness(merged)
            merged["completeness_score"] = score
            merged["missing_fields"] = missing
            merged["warnings"] = warnings
            merged["important_hash"] = compute_hash(important_event_payload(merged))
            merged["content_hash"] = compute_hash(content_event_payload(merged))
            merged["quality_level"] = event_quality_level(merged)
            merged["scraped_at"] = datetime.now().isoformat()
            current_event_ids.add(merged["id"])
            old_event = load_json(os.path.join(latest_events_dir, f"{merged['id']}.json"), {})
            if old_event and old_event.get("important_hash") == merged["important_hash"] and old_event.get("content_hash") == merged["content_hash"]:
                merged = old_event
            elif not old_event or merged["completeness_score"] >= old_event.get("completeness_score", 0):
                if old_event:
                    changed_counts["events_changed"] += 1
                    if old_event.get("important_hash") != merged["important_hash"]:
                        changed_counts["events_schedule_changed"] += 1
                    if old_event.get("content_hash") != merged["content_hash"]:
                        changed_counts["events_content_changed"] += 1
                    if merged.get("title"):
                        changed_event_titles.append(merged["title"])
                elif merged.get("title"):
                    # No prior file for this id → a brand-new event this cycle.
                    new_event_titles.append(merged["title"])
                archive_if_changed(merged["id"], old_event, merged)
                write_json(os.path.join(latest_events_dir, f"{merged['id']}.json"), merged)
            else:
                merged = old_event
            merged_events.append(merged)

        for stale_id in sorted(previous_event_ids - current_event_ids):
            old_event = load_json(os.path.join(latest_events_dir, f"{stale_id}.json"), {})
            if old_event and old_event.get("status") != "not_listed_on_homepage":
                old_event["status"] = "not_listed_on_homepage"
                old_event["quality_level"] = "stale"
                old_event["last_seen_at"] = old_event.get("scraped_at")
                old_event["marked_stale_at"] = datetime.now().isoformat()
                write_json(os.path.join(latest_events_dir, f"{stale_id}.json"), old_event)
                changed_counts["events_stale"] += 1
            if old_event:
                merged_events.append(old_event)

        registration_links = {
            "main_event_registration": "https://luma.com/gaf-hm61?utm_source=landing_page",
            "devpost": "https://agentic-ai-build-week-2026.devpost.com/",
            "workshop_rsvps": [
                {"event_id": event["id"], "url": event["registration_url"]}
                for event in merged_events if event.get("registration_url")
            ],
        }
        locations = [
            {"event_id": event["id"], **event.get("location", {})}
            for event in merged_events
        ]
        report = {
            "generated_at": datetime.now().isoformat(),
            "programme_days": len(programme_days),
            "events_total": len(merged_events),
            "events_with_registration": sum(1 for event in merged_events if event.get("registration_url")),
            "events_with_coordinates": sum(1 for event in merged_events if event.get("location", {}).get("latitude") is not None),
            "events_incomplete": sum(1 for event in merged_events if event.get("missing_fields")),
            "events_full": sum(1 for event in merged_events if event.get("quality_level") == "full"),
            "events_partial": sum(1 for event in merged_events if event.get("quality_level") == "partial"),
            "events_summary_only": sum(1 for event in merged_events if event.get("quality_level") == "summary_only"),
            **changed_counts,
            "new_event_titles": new_event_titles,
            "changed_event_titles": changed_event_titles,
            "external_event_pages_checked": len(details_by_url),
            "external_event_pages_skipped_unchanged": sum(1 for detail in details_by_url.values() if detail and detail.get("unchanged")),
            "external_event_pages_skipped_by_ttl": sum(1 for detail in details_by_url.values() if detail and detail.get("skipped_by_ttl")),
            "summary_only_days": [day["day_number"] for day in programme_days if day["day_number"] > 1],
            "events": [
                {
                    "id": event["id"],
                    "title": event["title"],
                    "completeness_score": event["completeness_score"],
                    "quality_level": event.get("quality_level"),
                    "missing_fields": event["missing_fields"],
                    "warnings": event["warnings"],
                }
                for event in merged_events
            ],
        }
        outputs = {
            "programme_days": programme_days,
            "events": merged_events,
            "registration_links": registration_links,
            "locations": locations,
            "retrieval_chunks": build_retrieval_chunks(programme_days, merged_events),
            "event_report": report,
            "source_manifest": self.manifest,
        }
        for name, data in outputs.items():
            write_json(os.path.join(config.LATEST_DIR, f"{name}.json"), data)
        write_json(self.manifest_path, self.manifest)
        return outputs
