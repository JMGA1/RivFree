
from concurrent.futures import ThreadPoolExecutor, as_completed
import math
import re
import sys
import time
from pathlib import Path

sys.path.append(str(Path(__file__).parent))
from utils import (
    POLITE_DELAY,
    catalog_metrics,
    clean_price,
    dedupe_products_prefer_complete,
    finalize_scrape,
    get_soup,
    load_previous_store,
)

BASE_URL = "https://www.dfauy.com"
PRODUCTS_PER_PAGE = 30
HARD_SAFETY_CAP = 1000
MAX_WORKERS = 4
PAGE_TIMEOUT = 35
FIRST_PAGE_TIMEOUT = 45
MIN_FRESH_COVERAGE = 0.80
WARN_COVERAGE = 0.95
LAST_RUN_STATUS = {}

# Categorías principales actuales. Se usan como fallback explícito porque
# /shop/ no es confiable y recorrer todas las subcategorías generaría duplicados.
TOP_CATEGORIES = {
    "bazar": "bazar",
    "bebidas-varias": "bebidas",
    "comestibles": "comestibles",
    "electronica": "electronica",
    "jugueteria": "jugueteria",
    "optica": "optica",
    "perfumeria": "perfumeria",
    "relojeria": "relojeria",
    "articulos-deportivos": "articulos-deportivos",
    "varios-500": "varios",
}


def _load_previous():
    return load_previous_store("dfa", Path(__file__).parent.parent / "data")


def _total_pages(soup):
    text = soup.get_text(" ", strip=True)
    # WooCommerce suele mostrar "Mostrando ... de 15.423 resultados".
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


def _category_from_item(item, fallback="varios"):
    classes = item.get("class", [])
    cats = [c[len("product_cat_"):] for c in classes if c.startswith("product_cat_")]
    return cats[0] if cats else fallback


def _extract_page(soup, fallback_category="varios"):
    products = []
    for item in soup.select("ul.products li.product"):
        link_tag = item.select_one("a.woocommerce-loop-product__link") or item.select_one("a[href]")
        title_tag = item.select_one("h2.woocommerce-loop-product__title, h3.woocommerce-loop-product__title, .woocommerce-loop-product__title")
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
            "categoria": _category_from_item(item, fallback_category),
            "url": link_tag.get("href") if link_tag else None,
            "imagen": image,
        })
    return products


def _fetch_page(url, page_no, category, first=None):
    if first is not None:
        soup = first
    else:
        time.sleep((page_no % MAX_WORKERS) * POLITE_DELAY / MAX_WORKERS)
        soup = get_soup(url, retries=3, delay=2, timeout=PAGE_TIMEOUT)
    if soup is None:
        return page_no, [], "sin respuesta"
    products = _extract_page(soup, category)
    if not products:
        return page_no, [], "página vacía"
    return page_no, products, None


def _scrape_sequence(first_soup, total_pages, category, url_for_page):
    page_products = {}
    failures = {}
    pno, found, error = _fetch_page(url_for_page(1), 1, category, first_soup)
    if error:
        failures[pno] = error
    else:
        page_products[pno] = found

    with ThreadPoolExecutor(max_workers=MAX_WORKERS, thread_name_prefix="dfa") as executor:
        futures = {executor.submit(_fetch_page, url_for_page(n), n, category): n for n in range(2, total_pages + 1)}
        completed = 1
        for future in as_completed(futures):
            page_no = futures[future]
            try:
                _, found, error = future.result()
            except Exception as exc:
                found, error = [], str(exc)
            if error:
                failures[page_no] = error
                print(f"[DFA] [aviso] {category} página {page_no}/{total_pages}: {error}")
            else:
                page_products[page_no] = found
            completed += 1
            if completed % 25 == 0 or completed == total_pages:
                print(f"[DFA] {category}: {completed}/{total_pages}, {sum(len(v) for v in page_products.values())} observaciones, {len(failures)} fallas")

    fresh = dedupe_products_prefer_complete(
        p for n in sorted(page_products) for p in page_products[n]
    )
    return fresh, failures


def _try_shop():
    first = get_soup(f"{BASE_URL}/shop/", retries=2, delay=3, timeout=FIRST_PAGE_TIMEOUT)
    if first is None:
        return None
    total_pages, total_products = _total_pages(first)
    if total_pages > HARD_SAFETY_CAP:
        raise RuntimeError(f"DFA /shop informó {total_pages} páginas; supera límite")
    print(f"[DFA] /shop respondió: {total_products or '?'} productos, {total_pages} páginas")
    fresh, failures = _scrape_sequence(
        first,
        total_pages,
        "catalogo-general",
        lambda n: f"{BASE_URL}/shop/" if n == 1 else f"{BASE_URL}/shop/page/{n}/",
    )
    return {
        "fresh": fresh,
        "failures": {f"shop:{n}": e for n, e in failures.items()},
        "expected": total_products,
        "pages_expected": total_pages,
        "mode": "shop",
        "failed_categories": [],
    }


