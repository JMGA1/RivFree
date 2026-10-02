# RivFree v8.2 · fotos de cada tienda, logos y ofertas más claras

## Ficha del producto: la foto de cada tienda

- Cada tienda que vende el producto muestra, al lado de su precio:
  - **su propia foto** del producto;
  - **el nombre con que la publica**.

  Así se ve si es la misma presentación, como en las páginas que comparan precios.
- Si una tienda tiene las fotos ocultas (Studio → Tiendas), aparece «Sin foto».
- En el celular la foto es más chica y queda a la izquierda del precio.

## Logos de las tiendas (Studio, opcional)

- En **Studio → Tiendas** hay una sección nueva, **Logo de la tienda (opcional)**:
  - podés subir el logo (mejor PNG con fondo transparente; también HEIC) o pegar un enlace;
  - con **Usar el logo con el nombre en lugar de la etiqueta de color**, esa tienda muestra su logo y su nombre en una etiqueta blanca.
- El logo aparece en:
  - las tarjetas de productos;
  - la ficha del producto;
  - los filtros de tiendas;
  - Mi lista;
  - el mapa;
  - el listado de tiendas;
  - el título de la página de la tienda.
- Mientras no subas un logo y marques la opción, todo sigue como antes, con la etiqueta de color. **No se agregó ningún logo**: queda listo para cuando los subas.

## Ofertas

- **Los botones de descuento (Todas, 20%, 40%, 60%) aparecen solo en Ofertas.** Antes, en el celular, salían también al hacer una búsqueda común.
- **Buscar dentro de las ofertas**:
  - con Ofertas abierto, el buscador dice «Buscar en ofertas…»;
  - los resultados son solo productos en oferta y el título lo indica: «Ofertas: “whisky”»;
  - si el descuento elegido no tiene resultados para esa búsqueda, se muestran todas las ofertas y la página lo avisa, en lugar de quedar vacía.
- **Se nota cuál está elegido**:
  - el botón activo se rellena en rojo («Todas» en azul oscuro), con ✓ y una pequeña animación;
  - los demás quedan con borde;
  - los que no tienen productos se ven apagados;
  - al elegir uno, la página avisa «Ofertas de 40% o más: 416 productos», y la cantidad de resultados dice «· 40% o más».
- **Etiqueta «Ofertas ✕»** junto a la cantidad de resultados: muestra que estás dentro de ofertas y, tocándola, volvés al catálogo completo.

## Verificación

- Pasan:
  - 159 pruebas JavaScript;
  - 175 pruebas Python;
  - la prueba de interfaz.
- Revisado en celular y en computadora, en modo claro y oscuro: ficha del producto con fotos por tienda, etiquetas con logo, Studio → Tiendas → Logo, Ofertas con búsqueda y niveles de descuento.

---

# RivFree v8.1 · fotos de las tiendas y edición de todo el catálogo

## Fotos de las tiendas (también desde el iPhone)

- En **Studio → Tiendas** hay una sección nueva, **Fotos del local**:
  - **+ Subir fotos** acepta varias a la vez: JPG, PNG, WebP o **HEIC del iPhone**, hasta 15 MB cada una;
  - Studio las convierte a WebP livianas y les quita los datos de ubicación (GPS) que guarda el celular;
  - la primera es la **portada**: con **↑ ↓** o **Usar de portada** cambiás el orden;
  - cada foto puede llevar una descripción («Fachada») y una atribución.
- En el sitio:
  - la ficha de la tienda muestra la portada grande, debajo del nombre;
  - la galería «Fotos del local» carga versiones chicas y, al tocar una, se abre en tamaño completo;
  - en **Tiendas**, cada tarjeta lleva la foto de la fachada.
- Las fotos HEIC también sirven para productos y banners.

**Una vez**: ejecutá **Instalar-dependencias-Studio** para sumar el complemento de fotos HEIC (`pillow-heif`). Sin él, Studio te avisa y podés subir la foto en JPG.

## Studio → Catálogo: editar cualquier producto de las tiendas

- Pestaña nueva **Catálogo**:
  - buscás por nombre, marca o enlace;
  - podés filtrar por tienda o ver **Solo los que corregí**;
  - nunca se cargan los 35.000 productos: solo los resultados, hasta 60 por búsqueda.
- Para cada producto podés corregir:
  - **nombre** (también sirve para que el mismo producto se compare entre tiendas);
  - **categoría**;
  - **precio**, **precio anterior** y **oferta**;
  - **foto**: un enlace o una subida desde la computadora, HEIC incluido;
  - **ocultarlo** del sitio.
