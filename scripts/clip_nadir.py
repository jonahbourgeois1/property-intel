"""
clip_nadir.py

Generates the nadir (straight-down) view for each property by cropping
directly from the existing georeferenced 2D tile pyramid — the same
imagery already serving the live map viewer. No 3D rendering, no house
detection, no camera framing decisions: the parcel polygon's real
geographic bounds are already known exactly, so this is a deterministic
crop, not a heuristic search.

HOW IT WORKS:
  1. Look up the property's parcel polygon (by taxlot) to get its exact
     lat/lon bounding box.
  2. Pad that box by a percentage (default 15%) so the property isn't
     cropped edge-to-edge with zero margin — mirrors the same
     "fill target, not exact bounds" philosophy as the existing
     zoomForBounds() satellite-image sizing.
  3. Convert the padded bbox to pixel coordinates in the tile pyramid's
     global pixel space at a chosen zoom level (default 21 — matches the
     capture's native ~16cm ground resolution).
  4. Determine which tiles cover that pixel region, download them
     (plain HTTP — the tile CDN is public), and stitch them into one
     canvas.
  5. Crop the canvas to the exact padded-bbox pixel region and save.

INPUT:
  --matches       highlands_matches.json (address/taxlot/lat/lon) — only
                  used to get the taxlot list and property names; the
                  actual crop geometry comes from the parcel polygon.
  --parcels       Parcel GeoJSON (same file used by compute_frontage.py
                  and clip_parcel_textured.py).
  --capture-base  Base tile URL for the capture, e.g.
                  https://d3fg47bqswi0rr.cloudfront.net/captures/plane/bend-5-21-26/map
  --zoom          Tile zoom level to crop from (default 21).
  --padding       Fractional padding around the parcel bbox (default 0.15
                  = 15% on each side).
  --out-dir       Output directory for nadir JPGs, one per taxlot.

USAGE:
    python3 clip_nadir.py \
        --matches highlands_matches.json \
        --parcels bend-5-21-26-parcels.geojson \
        --capture-base https://d3fg47bqswi0rr.cloudfront.net/captures/plane/bend-5-21-26/map \
        --out-dir nadir_captures
"""

import argparse
import io
import json
import math
import os
import sys

import requests
from PIL import Image
from shapely.geometry import shape

TILE_SIZE = 256


