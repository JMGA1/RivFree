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
from utils import save_products, expand_wix_catalog, extract_wix_products, extract_wix_detail_price

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
        raise RuntimeError(f"Categoría incompleta: {slug}") from e


def run():
    from playwright.sync_api import sync_playwright
    from bs4 import BeautifulSoup

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

        seen = set()
        unique = []
        for pr in all_products:
            key = pr["url"] or pr["nombre"]
            if key not in seen:
                seen.add(key)
                unique.append(pr)

        # El fallback textual de extract_wix_products recupera la mayoría de precios.
        # Para los restantes abrimos la ficha renderizada porque Wix puede inyectar
        # el precio únicamente con JavaScript.
        missing = [product for product in unique if product['precio_usd'] is None]
        for i, product in enumerate(missing, 1):
            try:
                page.goto(product['url'], wait_until="domcontentloaded", timeout=20000)
                page.wait_for_timeout(500)
                detail = BeautifulSoup(page.content(), "html.parser")
                current, original = extract_wix_detail_price(detail)
                product.update(precio_usd=current, precio_original_usd=original,
                               en_oferta=current is not None and original is not None)
            except Exception:
                pass
            if i % 50 == 0:
                print(f"[Yury's] recuperación de precios: {i}/{len(missing)}")
        browser.close()

    print(f"[Yury's] aún sin precio publicado: {sum(p['precio_usd'] is None for p in unique)}")
    out_dir = Path(__file__).parent.parent / "data"
    save_products(unique, "yurys", out_dir)
    return unique


if __name__ == "__main__":
    run()
