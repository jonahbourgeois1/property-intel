# CLAUDE.md — Property Intel

Read this first, whole. It is written for AI coding agents (Cursor, Claude Code, etc.).
The long-form export with evidence labels and tables is `docs/HANDOFF.md`.

## What this system is

Vyanet Property Intel turns aerial imagery into responder-facing property intelligence.
Per property: a nadir image, four compass obliques (alpha/bravo/charlie/delta), an
interactive 3D model, AI element/concern pins, guidance routes, technician camera
locations, and live CHEKT video/clips. Served to first responders and HOAs at
**responder-intel.vyanet.com**.

Three planes, four codebases:

1. **`jonahbourgeois1/property-intel` (v1, PUBLIC, GitHub Pages)** — HTML viewers plus all
   published per-property JSON under `data/`. The public repo serves real customer
   names/addresses by design; never add secrets or infra dumps here.
2. **`jonahbourgeois1/property-intel-v2` (PRIVATE)** — the Python capture pipeline,
   Segments 1–5: `1-ingest` → `2-parcels` → `3-eligibility` → `4-clip` → `5-render`,
   plus `docs/` (CONTEXT.md, contracts) and `CHANGELOG.md` (the project-wide log).
3. **Apps Script project "GitHub Property Intel Automation"** (~10–12 `.gs` files; lives
   ONLY in the Apps Script editor) — orchestrates everything from Google Sheets, calls
   Bedrock and the Lambdas, serves the element-review critique web app, and syncs sheet
   rows to GitHub.
4. **AWS**, account 719781265739, us-east-1:
   - Lambdas: `plane-eligibility-check-v2` (zip), `plane-parcel-clip`,
     `plane-parcel-render`, `plane-parcel-video` (same ECR image, Command override),
     `chekt-viewer-gateway` (function URL)
   - S3: `property-intel-ingest` (raw) + `property-intel-tiles` (serving)
   - CloudFront `EQJBJ6X237VQF` = `d3fg47bqswi0rr.cloudfront.net`
   - API Gateway `cdq6a4v125` ("plane-pipeline-api", stage `prod`)
   - Bedrock model `us.anthropic.claude-sonnet-4-6` + Knowledge Base `2USE5KFEJ6`

## THE constraint: git and AWS never communicate

- Lambda reads reference data from S3 only (never the repo) and writes to S3 + the
  Google Sheet — Sheets API via **Workload Identity Federation** (no service-account
  key exists; org policy forbids creating one).
- Apps Script independently syncs sheet rows → GitHub via the Contents API.
- The two systems do not know about each other. Do not add a GitHub call to any Lambda
  or an AWS call to any Pages workflow. This is a designed requirement.
- One sanctioned exception: the render Lambda loads a public viewer URL to build the
  human 360-link (a page load, not a data write).

Consequence you WILL hit: **every `data/*.json` record in v1 is owned by the Apps Script
sync. Hand-edits are overwritten on the next sync** (this destroyed the camera `live`
blocks twice). Change the sheet or the sync code, not the record.

## Authority chain — read before proposing changes

`docs/CONTEXT.md` → the numbered segment contract for the area being touched →
source code. The contracts:

- `1-ingest/1-DELIVERY_CONTRACT.md` (+ `1-RUNBOOK.md`)
- `2-parcels/2-PARCEL_CONTRACT.md`
- `3-eligibility/3-ELIGIBILITY_CONTRACT.md`
- `4-clip/4-CLIP_CONTRACT.md`
- `5-render/5-RENDER_CONTRACT.md`
- Segment 6 (integrations) has NO contract yet — it is owed; photo intake lives there.

Rules that follow from the chain:

- Check CONTEXT.md's **SUPERSEDED table** before recommending anything found in old
  notes or chats — dead designs resurface by keyword.
- If a contract doesn't cover a change, say so and draft the new clause as part of
  the work.
- Every change gets a `CHANGELOG.md` entry: What / Why / Files / How it was checked /
  Status, newest on top.
- As of 2026-08-24, `docs/CONTEXT-2026-08-19-DRAFT.md` is the accurate CONTEXT —
  adopt it (the 2026-08-03 file is sixteen days staler).

## Load-bearing invariants (each cost ≥ a day when violated)

1. **AUTOCAPTURE NO-ORBITCONTROLS** — in any headless render mode, OrbitControls is
   never *constructed*. Guarding `update()` calls is insufficient.
2. **One opacity function** — the render gate imports
   `3-eligibility/eligibility_check.capture_coverage`; eligibility and render may
   never disagree.
3. **Never CloudFront HEAD for existence checks** — it negative-caches 403s and
   poisons fresh uploads. `s3.head_object` only.
