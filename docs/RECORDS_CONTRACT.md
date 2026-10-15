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
  property-profile/{hubId}.json
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

The operator viewer lists cameras with `GET ?route=scan-list`. That call takes the Chekt row password (`pass`) and the Chekt hub or the SAFE hub. The script checks the password against the enrolled row. `scan-list` without `device` returns each camera's newest frame and, when the script key can list the bucket, every JPEG name in that camera folder (`keys`, newest first, at most 500). The page sets every picture address in one pass, then the browser loads them together from `https://d1h1on7f1v1lpy.cloudfront.net/`. The password gates the list. The names are not written to a public catalog object. `s3:ListBucket` is required on `arn:aws:s3:::property-intel-records` with prefix `camera-scans/*`. If that permission is missing, the page follows `previous` and still reveals the grid in one pass after the chain is known. `GET ?route=scan-frame` still returns one JPEG through the script. The page does not use it. The password is not written into the scan record.

A saved patrol schedule replaces Scan hours for that row. The object is `camera-scan-patrol/{chektHub}.json`, schema `property-intel-records/camera-scan-patrol-v1`. It is not under `camera-scans/`, so the 7-day lifecycle does not remove it, and it is not the scan-state file the bot walks. `qa` is `bronze`, `silver`, `gold`, or `platinum`. Each camera on the row adds 12, 24, 48, or 96 reviews to one shared daily pool. `times` maps a CHEKT device id to `HH:mm` values on 5-minute marks in the spreadsheet timezone. The same list repeats every day. One camera may hold every time in the pool. A camera cannot hold two reviews at the same minute, so it holds at most 12 in any hour. The total across cameras cannot exceed the pool. The password on the Chekt row reads and writes it (`GET` and `POST ?route=scan-patrol`). The viewer can fill every camera from a preset (all day, work hours, or evening). That fill is not stored until Save. The operator can change or remove those times, or skip the preset and type times on each camera. Until that object exists, the clock keeps using Scan hours and grabs every online camera. Once it exists, column M is ignored and the clock grabs only the cameras listed at the current 5-minute mark. A grab at that mark is the review. Unscheduled times produce no JPEG. Old frames are not rewritten. The gateway `only` parameter limits the CHEKT call to those device ids. The SAFE portal asks for the Chekt row password before the portal opens. The password stays in the browser for that visit and is not put in the page address. After it is accepted, the portal reads the patrol object and the scan JSON and starts loading the pictures. Virtual Patrol opens on the 24-hour schedule. Images and notes are separate subtabs. Images open on one camera. Notes open on all cameras, and that list is the notes index rather than every stored frame. The schedule save is the only write. Home lists frames whose description is not empty.

A patrol grab whose `previous` is set is pushed onto that row's review queue immediately. `scan-next` hands the bot one of those frames before it continues the older history walk. When nothing is waiting, the bot waits 5 minutes and asks again, because the schedule keeps storing frames.

`scan-review` is a POST. The same write also accepts `GET ?route=scan-review&review_key=&key=&description=` so a redirect that drops the body still saves when those fields are on the query string. `ok: true` with `already: true` means that key was saved on an earlier try. A failed response leaves the pair on the queue.

The bot reads with `GET ?route=scan-next&review_key=` and writes with `POST ?route=scan-review`. `review_key` matches Script Property `SCAN_REVIEW_KEY`. The value is not in the repo. `scan-next` returns one pair whose `previous` is set and whose `reviewed_at` is empty, including both JPEGs. `scan-review` sets `description` and `reviewed_at` on that same JSON key. The JPEG and the stamp do not change. A scan still does not rewrite the property index. A non-empty description is also merged into `camera-scan-notes/{chektHub}.json` (schema `property-intel-records/camera-scan-notes-v1`, newest 400). That file is not under `camera-scans/`, so the 7-day lifecycle does not remove it. The SAFE portal reads that one object for the Notes tab and for Home. It does not walk every stored frame to find sentences. `POST ?route=scan-notes` with the Chekt row password merges a list into the same object, which is how the first visit after this change saves the sentences it already found. Quiet reviews are not notes.

## Live station

No numbered segment contract covers this. This section is the clause. It is a different job from camera scans. The scan bot reviews stored pairs. The live bot watches Jones and decides every clip.

The first station is Jones only. SAFE hub `d9f759d7351db3886c79dd689c41e3c0` (site_no 14725). `/live` still uses the Chekt hub `6de88883bfd4a8349a901c54611ed9d7`. The object key uses the SAFE hub.

