"""Repara URLs de Yury existentes sin cambiar precios ni fechas de scraping."""
import hashlib
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scrapers.utils import normalize_wix_image_url
from scrapers.publish_data import write_json


def repair(data_dir):
    data_dir = Path(data_dir)
    counts = {}
    for filename in ("yurys.json", "products.json"):
        path = data_dir / filename
        data = json.loads(path.read_text(encoding="utf-8"))
        rows = data if isinstance(data, list) else data["productos"]
        changed = 0
        for product in rows:
            if product.get("tienda") != "Yury's Free Shop":
                continue
            old = product.get("imagen")
            new = normalize_wix_image_url(old)
            if new != old:
                product["imagen"] = new
                changed += 1
        if changed:
            write_json(path, data)
        counts[filename] = changed
    # Siempre recalcular: una interrupción tras escribir products.json debe
    # poder recuperarse al ejecutar otra vez esta herramienta.
    meta_path = data_dir / "meta.json"
    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    version = hashlib.sha256((data_dir / "products.json").read_bytes()).hexdigest()[:20]
    if meta.get("version") != version:
        meta["version"] = version
        write_json(meta_path, meta)
    return counts


if __name__ == "__main__":
    print(repair(Path(__file__).resolve().parents[1] / "data"))
