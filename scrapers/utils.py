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
        roots_count = page.locator('[data-hook="product-item-root"]').count()
        links_count = page.locator('a[href*="/product-page/"]').count()
        count = max(roots_count, links_count)
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


def collect_wix_category(page, store, category, base_url, with_status=False):
    """Recorre una categoría Wix conservando lo ya leído si una página falla.

    with_status=True devuelve (productos, warning_parcial). Sin esa opción se
    mantiene la API histórica y devuelve solamente la lista.
    """
    from bs4 import BeautifulSoup
    products = {}
    signatures = set()
    warning = None

    def finish():
        rows = list(products.values())
        return (rows, warning) if with_status else rows

    for _ in range(300):
        expand_error = None
        try:
            loaded = expand_wix_catalog(page)
        except Exception as exc:
            # Aunque "cargar más" falle, el DOM puede contener decenas de
            # productos válidos. Los extraemos antes de decidir abortar.
            expand_error = str(exc)
            loaded = max(
                page.locator('[data-hook="product-item-root"]').count(),
                page.locator('a[href*="/product-page/"]').count(),
            )

        found = extract_wix_products(
            BeautifulSoup(page.content(), 'html.parser'), store, category, base_url
        )
        signature = tuple(sorted(x['url'] for x in found if x.get('url')))
        if not found:
            if products:
                warning = warning or "página posterior vacía/ilegible; se conserva avance"
                return finish()
            raise RuntimeError("Página Wix vacía o ilegible")
        if signature in signatures:
            if products:
                warning = warning or "paginación repetida; se conserva avance"
                return finish()
            raise RuntimeError("Página Wix repetida")
        if loaded and len(found) < loaded:
            # No descartamos la página: guardamos las tarjetas legibles y
            # reportamos la diferencia para el resumen.
            warning = warning or f"tarjetas legibles {len(found)}/{loaded}"

        signatures.add(signature)
        for item in found:
            products[item['url']] = merge_product_records(products.get(item['url']), item)

        if expand_error:
            warning = warning or f"carga parcial: {expand_error}"
            return finish()

        next_button = page.locator('[data-hook="pagination__next"], a[rel="next"]').first
        if (not next_button.count() or not next_button.is_visible()
                or not next_button.is_enabled()
                or next_button.get_attribute('aria-disabled') == 'true'):
            return finish()
        try:
            next_button.click(timeout=10000)
            page.wait_for_timeout(2000)
        except Exception as exc:
            warning = warning or f"no se pudo abrir página siguiente: {exc}"
            return finish()

    if products:
        warning = warning or "límite de paginación Wix alcanzado"
        return finish()
    raise RuntimeError("Límite de paginación Wix alcanzado sin productos")


async def collect_wix_category_async(page, store, category, base_url, with_status=False):
    """Versión async que conserva avances por página igual que la síncrona."""
    from bs4 import BeautifulSoup
    products = {}
    signatures = set()
    warning = None

    def finish():
        rows = list(products.values())
        return (rows, warning) if with_status else rows

    for _ in range(300):
        previous = -1
        stable = 0
        load_error = None
        count = 0
        for round_no in range(200):
            roots_count = await page.locator('[data-hook="product-item-root"]').count()
            links_count = await page.locator('a[href*="/product-page/"]').count()
            count = max(roots_count, links_count)
            stable = stable + 1 if count == previous else 0
            previous = count
            buttons = page.get_by_role('button', name=re.compile(
                r'ver mais|mostrar mais|carregar mais|load more|show more|ver más|cargar más', re.I))
            active = False
            if await buttons.count():
                button = buttons.last
                active = await button.is_visible() and await button.is_enabled()
                if active:
                    try:
                        await button.click(timeout=10000)
                    except Exception as exc:
                        load_error = f"cargar más: {exc}"
                        break
            if stable >= 4 and not active:
                break
            if stable >= 8:
                load_error = "la grilla dejó de crecer con cargar-más activo"
                break
            if round_no == 199:
                load_error = "límite de carga Wix alcanzado"
                break
            await page.evaluate('window.scrollTo(0, document.body.scrollHeight)')
            await page.wait_for_timeout(1500)

        found = extract_wix_products(
            BeautifulSoup(await page.content(), 'html.parser'), store, category, base_url
        )
        signature = tuple(sorted(x['url'] for x in found if x.get('url')))
        if not found:
            if products:
                warning = warning or "página posterior vacía/ilegible; se conserva avance"
                return finish()
            raise RuntimeError('Página Wix vacía o ilegible')
        if signature in signatures:
            if products:
                warning = warning or 'paginación repetida; se conserva avance'
                return finish()
            raise RuntimeError('Página Wix repetida')
        if count and len(found) < count:
            warning = warning or f"tarjetas legibles {len(found)}/{count}"

        signatures.add(signature)
        for item in found:
            products[item['url']] = merge_product_records(products.get(item['url']), item)

        if load_error:
            warning = warning or load_error
            return finish()

        button = page.locator('[data-hook="pagination__next"], a[rel="next"]').first
        if (not await button.count() or not await button.is_visible()
                or not await button.is_enabled()
                or await button.get_attribute('aria-disabled') == 'true'):
            return finish()
        try:
            await button.click(timeout=10000)
            await page.wait_for_timeout(2000)
        except Exception as exc:
            warning = warning or f"no se pudo abrir página siguiente: {exc}"
            return finish()

    if products:
        warning = warning or 'límite de paginación Wix alcanzado'
        return finish()
    raise RuntimeError('Límite de paginación Wix alcanzado sin productos')


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


def _price_values_from_text(text):
    values = []
    for match in PRICE_RE.finditer(text or ""):
        value = clean_price(match.group(0))
        if value is not None and value > 0:
            values.append(value)
    return values


