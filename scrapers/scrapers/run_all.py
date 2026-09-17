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
from publish_data import publish
from datetime import datetime, timezone
from pathlib import Path

sys.path.append(str(Path(__file__).parent))

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
        products.extend(cached)
        summary.append({
            "tienda": store_name,
            "productos": len(cached),
            "error": "proceso detenido por el usuario" if interrupted else None,
            "datos_anteriores": True,
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
            resumen.append({
                "tienda": display_name,
                "productos": len(productos),
                "error": warning,
                # Conservador: si el scraper mezcló cache para cubrir fallos
                # puntuales, la UI lo marca como actualización parcial y no
                # genera una observación histórica como si todo fuera fresco.
                "datos_anteriores": bool(warning),
                "parcial": bool(warning),
                "duracion_segundos": elapsed,
            })
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
