# RivFree · Reestructuración de navegación y datos

**Actualización V2:** consultar `CAMBIOS-EXPLORACION-V2.md`. Se reintegraron los consultados personales, se agregó historial/recomendaciones y un ranking global inferior separado, además de categorías detalladas y WhatsApp por oferta. Las indicaciones de la primera versión sobre ocultar consultas personales y convertir Por descubrir en Más buscados quedan reemplazadas por ese documento.

## Abrir y revisar

Con Python 3 instalado, desde esta carpeta:

```sh
python database/serve.py
```

Abrir http://127.0.0.1:8880. Este servidor es solo para desarrollo local y escucha únicamente en tu equipo. Alternativa estática: `python -m http.server 8000` y abrir http://localhost:8000. No abrir index.html mediante doble clic: el catálogo necesita HTTP.

## Cambios incluidos

- Menú desplegable de categorías, botón Tiendas y directorio de las 7 tiendas actuales, sin logos. Búsqueda por nombre y categorías predominantes del catálogo; estas últimas no representan una especialización certificada.
- Fichas de tiendas con contactos, redes, Maps, horarios y secciones de trayectoria/fotos. El estado verde se calcula en America/Montevideo solo donde hay horarios estructurados. Feriados o cierres extraordinarios se pueden registrar en `hours_exceptions`.
- La portada muestra campañas y Por descubrir; no muestra el catálogo completo ni duplica el carrusel de consultas personales.
- Por descubrir usa selección aleatoria sin atribuirle popularidad. Al recibir `data/popular.json` con `searches > 0`, pasa a Más buscados. `views` se mantiene únicamente por compatibilidad con el cargador anterior.
- Tarjetas de búsqueda más amplias. Imagen, nombre y acción abren una ficha propia, con URL compartible `#/producto/...`, navegación Atrás y recarga directa compatibles con alojamiento estático.
- Imagen junto a ofertas, orden menor/mayor precio, tiendas A–Z, más nuevos y filtro por tienda. Más nuevos usa la fecha de incorporación del catálogo, no una fecha de lanzamiento inventada. Se conservan favoritos por oferta y cantidades.
- Descripción y especificaciones cuando existen en los datos. Se muestra capacidad/contenido y concentración reconocidos en el nombre; una ficha editorial verificada de iPhone 16 Pro sirve de ejemplo en `product-content.js`. No se inventaron fichas técnicas del resto de las 35 mil publicaciones.
- Productos relacionados de la misma marca reconocida; si no hay marca, misma categoría.

## SQLite incluida y flujo recomendado

`database/catalog.sqlite` contiene 35.256 publicaciones importadas y 7 tiendas. Tablas: stores, products, offers y daily_searches, con índices, restricciones y claves foráneas. El importador conserva variantes separadas; la agrupación entre tiendas continúa a cargo del motor existente. La base usa una identidad por publicación y permite consolidar productos posteriormente con revisión.

```sh
python database/manage.py import
python database/manage.py export --output staging
python database/manage.py ranking --output staging/popular.json
```

La importación se puede repetir sin duplicar publicaciones. Preserva descripciones y especificaciones ya editadas en la tabla products. Es una instantánea de trabajo: no reemplaza automáticamente los scrapers ni el editor Studio. Para publicar cambios, exportá a staging, revisá los JSON y regenerá meta.json, particiones y cachés con el flujo de publicación existente; no reemplaces solo products.json porque el frontend usa particiones y versiones. Hacé una copia de la SQLite antes de editarla.

El servidor local agrega una búsqueda cuando un visitante selecciona un producto tras buscarlo. Guarda solo producto, día UTC y contador; no guarda texto de búsqueda ni identificadores de usuario. Deduplica por dirección de conexión y URL durante un minuto, solo en memoria. El ranking abarca 30 días y se ve al recargar la portada. Esta métrica mide selecciones desde resultados, no todas las apariciones ni consultas sin selección. La versión estática no envía eventos. Para producción hay que alojar un endpoint equivalente con controles de abuso y adaptar la política de privacidad a la implementación final.

Para producción recomiendo PostgreSQL (por ejemplo Supabase) como fuente central, con importación de scrapers en staging y publicación transaccional. Separar productos canónicos, variantes, ofertas por tienda, sucursales, horarios, medios y contadores agregados. Las claves de servicio deben permanecer en un backend y el editor debe requerir autenticación; el catálogo público solo necesita lectura. Documentación: https://supabase.com/docs/guides/database/overview

## Información de tiendas y Google

Se verificaron horarios de Barão y Mantra y se corrigió Siñeriz: la dirección del centro estaba mezclada con los datos del shopping. Esta ficha ahora corresponde a Sepé 51. Las fuentes y fecha de consulta están guardadas en stores.json:

- https://www.baraofreeshop.com.br/contato
- https://mantrafreeshop.com/Eletr%C3%B4nicos-c31413558
- https://www.sineriz.com.uy/novedades.php
- Especificaciones de ejemplo: https://support.apple.com/es-es/121031

Las demás direcciones, teléfonos y redes proceden del ZIP y no están todas verificadas. Las tiendas sin trayectoria documentada lo indican expresamente.

Las valoraciones, cantidad de reseñas y fotografías de Google **no están conectadas**. La UI muestra su ausencia y ofrece Maps. Hay soporte para `google: {rating, count, url}` y `photos: [{url, caption, attribution}]`, pero se deben completar con datos obtenidos legítimamente y atribución correcta. Para información de Google actualizada, conectar Places API desde el backend con credenciales propias y place IDs verificados por sucursal. No guardar fotos/reseñas indefinidamente ni reutilizarlas sin revisar las condiciones. https://developers.google.com/maps/documentation/places/web-service/policies

## Validación

25 pruebas JavaScript (23 existentes y 2 de horarios) y una prueba de integración del servidor local aprobadas. Las 23 pruebas existentes de catálogo, coincidencias y búsqueda aprobadas. Importación, integridad SQLite, claves foráneas y exportación comprobadas. Navegación revisada en el navegador: directorio, detalle, búsqueda, ficha con ofertas de Neutral/DFA/Yury, orden descendente y filtro por tienda. Revisión visual en escritorio y a 390 px sin desbordamiento horizontal. No se ejecutó toda la batería de Studio/SEO; las pruebas antiguas que exigen un modal de producto deben adaptarse al nuevo comportamiento de página.

No se publicó en ningún servidor externo. Para una nueva versión productiva conviene revisar también las páginas SEO estáticas generadas, que mantienen su plantilla anterior; las rutas de producto nuevas son del frontend y no sustituyen por sí solas esa estrategia SEO.
