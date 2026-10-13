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

Do **not** put records in `property-intel-ingest` (raw) or mix them into `property-intel-tiles` except the serving prefixes that belong there (`captures/`, Nearmap rasters, `cameras/{hubId}/` stills, `parcels/`). Lambda never writes GitHub. GitHub Actions never call AWS. Apps Script writes sheet-built JSON. Git-owned cameras/GIS/parcels are copied by the operator script (or the GitHub sidecar for JSON only). SAFE report panels are the one binary that lives in this bucket; see **SAFE reports**.

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
  safe/{hubId}/report.json
  safe/{hubId}/s.jpg
  safe/{hubId}/a.jpg
  safe/{hubId}/f.jpg
  safe/{hubId}/e.jpg
```

`responder-drone/{id}` keeps the **frozen** customer ids (`hashId(slug(account name))`). Do not rename those files. `drone-test/` is not a production view.

Source binaries stay on tiles / ingest. Camera stills: `s3://property-intel-tiles/cameras/{hubId}/cam-NN.jpg` (same hub id as the records JSON). Raw technician photos stay ingest-only. GLBs, nadirs, Nearmap rasters, and **county lot-line tiles** stay on tiles. The child JSON (plane, cameras, nearmap) holds those URLs. The index does not duplicate them. The four SAFE panel JPEGs are the exception: they are the report, and they live under `safe/{hubId}/` in this bucket.

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
| `safe` | `safe/{hubId}/report.json` | hub id. Omit until a report exists. Image keys live in the report, not on the index. |

If a future interior (or other) view record is published, add `files.interior` the same way. Do not flatten pin-catalog `role=`.

## SAFE reports

No numbered segment contract covers this. This section is the clause.

A SAFE report is one property’s four panels — Security, Access, Fire, Environment — the pages in the Gartland packet (annotated nadir, oblique strip, what to know, recommendations). The unit of work is one Satellite sheet row. The folder name is the hub id, `hashId(slug(site_no))`. Blank `site_no` is skipped. Address is printed on the panel; it is not the key. 410 SW Columbia is two rows, so an address folder would collide.

```text
s3://property-intel-records/safe/{hubId}/report.json
s3://property-intel-records/safe/{hubId}/s.jpg
s3://property-intel-records/safe/{hubId}/a.jpg
s3://property-intel-records/safe/{hubId}/f.jpg
s3://property-intel-records/safe/{hubId}/e.jpg
```

The four JPEGs are the report images. Each one is a finished panel with the imagery baked in, the way the Gartland pages are. They are not a second copy of the plane capture, the Nearmap survey, or the camera stills. Those stay on tiles. A lens with nothing to add still gets a panel (Gartland Security: no cameras, imagery-only read). Environment is a look-list: debris, roof and road condition, irrigation. The panel says what is visible. It does not specify the maintenance.

`report.json` is `property-intel-records/safe-report-v1`. Image keys are bucket-relative, same rule as `files.*.key` (no `https://` or `s3://` stored in the file).

```json
{
  "schema": "property-intel-records/safe-report-v1",
  "id": "<hubId>",
  "name": "Gartland residence",
  "address": "3255 NW Celilo Ln, Bend OR 97703",
  "generated": "2026-10-08T18:00:00Z",
  "images": {
    "S": "safe/<hubId>/s.jpg",
    "A": "safe/<hubId>/a.jpg",
    "F": "safe/<hubId>/f.jpg",
    "E": "safe/<hubId>/e.jpg"
  },
  "lenses": {
    "S": { "status": "", "considerations": "", "recommendations": "" },
    "A": { "status": "", "considerations": "", "recommendations": "" },
    "F": { "status": "", "considerations": "", "recommendations": "" },
    "E": { "status": "", "considerations": "", "recommendations": "" }
  }
}
```

### Match the row to a hub

