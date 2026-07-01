"""
compute_frontage.py

Derives each property's frontage direction from its address point relative to
its matched parcel polygon, then computes the four oblique capture azimuths
(alpha/bravo/charlie/delta) relative to that frontage.

WHY THIS APPROACH:
The address point is placed at the road-facing entry to a parcel (driveway /
mailbox side), so the parcel edge nearest the address point is the frontage
edge. The outward normal of that edge (pointing toward the address point,
away from the parcel interior) gives the frontage bearing. Obliques are then
defined relative to that bearing so "alpha" always means "front-left" no
matter which way the property actually faces on the compass.

INPUT 1 — matches JSON (output of match_properties_to_parcels.py):
[
  {"address": "123 Main St", "taxlot": "181102D000600", "lat": 44.123, "lon": -121.456},
  ...
]
Field names are configurable via --address-field/--taxlot-field/--lat-field/--lon-field
if your actual output uses different keys.

INPUT 2 — parcels GeoJSON (Deschutes County parcel layer already in the repo):
FeatureCollection where each Feature's properties contain a taxlot ID field
(default assumed key: "TAXLOT" — override with --parcel-taxlot-field if different).
Geometry assumed in EPSG:4326 (lat/lon) as-is from county export; reproject
with --parcel-epsg if the file is already in a projected CRS.

OUTPUT — JSON:
[
  {
    "address": "123 Main St",
    "taxlot": "181102D000600",
    "frontage_bearing_deg": 187.4,
    "polar_deg": 45,
    "views": {
      "alpha":   142.4,   # front-left
      "bravo":   232.4,   # front-right
      "charlie": 322.4,   # rear-right
      "delta":   52.4     # rear-left
    }
  },
  ...
]

Properties that fail to match a taxlot, or whose geometry is unusable, are
skipped and logged to stderr rather than aborting the whole batch — matches
the per-row error handling pattern already used in generateNadirAutoRun.

USAGE:
    python3 compute_frontage.py \
        --matches highlands_matches.json \
        --parcels deschutes_parcels.geojson \
        --out frontage_output.json
"""

import argparse
import json
import math
import sys

# ── OBJ-local <-> ECEF transform ─────────────────────────────────────────
# Copied EXACTLY from clip_parcel_textured.py — this must stay in sync with
# that file, since it's the same BlockR.obj export and the same transform
# matrix. Used here only to convert an address point's lat/lon into the
# GLB's local (x, y) plane, so model-viewer.html can center its oblique
# framing on the actual house location instead of guessing from mesh
# geometry alone (which proved unreliable on sloped terrain — a tall,
# wide hillside can out-compete a small house footprint in a pure
# height/density clustering approach).
_M = [
    0.8538393068677613, -0.5205366827108161, 0.0, 0.0,
    0.3618967178637809,  0.5936212624426974, 0.7187799123343397, 0.0,
   -0.3741513111656884, -0.6137225421380228, 0.6952376842667829, 0.0,
   -2390834.612219335,  -3921699.7301742565, 4412849.998474161,  1.0
]
_R = [[_M[0], _M[4], _M[8]], [_M[1], _M[5], _M[9]], [_M[2], _M[6], _M[10]]]
_T = [_M[12], _M[13], _M[14]]
_R_T = [[_R[j][i] for j in range(3)] for i in range(3)]

_WGS84_A, _WGS84_E2 = 6378137.0, 0.00669437999014


def _geodetic_to_ecef(lat, lon, h=0.0):
    lat, lon = math.radians(lat), math.radians(lon)
    sl = math.sin(lat)
    N = _WGS84_A / math.sqrt(1 - _WGS84_E2 * sl * sl)
    return ((N + h) * math.cos(lat) * math.cos(lon),
            (N + h) * math.cos(lat) * math.sin(lon),
            (N * (1 - _WGS84_E2) + h) * sl)


