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
  "elements": [{ "id": "r12", "name": "Lawn Grass", "class": "Lawn Grass", "x": 72.0, "y": 36.9, "source": "region", "region_id": "12" }],
  "drawn": { "type": "FeatureCollection", "features": [] },
  "fr": {
    "concerns": [{ "id": 190, "x": 40.0, "y": 55.5 }],
    "considerations": "…",
    "recommendations": "…"
  },
  "wildfire": {
    "concerns": [{ "id": 205, "x": 48.0, "y": 42.0 }],
    "considerations": "…",
    "recommendations": "…"
  },
  "lat": 0,
  "lng": 0
}
```

Pins: **Pass 2** element pins are region-class names as **percent of the Nearmap nadir JPEG** (0,0 = top-left). **Pass 3** concern pins are catalog integer ids (`role: concern`) in the same percent space. Viewers unproject with `nadir.bounds`. Refuse non-finite coords; never clamp into the frame. Reviewer regions are written to S3 `ai/edits/regions.json` through Apps Script (see Regions below) — never to GitHub. **Do not** write reviewer edits into CloudFront `ai/features.json` or `ai/original/regions.json`.

## Pass 3 — FR + Wildfire concerns (2026-09-10)

Nearmap Pass 2 is the pin editor. Pass 3 is the Bedrock concern layer, sibling of satellite Pass 2, isolated in `nearmap.gs` (do not call `parseSatPass2_` / `runSatPass2Half_` / `satFetchPinCatalog_`; do not add a second `prompts.gs`).

| Rule | Detail |
|---|---|
| Gate | `NM_COL_REVIEWED` (S) === true **and** column R has region-style pins (`nmPinsAreRegionStyle_` + length > 0). Catalog leftovers and empty R refuse. |
| Sheet | **Append** X–AC (do not insert/shift A–W): FR Concerns / Considerations / Recommendations, WF Concerns / Considerations / Recommendations (`NM_COL_FR_*`, `NM_COL_WF_*`). Run **Set Up Nearmap Sheet** after paste so headers exist. |
| Catalog | `nmFetchPinCatalog_` cache `nmPinCatalogV2:{kind}:{type}` adds `frConcernNames/Ids` and `wfConcernNames/Ids` identically to satellite (account_type match, `role === 'concern'`, `analysis` tag fr/wf). School uses commercial via `normalizeAccountType`. Empty vocab logs a warning and **aborts that half** (no silent drop-all loop). **Never flatten `role=`.** |
| Inputs per half | Nadir via `nmFetchNadirForBedrock_` (`vert-lot-p1.jpg` then `vert-p1.jpg`, never `vert.jpg`, never CloudFront HEAD). Compass obliques N/E/S/W from the sheet until a ~3.5M-char base64 budget; remaining skipped with a log; prompt lists what was attached. Confirmed Pass 2 pins as `"n. Lawn Grass at (x, y)"` — class names, not catalog element ids. Region **counts only** (`nmCompactRegionsForPrompt_`) — never 1,500 polygons. KB queries match satellite Pass 2. |
| Validator | `validateConcernPins_` in `plane.gs` (reuse). Drops ids not in the concern set, **refuses the 5–95 box, never clamps**, cap `PLANE_MAX_PINS` (10), no duplicate ids. Optional taxlot drop via `nmFilterConcernsToLot_` (also refuse, never clamp). Pin % stay on full `vert.jpg`. |
| Halves | Independent writes. Failed half leaves its three columns empty; batch retries missing half. Menu: **Generate Pass 3 — FR + Wildfire Concerns (This Row)** / **(All Reviewed)**. |
| Publish | `nmBuildRecord_` adds satellite-shaped `fr` / `wildfire` `{ concerns, considerations, recommendations }` into `data/nearmap/{id}.json`. **Do not** write `views.security` / `views.wildfire` / `NM_UPSERT_INDEX`. Viewer reads them from `nearmap-elements` (and published JSON as fallback). |

## Reviewer-first elements (local until complete)

**Two editors, one page, never both at once.** `nearmap-review.html?mode=regions` (default) edits vendor regions only: pins are not drawn, not consumed, not saved — Save posts the regions diff with **no `pins` key**, and `nmSavePins_` leaves column R alone when the key is absent. `?mode=pins` is Pass 2: **Auto Generate Pins** (on a fresh/testing open, or the button) places one pin per working `regions.json` feature named after that feature's class (`Lawn Grass` stays `Lawn Grass` — not a catalog id), except cover/veg skips (asphalt, building deprecated, concrete slab, driveway, low / medium-high / very-low / woody vegetation, natural, roof, translucent roofing, water body). **Place pin** only on a visible painted region that has no pin; the pin is at that region's interior point. **Delete pin** clicks a visible painted region that has a pin (or the pin itself); the region stays. Bare-map clicks and the class picker are not used. No pin cap. Deleting a pin never changes a region. Column R stores a packed `{v:2,c,p}` object so the 50k cell cap holds ~1.5k pins. Do **not** write these class names into `pins-catalog.json`. The sheet menu opens each editor separately. Review chrome (header, map, top-left tools, Save bar) is viewport-locked; only the right rail (`.panel-scroll`) scrolls.

**Two open modes.** *Sheet mode* (`site_no=` from the Nearmap sheet, or `property=` from a published record): original and edits both come from CloudFront (`ai/original/` and `ai/edits/`), Save posts the working regions to Apps Script which PUTs them to S3, nothing is reset on reload. *Testing mode* (plain `delivery=` open, no sheet identity): every open starts from `ai/original/regions.json` with no pins; the local edits file and browser backups are ignored and local `ai/edits/regions.json` is reset to the original. `?fresh=0` resumes local edits; `?fresh=1` forces a fresh start even in sheet mode. Review boot (v1.7.17): Maps JS loads immediately without `libraries=geometry`; `original/regions.json` is fetched without a cache-buster (vendor snapshot, cacheable); a fresh testing open does not GET edits; `vert.jpg` is preloaded; the map under the opaque nadir is an empty MapType (no Google satellite tiles). Edits stay `Cache-Control`/query-busted because Save rewrites them.

First-round pins come from the reviewer, not Bedrock. Vendor polygons start as read-only overlays. The toolbar is Pan / Draw (Accept was removed 2026-09-09). The reviewer **draws** on a picked region (left-click adds area, right-click removes). Draw uses a full-map hit overlay for pick, paint, and (when no class is armed) pan — never a Maps `click` through filled polygons. Maps `pointercancel` does not commit a stroke. Hover does not paint. A click without a drag only picks (or, with no pick, arms the active class on drag) — it does not stamp. Checking a class overlay only shows that layer; it does not retarget the Draw brush. Click a painted region to arm. Click a checked layer's name to set the active-class highlight without moving the brush. The custom brush cursor stays visible after the pick, and `#brushHit` falls back to a crosshair if the ring is not yet placed. `featureById` returns `{ feature, index }` only — a second raw-Feature definition must not be added (it makes grow throw and commit stamp-only line regions). Check a class and drag to paint a new region; click a region and drag to grow it. Pick is a click on a visible painted region or its centroid — never a sheet pin, never a 10 m nearest-centroid snap, never a vertex-average. If an active class is set, overlapping hits of that class win first. Overlaps take the smallest area. A detached new region is only created when the paint is more than `JOIN_NEAR_M` (4 m) from every visible same-class region — including the pick; nearby paint grows the pick instead of a second island. Overlapping same-class scraps are **meshed** (raster-unioned into one outline) — they are never left stacked as separate fills. Paint that lands on another same-class scrap grows that host, then meshes. A detached new region re-arms the brush on that new region so the next stroke can grow it. **Clear brush** next to the history arrows drops the pick and returns to the `+` pick cursor. A size slider under Draw sets one brush radius in pixels (4–48). The cursor fill, the live stroke preview (own canvas, not a Maps polyline — Maps caps polyline width), and the paint/erase mask all use that radius; the selected pin, hint marker, and polygon are **not** singled out; instead the **active class** (last layer checked, or the class of the picked region; click a checked layer's name to switch) draws every polygon of that class with a class-colored border over a white halo. Driveway is pink (`#f72585`). Under Size, back/forward arrows (`◀ ▶`) step through an in-memory history of paint strokes (grow, erase, new region), capped at 30. **Revert changes** restores the working regions to the last Save (or the file this session opened with) and clears that history. **Revert to original** restores `ai/original/regions.json` and clears that history. Neither revert writes the checkpoint; Save after Revert to original writes original into edits. Scroll-wheel zoom stays available while drawing; the map does not pan until you click Pan. The painted area is the exact brush sweep. If that sweep **touches** the selected region, or comes within `JOIN_NEAR_M` (4 m) of it, it unions into that polygon. If it is isolated from every visible same-class region, the stroke becomes a **new** same-class region. In both cases, un-pinned same-class regions that the result **covers or overlaps** are absorbed into it (no duplicate scraps left inside a merged region) — except the picked region itself: if a "detached" stroke ends up reaching the picked region, it is treated as a grow of that region, so the pick never points at a deleted id. A stroke made with a pick whose region no longer exists drops the pick and asks for a new one. No convex hull. Leaving Draw, or hiding the picked region's layer, drops the pick; hidden layers are never force-drawn. The class count in the layer list is recounted after every paint, merge, delete, and revert. Surviving original edges keep their vertices; only the painted extension is smoothed to the same segment length as the source polygon. **Erase target rule:** a right-click erase acts on **every** visible same-class region the brush sweep touches (the picked region included); only if it touches none does it fall back to any visible region under it. A sweep over bare ground changes nothing and reports "Nothing to remove under the brush". The picked region stays armed unless it was the one removed. **Erase split rule:** an erase that leaves N ≥ 2 outer polygons on a target keeps the **largest** on that feature (same id, same properties, single `Polygon`; holes stay with their outer ring) and writes each other piece as a **new** same-class feature `dN` with `origin: split`; no pins are created for split pieces, the picked pin (if any) re-centres on the largest piece and still refuses out-of-bounds. **Erase edge rule:** contour points inside the brush sweep are new boundary and never snap back to a pre-stroke edge; on erase the mask is opened (erode/dilate by half the sliver width) within reach of the stroke so thin crescents do not become spikes. **Erase fragment rule:** each piece is measured in the local metre frame (area and outer perimeter — never absolute projected metres). Rules are absolute: a **crumb** is under `ERASE_MIN_FRAG_M2 = 3 m²`, a **sliver** has mean width `2·area/perimeter < ERASE_SLIVER_WIDTH_M = 0.8 m`. When the erase leaves several pieces, crumbs and slivers are dropped; when it leaves one piece, that piece is kept unless it is both a crumb and a sliver (or under 0.3 m²). A piece that still covers part of the feature's vendor original is never dropped — erasing an addition always leaves the scrap it was grown from. If nothing survives (or the erase mask is empty), that region is removed and its pin deleted; vendor originals are **not** restored (the erase is intentional). Every erase outcome is one paint-history snapshot, so `◀` restores it. Left-click grow and detached new-region paint do not split or drop. **Hole rule (cutouts):** holes are real geometry. Painting a closed loop leaves its inside empty — connecting the stroke does not flood-fill the courtyard. Erasing inside a solid region makes a hole. The editor draws every polygon with all its rings (`paths: [outer, …holes]`), the same as the viewer; every inside test (pick, absorb, snap, rasterise) treats a point in a hole as outside. Mask rings nest by depth (even = outer, odd = hole of the innermost enclosing outer), so an island inside a hole is its own polygon. **Gap-close rule (add-side of the erase sliver drop, not flood-fill):** after a left-click grow or new-region stroke the paint mask is closed (dilate then erode) by `GAP_CLOSE_BRUSH = 2` × the brush radius, **only within reach of this stroke's stamps** — leftover seams between almost-overlapping passes of this stroke fill; the rest of the region is untouched. A courtyard wider than ~2× that radius stays empty. A **substantial** existing hole (`HOLE_KEEP_M2 = 20 m²` or mean width ≥ `HOLE_KEEP_WIDTH_M = 3 m`) is restored unless the brush actually painted over it, so a cutout further up the driveway is not filled by a stroke elsewhere. Leftover triangles under those limits near the stroke are allowed to close. Erase cutouts are also stored as `properties.locked_holes` and punched back out at any size. Erase strokes never fill anything. Each committed group is a catalog pin at its **interior point**: the point with the greatest clearance from any edge (pole of inaccessibility, found from the area centroid plus scan-line span midpoints and a local grid refinement) — never a vertex average or a centroid that merely falls inside, both of which can sit on or against an edge of a C/L shape. Sheet column W (`NM_COL_DRAWN`) holds reviewer GeoJSON for publish. `NM_MAX_PINS` is 20.

