"""
Corre TODOS los scrapers de tiendas y junta todo en data/products.json,
que es el archivo que lee el sitio web para mostrar y filtrar productos.

Para agregar una tienda nueva:
  1. Copia template_scraper.py, ponele el nombre de la tienda
     (ej: duty_shop_scraper.py) y ajusta los selectores.
  2. Agregalo a la lista SCRAPERS de aca abajo.
Eso es todo, este archivo se encarga del resto.
"""
import json
import argparse
import sys
import traceback
import time
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from publish_data import publish

# --- Lista de tiendas activas ---------------------------------------------
# Cada entrada es (nombre_para_mostrar, modulo_python)
SCRAPERS = [
    ("Barão Free Shop", "barao_scraper"),
    ("DFA", "dfa_scraper"),
    ("Mantra Free Shop", "mantra_scraper"),
    ("Neutral", "neutral_scraper"),
    ("Oprha Free Shop", "oprha_scraper"),
    ("Sineriz", "sineriz_scraper"),
    ("Yury's Free Shop", "yurys_scraper"),
]
CACHE_FILES = {
    "Barão Free Shop": "barao.json",
    "DFA": "dfa.json",
    "Mantra Free Shop": "mantra.json",
    "Neutral": "neutral.json",
    "Oprha Free Shop": "oprha.json",
    "Sineriz": "sineriz.json",
    "Yury's Free Shop": "yurys.json",
}
# ---------------------------------------------------------------------------

DATA_DIR = Path(__file__).parent.parent / "data"


def load_previous_data():
    """Recupera el ultimo catalogo para no borrarlo ante una falla temporal."""
    path = DATA_DIR / "products.json"
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        products = data.get("productos", [])
        return data, products if isinstance(products, list) else []
    except (OSError, json.JSONDecodeError, AttributeError):
        return {}, []


def load_store_caches(interrupted=False):
    """Combina los JSON individuales, incluso si el proceso fue detenido."""
    _, previous = load_previous_data()
    products = []
    summary = []
    for store_name, filename in CACHE_FILES.items():
        path = DATA_DIR / filename
        try:
            with open(path, encoding="utf-8") as f:
                cached = json.load(f)
            if not isinstance(cached, list):
                cached = []
        except (OSError, json.JSONDecodeError):
            cached = []
        if not cached:
            cached = [p for p in previous if p.get("tienda") == store_name]
        products.extend(cached)
        summary.append({
            "tienda": store_name,
            "productos": len(cached),
            "error": "proceso detenido por el usuario" if interrupted else None,
            "datos_anteriores": True,
            "parcial": False,
            "productos_frescos": 0,
            "productos_anteriores": len(cached),
            "precios_observados": 0,
            "precios_recuperados": 0,
            "precios_pendientes": sum(
                not (isinstance(p.get("precio_usd"), (int, float)) and p.get("precio_usd", 0) > 0)
                for p in cached if isinstance(p, dict)
            ),
            "metricas": {"interrumpido": bool(interrupted)},
        })
    return products, summary


