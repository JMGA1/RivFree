# RivFree 🛃

Compará precios de los freeshops de Rivera en un solo lugar, con filtros por
tienda, categoría, precio y ofertas.

El proyecto mantiene un catálogo compatible en `data/products.json` y publica además fragmentos por tienda en `data/products/` para evitar volver a descargar todo cuando cambia una sola tienda. Incluye scrapers para **Barão, DFA, Mantra, Neutral, Oprha, Sineriz y Yury's**. 

Cuando el mismo producto y su variante aparecen en varias tiendas, el sitio
los reúne en una tarjeta. El botón **Comparar precios** abre el detalle ordenado
de menor a mayor y cada opción enlaza a su publicación original.

Las etiquetas de las tiendas también son botones: al seleccionarlas muestran
dirección, horario, contacto y enlaces disponibles. El encabezado vuelve al
inicio y el modo oscuro queda guardado para la próxima visita.

---

## Cómo funciona

1. Un robot (GitHub Actions) visita las webs de los freeshops  y anota nombre + precio de cada producto en un archivo `data/products.json`.
2. Ese archivo se guarda automáticamente en mi repositorio de GitHub.
3. El sitio (`index.html`) lee ese archivo y te deja filtrar y comparar.
4. GitHub Pages publica el sitio en una dirección web propia






## Catálogo manual

Además de los scrapers, RivFree incluye un editor local para cargar free shops y publicaciones manuales sin que las actualizaciones automáticas las borren. En Windows se abre con `Abrir-editor-manual.bat`. Los datos viven en `data/manual-products.json` y `data/manual-stores.json` y se mezclan en el navegador con el catálogo automático. Ver `EDITOR-MANUAL.md`.

## Editor manual y colaboraciones

- `Abrir-editor-manual.bat`: administra el catálogo manual oficial y permite revisar/importar aportes externos.
- `Abrir-colaborador.bat`: abre un cargador aislado para otra persona. Sus datos quedan en `.contributor-work/` y se exportan como `rivfree-aporte-*.zip`.
- La pestaña **Colaboraciones** del editor principal permite revisar tiendas/productos, detectar posibles duplicados y seleccionar qué importar.
- Ver `COLABORACIONES.md` para el flujo completo.


## Mantenimiento del repositorio

Los archivos `data/barao.json`, `data/dfa.json`, `data/mantra.json`, `data/neutral.json`, `data/oprha.json`, `data/sineriz.json`, `data/yurys.json` y `debug_barao_output.txt` son cachés intermedios y ahora están en `.gitignore`. Si tu repositorio ya los tenía versionados, ejecutá **una sola vez**:

```bash
git rm --cached data/barao.json data/dfa.json data/mantra.json data/neutral.json data/oprha.json data/sineriz.json data/yurys.json debug_barao_output.txt
git commit -m "No versionar caches intermedios de scraping"
```

No se borran de tu disco: solamente dejan de formar parte de futuros commits.

## Cambios del proyecto

Los cambios notables se documentan en [`CHANGELOG.md`](CHANGELOG.md). No crear un `.md` nuevo por cada corrección puntual.
