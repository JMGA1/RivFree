import copy
import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from bs4 import BeautifulSoup
from scrapers.utils import normalize_wix_image_url, extract_image_url, extract_wix_products
from tools.repair_yury_images import repair

ASSET = '2d75da_bc4a33a773d14d0ebd56dcf129f2d102~mv2.png'
BASE = 'https://static.wixstatic.com/media/' + ASSET
BLUR = BASE + '/v1/fill/w_49,h_49,al_c,q_85,blur_2,enc_avif,quality_auto/' + ASSET
SHARP = BASE + '/v1/fit/w_600,h_600,q_85/' + ASSET


class YuryImageTests(unittest.TestCase):
    def test_placeholder_becomes_bounded_sharp_image(self):
        self.assertEqual(normalize_wix_image_url(BLUR), SHARP)
        self.assertEqual(normalize_wix_image_url(BASE), SHARP)
        self.assertEqual(normalize_wix_image_url(SHARP), SHARP)

    def test_other_hosts_and_non_raster_are_unchanged(self):
        for url in [None, '', 'data:image/png;base64,abc', 'https://example.com/img.png',
                    'https://static.wixstatic.com.evil.example/media/a.png',
                    'https://static.wixstatic.com/media/a.svg', 'https://static.wixstatic.com/media/a.gif']:
            self.assertEqual(normalize_wix_image_url(url), url)

    def test_lazy_and_srcset_urls_keep_embedded_commas(self):
        for attrs in [f'src="{BLUR}"', f'src="data:image/png;base64,abc" data-src="{BLUR}"',
                      f'srcset="{BLUR} 1x, {SHARP} 2x"']:
            soup = BeautifulSoup(f'<div><img {attrs}></div>', 'html.parser')
            self.assertEqual(extract_image_url(soup), SHARP)

    def test_extractor_preserves_non_wix_image(self):
        soup = BeautifulSoup('<img src="https://example.com/a.jpg">', 'html.parser')
        self.assertEqual(extract_image_url(soup), 'https://example.com/a.jpg')

    def test_listing_extracts_sharp_image_before_lazy_loading(self):
        soup = BeautifulSoup(f'''<div data-hook="product-item-root">
          <a href="/product-page/perfume"><img src="{BLUR}" alt="Perfume Example"></a>
          <span data-hook="product-item-price-to-pay" data-wix-price="45"></span>
          </div>''', 'html.parser')
        product = extract_wix_products(soup, "Yury's Free Shop", 'perfumaria-1', 'https://www.yurysfreeshop.com')[0]
        self.assertEqual(product['imagen'], SHARP)
        self.assertEqual(product['precio_usd'], 45)

    def test_repair_updates_cache_version_only_images_and_is_repeatable(self):
        yury = {'tienda': "Yury's Free Shop", 'imagen': BLUR, 'precio_usd': 45}
        other = {'tienda': 'Other', 'imagen': BLUR, 'precio_usd': 8}
        original = {'actualizado': '2026-09-19', 'productos': [yury, other]}
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for file, data in [('products.json', original), ('yurys.json', [yury]),
                               ('meta.json', {'actualizado': '2026-09-19', 'version': 'old'})]:
                (root / file).write_text(json.dumps(data), encoding='utf-8')
            self.assertEqual(repair(root), {'products.json': 1, 'yurys.json': 1})
            expected = copy.deepcopy(original)
            expected['productos'][0]['imagen'] = SHARP
            self.assertEqual(json.loads((root / 'products.json').read_text()), expected)
            meta = json.loads((root / 'meta.json').read_text())
            self.assertEqual(meta['actualizado'], original['actualizado'])
            self.assertEqual(meta['version'], hashlib.sha256((root / 'products.json').read_bytes()).hexdigest()[:20])
            self.assertEqual(repair(root), {'products.json': 0, 'yurys.json': 0})
