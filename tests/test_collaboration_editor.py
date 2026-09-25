import base64
import json
import tempfile
import unittest
import zipfile
from io import BytesIO
from pathlib import Path

from tools.manual_editor import server


class CollaborationEditorTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        root = Path(self.temp.name)
        keys = [
            'PROJECT_ROOT','DATA_DIR','ASSET_DIR','BACKUP_DIR','PRODUCTS_PATH','STORES_PATH','BASE_STORES_PATH',
            'CONTRIB_DIR','CONTRIB_ASSET_DIR','CONTRIB_BACKUP_DIR','CONTRIB_PRODUCTS_PATH','CONTRIB_STORES_PATH',
            'EDITOR_MODE','CONTRIBUTION_PREVIEWS'
        ]
        self.old = {key: getattr(server, key) for key in keys}
        server.PROJECT_ROOT = root
        server.DATA_DIR = root / 'data'
        server.ASSET_DIR = root / 'assets' / 'manual'
        server.BACKUP_DIR = root / '.manual-backups'
        server.PRODUCTS_PATH = server.DATA_DIR / 'manual-products.json'
        server.STORES_PATH = server.DATA_DIR / 'manual-stores.json'
        server.BASE_STORES_PATH = server.DATA_DIR / 'stores.json'
        server.CONTRIB_DIR = root / '.contributor-work'
        server.CONTRIB_ASSET_DIR = server.CONTRIB_DIR / 'assets'
        server.CONTRIB_BACKUP_DIR = server.CONTRIB_DIR / 'backups'
        server.CONTRIB_PRODUCTS_PATH = server.CONTRIB_DIR / 'products.json'
        server.CONTRIB_STORES_PATH = server.CONTRIB_DIR / 'stores.json'
        server.CONTRIBUTION_PREVIEWS = {}
        server.EDITOR_MODE = 'owner'
        server.DATA_DIR.mkdir(parents=True)
        server.BASE_STORES_PATH.write_text(json.dumps({'DFA': {'nombre_completo':'DFA'}}), encoding='utf-8')
        (server.DATA_DIR / 'products.json').write_text(json.dumps({'productos': []}), encoding='utf-8')
        server.ensure_files()

    def tearDown(self):
        for key, value in self.old.items():
            setattr(server, key, value)
        self.temp.cleanup()

    def _build_contribution(self):
        server.EDITOR_MODE = 'contributor'
        server.ensure_files()
        state = server.save_store({'store': {'nombre':'Loja Colab','color':'#112233'}})
        image = base64.b64encode(b'fake-image-content').decode('ascii')
        uploaded = server.upload_image({'filename':'producto.png','data':image})
        state = server.save_product({'revision':state['revision'],'product':{
            'tienda':'Loja Colab','nombre':'Producto Instagram','precio_usd':19.9,
            'categoria':'otros','fuente_tipo':'instagram','fuente_url':'https://instagram.com/p/demo',
            'imagen':uploaded['path']
        }})
        return server.export_contribution_zip('Pedro', 'Aporte de prueba')

    def test_contributor_writes_are_isolated_from_owner_catalog(self):
        owner_products_before = server.PRODUCTS_PATH.read_bytes()
        owner_stores_before = server.STORES_PATH.read_bytes()
        self._build_contribution()
        self.assertEqual(server.PRODUCTS_PATH.read_bytes(), owner_products_before)
        self.assertEqual(server.STORES_PATH.read_bytes(), owner_stores_before)
        self.assertTrue(server.CONTRIB_PRODUCTS_PATH.exists())
        self.assertEqual(len(json.loads(server.CONTRIB_PRODUCTS_PATH.read_text())['productos']), 1)

    def test_contribution_zip_contains_manifest_and_local_image(self):
        raw = self._build_contribution()
        with zipfile.ZipFile(BytesIO(raw)) as archive:
            names = set(archive.namelist())
            self.assertIn('rivfree-contribution.json', names)
            manifest = json.loads(archive.read('rivfree-contribution.json'))
            self.assertEqual(manifest['format'], 'rivfree-contribution-v1')
            self.assertEqual(manifest['contributor']['name'], 'Pedro')
            self.assertEqual(len(manifest['products']), 1)
            image_path = manifest['products'][0]['imagen']
            self.assertTrue(image_path.startswith('assets/'))
            self.assertIn(image_path, names)

    def test_owner_can_preview_and_selectively_import_contribution(self):
        raw = self._build_contribution()
        server.EDITOR_MODE = 'owner'
        server.ensure_files()
        state = server.state_payload()
        preview = server.preview_contribution({'data': base64.b64encode(raw).decode('ascii')})
        self.assertEqual(preview['contributor']['name'], 'Pedro')
        self.assertEqual(preview['products'][0]['status'], 'new')
        result = server.apply_contribution({
            'revision': state['revision'],
            'preview_id': preview['preview_id'],
            'stores': [preview['stores'][0]['name']],
            'products': [preview['products'][0]['id']],
        })
        self.assertEqual(result['import_summary']['products'], 1)
        self.assertIn('Loja Colab', result['manual_stores'])
        imported = result['products'][0]
        self.assertEqual(imported['aportado_por'], 'Pedro')
        self.assertTrue(imported['imagen'].startswith('assets/manual/'))
        self.assertTrue((server.PROJECT_ROOT / imported['imagen']).exists())


if __name__ == '__main__':
    unittest.main()
