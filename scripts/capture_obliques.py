"""
capture_obliques.py

Drives model-viewer.html headlessly (Playwright/Chromium) to capture the four
oblique views (alpha/bravo/charlie/delta) for every property listed in
compute_frontage.py's output, using the azimuth/polar values already computed
there. Nadir is NOT handled here — nadir comes from the 2D tile mosaic via
clip_nadir.py, this script is 3D-model-only.

REQUIRES a small patch to model-viewer.html (see model_viewer_capture_patch.js
in this same folder) that:
  1. Reads ?azimuth=<deg>&polar=<deg>&autocapture=1 from the URL
  2. Positions the camera at that azimuth/polar around the model on load
  3. Sets `window.__viewerReady = true` once the GLB has finished loading
     AND the camera has been positioned — this script polls for that flag
     before screenshotting, so it never captures a half-loaded frame.

AUTO ZOOM (optional, --auto-zoom):
  Mirrors the Apps Script's selectBestZoom() pattern used for nadir images
  when no parcel geometry is available: instead of trusting one hand-tuned
  distance formula for every property, render 3 candidate screenshots per
  view at different zoom levels, then ask Claude (via AWS Bedrock — same
  credentials/pipeline your Apps Script already uses) to visually pick the
  best-framed one. Runs independently per view (not once per property),
  since irregularly-shaped parcels can need different framing depending on
  which side of the house is being viewed.

INPUT:
  --frontage   Path to compute_frontage.py output JSON
  --base-url   Base URL for model-viewer.html
  --model-url-template
               How to build the ?model= param per property. Use {taxlot}
               as a placeholder.
  --out-dir    Where to write alpha/bravo/charlie/delta.jpg per property
               (written to {out_dir}/{taxlot}/{view}.jpg)
  --zoom       Fixed zoom multiplier (used when --auto-zoom is NOT set)
  --auto-zoom  Enable AI-based zoom selection (3 candidates per view)
  --zoom-candidates
               Comma-separated zoom multipliers to try when --auto-zoom is
               set, ordered widest-to-narrowest (default "0.7,1.0,1.4")
  --bedrock-region, --bedrock-model
               AWS Bedrock settings for the selection call

USAGE (fixed zoom, original behavior):
    python3 capture_obliques.py \
        --frontage frontage_output.json \
        --base-url https://responder-intel.vyanet.com/model-viewer.html \
        --model-url-template "https://property-intel-tiles.s3.amazonaws.com/models/{taxlot}.glb" \
        --out-dir ./oblique_captures --zoom 1.0

USAGE (AI-selected zoom per view):
    python3 capture_obliques.py \
        --frontage frontage_output.json \
        --base-url https://responder-intel.vyanet.com/model-viewer.html \
        --model-url-template "https://property-intel-tiles.s3.amazonaws.com/models/{taxlot}.glb" \
        --out-dir ./oblique_captures --auto-zoom

Then upload out-dir contents to S3 under captures/{capture-id}/renders/{taxlot}/
and write the resulting URLs back to the sheet (separate write-back step,
same pattern as the existing nadir screenshot-to-sheet flow).
"""

import argparse
import asyncio
import base64
import json
import os
import shutil
import sys
from urllib.parse import urlencode

from playwright.async_api import async_playwright

READY_POLL_TIMEOUT_MS = 20000
READY_POLL_INTERVAL_MS = 250
VIEWPORT = {"width": 1600, "height": 1200}

DEFAULT_BEDROCK_MODEL = "us.anthropic.claude-sonnet-4-6"

