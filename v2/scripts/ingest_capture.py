#!/usr/bin/env python3
"""
ingest_capture.py — Stage 1 (Ingest) of the plane imagery pipeline.

INPUT CONTRACT : a DJI Terra output folder (see docs/DELIVERY_CONTRACT.md)
OUTPUT CONTRACT: captures/{id}/raw + processed + manifest.json in
                 s3://property-intel-ingest (later increments)
FAILURE MODE   : fail-fast per validation gate; nothing is uploaded or
                 modified on failure; the delivery folder is never written to.

STATUS: complete — all gates + generation + upload implemented and tested.

Usage:
  python ingest_capture.py validate  <delivery>
  python ingest_capture.py transform <delivery>
  python ingest_capture.py extents   <delivery>
  python ingest_capture.py generate  <delivery> <staging_root>
  python ingest_capture.py ingest    <delivery> <staging_root> <capture-id> <YYYY-MM-DD>
  python ingest_capture.py upload    <delivery> <staging_root> <capture-id> [dry]
"""

from __future__ import annotations

import json
import math
import re
import sys
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from pathlib import Path
from datetime import datetime, timezone

# ----------------------------------------------------------------------------
# Delivery layout constants (single source of truth for required paths)
# ----------------------------------------------------------------------------

MAP_DIR = Path("map")
ORTHO_FILES = [MAP_DIR / "result.tif", MAP_DIR / "result.tfw", MAP_DIR / "result.prj"]
OBJ_DIR = Path("models/pc/0/terra_obj/BlockR")
OBJ_FILE = OBJ_DIR / "BlockR.obj"
MTL_FILE = OBJ_DIR / "BlockR.mtl"
METADATA_XML = Path("models/pc/0/terra_obj/metadata.xml")
SFM_GEO_DESC = Path("AT/sfm_geo_desc.json")

# Optional — staged if present, never required.
TILESET_JSON = Path("models/pc/0/terra_b3dms/tileset.json")

EXPECTED_MAX_NATIVE_ZOOM = 19  # warn (not fail) if the delivery differs

# Geo cross-check tolerances (metadata.xml SRSOrigin vs sfm_geo_desc ref_GPS)
GEO_TOL_HORIZONTAL_M = 1.0
GEO_TOL_VERTICAL_M = 2.0
PYRAMID_MODE = "full_tif"         # "augment" | "full_tif"
EXTRA_ZOOM_DELTAS = (1, 2)        # zooms beyond native max, e.g. z20/z21
TILE_SIZE = 256
ORIGIN_3857 = 20037508.342789244  # WebMercator half-world extent, meters
INGEST_BUCKET = "property-intel-ingest"
AWS_REGION = "us-east-1"
RAW_KEEP_FILES = [MAP_DIR / "result.tif", MAP_DIR / "result.tfw",
                  MAP_DIR / "result.prj", METADATA_XML, SFM_GEO_DESC]
RAW_KEEP_DIRS = [Path("AT/report"), Path("map/report"),
                 Path("models/pc/0/terra_b3dms")]
CONTENT_TYPES = {".png": "image/png", ".json": "application/json",
                 ".tif": "image/tiff", ".tfw": "text/plain",
                 ".prj": "text/plain", ".xml": "application/xml",
                 ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
                 ".obj": "text/plain", ".mtl": "text/plain",
                 ".b3dm": "application/octet-stream"}

# ----------------------------------------------------------------------------
# Result type — every gate reports through this, so failures are structured
# data for the manifest, not just printouts.
# ----------------------------------------------------------------------------

@dataclass
class GateResult:
    gate: str
    passed: bool = False  # safe default: a gate that never concludes = failed
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    info: dict = field(default_factory=dict)

    def report(self) -> str:
        lines = [f"[{'PASS' if self.passed else 'FAIL'}] {self.gate}"]
        lines += [f"    ERROR: {e}" for e in self.errors]
        lines += [f"    warn : {w}" for w in self.warnings]
        for k, v in self.info.items():
            lines.append(f"    {k}: {v}")
        return "\n".join(lines)


# ----------------------------------------------------------------------------
# Gate 1 — structure: required files exist, are non-empty, and the MTL's
# texture references all resolve to real files.
# ----------------------------------------------------------------------------