## Regions (original vs edits) — the folder format

`regions.json` is the reviewer FeatureCollection of polygons (vendor scraps + merged/drawn/split groups). Both folders live on **S3 `property-intel-tiles`** and are read through CloudFront. **Nearmap regions never touch GitHub** (2026-09-09: client data is being kept off the public repo; Nearmap is part of that).

| Path | Writer | Rule |
|---|---|---|
| S3 `nearmap/{delivery}/ai/original/regions.json` | `normalize.py` / `seed_regions.py` → `promote.py` | Vendor snapshot. Nobody else writes here. **Revert to original always returns to this.** |
| S3 `nearmap/{delivery}/ai/edits/regions.json` | `promote.py` seeds it from original (`--reset-edits` reseeds); **Apps Script `nmSavePins_` rewrites it on reviewer Save** (sheet mode) with a SigV4 PUT (`nmS3PutObject_`, `Cache-Control: no-cache`, same AWS key that calls Bedrock) | The live working FeatureCollection (`{type, name:"nearmap-regions", source:"edits", delivery_id, saved, saved_by, counts, features}`). Save after Revert to original writes original back into it. Revert changes restores the last Save / open snapshot into it. |
| Local `ai/edits/regions.json` (serve tree) | `review_server.py` PUT (testing mode) | Working copy for `delivery=`-only sessions; never uploaded by promote. |