def deg2num(lat_deg, lon_deg, zoom):
    """Standard slippy-map lat/lon -> fractional tile coordinates."""
    lat_rad = math.radians(lat_deg)
    n = 2.0 ** zoom
    xtile = (lon_deg + 180.0) / 360.0 * n
    ytile = (1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n
    return xtile, ytile


def load_parcels(path, taxlot_field="TAXLOT"):
    with open(path, "r") as f:
        gj = json.load(f)
    parcels = {}
    for feat in gj.get("features", []):
        taxlot = feat.get("properties", {}).get(taxlot_field)
        if taxlot is None:
            continue
        parcels[str(taxlot)] = shape(feat["geometry"])
    return parcels


def get_padded_bbox(polygon, padding_frac):
    """Returns (min_lon, min_lat, max_lon, max_lat) padded by a fraction
    of the polygon's own width/height on each side."""
    min_lon, min_lat, max_lon, max_lat = polygon.bounds
    width = max_lon - min_lon
    height = max_lat - min_lat
    pad_lon = width * padding_frac
    pad_lat = height * padding_frac
    return (min_lon - pad_lon, min_lat - pad_lat, max_lon + pad_lon, max_lat + pad_lat)


def fetch_tile(session, capture_base, zoom, x, y):
    url = f"{capture_base}/{zoom}/{x}/{y}.png"
    resp = session.get(url, timeout=15)
    if resp.status_code != 200:
        return None
    try:
        return Image.open(io.BytesIO(resp.content)).convert("RGB")
    except Exception:
        return None


def crop_nadir(session, capture_base, zoom, bbox, out_path):
    min_lon, min_lat, max_lon, max_lat = bbox

    # Fractional tile coords for the two corners. Note: latitude is
    # inverted in tile space (y increases southward), so max_lat gives
    # the smaller (northern) y value.
    x0f, y0f = deg2num(max_lat, min_lon, zoom)  # north-west corner
    x1f, y1f = deg2num(min_lat, max_lon, zoom)  # south-east corner

    tile_x0, tile_x1 = int(math.floor(x0f)), int(math.floor(x1f))
    tile_y0, tile_y1 = int(math.floor(y0f)), int(math.floor(y1f))

    tiles_wide = tile_x1 - tile_x0 + 1
    tiles_high = tile_y1 - tile_y0 + 1

    if tiles_wide <= 0 or tiles_high <= 0 or tiles_wide > 100 or tiles_high > 100:
        raise ValueError(f"unreasonable tile span {tiles_wide}x{tiles_high} — bbox likely wrong")

    canvas = Image.new("RGB", (tiles_wide * TILE_SIZE, tiles_high * TILE_SIZE), (0, 0, 0))
    missing = 0
    for tx in range(tile_x0, tile_x1 + 1):
        for ty in range(tile_y0, tile_y1 + 1):
            tile = fetch_tile(session, capture_base, zoom, tx, ty)
            if tile is None:
                missing += 1
                continue
            paste_x = (tx - tile_x0) * TILE_SIZE
            paste_y = (ty - tile_y0) * TILE_SIZE
            canvas.paste(tile, (paste_x, paste_y))

    if missing == tiles_wide * tiles_high:
        raise RuntimeError("no tiles could be fetched — check capture-base URL / zoom level")

    # Pixel offset of the exact bbox corners within the stitched canvas
    px0 = (x0f - tile_x0) * TILE_SIZE
    py0 = (y0f - tile_y0) * TILE_SIZE
    px1 = (x1f - tile_x0) * TILE_SIZE
    py1 = (y1f - tile_y0) * TILE_SIZE

    crop_box = (int(px0), int(py0), int(px1), int(py1))
    cropped = canvas.crop(crop_box)
    cropped.save(out_path, "JPEG", quality=90)
    return missing, tiles_wide * tiles_high


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--matches", required=True)
    ap.add_argument("--parcels", required=True)
    ap.add_argument("--parcel-taxlot-field", default="TAXLOT")
    ap.add_argument("--capture-base", required=True)
    ap.add_argument("--zoom", type=int, default=21)
    ap.add_argument("--padding", type=float, default=0.15)
    ap.add_argument("--out-dir", required=True)
    args = ap.parse_args()

    with open(args.matches, "r") as f:
        matches = json.load(f)

    parcels = load_parcels(args.parcels, args.parcel_taxlot_field)
    os.makedirs(args.out_dir, exist_ok=True)

    session = requests.Session()
    succeeded, skipped = 0, 0

    for prop in matches:
        taxlot = str(prop.get("taxlot"))
        name = prop.get("name") or prop.get("address") or taxlot

        parcel = parcels.get(taxlot)
        if parcel is None:
            print(f"[skip] no parcel geometry for {name} ({taxlot})", file=sys.stderr)
            skipped += 1
            continue

        bbox = get_padded_bbox(parcel, args.padding)
        out_path = os.path.join(args.out_dir, f"{taxlot}.jpg")

        try:
            missing, total = crop_nadir(session, args.capture_base, args.zoom, bbox, out_path)
            tag = f" ({missing}/{total} tiles missing)" if missing else ""
            print(f"[ok] {name} ({taxlot}) -> {out_path}{tag}")
            succeeded += 1
        except Exception as e:
            print(f"[skip] {name} ({taxlot}) failed: {e}", file=sys.stderr)
            skipped += 1
            continue

    print(f"\nDone: {succeeded} succeeded, {skipped} skipped", file=sys.stderr)


if __name__ == "__main__":
    main()
