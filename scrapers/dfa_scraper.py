"""Scraper completo de DFA Uruguay (WooCommerce).

En vez de mantener una lista manual de categorías y limitarla a 15 páginas,
recorre /shop/ una sola vez. Así cada producto aparece una vez y el scraper
se adapta aunque DFA agregue categorías o el catálogo supere cientos de páginas.
"""
import math
import re
import sys
import time
from pathlib import Path

sys.path.append(str(Path(__file__).parent))
from utils import get_soup, clean_price, save_products, POLITE_DELAY

BASE_URL = "https://www.dfauy.com"
PRODUCTS_PER_PAGE = 30
HARD_SAFETY_CAP = 1000

def _total_pages(soup):
    text = soup.get_text(" ", strip=True)
    m = re.search(r"(?:of|de)\s+([\d.]+)\s+resultados", text, re.I)
    if m:
        total = int(m.group(1).replace(".", ""))
        return max(1, math.ceil(total / PRODUCTS_PER_PAGE)), total
    pages = []
    for a in soup.select("a.page-numbers"):
        t = a.get_text(strip=True)
        if t.isdigit(): pages.append(int(t))
    return (max(pages) if pages else 1), None

def _category_from_item(item):
    classes = item.get("class", [])
    cats = [c[len("product_cat_"):] for c in classes if c.startswith("product_cat_")]
    # Preferimos una categoría no excesivamente específica; si no, la primera.
    return cats[0] if cats else "varios"

def _extract_page(soup):
    products=[]
    for item in soup.select("ul.products li.product"):
        link_tag = item.select_one("a.woocommerce-loop-product__link") or item.select_one("a[href]")
        title_tag = item.select_one("h2.woocommerce-loop-product__title, h3.woocommerce-loop-product__title, .woocommerce-loop-product__title")
        price_tag = item.select_one("span.price")
        img_tag = item.select_one("img")
        name = title_tag.get_text(" ", strip=True) if title_tag else None
        if not name and link_tag:
            name = link_tag.get("aria-label") or link_tag.get_text(" ", strip=True)
        if not name: continue
        current=original=None
        if price_tag:
            sale=price_tag.select_one("ins")
            old=price_tag.select_one("del")
            if sale:
                current=clean_price(sale.get_text(" ",strip=True))
                original=clean_price(old.get_text(" ",strip=True)) if old else None
            else:
                current=clean_price(price_tag.get_text(" ",strip=True))
        # No inventar precios: productos sin precio publicado se conservan con null.
        image=None
        if img_tag:
            image=img_tag.get("data-src") or img_tag.get("data-lazy-src") or img_tag.get("src")
        products.append({
            "tienda":"DFA", "nombre":name, "precio_usd":current,
            "precio_original_usd":original if original and current and original>current else None,
            "en_oferta":bool(original and current and original>current),
            "categoria":_category_from_item(item),
            "url":link_tag.get("href") if link_tag else None, "imagen":image,
        })
    return products

def run():
    first=get_soup(f"{BASE_URL}/shop/")
    if first is None: raise RuntimeError("DFA no respondió en /shop/")
    total_pages,total_products=_total_pages(first)
    if total_pages>HARD_SAFETY_CAP:
        raise RuntimeError(f"DFA informó {total_pages} páginas; supera el límite de seguridad")
    print(f"[DFA] catálogo general: {total_products or '?'} productos, {total_pages} páginas")
    all_products=[]
    for page_no in range(1,total_pages+1):
        soup=first if page_no==1 else get_soup(f"{BASE_URL}/shop/page/{page_no}/")
        if soup is None:
            raise RuntimeError(f"DFA falló en la página {page_no}/{total_pages}")
        found=_extract_page(soup)
        if not found:
            raise RuntimeError(f"DFA devolvió una página vacía inesperada: {page_no}/{total_pages}")
        all_products.extend(found)
        if page_no % 25 == 0 or page_no == total_pages:
            print(f"[DFA] página {page_no}/{total_pages}: {len(all_products)} productos")
        if page_no < total_pages: time.sleep(POLITE_DELAY)
    seen=set(); unique=[]
    for product in all_products:
        key=product.get("url") or product["nombre"]
        if key not in seen:
            seen.add(key); unique.append(product)
    if total_products and len(unique) < total_products * .95:
        raise RuntimeError(f"DFA incompleto: se esperaban ~{total_products} y se leyeron {len(unique)}")
    save_products(unique,"dfa",Path(__file__).parent.parent/"data")
    return unique

if __name__ == "__main__": run()
