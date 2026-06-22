"""
Tests for the deterministic JS-bundle schedule parser (schedule_parser.py).

Regression guard for the bug that broke the live Schedule: the site inserted a
`mapUrl` field into the JS literal and the old positional regex matched 0 days.
The fixture `fixtures/raw_schedule_with_mapurl.txt` is the real live array WITH
that `mapUrl` field (and `workshops:[{name,...}]`, `src:` bare refs, backtick
descriptions), so these tests fail loudly if the parser ever regresses on the
exact drift that bit us.
"""
import os
import unittest

os.environ.setdefault("FIRECRAWL_API_KEY", "test-key")

from schedule_parser import parse_js_array, verify_against_raw  # noqa: E402

FIXTURE = os.path.join(os.path.dirname(__file__), "fixtures", "raw_schedule_with_mapurl.txt")


def load_raw() -> str:
    with open(FIXTURE, encoding="utf-8") as f:
        return f.read()


class TestScheduleParser(unittest.TestCase):
    def setUp(self):
        self.raw = load_raw()
        self.days = parse_js_array(self.raw)

    def test_parses_all_five_days(self):
        self.assertIsNotNone(self.days)
        self.assertEqual(len(self.days), 5)

    def test_day_is_zero_padded_string(self):
        # Downstream contract: `day` must stay the string "01".."05", not an int.
        for d in self.days:
            self.assertIsInstance(d["day"], str)
        self.assertEqual({d["day"] for d in self.days}, {"01", "02", "03", "04", "05"})

    def test_day2_real_titles_present(self):
        # The bug rendered partner names ("AWS"/"Agora") as titles. Assert the
        # REAL session titles parse through.
        d2 = next(d for d in self.days if d["day"] == "02")
        labels = [b.get("label") for b in d2["blocks"]]
        self.assertIn("From Spec to Production Code — Kiro, Claude Code & Codex on AWS", labels)
        self.assertIn("Physical AI Party: Agora ConvoAI World", labels)
        self.assertIn("Welcome Builders Night", labels)

    def test_workshops_mapped_to_partners(self):
        # The literal uses `workshops:[{name,...}]`; downstream wants
        # `workshop_partners: string[]`.
        d2 = next(d for d in self.days if d["day"] == "02")
        self.assertTrue(all(isinstance(p, str) for p in d2["workshop_partners"]))
        self.assertIn("AWS", d2["workshop_partners"])

    def test_mapurl_field_does_not_break_parse(self):
        # The field that broke the old regex. Its presence must be harmless, and
        # it should flow through (downstream ignores unknown keys via .get()).
        self.assertIn('mapUrl:"', self.raw)
        d1 = next(d for d in self.days if d["day"] == "01")
        self.assertTrue(d1["venue"])
        self.assertTrue(d1["venueImage"])

    def test_extra_block_fields_retained(self):
        # speaker/linkedin/description are kept (future RAG/enrichment), not dropped.
        any_extra = any(
            any(k in b for k in ("speaker", "linkedin", "description"))
            for d in self.days
            for b in d["blocks"]
        )
        self.assertTrue(any_extra)

    def test_verify_against_raw_passes_on_clean_parse(self):
        self.assertTrue(verify_against_raw(self.days, self.raw))

    def test_verify_against_raw_rejects_hallucinated_value(self):
        # Simulate a parser/LLM inventing a luma URL that isn't in the source.
        tampered = [dict(d, blocks=[dict(b) for b in d["blocks"]]) for d in self.days]
        tampered[0]["blocks"][0]["luma"] = "https://luma.com/HALLUCINATED-not-in-source"
        self.assertFalse(verify_against_raw(tampered, self.raw))


if __name__ == "__main__":
    unittest.main()
