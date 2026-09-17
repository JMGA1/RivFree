import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "scrapers"))

from scrapers.dfa_scraper import _merge_with_previous as merge_dfa
from scrapers.oprha_scraper import _slug_from_url
from scrapers.mantra_scraper import _merge_previous as merge_mantra
from scrapers.yurys_scraper import _merge_previous as merge_yury


class ResilienceTests(unittest.TestCase):
    def test_dfa_partial_keeps_old_items_but_prefers_fresh(self):
        previous = [
            {"url": "https://x/a", "nombre": "A", "precio_usd": 10},
            {"url": "https://x/b", "nombre": "B", "precio_usd": 20},
        ]
        fresh = [{"url": "https://x/a", "nombre": "A", "precio_usd": 11}]
        merged = {p["url"]: p for p in merge_dfa(fresh, previous)}
        self.assertEqual(merged["https://x/a"]["precio_usd"], 11)
        self.assertEqual(merged["https://x/b"]["precio_usd"], 20)
        self.assertTrue(merged["https://x/b"]["datos_anteriores"])

    def test_oprha_category_candidate_filters_external_and_product_pages(self):
        self.assertEqual(_slug_from_url("/cosmeticos"), "cosmeticos")
        self.assertIsNone(_slug_from_url("https://example.com/cosmeticos"))
        self.assertIsNone(_slug_from_url("/product-page/example"))
        self.assertIsNone(_slug_from_url("/contato"))

    def test_mantra_failed_detail_uses_previous_cache(self):
        previous = [{"url": "https://mantrafreeshop.com/a-p1", "precio_usd": 9}]
        merged = merge_mantra([], previous, ["https://mantrafreeshop.com/a-p1"], [])
        self.assertEqual(len(merged), 1)
        self.assertEqual(merged[0]["precio_usd"], 9)
        self.assertTrue(merged[0]["datos_anteriores"])

    def test_yury_failed_category_and_price_preserve_previous_observations(self):
        previous = [
            {"url": "https://yury/a", "categoria": "brinquedos", "precio_usd": 19},
            {"url": "https://yury/b", "categoria": "bebidas-1", "precio_usd": 8},
        ]
        fresh = [{"url": "https://yury/b", "categoria": "bebidas-1", "precio_usd": None}]
        recovery = {"failed": ["https://yury/b"], "not_attempted": []}
        merged = {p["url"]: p for p in merge_yury(fresh, previous, ["brinquedos"], recovery)}
        self.assertEqual(merged["https://yury/a"]["precio_usd"], 19)
        self.assertEqual(merged["https://yury/b"]["precio_usd"], 8)


if __name__ == "__main__":
    unittest.main()