# Mirrors the spirit of ZOOM_PROMPT_RESIDENTIAL in the Apps Script, adapted
# for oblique (angled) house photos instead of straight-down parcel maps.
OBLIQUE_ZOOM_SELECTION_PROMPT = """You are selecting the best-framed oblique (angled) aerial photo of a single residential property from three candidate images. All three show the same view of the same property from the same camera angle, taken at different distances.

Image 1 is the most pulled-back (widest) view.
Image 2 is a medium distance.
Image 3 is the closest (most zoomed-in) view.

The objective is to select the image that:
- Shows the entire primary structure without any part being cropped off the image edges
- Fills a substantial, prominent portion of the frame with the house — not a small distant object surrounded mostly by empty land
- Retains enough surrounding context (driveway, immediate landscaping) to read as a real-estate-style property photo, not an extreme close-up of just a wall or roof section
- Avoids excessive empty foreground or background space

Rules:
If the structure occupies only a small fraction of the frame in images 1 and 2, select image 3.
If the structure or its roofline is visibly cropped or cut off at any frame edge in image 3, select image 2 or image 1 instead.
Prefer the image where the structure fills roughly half to three-quarters of the frame, is fully visible, and shows clear architectural detail.

Return ONLY a single integer: 1, 2, or 3. No other text."""


def select_best_zoom_via_bedrock(candidate_paths, region, model_id):
    """Sends the candidate JPEGs to Claude via Bedrock and returns the
    0-indexed selection. Falls back to the middle candidate on any failure,
    rather than crashing the batch over a single bad API response — matches
    the Apps Script's selectBestZoom() fallback-to-19 behavior."""
    fallback_index = len(candidate_paths) // 2

    try:
        import boto3
    except ImportError:
        print("[warn] boto3 not installed — falling back to middle zoom candidate. "
              "Install with: pip install boto3 --break-system-packages", file=sys.stderr)
        return fallback_index

    try:
        content = []
        for path in candidate_paths:
            with open(path, "rb") as f:
                img_b64 = base64.b64encode(f.read()).decode("ascii")
            content.append({"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": img_b64}})
        content.append({"type": "text", "text": f"Images show option 1 (widest) through option {len(candidate_paths)} (closest). Return ONLY the number of the best-framed option."})

        payload = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 5,
            "system": OBLIQUE_ZOOM_SELECTION_PROMPT,
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
        print(f"[warn] Bedrock zoom selection failed ({e}), using middle candidate", file=sys.stderr)
        return fallback_index


async def render_one(browser, base_url, model_url, taxlot, view_name, azimuth, polar, zoom, focus_x, focus_y, out_path):
    """Renders a single screenshot at a specific zoom level to out_path.
    Returns True on success (even if the ready flag never fired — same
    graceful-degradation behavior as before), False if the page load itself
    failed."""
    params = {
        "model": model_url,
        "azimuth": azimuth,
        "polar": polar,
        "zoom": zoom,
        "autocapture": 1,
    }
    if focus_x is not None and focus_y is not None:
        params["focus_x"] = focus_x
        params["focus_y"] = focus_y
    url = f"{base_url}?{urlencode(params)}"

    page = await browser.new_page(viewport=VIEWPORT)
    try:
        await page.goto(url, wait_until="load", timeout=30000)

        elapsed = 0
        ready = False
        while elapsed < READY_POLL_TIMEOUT_MS:
            ready = await page.evaluate("() => window.__viewerReady === true")
            if ready:
                break
            await asyncio.sleep(READY_POLL_INTERVAL_MS / 1000)
            elapsed += READY_POLL_INTERVAL_MS

        if not ready:
            print(f"[warn] {taxlot}/{view_name} (zoom={zoom}): viewer never signaled ready, capturing anyway", file=sys.stderr)

        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        await page.screenshot(path=out_path, type="jpeg", quality=90)
        return True
    except Exception as e:
        print(f"[skip] {taxlot}/{view_name} (zoom={zoom}) failed: {e}", file=sys.stderr)
        return False
    finally:
        await page.close()


