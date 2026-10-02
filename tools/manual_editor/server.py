#!/usr/bin/env python3
"""Local-only editor for RivFree manual stores and products.

The server binds to 127.0.0.1 and requires a per-run token for every write/API
request. Pillow optimizes uploaded images.
"""
from __future__ import annotations

import argparse
import sys
import math
try:
    from . import maintenance
except ImportError:
    import maintenance
import base64
import hashlib
import hmac
import secrets
import io
import json
import mimetypes
import os
from pathlib import Path
import re
import shutil
import errno
import traceback
import threading
import time
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse, unquote
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
SITE_CONFIG_PATH = DATA_DIR / "site-config.json"
HIGHLIGHTS_PATH = DATA_DIR / "highlights.json"
HEALTH_PATH = DATA_DIR / "health.json"
META_PATH = DATA_DIR / "meta.json"
ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
# Uploads are always re-encoded to WebP, so iPhone photos (HEIC/HEIF) are accepted there too.
UPLOAD_IMAGE_EXTENSIONS = ALLOWED_IMAGE_EXTENSIONS | {".heic", ".heif"}
MAX_IMAGE_BYTES = 15 * 1024 * 1024
MAX_BODY_BYTES = 48 * 1024 * 1024
MAX_CONTRIBUTION_BYTES = 32 * 1024 * 1024
SOURCE_TYPES = {"manual", "instagram", "facebook", "whatsapp", "web", "website"}
LOCK = threading.RLock()
SESSION_TOKEN = secrets.token_urlsafe(32)
SESSION_EXPIRED = "Esta pestaña quedó de una sesión anterior de Studio. Cerrala y abrí Studio de nuevo con Abrir-RivFree-Studio (cada vez que se abre, la clave cambia)."
STUDIO_BUILD = '20261002-studio12'
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


def guarded_path(path: Path):
    path = Path(path)
    root = PROJECT_ROOT.resolve()
    if not path.resolve().is_relative_to(root):
        raise ValueError('Ruta fuera del proyecto')
    for part in [path, *path.parents]:
        if part == PROJECT_ROOT.parent: break
        if part.is_symlink(): raise ValueError('No se permiten enlaces simbólicos')
    return path


def atomic_write_json(path: Path, value) -> None:
    guarded_path(path)
    guarded_path(path.with_suffix(path.suffix + ".tmp"))
    if path == active_products_path() and isinstance(value, dict):
        previous = {p.get('id'): p for p in read_json(path, {}).get('productos', [])}
        for product in value.get('productos', []):
            old = previous.get(product.get('id'), {})
            history = list(old.get('historial_precios', []))
            if not old:
                for entry in product.get('historial_precios', []):
                    if isinstance(entry, dict) and isinstance(entry.get('fecha'), str):
                        try: price_entry = number_or_none(entry.get('precio_usd'), 'Precio histórico')
                        except ValueError: continue
                        history.append({'fecha': entry['fecha'], 'precio_usd': price_entry})
            if not history and old:
                history.append({'fecha': old.get('actualizado_manual') or now_iso(), 'precio_usd': old.get('precio_usd')})
            price = product.get('precio_usd')
            if not history or history[-1].get('precio_usd') != price:
                history.append({'fecha': now_iso(), 'precio_usd': price})
            product['historial_precios'] = history
    if path == PRODUCTS_PATH and isinstance(value, dict):
        keep_private_fields(value)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    tmp.replace(path)


# Internal notes and contributor names stay on this computer (.rivfree-local is ignored by git
# and never served); the public catalog in data/ only carries what visitors may see.
PRIVATE_PRODUCT_FIELDS = ("nota_manual", "aportado_por", "aporte_id")


def private_notes_path() -> Path:
    return PROJECT_ROOT / ".rivfree-local" / "product-notes.json"


def load_private_notes() -> dict:
    value = read_json(private_notes_path(), {})
    return {k: v for k, v in value.items() if isinstance(v, dict)} if isinstance(value, dict) else {}


