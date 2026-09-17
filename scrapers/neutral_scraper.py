"""Scraper de Neutral con control de cobertura y deduplicación por calidad."""
import re
import sys
import time
from pathlib import Path

sys.path.append(str(Path(__file__).parent))
from utils import (
    PRICE_RE,
    POLITE_DELAY,
    catalog_metrics,
    clean_price,
    dedupe_products_prefer_complete,
    finalize_scrape,
    get_soup,
)

LAST_RUN_STATUS = {}
BASE_URL = "https://www.neutral.com.uy"
CATEGORIES = {
    1: "bazar",
    2: "bebidas",
    3: "comestibles",
    4: "cosmetica",
    5: "electronica",
    6: "jugueteria",
    8: "perfumeria",
    9: "accesorios",
    10: "varios",
}
HARD_SAFETY_CAP = 500
MIN_CATEGORY_COVERAGE = 0.92


def _total_pages(soup, fallback=1):
    text = soup.get_text(" ", strip=True)
    match = re.search(r"P[aá]gina\s*(\d+)\s*de\s*(\d+)", text, re.I)
    if match:
        return int(match.group(2))
    pages = [int(m.group(1)) for a in soup.select("a[href]")
             if (m := re.search(r"[?&]page=(\d+)", a.get("href", "")))]
    return max(pages, default=fallback)


def _total_items(soup):
    text = soup.get_text(" ", strip=True)
    match = re.search(r"Total\s+de\s+art[ií]culos\s*\(?\s*([\d.,]+)\s*\)?", text, re.I)
    return int(re.sub(r"[.,]", "", match.group(1))) if match else None


def _extract_products(soup, slug):
    products = []
    for link in soup.find_all("a", href=True):
        if not re.search(r"/products/\d+", link["href"]):
            continue
        text = link.get_text(" ", strip=True)
        matches = list(PRICE_RE.finditer(text))
        price = clean_price(matches[-1].group(0)) if matches else None
        original = clean_price(matches[0].group(0)) if len(matches) > 1 else None
        name_tag = link.select_one("h2, h3, h4, .product-name, .product-title")
        name = name_tag.get_text(" ", strip=True) if name_tag else ""
        if not name:
            name = PRICE_RE.sub("", text).strip(" -–")
        img = link.find("img")
        if not name and img:
            name = img.get("alt", "").strip()
        if not name:
            continue
        href = link["href"] if link["href"].startswith("http") else BASE_URL + link["href"]
        image = img.get("src") if img else None
        if image and not image.startswith("http"):
            image = BASE_URL + image
        products.append({
            "tienda": "Neutral",
            "nombre": name,
            "precio_usd": price,
            "precio_original_usd": original if original and price and original > price else None,
            "en_oferta": bool(original and price and original > price),
            "categoria": slug,
            "url": href,
            "imagen": image,
        })
    return products


def _scrape_category_with_stats(category_id, slug):
    products = []
    total_pages = None
    expected_items = None
    failed_pages = []
    signatures = set()

    for page_no in range(1, HARD_SAFETY_CAP + 1):
        url = f"{BASE_URL}/es/products/category/{category_id}"
        if page_no > 1:
            url += f"?page={page_no}"
        soup = get_soup(url, retries=4, delay=2, timeout=30)
        if soup is None:
            failed_pages.append(page_no)
            if total_pages is None:
                break
            if page_no >= total_pages:
                break
            continue

        if total_pages is None:
            total_pages = _total_pages(soup, fallback=1)
            expected_items = _total_items(soup)
            if total_pages > HARD_SAFETY_CAP:
                raise RuntimeError(f"Neutral {slug}: {total_pages} páginas supera el límite de seguridad")
            print(f"[Neutral] {slug}: {total_pages} páginas; esperado {expected_items or '?'} productos")

        found = _extract_products(soup, slug)
        signature = tuple(sorted(x.get("url") for x in found if x.get("url")))
        if signature and signature in signatures:
            failed_pages.append(page_no)
            print(f"[Neutral] [aviso] {slug} página {page_no}: contenido repetido")
            break
        if signature:
            signatures.add(signature)
        if not found:
            failed_pages.append(page_no)
            print(f"[Neutral] [aviso] {slug} página {page_no}: sin productos legibles")
        products.extend(found)

        if total_pages and page_no >= total_pages:
            break
        if page_no % 15 == 0:
            print(f"[Neutral] {slug}: {page_no}/{total_pages}, {len(products)} observaciones")
        time.sleep(POLITE_DELAY)

    unique = dedupe_products_prefer_complete(products)
    coverage = (len(unique) / expected_items) if expected_items else None
    partial = bool(failed_pages) or (coverage is not None and coverage < MIN_CATEGORY_COVERAGE)
    return unique, {
        "categoria": slug,
        "paginas_esperadas": total_pages or 0,
        "paginas_fallidas": failed_pages,
        "productos_esperados": expected_items,
        "productos_observados": len(unique),
        "cobertura": coverage,
        "parcial": partial,
    }


def scrape_category(category_id, slug):
    """API histórica: devuelve solamente la lista de productos.

    El detalle de cobertura se usa internamente en ``run``. Mantener esta
    firma evita romper tests/utilidades que ya llamaban scrape_category()
    directamente.
    """
    products, _ = _scrape_category_with_stats(category_id, slug)
    return products


def run():
    global LAST_RUN_STATUS
    LAST_RUN_STATUS = {}
    all_products = []
    category_stats = []
    for category_id, slug in CATEGORIES.items():
        print(f"[Neutral] recorriendo categoría: {slug}")
        found, stats = _scrape_category_with_stats(category_id, slug)
        category_stats.append(stats)
        all_products.extend(found)
        print(f"[Neutral] -> {len(found)} productos; cobertura {stats['cobertura']:.1%}" if stats["cobertura"] is not None else f"[Neutral] -> {len(found)} productos")

    unique = dedupe_products_prefer_complete(all_products)
    partial_categories = [s for s in category_stats if s["parcial"]]
    metrics = catalog_metrics(unique)
    metrics.update({
        "categorias_totales": len(category_stats),
        "categorias_parciales": len(partial_categories),
        "paginas_fallidas": sum(len(s["paginas_fallidas"]) for s in category_stats),
        "productos_esperados": sum(s["productos_esperados"] or 0 for s in category_stats) or None,
        "precios_observados": metrics["precios_disponibles"],
        "precios_recuperados": 0,
    })
    warning = None
    if partial_categories:
        warning = f"Neutral parcial: {len(partial_categories)}/{len(category_stats)} categorías con cobertura incompleta"
    LAST_RUN_STATUS = {"partial": bool(warning), "warning": warning, "metrics": metrics}
    finalize_scrape(unique, "neutral", Path(__file__).parent.parent / "data", LAST_RUN_STATUS)
    # finalize_scrape puede incorporar cache al detectar una caída grande.
    LAST_RUN_STATUS["metrics"] = catalog_metrics(unique) | {
        **{k: v for k, v in metrics.items() if k not in {"productos_total", "productos_anteriores", "precios_disponibles", "precios_pendientes"}},
        "precios_observados": sum(p.get("precio_usd") is not None and not p.get("datos_anteriores") for p in unique),
    }
    return unique


if __name__ == "__main__":
    run()
