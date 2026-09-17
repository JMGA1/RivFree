"""Scraper concurrente de Mantra Free Shop (Ecwid embebido).

La versión anterior visitaba cada ficha secuencialmente con una sola página de
Playwright. Esta versión usa asyncio + varios workers reutilizando páginas del
mismo contexto del browser, de modo que categorías y fichas se procesan en
paralelo sin crear cientos de browsers.
"""
import asyncio
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

sys.path.append(str(Path(__file__).parent))
from utils import clean_price, save_products

BASE_URL = "https://mantrafreeshop.com"
CATEGORY_RE = re.compile(r"-c\d+/?(?:$|[?#])", re.I)
PRODUCT_RE = re.compile(r"-p\d+/?(?:$|[?#])", re.I)
CATEGORY_WORKERS = 3
DETAIL_WORKERS = 6
NAV_TIMEOUT_MS = 45000
DETAIL_TIMEOUT_MS = 20000
DETAIL_BUDGET_SECONDS = 60 * 60
LAST_RUN_STATUS = {}


def _slug_from_url(url):
    path = urlparse(url).path.strip("/")
    path = re.sub(r"-c\d+$", "", path)
    return path or "varios"


def _load_previous():
    path = Path(__file__).parent.parent / "data" / "mantra.json"
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else []
    except (OSError, ValueError):
        return []


async def _goto(page, url, retries=3, timeout_ms=NAV_TIMEOUT_MS):
    last = None
    for attempt in range(1, retries + 1):
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)
            await page.wait_for_timeout(350)
            return True
        except Exception as exc:
            last = exc
            if attempt < retries:
                await page.wait_for_timeout(700 * attempt)
    raise RuntimeError(f"no se pudo cargar {url}: {last}")


async def _collect_links(page):
    links = await page.locator("a[href]").evaluate_all("els => els.map(a => a.href)")
    cats = []
    products = []
    for href in links:
        if not href or "mantrafreeshop.com" not in href:
            continue
        clean = href.split("#")[0]
        if CATEGORY_RE.search(clean):
            cats.append(clean)
        elif PRODUCT_RE.search(clean):
            products.append(clean)
    return list(dict.fromkeys(cats)), list(dict.fromkeys(products))


async def _expand(page, rounds=35):
    previous = -1
    stable = 0
    for _ in range(rounds):
        count = await page.locator("a[href]").count()
        stable = stable + 1 if count == previous else 0
        if stable >= 3:
            break
        previous = count
        await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        await page.wait_for_timeout(450)


async def _extract_detail(page, url, category):
    from bs4 import BeautifulSoup

    await _goto(page, url, retries=2, timeout_ms=DETAIL_TIMEOUT_MS)
    try:
        await page.locator("h1").first.wait_for(timeout=7000)
    except Exception:
        pass

    soup = BeautifulSoup(await page.content(), "html.parser")
    h1 = soup.find("h1")
    name = h1.get_text(" ", strip=True) if h1 else None
    if not name:
        title = soup.find("meta", attrs={"property": "og:title"})
        name = title.get("content") if title else None
    if not name:
        return None

    price = None
    candidates = []
    for tag in soup.find_all(["div", "span", "p"], limit=800):
        text = tag.get_text(" ", strip=True)
        if re.search(r"(?:USD|US\s*\$|U\$)\s*[\d.,]+", text, re.I):
            candidates.append(text)
    for text in sorted(candidates, key=len):
        price = clean_price(text)
        if price is not None and price > 0:
            break

    image = None
    og = soup.find("meta", attrs={"property": "og:image"})
    if og:
        image = og.get("content")
    if not image:
        img = soup.find("img")
        image = img.get("src") if img else None

    return {
        "tienda": "Mantra Free Shop",
        "nombre": name,
        "precio_usd": price,
        "precio_original_usd": None,
        "en_oferta": False,
        "categoria": category,
        "url": url,
        "imagen": image,
    }


