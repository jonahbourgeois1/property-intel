# Index + cameras contract (vyanet-viewer)

**Writer:** Apps Script sync is the only writer of `data/**`. Do not hand-edit GitHub records; the next sync overwrites them.

**Reader:** `vyanet-viewer.html` is a thin shell, the same idea as `data/index/{id}.json`. It does not implement 3D, satellite, cameras, or live video. It reads the index, then loads the existing pages in iframes:

- 3D (GLB, pins-in-model, camera stills on the mesh) → `model-viewer.html?property={id}&view={drone-test|plane|drone}`
- Satellite / FR-WF tabs → `viewer.html?property={id}&tab={security|wildfire|plane|drone|drone-test}`
- Live CHEKT (MJPEG + 7-day clips) → `live-viewer.html?property={id}` — **its own plugin**, not an overlay on the 3D page. A property can have live without a GLB.
- Community map (Public) → `hoa-viewer.html?hoa={idx.hoa}&property={id}&embed=1`

Edits go to those pages. The hub only chooses which page to show and forwards query params (`gw`, `chekt`, `debug`, `dataRoot`, `role`, …). `?view=` stays the data-folder selector on the child page.

**Three-tab shell (hub 1.8.14).** After the gate the bar is **HOME · PRIVATE · COMMUNITY**. Internal stage id for Community stays `public` (`#btn-public`, `?stage=public`). Property CHEKT live is a nested Private substrate (with 3D / 2D / Plugins). Community has its own nested bar: **Map · Live**. Community Live is an empty hub placeholder until neighborhood cameras exist — it must not load `live-viewer.html`.

| Tab | What it is | Plugin |
|---|---|---|
| Home | This property’s identity (name, address, HOA, account, coords, hero nadir) plus a short Property Intel program guide (what the mapping is, privacy, and what each tab is for). No launch row, no community dashboard. | Hub-owned layer |
| Private | Mapping workspace. Default substrate is 3D when a model view exists, otherwise 2D. Nested swap: **3D · 2D · Live · Plugins**. Nested **Live** is this property’s CHEKT cameras and clips (`live-viewer.html`); passcode gate is unchanged. Nested **Plugins** stub (30 mapping verticals, coming-soon). Nested buttons use the same chrome as HOME/PRIVATE/COMMUNITY. Pins: highest-caliber mapping only (see Pins). Private 2D (`viewer.html?embed=1`) matches 3D: right rail **Property Facts / Pins / Cameras / Property Analysis / Response Directions**, no debug console unless `debug=1`, no product header. Property Facts is GIS-known context (assessor, DOGAMI, fire, flood, WUI) from `data/gis/{id}.json` — not the overlay color legend. Maps chrome (satellite dropdown, fullscreen under it, zoom, camera) sits on the left so it does not cover the rail. Camera map pins use the same file order as 3D and `joinLiveToPins` (live.device, then unique live.name/label). 2D camera markers use the same cyan circle + camera glyph + number + flashing red LED as 3D, plus a heading wedge. Clicking a camera pin opens the **same card as 3D** (`#cam-popup`: still, heading/FOV, “click image to expand”, Go live, 72-hour events, expand lightbox) — not a Google Maps InfoWindow. Standalone `viewer.html` keeps Security / Wildfire / Plane / Drone / Drone Test under the same rail. | `model-viewer.html` + `viewer.html` + `live-viewer.html` |
| Community (stage `public`) | Nested **Map · Live**. Map is HOA lot lines for every satellite-sheet property whose HOA slug matches (`data/hoa/{slug}.json`, satellite-owned — not plane-only mappings), plus the weather/wildfire/quake/FEMA/space cards that used to sit on Home. Neighbor click highlights and Fit/Lot/Image match Private satellite; it does not navigate the hub or open FR/WF intel. `hoa-viewer.html` loads each `properties[]` hash from `data/index/{hash}.json` (satellite JSON fallback if the index file is missing lat/lng/views). It must not fetch a monolithic `data/index.json` — that file was removed when the hub went per-property, and a 404 blanks the Community map. Nested **Live** is a hub placeholder (`#comm-live`); empty until community cameras ship. | `hoa-viewer.html` + hub dashboard |