def keep_private_fields(doc: dict) -> None:
    notes = load_private_notes()
    before = json.dumps(notes, sort_keys=True)
    for product in doc.get("productos", []):
        if not isinstance(product, dict) or not product.get("id"):
            continue
        entry = dict(notes.get(product["id"], {}))
        for field in PRIVATE_PRODUCT_FIELDS:
            if field in product:
                value = product.pop(field)
                if value: entry[field] = value
                else: entry.pop(field, None)
        if entry: notes[product["id"]] = entry
        else: notes.pop(product["id"], None)
    if json.dumps(notes, sort_keys=True) != before:
        target = guarded_path(private_notes_path())
        target.parent.mkdir(parents=True, exist_ok=True)
        tmp = target.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(notes, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        tmp.replace(target)


def with_private_fields(products: list) -> list:
    notes = load_private_notes()
    return [{**notes.get(p.get("id"), {}), **p} if isinstance(p, dict) else p for p in products]


def ensure_files() -> None:
    guarded_path(ASSET_DIR).mkdir(parents=True, exist_ok=True)
    if not PRODUCTS_PATH.exists():
        atomic_write_json(PRODUCTS_PATH, {"version": "initial", "actualizado": None, "productos": []})
    if not STORES_PATH.exists():
        atomic_write_json(STORES_PATH, {"version": "initial", "actualizado": None, "tiendas": {}})
    if EDITOR_MODE == "owner":
        if not SITE_CONFIG_PATH.exists():
            atomic_write_json(SITE_CONFIG_PATH, default_site_config())
        if not HIGHLIGHTS_PATH.exists():
            atomic_write_json(HIGHLIGHTS_PATH, {"hero": []})
    if EDITOR_MODE == "contributor":
        CONTRIB_ASSET_DIR.mkdir(parents=True, exist_ok=True)
        if not CONTRIB_PRODUCTS_PATH.exists():
            atomic_write_json(CONTRIB_PRODUCTS_PATH, {"version": "initial", "actualizado": None, "productos": []})
        if not CONTRIB_STORES_PATH.exists():
            atomic_write_json(CONTRIB_STORES_PATH, {"version": "initial", "actualizado": None, "tiendas": {}})


def revision() -> str:
    digest = hashlib.sha256()
    paths = [active_products_path(), active_stores_path()]
    if EDITOR_MODE == "owner":
        paths += [SITE_CONFIG_PATH, HIGHLIGHTS_PATH]
    for path in paths:
        try:
            digest.update(path.read_bytes())
        except OSError:
            digest.update(b"missing")
    return digest.hexdigest()[:20]


def new_version(prefix: str) -> str:
    return f"{prefix}-{int(time.time() * 1000)}-{uuid.uuid4().hex[:8]}"


def backup_current() -> None:
    backup_dir = guarded_path(active_backup_dir())
    backup_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S-%f")
    target = backup_dir / stamp
    target.mkdir(parents=True, exist_ok=True)
    paths = [active_products_path(), active_stores_path()]
    if EDITOR_MODE == "owner":
        paths += [SITE_CONFIG_PATH, HIGHLIGHTS_PATH, corrections_path()]
    for path in paths:
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
    if parsed.scheme != "https" or not parsed.hostname or parsed.username is not None or parsed.password is not None or any(ord(c)<32 for c in value):
        raise ValueError("URL inválida: usá HTTPS sin credenciales")
    return value


def safe_image(value):
    value = text(value, 2000).replace("\\", "/")
    if not value:
        return None
    allowed_local = value.startswith("assets/manual/") or (EDITOR_MODE == "contributor" and value.startswith((".contributor-work/assets/", "contributor-assets/")))
    if allowed_local and ".." not in value:
        return value
    return safe_url(value)


def safe_color(value, fallback="#B42335") -> str:
    value = text(value, 20)
    return value if re.fullmatch(r"#[0-9A-Fa-f]{6}", value) else fallback


def decimal_text(value: str) -> str:
    """'29,90', '1.299,90', '1,299.90' or 'USD 29,90' → '29.90' / '1299.90'."""
    raw = re.sub(r"^(?:US\$|U\$S|USD|\$)", "", re.sub(r"[\s\u00a0]", "", value), flags=re.I)
    if "," in raw and "." in raw:
        decimal = "," if raw.rfind(",") > raw.rfind(".") else "."
        raw = raw.replace("." if decimal == "," else ",", "").replace(decimal, ".")
    elif "," in raw:
        raw = raw.replace(",", ".") if raw.count(",") == 1 else raw.replace(",", "")
    return raw


def number_or_none(value, field_name: str):
    if isinstance(value, str):
        value = decimal_text(value)
    if value in (None, ""):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        raise ValueError(f"{field_name} debe ser un número")
    if not math.isfinite(number) or number < 0 or number > 1_000_000:
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
    if EDITOR_MODE == "owner":
        value["productos"] = with_private_fields(value["productos"])
    return value



SOCIAL_NETWORKS = ("instagram", "facebook", "tiktok", "whatsapp", "youtube", "x", "telegram")
SOCIAL_LABELS = {"instagram": "Instagram", "facebook": "Facebook", "tiktok": "TikTok", "whatsapp": "WhatsApp", "youtube": "YouTube", "x": "X", "telegram": "Telegram"}

def default_site_config() -> dict:
    return {
        "version": "studio-1", "actualizado": None,
        "branding": {"site_name": "RivFree", "tagline_es": "Explorá y compará los free shops de Rivera y Santana do Livramento", "tagline_pt": "Explore e compare os free shops de Rivera e Santana do Livramento"},
        "appearance": {
            "font": "system-modern", "density": "comfortable", "radius": 12, "shadow": "soft", "colors_customized": False,
            "light": {"background": "#E8ECF2", "surface": "#FFFFFF", "text": "#172337", "primary": "#AD233C", "accent": "#E94E67", "highlight": "#FFB5B9", "background_image": "", "background_overlay": 0},
            "dark": {"background": "#101B2B", "surface": "#19283C", "text": "#F1F5FB", "primary": "#AD233C", "accent": "#E94E67", "highlight": "#FFB5B9", "background_image": "", "background_overlay": 0},
        },
        "notice": {"enabled": True, "dismissible": True, "title_es": "Antes de tu visita.", "title_pt": "Antes da sua visita.", "text_es": "La web refleja catálogos online, no el stock físico completo de cada tienda.", "text_pt": "A web reflete catálogos online, não o estoque físico completo de cada loja."},
        "homepage": {"order": ["hero", "benefits", "discover", "popular", "recommended", "most"], "visible": {"hero": True, "benefits": True, "discover": True, "popular": True, "recommended": True, "most": True}},
        "carousel": {"visible_count": 5, "autoplay": True, "autoplay_seconds": 6, "transition": "smooth", "transition_ms": 500},
        "seo": {"title_es": "RivFree — Comparador de precios de free shops", "title_pt": "RivFree — Comparador de preços de free shops", "description_es": "Compará precios de free shops de Rivera y Santana do Livramento.", "description_pt": "Compare preços de free shops de Rivera e Santana do Livramento.", "social_image": "social-card.png"},
        "top_notice": {"enabled": True, "title_es": "RivFree es un comparador de precios.", "title_pt": "O RivFree é um comparador de preços.", "text_es": "No vendemos productos ni estamos afiliados a las tiendas: cada compra se hace directamente con el free shop.", "text_pt": "Não vendemos produtos nem somos afiliados às lojas: cada compra é feita diretamente com o free shop.", "short_es": "Solo comparamos precios: no vendemos ni estamos afiliados a las tiendas.", "short_pt": "Só comparamos preços: não vendemos nem somos afiliados às lojas."},
        "social": {"show_without_link": True, **{k: {"url": "", "visible": k in ("instagram", "facebook", "tiktok", "whatsapp")} for k in SOCIAL_NETWORKS}},
        "nav": {"stores": True, "offers": True, "exchange": True, "list": True},
        "offers": {"tiers": [20, 40, 60]},
        "footer": {"title_es": "RivFree · Comparador independiente", "title_pt": "RivFree · Comparador independente", "text_es": "No realizamos ventas ni estamos afiliados a las tiendas. Los precios y la disponibilidad son orientativos y pueden cambiar. Consultá la información actualizada en la publicación oficial de cada tienda.", "text_pt": "Não realizamos vendas nem somos afiliados às lojas. Os preços e a disponibilidade são indicativos e podem mudar. Consulte as informações atualizadas na publicação oficial de cada loja.", "show_privacy": True},
    }

def safe_int(value, fallback, minimum, maximum):
    try: value = int(value)
    except (TypeError, ValueError): return fallback
    return max(minimum, min(maximum, value))

def safe_float(value, fallback, minimum, maximum):
    try: value = float(value)
    except (TypeError, ValueError): return fallback
    return max(minimum, min(maximum, value))

def safe_asset_or_url(value):
    value = text(value, 2000).replace("\\", "/")
    if not value: return ""
    if ".." not in value and (value.startswith("assets/manual/") or value == "social-card.png" or value.startswith("icons/")):
        return value
    return safe_url(value) or ""

def normalize_site_config(raw: dict) -> dict:
    base = default_site_config(); raw = raw if isinstance(raw, dict) else {}
    branding = raw.get("branding") if isinstance(raw.get("branding"), dict) else {}
    appearance = raw.get("appearance") if isinstance(raw.get("appearance"), dict) else {}
    def palette(name):
        src = appearance.get(name) if isinstance(appearance.get(name), dict) else {}; default = base["appearance"][name]
        return {
            "background": safe_color(src.get("background"), default["background"]),
            "surface": safe_color(src.get("surface"), default["surface"]),
            "text": safe_color(src.get("text"), default["text"]),
            "primary": safe_color(src.get("primary"), default["primary"]),
            "accent": safe_color(src.get("accent"), default["accent"]),
            "highlight": safe_color(src.get("highlight"), default["highlight"]),
            "background_image": safe_asset_or_url(src.get("background_image")),
            "background_overlay": round(safe_float(src.get("background_overlay"), 0, 0, .9), 2),
        }
    font = text(appearance.get("font"), 30); density = text(appearance.get("density"), 30); shadow = text(appearance.get("shadow"), 30)
    notice = raw.get("notice") if isinstance(raw.get("notice"), dict) else {}
    homepage = raw.get("homepage") if isinstance(raw.get("homepage"), dict) else {}; visible = homepage.get("visible") if isinstance(homepage.get("visible"), dict) else {}
    allowed_sections = ["hero", "benefits", "discover", "popular", "recommended", "most"]
    order = [x for x in (homepage.get("order") or []) if x in allowed_sections]
    order += [x for x in allowed_sections if x not in order]
    carousel = raw.get("carousel") if isinstance(raw.get("carousel"), dict) else {}
    seo = raw.get("seo") if isinstance(raw.get("seo"), dict) else {}
    footer = raw.get("footer") if isinstance(raw.get("footer"), dict) else {}
    top = raw.get("top_notice") if isinstance(raw.get("top_notice"), dict) else {}
    social = raw.get("social") if isinstance(raw.get("social"), dict) else {}
    nav = raw.get("nav") if isinstance(raw.get("nav"), dict) else {}
    offers = raw.get("offers") if isinstance(raw.get("offers"), dict) else {}
    def network(key):
        item = social.get(key) if isinstance(social.get(key), dict) else {}
        default = base["social"][key]
        try:
            url = safe_url(item.get("url")) or ""
        except ValueError:
            raise ValueError(f"Enlace de {SOCIAL_LABELS[key]} inválido: usá una dirección que empiece con https://") from None
        return {"url": url, "visible": bool(item.get("visible", default["visible"]))}
    tiers = []
    for value in offers.get("tiers") if isinstance(offers.get("tiers"), list) else []:
        number = safe_int(value, 0, 0, 1000)
        if 5 <= number <= 95 and number not in tiers: tiers.append(number)
    tiers = sorted(tiers)[:4] or [20, 40, 60]
    return {
        "version": new_version("studio"), "actualizado": now_iso(),
        "branding": {"site_name": text(branding.get("site_name") or "RivFree", 60), "tagline_es": text(branding.get("tagline_es"), 180), "tagline_pt": text(branding.get("tagline_pt"), 180)},
        "appearance": {"font": font if font in {"system-modern","inter-ui","geometric","humanist","rounded","compact","classic-ui","editorial","slab","mono"} else "system-modern", "density": density if density in {"compact","comfortable","airy"} else "comfortable", "radius": safe_int(appearance.get("radius"), 12, 0, 32), "shadow": shadow if shadow in {"none","soft","strong"} else "soft", "colors_customized": bool(appearance.get("colors_customized", False)), "light": palette("light"), "dark": palette("dark")},
        "notice": {"enabled": bool(notice.get("enabled", True)), "dismissible": bool(notice.get("dismissible", True)), "title_es": text(notice.get("title_es"), 120), "title_pt": text(notice.get("title_pt"), 120), "text_es": text(notice.get("text_es"), 500), "text_pt": text(notice.get("text_pt"), 500)},
        "homepage": {"order": order, "visible": {k: bool(visible.get(k, True)) for k in allowed_sections}},
        "carousel": {"visible_count": safe_int(carousel.get("visible_count"), 5, 1, 10), "autoplay": bool(carousel.get("autoplay", True)), "autoplay_seconds": safe_int(carousel.get("autoplay_seconds"), 6, 3, 30), "transition": text(carousel.get("transition"), 20) if text(carousel.get("transition"), 20) in {"smooth","static"} else "smooth", "transition_ms": safe_int(carousel.get("transition_ms"), 500, 200, 1200)},
        "seo": {"title_es": text(seo.get("title_es"), 160), "title_pt": text(seo.get("title_pt"), 160), "description_es": text(seo.get("description_es"), 320), "description_pt": text(seo.get("description_pt"), 320), "social_image": safe_asset_or_url(seo.get("social_image")) or "social-card.png"},
        "top_notice": {"enabled": bool(top.get("enabled", True)), **{f"{field}_{lang}": text(top.get(f"{field}_{lang}"), limit) for field, limit in (("title", 120), ("text", 400), ("short", 200)) for lang in ("es", "pt")}},
        "social": {"show_without_link": bool(social.get("show_without_link", True)), **{key: network(key) for key in SOCIAL_NETWORKS}},
        "nav": {key: bool(nav.get(key, True)) for key in ("stores", "offers", "exchange", "list")},
        "offers": {"tiers": tiers},
        "footer": {"title_es": text(footer.get("title_es"), 160), "title_pt": text(footer.get("title_pt"), 160), "text_es": text(footer.get("text_es"), 1000), "text_pt": text(footer.get("text_pt"), 1000), "show_privacy": bool(footer.get("show_privacy", True))},
    }

def load_site_config() -> dict:
    value = read_json(SITE_CONFIG_PATH, default_site_config())
    if not isinstance(value, dict):
        return default_site_config()
    base = default_site_config()
    for key in ("top_notice", "social", "nav", "offers"):  # options added in v6
        if not isinstance(value.get(key), dict):
            value[key] = base[key]
    # v7.1: the native light background is darker for contrast. Untouched palettes follow the new default.
    appearance = value.get("appearance") if isinstance(value.get("appearance"), dict) else None
    light = appearance.get("light") if appearance and isinstance(appearance.get("light"), dict) else None
    if light and not appearance.get("colors_customized") and str(light.get("background", "")).upper() == "#F5F6F8":
        light["background"] = "#E8ECF2"
    return value

def normalize_campaign(raw: dict, index=0) -> dict:
    if not isinstance(raw, dict): raise ValueError("Banner inválido")
    def bilingual(key, limit):
        value=raw.get(key); value=value if isinstance(value, dict) else {}
        return {"es": text(value.get("es"), limit), "pt-BR": text(value.get("pt-BR"), limit)}
    cid = re.sub(r"[^a-z0-9_-]+", "-", text(raw.get("id"), 100).lower()).strip("-") or f"banner-{uuid.uuid4().hex[:10]}"
    theme=text(raw.get("theme"),20); layout=text(raw.get("layout"),20); smart=text(raw.get("smartType"),30); group=text(raw.get("poolGroup") or "general",40)
    category=text(raw.get("category"),120); action=text(raw.get("action"),30)
    result={"id":cid,"poolGroup":group,"theme":theme if theme in {"rose","blue","sand","mint","plum","graphite","amber","ocean","forest"} else "rose","layout":layout if layout in {"split","banner"} else "split","sponsored":bool(raw.get("sponsored")),"enabled":bool(raw.get("enabled",True)),"eyebrow":bilingual("eyebrow",120),"title":bilingual("title",220),"description":bilingual("description",500),"cta":bilingual("cta",100),"category":category}
    if smart in {"compare","multistore","offer","category"}: result["smartType"]=smart
    if action in {"offers","category","compare"}: result["action"]=action

    colors_raw = raw.get("colors") if isinstance(raw.get("colors"), dict) else {}
    colors = {}
    campaign_palettes = {
        "rose": {"light": {"background":"#EFD4DA","text":"#30212A","accent":"#9F2942","button":"#9F2942","button_text":"#FFFFFF"}, "dark": {"background":"#38232E","text":"#F8EDF0","accent":"#FF91A6","button":"#FF91A6","button_text":"#151515"}},
        "blue": {"light": {"background":"#D8E5F3","text":"#192D45","accent":"#245F93","button":"#245F93","button_text":"#FFFFFF"}, "dark": {"background":"#192C45","text":"#ECF4FF","accent":"#85BAFF","button":"#85BAFF","button_text":"#152234"}},
        "sand": {"light": {"background":"#EADCC3","text":"#463725","accent":"#76511B","button":"#76511B","button_text":"#FFFFFF"}, "dark": {"background":"#322B21","text":"#F8F0DE","accent":"#E8C578","button":"#E8C578","button_text":"#2A2218"}},
        "mint": {"light": {"background":"#D7E7DD","text":"#203C30","accent":"#2E6B51","button":"#2E6B51","button_text":"#FFFFFF"}, "dark": {"background":"#1C332C","text":"#ECFAF3","accent":"#85D4AD","button":"#85D4AD","button_text":"#183026"}},
        "plum": {"light": {"background":"#EADCF0","text":"#392844","accent":"#74438A","button":"#74438A","button_text":"#FFFFFF"}, "dark": {"background":"#30223A","text":"#F5ECF8","accent":"#D3A0EB","button":"#D3A0EB","button_text":"#261B2E"}},
        "graphite": {"light": {"background":"#DFE3E8","text":"#232A32","accent":"#3F4A58","button":"#3F4A58","button_text":"#FFFFFF"}, "dark": {"background":"#22272E","text":"#F1F4F7","accent":"#AEB9C8","button":"#AEB9C8","button_text":"#1D2329"}},
        "amber": {"light": {"background":"#F2DFB7","text":"#4B381D","accent":"#8A5B12","button":"#8A5B12","button_text":"#FFFFFF"}, "dark": {"background":"#342918","text":"#FFF4DC","accent":"#F0C36D","button":"#F0C36D","button_text":"#2A2115"}},
        "ocean": {"light": {"background":"#D7E9ED","text":"#173D49","accent":"#247287","button":"#247287","button_text":"#FFFFFF"}, "dark": {"background":"#17313A","text":"#EDFAFD","accent":"#78C8DB","button":"#78C8DB","button_text":"#142A32"}},
        "forest": {"light": {"background":"#D8E7D7","text":"#243D27","accent":"#376B3D","button":"#376B3D","button_text":"#FFFFFF"}, "dark": {"background":"#1C3120","text":"#EFF9F0","accent":"#8BD095","button":"#8BD095","button_text":"#18301C"}},
    }
    color_defaults = campaign_palettes.get(theme, campaign_palettes["rose"])
    for mode in ("light", "dark"):
        src = colors_raw.get(mode) if isinstance(colors_raw.get(mode), dict) else {}
        defaults = color_defaults[mode]
        colors[mode] = {k: safe_color(src.get(k), defaults[k]) for k in ("background","text","accent","button","button_text")}
    result["colors"] = colors
    href=safe_url(raw.get("href")); image=safe_asset_or_url(raw.get("image")); mobile=safe_asset_or_url(raw.get("mobileImage"))
    if href: result["href"]=href
    if image: result["image"]=image
    if mobile: result["mobileImage"]=mobile
    images=[]
    for item in (raw.get("images") or [])[:3]:
        if not isinstance(item,dict): continue
        src=safe_asset_or_url(item.get("src"));
        if src: images.append({"src":src,"alt":text(item.get("alt"),160)})
    if images: result["images"]=images
    for key in ("starts_at","ends_at"):
        value=text(raw.get(key),40)
        if value: result[key]=value
    return result

def load_highlights() -> dict:
    value=read_json(HIGHLIGHTS_PATH,{"hero":[]}); hero=value.get("hero") if isinstance(value,dict) else []
    return {"hero": hero if isinstance(hero,list) else []}

def save_site_config(payload: dict) -> dict:
    if EDITOR_MODE != "owner": raise ValueError("Solo el editor principal puede cambiar el sitio")
    with LOCK:
        check_revision(payload); backup_current(); config=normalize_site_config(payload.get("config") or {}); atomic_write_json(SITE_CONFIG_PATH,config); return state_payload()

# ── Studio → Base de datos (PostgreSQL) ─────────────────────────────────────
# The connection (with its password) is kept only on this computer, in .rivfree-local/ (never published).
_POSTGRES_MODULE = None


def postgres():
    global _POSTGRES_MODULE
    if _POSTGRES_MODULE is None:
        import importlib.util
        path = Path(__file__).resolve().parents[1] / "postgres_sync.py"
        spec = importlib.util.spec_from_file_location("rivfree_postgres_sync", path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        _POSTGRES_MODULE = module
    return _POSTGRES_MODULE


def _db_owner():
    if EDITOR_MODE != "owner":
        raise ValueError("Solo el editor principal puede configurar la base de datos")


def db_state(payload: dict | None = None) -> dict:
    _db_owner()
    pg = postgres()
    url = pg.load_saved_url(PROJECT_ROOT)
    try:
        import pg8000  # noqa: F401
        has_driver = True
    except ImportError:
        has_driver = False
    return {"configured": bool(url), "masked": pg.mask_url(url) if url else "", "driver": has_driver}


def db_test(payload: dict) -> dict:
    _db_owner()
    pg = postgres()
    url = text(payload.get("url"), 2000) or pg.load_saved_url(PROJECT_ROOT)
    if not url:
        raise ValueError("Pegá la dirección de conexión de tu base.")
    return {**db_state(), "stats": pg.run_with_connection(url, pg.stats, timeout=25)}


def db_save(payload: dict) -> dict:
    _db_owner()
    pg = postgres()
    url = text(payload.get("url"), 2000)
    pg.parse_database_url(url)
    result = pg.run_with_connection(url, pg.stats, timeout=25)  # only connections that work are saved
    pg.save_url(url, PROJECT_ROOT)
    return {**db_state(), "stats": result}


def db_sync(payload: dict) -> dict:
    _db_owner()
    pg = postgres()
    url = pg.load_saved_url(PROJECT_ROOT)
    if not url:
        raise ValueError("Primero guardá la conexión con tu base.")
    with LOCK:  # a consistent copy of the files while they are read
        summary = pg.run_with_connection(url, lambda con: pg.sync(con, PROJECT_ROOT, "studio"), timeout=180)
    return {**db_state(), "summary": summary, "stats": pg.run_with_connection(url, pg.stats, timeout=25)}


def db_forget(payload: dict) -> dict:
    _db_owner()
    postgres().forget_url(PROJECT_ROOT)
    return db_state()


def save_highlights(payload: dict) -> dict:
    if EDITOR_MODE != "owner": raise ValueError("Solo el editor principal puede cambiar el carrusel")
    with LOCK:
        check_revision(payload); hero=payload.get("hero") or []
        if not isinstance(hero,list): raise ValueError("Carrusel inválido")
        if len(hero)>60: raise ValueError("El carrusel admite hasta 60 campañas en la pool")
        normalized=[normalize_campaign(item,i) for i,item in enumerate(hero)]
        ids=[x["id"] for x in normalized]
        if len(ids)!=len(set(ids)): raise ValueError("Hay banners con el mismo identificador")
        backup_current(); atomic_write_json(HIGHLIGHTS_PATH,{"hero":normalized}); return state_payload()


def load_reference_stores() -> dict:
    base = load_base_stores()
    if EDITOR_MODE != "contributor":
        return base
    owner_manual = read_json(STORES_PATH, {"tiendas": {}})
    owner_stores = owner_manual.get("tiendas", {}) if isinstance(owner_manual, dict) else {}
    if not isinstance(owner_stores, dict):
        owner_stores = {}
    return {**base, **owner_stores}

def normalize_profile(payload, current):
    from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
    fields = ('description','specialties','timezone','weekly_hours','hours_exceptions','google','photos','source','verified_at','ubicacion')
    result = {key: current[key] for key in fields if key in current}
    result.update({key: payload[key] for key in fields if key in payload})
    if 'description' in result:
        value=result['description']
        if not isinstance(value,dict): raise ValueError('Descripción de tienda inválida')
        result['description']={lang:text(value.get(lang),6000) for lang in ('es','pt-BR')}
    if 'specialties' in result:
        if not isinstance(result['specialties'],list): raise ValueError('Especialidades inválidas')
        result['specialties']=[text(v,120) for v in result['specialties'][:30] if text(v,120)]
    if result.get('timezone') and result['timezone'] not in {'America/Montevideo','America/Sao_Paulo','America/Asuncion','America/Argentina/Buenos_Aires','UTC'}:
        try: ZoneInfo(result['timezone'])
        except (ZoneInfoNotFoundError, ValueError, TypeError): raise ValueError('Zona horaria inválida')
    def hours(value, exceptions=False):
        if not isinstance(value,dict): raise ValueError('Horarios inválidos')
        for day, intervals in value.items():
            if exceptions:
                try: datetime.strptime(day,'%Y-%m-%d')
                except ValueError: raise ValueError('Fecha de excepción inválida')
            elif str(day) not in list('0123456'): raise ValueError('Día de semana inválido')
            if not isinstance(intervals,list) or len(intervals)>8: raise ValueError('Intervalos de horario inválidos')
            for pair in intervals:
                if not isinstance(pair,list) or len(pair)!=2 or not all(isinstance(t,str) and re.fullmatch(r'(?:[01]\d|2[0-3]):[0-5]\d',t) for t in pair) or pair[0]>=pair[1]:
                    raise ValueError('Usá intervalos HH:MM-HH:MM dentro del mismo día; vacío significa cerrado')
            for previous, current in zip(intervals, intervals[1:]):
                if current[0] < previous[1]:
                    raise ValueError('Los turnos se superponen o están desordenados')
        return value
    for key in ('weekly_hours','hours_exceptions'):
        if key in result and result[key] is not None: result[key]=hours(result[key],key=='hours_exceptions')
    if 'google' in result:
        g=result['google']
        if not isinstance(g,dict): raise ValueError('Datos de Google inválidos')
        rating=number_or_none(g.get('rating'),'Evaluación de Google');count=number_or_none(g.get('count'),'Cantidad de evaluaciones')
        if rating is not None and not 0<=rating<=5: raise ValueError('La evaluación debe estar entre 0 y 5')
        if count is not None and (count<0 or not count.is_integer()): raise ValueError('La cantidad debe ser un entero positivo')
        result['google']={'rating':rating,'count':int(count) if count is not None else None,'url':safe_url(g.get('url'))}
    if 'ubicacion' in result:
        point=result['ubicacion']
        if point in (None,'',{}):
            result['ubicacion']=None
        else:
            if not isinstance(point,dict): raise ValueError('Ubicación inválida')
            def coordinate(value, label):
                if value in (None, ''): return None
                if isinstance(value, bool): raise ValueError(f'{label} inválida')
                try: number=float(value)
                except (TypeError, ValueError): raise ValueError(f'{label} debe ser un número')
                if not math.isfinite(number): raise ValueError(f'{label} fuera de rango')
                return number
            lat=coordinate(point.get('lat'),'Latitud');lng=coordinate(point.get('lng'),'Longitud')
            if lat is None or lng is None: raise ValueError('Completá latitud y longitud, o dejá ambas vacías')
            if not (-90<=lat<=90 and -180<=lng<=180) or (lat==0 and lng==0): raise ValueError('Coordenadas fuera de rango')
            result['ubicacion']={'lat':round(lat,7),'lng':round(lng,7)}
    if 'photos' in result:
        if not isinstance(result['photos'],list) or len(result['photos'])>30: raise ValueError('Máximo 30 fotos por tienda')
        result['photos']=[{'url':safe_image(p.get('url')),'caption':text(p.get('caption'),300),'attribution':text(p.get('attribution'),500)} for p in result['photos'] if isinstance(p,dict)]
    if 'source' in result: result['source']=safe_url(result['source'])
    if 'verified_at' in result: result['verified_at']=text(result['verified_at'],40)
    return result


def safe_email(value):
    """A plain address only: «x@y.com?bcc=…» would add hidden recipients to the visitor's e-mail."""
    value = nullable_text(value, 160)
    if value and not re.fullmatch(r"[^@\s?&#/]+@[^@\s?&#/]+\.[^@\s?&#/]+", value):
        raise ValueError("Email inválido: escribí solo la dirección, por ejemplo ventas@tienda.com")
    return value


def whatsapp_url(value):
    """'+598 99 123 456' or '099 123 456' (Uruguayan mobile) → https://wa.me/59899123456; links pass through."""
    raw = text(value, 200)
    if not re.fullmatch(r"\+?[\d\s().-]{7,}", raw):
        return raw
    digits = re.sub(r"\D", "", raw)
    if not raw.startswith("+") and digits.startswith("0") and len(digits) == 9:
        digits = "598" + digits[1:]
    if not 10 <= len(digits) <= 15:
        raise ValueError("WhatsApp: escribí el número con código de país, por ejemplo +598 99 123 456")
    return "https://wa.me/" + digits


def normalize_store(payload: dict, existing: dict | None = None) -> tuple[str, dict]:
    if not isinstance(payload, dict):
        raise ValueError("Tienda inválida")
    name = text(payload.get("nombre") or payload.get("name"), 120)
    if not name:
        raise ValueError("El nombre de la tienda es obligatorio")
    current = dict(existing or {})
    networks = {}
    previous_networks = current.get("redes") or {}
    for key in ("instagram", "facebook", "whatsapp", "telegram"):
        raw = payload.get(key, previous_networks.get(key))
        if raw is not None:
            url = safe_url(whatsapp_url(raw) if key == "whatsapp" else raw)
            if url:
                networks[key] = url
            else:
                networks.pop(key, None)
    info = {
        **current,
        "nombre_completo": text(payload.get("nombre_completo") or name, 180),
        "direccion": nullable_text(payload.get("direccion"), 300),
        "telefono": nullable_text(payload.get("telefono"), 80),
        "email": safe_email(payload.get("email")),
        "horario": nullable_text(payload.get("horario"), 300),
        "sitio_web": safe_url(payload.get("sitio_web")),
        "redes": networks,
        "nota": nullable_text(payload.get("nota"), 1000),
        "catalogo_online": bool(payload.get("catalogo_online", current.get("catalogo_online", False))),
        # Studio → Tiendas: hide this store's product photos on the public site (the files are not touched).
        "ocultar_fotos": payload.get("ocultar_fotos", current.get("ocultar_fotos", False)) is True,
        # Studio → Tiendas → Logo: "logo" shows the logo with the name on this store's tags; "nombre" keeps the color tag.
        "logo": safe_image(payload.get("logo")) if "logo" in payload else current.get("logo"),
        "etiqueta": "logo" if payload.get("etiqueta", current.get("etiqueta")) == "logo" else "nombre",
        "color": safe_color(payload.get("color") or current.get("color") or "#B42335"),
        "color_texto": safe_color(payload.get("color_texto") or current.get("color_texto") or "#FFFFFF", "#FFFFFF"),
        "manual": True,
    }
    if info["etiqueta"] == "logo" and not info["logo"]:
        raise ValueError("Para usar el logo en las etiquetas, primero subí el logo de la tienda (o desmarcá la opción).")
    info.update(normalize_profile(payload, current))
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
        "historial_precios": current.get("historial_precios", payload.get("historial_precios", [])) if isinstance(current.get("historial_precios", payload.get("historial_precios", [])), list) else [],
        "creado": created,
        "actualizado_manual": now_iso(),
    }
    result['marca'] = text(payload.get('marca', current.get('marca')), 120)
    result['descripcion'] = text(payload.get('descripcion', current.get('descripcion')), 6000)
    specs = payload.get('especificaciones', current.get('especificaciones', {}))
    if not isinstance(specs, dict) or len(specs)>60:
        raise ValueError('Especificaciones: usá un objeto de hasta 60 campos')
    result['especificaciones'] = {text(k,100):text(v,500) for k,v in specs.items() if text(k,100)}
    return result


def state_payload() -> dict:
    reference = load_reference_stores()
    manual_stores_doc = load_manual_stores()
    products_doc = load_manual_products()
    return {
        "revision": revision(),
        "mode": EDITOR_MODE,
        "project_root": str(PROJECT_ROOT),
        "studio_build": STUDIO_BUILD,
        "base_stores": reference,
        "manual_stores": manual_stores_doc.get("tiendas", {}),
        "stores": {**reference, **manual_stores_doc.get("tiendas", {})},
        "products": [{**p, "imagen": p.get("imagen", "").replace(".contributor-work/assets/", "contributor-assets/")} if isinstance(p.get("imagen"), str) else p for p in products_doc.get("productos", [])],
        "updated": {
            "stores": manual_stores_doc.get("actualizado"),
            "products": products_doc.get("actualizado"),
        },
        "site_config": load_site_config() if EDITOR_MODE == "owner" else None,
        "highlights": load_highlights() if EDITOR_MODE == "owner" else None,
        "health": read_json(HEALTH_PATH, {}) if EDITOR_MODE == "owner" else None,
        "corrections_count": len(load_corrections()["correcciones"]) if EDITOR_MODE == "owner" else 0,
        "meta": read_json(META_PATH, {}) if EDITOR_MODE == "owner" else None,
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


# --- Studio → Catálogo: corrections to the products that come from the stores' websites -------------
# The daily robot rewrites data/products.json, so changes live in data/product-corrections.json, keyed by
# "store|url". The site, the static pages and the database copy apply them on top of the store data.
CORRECTION_FIELDS = ("nombre", "categoria", "imagen", "oculto", "precio_usd", "precio_original_usd", "en_oferta", "precio_base", "precio_fijo")
CATEGORY_RE = re.compile(r"[a-z][a-z0-9-]{1,40}")
_SCRAPED_CACHE: dict = {"key": None, "items": [], "by_key": {}, "index": []}


def corrections_path() -> Path:
    return DATA_DIR / "product-corrections.json"


def load_corrections() -> dict:
    value = read_json(corrections_path(), {})
    if not isinstance(value, dict):
        value = {}
    value.setdefault("version", "initial")
    value.setdefault("actualizado", None)
    if not isinstance(value.get("correcciones"), dict):
        value["correcciones"] = {}
    return value


def fold(value) -> str:
    """Accent- and case-insensitive text for searching: 'Perfúme  DIOR' → 'perfume dior'."""
    value = unicodedata.normalize("NFKD", str(value or "")).encode("ascii", "ignore").decode("ascii").lower()
    return " ".join(re.sub(r"[^a-z0-9]+", " ", value).split())


def scraped_catalog() -> dict:
    """data/products.json (about 35k products), read once and kept until the file changes."""
    path = DATA_DIR / "products.json"
    try:
        stat = path.stat()
        key = (str(path), stat.st_mtime_ns, stat.st_size)
    except OSError:
        key = (str(path), None, None)
    if _SCRAPED_CACHE["key"] != key:
        doc = read_json(path, {})
        items = [p for p in (doc.get("productos") if isinstance(doc, dict) else None) or []
                 if isinstance(p, dict) and isinstance(p.get("tienda"), str) and isinstance(p.get("url"), str) and p.get("url")]
        _SCRAPED_CACHE.update(key=key, items=items,
                              by_key={f"{p['tienda']}|{p['url']}": p for p in items},
                              index=[fold(f"{p.get('nombre', '')} {p['tienda']}") for p in items])
    return _SCRAPED_CACHE


def owner_only() -> None:
    if EDITOR_MODE != "owner":
        raise ValueError("Esta función solo está disponible para el administrador")


def catalog_item(key: str, product: dict | None, correction: dict | None) -> dict:
    product = product or {}
    store, _, url = key.partition("|")
    return {"key": key, "tienda": product.get("tienda", store), "url": product.get("url", url),
            "nombre": product.get("nombre"), "categoria": product.get("categoria"),
            "precio_usd": product.get("precio_usd"), "precio_original_usd": product.get("precio_original_usd"),
            "en_oferta": bool(product.get("en_oferta")), "imagen": product.get("imagen"),
            "missing": not product, "correction": correction,
            "correction_revision": correction_revision(product, correction)}


def correction_revision(product, correction):
    # Include the observed offer: a scraper price change also invalidates the form.
    raw = json.dumps([product or {}, correction], sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(raw.encode('utf-8')).hexdigest()[:24]


def check_correction_revision(payload, product, correction):
    if payload.get('correction_revision') != correction_revision(product, correction):
        raise RuntimeError('Este producto cambió desde que lo abriste. Tus cambios siguen en el formulario. Volvé a buscar el producto y compará los datos antes de guardar.')


def search_catalog(payload: dict) -> dict:
    """Only what was searched: never the whole catalog."""
    owner_only()
    query = fold(payload.get("q"))
    store = text(payload.get("store"), 120)
    only_corrected = payload.get("only_corrected") is True
    limit = max(1, min(int(payload.get("limit") or 60), 100))
    catalog = scraped_catalog()
    corrections = load_corrections()["correcciones"]
    stores = sorted({p["tienda"] for p in catalog["items"]})
    if not query and not store and not only_corrected:
        return {"items": [], "total": 0, "limit": limit, "stores": stores, "corrections_count": len(corrections),
                "message": "Escribí qué producto buscás: nombre, marca o parte del enlace."}
    words = query.split()
    raw_query = text(payload.get("q"), 2000)
    matches = []
    if only_corrected:
        for key, correction in corrections.items():
            product = catalog["by_key"].get(key)
            haystack = fold(f"{(product or {}).get('nombre', '')} {correction.get('nombre', '')} {key}")
            if store and key.partition("|")[0] != store:
                continue
            if all(word in haystack for word in words):
                matches.append((0, haystack, key, product))
    else:
        by_url = raw_query.startswith("http")
        for position, product in enumerate(catalog["items"]):
            if store and product["tienda"] != store:
                continue
            haystack = catalog["index"][position]
            if by_url:
                if raw_query not in product["url"]:
                    continue
                rank = 0
            elif all(word in haystack for word in words):
                rank = 0 if haystack.startswith(query) else 1 if query in haystack else 2
            else:
                continue
            matches.append((rank, haystack, f"{product['tienda']}|{product['url']}", product))
    matches.sort(key=lambda item: (item[0], item[1]))
    items = [catalog_item(key, product, corrections.get(key)) for _, _, key, product in matches[:limit]]
    message = "" if matches else "No hay productos con esa búsqueda."
    if len(matches) > limit:
        message = f"Se muestran {limit} de {len(matches)}. Escribí algo más para afinar la búsqueda."
    return {"items": items, "total": len(matches), "limit": limit, "stores": stores, "corrections_count": len(corrections), "message": message}


def normalize_correction(raw: dict, product: dict) -> dict:
    """Keep only what differs from the store's data; prices remember the store price they replace."""
    if not isinstance(raw, dict):
        raise ValueError("Corrección inválida")
    result = {}
    name = text(raw.get("nombre"), 300)
    if name and name != product.get("nombre"):
        result["nombre"] = name
    category = text(raw.get("categoria"), 41)
    if category:
        if not CATEGORY_RE.fullmatch(category):
            raise ValueError("Categoría inválida")
        result["categoria"] = category
    image = raw.get("imagen")
    if image not in (None, "") and image != product.get("imagen"):
        result["imagen"] = safe_image(image)
    if raw.get("oculto") is True:
        result["oculto"] = True
    if "precio_usd" in raw:
        price = number_or_none(raw.get("precio_usd"), "Precio")
        old = number_or_none(raw.get("precio_original_usd"), "Precio anterior")
        offer = raw.get("en_oferta") is True
        if offer and (price is None or old is None or old <= price):
            raise ValueError("Para mostrar la oferta, el precio anterior tiene que ser mayor que el precio actual.")
        same = (price == product.get("precio_usd") and old == product.get("precio_original_usd")
                and offer == bool(product.get("en_oferta")) and raw.get("precio_fijo") is not True)
        if not same:
            result.update(precio_usd=price, precio_original_usd=old, en_oferta=offer or (price is not None and old is not None and old > price),
                          precio_base=product.get("precio_usd"), precio_fijo=raw.get("precio_fijo") is True)
    return result


def write_corrections(doc: dict) -> None:
    doc["version"] = new_version("corrections")
    doc["actualizado"] = now_iso()
    doc["correcciones"] = dict(sorted(doc["correcciones"].items()))
    atomic_write_json(corrections_path(), doc)


def save_correction(payload: dict) -> dict:
    owner_only()
    key = text(payload.get("key"), 2400)
    with LOCK:
        product = scraped_catalog()["by_key"].get(key)
        if not product:
            raise ValueError("Ese producto ya no está en el catálogo de la tienda. Podés quitar la corrección.")
        correction = normalize_correction(payload.get("correction") or {}, product)
        doc = load_corrections()
        check_correction_revision(payload, product, doc['correcciones'].get(key))
        backup_current()
        if correction:
            correction["actualizado"] = now_iso()
            doc["correcciones"][key] = correction
        else:
            doc["correcciones"].pop(key, None)
        write_corrections(doc)
        return {"item": catalog_item(key, product, doc["correcciones"].get(key)), "corrections_count": len(doc["correcciones"]),
                "message": "Corrección guardada." if correction else "Sin cambios respecto de la tienda: se usa el dato original."}


def delete_correction(payload: dict) -> dict:
    owner_only()
    key = text(payload.get("key"), 2400)
    with LOCK:
        doc = load_corrections()
        if key not in doc["correcciones"]:
            raise ValueError("Ese producto no tiene correcciones")
        product = scraped_catalog()["by_key"].get(key)
        check_correction_revision(payload, product, doc['correcciones'].get(key))
        backup_current()
        doc["correcciones"].pop(key)
        write_corrections(doc)
        product = scraped_catalog()["by_key"].get(key)
        return {"item": catalog_item(key, product, None), "corrections_count": len(doc["correcciones"]),
                "message": "Se volvió a los datos de la tienda."}


def bulk_products(payload: dict) -> dict:
    """Apply one safe bulk action to manual products only."""
    with LOCK:
        check_revision(payload)
        ids = {text(value, 100) for value in (payload.get("ids") or []) if text(value, 100)}
        if not ids:
            raise ValueError("Seleccioná al menos una publicación")
        action = text(payload.get("action"), 30)
        products_doc = load_manual_products()
        matched = [p for p in products_doc["productos"] if text(p.get("id"), 100) in ids]
        if not matched:
            raise ValueError("No se encontraron las publicaciones seleccionadas")
        backup_current()
        stamp = now_iso()
        if action == "delete":
            products_doc["productos"] = [p for p in products_doc["productos"] if text(p.get("id"), 100) not in ids]
        elif action in {"hide", "show"}:
            active = action == "show"
            for product in matched:
                product["activo"] = active
                product["actualizado_manual"] = stamp
        elif action == "category":
            category = text(payload.get("category"), 120)
            if not category:
                raise ValueError("Elegí una categoría")
            for product in matched:
                product["categoria"] = category
                product["actualizado_manual"] = stamp
        else:
            raise ValueError("Acción masiva no válida")
        products_doc["actualizado"] = stamp
        products_doc["version"] = new_version("products")
        atomic_write_json(active_products_path(), products_doc)
        result = state_payload()
        result["bulk_summary"] = {"action": action, "count": len(matched)}
        return result


HEIF_BRANDS = {b"heic", b"heix", b"hevc", b"hevx", b"heim", b"heis", b"hevm", b"hevs", b"mif1", b"msf1"}


def is_heif(content: bytes) -> bool:
    """iPhone photos: an ISO-BMFF 'ftyp' box with a HEIF brand."""
    return len(content) > 12 and content[4:8] == b"ftyp" and content[8:12] in HEIF_BRANDS


def optimize_image(content: bytes) -> tuple[bytes, bytes]:
    if not content or len(content)>MAX_IMAGE_BYTES:
        raise ValueError('La imagen debe pesar menos de 15 MB')
    try:
        from PIL import Image, ImageOps, UnidentifiedImageError
    except ImportError:
        raise ValueError('Falta Pillow. Ejecutá: python -m pip install -r tools/manual_editor/requirements.txt')
    if is_heif(content):
        try:
            from pillow_heif import register_heif_opener
        except ImportError:
            raise ValueError('Para fotos del iPhone (HEIC) falta un complemento. Ejecutá Instalar-dependencias-Studio, '
                             'volvé a abrir Studio y subí la foto otra vez. También podés pasarla a JPG.')
        register_heif_opener()
    try:
        with Image.open(io.BytesIO(content)) as source:
            if source.width * source.height > 50_000_000:
                raise ValueError('La imagen supera 50 megapíxeles')
            if getattr(source, 'is_animated', False):
                raise ValueError('Usá una imagen estática; no se convierten animaciones')
            source.load()
            image = ImageOps.exif_transpose(source).convert('RGBA' if 'A' in source.getbands() or 'transparency' in source.info else 'RGB')
            image.info.clear()
            image.thumbnail((1600, 1600), Image.Resampling.LANCZOS)
            full = io.BytesIO(); image.save(full, format='WEBP', quality=82, method=6)
            image.thumbnail((360, 360), Image.Resampling.LANCZOS)
            thumb = io.BytesIO(); image.save(thumb, format='WEBP', quality=78, method=6)
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise ValueError('El archivo no es una imagen válida o es demasiado grande') from exc
    return full.getvalue(), thumb.getvalue()


def upload_image(payload: dict) -> dict:
    filename = Path(text(payload.get("filename"), 255)).name
    suffix = Path(filename).suffix.lower()
    if suffix not in UPLOAD_IMAGE_EXTENSIONS:
        raise ValueError("Formato de imagen no permitido. Usá JPG, PNG, WEBP, GIF o HEIC (fotos del iPhone).")
    raw_data = text(payload.get("data"), MAX_BODY_BYTES)
    if raw_data.startswith("data:"):
        raw_data = raw_data.split(",", 1)[-1]
    try:
        content = base64.b64decode(raw_data, validate=True)
    except Exception as exc:
        raise ValueError("La imagen no se pudo decodificar") from exc
    if not content or len(content) > MAX_IMAGE_BYTES:
        raise ValueError("La imagen debe pesar menos de 15 MB")
    optimized, thumbnail_bytes = optimize_image(content)
    digest = hashlib.sha256(optimized).hexdigest()[:16]
    safe_name = re.sub(r'[^A-Za-z0-9._-]+', '-', Path(filename).stem).strip('-._')[:50] or 'imagen'
    with LOCK:
        asset_dir = guarded_path(active_asset_dir()); asset_dir.mkdir(parents=True, exist_ok=True)
        target = asset_dir / f'{safe_name}-{digest}.webp'
        thumbnail = asset_dir / f'{safe_name}-{digest}-thumb.webp'
        for path, raw in [(target, optimized), (thumbnail, thumbnail_bytes)]:
            guarded_path(path); temporary = guarded_path(path.with_suffix('.tmp')); temporary.write_bytes(raw); temporary.replace(path)
    return {'path': ('contributor-assets/'+target.name) if EDITOR_MODE=='contributor' else target.relative_to(PROJECT_ROOT).as_posix(),
            'thumbnail': ('contributor-assets/'+thumbnail.name) if EDITOR_MODE=='contributor' else thumbnail.relative_to(PROJECT_ROOT).as_posix(),
            'original_bytes': len(content), 'bytes': len(optimized)}


def normalize_import_store(name: str, info: dict) -> tuple[str, dict]:
    payload = dict(info or {})
    payload["nombre"] = name
    for key in ("instagram", "facebook", "whatsapp", "telegram"):
        if key not in payload and isinstance(payload.get("redes"), dict):
            payload[key] = payload["redes"].get(key)
    return normalize_store(payload)


def import_data(payload: dict) -> dict:
    with LOCK:
        check_revision(payload)
        mode = text(payload.get("mode") or "merge", 20)
        if mode not in {"merge", "replace"}: raise ValueError("Modo de importación inválido")
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
        positions = {p.get("id"):i for i,p in enumerate(normalized_products)}
        for row_number, item in enumerate(products_in, 2):
            if not isinstance(item, dict):
                continue
            store_name = text(item.get("tienda"), 120)
            if store_name and store_name not in known:
                auto_name, auto_info = normalize_store({"nombre": store_name, "color": "#B42335"})
                current_stores[auto_name] = auto_info; known.add(auto_name)
            item = dict(item)
            if not re.fullmatch(r'manual-[A-Za-z0-9_-]+',str(item.get('id',''))):
                identity = str(item.get('id') or item.get('url') or item.get('nombre') or '').strip()
                item['id'] = 'manual-import-' + hashlib.sha256((store_name+'|'+identity).encode()).hexdigest()[:24]
            existing = by_id.get(item.get('id'))
            try: normalized = normalize_product(item, existing, known)
            except ValueError as error: raise ValueError(f'Fila {row_number}: {error}') from error
            identifier=normalized['id']
            if identifier in positions: normalized_products[positions[identifier]]=normalized
            else:
                positions[identifier]=len(normalized_products)
                normalized_products.append(normalized)
            by_id[identifier]=normalized
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
        "products": [{**p, "imagen": p.get("imagen", "").replace(".contributor-work/assets/", "contributor-assets/")} if isinstance(p.get("imagen"), str) else p for p in products_doc.get("productos", [])],
    }


def export_zip() -> bytes:
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as archive:
        paths = [active_products_path(), active_stores_path()]
        if EDITOR_MODE == "owner": paths += [SITE_CONFIG_PATH, HIGHLIGHTS_PATH]
        for path in paths:
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
        if EDITOR_MODE == "owner" and ASSET_DIR.exists():
            already = set(archive.namelist())
            for resolved in ASSET_DIR.rglob("*"):
                if resolved.is_file():
                    relative = resolved.relative_to(PROJECT_ROOT).as_posix()
                    if relative not in already:
                        archive.write(resolved, relative)
                        already.add(relative)
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
    seen = set()
    for info in infos:
        name = info.filename.replace("\\", "/")
        parts = Path(name).parts
        if name.startswith("/") or ".." in parts:
            raise ValueError("El paquete contiene una ruta no permitida")
        if name in seen or any(part.startswith('.') or ':' in part for part in parts) or ((info.external_attr >> 16) & 0o170000)==0o120000:
            raise ValueError('El paquete contiene rutas duplicadas o enlaces')
        seen.add(name)
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
        if isinstance(image, str) and image.startswith((".contributor-work/assets/", "contributor-assets/")):
            path = (CONTRIB_ASSET_DIR / Path(image).name) if image.startswith("contributor-assets/") else PROJECT_ROOT / image
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


TRUSTED_SOURCE_HOSTS = ("instagram.com", "facebook.com", "fb.com", "wa.me", "whatsapp.com", "t.me", "tiktok.com", "youtube.com")


def _link_host(value: str) -> str:
    try:
        return (urlparse(value).hostname or "").lower().removeprefix("www.")
    except ValueError:
        return ""


def _contribution_links(info: dict) -> list:
    values = [("Sitio web", info.get("sitio_web")), ("Email", info.get("email"))]
    redes = info.get("redes") if isinstance(info.get("redes"), dict) else {}
    values += [(key.capitalize(), redes.get(key)) for key in ("instagram", "facebook", "whatsapp", "telegram")]
    return [{"label": label, "url": text(value, 600), "host": _link_host(text(value, 600)) or text(value, 120)} for label, value in values if isinstance(value, str) and value.strip()]


def _unexpected_link(links: list, store_info: dict) -> str:
    """A product link outside the store's own site and the usual social networks deserves a look before importing."""
    site = _link_host(store_info.get("sitio_web") or "") if isinstance(store_info, dict) else ""
    for link in links:
        host = link["host"]
        if not host:
            continue
        own = site and (host == site or host.endswith("." + site))
        social = any(host == h or host.endswith("." + h) for h in TRUSTED_SOURCE_HOSTS)
        if not own and not social:
            return f"Revisá el enlace: lleva a {host}" + (f", no a {site}" if site else "")
    return ""


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
        info = info if isinstance(info, dict) else {}
        stores_preview.append({
            "name": clean,
            "status": "existing" if exists else "new",
            "selected": not exists,
            "color": safe_color(info.get("color")),
            # Every link the package would publish, shown as text so the owner can spot a fake site.
            "links": _contribution_links(info),
        })
    products_preview = []
    for item in manifest.get("products") or []:
        if not isinstance(item, dict):
            continue
        reason = _duplicate_reason(item, current_products)
        store_name = text(item.get("tienda"), 120)
        store_info = current_stores.get(store_name) or (stores_in.get(store_name) if isinstance(stores_in.get(store_name), dict) else {}) or {}
        links = [(label, text(item.get(key), 600)) for key, label in (("url", "Publicación"), ("fuente_url", "Fuente"), ("imagen", "Imagen"))]
        links = [{"label": label, "url": value, "host": _link_host(value)} for label, value in links if value]
        warning = _unexpected_link(links[:2], store_info)
        products_preview.append({
            "id": text(item.get("id"), 100) or "sin-id",
            "name": text(item.get("nombre"), 300) or "Producto sin nombre",
            "store": store_name,
            "category": text(item.get("categoria"), 120) or "otros",
            "price": item.get("precio_usd"),
            "source": text(item.get("fuente_tipo"), 30) or "manual",
            "status": "possible_duplicate" if reason else ("check_link" if warning else "new"),
            "reason": reason or warning,
            "links": links,
            # Products pointing somewhere unexpected stay unticked: the owner has to look and decide.
            "selected": not bool(reason or warning),
        })
    preview_id = "preview-" + uuid.uuid4().hex
    CONTRIBUTION_PREVIEWS[preview_id] = {"manifest": manifest, "assets": assets, "created": time.time()}
    for key in list(CONTRIBUTION_PREVIEWS):
        if key != preview_id and (len(CONTRIBUTION_PREVIEWS) > 3 or time.time() - CONTRIBUTION_PREVIEWS[key].get("created", 0) > 600):
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
    try:
        optimized, _ = optimize_image(raw)
    except ValueError:
        return None
    digest = hashlib.sha256(optimized).hexdigest()[:16]
    stem = re.sub(r"[^A-Za-z0-9._-]+", "-", Path(package_path).stem).strip("-._")[:50] or "aporte"
    guarded_path(ASSET_DIR).mkdir(parents=True, exist_ok=True)
    target = ASSET_DIR / f"{stem}-{digest}.webp"
    guarded_path(target)
    temporary = guarded_path(target.with_suffix('.tmp'))
    temporary.write_bytes(optimized); temporary.replace(target)
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
    def end_headers(self):
        # Studio local: nunca reutilizar HTML/CSS/JS de otra versión.
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("X-Frame-Options", "SAMEORIGIN")
        self.send_header("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data: blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'; form-action 'none'")
        self.send_header("Expires", "0")
        self.send_header("X-RivFree-Studio-Build", STUDIO_BUILD)
        super().end_headers()

    server_version = "RivFreeManualEditor/1.0"
    sys_version = ""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(PROJECT_ROOT), **kwargs)

    def setup(self):
        super().setup()
        self.connection.settimeout(30)

    def parse_request(self):
        if not super().parse_request(): return False
        hosts = self.headers.get_all('Host', [])
        allowed = {f'127.0.0.1:{self.server.server_port}', f'localhost:{self.server.server_port}'}
        if len(hosts)!=1 or hosts[0] not in allowed:
            self._error(403, 'Host no permitido'); return False
        origin = self.headers.get('Origin')
        if origin and origin != 'http://' + hosts[0]:
            self._error(403, 'Origen no permitido'); return False
        if self.headers.get('Sec-Fetch-Site') == 'cross-site':
            self._error(403, 'Origen no permitido'); return False
        return True

    def log_message(self, fmt, *args):
        message = re.sub(r'([?&#]token=)[^&\s"]+', r'\1[redacted]', fmt % args)
        print('[editor]', maintenance.redact(message))

    def _authorized(self) -> bool:
        header = self.headers.get('X-RivFree-Editor-Token', '')
        return hmac.compare_digest(header.encode('utf-8'), SESSION_TOKEN.encode('utf-8'))

    def list_directory(self, path):
        self.send_error(404, 'No encontrado'); return None

    def send_head(self):
        raw = urlparse(self.path).path
        path = unquote(raw)
        parts = Path(path.lstrip('/')).parts
        if '\\' in path or '%' in path or any(p.startswith('.') for p in parts):
            self.send_error(404, 'No encontrado'); return None
        relative = '/'.join(parts)
        public_data = {'stores.json','manual-stores.json','manual-products.json','products.json','meta.json','exchange.json','highlights.json','popular.json','site-config.json','price-history.json','product-corrections.json'}
        allowed = (not relative or relative=='index.html' or
            (len(parts)==1 and (Path(relative).suffix in {'.js','.css'} or relative in {'privacy.html','cookies.html','terms.html','manifest.webmanifest','social-card.png','robots.txt','sitemap.xml'})) or
            (parts[:2]==('tools','manual_editor') and (len(parts)==2 or (len(parts)==3 and Path(relative).suffix in {'.html','.css','.js'}))) or
            (len(parts)==2 and parts[0]=='politicas' and parts[1] in {'privacidad.txt','cookies.txt','terminos.txt'}) or
            (len(parts)==2 and parts[0]=='data' and parts[1] in public_data) or
            (len(parts)==3 and parts[0]=='data' and parts[1] in {'products','price-history'} and Path(relative).suffix=='.json') or
            (parts and parts[0] in {'assets','icons'} and Path(relative).suffix.lower() in {'.png','.jpg','.jpeg','.webp','.gif','.svg','.ico'}))
        if parts and parts[0]=='contributor-assets' and len(parts)==2 and EDITOR_MODE=='contributor' and Path(relative).suffix.lower() in ALLOWED_IMAGE_EXTENSIONS:
            target=CONTRIB_ASSET_DIR / parts[1]
            if target.is_symlink() or not target.resolve().is_relative_to(CONTRIB_ASSET_DIR.resolve()) or not target.is_file():
                self.send_error(404); return None
            stream=target.open('rb');self.send_response(200);self.send_header('Content-Type',self.guess_type(str(target)));self.send_header('Content-Length',str(target.stat().st_size));self.end_headers();return stream
        target=PROJECT_ROOT / relative
        if not allowed or not target.resolve().is_relative_to(PROJECT_ROOT.resolve()) or any((PROJECT_ROOT / Path(*parts[:i])).is_symlink() for i in range(1,len(parts)+1)):
            self.send_error(404, 'No encontrado'); return None
        return super().send_head()

    def _json(self, value, status=200):
        raw = json.dumps(maintenance.redact_value(value), ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers(); self.wfile.write(raw)

    def _error(self, status, message):
        self._json({"error": str(message)}, status)

    def _body(self) -> dict:
        if self.headers.get("Transfer-Encoding") or len(self.headers.get_all("Content-Length", []))!=1:
            raise ValueError("Formato de solicitud inválido")
        if self.headers.get_content_type() != "application/json":
            raise ValueError("Se requiere application/json")
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
                return self._error(403, SESSION_EXPIRED)
            if parsed.path == "/api/manual/catalog":
                query=text(parse_qs(parsed.query).get('q',[''])[0],120).casefold()
                if len(query)<2: return self._json({'products':[]})
                catalog = scraped_catalog()
                words = fold(query).split()
                found=[]
                for product, indexed in zip(catalog['items'], catalog['index']):
                    if all(term in indexed for term in words):
                        found.append(product)
                        if len(found) == 50: break
                return self._json({'products':found})
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
            return self._error(403, SESSION_EXPIRED)
        origin = self.headers.get("Origin")
        if origin:
            host = urlparse(origin).hostname
            if host not in {"127.0.0.1", "localhost"}:
                return self._error(403, "Origen no permitido")
        try:
            payload = self._body()
            actions = {
                "/api/manual/publish": lambda p: maintenance.publish(sys.modules[__name__], p),
                "/api/manual/backups": lambda p: maintenance.backups(sys.modules[__name__], p),
                "/api/manual/orphans": lambda p: maintenance.orphans(sys.modules[__name__], p),
                "/api/manual/save-store": save_store,
                "/api/manual/delete-store": delete_store,
                "/api/manual/save-product": save_product,
                "/api/manual/delete-product": delete_product,
                "/api/manual/bulk-products": bulk_products,
                "/api/manual/upload-image": upload_image,
                "/api/manual/import": import_data,
                "/api/manual/preview-contribution": preview_contribution,
                "/api/manual/apply-contribution": apply_contribution,
                "/api/manual/reset-contribution": reset_contribution,
                "/api/manual/save-site-config": save_site_config,
                "/api/manual/db-state": db_state,
                "/api/manual/db-test": db_test,
                "/api/manual/db-save": db_save,
                "/api/manual/db-sync": db_sync,
                "/api/manual/db-forget": db_forget,
                "/api/manual/save-highlights": save_highlights,
                "/api/manual/catalog-search": search_catalog,
                "/api/manual/save-correction": save_correction,
                "/api/manual/delete-correction": delete_correction,
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
            # Keep the details in the Studio window (without tokens or passwords) to diagnose it later.
            print("[editor] Error interno en " + maintenance.redact(self.path.split("?")[0]) + ": " +
                  maintenance.redact("".join(traceback.format_exception(type(exc), exc, exc.__traceback__))[-4000:]), file=sys.stderr, flush=True)
            return self._error(500, "Error interno: no se pudo completar la operación. El detalle quedó en la ventana de Studio; tus datos guardados no cambiaron.")


def main():
    parser = argparse.ArgumentParser(description="RivFree Studio · editor visual y de catálogo")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--open", action="store_true", dest="open_browser")
    parser.add_argument("--mode", choices=("owner", "contributor"), default="owner")
    args = parser.parse_args()
    global EDITOR_MODE
    EDITOR_MODE = args.mode
    ensure_files()
    try:
        server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    except OSError as exc:
        if exc.errno in (errno.EADDRINUSE, 10048):
            print(f"\nEl puerto {args.port} ya está en uso: Studio probablemente ya está abierto.\n"
                  "Buscá su ventana o pestaña del navegador. Si no la encontrás, cerrá las ventanas de Studio y volvé a abrirlo.\n"
                  f"También podés usar otro puerto, por ejemplo: --port {args.port + 1}", file=sys.stderr)
            raise SystemExit(1)
        raise
    url = f"http://127.0.0.1:{args.port}/tools/manual_editor/?mode={EDITOR_MODE}#token={SESSION_TOKEN}"
    print("\nRivFree · " + ("Cargador colaborador" if EDITOR_MODE == "contributor" else "Studio"))
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