The 24/7 holder is one always-on task in us-east-1. It is not a Lambda. A Lambda cannot keep the twelve streams open. The task runs the station program. Its IAM role may get and put `camera-watch/`, `camera-live/`, and `camera-station/` on `property-intel-records`. It does not need to list the bucket. The image is `719781265739.dkr.ecr.us-east-1.amazonaws.com/property-intel-live-station:station-270d0331dd1d`, digest `sha256:fbfdcd1868d689734ddc036f22fbaa3a095d4cba5e9b035070fb3d08220175de`. The tag is `station-` plus the first 12 hex digits of the SHA-256 of the Dockerfile, `requirements.txt`, `live_station.py`, and `grab_one.py`. Tags are immutable and the repository is scanned on push. Encryption is AES256. The live-station customer key is not used. The build context is those station files only. The build runs `--self-check` and does not open Jones. The image has no password, no watch token, no AWS access key, and no GitHub access. The Jones Chekt row password is Secrets Manager `arn:aws:secretsmanager:us-east-1:719781265739:secret:property-intel/live-station/jones-password-S70DY5`. The watch token is `arn:aws:secretsmanager:us-east-1:719781265739:secret:property-intel/live-station/watch-token-0ZGcf4`, the same value as Script Property `LIVE_WATCH_TOKEN`. The script reads that token from a gitignored file and does not mint a new one. Both secrets use the Secrets Manager default key. The live-station customer key stays limited to S3. Role `live-station-task` cannot read these secrets. Role `arn:aws:iam::719781265739:role/live-station-execution` injects them into the task environment. That role may pull `property-intel-live-station` and may read only those two secrets. It may write log group `/property-intel/live-station`. It cannot read the records bucket and it cannot use the live-station customer key. Only an ECS task in this account may assume it. Log group `/property-intel/live-station` keeps task output for 14 days. It was already present. Encryption is the CloudWatch default. The live-station customer key is not used. No task is started. The dealer key stays in the gateway.

Client video is kept by controls that refuse the wrong caller. The task has no public address. Its security group `live-station` is `sg-0eb888721c6ad9e82` in default VPC `vpc-0f0648c379e657c16`. It has no inbound rule. The default allow-all outbound rule was removed. A security group cannot name the CHEKT gateway hostname, because that address changes. Outbound is DNS to the VPC, port 443 to the S3 prefix list, and port 443 to the internet for the gateway and Secrets Manager. A later private endpoint can take Secrets Manager off that internet rule. The task uses private subnet `subnet-03b49dfcc78292f80` (`172.31.96.0/24`, `us-east-1a`) in this VPC. Its default route is NAT gateway `nat-0aaa3bd5a744f736b` in public subnet `subnet-0e7199592ab9503d8`. Route table `rtb-01dec0335cb11792c` holds that route. S3 gateway endpoint `vpce-079d2368461e59340` on that route table keeps bucket traffic off the NAT. Public subnets were not changed. Service `live-station` is on cluster `live-station`, task definition `live-station:2`: 1 vCPU, 2 GB, image `station-270d0331dd1d`, private subnet, security group `sg-0eb888721c6ad9e82`, public address disabled. The execution role injects the two secrets. The customer key is not set on the task yet, so writes use the bucket default. Desired count is 1 and running count is 1. Task `1d39e65f5dd54057a5753e478aa3437c` is watching 12/12. The wall write took 3953 ms. The address is private. Fargate is the holder. The PC station is down. `tools/camera-scan/Start-LiveStationOnFargate.ps1` refuses to raise the count while the PC station is running, and it puts the count back to 0 if a start stops before the task is watching. `AWSServiceRoleForECS` is present. `iam:CreateServiceLinkedRole` is on attached policy `PropertyIntelLiveStationService`. The count actions list, describe, and update are allowed in us-east-1. Unused managed policy `PropertyIntelLiveStationEcsRole` was deleted. The bucket blocks public access and refuses non-TLS uploads. The watch object and the clips are encrypted with customer key `alias/property-intel-live-station` in us-east-1. Decrypt and data-key generation are allowed only through S3, and only for `property-intel-records`. The key policy names `arn:aws:iam::719781265739:user/Jonah`, the user behind Script Property `AWS_ACCESS_KEY_ID`. The task role `arn:aws:iam::719781265739:role/live-station-task` is the other data principal. That role may get and put only `camera-watch/`, `camera-live/`, and `camera-station/`. It may use the live-station key only through S3 for `property-intel-records`. Only an ECS task in this account may assume it. The role is on the key. No task was started. The account can administer the key and cannot decrypt through that statement. The bucket default stays AES256. This alias does not encrypt the other records prefixes. The key id is `e19f5afa-0acd-4db3-9c65-db6ea029dac0`. IAM user `Jonah` holds `PropertyIntelLiveStationKey` so he can create that key. That policy cannot decrypt. They are not published on CloudFront. A stable public name for a live wall would be a live camera on the internet. CloudTrail records reads and writes of those prefixes. Logs never contain a stream URL, a token, a password, or a review key. A bot is granted specific hubs. A look or a clip for any other hub is refused. At fleet size, each task holds one slice of the roster and can read only that slice's password. The PC test is not this bar.

The task holds the streams and keeps about five seconds from each camera in memory. It writes the current wall straight to one overwritten object, `camera-watch/{token}.json`, schema `property-intel-records/camera-watch-v1`. The same object includes `feed_base64`, the next stretch of that wall at 2 frames a second, about 15 seconds, starting where the previous stretch ended. The running task still publishes the rolling 18-second file until the next image is running. It does not send that JPEG through Apps Script. The token is Script Property `LIVE_WATCH_TOKEN`, created on first use. The task reads the same value from its environment. It is not a saved event, it is not under `camera-live/`, and `scan-list` does not return it. The bot never receives the token, the object key, or a stream URL.