def validate_structure(delivery: Path) -> GateResult:
    r = GateResult(gate="structure")

    required = ORTHO_FILES + [OBJ_FILE, MTL_FILE, METADATA_XML, SFM_GEO_DESC]
    for rel in required:
        p = delivery / rel
        if not p.is_file():
            r.errors.append(f"missing required file: {rel}")
        elif p.stat().st_size == 0:
            r.errors.append(f"required file is empty: {rel}")

    if not (delivery / MAP_DIR).is_dir():
        r.errors.append(f"missing required directory: {MAP_DIR}")

    mtl_path = delivery / MTL_FILE
    if mtl_path.is_file():
        missing_tex, tex_count = _check_mtl_textures(mtl_path)
        r.info["textures_referenced"] = tex_count
        for t in missing_tex:
            r.errors.append(f"MTL references missing texture: {t}")

    r.info["tileset_present"] = (delivery / TILESET_JSON).is_file()

    r.passed = not r.errors
    return r


_MTL_MAP_RE = re.compile(r"^\s*map_[A-Za-z]+\s+(.+?)\s*$")


def _check_mtl_textures(mtl_path: Path) -> tuple[list[str], int]:
    """Return (missing texture names, total referenced). Paths in Terra MTLs
    are relative to the MTL's own directory."""
    missing: list[str] = []
    count = 0
    base = mtl_path.parent
    with mtl_path.open("r", encoding="utf-8", errors="replace") as f:
        for line in f:
            m = _MTL_MAP_RE.match(line)
            if not m:
                continue
            count += 1
            tex = m.group(1).strip().strip('"')
            if not (base / tex).is_file():
                missing.append(tex)
    return missing, count


# ----------------------------------------------------------------------------
# Gate 2 — pyramid: zoom directories are contiguous integers; each zoom has
# tiles; record max native zoom and per-zoom tile counts.
# ----------------------------------------------------------------------------

def validate_pyramid(delivery: Path) -> GateResult:
    r = GateResult(gate="pyramid")
    map_dir = delivery / MAP_DIR
    if not map_dir.is_dir():
        r.errors.append(f"{MAP_DIR} directory missing")
        return r

    zooms = sorted(
        int(d.name) for d in map_dir.iterdir() if d.is_dir() and d.name.isdigit()
    )
    if not zooms:
        r.errors.append("no numeric zoom directories found under map/")
        return r

    if zooms != list(range(zooms[0], zooms[-1] + 1)):
        r.errors.append(f"zoom levels not contiguous: {zooms}")

    counts: dict[int, int] = {}
    for z in zooms:
        n = sum(1 for _ in (map_dir / str(z)).rglob("*.png"))
        counts[z] = n
        if n == 0:
            r.errors.append(f"zoom {z} contains no .png tiles")

    r.info["zooms"] = f"{zooms[0]}–{zooms[-1]}"
    r.info["max_native_zoom"] = zooms[-1]
    r.info["tile_counts"] = counts
    r.info["tile_count_total"] = sum(counts.values())

    if zooms[-1] != EXPECTED_MAX_NATIVE_ZOOM:
        r.warnings.append(
            f"max native zoom is {zooms[-1]}, expected {EXPECTED_MAX_NATIVE_ZOOM} "
            "(not fatal — upscale will start from the actual max)"
        )

    r.passed = not r.errors
    return r


# ----------------------------------------------------------------------------
# Gates 3-4 — georeference cross-check + ECEF transform derivation.
#
# metadata.xml gives SRS (e.g. EPSG:32610) and SRSOrigin (easting, northing,
# alt): the anchor point of the OBJ's local coordinates. We convert it to
# WGS84, cross-check against sfm_geo_desc.json's ref_GPS (gate 3), then build
# the 4x4 east-north-up-to-ECEF matrix at that point (gate 4). Output is
# column-major, 16 numbers — the same convention as a 3D Tiles `transform`,
# which is what v1's model_transform recovery produced, so the two are
# directly comparable.
# ----------------------------------------------------------------------------

