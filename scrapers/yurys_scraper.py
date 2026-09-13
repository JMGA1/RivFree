"""
Scraper para Yury's Free Shop (https://www.yurysfreeshop.com/)

Misma plataforma que Barao (Wix) y mismo problema: la grilla de productos se
carga con JavaScript, asi que usamos Playwright (Chrome invisible) en vez de
un pedido HTTP simple. Este sitio tiene muchas menos categorias que Barao,
asi que las cubrimos todas.
"""
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).parent))
from utils import save_products, expand_wix_catalog, extract_wix_products

BASE_URL = "https://www.yurysfreeshop.com"

CATEGORIES = [
    "arcondicionado",
    "eletrônicos",
    "bebidas-1",
    "vinhos",
    "perfumaria-1",
    "cosmeticos-1",
    "bazar-1",
    "mochilas",
    "roupas",
    "comestiveis",
    "brinquedos",
]

def scrape_category(slug, page):
    from bs4 import BeautifulSoup
    url = f"{BASE_URL}/{slug}"
    try:
        page.goto(url, wait_until="domcontentloaded", timeout=30000)
        page.wait_for_selector('[data-hook="product-item-root"]', timeout=20000)
        loaded = expand_wix_catalog(page)
        soup = BeautifulSoup(page.content(), "html.parser")
        products = extract_wix_products(soup, "Yury's Free Shop", slug, BASE_URL)
        if loaded and len(products) < loaded:
            print(f"  [aviso] se cargaron {loaded} tarjetas pero solo se pudieron leer {len(products)}")
        return products
    except Exception as e:
        print(f"  [aviso] no se pudo procesar {url}: {e}")
        return []


def run():
    from playwright.sync_api import sync_playwright

    all_products = []
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_extra_http_headers({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                          "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
        })

        for slug in CATEGORIES:
            print(f"[Yury's] recorriendo categoria: {slug}")
            found = scrape_category(slug, page)
            print(f"[Yury's]   -> {len(found)} productos")
            all_products.extend(found)

        browser.close()

    seen = set()
    unique = []
    for pr in all_products:
        key = pr["url"] or pr["nombre"]
        if key not in seen:
            seen.add(key)
            unique.append(pr)

    out_dir = Path(__file__).parent.parent / "data"
    save_products(unique, "yurys", out_dir)
    return unique


if __name__ == "__main__":
    run()
