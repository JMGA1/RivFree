import json
import os
import ssl
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from tools import postgres_sync as pg
from tools.manual_editor import server

ROOT = Path(__file__).resolve().parents[1]


def fixture_root(folder, products, stores=None, manual=None):
    root = Path(folder)
    (root / 'data').mkdir()
    (root / 'data' / 'stores.json').write_text(json.dumps(stores or {'DFA': {'nombre_completo': 'DFA Uruguay'}}), encoding='utf-8')
    (root / 'data' / 'manual-stores.json').write_text(json.dumps({'tiendas': {}}), encoding='utf-8')
    (root / 'data' / 'products.json').write_text(json.dumps({'actualizado': '2026-10-01T08:00:00Z', 'productos': products}), encoding='utf-8')
    (root / 'data' / 'manual-products.json').write_text(json.dumps({'productos': manual or []}), encoding='utf-8')
    return root


class ConnectionStringTests(unittest.TestCase):
    def test_provider_strings_are_understood(self):
        neon = pg.parse_database_url('postgresql://rivfree_owner:Abc%40123%3A%2F@ep-cool-sun-123456.sa-east-1.aws.neon.tech/rivfree?sslmode=require&channel_binding=require')
        self.assertEqual((neon['user'], neon['password'], neon['host'], neon['port'], neon['database'], neon['sslmode']),
                         ('rivfree_owner', 'Abc@123:/', 'ep-cool-sun-123456.sa-east-1.aws.neon.tech', 5432, 'rivfree', 'require'))
        aiven = pg.parse_database_url('postgres://avnadmin:secreto@pg-rivfree.aivencloud.com:12345/defaultdb?sslmode=require')
        self.assertEqual((aiven['port'], aiven['database']), (12345, 'defaultdb'))
        self.assertEqual(pg.parse_database_url('postgresql://manu@localhost/rivfree')['sslmode'], 'disable', 'local server: no SSL by default')
        self.assertEqual(pg.parse_database_url('postgresql://manu:x@db.example.com')['sslmode'], 'require', 'remote server: SSL by default')
        self.assertEqual(pg.parse_database_url('postgresql://manu:x@db.example.com')['database'], 'manu')

    def test_bad_strings_get_a_clear_message(self):
        for bad, text in (('', 'Pegá'), ('mysql://a:b@c/d', 'postgresql://'), ('postgresql://:x@host/db', 'usuario'),
                          ('postgresql://a:b@host:99999/db', 'puerto'), ('postgresql://a:b@host/db?sslmode=maybe', 'sslmode'),
                          ('postgresql://a:b@/db', 'servidor')):
            with self.assertRaisesRegex(pg.DatabaseProblem, text):
                pg.parse_database_url(bad)

    def test_internet_databases_never_connect_without_encryption(self):
        for mode in ('disable', 'allow', 'prefer'):
            with self.assertRaisesRegex(pg.DatabaseProblem, 'cifrada'):
                pg.parse_database_url(f'postgresql://a:b@db.example.com/x?sslmode={mode}')
        self.assertEqual(pg.parse_database_url('postgresql://a:b@localhost/x?sslmode=prefer')['sslmode'], 'prefer', 'local servers may skip TLS')
        self.assertIn('sslrootcert', str(pg.explain(ssl.SSLCertVerificationError('certificate verify failed'))))

    def test_password_is_never_shown(self):
        masked = pg.mask_url('postgresql://manu:SuperSecreta@db.example.com:5432/rivfree?sslmode=require')
        self.assertNotIn('SuperSecreta', masked)
        self.assertIn('manu:••••••@db.example.com', masked)

    def test_ssl_modes(self):
        info = lambda mode: {**pg.parse_database_url('postgresql://a:b@db.example.com/x'), 'sslmode': mode}
        self.assertIs(pg.ssl_context(info('disable')), False)
        self.assertIsNone(pg.ssl_context(info('prefer')))
        required = pg.ssl_context(info('require'))
        self.assertEqual((required.verify_mode, required.check_hostname), (ssl.CERT_REQUIRED, True), 'require also verifies the server')
        strict = pg.ssl_context(info('verify-full'))
        self.assertEqual((strict.verify_mode, strict.check_hostname), (ssl.CERT_REQUIRED, True))

    def test_server_errors_become_actionable_messages(self):
        class Fake(Exception):
            pass
        self.assertIn('contraseña', str(pg.explain(Fake({'C': '28P01', 'M': 'password authentication failed'}))))
        self.assertIn('no existe', str(pg.explain(Fake({'C': '3D000', 'M': 'database "x" does not exist'}))))
        self.assertIn('conectar', str(pg.explain(ConnectionRefusedError('refused'))))
        self.assertIn('SSL', str(pg.explain(ssl.SSLError('bad handshake'))))


