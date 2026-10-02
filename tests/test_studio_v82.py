import unittest
from pathlib import Path

from tools.manual_editor import maintenance as m
from tools.manual_editor import server as s


class StoreLogoTests(unittest.TestCase):
    def test_logo_and_tag_style_are_saved(self):
        _, info = s.normalize_store({'nombre': 'DFA', 'logo': 'assets/manual/dfa-logo.webp', 'etiqueta': 'logo'})
        self.assertEqual((info['logo'], info['etiqueta']), ('assets/manual/dfa-logo.webp', 'logo'))
        _, plain = s.normalize_store({'nombre': 'DFA', 'logo': 'assets/manual/dfa-logo.webp', 'etiqueta': 'cualquier cosa'})
        self.assertEqual(plain['etiqueta'], 'nombre', 'anything else keeps the color tag')
        _, kept = s.normalize_store({'nombre': 'DFA'}, info)
        self.assertEqual((kept['logo'], kept['etiqueta']), ('assets/manual/dfa-logo.webp', 'logo'), 'older forms keep the logo')

    def test_logo_needs_a_file_and_a_safe_address(self):
        with self.assertRaisesRegex(ValueError, 'primero subí el logo'):
            s.normalize_store({'nombre': 'DFA', 'logo': '', 'etiqueta': 'logo'})
        with self.assertRaisesRegex(ValueError, 'HTTPS'):
            s.normalize_store({'nombre': 'DFA', 'logo': 'javascript:alert(1)', 'etiqueta': 'logo'})

    def test_studio_store_form_has_the_logo_controls(self):
        folder = Path(s.__file__).parent
        html = (folder / 'index.html').read_text(encoding='utf-8')
        for control in ('storeLogo', 'storeLogoFile', 'storeUseLogo', 'clearStoreLogo', 'storeLogoPreview'):
            self.assertIn(f'id="{control}"', html)
        editor = (folder / 'editor.js').read_text(encoding='utf-8')
        self.assertIn("logo:$('storeLogo').value.trim(),etiqueta:$('storeUseLogo').checked?'logo':'nombre'", editor)
        for path in ('tests/v82-improvements.test.cjs', 'tests/test_studio_v82.py'):
            self.assertIn(path, m.UPDATE_PATHS)


if __name__ == '__main__':
    unittest.main()
