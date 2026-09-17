"""Scraper resiliente y concurrente de Yury's Free Shop (Wix).

Un timeout en una categoría ya no invalida toda la tienda. Las categorías se
procesan con varias páginas Playwright y, para productos cuyo precio no aparece
en la grilla, las fichas se consultan en paralelo con workers reutilizables.
"""
import asyncio
import json
import re
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).parent))
from utils import collect_wix_category_async, finalize_scrape, load_previous_store, navigate, discover_menu_categories, save_products, extract_wix_products, extract_wix_detail_price

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
CATEGORY_WORKERS = 3
DETAIL_WORKERS = 6
NAV_TIMEOUT_MS = 45000
DETAIL_TIMEOUT_MS = 15000
PRICE_RECOVERY_BUDGET_SECONDS = 25 * 60
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
            return True
        except Exception as exc:
            last = exc
            if attempt < retries:
                await page.wait_for_timeout(800 * attempt)
    raise RuntimeError(f"no se pudo cargar {url}: {last}")


async def _scrape_category(context, slug):
    from bs4 import BeautifulSoup

    page = await context.new_page()
    url = f"{BASE_URL}/{slug}"
    try:
        await _goto(page, url, retries=3)
        try:
            await page.wait_for_selector('[data-hook="product-item-root"]', timeout=25000)
        except Exception:
            # Una categoría realmente vacía y una categoría que no cargó se
            # distinguen luego por el conteo final.
            pass
        products = await collect_wix_category_async(page, "Yury's Free Shop", slug, BASE_URL)
        return slug, products, None
    except Exception as exc:
        return slug, [], str(exc)
    finally:
        await page.close()


async def _recover_missing_prices(context, products):
    from bs4 import BeautifulSoup

    missing = [p for p in products if p.get("precio_usd") is None and p.get("url")]
    if not missing:
        return []

    queue = asyncio.Queue()
    for product in missing:
        await queue.put(product)

    failed_urls = []
    total = len(missing)
    processed = 0
    lock = asyncio.Lock()
    deadline = asyncio.get_running_loop().time() + PRICE_RECOVERY_BUDGET_SECONDS

    async def worker(worker_id):
        nonlocal processed
        page = await context.new_page()
        try:
            while True:
                product = await queue.get()
                try:
                    if asyncio.get_running_loop().time() >= deadline:
                        failed_urls.append(product["url"])
                        continue
                    await _goto(page, product["url"], retries=2, timeout_ms=DETAIL_TIMEOUT_MS)
                    await page.wait_for_selector('[data-hook="product-prices-wrapper"]', state="attached", timeout=10000)
                    detail = BeautifulSoup(await page.content(), "html.parser")
                    current, original = extract_wix_detail_price(detail)
                    if current is not None:
                        product.update(
                            precio_usd=current,
                            precio_original_usd=original,
                            en_oferta=original is not None and original > current,
                        )
                    else:
                        failed_urls.append(product["url"])
                except Exception:
                    failed_urls.append(product["url"])
                finally:
                    async with lock:
                        processed += 1
                        if processed % 100 == 0 or processed == total:
                            print(
                                f"[Yury's] recuperación de precios {processed}/{total}; "
                                f"sin recuperar {len(failed_urls)}"
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
    return failed_urls


def _dedupe(products):
    seen = set()
    unique = []
    for product in products:
        key = product.get("url") or product.get("nombre")
        if key and key not in seen:
            seen.add(key)
            unique.append(product)
    return unique


def _merge_previous(unique, previous, failed_categories, failed_price_urls):
    previous_by_url = {
        p.get("url"): p for p in previous if isinstance(p, dict) and p.get("url")
    }
    current_by_url = {p.get("url"): p for p in unique if p.get("url")}

    # Si una categoría completa falló, conservamos sus productos anteriores.
    for old in previous:
        if not isinstance(old, dict):
            continue
        if old.get("categoria") in failed_categories and old.get("url"):
            current_by_url.setdefault(old["url"], dict(old, datos_anteriores=True))

    # Si la ficha de detalle no dio precio, preservamos el precio anterior si
    # existía, pero mantenemos nombre/categoría/imágenes frescas de la grilla.
    for url in failed_price_urls:
        current = current_by_url.get(url)
        old = previous_by_url.get(url)
        if current and old and current.get("precio_usd") is None and old.get("precio_usd") is not None:
            current["datos_anteriores"] = True
            current["precio_usd"] = old.get("precio_usd")
            current["precio_original_usd"] = old.get("precio_original_usd")
            current["en_oferta"] = old.get("en_oferta", False)

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
            # Solo 11 categorías: un gather con semáforo mantiene baja la carga.
            semaphore = asyncio.Semaphore(CATEGORY_WORKERS)

            async def limited(slug):
                async with semaphore:
                    return await _scrape_category(context, slug)

            categories = await asyncio.to_thread(discover_menu_categories, BASE_URL, CATEGORIES)
            results = await asyncio.gather(*(limited(slug) for slug in categories))

            all_products = []
            failed_categories = []
            for slug, found, error in results:
                if error:
                    failed_categories.append(slug)
                    print(f"[Yury's] [aviso] categoría {slug}: {error}")
                    continue
                print(f"[Yury's] {slug}: {len(found)} productos")
                all_products.extend(found)

            if not all_products:
                raise RuntimeError("Yury's: ninguna categoría pudo actualizarse")

            unique = _dedupe(all_products)
            failed_price_urls = await _recover_missing_prices(context, unique)
        finally:
            await context.close()
            await browser.close()

    merged = _merge_previous(unique, previous, failed_categories, failed_price_urls)
    if not merged:
        raise RuntimeError("Yury's: no se obtuvo ningún producto válido")

    remaining_missing = sum(p.get("precio_usd") is None for p in merged)
    print(f"[Yury's] aún sin precio publicado: {remaining_missing}")

    warnings = []
    if failed_categories:
        warnings.append(f"categorías fallidas: {', '.join(failed_categories)}")
    if failed_price_urls:
        warnings.append(f"{len(failed_price_urls)} precios de detalle no recuperados")
    if warnings:
        warning = "Yury's parcial: " + "; ".join(warnings)
        LAST_RUN_STATUS = {"partial": True, "warning": warning}
        print(f"[Yury's] [aviso] {warning}")
    else:
        LAST_RUN_STATUS = {"partial": False}

    finalize_scrape(merged, "yurys", Path(__file__).parent.parent / "data", LAST_RUN_STATUS)
    return merged


def run():
    return asyncio.run(_run_async())


if __name__ == "__main__":
    run()
