"""
lambda_handler.py

Runs the FULL plane-image pipeline for a single property, triggered
on-demand from an Apps Script menu item via API Gateway. Fully
self-contained in AWS: reads parcel/capture reference data from S3 (NOT
GitHub), renders images, generates descriptions via Bedrock, uploads to
S3, and writes results directly into the Google Sheet via the Sheets API.

GitHub is intentionally never touched by this Lambda. Your existing Apps
Script "Sync Plane" flow (unchanged) independently reads the Sheet and
pushes to GitHub on its own schedule — these two systems don't know about
each other, matching the "zero communication between git and AWS"
requirement.

TRIGGER (async):
  API Gateway should invoke this Lambda ASYNCHRONOUSLY (Event invocation
  type), not synchronously — oblique rendering (4 views x up to 3 zoom
  candidates each, plus Bedrock calls) will exceed API Gateway's hard
  29-second synchronous integration timeout. Apps Script fires the
  request and returns immediately; this Lambda writes results into the
  sheet whenever it finishes, the same "fire and check back later"
  pattern your existing Auto Nadir Processing already uses.

EXPECTED EVENT PAYLOAD (from Apps Script):
{
  "spreadsheetId": "...",
  "sheetName": "Plane",
  "rowIndex": 5,              // 1-indexed sheet row to write results into
  "accountName": "...",
  "address": "...",
  "accountType": "residential" | "commercial"
}

REQUIRED S3 LAYOUT (one-time setup — mirror these from the repo before
first use, since Lambda never reads from GitHub):
  s3://{REFERENCE_BUCKET}/parcels/bend-5-21-26-parcels.geojson
  s3://{REFERENCE_BUCKET}/captures.json
  (GLBs and 2D tiles are already in S3 from the existing pipeline)

REQUIRED ENV VARS:
  REFERENCE_BUCKET       — bucket holding parcels.geojson / captures.json
  OUTPUT_BUCKET          — bucket to upload final rendered images to
  MODEL_VIEWER_BASE_URL  — e.g. https://responder-intel.vyanet.com/model-viewer-test.html
                           (a public webpage load for rendering purposes —
                           not a data write, so this doesn't violate the
                           git/AWS write isolation requirement)
  TILE_CAPTURE_BASE      — e.g. https://d3fg47bqswi0rr.cloudfront.net/captures/plane/bend-5-21-26/map
  GLB_URL_TEMPLATE       — e.g. https://.../parcels/{taxlot}/clipped.glb
  CAPTURE_ID             — e.g. bend-5-21-26
  MAPS_API_KEY_SECRET_ARN     — Secrets Manager ARN for the Google Maps geocoding key
  WORKLOAD_IDENTITY_CONFIG_PATH — path to the non-secret WIF credential config
                           bundled into the image (default /var/task/aws-credential-config.json).
                           Used to call the Google Sheets API via Workload
                           Identity Federation — no static service account
                           key exists or is needed (Google Cloud org policy
                           disables key creation; this is Google's own
                           recommended alternative anyway).
  BEDROCK_MODEL_ID       — default us.anthropic.claude-sonnet-4-6
  AWS_REGION_BEDROCK     — default us-east-1
"""

import asyncio
import base64
import io
import json
import math
import os
import signal
import subprocess
import sys
import tempfile

import boto3
import requests
from PIL import Image
from shapely.geometry import shape, Point

# ── Config from environment ────────────────────────────────────────────────
REFERENCE_BUCKET = os.environ["REFERENCE_BUCKET"]
OUTPUT_BUCKET = os.environ["OUTPUT_BUCKET"]
MODEL_VIEWER_BASE_URL = os.environ["MODEL_VIEWER_BASE_URL"]
TILE_CAPTURE_BASE = os.environ["TILE_CAPTURE_BASE"]
GLB_URL_TEMPLATE = os.environ["GLB_URL_TEMPLATE"]
CAPTURE_ID = os.environ["CAPTURE_ID"]
# Public-facing base URL for rendered images. The raw s3.amazonaws.com
# endpoint is NOT publicly readable (confirmed 7/2/26: AccessDenied) —
# all public assets in this platform are served through CloudFront,
# which has access to the bucket. Sheet URLs must therefore be
# CloudFront URLs, matching GLB_URL_TEMPLATE / TILE_CAPTURE_BASE.
PUBLIC_CDN_BASE = os.environ.get("PUBLIC_CDN_BASE", "https://d3fg47bqswi0rr.cloudfront.net")
MAPS_API_KEY_SECRET_ARN = os.environ["MAPS_API_KEY_SECRET_ARN"]
BEDROCK_MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "us.anthropic.claude-sonnet-4-6")
BEDROCK_REGION = os.environ.get("AWS_REGION_BEDROCK", "us-east-1")

