# RivFree v7 · versión para celular

## Celular

- **Una sola barra arriba**, como en Mercado Libre o Compras Paraguay:
  - ☰ menú, a la izquierda;
  - **RivFree**, en el centro;
  - 🔍 búsqueda y ♥ Mi lista, a la derecha. Mi lista muestra cuántos productos tiene.
  
  La barra queda fija al bajar.
- **La búsqueda se abre con la lupa**, debajo de la barra, con el teclado listo y las sugerencias. Mientras se ven resultados queda abierta para refinar la búsqueda.
- **El menú ☰ trae todo lo demás**, en un panel lateral:
  - accesos a **Ofertas**, **Tiendas** y **Mi lista**;
  - **Categorías**: cada una abre sus marcas y tipos con cantidades, y **Ver todo**;
  - **Dólar hoy**, para elegir la moneda de referencia;
  - **Idioma**, con banderas, y **tema** claro u oscuro;
  - las redes sociales.

  Se cierra con ✕, tocando afuera o con Esc.
- **Se quitaron del celular**: la fila de 5 pestañas, el selector de idioma y el botón de tema del encabezado (ahora están en el menú), y los pasos 01·02·03.
- **Las secciones vacías ya no se muestran**, por ejemplo «Más consultados por vos» antes de mirar productos.
- **Carrusel más bajo y proporcionado**: un banner de proporción fija (16:8,5) con título de 2 líneas y un botón chico. La imagen se ajusta sin deformarse y se cambia deslizando el dedo.
- **Tarjetas más compactas**: foto, nombre y precio. Tocar la tarjeta abre el producto. Los resultados se ven en 2 columnas.
- **Ficha de producto y aviso de disponibilidad más compactos**.

## Toda la página

- El tamaño general pasó de **125% a 110%**, en computadora y en celular.

## Texto SEO

- El título «Compará precios de free shops en Rivera y Livramento» ya no ocupa la parte de arriba. Ahora está al final, sobre el pie de página, en letra chica.
- Para Google:
  - se mantiene el `<h1>`, que sigue a la vista y Google lo lee igual;
  - el título y la descripción que aparecen en los resultados de búsqueda vienen de `<title>` y de la meta descripción, que no se ven en la página y no cambiaron.

## Archivos

| Archivo | Para qué |
|---|---|
| `mobile.css` | Diseño de celular (solo pantallas de 650 px o menos) |
| `mobile-shell.js` | Barra, búsqueda y menú lateral del celular |
| `tests/v7-mobile.test.cjs` | Pruebas |

También cambiaron:

- `ui-updates.css` (escala 110%);
- `nav-bar.js` (cotización dentro del menú);
- `explore.js` (categorías dentro del menú);
- `styles.css` y `tools/build_seo.cjs` (texto SEO al pie);
- `index.html` y `sw.js` (versiones);
- las pruebas de SEO.

## Verificación

- 138 pruebas JavaScript, las pruebas Python y la de integración de interfaz pasan.
- Se revisó el celular en 360, 390 y 430 px, en claro y oscuro: inicio, menú, categorías con marcas, búsqueda, resultados, ficha de producto y tiendas. No hay desplazamiento horizontal.
- En computadora solo cambia la escala.
