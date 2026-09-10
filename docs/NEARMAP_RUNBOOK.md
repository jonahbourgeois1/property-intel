# Nearmap runbook (trial)

Companion to [NEARMAP_CONTRACT.md](NEARMAP_CONTRACT.md). Operator steps for a vendor zip today, and the swap when full API access lands.

After any Apps Script paste: **save AND create a new web-app deployment version**. Saved ≠ deployed.

## Prerequisites

- AWS CLI or boto3 credentials for account `719781265739`, region `us-east-1`
- Python 3 with Pillow (`pip install pillow`)
- Optional: boto3 for promote (`pip install boto3`)
- Ahartsi-style zip (Transactional API folder and/or MapBrowser 3D zips)
- Apps Script project “GitHub Property Intel Automation” — paste `config.gs` (constants only), `nearmap.gs`, `menu.gs`, `critique-api.gs`. **Replace** those files in place. Do not add a second `prompts.gs` (global `const` collision). Nearmap Pass 1 prompt lives in `nearmap.gs`.

Do not put GeoTIFFs, OBJ, or LAS in this public repo.

## Trial path (manual export)

### 1. Upload raw

```
aws s3 cp Ahartsi.zip s3://property-intel-ingest/nearmap/ahartsi-2026-09-07/raw/Ahartsi.zip
```

Local normalize can read the zip on disk; the S3 copy is the archive of record.

### 2. Normalize

From the v1 repo root:

```
python tools/nearmap/normalize.py --zip "C:\Users\Jonah Bourgeois\Downloads\Ahartsi.zip" --out tmp/nearmap-canonical --serve-out tmp/nearmap-serve
```

Limit to Jones / Macalpine:

```
python tools/nearmap/normalize.py --zip "C:\Users\Jonah Bourgeois\Downloads\Ahartsi.zip" --only macalpine --out tmp/nearmap-canonical --serve-out tmp/nearmap-serve
```

Prove: `tmp/nearmap-serve/<delivery_id>/vert.jpg`, `ai/features.json`, `ai/original/regions.json`, `ai/edits/regions.json`, `manifest.json` with WGS84 `bounds`. Uncompressed `merged_Vert.tif` must not appear under `--serve-out`.

If serve-out already exists from an earlier normalize, seed the two region folders without re-running the zip:

```
python tools/nearmap/seed_regions.py --serve-dir tmp/nearmap-serve --delivery 18775-macalpine-loop-bend-or-97702
```

### 2b. Mesh → GLB (deliveries with a MapBrowser 3D export)

```
python tools/nearmap/mesh_to_glb.py --zip "C:/Users/Jonah Bourgeois/Downloads/Ahartsi.zip" ^
  --member "Ahartsi/MapBrowser_3D/18775 MACALPINE LOOP.zip" ^
  --serve-dir tmp/nearmap-serve/18775-macalpine-loop-bend-or-97702
```

Reads `Mesh/Mesh.obj` + `.mtl` + textures + `.ofs` + `Tiles.prj` from the delivery zip (or `--folder` for an extracted copy), writes `mesh/model.glb` (Draco, textures ≤ 4096 px) and `mesh/mesh.json`, and adds `urls.mesh` / `urls.mesh_meta` / `mesh{}` to `manifest.json`. Macalpine: 612 k vertices / 938 k triangles → 32 MB raw → **9.8 MB** Draco in ~14 s. Needs `pyproj`, `pygltflib`, `Pillow`, `numpy`; Draco needs `npx gltf-pipeline` (falls back to uncompressed with `--no-draco` or if npx is unavailable). Columbia has no MapBrowser export — skip; the viewer disables its 3D tab.

### 3. Promote to tiles

```
python tools/nearmap/promote.py --serve-dir tmp/nearmap-serve --delivery 18775-macalpine-loop-bend-or-97702
```

`mesh/model.glb` (content type `model/gltf-binary`, 24 h cache) and `mesh/mesh.json` upload with everything else; `ai/edits/regions.json` is seeded from original if absent.

Omitting `--delivery` promotes every folder under `--serve-dir`.

The script:

- `s3.head_object` after each put
- merges `s3://property-intel-tiles/reference/nearmap.json`
- invalidates CloudFront dist `EQJBJ6X237VQF` for `/nearmap/{id}/*` and `/reference/nearmap.json`

