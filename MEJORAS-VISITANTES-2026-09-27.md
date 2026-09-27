# RivFree: lista de viaje y descubrimiento

Esta entrega incluye las mejoras anteriores del Studio y los once puntos de esta actualización.

## Instalación y publicación

1. Hacé una copia de tu carpeta actual y cerrá el Studio.
2. Copiá el contenido de `RivFree` del ZIP sobre la raíz del repositorio existente. El ZIP no lleva `.git` ni cambia tu conexión a GitHub.
3. Si todavía no instalaste Pillow, ejecutá `Instalar-dependencias-Studio.bat` una vez.
4. Abrí `Abrir-RivFree-Studio.bat` → **Publicar / copias**. Marcá **Incluir esta actualización del Studio y del workflow**, revisá archivos y commits y confirmá.
5. Esperá la finalización de GitHub Actions. El workflow genera las métricas del catálogo y actualiza las cotizaciones al publicar. Se actualizó también la versión del service worker.

## Funciones nuevas

1. **Ruta de Mi lista.** Agrupa las tiendas sin repetirlas, usa sus direcciones y arma un enlace con paradas. Conserva el orden en que aparecen las tiendas en la lista, sin afirmar que sea la ruta más corta. Google Maps determina el origen. Por defecto, el recorrido es a pie; puede cambiarse en Maps. Si se excede el límite de paradas o longitud de URL, muestra tramos consecutivos. Informa cuáles tiendas no tienen dirección y quedaron fuera.
2. **Comprado.** Casilla por producto con tachado. Persiste en el mismo navegador, incluso sin conexión. El total completo sigue visible y se agrega un subtotal pendiente. Marcarlo no cambia las cantidades ni lo elimina de la lista. Los enlaces compartidos no transmiten las marcas personales de comprado.
3. **Monedas.** USD, BRL, UYU y ARS. El precio original se conserva en USD y la conversión secundaria cambia en tarjetas, comparaciones y lista. Guarda la moneda y una tasa manual independiente por cada moneda. Cada referencia automática tiene su propia fecha; las tasas antiguas muestran un aviso. Si falla una moneda, no borra su último valor válido. ARS es una referencia de Frankfurter, no dólar blue ni tarjeta; se explica junto al cambio.
4. **Caída de precio.** El pipeline calcula la variación entre el primer precio observado dentro de una ventana de hasta 30 días y el último observado, para la misma tienda y URL. Exige al menos dos observaciones separadas por un día y que el último precio coincida con el actual. No usa el precio tachado publicitario como historial. Omite datos de tiendas con errores/parciales y precios arrastrados. La tarjeta indica porcentaje, días efectivamente observados y tienda; el detalle aparece al pasar el cursor. No descarga price-history.json para mostrar insignias. Las insignias con última observación de más de 7 días dejan de mostrarse.
5. **Mayor caída de precio.** Ordena por las caídas respaldadas de las ofertas que siguen visibles después de aplicar los filtros.
6. **Compartir producto.** Botón en la tarjeta. Comparte un enlace compacto de un único producto con cantidad uno, sin agregarlo a tu lista ni alterar tus favoritos. Usa el compartir del dispositivo, portapapeles o un campo para copiar, según disponibilidad. El destinatario recibe la confirmación habitual para importar ese producto. Si el producto deja de existir, se informa como no encontrado.
7. **Categorías múltiples.** Selección con chips eliminables: perfumes + bebidas aplica OR (cualquiera de las dos categorías). Conserva selección en la URL y al volver con el navegador. Los accesos del carrusel y atajos de categoría siguen funcionando como selección directa de una categoría.
8. **Recién agregados.** Usa `creado` en manuales y `primera_deteccion` en automáticos. El índice interno `data/catalog-first-seen.json` conserva la fecha entre corridas, incluso si desaparece y vuelve un producto. Para el catálogo que ya existía se usa la primera observación disponible o la fecha del catálogo anterior: no se inventa una fecha de alta comercial. El índice no se descarga en la web pública.
9. **Sugerencias de búsqueda.** Hasta cinco nombres, con una espera breve y procesamiento en pequeños bloques. Escribir no filtra ni reconstruye la grilla. Enter/botón ejecutan la búsqueda; seleccionar una sugerencia también es una acción explícita de búsqueda. Admite flechas, Escape y nombres accesibles.
10. **Contraste general.** Reporte para ambos modos: texto contra fondo y tarjetas, colores principal/acento y texto de botones. Una paleta personalizada con texto por debajo de 4.5:1 no se guarda silenciosamente: pide corregirla. Incluye botón para elegir texto blanco o negro según ambos fondos. Si los fondos son incompatibles entre sí, todavía se deben ajustar. Las imágenes de fondo requieren revisar también la vista previa; no se simula una certificación global de accesibilidad.
11. **Guía iOS.** Aviso pequeño para Safari en iPhone/iPad: Compartir → Agregar a inicio. Puede descartarse y no aparece en modo app instalada ni en la preview del Studio. Recuerda abrir el catálogo con conexión antes del viaje; instalar el acceso no descarga automáticamente páginas de las tiendas ni mapas.

## Datos y validación

- Se conservaron las configuraciones visuales, productos manuales, tiendas manuales y carrusel que recibimos.
- Se regeneraron productos, fragmentos por tienda, metadatos e índice de primera detección con los snapshots existentes. Se encontraron 12 publicaciones con descenso respaldado en esos datos; el número cambiará con nuevas corridas y filtros.
- Se obtuvieron BRL, UYU y ARS mediante la API. Las tasas son aproximadas y se vuelven a actualizar en el workflow.
- 98 pruebas Python, 71 pruebas JavaScript y la integración del catálogo aprobadas. Incluyen selección múltiple y URL, persistencia de comprado, división de rutas, compartir un solo producto, monedas independientes, sugerencias sin renderizar la grilla, guía iOS, contraste, fechas estables y cálculo de caídas.
- Las pruebas de interfaz se ejecutaron con DOM simulado. No se hizo una prueba física en iPhone ni navegación real por Google Maps. No se ejecutó un scraping completo de las tiendas ni se publicó en tu GitHub.

Referencias técnicas:

- https://developers.google.com/maps/documentation/urls/get-started
- https://frankfurter.dev/
- https://frankfurter.dev/currencies/
- https://support.apple.com/guide/iphone/iph42ab2f3a7/ios
