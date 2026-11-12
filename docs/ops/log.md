# Property Intel daily log

Evidence-only. Newest day at the top. This cloud checkout is public `jonahbourgeois1/property-intel` (v1). Completeness % omitted unless measured. Do not flatten catalog `role=`. Editor-save ≠ deploy. `data/*.json` is sync-owned. MOCKINGBIRD row 277 after a real `satellite.gs` deploy.

## 2026-09-23

Head is `ea68046` (2026-09-22 14:15 -0500). Yesterday's 00:04 UTC log (draft PR **#28**, `cursor/property-intel-daily-log-95ee`, `af6ab11`) stopped at `8ea7c1d`. Seven commits landed after that cron: four late 9/21 evening (author-date 2026-09-21 19:21 through 20:30 -0500) plus three author-date 2026-09-22 Central commits. ISO week **2026-W39** now includes those ships.

Log Bot cron `41611cd5-a0bb-11f1-b532-320a589b8025` at 2026-09-23T00:04:52Z (`bc-2c1146c1`). Template still says v2/master; this clone is public v1. CHANGELOG/CONTEXT and `property-intel-v2` are not in this clone (`property-intel-v2` 404). `list-cloud-agents` listed this cron plus prior Log Bot runs (9/22 `bc-02c34e0f`, 9/21 `bc-c92fb2e8`, 9/20 `bc-a9f1f52b`, 9/19 `bc-442bbe46`, 9/18 `bc-b7ee273e`, 9/17 `bc-d9831f88`, 9/16 `bc-8b42d9e1`, 9/15 `bc-573716b9`, 9/14 `bc-701853c6`, 9/13 `bc-152d50fe`, 9/12 `bc-01255360`, 9/11 `bc-56175265`, 9/10 `bc-db7958ae`, 9/09 `bc-134f8307`, 9/08 `bc-bbc69d44`, 9/07 `bc-cd56ff85`, 9/06 `bc-34e087f8`, 9/05 `bc-5c01f7f0`, 9/04 `bc-7fb90f35`, 9/03 `bc-b1bc2328`, 9/02 `bc-7de4187d`, 9/01 `bc-76a61999`, 8/31 `bc-f631c354`, 8/30 `bc-eb481f27`, 8/29 `bc-8dc1a78f`, 8/28 `bc-ede78703`, 8/27 `bc-d4995744`, 8/26 `bc-45e4c56a`) and three internal agents ("Search 8/28 transcript for dashboard", "Find original ops dashboard schema", "Summarize yesterday log bot"). Desktop/web/local sources returned 0.

### Shipped
- `cbed444` Place Vyanet Bend's four office cameras on the two metal roofs. Re-added `data/cameras/json/744a3639…` (cameras/json **12 → 13**; same file `d3572b3` had deleted earlier on 9/21). Hub stays **1.8.40**. Also `docs/INDEX_AND_CAMERAS_CONTRACT.md`. No `.gs`. Author-date 2026-09-21 19:21 -0500. Co-authored-by Cursor.
- `376c5b1` Draw the Butler Residence outline around the house and the dirt lot. Updates existing `data/drone-test/85b8ae1f…` (drone-test count stays 13). Copy `apps scripts/drone-test.gs` keeps a stored `parcel_ring` on full sync — not a deploy. Hub stays **1.8.40**. Author-date 2026-09-21 19:33 -0500. Co-authored-by Cursor.
- `2bce446` PPS home image uses the drone-sheet overhead; move Sutherlin camera 1 onto the roof. Hub **1.8.40 → 1.8.41**. Edits existing `data/cameras/json/f34caa15…` (cameras/json stays 13). `property.js`, `live-viewer.html` (BUILD stays **1.1.11**), `model-viewer.html`, `vyanet-viewer.html`. `viewer.html` VERSION stays **v2.10.19**. Author-date 2026-09-21 20:05 -0500. Co-authored-by Cursor.
- `132652d` 2D lot lines fall back to the CloudFront county layers; drone-sheet hero for Bend, Roseburg, Myrtle Creek. Hub **1.8.41 → 1.8.42**. `viewer.html` **v2.10.19 → v2.10.20**. Also `property.js`, `live-viewer.html` (BUILD stays **1.1.11**), `model-viewer.html`, `vyanet-viewer.html`. No `.gs`. Author-date 2026-09-21 20:30 -0500. Co-authored-by Cursor.
- `41f31e4` Delete `data/drone/35ba5fb3…`. drone **134 → 133**. Sync-owned delete. Author-date 2026-09-22 13:18 -0500.
- `a06c776` Publish Responder Intel — 91 properties — 9/22/2026, 1:19:49 PM. Empty tree (same as parent `41f31e4`; no file delta). Author-date 2026-09-22 13:19 -0500.
- `ea68046` Delete `data/responder-drone/35ba5fb3…`. responder-drone **137 → 136**. HEAD. Author-date 2026-09-22 14:15 -0500.

Element-review remains **v6.8.20**. Golf remains **v1.0.4**. Nearmap review stays **v1.7.18**; viewer stays **v1.1.16**. live-viewer BUILD stays **1.1.11**. Hub is now **1.8.42**. `viewer.html` is **v2.10.20**. `data/nearmap/` still one published JSON (`542bd09`). No satellite/plane Sync/Publish. No `satellite.gs` copy. Recount after these ships: satellite 506, plane 22, drone 133, drone-test 13, Lane 332 tiles, gis 3, hoa 5, responder-drone 136, nearmap 1, cameras/json 13, pins 13.

### Still open
- Chat direction still not visible in the Log Bot environment (`list-cloud-agents` desktop/web/local sources returned 0).
- Daily log PRs **#1** (`ops: daily log 2026-08-27`), **#3** (`ops: daily log 2026-08-28`), **#4** (`ops: daily log 2026-08-29`), **#5** (`ops: daily log 2026-08-30`), **#6** (`ops: daily log 2026-08-31`), **#7** (`ops: daily log 2026-09-01`), **#8** (`ops: daily log 2026-09-02`), **#9** (`ops: daily log 2026-09-03`), **#10** (`ops: daily log 2026-09-04`), **#11** (`ops: daily log 2026-09-05`), **#12** (`ops: daily log 2026-09-06`), **#13** (`ops: daily log 2026-09-07`), **#14** (`ops: daily log 2026-09-08`), **#15** (`ops: daily log 2026-09-09`), **#16** (`ops: daily log 2026-09-10`), **#17** (`ops: daily log 2026-09-11`), **#18** (`ops: daily log 2026-09-12`), **#19** (`ops: daily log 2026-09-13`), **#20** (`ops: daily log 2026-09-14`), **#21** (`ops: daily log 2026-09-15`), **#22** (`ops: daily log 2026-09-16`), **#23** (`ops: daily log 2026-09-17`), **#24** (`ops: daily log 2026-09-18`), **#25** (`ops: daily log 2026-09-19`), **#26** (`ops: daily log 2026-09-20`), **#27** (`ops: daily log 2026-09-21`), and **#28** (`ops: daily log 2026-09-22`) are still DRAFT; `docs/ops/` is not on `main`.
- Nearmap `nearmap.gs` / `config.gs` copies are on `main`; paste + new deployment and S3 edits write (`checkS3EditsWrite`) are not evidenced in this clone. Published `data/nearmap/{id}.json` still one file (row 2). Today's `.gs` copy is `drone-test.gs` (`376c5b1`) — not a deploy. `nearmap.gs` last copy remains `07b62a1`.

### Watchouts
- Apps Script editor-save is not a new deployment. `.gs` copy today (`drone-test.gs` in `376c5b1`) is not a deploy. No `satellite.gs` deploy evidence; `satellite.gs` last copy remains `d688a65`; MOCKINGBIRD row 277 is the first check after a real deploy.
- Public `data/*.json` is sync-owned. Last Sync/Publish on `origin/main` is `a06c776` Publish Responder Intel (empty tree after `41f31e4` deleted one `data/drone/` record, drone **134 → 133**). `ea68046` deleted the matching `data/responder-drone/` record (responder-drone **137 → 136**). Cameras JSON is git files **12 → 13** after `cbed444` re-added `744a3639…`. `376c5b1` edited an existing drone-test record (count stays 13). Nearmap record unchanged after `542bd09`. Recount: satellite 506, plane 22, drone 133, drone-test 13, Lane 332 tiles, gis 3, hoa 5, responder-drone 136, nearmap 1, cameras/json 13, pins 13.
- Catalog `role=` still present on all 256 pins after `06c9714` (195 primary, 61 concern); do not flatten it. Golf catalog is a separate Golf Pins sheet (ids 1001+); the `golf.gs` header says never merge it into `pins-catalog.json`.

## 2026-09-22

No author-date 2026-09-22 Central commits on `origin/main`. Head is `8ea7c1d` (2026-09-21 19:00 -0500 / 2026-09-22 00:00:26Z). Yesterday's 00:04 UTC log (draft PR **#27**, `cursor/property-intel-daily-log-f4e9`, `ab878b5`) stopped at `ba89172` and recorded nothing shipped on 9/21; the seventeen commits below landed after that cron (author-date 2026-09-21 14:52 through 19:00 -0500). ISO week **2026-W39** now has those ships.

Log Bot cron `41611cd5-a0bb-11f1-b532-320a589b8025` at 2026-09-22T00:04:47Z (`bc-02c34e0f`). Template still says v2/master; this clone is public v1. CHANGELOG/CONTEXT and `property-intel-v2` are not in this clone (`property-intel-v2` 404). `list-cloud-agents` listed this cron plus prior Log Bot runs (9/21 `bc-c92fb2e8`, 9/20 `bc-a9f1f52b`, 9/19 `bc-442bbe46`, 9/18 `bc-b7ee273e`, 9/17 `bc-d9831f88`, 9/16 `bc-8b42d9e1`, 9/15 `bc-573716b9`, 9/14 `bc-701853c6`, 9/13 `bc-152d50fe`, 9/12 `bc-01255360`, 9/11 `bc-56175265`, 9/10 `bc-db7958ae`, 9/09 `bc-134f8307`, 9/08 `bc-bbc69d44`, 9/07 `bc-cd56ff85`, 9/06 `bc-34e087f8`, 9/05 `bc-5c01f7f0`, 9/04 `bc-7fb90f35`, 9/03 `bc-b1bc2328`, 9/02 `bc-7de4187d`, 9/01 `bc-76a61999`, 8/31 `bc-f631c354`, 8/30 `bc-eb481f27`, 8/29 `bc-8dc1a78f`, 8/28 `bc-ede78703`, 8/27 `bc-d4995744`, 8/26 `bc-45e4c56a`) and three internal agents ("Search 8/28 transcript for dashboard", "Find original ops dashboard schema", "Summarize yesterday log bot"). Desktop/web/local sources returned 0.

### Shipped
- `2c32137` Let a drone-test row sync before analysis and open the Vyanet viewer from FR Link. Hub **1.8.31 → 1.8.33** (no 1.8.32 commit on main). `viewer.html` VERSION **v2.10.9 → v2.10.11** (no v2.10.10 commit on main). Copies `apps scripts/drone-test.gs`, `menu.gs`, `records.gs` — not a deploy. Also `js/vyanet-viewer/property.js`, `live-viewer.html` (BUILD stays **1.1.11**), `model-viewer.html`, `vyanet-viewer.html`. Author-date 2026-09-21 14:52 -0500. Co-authored-by Cursor.
- `e254022` Sync drone-test — 9/21/2026, 3:02:11 PM. Added ten `data/drone-test/{id}.json` (drone-test **3 → 13**) and updated matching `data/index/` hubs. Sync-owned. Author-date 2026-09-21 15:02 -0500.
- `8998986` Sync drone-test — 9/21/2026, 3:13:39 PM. Empty tree (no file delta). Author-date 2026-09-21 15:13 -0500.
- `d78a37d` Sync drone-test — 9/21/2026, 3:24:30 PM. Trimmed the new drone-test records and added thirteen `data/pins/{id}.json` (pins tree **0 → 13**). Sync-owned. Author-date 2026-09-21 15:24 -0500.
- `3032bb9` Point each hub at its CHEKT account so Live opens that site's cameras. Thirteen `data/index/{id}.json` updates. Sync-owned / git index edits. Author-date 2026-09-21 15:56 -0500.
- `f7cac10` Hide Nearmap on customer hub links. `live=1` drops the Nearmap button, hero, and lot cover. Hub **1.8.33 → 1.8.34**. `viewer.html` **v2.10.11 → v2.10.12**. Copies `drone-test.gs` / `menu.gs` / `records.gs` again — not a deploy. Also `property.js`, `nearmap-viewer.html`, `vyanet-viewer.html`. Author-date 2026-09-21 16:16 -0500. Co-authored-by Cursor.
- `ddfb80d` Sync drone-test — 9/21/2026, 4:23:01 PM. Twelve `data/index/{id}.json` flag refreshes. Sync-owned. Author-date 2026-09-21 16:23 -0500.
- `bc42ca2` Show the same Property Analysis and Drone sheet on the 2D and 3D rails. `viewer.html` **v2.10.12 → v2.10.13**. `model-viewer.html`. No `.gs`. Author-date 2026-09-21 16:36 -0500.
- `29a5a75` Merge `origin/main` into `live-nearmap-flag`. Merge of already-listed parents (`bc42ca2` + `ddfb80d`); no unique file delta beyond those ships. Author-date 2026-09-21 16:37 -0500.
- `7036412` Put the drone sheet in Property Analysis and drop the extra Drone tab. `viewer.html` **v2.10.13 → v2.10.14**. `model-viewer.html`. No `.gs`. Author-date 2026-09-21 16:51 -0500.
- `6b6cd86` Show each listed property's cameras as pins on its map. Hub **1.8.34 → 1.8.35**. Added ten `data/cameras/json/{id}.json` in this commit (one, `744a3639…`, was deleted later the same afternoon in `d3572b3`; cameras/json ends **3 → 12**). Also `property.js`, viewers, `docs/INDEX_AND_CAMERAS_CONTRACT.md`. Author-date 2026-09-21 17:20 -0500. Co-authored-by Cursor.
- `d3572b3` Keep Matt King's cameras off Vyanet Bend and put Butler's pins on the house. Hub **1.8.35 → 1.8.36**. `viewer.html` **v2.10.14 → v2.10.15**. Deleted the same-afternoon `data/cameras/json/744a3639…` file. Author-date 2026-09-21 17:49 -0500. Co-authored-by Cursor.
- `a339e87` Stop Vyanet Bend Live from opening the King residence cameras. Hub **1.8.36 → 1.8.37**. `viewer.html` **v2.10.15 → v2.10.16**. live-viewer BUILD stays **1.1.11**. Author-date 2026-09-21 17:57 -0500. Co-authored-by Cursor.
- `c5f4a69` Stop Vyanet Bend from opening the King residence on a view-id retry. Hub **1.8.37 → 1.8.38**. `viewer.html` **v2.10.16 → v2.10.17**. Author-date 2026-09-21 18:06 -0500. Co-authored-by Cursor.
- `b05a035` Send the property id on Live requests so Vyanet Bend opens its hardcoded CHEKT site. Hub **1.8.38 → 1.8.39**. `viewer.html` **v2.10.17 → v2.10.18**. Author-date 2026-09-21 18:43 -0500. Co-authored-by Cursor.
- `0f57c68` Hardcode each property's CHEKT site id on its index and keep site 4802 off Vyanet Bend. Hub **1.8.39 → 1.8.40**. `viewer.html` **v2.10.18 → v2.10.19**. Fifteen `data/index/{id}.json` site-id stamps. Author-date 2026-09-21 18:51 -0500. Co-authored-by Cursor.
- `8ea7c1d` Set Vyanet Bend's index to CHEKT site 8093, the Bend office. Hub stays **1.8.40**. HEAD. `data/index/744a3639…` + contract. Author-date 2026-09-21 19:00 -0500 (2026-09-22 00:00:26Z).

