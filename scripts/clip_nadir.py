"""
clip_nadir.py

Generates the nadir (straight-down) view for each property by cropping
directly from the existing georeferenced 2D tile pyramid — the same
imagery already serving the live map viewer.

HOW IT WORKS:
  1. Look up the property's parcel polygon (by taxlot) to get its exact
     lat/lon bounding box.
  2. Pad that box by a percentage so the property isn't cropped
     edge-to-edge with zero margin.
  3. Convert the padded bbox to pixel coordinates in the tile pyramid's
     global pixel space at a chosen zoom level (default 21).
  4. Determine which tiles cover that pixel region, download them
     concurrently, and stitch them into one canvas.
  5. Crop the canvas to the exact padded-bbox pixel region and save.

AUTO ZOOM (optional, --auto-zoom):
  This is the same selectBestZoom() pattern from the Apps Script, applied
  more directly than in the oblique pipeline — nadir crops from this
  script ARE the same kind of straight-down aerial image the Apps Script
  already generates from Google Static Maps, just sourced from the drone
  tile pyramid instead. Rather than trusting one fixed padding percentage
  for every property, this generates 3 candidate crops (tight/medium/wide
  padding) and asks Claude (via AWS Bedrock — same credentials/pipeline
  the Apps Script already uses) to pick the best-framed one.

INPUT:
  --matches       highlands_matches.json (address/taxlot/lat/lon) — only
                  used to get the taxlot list and property names.
  --parcels       Parcel GeoJSON.
  --capture-base  Base tile URL for the capture.
  --zoom          Tile zoom level to crop from (default 21).
  --padding       Fixed padding fraction (used when --auto-zoom is NOT set).
  --auto-zoom     Enable AI-based padding selection via Bedrock.
  --padding-candidates
                  Comma-separated padding fractions to try with
                  --auto-zoom, ordered tightest-to-widest
                  (default "0.05,0.15,0.35").
  --bedrock-region, --bedrock-model
                  AWS Bedrock settings for the selection call.
  --out-dir       Output directory for nadir JPGs, one per taxlot.

USAGE (fixed padding, original behavior):
    python3 clip_nadir.py \
        --matches highlands_matches.json --parcels bend-5-21-26-parcels.geojson \
        --capture-base https://d3fg47bqswi0rr.cloudfront.net/captures/plane/bend-5-21-26/map \
        --out-dir nadir_captures --padding 0.15

USAGE (AI-selected padding):
    python3 clip_nadir.py \
        --matches highlands_matches.json --parcels bend-5-21-26-parcels.geojson \
        --capture-base https://d3fg47bqswi0rr.cloudfront.net/captures/plane/bend-5-21-26/map \
        --out-dir nadir_captures --auto-zoom
"""

import argparse
import base64
import io
import json
import math
import os
import shutil
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
from PIL import Image
from shapely.geometry import shape

# Our own tile-span sanity guard (max 100x100 tiles = ~655M pixels at
# 256px tiles) already bounds canvas size to a known-reasonable maximum
# for real property crops — PIL's generic decompression-bomb heuristic
# doesn't know that and just adds noise to the output for legitimately
# large (but expected and already-bounded) stitched tiles.
Image.MAX_IMAGE_PIXELS = None

TILE_SIZE = 256
DEFAULT_BEDROCK_MODEL = "us.anthropic.claude-sonnet-4-6"

