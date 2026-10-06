// Camera pin editor — merge and URL rules.
// Apps Script mirror: apps scripts/camera-pins.gs (keep the limits in lockstep).
// Internal editors only. Client links stay on vyanet-viewer.html?property=&live=1.

export const BUILD = '1.0.16';

export const MAX_MOVE_M = 5000;
export const FOV_MAX = 360;
export const RANGE_MAX = 500;

export const PUBLIC_ORIGIN = 'https://responder-intel.vyanet.com';
export const EDITOR_PAGE = 'camera-pin-editor.html';
export const CLIENT_PAGE = 'vyanet-viewer.html';

// Same pairs as js/vyanet-viewer/property.js CAMERA_HUB_SIBLINGS.
export const CAMERA_HUB_SIBLINGS = {
  '8eea64e5c09dc806f667b079e111a38d': ['4a484f8c273abef3c02cf91e274f9e2f'],
  '4a484f8c273abef3c02cf91e274f9e2f': ['8eea64e5c09dc806f667b079e111a38d'],
  '2dce25a3643b86a7d8a1551228c3306f': ['6de88883bfd4a8349a901c54611ed9d7'],
  '6de88883bfd4a8349a901c54611ed9d7': ['2dce25a3643b86a7d8a1551228c3306f']
};

// Same pairs as apps scripts/shared.gs CAMERAS_JSON_CANONICAL.
export const CAMERAS_JSON_CANONICAL = {
  '8eea64e5c09dc806f667b079e111a38d': '4a484f8c273abef3c02cf91e274f9e2f',
  'd9f759d7351db3886c79dd689c41e3c0': '6de88883bfd4a8349a901c54611ed9d7'
};

export function normHubId(value) {
  const id = String(value || '').trim().toLowerCase();
  return /^[a-f0-9]{32}$/.test(id) ? id : '';
}

export const REVIEW_STORE_KEY = 'cam-edit-review-v1';
export const ACTOR_STORE_KEY = 'cam-edit-actor-v1';
export const EDITOR_ACTORS = ['Jonah', 'Eleanor', 'Bot 1', 'Bot 2'];
export const HISTORY_MAX = 200;
export const HISTORY_LOG_MAX = 2000;
const REVIEW_NOTE_MAX = 2000;

export function normActor(value) {
  const name = String(value == null ? '' : value).trim();
  return EDITOR_ACTORS.indexOf(name) >= 0 ? name : '';
}

export function poseSnapshot(cam) {
  const src = cam && typeof cam === 'object' ? cam : {};
  return {
    lat: src.lat,
    lng: src.lng,
    heading: src.heading,
    fov: src.fov,
    range: src.range
  };
}

export function historyEventsFromJson(text) {
  let parsed;
  try { parsed = JSON.parse(text || ''); } catch (e) { return []; }
  const rows = parsed && Array.isArray(parsed.events) ? parsed.events : [];
  const out = [];
  for (let i = 0; i < rows.length; i++) {
    const ev = rows[i] || {};
    const rawBy = String(ev.by == null ? '' : ev.by).trim();
    const by = normActor(rawBy);
    if (rawBy && !by) continue;
    const property = normHubId(ev.property);
    if (!property) continue;
    const at = String(ev.at || '').trim();
    if (!at) continue;
    const cameras = Array.isArray(ev.cameras) ? ev.cameras.map((id) => String(id || '').trim()).filter(Boolean) : [];
    out.push({
      at: at,
      by: by,
      property: property,
      file_id: normHubId(ev.file_id) || property,
      name: String(ev.name || '').trim(),
      cameras: cameras,
      source: ev.source === 'backfill' || !by ? 'backfill' : 'save'
    });
  }
  return out;
}

export function eventTouchesHub(ev, hubId, fileId) {
  const ids = {};
  const a = normHubId(hubId);
  const b = normHubId(fileId);
  if (a) ids[a] = true;
  if (b) ids[b] = true;
  if (!ev || !Object.keys(ids).length) return false;
  return !!(ids[ev.property] || ids[ev.file_id]);
}

export function lastEditForHub(events, hubId, fileId) {
  let best = null;
  const rows = events || [];
  for (let i = 0; i < rows.length; i++) {
    const ev = rows[i];
    if (!eventTouchesHub(ev, hubId, fileId)) continue;
    if (!best || String(ev.at) > String(best.at)) best = ev;
  }
  return best;
}

