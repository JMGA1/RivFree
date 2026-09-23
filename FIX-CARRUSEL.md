# Corrección del carrusel principal

Esta versión corrige el caso en el que el carrusel principal quedaba oculto si el inventario de campañas no podía descargarse.

Cambios:
- El inventario editable se carga desde `data/highlights.json`.
- Se mantiene `data/campaigns.json` por compatibilidad, pero ya no es necesario para renderizar el home.
- `storefront.js` incluye una pool de respaldo para que el carrusel siempre tenga contenido.
- El service worker sube a `rivfree-shell-v15` para invalidar el cache anterior.
- `index.html` usa una versión nueva de `storefront.js` para evitar que el navegador conserve el JS viejo.
