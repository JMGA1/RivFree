# SEO de RivFree: publicar y verificar

## Publicación inicial

1. Copiá el contenido de esta carpeta sobre tu proyecto local (los archivos van junto a index.html, no dentro de otra subcarpeta).
2. Revisá los cambios con `git status`. Si GitHub recibió actualizaciones de precios, integrá los cambios remotos antes de subir; no uses push forzado.
3. Hacé commit y push a main. En GitHub > Settings > Pages, la fuente debe ser **GitHub Actions**.
4. Esperá que termine **Actualizar precios y publicar RivFree**. También podés ejecutarlo manualmente con actualizar_precios=false.
5. Abrí https://jmga1.github.io/RivFree/pt/ y https://jmga1.github.io/RivFree/sitemap.xml.

Las páginas SEO se generan en `_site` durante cada publicación, después de preparar los datos. No es necesario guardar decenas de miles de HTML en Git. El catálogo interactivo sigue en el inicio. Sus enlaces al catálogo HTML permiten descubrir categorías, tiendas y productos sin JavaScript. Los listados tienen paginación con enlaces HTML; PT y ES tienen URLs y hreflang recíprocos.

## Google Search Console: acción necesaria en tu cuenta

1. Entrá a https://search.google.com/search-console/.
2. Agregá una propiedad **Prefijo de URL**: `https://jmga1.github.io/RivFree/`.
3. Elegí verificación por etiqueta HTML. Copiá únicamente el valor de `content` que te da Google.
4. En `seo-config.json`, pegalo en `google_site_verification`. Ejemplo:

```json
{
  "site_url": "https://jmga1.github.io/RivFree/",
  "google_site_verification": "EL_CODIGO_QUE_TE_DA_GOOGLE",
  "page_size": 60
}
```

5. Publicá ese cambio; después hacé clic en Verificar. No borres el código.
6. En Sitemaps, enviá `https://jmga1.github.io/RivFree/sitemap.xml`. Es un índice que referencia automáticamente los sitemaps parciales.
7. Inspeccioná el inicio y una ficha de producto con “Probar URL publicada”; comprobá el contenido y solicitá indexación de las páginas principales. No hace falta solicitar manualmente cada producto.
8. Revisá el informe de indexación. La generación técnica no garantiza que Google indexe todas las páginas ni una posición concreta. Google puede necesitar días o semanas; contenido, utilidad y calidad también influyen.

El robots.txt servido dentro de /RivFree/ no es el robots.txt de la raíz del host. En GitHub Pages enviá el sitemap directamente en Search Console. No bloquees los JS ni los JSON que necesita el catálogo. No necesitás Analytics para indexar.

## Si comprás www.rivfree.com

No se ha activado ni comprado ese dominio. No cambies la configuración mientras siga sin estar bajo tu control y configurado.

1. Comprá el dominio y verificá su propiedad en GitHub siguiendo su documentación actual.
2. En el DNS del proveedor, configurá el CNAME de `www` apuntando a `jmga1.github.io` (sin https ni /RivFree/). Para que funcione también rivfree.com sin www, seguí las instrucciones vigentes de GitHub para el dominio raíz; no pongas un CNAME común en el apex sin soporte del proveedor.
3. Configurá `www.rivfree.com` en GitHub > repositorio > Settings > Pages > Custom domain. Esperá la comprobación DNS y activá Enforce HTTPS cuando esté disponible. Este despliegue usa Actions: un archivo CNAME en el ZIP por sí solo no configura el dominio.
4. Cambiá `site_url` a `https://www.rivfree.com/` en seo-config.json (sin /RivFree/). Usá el código de verificación de la nueva propiedad si corresponde.
5. Publicá nuevamente. Se regenerarán canónicas, enlaces de las páginas SEO, imágenes sociales, robots.txt y sitemaps con el nuevo dominio. Los recursos del inicio usan rutas relativas.
6. Comprobá HTTPS, imágenes, catálogo, páginas PT/ES y sitemap. Verificá que las URLs antiguas redirijan a sus equivalentes y no terminen en 404, especialmente las fichas y categorías. Una etiqueta canonical no reemplaza una redirección.
7. Agregá/verificá la nueva propiedad en Search Console y enviá `https://www.rivfree.com/sitemap.xml`. Conservá la propiedad anterior para observar la migración. Actualizá enlaces que hayas compartido.

La propiedad anterior /RivFree/ es una propiedad de subruta: la herramienta Cambio de dirección de Search Console puede no admitir ese origen. La migración debe verificarse mediante redirecciones, canónicas y nuevos sitemaps; no dependas de esa herramienta.

Documentación:
- https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site
- https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes
- https://support.google.com/webmasters/answer/9008080
- https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap

## Construcción local y mantenimiento

Requiere Python 3.12 y Node 24, como el workflow. No requiere nuevas dependencias npm.