- Studio muestra lo que publica la tienda («Original de la tienda: …», «Precio de la tienda hoy: USD …») y tiene **Volver a los datos de la tienda**.
- **Precios corregidos**:
  - por defecto, tu precio se usa hasta que la tienda publique otro precio; ahí vuelve automáticamente el de la tienda;
  - con **Mantener mi precio aunque la tienda lo cambie**, queda fijo.
- **Las correcciones no se pierden con la actualización diaria**:
  - se guardan aparte, en `data/product-corrections.json`;
  - las aplican el sitio, las páginas para Google y la copia en PostgreSQL;
  - entran en las copias de seguridad de Studio y se publican con **Publicar**.
- La vista previa en vivo muestra el producto como lo verían los visitantes.

## Archivos

| Archivo | Para qué |
|---|---|
| `tools/manual_editor/catalog-editor.js` | Pestaña Catálogo de Studio |
| `tools/manual_editor/store-photos.js` | Fotos del local en Studio |
| `data/product-corrections.json` | Correcciones a productos de las tiendas |
| `tests/v81-improvements.test.cjs`, `tests/test_studio_v81.py` | Pruebas |

También cambiaron:

- `catalog.js`, `catalog-cache.js` y `catalog-worker.js` (aplican las correcciones);
- `experience.js`, `experience.css` y `store-directory.js` (fotos de la tienda);
- `tools/build_seo.cjs`, `tools/build_public_site.py` y `tools/postgres_sync.py`;
- `tools/manual_editor/requirements.txt` (`pillow-heif`).

## Verificación

- Pasan:
  - 156 pruebas JavaScript;
  - 172 pruebas Python;
  - la prueba de interfaz;
  - la prueba contra un PostgreSQL real.
- Se probó en Studio:
  - subir dos fotos HEIC, guardar la tienda y verlas en la ficha y en el listado de tiendas (celular y computadora);
  - buscar «sauvage dior», corregir nombre y precio, y ver el cambio en el sitio y en las páginas para Google.

---

# RivFree v8 · mejoras de seguridad, búsqueda y Studio

## Sitio

### Búsqueda y resultados

- **Orden «Más relevantes» al buscar.** Primero aparecen los productos cuyo nombre empieza con lo que escribiste, después los que lo contienen. Entre ellos van primero los que están en más tiendas. Sin búsqueda, el orden sigue siendo A-Z.
- **Al buscar, la página baja hasta la barra de resultados** (cantidad y orden), justo debajo del encabezado fijo. Antes, en el celular, la barra quedaba tapada.
- **El título dice qué estás viendo**:
  - «Resultados para “perfume dior”»;
  - «Ofertas»;
  - «Ofertas de Barão Free Shop»;
  - «Tus favoritos».
- **Las cantidades llevan siempre punto de miles**: «4.665 productos», igual que «34.497».
- **Textos más cortos en los filtros**:
  - «Solo con precio» (antes: «Ocultar productos sin precio»);
  - «Buscá una categoría».
- **«Más buscados» solo aparece cuando hay datos reales.** Ya no repite una selección al azar, que era lo mismo que «Por descubrir».

### Celular

- El botón **«Mostrar más productos»** ya no queda debajo de las tarjetas.
- Los **cuatro niveles de descuento** (Todas, 20%+, 40%+, 60%+) entran en una sola fila, sin desplazarse de costado.
- El **♡ de las tarjetas** mide 40 px, más fácil de tocar.
- Las **etiquetas de tienda** se leen mejor: pasaron de 9,5 a 10,5 px.
- El cuadro **«i» de la barra de resultados** ya no se sale de la pantalla.

### Ficha de producto

- Debajo del nombre se ve el resumen: «Desde USD 99.90 en Barão Free Shop · 2 tiendas».
- Cada tienda que no es la más barata muestra cuánto más cobra: «USD 20.10 más que el mejor precio (+20%)».

### Tiendas

- La ficha de cada tienda tiene dos botones:
  - **Ver sus 4.858 productos**;
  - **Ver ofertas (602)**.

  Los dos abren los resultados filtrados por esa tienda. Con «Atrás» volvés a la ficha.

### Tarjetas

- Los productos que están en **varias tiendas también tienen ♡**. Antes solo lo tenían los de una tienda.
- Lectores de pantalla: el ♡ dice «Guardar en Mi lista» o «Quitar de Mi lista», sin estrellas.
- «Ver en DFA ↗» aparece traducido en portugués.

### Mi lista

- **Lista vacía**: tiene botones para **Ver ofertas** y **Buscar productos**. El botón «Compartir lista» se oculta hasta que haya algo para compartir.
- Debajo de cada tilde dice **«Comprado»**.

