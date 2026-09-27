import tempfile
import unittest
from pathlib import Path
from scrapers.catalog_metrics import price_drop
from scrapers.publish_data import publish, read_json

class MetricsTests(unittest.TestCase):
    def test_drop_requires_two_real_observations_and_current_price(self):
        points=[['2026-08-01',200],['2026-09-01',100],['2026-09-20',88]]
        self.assertEqual(price_drop(points,88,'2026-09-20')['porcentaje'],12)
        self.assertIsNone(price_drop(points,80,'2026-09-20'))
        self.assertIsNone(price_drop(points,88,'2026-09-27'))
        self.assertIsNone(price_drop([['2026-09-20',88]],88,'2026-09-20'))
        self.assertIsNone(price_drop([['2026-09-20T10:00:00',100],['2026-09-20T12:00:00',80]],80,'2026-09-20T12:00:00'))
        self.assertIsNone(price_drop([['2026-09-01',100],['2026-09-20',120]],120,'2026-09-20'))
    def test_publish_partitions_metrics_first_seen_and_stale_filter(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)
            def output(day,price,**state):return {'actualizado':day,'intento_actualizacion':day,'resumen':[{'tienda':'DFA',**state}], 'productos':[{'tienda':'DFA','nombre':'Perfume','url':'https://example.test/p','precio_usd':price}]}
            publish(root,output('2026-09-01T00:00:00Z',100),{'DFA'})
            publish(root,output('2026-09-20T00:00:00Z',88),{'DFA'})
            doc=read_json(root/'products.json',{});product=doc['productos'][0]
            self.assertEqual(product['primera_deteccion'],'2026-09-01T00:00:00Z')
            self.assertEqual(product['caida_precio']['porcentaje'],12)
            self.assertEqual(read_json(root/'products/dfa.json',[])[0],product)
            publish(root,doc)
            self.assertEqual(read_json(root/'products.json',{})['productos'][0],product)
            publish(root,output('2026-09-21T00:00:00Z',88,parcial=True),{'DFA'})
            self.assertNotIn('caida_precio',read_json(root/'products.json',{})['productos'][0])
            publish(root,output('2026-10-01T00:00:00Z',80),{'DFA'})
            self.assertEqual(read_json(root/'products.json',{})['productos'][0]['primera_deteccion'],'2026-09-01T00:00:00Z')