def main(selected_store=None):
    previous_data, previous_products = load_previous_data()
    previous_by_store = {}
    for product in previous_products:
        if isinstance(product, dict) and product.get("tienda"):
            previous_by_store.setdefault(product["tienda"], []).append(product)

    all_products = []
    resumen = []
    fresh_store_count = 0
    attempted_at = datetime.now(timezone.utc).isoformat()
    interrupted = False

    for display_name, module_name in SCRAPERS:
        store_key = module_name.removesuffix("_scraper")
        if selected_store and store_key != selected_store:
            fallback = previous_by_store.get(display_name, [])
            all_products.extend(fallback)
            resumen.append({
                "tienda": display_name,
                "productos": len(fallback),
                "error": None,
                "datos_anteriores": True,
                "productos_frescos": 0,
                "productos_anteriores": len(fallback),
                "precios_observados": 0,
                "precios_recuperados": 0,
                "precios_pendientes": sum(p.get("precio_usd") is None for p in fallback if isinstance(p, dict)),
            })
            continue
        print(f"\n=== Procesando {display_name} ===")
        started = time.monotonic()
        try:
            module = __import__(module_name)
            productos = module.run()
            if not productos:
                raise RuntimeError("el scraper no encontro productos")
            elapsed = round(time.monotonic() - started, 1)
            all_products.extend(productos)
            fresh_store_count += 1
            status = getattr(module, "LAST_RUN_STATUS", {}) or {}
            warning = status.get("warning") if status.get("partial") else None
            metrics = dict(status.get("metrics", {}) or {})
            # Normalizar las métricas DESPUÉS de finalize_scrape(). Esa función
            # puede haber agregado filas del cache al resultado parcial.
            cached_count = sum(
                bool(p.get("datos_anteriores")) for p in productos if isinstance(p, dict)
            )
            observed_prices = sum(
                isinstance(p.get("precio_usd"), (int, float))
                and p.get("precio_usd", 0) > 0
                and not p.get("datos_anteriores")
                for p in productos if isinstance(p, dict)
            )
            pending_prices = sum(
                not (isinstance(p.get("precio_usd"), (int, float)) and p.get("precio_usd", 0) > 0)
                for p in productos if isinstance(p, dict)
            )
            metrics.update({
                "productos_total": len(productos),
                "productos_anteriores": cached_count,
                "productos_frescos": max(0, len(productos) - cached_count),
                "precios_observados": observed_prices,
                "precios_pendientes": pending_prices,
            })
            row = {
                "tienda": display_name,
                "productos": len(productos),
                "error": warning,
                # datos_anteriores ahora significa que el resultado contiene
                # al menos parte del cache, no que toda la tienda sea vieja.
                "datos_anteriores": cached_count > 0,
                "parcial": bool(warning),
                "duracion_segundos": elapsed,
                "productos_frescos": metrics["productos_frescos"],
                "productos_anteriores": cached_count,
                "precios_observados": observed_prices,
                "precios_recuperados": int(metrics.get("precios_recuperados") or 0),
                "precios_pendientes": pending_prices,
                "metricas": metrics,
            }
            resumen.append(row)
            print(f"[{display_name}] terminado en {elapsed:.1f}s" + (" (parcial)" if warning else ""))
        except KeyboardInterrupt:
            print("\n[AVISO] Proceso detenido. Reconstruyendo products.json con los datos guardados...")
            interrupted = True
            break
        except Exception as e:
            elapsed = round(time.monotonic() - started, 1)
            print(f"[ERROR] Fallo el scraper de {display_name} tras {elapsed:.1f}s: {e}", file=sys.stderr)
            traceback.print_exc()
            fallback = previous_by_store.get(display_name, [])
            all_products.extend(fallback)
            resumen.append({
                "tienda": display_name,
                "productos": len(fallback),
                "error": str(e),
                "datos_anteriores": bool(fallback),
                "parcial": False,
                "duracion_segundos": elapsed,
                "productos_frescos": 0,
                "productos_anteriores": len(fallback),
                "precios_observados": 0,
                "precios_recuperados": 0,
                "precios_pendientes": sum(p.get("precio_usd") is None for p in fallback if isinstance(p, dict)),
                "metricas": {"fallo_total": True},
            })

    if interrupted:
        all_products, resumen = load_store_caches(interrupted=True)
        fresh_store_count = 0
    elif not all_products and previous_products:
        all_products = previous_products

    output = {
        "actualizado": attempted_at if fresh_store_count else previous_data.get("actualizado"),
        "intento_actualizacion": attempted_at,
        "resumen": resumen,
        "productos": all_products,
    }

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    out_path = DATA_DIR / "products.json"
    attempted_stores = {name for name, module in SCRAPERS if not selected_store or module == selected_store + '_scraper'}
    if interrupted:
        attempted_stores = set()  # An interruption is not a completed attempt.
    publish(DATA_DIR, output, attempted_stores)

    print(f"\n=== LISTO ===")
    print(f"Total productos: {len(all_products)}")
    for r in resumen:
        if r["error"] is None:
            estado = "OK"
        elif r.get("parcial"):
            estado = f"PARCIAL: {r['error']}"
        elif r["datos_anteriores"]:
            estado = f"ERROR, se conservan datos anteriores: {r['error']}"
        else:
            estado = f"ERROR: {r['error']}"
        print(f"  - {r['tienda']}: {r['productos']} productos ({estado})")
        if any(k in r for k in ("productos_frescos", "productos_anteriores", "precios_observados", "precios_recuperados", "precios_pendientes")):
            print(
                "      frescos={frescos} cache={cache} precios_listado={obs} "
                "precios_recuperados={rec} pendientes={pend}".format(
                    frescos=r.get("productos_frescos", 0),
                    cache=r.get("productos_anteriores", 0),
                    obs=r.get("precios_observados", 0),
                    rec=r.get("precios_recuperados", 0),
                    pend=r.get("precios_pendientes", 0),
                )
            )
    print(f"Guardado en: {out_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Actualiza el catalogo de freeshops")
    parser.add_argument(
        "--store",
        choices=[module.removesuffix("_scraper") for _, module in SCRAPERS],
        help="actualiza solo una tienda y conserva las demas (ej.: barao)",
    )
    args = parser.parse_args()
    main(args.store)
