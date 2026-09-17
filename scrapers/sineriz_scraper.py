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
from utils import finalize_scrape, load_previous_store, navigate, discover_menu_categories, get_soup, clean_price, save_products, extract_image_url

LAST_RUN_STATUS = {}

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
            navigate(page, url)
            page.wait_for_selector('a[href*="/produtos/"]', timeout=15000)
            fragments = []
            signatures = set()
            for page_no in range(300):
                previous = -1
                stable = 0
                for round_no in range(200):
                    count = page.locator('a[href*="/produtos/"]').count()
                    stable = stable + 1 if count == previous else 0
                    previous = count
                    more = page.get_by_role('button', name=re.compile(r'ver mais|carregar mais|mostrar mais|load more', re.I)).first
                    active = more.count() and more.is_visible() and more.is_enabled()
                    if active:
                        more.click(timeout=10000)
                    if stable >= 4 and not active:
                        break
                    if stable >= 8 or round_no == 199:
                        raise RuntimeError('Carga de productos incompleta')
                    page.evaluate('window.scrollTo(0, document.body.scrollHeight)')
                    page.wait_for_timeout(1500)
                fragment = BeautifulSoup(page.content(), 'html.parser')
                signature = tuple(sorted({a['href'] for a in fragment.select('a[href]')
                    if re.search(r'/produtos/[^/]+/[^/]+/?$', a['href'])}))
                if signature in signatures:
                    raise RuntimeError('Página repetida')
                signatures.add(signature)
                fragments.append(str(fragment))
                button = page.locator('a[rel="next"], .pagination .next a, .paginacao .next a').first
                if not button.count() or not button.is_visible() or not button.is_enabled() or button.get_attribute('aria-disabled') == 'true':
                    break
                button.click(timeout=10000)
                page.wait_for_timeout(2000)
            else:
                raise RuntimeError('Límite de paginación alcanzado')
            soup = BeautifulSoup(''.join(fragments), 'html.parser')
        except Exception as exc:
            LAST_RUN_STATUS.update(partial=True, warning="Sineriz: categorías fallidas; catálogo parcial")
            print(f"  [aviso] no se pudo cargar {url}: {exc}")
            return products
    if soup is None:
        LAST_RUN_STATUS.update(partial=True, warning="Sineriz: categoría sin respuesta")
        return products

    # Cada producto es un link a una ficha bajo /produtos/<categoria>/<slug-producto>/
    product_links = [
        a for a in soup.find_all("a", href=True)
        if re.search(r"/produtos/[^/]+/[^/]+/?$", a["href"])
        and a["href"].rstrip("/") != f"{BASE_URL}/produtos/{slug}".rstrip("/")
    ]

    if not product_links:
        LAST_RUN_STATUS.update(partial=True, warning="Sineriz: categoría sin productos legibles")
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
                related = {urljoin(BASE_URL, a['href']) for a in container.select('a[href]')
                           if re.search(r"/produtos/[^/]+/[^/]+/?$", a['href'])}
                if len(related) > 1:
                    break
                from utils import PRICE_RE
                match = PRICE_RE.search(container.get_text(" ", strip=True))
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
    LAST_RUN_STATUS.clear()
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
    finalize_scrape(unique, "sineriz", out_dir, LAST_RUN_STATUS)
    return unique


if __name__ == "__main__":
    run()
