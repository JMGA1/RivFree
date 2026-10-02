import sys, unittest, tempfile, sqlite3, threading, json
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.error import HTTPError
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'database'))
import serve, manage

class LocalDatabaseTest(unittest.TestCase):
    def test_counter_and_private_paths(self):
        with tempfile.TemporaryDirectory() as directory:
            serve.DB=Path(directory)/'test.sqlite'
            with sqlite3.connect(serve.DB) as db:
                db.executescript(manage.SCHEMA)
                db.execute("INSERT INTO stores VALUES('s','Store','{}')")
                db.execute("INSERT INTO products VALUES('p','Product',NULL,NULL,NULL,'{}')")
                db.execute("INSERT INTO offers VALUES('o','p','s','https://example.com/product',10,NULL,NULL,'{}')")
            db.close()
            server=serve.ThreadingHTTPServer(('127.0.0.1',0),serve.Handler)
            worker=threading.Thread(target=server.serve_forever,daemon=True);worker.start()
            base='http://127.0.0.1:'+str(server.server_address[1])
            try:
                for _ in range(2):
                    req=Request(base+'/api/search-selection',data=json.dumps({'url':'https://example.com/product'}).encode(),headers={'Content-Type':'application/json'})
                    self.assertEqual(urlopen(req).status,204)
                ranking=json.load(urlopen(base+'/data/popular.json'))
                self.assertEqual(ranking['items'][0]['searches'],1)
                for path in ['/database/catalog.sqlite','/tools/build_public_site.py']:
                    with self.assertRaises(HTTPError) as error:urlopen(base+path)
                    self.assertEqual(error.exception.code,404)
                with self.assertRaises(HTTPError) as error:
                    urlopen(Request(base+'/api/search-selection',data=b'{"url":"https://example.com/product"}',headers={'Origin':'https://wrong.example'}))
                self.assertEqual(error.exception.code,403)
                self.assertEqual(urlopen(base+'/').status,200,'the shop page still opens')
                for path in ['/data/','/icons/']:
                    with self.assertRaises(HTTPError) as error:urlopen(base+path)
                    self.assertEqual(error.exception.code,404,'no folder listings')
                with self.assertRaises(HTTPError) as error:
                    urlopen(Request(base+'/data/popular.json',headers={'Host':'attacker.example:'+str(server.server_address[1])}))
                self.assertEqual(error.exception.code,421)
            finally:server.shutdown();server.server_close();worker.join()

if __name__=='__main__':unittest.main()
