# Colaboraciones de catálogo en RivFree

Esta versión tiene dos modos separados.

## 1. Editor principal

Abrí `Abrir-editor-manual.bat`.

Este modo sigue siendo el editor del administrador. Guarda en:

- `data/manual-products.json`
- `data/manual-stores.json`
- `assets/manual/`

Además incluye la pestaña **Colaboraciones**, donde podés revisar los ZIP enviados por otras personas antes de importarlos.

## 2. Cargador colaborador

La persona que te ayuda abre `Abrir-colaborador.bat`.

Lo que agregue se guarda únicamente en `.contributor-work/` de su copia local. No modifica el catálogo manual oficial, no necesita GitHub y no necesita tus credenciales.

Puede:

- usar tiendas existentes como referencia;
- crear tiendas nuevas;
- agregar, editar, duplicar y borrar productos de su aporte;
- cargar imágenes desde su computadora;
- marcar el origen como Instagram, Facebook, WhatsApp, web o manual;
- exportar únicamente su aporte.

En **Enviar aporte** escribe su nombre y descarga un archivo como:

`rivfree-aporte-pedro.zip`

Ese es el único archivo que tiene que enviarte.

## 3. Recibir un aporte

En tu copia principal:

1. Abrí `Abrir-editor-manual.bat`.
2. Entrá a **Colaboraciones**.
3. Seleccioná el ZIP recibido.
4. Pulsá **Revisar paquete**.
5. RivFree marca tiendas nuevas, productos nuevos y posibles duplicados.
6. Los posibles duplicados quedan desmarcados por defecto.
7. Elegí qué querés incorporar y pulsá **Importar seleccionados**.
8. Si hace falta, editá los productos importados desde la pestaña Productos.
9. Hacé tu commit y push normalmente.

Las imágenes incluidas en el aporte se copian a `assets/manual/` solamente cuando importás el producto correspondiente.

## Seguridad

- El editor y el cargador escuchan solo en `127.0.0.1`.
- Cada ejecución usa un token de sesión.
- Los ZIP se validan antes de importarse.
- Se bloquean rutas ZIP con `..` o rutas absolutas.
- No se permite que un aporte sobrescriba silenciosamente una publicación manual existente por ID.
- Antes de importar se crea el mismo respaldo local utilizado por el editor manual.
