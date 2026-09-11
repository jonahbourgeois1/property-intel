# Next-agent prompt — Vyanet Viewer (product shell)

Paste this entire file as the first message to a new agent working in `C:\dev\property-intel` (public repo `jonahbourgeois1/property-intel`). Read `CLAUDE.md` first. Long-form system dump: `docs/HANDOFF.md` (local-only; ask Jonah if missing). Contracts: `docs/INDEX_AND_CAMERAS_CONTRACT.md`, `docs/NEARMAP_CONTRACT.md`. Nearmap log: `docs/NEARMAP_CHANGELOG.md`.

You are continuing Jonah Bourgeois’s Vyanet Property Intel work. Jonah is the software engineer and maintainer. Prefer small reviewable steps, plain-language reasons, verification evidence, and say what was not verified. Do not commit unless he asks. Do not push unless he asks.

Prior Nearmap leave/return thread: [Nearmap hub leave/return](a1ed90cc-64d0-439d-8748-1d618b29a77a). Live commit: `c925508` on `main`.

---

## What this project is

Vyanet turns aerial imagery into responder-facing property intelligence, served at **https://responder-intel.vyanet.com**.

**Product:** `vyanet-viewer.html` — one app for every stakeholder (customer, technician, first responder), **mobile-first**, that composes existing viewers instead of rewriting them into one 4,000-line file.

**Not this task:** revive the cancelled `js/vyanet/` capability/role rewrite. That direction was rejected. The hub is an **index**: it chooses which existing HTML pages (plugins) to load. Feature work stays in `model-viewer.html` (3D, live, cameras-in-model), `viewer.html` (satellite map / FR-WF), and `nearmap-viewer.html` (vendor 2D / 3D / Obliques). Chrome that every property needs lifts **onto the hub**.

---

## What already shipped (do not undo)

Live URLs:

- Production: `https://responder-intel.vyanet.com/vyanet-viewer.html?property=d9f759d7351db3886c79dd689c41e3c0`
- Jones name hub (the working house): `https://responder-intel.vyanet.com/vyanet-viewer.html?property=6de88883bfd4a8349a901c54611ed9d7`
- Local: from `C:\dev\property-intel` run `python -m http.server 8899` then `http://localhost:8899/vyanet-viewer.html?property=6de88883bfd4a8349a901c54611ed9d7&role=tech`

Current hub (`hub 1.8.17`, `js/vyanet-viewer/property.js` `HUB_BUILD`):

- Reads `data/index/{id}.json`. Gate (role + optional passcode) then **HOME · PRIVATE · COMMUNITY**. Internal Community stage id stays `public` (`#btn-public`, `?stage=public`).
- Home = property identity + hero nadir + program guide.
- Private nested bar: **3D · 2D · Nearmap · Live · Plugins**. 3D / 2D / Live stay iframes (z-index swap, never `display:none` / `visibility:hidden` — those freeze WebGL/Maps ~5s). Nested **Nearmap** **leaves the hub** and opens `nearmap-viewer.html?full=1` on the whole page. Top-right **Standard viewer** returns to `vyanet-viewer.html?stage=private`.
- Community nested bar: **Map · Live**. Map = `hoa-viewer.html` + dashboard cards. Community Live is an empty hub placeholder — it must not load `live-viewer.html`.
- Private 3D enabled if views has `drone-test` | `plane` | `drone`. Private 2D if `security` | `wildfire` | `plane` | `drone` | `drone-test`. Property CHEKT live is nested under Private (`live-viewer.html`).
- GIS Property Facts live on hub Private 2D and 3D (`data/gis/{id}.json`). They are **not** on the Nearmap page. Private 2D **Cover** is lot-clipped Nearmap regions (building / drive / veg / pool) plus observed facts on a map legend — not the GIS table.
- Pins: `data/pins/{id}.json` if published; else 3D nadir pins replace satellite. Customer role hides concern pins and FR/WF narrative.
- `model-viewer.html` can load a GLB from the view record’s `viewer360` (`model=` via qp, stop at first `&`) when the iframe only has `?property=&view=`.
- Live passcode is a hub overlay (Chrome blocks `window.prompt`). Prefetch must not prompt. Gateway alias retry: URL property, `idx.id`, `views.drone-test`, `views.drone`, `views.plane`.

**Nearmap trial** (`nearmap-viewer.html` **v1.1.13**, editor `nearmap-review.html` **v1.7.6**):

- Join is a **two-row table**, not production hub membership. Do **not** hash `site_no` for that join:
  - `18775-macalpine-loop-bend-or-97702` → Jones `6de88883bfd4a8349a901c54611ed9d7`
  - `410-sw-columbia-st-bend-or-97702` → `744a3639be95ce309192dc69b5a8e9f6`
