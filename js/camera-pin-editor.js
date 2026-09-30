// Camera pin editor — merge and URL rules.
// Apps Script mirror: apps scripts/camera-pins.gs (keep the limits in lockstep).
// Internal editors only. Client links stay on vyanet-viewer.html?property=&live=1.

export const BUILD = '1.0.3';

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

// Editor index. records are { id, name, address } from data/index/.
// cameraCounts maps a cameras-file id to its camera count.
// Only hubs that already have at least one camera are listed.
// This does not read the network.
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
    if (!fileId || n < 1) continue;
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
export function mergeCamerasRecord(existing, edits, nowIso) {
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
  record.cameras = record.cameras.map((cam) => {
    let edit = null;
    for (let i = 0; i < clean.length; i++) {
      if (clean[i].id === cam.id) edit = clean[i];
    }
    if (!edit || !geometryChanged(cam, edit)) return cam;
    const next = JSON.parse(JSON.stringify(cam));
    const moved = roundLatLng(cam.lat) !== edit.lat || roundLatLng(cam.lng) !== edit.lng;
    const headingChanged = normalizeHeading(cam.heading) !== edit.heading;
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
  record.editor_saved_at = nowIso || new Date().toISOString();
  return { ok: true, unchanged: false, record: record, updated: updated };
}