TILE_ZOOM = 21
PLANE_SHEET_COLUMNS = {
    # 0-indexed, matching PLANE_SHEET's documented layout in the Apps Script
    "nadir_url": 5, "nadir_desc": 6,
    "alpha_url": 7, "alpha_desc": 8,
    "bravo_url": 9, "bravo_desc": 10,
    "charlie_url": 11, "charlie_desc": 12,
    "delta_url": 13, "delta_desc": 14,
}

s3 = boto3.client("s3")
secrets = boto3.client("secretsmanager")
bedrock = boto3.client("bedrock-runtime", region_name=BEDROCK_REGION)

_cache = {}


def get_secret(arn):
    if arn not in _cache:
        _cache[arn] = secrets.get_secret_value(SecretId=arn)["SecretString"]
    return _cache[arn]


# ── Reference data (S3, never GitHub) ──────────────────────────────────────

def load_reference_json(key):
    if key not in _cache:
        obj = s3.get_object(Bucket=REFERENCE_BUCKET, Key=key)
        _cache[key] = json.loads(obj["Body"].read())
    return _cache[key]


def load_parcels():
    gj = load_reference_json("reference/parcels/bend-5-21-26-parcels.geojson")
    parcels = {}
    for feat in gj.get("features", []):
        taxlot = feat.get("properties", {}).get("TAXLOT")
        if taxlot is not None:
            parcels[str(taxlot)] = shape(feat["geometry"])
    return parcels


def load_tile_extent(zoom):
    data = load_reference_json("reference/captures.json")
    for cap in data.get("captures", []):
        if cap.get("id") == CAPTURE_ID:
            ext = cap.get("tile_extents", {}).get(str(zoom))
            if ext:
                return ext["x"][0], ext["x"][1], ext["y"][0], ext["y"][1]
    return None


# ── Address -> taxlot ──────────────────────────────────────────────────────

def geocode_address(address):
    key = get_secret(MAPS_API_KEY_SECRET_ARN)
    resp = requests.get(
        "https://maps.googleapis.com/maps/api/geocode/json",
        params={"address": address, "key": key}, timeout=10,
    )
    data = resp.json()
    if data.get("status") != "OK":
        raise RuntimeError(f"geocoding failed for '{address}': {data.get('status')}")
    loc = data["results"][0]["geometry"]["location"]
    return loc["lat"], loc["lng"]


def match_taxlot(lat, lon, parcels):
    pt = Point(lon, lat)
    for taxlot, geom in parcels.items():
        if geom.contains(pt):
            return taxlot
    return None


# ── ECEF transform (EXACT copy — must stay in sync with clip_parcel_textured.py) ──

