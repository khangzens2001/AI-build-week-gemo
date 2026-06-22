"""
Tests for the MiMo markdown-fallback parser (mimo_parser.py).

The live network call is mocked; these lock the contract that matters: the
hallucinated-luma gate, shape normalization (day stays a string, block keys
filled), and graceful None when no key / no usable response.
"""
import os
import unittest

os.environ.setdefault("MIMO_API_KEY", "test-key")

import mimo_parser as mp  # noqa: E402


class TestMimoParser(unittest.TestCase):
    def setUp(self):
        self._orig = mp._mimo_json

    def tearDown(self):
        mp._mimo_json = self._orig

    def test_rejects_hallucinated_luma(self):
        mp._mimo_json = lambda s, u, **_: {
            "days": [{"day": "02", "blocks": [{"time": "09:00", "label": "X", "luma": "https://luma.com/FAKE"}]}]
        }
        self.assertIsNone(mp.parse_markdown_with_mimo("schedule text without that url"))

    def test_clean_parse_normalizes_shape(self):
        src = "AWS workshop https://luma.com/gaf-real at 09:00"
        mp._mimo_json = lambda s, u, **_: {
            "days": [
                {
                    "day": "2",
                    "theme": "Integrate",
                    "blocks": [{"time": "09:00", "label": "AWS", "luma": "https://luma.com/gaf-real"}],
                    "workshop_partners": ["AWS"],
                }
            ]
        }
        r = mp.parse_markdown_with_mimo(src)
        self.assertEqual(len(r), 1)
        self.assertIsInstance(r[0]["day"], str)
        self.assertEqual(r[0]["workshop_partners"], ["AWS"])
        for key in ("time", "end", "host", "label", "tone", "luma", "lumaId"):
            self.assertIn(key, r[0]["blocks"][0])

    def test_none_when_no_key(self):
        saved = os.environ.pop("MIMO_API_KEY", None)
        try:
            self.assertIsNone(mp.parse_markdown_with_mimo("x"))
        finally:
            if saved is not None:
                os.environ["MIMO_API_KEY"] = saved

    def test_none_on_empty_response(self):
        mp._mimo_json = lambda s, u, **_: {"days": []}
        self.assertIsNone(mp.parse_markdown_with_mimo("text"))

    def test_none_on_failed_call(self):
        mp._mimo_json = lambda s, u, **_: None
        self.assertIsNone(mp.parse_markdown_with_mimo("text"))


if __name__ == "__main__":
    unittest.main()