export function appendEditorHistory(record, entry) {
  const hist = Array.isArray(record.editor_history) ? record.editor_history.slice() : [];
  hist.push(entry);
  if (hist.length > HISTORY_MAX) hist.splice(0, hist.length - HISTORY_MAX);
  record.editor_history = hist;
  record.editor_saved_by = entry.by;
  return record;
}

export function reviewEntry(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  return {
    done: src.done === true,
    note: String(src.note == null ? '' : src.note).slice(0, REVIEW_NOTE_MAX),
    by: normActor(src.by),
    at: String(src.at || '').trim()
  };
}

export function reviewRecordsFromParsed(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  const src = (parsed.reviews && typeof parsed.reviews === 'object' && !Array.isArray(parsed.reviews))
    ? parsed.reviews
    : parsed;
  const out = {};
  Object.keys(src).forEach((key) => {
    const id = normHubId(key);
    if (!id) return;
    const entry = reviewEntry(src[key]);
    if (entry.done || entry.note) out[id] = entry;
  });
  return out;
}

// Keep only real hub ids. Drop empty rows so a cleared note does not linger.
// Accepts a flat {hub: {done, note}} object or {version, reviews:{...}}.
export function reviewStateFromJson(text) {
  let parsed;
  try { parsed = JSON.parse(text || ''); } catch (e) { return {}; }
  return reviewRecordsFromParsed(parsed);
}

// Remote wins when it has a later at. Local fills hubs the shared file does not have yet.
export function mergeReviewCaches(remote, local) {
  const out = {};
  const ids = {};
  const rem = remote && typeof remote === 'object' ? remote : {};
  const loc = local && typeof local === 'object' ? local : {};
  Object.keys(rem).forEach((id) => { ids[id] = true; });
  Object.keys(loc).forEach((id) => { ids[id] = true; });
  Object.keys(ids).forEach((id) => {
    const a = rem[id];
    const b = loc[id];
    let pick = a;
    if (!a) pick = b;
    else if (b) {
      const atA = Date.parse(a.at) || 0;
      const atB = Date.parse(b.at) || 0;
      pick = atB > atA ? b : a;
    }
    if (pick && (pick.done || pick.note)) out[id] = reviewEntry(pick);
  });
  return out;
}

export function mergeReviewRecords(existing, edits, by, nowIso) {
  const actor = normActor(by);
  if (!actor) return fail('editor must be Jonah, Eleanor, Bot 1, or Bot 2');
  if (!edits || typeof edits !== 'object' || Array.isArray(edits)) {
    return fail('reviews object is required');
  }
  const next = {};
  const src = existing && typeof existing === 'object' && !Array.isArray(existing) ? existing : {};
  Object.keys(src).forEach((key) => {
    const id = normHubId(key);
    if (!id) return;
    const entry = reviewEntry(src[key]);
    if (entry.done || entry.note) next[id] = entry;
  });
  const updated = [];
  const keys = Object.keys(edits);
  if (!keys.length) return fail('reviews object is required');
  const at = nowIso || new Date().toISOString();
  for (let i = 0; i < keys.length; i++) {
    const id = normHubId(keys[i]);
    if (!id) return fail('each review needs a hub id');
    const entry = reviewEntry(edits[keys[i]]);
    if (!entry.done && !entry.note) {
      if (next[id]) {
        delete next[id];
        updated.push(id);
      }
      continue;
    }
    next[id] = { done: entry.done, note: entry.note, by: actor, at: at };
    updated.push(id);
  }
  return { ok: true, reviews: next, updated: updated, at: at, by: actor };
}

export function editorHubUrl() {
  return PUBLIC_ORIGIN + '/' + EDITOR_PAGE;
}

export function editorUrl(propertyId) {
  const id = normHubId(propertyId);
  if (!id) return '';
  return editorHubUrl() + '?property=' + id;
}

export function clientLiveUrl(propertyId) {
  const id = normHubId(propertyId);
  if (!id) return '';
  return PUBLIC_ORIGIN + '/' + CLIENT_PAGE + '?property=' + id + '&live=1';
}