- Standalone `nearmap-viewer.html?delivery=` on a known trial property **redirects to hub home** first unless `full=1`.
- Nearmap page: 2D / 3D / Obliques. Right rail tabs stacked vertically (v1.1.12): **AI layers**, **First Responder**, **Wildfire**, **Pins**. Lot line and observed facts on AI layers; Pass 3 FR/WF prose + catalog concern pins on their tabs; region-class pins on Pins. Map markers follow the rail tab. **Clip to taxlot** (default on) removes everything outside the property line on 2D; the camera stays on the property (v1.1.7 — do not fit the taxlot bbox). 3D region fills **drape the mesh** (~8 cm lift); the 3D mesh itself is still the capture. Off layers are not built until turned on. `embed=1` is unused.
- Editor: paint/erase, holes, gap-close, **Revert changes** vs **Revert to original**. Pins editor **Place pin** / **Delete pin** click a visible painted region (interior / remove pin) — not a free map click. Revert buttons were not clicked in a real browser session.

Test property: Jones / Tracy, `18775 Macalpine Loop, Bend OR 97702`. **Jones is name-keyed `6de88883…` (`hashId("jones")`), not `hash(14725)` (`d9f759…`).** Jones is AMBIG (site_nos 14725 / 33278 / 34734) — never guess which site_no; skip index write if missing.

Hard-refresh if Pages still shows hub 1.8.15.

---

## Jonah’s product vision (authoritative)

### 1. Gate, then home, then plugins

Opening `vyanet-viewer.html?property={id}` must **not** dump the user into 3D or satellite.

**Gate (first screen):**

- Load the index. Show property name/address so they know they have the right house.
- **Role required:** `customer` | `tech` | `responder`. Persist for the tab (sessionStorage). Role filters narrative, pins, and which plugins/chrome are offered — it does not fork the HTML files.
- **CHEKT viewer passcode required if this property has cameras** (record cameras, or `data/cameras/json/{id}.json` when that exists, or live gateway allowlist). Same key as today: header `x-viewer-key`, stored in `sessionStorage` as `vyViewerKey`. Reuse model-viewer’s overlay UX; do not use `window.prompt`. If there are no cameras, skip the passcode field.
- After gate: enter the **home** shell. Do not skip gate on refresh if role/pass are already in session — optional deep link later (`&role=` is fine for testers; passcode never in the URL).

**Home (shell, not a plugin):**

- Basic property info from the **index**: name, address, lat/lng, account_type, hoa, hero nadir.
- Top bar is **HOME · PRIVATE · COMMUNITY**. Launch buttons are gone; the bar is the launch.
- Hub chrome that is **always part of the app**, even when a property has no GLB and no cameras. Plugins render the substrate; the hub owns the chrome.
- Viewing options merge: one app, not “open model-viewer or open viewer.html as separate products.” Iframes (or later same-origin modules) are an implementation detail.

### 2. Plugins (existing pages, not a monolith)

| Plugin | Source of truth file | When it appears |
|---|---|---|
| Private / 3D | `model-viewer.html` | Nested under Private when index has a model view (`drone-test` / `plane` / `drone`) with a GLB in `viewer360`. |
| Private / 2D | `viewer.html` | Nested under Private when a sat/view mapping exists. Default Private substrate if there is no 3D. GIS Property Facts stay here (and on 3D). |
| Private / Nearmap | `nearmap-viewer.html` | Trial: leave/return (`?full=1`) when the hub id is in `NEARMAP_DELIVERY_HUB`. Later (only if Jonah asks): same product without a minimized iframe, without losing HOME/PRIVATE/COMMUNITY. |
| Private / Live | `live-viewer.html` | This property’s CHEKT cameras and clips. Passcode gate unchanged. |
| Community / Map | `hoa-viewer.html` | When `index.hoa` is set. Lot lines + highlight. Dashboard cards always (community weather). |
| Community / Live | hub placeholder | Empty until neighborhood cameras exist. Must not iframe `live-viewer.html`. |
| Ahart Plugins | hub stub | Nested under Private. Vegetation / landscaping / golf are coming-soon until a plugin page exists. |

Edits for 3D/Maps/live/Nearmap still go to those files unless Jonah explicitly asks to move a concern. Do not copy Three.js or Maps into the hub.

### 3. Pins: one truth, 3D supersedes satellite

Today pins live **per view record** (`data/satellite/{id}.json` vs `data/drone-test/{id}.json`), as `%` of that nadir frame. That is the wrong end state.

**Target:**

- One pin set per **property** (index id = `hash(site_no)` for satellite-keyed hubs; Jones production hub stays name-keyed `6de88883…`).
- Pin kinds: catalog **elements**, catalog **concerns**, and **points of interest** (cameras, later hydrants etc.). Catalog ids stay ints; `data/pin-catalog/pins-catalog.json` `role=` must **never** be flattened (empties satellite Pass 2 vocabulary and breaks its done-flag).
- **Supersession:** if a 3D/drone mapping has produced pins, those pins **replace** satellite pins for this property in the app. Satellite imagery and FR/WF prose can remain; the pin layer shown to users is the higher-caliber 3D set. If there is no 3D pin set, show satellite pins.
- Placement: still refuse out-of-bounds; **never silent clamp**. Geometry in a local frame (nadir-geo / `nadir.local`), not absolute projected metres.
- Cameras are pins of a type, not a parallel system. Metadata: `data/cameras/json/{propertyId}.json`; stills at `data/cameras/images/{propertyId}/` until CloudFront; raw photos never in the served bucket.

