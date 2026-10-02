import base64
import importlib.util
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from tools import build_public_site, postgres_sync
from tools.manual_editor import maintenance as m
from tools.manual_editor import server as s

PRODUCTS = [
    {'tienda': 'DFA', 'url': 'https://dfa.test/sauvage', 'nombre': 'Dior Sauvage EDT 100ml', 'categoria': 'perfumes', 'precio_usd': 120.0,
     'precio_original_usd': None, 'en_oferta': False, 'imagen': 'https://dfa.test/sauvage.jpg'},
    {'tienda': 'Barão Free Shop', 'url': 'https://barao.test/sauvage', 'nombre': 'DIOR - Sauvage Eau de Parfum', 'categoria': 'perfumeria',
     'precio_usd': 126.0, 'en_oferta': False},
    {'tienda': 'DFA', 'url': 'https://dfa.test/whisky', 'nombre': 'Whisky Chivas Regal 18 años 750ml', 'categoria': 'bebidas', 'precio_usd': 80.0},
]


class Fixture(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); root = Path(self.temp.name)
        mapping = {'PROJECT_ROOT': root, 'DATA_DIR': root / 'data', 'ASSET_DIR': root / 'assets/manual',
                   'BACKUP_DIR': root / '.manual-backups', 'EDITOR_MODE': 'owner'}
        for key, name in [('PRODUCTS_PATH', 'manual-products.json'), ('STORES_PATH', 'manual-stores.json'),
                          ('BASE_STORES_PATH', 'stores.json'), ('SITE_CONFIG_PATH', 'site-config.json'),
                          ('HIGHLIGHTS_PATH', 'highlights.json'), ('HEALTH_PATH', 'health.json'), ('META_PATH', 'meta.json')]:
            mapping[key] = root / 'data' / name
        self.root = root
        self.patch = patch.multiple(s, **mapping); self.patch.start(); s.ensure_files()
        (root / 'data' / 'products.json').write_text(json.dumps({'productos': PRODUCTS}), encoding='utf-8')

    def tearDown(self):
        self.patch.stop(); self.temp.cleanup()

    def corrections(self):
        return json.loads((self.root / 'data' / 'product-corrections.json').read_text(encoding='utf-8'))['correcciones']


class CatalogSearchTests(Fixture):
    def test_only_what_was_searched_is_returned(self):
        empty = s.search_catalog({'q': ''})
        self.assertEqual(empty['items'], [], 'never the whole catalog')
        self.assertIn('DFA', empty['stores'])
        found = s.search_catalog({'q': 'sauvage dior'})
        self.assertEqual([i['tienda'] for i in found['items']], ['Barão Free Shop', 'DFA'])
        self.assertEqual(s.search_catalog({'q': 'SAUVAGÉ', 'store': 'DFA'})['items'][0]['key'], 'DFA|https://dfa.test/sauvage')
        self.assertEqual(s.search_catalog({'q': 'https://dfa.test/whisky'})['items'][0]['nombre'], 'Whisky Chivas Regal 18 años 750ml')
        self.assertEqual(s.search_catalog({'q': 'anos chivas'})['total'], 1, 'accents do not matter')
        limited = s.search_catalog({'q': 'dfa', 'limit': 1})
        self.assertEqual(len(limited['items']), 1); self.assertIn('Se muestran 1 de 2', limited['message'])

    def test_contributors_cannot_search_or_correct(self):
        with patch.object(s, 'EDITOR_MODE', 'contributor'):
            for call in (lambda: s.search_catalog({'q': 'dior'}), lambda: s.save_correction({'key': 'DFA|https://dfa.test/sauvage', 'correction': {}})):
                with self.assertRaisesRegex(ValueError, 'administrador'):
                    call()