Serving URLs:

`https://d3fg47bqswi0rr.cloudfront.net/nearmap/{delivery_id}/vert.jpg`  
`https://d3fg47bqswi0rr.cloudfront.net/reference/nearmap.json`

### 4. Sheet

Menu **Property Intel → Nearmap Pipeline → Set Up Nearmap Sheet**. Creates (or updates headers on) a tab named exactly `Nearmap` at the end of the workbook. Does not write Satellite / Plane / Drone / Golf. Restores the tab you were on.

Then **Import from CloudFront registry**.

Fill **Site No** by hand. Do not guess among Jones’s three site numbers (14725 / 33278 / 34734). Address is not identity.

First-round pins come from **Open Nearmap Review**, not Bedrock. Run **Set Up Nearmap Sheet** so column W (Drawn Features) exists. Fill **Site No** before a sheet save; local review still works without it (localStorage).

### 5. Review (before or after sync)

CloudFront-only (no GitHub yet):

`https://responder-intel.vyanet.com/nearmap-review.html?delivery=18775-macalpine-loop-bend-or-97702`

Local:

`python tools/nearmap/review_server.py 8899` then  
`http://localhost:8899/nearmap-review.html?delivery=18775-macalpine-loop-bend-or-97702&tiles=http://localhost:8899/tmp/nearmap-serve/`

Use `review_server.py` (not `python -m http.server`) so Draw can PUT local `ai/edits/regions.json`. `ai/original/regions.json` is never written by the page. Revert regions returns to original.

### Two editors (v1.5.0)

**Property Intel → Nearmap Pipeline → Open Nearmap Regions Editor (This Row)** opens `?mode=regions`: merge/erase vendor regions, Revert regions → original, Save publishes the regions diff. Pins are not shown and not touched.

**… → Open Nearmap Pins Editor (This Row)** opens `?mode=pins`: the finished regions are read-only; on first open every non-vegetation region (Lawn Grass included) gets a pin at its interior point; **Seed from regions** re-seeds (confirm replaces the list); **Place pin** click → picker; ✕ deletes a pin without touching regions; Save writes column R only. Do regions first, then pins — reseeding after regions change is one click.

Paste for this build: `config.gs`, `nearmap.gs`, `menu.gs` (and `critique-api.gs` if its Nearmap routes are not deployed), save, **new deployment version**.

### Sheet mode (v1.6.0) — original/edits folder format on S3, no GitHub

Open from the sheet (either editor above; URL carries `site_no=`), or via the published `?property=` link:

1. Page asks `?route=nearmap-elements&site_no=` → gets pins, `regions_original_url` and `regions_edits_url` (both CloudFront: `…/ai/original/regions.json`, `…/ai/edits/regions.json`).
2. Regions shown = the edits file (seeded from original by promote, rewritten by Save). Status: "Loaded edits: N regions (saved …)".
3. **Save** (regions editor) posts the working FeatureCollection to the web app; `nmSavePins_` PUTs it to S3 `nearmap/{delivery}/ai/edits/regions.json` with SigV4 and writes a summary to W. Status: "regions saved to S3 edits/ (N regions, c changed / r removed vs original)". Column R is untouched.
4. **Revert regions** → original in memory; status says "click Save to publish the reset"; that Save writes original back into edits.
5. Nothing is reset on reload in sheet mode. `&fresh=1` forces a fresh start if ever needed.

One-time AWS setup: the IAM user behind `AWS_ACCESS_KEY_ID` in Script Properties needs `s3:PutObject` on `arn:aws:s3:::property-intel-tiles/nearmap/*/ai/edits/regions.json` and `arn:aws:s3:::property-intel-tiles/nearmap/_probe/*`. Verify from the editor: run `checkS3EditsWrite` → "S3 PUT ok". A 403 `AccessDenied` there means the policy is missing.

Deploy: paste `nearmap.gs` over the existing file, **save AND create a new web-app deployment version** (saved ≠ deployed). Re-promote deliveries once with `promote.py` so S3 gets `ai/edits/regions.json` seeded (`--reset-edits` to reseed). Check `nearmap-elements` for a `regions_edits_url` ending in `/ai/edits/regions.json` to confirm the new deployment is live.

