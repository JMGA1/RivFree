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
