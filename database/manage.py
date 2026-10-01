"""Local structured catalog. No external packages. Run from any directory."""
import argparse, json, sqlite3, hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCHEMA = '''
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS stores(id TEXT PRIMARY KEY, name TEXT NOT NULL, profile_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS products(id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT, brand TEXT, description TEXT, specs_json TEXT);
CREATE TABLE IF NOT EXISTS offers(id TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id), store_id TEXT NOT NULL REFERENCES stores(id), url TEXT NOT NULL, price_usd REAL CHECK(price_usd IS NULL OR price_usd>=0), image TEXT, first_seen TEXT, payload_json TEXT NOT NULL, UNIQUE(store_id,url));
CREATE INDEX IF NOT EXISTS offers_product ON offers(product_id);
CREATE INDEX IF NOT EXISTS offers_store_price ON offers(store_id,price_usd);
CREATE INDEX IF NOT EXISTS products_name ON products(name);
CREATE TABLE IF NOT EXISTS daily_searches(day TEXT NOT NULL, product_id TEXT NOT NULL REFERENCES products(id), count INTEGER NOT NULL CHECK(count>=0), PRIMARY KEY(day,product_id));
'''
def identifier(value): return hashlib.sha256(value.encode()).hexdigest()[:32]
def main():
    ap=argparse.ArgumentParser();ap.add_argument('command',choices=['import','export','ranking']);ap.add_argument('--db',default=str(ROOT/'database/catalog.sqlite'));ap.add_argument('--output');args=ap.parse_args()
    db=sqlite3.connect(args.db);db.executescript(SCHEMA)
    if args.command=='import':
        stores=json.loads((ROOT/'data/stores.json').read_text(encoding='utf-8'))
        products=json.loads((ROOT/'data/products.json').read_text(encoding='utf-8'))['productos']
        with db:
            for name,info in stores.items(): db.execute('INSERT INTO stores VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,profile_json=excluded.profile_json',(name,info.get('nombre_completo',name),json.dumps(info,ensure_ascii=False)))
            for p in products:
                name=p.get('tienda','');url=p.get('url','');pid=identifier(name+'|'+url)
                # Keep variants distinct; cross-store matching remains the existing reviewed JS engine.
                db.execute('INSERT OR IGNORE INTO stores VALUES(?,?,?)',(name,name,'{}'))
                db.execute('INSERT INTO products VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,category=excluded.category',(pid,p.get('nombre',''),p.get('categoria'),p.get('marca'),p.get('descripcion'),json.dumps(p.get('especificaciones',{}),ensure_ascii=False)))
                db.execute('INSERT INTO offers VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET price_usd=excluded.price_usd,image=excluded.image,payload_json=excluded.payload_json',(pid,pid,name,url,p.get('precio_usd'),p.get('imagen'),p.get('primera_deteccion'),json.dumps(p,ensure_ascii=False)))
        print(dict(db.execute("SELECT 'offers',count(*) FROM offers UNION ALL SELECT 'stores',count(*) FROM stores")))
    elif args.command=='export':
        if not args.output: ap.error('--output required (use a staging directory)')
        target=Path(args.output);target.mkdir(parents=True,exist_ok=True)
        products=[]
        for name,category,brand,description,specs,price,payload in db.execute('SELECT p.name,p.category,p.brand,p.description,p.specs_json,o.price_usd,o.payload_json FROM offers o JOIN products p ON p.id=o.product_id'):
            p=json.loads(payload);p.update(nombre=name,categoria=category,marca=brand,descripcion=description,especificaciones=json.loads(specs or '{}'),precio_usd=price);products.append(p)
        original=json.loads((ROOT/'data/products.json').read_text(encoding='utf-8'));original['productos']=products
        (target/'products.json').write_text(json.dumps(original,ensure_ascii=False),encoding='utf-8')
        (target/'stores.json').write_text(json.dumps({k:json.loads(v) for k,v in db.execute('SELECT id,profile_json FROM stores')},ensure_ascii=False,indent=2),encoding='utf-8')
        print('Exported to',target)
    else:
        if not args.output: ap.error('--output required')
        from datetime import datetime,timezone
        rows=db.execute("SELECT o.url,sum(d.count) FROM daily_searches d JOIN offers o ON o.product_id=d.product_id WHERE d.day>=date('now','-30 days') GROUP BY o.url ORDER BY sum(d.count) DESC LIMIT 100")
        Path(args.output).write_text(json.dumps({'updatedAt':datetime.now(timezone.utc).isoformat(),'items':[{'url':url,'views':count,'searches':count} for url,count in rows]},ensure_ascii=False),encoding='utf-8')
    assert db.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
    assert not db.execute('PRAGMA foreign_key_check').fetchall()
    db.close()
if __name__=='__main__': main()
