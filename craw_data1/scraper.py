import logging
import re
import time
from html import unescape
from urllib.parse import urljoin, urlparse, urlunparse
from urllib.request import Request, urlopen

from firecrawl import FirecrawlApp
import config

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
        
        # Step 3: Parse each day using regex (safer than JS→JSON conversion)
        days = []
        day_pattern = _re.compile(
            r'\{day:"(\d+)",weekday:"([^"]+)",dateLabel:"([^"]+)",'
            r'theme:"([^"]+)",venue:"([^"]+)",venueImage:"([^"]*)"'
        )
        
        day_positions = [(m.start(), m) for m in day_pattern.finditer(raw_schedule)]
        
        for i, (day_start, day_match) in enumerate(day_positions):
            # Determine the end boundary for this day's data
            day_end = day_positions[i+1][0] if i+1 < len(day_positions) else len(raw_schedule)
            day_chunk = raw_schedule[day_start:day_end]
            
            # Extract blocks for this day only
            blocks_start = day_chunk.find('blocks:[')
            if blocks_start < 0:
                continue
            
            # Find the closing ] for blocks array
            bd = 0
            bp = blocks_start + 7
            while bp < len(day_chunk) and not (day_chunk[bp] == ']' and bd == 0):
                if day_chunk[bp] == '[':
                    bd += 1
                elif day_chunk[bp] == ']':
                    if bd == 0:
                        break
                    bd -= 1
                bp += 1
            
            blocks_chunk = day_chunk[blocks_start + 8:bp]
            
            blocks = []
            for block_m in _re.finditer(
                r'\{time:"([^"]*)"'
                r'(?:,end:"([^"]*)")?'
                r'(?:,host:"([^"]*)")?'
                r'(?:,label:"([^"]*)")?'
                r'(?:,tone:"([^"]*)")?'
                r'(?:,luma:"([^"]*)")?'
                r'(?:,lumaId:"([^"]*)")?',
                blocks_chunk
            ):
                blocks.append({
                    "time": block_m.group(1),
                    "end": block_m.group(2) or None,
                    "host": block_m.group(3) or None,
                    "label": block_m.group(4) or None,
                    "tone": block_m.group(5) or None,
                    "luma": block_m.group(6) or None,
                    "lumaId": block_m.group(7) or None,
                })
            
            # Extract workshop partner names
            partners = []
            ws_chunk = day_chunk[:blocks_start]
            for ws_m in _re.finditer(r'name:"([^"]+)"', ws_chunk):
                partners.append(ws_m.group(1))
            
            days.append({
                "day": day_match.group(1),
                "weekday": day_match.group(2),
                "dateLabel": day_match.group(3),
                "theme": day_match.group(4),
                "venue": day_match.group(5),
                "venueImage": day_match.group(6),
                "workshop_partners": partners,
                "blocks": blocks,
            })
        
        logger.info(f"Extracted schedule for {len(days)} days from JS bundle")
        for day in days:
            logger.info(f"  Day {day['day']} ({day['theme']}): {len(day['blocks'])} blocks")
        
        return days