The bot is tasked with specific rows (Satellite, or another mothership tab). It writes only after it has resolved that row to one hub id. The id is `satPropertyId_(site_no, HASH_SALT)` — the same call Sheet Sync uses (`hashId` of `slugify(site_no)` plus the `HASH_SALT` Script Property). Hashing the account name, the address, or the capture name produces a different id. Jones is the worked example: the mothership hub is site_no **14725**, not `hashId("jones")` (`6de88883…`).

1. The task names a `site_no`, or the row has one in its site_no column. `hubId = satPropertyId_(that value)`. Blank is a skip. `hashId('')` is a real hash that every empty row would share.
2. The task names another mothership row (plane, drone, Nearmap, interior) and that row’s own site_no cell is blank. Look up the Satellite tab the same way `indexHubId_` does. A unique account name wins. If the name matches more than one row, a unique address is the fallback. Zero matches, or more than one name and more than one address: stop. Do not guess. Do not hash the name. 410 SW Columbia is two Satellite rows; address is not a key.
3. The task names a 32-hex id. `s3.head_object` `index/{id}.json`. Read `site_no` off that index (or the satellite object it points at) and recompute `satPropertyId_`. Write only when the recomputed id equals the id in the task. A name-hash index that does not equal the site_no hash is reported and skipped.

### Place or create

S3 has no separate folder object. The prefix `safe/{hubId}/` appears when the first object is PUT.

1. `s3.head_object` on `safe/{hubId}/report.json`. Never a CloudFront HEAD.
2. **Place.** The object exists. Overwrite `report.json`, `s.jpg`, `a.jpg`, `f.jpg`, and `e.jpg` in that prefix.
3. **Create.** The object is missing. PUT those same five keys. That is the new folder.
4. `s3.head_object` on `index/{hubId}.json`. When it exists, read it, follow `files` for the imagery inputs, and merge `files.safe = { "key": "safe/{hubId}/report.json" }` only. Leave every other `files` and `views` key. When it does not exist, still write the report. Do not create the index. Creating an index from a name or an address is how a second hub gets minted.
5. Content-Type `image/jpeg` and `application/json`. Versioning is on, so the previous report can be restored. Do not add a `views` entry until a viewer tab exists. Viewers must not guess `safe/{hubId}/report.json` when `files.safe` is absent.

### Writer

The bot does not hash the id and does not hold an AWS key. Before any upload it calls `GET ?route=safe-dest` (`site_no`, or `hub`, or `name` + `address`). It then posts one part at a time to `POST ?route=safe-put` (`part` is `report`, `S`, `A`, `F`, or `E`). The script writes that object to `safe/{hubId}/` with the records credentials already in Script Properties. A JPEG is base64, must start with the JPEG marker, and must be at most 12MB. The script sets `report.json` `id` and `images` from the hub. After all five exist, `POST ?route=safe-attach` checks each key on the records bucket and, when the index already exists, merges `files.safe`. Apps Script cannot send HTTP HEAD (`UrlFetchApp` rejects `method: "head"`), so that check is a signed GET of the first byte against the S3 host. It is not a CloudFront request. It does not create the index. The bot does not write GitHub and does not PUT `satellite/`, `plane/`, `nearmap/`, `cameras/`, `pins/`, `gis/`, or tiles. Sheet Sync keeps owning those, and a later sync merge leaves `files.safe` in place. The records distribution is CachingDisabled, so these overwrites do not need a CloudFront invalidation while that stays true.

A property with no report has no `safe/{hubId}/` prefix and no `files.safe` key.

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

## Camera scans

No numbered segment contract covers this. This section is the clause. The runner writes it with `POST ?route=scan-put`.

A camera scan is one live frame from one CHEKT camera, plus a description of that frame. The property folder is the SAFE hub, `hashId(slug(site_no))`, the same id as `safe/{hubId}/`. Resolve it the same way as `safe-dest`. Do not use the Chekt row's Property hub id when that id is the older name hash. The camera subfolder is the CHEKT device id. The file name is the request time in UTC, `yyyyMMddTHHmmssfffZ`. The JPEG and the description share that name.

