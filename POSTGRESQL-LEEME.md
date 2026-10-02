# PostgreSQL en RivFree

## ¿Se puede gratis?

Sí. RivFree guarda en tu base PostgreSQL:

- las tiendas;
- todas las ofertas;
- un historial con cada cambio de precio.

La copia la hacen dos lugares:

- **Studio**, en tu computadora, cuando tocás **Copiar ahora**.
- **GitHub**, todos los días, después de actualizar los precios.

El sitio público sigue en GitHub Pages, igual que ahora. El navegador de los visitantes no se conecta a la base. Para conectarse necesitaría la contraseña, y cualquiera podría verla.

> Con la clave de Supabase el sitio podía contar las visitas de los visitantes. PostgreSQL solo no puede hacer eso sin un servidor en el medio, así que **Más consultados** vuelve a armarse con lo que mira cada visitante en su propio navegador.

## Paso 1 · Crear la base (elegí una opción)

| Opción | Gratis | Para tener en cuenta |
|---|---|---|
| **Neon** (recomendada) | 0,5 GB y 100 horas de cómputo por mes, por proyecto | Se duerme a los 5 minutos sin uso y se despierta sola en la siguiente conexión |
| **Aiven** | 1 GB, sin tarjeta | Puede apagar servicios gratis que no tienen actividad, con aviso previo |
| **Tu computadora** | Sin límite | Copia solo desde Studio: GitHub no llega a tu computadora, así que no hay copia diaria |

RivFree ocupa unos 40 MB la primera vez. Después crece solo con los cambios de precio, así que entra cómodo en cualquiera de las tres.

### Neon

