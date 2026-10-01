from tests.test_manual_editor import ManualEditorPersistenceTests
from tools.manual_editor import server
import unittest

class ProfileTests(unittest.TestCase):
    def test_metadata_round_trip_and_partial_edits(self):
        data={'nombre':'Local','description':{'es':'Trayectoria','pt-BR':'História'},'specialties':['Perfumes'],
              'weekly_hours':{'1':[['09:00','18:00']]},'hours_exceptions':{'2026-12-25':[]},
              'google':{'rating':4.5,'count':30,'url':'https://maps.google.com/'},
              'photos':[{'url':'https://example.com/photo.jpg','caption':'Local','attribution':'Tienda'}]}
        _,profile=server.normalize_store(data)
        _,edited=server.normalize_store({'nombre':'Local','telefono':'123'},profile)
        for key in ('description','specialties','weekly_hours','hours_exceptions','google','photos'):
            self.assertEqual(profile[key],edited[key])
        _,unknown=server.normalize_store({'nombre':'Local','weekly_hours':None},profile)
        self.assertIsNone(unknown['weekly_hours'])

    def test_invalid_public_metadata_rejected(self):
        for fields in ({'weekly_hours':{'1':[['25:00','26:00']]}},{'google':{'rating':7}},
                       {'photos':[{'url':'javascript:alert(1)'}]}):
            with self.assertRaises(ValueError):server.normalize_store({'nombre':'Local',**fields})

class ImportTests(ManualEditorPersistenceTests):
    def test_full_catalog_reimport_updates_and_keeps_details(self):
        products=[{'tienda':'Nueva tienda','nombre':f'Producto {i}','url':f'https://example.com/{i}',
                   'precio_usd':10,'marca':'Marca','descripcion':'Descripción','especificaciones':{'Capacidad':'256 GB'}} for i in range(300)]
        state=server.import_data({'data':{'products':products}})
        self.assertEqual(len(state['products']),300)
        products[0]['precio_usd']=12
        state=server.import_data({'data':{'products':products}})
        self.assertEqual(len(state['products']),300)
        self.assertEqual(state['products'][0]['precio_usd'],12)
        self.assertEqual(state['products'][0]['especificaciones'],{'Capacidad':'256 GB'})
        saved=server.save_product({'product':{**state['products'][0],'descripcion':'Nueva descripción'}})
        self.assertEqual(saved['products'][0]['descripcion'],'Nueva descripción')

    def test_import_failure_does_not_write_partial_catalog(self):
        with self.assertRaises(ValueError):server.import_data({'data':{'products':[
            {'tienda':'DFA','nombre':'Primero'}, {'tienda':'DFA','nombre':'Inválido','precio_usd':'bad'}]}})
        self.assertEqual(server.load_manual_products()['productos'],[])