```text
s3://property-intel-records/camera-scans/{hubId}/{deviceId}/{stamp}.jpg
s3://property-intel-records/camera-scans/{hubId}/{deviceId}/{stamp}.json
```

Worked example, the Jones driveway. SAFE hub is site_no **14725**, `d9f759d7351db3886c79dd689c41e3c0`. The gateway roster for the same house is still the Chekt hub `6de88883bfd4a8349a901c54611ed9d7`. `/live?property=` uses the Chekt hub. The object key uses the SAFE hub.

```text
camera-scans/d9f759d7351db3886c79dd689c41e3c0/4350156/20261009T184733762Z.jpg
camera-scans/d9f759d7351db3886c79dd689c41e3c0/4350156/20261009T184733762Z.json
```

`{stamp}.json` is `property-intel-records/camera-scan-v1`. Keys inside it are bucket-relative. No `https://`, no `s3://`, no snapshot token, no mjpeg URL, no password.

```json
{
  "schema": "property-intel-records/camera-scan-v1",
  "hub": "d9f759d7351db3886c79dd689c41e3c0",
  "device_id": "4350156",
  "name": "DRIVEWAY",
  "requested_at": "2026-10-09T18:47:33.762Z",
  "received_at": "2026-10-09T18:47:34.903Z",
  "source": "mjpeg",
  "previous": "",
  "description": "",
  "reviewed_at": ""
}
```

Two jobs write this record, and they do not call each other. The runner retrieves the frame and creates the JPEG and the JSON. It sets `description` to `""` and `reviewed_at` to `""`. It never reads the picture. The bot does not retrieve a frame. Its queue is a scan whose `previous` is set and whose `reviewed_at` is empty. It reads that JPEG and the previous JPEG, then overwrites the same JSON: `reviewed_at` becomes the review time, and `description` stays `""` unless the new frame shows something irregular. The stamp does not change, and a second object is not created. A first scan has `previous` `""`, so it is the baseline and is not a review.

`description` is the only sentence a customer sees. It is empty when the frame shows nothing irregular. A person, a vehicle, or an object that does not belong in the usual scene is a description. A standing condition that is already in the previous frame stays empty. `previous` is the bucket-relative key of the prior JPEG in this camera folder, or `""` on the first scan. The previous file is the one whose stamp sorts immediately before this one. A failed grab writes neither object, so the last pair remains the baseline.

The picture is the first JPEG from that camera's live stream. One `/live` per property per pass mints every camera token. Offline cameras are skipped. The stream is closed after the first frame. The snapshot URL is not called. On the Jones driveway it returned 404, and the stream returned a 38KB JPEG in 1.1 seconds. Tokens stay in memory for that pass and are not stored. A cadence inside 60 minutes may reuse that `/live` response until `expires_in`. An 8-hour pass calls `/live` once. `name` is the roster name at grab time. The folder is the device id, so a rename does not move the history.

S3 Lifecycle on this prefix expires every object 7 days after it was uploaded. One rule, filter prefix `camera-scans/`, expiration 7 days. The JPEG and the JSON sit under that prefix, so the same rule removes both. The scan worker only writes. It does not list or delete. Age is the object's upload time, which is the grab time. S3 rounds the expiry up to the next midnight UTC and removes the object on its daily pass, so a frame from `2026-10-09T18:47:33Z` becomes eligible at `2026-10-17T00:00:00Z` and may linger a few hours after that. If the bucket has versioning on, the same rule also expires noncurrent versions, or the old bytes stay. These objects stay out of GitHub `data/`, out of `property-intel-tiles`, and out of the public CloudFront distribution. A scan does not rewrite `index/{hubId}.json`. The portal lists the camera folder. A `previous` key that lifecycle has already removed means that scan is a new baseline.

