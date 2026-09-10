#!/usr/bin/env python3
"""Lot-clip Nearmap Vert + write observed.json for a delivery.

Operator script. Reads local serve-dir JPEGs + regions, and taxlot GeoJSON
from data/parcels (or --parcels-dir, or the public Pages URL). Writes:

  vert-lot.jpg          crop of vert.jpg to the taxlot bbox (padded)
  vert-lot-p1.jpg       Bedrock-sized crop (long edge 1600)
  lot.json              taxlot id + bounds + outer ring
  observed.json         areas + defensible-space distances (2D, no DSM)

Does not call GitHub. Does not upload (promote.py uploads whatever is in the
serve folder). Pin percents stay on the FULL vert.jpg — this crop is display
and Pass 1 vision only; Apps Script still converts hint lon/lat with sheet
(AOI) bounds.

DSM/DTM heights are not sampled here (canonical GeoTIFFs stay in ingest).
"""
from __future__ import annotations

import argparse
import json
import math
import urllib.request
from pathlib import Path

from PIL import Image

PARCEL_COUNTIES = [
    {"name": "deschutes", "lat0": 43.61, "lng0": -122.01, "step": 0.07},
    {"name": "lane", "lat0": 43.40, "lng0": -124.20, "step": 0.07},
]
PARCEL_PAGES = "https://responder-intel.vyanet.com/data/parcels/"
BEDROCK_LONG_EDGE = 1600
PAD_FRAC = 0.08
EARTH_A = 6378137.0
FT5_M = 1.524
FT30_M = 9.144
COVER = {
    "building": ["Building", "Building (Deprecated)", "Roof", "Translucent Roofing"],
    "drive": ["Driveway", "Asphalt", "Road (Driveable Surface)"],
    "veg": [
        "Woody Vegetation",
        "Tree Overhang",
        "Medium and High Vegetation (>2m)",
        "Medium and High Vegetation with Woody Vegetation",
        "Leaf-off Vegetation",
    ],
    "pool": ["Swimming Pool", "Water Body"],
}


def metres_per_deg_lat(lat: float) -> float:
    p = lat * math.pi / 180
    return 111132.954 - 559.822 * math.cos(2 * p) + 1.175 * math.cos(4 * p)


def metres_per_deg_lng(lat: float) -> float:
    return EARTH_A * math.pi / 180 * math.cos(lat * math.pi / 180)


def parcel_file_for(lat: float, lng: float, county: dict) -> str:
    lat_cell = math.floor((lat - county["lat0"]) / county["step"]) * county["step"] + county["lat0"]
    lng_cell = math.floor((lng - county["lng0"]) / county["step"]) * county["step"] + county["lng0"]
    return f"{county['name']}_{lat_cell:.2f}_{lng_cell:.2f}.geojson"


def point_in_ring(lat: float, lng: float, ring: list) -> bool:
    inside = False
    n = len(ring)
    if n < 4:
        return False
    j = n - 1
    for i in range(n):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if ((yi > lat) != (yj > lat)) and (lng < (xj - xi) * (lat - yi) / ((yj - yi) or 1e-12) + xi):
            inside = not inside
        j = i
    return inside


def poly_contains(poly: list, lat: float, lng: float) -> bool:
    if not poly or not poly[0] or len(poly[0]) < 4:
        return False
    if not point_in_ring(lat, lng, poly[0]):
        return False
    for hole in poly[1:]:
        if hole and len(hole) >= 4 and point_in_ring(lat, lng, hole):
            return False
    return True


def is_unaccounted(props: dict) -> bool:
    props = props or {}
    if str(props.get("ACCTNO") or "") == "000None":
        return True
    raw = str(props.get("TAXLOT") or "")
    if not raw.isdigit():
        return False
    return int(raw) in (77, 88, 99)


def feat_area(feat: dict) -> float:
    acres = feat.get("properties") or {}
    try:
        a = float(acres.get("MAPACRES") or 0)
        if a > 0:
            return a
    except (TypeError, ValueError):
        pass
    geom = feat.get("geometry") or {}
    polys = []
    if geom.get("type") == "Polygon":
        polys = [geom.get("coordinates") or []]
    elif geom.get("type") == "MultiPolygon":
        polys = geom.get("coordinates") or []
    s = 0.0
    for poly in polys:
        ring = poly[0] if poly else None
        if not ring:
            continue
        a = 0.0
        k = len(ring) - 1
        for j, pt in enumerate(ring):
            a += ring[k][0] * pt[1] - pt[0] * ring[k][1]
            k = j
        s += abs(a) / 2
    return s


