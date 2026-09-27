"""Observed price changes and stable first-seen dates; never infer a discount from MSRP."""
from datetime import datetime, timezone, timedelta
import math


def date(value):
    try:
        parsed = datetime.fromisoformat(str(value).replace('Z', '+00:00'))
        return parsed.replace(tzinfo=timezone.utc) if parsed.tzinfo is None else parsed
    except (ValueError, TypeError): return None


def identity(product):
    return str(product.get('tienda', '')) + '|' + str(product.get('url') or product.get('id') or product.get('nombre', ''))


def price_drop(points, price, observed, days=30):
    end=date(observed)
    if not end or not isinstance(price,(int,float)) or not math.isfinite(price) or price<=0:return None
    valid=sorted((date(t),p) for t,p in points if date(t) and isinstance(p,(int,float)) and math.isfinite(p) and p>0 and end-timedelta(days=days)<=date(t)<=end)
    if len(valid)<2 or valid[-1][1]!=price or (end-valid[-1][0]).total_seconds()>86400:return None
    baseline=valid[0]
    if (valid[-1][0]-baseline[0]).total_seconds()<86400 or baseline[1]<=price:return None
    return {'porcentaje':round((baseline[1]-price)/baseline[1]*100,1),'precio_anterior':baseline[1],
            'desde':baseline[0].isoformat(),'hasta':valid[-1][0].isoformat(),'ventana_dias':days}


def enrich(output, previous, first_seen, observations):
    stamp=output.get('intento_actualizacion') or output.get('actualizado')
    prior={identity(p):p for p in previous.get('productos',[])}
    states={r['tienda']:r for r in output.get('resumen',[])}
    for product in output.get('productos',[]):
        key=identity(product);points=observations.get(key,[])
        if key not in first_seen:
            historical=[t for t,p in points if date(t)]
            old=prior.get(key,{})
            first_seen[key]=old.get('primera_deteccion') or (min(historical,key=date) if historical else None) or (previous.get('actualizado') if old else stamp)
        product['primera_deteccion']=first_seen[key]
        product.pop('caida_precio',None)
        status=states.get(product.get('tienda'),{})
        if not product.get('datos_anteriores') and not any(status.get(k) for k in ['error','parcial','datos_anteriores']):
            drop=price_drop(points,product.get('precio_usd'),stamp)
            if drop:product['caida_precio']=drop
    return first_seen