Deep links: `?stage=home` / `private` / `public`. `?stage=3d`, `?stage=satellite`, and `?stage=live` still work as aliases into Private’s nested substrate. `?stage=ahart` opens Private on the Ahart stub. `?stage=live` with no saved key lands on Home and opens the passcode popup.

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

1. Resolve `site_no` for the row (column on that tab, or a lookup against the Satellite tab). **Plane:** if there is no `site_no`, skip the index write — do not invent a name-hashed index file. **Drone-test:** do not skip. Join an existing `data/index/` file with this property name, then address (prefer the hub that already has satellite/plane/drone views when more than one file shares the name). If none exists, create `data/index/{hashId(slug(name))}.json`. That is how Vyanet Eugene’s drone-test view lands on `4a484f8c` instead of a second hub, and how a brand-new drone-test property gets an index file.
2. `upsertIndexEntry_(hash(site_no), { views: { "<this-view>": <this-view-record-id> } })` must **merge keys**. Plane sync must not drop `drone-test`; satellite sync must not drop `plane` / `drone` / `drone-test`; drone-test sync must not create a second hub when a file for that name already exists.
3. Never PUT a replacement `views` object. Never hash the index filename from Account Name, capture name, or a test nickname.
4. `data/responder-drone/{name-hash}.json` is write-stable: same id in, same id out. The index may *point* at that id via `views.drone` (or a dedicated key); it must not relocate the file.
5. Camera metadata is a **separate** GitHub file, not a view-record field. Drone-test sync (only) may PUT `data/cameras/json/{hubId}.json` via `camerasFileForSync_`. It fetches the canonical path, then the flat `data/cameras/{id}.json`, then `data/cameras/images/json/`, then a leftover `cameras[]` on the existing view record. Repo-relative still URLs are rewritten onto `data/cameras/images/{hubId}/cam-NN.jpg`. `http(s)` URLs stay. The view record is published **without** `cameras[]`. Never invent an empty cameras file. Never key it on a view-record hash. Never write `data/drone-test/cameras/`. Never nest JSON under `images/`. Plane and satellite sync must not touch this file. JPEG bytes are **not** in `pushAllToGitHub` (UTF-8 text blobs only) — stills stay git-committed until the tiles path exists.

Plane joins satellite by `site_no`. Drone-test joins an existing index file by property name (then address) before site_no, so a duplicate Satellite name does not skip the index write. Minting a name-hash hub is drone-test-only, and only when no index file has that name or address.

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
- Optional: `pins_source`: `"3d"` | `"satellite"` — set by Apps Script when it writes `data/pins/{id}.json`. 3D writes always set `"3d"`. Satellite writes set `"satellite"` only when the existing value is not already `"3d"`.

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

`data/cameras/` holds two folders: `json/` (one metadata file per property) and `images/` (one stills folder per property). A `.gitkeep` sits in `images/` so GitHub and the IDE show `images` as its own folder with `{propertyId}` inside, instead of one collapsed `images/{propertyId}` row. Do not nest JSON under `images/`. Do not put a single property JSON at `data/cameras/{id}.json` as the canonical path. Do not key the image folder on a view-record hash.

