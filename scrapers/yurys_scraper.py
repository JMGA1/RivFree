"""Scraper de Yury's: precios del listado primero, fichas solo como respaldo."""
import asyncio
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).parent))
from utils import (
    catalog_metrics,
    collect_wix_category_async,
    dedupe_products_prefer_complete,
    extract_wix_detail_price,
    finalize_scrape,
    load_previous_store,
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


async def _scrape_category(context, slug):
    page = await context.new_page()
    url = f"{BASE_URL}/{slug}"
    try:
        await _goto(page, url, retries=3)
        try:
            await page.wait_for_selector('a[href*="/product-page/"], [data-hook="product-item-root"]', timeout=25000)
        except Exception:
            pass
        products, partial_warning = await collect_wix_category_async(
            page, "Yury's Free Shop", slug, BASE_URL, with_status=True
        )
        if not products:
            raise RuntimeError("categoría sin productos legibles")
        return slug, products, partial_warning
    except Exception as exc:
        return slug, [], str(exc)
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
    if not merged:
        raise RuntimeError("Yury's: no se obtuvo ningún producto válido")

    pending = sum(p.get("precio_usd") is None for p in merged)
    cached_prices = sum(p.get("datos_anteriores") and p.get("precio_usd") is not None for p in merged)
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
