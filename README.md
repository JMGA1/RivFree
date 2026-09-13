# Comparador Frontera 🛃

Compará precios de los freeshops de Rivera en un solo lugar, con filtros por
tienda, categoría, precio y ofertas. Se actualiza solo, una vez por día,
gratis, para siempre (dentro de lo razonable).

El proyecto incluye datos guardados en `data/products.json` y scrapers para
**Barão, DFA, Neutral, Oprha, Sineriz y Yury's**. Conviene probarlos al
publicar: el HTML de una tienda puede cambiar y exigir ajustes en sus selectores.

Cuando el mismo producto y su variante aparecen en varias tiendas, el sitio
los reúne en una tarjeta. El botón **Comparar precios** abre el detalle ordenado
de menor a mayor y cada opción enlaza a su publicación original.

Las etiquetas de las tiendas también son botones: al seleccionarlas muestran
dirección, horario, contacto y enlaces disponibles. El encabezado vuelve al
inicio y el modo oscuro queda guardado para la próxima visita.

---

## Cómo funciona (en criollo)

1. Un robot (GitHub Actions, gratis) visita las webs de los freeshops una vez
   por día y anota nombre + precio de cada producto en un archivo `data/products.json`.
2. Ese archivo se guarda automáticamente en tu repositorio de GitHub.
3. El sitio (`index.html`) lee ese archivo y te deja filtrar y comparar.
4. GitHub Pages (gratis) publica el sitio en una dirección web propia, tipo
   `https://tu-usuario.github.io/freeshop-compare/`

No necesitás contratar ningún hosting ni pagar nada.

---

## Paso a paso para publicarlo (20-30 min la primera vez)

### 1. Creá una cuenta de GitHub
Si no tenés, andá a [github.com](https://github.com) y registrate (es gratis).

### 2. Creá un repositorio nuevo
- Arriba a la derecha, click en el **+** → **New repository**.
- Nombre: `freeshop-compare` (o el que quieras).
- Dejalo en **Public**.
- No marques ninguna opción de "agregar README" (ya tenés uno).
- Click en **Create repository**.

### 3. Subí estos archivos al repositorio
En la página del repositorio recién creado, vas a ver un link que dice
**"uploading an existing file"**. Hacé click ahí y arrastrá **todos** los
archivos y carpetas de esta carpeta (`freeshop-compare/`) manteniendo la
misma estructura:

```
freeshop-compare/
├── index.html
├── data/
│   └── products.json
├── scrapers/
│   ├── utils.py
│   ├── barao_scraper.py
│   ├── dfa_scraper.py
│   ├── neutral_scraper.py
│   ├── oprha_scraper.py
│   ├── sineriz_scraper.py
│   ├── yurys_scraper.py
│   ├── run_all.py
│   └── template_scraper.py
└── .github/
    └── workflows/
        └── scrape.yml
```

> ⚠️ Importante: GitHub a veces no deja arrastrar carpetas vacías o con
> subcarpetas ocultas (`.github`) desde el navegador. Si te da problemas,
> te recomiendo instalar **GitHub Desktop** (github.com/apps/desktop) que
> tiene una interfaz visual — clonás el repo vacío, pegás los archivos en
> la carpeta que te crea, y le das "Commit" + "Push". Es más confiable que
> arrastrar en el navegador para proyectos con varias carpetas.

Hacé "Commit changes" (confirmar cambios) al terminar de subir.

### 4. Activá GitHub Pages (para tener el link público)
- En tu repositorio, andá a **Settings** (configuración) → **Pages** (en el
  menú de la izquierda).
- En "Build and deployment" → "Source", elegí **Deploy from a branch**.
- En "Branch", elegí **main** y la carpeta **/ (root)**.
- Click en **Save**.
- Esperá 1-2 minutos y refrescá la página: te va a aparecer un link tipo
  `https://tu-usuario.github.io/freeshop-compare/`. Ese es tu sitio.

### 5. Activá el robot que actualiza los precios
- Andá a la pestaña **Actions** de tu repositorio.
- Si te pregunta si querés habilitar los workflows, decí que sí ("I understand
  my workflows, go ahead and enable them").
- Vas a ver un workflow llamado **"Actualizar precios"**. Por default corre
  todos los días a las 08:00 UTC (podés cambiar el horario editando el
  archivo `.github/workflows/scrape.yml`, la línea que dice `cron`).
- Para probarlo ya mismo sin esperar al otro día: click en el workflow →
  botón **"Run workflow"** → **Run workflow** de nuevo para confirmar.
- Esperá 1-2 minutos, refrescá, y deberías ver un ✅ verde. Si le das click
  entrás a ver el detalle — ahí te va a decir cuántos productos encontró
  en cada tienda, o si hubo algún error.

Después de correr con éxito, `data/products.json` se actualiza solo en tu
repo, y tu sitio (que lee ese archivo) se actualiza también, sin que hagas
nada.

---

## Si algo no funciona bien (scraping frágil, es normal)

Las webs de los freeshops pueden cambiar de diseño en cualquier momento, y
ahí el scraper de esa tienda en particular puede dejar de encontrar
productos (no rompe nada del resto, solo esa tienda da 0 resultados).

Si eso pasa:
1. Andá a **Actions** → el último run → mirá el log, te va a decir qué
   tienda falló.
2. Revisá el HTML de la categoría que falla y ajustá los selectores del
   scraper correspondiente.

## Agregar más freeshops

1. Pasame el link de la tienda nueva y yo te armo el scraper (lo más rápido).
2. O si querés hacerlo vos: copiá `scrapers/template_scraper.py`, seguí las
   instrucciones que están comentadas adentro, y agregalo a la lista
   `SCRAPERS` en `scrapers/run_all.py`.

## Correrlo en tu compu (opcional, para probar antes de subir)

Si en algún momento querés probarlo localmente en vez de esperar a GitHub
Actions, necesitás Python instalado:

```bash
pip install -r requirements.txt
python -m playwright install chromium
python scrapers/run_all.py
```

Barão, Sineriz y Yury's cargan productos dinámicamente; por eso son más lentos
que un scraper HTTP normal. Podés detener el proceso con `Ctrl+C`: antes de
salir, `run_all.py` reconstruye `products.json` usando los JSON individuales
que ya estén guardados.

Para actualizar una sola tienda y conservar las demás, usá por ejemplo:

```bash
python scrapers/run_all.py --store barao
```

Las opciones disponibles son `barao`, `dfa`, `neutral`, `oprha`, `sineriz` y
`yurys`.

Eso va a generar/actualizar `data/products.json`. Después abrís `index.html`
con doble click para verlo (algunos navegadores bloquean la carga del JSON
local por seguridad — si eso pasa, corré `python -m http.server` en la
carpeta y abrí `http://localhost:8000` en vez de abrir el archivo directo).

## Pruebas rápidas

Para comprobar el manejo de formatos de precios sin visitar las tiendas:

```bash
python -m unittest discover -s tests
```

Si una tienda falla durante la actualización, el proceso conserva sus últimos
productos válidos en vez de vaciarla del catálogo. El log de Actions indicará
cuándo se están usando esos datos anteriores.

Los productos sin un precio público se conservan con `precio_usd: null`. En la
web aparecen como **Precio no disponible** y se ordenan después de los productos
que sí tienen precio.
