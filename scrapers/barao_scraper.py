"""Barão Free Shop: descubre solo rutas de catálogo y reporta cobertura de precios."""
import re
import sys
from pathlib import Path
from urllib.parse import urljoin, urlparse

sys.path.append(str(Path(__file__).parent))
from utils import (
    catalog_metrics,
    collect_wix_category,
    dedupe_products_prefer_complete,
    extract_wix_products,
    finalize_scrape,
    get_soup,
)

LAST_RUN_STATUS = {}
BASE_URL = "https://www.baraofreeshop.com.br"

RESERVED_PATHS = {
    "", "shop", "blog", "contato", "turista", "social", "trabalhe-conosco",
    "my-wishlist", "wishlist", "cart", "checkout", "lista-de-desejos", "home",
    "inicio", "o-barao", "blog-barao", "politica-de-privacidade",
    "responsabilidadesocial", "responsabilidade-social", "saude-no-trabalho",
    "seguranca-e-saude-no-trabalho", "seguranca", "cookies", "termos",
}
REJECT_PREFIXES = ("blank-", "blank_", "wix-", "post-", "blog-")
REJECT_PARTS = ("responsabilidade", "saude-no-trabalho", "trabalhe", "privacidade", "politica")

CATEGORY_LABELS = {
    "femininos": "perfumeria-femininos", "masculinos": "perfumeria-masculinos",
    "esteelauder": "cosmetica-esteelauder", "lancomecosmeticos": "cosmetica-lancome",
    "clinique": "cosmetica-clinique", "loreal": "cosmetica-loreal",
    "maybelline": "cosmetica-maybelline", "larocheposay": "cosmetica-larocheposay",
    "cerave": "cosmetica-cerave", "victorias": "cosmetica-victoriassecret",
    "kerastase": "cosmetica-kerastase", "wella": "cosmetica-wella",
    "tommy-vestimesta": "ropa-tommy", "barbie": "jugueteria-barbie",
    "funkopop": "jugueteria-funkopop", "pokemon": "jugueteria-pokemon",
    "copia-de-condimentos": "chocolates",
}


def _candidate_slug(href):
    parsed = urlparse(urljoin(BASE_URL, href))
    if parsed.netloc.removeprefix("www.") != urlparse(BASE_URL).netloc.removeprefix("www."):
        return None
    path = parsed.path.strip("/").lower()
    if not path or "/" in path or path in RESERVED_PATHS or path.startswith(REJECT_PREFIXES):
        return None
    if path.startswith("product-page") or any(part in path for part in REJECT_PARTS):
        return None
    return path


def discover_categories():
    """Usa navegación/header, no todos los links del documento."""
    soup = get_soup(BASE_URL, retries=4, delay=2, timeout=40)
    if soup is None:
        raise RuntimeError("Barão no respondió al descubrir categorías")
    anchors = soup.select('nav a[href], header a[href], [role="navigation"] a[href]')
    if not anchors:
        anchors = soup.find_all("a", href=True)
    slugs = []
    for a in anchors:
        slug = _candidate_slug(a.get("href", ""))
        if slug and slug not in slugs:
            slugs.append(slug)
    return slugs


def _discover_categories_rendered(page):
    try:
        response = page.goto(BASE_URL, wait_until="domcontentloaded", timeout=45000)
        if response is not None and response.status >= 400:
            return []
        page.wait_for_timeout(1200)
        hrefs = page.locator(
            'nav a[href], header a[href], [role="navigation"] a[href]'
        ).evaluate_all('els => els.map(a => a.href)')
        if not hrefs:
            hrefs = page.locator('a[href]').evaluate_all('els => els.map(a => a.href)')
        found = []
        for href in hrefs:
            slug = _candidate_slug(href)
            if slug and slug not in found:
                found.append(slug)
        return found
    except Exception as exc:
        print(f"[Barão] [aviso] no se pudo descubrir navegación renderizada: {exc}")
        return []


