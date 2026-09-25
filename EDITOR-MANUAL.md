# Editor manual de RivFree

Esta versión separa los datos obtenidos por scrapers de los datos cargados a mano.

- `data/products.json`: catálogo automático. Los workflows pueden reemplazarlo.
- `data/manual-products.json`: publicaciones creadas desde el editor.
- `data/stores.json`: información base de tiendas.
- `data/manual-stores.json`: tiendas nuevas y sobrescrituras hechas desde el editor.
- `assets/manual/`: imágenes subidas desde la computadora.

El navegador mezcla ambos catálogos al cargar RivFree. Por eso una corrida nueva de los scrapers **no elimina las publicaciones manuales**.

## Abrir el editor

En Windows, hacé doble clic en:

`Abrir-editor-manual.bat`

Se abre un servidor exclusivamente en `127.0.0.1` y una pestaña del navegador. Cada ejecución usa un token aleatorio; las APIs de escritura no funcionan sin ese token.

Si Windows no encuentra `py`, el script intenta usar `python`.

## Productos

El formulario permite:

- elegir una tienda existente o una creada manualmente;
- precio actual y precio anterior;
- marcar oferta;
- ocultar temporalmente una publicación sin borrarla;
- indicar la fuente: manual, Instagram, Facebook, WhatsApp o sitio web;
- guardar el enlace exacto de la publicación;
- usar una imagen por URL o subir una imagen local;
- editar, duplicar y eliminar publicaciones.

Cuando `Origen = Visto en Instagram`, la tarjeta pública muestra una etiqueta **Visto en Instagram** con enlace a la fuente.

## Tiendas

Podés crear free shops nuevos o seleccionar una tienda existente y definir una sobrescritura manual de sus datos. El color configurado se usa en las etiquetas y en los filtros avanzados.

Las tiendas manuales aparecen en los filtros avanzados incluso antes de tener una publicación.

## Importar y exportar

El editor acepta:

- respaldo JSON del propio editor;
- un array JSON de productos;
- CSV de productos. Encabezados útiles: `tienda,nombre,precio_usd,precio_original_usd,categoria,url,imagen,fuente_tipo,fuente_url,activo,en_oferta`.

La opción **Paquete listo para GitHub** descarga un ZIP con los dos JSON manuales y las imágenes locales usadas. El ZIP conserva las rutas del repositorio.

Como el editor ya escribe dentro de tu copia local del repositorio, normalmente alcanza con:

```bash
git status
git add .
git commit -m "Actualizar catalogo manual"
git pull --rebase origin main
git push origin main
```

## Seguridad y respaldos

- El servidor escucha solo en `127.0.0.1`.
- Las llamadas de escritura exigen un token de sesión.
- Las imágenes se limitan a JPG, PNG, WEBP o GIF, máximo 6 MB.
- Las escrituras JSON son atómicas.
- Antes de editar o borrar se crea un respaldo en `.manual-backups/`.
- Se conservan los 30 respaldos locales más recientes; esa carpeta está ignorada por Git.
