import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(BASE_DIR, ".env"))
except ImportError:
    pass

# --- Firecrawl API ---
FIRECRAWL_API_KEY = os.environ.get("FIRECRAWL_API_KEY")

# --- URLs ---
BASE_URL = "https://agenticaibuildweek.genaifund.ai"

# Pages to scrape individually (fallback if discovery doesn't return enough).
# Workshops/attending are homepage anchors, not standalone routes.
KNOWN_PAGES = [
    f"{BASE_URL}/",
    f"{BASE_URL}/builder-experience-track",
    f"{BASE_URL}/partners",
    f"{BASE_URL}/leaderboard",
]

# External event pages that are important but not currently linked from the
# landing page daily schedule. Date on the Luma page is the source of truth for
# day mapping.
KNOWN_EXTERNAL_EVENTS = [
    {
        "url": "https://luma.com/gaf-u7gd",
        "source": "manual_known_event",
        "note": "Agentic AI Build Week Networking Night; not currently linked from homepage schedule.",
    },
]

# Luma organization page to auto-discover events from
LUMA_ORG_PAGE = "https://luma.com/gaf?k=c"

# --- Paths ---
DATA_DIR = os.path.join(BASE_DIR, "data")
LATEST_DIR = os.path.join(DATA_DIR, "latest")
HISTORY_DIR = os.path.join(DATA_DIR, "history")
LOGS_DIR = os.path.join(BASE_DIR, "logs")

# Ensure directories exist
os.makedirs(LATEST_DIR, exist_ok=True)
os.makedirs(HISTORY_DIR, exist_ok=True)
os.makedirs(LOGS_DIR, exist_ok=True)

# --- Scheduler Config ---
SCRAPE_INTERVAL_MINUTES = 15
EXTERNAL_EVENT_RECHECK_HOURS = int(os.environ.get("EXTERNAL_EVENT_RECHECK_HOURS", "6"))