Element-review remains **v6.8.20**. Golf remains **v1.0.4**. Nearmap review stays **v1.7.18**; viewer stays **v1.1.16**. live-viewer BUILD stays **1.1.11** (touched, no bump). Hub is now **1.8.40**. `viewer.html` is **v2.10.19**. `data/nearmap/` still one published JSON (`542bd09`). No satellite/plane Sync/Publish. No `satellite.gs` copy. Recount after these ships: satellite 506, plane 22, drone 134, drone-test 13, Lane 332 tiles, gis 3, hoa 5, responder-drone 137, nearmap 1, cameras/json 12, pins 13.

### Still open
- Chat direction still not visible in the Log Bot environment (`list-cloud-agents` desktop/web/local sources returned 0).
- Daily log PRs **#1** (`ops: daily log 2026-08-27`), **#3** (`ops: daily log 2026-08-28`), **#4** (`ops: daily log 2026-08-29`), **#5** (`ops: daily log 2026-08-30`), **#6** (`ops: daily log 2026-08-31`), **#7** (`ops: daily log 2026-09-01`), **#8** (`ops: daily log 2026-09-02`), **#9** (`ops: daily log 2026-09-03`), **#10** (`ops: daily log 2026-09-04`), **#11** (`ops: daily log 2026-09-05`), **#12** (`ops: daily log 2026-09-06`), **#13** (`ops: daily log 2026-09-07`), **#14** (`ops: daily log 2026-09-08`), **#15** (`ops: daily log 2026-09-09`), **#16** (`ops: daily log 2026-09-10`), **#17** (`ops: daily log 2026-09-11`), **#18** (`ops: daily log 2026-09-12`), **#19** (`ops: daily log 2026-09-13`), **#20** (`ops: daily log 2026-09-14`), **#21** (`ops: daily log 2026-09-15`), **#22** (`ops: daily log 2026-09-16`), **#23** (`ops: daily log 2026-09-17`), **#24** (`ops: daily log 2026-09-18`), **#25** (`ops: daily log 2026-09-19`), **#26** (`ops: daily log 2026-09-20`), and **#27** (`ops: daily log 2026-09-21`) are still DRAFT; `docs/ops/` is not on `main`.
- Nearmap `nearmap.gs` / `config.gs` copies are on `main`; paste + new deployment and S3 edits write (`checkS3EditsWrite`) are not evidenced in this clone. Published `data/nearmap/{id}.json` still one file (row 2). Today's `.gs` copies are `drone-test.gs` / `menu.gs` / `records.gs` (`2c32137`, `f7cac10`) — not a deploy. `nearmap.gs` last copy remains `07b62a1`.

### Watchouts
- Apps Script editor-save is not a new deployment. `.gs` copies today (`drone-test.gs`, `menu.gs`, `records.gs` in `2c32137` and `f7cac10`) are not a deploy. No `satellite.gs` deploy evidence; `satellite.gs` last copy remains `d688a65`; MOCKINGBIRD row 277 is the first check after a real deploy.
- Public `data/*.json` is sync-owned. Last Sync/Publish on `origin/main` is `ddfb80d` Sync drone-test (after `e254022` wrote ten new drone-test records, `8998986` empty, `d78a37d` added thirteen `data/pins/` files). Cameras JSON files are git files (3→12 after `6b6cd86` adds and `d3572b3` deleted `744a3639…`). Index CHEKT site-id stamps in `3032bb9` / `0f57c68` / `8ea7c1d` are git edits of sync-owned hubs. Nearmap record unchanged after `542bd09`. Recount: satellite 506, plane 22, drone 134, drone-test 13, Lane 332 tiles, gis 3, hoa 5, responder-drone 137, nearmap 1, cameras/json 12, pins 13.
- Catalog `role=` still present on all 256 pins after `06c9714` (195 primary, 61 concern); do not flatten it. Golf catalog is a separate Golf Pins sheet (ids 1001+); the `golf.gs` header says never merge it into `pins-catalog.json`.

## 2026-09-21

Nothing shipped today on `origin/main`. Head remains `ba89172` (2026-09-17 11:46 -0500).

Yesterday's 00:17 UTC log (draft PR **#26**, `cursor/property-intel-daily-log-53e2`, `7336fff`) already recorded `origin/main` at `ba89172` and nothing shipped on 9/20. No author-date 2026-09-18, 2026-09-19, 2026-09-20, or 2026-09-21 commits on `origin/main`. The only git event after that log is `7336fff` `ops: daily log 2026-09-20` on draft PR **#26** — not on `main`. ISO week rolled to **2026-W39** (empty shipped; 9/14–9/17 ships stay in W38).

Log Bot cron `41611cd5-a0bb-11f1-b532-320a589b8025` at 2026-09-21T00:04:32Z (`bc-c92fb2e8`). Template still says v2/master; this clone is public v1. CHANGELOG/CONTEXT and `property-intel-v2` are not in this clone (`property-intel-v2` 404). `list-cloud-agents` listed this cron plus prior Log Bot runs (9/20 `bc-a9f1f52b`, 9/19 `bc-442bbe46`, 9/18 `bc-b7ee273e`, 9/17 `bc-d9831f88`, 9/16 `bc-8b42d9e1`, 9/15 `bc-573716b9`, 9/14 `bc-701853c6`, 9/13 `bc-152d50fe`, 9/12 `bc-01255360`, 9/11 `bc-56175265`, 9/10 `bc-db7958ae`, 9/09 `bc-134f8307`, 9/08 `bc-bbc69d44`, 9/07 `bc-cd56ff85`, 9/06 `bc-34e087f8`, 9/05 `bc-5c01f7f0`, 9/04 `bc-7fb90f35`, 9/03 `bc-b1bc2328`, 9/02 `bc-7de4187d`, 9/01 `bc-76a61999`, 8/31 `bc-f631c354`, 8/30 `bc-eb481f27`, 8/29 `bc-8dc1a78f`, 8/28 `bc-ede78703`, 8/27 `bc-d4995744`, 8/26 `bc-45e4c56a`) and three internal agents ("Search 8/28 transcript for dashboard", "Find original ops dashboard schema", "Summarize yesterday log bot"). Desktop/web/local sources returned 0.

### Shipped
None on 2026-09-21.

### Still open
- Chat direction still not visible in the Log Bot environment (`list-cloud-agents` desktop/web/local sources returned 0).
- Daily log PRs **#1** (`ops: daily log 2026-08-27`), **#3** (`ops: daily log 2026-08-28`), **#4** (`ops: daily log 2026-08-29`), **#5** (`ops: daily log 2026-08-30`), **#6** (`ops: daily log 2026-08-31`), **#7** (`ops: daily log 2026-09-01`), **#8** (`ops: daily log 2026-09-02`), **#9** (`ops: daily log 2026-09-03`), **#10** (`ops: daily log 2026-09-04`), **#11** (`ops: daily log 2026-09-05`), **#12** (`ops: daily log 2026-09-06`), **#13** (`ops: daily log 2026-09-07`), **#14** (`ops: daily log 2026-09-08`), **#15** (`ops: daily log 2026-09-09`), **#16** (`ops: daily log 2026-09-10`), **#17** (`ops: daily log 2026-09-11`), **#18** (`ops: daily log 2026-09-12`), **#19** (`ops: daily log 2026-09-13`), **#20** (`ops: daily log 2026-09-14`), **#21** (`ops: daily log 2026-09-15`), **#22** (`ops: daily log 2026-09-16`), **#23** (`ops: daily log 2026-09-17`), **#24** (`ops: daily log 2026-09-18`), **#25** (`ops: daily log 2026-09-19`), and **#26** (`ops: daily log 2026-09-20`) are still DRAFT; `docs/ops/` is not on `main`.
- Nearmap `nearmap.gs` / `config.gs` / `menu.gs` copies are on `main`; paste + new deployment and S3 edits write (`checkS3EditsWrite`) are not evidenced in this clone. Published `data/nearmap/{id}.json` still one file (row 2). `144cfec` added `drone-test.gs` / `records.gs` / `shared.gs` copies — not a deploy. No `.gs` / `data/` commits after `ba89172`. `f70f275` edited the existing cameras git file — not a Sync/Publish.

### Watchouts
- Apps Script editor-save is not a new deployment. No `.gs` copies and no `satellite.gs` deploy evidence today; `satellite.gs` last copy remains `d688a65`; MOCKINGBIRD row 277 is the first check after a real deploy.
- Public `data/*.json` is sync-owned. Last Sync/Publish on `origin/main` is `0c70e0e` Sync Drone (empty tree after `0bffe00` wrote six new drone records). `f70f275` is a git cameras-file edit (contract: cameras are git files; drone-test sync republishes as-is). Nearmap record unchanged after `542bd09`. Recount: satellite 506, plane 22, drone 134, drone-test 3, Lane 332 tiles, gis 3, hoa 5, responder-drone 137, nearmap 1, cameras/json 3.
- Catalog `role=` still present on all 256 pins after `06c9714` (195 primary, 61 concern); do not flatten it. Golf catalog is a separate Golf Pins sheet (ids 1001+); the `golf.gs` header says never merge it into `pins-catalog.json`.

## 2026-09-20

Nothing shipped today on `origin/main`. Head remains `ba89172` (2026-09-17 11:46 -0500).

Yesterday's 00:03 UTC log (draft PR **#25**, `cursor/property-intel-daily-log-a141`, `a5c8369`) already recorded `origin/main` at `ba89172` and nothing shipped on 9/19. No author-date 2026-09-18, 2026-09-19, or 2026-09-20 commits on `origin/main`. The only git event after that log is `a5c8369` `ops: daily log 2026-09-19` on draft PR **#25** — not on `main`. ISO week **2026-W38** ends today (ships from 9/14–9/17 still listed).

Log Bot cron `41611cd5-a0bb-11f1-b532-320a589b8025` at 2026-09-20T00:17:37Z (`bc-a9f1f52b`). Template still says v2/master; this clone is public v1. CHANGELOG/CONTEXT and `property-intel-v2` are not in this clone (`property-intel-v2` 404). `list-cloud-agents` listed this cron plus prior Log Bot runs (9/19 `bc-442bbe46`, 9/18 `bc-b7ee273e`, 9/17 `bc-d9831f88`, 9/16 `bc-8b42d9e1`, 9/15 `bc-573716b9`, 9/14 `bc-701853c6`, 9/13 `bc-152d50fe`, 9/12 `bc-01255360`, 9/11 `bc-56175265`, 9/10 `bc-db7958ae`, 9/09 `bc-134f8307`, 9/08 `bc-bbc69d44`, 9/07 `bc-cd56ff85`, 9/06 `bc-34e087f8`, 9/05 `bc-5c01f7f0`, 9/04 `bc-7fb90f35`, 9/03 `bc-b1bc2328`, 9/02 `bc-7de4187d`, 9/01 `bc-76a61999`, 8/31 `bc-f631c354`, 8/30 `bc-eb481f27`, 8/29 `bc-8dc1a78f`, 8/28 `bc-ede78703`, 8/27 `bc-d4995744`, 8/26 `bc-45e4c56a`) and three internal agents ("Search 8/28 transcript for dashboard", "Find original ops dashboard schema", "Summarize yesterday log bot"). Desktop/web/local sources returned 0.

### Shipped
None on 2026-09-20.

### Still open
- Chat direction still not visible in the Log Bot environment (`list-cloud-agents` desktop/web/local sources returned 0).
- Daily log PRs **#1** (`ops: daily log 2026-08-27`), **#3** (`ops: daily log 2026-08-28`), **#4** (`ops: daily log 2026-08-29`), **#5** (`ops: daily log 2026-08-30`), **#6** (`ops: daily log 2026-08-31`), **#7** (`ops: daily log 2026-09-01`), **#8** (`ops: daily log 2026-09-02`), **#9** (`ops: daily log 2026-09-03`), **#10** (`ops: daily log 2026-09-04`), **#11** (`ops: daily log 2026-09-05`), **#12** (`ops: daily log 2026-09-06`), **#13** (`ops: daily log 2026-09-07`), **#14** (`ops: daily log 2026-09-08`), **#15** (`ops: daily log 2026-09-09`), **#16** (`ops: daily log 2026-09-10`), **#17** (`ops: daily log 2026-09-11`), **#18** (`ops: daily log 2026-09-12`), **#19** (`ops: daily log 2026-09-13`), **#20** (`ops: daily log 2026-09-14`), **#21** (`ops: daily log 2026-09-15`), **#22** (`ops: daily log 2026-09-16`), **#23** (`ops: daily log 2026-09-17`), **#24** (`ops: daily log 2026-09-18`), and **#25** (`ops: daily log 2026-09-19`) are still DRAFT; `docs/ops/` is not on `main`.
- Nearmap `nearmap.gs` / `config.gs` / `menu.gs` copies are on `main`; paste + new deployment and S3 edits write (`checkS3EditsWrite`) are not evidenced in this clone. Published `data/nearmap/{id}.json` still one file (row 2). `144cfec` added `drone-test.gs` / `records.gs` / `shared.gs` copies — not a deploy. No `.gs` / `data/` commits after `ba89172`. `f70f275` edited the existing cameras git file — not a Sync/Publish.

### Watchouts
- Apps Script editor-save is not a new deployment. No `.gs` copies and no `satellite.gs` deploy evidence today; `satellite.gs` last copy remains `d688a65`; MOCKINGBIRD row 277 is the first check after a real deploy.
- Public `data/*.json` is sync-owned. Last Sync/Publish on `origin/main` is `0c70e0e` Sync Drone (empty tree after `0bffe00` wrote six new drone records). `f70f275` is a git cameras-file edit (contract: cameras are git files; drone-test sync republishes as-is). Nearmap record unchanged after `542bd09`. Recount: satellite 506, plane 22, drone 134, drone-test 3, Lane 332 tiles, gis 3, hoa 5, responder-drone 137, nearmap 1, cameras/json 3.
- Catalog `role=` still present on all 256 pins after `06c9714` (195 primary, 61 concern); do not flatten it. Golf catalog is a separate Golf Pins sheet (ids 1001+); the `golf.gs` header says never merge it into `pins-catalog.json`.

## 2026-09-19

Nothing shipped today on `origin/main`. Head remains `ba89172` (2026-09-17 11:46 -0500).

Yesterday's 00:04 UTC log (draft PR **#24**, `cursor/property-intel-daily-log-fcd5`, `e41042b`) already recorded `origin/main` at `ba89172` and the three live-camera ships after the 9/17 cron. No author-date 2026-09-18 or 2026-09-19 commits on `origin/main`. The only git event after that log is `e41042b` `ops: daily log 2026-09-18` on draft PR **#24** — not on `main`. ISO week remains **2026-W38** (ships from 9/14–9/17 still listed).

Log Bot cron `41611cd5-a0bb-11f1-b532-320a589b8025` at 2026-09-19T00:03:16Z (`bc-442bbe46`). Template still says v2/master; this clone is public v1. CHANGELOG/CONTEXT and `property-intel-v2` are not in this clone (`property-intel-v2` 404). `list-cloud-agents` listed this cron plus prior Log Bot runs (9/18 `bc-b7ee273e`, 9/17 `bc-d9831f88`, 9/16 `bc-8b42d9e1`, 9/15 `bc-573716b9`, 9/14 `bc-701853c6`, 9/13 `bc-152d50fe`, 9/12 `bc-01255360`, 9/11 `bc-56175265`, 9/10 `bc-db7958ae`, 9/09 `bc-134f8307`, 9/08 `bc-bbc69d44`, 9/07 `bc-cd56ff85`, 9/06 `bc-34e087f8`, 9/05 `bc-5c01f7f0`, 9/04 `bc-7fb90f35`, 9/03 `bc-b1bc2328`, 9/02 `bc-7de4187d`, 9/01 `bc-76a61999`, 8/31 `bc-f631c354`, 8/30 `bc-eb481f27`, 8/29 `bc-8dc1a78f`, 8/28 `bc-ede78703`, 8/27 `bc-d4995744`, 8/26 `bc-45e4c56a`) and three internal agents ("Search 8/28 transcript for dashboard", "Find original ops dashboard schema", "Summarize yesterday log bot"). Desktop/web/local sources returned 0.

