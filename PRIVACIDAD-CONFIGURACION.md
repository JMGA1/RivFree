# Cloudflare Web Analytics

Integrado el fragmento proporcionado por el propietario, una sola vez en index.html y privacy.html. Se retiraron Google Analytics, sus eventos personalizados y el banner de consentimiento de cookies analíticas. analytics.js solo elimina preferencias antiguas y cookies propias de GA accesibles; no descarga proveedores ni registra eventos. Los favoritos y ajustes funcionales se conservan.

Publicar todos los archivos y conservar .git. Service worker actualizado a v21. El alojamiento y los DNS no cambian. Las métricas nuevas aparecen en Cloudflare; los datos históricos de Google no se importan.

Verificación: npm test y npm run test:ui. Se verifican integración, limpieza, política bilingüe e interacciones con DOM simulado. No se confirmó recepción real de métricas: requiere publicar, visitar la página y revisar el panel Cloudflare. Los bloqueadores pueden impedir mediciones.

La política sigue pendiente de nombre legal del responsable y correo de contacto en privacy-config.js, así como confirmar las condiciones y retención del proveedor. No representa certificación legal. Las estadísticas sin cookies no eliminan todas las obligaciones de privacidad.
