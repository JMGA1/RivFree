# RivFree Studio: publicación, recuperación y mantenimiento

## Instalar en Windows

1. Cerrá el Studio que esté abierto y hacé una copia de tu carpeta actual.
2. Extraé el contenido de la carpeta `RivFree` del ZIP sobre la raíz de tu repositorio existente (donde están `index.html` y `.git`). No crees otra carpeta RivFree adentro. El ZIP no contiene `.git`: conserva tu historial y conexión a GitHub.
3. Abrí `Instalar-dependencias-Studio.bat` una vez para instalar Pillow. Luego abrí `Abrir-RivFree-Studio.bat`.
4. En **Publicar / copias**, marcá **Incluir esta actualización del Studio y del workflow** para la primera publicación. Revisá el resumen y confirmá. Los archivos modificados ajenos al alcance mostrado quedan sin agregar.
5. Esperá que GitHub Actions termine. Un push exitoso todavía no significa que Pages haya terminado de desplegar.

Se necesita Git instalado, una rama con upstream configurado y credenciales funcionando en esa computadora. El Studio informa errores de credenciales, conflictos, commits preparados previamente o rechazo porque GitHub tiene cambios nuevos. No hace force push ni resuelve conflictos automáticamente. Si hay que sincronizar un repositorio divergente, esa reparación todavía se hace con Git/GitHub Desktop.

## Qué incluye

- **Publicar / copias:** revisión del estado completo, diff resumido, rama destino y commits locales pendientes; confirmación y add/commit/push con salida visible. No publica formularios sin guardar. Comprueba que los archivos no cambiaron desde la revisión. Publica también los commits locales pendientes que muestra la revisión.
- **Copias:** lista de hasta 30 guardados. Restaura los JSON presentes en la copia y guarda primero el estado actual. Las imágenes usadas por copias no se eliminan en la limpieza.
- **Duplicados:** aviso al escribir el nombre o cambiar de tienda; reutiliza fingerprints de matching.js y similitud Jaccard, consultando manuales y catálogo automático. No bloquea productos legítimos parecidos ni compara tiendas distintas.
- **Imágenes:** valida el contenido, corrige orientación EXIF, limita a 1600 px, genera WebP y miniatura de 360 px. Mantiene transparencia. Rechaza archivos falsos, más de 6 MB, más de 25 megapíxeles y animaciones. Solo se optimizan subidas nuevas; los archivos existentes no se convierten de forma masiva. La publicación utiliza el WebP principal; la miniatura queda disponible como archivo adicional.
- **Transferencia:** búsqueda y borrado confirmado de imágenes sin referencias en los JSON de datos ni en backups. Vuelve a verificar referencias antes de eliminar.
- **Accesibilidad:** nombres accesibles de controles, grupos de vista previa, foco visible y texto “Activa” para las plantillas; salud ya incluye estados escritos.
- **Historial manual:** cada producto guarda `historial_precios` dentro del mismo JSON, sin una segunda escritura que pueda quedar desincronizada. Agrega fecha/precio cuando cambia el valor; editar otros campos no agrega observaciones. Importaciones y aportes pasan por el mismo registro. Puede verse en Productos. No inventa precios anteriores a esta actualización. Al eliminar un producto, su historial queda en las copias que lo contienen; no es un archivo de auditoría permanente de productos eliminados.
- **Pruebas:** cobertura de guardado de productos/tiendas, renombrado, acciones masivas, subida, importación, aportes, revisiones, restauración, huérfanos, publicación y preservación de configuración durante el scraping.

## Subtítulo anterior: qué se verificó

En el ZIP recibido, `data/site-config.json` tenía cambios locales sin commit. El subtítulo español era “Explorá y compará los free shops de nuestra frontera”, mientras el portugués seguía diciendo “Explore e compare os free shops de Rivera e Santana do Livramento”. Se conservaron ambos textos tal como llegaron: son campos independientes.

El scraper y `publish_data.py` no escriben la configuración visual. Se agregó una prueba que verifica que diseño, carrusel y catálogo manual conservan exactamente sus bytes tras publicar datos de scraping. No se consultó el sitio ni el historial remoto, por lo que no se puede atribuir con certeza el incidente de ayer a una única causa.

Para evitar que un workflow en cola o una corrida larga empaquete código/configuración anteriores, el checkout inicial usa main y el empaquetado final obtiene nuevamente main y crea el sitio a partir de ese árbol actualizado. Los cambios locales deben guardarse y publicarse; el scraping no puede recoger archivos que solo estén en tu computadora.

Revisá el subtítulo en **Diseño → Idioma → Español / Português**, guardá y publicá.

## Alertas opcionales

En GitHub → Settings → Secrets and variables → Actions:

- Slack: secreto `SLACK_WEBHOOK_URL`.
- Discord: secreto `DISCORD_WEBHOOK_URL`.
- Correo: secretos `SMTP_HOST`, `SMTP_PORT` (predeterminado 587), `SMTP_USER`, `SMTP_PASSWORD`, `ALERT_EMAIL_FROM`, `ALERT_EMAIL_TO`. El servidor debe admitir STARTTLS.
- Variables opcionales: `HEALTH_FAILURE_THRESHOLD` y `HEALTH_PARTIAL_THRESHOLD` (3 por defecto).

No se enviaron notificaciones durante la preparación de este ZIP. Sin secretos, el paso solo escribe las alertas en el log. Notifica al terminar cada corrida que supere un umbral, y también una falla global del paso de scraping. Los parciales consecutivos empiezan a contarse con esta versión; no se reconstruye un pasado que health.json no registra. Las incidencias automáticas existentes en GitHub se conservan. Un fallo del proveedor de notificaciones queda visible sin bloquear el despliegue.

## Validación

`python -m unittest discover -s tests -v`

`npm ci && npm test && npm run test:ui`

Los tests de publicación usan un remoto local temporal; no publican en tu GitHub. Las pruebas de scraping usan fixtures/simulaciones, no una descarga completa de todas las tiendas.
