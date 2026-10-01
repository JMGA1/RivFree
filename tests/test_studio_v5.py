import unittest
from tools.manual_editor import server


class StoreMapAndTelegramTests(unittest.TestCase):
    def test_location_and_telegram_are_saved(self):
        _, value = server.normalize_store({'nombre': 'Local', 'telegram': 'https://t.me/local',
                                           'ubicacion': {'lat': '-30.8986771', 'lng': -55.538879}})
        self.assertEqual(value['redes']['telegram'], 'https://t.me/local')
        self.assertEqual(value['ubicacion'], {'lat': -30.8986771, 'lng': -55.538879})

    def test_location_can_be_cleared_and_is_kept_when_not_sent(self):
        _, kept = server.normalize_store({'nombre': 'Local'}, {'ubicacion': {'lat': -30.9, 'lng': -55.5}})
        self.assertEqual(kept['ubicacion'], {'lat': -30.9, 'lng': -55.5})
        _, cleared = server.normalize_store({'nombre': 'Local', 'ubicacion': None}, {'ubicacion': {'lat': -30.9, 'lng': -55.5}})
        self.assertIsNone(cleared['ubicacion'])

    def test_invalid_locations_are_rejected(self):
        for bad in [{'lat': -95, 'lng': 0}, {'lat': 'x', 'lng': 1}, {'lat': 1}, {'lat': 0, 'lng': 0}, 'here', {'lat': True, 'lng': 1}]:
            with self.assertRaises(ValueError):
                server.normalize_store({'nombre': 'Local', 'ubicacion': bad})

    def test_unsafe_telegram_link_is_rejected(self):
        with self.assertRaises(ValueError):
            server.normalize_store({'nombre': 'Local', 'telegram': 'javascript:alert(1)'})


if __name__ == '__main__':
    unittest.main()
