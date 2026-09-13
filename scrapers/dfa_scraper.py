"""
Scraper para DFA Uruguay (https://www.dfauy.com/)
Corre sobre WooCommerce, asi que la estructura de categorias/productos
es bastante estandar.

Si en el futuro deja de andar (cambiaron el tema/diseno), lo mas probable
es que solo haya que ajustar los nombres de clase CSS de abajo (PRODUCT_SELECTOR,
TITLE_SELECTOR, PRICE_SELECTOR).
"""
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).parent))
from utils import get_soup, clean_price, save_products

BASE_URL = "https://www.dfauy.com"

# Categorias principales a recorrer. Se puede agregar/sacar libremente:
# el "slug" es la parte de la URL despues de /product-category/
CATEGORIES = [
    "perfumeria",
    "relojeria",
    "bazar",
    "bebidas-varias",
    "vinos",
    "whisky",
    "comestibles",
    "electronica",
    "informatica",
    "jugueteria",
    "optica",
    "articulos-deportivos",
    "vestimenta",
    "varios-500",
]

MAX_PAGES_PER_CATEGORY = 15  # limite de seguridad para no colgarse infinito


def scrape_category(slug):
    products = []
    page = 1
    while page <= MAX_PAGES_PER_CATEGORY:
        url = f"{BASE_URL}/product-category/{slug}/"
        if page > 1:
            url = f"{BASE_URL}/product-category/{slug}/page/{page}/"

        soup = get_soup(url)
        if soup is None:
            break

        items = soup.select("ul.products li.product")
        if not items:
            # No hay mas paginas o la categoria esta vacia
            break

        for item in items:
            link_tag = item.select_one("a.woocommerce-loop-product__link") or item.select_one("a")
            title_tag = (
                item.select_one("h2.woocommerce-loop-product__title")
                or item.select_one("h3.woocommerce-loop-product__title")
                or item.select_one(".woocommerce-loop-product__title")
            )
            price_tag = item.select_one("span.price")
            img_tag = item.select_one("img")

            name = title_tag.get_text(strip=True) if title_tag else None
            if not name and link_tag:
                name = link_tag.get("aria-label") or link_tag.get_text(strip=True)
            if not name:
                continue

            product_url = link_tag.get("href") if link_tag else None

            price = None
            original_price = None
            if price_tag:
                # Si hay oferta, WooCommerce pone <del> (precio viejo) e <ins> (precio con descuento)
                sale = price_tag.select_one("ins")
                old = price_tag.select_one("del")
                if sale:
                    price = clean_price(sale.get_text(" ", strip=True))
                    if old:
                        original_price = clean_price(old.get_text(" ", strip=True))
                else:
                    price = clean_price(price_tag.get_text(" ", strip=True))

            image = None
            if img_tag:
                image = img_tag.get("data-src") or img_tag.get("src")

            if name and price is not None:
                en_oferta = original_price is not None and original_price > price
                products.append({
                    "tienda": "DFA",
                    "nombre": name,
                    "precio_usd": price,
                    "precio_original_usd": original_price,
                    "en_oferta": en_oferta,
                    "categoria": slug,
                    "url": product_url,
                    "imagen": image,
                })

        # Si esta pagina trajo menos productos que una pagina llena, es la ultima
        if len(items) < 12:
            break
        page += 1

    return products


def run():
    all_products = []
    for slug in CATEGORIES:
        print(f"[DFA] recorriendo categoria: {slug}")
        found = scrape_category(slug)
        print(f"[DFA]   -> {len(found)} productos")
        all_products.extend(found)

    # Evita duplicados (mismo producto puede aparecer en 2 categorias)
    seen = set()
    unique = []
    for p in all_products:
        key = p["url"] or p["nombre"]
        if key not in seen:
            seen.add(key)
            unique.append(p)

    out_dir = Path(__file__).parent.parent / "data"
    save_products(unique, "dfa", out_dir)
    return unique


if __name__ == "__main__":
    run()
