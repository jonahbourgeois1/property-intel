# Nearmap changelog (v1)

Newest on top. Format: What / Why / Files / How it was checked / Status.

## 2026-09-07 — Review v1.2.0: per-layer colors, hint centroids, catalog pins

**What.** Hint points come from `ai/hints.json` lon/lat (v1.0.1 only drew Point geometries, and the packed AI file has polygons). Each class has its own color and checkbox. Vegetation layers start unchecked so the house/driveway/pool stay readable; All/None still available. Catalog pins are numbered markers on top of the overlay; empty list explains Pass 1 / `site_no`.

**Why.** Live Pages v1.0.1 showed one cyan overlay, a dead hint toggle, and no catalog pins.

**Files.** `nearmap-review.html` (v1.2.0), `docs/NEARMAP_CHANGELOG.md`

**How it was checked.** `node --check` on extracted module; getElementById vs ids; local review URL. Not verified until this HTML is on Pages: responder-intel.vyanet.com still served v1.0.1.

**Status.** Commit/push `nearmap-review.html` for GitHub Pages. Catalog pins still need Pass 1 in the sheet plus `?site_no=` (or a synced `data/nearmap/{id}.json`).

## 2026-09-07 — Pass 1 pins copy AI-layer locations only

**What.** Nearmap Pass 1 no longer wraps the satellite visual prompt or KB. Pins must copy x,y from a numbered AI feature (lon/lat → JPEG % via sheet bounds). Validator `nmValidatePass1Pins_` overwrites coords from that feature or drops the pin. Catalog ids with no Nearmap class (Front door, Vehicle Entrance, Fence, Sidewalk, Garage, yards, …) are omitted. `hints.json` now stores every centroid, not a cap of 80. Satellite Pass 1/2 unchanged. Prompt lives in `nearmap.gs` as `nmElementPinsPrompt_` (do not paste `prompts.gs` for this).

**Why.** The previous wrapper told the model to pin from the image and use AI only when it agreed, which invented locations the layers did not provide.

**Files.** `apps scripts/nearmap.gs` (`nmElementPinsPrompt_`), `tools/nearmap/normalize.py`, `docs/NEARMAP_CONTRACT.md`, `docs/NEARMAP_RUNBOOK.md`

**How it was checked.** Brace/paren 0 on `nearmap.gs` + `prompts.gs`. Local rebuild of Macalpine `hints.json` from canonical `ai/raw` (hint count = full FC). Affine check: Roof centroid → JPEG %. Distinctive strings: satellite prompt still has ACCESS FIRST; Nearmap prompt has LOCATION RULE — NO ASSUMPTIONS. Not verified: live Bedrock Pass 1 after paste/deploy; CloudFront `hints.json` until re-promote.

**Status.** Paste **only** `nearmap.gs` over the existing Nearmap file (do not add a second `prompts.gs` — that throws `ZOOM_PROMPT_RESIDENTIAL` already declared). Save **and** new deployment, re-promote `ai/hints.json`, re-run Pass 1 on row 2.

## 2026-09-07 — Full AI layers as checkable overlays

**What.** Viewer `features.json` keeps every Nearmap class with full polygons (including all vegetation). Review page: one checkbox per class. Bedrock still uses small `hints.json`.

**Why.** Overlay condensation (woody→points, dropped med-high veg) hid landscaping layers.

**Files.** `tools/nearmap/normalize.py`, `nearmap-review.html` (v1.1.0), `apps scripts/nearmap.gs`, `docs/NEARMAP_CONTRACT.md`

**How it was checked.** Rebuild Macalpine from canonical `ai/raw`, promote `features.json` + `hints.json`, `node --check` on the review script.

**Status.** Paste `nearmap.gs` for hints fetch. Push `nearmap-review.html` for Pages.

## 2026-09-07 — Pass 1 uses vert-p1.jpg (Bedrock 5 MB)

**What.** Review still is `vert.jpg` (4096). Pass 1 fetches `vert-p1.jpg` (1600). Failures write a clearer ERROR into Nadir Elements.

**Why.** Macalpine `vert.jpg` is 4.5 MB; base64 ~6 MB, over Bedrock’s 5 MB cap.

**Files.** `tools/nearmap/normalize.py`, `apps scripts/nearmap.gs`, `docs/NEARMAP_CONTRACT.md`

**How it was checked.** Local `vert-p1.jpg` from Macalpine serve JPEG. Promote when credentials allow.

**Status.** Paste `nearmap.gs`; wait for CloudFront invalidate of `vert-p1.jpg`; re-run Pass 1. Column R has the previous error text.

## 2026-09-07 — Import no longer lands on row 53

**What.** Setup no longer inserts 50 checkbox rows (those count as `getLastRow` content). Import writes the first empty data row and packs real rows to the top.

**Why.** First Macalpine import appended at row 53.

**Files.** `apps scripts/nearmap.gs`

**How it was checked.** Brace/paren 0 on `nearmap.gs`. Operator: paste, save, re-run Import from CloudFront registry — Macalpine should sit on row 2.

**Status.** Paste `nearmap.gs` and re-import. Existing row 53 can also be cut to row 2 by hand.

## 2026-09-07 — Isolated Nearmap trial pipeline

**What.** Contract + runbook, zip→canonical normalize, promote to tiles, mothership tab `Nearmap` (`NM_COL_*`), `nearmap.gs` Pass 1 + sync to `data/nearmap/`, `nearmap-review.html`. Trial does not write `data/index/` (`NM_UPSERT_INDEX = false`). `VIEW_ORDER`, `syncNow()`, and satellite Pass 1/2 untouched. Setup creates only the Nearmap tab and restores the previously active sheet.

**Why.** Own environment until the workflow is established. GitHub cannot house GeoTIFF/OBJ dumps; Apps Script is the only writer of published JSON; binaries stay on S3.

**Files.** `docs/NEARMAP_CONTRACT.md`, `docs/NEARMAP_RUNBOOK.md`, `tools/nearmap/normalize.py`, `tools/nearmap/promote.py`, `apps scripts/nearmap.gs`, `apps scripts/config.gs` (constants only), `apps scripts/menu.gs`, `apps scripts/critique-api.gs`, `apps scripts/prompts.gs`, `nearmap-review.html`, `data/nearmap/.gitkeep`.

**How it was checked.** Macalpine-only normalize from Ahartsi.zip → JPEG + WGS84 bounds + reduced AI (Building 2, Driveway 18, Chimney 2, Roof 1, Skylight 1, Solar 1, Pool 1, Woody Vegetation 461). Promote to `property-intel-tiles/nearmap/18775-macalpine-loop-bend-or-97702/` with `s3.head_object` + CloudFront invalidate. `node --check` on extracted `nearmap-review.html` script; brace/paren 0; every `getElementById` has a matching `id`. Browser: local review page GroundOverlay + AI overlay toggles on Jones/Macalpine. `VIEW_ORDER` still `['security', 'wildfire', 'plane', 'drone', 'interior']`.

**Status.** Code and Macalpine tiles ready. Apps Script paste / sheet import / Bedrock / GitHub sync are operator steps (save **and** new deployment). Not verified: live CloudFront fetch after invalidation in this session; ingest-bucket raw zip upload; Pass 1 pins; published `data/nearmap/{id}.json`.
