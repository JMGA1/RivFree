"""Actualiza la referencia USD→BRL sin romper el último valor válido."""
import json
from pathlib import Path
from urllib.request import Request, urlopen

API_URL = 'https://api.frankfurter.dev/v2/rate/USD/BRL'


def read_json(path, default):
    try:
        return json.loads(Path(path).read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return default


def write_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + '.tmp')
    tmp.write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    tmp.replace(path)


def fetch_rate(opener=urlopen):
    request = Request(API_URL, headers={'User-Agent': 'RivFree/1.0 (+https://jmga1.github.io/RivFree/)','Accept':'application/json'})
    with opener(request, timeout=12) as response:
        data = json.loads(response.read().decode('utf-8'))
    rate = data.get('rate')
    if data.get('base') != 'USD' or data.get('quote') != 'BRL' or not isinstance(rate, (int, float)) or not (0 < rate < 1000):
        raise ValueError('respuesta de cotización inválida')
    date = data.get('date')
    if not isinstance(date, str) or len(date) < 10:
        raise ValueError('fecha de cotización inválida')
    return {'usd_brl': float(rate), 'actualizado': date, 'fuente': 'Frankfurter'}


def update_exchange(path, opener=urlopen):
    path = Path(path)
    previous = read_json(path, {})
    try:
        current = fetch_rate(opener)
    except Exception as exc:  # La cotización nunca debe romper la publicación.
        print(f'[aviso] no se pudo actualizar cotización USD→BRL: {exc}')
        return previous, False
    write_json(path, current)
    print(f"[cotización] USD 1 = BRL {current['usd_brl']:.4f} ({current['actualizado']})")
    return current, True


if __name__ == '__main__':
    target = Path(__file__).resolve().parent.parent / 'data' / 'exchange.json'
    update_exchange(target)