The task does not call Apps Script. The bot still uses `live-look` and `live-clip`. Those routes and the task meet in one object, `camera-station/{token}.json`, schema `property-intel-records/camera-station-v1`. The token is the same `LIVE_WATCH_TOKEN`. This prefix is not `camera-live/` and not `camera-watch/`, so the 7-day rule does not expire it and it is not the wall. The bot never receives this key.

```json
{
  "schema": "property-intel-records/camera-station-v1",
  "orders": [
    {"id": "0123456789abcdef0123456789abcdef", "action": "start", "device_id": "4350159"},
    {"id": "fedcba9876543210fedcba9876543210", "action": "stop", "device_id": "4350159", "description": "A person in a dark jacket walked across the front courtyard path."}
  ],
  "finished": []
}
```

`id` is 32 hex, minted by the script. `live-clip` appends one order and writes the object back with `If-Match`, so a concurrent write is not erased. A lost race reads the object again. The task takes the orders the same way, then writes `finished` for the clip it just saved. `live-look` returns that list and clears it. `live-look` also returns `station: true` when that read succeeded. The bot ignores `station`.

The same `live-clip` still queues the order for the PC test. When the PC beat takes it, the script removes that id from the object, so a later task does not play it again. One holder at a time. The PC test and the task are not both connected to Jones.

A station with no task role, including the PC test, still posts that wall with `POST ?route=live-beat`. That path is what drops the connection and waits on the project lock. It stops being the watch once the task is on. Passing `--s3` is the only way to write the bucket from a machine that is not the task. The PC test leaves it off.

The bots have constant access. They patrol the live feeds 24 hours a day, including when the operator's PC is off. A look is the normal state, not a shift and not a scheduled grab. The task has to be running for that access to be real. `live: false` means the bot has lost the feeds.

The bot reads with `GET ?route=live-look&review_key=&since=`. `since` is the `feed_to` it already watched. The response is the wall JPEG, the next wall stretch (`feed_base64`, `feed_from`, `feed_to`, `feed_fps`, `feed_seq`), the roster in sheet order, and any clip the station just finished. The deployed web app does not read `since` until v6.8.28 is deployed. An empty `feed_base64` means the video is not ready. `live: false` means the wall is older than 45 seconds. `GET ?route=live-wall` is the same picture and video for a person. It does not clear finished clips. When an event is happening, the bot starts and stops the clip with `POST ?route=live-clip`. The station obeys those orders. A still, a video, and a description are written only when the bot stops a clip. A quiet feed writes nothing. The description is one sentence for the whole visit.

```text
s3://property-intel-records/camera-live/{hubId}/{deviceId}/{stamp}.jpg
s3://property-intel-records/camera-live/{hubId}/{deviceId}/{stamp}.mp4
s3://property-intel-records/camera-live/{hubId}/{deviceId}/{stamp}.json
```

The stamp is the clip start, `yyyyMMddTHHmmssfffZ`. The still is a full frame from the middle of the visit. The video runs from about five seconds before the bot said start until the bot said stop, at about four frames a second. New videos are H.264 (`avc1`) with the index at the front, so a browser can play them. The running image still writes MPEG-4 Part 2 (`mp4v`) until it is replaced, and a browser shows that file as a black 0:00. A clip that is still changing at two minutes is marked `maxed`. The bot stops it with the sentence for that stretch and may start the next stretch.

`{stamp}.json` is `property-intel-records/camera-live-v1`. Keys inside it are bucket-relative. No `https://`, no `s3://`, no stream URL, no password.

```json
{
  "schema": "property-intel-records/camera-live-v1",
  "hub": "d9f759d7351db3886c79dd689c41e3c0",
  "device_id": "4350159",
  "name": "FRONT COURTYARD",
  "started_at": "2026-10-13T20:55:01.000Z",
  "ended_at": "2026-10-13T20:55:18.000Z",
  "source": "live",
  "still": "camera-live/d9f759d7351db3886c79dd689c41e3c0/4350159/20261013T205501000Z.jpg",
  "clip": "camera-live/d9f759d7351db3886c79dd689c41e3c0/4350159/20261013T205501000Z.mp4",
  "description": "A person in a dark jacket walked across the front courtyard path.",
  "seconds": 17.0,
  "saved_at": "2026-10-13T20:55:20.000Z"
}
```

`description` is one sentence, at most 280 characters, and it is required. For now any change from the standing picture is an event, including wind and shifting sun. A parked vehicle that does not move is the standing picture. The sentence covers the whole clip. Do not label anyone a trespasser.

`POST ?route=live-put` writes one part (`jpeg`, `mp4`, or `json`). The script holds the AWS key and checks `LIVE_STATION_KEY`. The station sends the still and the video. The script builds the JSON. The task writes those three objects itself and does not call this route. `scan-put` and `scan-review` do not write this prefix.

