import logging
import re
import time
from html import unescape
from urllib.parse import urljoin, urlparse, urlunparse
from urllib.request import Request, urlopen

from firecrawl import FirecrawlApp
import config
from schedule_parser import parse_js_array, verify_against_raw
from mimo_parser import parse_markdown_with_mimo

logger = logging.getLogger(__name__)


def url_to_page_name(url: str) -> str:
    """Convert URL to a filesystem-safe page name."""
    path = normalize_url(url).replace(config.BASE_URL, "").strip("/")
    if not path:
        return "home"
    return path.replace("/", "_").replace("-", "_")


def normalize_url(url: str) -> str:
    """Normalize internal page URLs for dedupe and stable filenames."""
    joined = urljoin(config.BASE_URL + "/", url.strip())
    parsed = urlparse(joined)
    path = parsed.path.rstrip("/") or "/"
    return urlunparse((parsed.scheme, parsed.netloc, path, "", "", ""))


def is_internal_page(url: str) -> bool:
    parsed = urlparse(normalize_url(url))
    base = urlparse(config.BASE_URL)
    path = parsed.path.lower()
    blocked_paths = {"/attending", "/workshops"}
    blocked_prefixes = ("/assets/", "/__l5e/", "/venues/", "/workshops/")
    blocked_extensions = (
        ".avif", ".css", ".gif", ".ico", ".jpeg", ".jpg", ".js",
        ".json", ".png", ".svg", ".webmanifest", ".webp", ".xml",
    )
    return (
        parsed.netloc == base.netloc
        and path not in blocked_paths
        and not path.startswith(blocked_prefixes)
        and not path.endswith(blocked_extensions)
    )


def fetch_text(url: str, timeout: int = 20) -> str:
    request = Request(url, headers={"User-Agent": "AABW-Scraper/1.0"})
    with urlopen(request, timeout=timeout) as response:
        return response.read().decode("utf-8", errors="replace")


def extract_urls_from_html(html: str) -> list[str]:
    urls = []
    for match in re.finditer(r"\b(?:href|src)=[\"']([^\"']+)[\"']", html, re.I):
        value = unescape(match.group(1)).strip()
        if value and not value.startswith(("#", "mailto:", "tel:", "javascript:")):
            urls.append(urljoin(config.BASE_URL + "/", value))
    return urls


def extract_markdown_links(markdown: str) -> tuple[list[dict], list[dict]]:
    images = []
    image_spans = []
    for match in re.finditer(r"!\[([^\]]*)\]\(([^)]+)\)", markdown):
        image_spans.append(match.span())
        images.append({"alt": match.group(1).strip(), "url": match.group(2).strip()})

    links = []
    for match in re.finditer(r"\[([^\]]+)\]\(([^)]+)\)", markdown):
        if any(start <= match.start() < end for start, end in image_spans):
            continue
        url = match.group(2).strip()
        links.append({
            "text": re.sub(r"\s+", " ", match.group(1)).strip(),
            "url": url,
            "type": classify_link(url),
        })
    return links, images


def classify_link(url: str) -> str:
    if url.startswith("mailto:"):
        return "email"
    parsed = urlparse(urljoin(config.BASE_URL + "/", url))
    if parsed.netloc == urlparse(config.BASE_URL).netloc:
        return "internal_anchor" if parsed.fragment else "internal_page"
    if "luma.com" in parsed.netloc:
        return "registration"
    if "discord" in parsed.netloc:
        return "community"
    if "whatsapp" in parsed.netloc:
        return "community"
    if "drive.google.com" in parsed.netloc:
        return "document"
    if "devpost.com" in parsed.netloc:
        return "devpost"
    return "external"


def validate_page(data: dict) -> tuple[str, str]:
    markdown = (data.get("markdown") or "").strip()
    title = (data.get("title") or "").lower()
    if data.get("error"):
        return "failed_api", data["error"]
    if not markdown:
        return "skipped_empty", "empty markdown"
    if "# 404" in markdown or "Oops! Page not found" in markdown or title == "404":
        return "skipped_404", "page returned 404 content"
    if len(markdown) < 300:
        return "skipped_empty", f"markdown too short ({len(markdown)} chars)"
    return "ok", ""