Sheet column W (`Drawn Features`) holds **only a summary** `{ drawn: FC, edits: { url, features, counts, saved, etag } }` — a cell is capped at 50 000 characters, the regions themselves never go in the sheet. `nearmap-elements` returns `regions_original_url` and `regions_edits_url`, both derived from the AI URL (`/ai/features.json` → `/ai/original/regions.json` and `/ai/edits/regions.json`). The published record `data/nearmap/{id}.json` carries `regions: { original, edits, edits_saved }` (URLs only).

Writers: `promote.py` (original + seed) and Apps Script (edits) are the only S3 writers under `nearmap/`; Lambda is not involved; GitHub is not involved. The Apps Script AWS key needs `s3:PutObject` on `arn:aws:s3:::property-intel-tiles/nearmap/*/ai/edits/regions.json` (and `nearmap/_probe/*` for `checkS3EditsWrite`).

Re-normalize **overwrites original** and **does not** overwrite an existing local edits file unless `--reset-edits`. Local save: `python tools/nearmap/review_server.py 8899` (PUT only `**/ai/edits/regions.json`).

**Review fetch (v1.7.17).** `ai/original/regions.json` is cacheable (no query-string bust). `ai/edits/regions.json` stays uncached (`Cache-Control` / `?_=` bust) because Save rewrites it. Review Maps JS does not load `libraries=geometry`; distances use the local haversine (`distM`). The map under the opaque nadir GroundOverlay is an empty MapType (`#1b2027`); Google satellite tiles are not requested. A fresh testing open does not GET edits.

