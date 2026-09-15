# Published property records (S3)

**Status:** bucket + CloudFront live. **Sheet Sync writes records S3.** Drone view JSON also still writes GitHub `data/responder-drone/` and `data/drone/` on this repo (live `responder-intel.html` links). Satellite / plane / Nearmap / drone-test are S3-only. Two sources, one AWS layout. **Sheet → records** for mothership view JSON (satellite / plane / drone / drone-test / nearmap / hoa / pins built from cells). **Git → records/tiles** for cameras, GIS facts, parcel tiles, and camera stills — those files are not on the Sheet. Hub id is `hashId(slug(site_no))` from the Satellite tab. Live Pages HTML still reads GitHub until viewers cut over.  
**Date:** 2026-09-11  
**No numbered segment contract covers this.** Segment 6 (integrations) is still owed. This file is the records-bucket clause.

**Principle:** the Google Sheet is operational state for pipelines that live in cells. Cameras, GIS facts, and lot-line tiles are git files (`data/cameras/`, `data/gis/`, `data/parcels/`). Published copies of all of that live in AWS. Git keeps code, fixtures, and (until viewer cutover) the Pages copy of those git-owned files.

## Bucket

| | |
|---|---|
| Name | `property-intel-records` |
| Account / region | 719781265739 / `us-east-1` |
| Public access | Blocked (all four settings). Public reads go through CloudFront OAC only. |
| Encryption | SSE-S3 (AES256), bucket keys on |
| Versioning | On (stable keys, overwrite-in-place; restore from a prior version) |
| Object ownership | BucketOwnerEnforced |

Do **not** put records in `property-intel-ingest` (raw) or mix them into `property-intel-tiles` except the serving prefixes that belong there (`captures/`, Nearmap rasters, `cameras/{hubId}/` stills, `parcels/`). Lambda never writes GitHub. GitHub Actions never call AWS. Apps Script writes sheet-built JSON. Git-owned cameras/GIS/parcels are copied by the operator script (or the GitHub sidecar for JSON only).

## CloudFront

Own distribution so records keys (`index/`, `nearmap/`, …) cannot collide with tiles paths (`captures/`, `nearmap/` rasters).

| | |
|---|---|
| Distribution | `E2GZ8OZSJKL173` |
| Domain | `https://d1h1on7f1v1lpy.cloudfront.net` |
| Origin | `property-intel-records.s3.us-east-1.amazonaws.com` (REST, OAC `E2T7PZUADL625G`, sigv4 always) |
| Viewer URL | `https://d1h1on7f1v1lpy.cloudfront.net/{key}` — key as in `files.*.key` |
| HTTPS | `redirect-to-https` |
| Cache | Managed-CachingDisabled (JSON overwrites must not sit stale). When a writer sets `Cache-Control` and invalidates, this can move to CachingOptimized like tiles stills. |
| CORS | Managed-CORS-S3Origin + CORS-With-Preflight (same as tiles). S3 CORS GET/HEAD `*`. |
| Missing object | S3 OAC missing key is 403; dist maps 403 → 404 via `/404.txt`, error cache 10s (tiles pattern). |

Existence checks: `s3.head_object` only. Never CloudFront HEAD (negative-caches 403/404).

Invalidate after overwrite if caching is turned on: path `/index/{hubId}.json` (and the child key). Not needed while CachingDisabled.

Do not add this bucket as a second origin on `EQJBJ6X237VQF` (`d3fg47bqswi0rr.cloudfront.net`). `nearmap/` already serves tiles binaries there.

## Writers

| Who | What |
|---|---|
| Sheet pipelines (`satellite.gs`, `plane.gs`, `drone-test.gs`, `nearmap.gs`, `responder intel.gs`) | **Sync / Publish** writes `s3://property-intel-records` via `pushAllToGitHub` → `pushAllToRecords_`. GitHub-shaped `data/` paths map onto mothership prefixes. Index files convert to `files`/`views` and **merge**. **Exception — drone and drone-test:** `data/responder-drone/` and `data/drone/` also PUT to GitHub Pages on this repo (frozen `responder-intel.html?property=` links). Drone-test also PUTs `data/drone-test/{id}.json` and that row’s `data/index/{hubId}.json` so the live hub’s 3D tab can load the GLB. Not a second copy to a vyanet-ops repo. Full Satellite sync of ~2600 rows still hits the 6-minute cap — use overnight mothership or Sync This Row. |
| Apps Script `publishRecordsFromSheets` | Bulk sheet walk (overnight). Same S3 layout. Never reads cameras/GIS. |
| Git `data/cameras/`, `data/gis/`, `data/parcels/` | Source files. Not sheet columns. Jones cameras/GIS today are git ids `6de88883…` / `d9f759…`; Eugene cameras are git id `4a484f8c…`. |
| Operator `tools/publish-records-static.py` | Copies those git files onto mothership hubs (remap GitHub folder id → site_no hub) and `aws s3 sync` stills + parcels to `property-intel-tiles`. Laptop credential chain. **Not** GitHub Actions. |
| Apps Script `publishRecordsSidecarsFromGithub` | Same git JSON over the Contents API (no Sheet). Jones → site_no 14725, Eugene → VY-IN-003. Does not PUT JPEGs or parcel tiles. |
| Lambda | Does not write this bucket. |
| GitHub Actions | Never AWS. |