def parcel_match(geojson: dict, lat: float, lng: float):
    best, best_area = None, float("inf")
    for f in (geojson or {}).get("features") or []:
        g = f.get("geometry") or {}
        if is_unaccounted(f.get("properties")):
            continue
        polys = []
        if g.get("type") == "Polygon":
            polys = [g.get("coordinates") or []]
        elif g.get("type") == "MultiPolygon":
            polys = g.get("coordinates") or []
        if not any(poly_contains(p, lat, lng) for p in polys):
            continue
        a = feat_area(f)
        if a < best_area:
            best, best_area = f, a
    return best


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def fetch_json(url: str):
    try:
        with urllib.request.urlopen(url, timeout=30) as r:
            if r.status != 200:
                return None
            return json.loads(r.read().decode("utf-8"))
    except Exception:
        return None


def load_parcel(lat: float, lng: float, parcels_dir: Path | None):
    names = [parcel_file_for(lat, lng, c) for c in PARCEL_COUNTIES]
    dirs = []
    if parcels_dir:
        dirs.append(parcels_dir)
    for name in names:
        for d in dirs:
            p = d / name
            if p.is_file():
                feat = parcel_match(load_json(p), lat, lng)
                if feat:
                    return feat
        feat = parcel_match(fetch_json(PARCEL_PAGES + name) or {}, lat, lng)
        if feat:
            return feat
    return None


def lot_polys(feat: dict) -> list:
    g = feat.get("geometry") or {}
    if g.get("type") == "Polygon":
        return [g.get("coordinates") or []]
    if g.get("type") == "MultiPolygon":
        return g.get("coordinates") or []
    return []


def lot_bounds(polys: list) -> dict:
    north = south = east = west = None
    for poly in polys:
        for pt in poly[0] or []:
            lng, lat = pt[0], pt[1]
            north = lat if north is None else max(north, lat)
            south = lat if south is None else min(south, lat)
            east = lng if east is None else max(east, lng)
            west = lng if west is None else min(west, lng)
    return {"north": north, "south": south, "east": east, "west": west}


def cap_long_edge(im: Image.Image, long_edge: int) -> Image.Image:
    w, h = im.size
    m = max(w, h)
    if m <= long_edge:
        return im
    scale = long_edge / m
    return im.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.Resampling.LANCZOS)


def save_jpeg(im: Image.Image, path: Path) -> None:
    im.convert("RGB").save(path, "JPEG", quality=85, optimize=True)


def crop_vert(im: Image.Image, aoi: dict, lot_b: dict, pad: float) -> tuple[Image.Image, dict]:
    w, h = im.size
    dlat = (lot_b["north"] - lot_b["south"]) * pad
    dlng = (lot_b["east"] - lot_b["west"]) * pad
    north = min(aoi["north"], lot_b["north"] + dlat)
    south = max(aoi["south"], lot_b["south"] - dlat)
    east = min(aoi["east"], lot_b["east"] + dlng)
    west = max(aoi["west"], lot_b["west"] - dlng)
    def x_of(lng):
        return int(round((lng - aoi["west"]) / (aoi["east"] - aoi["west"]) * w))
    def y_of(lat):
        return int(round((aoi["north"] - lat) / (aoi["north"] - aoi["south"]) * h))
    x0, x1 = sorted((max(0, x_of(west)), min(w, x_of(east))))
    y0, y1 = sorted((max(0, y_of(north)), min(h, y_of(south))))
    if x1 - x0 < 8 or y1 - y0 < 8:
        raise SystemExit("lot crop collapsed — check parcel match vs vert bounds")
    crop = im.crop((x0, y0, x1, y1))
    bounds = {"north": north, "south": south, "east": east, "west": west}
    return crop, bounds


def feature_class(f: dict) -> str:
    p = f.get("properties") or {}
    return str(p.get("class") or p.get("description") or "Unknown")


def feature_rings(f: dict) -> list:
    g = f.get("geometry") or {}
    if g.get("type") == "Polygon":
        return [g.get("coordinates") or []]
    if g.get("type") == "MultiPolygon":
        return g.get("coordinates") or []
    return []


def intersects_lot(f: dict, polys: list) -> bool:
    rings = feature_rings(f)
    for poly in rings:
        for pt in poly[0] or []:
            if any(poly_contains(lp, pt[1], pt[0]) for lp in polys):
                return True
    for lp in polys:
        for pt in lp[0] or []:
            if any(poly_contains(rp, pt[1], pt[0]) for rp in rings):
                return True
    return False


