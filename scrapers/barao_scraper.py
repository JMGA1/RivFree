
import re
import sys
import time
import unicodedata
from pathlib import Path
from urllib.parse import unquote, urljoin, urlparse

sys.path.append(str(Path(__file__).parent))
from utils import (
    PRICE_RE,
    canonical_product_url,
    clean_price,
    extract_wix_detail_price,
    extract_wix_products,
    finalize_scrape,
    get_soup,
    navigate,
)

LAST_RUN_STATUS = {}
BASE_URL = "https://www.baraofreeshop.com.br"
DETAIL_RECOVERY_LIMIT = None  # recuperar todos los pendientes mientras haya presupuesto
DETAIL_RECOVERY_BUDGET_SECONDS = 50 * 60

RESERVED_PATHS = {
    "", "shop", "blog", "contato", "turista", "social", "trabalhe-conosco",
    "my-wishlist", "wishlist", "cart", "checkout", "lista-de-desejos", "home",
    "inicio", "o-barao", "seguranca-e-saude-no-trabalho", "saude-no-trabalho",
    "responsabilidadesocial", "responsabilidade-social", "blog-barao",
    "politica-de-privacidade", "politica-privacidade", "termos", "termos-de-uso",
}

CATEGORY_LABELS = {
    "femininos": "perfumeria-femininos",
    "masculinos": "perfumeria-masculinos",
    "esteelauder": "cosmetica-esteelauder",
    "lancomecosmeticos": "cosmetica-lancome",
    "clinique": "cosmetica-clinique",
    "loreal": "cosmetica-loreal",
    "maybelline": "cosmetica-maybelline",
    "larocheposay": "cosmetica-larocheposay",
    "cerave": "cosmetica-cerave",
    "victorias": "cosmetica-victoriassecret",
    "kerastase": "cosmetica-kerastase",
    "wella": "cosmetica-wella",
    "tommy-vestimesta": "ropa-tommy",
    "barbie": "jugueteria-barbie",
    "funkopop": "jugueteria-funkopop",
    "pokemon": "jugueteria-pokemon",
    "copia-de-condimentos": "chocolates",
}


def _valid_category_slug(path):
    path = (path or "").strip("/").lower()
    if not path or "/" in path or path in RESERVED_PATHS:
        return False
    if path.startswith(("product-page", "blank", "wix-", "_")):
        return False
    if any(token in path for token in ("responsabilidade", "saude-no-trabalho")):
        return False
    return True


def _category_identity(path):
    """Iguala slugs Unicode y percent-encoded (cópia == c%C3%B3pia)."""
    try:
        value = unquote((path or "").strip("/"))
    except Exception:
        value = (path or "").strip("/")
    return unicodedata.normalize("NFC", value).casefold()


def discover_categories():
    """Descubre categorías desde la navegación, evitando páginas institucionales."""
    soup = get_soup(BASE_URL, retries=3, delay=2, timeout=40)
    if soup is None:
        raise RuntimeError("Barão no respondió al descubrir categorías")

    anchors = soup.select('nav a[href], header a[href], [role="navigation"] a[href]')
    if not anchors:
        anchors = soup.find_all("a", href=True)

    slugs = []
    seen = set()
    for anchor in anchors:
        href = anchor.get("href")
        parsed = urlparse(urljoin(BASE_URL, href))
        if parsed.netloc.removeprefix("www.") != urlparse(BASE_URL).netloc.removeprefix("www."):
            continue
        path = parsed.path.strip("/")
        identity = _category_identity(path)
        if _valid_category_slug(path) and identity not in seen:
            seen.add(identity)
            slugs.append(path)

    if len(slugs) < 20:
        raise RuntimeError(f"Barão: solo se descubrieron {len(slugs)} categorías; menú posiblemente cambió")
    return slugs



