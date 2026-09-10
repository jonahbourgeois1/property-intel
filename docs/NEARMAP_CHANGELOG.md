# Nearmap changelog (v1)

Newest on top. Format: What / Why / Files / How it was checked / Status.

## 2026-09-10 — Observed facts stay when Clip is off

**What.** The Observed rail (lot / building / drive / veg / 5 ft / 30 ft) stays on when **Clip to taxlot** is unchecked. Facts are always regions ∩ taxlot; clip only changes what the map shows. Status keeps the taxlot id either way.

**Why.** Jonah: lot info should stay present when clip is unchecked.

**Files.** `nearmap-viewer.html` (v1.1.5), `docs/NEARMAP_CONTRACT.md`.

**How it was checked.** Browser localhost:8899 Macalpine `?full=1`: uncheck Clip — neighborhood returns, Observed rail and taxlot `181102C000600` remain.

**Status.** Local; not committed.

## 2026-09-10 — Clip to taxlot removes outside the property line (2D)

**What.** Clip is no longer a 72% dim over the neighborhood. On 2D it punches an opaque `#111318` hole at the taxlot, locks the camera to the lot, hides off-lot pins, and covers Vert + satellite + region paint outside the line. Uncheck restores the capture AOI. Pin % still refer to full `vert.jpg`. 3D mesh is unchanged.

**Why.** Jonah: clip should remove everything outside the property line, not darken the screen.

**Files.** `js/vyanet-viewer/nearmap-lot.js`, `test-nearmap-lot.mjs`, `nearmap-viewer.html` (v1.1.4), `docs/NEARMAP_CONTRACT.md`, `docs/NEARMAP_RUNBOOK.md`, `docs/VYANET_VIEWER_NEXT_AGENT.md`.

**How it was checked.** `node --check` on `nearmap-lot.js`. `node test-nearmap-lot.mjs` (mask winding + padBounds). Extracted viewer module `node --check`; `$('…')` ids present. Browser localhost:8899 Macalpine `?full=1` v1.1.4: clip on shows only the taxlot (neighbors gone, Vert sharp inside the red line); clip off restores the capture AOI and 1538 regions.

**Status.** Local; not committed.

## 2026-09-10 — lot-clip Vert/regions, observed facts, Private 2D cover, lot-aware Pass 1

**What.** Product Nearmap clips to the taxlot (mask or `vert-lot.jpg`); regions that miss the lot are not drawn. Observed facts (areas + veg→building 5 ft / 30 ft) sit on the Nearmap rail, not in GIS. Private 2D gets a **Cover** overlay (building / drive / veg / pool) from the same clipped regions. Nearmap Pass 1 filters AI hints to the lot and prefers `vert-lot-p1.jpg`; pin % stay on full `vert.jpg`. Editor unchanged (full AOI). `NM_UPSERT_INDEX` still false.

**Why.** Jonah: start building lot-clip, observed facts, Private 2D lot-cover, and Vert as Nearmap-only Pass 1.

**Files.** `js/vyanet-viewer/nearmap-lot.js`, `test-nearmap-lot.mjs`, `tools/nearmap/lot_clip.py`, `tools/nearmap/promote.py`, `nearmap-viewer.html` (v1.1.3), `viewer.html` (v2.10.8), `vyanet-viewer.html` + `js/vyanet-viewer/property.js` (hub 1.8.17), `apps scripts/nearmap.gs`, `docs/NEARMAP_CONTRACT.md`, `docs/NEARMAP_RUNBOOK.md`, `docs/INDEX_AND_CAMERAS_CONTRACT.md`.

**How it was checked.** `node --check` on `nearmap-lot.js`, extracted nearmap-viewer module, `property.js`. `node test-nearmap-lot.mjs`. `python -m py_compile tools/nearmap/lot_clip.py`. Ids / onclick / `$('lotClip')` on the HTML files. Browser localhost:8899: Macalpine `?full=1` hub 1.1.3, Clip on, taxlot `181102C000600`, 1534/1538 regions, observed facts (building 3,695 m², veg 59.3% of lot, 21/46 inside 5/30 ft). Jones hub 1.8.17 Private 2D Cover on with the same numbers; Property Facts button still present.

**Status.** Local; not committed. Paste `nearmap.gs` (save **and** new deployment) before Pass 1 uses the lot filter. `lot_clip.py` + promote for `vert-lot.jpg` is optional — mask clip works without it.

## 2026-09-10 — docs catch-up after hub 1.8.16

**What.** Hub 1.8.15 changelog status is shipped (superseded by 1.8.16). Contract / runbook / index clause match leave/return (`?full=1`, `embed=1` unused, GIS off Nearmap). `docs/VYANET_VIEWER_NEXT_AGENT.md` rewritten off hub 1.8.0 / HOME·PRIVATE·PUBLIC·LIVE.

**Why.** Next-agent file and 1.8.15 status were stale after `c925508`.

**Files.** `docs/NEARMAP_CHANGELOG.md`, `docs/NEARMAP_CONTRACT.md`, `docs/NEARMAP_RUNBOOK.md`, `docs/INDEX_AND_CAMERAS_CONTRACT.md`, `docs/VYANET_VIEWER_NEXT_AGENT.md`.

**How it was checked.** Read against live `HUB_BUILD` 1.8.16 / `nearmap-viewer` v1.1.2. No viewer code change.

**Status.** Local; not committed.

## 2026-09-09 — nearmap-viewer v1.1.2: drop Property Facts from the Nearmap page

**What.** The Nearmap full-page rail is AI layers + lot line + catalog pins only. Property Facts (GIS known facts) stay on hub Private 2D and 3D.

**Why.** Jonah: those facts already live on the standard 2D/3D pages.

**Files.** `nearmap-viewer.html` (v1.1.2), `docs/NEARMAP_CONTRACT.md`, `docs/NEARMAP_RUNBOOK.md`.

**How it was checked.** `node --check`. Browser: Nearmap `?full=1` has no Property Facts heading / GIS table; AI layers and lot line remain.

**Status.** Shipped (this commit).

## 2026-09-09 — hub 1.8.16 + nearmap-viewer v1.1.1: Nearmap is a full-page leave/return

**What.** Private **Nearmap** leaves the hub and opens `nearmap-viewer.html?full=1` on the entire page (2D / 3D / Obliques + GIS + AI layers). Top-right **Standard viewer** returns to `vyanet-viewer.html?stage=private`. Delivery-only URLs still land on hub home first. No Nearmap iframe.

**Why.** Jonah: for now the Nearmap button should take the whole page, with a way back to the standard viewer.

**Files.** `nearmap-viewer.html` (v1.1.1), `vyanet-viewer.html` (hub 1.8.16), `js/vyanet-viewer/property.js`, `docs/NEARMAP_CONTRACT.md`, `docs/INDEX_AND_CAMERAS_CONTRACT.md`.

**How it was checked.** `node --check`. Browser: hub Nearmap → full page + Standard viewer back to Private 3D.

**Status.** Shipped (this commit).

## 2026-09-09 — hub 1.8.15 + nearmap-viewer v1.1.0: same Vyanet shell, draped 3D fills

**What.** Nearmap is no longer a separate chrome. `nearmap-viewer.html?delivery=` on a known trial property redirects into `vyanet-viewer.html` (gate, HOME, PRIVATE, COMMUNITY). Private nested bar is **3D · 2D · Nearmap · Live · Plugins**. Nearmap iframe is `embed=1` (2D / 3D / Obliques + AI layers). Property Facts load `data/gis/{id}.json`; lot line uses `data/parcels/` like Private 2D. 3D fills drape the mesh (no floating max-height cap). Join table: Macalpine → Jones `6de88883…`, Columbia → `744a3639…`.

**Why.** Jonah: still on v1.0.3 on the live URL; overlays should sit on the mesh; the Nearmap viewer should look exactly like the Vyanet viewer (home page, GIS) plus Nearmap layers.

**Files.** `nearmap-viewer.html` (v1.1.0), `vyanet-viewer.html` (hub 1.8.15), `js/vyanet-viewer/property.js`, `docs/NEARMAP_CONTRACT.md`, `docs/INDEX_AND_CAMERAS_CONTRACT.md`, `docs/NEARMAP_RUNBOOK.md`.

**How it was checked.** `node --check` on both extracted scripts; ids / onclick / dup funcs. Browser: Macalpine delivery opens hub home (hub 1.8.15), Private → Nearmap, GIS facts + lot line, 3D drape.

**Status.** Shipped on `main` (`5e36083`). Superseded by hub 1.8.16 leave/return.

## 2026-09-09 — nearmap-viewer v1.0.3: 3D fills cover the whole footprint

**What.** 3D region fills are a flat cap at the **max mesh height** inside each polygon (sampled on the ring and a coarse interior grid), 0.85 m above that, opacity 0.48. A second outline is drawn at that cap height; the draped outline remains. Building (and every other class) now tints the whole footprint the way 2D does, instead of a ring around the walls.

**Why.** Jonah: 3D layers were not present enough; Building should highlight the entire area like 2D. The old fill used only ring-vertex heights, so it sat at ground under the walls and you only saw the orange edge.

**Files.** `nearmap-viewer.html` (v1.0.3).

**How it was checked.** `node --check`, ids, onclick, dup funcs. Not verified in the live 3D tab (mesh load).

**Status.** Committed to `main`.

## 2026-09-09 — nearmap-review v1.6.11: Revert changes vs Revert to original

**What.** Two region-editor buttons: **Revert changes** restores the working copy to the last Save (or the regions this session opened with); **Revert to original** restores vendor `ai/original/regions.json`. Checkpoint is captured on load and on Save (sheet Save, or local Save when there is no `site_no`). Paint undo/redo arrows are unchanged.

**Why.** Jonah: a button to revert to original and a button to revert current changes.

**Files.** `nearmap-review.html` (v1.6.11), `docs/NEARMAP_CONTRACT.md`.

**How it was checked.** `node --check`, ids (`revertChanges`, `revertRegions`), onclick, dup funcs. Not verified in the browser: clicking both buttons on Macalpine.

