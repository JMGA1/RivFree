"""Scraper de Yury's: precios del listado primero, fichas solo como respaldo."""
import asyncio
import re
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).parent))
from utils import (
    PRICE_RE,
    catalog_metrics,
    clean_price,
    dedupe_products_prefer_complete,
    extract_wix_detail_price,
    extract_wix_products,
    finalize_scrape,
    load_previous_store,
    merge_product_records,
    normalize_wix_image_url,
)

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
CATEGORY_WORKERS = 2
DETAIL_WORKERS = 3
NAV_TIMEOUT_MS = 45000
DETAIL_TIMEOUT_MS = 18000
# Ya no existe un corte por tiempo que marque miles de fichas como "procesadas".
# Si el listado cambia y faltan demasiados precios, recuperamos una cantidad
# acotada y el resto queda explícitamente como pendiente.
MAX_DETAIL_RECOVERY = 300
MAX_CATEGORY_PAGES = 300
LAST_RUN_STATUS = {}


def _load_previous():
    return load_previous_store("yurys", Path(__file__).parent.parent / "data")


async def _goto(page, url, retries=3, timeout_ms=NAV_TIMEOUT_MS):
    last = None
    for attempt in range(1, retries + 1):
        try:
            response = await page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)
            if response is not None and response.status >= 400:
                raise RuntimeError(f"HTTP {response.status}: {url}")
            return response
        except Exception as exc:
            last = exc
            if attempt < retries:
                await page.wait_for_timeout(1200 * attempt)
    raise RuntimeError(f"no se pudo cargar {url}: {last}")


def _collapse_visible_text(value):
    return " ".join((value or "").replace("\xa0", " ").split())


def _price_from_product_segment(segment):
    """Extrae únicamente precios visibles dentro del bloque textual de un producto.

    Yury/Wix a veces renderiza el nombre y el precio en componentes hermanos. El
    HTML serializado por page.content() puede dejar el precio fuera del
    product-item-root aunque visualmente esté en la misma tarjeta. El texto
    visible del navegador sí conserva la relación por orden.
    """
    values = []
    for match in PRICE_RE.finditer(segment or ""):
        price = clean_price(match.group(0))
        if price is not None and price > 0:
            values.append(price)
    if not values:
        return None, None

    lowered = (segment or "").casefold()
    has_sale = any(token in lowered for token in (
        "preço promocional", "preco promocional", "precio promocional",
        "sale price", "preço normal", "preco normal", "precio normal",
    ))
    if has_sale and len(values) >= 2:
        current = values[-1]
        original = values[0] if values[0] > current else None
        return current, original
    return values[0], None


def _fill_prices_from_listing_text(products, visible_text):
    """Completa precios usando el texto *renderizado* del listado de Yury.

    La búsqueda se limita desde el nombre del producto hasta el próximo marcador
    de "Visualização rápida" (o un máximo corto), por lo que un producto sin
    precio no puede apropiarse del precio de la tarjeta siguiente.
    """
    text = _collapse_visible_text(visible_text)
    folded = text.casefold()
    markers = (
        "visualização rápida", "visualizacao rapida", "visualización rápida",
        "visualizacion rapida", "quick view", "vista rápida", "vista rapida",
    )
    observed = 0

    for product in products:
        name = _collapse_visible_text(product.get("nombre"))
        if not name:
            continue
        needle = name.casefold()
        search_at = 0
        observation = None

        while True:
            pos = folded.find(needle, search_at)
            if pos < 0:
                break
            after = pos + len(needle)
            max_end = min(len(text), after + 320)
            next_marker = max_end
            for marker in markers:
                marker_pos = folded.find(marker, after, max_end)
                if marker_pos >= 0:
                    next_marker = min(next_marker, marker_pos)
            segment = text[after:next_marker]
            current, original = _price_from_product_segment(segment)
            if current is not None:
                observation = (current, original)
                break
            search_at = after

        if observation is None:
            continue

        current, original = observation
        product["precio_usd"] = current
        product["precio_original_usd"] = original
        product["en_oferta"] = bool(original and original > current)
        product["precio_fuente"] = "listado_visible"
        observed += 1

    return observed