GitHub: the two Apps Script commits under `data/nearmap/edits/` from the 2026-09-09 trial were removed; the folder no longer exists in the repo. `GITHUB_TOKEN` is still used by the row sync (`data/nearmap/{id}.json`, URLs only) — `checkGitHubToken` reports its health.

Local v1.4.0 (`delivery=` only, no `site_no`): Pan / Draw (Accept removed). One erase stroke cuts every same-class region it crosses. Wheel zoom works in Draw before and after a pick. Erase on painted additions keeps clean edges and never deletes the vendor scrap the addition was grown from. **Testing mode:** every open starts from `ai/original/regions.json` with no pins and resets `ai/edits/regions.json` to the original; add `&fresh=0` to resume edits instead. Sidebar counts reflect the working regions from load (hints.json counts are only a placeholder for the first second). Clear brush next to `◀ ▶` drops the picked region. Paint absorbs any same-class scrap the result covers; Pan or hiding the layer drops the pick. Regions files are fetched with no-store; the edits file on disk always wins over the browser backup. To reset a delivery to the vendor original, copy `ai/original/regions.json` over `ai/edits/regions.json` (or click Revert regions). The active layer (last checked, or click a checked layer's name) highlights every border of that class; Driveway is pink. The stroke preview is as wide as the cursor and matches the area painted or erased. Paint that does not touch the selected region creates a new same-class region and the class count updates. Right-click erase acts on whatever visible region is under the brush (the picked one first, then same class, then any); over bare ground it says "Nothing to remove". An erase that cuts a region in two leaves two regions (the picked one keeps the largest piece, the rest become `dN` with `origin: split`); slivers left by an erase are dropped, and erasing essentially the whole region removes it and its pin (`◀` brings it back). Size slider under Draw; `◀ ▶` under Size step back/forward through paint strokes (memory only, Revert clears them; Ctrl+Z / Ctrl+Shift+Z while Draw is on). The selected pin and polygon are not highlighted. Scroll-zoom stays on while drawing. Published to Pages 2026-09-09.

After sync: `nearmap-review.html?property={hashId(site_no)}`

### 5b. Viewer (`nearmap-viewer.html`)

**Property Intel → Nearmap Pipeline → Open Nearmap Viewer (This Row)** → `nearmap-viewer.html?site_no=…&delivery=…`, which **redirects** into `vyanet-viewer.html?property={hub}&delivery=…&stage=home` for trial deliveries in `NEARMAP_DELIVERY_HUB` (Macalpine → Jones). Same gate / HOME / PRIVATE / COMMUNITY as every other property. Private nested **Nearmap** **leaves the hub** and opens `nearmap-viewer.html?full=1` (vendor 2D / 3D / Obliques plus AI layers and lot line). **Clip to taxlot** (default on, v1.1.4) removes everything outside the property line on 2D (opaque hole-punch, camera locked to the lot, off-lot pins hidden); uncheck to see the neighborhood. Observed facts (areas, defensible-space distances) are on that rail — not GIS Property Facts. Top-right **Standard viewer** returns to `vyanet-viewer.html?stage=private`. Private 2D **Cover** shows the same lot-clipped building/drive/veg/pool overlay. Local: `http://localhost:8899/nearmap-viewer.html?full=1&delivery=18775-macalpine-loop-bend-or-97702`. Direct hub: `vyanet-viewer.html?property=6de88883bfd4a8349a901c54611ed9d7&role=tech`. Optional lot JPEG: `python tools/nearmap/lot_clip.py --serve-dir tmp/nearmap-serve --delivery 18775-macalpine-loop-bend-or-97702` then promote. 3D needs `urls.mesh` in the manifest (step 2b + promote). Paste `nearmap.gs` + `menu.gs` (save, new deployment) is only needed for the menu item itself.

### 6. Sync to GitHub

**Sync This Row** / **Sync Nearmap to GitHub**. Writes `data/nearmap/{id}.json` only. Trial does **not** touch `data/index/` (`NM_UPSERT_INDEX = false`). Does not write `views.security`.

Compare visually to Jones satellite + plane. Nearmap AOI is the vendor crop, not the taxlot.

## Macalpine trial evidence (2026-09-07)

Normalize (`--only macalpine`):

- Delivery id: `18775-macalpine-loop-bend-or-97702`
- Bounds WGS84: west -121.38079, south 44.04034, east -121.37748, north 44.04242
- AI counts: Building 2, Driveway 18, Residential Chimney 2, Roof 1, Skylight 1, Solar Panel 1, Swimming Pool 1, Woody Vegetation 461; 46 Bedrock hints
- Serve-out: `vert.jpg` + N/E/S/W + `ai/features.json` + `ai/original/regions.json` + `ai/edits/regions.json` + `manifest.json` (no `merged_Vert.tif`)

Promote: `s3://property-intel-tiles/nearmap/18775-macalpine-loop-bend-or-97702/` plus `reference/nearmap.json`; CloudFront invalidate `/nearmap/18775-macalpine-loop-bend-or-97702/*` and `/reference/nearmap.json`.

Review page (local tiles): `http://localhost:8899/nearmap-review.html?delivery=18775-macalpine-loop-bend-or-97702&tiles=http://localhost:8899/tmp/nearmap-serve/` — GroundOverlay fitted to those bounds; Accept / brush / draw produce catalog pins at centroids. Sheet save needs `site_no=` plus a deployed `nearmap-save`.

Jones comparison (do not merge into `views.security`):

- Hub: `data/index/6de88883bfd4a8349a901c54611ed9d7.json`
- Satellite: `data/satellite/6de88883bfd4a8349a901c54611ed9d7.json`
- Plane view id: `ccd8c44194813010120989ab863e77b5`

Still operator-only: paste Apps Script (save **and** new deployment), Set Up Nearmap Sheet, Import registry, fill Site No by hand, review locally, Sync. Do not hand-edit `data/nearmap/*.json`. Raw zip archive to ingest `raw/` is optional; local zip was the normalize input. Do not push reviewer HTML until Jonah says complete.

## Columbia St API pull (2026-09-08)

Probe folder (already downloaded; do not commit `transaction.json`):

`C:\Users\Jonah Bourgeois\Downloads\property-intel-v2\nearmap-probe\phase3b`

```
python tools/nearmap/pack_tx_folder.py --src "C:\Users\Jonah Bourgeois\Downloads\property-intel-v2\nearmap-probe\phase3b" --address "410 SW Columbia St, Bend, OR 97702" --out tmp/nearmap-canonical --serve-out tmp/nearmap-serve
python tools/nearmap/promote.py --serve-dir tmp/nearmap-serve --delivery 410-sw-columbia-st-bend-or-97702
```

- Delivery id: `410-sw-columbia-st-bend-or-97702`
- Survey 2026-07-02, 7.5 cm Vert 1451×1439, 148 AI features
- `site_no` unknown — leave blank; do not guess
- Review (CloudFront): `https://responder-intel.vyanet.com/nearmap-review.html?delivery=410-sw-columbia-st-bend-or-97702`
- Review (local): `http://localhost:8899/nearmap-review.html?delivery=410-sw-columbia-st-bend-or-97702&tiles=http://localhost:8899/tmp/nearmap-serve/`

Optional ingest archive (no token):

```
aws s3 sync tmp/nearmap-canonical/410-sw-columbia-st-bend-or-97702/canonical s3://property-intel-ingest/nearmap/410-sw-columbia-st-bend-or-97702/canonical/
```

## Later: full API access

Replace steps 1–2 with a job that, given `site_no` + parcel ring from the sheet, calls Transactional Content API + AI Feature API and writes the **same canonical tree**. Then run promote.py (or the same promote code in that job).

Sheet columns, Bedrock, sync, and `nearmap-review.html` stay unchanged.

MapBrowser 3D remains optional: inventory under `canonical/mesh/`, never the model-viewer camera.

## Failure notes

- **Redmond 6th / tiny AOI:** open in MapBrowser before treating as a real sample.
- **19530 vs 19570 Amber Meadow:** 3D export and API folder disagree — confirm the lot before joining `site_no`.
- **Promote without credentials:** normalize still writes `--serve-out`; skip AWS and review locally.
- **Apps Script:** editor-clean ≠ deployed (three prior incidents).
