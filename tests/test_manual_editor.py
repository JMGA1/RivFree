import json
import tempfile
import unittest
from pathlib import Path

from tools.manual_editor import server


class ManualEditorValidationTests(unittest.TestCase):
    def test_normalize_product_keeps_instagram_source(self):
        product = server.normalize_product({
            'tienda': 'Loja Test', 'nombre': 'Perfume Test EDP 100ml',
            'precio_usd': '49.90', 'categoria': 'perfumes',
            'fuente_tipo': 'instagram', 'fuente_url': 'https://instagram.com/p/test',
            'activo': True,
        }, known_stores={'Loja Test'})
        self.assertTrue(product['id'].startswith('manual-'))
        self.assertEqual(product['precio_usd'], 49.90)
        self.assertEqual(product['fuente_tipo'], 'instagram')
        self.assertTrue(product['manual'])

    def test_unknown_store_is_rejected_for_direct_save(self):
        with self.assertRaises(ValueError):
            server.normalize_product({'tienda': 'No Existe', 'nombre': 'Item'}, known_stores={'DFA'})

    def test_store_url_validation_rejects_javascript(self):
        with self.assertRaises(ValueError):
            server.normalize_store({'nombre': 'Loja Test', 'sitio_web': 'javascript:alert(1)'})


class ManualEditorPersistenceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        root = Path(self.temp.name)
        self.old = {
            'PROJECT_ROOT': server.PROJECT_ROOT, 'DATA_DIR': server.DATA_DIR,
            'ASSET_DIR': server.ASSET_DIR, 'BACKUP_DIR': server.BACKUP_DIR,
            'PRODUCTS_PATH': server.PRODUCTS_PATH, 'STORES_PATH': server.STORES_PATH,
            'BASE_STORES_PATH': server.BASE_STORES_PATH,
        }
        server.PROJECT_ROOT = root
        server.DATA_DIR = root / 'data'; server.ASSET_DIR = root / 'assets' / 'manual'; server.BACKUP_DIR = root / '.manual-backups'
        server.PRODUCTS_PATH = server.DATA_DIR / 'manual-products.json'; server.STORES_PATH = server.DATA_DIR / 'manual-stores.json'; server.BASE_STORES_PATH = server.DATA_DIR / 'stores.json'
        server.DATA_DIR.mkdir(parents=True)
        server.BASE_STORES_PATH.write_text(json.dumps({'DFA': {'nombre_completo':'DFA'}}), encoding='utf-8')
        server.ensure_files()

    def tearDown(self):
        for key, value in self.old.items(): setattr(server, key, value)
        self.temp.cleanup()

    def test_store_and_product_survive_as_separate_manual_files(self):
        state = server.save_store({'store': {'nombre':'Loja Nova','color':'#123456'}})
        state = server.save_product({'revision': state['revision'], 'product': {
            'tienda':'Loja Nova','nombre':'Chocolate 100g','precio_usd':8.5,'categoria':'alimentos','fuente_tipo':'instagram','fuente_url':'https://instagram.com/p/x'
        }})
        stores=json.loads(server.STORES_PATH.read_text(encoding='utf-8'))
        products=json.loads(server.PRODUCTS_PATH.read_text(encoding='utf-8'))
        self.assertIn('Loja Nova', stores['tiendas'])
        self.assertEqual(products['productos'][0]['nombre'],'Chocolate 100g')
        self.assertEqual(state['products'][0]['fuente_tipo'],'instagram')

    def test_renaming_manual_store_updates_its_manual_products(self):
        state = server.save_store({'store': {'nombre':'Loja Antiga','color':'#123456'}})
        state = server.save_product({'revision': state['revision'], 'product': {'tienda':'Loja Antiga','nombre':'Item 1','precio_usd':1}})
        state = server.save_store({'revision': state['revision'], 'original_name':'Loja Antiga', 'store': {'nombre':'Loja Nova','color':'#654321'}})
        self.assertEqual(state['products'][0]['tienda'], 'Loja Nova')
        self.assertIn('Loja Nova', state['manual_stores'])
        self.assertNotIn('Loja Antiga', state['manual_stores'])


if __name__ == '__main__':
    unittest.main()
