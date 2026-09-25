import json
import tempfile
import unittest
from pathlib import Path

from scrapers.update_exchange import update_exchange


class FakeResponse:
    def __init__(self, payload):
        self.payload = payload
    def __enter__(self):
        return self
    def __exit__(self, *args):
        return False
    def read(self):
        return json.dumps(self.payload).encode('utf-8')


class ExchangeTests(unittest.TestCase):
    def test_success_replaces_previous_rate(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'exchange.json'
            path.write_text('{"usd_brl":5,"actualizado":"2026-01-01"}', encoding='utf-8')
            def opener(request, timeout=0):
                return FakeResponse({'date':'2026-09-25','base':'USD','quote':'BRL','rate':5.42})
            value, changed = update_exchange(path, opener)
            self.assertTrue(changed)
            self.assertEqual(value['usd_brl'], 5.42)
            self.assertEqual(json.loads(path.read_text(encoding='utf-8'))['fuente'], 'Frankfurter')

    def test_network_failure_preserves_previous_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'exchange.json'
            original = '{"usd_brl":5.1,"actualizado":"2026-09-20","fuente":"Frankfurter"}'
            path.write_text(original, encoding='utf-8')
            def opener(request, timeout=0):
                raise OSError('offline')
            value, changed = update_exchange(path, opener)
            self.assertFalse(changed)
            self.assertEqual(value['usd_brl'], 5.1)
            self.assertEqual(path.read_text(encoding='utf-8'), original)


if __name__ == '__main__':
    unittest.main()
