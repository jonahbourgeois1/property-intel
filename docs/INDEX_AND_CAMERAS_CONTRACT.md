# Index + cameras contract (vyanet-viewer)

**Writer:** Apps Script sync is the only writer of `data/**`. Do not hand-edit GitHub records; the next sync overwrites them.

**Reader:** `vyanet-viewer.html` is a thin shell, the same idea as `data/index/{id}.json`. It does not implement 3D, satellite, cameras, or live video. It reads the index, then loads the existing pages in iframes:

- 3D (GLB, pins-in-model, cameras, live feed) → `model-viewer.html?property={id}&view={drone-test|plane|drone}`
- Satellite / FR-WF tabs → `viewer.html?property={id}&tab={security|wildfire|plane|drone|drone-test}`

Edits go to those pages. The hub only chooses which page to show and forwards query params (`gw`, `chekt`, `debug`, `dataRoot`, …). `?stage=satellite` picks the starting iframe; `?view=` stays the data-folder selector on the child page.

`model-viewer.html` still accepts a direct `?property=` link (walks `drone-test` → `plane` → `drone`, then the old drone-test / responder-drone fallbacks).

No existing numbered segment contract covers this (Segment 6 / integrations is still owed). This file is the clause.

## What the index is

`data/index/{propertyId}.json` is the **property hub**. It holds identity, account fields, coordinates, and **pointers** to view records. It does not hold pins, routes, obliques, GLB URLs, or the camera list.

One house, one index file. Tracy’s 3D/camera work must attach to the production Jones hub (`6de88883bfd4a8349a901c54611ed9d7`), not a second test id (`2dce25a3643b86a7d8a1551228c3306f`).

## Identity — do not unify the hashes

Two hashing rules stay forever. The index is the join, not a third scheme.

| Surface | Filename key | Why |
|---|---|---|
| Index hub `data/index/{id}.json` | `hashId(slug(site_no))` | Every property will have satellite. `site_no` is stable; names churn. |
| Satellite record `data/satellite/{id}.json` | same `site_no` hash | Satellite sheet col A. Security + wildfire are views on this record (`views.security` / `views.wildfire` both point here). |
| Plane / drone-test **records** | name-keyed (or name + view suffix) | Those pipelines can keep their current view ids. |
| `data/responder-drone/{id}.json` | `hashId(slug(account name))` | **Frozen.** Customer links already use this id. Never rename, rehash, or move these files. |

`responder-intel.html` does **not** go through the index. It fetches `data/responder-drone/{property}.json` directly. Changing the index filename cannot be allowed to touch that path.

Jones today is the worked example of the *old* name-hash hub:

- `data/index/6de88883…` = `hashId("jones")` (name hash). Plane and legacy satellite both wrote here.
- After this clause, the live hub is `hashId(slug(site_no))`. Jones has **three** site numbers in the account map (14725 / 33278 / 34734), so Plane column AC and drone-test column AF must be filled with the satellite row’s site_no — name and address lookup are ambiguous and will skip the index write rather than guess.
- `views.drone` → `2dcf6cca…` = responder-drone record (`hashId("jones-drone")`). Frozen. Customer `responder-intel.html?property=2dcf6cca…` keeps working.
- `views.plane` → `ccd8c441…` = `hashId("jones-plane")`.
- `views.drone-test` → `83af9960…` = `hashId("tracy-residence-drone-test-drone-test")`. Record filename stays; only the hub it hangs off of changes.

The failure mode that forked Tracy: drone-test hashed **its tab’s Property Name** (`Tracy Residence Drone Test`) and called `upsertIndexEntry_` on that new id, which created `2dce25a3…` instead of merging onto `6de88883…`.

### Sync rule (Apps Script)

Every pipeline may PUT only its own view record. Index writes are **merge-only** onto the satellite hub:

1. Resolve `site_no` for the row (column on that tab, or a lookup against the Satellite tab). If there is no `site_no`, skip the index write — do not invent a name-hashed index file.
2. `upsertIndexEntry_(hash(site_no), { views: { "<this-view>": <this-view-record-id> } })` must **merge keys**. Plane sync must not drop `drone-test`; satellite sync must not drop `plane` / `drone` / `drone-test`; drone-test sync must not create a second hub.
3. Never PUT a replacement `views` object. Never hash the index filename from Account Name, capture name, or a test nickname.
4. `data/responder-drone/{name-hash}.json` is write-stable: same id in, same id out. The index may *point* at that id via `views.drone` (or a dedicated key); it must not relocate the file.

Plane / drone-test / cameras join satellite by `site_no`, not by display name. Name match is how Jones vs “Tracy Residence Drone Test” split.

### site_no format (2026-08-25)

`satValidSiteNo_` accepts **any non-blank string**. Digits, `VY-AS-001` placeholders, and interim values like `Cht-3` are all ids. Format is not a gate — the sheet holds values that will be replaced with source-system numbers later, and rejecting them made those rows un-reviewable and unpublished.

Blank is still refused. `hashId('')` is a valid-looking hash that every empty row would share.

Element-review links must carry `&site_no=`. Address is not unique (410 SW Columbia St is two Satellite rows). The critique API still refuses an ambiguous address match rather than guessing; the URL is what makes the match unique.

## Required index fields