```sh
python tools/build_public_site.py
node --test tests/seo.test.cjs tests/i18n-coverage.test.cjs tests/catalog.test.cjs tests/matching.test.cjs
```

Para una vista local con la URL configurada, serví `_site` bajo el prefijo `/RivFree/` o usá un proxy local: los enlaces SEO son absolutos hacia la URL pública. Abrir los HTML con file:// no representa el sitio publicado.

- `tools/build_seo.cjs`: genera las páginas y metadatos. Usa el mismo motor de agrupación, categorías, disponibilidad de precios y combinación de productos manuales que el catálogo.
- `seo-config.json`: URL pública, código de verificación y tamaño de paginación.
- `seo.css`: diseño adaptable de las páginas HTML nuevas, con modo oscuro según el sistema.
- `_site/seo-report.json`: cantidad generada de fichas, páginas y sitemaps.
- `_site/sitemap.xml`: índice; cada parte tiene hasta 10.000 URLs.
- Las páginas de producto muestran ofertas y fuentes. Los datos estructurados incluyen precios positivos reales del catálogo; no inventan stock, reseñas ni calificaciones. Las páginas sin precios no anuncian ofertas a cero.
- Se omite lastmod porque la fecha general de una ejecución no demuestra que cada página cambió.
- Las rutas de producto usan un identificador derivado de la clave de agrupación, no del precio ni del título mostrado. Si cambia la agrupación, puede cambiar el identificador; conviene monitorizar bajas en Search Console.
- Las páginas que desaparecen responden con el 404 real del hosting; no se redirige indiscriminadamente al inicio.
- Los HTML SEO se reconstruyen con el catálogo actual en cada despliegue. Las modificaciones manuales aparecen tras guardar y publicar.

## Política de indexación revisada

Solo las fichas con dos o más tiendas distintas con enlaces válidos se incluyen en el sitemap. Las fichas de una sola tienda siguen disponibles y enlazadas desde los listados, pero llevan `noindex,follow`, no aparecen en el sitemap y no emiten datos estructurados Product ni hreflang de indexación. No se bloquean con robots.txt: Google necesita rastrearlas para leer noindex. Esto no elimina inmediatamente URLs ya indexadas ni evita su rastreo.

El catálogo adjunto tiene 748 fichas elegibles por idioma y 33.639 fichas noindex por idioma. Sumando inicios, categorías, tiendas y paginaciones, el sitemap contiene 3.848 URLs en una única parte. Se siguen generando todas las fichas para los usuarios.

Las descripciones incluyen categoría, precio mínimo disponible (o aviso de precio no disponible) y cantidad de tiendas con singular/plural correcto. Estos datos también aparecen en la página.

El inicio portugués está en la raíz y el español en `index-es.html`. Ambos tienen canonical propia, hreflang recíproco PT/ES y x-default hacia la raíz. El selector de idioma navega entre esas URLs conservando filtros; el idioma de cada URL publicada prevalece sobre la preferencia guardada. Los directorios /pt/ y /es/ siguen siendo páginas diferentes de los inicios. El h1 es descriptivo y el favicon es `icons/favicon.svg`. Los atributos aria-label, placeholder y title se traducen al construir el inicio PT.

## Correcciones adicionales

- El idioma de la URL publicada prevalece sobre localStorage también en site-config.js; description y Open Graph conservan el idioma correcto al ejecutar JavaScript.
- privacy.html queda con noindex,follow y fuera del sitemap mientras falten los datos del responsable y contacto. Sigue accesible desde el pie. No se inventaron datos ni se declaró completa la política.
- Cada página de categoría/tienda lleva en la descripción su número de página, rango de productos, total y ejemplos de los productos de esa página. No se generan textos de relleno: el contenido principal sigue siendo el listado real.
- El H1 queda en la primera sección de main, antes del carrusel y el catálogo, también después de aplicar la configuración del Studio.
- El service worker precarga index-es.html y el favicon. Si necesita un fallback para una ruta española, usa el inicio español. Se renovó la versión de caché. El uso offline requiere una visita online previa y la instalación correcta del service worker; no descarga todas las fichas SEO.

## Validación de esta entrega

95 pruebas JavaScript aprobadas y prueba de integración de interfaz aprobada. Pruebas con jsdom verificaron metadatos en PT/ES con preferencia ausente, coincidente y opuesta; también se ejecutaron los scripts del inicio generado y se confirmó el H1 primero y metadatos correctos. Las pruebas offline simulan el service worker y sus respuestas de caché.

Se verificó que privacy.html no figure en el sitemap y lleve noindex, y que las descripciones paginadas difieran. Con el catálogo adjunto el sitemap tiene 3.848 URLs y conserva las 748 fichas de comparación por idioma. No se publicó ni se verificó en Search Console desde este entorno. jsdom verifica el DOM y comportamiento, no el aspecto visual en un navegador real.
