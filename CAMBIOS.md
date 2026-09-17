# Actualización de scrapers RivFree

Este paquete contiene únicamente los archivos modificados. No reemplaza `data/products.json`, el frontend ni los archivos de datos actuales.

Cambios principales:
- Listados como fuente primaria de precio para Wix/Ecwid cuando el precio ya es visible.
- Avance por página/categoría conservado ante fallos tardíos.
- Dedupe por calidad: una observación con precio gana sobre un duplicado sin precio.
- DFA usa `/shop/` si responde y categorías principales como fallback.
- Mantra limita la presión sobre el servidor, respeta 429 y detiene la recuperación secundaria si hay rate limit repetido.
- Yury elimina el corte falso de 25 minutos y reporta detalles realmente visitados/pendientes.
- Barão filtra rutas institucionales y valida las categorías antes de tratarlas como catálogo.
- Oprha prueba primero el dominio `.com`, luego el legado `.com.br`, y no interpreta un 404 como ausencia de precios.
- Neutral valida cantidad esperada/cobertura y conserva el duplicado más completo.
- Siñeriz descubre categorías y recupera precios faltantes desde fichas con un límite acotado.
- El resumen separa productos frescos/cacheados, precios observados/recuperados y pendientes.
- El historial de precios se genera sólo para corridas completas; una corrida parcial nunca crea un snapshot histórico engañoso.
- GitHub Actions tiene límites de 180 min por job / 150 min para scraping, logs sin buffer, artifact de respaldo incluso ante fallo y opción de ejecutar una sola tienda manualmente.

Correcciones de compatibilidad después del primer intento:
- Se restauró `mantra_scraper._extract_detail_soup()` para los tests de regresión y se limita el precio al bloque principal de la ficha.
- `neutral_scraper.scrape_category()` vuelve a devolver una lista, manteniendo las métricas de cobertura en una función interna.
- `sineriz_scraper.scrape_category(slug)` vuelve a aceptar llamadas sin una página Playwright y nunca toma el precio de una tarjeta vecina.
- Se restauró la regla histórica: una actualización parcial no se escribe como un nuevo snapshot de historial.