async def _discover_catalog(context):
    product_categories = {}
    failed_categories = []
    scheduled = set()
    queue = asyncio.Queue()

    first = await context.new_page()
    try:
        await _goto(first, BASE_URL, retries=4)
        await _expand(first)
        initial_cats, initial_products = await _collect_links(first)
    finally:
        await first.close()

    for url in initial_products:
        product_categories.setdefault(url, "varios")
    for cat in initial_cats:
        if cat not in scheduled:
            scheduled.add(cat)
            await queue.put(cat)

    async def worker(worker_id):
        page = await context.new_page()
        try:
            while True:
                cat = await queue.get()
                try:
                    await _goto(page, cat, retries=3)
                    await _expand(page)
                    subcats, products = await _collect_links(page)
                    label = _slug_from_url(cat)
                    for url in products:
                        product_categories.setdefault(url, label)
                    for sub in subcats:
                        if sub not in scheduled:
                            scheduled.add(sub)
                            await queue.put(sub)
                    print(
                        f"[Mantra] worker {worker_id} {label}: {len(products)} productos; "
                        f"total URLs {len(product_categories)}"
                    )
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
    for worker_task in workers:
        worker_task.cancel()
    await asyncio.gather(*workers, return_exceptions=True)

    return product_categories, failed_categories


async def _scrape_details(context, product_categories):
    queue = asyncio.Queue()
    for item in product_categories.items():
        await queue.put(item)

    products = []
    failed_urls = []
    processed = 0
    lock = asyncio.Lock()
    total = queue.qsize()
    deadline = asyncio.get_running_loop().time() + DETAIL_BUDGET_SECONDS

    async def worker(worker_id):
        nonlocal processed
        page = await context.new_page()
        try:
            while True:
                url, category = await queue.get()
                try:
                    if asyncio.get_running_loop().time() >= deadline:
                        failed_urls.append(url)
                        continue
                    item = await _extract_detail(page, url, category)
                    if item:
                        products.append(item)
                    else:
                        failed_urls.append(url)
                except Exception as exc:
                    failed_urls.append(url)
                    print(f"[Mantra] [aviso] ficha {url}: {exc}")
                finally:
                    async with lock:
                        processed += 1
                        if processed % 50 == 0 or processed == total:
                            print(
                                f"[Mantra] fichas {processed}/{total}; "
                                f"válidas {len(products)}, fallidas {len(failed_urls)}"
                            )
                    queue.task_done()
        except asyncio.CancelledError:
            pass
        finally:
            await page.close()

    workers = [asyncio.create_task(worker(i + 1)) for i in range(DETAIL_WORKERS)]
    await queue.join()
    for worker_task in workers:
        worker_task.cancel()
    await asyncio.gather(*workers, return_exceptions=True)
    return products, failed_urls


def _merge_previous(products, previous, failed_urls, failed_categories=None):
    previous_by_url = {p.get("url"): p for p in previous if isinstance(p, dict) and p.get("url")}
    current_by_url = {p.get("url"): p for p in products if p.get("url")}
    for url in failed_urls:
        if url not in current_by_url and url in previous_by_url:
            current_by_url[url] = previous_by_url[url]

    failed_labels = {_slug_from_url(url) for url in (failed_categories or [])}
    if failed_labels:
        for old in previous:
            if isinstance(old, dict) and old.get("categoria") in failed_labels and old.get("url"):
                current_by_url.setdefault(old["url"], old)
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
                "AppleWebKit/537.36 Chrome/124 Safari/537.36"
            )
        )
        try:
            product_categories, failed_categories = await _discover_catalog(context)
            if not product_categories:
                raise RuntimeError("Mantra: no se descubrieron productos en la tienda Ecwid")

            print(
                f"[Mantra] {len(product_categories)} fichas descubiertas; "
                f"procesando con {DETAIL_WORKERS} workers"
            )
            products, failed_urls = await _scrape_details(context, product_categories)
        finally:
            await context.close()
            await browser.close()

    merged = _merge_previous(products, previous, failed_urls, failed_categories)
    if not merged:
        raise RuntimeError("Mantra: no se pudo extraer ninguna ficha")

    warnings = []
    if failed_categories:
        warnings.append(f"{len(failed_categories)} categorías fallaron")
    if failed_urls:
        warnings.append(f"{len(failed_urls)} fichas fallaron")
    if warnings:
        warning = "Mantra parcial: " + "; ".join(warnings)
        LAST_RUN_STATUS = {"partial": True, "warning": warning}
        print(f"[Mantra] [aviso] {warning}")
    else:
        LAST_RUN_STATUS = {"partial": False}

    save_products(merged, "mantra", Path(__file__).parent.parent / "data")
    return merged


def run():
    return asyncio.run(_run_async())


if __name__ == "__main__":
    run()
