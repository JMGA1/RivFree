"""Actualiza USD→BRL/UYU/ARS conservando cada referencia válida por separado."""
import json
import math
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


def fetch_rate(opener=urlopen, quote="BRL"):
    if quote not in {"BRL", "UYU", "ARS"}: raise ValueError("moneda inválida")
    request = Request(API_URL.replace('/BRL', '/'+quote), headers={'User-Agent': 'RivFree/1.0 (+https://jmga1.github.io/RivFree/)','Accept':'application/json'})
    with opener(request, timeout=12) as response:
        data = json.loads(response.read().decode('utf-8'))
    rate = data.get('rate')
    if data.get('base') != 'USD' or data.get('quote') != quote or not isinstance(rate, (int, float)) or not math.isfinite(rate) or isinstance(rate, bool) or not (0 < rate < 1_000_000):
        raise ValueError('respuesta de cotización inválida')
    date = data.get('date')
    if not isinstance(date, str) or len(date) < 10:
        raise ValueError('fecha de cotización inválida')
    from datetime import date as calendar_date
    calendar_date.fromisoformat(date)
    return {'usd_'+quote.lower(): float(rate), 'actualizado': date, 'fuente': 'Frankfurter'}


def update_exchange(path, opener=urlopen):
    path = Path(path)
    previous = read_json(path, {})
    current = dict(previous); rates = dict(previous.get('rates', {})); changed = False
    if 'BRL' not in rates and previous.get('usd_brl'):
        rates['BRL'] = {'rate': previous['usd_brl'], 'date': previous.get('actualizado'), 'source': previous.get('fuente', 'Frankfurter')}
    for quote in ('BRL','UYU','ARS'):
        try:
            value = fetch_rate(opener, quote)
            rates[quote] = {'rate': value['usd_'+quote.lower()], 'date': value['actualizado'], 'source': value['fuente']}
            if quote == 'BRL': current.update(value)
            changed = True
        except Exception as exc:
            print(f'[aviso] USD→{quote}: se conserva la última referencia válida ({type(exc).__name__})')
    if not changed: return previous, False
    current['rates'] = rates; current['base'] = 'USD'
    write_json(path, current)
    return current, True


if __name__ == '__main__':
    target = Path(__file__).resolve().parent.parent / 'data' / 'exchange.json'
    update_exchange(target)
