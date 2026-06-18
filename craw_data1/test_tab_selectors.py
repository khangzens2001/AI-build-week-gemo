"""Test different Firecrawl selectors for Day tabs."""
from firecrawl import FirecrawlApp
import os, json
from dotenv import load_dotenv
load_dotenv()

app = FirecrawlApp(api_key=os.getenv("FIRECRAWL_API_KEY"))
url = "https://agenticaibuildweek.genaifund.ai/"

# Strategy 1: scroll first, then click with Playwright text= selector
selectors_to_try = [
    [
        {"type": "wait", "milliseconds": 3000},
        {"type": "scroll", "direction": "down", "amount": 3000},
        {"type": "wait", "milliseconds": 1000},
        {"type": "click", "selector": "text=Day 03"},
        {"type": "wait", "milliseconds": 2000},
    ],
    [
        {"type": "wait", "milliseconds": 3000},
        {"type": "click", "selector": "button:has-text('Day 03')"},
        {"type": "wait", "milliseconds": 2000},
    ],
    [
        {"type": "wait", "milliseconds": 3000},
        {"type": "click", "selector": "[class*='tab']:nth-child(3)"},
        {"type": "wait", "milliseconds": 2000},
    ],
]

for i, actions in enumerate(selectors_to_try):
    print(f"\n--- Strategy {i+1} ---")
    try:
        result = app.scrape_url(
            url,
            formats=["markdown"],
            only_main_content=True,
            actions=actions,
        )
        md = result.markdown or "" if hasattr(result, "markdown") else ""
        # Check if Day 03 schedule content appears
        if "Apify" in md or "Google Developer" in md or "Builder Night" in md:
            print(f"SUCCESS! Got Day 03 content ({len(md)} chars)")
            # Save for inspection
            with open(f"test_day03_strategy{i+1}.md", "w") as f:
                f.write(md)
            break
        else:
            print(f"Got content ({len(md)} chars) but no Day 03 schedule data")
            with open(f"test_day03_strategy{i+1}.md", "w") as f:
                f.write(md[:2000])
    except Exception as e:
        print(f"FAILED: {e}")