def parse_metadata_xml(path: Path) -> tuple[str, tuple[float, float, float]]:
    root = ET.parse(path).getroot()
    srs_el = root.find("SRS")
    origin_el = root.find("SRSOrigin")
    if srs_el is None or origin_el is None or not srs_el.text or not origin_el.text:
        raise ValueError("metadata.xml missing SRS or SRSOrigin")
    parts = [float(x) for x in origin_el.text.strip().split(",")]
    if len(parts) != 3:
        raise ValueError(f"SRSOrigin has {len(parts)} components, expected 3")
    return srs_el.text.strip(), (parts[0], parts[1], parts[2])


def enu_to_ecef_matrix(lat_deg: float, lon_deg: float, alt_m: float) -> list[float]:
    """Column-major 4x4: columns = east, north, up, ECEF position."""
    from pyproj import Transformer

    to_ecef = Transformer.from_crs("EPSG:4979", "EPSG:4978", always_xy=True)
    px, py, pz = to_ecef.transform(lon_deg, lat_deg, alt_m)

    lam = math.radians(lon_deg)
    phi = math.radians(lat_deg)
    east = (-math.sin(lam), math.cos(lam), 0.0)
    north = (
        -math.sin(phi) * math.cos(lam),
        -math.sin(phi) * math.sin(lam),
        math.cos(phi),
    )
    up = (
        math.cos(phi) * math.cos(lam),
        math.cos(phi) * math.sin(lam),
        math.sin(phi),
    )
    return [
        east[0], east[1], east[2], 0.0,
        north[0], north[1], north[2], 0.0,
        up[0], up[1], up[2], 0.0,
        px, py, pz, 1.0,
    ]


def derive_transform(delivery: Path) -> GateResult:
    r = GateResult(gate="georeference+transform")
    from pyproj import Transformer

    # --- read inputs -------------------------------------------------------
    try:
        srs, origin = parse_metadata_xml(delivery / METADATA_XML)
    except Exception as e:
        r.errors.append(f"metadata.xml unusable ({e}); "
                        "fall back to tileset recovery for this capture")
        return r

    try:
        geo = json.loads((delivery / SFM_GEO_DESC).read_text(encoding="utf-8"))
        ref = geo["ref_GPS"]
        ref_lat, ref_lon, ref_alt = ref["latitude"], ref["longitude"], ref["altitude"]
    except Exception as e:
        r.errors.append(f"sfm_geo_desc.json unusable: {e}")
        return r

    # --- SRSOrigin -> WGS84 ------------------------------------------------
    to_wgs = Transformer.from_crs(srs, "EPSG:4979", always_xy=True)
    lon, lat, alt = to_wgs.transform(origin[0], origin[1], origin[2])

    # --- gate 3: cross-check vs ref_GPS ------------------------------------
    # Horizontal delta via local equirectangular approximation (fine at <1 km)
    m_per_deg_lat = 111_320.0
    m_per_deg_lon = m_per_deg_lat * math.cos(math.radians(lat))
    d_h = math.hypot((lat - ref_lat) * m_per_deg_lat, (lon - ref_lon) * m_per_deg_lon)
    d_v = abs(alt - ref_alt)

    r.info["srs"] = srs
    r.info["srs_origin"] = origin
    r.info["origin_wgs84"] = (round(lat, 8), round(lon, 8), round(alt, 3))
    r.info["crosscheck_delta_m"] = {"horizontal": round(d_h, 3), "vertical": round(d_v, 3)}

    if d_h > GEO_TOL_HORIZONTAL_M:
        r.errors.append(
            f"horizontal mismatch {d_h:.2f} m > {GEO_TOL_HORIZONTAL_M} m: "
            "model and map disagree about where they are — do not promote"
        )
    if d_v > GEO_TOL_VERTICAL_M:
        r.errors.append(f"vertical mismatch {d_v:.2f} m > {GEO_TOL_VERTICAL_M} m")

    # --- gate 4: ENU->ECEF matrix -------------------------------------------
    matrix = enu_to_ecef_matrix(lat, lon, alt)
    r.info["transform_method"] = "metadata_xml"
    r.info["transform_ecef"] = matrix

    r.passed = not r.errors
    return r
 
# ----------------------------------------------------------------------------
# Gate 5 — extents: per-zoom tile x/y ranges measured from what is actually
# on disk (never predicted by formula — v1's registry proved generated-zoom
# extents don't match naive doubling). WGS84 bounds are the *tile-edge*
# bounds at max native zoom, so they will be slightly wider than
# orthomosaic-derived bounds; the manifest records the source.
# ----------------------------------------------------------------------------
 
