"""Catálogo de Oprha: nombres y enlaces, sin precios públicos.
Usa HTML y un fallback renderizado si Wix no entrega enlaces estáticos.
"""
import re
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).parent))
from utils import get_soup, save_products, extract_wix_detail_price

BASE_URL = "https://www.oprhafreeshop.com.br"

CATEGORIES = [
    "masculinos-a-l",
    "perfumesfemininos",
    "cosmeticos",
]

# "masculinos-a-l" es la seccion de perfumes masculinos de Oprha, pero el
# nombre no lo deja claro para el clasificador del sitio -- se lo etiquetamos.
CATEGORY_LABELS = {
    "masculinos-a-l": "perfumeria-masculinos",
}

MAX_PAGES_PER_CATEGORY = 40  # el catalogo de Oprha es mas grande de lo que parece


def collect_product_urls(slug):
    urls = set()
    page = 1
    low_yield_streak = 0
    while page <= MAX_PAGES_PER_CATEGORY:
        url = f"{BASE_URL}/{slug}" if page == 1 else f"{BASE_URL}/{slug}?page={page}"
        soup = get_soup(url)
        if soup is None:
            break

        links = [
            a["href"] for a in soup.find_all("a", href=True)
            if "/product-page/" in a["href"]
        ]
        if not links:
            break

        before = len(urls)
        for l in links:
            urls.add(l if l.startswith("http") else BASE_URL + l)
        new_found = len(urls) - before

        # Si varias paginas seguidas casi no traen productos NUEVOS, es señal
        # de que ya vimos todo lo real de esta categoria y lo que sigue
        # apareciendo es ruido (ej: un widget de "recomendados" repetido).
        # Frenamos aca en vez de seguir hasta el limite fijo de paginas.
        if new_found <= 2:
            low_yield_streak += 1
        else:
            low_yield_streak = 0
        if low_yield_streak >= 3:
            break

        page += 1

    return urls


def scrape_product_page(url, slug):
    soup = get_soup(url, retries=2, delay=1)
    if soup is None:
        return None

    # Leer únicamente el precio visible dentro del bloque principal de la ficha.
    # No usamos JSON-LD/SEO porque puede contener importes viejos o placeholders.
    price, original = extract_wix_detail_price(soup)

    title_tag = soup.find("meta", attrs={"property": "og:title"})
    name = title_tag["content"] if title_tag and title_tag.get("content") else None
    if not name:
        h1 = soup.find("h1")
        name = h1.get_text(strip=True) if h1 else None
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
    all_urls = {}  # url -> slug (categoria donde lo encontramos)
    for slug in CATEGORIES:
        print(f"[Oprha] juntando links de: {slug}")
        found_urls = collect_product_urls(slug)
        print(f"[Oprha]   -> {len(found_urls)} fichas de producto encontradas")
        for u in found_urls:
            all_urls.setdefault(u, slug)

    if not all_urls:
        from playwright.sync_api import sync_playwright
        from utils import expand_wix_catalog
        from urllib.parse import urljoin
        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=True)
            page = browser.new_page()
            try:
                for slug in CATEGORIES:
                    page.goto(f"{BASE_URL}/{slug}", wait_until="domcontentloaded", timeout=30000)
                    page.wait_for_selector('a[href*="/product-page/"]', timeout=20000)
                    expand_wix_catalog(page)
                    for href in page.locator('a[href*="/product-page/"]').evaluate_all('(links)=>links.map(a=>a.href)'):
                        all_urls.setdefault(urljoin(BASE_URL, href), slug)
            finally:
                browser.close()

    if not all_urls:
        raise RuntimeError("Oprha no expone actualmente un catálogo accesible; se conserva el último catálogo válido")

    print(f"[Oprha] visitando {len(all_urls)} fichas de producto para sacar el precio...")
    products = []
    for i, (url, slug) in enumerate(all_urls.items(), start=1):
        product = scrape_product_page(url, slug)
        if product:
            products.append(product)
        if i % 20 == 0:
            print(f"[Oprha]   ...{i}/{len(all_urls)} fichas procesadas")

    out_dir = Path(__file__).parent.parent / "data"
    save_products(products, "oprha", out_dir)
    return products


if __name__ == "__main__":
    run()
