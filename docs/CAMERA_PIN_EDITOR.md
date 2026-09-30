# Camera pin editor

Internal page for placing camera pins. Clients do not use it.

## Changelog

### 2026-09-30 — Internal camera pin editor (cam-edit 1.0.0)

**What.** New Pages page `camera-pin-editor.html`. It loads one property with `?property={hubId}` (the `data/index/` hash), shows the cameras on a Google Map, and lets an editor drag pins, set heading, field of view, and range, with undo/redo. Save POSTs to the existing Apps Script web app. Apps Script merges those geometry fields into `data/cameras/json/{id}.json` through the GitHub Contents API. `live`, `mount_height`, `taxlot`, `photo`, labels, and placement notes stay. The editor does not create a cameras file and does not add or delete cameras. A move farther than 5 km is refused, not clamped.

**Why.** Camera editors need a shareable link. Client live links stay `vyanet-viewer.html?property={hubId}&live=1`. That page already reads the cameras JSON this editor writes.

**Files.** `camera-pin-editor.html`, `js/camera-pin-editor.js`, `test-camera-pin-editor.mjs`, `apps scripts/camera-pins.gs`, `apps scripts/critique-api.gs` (route + ping flag), comments in `apps scripts/shared.gs` and `apps scripts/drone-test.gs`, `docs/INDEX_AND_CAMERAS_CONTRACT.md`, this file.

**How it was checked.** `node test-camera-pin-editor.mjs` (merge rules, URL shape, `node --check` on the page module and on `camera-pins.gs`, id/onclick scan). Browser pass is described in the PR. The live Apps Script project was not deployed from this repo.

**Status.** Pages after this commit is on `main`. Save returns success only after the Apps Script paste and a new deployment version below.

## Two links

`{hubId}` is the filename of `data/index/{hubId}.json`. Same hash the hub and the live viewer already use.

| Who | URL |
|---|---|
| Camera editors (this page) | `https://responder-intel.vyanet.com/camera-pin-editor.html?property={hubId}` |
| Clients (unchanged) | `https://responder-intel.vyanet.com/vyanet-viewer.html?property={hubId}&live=1` |

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

A later drone-test sync calls `camerasFileForSync_`, which reads this GitHub file and republishes that JSON. It does not rebuild pin positions from the sheet. `pushAllToGitHub` does not push `data/cameras/json`, so the sync does not race this commit on Pages.

The page will not POST until `GET …/exec?route=ping` includes `"camera_pins": true`. That keeps an old deployment from filing the body as an element critique.

## Deploy the Apps Script

The editor project is not in this repo’s runtime. Paste it, then deploy a new version. Saved is not deployed.

1. Open the Apps Script project **GitHub Property Intel Automation**.
2. Add a file named `camera-pins.gs`. Paste the full contents of `apps scripts/camera-pins.gs` from this repo. Replace the file if it is already there.
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
2. Open an editor link for a property that already has `data/cameras/json/{id}.json`. Gud Cultures:

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
