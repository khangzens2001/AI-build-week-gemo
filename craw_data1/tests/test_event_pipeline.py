import os
import unittest

os.environ.setdefault("FIRECRAWL_API_KEY", "test-key")

from event_pipeline import (  # noqa: E402
    event_quality_level,
    parse_daily_schedule_events,
    parse_google_maps,
    parse_luma_event,
    parse_programme_days,
)


PROGRAMME = """
The Programme

## 5 Days. Enable -> Integrate -> Design -> Build -> Demo.

Wed · July 8

### Day 01:Enable

Workshops

![BytePlus logo](https://example.com/byteplus.svg)
![NVIDIA logo](https://example.com/nvidia.png)

Venue: Tasco Office

Thu · July 9

### Day 02:Integrate

Workshops

![AWS logo](https://example.com/aws.png)

Venue: AWS Office, Bitexco Tower

Fri · July 10

### Day 03:Design

Workshops

Venue: VNG Campus

Sat · July 11

### Day 04:Build

- Keynotes
- Networking

Venue: Galaxy Innovation Park

Sun · July 12

### Day 05:Demo

- Demo Day

Venue: Galaxy Innovation Park
"""


SCHEDULE = """
Daily Schedule

Day 01 · EnableWed · July 8

Tasco Office

1. 09:00Registration & Welcome
2. ![](https://example.com/byteplus.png)

10:00–12:00·BytePlus

Render the Next Era of Creation with BytePlus AI Stack

[RSVP](https://luma.com/gaf-vbkf)

3. 12:00Lunch
4. ![](https://example.com/nvidia.png)

14:00–14:45·NVIDIA

Inside NVIDIA Inception Program: How Startups Build & Scale AI Globally

[RSVP](https://luma.com/gaf-t4bs)
"""


LUMA = """
# Render the Next Era of Creation with BytePlus AI Stack — Agentic AI Build Week Workshop

About Event

The AI stack you ship on is about to change.

**What you'll take away**

- A working view of the BytePlus AI stack
- Practical patterns

**Your speakers**

- **Vu Tien Hung** — Senior Manager, Enterprise Sector, BytePlus
- **Lam Thao** — Solution Architect, BytePlus

**Event details**

- 📅 Tuesday, July 8, 2026
- 🕐 10:00 AM – 12:00 PM (Indochina Time, GMT+7)
- 📍 TBC, HCMC
- ✅ Private event · approval required · limited seats

**Before you apply:** You must be registered for Agentic AI Build Week. Seats are prioritised for Builder or Founding Builder ticket holders. Sign up on Devpost.

Location

[](https://www.google.com/maps/search/?api=1&query=10.824298548535092%2C106.62998121126604)
"""


class EventPipelineTests(unittest.TestCase):
    def test_parse_programme_days_boundaries(self):
        days = parse_programme_days(PROGRAMME)
        self.assertEqual(len(days), 5)
        self.assertEqual(days[0]["display_date"], "Wed · July 8")
        self.assertEqual(days[1]["venue"], "AWS Office, Bitexco Tower")
        self.assertFalse("Day 02" in days[0]["summary_markdown"])
        self.assertIn("BytePlus", days[0]["partners"])

    def test_parse_daily_schedule_events(self):
        events = parse_daily_schedule_events(SCHEDULE)
        ids = [event["id"] for event in events]
        self.assertIn("day01-byteplus", ids)
        self.assertIn("day01-nvidia", ids)
        byteplus = next(event for event in events if event["id"] == "day01-byteplus")
        self.assertEqual(byteplus["start_time"], "10:00")
        self.assertEqual(byteplus["registration_url"], "https://luma.com/gaf-vbkf")

    def test_parse_luma_event(self):
        parsed = parse_luma_event({"url": "https://luma.com/gaf-vbkf", "title": "BytePlus", "markdown": LUMA})
        self.assertEqual(parsed["status"], "ok")
        self.assertIn("Vu Tien Hung — Senior Manager", parsed["speakers"][0])
        self.assertIn("Must be registered", parsed["requirements"][0])
        self.assertEqual(parsed["latitude"], 10.824298548535092)

    def test_event_quality_level(self):
        event = {
            "type": "workshop",
            "registration_url": "https://luma.com/x",
            "description": "desc",
            "speakers": ["speaker"],
            "requirements": ["required"],
            "location": {"google_maps_url": "https://maps.example"},
        }
        self.assertEqual(event_quality_level(event), "full")
        event["location"] = {}
        self.assertEqual(event_quality_level(event), "partial")

    def test_parse_google_maps(self):
        url, lat, lng = parse_google_maps("[](https://www.google.com/maps/search/?api=1&query=10.1%2C106.2)")
        self.assertIsNotNone(url)
        self.assertEqual(lat, 10.1)
        self.assertEqual(lng, 106.2)


if __name__ == "__main__":
    unittest.main()