def _nearest_single_product_container(link, max_levels=7):
    """Busca un contenedor que pertenezca solo a la ficha enlazada.

    Wix cambia seguido la ubicación del precio. A veces el enlace/nombre queda
    dentro de product-item-root y el precio en un padre inmediato. Subimos solo
    mientras el contenedor no mezcle más de un producto para no asociar el
    precio de una tarjeta vecina.
    """
    container = link
    best = link
    for _ in range(max_levels):
        if container is None:
            break
        product_urls = {
            a.get("href") for a in container.select('a[href*="/product-page/"]')
            if a.get("href")
        }
        if len(product_urls) > 1:
            break
        best = container
        if _price_values_from_text(container.get_text(" ", strip=True)):
            return container
        container = container.parent
    return best


def merge_product_records(old, new):
    """Fusiona duplicados conservando la observación más completa.

    Regla principal: un duplicado con precio observado gana sobre uno sin
    precio. Los campos faltantes se completan sin borrar información útil.
    """
    if not old:
        return dict(new)
    if not new:
        return dict(old)
    merged = dict(old)
    old_price = old.get("precio_usd")
    new_price = new.get("precio_usd")
    prefer_new = new_price is not None or old_price is None
    if prefer_new:
        for key, value in new.items():
            if value is not None and value != "":
                merged[key] = value
    else:
        for key, value in new.items():
            if key not in merged or merged.get(key) in (None, ""):
                merged[key] = value
    # Un registro fresco reemplaza la marca de cache si efectivamente observó
    # datos de esta corrida.
    if not new.get("datos_anteriores"):
        merged.pop("datos_anteriores", None)
    return merged


def dedupe_products_prefer_complete(products):
    by_key = {}
    order = []
    for product in products:
        if not isinstance(product, dict):
            continue
        key = product.get("url") or product.get("nombre")
        if not key:
            continue
        if key not in by_key:
            order.append(key)
            by_key[key] = dict(product)
        else:
            by_key[key] = merge_product_records(by_key[key], product)
    return [by_key[key] for key in order]


def catalog_metrics(products):
    products = [p for p in products if isinstance(p, dict)]
    return {
        "productos_total": len(products),
        "productos_anteriores": sum(bool(p.get("datos_anteriores")) for p in products),
        "precios_disponibles": sum(isinstance(p.get("precio_usd"), (int, float)) and p.get("precio_usd", 0) > 0 for p in products),
        "precios_pendientes": sum(not (isinstance(p.get("precio_usd"), (int, float)) and p.get("precio_usd", 0) > 0) for p in products),
    }


def extract_wix_products(soup, store_name, category, base_url):
    """Lee tarjetas Wix sin depender de un único data-hook.

    Primero usa product-item-root cuando existe. Luego recorre enlaces de
    producto y busca el contenedor padre más cercano que pertenezca a una sola
    ficha. Esto cubre layouts donde Wix deja el precio fuera del root.
    """
    by_url = {}

    def build_product(link, container):
        href = urljoin(base_url, link.get("href", ""))
        if not href:
            return None
        name_tag = container.select_one('[data-hook="product-item-name"], [data-hook="product-name"], h2, h3, h4') if container else None
        image_tag = (container.find("img") if container else None) or link.find("img")
        name = name_tag.get_text(" ", strip=True) if name_tag else link.get_text(" ", strip=True)
        if not name and image_tag:
            name = image_tag.get("alt", "").strip()
        if not name:
            return None

        current_tag = container.select_one(
            '[data-hook="product-item-price-to-pay"], '
            '[data-hook="formatted-primary-price"], '
            '[data-hook="product-item-price"]'
        ) if container else None
        old_tag = container.select_one(
            '[data-hook="product-item-price-before-discount"], '
            '[data-hook="product-item-price-before-discount-to-pay"], '
            '[data-hook="formatted-secondary-price"]'
        ) if container else None

        price = None
        if current_tag:
            price = clean_price(current_tag.get_text(" ", strip=True))
            if price is None:
                raw = (current_tag.get("data-wix-price") or "").strip()
                price = clean_price(raw)
                if price is None and re.fullmatch(r"\d+(?:[.,]\d{1,2})?", raw):
                    price = float(raw.replace(",", "."))

        text = container.get_text(" ", strip=True) if container else link.get_text(" ", strip=True)
        parsed_card = parse_wix_product_text(text)
        if parsed_card and price is None:
            price = parsed_card[1]
        if price is not None and price <= 0:
            price = None

        original = clean_price(old_tag.get_text(" ", strip=True)) if old_tag else None
        if original is None and parsed_card:
            original = parsed_card[2]
        if original is not None and (price is None or original <= price):
            original = None

        return {
            "tienda": store_name,
            "nombre": name,
            "precio_usd": price,
            "precio_original_usd": original,
            "en_oferta": price is not None and original is not None,
            "categoria": category,
            "url": href,
            "imagen": extract_image_url(container or link),
        }

    # Camino normal de Wix.
    for root in soup.select('[data-hook="product-item-root"]'):
        link = root.select_one('a[href*="/product-page/"]')
        if not link:
            continue
        product = build_product(link, root)
        if product:
            by_url[product["url"]] = merge_product_records(by_url.get(product["url"]), product)

    # Respaldo: el precio puede estar en un padre externo al root o Wix puede
    # haber cambiado completamente el hook del root.
    for link in soup.select('a[href*="/product-page/"]'):
        container = _nearest_single_product_container(link)
        product = build_product(link, container)
        if product:
            by_url[product["url"]] = merge_product_records(by_url.get(product["url"]), product)

    return list(by_url.values())

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
