# Auditoría y correcciones de seguridad — RivFree

Base: `RivFree(4).zip` enviado en esta conversación. Esta entrega modifica esa versión, conserva sus mejoras de rendimiento y navegación y mantiene idénticos los archivos del catálogo, productos manuales, tiendas manuales, configuración y campañas. No se hizo push, no se ejecutó el workflow en GitHub y no se enviaron alertas reales.

## Correcciones implementadas

| Área | Cambio |
| --- | --- |
| Studio / archivos | Lista de rutas públicas; denegación de segmentos ocultos, traversal codificado, barras invertidas y enlaces simbólicos. No hay listados de directorios. `server.py`, `.git`, backups y `health.json` no se sirven como archivos. La salud se consulta mediante la API autenticada. |
| Host y origen | Validación antes del despacho de cualquier método, incluidos GET y HEAD. Solo localhost/127.0.0.1 con el puerto real. Origin debe coincidir exactamente con el origen de la petición; se rechaza Sec-Fetch-Site cross-site. |
| Sesión | Token aleatorio con `secrets.token_urlsafe(32)` y comparación constante con `hmac.compare_digest`. Las APIs aceptan exclusivamente la cabecera. El arranque usa un fragmento URL que no se transmite en HTTP; el cliente lo retira del historial y lo conserva en sessionStorage de la pestaña para recargar. No se guarda en localStorage. |
| Descargas | JSON y ZIP se descargan con fetch autenticado y un Blob; no llevan token en la query. El cliente aún reconoce enlaces de arranque antiguos para migrarlos, pero la API ya no acepta tokens por query. |
| Registros y errores | Token oculto en logs de peticiones; credenciales de URLs y parámetros sensibles redactados en las respuestas JSON, incluida la salida de Git. Los errores internos inesperados no devuelven excepciones crudas. |
| Imágenes de aportes | Upload e importación de ZIP comparten `optimize_image`: decodificación real, límites de tamaño/píxeles, rechazo de animaciones, recodificación WebP y eliminación de metadatos. Una imagen falsa se descarta, no se publica con una extensión engañosa. |
| Colaboradores | Vista previa mediante alias de imágenes, sin exponer la carpeta privada del colaborador. Se conserva la lectura de aportes antiguos al exportar. |
| Importaciones | Las tiendas se construyen con claves permitidas; no se heredan redes desconocidas ni campos arbitrarios del tercero. ZIP con nombres duplicados o enlaces se rechaza. Menor cantidad y vigencia de previsualizaciones retenidas. |
| Configuración | Validación hexadecimal en el cliente, protección de claves de prototipo y escape de URLs CSS. La restauración normaliza configuración, banners, tiendas y productos antes de escribir. |
| XSS en Studio | Tiendas y salud usan nodos y textContent para datos externos. Se corrigió también la fecha del borrador local que se insertaba como HTML. |
| URLs y privacidad | Nuevos enlaces externos requieren HTTPS y rechazan credenciales. El catálogo público aplica también este filtro. Referrer-Policy no-referrer, nosniff en Studio y política de referrer en las páginas; imágenes creadas por los componentes principales tienen referrerPolicy. |
| CSP | Scripts propios y beacon de Cloudflare en público; solo scripts propios en Studio. Bloqueo de objetos, bases y envíos nativos de formularios. Studio agrega frame-ancestors self y SAMEORIGIN por cabecera. Su script inline de arranque pasa a `bootstrap.js`. |
| CI | Jobs independientes de tests, scraping, commit, alertas, construcción y despliegue. Scraping sin permiso de push ni secretos de notificación; commit recibe solo JSON validados y no instala dependencias. Despliegue sin checkout ni ejecución del scraper. |
| Dependencias | Acciones fijadas por SHA verificados contra los repositorios oficiales; requirements con versiones y hashes; instalación binaria con verificación; npm ci sin scripts. Auditorías bloqueantes y Dependabot semanal. Los PR ejecutan tests sin publicar. |
| Alertas | Errores acotados dentro de un bloque de código, menciones neutralizadas y credenciales redactadas. Issues solo para tiendas del inventario de referencia. Notificaciones opcionales aisladas del scraper. |
| Artefacto público | Empaquetado con inventario explícito, sin herramientas, archivos ocultos, enlaces, health ni catalog-first-seen. Los artefactos de scraping no pueden escribir código, configuración manual ni rutas ajenas a los JSON generados. |