**Backend implication (do not quietly skip):** Apps Script is the only GitHub `data/` writer. A property-level pin document (`data/pins/{propertyId}.json`) must be **sync-owned**, merged like the index, and chosen by the same supersession rule. Do not hand-edit published JSON. Do not unify satellite `site_no` hashes with responder-drone name hashes. `data/responder-drone/` and `responder-intel.html?property=2dcf6cca…` stay frozen.

Draft any new contract clauses in `docs/INDEX_AND_CAMERAS_CONTRACT.md` (or a pins addendum) as part of the work. Segment 6 still has no numbered contract. Nearmap clauses live in `docs/NEARMAP_CONTRACT.md`.

### 4. Mobile-first, all stakeholders

- Layout and touch: phone first, then desktop. Hub chrome must work with a thumb; do not assume a 44px desktop bar is enough.
- Roles change **what is shown**, not which files exist. Customer ≠ full FR narrative. Tech may see capture/debug. Responder gets directions, live, hazards.
- Cross-platform: still static Pages + existing Lambdas for v1. Do not invent a SPA framework unless Jonah asks. PWA / viewport / no hover-only controls are in scope.

---

## Architecture constraints (violations cost days)

- **Git never talks to AWS; Lambda never talks to GitHub.** Apps Script syncs sheet → GitHub `data/`.
- Hand-edits to `data/**` are overwritten on the next sync.
- `config.js` is CI-generated; never hand-edit.
- Headless render: never construct OrbitControls; one opacity function; `s3.head_object` not CloudFront HEAD; no render auto-retry.
- Photo headings: branch on `GPSImgDirectionRef` per photo. Orientation: transpose then Orientation=1.
- Validator over prompt for pin vocabulary. Fresh Pass 1 = twenty ids; analyst rerun = all 239. Do not unify.
- After Apps Script paste: save **and** new deployment version.
- Viewers: `node --check` + structural referee before delivery.
- Jones is name-keyed `6de88883…`, not `hash(14725)`.
- Nearmap trial: `NM_UPSERT_INDEX` stays false. Do not add `views.nearmap` / `VIEW_ORDER` / `syncNow()` unless Jonah says promote.

---

## Suggested phases (hub 1.8.16 shipped three-tab shell + Nearmap leave/return)

**Shipped:** Gate + Home identity. Private (3D ↔ 2D ↔ Live + Ahart stub). Community (hoa-viewer embed + dashboard cards). Live nested under Private. Pin file contract + viewers read `data/pins/{id}.json` with 3D-wins fallback. Role filter. GIS Property Facts on 2D/3D. Nearmap trial: delivery→hub join table, draped 3D fills, full-page leave/return, GIS off the Nearmap rail, taxlot clip + observed facts, Private 2D Cover overlay. Review editor paint/erase/holes/gap-close + two revert buttons.

**Temporary UX (Jonah: “for the time being”):** Nearmap is leave/return, not nested in hub chrome. Property Facts stay off the Nearmap page. Put either back only if asked.

**Still owed (hub):**

- Neighbor click on Community navigating the hub `?property=` (explicitly out of the first Public slice).
- Real Ahart plugin pages when vegetation / landscaping / golf have data.
- PROPERTY_MAP on chekt-viewer-gateway should include the site_no hub id (`d9f759…`) as well as legacy hashes.
- Home facts beyond identity (directions list, camera inventory without video) if Jonah wants them lifted out of model-viewer.

**Not promoted (do not do unless Jonah says):**

- `views.nearmap`, `VIEW_ORDER`, `syncNow()`, index writes (`NM_UPSERT_INDEX` stays false).
- Clip Vert to taxlot; Nearmap mesh as `viewer360` / headless render camera.
- Auto-promote vendor polygons into catalog pins.

**Licence / eval:** Derived Nearmap GLB on public CloudFront — confirm analyze/cache/derive/resell before customer-facing use. EagleView 30-day eval ends ~Sep 17.

Do not flatten Pass-1/rerun vocabularies. Keep catalog `role=`. Refuse OOB; no clamp.

---

## Verification

- `node --check` on extracted hub/module scripts; brace balance; every `getElementById('x')` has `id="x"`; onclick handlers on `window`.
- Exercise gate → home → Private 3D/2D → Nearmap leave → Standard viewer back to Private. Confirm passcode is skipped when no cameras; required when cameras exist.
- Iframe swap (3D/2D/Live) stays instant after plugins have loaded once.
- State what was not verified.

---

## Explicitly out of scope until Jonah says otherwise

- Flattening catalog `role=`.
- Rehashing/moving `data/responder-drone/`.
- Hand-editing `config.js` or production `data/*.json`.
- Putting raw technician photos on GitHub/CloudFront.
- Unifying satellite vs plane/drone id rules (and never hashing Jones as `hash(14725)`).
- Replacing the iframe hub with a single bundled Three+Maps app.
- Re-litigating Zoho photo intake.
- Committing `apps scripts/` dumps or `docs/HANDOFF.md`.
- Mixing unrelated dirty tree: Apps Script copies, `cesium-viewer.html`, `plane-test.html`, untracked `apps scripts/*`.