The Script Properties AWS key needs `s3:PutObject` and `s3:GetObject` on `arn:aws:s3:::property-intel-records/*` (same key that already PUTs Nearmap edits on tiles). 403 `AccessDenied` on `checkRecordsWrite` means that policy is missing.

Paste `config.gs` (constants), `menu.gs`, and new file `records.gs`. Save **and** create a new deployment version.

Do **not** publish a listing object (`index.json` of every hub, `properties.json`, and so on). Operators see all properties in the Sheet (or `s3:ListBucket` on `index/`). A public list recreates the old GitHub tree catalog.

## Key layout

Keys are bucket-relative, lowercase, no leading slash. Filename stem is the existing hash id (do not invent a third scheme).

```text
s3://property-intel-records/
  index/{hubId}.json
  satellite/{id}.json
  plane/{id}.json
  responder-drone/{id}.json
  drone/{id}.json
  drone-test/{id}.json
  nearmap/{id}.json
  cameras/{hubId}.json
  gis/{hubId}.json
  pins/{hubId}.json
  hoa/{slug}.json
```

`responder-drone/{id}` keeps the **frozen** customer ids (`hashId(slug(account name))`). Do not rename those files. `drone-test/` is not a production view.

Binaries stay on tiles / ingest. Camera stills: `s3://property-intel-tiles/cameras/{hubId}/cam-NN.jpg` (same hub id as the records JSON). Raw technician photos stay ingest-only. GLBs, nadirs, Nearmap rasters, and **county lot-line tiles** stay on tiles. The child JSON (plane, cameras, nearmap) holds those URLs. The index does not duplicate them.

County parcel tiles (Deschutes / Lane / Josephine 0.07° grid) are **not** customer records and are **not** listed on `files`:

```text
s3://property-intel-tiles/parcels/{county}_{lat}_{lng}.geojson
```

Viewer URL after cutover: `https://d3fg47bqswi0rr.cloudfront.net/parcels/{filename}`. Cache-Control `public, max-age=3600`. Do not put these on the records distribution (CachingDisabled, and `nearmap/` on tiles must not collide with records keys).

Camera JSON `photo` fields on the records object are tiles CloudFront URLs, not GitHub `data/cameras/images/…` paths.

## Index is the source of truth for locations

`index/{hubId}.json` is the property hub **and the locator**. One house, one index file. **`hubId` is always `hashId(slug(site_no))` from the Satellite tab.** Do not use Account Name hashes as AWS hub ids (that is the GitHub-era Jones `6de88883…` / Tracy fork pattern). View *records* keep their own id rules; the index is the join.

- Identity stays here (name, address, hoa, coords, account_type, optional `site_no`).
- **`files` lists every published JSON in this bucket that belongs to the property.** Each entry has a `key` (bucket-relative). Entries that also have a hash id include `id`.
- **`views` maps product tabs onto `files`.** `security` and `wildfire` both point at `files.satellite` (one satellite object, two tabs). Missing tabs are omitted, not null.
- A records object that is not named on that hub’s `files` map is **not published**. Viewers on the product path must not guess `satellite/{id}.json` when the index omitted it.
- Writers PUT the child object **and** merge the matching `files` (and `views`, when they own that tab) in the same publish. Merge is key-by-key. Plane must not drop `cameras`; satellite must not drop `plane`. Same rule as today’s `upsertIndexEntry_`.
- `hoa` on the index is the slug; `files.hoa.key` is the shared HOA document (`hoa/{slug}.json`). That file is satellite-owned and lists member hub ids. It is not one property’s private object, but each member index still points at it.

Do not put pins, routes, obliques, GLB URLs, or the camera array on the index. Those stay on the child records. The index only says **where** those files are.

### `files` keys (omit if that document does not exist)

