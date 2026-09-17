"""
Scraper para Neutral Free Shop (https://www.neutral.com.uy/)

OJO: Neutral es la cadena mas grande, con sucursales en varias ciudades de
frontera (Rivera, Rio Branco, Chuy, Artigas, Bella Union, Acegua). El catalogo
online parece ser UNICO para toda la cadena, no especifico de Rivera -- lo
mas probable es que estos productos esten disponibles en la sucursal de
Rivera tambien, pero no hay forma de confirmarlo 100% por producto.

Cada categoria puede tener MUCHISIMAS paginas (la de perfumeria por si sola
tiene mas de 100). Por eso este scraper lee "Pagina X de Y" para saber
cuantas paginas recorrer en vez de usar un numero fijo, y va a tardar mas
que los demas scrapers -- es normal, dejalo correr.
"""
import re
import sys
import time
from pathlib import Path
from urllib.parse import urljoin

sys.path.append(str(Path(__file__).parent))
from utils import finalize_scrape, load_previous_store, navigate, discover_menu_categories, get_soup, clean_price, save_products, POLITE_DELAY

LAST_RUN_STATUS = {}

BASE_URL = "https://www.neutral.com.uy"

# id_categoria: nombre para mostrar
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

HARD_SAFETY_CAP = 500  # nunca recorrer mas paginas que esto por categoria, pase lo que pase


def _total_pages(soup, fallback=1):
    text = soup.get_text(" ", strip=True)
    match = re.search(r"P[aá]gina\s*(\d+)\s*de\s*(\d+)", text, re.I)
    if match:
        try:
            return int(match.group(2))
        except ValueError:
            return fallback
    pages = [int(m.group(1)) for a in soup.select('a[href]')
             if (m := re.search(r'[?&]page=(\d+)', a['href']))]
    return max(pages, default=fallback)


def _extract_products(soup, slug):
    products = []
    product_links = [
        a for a in soup.find_all("a", href=True)
        if re.search(r"/products/\d+", a["href"])
    ]
    for link in product_links:
        text = link.get_text(" ", strip=True)
        from utils import PRICE_RE
        matches = list(PRICE_RE.finditer(text))
        price = clean_price(matches[-1].group(0)) if matches else None
        original = clean_price(matches[0].group(0)) if len(matches) > 1 else None
        name_tag = link.select_one('h2, h3, h4, .product-name, .product-title')
        name = name_tag.get_text(' ', strip=True) if name_tag else ''
        if not name:
            name = PRICE_RE.sub('', text).strip(' -–')
        if not name and link.find('img'):
            name = link.find('img').get('alt', '').strip()
        if not name:
            continue

        href = link["href"]
        if not href.startswith("http"):
            href = BASE_URL + href

        img = link.find("img")
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


def scrape_category(category_id, slug):
    products = []
    page = 1
    total_pages = None
    signatures = set()

    while page <= HARD_SAFETY_CAP:
        url = f"{BASE_URL}/es/products/category/{category_id}"
        if page > 1:
            url += f"?page={page}"

        soup = get_soup(url)
        if soup is None:
            LAST_RUN_STATUS.update(partial=True, warning="Neutral: páginas fallidas; catálogo parcial")
            if total_pages is None:
                break
            page += 1
            if page > total_pages:
                break
            continue

        if total_pages is None:
            total_pages = _total_pages(soup, fallback=1)
            if total_pages > HARD_SAFETY_CAP:
                raise RuntimeError(f"Neutral {slug}: {total_pages} páginas supera el límite de seguridad")
            print(f"[Neutral]   {slug}: {total_pages} paginas en total")

        found = _extract_products(soup, slug)
        if not found:
            LAST_RUN_STATUS.update(partial=True, warning="Neutral: página vacía inesperada; catálogo parcial")
        signature = tuple(sorted(x['url'] for x in found))
        if found and signature in signatures:
            LAST_RUN_STATUS.update(partial=True, warning="Neutral: el servidor repitió una página")
            break
        signatures.add(signature)
        products.extend(found)

        if page % 15 == 0:
            print(f"[Neutral]   {slug}: pagina {page}/{total_pages}, {len(products)} productos hasta ahora")

        if total_pages and page >= total_pages:
            break

        page += 1
        time.sleep(POLITE_DELAY)

    return products


def run():
    LAST_RUN_STATUS.clear()
    all_products = []
    for category_id, slug in CATEGORIES.items():
        print(f"[Neutral] recorriendo categoria: {slug}")
        found = scrape_category(category_id, slug)
        print(f"[Neutral]   -> {len(found)} productos")
        all_products.extend(found)

    seen = set()
    unique = []
    for p in all_products:
        key = p["url"] or p["nombre"]
        if key not in seen:
            seen.add(key)
            unique.append(p)

    out_dir = Path(__file__).parent.parent / "data"
    finalize_scrape(unique, "neutral", out_dir, LAST_RUN_STATUS)
    return unique


if __name__ == "__main__":
    run()
