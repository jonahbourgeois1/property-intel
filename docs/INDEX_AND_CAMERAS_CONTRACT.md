# Index + cameras contract (vyanet-viewer)

**Writer:** Apps Script sync is the only writer of `data/**`. Do not hand-edit GitHub records; the next sync overwrites them.

**Reader:** `vyanet-viewer.html` is a thin shell, the same idea as `data/index/{id}.json`. It does not implement 3D, satellite, cameras, or live video. It reads the index, then loads the existing pages in iframes:

- 3D (GLB, pins-in-model, camera stills on the mesh) → `model-viewer.html?property={id}&view={drone-test|plane|drone}`
- Satellite / FR-WF tabs → `viewer.html?property={id}&tab={security|wildfire|plane|drone|drone-test}`
- Live CHEKT (MJPEG + 7-day clips) → `live-viewer.html?property={id}` — **its own plugin**, not an overlay on the 3D page. A property can have live without a GLB.

Edits go to those pages. The hub only chooses which page to show and forwards query params (`gw`, `chekt`, `debug`, `dataRoot`, …). `?stage=satellite` / `?stage=3d` / `?stage=live` picks the starting iframe; `?view=` stays the data-folder selector on the child page.

`model-viewer.html` still accepts a direct `?property=` link (walks `drone-test` → `plane` → `drone`, then the old drone-test / responder-drone fallbacks) and still has its own LIVE FEED overlay for those standalone links.

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

- **Metadata (GitHub):** `data/cameras/json/{propertyId}.json`
- **Served stills (GitHub, until tiles ingest exists):** `data/cameras/images/{propertyId}/cam-NN.jpg`
- **Served stills (CloudFront, later):** `https://d3fg47bqswi0rr.cloudfront.net/cameras/{propertyId}/cam-01.jpg` (stable keys, invalidate after replace)
- **Raw technician photos (ingest only):** `s3://property-intel-ingest/cameras/{propertyId}/` — never the GitHub repo, never `property-intel-tiles` until orientation is normalized (`exif_transpose`, then Orientation=1). Headings still branch on `GPSImgDirectionRef` per photo.

Do not nest JSON under `images/`. Do not key the image folder on a view-record hash — both files and stills use the **index hub id**.

Viewers fetch `data/cameras/json/{id}.json` first, then the legacy flat `data/cameras/{id}.json` (one-release fallback). 404 = no cameras file.

`data/cameras/json/{propertyId}.json` shape:

```json
{
  "property": "<propertyId>",
  "cameras": [
    {
      "id": "cam-01",
      "label": "Front walkway — driveway approach",
      "photo": "data/cameras/images/<propertyId>/cam-01.jpg",
      "lat": 44.0414194,
      "lng": -121.3786611,
      "heading": 241.45,
      "live": { "device": "E8ABFAAC68C9", "channel": 0 }
    }
  ]
}
```

`live` is optional per camera. Index does **not** inline this array. Presence is implied: viewer GETs `data/cameras/json/{propertyId}.json` and treats 404 as “no cameras.” `model-viewer.html` loads that same file (walking hub id → view ids, then any `cameras[]` still on the view record) so the Cameras tab and 3D camera pins work even when sync has stripped the array off the view JSON.

Clicking a camera pin opens the **in-model** card (not the hub LIVE FEED tab). If that pin is associated with a CHEKT device (`live.device` on the record, or a unique name match against the gateway `/live` roster), the card starts the MJPEG feed and lists that camera’s clips from the last 72 hours. Pins without an association stay a still. Hub **LIVE FEED** remains the full wall + 7-day clips plugin.

Pin markers: flashing red LED = live feed associated; steady amber dot = at least one clip in those 72 hours. Indicators paint from a non-interactive prefetch when `vyViewerKey` is already in the tab (no passcode prompt on page open).

## Viewer resolution

Hub (`vyanet-viewer.html?property={id}`):