# Closely mirrors ZOOM_PROMPT_RESIDENTIAL from the Apps Script — this is
# the same task (pick the best-framed straight-down property image from a
# few candidates), just applied to drone tile crops instead of Google
# Static Maps zoom levels.
NADIR_PADDING_SELECTION_PROMPT = """You are selecting the best-framed nadir (straight-down) aerial image of a single residential property from three candidate crops. All three are centered on the same property, cropped from the same source imagery, with different amounts of surrounding context.

Image 1 is the tightest crop (closest to the parcel boundary, least surrounding context).
Image 2 is a medium crop.
Image 3 is the widest crop (most surrounding context, most neighboring land visible).

The objective is to clearly display:
- The residence and any detached structures
- Driveways and access routes
- Rear-yard and side-yard areas
- Pools, recreation areas, and major landscape features

Rules:
If the target property occupies less than 25% of the image area in image 3, prefer image 1 or image 2 instead.
If the property is a small lot with boundaries close to neighboring properties, prefer a tighter crop.
If the property is a large or irregularly shaped parcel, more surrounding context (image 2 or image 3) is appropriate.
If any image contains a large solid black region (missing imagery, common near the edge of drone capture coverage), avoid selecting it unless every option has the same problem — prefer the option with the least missing imagery.
The selected image must show the target property clearly without cropping out any part of the main residence or its immediate grounds, and without excessive irrelevant neighboring context.

Return ONLY a single integer: 1, 2, or 3. No other text."""


def select_best_padding_via_bedrock(candidate_paths, region, model_id):
    """Sends the candidate JPEGs to Claude via Bedrock and returns the
    0-indexed selection. Falls back to the middle candidate on any
    failure — matches the Apps Script's selectBestZoom() fallback-to-19
    behavior rather than crashing the batch over one bad API response."""
    fallback_index = len(candidate_paths) // 2

    try:
        import boto3
    except ImportError:
        print("[warn] boto3 not installed — falling back to middle padding candidate. "
              "Install with: pip install boto3 --break-system-packages", file=sys.stderr)
        return fallback_index

    try:
        content = []
        for path in candidate_paths:
            # Nadir crops scale with real property size (unlike oblique's
            # fixed 1600x1200 browser screenshots), so large properties with
            # generous padding can exceed Bedrock's 8000px image limit —
            # this caused every large-property selection call to silently
            # fail validation and fall back to the middle candidate,
            # without ever actually being seen by the model. Downscale a
            # copy just for the API call; the full-resolution original is
            # still what gets saved as the final output.
            img = Image.open(path)
            img.thumbnail((1568, 1568), Image.LANCZOS)
            buf = io.BytesIO()
            img.convert("RGB").save(buf, format="JPEG", quality=85)
            img_b64 = base64.b64encode(buf.getvalue()).decode("ascii")
            content.append({"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": img_b64}})
        content.append({"type": "text", "text": f"Images show option 1 (tightest) through option {len(candidate_paths)} (widest). Return ONLY the number of the best-framed option."})

        payload = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 5,
            "system": NADIR_PADDING_SELECTION_PROMPT,
            "messages": [{"role": "user", "content": content}],
        }

        client = boto3.client("bedrock-runtime", region_name=region)
        response = client.invoke_model(
            modelId=model_id,
            body=json.dumps(payload),
            contentType="application/json",
            accept="application/json",
        )
        body = json.loads(response["body"].read())
        text = body["content"][0]["text"].strip()
        choice = int(text)
        if 1 <= choice <= len(candidate_paths):
            return choice - 1
        print(f"[warn] Bedrock returned out-of-range choice '{text}', using middle candidate", file=sys.stderr)
        return fallback_index
    except Exception as e:
        print(f"[warn] Bedrock padding selection failed ({e}), using middle candidate", file=sys.stderr)
        return fallback_index


def load_capture_tile_extent(captures_json_path, capture_id, zoom):
    """Reads the DECLARED tile coverage bounds for a capture at a given
    zoom level from captures.json — this is the 2D tile pyramid's actual
    coverage, which is NOT the same as the 3D OBJ mesh's coverage (we
    confirmed properties exist with real 3D vertices but zero 2D tile
    overlap, and vice versa). Returns (x_min, x_max, y_min, y_max) in
    tile coordinates, or None if not found."""
    with open(captures_json_path, "r") as f:
        data = json.load(f)
    for cap in data.get("captures", []):
        if cap.get("id") == capture_id:
            extent = cap.get("tile_extents", {}).get(str(zoom))
            if extent:
                return extent["x"][0], extent["x"][1], extent["y"][0], extent["y"][1]
    return None