def _tile_to_lon(x: int, z: int) -> float:
    return x / (2 ** z) * 360.0 - 180.0
 
 
def _tile_to_lat(y: int, z: int) -> float:
    n = math.pi - 2.0 * math.pi * y / (2 ** z)
    return math.degrees(math.atan(math.sinh(n)))
 
 
def compute_extents(delivery: Path) -> GateResult:
    r = GateResult(gate="extents")
    map_dir = delivery / MAP_DIR
 
    extents: dict[str, dict[str, list[int]]] = {}
    zooms = sorted(
        int(d.name) for d in map_dir.iterdir() if d.is_dir() and d.name.isdigit()
    ) if map_dir.is_dir() else []
 
    if not zooms:
        r.errors.append("no zoom directories to measure")
        return r
 
    for z in zooms:
        xs: list[int] = []
        ys: list[int] = []
        for xdir in (map_dir / str(z)).iterdir():
            if not (xdir.is_dir() and xdir.name.isdigit()):
                continue
            x = int(xdir.name)
            tile_ys = [
                int(p.stem) for p in xdir.glob("*.png") if p.stem.isdigit()
            ]
            if tile_ys:
                xs.append(x)
                ys.extend(tile_ys)
        if not xs:
            r.errors.append(f"zoom {z}: directories present but no tiles measured")
            continue
        extents[str(z)] = {"x": [min(xs), max(xs)], "y": [min(ys), max(ys)]}
 
    if r.errors:
        return r
 
    # WGS84 bounds from tile edges at max native zoom.
    mz = zooms[-1]
    ext = extents[str(mz)]
    bounds = {
        "west": _tile_to_lon(ext["x"][0], mz),
        "east": _tile_to_lon(ext["x"][1] + 1, mz),   # +1: right edge of last tile
        "north": _tile_to_lat(ext["y"][0], mz),
        "south": _tile_to_lat(ext["y"][1] + 1, mz),  # +1: bottom edge of last tile
    }
 
    r.info["max_native_zoom"] = mz
    r.info["tile_extents_native"] = extents
    r.info["bounds_wgs84_tile_edges"] = {k: round(v, 6) for k, v in bounds.items()}
    r.passed = True
    return r

# ----------------------------------------------------------------------------
# Generation — z20/z21 sliced directly from map/result.tif (16.4 cm GSD),
# which carries finer detail than the z19 pyramid (~21.5 cm/px at this
# latitude). One WarpedVRT per zoom, its pixel grid snapped exactly to the
# tile grid, so every tile is a plain in-bounds 256x256 window read and the
# warp (UTM -> WebMercator, LANCZOS) does all resampling. Coverage follows
# the TIF footprint; fully transparent tiles are skipped. Writes ONLY into
# out_root; resumable via skip-if-exists; extents measured from disk after.
# ----------------------------------------------------------------------------
 
