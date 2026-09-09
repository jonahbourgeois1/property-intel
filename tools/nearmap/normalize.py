#!/usr/bin/env python3
"""Normalize a Nearmap vendor zip (Transactional API and/or MapBrowser 3D)
into the canonical tree from docs/NEARMAP_CONTRACT.md.

Does not upload. Does not write GitHub data/. Serving subset goes to --serve-out
(JPEG stills + reduced AI + manifest). Uncompressed merged_Vert is never copied
to --serve-out.
"""
from __future__ import annotations

import argparse
import io
import json
import math
import re
import zipfile
import xml.etree.ElementTree as ET
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image

CF_BASE = "https://d3fg47bqswi0rr.cloudfront.net"
SERVE_LONG_EDGE = 4096
BEDROCK_LONG_EDGE = 1600  # Pass 1; 4096 JPEG base64 exceeds Bedrock 5 MB
JPEG_QUALITY = 85

KEEP_CLASSES = {
    "Building",
    "Roof",
    "Driveway",
    "AC Condenser Unit",
    "A/C Condenser Unit",
    "Solar Panel",
    "Swimming Pool",
    "Residential Chimney",
    "Skylight",
    "Woody Vegetation",
}
DROP_CLASS_SUBSTR = (
    "deprecated",
    "medium_and_high_vegetation",
    "medium and high vegetation",
)
PRIORITY_CLASSES = [
    "Building",
    "Roof",
    "Solar Panel",
    "Swimming Pool",
    "AC Condenser Unit",
    "A/C Condenser Unit",
    "Residential Chimney",
    "Skylight",
    "Driveway",
    "Woody Vegetation",
]


def slugify(s: str) -> str:
    s = (s or "").lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


def merc_to_lonlat(x: float, y: float) -> tuple[float, float]:
    lon = x / 6378137.0 * 180.0 / math.pi
    lat = (2 * math.atan(math.exp(y / 6378137.0)) - math.pi / 2) * 180.0 / math.pi
    return lon, lat


def parse_vrt(text: str) -> dict:
    root = ET.fromstring(text)
    w = int(root.attrib["rasterXSize"])
    h = int(root.attrib["rasterYSize"])
    gt = [float(x) for x in root.find("GeoTransform").text.split(",")]
    xmin, ymax = gt[0], gt[3]
    xmax = xmin + w * gt[1]
    ymin = ymax + h * gt[5]
    sw = merc_to_lonlat(xmin, ymin)
    ne = merc_to_lonlat(xmax, ymax)
    sources = []
    seen = set()
    for src in root.findall(".//SimpleSource"):
        fn = src.findtext("SourceFilename")
        if not fn or fn in seen:
            continue
        seen.add(fn)
        dst = src.find("DstRect")
        sources.append({
            "file": fn,
            "xoff": int(float(dst.attrib["xOff"])) if dst is not None else 0,
            "yoff": int(float(dst.attrib["yOff"])) if dst is not None else 0,
        })
    return {
        "w": w,
        "h": h,
        "bounds": {
            "west": sw[0],
            "south": sw[1],
            "east": ne[0],
            "north": ne[1],
        },
        "gsd_m": abs(gt[1]),
        "sources": sources,
    }


def delivery_id_from_folder(name: str) -> str:
    # 18775_Macalpine_Loop__Bend_OR_97702 -> 18775-macalpine-loop-bend-or-97702
    return slugify(name.replace("__", "_"))


def address_from_folder(name: str) -> str:
    parts = name.replace("__", ", ").replace("_", " ")
    return re.sub(r"\s+", " ", parts).strip()


class ZipFS:
    def __init__(self, zpath: Path):
        self.z = zipfile.ZipFile(zpath)

    def names(self) -> list[str]:
        return [n.replace("\\", "/") for n in self.z.namelist()]

    def read(self, name: str) -> bytes:
        return self.z.read(name)

    def close(self):
        self.z.close()


def class_from_ai_name(fn: str) -> str:
    m = re.search(r"ai_features_\d{4}-\d{2}-\d{2}_(.+)_[0-9a-f-]{36}\.geojson$", fn, re.I)
    raw = m.group(1) if m else Path(fn).stem
    raw = raw.replace("_truncated", "")
    return raw.replace("_", " ")


