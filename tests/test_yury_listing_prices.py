import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRAPERS = ROOT / "scrapers"
sys.path.insert(0, str(SCRAPERS))

import yurys_scraper as yury


class YuryListingPriceTests(unittest.TestCase):
    def test_visible_listing_text_recovers_regular_prices(self):
        products = [
            {"nombre": "MILKA OREO 300 GR", "precio_usd": None},
            {"nombre": "MILKA ALPINE 250 GR", "precio_usd": None},
        ]
        text = (
            "Visualização rápida MILKA OREO 300 GR PreçoUS$ 5,90 "
            "Visualização rápida MILKA ALPINE 250 GR PreçoUS$ 5,90 "
            "Visualização rápida"
        )
        count = yury._fill_prices_from_listing_text(products, text)
        self.assertEqual(count, 2)
        self.assertEqual(products[0]["precio_usd"], 5.90)
        self.assertEqual(products[1]["precio_usd"], 5.90)
        self.assertEqual(products[0]["precio_fuente"], "listado_visible")

    def test_visible_listing_text_handles_sale_price(self):
        products = [{"nombre": "AQUECEDOR TURBO XION", "precio_usd": None}]
        text = (
            "Visualização rápida AQUECEDOR TURBO XION "
            "Preço normalUS$ 29,90 Preço promocionalUS$ 17,99 "
            "Visualização rápida"
        )
        yury._fill_prices_from_listing_text(products, text)
        self.assertEqual(products[0]["precio_usd"], 17.99)
        self.assertEqual(products[0]["precio_original_usd"], 29.90)
        self.assertTrue(products[0]["en_oferta"])

    def test_missing_price_does_not_steal_next_product_price(self):
        products = [
            {"nombre": "PRODUTO SEM PRECO", "precio_usd": None},
            {"nombre": "PRODUTO COM PRECO", "precio_usd": None},
        ]
        text = (
            "Visualização rápida PRODUTO SEM PRECO "
            "Visualização rápida PRODUTO COM PRECO PreçoUS$ 12,50 "
            "Visualização rápida"
        )
        yury._fill_prices_from_listing_text(products, text)
        self.assertIsNone(products[0]["precio_usd"])
        self.assertEqual(products[1]["precio_usd"], 12.50)

    def test_visible_listing_text_overrides_wrong_dom_fallback(self):
        products = [{"nombre": "MILKA OREO 300 GR", "precio_usd": 99.0}]
        text = "Visualização rápida MILKA OREO 300 GR PreçoUS$ 5,90 Visualização rápida"
        yury._fill_prices_from_listing_text(products, text)
        self.assertEqual(products[0]["precio_usd"], 5.90)


if __name__ == "__main__":
    unittest.main()
