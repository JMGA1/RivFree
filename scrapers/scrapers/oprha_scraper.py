"""Scraper resiliente de Oprha Free Shop (Wix).

En vez de depender solamente de tres slugs hardcodeados, descubre categorías
visibles en el menú/sitemap y conserva una pequeña lista histórica únicamente
como fallback. Las categorías y fichas se procesan en paralelo con requests,
y un fallo puntual no descarta todo el catálogo.
"""
from concurrent.futures import ThreadPoolExecutor, as_completed
import json
import re
import sys
from pathlib import Path
from urllib.parse import urljoin, urlparse

sys.path.append(str(Path(__file__).parent))
from utils import get_soup, save_products, extract_wix_detail_price

BASE_URL = "https://www.oprhafreeshop.com.br"
FALLBACK_CATEGORIES = ["masculinos-a-l", "perfumesfemininos", "cosmeticos"]
CATEGORY_LABELS = {"masculinos-a-l": "perfumeria-masculinos"}
MAX_PAGES_PER_CATEGORY = 50
CATEGORY_WORKERS = 5
DETAIL_WORKERS = 10
LAST_RUN_STATUS = {}

# Páginas institucionales que no son categorías de catálogo.
IGNORED_SLUGS = {
    "", "home", "inicio", "sobre", "sobre-nos", "contato", "contact", "contacto",
    "politica-de-privacidade", "politica-privacidade", "termos", "termos-de-uso",
    "faq", "blog", "carrinho", "cart", "checkout", "login", "minha-conta",
    "wishlist", "buscar", "search",
}


def _load_previous():
    path = Path(__file__).parent.parent / "data" / "oprha.json"
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else []
    except (OSError, ValueError):
        return []


def _slug_from_url(href):
    try:
        parsed = urlparse(urljoin(BASE_URL, href))
    except ValueError:
        return None
    host = parsed.netloc.lower().removeprefix("www.")
    base_host = urlparse(BASE_URL).netloc.lower().removeprefix("www.")
    if host and host != base_host:
        return None
    path = parsed.path.strip("/")
    if not path or "/" in path or path.startswith("product-page"):
        return None
    slug = path.lower()
    if slug in IGNORED_SLUGS or slug.startswith(("_", "wix-")):
        return None
    return slug


def _discover_categories_rendered():
    """Lee el menú ya renderizado cuando Wix no lo incluye en el HTML inicial."""
    from playwright.sync_api import sync_playwright

    candidates = set()
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=True)
            page = browser.new_page()
            try:
                page.goto(BASE_URL, wait_until="domcontentloaded", timeout=40000)
                page.wait_for_timeout(1200)
                hrefs = page.locator(
                    'nav a[href], header a[href], [role="navigation"] a[href]'
                ).evaluate_all('links => links.map(a => a.href)')
                if not hrefs:
                    hrefs = page.locator('a[href]').evaluate_all('links => links.map(a => a.href)')
                for href in hrefs:
                    slug = _slug_from_url(href)
                    if slug:
                        candidates.add(slug)
            finally:
                browser.close()
    except Exception as exc:
        print(f"[Oprha] [aviso] no se pudo descubrir el menú renderizado: {exc}")
    return candidates


def discover_categories():
    """Descubre slugs de categorías desde navegación HTML y sitemap.

    No asumimos que todo enlace sea categoría: después cada candidato se valida
    porque collect_product_urls solo lo acepta si realmente contiene productos.
    """
    candidates = set()
    home = get_soup(BASE_URL, retries=4, delay=2, timeout=40)
    if home is not None:
        selectors = "nav a[href], header a[href], [role='navigation'] a[href]"
        links = home.select(selectors) or home.find_all("a", href=True)
        for anchor in links:
            slug = _slug_from_url(anchor.get("href"))
            if slug:
                candidates.add(slug)

    # Si el menú no vino renderizado en el HTML, usamos el sitemap como
    # segunda fuente. Así evitamos confundir páginas institucionales con
    # categorías cuando la navegación normal sí está disponible.
    if len(candidates) < 2:
        sitemap = get_soup(f"{BASE_URL}/sitemap.xml", retries=2, delay=1, timeout=30)
        if sitemap is not None:
            for loc in sitemap.find_all("loc"):
                slug = _slug_from_url(loc.get_text(" ", strip=True))
                if slug:
                    candidates.add(slug)

    # Si todavía solo vemos muy pocos candidatos, intentamos el menú ya
    # renderizado por Wix antes de recurrir a los slugs históricos.
    if len(candidates) < 4:
        candidates.update(_discover_categories_rendered())

    # Estos slugs solo sirven de red de seguridad si el menú/sitemap cambia.
    candidates.update(FALLBACK_CATEGORIES)
    return sorted(candidates)


def collect_product_urls(slug):
    urls = set()
    page_no = 1
    low_yield_streak = 0
    failed_pages = []

    while page_no <= MAX_PAGES_PER_CATEGORY:
        url = f"{BASE_URL}/{slug}" if page_no == 1 else f"{BASE_URL}/{slug}?page={page_no}"
        soup = get_soup(url, retries=3, delay=2, timeout=35)
        if soup is None:
            # Si la primera página no responde, el candidato no es usable. Si ya
            # había resultados, conservamos lo obtenido y marcamos parcial.
            if page_no > 1 and urls:
                failed_pages.append(page_no)
            break

        links = []
        for anchor in soup.find_all("a", href=True):
            href = anchor["href"]
            if "/product-page/" in href:
                links.append(urljoin(BASE_URL, href).split("#")[0])

        if not links:
            break

        before = len(urls)
        urls.update(links)
        new_found = len(urls) - before
        low_yield_streak = low_yield_streak + 1 if new_found <= 2 else 0
        if low_yield_streak >= 3:
            break
        page_no += 1

    return slug, urls, failed_pages