**Review draw (v1.7.17).** Checking a class builds polygons and hint markers in `requestAnimationFrame` chunks of 80. Hint markers use `optimized: true`. Stored rings are not simplified.

## AI layers (viewer vs Bedrock)

`ai/features.json` is the **full** vendor Feature Collection: every class, every polygon, including overlapping vegetation and landscaping. The review page treats each class as a checkable overlay. Do not drop, cap, or centroid-replace viewer geometries.

Bedrock still must not receive that dump. Promote also writes `ai/hints.json` (`counts` + **all** feature centroids, no geometry). Pass 1 fetches hints, converts lon/lat to JPEG percent with the sheet nadir bounds, and may pin **only** at those centroids. Catalog ids with no Nearmap class mapping (Front door, Vehicle Entrance, Fence, Sidewalk, Garage, yards, …) are omitted. Nearmap class names never enter `pins-catalog.json`. Pins remain catalog ids. Condition attributes stay on features; they are not pins.

When the prompt and the validator disagree, the validator wins (`nmValidatePass1Pins_` copies the AI feature’s x,y or drops the pin).

## Isolated product surface

- Sheet: `Nearmap` (`NM_COL_*` in `config.gs`). Not a mode of Satellite or Satellite Sandbox. Menu **Property Intel → Nearmap Pipeline → Set Up Nearmap Sheet**.
- Apps Script: `apps scripts/nearmap.gs`.
- Review: `nearmap-review.html` (not `viewer.html`). Trial URL: `nearmap-review.html?property={hash}` or `?delivery={delivery_id}`.
- **Trial viewer** is `vyanet-viewer.html`. Private **Nearmap** opens `nearmap-viewer.html?full=1` on the whole page; **Standard viewer** (top right) returns to the hub. Join is `NEARMAP_DELIVERY_HUB` in `js/vyanet-viewer/property.js` (Macalpine → Jones `6de88883…`, Columbia → `744a3639…`). Do **not** hash `site_no` for that join. Still do **not** add `nearmap` to production `VIEW_ORDER` or `syncNow()`.
- **Do not** add Nearmap to `syncNow()`, top-level Sync This Row, or Satellite Pipeline.

