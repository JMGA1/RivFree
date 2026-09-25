#!/usr/bin/env python3
"""Local-only editor for RivFree manual stores and products.

The server binds to 127.0.0.1 and requires a per-run token for every write/API
request. It never needs third-party Python packages.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import io
import json
import mimetypes
import os
from pathlib import Path
import re
import shutil
import threading
import time
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse
import uuid
import unicodedata
import webbrowser
import zipfile

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = PROJECT_ROOT / "data"
ASSET_DIR = PROJECT_ROOT / "assets" / "manual"
BACKUP_DIR = PROJECT_ROOT / ".manual-backups"
PRODUCTS_PATH = DATA_DIR / "manual-products.json"
STORES_PATH = DATA_DIR / "manual-stores.json"
BASE_STORES_PATH = DATA_DIR / "stores.json"
ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
MAX_IMAGE_BYTES = 6 * 1024 * 1024
MAX_BODY_BYTES = 48 * 1024 * 1024
MAX_CONTRIBUTION_BYTES = 32 * 1024 * 1024
SOURCE_TYPES = {"manual", "instagram", "facebook", "whatsapp", "web", "website"}
LOCK = threading.RLock()
SESSION_TOKEN = uuid.uuid4().hex
EDITOR_MODE = "owner"
CONTRIB_DIR = PROJECT_ROOT / ".contributor-work"
CONTRIB_ASSET_DIR = CONTRIB_DIR / "assets"
CONTRIB_BACKUP_DIR = CONTRIB_DIR / "backups"
CONTRIB_PRODUCTS_PATH = CONTRIB_DIR / "products.json"
CONTRIB_STORES_PATH = CONTRIB_DIR / "stores.json"
CONTRIBUTION_PREVIEWS: dict[str, dict] = {}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def active_products_path() -> Path:
    return CONTRIB_PRODUCTS_PATH if EDITOR_MODE == "contributor" else PRODUCTS_PATH


def active_stores_path() -> Path:
    return CONTRIB_STORES_PATH if EDITOR_MODE == "contributor" else STORES_PATH


def active_asset_dir() -> Path:
    return CONTRIB_ASSET_DIR if EDITOR_MODE == "contributor" else ASSET_DIR


def active_backup_dir() -> Path:
    return CONTRIB_BACKUP_DIR if EDITOR_MODE == "contributor" else BACKUP_DIR


def read_json(path: Path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError, TypeError):
        return default


def atomic_write_json(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    tmp.replace(path)


def ensure_files() -> None:
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    if not PRODUCTS_PATH.exists():
        atomic_write_json(PRODUCTS_PATH, {"version": "initial", "actualizado": None, "productos": []})
    if not STORES_PATH.exists():
        atomic_write_json(STORES_PATH, {"version": "initial", "actualizado": None, "tiendas": {}})
    if EDITOR_MODE == "contributor":
        CONTRIB_ASSET_DIR.mkdir(parents=True, exist_ok=True)
        if not CONTRIB_PRODUCTS_PATH.exists():
            atomic_write_json(CONTRIB_PRODUCTS_PATH, {"version": "initial", "actualizado": None, "productos": []})
        if not CONTRIB_STORES_PATH.exists():
            atomic_write_json(CONTRIB_STORES_PATH, {"version": "initial", "actualizado": None, "tiendas": {}})


def revision() -> str:
    digest = hashlib.sha256()
    for path in (active_products_path(), active_stores_path()):
        try:
            digest.update(path.read_bytes())
        except OSError:
            digest.update(b"missing")
    return digest.hexdigest()[:20]


def new_version(prefix: str) -> str:
    return f"{prefix}-{int(time.time() * 1000)}-{uuid.uuid4().hex[:8]}"


def backup_current() -> None:
    backup_dir = active_backup_dir()
    backup_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S-%f")
    target = backup_dir / stamp
    target.mkdir(parents=True, exist_ok=True)
    for path in (active_products_path(), active_stores_path()):
        if path.exists():
            shutil.copy2(path, target / path.name)
    backups = sorted([p for p in backup_dir.iterdir() if p.is_dir()])
    for old in backups[:-30]:
        shutil.rmtree(old, ignore_errors=True)


def text(value, max_len=500) -> str:
    return str(value or "").strip()[:max_len]


def nullable_text(value, max_len=500):
    value = text(value, max_len)
    return value or None


def safe_url(value, required=False):
    value = text(value, 2000)
    if not value:
        if required:
            raise ValueError("Falta una URL obligatoria")
        return None
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError(f"URL inválida: {value}")
    return value


def safe_image(value):
    value = text(value, 2000).replace("\\", "/")
    if not value:
        return None
    allowed_local = value.startswith("assets/manual/") or (EDITOR_MODE == "contributor" and value.startswith(".contributor-work/assets/"))
    if allowed_local and ".." not in value:
        return value
    return safe_url(value)


def safe_color(value, fallback="#B42335") -> str:
    value = text(value, 20)
    return value if re.fullmatch(r"#[0-9A-Fa-f]{6}", value) else fallback


def number_or_none(value, field_name: str):
    if value in (None, ""):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        raise ValueError(f"{field_name} debe ser un número")
    if number < 0 or number > 1_000_000:
        raise ValueError(f"{field_name} fuera de rango")
    return round(number, 2)


def load_base_stores() -> dict:
    value = read_json(BASE_STORES_PATH, {})
    return value if isinstance(value, dict) else {}


def load_manual_stores() -> dict:
    value = read_json(active_stores_path(), {"version": "initial", "actualizado": None, "tiendas": {}})
    if not isinstance(value, dict):
        value = {}
    value.setdefault("version", "initial")
    value.setdefault("actualizado", None)
    if not isinstance(value.get("tiendas"), dict):
        value["tiendas"] = {}
    return value


def load_manual_products() -> dict:
    value = read_json(active_products_path(), {"version": "initial", "actualizado": None, "productos": []})
    if not isinstance(value, dict):
        value = {}
    value.setdefault("version", "initial")
    value.setdefault("actualizado", None)
    if not isinstance(value.get("productos"), list):
        value["productos"] = []
    return value



def load_reference_stores() -> dict:
    base = load_base_stores()
    if EDITOR_MODE != "contributor":
        return base
    owner_manual = read_json(STORES_PATH, {"tiendas": {}})
    owner_stores = owner_manual.get("tiendas", {}) if isinstance(owner_manual, dict) else {}
    if not isinstance(owner_stores, dict):
        owner_stores = {}
    return {**base, **owner_stores}

def normalize_store(payload: dict, existing: dict | None = None) -> tuple[str, dict]:
    if not isinstance(payload, dict):
        raise ValueError("Tienda inválida")
    name = text(payload.get("nombre") or payload.get("name"), 120)
    if not name:
        raise ValueError("El nombre de la tienda es obligatorio")
    current = dict(existing or {})
    networks = dict(current.get("redes") or {})
    for key in ("instagram", "facebook", "whatsapp", "telegram"):
        raw = payload.get(key)
        if raw is not None:
            url = safe_url(raw)
            if url:
                networks[key] = url
            else:
                networks.pop(key, None)
    info = {
        **current,
        "nombre_completo": text(payload.get("nombre_completo") or name, 180),
        "direccion": nullable_text(payload.get("direccion"), 300),
        "telefono": nullable_text(payload.get("telefono"), 80),
        "email": nullable_text(payload.get("email"), 160),
        "horario": nullable_text(payload.get("horario"), 300),
        "sitio_web": safe_url(payload.get("sitio_web")),
        "redes": networks,
        "nota": nullable_text(payload.get("nota"), 1000),
        "catalogo_online": bool(payload.get("catalogo_online", current.get("catalogo_online", False))),
        "color": safe_color(payload.get("color") or current.get("color") or "#B42335"),
        "color_texto": safe_color(payload.get("color_texto") or current.get("color_texto") or "#FFFFFF", "#FFFFFF"),
        "manual": True,
    }
    return name, info


def normalize_product(payload: dict, existing: dict | None = None, known_stores: set[str] | None = None) -> dict:
    if not isinstance(payload, dict):
        raise ValueError("Producto inválido")
    current = dict(existing or {})
    store = text(payload.get("tienda") or current.get("tienda"), 120)
    name = text(payload.get("nombre") or current.get("nombre"), 300)
    if not store:
        raise ValueError("Seleccioná una tienda")
    if not name:
        raise ValueError("El nombre del producto es obligatorio")
    if known_stores is not None and store not in known_stores:
        raise ValueError(f"La tienda '{store}' no existe. Creala primero.")
    price = number_or_none(payload.get("precio_usd"), "Precio")
    old_price = number_or_none(payload.get("precio_original_usd"), "Precio original")
    source_type = text(payload.get("fuente_tipo") or "manual", 30).lower()
    if source_type not in SOURCE_TYPES:
        source_type = "manual"
    product_id = text(payload.get("id") or current.get("id"), 100)
    if not re.fullmatch(r"manual-[A-Za-z0-9_-]+", product_id or ""):
        product_id = "manual-" + uuid.uuid4().hex
    created = current.get("creado") or now_iso()
    result = {
        **current,
        "id": product_id,
        "tienda": store,
        "nombre": name,
        "precio_usd": price,
        "precio_original_usd": old_price,
        "en_oferta": bool(payload.get("en_oferta")) or (price is not None and old_price is not None and old_price > price),
        "categoria": text(payload.get("categoria") or "otros", 120),
        "url": safe_url(payload.get("url")),
        "imagen": safe_image(payload.get("imagen")),
        "fuente_tipo": source_type,
        "fuente_url": safe_url(payload.get("fuente_url")),
        "nota_manual": nullable_text(payload.get("nota_manual"), 1000),
        "activo": bool(payload.get("activo", True)),
        "manual": True,
        "precio_fuente": "manual",
        "creado": created,
        "actualizado_manual": now_iso(),
    }
    return result


def state_payload() -> dict:
    reference = load_reference_stores()
    manual_stores_doc = load_manual_stores()
    products_doc = load_manual_products()
    return {
        "revision": revision(),
        "mode": EDITOR_MODE,
        "project_root": str(PROJECT_ROOT),
        "base_stores": reference,
        "manual_stores": manual_stores_doc.get("tiendas", {}),
        "stores": {**reference, **manual_stores_doc.get("tiendas", {})},
        "products": products_doc.get("productos", []),
        "updated": {
            "stores": manual_stores_doc.get("actualizado"),
            "products": products_doc.get("actualizado"),
        },
    }


def check_revision(payload: dict) -> None:
    supplied = text(payload.get("revision"), 100)
    if supplied and supplied != revision():
        raise RuntimeError("Los datos cambiaron desde que abriste el editor. Recargá antes de guardar.")


def save_store(payload: dict) -> dict:
    with LOCK:
        check_revision(payload)
        stores_doc = load_manual_stores()
        base = load_reference_stores()
        submitted = payload.get("store") or {}
        raw_name = text(submitted.get("nombre"), 120)
        original_name = text(payload.get("original_name"), 120)
        existing = stores_doc["tiendas"].get(original_name or raw_name) or base.get(original_name or raw_name) or {}
        name, info = normalize_store(submitted, existing)
        backup_current()
        renamed_manual_store = bool(original_name and original_name != name and original_name in stores_doc["tiendas"])
        if renamed_manual_store:
            stores_doc["tiendas"].pop(original_name, None)
        stores_doc["tiendas"][name] = info
        stores_doc["actualizado"] = now_iso()
        stores_doc["version"] = new_version("stores")
        atomic_write_json(active_stores_path(), stores_doc)
        if renamed_manual_store:
            products_doc = load_manual_products()
            changed = False
            for product in products_doc["productos"]:
                if product.get("tienda") == original_name:
                    product["tienda"] = name
                    product["actualizado_manual"] = now_iso()
                    changed = True
            if changed:
                products_doc["actualizado"] = now_iso(); products_doc["version"] = new_version("products")
                atomic_write_json(active_products_path(), products_doc)
        return state_payload()


def delete_store(payload: dict) -> dict:
    with LOCK:
        check_revision(payload)
        name = text(payload.get("name"), 120)
        stores_doc = load_manual_stores()
        if name not in stores_doc["tiendas"]:
            raise ValueError("Solo se pueden borrar tiendas creadas o sobrescritas desde el editor manual")
        products_doc = load_manual_products()
        related = [p for p in products_doc["productos"] if p.get("tienda") == name]
        is_base_store = name in load_reference_stores()
        if related and not is_base_store and not payload.get("delete_products"):
            raise ValueError(f"La tienda tiene {len(related)} publicaciones manuales. Confirmá el borrado de esas publicaciones.")
        backup_current()
        stores_doc["tiendas"].pop(name, None)
        stores_doc["actualizado"] = now_iso(); stores_doc["version"] = new_version("stores")
        if payload.get("delete_products") and not is_base_store:
            products_doc["productos"] = [p for p in products_doc["productos"] if p.get("tienda") != name]
            products_doc["actualizado"] = now_iso(); products_doc["version"] = new_version("products")
            atomic_write_json(active_products_path(), products_doc)
        atomic_write_json(active_stores_path(), stores_doc)
        return state_payload()


def save_product(payload: dict) -> dict:
    with LOCK:
        check_revision(payload)
        products_doc = load_manual_products()
        stores = {**load_reference_stores(), **load_manual_stores()["tiendas"]}
        submitted = payload.get("product") or {}
        product_id = text(submitted.get("id"), 100)
        existing = next((p for p in products_doc["productos"] if p.get("id") == product_id), None)
        product = normalize_product(submitted, existing, set(stores))
        backup_current()
        replaced = False
        for index, item in enumerate(products_doc["productos"]):
            if item.get("id") == product["id"]:
                products_doc["productos"][index] = product; replaced = True; break
        if not replaced:
            products_doc["productos"].append(product)
        products_doc["actualizado"] = now_iso(); products_doc["version"] = new_version("products")
        atomic_write_json(active_products_path(), products_doc)
        result = state_payload()
        result["saved_id"] = product["id"]
        return result


def delete_product(payload: dict) -> dict:
    with LOCK:
        check_revision(payload)
        product_id = text(payload.get("id"), 100)
        products_doc = load_manual_products()
        before = len(products_doc["productos"])
        products_doc["productos"] = [p for p in products_doc["productos"] if p.get("id") != product_id]
        if len(products_doc["productos"]) == before:
            raise ValueError("Publicación no encontrada")
        backup_current()
        products_doc["actualizado"] = now_iso(); products_doc["version"] = new_version("products")
        atomic_write_json(active_products_path(), products_doc)
        return state_payload()


def upload_image(payload: dict) -> dict:
    filename = Path(text(payload.get("filename"), 255)).name
    suffix = Path(filename).suffix.lower()
    if suffix not in ALLOWED_IMAGE_EXTENSIONS:
        raise ValueError("Formato de imagen no permitido. Usá JPG, PNG, WEBP o GIF.")
    raw_data = text(payload.get("data"), MAX_BODY_BYTES)
    if raw_data.startswith("data:"):
        raw_data = raw_data.split(",", 1)[-1]
    try:
        content = base64.b64decode(raw_data, validate=True)
    except Exception as exc:
        raise ValueError("La imagen no se pudo decodificar") from exc
    if not content or len(content) > MAX_IMAGE_BYTES:
        raise ValueError("La imagen debe pesar menos de 6 MB")
    digest = hashlib.sha256(content).hexdigest()[:16]
    safe_name = re.sub(r"[^A-Za-z0-9._-]+", "-", Path(filename).stem).strip("-._")[:50] or "imagen"
    asset_dir = active_asset_dir()
    target = asset_dir / f"{safe_name}-{digest}{suffix}"
    asset_dir.mkdir(parents=True, exist_ok=True)
    if not target.exists():
        target.write_bytes(content)
    return {"path": target.relative_to(PROJECT_ROOT).as_posix()}


def normalize_import_store(name: str, info: dict) -> tuple[str, dict]:
    payload = dict(info or {})
    payload["nombre"] = name
    for key in ("instagram", "facebook", "whatsapp", "telegram"):
        if key not in payload and isinstance(payload.get("redes"), dict):
            payload[key] = payload["redes"].get(key)
    return normalize_store(payload, info)


def import_data(payload: dict) -> dict:
    with LOCK:
        check_revision(payload)
        mode = text(payload.get("mode") or "merge", 20)
        incoming = payload.get("data") or {}
        if isinstance(incoming, list):
            incoming = {"products": incoming}
        stores_in = incoming.get("stores") or incoming.get("tiendas") or incoming.get("manual_stores") or {}
        products_in = incoming.get("products") or incoming.get("productos") or []
        if not isinstance(stores_in, dict) or not isinstance(products_in, list):
            raise ValueError("Formato de importación no reconocido")
        base = load_reference_stores()
        current_stores = {} if mode == "replace" else dict(load_manual_stores()["tiendas"])
        for name, info in stores_in.items():
            normalized_name, normalized_info = normalize_import_store(text(name, 120), info if isinstance(info, dict) else {})
            current_stores[normalized_name] = normalized_info
        known = set(base) | set(current_stores)
        current_products = [] if mode == "replace" else list(load_manual_products()["productos"])
        by_id = {p.get("id"): p for p in current_products if p.get("id")}
        normalized_products = [] if mode == "replace" else current_products
        for item in products_in:
            if not isinstance(item, dict):
                continue
            store_name = text(item.get("tienda"), 120)
            if store_name and store_name not in known:
                auto_name, auto_info = normalize_store({"nombre": store_name, "color": "#B42335"})
                current_stores[auto_name] = auto_info; known.add(auto_name)
            existing = by_id.get(item.get("id"))
            normalized = normalize_product(item, existing, known)
            if mode == "replace":
                normalized_products.append(normalized)
            elif existing:
                idx = next(i for i,p in enumerate(normalized_products) if p.get("id") == normalized["id"])
                normalized_products[idx] = normalized
            else:
                normalized_products.append(normalized)
        backup_current()
        stamp = now_iso()
        stores_doc = {"version": new_version("stores"), "actualizado": stamp, "tiendas": current_stores}
        products_doc = {"version": new_version("products"), "actualizado": stamp, "productos": normalized_products}
        atomic_write_json(active_stores_path(), stores_doc); atomic_write_json(active_products_path(), products_doc)
        return state_payload()


def export_payload() -> dict:
    stores_doc = load_manual_stores(); products_doc = load_manual_products()
    return {
        "format": "rivfree-manual-v1",
        "exported_at": now_iso(),
        "stores": stores_doc.get("tiendas", {}),
        "products": products_doc.get("productos", []),
    }


def export_zip() -> bytes:
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as archive:
        for path in (active_products_path(), active_stores_path()):
            if path.exists():
                archive.write(path, path.relative_to(PROJECT_ROOT).as_posix())
        products = load_manual_products().get("productos", [])
        images = {p.get("imagen") for p in products if isinstance(p, dict) and isinstance(p.get("imagen"), str) and p["imagen"].startswith("assets/manual/")}
        for relative in sorted(images):
            path = PROJECT_ROOT / relative
            try:
                resolved = path.resolve()
                resolved.relative_to(active_asset_dir().resolve())
            except (ValueError, OSError):
                continue
            if resolved.is_file():
                archive.write(resolved, resolved.relative_to(PROJECT_ROOT).as_posix())
        archive.writestr("MANUAL-DATOS-README.txt", "Extraé este ZIP sobre la raíz del repositorio RivFree y luego ejecutá git add/commit/push.\n")
    return out.getvalue()


def _slug(value: str, fallback: str = "colaborador") -> str:
    raw = unicodedata.normalize("NFKD", text(value, 120)).encode("ascii", "ignore").decode("ascii").lower()
    raw = re.sub(r"[^a-z0-9]+", "-", raw).strip("-")
    return raw[:60] or fallback


def _norm_key(value) -> str:
    raw = unicodedata.normalize("NFKD", text(value, 500)).encode("ascii", "ignore").decode("ascii").lower()
    return re.sub(r"[^a-z0-9]+", " ", raw).strip()


def _decode_b64(value, max_bytes: int = MAX_CONTRIBUTION_BYTES) -> bytes:
    if not isinstance(value, str) or not value:
        raise ValueError("Falta el archivo de colaboración")
    if len(value) > max_bytes * 2:
        raise ValueError("El paquete de colaboración es demasiado grande")
    if value.startswith("data:"):
        value = value.split(",", 1)[-1]
    try:
        raw = base64.b64decode(value, validate=True)
    except Exception as exc:
        raise ValueError("No se pudo leer el paquete de colaboración") from exc
    if not raw or len(raw) > max_bytes:
        raise ValueError("El paquete de colaboración debe pesar menos de 32 MB")
    return raw


def _safe_zip_members(archive: zipfile.ZipFile) -> list[zipfile.ZipInfo]:
    infos = archive.infolist()
    if len(infos) > 400:
        raise ValueError("El paquete contiene demasiados archivos")
    total = 0
    for info in infos:
        name = info.filename.replace("\\", "/")
        parts = Path(name).parts
        if name.startswith("/") or ".." in parts:
            raise ValueError("El paquete contiene una ruta no permitida")
        total += max(0, info.file_size)
        if total > 64 * 1024 * 1024:
            raise ValueError("El contenido descomprimido del aporte es demasiado grande")
    return infos


def export_contribution_payload(contributor_name: str = "", note: str = "") -> tuple[dict, dict[str, bytes]]:
    if EDITOR_MODE != "contributor":
        raise ValueError("Esta exportación solo está disponible en modo colaborador")
    stores = load_manual_stores().get("tiendas", {})
    products = load_manual_products().get("productos", [])
    assets: dict[str, bytes] = {}
    out_products = []
    asset_root = active_asset_dir().resolve()
    for product in products:
        if not isinstance(product, dict):
            continue
        item = dict(product)
        image = item.get("imagen")
        if isinstance(image, str) and image.startswith(".contributor-work/assets/"):
            path = PROJECT_ROOT / image
            try:
                resolved = path.resolve()
                resolved.relative_to(asset_root)
            except (ValueError, OSError):
                resolved = None
            if resolved and resolved.is_file():
                package_path = f"assets/{resolved.name}"
                assets[package_path] = resolved.read_bytes()
                item["imagen"] = package_path
        out_products.append(item)
    payload = {
        "format": "rivfree-contribution-v1",
        "contribution_id": "aporte-" + uuid.uuid4().hex,
        "exported_at": now_iso(),
        "contributor": {"name": text(contributor_name, 120) or "Colaborador", "note": text(note, 1000)},
        "stores": stores,
        "products": out_products,
    }
    return payload, assets


def export_contribution_zip(contributor_name: str = "", note: str = "") -> bytes:
    payload, assets = export_contribution_payload(contributor_name, note)
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("rivfree-contribution.json", json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
        for package_path, raw in sorted(assets.items()):
            archive.writestr(package_path, raw)
        archive.writestr(
            "LEEME-APORTE.txt",
            "Este archivo fue generado por el cargador colaborador de RivFree.\n"
            "En el proyecto principal: Abrir-editor-manual.bat > Colaboraciones > Revisar paquete.\n",
        )
    return out.getvalue()


def parse_contribution_zip(raw: bytes) -> tuple[dict, dict[str, bytes]]:
    try:
        archive = zipfile.ZipFile(io.BytesIO(raw), "r")
    except zipfile.BadZipFile as exc:
        raise ValueError("El archivo no es un ZIP de colaboración válido") from exc
    with archive:
        infos = _safe_zip_members(archive)
        names = {info.filename.replace("\\", "/") for info in infos}
        if "rivfree-contribution.json" not in names:
            raise ValueError("No se encontró rivfree-contribution.json dentro del ZIP")
        try:
            manifest = json.loads(archive.read("rivfree-contribution.json").decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise ValueError("El manifiesto de colaboración no es válido") from exc
        if not isinstance(manifest, dict) or manifest.get("format") != "rivfree-contribution-v1":
            raise ValueError("El ZIP no es un aporte compatible con esta versión de RivFree")
        stores = manifest.get("stores") or {}
        products = manifest.get("products") or []
        if not isinstance(stores, dict) or not isinstance(products, list):
            raise ValueError("El aporte tiene un formato de tiendas/productos inválido")
        assets: dict[str, bytes] = {}
        for info in infos:
            name = info.filename.replace("\\", "/")
            if not name.startswith("assets/") or info.is_dir():
                continue
            suffix = Path(name).suffix.lower()
            if suffix not in ALLOWED_IMAGE_EXTENSIONS or info.file_size > MAX_IMAGE_BYTES:
                continue
            assets[name] = archive.read(info)
        return manifest, assets


def load_public_products_for_duplicate_check() -> list[dict]:
    value = read_json(DATA_DIR / "products.json", {"productos": []})
    products = value.get("productos", []) if isinstance(value, dict) else []
    return [p for p in products if isinstance(p, dict)]


def _duplicate_reason(product: dict, existing_products: list[dict]) -> str | None:
    pid = text(product.get("id"), 100)
    store = _norm_key(product.get("tienda"))
    name = _norm_key(product.get("nombre"))
    urls = {text(product.get("url"), 2000), text(product.get("fuente_url"), 2000)} - {""}
    for current in existing_products:
        if pid and current.get("id") == pid:
            return "El ID ya existe en tu catálogo manual"
        if store and store == _norm_key(current.get("tienda")):
            current_urls = {text(current.get("url"), 2000), text(current.get("fuente_url"), 2000)} - {""}
            if urls and urls & current_urls:
                return "Misma tienda y mismo enlace"
            if name and name == _norm_key(current.get("nombre")):
                return "Misma tienda y nombre muy similar"
    return None


def preview_contribution(payload: dict) -> dict:
    if EDITOR_MODE != "owner":
        raise ValueError("Solo el editor principal puede revisar aportes")
    raw = _decode_b64(payload.get("data"))
    manifest, assets = parse_contribution_zip(raw)
    current_state = state_payload()
    current_products = list(current_state.get("products", [])) + load_public_products_for_duplicate_check()
    current_stores = current_state.get("stores", {})
    stores_preview = []
    stores_in = manifest.get("stores") or {}
    for name, info in stores_in.items():
        clean = text(name, 120)
        if not clean:
            continue
        exists = clean in current_stores
        stores_preview.append({
            "name": clean,
            "status": "existing" if exists else "new",
            "selected": not exists,
            "color": safe_color((info or {}).get("color") if isinstance(info, dict) else None),
        })
    products_preview = []
    for item in manifest.get("products") or []:
        if not isinstance(item, dict):
            continue
        reason = _duplicate_reason(item, current_products)
        products_preview.append({
            "id": text(item.get("id"), 100) or "sin-id",
            "name": text(item.get("nombre"), 300) or "Producto sin nombre",
            "store": text(item.get("tienda"), 120),
            "category": text(item.get("categoria"), 120) or "otros",
            "price": item.get("precio_usd"),
            "source": text(item.get("fuente_tipo"), 30) or "manual",
            "status": "possible_duplicate" if reason else "new",
            "reason": reason,
            "selected": not bool(reason),
        })
    preview_id = "preview-" + uuid.uuid4().hex
    CONTRIBUTION_PREVIEWS[preview_id] = {"manifest": manifest, "assets": assets, "created": time.time()}
    for key in list(CONTRIBUTION_PREVIEWS):
        if key != preview_id and (len(CONTRIBUTION_PREVIEWS) > 8 or time.time() - CONTRIBUTION_PREVIEWS[key].get("created", 0) > 3600):
            CONTRIBUTION_PREVIEWS.pop(key, None)
    contributor = manifest.get("contributor") if isinstance(manifest.get("contributor"), dict) else {}
    return {
        "preview_id": preview_id,
        "contribution_id": manifest.get("contribution_id"),
        "exported_at": manifest.get("exported_at"),
        "contributor": {"name": text(contributor.get("name"), 120) or "Colaborador", "note": text(contributor.get("note"), 1000)},
        "stores": stores_preview,
        "products": products_preview,
        "assets_count": len(assets),
    }


def _save_imported_asset(package_path: str, assets: dict[str, bytes]) -> str | None:
    raw = assets.get(package_path)
    if raw is None:
        return None
    suffix = Path(package_path).suffix.lower()
    if suffix not in ALLOWED_IMAGE_EXTENSIONS or len(raw) > MAX_IMAGE_BYTES:
        return None
    digest = hashlib.sha256(raw).hexdigest()[:16]
    stem = re.sub(r"[^A-Za-z0-9._-]+", "-", Path(package_path).stem).strip("-._")[:50] or "aporte"
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    target = ASSET_DIR / f"{stem}-{digest}{suffix}"
    if not target.exists():
        target.write_bytes(raw)
    return target.relative_to(PROJECT_ROOT).as_posix()


def apply_contribution(payload: dict) -> dict:
    if EDITOR_MODE != "owner":
        raise ValueError("Solo el editor principal puede importar aportes")
    with LOCK:
        check_revision(payload)
        preview_id = text(payload.get("preview_id"), 100)
        cached = CONTRIBUTION_PREVIEWS.get(preview_id)
        if not cached:
            raise ValueError("La vista previa venció. Volvé a seleccionar el ZIP.")
        manifest = cached["manifest"]
        assets = cached["assets"]
        selected_store_names = {text(x, 120) for x in (payload.get("stores") or []) if text(x, 120)}
        selected_product_ids = {text(x, 100) for x in (payload.get("products") or []) if text(x, 100)}
        stores_in = manifest.get("stores") or {}
        products_in = [p for p in (manifest.get("products") or []) if isinstance(p, dict)]
        stores_doc = load_manual_stores()
        products_doc = load_manual_products()
        reference = load_reference_stores()
        current_stores = dict(stores_doc["tiendas"])
        current_products = list(products_doc["productos"])
        imported_stores = 0
        imported_products = 0
        # A selected product may depend on a brand-new store. Import that store automatically.
        required_stores = {text(p.get("tienda"), 120) for p in products_in if text(p.get("id"), 100) in selected_product_ids}
        selected_store_names |= {name for name in required_stores if name and name not in reference and name not in current_stores}
        for name in selected_store_names:
            info = stores_in.get(name)
            if not isinstance(info, dict):
                if name not in reference and name not in current_stores:
                    _, normalized = normalize_store({"nombre": name, "color": "#B42335"})
                    current_stores[name] = normalized
                    imported_stores += 1
                continue
            normalized_name, normalized_info = normalize_import_store(name, info)
            current_stores[normalized_name] = normalized_info
            imported_stores += 1
        known = set(reference) | set(current_stores)
        existing_ids = {text(p.get("id"), 100) for p in current_products}
        contributor = manifest.get("contributor") if isinstance(manifest.get("contributor"), dict) else {}
        contributor_name = text(contributor.get("name"), 120) or "Colaborador"
        for item in products_in:
            incoming_id = text(item.get("id"), 100)
            if incoming_id not in selected_product_ids:
                continue
            item = dict(item)
            store_name = text(item.get("tienda"), 120)
            if store_name and store_name not in known:
                auto_name, auto_info = normalize_store({"nombre": store_name, "color": "#B42335"})
                current_stores[auto_name] = auto_info
                known.add(auto_name)
                imported_stores += 1
            image = item.get("imagen")
            if isinstance(image, str) and image.startswith("assets/"):
                item["imagen"] = _save_imported_asset(image, assets)
            # Contributions never silently overwrite an existing manual item by ID.
            if incoming_id in existing_ids:
                item["id"] = ""
            normalized = normalize_product(item, None, known)
            normalized["aportado_por"] = contributor_name
            normalized["aporte_id"] = text(manifest.get("contribution_id"), 100)
            current_products.append(normalized)
            existing_ids.add(normalized["id"])
            imported_products += 1
        if imported_stores == 0 and imported_products == 0:
            raise ValueError("No seleccionaste nada para importar")
        backup_current()
        stamp = now_iso()
        stores_doc = {"version": new_version("stores"), "actualizado": stamp, "tiendas": current_stores}
        products_doc = {"version": new_version("products"), "actualizado": stamp, "productos": current_products}
        atomic_write_json(STORES_PATH, stores_doc)
        atomic_write_json(PRODUCTS_PATH, products_doc)
        CONTRIBUTION_PREVIEWS.pop(preview_id, None)
        result = state_payload()
        result["import_summary"] = {"stores": imported_stores, "products": imported_products, "contributor": contributor_name}
        return result


def reset_contribution(payload: dict) -> dict:
    if EDITOR_MODE != "contributor":
        raise ValueError("Esta acción solo está disponible en modo colaborador")
    with LOCK:
        check_revision(payload)
        backup_current()
        stamp = now_iso()
        atomic_write_json(CONTRIB_STORES_PATH, {"version": new_version("stores"), "actualizado": stamp, "tiendas": {}})
        atomic_write_json(CONTRIB_PRODUCTS_PATH, {"version": new_version("products"), "actualizado": stamp, "productos": []})
        shutil.rmtree(CONTRIB_ASSET_DIR, ignore_errors=True)
        CONTRIB_ASSET_DIR.mkdir(parents=True, exist_ok=True)
        return state_payload()


class Handler(SimpleHTTPRequestHandler):
    server_version = "RivFreeManualEditor/1.0"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(PROJECT_ROOT), **kwargs)

    def log_message(self, fmt, *args):
        print("[editor]", fmt % args)

    def _authorized(self) -> bool:
        parsed = urlparse(self.path)
        query_token = parse_qs(parsed.query).get("token", [""])[0]
        header_token = self.headers.get("X-RivFree-Editor-Token", "")
        return query_token == SESSION_TOKEN or header_token == SESSION_TOKEN

    def _json(self, value, status=200):
        raw = json.dumps(value, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers(); self.wfile.write(raw)

    def _error(self, status, message):
        self._json({"error": str(message)}, status)

    def _body(self) -> dict:
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > MAX_BODY_BYTES:
            raise ValueError("Solicitud vacía o demasiado grande")
        raw = self.rfile.read(length)
        value = json.loads(raw.decode("utf-8"))
        if not isinstance(value, dict):
            raise ValueError("JSON inválido")
        return value

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/manual/"):
            if not self._authorized():
                return self._error(403, "Sesión de editor inválida. Volvé a abrir Abrir-editor-manual.bat")
            if parsed.path == "/api/manual/state":
                return self._json(state_payload())
            if parsed.path == "/api/manual/export":
                raw = json.dumps(export_payload(), ensure_ascii=False, indent=2).encode("utf-8")
                self.send_response(200); self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Disposition", 'attachment; filename="rivfree-manual-backup.json"')
                self.send_header("Content-Length", str(len(raw))); self.send_header("Cache-Control", "no-store"); self.end_headers(); self.wfile.write(raw); return
            if parsed.path == "/api/manual/export.zip":
                raw = export_zip()
                self.send_response(200); self.send_header("Content-Type", "application/zip")
                self.send_header("Content-Disposition", 'attachment; filename="rivfree-manual-github.zip"')
                self.send_header("Content-Length", str(len(raw))); self.send_header("Cache-Control", "no-store"); self.end_headers(); self.wfile.write(raw); return
            if parsed.path == "/api/manual/contribution.zip":
                if EDITOR_MODE != "contributor":
                    return self._error(400, "Abrí Abrir-colaborador.bat para generar un aporte")
                query = parse_qs(parsed.query)
                name = text((query.get("name") or [""])[0], 120)
                note = text((query.get("note") or [""])[0], 1000)
                raw = export_contribution_zip(name, note)
                filename = f"rivfree-aporte-{_slug(name)}.zip"
                self.send_response(200); self.send_header("Content-Type", "application/zip")
                self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
                self.send_header("Content-Length", str(len(raw))); self.send_header("Cache-Control", "no-store"); self.end_headers(); self.wfile.write(raw); return
            return self._error(404, "API no encontrada")
        return super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        if not parsed.path.startswith("/api/manual/"):
            return self._error(404, "Ruta no encontrada")
        if not self._authorized():
            return self._error(403, "Sesión de editor inválida")
        origin = self.headers.get("Origin")
        if origin:
            host = urlparse(origin).hostname
            if host not in {"127.0.0.1", "localhost"}:
                return self._error(403, "Origen no permitido")
        try:
            payload = self._body()
            actions = {
                "/api/manual/save-store": save_store,
                "/api/manual/delete-store": delete_store,
                "/api/manual/save-product": save_product,
                "/api/manual/delete-product": delete_product,
                "/api/manual/upload-image": upload_image,
                "/api/manual/import": import_data,
                "/api/manual/preview-contribution": preview_contribution,
                "/api/manual/apply-contribution": apply_contribution,
                "/api/manual/reset-contribution": reset_contribution,
            }
            action = actions.get(parsed.path)
            if not action:
                return self._error(404, "API no encontrada")
            return self._json(action(payload))
        except RuntimeError as exc:
            return self._error(409, exc)
        except (ValueError, json.JSONDecodeError) as exc:
            return self._error(400, exc)
        except Exception as exc:
            return self._error(500, f"Error interno: {exc}")


def main():
    parser = argparse.ArgumentParser(description="Editor local de tiendas y productos manuales de RivFree")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--open", action="store_true", dest="open_browser")
    parser.add_argument("--mode", choices=("owner", "contributor"), default="owner")
    args = parser.parse_args()
    global EDITOR_MODE
    EDITOR_MODE = args.mode
    ensure_files()
    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    url = f"http://127.0.0.1:{args.port}/tools/manual_editor/?token={SESSION_TOKEN}&mode={EDITOR_MODE}"
    print("\nRivFree · " + ("Cargador colaborador" if EDITOR_MODE == "contributor" else "Editor manual"))
    print(f"Proyecto: {PROJECT_ROOT}")
    print(f"Abrí: {url}")
    print("Para cerrar el editor: Ctrl+C\n")
    if args.open_browser:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nEditor cerrado.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
