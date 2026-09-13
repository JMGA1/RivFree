# Mejoras aplicadas

## Identidad RivFree y rendimiento de búsqueda

- Nueva cabecera con la identidad visual **RivFree** y una paleta propia.
- Aviso superior descartable sobre la disponibilidad real en tiendas físicas.
- La búsqueda se ejecuta únicamente al presionar Enter o el botón **Buscar**.
- Indicador visual mientras se procesa la búsqueda.
- Renderizado en bloques de 96 productos con el botón **Mostrar más productos**.
- El usuario puede escribir el texto completo sin reconstruir miles de tarjetas
  en cada pulsación.

## Interfaz

- Diseño móvil optimizado: las tarjetas pasan a un formato horizontal y los
  controles ocupan una sola columna en pantallas pequeñas.
- Botón para limpiar todos los filtros.
- Categorías equivalentes en español y portugués aparecen unificadas con un
  nombre legible.
- Búsqueda sin diferencias por mayúsculas ni tildes.
- Aviso visual cuando los datos tienen más de 48 horas.
- Foco visible para navegar con teclado y mensajes de resultados anunciables.
- Los productos equivalentes se agrupan en una única tarjeta. Al seleccionar
  **Comparar precios**, se abre un detalle con las tiendas ordenadas de menor
  a mayor y enlaces directos a cada publicación original.

## Correcciones

- La comparación normaliza orden de palabras, tildes, unidades y expresiones
  equivalentes como «Eau de Parfum»/«EDP». En categorías sensibles no agrupa
  artículos sin medida o modelo, evitando comparar variantes distintas.
- Los datos cargados desde los scrapers se validan antes de crear las tarjetas.
- Los enlaces e imágenes solo aceptan direcciones HTTP o HTTPS.
- El formato de precios acepta convenciones latinas y estadounidenses.

## Actualización automática

- Las dependencias están declaradas en `requirements.txt`.
- Si una tienda falla o devuelve cero productos, se conservan sus últimos
  datos válidos y el error queda registrado en el resumen.
- Se agregaron pruebas para los distintos formatos de precios.
- Se reactivaron Barão, Neutral, Oprha y Yury's en `run_all.py`; antes solo se
  ejecutaban DFA y Sineriz aunque los otros scrapers estaban en el proyecto.
- Se restauraron las utilidades que necesitaban los scrapers Wix y Neutral.
- La automatización instala Chromium y guarda los JSON individuales.
- Sineriz dejó de repetir una página inexistente quince veces y ahora carga el
  catálogo dinámico mediante el navegador automatizado.

## Segunda revisión

- Modo oscuro con preferencia guardada en el navegador.
- El título de la página funciona como enlace para volver al inicio y recargar.
- Todas las tiendas de un producto agrupado aparecen como etiquetas clicables.
- Se agregó una ficha de tienda con dirección, horario, contacto y enlaces.
- Los precios inexistentes o iguales a cero se muestran como no disponibles y
  siempre se ordenan al final.
- Barão y Yury's ahora extraen la tarjeta Wix completa, no solamente el enlace
  de texto. Esto recupera correctamente nombre, precio, enlace e imagen.
- Los botones «Ver mais» se pulsan hasta que no aparezcan productos nuevos; ya
  no se simulan páginas mediante `?page=N`.
- Se corrigió el enlace real de Chocolates de Barão (`copia-de-condimentos`).
- Sineriz descarta textos genéricos como «Nenhuma foto disponível» y reúne los
  distintos enlaces de una misma tarjeta antes de guardar el producto.
- Si se detiene el proceso con `Ctrl+C`, el catálogo se reconstruye con los
  archivos individuales disponibles.
- `run_all.py --store nombre` permite actualizar una sola tienda sin borrar
  los datos guardados de las demás.