### Shipped
None on 2026-09-19.

### Still open
- Chat direction still not visible in the Log Bot environment (`list-cloud-agents` desktop/web/local sources returned 0).
- Daily log PRs **#1** (`ops: daily log 2026-08-27`), **#3** (`ops: daily log 2026-08-28`), **#4** (`ops: daily log 2026-08-29`), **#5** (`ops: daily log 2026-08-30`), **#6** (`ops: daily log 2026-08-31`), **#7** (`ops: daily log 2026-09-01`), **#8** (`ops: daily log 2026-09-02`), **#9** (`ops: daily log 2026-09-03`), **#10** (`ops: daily log 2026-09-04`), **#11** (`ops: daily log 2026-09-05`), **#12** (`ops: daily log 2026-09-06`), **#13** (`ops: daily log 2026-09-07`), **#14** (`ops: daily log 2026-09-08`), **#15** (`ops: daily log 2026-09-09`), **#16** (`ops: daily log 2026-09-10`), **#17** (`ops: daily log 2026-09-11`), **#18** (`ops: daily log 2026-09-12`), **#19** (`ops: daily log 2026-09-13`), **#20** (`ops: daily log 2026-09-14`), **#21** (`ops: daily log 2026-09-15`), **#22** (`ops: daily log 2026-09-16`), **#23** (`ops: daily log 2026-09-17`), and **#24** (`ops: daily log 2026-09-18`) are still DRAFT; `docs/ops/` is not on `main`.
- Nearmap `nearmap.gs` / `config.gs` / `menu.gs` copies are on `main`; paste + new deployment and S3 edits write (`checkS3EditsWrite`) are not evidenced in this clone. Published `data/nearmap/{id}.json` still one file (row 2). `144cfec` added `drone-test.gs` / `records.gs` / `shared.gs` copies — not a deploy. No `.gs` / `data/` commits after `ba89172`. `f70f275` edited the existing cameras git file — not a Sync/Publish.

### Watchouts
- Apps Script editor-save is not a new deployment. No `.gs` copies and no `satellite.gs` deploy evidence today; `satellite.gs` last copy remains `d688a65`; MOCKINGBIRD row 277 is the first check after a real deploy.
- Public `data/*.json` is sync-owned. Last Sync/Publish on `origin/main` is `0c70e0e` Sync Drone (empty tree after `0bffe00` wrote six new drone records). `f70f275` is a git cameras-file edit (contract: cameras are git files; drone-test sync republishes as-is). Nearmap record unchanged after `542bd09`. Recount: satellite 506, plane 22, drone 134, drone-test 3, Lane 332 tiles, gis 3, hoa 5, responder-drone 137, nearmap 1, cameras/json 3.
- Catalog `role=` still present on all 256 pins after `06c9714` (195 primary, 61 concern); do not flatten it. Golf catalog is a separate Golf Pins sheet (ids 1001+); the `golf.gs` header says never merge it into `pins-catalog.json`.

## 2026-09-18

No author-date 2026-09-18 commits on `origin/main`. Head is `ba89172` (2026-09-17 11:46 -0500). Yesterday's 00:04 UTC log (draft PR **#23**, `cursor/property-intel-daily-log-cfe5`, `260cc6a`) stopped at `0c70e0e` and recorded nothing shipped on 9/17; the three commits below landed after that cron.

Log Bot cron `41611cd5-a0bb-11f1-b532-320a589b8025` at 2026-09-18T00:04:33Z (`bc-b7ee273e`). Template still says v2/master; this clone is public v1. CHANGELOG/CONTEXT and `property-intel-v2` are not in this clone (`property-intel-v2` 404). `list-cloud-agents` listed this cron plus prior Log Bot runs (9/17 `bc-d9831f88`, 9/16 `bc-8b42d9e1`, 9/15 `bc-573716b9`, 9/14 `bc-701853c6`, 9/13 `bc-152d50fe`, 9/12 `bc-01255360`, 9/11 `bc-56175265`, 9/10 `bc-db7958ae`, 9/09 `bc-134f8307`, 9/08 `bc-bbc69d44`, 9/07 `bc-cd56ff85`, 9/06 `bc-34e087f8`, 9/05 `bc-5c01f7f0`, 9/04 `bc-7fb90f35`, 9/03 `bc-b1bc2328`, 9/02 `bc-7de4187d`, 9/01 `bc-76a61999`, 8/31 `bc-f631c354`, 8/30 `bc-eb481f27`, 8/29 `bc-8dc1a78f`, 8/28 `bc-ede78703`, 8/27 `bc-d4995744`, 8/26 `bc-45e4c56a`) and three internal agents ("Search 8/28 transcript for dashboard", "Find original ops dashboard schema", "Summarize yesterday log bot"). Desktop/web/local sources returned 0.

### Shipped
- `f70f275` Place estimated Gud Cultures camera pins on the 2D/3D mappings from the nadir and live views. Updates existing `data/cameras/json/1512452d9e6e0f1cf0a32255a4392b12.json` (cameras/json count stays 3; 15 cameras, placement `estimated-nadir`; CHEKT `BLDG 3 *` labels follow live `BLDG 5 *`). Hub stays **1.8.25**. live-viewer stays **1.1.5**. Also `docs/INDEX_AND_CAMERAS_CONTRACT.md`. No `.gs`. Author-date 2026-09-17 09:43 -0500. Co-authored-by Cursor.
- `f2f9f2f` Start every live camera on All and show last-clip stills when CHEKT MJPEG never sends a frame. Hub **1.8.25 → 1.8.28** (no 1.8.26/1.8.27 commits on main). `live-viewer.html` BUILD **1.1.5 → 1.1.8** (no 1.1.6/1.1.7 commits on main). Also `js/vyanet-viewer/property.js`, `model-viewer.html`, `viewer.html`, `vyanet-viewer.html`, contract. No `.gs` / Sync/Publish. Author-date 2026-09-17 10:37 -0500. Co-authored-by Cursor.
- `ba89172` Fall back hung CHEKT MJPEG to snapshot JPEG polling so Parcel 3 shows current live stills. Hub **1.8.28 → 1.8.31** (no 1.8.29/1.8.30 commits on main). `live-viewer.html` BUILD **1.1.8 → 1.1.11** (no 1.1.9/1.1.10 commits on main). HEAD. Same viewer files + contract. No `.gs` / Sync/Publish. Author-date 2026-09-17 11:46 -0500. Co-authored-by Cursor.

Element-review remains **v6.8.20**. Golf remains **v1.0.4**. Nearmap review stays **v1.7.18**; viewer stays **v1.1.16**. Hub is now **1.8.31**. `data/nearmap/` still one published JSON (`542bd09`). No satellite/plane Sync/Publish. No `satellite.gs` copy.

### Still open
- Chat direction still not visible in the Log Bot environment (`list-cloud-agents` desktop/web/local sources returned 0).
- Daily log PRs **#1** (`ops: daily log 2026-08-27`), **#3** (`ops: daily log 2026-08-28`), **#4** (`ops: daily log 2026-08-29`), **#5** (`ops: daily log 2026-08-30`), **#6** (`ops: daily log 2026-08-31`), **#7** (`ops: daily log 2026-09-01`), **#8** (`ops: daily log 2026-09-02`), **#9** (`ops: daily log 2026-09-03`), **#10** (`ops: daily log 2026-09-04`), **#11** (`ops: daily log 2026-09-05`), **#12** (`ops: daily log 2026-09-06`), **#13** (`ops: daily log 2026-09-07`), **#14** (`ops: daily log 2026-09-08`), **#15** (`ops: daily log 2026-09-09`), **#16** (`ops: daily log 2026-09-10`), **#17** (`ops: daily log 2026-09-11`), **#18** (`ops: daily log 2026-09-12`), **#19** (`ops: daily log 2026-09-13`), **#20** (`ops: daily log 2026-09-14`), **#21** (`ops: daily log 2026-09-15`), **#22** (`ops: daily log 2026-09-16`), and **#23** (`ops: daily log 2026-09-17`) are still DRAFT; `docs/ops/` is not on `main`.
- Nearmap `nearmap.gs` / `config.gs` / `menu.gs` copies are on `main`; paste + new deployment and S3 edits write (`checkS3EditsWrite`) are not evidenced in this clone. Published `data/nearmap/{id}.json` still one file (row 2). `144cfec` added `drone-test.gs` / `records.gs` / `shared.gs` copies — not a deploy. No `.gs` copies after `0c70e0e`. `f70f275` edited the existing cameras git file — not a Sync/Publish.

### Watchouts
- Apps Script editor-save is not a new deployment. No `.gs` copies and no `satellite.gs` deploy evidence today; `satellite.gs` last copy remains `d688a65`; MOCKINGBIRD row 277 is the first check after a real deploy.
- Public `data/*.json` is sync-owned. Last Sync/Publish on `origin/main` is `0c70e0e` Sync Drone (empty tree after `0bffe00` wrote six new drone records). `f70f275` is a git cameras-file edit (contract: cameras are git files; drone-test sync republishes as-is). Nearmap record unchanged after `542bd09`. Recount: satellite 506, plane 22, drone 134, drone-test 3, Lane 332 tiles, gis 3, hoa 5, responder-drone 137, nearmap 1, cameras/json 3.
- Catalog `role=` still present on all 256 pins after `06c9714` (195 primary, 61 concern); do not flatten it. Golf catalog is a separate Golf Pins sheet (ids 1001+); the `golf.gs` header says never merge it into `pins-catalog.json`.

## 2026-09-17

Nothing shipped today on `origin/main`. Head remains `0c70e0e` (2026-09-15 19:11 -0500).

Yesterday's 00:20 UTC log (draft PR **#22**, `cursor/property-intel-daily-log-236f`, `a4ada5f`) already recorded `origin/main` at `0c70e0e` and the live-camera / drone / audit ships after the 9/15 cron. No author-date 2026-09-16 or 2026-09-17 commits on `origin/main`. The only git event after that log is `a4ada5f` `ops: daily log 2026-09-16` on draft PR **#22** — not on `main`. ISO week remains **2026-W38** (ships from 9/14–9/15 still listed).

Log Bot cron `41611cd5-a0bb-11f1-b532-320a589b8025` at 2026-09-17T00:01:48Z (`bc-d9831f88`). Template still says v2/master; this clone is public v1. CHANGELOG/CONTEXT and `property-intel-v2` are not in this clone (`property-intel-v2` 404). `list-cloud-agents` listed this cron plus prior Log Bot runs (9/16 `bc-8b42d9e1`, 9/15 `bc-573716b9`, 9/14 `bc-701853c6`, 9/13 `bc-152d50fe`, 9/12 `bc-01255360`, 9/11 `bc-56175265`, 9/10 `bc-db7958ae`, 9/09 `bc-134f8307`, 9/08 `bc-bbc69d44`, 9/07 `bc-cd56ff85`, 9/06 `bc-34e087f8`, 9/05 `bc-5c01f7f0`, 9/04 `bc-7fb90f35`, 9/03 `bc-b1bc2328`, 9/02 `bc-7de4187d`, 9/01 `bc-76a61999`, 8/31 `bc-f631c354`, 8/30 `bc-eb481f27`, 8/29 `bc-8dc1a78f`, 8/28 `bc-ede78703`, 8/27 `bc-d4995744`, 8/26 `bc-45e4c56a`) and three internal agents ("Search 8/28 transcript for dashboard", "Find original ops dashboard schema", "Summarize yesterday log bot"). Desktop/web/local sources returned 0.

### Shipped
None on 2026-09-17.

### Still open
- Chat direction still not visible in the Log Bot environment (`list-cloud-agents` desktop/web/local sources returned 0).
- Daily log PRs **#1** (`ops: daily log 2026-08-27`), **#3** (`ops: daily log 2026-08-28`), **#4** (`ops: daily log 2026-08-29`), **#5** (`ops: daily log 2026-08-30`), **#6** (`ops: daily log 2026-08-31`), **#7** (`ops: daily log 2026-09-01`), **#8** (`ops: daily log 2026-09-02`), **#9** (`ops: daily log 2026-09-03`), **#10** (`ops: daily log 2026-09-04`), **#11** (`ops: daily log 2026-09-05`), **#12** (`ops: daily log 2026-09-06`), **#13** (`ops: daily log 2026-09-07`), **#14** (`ops: daily log 2026-09-08`), **#15** (`ops: daily log 2026-09-09`), **#16** (`ops: daily log 2026-09-10`), **#17** (`ops: daily log 2026-09-11`), **#18** (`ops: daily log 2026-09-12`), **#19** (`ops: daily log 2026-09-13`), **#20** (`ops: daily log 2026-09-14`), **#21** (`ops: daily log 2026-09-15`), and **#22** (`ops: daily log 2026-09-16`) are still DRAFT; `docs/ops/` is not on `main`.
- Nearmap `nearmap.gs` / `config.gs` / `menu.gs` copies are on `main`; paste + new deployment and S3 edits write (`checkS3EditsWrite`) are not evidenced in this clone. Published `data/nearmap/{id}.json` still one file (row 2). `144cfec` added `drone-test.gs` / `records.gs` / `shared.gs` copies — not a deploy. No `.gs` / `data/` commits after `0c70e0e`.

### Watchouts
- Apps Script editor-save is not a new deployment. No `.gs` copies and no `satellite.gs` deploy evidence today; `satellite.gs` last copy remains `d688a65`; MOCKINGBIRD row 277 is the first check after a real deploy.
- Public `data/*.json` is sync-owned. Last Sync/Publish on `origin/main` is `0c70e0e` Sync Drone (empty tree after `0bffe00` wrote six new drone records). Nearmap record unchanged after `542bd09`. Recount: satellite 506, plane 22, drone 134, drone-test 3, Lane 332 tiles, gis 3, hoa 5, responder-drone 137, nearmap 1, cameras/json 3.
- Catalog `role=` still present on all 256 pins after `06c9714` (195 primary, 61 concern); do not flatten it. Golf catalog is a separate Golf Pins sheet (ids 1001+); the `golf.gs` header says never merge it into `pins-catalog.json`.

## 2026-09-16

No author-date 2026-09-16 commits on `origin/main`. Head is `0c70e0e` (2026-09-15 19:11 -0500). Yesterday's 00:08 UTC log (draft PR **#21**, `cursor/property-intel-daily-log-2fc1`, `c248db3`) stopped at `20cb487` and recorded the two Nearmap ships after the 9/14 cron; the commits below landed after that cron.

Log Bot cron `41611cd5-a0bb-11f1-b532-320a589b8025` at 2026-09-16T00:20:18Z (`bc-8b42d9e1`). Template still says v2/master; this clone is public v1. CHANGELOG/CONTEXT and `property-intel-v2` are not in this clone (`property-intel-v2` 404). `list-cloud-agents` listed this cron plus prior Log Bot runs (9/15 `bc-573716b9`, 9/14 `bc-701853c6`, 9/13 `bc-152d50fe`, 9/12 `bc-01255360`, 9/11 `bc-56175265`, 9/10 `bc-db7958ae`, 9/09 `bc-134f8307`, 9/08 `bc-bbc69d44`, 9/07 `bc-cd56ff85`, 9/06 `bc-34e087f8`, 9/05 `bc-5c01f7f0`, 9/04 `bc-7fb90f35`, 9/03 `bc-b1bc2328`, 9/02 `bc-7de4187d`, 9/01 `bc-76a61999`, 8/31 `bc-f631c354`, 8/30 `bc-eb481f27`, 8/29 `bc-8dc1a78f`, 8/28 `bc-ede78703`, 8/27 `bc-d4995744`, 8/26 `bc-45e4c56a`) and three internal agents ("Search 8/28 transcript for dashboard", "Find original ops dashboard schema", "Summarize yesterday log bot"). Desktop/web/local sources returned 0.

