"""
Scraper para Sineriz Shopping (https://www.sineriz.com.uy/)
Este sitio usa un CMS distinto a WooCommerce (Columnis), por eso la logica
es un poco mas generica: busca cualquier link que apunte a una ficha de
producto (/produtos/.../algo/) y le busca el precio "USD X" cerca.

Si en el futuro deja de andar, lo mas probable es que haya que revisar
PRODUCT_LINK_PATTERN y como se relaciona el precio con el link (mirando
el HTML real con "Inspeccionar elemento" en el navegador).
"""
import re
import sys
from pathlib import Path
from urllib.parse import urljoin

sys.path.append(str(Path(__file__).parent))
from utils import get_soup, clean_price, save_products, extract_image_url

BASE_URL = "https://www.sineriz.com.uy"

CATEGORIES = [
    "esportes-1",
    "bazar-1",
    "relogios-1",
    "ferramentas-1",
    "comestiveis-1",
    "eletronicos-1",
    "bebidas-1",
    "infantil-1",
    "perfumaria-e-beleza",
]

def scrape_category(slug, page=None):
    products = []
    url = f"{BASE_URL}/produtos/{slug}/"
    if page is None:
        soup = get_soup(url)
    else:
        from bs4 import BeautifulSoup
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_selector('a[href*="/produtos/"]', timeout=15000)
            # Siñeriz carga mas productos al llegar al final. Esperamos hasta
            # que la cantidad de enlaces permanezca estable tres veces.
            previous_count = 0
            stable_rounds = 0
            for _ in range(40):
                count = page.locator('a[href*="/produtos/"]').count()
                stable_rounds = stable_rounds + 1 if count == previous_count else 0
                if stable_rounds >= 3:
                    break
                previous_count = count
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(900)
            soup = BeautifulSoup(page.content(), "html.parser")
        except Exception as exc:
            print(f"  [aviso] no se pudo cargar {url}: {exc}")
            return products
    if soup is None:
        return products

    # Cada producto es un link a una ficha bajo /produtos/<categoria>/<slug-producto>/
    product_links = [
        a for a in soup.find_all("a", href=True)
        if re.search(r"/produtos/[^/]+/[^/]+/?$", a["href"])
        and a["href"].rstrip("/") != f"{BASE_URL}/produtos/{slug}".rstrip("/")
    ]

    if not product_links:
        return products

    links_by_url = {}
    for link in product_links:
        href = urljoin(BASE_URL, link["href"])
        links_by_url.setdefault(href, []).append(link)

    invalid_names = {"", "VEJA MAIS", "NENHUMA FOTO DISPONÍVEL", "SEM IMAGEM"}
    for href, matching_links in links_by_url.items():
        candidates = [link.get_text(" ", strip=True) for link in matching_links]
        candidates += [
            (link.find("img").get("alt", "").strip() if link.find("img") else "")
            for link in matching_links
        ]
        candidates = [name for name in candidates if name.upper() not in invalid_names]
        name = max(candidates, key=len) if candidates else None
        if not name:
            continue

        price = None
        product_container = None
        for link in matching_links:
            container = link
            for _ in range(4):
                if container.parent is None:
                    break
                container = container.parent
                match = re.search(r"USD\s*[\d.,]+", container.get_text(" ", strip=True))
                if match:
                    price = clean_price(match.group(0))
                    product_container = container
                    break
            if price is not None:
                break

        image = next(
            (extract_image_url(link) for link in matching_links if extract_image_url(link)),
            None,
        )
        if not image and product_container:
            image = extract_image_url(product_container)

        products.append({
            "tienda": "Sineriz",
            "nombre": name,
            "precio_usd": price if price and price > 0 else None,
            "precio_original_usd": None,
            "en_oferta": False,
            "categoria": slug,
            "url": href,
            "imagen": image,
        })

    return products


def run():
    from playwright.sync_api import sync_playwright

    all_products = []
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        page = browser.new_page()
        for slug in CATEGORIES:
            print(f"[Sineriz] recorriendo categoria: {slug}")
            found = scrape_category(slug, page)
            print(f"[Sineriz]   -> {len(found)} productos")
            all_products.extend(found)
        browser.close()

    seen = set()
    unique = []
    for p in all_products:
        key = p["url"] or p["nombre"]
        if key not in seen:
            seen.add(key)
            unique.append(p)

    out_dir = Path(__file__).parent.parent / "data"
    save_products(unique, "sineriz", out_dir)
    return unique


if __name__ == "__main__":
    run()