| `files` key | Object key | Id rule |
|---|---|---|
| `satellite` | `satellite/{id}.json` | `hashId(slug(site_no))` — often equals `hubId` |
| `plane` | `plane/{id}.json` | name-keyed view id |
| `drone` | `responder-drone/{id}.json` | frozen name-hash (customer links) |
| `drone-test` | `drone-test/{id}.json` | test only; drop when promoted onto plane/drone |
| `nearmap` | `nearmap/{id}.json` | `hashId(slug(site_no))`; trial may omit until index join is on |
| `cameras` | `cameras/{hubId}.json` | hub id, never a view-record hash |
| `gis` | `gis/{hubId}.json` | hub id |
| `pins` | `pins/{hubId}.json` | hub id |
| `hoa` | `hoa/{slug}.json` | slug from `hoa` field |

If a future interior (or other) view record is published, add `files.interior` the same way. Do not flatten pin-catalog `role=`.

### Index shape (v1)

`key` is the records-bucket key. Viewers prepend the records origin (`https://…/` or `s3://property-intel-records/`). Do not store absolute `https://` or `s3://` inside `files.*.key` (CDN host will change).

```json
{
  "schema": "property-intel-records/index-v1",
  "id": "<hashId(slug(site_no))>",
  "name": "Jones",
  "address": "18775 Macalpine Loop, Bend OR 97702",
  "lat": 44.0414545,
  "lng": -121.3786406,
  "hoa": "highlands",
  "account_type": "residential",
  "has_nadir": true,
  "files": {
    "satellite": {
      "id": "<same as hubId>",
      "key": "satellite/<hubId>.json"
    },
    "plane": {
      "id": "ccd8c44194813010120989ab863e77b5",
      "key": "plane/ccd8c44194813010120989ab863e77b5.json"
    },
    "drone": {
      "id": "2dcf6ccab84215660872a52d13214aa0",
      "key": "responder-drone/2dcf6ccab84215660872a52d13214aa0.json"
    },
    "drone-test": {
      "id": "83af9960667d769f621a4a70ad03a970",
      "key": "drone-test/83af9960667d769f621a4a70ad03a970.json"
    },
    "cameras": {
      "key": "cameras/<hubId>.json"
    },
    "gis": {
      "key": "gis/<hubId>.json"
    },
    "hoa": {
      "slug": "highlands",
      "key": "hoa/highlands.json"
    }
  },
  "views": {
    "security": "satellite",
    "wildfire": "satellite",
    "plane": "plane",
    "drone": "drone",
    "drone-test": "drone-test"
  }
}
```

`views` values are **`files` keys**, not raw hashes. Product code resolves `idx.views.plane` → `idx.files.plane.key`. GitHub Pages indexes still use string hashes (`views.plane = "<hash>"`) until that surface is cut over — do not rewrite live Pages files to this shape until the viewer there can read both.

During dual-run, a reader that must support both:

1. If `files.plane.key` exists, fetch that records-bucket key.
2. Else if `views.plane` is a string, use the old `data/plane/{id}.json` Pages path.

Do not unify satellite `site_no` hashes with responder-drone name hashes. The index is the join.

## Cutover (do not skip)

1. Keep `responder-intel.vyanet.com` on the current Pages repo until a given record type is served from this bucket.
2. One writer per type. When Apps Script PUTs `plane/{id}.json` here, it stops PUTting `data/plane/` to GitHub for live rows (test fixtures in git are fine).
3. Product viewers prepend `https://d1h1on7f1v1lpy.cloudfront.net/` to `files.*.key`. Do not point records at `d3fg47bqswi0rr.cloudfront.net`.
4. After still/JSON overwrite: invalidate the object key. Existence: `s3.head_object`.
5. `pins-catalog.json` stays code/vocabulary (git or a later non-customer prefix). Do not flatten `role=`.
6. Parcel GeoJSON is public GIS on **tiles** `parcels/`, not the records bucket. Per-property GIS facts are `gis/{hubId}.json` on records.
7. Jones cameras / plane / drone attach to mothership hub `d9f759…` (Satellite site_no **14725**). Do not also publish them onto 33278 / 34734. Eugene cameras JSON and stills live on the site_no hub `8eea64e5…` (no GitHub sibling copy).

## Changelog

