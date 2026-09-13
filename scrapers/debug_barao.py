"""
Script de diagnostico: NO es parte del scraper normal.

Abre una categoria de Barao, encuentra el PRIMER link a un producto, y
guarda en un archivo de texto el HTML real de ese link y de sus 3
contenedores "padre" -- asi podemos ver exactamente donde esta el nombre
y el precio de verdad, en vez de adivinar.

Corre esto y mandame el contenido de debug_barao_output.txt que te va a
quedar en la misma carpeta.
"""
from playwright.sync_api import sync_playwright

URL = "https://www.baraofreeshop.com.br/femininos"

with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True)
    page = browser.new_page()
    page.set_extra_http_headers({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    })
    print(f"Cargando {URL} ...")
    page.goto(URL, wait_until="domcontentloaded", timeout=30000)
    page.wait_for_selector('a[href*="/product-page/"]', timeout=20000)

    link = page.locator('a[href*="/product-page/"]').first
    link_html = link.evaluate("el => el.outerHTML")
    parent_html = link.evaluate("el => el.parentElement ? el.parentElement.outerHTML : 'NO HAY PADRE'")
    grandparent_html = link.evaluate("el => el.parentElement && el.parentElement.parentElement ? el.parentElement.parentElement.outerHTML : 'NO HAY ABUELO'")
    text_of_link = link.evaluate("el => el.innerText")
    text_of_parent = link.evaluate("el => el.parentElement ? el.parentElement.innerText : ''")

    output = f"""
========== TEXTO VISIBLE DEL LINK ==========
{text_of_link}

========== TEXTO VISIBLE DEL PADRE ==========
{text_of_parent}

========== HTML DEL LINK ==========
{link_html}

========== HTML DEL PADRE ==========
{parent_html}

========== HTML DEL ABUELO ==========
{grandparent_html}
"""
    with open("debug_barao_output.txt", "w", encoding="utf-8") as f:
        f.write(output)

    print("Listo. Se genero debug_barao_output.txt en esta misma carpeta.")
    browser.close()
