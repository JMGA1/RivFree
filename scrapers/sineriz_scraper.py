
from concurrent.futures import ThreadPoolExecutor, as_completed
import re
import sys
from pathlib import Path
from urllib.parse import urljoin, urlparse

sys.path.append(str(Path(__file__).parent))
from utils import (
    PRICE_RE,
    catalog_metrics,
    clean_price,
    dedupe_products_prefer_complete,
    extract_image_url,
    finalize_scrape,
    get_soup,
)

LAST_RUN_STATUS = {}
BASE_URL = "https://www.sineriz.com.uy"
FALLBACK_CATEGORIES = [
    "esportes-1", "bazar-1", "relogios-1", "ferramentas-1",
    "comestiveis-1", "eletronicos-1", "bebidas-1", "infantil-1",
    "perfumaria-e-beleza",
]
DETAIL_WORKERS = 4
MAX_DETAIL_RECOVERY = 200


def discover_categories():
    for seed in (f"{BASE_URL}/produtos/", f"{BASE_URL}/produtos/eletronicos-1/"):
        soup = get_soup(seed, retries=3, delay=2, timeout=30)
        if soup is None:
            continue
        found = []
        for a in soup.find_all("a", href=True):
            parsed = urlparse(urljoin(BASE_URL, a["href"]))
            match = re.fullmatch(r"/produtos/([^/]+)/?", parsed.path)
            if match:
                slug = match.group(1)
                if slug and slug not in found:
                    found.append(slug)
        if len(found) >= 5:
            return found
    return list(FALLBACK_CATEGORIES)


def _parse_products_from_soup(soup, slug):
    """Extrae productos sin tomar el precio de una tarjeta vecina."""
    links_by_url = {}
    for link in soup.find_all("a", href=True):
        if re.search(r"/produtos/[^/]+/[^/]+/?$", link["href"]):
            href = urljoin(BASE_URL, link["href"])
            links_by_url.setdefault(href, []).append(link)

    products = []
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
            for _ in range(5):
                if container.parent is None:
                    break
                container = container.parent
                related = {
                    urljoin(BASE_URL, a["href"])
                    for a in container.select("a[href]")
                    if re.search(r"/produtos/[^/]+/[^/]+/?$", a["href"])
                }
                # Si el contenedor ya incluye otra ficha, cualquier precio que
                # aparezca ahí es ambiguo y NO puede asignarse a este producto.
                if len(related) > 1:
                    break
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
    return dedupe_products_prefer_complete(products)


def _scrape_category_with_status(slug, page=None):
    from bs4 import BeautifulSoup

    url = f"{BASE_URL}/produtos/{slug}/"

    # Camino compatible con tests/utilidades: HTML estático por requests.
    if page is None:
        soup = get_soup(url)
        if soup is None:
            return [], "categoría sin respuesta"
        products = _parse_products_from_soup(soup, slug)
        return products, None if products else "categoría sin productos legibles"

    fragments = []
    signatures = set()
    partial_error = None
    try:
        response = page.goto(url, wait_until="domcontentloaded", timeout=45000)
        if response is not None and response.status >= 400:
            raise RuntimeError(f"HTTP {response.status}")
        page.wait_for_selector('a[href*="/produtos/"]', timeout=15000)

        for _ in range(300):
            previous = -1
            stable = 0
            for round_no in range(200):
                count = page.locator('a[href*="/produtos/"]').count()
                stable = stable + 1 if count == previous else 0
                previous = count
                more = page.get_by_role(
                    "button",
                    name=re.compile(r"ver mais|carregar mais|mostrar mais|load more", re.I),
                ).first
                active = more.count() and more.is_visible() and more.is_enabled()
                if active:
                    more.click(timeout=10000)
                if stable >= 4 and not active:
                    break
                if stable >= 8 or round_no == 199:
                    raise RuntimeError("carga de productos incompleta")
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1200)

            fragment = BeautifulSoup(page.content(), "html.parser")
            signature = tuple(sorted({
                urljoin(BASE_URL, a["href"])
                for a in fragment.select("a[href]")
                if re.search(r"/produtos/[^/]+/[^/]+/?$", a.get("href", ""))
            }))
            if not signature:
                raise RuntimeError("sin productos legibles")
            if signature in signatures:
                raise RuntimeError("página repetida")
            signatures.add(signature)
            fragments.append(str(fragment))

            button = page.locator(
                'a[rel="next"], .pagination .next a, .paginacao .next a'
            ).first
            if (
                not button.count()
                or not button.is_visible()
                or not button.is_enabled()
                or button.get_attribute("aria-disabled") == "true"
            ):
                break
            button.click(timeout=10000)
            page.wait_for_timeout(1500)
        else:
            raise RuntimeError("límite de paginación alcanzado")

    except Exception as exc:
        partial_error = str(exc)
        # Una falla tardía conserva todo lo que ya se alcanzó a renderizar.
        try:
            current = BeautifulSoup(page.content(), "html.parser")
            current_signature = tuple(sorted({
                urljoin(BASE_URL, a["href"])
                for a in current.select("a[href]")
                if re.search(r"/produtos/[^/]+/[^/]+/?$", a.get("href", ""))
            }))
            if current_signature and current_signature not in signatures:
                fragments.append(str(current))
        except Exception:
            pass

    if not fragments:
        return [], partial_error or "categoría sin productos legibles"

    soup = BeautifulSoup("".join(fragments), "html.parser")
    return _parse_products_from_soup(soup, slug), partial_error


