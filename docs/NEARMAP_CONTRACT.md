# Nearmap contract (Segment 6 clause)

**Status:** trial / isolated until Jonah promotes it.  
**Date:** 2026-09-07  
**No numbered segment contract covers this.** Segment 6 (integrations) is still owed. This file is the Nearmap clause.

**Writer of GitHub `data/**`:** Apps Script sync only. Do not hand-edit `data/nearmap/` or index `views.nearmap`; the next sync overwrites them.

## What this is

Nearmap trial imagery + AI polygons enter Property Intel through an **isolated environment**: own S3 prefixes, own mothership tab `Nearmap`, own Apps Script file, own review page, own published JSON folder. Satellite, Plane, Drone, Golf, `SAT_COL_*`, `SAT_PASS1_EMIT_IDS`, production `VIEW_ORDER`, `syncNow()`, and `pins-catalog.json` are untouched. Set Up Nearmap Sheet creates or updates **only** that tab (appended at the end) and restores the sheet you were on.

The vendor export shape observed in `Ahartsi.zip` (Transactional Content API folder **and/or** MapBrowser 3D zips) is the long-term ingest input. A future API pull must write the **same canonical tree** so sheet, Bedrock, sync, and the review page never care how the bytes arrived.

## Identity

| Surface | Key | Rule |
|---|---|---|
| Nearmap sheet col A | `site_no` | Same as satellite. Lookups key on this, never address. Never fall through to the Satellite tab. |
| Published file `data/nearmap/{id}.json` | `hashId(slug(site_no))` | File key. Jones production hub is `hashId("jones")` = `6de88883…` — **not** this id. |
| CloudFront serving prefix | `delivery_id` (address slug) | Stable before `site_no` is known. Jones has three site numbers — do not guess. |
| Index hub | trial: **do not write** | `NM_UPSERT_INDEX = false`. Promotion merges `views.nearmap` onto the **existing** hub (Jones `6de88883…`), never `upsertIndexEntry_(hashId(site_no))` (Tracy fork). Must not write `security` / `wildfire`. |

Blank `site_no` is refused for GitHub publish (`hashId('')` would collide). Trial review may load CloudFront by `delivery_id` before a site_no exists.

## Writers

| Place | What | Who writes |
|---|---|---|
| `s3://property-intel-ingest/nearmap/{delivery}/raw/` | Vendor zip or unpacked dump | Operator now; API job later |
| `s3://property-intel-ingest/nearmap/{delivery}/canonical/` | Normalized tree | `tools/nearmap/normalize.py` |
| `s3://property-intel-tiles/nearmap/{delivery_id}/` | Derived stills + compact AI + serving manifest | `tools/nearmap/promote.py` |
| `s3://property-intel-tiles/reference/nearmap.json` | Delivery registry | promote.py (merge by `delivery_id`) |
| Google Sheet tab `Nearmap` | Operational state | `nearmap.gs` |
| `data/nearmap/{id}.json` | Published record | Apps Script `processNearmapSheet` / `processNearmapForActiveRow` |
| `data/index/{hub}.json` `views.nearmap` | Promotion only | Same Apps Script, after `NM_UPSERT_INDEX` is flipped **and** the hub id is the existing one |

Lambda / normalize / promote **never** call GitHub. GitHub Actions **never** call AWS.

Do **not** append Nearmap deliveries to `reference/captures.json`. That file feeds plane/drone clip/render.

## Canonical tree (ingest)

```
nearmap/{delivery}/canonical/
  manifest.json
  imagery/vert/          JPEG tiles + VRT (no uncompressed merged_Vert in serving)
  imagery/{north,east,south,west}/
  elevation/dsm.tif
  elevation/dtm.tif
  ai/raw/*.geojson       vendor files, ingest-only
  ai/features.json       reduced, serving
  mesh/                  optional MapBrowser OBJ/LAS inventory; mesh_to_glb.py derives serve/mesh/model.glb for nearmap-viewer (not for the render camera)
```

`manifest.json` is the join object: `delivery_id`, `source` (`api` | `mapbrowser` | `both`), `survey_date`, `crs`, `aoi` / `bounds`, file list, `site_no` once the operator joins it.

## Serving keys (CloudFront)