// Property id first, then the canonical cameras file and known sibling hubs.
// The editor loads the first id that already has data/cameras/json/{id}.json
// and saves back to that same id. It does not create a second file.
export function cameraFileCandidates(propertyId) {
  const ids = [];
  const add = (value) => {
    const id = normHubId(value);
    if (!id || ids.indexOf(id) !== -1) return;
    ids.push(id);
  };
  add(propertyId);
  for (let hop = 0; hop < 3; hop++) {
    const snapshot = ids.slice();
    for (let i = 0; i < snapshot.length; i++) {
      const id = snapshot[i];
      if (CAMERAS_JSON_CANONICAL[id]) add(CAMERAS_JSON_CANONICAL[id]);
      const sibs = CAMERA_HUB_SIBLINGS[id] || [];
      for (let s = 0; s < sibs.length; s++) add(sibs[s]);
      const aliases = Object.keys(CAMERAS_JSON_CANONICAL);
      for (let a = 0; a < aliases.length; a++) {
        if (CAMERAS_JSON_CANONICAL[aliases[a]] === id) add(aliases[a]);
      }
    }
  }
  return ids;
}

// First candidate that already has a cameras file. Empty when none do.
export function camerasFileForHub(propertyId, cameraIds) {
  const have = {};
  const list = cameraIds || [];
  for (let i = 0; i < list.length; i++) have[list[i]] = true;
  const candidates = cameraFileCandidates(propertyId);
  for (let i = 0; i < candidates.length; i++) {
    if (have[candidates[i]]) return candidates[i];
  }
  return '';
}

// Full editor index. records are { id, name, address } from data/index/.
// cameraCounts maps a cameras-file id to its camera count.
// Hubs with cameras sort first. Hubs with no cameras file stay, with
// cameras 0 and an empty cameras_file. This does not read the network.
export function editorCatalog(records, cameraCounts) {
  const counts = cameraCounts || {};
  const cameraIds = Object.keys(counts);
  const rows = [];
  for (let i = 0; i < (records || []).length; i++) {
    const rec = records[i] || {};
    const id = normHubId(rec.id);
    if (!id) continue;
    const fileId = camerasFileForHub(id, cameraIds);
    const n = fileId ? Number(counts[fileId]) || 0 : 0;
    rows.push({
      id: id,
      name: String(rec.name || '').trim(),
      address: String(rec.address || '').trim(),
      cameras: n,
      cameras_file: fileId || ''
    });
  }
  rows.sort(function (a, b) {
    const ac = a.cameras > 0 ? 0 : 1;
    const bc = b.cameras > 0 ? 0 : 1;
    if (ac !== bc) return ac - bc;
    const an = a.name.toLowerCase();
    const bn = b.name.toLowerCase();
    if (an < bn) return -1;
    if (an > bn) return 1;
    if (a.id < b.id) return -1;
    if (a.id > b.id) return 1;
    return 0;
  });
  return rows;
}

// Chekt tab accounts. `accounts` are { id|hub, name, address, cameras }
// where `cameras` is the CHEKT camera count for that account.
// cameras_file is set only when a pin file already exists.
// This does not read the network and does not use the drone cameras file
// as the list of accounts.
export function chektEditorCatalog(accounts, cameraIds) {
  const rows = [];
  const seen = {};
  const list = cameraIds || [];
  for (let i = 0; i < (accounts || []).length; i++) {
    const rec = accounts[i] || {};
    const id = normHubId(rec.id || rec.hub);
    if (!id || seen[id]) continue;
    seen[id] = true;
    const n = Number(rec.cameras);
    const fileId = camerasFileForHub(id, list);
    rows.push({
      id: id,
      name: String(rec.name || '').trim(),
      address: String(rec.address || '').trim(),
      cameras: isFinite(n) && n > 0 ? n : 0,
      cameras_file: fileId || ''
    });
  }
  rows.sort(function (a, b) {
    const ac = a.cameras > 0 ? 0 : 1;
    const bc = b.cameras > 0 ? 0 : 1;
    if (ac !== bc) return ac - bc;
    const an = a.name.toLowerCase();
    const bn = b.name.toLowerCase();
    if (an < bn) return -1;
    if (an > bn) return 1;
    if (a.id < b.id) return -1;
    if (a.id > b.id) return 1;
    return 0;
  });
  return rows;
}

export function roundLatLng(n) {
  return Math.round(Number(n) * 1e7) / 1e7;
}

export function roundMeasure(n) {
  return Math.round(Number(n) * 100) / 100;
}