- **2026-09-14** — Drone-test dual-writes GitHub Pages (`data/drone-test/{id}.json` + merged `data/index/{hubId}.json`) so `vyanet-viewer` 3D can load `viewer360`. S3 records stay the mothership write. `recordsJoinViewIndex_` uses `droneTestHubId_` (existing index by name/address) because Gud Cultures has no Satellite site_no.
- **2026-09-11** — Drone is the dual-write exception: `data/responder-drone/` and `data/drone/` go to GitHub Pages on `jonahbourgeois1/property-intel` (live `responder-intel.html` links) **and** `s3://property-intel-records/responder-drone/`. Satellite / plane / Nearmap stay S3-only.
- **2026-09-11** — Sheet Sync/Publish writes records S3, not GitHub. `pushAllToGitHub` is a trampoline to `pushAllToRecords_`. Paths `data/{satellite,plane,responder-drone,drone-test,nearmap,hoa,pins,index,…}` map onto mothership keys. GitHub-shaped indexes convert to `files`/`views` and merge. Cameras/GIS still git-sourced; drone-test may refresh cameras JSON onto the site_no hub. Full Satellite sync still 6-min capped.
- **2026-09-11** — Cameras and GIS are git-owned (`data/cameras/json`, `data/cameras/images`, `data/gis`). The Sheet has no camera array and no GIS facts. AWS fill is git → S3 (`tools/publish-records-static.py` / `publishRecordsSidecarsFromGithub`), not `publishRecordsFromSheets`. Hub remap: Jones `6de88883…` → `d9f759…` (site_no 14725); Eugene `4a484f8c…` → `8eea64e5…`. Tracy GIS `2dce25a3…` skipped. Parcel tiles stay git `data/parcels/` → tiles `parcels/`.
- **2026-09-11** — One-shot static publish: `tools/publish-records-static.py` syncs 506 parcel tiles to `s3://property-intel-tiles/parcels/` and camera stills to `tiles/cameras/{hubId}/`. Cameras JSON + GIS facts go on mothership hubs (`cameras/{hubId}.json`, `gis/{hubId}.json`). Jones (14725) index now lists satellite, nearmap, plane, drone, drone-test, cameras, gis, pins, hoa. Eugene cameras sit on `8eea64e5…`. Overnight sheet walk remains the writer for satellite/plane/drone/nearmap/hoa JSON (hash salt + sheet).
- **2026-09-11** — S3 GET/PUT retry 4× on UrlFetch "Address unavailable", 503/500/429. Failed sheet rows are queued (`failRows` + parse of `errors`) and retried in a `retry` phase before HOA. Menu: Retry failed mothership rows (does not move the overnight checkpoint). Overnight can keep running.
- **2026-09-10** — Overnight: `startRecordsSheetAuto` installs a 5-minute trigger (`recordsSheetAutoTick_`) that resumes the mothership checkpoint until Finished, then deletes itself. ScriptLock skips overlap. No UI in the tick. Cancel mothership also removes the trigger.
- **2026-09-10** — Long-term AWS layout: hub = `hashId(slug(site_no))` from the Satellite tab. `publishRecordsFromSheets` writes satellite/plane/drone/drone-test/nearmap/hoa from the sheets and upserts one index per house. No GitHub copy, no name-hash hubs, no Jones-alias. View-record ids unchanged (plane `name-plane`, responder-drone frozen, nearmap = site_no). GitHub Pages still live until viewers cut over. The earlier 110-hub GitHub copy left name-hash objects in the bucket; they are not the mothership layout.
- **2026-09-10** — Satellite mothership: `publishRecordsFromSatelliteSheet` writes `satellite/{hashId(slug(site_no))}.json` from the Satellite tab (same payload as `processSatelliteSheet`), upserts `index/{satId}` plus a name/address production hub when one exists (Jones `6de88883…` keeps plane/drone). Identity stubs when pins are missing. HOA membership rebuilt from the sheet at the end. GitHub hub copy only brought satellite when `data/index` already listed security/wildfire.
- **2026-09-10** — Mass publish: `publishRecordsAllHubs` collects unique production hubs from Satellite, Plane, drone-test, Drone, Interior, Nearmap; copies each GitHub hub to records; checkpoints every hub; pauses at 4.5 min. Menu: Resume / Status / Cancel. Skips drone-test-only forks. Does not stop GitHub sync.
- **2026-09-10** — CloudFront dist `E2GZ8OZSJKL173` = `d1h1on7f1v1lpy.cloudfront.net`, OAC `E2T7PZUADL625G`, bucket policy GetObject from that dist only. CachingDisabled + CORS matching tiles. Probe `_probe/cloudfront.json` GET 200; missing key 404; anonymous S3 REST 403; GET with `Origin: https://responder-intel.vyanet.com` returns `Access-Control-Allow-Origin: *`. No Apps Script writer; live readers still GitHub `data/`.
- **2026-09-10** — First clause. New bucket `property-intel-records` (us-east-1, public access blocked, AES256, versioning on, BucketOwnerEnforced, tags `project=property-intel` / `purpose=published-records`). Index `files` is the locator source of truth. Live readers still GitHub `data/`.
