"""Scraper de Mantra Free Shop (Ecwid embebido en mantrafreeshop.com).

Descubre categorías y productos desde la tienda renderizada para no mantener
IDs manualmente. Los enlaces de Ecwid terminan en -c<ID> (categoría) y -p<ID>
(producto). Luego visita cada ficha y extrae nombre, precio e imagen.
"""
import re
import sys
from collections import deque
from pathlib import Path
from urllib.parse import urljoin, urlparse

sys.path.append(str(Path(__file__).parent))
from utils import clean_price, save_products

BASE_URL="https://mantrafreeshop.com"
CATEGORY_RE=re.compile(r"-c\d+(?:$|[?#])", re.I)
PRODUCT_RE=re.compile(r"-p\d+(?:$|[?#])", re.I)

def _slug_from_url(url):
    path=urlparse(url).path.strip("/")
    path=re.sub(r"-c\d+$", "", path)
    return path or "varios"

def _collect_links(page):
    links=page.locator("a[href]").evaluate_all("els => els.map(a => a.href)")
    cats=[]; products=[]
    for href in links:
        if not href or "mantrafreeshop.com" not in href: continue
        if CATEGORY_RE.search(href): cats.append(href.split('#')[0])
        elif PRODUCT_RE.search(href): products.append(href.split('#')[0])
    return list(dict.fromkeys(cats)), list(dict.fromkeys(products))

def _expand(page, rounds=50):
    previous=-1; stable=0
    for _ in range(rounds):
        count=page.locator("a[href]").count()
        stable=stable+1 if count==previous else 0
        if stable>=3: break
        previous=count
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        page.wait_for_timeout(700)

def _extract_detail(page, url, category):
    from bs4 import BeautifulSoup
    page.goto(url, wait_until="domcontentloaded", timeout=30000)
    page.wait_for_timeout(700)
    soup=BeautifulSoup(page.content(),"html.parser")
    h1=soup.find("h1")
    name=h1.get_text(" ",strip=True) if h1 else None
    if not name:
        title=soup.find("meta",attrs={"property":"og:title"})
        name=title.get("content") if title else None
    if not name: return None
    # En Ecwid el precio visible aparece como U$25.00 / U$ 3.95.
    price=None
    candidates=[]
    for tag in soup.find_all(["div","span","p"], limit=500):
        text=tag.get_text(" ",strip=True)
        if re.search(r"(?:USD|US\s*\$|U\$)\s*[\d.,]+", text, re.I):
            candidates.append(text)
    for text in sorted(candidates,key=len):
        price=clean_price(text)
        if price is not None and price>0: break
    image=None
    og=soup.find("meta",attrs={"property":"og:image"})
    if og: image=og.get("content")
    if not image:
        img=soup.find("img")
        image=img.get("src") if img else None
    return {"tienda":"Mantra Free Shop","nombre":name,"precio_usd":price,
            "precio_original_usd":None,"en_oferta":False,"categoria":category,
            "url":url,"imagen":image}

def run():
    from playwright.sync_api import sync_playwright
    product_categories={}
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True)
        page=browser.new_page()
        page.set_extra_http_headers({"User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36"})
        page.goto(BASE_URL,wait_until="domcontentloaded",timeout=30000); page.wait_for_timeout(1200); _expand(page)
        initial_cats, initial_products=_collect_links(page)
        for u in initial_products: product_categories.setdefault(u,"varios")
        queue=deque(initial_cats); seen_cats=set()
        while queue:
            cat=queue.popleft()
            if cat in seen_cats: continue
            seen_cats.add(cat)
            page.goto(cat,wait_until="domcontentloaded",timeout=30000); page.wait_for_timeout(700); _expand(page)
            subcats, products=_collect_links(page)
            label=_slug_from_url(cat)
            for u in products: product_categories.setdefault(u,label)
            for sub in subcats:
                if sub not in seen_cats: queue.append(sub)
            print(f"[Mantra] {label}: {len(products)} productos; total URLs {len(product_categories)}")
        if not product_categories:
            browser.close(); raise RuntimeError("Mantra: no se descubrieron productos en la tienda Ecwid")
        products=[]
        for i,(url,category) in enumerate(product_categories.items(),1):
            try:
                item=_extract_detail(page,url,category)
                if item: products.append(item)
            except Exception as exc:
                print(f"  [aviso] Mantra no pudo leer {url}: {exc}")
            if i%50==0: print(f"[Mantra] fichas {i}/{len(product_categories)}")
        browser.close()
    if not products: raise RuntimeError("Mantra: no se pudo extraer ninguna ficha")
    save_products(products,"mantra",Path(__file__).parent.parent/"data")
    return products

if __name__=="__main__": run()