async def capture_one_view(browser, base_url, model_url, taxlot, view_name, azimuth, polar,
                            fixed_zoom, focus_x, focus_y, out_dir, auto_zoom, zoom_candidates,
                            bedrock_region, bedrock_model):
    final_path = os.path.join(out_dir, taxlot, f"{view_name}.jpg")

    if not auto_zoom:
        ok = await render_one(browser, base_url, model_url, taxlot, view_name, azimuth, polar,
                               fixed_zoom, focus_x, focus_y, final_path)
        if ok:
            print(f"[ok] {taxlot}/{view_name} -> {final_path}")
        return

    # Auto-zoom: render one candidate per zoom multiplier, then ask Bedrock
    # to pick the best-framed one.
    candidate_dir = os.path.join(out_dir, taxlot, "_candidates")
    candidate_paths = []
    for i, z in enumerate(zoom_candidates):
        cand_path = os.path.join(candidate_dir, f"{view_name}_option{i+1}_zoom{z}.jpg")
        ok = await render_one(browser, base_url, model_url, taxlot, view_name, azimuth, polar,
                               z, focus_x, focus_y, cand_path)
        if ok:
            candidate_paths.append(cand_path)

    if not candidate_paths:
        print(f"[skip] {taxlot}/{view_name}: no candidates rendered successfully", file=sys.stderr)
        return

    loop = asyncio.get_event_loop()
    chosen_index = await loop.run_in_executor(
        None, select_best_zoom_via_bedrock, candidate_paths, bedrock_region, bedrock_model
    )
    chosen_index = min(chosen_index, len(candidate_paths) - 1)

    os.makedirs(os.path.dirname(final_path), exist_ok=True)
    shutil.copy(candidate_paths[chosen_index], final_path)
    chosen_zoom = zoom_candidates[chosen_index] if chosen_index < len(zoom_candidates) else "?"
    print(f"[ok] {taxlot}/{view_name} -> {final_path} (auto-zoom selected option {chosen_index+1}, zoom={chosen_zoom})")


async def run(frontage_path, base_url, model_url_template, out_dir, concurrency,
               fixed_zoom, auto_zoom, zoom_candidates, bedrock_region, bedrock_model):
    with open(frontage_path, "r") as f:
        properties = json.load(f)

    sem = asyncio.Semaphore(concurrency)

    async def bound_capture(browser, *args):
        async with sem:
            await capture_one_view(browser, *args)

    async with async_playwright() as p:
        browser = await p.chromium.launch()

        tasks = []
        for prop in properties:
            taxlot = prop["taxlot"]
            model_url = model_url_template.format(taxlot=taxlot)
            polar = prop.get("polar_deg", 45)
            focus_x = prop.get("focus_x")
            focus_y = prop.get("focus_y")
            for view_name, azimuth in prop["views"].items():
                tasks.append(bound_capture(
                    browser, base_url, model_url, taxlot, view_name, azimuth, polar,
                    fixed_zoom, focus_x, focus_y, out_dir, auto_zoom, zoom_candidates,
                    bedrock_region, bedrock_model
                ))

        await asyncio.gather(*tasks)
        await browser.close()

    print(f"Done. Captured views for {len(properties)} properties into {out_dir}", file=sys.stderr)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--frontage", required=True)
    ap.add_argument("--base-url", required=True)
    ap.add_argument("--model-url-template", required=True)
    ap.add_argument("--out-dir", required=True)
    ap.add_argument("--concurrency", type=int, default=4, help="Parallel browser pages (keep modest to avoid GPU/memory issues headless)")
    ap.add_argument("--zoom", type=float, default=1.0, help="Fixed camera distance divisor, used when --auto-zoom is NOT set.")
    ap.add_argument("--auto-zoom", action="store_true", help="Enable AI-based per-view zoom selection via AWS Bedrock (3 candidates, mirrors the Apps Script's selectBestZoom()).")
    ap.add_argument("--zoom-candidates", default="0.7,1.0,1.4", help="Comma-separated zoom multipliers to try with --auto-zoom, ordered widest-to-narrowest.")
    ap.add_argument("--bedrock-region", default="us-east-1")
    ap.add_argument("--bedrock-model", default=DEFAULT_BEDROCK_MODEL)
    args = ap.parse_args()

    zoom_candidates = [float(z.strip()) for z in args.zoom_candidates.split(",")]

    asyncio.run(run(
        args.frontage, args.base_url, args.model_url_template, args.out_dir, args.concurrency,
        args.zoom, args.auto_zoom, zoom_candidates, args.bedrock_region, args.bedrock_model
    ))


if __name__ == "__main__":
    main()