class CatalogRowsTests(unittest.TestCase):
    def test_rows_are_unique_safe_and_keep_manual_products(self):
        products = [
            {'tienda': 'DFA', 'url': 'https://dfa.test/1', 'nombre': 'Uno', 'precio_usd': 10, 'precio_original_usd': 20, 'en_oferta': True, 'imagen': 'https://dfa.test/1.jpg'},
            {'tienda': 'DFA', 'url': 'https://dfa.test/1', 'nombre': 'Uno repetido', 'precio_usd': 9},
            {'tienda': 'Nueva', 'url': 'https://nueva.test/2', 'nombre': 'Dos', 'precio_usd': -1, 'imagen': 'javascript:alert(1)'},
            {'tienda': 'DFA', 'url': 'ftp://dfa.test/3', 'nombre': 'Tres'},
            {'tienda': 'DFA', 'id': 'manual-7', 'nombre': 'Visto en Instagram', 'precio_usd': 5, 'manual': True},
        ]
        stores, offers = pg.build_rows({'DFA': {'nombre_completo': 'DFA Uruguay', 'ocultar_fotos': True}}, products)
        self.assertEqual(sorted(s['id'] for s in stores), ['DFA', 'Nueva'])
        self.assertTrue(next(s for s in stores if s['id'] == 'DFA')['hide_photos'])
        self.assertEqual(len(offers), 3)
        dfa = next(o for o in offers if o['url'] == 'https://dfa.test/1')
        self.assertEqual((dfa['name'], dfa['price_usd']), ('Uno repetido', 9.0))
        nueva = next(o for o in offers if o['store_id'] == 'Nueva')
        self.assertIsNone(nueva['price_usd'])
        self.assertIsNone(nueva['image'])
        manual = next(o for o in offers if o['manual'])
        self.assertEqual(manual['url'], 'manual:manual-7')
        self.assertEqual(len({frozenset(o) for o in offers}), 1, 'every row has the same columns')

    def test_schema_is_split_into_statements_inside_its_own_schema(self):
        statements = pg.schema_statements()
        self.assertGreaterEqual(len(statements), 10)
        self.assertTrue(statements[0].startswith('create schema if not exists rivfree'))
        self.assertTrue(all('rivfree.' in s or s.startswith('create schema') for s in statements))
        self.assertFalse(any(word in ' '.join(statements).lower() for word in ('drop table', 'truncate', 'delete from')))