def ring_area_m2(ring, kx, ky, lng0, lat0) -> float:
    if not ring or len(ring) < 4:
        return 0.0
    pts = [((pt[0] - lng0) * kx, (pt[1] - lat0) * ky) for pt in ring]
    if abs(pts[0][0] - pts[-1][0]) < 1e-6 and abs(pts[0][1] - pts[-1][1]) < 1e-6:
        pts = pts[:-1]
    s = 0.0
    n = len(pts)
    if n < 3:
        return 0.0
    j = n - 1
    for i in range(n):
        s += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1]
        j = i
    return abs(s) / 2


def dist_point_seg(px, py, ax, ay, bx, by) -> float:
    dx, dy = bx - ax, by - ay
    l2 = dx * dx + dy * dy
    t = 0 if not l2 else ((px - ax) * dx + (py - ay) * dy) / l2
    t = 0 if t < 0 else 1 if t > 1 else t
    qx, qy = ax + t * dx, ay + t * dy
    return math.hypot(px - qx, py - qy)


def min_dist_m(rings_a, rings_b, kx, ky, lng0, lat0) -> float:
    best = float("inf")

    def verts(rings):
        out = []
        for ring in rings:
            for pt in ring:
                out.append(((pt[0] - lng0) * kx, (pt[1] - lat0) * ky))
        return out

    def segs(rings):
        out = []
        for ring in rings:
            for i in range(len(ring) - 1):
                a = ((ring[i][0] - lng0) * kx, (ring[i][1] - lat0) * ky)
                b = ((ring[i + 1][0] - lng0) * kx, (ring[i + 1][1] - lat0) * ky)
                out.append((a, b))
        return out

    va, sb = verts(rings_a), segs(rings_b)
    vb, sa = verts(rings_b), segs(rings_a)
    for p in va:
        for s in sb:
            best = min(best, dist_point_seg(p[0], p[1], s[0][0], s[0][1], s[1][0], s[1][1]))
    for p in vb:
        for s in sa:
            best = min(best, dist_point_seg(p[0], p[1], s[0][0], s[0][1], s[1][0], s[1][1]))
    return best


def observed_from_regions(fc: dict, polys: list, survey: str, taxlot: str) -> dict:
    feats = [f for f in (fc.get("features") or []) if intersects_lot(f, polys)]
    lng0, lat0 = polys[0][0][0]
    kx, ky = metres_per_deg_lng(lat0), metres_per_deg_lat(lat0)
    lot_area = 0.0
    for poly in polys:
        lot_area += ring_area_m2(poly[0], kx, ky, lng0, lat0)
        for hole in poly[1:]:
            lot_area -= ring_area_m2(hole, kx, ky, lng0, lat0)
    lot_area = max(0.0, lot_area)

    def area_of(classes):
        a = 0.0
        for f in feats:
            if feature_class(f) not in classes:
                continue
            for poly in feature_rings(f):
                a += ring_area_m2(poly[0], kx, ky, lng0, lat0)
                for hole in poly[1:]:
                    a -= ring_area_m2(hole, kx, ky, lng0, lat0)
        return min(max(0.0, a), lot_area) if lot_area else max(0.0, a)

    b_feats = [f for f in feats if feature_class(f) in COVER["building"]]
    v_feats = [f for f in feats if feature_class(f) in COVER["veg"]]
    b_rings = [poly[0] for f in b_feats for poly in feature_rings(f) if poly]
    min_d = None
    within_5 = within_30 = 0
    if b_rings and v_feats:
        min_d = float("inf")
        for f in v_feats:
            vr = [poly[0] for poly in feature_rings(f) if poly]
            d = min_dist_m(vr, b_rings, kx, ky, lng0, lat0)
            min_d = min(min_d, d)
            if d <= FT5_M:
                within_5 += 1
            if d <= FT30_M:
                within_30 += 1
        if min_d == float("inf"):
            min_d = None
    overhang = any(feature_class(f) == "Tree Overhang" for f in feats) or (
        min_d is not None and min_d < 0.5
    )
    veg_m2 = area_of(COVER["veg"])
    r1 = lambda n: round(n, 1) if n is not None else None
    return {
        "source": "lot_clip.py",
        "survey_date": survey,
        "taxlot": taxlot,
        "lot_area_m2": r1(lot_area),
        "building_m2": r1(area_of(COVER["building"])),
        "driveway_m2": r1(area_of(COVER["drive"])),
        "veg_m2": r1(veg_m2),
        "pool_m2": r1(area_of(COVER["pool"])),
        "roof_m2": r1(area_of(["Roof", "Translucent Roofing"])),
        "solar_m2": r1(area_of(["Solar Panel"])),
        "lawn_m2": r1(area_of(["Lawn Grass"])),
        "veg_pct_lot": r1(100 * veg_m2 / lot_area) if lot_area else None,
        "defensible": {
            "min_veg_to_building_m": r1(min_d),
            "within_5ft": within_5,
            "within_30ft": within_30,
            "overhang": bool(overhang),
        },
        "counts": {
            "building": len(b_feats),
            "drive": sum(1 for f in feats if feature_class(f) in COVER["drive"]),
            "veg": len(v_feats),
            "pool": sum(1 for f in feats if feature_class(f) in COVER["pool"]),
        },
    }


