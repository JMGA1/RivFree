"""
Scraper para Barao Free Shop (https://www.baraofreeshop.com.br/)

IMPORTANTE: este sitio corre en Wix. La grilla de productos se carga con
JavaScript despues de la carga inicial de la pagina, asi que un pedido HTTP
simple (requests) recibe una version "vacia" sin productos. Por eso este
scraper usa Playwright (un Chrome invisible) para renderizar la pagina de
verdad antes de leer los productos, igual que el scraper de Sineriz.

Barao tiene MUCHISIMAS categorias (mas de 150, una por marca). Esta lista
cubre las mas relevantes/generales de cada rubro para no hacer el scraper
eterno. Se pueden agregar mas slugs copiandolos del menu del sitio.
"""
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).parent))
from utils import save_products, expand_wix_catalog, extract_wix_products

BASE_URL = "https://www.baraofreeshop.com.br"

RESERVED_PATHS = {
    "", "shop", "blog", "contato", "turista", "social", "trabalhe-conosco",
    "lista-de-desejos", "home", "inicio", "o-barao", "seguranca-e-saude-no-trabalho",
    "blog-barao", "politica-de-privacidade"
}

def discover_categories():
    """Descubre categorías del menú actual para no depender de una lista manual."""
    from urllib.parse import urlparse
    from utils import get_soup
    soup = get_soup(BASE_URL)
    if soup is None:
        raise RuntimeError("Barão no respondió al descubrir categorías")
    slugs=[]
    for a in soup.find_all("a", href=True):
        parsed=urlparse(a["href"] if a["href"].startswith("http") else BASE_URL+a["href"])
        if parsed.netloc and "baraofreeshop.com.br" not in parsed.netloc:
            continue
        path=parsed.path.strip("/")
        if not path or "/" in path or path in RESERVED_PATHS or path.startswith("product-page"):
            continue
        if path not in slugs: slugs.append(path)
    if len(slugs) < 20:
        raise RuntimeError(f"Barão: solo se descubrieron {len(slugs)} categorías; menú posiblemente cambió")
    return slugs


# Algunas categorias de Barao son solo el nombre de una marca (ej: "clinique",
# "kerastase") sin ninguna palabra que indique de que rubro son. Para que el
# sitio las clasifique bien en el filtro de categoria, les agregamos una
# "etiqueta" con una palabra descriptiva. Si un slug no esta aca, se usa tal
# cual (funciona bien para categorias ya descriptivas como "whisky-s").
CATEGORY_LABELS = {
    "femininos": "perfumeria-femininos",
    "masculinos": "perfumeria-masculinos",
    "esteelauder": "cosmetica-esteelauder",
    "lancomecosmeticos": "cosmetica-lancome",
    "clinique": "cosmetica-clinique",
    "loreal": "cosmetica-loreal",
    "maybelline": "cosmetica-maybelline",
    "larocheposay": "cosmetica-larocheposay",
    "cerave": "cosmetica-cerave",
    "victorias": "cosmetica-victoriassecret",
    "kerastase": "cosmetica-kerastase",
    "wella": "cosmetica-wella",
    "tommy-vestimesta": "ropa-tommy",
    "barbie": "jugueteria-barbie",
    "funkopop": "jugueteria-funkopop",
    "pokemon": "jugueteria-pokemon",
    "copia-de-condimentos": "chocolates",
}

def scrape_category(slug, page):
    from bs4 import BeautifulSoup
    url = f"{BASE_URL}/{slug}"
    try:
        page.goto(url, wait_until="domcontentloaded", timeout=30000)
        page.wait_for_selector('[data-hook="product-item-root"]', timeout=20000)
        loaded = expand_wix_catalog(page)
        soup = BeautifulSoup(page.content(), "html.parser")
        products = extract_wix_products(
            soup, "Barão Free Shop", CATEGORY_LABELS.get(slug, slug), BASE_URL
        )
        if loaded and len(products) < loaded:
            print(f"  [aviso] se cargaron {loaded} tarjetas pero solo se pudieron leer {len(products)}")
        return products
    except Exception as e:
        # El menú también puede contener páginas institucionales de una sola ruta.
        # Las ignoramos, pero la validación final evita publicar un catálogo
        # sospechosamente pequeño si realmente cambió la tienda.
        print(f"  [aviso] se omite {url}: {e}")
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

        categories = discover_categories()
        print(f"[Barao] {len(categories)} categorías descubiertas en el menú")
        for slug in categories:
            print(f"[Barao] recorriendo categoria: {slug}")
            found = scrape_category(slug, page)
            print(f"[Barao]   -> {len(found)} productos")
            all_products.extend(found)

        browser.close()

    seen = set()
    unique = []
    for pr in all_products:
        key = pr["url"] or pr["nombre"]
        if key not in seen:
            seen.add(key)
            unique.append(pr)

    if len(unique) < 1000:
        raise RuntimeError(f"Barão incompleto: solo se extrajeron {len(unique)} productos")
    out_dir = Path(__file__).parent.parent / "data"
    save_products(unique, "barao", out_dir)
    return unique


if __name__ == "__main__":
    run()
