"""
Funciones compartidas que usan todos los scrapers de tiendas.
No hace falta tocar este archivo para agregar una tienda nueva.
"""
import re
import json
import time
import sys
from pathlib import Path
from urllib.parse import urljoin, urlparse

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
}

PRICE_RE = re.compile(
    r"(?:USD\s*\$?|US\s*\$|U\$S|U\$)\s*([\d.,]+)", re.IGNORECASE
)
POLITE_DELAY = 0.35


def clean_price(raw_text):
    """Convierte un texto tipo 'USD 1.234,50' o 'USD 80' a un float: 1234.50 / 80.0
    Devuelve None si no encuentra nada parseable."""
    if not raw_text:
        return None
    match = PRICE_RE.search(raw_text.replace("\xa0", " "))
    if not match:
        return None
    number = match.group(1)
    # Maneja formatos latinos y estadounidenses sin confundir los miles
    # con los decimales: 1.234,50 / 1,234.50 / 1234,50 / 1234.50.
    if "," in number and "." in number:
        if number.rfind(",") > number.rfind("."):
            number = number.replace(".", "").replace(",", ".")
        else:
            number = number.replace(",", "")
    elif "," in number:
        decimals = len(number) - number.rfind(",") - 1
        number = number.replace(",", ".") if decimals in (1, 2) else number.replace(",", "")
    elif "." in number:
        decimals = len(number) - number.rfind(".") - 1
        if decimals == 3:
            number = number.replace(".", "")
    try:
        return round(float(number), 2)
    except ValueError:
        return None


def get_soup(url, retries=3, delay=2, timeout=20):
    import requests
    from bs4 import BeautifulSoup
    for attempt in range(1, retries + 1):
        try:
            resp = requests.get(url, headers=HEADERS, timeout=timeout)
            if resp.status_code == 200:
                return BeautifulSoup(resp.text, "html.parser")
            print(f"  [aviso] {url} devolvio status {resp.status_code}", file=sys.stderr)
            # Reintentar un 404 solo repite el mismo resultado. En los listados
            # suele significar que ya se alcanzo la ultima pagina.
            if 400 <= resp.status_code < 500 and resp.status_code != 429:
                return None
        except requests.RequestException as e:
            print(f"  [aviso] fallo al pedir {url}: {e}", file=sys.stderr)
        time.sleep(delay)
    return None


def parse_wix_product_text(raw_text):
    """Extrae nombre, precio actual y precio anterior de una tarjeta Wix."""
    if not raw_text:
        return None
    text = " ".join(raw_text.replace("\xa0", " ").split())
    matches = list(PRICE_RE.finditer(text))
    if not matches:
        return None

    prices = [clean_price(match.group(0)) for match in matches]
    prices = [price for price in prices if price is not None]
    if not prices:
        return None

    # En una oferta Wix suele mostrar primero el precio anterior y luego el
    # actual. Si solo hay uno, es el precio vigente.
    current = prices[-1]
    original = prices[0] if len(prices) > 1 and prices[0] > current else None
    name = text[:matches[0].start()].strip(" -–—|:")
    if not name:
        name = text[matches[-1].end():].strip(" -–—|:")
    return (name, current, original) if name else None


def expand_wix_catalog(page, max_rounds=200):
    previous_count = -1
    stable_rounds = 0
    for _ in range(max_rounds):
        count = page.locator('[data-hook="product-item-root"]').count()
        stable_rounds = stable_rounds + 1 if count == previous_count else 0
        previous_count = count
        buttons = page.get_by_role("button", name=re.compile(
            r"ver mais|mostrar mais|carregar mais|load more|show more|ver más|cargar más", re.I))
        active = False
        if buttons.count():
            button = buttons.last
            active = button.is_visible() and button.is_enabled()
            if active:
                button.click(timeout=10000)
        if stable_rounds >= 4 and not active:
            return count
        if stable_rounds >= 8:
            raise RuntimeError("La grilla dejó de crecer con 'cargar más' todavía activo")
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        page.wait_for_timeout(1500)
    raise RuntimeError("Límite de carga alcanzado; no se considera catálogo completo")


def collect_wix_category(page, store, category, base_url):
    from bs4 import BeautifulSoup
    products = {}
    signatures = set()
    for _ in range(300):
        loaded = expand_wix_catalog(page)
        found = extract_wix_products(BeautifulSoup(page.content(), 'html.parser'), store, category, base_url)
        signature = tuple(sorted(x['url'] for x in found))
        if not found or signature in signatures or len(found) < loaded:
            raise RuntimeError("Página vacía, repetida o con tarjetas ilegibles")
        signatures.add(signature)
        products.update((x['url'], x) for x in found)
        next_button = page.locator('[data-hook="pagination__next"], a[rel="next"]').first
        if not next_button.count() or not next_button.is_visible() or not next_button.is_enabled() or next_button.get_attribute('aria-disabled') == 'true':
            return list(products.values())
        next_button.click(timeout=10000)
        page.wait_for_timeout(2000)
    raise RuntimeError("Límite de paginación Wix alcanzado")


