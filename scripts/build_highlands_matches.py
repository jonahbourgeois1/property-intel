"""
build_highlands_matches.py

Builds the input file compute_frontage.py expects, but skips geocoding
entirely — every Highlands property already has address + lat/lng baked
into data/satellite/{hash}.json from the existing satellite pipeline. This
script just needs to:
  1. Read the Highlands property hash list from data/hoa/highlands.json
  2. Pull address/lat/lng from each data/satellite/{hash}.json
  3. Point-in-polygon match each (lat, lng) against the parcel GeoJSON to
     find its TAXLOT (this is the one piece match_properties_to_parcels.py
     would have done — no API key needed since coordinates already exist)

USAGE:
    python3 build_highlands_matches.py \
        --repo-root /path/to/property-intel \
        --parcels data/parcels/bend-5-21-26-parcels.geojson \
        --out highlands_matches.json

Output format matches compute_frontage.py's expected input:
[{"address": ..., "taxlot": ..., "lat": ..., "lon": ...}, ...]

Properties with no address, no coordinates, or no parcel match are skipped
and logged to stderr — same per-row error handling pattern used elsewhere
in this pipeline (generateNadirAutoRun, compute_frontage.py).
"""

import argparse
import json
import os
import sys

from shapely.geometry import shape, Point


def load_parcels(path, taxlot_field):
    with open(path, "r") as f:
        gj = json.load(f)
    parcels = []
    for feat in gj.get("features", []):
        taxlot = feat.get("properties", {}).get(taxlot_field)
        if taxlot is None:
            continue
        parcels.append((str(taxlot), shape(feat["geometry"])))
    return parcels


def find_taxlot(lat, lon, parcels):
    pt = Point(lon, lat)  # GeoJSON order is (lon, lat)
    for taxlot, geom in parcels:
        if geom.contains(pt):
            return taxlot
    return None


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--repo-root", required=True, help="Path to the property-intel repo root")
    ap.add_argument("--hoa-file", default="data/hoa/highlands.json", help="Relative path to the HOA property list")
    ap.add_argument("--satellite-dir", default="data/satellite", help="Relative path to per-property satellite JSON files")
    ap.add_argument("--parcels", required=True, help="Relative path to parcel GeoJSON")
    ap.add_argument("--parcel-taxlot-field", default="TAXLOT")
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    hoa_path = os.path.join(args.repo_root, args.hoa_file)
    sat_dir = os.path.join(args.repo_root, args.satellite_dir)
    parcels_path = os.path.join(args.repo_root, args.parcels)

    with open(hoa_path, "r") as f:
        hoa = json.load(f)

    parcels = load_parcels(parcels_path, args.parcel_taxlot_field)
    print(f"Loaded {len(parcels)} parcels", file=sys.stderr)

    results = []
    skipped = 0

    for prop_hash in hoa.get("properties", []):
        sat_path = os.path.join(sat_dir, f"{prop_hash}.json")
        if not os.path.exists(sat_path):
            print(f"[skip] no satellite file for {prop_hash}", file=sys.stderr)
            skipped += 1
            continue

        with open(sat_path, "r") as f:
            prop = json.load(f)

        address = prop.get("address")
        lat = prop.get("lat")
        lon = prop.get("lng")  # note: satellite files use "lng", compute_frontage.py expects "lon"

        if address is None or lat is None or lon is None:
            print(f"[skip] missing address/lat/lng for {prop_hash} ({prop.get('name', '?')})", file=sys.stderr)
            skipped += 1
            continue

        taxlot = find_taxlot(lat, lon, parcels)
        if taxlot is None:
            print(f"[skip] no parcel match for {prop.get('name', '?')} ({address}) at ({lat}, {lon})", file=sys.stderr)
            skipped += 1
            continue

        results.append({
            "name": prop.get("name"),
            "address": address,
            "taxlot": taxlot,
            "lat": lat,
            "lon": lon,
        })

    with open(args.out, "w") as f:
        json.dump(results, f, indent=2)

    print(f"\nDone: {len(results)}/{len(hoa.get('properties', []))} properties matched ({skipped} skipped)", file=sys.stderr)
    print(f"Saved to: {args.out}", file=sys.stderr)


if __name__ == "__main__":
    main()
