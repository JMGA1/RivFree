import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scrapers"))

import barao_scraper as barao


class BaraoPriceTests(unittest.TestCase):
    def test_visible_listing_price_fills_missing_wix_price(self):
        row = {
            "url": "https://www.baraofreeshop.com.br/product-page/milka-alpine",
            "name": "MILKA - Barra de chocolate Alpine 300g",
            "text": "MILKA - Barra de chocolate Alpine 300g\nPreço\nUS$ 4,62",
            "image": "https://example.com/milka.jpg",
        }
        product = barao._product_from_visible_row(row, "chocolates", {"precio_usd": None})
        self.assertEqual(product["precio_usd"], 4.62)

    def test_visible_price_overrides_incomplete_serialized_value(self):
        row = {
            "url": "https://www.baraofreeshop.com.br/product-page/milka-oreo",
            "name": "MILKA - Bombon de Oreo 247gr 13 Unidades",
            "text": "MILKA - Bombon de Oreo 247gr 13 Unidades Preço US$ 4,60",
            "image": None,
        }
        product = barao._product_from_visible_row(row, "chocolates", {
            "url": row["url"], "nombre": row["name"], "precio_usd": None,
            "imagen": "https://example.com/old.jpg",
        })
        self.assertEqual(product["precio_usd"], 4.60)
        self.assertEqual(product["imagen"], "https://example.com/old.jpg")

    def test_discount_keeps_current_and_original(self):
        current, original = barao._prices_from_text("Preço normal US$ 13,35 Preço promocional US$ 9,90")
        self.assertEqual(current, 9.90)
        self.assertEqual(original, 13.35)

    def test_out_of_stock_is_not_fake_price(self):
        row = {
            "url": "https://www.baraofreeshop.com.br/product-page/out",
            "name": "Produto esgotado",
            "text": "Produto esgotado\nESGOTADO",
            "image": None,
        }
        product = barao._product_from_visible_row(row, "chocolates")
        self.assertIsNone(product["precio_usd"])

    def test_institutional_paths_are_not_categories(self):
        self.assertFalse(barao._valid_category_slug("responsabilidadesocial"))
        self.assertFalse(barao._valid_category_slug("blank-2"))
        self.assertFalse(barao._valid_category_slug("seguranca-e-saude-no-trabalho"))
        self.assertTrue(barao._valid_category_slug("copia-de-condimentos"))


if __name__ == "__main__":
    unittest.main()