### Shipped
- `d61f2e1` Ship hub **1.8.22** live cameras: device_id wall, parcel filters, and click-to-expand. Adds `data/cameras/json/1512452d9e6e0f1cf0a32255a4392b12.json` (cameras/json 2→3). `live-viewer.html` BUILD **1.1.4**. Also `docs/INDEX_AND_CAMERAS_CONTRACT.md`, `model-viewer.html`, `viewer.html`. Author-date 2026-09-14 20:16 -0500. Co-authored-by Cursor.
- `144cfec` Publish Gud Cultures drone-test onto Pages so the hub 3D tab can load the GLB. Adds `data/drone-test/a8c17256f61e60b5521b372e4801852b.json` (drone-test 2→3). Same commit copied `apps scripts/drone-test.gs`, first `apps scripts/records.gs` (1984 lines), and `apps scripts/shared.gs` — **file copies, not a deploy**. Also `docs/RECORDS_CONTRACT.md`. Author-date 2026-09-14 20:50 -0500. Co-authored-by Cursor.
- `64602a1` Sync drone-test — three `data/index/{id}.json` updates. Author-date 2026-09-14 21:03 -0500. `jonahbourgeois1`.
- `08ae1bf` Start live MJPEG per parcel so Parcel 2 can connect; show CHEKT offline. Hub **1.8.22 → 1.8.23**. Author-date 2026-09-15 11:37 -0500. Co-authored-by Cursor.
- `096f1a6` Merge `main` (brings `64602a1` index files into the live-camera line). Not a product change.
- `f03adb6` Open Live on All and start every online CHEKT camera without a parcel click. Hub **1.8.23 → 1.8.24**. Author-date 2026-09-15 11:47 -0500. Co-authored-by Cursor.
- `b2785c3` Keep Live MJPEG bound when switching parcel tabs so feeds do not reconnect. Hub **1.8.24 → 1.8.25**. `live-viewer.html` BUILD **1.1.4 → 1.1.5**. HEAD hub. Author-date 2026-09-15 11:54 -0500. Co-authored-by Cursor.
- `c124c0e` Publish Responder Intel — 92 properties. Tree evidence: 5 existing `data/responder-drone/{id}.json` (6 line changes). Count stays 137. Author-date 2026-09-15 13:22 -0500. `jonahbourgeois1`.
- `9aa003d` docs/audit: data map of all 33 processes (redacted) + interactive bubble-map (`docs/audit/DATA_MAP.md` / `.html`, `build_html.py`). Author-date 2026-09-15 14:52 -0500. Co-authored-by Cursor.
- `f9f80ea` docs/audit: hand-off labels wrap to two lines, placed clear of bubbles. Author-date 2026-09-15 15:28 -0500. Co-authored-by Cursor.
- `9f46627` docs/audit: planned Nearmap-first pipeline map (12 processes, 29 hand-offs) + Current/Planned switch. Author-date 2026-09-15 16:00 -0500. Co-authored-by Cursor.
- `c65c8b1` docs/audit: hand-off brief for the 2026-09-16 intake groundwork session (`docs/audit/NEXT_SESSION_2026-09-16.md`). Author-date 2026-09-15 16:14 -0500. Co-authored-by Cursor.
- `160525a` Publish Responder Intel — 1 property. One `data/responder-drone/{id}.json` (1 line). Count stays 137. Author-date 2026-09-15 18:57 -0500. `jonahbourgeois1`.
- `0bffe00` Sync Drone. Six new `data/drone/{id}.json` (drone 128→134) plus six updates. Author-date 2026-09-15 19:01 -0500. `jonahbourgeois1`.
- `b932d36` + `0c70e0e` Publish Responder Intel — 1 property, then Sync Drone. Empty: same tree as `0bffe00`. HEAD.

Element-review remains **v6.8.20**. Golf remains **v1.0.4**. Nearmap review stays **v1.7.18**; viewer stays **v1.1.16**. Hub is now **1.8.25**. `data/nearmap/` still one published JSON (`542bd09`). No satellite/plane Sync/Publish. No `satellite.gs` copy.

### Still open
- Chat direction still not visible in the Log Bot environment (`list-cloud-agents` desktop/web/local sources returned 0).
- Daily log PRs **#1** (`ops: daily log 2026-08-27`), **#3** (`ops: daily log 2026-08-28`), **#4** (`ops: daily log 2026-08-29`), **#5** (`ops: daily log 2026-08-30`), **#6** (`ops: daily log 2026-08-31`), **#7** (`ops: daily log 2026-09-01`), **#8** (`ops: daily log 2026-09-02`), **#9** (`ops: daily log 2026-09-03`), **#10** (`ops: daily log 2026-09-04`), **#11** (`ops: daily log 2026-09-05`), **#12** (`ops: daily log 2026-09-06`), **#13** (`ops: daily log 2026-09-07`), **#14** (`ops: daily log 2026-09-08`), **#15** (`ops: daily log 2026-09-09`), **#16** (`ops: daily log 2026-09-10`), **#17** (`ops: daily log 2026-09-11`), **#18** (`ops: daily log 2026-09-12`), **#19** (`ops: daily log 2026-09-13`), **#20** (`ops: daily log 2026-09-14`), and **#21** (`ops: daily log 2026-09-15`) are still DRAFT; `docs/ops/` is not on `main`.
- Nearmap `nearmap.gs` / `config.gs` / `menu.gs` copies are on `main`; paste + new deployment and S3 edits write (`checkS3EditsWrite`) are not evidenced in this clone. Published `data/nearmap/{id}.json` still one file (row 2). `144cfec` added `drone-test.gs` / `records.gs` / `shared.gs` copies — not a deploy.

### Watchouts
- Apps Script editor-save is not a new deployment. `.gs` copies today (`drone-test.gs`, first `records.gs`, `shared.gs` in `144cfec`) are not a deploy. `satellite.gs` last copy remains `d688a65`; MOCKINGBIRD row 277 is the first check after a real deploy.
- Public `data/*.json` is sync-owned. Last Sync/Publish on `origin/main` is `0c70e0e` Sync Drone (empty tree after `0bffe00` wrote six new drone records). Nearmap record unchanged after `542bd09`. Recount: satellite 506, plane 22, drone 134, drone-test 3, Lane 332 tiles, gis 3, hoa 5, responder-drone 137, nearmap 1, cameras/json 3.
- Catalog `role=` still present on all 256 pins after `06c9714` (195 primary, 61 concern); do not flatten it. Golf catalog is a separate Golf Pins sheet (ids 1001+); the `golf.gs` header says never merge it into `pins-catalog.json`.

## 2026-09-15

No author-date 2026-09-15 commits on `origin/main`. Head is `20cb487` (2026-09-14 16:25 -0500). Yesterday's 00:02 UTC log (draft PR **#20**, `cursor/property-intel-daily-log-1576`, `169886c`) stopped at `04ba593` and recorded nothing shipped on 9/14; the two commits below landed after that cron.

Log Bot cron `41611cd5-a0bb-11f1-b532-320a589b8025` at 2026-09-15T00:08:11Z (`bc-573716b9`). Template still says v2/master; this clone is public v1. CHANGELOG/CONTEXT and `property-intel-v2` are not in this clone (`property-intel-v2` 404). `list-cloud-agents` listed this cron plus prior Log Bot runs (9/14 `bc-701853c6`, 9/13 `bc-152d50fe`, 9/12 `bc-01255360`, 9/11 `bc-56175265`, 9/10 `bc-db7958ae`, 9/09 `bc-134f8307`, 9/08 `bc-bbc69d44`, 9/07 `bc-cd56ff85`, 9/06 `bc-34e087f8`, 9/05 `bc-5c01f7f0`, 9/04 `bc-7fb90f35`, 9/03 `bc-b1bc2328`, 9/02 `bc-7de4187d`, 9/01 `bc-76a61999`, 8/31 `bc-f631c354`, 8/30 `bc-eb481f27`, 8/29 `bc-8dc1a78f`, 8/28 `bc-ede78703`, 8/27 `bc-d4995744`, 8/26 `bc-45e4c56a`) and three internal agents ("Search 8/28 transcript for dashboard", "Find original ops dashboard schema", "Summarize yesterday log bot"). Desktop/web/local sources returned 0.

### Shipped
- `5fddc0f` Restore Google satellite around the Nearmap review nadir. `nearmap-review.html` BUILD **v1.7.17 → v1.7.18**. Removes the v1.7.17 empty MapType so Google `satellite` tiles show around the opaque nadir JPEG (`tilt: 0`). Viewer stays **v1.1.13** in this commit. Hub stays **1.8.17**. Also `docs/NEARMAP_CHANGELOG.md` / contract / runbook. No `.gs` / `data/`. Author-date 2026-09-14 12:05 -0500. Co-authored-by Cursor.
- `20cb487` Serve Macalpine Fire Risk in the live Nearmap viewer. `nearmap-viewer.html` BUILD **v1.1.13 → v1.1.16** (no v1.1.14/v1.1.15 commits on main; `docs/NEARMAP_CHANGELOG.md` records v1.1.14 as a 2026-09-11 entry and v1.1.15 as local scratch in this same commit). Adds optional `ai/firerisk.json` on the Wildfire tab; `tools/nearmap/promote.py --files` / `--url` for sidecar-only uploads; `js/vyanet-viewer/nearmap-lot.js` parcel fetch uses the browser cache. Changelog says it did not write GitHub `data/` — confirmed: this commit touches no `data/` or `apps scripts/`. Author-date 2026-09-14 16:25 -0500. Co-authored-by Cursor.

Element-review remains **v6.8.20**. Golf remains **v1.0.4**. No satellite/plane/drone Sync/Publish. `data/nearmap/` still one published JSON (`542bd09`). Changelog also records operator AWS work (Ahartsi five + registry 7 deliveries; local scratch packs) — this clone cannot verify S3.

### Still open
- Chat direction still not visible in the Log Bot environment (`list-cloud-agents` desktop/web/local sources returned 0).
- Daily log PRs **#1** (`ops: daily log 2026-08-27`), **#3** (`ops: daily log 2026-08-28`), **#4** (`ops: daily log 2026-08-29`), **#5** (`ops: daily log 2026-08-30`), **#6** (`ops: daily log 2026-08-31`), **#7** (`ops: daily log 2026-09-01`), **#8** (`ops: daily log 2026-09-02`), **#9** (`ops: daily log 2026-09-03`), **#10** (`ops: daily log 2026-09-04`), **#11** (`ops: daily log 2026-09-05`), **#12** (`ops: daily log 2026-09-06`), **#13** (`ops: daily log 2026-09-07`), **#14** (`ops: daily log 2026-09-08`), **#15** (`ops: daily log 2026-09-09`), **#16** (`ops: daily log 2026-09-10`), **#17** (`ops: daily log 2026-09-11`), **#18** (`ops: daily log 2026-09-12`), **#19** (`ops: daily log 2026-09-13`), and **#20** (`ops: daily log 2026-09-14`) are still DRAFT; `docs/ops/` is not on `main`.
- Nearmap `nearmap.gs` / `config.gs` / `menu.gs` copies are on `main`; paste + new deployment and S3 edits write (`checkS3EditsWrite`) are not evidenced in this clone. Published `data/nearmap/{id}.json` still one file (row 2). `5fddc0f`/`20cb487` added no `.gs` / `data/` copy. Changelog says Sheet Import was not run from that machine and `NEARMAP_DELIVERY_HUB` still Macalpine → Jones and Columbia only — not verified here.

### Watchouts
- Apps Script editor-save is not a new deployment. No `.gs` copy in today's two commits. `satellite.gs` last copy remains `d688a65`; MOCKINGBIRD row 277 is the first check after a real deploy.
- Public `data/*.json` is sync-owned. Last Sync/Publish on `origin/main` is `2fcc1be` Publish Responder Intel — 1 property. Nearmap record unchanged after `542bd09`/`68961de`. No satellite/plane/drone `data/` sync. Recount: satellite 506, plane 22, drone 128, drone-test 2, Lane 332 tiles, gis 3, hoa 5, responder-drone 137, nearmap 1.
- Catalog `role=` still present on all 256 pins after `06c9714` (195 primary, 61 concern); do not flatten it. Golf catalog is a separate Golf Pins sheet (ids 1001+); the `golf.gs` header says never merge it into `pins-catalog.json`.

## 2026-09-14

Nothing shipped today on `origin/main`. Head remains `04ba593` (2026-09-11 15:39 -0500).

Yesterday's 00:19 UTC log (draft PR **#19**, `cursor/property-intel-daily-log-6eda`, `459ac33`) already recorded `origin/main` at `04ba593` and the three Nearmap review ships after the 9/12 cron. No author-date 2026-09-12, 2026-09-13, or 2026-09-14 commits on `origin/main`. The only git event after that log is `459ac33` `ops: daily log 2026-09-13` on draft PR **#19** — not on `main`. ISO week rolled to **2026-W38** (empty shipped).

Log Bot cron `41611cd5-a0bb-11f1-b532-320a589b8025` at 2026-09-14T00:00:44Z (`bc-701853c6`). Template still says v2/master; this clone is public v1. CHANGELOG/CONTEXT and `property-intel-v2` are not in this clone (`property-intel-v2` 404). `list-cloud-agents` listed this cron plus prior Log Bot runs (9/13 `bc-152d50fe`, 9/12 `bc-01255360`, 9/11 `bc-56175265`, 9/10 `bc-db7958ae`, 9/09 `bc-134f8307`, 9/08 `bc-bbc69d44`, 9/07 `bc-cd56ff85`, 9/06 `bc-34e087f8`, 9/05 `bc-5c01f7f0`, 9/04 `bc-7fb90f35`, 9/03 `bc-b1bc2328`, 9/02 `bc-7de4187d`, 9/01 `bc-76a61999`, 8/31 `bc-f631c354`, 8/30 `bc-eb481f27`, 8/29 `bc-8dc1a78f`, 8/28 `bc-ede78703`, 8/27 `bc-d4995744`, 8/26 `bc-45e4c56a`) and three internal agents ("Search 8/28 transcript for dashboard", "Find original ops dashboard schema", "Summarize yesterday log bot"). Desktop/web/local sources returned 0.

### Shipped
None on 2026-09-14.

### Still open
- Chat direction still not visible in the Log Bot environment (`list-cloud-agents` desktop/web/local sources returned 0).
- Daily log PRs **#1** (`ops: daily log 2026-08-27`), **#3** (`ops: daily log 2026-08-28`), **#4** (`ops: daily log 2026-08-29`), **#5** (`ops: daily log 2026-08-30`), **#6** (`ops: daily log 2026-08-31`), **#7** (`ops: daily log 2026-09-01`), **#8** (`ops: daily log 2026-09-02`), **#9** (`ops: daily log 2026-09-03`), **#10** (`ops: daily log 2026-09-04`), **#11** (`ops: daily log 2026-09-05`), **#12** (`ops: daily log 2026-09-06`), **#13** (`ops: daily log 2026-09-07`), **#14** (`ops: daily log 2026-09-08`), **#15** (`ops: daily log 2026-09-09`), **#16** (`ops: daily log 2026-09-10`), **#17** (`ops: daily log 2026-09-11`), **#18** (`ops: daily log 2026-09-12`), and **#19** (`ops: daily log 2026-09-13`) are still DRAFT; `docs/ops/` is not on `main`.
- Nearmap `nearmap.gs` / `config.gs` / `menu.gs` copies are on `main`; paste + new deployment and S3 edits write (`checkS3EditsWrite`) are not evidenced in this clone. Published `data/nearmap/{id}.json` still one file (row 2). No `.gs` / `data/` commits after `04ba593`.

### Watchouts
- Apps Script editor-save is not a new deployment. No `.gs` copies and no `satellite.gs` deploy evidence today; `satellite.gs` last copy remains `d688a65`; MOCKINGBIRD row 277 is the first check after a real deploy.
- Public `data/*.json` is sync-owned. Last Sync/Publish on `origin/main` is `2fcc1be` Publish Responder Intel — 1 property. Nearmap record unchanged after `542bd09`/`68961de`. No satellite/plane/drone `data/` sync. Recount: satellite 506, plane 22, drone 128, drone-test 2, Lane 332 tiles, gis 3, hoa 5, responder-drone 137, nearmap 1.
- Catalog `role=` still present on all 256 pins after `06c9714` (195 primary, 61 concern); do not flatten it. Golf catalog is a separate Golf Pins sheet (ids 1001+); the `golf.gs` header says never merge it into `pins-catalog.json`.

