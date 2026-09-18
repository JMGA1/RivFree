# RivFree 🛃

Compará precios de los freeshops de Rivera en un solo lugar, con filtros por
tienda, categoría, precio y ofertas.

El proyecto incluye datos guardados en `data/products.json` y scrapers para
**Barão, DFA, Mantra, Neutral, Oprha, Sineriz y Yury's**. 

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




