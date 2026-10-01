"""Local preview with SQLite popularity counters. Not a production web server."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from datetime import datetime, timezone
import json, sqlite3, time
from contextlib import contextmanager
from urllib.parse import urlsplit
from manage import ROOT

DB=ROOT/'database/catalog.sqlite'
@contextmanager
def connection():
    db=sqlite3.connect(DB)
    try:
        with db:yield db
    finally:db.close()
class Handler(SimpleHTTPRequestHandler):
    recent={}
    def __init__(self,*a,**kw): super().__init__(*a,directory=str(ROOT),**kw)
    def log_message(self,*args): pass  # No query or IP logs.
    def reply(self,code,value,kind='application/json'):
        data=value.encode() if isinstance(value,str) else json.dumps(value).encode()
        self.send_response(code);self.send_header('Content-Type',kind);self.send_header('Cache-Control','no-store');self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)
    def do_GET(self):
        path=urlsplit(self.path).path
        if path=='/search-api-config.js':return self.reply(200,"window.RIVFREE_SEARCH_API='/api/search-selection';",'text/javascript')
        if path=='/data/popular.json':
            with connection() as db:
                rows=db.execute("SELECT o.url,sum(d.count) FROM daily_searches d JOIN offers o ON o.product_id=d.product_id WHERE d.day>=date('now','-30 days') GROUP BY o.url ORDER BY sum(d.count) DESC LIMIT 100")
                return self.reply(200,{'updatedAt':datetime.now(timezone.utc).isoformat(),'items':[{'url':u,'searches':n,'views':n} for u,n in rows]})
        resolved=Path(self.translate_path(self.path)).resolve()
        # Never expose the database, tooling or private files through HTTP.
        if not resolved.is_relative_to(ROOT) or any(p.startswith('.') for p in resolved.relative_to(ROOT).parts) or any(p in {'database','tools','scrapers','tests'} for p in resolved.relative_to(ROOT).parts):return self.reply(404,{})
        return super().do_GET()
    def do_POST(self):
        if self.path!='/api/search-selection':return self.reply(404,{})
        if self.headers.get('Origin') not in (None,'http://127.0.0.1:8880','http://localhost:8880'):return self.reply(403,{})
        try:
            length=int(self.headers.get('Content-Length',0))
            if not 0<length<=4096:return self.reply(413,{})
            value=json.loads(self.rfile.read(length));url=value.get('url')
            if not isinstance(url,str):return self.reply(400,{})
            now=time.monotonic();key=(self.client_address[0],url)
            type(self).recent={k:t for k,t in self.recent.items() if now-t<60}
            if key in self.recent:return self.reply(204,'')
            with connection() as db:
                row=db.execute('SELECT product_id FROM offers WHERE url=? LIMIT 1',(url,)).fetchone()
                if not row:return self.reply(404,{})
                db.execute("INSERT INTO daily_searches VALUES(date('now'),?,1) ON CONFLICT(day,product_id) DO UPDATE SET count=count+1",row)
            type(self).recent[key]=now
            return self.reply(204,'')
        except (ValueError,TypeError):return self.reply(400,{})
if __name__=='__main__':
    if not DB.exists():raise SystemExit('Run python database/manage.py import first.')
    print('RivFree: http://127.0.0.1:8880',flush=True)
    ThreadingHTTPServer(('127.0.0.1',8880),Handler).serve_forever()