async def _scrape_category(context, slug):
    """Recorre Yury por ?page=N y guarda cada página antes de avanzar.

    Yury expone páginas numeradas aunque el frontend muestre "Ver mais". Usar
    URLs numeradas evita depender del estado interno del widget Wix y nos deja
    leer el texto visible de cada lote antes de cambiar de página.
    """
    from bs4 import BeautifulSoup

    page = await context.new_page()
    products = {}
    signatures = set()
    warnings = []
    consecutive_failures = 0
    pages_ok = 0

    try:
        for page_no in range(1, MAX_CATEGORY_PAGES + 1):
            url = f"{BASE_URL}/{slug}"
            if page_no > 1:
                url += f"?page={page_no}"

            try:
                await _goto(page, url, retries=3)
            except Exception as exc:
                message = str(exc)
                # En paginación directa un 404 después de páginas válidas es un
                # final normal del catálogo, no una categoría fallida.
                if pages_ok and "HTTP 404" in message:
                    break
                if not pages_ok:
                    return slug, [], message
                warnings.append(f"página {page_no} no respondió: {message}")
                consecutive_failures += 1
                if consecutive_failures >= 2:
                    break
                continue

            consecutive_failures = 0
            try:
                await page.wait_for_selector(
                    'a[href*="/product-page/"], [data-hook="product-item-root"]',
                    timeout=25000,
                )
            except Exception:
                pass

            # Wix suele pintar el precio unos instantes después del enlace.
            await page.wait_for_timeout(900)
            soup = BeautifulSoup(await page.content(), "html.parser")
            found = extract_wix_products(soup, "Yury's Free Shop", slug, BASE_URL)

            if not found:
                if pages_ok:
                    break
                return slug, [], "categoría sin productos legibles"

            signature = tuple(sorted(p.get("url") for p in found if p.get("url")))
            if signature in signatures:
                break
            signatures.add(signature)

            try:
                visible_text = await page.locator("body").inner_text(timeout=10000)
            except Exception:
                visible_text = ""
            visible_prices = _fill_prices_from_listing_text(found, visible_text)

            for item in found:
                url_key = item.get("url")
                if url_key:
                    products[url_key] = merge_product_records(products.get(url_key), item)

            pages_ok += 1
            with_price = sum(p.get("precio_usd") is not None for p in found)
            print(
                f"[Yury's] {slug} página {page_no}: {len(found)} productos; "
                f"{with_price} con precio ({visible_prices} confirmados por texto visible)"
            )
        else:
            warnings.append(f"se alcanzó el límite de {MAX_CATEGORY_PAGES} páginas")

        rows = list(products.values())
        if not rows:
            return slug, [], "categoría sin productos legibles"
        warning = "; ".join(warnings) if warnings else None
        return slug, rows, warning
    finally:
        await page.close()


async def _recover_missing_prices(context, products):
    from bs4 import BeautifulSoup

    missing = [p for p in products if p.get("precio_usd") is None and p.get("url")]
    to_visit = missing[:MAX_DETAIL_RECOVERY]
    not_attempted = [p.get("url") for p in missing[MAX_DETAIL_RECOVERY:] if p.get("url")]
    if not to_visit:
        return {"recovered": 0, "failed": [], "not_attempted": not_attempted, "visited": 0}

    queue = asyncio.Queue()
    for product in to_visit:
        await queue.put(product)

    failed_urls = []
    recovered = 0
    processed = 0
    lock = asyncio.Lock()
    total = len(to_visit)

    async def worker(worker_id):
        nonlocal processed, recovered
        page = await context.new_page()
        try:
            while True:
                product = await queue.get()
                try:
                    await _goto(page, product["url"], retries=2, timeout_ms=DETAIL_TIMEOUT_MS)
                    try:
                        await page.wait_for_selector('[data-hook="product-prices-wrapper"]', state="attached", timeout=8000)
                    except Exception:
                        pass
                    detail = BeautifulSoup(await page.content(), "html.parser")
                    current, original = extract_wix_detail_price(detail)
                    if current is not None:
                        product.update(
                            precio_usd=current,
                            precio_original_usd=original,
                            en_oferta=original is not None and original > current,
                            precio_fuente="ficha",
                        )
                        recovered += 1
                    else:
                        failed_urls.append(product["url"])
                except Exception:
                    failed_urls.append(product["url"])
                finally:
                    async with lock:
                        processed += 1
                        if processed % 100 == 0 or processed == total:
                            print(
                                f"[Yury's] recuperación {processed}/{total}; "
                                f"recuperados {recovered}, fallidos {len(failed_urls)}"
                            )
                    queue.task_done()
        except asyncio.CancelledError:
            pass
        finally:
            await page.close()

    workers = [asyncio.create_task(worker(i + 1)) for i in range(DETAIL_WORKERS)]
    await queue.join()
    for task in workers:
        task.cancel()
    await asyncio.gather(*workers, return_exceptions=True)
    return {"recovered": recovered, "failed": failed_urls, "not_attempted": not_attempted, "visited": total}