def _discover_categories_rendered(page):
    """Segunda fuente para categorías: menú renderizado por Chromium."""
    try:
        navigate(page, BASE_URL, attempts=2)
        page.wait_for_timeout(700)
        hrefs = page.locator('nav a[href], header a[href], [role="navigation"] a[href]').evaluate_all(
            "els => els.map(a => a.href)"
        )
    except Exception as exc:
        print(f"[Barao] [aviso] no se pudo validar el menú renderizado: {exc}")
        return []

    base_host = urlparse(BASE_URL).netloc.removeprefix("www.")
    slugs = []
    seen = set()
    for href in hrefs:
        try:
            parsed = urlparse(urljoin(BASE_URL, href))
        except Exception:
            continue
        if parsed.netloc.removeprefix("www.") != base_host:
            continue
        slug = parsed.path.strip("/")
        identity = _category_identity(slug)
        if _valid_category_slug(slug) and identity not in seen:
            seen.add(identity)
            slugs.append(slug)
    return slugs


def _prices_from_text(text):
    """Devuelve (actual, anterior) leyendo sólo texto visible de una tarjeta."""
    if not text:
        return None, None
    matches = list(PRICE_RE.finditer(text.replace("\xa0", " ")))
    prices = [clean_price(match.group(0)) for match in matches]
    prices = [price for price in prices if isinstance(price, (int, float)) and price > 0]
    if not prices:
        return None, None
    current = prices[-1]
    original = prices[0] if len(prices) > 1 and prices[0] > current else None
    return current, original




def _collapse_visible_text(value):
    return " ".join((value or "").replace("\xa0", " ").split())


def _fill_prices_from_listing_text(products, visible_text):
    """Completa precios usando el texto realmente visible del listado.

    Wix/Barão a veces renderiza nombre y precio como componentes hermanos, por
    lo que page.content() y el product-item-root no siempre los dejan juntos.
    Acá ubicamos los nombres visibles en orden y limitamos cada búsqueda hasta
    el siguiente producto para no robar el precio de la tarjeta vecina.
    """
    text = _collapse_visible_text(visible_text)
    if not text or not products:
        return 0

    folded = text.casefold()
    located = []
    cursor = 0

    # Mantener el orden que entrega la grilla es importante: si hay nombres
    # repetidos, buscamos cada aparición a partir de la anterior.
    for index, product in enumerate(products):
        name = _collapse_visible_text(product.get("nombre"))
        if not name:
            continue
        needle = name.casefold()
        pos = folded.find(needle, cursor)
        if pos < 0:
            pos = folded.find(needle)
        if pos < 0:
            continue
        located.append((pos, index, name))
        cursor = pos + len(name)

    located.sort(key=lambda item: item[0])
    observed = 0
    for position, (pos, index, name) in enumerate(located):
        start = pos + len(name)
        end = min(len(text), start + 320)
        if position + 1 < len(located):
            next_pos = located[position + 1][0]
            if next_pos > start:
                end = min(end, next_pos)

        segment = text[start:end]
        current, original = _prices_from_text(segment)
        if current is None:
            continue

        product = products[index]
        product["precio_usd"] = current
        product["precio_original_usd"] = original
        product["en_oferta"] = bool(original and original > current)
        product["precio_fuente"] = "listado_visible"
        observed += 1

    return observed

def _name_from_text(text):
    text = " ".join((text or "").replace("\xa0", " ").split())
    if not text:
        return None
    match = PRICE_RE.search(text)
    if match:
        text = text[:match.start()]
    text = re.sub(r"\b(?:preço|precio|price)\s*$", "", text, flags=re.I).strip(" -–—|:")
    if text.lower() in {"esgotado", "sold out"}:
        return None
    return text or None


def _product_from_visible_row(row, category, existing=None):
    """Combina una tarjeta renderizada con el registro HTML; el precio visible gana."""
    existing = dict(existing or {})
    url = (row.get("url") or existing.get("url") or "").split("#")[0]
    if not url:
        return None
    current, original = _prices_from_text(row.get("text"))
    name = row.get("name") or existing.get("nombre") or _name_from_text(row.get("text"))
    if not name:
        return None

    product = {
        "tienda": "Barão Free Shop",
        "nombre": name,
        "precio_usd": existing.get("precio_usd"),
        "precio_original_usd": existing.get("precio_original_usd"),
        "en_oferta": existing.get("en_oferta", False),
        "categoria": category,
        "url": url,
        "imagen": row.get("image") or existing.get("imagen"),
    }
    # El DOM visible es la fuente más fiel: si el usuario ve un precio ahí,
    # reemplaza cualquier valor incompleto obtenido del HTML serializado.
    if current is not None:
        product["precio_usd"] = current
        product["precio_original_usd"] = original
        product["en_oferta"] = bool(original and original > current)
    return product


