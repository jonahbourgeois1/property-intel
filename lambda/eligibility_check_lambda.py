"""
eligibility_check_lambda.py — MULTI-CAPTURE (7/3/26)

Lightweight, fast, zip-based Lambda (no Chromium, no container image) that
checks a BATCH of addresses against real plane/drone mapping coverage in
one request — used by Apps Script's "Check Plane Eligibility" button to
scan the entire Satellite sheet in a single round trip rather than one
HTTP call per property.

MULTI-CAPTURE: captures are discovered dynamically from the registry
(reference/captures.json). A property is eligible if ANY enabled plane
capture covers it, checked NEWEST FIRST — so as new plane mappings are
flown and registered (see CAPTURE_ONBOARDING.md), previously-ineligible
properties become eligible on the next "Check Plane Eligibility" run with
zero code changes. Different captures may declare different zoom sets;
each capture is tested at its own highest declared zoom.

Uses the EXACT SAME criteria as the render Lambda's hard-stop gate (80%
overlap with declared 2D tile coverage at 15% padding) so a property
marked "eligible" here actually succeeds later in the render pipeline.

Reads reference data from S3 only — same git/AWS separation as the
render pipeline.

EXPECTED EVENT PAYLOAD (from Apps Script, one call for the whole batch):
{
  "addresses": [
    {"rowIndex": 5, "address": "123 Main St, Bend, OR"},
    {"rowIndex": 6, "address": "456 Oak Ave, Bend, OR"},
    ...
  ]
}

RESPONSE:
{
  "results": [
    {"rowIndex": 5, "eligible": true,  "taxlot": "181102A001400",
     "capture": "bend-5-21-26", "reason": "eligible (bend-5-21-26, 100% coverage)"},
    {"rowIndex": 6, "eligible": false, "taxlot": null, "capture": null,
     "reason": "bend-9-15-26: no parcel match; bend-5-21-26: 62% coverage (need 80%)"},
    ...
  ]
}

REQUIRED ENV VARS:
  REFERENCE_BUCKET, MAPS_API_KEY_SECRET_ARN
OPTIONAL (defaults follow the standard packaging convention):
  CAPTURES_KEY (reference/captures.json)
  PARCELS_KEY_TEMPLATE (reference/parcels/{capture_id}-parcels.geojson)

NOTE on scale: this runs synchronously (Apps Script waits for the
response), so it's bounded by API Gateway's 29-second limit. Geocoding
(~200-400ms per address) happens ONCE per address regardless of how many
captures exist; per-capture parcel data is cached in the warm container.
Comfortable for dozens to a couple hundred properties per batch call.
"""

import json
import math
import os

import boto3
import requests
from shapely.geometry import shape, Point

REFERENCE_BUCKET = os.environ["REFERENCE_BUCKET"]
MAPS_API_KEY_SECRET_ARN = os.environ["MAPS_API_KEY_SECRET_ARN"]
CAPTURES_KEY = os.environ.get("CAPTURES_KEY", "reference/captures.json")
PARCELS_KEY_TEMPLATE = os.environ.get(
    "PARCELS_KEY_TEMPLATE", "reference/parcels/{capture_id}-parcels.geojson")

ELIGIBILITY_PADDING = 0.15       # SAME as clip_nadir.py's default padding
MIN_COVERAGE_OVERLAP = 0.80      # SAME threshold as the render Lambda's hard stop

s3 = boto3.client("s3")
secrets = boto3.client("secretsmanager")
_cache = {}


def get_secret(arn):
    if arn not in _cache:
        _cache[arn] = secrets.get_secret_value(SecretId=arn)["SecretString"]
    return _cache[arn]


def load_reference_json(key):
    if key not in _cache:
        obj = s3.get_object(Bucket=REFERENCE_BUCKET, Key=key)
        _cache[key] = json.loads(obj["Body"].read())
    return _cache[key]


def list_plane_captures():
    """Enabled plane captures, NEWEST FIRST — mirrors the render Lambda's
    selection order exactly so eligibility predictions match render
    outcomes."""
    data = load_reference_json(CAPTURES_KEY)
    caps = [c for c in data.get("captures", [])
            if c.get("tile_extents")
            and c.get("type", "plane") == "plane"
            and c.get("enabled", True)]
    return sorted(caps, key=lambda c: str(c.get("captured", "")), reverse=True)


def capture_max_zoom(cap):
    return max(int(z) for z in cap["tile_extents"].keys())


def capture_tile_extent(cap, zoom):
    ext = cap.get("tile_extents", {}).get(str(zoom))
    if not ext:
        return None
    return ext["x"][0], ext["x"][1], ext["y"][0], ext["y"][1]


def load_parcels(capture_id):
    cache_key = "parcels::" + capture_id
    if cache_key not in _cache:
        gj = load_reference_json(PARCELS_KEY_TEMPLATE.format(capture_id=capture_id))
        parcels = {}
        for feat in gj.get("features", []):
            taxlot = feat.get("properties", {}).get("TAXLOT")
            if taxlot is not None:
                parcels[str(taxlot)] = shape(feat["geometry"])
        _cache[cache_key] = parcels
    return _cache[cache_key]


