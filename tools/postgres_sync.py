"""Copy the RivFree catalog into PostgreSQL: stores, offers and the history of price changes.

Works with any PostgreSQL 12+ (free options: Neon, Aiven or PostgreSQL on your own computer).
The public site keeps reading the published files; the database is never reached from the browser,
so its password stays private (in Studio on your computer, or in a GitHub secret).

Usage:
  python tools/postgres_sync.py            # copy the catalog (uses DATABASE_URL or the connection saved by Studio)
  python tools/postgres_sync.py --check    # only test the connection and show what the database has
Requires the pure-Python driver pg8000: pip install --require-hashes -r requirements-db.txt
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import socket
import ssl
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import parse_qs, quote, unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
SCHEMA_PATH = ROOT / "postgres" / "schema.sql"
LOCAL_DIR_NAME = ".rivfree-local"  # never published: ignored by git and not served by Studio
SSL_MODES = {"disable", "allow", "prefer", "require", "verify-ca", "verify-full"}
LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1"}
BATCH = 4000


class DatabaseProblem(ValueError):
    """An error with a message the person can act on (shown in Studio and in GitHub)."""


# ── Connection string ───────────────────────────────────────────────────────
def parse_database_url(url: str) -> dict:
    url = (url or "").strip()
    if not url:
        raise DatabaseProblem("Pegá la dirección de conexión de tu base (empieza con postgresql://).")
    if any(ord(c) < 32 for c in url):
        raise DatabaseProblem("La dirección de conexión tiene caracteres inválidos.")
    parts = urlsplit(url)
    if parts.scheme not in ("postgres", "postgresql"):
        raise DatabaseProblem("La dirección tiene que empezar con postgresql:// (copiala del panel de tu base).")
    if not parts.hostname:
        raise DatabaseProblem("Falta el servidor en la dirección de conexión.")
    try:
        port = parts.port or 5432
    except ValueError:
        raise DatabaseProblem("El puerto de la dirección de conexión no es válido.") from None
    user = unquote(parts.username or "")
    if not user:
        raise DatabaseProblem("Falta el usuario en la dirección de conexión.")
    query = {key: values[-1] for key, values in parse_qs(parts.query).items()}
    host = parts.hostname
    sslmode = query.get("sslmode") or ("disable" if host in LOCAL_HOSTS else "require")
    if sslmode not in SSL_MODES:
        raise DatabaseProblem(f"sslmode «{sslmode}» no es válido. Usá require o verify-full.")
    # A database on the internet is always reached encrypted: the password must never travel in clear text.
    if host not in LOCAL_HOSTS and sslmode in ("disable", "allow", "prefer"):
        raise DatabaseProblem("Para una base en internet la conexión tiene que ser cifrada: usá sslmode=require (la dirección que da tu proveedor ya lo trae).")
    return {
        "host": host, "port": port, "user": user,
        "password": unquote(parts.password) if parts.password is not None else None,
        "database": unquote(parts.path.lstrip("/")) or user,
        "sslmode": sslmode, "sslrootcert": query.get("sslrootcert"),
        "options": query.get("options"),
    }


def mask_url(url: str) -> str:
    """The connection without its password, safe to show on screen."""
    try:
        info = parse_database_url(url)
    except DatabaseProblem:
        return ""
    host = f"[{info['host']}]" if ":" in info["host"] else info["host"]
    secret = ":••••••" if info["password"] else ""
    return f"postgresql://{quote(info['user'], safe='')}{secret}@{host}:{info['port']}/{quote(info['database'], safe='')}?sslmode={info['sslmode']}"


def ssl_context(info: dict):
    """pg8000: False = no SSL, None = try SSL and fall back (local prefer/allow only), a context = SSL required.

    Unlike libpq, "require" also checks the server certificate and its name: without that check anyone on the
    network path (public Wi-Fi, a hostile router) could pose as the database and read the password.
    Providers with their own certificate authority (e.g. Aiven) add &sslrootcert=<path to ca.pem>."""
    mode = info["sslmode"]
    if mode == "disable":
        return False
    if mode in ("prefer", "allow"):
        return None
    cafile = info.get("sslrootcert") or None
    # GitHub Actions can't read the ca.pem path saved on your computer: the workflow writes the
    # DATABASE_CA_CERT secret to a file and passes it in PGSSLROOTCERT.
    if (not cafile or not Path(cafile).is_file()) and os.environ.get("PGSSLROOTCERT"):
        cafile = os.environ["PGSSLROOTCERT"]
    if cafile and not Path(cafile).is_file():
        raise DatabaseProblem(f"No encontré el certificado {cafile}. Revisá la ruta que pusiste en &sslrootcert= (con barras /).")
    context = ssl.create_default_context(cafile=cafile)
    context.check_hostname = mode != "verify-ca"
    return context


def driver():
    try:
        import pg8000.native  # noqa: F401
    except ImportError:
        raise DatabaseProblem("Falta el conector de PostgreSQL. Cerrá Studio, ejecutá Instalar-dependencias-Studio y volvé a abrirlo.") from None
    return sys.modules["pg8000.native"]


def explain(error: Exception) -> DatabaseProblem:
    if isinstance(error, DatabaseProblem):
        return error
    details = error.args[0] if error.args and isinstance(error.args[0], dict) else {}
    code, message = details.get("C", ""), details.get("M", "") or str(error)
    known = {
        "28P01": "Usuario o contraseña incorrectos.",
        "28000": "El servidor no aceptó este usuario. Revisá la dirección de conexión.",
        "3D000": "Esa base de datos no existe en el servidor.",
        "42501": "El usuario no tiene permisos suficientes (crear tablas y escribir). Usá el usuario dueño de la base.",
        "53300": "El servidor tiene demasiadas conexiones abiertas. Probá de nuevo en un minuto.",
        "57P03": "La base se está iniciando. Probá de nuevo en unos segundos.",
    }
    if code in known:
        return DatabaseProblem(known[code])
    text = message.lower()
    if isinstance(error, ssl.SSLCertVerificationError) or "certificate verify failed" in text:
        return DatabaseProblem("No se pudo verificar el certificado del servidor. Si usás Aiven, descargá su «CA certificate» y agregá "
                               "&sslrootcert=C:/ruta/ca.pem al final de la dirección. Con Neon no hace falta.")
    if isinstance(error, ssl.SSLError) or "ssl" in text or "certificate" in text:
        return DatabaseProblem("Falló la conexión segura (SSL). Usá la dirección que da tu proveedor, con sslmode=require.")
    if isinstance(error, (socket.timeout, TimeoutError)) or "timed out" in text:
        return DatabaseProblem("El servidor no respondió a tiempo. Revisá la dirección o tu conexión a internet.")
    if isinstance(error, (socket.gaierror, ConnectionError, OSError)) or "can't create a connection" in text or "connection" in text:
        return DatabaseProblem("No se pudo conectar con el servidor. Revisá la dirección de conexión y tu conexión a internet.")
    return DatabaseProblem(f"PostgreSQL respondió: {message[:300]}")


def connect(url: str, timeout: int = 30):
    native = driver()
    info = parse_database_url(url)
    params = {"user": info["user"], "host": info["host"], "port": info["port"], "database": info["database"],
              "password": info["password"], "timeout": timeout, "application_name": "RivFree"}
    if info["options"]:
        params["startup_params"] = {"options": info["options"]}  # e.g. Neon "endpoint=..." for old clients
    try:
        return native.Connection(ssl_context=ssl_context(info), **params)
    except Exception as error:
        raise explain(error) from None


# ── Saved connection (Studio, on this computer only) ───────────────────────
def local_file(root: Path = ROOT) -> Path:
    return root / LOCAL_DIR_NAME / "database.json"


def load_saved_url(root: Path = ROOT) -> str:
    try:
        value = json.loads(local_file(root).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return ""
    return value.get("url", "") if isinstance(value, dict) else ""


def save_url(url: str, root: Path = ROOT) -> None:
    parse_database_url(url)
    target = local_file(root)
    target.parent.mkdir(mode=0o700, exist_ok=True)
    (target.parent / ".gitignore").write_text("*\n", encoding="utf-8")
    temporary = target.with_suffix(".tmp")
    # Created private from the start (no window where other users of the computer could read the password).
    fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as handle:
        handle.write(json.dumps({"url": url.strip(), "saved_at": now_iso()}, ensure_ascii=False))
    temporary.replace(target)


def forget_url(root: Path = ROOT) -> None:
    try:
        local_file(root).unlink()
    except FileNotFoundError:
        pass


# ── Catalog → rows ──────────────────────────────────────────────────────────
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def identifier(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()[:32]


def number(value):
    return round(float(value), 2) if isinstance(value, (int, float)) and not isinstance(value, bool) and value >= 0 else None


def read_json(path: Path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return default


def apply_corrections(products: list, corrections) -> list:
    """Studio → Catálogo corrections, same rules as the site (catalog.js applyCorrections)."""
    fixes = corrections.get("correcciones") if isinstance(corrections, dict) else None
    if not isinstance(fixes, dict) or not fixes:
        return products
    result = []
    for product in products:
        fix = fixes.get(f"{product.get('tienda')}|{product.get('url')}") if isinstance(product, dict) else None
        if not isinstance(fix, dict):
            result.append(product)
            continue
        if fix.get("oculto") is True:
            continue
        item = dict(product, corregido=True)
        if isinstance(fix.get("nombre"), str) and fix["nombre"].strip():
            item["nombre"] = fix["nombre"].strip()[:300]
        if isinstance(fix.get("categoria"), str) and fix["categoria"]:
            item["categoria"] = fix["categoria"]
        if isinstance(fix.get("imagen"), str) and fix["imagen"]:
            item["imagen"] = fix["imagen"]
        price = fix.get("precio_usd")
        price_ok = price is None or (isinstance(price, (int, float)) and not isinstance(price, bool) and price >= 0)
        if "precio_usd" in fix and price_ok and (fix.get("precio_fijo") is True or fix.get("precio_base") == product.get("precio_usd")):
            old = fix.get("precio_original_usd")
            item["precio_usd"] = price
            item["precio_original_usd"] = old if isinstance(old, (int, float)) and not isinstance(old, bool) and old > 0 else None
            item["en_oferta"] = price is not None and (fix.get("en_oferta") is True or (item["precio_original_usd"] or 0) > price)
        result.append(item)
    return result


def load_catalog(root: Path = ROOT):
    stores = read_json(root / "data" / "stores.json", {})
    manual_stores = read_json(root / "data" / "manual-stores.json", {}).get("tiendas", {})
    stores = {**(stores if isinstance(stores, dict) else {}), **(manual_stores if isinstance(manual_stores, dict) else {})}
    catalog = read_json(root / "data" / "products.json", {})
    products = list(catalog.get("productos", [])) if isinstance(catalog, dict) else []
    products = apply_corrections(products, read_json(root / "data" / "product-corrections.json", {}))
    manual = read_json(root / "data" / "manual-products.json", {}).get("productos", [])
    products += [dict(p, manual=True) for p in manual if isinstance(p, dict) and p.get("activo", True) is not False]
    updated = catalog.get("actualizado") if isinstance(catalog, dict) else None
    return stores, products, updated


def build_rows(stores: dict, products: list):
    store_rows = {name: {"id": name, "name": (info or {}).get("nombre_completo") or name, "profile": info or {},
                         "hide_photos": (info or {}).get("ocultar_fotos") is True}
                  for name, info in stores.items() if isinstance(name, str) and name}
    offers = {}
    for product in products:
        if not isinstance(product, dict):
            continue
        store, url = product.get("tienda"), product.get("url")
        if not isinstance(store, str) or not store:
            continue
        if not (isinstance(url, str) and url.startswith("https://")):
            if not product.get("manual") or not product.get("id"):
                continue
            url = "manual:" + str(product["id"])[:200]
        store_rows.setdefault(store, {"id": store, "name": store, "profile": {}, "hide_photos": False})
        image = product.get("imagen") if isinstance(product.get("imagen"), str) and product["imagen"].startswith(("https://", "assets/")) else None
        first_seen = product.get("primera_deteccion") or product.get("creado")
        offer_id = identifier(store + "|" + url)
        offers[offer_id] = {
            "id": offer_id, "store_id": store, "url": url[:2000], "name": str(product.get("nombre") or "")[:500] or url,
            "category": product.get("categoria") if isinstance(product.get("categoria"), str) else None,
            "brand": product.get("marca") if isinstance(product.get("marca"), str) else None,
            "price_usd": number(product.get("precio_usd")), "old_price_usd": number(product.get("precio_original_usd")),
            "on_sale": product.get("en_oferta") is True, "image": image, "manual": product.get("manual") is True,
            "first_seen": first_seen if isinstance(first_seen, str) and first_seen else None,
        }
    return list(store_rows.values()), list(offers.values())


# ── Database work ───────────────────────────────────────────────────────────
def schema_statements(path: Path = SCHEMA_PATH) -> list:
    lines = [line for line in path.read_text(encoding="utf-8").splitlines() if not line.strip().startswith("--")]
    return [statement.strip() for statement in "\n".join(lines).split(";") if statement.strip()]


def ensure_schema(con) -> None:
    for statement in schema_statements():
        con.run(statement)


INCOMING_COLUMNS = ("id text, store_id text, url text, name text, category text, brand text, price_usd numeric, "
                    "old_price_usd numeric, on_sale boolean, image text, manual boolean, first_seen timestamptz")


def sync(con, root: Path = ROOT, source: str = "studio") -> dict:
    stores, products, updated = load_catalog(root)
    store_rows, offer_rows = build_rows(stores, products)
    if not offer_rows:
        raise DatabaseProblem("El catálogo está vacío: no se copió nada para no borrar lo que ya está en la base.")
    started = now_iso()
    ensure_schema(con)
    con.run("start transaction")
    try:
        con.run("insert into rivfree.stores (id, name, profile, hide_photos, updated_at) "
                "select x.id, x.name, x.profile, x.hide_photos, now() "
                "from jsonb_to_recordset(cast(:rows as jsonb)) as x(id text, name text, profile jsonb, hide_photos boolean) "
                "on conflict (id) do update set name = excluded.name, profile = excluded.profile, "
                "hide_photos = excluded.hide_photos, updated_at = now()",
                rows=json.dumps(store_rows, ensure_ascii=False))
        con.run(f"create temp table rf_incoming ({INCOMING_COLUMNS}, primary key (id)) on commit drop")
        for start in range(0, len(offer_rows), BATCH):
            con.run(f"insert into rf_incoming select * from jsonb_to_recordset(cast(:rows as jsonb)) as x({INCOMING_COLUMNS})",
                    rows=json.dumps(offer_rows[start:start + BATCH], ensure_ascii=False))
        con.run("analyze rf_incoming")
        con.run("create temp table rf_changes on commit drop as "
                "select i.id, o.id is null as is_new, i.price_usd, i.old_price_usd, i.on_sale "
                "from rf_incoming i left join rivfree.offers o on o.id = i.id "
                "where o.id is null or not o.active or o.price_usd is distinct from i.price_usd "
                "or o.old_price_usd is distinct from i.old_price_usd or o.on_sale is distinct from i.on_sale")
        # New offers get their first price in the history too, but only real changes are reported as changes.
        new_offers, changes = con.run("select count(*) filter (where is_new), count(*) filter (where not is_new) from rf_changes")[0]
        con.run("insert into rivfree.offers (id, store_id, url, name, category, brand, price_usd, old_price_usd, on_sale, "
                "image, manual, first_seen, last_seen, active, removed_at) "
                "select id, store_id, url, name, category, brand, price_usd, old_price_usd, on_sale, image, manual, "
                "coalesce(first_seen, cast(:now as timestamptz)), cast(:now as timestamptz), true, null from rf_incoming "
                "on conflict (id) do update set name = excluded.name, category = excluded.category, brand = excluded.brand, "
                "price_usd = excluded.price_usd, old_price_usd = excluded.old_price_usd, on_sale = excluded.on_sale, "
                "image = excluded.image, manual = excluded.manual, "
                "first_seen = coalesce(rivfree.offers.first_seen, excluded.first_seen), "
                "last_seen = excluded.last_seen, active = true, removed_at = null", now=started)
        con.run("insert into rivfree.price_changes (offer_id, changed_at, price_usd, old_price_usd, on_sale) "
                "select id, cast(:now as timestamptz), price_usd, old_price_usd, on_sale from rf_changes", now=started)
        active, missing = con.run("select count(*), count(*) filter (where not exists "
                                  "(select 1 from rf_incoming i where i.id = o.id)) from rivfree.offers o where o.active")[0]
        # Safety: a broken catalog must not switch off most of the database.
        removal_skipped = bool(missing) and missing > 0.6 * active
        removed = 0
        if missing and not removal_skipped:
            con.run("update rivfree.offers o set active = false, removed_at = cast(:now as timestamptz) "
                    "where o.active and not exists (select 1 from rf_incoming i where i.id = o.id)", now=started)
            removed = con.row_count
        con.run("insert into rivfree.sync_runs (started_at, source, catalog_updated, stores, offers, new_offers, price_changes, removed) "
                "values (cast(:started as timestamptz), :source, :updated, :stores, :offers, :new, :changes, :removed)",
                started=started, source=source[:40], updated=updated, stores=len(store_rows), offers=len(offer_rows),
                new=new_offers, changes=changes, removed=removed)
        con.run("commit")
    except Exception:
        try:
            con.run("rollback")
        except Exception:
            pass
        raise
    return {"stores": len(store_rows), "offers": len(offer_rows), "new_offers": new_offers, "price_changes": changes,
            "removed": removed, "removal_skipped": removal_skipped, "finished_at": now_iso()}


def stats(con) -> dict:
    server = con.run("select current_setting('server_version'), current_database(), pg_size_pretty(pg_database_size(current_database()))")[0]
    result = {"server_version": server[0], "database": server[1], "size": server[2], "ready": False}
    if not con.run("select to_regclass('rivfree.offers') is not null")[0][0]:
        return result
    counts = con.run("select (select count(*) from rivfree.stores), (select count(*) from rivfree.offers where active), "
                     "(select count(*) from rivfree.price_changes)")[0]
    last = con.run("select finished_at, source, offers, new_offers, price_changes, removed from rivfree.sync_runs order by id desc limit 1")
    result.update(ready=True, stores=counts[0], active_offers=counts[1], price_changes=counts[2])
    if last:
        finished, source, offers, new, changes, removed = last[0]
        result["last_sync"] = {"finished_at": finished.isoformat() if hasattr(finished, "isoformat") else str(finished),
                               "source": source, "offers": offers, "new_offers": new, "price_changes": changes, "removed": removed}
    return result


def run_with_connection(url: str, work, timeout: int = 30):
    con = connect(url, timeout)
    try:
        return work(con)
    except DatabaseProblem:
        raise
    except Exception as error:
        raise explain(error) from None
    finally:
        try:
            con.close()
        except Exception:
            pass


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Copia el catálogo de RivFree a PostgreSQL.")
    parser.add_argument("--check", action="store_true", help="solo probar la conexión y mostrar qué hay en la base")
    parser.add_argument("--source", default="github" if os.environ.get("GITHUB_ACTIONS") else "terminal")
    args = parser.parse_args(argv)
    url = os.environ.get("DATABASE_URL") or load_saved_url()
    if not url:
        print("No hay base configurada (DATABASE_URL o Studio → Base de datos): no se copió nada.")
        return 0
    try:
        if args.check:
            print(json.dumps(run_with_connection(url, stats), ensure_ascii=False, indent=1, default=str))
            return 0
        summary = run_with_connection(url, lambda con: sync(con, ROOT, args.source), timeout=180)
    except DatabaseProblem as problem:
        print(("::error::" if os.environ.get("GITHUB_ACTIONS") else "") + str(problem), file=sys.stderr)
        return 1
    print(f"PostgreSQL: {summary['offers']} ofertas de {summary['stores']} tiendas · {summary['new_offers']} nuevas · "
          f"{summary['price_changes']} cambios de precio · {summary['removed']} retiradas.")
    if summary["removal_skipped"]:
        print("Aviso: faltaban demasiadas ofertas en el catálogo y no se marcó ninguna como retirada.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
