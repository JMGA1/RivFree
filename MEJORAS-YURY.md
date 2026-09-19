# Corrección de imágenes de Yury

El scraper guardaba el `src` provisional de Wix antes de que se cargara la foto
definitiva. En el catálogo recibido, 2.084 de las 6.186 imágenes de Yury incluían
`blur_2`. El perfume Mandarin Sky 100 ml de la captura usaba 49 × 49 píxeles.

Se corrigió el extractor compartido en `scrapers/utils.py`: las imágenes raster
del dominio exacto `static.wixstatic.com` se solicitan con `fit`, un máximo de
600 × 600 y sin desenfoque. También se preservan las comas internas de las URLs
Wix al leer `srcset`. Las URLs de otros proveedores no se modifican.

`scrapers/yurys_scraper.py` aplica la misma corrección a productos conservados
de ejecuciones anteriores cuando falla una categoría. Se repararon las 6.186
URLs actuales en `data/yurys.json` y `data/products.json`; `data/meta.json` tiene
una nueva versión para que el navegador descargue los datos corregidos.
Los precios, fechas, productos y datos de otras tiendas se conservaron.

## Aplicación

Esta entrega completa incluye también las mejoras de búsqueda de la entrega
anterior. Para aplicar solo el arreglo de imágenes a esa versión, reemplazar:

- `scrapers/utils.py`
- `scrapers/yurys_scraper.py`
- `data/yurys.json`
- `data/products.json`
- `data/meta.json`

Agregar también `tools/repair_yury_images.py` y `tests/test_yury_images.py`.
Publicar los datos junto con su archivo `meta.json` y recargar la página.
No se desplegó el sitio desde esta entrega.

Si tu catálogo ya es más nuevo que el incluido, conservar tus datos actuales y
ejecutar `python tools/repair_yury_images.py` en la raíz del proyecto. La herramienta
solo repara imágenes de Yury y recalcula la versión sin alterar fechas ni precios.
Puede ejecutarse varias veces.

## Verificación

- 59 pruebas Python y 28 pruebas JavaScript aprobadas.
- La URL nueva del perfume de la captura respondió HTTP 200, PNG, 600 × 600.
- Inspección visual de esa imagen: texto, caja y frasco nítidos.
- Comparación con el ZIP original: en el catálogo solo cambiaron imágenes de Yury.
- No se volvió a ejecutar el scraping completo ni se comprobaron individualmente
  las 6.186 URLs remotas; la verificación visual remota fue sobre el ejemplo reportado.

Ficha utilizada para verificar el ejemplo:
https://www.yurysfreeshop.com/product-page/perf-armaf-odyssey-mandarin-sky-men-edp-100ml