4. **Never auto-retry a render invoke** — boto3 defaults double-render;
   `retries={"max_attempts": 0}`.
5. **Invalidate CloudFront after every still render** — render keys are stable and
   cached long. (Videos are exempt: input-hashed, write-once keys.)
6. **Build the render container from repo root** — the Dockerfile COPYs
   `3-eligibility/` and `4-clip/`.
7. **`node --check` + structural referee before delivering any Apps Script or viewer
   file** (see Verification).
8. **Branch on `GPSImgDirectionRef` per photo, never per batch** — iPhone 15 Pro wrote
   magnetic, iPhone 16e wrote true; a blanket declination points cones 14° wrong,
   silently.
9. **Normalize photo orientation by resolving the EXIF tag** (`exif_transpose`, then
   Orientation=1) — never preserve the tag.
10. **Raw technician photos never enter the CloudFront-served bucket** (they carry
    customer GPS). Raw → `property-intel-ingest`; normalized → `property-intel-tiles`.

Viewer-geometry cluster:

- Map substrate keeps `tilt: 0` and no rotation — the nadir-rectangle guarantee is
  structural, not corrected.
- All polygon math in a local frame — **never on absolute projected metres**
  (catastrophic float cancellation).
- **Refuse out-of-bounds pin placements; never clamp** — clamping silently relocates
  pins (server-side `clampCoords` is a known defect of this class).
- Attach map overlays at construction; wrap optional layers in try/catch.
- Static Maps `size=` IS the logical size; `scale=2` only densifies pixels — dividing
  moves the NW corner ~69 m.

Apps Script cluster:

- **When the prompt and the validator disagree, the validator wins** — never fix
  vocabulary escapes with stronger prompt wording.
- Fresh Pass 1 emits only the ranked twenty (`SAT_PASS1_EMIT_IDS`); analyst reruns
  keep all 239. **This asymmetry is the design** — "unifying" it recreates the
  MOCKINGBIRD add-loss bug.
- Satellite ids = `hashId(slug(site_no))`; plane/drone/responder-intel are name-keyed.
  Never unify the two id rules (client links are already delivered).
- After pasting a file: save AND create a **new deployment version** — editor-clean ≠
  deployed (three staleness incidents).

Catalog rule:

- `data/pin-catalog/pins-catalog.json` (239 pins; `role: primary|concern`,
  `account_type`, `analysis: fr|wf|shared`) is data that behaves like code.
  **Never flatten `role=`** — it empties Pass 2's vocabulary AND breaks its done-flag
  (two Bedrock calls per row per batch, forever). Behavior changes go in the loaders
  (`satFetchPinCatalog_`) or prompts, not the catalog.

## SUPERSEDED (short list — full table lives in CONTEXT.md)

| Dead | Live |
|---|---|
| Whole-mesh drone GLB / `prepare_render_drone` / "Segments 2/3/4 not used" | Drone captures are parcel-clipped exactly like plane captures; `parcels_ref` required on EVERY capture |
| `model-viewer.html?autocapture=1` on Pages as the render camera | Bundled `5-render/render-viewer.html` at `file:///var/task/` |
| Rectangle-overlap coverage math | Shared opacity sampling (`eligibility_check.py`) |
| Per-capture `parcels_key` | Registry `parcels_ref` → county layer |
| `--disable-gpu` | SwiftShader/ANGLE flag set |
| Cesium viewer; OpenSearch Serverless | Three.js; provisioned `t3.small.search` |
| Zoho Forms as the photo transport | Closed — 7 routes tested; see `docs/PHOTO_INTAKE_DECISION.md`; do not re-litigate |
| v1 repo's `lambda/` folder as source of truth | **Stale vs deployed images** — deploy source is v2 `5-render/` + `3-eligibility/` |
| "CHEKT has no video stream" | False — portal is WebRTC; snapshots/MJPEG are separate, simpler surfaces |

## Key files

v1 repo:

- `element-review.html` — pin QA on a Google Maps basemap (v6.8.8); posts critiques to
  the Apps Script web app; side labels built but disabled (`ER_SIDES_DEFAULT=false`)
- `nadir-geo.js` — v1.3.1 dependency-free Mercator geometry; must sit beside
  element-review; unit suite `test-nadir-geo.mjs`
- `model-viewer.html` — responder 3D viewer + live video layer (no in-file version
  const; versioned via CHANGELOG/design doc)
- `viewer.html` / `responder-intel.html` / `hoa-viewer.html` / `plane-viewer.html` /
  `plane-test.html` — secondary surfaces
