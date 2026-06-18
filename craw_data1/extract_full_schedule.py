"""Extract the complete schedule data array from the JS bundle."""
import re, json

with open("/Users/thinhpld0/.gemini/antigravity-ide/brain/de1f2444-fd5b-4cb6-9f5e-21862e71550e/.system_generated/steps/202/content.md", "r") as f:
    content = f.read()

# The schedule data is structured as an array of day objects:
# {day:"01",weekday:"Wed",dateLabel:"July 8",theme:"Enable",venue:"Tasco Office",...,blocks:[...]}
# Find the array that starts with day:"01"

# Look for the start of the schedule array
# Pattern: [{day:"01",weekday:...
schedule_start = content.find('day:"01",weekday:')
if schedule_start < 0:
    schedule_start = content.find("day:'01',weekday:")
    
if schedule_start > 0:
    # Go back to find the opening bracket
    bracket_start = content.rfind('[', max(0, schedule_start - 100), schedule_start)
    
    # Now find the matching closing bracket
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
    
    raw_schedule = content[bracket_start:pos+1]
    print(f"Found schedule data: {len(raw_schedule)} chars")
    
    # Convert JS object notation to JSON
    # Add quotes around unquoted keys
    json_str = re.sub(r'(\w+):', r'"\1":', raw_schedule)
    # Fix single quotes to double quotes
    json_str = json_str.replace("'", '"')
    # Remove trailing commas before ]
    json_str = re.sub(r',\s*]', ']', json_str)
    json_str = re.sub(r',\s*}', '}', json_str)
    # Fix variable references (like Sy, xy, etc.) → null
    json_str = re.sub(r':\s*([A-Za-z_]\w*(?:\.\w+)*)\s*([,}\]])', r': null\2', json_str)
    # Fix !0 → true, !1 → false
    json_str = json_str.replace(':!0', ':true').replace(':!1', ':false')
    
    try:
        schedule = json.loads(json_str)
        print(f"\nParsed {len(schedule)} days:")
        for day in schedule:
            print(f"\n  Day {day.get('day')} - {day.get('theme')} ({day.get('weekday')} {day.get('dateLabel')})")
            print(f"  Venue: {day.get('venue')}")
            for block in day.get('blocks', []):
                host = block.get('host', '')
                label = block.get('label', '')
                time = block.get('time', '')
                end = block.get('end', '')
                luma = block.get('luma', '')
                time_str = f"{time}-{end}" if end else time
                title = label or host
                print(f"    {time_str:12s} | {host or '':30s} | {title:60s} | {luma}")
        
        # Save full parsed data
        with open("data/latest/bundle_schedule.json", "w") as f:
            json.dump(schedule, f, ensure_ascii=False, indent=2)
        print(f"\nSaved to data/latest/bundle_schedule.json")
    except json.JSONDecodeError as e:
        print(f"JSON parse error: {e}")
        # Save raw for debugging
        with open("test_raw_schedule.txt", "w") as f:
            f.write(json_str[:5000])
        print("Saved raw to test_raw_schedule.txt")
else:
    print("Could not find schedule data in bundle")
