# Cómo agrupa RivFree los productos entre tiendas

Archivo: `matching.js` (lo usa `catalog.js` → `groupProducts`).

Cada nombre se convierte en una **ficha**: `core` (marca + línea + variante), `measure` (0,25 LT = 250 ml),
`conc` (EDP/EDT), `gender`, `code` (SKU largo) y `pack`. Dos productos son el mismo si tienen el mismo `core`
y atributos compatibles. Un atributo que falta (p. ej. Sineriz no pone "250 ml") es un **comodín**, pero solo se
une si hay **una única** variante compatible y el precio es coherente (≤2,5×). En perfumes la medida nunca es comodín.

## Cuando dos productos iguales no se unen
    node tools/near-misses.cjs 40
Lista pares casi idénticos que quedaron separados y las palabras que los separan. Según el caso:

| Situación | Dónde se arregla en `matching.js` |
|---|---|
| Palabra que solo describe ("lata", "energizante", "perfume") | `NOISE` |
| Mismo término en otro idioma/escritura ("gim"→"gin", "preto"→"negro", "J. Walker") | `ALIAS` / `normalizeText` |
| Dos productos distintos se unen | quitar la palabra de `NOISE` / `ALIAS`; o agregar sustantivo a `GENERIC` |
| Typos ("Heiniken") | automático (vocabulario del propio catálogo) |

Después de tocar el vocabulario: `npm test` (agregá un caso en `tests/matching.test.cjs`).