def _collect_visible_rows(page):
    """Obtiene una fila por producto usando el DOM que el navegador realmente muestra.

    Wix puede colocar el precio como hermano del link/título y fuera del
    product-item-root. Subimos por los padres sólo mientras el contenedor siga
    perteneciendo a UN único producto; así no tomamos el precio de la tarjeta vecina.
    """
    return page.locator('a[href*="/product-page/"]').evaluate_all(
        r"""
        links => {
          const byUrl = new Map();
          for (const a of links) {
            const href = (a.href || '').split('#')[0];
            if (!href) continue;
            let node = a;
            let chosen = null;
            for (let i = 0; i < 9 && node; i++, node = node.parentElement) {
              const hrefs = [...node.querySelectorAll('a[href*="/product-page/"]')]
                .map(x => (x.href || '').split('#')[0])
                .filter(Boolean);
              const unique = [...new Set(hrefs)];
              if (unique.length !== 1 || unique[0] !== href) continue;
              chosen = node;
              const text = (node.innerText || '').replace(/\u00a0/g, ' ');
              if (/(?:USD\s*\$?|US\s*\$|U\$S|U\$)\s*[0-9]/i.test(text) || /esgotado/i.test(text)) {
                break;
              }
            }
            const root = a.closest('[data-hook="product-item-root"]') || chosen || a.parentElement || a;
            const nameEl = root.querySelector('[data-hook="product-item-name"]');
            const img = root.querySelector('img') || (chosen && chosen.querySelector('img'));
            const candidate = chosen || root;
            const text = (candidate.innerText || root.innerText || a.innerText || '').trim();
            let name = (nameEl && nameEl.innerText || '').trim();
            if (!name) {
              name = (a.getAttribute('aria-label') || '').trim();
            }
            if (!name && img) name = (img.getAttribute('alt') || '').trim();
            const image = img ? (img.currentSrc || img.src || img.getAttribute('data-src') || null) : null;
            const old = byUrl.get(href);
            const score = (/(?:USD\s*\$?|US\s*\$|U\$S|U\$)\s*[0-9]/i.test(text) ? 10 : 0) + text.length;
            if (!old || score > old.score) byUrl.set(href, {url: href, text, name, image, score});
          }
          return [...byUrl.values()];
        }
        """
    )


def _extract_rendered_products(page, category):
    """Fusiona extracción Wix tradicional con el DOM visible renderizado."""
    from bs4 import BeautifulSoup

    generic = extract_wix_products(
        BeautifulSoup(page.content(), "html.parser"),
        "Barão Free Shop",
        category,
        BASE_URL,
    )
    by_url = {p.get("url"): p for p in generic if p.get("url")}

    for row in _collect_visible_rows(page):
        row["url"] = urljoin(BASE_URL, row.get("url") or "")
        existing = by_url.get(row["url"])
        product = _product_from_visible_row(row, category, existing)
        if product:
            by_url[product["url"]] = product

    return list(by_url.values())


def _expand_current_page(page, max_rounds=220):
    """Carga todos los 'Ver mais' conservando una medición basada en links reales."""
    previous = -1
    stable = 0
    for _ in range(max_rounds):
        count = page.locator('a[href*="/product-page/"]').evaluate_all(
            "els => new Set(els.map(a => (a.href || '').split('#')[0]).filter(Boolean)).size"
        )
        stable = stable + 1 if count == previous else 0
        previous = count
        more = page.get_by_role("button", name=re.compile(
            r"ver mais|mostrar mais|carregar mais|load more|show more|ver más|cargar más", re.I
        ))
        active = False
        if more.count():
            button = more.last
            active = button.is_visible() and button.is_enabled()
            if active:
                button.click(timeout=10000)
                page.wait_for_timeout(900)
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        page.wait_for_timeout(500)
        if stable >= 3 and not active:
            return count
        if stable >= 8 and active:
            raise RuntimeError("Barão: 'Ver mais' quedó activo pero la grilla dejó de crecer")
    raise RuntimeError("Barão: límite de expansión de categoría alcanzado")


