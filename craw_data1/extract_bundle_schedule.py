"""Extract schedule data from the React SPA JS bundle."""
import re, json

with open("/Users/thinhpld0/.gemini/antigravity-ide/brain/de1f2444-fd5b-4cb6-9f5e-21862e71550e/.system_generated/steps/202/content.md", "r") as f:
    content = f.read()

# Find all Luma event URLs
luma_urls = set(re.findall(r'https://luma\.com/gaf-[a-z0-9]+', content))
print("=== ALL LUMA URLS ===")
for url in sorted(luma_urls):
    print(f"  {url}")

# Extract session-like patterns: time + partner + title
# Look for patterns like: "10:00","12:00","Apify","Build, Deploy..."
# Or structured data objects

# Search for schedule data structure
# Look around "Apify" to understand the data structure
idx = content.find("Apify")
if idx > 0:
    # Get a window around the match
    start = max(0, idx - 500)
    end = min(len(content), idx + 500)
    snippet = content[start:end]
    print("\n=== CONTEXT AROUND 'Apify' ===")
    print(repr(snippet))

# Look for "Builder Night"
idx2 = content.find("Builder Night")
if idx2 > 0:
    start = max(0, idx2 - 300)
    end = min(len(content), idx2 + 300)
    snippet2 = content[start:end]
    print("\n=== CONTEXT AROUND 'Builder Night' ===")
    print(repr(snippet2))

# Look for "Tencent Cloud"
idx3 = content.find("Tencent Cloud")
if idx3 > 0:
    start = max(0, idx3 - 300)
    end = min(len(content), idx3 + 300)
    snippet3 = content[start:end]
    print("\n=== CONTEXT AROUND 'Tencent Cloud' ===")
    print(repr(snippet3))

# Look for Day 02 schedule data
for pattern in ["AWS", "Langfuse", "Google Developer Expert", "Beyond Autocomplete"]:
    idx = content.find(pattern)
    if idx > 0:
        start = max(0, idx - 200)
        end = min(len(content), idx + 200)
        print(f"\n=== CONTEXT AROUND '{pattern}' ===")
        print(repr(content[start:end]))