export function normalizeHeading(deg) {
  let h = Number(deg);
  if (!isFinite(h)) return NaN;
  h = ((h % 360) + 360) % 360;
  h = Math.round(h * 100) / 100;
  if (h >= 360) h = 0;
  return h;
}

// null and "" are unplaced. Number(null) is 0, which would pin the camera
// in the ocean and paint a blank map at street zoom.
export function coordPair(obj) {
  if (!obj || obj.lat == null || obj.lng == null || obj.lat === '' || obj.lng === '') return null;
  const lat = Number(obj.lat);
  const lng = Number(obj.lng);
  if (!isFinite(lat) || !isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat: lat, lng: lng };
}

// Same grid as viewer.html PARCEL_COUNTIES. GitHub tiles are data/parcels/{name}.
export const PARCEL_COUNTIES = [
  { name: 'deschutes', lat0: 43.61, lng0: -122.01, step: 0.07 },
  { name: 'lane', lat0: 43.40, lng0: -124.20, step: 0.07 },
  { name: 'josephine', lat0: 41.90, lng0: -124.20, step: 0.07 }
];

export function parcelTileName(lat, lng, county) {
  const step = county.step;
  const latCell = Math.floor((lat - county.lat0) / step) * step + county.lat0;
  const lngCell = Math.floor((lng - county.lng0) / step) * step + county.lng0;
  return county.name + '_' + latCell.toFixed(2) + '_' + lngCell.toFixed(2) + '.geojson';
}

export function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6378137;
  const toR = Math.PI / 180;
  const dLat = (lat2 - lat1) * toR;
  const dLng = (lng2 - lng1) * toR;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * toR) * Math.cos(lat2 * toR) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

// Short-range offset used for the heading handle and the FOV wedge.
// Bearing 0 is north, clockwise, matching the 2D viewer.
export function offsetByHeading(lat, lng, headingDeg, meters) {
  const rad = (Number(headingDeg) || 0) * Math.PI / 180;
  const dLat = (meters * Math.cos(rad)) / 111320;
  const cos = Math.cos(Number(lat) * Math.PI / 180);
  const dLng = (meters * Math.sin(rad)) / (111320 * (Math.abs(cos) < 1e-6 ? 1e-6 : cos));
  return { lat: Number(lat) + dLat, lng: Number(lng) + dLng };
}

export function headingFromLatLng(fromLat, fromLng, toLat, toLng) {
  const dLat = toLat - fromLat;
  const dLng = (toLng - fromLng) * Math.cos(fromLat * Math.PI / 180);
  if (Math.abs(dLat) < 1e-12 && Math.abs(dLng) < 1e-12) return 0;
  return normalizeHeading(Math.atan2(dLng, dLat) * 180 / Math.PI);
}

function fail(error) {
  return { ok: false, error: error };
}

export function validateGeometry(edit, existing) {
  if (!edit || typeof edit.id !== 'string' || !edit.id.trim()) {
    return fail('each camera edit needs an id');
  }
  const id = edit.id.trim();
  const lat = Number(edit.lat);
  const lng = Number(edit.lng);
  const heading = Number(edit.heading);
  const fov = Number(edit.fov);
  const range = Number(edit.range);
  if (!isFinite(lat) || lat < -90 || lat > 90) {
    return fail(id + ': latitude must be between -90 and 90');
  }
  if (!isFinite(lng) || lng < -180 || lng > 180) {
    return fail(id + ': longitude must be between -180 and 180');
  }
  if (!isFinite(heading)) {
    return fail(id + ': heading must be a number of degrees');
  }
  if (!isFinite(fov) || fov <= 0 || fov > FOV_MAX) {
    return fail(id + ': field of view must be greater than 0 and at most ' + FOV_MAX + ' degrees');
  }
  if (!isFinite(range) || range <= 0 || range > RANGE_MAX) {
    return fail(id + ': range must be greater than 0 and at most ' + RANGE_MAX + ' meters');
  }
  const nextLat = roundLatLng(lat);
  const nextLng = roundLatLng(lng);
  const prevLat = Number(existing && existing.lat);
  const prevLng = Number(existing && existing.lng);
  if (isFinite(prevLat) && isFinite(prevLng)) {
    const dist = haversineM(prevLat, prevLng, nextLat, nextLng);
    if (dist > MAX_MOVE_M) {
      return fail(id + ': moved ' + Math.round(dist) + ' m from the saved pin. The limit is ' +
        MAX_MOVE_M + ' m, and the pin was not moved.');
    }
  }
  return {
    ok: true,
    value: {
      id: id,
      lat: nextLat,
      lng: nextLng,
      heading: normalizeHeading(heading),
      fov: roundMeasure(fov),
      range: roundMeasure(range)
    }
  };
}

