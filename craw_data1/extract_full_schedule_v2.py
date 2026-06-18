"""Extract and clean schedule data from the React SPA JS bundle - v2."""
import re, json

with open("/Users/thinhpld0/.gemini/antigravity-ide/brain/de1f2444-fd5b-4cb6-9f5e-21862e71550e/.system_generated/steps/202/content.md", "r") as f:
    content = f.read()

# Find the schedule array boundaries
schedule_start = content.find('day:"01",weekday:')
bracket_start = content.rfind('[', max(0, schedule_start - 100), schedule_start)

depth = 0
pos = bracket_start
while pos < len(content):
    if content[pos] == '[':
        depth += 1
    elif content[pos] == ']':
        depth -= 1
        if depth == 0:
            break
    pos += 1

raw = content[bracket_start:pos+1]

# Better JS→JSON conversion: use a proper tokenizer approach
# First, convert the raw JS to valid JSON by handling edge cases

# Step 1: Replace variable references (identifiers not in quotes) with null
# We do this on the raw JS, before changing quotes
# Strategy: manually parse and fix

# Actually, let's use a simpler approach: extract via regex the structured data we need
days = []

# Find each day block
for day_match in re.finditer(r'\{day:"(\d+)",weekday:"([^"]+)",dateLabel:"([^"]+)",theme:"([^"]+)",venue:"([^"]+)"', raw):
    day_num = day_match.group(1)
    weekday = day_match.group(2)
    date_label = day_match.group(3)
    theme = day_match.group(4)
    venue = day_match.group(5)
    
    # Find blocks for this day
    day_start = day_match.start()
    # Find the blocks array
    blocks_start = raw.find('blocks:[', day_start)
    if blocks_start < 0:
        continue
    
    # Find matching ]
    depth = 0
    pos = blocks_start + 7  # skip "blocks:["
    depth = 1
    while pos < len(raw) and depth > 0:
        if raw[pos] == '[':
            depth += 1
        elif raw[pos] == ']':
            depth -= 1
        pos += 1
    
    blocks_raw = raw[blocks_start+7:pos]
    
    # Parse individual blocks
    blocks = []
    for block_match in re.finditer(
        r'\{time:"([^"]*)"(?:,end:"([^"]*)")?(?:,host:"([^"]*)")?(?:,label:"([^"]*)")?(?:,tone:"([^"]*)")?(?:,luma:"([^"]*)")?(?:,lumaId:"([^"]*)")?',
        blocks_raw
    ):
        block = {
            "time": block_match.group(1),
            "end": block_match.group(2) or None,
            "host": block_match.group(3) or None,
            "label": block_match.group(4) or None,
            "tone": block_match.group(5) or None,
            "luma": block_match.group(6) or None,
            "lumaId": block_match.group(7) or None,
        }
        blocks.append(block)
    
    # Find workshop partners for this day
    workshops = []
    ws_start = raw.find('workshops:[', day_start)
    if ws_start >= 0 and ws_start < blocks_start:
        for ws_match in re.finditer(r'name:"([^"]+)"', raw[ws_start:blocks_start]):
            workshops.append(ws_match.group(1))
    
    # Find signature items
    sig_items = []
    sig_start = raw.find('signatureItems:[', day_start)
    if sig_start >= 0 and sig_start < blocks_start:
        for sig_match in re.finditer(r'"([^"]+)"', raw[sig_start:blocks_start]):
            val = sig_match.group(1)
            if val not in ["signatureItems"]:
                sig_items.append(val)
    
    day_data = {
        "day": day_num,
        "weekday": weekday,
        "dateLabel": date_label,
        "theme": theme,
        "venue": venue,
        "workshop_partners": workshops,
        "signature_items": sig_items,
        "blocks": blocks,
    }
    days.append(day_data)

print(f"Extracted {len(days)} days:\n")
for day in days:
    print(f"Day {day['day']} - {day['theme']} ({day['weekday']} {day['dateLabel']}) @ {day['venue']}")
    print(f"  Partners: {', '.join(day['workshop_partners']) if day['workshop_partners'] else 'none'}")
    for block in day['blocks']:
        time_str = f"{block['time']}-{block['end']}" if block.get('end') else block['time']
        host = block.get('host') or ''
        label = block.get('label') or ''
        luma = block.get('luma') or ''
        print(f"  {time_str:12s} | {host:30s} | {label:60s} | {luma}")
    print()

# Save
with open("data/latest/bundle_schedule.json", "w") as f:
    json.dump(days, f, ensure_ascii=False, indent=2)
print("Saved to data/latest/bundle_schedule.json")
