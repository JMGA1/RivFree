"""Mantra Free Shop (Ecwid): extrae del listado y evita castigar al servidor.

El catálogo/listado ya expone nombre y precio. Las fichas individuales se usan
solo para completar registros realmente incompletos. Los HTTP 429 activan
backoff largo en lugar de aumentar la concurrencia.
"""
import asyncio
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
    finalize_scrape,
    load_previous_store,
    merge_product_records,
)

BASE_URL = "https://mantrafreeshop.com"
CATEGORY_RE = re.compile(r"-c\d+/?(?:$|[?#])", re.I)
PRODUCT_RE = re.compile(r"-p\d+/?(?:$|[?#])", re.I)
CATEGORY_WORKERS = 1
DETAIL_WORKERS = 1
NAV_TIMEOUT_MS = 45000
DETAIL_TIMEOUT_MS = 25000
REQUEST_PAUSE_MS = 900
MAX_DETAIL_RECOVERY = 120
LAST_RUN_STATUS = {}


def _slug_from_url(url):
    path = urlparse(url).path.strip("/")
    return re.sub(r"-c\d+$", "", path) or "varios"


def _load_previous():
    return load_previous_store("mantra", Path(__file__).parent.parent / "data")


async def _goto(page, url, retries=4, timeout_ms=NAV_TIMEOUT_MS):
    """Navega con backoff especial para 429."""
    last = None
    rate_limited = 0
    for attempt in range(1, retries + 1):
        try:
            response = await page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)
            status = response.status if response is not None else 200
            if status == 429:
                rate_limited += 1
                wait_ms = min(90000, 10000 * (3 ** (rate_limited - 1)))
                print(f"[Mantra] HTTP 429 en {url}; pausa {wait_ms/1000:.0f}s antes de reintentar")
                await page.wait_for_timeout(wait_ms)
                last = RuntimeError(f"HTTP 429: {url}")
                continue
            if status >= 400:
                raise RuntimeError(f"HTTP {status}: {url}")
            await page.wait_for_timeout(REQUEST_PAUSE_MS)
            return response
        except Exception as exc:
            last = exc
            if attempt < retries:
                await page.wait_for_timeout(min(15000, 1500 * attempt))
    raise RuntimeError(f"no se pudo cargar {url}: {last}")


def _extract_listing_products_from_html(html, category):
    """Extrae nombre/precio/imagen directamente de la grilla Ecwid."""
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html, "html.parser")
    products = {}
    for link in soup.find_all("a", href=True):
        href = urljoin(BASE_URL, link.get("href", ""))
        if not PRODUCT_RE.search(href):
            continue
        if urlparse(href).netloc.removeprefix("www.") != "mantrafreeshop.com":
            continue

        container = link
        best = link
        for _ in range(7):
            if container is None:
                break
            product_urls = {
                urljoin(BASE_URL, a.get("href", ""))
                for a in container.find_all("a", href=True)
                if PRODUCT_RE.search(urljoin(BASE_URL, a.get("href", "")))
            }
            if len(product_urls) > 1:
                break
            best = container
            if PRICE_RE.search(container.get_text(" ", strip=True)):
                break
            container = container.parent

        text = best.get_text(" ", strip=True)
        prices = [clean_price(m.group(0)) for m in PRICE_RE.finditer(text)]
        prices = [p for p in prices if p is not None and p > 0]
        current = prices[-1] if prices else None
        original = prices[0] if len(prices) > 1 and prices[0] > current else None

        name = link.get_text(" ", strip=True)
        img = best.find("img") if best else None
        if not name and img:
            name = img.get("alt", "").strip()
        # En Ecwid el enlace puede contener precio+nombre; quitamos los importes.
        if name:
            name = PRICE_RE.sub("", name).strip(" -–|:")
        if not name:
            title = best.select_one(".grid-product__title, .ec-store__product-page--title, h2, h3") if best else None
            name = title.get_text(" ", strip=True) if title else None
        if not name:
            continue

        image = None
        if img:
            image = img.get("data-src") or img.get("src")
        product = {
            "tienda": "Mantra Free Shop",
            "nombre": name,
            "precio_usd": current,
            "precio_original_usd": original,
            "en_oferta": bool(original and current and original > current),
            "categoria": category,
            "url": href.split("#")[0],
            "imagen": image,
            "precio_fuente": "listado" if current is not None else None,
        }
        products[product["url"]] = merge_product_records(products.get(product["url"]), product)
    return list(products.values())


async def _collect_links(page):
    links = await page.locator("a[href]").evaluate_all("els => els.map(a => a.href)")
    cats = []
    for href in links:
        if not href:
            continue
        clean = href.split("#")[0]
        if urlparse(clean).netloc.removeprefix("www.") == "mantrafreeshop.com" and CATEGORY_RE.search(clean):
            cats.append(clean)
    return list(dict.fromkeys(cats))


