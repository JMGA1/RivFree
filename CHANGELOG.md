## 2026-09-26 — RivFree Studio · Panel de control

- La pantalla inicial ahora es **Resumen / Salud**, leyendo `data/health.json` y `data/meta.json` para mostrar estado de scrapers, fallos consecutivos, último éxito y fecha del catálogo.
- El resumen también alerta por publicaciones manuales sin imagen/inactivas y campañas vencidas o programadas.
- La vista previa pasó a ser persistente para Diseño, Carrusel y Página.
- Cada sección visual muestra su propio indicador de cambios pendientes y los botones guardan únicamente esa sección.
- Se agregó borrador automático en `localStorage` con opción de recuperación al reabrir el Studio.
- El carrusel distingue **Vigente ahora / Programado / Vencido / Inactivo**.
- Productos incorpora filtros rápidos, orden, selección múltiple, acciones masivas y “Duplicar en otra tienda”.
- Errores de validación quedan visibles junto al campo; los errores de servidor no desaparecen solos. SEO muestra contadores de caracteres.
- Las confirmaciones destructivas usan modales propios con listado de elementos afectados.
- Diseño incorpora tres plantillas, edición hexadecimal junto al selector de color y ayuda contextual por pestaña.
- Colaboraciones incorpora buscador interno y los controles de reordenamiento incluyen etiquetas ARIA.
- `Ctrl/Cmd+S` guarda la pestaña activa.


## 2026-09-26 — RivFree Studio

- Se agregó un editor visual para apariencia, fondos, tipografía y espaciado.
- El carrusel ahora puede administrarse sin código, incluyendo programación y banners patrocinados.
- Se puede reordenar/ocultar secciones del home y editar aviso, SEO y footer.
- Se agregó `data/site-config.json`, vista previa responsive y backups automáticos.
- GitHub Pages publica la configuración del Studio y el service worker se actualizó a v26.

# Changelog

## [2026-09-27] — Studio: personalización y vista previa

- Edición en vivo de campañas, selección fija del banner y recuperación del formulario en el borrador automático.
- Vista previa grande y ampliable con escritorio de 1280 px, tablet de 768 px, celular de 390 px, tema, idioma y accesos a secciones.
- Confirmación de recepción de cambios, selección visible de plantillas y explicación de opciones.
- Correcciones de paleta, radio de 0 px, imágenes locales, persistencia independiente por sección y errores de guardado del carrusel.
- Visibilidad de secciones respetada al volver a renderizar el sitio; protección frente a respuestas iniciales tardías que podían reemplazar el borrador.
- Pruebas automáticas específicas del Studio en `tests/studio-preview.test.cjs`.

### Lista compartida compacta
- Los enlaces de favoritos ahora usan identificadores compactos en el fragmento (`#l=`), en lugar de incluir las claves completas de cada producto.
- Se mantiene compatibilidad de importación con los enlaces antiguos `#list=`.
- Al abrir un enlace compartido aparece inmediatamente un diálogo para importar la lista, sin tener que bajar hasta el catálogo.
- La importación compacta espera al catálogo si todavía está cargando y conserva los favoritos existentes.

Todos los cambios notables de RivFree se documentan aquí para evitar archivos de notas dispersos en la raíz.

## [2026-09-25]

### Rendimiento y publicación
- El catálogo automático se mantiene compatible en `data/products.json`, pero también se publica particionado por tienda en `data/products/*.json`.
- `data/meta.json` incluye un hash por tienda. El navegador descarga únicamente las tiendas cuyo hash cambió y reutiliza las demás desde IndexedDB.
- Si falla un fragmento actualizado, se conserva temporalmente la última copia local de esa tienda y se marca el modo offline; `products.json` sigue como fallback de compatibilidad.
- Los snapshots de `data/history/` se podan físicamente a los 90 más recientes.
- Los JSON intermedios por tienda se excluyen de nuevos commits; `products.json` y los fragmentos públicos son la salida versionada.

### Cotización
- La referencia USD→BRL se actualiza durante la publicación con Frankfurter y conserva el último valor válido si la consulta falla.
- El navegador ya no consulta directamente la API de cotización; sigue permitiendo una tasa manual como override.

### Privacidad, tipografía y SEO
- Se retiraron las solicitudes a Google Fonts. La web y el editor usan una pila tipográfica del sistema, sin descargar fuentes de terceros.
- Se agregaron `robots.txt` y `sitemap.xml`.
- La política de privacidad aclara que la consulta de cotización ocurre en el pipeline de publicación, no desde el navegador del visitante.

### Calidad
- Se agregó cobertura automática para literales enviados a `tr(...)`, evitando traducciones faltantes silenciosas.
- Se agregaron pruebas para actualización segura de cotización y para descargas parciales del catálogo por tienda.

## [2026-09-24]

### Catálogo manual y colaboraciones
- Editor local para crear, editar, ocultar y borrar tiendas y publicaciones manuales.
- Soporte para fuentes como “Visto en Instagram”, imágenes locales, importación CSV/JSON y exportación.
- Los datos manuales viven separados de los scrapers y sobreviven a las actualizaciones automáticas.
- Se agregó modo colaborador aislado y revisión de paquetes antes de incorporarlos al catálogo oficial.

### Interfaz y experiencia
- Mejoras de tipografía, espaciado, modo claro/oscuro y banners.
- Carrusel principal dinámico con pool de campañas y fallback local.
- Correcciones de búsqueda: texto visible, Enter/botón unificados y scroll a resultados.
- Mejoras de tarjetas, favoritos por tienda, cantidades y lista compartible.

### Estadísticas y privacidad
- La integración anterior de GA4 fue reemplazada por Cloudflare Web Analytics sin eventos personalizados de búsqueda/favoritos.
- Se mantuvieron favoritos, preferencias y consultas recientes como datos funcionales locales.
