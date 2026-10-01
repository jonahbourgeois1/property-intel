# Camera pin editor

Internal page for placing camera pins. Clients do not use it.

## Changelog

### 2026-09-30 — Show the review stills in the editor

**What.** Set `photo` on cameras that had a captured still and copied that JPEG to `data/cameras/images/{fileId}/{cam-id}.jpg`. Pins, labels, live blocks, and placement notes were not changed. Jones and Eugene already had photos; those files and images were left alone. Cameras with no captured JPEG stay “No still”.

**Why.** The editor draws a thumbnail only from `camera.photo`. The Chekt review stills lived under scratch and were not on the cameras files, so every row said “No still”.

**Files.** `data/cameras/json/*.json` (photo field only where a still existed), `data/cameras/images/**/*.jpg`, `test-camera-pin-editor.mjs`, this file.

**How it was checked.** `node test-camera-pin-editor.mjs`. Butler `305a44231…` cam-01 stays at lat 44.0701631 and its photo path is the new JPEG. Gud’s placement note still names `gud-cultures-2026-05-29`.

**Status.** Pages after this commit is on `main`.

### 2026-09-30 — Seed Chekt pin files that production did not have

**What.** Wrote 143 new `data/cameras/json/{hub}.json` files from the pin-review proposals. The 13 cameras files that already existed were left as they were. Eugene still uses `4a484f8c…`. Jones still uses `6de88883…`. Scratch fields (`review`, `sub_review`, `confidence`, `note`) are not in the new files. The Chekt account list now counts cameras from those files.

**Why.** The hosted editor can only open a hub that already has a cameras file. The proposals lived under `_scratch` and never became production files.

**Files.** `data/cameras/json/*.json` (new files only), `camera-pin-properties.json`, `test-camera-pin-editor.mjs`, this file.

**How it was checked.** `node test-camera-pin-editor.mjs`. Gud’s placement note still names capture `gud-cultures-2026-05-29`. Wellman `0bff2878…` is a new file with 3 cameras and no scratch fields.

**Status.** Pages after this commit is on `main`. The records bucket copy is a separate Apps Script step (`Copy cameras + GIS from GitHub`). Save still needs the camera-pins deployment if that version is not live.

### 2026-09-30 — List the Chekt tab (cam-edit 1.0.5)

**What.** The bare editor URL lists the Chekt accounts (158), with each row’s CHEKT camera count. A missing `data/cameras/json/` file no longer means the account has no cameras. Save still does not create a pin file.

**Why.** The previous list was every `data/index/` hub. Most of those are not Chekt accounts, and the pin files that do exist are not the Chekt camera roster.

**Files.** `js/camera-pin-editor.js`, `camera-pin-editor.html`, `camera-pin-properties.json`, `test-camera-pin-editor.mjs`, `docs/INDEX_AND_CAMERAS_CONTRACT.md`, this file.

**How it was checked.** `node test-camera-pin-editor.mjs`. The catalog includes Achterhof (`933e6dd9…`, 4 CHEKT cameras, no pin file) and leaves out an index hub that is not on the Chekt tab.

**Status.** Pages after this commit is on `main`. Opening an account that has no pin file still stops on that gate. The Chekt pin proposals are not in `data/cameras/json/`.

### 2026-09-30 — Restore the full property list (cam-edit 1.0.4)

**What.** The bare editor URL lists every hub in `data/index/` again. A hub with no cameras file stays in the list with `cameras: 0` and an empty `cameras_file`. Hubs that already have cameras sort first. Save still refuses to create a cameras file.

**Why.** Commit `f28ae73` trimmed the list to the 16 hubs that already have `data/cameras/json/`. Editors need the full index, same as cam-edit 1.0.1.

**Files.** `js/camera-pin-editor.js`, `camera-pin-editor.html`, `camera-pin-properties.json`, `test-camera-pin-editor.mjs`, `docs/INDEX_AND_CAMERAS_CONTRACT.md`, this file.

**How it was checked.** `node test-camera-pin-editor.mjs` rebuilds the catalog from `data/index/` and `data/cameras/json/` and requires the committed JSON to match, including hubs with zero cameras.

**Status.** Pages after this commit is on `main`.

### 2026-09-30 — List only properties that already have cameras (cam-edit 1.0.3)