def scrape_category(slug, page):
    from bs4 import BeautifulSoup
    url = f"{BASE_URL}/{slug}"
    try:
        response = page.goto(url, wait_until="domcontentloaded", timeout=45000)
        if response is not None and response.status >= 400:
            return "failed", [], f"HTTP {response.status}"
        page.wait_for_timeout(1200)
        roots = page.locator('[data-hook="product-item-root"]').count()
        links = page.locator('a[href*="/product-page/"]').count()
        if roots == 0 and links == 0:
            # Ruta institucional detectada después de cargar: no cuenta como
            # categoría fallida ni ensucia el resumen.
            return "ignored", [], None
        if roots:
            found, partial_warning = collect_wix_category(
                page, "Barão Free Shop", CATEGORY_LABELS.get(slug, slug),
                BASE_URL, with_status=True
            )
        else:
            found = extract_wix_products(
                BeautifulSoup(page.content(), "html.parser"),
                "Barão Free Shop", CATEGORY_LABELS.get(slug, slug), BASE_URL
            )
            partial_warning = None
        if not found:
            return "failed", [], "sin productos legibles"
        return ("partial" if partial_warning else "ok"), found, partial_warning
    except Exception as exc:
        return "failed", [], str(exc)


def run():
    global LAST_RUN_STATUS
    LAST_RUN_STATUS = {}
    from playwright.sync_api import sync_playwright

    all_products = []
    failures = []
    partial_categories = []
    ignored = []
    categories = discover_categories()

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, args=["--disable-dev-shm-usage"])
        page = browser.new_page(user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36")
        try:
            if len(categories) < 10:
                rendered = _discover_categories_rendered(page)
                for slug in rendered:
                    if slug not in categories:
                        categories.append(slug)
            if len(categories) < 5:
                raise RuntimeError(f"Barão: solo se descubrieron {len(categories)} candidatos de catálogo")
            print(f"[Barão] {len(categories)} candidatos descubiertos en navegación")
            for slug in categories:
                state, found, error = scrape_category(slug, page)
                if state == "ignored":
                    ignored.append(slug)
                    print(f"[Barão] ignorada ruta no-catálogo: {slug}")
                    continue
                if state == "failed":
                    failures.append(slug)
                    print(f"[Barão] [aviso] {slug}: {error}")
                    continue
                if state == "partial":
                    partial_categories.append(slug)
                    print(f"[Barão] [aviso] {slug}: parcial ({error})")
                priced = sum(p.get("precio_usd") is not None for p in found)
                print(f"[Barão] {slug}: {len(found)} productos; {priced} con precio")
                all_products.extend(found)
        finally:
            browser.close()

    unique = dedupe_products_prefer_complete(all_products)
    if not unique:
        raise RuntimeError("Barão: ninguna categoría válida produjo productos")

    metrics = catalog_metrics(unique)
    metrics.update({
        "categorias_candidatas": len(categories),
        "categorias_validas": len(categories) - len(ignored) - len(failures),
        "rutas_institucionales_ignoradas": len(ignored),
        "categorias_fallidas": len(failures),
        "categorias_parciales": len(partial_categories),
        "productos_frescos": len(unique),
        "precios_observados": metrics["precios_disponibles"],
        "precios_recuperados": 0,
    })
    warning_parts = []
    if failures:
        warning_parts.append(f"{len(failures)} categorías fallaron")
    if partial_categories:
        warning_parts.append(f"{len(partial_categories)} categorías se conservaron parcialmente")
    warning = "Barão parcial: " + "; ".join(warning_parts) if warning_parts else None
    LAST_RUN_STATUS = {"partial": bool(warning), "warning": warning, "metrics": metrics}
    finalize_scrape(unique, "barao", Path(__file__).parent.parent / "data", LAST_RUN_STATUS)
    return unique


if __name__ == "__main__":
    run()
