import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from tools.manual_editor import server


class SiteOptionsV6Tests(unittest.TestCase):
    def test_social_links_are_saved_and_unsafe_links_name_the_network(self):
        config = server.normalize_site_config({'social': {'show_without_link': False,
                                                          'instagram': {'url': 'https://instagram.com/rivfree', 'visible': True},
                                                          'youtube': {'url': '', 'visible': True}}})
        self.assertEqual(config['social']['instagram'], {'url': 'https://instagram.com/rivfree', 'visible': True})
        self.assertEqual(config['social']['youtube'], {'url': '', 'visible': True})
        self.assertFalse(config['social']['show_without_link'])
        self.assertEqual(config['social']['x'], {'url': '', 'visible': False}, 'defaults for networks not sent')
        for bad in ('javascript:alert(1)', 'http://instagram.com/rivfree', 'https://user:pass@instagram.com/'):
            with self.assertRaisesRegex(ValueError, 'TikTok'):
                server.normalize_site_config({'social': {'tiktok': {'url': bad, 'visible': True}}})

    def test_navigation_top_notice_and_offer_tiers(self):
        config = server.normalize_site_config({'nav': {'exchange': False},
                                               'top_notice': {'enabled': False, 'title_es': 'Hola', 'short_pt': 'x' * 500},
                                               'offers': {'tiers': [60, '30', 20, 200, 30, 3, 'x']}})
        self.assertEqual(config['nav'], {'stores': True, 'offers': True, 'exchange': False, 'list': True})
        self.assertFalse(config['top_notice']['enabled'])
        self.assertEqual(config['top_notice']['title_es'], 'Hola')
        self.assertEqual(len(config['top_notice']['short_pt']), 200)
        self.assertEqual(config['offers']['tiers'], [20, 30, 60])
        self.assertEqual(server.normalize_site_config({'offers': {'tiers': []}})['offers']['tiers'], [20, 40, 60])
        self.assertEqual(server.normalize_site_config({'offers': {'tiers': [10, 20, 30, 40, 50]}})['offers']['tiers'], [10, 20, 30, 40])

    def test_older_config_files_get_the_new_options_when_studio_loads_them(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'site-config.json'
            path.write_text(json.dumps({'branding': {'site_name': 'RivFree'}}), encoding='utf-8')
            with mock.patch.object(server, 'SITE_CONFIG_PATH', path):
                config = server.load_site_config()
        self.assertEqual(config['branding'], {'site_name': 'RivFree'})
        for key in ('top_notice', 'social', 'nav', 'offers'):
            self.assertIn(key, config)
        self.assertTrue(config['social']['instagram']['visible'])

    def test_studio_page_has_the_new_controls(self):
        html = Path(server.__file__).with_name('index.html').read_text(encoding='utf-8')
        for control in ('topNoticeEnabled', 'topNoticeShortPt', 'socialInstagramUrl', 'socialTelegramVisible', 'socialShowPending',
                        'navShowExchange', 'navShowList', 'offerTier1', 'offerTier4'):
            self.assertIn(f'id="{control}"', html)
        script = Path(server.__file__).with_name('studio-editor.js').read_text(encoding='utf-8')
        self.assertIn("'top_notice','social','nav','offers']", script, 'Guardar solo Página includes the new options')

    def test_published_config_and_update_scope_include_v6_files(self):
        root = Path(server.__file__).resolve().parents[2]
        config = json.loads((root / 'data' / 'site-config.json').read_text(encoding='utf-8'))
        for key in ('top_notice', 'social', 'nav', 'offers'):
            self.assertIn(key, config)
        from tools.manual_editor import maintenance
        scope = set(maintenance.UPDATE_PATHS)
        for path in ('tests/v6-improvements.test.cjs', 'tests/test_studio_v6.py'):
            self.assertIn(path, scope)


class LightPaletteTests(unittest.TestCase):
    def test_untouched_light_background_moves_to_the_new_default(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'site-config.json'
            for customized, expected in ((False, '#E8ECF2'), (True, '#F5F6F8')):
                path.write_text(json.dumps({'appearance': {'colors_customized': customized, 'light': {'background': '#F5F6F8'}}}), encoding='utf-8')
                with mock.patch.object(server, 'SITE_CONFIG_PATH', path):
                    self.assertEqual(server.load_site_config()['appearance']['light']['background'], expected)


if __name__ == '__main__':
    unittest.main()