def clip_one(folder: Path, parcels_dir: Path | None, lat: float | None, lng: float | None) -> None:
    man_path = folder / "manifest.json"
    if not man_path.is_file():
        raise SystemExit(f"missing {man_path}")
    man = load_json(man_path)
    aoi = man.get("bounds") or {}
    if not all(k in aoi for k in ("north", "south", "east", "west")):
        raise SystemExit("manifest has no bounds")
    if lat is None:
        lat = (aoi["north"] + aoi["south"]) / 2
    if lng is None:
        lng = (aoi["east"] + aoi["west"]) / 2
    feat = load_parcel(lat, lng, parcels_dir)
    if not feat:
        raise SystemExit(f"no taxlot at {lat},{lng} (check parcels dir / Pages)")
    props = feat.get("properties") or {}
    taxlot = str(props.get("MAPTAXLOT") or props.get("TAXLOT") or "")
    polys = lot_polys(feat)
    lb = lot_bounds(polys)
    vert = folder / "vert.jpg"
    if not vert.is_file():
        raise SystemExit(f"missing {vert}")
    im = Image.open(vert)
    crop, crop_bounds = crop_vert(im, aoi, lb, PAD_FRAC)
    save_jpeg(crop, folder / "vert-lot.jpg")
    save_jpeg(cap_long_edge(crop, BEDROCK_LONG_EDGE), folder / "vert-lot-p1.jpg")
    regions = folder / "ai" / "edits" / "regions.json"
    if not regions.is_file():
        regions = folder / "ai" / "original" / "regions.json"
    fc = load_json(regions) if regions.is_file() else {"features": []}
    observed = observed_from_regions(fc, polys, man.get("survey_date") or "", taxlot)
    lot_doc = {
        "taxlot": taxlot,
        "bounds": lb,
        "crop_bounds": crop_bounds,
        "ring": polys[0][0] if polys and polys[0] else [],
    }
    (folder / "lot.json").write_text(json.dumps(lot_doc, indent=2), encoding="utf-8")
    (folder / "observed.json").write_text(json.dumps(observed, indent=2), encoding="utf-8")
    urls = man.setdefault("urls", {})
    did = man["delivery_id"]
    base = f"https://d3fg47bqswi0rr.cloudfront.net/nearmap/{did}"
    urls["vert_lot"] = f"{base}/vert-lot.jpg"
    urls["vert_lot_p1"] = f"{base}/vert-lot-p1.jpg"
    urls["observed"] = f"{base}/observed.json"
    urls["lot"] = f"{base}/lot.json"
    man["bounds_lot"] = lb
    man["taxlot"] = taxlot
    man_path.write_text(json.dumps(man, indent=2), encoding="utf-8")
    print(f"  vert-lot.jpg {crop.size[0]}x{crop.size[1]} taxlot {taxlot}")
    print(f"  observed lot {observed['lot_area_m2']} m2  building {observed['building_m2']}  veg {observed['veg_m2']}")


def main() -> int:
    ap = argparse.ArgumentParser(description="Clip Nearmap Vert to taxlot; write observed.json")
    ap.add_argument("--serve-dir", required=True)
    ap.add_argument("--delivery", default="")
    ap.add_argument("--parcels-dir", default="")
    ap.add_argument("--lat", type=float, default=None)
    ap.add_argument("--lng", type=float, default=None)
    args = ap.parse_args()
    root = Path(args.serve_dir)
    parcels = Path(args.parcels_dir) if args.parcels_dir else Path("data/parcels")
    if not parcels.is_dir():
        parcels = None
    folders = [root / args.delivery] if args.delivery else [
        p for p in root.iterdir() if p.is_dir() and (p / "manifest.json").is_file()
    ]
    if args.delivery and not folders[0].is_dir():
        raise SystemExit(f"delivery folder not found: {folders[0]}")
    for folder in folders:
        print("Lot-clip", folder.name)
        clip_one(folder, parcels, args.lat, args.lng)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