S3 Lifecycle expires every object under `camera-live/` 7 days after it was uploaded. Rule id `camera-live-7-day`, filter prefix `camera-live/`, expiration 7 days, noncurrent versions 7 days. The JPEG, the video, and the JSON sit under that prefix, so the same rule removes all three. That prefix does not match `camera-watch/` or `camera-station/`. On 2026-10-14 the bucket had no lifecycle configuration, so the `camera-scans/` rule had not been applied. When the configuration is absent, the script writes `camera-scans-7-day` and `camera-live-7-day` together. When other rules are already present, it keeps them and still requires the scans rule to be one of them. Age is the object's upload time. S3 rounds the expiry up to the next midnight UTC and removes the object on its daily pass. `tools/camera-scan/Set-CameraLiveLifecycle.ps1` adds this rule beside the rules already on `property-intel-records`. It does not change the Fargate service. Both rules are on `property-intel-records`. Service `live-station` stayed at desired count 1 and running count 1. These objects stay out of GitHub `data/`. A live clip does not rewrite `index/{hubId}.json`. There is no viewer for this prefix yet.

Script Property `LIVE_STATION_KEY` gates `live-look`, `live-beat`, `live-clip`, and `live-put`. It is not `SCAN_REVIEW_KEY`. The value is not in the repo. Critique build `v6.8.24`. `?route=ping` shows `live_put: true` and `live_key: true` after the property is set and a new deployment version is created.

## Property profile

No numbered segment contract covers this. This section is the clause. It is the durable security memory for one property. The scan bot and the live bot read it before they decide how much to say. A frame change still wakes a review. The profile decides whether that review is light or full.

The object is `property-profile/{hubId}.json`, schema `property-intel-records/property-profile-v1`. `{hubId}` is the SAFE hub, `hashId(slug(site_no))`. Jones is `d9f759d7351db3886c79dd689c41e3c0` (site_no 14725). The prefix is not `camera-scans/` and not `camera-live/`, so the 7-day lifecycle does not remove it. It is not listed on `index/{hubId}.json`. The portal does not link it. The records CDN can still serve a key someone already knows. A compiled profile that names household patterns stays on the bucket copy. It is not committed back to this public repo.

The profile is compiled from the stored frames and the sentences already written on them. Those sentences are `description` on `camera-scans/` and on `camera-live/`. The frames expire after 7 days. The profile keeps what they showed. A later customer form may add routine context the pictures do not show, including who a vehicle belongs to. That form is not built. Until it exists, every character has `source` `images` and `who` `""`.

```json
{
  "schema": "property-intel-records/property-profile-v1",
  "hub": "d9f759d7351db3886c79dd689c41e3c0",
  "site_no": "14725",
  "name": "Jones",
  "address": "18775 Macalpine Loop, Bend, OR 97702",
  "account_type": "residential",
  "zone": "America/Chicago",
  "source": "images",
  "description": "Jones is a residence. Cameras look at the driveway, the front door, the front courtyard, and the garage exterior. This profile is compiled from the stored frames and the sentences on them. Characters stay empty until the same thing has been seen more than once.",
  "characters": [],
  "history": [],
  "updated_at": "2026-10-15T17:20:00.000Z"
}
```

`source` is `images` until a customer form exists. `zone` is the clock for every `when` window. Jones uses the same zone the patrol schedule stores. `description` is the standing account of the property, compiled from what the cameras have shown. `characters` are the things that count as usual. `history` is what was actually seen. One review appends a history row. It does not create a character. A character is written only when the same appearance, place, and time show up across the stored frames and their sentences.

A character:

```json
{
  "id": "white-corolla",
  "kind": "vehicle",
  "label": "White Corolla",
  "who": "",
  "source": "images",
  "appearance": "white Corolla",
  "where": "driveway",
  "when": null
}
```

`id` is a stable lowercase slug. `kind` is `vehicle`, `person`, `routine`, or `object`. `appearance` is the words the bot matches in the scene. `where` is the place or the camera name. An empty `where` means any camera. `when` is null when the character is usual at any hour. Otherwise:

```json
{
  "id": "school-bus",
  "kind": "routine",
  "label": "School bus",
  "who": "",
  "source": "images",
  "appearance": "school bus",
  "where": "out front",
  "when": {
    "days": ["mon", "tue", "wed", "thu", "fri"],
    "start": "07:00",
    "end": "09:00"
  }
}
```

`days` are `mon` through `sun`. `start` and `end` are `HH:mm` in the profile `zone`. The window may cross midnight. `who` stays empty on an image-compiled character. "Homeowner" is routine context for the later form. These two characters are the worked example of the rule. They land on Jones only after the frames and sentences support them.

A character matches when the scene fits `appearance`, `where`, and `when` together. A match is a light report: the sentence may be empty, or one short clause that names the character. A scene that fits none of the characters is a full report. A known character outside its place or outside its window is a full report, and the sentence says which part broke. A full report is one sentence, at most 280 characters. Do not label anyone a trespasser. The pictures stay the evidence.

A history row is one review:

```json
{
  "at": "2026-10-15T14:05:00.000Z",
  "device_id": "4350156",
  "camera": "DRIVEWAY",
  "character_id": "white-corolla",
  "depth": "light",
  "sentence": ""
}
```