class CorrectionTests(Fixture):
    key = 'DFA|https://dfa.test/sauvage'

    def test_only_differences_are_saved_and_the_price_remembers_the_store_price(self):
        result = s.save_correction({'key': self.key, 'correction': {
            'nombre': 'Dior Sauvage EDT 100ml', 'categoria': 'perfumes', 'precio_usd': '99,90', 'precio_original_usd': '', 'en_oferta': False}})
        saved = self.corrections()[self.key]
        self.assertNotIn('nombre', saved, 'same name as the store: nothing to correct')
        self.assertEqual((saved['precio_usd'], saved['precio_base'], saved['precio_fijo']), (99.9, 120.0, False))
        self.assertEqual(result['corrections_count'], 1)
        self.assertEqual(s.search_catalog({'q': 'sauvage', 'store': 'DFA'})['items'][0]['correction']['precio_usd'], 99.9)
        self.assertEqual(s.state_payload()['corrections_count'], 1)

    def test_offer_needs_a_higher_old_price_and_hidden_products_are_kept_as_corrections(self):
        with self.assertRaisesRegex(ValueError, 'precio anterior tiene que ser mayor'):
            s.save_correction({'key': self.key, 'correction': {'precio_usd': 100, 'precio_original_usd': 90, 'en_oferta': True}})
        s.save_correction({'key': self.key, 'correction': {'oculto': True, 'nombre': 'Dior Sauvage EDT 100 ml'}})
        self.assertEqual(self.corrections()[self.key], {**self.corrections()[self.key], 'oculto': True, 'nombre': 'Dior Sauvage EDT 100 ml'})
        only = s.search_catalog({'only_corrected': True})
        self.assertEqual([i['key'] for i in only['items']], [self.key])

    def test_saving_the_store_data_again_or_reverting_removes_the_correction(self):
        s.save_correction({'key': self.key, 'correction': {'nombre': 'Otro nombre'}})
        s.save_correction({'key': self.key, 'correction': {'nombre': 'Dior Sauvage EDT 100ml'}})
        self.assertEqual(self.corrections(), {})
        s.save_correction({'key': self.key, 'correction': {'categoria': 'cosmetica'}})
        reverted = s.delete_correction({'key': self.key})
        self.assertIsNone(reverted['item']['correction']); self.assertEqual(self.corrections(), {})
        with self.assertRaisesRegex(ValueError, 'no tiene correcciones'):
            s.delete_correction({'key': self.key})

    def test_products_no_longer_sold_cannot_be_edited_but_can_be_reverted(self):
        s.save_correction({'key': self.key, 'correction': {'nombre': 'Viejo'}})
        (self.root / 'data' / 'products.json').write_text(json.dumps({'productos': PRODUCTS[1:]}), encoding='utf-8')
        with self.assertRaisesRegex(ValueError, 'ya no está'):
            s.save_correction({'key': self.key, 'correction': {'nombre': 'Nuevo'}})
        missing = s.search_catalog({'only_corrected': True})['items'][0]
        self.assertTrue(missing['missing'])
        s.delete_correction({'key': self.key})

    def test_bad_values_are_rejected(self):
        for correction, message in (({'categoria': 'Perfumes!'}, 'Categoría'), ({'imagen': 'javascript:alert(1)'}, 'HTTPS'), ({'precio_usd': 'gratis'}, 'número')):
            with self.assertRaisesRegex(ValueError, message):
                s.save_correction({'key': self.key, 'correction': correction})

    def test_backups_include_corrections_and_restore_them(self):
        s.save_correction({'key': self.key, 'correction': {'nombre': 'Primera'}})
        s.save_correction({'key': self.key, 'correction': {'nombre': 'Segunda'}})
        copies = sorted(p for p in s.BACKUP_DIR.iterdir() if (p / 'product-corrections.json').exists())
        backup = copies[-1].name
        m.backups(s, {'action': 'restore', 'id': backup})
        self.assertEqual(self.corrections()[self.key]['nombre'], 'Primera')
        self.assertIn('data/product-corrections.json', m.PUBLISH_PATHS)