Viewers fetch `data/cameras/json/{id}.json` first, then the flat `data/cameras/{id}.json`, then `data/cameras/images/json/{id}.json`. 404 = no cameras file.

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
      "live": { "device": "E8ABFAAC68C9", "channel": 0, "name": "FRONT DOOR" }
    }
  ]
}
```

Jones (CHEKT site 3525) has **four** live cameras. Technician stills are 14 scene photos; only these four pins carry `live`:

| pin | still label | CHEKT name | device |
|---|---|---|---|
| cam-01 | Front walkway — driveway approach | FRONT DOOR | E8ABFAAC68C9 |
| cam-07 | Rear deck — east | UPPER DECK | E8ABFAAC67AE |
| cam-08 | Rear lawn toward patio | LOWER DECK | E8ABFAAC68DC |
| cam-14 | Driveway — house frontage | DRIVEWAY | F4B1C20A440D |

`live` is optional per camera. `live.device` is the CHEKT MAC. `live.name` is the CHEKT roster name when the technician still label does not unique-match (Jones: FRONT DOOR / UPPER DECK / LOWER DECK vs walkway and deck scene labels; Eugene: "Britt's Office Cam View" → `SVC MGR OFFICE`). `joinLiveToPins` copies the MAC from `/live` when `live.device` is already on the pin, else when `live.name` / label / id uniquely equals a roster name, else when a roster name (≥8 chars) appears in exactly one remaining pin. Do not pair leftover cameras by file order. Index does **not** inline this array. Presence is implied: viewer GETs `data/cameras/json/{propertyId}.json` and treats 404 as “no cameras.” `model-viewer.html` loads that same file (walking hub id → view ids → documented sibling hubs, then any `cameras[]` still on the view record) so the Cameras tab and 3D camera pins work even when sync has stripped the array off the view JSON.

**CHEKT live (gateway, 2026-08-27):** `GET /live` and `/clips` resolve the CHEKT site from the **opened property**, not a fixed Jones pair. Passcode is the gate. `PROPERTY_MAP` is an optional override for collisions (Jones). Otherwise the gateway caches CHEKT `/sites` and uniquely matches `site_no` → `account_reference_id`, then index **address**, then **name**. No unique hit → 404. Viewers send `address`/`name` from `data/index/{id}.json` (`gwLiveQuery`). The dealer key never leaves AWS. Do not put stream URLs or the dealer key in the public repo.

**Eugene dual hub (hub 1.7.1):** Vyanet Eugene currently has two index files — `8eea64e5…` (site_no / satellite) and `4a484f8c…` (name-hash / drone). Stills and the cameras JSON live only under `4a484f8c…`. Do not publish a second cameras file for `8eea64e5…`. `liveAliasIds` walks the sibling so `?property=8eea64e5…` still finds cameras. Do not treat this pair as a third hashing rule; merge the indexes when drone-test join is deployed, then drop the sibling map.

Clicking a camera pin on **3D or 2D** opens the same `#cam-popup` card (still, heading/FOV, Go live, 72-hour events). The click fetches `/live` (prompts for the passcode if the tab has none), runs `joinLiveToPins`, then starts that camera’s MJPEG in the card image. Click the image to expand to `#cam-lightbox`; 3D and 2D both list 72-hour clips on the card. Pins with no association stay a still. Hub **LIVE** remains the full wall + 7-day clips plugin. The hub posts `{type:'vyanet-key'}` after a passcode is saved so already-open mapping iframes retry the join.

Pin markers (2D and 3D): cyan circle with camera glyph and number; flashing red LED = live feed associated; steady amber dot (top-left) = a clip in the last 72 hours. 2D also draws the coverage wedge from heading/fov/range.

## Pins — one file per property (hub 1.8.0)

**Path:** `data/pins/{propertyId}.json` (same id as the index hub). **Writer:** Apps Script only (`pinsFileForSync_`). Do not hand-edit. Catalog `role=` is never flattened; Pass 1 still emits the twenty, reruns keep all 239.

```json
{
  "property": "<propertyId>",
  "source": "3d",
  "element": [{ "id": 57, "x": 62, "y": 50 }],
  "concern": [{ "id": 12, "x": 44.1, "y": 48.3 }],
  "poi": []
}
```

- `source: "3d"` — `x`,`y` are percent of the 3D/drone/plane nadir frame (`nadir.bounds` / `nadir.local`). Plane and drone-test pin jobs write this file and set index `pins_source: "3d"`.
- `source: "satellite"` — `x`,`y` are Static Maps percent, same as the satellite view record. Satellite Pass 1/2 write this file **only when** the existing file is missing or already `source: "satellite"`. A 3D file is never overwritten by satellite.
- `poi` is reserved for cameras-as-pins and later hydrants etc. Camera metadata stays in `data/cameras/json/{id}.json` until that merge.

**Readers** (`model-viewer.html`, `viewer.html`): fetch `data/pins/{id}.json` with `cache: no-store`. If the file exists and has pins, use it on both Private substrates. If it 404s, apply the same supersession in the viewer: 3D view-record `nadir.element_pins` / `concern_pins` (or legacy `nadir.pins`) replace satellite `elements` + `fr.concerns`. Placement still refuses out-of-bounds; never clamp.

