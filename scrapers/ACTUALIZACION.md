# RivFree: actualización de rendimiento y funciones

## Aplicar los cambios

1. Descomprimí el ZIP y copiá **todo el contenido de RivFree-main** sobre tu proyecto. Incluí la carpeta `.github`; conservá tu carpeta `.git`.
2. Probá desde un servidor HTTP: `python -m http.server 8000`, luego abrí `http://localhost:8000`. No abras el HTML con doble clic: Workers y PWA necesitan HTTP/HTTPS.
3. Revisá los cambios, hacé commit y push. El workflow publica el HTML, CSS, scripts, iconos y datos necesarios.
4. En Actions, ejecutá el workflow con **actualizar_precios** activado para renovar el catálogo. El ZIP no contiene un scraping completo nuevo de todas las tiendas.

## Qué cambió

- **Caché:** IndexedDB conserva el catálogo; `data/meta.json` tiene fecha y versión hash. Una visita con la misma versión no descarga products.json. El hash detecta también correcciones con la misma fecha. Si falla la actualización, se conserva la copia completa anterior y se muestra un aviso.
- **Worker:** descarga, parseo, normalización, agrupación y vocabulario se ejecutan fuera del hilo principal. Hay alternativa local si el navegador no soporta Workers. La caché es local al navegador y puede ser eliminada por este o por el usuario.
- **Oprha:** todos los precios quedan en `null`, incluso en los datos conservados de una corrida anterior. Sus metadatos no se consideran precios públicos. Se agregó una alternativa con Playwright para encontrar enlaces si Wix no los entrega en HTML. La recuperación completa de su catálogo queda pendiente de una corrida real: el sitio no respondió durante esta revisión.
- **Yury:** se mejoró la lectura de precios Wix y se consultan fichas para tarjetas sin precio (hasta cuatro consultas simultáneas). El lector fue comprobado contra una ficha real con USD 269 y una muestra de categoría. Una categoría que falla detiene esa tienda para conservar el catálogo previo completo; no se publica como actualización exitosa un listado truncado por ese error. La primera recuperación de miles de fichas puede demorar bastante.
- **Frecuencia:** actualización diaria, 08:15 UTC. Se mantiene el aviso de antigüedad a las 48 horas.
- **Alertas:** health.json cuenta fallas por tienda. Tras tres corridas completas fallando, el workflow abre un Issue; no duplica uno abierto y lo cierra al recuperarse. Los contadores empiezan con esta versión; no se inventaron corridas anteriores. Requiere Issues habilitados y permiso `issues: write`. No se creó ningún Issue durante esta entrega.
- **Historial:** snapshots fechados en `data/history/`; solo incluyen observaciones de tiendas actualizadas correctamente. El público consulta una serie resumida de las últimas 90 corridas bajo demanda con el botón Historial. No hay datos históricos inventados: empezarán a aparecer en las próximas actualizaciones. Los snapshots permanecen en el repositorio y no se copian al sitio público.
- **BRL:** conversión aproximada en tarjetas, comparación y lista. Configurá `usd_brl` y `actualizado` en `data/exchange.json`, o ingresá una cotización desde la página. La cotización personal queda guardada en ese navegador. No se incluyó una tasa financiera supuesta ni se aplica como precio oficial de tienda.
- **URL:** búsqueda confirmada con Enter, categoría, tiendas, orden, rangos y ofertas se conservan en query params. La opción de favoritos también se conserva, pero la lista es privada/local y no viaja en el enlace.
- **Favoritos:** guardado local, filtro, eliminación y lista agrupada según la oferta más barata del catálogo completo. El subtotal considera una unidad por producto con precio; no confirma stock ni que se pueda comprar a ese valor. Los productos que salen del catálogo siguen en la lista como no disponibles.
- **Mapa:** enlaces de búsqueda a Google Maps desde la ficha de tienda y la lista. Usan las direcciones existentes; no se verificaron nuevas sucursales.
- **SEO/PWA:** descripción, Open Graph/Twitter, imagen social, manifest, iconos y caché de la interfaz. La URL de imagen social está configurada para `https://jmga1.github.io/RivFree/`; ajustala en index.html si usás otro dominio. El catálogo offline exige haberlo cargado previamente. La instalación depende del navegador y HTTPS (localhost funciona para desarrollo).
- **Mantenimiento:** HTML, CSS, catálogo, caché y funciones de interfaz están separados. El workflow incluye pruebas antes de publicar.

## Pruebas

```sh
pip install -r requirements.txt
python -m unittest discover -s tests -v
npm ci
npm test
npm run test:ui
```

Se verifican aliases ES/PT, medidas equivalentes, concentraciones, colores y packs, descripciones incompletas, duplicados, precios ausentes, Oprha sin precios, lectura Wix, fallas/recuperación, historial y caché. Las pruebas JS requieren Node 22.22.2, 24.15 o posterior compatible. La prueba de integración DOM verifica filtros, favoritos, lista, conversión, reutilización real de IndexedDB (simulado) y fallback offline; no sustituye una prueba en navegador real.

Pendiente de validación final: prueba visual y de instalación/offline PWA en Chrome/Android, y corrida completa de los scrapers. La descarga de Chromium no estuvo disponible en el entorno de revisión.
