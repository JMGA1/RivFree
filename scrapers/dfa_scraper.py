"""Scraper resiliente del catálogo general de DFA Uruguay (WooCommerce).

DFA puede tener cientos de páginas y algunas responden muy lento. El scraper:
- usa timeouts/reintentos más amplios que el resto de tiendas;
- descarga páginas en paralelo con un número conservador de workers;
- no descarta todo el catálogo porque fallen unas pocas páginas;
- mezcla productos del último cache para cubrir páginas puntualmente fallidas;
- rechaza una actualización solo si la cobertura fresca es claramente insuficiente.
"""
from concurrent.futures import ThreadPoolExecutor, as_completed
import json
import math
import re
import sys
import time
from pathlib import Path

sys.path.append(str(Path(__file__).parent))
from utils import finalize_scrape, load_previous_store, navigate, discover_menu_categories, get_soup, clean_price, save_products, POLITE_DELAY

BASE_URL = "https://www.dfauy.com"
PRODUCTS_PER_PAGE = 30
HARD_SAFETY_CAP = 1000
MAX_WORKERS = 4
PAGE_TIMEOUT = 30
FIRST_PAGE_TIMEOUT = 60
MIN_FRESH_COVERAGE = 0.80
WARN_COVERAGE = 0.95

# run_all.py consulta este estado para marcar una actualización parcial sin
# tirar abajo todo el scraper de la tienda.
LAST_RUN_STATUS = {}


def _load_previous():
    return load_previous_store("dfa", Path(__file__).parent.parent / "data")


def _total_pages(soup):
    text = soup.get_text(" ", strip=True)
    m = re.search(r"(?:of|de)\s+([\d.,]+)\s+(?:resultados|results)", text, re.I)
    total = int(re.sub(r"[.,]", "", m.group(1))) if m else None

    pages = []
    for a in soup.select("a.page-numbers"):
        t = a.get_text(strip=True)
        if t.isdigit():
            pages.append(int(t))

    page_size = len(soup.select("ul.products li.product")) or PRODUCTS_PER_PAGE
    calculated = math.ceil(total / page_size) if total else 1
    return max([calculated, *pages], default=1), total


def _category_from_item(item):
    classes = item.get("class", [])
    cats = [c[len("product_cat_"):] for c in classes if c.startswith("product_cat_")]
    return cats[0] if cats else "varios"


def _extract_page(soup):
    products = []
    for item in soup.select("ul.products li.product"):
        link_tag = item.select_one("a.woocommerce-loop-product__link") or item.select_one("a[href]")
        title_tag = item.select_one(
            "h2.woocommerce-loop-product__title, h3.woocommerce-loop-product__title, "
            ".woocommerce-loop-product__title"
        )
        price_tag = item.select_one("span.price")
        img_tag = item.select_one("img")
        name = title_tag.get_text(" ", strip=True) if title_tag else None
        if not name and link_tag:
            name = link_tag.get("aria-label") or link_tag.get_text(" ", strip=True)
        if not name:
            continue

        current = original = None
        if price_tag:
            sale = price_tag.select_one("ins")
            old = price_tag.select_one("del")
            if sale:
                current = clean_price(sale.get_text(" ", strip=True))
                original = clean_price(old.get_text(" ", strip=True)) if old else None
            else:
                current = clean_price(price_tag.get_text(" ", strip=True))

        image = None
        if img_tag:
            image = img_tag.get("data-src") or img_tag.get("data-lazy-src") or img_tag.get("src")

        products.append({
            "tienda": "DFA",
            "nombre": name,
            "precio_usd": current,
            "precio_original_usd": original if original and current and original > current else None,
            "en_oferta": bool(original and current and original > current),
            "categoria": _category_from_item(item),
            "url": link_tag.get("href") if link_tag else None,
            "imagen": image,
        })
    return products


def _fetch_page(page_no, first=None):
    if page_no == 1 and first is not None:
        soup = first
    else:
        # Pequeño desfase para no disparar todos los requests en el mismo ms.
        time.sleep((page_no % MAX_WORKERS) * POLITE_DELAY / MAX_WORKERS)
        soup = get_soup(
            f"{BASE_URL}/shop/page/{page_no}/",
            retries=3,
            delay=2,
            timeout=PAGE_TIMEOUT,
        )
    if soup is None:
        return page_no, [], "sin respuesta"
    products = _extract_page(soup)
    if not products:
        return page_no, [], "página vacía"
    return page_no, products, None