- `data/index/{id}.json` — property → views join hub
- `data/cameras/{id}.json` — property camera metadata (not a view record). Apps Script drone-test sync is the writer (`camerasFileForSync_` in `shared.gs`)
- `data/cameras/images/{id}/` — GitHub-served camera stills until CloudFront tiles exist (git-committed; not in `pushAllToGitHub`)
- `data/{satellite,plane,drone,drone-test,responder-drone,hoa}/` — sync-owned records
- `data/parcels/deschutes_*.geojson` — viewer lot-line tiles (0.07° grid)
- `data/pin-catalog/pins-catalog.json` — THE catalog
- `config.js` — **generated by `.github/workflows/build.yml` from a repo secret;
  never hand-edit**
- `lambda/` — stale reference copies (documentation value only)

v2 repo:

- `5-render/lambda_handler.py` + `render-viewer.html` (the single headless camera —
  never forked) + `video_render.py` + `render_sweep.py`
- `5-render/deploy-render.ps1` — crane push, git-SHA tags, classic image store,
  single-manifest verification; `-FunctionName` reuses the image for video
- `4-clip/clip_parcel.py` — the clip engine
- `3-eligibility/eligibility_check.py` — coverage truth
- `2-parcels/publish_parcels.py` + `counties.json` (`deschutes` + `lane`; Lane join is `MAPTAXLOT`)
- `1-ingest/ingest_capture.py` + `promote_capture.py` (⚠️ hardcodes `captures/plane/`,
  stamps `type: plane`, never sets `parcels_ref` — operator adds it by hand
  immediately after promote)
- `tools/audit_serving.py` — required post-promote byte-compare (plane prefix only)
- `docs/` + `CHANGELOG.md` — the institutional memory

Not in any repo: the Apps Script files (editor only; `.gs.txt` exports land in the
`Downloads\property-intel-v2` scratch folder), `chekt-viewer-gateway.py`
(hand-deployed; copy in scratch), the live `reference/captures.json` (S3 only).

## Flows in one breath each

- **Plane render:** Apps Script row → API GW (**async Event** — renders exceed the
  29 s sync cap) → render Lambda: geocode → `select_capture` newest-first (parcel
  match → ≥80% tile coverage → GLB exists; hard gates) → frontage tier chain
  (ENTRANCE → ROAD → edge-probe → nearest-edge fallback) → 4 obliques + nadir → S3 →
  Bedrock descriptions → one batch Sheets write (cols F–O, R). Render failure →
  `os._exit(1)` on purpose, so the async retry gets a cold container.
- **Eligibility:** sync batch POST `/eligibility` → geocode-or-passthrough → taxlot
  point-in-polygon → z19 opacity sampling → verdict + taxlot + coverage per row.
- **Satellite:** Apps Script builds a parcel-fitted Static-Maps nadir → Bedrock Pass 1
  (the twenty) → human review in element-review → Pass 2 FR + WF halves (hard-gated on
  Elements Reviewed, col J) → sync PUTs `data/satellite/{id}.json` to GitHub.
- **Critique loop:** element-review POST → critique web app → sheet write + optional
  inline re-pin (all-239 vocabulary) → note consumed on `rerunRan` (⚠️ open bug: adds
  can drop silently — MOCKINGBIRD row 277 redo pending, success = 8+ pins).
- **Capture onboarding (data-only, no deploys):** ingest (5 gates) → review manifest →
  promote → hand-set `parcels_ref` → `audit_serving.py` → downstream discovers the
  capture from the registry automatically. New county first: `counties.json` entry →
  inspect → report → publish dry → publish → probe.
- **Live video:** viewer (no credential) → gateway Lambda (`x-viewer-key` header) →
  CHEKT dealer API → scoped 60-min MJPEG URLs / 1-h clip links. Dealer key never
  leaves AWS. 401 = expired, **403 = wrong camera**; ~7 rapid calls → 429.

## Conventions

- Capture ids `bend-5-21-26-run3` (lowercase/digits/hyphens, flight-date-preserving).
- Views: alpha = frontage bearing; bravo/charlie/delta = +90/180/270° **clockwise**.
- Pins stored as % of the nadir frame (5–95 storable box); pin ids are catalog ints.
- `account_type`: anything not starting "comm" normalizes to residential.
- Viewers: single-file; `BUILD` const + visible build chip; URL-encode nested URLs
  (`qp()` stops at the first `&`); critique payload = 19-key compatibility contract.
- Record resolution: `?property=<hash>` → `data/index/{hash}.json` → `views` →
  `data/{view}/{viewId}.json` (index 404 falls through to `data/drone-test/{id}.json`).
- Python: env-var config with defaults; warm-container caches; one geocode per
  address (coords passthrough); a new concern gets its OWN Lambda (video precedent);
  stills = stable keys + invalidation, videos = hashed write-once keys.
- Every change → CHANGELOG entry. Data changes (captures, counties, rows, PROPERTY_MAP
  pairs) are preferred over code changes when both work — the pipeline is designed
  for data-only onboarding.