def scrape_category(slug, page):
    """Procesa una categoría sin perder páginas ya leídas ante un fallo posterior."""
    url = f"{BASE_URL}/{slug}"
    category = CATEGORY_LABELS.get(slug, slug)
    products = {}
    signatures = set()
    try:
        navigate(page, url, 'a[href*="/product-page/"]')
        for page_no in range(1, 301):
            try:
                loaded = _expand_current_page(page)
                found = _extract_rendered_products(page, category)
                if not found:
                    raise RuntimeError("categoría sin productos legibles")

                try:
                    visible_text = page.locator("body").inner_text(timeout=10000)
                except Exception:
                    visible_text = ""
                visible_prices = _fill_prices_from_listing_text(found, visible_text)

                signature = tuple(sorted(p["url"] for p in found if p.get("url")))
                if signature in signatures:
                    raise RuntimeError("página repetida")
                signatures.add(signature)
                for product in found:
                    products[product["url"]] = product
                priced = sum(p.get("precio_usd") is not None for p in found)
                print(
                    f"[Barao]   {slug} página {page_no}: {len(found)} productos, "
                    f"{priced} con precio ({visible_prices} confirmados por texto visible; DOM {loaded} links)"
                )

                next_button = page.locator('[data-hook="pagination__next"], a[rel="next"]').first
                if (
                    not next_button.count()
                    or not next_button.is_visible()
                    or not next_button.is_enabled()
                    or next_button.get_attribute("aria-disabled") == "true"
                ):
                    return list(products.values())
                next_button.click(timeout=10000)
                page.wait_for_timeout(1800)
            except Exception as exc:
                if products:
                    LAST_RUN_STATUS.update(
                        partial=True,
                        warning="Barão: una parte de una categoría falló; se conservaron los avances",
                    )
                    print(f"[Barao] [aviso] {slug} página {page_no}: {exc}")
                    return list(products.values())
                raise
    except Exception as exc:
        LAST_RUN_STATUS.update(
            partial=True,
            warning="Barão: categorías fallidas; se conservan productos anteriores",
        )
        print(f"[Barao] [aviso] se omite {url}: {exc}")
        return list(products.values())


def _detail_price_from_page(page):
    """Lee precio del bloque principal de la ficha sin tocar recomendaciones."""
    from bs4 import BeautifulSoup

    current, original = extract_wix_detail_price(BeautifulSoup(page.content(), "html.parser"))
    if current is not None:
        return current, original

    # Algunos templates viejos de Barão no usan product-prices-wrapper.
    text = page.locator('h1, [data-hook="product-title"]').first.evaluate(
        r"""
        title => {
          let node = title;
          for (let i = 0; i < 8 && node; i++, node = node.parentElement) {
            const text = (node.innerText || '').replace(/\u00a0/g, ' ');
            if (/(?:USD\s*\$?|US\s*\$|U\$S|U\$)\s*[0-9]/i.test(text)) return text;
          }
          return title.innerText || '';
        }
        """
    )
    return _prices_from_text(text)