async def _expand(page, category, rounds=200):
    """Expande una grilla Ecwid sin perder lo ya observado ante una falla tardía."""
    categories = set()
    products = {}
    stable = 0
    signatures = set()
    warning = None
    for _ in range(rounds):
        categories.update(await _collect_links(page))
        found = _extract_listing_products_from_html(await page.content(), category)
        before = len(products)
        for item in found:
            products[item["url"]] = merge_product_records(products.get(item["url"]), item)
        stable = stable + 1 if len(products) == before else 0

        more = page.get_by_role("button", name=re.compile(r"load more|show more|mostrar mais|carregar mais|ver mais", re.I)).first
        if await more.count() and await more.is_visible() and await more.is_enabled():
            if stable >= 8:
                warning = "cargar más dejó de agregar productos"
                return sorted(categories), list(products.values()), warning
            try:
                await more.click(timeout=10000)
            except Exception as exc:
                warning = f"falló cargar más: {exc}"
                return sorted(categories), list(products.values()), warning
        elif stable >= 4:
            next_link = page.locator('.ec-pager__next a, a.ec-pager__next, a[rel="next"]').first
            if (await next_link.count() and await next_link.is_visible()
                    and await next_link.is_enabled()
                    and await next_link.get_attribute("aria-disabled") != "true"):
                signature = tuple(sorted(products))
                if signature in signatures:
                    warning = "paginación repetida"
                    return sorted(categories), list(products.values()), warning
                signatures.add(signature)
                try:
                    await next_link.click(timeout=10000)
                except Exception as exc:
                    warning = f"no se pudo abrir página siguiente: {exc}"
                    return sorted(categories), list(products.values()), warning
                stable = 0
            else:
                return sorted(categories), list(products.values()), warning
        await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        await page.wait_for_timeout(1300)

    warning = "límite de carga alcanzado"
    return sorted(categories), list(products.values()), warning


async def _discover_catalog(context):
    products = {}
    failed_categories = []
    partial_categories = []
    scheduled = set()
    queue = asyncio.Queue()

    first = await context.new_page()
    try:
        await _goto(first, BASE_URL, retries=4)
        initial_cats, initial_products, initial_warning = await _expand(first, "varios")
        for item in initial_products:
            products[item["url"]] = merge_product_records(products.get(item["url"]), item)
        if initial_warning:
            partial_categories.append(BASE_URL)
            print(f"[Mantra] [aviso] portada parcial: {initial_warning}")
    finally:
        await first.close()

    for cat in initial_cats:
        if cat not in scheduled:
            scheduled.add(cat)
            await queue.put(cat)

    async def worker(worker_id):
        page = await context.new_page()
        try:
            while True:
                cat = await queue.get()
                label = _slug_from_url(cat)
                try:
                    await _goto(page, cat, retries=4)
                    subcats, found, partial_warning = await _expand(page, label)
                    for item in found:
                        products[item["url"]] = merge_product_records(products.get(item["url"]), item)
                    if partial_warning:
                        partial_categories.append(cat)
                        print(f"[Mantra] [aviso] {label}: avance parcial ({partial_warning})")
                    for sub in subcats:
                        if sub not in scheduled:
                            scheduled.add(sub)
                            await queue.put(sub)
                    with_price = sum(p.get("precio_usd") is not None for p in found)
                    print(f"[Mantra] {label}: {len(found)} productos ({with_price} con precio); total {len(products)}")
                except Exception as exc:
                    failed_categories.append(cat)
                    print(f"[Mantra] [aviso] categoría {cat}: {exc}")
                finally:
                    queue.task_done()
        except asyncio.CancelledError:
            pass
        finally:
            await page.close()

    workers = [asyncio.create_task(worker(i + 1)) for i in range(CATEGORY_WORKERS)]
    await queue.join()
    for task in workers:
        task.cancel()
    await asyncio.gather(*workers, return_exceptions=True)
    return list(products.values()), failed_categories, partial_categories


async def _extract_detail(page, product):
    from bs4 import BeautifulSoup
    await _goto(page, product["url"], retries=3, timeout_ms=DETAIL_TIMEOUT_MS)
    await page.wait_for_timeout(800)
    soup = BeautifulSoup(await page.content(), "html.parser")
    title = soup.select_one(".product-details__product-title, .ecwid-productBrowser-head, h1")
    price_tag = soup.select_one(".product-details__product-price .details-product-price__value, .product-details__product-price-value, .ecwid-productBrowser-price")
    if title and not product.get("nombre"):
        product["nombre"] = title.get_text(" ", strip=True)
    price = clean_price(price_tag.get_text(" ", strip=True)) if price_tag else None
    if price is not None:
        product["precio_usd"] = price
        product["precio_fuente"] = "ficha"
    og = soup.find("meta", attrs={"property": "og:image"})
    if og and not product.get("imagen"):
        product["imagen"] = og.get("content")
    return product