function geometryChanged(cam, edit) {
  return roundLatLng(cam.lat) !== edit.lat ||
    roundLatLng(cam.lng) !== edit.lng ||
    normalizeHeading(cam.heading) !== edit.heading ||
    roundMeasure(cam.fov) !== edit.fov ||
    roundMeasure(cam.range) !== edit.range;
}

// Merge geometry onto a copy of the production cameras record.
// Omitted cameras stay. Unknown ids refuse the whole save.
// live, photo, label, mount_height, taxlot, placement, and notes stay.
// A lat/lng change drops mx/my/mz on that camera so 3D follows lat/lng.
// heading_magnetic updates only when declination is already on the camera.
export function mergeCamerasRecord(existing, edits, nowIso, by) {
  const actor = normActor(by);
  if (by != null && String(by).trim() !== '' && !actor) {
    return fail('editor must be Jonah, Eleanor, Bot 1, or Bot 2');
  }
  if (!existing || typeof existing !== 'object' || Array.isArray(existing)) {
    return fail('no cameras file to update');
  }
  if (!Array.isArray(existing.cameras) || !existing.cameras.length) {
    return fail('no cameras file to update');
  }
  if (!Array.isArray(edits) || !edits.length) {
    return fail('cameras array is required');
  }
  const byId = {};
  for (let i = 0; i < existing.cameras.length; i++) {
    const cam = existing.cameras[i];
    if (!cam || typeof cam.id !== 'string' || !cam.id) {
      return fail('existing camera is missing an id');
    }
    if (byId[cam.id]) return fail('cameras file has two entries for ' + cam.id);
    byId[cam.id] = cam;
  }
  const clean = [];
  const seen = {};
  for (let i = 0; i < edits.length; i++) {
    const edit = edits[i];
    if (!edit || typeof edit !== 'object') return fail('each camera edit needs an id');
    const id = typeof edit.id === 'string' ? edit.id.trim() : '';
    if (!id) return fail('each camera edit needs an id');
    if (seen[id]) return fail('duplicate camera id ' + id);
    seen[id] = true;
    if (!byId[id]) {
      return fail('unknown camera id ' + id + ' — this editor does not add cameras');
    }
    const checked = validateGeometry(edit, byId[id]);
    if (!checked.ok) return checked;
    clean.push(checked.value);
  }
  const record = JSON.parse(JSON.stringify(existing));
  const updated = [];
  const changes = [];
  record.cameras = record.cameras.map((cam) => {
    let edit = null;
    for (let i = 0; i < clean.length; i++) {
      if (clean[i].id === cam.id) edit = clean[i];
    }
    if (!edit || !geometryChanged(cam, edit)) return cam;
    const next = JSON.parse(JSON.stringify(cam));
    const moved = roundLatLng(cam.lat) !== edit.lat || roundLatLng(cam.lng) !== edit.lng;
    const headingChanged = normalizeHeading(cam.heading) !== edit.heading;
    changes.push({
      id: cam.id,
      from: poseSnapshot(cam),
      to: poseSnapshot(edit)
    });
    next.lat = edit.lat;
    next.lng = edit.lng;
    next.heading = edit.heading;
    next.fov = edit.fov;
    next.range = edit.range;
    if (moved) {
      delete next.mx;
      delete next.my;
      delete next.mz;
    }
    if (headingChanged && isFinite(Number(next.declination))) {
      next.heading_magnetic = normalizeHeading(edit.heading - Number(next.declination));
    }
    updated.push(cam.id);
    return next;
  });
  if (!updated.length) {
    return { ok: true, unchanged: true, record: existing, updated: [] };
  }
  const at = nowIso || new Date().toISOString();
  record.editor_saved_at = at;
  if (actor) {
    appendEditorHistory(record, {
      at: at,
      by: actor,
      cameras: updated.slice(),
      changes: changes
    });
  }
  return { ok: true, unchanged: false, record: record, updated: updated };
}
