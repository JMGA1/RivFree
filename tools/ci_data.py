"""Trust boundary: a scraper artifact may replace only bounded, valid JSON data."""
import argparse
import json
from pathlib import Path

FILES = {'products.json', 'meta.json', 'exchange.json', 'price-history.json',
         'health.json', 'popular.json', 'catalog-first-seen.json'}
DIRECTORIES = {'products', 'history', 'price-history'}


def import_data(source, destination=Path('data'), health_only=False):
    source, destination = Path(source), Path(destination)
    pending = []
    total = 0
    for path in source.rglob('*'):
        if path.is_symlink():
            raise ValueError('Artifact contains a symbolic link')
        if not path.is_file():
            continue
        rel = path.relative_to(source)
        if health_only and rel.as_posix() != 'health.json':
            continue
        if not ((len(rel.parts) == 1 and rel.name in FILES) or
                (len(rel.parts) == 2 and rel.parts[0] in DIRECTORIES and rel.suffix == '.json'
                 and not rel.name.startswith('.'))):
            raise ValueError('Unexpected artifact path: ' + str(rel))
        size = path.stat().st_size
        total += size
        if size > 64*1024*1024 or total > 512*1024*1024 or len(pending) >= 2000:
            raise ValueError('Artifact too large')
        raw = path.read_bytes()
        value = json.loads(raw, parse_constant=lambda value: (_ for _ in ()).throw(ValueError('Non-finite JSON number')))
        if rel.as_posix()=='health.json':
            if not isinstance(value,dict) or len(value)>100: raise ValueError('Invalid health report')
            for name,state in value.items():
                if len(name)>120 or not isinstance(state,dict): raise ValueError('Invalid health record')
                for field in ['fallos_consecutivos','parciales_consecutivos']:
                    count=state.get(field,0)
                    if not isinstance(count,int) or isinstance(count,bool) or not 0<=count<=100000: raise ValueError('Invalid failure count')
                if any(not isinstance(v,(str,int,float,bool,type(None))) or (isinstance(v,str) and len(v)>4000) for v in state.values()): raise ValueError('Invalid health value')
        if not isinstance(value, (dict, list)):
            raise ValueError('Invalid JSON document')
        if rel.as_posix() == 'products.json' and not isinstance(value.get('productos') if isinstance(value,dict) else None,list):
            raise ValueError('Missing products')
        pending.append((rel, raw))
    required = {'health.json'} if health_only else FILES
    if not required.issubset({str(p) for p,_ in pending}):
        raise ValueError('Incomplete artifact')
    for rel, raw in pending:
        target = destination / rel
        if target.is_symlink() or any(p.is_symlink() for p in target.parents):
            raise ValueError('Unsafe destination')
    for rel, raw in pending:
        target = destination / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(raw)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('source')
    parser.add_argument('--health-only', action='store_true')
    args = parser.parse_args()
    import_data(args.source, health_only=args.health_only)
