import asyncio
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch, MagicMock
from bs4 import BeautifulSoup
from scrapers import dfa_scraper as dfa, neutral_scraper as neutral, sineriz_scraper as sineriz
from scrapers import mantra_scraper as mantra, yurys_scraper as yurys, run_all
from scrapers.utils import finalize_scrape, extract_wix_detail_price, collect_wix_category


def html(source):
    return BeautifulSoup(source, 'html.parser')


class RegressionTests(unittest.TestCase):
    def test_dfa_uses_actual_page_size_and_english_total(self):
        soup = html('<p>Showing 1–12 of 1,200 results</p><ul class="products">' + '<li class="product"></li>'*12 + '</ul>')
        self.assertEqual(dfa._total_pages(soup), (100, 1200))

    def test_partial_preserves_cache_without_overwriting_fresh(self):
        with tempfile.TemporaryDirectory() as tmp:
            old = [{'tienda':'DFA','url':f'https://x/{i}','nombre':str(i),'precio_usd':10} for i in range(10)]
            Path(tmp, 'products.json').write_text(json.dumps({'productos':old}))
            status = {}
            result = finalize_scrape([dict(old[0], precio_usd=12)], 'dfa', tmp, status)
            self.assertEqual(len(result), 10)
            self.assertEqual(result[0]['precio_usd'],12)
            self.assertTrue(status['partial'])
            self.assertTrue(result[-1]['datos_anteriores'])
            self.assertFalse(Path(tmp, 'dfa.json.tmp').exists())

    def test_complete_crawl_can_remove_discontinued_product(self):
        with tempfile.TemporaryDirectory() as tmp:
            old = [{'url':str(i),'nombre':str(i)} for i in range(10)]
            Path(tmp,'dfa.json').write_text(json.dumps(old))
            result = finalize_scrape(old[:9], 'dfa', tmp, {})
            self.assertEqual(len(result),9)

    def test_no_results_does_not_overwrite_cache(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp,'dfa.json'); path.write_text('[{"url":"old"}]')
            with self.assertRaises(RuntimeError):
                finalize_scrape([], 'dfa', tmp, {})
            self.assertEqual(json.loads(path.read_text()),[{'url':'old'}])

    def test_neutral_continues_after_failed_middle_page(self):
        first=html('<p>Página 1 de 3</p><a href="/products/1">USD 10 A</a>')
        last=html('<a href="/products/3">USD 30 C</a>')
        neutral.LAST_RUN_STATUS.clear()
        with patch.object(neutral,'get_soup',side_effect=[first,None,last]), patch.object(neutral.time,'sleep'):
            result=neutral.scrape_category(1,'bazar')
        self.assertEqual([p['precio_usd'] for p in result],[10,30])
        self.assertTrue(neutral.LAST_RUN_STATUS['partial'])

    def test_neutral_price_less_product_and_discount(self):
        result=neutral._extract_products(html('<a href="/products/1"><h3>A</h3></a><a href="/products/2"><h3>B</h3>USD 20 USD 15</a>'),'bazar')
        self.assertEqual(result[0]['nombre'],'A')
        self.assertIsNone(result[0]['precio_usd'])
        self.assertEqual(result[1]['precio_usd'],15)
        self.assertEqual(result[1]['precio_original_usd'],20)

    def test_sineriz_never_takes_neighbour_price(self):
        soup=html('<section><div><a href="/produtos/bazar/a/">Product A</a></div><div><a href="/produtos/bazar/b/">Product B</a><span>USD 99</span></div></section>')
        with patch.object(sineriz,'get_soup',return_value=soup):
            result=sineriz.scrape_category('bazar')
        self.assertIsNone(result[0]['precio_usd'])
        self.assertEqual(result[1]['precio_usd'],99)

    def test_mantra_scopes_price_to_main_detail(self):
        soup=html('<h1>Mantra</h1><div>U$1.00</div><h1 class="product-details__product-title">TV</h1><div class="product-details__product-price"><span class="details-product-price__value">U$199.00</span></div>')
        product=mantra._extract_detail_soup(soup,'https://mantrafreeshop.com/TV-p1','TV')
        self.assertEqual(product['nombre'],'TV')
        self.assertEqual(product['precio_usd'],199)

    def test_mantra_rejects_generic_homepage(self):
        self.assertIsNone(mantra._extract_detail_soup(html('<h1>Mantra</h1><p>U$10</p>'),'x','x'))

    def test_wix_unlabelled_visible_price(self):
        self.assertEqual(extract_wix_detail_price(html('<div data-hook="product-prices-wrapper">US$ 20 US$ 15</div>')),(15,20))

    def test_wix_keeps_all_paginated_cards(self):
        page=MagicMock()
        button=page.locator.return_value.first
        button.count.side_effect=[1,0]
        button.is_visible.return_value=True
        button.is_enabled.return_value=True
        button.get_attribute.return_value=None
        def card(n):
            return f'<div data-hook="product-item-root"><a href="/product-page/{n}"></a><span data-hook="product-item-name">{n}</span></div>'
        page.content.side_effect=[card(1),card(2)]
        with patch('scrapers.utils.expand_wix_catalog',return_value=1):
            result=collect_wix_category(page,'Store','cat','https://x')
        self.assertEqual(len(result),2)
        button.click.assert_called_once()

    def test_interrupt_falls_back_to_combined_catalog(self):
        with tempfile.TemporaryDirectory() as tmp:
            Path(tmp,'products.json').write_text(json.dumps({'productos':[{'tienda':'DFA','url':'x'}]}))
            with patch.object(run_all,'DATA_DIR',Path(tmp)):
                products, _=run_all.load_store_caches(interrupted=True)
            self.assertEqual(len(products),1)

    def test_run_all_partial_is_not_written_as_new_history(self):
        with tempfile.TemporaryDirectory() as tmp:
            module=MagicMock()
            module.run.return_value=[{'tienda':'DFA','url':'x','nombre':'A','precio_usd':10}]
            module.LAST_RUN_STATUS={'partial':True,'warning':'page failed'}
            with patch.object(run_all,'DATA_DIR',Path(tmp)), patch.object(run_all,'SCRAPERS',[('DFA','dfa_scraper')]), patch.dict('sys.modules',{'dfa_scraper':module}):
                run_all.main('dfa')
            output=json.loads(Path(tmp,'products.json').read_text())
            self.assertTrue(output['resumen'][0]['parcial'])
            self.assertFalse(Path(tmp,'history').exists())


if __name__ == '__main__':
    unittest.main()
