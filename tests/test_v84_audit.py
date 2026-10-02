import json, threading, unittest, http.client
from pathlib import Path
from unittest.mock import patch
from bs4 import BeautifulSoup
from test_studio_v81 import Fixture, PRODUCTS
from tools.manual_editor import server as s
from scrapers import mantra_scraper as mantra, sineriz_scraper as sineriz, barao_scraper as barao, neutral_scraper as neutral
from scrapers.utils import explicit_empty_catalog


class CorrectionConcurrencyTests(Fixture):
    def test_stale_form_missing_revision_and_changed_scraper_price_are_rejected(self):
        key='DFA|https://dfa.test/sauvage'
        form=s.search_catalog({'q':'https://dfa.test/sauvage'})['items'][0]
        payload={'key':key,'correction':{'nombre':'A'},'correction_revision':form['correction_revision']}
        saved=s.save_correction(payload)
        with self.assertRaises(RuntimeError):s.save_correction({**payload,'correction':{'nombre':'B'}})
        with self.assertRaises(RuntimeError):s.delete_correction({'key':key})
        rows=[dict(p) for p in PRODUCTS];rows[0]['precio_usd']=130
        (self.root/'data/products.json').write_text(json.dumps({'productos':rows}),encoding='utf-8')
        with self.assertRaises(RuntimeError):s.save_correction({**payload,'correction_revision':saved['item']['correction_revision']})
        self.assertEqual(self.corrections()[key]['nombre'],'A')

    def test_another_product_does_not_invalidate_this_form(self):
        first=s.search_catalog({'q':'https://dfa.test/sauvage'})['items'][0]
        other=s.search_catalog({'q':'https://dfa.test/whisky'})['items'][0]
        for item in [first,other]:
            s.save_correction({'key':item['key'],'correction_revision':item['correction_revision'],'correction':{'nombre':'Corregido'}})
        self.assertEqual(len(self.corrections()),2)

    def test_public_corrections_and_http_conflict(self):
        (self.root/'data/product-corrections.json').write_text('{"correcciones":{}}',encoding='utf-8')
        server=s.ThreadingHTTPServer(('127.0.0.1',0),s.Handler)
        thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
        try:
            conn=http.client.HTTPConnection('127.0.0.1',server.server_port,timeout=3)
            conn.request('GET','/data/product-corrections.json');r=conn.getresponse();self.assertEqual(r.status,200);r.read()
            payload={'key':'DFA|https://dfa.test/sauvage','correction':{'nombre':'stale'}}
            conn.request('POST','/api/manual/save-correction',json.dumps(payload),{'Content-Type':'application/json','X-RivFree-Editor-Token':s.SESSION_TOKEN})
            r=conn.getresponse();self.assertEqual(r.status,409);r.read();conn.close()
        finally:server.shutdown();server.server_close();thread.join()


class StoreParserTests(unittest.TestCase):
    def test_barao_brand_story_is_not_a_product_category(self):
        self.assertFalse(barao._valid_category_slug('docedeleitebarao'))
        self.assertTrue(barao._valid_category_slug('copia-de-doce-de-leite-1'))

    def test_neutral_overlapping_pages_remain_partial_and_are_explained(self):
        pages=[BeautifulSoup('<p>Página 1 de 2 Total de artículos (4)</p><a href="/products/1">A USD 10</a><a href="/products/2">B USD 20</a>','html.parser'),BeautifulSoup('<a href="/products/2">B USD 20</a><a href="/products/3">C USD 30</a>','html.parser')]
        with patch.object(neutral,'get_soup',side_effect=pages),patch.object(neutral.time,'sleep'):
            rows,stats=neutral._scrape_category_with_stats(4,'cosmetica')
        self.assertEqual(len(rows),3);self.assertTrue(stats['parcial'])
        self.assertEqual(stats['repeticiones_entre_paginas'],1)
        self.assertEqual(stats['paginas_con_solapamiento'],[{'pagina':2,'repetidos':1}])

    def test_ecwid_empty_legacy_heading_does_not_hide_real_title_or_zero_price(self):
        soup=BeautifulSoup('<div class="ecwid-productBrowser-head"></div><h1 class="product-details__product-title">Stanley 532ml</h1><div class="product-details__product-price"><span class="details-product-price__value">U$0.00</span></div>','html.parser')
        row=mantra._extract_detail_soup(soup,'https://example.com/p','bazar')
        self.assertEqual(row['nombre'],'Stanley 532ml');self.assertIsNone(row['precio_usd'])
        soup.select_one('.details-product-price__value').string='U$ 49.90'
        self.assertEqual(mantra._extract_detail_soup(soup,'https://example.com/p','bazar')['precio_usd'],49.9)

    def test_only_explicit_store_empty_components_count_as_empty(self):
        for html in ['<h2 data-hook="empty-gallery-title">Não temos nenhum produto para mostrar no momento.</h2>','<p class="c-placeholder__title">Nenhum produto foi encontrado.</p>']:
            self.assertTrue(explicit_empty_catalog(BeautifulSoup(html,'html.parser')))
        for html in ['<h1>Erro</h1>','<p>Não temos nenhum produto</p>','<div hidden><h2 data-hook="empty-gallery-title">Não temos nenhum produto</h2></div>']:
            self.assertFalse(explicit_empty_catalog(BeautifulSoup(html,'html.parser')))

    def test_sineriz_empty_category_is_not_a_network_or_parser_failure(self):
        with patch.object(sineriz,'get_soup',return_value=BeautifulSoup('<p class="c-placeholder__title">Nenhum produto foi encontrado.</p>','html.parser')):
            self.assertEqual(sineriz._scrape_category_with_status('garmin'),([],None))
        with patch.object(sineriz,'get_soup',return_value=BeautifulSoup('<h1>Site</h1>','html.parser')):
            self.assertIsNotNone(sineriz._scrape_category_with_status('garmin')[1])
