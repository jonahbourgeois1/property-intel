# Plane Capture Ingest — Operator Runbook

**Stage:** 1 (Ingest) · **Owner:** data-prep operator
**Tools:** `scripts/ingest_capture.py`, `scripts/promote_capture.py`,
`scripts/audit_serving.py` (verification)
**Prereqs (one-time):** Python 3.11+, `pip install pyproj pillow rasterio boto3`,
AWS CLI configured with credentials that can write `property-intel-ingest`
and `property-intel-tiles`.

The pipeline is: **validate locally → generate locally → upload to the ingest
bucket → human review → promote to serving.** Nothing downstream can see a
capture until the final promote step, so mistakes before that point cost
nothing.

---

## 1. Receive a delivery

A delivery is a DJI Terra output folder (see `DELIVERY_CONTRACT.md` for the
required structure). Place or unzip it anywhere local. Never edit its
contents — every step below treats it as read-only.

Choose the **capture ID**: lowercase letters/digits/hyphens, derived from the
folder name and flight date, e.g. `Bend 5-21-26 Run 3` → `bend-5-21-26-run3`.

## 2. Ingest (validate + generate + manifest)

```
python scripts/ingest_capture.py ingest "<delivery folder>" ^
       "<repo>\staging\<capture-id>" <capture-id> <YYYY-MM-DD>
```

This runs five gates and prints a PASS/FAIL report for each:

| Gate | What it proves |
|---|---|
| structure | Required files exist, non-empty, all MTL textures present |
| pyramid | Tile pyramid contiguous, every zoom populated |
| georeference+transform | Model placement derived; model and map agree on location (deltas ~0 m) |
| extents | Per-zoom tile ranges measured from disk; WGS84 bounds derived |
| generate | z20/z21 sliced from result.tif; extents of output measured |

**If any gate fails:** the run stops safely, a `manifest.json` with
`"status": "failed"` and the exact errors is still written, and nothing can
be uploaded. Fix the delivery (usually: incomplete transfer — re-copy it) and
re-run the same command. Generation is resumable; already-produced tiles are
skipped.

**If all gates pass:** the staging folder now holds `tiles/` (generated
zooms) and `manifest.json` with `"status": "ready_for_review"`.

Rough runtime: a few minutes per Highlands-sized capture; scales with area.

## 3. Upload to the ingest bucket

Always dry-run first and eyeball the plan:

```
python scripts/ingest_capture.py upload "<delivery>" "<staging>" <capture-id> dry
```

Check: file counts look plausible (thousands of tiles, a handful of model
files), the first key starts with `captures/<capture-id>/raw/`, the last key
is `captures/<capture-id>/manifest.json`. Then run it for real (drop `dry`).

- Progress prints every 500 files. Expect minutes to tens of minutes.
- **Interrupted or failed?** Re-run the identical command — completed objects
  are skipped automatically.
- **Verify completeness:** re-run once more; a clean state reports
  `uploaded: 0` with everything in `skipped_existing`.
- The command refuses to run at all unless the manifest says
  `ready_for_review`.

After a verified upload, the local `staging\<capture-id>` folder is safe to
delete — everything it held is in S3 and regenerable from the delivery.

## 4. Human review (the manual gate)

```
python scripts/promote_capture.py review <capture-id>
```

This fetches the manifest from S3 and prints it with a checklist. Confirm:

- [ ] all five validations `pass`, `errors` empty
- [ ] `bounds_wgs84_tile_edges` sits where the flight actually was (paste
      the lat/lon into any map to sanity-check)
- [ ] tile counts plausible for the flown area
- [ ] `geo_crosscheck_delta_m` at or near 0.0 / 0.0
- [ ] `transform_method` is `metadata_xml` (if it says `tileset_recovery`,
      escalate — the delivery's metadata.xml was unusable)

## 5. Promote to serving

```
python scripts/promote_capture.py promote <capture-id> dry
```

Review the plan (copy counts, the registry entry it will write), then run
without `dry`. Promotion: server-side copies `processed/` into
`property-intel-tiles` under `captures/plane/<capture-id>/`, merges the
capture's entry into `reference/captures.json` (backing up the old registry
first), and invalidates CloudFront. Only after this step do eligibility,
rendering, and the viewers see the capture.

**Expected output notes:** `stale_pruned` and orphan-prune lines during
ingest and promote are normal — they are cleanup of superseded tiles, not
errors.

## 6. Post-promote verification (required)

After promote reports `PROMOTED`, verify serving matches staging before
notifying anyone downstream:

```
python scripts/audit_serving.py "<repo>\staging\<capture-id>\tiles" <capture-id>
```

Required result: **`serving is byte-identical to staging`** with all three
discrepancy counts at 0. Any mismatch, missing, or stale count other than
zero means stop and investigate before the capture is treated as live.

Note on CloudFront: the invalidation takes a few minutes to complete. A 404
from the CDN immediately after promote is almost always edge-cache lag, not
a missing tile — the audit script reads S3 directly and is the ground
truth. (This step exists because you deleted staging in step 3 only *after*
verified upload; if staging is already gone, re-download of
`processed/tiles/` from the ingest bucket serves as the comparison source.)

## Troubleshooting quick reference

- **"missing required file"** → incomplete delivery; re-transfer from source.
- **georeference mismatch error** → delivery is internally inconsistent;
  do not force it through; get a fresh Terra export.
- **Upload dies repeatedly at the same file** → check the file opens locally;
  check AWS credentials haven't expired.
- **`upload` says manifest status is failed** → you skipped a failed ingest;
  go back to step 2.
- Every command is safe to re-run; no command ever modifies the delivery
  folder.