def _merge_previous(unique, previous, failed_categories, recovery):
    # Versiones anteriores pasaban directamente una lista de URLs fallidas.
    if isinstance(recovery, (list, tuple, set)):
        recovery = {"failed": list(recovery), "not_attempted": []}
    previous_by_url = {p.get("url"): p for p in previous if isinstance(p, dict) and p.get("url")}
    current_by_url = {p.get("url"): p for p in unique if p.get("url")}

    for old in previous:
        if isinstance(old, dict) and old.get("categoria") in failed_categories and old.get("url"):
            current_by_url.setdefault(old["url"], dict(old, datos_anteriores=True))

    unresolved = set(recovery["failed"]) | set(recovery["not_attempted"])
    for url in unresolved:
        current = current_by_url.get(url)
        old = previous_by_url.get(url)
        if current and old and current.get("precio_usd") is None and old.get("precio_usd") is not None:
            current["datos_anteriores"] = True
            current["precio_usd"] = old.get("precio_usd")
            current["precio_original_usd"] = old.get("precio_original_usd")
            current["en_oferta"] = old.get("en_oferta", False)
            current["precio_fuente"] = "cache"
    return list(current_by_url.values())


async def _run_async():
    global LAST_RUN_STATUS
    LAST_RUN_STATUS = {}
    from playwright.async_api import async_playwright

    previous = _load_previous()
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True, args=["--disable-dev-shm-usage"])
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
            )
        )
        try:
            semaphore = asyncio.Semaphore(CATEGORY_WORKERS)

            async def limited(slug):
                async with semaphore:
                    return await _scrape_category(context, slug)

            results = await asyncio.gather(*(limited(slug) for slug in CATEGORIES))
            all_products = []
            failed_categories = []
            partial_categories = []
            for slug, found, error in results:
                if error and not found:
                    failed_categories.append(slug)
                    print(f"[Yury's] [aviso] categoría {slug}: {error}")
                    continue
                if error:
                    partial_categories.append(slug)
                    print(f"[Yury's] [aviso] categoría {slug}: parcial ({error})")
                with_price = sum(p.get("precio_usd") is not None for p in found)
                print(f"[Yury's] {slug}: {len(found)} productos; {with_price} con precio desde listado")
                all_products.extend(found)

            if not all_products:
                raise RuntimeError("Yury's: ninguna categoría pudo actualizarse")

            unique = dedupe_products_prefer_complete(all_products)
            listing_prices = sum(p.get("precio_usd") is not None for p in unique)
            missing_before = len(unique) - listing_prices
            print(f"[Yury's] listado: {len(unique)} productos; {listing_prices} precios; {missing_before} pendientes")
            recovery = await _recover_missing_prices(context, unique)
        finally:
            await context.close()
            await browser.close()

    merged = _merge_previous(unique, previous, failed_categories, recovery)
    # También reparar las imágenes recuperadas del caché de categorías fallidas.
    for product in merged:
        if product.get("imagen"):
            product["imagen"] = normalize_wix_image_url(product["imagen"])
    if not merged:
        raise RuntimeError("Yury's: no se obtuvo ningún producto válido")

    pending = sum(p.get("precio_usd") is None for p in merged)
    # p.get("datos_anteriores") puede devolver None. Usarlo directamente dentro
    # de sum() produce int + NoneType. Contamos explícitamente registros válidos.
    cached_prices = sum(
        1
        for p in merged
        if bool(p.get("datos_anteriores")) and p.get("precio_usd") is not None
    )
    metrics = catalog_metrics(merged)
    metrics.update({
        "categorias_totales": len(CATEGORIES),
        "categorias_fallidas": len(failed_categories),
        "categorias_parciales": len(partial_categories),
        "precios_desde_listado": listing_prices,
        "fichas_consultadas": recovery["visited"],
        "precios_recuperados": recovery["recovered"],
        "fichas_fallidas": len(recovery["failed"]),
        "fichas_no_visitadas": len(recovery["not_attempted"]),
        "precios_cacheados": cached_prices,
        "precios_pendientes": pending,
        "productos_frescos": len(merged) - metrics["productos_anteriores"],
    })

    warnings = []
    if failed_categories:
        warnings.append(f"categorías fallidas: {', '.join(failed_categories)}")
    if partial_categories:
        warnings.append(f"categorías parciales: {', '.join(partial_categories)}")
    if recovery["failed"]:
        warnings.append(f"{len(recovery['failed'])} fichas visitadas sin precio recuperable")
    if recovery["not_attempted"]:
        warnings.append(f"{len(recovery['not_attempted'])} fichas pendientes sin visitar")
    if pending:
        warnings.append(f"{pending} productos continúan sin precio observado")
    warning = "Yury's parcial: " + "; ".join(warnings) if warnings else None
    LAST_RUN_STATUS = {"partial": bool(warning), "warning": warning, "metrics": metrics}
    if warning:
        print(f"[Yury's] [aviso] {warning}")
    finalize_scrape(merged, "yurys", Path(__file__).parent.parent / "data", LAST_RUN_STATUS)
    return merged


def run():
    return asyncio.run(_run_async())


if __name__ == "__main__":
    run()