def extract_home_sections(home_data: dict) -> dict[str, dict]:
    markdown = home_data.get("markdown", "")
    markers = [
        ("hero", "# Agentic AIBuild Week"),
        ("partners_preview", "Backed by the AI Stack Building the Future"),
        ("scale", "The Scale"),
        ("programme", "The Programme"),
        ("daily_schedule", "Daily Schedule"),
        ("referral_programme", "Referral Programme"),
        ("faq", "FAQ"),
    ]

    found = []
    for name, marker in markers:
        index = markdown.find(marker)
        if index >= 0:
            found.append((index, name, marker))
    found.sort()

    sections = {}
    for i, (start, name, marker) in enumerate(found):
        end = found[i + 1][0] if i + 1 < len(found) else len(markdown)
        section_markdown = markdown[start:end].strip()
        if not section_markdown:
            continue
        links, images = extract_markdown_links(section_markdown)
        sections[name] = {
            "url": f"{home_data.get('url', config.BASE_URL)}#{name}",
            "title": marker,
            "markdown": section_markdown,
            "metadata": {"sourceURL": home_data.get("url", config.BASE_URL), "section": name},
            "links": links,
            "images": images,
            "status": "ok",
        }
    return sections


class FirecrawlScraper:
    def __init__(self):
        if not config.FIRECRAWL_API_KEY:
            raise RuntimeError("FIRECRAWL_API_KEY is required. Set it in the environment or a local .env file.")
        self.app = FirecrawlApp(api_key=config.FIRECRAWL_API_KEY)
        # Which path produced the last schedule parse: "js" | "mimo" |
        # "baseline-stale". Surfaced into report.json so a silent degrade is
        # observable (the original bug hid behind a quiet empty-list fallback).
        self._last_schedule_status = "unknown"

    def discover_urls(self) -> list[str]:
        """Discover same-domain page URLs from sitemap, homepage HTML, /map, and known pages."""
        discovered = set()

        logger.info("Discovering URLs via sitemap...")
        try:
            sitemap = fetch_text(f"{config.BASE_URL}/sitemap.xml")
            for url in re.findall(r"<loc>([^<]+)</loc>", sitemap):
                if is_internal_page(url):
                    discovered.add(normalize_url(url))
        except Exception as e:
            logger.warning(f"Sitemap discovery failed: {e}")

        logger.info("Discovering URLs via homepage HTML...")
        try:
            html = fetch_text(config.BASE_URL)
            for url in extract_urls_from_html(html):
                if is_internal_page(url):
                    discovered.add(normalize_url(url))
        except Exception as e:
            logger.warning(f"Homepage link discovery failed: {e}")

        logger.info("Discovering URLs via Firecrawl /map...")
        try:
            result = self.app.map_url(
                config.BASE_URL,
                include_subdomains=False,
                limit=50
            )
            # result can be a MapResponse object or list
            urls = []
            if hasattr(result, "links"):
                urls = result.links or []
            elif isinstance(result, list):
                urls = result
            elif isinstance(result, dict):
                urls = result.get("links", result.get("urls", []))

            for url in urls:
                if not isinstance(url, str):
                    url = getattr(url, "url", None) or getattr(url, "link", None)
                if url and is_internal_page(url):
                    discovered.add(normalize_url(url))
        except Exception as e:
            logger.warning(f"/map failed: {e}")

        for url in config.KNOWN_PAGES:
            discovered.add(normalize_url(url))

        urls = sorted(discovered)
        logger.info(f"Discovered {len(urls)} page URLs")
        return urls

    def scrape_page(self, url: str) -> dict:
        """Scrape a single page and return structured data."""
        logger.info(f"Scraping: {url}")
        try:
            result = self.app.scrape_url(
                url,
                formats=["markdown"],
                only_main_content=True
            )

            # Extract data from ScrapeResponse
            data = {}
            if hasattr(result, "markdown"):
                data["markdown"] = result.markdown or ""
            elif isinstance(result, dict):
                data["markdown"] = result.get("markdown", "")

            # Metadata
            metadata = {}
            if hasattr(result, "metadata"):
                meta_obj = result.metadata
                if hasattr(meta_obj, "title"):
                    metadata["title"] = meta_obj.title
                    metadata["description"] = getattr(meta_obj, "description", "")
                    metadata["language"] = getattr(meta_obj, "language", "")
                    metadata["sourceURL"] = getattr(meta_obj, "sourceURL", url)
                elif isinstance(meta_obj, dict):
                    metadata = meta_obj
            elif isinstance(result, dict):
                metadata = result.get("metadata", {})

            data["url"] = url
            data["title"] = metadata.get("title", url_to_page_name(url))
            data["metadata"] = metadata
            data["links"], data["images"] = extract_markdown_links(data.get("markdown", ""))
            data["status"], data["status_reason"] = validate_page(data)

            return data

        except Exception as e:
            logger.error(f"Failed to scrape {url}: {e}")
            data = {"url": url, "title": url_to_page_name(url), "markdown": "", "metadata": {}, "links": [], "images": [], "error": str(e)}
            data["status"], data["status_reason"] = validate_page(data)
            return data

    def scrape_all(self, urls: list[str] = None) -> dict[str, dict]:
        """Scrape all pages. Returns {page_name: data}."""
        if urls is None:
            urls = self.discover_urls()

        # Merge with known pages to ensure we don't miss any
        all_urls = sorted({normalize_url(url) for url in urls} | {normalize_url(url) for url in config.KNOWN_PAGES})

        results = {}
        for url in all_urls:
            page_name = url_to_page_name(url)
            data = self.scrape_page(url)
            results[page_name] = data
            time.sleep(0.5)  # Gentle rate limiting

        return results

    def scrape_bundle_schedule(self) -> list[dict]:
        """Extract schedule data directly from the SPA's JS bundle.
        
        The website is a React SPA that embeds all schedule data in the
        compiled JS bundle. This is more reliable than trying to click
        dynamic tabs via Firecrawl actions.
        """
        import re as _re

        # Default to the degrade signal; upgraded to "js"/"mimo" only on success.
        # This covers EVERY early-return path below (fetch/marker/bracket failures)
        # so a degrade is never mis-reported as "unknown" in report.json.
        self._last_schedule_status = "baseline-stale"

        logger.info("Extracting schedule from JS bundle...")
        
        # Step 1: Get the JS bundle URL from the homepage HTML
        try:
            html = fetch_text(config.BASE_URL)
        except Exception as e:
            logger.warning(f"Failed to fetch homepage HTML: {e}")
            return []
        
        bundle_match = _re.search(r'src="(/assets/index-[^"]+\.js)"', html)
        if not bundle_match:
            logger.warning("Could not find JS bundle URL in homepage HTML")
            return []
        
        bundle_url = f"{config.BASE_URL}{bundle_match.group(1)}"
        logger.info(f"Fetching JS bundle: {bundle_url}")
        
        try:
            bundle_js = fetch_text(bundle_url)
        except Exception as e:
            logger.warning(f"Failed to fetch JS bundle: {e}")
            return []
        
        # Step 2: Find the schedule data array in the bundle
        schedule_marker = 'day:"01",weekday:'
        marker_pos = bundle_js.find(schedule_marker)
        if marker_pos < 0:
            logger.warning("Could not find schedule data in JS bundle")
            return []
        
        bracket_start = bundle_js.rfind('[', max(0, marker_pos - 100), marker_pos)
        if bracket_start < 0:
            logger.warning("Could not find schedule array start")
            return []
        
        # Find matching closing bracket
        depth = 0
        pos = bracket_start
        while pos < len(bundle_js):
            if bundle_js[pos] == '[':
                depth += 1
            elif bundle_js[pos] == ']':
                depth -= 1
                if depth == 0:
                    break
            pos += 1
        
        raw_schedule = bundle_js[bracket_start:pos+1]

        # Step 3: Parse the JS object-literal array DETERMINISTICALLY (json5).
        # The old positional regex here silently broke when the site inserted a
        # `mapUrl` field between `venue` and `venueImage` (matched 0 days → stale
        # data). A json5 parse is immune to field reorder/insertion. See
        # schedule_parser.py for the sanitize details + self-verification.
        days = parse_js_array(raw_schedule)
        verified = bool(days) and verify_against_raw(days, raw_schedule)
        if days and verified:
            self._last_schedule_status = "js"
            logger.info(f"Extracted schedule for {len(days)} days from JS bundle (json5)")
            for day in days:
                logger.info(f"  Day {day['day']} ({day['theme']}): {len(day['blocks'])} blocks")
            return days

        # JS-array parse failed or failed self-verify → try the MiMo markdown
        # fallback (LLM structured-extracts the homepage schedule when the JS
        # bundle drifts). If MiMo is unavailable/unusable it returns None and the
        # caller's existing markdown-regex path remains the floor.
        logger.error(
            "JS-bundle schedule parse FAILED (days=%s, verified=%s) — the bundle "
            "structure likely drifted. Falling back; schedule may be stale.",
            bool(days),
            verified,
        )
        mimo_days = parse_markdown_with_mimo(raw_schedule, hint="schedule JS literal")
        if mimo_days:
            self._last_schedule_status = "mimo"
            logger.info(f"Extracted schedule for {len(mimo_days)} days via MiMo fallback")
            return mimo_days

        # status already "baseline-stale" from method entry.
        return []