## 2026-09-13

No author-date 2026-09-12 or 2026-09-13 commits on `origin/main`. Head is `04ba593` (2026-09-11 15:39 -0500). Yesterday's 00:10 UTC log (draft PR **#18**, `cursor/property-intel-daily-log-fbce`, `4e61771`) stopped at `07b62a1` and recorded no author-date 2026-09-12 commits; the three commits below landed after that cron.

Log Bot cron `41611cd5-a0bb-11f1-b532-320a589b8025` at 2026-09-13T00:15:45Z (`bc-152d50fe`). Template still says v2/master; this clone is public v1. CHANGELOG/CONTEXT and `property-intel-v2` are not in this clone (`property-intel-v2` 404). `list-cloud-agents` listed this cron plus prior Log Bot runs (9/12 `bc-01255360`, 9/11 `bc-56175265`, 9/10 `bc-db7958ae`, 9/09 `bc-134f8307`, 9/08 `bc-bbc69d44`, 9/07 `bc-cd56ff85`, 9/06 `bc-34e087f8`, 9/05 `bc-5c01f7f0`, 9/04 `bc-7fb90f35`, 9/03 `bc-b1bc2328`, 9/02 `bc-7de4187d`, 9/01 `bc-76a61999`, 8/31 `bc-f631c354`, 8/30 `bc-eb481f27`, 8/29 `bc-8dc1a78f`, 8/28 `bc-ede78703`, 8/27 `bc-d4995744`, 8/26 `bc-45e4c56a`) and three internal agents ("Search 8/28 transcript for dashboard", "Find original ops dashboard schema", "Summarize yesterday log bot"). Desktop/web/local sources returned 0.

### Shipped
- `b9700af` Fix Nearmap review scroll and Draw brush pick. `nearmap-review.html` BUILD **v1.7.6 → v1.7.8** (no v1.7.7 commit on main). Changelog titles in this commit: pin-editor frame lock; region brush pick (no 10 m snap). Viewer stays **v1.1.13**. Hub stays **1.8.17**. No `.gs` / `data/`. Author-date 2026-09-11 12:25 -0500. Co-authored-by Cursor.
- `edcd836` Fix Nearmap Draw: filled grow, cursor, and overlay targeting. BUILD **v1.7.8 → v1.7.16** (no v1.7.9–v1.7.10 commits on main; `docs/NEARMAP_CHANGELOG.md` records v1.7.11–v1.7.16 in this same commit). Also `tools/nearmap/review_server.py`. Viewer stays **v1.1.13**. No `.gs` / `data/`. Author-date 2026-09-11 14:56 -0500. Co-authored-by Cursor.
- `04ba593` Speed up Nearmap review open by overlapping Maps, nadir, and original regions. BUILD **v1.7.16 → v1.7.17**. HEAD. Viewer stays **v1.1.13**. Hub stays **1.8.17**. No `.gs` / `data/`. Author-date 2026-09-11 15:39 -0500. Co-authored-by Cursor.

Element-review remains **v6.8.20**. Golf remains **v1.0.4**. No satellite/plane/drone Sync/Publish. `data/nearmap/` still one published JSON (`542bd09`).

### Still open
- Chat direction still not visible in the Log Bot environment (`list-cloud-agents` desktop/web/local sources returned 0).
- Daily log PRs **#1** (`ops: daily log 2026-08-27`), **#3** (`ops: daily log 2026-08-28`), **#4** (`ops: daily log 2026-08-29`), **#5** (`ops: daily log 2026-08-30`), **#6** (`ops: daily log 2026-08-31`), **#7** (`ops: daily log 2026-09-01`), **#8** (`ops: daily log 2026-09-02`), **#9** (`ops: daily log 2026-09-03`), **#10** (`ops: daily log 2026-09-04`), **#11** (`ops: daily log 2026-09-05`), **#12** (`ops: daily log 2026-09-06`), **#13** (`ops: daily log 2026-09-07`), **#14** (`ops: daily log 2026-09-08`), **#15** (`ops: daily log 2026-09-09`), **#16** (`ops: daily log 2026-09-10`), **#17** (`ops: daily log 2026-09-11`), and **#18** (`ops: daily log 2026-09-12`) are still DRAFT; `docs/ops/` is not on `main`.
- Nearmap `nearmap.gs` / `config.gs` / `menu.gs` copies are on `main`; paste + new deployment and S3 edits write (`checkS3EditsWrite`) are not evidenced in this clone. Published `data/nearmap/{id}.json` still one file (row 2). `b9700af`/`edcd836`/`04ba593` added no `.gs` copy.

### Watchouts
- Apps Script editor-save is not a new deployment. No `.gs` copy in today's three commits. `satellite.gs` last copy remains `d688a65`; MOCKINGBIRD row 277 is the first check after a real deploy.
- Public `data/*.json` is sync-owned. Last Sync/Publish on `origin/main` is `2fcc1be` Publish Responder Intel — 1 property. Nearmap record unchanged after `542bd09`/`68961de`. No satellite/plane/drone `data/` sync. Recount: satellite 506, plane 22, drone 128, drone-test 2, Lane 332 tiles, gis 3, hoa 5, responder-drone 137, nearmap 1.
- Catalog `role=` still present on all 256 pins after `06c9714` (195 primary, 61 concern); do not flatten it. Golf catalog is a separate Golf Pins sheet (ids 1001+); the `golf.gs` header says never merge it into `pins-catalog.json`.

## 2026-09-12

No author-date 2026-09-12 commits on `origin/main`. Head is `07b62a1` (2026-09-11 09:14 -0500). Yesterday's 00:02 UTC log (draft PR **#17**, `cursor/property-intel-daily-log-b231`, `a5ecf19`) stopped at `68961de` and recorded no author-date 2026-09-11 commits; the seven commits below landed after that cron.

Log Bot cron `41611cd5-a0bb-11f1-b532-320a589b8025` at 2026-09-12T00:10:18Z (`bc-01255360`). Template still says v2/master; this clone is public v1. CHANGELOG/CONTEXT and `property-intel-v2` are not in this clone (`property-intel-v2` 404). `list-cloud-agents` listed this cron plus prior Log Bot runs (9/11 `bc-56175265`, 9/10 `bc-db7958ae`, 9/09 `bc-134f8307`, 9/08 `bc-bbc69d44`, 9/07 `bc-cd56ff85`, 9/06 `bc-34e087f8`, 9/05 `bc-5c01f7f0`, 9/04 `bc-7fb90f35`, 9/03 `bc-b1bc2328`, 9/02 `bc-7de4187d`, 9/01 `bc-76a61999`, 8/31 `bc-f631c354`, 8/30 `bc-eb481f27`, 8/29 `bc-8dc1a78f`, 8/28 `bc-ede78703`, 8/27 `bc-d4995744`, 8/26 `bc-45e4c56a`) and three internal agents ("Search 8/28 transcript for dashboard", "Find original ops dashboard schema", "Summarize yesterday log bot"). Desktop/web/local sources returned 0.

### Shipped
- `6a6b387` `bca8b2b` `2b1ea3c` `5da7838` `97714e5` `2fcc1be` Publish Responder Intel — 1 property (six commits, 8:58–9:01 -0500). Each added one `data/responder-drone/{id}.json`. Recount 131 → 137. Sync-owned. `jonahbourgeois1`.
- `07b62a1` Show Nearmap Pass 3 FR/WF concern pins and descriptions on the product viewer. `nearmap-viewer.html` BUILD **v1.1.7 → v1.1.13** (no v1.1.8–v1.1.12 commits on main; `docs/NEARMAP_CHANGELOG.md` records those versions as 2026-09-10 entries in this same commit). Hub stays **1.8.17**. Review stays **v1.7.6**. Same commit copied `apps scripts/nearmap.gs` — **file copy, not a deploy**. Author-date 2026-09-11 09:14 -0500. Co-authored-by Cursor.

Element-review remains **v6.8.20**. Golf remains **v1.0.4**. No satellite/plane/drone Sync/Publish. `data/nearmap/` still one published JSON (`542bd09`).

### Still open
- Chat direction still not visible in the Log Bot environment (`list-cloud-agents` desktop/web/local sources returned 0).
- Daily log PRs **#1** (`ops: daily log 2026-08-27`), **#3** (`ops: daily log 2026-08-28`), **#4** (`ops: daily log 2026-08-29`), **#5** (`ops: daily log 2026-08-30`), **#6** (`ops: daily log 2026-08-31`), **#7** (`ops: daily log 2026-09-01`), **#8** (`ops: daily log 2026-09-02`), **#9** (`ops: daily log 2026-09-03`), **#10** (`ops: daily log 2026-09-04`), **#11** (`ops: daily log 2026-09-05`), **#12** (`ops: daily log 2026-09-06`), **#13** (`ops: daily log 2026-09-07`), **#14** (`ops: daily log 2026-09-08`), **#15** (`ops: daily log 2026-09-09`), **#16** (`ops: daily log 2026-09-10`), and **#17** (`ops: daily log 2026-09-11`) are still DRAFT; `docs/ops/` is not on `main`.
- Nearmap `nearmap.gs` / `config.gs` / `menu.gs` copies are on `main`; paste + new deployment and S3 edits write (`checkS3EditsWrite`) are not evidenced in this clone. Published `data/nearmap/{id}.json` still one file (row 2). `07b62a1` added another `nearmap.gs` copy — not a deploy.

### Watchouts
- Apps Script editor-save is not a new deployment. `.gs` copy today (`nearmap.gs` in `07b62a1`) is not a deploy. `satellite.gs` last copy remains `d688a65`; MOCKINGBIRD row 277 is the first check after a real deploy.
- Public `data/*.json` is sync-owned. Last Sync/Publish on `origin/main` is `2fcc1be` Publish Responder Intel — 1 property (six new `data/responder-drone/` files after `6a6b387`). Nearmap record unchanged after `542bd09`/`68961de`. No satellite/plane/drone `data/` sync. Recount: satellite 506, plane 22, drone 128, drone-test 2, Lane 332 tiles, gis 3, hoa 5, responder-drone 137, nearmap 1.
- Catalog `role=` still present on all 256 pins after `06c9714` (195 primary, 61 concern); do not flatten it. Golf catalog is a separate Golf Pins sheet (ids 1001+); the `golf.gs` header says never merge it into `pins-catalog.json`.

## 2026-09-11

No author-date 2026-09-11 commits on `origin/main`. Head is `68961de` (2026-09-10 14:28 -0500). Yesterday's 00:04 UTC log (draft PR **#16**, `cursor/property-intel-daily-log-6f76`, `0b25a4e`) stopped at `c925508` and recorded no author-date 2026-09-10 commits; the five commits below landed after that cron.

Log Bot cron `41611cd5-a0bb-11f1-b532-320a589b8025` at 2026-09-11T00:02:10Z (`bc-56175265`). Template still says v2/master; this clone is public v1. CHANGELOG/CONTEXT and `property-intel-v2` are not in this clone (`property-intel-v2` 404). `list-cloud-agents` listed this cron plus prior Log Bot runs (9/10 `bc-db7958ae`, 9/09 `bc-134f8307`, 9/08 `bc-bbc69d44`, 9/07 `bc-cd56ff85`, 9/06 `bc-34e087f8`, 9/05 `bc-5c01f7f0`, 9/04 `bc-7fb90f35`, 9/03 `bc-b1bc2328`, 9/02 `bc-7de4187d`, 9/01 `bc-76a61999`, 8/31 `bc-f631c354`, 8/30 `bc-eb481f27`, 8/29 `bc-8dc1a78f`, 8/28 `bc-ede78703`, 8/27 `bc-d4995744`, 8/26 `bc-45e4c56a`) and three internal agents ("Search 8/28 transcript for dashboard", "Find original ops dashboard schema", "Summarize yesterday log bot"). Desktop/web/local sources returned 0.

### Shipped
- `7dd6050` Clip Nearmap to the taxlot and keep observed facts when clip is off. `nearmap-viewer.html` BUILD **v1.1.2 → v1.1.5** (no v1.1.3/v1.1.4 commits on main). Hub **1.8.16 → 1.8.17**. Adds `js/vyanet-viewer/nearmap-lot.js`, `test-nearmap-lot.mjs`, and `tools/nearmap/lot_clip.py`. Review BUILD stays **v1.6.11**. Same commit copied `apps scripts/nearmap.gs` — **file copy, not a deploy**. Author-date 2026-09-10 10:56 -0500. Co-authored-by Cursor.
- `4937ac0` Pass 2 Nearmap pins use region class names; place and delete only on painted regions. `nearmap-review.html` BUILD **v1.6.11 → v1.7.6** (no v1.7.0–v1.7.5 commits on main). Viewer **v1.1.5 → v1.1.7**. Same commit copied `apps scripts/nearmap.gs` and `config.gs` (`NM_MAX_PINS = 20` is Pass 1 only; Pass 2 is uncapped) — **file copies, not a deploy**. Catalog `role=` untouched. Author-date 2026-09-10 13:23 -0500. Co-authored-by Cursor.
- `542bd09` Sync Nearmap — row 2. First published `data/nearmap/{id}.json` on `main` (`d9f759d7351db3886c79dd689c41e3c0`; 20 elements). Author-date 2026-09-10 14:01 -0500. `jonahbourgeois1`.
- `c32f8a8` + `68961de` Sync Nearmap — row 2 again (14:06 and 14:28 -0500). Empty: same tree as `542bd09`. HEAD.

Element-review remains **v6.8.20**. Golf remains **v1.0.4**. No satellite/plane/drone Sync/Publish.

### Still open
- Chat direction still not visible in the Log Bot environment (`list-cloud-agents` desktop/web/local sources returned 0).
- Daily log PRs **#1** (`ops: daily log 2026-08-27`), **#3** (`ops: daily log 2026-08-28`), **#4** (`ops: daily log 2026-08-29`), **#5** (`ops: daily log 2026-08-30`), **#6** (`ops: daily log 2026-08-31`), **#7** (`ops: daily log 2026-09-01`), **#8** (`ops: daily log 2026-09-02`), **#9** (`ops: daily log 2026-09-03`), **#10** (`ops: daily log 2026-09-04`), **#11** (`ops: daily log 2026-09-05`), **#12** (`ops: daily log 2026-09-06`), **#13** (`ops: daily log 2026-09-07`), **#14** (`ops: daily log 2026-09-08`), **#15** (`ops: daily log 2026-09-09`), and **#16** (`ops: daily log 2026-09-10`) are still DRAFT; `docs/ops/` is not on `main`.
- Nearmap `nearmap.gs` / `config.gs` / `menu.gs` copies are on `main`; paste + new deployment and S3 edits write (`checkS3EditsWrite`) are not evidenced in this clone. Published `data/nearmap/{id}.json` now exists (row 2, one file).

### Watchouts
- Apps Script editor-save is not a new deployment. `.gs` copies today (`nearmap.gs` in `7dd6050`/`4937ac0`, `config.gs` in `4937ac0`) are not a deploy. `satellite.gs` last copy remains `d688a65`; MOCKINGBIRD row 277 is the first check after a real deploy.
- Public `data/*.json` is sync-owned. Last Sync/Publish on `origin/main` is `68961de` Sync Nearmap — row 2 (empty tree after `542bd09` wrote the record). No satellite/plane/drone `data/` sync. Recount: satellite 506, plane 22, drone 128, drone-test 2, Lane 332 tiles, gis 3, hoa 5, responder-drone 131, nearmap 1.
- Catalog `role=` still present on all 256 pins after `06c9714` (195 primary, 61 concern); do not flatten it. Golf catalog is a separate Golf Pins sheet (ids 1001+); the `golf.gs` header says never merge it into `pins-catalog.json`.

