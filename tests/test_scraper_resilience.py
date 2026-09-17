import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRAPERS = ROOT / "scrapers"
sys.path.insert(0, str(SCRAPERS))

from bs4 import BeautifulSoup

import dfa_scraper
import mantra_scraper
import neutral_scraper
import oprha_scraper
from publish_data import publish
from utils import dedupe_products_prefer_complete, extract_wix_products


class CoverageRegressionTests(unittest.TestCase):
    def test_dedupe_prefers_later_priced_duplicate(self):
        rows = [
            {"url": "https://x/p/1", "nombre": "Producto", "precio_usd": None},
            {"url": "https://x/p/1", "nombre": "Producto", "precio_usd": 12.5},
        ]
        result = dedupe_products_prefer_complete(rows)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["precio_usd"], 12.5)

    def test_wix_price_can_live_outside_product_item_root(self):
        html = """
        <div class="visual-card">
          <div data-hook="product-item-root">
            <a href="/product-page/jbl-flip"><span data-hook="product-item-name">JBL Flip 6</span></a>
          </div>
          <div class="price-zone">Preço US$ 202,00</div>
        </div>
        """
        soup = BeautifulSoup(html, "html.parser")
        rows = extract_wix_products(soup, "Yury's Free Shop", "eletronicos", "https://www.yurysfreeshop.com")
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["precio_usd"], 202.0)

    def test_mantra_listing_is_primary_source_for_price(self):
        html = """
        <div class="grid-product">
          <a href="/Televisor-Test-p123"><img alt="Televisor Test" src="https://img.example/tv.jpg"></a>
          <span class="grid-product__price">U$125.00</span>
        </div>
        """
        rows = mantra_scraper._extract_listing_products_from_html(html, "televisores")
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["nombre"], "Televisor Test")
        self.assertEqual(rows[0]["precio_usd"], 125.0)
        self.assertEqual(rows[0]["precio_fuente"], "listado")

    def test_neutral_total_and_pages_are_read_from_listing(self):
        soup = BeautifulSoup(
            '<div>Página 1 de 105</div><div>Total de articulos (1253)</div>',
            'html.parser',
        )
        self.assertEqual(neutral_scraper._total_pages(soup), 105)
        self.assertEqual(neutral_scraper._total_items(soup), 1253)

    def test_oprha_probes_current_com_before_legacy_com_br(self):
        self.assertEqual(oprha_scraper.BASE_CANDIDATES[0], "https://www.oprhafreeshop.com")
        self.assertIn("https://www.oprhafreeshop.com.br", oprha_scraper.BASE_CANDIDATES)

    def test_dfa_has_category_fallback_when_shop_is_unavailable(self):
        self.assertIn("perfumeria", dfa_scraper.TOP_CATEGORIES)
        self.assertIn("electronica", dfa_scraper.TOP_CATEGORIES)
        self.assertGreaterEqual(len(dfa_scraper.TOP_CATEGORIES), 8)

    def test_partial_store_history_keeps_only_fresh_observations(self):
        with tempfile.TemporaryDirectory() as temp:
            data_dir = Path(temp)
            output = {
                "actualizado": "2026-09-17T12:00:00+00:00",
                "intento_actualizacion": "2026-09-17T12:00:00+00:00",
                "resumen": [
                    {
                        "tienda": "Demo",
                        "productos": 2,
                        "error": "Demo parcial: una página falló",
                        "parcial": True,
                        "datos_anteriores": True,
                    }
                ],
                "productos": [
                    {
                        "tienda": "Demo", "url": "https://demo/fresh", "nombre": "Fresco",
                        "precio_usd": 10.0,
                    },
                    {
                        "tienda": "Demo", "url": "https://demo/cache", "nombre": "Cache",
                        "precio_usd": 9.0, "datos_anteriores": True,
                    },
                ],
            }
            publish(data_dir, output, {"Demo"})
            history_files = list((data_dir / "history").glob("*.json"))
            self.assertEqual(len(history_files), 1)
            observations = json.loads(history_files[0].read_text(encoding="utf-8"))["observaciones"]
            self.assertEqual(observations, [["Demo", "https://demo/fresh", "Fresco", 10.0]])


if __name__ == "__main__":
    unittest.main()
