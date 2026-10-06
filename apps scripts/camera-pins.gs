// ============================================================
// PROPERTY INTEL — Apps Script — FILE: camera-pins.gs
// Internal camera pin editor. Paste this whole file into the
// "GitHub Property Intel Automation" project as a NEW file.
// Then add the route in critique-api.gs (see docs/CAMERA_PIN_EDITOR.md).
// Save, then Deploy → Manage deployments → pencil → New version.
// Saved is not deployed.
//
// Save path: browser → this web app → GitHub Contents API
//   data/cameras/json/{fileId}.json
// then the same request copies that merged JSON to
//   s3://property-intel-records/cameras/{hubId}.json
// via recordsPublishGithubPath_ (records.gs). Hub id is the existing
// sidecar remap (Jones 6de88883… → d9f759…, Eugene 4a484f8c… → 8eea64e5…).
// Not a browser GitHub or S3 write. Not a Lambda. Not GitHub Actions.
//
// Merge rules match js/camera-pin-editor.js:
//   - Never create a cameras file. Never delete a camera.
//   - Geometry only: lat, lng, heading, fov, range.
//   - Keep live, photo, label, mount_height, taxlot, placement, notes.
//   - Refuse a move farther than 5000 m. Do not clamp.
//   - Refuse fov outside (0, 360] and range outside (0, 500].
//   - Heading wraps (it is a bearing).
//   - Drop mx/my/mz on a camera only when its lat/lng changed.
//   - Update heading_magnetic only when declination is already set.
//   - file_id must be a sibling/canonical id of property, and the file
//     must already exist at data/cameras/json/{file_id}.json.
//   - Save names the editor: Jonah, Eleanor, Bot 1, or Bot 2. That name
//     is appended to editor_history[] on the cameras file and to
//     camera-pin-history.json (the shared activity list).
//   - Done checkboxes and account notes are shared in camera-pin-review.json
//     (route camera-pins-review-save). Not a cameras-file write. Not S3.
// Drone-test sync reads this file back (camerasFileForSync_) and does
// not rebuild pin geometry. pushAllToGitHub does not push this path.
// ============================================================

var CAM_PIN_MAX_MOVE_M = 5000;
var CAM_PIN_FOV_MAX = 360;
var CAM_PIN_RANGE_MAX = 500;
var CAM_PIN_ACTORS = ['Jonah', 'Eleanor', 'Bot 1', 'Bot 2'];
var CAM_PIN_HISTORY_MAX = 200;
var CAM_PIN_HISTORY_LOG = 'camera-pin-history.json';
var CAM_PIN_HISTORY_LOG_MAX = 2000;
var CAM_PIN_REVIEW_LOG = 'camera-pin-review.json';
var CAM_PIN_NOTE_MAX = 2000;

// Mirror of js/vyanet-viewer/property.js CAMERA_HUB_SIBLINGS.
var CAM_PIN_SIBLINGS = {
  '8eea64e5c09dc806f667b079e111a38d': ['4a484f8c273abef3c02cf91e274f9e2f'],
  '4a484f8c273abef3c02cf91e274f9e2f': ['8eea64e5c09dc806f667b079e111a38d'],
  '2dce25a3643b86a7d8a1551228c3306f': ['6de88883bfd4a8349a901c54611ed9d7'],
  '6de88883bfd4a8349a901c54611ed9d7': ['2dce25a3643b86a7d8a1551228c3306f']
};

// Mirror of shared.gs CAMERAS_JSON_CANONICAL. camerasCanonicalId_ is also
// consulted so a newer shared.gs map is not ignored.
var CAM_PIN_CANONICAL = {
  '8eea64e5c09dc806f667b079e111a38d': '4a484f8c273abef3c02cf91e274f9e2f',
  'd9f759d7351db3886c79dd689c41e3c0': '6de88883bfd4a8349a901c54611ed9d7'
};

function camPinNormActor_(value) {
  var name = String(value == null ? '' : value).replace(/^\s+|\s+$/g, '');
  return CAM_PIN_ACTORS.indexOf(name) >= 0 ? name : '';
}

function camPinPose_(cam) {
  var src = cam && typeof cam === 'object' ? cam : {};
  return {
    lat: src.lat,
    lng: src.lng,
    heading: src.heading,
    fov: src.fov,
    range: src.range
  };
}

