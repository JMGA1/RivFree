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