def _scrape_categories():
    all_products = []
    failures = {}
    failed_categories = []
    expected_total = 0
    expected_known = False
    pages_expected = 0

    # Las primeras páginas se prueban una a una. Si una falla, las demás siguen.
    for slug, label in TOP_CATEGORIES.items():
        first_url = f"{BASE_URL}/product-category/{slug}/"
        first = get_soup(first_url, retries=4, delay=3, timeout=FIRST_PAGE_TIMEOUT)
        if first is None:
            failed_categories.append(slug)
            print(f"[DFA] [aviso] categoría {slug}: primera página sin respuesta")
            continue
        total_pages, expected = _total_pages(first)
        if total_pages > HARD_SAFETY_CAP:
            failed_categories.append(slug)
            print(f"[DFA] [aviso] categoría {slug}: {total_pages} páginas supera límite")
            continue
        pages_expected += total_pages
        if expected:
            expected_total += expected
            expected_known = True
        print(f"[DFA] fallback {slug}: {expected or '?'} productos, {total_pages} páginas")
        fresh, page_failures = _scrape_sequence(
            first,
            total_pages,
            label,
            lambda n, slug=slug: (
                f"{BASE_URL}/product-category/{slug}/" if n == 1
                else f"{BASE_URL}/product-category/{slug}/page/{n}/"
            ),
        )
        all_products.extend(fresh)
        failures.update({f"{slug}:{n}": e for n, e in page_failures.items()})

    fresh = dedupe_products_prefer_complete(all_products)
    if not fresh:
        raise RuntimeError("DFA: /shop falló y ninguna categoría fallback produjo productos")
    return {
        "fresh": fresh,
        "failures": failures,
        "expected": expected_total if expected_known else None,
        "pages_expected": pages_expected,
        "mode": "categorias",
        "failed_categories": failed_categories,
    }


def _merge_with_previous(fresh, previous):
    current = {p.get("url") or p.get("nombre"): p for p in fresh if p.get("url") or p.get("nombre")}
    for old in previous:
        if not isinstance(old, dict):
            continue
        key = old.get("url") or old.get("nombre")
        if key and key not in current:
            current[key] = dict(old, datos_anteriores=True)
    return list(current.values())


def run():
    global LAST_RUN_STATUS
    LAST_RUN_STATUS = {}
    previous = _load_previous()

    result = _try_shop()
    if result is None:
        print("[DFA] /shop no respondió; usando categorías principales como fallback")
        result = _scrape_categories()

    fresh = result["fresh"]
    expected = result["expected"]
    failures = result["failures"]
    failed_categories = result["failed_categories"]

    if expected:
        coverage = len(fresh) / expected
    else:
        coverage = 1 - (len(failures) / max(result["pages_expected"], 1))

    # Con fallback por categorías puede faltar una categoría entera: no se tira
    # lo que sí se observó, pero se marca parcial y se completa con cache.
    clearly_insufficient = coverage < MIN_FRESH_COVERAGE and not previous
    if clearly_insufficient:
        raise RuntimeError(f"DFA cobertura insuficiente sin cache: {len(fresh)}/{expected or '?'} ({coverage:.1%})")

    partial = bool(failures or failed_categories) or coverage < WARN_COVERAGE
    products = _merge_with_previous(fresh, previous) if partial else fresh
    metrics = catalog_metrics(products)
    metrics.update({
        "modo": result["mode"],
        "productos_frescos": len(fresh),
        "productos_esperados": expected,
        "cobertura_fresca": round(coverage, 4),
        "paginas_esperadas": result["pages_expected"],
        "paginas_fallidas": len(failures),
        "categorias_fallidas": len(failed_categories),
        "precios_observados": sum(p.get("precio_usd") is not None for p in fresh),
        "precios_recuperados": 0,
    })

    warning = None
    if partial:
        warning = (
            f"DFA parcial ({result['mode']}): {len(fresh)} productos frescos; "
            f"{len(failures)} páginas y {len(failed_categories)} categorías fallidas; "
            f"cobertura estimada {coverage:.1%}"
        )
        print(f"[DFA] [aviso] {warning}")
    LAST_RUN_STATUS = {"partial": partial, "warning": warning, "metrics": metrics}
    finalize_scrape(products, "dfa", Path(__file__).parent.parent / "data", LAST_RUN_STATUS)
    return products


if __name__ == "__main__":
    run()
