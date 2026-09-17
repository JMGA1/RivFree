import json
import tempfile
import unittest
from pathlib import Path
from scrapers.publish_data import publish

class PublishTests(unittest.TestCase):
    def test_failure_streak_recovery_and_no_fake_history(self):
        with tempfile.TemporaryDirectory() as tmp:
            directory=Path(tmp)
            def run(stamp,error,attempted={'DFA'}):
                output={'actualizado':stamp,'intento_actualizacion':stamp,'resumen':[{'tienda':'DFA','error':error,'datos_anteriores':bool(error)}],'productos':[{'tienda':'DFA','url':'https://example.com/p','nombre':'P','precio_usd':10}]}
                publish(directory,output,attempted)
            for i in range(3):run(f'2026-09-{10+i}', 'error')
            self.assertEqual(json.loads((directory/'health.json').read_text())['DFA']['fallos_consecutivos'],3)
            self.assertEqual(json.loads((directory/'price-history.json').read_text()),{})
            run('2026-09-13',None)
            self.assertEqual(json.loads((directory/'health.json').read_text())['DFA']['fallos_consecutivos'],0)
            run('2026-09-13',None) # repeated publication must not duplicate snapshot
            self.assertEqual(len(list((directory/'history').glob('*.json'))),1)
            self.assertIn('version',json.loads((directory/'meta.json').read_text()))

    def test_oprha_observed_price_is_preserved(self):
        with tempfile.TemporaryDirectory() as tmp:
            output={'productos':[{'tienda':'Oprha Free Shop','precio_usd':99}],'resumen':[]}
            publish(tmp,output)
            self.assertEqual(output['productos'][0]['precio_usd'], 99)