async def _recover_details(context, products):
    missing = [p for p in products if not p.get("nombre") or p.get("precio_usd") is None]
    selected = missing[:MAX_DETAIL_RECOVERY]
    not_attempted = [p.get("url") for p in missing[MAX_DETAIL_RECOVERY:] if p.get("url")]
    failed = []
    recovered = 0
    rate_limited = 0
    page = await context.new_page()
    visited = 0
    try:
        for index, product in enumerate(selected):
            # Si el servidor ya nos limitó varias veces, detener la recuperación
            # secundaria. El catálogo del listado se conserva y las fichas
            # restantes quedan explícitamente pendientes.
            if rate_limited >= 3:
                not_attempted.extend(
                    p.get("url") for p in selected[index:] if p.get("url")
                )
                print(
                    f"[Mantra] demasiados HTTP 429; se detienen detalles y quedan "
                    f"{len(selected) - index} fichas pendientes"
                )
                break

            before = product.get("precio_usd")
            visited += 1
            try:
                await _extract_detail(page, product)
                if before is None and product.get("precio_usd") is not None:
                    recovered += 1
            except Exception as exc:
                if "429" in str(exc):
                    rate_limited += 1
                failed.append(product.get("url"))
                print(f"[Mantra] [aviso] ficha {product.get('url')}: {exc}")
            if visited % 25 == 0 or visited == len(selected):
                print(f"[Mantra] detalles {visited}/{len(selected)}; recuperados {recovered}; fallidos {len(failed)}")
    finally:
        await page.close()
    return {"visited": visited, "recovered": recovered, "failed": failed, "not_attempted": not_attempted, "rate_limited": rate_limited}


def _merge_previous(products, previous, failed_urls, failed_categories):
    previous_by_url = {p.get("url"): p for p in previous if isinstance(p, dict) and p.get("url")}
    current = {p.get("url"): p for p in products if p.get("url")}
    for url in failed_urls:
        if url in previous_by_url and url not in current:
            current[url] = dict(previous_by_url[url], datos_anteriores=True)
        elif url in previous_by_url and current[url].get("precio_usd") is None and previous_by_url[url].get("precio_usd") is not None:
            current[url]["precio_usd"] = previous_by_url[url].get("precio_usd")
            current[url]["datos_anteriores"] = True
            current[url]["precio_fuente"] = "cache"

    failed_labels = {_slug_from_url(url) for url in failed_categories}
    if failed_labels:
        for old in previous:
            if (isinstance(old, dict) and old.get("url")
                    and old.get("categoria") in failed_labels):
                current.setdefault(old["url"], dict(old, datos_anteriores=True))
    return list(current.values())


async def _run_async():
    global LAST_RUN_STATUS
    LAST_RUN_STATUS = {}
    from playwright.async_api import async_playwright

    previous = _load_previous()
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True, args=["--disable-dev-shm-usage"])
        context = await browser.new_context(user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36")
        try:
            products, failed_categories, partial_categories = await _discover_catalog(context)
            if not products:
                raise RuntimeError("Mantra: no se descubrieron productos en los listados")
            products = dedupe_products_prefer_complete(products)
            listing_prices = sum(p.get("precio_usd") is not None for p in products)
            print(f"[Mantra] listado consolidado: {len(products)} productos; {listing_prices} con precio")
            recovery = await _recover_details(context, products)
        finally:
            await context.close()
            await browser.close()

    unresolved = set(recovery["failed"]) | set(recovery["not_attempted"])
    merged = _merge_previous(products, previous, unresolved, failed_categories + partial_categories)
    if not merged:
        raise RuntimeError("Mantra: no se obtuvo ninguna ficha válida")

    metrics = catalog_metrics(merged)
    metrics.update({
        "categorias_fallidas": len(failed_categories),
        "categorias_parciales": len(partial_categories),
        "precios_desde_listado": listing_prices,
        "fichas_consultadas": recovery["visited"],
        "precios_recuperados": recovery["recovered"],
        "fichas_fallidas": len(recovery["failed"]),
        "fichas_no_visitadas": len(recovery["not_attempted"]),
        "http_429": recovery["rate_limited"],
        "productos_frescos": len(merged) - metrics["productos_anteriores"],
    })
    warnings = []
    if failed_categories:
        warnings.append(f"{len(failed_categories)} categorías fallaron")
    if partial_categories:
        warnings.append(f"{len(partial_categories)} categorías quedaron parciales")
    if recovery["failed"]:
        warnings.append(f"{len(recovery['failed'])} fichas fallaron")
    if recovery["not_attempted"]:
        warnings.append(f"{len(recovery['not_attempted'])} fichas quedaron pendientes")
    warning = "Mantra parcial: " + "; ".join(warnings) if warnings else None
    LAST_RUN_STATUS = {"partial": bool(warning), "warning": warning, "metrics": metrics}
    finalize_scrape(merged, "mantra", Path(__file__).parent.parent / "data", LAST_RUN_STATUS)
    return merged


def run():
    return asyncio.run(_run_async())


if __name__ == "__main__":
    run()