## 2026-09-10

No author-date 2026-09-10 commits on `origin/main`. Head is `c925508` (2026-09-09 18:10 -0500). Yesterday's 00:04 UTC log (draft PR **#15**, `cursor/property-intel-daily-log-04fc`, `6382d09`) stopped at `949f6d6` and recorded nothing shipped on 9/09; the 28 commits below landed after that cron (one author-date 2026-09-08 that was not on `origin/main` at the 9/09 cron, then 27 author-date 2026-09-09).

Log Bot cron `41611cd5-a0bb-11f1-b532-320a589b8025` at 2026-09-10T00:04:11Z (`bc-db7958ae`). Template still says v2/master; this clone is public v1. CHANGELOG/CONTEXT and `property-intel-v2` are not in this clone (`property-intel-v2` 404). `list-cloud-agents` listed this cron plus prior Log Bot runs (9/09 `bc-134f8307`, 9/08 `bc-bbc69d44`, 9/07 `bc-cd56ff85`, 9/06 `bc-34e087f8`, 9/05 `bc-5c01f7f0`, 9/04 `bc-7fb90f35`, 9/03 `bc-b1bc2328`, 9/02 `bc-7de4187d`, 9/01 `bc-76a61999`, 8/31 `bc-f631c354`, 8/30 `bc-eb481f27`, 8/29 `bc-8dc1a78f`, 8/28 `bc-ede78703`, 8/27 `bc-d4995744`, 8/26 `bc-45e4c56a`) and three internal agents ("Search 8/28 transcript for dashboard", "Find original ops dashboard schema", "Summarize yesterday log bot"). Desktop/web/local sources returned 0.

### Shipped
- `f2c9c34` Show the Nearmap map before AI polygons so the review page opens reliably. `nearmap-review.html` BUILD **v1.2.1**. Author-date 2026-09-08 09:29 -0500. Not on `origin/main` at the 9/09 cron. Co-authored-by Cursor.
- `413b886` Draw-only paint/erase on vendor regions; original/edits folders; testing-mode default. BUILD **v1.3.29**. First `apps scripts/nearmap.gs` copy, `data/nearmap/.gitkeep`, and `tools/nearmap/*`. **File copy, not a deploy.** Author-date 2026-09-09 12:13 -0500.
- `3250ab7` Sheet mode on the original/edits folder format. BUILD **v1.4.0**.
- `83dcac7` Pin at the interior point of irregular shapes. BUILD **v1.4.1**.
- `8c8f5c5` Two editors on one page (regions / pins). BUILD **v1.5.0**. Also copied `menu.gs`.
- `dd7d539` Regions edits push via Contents API with real error text; single-flight Save. BUILD **v1.5.1**.
- `fed22d4` Save retries once on an Apps Script HTML error page. BUILD **v1.5.2**.
- `c5a0485` Copy JSON is mode-aware. BUILD **v1.5.3**.
- `786c251` + `926ba98` Nearmap regions — site VY-IN-002 (1 changed, 15 removed). Transient `data/nearmap/edits/` JSON; later removed.
- `c73442d` Regions edits go Apps Script → S3; GitHub out of the regions path. BUILD **v1.6.0**. Deletes `data/nearmap/edits/`.
- `caa39b5` Pin at the deepest interior point (max edge clearance). BUILD **v1.6.1**.
- `16ac486` … `54d0c8b` Hole geometry and gap-close (`v1.6.2`–`v1.6.11`). HEAD review BUILD **v1.6.11** (Revert changes vs Revert to original).
- `51dc3d5` Nearmap viewer **v1.0.0** (2D / 3D / obliques, AI layers in both) + `tools/nearmap/mesh_to_glb.py`. More `nearmap.gs` / `menu.gs` copies — **not a deploy**.
- `2d26d36` Viewer **v1.0.1**: 3D camera/controls match model-viewer.
- `ce346ce` Viewer **v1.0.2**: re-read regions on tab focus and Reload.
- `c45d69c` Viewer **v1.0.3**: 3D fills cap the whole footprint like 2D.
- `5e36083` Put Nearmap in the Vyanet hub with draped 3D fills. Hub **1.8.15**.
- `c925508` Open Nearmap full-page from the hub; drop Property Facts from that rail. Hub **1.8.16**; `nearmap-viewer.html` BUILD **v1.1.2**. HEAD.

Element-review remains **v6.8.20**. Golf remains **v1.0.4**. No Sync/Publish satellite/plane/drone commits. Viewer commits are Co-authored-by Cursor; the two VY-IN-002 regions commits are `jonahbourgeois1`.

### Still open
- Chat direction still not visible in the Log Bot environment (`list-cloud-agents` desktop/web/local sources returned 0).
- Daily log PRs **#1** (`ops: daily log 2026-08-27`), **#3** (`ops: daily log 2026-08-28`), **#4** (`ops: daily log 2026-08-29`), **#5** (`ops: daily log 2026-08-30`), **#6** (`ops: daily log 2026-08-31`), **#7** (`ops: daily log 2026-09-01`), **#8** (`ops: daily log 2026-09-02`), **#9** (`ops: daily log 2026-09-03`), **#10** (`ops: daily log 2026-09-04`), **#11** (`ops: daily log 2026-09-05`), **#12** (`ops: daily log 2026-09-06`), **#13** (`ops: daily log 2026-09-07`), **#14** (`ops: daily log 2026-09-08`), and **#15** (`ops: daily log 2026-09-09`) are still DRAFT; `docs/ops/` is not on `main`.
- Nearmap `nearmap.gs` / `menu.gs` copies are on `main`; paste + new deployment, S3 edits write (`checkS3EditsWrite`), and published `data/nearmap/{id}.json` are not evidenced in this clone.

### Watchouts
- Apps Script editor-save is not a new deployment. `.gs` copies today (`nearmap.gs`, `menu.gs`) are not a deploy. `satellite.gs` last copy remains `d688a65`; MOCKINGBIRD row 277 is the first check after a real deploy.
- Public `data/*.json` is sync-owned. Last Sync/Publish on `origin/main` is `187a608` Sync Drone (2026-08-28). Transient Nearmap edits JSON for VY-IN-002 was added then deleted in `c73442d` (S3-only). HEAD `data/nearmap/` is only `.gitkeep`. Recount: satellite 506, plane 22, drone 128, drone-test 2, Lane 332 tiles, gis 3.
- Catalog `role=` still present on all 256 pins after `06c9714` (195 primary, 61 concern); do not flatten it. Golf catalog is a separate Golf Pins sheet (ids 1001+); the `golf.gs` header says never merge it into `pins-catalog.json`.

## 2026-09-09

Nothing shipped today on `origin/main`. Head remains `949f6d6` (2026-09-07 12:29 -0500).

Log Bot cron `41611cd5-a0bb-11f1-b532-320a589b8025` at 2026-09-09T00:04:42Z (`bc-134f8307`). Yesterday's 00:03 UTC log (draft PR **#14**, `cursor/property-intel-daily-log-6e97`, `0921740`) already recorded `origin/main` at `949f6d6` and the two Nearmap ships after the 9/07 cron. No author-date 2026-09-08 or 2026-09-09 commits on `origin/main`. The only git event after that log is `0921740` `ops: daily log 2026-09-08` on draft PR **#14** — not on `main`. Template still says v2/master; this clone is public v1. CHANGELOG/CONTEXT and `property-intel-v2` are not in this clone (`property-intel-v2` 404). `list-cloud-agents` listed this cron plus prior Log Bot runs (9/08 `bc-bbc69d44`, 9/07 `bc-cd56ff85`, 9/06 `bc-34e087f8`, 9/05 `bc-5c01f7f0`, 9/04 `bc-7fb90f35`, 9/03 `bc-b1bc2328`, 9/02 `bc-7de4187d`, 9/01 `bc-76a61999`, 8/31 `bc-f631c354`, 8/30 `bc-eb481f27`, 8/29 `bc-8dc1a78f`, 8/28 `bc-ede78703`, 8/27 `bc-d4995744`, 8/26 `bc-45e4c56a`) and three internal agents ("Search 8/28 transcript for dashboard", "Find original ops dashboard schema", "Summarize yesterday log bot"). Desktop/web/local sources returned 0.

### Shipped
None on 2026-09-09.

### Still open
- Chat direction still not visible in the Log Bot environment (`list-cloud-agents` desktop/web/local sources returned 0).
- Daily log PRs **#1** (`ops: daily log 2026-08-27`), **#3** (`ops: daily log 2026-08-28`), **#4** (`ops: daily log 2026-08-29`), **#5** (`ops: daily log 2026-08-30`), **#6** (`ops: daily log 2026-08-31`), **#7** (`ops: daily log 2026-09-01`), **#8** (`ops: daily log 2026-09-02`), **#9** (`ops: daily log 2026-09-03`), **#10** (`ops: daily log 2026-09-04`), **#11** (`ops: daily log 2026-09-05`), **#12** (`ops: daily log 2026-09-06`), **#13** (`ops: daily log 2026-09-07`), and **#14** (`ops: daily log 2026-09-08`) are still DRAFT; `docs/ops/` is not on `main`.
- Nearmap trial: review page is on `main`; Apps Script paste/deploy, Pass 1, and `data/nearmap/{id}.json` sync are not evidenced in this clone (`docs/NEARMAP_CHANGELOG.md` Status lines still list those as operator steps).

### Watchouts
- Apps Script editor-save is not a new deployment. No `.gs` copies and no `satellite.gs` deploy evidence today; MOCKINGBIRD row 277 is the first check after a real deploy.
- Public `data/*.json` is sync-owned. Last Sync/Publish on `origin/main` is `187a608` Sync Drone (2026-08-28). No satellite/plane/drone/nearmap `data/` sync after yesterday's log. Head still has the three `data/gis/{id}.json` files from `4b35668`. No `data/nearmap/` records.
- Catalog `role=` still present on all 256 pins after `06c9714` (195 primary, 61 concern); do not flatten it. Golf catalog is a separate Golf Pins sheet (ids 1001+); the `golf.gs` header says never merge it into `pins-catalog.json`.

## 2026-09-08

No author-date 2026-09-08 commits on `origin/main`. Head is `949f6d6` (2026-09-07 12:29 -0500). Yesterday's 00:03 UTC log (draft PR **#13**, `cursor/property-intel-daily-log-e481`) stopped at `da8dedf` and recorded nothing shipped on 9/07; the two commits below landed after that cron.

Log Bot cron `41611cd5-a0bb-11f1-b532-320a589b8025` at 2026-09-08T00:01:26Z (`bc-bbc69d44`). Template still says v2/master; this clone is public v1. CHANGELOG/CONTEXT and `property-intel-v2` are not in this clone (`property-intel-v2` 404). `list-cloud-agents` listed this cron plus prior Log Bot runs (9/07 `bc-cd56ff85`, 9/06 `bc-34e087f8`, 9/05 `bc-5c01f7f0`, 9/04 `bc-7fb90f35`, 9/03 `bc-b1bc2328`, 9/02 `bc-7de4187d`, 9/01 `bc-76a61999`, 8/31 `bc-f631c354`, 8/30 `bc-eb481f27`, 8/29 `bc-8dc1a78f`, 8/28 `bc-ede78703`, 8/27 `bc-d4995744`, 8/26 `bc-45e4c56a`) and three internal agents ("Search 8/28 transcript for dashboard", "Find original ops dashboard schema", "Summarize yesterday log bot"). Desktop/web/local sources returned 0.

### Shipped
- `8be883d` Publish `nearmap-review.html` so GitHub Pages can serve Nearmap Pass 1 QA. BUILD **v1.0.1**. Isolated trial page (sibling of golf-review / element-review; not on VIEW_ORDER). Author-date 2026-09-07 11:29 -0500. Co-authored-by Cursor.
- `949f6d6` Per-layer Nearmap AI colors and hint centroids on the review page. `nearmap-review.html` BUILD **v1.2.0** (no v1.1.0 commit on main). Same commit added `docs/NEARMAP_CHANGELOG.md`. Author-date 2026-09-07 12:29 -0500. Co-authored-by Cursor.

Neither commit touched `apps scripts/`, `data/`, element-review, golf-review, or the hub. Hub remains **1.8.14**. ER remains **v6.8.20**. Golf remains **v1.0.4**. No Sync/Publish satellite/plane/drone commits. `nearmap.gs` is not in this clone; `data/nearmap/` has no published JSON.

### Still open
- Chat direction still not visible in the Log Bot environment (`list-cloud-agents` desktop/web/local sources returned 0).
- Daily log PRs **#1** (`ops: daily log 2026-08-27`), **#3** (`ops: daily log 2026-08-28`), **#4** (`ops: daily log 2026-08-29`), **#5** (`ops: daily log 2026-08-30`), **#6** (`ops: daily log 2026-08-31`), **#7** (`ops: daily log 2026-09-01`), **#8** (`ops: daily log 2026-09-02`), **#9** (`ops: daily log 2026-09-03`), **#10** (`ops: daily log 2026-09-04`), **#11** (`ops: daily log 2026-09-05`), **#12** (`ops: daily log 2026-09-06`), and **#13** (`ops: daily log 2026-09-07`) are still DRAFT; `docs/ops/` is not on `main`.
- Nearmap trial: review page is on `main`; Apps Script paste/deploy, Pass 1, and `data/nearmap/{id}.json` sync are not evidenced in this clone (`docs/NEARMAP_CHANGELOG.md` Status lines still list those as operator steps).

### Watchouts
- Apps Script editor-save is not a new deployment. No `.gs` copies and no `satellite.gs` deploy evidence today; MOCKINGBIRD row 277 is the first check after a real deploy.
- Public `data/*.json` is sync-owned. Last Sync/Publish on `origin/main` is `187a608` Sync Drone (2026-08-28). The two Nearmap commits did not touch `data/`. Head still has the three `data/gis/{id}.json` files from `4b35668`. No `data/nearmap/` records.
- Catalog `role=` still present on all 256 pins after `06c9714` (195 primary, 61 concern); do not flatten it. Golf catalog is a separate Golf Pins sheet (ids 1001+); the `golf.gs` header says never merge it into `pins-catalog.json`.

## 2026-09-07

Nothing shipped today on `origin/main`. Head remains `da8dedf` (2026-09-02 16:43 -0500).

Log Bot cron `41611cd5-a0bb-11f1-b532-320a589b8025` at 2026-09-07T00:03:55Z (`bc-cd56ff85`). Yesterday's 00:16 UTC log (draft PR **#12**, `cursor/bc-34e087f8-2e0e-4559-8504-282e90c95654-84fb`, `3c89fa4`) already recorded `origin/main` at `da8dedf`. No author-date 2026-09-03 through 2026-09-07 commits on `origin/main`. The only git event after that log is `3c89fa4` `ops: daily log 2026-09-06` on draft PR **#12** — not on `main`. ISO week rolled to **2026-W37** (empty shipped). Template still says v2/master; this clone is public v1. CHANGELOG/CONTEXT and `property-intel-v2` are not in this clone (`property-intel-v2` 404). `list-cloud-agents` listed this cron plus prior Log Bot runs (9/06 `bc-34e087f8`, 9/05 `bc-5c01f7f0`, 9/04 `bc-7fb90f35`, 9/03 `bc-b1bc2328`, 9/02 `bc-7de4187d`, 9/01 `bc-76a61999`, 8/31 `bc-f631c354`, 8/30 `bc-eb481f27`, 8/29 `bc-8dc1a78f`, 8/28 `bc-ede78703`, 8/27 `bc-d4995744`, 8/26 `bc-45e4c56a`) and three internal agents ("Search 8/28 transcript for dashboard", "Find original ops dashboard schema", "Summarize yesterday log bot"). Desktop/web/local sources returned 0.

### Shipped
None on 2026-09-07.