The runner writes with `POST ?route=scan-put`, one object per request. `part` is `jpeg` or `json`. Content-Type is `text/plain`. The script holds the AWS credentials. The runner does not receive a key. The script checks that `hub` is the SAFE hub on `index/{hub}.json` (site_no hash) and builds the key itself. `description` and `reviewed_at` are stored as `""` on this route.

The operator viewer lists frames with `GET ?route=scan-list` and loads one picture with `GET ?route=scan-frame`. Both take the Chekt row password (`pass`) and the Chekt hub or the SAFE hub. The script checks the password against the enrolled row, then walks each frame's `previous` pointer. It does not list the bucket, and the picture is not loaded from CloudFront. `scan-list` without `device` returns each camera's newest frame. With `device`, it returns up to 40 frames, newest first. `notable=1` skips empty descriptions and stops after 80 reads. `start` continues from an older key. The password is not written into the scan record.

The bot reads with `GET ?route=scan-next&review_key=` and writes with `POST ?route=scan-review`. `review_key` matches Script Property `SCAN_REVIEW_KEY`. The value is not in the repo. `scan-next` returns one pair whose `previous` is set and whose `reviewed_at` is empty, including both JPEGs. `scan-review` sets `description` and `reviewed_at` on that same JSON key. The JPEG and the stamp do not change. A scan still does not rewrite the index.

## Cutover (do not skip)

1. Keep `responder-intel.vyanet.com` on the current Pages repo until a given record type is served from this bucket.
2. One writer per type. When Apps Script PUTs `plane/{id}.json` here, it stops PUTting `data/plane/` to GitHub for live rows (test fixtures in git are fine).
3. Product viewers prepend `https://d1h1on7f1v1lpy.cloudfront.net/` to `files.*.key`. Do not point records at `d3fg47bqswi0rr.cloudfront.net`.
4. After still/JSON overwrite: invalidate the object key. Existence: `s3.head_object`.
5. `pins-catalog.json` stays code/vocabulary (git or a later non-customer prefix). Do not flatten `role=`.
6. Parcel GeoJSON is public GIS on **tiles** `parcels/`, not the records bucket. Per-property GIS facts are `gis/{hubId}.json` on records.
7. Jones cameras / plane / drone attach to mothership hub `d9f759…` (Satellite site_no **14725**). Do not also publish them onto 33278 / 34734. Eugene cameras JSON and stills live on the site_no hub `8eea64e5…` (no GitHub sibling copy).

## Changelog

