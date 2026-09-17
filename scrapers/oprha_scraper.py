"""Oprha: descubre categorías y lee su catálogo renderizado con paginación.
Los fallos se registran como parciales y no eliminan los productos anteriores.
"""
import re
import sys
from pathlib import Path
from urllib.parse import urljoin, urlparse

sys.path.append(str(Path(__file__).parent))
from utils import finalize_scrape, load_previous_store, navigate, discover_menu_categories, get_soup, save_products, extract_wix_detail_price

BASE_URL = "https://www.oprhafreeshop.com.br"
FALLBACK_CATEGORIES = ["masculinos-a-l", "perfumesfemininos", "cosmeticos"]
CATEGORY_LABELS = {"masculinos-a-l": "perfumeria-masculinos"}
MAX_PAGES_PER_CATEGORY = 50
CATEGORY_WORKERS = 5
DETAIL_WORKERS = 10
LAST_RUN_STATUS = {}

# Páginas institucionales que no son categorías de catálogo.
IGNORED_SLUGS = {
    "", "home", "inicio", "sobre", "sobre-nos", "contato", "contact", "contacto",
    "politica-de-privacidade", "politica-privacidade", "termos", "termos-de-uso",
    "faq", "blog", "carrinho", "cart", "checkout", "login", "minha-conta",
    "wishlist", "my-wishlist", "em-breve", "tour-virtual", "buscar", "search",
}


def _load_previous():
    return load_previous_store("oprha", Path(__file__).parent.parent / "data")


def _slug_from_url(href):
    try:
        parsed = urlparse(urljoin(BASE_URL, href))
    except ValueError:
        return None
    host = parsed.netloc.lower().removeprefix("www.")
    base_host = urlparse(BASE_URL).netloc.lower().removeprefix("www.")
    if host and host != base_host:
        return None
    path = parsed.path.strip("/")
    if not path or "/" in path or path.startswith("product-page"):
        return None
    slug = path.lower()
    if slug in IGNORED_SLUGS or slug.startswith(("_", "wix-")):
        return None
    return slug


def _discover_categories_rendered():
    """Lee el menú ya renderizado cuando Wix no lo incluye en el HTML inicial."""
    from playwright.sync_api import sync_playwright

    candidates = set()
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=True)
            page = browser.new_page()
            try:
                page.goto(BASE_URL, wait_until="domcontentloaded", timeout=40000)
                page.wait_for_timeout(1200)
                hrefs = page.locator(
                    'nav a[href], header a[href], [role="navigation"] a[href]'
                ).evaluate_all('links => links.map(a => a.href)')
                if not hrefs:
                    hrefs = page.locator('a[href]').evaluate_all('links => links.map(a => a.href)')
                for href in hrefs:
                    slug = _slug_from_url(href)
                    if slug:
                        candidates.add(slug)
            finally:
                browser.close()
    except Exception as exc:
        print(f"[Oprha] [aviso] no se pudo descubrir el menú renderizado: {exc}")
    return candidates


def discover_categories():
    """Descubre slugs de categorías desde navegación HTML y sitemap.

    No asumimos que todo enlace sea categoría: después cada candidato se valida
    porque collect_product_urls solo lo acepta si realmente contiene productos.
    """
    candidates = set()
    home = get_soup(BASE_URL, retries=4, delay=2, timeout=40)
    if home is not None:
        selectors = "nav a[href], header a[href], [role='navigation'] a[href]"
        links = home.select(selectors) or home.find_all("a", href=True)
        for anchor in links:
            slug = _slug_from_url(anchor.get("href"))
            if slug:
                candidates.add(slug)

    # Si el menú no vino renderizado en el HTML, usamos el sitemap como
    # segunda fuente. Así evitamos confundir páginas institucionales con
    # categorías cuando la navegación normal sí está disponible.
    if len(candidates) < 2:
        sitemap = get_soup(f"{BASE_URL}/sitemap.xml", retries=2, delay=1, timeout=30)
        if sitemap is not None:
            for loc in sitemap.find_all("loc"):
                slug = _slug_from_url(loc.get_text(" ", strip=True))
                if slug:
                    candidates.add(slug)

    # Si todavía solo vemos muy pocos candidatos, intentamos el menú ya
    # renderizado por Wix antes de recurrir a los slugs históricos.
    if len(candidates) < 4:
        candidates.update(_discover_categories_rendered())

    # Estos slugs solo sirven de red de seguridad si el menú/sitemap cambia.
    if not candidates:
        candidates.update(FALLBACK_CATEGORIES)
    return sorted(candidates)


def scrape_product_page(url, slug):
    soup = get_soup(url, retries=3, delay=1, timeout=30)
    if soup is None:
        return None

    # Solo precio visible del bloque principal; ignoramos metadatos SEO viejos.
    price, original = extract_wix_detail_price(soup)

    title_tag = soup.find("meta", attrs={"property": "og:title"})
    name = title_tag["content"] if title_tag and title_tag.get("content") else None
    if not name:
        h1 = soup.find("h1")
        name = h1.get_text(" ", strip=True) if h1 else None
    if name:
        name = re.sub(r"\s*\|\s*oprha\s*$", "", name, flags=re.IGNORECASE).strip()
    if not name:
        return None

    img_tag = soup.find("meta", attrs={"property": "og:image"})
    image = img_tag["content"] if img_tag and img_tag.get("content") else None

    return {
        "tienda": "Oprha Free Shop",
        "nombre": name,
        "precio_usd": price,
        "precio_original_usd": original,
        "en_oferta": price is not None and original is not None,
        "categoria": CATEGORY_LABELS.get(slug, slug),
        "url": url,
        "imagen": image,
    }


def run():
    global LAST_RUN_STATUS
    LAST_RUN_STATUS = {}
    from playwright.sync_api import sync_playwright
    from bs4 import BeautifulSoup
    from utils import collect_wix_category
    products = {}
    failures = []
    categories = discover_categories()
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            for slug in categories:
                try:
                    navigate(page, f"{BASE_URL}/{slug}", '[data-hook="product-item-root"]')
                    found = collect_wix_category(page, 'Oprha Free Shop', CATEGORY_LABELS.get(slug, slug), BASE_URL)
                    products.update((x['url'], x) for x in found)
                    print(f"[Oprha] {slug}: {len(found)} productos")
                except Exception as exc:
                    failures.append(slug)
                    print(f"[Oprha] categoría {slug}: {exc}")
            # Only the main product block can supply a public price.
            for product in products.values():
                if product.get('precio_usd') is not None:
                    continue
                try:
                    navigate(page, product['url'], '[data-hook="product-title"], h1', attempts=2)
                    page.wait_for_timeout(1500)
                    current, old = extract_wix_detail_price(BeautifulSoup(page.content(), 'html.parser'))
                    product.update(precio_usd=current, precio_original_usd=old, en_oferta=bool(current and old))
                except Exception as exc:
                    failures.append(product['url'])
                    print(f"[Oprha] ficha no leída: {exc}")
        finally:
            browser.close()
    if failures:
        LAST_RUN_STATUS = {'partial': True, 'warning': f'Oprha: {len(failures)} páginas no se pudieron leer'}
    return finalize_scrape(list(products.values()), 'oprha', Path(__file__).parent.parent / 'data', LAST_RUN_STATUS)


if __name__ == '__main__':
    run()