1. Fetch `data/index/{id}.json`.
2. If `views` has `drone-test` | `plane` | `drone`, enable **3D MODEL** and iframe `model-viewer.html?property={id}&view={that key}` (forwards `gw`, `chekt`, `debug`, `dataRoot`, …).
3. If `views` has `security` | `wildfire` | `plane` | `drone` | `drone-test`, enable **SATELLITE** and iframe `viewer.html?property={id}&tab={that key}`.
4. Enable **LIVE FEED** and iframe `live-viewer.html?property={id}&embed=1` when `detectCameras` finds a cameras file (`data/cameras/json/{idx.id|propertyId}.json`) or a non-empty `cameras` array on **any** view record, **or** when the property has a 3D view (`hasModel` is a live proxy until cameras files are published — Jones has gateway live with no cameras file). Live does **not** require a GLB.
5. Default after the gate is the **home** shell, not a plugin (see "Hub gate + home"). `?stage=3d` / `?stage=satellite` / `?stage=live` jumps straight to that stage after the gate (`?stage=live` with no saved key lands on home and opens the passcode popup). Child pages stay mounted at full size and swap by z-index (no `display:none` / `visibility:hidden` — those freeze WebGL and Maps); home is an opaque layer *above* the mounted iframes, same rule. The live iframe does not start MJPEG until the hub posts `{type:'vyanet-stage', stage:'live'}`; leaving the stage posts `off`. The 3D iframe receives `{type:'vyanet-stage', stage:'3d'|'off'}` the same way (queued until `{type:'vyanet-ready', page:'model-viewer'}`): the canvas stays in the layout, but its render loop is paused off-stage so Home does not pay 60 fps for a covered mesh.
6. The gateway `/live?property=` allowlist may still be keyed by an older hash; `live-viewer.html` retries aliases from the index (`id`, `views.drone-test`, `views.drone`, `views.plane`) — same walk as model-viewer.

Direct `model-viewer.html?property={id}` still walks `drone-test` → `plane` → `drone`, then `data/drone-test/{id}.json`, then `data/responder-drone/{id}.json`. `?view=` / `?tab=` on that page selects a views-map key.

## Hub gate + home dashboard (hub 1.4.0)

Opening `vyanet-viewer.html?property={id}` never dumps a first-time visitor into a plugin. The order is gate → home → plugin.

**Gate.** Shown only when no role is known for this tab. A saved `vyRole` (refresh) or a valid `&role=customer|tech|responder` deep link skips the gate entirely and lands on home (or on `?stage=` when given). First visits with no role always gate on property identity (name, address, account/HOA/coord chips). The passcode never travels in a URL.

- **Role** is required. Values `customer` | `tech` | `responder`, stored in `sessionStorage.vyRole` (tab-scoped). Role filters what is shown; it never forks the HTML files. "Switch role" on home clears `vyRole` (not the viewer key) and re-gates.
- **Passcode** is requested on the gate whenever the property has a live surface (`hasLive`), not only when a cameras file already exists (the gateway allowlist cannot be probed without a key — it 401s before evaluating `?property=`, verified 2026-08-25). `hasLive` is cameras-file / any-view `cameras[]` **or** `hasModel` (proxy). A **"Continue without live"** button sits under ENTER whenever the passcode field shows: it enters with the role but stores no key. Opening **LIVE FEED** without a saved key then shows a hub popup (not a home-page field, not `window.prompt`) that validates the same way; Cancel stays on home. A later refresh of the gate offers the passcode again (nothing was saved).
- **Validation** on submit walks the same alias order live-viewer uses (URL property → `idx.id` → `views.drone-test` → `views.drone` → `views.plane`) against `GET /live?property=` with `x-viewer-key`: 401 = rejected, re-ask; 404 = key fine, id unknown, try next alias; all-404 or any other outcome (429/5xx/network) = accept and defer to live-viewer's own 401-retry on first live use. `&gw=0` skips validation and stores blind. The key lands in `sessionStorage.vyViewerKey` — the exact name live-viewer (and standalone model-viewer) read.