**Status.** Committed to `main`.

## 2026-09-09 — nearmap-review v1.6.10: more close under the stroke; keep real cutouts

**What.** `GAP_CLOSE_BRUSH` 1 → 2 (stroke-local only, same as v1.6.7 strength but not whole-region). `restoreUnpaintedHoles` now restores only substantial cutouts (`HOLE_KEEP_M2 = 20 m²` or mean width ≥ 3 m). Leftover triangles near the stroke may close; a 66 m² loop interior and the driveway hole Jonah left open stay unless painted over.

**Why.** Jonah: v1.6.9 "is not doing enough". Restoring every existing hole treated leftover seams from the previous pass as cutouts, so the north-drive stroke no longer filled the gaps he was drawing over. Distant-hole protection is kept for real cutouts.

**Files.** `nearmap-review.html` (v1.6.10), `docs/NEARMAP_CONTRACT.md`.

**How it was checked.** `node --check`, ids, onclick, dup funcs. Headless hole suite: Size-14 loop keeps a ~66 m² hole; grow on the ring keeps it; Size-10 erase cutout (locked, 3 m²) survives a grow elsewhere; zigzag scribble seams close (0 holes). 0 page errors.

**Status.** Committed to `main`.

## 2026-09-09 — nearmap-review v1.6.9: close only under this stroke; leave other holes

**What.** Gap-close no longer runs on the whole region. Dilate/erode is copied onto the mask only within `brushR + gapM` of this stroke's stamps. Holes that already existed (`existingHolesFrom`) are restored unless a stamp actually covers them. Locked erase cutouts still punched.

**Why.** Jonah: a modest draw over the north driveway filled the courtyard he had not covered and also filled the hole further down the drive. Cause: close ran on every cell of the union, so any hole smaller than the kernel filled, including ones far from the brush.

**Files.** `nearmap-review.html` (v1.6.9), `docs/NEARMAP_CONTRACT.md`.

**How it was checked.** `node --check`, ids, onclick, dup funcs. Headless: Size-14 loop keeps an interior hole; grow on the ring does not fill it; Size-10 erase cutout survives a grow elsewhere on the same region; zigzag scribble seams still close (0 holes). 0 page errors.

**Status.** Committed to `main`.

## 2026-09-09 — nearmap-review v1.6.8: gap-close ×0.5

**What.** `GAP_CLOSE_BRUSH` 2 → 1. Close radius is now 1× brush radius instead of 2×.

**Why.** Jonah: "much better. cut the auto fill by 0.5".

**Files.** `nearmap-review.html` (v1.6.8), `docs/NEARMAP_CONTRACT.md`.

**How it was checked.** `node --check`, ids, onclick, dup funcs. Headless hole suite re-run: loop interior still empty; 0.6 m scribble seams still close at Size-14 (gap < 1× brush); erased cutout still survives a later grow. 0 page errors.

**Status.** Committed to `main`.

## 2026-09-09 — nearmap-review v1.6.7: close leftover seams; do not flood-fill on connect

**What.** Removed GeoJSON hole-area fill (`HOLE_REL_FRAC` / `fillSmallHoles`). That was still flood-filling enclosed interiors when a stroke connected. Add strokes now **close the paint mask** (dilate then erode by `2 ×` brush radius): leftover seams and gaps between almost-overlapping islands fill; a courtyard wider than ~2× that radius stays empty. Erase cutouts are punched back out via `properties.locked_holes`.

**Why.** Jonah: autofill is still on for connecting/creating new areas, and filling in gaps has no autofill. Diagnosis: the leftover-hole rule only looked at holes *inside* one polygon, so the triangles in a scribble (gaps *between* brush islands) never filled; and filling holes below 8% of the outer still filled enclosed space when a stroke connected.

**Files.** `nearmap-review.html` (v1.6.7), `docs/NEARMAP_CONTRACT.md`.

**How it was checked.** `node --check`, ids, onclick, dup funcs. Headless: Size-14 loop → 201 m² outer with a 47 m² hole (close nibbles the ring but does not flood-fill); grow on the ring keeps the hole; Size-10 erase cutout survives a later grow; zigzag scribble with 0.6 m gaps → 0 holes. 0 page errors.

**Status.** Committed to `main`.

## 2026-09-09 — nearmap-review v1.6.6: no loop autofill; leftover crumbs fill like erase

**What.** Removed the 240 m² / 32 m "fill anything enclosed" thresholds. A grow stroke now fills a hole only when it is a leftover the same way erase drops a leftover piece: crumb (`ERASE_MIN_FRAG_M2`), sliver (`ERASE_SLIVER_WIDTH_M`), or under `HOLE_REL_FRAC = 0.08` of its outer ring. Erase cutouts are stored as `properties.locked_holes` and survive later grow strokes; scribble leftovers are not locked, so a later grow can still close them. Painting a closed loop does not fill the inside.

**Why.** Jonah: autofill (closing a loop fills the interior) is not wanted. Small leftover gaps from adding paint should fill the same way leftover region pieces delete when enough is erased. The 4×/10× raises were the wrong knob — they turned leftover-gap fill back into loop autofill, and prior-hole protection also kept scribble triangles around after the next stroke.

**Files.** `nearmap-review.html` (v1.6.6), `docs/NEARMAP_CONTRACT.md`.

**How it was checked.** `node --check`, ids, onclick, dup funcs. Headless hole suite: Size-14 loop → 201 m² outer with 68 m² hole (34% of outer, kept); grow on the ring keeps the hole; Size-10 erase inside a solid → locked cutout survives a later grow; three Size-14 passes with 0.6 m gaps → 0 holes; a second grow on that scribbled region still has 0 leftover holes. 0 page errors.

**Status.** Committed to `main`.

## 2026-09-09 — nearmap-review v1.6.5: hole-fill range ×10

**What.** `HOLE_FILL_M2` 24 → 240 m², `HOLE_SLIVER_WIDTH_M` 3.2 → 32 m. Grow strokes only; pre-existing holes still never filled.

**Why.** Jonah: "still not nearly enough. 10x it".

**Files.** `nearmap-review.html` (v1.6.5), `docs/NEARMAP_CONTRACT.md`.

**How it was checked.** `node --check`, ids, onclick, dup funcs. Headless hole suite: a Size-14 loop's 68 m² inside now fills on the closing stroke (expected at this threshold; the suite's loop-hole assertion was updated to assert the fill); a 3 m² erased cutout still survives later grow strokes (pre-existing protection); 0.6 m scribble gaps fill. 0 page errors.

**Status.** Committed to `main`.

## 2026-09-09 — nearmap-review v1.6.4: hole-fill range ×4

**What.** `HOLE_FILL_M2` 6 → 24 m², `HOLE_SLIVER_WIDTH_M` 0.8 → 3.2 m. Same rule otherwise: grow strokes only, pre-existing holes never filled.

**Why.** Jonah: "quadruple the range for autofill" — the v1.6.3 thresholds left larger scribble gaps standing.

**Files.** `nearmap-review.html` (v1.6.4), `docs/NEARMAP_CONTRACT.md`.

**How it was checked.** `node --check`, ids, onclick, dup funcs. Headless hole suite re-run: 0.6 m scribble gaps filled; painted-loop hole (68 m², above the new line) and a pre-existing 3 m² erased cutout (below it, protected as pre-existing) both survive later grow strokes. Note the protection now matters more: a fresh loop with an inside under 24 m² (about a 5.5 m diameter) fills on the stroke that closes it — erase it afterwards if the cutout was intended.

**Status.** Committed to `main`.

## 2026-09-09 — nearmap-review v1.6.3: scribble gaps auto-fill, deliberate holes stay

**What.** `fillSmallHoles(geom, before, fr)` runs on the mask result of every grow / new-region stroke (never on erase). A hole is filled when it is a crumb (`HOLE_FILL_M2 = 6 m²`) or a sliver (mean width `< HOLE_SLIVER_WIDTH_M = 0.8 m`), unless it shares ground with a hole that already existed on one of the input features (`ringsShareGround`) — those are deliberate and survive at any size.

**Why.** Jonah, after v1.6.2: scribbling a large blob left dozens of tiny triangles and seams as holes; he still wants those to fill "similar to how we auto-delete when enough is removed at once", while keeping real cutouts.

**Files.** `nearmap-review.html` (v1.6.3), `docs/NEARMAP_CONTRACT.md` (hole-fill rule).

**How it was checked.** `node --check`, ids, onclick, dup funcs. Headless (scratch Columbia, Driveway, z20): three Size-14 passes spaced 3.6 m (0.6 m gaps) closed at the ends → `Polygon` 183 m², 0 holes; in the same session the painted loop's 68 m² hole and an erased 3 m² cutout (under the 6 m² crumb line — protected only by the pre-existing rule) both survived later grow strokes. 0 page errors. Not verified: the exact gap sizes in Jonah's screenshot (estimated 1–6 m² from the driveway width).

**Status.** Committed to `main`.

## 2026-09-09 — nearmap-review v1.6.2: holes are real (no auto-fill)

**What.** Cutouts persist. New `featurePolys` / `featureAllRings` helpers; `pointInFeature` returns false inside a hole; the editor draws each polygon with all rings (`paths: [outer, …holes]`); snap edges and the source segment length include hole rings; `geometryFromMask` classifies rings by nesting depth (even = outer, odd = hole of the innermost outer) instead of "first enclosing outer only".

**Why.** Jonah: a loop's inside auto-filled and erasing inside a region always refilled. Reproduced: the mask *did* produce the hole (201 m² outer, 68 m² hole) but the editor drew outer rings only, so it looked filled, and because `pointInFeature` ignored holes the next stroke re-rasterised the region as solid and refilled the cutout. The viewer rendered holes correctly — that was the editor/viewer disagreement.

**Files.** `nearmap-review.html` (v1.6.2), `docs/NEARMAP_CONTRACT.md` (hole rule).

