import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from tools import build_public_site
from tools.manual_editor import server as s


class Fixture(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); root = Path(self.temp.name)
        mapping = {'PROJECT_ROOT': root, 'DATA_DIR': root / 'data', 'ASSET_DIR': root / 'assets/manual',
                   'BACKUP_DIR': root / '.manual-backups', 'EDITOR_MODE': 'owner'}
        for key, name in [('PRODUCTS_PATH', 'manual-products.json'), ('STORES_PATH', 'manual-stores.json'),
                          ('BASE_STORES_PATH', 'stores.json'), ('SITE_CONFIG_PATH', 'site-config.json'),
                          ('HIGHLIGHTS_PATH', 'highlights.json'), ('HEALTH_PATH', 'health.json'), ('META_PATH', 'meta.json')]:
            mapping[key] = root / 'data' / name
        self.root = root
        self.patch = patch.multiple(s, **mapping); self.patch.start(); s.ensure_files()
        s.save_store({'store': {'nombre': 'Tienda'}})

    def tearDown(self):
        self.patch.stop(); self.temp.cleanup()

    def save(self, **fields):
        state = s.state_payload()
        return s.save_product({'revision': state['revision'], 'product': {'nombre': 'JBL Flip 6', 'tienda': 'Tienda', 'precio_usd': 100, **fields}})


class PrivateNotesTests(Fixture):
    def test_internal_notes_stay_on_this_computer(self):
        result = self.save(nota_manual='Confirmar precio con Juan')
        public = json.loads(s.PRODUCTS_PATH.read_text(encoding='utf-8'))
        self.assertNotIn('nota_manual', public['productos'][0], 'the public catalog has no notes')
        private = json.loads((self.root / '.rivfree-local' / 'product-notes.json').read_text(encoding='utf-8'))
        self.assertEqual(private[result['saved_id']]['nota_manual'], 'Confirmar precio con Juan')
        self.assertEqual(result['products'][0]['nota_manual'], 'Confirmar precio con Juan', 'Studio still shows the note')

    def test_editing_keeps_or_clears_the_note(self):
        saved = self.save(nota_manual='Nota')
        product = saved['products'][0]
        state = s.state_payload()
        again = s.save_product({'revision': state['revision'], 'product': {**product, 'precio_usd': 90}})
        self.assertEqual(again['products'][0]['nota_manual'], 'Nota')
        state = s.state_payload()
        cleared = s.save_product({'revision': state['revision'], 'product': {**product, 'nota_manual': ''}})
        self.assertFalse(cleared['products'][0].get('nota_manual'))

    def test_old_catalogs_with_notes_move_them_out_on_the_next_save(self):
        doc = {'version': 'x', 'actualizado': None, 'productos': [
            {'id': 'old', 'nombre': 'Viejo', 'tienda': 'Tienda', 'precio_usd': 5, 'nota_manual': 'privada', 'aportado_por': 'Pedro'}]}
        s.PRODUCTS_PATH.write_text(json.dumps(doc), encoding='utf-8')
        self.assertEqual(s.state_payload()['products'][0]['nota_manual'], 'privada')
        self.save(nombre='Otro')
        public = s.PRODUCTS_PATH.read_text(encoding='utf-8')
        self.assertNotIn('privada', public); self.assertNotIn('Pedro', public)
        self.assertEqual(s.state_payload()['products'][0]['aportado_por'], 'Pedro')


class PublishedCatalogTests(unittest.TestCase):
    def test_published_copy_has_no_hidden_products_or_internal_fields(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'manual-products.json'
            path.write_text(json.dumps({'productos': [
                {'id': 'a', 'nombre': 'Visible', 'nota_manual': 'x', 'aportado_por': 'Ana', 'aporte_id': '1'},
                {'id': 'b', 'nombre': 'Oculto', 'activo': False}]}), encoding='utf-8')
            build_public_site.public_manual_products(path)
            doc = json.loads(path.read_text(encoding='utf-8'))
        self.assertEqual(doc['productos'], [{'id': 'a', 'nombre': 'Visible'}])


class EmailAndLinkTests(Fixture):
    def test_store_email_must_be_a_plain_address(self):
        for bad in ('ventas@tienda.com?bcc=otro@x.com', 'javascript:alert(1)', 'a b@c.com'):
            with self.assertRaisesRegex(ValueError, 'Email inválido'):
                s.normalize_store({'nombre': 'X', 'email': bad})
        self.assertEqual(s.normalize_store({'nombre': 'X', 'email': ' Ventas@Tienda.com '})[1]['email'], 'Ventas@Tienda.com')


class StudioFormTests(unittest.TestCase):
    def test_prices_accept_comma_and_thousands(self):
        for raw, expected in (('29,90', 29.9), ('1.299,90', 1299.9), ('1,299.90', 1299.9), ('USD 29,90', 29.9), (' 30 ', 30.0), (12, 12.0)):
            self.assertEqual(s.number_or_none(raw, 'Precio'), expected, raw)
        self.assertIsNone(s.number_or_none('', 'Precio'))
        with self.assertRaisesRegex(ValueError, 'número'):
            s.number_or_none('veinte', 'Precio')

    def test_store_whatsapp_accepts_a_phone_number(self):
        for raw in ('+598 99 123 456', '099 123 456', 'https://wa.me/59899123456'):
            self.assertEqual(s.normalize_store({'nombre': 'X', 'whatsapp': raw})[1]['redes']['whatsapp'], 'https://wa.me/59899123456')
        with self.assertRaisesRegex(ValueError, 'código de país'):
            s.normalize_store({'nombre': 'X', 'whatsapp': '1234567'})

    def test_studio_page_controls(self):
        folder = Path(s.__file__).parent
        html = (folder / 'index.html').read_text(encoding='utf-8')
        self.assertIn('id="bulkShowProducts"', html)
        self.assertIn('<input id="productPrice" type="text" inputmode="decimal"', html)
        self.assertIn('id="storeWhatsapp" type="text" inputmode="tel"', html)
        hours = (folder / 'hours-editor.js').read_text(encoding='utf-8')
        self.assertIn("$('hoursDay6').after($('hoursDay0'))", hours, 'the week starts on Monday')
        self.assertIn('Copiar a otros días', hours)
        editor = (folder / 'editor.js').read_text(encoding='utf-8')
        self.assertIn('¿El precio es correcto?', editor)
        self.assertIn('el precio anterior tiene que ser mayor', editor)
        self.assertIn('No hay conexión con Studio', editor)
        self.assertIn("title:'Descartar cambios'", (folder / 'studio-editor.js').read_text(encoding='utf-8'))
        self.assertIn('backupLabel', (folder / 'maintenance.js').read_text(encoding='utf-8'))
        self.assertIn('cada vez que se abre, la clave cambia', s.SESSION_EXPIRED)

    def test_update_scope_includes_v8_files(self):
        from tools.manual_editor import maintenance
        for path in ('tests/v8-improvements.test.cjs', 'tests/test_studio_v8.py', 'CAMBIOS-V8.md', 'privacy.css', 'database/serve.py'):
            self.assertIn(path, maintenance.UPDATE_PATHS)


if __name__ == '__main__':
    unittest.main()
