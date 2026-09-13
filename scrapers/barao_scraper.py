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

CATEGORIES = [
    # Perfumes
    "femininos", "masculinos", "nicho-perfumes",
    # Cosmeticos / pele (una seleccion representativa, no las 40 marcas)
    "esteelauder", "lancomecosmeticos", "clinique", "loreal", "maybelline",
    "larocheposay", "cerave", "victorias",
    # Cabelo
    "kerastase", "wella", "olaplex-cabelo",
    # Bebidas
    "whisky-s", "vinhos", "espumantes", "vodka-s", "gim", "licores",
    "cervejas", "energeticos", "rumepisco", "tequilas",
    # Eletronicos
    "celulares", "informatica", "tabletsenotebooks", "tvs", "audioevideo",
    "jbl", "apple", "samsung", "cameras-e-gps", "ar-condicionado",
    "eletrodomesticos", "relogio", "games-acessorios",
    # Comestiveis
    "copia-de-condimentos", "alfajores", "azeites-de-oliva", "biscoitos",
    # Bazar
    "decoracao", "cozinha", "cristais-vidros-finos", "porcelanas",
    # Vestuario / calcados
    "nike", "vans", "tommy-vestimesta", "bolsas-malas-mochilas",
    # Kids
    "barbie", "funkopop", "pokemon", "diversosinfantil",
]

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

    out_dir = Path(__file__).parent.parent / "data"
    save_products(unique, "barao", out_dir)
    return unique


if __name__ == "__main__":
    run()
