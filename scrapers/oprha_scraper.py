"""Oprha Free Shop: resuelve dominio vigente y no confunde sitio caído con 'sin precio'."""
import re
import sys
from pathlib import Path
from urllib.parse import urljoin, urlparse

sys.path.append(str(Path(__file__).parent))
from utils import (
    catalog_metrics,
    clean_price,
    collect_wix_category,
    dedupe_products_prefer_complete,
    extract_wix_detail_price,
    extract_wix_products,
    finalize_scrape,
    get_soup,
)

BASE_CANDIDATES = [
    "https://www.oprhafreeshop.com",
    "https://www.oprhafreeshop.com.br",
]
FALLBACK_CATEGORIES = ["masculinos-a-l", "perfumesfemininos", "cosmeticos"]
CATEGORY_LABELS = {"masculinos-a-l": "perfumeria-masculinos"}
LAST_RUN_STATUS = {}
IGNORED_SLUGS = {
    "", "home", "inicio", "sobre", "sobre-nos", "contato", "contact", "contacto",
    "politica-de-privacidade", "politica-privacidade", "termos", "termos-de-uso",
    "faq", "blog", "carrinho", "cart", "checkout", "login", "minha-conta",
    "wishlist", "my-wishlist", "em-breve", "tour-virtual", "buscar", "search",
}


def _probe_base():
    """Devuelve el primer dominio que responde con una página real, no 404."""
    import requests
    from utils import HEADERS
    for base in BASE_CANDIDATES:
        try:
            response = requests.get(base + "/", headers=HEADERS, timeout=30, allow_redirects=True)
            print(f"[Oprha] prueba {base}: HTTP {response.status_code} -> {response.url}")
            if response.status_code == 200 and len(response.text) > 500:
                final = response.url.rstrip("/")
                parsed = urlparse(final)
                return f"{parsed.scheme}://{parsed.netloc}"
        except requests.RequestException as exc:
            print(f"[Oprha] [aviso] {base}: {exc}")
    raise RuntimeError(
        "Oprha: no se encontró una entrada web vigente al catálogo; "
        "se conservan datos anteriores y NO se interpreta como 'sin precio'"
    )


def _slug_from_url(base, href=None):
    # Compatibilidad con tests/uso anterior: _slug_from_url(href).
    if href is None:
        href = base
        base = BASE_CANDIDATES[0]
    try:
        parsed = urlparse(urljoin(base, href))
    except ValueError:
        return None
    if parsed.netloc.removeprefix("www.") != urlparse(base).netloc.removeprefix("www."):
        return None
    path = parsed.path.strip("/")
    if not path or "/" in path or path.startswith("product-page"):
        return None
    slug = path.lower()
    if slug in IGNORED_SLUGS or slug.startswith(("_", "wix-", "blank-")):
        return None
    return slug


def discover_categories(base):
    candidates = set()
    home = get_soup(base, retries=2, delay=2, timeout=30)
    if home is not None:
        links = home.select("nav a[href], header a[href], [role='navigation'] a[href]") or home.find_all("a", href=True)
        for anchor in links:
            slug = _slug_from_url(base, anchor.get("href"))
            if slug:
                candidates.add(slug)

    sitemap = get_soup(f"{base}/sitemap.xml", retries=1, delay=1, timeout=20)
    if sitemap is not None:
        for loc in sitemap.find_all("loc"):
            slug = _slug_from_url(base, loc.get_text(" ", strip=True))
            if slug:
                candidates.add(slug)

    # Fallback histórico solo si el dominio sí respondió; nunca sirve para
    # afirmar que el sitio actual publica o no publica precios.
    if not candidates:
        candidates.update(FALLBACK_CATEGORIES)
    return sorted(candidates)


def scrape_product_page(url, slug):
    """Compatibilidad y fallback HTTP para una ficha individual.

    Solo acepta como precio el bloque visible principal de Wix; metadatos SEO
    por sí solos nunca se consideran un precio publicado.
    """
    soup = get_soup(url, retries=2, delay=1, timeout=30)
    if soup is None:
        return None
    price, original = extract_wix_detail_price(soup)
    title_tag = soup.find("meta", attrs={"property": "og:title"})
    name = title_tag.get("content") if title_tag else None
    if not name:
        h1 = soup.find("h1")
        name = h1.get_text(" ", strip=True) if h1 else None
    if name:
        name = re.sub(r"\s*\|\s*oprha\s*$", "", name, flags=re.IGNORECASE).strip()
    if not name:
        return None
    image_tag = soup.find("meta", attrs={"property": "og:image"})
    image = image_tag.get("content") if image_tag else None
    return {
        "tienda": "Oprha Free Shop",
        "nombre": name,
        "precio_usd": price,
        "precio_original_usd": original,
        "en_oferta": bool(price is not None and original is not None),
        "categoria": CATEGORY_LABELS.get(slug, slug),
        "url": url,
        "imagen": image,
    }