async def collect_wix_category_async(page, store, category, base_url):
    from bs4 import BeautifulSoup
    products = {}
    signatures = set()
    for _ in range(300):
        previous = -1
        stable = 0
        for round_no in range(200):
            count = await page.locator('[data-hook="product-item-root"]').count()
            stable = stable + 1 if count == previous else 0
            previous = count
            buttons = page.get_by_role('button', name=re.compile(
                r'ver mais|mostrar mais|carregar mais|load more|show more|ver más|cargar más', re.I))
            active = False
            if await buttons.count():
                button = buttons.last
                active = await button.is_visible() and await button.is_enabled()
                if active:
                    await button.click(timeout=10000)
            if stable >= 4 and not active:
                break
            if stable >= 8 or round_no == 199:
                raise RuntimeError('Carga Wix incompleta')
            await page.evaluate('window.scrollTo(0, document.body.scrollHeight)')
            await page.wait_for_timeout(1500)
        found = extract_wix_products(BeautifulSoup(await page.content(), 'html.parser'), store, category, base_url)
        signature = tuple(sorted(x['url'] for x in found))
        if not found or signature in signatures or len(found) < count:
            raise RuntimeError('Página Wix vacía, repetida o ilegible')
        signatures.add(signature)
        products.update((x['url'], x) for x in found)
        button = page.locator('[data-hook="pagination__next"], a[rel="next"]').first
        if not await button.count() or not await button.is_visible() or not await button.is_enabled() or await button.get_attribute('aria-disabled') == 'true':
            return list(products.values())
        await button.click(timeout=10000)
        await page.wait_for_timeout(2000)
    raise RuntimeError('Límite de paginación Wix alcanzado')


def extract_image_url(container):
    """Obtiene una imagen real evitando placeholders data: y fuentes vacias."""
    img = container.find("img") if container else None
    if not img:
        return None
    candidates = [img.get("data-src"), img.get("data-lazy-src"), img.get("src")]
    srcset = img.get("srcset")
    if srcset:
        candidates.extend(part.strip().split(" ")[0] for part in srcset.split(","))
    for candidate in candidates:
        if candidate and candidate.startswith(("http://", "https://")):
            return candidate
    return None


def extract_wix_products(soup, store_name, category, base_url):
    """Lee las tarjetas completas de Wix: imagen, nombre, precio y enlace."""
    products = []
    roots = soup.select('[data-hook="product-item-root"]')
    for root in roots:
        link = root.select_one('a[href*="/product-page/"]')
        name_tag = root.select_one('[data-hook="product-item-name"]')
        if not link:
            continue
        image_tag = root.find("img")
        name = name_tag.get_text(" ", strip=True) if name_tag else (image_tag.get("alt", "") if image_tag else link.get_text(" ", strip=True))
        href = urljoin(base_url, link.get("href", ""))
        if not name or not href:
            continue

        current_tag = root.select_one('[data-hook="product-item-price-to-pay"]')
        old_tag = root.select_one(
            '[data-hook="product-item-price-before-discount"], '
            '[data-hook="product-item-price-before-discount-to-pay"]'
        )
        current_raw = None
        if current_tag:
            current_raw = current_tag.get("data-wix-price") or current_tag.get_text(" ", strip=True)
        # Wix can put a bare machine number in data-wix-price.
        # Prefer visible currency text, then that explicit price attribute.
        price = clean_price(current_tag.get_text(" ", strip=True)) if current_tag else None
        if price is None and current_tag:
            raw = current_tag.get("data-wix-price", "").strip()
            price = clean_price(raw)
            if price is None and re.fullmatch(r"\d+(?:[.,]\d{1,2})?", raw):
                price = float(raw.replace(",", "."))
        if price is None:
            fallback_tag = root.select_one('[data-hook="product-item-price"], [data-hook="formatted-primary-price"]')
            price = clean_price(fallback_tag.get_text(" ", strip=True)) if fallback_tag else None

        # Wix cambia seguido los data-hook. Como respaldo, leer el texto visible
        # completo de la tarjeta (ej.: "Preço normal US$ 29,90 Preço promocional US$ 17,99").
        parsed_card = parse_wix_product_text(root.get_text(" ", strip=True))
        if parsed_card:
            parsed_name, parsed_current, parsed_original = parsed_card
            if price is None:
                price = parsed_current
            if not name and parsed_name:
                name = parsed_name
        if price is not None and price <= 0:
            price = None
        original = clean_price(old_tag.get_text(" ", strip=True)) if old_tag else None
        if original is None and parsed_card:
            original = parsed_card[2]
        if original is not None and (price is None or original <= price):
            original = None

        products.append({
            "tienda": store_name,
            "nombre": name,
            "precio_usd": price,
            "precio_original_usd": original,
            "en_oferta": price is not None and original is not None,
            "categoria": category,
            "url": href,
            "imagen": extract_image_url(root),
        })
    return products