def _recover_missing_prices(page, products):
    missing = [p for p in products if p.get("precio_usd") is None and p.get("url")]
    if not missing:
        return 0, 0

    started = time.monotonic()
    recovered = 0
    attempted = 0
    failed = 0
    limit = len(missing) if DETAIL_RECOVERY_LIMIT is None else min(len(missing), DETAIL_RECOVERY_LIMIT)

    for product in missing[:limit]:
        if time.monotonic() - started >= DETAIL_RECOVERY_BUDGET_SECONDS:
            print(
                f"[Barao] [aviso] presupuesto de recuperación agotado tras {attempted}/{len(missing)} fichas; "
                f"recuperados {recovered}, fallidos {failed}"
            )
            break
        attempted += 1
        try:
            navigate(page, product["url"], 'h1, [data-hook="product-title"]', attempts=2)
            page.wait_for_timeout(350)
            current, original = _detail_price_from_page(page)
            if current is not None:
                product["precio_usd"] = current
                product["precio_original_usd"] = original
                product["en_oferta"] = bool(original and original > current)
                product["precio_fuente"] = "ficha"
                recovered += 1
            else:
                failed += 1
        except Exception as exc:
            failed += 1
            print(f"[Barao] [aviso] ficha sin precio {product['url']}: {exc}")

        if attempted % 100 == 0 or attempted == limit:
            pending_now = max(0, len(missing) - recovered)
            print(
                f"[Barao] recuperación {attempted}/{len(missing)}; "
                f"recuperados {recovered}; fallidos {failed}; pendientes {pending_now}"
            )

    pending = sum(p.get("precio_usd") is None for p in products)
    return recovered, pending


def _prefer_complete_duplicate(old, new):
    if old is None:
        return new
    old_score = int(old.get("precio_usd") is not None) * 4 + int(bool(old.get("imagen"))) + len(old.get("nombre") or "") / 1000
    new_score = int(new.get("precio_usd") is not None) * 4 + int(bool(new.get("imagen"))) + len(new.get("nombre") or "") / 1000
    return new if new_score >= old_score else old


def run():
    LAST_RUN_STATUS.clear()
    from playwright.sync_api import sync_playwright

    all_products = {}
    raw_keys = set()
    canonical_collisions = 0
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, args=["--disable-dev-shm-usage"])
        page = browser.new_page()
        page.set_extra_http_headers({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                          "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
        })

        categories = discover_categories()
        html_category_count = len(categories)
        rendered_categories = _discover_categories_rendered(page)
        category_ids = {_category_identity(slug) for slug in categories}
        for slug in rendered_categories:
            identity = _category_identity(slug)
            if identity not in category_ids:
                category_ids.add(identity)
                categories.append(slug)
        print(
            f"[Barao] {len(categories)} categorías únicas "
            f"(HTML {html_category_count}, renderizado {len(rendered_categories)})"
        )
        for slug in categories:
            print(f"[Barao] recorriendo categoria: {slug}")
            found = scrape_category(slug, page)
            for product in found:
                raw_key = product.get("url") or product.get("nombre")
                if raw_key:
                    raw_keys.add(raw_key)
                key = canonical_product_url(product.get("url")) or (
                    "fallback", product.get("nombre"), product.get("categoria")
                )
                if key in all_products:
                    canonical_collisions += 1
                all_products[key] = _prefer_complete_duplicate(all_products.get(key), product)
            print(f"[Barao]   -> {len(found)} productos")

        products = list(all_products.values())
        print(
            f"[Barao] normalización: {len(raw_keys)} URLs/registros distintos -> "
            f"{len(products)} productos canónicos; {canonical_collisions} duplicados fusionados"
        )
        listing_prices = sum(p.get("precio_usd") is not None for p in products)
        missing_before = len(products) - listing_prices
        print(
            f"[Barao] listado terminado: {len(products)} productos; "
            f"{listing_prices} con precio; {missing_before} pendientes"
        )

        recovered, pending = _recover_missing_prices(page, products)
        print(f"[Barao] detalle: {recovered} precios recuperados; {pending} pendientes")
        browser.close()

    if pending:
        LAST_RUN_STATUS.update(
            partial=True,
            warning=LAST_RUN_STATUS.get("warning") or f"Barão: {pending} productos siguen sin precio confirmado",
        )

    LAST_RUN_STATUS.update({
        "fresh_products": len(products),
        "prices_listing": listing_prices,
        "prices_recovered": recovered,
        "prices_pending": pending,
    })

    out_dir = Path(__file__).parent.parent / "data"
    finalize_scrape(products, "barao", out_dir, LAST_RUN_STATUS)
    return products


if __name__ == "__main__":
    run()
