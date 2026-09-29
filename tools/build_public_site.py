"""Build Pages from an explicit public inventory, excluding symlinks and private files."""
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / '_site'
DATA = ['products.json','meta.json','stores.json','manual-products.json','manual-stores.json',
        'exchange.json','price-history.json','highlights.json','popular.json','site-config.json']

def build():
    if DEST.exists(): shutil.rmtree(DEST)
    DEST.mkdir()
    paths = [p for p in ROOT.iterdir() if p.suffix in {'.html','.css','.js'} or p.name in
             {'manifest.webmanifest','social-card.png','robots.txt','sitemap.xml'}]
    paths += [ROOT/'data'/name for name in DATA]
    for directory in ['icons','assets/manual','data/products','data/price-history']:
        paths += [p for p in (ROOT/directory).rglob('*') if p.is_file()]
    for path in paths:
        rel = path.relative_to(ROOT)
        if any(part.startswith('.') for part in rel.parts): continue
        if rel.parts[0] in {'icons','assets'} and path.suffix.lower() not in {'.png','.jpg','.jpeg','.webp','.gif','.ico','.svg'}: continue
        if rel.parts[0]=='assets' and path.suffix.lower()=='.svg': continue
        if path.is_symlink() or not path.resolve().is_relative_to(ROOT):
            raise ValueError('Private or linked public file: ' + str(rel))
        target = DEST/rel;target.parent.mkdir(parents=True,exist_ok=True)
        shutil.copyfile(path,target)

    subprocess.run(['node', str(ROOT/'tools/build_seo.cjs'), str(DEST)], check=True)

if __name__ == '__main__': build()