```json
{
  "id": "<propertyId, same as filename>",
  "name": "Jones",
  "address": "18775 Macalpine Loop, Bend OR 97702",
  "lat": 44.0414545,
  "lng": -121.3786406,
  "hoa": "highlands",
  "account_type": "residential",
  "views": {
    "plane": "<hash>",
    "drone": "<hash>",
    "security": "<hash>",
    "wildfire": "<hash>"
  }
}
```

Rules:

- `id` equals the filename stem, which is the satellite `site_no` hash (see Identity). View *records* keep their own hashing; do not rehash responder-drone.
- `account_type`: anything not starting `comm` normalizes to residential (existing convention).
- `views` keys that are missing are omitted, not null. A property with only plane is valid.
- **Testing only:** `views["drone-test"]` is allowed and routes exactly like the others — `data/drone-test/{id}.json`. It is not a production view. When the Tracy extras (`nadir.local`, cameras, directions) have been promoted onto plane/drone via sync, drop the key.
- Optional later: `taxlot` (string) so satellite parcel overlay does not need a view record.

## What stays on view records

`data/{plane|drone|satellite|…}/{viewId}.json` keeps capture-specific payload:

- nadir / alpha / bravo / charlie / delta + pins
- `nadir.local` (required for 3D pin/camera placement)
- `viewer360` (GLB or DJI URL)
- `directions`, considerations, clarifications
- `lat` / `lng` may duplicate the index; index wins for map center if both exist

Promote Tracy extras **onto the plane (or drone) view the index already points at**, via sync, not by copying the whole drone-test JSON into the index.

## Cameras (chosen layout)

- **Metadata (GitHub):** `data/cameras/{propertyId}.json`
- **Served stills (CloudFront):** `https://d3fg47bqswi0rr.cloudfront.net/cameras/{propertyId}/cam-01.jpg` (stable keys, invalidate after replace)
- **Raw technician photos (ingest only):** `s3://property-intel-ingest/cameras/{propertyId}/` — never the GitHub repo, never `property-intel-tiles` until orientation is normalized (`exif_transpose`, then Orientation=1). Headings still branch on `GPSImgDirectionRef` per photo.

`data/cameras/{propertyId}.json` shape:

```json
{
  "property": "<propertyId>",
  "cameras": [
    {
      "id": "cam-01",
      "label": "Front walkway — driveway approach",
      "photo": "https://d3fg47bqswi0rr.cloudfront.net/cameras/<propertyId>/cam-01.jpg",
      "lat": 44.0414194,
      "lng": -121.3786611,
      "heading": 241.45,
      "live": { "device": "E8ABFAAC68C9", "channel": 0 }
    }
  ]
}
```

`live` is optional per camera. Index does **not** inline this array. Presence is implied: viewer GETs `data/cameras/{propertyId}.json` and treats 404 as “no cameras.”

## Viewer resolution

Hub (`vyanet-viewer.html?property={id}`):

1. Fetch `data/index/{id}.json`.
2. If `views` has `drone-test` | `plane` | `drone`, enable **3D MODEL** and iframe `model-viewer.html?property={id}&view={that key}` (forwards `gw`, `chekt`, `debug`, `dataRoot`, …).
3. If `views` has `security` | `wildfire` | `plane` | `drone` | `drone-test`, enable **SATELLITE** and iframe `viewer.html?property={id}&tab={that key}`.
4. Default stage is 3D when a model view exists, else satellite. `?stage=satellite` overrides. Both child pages stay mounted at full size and swap by z-index (no `display:none` / `visibility:hidden` — those freeze WebGL and Maps).
5. Live CHEKT stays inside `model-viewer.html`. The gateway `/live?property=` allowlist may still be keyed by an older hash; `model-viewer` retries aliases from the index (`id`, `views.drone-test`, `views.drone`, `views.plane`).

Direct `model-viewer.html?property={id}` still walks `drone-test` → `plane` → `drone`, then `data/drone-test/{id}.json`, then `data/responder-drone/{id}.json`. `?view=` / `?tab=` on that page selects a views-map key.

## Out of scope / do not do

- Hand-edit `data/index/*.json` or view records in this repo to “look” standardized.
- Flatten pin-catalog `role=`.
- Put raw HEIC/JPEG with customer GPS on GitHub or CloudFront.
- Default the unified viewer to `data/drone-test/` when the index has no `drone-test` pointer (that hid Jones’s plane/drone views).
- Upload camera stills to CloudFront by hand before the ingest → normalize → tiles path exists. Tracy’s 14 JPEGs already live at `data/drone-test/cameras/{viewId}/cam-NN.jpg` (the paths the test record uses). Pages and localhost serve them. Manual tiles uploads would need JSON URL rewrites (sync-owned) and would collide with the later `cameras/{propertyId}/` keys.

## How to publish a change

1. **Now (testing):** keep camera bytes in GitHub at the drone-test paths. Optionally add `views.drone-test` on Jones’s production index via the sheet so `?property=6de88883…` can select that folder. Viewer already walks index views in order `drone-test`, `plane`, `drone`, `security`, `wildfire`.
2. **Later (automation):** Apps Script PUT `data/cameras/{propertyId}.json`; normalized stills to tiles `cameras/{propertyId}/cam-NN.jpg` + CloudFront invalidation; fold Tracy extras onto the plane/drone view; drop `views.drone-test`.
3. Leave `data/drone-test/` in place until a property has been verified on the new paths.