def _ecef_to_local(ex, ey, ez):
    dx, dy, dz = ex - _T[0], ey - _T[1], ez - _T[2]
    return (_R_T[0][0]*dx + _R_T[0][1]*dy + _R_T[0][2]*dz,
            _R_T[1][0]*dx + _R_T[1][1]*dy + _R_T[1][2]*dz,
            _R_T[2][0]*dx + _R_T[2][1]*dy + _R_T[2][2]*dz)


def latlon_to_local_xy(lat, lon):
    """Returns (x, y) in the GLB's local frame. Z is intentionally not
    returned here — it depends on assumed elevation, which we don't know
    precisely per-property, and isn't needed since model-viewer.html
    samples the actual mesh height at this (x, y) directly instead."""
    x, y, _z = _ecef_to_local(*_geodetic_to_ecef(lat, lon, h=0.0))
    return x, y

from pyproj import Transformer
from shapely.geometry import shape, Point
from shapely.ops import nearest_points, transform as shapely_transform

# Local project CRS already used elsewhere in the pipeline (Bend / Deschutes
# County area) — see model-viewer.html / Bowring ECEF conversion notes.
PROJECTED_EPSG = "EPSG:32610"
SOURCE_EPSG = "EPSG:4326"

OBLIQUE_OFFSETS = {
    "alpha": 0,     # front — straight-on, inline with the driveway/frontage
    "bravo": 90,    # right side
    "charlie": 180, # rear
    "delta": 270,   # left side
}
DEFAULT_POLAR_DEG = 25


def normalize_bearing(deg):
    return deg % 360.0


def bearing_from_vector(dx, dy):
    """dx = east component, dy = north component, both in projected meters.
    Returns compass bearing in degrees (0 = North, 90 = East)."""
    return normalize_bearing(math.degrees(math.atan2(dx, dy)))


def load_parcels(path, taxlot_field, parcel_epsg):
    with open(path, "r") as f:
        gj = json.load(f)

    to_projected = Transformer.from_crs(parcel_epsg, PROJECTED_EPSG, always_xy=True).transform

    parcels = {}
    for feat in gj.get("features", []):
        props = feat.get("properties", {})
        taxlot = props.get(taxlot_field)
        if taxlot is None:
            continue
        geom = shape(feat["geometry"])
        try:
            geom_proj = shapely_transform(to_projected, geom)
        except Exception as e:
            print(f"[warn] failed to project parcel {taxlot}: {e}", file=sys.stderr)
            continue
        parcels[str(taxlot)] = geom_proj
    return parcels


def frontage_bearing_for_parcel(parcel_polygon, address_point_proj):
    """Finds the parcel exterior edge nearest the address point and returns
    the outward-facing compass bearing of that edge (i.e. the direction
    pointing from the parcel toward the road/address point)."""

    exterior_coords = list(parcel_polygon.exterior.coords)
    centroid = parcel_polygon.centroid

    best_dist = None
    best_bearing = None

    for i in range(len(exterior_coords) - 1):
        x1, y1 = exterior_coords[i]
        x2, y2 = exterior_coords[i + 1]

        from shapely.geometry import LineString
        edge = LineString([(x1, y1), (x2, y2)])
        dist = address_point_proj.distance(edge)

        if best_dist is not None and dist >= best_dist:
            continue

        # Edge direction vector
        ex, ey = (x2 - x1), (y2 - y1)
        edge_len = math.hypot(ex, ey)
        if edge_len == 0:
            continue

        # Two candidate outward normals (perpendicular to edge)
        n1 = (ey / edge_len, -ex / edge_len)
        n2 = (-ey / edge_len, ex / edge_len)

        mid = ((x1 + x2) / 2.0, (y1 + y2) / 2.0)

        # The TRUE outward-facing normal points away from the parcel's own
        # centroid — this is a property of the polygon geometry alone and
        # must NOT be determined relative to the address point, because the
        # address point is typically INSIDE the parcel (on the interior side
        # of the frontage edge), not beyond it. Using "toward the address
        # point" here would pick the inward normal by mistake whenever the
        # address sits well inside the lot.
        to_centroid = (centroid.x - mid[0], centroid.y - mid[1])

        dot1 = n1[0] * to_centroid[0] + n1[1] * to_centroid[1]
        dot2 = n2[0] * to_centroid[0] + n2[1] * to_centroid[1]
        # Pick whichever normal points AWAY from the centroid (negative dot
        # product with the vector toward the centroid).
        outward = n1 if dot1 < dot2 else n2

        best_dist = dist
        best_bearing = bearing_from_vector(outward[0], outward[1])

    return best_bearing, best_dist