def scrape_product_page(url, slug):
    soup = get_soup(url, retries=3, delay=1, timeout=30)
    if soup is None:
        return None

    # Solo precio visible del bloque principal; ignoramos metadatos SEO viejos.
    price, original = extract_wix_detail_price(soup)

    title_tag = soup.find("meta", attrs={"property": "og:title"})
    name = title_tag["content"] if title_tag and title_tag.get("content") else None
    if not name:
        h1 = soup.find("h1")
        name = h1.get_text(" ", strip=True) if h1 else None
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


def _rendered_discovery(slugs):
    """Fallback Playwright: obtiene URLs si Wix no las entrega en HTML."""
    from playwright.sync_api import sync_playwright
    from utils import expand_wix_catalog

    found = {}
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            for slug in slugs:
                try:
                    page.goto(f"{BASE_URL}/{slug}", wait_until="domcontentloaded", timeout=40000)
                    page.wait_for_selector('a[href*="/product-page/"]', timeout=15000)
                    expand_wix_catalog(page, max_rounds=50)
                    hrefs = page.locator('a[href*="/product-page/"]').evaluate_all(
                        "links => links.map(a => a.href)"
                    )
                    for href in hrefs:
                        found.setdefault(href.split("#")[0], slug)
                except Exception as exc:
                    print(f"[Oprha] [aviso] fallback renderizado {slug}: {exc}")
        finally:
            browser.close()
    return found


def _merge_previous(products, previous, failed_detail_urls):
    previous_by_url = {p.get("url"): p for p in previous if isinstance(p, dict) and p.get("url")}
    current_by_url = {p.get("url"): p for p in products if p.get("url")}

    # Si una ficha puntual falló, conservamos su última observación conocida.
    for url in failed_detail_urls:
        if url not in current_by_url and url in previous_by_url:
            current_by_url[url] = previous_by_url[url]
    return list(current_by_url.values())


def run():
    global LAST_RUN_STATUS
    LAST_RUN_STATUS = {}

    categories = discover_categories()
    print(f"[Oprha] categorías candidatas descubiertas: {len(categories)}")

    all_urls = {}  # url -> slug
    category_failures = []
    category_page_failures = {}

    # Cada categoría pagina secuencialmente, pero distintas categorías se pueden
    # procesar en paralelo sin abrir un browser por cada una.
    with ThreadPoolExecutor(max_workers=CATEGORY_WORKERS, thread_name_prefix="oprha-cat") as executor:
        futures = {executor.submit(collect_product_urls, slug): slug for slug in categories}
        for future in as_completed(futures):
            slug = futures[future]
            try:
                _, urls, failed_pages = future.result()
            except Exception as exc:
                category_failures.append(slug)
                print(f"[Oprha] [aviso] categoría {slug}: {exc}")
                continue

            if not urls:
                # Puede ser una página institucional descubierta en el menú;
                # no la tratamos como error real.
                continue
            if failed_pages:
                category_page_failures[slug] = failed_pages
            print(f"[Oprha] {slug}: {len(urls)} fichas")
            for url in urls:
                all_urls.setdefault(url, slug)

    if not all_urls:
        print("[Oprha] HTML sin catálogo suficiente; intentando fallback renderizado...")
        all_urls.update(_rendered_discovery(categories or FALLBACK_CATEGORIES))

    if not all_urls:
        raise RuntimeError(
            "Oprha no expone actualmente un catálogo accesible; se conserva el último catálogo válido"
        )

    print(f"[Oprha] procesando {len(all_urls)} fichas con {DETAIL_WORKERS} workers...")
    products = []
    failed_detail_urls = []

    with ThreadPoolExecutor(max_workers=DETAIL_WORKERS, thread_name_prefix="oprha-detail") as executor:
        futures = {
            executor.submit(scrape_product_page, url, slug): (url, slug)
            for url, slug in all_urls.items()
        }
        done = 0
        for future in as_completed(futures):
            url, _ = futures[future]
            done += 1
            try:
                item = future.result()
            except Exception as exc:
                item = None
                print(f"[Oprha] [aviso] ficha {url}: {exc}")
            if item:
                products.append(item)
            else:
                failed_detail_urls.append(url)
            if done % 50 == 0 or done == len(futures):
                print(f"[Oprha] fichas {done}/{len(futures)}; válidas {len(products)}")

    previous = _load_previous()
    merged = _merge_previous(products, previous, failed_detail_urls)
    if not merged:
        raise RuntimeError("Oprha: no se pudo extraer ninguna ficha válida")

    warnings = []
    if category_failures:
        warnings.append(f"{len(category_failures)} categorías fallaron")
    if category_page_failures:
        warnings.append(f"{len(category_page_failures)} categorías tuvieron páginas parciales")
    if failed_detail_urls:
        warnings.append(f"{len(failed_detail_urls)} fichas fallaron")

    if warnings:
        warning = "Oprha parcial: " + "; ".join(warnings)
        LAST_RUN_STATUS = {"partial": True, "warning": warning}
        print(f"[Oprha] [aviso] {warning}")
    else:
        LAST_RUN_STATUS = {"partial": False}

    save_products(merged, "oprha", Path(__file__).parent.parent / "data")
    return merged


if __name__ == "__main__":
    run()