### Still open
- Chat direction still not visible in the Log Bot environment (`list-cloud-agents` desktop/web/local sources returned 0).
- Daily log PRs **#1** (`ops: daily log 2026-08-27`), **#3** (`ops: daily log 2026-08-28`), **#4** (`ops: daily log 2026-08-29`), **#5** (`ops: daily log 2026-08-30`), **#6** (`ops: daily log 2026-08-31`), **#7** (`ops: daily log 2026-09-01`), **#8** (`ops: daily log 2026-09-02`), **#9** (`ops: daily log 2026-09-03`), **#10** (`ops: daily log 2026-09-04`), **#11** (`ops: daily log 2026-09-05`), and **#12** (`ops: daily log 2026-09-06`) are still DRAFT; `docs/ops/` is not on `main`.

### Watchouts
- Apps Script editor-save is not a new deployment. No `.gs` copies and no `satellite.gs` deploy evidence today; MOCKINGBIRD row 277 is the first check after a real deploy.
- Public `data/*.json` is sync-owned. Last Sync/Publish on `origin/main` is `187a608` Sync Drone (2026-08-28). No satellite/plane/drone `data/` sync after yesterday's log. Head still has the three `data/gis/{id}.json` files from `4b35668`.
- Catalog `role=` still present on all 256 pins after `06c9714` (195 primary, 61 concern); do not flatten it. Golf catalog is a separate Golf Pins sheet (ids 1001+); the `golf.gs` header says never merge it into `pins-catalog.json`.

## 2026-09-06

Nothing shipped today on `origin/main`. Head remains `da8dedf` (2026-09-02 16:43 -0500).

Log Bot cron `41611cd5-a0bb-11f1-b532-320a589b8025` at 2026-09-06T00:16:03Z (`bc-34e087f8`). Yesterday's 00:07 UTC log (draft PR **#11**, `cursor/property-intel-daily-log-5d78`, `f057564`) already recorded `origin/main` at `da8dedf`. No author-date 2026-09-03, 2026-09-04, 2026-09-05, or 2026-09-06 commits on `origin/main`. The only git event after that log is `f057564` `ops: daily log 2026-09-05` on draft PR **#11** — not on `main`. Template still says v2/master; this clone is public v1. CHANGELOG/CONTEXT and `property-intel-v2` are not in this clone (`property-intel-v2` 404). `list-cloud-agents` listed this cron plus prior Log Bot runs (9/05 `bc-5c01f7f0`, 9/04 `bc-7fb90f35`, 9/03 `bc-b1bc2328`, 9/02 `bc-7de4187d`, 9/01 `bc-76a61999`, 8/31 `bc-f631c354`, 8/30 `bc-eb481f27`, 8/29 `bc-8dc1a78f`, 8/28 `bc-ede78703`, 8/27 `bc-d4995744`, 8/26 `bc-45e4c56a`) and three internal agents ("Search 8/28 transcript for dashboard", "Find original ops dashboard schema", "Summarize yesterday log bot"). Desktop/web/local sources returned 0.

### Shipped
None on 2026-09-06.

### Still open
- Chat direction still not visible in the Log Bot environment (`list-cloud-agents` desktop/web/local sources returned 0).
- Daily log PRs **#1** (`ops: daily log 2026-08-27`), **#3** (`ops: daily log 2026-08-28`), **#4** (`ops: daily log 2026-08-29`), **#5** (`ops: daily log 2026-08-30`), **#6** (`ops: daily log 2026-08-31`), **#7** (`ops: daily log 2026-09-01`), **#8** (`ops: daily log 2026-09-02`), **#9** (`ops: daily log 2026-09-03`), **#10** (`ops: daily log 2026-09-04`), and **#11** (`ops: daily log 2026-09-05`) are still DRAFT; `docs/ops/` is not on `main`.

### Watchouts
- Apps Script editor-save is not a new deployment. No `.gs` copies and no `satellite.gs` deploy evidence today; MOCKINGBIRD row 277 is the first check after a real deploy.
- Public `data/*.json` is sync-owned. Last Sync/Publish on `origin/main` is `187a608` Sync Drone (2026-08-28). No satellite/plane/drone `data/` sync after yesterday's log. Head still has the three `data/gis/{id}.json` files from `4b35668`.
- Catalog `role=` still present on all 256 pins after `06c9714` (195 primary, 61 concern); do not flatten it. Golf catalog is a separate Golf Pins sheet (ids 1001+); the `golf.gs` header says never merge it into `pins-catalog.json`.

## 2026-09-05

Nothing shipped today on `origin/main`. Head remains `da8dedf` (2026-09-02 16:43 -0500).

Log Bot cron `41611cd5-a0bb-11f1-b532-320a589b8025` at 2026-09-05T00:07:22Z (`bc-5c01f7f0`). Yesterday's 00:04 UTC log (draft PR **#10**, `cursor/property-intel-daily-log-b7f8`, `2f04aa1`) already recorded `origin/main` at `da8dedf`. No author-date 2026-09-03, 2026-09-04, or 2026-09-05 commits on `origin/main`. The only git event after that log is `2f04aa1` `ops: daily log 2026-09-04` on draft PR **#10** — not on `main`. Template still says v2/master; this clone is public v1. CHANGELOG/CONTEXT and `property-intel-v2` are not in this clone (`property-intel-v2` 404). `list-cloud-agents` listed this cron plus prior Log Bot runs (9/04 `bc-7fb90f35`, 9/03 `bc-b1bc2328`, 9/02 `bc-7de4187d`, 9/01 `bc-76a61999`, 8/31 `bc-f631c354`, 8/30 `bc-eb481f27`, 8/29 `bc-8dc1a78f`, 8/28 `bc-ede78703`, 8/27 `bc-d4995744`, 8/26 `bc-45e4c56a`) and three internal agents ("Search 8/28 transcript for dashboard", "Find original ops dashboard schema", "Summarize yesterday log bot"). Desktop/web/local sources returned 0.

### Shipped
None on 2026-09-05.

### Still open
- Chat direction still not visible in the Log Bot environment (`list-cloud-agents` desktop/web/local sources returned 0).
- Daily log PRs **#1** (`ops: daily log 2026-08-27`), **#3** (`ops: daily log 2026-08-28`), **#4** (`ops: daily log 2026-08-29`), **#5** (`ops: daily log 2026-08-30`), **#6** (`ops: daily log 2026-08-31`), **#7** (`ops: daily log 2026-09-01`), **#8** (`ops: daily log 2026-09-02`), **#9** (`ops: daily log 2026-09-03`), and **#10** (`ops: daily log 2026-09-04`) are still DRAFT; `docs/ops/` is not on `main`.

### Watchouts
- Apps Script editor-save is not a new deployment. No `.gs` copies and no `satellite.gs` deploy evidence today; MOCKINGBIRD row 277 is the first check after a real deploy.
- Public `data/*.json` is sync-owned. Last Sync/Publish on `origin/main` is `187a608` Sync Drone (2026-08-28). No satellite/plane/drone `data/` sync after yesterday's log. Head still has the three `data/gis/{id}.json` files from `4b35668`.
- Catalog `role=` still present on all 256 pins after `06c9714` (195 primary, 61 concern); do not flatten it. Golf catalog is a separate Golf Pins sheet (ids 1001+); the `golf.gs` header says never merge it into `pins-catalog.json`.

## 2026-09-04

Nothing shipped today on `origin/main`. Head remains `da8dedf` (2026-09-02 16:43 -0500).

Log Bot cron `41611cd5-a0bb-11f1-b532-320a589b8025` at 2026-09-04T00:04:43Z (`bc-7fb90f35`). Yesterday's 00:03 UTC log (draft PR **#9**, `cursor/property-intel-daily-log-4466`, `a83c8fd`) already recorded `origin/main` at `da8dedf` and the seven ships after the 9/02 cron. No author-date 2026-09-03 or 2026-09-04 commits on `origin/main`. The only git event after that log is `a83c8fd` `ops: daily log 2026-09-03` on draft PR **#9** — not on `main`. Template still says v2/master; this clone is public v1. CHANGELOG/CONTEXT and `property-intel-v2` are not in this clone (`property-intel-v2` 404). `list-cloud-agents` listed this cron plus prior Log Bot runs (9/03 `bc-b1bc2328`, 9/02 `bc-7de4187d`, 9/01 `bc-76a61999`, 8/31 `bc-f631c354`, 8/30 `bc-eb481f27`, 8/29 `bc-8dc1a78f`, 8/28 `bc-ede78703`, 8/27 `bc-d4995744`, 8/26 `bc-45e4c56a`) and three internal agents ("Search 8/28 transcript for dashboard", "Find original ops dashboard schema", "Summarize yesterday log bot"). Desktop/web/local sources returned 0.

### Shipped
None on 2026-09-04.

### Still open
- Chat direction still not visible in the Log Bot environment (`list-cloud-agents` desktop/web/local sources returned 0).
- Daily log PRs **#1** (`ops: daily log 2026-08-27`), **#3** (`ops: daily log 2026-08-28`), **#4** (`ops: daily log 2026-08-29`), **#5** (`ops: daily log 2026-08-30`), **#6** (`ops: daily log 2026-08-31`), **#7** (`ops: daily log 2026-09-01`), **#8** (`ops: daily log 2026-09-02`), and **#9** (`ops: daily log 2026-09-03`) are still DRAFT; `docs/ops/` is not on `main`.

### Watchouts
- Apps Script editor-save is not a new deployment. No `.gs` copies and no `satellite.gs` deploy evidence today; MOCKINGBIRD row 277 is the first check after a real deploy.
- Public `data/*.json` is sync-owned. Last Sync/Publish on `origin/main` is `187a608` Sync Drone (2026-08-28). No satellite/plane/drone `data/` sync after yesterday's log. Head still has the three `data/gis/{id}.json` files from `4b35668`.
- Catalog `role=` still present on all 256 pins after `06c9714` (195 primary, 61 concern); do not flatten it. Golf catalog is a separate Golf Pins sheet (ids 1001+); the `golf.gs` header says never merge it into `pins-catalog.json`.

## 2026-09-03

No author-date 2026-09-03 commits on `origin/main`. Head is `da8dedf` (2026-09-02 16:43 -0500). Yesterday's 00:01 UTC log (draft PR **#8**, `cursor/property-intel-daily-log-3473`) stopped at `8b1d0d4` and recorded no author-date 2026-09-02 commits; the seven commits below landed after that cron.

Log Bot cron `41611cd5-a0bb-11f1-b532-320a589b8025` at 2026-09-03T00:03:15Z (`bc-b1bc2328`). Template still says v2/master; this clone is public v1. CHANGELOG/CONTEXT and `property-intel-v2` are not in this clone (`property-intel-v2` 404). `list-cloud-agents` listed this cron plus prior Log Bot runs (9/02 `bc-7de4187d`, 9/01 `bc-76a61999`, 8/31 `bc-f631c354`, 8/30 `bc-eb481f27`, 8/29 `bc-8dc1a78f`, 8/28 `bc-ede78703`, 8/27 `bc-d4995744`, 8/26 `bc-45e4c56a`) and three internal agents ("Search 8/28 transcript for dashboard", "Find original ops dashboard schema", "Summarize yesterday log bot"). Desktop/web/local sources returned 0.