function camPinAppendHistory_(record, entry) {
  var hist = Array.isArray(record.editor_history) ? record.editor_history.slice() : [];
  hist.push(entry);
  if (hist.length > CAM_PIN_HISTORY_MAX) hist = hist.slice(hist.length - CAM_PIN_HISTORY_MAX);
  record.editor_history = hist;
  record.editor_saved_by = entry.by;
}

function camPinNormId_(value) {
  var id = String(value || '').replace(/^\s+|\s+$/g, '').toLowerCase();
  return /^[a-f0-9]{32}$/.test(id) ? id : '';
}

function camPinAddCandidate_(ids, value) {
  var id = camPinNormId_(value);
  if (!id || ids.indexOf(id) !== -1) return;
  ids.push(id);
}

function camPinCandidates_(propertyId) {
  var ids = [];
  camPinAddCandidate_(ids, propertyId);
  for (var hop = 0; hop < 3; hop++) {
    var snapshot = ids.slice();
    for (var i = 0; i < snapshot.length; i++) {
      var id = snapshot[i];
      if (CAM_PIN_CANONICAL[id]) camPinAddCandidate_(ids, CAM_PIN_CANONICAL[id]);
      if (typeof camerasCanonicalId_ === 'function') {
        var mapped = camerasCanonicalId_(id);
        if (mapped && mapped !== id) camPinAddCandidate_(ids, mapped);
      }
      var sibs = CAM_PIN_SIBLINGS[id] || [];
      for (var s = 0; s < sibs.length; s++) camPinAddCandidate_(ids, sibs[s]);
      var aliases = Object.keys(CAM_PIN_CANONICAL);
      for (var a = 0; a < aliases.length; a++) {
        if (CAM_PIN_CANONICAL[aliases[a]] === id) camPinAddCandidate_(ids, aliases[a]);
      }
    }
  }
  return ids;
}

function camPinRoundLatLng_(n) {
  return Math.round(Number(n) * 1e7) / 1e7;
}

function camPinRoundMeasure_(n) {
  return Math.round(Number(n) * 100) / 100;
}

function camPinNormalizeHeading_(deg) {
  var h = Number(deg);
  if (!isFinite(h)) return NaN;
  h = ((h % 360) + 360) % 360;
  h = Math.round(h * 100) / 100;
  if (h >= 360) h = 0;
  return h;
}

function camPinHaversineM_(lat1, lng1, lat2, lng2) {
  var R = 6378137;
  var toR = Math.PI / 180;
  var dLat = (lat2 - lat1) * toR;
  var dLng = (lng2 - lng1) * toR;
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * toR) * Math.cos(lat2 * toR) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

function camPinFail_(error) {
  return { ok: false, error: error };
}

function camPinValidateGeometry_(edit, existing) {
  if (!edit || typeof edit.id !== 'string' || !edit.id.replace(/^\s+|\s+$/g, '')) {
    return camPinFail_('each camera edit needs an id');
  }
  var id = edit.id.replace(/^\s+|\s+$/g, '');
  var lat = Number(edit.lat);
  var lng = Number(edit.lng);
  var heading = Number(edit.heading);
  var fov = Number(edit.fov);
  var range = Number(edit.range);
  if (!isFinite(lat) || lat < -90 || lat > 90) {
    return camPinFail_(id + ': latitude must be between -90 and 90');
  }
  if (!isFinite(lng) || lng < -180 || lng > 180) {
    return camPinFail_(id + ': longitude must be between -180 and 180');
  }
  if (!isFinite(heading)) {
    return camPinFail_(id + ': heading must be a number of degrees');
  }
  if (!isFinite(fov) || fov <= 0 || fov > CAM_PIN_FOV_MAX) {
    return camPinFail_(id + ': field of view must be greater than 0 and at most ' + CAM_PIN_FOV_MAX + ' degrees');
  }
  if (!isFinite(range) || range <= 0 || range > CAM_PIN_RANGE_MAX) {
    return camPinFail_(id + ': range must be greater than 0 and at most ' + CAM_PIN_RANGE_MAX + ' meters');
  }
  var nextLat = camPinRoundLatLng_(lat);
  var nextLng = camPinRoundLatLng_(lng);
  var prevLat = Number(existing && existing.lat);
  var prevLng = Number(existing && existing.lng);
  if (isFinite(prevLat) && isFinite(prevLng)) {
    var dist = camPinHaversineM_(prevLat, prevLng, nextLat, nextLng);
    if (dist > CAM_PIN_MAX_MOVE_M) {
      return camPinFail_(id + ': moved ' + Math.round(dist) + ' m from the saved pin. The limit is ' +
        CAM_PIN_MAX_MOVE_M + ' m, and the pin was not moved.');
    }
  }
  return {
    ok: true,
    value: {
      id: id,
      lat: nextLat,
      lng: nextLng,
      heading: camPinNormalizeHeading_(heading),
      fov: camPinRoundMeasure_(fov),
      range: camPinRoundMeasure_(range)
    }
  };
}

