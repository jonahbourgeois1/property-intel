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
     (bypassing the normal DJI-style mouse controls, but reusing the same
     spherical math / distance-from-model logic already in the viewer)
  3. Sets `window.__viewerReady = true` once the GLB has finished loading
     AND the camera has been positioned — this script polls for that flag
     before screenshotting, so it never captures a half-loaded frame.

INPUT:
  --frontage   Path to compute_frontage.py output JSON
  --base-url   Base URL for model-viewer.html, e.g.
               https://responder-intel.vyanet.com/model-viewer.html
               (or a local file:// path / localhost URL for testing)
  --model-url-template
               How to build the ?model= param per property. Use {taxlot}
               as a placeholder, e.g.:
               "https://property-intel-tiles.s3.amazonaws.com/models/{taxlot}.glb"
  --out-dir    Where to write alpha/bravo/charlie/delta.jpg per property
               (written to {out_dir}/{taxlot}/{view}.jpg)

USAGE:
    python3 capture_obliques.py \
        --frontage frontage_output.json \
        --base-url https://responder-intel.vyanet.com/model-viewer.html \
        --model-url-template "https://property-intel-tiles.s3.amazonaws.com/models/{taxlot}.glb" \
        --out-dir ./oblique_captures

Then upload out-dir contents to S3 under captures/{capture-id}/renders/{taxlot}/
and write the resulting URLs back to the sheet (separate write-back step,
same pattern as the existing nadir screenshot-to-sheet flow).
"""

import argparse
import asyncio
import json
import os
import sys
from urllib.parse import urlencode

from playwright.async_api import async_playwright

READY_POLL_TIMEOUT_MS = 20000
READY_POLL_INTERVAL_MS = 250
VIEWPORT = {"width": 1600, "height": 1200}


async def capture_one_view(browser, base_url, model_url, taxlot, view_name, azimuth, polar, zoom, focus_x, focus_y, out_dir):
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

        # Poll for the ready flag set by the model-viewer.html patch, rather
        # than a fixed sleep — GLB load time varies with texture size.
        elapsed = 0
        ready = False
        while elapsed < READY_POLL_TIMEOUT_MS:
            ready = await page.evaluate("() => window.__viewerReady === true")
            if ready:
                break
            await asyncio.sleep(READY_POLL_INTERVAL_MS / 1000)
            elapsed += READY_POLL_INTERVAL_MS

        if not ready:
            print(f"[warn] {taxlot}/{view_name}: viewer never signaled ready, capturing anyway", file=sys.stderr)

        out_path = os.path.join(out_dir, taxlot, f"{view_name}.jpg")
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        await page.screenshot(path=out_path, type="jpeg", quality=90)
        print(f"[ok] {taxlot}/{view_name} -> {out_path}")
    except Exception as e:
        print(f"[skip] {taxlot}/{view_name} failed: {e}", file=sys.stderr)
    finally:
        await page.close()


async def run(frontage_path, base_url, model_url_template, out_dir, concurrency, zoom):
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
                tasks.append(bound_capture(browser, base_url, model_url, taxlot, view_name, azimuth, polar, zoom, focus_x, focus_y, out_dir))

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
    ap.add_argument("--zoom", type=float, default=1.0, help="Camera distance divisor for tighter framing on the structure (e.g. 2.5 pulls the camera ~2.5x closer than the default full-parcel view). Same value applied to all four oblique views.")
    args = ap.parse_args()

    asyncio.run(run(args.frontage, args.base_url, args.model_url_template, args.out_dir, args.concurrency, args.zoom))


if __name__ == "__main__":
    main()
