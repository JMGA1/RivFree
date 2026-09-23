# Google Analytics 4 · detección corregida

ID configurado: `G-DQ9ZN0E47C`

## Qué cambió

- La etiqueta `gtag.js` ahora está registrada directamente en `<head>`, por lo que Google Tag Assistant puede detectarla.
- El consentimiento por defecto continúa en `denied`.
- La configuración inicial usa `send_page_view: false`, por lo que RivFree no envía la vista de página antes de que el visitante acepte estadísticas.
- Al pulsar **Permitir estadísticas**, `analytics.js` actualiza `analytics_storage` a `granted` y envía la primera vista de página.
- Microsoft Clarity continúa siendo opcional y no se carga mientras su ID siga como placeholder.
- Service Worker actualizado a `rivfree-shell-v17` para romper caché de la versión anterior.

## Para verificar

1. Subí esta versión a GitHub Pages.
2. Abrí la URL publicada y hacé `Ctrl+F5`.
3. En Google Analytics, volvé a **Probar instalación**.
4. Para comprobar datos reales, aceptá estadísticas en RivFree y revisá **Informes > En tiempo real**.

Google indica que la recopilación puede tardar hasta aproximadamente 30 minutos en comenzar, aunque el informe en tiempo real suele aparecer antes.