## Nearmap viewer (`nearmap-viewer.html`, 2026-09-10)

Trial product surface is **`vyanet-viewer.html`**: same gate, HOME, PRIVATE (3D · 2D · Nearmap · Live · Plugins), COMMUNITY, and GIS facts as every other property. Private **Nearmap** navigates to `nearmap-viewer.html?full=1` (full page, not an iframe). **Standard viewer** (top right) returns to the hub Private 3D/2D. Standalone `?delivery=` for a known trial delivery **redirects** into the hub (`stage=home`) unless `full=1`. Property Facts / GIS stay on hub Private 2D and 3D (`data/gis/{hubId}.json`) — the Nearmap page does not load them. Lot lines on Nearmap 2D are still `data/parcels/` with the same Deschutes/Lane 0.07° grid as `viewer.html`.

Fed by the Nearmap row and CloudFront: `?site_no=` → `nearmap-elements` then `{delivery}/manifest.json`; `?delivery=` alone works; `&tiles=` overrides the base for local serve trees. Tabs inside the substrate: **2D** (Google Maps satellite + nadir GroundOverlay + region polygons + numbered region-class pins + Pass 3 FR/WF concern pins + lot line), **3D** (Three.js r128 GLB; region **fills** drape the mesh via a heightmap grid so a Building tints the whole footprint on the roof, not a floating cap or a buried ring; outlines drape the surface; pins as sprites; tab disabled when `urls.mesh` is absent), **Obliques** (N/E/S/W + nadir, lightbox). Right rail (v1.1.12) is four **stacked** tabs: **AI layers** (lot line, clip, observed facts, class checkboxes; vegetation layers start off, Lawn Grass on), **First Responder** (Pass 3 FR considerations / recommendations / FR concern pins), **Wildfire** (Pass 3 WF half), **Pins** (region-class names). Map markers follow the rail tab. `?rail=fr|wf|pins` deep-links a pane. Regions come from `ai/edits/regions.json` (fallback original). `?delivery=` also calls `nearmap-elements`. Sheet **Open Nearmap Viewer (This Row)** still opens `nearmap-viewer.html?delivery=…`, which redirects to the hub.

