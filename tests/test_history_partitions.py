import hashlib
import tempfile
import unittest
from pathlib import Path
from scrapers.publish_data import write_history_partitions, read_json

class HistoryPartitionsTests(unittest.TestCase):
    def test_unicode_urls_round_trip_versions_and_cleanup(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            series = {f'https://shop.test/café/{i}': [['2026-09-01', i+1]] for i in range(600)}
            write_history_partitions(root, series)
            index = read_json(root/'price-history/index.json', {})
            self.assertEqual(index['algorithm'], 'sha256-2')
            combined = {}
            for key, version in index['shards'].items():
                path = root/f'price-history/{key}.json'
                self.assertEqual(version, hashlib.sha256(path.read_bytes()).hexdigest()[:20])
                values = read_json(path, {})
                self.assertTrue(all(hashlib.sha256(url.encode()).hexdigest().startswith(key) for url in values))
                combined.update(values)
            self.assertEqual(combined, series)
            write_history_partitions(root, series)
            self.assertEqual(read_json(root/'price-history/index.json', {}), index)
            write_history_partitions(root, {})
            self.assertEqual(list((root/'price-history').glob('*.json')), [root/'price-history/index.json'])