_M = [
    0.8538393068677613, -0.5205366827108161, 0.0, 0.0,
    0.3618967178637809, 0.5936212624426974, 0.7187799123343397, 0.0,
    -0.3741513111656884, -0.6137225421380228, 0.6952376842667829, 0.0,
    -2390834.612219335, -3921699.7301742565, 4412849.998474161, 1.0
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


def latlon_to_local_xy(lat, lon):
    dx, dy, dz = (_geodetic_to_ecef(lat, lon)[i] - _T[i] for i in range(3))
    x = _R_T[0][0]*dx + _R_T[0][1]*dy + _R_T[0][2]*dz
    y = _R_T[1][0]*dx + _R_T[1][1]*dy + _R_T[1][2]*dz
    return x, y


# ── Frontage bearing (same math as compute_frontage.py) ────────────────────

def frontage_and_views(parcel_polygon, address_lat, address_lon):
    from pyproj import Transformer
    to_proj = Transformer.from_crs("EPSG:4326", "EPSG:32610", always_xy=True).transform
    px, py = to_proj(address_lon, address_lat)
    addr_pt = Point(px, py)

    coords = list(parcel_polygon.exterior.coords)

    from shapely.ops import transform as shp_transform
    parcel_proj = shp_transform(to_proj, parcel_polygon)
    centroid = parcel_proj.centroid

    best_dist, best_bearing = None, None
    for i in range(len(coords) - 1):
        lon1, lat1 = coords[i]
        lon2, lat2 = coords[i + 1]
        x1, y1 = to_proj(lon1, lat1)
        x2, y2 = to_proj(lon2, lat2)
        from shapely.geometry import LineString
        edge = LineString([(x1, y1), (x2, y2)])
        dist = addr_pt.distance(edge)
        if best_dist is not None and dist >= best_dist:
            continue
        ex, ey = (x2 - x1), (y2 - y1)
        edge_len = math.hypot(ex, ey)
        if edge_len == 0:
            continue
        n1 = (ey / edge_len, -ex / edge_len)
        n2 = (-ey / edge_len, ex / edge_len)
        mid = ((x1 + x2) / 2.0, (y1 + y2) / 2.0)
        to_centroid = (centroid.x - mid[0], centroid.y - mid[1])
        dot1 = n1[0]*to_centroid[0] + n1[1]*to_centroid[1]
        dot2 = n2[0]*to_centroid[0] + n2[1]*to_centroid[1]
        outward = n1 if dot1 < dot2 else n2
        best_dist = dist
        best_bearing = math.degrees(math.atan2(outward[0], outward[1])) % 360

    focus_x, focus_y = latlon_to_local_xy(address_lat, address_lon)

    views = {
        "alpha": best_bearing % 360,
        "bravo": (best_bearing + 90) % 360,
        "charlie": (best_bearing + 180) % 360,
        "delta": (best_bearing + 270) % 360,
    }
    return views, focus_x, focus_y


# ── Oblique rendering (Playwright — requires the container image's bundled Chromium) ──
#
# CRASH-RESILIENCE DESIGN (learned from the first live invocations, 7/2/26):
#
#   The original design launched ONE browser and reused it across all 4
#   views, with a retry loop that opened a new page on failure. Two fatal
#   flaws showed up in CloudWatch:
#
#   1. In --single-process mode with software (SwiftShader) WebGL at
#      ~3 GB container memory, the renderer accumulates GL contexts and
#      texture memory across views and eventually the whole browser
#      process dies mid-render ("Target page, context or browser has
#      been closed"). Max Memory Used hit 2921/3008 MB.
#
#   2. Once the browser process is dead, retrying browser.new_page() on
#      the SAME browser object can never succeed — attempts 2/3 always
#      failed instantly. A retry is only meaningful if it relaunches the
#      browser from scratch.
#
#   Additionally, crashed Chromium processes from a failed invocation
#   linger in the warm Lambda container (nothing reaps them), starving
#   the NEXT invocation — which is why later runs died on alpha attempt
#   1 within ~1 second.
#
#   The fix: every render ATTEMPT gets its own async_playwright() driver
#   + freshly launched browser, torn down completely afterward. Slightly
#   slower (~2-3s overhead per view) but every attempt starts from a
#   clean ~zero-state process, and a retry is a true retry. Stray
#   Chromium processes are also force-killed at handler start.

BROWSER_ARGS = [
    # AWS Lambda's container environment lacks the Linux capabilities
    # Chromium's default multi-process sandbox model needs — without
    # --single-process, the browser fails to launch at all in this
    # environment (confirmed by testing: removing it caused 100% of
    # launches to fail immediately, not just intermittently).
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--single-process",
    "--no-zygote",
    # Memory trims — no extensions/background work in a render bot.
    "--disable-extensions",
    "--disable-background-networking",
    "--disable-background-timer-throttling",
    "--mute-audio",
]

# Render viewport — env-configurable so it can be tuned WITHOUT a
# container rebuild (e.g. drop to 1024x768 if memory pressure shows up
# on big GLBs, raise back to 1600x1200 once the Lambda memory quota
# increase past 3008 MB is approved). 1280x960 keeps the same 4:3
# aspect as the original 1600x1200 at ~64% of the pixel count.
VIEWPORT = {
    "width": int(os.environ.get("RENDER_VIEWPORT_WIDTH", "1280")),
    "height": int(os.environ.get("RENDER_VIEWPORT_HEIGHT", "960")),
}

VIEWER_READY_TIMEOUT_S = 25  # 100 polls x 0.25s


def log_available_memory(label):
    """Log container-wide available memory so CloudWatch shows exactly
    where the budget goes across views — the difference between 'it
    crashed' and 'delta started with only 180MB free'."""
    try:
        with open("/proc/meminfo") as f:
            for line in f:
                if line.startswith("MemAvailable:"):
                    kb = int(line.split()[1])
                    print(f"  [mem] {label}: {kb // 1024} MB available")
                    return
    except Exception:
        pass


def kill_stray_chromium():
    """Force-kill any Chromium processes left over from a crashed prior
    invocation in this warm container. Lambda has no init process to
    reap children, so a crashed browser's processes survive between
    invocations and eat memory the next run needs."""
    try:
        subprocess.run(["pkill", "-9", "-f", "chrom"], timeout=5,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception as e:
        print(f"  [warn] stray-chromium cleanup skipped: {e}", file=sys.stderr)


async def _render_view_once(taxlot, glb_url, view_name, azimuth, focus_x, focus_y,
                            polar, zoom):
    """One complete, self-contained render attempt: fresh Playwright
    driver, fresh browser, render, screenshot, full teardown. If ANY of
    it fails, everything is discarded and the caller may retry with a
    genuinely clean slate."""
    from urllib.parse import urlencode
    from playwright.async_api import async_playwright

    params = {
        "model": glb_url, "azimuth": azimuth, "polar": polar, "zoom": zoom,
        "focus_x": focus_x, "focus_y": focus_y, "autocapture": 1,
    }
    url = f"{MODEL_VIEWER_BASE_URL}?{urlencode(params)}"
    out_path = f"/tmp/{taxlot}_{view_name}.jpg"

    async with async_playwright() as p:
        browser = await p.chromium.launch(args=BROWSER_ARGS)
        try:
            page = await browser.new_page(viewport=VIEWPORT)
            await page.goto(url, wait_until="load", timeout=30000)
            ready = False
            for _ in range(int(VIEWER_READY_TIMEOUT_S / 0.25)):
                if await page.evaluate("() => window.__viewerReady === true"):
                    ready = True
                    break
                await asyncio.sleep(0.25)
            if not ready:
                # Fail loudly instead of screenshotting a half-loaded scene —
                # a blank/partial render silently poisoning the sheet is worse
                # than a retry.
                raise RuntimeError(
                    f"{view_name}: viewer never signaled __viewerReady "
                    f"within {VIEWER_READY_TIMEOUT_S}s"
                )
            await page.screenshot(path=out_path, type="jpeg", quality=90)
            return out_path
        finally:
            try:
                await browser.close()
            except Exception:
                pass  # browser may already be dead; teardown must not mask the real error


async def render_all_obliques_async(taxlot, glb_url, views, focus_x, focus_y,
                                    polar=25, zoom=1.0):
    """Renders all 4 oblique views, one fresh browser per ATTEMPT (not per
    property, not per view — per attempt). See CRASH-RESILIENCE DESIGN
    note above for why."""
    results = {}
    for view_name, azimuth in views.items():
        log_available_memory(f"before {view_name}")
        last_error = None
        for attempt in range(3):
            try:
                results[view_name] = await _render_view_once(
                    taxlot, glb_url, view_name, azimuth, focus_x, focus_y,
                    polar, zoom
                )
                last_error = None
                break
            except Exception as e:
                last_error = e
                print(f"  [warn] {view_name} render attempt {attempt + 1}/3 "
                      f"failed: {e}", file=sys.stderr)
                if attempt < 2:
                    await asyncio.sleep(2)
            finally:
                # Reap after EVERY attempt, successful or not. With
                # --single-process/--no-zygote, browser.close() can leave
                # remnant processes behind even on a clean render — the
                # 7/2/26 failure logs showed memory climbing across
                # SUCCESSFUL views (alpha→bravo→charlie fine, delta dead),
                # which only happens if completed browsers leak.
                kill_stray_chromium()
        if last_error is not None:
            raise last_error
    return results


def render_all_obliques(taxlot, glb_url, views, focus_x, focus_y, polar=25, zoom=1.0):
    return asyncio.run(render_all_obliques_async(taxlot, glb_url, views, focus_x, focus_y, polar, zoom))


# ── Nadir cropping (same math as clip_nadir.py) ────────────────────────────

def deg2num(lat_deg, lon_deg, zoom):
    lat_rad = math.radians(lat_deg)
    n = 2.0 ** zoom
    xtile = (lon_deg + 180.0) / 360.0 * n
    ytile = (1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n
    return xtile, ytile


def crop_nadir(bbox, out_path, zoom=TILE_ZOOM):
    min_lon, min_lat, max_lon, max_lat = bbox
    x0f, y0f = deg2num(max_lat, min_lon, zoom)
    x1f, y1f = deg2num(min_lat, max_lon, zoom)
    tile_x0, tile_x1 = int(math.floor(x0f)), int(math.floor(x1f))
    tile_y0, tile_y1 = int(math.floor(y0f)), int(math.floor(y1f))
    tiles_wide, tiles_high = tile_x1 - tile_x0 + 1, tile_y1 - tile_y0 + 1

    canvas = Image.new("RGB", (tiles_wide * 256, tiles_high * 256), (0, 0, 0))
    missing = 0
    for tx in range(tile_x0, tile_x1 + 1):
        for ty in range(tile_y0, tile_y1 + 1):
            resp = requests.get(f"{TILE_CAPTURE_BASE}/{zoom}/{tx}/{ty}.png", timeout=8)
            if resp.status_code != 200:
                missing += 1
                continue
            tile = Image.open(io.BytesIO(resp.content)).convert("RGB")
            canvas.paste(tile, ((tx - tile_x0) * 256, (ty - tile_y0) * 256))

    total = tiles_wide * tiles_high
    if missing == total:
        raise RuntimeError("no 2D tiles available for this property")

    px0, py0 = (x0f - tile_x0) * 256, (y0f - tile_y0) * 256
    px1, py1 = (x1f - tile_x0) * 256, (y1f - tile_y0) * 256
    canvas.crop((int(px0), int(py0), int(px1), int(py1))).save(out_path, "JPEG", quality=90)
    return missing, total


def get_padded_bbox(polygon, padding_frac=0.15):
    min_lon, min_lat, max_lon, max_lat = polygon.bounds
    pad_lon, pad_lat = (max_lon - min_lon) * padding_frac, (max_lat - min_lat) * padding_frac
    return (min_lon - pad_lon, min_lat - pad_lat, max_lon + pad_lon, max_lat + pad_lat)


# ── Bedrock: image description (mirrors the Satellite pipeline's analyzeImage) ──

def describe_image(image_path, view_label):
    # Always downscale before sending to Bedrock — nadir crops scale with
    # real parcel size (unlike the fixed-size oblique screenshots),
    # so a large property's nadir image can exceed Bedrock's 5MB payload
    # limit. Resizing to a max dimension well within API limits avoids
    # this regardless of the source image's actual size.
    img = Image.open(image_path)
    img.thumbnail((1568, 1568), Image.LANCZOS)
    buf = io.BytesIO()
    img.convert("RGB").save(buf, format="JPEG", quality=85)
    img_b64 = base64.b64encode(buf.getvalue()).decode("ascii")

    prompt = (
        f"You are describing a {view_label} aerial photo of a residential property for a "
        f"first-responder property intelligence record. Describe only what is directly visible: "
        f"the structure, driveway, notable landscape features, and access points. "
        f"Use plain, factual, one-to-two sentence language — no speculation, no confidence caveats. "
        f"Do not mention image quality or camera angle."
    )
    payload = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 150,
        "system": prompt,
        "messages": [{"role": "user", "content": [
            {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": img_b64}},
            {"type": "text", "text": "Describe this image in 1-2 sentences."},
        ]}],
    }
    resp = bedrock.invoke_model(modelId=BEDROCK_MODEL_ID, body=json.dumps(payload),
                                 contentType="application/json", accept="application/json")
    body = json.loads(resp["body"].read())
    return body["content"][0]["text"].strip()


# ── S3 upload ────────────────────────────────────────────────────────────────

def upload_image(local_path, taxlot, view_name):
    key = f"renders/{taxlot}/{view_name}.jpg"
    s3.upload_file(local_path, OUTPUT_BUCKET, key, ExtraArgs={"ContentType": "image/jpeg"})
    return f"{PUBLIC_CDN_BASE.rstrip('/')}/{key}"


# ── Google Sheets write-back ────────────────────────────────────────────────

def write_to_sheet(spreadsheet_id, sheet_name, row_index, values_by_col):
    # Workload Identity Federation, NOT a static service account key — your
    # Google Cloud org has key creation disabled by policy, and WIF is
    # Google's own recommended alternative anyway: Lambda's own IAM role
    # credentials (already available in the execution environment) are
    # federated into a short-lived Google token, with no long-lived secret
    # ever created or stored. WORKLOAD_IDENTITY_CONFIG_PATH points at the
    # non-secret credential config file generated by `gcloud iam
    # workload-identity-pools create-cred-config` and bundled into the
    # container image at build time (see DEPLOYMENT.md).
    from google.auth import load_credentials_from_file
    from googleapiclient.discovery import build

    config_path = os.environ.get("WORKLOAD_IDENTITY_CONFIG_PATH", "/var/task/aws-credential-config.json")
    creds, _ = load_credentials_from_file(
        config_path, scopes=["https://www.googleapis.com/auth/spreadsheets"]
    )
    service = build("sheets", "v4", credentials=creds)

    data = []
    for col_index, value in values_by_col.items():
        col_letter = chr(ord("A") + col_index)
        data.append({"range": f"{sheet_name}!{col_letter}{row_index}", "values": [[value]]})

    service.spreadsheets().values().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body={"valueInputOption": "RAW", "data": data},
    ).execute()


# ── Main handler ────────────────────────────────────────────────────────────

def lambda_handler(event, context):
    # First order of business in a (possibly warm) container: reap any
    # Chromium processes a previous crashed invocation left behind, so
    # this run starts with its full memory budget.
    kill_stray_chromium()

    spreadsheet_id = event["spreadsheetId"]
    sheet_name = event.get("sheetName", "Plane")
    row_index = event["rowIndex"]
    address = event["address"]

    print(f"Processing: {address} (row {row_index})")

    lat, lon = geocode_address(address)
    parcels = load_parcels()
    taxlot = match_taxlot(lat, lon, parcels)
    if not taxlot:
        raise RuntimeError(f"no parcel match for {address} at ({lat},{lon})")

    parcel = parcels[taxlot]
    views, focus_x, focus_y = frontage_and_views(parcel, lat, lon)
    glb_url = GLB_URL_TEMPLATE.format(taxlot=taxlot)

    results = {}

    # Obliques.
    #
    # If all 3 attempts for a view fail, do NOT raise normally — a normal
    # exception keeps this (memory-saturated) execution environment alive,
    # and Lambda's automatic async retries land back in the SAME warm
    # container, dying instantly (observed 7/2/26: retries failed in ~6.7s
    # with memory already pegged at 3008 MB). os._exit() kills the runtime
    # process, forcing Lambda to mark the invocation failed AND discard
    # the environment, so the automatic retry starts cold with a full
    # memory budget — turning Lambda's built-in retry into a genuine
    # second chance instead of a guaranteed failure.
    try:
        oblique_paths = render_all_obliques(taxlot, glb_url, views, focus_x, focus_y)
    except Exception as e:
        print(f"[FATAL] oblique rendering failed after retries: {e}", file=sys.stderr)
        sys.stderr.flush()
        sys.stdout.flush()
        os._exit(1)

    for view_name, local_path in oblique_paths.items():
        url = upload_image(local_path, taxlot, view_name)
        desc = describe_image(local_path, view_name)
        results[f"{view_name}_url"] = url
        results[f"{view_name}_desc"] = desc
        print(f"  {view_name}: {url}")

    # Nadir
    tile_extent = load_tile_extent(TILE_ZOOM)
    bbox = get_padded_bbox(parcel, 0.15)
    nadir_path = f"/tmp/{taxlot}_nadir.jpg"
    crop_nadir(bbox, nadir_path)
    nadir_url = upload_image(nadir_path, taxlot, "nadir")
    nadir_desc = describe_image(nadir_path, "nadir (straight-down)")
    results["nadir_url"] = nadir_url
    results["nadir_desc"] = nadir_desc
    print(f"  nadir: {nadir_url}")

    # Write everything back to the sheet in one batch call
    values_by_col = {PLANE_SHEET_COLUMNS[k]: v for k, v in results.items() if k in PLANE_SHEET_COLUMNS}
    write_to_sheet(spreadsheet_id, sheet_name, row_index, values_by_col)

    print(f"Done: {address} written to row {row_index}")
    return {"statusCode": 200, "body": json.dumps({"taxlot": taxlot, "results": results})}
