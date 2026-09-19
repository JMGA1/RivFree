# Mejoras de búsqueda

## Qué cambió

La búsqueda ahora encuentra nombres escritos juntos, separados o con guiones:
`RedBull`, `Red Bull` y `red-bull`. Funciona también cuando la tienda publica el
nombre junto y el usuario lo escribe separado. Se conservan los sinónimos en
español/portugués, las equivalencias de unidades, los filtros y el mecanismo
existente de búsqueda aproximada cuando no hay coincidencias directas.

El problema tenía dos causas: se comparaban palabras sin contemplar espacios
omitidos y el sinónimo de color `red → rojo` alteraba algunas marcas. Ahora se
conserva también una representación del texto original, sin espacios ni signos,
por campo. Esto no cambia las reglas para agrupar productos entre tiendas.

## Cómo aplicar

El ZIP contiene el proyecto completo con los cambios, los datos originales y
las pruebas; no incluye el historial `.git`.

Para actualizar tu repositorio existente, copiar estos archivos del ZIP:

- `catalog.js`
- `app.js`
- `sw.js`
- `tests/search.test.cjs`
- `tests/search-filter.test.cjs`
- `MEJORAS-BUSQUEDA.md` (esta documentación)

Publicar los tres archivos JavaScript juntos mediante tu proceso habitual de
GitHub Pages. La versión de caché del service worker sube a v5. Si una pestaña
abierta conserva la versión anterior, recargarla una vez finalizada la publicación.
No se publicó ningún cambio en tu sitio desde esta entrega.

## Validación

- `node --test tests/*.test.cjs`: 28 pruebas aprobadas.
- Validación de sintaxis de `app.js`, `catalog.js` y `sw.js`.
- Prueba sobre las 34.680 publicaciones del catálogo incluido: las tres variantes
  de Red Bull devuelven las mismas 13 publicaciones (no necesariamente 13 tarjetas,
  porque el sitio agrupa ofertas).
- Prueba del filtro real de la aplicación con un DOM simulado: nombres unidos,
  categoría, tienda, búsqueda parcial, errores de escritura y consultas sin resultados.
- No se ejecutó la suite DOM completa `test:ui`: este entorno no dispone de
  `jsdom` ni `fake-indexeddb`. Tampoco se verificó visualmente en un navegador.

La mejora tolera diferencias de escritura; no interpreta cualquier frase ni
garantiza corregir todos los errores. La aproximación existente sigue actuando
solo cuando no hay resultados directos.

## Ideas para las próximas mejoras (no implementadas)

1. **Autocompletado con datos reales.** Mostrar marcas y productos mientras se
   escribe, junto con el número de ofertas. Facilita descubrir cómo figura un
   producto en el catálogo.
2. **Orden por relevancia.** Priorizar coincidencias en nombre y marca sobre las
   de categoría o tienda; mantener precio ascendente como opción explícita.
3. **Precio por litro, kilo o unidad.** Ayudar a comparar tamaños y packs sin
   mezclarlos como si fueran la misma presentación.
4. **Filtros de variantes.** Tamaño, sabor, concentración de perfume, cantidad del
   pack y modelo. Son especialmente útiles cuando una marca devuelve muchos productos.
5. **Frescura por oferta.** Mostrar cuándo se verificó cada precio y distinguir
   precios antiguos de los recién actualizados, usando la fecha real del scraper.
6. **Mejor recuperación sin resultados.** Sugerir marcas próximas o explicar qué
   filtro está limitando la búsqueda; nunca quitar filtros sin avisar.
7. **Control de calidad del catálogo.** Detectar caídas anormales de publicaciones
   por tienda, precios ausentes y agrupaciones dudosas para revisarlas.

Prioridad sugerida: autocompletado y relevancia, luego comparación por unidad y
frescura por oferta. El proyecto ya incluye favoritos, historial y lista de compras;
conviene aprovecharlos en estas mejoras.
