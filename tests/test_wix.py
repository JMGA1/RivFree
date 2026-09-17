import unittest
from bs4 import BeautifulSoup
from unittest.mock import patch
from scrapers.utils import extract_wix_products, extract_wix_detail_price
from scrapers.oprha_scraper import scrape_product_page

class WixTests(unittest.TestCase):
    def test_numeric_attribute_and_visible_discount(self):
        soup=BeautifulSoup('''<div data-hook="product-item-root"><a href="/product-page/a"></a><span data-hook="product-item-name">Example</span><span data-hook="product-item-price-to-pay" data-wix-price="29.90"></span><span data-hook="product-item-price-before-discount">US$ 40,00</span></div>''','html.parser')
        product=extract_wix_products(soup,"Yury's Free Shop",'eletronicos','https://example.com')[0]
        self.assertEqual(product['precio_usd'],29.9)
        self.assertEqual(product['precio_original_usd'],40)
    def test_detail_price_excludes_recommendations(self):
        soup=BeautifulSoup('''<span data-hook="formatted-primary-price">US$ 999,00</span><div data-hook="product-prices-wrapper"><span data-hook="formatted-primary-price">US$ 269,00</span></div>''','html.parser')
        self.assertEqual(extract_wix_detail_price(soup),(269,None))
    def test_oprha_metadata_is_not_a_public_price(self):
        soup=BeautifulSoup('<meta property="product:price:amount" content="999"><meta property="og:title" content="Example | Oprha">','html.parser')
        with patch('scrapers.oprha_scraper.get_soup',return_value=soup):
            self.assertIsNone(scrape_product_page('https://example.com/p','cosmeticos')['precio_usd'])