**Home is the dashboard.** Top-left: Switch role + "Viewing as …". Then the **hero** — the best available nadir render (`findNadir` walks model views, then satellite views, for the first record with `nadir.url`), with the identity overlaid and a tap-through into the best stage; properties with no nadir show the identity as a plain block that does not navigate. Launch buttons (3D MODEL / SATELLITE / LIVE FEED — a three-across row above the cards at every width, sharing the same max-width frame as the top bar; disabled, never hidden, when the index lacks the data). The top bar has the matching four tabs (HOME / 3D / SATELLITE / LIVE FEED; LIVE is red). There is **no passcode field on home**. Condition cards auto-load the first time home is shown, in this layout (≥640px): Weather spans the full row (now/metrics on the left, forecast + hourly on the right at ≥800px); Wildfire and Earthquakes share the next row (maps are the same width and height — a shared 5:3 box, drag-to-pan and +/- zoom); FEMA and Space Wx share the row below that; More sources spans the bottom. Below 640px the cards stack in that same order. Weather (NWS — current observation including wind/gusts, humidity, dewpoint, visibility, pressure, heat index/wind chill; sunrise/sunset and civil twilight from `/points`; NOAA weather radio callsign; expandable alerts; 8-period forecast with wind/PoP; next-18-hour strip; today's narrative; forecast icons fill each cell), Wildfire (NIFC WFIGS + Esri map filling the bottom half of the card, starts zoomed to nearby towns, drag-to-pan and +/- zoom, blue dot is the property, marker size = acreage), Earthquakes (USGS + full-width map kept zoomed out, same drag-to-pan and +/- zoom, marker size = magnitude), FEMA (OpenFEMA by county — every declaration in a scrollable list), Space Wx (NOAA SWPC scale meter + every bulletin in a scrollable list), More sources. The loaders live in `js/vyanet-viewer/dashboard.js`, lifted from model-viewer's weather/hazard panels — same endpoints, radii, and thresholds, so the hub card and the 3D panel can never disagree about the numbers. Each card fails independently to a source link + retry. Available iframes mount the moment the gate passes (they warm up behind the opaque home layer), so the first stage switch is instant. The 3D WebGL loop stays paused until the 3D stage (and while the tab is hidden). Pixel ratio is capped at 1.5; idle frames are not drawn.

**Chrome ownership (`embed=1`).** The hub appends `embed=1` to child iframes. In embed mode `model-viewer.html` never reveals its LIVE FEED / Weather / hazard rail buttons — the hub owns that chrome. The hub's LIVE FEED tab enters the **live** stage (`live-viewer.html`) and posts `{type:'vyanet-stage', stage:'live'}` (queued until `{type:'vyanet-ready', page:'live-viewer'}`) so MJPEG starts only while that tab is showing. Standalone `model-viewer.html` links keep their own live overlay. **Pins / Cameras / Analysis / Response Directions** stay on model-viewer (they act on the 3D scene). Element/concern pins and camera pins auto-place on the mesh when the record can be placed. Clicking a camera pin opens the in-model card (still + live/clips when associated; not the hub LIVE FEED tab). The hub posts `{type:'vyanet-stage', stage:'3d'|'off'}` so the 3D render loop runs only on that stage.

**Verification.** `test-vyanet-viewer.py` (repo root, Playwright): static referee (node --check on hub, property.js, dashboard.js, model-viewer, live-viewer; id/handler/brace checks), then behavior with the child pages, gateway, camera sources, and all dashboard data APIs stubbed per scenario, plus one unstubbed smoke against the real children and real APIs. Run with the local server up: `python -m http.server 8899` then `python test-vyanet-viewer.py`.

## Out of scope / do not do

- Hand-edit `data/index/*.json` or view records in this repo to “look” standardized.
- Flatten pin-catalog `role=`.
- Put raw HEIC/JPEG with customer GPS on GitHub or CloudFront.
- Default the unified viewer to `data/drone-test/` when the index has no `drone-test` pointer (that hid Jones’s plane/drone views).
- Upload camera stills to CloudFront by hand before the ingest → normalize → tiles path exists. Tracy’s 14 JPEGs live at `data/cameras/images/{propertyId}/cam-NN.jpg` (hub id, not the drone-test view hash). Pages and localhost serve them. Manual tiles uploads would need JSON URL rewrites and would collide with the later CloudFront `cameras/{propertyId}/` keys.

## How to publish a change

1. **Now (testing):** camera bytes and metadata both live under `data/cameras/` — JSON at `json/{propertyId}.json`, stills at `images/{propertyId}/cam-NN.jpg`. Optionally add `views.drone-test` on Jones’s production index via the sheet so `?property=6de88883…` can select that folder. Viewer already walks index views in order `drone-test`, `plane`, `drone`, `security`, `wildfire`.
2. **Later (automation):** Apps Script PUT `data/cameras/json/{propertyId}.json`; normalized stills to tiles `cameras/{propertyId}/cam-NN.jpg` + CloudFront invalidation; fold Tracy extras onto the plane/drone view; drop `views.drone-test`.
3. Leave `data/drone-test/` view **records** in place until a property has been verified on the new paths. Do not put camera stills back under `data/drone-test/cameras/`.