**Role filter (on top of supersession):** `customer` sees element pins only (no concern pins, no FR/WF considerations/recommendations, no response directions). `tech` and `responder` see the full set. Live stays available to every role when the property has cameras. **GIS facts are public-record context** (assessor, footprint, fire, flood) and show to every role.

Satellite imagery and FR/WF prose can remain on the satellite substrate; the **pin layer** in Private is the higher-caliber set.

## GIS facts — one file per property (hub 1.8.14)

**Path:** `data/gis/{propertyId}.json` (same id as the index hub). **Writer:** Apps Script only (`gisFileForSync_`). Do not hand-edit published files. This is the overlay **facts panel** (right-hand known-property context), not the color legend and not VLM-traced regions.

```json
{
  "property": "<propertyId>",
  "taxlot": "181101A007101",
  "facts": {
    "address": "10 SW QUAIL BUTTE PL",
    "taxlot": "181101A007101",
    "subdivision": "SKYLINER SUMMIT AT BROKEN TOP PHASE 5",
    "year_built": "2002",
    "stat_class": "One story with basement",
    "living_sqft": 4710,
    "garage_sqft": 1330,
    "accessory": "Class 6 Accessory Complex",
    "beds_baths": "4/5",
    "roof_mean_ft": 22.2,
    "roof_max_ft": 36.8,
    "dogami_sqft": 6458,
    "e911_placement": "H",
    "situs_street": "10 QUAIL BUTTE PL",
    "frontage": "SW QUAIL BUTTE PL",
    "fire_first_due": "BFD 301",
    "fire_district": "none (city / BFD, not a rural FPD)",
    "wildfire_county": "Y",
    "wui": true,
    "flood_zone": "not in SFHA",
    "slope_over_25": false,
    "vegetation": "Northern Rocky Mountain Ponderosa Pine Woodland and Savanna",
    "hydrants_150m": 5
  },
  "hydrants": [{ "id": "3502", "location": "SKYLINER SUMMIT LP", "flow_rate": 0, "meters": 62 }]
}
```

- `facts` is required. Keys may be omitted when the source had nothing. Extra keys render under the groups in `js/vyanet-viewer/gis-facts.js`.
- `hydrants` is optional. Shown as a second card in Property Facts when present.
- 404 = the Property Facts rail button stays hidden. Do not invent an empty file.
- Readers: `viewer.html` and `model-viewer.html` fetch with `cache: no-store`. The panel auto-opens once when facts exist.
- **Example (not a published hub):** fixture `001` (10 SW Quail Butte Pl, taxlot `181101A007101`) lives under `fixtures/001/` so Apps Script sync cannot clobber it. Open `vyanet-viewer.html?property=001&dataRoot=fixtures/001/&role=responder&stage=private&gw=0`. Production properties wait until satellite sync calls `gisFileForSync_` and PUTs `data/gis/{hash}.json`.

**Embed satellite-only:** Private 2D `embed=1` still hides Security/Wildfire chrome, but `?tab=security` (hub `satView`) must load. Do not clear `tab=` just because embed `VIEW_ORDER` is drone-test-only.

## Viewer resolution

Hub (`vyanet-viewer.html?property={id}`):

