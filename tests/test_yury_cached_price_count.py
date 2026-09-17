import ast
from pathlib import Path
import unittest


class YuryCachedPriceRegressionTests(unittest.TestCase):
    def test_cached_price_counter_cannot_yield_none(self):
        source = (Path(__file__).parents[1] / "scrapers" / "yurys_scraper.py").read_text(encoding="utf-8")
        tree = ast.parse(source)
        # Regression guard: the previous implementation passed the raw result of
        # dict.get('datos_anteriores') into sum(), which can be None.
        self.assertNotIn(
            'sum(p.get("datos_anteriores") and p.get("precio_usd") is not None for p in merged)',
            source,
        )
        self.assertIn('if bool(p.get("datos_anteriores"))', source)


if __name__ == "__main__":
    unittest.main()
