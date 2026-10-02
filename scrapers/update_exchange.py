"""Actualiza USD→BRL/UYU/ARS conservando cada referencia válida por separado."""
import json
import math
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

RATES_URL = 'https://api.frankfurter.dev/v2/rates?base=USD&quotes=BRL,UYU,ARS'
API_URL = 'https://api.frankfurter.dev/v2/rate/USD/BRL'  # one currency at a time, only as a fallback
QUOTES = ('BRL', 'UYU', 'ARS')


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


def fetch_rates(opener=urlopen):
    """All three rates in one call: /v2/rates gives the freshest blended rate of the day.
    (The single-pair /v2/rate/USD/X endpoint has returned rates months old for BRL and ARS.)"""
    request = Request(RATES_URL, headers={'User-Agent': 'RivFree/1.0 (+https://jmga1.github.io/RivFree/)', 'Accept': 'application/json'})
    with opener(request, timeout=12) as response:
        data = json.loads(response.read().decode('utf-8'))
    if not isinstance(data, list):
        raise ValueError('respuesta de cotización inválida')
    from datetime import date as calendar_date
    rates = {}
    for item in data:
        if not isinstance(item, dict) or item.get('base') != 'USD' or item.get('quote') not in QUOTES:
            continue
        rate, day = item.get('rate'), item.get('date')
        if isinstance(rate, bool) or not isinstance(rate, (int, float)) or not math.isfinite(rate) or not (0 < rate < 1_000_000):
            continue
        if not isinstance(day, str) or len(day) != 10:
            continue
        try:
            calendar_date.fromisoformat(day)
        except ValueError:
            continue
        rates[item['quote']] = {'rate': float(rate), 'date': day, 'source': 'Frankfurter'}
    if not rates:
        raise ValueError('respuesta de cotización sin monedas válidas')
    return rates


def update_exchange(path, opener=urlopen):
    path = Path(path)
    previous = read_json(path, {})
    current = dict(previous); rates = dict(previous.get('rates', {})); changed = False
    if 'BRL' not in rates and previous.get('usd_brl'):
        rates['BRL'] = {'rate': previous['usd_brl'], 'date': previous.get('actualizado'), 'source': previous.get('fuente', 'Frankfurter')}
    try:
        fresh = fetch_rates(opener)
    except Exception as exc:
        print(f'[aviso] Frankfurter /v2/rates no respondió bien ({type(exc).__name__}); se prueba moneda por moneda')
        fresh = {}
    for quote in QUOTES:
        if quote in fresh:
            continue
        try:
            value = fetch_rate(opener, quote)
            fresh[quote] = {'rate': value['usd_' + quote.lower()], 'date': value['actualizado'], 'source': value['fuente']}
        except Exception as exc:
            print(f'[aviso] USD→{quote}: se conserva la última referencia válida ({type(exc).__name__})')
    checked = datetime.now(timezone.utc).isoformat(timespec='seconds')
    for quote, entry in fresh.items():
        old = rates.get(quote) or {}
        # Never go back in time: an older answer keeps the newer rate already saved.
        if isinstance(old.get('date'), str) and entry['date'] < old['date']:
            print(f"[aviso] USD→{quote}: Frankfurter devolvió el {entry['date']}, más viejo que el guardado ({old['date']}); se conserva")
            continue
        rates[quote] = {**entry, 'checked': checked}
        changed = True
    if not changed: return previous, False
    current['rates'] = rates; current['base'] = 'USD'; current['consultado'] = checked
    if 'BRL' in rates:
        current.update(usd_brl=rates['BRL']['rate'], actualizado=rates['BRL']['date'], fuente=rates['BRL'].get('source', 'Frankfurter'))
    write_json(path, current)
    return current, True


if __name__ == '__main__':
    target = Path(__file__).resolve().parent.parent / 'data' / 'exchange.json'
    update_exchange(target)
