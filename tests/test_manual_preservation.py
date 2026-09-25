import json
import tempfile
import unittest
from pathlib import Path

from scrapers.publish_data import publish


class ManualCatalogPreservationTests(unittest.TestCase):
    def test_publish_does_not_overwrite_manual_catalog_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            data_dir = Path(tmp)
            manual_products = {'version':'manual-v1','actualizado':'2026-09-24T00:00:00+00:00','productos':[{'id':'manual-x','tienda':'Loja','nombre':'Item'}]}
            manual_stores = {'version':'stores-v1','actualizado':'2026-09-24T00:00:00+00:00','tiendas':{'Loja':{'nombre_completo':'Loja'}}}
            (data_dir/'manual-products.json').write_text(json.dumps(manual_products), encoding='utf-8')
            (data_dir/'manual-stores.json').write_text(json.dumps(manual_stores), encoding='utf-8')
            before_products=(data_dir/'manual-products.json').read_bytes()
            before_stores=(data_dir/'manual-stores.json').read_bytes()
            publish(data_dir, {'actualizado':'2026-09-24T01:00:00+00:00','intento_actualizacion':'2026-09-24T01:00:00+00:00','resumen':[],'productos':[]}, set())
            self.assertEqual((data_dir/'manual-products.json').read_bytes(), before_products)
            self.assertEqual((data_dir/'manual-stores.json').read_bytes(), before_stores)


if __name__ == '__main__':
    unittest.main()