1. Entrá a [neon.com](https://neon.com) y creá una cuenta. Podés entrar con tu cuenta de GitHub.
2. **Create project**. Nombre: `rivfree`. Región: **AWS South America (São Paulo)**, la más cercana a Rivera.
3. En el panel del proyecto tocá **Connect** y copiá la dirección. Empieza con `postgresql://` y termina con `sslmode=require`.

### Aiven

1. Entrá a [aiven.io](https://aiven.io), creá una cuenta y tocá **Create service** → **PostgreSQL** → plan **Free**.
2. Esperá a que diga **Running**.
3. En **Overview** copiá el **Service URI**.
4. En la misma pantalla descargá el **CA certificate** (`ca.pem`) y guardalo, por ejemplo en `C:\RivFree-db\ca.pem`.
5. Agregá al final de la dirección `&sslrootcert=C:/RivFree-db/ca.pem`, con barras `/`. Sin ese archivo, RivFree no puede comprobar que el servidor es realmente Aiven y no se conecta.

### En tu computadora

1. Instalá PostgreSQL desde [postgresql.org/download](https://www.postgresql.org/download/). Anotá la contraseña que te pide.
2. Creá una base llamada `rivfree`, por ejemplo con pgAdmin, que viene incluido.
3. Tu dirección es `postgresql://postgres:TU_CONTRASEÑA@localhost:5432/rivfree`.

## Paso 2 · Instalar el conector (una sola vez)

Cerrá Studio y ejecutá:

- **Windows:** `Instalar-dependencias-Studio.bat`
- **Mac o Linux:** `Instalar-dependencias-Studio.sh`

Instala `pg8000`, un conector escrito solo en Python y con licencia libre. Las versiones están fijadas en `requirements-db.txt`.

## Paso 3 · Conectar desde Studio

1. Abrí Studio y andá a la pestaña **Base de datos**.
2. Pegá la dirección y tocá **Guardar y probar**. Tiene que decir «Conexión correcta».
3. Tocá **Copiar ahora**. La primera vez crea las tablas solas. Tarda unos segundos.

La dirección queda guardada solo en tu computadora, en la carpeta `.rivfree-local`. Esa carpeta no se publica ni se sube a GitHub, y Studio nunca muestra la contraseña.

## Paso 4 · Copia automática todos los días

1. En GitHub abrí tu repositorio → **Settings** → **Secrets and variables** → **Actions**.
2. Tocá **New repository secret**.
   - Name: `DATABASE_URL`
   - Secret: la misma dirección del paso 1
3. Solo si usás **Aiven**: creá otro secreto.
   - Name: `DATABASE_CA_CERT`
   - Secret: el contenido completo de `ca.pem`. Abrilo con el Bloc de notas y copiá todo, desde `-----BEGIN CERTIFICATE-----` hasta `-----END CERTIFICATE-----`.

   GitHub no puede leer el archivo de tu computadora: con este secreto comprueba el certificado igual que vos.
4. Listo. Cada actualización diaria de precios (05:15, hora de Uruguay) también copia el catálogo.

Para copiar en el momento, abrí **Actions** → **Actualizar precios y publicar RivFree** → **Run workflow**. El resultado aparece en el paso «Copiar catálogo a PostgreSQL». Si la base falla, el sitio se publica igual.

## Qué queda en la base

Todo va en el esquema `rivfree`, separado de cualquier otra tabla que ya tengas. RivFree nunca borra tablas.

| Tabla o vista | Contenido |
|---|---|
| `rivfree.stores` | Tiendas, con su ficha completa y si tienen las fotos ocultas |
| `rivfree.offers` | Cada producto de cada tienda: precio, precio anterior, oferta, imagen, primera y última vez visto. Si un producto desaparece del catálogo queda con `active = false`, no se borra |
| `rivfree.price_changes` | Una fila cada vez que cambia un precio o aparece un producto nuevo |
| `rivfree.sync_runs` | Cada copia: cuándo, desde dónde y qué cambió |
| `rivfree.current_offers` | Vista con las ofertas activas y el nombre de la tienda |
| `rivfree.price_drops` | Vista con las bajadas de precio y su porcentaje |

## Consultas útiles

En Neon pegalas en **SQL Editor**. En las otras opciones podés usar pgAdmin o DBeaver, que son gratis.

```sql
-- Bajadas de precio recientes
select * from rivfree.price_drops order by changed_at desc limit 50;

-- Ofertas activas por tienda
select store, count(*) as productos, count(*) filter (where on_sale) as en_oferta
from rivfree.current_offers group by store order by productos desc;

-- Historial de un producto
select o.name, c.changed_at, c.price_usd
from rivfree.price_changes c join rivfree.offers o on o.id = c.offer_id
where o.name ilike '%sauvage%' order by c.changed_at;
```

## Seguridad

- La contraseña solo está en tu computadora (`.rivfree-local`) y en el secreto de GitHub. Nunca va al sitio ni al repositorio.
- La conexión siempre va cifrada y RivFree comprueba el certificado del servidor. Así nadie en el medio (por ejemplo, en un Wi-Fi público) puede hacerse pasar por tu base y leer la contraseña.
- Si tu base tiene otros datos, conviene crear un usuario y una base solo para RivFree.
- Si el catálogo llega con menos del 40% de las ofertas, la copia no marca ninguna como retirada. Así un error de los scrapers no vacía la base.

## Problemas frecuentes

| Mensaje | Qué hacer |
|---|---|
| Falta el conector de PostgreSQL | Ejecutá el instalador del paso 2 y volvé a abrir Studio |
| Usuario o contraseña incorrectos | Copiá de nuevo la dirección. En Neon podés cambiar la contraseña desde **Roles** |
| No se pudo conectar con el servidor | Revisá tu internet. Algunas redes bloquean el puerto de PostgreSQL. Probá con otra red |
| Falló la conexión segura (SSL) | Usá la dirección tal como la da tu proveedor, con `sslmode=require` |
| No se pudo verificar el certificado del servidor | Con Aiven, agregá `&sslrootcert=` con la ruta al `ca.pem` (paso 1). Con Neon no hace falta |
| El usuario no tiene permisos suficientes | Usá el usuario dueño de la base, el que crea el proveedor |

## Archivos

| Archivo | Para qué |
|---|---|
| `postgres/schema.sql` | Tablas y vistas. Se aplica solo antes de cada copia |
| `tools/postgres_sync.py` | La copia. Desde una terminal: `python tools/postgres_sync.py` o `--check` |
| `tools/manual_editor/database-panel.js` | La pestaña **Base de datos** de Studio |
| `requirements-db.txt` | El conector `pg8000` con versiones fijadas |
| `.github/workflows/scrape.yml` | El paso «Copiar catálogo a PostgreSQL» de la actualización diaria |