def bbox_coverage_overlap_fraction(bbox, zoom, extent):
    """Returns what fraction of a lat/lon bbox's required tile AREA falls
    within the capture's declared 2D tile extent — a fractional overlap
    rather than strict all-or-nothing containment, since captures.json's
    'bounds' is a simple rectangle around an inherently diagonal, irregular
    capture strip and can be slightly conservative near the edges. Uses
    fractional (non-floored) tile coordinates for a precise area
    calculation, not the floored integer tile indices used elsewhere for
    actual tile fetching."""
    min_lon, min_lat, max_lon, max_lat = bbox
    x0f, y0f = deg2num(max_lat, min_lon, zoom)
    x1f, y1f = deg2num(min_lat, max_lon, zoom)

    ext_x_min, ext_x_max, ext_y_min, ext_y_max = extent

    overlap_x = max(0.0, min(x1f, ext_x_max + 1) - max(x0f, ext_x_min))
    overlap_y = max(0.0, min(y1f, ext_y_max + 1) - max(y0f, ext_y_min))
    overlap_area = overlap_x * overlap_y

    needed_area = (x1f - x0f) * (y1f - y0f)
    if needed_area <= 0:
        return 0.0
    return overlap_area / needed_area


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
    resp = session.get(url, timeout=8)
    if resp.status_code != 200:
        return None
    try:
        return Image.open(io.BytesIO(resp.content)).convert("RGB")
    except Exception:
        return None


def crop_nadir(session, capture_base, zoom, bbox, out_path):
    min_lon, min_lat, max_lon, max_lat = bbox

    x0f, y0f = deg2num(max_lat, min_lon, zoom)  # north-west corner
    x1f, y1f = deg2num(min_lat, max_lon, zoom)  # south-east corner

    tile_x0, tile_x1 = int(math.floor(x0f)), int(math.floor(x1f))
    tile_y0, tile_y1 = int(math.floor(y0f)), int(math.floor(y1f))

    tiles_wide = tile_x1 - tile_x0 + 1
    tiles_high = tile_y1 - tile_y0 + 1

    if tiles_wide <= 0 or tiles_high <= 0 or tiles_wide > 100 or tiles_high > 100:
        raise ValueError(f"unreasonable tile span {tiles_wide}x{tiles_high} — bbox likely wrong")

    tile_coords = [(tx, ty) for tx in range(tile_x0, tile_x1 + 1) for ty in range(tile_y0, tile_y1 + 1)]
    canvas = Image.new("RGB", (tiles_wide * TILE_SIZE, tiles_high * TILE_SIZE), (0, 0, 0))
    missing = 0

    with ThreadPoolExecutor(max_workers=16) as executor:
        future_to_coord = {
            executor.submit(fetch_tile, session, capture_base, zoom, tx, ty): (tx, ty)
            for tx, ty in tile_coords
        }
        for future in as_completed(future_to_coord):
            tx, ty = future_to_coord[future]
            tile = future.result()
            if tile is None:
                missing += 1
                continue
            paste_x = (tx - tile_x0) * TILE_SIZE
            paste_y = (ty - tile_y0) * TILE_SIZE
            canvas.paste(tile, (paste_x, paste_y))

    if missing == tiles_wide * tiles_high:
        raise RuntimeError("no tiles could be fetched — check capture-base URL / zoom level")

    px0 = (x0f - tile_x0) * TILE_SIZE
    py0 = (y0f - tile_y0) * TILE_SIZE
    px1 = (x1f - tile_x0) * TILE_SIZE
    py1 = (y1f - tile_y0) * TILE_SIZE

    crop_box = (int(px0), int(py0), int(px1), int(py1))
    cropped = canvas.crop(crop_box)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    cropped.save(out_path, "JPEG", quality=90)
    return missing, tiles_wide * tiles_high