1. Fetch `data/index/{id}.json`.
2. If `views` has `drone-test` | `plane` | `drone` **or** a satellite/view mapping, enable **PRIVATE**. Nested 3D is on when a model view exists; nested satellite is on when a sat/view mapping exists. Iframe `model-viewer.html` and/or `viewer.html` as today (forwards `gw`, `chekt`, `debug`, `dataRoot`, `role`, …). A property with satellite and no GLB still gets Private (satellite only, no 3D swap).
3. Enable **COMMUNITY** (internal stage `public`) for every property. If `idx.hoa` is set, iframe `hoa-viewer.html?hoa={hoa}&property={id}&embed=1`. Membership is `data/hoa/{slug}.json` (satellite sync owns it: every Satellite-tab row with that HOA tag + a valid site_no, not gated on Pass 1 pins or a plane mapping). `hoa-viewer.html` plots a pin from `data/index/{id}.json` when present, else from `data/satellite/{id}.json`. The hoa iframe lives in `#stage` (z-index swap, never `display:none`). On desktop it is the left 58% (`iframe.pub-split { width: 58%; right: auto }` — do not use `width:auto` on an iframe, that collapses to 300×150) so `panTo` centers in the visible map, not under the dashboard. Community map chrome is Lot only (greedy wheel-zoom, no Street View, no Fit, no Image, no nadir overlay). Dashboard cards (`js/vyanet-viewer/dashboard.js`) render in a hub panel beside/below the map. No HOA slug → cards only plus an empty-community note.
4. Enable **Private nested Live** and iframe `live-viewer.html?property={id}&embed=1` when `detectCameras` finds a cameras file (`data/cameras/json/{idx.id|propertyId}.json`) or a non-empty `cameras` array on **any** view record, **or** when the property has a 3D view (`hasModel` is a live proxy until cameras files are published — Jones has gateway live with no cameras file). Live does **not** require a GLB. Community nested Live is always available as an empty hub layer (`#comm-live`); it must not iframe `live-viewer.html`.
5. Default after the gate is the **home** shell, not a plugin. Child pages stay mounted at full size and swap by z-index (no `display:none` / `visibility:hidden` — those freeze WebGL and Maps). Home, Community’s card panel, and the Ahart stub are hub layers; the hoa map iframe is in `#stage` so leaving Community does not freeze Maps. The live iframe does not start MJPEG until the hub posts `{type:'vyanet-stage', stage:'live'}`; leaving the stage posts `off`. The 3D iframe receives `{type:'vyanet-stage', stage:'3d'|'off'}` the same way (queued until `{type:'vyanet-ready', page:'model-viewer'}`).
6. The gateway `/live?property=` allowlist may still be keyed by an older hash; `live-viewer.html` retries aliases from the index (`id`, `views.drone-test`, `views.drone`, `views.plane`) — same walk as model-viewer.

Direct `model-viewer.html?property={id}` still walks `drone-test` → `plane` → `drone`, then `data/drone-test/{id}.json`, then `data/responder-drone/{id}.json`. `?view=` / `?tab=` on that page selects a views-map key.

## Hub gate + three-tab shell (hub 1.8.13)

Opening `vyanet-viewer.html?property={id}` never dumps a first-time visitor into a plugin. The order is gate → home → tab.

**Gate.** Shown only when no role is known for this tab. A saved `vyRole` (refresh) or a valid `&role=customer|tech|responder` deep link skips the gate entirely and lands on home (or on `?stage=` when given). First visits with no role always gate on property identity (name, address, account/HOA/coord chips). The passcode never travels in a URL.

- **Role** is required. Values `customer` | `tech` | `responder`, stored in `sessionStorage.vyRole` (tab-scoped). Role filters what is shown; it never forks the HTML files. "Switch role" on home clears `vyRole` (not the viewer key) and re-gates. The hub forwards `role=` to child iframes.
- **Passcode** is requested on the gate whenever the property has a live surface (`hasLive`), not only when a cameras file already exists (the gateway allowlist cannot be probed without a key — it 401s before evaluating `?property=`, verified 2026-08-25). `hasLive` is cameras-file / any-view `cameras[]` **or** `hasModel` (proxy). A **"Continue without live"** button sits under ENTER whenever the passcode field shows: it enters with the role but stores no key. Opening **Private → Live** without a saved key then shows a hub popup (not a home-page field, not `window.prompt`) that validates the same way; Cancel stays on the current Private substrate. A later refresh of the gate offers the passcode again (nothing was saved).
- **Validation** on submit walks the same alias order live-viewer uses (URL property → `idx.id` → `views.drone-test` → `views.drone` → `views.plane`) against `GET /live?property=` with `x-viewer-key`: 401 = rejected, re-ask; 404 = key fine, id unknown, try next alias; all-404 or any other outcome (429/5xx/network) = accept and defer to live-viewer's own 401-retry on first live use. `&gw=0` skips validation and stores blind. The key lands in `sessionStorage.vyViewerKey` — the exact name live-viewer (and standalone model-viewer) read.

