import contextlib
import http.client
import io
import json
import tempfile
import threading
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch
from http.server import ThreadingHTTPServer
from PIL import Image
from tools.manual_editor import server as s, maintenance as m
from tools.ci_data import import_data


class HTTPBoundaryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.root = Path(cls.temp.name)
        for name in ['index.html', '.git/config', '.git/HEAD', '.manual-backups/x.json', 'tools/manual_editor/server.py', 'tools/manual_editor/index.html', 'tools/manual_editor/editor.js', 'data/health.json', 'data/products.json']:
            p=cls.root/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text('{}')
        (cls.root/'leak.js').symlink_to(cls.root/'.git/config')
        cls.patch = patch.multiple(s, PROJECT_ROOT=cls.root, SESSION_TOKEN='test-session-secret')
        cls.patch.start()
        cls.server=ThreadingHTTPServer(('127.0.0.1',0),s.Handler)
        cls.thread=threading.Thread(target=cls.server.serve_forever,daemon=True);cls.thread.start()
    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown();cls.server.server_close();cls.thread.join();cls.patch.stop();cls.temp.cleanup()
    def request(self,path,method='GET',headers=None,body=None):
        conn=http.client.HTTPConnection('127.0.0.1',self.server.server_port,timeout=3)
        conn.request(method,path,body=body,headers=headers or {})
        response=conn.getresponse();result=(response.status,dict(response.getheaders()),response.read());conn.close();return result
    def test_private_files_encoded_traversal_and_symlinks_blocked_get_head(self):
        for path in ['/.git/config','/.git/HEAD','/.manual-backups/','/tools/manual_editor/server.py','/data/health.json','/%2egit/config','/data/../.git/config','/%252egit/config','/leak.js','/tools/manual_editor/../../.git/config']:
            for method in ['GET','HEAD']:
                with self.subTest(path=path,method=method):self.assertEqual(self.request(path,method)[0],404)
    def test_public_preview_inventory_and_headers(self):
        for path in ['/','/tools/manual_editor/','/tools/manual_editor/editor.js','/data/products.json']:
            status,headers,_=self.request(path);self.assertEqual(status,200);self.assertEqual(headers['X-Content-Type-Options'],'nosniff');self.assertEqual(headers['Referrer-Policy'],'no-referrer')
        self.assertEqual(self.request('/data/')[0],404)
    def test_host_origin_and_fetch_metadata_apply_to_all_methods(self):
        for method in ['GET','HEAD','POST']:
            for headers in [{'Host':'evil.example.com'}, {'Host':'localhost:1'}, {'Origin':'http://127.0.0.1:1'}, {'Origin':'null'}, {'Sec-Fetch-Site':'cross-site'}]:
                self.assertEqual(self.request('/',method,headers)[0],403)
    def test_api_requires_header_not_query_and_does_not_log_secret(self):
        output=io.StringIO()
        with contextlib.redirect_stdout(output),patch.object(s,'state_payload',return_value={'ok':True}):
            self.assertEqual(self.request('/api/manual/state?token=test-session-secret')[0],403)
            status,_,body=self.request('/api/manual/state',headers={'X-RivFree-Editor-Token':'test-session-secret'})
            self.assertEqual(status,200);self.assertTrue(json.loads(body)['ok'])
        self.assertNotIn('test-session-secret',output.getvalue())
    def test_wrong_content_type_and_body_limits(self):
        headers={'X-RivFree-Editor-Token':'test-session-secret','Content-Type':'text/plain'}
        self.assertEqual(self.request('/api/manual/save-product','POST',headers,'{}')[0],400)
        headers['Content-Type']='application/json';headers['Content-Length']=str(s.MAX_BODY_BYTES+1)
        self.assertEqual(self.request('/api/manual/save-product','POST',headers)[0],400)