**What.** The bare editor URL lists hubs that already have a cameras file. Hubs in `data/index/` with no cameras file are not rows. A direct `?property=` link to one of those hubs still opens and says this editor does not create a file.

**Why.** The full index listed 152 hubs and 136 of them had no cameras. The editor is for placing pins on properties that already have cameras.

**Files.** `js/camera-pin-editor.js`, `camera-pin-editor.html`, `camera-pin-properties.json`, `test-camera-pin-editor.mjs`, `docs/INDEX_AND_CAMERAS_CONTRACT.md`, this file.

**How it was checked.** `node test-camera-pin-editor.mjs` rebuilds the catalog and requires every row to have a cameras file and a count above zero.

**Status.** Pages after this commit is on `main`.

### 2026-09-30 — Refresh AWS records after a camera-pin save (cam-edit 1.0.2)

**What.** After the GitHub Contents PUT of `data/cameras/json/{fileId}.json` succeeds, the same Apps Script request copies that merged JSON to `s3://property-intel-records/cameras/{hubId}.json`. The hub id is the existing sidecar remap (`recordsSidecarHubId_`): Jones `6de88883…` → `d9f759…`, Eugene `4a484f8c…` → `8eea64e5…`, every other cameras file keeps its id. The copy goes through `recordsPublishGithubPath_` (photo URLs rewritten to tiles CloudFront, index `files.cameras` merged). GitHub stays the Pages source until viewer cutover. If the S3 step fails, the response is a partial error: GitHub saved, AWS copy failed. Save stays available so the editor can retry; a retry with no new geometry still copies the current GitHub file.

**Why.** The records bucket is what cut-over viewers will read. A pin save that only updates GitHub leaves that copy stale.

**Files.** `apps scripts/camera-pins.gs`, a comment in `apps scripts/records.gs` and `apps scripts/shared.gs`, `camera-pin-editor.html`, `js/camera-pin-editor.js`, `test-camera-pin-editor.mjs`, `docs/INDEX_AND_CAMERAS_CONTRACT.md`, `docs/RECORDS_CONTRACT.md`, this file.

**How it was checked.** `node test-camera-pin-editor.mjs` runs `recordsSidecarHubId_` and the save response helper: Jones and Eugene remap, Gud stays on its own id, a thrown S3 error returns `github_saved` plus the partial sentence, and a missing `recordsPublishGithubPath_` does too. The page script shows that error and leaves Save enabled. Live AWS PUT was not exercised.

**Status.** Needs a new Apps Script deployment version after pasting `camera-pins.gs`. `records.gs` in this repo already has `recordsPublishGithubPath_`. Paste that file too if the deployed project is older.

### 2026-09-30 — Full property list (cam-edit 1.0.1)

**What.** The bare editor URL lists every hub, then opens one property. `https://responder-intel.vyanet.com/camera-pin-editor.html` is the link to share with camera editors. `?property={hubId}` stays the deep link into one hub. Client live links stay `vyanet-viewer.html?property={hubId}&live=1`.

**Why.** Editors needed one hub URL, not a separate link per property.

**Files.** `camera-pin-editor.html`, `js/camera-pin-editor.js`, `camera-pin-properties.json`, `test-camera-pin-editor.mjs`, `docs/INDEX_AND_CAMERAS_CONTRACT.md`, this file.

**How it was checked.** `node test-camera-pin-editor.mjs` rebuilds the catalog from `data/index/` and `data/cameras/json/` and compares it to `camera-pin-properties.json`. Browser pass: bare URL lists properties, search filters, a row opens `?property=`, All properties returns to the bare URL, the client link on a property is still `vyanet-viewer.html?property=…&live=1`.

**Status.** Pages after this commit is on `main`. The list is a committed JSON file at the repo root. It is not under `data/`, so the Apps Script sync does not overwrite it. Refresh that file when hubs or camera counts change; the unit test fails if it drifts.

### 2026-09-30 — Internal camera pin editor (cam-edit 1.0.0)