**Home is identity plus the program.** Top-left: Switch role + "Viewing as …". Then the **hero** — the best available nadir render (`findNadir` walks model views, then satellite views, for the first record with `nadir.url`), with the identity overlaid; a tap opens Private. Below the hero, Home explains Property Intel in the same voice as [vyanet.com/mapping](https://vyanet.com/mapping/): aerial mapping of the customer who requested it (not neighborhood surveillance), what Private / Community are for (including nested Live on each), and a privacy + contact line. Properties with no nadir show the identity as a plain block that does not navigate. There is **no passcode field on home**, no launch-button row, and no condition cards. A short note shows when the index has no 3D, satellite, or live surface.

**Private** is the mapping workspace. A second bar (**3D / 2D / Live / Plugins**) sits under the main bar and uses the same button chrome. The main bar is 64px (`--bar-h`); the nested bar is 56px (`--pv-bar-h`). 3D is disabled when the index has no model view; 2D is disabled when there is no sat/view mapping; Live is disabled when the property has no live surface. Plugins is a hub stub: the 30 mapping verticals (name + description from the Ahart list) say coming-soon until those products ship a plugin page. Embedded `viewer.html` (`embed=1`) shows only **Drone** (the drone-test view) and does not render the 3D Aerial View launch card. Mapping and live iframes stay mounted; the nested swap is z-index only.

**Community** (stage `public`) is the HOA page. A second bar (**Map / Live**) sits under the main bar. Map lists every satellite-sheet property in that HOA (`data/hoa/{slug}.json`), including members that have no plane view and no index file yet (viewer falls back to `data/satellite/{id}.json`). Condition cards auto-load the first time Community Map is shown, in this layout (≥640px): Weather spans the full row (now/metrics on the left, forecast + hourly on the right at ≥800px); Wildfire and Earthquakes share the next row (maps are the same width and height — a shared 5:3 box, drag-to-pan and +/- zoom); FEMA and Space Wx share the row below that; More sources spans the bottom. Below 640px the cards stack in that same order. Weather (NWS — current observation including wind/gusts, humidity, dewpoint, visibility, pressure, heat index/wind chill; sunrise/sunset and civil twilight from `/points`; NOAA weather radio callsign; expandable alerts; 8-period forecast with wind/PoP; next-18-hour strip; today's narrative; forecast icons fill each cell), Wildfire (NIFC WFIGS + Esri map filling the bottom half of the card, starts zoomed to nearby towns, drag-to-pan and +/- zoom, blue dot is the property, marker size = acreage), Earthquakes (USGS + full-width map kept zoomed out, same drag-to-pan and +/- zoom, marker size = magnitude), FEMA (OpenFEMA by county — every declaration in a scrollable list), Space Wx (NOAA SWPC scale meter + every bulletin in a scrollable list), More sources. The loaders live in `js/vyanet-viewer/dashboard.js`, lifted from model-viewer's weather/hazard panels — same endpoints, radii, and thresholds, so the hub card and the 3D panel can never disagree about the numbers. Each card fails independently to a source link + retry. The hoa-viewer iframe (`embed=1`) draws every HOA member’s parcel ring and highlights the opened property; it does not show its product header or FR/WF intel panel. Community nested **Live** is `#comm-live`: an empty placeholder that does not start CHEKT. Available iframes mount the moment the gate passes (they warm up behind the opaque home layer), so the first tab switch is instant. The 3D WebGL loop stays paused until the Private 3D substrate (and while the tab is hidden). Pixel ratio is capped at 1.5; idle frames are not drawn.

**Chrome ownership (`embed=1`).** The hub appends `embed=1` to child iframes. In embed mode `model-viewer.html` never reveals its LIVE FEED / Weather / hazard rail buttons — the hub owns that chrome. `hoa-viewer.html` hides its product header, intel panel, and debug console. Private nested **Live** enters `live-viewer.html` and posts `{type:'vyanet-stage', stage:'live'}` (queued until `{type:'vyanet-ready', page:'live-viewer'}`) so MJPEG starts only while that substrate is showing. Community nested Live does not post that message. Standalone `model-viewer.html` links keep their own live overlay. **Property Facts / Pins / Cameras / Analysis / Response Directions** stay on model-viewer and viewer.html (they act on the scene), filtered by `role=` (GIS facts are not filtered). Element/concern pins and camera pins auto-place on the mesh when the record can be placed. Clicking a camera pin opens the in-model card (still + live/clips when associated; not the hub Private Live substrate). The hub posts `{type:'vyanet-stage', stage:'3d'|'off'}` so the 3D render loop runs only on that substrate.

## 3D pins vs FR / satellite (hub 1.8.0)

**Live rule:** one pin layer in Private, highest-caliber mapping wins.

1. Fetch `data/pins/{propertyId}.json`. If it has pins, both the 3D iframe and the satellite iframe use that set (converting between nadir % and Static Maps % / lat/lng as needed). Do not clamp.
2. Else if the 3D view record has `nadir.element_pins` / `concern_pins` (or legacy `nadir.pins`), use that set on both substrates. This **replaces** the hub-1.7.0 interim that painted satellite FR pins onto the mesh whenever `views.security` existed.
3. Else use satellite `elements` + `fr.concerns`.
4. Place on the mesh only when a downward ray hits **ground** on the GLB (face normal mostly +Z), the point is not on the bounding-box rim, and at least three of four 2 m neighbors also hit ground. A miss, clip-wall hit, or rim sliver is refused (not filled, not moved). Routes may still `fillGaps` across holes; pins must not.
5. Property JSON is fetched with `cache: 'no-store'`. Entering the 3D substrate re-reads the pin file so a hub iframe that stayed mounted picks up a resync.
6. Plane/drone-test Apps Script validators drop pins outside the 5–95 image box rather than clamping them onto the edge. The mesh raycast is still the mapping bound — the 5–95 box is the nadir photo, which includes pad.

`pinsFileForSync_` in `shared.gs` is the writer. Drone-test and plane syncs write `source: "3d"`. Satellite sync writes `source: "satellite"` only when it would not clobber a 3D file. Paste into the Apps Script editor, save, **and create a new deployment version**.

**Verification.** `test-vyanet-viewer.py` (repo root, Playwright): static referee (node --check on hub, property.js, dashboard.js, model-viewer, live-viewer, hoa-viewer; id/handler/brace checks), then behavior with the child pages, gateway, camera sources, hoa-viewer stub, and all dashboard data APIs stubbed per scenario, plus one unstubbed smoke against the real children and real APIs. Run with the local server up: `python -m http.server 8899` then `python test-vyanet-viewer.py`. Hub 1.8.1: Public map Fit/Lot/Image, iframe.pub-split actually shrinks, HOA members from satellite records.

## Out of scope / do not do

- Hand-edit `data/index/*.json` or view records in this repo to “look” standardized.
- Flatten pin-catalog `role=`.
- Put raw HEIC/JPEG with customer GPS on GitHub or CloudFront.
- Default the unified viewer to `data/drone-test/` when the index has no `drone-test` pointer (that hid Jones’s plane/drone views).
- Upload camera stills to CloudFront by hand before the ingest → normalize → tiles path exists. Tracy’s 14 JPEGs live at `data/cameras/images/{propertyId}/cam-NN.jpg` (hub id, not the drone-test view hash). Pages and localhost serve them. Manual tiles uploads would need JSON URL rewrites and would collide with the later CloudFront `cameras/{propertyId}/` keys.

## How to publish a change

1. **Now:** stills live in the repo at `data/cameras/images/{propertyId}/cam-NN.jpg`. Metadata is Apps Script–owned: drone-test **Sync This Row** / **Sync drone-test to GitHub** PUTs `data/cameras/json/{propertyId}.json` (paste `shared.gs` + `drone-test.gs`, save, **new deployment version**). Pin file: paste `shared.gs` (`pinsFileForSync_`) plus the drone-test / plane / satellite call sites, save, **new deployment version**. Optionally add `views.drone-test` on Jones’s production index via the sheet so `?property=6de88883…` can select that folder. Viewer already walks index views in order `drone-test`, `plane`, `drone`, `security`, `wildfire`.
2. **Later:** normalized stills to tiles `cameras/{propertyId}/cam-NN.jpg` + CloudFront invalidation; fold Tracy extras onto the plane/drone view; drop `views.drone-test`.
3. Leave `data/drone-test/` view **records** in place until a property has been verified on the new paths. Do not put camera stills back under `data/drone-test/cameras/`.