## Hallazgos adicionales reparados

- Bypass por HEAD: el manejador heredado también permitía entregar archivos privados.
- Origin de localhost con otro puerto: se aceptaba aunque fuera otro servicio/origen.
- XSS en la fecha del aviso de recuperación de borradores.
- Escritura fuera del proyecto si un archivo temporal JSON o de imagen era un enlace simbólico preparado previamente.
- Claves de prototipo y caracteres especiales en valores CSS de configuración.
- ZIP con nombres duplicados/enlaces y artefactos de CI sin frontera explícita entre datos y código.

## Validación y límites

- 111 pruebas Python y 85 JavaScript aprobadas; integración de interfaz aprobada.
- Pruebas HTTP reales contra un servidor temporal: archivos privados, HEAD, rutas codificadas, Host/Origin, cabeceras, token y límites del cuerpo.
- Pruebas de imágenes falsas, metadatos, importación de tiendas, restauración, symlinks, XSS/estilos y mensajes de issues.
- Validación local del YAML, SHAs, permisos, checkouts y empaquetado público: 319 archivos en la prueba, sin las rutas privadas.
- Resolución de instalación comprobada con `pip install --dry-run --require-hashes --only-binary=:all:`.
- `npm audit`: 38 dependencias, cero vulnerabilidades reportadas. `pip-audit`: 12 dependencias de ejecución, cero vulnerabilidades conocidas reportadas. Los resultados JSON están en `security-reports/`. No equivalen a una garantía de ausencia de vulnerabilidades.
- No se logró descargar Chromium en este entorno. La CSP y la interfaz se verificaron por código, HTTP y pruebas DOM; queda pendiente la comprobación visual en un navegador real y la primera ejecución en GitHub Actions.
- La CSP permite imágenes HTTPS de cualquier origen para conservar banners externos y nuevas tiendas. No se implementó una lista fija de CDN. Sí se restringen scripts y conexiones, y se suprime el referrer. Una lista estricta de imágenes requeriría actualizarla al incorporar cada origen.
- El token se guarda solo en sessionStorage del Studio local para permitir recargas; sigue siendo una credencial sensible. GitHub Pages no recibe ese token.
- La normalización endurecida puede rechazar enlaces HTTP o con credenciales de copias antiguas; deben corregirse a HTTPS. No se modificaron silenciosamente los JSON existentes.
- No se inspeccionó infraestructura remota, la configuración de permisos real del repositorio, ni otros servicios de la máquina. No se ejecutaron scrapers contra las tiendas durante la auditoría.

## Instalar y publicar

1. Cerrá el Studio anterior antes de reemplazar los archivos. Aplicá este ZIP sobre tu checkout habitual conservando `.git` y cualquier edición local posterior al ZIP enviado. El paquete no incluye metadatos Git, backups privados ni el área privada del colaborador.
2. Ejecutá el instalador de dependencias del Studio o `python -m pip install --require-hashes -r tools/manual_editor/requirements.txt`.
3. Abrí el Studio con su lanzador habitual: generará una sesión nueva. Los enlaces de sesiones anteriores no sirven con el servidor nuevo.
4. En Publicar marcá **Incluir esta actualización**. Revisá que se incluyan workflow, archivos requirements, pruebas, scripts de CI y `bootstrap.js`. Luego publicá.
5. Verificá la primera corrida en Actions. En un push normal correrán tests, build y deploy; scraping, commit y alertas correrán cuando corresponda una actualización de precios. En un PR solo se ejecutan los tests.
6. Probá guardar un producto, subir una imagen, descargar un aporte y abrir la vista previa. En el sitio público verificá imágenes y navegación con la nueva CSP.

## Referencias técnicas

- GitHub, Secure use reference: https://docs.github.com/en/actions/reference/security/secure-use
- pip, Secure installs: https://pip.pypa.io/en/stable/topics/secure-installs/
- actions/deploy-pages: https://github.com/actions/deploy-pages