`character_id` is `""` when nothing matched. `depth` is `light` or `full`. `sentence` is the customer sentence for that review. The script keeps rows whose `at` is inside 90 days and drops the older ones on each append. The 7-day frames stay the pictures. The profile keeps the pattern.

Tracy's house is this Jones hub. The review bot is the writer of the first profile. It compiles `description`, `characters`, and `history` from stored frames and the sentences on them. `scan-next` only returns pairs that are still unreviewed, so the first compile uses two review-key reads that do not take the property password. `GET ?route=property-profile-sources&review_key=` lists Tracy's cameras. Adding `&device=` walks that camera's previous chain, 24 frames at a time, and `older` is the next page. `GET ?route=property-profile-frame&review_key=&key=` returns one JPEG under `camera-scans/d9f759d7351db3886c79dd689c41e3c0/`. `GET ?route=property-profile&review_key=&hub=` reads the profile. `POST ?route=property-profile` writes the whole object. The body is `{"route":"property-profile","review_key":"…","profile":{…}}` with Content-Type `text/plain`. The review key is `SCAN_REVIEW_KEY`. The script refuses any other hub, refuses a non-empty `who`, and refuses a character that does not have two history rows inside the newest 200. It keeps those 200 rows inside 90 days. After Tracy's profile is saved, each of her scan reviews reads it before `scan-review`. A match is a light sentence. A miss, or a known character outside its place or window, is a full sentence. A history row is appended when the sentence is not empty or a character matched. A quiet frame does not append a row, so the newest 200 stay the sightings that support the characters. It does not add a character. The live bot does not use this profile to decide when to watch. When a ping starts an event, it GETs the profile with `LIVE_STATION_KEY` and judges the visit against `description` and `characters`. It does not POST. A full Tracy review, one non-empty sentence that is not a light character match, POSTs `?route=patrol-ping` with `SCAN_REVIEW_KEY`. A separate clock, `chektLogTick`, reads `GET /log` on the CHEKT gateway every two minutes for Tracy only. That route is one page of video events and one page of alarms from the last 15 minutes. It does not mint clip URLs. The first read is a baseline. A later new row writes the same `patrol` ping with `source` `log`. `live-look` includes the waiting ping for 20 minutes. A light match does not ping. `recordsAssertKey_` allows `property-profile/{hubId}.json`. The profile routes still accept only Tracy's hub. `?route=ping` shows `property_profile: true`, `property_profile_sources: true`, and `property_profile_key: true` after critique build `v6.8.32` is saved and a new deployment version is created. `scan-put`, `scan-review`, and `live-clip` do not write this prefix.

## Cutover (do not skip)

1. Keep `responder-intel.vyanet.com` on the current Pages repo until a given record type is served from this bucket.
2. One writer per type. When Apps Script PUTs `plane/{id}.json` here, it stops PUTting `data/plane/` to GitHub for live rows (test fixtures in git are fine).
3. Product viewers prepend `https://d1h1on7f1v1lpy.cloudfront.net/` to `files.*.key`. Do not point records at `d3fg47bqswi0rr.cloudfront.net`.
4. After still/JSON overwrite: invalidate the object key. Existence: `s3.head_object`.
5. `pins-catalog.json` stays code/vocabulary (git or a later non-customer prefix). Do not flatten `role=`.
6. Parcel GeoJSON is public GIS on **tiles** `parcels/`, not the records bucket. Per-property GIS facts are `gis/{hubId}.json` on records.
7. Jones cameras / plane / drone attach to mothership hub `d9f759…` (Satellite site_no **14725**). Do not also publish them onto 33278 / 34734. Eugene cameras JSON and stills live on the site_no hub `8eea64e5…` (no GitHub sibling copy).

## Changelog

