#!/usr/bin/env python3
"""Pack a downloaded Transactional probe folder into canonical + serve trees.

Does not upload. Does not write GitHub data/. Does not copy transactionToken.
Typical input: Downloads/.../nearmap-probe/phase3b (Vert/N/E/S/W + DSM + AI).

  python tools/nearmap/pack_tx_folder.py --src ".../phase3b" --address "410 SW Columbia St, Bend, OR 97702"
"""
from __future__ import annotations

import argparse
import json
import math
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from normalize import (  # noqa: E402
    BEDROCK_LONG_EDGE,
    CF_BASE,
    cap_long_edge,
    pack_ai,
    save_jpeg,
    slugify,
    write_regions_pair,
)
from PIL import Image


def parse_tfw(path: Path) -> tuple[float, float, float, float]:
    a, d, b, e, c, f = [float(x) for x in path.read_text(encoding="utf-8").split()]
    return a, d, b, e, c, f


def merc_to_lonlat(x: float, y: float) -> tuple[float, float]:
    lon = x / 6378137.0 * 180.0 / math.pi
    lat = (2 * math.atan(math.exp(y / 6378137.0)) - math.pi / 2) * 180.0 / math.pi
    return lon, lat


def bounds_from_tfw(tfw: Path, w: int, h: int) -> dict:
    a, d, b, e, c, f = parse_tfw(tfw)
    west_m = c - a / 2.0
    north_m = f - e / 2.0
    east_m = west_m + w * a
    south_m = north_m + h * e
    sw = merc_to_lonlat(west_m, south_m)
    ne = merc_to_lonlat(east_m, north_m)
    return {
        "west": sw[0],
        "south": sw[1],
        "east": ne[0],
        "north": ne[1],
    }


def wrap_api_features(body: dict) -> dict:
    feats = []
    for f in body.get("features") or []:
        props = {
            "description": f.get("description"),
            "confidence": f.get("confidence"),
            "clippedAreaSqm": f.get("clippedAreaSqm"),
            "areaSqm": f.get("areaSqm"),
            "attributes": f.get("attributes") or [],
            "systemVersion": body.get("systemVersion"),
        }
        feats.append({
            "type": "Feature",
            "id": f.get("id"),
            "geometry": f.get("geometry"),
            "properties": props,
        })
    return {"type": "FeatureCollection", "features": feats}


class MemFS:
    def __init__(self, blob: bytes):
        self.blob = blob

    def read(self, _path: str) -> bytes:
        return self.blob


def copy_look(src: Path, dest_dir: Path, serve: Path, name: str) -> None:
    dest_dir.mkdir(parents=True, exist_ok=True)
    im = Image.open(src)
    jpeg_name = name.lower() + ".jpg"
    save_jpeg(im, dest_dir / jpeg_name)
    save_jpeg(im, serve / jpeg_name)
    if name.lower() == "vert":
        save_jpeg(cap_long_edge(im, BEDROCK_LONG_EDGE), serve / "vert-p1.jpg")
        save_jpeg(cap_long_edge(im, BEDROCK_LONG_EDGE), dest_dir / "vert-p1.jpg")
    tfw = src.with_suffix(".tfw")
    if tfw.is_file():
        shutil.copy2(tfw, dest_dir / (name.lower() + ".tfw"))


def merge_local_index(root: Path, manifest: dict) -> None:
    path = root / "index.json"
    if path.is_file():
        try:
            idx = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            idx = {"version": 1, "deliveries": []}
    else:
        idx = {"version": 1, "deliveries": []}
    did = manifest["delivery_id"]
    others = [d for d in (idx.get("deliveries") or []) if d.get("delivery_id") != did]
    others.append({
        "delivery_id": did,
        "address": manifest.get("address"),
        "source": manifest.get("source"),
        "survey_date": manifest.get("survey_date"),
        "bounds": manifest.get("bounds"),
        "site_no": manifest.get("site_no"),
        "hint_count": manifest.get("hint_count"),
        "ai_counts": manifest.get("ai_counts") or {},
        "urls": manifest.get("urls") or {},
        "normalized_at": manifest.get("normalized_at"),
    })
    others.sort(key=lambda d: d.get("delivery_id") or "")
    out = {
        "version": 1,
        "updated": datetime.now(timezone.utc).isoformat(),
        "deliveries": others,
    }
    path.write_text(json.dumps(out, indent=2), encoding="utf-8")