def geocode_address(address):
    key = get_secret(MAPS_API_KEY_SECRET_ARN)
    resp = requests.get(
        "https://maps.googleapis.com/maps/api/geocode/json",
        params={"address": address, "key": key}, timeout=8,
    )
    data = resp.json()
    if data.get("status") != "OK":
        return None
    loc = data["results"][0]["geometry"]["location"]
    return loc["lat"], loc["lng"]


def match_taxlot(lat, lon, parcels):
    pt = Point(lon, lat)
    for taxlot, geom in parcels.items():
        if geom.contains(pt):
            return taxlot
    return None


def deg2num(lat_deg, lon_deg, zoom):
    lat_rad = math.radians(lat_deg)
    n = 2.0 ** zoom
    xtile = (lon_deg + 180.0) / 360.0 * n
    ytile = (1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n
    return xtile, ytile


def get_padded_bbox(polygon, padding_frac):
    min_lon, min_lat, max_lon, max_lat = polygon.bounds
    pad_lon, pad_lat = (max_lon - min_lon) * padding_frac, (max_lat - min_lat) * padding_frac
    return (min_lon - pad_lon, min_lat - pad_lat, max_lon + pad_lon, max_lat + pad_lat)


def bbox_coverage_overlap_fraction(bbox, zoom, extent):
    """Identical logic to clip_nadir.py's function of the same name —
    kept in sync deliberately so eligibility here matches real outcomes
    later."""
    min_lon, min_lat, max_lon, max_lat = bbox
    x0f, y0f = deg2num(max_lat, min_lon, zoom)
    x1f, y1f = deg2num(min_lat, max_lon, zoom)
    ext_x_min, ext_x_max, ext_y_min, ext_y_max = extent
    overlap_x = max(0.0, min(x1f, ext_x_max + 1) - max(x0f, ext_x_min))
    overlap_y = max(0.0, min(y1f, ext_y_max + 1) - max(y0f, ext_y_min))
    overlap_area = overlap_x * overlap_y
    needed_area = (x1f - x0f) * (y1f - y0f)
    return overlap_area / needed_area if needed_area > 0 else 0.0


def check_one(address, captures):
    """Eligible if ANY capture qualifies, newest first. Ineligible
    responses carry a per-capture explanation, which doubles as the
    flight-planning signal for future captures."""
    coords = geocode_address(address)
    if coords is None:
        return {"eligible": False, "taxlot": None, "capture": None,
                "reason": "geocoding failed"}
    lat, lon = coords

    attempts = []
    for cap in captures:
        cid = cap["id"]
        try:
            parcels = load_parcels(cid)
        except Exception as e:
            attempts.append(cid + ": parcel data unavailable (" + str(e) + ")")
            continue
        taxlot = match_taxlot(lat, lon, parcels)
        if taxlot is None:
            attempts.append(cid + ": no parcel match")
            continue
        zoom = capture_max_zoom(cap)
        extent = capture_tile_extent(cap, zoom)
        if extent is None:
            attempts.append(cid + ": no tile extent at z" + str(zoom))
            continue
        bbox = get_padded_bbox(parcels[taxlot], ELIGIBILITY_PADDING)
        overlap = bbox_coverage_overlap_fraction(bbox, zoom, extent)
        if overlap < MIN_COVERAGE_OVERLAP:
            attempts.append("{}: {:.0%} coverage (need {:.0%})".format(
                cid, overlap, MIN_COVERAGE_OVERLAP))
            continue
        return {
            "eligible": True, "taxlot": taxlot, "capture": cid,
            "reason": "eligible ({}, {:.0%} coverage)".format(cid, overlap),
        }

    return {"eligible": False, "taxlot": None, "capture": None,
            "reason": "; ".join(attempts) if attempts else "no enabled plane captures"}


def lambda_handler(event, context):
    body = event.get("body", event)  # tolerate both direct invoke and API Gateway proxy shapes
    if isinstance(body, str):
        body = json.loads(body)

    addresses = body.get("addresses", [])
    if not addresses:
        return {"statusCode": 400, "body": json.dumps({"error": "no addresses provided"})}

    captures = list_plane_captures()
    if not captures:
        return {"statusCode": 500, "body": json.dumps(
            {"error": "no enabled plane captures in " + CAPTURES_KEY})}

    results = []
    for item in addresses:
        row_index = item.get("rowIndex")
        address = item.get("address")
        if not address:
            results.append({"rowIndex": row_index, "eligible": False,
                            "taxlot": None, "capture": None,
                            "reason": "missing address"})
            continue
        outcome = check_one(address, captures)
        results.append({"rowIndex": row_index, **outcome})

    return {
        "statusCode": 200,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps({"results": results}),
    }