function camPinGeometryChanged_(cam, edit) {
  return camPinRoundLatLng_(cam.lat) !== edit.lat ||
    camPinRoundLatLng_(cam.lng) !== edit.lng ||
    camPinNormalizeHeading_(cam.heading) !== edit.heading ||
    camPinRoundMeasure_(cam.fov) !== edit.fov ||
    camPinRoundMeasure_(cam.range) !== edit.range;
}

function camPinMerge_(existing, edits, nowIso, by) {
  var actor = camPinNormActor_(by);
  if (by != null && String(by).replace(/^\s+|\s+$/g, '') !== '' && !actor) {
    return camPinFail_('editor must be Jonah, Eleanor, Bot 1, or Bot 2');
  }
  if (!existing || typeof existing !== 'object' || Array.isArray(existing)) {
    return camPinFail_('no cameras file to update');
  }
  if (!Array.isArray(existing.cameras) || !existing.cameras.length) {
    return camPinFail_('no cameras file to update');
  }
  if (!Array.isArray(edits) || !edits.length) {
    return camPinFail_('cameras array is required');
  }
  var byId = {};
  for (var i = 0; i < existing.cameras.length; i++) {
    var cam = existing.cameras[i];
    if (!cam || typeof cam.id !== 'string' || !cam.id) {
      return camPinFail_('existing camera is missing an id');
    }
    if (byId[cam.id]) return camPinFail_('cameras file has two entries for ' + cam.id);
    byId[cam.id] = cam;
  }
  var clean = [];
  var seen = {};
  for (var e = 0; e < edits.length; e++) {
    var edit = edits[e];
    if (!edit || typeof edit !== 'object') return camPinFail_('each camera edit needs an id');
    var id = typeof edit.id === 'string' ? edit.id.replace(/^\s+|\s+$/g, '') : '';
    if (!id) return camPinFail_('each camera edit needs an id');
    if (seen[id]) return camPinFail_('duplicate camera id ' + id);
    seen[id] = true;
    if (!byId[id]) {
      return camPinFail_('unknown camera id ' + id + ' — this editor does not add cameras');
    }
    var checked = camPinValidateGeometry_(edit, byId[id]);
    if (!checked.ok) return checked;
    clean.push(checked.value);
  }
  var record = JSON.parse(JSON.stringify(existing));
  var updated = [];
  var changes = [];
  var nextCams = [];
  for (var c = 0; c < record.cameras.length; c++) {
    var cur = record.cameras[c];
    var matched = null;
    for (var k = 0; k < clean.length; k++) {
      if (clean[k].id === cur.id) matched = clean[k];
    }
    if (!matched || !camPinGeometryChanged_(cur, matched)) {
      nextCams.push(cur);
      continue;
    }
    changes.push({
      id: cur.id,
      from: camPinPose_(cur),
      to: camPinPose_(matched)
    });
    var next = JSON.parse(JSON.stringify(cur));
    var moved = camPinRoundLatLng_(cur.lat) !== matched.lat || camPinRoundLatLng_(cur.lng) !== matched.lng;
    var headingChanged = camPinNormalizeHeading_(cur.heading) !== matched.heading;
    next.lat = matched.lat;
    next.lng = matched.lng;
    next.heading = matched.heading;
    next.fov = matched.fov;
    next.range = matched.range;
    if (moved) {
      delete next.mx;
      delete next.my;
      delete next.mz;
    }
    if (headingChanged && isFinite(Number(next.declination))) {
      next.heading_magnetic = camPinNormalizeHeading_(matched.heading - Number(next.declination));
    }
    updated.push(cur.id);
    nextCams.push(next);
  }
  record.cameras = nextCams;
  if (!updated.length) {
    return { ok: true, unchanged: true, record: existing, updated: [] };
  }
  var at = nowIso || new Date().toISOString();
  record.editor_saved_at = at;
  if (actor) {
    camPinAppendHistory_(record, {
      at: at,
      by: actor,
      cameras: updated.slice(),
      changes: changes
    });
  }
  return { ok: true, unchanged: false, record: record, updated: updated };
}