def _recover_detail(page, product):
    from bs4 import BeautifulSoup
    try:
        response = page.goto(product["url"], wait_until="domcontentloaded", timeout=30000)
        if response is not None and response.status >= 400:
            return False
        page.wait_for_timeout(800)
        current, old = extract_wix_detail_price(BeautifulSoup(page.content(), "html.parser"))
        if current is None:
            return False
        product.update(precio_usd=current, precio_original_usd=old, en_oferta=bool(old and old > current), precio_fuente="ficha")
        return True
    except Exception:
        return False


def run():
    global LAST_RUN_STATUS
    LAST_RUN_STATUS = {}
    from bs4 import BeautifulSoup
    from playwright.sync_api import sync_playwright

    base = _probe_base()
    categories = discover_categories(base)
    print(f"[Oprha] dominio activo: {base}; {len(categories)} candidatos")

    products = []
    failures = []
    partial_categories = []
    ignored = []
    recovered = 0
    detail_failed = 0

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, args=["--disable-dev-shm-usage"])
        page = browser.new_page(user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36")
        try:
            for slug in categories:
                url = f"{base}/{slug}"
                try:
                    response = page.goto(url, wait_until="domcontentloaded", timeout=40000)
                    if response is not None and response.status >= 400:
                        failures.append(slug)
                        print(f"[Oprha] [aviso] {slug}: HTTP {response.status}")
                        continue
                    page.wait_for_timeout(1200)
                    roots = page.locator('[data-hook="product-item-root"]').count()
                    links = page.locator('a[href*="/product-page/"]').count()
                    if roots == 0 and links == 0:
                        ignored.append(slug)
                        continue
                    if roots:
                        found, partial_warning = collect_wix_category(
                            page, "Oprha Free Shop", CATEGORY_LABELS.get(slug, slug),
                            base, with_status=True
                        )
                    else:
                        found = extract_wix_products(
                            BeautifulSoup(page.content(), "html.parser"),
                            "Oprha Free Shop", CATEGORY_LABELS.get(slug, slug), base
                        )
                        partial_warning = None
                    if not found:
                        failures.append(slug)
                        continue
                    if partial_warning:
                        partial_categories.append(slug)
                        print(f"[Oprha] [aviso] {slug}: parcial ({partial_warning})")
                    products.extend(found)
                    print(f"[Oprha] {slug}: {len(found)} productos; {sum(p.get('precio_usd') is not None for p in found)} con precio")
                except Exception as exc:
                    failures.append(slug)
                    print(f"[Oprha] [aviso] categoría {slug}: {exc}")

            unique = dedupe_products_prefer_complete(products)
            for product in unique:
                if product.get("precio_usd") is not None:
                    continue
                if _recover_detail(page, product):
                    recovered += 1
                else:
                    detail_failed += 1
        finally:
            browser.close()

    if not unique:
        raise RuntimeError(
            f"Oprha: {base} respondió, pero no se encontró un catálogo legible; "
            "se conservan los datos anteriores"
        )

    metrics = catalog_metrics(unique)
    metrics.update({
        "dominio_activo": base,
        "categorias_candidatas": len(categories),
        "categorias_fallidas": len(failures),
        "categorias_parciales": len(partial_categories),
        "rutas_ignoradas": len(ignored),
        "productos_frescos": len(unique),
        "precios_observados": metrics["precios_disponibles"] - recovered,
        "precios_recuperados": recovered,
        "fichas_pendientes": detail_failed,
    })
    warning_parts = []
    if failures:
        warning_parts.append(f"{len(failures)} categorías/rutas fallaron")
    if partial_categories:
        warning_parts.append(f"{len(partial_categories)} categorías se conservaron parcialmente")
    if detail_failed:
        warning_parts.append(f"{detail_failed} productos siguen sin precio observado")
    warning = "Oprha parcial: " + "; ".join(warning_parts) if warning_parts else None
    LAST_RUN_STATUS = {"partial": bool(warning), "warning": warning, "metrics": metrics}
    finalize_scrape(unique, "oprha", Path(__file__).parent.parent / "data", LAST_RUN_STATUS)
    return unique


if __name__ == "__main__":
    run()