- **2026-10-15** — Patrol notes are one object, `camera-scan-notes/{chektHub}.json`, newest 400 sentences. `scan-review` merges a non-empty description into it. `POST ?route=scan-notes` with the row password merges a list, which is how the portal saves the sentences it already found. The Notes tab reads that object. Critique build `v6.8.36`. Ping must show `scan_notes: true` after paste, save, and a new deployment version.
- **2026-10-15** — The live bot reads Tracy's profile when a ping starts an event. `GET ?route=property-profile` accepts `LIVE_STATION_KEY` again. POST stays the review key. The profile does not decide whether to watch. Critique build `v6.8.35`. Ping must show `property_profile_live_read: true` after paste, save, and a new deployment version.
- **2026-10-15** — Scheduled CHEKT log read for Tracy. Gateway `GET /log` returns one page of video events and one page of alarms from the last 15 minutes and does not mint clip URLs. Apps Script `chektLogTick` wakes every minute and reads every two minutes. The first read is a baseline. A new row pings the live bot with `source` `log`. The gateway change is not deployed until `tools/deploy_chekt_gateway.py` is run. The clock starts from the sheet menu Start CHEKT log after the script is saved.
- **2026-10-15** — A full Tracy review pings the live bot. `POST ?route=patrol-ping` stores one ping for 20 minutes, and `live-look` returns it as `patrol`. The live bot does not read the profile to decide whether to watch. Critique build `v6.8.34`. Ping must show `patrol_ping: true` after paste, save, and a new deployment version. `GET ?route=property-profile` is the review key again.
- **2026-10-15** — A Tracy history row is written for a non-empty sentence or a character match. A quiet frame is reviewed and does not append, so the newest 200 are not filled with empty scans.
- **2026-10-15** — Tracy scan reviews use the saved profile. The review bot reads `property-profile/d9f759d7351db3886c79dd689c41e3c0.json` before `scan-review`, writes a light or full sentence, and appends one history row. It does not add a character, open streams, or poll the activity log. No new route. The standing review job starts this only after the first profile reads `saved: true`.
- **2026-10-15** — `recordsAssertKey_` allows `property-profile/{hubId}.json`. The deployed v6.8.31 script refused `property-profile/d9f759d7351db3886c79dd689c41e3c0.json` before S3, so the profile read could not return `saved: false`. Critique build `v6.8.32`. Ping must show `property_profile_key: true` after paste, save, and a new deployment version. A missing object is `saved: false`. The prefix is still created by the first successful PUT.
- **2026-10-15** — Review-key reads for Tracy's existing frames. `property-profile-sources` lists cameras and walks each previous chain. `property-profile-frame` returns one JPEG under the SAFE hub. Critique build `v6.8.31` is local. The bot can be assigned after that build is pasted, saved, and a new deployment version is created. Ping must show `property_profile_sources: true`.
- **2026-10-15** — Tracy's property profile writer. Prefix `property-profile/` on `property-intel-records`. The review bot POSTs the compiled profile for hub `d9f759d7351db3886c79dd689c41e3c0` only. Critique build `v6.8.30` is local. The prefix appears when the first object is written. No new bucket. Not deployed until the script is pasted and a new version is created.
- **2026-10-15** — Property profile is compiled from stored frames and the sentences on them. `who` stays empty. A customer form for routine context is not built. A character is written only after the same thing has been seen more than once. The Jones seed is still empty and not on the bucket.
- **2026-10-15** — Property profile. `property-profile/{hubId}.json` holds the property description, named characters, and 90 days of review history. A match is a light report. A break, or an unnamed change, is a full report. The Jones seed has no characters yet. It is not on the bucket, and the read and append routes are not deployed.
- **2026-10-15** — `tools/camera-scan/Open-StationViewer.ps1` serves this repo on `127.0.0.1:8768` and opens `station-viewer.html`. It does not start the station.
- **2026-10-14** — `station-viewer.html` build `station-viewer 3` puts the visit still and the visit clip in two frames. A camera crop stays in the still frame only.
- **2026-10-14** — Saved visit videos were MPEG-4 Part 2. The opened clip was 1,426,825 bytes, 10 frames, 1280×720, and Chrome showed 0:00 because it will not decode that codec. Eight Jones videos under `camera-live/` were rewritten in place as H.264. The opened clip is now 476,527 bytes and plays (2.5s, 1280×720). `encode_mp4` now writes H.264. That encoder is local only. The running task still writes the old codec for new visits until the image is replaced.
- **2026-10-14** — `station-viewer.html` reads `live-wall` and `live-clips`. It does not call `live-look` and it does not open the cameras. `live-clips` lists saved Jones visits. The deployed web app does not have that route until v6.8.29 is deployed. The visit files are the station's mp4, which this browser does not play; the page shows the wall picture and the visit still.
- **2026-10-14** — The station log shows the stopped clips did save: DRIVEWAY and FRONT DOOR at 21:09 UTC, GARAGE EXTERIOR at 23:10 UTC, DRIVEWAY at 23:11 and 23:19 UTC, FRONT DOOR at 23:30 UTC, and GARAGE EXTERIOR at 00:15 UTC. `finished` never reached the bot. `queue_notice` returns immediately unless `LIVE_STATION_KEY` is set, and the task does not have that key. The next image queues those notices in S3 mode. The wall file will be the next 15-second stretch, not a new copy of the last 18 seconds. Neither change is on the running task yet.
- **2026-10-14** — The Jones task is image `station-270d0331dd1d`, digest `sha256:fbfdcd1868d689734ddc036f22fbaa3a095d4cba5e9b035070fb3d08220175de`, task definition `live-station:2`, task `1d39e65f5dd54057a5753e478aa3437c`. Desired count stayed 1. One task is running, on a private address, watching 12/12. The wall write took 3953 ms. The watch object now carries the 18-second wall video. The deployed web app still drops that video until a new Apps Script version is deployed.
- **2026-10-14** — The station will put an 18-second wall video on the watch object (`feed_base64`) so a look covers the gap between looks. That code is local only. The running task and the deployed web app do not send it until the image is replaced and a new Apps Script version is deployed.
- **2026-10-14** — The live-monitor bot's first `live-look` saw the Fargate wall. Jones was live, 12 cameras idle. That look is the standing picture. No clip was saved.
- **2026-10-14** — `property-intel-records` now has lifecycle rules `camera-scans-7-day` and `camera-live-7-day`. Each expires its prefix after 7 days, including noncurrent versions. `camera-watch/` and `camera-station/` are not expired. Service `live-station` stayed at desired count 1 and running count 1.
- **2026-10-14** — `property-intel-records` has no lifecycle configuration. The scans rule had not been applied. `Set-CameraLiveLifecycle.ps1` writes `camera-scans-7-day` and `camera-live-7-day` together when the configuration is absent. The Fargate service is not changed.
- **2026-10-14** — `tools/camera-scan/Set-CameraLiveLifecycle.ps1` adds rule `camera-live-7-day` on prefix `camera-live/` for 7 days and keeps the `camera-scans/` rule. `camera-watch/` and `camera-station/` are not expired. The Fargate service is not changed. The rule is not on the bucket until that script succeeds.
- **2026-10-14** — Fargate is the Jones holder. Service `live-station` desired count is 1 and running count is 1. Task `80d13f26b25f4a51bb3c278acda0fb38` is watching 12/12. The wall write took 503 ms. The address is private. The PC station is down.
- **2026-10-14** — `ecs:ListTasks` was denied on the narrow task ARN list, so the count statement allows list, describe, and update in us-east-1. The service stayed at desired count 0. The PC holder was already down.
- **2026-10-14** — Cutover script `tools/camera-scan/Start-LiveStationOnFargate.ps1` raises service `live-station` to desired count 1 only after the PC holder is down. It puts the count back to 0 if the task stops or never reports watching. The service is still at 0 until that script succeeds.
- **2026-10-14** — Service `live-station` is on cluster `live-station`, task definition `live-station:1`. Desired count is 0 and running count is 0. Public address is disabled. `AWSServiceRoleForECS` is present. `iam:CreateServiceLinkedRole` is on `PropertyIntelLiveStationService`. Unused policy `PropertyIntelLiveStationEcsRole` was deleted. The PC holder stays on Jones. No task was started.
- **2026-10-14** — Jonah is at the managed-policy quota, so `iam:CreateServiceLinkedRole` is added to the attached service policy instead of a new policy. Desired count stays 0. No task was started.
- **2026-10-14** — Service `live-station` is created at desired count 0. Task definition `live-station` is 1 vCPU and 2 GB, with no public address. The two secrets are injected by the execution role. The customer key is not set on the task yet. The PC holder stays on Jones. No task is started.
- **2026-10-14** — Private subnet `subnet-03b49dfcc78292f80` (`172.31.96.0/24`, `us-east-1a`) is in `vpc-0f0648c379e657c16`. NAT gateway `nat-0aaa3bd5a744f736b` is in public subnet `subnet-0e7199592ab9503d8`. Route table `rtb-01dec0335cb11792c`. S3 gateway endpoint `vpce-079d2368461e59340`. Public subnets were not changed. No task was started.
- **2026-10-14** — The live-station task subnet is private in `vpc-0f0648c379e657c16`. Its default route is a NAT gateway in a public subnet. An S3 gateway endpoint keeps bucket traffic off the NAT. The operator creates the path. Public subnets stay as they are. No task is started.
- **2026-10-14** — Log group `/property-intel/live-station` was already present. Retention is 14 days. Encryption is the CloudWatch default. The live-station customer key is not used. No task was started.
- **2026-10-14** — Log group `/property-intel/live-station` keeps task output for 14 days. Default log encryption. The live-station customer key is not used. The operator creates the group. No task is started.
- **2026-10-14** — Role `arn:aws:iam::719781265739:role/live-station-execution` is in place. It pulls `property-intel-live-station` and reads the two live-station secrets. It may write log group `/property-intel/live-station`. That group was not created. The live-station customer key was not granted. No task was started.
- **2026-10-14** — Role `live-station-execution` pulls `property-intel-live-station` and reads the two live-station secrets. It may write log group `/property-intel/live-station`. It cannot read the records bucket. The operator creates the role. The log group is not created. No task is started.
- **2026-10-14** — Image `719781265739.dkr.ecr.us-east-1.amazonaws.com/property-intel-live-station:station-82c1c3648a0a` is in ECR. Digest `sha256:474539f624ff92be89ef4b164ea24fb5e43853a4fc66c660f2d02ed2548f34ca`. The self-check passed. No task was started.
- **2026-10-14** — Image repository `property-intel-live-station` is built from the station files only. The tag is `station-` plus a hash of those files. Tags are immutable. Encryption is AES256. The build runs `--self-check` and does not open Jones. The operator pushes it. No task is started.
- **2026-10-14** — `PropertyIntelLiveStationSecrets` is attached to IAM user `Jonah`. Jones password `arn:aws:secretsmanager:us-east-1:719781265739:secret:property-intel/live-station/jones-password-S70DY5` and watch token `arn:aws:secretsmanager:us-east-1:719781265739:secret:property-intel/live-station/watch-token-0ZGcf4` were stored. The Secrets Manager default key was used. The live-station customer key was not. Values were not printed. No task was started.
- **2026-10-14** — Jones password secret `property-intel/live-station/jones-password` and watch-token secret `property-intel/live-station/watch-token` use the Secrets Manager default key. The live-station customer key stays limited to S3. The task role cannot read them. No task is started.
- **2026-10-14** — Security group `live-station` is `sg-0eb888721c6ad9e82` in default VPC `vpc-0f0648c379e657c16`. No inbound rule. The open outbound rule was removed. Outbound is VPC DNS, port 443 to the S3 prefix list, and port 443 to the internet for the CHEKT gateway and Secrets Manager. No task was started.
- **2026-10-14** — `PropertyIntelLiveStationNetwork` is attached to IAM user `Jonah`. It can read the default VPC and the S3 prefix list, and can create tagged group `live-station` and set its outbound rules. Inbound was not granted. No security group was created.
- **2026-10-14** — IAM user `Jonah` needs `PropertyIntelLiveStationNetwork` before security group `live-station` can be created. The policy can read the default VPC and the S3 prefix list, and can create that tagged group and set its outbound rules. It cannot open inbound or start a task.
- **2026-10-14** — Security group `live-station` has no inbound rule. Outbound is VPC DNS, port 443 to the S3 prefix list, and port 443 to the internet for the CHEKT gateway and Secrets Manager. The operator creates it. No task is started.
- **2026-10-14** — Role `live-station-task` is on key `e19f5afa-0acd-4db3-9c65-db6ea029dac0`. It may get and put only the live prefixes. No task was started. The bucket default stayed AES256.
- **2026-10-14** — Role `live-station-task` may get and put only the live prefixes and may use the live-station key only through S3. The operator creates the role and adds it to the key. No task is started.
- **2026-10-14** — Live-station key `e19f5afa-0acd-4db3-9c65-db6ea029dac0`, alias `alias/property-intel-live-station`. The only data principal is `arn:aws:iam::719781265739:user/Jonah`. The bucket default stayed AES256.
- **2026-10-14** — The live-station key is created with the script IAM user only. `live-station-task` is added to the key policy after that role exists.
- **2026-10-14** — IAM user `Jonah` needs `PropertyIntelLiveStationKey` before the live-station key can be created. The policy can create the key and cannot decrypt.
- **2026-10-14** — SAFE portal password gate. Virtual Patrol opens on a 24-hour schedule across cameras, with images and notes as separate subtabs, one camera at a time. Pictures start loading when the password is accepted. Page chip `safe-portal 0.9.0`.
- **2026-10-14** — SAFE portal Virtual Patrol. One page lists reviewed frames, the schedule, and frames with a note. Home lists the notes. The schedule save is the existing `scan-patrol` write. Page chip `safe-portal 0.8.0`.
- **2026-10-14** — Live station objects use `alias/property-intel-live-station`. The data principals are the script's IAM user and role `live-station-task`. Use is only through S3 on `property-intel-records`. The bucket default stays AES256. The operator creates the key.
- **2026-10-14** — `live-clip` writes `camera-station/{token}.json`, and `live-look` returns `finished` from that object. Critique build `v6.8.26`. The PC beat still takes its own queue and removes those ids from the object.
- **2026-10-14** — The live task writes the wall and the clips with its role, and takes clip orders from `camera-station/{token}.json`. It does not call Apps Script. The script does not write that object yet. The PC test still posts `live-beat`.
- **2026-10-14** — Live client video stays private by refusing the wrong caller: no public task address, prefix-scoped role, encrypted objects off CloudFront, scoped bots, and no secrets in logs. The PC test is not that bar.
- **2026-10-14** — Live bots have constant access. They patrol 24/7 and write a still, a video, and a description only when an event is happening. The always-on task is what keeps that access up.
- **2026-10-14** — Live station 24/7 home is one always-on us-east-1 task, not a Lambda and not the operator PC. The task writes `camera-watch/` and `camera-live/` with an IAM role. The PC beat through Apps Script stays the test path.
- **2026-10-13** — Live station. The Jones bot watches `camera-watch/` and clips still, video, and sentence under `camera-live/`. Script Property `LIVE_STATION_KEY`. Critique build `v6.8.24`. The 7-day lifecycle on `camera-live/` is not created yet.
- **2026-10-14** — `scan-review` also accepts the save fields on the query string, so a redirect that drops the POST body still writes. Critique build `v6.8.25`.
- **2026-10-13** — `scan-next` hands a new patrol frame to the bot before the older history walk. Critique build `v6.8.23`.
- **2026-10-13** — Patrol presets. Choosing a QA level offers All day, Work hours, and Evening. A preset fills every camera; the times can be edited before save. Page chip `scan-viewer 9`.
- **2026-10-13** — Virtual patrol. `camera-scan-patrol/{chektHub}.json` holds the QA level and the daily review times. Saving it replaces Scan hours for that row. Critique build `v6.8.20`. Page chip `scan-viewer 8`.
- **2026-10-13** — Scan viewer Notes tab. One section per camera, each sentence with its picture. Page chip `scan-viewer 6`.
- **2026-10-13** — `scan-list` returns every JPEG name in a camera folder in one response. The viewer starts those pictures together. The script key needs `s3:ListBucket` on `property-intel-records`, prefix `camera-scans/*`. Critique build `v6.8.19`.
- **2026-10-13** — The scan viewer reads each JPEG and its JSON from the records CDN. The row password still gates `scan-list`, which returns the newest key per camera. The page follows `previous` once, remembers the keys, and the next open starts the pictures together. Page chip `scan-viewer 4`.
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
