"""
Funciones compartidas que usan todos los scrapers de tiendas.
No hace falta tocar este archivo para agregar una tienda nueva.
"""
import re
import json
import time
import sys
from pathlib import Path
from urllib.parse import urljoin

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
}

PRICE_RE = re.compile(r"(?:USD\s*\$?|US\$|U\$S)\s*([\d.,]+)", re.IGNORECASE)
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


def get_soup(url, retries=3, delay=2):
    import requests
    from bs4 import BeautifulSoup
    for attempt in range(1, retries + 1):
        try:
            resp = requests.get(url, headers=HEADERS, timeout=20)
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


def expand_wix_catalog(page, max_rounds=80):
    """Pulsa 'Ver mais' y hace scroll hasta que Wix deje de cargar productos."""
    previous_count = -1
    stable_rounds = 0
    for _ in range(max_rounds):
        count = page.locator('[data-hook="product-item-root"]').count()
        stable_rounds = stable_rounds + 1 if count == previous_count else 0
        if stable_rounds >= 3:
            break
        previous_count = count

        buttons = page.get_by_role(
            "button", name=re.compile(r"ver mais|mostrar mais|load more", re.I)
        )
        if buttons.count():
            try:
                button = buttons.last
                if button.is_visible() and button.is_enabled():
                    button.click(timeout=3000)
            except Exception:
                pass
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        page.wait_for_timeout(800)
    return page.locator('[data-hook="product-item-root"]').count()


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
        if not link or not name_tag:
            continue
        name = name_tag.get_text(" ", strip=True)
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
        price = clean_price(current_raw)
        if price is not None and price <= 0:
            price = None
        original = clean_price(old_tag.get_text(" ", strip=True)) if old_tag else None
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
    with open(path, "w", encoding="utf-8") as f:
        json.dump(products, f, ensure_ascii=False, indent=2)
    print(f"[{store_name}] guardados {len(products)} productos en {path}")
    return path
