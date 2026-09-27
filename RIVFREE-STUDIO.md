# RivFree Studio

RivFree Studio es el editor visual local del sitio. En Windows abrí `Abrir-RivFree-Studio.bat`.
El acceso anterior `Abrir-editor-manual.bat` sigue funcionando y abre el mismo editor.

## Qué se puede editar sin código

### Diseño
- Nombre y subtítulo del sitio.
- Tipografía entre presets seguros.
- Densidad/espaciado, radio de bordes y nivel de sombras.
- Paleta separada para modo claro y oscuro.
- Imagen de fondo independiente para claro/oscuro y nivel de overlay.
- Vista previa de escritorio y celular antes de guardar.

### Carrusel
- Crear, editar, duplicar, borrar y reordenar campañas.
- Activar/desactivar banners sin borrarlos.
- Elegir grupo de la pool, color, layout y categoría de destino.
- Banner editorial o patrocinado.
- Programar fecha/hora de inicio y finalización.
- Subir una imagen desde la computadora.
- Mantener campañas inteligentes basadas en comparación, ofertas, multitienda o categorías.
- Elegir cuántos banners entran en la selección aleatoria y el tiempo de autoplay.

### Página
- Mostrar/ocultar y reordenar carrusel, beneficios, Por descubrir, Más consultados y catálogo.
- Editar aviso de disponibilidad en español y portugués.
- Cambiar título/descripción SEO y la imagen social.
- Editar el footer y el enlace de privacidad.

### Catálogo
Las pestañas Productos, Tiendas y Colaboraciones siguen funcionando como antes.

## Dónde se guardan los cambios

- Configuración visual/contenido: `data/site-config.json`
- Pool del carrusel: `data/highlights.json`
- Imágenes subidas: `assets/manual/`
- Productos manuales: `data/manual-products.json`
- Tiendas manuales: `data/manual-stores.json`

El scraper no modifica `site-config.json`, `highlights.json` ni los archivos manuales.

## Publicar

Después de guardar y revisar la vista previa:

```bash
git status
git add .
git commit -m "Actualizar RivFree Studio"
git pull --rebase origin main
git push origin main
```

La acción de publicación incluye automáticamente `site-config.json` y las imágenes de `assets/manual/`.

## Seguridad

El servidor del Studio solo escucha en `127.0.0.1` y las operaciones de escritura requieren un token generado para esa sesión. Colores, URLs, imágenes, cantidades y opciones se validan en el servidor antes de escribir los JSON. Antes de guardar se generan copias en `.manual-backups/`.

## Panel de control y productividad

- **Resumen / Salud** es la pantalla de inicio. Usa `health.json` y `meta.json` en modo lectura y muestra semáforos por scraper, último éxito, fallos consecutivos y cantidad de productos reportados.
- También resume publicaciones manuales sin imagen/inactivas y campañas vencidas/programadas.
- La vista previa acompaña Diseño, Carrusel y Página; puede alternarse entre escritorio y celular u ocultarse temporalmente.
- Cada pestaña tiene su propio punto de cambios pendientes. Guardar Diseño no persiste cambios pendientes de Página, y viceversa.
- El Studio guarda un borrador local cada pocos segundos cuando hay cambios visuales sin guardar y ofrece recuperarlo al volver a abrirlo.
- `Ctrl+S` / `Cmd+S` guarda la sección activa (o el formulario de Producto/Tienda).

## Catálogo manual avanzado

Productos permite filtrar por **sin imagen**, **inactivos** y **en oferta**, ordenar por precio/fecha/nombre y seleccionar varias publicaciones para ocultarlas, cambiar categoría o eliminarlas. El botón **Duplicar en otra tienda** conserva nombre, categoría e imagen y deja tienda/precio listos para completar.

Las acciones destructivas muestran un modal con los nombres afectados antes de confirmar. Los errores de formulario quedan junto al campo hasta corregirse.