function camPinJsonDir_() {
  return (typeof CAMERAS_JSON_DIR === 'string' && CAMERAS_JSON_DIR) ? CAMERAS_JSON_DIR : 'data/cameras/json';
}

function camPinGithubHeaders_() {
  if (typeof getCredentials !== 'function') return null;
  var creds = getCredentials();
  if (!creds || !creds.githubToken) return null;
  return {
    'Authorization': 'token ' + creds.githubToken,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json'
  };
}

function camPinGetRawJson_(repoPath) {
  var headers = camPinGithubHeaders_();
  if (!headers) return { ok: false, error: 'GITHUB_TOKEN is not set in the script properties' };
  var branch = (typeof GITHUB_BRANCH === 'string' && GITHUB_BRANCH) ? GITHUB_BRANCH : 'main';
  var repo = (typeof GITHUB_REPO === 'string' && GITHUB_REPO) ? GITHUB_REPO : '';
  if (!repo) return { ok: false, error: 'GITHUB_REPO is not set' };
  var url = 'https://api.github.com/repos/' + repo + '/contents/' + repoPath + '?ref=' + encodeURIComponent(branch);
  var res = UrlFetchApp.fetch(url, { method: 'GET', headers: headers, muteHttpExceptions: true });
  var code = res.getResponseCode();
  if (code === 404) return { ok: true, missing: true };
  if (code !== 200) return { ok: false, error: 'GitHub read failed (HTTP ' + code + ')' };
  var body = JSON.parse(res.getContentText());
  var raw = Utilities.newBlob(Utilities.base64Decode(String(body.content || '').replace(/\n/g, ''))).getDataAsString();
  var rec;
  try { rec = JSON.parse(raw); }
  catch (err) { return { ok: false, error: 'file is not JSON' }; }
  return { ok: true, rec: rec, sha: body.sha || '' };
}

function camPinGetJson_(repoPath) {
  var got = camPinGetRawJson_(repoPath);
  if (!got.ok || got.missing) return got;
  if (!got.rec || !Array.isArray(got.rec.cameras) || !got.rec.cameras.length) {
    return { ok: false, error: 'cameras file has no cameras — this editor does not create one' };
  }
  return got;
}