**What.** New Pages page `camera-pin-editor.html`. It loads one property with `?property={hubId}` (the `data/index/` hash), shows the cameras on a Google Map, and lets an editor drag pins, set heading, field of view, and range, with undo/redo. Save POSTs to the existing Apps Script web app. Apps Script merges those geometry fields into `data/cameras/json/{id}.json` through the GitHub Contents API. `live`, `mount_height`, `taxlot`, `photo`, labels, and placement notes stay. The editor does not create a cameras file and does not add or delete cameras. A move farther than 5 km is refused, not clamped.

**Why.** Camera editors need a shareable link. Client live links stay `vyanet-viewer.html?property={hubId}&live=1`. That page already reads the cameras JSON this editor writes.

**Files.** `camera-pin-editor.html`, `js/camera-pin-editor.js`, `test-camera-pin-editor.mjs`, `apps scripts/camera-pins.gs`, `apps scripts/critique-api.gs` (route + ping flag), comments in `apps scripts/shared.gs` and `apps scripts/drone-test.gs`, `docs/INDEX_AND_CAMERAS_CONTRACT.md`, this file.

**How it was checked.** `node test-camera-pin-editor.mjs` (merge rules, URL shape, `node --check` on the page module and on `camera-pins.gs`, id/onclick scan). Browser pass is described in the PR. The live Apps Script project was not deployed from this repo.

**Status.** Pages after this commit is on `main`. Save returns success only after the Apps Script paste and a new deployment version below.

## Links

`{hubId}` is the filename of `data/index/{hubId}.json`. Same hash the hub and the live viewer already use.

| Who | URL |
|---|---|
| Camera editors — full list (share this) | `https://responder-intel.vyanet.com/camera-pin-editor.html` |
| Camera editors — one property | `https://responder-intel.vyanet.com/camera-pin-editor.html?property={hubId}` |
| Clients (unchanged) | `https://responder-intel.vyanet.com/vyanet-viewer.html?property={hubId}&live=1` |

The list is the Chekt tab: one row per Chekt account that has a hub id. The camera count is that account’s CHEKT cameras. Search matches name, address, or hub id. A row can have CHEKT cameras and still have no saved pin file. Opening that row says the editor does not create `data/cameras/json/`. Eugene’s Chekt hub points at the existing cameras file `4a484f8c…`. Jones’s Chekt hub is `6de88883…`.

The list itself is `camera-pin-properties.json` at the repo root. Do not move it under `data/`. That tree is owned by the Apps Script sync.

Example the live viewer already uses:

`https://responder-intel.vyanet.com/vyanet-viewer.html?property=933e6dd98ecb875eab79fdb3b103a938&live=1`

The matching editor link is:

`https://responder-intel.vyanet.com/camera-pin-editor.html?property=933e6dd98ecb875eab79fdb3b103a938`

Do not send the editor URL to a client. There is no passcode. Anyone with the editor link can move pins. Property hashes are already in the public repo.

Gud Cultures (`1512452d9e6e0f1cf0a32255a4392b12`) has a cameras file in this repo and is a usable editor link. Eugene’s site hub `8eea64e5…` and Tracy’s hub `2dce25a3…` load the one existing cameras file (Eugene `4a484f8c…`, Jones `6de88883…`) and save back to that file. The editor does not create a second copy.

## What Save writes

The page sends `{ property, file_id, cameras: [{ id, lat, lng, heading, fov, range }] }`.

Apps Script:

1. Checks `file_id` is the property or a known sibling / canonical cameras id.
2. Reads `data/cameras/json/{file_id}.json`. If that file is missing, it stops. It does not create one.
3. Copies lat, lng, heading, fov, and range onto the matching cameras. Cameras missing from the payload stay. An unknown id refuses the whole save.
4. Leaves `live`, `photo`, `label`, `mount_height`, `taxlot`, `placement`, `placement_note`, and other fields in place.
5. If lat/lng changed, drops `mx` / `my` / `mz` on that camera so the 3D viewer follows lat/lng. If heading changed and the camera already has `declination`, it sets `heading_magnetic` to `heading - declination`. It does not invent a declination.
6. PUTs the merged JSON with the GitHub Contents API (the script’s existing `GITHUB_TOKEN`). The commit message is `Camera pin editor {fileId}`.
7. Copies that same merged JSON with `recordsPublishGithubPath_` (already in `records.gs`). Script Properties `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` sign the PUT. The browser does not talk to S3. No Lambda and no GitHub Action is involved.