def drop_class(desc: str) -> bool:
    d = (desc or "").lower()
    if "deprecated" in d:
        return True
    if "medium and high vegetation" in d:
        return True
    return False


def keep_class(desc: str) -> bool:
    if drop_class(desc):
        return False
    for k in KEEP_CLASSES:
        if desc.lower() == k.lower():
            return True
    if "woody vegetation" in desc.lower() and "medium" not in desc.lower():
        return True
    return False


def centroid_lonlat(geom: dict) -> tuple[float, float] | None:
    if not geom:
        return None
    t = geom.get("type")
    coords = geom.get("coordinates")
    if not coords:
        return None
    ring = None
    if t == "Polygon":
        ring = coords[0]
    elif t == "MultiPolygon":
        ring = coords[0][0]
    if not ring:
        return None
    xs = [p[0] for p in ring if isinstance(p, (list, tuple)) and len(p) >= 2]
    ys = [p[1] for p in ring if isinstance(p, (list, tuple)) and len(p) >= 2]
    if not xs:
        return None
    return sum(xs) / len(xs), sum(ys) / len(ys)


def mosaic_from_vrt(fs: ZipFS, prefix: str, vrt: dict, long_edge: int) -> Image.Image:
    canvas = Image.new("RGB", (vrt["w"], vrt["h"]), (0, 0, 0))
    for src in vrt["sources"]:
        data = fs.read(prefix + src["file"])
        tile = Image.open(io.BytesIO(data)).convert("RGB")
        canvas.paste(tile, (src["xoff"], src["yoff"]))
        tile.close()
    w, h = canvas.size
    m = max(w, h)
    if m > long_edge:
        scale = long_edge / m
        canvas = canvas.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.Resampling.LANCZOS)
    return canvas


def mosaic_oblique(fs: ZipFS, files: list[tuple[str, int]]) -> Image.Image | None:
    """files: (zip path, size) sorted. Single tile or 2x2-ish from names *_r_c.tiff."""
    if not files:
        return None
    if len(files) == 1:
        im = Image.open(io.BytesIO(fs.read(files[0][0]))).convert("RGB")
        return cap_long_edge(im, SERVE_LONG_EDGE)
    cells = []
    max_r = max_c = 0
    for path, _ in files:
        m = re.search(r"_(\d+)_(\d+)\.tiff?$", path, re.I)
        # Nearmap tile names are {Look}_{date}_{col}_{row}.tiff (same as Vert VRT).
        c = int(m.group(1)) if m else 0
        r = int(m.group(2)) if m else 0
        im = Image.open(io.BytesIO(fs.read(path))).convert("RGB")
        cells.append((r, c, im))
        max_r = max(max_r, r)
        max_c = max(max_c, c)
    # row/col in Nearmap names is Vert_date_COL_ROW in some dumps; use max dims
    widths = defaultdict(int)
    heights = defaultdict(int)
    for r, c, im in cells:
        widths[c] = max(widths[c], im.size[0])
        heights[r] = max(heights[r], im.size[1])
    # If indexing looks swapped, still paste by (c, r) as x,y
    total_w = sum(widths[c] for c in range(max_c + 1))
    total_h = sum(heights[r] for r in range(max_r + 1))
    if total_w == 0 or total_h == 0:
        return cap_long_edge(cells[0][2], SERVE_LONG_EDGE)
    canvas = Image.new("RGB", (total_w, total_h), (0, 0, 0))
    x_off = {}
    acc = 0
    for c in range(max_c + 1):
        x_off[c] = acc
        acc += widths[c]
    y_off = {}
    acc = 0
    for r in range(max_r + 1):
        y_off[r] = acc
        acc += heights[r]
    for r, c, im in cells:
        canvas.paste(im, (x_off[c], y_off[r]))
    return cap_long_edge(canvas, SERVE_LONG_EDGE)


def cap_long_edge(im: Image.Image, long_edge: int) -> Image.Image:
    w, h = im.size
    m = max(w, h)
    if m <= long_edge:
        return im
    scale = long_edge / m
    return im.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.Resampling.LANCZOS)


