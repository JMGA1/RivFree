"""Versionado del catálogo, salud por tienda e historial de observaciones reales."""
import hashlib
import json
from pathlib import Path


def read_json(path, default):
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return default


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    temporary.replace(path)


def publish(data_dir, output, attempted_stores=None):
    data_dir = Path(data_dir)
    health = read_json(data_dir / 'health.json', {})
    attempted_at = output.get('intento_actualizacion')
    for row in output.get('resumen', []):
        name = row['tienda']
        state = health.setdefault(name, {'fallos_consecutivos': 0, 'ultimo_exito': None})
        if attempted_stores is not None and name in attempted_stores and state.get('ultimo_intento') != attempted_at:
            state['ultimo_intento'] = attempted_at
            state['error'] = row.get('error')
            if row.get('parcial'):
                state['ultimo_parcial'] = attempted_at
                state['estado'] = 'parcial'
            elif row.get('error'):
                state['fallos_consecutivos'] = state['fallos_consecutivos'] + 1
                state['estado'] = 'error'
            else:
                state['fallos_consecutivos'] = 0
                state['ultimo_exito'] = attempted_at
                state['estado'] = 'ok'
        row['ultimo_exito'] = state.get('ultimo_exito')
    write_json(data_dir / 'health.json', health)
    # El historial público sólo registra corridas completamente exitosas.
    # Una actualización parcial puede mezclar datos frescos y cacheados; aunque
    # el resumen distingue ambos, no la tratamos como snapshot histórico para
    # mantener compatibilidad y evitar series engañosas.
    fresh = {
        row['tienda']
        for row in output.get('resumen', [])
        if not row.get('error')
        and not row.get('parcial')
        and not row.get('datos_anteriores')
    }
    if attempted_stores and fresh and attempted_at:
        observations = [
            [p['tienda'], p.get('url'), p.get('nombre'), p.get('precio_usd')]
            for p in output.get('productos', [])
            if p.get('tienda') in fresh
            and not p.get('datos_anteriores')
            and isinstance(p.get('precio_usd'), (int, float))
            and p.get('precio_usd', 0) > 0
            and p.get('url')
        ]
        if observations:
            stamp = attempted_at.replace(':', '-')
            write_json(
                data_dir / 'history' / f'{stamp}.json',
                {'actualizado': attempted_at, 'observaciones': observations},
            )
    # A bounded public series avoids downloading full historical catalogs.
    series = {}
    snapshots = sorted((data_dir / 'history').glob('*.json')) if (data_dir / 'history').exists() else []
    for snapshot in snapshots[-90:]:
        content = read_json(snapshot, {})
        for store, url, name, price in content.get('observaciones', []):
            if isinstance(price, (int,float)) and price > 0 and url:
                series.setdefault(url, []).append([content['actualizado'], price])
    write_json(data_dir / 'price-history.json', series)
    write_json(data_dir / 'products.json', output)
    version = hashlib.sha256((data_dir / 'products.json').read_bytes()).hexdigest()[:20]
    write_json(data_dir / 'meta.json', {'actualizado':output.get('actualizado'),'version':version})


if __name__ == '__main__':
    directory = Path(__file__).resolve().parent.parent / 'data'
    publish(directory, read_json(directory / 'products.json', {}))
