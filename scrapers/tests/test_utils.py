import unittest

from scrapers.utils import clean_price, parse_wix_product_text


class CleanPriceTests(unittest.TestCase):
    def test_common_price_formats(self):
        cases = {
            "USD 1.234,50": 1234.50,
            "USD 1,234.50": 1234.50,
            "USD 1234,50": 1234.50,
            "USD 1234.50": 1234.50,
            "US$ 80": 80.0,
            "U$S 99,90": 99.90,
            "U$25.00": 25.0,
        }
        for raw, expected in cases.items():
            with self.subTest(raw=raw):
                self.assertEqual(clean_price(raw), expected)

    def test_rejects_non_usd_and_invalid_values(self):
        self.assertIsNone(clean_price("$ 2.500"))
        self.assertIsNone(clean_price("sin precio"))
        self.assertIsNone(clean_price(None))

    def test_wix_regular_and_sale_prices(self):
        self.assertEqual(
            parse_wix_product_text("Perfume Example USD 120"),
            ("Perfume Example", 120.0, None),
        )
        self.assertEqual(
            parse_wix_product_text("Perfume Example USD 120 USD 89,90"),
            ("Perfume Example", 89.9, 120.0),
        )


if __name__ == "__main__":
    unittest.main()