Base: `https://d3fg47bqswi0rr.cloudfront.net/nearmap/{delivery_id}/`

- `vert.jpg` — derived JPEG (long edge capped), not the uncompressed mosaic
- `vert-p1.jpg` — smaller JPEG for Bedrock Pass 1 (5 MB payload cap). Same crop; x,y percent still match `vert.jpg`.
- `north.jpg` `east.jpg` `south.jpg` `west.jpg` — compass looks, not alpha/bravo
- `ai/features.json` — full Feature Collection, one feature per vendor polygon
- `ai/hints.json` — counts + all feature centroids for Bedrock Pass 1 (no polygons)
- `manifest.json` — serving subset (URLs + bounds)

Existence checks: `s3.head_object` only. Invalidate CloudFront after still uploads (`/nearmap/{delivery_id}/*` and `/reference/nearmap.json`).

## Published record

```json
{
  "view": "nearmap",
  "source": "nearmap",
  "survey_date": "2026-07-02",
  "delivery_id": "18775-macalpine-loop-bend-or-97702",
  "nadir": {
    "url": "https://d3fg47bqswi0rr.cloudfront.net/nearmap/{delivery_id}/vert.jpg",
    "bounds": { "north": 0, "south": 0, "east": 0, "west": 0 }
  },
  "obliques": {
    "north": { "url": "..." },
    "east": { "url": "..." },
    "south": { "url": "..." },
    "west": { "url": "..." }
  },
  "ai_url": "https://d3fg47bqswi0rr.cloudfront.net/nearmap/{delivery_id}/ai/features.json",
  "elements": [{ "id": 57, "x": 56.5, "y": 51, "source": "ai" }],
  "drawn": { "type": "FeatureCollection", "features": [] },
  "lat": 0,
  "lng": 0
}
```

Pins are catalog integer ids as **percent of the Nearmap nadir JPEG** (0,0 = top-left). Viewers unproject with `nadir.bounds`. Refuse non-finite coords; never clamp into the frame. Reviewer regions are written to S3 `ai/edits/regions.json` through Apps Script (see Regions below) — never to GitHub. **Do not** write reviewer edits into CloudFront `ai/features.json` or `ai/original/regions.json`.

## Reviewer-first elements (local until complete)

