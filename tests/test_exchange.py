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

    def test_currencies_update_independently_and_preserve_failed_rate(self):
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/'exchange.json'
            path.write_text(json.dumps({'rates':{'UYU':{'rate':40,'date':'2026-09-01','source':'Frankfurter'}}}))
            def opener(request,timeout=0):
                quote=request.full_url.rsplit('/',1)[1]
                if quote=='UYU':raise OSError('offline')
                return FakeResponse({'date':'2026-09-27','base':'USD','quote':quote,'rate':5.2 if quote=='BRL' else 1400})
            value,changed=update_exchange(path,opener)
            self.assertTrue(changed);self.assertEqual(value['rates']['UYU']['date'],'2026-09-01')
            self.assertEqual(value['rates']['ARS']['rate'],1400);self.assertEqual(value['usd_brl'],5.2)
    def test_one_call_for_the_three_rates_and_no_going_back_in_time(self):
        from scrapers.update_exchange import RATES_URL
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'exchange.json'
            path.write_text(json.dumps({'usd_brl': 5.18, 'actualizado': '2026-10-01',
                                        'rates': {'BRL': {'rate': 5.18, 'date': '2026-10-01', 'source': 'Frankfurter'}}}), encoding='utf-8')
            urls = []
            def opener(request, timeout=0):
                urls.append(request.full_url)
                return FakeResponse([{'date': '2026-07-25', 'base': 'USD', 'quote': 'BRL', 'rate': 5.077},
                                     {'date': '2026-10-02', 'base': 'USD', 'quote': 'UYU', 'rate': 40.387},
                                     {'date': '2026-10-02', 'base': 'USD', 'quote': 'ARS', 'rate': 1526.29}])
            value, changed = update_exchange(path, opener)
            self.assertEqual(urls, [RATES_URL], 'a single request')
            self.assertTrue(changed)
            self.assertEqual((value['rates']['BRL']['rate'], value['usd_brl']), (5.18, 5.18), 'an older answer never replaces a newer rate')
            self.assertEqual(value['rates']['UYU'], {**value['rates']['UYU'], 'rate': 40.387, 'date': '2026-10-02'})
            self.assertIn('checked', value['rates']['ARS']); self.assertIn('consultado', value)

    def test_rates_endpoint_failure_falls_back_to_each_currency(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'exchange.json'
            def opener(request, timeout=0):
                if 'quotes=' in request.full_url:
                    raise OSError('down')
                quote = request.full_url.rsplit('/', 1)[1]
                return FakeResponse({'date': '2026-10-02', 'base': 'USD', 'quote': quote, 'rate': {'BRL': 5.2, 'UYU': 40.4, 'ARS': 1526}[quote]})
            value, changed = update_exchange(path, opener)
            self.assertTrue(changed)
            self.assertEqual({q: e['rate'] for q, e in value['rates'].items()}, {'BRL': 5.2, 'UYU': 40.4, 'ARS': 1526})
    def test_invalid_response_cannot_replace_valid_rate(self):
        from scrapers.update_exchange import fetch_rate
        for rate in [float('nan'),float('inf'),True,-2]:
            with self.assertRaises(ValueError):fetch_rate(lambda *a,**k:FakeResponse({'date':'2026-09-27','base':'USD','quote':'ARS','rate':rate}),'ARS')


if __name__ == '__main__':
    unittest.main()