class ApplyCorrectionsTests(unittest.TestCase):
    def test_database_copy_uses_the_same_rules_as_the_site(self):
        fixes = {'correcciones': {
            'DFA|https://dfa.test/sauvage': {'nombre': 'Nuevo', 'precio_usd': 99.9, 'precio_base': 120.0},
            'Barão Free Shop|https://barao.test/sauvage': {'precio_usd': 50, 'precio_base': 100.0},
            'DFA|https://dfa.test/whisky': {'oculto': True}}}
        result = postgres_sync.apply_corrections([dict(p) for p in PRODUCTS], fixes)
        self.assertEqual([p['nombre'] for p in result], ['Nuevo', 'DIOR - Sauvage Eau de Parfum'])
        self.assertEqual(result[0]['precio_usd'], 99.9)
        self.assertEqual(result[1]['precio_usd'], 126.0, 'the store changed its price: the corrected one no longer applies')

    def test_published_site_includes_the_corrections_file(self):
        self.assertIn('product-corrections.json', build_public_site.DATA)
        self.assertTrue((Path(__file__).resolve().parents[1] / 'data' / 'product-corrections.json').exists())


class IphonePhotoTests(unittest.TestCase):
    @staticmethod
    def heic_bytes():
        import pillow_heif
        from PIL import Image
        pillow_heif.register_heif_opener()
        out = io.BytesIO(); Image.new('RGB', (1200, 1600), (30, 70, 140)).save(out, format='HEIF', quality=60)
        return out.getvalue()

    @unittest.skipUnless(importlib.util.find_spec('pillow_heif'), 'pillow-heif not installed')
    def test_heic_is_converted_to_webp(self):
        raw = self.heic_bytes()
        self.assertTrue(s.is_heif(raw))
        with tempfile.TemporaryDirectory() as folder, patch.multiple(s, PROJECT_ROOT=Path(folder), ASSET_DIR=Path(folder) / 'assets/manual', EDITOR_MODE='owner'):
            result = s.upload_image({'filename': 'IMG_0001.HEIC', 'data': base64.b64encode(raw).decode()})
            self.assertTrue(result['path'].endswith('.webp'))
            from PIL import Image
            with Image.open(Path(folder) / result['path']) as image:
                self.assertEqual((image.format, image.size), ('WEBP', (1200, 1600)))

    def test_heic_without_the_plugin_explains_what_to_do(self):
        fake = b'\x00\x00\x00\x18ftypheic' + b'\x00' * 40
        self.assertTrue(s.is_heif(fake)); self.assertFalse(s.is_heif(b'\x89PNG\r\n\x1a\n' + b'\x00' * 20))
        with patch.dict(sys.modules, {'pillow_heif': None}):
            with self.assertRaisesRegex(ValueError, 'Instalar-dependencias-Studio'):
                s.optimize_image(fake)

    def test_studio_accepts_iphone_photos_and_the_plugin_is_a_dependency(self):
        self.assertIn('.heic', s.UPLOAD_IMAGE_EXTENSIONS); self.assertNotIn('.heic', s.ALLOWED_IMAGE_EXTENSIONS, 'stored files are always WebP/JPG/PNG/GIF')
        folder = Path(s.__file__).parent
        self.assertIn('pillow-heif', (folder / 'requirements.in').read_text(encoding='utf-8'))
        self.assertIn('pillow-heif==', (folder / 'requirements.txt').read_text(encoding='utf-8'))
        html = (folder / 'index.html').read_text(encoding='utf-8')
        for needle in ('store-photos.js?v=', 'catalog-editor.js?v=', 'data-tab="catalog"', 'id="catalogSearch"', 'accept="image/*,.heic,.heif"'):
            self.assertIn(needle, html)
        self.assertIn('tools/manual_editor', m.UPDATE_PATHS)
        for path in ('tests/test_studio_v81.py', 'tests/v81-improvements.test.cjs', 'CAMBIOS-V8.md'):
            self.assertIn(path, m.UPDATE_PATHS)


if __name__ == '__main__':
    unittest.main()