- **2026-10-12** — `scan-next` reviews every stored frame, not only the newest 80. It walks each camera from the oldest previous link forward. The first frame stays a baseline. Critique build `v6.8.18`.
- **2026-10-12** — Operator viewer. `GET ?route=scan-list` and `GET ?route=scan-frame` show stored frames for one enrolled property. The Chekt row password gates them. The list walks `previous`. Critique build `v6.8.17`. Page: `scan-viewer.html`.
- **2026-10-12** — `scan-next` loads the JPEGs for the first unreviewed pair only. The rest of the queue stays put. The queue on the state file still keeps the newest 80. Critique build `v6.8.16`.
- **2026-10-09** — Scan clock state is one object per enrolled row, `camera-scan-state/{hubId}.json`, on the records bucket. It is not a Script Property and it is not under `camera-scans/`, so the 7-day lifecycle does not remove it. The next wake copies the old `scan-seen`, `scan-slot`, `scan-mins`, and `scan-prev` properties into that file and deletes them.
- **2026-10-09** — Bot review routes. `GET ?route=scan-next` returns one unreviewed pair. `POST ?route=scan-review` sets `description` and `reviewed_at` on that JSON. Script Property `SCAN_REVIEW_KEY` gates both. Critique build `v6.8.14`. The grab route still stores an empty description.
- **2026-10-09** — Scan hours, not minutes. `.25` is 15 minutes, `.5` is 30 minutes, and a whole number is that many hours on the hour. The clock is still `chektScanTick`.
- **2026-10-09** — The scan clock is Apps Script `chektScanTick` (every 5 minutes). A checked row runs on the mark that divides the hour. Pictures come from gateway `GET /scan`. The script writes S3. The first pass after the clock starts waits for the next mark.
- **2026-10-09** — `POST ?route=scan-put` writes one camera-scan object (JPEG or JSON) under `camera-scans/{hubId}/{deviceId}/`. The script holds the AWS key. `description` and `reviewed_at` stay empty. Critique build `v6.8.13`. Paste `records.gs` and `critique-api.gs`, save, and deploy a new version. `?route=ping` must show `scan_put: true`.
- **2026-10-09** — Camera scans split retrieval from review. The runner writes the JPEG and the JSON with `description` and `reviewed_at` empty. The bot overwrites that JSON only: it sets `reviewed_at`, and sets `description` only when the new frame is irregular. A scan with an empty `previous` is a baseline and is not reviewed. The runner does not call the bot.
- **2026-10-09** — Camera-scan folder is the SAFE hub (`hashId(slug(site_no))`, Jones site_no 14725 → `d9f759d7351db3886c79dd689c41e3c0`). `/live` still uses the Chekt roster hub. Description overwrites the same JSON key. The picture is the first live-stream JPEG after one `/live` per property. The snapshot URL is not called.
- **2026-10-09** — Camera scans. New prefix `camera-scans/{hubId}/{deviceId}/` on `property-intel-records`. One JPEG and one JSON per scan, both named with the UTC request time `yyyyMMddTHHmmssfffZ`. The JSON is `camera-scan-v1` and holds `description` (empty when nothing is irregular). 7-day expiry. No writer route yet.
- **2026-10-08** — SAFE existence checks no longer use `method: "head"`. `UrlFetchApp` rejects that method before the request is sent, which made `safe-dest` return `Attribute provided with invalid value: method`. The check is now a signed GET `Range: bytes=0-0` on the S3 host. Critique build `v6.8.11`. Paste `records.gs` and `critique-api.gs`, save, and deploy a new version of the deployment that just pinged v6.8.10.
- **2026-10-08** — `POST ?route=safe-put` writes one SAFE object (the report JSON or one panel JPEG). The bot does not receive an AWS key. Critique build `v6.8.10`. Paste `records.gs` and `critique-api.gs`, save, and deploy a new version. `?route=ping` must show `safe_put: true`.
- **2026-10-08** — SAFE report routes. `records.gs` accepts `safe/{hubId}/report.json` and the four panel JPEGs. `GET ?route=safe-dest` returns the hub and those keys (`place` or `create`). `POST ?route=safe-attach` merges `files.safe` only after all five objects exist, and does not create an index. Critique build `v6.8.9`. Paste `records.gs` and `critique-api.gs`, save, and deploy a new version. `?route=ping` must show `safe_dest: true` before the bot runs.
- **2026-10-08** — SAFE report bot. A tasked row resolves to one hub with `satPropertyId_(site_no, HASH_SALT)` before any PUT. Another mothership tab with a blank site_no joins the Satellite tab only on a unique match (site_no, then address, then name). A supplied 32-hex id is rewritten only when it equals that site_no hash. Existing `safe/{hubId}/report.json` is overwritten; a missing key is the create. The bot still does not create `index/{hubId}.json`.
- **2026-10-08** — SAFE reports. New prefix `safe/{hubId}/` on `property-intel-records`: `report.json` plus four panel JPEGs (`s.jpg`, `a.jpg`, `f.jpg`, `e.jpg`). Hub id stays `hashId(slug(site_no))`. The job writes only that prefix and, when an index already exists, merges `files.safe`. It does not create an index and does not move captures, Nearmap, or camera stills. No viewer tab yet.
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
