# Property Intel daily log

Evidence-only. Newest day at the top. This cloud checkout is public `jonahbourgeois1/property-intel` (v1). Completeness % omitted unless measured. Do not flatten catalog `role=`. Editor-save ≠ deploy. `data/*.json` is sync-owned. MOCKINGBIRD row 277 after a real `satellite.gs` deploy.

## 2026-08-27

Nothing shipped today on `origin/main`. Head remains `06c9714` (2026-08-26 16:31 -0500).

Log Bot cron `41611cd5-a0bb-11f1-b532-320a589b8025` at 2026-08-27T00:03:07Z, then follow-ups to wire the `file://` weekly page. v2 / OneDrive `docs/ops` is not mounted on this VM (`property-intel-v2` 404). `list-cloud-agents` listed only Log Bot runs. CHANGELOG/CONTEXT not in this clone.

### Shipped
None on 2026-08-27.

### Still open
- Vyanet Viewer hub **1.6.4** on `origin/cursor/vyanet-viewer-gate-home` (`161a860`) not merged; `main` hub **1.0.3**.
- Chat direction not visible in the Log Bot environment.

### Watchouts
- Apps Script editor-save is not a new deployment. `.gs` copies in git are not a deploy. No `satellite.gs` deploy evidence today.
- Public `data/*.json` is sync-owned.
- Catalog `role=` still present on all 256 pins after `06c9714`; do not flatten it.

## 2026-08-26

First write of this day into this `log.md` (8/26 Log Bot run `bc-45e4c56a` did not commit `docs/ops/`).

### Shipped
- `06c9714` "Update pins-catalog.json". Catalog `version` `2026-07-15` → `2026-08-26`; `pin_count` 239 → 256. Notes: pins 240–256 appended; `#30` Entry → Vehicle Entrance; `account_type` widened on `#30` / `#33` / `#127`. All 256 pins still have `role` (195 primary, 61 concern). Actions `33015751649` and Pages `33015750965` succeeded.
- Last Apps Script–style property sync remains `86e00ef` (2026-08-24 drone-test). No satellite/plane/responder-intel `data/` sync this day.

### Still open
- `161a860` "Ship Vyanet Viewer hub through 1.6.4: live tab, dashboard, and 3D cameras" on `cursor/vyanet-viewer-gate-home`, not on `main`.
- No GitHub pull requests listed on this repo.

### Watchouts
Standing rules above. No `satellite.gs` deploy evidence.

## 2026-08-25

Reconstructed from v1 git (this VM cannot read the original OneDrive 8/25 block). If your local `log.md` already has a fuller 8/25 section, keep that block and leave this one as the git evidence.

### Shipped
- `8662883` "Identify element-review critiques by site_no instead of address." `element-review.html` BUILD **v6.8.2**. Duplicate lots were rejected as ambiguous when the review link only carried addr; links now include `site_no`. Same commit added `apps scripts/*.gs` copies to the public repo — **file copy, not an Apps Script deployment**.
- `fb9a0f2` merge of `main`.

### Still open (that day)
- `d32bb4a` "Add gate and home shell to the Vyanet Viewer hub (1.1.1)" on `cursor/vyanet-viewer-gate-home`, not merged to `main` (later advanced to 1.6.4 on 8/26).

### Watchouts
`.gs` in git ≠ deployed. `data/*.json` is sync-owned.
