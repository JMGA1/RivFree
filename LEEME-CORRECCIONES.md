# Instalar las correcciones

1. Extraé el ZIP fuera del proyecto.
2. Copiá el contenido de `RivFree-corregido` en la raíz de RivFree: donde están `index.html`, `scrapers`, `tests` y `.github`. No lo copies dentro de `scrapers`.
3. Sustituí la carpeta `scrapers` completa para quitar las copias anidadas. Conservá tu `.git` local.
4. Subí los cambios a GitHub.
5. Actions → **Actualizar precios y publicar RivFree** → **Run workflow** → activá `actualizar_precios` → elegí `tienda` (`todas` o una tienda individual).

Prueba local desde la raíz:

```sh
python -m pip install -r requirements.txt
python -m playwright install chromium
python -m unittest discover -s tests -v
python scrapers/run_all.py --store dfa
```

Para todas las tiendas: `python scrapers/run_all.py`.

## Qué se corrigió

El adjunto contenía un segundo proyecto dentro de `scrapers`, con mejoras en `scrapers/scrapers`. Actions ejecutaba los archivos viejos. Se consolidó una sola estructura y se trasladaron las pruebas al directorio correcto.

- DFA: reintentos/timeouts ampliados, cuatro descargas concurrentes, tamaño real de página y totales español/inglés. Conserva datos cuando una actualización aceptada es parcial; cobertura fresca inferior al 80 % se rechaza y conserva el catálogo anterior.
- Barão: excluye wishlist, carga adicional/paginación y registro de categorías fallidas.
- Yury: descubre categorías, concurrencia limitada, espera el bloque de precios y conserva datos ante fallos.
- Oprha: descubre categorías y renderiza cada una; lee únicamente precios visibles, no metadatos SEO.
- Mantra: activa concurrencia, reintentos y paginación/carga adicional; extrae el precio del producto principal.
- Neutral: continúa después de páginas fallidas, detecta repeticiones, conserva artículos sin precio y distingue ofertas.
- Siñeriz: reintentos, carga adicional/paginación y protección contra precios de tarjetas vecinas.
- Todas: escritura atómica y protección ante pérdidas grandes de cobertura. Los productos conservados no se publican como observaciones históricas nuevas. Resultados parciales señalados en el resumen.
- Actions permite elegir tienda; conserva el horario diario recibido.

## Validación y límites

Pasaron 27 pruebas locales de precios, paginación, fallos parciales, conservación de datos, interrupción y publicación. También se verificaron sintaxis Python, ayuda CLI y YAML.

No se completó un scraping real: la conexión directa a DFA agotó el tiempo de espera desde este entorno. Las pruebas usan HTML de prueba y simulaciones. La primera ejecución en GitHub Actions debe confirmar los selectores y la cobertura real de cada tienda.

Los JSON incluidos son los recibidos, no precios recién descargados. Una actualización parcial puede conservar artículos retirados hasta una ejecución completa. `OK` significa que no se detectó un fallo con las comprobaciones disponibles; no garantiza cobertura del 100 % ni stock físico.
