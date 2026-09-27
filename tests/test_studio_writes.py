import base64
import io
import json
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from PIL import Image
from tools.manual_editor import server as s, maintenance as m
from tools.scraper_health_alerts import alerts
from scrapers.publish_data import publish


class Fixture(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(); root=Path(self.temp.name)
        mapping={'PROJECT_ROOT':root,'DATA_DIR':root/'data','ASSET_DIR':root/'assets/manual','BACKUP_DIR':root/'.manual-backups','EDITOR_MODE':'owner'}
        for key,name in [('PRODUCTS_PATH','manual-products.json'),('STORES_PATH','manual-stores.json'),('BASE_STORES_PATH','stores.json'),('SITE_CONFIG_PATH','site-config.json'),('HIGHLIGHTS_PATH','highlights.json'),('HEALTH_PATH','health.json'),('META_PATH','meta.json')]: mapping[key]=root/'data'/name
        self.patch=patch.multiple(s,**mapping);self.patch.start();s.ensure_files()
        s.save_store({'store':{'nombre':'Tienda'}})
    def tearDown(self):
        self.patch.stop();self.temp.cleanup();s.CONTRIBUTION_PREVIEWS.clear()
    def product(self,**kwargs):
        return {'nombre':'JBL Flip 6','tienda':'Tienda','precio_usd':100,**kwargs}
    def save(self,**kwargs):return s.save_product({'product':self.product(**kwargs)})


class WriteTests(Fixture):
    def test_product_revision_history_and_invalid_input(self):
        result=self.save();pid=result['saved_id'];old=result['revision']
        result=self.save(id=pid,precio_usd=120)
        self.assertEqual([h['precio_usd'] for h in result['products'][0]['historial_precios']],[100,120])
        result=self.save(id=pid,precio_usd=120,nombre='Otro nombre')
        self.assertEqual(len(result['products'][0]['historial_precios']),2)
        before=s.PRODUCTS_PATH.read_bytes()
        with self.assertRaises(RuntimeError):s.save_product({'revision':old,'product':self.product(id=pid)})
        for value in [float('nan'),float('inf'),-1]:
            with self.assertRaises(ValueError):self.save(precio_usd=value)
        with self.assertRaises(ValueError):self.save(tienda='Desconocida')
        self.assertEqual(before,s.PRODUCTS_PATH.read_bytes())
    def test_rename_store_updates_products(self):
        self.save();s.save_store({'original_name':'Tienda','store':{'nombre':'Nueva'}})
        self.assertEqual(s.load_manual_products()['productos'][0]['tienda'],'Nueva')
        self.assertNotIn('Tienda',s.load_manual_stores()['tiendas'])
        before=s.STORES_PATH.read_bytes()
        with self.assertRaises(ValueError):s.save_store({'store':{'nombre':'Mala','sitio_web':'javascript:alert(1)'}})
        self.assertEqual(before,s.STORES_PATH.read_bytes())
    def test_bulk_only_selected_and_invalid_no_write(self):
        a=self.save()['saved_id'];b=self.save(nombre='Otro')['saved_id']
        r=s.bulk_products({'ids':[a],'action':'hide'})
        self.assertFalse(next(p for p in r['products'] if p['id']==a)['activo'])
        self.assertTrue(next(p for p in r['products'] if p['id']==b)['activo'])
        s.bulk_products({'ids':[a],'action':'show'});s.bulk_products({'ids':[a],'action':'category','category':'audio'})
        before=s.PRODUCTS_PATH.read_bytes()
        with self.assertRaises(ValueError):s.bulk_products({'ids':[a],'action':'category','category':''})
        self.assertEqual(before,s.PRODUCTS_PATH.read_bytes())
        r=s.bulk_products({'ids':[a],'action':'delete'});self.assertEqual([p['id'] for p in r['products']],[b])
    def test_upload_optimizes_and_rejects_fake_and_oversize(self):
        out=io.BytesIO();Image.new('RGB',(2200,1200),'red').save(out,'PNG')
        r=s.upload_image({'filename':'../../photo.png','data':base64.b64encode(out.getvalue()).decode()})
        for key,limit in [('path',1600),('thumbnail',360)]:
            with Image.open(s.PROJECT_ROOT/r[key]) as im:self.assertEqual(im.format,'WEBP');self.assertLessEqual(max(im.size),limit)
        for content in [b'not an image',b'x'*(s.MAX_IMAGE_BYTES+1)]:
            with self.assertRaises(ValueError):s.upload_image({'filename':'x.png','data':base64.b64encode(content).decode()})
    def test_import_merge_replace_invalid_atomic(self):
        pid=self.save()['saved_id']
        r=s.import_data({'data':{'products':[self.product(id=pid,precio_usd=150)]}})
        self.assertEqual(len(r['products']),1);self.assertEqual([x['precio_usd'] for x in r['products'][0]['historial_precios']],[100,150])
        before=s.PRODUCTS_PATH.read_bytes()
        with self.assertRaises(ValueError):s.import_data({'data':{'products':[self.product(nombre='Valido'),self.product(precio_usd=-3)]}})
        self.assertEqual(before,s.PRODUCTS_PATH.read_bytes())
        r=s.import_data({'mode':'replace','data':{'products':[self.product(tienda='Auto')]}})
        self.assertEqual(len(r['products']),1);self.assertIn('Auto',r['stores'])
    def test_contribution_collision_and_permissions(self):
        pid=self.save()['saved_id']
        s.CONTRIBUTION_PREVIEWS['test']={'manifest':{'products':[self.product(id=pid)],'stores':{},'contributor':{'name':'Tester'}},'assets':{}}
        r=s.apply_contribution({'preview_id':'test','products':[pid]})
        self.assertEqual(len({p['id'] for p in r['products']}),2)
        self.assertEqual(r['import_summary']['products'],1)
        with self.assertRaises(ValueError):s.apply_contribution({'preview_id':'expired'})
        with patch.object(s,'EDITOR_MODE','contributor'):
            for fn in [s.apply_contribution,lambda p:m.publish(s,p),lambda p:m.backups(s,p),lambda p:m.orphans(s,p)]:
                with self.assertRaises(ValueError):fn({})
    def test_restore_creates_safety_copy_and_preserves_history(self):
        pid=self.save()['saved_id'];self.save(id=pid,precio_usd=130)
        copy=m.backups(s,{})['backups'][0]['id']
        before=len(m.backups(s,{})['backups'])
        r=m.backups(s,{'action':'restore','id':copy})
        self.assertEqual(r['products'][0]['precio_usd'],100)
        self.assertEqual([x['precio_usd'] for x in r['products'][0]['historial_precios']],[100,130,100])
        self.assertEqual(len(m.backups(s,{})['backups']),before+1)
        with self.assertRaises(ValueError):m.backups(s,{'action':'restore','id':'../data'})
    def test_orphans_protect_config_backups_and_thumbnail(self):
        for name in ['used.webp','used-thumb.webp','old.webp','unused.webp']:(s.ASSET_DIR/name).write_bytes(b'image')
        self.save(imagen='assets/manual/old.webp')
        config=s.default_site_config();config['appearance']['light']['background_image']='assets/manual/used.webp';s.save_site_config({'config':config})
        s.delete_product({'id':s.load_manual_products()['productos'][0]['id']})
        self.assertEqual([x['path'] for x in m.orphans(s,{})['files']],['assets/manual/unused.webp'])
        with self.assertRaises(ValueError):m.orphans(s,{'action':'delete','paths':['assets/manual/old.webp']})
        self.assertEqual(m.orphans(s,{'action':'delete','paths':['assets/manual/unused.webp']})['deleted'],1)
    def test_scraper_preserves_studio_files_and_partial_threshold(self):
        paths=[s.SITE_CONFIG_PATH,s.HIGHLIGHTS_PATH,s.PRODUCTS_PATH,s.STORES_PATH]
        before={p:p.read_bytes() for p in paths}
        for i in range(3):publish(s.DATA_DIR,{'intento_actualizacion':str(i),'resumen':[{'tienda':'X','parcial':True}],'productos':[]},attempted_stores={'X'})
        self.assertEqual(before,{p:p.read_bytes() for p in paths})
        self.assertEqual(len(alerts(s.read_json(s.HEALTH_PATH,{}))),1)
        publish(s.DATA_DIR,{'intento_actualizacion':'ok','resumen':[{'tienda':'X'}],'productos':[]},attempted_stores={'X'})
        self.assertEqual(alerts(s.read_json(s.HEALTH_PATH,{})),[])


class GitTests(Fixture):
    def run_git(self,*args,cwd=None):
        return subprocess.run(['git',*args],cwd=cwd or s.PROJECT_ROOT,check=True,capture_output=True,text=True).stdout
    def init_git(self):
        self.remote=s.PROJECT_ROOT.parent/(s.PROJECT_ROOT.name+'-remote.git')
        self.addCleanup(lambda: __import__('shutil').rmtree(self.remote,ignore_errors=True))
        self.run_git('init','--bare',str(self.remote));self.run_git('init','-b','main')
        self.run_git('config','user.name','Test');self.run_git('config','user.email','test@example.test')
        self.run_git('add','data');self.run_git('commit','-m','Initial');self.run_git('remote','add','origin',str(self.remote));self.run_git('push','-u','origin','main')
    def test_publish_real_local_remote_scope_and_stale_review(self):
        self.init_git();self.save();(s.PROJECT_ROOT/'unrelated.txt').write_text('keep')
        review=m.publish(s,{})
        self.save(nombre='Second')
        with self.assertRaises(ValueError):m.publish(s,{'action':'publish','review':review['review'],'confirm':True})
        review=m.publish(s,{})
        result=m.publish(s,{'action':'publish','review':review['review'],'confirm':True})
        self.assertTrue(result['published']);self.assertIn('unrelated.txt',self.run_git('status','--short'))
        self.assertEqual(self.run_git('rev-parse','HEAD').strip(),self.run_git('rev-parse','main',cwd=self.remote).strip())
    def test_publish_rejects_foreign_staging_and_conflicts(self):
        self.init_git();(s.PROJECT_ROOT/'other.txt').write_text('other');self.run_git('add','other.txt')
        with self.assertRaises(ValueError):m.publish(s,{})
    def test_failed_push_keeps_commit(self):
        self.init_git();self.save();review=m.publish(s,{})
        hook=self.remote/'hooks'/'pre-receive'
        hook.write_text('#!/bin/sh\nexit 1\n');hook.chmod(0o755)
        with self.assertRaises(ValueError):m.publish(s,{'action':'publish','review':review['review'],'confirm':True})
        self.assertIn('Actualizar RivFree',self.run_git('log','-1','--format=%s'))
        self.assertEqual(self.run_git('diff','--cached','--name-only'),'')