def _tile_grid_for_zoom(src_bounds_3857, z: int):
    ts = 2 * ORIGIN_3857 / (2 ** z)
    x0 = int((src_bounds_3857.left + ORIGIN_3857) // ts)
    x1 = int((src_bounds_3857.right + ORIGIN_3857) // ts)
    y0 = int((ORIGIN_3857 - src_bounds_3857.top) // ts)
    y1 = int((ORIGIN_3857 - src_bounds_3857.bottom) // ts)
    from rasterio.transform import from_origin
    res = ts / TILE_SIZE
    transform = from_origin(-ORIGIN_3857 + x0 * ts, ORIGIN_3857 - y0 * ts,
                            res, res)
    return x0, x1, y0, y1, transform, (x1 - x0 + 1) * TILE_SIZE, \
        (y1 - y0 + 1) * TILE_SIZE
 
 
def generate_highres_tiles(delivery: Path, out_root: Path) -> GateResult:
    import numpy as np
    import rasterio
    from rasterio.enums import Resampling, ColorInterp
    from rasterio.vrt import WarpedVRT
    from rasterio.windows import Window
    from PIL import Image
 
    r = GateResult(gate="generate")
    tif = delivery / MAP_DIR / "result.tif"
    if not tif.is_file():
        r.errors.append("map/result.tif missing")
        return r
 
    map_dir = delivery / MAP_DIR
    native_zooms = sorted(
        int(d.name) for d in map_dir.iterdir() if d.is_dir() and d.name.isdigit()
    ) if map_dir.is_dir() else []
    if not native_zooms:
        r.errors.append("no native zoom directories found")
        return r
    mz = native_zooms[-1]
    targets = sorted(set(native_zooms) |
                     {mz + dz for dz in EXTRA_ZOOM_DELTAS})
 
    tiles_out = out_root / "tiles"
    stats: dict[int, dict[str, int]] = {}
 
    with rasterio.open(tif) as src:
        src_has_alpha = ColorInterp.alpha in src.colorinterp
        r.info["pyramid_mode"] = PYRAMID_MODE
        r.info["tif_bands"] = f"{src.count} (alpha={'yes' if src_has_alpha else 'no'})"
        r.info["tif_crs"] = str(src.crs)
        r.info["tif_size"] = f"{src.width}x{src.height}"
        r.info["tif_res_m"] = (round(abs(src.transform.a), 4),
                               round(abs(src.transform.e), 4))
        for z in targets:
            with WarpedVRT(src, crs="EPSG:3857") as probe:
                x0, x1, y0, y1, transform, width, height = \
                    _tile_grid_for_zoom(probe.bounds, z)
            with WarpedVRT(src, crs="EPSG:3857",
                           resampling=Resampling.lanczos,
                           add_alpha=not src_has_alpha,
                           transform=transform, width=width,
                           height=height) as vrt:
                has_alpha = vrt.count >= 4
                if not has_alpha:
                    r.warnings.append(
                        f"z{z}: no alpha band after warp ({vrt.count} bands) "
                        "— empty-tile skipping disabled")
                w = s = e = kept = 0
                for x in range(x0, x1 + 1):
                    for y in range(y0, y1 + 1):
                        if (PYRAMID_MODE == "augment"
                                and z in native_zooms
                                and (map_dir / str(z) / str(x)
                                     / f"{y}.png").is_file()):
                            kept += 1
                            continue
                        out = tiles_out / str(z) / str(x) / f"{y}.png"
                        if out.exists():
                            s += 1
                            continue
                        win = Window((x - x0) * TILE_SIZE,
                                     (y - y0) * TILE_SIZE,
                                     TILE_SIZE, TILE_SIZE)
                        data = vrt.read(window=win)
                        if has_alpha and data[-1].max() == 0:
                            e += 1
                            continue
                        rgb = np.transpose(data[:3], (1, 2, 0))
                        img = Image.fromarray(
                            np.dstack([rgb, data[-1]]), "RGBA") if has_alpha \
                            else Image.fromarray(rgb, "RGB")
                        out.parent.mkdir(parents=True, exist_ok=True)
                        img.save(out)
                        w += 1
                stats[z] = {"written": w, "skipped_existing": s,
                            "empty": e, "native_kept": kept}
 
    # Measure generated extents from disk (staging only).
    gen_extents: dict[str, dict[str, list[int]]] = {}
    for z in targets:
        zdir = tiles_out / str(z)
        xs: list[int] = []
        ys: list[int] = []
        if zdir.is_dir():
            for xdir in zdir.iterdir():
                if not (xdir.is_dir() and xdir.name.isdigit()):
                    continue
                tile_ys = [int(p.stem) for p in xdir.glob("*.png")
                           if p.stem.isdigit()]
                if tile_ys:
                    xs.append(int(xdir.name))
                    ys.extend(tile_ys)
        if xs:
            gen_extents[str(z)] = {"x": [min(xs), max(xs)],
                                   "y": [min(ys), max(ys)]}
        elif z not in native_zooms:
            r.errors.append(f"generated zoom {z}: nothing on disk after run")
 
    r.info["source"] = "map/result.tif (warped UTM->WebMercator, LANCZOS)"
    r.info["per_zoom"] = stats
    r.info["tile_extents_generated"] = gen_extents
    r.passed = not r.errors
    return r

# ----------------------------------------------------------------------------
# Manifest — assembles every GateResult into the Stage-1 output contract.
# Pure assembly: no gate logic lives here, so the manifest can never disagree
# with the console reports. A failed run still writes a manifest (status:
# failed, errors populated) so failures are reviewable artifacts, but the
# upscale step never executes on top of failed validation.
# ----------------------------------------------------------------------------
 
def write_manifest(delivery: Path, out_root: Path, capture_id: str,
                   captured: str, gates: dict) -> Path:
    all_pass = all(g.passed for g in gates.values())
    errors = [f"{name}: {e}" for name, g in gates.items() for e in g.errors]
    warnings = [f"{name}: {w}" for name, g in gates.items() for w in g.warnings]
 
    pyramid = gates["pyramid"].info
    extents = gates["extents"].info
    transform = gates["transform"].info
    generate = gates["generate"].info
 
    native_ext = extents.get("tile_extents_native", {})
    gen_ext = generate.get("tile_extents_generated", {})
    if generate.get("pyramid_mode") == "full_tif":
        tile_extents = dict(gen_ext)          # single source
    else:                                      # augment: per-axis union
        tile_extents = {}
        for z in sorted(set(native_ext) | set(gen_ext), key=int):
            a, b = native_ext.get(z), gen_ext.get(z)
            if a and b:
                tile_extents[z] = {
                    "x": [min(a["x"][0], b["x"][0]), max(a["x"][1], b["x"][1])],
                    "y": [min(a["y"][0], b["y"][0]), max(a["y"][1], b["y"][1])]}
            else:
                tile_extents[z] = a or b
 
    per_zoom = generate.get("per_zoom", {})
    generated_count = sum(v.get("written", 0) + v.get("skipped_existing", 0)
                          for v in per_zoom.values())
 
    manifest = {
        "manifest_version": 1,
        "capture_id": capture_id,
        "display_name": delivery.name,
        "captured": captured,
        "ingested_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "status": "ready_for_review" if all_pass else "failed",
        "tiles": {
            "native_max_zoom": pyramid.get("max_native_zoom"),
            "pyramid_mode": generate.get("pyramid_mode"),
            "generation_source": generate.get("source"),
            "generation_per_zoom": per_zoom,
            "tile_extents": tile_extents,
            "tile_count_native": pyramid.get("tile_count_total"),
            "tile_count_generated": generated_count,
        },
        "bounds_wgs84_tile_edges": extents.get("bounds_wgs84_tile_edges"),
        "model": {
            "source_key": f"captures/{capture_id}/processed/model/BlockR.obj",
            "srs": transform.get("srs"),
            "srs_origin": transform.get("srs_origin"),
            "transform_ecef": transform.get("transform_ecef"),
            "transform_method": transform.get("transform_method"),
            "geo_crosscheck_delta_m": transform.get("crosscheck_delta_m"),
        },
        "validation": {name: ("pass" if g.passed else "fail")
                       for name, g in gates.items()},
        "warnings": warnings,
        "errors": errors,
    }
 
    out_root.mkdir(parents=True, exist_ok=True)
    path = out_root / "manifest.json"
    path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return path

def run_ingest(delivery: Path, out_root: Path, capture_id: str,
               captured: str) -> tuple[dict, Path]:
    """Run every gate in order; write a manifest either way; only generate
    tiles when all validation gates passed."""
    gates = {
        "structure": validate_structure(delivery),
        "pyramid": validate_pyramid(delivery),
        "transform": derive_transform(delivery),
        "extents": compute_extents(delivery),
    }
    if all(g.passed for g in gates.values()):
        gates["generate"] = generate_highres_tiles(delivery, out_root)
    else:
        skipped = GateResult(gate="generate")
        skipped.errors.append("skipped: earlier validation gates failed")
        gates["generate"] = skipped
 
    path = write_manifest(delivery, out_root, capture_id, captured, gates)
    return gates, path


# ----------------------------------------------------------------------------
# Upload — the only step that touches AWS. Plan is built first (pure local);
# 'dry' mode prints it and stops, so the operator can inspect exactly what
# will land where before any byte moves. Real mode is resumable: objects
# already in S3 with matching size are skipped. The manifest uploads LAST —
# its presence in S3 is the signal that the capture upload is complete.
# Storage decision (deviates from contract v1.0, to be folded in): big
# binaries are stored once — tiles and the model package live only under
# processed/; raw/ holds ortho, metadata, QA reports, and tilesets.
# ----------------------------------------------------------------------------
 
def build_upload_plan(delivery: Path, staging: Path,
                      capture_id: str) -> list[tuple[Path, str, int]]:
    base = f"captures/{capture_id}"
    plan: list[tuple[Path, str, int]] = []
 
    def add(local: Path, key: str) -> None:
        plan.append((local, key, local.stat().st_size))
 
    for rel in RAW_KEEP_FILES:
        p = delivery / rel
        if p.is_file():
            add(p, f"{base}/raw/{rel.as_posix()}")
    for reld in RAW_KEEP_DIRS:
        d = delivery / reld
        if d.is_dir():
            for p in sorted(d.rglob("*")):
                if p.is_file():
                    add(p, f"{base}/raw/{p.relative_to(delivery).as_posix()}")
 
    if PYRAMID_MODE != "full_tif":
        for zdir in sorted((delivery / MAP_DIR).iterdir()):
            if zdir.is_dir() and zdir.name.isdigit():
                for p in sorted(zdir.rglob("*.png")):
                    add(p, f"{base}/processed/tiles/"
                           f"{p.relative_to(delivery / MAP_DIR).as_posix()}")
    st = staging / "tiles"
    if st.is_dir():
        for p in sorted(st.rglob("*.png")):
            add(p, f"{base}/processed/tiles/{p.relative_to(st).as_posix()}")
 
    for p in sorted((delivery / OBJ_DIR).iterdir()):
        if p.is_file():
            add(p, f"{base}/processed/model/{p.name}")
 
    add(staging / "manifest.json", f"{base}/manifest.json")  # always last
    return plan
 
 
def upload_to_ingest(delivery: Path, staging: Path, capture_id: str,
                     dry: bool) -> GateResult:
    r = GateResult(gate="upload")
 
    manifest = staging / "manifest.json"
    if not manifest.is_file():
        r.errors.append("no manifest.json in staging — run 'ingest' first")
        return r
    status = json.loads(manifest.read_text(encoding="utf-8")).get("status")
    if status != "ready_for_review":
        r.errors.append(f"manifest status is '{status}' — only "
                        "'ready_for_review' captures may upload")
        return r
 
    plan = build_upload_plan(delivery, staging, capture_id)
    total_bytes = sum(s for _, _, s in plan)
    r.info["bucket"] = INGEST_BUCKET
    r.info["files_planned"] = len(plan)
    r.info["bytes_planned"] = total_bytes
 
    if dry:
        groups: dict[str, list[int]] = {}
        for _, key, size in plan:
            parts = key.split("/")
            g = "manifest" if key.endswith("manifest.json") \
                else "/".join(parts[2:4])
            groups.setdefault(g, [0, 0])
            groups[g][0] += 1
            groups[g][1] += size
        for g, (n, b) in groups.items():
            print(f"  DRY {g:24s} files={n:6d}  bytes={b:,}")
        print(f"  DRY first key: {plan[0][1]}")
        print(f"  DRY last  key: {plan[-1][1]}")
        r.info["mode"] = "dry-run (nothing uploaded)"
        r.passed = True
        return r
 
    import boto3
    from botocore.exceptions import ClientError
 
    s3 = boto3.client("s3", region_name=AWS_REGION)
    uploaded = skipped = 0
    sent_bytes = 0
    for idx, (local, key, size) in enumerate(plan, 1):
        try:
            head = s3.head_object(Bucket=INGEST_BUCKET, Key=key)
            if head["ContentLength"] == size:
                skipped += 1
                continue
        except ClientError as e:
            if e.response["Error"]["Code"] not in ("404", "NoSuchKey", "NotFound"):
                r.errors.append(f"head_object failed for {key}: {e}")
                break
        ctype = CONTENT_TYPES.get(local.suffix.lower(),
                                  "application/octet-stream")
        try:
            s3.upload_file(str(local), INGEST_BUCKET, key,
                           ExtraArgs={"ContentType": ctype,
                                      "CacheControl": "public, max-age=3600"})
        except Exception as e:
            r.errors.append(f"upload failed for {key}: {e}")
            break
        uploaded += 1
        sent_bytes += size
        if uploaded % 500 == 0:
            print(f"  ... {idx}/{len(plan)} "
                  f"(uploaded {uploaded}, skipped {skipped})")
            
    # prune stale processed tiles (addresses no longer generated)
    if not r.errors:
        tiles_prefix = f"captures/{capture_id}/processed/tiles/"
        planned = {key for _, key, _ in plan}
        stale = []
        for page in s3.get_paginator("list_objects_v2").paginate(
                Bucket=INGEST_BUCKET, Prefix=tiles_prefix):
            for item in page.get("Contents", []):
                if item["Key"] not in planned:
                    stale.append(item["Key"])
        for i in range(0, len(stale), 1000):
            s3.delete_objects(Bucket=INGEST_BUCKET,
                              Delete={"Objects": [{"Key": k}
                                                  for k in stale[i:i + 1000]]})
        r.info["stale_pruned"] = len(stale)    
 
    r.info["uploaded"] = uploaded
    r.info["skipped_existing"] = skipped
    r.info["bytes_sent"] = sent_bytes
    r.passed = not r.errors
    return r

# ----------------------------------------------------------------------------
# CLI
# ----------------------------------------------------------------------------

def _print_matrix(m: list[float]) -> None:
    print("transform_ecef (column-major, 3D-Tiles convention):")
    print(json.dumps([round(v, 10) for v in m]))
    print("as rows (for eyeballing):")
    for i in range(4):
        row = [m[i], m[i + 4], m[i + 8], m[i + 12]]
        print("  [" + ", ".join(f"{v: .6f}" for v in row) + "]")


def main(argv: list[str]) -> int:
    # --- argument validation, one place, before anything runs ---------------
    commands_3arg = ("validate", "transform", "extents")
    if len(argv) >= 2 and argv[1] == "generate":
        if len(argv) != 4:
            print(__doc__)
            return 2
    elif len(argv) >= 2 and argv[1] == "ingest":
        if len(argv) != 6:
            print(__doc__)
            return 2
        if not re.fullmatch(r"[a-z0-9][a-z0-9-]*", argv[4]):
            print(f"FAIL: capture id '{argv[4]}' must be lowercase "
                  "letters/digits/hyphens")
            return 2
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", argv[5]):
            print(f"FAIL: captured date '{argv[5]}' must be YYYY-MM-DD")
            return 2
    elif len(argv) >= 2 and argv[1] == "upload":
        if len(argv) not in (5, 6) or (len(argv) == 6 and argv[5] != "dry"):
            print(__doc__)
            return 2
        if not re.fullmatch(r"[a-z0-9][a-z0-9-]*", argv[4]):
            print(f"FAIL: capture id '{argv[4]}' must be lowercase "
                  "letters/digits/hyphens")
            return 2
    elif len(argv) != 3 or argv[1] not in commands_3arg:
        print(__doc__)
        return 2
 
    delivery = Path(argv[2])
    if not delivery.is_dir():
        print(f"FAIL: delivery path is not a directory: {delivery}")
        return 1
 
    # --- dispatch: compute results exactly once, before any printing --------
    manifest_path = None
    if argv[1] == "validate":
        results = [validate_structure(delivery), validate_pyramid(delivery)]
    elif argv[1] == "transform":
        results = [derive_transform(delivery)]
    elif argv[1] == "extents":
        results = [compute_extents(delivery)]
    elif argv[1] == "generate":
        results = [generate_highres_tiles(delivery, Path(argv[3]))]
    elif argv[1] == "ingest":
        gates, manifest_path = run_ingest(
            delivery, Path(argv[3]), argv[4], argv[5])
        results = list(gates.values())
    else:  # upload
        results = [upload_to_ingest(delivery, Path(argv[3]), argv[4],
                                    dry=(len(argv) == 6))]
 
    # --- reporting -----------------------------------------------------------
    for res in results:
        print(res.report())
 
    if argv[1] == "transform" and results[0].passed:
        _print_matrix(results[0].info["transform_ecef"])
 
    if argv[1] == "extents" and results[0].passed:
        print(json.dumps(results[0].info["tile_extents_native"], indent=2))
 
    if manifest_path is not None:
        print(f"\nmanifest: {manifest_path}")
 
    ok = all(res.passed for res in results)
    print(f"\n{'ALL GATES PASSED' if ok else 'VALIDATION FAILED'} — {delivery.name}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