def process_property(session, capture_base, zoom, parcel, taxlot, name, out_dir,
                      fixed_padding, auto_zoom, padding_candidates, bedrock_region, bedrock_model,
                      max_missing_fraction, tile_extent, min_coverage_overlap):
    final_path = os.path.join(out_dir, f"{taxlot}.jpg")

    if not auto_zoom:
        bbox = get_padded_bbox(parcel, fixed_padding)
        if tile_extent:
            overlap = bbox_coverage_overlap_fraction(bbox, zoom, tile_extent)
            if overlap < min_coverage_overlap:
                raise RuntimeError(
                    f"property's padded bounds only overlap {overlap:.0%} of the 2D tile pyramid's "
                    f"declared coverage (need at least {min_coverage_overlap:.0%}) — "
                    f"skipping before any fetch attempt"
                )
        missing, total = crop_nadir(session, capture_base, zoom, bbox, final_path)
        missing_frac = missing / total if total else 1.0
        if missing_frac > max_missing_fraction:
            # Remove the degraded output rather than leaving a mostly-black
            # image on disk that looks like a success at a glance.
            if os.path.exists(final_path):
                os.remove(final_path)
            raise RuntimeError(
                f"crop is {missing_frac:.0%} missing tiles (limit {max_missing_fraction:.0%}) — "
                f"the parcel's full bounds likely extend beyond real capture coverage, "
                f"even though part of the property may be covered"
            )
        tag = f" ({missing}/{total} tiles missing)" if missing else ""
        print(f"[ok] {name} ({taxlot}) -> {final_path}{tag}")
        return

    # Auto-zoom: generate one candidate per padding level, ask Bedrock to
    # pick the best-framed one. Candidates that fail the completeness
    # threshold are excluded entirely BEFORE Bedrock sees them — asking an
    # AI to pick "the least bad of three bad options" produces a plausible-
    # sounding but still-unusable result, when the honest answer is that
    # this property's full parcel bounds don't fit within real coverage.
    tightest_padding = min(padding_candidates)
    tightest_bbox = get_padded_bbox(parcel, tightest_padding)
    if tile_extent:
        overlap = bbox_coverage_overlap_fraction(tightest_bbox, zoom, tile_extent)
        if overlap < min_coverage_overlap:
            raise RuntimeError(
                f"even the tightest padding ({tightest_padding:.0%}) only overlaps {overlap:.0%} of the "
                f"2D tile pyramid's declared coverage (need at least {min_coverage_overlap:.0%}) — "
                f"skipping before any fetch attempt"
            )

    candidate_dir = os.path.join(out_dir, "_candidates", taxlot)
    candidate_paths = []
    all_missing_fractions = []
    for i, pad in enumerate(padding_candidates):
        cand_path = os.path.join(candidate_dir, f"option{i+1}_pad{pad}.jpg")
        bbox = get_padded_bbox(parcel, pad)
        try:
            missing, total = crop_nadir(session, capture_base, zoom, bbox, cand_path)
            missing_frac = missing / total if total else 1.0
            all_missing_fractions.append(missing_frac)
            if missing_frac > max_missing_fraction:
                print(f"[warn] {name} ({taxlot}) candidate pad={pad} rejected: "
                      f"{missing_frac:.0%} missing tiles (limit {max_missing_fraction:.0%})", file=sys.stderr)
                if os.path.exists(cand_path):
                    os.remove(cand_path)
                continue
            candidate_paths.append(cand_path)
        except Exception as e:
            print(f"[warn] {name} ({taxlot}) candidate pad={pad} failed: {e}", file=sys.stderr)

    if not candidate_paths:
        worst = f", best candidate still had {min(all_missing_fractions):.0%} missing" if all_missing_fractions else ""
        raise RuntimeError(
            f"no padding candidate met the {max_missing_fraction:.0%} coverage threshold{worst} — "
            f"the parcel's full bounds likely extend beyond real capture coverage"
        )

    chosen_index = select_best_padding_via_bedrock(candidate_paths, bedrock_region, bedrock_model)
    chosen_index = min(chosen_index, len(candidate_paths) - 1)

    os.makedirs(os.path.dirname(final_path), exist_ok=True)
    shutil.copy(candidate_paths[chosen_index], final_path)
    chosen_pad = padding_candidates[chosen_index] if chosen_index < len(padding_candidates) else "?"
    print(f"[ok] {name} ({taxlot}) -> {final_path} (auto-zoom selected option {chosen_index+1}, padding={chosen_pad})")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--matches", required=True)
    ap.add_argument("--parcels", required=True)
    ap.add_argument("--parcel-taxlot-field", default="TAXLOT")
    ap.add_argument("--capture-base", required=True)
    ap.add_argument("--captures-json", default=None, help="Path to captures.json — if provided along with --capture-id, properties whose bounds fall outside the DECLARED 2D tile coverage are skipped before any fetch attempt (this checks the 2D tile pyramid's coverage, not the 3D mesh's, which can differ).")
    ap.add_argument("--capture-id", default=None, help="Capture ID to look up in captures.json, e.g. 'bend-5-21-26'.")
    ap.add_argument("--min-coverage-overlap", type=float, default=0.80, help="Minimum fraction (0-1) of a property's padded bounds that must overlap the declared 2D tile coverage to attempt it at all (default 0.80). Properties below this are skipped before any fetch attempt.")
    ap.add_argument("--zoom", type=int, default=21)
    ap.add_argument("--padding", type=float, default=0.15, help="Fixed padding fraction, used when --auto-zoom is NOT set.")
    ap.add_argument("--auto-zoom", action="store_true", help="Enable AI-based padding selection via AWS Bedrock (3 candidates, mirrors the Apps Script's selectBestZoom()).")
    ap.add_argument("--padding-candidates", default="0.05,0.15,0.35", help="Comma-separated padding fractions to try with --auto-zoom, ordered tightest-to-widest.")
    ap.add_argument("--bedrock-region", default="us-east-1")
    ap.add_argument("--bedrock-model", default=DEFAULT_BEDROCK_MODEL)
    ap.add_argument("--out-dir", required=True)
    ap.add_argument("--max-missing-fraction", type=float, default=0.15, help="Reject a crop/candidate if more than this fraction of its tiles are missing (default 0.15 = 15%%). Prevents accepting a mostly-black image just because it's the least-bad of the options generated.")
    args = ap.parse_args()

    padding_candidates = [float(p.strip()) for p in args.padding_candidates.split(",")]

    with open(args.matches, "r") as f:
        matches = json.load(f)

    parcels = load_parcels(args.parcels, args.parcel_taxlot_field)
    os.makedirs(args.out_dir, exist_ok=True)

    tile_extent = None
    if args.captures_json and args.capture_id:
        tile_extent = load_capture_tile_extent(args.captures_json, args.capture_id, args.zoom)
        if tile_extent:
            print(f"Loaded 2D tile coverage bounds for '{args.capture_id}' at z{args.zoom}: "
                  f"x={tile_extent[0]}-{tile_extent[1]}, y={tile_extent[2]}-{tile_extent[3]}", file=sys.stderr)
        else:
            print(f"[warn] could not find tile_extents for capture '{args.capture_id}' at z{args.zoom} "
                  f"in {args.captures_json} — coverage pre-check disabled", file=sys.stderr)

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

        try:
            process_property(session, args.capture_base, args.zoom, parcel, taxlot, name, args.out_dir,
                              args.padding, args.auto_zoom, padding_candidates, args.bedrock_region, args.bedrock_model,
                              args.max_missing_fraction, tile_extent, args.min_coverage_overlap)
            succeeded += 1
        except Exception as e:
            print(f"[skip] {name} ({taxlot}) failed: {e}", file=sys.stderr)
            skipped += 1
            continue

    print(f"\nDone: {succeeded} succeeded, {skipped} skipped", file=sys.stderr)


if __name__ == "__main__":
    main()