## Verification (required before "done")

- JS/viewers: extract the `<script type="module">` to `.mjs` → `node --check`; brace
  balance; duplicate-declaration scan; every `getElementById('x')` literal has a
  matching `id="x"`; every `onclick="fn("` resolves on window.
- Scripted edits: exact-string replacement with an occurrence-count assert per block;
  anchor on ASCII-only strings (files contain 1,000+ non-ASCII chars).
- Behavior: Playwright with `page.route` stubs for CDN imports, maps.googleapis.com,
  script.google.com, CHEKT — **unstubbed modules never evaluate and every check
  silently passes on nothing.**
- Before patching a viewer, PROVE the local copy matches what is live (probe ~50
  distinctive strings) — stale local copies have silently reverted shipped work.
- Python: `py_compile` + the local referees (`eligibility_check.py report`,
  `clip_parcel.py clip` + `compare_glb.py`, aws-lambda-rie for containers).
- **After any render change, run the row-3 oracle:** 18775 Macalpine Loop, Bend, OR
  97702 / taxlot `181102C000600` → ok=true, tier ENTRANCE, alpha=231.3°, nadir 148/156.
- PowerShell deliverables: pure ASCII, UTF-8 BOM, no `Read-Host` in pasteable scripts.
- Always state plainly what was NOT verified.

## Current focus (as of 2026-08-24) & danger zones

In flight:

- MOCKINGBIRD row-277 redo verification (first check after any satellite.gs deploy)
- Reviewer revisit lists: Ross 88 rows / Eleanor 27 (mostly Parking/Entry/Driveway/
  Sidewalk adds); known gaps: "church" has no catalog match; row 533 sat at the
  12-pin ceiling (schools are 20 as of 2026-08-27)
- Photo-intake transport: Zoho Creator probe 2 ready to run; fallback = own page +
  S3 presigned POST (`docs/PHOTO_INTAKE_DECISION.md`)
- Eugene capture: Lane parcels on CDN + `data/parcels/lane_*.geojson`.
  Capture `vyanet-eugene-2026-08-19` is in serving (`captures/plane/`, `type: plane`,
  `parcels_ref: lane`). Origin taxlot `1704233002104` is 65% opaque — below the 80%
  clip/render gate. Adapter: v2 `tools/adapt_obj_delivery.py`.
  `docs/EUGENE_CAPTURE_RUNBOOK.md`
- EagleView 30-day eval ends ~Sep 17 — license rights (analyze/cache/derive/resell)
  and 3D-mesh questions first
- Satellite Pass-1 placement-failure diagnostics (corner-stack hypothesis: unit
  mismatch + clamp relocation)
- Adopt the 08-19 CONTEXT draft; commit the dirty v2 tree; push

Ranked open bugs: (1) critique add-loss guard missing; (2) standard 12-pin ceiling +
prompt/rollback contradiction on full rows (schools are 20 as of 2026-08-27); (3) `?route=ping` deployed-vocab check
wanted; (4) plane.gs reads the Satellite tab via stale COL_* (latent off-by-one);
(5) responder-intel.html flat `pixelToLatLng` (0.488% N-S stretch — migrate to nadir-geo). Also:
`load_captures()` plane|drone edit is **not deployed** — drone-typed captures are
invisible to clip/render until it ships; re-baseline the row-3 oracle after.

Do NOT touch until onboarded: the pin-catalog `role=` fields + Pass-1/rerun vocabulary
code; `promote_capture.py` + the capture registry (never re-run promote for an
existing drone capture); the render-invariants cluster in `5-render/`; `config.js`;
any sync-owned `data/*.json`.

## Working agreement (translated for the Cursor era)

This project was built with Jonah applying every edit by hand, one small step at a
time, with plain-language explanations — he maintains this system and explains it to
others. In Cursor the agent may edit files directly, but keep the spirit:

- Small, reviewable steps; explain the why in plain language.
- One complete file over paste-in-parts when a whole file is asked for.
- A CHANGELOG entry per change; verification evidence with every delivery.
- Say plainly what was not verified.
- Check CONTEXT.md's top sections are still true before proposing work; end sessions
  by writing the CONTEXT delta and any contract clauses touched.

## Secrets & publication rules

Never commit: the CHEKT dealer key or viewer passcode, Apps Script tokens, Secrets
Manager values, raw technician photos (customer GPS), customer CSV/XLSX exports.
The v1 repo is PUBLIC: the browser geocode key in `config.js` is deliberately
published (Action-injected), and customer names/addresses in `data/` are the current
operating posture — do not extend either pattern to new kinds of data, and keep
infra-heavy docs (like `docs/HANDOFF.md`) in the private v2 repo.