def pack(src: Path, address: str, out_root: Path, serve_root: Path) -> dict:
    delivery_id = slugify(address)
    canon = out_root / delivery_id / "canonical"
    serve = serve_root / delivery_id
    serve.mkdir(parents=True, exist_ok=True)
    (canon / "ai" / "raw").mkdir(parents=True, exist_ok=True)
    (canon / "imagery").mkdir(parents=True, exist_ok=True)
    (canon / "elevation").mkdir(parents=True, exist_ok=True)

    vert = src / "Vert_x0_y0.jpg"
    if not vert.is_file():
        raise SystemExit(f"missing {vert}")
    im = Image.open(vert)
    vw, vh = im.size
    copy_look(vert, canon / "imagery" / "vert", serve, "vert")
    tfw = src / "Vert_x0_y0.tfw"
    bounds = bounds_from_tfw(tfw, vw, vh) if tfw.is_file() else None
    gsd_m = parse_tfw(tfw)[0] if tfw.is_file() else None

    for look in ("North", "East", "South", "West"):
        jp = src / f"{look}_x0_y0.jpg"
        if jp.is_file():
            copy_look(jp, canon / "imagery" / look.lower(), serve, look)

    dsm = src / "DetailDsm_x0_y0.tif"
    if dsm.is_file():
        shutil.copy2(dsm, canon / "elevation" / "dsm.tif")
        dtfw = src / "DetailDsm_x0_y0.tfw"
        if dtfw.is_file():
            shutil.copy2(dtfw, canon / "elevation" / "dsm.tfw")
    ortho = src / "TrueOrtho_x0_y0.tif"
    if ortho.is_file():
        dest = canon / "imagery" / "trueortho"
        dest.mkdir(parents=True, exist_ok=True)
        shutil.copy2(ortho, dest / "trueortho.tif")
        otfw = src / "TrueOrtho_x0_y0.tfw"
        if otfw.is_file():
            shutil.copy2(otfw, dest / "trueortho.tfw")

    ai_path = src / "ai_features.json"
    if not ai_path.is_file():
        raise SystemExit(f"missing {ai_path}")
    body = json.loads(ai_path.read_text(encoding="utf-8"))
    survey_date = str(body.get("surveyDate") or "unknown")
    raw_dest = canon / "ai" / "raw" / "features.json"
    raw_dest.write_text(json.dumps(body, indent=2), encoding="utf-8")
    wrapped = wrap_api_features(body)
    blob = json.dumps(wrapped).encode("utf-8")
    reduced = pack_ai(MemFS(blob), ["features.json"], survey_date)
    (canon / "ai" / "features.json").write_text(json.dumps(reduced, indent=2), encoding="utf-8")
    write_regions_pair(canon / "ai", reduced)
    (serve / "ai").mkdir(parents=True, exist_ok=True)
    (serve / "ai" / "features.json").write_text(json.dumps(reduced, indent=2), encoding="utf-8")
    hints_doc = {"counts": reduced.get("counts") or {}, "hints": reduced.get("hints") or []}
    (serve / "ai" / "hints.json").write_text(json.dumps(hints_doc, indent=2), encoding="utf-8")
    write_regions_pair(serve / "ai", reduced)

    preview = src / "final_preview.json"
    if preview.is_file():
        shutil.copy2(preview, canon / "tx-preview.json")
    txn = src / "transaction.json"
    if txn.is_file():
        cov = json.loads(txn.read_text(encoding="utf-8"))
        cov.pop("transactionToken", None)
        (canon / "tx-coverage.json").write_text(json.dumps(cov, indent=2), encoding="utf-8")

    base = f"{CF_BASE}/nearmap/{delivery_id}"
    urls = {
        "manifest": f"{base}/manifest.json",
        "vert": f"{base}/vert.jpg",
        "vert_p1": f"{base}/vert-p1.jpg",
        "north": f"{base}/north.jpg",
        "east": f"{base}/east.jpg",
        "south": f"{base}/south.jpg",
        "west": f"{base}/west.jpg",
        "ai": f"{base}/ai/features.json",
        "ai_hints": f"{base}/ai/hints.json",
        "ai_original": f"{base}/ai/original/regions.json",
        "ai_edits": f"{base}/ai/edits/regions.json",
    }
    manifest = {
        "delivery_id": delivery_id,
        "address": address,
        "source": "api",
        "survey_date": survey_date,
        "crs": "EPSG:3857",
        "bounds": bounds,
        "gsd_m": gsd_m,
        "vert_px": {"w": vw, "h": vh},
        "site_no": None,
        "ai_counts": reduced.get("counts") or {},
        "hint_count": len(reduced.get("hints") or []),
        "urls": urls,
        "normalized_at": datetime.now(timezone.utc).isoformat(),
        "layers": reduced.get("layers") or [],
    }
    (canon / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    (serve / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    merge_local_index(out_root, manifest)
    merge_local_index(serve_root, manifest)
    print(
        "OK", delivery_id,
        "bounds", bounds,
        "hints", manifest["hint_count"],
        "classes", len(manifest["ai_counts"]),
    )
    return manifest


def main() -> int:
    ap = argparse.ArgumentParser(description="Pack Nearmap TX probe folder to canonical + serve")
    ap.add_argument("--src", required=True)
    ap.add_argument("--address", required=True)
    ap.add_argument("--out", default="tmp/nearmap-canonical")
    ap.add_argument("--serve-out", default="tmp/nearmap-serve")
    args = ap.parse_args()
    src = Path(args.src)
    if not src.is_dir():
        raise SystemExit(f"src not found: {src}")
    pack(src, args.address, Path(args.out), Path(args.serve_out))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