def scrape_category(slug, page=None):
    """API pública histórica: siempre devuelve solo la lista de productos."""
    products, _ = _scrape_category_with_status(slug, page)
    return products


def _recover_detail(product):
    soup = get_soup(product["url"], retries=2, delay=1, timeout=25)
    if soup is None:
        return product["url"], None
    selectors = ".price, .preco, .produto-preco, [class*='price'], [class*='preco']"
    for tag in soup.select(selectors):
        price = clean_price(tag.get_text(" ", strip=True))
        if price:
            return product["url"], price
    main = soup.select_one("main, article, #content")
    match = PRICE_RE.search((main or soup).get_text(" ", strip=True))
    return product["url"], clean_price(match.group(0)) if match else None


def run():
    global LAST_RUN_STATUS
    LAST_RUN_STATUS = {}
    from playwright.sync_api import sync_playwright

    categories = discover_categories()
    all_products = []
    failed_categories = []
    print(f"[Sineriz] {len(categories)} categorías descubiertas")
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, args=["--disable-dev-shm-usage"])
        page = browser.new_page(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36"
        )
        try:
            for slug in categories:
                found, error = _scrape_category_with_status(slug, page)
                if error and not found:
                    failed_categories.append(slug)
                    print(f"[Sineriz] [aviso] {slug}: {error}")
                    continue
                if error:
                    failed_categories.append(slug)
                    print(f"[Sineriz] [aviso] {slug}: avance parcial conservado ({error})")
                print(
                    f"[Sineriz] {slug}: {len(found)} productos; "
                    f"{sum(p.get('precio_usd') is not None for p in found)} con precio"
                )
                all_products.extend(found)
        finally:
            browser.close()

    unique = dedupe_products_prefer_complete(all_products)
    if not unique:
        raise RuntimeError("Sineriz: ninguna categoría produjo productos")

    missing = [p for p in unique if p.get("precio_usd") is None and p.get("url")]
    selected = missing[:MAX_DETAIL_RECOVERY]
    by_url = {p["url"]: p for p in unique if p.get("url")}
    recovered = 0
    failed_details = 0
    with ThreadPoolExecutor(max_workers=DETAIL_WORKERS, thread_name_prefix="sineriz") as executor:
        futures = [executor.submit(_recover_detail, p) for p in selected]
        for future in as_completed(futures):
            try:
                url, price = future.result()
            except Exception:
                failed_details += 1
                continue
            if price:
                by_url[url]["precio_usd"] = price
                by_url[url]["precio_fuente"] = "ficha"
                recovered += 1
            else:
                failed_details += 1

    pending = sum(p.get("precio_usd") is None for p in unique)
    metrics = catalog_metrics(unique)
    metrics.update({
        "categorias_descubiertas": len(categories),
        "categorias_fallidas": len(failed_categories),
        "productos_frescos": len(unique),
        "precios_desde_listado": metrics["precios_disponibles"] - recovered,
        "fichas_consultadas": len(selected),
        "precios_recuperados": recovered,
        "fichas_fallidas": failed_details,
        "fichas_no_visitadas": max(0, len(missing) - len(selected)),
        "precios_pendientes": pending,
    })
    warning_parts = []
    if failed_categories:
        warning_parts.append(f"{len(failed_categories)} categorías fallaron")
    if pending:
        warning_parts.append(f"{pending} precios pendientes")
    warning = "Sineriz parcial: " + "; ".join(warning_parts) if warning_parts else None
    LAST_RUN_STATUS = {"partial": bool(warning), "warning": warning, "metrics": metrics}
    finalize_scrape(unique, "sineriz", Path(__file__).parent.parent / "data", LAST_RUN_STATUS)
    return unique


if __name__ == "__main__":
    run()