## Seguridad

- **Las notas internas y el nombre de quien aportó un producto ya no se publican.**
  - Quedan solo en tu computadora, en `.rivfree-local/product-notes.json`. Esa carpeta no se sube a GitHub.
  - Studio las sigue mostrando.
  - Si ya tenías notas en el catálogo, salen solas del archivo público la próxima vez que guardes cualquier producto.
- **El sitio publicado no incluye los productos ocultos**, ni siquiera dentro de los archivos de datos.
- **Las páginas SEO y los documentos legales** (privacidad, cookies, términos) tienen la misma política de seguridad de contenido (CSP) que la tienda. Los enlaces a tiendas en las páginas SEO son solo `https`.
- **Copia en PostgreSQL**:
  - la conexión siempre comprueba el certificado del servidor;
  - el archivo con la dirección se guarda con permisos solo para tu usuario.

  Si usás Aiven, mirá los pasos nuevos en `POSTGRESQL-LEEME.md`: el `ca.pem` y el secreto `DATABASE_CA_CERT` en GitHub.
- **Aportes de colaboradores**:
  - Studio muestra a qué sitio lleva cada enlace;
  - marca «Revisar enlace» cuando un producto apunta a un sitio distinto al de la tienda;
  - esos productos no quedan seleccionados para importar.
- **Emails de tiendas**: Studio solo acepta una dirección simple. El sitio no crea un enlace de correo con datos extra (como `?bcc=`).
- **Colores de banners**: solo se aplican colores `#rrggbb`.
- **Listas compartidas con enlaces viejos**: solo se agregan productos que existen en el catálogo.
- **Vista local con base de datos** (`database/serve.py`):
  - responde solo a su propia dirección;
  - no lista carpetas.

## Studio

- **Publicar**:
  - antes de subir, Studio trae los cambios nuevos de GitHub (por ejemplo, los precios del robot) y los combina;
  - ya no aparece el error «fetch first»;
  - si los mismos archivos chocan, no publica nada y te lo explica.
- **Precios**:
  - se pueden escribir con coma: `29,90`, `1.299,90` o `USD 29,90`;
  - si el precio cambia más de 50%, Studio pregunta antes de guardar, porque suele ser un número de más o de menos;
  - si marcás «oferta», el precio anterior tiene que ser mayor que el actual.
- **Selección múltiple de productos**:
  - nuevo botón **Mostrar**;
  - **Ocultar** pide confirmación;
  - «Cambiar categoría» ofrece todas las categorías.
- **Descartar cambios** (Diseño, Página, Carrusel, banner y borrador recuperado) pide confirmación.
- **Copias de seguridad** con fecha legible: «1 oct 2026, 23:08:22 · Productos, Tiendas».
- **Formularios largos**: los botones **Guardar** quedan fijos abajo, siempre a la vista.
- **Horarios**:
  - la semana empieza el lunes;
  - un turno nuevo empieza una hora después del anterior;
  - **Copiar a otros días** copia el horario de un día a los que elijas.
- **WhatsApp de la tienda**:
  - acepta el número tal cual: `+598 99 123 456`, o `099 123 456` para un celular uruguayo;
  - Studio lo convierte en el enlace `wa.me`.
- **Banners nuevos**:
  - dejan vacíos los textos en portugués, así se ve el español hasta que los traduzcas, y no «Novo banner»;
  - el campo «Categoría de destino» sugiere las categorías.
- **Mensajes más claros**:
  - si cerraste la ventana de Studio, si la pestaña quedó de una sesión anterior o si hubo un error interno, Studio dice qué hacer;
  - los errores internos quedan anotados en la ventana de Studio, sin contraseñas;
  - si Studio ya está abierto, al abrirlo otra vez avisa que el puerto está en uso, sin mostrar un error técnico.

## Archivos nuevos

| Archivo | Para qué |
|---|---|
| `tests/v8-improvements.test.cjs` | Pruebas del sitio |
| `tests/test_studio_v8.py` | Pruebas de Studio y del catálogo publicado |
| `CAMBIOS-V8.md` | Este resumen |

## Verificación

- Pasan:
  - 150 pruebas JavaScript;
  - 159 pruebas Python;
  - la prueba de integración de interfaz;
  - la prueba contra un PostgreSQL real con certificado verificado.
- Se revisaron en el navegador:
  - en celular (360 y 390 px): búsqueda, resultados, ofertas, ficha de producto, tienda y Mi lista;
  - en computadora (1366 px): claro y oscuro;
  - Studio (1366 px): productos, horarios, WhatsApp y copias.