**Mesh (supersedes the 2026-09-07 "inventory only" clause).** `tools/nearmap/mesh_to_glb.py` converts the MapBrowser `MeshTiledOBJ` (OBJ + MTL + JPEG textures + `.ofs` origin + `Tiles.prj`) into `{serve}/mesh/model.glb` (textures ≤ 4096 px, Draco via `gltf-pipeline`) and `mesh/mesh.json`, and stamps `urls.mesh` / `urls.mesh_meta` / `mesh{}` into the manifest. Frame: X east, Y north, Z up, metres; origin at the nadir-bounds centre projected through the delivery's own `Tiles.prj` (NAD83 Oregon North, intl ft); `mesh.local` holds the nadir corners in that frame (same bilinear convention as `model-viewer`'s `nadir.local`). Z0 = 2nd percentile of z. `promote.py` uploads `mesh/*` with the serve dir (`model/gltf-binary`). Still true: do not point `viewer360` / the headless render camera at Nearmap meshes; plane/drone GLBs stay the render source.

**Licence note.** The GLB is a *derived* vendor binary served from the public CloudFront tiles bucket. That is acceptable for the trial only if the Nearmap licence allows derived-mesh distribution; confirm before any customer-facing use (open question in CLAUDE.md: analyze/cache/derive/resell rights).

## Out of scope until promotion

- Editing satellite Pass 1/2, `SAT_PASS1_EMIT_IDS`, or the pin catalog
- Nesting Nearmap in a hub iframe (`embed=1` is unused). Trial UX is leave/return (`?full=1` + **Standard viewer**). In-hub Nearmap that keeps HOME / PRIVATE / COMMUNITY is later, only when Jonah asks.
- Adding `nearmap` to production `VIEW_ORDER` / `syncNow()` / index `views.nearmap` (join stays the two-row `NEARMAP_DELIVERY_HUB` table)
- Render Lambda / headless camera on Nearmap meshes (mesh → GLB for the Nearmap viewer is in scope as of 2026-09-09)
- Replacing `vert.jpg` or changing pin percents off the full-AOI JPEG. Display clip (mask or `vert-lot.jpg`) and Pass 1 `vert-lot-p1.jpg` are in scope; stored x,y stay percent of `vert.jpg`.
- Sampling DSM/DTM into observed facts (canonical GeoTIFFs stay in ingest; 2D regions+lot distances ship first)
- Auto-promoting vendor polygons into **catalog** pins (`pins-catalog.json` stays satellite vocabulary)
- License / resell of vendor rasters — keep trial binaries in **ingest**; tiles hold derived stills, the derived mesh GLB, and compact JSON only. Confirm analyze/cache/derive/resell before customer-facing use of the derived GLB on public CloudFront.

## Taxlot clip + observed facts (2026-09-10)

**Editor** (`nearmap-review.html`) keeps the vendor AOI.

**Product** (`nearmap-viewer.html` **Clip to taxlot**, default on): remove everything outside the property line on 2D — opaque page-color hole-punch at the taxlot (Vert + satellite + region paint), off-lot pins hidden. The camera **stays on the property** (opening zoom); do not `fitBounds` / restrict to the taxlot bounding box (Jones’s triangle put the house off to one side and the overlay flood made the map unusable). Uncheck Clip to see the neighborhood; observed facts stay on the rail (they are always regions ∩ taxlot). (`vert-lot.jpg` when `lot_clip.py` has been promoted still replaces the Vert overlay; pin x,y stay percent of full `vert.jpg`.) Lot line and Clip to taxlot checkboxes are **2D-only** (hidden on the 3D tab, v1.1.13). 3D mesh is still the capture until a mesh clip exists.