def _dedupe(products):
    seen = set()
    unique = []
    for product in products:
        key = product.get("url") or product.get("nombre")
        if key and key not in seen:
            seen.add(key)
            unique.append(product)
    return unique


def _merge_with_previous(fresh, previous):
    """Conserva items viejos solo cuando no fueron observados en páginas frescas."""
    merged = {p.get("url") or p.get("nombre"): dict(p, datos_anteriores=True) for p in previous if isinstance(p, dict)}
    for product in fresh:
        merged[product.get("url") or product.get("nombre")] = product
    return [p for key, p in merged.items() if key]


def run():
    global LAST_RUN_STATUS
    LAST_RUN_STATUS = {}

    first = get_soup(
        f"{BASE_URL}/shop/",
        retries=5,
        delay=4,
        timeout=FIRST_PAGE_TIMEOUT,
    )
    if first is None:
        raise RuntimeError("DFA no respondió en /shop/ después de reintentos extendidos")

    total_pages, total_products = _total_pages(first)
    if total_pages > HARD_SAFETY_CAP:
        raise RuntimeError(f"DFA informó {total_pages} páginas; supera el límite de seguridad")

    print(f"[DFA] catálogo general: {total_products or '?'} productos, {total_pages} páginas")

    page_products = {}
    failures = {}

    # La primera página ya está descargada. El resto se obtiene concurrentemente.
    page_no, found, error = _fetch_page(1, first)
    if error:
        failures[page_no] = error
    else:
        page_products[page_no] = found

    with ThreadPoolExecutor(max_workers=MAX_WORKERS, thread_name_prefix="dfa") as executor:
        futures = {executor.submit(_fetch_page, n): n for n in range(2, total_pages + 1)}
        completed = 1
        for future in as_completed(futures):
            page_no = futures[future]
            try:
                _, found, error = future.result()
            except Exception as exc:  # protección extra: un worker no tumba el resto
                found, error = [], str(exc)
            if error:
                failures[page_no] = error
                print(f"[DFA] [aviso] página {page_no}/{total_pages}: {error}")
            else:
                page_products[page_no] = found
            completed += 1
            if completed % 25 == 0 or completed == total_pages:
                count = sum(len(v) for v in page_products.values())
                print(
                    f"[DFA] progreso {completed}/{total_pages}: "
                    f"{count} productos, {len(failures)} páginas fallidas"
                )

    fresh = _dedupe(
        product
        for page_no in sorted(page_products)
        for product in page_products[page_no]
    )
    previous = _load_previous()

    if total_products:
        coverage = len(fresh) / total_products
        if coverage < MIN_FRESH_COVERAGE:
            raise RuntimeError(
                f"DFA incompleto: solo {len(fresh)}/{total_products} productos frescos "
                f"({coverage:.1%}); se conserva el catálogo anterior"
            )
    else:
        coverage = 1 - (len(failures) / max(total_pages, 1))
        if coverage < MIN_FRESH_COVERAGE:
            raise RuntimeError(
                f"DFA incompleto: fallaron {len(failures)}/{total_pages} páginas; "
                "se conserva el catálogo anterior"
            )

    partial = bool(failures) or (total_products is not None and coverage < WARN_COVERAGE)
    products = _merge_with_previous(fresh, previous) if partial else fresh

    if partial:
        warning = (
            f"DFA parcial: {len(fresh)} productos frescos, "
            f"{len(failures)}/{total_pages} páginas fallidas; "
            f"se completó con {max(0, len(products) - len(fresh))} registros del cache anterior"
        )
        print(f"[DFA] [aviso] {warning}")
        LAST_RUN_STATUS = {
            "partial": True,
            "warning": warning,
            "failed_pages": sorted(failures),
            "fresh_products": len(fresh),
        }
    else:
        LAST_RUN_STATUS = {"partial": False, "fresh_products": len(fresh)}

    finalize_scrape(products, "dfa", Path(__file__).parent.parent / "data", LAST_RUN_STATUS)
    return products


if __name__ == "__main__":
    run()