**How it was checked.** `node --check`, ids, onclick, dup funcs. Headless on the scratch Columbia copy, Driveway, z20: loop paint → `Polygon` 201 m² with one 68 m² hole and the editor's Maps polygon has 2 paths; grow stroke on the ring → 220 m², hole still 68 m²; Size-48 solid blob 303 m² → Size-10 right-click inside → 303 m² with a 3 m² hole; another grow → 331 m², hole intact. 0 page errors. Not verified: the live Columbia file (r47 with 4 holes) in a browser by hand — those holes will now show as cutouts in the editor exactly as the viewer shows them.

**Status.** Committed to `main`.

## 2026-09-09 — nearmap-viewer v1.0.2: follows editor saves

**What.** `reloadRegions()` re-reads `ai/edits/regions.json` on tab focus / visibility and on a new **Reload** button; when `saved` or the feature count changed it redraws 2D polygons, 3D draped groups and the layer panel. Status shows the file's save time ("edits saved Sep 9, 3:39 PM").

**Why.** Jonah saw the viewer disagree with the editor. Diagnosis: not a cache issue — CloudFront serves the file with `no-cache` (policy min TTL 1 s; live fetch was a `RefreshHit` with S3's ETag) and the S3 object matched the editor exactly (r47, 1092 m², 4 holes, saved 20:39:24 UTC). The viewer tab had loaded before that Save and never re-fetched.

**Files.** `nearmap-viewer.html` (v1.0.2)

**How it was checked.** `node --check`, ids, onclick, dup funcs. Headless: scratch delivery loads 148 regions; edits file rewritten to 135 with `saved` set; Reload → status "135 regions (edits saved Sep 9, 4:00 PM) · reloaded (manual)", Driveway 16 → 3 in the panel. Live viewer fetch of Macalpine edits compared to `s3.head_object`: same ETag.

**Status.** Committed to `main`.

## 2026-09-09 — nearmap-viewer v1.0.1: 3D controls identical to model-viewer

**What.** Camera `PerspectiveCamera(60, …, 0.1, 100000)`, Z-up set before `OrbitControls`; `enableDamping` 0.08, `screenSpacePanning` true, `minDistance` 10, `maxDistance` 5000, mouse **left = pan, middle = rotate, right = dolly**, `zoomSpeed` 1, polar locked 0…π/2 (never underneath). Opening view = model-viewer's: `camDist = 1.4 × max(span x, y)`, camera at `(cx, cy − 0.8·camDist, cz + 0.8·camDist)` looking at the centre. Bottom-left **↑ Reset View** flies back (700 ms ease); the pin list flies to a pin (45 m south, 45 m up).

**Why.** Jonah: camera controls must work exactly like the other viewers.

**Files.** `nearmap-viewer.html` (v1.0.1)

**How it was checked.** `node --check`, ids, onclick, dup funcs. Headless Chromium on Macalpine: mesh loads, Reset View visible, pin fly-to, Reset fly-back, right-drag and left-drag on the canvas — 0 page errors. Values compared line by line with `model-viewer.html` L1063–1088 and L1124–1150.

**Status.** Committed to `main`.

## 2026-09-09 — nearmap-viewer.html v1.0.0 + mesh_to_glb.py

**What.**
- `nearmap-viewer.html` (new, v1.0.0): Vyanet-viewer-style bar with **2D / 3D / Obliques** tabs and a right-hand AI-layer panel. Data only from the Nearmap row (`?site_no=` → `nearmap-elements`) and CloudFront (`manifest.json`, `vert.jpg`, obliques, `ai/edits/regions.json` → original fallback, `mesh/model.glb`, `mesh/mesh.json`); `?delivery=` alone works without pins; `&tiles=` overrides the base for local serve trees. No `data/index` / `data/nearmap` reads. 2D: Google Maps satellite + nadir GroundOverlay + one polygon per ring per class + numbered pin markers with InfoWindow. 3D: Three.js r128 (same CDN/import map as `model-viewer`), GLTFLoader + DRACOLoader, Z-up OrbitControls; a 0.5 m vertex heightmap (max z per cell) built once from the loaded mesh drapes every region outline (densified to 1 m) and translucent fill, and places pin sprites with hover labels; `focusPin3d` from the pin list. Layer toggles / All / None / Catalog pins apply to both views; vegetation classes start off, Lawn Grass on. 3D tab disabled when `urls.mesh` is absent.
- `tools/nearmap/mesh_to_glb.py` (new): MapBrowser `MeshTiledOBJ` → GLB in a local metre frame (X east, Y north, Z up; origin = nadir-bounds centre projected through the delivery's `Tiles.prj`, `.ofs` applied, Z0 = 2nd percentile), textures re-encoded ≤ 4096 px, Draco via `npx gltf-pipeline`, `mesh/mesh.json` with `local` corners (nw/ne/sw/se) + bbox + stats, manifest `urls.mesh` / `urls.mesh_meta` / `mesh{}`.
- `tools/nearmap/promote.py`: `.glb` → `model/gltf-binary`.
- `apps scripts/nearmap.gs`: `NEARMAP_VIEWER_URL`, `openNearmapViewerForActiveRow`. `apps scripts/menu.gs`: "Open Nearmap Viewer (This Row)".
- Contract: mesh "inventory only / do not convert" clause superseded for the viewer; licence note on serving a derived vendor mesh from public CloudFront.

**Why.** Jonah: a Nearmap viewer for GitHub Pages similar to the Vyanet viewer, using only Nearmap data, both properties working (Macalpine has the MapBrowser 3D export, Columbia does not), with AI layers toggleable in 2D and 3D.

**Files.** `nearmap-viewer.html`, `tools/nearmap/mesh_to_glb.py`, `tools/nearmap/promote.py`, `apps scripts/nearmap.gs`, `apps scripts/menu.gs`, `docs/NEARMAP_CONTRACT.md`, `docs/NEARMAP_RUNBOOK.md`

**How it was checked.** Mesh: Macalpine OBJ 612,361 vertices / 937,956 triangles, 3 materials, `NAD83 / Oregon North (ft)`, origin E 7970906.881 N 137873.380 ft → `model.glb` 9.8 MB Draco (32.1 MB raw), corners show the ~0.6° grid-north rotation as expected. Viewer: `node --check`, ids, onclick, dup funcs clean. Headless Chromium (SwiftShader) with the sheet stubbed, local serve tree: Macalpine → 1555 regions (edits), 20 layers (14 on by default), 2 pins listed, 5 oblique cards, 3D tab enabled, mesh loaded and rendered (1200×836 canvas) with draped regions and pins, layer toggles / None / All in 3D; Columbia → 142 regions, 17 layers, 3D tab disabled, 2D + obliques fine. 0 page errors, 0 console errors. **Not verified:** the live CloudFront path (`promote.py` for Macalpine mesh not run — S3 write), the Apps Script menu item (paste + new deployment), alignment tolerance of the bilinear local frame vs the mesh at the AOI edges (looked right at the house), performance on low-end GPUs.

**Status.** Committed to `main`. Run `promote.py --delivery 18775-macalpine-loop-bend-or-97702`, paste `nearmap.gs` + `menu.gs`, new deployment.

## 2026-09-09 — v1.6.1: pin at the deepest interior point (pole of inaccessibility)

**What.** `interiorPoint` no longer returns the area centroid just because it is inside. All candidates — the area centroid plus interior span midpoints on 19 horizontal and 19 vertical scan lines — are scored by clearance (distance to the nearest edge); the winner is refined with four rounds of a shrinking 5×5 grid walk. Result: the point farthest from any edge, i.e. the middle of the thickest part of the region.

**Why.** Jonah: the centroid was still against the edge of the merged C-shaped driveway. The area centroid of a C with a thick upper arm lands inside that arm a few centimetres from the inner edge, and v1.4.1 accepted any inside point.

**Files.** `nearmap-review.html` (v1.6.1)

**How it was checked.** `node --check`; missing ids / onclick / dup funcs. Node unit test on the extracted functions: C with thick upper arm (area centroid inside, hugging the inner edge) → (6.0, 25.0), clearance 5.00 m of a 10 m arm; symmetric C → clearance 5.81 m; L → 4.00 m of an 8 m arm; thin bent strip → 1.50 m of a 3 m strip. All inside. Not exercised in the browser this pass.

**Status.** Committed to `main`.

## 2026-09-09 — v1.6.0: regions edits go Apps Script → S3; GitHub out of the regions path

**What.**
- `apps scripts/nearmap.gs`: `nmS3PutObject_(key, body, contentType)` — SigV4 PUT to `property-intel-tiles.s3.us-east-1.amazonaws.com` signing `cache-control;content-type;host;x-amz-content-sha256;x-amz-date`, `Cache-Control: no-cache`, throws `S3 PUT <key> → HTTP <code>: <Code> — <Message>`. `nmEditsS3Key_(delivery)` = `nearmap/{delivery}/ai/edits/regions.json` (delivery id validated). `nmValidateRegionsDoc_` accepts the working FeatureCollection (Polygon/MultiPolygon Features with ids; adds `delivery_id`, `saved`, `saved_by`, per-class `counts`; 20 MB cap). `nmSavePins_` writes that document to S3 when `regions` is present; W summary `{url, features, counts, saved, etag}`. `nmRegionsEditsUrl_` derives the CloudFront edits URL from the AI URL; `nearmap-elements` and the record return it always. `checkS3EditsWrite()` editor probe. Removed: `nmPushFileToGitHub_`, `nmValidateRegionsDiff_`, `NM_EDITS_DIR/BASE`, `nmEditsPath_/Url_`. `checkGitHubToken` kept for the row sync.
- `nearmap-review.html` v1.6.0: sheet mode reads `regions_edits_url` (CloudFront) as a full FeatureCollection — no diff rebuild; `regionsDoc()` replaces `regionsDiff()`/`applyRegionsDiff()`; Save posts the working FC; status "regions saved to S3 edits/ (N regions, c changed / r removed vs original)"; Copy JSON copies the same document. v1.5.4's no-flash load (no hints render in sheet mode) and cache-busting query are included.
- Repo: `data/nearmap/edits/` (the `.gitkeep` and the one file Apps Script pushed during the trial) removed from `main`.

**Why.** Jonah: "I want the updates from apps script to S3 to have nothing to do with github. We are going to limit client data on github going forward, and nearmap data is a part of that." Apps Script already signs AWS calls for Bedrock, so the edits file can live at its folder-format key on S3, read through CloudFront like everything else.

**Files.** `apps scripts/nearmap.gs`, `nearmap-review.html`, `docs/NEARMAP_CONTRACT.md`, `docs/NEARMAP_RUNBOOK.md`, `data/nearmap/edits/*` (deleted)

**How it was checked.** `nearmap.gs` brace/paren 0, `node --check`, no leftover references to the removed helpers. Reviewer `node --check`, missing ids / onclick / dup funcs, BUILD v1.6.0. Headless Chromium, web app + edits URL stubbed (scratch Columbia): edits FC (147 features: r14/r17 removed, r143 replaced, d9 added) → "Loaded edits: 147 regions", Driveway 15, no hints flash; Save posts `FeatureCollection` of 147 with no `pins` key, r14/r17 absent, d9 present; Revert → 16; Save → 148 features equal to the original id set; plain `delivery=` open still fresh. **Not verified:** the SigV4 S3 PUT against the real bucket (needs paste + new deployment + IAM `s3:PutObject` on the edits key; `checkS3EditsWrite` reports the result), and CloudFront returning the new object promptly (no-cache set on PUT).

**Status.** Committed to `main`. Paste `nearmap.gs`, save, new deployment; run `checkS3EditsWrite`; add the IAM statement if it says AccessDenied.

## 2026-09-09 — v1.5.3: Copy JSON is mode-aware

**What.** Copy JSON copies what Save would send: in the regions editor the regions diff (`nearmap-regions-edits` doc: removed ids + changed/new features), in the pins editor `{elements, drawn}`. Status reports the counts.

**Why.** Jonah asked; in regions mode the button was still copying the Pass-1 pins from column R.

**Files.** `nearmap-review.html` (v1.5.3)

**How it was checked.** `node --check`; missing ids / onclick / dup funcs. Live note: the first real Save now reports `GitHub read data/nearmap/edits/<id>.json → HTTP 401 Bad credentials` — the `GITHUB_TOKEN` Script Property is expired/revoked (last successful sheet sync commit 2026-08-28 09:03). Rotate the token; no code change.

**Status.** Committed to `main`.

## 2026-09-09 — v1.5.2: Save tolerates Apps Script's HTML error page

**What.** Save reads the web-app reply as text; if it starts with `<` it is treated as transient (Google's "unable to open the file" page or a sign-in page), Save waits 2.5 s and retries once, and on a second failure prints "Apps Script returned a web page instead of JSON (“<title>”)" instead of `Unexpected token '<'`.

**Why.** Jonah's first live Save after the v1.5 deployment got `Unexpected token '<', "<!DOCTYPE "... is not valid JSON`. Probing the deployment at the same time: `nearmap-elements` returned JSON with the new `account_type` field and a probe POST returned a JSON error, while `ping` timed out — i.e. the deployment is correct and Google served a transient HTML page for that request.

**Files.** `nearmap-review.html` (v1.5.2)

**How it was checked.** `node --check`; missing ids / onclick / dup funcs. Live probes as above. **Not verified:** a successful live regions push (retry Save).

**Status.** Committed to `main`.

## 2026-09-09 — v1.5.1: edits push reports the real GitHub error; single-flight Save

**What.** `nmPushFileToGitHub_(path, content, message)` — Contents API GET (sha) then PUT, `branch: GITHUB_BRANCH`, one retry after 800 ms on 409/422 — replaces `pushAllToGitHub` for `data/nearmap/edits/{id}.json`. It throws `GitHub write <path> → HTTP <code>: <message>` (or `GITHUB_TOKEN is not set`), which the reviewer prints in the status line. `pushAllToGitHub` is unchanged and still used by the row sync. Reviewer: Save button disabled while a save is in flight.

**Why.** First live Save from the deployed web app reported "GitHub push of regions edits failed (see Executions log)" — `pushAllToGitHub` only returns false, so the cause (token scope, non-fast-forward race, payload) was invisible from the page. Nothing reached `data/nearmap/edits/` on origin.

**Files.** `apps scripts/nearmap.gs`, `nearmap-review.html` (v1.5.1)

**How it was checked.** `node --check` on both; brace/paren 0; missing ids / onclick / dup funcs clean. **Not verified:** a live push (needs paste + new deployment, then Save from the regions editor — the status line will now say why if it fails again).

**Status.** Committed to `main`. Paste `nearmap.gs`, save, new deployment, retry Save.

## 2026-09-09 — v1.5.0: two editors on one page — Regions and Pins

**What.**
- `nearmap-review.html` v1.5.0. `MODE` = `?mode=pins` or `regions` (default); `body.mode-*` with `.regions-only` / `.pins-only` visibility. **Regions editor:** Pan / Draw, Size, ◀ ▶, Clear brush, Revert regions; pins are not drawn, `consumed` is empty, Save posts `{mode:'regions', regions: diff}` with **no `pins` key**. **Pins editor:** Pan / Place pin / Seed from regions, pin list with delete (deleting a pin never touches regions), Save posts `{mode:'pins', pins, drawn}` with no `regions`. Regions are read-only context; all non-vegetation layers (plus Lawn Grass) are switched on. `seedPinsFromRegions`: one pin per region at its `interiorPoint`, classes mapped by `SEED_MAP` × account type (Building→57/19, Roof & Translucent Roofing→61, Driveway→186, Asphalt→206, Road→210, Concrete Slab→52, Solar Panel→69, Swimming Pool→130, Lawn Grass→114, Water Body→129/132, Skylight→68, Residential Chimney→16, Dumpster→98); vegetation/Tree Overhang/Natural skipped except Lawn Grass; Car and Building (Deprecated) skipped (no pin / duplicate); largest regions first; stops at the 20-pin cap and reports skips, out-of-bounds and cap. Auto-seeds on first open when the row has no pins; the Seed button re-seeds after a confirm. `placePinAt`: map click → picker (region's mapped id first, then class suggestions) → pin with `source:'placed'`.
- `apps scripts/nearmap.gs`: `nmSavePins_` writes column R only when `pins` is an array (absent key = leave R alone) and requires pins or regions; response `saved` is null when pins were not sent; `nearmap-elements` returns `account_type`; `buildNearmapReviewUrl_(sheet,row,mode)`, `nmOpenEditor_`, `openNearmapPinsForActiveRow`.
- `apps scripts/menu.gs`: Nearmap Pipeline → "Open Nearmap Regions Editor (This Row)" and "Open Nearmap Pins Editor (This Row)".

**Why.** Jonah: two separate editors, regions and pins, never at the same time; a pin for every region except vegetation/nature, Lawn Grass being the one that gets a pin.

**Files.** `nearmap-review.html`, `apps scripts/nearmap.gs`, `apps scripts/menu.gs`, `docs/NEARMAP_CONTRACT.md`, `docs/NEARMAP_RUNBOOK.md`

**How it was checked.** `node --check`; missing ids / onclick / dup funcs; BUILD v1.5.0. `nearmap.gs` + `menu.gs` brace/paren 0, `node --check`. Headless Chromium with the web app stubbed (scratch Columbia): regions mode — Draw/Revert/hints visible, Place/Seed/pin list hidden, a sheet pin stays hidden, Save payload keys `[mode, regions]`; pins mode — Place/Seed/pin list visible, Draw/Revert/hints hidden, auto-seed "Seeded 20 pin(s) … no catalog pin for Building (Deprecated) (3), Car (18) · 12 over the 20-pin cap" on unmerged vendor data, class mix Driveway×7 Building×3 Roof×3 Lawn×2 Patio×2 Parking lot Private road Dumpster, delete → 19/20, Place pin → picker "Pin on Road (Driveable Surface) as…" → "Placed Private road", Save payload keys `[drawn, mode, pins]`, 0 page errors. **Not verified:** live Apps Script (paste config.gs, nearmap.gs, menu.gs; new deployment), real GitHub push of edits.

**Status.** Committed to `main`.

## 2026-09-09 — v1.4.1: pin sits inside irregular shapes

**What.** `interiorPoint(f)` replaces the vertex-average for pin placement and hint dots: area (shoelace) centroid of the largest polygon when it lies inside that polygon; otherwise the midpoint of the interior span — on horizontal and vertical scan lines through the bbox, centre outward — with the greatest clearance from any edge (span width breaks ties). `largestRingCentroid` now delegates to it; `drawHints` uses it. All math in the local metre frame.

**Why.** Jonah: "ensure that when a shape is irregular, the pin is still in the middle of the shape." A vertex average lands outside C/L shapes and drifts toward densely-vertexed edges.

**Files.** `nearmap-review.html` (v1.4.1)

**How it was checked.** `node --check`; missing ids / onclick / dup funcs; BUILD v1.4.1. Node unit test on the extracted functions: C-shape vertex-avg (17.5, 15) outside → interiorPoint (15, 5) inside, centred in the thick arm; L-shape (12.7, 12.7) outside → (15, 4) inside; bent driveway with dense vertices on one arm → (20, 1.5) inside. Paint/erase suite 8/8 and sheet-mode suite unchanged. **Deployed web app (probe 2026-09-09 12:45):** `?route=nearmap-elements&site_no=VY-IN-002` returns `{"ok":false,"error":"NM_COL_DRAWN is not defined"}` — the deployed `config.gs` predates column W; paste `config.gs` + `nearmap.gs` (+ `critique-api.gs`), save, new deployment.

**Status.** Committed to `main`.

## 2026-09-09 — v1.4.0: sheet mode on the original/edits folder format

**What.**
- `nearmap-review.html` v1.4.0. `SHEET_MODE` = `site_no=` or `property=`. In sheet mode the page waits for the `nearmap-elements` row, loads original from `regions_original_url` (CloudFront `ai/original/regions.json`) and edits from `regions_edits_url` (GitHub `data/nearmap/edits/{id}.json`, a diff), rebuilds `original − removed + features`, and does **not** reset anything on reload. Save posts pins plus `regionsDiff()` (features whose geometry/properties differ from original or are new; ids missing from the working set as `removed`). Revert regions → original; status asks for a Save, which publishes an empty diff. Testing mode (fresh open) now applies only to plain `delivery=` opens (`?fresh=1` forces it, `?fresh=0` resumes local edits). Sidebar note updated.
- `apps scripts/nearmap.gs`: `nmRegionsOriginalUrl_` (AI URL → original), `nmEditsPath_/nmEditsUrl_` (`data/nearmap/edits/{id}.json`), `nmParseW_/nmWriteW_` (column W = `{drawn, edits:{url,changed,removed,saved}}`; old bare FeatureCollection still parses), `nmValidateRegionsDiff_` (Polygon/MultiPolygon Features with ids, 8 MB cap), `nmSavePins_` publishes the diff via `pushAllToGitHub` when `payload.regions` is present, `nmGetElements_` returns `property_id`, `regions_original_url`, `regions_edits_url`, `regions_edits`, `nmBuildRecord_` adds `regions: {original, edits, edits_saved}`. Header contract block updated.
- `tools/nearmap/promote.py`: seeds S3 `ai/edits/regions.json` from original when absent (`--reset-edits` to reseed); still never uploads the local working edits file.

**Why.** Jonah: implement the reviewer into the Nearmap sheet following the original/edits folder format, with Revert going to original. A regions file (350 KB–3.4 MB) cannot live in a 50 000-character sheet cell and the browser cannot write S3, so edits are published as a diff to GitHub by Apps Script (the only GitHub writer), original stays on CloudFront (promote is the only S3 writer). Lambda untouched.

**Files.** `nearmap-review.html`, `apps scripts/nearmap.gs`, `tools/nearmap/promote.py`, `docs/NEARMAP_CONTRACT.md`, `docs/NEARMAP_RUNBOOK.md`, `data/nearmap/edits/.gitkeep`

**How it was checked.** Reviewer: `node --check`, missing ids / onclick / dup funcs, BUILD v1.4.0. `nearmap.gs`: brace/paren/bracket 0, no duplicate functions, `node --check` on a copy. `promote.py`: `py_compile`, `--help`. Headless Chromium with `script.google.com` and the edits URL stubbed (scratch copy of Columbia St): row with a stub diff (remove r14, r17; replace r143; add d9) → status "Loaded edits: 2 changed, 2 removed", Driveway 16 → 15, r14/r17 gone, d9 present, r143 replaced, sheet pin 1/20; Save → posted diff removed [r14, r17], features [d9, r143]; Revert → 16, status asks for Save; Save → empty diff. Plain `delivery=` open still "Fresh open". Paint/erase regression suite 8/8. **Not verified:** the live Apps Script deployment (paste + new version needed), a real GitHub push of `data/nearmap/edits/{id}.json`, `promote.py --reset-edits` against S3.

**Status.** Committed to `main`. Paste `nearmap.gs`, save, new deployment; re-promote deliveries once to seed CloudFront `ai/edits/`.

## 2026-09-09 — One erase stroke cuts every region it crosses

**What.** `eraseTargets` returns every visible same-class region the sweep touches (the picked one included); only if none fall back to any visible region. Before, touching the picked region short-circuited to `[seed]` and every other piece under the stroke was ignored. Status: "Removed from Driveway" when only the picked region was hit, otherwise "Removed from N Driveway regions · split into M".

**Why.** Jonah: a long erase traced through several pieces only clipped one of them.

**Files.** `nearmap-review.html` (v1.3.29-local), `docs/NEARMAP_CONTRACT.md`

**How it was checked.** `node --check`; missing ids / onclick / dup funcs; BUILD v1.3.29-local. Headless Chromium on a scratch copy of Columbia St: build one blob, slice it into 5 pieces, then one diagonal Size-12 erase across all 5 → before the fix 1 of 5 changed; after, 5 of 5 changed ("Removed from 5 Driveway regions · split into 10"), verified region by region against the centreline crossing test. Retarget suite and dangling-pick suite unchanged (0 page errors). Not pushed to Pages.

**Status.** Local reviewer only.

## 2026-09-09 — Picked region can no longer be absorbed away; dead pick is dropped cleanly

**What.** In the detached-paint branch the picked region is excluded from the absorb pass, and if the new paint reaches the picked region anyway (stroke within 1 m, or the result overlaps it) the stroke is handled as a grow of the picked region instead of a new region. If a stroke starts with a pick whose region no longer exists, the pick is dropped (stroke preview cleared, `+` cursor, status "That region no longer exists — + click a centroid to pick again") instead of leaving a dead brush. The "Paint did not produce a region" exits also clear the stroke preview now.

**Why.** Jonah: the erase highlight stayed over the group and nothing was erased. Status read "That pin has no region to expand": a detached stroke had absorbed the picked region into a new `dN` feature, so `brushTarget.regionId` pointed at a deleted id and every later stroke exited early without clearing the preview.

**Files.** `nearmap-review.html` (v1.3.28-local), `docs/NEARMAP_CONTRACT.md`

**How it was checked.** `node --check`; missing ids / onclick / dup funcs; BUILD v1.3.28-local. Headless Chromium on a scratch copy of Columbia St: pick r69 → Size-48 stroke starting 250 px away and sweeping over r69 → "Added to Driveway · merged 8 regions", r69 id kept, still armed → erase applies ("split into 2"), preview cleared → far stroke → "New Driveway region" → erase on it applies → still armed. 8/8, 0 page errors. Not pushed to Pages.

**Status.** Local reviewer only.

## 2026-09-09 — Wheel zoom before a pick; erase on additions: no saw-tooth, no whole-region loss

**What.** (1) Wheel zoom in Draw is handled on `#stage` (capture) for the whole stage, not just the hit overlay — Maps ignores the wheel while `draggable:false`, so before a pick nothing zoomed. (2) `conformRing` no longer snaps contour points that lie inside the brush sweep (`inCarve`, radius `brushR + cell`) back to pre-stroke edges; the carve is treated as new boundary end to end. (3) On erase the mask is opened (erode+dilate, `openMask`, k = floor(0.8 m / 2 / cell)) within `brushR + 1.6 m` of the stroke, removing thin crescents before contouring. (4) Fragment rules are absolute: crumb `< ERASE_MIN_FRAG_M2 = 3 m²`, sliver mean width `2A/P < ERASE_SLIVER_WIDTH_M = 0.8 m`; the relative `ERASE_FRAG_FRAC` / `ERASE_SLIVER_RATIO` / `ERASE_SLIVER_FRAC` rules are gone. A single surviving piece is kept unless it is both a crumb and a sliver (or < 0.3 m²); when the result is scattered, crumbs and slivers drop. Pieces that still cover the feature's vendor original (`originalById`) are never dropped.

**Why.** Jonah: "ensure you can still zoom when draw is selected. erase is still not working on new additions." Reproduced: erasing along a painted addition produced saw-tooth edges (snap-back alternating with the carve) and thin crescent spikes; and erasing a big addition off a small vendor scrap deleted the whole region because the scrap was under 8 % of the pre-erase area.

**Files.** `nearmap-review.html` (v1.3.27-local), `docs/NEARMAP_CONTRACT.md`, `docs/NEARMAP_RUNBOOK.md`

**How it was checked.** `node --check`; missing ids / onclick / dup funcs; BUILD v1.3.27-local. Headless Chromium on a scratch copy of Columbia St: wheel zoom changes zoom in Draw both before and after a pick; grow r69 (10.5 m²) with a Size-48 addition (merged 5 regions) then erase the addition → r69 survives, single Polygon, sharp reversals 4→3 of ~16 vertices; Size-30 addition then erase its far half → split into 2, r69 kept, 1 sharp reversal in 47 vertices; retarget suite: nibble/cut on seed, erase over bare ground, detached region, undo all pass (12/15 — the 3 "fails" are the old build string and a 4 m² test region that is now correctly removed as two crumbs). 0 page errors. Not pushed to Pages.

**Status.** Local reviewer only.

## 2026-09-09 — Testing mode: every open starts from ai/original/

**What.** `FRESH_ON_OPEN` (default true; `?fresh=0` disables). On open the working regions are a deep copy of `ai/original/regions.json`; `ai/edits/regions.json`, the `nm-regions:` browser backup, and the `nm-review:` pins/drawn backup are ignored, the pins backup is removed, `record.elements`/`drawn` start empty, and `persistRegions()` immediately rewrites `edits/regions.json` from the original so disk equals the screen (status "Fresh open — edits/regions.json reset to original"). Paints during the session still write `edits/regions.json` as before; they just do not survive a reload. `hints.json` is one file (vendor counts) and is only a placeholder until regions load, so no `edits/hints.json` is needed — counts are recounted from the working regions.

**Why.** Jonah: "I do not want the data updated when the page is refreshed. This is simply for testing … always default to the json from the original folder."

**Files.** `nearmap-review.html` (v1.3.26-local), `docs/NEARMAP_CONTRACT.md`, `docs/NEARMAP_RUNBOOK.md`

**How it was checked.** `node --check`; missing ids / onclick / dup funcs; BUILD v1.3.26-local. Headless Chromium on Columbia St with edits at Driveway 2/134 and seeded stale localStorage regions + pins: open → Driveway 16, pins 0/20, pins key removed, status shows the reset, All → 16; edits file on disk afterwards 16/148. `?fresh=0` still resumes the edits file. 0 page errors. Not pushed to Pages.

**Status.** Local reviewer only. Flip `FRESH_ON_OPEN` (or the default of `?fresh`) before this page is used for real review.

## 2026-09-09 — Sidebar counts come from the working regions at load

**What.** `loadAiIndex` renders the hints counts, then immediately calls `ensureFeatures()` so `ai/edits/regions.json` (or original) is loaded at startup and the class counts are recounted from the working file. Previously regions loaded only when a layer was first checked, so the sidebar showed the vendor counts from `hints.json` until then. `anyLayerOn` removed (unused).

**Why.** Jonah: "driveway is still having the same 16 → 2 issue." The 16 was the vendor count in `hints.json`; the 2 was the current merged state in his edits file (server log shows the paints). The counter must show the working state from the first paint.

**Files.** `nearmap-review.html` (v1.3.25-local)

**How it was checked.** `node --check`; missing ids / onclick / dup funcs; BUILD v1.3.25-local. Headless Chromium on Columbia St with the edits file at Driveway 2 of 134: count at load = 2, after All = 2, after reload + All = 2 (no 16 → 2 jump). 0 page errors. Not pushed to Pages.

**Status.** Local reviewer only.

## 2026-09-09 — Accept button removed; Clear brush button

**What.** Toolbar is Pan / Draw. The Accept button is gone (`onAcceptFeature` and the `accept` tool mode remain in code but are unreachable). A **Clear brush** button sits next to `◀ ▶` under Size: enabled only while Draw has a picked region; clicking it drops the pick (`clearBrushPick`) and returns to the `+` pick cursor without leaving Draw or touching regions/history. Empty pin-list hint no longer mentions Accept.

**Why.** Jonah: the only way to get rid of the painted cursor was to click Draw again; that should be explicit.

**Files.** `nearmap-review.html` (v1.3.24-local), `docs/NEARMAP_CONTRACT.md`, `docs/NEARMAP_RUNBOOK.md`

**How it was checked.** `node --check`; missing ids / onclick / dup funcs; BUILD v1.3.24-local. Headless Chromium on Columbia St (read-only run, no paint): toolbar = [Pan, Draw]; Clear disabled before a pick; pick Driveway → Clear enabled, hit overlay on; click Clear → label "+ click a centroid", Clear disabled, hit overlay off, Draw still active. 0 page errors. Not pushed to Pages.

**Status.** Local reviewer only.

## 2026-09-09 — Paint absorbs covered same-class scraps; leaving Draw drops the pick

**What.** (v1.3.22) After the union, `unionWithAbsorb` looks for same-class, un-pinned regions that the result now covers or overlaps (any of their vertices inside the result, or any result vertex inside them), adds them to the merge, and re-unions — up to four passes. Both the grow branch and the detached new-region branch use it. (v1.3.23) Leaving Draw (Pan/Accept) clears `brushTarget`; `drawPolygons` no longer force-draws the picked region when its layer is off; unchecking the picked region's layer, or None, drops the pick; `setTool` refreshes the toolbar label.

**Why.** Jonah: a wide paint left small Driveway scraps as separate outlined features inside the merged region ("did not correctly add all regions into single regions"); and the painted region stayed on screen after deselecting Draw or turning the layer off.

**Files.** `nearmap-review.html` (v1.3.23-local)

**How it was checked.** `node --check`; missing ids / onclick / dup funcs; BUILD v1.3.23-local. Headless Chromium on a scratch copy of Columbia St (so the live edits file was not touched): six Size-48 sweeps over the parking lot → Driveway 16 → 1, zero other Driveway features with a vertex inside the merged region; Pan → pick cleared; Driveway unchecked → no polygons drawn (screenshot); re-pick in Draw then uncheck → label back to "+ click a centroid". 0 page errors. Columbia St `ai/edits/regions.json` confirmed byte-equal to original afterwards. Not pushed to Pages.

**Status.** Local reviewer only.

## 2026-09-09 — Regions fetch bypasses HTTP cache; file refreshes the browser backup

**What.** `fetchJsonOptional` (used for `ai/original/regions.json` and `ai/edits/regions.json`) now fetches with `cache: 'no-store'`. When the edits file is present, `ensureFeatures` overwrites the `nm-regions:` localStorage backup with it, so a stale backup cannot resurface if the server is later unreachable. Columbia St `ai/edits/regions.json` was reverted on disk to the vendor original (148 features, Driveway 16) at Jonah's request.

**Why.** After the disk revert, clicking All dropped Driveway from 16 (hints.json) to 2 — the browser returned yesterday's merged edits file from cache (or the stale localStorage backup) on the first regions fetch.

**Files.** `nearmap-review.html` (v1.3.21-local), `tmp/nearmap-serve/410-sw-columbia-st-bend-or-97702/ai/edits/regions.json` (reverted, not tracked)

**How it was checked.** `node --check`; missing ids / onclick / dup funcs; BUILD v1.3.21-local. Headless Chromium with a seeded stale backup (Driveway 2): All → 16; backup rewritten to 148 features; reload + All → 16; both regions requests hit the server. 0 page errors. Not pushed to Pages.

**Status.** Local reviewer only.

## 2026-09-09 — Driveway colour; active-class border highlight

**What.** `colorForClass` Driveway `#6c757d` (grey) → `#f72585` (pink). In `drawPolygons`, every polygon whose class is `activeClass` gets a 2.5 px class-colored border over a 5 px white halo (second non-clickable polygon, zIndex 2/3); other classes keep the 1.5 px border. `activeClass` is set when a layer is checked or a region/pin is picked in Draw, cleared when the active layer is unchecked, and clicking the name or swatch of an already-checked layer makes it active without toggling the checkbox.

**Why.** Jonah: the Driveway pin colour was hard to read on asphalt, and selecting a layer should highlight all borders of that type.

**Files.** `nearmap-review.html` (v1.3.20-local), `docs/NEARMAP_CONTRACT.md`, `docs/NEARMAP_RUNBOOK.md`

**How it was checked.** `node --check`; missing ids / onclick / dup funcs; BUILD v1.3.20-local. Headless Chromium on Columbia St: check Driveway → active Driveway (pink halo borders); check Building → active Building; click Driveway name → active Driveway, still checked; uncheck Driveway → no active row. Screenshots reviewed. 0 page errors. Not pushed to Pages.

**Status.** Local reviewer only.

## 2026-09-08 — Stroke preview drawn at true brush width (own canvas)

**What.** The live paint/erase stroke is drawn on `<canvas id="brushStroke">` in `#stage` (screen space, DPR-aware, round caps/joins, `lineWidth = BRUSH_PX × 2`, alpha 0.55, class colour or erase red) instead of a Maps `Polyline`. Stamps stay lat/lng and are re-projected through `pixOverlay` on every `brushAt` and on `bounds_changed`. `clearBrushStroke` clears the canvas. The erase/paint mask was already using the full brush radius; only the preview was wrong.

**Why.** Google Maps caps polyline `strokeWeight`; at Size 48 the polyline rendered ~45 px while the cursor was 96 px, so the red line understated the area that the erase then removed. Jonah: "ensure that the line being drawn when erasing removes area and is as large as the cursor size selected."

**Files.** `nearmap-review.html` (v1.3.19-local), `docs/NEARMAP_CONTRACT.md`, `docs/NEARMAP_RUNBOOK.md`

**How it was checked.** `node --check`; missing ids / onclick / dup funcs; BUILD v1.3.19-local. Headless Chromium on Columbia St: erase carve width measured by point-in-polygon sampling before/after = 96 px median over 16 columns at Size 48, z20 (expected 96); rendered stroke thickness read back from the canvas = 98 px at DPR 1 and 97.3 px at DPR 1.5 (cursor 96 px; before the change the polyline was ~45 px); erase retarget / split / undo suite 12/12 behavioural checks, 0 page errors. Not verified: preview during a wheel-zoom mid-stroke; review_server file PUT. Not pushed to Pages.

**Status.** Local reviewer only.

## 2026-09-08 — Erase whole-removal thresholds doubled

**What.** `ERASE_MIN_FRAG_M2` 1.5 → 3 m², `ERASE_FRAG_FRAC` 0.04 → 0.08, `ERASE_SLIVER_FRAC` 0.25 → 0.5. `ERASE_SLIVER_RATIO` stays 0.12. A piece left by an erase is now dropped when it is under 3 m² or under 8 % of the pre-erase area, or when it is a sliver and under half the pre-erase area. When no piece survives, the region and its pin are removed.

**Why.** Jonah: "double what constitutes removing the entire region when erasing."

**Files.** `nearmap-review.html` (v1.3.18-local), `docs/NEARMAP_CONTRACT.md`, `docs/NEARMAP_RUNBOOK.md`

**How it was checked.** `node --check`; missing ids / onclick / dup funcs; BUILD v1.3.18-local. Constants only; erase logic unchanged since v1.3.17. Not exercised in the browser this pass. Not pushed to Pages.

**Status.** Local reviewer only.

## 2026-09-08 — Erase targets the region under the brush

**What.** Right-click erase no longer assumes the picked region. `eraseTargets` picks: the selected region if the sweep touches it; otherwise same-class visible regions under the sweep; otherwise any visible region under it. Each target runs `eraseFromFeature` (split / sliver-drop / whole removal, pin recentre or removal). If nothing is under the brush the status says "Nothing to remove under the brush" and nothing changes (before, a miss reported "Removed from …" and only flipped `origin`). The picked region stays armed unless it was the one removed. One undo snapshot per stroke.

**Why.** Jonah: "erase option is no longer working." After painting a detached new region, right-dragging over that new region erased from the still-selected original (untouched by the stroke), so the map did not change.

**Files.** `nearmap-review.html` (v1.3.17-local), `docs/NEARMAP_CONTRACT.md`, `docs/NEARMAP_RUNBOOK.md`

**How it was checked.** `node --check`; missing ids / onclick / dup funcs; BUILD v1.3.17-local. Headless Chromium (Playwright, real Maps JS, `http.server` on :8899) Columbia St, 13/13, 0 page errors: pick r143 → paint detached on the roof (16→17) → nibble the new region (its geometry changes, r143 byte-identical, still armed) → big erase over it (removed, 16, still armed) → ◀ restores (17); erase over bare ground → "Nothing to remove", features unchanged; nibble on r143 → "Removed from Driveway"; cut across r143 → "split into 2". Not verified: review_server file PUT; any-class fallback on real mixed layers. Not pushed to Pages.

**Status.** Local reviewer only.

## 2026-09-08 — Erase splits regions in two; slivers left by an erase are dropped

**What.** Right-click erase in Draw now post-processes the erased mask (after `conformGeometry` snapping) with `classifyErasePieces`. Each outer polygon gets its area and outer perimeter in the local metre frame (`ringMetricsXY` / `polyMetricsXY` on `meterFrame` x/y — never absolute projected metres). A piece is a **fragment** when its area is under `max(ERASE_MIN_FRAG_M2 = 1.5 m², ERASE_FRAG_FRAC = 4 % of the pre-erase region area)`, or when it is a sliver — area ÷ (perimeter² / 4π) below `ERASE_SLIVER_RATIO = 0.12` — and still under `ERASE_SLIVER_FRAC = 25 %` of the pre-erase area. Fragments are dropped. Of the survivors, the **largest** stays on the seed feature (same id, same properties, now a single `Polygon`; holes stay with their outer ring); every other survivor becomes a **new** same-class feature `dN` with a copy of the seed's properties and `origin: 'split'`. No pins are created for split-off pieces; the seed's pin (if any) is re-centred on the largest piece with `largestRingCentroid` and still refuses out-of-bounds. If **no** piece survives (the reviewer brushed out essentially the whole region — including the case where the mask is empty, which used to stop with "Remove would empty the region"), the seed feature is removed (`removeRegionIds`) and the pin that owns it is deleted like `deletePin` does for merged/drawn pins — vendor originals are **not** restored, the erase was intentional — then Draw drops back to "+ click a centroid". The erase path pushes exactly **one** paint-history snapshot before any mutation in every outcome, so ◀ restores split, drop, and remove-whole-region alike. Status: "Removed from Driveway · split into 2 · dropped 1 sliver" / "Removed Driveway region". Left-click grow and the detached new-region path are untouched. New constants sit next to `JOIN_M`.

**Why.** Jonah: separating a region did not split it into two separate regions (one MultiPolygon, one count, one pin), and erasing most of a region left scattered, irregular scraps that should just take the whole region with them.

**Files.** `nearmap-review.html` (v1.3.16-local), `docs/NEARMAP_CONTRACT.md`, `docs/NEARMAP_RUNBOOK.md`

**How it was checked.** `python tmp/gs-check/extract-review.py`: `node --check` 0, missing ids [], onclick [], dup funcs [], BUILD v1.3.16-local. Headless Chromium (Playwright, real Maps JS, `http.server` on :8899 so PUT falls back to localStorage; `google.maps.Map` wrapped via the `nmMapsReady` callback to project lat/lng → container px) on Columbia St, 31/31 checks, zero page errors: Accept `r143` (Driveway, 61 m²) → Draw → pick the pin → right-drag clear across it at 8 px = "Removed from Driveway · split into 2 · dropped 1 sliver", `r143` kept as a 33.8 m² Polygon, `d1` Driveway `origin: split` 19.2 m², Driveway 16→17, still one pin on `r143` moved from 43.2,39.7 to 40.1,34.9; ◀ → `r143` geometry byte-identical, no split features, 16, pin back at 43.2,39.7. Accept `r69` (Driveway, 10.5 m²) → Draw → pick → 40 px zigzag over it = "Removed Driveway region", `r69` gone, 16→15, its pin gone (pin list 1 / 20), label "+ click a centroid"; ◀ → `r69` back byte-identical, 16, both pins back. Left-click stamp on `r143` = "Added to Driveway", count 16; detached stamp on the roof = "New Driveway region · Driveway 17", `origin: drawn`. Edge nibble on `r143` = plain "Removed from Driveway". Not pushed to Pages. Not verified: review_server file PUT (only `http.server` ran); the constants against a wide range of real erases (tuned on one Driveway); MultiPolygon seeds with holes through the split path (Columbia St driveways are hole-free); the pin out-of-bounds refusal on a split (no piece landed outside the frame).

**Status.** Local reviewer only.

## 2026-09-08 — Selected polygon no longer highlighted

**What.** `drawPolygons` draws the picked region exactly like its neighbours: class-colored 1.5 px stroke, 0.32 fill, zIndex 2. The white 2.5 px `inWork` stroke, 0.5 fill, and raised zIndex are gone. The toolbar label still names the picked class.

**Why.** Jonah: clicking a region still highlighted it in white.

**Files.** `nearmap-review.html` (v1.3.15-local), `docs/NEARMAP_CONTRACT.md`, `docs/NEARMAP_RUNBOOK.md`

**How it was checked.** `node --check`; missing ids / onclick / dup funcs; BUILD v1.3.15-local. Not exercised in the browser this pass. Not pushed to Pages.

**Status.** Local reviewer only.

## 2026-09-08 — Selected pin no longer enlarged; back/forward arrows for paint edits

**What.** Picking a pin or hint centroid for Draw no longer redraws that marker bigger with a white border; the selected catalog pin and hint look exactly like their unselected neighbours (the selected *polygon* keeps its white 2.5 px stroke). A `◀ ▶` row under Size (ids `brushUndo` / `brushRedo`, visible only while Draw is on) steps through an in-memory history of the regions FeatureCollection + `elements`. Each committed paint stroke (grow, erase, detached new region) pushes a snapshot before it changes anything; back/forward swap the current state with the top of the other stack, then rebuild consumed ids, recount classes, persist to localStorage + `ai/edits/regions.json`, and redraw. History is capped at 30 and lives in memory only (not localStorage, not the file). If the picked region no longer exists after a step, Draw drops back to "+ click a centroid". Ctrl+Z / Ctrl+Shift+Z (or Ctrl+Y) do the same while Draw is on and the picker is closed. Accept, delete pin, and Revert do **not** push snapshots in this pass; **Revert regions clears both stacks** so back cannot resurrect a pre-revert state.

**Why.** Jonah asked to drop the enlarge/outline on the selected pin and to add simple back/forward arrows under the size bar for paint additions.

**Files.** `nearmap-review.html` (v1.3.14-local), `docs/NEARMAP_CONTRACT.md`, `docs/NEARMAP_RUNBOOK.md`

**How it was checked.** `python tmp/gs-check/extract-review.py`: `node --check` 0, missing ids [], onclick [], dup funcs [], BUILD v1.3.14-local. Headless Chromium (Playwright, real Maps JS, `http.server` on :8899 so PUT falls back to localStorage, `google.maps.Marker` wrapped to record every constructed marker) on Columbia St: Draw → click a Driveway hint → no marker with scale > 8 or strokeWeight > 2, catalog pins have `icon: undefined` and zIndex 20, remaining hints all scale 4.5; arrow row hidden in Pan, shown in Draw, both disabled at start; detached stamp → "New Driveway region", count 16→17, `d1`; ◀ → 16, `d1` gone, Draw still armed, ◀ disabled / ▶ enabled; ▶ → 17, `d1` back; stamp on the seed → exactly one geometry (`r49`) changed, ▶ disabled; ◀ → all geometries byte-identical to before the grow, `d1` kept; Ctrl+Shift+Z re-applies, Ctrl+Z undoes; Revert → 16 and both arrows disabled; Pan hides the row. Zero page errors, 37/37 checks. Not pushed to Pages. Not verified: review_server file PUT (only `http.server` ran), history behaviour across a delete/Accept in the same session, and the 30-entry cap on real data.

**Status.** Local reviewer only.

## 2026-09-08 — Detached paint creates a new region; class counts refresh

**What.** Left-click paint that does not touch the selected region writes a new same-class feature (`dN`) instead of growing the selection. Same-class scraps within 1 m of that paint still join the new region. The sidebar class counter is recounted after paint, merge, delete, and revert.

**Why.** Painting off the picked polygon was merging into it, and the Driveway (etc.) count did not move.

**Files.** `nearmap-review.html` (v1.3.13-local), `docs/NEARMAP_CONTRACT.md`, `docs/NEARMAP_RUNBOOK.md`

**How it was checked.** `node --check`; missing ids / onclick / dup funcs; BUILD v1.3.13-local. Headless Chromium (Playwright, real Maps JS, `http.server` on :8899 so PUT falls back to localStorage) on Columbia St: Draw → click a Driveway hint centroid → stamp on it = "Added to Driveway", count 16→16, no new feature; stamp ~220 px away = "New Driveway region · Driveway 17", `d1` with `origin: drawn`, pre-existing Driveway geometries byte-identical (seed not absorbed), picker closed, Draw still armed; second detached stamp → `d2`, 17→18; right-click on the seed = "Removed from Driveway", 18→18; sidebar count == stored feature count; Revert → 16. No page errors. Not pushed to Pages. Not verified: the 1 m scrap-join around a *new* region on real data, and review_server file PUT (only `http.server` was running).

**Status.** Local reviewer only.

## 2026-09-08 — Brush cursor, paint line, and selected pin share Size

**What.** Size now drives one radius: the cursor fill, the live paint polyline, the selected hint centroid, and the selected catalog pin. Changing the slider while Draw is armed restyles all four. Cursor fill uses content-box so the inner disk matches the line width. *(v1.3.14-local reverted the selected hint/pin part: the selected marker is no longer resized or outlined; Size drives only the cursor and the paint line.)*

**Why.** At Size 48 the outer circle grew but the roof pin stayed ~7 px and the inner fill was smaller than the stroke (border-box).

**Files.** `nearmap-review.html` (v1.3.12-local)

**How it was checked.** `node --check`; missing ids / onclick / dup funcs. Browser: Draw, pick a centroid, drag Size, confirm pin and cursor match. Not pushed to Pages.

**Status.** Local reviewer only.

## 2026-09-08 — Draw-only paint; size slider under Draw

**What.** Removed the Brush button. Draw is the only paint tool: pick a centroid, left-click adds, right-click removes. A range slider under Draw sets brush size (4–48 px). The live circle follows the slider.

**Why.** Jonah asked to drop Brush and control brush size from a scrollbar under Draw.

**Files.** `nearmap-review.html` (v1.3.11-local), `docs/NEARMAP_CONTRACT.md`, `docs/NEARMAP_RUNBOOK.md`

**How it was checked.** `node --check`; getElementById vs ids; no onclick. Not pushed to Pages.

**Status.** Local reviewer only.

## 2026-09-08 — Draw left-add / right-remove; Brush keeps scroll zoom

**What.** Draw picks a centroid like Brush, then left-click (or drag) adds the circle to that region and right-click subtracts. Context menu is suppressed. Brush and Draw no longer set `gestureHandling: none`; pan stays off, scroll-wheel zoom stays on, and the zoom control is left uncovered.

**Why.** Jonah wants Draw to add/remove area, and to zoom while Brush is selected.

**Files.** `nearmap-review.html` (v1.3.9-local), `docs/NEARMAP_CONTRACT.md`, `docs/NEARMAP_RUNBOOK.md`

**How it was checked.** `node --check`; getElementById vs ids; no onclick. Not pushed to Pages.

**Status.** Local reviewer only.

## 2026-09-08 — Brush keeps original edge smoothing

**What.** After a paint union, contour points within ~0.55 m of a surviving original edge snap back to that edge (and original corners). Those edges collapse to the source vertices instead of 0.25 m stairs. Only the painted extension is Chaikin-smoothed and simplified to the source polygon's median segment length.

**Why.** Adding an extension re-digitized the whole outline into small raster chunks.

**Files.** `nearmap-review.html` (v1.3.8-local), `docs/NEARMAP_CONTRACT.md`

**How it was checked.** `node --check`; getElementById vs ids; staircase-snap unit check (10 m original edge). Not pushed to Pages.

**Status.** Local reviewer only.

## 2026-09-08 — Brush paint is exact; scraps join only within 1 m

**What.** Brush no longer convex-hulls the selected region, the stroke, and every hit scrap (that filled unpainted gaps). The new area is the selected polygon unioned with the brush disks along the stroke. Another same-class scrap is absorbed only if it is within 1 m of the paint (`JOIN_M`). Gaps farther than that stay empty until painted.

**Why.** Jonah needs accurate drawing: approximate hull connections pulled in driveway scraps that were not actually touching.

**Files.** `nearmap-review.html` (v1.3.7-local), `docs/NEARMAP_CONTRACT.md`

**How it was checked.** `node --check` on the extracted script; getElementById vs ids; no onclick; brace balance. Not pushed to Pages.

**Status.** Local reviewer only.

## 2026-09-08 — Brush: + to pick, then a class-colored circle that paints over centroids

**What.** Brush is two steps. Clicking Brush shows a `+` cursor to pick a centroid (and its class). After that pick, the cursor becomes a circle in that class color, sized to the current brush (`BRUSH_PX`). A hit layer sits above the map so the stroke can cross other centroids instead of selecting them. Click Brush again to pick a different region.

**Why.** Painting over driveway (and other) centroids was inconsistent: those markers stole mousedown and dropped a trail of pin-like circles instead of growing the region.

**Files.** `nearmap-review.html` (v1.3.6-local), `docs/NEARMAP_CONTRACT.md`, `docs/NEARMAP_RUNBOOK.md`

**How it was checked.** `node --check` on the extracted script; getElementById vs ids; no onclick; brace balance. Not pushed to Pages. Not fully re-verified by painting Columbia St Driveway in the browser in this pass.

**Status.** Local reviewer only.

## 2026-09-08 — Brush expands one region, does not drop stamp pins

**What.** Brush paint is a preview line only. On mouseup, the selected region becomes one polygon (hull of that region + same-class scraps the stroke touches + the stroke). Stamp circles are no longer written as extra rings, so the stroke does not become a trail of centroids.

**Why.** Painting a Driveway region left dozens of white circles along the path.

**Files.** `nearmap-review.html` (v1.3.5-local)

**How it was checked.** `node --check`. Not pushed to Pages.

**Status.** Local reviewer only. Click Revert regions once if a previous stroke already wrote those circles.

## 2026-09-08 — Brush: AI driveway centroids are clickable

**What.** The 16 Driveway (and other class) centroid markers were `clickable: false`, so a Brush click never selected them. In Brush they are clickable, larger, and `mousedown` is stopped. Polygons are clickable too. Map click also picks the nearest visible centroid.

**Why.** Jonah’s “16 driveway pins” are vendor centroids, not catalog pins.

**Files.** `nearmap-review.html` (v1.3.4-local)

**How it was checked.** `node --check`. Not pushed to Pages.

**Status.** Local reviewer only.

## 2026-09-08 — Brush: map does not pan while picking a pin

**What.** Brush mode sets `draggable: false` / `gestureHandling: none` immediately, not after a pin is chosen. Pin markers stop mousedown so the map cannot steal the click. Pin hit radius is ~28 px.

**Why.** Clicking a pin panned the view instead of selecting it for the brush.

**Files.** `nearmap-review.html` (v1.3.3-local)

**How it was checked.** `node --check`. Not pushed to Pages.

**Status.** Local reviewer only.

## 2026-09-08 — Brush: pick a pin, small stroke, merge what it touches

**What.** Brush is no longer a 10 m class-wide convex hull. Click Brush, click a catalog pin (or a visible region), the cursor takes that region's color, then paint a small zoom-scaled stroke (~12 px). Same-class regions that touch or sit inside the stroke merge into the selected region. No Commit button. Pin centroid updates; out-of-bounds centroids are refused, not clamped.

**Why.** The old brush grabbed too much and could not expand a pin accurately.

**Files.** `nearmap-review.html` (v1.3.2-local), `docs/NEARMAP_CONTRACT.md`

**How it was checked.** `node --check` on extracted script; getElementById vs ids. Not pushed to Pages.

**Status.** Local reviewer only.

## 2026-09-08 — Columbia St API pull packed and promoted

**What.** Packed `nearmap-probe/phase3b` (410 SW Columbia St, Bend OR 97702, survey 2026-07-02) into the same canonical/serve tree as Macalpine. Promoted serving subset to `s3://property-intel-tiles/nearmap/410-sw-columbia-st-bend-or-97702/` and merged `reference/nearmap.json`. `site_no` left blank. Did not write GitHub `data/`. Did not copy `transactionToken`.

**Why.** Second trial property, same reviewer surface as Jones/Macalpine.

**Files.** `tools/nearmap/pack_tx_folder.py`, `docs/NEARMAP_RUNBOOK.md`

**How it was checked.** `py_compile` pack_tx_folder; promote PUT+HEAD + CloudFront invalidate; live Pages `nearmap-review.html?delivery=410-sw-columbia-st-bend-or-97702` loaded nadir + 17 AI classes.

**Status.** Tiles + registry. `site_no` blank. Do not push reviewer HTML. Do not guess Site No.

## 2026-09-08 — regions.json original vs edits

**What.** Vendor polygons are `ai/original/regions.json` (immutable). Merge, accept-remove, draw, and pin-delete write `ai/edits/regions.json`. Revert copies original over edits. Reviewer loads edits, then original, then `features.json`. Local PUT only via `tools/nearmap/review_server.py`. `promote.py` skips `ai/edits/`. Re-normalize overwrites original and does not clobber existing edits.

**Why.** Reviewers need a working region file they can merge/remove, and a vendor snapshot they can always restore.

**Files.** `tools/nearmap/normalize.py`, `tools/nearmap/seed_regions.py`, `tools/nearmap/review_server.py`, `tools/nearmap/promote.py`, `nearmap-review.html` (v1.3.1-local), `apps scripts/nearmap.gs`, `docs/NEARMAP_CONTRACT.md`

**How it was checked.** `py_compile` on normalize/seed/review_server; seed Macalpine original+edits; `node --check` on extracted review script. Not verified: PUT against a running review_server until 8899 is that process; CloudFront original until re-promote.

**Status.** Local only. Do not push reviewer HTML. Do not promote edits.

## 2026-09-08 — Local reviewer: accept / brush / draw (not on Pages)

**What.** Reviewer-first elements in `nearmap-review.html` v1.3.0-local: Accept AI polygon, brush-merge a class (convex hull of hit scraps + stamps), draw missing (click vertices + Close shape; Maps DrawingManager is gone as of JS API 3.65). Pins at centroids. `drawn` FeatureCollection + `elements` persist to localStorage always, and to the Nearmap sheet when `site_no=` and Apps Script are deployed. `NM_COL_DRAWN` = W. `NM_MAX_PINS` = 20. Pass 1 menu items removed.

**Why.** Vendor AI fragments (e.g. 15 asphalt scraps) and missing classes (tennis court #144) need a human first round.

**Files.** `nearmap-review.html`, `apps scripts/config.gs`, `apps scripts/nearmap.gs`, `apps scripts/menu.gs`, `docs/NEARMAP_CONTRACT.md`

**How it was checked.** `node --check` + ids. Local URL only. Not pushed to Pages.

**Status.** Test on localhost:8899. Paste Apps Script replace-in-place for sheet save. Do not push HTML until Jonah says complete.

## 2026-09-08 — Review v1.2.1: map-first boot, lazy AI polygons

**What.** Map + nadir overlay start as soon as the serving manifest is in. Apps Script and the pin catalog load in parallel afterward (sheet fetch aborts at 4s). Class list comes from `hints.json`. `features.json` (~3.4MB) is fetched only when a layer is checked. Layers start unchecked. Maps init works if the JS API is already on the page. No accept/brush/draw.

**Why.** Live v1.2.0 waited on Apps Script then parsed 1,555 polygons before the map appeared; reloads sometimes never called `initMap`.

**Files.** `nearmap-review.html` (v1.2.1), `docs/NEARMAP_CHANGELOG.md`

**How it was checked.** `node --check` on extracted module; getElementById vs ids. Not verified in this commit: live Pages after push.

**Status.** Overlay-viewer load-fix only. Reviewer tools stay local/unpushed.

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