class SavedConnectionTests(unittest.TestCase):
    def test_saved_only_in_the_local_private_folder(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            url = 'postgresql://manu:clave@db.example.com/rivfree?sslmode=require'
            pg.save_url(url, root)
            self.assertEqual(pg.load_saved_url(root), url)
            self.assertEqual((root / '.rivfree-local' / '.gitignore').read_text(encoding='utf-8'), '*\n')
            if os.name == 'posix':
                self.assertEqual((root / '.rivfree-local' / 'database.json').stat().st_mode & 0o777, 0o600)
            pg.forget_url(root)
            self.assertEqual(pg.load_saved_url(root), '')
        gitignore = (ROOT / '.gitignore').read_text(encoding='utf-8')
        self.assertIn('.rivfree-local/', gitignore)

    def test_command_line_does_nothing_without_a_database(self):
        with mock.patch.dict(os.environ, {'DATABASE_URL': ''}), mock.patch.object(pg, 'load_saved_url', return_value=''):
            self.assertEqual(pg.main([]), 0)


class StudioDatabaseTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.root = Path(self.folder.name)
        patches = [mock.patch.object(server, 'PROJECT_ROOT', self.root), mock.patch.object(server, 'EDITOR_MODE', 'owner')]
        for patch in patches:
            patch.start()
            self.addCleanup(patch.stop)
        self.addCleanup(self.folder.cleanup)

    def test_connection_is_saved_only_after_it_works(self):
        module = server.postgres()
        url = 'postgresql://manu:clave@db.example.com/rivfree?sslmode=require'
        self.assertFalse(server.db_state()['configured'])
        with mock.patch.object(module, 'run_with_connection', side_effect=pg.DatabaseProblem('Usuario o contraseña incorrectos.')):
            with self.assertRaisesRegex(ValueError, 'contraseña'):
                server.db_save({'url': url})
        self.assertFalse(server.db_state()['configured'])
        with mock.patch.object(module, 'run_with_connection', return_value={'ready': False, 'server_version': '17.2', 'database': 'rivfree', 'size': '8 MB'}):
            state = server.db_save({'url': url})
        self.assertTrue(state['configured'])
        self.assertNotIn('clave', state['masked'])
        self.assertEqual(state['stats']['database'], 'rivfree')
        server.db_forget({})
        self.assertFalse(server.db_state()['configured'])

    def test_copy_needs_a_saved_connection_and_the_owner(self):
        with self.assertRaisesRegex(ValueError, 'guardá la conexión'):
            server.db_sync({})
        with mock.patch.object(server, 'EDITOR_MODE', 'contributor'):
            for action in (server.db_state, server.db_test, server.db_save, server.db_sync, server.db_forget):
                with self.assertRaisesRegex(ValueError, 'editor principal'):
                    action({'url': 'postgresql://a:b@c/d'})

    def test_studio_has_the_database_panel_and_store_photo_option(self):
        html = Path(server.__file__).with_name('index.html').read_text(encoding='utf-8')
        for control in ('data-tab="database"', 'id="dbUrl"', 'id="dbSave"', 'id="dbTest"', 'id="dbSync"', 'id="dbForget"', 'database-panel.js?v=', 'id="storeHidePhotos"'):
            self.assertIn(control, html)
        self.assertNotIn('supabase', html.lower())
        self.assertTrue(server.normalize_store({'nombre': 'DFA', 'ocultar_fotos': True})[1]['ocultar_fotos'])
        self.assertFalse(server.normalize_store({'nombre': 'DFA', 'ocultar_fotos': 'sí'})[1]['ocultar_fotos'])
        self.assertTrue(server.normalize_store({'nombre': 'DFA'}, {'ocultar_fotos': True})[1]['ocultar_fotos'], 'kept when not sent')


class CertificateFileTests(unittest.TestCase):
    def test_github_uses_the_certificate_secret_and_a_wrong_path_is_explained(self):
        with tempfile.TemporaryDirectory() as folder:
            ca = Path(folder) / 'ca.pem'; ca.write_text('x')
            info = pg.parse_database_url('postgresql://u:p@db.example.com/x?sslmode=require&sslrootcert=C:/RivFree-db/ca.pem')
            with mock.patch.dict(os.environ, {'PGSSLROOTCERT': str(ca)}), mock.patch.object(pg.ssl, 'create_default_context') as create:
                pg.ssl_context(info)
            create.assert_called_once_with(cafile=str(ca))
            with mock.patch.dict(os.environ, {}, clear=False):
                os.environ.pop('PGSSLROOTCERT', None)
                with self.assertRaisesRegex(pg.DatabaseProblem, 'No encontré el certificado'):
                    pg.ssl_context(info)


@unittest.skipUnless(os.environ.get('RIVFREE_TEST_DATABASE_URL'), 'set RIVFREE_TEST_DATABASE_URL to test against a real PostgreSQL')
class RealDatabaseTests(unittest.TestCase):
    def test_copy_twice_records_only_changes_and_retires_missing_offers(self):
        url = os.environ['RIVFREE_TEST_DATABASE_URL']
        products = [{'tienda': 'DFA', 'url': f'https://dfa.test/{i}', 'nombre': f'Producto {i}', 'precio_usd': 10 + i} for i in range(10)]
        with tempfile.TemporaryDirectory() as folder:
            root = fixture_root(folder, products)
            con = pg.connect(url)
            try:
                con.run('drop schema if exists rivfree cascade')
                first = pg.sync(con, root, 'test')
                self.assertEqual((first['offers'], first['new_offers'], first['price_changes'], first['removed']), (10, 10, 0, 0))
                products[0]['precio_usd'] = 5
                del products[9]
                (root / 'data' / 'products.json').write_text(json.dumps({'productos': products}), encoding='utf-8')
                second = pg.sync(con, root, 'test')
                self.assertEqual((second['new_offers'], second['price_changes'], second['removed']), (0, 1, 1))
                self.assertEqual(con.run('select count(*) from rivfree.price_drops')[0][0], 1)
                stats = pg.stats(con)
                self.assertEqual((stats['active_offers'], stats['last_sync']['removed']), (9, 1))
                (root / 'data' / 'products.json').write_text(json.dumps({'productos': products[:2]}), encoding='utf-8')
                third = pg.sync(con, root, 'test')
                self.assertTrue(third['removal_skipped'], 'a nearly empty catalog does not retire the database')
            finally:
                con.run('drop schema if exists rivfree cascade')
                con.close()


if __name__ == '__main__':
    unittest.main()