The records key is `cameras/{hubId}.json` on `property-intel-records`. `{hubId}` is `recordsSidecarHubId_(fileId)`: Jones’s git file `6de88883…` writes `d9f759…` (site_no 14725), Eugene’s git file `4a484f8c…` writes `8eea64e5…`, and any other cameras file writes its own id. Photo paths on the records object become tiles CloudFront URLs. The GitHub file keeps `data/cameras/images/…` paths. The records index gets `files.cameras` for that hub, same as **Copy cameras + GIS from GitHub**.

If step 7 throws, the response is `{ "ok": false, "partial": true, "github_saved": true, "error": "GitHub saved data/cameras/json/… but the AWS records copy failed …" }`. The pins on GitHub are the ones you saved. The status line says so, and Save stays enabled. Click Save again. With no further pin edits the script still copies the current GitHub file to records.

A later drone-test sync calls `camerasFileForSync_`, which reads this GitHub file and republishes that JSON. It does not rebuild pin positions from the sheet. `pushAllToGitHub` does not push `data/cameras/json`, so the sync does not race this commit on Pages.

The page will not POST until `GET …/exec?route=ping` includes `"camera_pins": true`. That keeps an old deployment from filing the body as an element critique.

## Deploy the Apps Script

The editor project is not in this repo’s runtime. Paste it, then deploy a new version. Saved is not deployed.

1. Open the Apps Script project **GitHub Property Intel Automation**.
2. Add a file named `camera-pins.gs`. Paste the full contents of `apps scripts/camera-pins.gs` from this repo. Replace the file if it is already there. `records.gs` must already define `recordsPublishGithubPath_` and `recordsSidecarHubId_` (they are in this repo). If a save says that helper is not in this deployment, paste the current `records.gs` as well.
3. In `critique-api.gs`, inside the `route === 'ping'` object (next to `golf: true`), add:

```javascript
camera_pins: (typeof camerasEditorSave_ === 'function'),
```

4. In `critiqueApiPost_`, after the `golf-save` branch and before `return critiqueJsonOut_(critiquePost_(payload));`, add:

```javascript
if (postRoute === 'camera-pins-save') {
  if (typeof camerasEditorSave_ !== 'function') {
    throw new Error('camerasEditorSave_ is not defined — paste camera-pins.gs, save, and deploy a new version');
  }
  return critiqueJsonOut_(camerasEditorSave_(payload));
}
```

5. Save the project (the disk icon).
6. **Deploy → Manage deployments.** Open the pencil on the web app whose URL is the `/exec` already in `camera-pin-editor.html` (`AKfycbz…u7iKERA`). Set **Version** to **New version**. Deploy. Execute as: Me. Who has access: Anyone. Do not create a second web app unless you also change `CAMERA_SAVE_URL` in the HTML to that new `/exec` URL.
7. Open the web app with `?route=ping`. The JSON must include `"camera_pins": true`. If it is missing, the deployment is still the old version.

## Smoke test

1. Confirm ping shows `camera_pins: true`.
2. Open the full editor:

   `https://responder-intel.vyanet.com/camera-pin-editor.html`

   Search `Gud`. Open Gud Cultures. The address bar becomes:

   `https://responder-intel.vyanet.com/camera-pin-editor.html?property=1512452d9e6e0f1cf0a32255a4392b12`

3. Change one heading by 1 degree. Save. The status line should say it saved, and the response is `{ "ok": true, "route": "camera-pins-save", ... }`.
4. Reload the editor. The heading should still be the value you saved.
5. Open the client link and confirm the 2D camera wedge uses that heading:

   `https://responder-intel.vyanet.com/vyanet-viewer.html?property=1512452d9e6e0f1cf0a32255a4392b12&live=1`

6. Set the heading back and Save again if this property should keep the old bearing.

GitHub Pages can serve the previous JSON for a short time. The editor fetches with a cache-busting query. A hard reload of the client page clears a stale browser copy.

## What this does not change

- `vyanet-viewer.html` URL shape, live gateway, dealer key, or passcode.
- `element-review.html` and `model-viewer.html` behavior, other than 3D camera markers following lat/lng after `mx` / `my` are removed on a moved pin.
- Stills. JPEGs stay where they are (`data/cameras/images/…` or an `http(s)` photo URL). Save does not upload photos.