def save_products(products, store_name, out_dir):
    """Guarda los productos de una tienda en data/<tienda>.json"""
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / f"{store_name}.json"
    temporary = path.with_suffix(".json.tmp")
    with open(temporary, "w", encoding="utf-8") as f:
        json.dump(products, f, ensure_ascii=False, indent=2)
    temporary.replace(path)
    print(f"[{store_name}] guardados {len(products)} productos en {path}")
    return path


def extract_wix_detail_price(soup):
    """Read the product's visible primary price, never related-item prices.

    Wix changes its data-hook names often. We keep all fallbacks strictly inside
    product-prices-wrapper so a price from a recommendations carousel cannot be
    mistaken for the current product.
    """
    wrapper = soup.select_one('[data-hook="product-prices-wrapper"]')
    if wrapper is None:
        return None, None

    primary = wrapper.select_one('[data-hook="formatted-primary-price"]')
    old = wrapper.select_one('[data-hook="formatted-secondary-price"]')
    current = clean_price(primary.get_text(' ', strip=True)) if primary else None
    original = clean_price(old.get_text(' ', strip=True)) if old else None

    if current is None:
        prices = [clean_price(m.group(0)) for m in PRICE_RE.finditer(wrapper.get_text(' ', strip=True))]
        if prices:
            current = prices[-1]
            if original is None and len(prices) > 1 and prices[0] > current:
                original = prices[0]

    if current is None or current <= 0:
        return None, None
    return current, original if original and original > current else None


def load_previous_store(store_key, out_dir):
    """Also supports repositories that keep only products.json."""
    try:
        cached = json.loads((Path(out_dir) / f"{store_key}.json").read_text())
        if isinstance(cached, list) and cached:
            return cached
    except (OSError, ValueError):
        pass
    names = {"barao": "Barão Free Shop", "dfa": "DFA", "mantra": "Mantra Free Shop",
             "neutral": "Neutral", "oprha": "Oprha Free Shop", "sineriz": "Sineriz",
             "yurys": "Yury's Free Shop"}
    try:
        data = json.loads((Path(out_dir) / "products.json").read_text())
        return [x for x in data.get("productos", []) if x.get("tienda") == names[store_key]]
    except (OSError, ValueError, AttributeError):
        return []


def finalize_scrape(products, key, out_dir, status):
    """Preserve missing rows on partial crawls, never call cached prices fresh."""
    previous = load_previous_store(key, out_dir)
    if not products:
        raise RuntimeError(f"{key}: ninguna ficha válida; se conserva el catálogo anterior")
    # A large unexplained drop is not proof that the store deleted its stock.
    if previous and len(products) < len(previous) * 0.8:
        status.update(partial=True, warning=status.get("warning") or
                      f"{key}: caída de cobertura ({len(products)}/{len(previous)}); revisar catálogo")
    current = {x.get("url") or x.get("nombre"): dict(x) for x in products}
    if status.get("partial"):
        for old in previous:
            identity = old.get("url") or old.get("nombre")
            if identity not in current:
                current[identity] = dict(old, datos_anteriores=True)
    products[:] = list(current.values())
    save_products(products, key, out_dir)
    return products


def navigate(page, url, selector=None, attempts=3):
    """Retry real navigation/render failures; HTTP errors are not valid pages."""
    for attempt in range(attempts):
        try:
            response = page.goto(url, wait_until="domcontentloaded", timeout=45000)
            if response is not None and response.status >= 400:
                raise RuntimeError(f"HTTP {response.status}: {url}")
            if selector:
                page.wait_for_selector(selector, state="attached", timeout=25000)
            return
        except Exception:
            if attempt == attempts - 1:
                raise
            page.wait_for_timeout(1000 * (attempt + 1))


def discover_menu_categories(base_url, fallback=()):
    soup = get_soup(base_url, timeout=40)
    if soup is None:
        return list(fallback)
    excluded = {"", "home", "inicio", "sobre", "sobre-nos", "contato", "contacto",
                "blog", "cart", "checkout", "login", "my-wishlist", "wishlist",
                "lista-de-desejos", "shop", "em-breve", "tour-virtual", "turista"}
    found = []
    for anchor in soup.select('nav a[href], header a[href], [role="navigation"] a[href]') or soup.select('a[href]'):
        parsed = urlparse(urljoin(base_url, anchor['href']))
        slug = parsed.path.strip('/')
        if (parsed.netloc.removeprefix('www.') == urlparse(base_url).netloc.removeprefix('www.')
            and slug not in excluded and '/' not in slug and not slug.endswith('.xml')
            and not slug.startswith(('politica', 'termos', 'wix-'))):
            if slug not in found:
                found.append(slug)
    return found or list(fallback)
