"""
PLANTILLA para agregar una tienda nueva.

Pasos:
  1. Copia este archivo y renombralo, ej: "duty_shop_scraper.py"
  2. Cambia BASE_URL y STORE_NAME
  3. Andá a la web de la tienda, click derecho -> "Inspeccionar" sobre un
     producto en una pagina de categoria/listado, y fijate:
       - Que tag envuelve cada producto (ej: <div class="product-card">)
       - Donde esta el nombre
       - Donde esta el precio
       - Donde esta el link a la ficha del producto
  4. Ajusta la funcion scrape_category() con esos datos
  5. Agrega la tienda en run_all.py (lista SCRAPERS)

Tip: usa el link de la tienda y el HTML de una pagina de categoria (podes
copiarlo con "Ver codigo fuente" en el navegador) como referencia para
adaptar los selectores.
"""
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).parent))
from utils import get_soup, clean_price, save_products

BASE_URL = "https://www.ejemplo-freeshop.com.uy"
STORE_NAME = "Ejemplo"

# Lista de categorias a recorrer (ajustar segun la tienda)
CATEGORIES = [
    "perfumeria",
    "electronica",
]

MAX_PAGES_PER_CATEGORY = 15


def scrape_category(slug):
    products = []
    page = 1
    while page <= MAX_PAGES_PER_CATEGORY:
        # AJUSTAR: como arma la URL de categoria + paginado este sitio
        url = f"{BASE_URL}/categoria/{slug}/"
        if page > 1:
            url = f"{BASE_URL}/categoria/{slug}/?pagina={page}"

        soup = get_soup(url)
        if soup is None:
            break

        # AJUSTAR: el selector CSS que envuelve cada producto
        items = soup.select(".product-card")
        if not items:
            break

        for item in items:
            # AJUSTAR: estos 4 selectores segun el HTML real de la tienda
            title_tag = item.select_one(".product-title")
            price_tag = item.select_one(".product-price")
            link_tag = item.select_one("a")
            img_tag = item.select_one("img")

            name = title_tag.get_text(strip=True) if title_tag else None
            price = clean_price(price_tag.get_text(strip=True)) if price_tag else None
            url_producto = link_tag.get("href") if link_tag else None
            image = img_tag.get("src") if img_tag else None

            if name and price is not None:
                products.append({
                    "tienda": STORE_NAME,
                    "nombre": name,
                    "precio_usd": price,
                    "categoria": slug,
                    "url": url_producto,
                    "imagen": image,
                })

        if len(items) < 6:
            break
        page += 1

    return products


def run():
    all_products = []
    for slug in CATEGORIES:
        print(f"[{STORE_NAME}] recorriendo categoria: {slug}")
        found = scrape_category(slug)
        print(f"[{STORE_NAME}]   -> {len(found)} productos")
        all_products.extend(found)

    out_dir = Path(__file__).parent.parent / "data"
    save_products(all_products, STORE_NAME.lower(), out_dir)
    return all_products


if __name__ == "__main__":
    run()