### Shipped
- `d688a65` Pin identity is the marker number, not catalog id, so duplicate pins survive moves and removes. `element-review.html` BUILD **v6.8.11 → v6.8.13** (no v6.8.12 commit on main). Same commit copied `apps scripts/critique-api.gs` and `satellite.gs` — **file copies, not a deploy**. Author-date 2026-09-01 19:02 -0500 (2026-09-02T00:02:30Z, after yesterday's cron start).
- `be175c0` Surface a stale server build on submit (min v6.8.2 for duplicate-pin identity). `element-review.html` BUILD **v6.8.14**. Author-date 2026-09-01 19:12 -0500.
- `4987718` Fifth reviewer **DPC Prime** in the dropdown; `sandbox=1` routes GET/POST to Satellite Sandbox + Element Critique Sandbox (header dates this to v6.8.15; BUILD on the commit is **v6.8.17** — no v6.8.15/v6.8.16 commits on main). Author-date 2026-09-02 16:02 -0500.
- `f1b002d` Rename the fifth reviewer to **DPC:** so the label matches the critique sheet. BUILD **v6.8.18**. Author-date 2026-09-02 16:11 -0500.
- `6252628` Rename the fifth reviewer to **DPC'** (apostrophe, not a colon). BUILD **v6.8.19**. Author-date 2026-09-02 16:13 -0500.
- `4b35668` Hub **1.8.14**: known GIS property facts on the Private rail (`js/vyanet-viewer/gis-facts.js`; assessor, DOGAMI, fire, flood, WUI). Three `data/gis/{id}.json` files plus `data/gis/.gitkeep`. Contract writer is Apps Script `gisFileForSync_` — not a Sync/Publish commit. Also updated `docs/INDEX_AND_CAMERAS_CONTRACT.md`, fixtures, `vyanet-viewer.html`, `viewer.html`, `model-viewer.html`, `test-vyanet-viewer.py`, and copied `apps scripts/shared.gs` — **file copy, not a deploy**. Author-date 2026-09-02 16:22 -0500.
- `da8dedf` "Show pins" dropdown so reviewers can compare Bedrock and prior rounds. `element-review.html` BUILD **v6.8.20**. Same commit copied `apps scripts/critique-api.gs` — **file copy, not a deploy**. Author-date 2026-09-02 16:43 -0500.

Golf remains **v1.0.4**. No Sync/Publish satellite/plane/drone commits. All seven Co-authored-by Cursor.

### Still open
- Chat direction still not visible in the Log Bot environment (`list-cloud-agents` desktop/web/local sources returned 0).
- Daily log PRs **#1** (`ops: daily log 2026-08-27`), **#3** (`ops: daily log 2026-08-28`), **#4** (`ops: daily log 2026-08-29`), **#5** (`ops: daily log 2026-08-30`), **#6** (`ops: daily log 2026-08-31`), **#7** (`ops: daily log 2026-09-01`), and **#8** (`ops: daily log 2026-09-02`) are still DRAFT; `docs/ops/` is not on `main`.

### Watchouts
- Apps Script editor-save is not a new deployment. `.gs` copies in git today (`satellite.gs` + `critique-api.gs` in `d688a65`, `shared.gs` in `4b35668`, `critique-api.gs` in `da8dedf`) are not a deploy. `satellite.gs` changed in `d688a65`; MOCKINGBIRD row 277 is the first check after a real deploy.
- Public `data/*.json` is sync-owned. Last Sync/Publish on `origin/main` is `187a608` Sync Drone (2026-08-28). `4b35668` added three `data/gis/{id}.json` files (GIS facts panel; writer `gisFileForSync_`). No satellite/plane/drone `data/` sync.
- Catalog `role=` still present on all 256 pins after `06c9714` (195 primary, 61 concern); do not flatten it. Golf catalog is a separate Golf Pins sheet (ids 1001+); the `golf.gs` header says never merge it into `pins-catalog.json`.

## 2026-09-02

No author-date 2026-09-02 commits on `origin/main`. Head is `8b1d0d4` (2026-09-01 18:06 -0500). Yesterday's 00:06 UTC log (`74df029` on draft PR **#7**) stopped at `064658b` and recorded no author-date 2026-09-01 commits; the five commits below landed after that cron.

Log Bot cron `41611cd5-a0bb-11f1-b532-320a589b8025` at 2026-09-02T00:01:16Z (`bc-7de4187d`). Template still says v2/master; this clone is public v1. CHANGELOG/CONTEXT and `property-intel-v2` are not in this clone (`property-intel-v2` 404). `list-cloud-agents` listed this cron plus prior Log Bot runs (9/01 `bc-76a61999`, 8/31 `bc-f631c354`, 8/30 `bc-eb481f27`, 8/29 `bc-8dc1a78f`, 8/28 `bc-ede78703`, 8/27 `bc-d4995744`, 8/26 `bc-45e4c56a`) and three internal agents ("Search 8/28 transcript for dashboard", "Find original ops dashboard schema", "Summarize yesterday log bot"). Desktop/web/local sources returned 0.

### Shipped
- `a8b3ceb` Sheet-only golf review pipeline: `golf-review.html` BUILD **v1.0.0**, plus copies of `apps scripts/golf.gs`, `config.gs`, `menu.gs`, and `critique-api.gs`. Golf courses skip the satellite nadir screenshot and Bedrock pass; reviewers place an independent catalog (seed ids 1001–1150, 150 pins; `GOLF_MAX_PINS = 200` in the `config.gs` copy) as `{id, lat, lng}` on a live map and save only to the Golf tab. Publish (`data/golf/`) is out of scope in the `golf.gs` header. **File copies, not an Apps Script deployment.** Author-date 2026-09-01 13:19 -0500.
- `30d546a` Yellow nadir pin at the geocoded golf address; also apply Elements Reviewed checkboxes on an empty Golf tab. `golf-review.html` BUILD **v1.0.1**. Same commit copied `apps scripts/golf.gs`. Author-date 2026-09-01 13:39 -0500.
- `de7ad60` Blue dot for the golf address and a spinner until map tiles load. `golf-review.html` BUILD **v1.0.2**. Author-date 2026-09-01 13:44 -0500.
- `2617114` Golf map starts from URL `?lat=&lng=` instead of waiting on Apps Script. `golf-review.html` BUILD **v1.0.3**. Author-date 2026-09-01 17:11 -0500.
- `8b1d0d4` Duplicate catalog pins stay separate instances when adding or dragging (a second Roof or Parking was matching on catalog id alone). `element-review.html` BUILD **v6.8.10 → v6.8.11**; `golf-review.html` BUILD **v1.0.4**. Same commit copied `apps scripts/critique-api.gs` and `satellite.gs` — **file copies, not a deploy**. Author-date 2026-09-01 18:06 -0500.

Hub remains **1.8.13**. No `data/` sync commits. All five Co-authored-by Cursor.

### Still open
- Chat direction still not visible in the Log Bot environment (`list-cloud-agents` desktop/web/local sources returned 0).
- Daily log PRs **#1** (`ops: daily log 2026-08-27`), **#3** (`ops: daily log 2026-08-28`), **#4** (`ops: daily log 2026-08-29`), **#5** (`ops: daily log 2026-08-30`), **#6** (`ops: daily log 2026-08-31`), and **#7** (`ops: daily log 2026-09-01`) are still DRAFT; `docs/ops/` is not on `main`.

### Watchouts
- Apps Script editor-save is not a new deployment. `.gs` copies in git today (`golf.gs`, `config.gs`, `menu.gs`, `critique-api.gs`, `satellite.gs`) are not a deploy. `satellite.gs` changed in `8b1d0d4`; MOCKINGBIRD row 277 is the first check after a real deploy.
- Public `data/*.json` is sync-owned. Last sync on `origin/main` is `187a608` Sync Drone (2026-08-28). None of the five commits touched `data/`.
- Catalog `role=` still present on all 256 pins after `06c9714` (195 primary, 61 concern); do not flatten it. Golf catalog is a separate Golf Pins sheet (ids 1001+); the `golf.gs` header says never merge it into `pins-catalog.json`.

## 2026-09-01

No author-date 2026-09-01 commits on `origin/main`. Head is `064658b` (2026-08-31 12:19 -0500). Yesterday's 00:06 UTC log (`d046d39` on draft PR **#6**) stopped at `53346bd` and recorded nothing shipped on 8/31; the hub change below landed after that cron.

Log Bot cron `41611cd5-a0bb-11f1-b532-320a589b8025` at 2026-09-01T00:03:44Z (`bc-76a61999`). Template still says v2/master; this clone is public v1. CHANGELOG/CONTEXT and `property-intel-v2` are not in this clone (`property-intel-v2` 404). `list-cloud-agents` listed this cron plus prior Log Bot runs (8/31 `bc-f631c354`, 8/30 `bc-eb481f27`, 8/29 `bc-8dc1a78f`, 8/28 `bc-ede78703`, 8/27 `bc-d4995744`, 8/26 `bc-45e4c56a`) and three internal agents ("Summarize yesterday log bot", "Search 8/28 transcript for dashboard", "Find original ops dashboard schema"). Desktop/web/local sources returned 0.

### Shipped
- `064658b` Hub **1.8.13**: property CHEKT moved under Private (nested 3D / 2D / Live / Plugins). Community gets its own Map / Live bar with an empty Community Live slot so neighborhood cameras can land later without sharing the property feed. `js/vyanet-viewer/property.js` `HUB_BUILD = '1.8.13'`. Same commit updated `vyanet-viewer.html`, `test-vyanet-viewer.py`, and `docs/INDEX_AND_CAMERAS_CONTRACT.md`. Co-authored-by Cursor. Author-date 2026-08-31 12:19 -0500.

Not on `main`: 8/31 Log Bot follow-ups on draft PR **#6** (`4b4b06b`, `34d6a59`, `0d8fe5f`, `f69689d`) restyled `docs/ops/index.html` to the charcoal/gold board and put Daily log back under pipelines.

### Still open
- Chat direction still not visible in the Log Bot environment (`list-cloud-agents` desktop/web/local sources returned 0).
- Daily log PRs **#1** (`ops: daily log 2026-08-27`), **#3** (`ops: daily log 2026-08-28`), **#4** (`ops: daily log 2026-08-29`), **#5** (`ops: daily log 2026-08-30`), and **#6** (`ops: daily log 2026-08-31`) are still DRAFT; `docs/ops/` is not on `main`.

### Watchouts
- Apps Script editor-save is not a new deployment. No `.gs` copies and no `satellite.gs` deploy evidence today; MOCKINGBIRD row 277 is the first check after a real deploy.
- Public `data/*.json` is sync-owned. No sync commits on `main` since `187a608` (2026-08-28). `064658b` did not touch `data/`.
- Catalog `role=` still present on all 256 pins after `06c9714` (195 primary, 61 concern); do not flatten it.

## 2026-08-31

Nothing shipped today on `origin/main`. Head remains `53346bd` (2026-08-28 16:22 -0500).

Log Bot cron `41611cd5-a0bb-11f1-b532-320a589b8025` at 2026-08-31T00:04:39Z (`bc-f631c354`). Yesterday's 00:23 UTC log already recorded that `origin/main` was still `53346bd`. No author-date 2026-08-29, 2026-08-30, or 2026-08-31 commits on `origin/main`. The only git event after that log is `7a40c02` `ops: daily log 2026-08-30` on draft PR **#5** (`cursor/property-intel-daily-log-3f6c`) — not on `main`. Template still says v2/master; this clone is public v1. CHANGELOG/CONTEXT and `property-intel-v2` are not in this clone (`property-intel-v2` 404). `list-cloud-agents` listed only Log Bot runs (this cron, 8/30 `bc-eb481f27`, 8/29 `bc-8dc1a78f`, 8/28 `bc-ede78703`, 8/27 `bc-d4995744`, 8/26 `bc-45e4c56a`) plus internal "Summarize yesterday log bot". Desktop/web/local sources returned 0.

### Shipped
None on 2026-08-31.

### Still open
- Chat direction still not visible in the Log Bot environment (`list-cloud-agents` returned only Log Bot automations + one internal summarizer).
- Daily log PRs **#1** (`ops: daily log 2026-08-27`), **#3** (`ops: daily log 2026-08-28`), **#4** (`ops: daily log 2026-08-29`), and **#5** (`ops: daily log 2026-08-30`) are still DRAFT; `docs/ops/` is not on `main`.

### Watchouts
- Apps Script editor-save is not a new deployment. No `.gs` copies and no `satellite.gs` deploy evidence today; MOCKINGBIRD row 277 is the first check after a real deploy.
- Public `data/*.json` is sync-owned. No sync commits on `main` since yesterday's log.
- Catalog `role=` still present on all 256 pins after `06c9714` (195 primary, 61 concern); do not flatten it.

## 2026-08-30

Nothing shipped today on `origin/main`. Head remains `53346bd` (2026-08-28 16:22 -0500).

Log Bot cron `41611cd5-a0bb-11f1-b532-320a589b8025` at 2026-08-30T00:20:58Z (`bc-eb481f27`). Yesterday's 00:16 UTC log already recorded the 8/28 afternoon work through `53346bd`. No author-date 2026-08-29 or 2026-08-30 commits on `origin/main`. The only git event after that log is `44da289` `ops: daily log 2026-08-29` on draft PR **#4** (`cursor/property-intel-daily-log-0704`) — not on `main`. Template still says v2/master; this clone is public v1. CHANGELOG/CONTEXT and `property-intel-v2` are not in this clone (`property-intel-v2` 404). `list-cloud-agents` listed only Log Bot runs (this cron, 8/29 `bc-8dc1a78f`, 8/28 `bc-ede78703`, 8/27 `bc-d4995744`, 8/26 `bc-45e4c56a`) plus internal "Summarize yesterday log bot". Desktop/web/local sources returned 0.

### Shipped
None on 2026-08-30.

### Still open
- Chat direction still not visible in the Log Bot environment (`list-cloud-agents` returned only Log Bot automations + one internal summarizer).
- Daily log PRs **#1** (`ops: daily log 2026-08-27`), **#3** (`ops: daily log 2026-08-28`), and **#4** (`ops: daily log 2026-08-29`) are still DRAFT; `docs/ops/` is not on `main`.

### Watchouts
- Apps Script editor-save is not a new deployment. No `.gs` copies and no `satellite.gs` deploy evidence today; MOCKINGBIRD row 277 is the first check after a real deploy.
- Public `data/*.json` is sync-owned. No sync commits on `main` since yesterday's log.
- Catalog `role=` still present on all 256 pins after `06c9714` (195 primary, 61 concern); do not flatten it.

## 2026-08-29

Log Bot cron `41611cd5-a0bb-11f1-b532-320a589b8025` at 2026-08-29T00:16:28Z (`bc-8dc1a78f`). Head of `origin/main` is `53346bd` (2026-08-28 16:22 -0500). Yesterday's 00:13 UTC log stopped at `606537c` and had no author-date 2026-08-28 commits; everything below is 2026-08-28 09:00–16:22 -0500. Template still says v2/master; this clone is public v1. CHANGELOG/CONTEXT and `property-intel-v2` are not in this clone (`property-intel-v2` 404). `list-cloud-agents` listed only Log Bot runs (this cron, 8/28 `bc-ede78703`, 8/27 `bc-d4995744`) plus internal "Summarize yesterday log bot".

### Shipped
- `53346bd` Hub **1.8.12**: Community iframe cache-bust so it drops the cached v2.3.4 `hoa-viewer`. `js/vyanet-viewer/property.js` `HUB_BUILD = '1.8.12'`.
- `e3952cf` Community no longer fetches the deleted monolithic `data/index.json` (that 404 blanked the map). `hoa-viewer.html` loads each HOA member from `data/index/{id}.json` with satellite fallback.
- `260c239` Match 2D camera pins to 3D: same popup, live LEDs, and 72-hour clip dots. Same commit set hub **1.8.11**, copied `apps scripts/shared.gs` (**file copy, not a deploy**), and deleted the duplicate Eugene cameras file `data/cameras/json/8eea64e5…` so HEAD has **2** camera json files.
- `b44575a` Reviewers can pin outside the nadir crop (percentages may be <0 or >100) and open Google Earth from Element Review. `element-review.html` BUILD **v6.8.10**. Same commit copied `apps scripts/satellite.gs`, `plane.gs`, `drone-test.gs`, `critique-api.gs`, `shared.gs` — **file copies, not an Apps Script deployment**.
- `cfde3ab` (merged `e4863fb`) Stop Lane road leftovers from painting as the property line (`nadir-geo.js` prefers `MAPTAXLOT` then `TAXLOT`).
- Apps Script–style syncs on 8/28 (sync-owned `data/`): six `Publish Responder Intel — 1 property` (`ee91147` … `47def97`) and `187a608` Sync Drone (six `data/drone/{id}.json` plus index hubs).

Not on HEAD: `100b135` added an on-page ER oblique pane (BUILD v6.8.11) and `0cf943b` reverted it the same afternoon; BUILD remains **v6.8.10**.

### Still open
- Chat direction still not visible in the Log Bot environment (`list-cloud-agents` returned only Log Bot automations + one internal summarizer).
- Daily log PRs **#1** (`ops: daily log 2026-08-27`) and **#3** (`ops: daily log 2026-08-28`) are still DRAFT; `docs/ops/` is not on `main`.

### Watchouts
- Apps Script editor-save is not a new deployment. `.gs` copies in git (`satellite.gs` in `b44575a`, `shared.gs` in `b44575a` and `260c239`) are not a deploy. No `satellite.gs` deploy evidence today; MOCKINGBIRD row 277 is the first check after a real deploy.
- Public `data/*.json` is sync-owned (six responder-intel publishes + Sync Drone + camera json delete/edit in `260c239`; next sync can overwrite).
- Catalog `role=` still present on all 256 pins after `06c9714` (195 primary, 61 concern); do not flatten it.

## 2026-08-28

Log Bot cron `41611cd5-a0bb-11f1-b532-320a589b8025` at 2026-08-28T00:13:41Z. No commits with author date 2026-08-28. Head of `origin/main` is `606537c` (2026-08-27 16:53 -0500). Everything below landed after yesterday's 00:03 UTC log (author dates 2026-08-27 11:18–16:53 -0500). CHANGELOG/CONTEXT and `property-intel-v2` are not in this clone (`property-intel-v2` 404). `list-cloud-agents` listed only Log Bot runs (this cron, 8/27, 8/26) plus internal "Summarize yesterday log bot".

### Shipped
- `5c79788` merge of PR **#2** (`cursor/vyanet-viewer-gate-home`). Hub 1.6.4 lineage is on `main`. That branch has no commits not already on `main`.
- `df985c1` Hub **1.7.3**: Eugene cameras on the live hub; four CHEKT feeds joined to stills. `js/vyanet-viewer/property.js` `HUB_BUILD = '1.7.3'`.
- `9a754fb` Hub **1.7.2**: Eugene cameras, FR 3D pins, CHEKT live by address. Also copied `apps scripts/critique-api.gs`, `drone-test.gs`, `plane.gs`, `prompts.gs`, `shared.gs` — **file copies, not an Apps Script deployment**.
- `6e693f0` + `11c0394`: Vyanet Eugene camera stills under `data/cameras/images/{id}/`; metadata settled at `data/cameras/json/{id}.json` (3 json files on HEAD).
- `a302173` Redraw element-review pins immediately after rerun. `element-review.html` BUILD **v6.8.8**.
- `9442d72` Drone-test element review georeferences CloudFront nadirs and identifies the row by taxlot.
- `91556e6` Lane County lot-line tiles (`data/parcels/lane_*.geojson`, 332 files) and both-county grids in viewers.
- `1f02d1b` Stop drawing the element-review pin-range box; allow reviewer duplicate pins; school cap **20** (`SCHOOL_PIN_LIMIT = 20`; `SAT_MAX_PINS` stays 12 in the `satellite.gs` copy). Same commit copied `apps scripts/satellite.gs` — **not a deploy**.
- Apps Script–style syncs on 8/27 (sync-owned `data/`): six `Sync drone-test` (`e614910` … `0ef3f6f`) and `0b51828` Sync Row — Vyanet Eugene.

### Still open
- Chat direction still not visible in the Log Bot environment (`list-cloud-agents` returned only Log Bot automations + one internal summarizer).
- Daily log PR **#1** (`ops: daily log 2026-08-27`, `cursor/property-intel-daily-log-4f45`) is still DRAFT; `docs/ops/` is not on `main`.

### Watchouts
- Apps Script editor-save is not a new deployment. `.gs` copies in git (`satellite.gs` in `1f02d1b`, plus `9a754fb`) are not a deploy. No `satellite.gs` deploy evidence today; MOCKINGBIRD row 277 is the first check after a real deploy.
- Public `data/*.json` is sync-owned (drone-test + Eugene row + camera JSON landed via git; next sync can overwrite).
- Catalog `role=` still present on all 256 pins after `06c9714` (195 primary, 61 concern); do not flatten it.

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
