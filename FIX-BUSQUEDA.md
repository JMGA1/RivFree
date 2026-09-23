# RivFree — corrección de búsqueda

Cambios incluidos:

- El texto escrito en la búsqueda superior usa color explícito y permanece visible en modo claro y oscuro.
- Se corrigen `-webkit-text-fill-color`, caret, placeholder y autofill para Chrome/Edge.
- Tanto Enter como el botón Buscar ejecutan el mismo submit.
- Después de renderizar, la página hace scroll suave hasta las tarjetas de resultados.
- Si no hay coincidencias, el scroll lleva al mensaje de resultados vacíos.
- Se respeta `prefers-reduced-motion` y se usa scroll sin animación cuando corresponde.
- El service worker sube a `rivfree-shell-v16` y CSS/app usan una versión nueva para evitar caché anterior.