function camPinPutAny_(repoPath, text, message, sha) {
  var headers = camPinGithubHeaders_();
  if (!headers) return { ok: false, error: 'GITHUB_TOKEN is not set in the script properties' };
  var branch = (typeof GITHUB_BRANCH === 'string' && GITHUB_BRANCH) ? GITHUB_BRANCH : 'main';
  var repo = (typeof GITHUB_REPO === 'string' && GITHUB_REPO) ? GITHUB_REPO : '';
  if (!repo) return { ok: false, error: 'GITHUB_REPO is not set' };
  var url = 'https://api.github.com/repos/' + repo + '/contents/' + repoPath;
  var b64 = Utilities.base64Encode(text).replace(/\s+/g, '');
  var payload = { message: message, content: b64, branch: branch };
  if (sha) payload.sha = sha;
  var res = UrlFetchApp.fetch(url, {
    method: 'PUT',
    headers: headers,
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  var code = res.getResponseCode();
  Logger.log('camera pin editor PUT ' + code + ' ' + repoPath);
  if (code !== 200 && code !== 201) {
    return { ok: false, error: 'GitHub write failed (HTTP ' + code + ')', conflict: code === 409 };
  }
  return { ok: true };
}

function camPinAppendHistoryLog_(event) {
  var got = camPinGetRawJson_(CAM_PIN_HISTORY_LOG);
  var doc = { version: 1, events: [] };
  var sha = '';
  if (got.ok && !got.missing && got.rec && typeof got.rec === 'object') {
    doc = got.rec;
    sha = got.sha || '';
    if (!Array.isArray(doc.events)) doc.events = [];
  } else if (got.ok && got.missing) {
    sha = '';
  } else if (!got.ok) {
    Logger.log('camera pin history log read failed: ' + got.error);
    return;
  }
  doc.version = 1;
  doc.events.push({
    at: event.at,
    by: event.by,
    property: event.property,
    file_id: event.file_id,
    name: event.name || '',
    cameras: event.cameras || []
  });
  if (doc.events.length > CAM_PIN_HISTORY_LOG_MAX) {
    doc.events = doc.events.slice(doc.events.length - CAM_PIN_HISTORY_LOG_MAX);
  }
  var text = JSON.stringify(doc, null, 2) + '\n';
  var put = camPinPutAny_(CAM_PIN_HISTORY_LOG, text, 'Camera pin history ' + event.property, sha);
  if (!put.ok) Logger.log('camera pin history log write failed: ' + put.error);
}

function camPinPut_(repoPath, text, message, sha) {
  if (!sha) return { ok: false, error: 'refusing to create a cameras file' };
  var headers = camPinGithubHeaders_();
  if (!headers) return { ok: false, error: 'GITHUB_TOKEN is not set in the script properties' };
  var branch = (typeof GITHUB_BRANCH === 'string' && GITHUB_BRANCH) ? GITHUB_BRANCH : 'main';
  var repo = (typeof GITHUB_REPO === 'string' && GITHUB_REPO) ? GITHUB_REPO : '';
  if (!repo) return { ok: false, error: 'GITHUB_REPO is not set' };
  var url = 'https://api.github.com/repos/' + repo + '/contents/' + repoPath;
  var b64 = Utilities.base64Encode(text).replace(/\s+/g, '');
  var payload = { message: message, content: b64, sha: sha, branch: branch };
  var res = UrlFetchApp.fetch(url, {
    method: 'PUT',
    headers: headers,
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  var code = res.getResponseCode();
  Logger.log('camera pin editor PUT ' + code + ' ' + repoPath);
  if (code !== 200 && code !== 201) {
    return { ok: false, error: 'GitHub write failed (HTTP ' + code + ')', conflict: code === 409 };
  }
  var commit = '';
  try {
    var done = JSON.parse(res.getContentText());
    commit = (done.commit && done.commit.sha) || '';
  } catch (ignore) { commit = ''; }
  return { ok: true, commit: commit };
}

function camPinPublicError_(msg) {
  var s = String(msg || 'AWS PUT failed');
  s = s.replace(/AKIA[0-9A-Z]{16}/g, '[key]');
  s = s.replace(/AWS4-HMAC-SHA256 Credential=[^,\s]+/g, 'AWS4-HMAC-SHA256 Credential=[redacted]');
  if (s.length > 300) s = s.substring(0, 300);
  return s;
}

// GitHub file id → mothership hub. recordsSidecarHubId_ is the only remap.
function camPinRecordsTarget_(fileId) {
  if (typeof recordsSidecarHubId_ !== 'function') {
    return { ok: false, error: 'recordsSidecarHubId_ is not in this deployment' };
  }
  var hubId = recordsSidecarHubId_(fileId) || '';
  if (!hubId) return { ok: false, error: 'no mothership hub for cameras file ' + fileId };
  return { ok: true, hubId: hubId, key: 'cameras/' + hubId + '.json' };
}

// Copy the merged cameras JSON onto property-intel-records. Reuses
// recordsPublishGithubPath_ (photo URLs, index files.cameras, S3 PUT).
function camPinRefreshRecords_(repoPath, content, fileId) {
  var target = camPinRecordsTarget_(fileId);
  if (!target.ok) return target;
  if (typeof recordsPublishGithubPath_ !== 'function') {
    target.ok = false;
    target.error = 'recordsPublishGithubPath_ is not in this deployment';
    return target;
  }
  try {
    recordsPublishGithubPath_(repoPath, content);
  } catch (err) {
    target.ok = false;
    target.error = camPinPublicError_(err && err.message);
    return target;
  }
  return target;
}

function camPinRespond_(base, recordsResult) {
  var out = {
    route: 'camera-pins-save',
    property: base.property,
    file_id: base.fileId,
    path: base.path,
    updated: base.updated || [],
    unchanged: !!base.unchanged,
    commit: base.commit || '',
    by: base.by || '',
    records_hub: (recordsResult && recordsResult.hubId) || '',
    records_key: (recordsResult && recordsResult.key) || ''
  };
  if (recordsResult && recordsResult.ok) {
    out.ok = true;
    out.records = true;
    return out;
  }
  var where = out.records_key
    ? ('s3://property-intel-records/' + out.records_key)
    : 's3://property-intel-records/cameras/{hubId}.json';
  out.ok = false;
  out.partial = true;
  out.github_saved = true;
  out.records = false;
  out.error = 'GitHub saved ' + base.path + ' but the AWS records copy failed (' + where + '). ' +
    ((recordsResult && recordsResult.error) || 'AWS PUT failed');
  return out;
}

function camPinAfterGithub_(base, repoPath, content) {
  return camPinRespond_(base, camPinRefreshRecords_(repoPath, content, base.fileId));
}

function camPinFileBody_(fileId, record) {
  if (typeof buildCamerasFile_ === 'function') {
    var built = buildCamerasFile_(fileId, record);
    var content = String(built.content || '');
    if (content.charAt(content.length - 1) !== '\n') content += '\n';
    return { path: built.path, content: content };
  }
  var path = camPinJsonDir_() + '/' + fileId + '.json';
  return { path: path, content: JSON.stringify(record, null, 2) + '\n' };
}

// POST route=camera-pins-save
// Body: { property, file_id, by, name, cameras: [{ id, lat, lng, heading, fov, range }] }
function camerasEditorSave_(payload) {
  payload = payload || {};
  var propertyId = camPinNormId_(payload.property);
  if (!propertyId) return { ok: false, route: 'camera-pins-save', error: 'property must be the 32-character hub id' };
  var actor = camPinNormActor_(payload.by);
  if (!actor) {
    return { ok: false, route: 'camera-pins-save', error: 'by must be Jonah, Eleanor, Bot 1, or Bot 2' };
  }
  var fileId = camPinNormId_(payload.file_id);
  if (!fileId) return { ok: false, route: 'camera-pins-save', error: 'file_id must be the cameras file that was loaded' };
  var candidates = camPinCandidates_(propertyId);
  if (candidates.indexOf(fileId) === -1) {
    return {
      ok: false,
      route: 'camera-pins-save',
      error: 'file_id is not a cameras file for this property'
    };
  }
  if (!Array.isArray(payload.cameras) || !payload.cameras.length) {
    return { ok: false, route: 'camera-pins-save', error: 'cameras array is required' };
  }

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (waitErr) {
    return { ok: false, route: 'camera-pins-save', error: 'another save is running — try again' };
  }
  try {
    var repoPath = camPinJsonDir_() + '/' + fileId + '.json';
    var got = camPinGetJson_(repoPath);
    if (!got.ok) return { ok: false, route: 'camera-pins-save', error: got.error };
    if (got.missing) {
      return {
        ok: false,
        route: 'camera-pins-save',
        error: 'no cameras file at ' + repoPath + ' — this editor does not create one'
      };
    }
    var merged = camPinMerge_(got.rec, payload.cameras, '', actor);
    if (!merged.ok) return { ok: false, route: 'camera-pins-save', error: merged.error };
    if (merged.unchanged) {
      var currentFile = camPinFileBody_(fileId, got.rec);
      return camPinAfterGithub_({
        property: propertyId,
        fileId: fileId,
        path: repoPath,
        updated: [],
        unchanged: true,
        commit: ''
      }, currentFile.path, currentFile.content);
    }
    var file = camPinFileBody_(fileId, merged.record);
    var put = camPinPut_(file.path, file.content, 'Camera pin editor ' + fileId, got.sha);
    if (!put.ok && put.conflict) {
      var again = camPinGetJson_(file.path);
      if (!again.ok || again.missing) {
        return { ok: false, route: 'camera-pins-save', error: 'cameras file changed during save — reload and try again' };
      }
      merged = camPinMerge_(again.rec, payload.cameras, '', actor);
      if (!merged.ok) return { ok: false, route: 'camera-pins-save', error: merged.error };
      if (merged.unchanged) {
        file = camPinFileBody_(fileId, again.rec);
        return camPinAfterGithub_({
          property: propertyId,
          fileId: fileId,
          path: file.path,
          updated: [],
          unchanged: true,
          commit: ''
        }, file.path, file.content);
      }
      file = camPinFileBody_(fileId, merged.record);
      put = camPinPut_(file.path, file.content, 'Camera pin editor ' + fileId, again.sha);
    }
    if (!put.ok) return { ok: false, route: 'camera-pins-save', error: put.error };
    camPinAppendHistoryLog_({
      at: merged.record.editor_saved_at,
      by: actor,
      property: propertyId,
      file_id: fileId,
      name: String(payload.name || ''),
      cameras: merged.updated
    });
    return camPinAfterGithub_({
      property: propertyId,
      fileId: fileId,
      path: file.path,
      updated: merged.updated,
      unchanged: false,
      commit: put.commit || '',
      by: actor
    }, file.path, file.content);
  } finally {
    lock.releaseLock();
  }
}

function camPinReviewEntry_(raw) {
  var src = raw && typeof raw === 'object' ? raw : {};
  var note = String(src.note == null ? '' : src.note);
  if (note.length > CAM_PIN_NOTE_MAX) note = note.substring(0, CAM_PIN_NOTE_MAX);
  return {
    done: src.done === true,
    note: note,
    by: camPinNormActor_(src.by),
    at: String(src.at || '')
  };
}

function camPinReviewRecords_(parsed) {
  var out = {};
  if (!parsed || typeof parsed !== 'object') return out;
  var src = (parsed.reviews && typeof parsed.reviews === 'object') ? parsed.reviews : parsed;
  var keys = Object.keys(src);
  for (var i = 0; i < keys.length; i++) {
    var id = camPinNormId_(keys[i]);
    if (!id) continue;
    var entry = camPinReviewEntry_(src[keys[i]]);
    if (entry.done || entry.note) out[id] = entry;
  }
  return out;
}

function camerasEditorReviewGet_() {
  var got = camPinGetRawJson_(CAM_PIN_REVIEW_LOG);
  if (!got.ok) return { ok: false, route: 'camera-pins-review', error: got.error };
  var reviews = {};
  if (!got.missing && got.rec) reviews = camPinReviewRecords_(got.rec);
  return { ok: true, route: 'camera-pins-review', version: 1, reviews: reviews };
}

function camerasEditorReviewSave_(payload) {
  payload = payload || {};
  var actor = camPinNormActor_(payload.by);
  if (!actor) {
    return { ok: false, route: 'camera-pins-review-save', error: 'by must be Jonah, Eleanor, Bot 1, or Bot 2' };
  }
  var edits = payload.reviews;
  if (!edits || typeof edits !== 'object') {
    return { ok: false, route: 'camera-pins-review-save', error: 'reviews object is required' };
  }
  var editKeys = Object.keys(edits);
  if (!editKeys.length) {
    return { ok: false, route: 'camera-pins-review-save', error: 'reviews object is required' };
  }
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (waitErr) {
    return { ok: false, route: 'camera-pins-review-save', error: 'another save is running — try again' };
  }
  try {
    var got = camPinGetRawJson_(CAM_PIN_REVIEW_LOG);
    if (!got.ok) return { ok: false, route: 'camera-pins-review-save', error: got.error };
    var existing = {};
    var sha = '';
    if (!got.missing && got.rec) {
      existing = camPinReviewRecords_(got.rec);
      sha = got.sha || '';
    }
    var next = {};
    var have = Object.keys(existing);
    for (var h = 0; h < have.length; h++) next[have[h]] = existing[have[h]];
    var updated = [];
    var at = new Date().toISOString();
    for (var i = 0; i < editKeys.length; i++) {
      var id = camPinNormId_(editKeys[i]);
      if (!id) {
        return { ok: false, route: 'camera-pins-review-save', error: 'each review needs a hub id' };
      }
      var entry = camPinReviewEntry_(edits[editKeys[i]]);
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
    var doc = { version: 1, reviews: next };
    var text = JSON.stringify(doc, null, 2) + '\n';
    var put = camPinPutAny_(CAM_PIN_REVIEW_LOG, text, 'Camera pin review ' + updated.join(','), sha);
    if (!put.ok && put.conflict) {
      return { ok: false, route: 'camera-pins-review-save', error: 'review file changed during save — try again' };
    }
    if (!put.ok) return { ok: false, route: 'camera-pins-review-save', error: put.error };
    return {
      ok: true,
      route: 'camera-pins-review-save',
      by: actor,
      at: at,
      updated: updated
    };
  } finally {
    lock.releaseLock();
  }
}