class InputSecurityTests(unittest.TestCase):
    def test_imported_assets_reject_fakes_and_strip_metadata(self):
        with tempfile.TemporaryDirectory() as folder, patch.multiple(s,PROJECT_ROOT=Path(folder),ASSET_DIR=Path(folder)/'assets/manual'):
            for name,raw in [('a.png',b'<script>alert(1)</script>'),('b.webp',b'MZfake'),('c.gif',b'<svg onload="alert(1)"/>')]:
                self.assertIsNone(s._save_imported_asset(name,{name:raw}))
            raw=io.BytesIO();im=Image.new('RGB',(10,10));exif=Image.Exif();exif[270]='private location';im.save(raw,format='JPEG',exif=exif)
            path=s._save_imported_asset('a.jpg',{'a.jpg':raw.getvalue()})
            with Image.open(Path(folder)/path) as result:
                self.assertEqual(result.format,'WEBP');self.assertFalse(result.getexif());self.assertNotIn('exif',result.info)
    def test_import_store_allowlist_and_https(self):
        _,store=s.normalize_import_store('shop',{'redes':{'tiktok':'javascript:alert(1)','x':'data:text/html,x'},'campo_extra':'x'})
        self.assertNotIn('campo_extra',store);self.assertEqual(store['redes'],{})
        for url in ['http://example.com','https://user:secret@example.com','javascript:alert(1)','https://host\n.example']:
            with self.assertRaises(ValueError):s.safe_url(url)
    def test_redacts_credentials_in_nested_outputs(self):
        result=m.redact_value({'output':['https://user:secret@example.com/x?token=abcd']})
        self.assertNotIn('secret',str(result));self.assertNotIn('abcd',str(result))
    def test_duplicate_and_symlink_zip_members_rejected(self):
        for mode in ['duplicate','symlink']:
            raw=io.BytesIO()
            with zipfile.ZipFile(raw,'w') as z:
                z.writestr('rivfree-contribution.json','{}')
                if mode=='duplicate':z.writestr('rivfree-contribution.json','{}')
                else:
                    info=zipfile.ZipInfo('assets/x.png');info.external_attr=0o120777<<16;z.writestr(info,'/etc/passwd')
            with zipfile.ZipFile(io.BytesIO(raw.getvalue())) as z,self.assertRaises(ValueError):s._safe_zip_members(z)
    def test_artifact_cannot_overwrite_code_or_manual_configuration(self):
        for name in ['evil.js','manual-products.json','products/evil.js']:
            with tempfile.TemporaryDirectory() as source,tempfile.TemporaryDirectory() as dest:
                p=Path(source)/name;p.parent.mkdir(exist_ok=True);p.write_text('{}')
                with self.assertRaises(ValueError):import_data(source,Path(dest))
                self.assertEqual(list(Path(dest).iterdir()),[])

class RestoreAndWriteSecurityTests(unittest.TestCase):
    def test_json_writer_rejects_symlinked_temporary_file(self):
        with tempfile.TemporaryDirectory() as folder, tempfile.TemporaryDirectory() as outside:
            root=Path(folder);target=root/'config.json';secret=Path(outside)/'important';secret.write_text('preserve')
            target.with_suffix('.json.tmp').symlink_to(secret)
            with patch.object(s,'PROJECT_ROOT',root),self.assertRaises(ValueError):s.atomic_write_json(target,{})
            self.assertEqual(secret.read_text(),'preserve')
    def test_restore_normalizes_site_colors_and_rejects_unsafe_campaign_url(self):
        from test_studio_writes import Fixture
        fixture=Fixture();fixture.setUp()
        try:
            key='20260928-120000-000001';folder=s.BACKUP_DIR/key;folder.mkdir(parents=True)
            config=s.default_site_config();config['appearance']['light']['background']='red;}body{display:none}'
            (folder/'site-config.json').write_text(json.dumps(config))
            m.backups(s,{'action':'restore','id':key,'revision':s.revision()})
            self.assertEqual(s.load_site_config()['appearance']['light']['background'],s.default_site_config()['appearance']['light']['background'])
            (folder/'highlights.json').write_text(json.dumps({'hero':[{'id':'x','title':{'es':'x'},'href':'https://user:secret@example.com'}]}))
            before=s.SITE_CONFIG_PATH.read_bytes()
            with self.assertRaises(ValueError):m.backups(s,{'action':'restore','id':key,'revision':s.revision()})
            self.assertEqual(s.SITE_CONFIG_PATH.read_bytes(),before)
        finally:fixture.tearDown()
