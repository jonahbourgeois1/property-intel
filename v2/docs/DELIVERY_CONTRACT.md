# Capture Delivery Contract — Plane Imagery Pipeline

**Stage:** 1 — Ingest
**Audience:** Flight operators (capture delivery) and data-prep operators
**Status:** v1.2 — aligned with `ingest_capture.py` as implemented and
production-tested against `Bend 5-21-26` and `Bend 5-21-26 Run 3`.
v1.0 → v1.1 changes: single-storage layout (big binaries stored once under
`processed/`), tile generation sourced from `result.tif` (not z19 upscale),
final manifest schema.
v1.1 → v1.2 changes (single-source pyramid): the **entire serving pyramid
(z12–z21) is generated from `result.tif`** so every zoom level has a
consistent footprint. Terra's native `map/` tiles are **QA/reference only**
and are never uploaded to ingest or serving — they are used by the pyramid
validation gate and for visual spot-checks, nothing else.

---

## What a capture delivery is

One capture = one DJI Terra output folder, delivered as-is (folder or zip).
Folder name = capture display name (e.g. `Bend 5-21-26 Run 3`). The ingest
operator assigns the canonical capture ID: lowercase letters/digits/hyphens,
date-preserving (e.g. `bend-5-21-26-run3`).

## Required contents (hard-fail if missing/empty)

| Path in delivery | Purpose |
|---|---|
| `map/{z}/{x}/{y}.png` | Native 2D tile pyramid — **QA/reference only, never uploaded** (validates delivery integrity; visual spot-checks) |
| `map/result.tif` + `.tfw` + `.prj` | Full-resolution georeferenced orthomosaic — **the source for generated z20/z21** |
| `models/pc/0/terra_obj/BlockR/BlockR.obj` + `.mtl` + textures | Whole-capture textured mesh (every MTL texture reference must resolve) |
| `models/pc/0/terra_obj/metadata.xml` | `SRS` + `SRSOrigin` — deterministic ECEF transform source |
| `AT/sfm_geo_desc.json` | Reference GPS — cross-validates the transform |

**Optional, staged if present:** `models/pc/0/terra_b3dms/` (fallback
transform source, future Cesium use), `AT/report/`, `map/report/`
(QA; promotion reads `map_report.json` for gsd/area).

**Never uploaded:** `.history/`, `dumps/`, `images/`, `models/pc/0/.temp/`,
`terra_ply/`, `modify/` — Terra working data, most of the delivery's bulk.

## Validation gates (fail-fast, in order)

1. **structure** — required files exist, non-empty; MTL texture references
   all resolve. Catches truncated transfers.
2. **pyramid** — contiguous integer zoom levels, every zoom has tiles;
   records max native zoom and per-zoom counts.
3. **georeference** — `SRSOrigin` converted to WGS84 must match
   `sfm_geo_desc.json → ref_GPS` within ≤1 m horizontal / ≤2 m vertical.
   (Terra derives both from the same value; observed deltas are 0.0.)
   Mismatch = corrupted or inconsistent delivery = hard fail.
4. **transform** — column-major 4×4 ENU→ECEF matrix (3D Tiles convention)
   derived from `SRSOrigin`; method recorded (`metadata_xml`, or
   `tileset_recovery` fallback). Validated against v1's independently
   recovered transform to floating-point precision.
5. **extents** — per-zoom tile ranges **measured from disk** (never
   predicted by formula); WGS84 bounds from tile edges at max native zoom,
   provenance recorded in the field name.

## Generation

The **full serving pyramid (z12–z21)** is sliced directly from `result.tif`
via a tile-grid-snapped UTM→WebMercator warp (LANCZOS). The orthomosaic
(~16 cm GSD) out-resolves Terra's native z19 pyramid (~21.5 cm/px), and
sourcing every zoom from the same TIF guarantees a consistent per-zoom
footprint — the native tiles' coverage varied between zooms. Native tiles
are used only by the pyramid validation gate and for QA comparison; they
are never uploaded. Coverage follows the TIF footprint; fully transparent
tiles are skipped, so tile counts and extents describe imagery, not grid.
Resumable: existing outputs are never regenerated.

## S3 layout — `property-intel-ingest` (single-storage: nothing stored twice)

```
captures/{capture-id}/
  raw/
    map/result.tif|.tfw|.prj            ← ortho + georeference
    map/report/…  AT/report/…           ← QA, read at promotion
    models/pc/0/terra_obj/metadata.xml  ← transform source
    models/pc/0/terra_b3dms/…           ← fallback transform / Cesium
    AT/sfm_geo_desc.json
  processed/
    tiles/{z}/{x}/{y}.png               ← full generated pyramid z12–z21 (from result.tif; native tiles never uploaded)
    model/BlockR.obj|.mtl|textures      ← the only copy of the mesh package
  manifest.json                          ← uploaded LAST; presence in S3
                                           = upload complete
```

## `manifest.json` — Stage-1 output contract (as implemented)

```json
{
  "manifest_version": 1,
  "capture_id": "…", "display_name": "…", "captured": "YYYY-MM-DD",
  "ingested_at": "ISO8601Z",
  "status": "ready_for_review | failed",
  "tiles": {
    "native_max_zoom": 19,
    "generated_zooms": [12, "…", 21],
    "generation_source": "map/result.tif (warped UTM->WebMercator, LANCZOS; full pyramid)",
    "tile_extents": { "12": {"x":[..],"y":[..]}, "…": "all generated zooms" },
    "tile_count_native": 0,
    "tile_count_generated": 0
  },
  "bounds_wgs84_tile_edges": { "west": 0, "east": 0, "north": 0, "south": 0 },
  "model": {
    "source_key": "captures/{id}/processed/model/BlockR.obj",
    "srs": "EPSG:32610", "srs_origin": [e, n, alt],
    "transform_ecef": [16 numbers, column-major],
    "transform_method": "metadata_xml | tileset_recovery",
    "geo_crosscheck_delta_m": { "horizontal": 0.0, "vertical": 0.0 }
  },
  "validation": { "structure": "pass", "pyramid": "pass",
                  "transform": "pass", "extents": "pass", "generate": "pass" },
  "warnings": [], "errors": []
}
```

## Gate to Stage 2

A capture is invisible to all downstream stages until the operator reviews
the manifest (see RUNBOOK step 4) and runs `promote_capture.py`, which
copies `processed/` into the serving bucket, merges the registry entry, and
invalidates CloudFront. Failed ingests never reach the ingest bucket at all
(`upload` refuses non-`ready_for_review` manifests).