def save_jpeg(im: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    im.convert("RGB").save(path, "JPEG", quality=JPEG_QUALITY, optimize=True)


def pack_ai(fs: ZipFS, ai_files: list[str], survey_date: str) -> dict:
    """Every vendor class, full geometries. No caps. Bedrock hints are separate."""
    counts = defaultdict(int)
    fc_features = []
    hint_rows = []
    system_version = None
    for path in ai_files:
        raw = json.loads(fs.read(path).decode("utf-8"))
        desc_default = class_from_ai_name(path)
        for feat in raw.get("features") or []:
            props = feat.get("properties") or {}
            desc = str(props.get("description") or desc_default)
            geom = feat.get("geometry")
            if not geom:
                continue
            counts[desc] += 1
            if system_version is None:
                system_version = props.get("systemVersion")
            out_props = {
                "class": desc,
                "confidence": props.get("confidence"),
                "area_sqm": props.get("clippedAreaSqm") or props.get("areaSqm"),
                "origin": "vendor",
            }
            attrs = props.get("attributes") or []
            if attrs:
                out_props["attributes"] = attrs
            fid = f"r{len(fc_features) + 1}"
            fc_features.append({
                "type": "Feature",
                "id": fid,
                "geometry": geom,
                "properties": out_props,
            })
            cxy = centroid_lonlat(geom)
            hint_rows.append({
                "class": desc,
                "confidence": props.get("confidence"),
                "lon": cxy[0] if cxy else None,
                "lat": cxy[1] if cxy else None,
                "area_sqm": out_props["area_sqm"],
            })
    layers = [{"name": k, "count": counts[k]} for k in sorted(counts)]
    hint_rows.sort(key=lambda h: (
        PRIORITY_CLASSES.index(h["class"]) if h["class"] in PRIORITY_CLASSES else 99,
        -(h.get("confidence") or 0),
    ))
    hints = hint_rows
    return {
        "type": "FeatureCollection",
        "name": "nearmap-ai-layers",
        "survey_date": survey_date,
        "system_version": system_version,
        "layers": layers,
        "counts": dict(sorted(counts.items())),
        "hints": hints,
        "features": fc_features,
    }


def pack_ai_dir(raw_dir: Path, survey_date: str) -> dict:
    files = sorted(p for p in raw_dir.glob("*.geojson") if p.is_file())

    class DirFS:
        def read(self, path: str) -> bytes:
            return Path(path).read_bytes()

    return pack_ai(DirFS(), [str(p) for p in files], survey_date)


def reduce_ai(fs: ZipFS, ai_files: list[str], survey_date: str) -> dict:
    return pack_ai(fs, ai_files, survey_date)


def regions_doc(reduced: dict, source: str) -> dict:
    """Reviewer FeatureCollection. No hints array — polygons only."""
    feats = []
    for i, f in enumerate(reduced.get("features") or [], start=1):
        feat = {
            "type": "Feature",
            "id": f.get("id") or f"r{i}",
            "geometry": f.get("geometry"),
            "properties": dict(f.get("properties") or {}),
        }
        feat["properties"].setdefault("origin", "vendor")
        feats.append(feat)
    counts = {}
    for feat in feats:
        cls = str((feat["properties"] or {}).get("class") or "Unknown")
        counts[cls] = counts.get(cls, 0) + 1
    return {
        "type": "FeatureCollection",
        "name": "nearmap-regions",
        "source": source,
        "survey_date": reduced.get("survey_date"),
        "counts": dict(sorted(counts.items())),
        "features": feats,
    }


def write_regions_pair(ai_dir: Path, reduced: dict, reset_edits: bool = False) -> None:
    """original/ is vendor truth (always rewritten). edits/ is seeded once and kept."""
    orig = ai_dir / "original"
    edits = ai_dir / "edits"
    orig.mkdir(parents=True, exist_ok=True)
    edits.mkdir(parents=True, exist_ok=True)
    orig_path = orig / "regions.json"
    orig_path.write_text(json.dumps(regions_doc(reduced, "original"), indent=2), encoding="utf-8")
    edits_path = edits / "regions.json"
    if reset_edits or not edits_path.is_file():
        edits_path.write_text(json.dumps(regions_doc(reduced, "edits"), indent=2), encoding="utf-8")


def list_prop_files(names: list[str], prop_prefix: str) -> dict[str, list[str]]:
    by = defaultdict(list)
    for n in names:
        if not n.startswith(prop_prefix) or n.endswith("/"):
            continue
        rel = n[len(prop_prefix):]
        folder = rel.split("/")[0] if "/" in rel else "<root>"
        by[folder].append(n)
    return by


def process_api_property(fs: ZipFS, prop_folder: str, names: list[str],
                         out_root: Path, serve_root: Path | None,
                         only: str | None) -> dict | None:
    if only and only.lower() not in prop_folder.lower():
        return None
    delivery_id = delivery_id_from_folder(prop_folder)
    address = address_from_folder(prop_folder)
    prefix = f"Ahartsi/transactionalAPI_Imagery_AI_Elevation/{prop_folder}/"
    by = list_prop_files(names, prefix)
    if not by:
        # zip may omit Ahartsi/ prefix
        alt = f"transactionalAPI_Imagery_AI_Elevation/{prop_folder}/"
        by = list_prop_files(names, alt)
        prefix = alt if by else prefix
    if not by:
        return None

    canon = out_root / delivery_id / "canonical"
    serve = (serve_root / delivery_id) if serve_root else None
    if serve:
        serve.mkdir(parents=True, exist_ok=True)

    survey_date = "2026-07-02"
    vert_vrt_path = None
    for n in by.get("Vert", []):
        if n.lower().endswith(".vrt"):
            vert_vrt_path = n
        m = re.search(r"(20\d{2}-\d{2}-\d{2})", Path(n).name)
        if m:
            survey_date = m.group(1)

    bounds = None
    gsd_m = None
    vert_px = None
    if vert_vrt_path:
        vrt = parse_vrt(fs.read(vert_vrt_path).decode("utf-8"))
        bounds = vrt["bounds"]
        gsd_m = vrt["gsd_m"]
        vert_px = {"w": vrt["w"], "h": vrt["h"]}
        tile_prefix = vert_vrt_path.rsplit("/", 1)[0] + "/"
        im = mosaic_from_vrt(fs, tile_prefix, vrt, SERVE_LONG_EDGE)
        if serve:
            save_jpeg(im, serve / "vert.jpg")
            save_jpeg(cap_long_edge(im, BEDROCK_LONG_EDGE), serve / "vert-p1.jpg")
        save_jpeg(im, canon / "imagery" / "vert" / "vert.jpg")
        (canon / "imagery" / "vert").mkdir(parents=True, exist_ok=True)
        (canon / "imagery" / "vert" / "Vert.vrt").write_bytes(fs.read(vert_vrt_path))
        for src in vrt["sources"]:
            src_path = tile_prefix + src["file"]
            dest = canon / "imagery" / "vert" / src["file"]
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(fs.read(src_path))

    for look in ("North", "East", "South", "West"):
        tiffs = [(n, 0) for n in by.get(look, []) if n.lower().endswith((".tif", ".tiff"))]
        if not tiffs:
            continue
        im = mosaic_oblique(fs, tiffs)
        if im is None:
            continue
        jpeg_name = look.lower() + ".jpg"
        save_jpeg(im, canon / "imagery" / look.lower() / jpeg_name)
        if serve:
            save_jpeg(im, serve / jpeg_name)
        for n, _ in tiffs:
            dest = canon / "imagery" / look.lower() / Path(n).name
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(fs.read(n))

    for elev, dest_name in (("DetailDsm", "dsm.tif"), ("DetailDtm", "dtm.tif")):
        files = [n for n in by.get(elev, []) if n.lower().endswith((".tif", ".tiff"))]
        if not files:
            continue
        dest = canon / "elevation" / dest_name
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(fs.read(files[0]))

    ai_files = [n for n in by.get("ai", []) if n.lower().endswith(".geojson")]
    reduced = reduce_ai(fs, ai_files, survey_date) if ai_files else {"type": "FeatureCollection", "features": [], "counts": {}, "hints": []}
    ai_raw_dir = canon / "ai" / "raw"
    ai_raw_dir.mkdir(parents=True, exist_ok=True)
    for n in ai_files:
        (ai_raw_dir / Path(n).name).write_bytes(fs.read(n))
    (canon / "ai").mkdir(parents=True, exist_ok=True)
    (canon / "ai" / "features.json").write_text(json.dumps(reduced, indent=2), encoding="utf-8")
    write_regions_pair(canon / "ai", reduced)
    if serve:
        (serve / "ai").mkdir(parents=True, exist_ok=True)
        (serve / "ai" / "features.json").write_text(json.dumps(reduced, indent=2), encoding="utf-8")
        hints_doc = {"counts": reduced.get("counts") or {}, "hints": reduced.get("hints") or []}
        (serve / "ai" / "hints.json").write_text(json.dumps(hints_doc, indent=2), encoding="utf-8")
        write_regions_pair(serve / "ai", reduced)

    urls = {}
    if serve:
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
        "vert_px": vert_px,
        "site_no": None,
        "ai_counts": reduced.get("counts") or {},
        "hint_count": len(reduced.get("hints") or []),
        "urls": urls,
        "normalized_at": datetime.now(timezone.utc).isoformat(),
    }
    (canon / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    if serve:
        (serve / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"OK api {delivery_id} bounds={bounds} hints={manifest['hint_count']} counts={len(manifest['ai_counts'])}")
    return manifest


def inventory_mapbrowser(fs: ZipFS, names: list[str], out_root: Path, only: str | None) -> list[dict]:
    out = []
    for n in names:
        if "MapBrowser_3D" not in n or not n.lower().endswith(".zip") or n.count(".zip") != 1:
            continue
        # outer zip entries that ARE the site zips
        if n.rstrip("/").endswith(".zip") and "MapBrowser_3D/" in n:
            stem = Path(n).stem
            if only and only.lower() not in stem.lower():
                continue
            rec = {"pack": n, "site": stem, "inner": []}
            data = fs.read(n)
            with zipfile.ZipFile(io.BytesIO(data)) as mid:
                for me in mid.namelist():
                    rec["inner"].append(me)
            delivery_guess = slugify(stem)
            dest_root = None
            for p in out_root.iterdir():
                if p.is_dir() and delivery_guess in p.name:
                    dest_root = p
                    break
            if dest_root is None:
                dest_root = out_root / delivery_guess
            mesh_dir = dest_root / "canonical" / "mesh"
            mesh_dir.mkdir(parents=True, exist_ok=True)
            (mesh_dir / "inventory.json").write_text(json.dumps(rec, indent=2), encoding="utf-8")
            print(f"OK mapbrowser inventory {stem} packs={len(rec['inner'])}")
            out.append(rec)
    return out


def discover_api_props(names: list[str]) -> list[str]:
    props = []
    for n in names:
        n = n.replace("\\", "/")
        marker = "transactionalAPI_Imagery_AI_Elevation/"
        if marker not in n:
            continue
        rest = n.split(marker, 1)[1]
        folder = rest.split("/")[0]
        if folder and folder not in props:
            props.append(folder)
    return props


def main() -> int:
    ap = argparse.ArgumentParser(description="Normalize Nearmap vendor zip to canonical + serving subset")
    ap.add_argument("--zip", required=True, help="Path to Ahartsi.zip (or equivalent)")
    ap.add_argument("--out", required=True, help="Canonical output root")
    ap.add_argument("--serve-out", default="", help="Serving subset (JPEGs + reduced AI)")
    ap.add_argument("--only", default="", help="Substring filter on property folder / 3D zip name")
    args = ap.parse_args()

    zpath = Path(args.zip)
    if not zpath.is_file():
        raise SystemExit(f"zip not found: {zpath}")
    out_root = Path(args.out)
    out_root.mkdir(parents=True, exist_ok=True)
    serve_root = Path(args.serve_out) if args.serve_out else None
    if serve_root:
        serve_root.mkdir(parents=True, exist_ok=True)

    fs = ZipFS(zpath)
    try:
        names = fs.names()
        only = args.only.strip() or None
        manifests = []
        for prop in discover_api_props(names):
            m = process_api_property(fs, prop, names, out_root, serve_root, only)
            if m:
                manifests.append(m)
        inventory_mapbrowser(fs, names, out_root, only)
        index = {
            "version": 1,
            "updated": datetime.now(timezone.utc).isoformat(),
            "deliveries": manifests,
        }
        (out_root / "index.json").write_text(json.dumps(index, indent=2), encoding="utf-8")
        if serve_root:
            (serve_root / "index.json").write_text(json.dumps(index, indent=2), encoding="utf-8")
        print(f"Wrote {len(manifests)} delivery(ies) -> {out_root}")
    finally:
        fs.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