def process(matches_path, parcels_path, out_path, address_field, taxlot_field,
            lat_field, lon_field, parcel_taxlot_field, parcel_epsg, polar_deg):

    with open(matches_path, "r") as f:
        matches = json.load(f)

    parcels = load_parcels(parcels_path, parcel_taxlot_field, parcel_epsg)
    to_projected = Transformer.from_crs(SOURCE_EPSG, PROJECTED_EPSG, always_xy=True).transform

    results = []
    skipped = 0

    for row in matches:
        address = row.get(address_field)
        taxlot = row.get(taxlot_field)
        lat = row.get(lat_field)
        lon = row.get(lon_field)

        if taxlot is None or lat is None or lon is None:
            print(f"[skip] missing fields for row: {row}", file=sys.stderr)
            skipped += 1
            continue

        taxlot = str(taxlot)
        parcel = parcels.get(taxlot)
        if parcel is None:
            print(f"[skip] no parcel geometry found for taxlot {taxlot} ({address})", file=sys.stderr)
            skipped += 1
            continue

        px, py = to_projected(lon, lat)
        address_point_proj = Point(px, py)

        try:
            bearing, dist = frontage_bearing_for_parcel(parcel, address_point_proj)
        except Exception as e:
            print(f"[skip] frontage calc failed for {taxlot} ({address}): {e}", file=sys.stderr)
            skipped += 1
            continue

        if bearing is None:
            print(f"[skip] could not resolve frontage edge for {taxlot} ({address})", file=sys.stderr)
            skipped += 1
            continue

        views = {
            name: normalize_bearing(bearing + offset)
            for name, offset in OBLIQUE_OFFSETS.items()
        }

        focus_x, focus_y = latlon_to_local_xy(lat, lon)

        results.append({
            "address": address,
            "taxlot": taxlot,
            "frontage_bearing_deg": round(bearing, 1),
            "address_to_edge_distance_m": round(dist, 1),
            "polar_deg": polar_deg,
            "views": {k: round(v, 1) for k, v in views.items()},
            "focus_x": round(focus_x, 2),
            "focus_y": round(focus_y, 2),
        })

    with open(out_path, "w") as f:
        json.dump(results, f, indent=2)

    print(f"Wrote {len(results)} properties to {out_path} ({skipped} skipped)", file=sys.stderr)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--matches", required=True, help="Path to match_properties_to_parcels.py output JSON")
    ap.add_argument("--parcels", required=True, help="Path to Deschutes County parcel GeoJSON")
    ap.add_argument("--out", required=True, help="Path to write frontage/oblique output JSON")
    ap.add_argument("--address-field", default="address")
    ap.add_argument("--taxlot-field", default="taxlot")
    ap.add_argument("--lat-field", default="lat")
    ap.add_argument("--lon-field", default="lon")
    ap.add_argument("--parcel-taxlot-field", default="TAXLOT")
    ap.add_argument("--parcel-epsg", default=SOURCE_EPSG, help="CRS of the parcel GeoJSON as-provided (default EPSG:4326)")
    ap.add_argument("--polar-deg", type=float, default=DEFAULT_POLAR_DEG, help="Fixed oblique tilt angle to record alongside azimuths")
    args = ap.parse_args()

    process(
        args.matches, args.parcels, args.out,
        args.address_field, args.taxlot_field, args.lat_field, args.lon_field,
        args.parcel_taxlot_field, args.parcel_epsg, args.polar_deg,
    )


if __name__ == "__main__":
    main()
