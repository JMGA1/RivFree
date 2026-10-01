import json
import tempfile
import unittest
from pathlib import Path
from tools.manual_editor import server

class StudioEditorTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(); root=Path(self.temp.name)
        self.old={k:getattr(server,k) for k in ['PROJECT_ROOT','DATA_DIR','ASSET_DIR','BACKUP_DIR','PRODUCTS_PATH','STORES_PATH','BASE_STORES_PATH','SITE_CONFIG_PATH','HIGHLIGHTS_PATH','EDITOR_MODE']}
        server.PROJECT_ROOT=root; server.DATA_DIR=root/'data'; server.ASSET_DIR=root/'assets'/'manual'; server.BACKUP_DIR=root/'.manual-backups'
        server.PRODUCTS_PATH=server.DATA_DIR/'manual-products.json'; server.STORES_PATH=server.DATA_DIR/'manual-stores.json'; server.BASE_STORES_PATH=server.DATA_DIR/'stores.json'; server.SITE_CONFIG_PATH=server.DATA_DIR/'site-config.json'; server.HIGHLIGHTS_PATH=server.DATA_DIR/'highlights.json'; server.EDITOR_MODE='owner'
        server.DATA_DIR.mkdir(parents=True); server.BASE_STORES_PATH.write_text('{}',encoding='utf-8'); server.ensure_files()
    def tearDown(self):
        for k,v in self.old.items(): setattr(server,k,v)
        self.temp.cleanup()
    def test_site_config_is_sanitized_and_saved(self):
        config=server.default_site_config(); config['branding']['site_name']='Mi RivFree'; config['appearance']['radius']=99; config['appearance']['light']['background_image']='javascript:alert(1)'; config['carousel']['visible_count']=25
        with self.assertRaises(ValueError):
            server.save_site_config({'config':config})
        config['appearance']['light']['background_image']='assets/manual/fondo.webp'
        state=server.save_site_config({'config':config})
        saved=json.loads(server.SITE_CONFIG_PATH.read_text(encoding='utf-8'))
        self.assertEqual(saved['branding']['site_name'],'Mi RivFree')
        self.assertEqual(saved['appearance']['radius'],32)
        self.assertEqual(saved['appearance']['light']['background_image'],'assets/manual/fondo.webp')
        self.assertEqual(saved['carousel']['visible_count'],10)
        self.assertEqual(state['site_config']['branding']['site_name'],'Mi RivFree')
    def test_campaigns_support_sponsored_schedule_and_local_image(self):
        hero=[{'id':'promo-1','poolGroup':'general','theme':'blue','layout':'banner','enabled':True,'sponsored':True,'title':{'es':'Promo','pt-BR':'Promo'},'eyebrow':{'es':'PUBLICIDAD','pt-BR':'PUBLICIDADE'},'description':{'es':'Texto','pt-BR':'Texto'},'cta':{'es':'Ver','pt-BR':'Ver'},'image':'assets/manual/promo.webp','starts_at':'2026-10-01T10:00','ends_at':'2026-10-10T22:00'}]
        state=server.save_highlights({'hero':hero})
        item=state['highlights']['hero'][0]
        self.assertTrue(item['sponsored']); self.assertEqual(item['layout'],'banner'); self.assertEqual(item['image'],'assets/manual/promo.webp'); self.assertIn('starts_at',item)
    def test_duplicate_campaign_ids_are_rejected(self):
        item={'id':'same','title':{'es':'A','pt-BR':'A'},'eyebrow':{},'description':{},'cta':{}}
        with self.assertRaises(ValueError): server.save_highlights({'hero':[item,item]})
    def test_state_includes_health_and_meta_for_dashboard(self):
        server.HEALTH_PATH = server.DATA_DIR / 'health.json'
        server.META_PATH = server.DATA_DIR / 'meta.json'
        server.HEALTH_PATH.write_text(json.dumps({'DFA': {'estado':'ok','fallos_consecutivos':0}}), encoding='utf-8')
        server.META_PATH.write_text(json.dumps({'actualizado':'2026-09-26T10:00:00+00:00'}), encoding='utf-8')
        state=server.state_payload()
        self.assertEqual(state['health']['DFA']['estado'],'ok')
        self.assertEqual(state['meta']['actualizado'],'2026-09-26T10:00:00+00:00')

    def test_carousel_transition_and_fonts_are_sanitized(self):
        config=server.default_site_config(); config['carousel'].update({'transition':'static','transition_ms':750}); config['appearance']['font']='slab'
        normalized=server.normalize_site_config(config)
        self.assertEqual(normalized['carousel']['transition'],'static'); self.assertEqual(normalized['carousel']['transition_ms'],750); self.assertEqual(normalized['appearance']['font'],'slab')

    def test_campaign_custom_colors_and_extended_palette_are_preserved(self):
        hero=[{'id':'color-test','theme':'ocean','title':{'es':'Color','pt-BR':'Cor'},'eyebrow':{},'description':{},'cta':{},'colors':{'light':{'background':'#112233','text':'#FFFFFF','accent':'#445566','button':'#778899','button_text':'#000000'},'dark':{'background':'#101010','text':'#FAFAFA','accent':'#ABCDEF','button':'#123456','button_text':'#FFFFFF'}}}]
        item=server.save_highlights({'hero':hero})['highlights']['hero'][0]
        self.assertEqual(item['theme'],'ocean'); self.assertEqual(item['colors']['light']['button'],'#778899'); self.assertEqual(item['colors']['dark']['button_text'],'#FFFFFF')

    def test_owner_export_contains_studio_configuration(self):
        raw=server.export_zip()
        import io, zipfile
        with zipfile.ZipFile(io.BytesIO(raw)) as z:
            names=set(z.namelist())
        self.assertIn('data/site-config.json',names); self.assertIn('data/highlights.json',names)

    def test_native_palette_is_default_until_user_customizes_colors(self):
        config=server.default_site_config()
        self.assertFalse(config['appearance']['colors_customized'])
        self.assertEqual(config['appearance']['light']['background'],'#F5F6F8')
        self.assertEqual(config['appearance']['dark']['background'],'#101B2B')
        config['appearance']['colors_customized']=True
        normalized=server.normalize_site_config(config)
        self.assertTrue(normalized['appearance']['colors_customized'])

    def test_studio_html_uses_versioned_assets_and_new_controls(self):
        html=(Path(server.__file__).with_name('index.html')).read_text(encoding='utf-8')
        # Assets must carry a version so browsers pick up Studio updates (the exact number changes per release).
        self.assertRegex(html,r'editor\.css\?v=\d{8}-studio\d+')
        self.assertRegex(html,r'studio-editor\.js\?v=\d{8}-studio\d+')
        self.assertIn('id="healthKpis"',html)
        self.assertIn('id="restoreNativeTheme"',html)
        self.assertIn('id="appearanceEditTheme"',html)
        self.assertIn('id="campaignLightButton"',html)
        self.assertIn('id="discardCampaign"',html)

if __name__=='__main__': unittest.main()