**Lot cover on Private 2D** (`viewer.html` **Cover**): building / driveway / woody veg / pool from `ai/edits/regions.json` (original fallback), clipped to the same taxlot. GIS Property Facts table is unchanged.

**Observed facts** are Nearmap-derived, not GIS. Computed in the viewer from edited regions ∩ taxlot (`js/vyanet-viewer/nearmap-lot.js`): lot/building/drive/veg/pool/roof/solar/lawn m², veg % of lot, min woody-veg→building distance, counts inside 5 ft / 30 ft, tree-overhang flag. Optional S3 snapshot: `nearmap/{delivery}/observed.json` from `tools/nearmap/lot_clip.py` (promote uploads it). Viewer recomputes from edits so a reviewer Save wins. Do not write these into `data/gis/{id}.json`.

**Pass 1** (Nearmap tab only, still isolated from `satellite.gs`): filter `hints.json` centroids to the taxlot (parcel tile from Pages); prefer GET `vert-lot-p1.jpg` then `vert-p1.jpg` (never CloudFront HEAD). Pin x,y remain percent of full `vert.jpg` via sheet bounds. Validator still wins.

**lot_clip.py** (operator, no GitHub, no upload): taxlot from `data/parcels/` or Pages; writes `vert-lot.jpg`, `vert-lot-p1.jpg`, `lot.json`, `observed.json`, stamps manifest `urls.vert_lot` / `bounds_lot`. Then `promote.py`.

Parcel lookup uses hub lat/lng when the index exists (Jones `6de88883…`), else AOI centre. Same Deschutes/Lane 0.07° grid and unaccounted-ROW skip as `nadir-geo.js`.

## Promotion checklist (only when Jonah says the workflow is established)

1. Nearmap `vert.jpg` + `bounds` may replace `prepareSatNadir_` Static Maps.
2. Reduced AI may inject into `runSatElementPinsCall_` the same way KB context does.
3. `nearmap` may join `VIEW_ORDER`.
4. Nearmap Pass 2 pins are region-class labels on the Nearmap tab. Pass 3 concerns are catalog `role=concern` ids. Do **not** add region class names to `pins-catalog.json` or flatten `role=`.
5. Compass obliques → frontage-relative alpha/bravo is a separate decision.
6. Merge `views.nearmap` onto the **existing** property hub (Jones = `6de88883bfd4a8349a901c54611ed9d7`). Do not call `upsertIndexEntry_` with `hashId(site_no)` as the hub id.

## Changelog

- **2026-09-11** — Review **v1.7.17**: original is cacheable; edits stay uncached; Maps geometry library is not loaded; empty MapType under the opaque nadir; layer checkboxes draw in rAF chunks of 80.
- **2026-09-10** — Right rail is four stacked tabs (v1.1.12): AI layers, First Responder, Wildfire, Pins. Map markers follow the tab. Pass 3 still publishes `fr` / `wildfire` on `data/nearmap/{id}.json` (not `views.security`).
- **2026-09-10** — Pass 3 FR + wildfire concerns: appended sheet columns X–AC, Bedrock halves in `nearmap.gs`, catalog concern ids via `validateConcernPins_`, published `fr` / `wildfire` on `data/nearmap/{id}.json` (not `views.security`). Viewer **v1.1.9** showed concern pins + prose at the top of the rail (superseded by v1.1.11 tabs).
- **2026-09-07** — First clause. Isolated mothership tab `Nearmap` / S3 prefixes / `data/nearmap/` / review page. Canonical tree matches Ahartsi.zip API + MapBrowser shapes. Trial sync skips `data/index/` so Jones is not forked. Satellite / Plane / `syncNow` unchanged.