**Two editors, one page, never both at once.** `nearmap-review.html?mode=regions` (default) edits vendor regions only: pins are not drawn, not consumed, not saved — Save posts the regions diff with **no `pins` key**, and `nmSavePins_` leaves column R alone when the key is absent. `?mode=pins` edits catalog pins only: regions are read-only context, Save posts `pins` with no `regions`. Pins are **seeded one per finished region** at its interior point, mapped by vendor class × account type (`SEED_MAP`); vegetation, Tree Overhang and Natural are skipped, **Lawn Grass is the only green class that gets a pin**; Car (no catalog pin) and Building (Deprecated) (duplicate footprint) are skipped and reported. Seeding stops at the pin cap and says so. Place pin adds by hand (picker suggests the region's mapped id). Deleting a pin in the pins editor never changes a region. The sheet menu opens each editor separately.

**Two open modes.** *Sheet mode* (`site_no=` from the Nearmap sheet, or `property=` from a published record): original and edits both come from CloudFront (`ai/original/` and `ai/edits/`), Save posts the working regions to Apps Script which PUTs them to S3, nothing is reset on reload. *Testing mode* (plain `delivery=` open, no sheet identity): every open starts from `ai/original/regions.json` with no pins; the local edits file and browser backups are ignored and local `ai/edits/regions.json` is reset to the original. `?fresh=0` resumes local edits; `?fresh=1` forces a fresh start even in sheet mode.

First-round pins come from the reviewer, not Bedrock. Vendor polygons start as read-only overlays. The toolbar is Pan / Draw (Accept was removed 2026-09-09). The reviewer **draws** on a picked region (left-click adds area, right-click removes); **Clear brush** next to the history arrows drops the pick and returns to the `+` pick cursor. A size slider under Draw sets one brush radius in pixels (4–48). The cursor fill, the live stroke preview (own canvas, not a Maps polyline — Maps caps polyline width), and the paint/erase mask all use that radius; the selected pin, hint marker, and polygon are **not** singled out; instead the **active class** (last layer checked, or the class of the picked region; click a checked layer's name to switch) draws every polygon of that class with a class-colored border over a white halo. Driveway is pink (`#f72585`). Under Size, back/forward arrows (`◀ ▶`) step through an in-memory history of paint strokes (grow, erase, new region), capped at 30; Revert regions clears that history; nothing about it is written to localStorage or the file. Scroll-wheel zoom stays available while drawing; the map does not pan until you click Pan. The painted area is the exact brush sweep. If that sweep **touches** the selected region, it unions into that polygon. If it does **not** touch, the stroke becomes a **new** same-class region (nearby same-class scraps still join within **1 m** of the paint only). In both cases, un-pinned same-class regions that the result **covers or overlaps** are absorbed into it (no duplicate scraps left inside a merged region) — except the picked region itself: if a "detached" stroke ends up reaching the picked region, it is treated as a grow of that region, so the pick never points at a deleted id. A stroke made with a pick whose region no longer exists drops the pick and asks for a new one. No convex hull. Leaving Draw, or hiding the picked region's layer, drops the pick; hidden layers are never force-drawn. The class count in the layer list is recounted after every paint, merge, delete, and revert. Surviving original edges keep their vertices; only the painted extension is smoothed to the same segment length as the source polygon. **Erase target rule:** a right-click erase acts on **every** visible same-class region the brush sweep touches (the picked region included); only if it touches none does it fall back to any visible region under it. A sweep over bare ground changes nothing and reports "Nothing to remove under the brush". The picked region stays armed unless it was the one removed. **Erase split rule:** an erase that leaves N ≥ 2 outer polygons on a target keeps the **largest** on that feature (same id, same properties, single `Polygon`; holes stay with their outer ring) and writes each other piece as a **new** same-class feature `dN` with `origin: split`; no pins are created for split pieces, the picked pin (if any) re-centres on the largest piece and still refuses out-of-bounds. **Erase edge rule:** contour points inside the brush sweep are new boundary and never snap back to a pre-stroke edge; on erase the mask is opened (erode/dilate by half the sliver width) within reach of the stroke so thin crescents do not become spikes. **Erase fragment rule:** each piece is measured in the local metre frame (area and outer perimeter — never absolute projected metres). Rules are absolute: a **crumb** is under `ERASE_MIN_FRAG_M2 = 3 m²`, a **sliver** has mean width `2·area/perimeter < ERASE_SLIVER_WIDTH_M = 0.8 m`. When the erase leaves several pieces, crumbs and slivers are dropped; when it leaves one piece, that piece is kept unless it is both a crumb and a sliver (or under 0.3 m²). A piece that still covers part of the feature's vendor original is never dropped — erasing an addition always leaves the scrap it was grown from. If nothing survives (or the erase mask is empty), that region is removed and its pin deleted; vendor originals are **not** restored (the erase is intentional). Every erase outcome is one paint-history snapshot, so `◀` restores it. Left-click grow and detached new-region paint do not split or drop. **Hole rule (cutouts):** holes are real geometry. Painting a closed loop leaves its inside empty — connecting the stroke does not flood-fill the courtyard. Erasing inside a solid region makes a hole. The editor draws every polygon with all its rings (`paths: [outer, …holes]`), the same as the viewer; every inside test (pick, absorb, snap, rasterise) treats a point in a hole as outside. Mask rings nest by depth (even = outer, odd = hole of the innermost enclosing outer), so an island inside a hole is its own polygon. **Gap-close rule (add-side of the erase sliver drop, not flood-fill):** after a left-click grow or new-region stroke the paint mask is closed (dilate then erode) by `GAP_CLOSE_BRUSH = 2` × the brush radius, **only within reach of this stroke's stamps** — leftover seams between almost-overlapping passes of this stroke fill; the rest of the region is untouched. A courtyard wider than ~2× that radius stays empty. A **substantial** existing hole (`HOLE_KEEP_M2 = 20 m²` or mean width ≥ `HOLE_KEEP_WIDTH_M = 3 m`) is restored unless the brush actually painted over it, so a cutout further up the driveway is not filled by a stroke elsewhere. Leftover triangles under those limits near the stroke are allowed to close. Erase cutouts are also stored as `properties.locked_holes` and punched back out at any size. Erase strokes never fill anything. Each committed group is a catalog pin at its **interior point**: the point with the greatest clearance from any edge (pole of inaccessibility, found from the area centroid plus scan-line span midpoints and a local grid refinement) — never a vertex average or a centroid that merely falls inside, both of which can sit on or against an edge of a C/L shape. Sheet column W (`NM_COL_DRAWN`) holds reviewer GeoJSON for publish. `NM_MAX_PINS` is 20.

## Regions (original vs edits) — the folder format

`regions.json` is the reviewer FeatureCollection of polygons (vendor scraps + merged/drawn/split groups). Both folders live on **S3 `property-intel-tiles`** and are read through CloudFront. **Nearmap regions never touch GitHub** (2026-09-09: client data is being kept off the public repo; Nearmap is part of that).

| Path | Writer | Rule |
|---|---|---|
| S3 `nearmap/{delivery}/ai/original/regions.json` | `normalize.py` / `seed_regions.py` → `promote.py` | Vendor snapshot. Nobody else writes here. **Revert regions always returns to this.** |
| S3 `nearmap/{delivery}/ai/edits/regions.json` | `promote.py` seeds it from original (`--reset-edits` reseeds); **Apps Script `nmSavePins_` rewrites it on reviewer Save** (sheet mode) with a SigV4 PUT (`nmS3PutObject_`, `Cache-Control: no-cache`, same AWS key that calls Bedrock) | The live working FeatureCollection (`{type, name:"nearmap-regions", source:"edits", delivery_id, saved, saved_by, counts, features}`). Save after Revert writes original back into it. |
| Local `ai/edits/regions.json` (serve tree) | `review_server.py` PUT (testing mode) | Working copy for `delivery=`-only sessions; never uploaded by promote. |

Sheet column W (`Drawn Features`) holds **only a summary** `{ drawn: FC, edits: { url, features, counts, saved, etag } }` — a cell is capped at 50 000 characters, the regions themselves never go in the sheet. `nearmap-elements` returns `regions_original_url` and `regions_edits_url`, both derived from the AI URL (`/ai/features.json` → `/ai/original/regions.json` and `/ai/edits/regions.json`). The published record `data/nearmap/{id}.json` carries `regions: { original, edits, edits_saved }` (URLs only).

Writers: `promote.py` (original + seed) and Apps Script (edits) are the only S3 writers under `nearmap/`; Lambda is not involved; GitHub is not involved. The Apps Script AWS key needs `s3:PutObject` on `arn:aws:s3:::property-intel-tiles/nearmap/*/ai/edits/regions.json` (and `nearmap/_probe/*` for `checkS3EditsWrite`).

Re-normalize **overwrites original** and **does not** overwrite an existing local edits file unless `--reset-edits`. Local save: `python tools/nearmap/review_server.py 8899` (PUT only `**/ai/edits/regions.json`).

## AI layers (viewer vs Bedrock)

`ai/features.json` is the **full** vendor Feature Collection: every class, every polygon, including overlapping vegetation and landscaping. The review page treats each class as a checkable overlay. Do not drop, cap, or centroid-replace viewer geometries.

Bedrock still must not receive that dump. Promote also writes `ai/hints.json` (`counts` + **all** feature centroids, no geometry). Pass 1 fetches hints, converts lon/lat to JPEG percent with the sheet nadir bounds, and may pin **only** at those centroids. Catalog ids with no Nearmap class mapping (Front door, Vehicle Entrance, Fence, Sidewalk, Garage, yards, …) are omitted. Nearmap class names never enter `pins-catalog.json`. Pins remain catalog ids. Condition attributes stay on features; they are not pins.

When the prompt and the validator disagree, the validator wins (`nmValidatePass1Pins_` copies the AI feature’s x,y or drops the pin).

## Isolated product surface

- Sheet: `Nearmap` (`NM_COL_*` in `config.gs`). Not a mode of Satellite or Satellite Sandbox. Menu **Property Intel → Nearmap Pipeline → Set Up Nearmap Sheet**.
- Apps Script: `apps scripts/nearmap.gs`.
- Review: `nearmap-review.html` (not `viewer.html`). Trial URL: `nearmap-review.html?property={hash}` or `?delivery={delivery_id}`.
- **Do not** add `nearmap` to production `VIEW_ORDER` / `viewer.html` / vyanet Private tabs until promotion.
- **Do not** add Nearmap to `syncNow()`, top-level Sync This Row, or Satellite Pipeline.

## Nearmap viewer (`nearmap-viewer.html`, 2026-09-09)

Read-only sibling of `vyanet-viewer.html`, fed **only** by the Nearmap row and CloudFront: `?site_no=` → `nearmap-elements` (address, delivery, bounds, imagery URLs, pins) then `{delivery}/manifest.json`; `?delivery=` alone works without pins. It never reads `data/index/` or `data/nearmap/` (client data stays off GitHub). Tabs: **2D** (Google Maps satellite + nadir GroundOverlay + region polygons + numbered pins), **3D** (Three.js r128 GLB, regions draped by a vertex heightmap, pins as sprites; tab disabled when `urls.mesh` is absent), **Obliques** (N/E/S/W + nadir, lightbox). One AI-layer panel drives both views; vegetation layers start off, Lawn Grass on. Regions come from `ai/edits/regions.json` (fallback original). Opened from the sheet via **Open Nearmap Viewer (This Row)**.

**Mesh (supersedes the 2026-09-07 "inventory only" clause).** `tools/nearmap/mesh_to_glb.py` converts the MapBrowser `MeshTiledOBJ` (OBJ + MTL + JPEG textures + `.ofs` origin + `Tiles.prj`) into `{serve}/mesh/model.glb` (textures ≤ 4096 px, Draco via `gltf-pipeline`) and `mesh/mesh.json`, and stamps `urls.mesh` / `urls.mesh_meta` / `mesh{}` into the manifest. Frame: X east, Y north, Z up, metres; origin at the nadir-bounds centre projected through the delivery's own `Tiles.prj` (NAD83 Oregon North, intl ft); `mesh.local` holds the nadir corners in that frame (same bilinear convention as `model-viewer`'s `nadir.local`). Z0 = 2nd percentile of z. `promote.py` uploads `mesh/*` with the serve dir (`model/gltf-binary`). Still true: do not point `viewer360` / the headless render camera at Nearmap meshes; plane/drone GLBs stay the render source.

**Licence note.** The GLB is a *derived* vendor binary served from the public CloudFront tiles bucket. That is acceptable for the trial only if the Nearmap licence allows derived-mesh distribution; confirm before any customer-facing use (open question in CLAUDE.md: analyze/cache/derive/resell rights).

## Out of scope until promotion

- Editing satellite Pass 1/2, `SAT_PASS1_EMIT_IDS`, or the pin catalog
- Putting Nearmap on `viewer.html` or vyanet Private
- Render Lambda / headless camera on Nearmap meshes (mesh → GLB for the Nearmap viewer is in scope as of 2026-09-09)
- Clipping Vert to taxlot (trial serves Nearmap’s AOI with bounds)
- License / resell of vendor rasters — keep trial binaries in **ingest**; tiles hold derived stills, the derived mesh GLB, and compact JSON only

## Promotion checklist (only when Jonah says the workflow is established)

1. Nearmap `vert.jpg` + `bounds` may replace `prepareSatNadir_` Static Maps.
2. Reduced AI may inject into `runSatElementPinsCall_` the same way KB context does.
3. `nearmap` may join `VIEW_ORDER`.
4. Pins remain catalog ids. Do **not** auto-promote vendor polygons into `elements`.
5. Compass obliques → frontage-relative alpha/bravo is a separate decision.
6. Merge `views.nearmap` onto the **existing** property hub (Jones = `6de88883bfd4a8349a901c54611ed9d7`). Do not call `upsertIndexEntry_` with `hashId(site_no)` as the hub id.

## Changelog

- **2026-09-07** — First clause. Isolated mothership tab `Nearmap` / S3 prefixes / `data/nearmap/` / review page. Canonical tree matches Ahartsi.zip API + MapBrowser shapes. Trial sync skips `data/index/` so Jones is not forked. Satellite / Plane / `syncNow` unchanged.
