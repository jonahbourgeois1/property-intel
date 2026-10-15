// ============================================================
// PROPERTY INTEL — CHEKT Accounts
// One row per CHEKT account. You paste the rows. Setup only writes
// the header. Match fills Property hub id from the CHEKT site ids when
// an index already lists them, then from CS# or address. It fills the
// password when a hub id is present.
// Publish writes password hashes to private S3 and writes chekt_sites
// onto that hub's index in property-intel-records. The password never
// goes on the index.
//
// Script Property CHEKT_SYNC_KEY holds the viewer password. The Lambda
// env stays VIEWER_PASSWORD. Catalog and password hashes use this value.
// No new Lambda env var. Paste, save, and create a new deployment.
//
// Camera pins are not a sheet tab. They are cameras/{hub}.json on
// property-intel-records, next to that hub's index. The Chekt account
// tab is unchanged.
//
// 2026-10-05 — accounts with no hub. Match joins an index that already
// exists; an account whose property was never mapped stays blank and is
// never published. Four actions close that from the sheet (see the
// section "CHEKT accounts with no property hub" at the end of this file):
// Add unmatched accounts to Satellite, CHEKT rows Pass 1 (batch / auto),
// and Sync CHEKT Satellite rows to records. Then Match and Publish as
// before. Fill CHEKT site ids also writes the CS# from the catalog when
// the row had none.
// ============================================================

var CHEKT_ACCOUNTS_SHEET = 'Chekt';
var CHEKT_ACCOUNTS_BUCKET = 'property-intel-ingest';
var CHEKT_ACCOUNTS_KEY = 'reference/chekt-accounts.json';
var CHEKT_GW_URL = 'https://xuzftiqa5gqy35yf26y2bca2ji0ivbnj.lambda-url.us-east-1.on.aws';
var CHEKT_PASS_MIN = 5;

// A name, B address, C hub id, D site ids, E password,
// F alias property ids, G last published, H CS#, I match note,
// J the site name CHEKT uses (often different from the account name).
// K the vyanet-viewer customer link for that hub.
// L Scan checkbox. Blank or unchecked = the runner skips the row.
// M Scan hours. Used only when L is checked. .25 is 15 minutes,
// .5 is 30 minutes, 1 is the top of every hour.
var CHEKT_COL_NAME = 1;
var CHEKT_COL_ADDRESS = 2;
var CHEKT_COL_HUB = 3;
var CHEKT_COL_SITES = 4;
var CHEKT_COL_PASSWORD = 5;
var CHEKT_COL_ALIASES = 6;
var CHEKT_COL_PUBLISHED = 7;
var CHEKT_COL_CS = 8;
var CHEKT_COL_MATCH = 9;
var CHEKT_COL_CHEKT_NAME = 10;
var CHEKT_COL_LINK = 11;
var CHEKT_COL_SCAN = 12;
var CHEKT_COL_SCAN_MINUTES = 13;
var CHEKT_VIEWER_PAGE = 'https://responder-intel.vyanet.com/vyanet-viewer.html';

var CHEKT_HEADERS = [
  'Account name',
  'Address',
  'Property hub id',
  'CHEKT site ids',
  'Password',
  'Also accepts property ids',
  'Last published',
  'CS#',
  'Match',
  'CHEKT site name',
  'Viewer link',
  'Scan',
  'Scan hours'
];

function setupChektAccountsSheet() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CHEKT_ACCOUNTS_SHEET);
  var created = !sheet;
  if (!sheet) sheet = ss.insertSheet(CHEKT_ACCOUNTS_SHEET);
  if (sheet.getMaxColumns() < CHEKT_HEADERS.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), CHEKT_HEADERS.length - sheet.getMaxColumns());
  }
  sheet.getRange(1, 1, 1, CHEKT_HEADERS.length).setValues([CHEKT_HEADERS]).setFontWeight('bold');
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(1);
  chektApplyScanCheckbox_(sheet);
  var last = sheet.getLastRow();
  var linked = chektWriteViewerLinks_(sheet);
  ui.alert('CHEKT Accounts',
    (created ? 'Created' : 'Updated') + ' the "' + CHEKT_ACCOUNTS_SHEET + '" header.\n\n' +
    (last > 1
      ? 'Wrote ' + linked + ' viewer link(s) for rows that already have a hub id.\n\n'
      : 'No accounts were added.\n\n') +
    'Paste your CHEKT accounts (name, address, site ids, CS#). Then run Match addresses to index.\n\n' +
    'Scan is a checkbox. Scan hours is the cadence (.25, .5, or a whole number of hours). The runner skips a row unless Scan is checked.',
    ui.ButtonSet.OK);
}

function chektApplyScanCheckbox_(sheet) {
  var rule = SpreadsheetApp.newDataValidation().requireCheckbox().build();
  sheet.getRange(2, CHEKT_COL_SCAN, 2000, 1).setDataValidation(rule);
}

// Chekt hub -> SAFE hub. Same pairs as RECORDS_SIDECAR_HUB_REMAP.
var CHEKT_SCAN_REMAP = {
  '6de88883bfd4a8349a901c54611ed9d7': 'd9f759d7351db3886c79dd689c41e3c0',
  '4a484f8c273abef3c02cf91e274f9e2f': '8eea64e5c09dc806f667b079e111a38d'
};

// Checked rows only. No passwords. The watcher calls this through ?route=scan-roster.
function chektScanRoster_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CHEKT_ACCOUNTS_SHEET);
  if (!sheet) return { ok: false, error: 'Chekt sheet is missing' };
  var last = sheet.getLastRow();
  if (last < 2) return { ok: true, rows: [], skipped: 0 };
  if (sheet.getLastColumn() < CHEKT_COL_SCAN_MINUTES) {
    return { ok: false, error: 'Scan columns are missing. Run Set Up CHEKT Accounts Sheet.' };
  }
  var vals = sheet.getRange(2, 1, last - 1, CHEKT_COL_SCAN_MINUTES).getValues();
  var rows = [];
  var skipped = 0;
  for (var i = 0; i < vals.length; i++) {
    var scan = vals[i][CHEKT_COL_SCAN - 1];
    var on = scan === true || String(scan).toLowerCase() === 'true';
    if (!on) continue;
    var hub = String(vals[i][CHEKT_COL_HUB - 1] || '').trim().toLowerCase();
    var cadence = chektScanHours_(vals[i][CHEKT_COL_SCAN_MINUTES - 1]);
    var name = String(vals[i][CHEKT_COL_NAME - 1] || '').trim();
    if (!/^[0-9a-f]{32}$/.test(hub) || !cadence.minutes) {
      skipped++;
      continue;
    }
    rows.push({
      name: name,
      hub: hub,
      store: CHEKT_SCAN_REMAP[hub] || hub,
      hours: cadence.hours,
      minutes: cadence.minutes
    });
  }
  return { ok: true, rows: rows, skipped: skipped };
}

// The cell is hours. .25 and .5 divide the hour. A whole number lands on
// the hour in the sheet's timezone. Anything else is skipped.
var CHEKT_SCAN_TRIGGER = 'chektScanTick';

function chektScanHours_(value) {
  var hours = (typeof value === 'number') ? value : parseFloat(String(value == null ? '' : value).trim());
  if (!(hours > 0) || hours > 24) return { hours: hours, minutes: 0 };
  var exact = hours * 60;
  var mins = Math.round(exact);
  if (Math.abs(exact - mins) > 0.05) return { hours: hours, minutes: 0 };
  if (mins < 60) {
    if (mins < 15 || (60 % mins) !== 0) return { hours: hours, minutes: 0 };
    return { hours: hours, minutes: mins };
  }
  if ((mins % 60) !== 0) return { hours: hours, minutes: 0 };
  return { hours: hours, minutes: mins };
}

function chektScanMarkOk_(mins) {
  return mins >= 15 && (mins < 60 ? (60 % mins) === 0 : (mins % 60) === 0);
}

function chektWallToDate_(y, mo, d, h, mi, tz) {
  var guess = new Date(Date.UTC(y, mo - 1, d, h, mi, 0));
  var got = Utilities.formatDate(guess, tz, 'yyyy-MM-dd-HH-mm').split('-');
  var gotUtc = Date.UTC(Number(got[0]), Number(got[1]) - 1, Number(got[2]), Number(got[3]), Number(got[4]));
  var wantUtc = Date.UTC(y, mo - 1, d, h, mi);
  return new Date(guess.getTime() - (gotUtc - wantUtc));
}

function chektScanSlot_(mins, now) {
  if (mins < 60) {
    var step = mins * 60000;
    var ms = now.getTime();
    return new Date(ms - (ms % step));
  }
  var every = mins / 60;
  var tz = 'America/Chicago';
  try { tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone() || tz; } catch (e) {}
  var parts = Utilities.formatDate(now, tz, 'yyyy-MM-dd-HH').split('-');
  var y = Number(parts[0]);
  var mo = Number(parts[1]);
  var d = Number(parts[2]);
  var h = Number(parts[3]);
  var aligned = h - (h % every);
  return chektWallToDate_(y, mo, d, aligned, 0, tz);
}

// Checked rows plus the password. Not a web route.
function chektScanEnrolled_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CHEKT_ACCOUNTS_SHEET);
  if (!sheet) return { ok: false, error: 'Chekt sheet is missing' };
  var last = sheet.getLastRow();
  if (last < 2) return { ok: true, rows: [] };
  if (sheet.getLastColumn() < CHEKT_COL_SCAN_MINUTES) {
    return { ok: false, error: 'Scan columns are missing. Run Set Up CHEKT Accounts Sheet.' };
  }
  var vals = sheet.getRange(2, 1, last - 1, CHEKT_COL_SCAN_MINUTES).getValues();
  var rows = [];
  for (var i = 0; i < vals.length; i++) {
    var scan = vals[i][CHEKT_COL_SCAN - 1];
    var on = scan === true || String(scan).toLowerCase() === 'true';
    if (!on) continue;
    var hub = String(vals[i][CHEKT_COL_HUB - 1] || '').trim().toLowerCase();
    var cadence = chektScanHours_(vals[i][CHEKT_COL_SCAN_MINUTES - 1]);
    var name = String(vals[i][CHEKT_COL_NAME - 1] || '').trim();
    var password = String(vals[i][CHEKT_COL_PASSWORD - 1] || '').trim();
    if (!/^[0-9a-f]{32}$/.test(hub)) continue;
    rows.push({
      name: name,
      hub: hub,
      store: CHEKT_SCAN_REMAP[hub] || hub,
      hours: cadence.hours,
      minutes: cadence.minutes,
      password: password,
      row: i + 2
    });
  }
  return { ok: true, rows: rows };
}

function chektScanFetch_(hub, password, only) {
  var allow = null;
  if (only && only.length) {
    allow = {};
    for (var a = 0; a < only.length; a++) allow[String(only[a])] = true;
  }
  var skip = {};
  var frames = [];
  var missed = [];
  for (var round = 0; round < 8; round++) {
    var ids = Object.keys(skip);
    var url = CHEKT_GW_URL + '/scan?property=' + encodeURIComponent(hub);
    if (allow) url += '&only=' + encodeURIComponent(Object.keys(allow).join(','));
    if (ids.length) url += '&skip=' + encodeURIComponent(ids.join(','));
    var res = UrlFetchApp.fetch(url, {
      method: 'get',
      headers: { 'x-viewer-key': password },
      muteHttpExceptions: true
    });
    var code = res.getResponseCode();
    if (code === 429) return { ok: false, error: 'gateway 429' };
    if (code === 401) return { ok: false, error: 'gateway 401' };
    if (code !== 200) return { ok: false, error: 'gateway HTTP ' + code };
    var body;
    try { body = JSON.parse(res.getContentText() || '{}'); }
    catch (e) { return { ok: false, error: 'gateway 200 was not JSON' }; }
    var cams = body.cameras || [];
    for (var i = 0; i < cams.length; i++) {
      var c = cams[i];
      if (!c || c.device_id === undefined || c.device_id === null || !c.jpeg_base64) continue;
      skip[String(c.device_id)] = true;
      if (allow && !allow[String(c.device_id)]) continue;
      frames.push(c);
    }
    var lost = body.missed || [];
    for (var j = 0; j < lost.length; j++) {
      if (lost[j] && lost[j].device_id !== undefined && lost[j].device_id !== null) {
        skip[String(lost[j].device_id)] = true;
      }
      missed.push(lost[j]);
    }
    var remaining = body.remaining || [];
    if (!remaining.length) return { ok: true, frames: frames, missed: missed };
    Utilities.sleep(250);
  }
  return { ok: true, frames: frames, missed: missed };
}

function chektScanStore_(row, frame, previous) {
  if (typeof recordsScanPut_ !== 'function' || typeof recordsScanStamp_ !== 'function') {
    throw new Error('recordsScanPut_ is not in this project. Paste records.gs and save.');
  }
  var stamp = recordsScanStamp_(frame.requested_at);
  if (!stamp) throw new Error('gateway timestamp was not UTC');
  var jpeg = recordsScanPut_({
    part: 'jpeg',
    hub: row.store,
    device_id: String(frame.device_id),
    stamp: stamp,
    requested_at: frame.requested_at,
    body_base64: frame.jpeg_base64
  });
  if (!jpeg.ok) throw new Error(jpeg.error || 'jpeg put failed');
  var json = recordsScanPut_({
    part: 'json',
    hub: row.store,
    device_id: String(frame.device_id),
    stamp: stamp,
    requested_at: frame.requested_at,
    scan: {
      name: frame.name || '',
      received_at: frame.received_at,
      source: 'mjpeg',
      previous: previous || ''
    }
  });
  if (!json.ok) throw new Error(json.error || 'json put failed');
  return { jpeg: jpeg.key, json: json.key };
}

function chektScanStateBlank_(hub, store) {
  return {
    schema: 'property-intel-records/camera-scan-state-v1',
    hub: hub,
    store: store || '',
    minutes: 0,
    seen: 0,
    slot: 0,
    previous: {},
    queue: []
  };
}

// One file per enrolled row. Copies any Script Properties from the old
// clock once, then deletes those keys so Project Settings stays for secrets.
function chektScanStateLoad_(row) {
  if (typeof recordsScanStateGet_ !== 'function' || typeof recordsScanStatePut_ !== 'function') {
    throw new Error('recordsScanStateGet_ is not in this project. Paste records.gs and save.');
  }
  var props = PropertiesService.getScriptProperties();
  var state = recordsScanStateGet_(row.hub);
  if (!state) {
    state = chektScanStateBlank_(row.hub, row.store);
    var seen = props.getProperty('scan-seen:' + row.hub);
    var slot = props.getProperty('scan-slot:' + row.hub);
    var mins = props.getProperty('scan-mins:' + row.hub);
    if (seen) state.seen = Number(seen);
    if (slot) state.slot = Number(slot);
    if (mins) state.minutes = Number(mins);
    var prefix = 'scan-prev:' + row.store + ':';
    props.getKeys().forEach(function (k) {
      if (k.indexOf(prefix) !== 0) return;
      var jpg = String(props.getProperty(k) || '');
      if (jpg) state.previous[k.substring(prefix.length)] = jpg;
    });
    recordsScanStatePut_(row.hub, state);
  } else if (row.store) {
    state.store = row.store;
  }
  var prefixNow = 'scan-prev:' + row.store + ':';
  props.getKeys().forEach(function (k) {
    if (k === 'scan-seen:' + row.hub || k === 'scan-slot:' + row.hub || k === 'scan-mins:' + row.hub || k === 'scan-review-queue' || k.indexOf(prefixNow) === 0) {
      props.deleteProperty(k);
    }
  });
  return state;
}

function chektScanReviewKeyOk_(supplied) {
  var expected = String(PropertiesService.getScriptProperties().getProperty('SCAN_REVIEW_KEY') || '').trim();
  if (!expected) return false;
  return String(supplied || '').trim() === expected;
}

function chektScanWalkBlank_(tip) {
  return { at: tip || '', stack: [], tip: tip || '', stopAt: '', done: !tip };
}

function chektScanPrepareWalks_(state) {
  if (!state.walks || typeof state.walks !== 'object') state.walks = {};
  if (!Array.isArray(state.backlog)) state.backlog = [];
  var prev = state.previous || {};
  for (var device in prev) {
    if (!prev.hasOwnProperty(device)) continue;
    var tip = String(prev[device] || '').replace(/\.json$/, '.jpg');
    var w = state.walks[device];
    if (!w) {
      state.walks[device] = chektScanWalkBlank_(tip);
      continue;
    }
    if (!Array.isArray(w.stack)) w.stack = [];
    if (w.done && tip && tip !== w.tip) {
      w.stopAt = w.tip;
      w.at = tip;
      w.stack = [];
      w.tip = tip;
      w.done = false;
    }
  }
}

function chektScanFlushStack_(state, w) {
  var items = w.stack || [];
  w.stack = [];
  for (var i = items.length - 1; i >= 0; i--) {
    var item = items[i];
    if (!item || !item.reviewable || !item.key) continue;
    if (state.backlog.indexOf(item.key) === -1) state.backlog.push(item.key);
  }
}

// Walks backward toward the oldest frame, a few objects per call.
function chektScanIndexMore_(state, budget) {
  var prev = state.previous || {};
  var devices = [];
  for (var device in prev) if (prev.hasOwnProperty(device)) devices.push(device);
  devices.sort();
  for (var d = 0; d < devices.length && budget > 0; d++) {
    var w = state.walks[devices[d]];
    if (!w || w.done) continue;
    while (w.at && budget > 0) {
      var here = String(w.at).replace(/\.json$/, '.jpg');
      if (w.stopAt && here === w.stopAt) {
        chektScanFlushStack_(state, w);
        w.done = true;
        w.at = '';
        w.stopAt = '';
        break;
      }
      budget--;
      var meta = chektScanFrameMeta_(here);
      if (!meta) {
        chektScanFlushStack_(state, w);
        w.done = true;
        w.at = '';
        break;
      }
      w.stack.push({ key: meta.key, reviewable: !!meta.previous });
      if (!meta.previous) {
        chektScanFlushStack_(state, w);
        w.done = true;
        w.at = '';
        w.stopAt = '';
        break;
      }
      w.at = meta.previous;
    }
  }
}

function chektScanWalksDone_(state) {
  var prev = state.previous || {};
  for (var device in prev) {
    if (!prev.hasOwnProperty(device)) continue;
    var w = state.walks[device];
    if (!w || !w.done) return false;
  }
  return true;
}

function chektScanPairFrom_(key) {
  var obj;
  try { obj = recordsFetchJson_(key); } catch (e) { return { ok: false, error: e.message }; }
  if (!obj || !obj.previous || obj.reviewed_at) return { skip: true };
  var ownBytes = recordsS3GetBytes_(key.replace(/\.json$/, '.jpg'));
  var prevBytes = recordsS3GetBytes_(obj.previous);
  if (!ownBytes || !prevBytes) {
    recordsScanReview_({ key: key, description: '' });
    return { skip: true };
  }
  return {
    ok: true,
    pending: true,
    key: key,
    hub: obj.hub,
    device_id: obj.device_id,
    name: obj.name,
    requested_at: obj.requested_at,
    previous: obj.previous,
    jpeg_base64: Utilities.base64Encode(ownBytes),
    previous_base64: Utilities.base64Encode(prevBytes)
  };
}

function chektScanTakePair_(state) {
  if (!Array.isArray(state.queue)) state.queue = [];
  var guard = 0;
  while (state.queue.length && guard < 8) {
    guard++;
    var queued = chektScanPairFrom_(state.queue[0]);
    if (queued && queued.ok === false) return queued;
    if (queued && queued.skip) { state.queue.shift(); continue; }
    if (queued) return queued;
  }
  guard = 0;
  while (state.backlog.length && guard < 8) {
    guard++;
    var key = state.backlog[0];
    var queued = chektScanPairFrom_(key);
    if (queued && queued.ok === false) return queued;
    if (queued && queued.skip) { state.backlog.shift(); continue; }
    if (queued) return queued;
  }
  return null;
}

function chektScanNext_(reviewKey) {
  if (!chektScanReviewKeyOk_(reviewKey)) return { ok: false, error: 'bad or missing review key' };
  if (typeof recordsFetchJson_ !== 'function' || typeof recordsS3GetBytes_ !== 'function' || typeof recordsScanReview_ !== 'function' || typeof chektScanFrameMeta_ !== 'function') {
    return { ok: false, error: 'paste records.gs and chekt-accounts.gs, save, and deploy a new version' };
  }
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return { ok: false, error: 'busy' };
  try {
    var enrolled = chektScanEnrolled_();
    if (!enrolled.ok) return enrolled;
    var rows = enrolled.rows || [];
    for (var r = 0; r < rows.length; r++) {
      var state = chektScanStateLoad_(rows[r]);
      chektScanPrepareWalks_(state);
      var pair = chektScanTakePair_(state);
      if (pair && pair.ok === false) {
        recordsScanStatePut_(rows[r].hub, state);
        return pair;
      }
      if (!pair) {
        chektScanIndexMore_(state, 20);
        pair = chektScanTakePair_(state);
        if (pair && pair.ok === false) {
          recordsScanStatePut_(rows[r].hub, state);
          return pair;
        }
      }
      recordsScanStatePut_(rows[r].hub, state);
      if (pair) return pair;
      if (!chektScanWalksDone_(state)) {
        return { ok: true, pending: true, indexing: true, backlog: state.backlog.length };
      }
    }
    return { ok: true, pending: false };
  } finally {
    lock.releaseLock();
  }
}

function chektScanReview_(opts) {
  opts = opts || {};
  if (!chektScanReviewKeyOk_(opts.review_key)) return { ok: false, error: 'bad or missing review key' };
  if (typeof recordsScanReview_ !== 'function') {
    return { ok: false, error: 'paste records.gs, save, and deploy a new version' };
  }
  var result = recordsScanReview_({ key: opts.key, description: opts.description });
  if (result && result.ok) {
    var enrolled = chektScanEnrolled_();
    var rows = (enrolled && enrolled.rows) || [];
    var noted = false;
    for (var i = 0; i < rows.length; i++) {
      var state = recordsScanStateGet_(rows[i].hub);
      var same = rows[i].store && String(result.hubId || '') === rows[i].store;
      if (!state && !same) continue;
      var inQueue = state && state.queue && state.queue.indexOf(opts.key) !== -1;
      var inBacklog = state && state.backlog && state.backlog.indexOf(opts.key) !== -1;
      if (!inQueue && !inBacklog && !same) continue;
      if (state && inQueue) state.queue = state.queue.filter(function (k) { return k !== opts.key; });
      if (state && inBacklog) state.backlog = state.backlog.filter(function (k) { return k !== opts.key; });
      if (state && (inQueue || inBacklog)) recordsScanStatePut_(rows[i].hub, state);
      if (result.description && typeof recordsScanNotesAdd_ === 'function') {
        try { recordsScanNotesAdd_(rows[i].hub, result); } catch (e) { Logger.log('scan notes: ' + e.message); }
        noted = true;
      }
      break;
    }
    if (!noted && result.description && typeof recordsScanNotesAdd_ === 'function') {
      for (var j = 0; j < rows.length; j++) {
        if (rows[j].store !== String(result.hubId || '') && rows[j].hub !== String(result.hubId || '')) continue;
        try { recordsScanNotesAdd_(rows[j].hub, result); } catch (e2) { Logger.log('scan notes: ' + e2.message); }
        break;
      }
    }
  }
  return result;
}

function chektScanNotesSave_(payload) {
  payload = payload || {};
  var row = chektScanViewerRow_(payload.hub, payload.pass);
  if (!row.ok) return row;
  if (typeof recordsScanNotesMerge_ !== 'function') {
    return { ok: false, error: 'paste records.gs, save, and deploy a new version' };
  }
  return recordsScanNotesMerge_(row.hub, payload.notes || []);
}

// The row password. Used by the scan viewer. Not the review key.
function chektScanViewerRow_(hub, pass) {
  var supplied = String(pass || '');
  if (!supplied) return { ok: false, error: 'password required' };
  var enrolled = chektScanEnrolled_();
  if (!enrolled.ok) return enrolled;
  var id = String(hub || '').trim().toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(id)) return { ok: false, error: 'hub required' };
  var rows = enrolled.rows || [];
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    if (row.hub !== id && row.store !== id) continue;
    if (String(row.password || '') !== supplied) return { ok: false, error: 'bad password' };
    return { ok: true, name: row.name, hub: row.hub, store: row.store };
  }
  return { ok: false, error: 'that property is not enrolled' };
}

function chektScanFrameMeta_(jpegKey) {
  var key = String(jpegKey || '').replace(/\.jpg$/, '.json');
  if (!/^camera-scans\/[a-f0-9]{32}\/[0-9]+\/[0-9]{8}T[0-9]{9}Z\.json$/.test(key)) return null;
  var obj = recordsFetchJson_(key);
  if (!obj) return null;
  return {
    key: key,
    device_id: String(obj.device_id || ''),
    name: String(obj.name || ''),
    requested_at: String(obj.requested_at || ''),
    description: String(obj.description || ''),
    reviewed_at: String(obj.reviewed_at || ''),
    previous: String(obj.previous || '')
  };
}

// Newest frame per camera, plus every JPEG name in that camera folder when
// the script key can list camera-scans/. Does not take the script lock.
function chektScanList_(opts) {
  opts = opts || {};
  var auth = chektScanViewerRow_(opts.hub, opts.pass);
  if (!auth.ok) return auth;
  if (typeof recordsScanStateGet_ !== 'function' || typeof recordsFetchJson_ !== 'function') {
    return { ok: false, error: 'paste records.gs, save, and deploy a new version' };
  }
  var state = recordsScanStateGet_(auth.hub);
  var prevMap = (state && state.previous) || {};
  var device = String(opts.device || '').trim();
  var limit = Math.max(1, Math.min(40, parseInt(opts.limit, 10) || 24));
  var notable = String(opts.notable || '') === '1';
  if (!device) {
    var cameras = [];
    for (var id in prevMap) {
      if (!prevMap.hasOwnProperty(id)) continue;
      var latest = chektScanFrameMeta_(prevMap[id]);
      cameras.push({
        device_id: id,
        name: latest ? latest.name : id,
        latest: latest ? {
          key: latest.key,
          requested_at: latest.requested_at,
          description: latest.description,
          reviewed_at: latest.reviewed_at
        } : null
      });
    }
    cameras.sort(function (a, b) {
      return String(a.name).localeCompare(String(b.name));
    });
    var listed = true;
    var listError = '';
    if (typeof recordsS3ListPrefixes_ === 'function') {
      var prefixes = [];
      var slots = [];
      for (var c = 0; c < cameras.length; c++) {
        var dev = String(cameras[c].device_id || '');
        if (!/^[0-9]{1,16}$/.test(dev)) continue;
        prefixes.push('camera-scans/' + auth.store + '/' + dev + '/');
        slots.push(c);
      }
      try {
        var found = recordsS3ListPrefixes_(prefixes);
        for (var k = 0; k < slots.length; k++) cameras[slots[k]].keys = found[k] || [];
      } catch (e) {
        listed = false;
        listError = String(e.message || e);
      }
    } else {
      listed = false;
      listError = 'paste records.gs, save, and deploy a new version';
    }
    return {
      ok: true,
      name: auth.name,
      hub: auth.hub,
      store: auth.store,
      listed: listed,
      list_error: listError,
      cameras: cameras
    };
  }
  if (!/^[0-9]{1,16}$/.test(device)) return { ok: false, error: 'bad device' };
  var jpg = String(opts.start || '').trim();
  if (!jpg) jpg = String(prevMap[device] || '');
  jpg = jpg.replace(/\.json$/, '.jpg');
  var expect = 'camera-scans/' + auth.store + '/' + device + '/';
  if (jpg && jpg.indexOf(expect) !== 0) return { ok: false, error: 'frame is not this camera' };
  var frames = [];
  var walked = 0;
  var maxWalk = notable ? 80 : limit;
  while (jpg && frames.length < limit && walked < maxWalk) {
    walked++;
    var one = chektScanFrameMeta_(jpg);
    if (!one) break;
    if (one.key.indexOf(expect) !== 0) break;
    if (!notable || one.description) {
      frames.push({
        key: one.key,
        device_id: one.device_id,
        name: one.name,
        requested_at: one.requested_at,
        description: one.description,
        reviewed_at: one.reviewed_at
      });
    }
    jpg = one.previous || '';
  }
  return {
    ok: true,
    name: auth.name,
    hub: auth.hub,
    store: auth.store,
    device_id: device,
    frames: frames,
    older: jpg || ''
  };
}

function chektScanFrame_(opts) {
  opts = opts || {};
  var auth = chektScanViewerRow_(opts.hub, opts.pass);
  if (!auth.ok) return auth;
  if (typeof recordsS3GetBytes_ !== 'function') {
    return { ok: false, error: 'paste records.gs, save, and deploy a new version' };
  }
  var key = String(opts.key || '').trim().replace(/\.jpg$/, '.json');
  if (!/^camera-scans\/[a-f0-9]{32}\/[0-9]+\/[0-9]{8}T[0-9]{9}Z\.json$/.test(key)) {
    return { ok: false, error: 'bad key' };
  }
  var parts = key.split('/');
  if (parts[1] !== auth.store) return { ok: false, error: 'frame is not this property' };
  var meta = chektScanFrameMeta_(key);
  if (!meta) return { ok: false, error: 'frame is missing' };
  var bytes = recordsS3GetBytes_(key.replace(/\.json$/, '.jpg'));
  if (!bytes) return { ok: false, error: 'picture is missing' };
  return {
    ok: true,
    key: meta.key,
    name: meta.name,
    requested_at: meta.requested_at,
    description: meta.description,
    reviewed_at: meta.reviewed_at,
    jpeg_base64: Utilities.base64Encode(bytes)
  };
}

function chektProfileTracyRow_() {
  var enrolled = chektScanEnrolled_();
  if (!enrolled.ok) return enrolled;
  var want = (typeof RECORDS_PROFILE_HUB === 'string') ? RECORDS_PROFILE_HUB : 'd9f759d7351db3886c79dd689c41e3c0';
  var rows = enrolled.rows || [];
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].store === want || rows[i].hub === want) {
      return { ok: true, name: rows[i].name, hub: rows[i].hub, store: rows[i].store };
    }
  }
  return { ok: false, error: 'Tracy is not an enrolled scan row' };
}

// Review key. Camera names and sentences for Tracy. No pictures, no password.
function chektProfileSources_(opts) {
  opts = opts || {};
  if (!chektScanReviewKeyOk_(opts.review_key)) return { ok: false, error: 'bad or missing review key' };
  if (typeof recordsScanStateGet_ !== 'function' || typeof chektScanFrameMeta_ !== 'function') {
    return { ok: false, error: 'paste records.gs, save, and deploy a new version' };
  }
  var row = chektProfileTracyRow_();
  if (!row.ok) return row;
  var state = recordsScanStateGet_(row.hub);
  var prevMap = (state && state.previous) || {};
  var device = String(opts.device || '').trim();
  if (!device) {
    var cameras = [];
    for (var id in prevMap) {
      if (!prevMap.hasOwnProperty(id)) continue;
      var latest = chektScanFrameMeta_(prevMap[id]);
      cameras.push({
        device_id: id,
        name: latest ? latest.name : id,
        latest: latest ? {
          key: latest.key,
          requested_at: latest.requested_at,
          description: latest.description,
          reviewed_at: latest.reviewed_at
        } : null
      });
    }
    cameras.sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
    return { ok: true, route: 'property-profile-sources', name: row.name, hub: row.store, cameras: cameras };
  }
  if (!/^[0-9]{1,16}$/.test(device)) return { ok: false, error: 'bad device' };
  if (!prevMap[device]) return { ok: false, error: 'camera is not on Tracy\'s scan row' };
  var jpg = String(opts.start || prevMap[device] || '').replace(/\.json$/, '.jpg');
  var expect = 'camera-scans/' + row.store + '/' + device + '/';
  if (jpg.indexOf(expect) !== 0) return { ok: false, error: 'frame is not this camera' };
  var frames = [];
  var walked = 0;
  while (jpg && frames.length < 24 && walked < 24) {
    walked++;
    var one = chektScanFrameMeta_(jpg);
    if (!one || one.key.indexOf(expect) !== 0) break;
    frames.push({
      key: one.key,
      device_id: one.device_id,
      name: one.name,
      requested_at: one.requested_at,
      description: one.description,
      reviewed_at: one.reviewed_at
    });
    jpg = one.previous || '';
  }
  return {
    ok: true, route: 'property-profile-sources', hub: row.store, device_id: device,
    frames: frames, older: jpg || ''
  };
}

// One Tracy picture. Review key. The bot opens a frame, it does not get the folder.
function chektProfileFrame_(opts) {
  opts = opts || {};
  if (!chektScanReviewKeyOk_(opts.review_key)) return { ok: false, error: 'bad or missing review key' };
  if (typeof recordsS3GetBytes_ !== 'function' || typeof chektScanFrameMeta_ !== 'function') {
    return { ok: false, error: 'paste records.gs, save, and deploy a new version' };
  }
  var row = chektProfileTracyRow_();
  if (!row.ok) return row;
  var key = String(opts.key || '').trim().replace(/\.jpg$/, '.json');
  var expect = 'camera-scans/' + row.store + '/';
  if (key.indexOf(expect) !== 0) return { ok: false, error: 'frame is not Tracy\'s house' };
  if (!/^camera-scans\/[a-f0-9]{32}\/[0-9]+\/[0-9]{8}T[0-9]{9}Z\.json$/.test(key)) {
    return { ok: false, error: 'bad key' };
  }
  var meta = chektScanFrameMeta_(key);
  if (!meta) return { ok: false, error: 'frame is missing' };
  var bytes = recordsS3GetBytes_(key.replace(/\.json$/, '.jpg'));
  if (!bytes) return { ok: false, error: 'picture is missing' };
  return {
    ok: true,
    route: 'property-profile-frame',
    key: meta.key,
    name: meta.name,
    device_id: meta.device_id,
    requested_at: meta.requested_at,
    description: meta.description,
    reviewed_at: meta.reviewed_at,
    jpeg_base64: Utilities.base64Encode(bytes)
  };
}

function chektPatrolZone_() {
  try {
    var tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
    return tz || 'America/Chicago';
  } catch (e) {
    return 'America/Chicago';
  }
}

function chektPatrolMark_(now, tz) {
  var hm = Utilities.formatDate(now, tz, 'HH:mm');
  var parts = hm.split(':');
  var minute = Number(parts[1]) - (Number(parts[1]) % 5);
  var label = parts[0] + ':' + (minute < 10 ? '0' : '') + minute;
  return { at: Utilities.formatDate(now, tz, 'yyyy-MM-dd') + 'T' + label, hm: label };
}

function chektPatrolDue_(patrol, hm) {
  var due = [];
  var times = (patrol && patrol.times) || {};
  Object.keys(times).forEach(function (id) {
    var list = times[id] || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i] === hm) { due.push(id); break; }
    }
  });
  return due;
}

function chektPatrolKey_(hub) {
  var id = String(hub || '').trim().toLowerCase();
  if (!/^[a-f0-9]{32}$/.test(id)) throw new Error('patrol hub must be 32 hex');
  return 'camera-scan-patrol/' + id + '.json';
}

function chektPatrolRates_() {
  return { bronze: 12, silver: 24, gold: 48, platinum: 96 };
}

function chektPatrolNormalize_(obj) {
  obj = obj || {};
  var rates = chektPatrolRates_();
  var qa = String(obj.qa || '').trim().toLowerCase();
  var times = {};
  var src = (obj.times && typeof obj.times === 'object') ? obj.times : {};
  var ids = Object.keys(src);
  var i, j, id, list, seen, kept, s;
  for (i = 0; i < ids.length; i++) {
    id = ids[i];
    if (!/^[0-9]{1,16}$/.test(id)) continue;
    list = Array.isArray(src[id]) ? src[id] : [];
    seen = {};
    kept = [];
    for (j = 0; j < list.length; j++) {
      s = String(list[j] || '').trim();
      if (!/^([01][0-9]|2[0-3]):[0-5][05]$/.test(s)) continue;
      if (seen[s]) continue;
      seen[s] = true;
      kept.push(s);
    }
    kept.sort();
    if (kept.length) times[id] = kept;
  }
  return {
    schema: 'property-intel-records/camera-scan-patrol-v1',
    hub: String(obj.hub || '').trim().toLowerCase(),
    qa: rates[qa] ? qa : '',
    times: times
  };
}

function chektPatrolRead_(hub) {
  if (typeof recordsFetchJson_ !== 'function') return null;
  try {
    var obj = recordsFetchJson_(chektPatrolKey_(hub));
    if (!obj) return null;
    return chektPatrolNormalize_(obj);
  }
  catch (e) {
    Logger.log('camera scan patrol read failed: ' + e.message);
    return null;
  }
}

function chektPatrolWrite_(hub, qa, times, cameraIds) {
  var id = String(hub || '').trim().toLowerCase();
  var level = String(qa || '').trim().toLowerCase();
  var rate = chektPatrolRates_()[level];
  if (!rate) return { ok: false, error: 'qa must be bronze, silver, gold, or platinum' };
  var known = {};
  var devices = cameraIds || [];
  var i, j, d, names, placed, pool, unknown, checked, obj, put;
  for (i = 0; i < devices.length; i++) {
    d = String(devices[i] || '');
    if (/^[0-9]{1,16}$/.test(d)) known[d] = true;
  }
  if (!Object.keys(known).length) return { ok: false, error: 'no cameras on this row yet' };
  var src = (times && typeof times === 'object') ? times : {};
  names = Object.keys(src);
  checked = {};
  placed = 0;
  for (i = 0; i < names.length; i++) {
    if (!/^[0-9]{1,16}$/.test(names[i])) return { ok: false, error: 'bad camera id' };
    if (!known[names[i]]) return { ok: false, error: 'unknown camera ' + names[i] };
    if (!Array.isArray(src[names[i]])) return { ok: false, error: 'times must be a list' };
    var seen = {};
    var out = [];
    for (j = 0; j < src[names[i]].length; j++) {
      var s = String(src[names[i]][j] || '').trim();
      if (!/^([01][0-9]|2[0-3]):[0-5][05]$/.test(s)) {
        return { ok: false, error: 'time must be HH:mm on a 5-minute mark' };
      }
      if (seen[s]) return { ok: false, error: 'duplicate time ' + s };
      seen[s] = true;
      out.push(s);
    }
    out.sort();
    if (out.length) checked[names[i]] = out;
    placed += out.length;
  }
  pool = rate * Object.keys(known).length;
  if (placed > pool) return { ok: false, error: placed + ' reviews placed. This level allows ' + pool + '.' };
  unknown = '';
  obj = {
    schema: 'property-intel-records/camera-scan-patrol-v1',
    hub: id,
    qa: level,
    times: checked
  };
  put = recordsPutJson_(chektPatrolKey_(id), obj);
  return {
    ok: true, route: 'scan-patrol', hub: id, qa: level,
    pool: pool, placed: placed, rate: rate, cameras: Object.keys(known).length, etag: put.etag
  };
}

function chektScanCameras_(hub) {
  var state = recordsScanStateGet_(hub) || {};
  return Object.keys(state.previous || {}).filter(function (id) {
    return /^[0-9]{1,16}$/.test(id);
  });
}

function chektScanPatrol_(opts) {
  opts = opts || {};
  var row = chektScanViewerRow_(opts.hub, opts.pass);
  if (!row.ok) return row;
  var cameras = chektScanCameras_(row.hub);
  var patrol = chektPatrolRead_(row.hub);
  var saved = !!(patrol && patrol.qa);
  var qa = saved ? patrol.qa : '';
  var rate = saved ? (chektPatrolRates_()[qa] || 0) : 0;
  var times = saved ? patrol.times : {};
  var placed = 0;
  Object.keys(times).forEach(function (id) { placed += (times[id] || []).length; });
  return {
    ok: true, route: 'scan-patrol', hub: row.hub, name: row.name,
    saved: saved, qa: qa, times: times,
    cameras: cameras.length, rate: rate, pool: rate * cameras.length, placed: placed,
    zone: chektPatrolZone_()
  };
}

// Jones visits the live bot saved. The row password reads them. The station key stays off this route.
function chektPatrolClips_(opts) {
  opts = opts || {};
  var row = chektScanViewerRow_(opts.hub, opts.pass);
  if (!row.ok) return row;
  if (row.hub !== '6de88883bfd4a8349a901c54611ed9d7') {
    return { ok: false, error: 'patrol clips are Tracy\'s house only' };
  }
  if (typeof recordsLiveClipsRead_ !== 'function') {
    return { ok: false, error: 'recordsLiveClipsRead_ is not defined — paste records.gs, save, and deploy a new version' };
  }
  var got = recordsLiveClipsRead_(row.store || 'd9f759d7351db3886c79dd689c41e3c0');
  if (!got.ok) return got;
  var cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  var clips = (got.clips || []).filter(function (clip) {
    var at = Date.parse(clip.started_at || '');
    return at && at >= cutoff;
  });
  return {
    ok: true,
    route: 'patrol-clips',
    list: !!got.list,
    clips: clips,
    error: got.error || ''
  };
}

function chektScanPatrolSave_(payload) {
  payload = payload || {};
  var row = chektScanViewerRow_(payload.hub, payload.pass);
  if (!row.ok) return row;
  var cameras = chektScanCameras_(row.hub);
  if (!cameras.length) return { ok: false, error: 'no cameras on this row yet' };
  var put = chektPatrolWrite_(row.hub, payload.qa, payload.times, cameras);
  if (!put.ok) return put;
  put.name = row.name;
  put.saved = true;
  put.zone = chektPatrolZone_();
  return put;
}

function chektScanPass_(row, state, only) {
  var got = chektScanFetch_(row.hub, row.password, only);
  if (!got.ok) return got;
  var saved = 0;
  var failed = 0;
  for (var i = 0; i < got.frames.length; i++) {
    var frame = got.frames[i];
    var device = String(frame.device_id);
    var previous = (state.previous && state.previous[device]) || '';
    try {
      var put = chektScanStore_(row, frame, previous);
      state.previous[device] = put.jpeg;
      if (previous && state.queue.indexOf(put.json) === -1) state.queue.push(put.json);
      saved++;
    } catch (e) {
      failed++;
      Logger.log('camera scan put ' + row.name + ' ' + frame.device_id + ' ' + e.message);
    }
  }
  return {
    ok: failed === 0,
    saved: saved,
    missed: (got.missed || []).length,
    failed: failed,
    error: failed ? (failed + ' put(s) failed') : ''
  };
}

// One wake. Runs a checked row only when the current clock mark is due.
function chektScanTick() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) {
    Logger.log('camera scan: another run holds the lock');
    return;
  }
  try {
    var enrolled = chektScanEnrolled_();
    if (!enrolled.ok) {
      Logger.log('camera scan: ' + enrolled.error);
      return;
    }
    var now = new Date();
    var zone = chektPatrolZone_();
    var rows = enrolled.rows || [];
    var started = Date.now();
    for (var r = 0; r < rows.length; r++) {
      if (Date.now() - started > 4.5 * 60 * 1000) {
        Logger.log('camera scan: stopping at 4.5 min, remaining rows wait for the next wake');
        break;
      }
      var row = rows[r];
      if (!row.password) {
        Logger.log('camera scan skip ' + row.name + ' empty password');
        continue;
      }
      var patrol = chektPatrolRead_(row.hub);
      if (patrol && patrol.qa) {
        var stateP = chektScanStateLoad_(row);
        var mark = chektPatrolMark_(now, zone);
        if (stateP.patrolAt && String(stateP.patrolAt) >= mark.at) continue;
        var due = chektPatrolDue_(patrol, mark.hm);
        if (!due.length) continue;
        var passP = chektScanPass_(row, stateP, due);
        if (!passP.ok && !passP.saved) {
          recordsScanStatePut_(row.hub, stateP);
          Logger.log('camera scan patrol ' + row.name + ' ' + mark.hm + ' not stored (' + (passP.error || 'failed') + ')');
          continue;
        }
        stateP.patrolAt = mark.at;
        recordsScanStatePut_(row.hub, stateP);
        Logger.log('camera scan patrol ' + row.name + ' ' + mark.hm +
          ' saved ' + passP.saved + ' missed ' + passP.missed + ' failed ' + passP.failed);
        continue;
      }
      if (!chektScanMarkOk_(row.minutes)) {
        Logger.log('camera scan skip ' + row.name + ' hours ' + row.hours + ' (use .25, .5, or a whole number of hours)');
        continue;
      }
      var state = chektScanStateLoad_(row);
      var seenMs;
      if (!state.seen || String(state.minutes) !== String(row.minutes)) {
        seenMs = now.getTime() - (now.getTime() % 60000);
        state.seen = seenMs;
        state.minutes = row.minutes;
        state.slot = 0;
        recordsScanStatePut_(row.hub, state);
      } else {
        seenMs = Number(state.seen);
      }
      var slot = chektScanSlot_(row.minutes, now);
      if (slot.getTime() < seenMs) continue;
      if (state.slot && Number(state.slot) >= slot.getTime()) continue;
      var pass = chektScanPass_(row, state);
      if (!pass.ok && !pass.saved) {
        recordsScanStatePut_(row.hub, state);
        Logger.log('camera scan ' + row.name + ' not stored (' + (pass.error || 'failed') + '). This clock mark will be tried again.');
        continue;
      }
      state.slot = slot.getTime();
      recordsScanStatePut_(row.hub, state);
      Logger.log('camera scan ' + row.name + ' slot ' + slot.toISOString() +
        ' saved ' + pass.saved + ' missed ' + pass.missed + ' failed ' + pass.failed);
    }
  } catch (e) {
    Logger.log('camera scan ERROR: ' + e.message);
  } finally {
    lock.releaseLock();
  }
}

function chektClearScanTrigger_() {
  var removed = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === CHEKT_SCAN_TRIGGER) { ScriptApp.deleteTrigger(t); removed++; }
  });
  return removed;
}

function startChektScanTrigger() {
  var ui = SpreadsheetApp.getUi();
  var removed = chektClearScanTrigger_();
  ScriptApp.newTrigger(CHEKT_SCAN_TRIGGER).timeBased().everyMinutes(5).create();
  ui.alert('Camera scans',
    'The clock is on. Every 5 minutes the sheet is read. Scan hours is the cadence: ' +
    '.25 is :00 :15 :30 :45, .5 is :00 and :30, and a whole number is that many hours on the hour. ' +
    'Checking Scan and entering the hours is what enrolls the row. The first frames wait for the next mark.' +
    (removed ? '\n\n(Replaced ' + removed + ' existing trigger.)' : '') +
    '\n\nUse Stop camera scans to turn the clock off.',
    ui.ButtonSet.OK);
}

var CHEKT_LOG_TRIGGER = 'chektLogTick';

function chektLogTracyRow_() {
  var enrolled = chektScanEnrolled_();
  if (!enrolled.ok) return enrolled;
  var want = (typeof RECORDS_PROFILE_HUB === 'string') ? RECORDS_PROFILE_HUB : 'd9f759d7351db3886c79dd689c41e3c0';
  var rows = enrolled.rows || [];
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].store === want || rows[i].hub === want) return { ok: true, row: rows[i] };
  }
  return { ok: false, error: 'Tracy is not an enrolled scan row' };
}

function chektLogFetch_(hub, password) {
  var url = CHEKT_GW_URL + '/log?property=' + encodeURIComponent(hub);
  var res = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { 'x-viewer-key': password },
    muteHttpExceptions: true
  });
  var code = res.getResponseCode();
  if (code === 429) return { ok: false, error: 'gateway 429' };
  if (code === 401) return { ok: false, error: 'gateway 401' };
  if (code === 404) return { ok: false, error: 'gateway has no /log route' };
  if (code !== 200) return { ok: false, error: 'gateway HTTP ' + code };
  var body;
  try { body = JSON.parse(res.getContentText() || '{}'); }
  catch (e) { return { ok: false, error: 'gateway 200 was not JSON' }; }
  return { ok: true, rows: body.rows || [], truncated: !!body.truncated };
}

function chektLogSeen_() {
  var raw = PropertiesService.getScriptProperties().getProperty('CHEKT_LOG_SEEN') || '[]';
  try {
    var list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

// Every minute the trigger wakes. The read itself runs only after two minutes.
// The first successful read is a baseline and does not ping.
function chektLogTick() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    var props = PropertiesService.getScriptProperties();
    var last = Number(props.getProperty('CHEKT_LOG_AT') || '0');
    if (Date.now() - last < 110000) return;
    var found = chektLogTracyRow_();
    if (!found.ok) {
      Logger.log('chekt log: ' + found.error);
      return;
    }
    var row = found.row;
    if (!row.password) {
      Logger.log('chekt log skip ' + row.name + ' empty password');
      return;
    }
    var got = chektLogFetch_(row.hub, row.password);
    props.setProperty('CHEKT_LOG_AT', String(Date.now()));
    if (!got.ok) {
      Logger.log('chekt log: ' + got.error);
      return;
    }
    var seenList = chektLogSeen_();
    var seen = {};
    for (var s = 0; s < seenList.length; s++) seen[String(seenList[s])] = 1;
    var fresh = [];
    var rows = got.rows || [];
    for (var i = 0; i < rows.length; i++) {
      var item = rows[i] || {};
      var id = String(item.id || '');
      if (!id || seen[id]) continue;
      seen[id] = 1;
      fresh.push(item);
    }
    var keep = Object.keys(seen);
    if (keep.length > 80) keep = keep.slice(keep.length - 80);
    props.setProperty('CHEKT_LOG_SEEN', JSON.stringify(keep));
    if (props.getProperty('CHEKT_LOG_BASELINE') !== '1') {
      props.setProperty('CHEKT_LOG_BASELINE', '1');
      Logger.log('chekt log baseline ' + keep.length + ' rows');
      return;
    }
    if (!fresh.length) return;
    fresh.sort(function (a, b) {
      return String(a.event_time || '') < String(b.event_time || '') ? -1 : 1;
    });
    var newest = fresh[fresh.length - 1];
    var camera = String(newest.camera || 'CHEKT').replace(/[\r\n]/g, ' ').trim() || 'CHEKT';
    var kind = newest.kind === 'alarm' ? 'alarm' : 'video event';
    var sentence = ('CHEKT ' + kind + ' on ' + camera + '.').slice(0, 280);
    var at = String(newest.event_time || '');
    if (!Date.parse(at)) at = new Date().toISOString();
    var reviewKey = String(props.getProperty('SCAN_REVIEW_KEY') || '').trim();
    var ping = recordsPatrolPing_({
      review_key: reviewKey,
      hub: (typeof RECORDS_PROFILE_HUB === 'string') ? RECORDS_PROFILE_HUB : 'd9f759d7351db3886c79dd689c41e3c0',
      source: 'log',
      device_id: String(newest.device_id || ''),
      camera: camera,
      sentence: sentence,
      at: at,
      log_id: String(newest.id || '')
    });
    Logger.log('chekt log ping ' + (ping.ok ? ping.id : ping.error) + ' fresh ' + fresh.length);
  } catch (e) {
    Logger.log('chekt log ERROR: ' + e.message);
  } finally {
    lock.releaseLock();
  }
}

function chektClearLogTrigger_() {
  var removed = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === CHEKT_LOG_TRIGGER) { ScriptApp.deleteTrigger(t); removed++; }
  });
  return removed;
}

function startChektLogTrigger() {
  var ui = SpreadsheetApp.getUi();
  var removed = chektClearLogTrigger_();
  ScriptApp.newTrigger(CHEKT_LOG_TRIGGER).timeBased().everyMinutes(1).create();
  ui.alert('CHEKT log',
    'The log clock is on. It wakes every minute and reads Tracy\'s alarms and video rows every two minutes. ' +
    'The first read only remembers what is already there. A later new row pings the live bot. It does not fetch clip video.' +
    (removed ? '\n\n(Replaced ' + removed + ' existing trigger.)' : '') +
    '\n\nUse Stop CHEKT log to turn the clock off.',
    ui.ButtonSet.OK);
}

function stopChektLogTrigger() {
  var ui = SpreadsheetApp.getUi();
  var removed = chektClearLogTrigger_();
  ui.alert('CHEKT log',
    removed ? 'Stopped. Removed ' + removed + ' trigger(s).' : 'No CHEKT log trigger was running.',
    ui.ButtonSet.OK);
}

function stopChektScanTrigger() {
  var ui = SpreadsheetApp.getUi();
  var removed = chektClearScanTrigger_();
  ui.alert('Camera scans',
    removed ? 'Stopped. Removed ' + removed + ' trigger(s). Checked rows stay checked and will not run.' : 'No camera-scan trigger was running.',
    ui.ButtonSet.OK);
}

function checkChektScanStatus() {
  var ui = SpreadsheetApp.getUi();
  var running = ScriptApp.getProjectTriggers().some(function (t) {
    return t.getHandlerFunction() === CHEKT_SCAN_TRIGGER;
  });
  var roster = chektScanRoster_();
  var lines = ['Clock: ' + (running ? 'ON (wakes every 5 minutes)' : 'OFF')];
  if (!roster.ok) {
    lines.push(roster.error);
  } else if (!(roster.rows || []).length) {
    lines.push('No rows checked.');
  } else {
    var now = new Date();
    roster.rows.forEach(function (row) {
      var mark = chektScanMarkOk_(row.minutes) ? (row.hours + ' h') : (row.hours + ' h is not a clock mark');
      var st = (typeof recordsScanStateGet_ === 'function') ? recordsScanStateGet_(row.hub) : null;
      var last = st && st.slot;
      var lastTxt = last ? new Date(Number(last)).toISOString() : 'not yet';
      var slot = chektScanMarkOk_(row.minutes) ? chektScanSlot_(row.minutes, now).toISOString() : '';
      lines.push(row.name + ' — ' + mark + ' — last ' + lastTxt + (slot ? ' — current mark ' + slot : ''));
    });
  }
  ui.alert('Camera scans', lines.join('\n'), ui.ButtonSet.OK);
}

function chektViewerLink_(hubId) {
  var hub = String(hubId || '').trim().toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(hub)) return '';
  return CHEKT_VIEWER_PAGE + '?property=' + hub + '&live=1';
}

function chektWriteViewerLinks_(sheet) {
  var last = sheet.getLastRow();
  if (last < 2) return 0;
  var hubs = sheet.getRange(2, CHEKT_COL_HUB, last - 1, 1).getValues();
  var links = [];
  var n = 0;
  hubs.forEach(function (r) {
    var link = chektViewerLink_(r[0]);
    if (link) n++;
    links.push([link]);
  });
  sheet.getRange(2, CHEKT_COL_LINK, links.length, 1).setValues(links);
  return n;
}

function fillChektSiteIds() {
  var ui = SpreadsheetApp.getUi();
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CHEKT_ACCOUNTS_SHEET);
  if (!sheet || sheet.getLastRow() < 2) {
    ui.alert('CHEKT Accounts', 'Paste account name, address, and CS# on the Chekt tab first.', ui.ButtonSet.OK);
    return;
  }
  var catalog;
  try {
    catalog = chektFetchCatalog_();
  } catch (e) {
    ui.alert('CHEKT Accounts', 'Could not read the CHEKT site list.\n\n' + e.message, ui.ButtonSet.OK);
    return;
  }
  var last = sheet.getLastRow();
  var vals = sheet.getRange(2, 1, last - 1, CHEKT_HEADERS.length).getValues();
  var filled = 0;
  var already = 0;
  var missed = 0;
  var csFilled = 0;
  for (var i = 0; i < vals.length; i++) {
    var name = String(vals[i][CHEKT_COL_NAME - 1] || '').trim();
    var address = String(vals[i][CHEKT_COL_ADDRESS - 1] || '').trim();
    var cs = String(vals[i][CHEKT_COL_CS - 1] || '').trim();
    if (!name && !address && !cs) continue;
    var rowNum = i + 2;
    var found = chektMatchCatalog_({ name: name, address: address, cs: cs }, catalog);
    if (!found.sites.length) {
      sheet.getRange(rowNum, CHEKT_COL_MATCH).setValue(found.note);
      missed++;
      continue;
    }
    // The catalog carries the CS# (account_reference_id). A row matched by
    // address or name had none; write it when every matched site agrees,
    // because Match and the Satellite seed both key on this number.
    if (!cs) {
      var refs = {};
      found.sites.forEach(function (s) {
        var raw = String(s.account_reference_id || '').trim();
        if (chektDigits_(raw)) refs[chektDigits_(raw)] = raw;
      });
      var refKeys = Object.keys(refs);
      if (refKeys.length === 1) {
        sheet.getRange(rowNum, CHEKT_COL_CS).setValue(refs[refKeys[0]]);
        vals[i][CHEKT_COL_CS - 1] = refs[refKeys[0]];
        csFilled++;
      }
    }
    var ids = found.sites.map(function (s) { return String(s.site_id); });
    var names = found.sites.map(function (s) { return String(s.site_name || '').trim(); }).filter(function (n) { return n; });
    var existingIds = chektSplitIds_(vals[i][CHEKT_COL_SITES - 1]);
    var merged = existingIds.slice();
    ids.forEach(function (id) {
      if (merged.indexOf(id) === -1) merged.push(id);
    });
    if (merged.join(', ') !== existingIds.join(', ')) {
      sheet.getRange(rowNum, CHEKT_COL_SITES).setValue(merged.join(', '));
      filled++;
    } else {
      already++;
    }
    if (names.length) sheet.getRange(rowNum, CHEKT_COL_CHEKT_NAME).setValue(names.join(', '));
    sheet.getRange(rowNum, CHEKT_COL_MATCH).setValue(found.note);
  }
  ui.alert('CHEKT Accounts',
    'CHEKT has ' + catalog.length + ' sites.\n\n' +
    filled + ' row(s) got site ids.\n' +
    already + ' row(s) already had site ids; the CHEKT site name was still written.\n' +
    csFilled + ' row(s) got a CS# from the catalog.\n' +
    missed + ' row(s) did not match.\n\n' +
    'Match order is CS#, then address, then account name. One property can have several CHEKT site ids, one per panel. They stay in the same cell, separated by commas. The CHEKT site name is often not the account name on this sheet.',
    ui.ButtonSet.OK);
}

function chektFetchCatalog_() {
  var key = PropertiesService.getScriptProperties().getProperty('CHEKT_SYNC_KEY');
  if (!key || !String(key).trim()) throw new Error('Script Property CHEKT_SYNC_KEY is empty. Set it to the Lambda viewer password.');
  var res = UrlFetchApp.fetch(CHEKT_GW_URL + '/catalog', {
    method: 'get',
    headers: { 'x-viewer-key': String(key).trim() },
    muteHttpExceptions: true
  });
  var code = res.getResponseCode();
  if (code === 401) throw new Error('CHEKT catalog rejected CHEKT_SYNC_KEY (HTTP 401).');
  if (code !== 200) throw new Error('CHEKT catalog HTTP ' + code);
  var body = JSON.parse(res.getContentText());
  var sites = (body && body.sites) || [];
  if (!sites.length) throw new Error('CHEKT catalog returned no sites.');
  return sites;
}

function chektDigits_(value) {
  return String(value || '').replace(/\D/g, '');
}

function chektMatchCatalog_(row, catalog) {
  var cs = chektDigits_(row.cs);
  if (cs) {
    var byCs = catalog.filter(function (s) { return chektDigits_(s.account_reference_id) === cs; });
    if (byCs.length) return { sites: byCs, note: 'CHEKT matched CS# (' + byCs.length + ' site' + (byCs.length === 1 ? '' : 's') + ')' };
  }
  var addr = chektNormalizeAddress_(row.address);
  if (addr) {
    var byAddr = catalog.filter(function (s) { return chektNormalizeAddress_(s.address) === addr; });
    if (!byAddr.length) byAddr = chektAddressLoose_(row.address, catalog);
    if (byAddr.length) return { sites: byAddr, note: 'CHEKT matched address (' + byAddr.length + ' site' + (byAddr.length === 1 ? '' : 's') + ')' };
  }
  var byName = chektNameHits_(row.name, catalog);
  if (byName.length === 1) return { sites: byName, note: 'CHEKT matched account name' };
  if (byName.length > 1) {
    var sameAddr = chektSameAddress_(byName);
    if (sameAddr) return { sites: byName, note: 'CHEKT matched account name (' + byName.length + ' sites, one address)' };
    return { sites: [], note: 'Account name matches ' + byName.length + ' CHEKT sites — not filled' };
  }
  return { sites: [], note: 'No CHEKT site for this CS#, address, or account name' };
}

function chektAddressLoose_(address, catalog) {
  var parts = chektAddrParts_(address);
  if (!parts.num) return [];
  return catalog.filter(function (s) {
    var other = chektAddrParts_(s.address);
    if (other.num !== parts.num) return false;
    if (parts.zip && other.zip && parts.zip !== other.zip) return false;
    return true;
  });
}

function chektAddrParts_(address) {
  var words = chektNormalizeAddress_(address).split(' ');
  var num = '';
  var zip = '';
  words.forEach(function (w) {
    if (!num && /^\d+$/.test(w) && w.length < 6) num = w;
    if (/^\d{5}$/.test(w)) zip = w;
  });
  return { num: num, zip: zip };
}

function chektNameTokens_(value) {
  var drop = { llc: 1, inc: 1, incorporated: 1, company: 1, residence: 1, the: 1 };
  return String(value || '').toLowerCase().split(/[^a-z0-9]+/).filter(function (w) {
    return w.length >= 4 && !drop[w];
  });
}

function chektNameHits_(name, catalog) {
  var tokens = chektNameTokens_(name);
  if (!tokens.length) return [];
  return catalog.filter(function (s) {
    var theirs = chektNameTokens_(s.site_name);
    return tokens.some(function (t) { return theirs.indexOf(t) !== -1; });
  });
}

function chektSameAddress_(sites) {
  var keys = {};
  sites.forEach(function (s) {
    var key = chektNormalizeAddress_(s.address);
    if (key) keys[key] = true;
  });
  return Object.keys(keys).length === 1;
}

function matchChektAccountsToIndex() {
  var ui = SpreadsheetApp.getUi();
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CHEKT_ACCOUNTS_SHEET);
  if (!sheet || sheet.getLastRow() < 2) {
    ui.alert('CHEKT Accounts', 'Run Set Up CHEKT Accounts Sheet and add rows first.', ui.ButtonSet.OK);
    return;
  }
  var entries;
  var satRows;
  var csByHub;
  try {
    entries = chektLoadIndexEntries_();
    satRows = chektLoadSatelliteRows_();
    csByHub = chektCsByHub_();
    var recordsIds = chektListRecordsHubs_();
  } catch (e) {
    ui.alert('CHEKT Accounts', 'Could not read the index.\n\n' + e.message, ui.ButtonSet.OK);
    return;
  }
  var last = sheet.getLastRow();
  var vals = sheet.getRange(2, 1, last - 1, CHEKT_HEADERS.length).getValues();
  var matched = 0;
  var viaSite = 0;
  var viaCs = 0;
  var viaAddr = 0;
  var viaName = 0;
  var viaRecords = 0;
  var skipped = 0;
  var ambiguous = 0;
  var noCs = 0;
  var cleared = 0;
  var indexIds = {};
  var satIndex = chektSatelliteIndex_(satRows);
  entries.forEach(function (e) { indexIds[e.id] = true; });
  for (var i = 0; i < vals.length; i++) {
    var address = String(vals[i][CHEKT_COL_ADDRESS - 1] || '').trim();
    var accountName = String(vals[i][CHEKT_COL_NAME - 1] || '').trim();
    var rowSites = chektSplitIds_(vals[i][CHEKT_COL_SITES - 1]);
    var rowCs = String(vals[i][CHEKT_COL_CS - 1] || '').trim();
    if (!address && !accountName && !rowCs && !rowSites.length) continue;
    var rowNum = i + 2;
    var hubCell = String(vals[i][CHEKT_COL_HUB - 1] || '').trim().toLowerCase();
    if (hubCell && !indexIds[hubCell] && !recordsIds[hubCell]) {
      sheet.getRange(rowNum, CHEKT_COL_HUB).setValue('');
      var priorNote = String(vals[i][CHEKT_COL_MATCH - 1] || '');
      if (priorNote.indexOf(' via ') !== -1) {
        sheet.getRange(rowNum, CHEKT_COL_PASSWORD).setValue('');
        vals[i][CHEKT_COL_PASSWORD - 1] = '';
      }
      hubCell = '';
      cleared++;
    }
    var resolved = chektResolveHub_({ address: address, name: accountName, cs: rowCs, sites: rowSites }, entries);
    var hit = resolved.hit;
    var recordsMiss = '';
    if (!hit && !resolved.ambiguous.length) {
      var satResolved = chektResolveFromIndex_({ address: address, name: accountName, cs: rowCs }, satIndex);
      if (satResolved.hit && !indexIds[satResolved.hit.id]) {
        if (recordsIds[satResolved.hit.id]) {
          hit = satResolved.hit;
          resolved = { hit: hit, via: 'records index', siblings: satResolved.siblings, ambiguous: [] };
        } else {
          recordsMiss = satResolved.hit.name || satResolved.hit.id;
        }
      }
    }
    if (hit && !hubCell) {
      hubCell = hit.id;
      sheet.getRange(rowNum, CHEKT_COL_HUB).setValue(hit.id);
      var aliasCell = String(vals[i][CHEKT_COL_ALIASES - 1] || '').trim();
      var aliases = chektAliasIds_(hit, resolved.siblings);
      if (!aliasCell && aliases.length) {
        sheet.getRange(rowNum, CHEKT_COL_ALIASES).setValue(aliases.join(', '));
      }
      if (resolved.via === 'CHEKT site id') viaSite++;
      else if (resolved.via === 'CS#') viaCs++;
      else if (resolved.via === 'account name') viaName++;
      else if (resolved.via === 'records index') viaRecords++;
      else viaAddr++;
    }
    if (!hubCell) {
      var missNote = recordsMiss
        ? ('Satellite row "' + recordsMiss + '" has no records index')
        : (resolved.ambiguous.length ? chektAmbiguousNote_(resolved.ambiguous) : 'No indexed property');
      sheet.getRange(rowNum, CHEKT_COL_MATCH).setValue(missNote);
      if (resolved.ambiguous.length) ambiguous++;
      else skipped++;
      continue;
    }
    var cs = rowCs;
    if (!cs && hit) cs = String(hit.site_no || '').trim();
    if (!cs && csByHub[hubCell]) cs = csByHub[hubCell];
    if (cs && !rowCs) sheet.getRange(rowNum, CHEKT_COL_CS).setValue(cs);
    var name = String((hit && hit.name) || accountName || '').trim();
    var password = String(vals[i][CHEKT_COL_PASSWORD - 1] || '').trim();
    var generated = chektPasswordFromCs_(name, cs);
    var via = hit ? resolved.via : 'existing hub';
    if (!password && generated) {
      sheet.getRange(rowNum, CHEKT_COL_PASSWORD).setValue(generated);
      sheet.getRange(rowNum, CHEKT_COL_MATCH).setValue('Hub ' + hubCell + ' via ' + via);
      matched++;
    } else if (!password) {
      sheet.getRange(rowNum, CHEKT_COL_MATCH).setValue('Hub ' + hubCell + ' — need a site name and a CS# with 4 digits');
      noCs++;
    } else {
      sheet.getRange(rowNum, CHEKT_COL_MATCH).setValue('Hub ' + hubCell + ' via ' + via + ' — password left as typed');
      matched++;
    }
    sheet.getRange(rowNum, CHEKT_COL_LINK).setValue(chektViewerLink_(hubCell));
  }
  ui.alert('CHEKT Accounts',
    'Looked up ' + entries.length + ' index files and ' + Object.keys(recordsIds).length + ' records indexes.\n' +
    cleared + ' hub id(s) cleared because that id is not an index file or a records index.\n\n' +
    matched + ' row(s) matched.\n' +
    viaSite + ' new hub id(s) came from a CHEKT site id already on the index.\n' +
    viaCs + ' new hub id(s) came from the CS#.\n' +
    viaAddr + ' new hub id(s) came from the address.\n' +
    viaName + ' new hub id(s) came from the account name.\n' +
    viaRecords + ' new hub id(s) came from a records index synced from Satellite.\n' +
    skipped + ' row(s) had no indexed property.\n' +
    ambiguous + ' row(s) matched more than one index and were left blank.\n' +
    noCs + ' matched row(s) still need a CS# with at least 4 digits.\n\n' +
    'A CHEKT site id on the row joins the index that already lists that id, even when the address text differs. When several files list it, the customer hub is kept and the other id is written under Also accepts property ids. Password is the first letter of the site name plus the last 4 digits of the CS#. An existing password is not replaced.',
    ui.ButtonSet.OK);
}

function chektResolveHub_(row, entries) {
  var siteIds = row.sites || [];
  if (siteIds.length) {
    var bySite = entries.filter(function (e) {
      return siteIds.some(function (id) { return e.sites.indexOf(id) !== -1; });
    });
    if (bySite.length) {
      var sitePick = chektPickHub_(bySite);
      if (sitePick) return { hit: sitePick, via: 'CHEKT site id', siblings: bySite, ambiguous: [] };
      return { hit: null, via: '', siblings: [], ambiguous: bySite };
    }
  }
  var cs = chektDigits_(row.cs);
  if (cs) {
    var byCs = entries.filter(function (e) { return chektDigits_(e.site_no) === cs; });
    if (byCs.length) {
      var pool = byCs;
      if (byCs.length === 1 && byCs[0].address) {
        var same = entries.filter(function (e) { return e.address === byCs[0].address; });
        if (same.length) pool = same;
      }
      var csPick = chektPickHub_(pool);
      if (csPick) return { hit: csPick, via: 'CS#', siblings: pool, ambiguous: [] };
      return { hit: null, via: '', siblings: [], ambiguous: pool };
    }
  }
  var key = chektNormalizeAddress_(row.address);
  if (key) {
    var byAddr = entries.filter(function (e) { return e.address === key; });
    if (byAddr.length) {
      var addrPick = chektPickHub_(byAddr);
      if (addrPick) return { hit: addrPick, via: 'address', siblings: byAddr, ambiguous: [] };
      return { hit: null, via: '', siblings: [], ambiguous: byAddr };
    }
    var canon = chektCanonAddress_(row.address);
    if (canon) {
      var byCanon = entries.filter(function (e) {
        return e.canon === canon || e.satCanon === canon;
      });
      if (byCanon.length) {
        var canonNarrow = chektNarrowHits_(byCanon, row);
        if (canonNarrow.hit) return { hit: canonNarrow.hit, via: canonNarrow.via, siblings: byCanon, ambiguous: [] };
        return { hit: null, via: '', siblings: [], ambiguous: byCanon };
      }
    }
    var nameKey = chektNameKey_(row.name);
    if (chektNameKeyUsable_(nameKey)) {
      var byName = entries.filter(function (e) {
        return e.nameKey === nameKey || e.satNameKey === nameKey;
      });
      if (byName.length) {
        var namePick = byName.length === 1 ? byName[0] : chektPickHub_(byName);
        if (namePick) return { hit: namePick, via: 'account name', siblings: byName, ambiguous: [] };
      }
    }
    var loose = chektLooseIndex_(row.address, entries);
    if (loose.length) {
      var looseKeys = {};
      loose.forEach(function (e) { if (e.address) looseKeys[e.address] = true; });
      if (Object.keys(looseKeys).length === 1) {
        var looseNarrow = chektNarrowHits_(loose, row);
        if (looseNarrow.hit) {
          return {
            hit: looseNarrow.hit,
            via: looseNarrow.via === 'account name' ? 'account name' : 'street number and ZIP',
            siblings: loose,
            ambiguous: []
          };
        }
      }
      var looseNamed = chektHitsForName_(loose, row);
      if (looseNamed.length === 1) return { hit: looseNamed[0], via: 'account name', siblings: loose, ambiguous: [] };
      return { hit: null, via: '', siblings: [], ambiguous: loose };
    }
  }
  return { hit: null, via: '', siblings: [], ambiguous: [] };
}

function chektNarrowHits_(hits, row) {
  var picked = chektPickHub_(hits);
  if (picked) return { hit: picked, via: 'address' };
  var named = chektHitsForName_(hits, row);
  if (named.length === 1) return { hit: named[0], via: 'account name' };
  return { hit: null, via: '' };
}

function chektHitsForName_(hits, row) {
  var nameKey = chektNameKey_(row.name);
  if (!chektNameKeyUsable_(nameKey)) return [];
  return hits.filter(function (e) {
    var keys = [e.nameKey, e.satNameKey];
    return keys.some(function (k) { return chektNameOverlaps_(k, nameKey); });
  });
}

function chektNameOverlaps_(candidate, nameKey) {
  if (!candidate || !nameKey) return false;
  if (candidate === nameKey) return true;
  var shorter = candidate.length < nameKey.length ? candidate : nameKey;
  var longer = candidate.length < nameKey.length ? nameKey : candidate;
  if (shorter.split(' ').length < 2) return false;
  return (' ' + longer + ' ').indexOf(' ' + shorter + ' ') !== -1;
}

function chektPickHub_(hits) {
  if (!hits.length) return null;
  if (hits.length === 1) return hits[0];
  var best = null;
  var bestScore = -1;
  var tie = false;
  hits.forEach(function (hit) {
    var score = chektHubScore_(hit);
    if (score > bestScore) {
      best = hit;
      bestScore = score;
      tie = false;
    } else if (score === bestScore) tie = true;
  });
  if (tie) return null;
  return best;
}

function chektHubScore_(hit) {
  var score = 0;
  if (hit.customer) score += 4;
  if (hit.has_nadir) score += 2;
  if (hit.sites.length) score += 1;
  return score;
}

function chektAliasIds_(winner, siblings) {
  var ids = [];
  siblings.forEach(function (e) {
    if (!e || e.id === winner.id) return;
    var share = winner.sites.some(function (s) { return e.sites.indexOf(s) !== -1; });
    if (share && ids.indexOf(e.id) === -1) ids.push(e.id);
  });
  return ids;
}

function chektAmbiguousNote_(hits) {
  var names = hits.map(function (h) { return h.name || h.id; }).slice(0, 3);
  var note = 'Matches ' + hits.length + ' indexes (' + names.join('; ') + ')';
  if (hits.length > 3) note += ' +' + (hits.length - 3);
  return note + ' — left blank';
}

function chektLooseIndex_(address, entries) {
  var parts = chektAddrParts_(address);
  if (!parts.num) return [];
  return entries.filter(function (e) {
    var other = chektAddrParts_(e.address);
    if (other.num !== parts.num) return false;
    if (parts.zip && other.zip && parts.zip !== other.zip) return false;
    return true;
  });
}

// First letter of the site name (account name), then the last 4 digits of the CS#.
function chektPasswordFromCs_(name, cs) {
  var letter = String(name || '').replace(/[^A-Za-z]/g, '').charAt(0).toUpperCase();
  var digits = String(cs || '').replace(/\D/g, '');
  var tail = digits.length >= 4 ? digits.slice(-4) : '';
  if (!letter || tail.length < 4) return '';
  return letter + tail;
}

function chektNormalizeAddress_(address) {
  return String(address || '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// House number, street, city, ZIP. Drops suite numbers. Treats O'Hare and
// Ohare as the same word, and Parkway / Pkwy as the same suffix.
function chektCanonAddress_(address) {
  var t = String(address || '').toLowerCase().replace(/['’]/g, '');
  t = t.replace(/\boregon\b/g, 'or');
  t = t.replace(/\bparkway\b/g, 'pkwy');
  t = t.replace(/\bhighway\b/g, 'hwy');
  t = t.replace(/\bboulevard\b/g, 'blvd');
  t = t.replace(/\bstreet\b/g, 'st');
  t = t.replace(/\bavenue\b/g, 'ave');
  t = t.replace(/\bdrive\b/g, 'dr');
  t = t.replace(/\bcourt\b/g, 'ct');
  t = t.replace(/\blane\b/g, 'ln');
  t = t.replace(/\bplace\b/g, 'pl');
  t = t.replace(/\bcircle\b/g, 'cir');
  t = t.replace(/\broad\b/g, 'rd');
  t = t.replace(/\b(suite|ste|unit|apt|apartment)\b/g, ' ');
  t = t.replace(/#/g, ' ');
  t = t.replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
  var words = t.split(' ').filter(function (w) { return w; });
  var glued = [];
  for (var i = 0; i < words.length; i++) {
    var next = words[i + 1] || '';
    if (words[i].length === 1 && /[a-z]/.test(words[i]) && /[a-z]/.test(next.charAt(0))) {
      glued.push(words[i] + next);
      i++;
    } else glued.push(words[i]);
  }
  var house = '';
  var zip = '';
  var mid = [];
  glued.forEach(function (w) {
    if (!house && /^\d+$/.test(w) && w.length < 6) { house = w; return; }
    if (/^\d{5}$/.test(w)) { zip = w; return; }
    if (/^\d+$/.test(w)) return;
    mid.push(w);
  });
  return [house].concat(mid).concat(zip ? [zip] : []).filter(function (w) { return w; }).join(' ');
}

function chektNameKey_(name) {
  var drop = { llc: 1, inc: 1, incorporated: 1, company: 1, the: 1 };
  return String(name || '').toLowerCase().split(/[^a-z0-9]+/).filter(function (w) {
    return w && !drop[w];
  }).join(' ');
}

function chektNameKeyUsable_(nameKey) {
  var parts = String(nameKey || '').split(' ').filter(function (w) { return w; });
  if (parts.length >= 2) return true;
  return parts.length === 1 && parts[0].length >= 8;
}

function chektLoadIndexEntries_() {
  var ids = listIndexIds_();
  var creds = getCredentials();
  if (!creds.githubToken) throw new Error('GITHUB_TOKEN is not set');
  var headers = {
    'Authorization': 'token ' + creds.githubToken,
    'Accept': 'application/vnd.github.v3+json'
  };
  var entries = [];
  var size = 40;
  for (var i = 0; i < ids.length; i += size) {
    var slice = ids.slice(i, i + size);
    var responses = UrlFetchApp.fetchAll(slice.map(function (id) {
      return {
        url: 'https://api.github.com/repos/' + GITHUB_REPO + '/contents/' + INDEX_DIR + '/' + id + '.json',
        method: 'get',
        headers: headers,
        muteHttpExceptions: true
      };
    }));
    responses.forEach(function (res) {
      if (res.getResponseCode() !== 200) return;
      var wrapped = JSON.parse(res.getContentText());
      var entry = JSON.parse(Utilities.newBlob(Utilities.base64Decode(String(wrapped.content || '').replace(/\n/g, ''))).getDataAsString());
      var id = String((entry && entry.id) || wrapped.name || '').replace(/\.json$/, '').trim();
      if (!/^[0-9a-f]{32}$/.test(id)) return;
      var sites = [];
      var rawSites = (entry && entry.chekt_sites) || [];
      if (Object.prototype.toString.call(rawSites) === '[object Array]') {
        rawSites.forEach(function (s) {
          var n = String(s || '').replace(/\D/g, '');
          if (n && sites.indexOf(n) === -1) sites.push(n);
        });
      }
      var views = (entry && entry.views) || {};
      entries.push({
        id: id,
        name: String((entry && entry.name) || '').trim(),
        account_type: String((entry && entry.account_type) || '').trim(),
        site_no: String((entry && entry.site_no) || '').trim(),
        address: chektNormalizeAddress_(entry && entry.address),
        canon: chektCanonAddress_(entry && entry.address),
        nameKey: chektNameKey_(entry && entry.name),
        sites: sites,
        has_nadir: !!(entry && entry.has_nadir),
        customer: !!(views.security || views.wildfire)
      });
    });
  }
  return chektAttachSatellite_(entries);
}

function chektLoadSatelliteRows_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SATELLITE_SHEET);
  var rows = [];
  if (!sheet || sheet.getLastRow() < 2) return rows;
  var salt = getCredentials().hashSalt;
  var last = sheet.getLastRow();
  var vals = sheet.getRange(2, 1, last - 1, SAT_COL_ADDRESS).getValues();
  vals.forEach(function (row, i) {
    var siteNo = satValidSiteNo_(row[SAT_COL_SITE_NO - 1]);
    var hub = satPropertyId_(siteNo, salt);
    if (!hub) return;
    var name = String(row[SAT_COL_ACCOUNT - 1] || '').trim();
    var address = String(row[SAT_COL_ADDRESS - 1] || '').trim();
    rows.push({
      id: hub,
      row: i + 2,
      name: name,
      account_type: '',
      site_no: siteNo,
      address: chektNormalizeAddress_(address),
      canon: chektCanonAddress_(address),
      nameKey: chektNameKey_(name),
      sites: [],
      has_nadir: false,
      customer: false
    });
  });
  return rows;
}

function chektSatelliteIndex_(rows) {
  var byCs = {};
  var byCanon = {};
  var byName = {};
  var byAddr = {};
  var byHouseZip = {};
  function add(map, key, row) {
    if (!key) return;
    if (!map[key]) map[key] = [];
    map[key].push(row);
  }
  rows.forEach(function (r) {
    add(byCs, chektDigits_(r.site_no), r);
    add(byCanon, r.canon, r);
    add(byName, r.nameKey, r);
    add(byAddr, r.address, r);
    var parts = chektAddrParts_(r.address);
    if (parts.num && parts.zip) add(byHouseZip, parts.num + ':' + parts.zip, r);
  });
  return { byCs: byCs, byCanon: byCanon, byName: byName, byAddr: byAddr, byHouseZip: byHouseZip };
}

function chektResolveFromIndex_(row, idx) {
  var cs = chektDigits_(row.cs);
  if (cs && idx.byCs[cs]) {
    var byCs = idx.byCs[cs];
    var pool = byCs;
    if (byCs.length === 1 && byCs[0].address && idx.byAddr[byCs[0].address]) pool = idx.byAddr[byCs[0].address];
    var csPick = chektPickHub_(pool);
    if (csPick) return { hit: csPick, via: 'CS#', siblings: pool, ambiguous: [] };
    return { hit: null, via: '', siblings: [], ambiguous: pool };
  }
  var key = chektNormalizeAddress_(row.address);
  if (key && idx.byAddr[key]) {
    var byAddr = idx.byAddr[key];
    var addrPick = chektPickHub_(byAddr);
    if (addrPick) return { hit: addrPick, via: 'address', siblings: byAddr, ambiguous: [] };
    return { hit: null, via: '', siblings: [], ambiguous: byAddr };
  }
  var canon = chektCanonAddress_(row.address);
  if (canon && idx.byCanon[canon]) {
    var byCanon = idx.byCanon[canon];
    var canonNarrow = chektNarrowHits_(byCanon, row);
    if (canonNarrow.hit) return { hit: canonNarrow.hit, via: canonNarrow.via, siblings: byCanon, ambiguous: [] };
    return { hit: null, via: '', siblings: [], ambiguous: byCanon };
  }
  var nameKey = chektNameKey_(row.name);
  if (chektNameKeyUsable_(nameKey) && idx.byName[nameKey]) {
    var byName = idx.byName[nameKey];
    var namePick = byName.length === 1 ? byName[0] : chektPickHub_(byName);
    if (namePick) return { hit: namePick, via: 'account name', siblings: byName, ambiguous: [] };
  }
  var parts = chektAddrParts_(row.address);
  var hz = parts.num && parts.zip ? idx.byHouseZip[parts.num + ':' + parts.zip] : null;
  if (hz && hz.length) {
    var keys = {};
    hz.forEach(function (e) { if (e.address) keys[e.address] = true; });
    if (Object.keys(keys).length === 1) {
      var looseNarrow = chektNarrowHits_(hz, row);
      if (looseNarrow.hit) {
        return {
          hit: looseNarrow.hit,
          via: looseNarrow.via === 'account name' ? 'account name' : 'street number and ZIP',
          siblings: hz,
          ambiguous: []
        };
      }
    }
    var looseNamed = chektHitsForName_(hz, row);
    if (looseNamed.length === 1) return { hit: looseNamed[0], via: 'account name', siblings: hz, ambiguous: [] };
    return { hit: null, via: '', siblings: [], ambiguous: hz };
  }
  return { hit: null, via: '', siblings: [], ambiguous: [] };
}

function chektListRecordsHubs_() {
  var ids = {};
  var token = '';
  var page = 0;
  while (page < 40) {
    page++;
    var xml = chektRecordsListPage_(token);
    var re = /<Key>index\/([0-9a-f]{32})\.json<\/Key>/g;
    var found;
    while ((found = re.exec(xml))) ids[found[1]] = true;
    if (xml.indexOf('<IsTruncated>true</IsTruncated>') === -1) break;
    var next = xml.match(/<NextContinuationToken>([^<]*)<\/NextContinuationToken>/);
    if (!next || !next[1]) break;
    token = next[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  }
  return ids;
}

function chektRecordsListPage_(token) {
  var creds = getCredentials();
  if (!creds.awsKeyId || !creds.awsSecret) throw new Error('AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY not set');
  var host = RECORDS_S3_HOST;
  var region = 'us-east-1';
  var service = 's3';
  var now = new Date();
  var dateStamp = Utilities.formatDate(now, 'UTC', 'yyyyMMdd');
  var amzDate = dateStamp + 'T' + Utilities.formatDate(now, 'UTC', 'HHmmss') + 'Z';
  var payloadHash = sha256Hex('');
  var params = [['list-type', '2'], ['max-keys', '1000'], ['prefix', 'index/']];
  if (token) params.push(['continuation-token', token]);
  params.sort(function (a, b) { return a[0] < b[0] ? -1 : (a[0] > b[0] ? 1 : 0); });
  var canonicalQuery = params.map(function (p) {
    return encodeURIComponent(p[0]) + '=' + encodeURIComponent(p[1]);
  }).join('&');
  var canonicalHeaders =
    'host:' + host + '\n' +
    'x-amz-content-sha256:' + payloadHash + '\n' +
    'x-amz-date:' + amzDate + '\n';
  var signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  var canonicalRequest = ['GET', '/', canonicalQuery, canonicalHeaders, signedHeaders, payloadHash].join('\n');
  var scope = dateStamp + '/' + region + '/' + service + '/aws4_request';
  var stringToSign = 'AWS4-HMAC-SHA256\n' + amzDate + '\n' + scope + '\n' + sha256Hex(canonicalRequest);
  var kDate = hmacSha256Bytes(dateStamp, Utilities.newBlob('AWS4' + creds.awsSecret).getBytes());
  var kRegion = hmacSha256Bytes(region, kDate);
  var kService = hmacSha256Bytes(service, kRegion);
  var kSigning = hmacSha256Bytes('aws4_request', kService);
  var sig = hmacSha256Bytes(stringToSign, kSigning).map(function (b) {
    return ('0' + (b & 0xFF).toString(16)).slice(-2);
  }).join('');
  var res = UrlFetchApp.fetch('https://' + host + '/?' + canonicalQuery, {
    method: 'get',
    headers: {
      'X-Amz-Content-Sha256': payloadHash,
      'X-Amz-Date': amzDate,
      'Authorization': 'AWS4-HMAC-SHA256 Credential=' + creds.awsKeyId + '/' + scope +
        ', SignedHeaders=' + signedHeaders + ', Signature=' + sig
    },
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) {
    throw new Error('Records list HTTP ' + res.getResponseCode());
  }
  return res.getContentText();
}

// Copy the Satellite sheet's name, address, and CS# onto a hub that already
// has a GitHub index file. A Satellite row with no index file stays out of
// this list. Records-only hubs are checked separately.
function chektAttachSatellite_(entries) {
  var byId = {};
  entries.forEach(function (e) { byId[e.id] = e; });
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SATELLITE_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return entries;
  var salt = getCredentials().hashSalt;
  var last = sheet.getLastRow();
  var vals = sheet.getRange(2, 1, last - 1, SAT_COL_ADDRESS).getValues();
  vals.forEach(function (row) {
    var siteNo = satValidSiteNo_(row[SAT_COL_SITE_NO - 1]);
    var hub = satPropertyId_(siteNo, salt);
    if (!hub) return;
    var name = String(row[SAT_COL_ACCOUNT - 1] || '').trim();
    var address = String(row[SAT_COL_ADDRESS - 1] || '').trim();
    var existing = byId[hub];
    if (!existing) return;
    if (!existing.site_no) existing.site_no = siteNo;
    if (!existing.name) existing.name = name;
    if (!existing.nameKey) existing.nameKey = chektNameKey_(existing.name);
    existing.satCanon = chektCanonAddress_(address);
    existing.satNameKey = chektNameKey_(name);
  });
  return entries;
}

function chektCsByHub_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SATELLITE_SHEET);
  var out = {};
  if (!sheet || sheet.getLastRow() < 2) return out;
  var salt = getCredentials().hashSalt;
  var last = sheet.getLastRow();
  var vals = sheet.getRange(2, 1, last - 1, SAT_COL_ADDRESS).getValues();
  vals.forEach(function (row) {
    var siteNo = satValidSiteNo_(row[SAT_COL_SITE_NO - 1]);
    var hub = satPropertyId_(siteNo, salt);
    if (hub && siteNo) out[hub] = siteNo;
  });
  return out;
}

function publishChektAccounts() {
  var ui = SpreadsheetApp.getUi();
  var pepper = chektPassPepper_();
  if (!pepper) {
    ui.alert('CHEKT Accounts',
      'Script Property CHEKT_SYNC_KEY is empty. Set it to the Lambda viewer password, then publish again. Nothing was written.',
      ui.ButtonSet.OK);
    return;
  }
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CHEKT_ACCOUNTS_SHEET);
  if (!sheet) {
    ui.alert('CHEKT Accounts', 'Run Set Up CHEKT Accounts Sheet first.', ui.ButtonSet.OK);
    return;
  }
  var last = sheet.getLastRow();
  if (last < 2) {
    ui.alert('CHEKT Accounts', 'The tab has no account rows. Nothing was written.', ui.ButtonSet.OK);
    return;
  }
  var width = CHEKT_HEADERS.length;
  var vals = sheet.getRange(2, 1, last - 1, width).getValues();
  var parsed = chektParseAccountRows_(vals);
  parsed.skipped.forEach(function (s) {
    sheet.getRange(s.row, CHEKT_COL_MATCH).setValue('Not published — ' + s.reason);
  });
  if (parsed.errors.length) {
    ui.alert('CHEKT Accounts',
      'Nothing was written. Fix these rows and publish again:\n\n' + parsed.errors.join('\n'),
      ui.ButtonSet.OK);
    return;
  }
  var body = JSON.stringify({
    version: 1,
    accounts: parsed.accounts.map(function (a) {
      return { name: a.name, hub_id: a.hub_id, ids: a.ids, sites: a.sites, pass_hmac: a.pass_hmac };
    })
  });
  var put;
  var indexNotes = [];
  try {
    put = chektAccountsS3Put_(CHEKT_ACCOUNTS_KEY, body);
    parsed.accounts.forEach(function (a) {
      var wrote = chektWriteIndexSites_(a.hub_id, a.sites);
      if (!wrote.ok) indexNotes.push(a.name + ': ' + wrote.reason);
    });
  } catch (e) {
    ui.alert('CHEKT Accounts', 'Publish failed. Nothing on the sheet was marked published.\n\n' + e.message, ui.ButtonSet.OK);
    return;
  }
  var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'America/Los_Angeles', 'yyyy-MM-dd HH:mm');
  parsed.accounts.forEach(function (a) {
    sheet.getRange(a._row, CHEKT_COL_PUBLISHED).setValue(stamp);
    sheet.getRange(a._row, CHEKT_COL_LINK).setValue(chektViewerLink_(a.hub_id));
  });
  ui.alert('CHEKT Accounts',
    'Published ' + parsed.accounts.length + ' account(s) with a hub id.\n\n' +
    'Password hashes: s3://' + CHEKT_ACCOUNTS_BUCKET + '/' + CHEKT_ACCOUNTS_KEY +
    '\nCamera sites written onto each hub index in property-intel-records.' +
    (indexNotes.length ? '\n\nIndex not updated:\n' + indexNotes.join('\n') : '') +
    '\n\nRows with no hub id were left unpublished.' +
    (parsed.skipped.length
      ? '\n\nLeft unpublished:\n' +
        parsed.skipped.map(function (s) { return 'Row ' + s.row + ' (' + s.name + '): ' + s.reason; }).join('\n')
      : '') +
    (parsed.warnings.length
      ? '\n\nSite ids left on the first account:\n' + parsed.warnings.join('\n')
      : '') +
    '\n\nThe password stays on this sheet.',
    ui.ButtonSet.OK);
}

// HMAC-SHA256(pepper, password) as lowercase hex. The gateway function
// _pass_hmac must stay byte-for-byte the same: key = pepper, message = password.
function chektPassHmac_(password, pepper) {
  var sig = Utilities.computeHmacSha256Signature(String(password), String(pepper));
  return sig.map(function (b) { return ('0' + (b & 0xFF).toString(16)).slice(-2); }).join('');
}

function chektPassPepper_() {
  var v = PropertiesService.getScriptProperties().getProperty('CHEKT_SYNC_KEY');
  return v ? String(v).trim() : '';
}

// Adds chekt_sites to an index that already exists. Does not create an
// index, and does not write the password. Records copy first, then the
// GitHub index if AWS does not have one yet.
function chektWriteIndexSites_(hubId, sites) {
  var key = recordsIndexKey_(hubId);
  var existing = recordsFetchJson_(key);
  if (!existing) existing = fetchIndexEntry_(hubId);
  if (!existing) return { ok: false, reason: 'no index for ' + hubId };
  existing.id = hubId;
  existing.chekt_sites = sites.slice();
  recordsPutJson_(key, existing);
  return { ok: true };
}

function chektSplitIds_(raw) {
  var out = [];
  var seen = {};
  String(raw || '').split(/[\s,]+/).forEach(function (part) {
    var p = String(part || '').trim();
    if (!p || seen[p]) return;
    seen[p] = true;
    out.push(p);
  });
  return out;
}

function chektParseAccountRows_(vals) {
  var pepper = chektPassPepper_();
  var errors = [];
  var skipped = [];
  var warnings = [];
  var accounts = [];
  var hubOwner = {};
  var siteOwner = {};
  for (var i = 0; i < vals.length; i++) {
    var rowNum = i + 2;
    var name = String(vals[i][CHEKT_COL_NAME - 1] || '').trim();
    var hub = String(vals[i][CHEKT_COL_HUB - 1] || '').trim().toLowerCase();
    var sites = chektSplitIds_(vals[i][CHEKT_COL_SITES - 1]);
    var password = String(vals[i][CHEKT_COL_PASSWORD - 1] || '').trim();
    var aliases = chektSplitIds_(vals[i][CHEKT_COL_ALIASES - 1]).map(function (id) {
      return id.toLowerCase();
    });
    var blank = !name && !hub && !sites.length && !password && !aliases.length;
    if (blank) continue;
    if (!hub) continue;
    var label = name || ('row ' + rowNum);
    if (!/^[0-9a-f]{32}$/.test(hub)) {
      errors.push('Row ' + rowNum + ' (' + label + '): property hub id must be 32 hex characters.');
    }
    if (!sites.length) {
      skipped.push({ row: rowNum, name: label, reason: 'no CHEKT site id' });
      continue;
    }
    if (password.trim().length < CHEKT_PASS_MIN) {
      skipped.push({ row: rowNum, name: label, reason: 'password must be at least ' + CHEKT_PASS_MIN + ' characters' });
      continue;
    }
    var badSite = false;
    sites.forEach(function (sid) {
      if (!/^[0-9]+$/.test(sid)) {
        errors.push('Row ' + rowNum + ' (' + label + '): site id "' + sid + '" is not digits.');
        badSite = true;
      }
    });
    if (badSite) continue;
    var ids = [hub].concat(aliases.filter(function (id) { return id && id !== hub; }));
    ids.forEach(function (id) {
      if (id && !/^[0-9a-f]{32}$/.test(id)) {
        errors.push('Row ' + rowNum + ' (' + label + '): property id "' + id + '" must be 32 hex characters.');
      }
      if (id && hubOwner[id]) {
        errors.push('Row ' + rowNum + ' (' + label + '): property id ' + id + ' is also on ' + hubOwner[id] + '.');
      } else if (id) {
        hubOwner[id] = label;
      }
    });
    var kept = [];
    var dropped = [];
    sites.forEach(function (sid) {
      if (!/^[0-9]+$/.test(sid)) return;
      if (siteOwner[sid]) dropped.push(sid + ' stays on ' + siteOwner[sid]);
      else {
        siteOwner[sid] = label;
        kept.push(sid);
      }
    });
    if (!kept.length) {
      skipped.push({ row: rowNum, name: label, reason: dropped.join('; ') });
      continue;
    }
    if (dropped.length) warnings.push('Row ' + rowNum + ' (' + label + '): ' + dropped.join('; '));
    accounts.push({
      _row: rowNum,
      name: name || label,
      hub_id: hub,
      ids: ids.filter(function (id) { return /^[0-9a-f]{32}$/.test(id); }),
      sites: kept,
      pass_hmac: chektPassHmac_(password, pepper)
    });
  }
  if (!accounts.length && !errors.length) {
    errors.push('No account rows to publish.');
  }
  return { accounts: accounts, errors: errors, skipped: skipped, warnings: warnings };
}

function chektAccountsS3Put_(key, body) {
  var creds = getCredentials();
  if (!creds.awsKeyId || !creds.awsSecret) {
    throw new Error('AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY not set in Script Properties');
  }
  var region = 'us-east-1';
  var service = 's3';
  var host = CHEKT_ACCOUNTS_BUCKET + '.s3.us-east-1.amazonaws.com';
  var path = '/' + String(key).split('/').map(encodeURIComponent).join('/');
  var now = new Date();
  var dateStamp = Utilities.formatDate(now, 'UTC', 'yyyyMMdd');
  var amzDate = dateStamp + 'T' + Utilities.formatDate(now, 'UTC', 'HHmmss') + 'Z';
  var payloadHash = sha256Hex(body);
  var ctype = 'application/json';
  var canonicalHeaders =
    'content-type:' + ctype + '\n' +
    'host:' + host + '\n' +
    'x-amz-content-sha256:' + payloadHash + '\n' +
    'x-amz-date:' + amzDate + '\n';
  var signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
  var canonicalRequest = ['PUT', path, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
  var credentialScope = dateStamp + '/' + region + '/' + service + '/aws4_request';
  var stringToSign = 'AWS4-HMAC-SHA256\n' + amzDate + '\n' + credentialScope + '\n' + sha256Hex(canonicalRequest);
  var kDate = hmacSha256Bytes(dateStamp, Utilities.newBlob('AWS4' + creds.awsSecret).getBytes());
  var kRegion = hmacSha256Bytes(region, kDate);
  var kService = hmacSha256Bytes(service, kRegion);
  var kSigning = hmacSha256Bytes('aws4_request', kService);
  var sig = hmacSha256Bytes(stringToSign, kSigning).map(function (b) {
    return ('0' + (b & 0xFF).toString(16)).slice(-2);
  }).join('');
  var headers = {
    'X-Amz-Content-Sha256': payloadHash,
    'X-Amz-Date': amzDate,
    'Authorization': 'AWS4-HMAC-SHA256 Credential=' + creds.awsKeyId + '/' + credentialScope +
      ', SignedHeaders=' + signedHeaders + ', Signature=' + sig
  };
  var res = UrlFetchApp.fetch('https://' + host + path, {
    method: 'put', headers: headers, contentType: ctype, payload: body, muteHttpExceptions: true
  });
  var code = res.getResponseCode();
  if (code !== 200) {
    var txt = res.getContentText();
    var m = txt.match(/<Code>([^<]+)<\/Code>[\s\S]*?<Message>([^<]+)<\/Message>/);
    throw new Error('S3 PUT ' + key + ' -> HTTP ' + code + (m ? (': ' + m[1] + ' — ' + m[2]) : (': ' + txt.substring(0, 200))));
  }
  var hdrs = res.getHeaders();
  return { key: key, etag: hdrs['ETag'] || hdrs['Etag'] || '' };
}

// ============================================================
// CHEKT accounts with no property hub — seed, Pass 1, records sync
// ============================================================
// Match joins a Chekt row to an index that already exists. An account
// whose property was never mapped has no index, so Match leaves the hub
// blank and Publish skips the row. These actions close that gap from the
// sheet, in this order:
//
//   1. addChektAccountsToSatellite — one Satellite row per unmatched
//      account: site_no = CS#, Account Name, Property Address. No row is
//      added when the Satellite tab already has that CS#, address, or
//      name (Match would already join those; they need Pass 1 + sync).
//   2. generateChektSatellitePass1 / startChektSatellitePass1Auto —
//      Pass 1 on the Satellite rows that belong to Chekt accounts and
//      still have no element pins. Same per-row code as the Satellite
//      menu (prepareSatNadir_ then runSatElementPinsCall_ with the Pass 1
//      emit list). Only the row selection is narrower.
//   3. syncChektSatelliteRows — recordsPublishSatelliteSheetRow_ for
//      those rows: satellite/{id}.json, pins/{id}.json, index/{id}.json
//      on property-intel-records. Then Match finds the hub through the
//      records index, Publish writes chekt_sites, and the hub's Private
//      2D opens on files.satellite.
//
// Why Pass 1 and not an identity stub: the hub opens Private 2D only when
// the index has views.security / wildfire, and the records writer sets
// those only when the row has element pins. Element pins stay hidden on
// a CHEKT hub (chekt_sites); the camera pins are what the map shows.

var CHEKT_SAT_PASS1_TRIGGER = 'chektSatellitePass1AutoRun';
var CHEKT_SAT_SYNC_PROP = 'CHEKT_SAT_SYNC_STATE';
var CHEKT_SAT_SYNC_MAX_MS = 4.5 * 60 * 1000;

function addChektAccountsToSatellite() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CHEKT_ACCOUNTS_SHEET);
  var sat = ss.getSheetByName(SATELLITE_SHEET);
  if (!sheet || sheet.getLastRow() < 2) {
    ui.alert('CHEKT Accounts', 'Paste account rows on the Chekt tab first.', ui.ButtonSet.OK);
    return;
  }
  if (!sat) {
    ui.alert('CHEKT Accounts', 'No "' + SATELLITE_SHEET + '" tab in this spreadsheet.', ui.ButtonSet.OK);
    return;
  }
  var satIndex = chektSatelliteIndex_(chektLoadSatelliteRows_());
  var last = sheet.getLastRow();
  var vals = sheet.getRange(2, 1, last - 1, CHEKT_HEADERS.length).getValues();
  var plan = { add: [], exists: [], ambiguous: [], noSites: [], noCs: [], noAddress: [], hubbed: 0 };
  var queued = {};
  for (var i = 0; i < vals.length; i++) {
    var rowNum = i + 2;
    var name = String(vals[i][CHEKT_COL_NAME - 1] || '').trim();
    var address = String(vals[i][CHEKT_COL_ADDRESS - 1] || '').trim();
    var csRaw = String(vals[i][CHEKT_COL_CS - 1] || '').trim();
    var hub = String(vals[i][CHEKT_COL_HUB - 1] || '').trim();
    var sites = chektSplitIds_(vals[i][CHEKT_COL_SITES - 1]);
    if (!name && !address && !csRaw && !sites.length) continue;
    if (hub) { plan.hubbed++; continue; }
    var label = name || address || ('row ' + rowNum);
    if (!sites.length) { plan.noSites.push({ row: rowNum, name: label }); continue; }
    var cs = chektDigits_(csRaw);
    if (!cs) { plan.noCs.push({ row: rowNum, name: label }); continue; }
    if (!address) { plan.noAddress.push({ row: rowNum, name: label }); continue; }
    var resolved = chektResolveFromIndex_({ address: address, name: name, cs: csRaw }, satIndex);
    if (resolved.hit) {
      plan.exists.push({ row: rowNum, name: label, satRow: resolved.hit.row, siteNo: resolved.hit.site_no, via: resolved.via });
      continue;
    }
    if (resolved.ambiguous.length) {
      plan.ambiguous.push({ row: rowNum, name: label, hits: resolved.ambiguous });
      continue;
    }
    if (queued[cs]) {
      plan.exists.push({ row: rowNum, name: label, satRow: queued[cs], siteNo: csRaw, via: 'the same CS# higher on this tab' });
      continue;
    }
    queued[cs] = rowNum;
    plan.add.push({ row: rowNum, name: name || label, address: address, siteNo: csRaw });
  }

  var summary =
    plan.add.length + ' row(s) to add to the ' + SATELLITE_SHEET + ' tab.\n' +
    plan.exists.length + ' already have a Satellite row (they need Pass 1 + sync, not a new row).\n' +
    plan.ambiguous.length + ' match more than one Satellite row and are left alone.\n' +
    plan.noSites.length + ' have no CHEKT site id (no cameras) and are skipped.\n' +
    plan.noCs.length + ' have no CS# — run Fill CHEKT site ids or type it in column H.\n' +
    plan.noAddress.length + ' have no address and are skipped.\n' +
    plan.hubbed + ' already have a hub id.';

  // Match notes for the rows that are not added. Written only after the
  // operator has seen the plan (nothing-to-add, or YES below).
  function writeNotes_() {
    plan.exists.forEach(function (x) {
      sheet.getRange(x.row, CHEKT_COL_MATCH).setValue(
        'Satellite row ' + x.satRow + ' (site_no ' + x.siteNo + ') exists via ' + x.via +
        ' — needs Pass 1 + sync, then Match');
    });
    plan.ambiguous.forEach(function (x) {
      sheet.getRange(x.row, CHEKT_COL_MATCH).setValue(chektAmbiguousNote_(x.hits).replace('indexes', 'Satellite rows'));
    });
    plan.noCs.forEach(function (x) {
      sheet.getRange(x.row, CHEKT_COL_MATCH).setValue('No CS# — cannot seed a Satellite row');
    });
  }

  if (!plan.add.length) {
    writeNotes_();
    ui.alert('Add unmatched accounts to Satellite', summary + '\n\nNothing to add.', ui.ButtonSet.OK);
    return;
  }
  var preview = plan.add.slice(0, 8).map(function (a) {
    return a.siteNo + ' · ' + a.name + ' · ' + a.address;
  }).join('\n');
  if (plan.add.length > 8) preview += '\n… and ' + (plan.add.length - 8) + ' more';
  var go = ui.alert('Add unmatched accounts to Satellite',
    summary + '\n\nRows to add (site_no · name · address):\n' + preview +
    '\n\nAccount Type (column B) is left blank, which Pass 1 treats as residential. ' +
    'Set Commercial or School on the new rows before running Pass 1 where that applies.\n\nAdd these rows now?',
    ui.ButtonSet.YES_NO);
  if (go !== ui.Button.YES) return;

  writeNotes_();
  var startRow = sat.getLastRow() + 1;
  var rows = plan.add.map(function (a) { return [a.siteNo, '', a.name, a.address]; });
  var need = startRow + rows.length - 1;
  if (need > sat.getMaxRows()) sat.insertRowsAfter(sat.getMaxRows(), need - sat.getMaxRows());
  // site_no as text so a CS# keeps its digits exactly as typed.
  sat.getRange(startRow, SAT_COL_SITE_NO, rows.length, 1).setNumberFormat('@');
  sat.getRange(startRow, 1, rows.length, SAT_COL_ADDRESS).setValues(rows);
  SpreadsheetApp.flush();
  plan.add.forEach(function (a, k) {
    sheet.getRange(a.row, CHEKT_COL_MATCH).setValue(
      'Satellite row ' + (startRow + k) + ' added — run CHEKT rows Pass 1, then Sync CHEKT Satellite rows, then Match');
  });
  ui.alert('Add unmatched accounts to Satellite',
    'Added ' + rows.length + ' row(s) at ' + SATELLITE_SHEET + ' rows ' + startRow + '–' + (startRow + rows.length - 1) + '.\n\n' +
    'Next: CHEKT rows — Element Pins Pass 1 (Batch), or start the auto run. ' +
    'Then Sync CHEKT Satellite rows to records, then Match addresses to index, then Publish CHEKT accounts.',
    ui.ButtonSet.OK);
}

// Satellite rows that belong to Chekt accounts: site_no digits equal a
// Chekt CS#, plus the row Match would join by address or name for a Chekt
// row that still has no hub. Returns [{ row, vals, siteNo }] in sheet order.
function chektSatelliteScope_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var chekt = ss.getSheetByName(CHEKT_ACCOUNTS_SHEET);
  var sat = ss.getSheetByName(SATELLITE_SHEET);
  if (!chekt || !sat || chekt.getLastRow() < 2 || sat.getLastRow() < 2) return [];
  var cvals = chekt.getRange(2, 1, chekt.getLastRow() - 1, CHEKT_HEADERS.length).getValues();
  var csSet = {};
  var unhubbed = [];
  cvals.forEach(function (r) {
    var cs = chektDigits_(r[CHEKT_COL_CS - 1]);
    var name = String(r[CHEKT_COL_NAME - 1] || '').trim();
    var address = String(r[CHEKT_COL_ADDRESS - 1] || '').trim();
    var hub = String(r[CHEKT_COL_HUB - 1] || '').trim();
    if (!cs && !name && !address) return;
    if (cs) csSet[cs] = true;
    if (!hub) unhubbed.push({ cs: String(r[CHEKT_COL_CS - 1] || '').trim(), name: name, address: address });
  });
  var width = Math.max(sat.getLastColumn(), SAT_COL_UPLOAD_DATE);
  var data = sat.getRange(2, 1, sat.getLastRow() - 1, width).getValues();
  var picked = {};
  data.forEach(function (vals, i) {
    var siteNo = satValidSiteNo_(vals[SAT_COL_SITE_NO - 1]);
    var d = chektDigits_(siteNo);
    if (siteNo && d && csSet[d]) picked[i + 2] = true;
  });
  if (unhubbed.length) {
    var satIndex = chektSatelliteIndex_(chektLoadSatelliteRows_());
    unhubbed.forEach(function (u) {
      var hit = chektResolveFromIndex_({ address: u.address, name: u.name, cs: u.cs }, satIndex).hit;
      if (hit && hit.row) picked[hit.row] = true;
    });
  }
  var out = [];
  Object.keys(picked).map(Number).sort(function (a, b) { return a - b; }).forEach(function (row) {
    var vals = data[row - 2];
    if (!vals) return;
    out.push({ row: row, vals: vals, siteNo: satValidSiteNo_(vals[SAT_COL_SITE_NO - 1]) });
  });
  return out;
}

// Pass 1 core for the CHEKT scope: up to BATCH_SIZE ready rows per run.
// Ready = address present and Nadir Elements blank or ERROR, exactly as
// satRowReadyForElementPins_ decides for the Satellite menu. Shared by the
// menu action (alerts) and the 5-minute auto run (logs).
function runChektSatellitePass1Batch_() {
  var sat = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SATELLITE_SHEET);
  var scope = chektSatelliteScope_();
  var ready = scope.filter(function (s) { return satRowReadyForElementPins_(s.vals); })
    .map(function (s) { return s.row; });
  var done = 0, failed = 0, attempted = 0;
  for (var i = 0; i < ready.length; i++) {
    if (attempted >= BATCH_SIZE) break;
    attempted++;
    try {
      if (processSatElementPinsRow_(sat, ready[i])) done++; else failed++;
    } catch (e) {
      failed++;
      Logger.log('CHEKT Pass 1 ERROR row ' + ready[i] + ': ' + e.message);
      writePlainCell(sat, ready[i], SAT_COL_ELEMENTS, 'ERROR: ' + String(e.message || e).substring(0, 80));
    }
    Utilities.sleep(2000);
  }
  return {
    scope: scope.length, ready: ready.length, attempted: attempted, done: done, failed: failed,
    remaining: Math.max(0, ready.length - attempted)
  };
}

function generateChektSatellitePass1() {
  var ui = SpreadsheetApp.getUi();
  var sat = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SATELLITE_SHEET);
  if (!sat) { ui.alert('CHEKT Accounts', 'No "' + SATELLITE_SHEET + '" tab.', ui.ButtonSet.OK); return; }
  var r = runChektSatellitePass1Batch_();
  if (!r.scope) {
    ui.alert('CHEKT rows — Pass 1',
      'No Satellite row belongs to a Chekt account yet. Run Add unmatched accounts to Satellite first.',
      ui.ButtonSet.OK);
    return;
  }
  if (!r.ready) {
    ui.alert('CHEKT rows — Pass 1',
      r.scope + ' Satellite row(s) belong to Chekt accounts and all of them already have element pins.\n\n' +
      'Next: Sync CHEKT Satellite rows to records.',
      ui.ButtonSet.OK);
    return;
  }
  ui.alert('CHEKT rows — Pass 1',
    r.scope + ' Satellite row(s) belong to Chekt accounts; ' + r.ready + ' needed Pass 1.\n\n' +
    'Completed: ' + r.done + '\nFailed: ' + r.failed +
    (r.remaining > 0 ? '\nRemaining: ' + r.remaining + ' — run again, or start the auto run.' : '\nAll ready rows processed.') +
    '\n\nA failed row shows ERROR: in Nadir Elements and is retried on the next run. ' +
    'When the count is done, run Sync CHEKT Satellite rows to records.',
    ui.ButtonSet.OK);
}

// Trigger entry point (no UI). Same ScriptLock as the Satellite auto run,
// so the two never pin at the same time.
function chektSatellitePass1AutoRun() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) { Logger.log('CHEKT Pass 1 auto-run: another run holds the lock — skipping.'); return; }
  try {
    var r = runChektSatellitePass1Batch_();
    Logger.log('CHEKT Pass 1 auto-run: scope=' + r.scope + ' ready=' + r.ready + ' attempted=' + r.attempted +
      ' done=' + r.done + ' failed=' + r.failed + ' remaining=' + r.remaining);
    if (!r.ready) {
      chektClearPass1Trigger_();
      Logger.log('CHEKT Pass 1 auto-run: ' + (r.scope ? 'nothing left to pin' : 'no Satellite row in the CHEKT scope') +
        ' — trigger removed.');
    }
  } catch (e) {
    Logger.log('CHEKT Pass 1 auto-run ERROR: ' + e.message);
  } finally {
    lock.releaseLock();
  }
}

function chektClearPass1Trigger_() {
  var removed = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === CHEKT_SAT_PASS1_TRIGGER) { ScriptApp.deleteTrigger(t); removed++; }
  });
  return removed;
}

function startChektSatellitePass1Auto() {
  var ui = SpreadsheetApp.getUi();
  var removed = chektClearPass1Trigger_();
  ScriptApp.newTrigger(CHEKT_SAT_PASS1_TRIGGER).timeBased().everyMinutes(5).create();
  ui.alert('CHEKT rows — Auto Pass 1',
    'Started. Every 5 minutes, up to ' + BATCH_SIZE + ' Satellite rows that belong to Chekt accounts and have no element pins get Pass 1. ' +
    'The trigger removes itself when none are left.' +
    (removed ? '\n\n(Replaced ' + removed + ' existing trigger.)' : '') +
    '\n\nUse CHEKT rows — Stop Auto Pass 1 to turn it off early.',
    ui.ButtonSet.OK);
}

function stopChektSatellitePass1Auto() {
  var ui = SpreadsheetApp.getUi();
  var removed = chektClearPass1Trigger_();
  ui.alert('CHEKT rows — Auto Pass 1',
    removed ? 'Stopped. Removed ' + removed + ' trigger(s).' : 'No CHEKT Pass 1 trigger was running.',
    ui.ButtonSet.OK);
}

function checkChektSatellitePass1Status() {
  var ui = SpreadsheetApp.getUi();
  var running = ScriptApp.getProjectTriggers().some(function (t) {
    return t.getHandlerFunction() === CHEKT_SAT_PASS1_TRIGGER;
  });
  var scope = chektSatelliteScope_();
  var ready = 0;
  var errors = 0;
  scope.forEach(function (s) {
    if (satRowReadyForElementPins_(s.vals)) {
      ready++;
      if (String(s.vals[SAT_COL_ELEMENTS - 1] || '').indexOf('ERROR:') === 0) errors++;
    }
  });
  ui.alert('CHEKT rows — Auto Pass 1',
    'Auto-run: ' + (running ? 'ACTIVE (every 5 minutes, ' + BATCH_SIZE + ' per run)' : 'not running') + '\n' +
    'Satellite rows that belong to Chekt accounts: ' + scope.length + '\n' +
    'Still needing Pass 1: ' + ready + (errors ? ' (' + errors + ' showing ERROR:)' : ''),
    ui.ButtonSet.OK);
}

// Records sync for the CHEKT scope. Uses the same per-row writer as the
// overnight mothership publish, so a row with pins gets satellite +
// pins + index, and a row without pins gets an identity stub. Stops at
// 4.5 minutes and resumes from the saved position on the next run.
// Writes Upload Date (T) on the Satellite row when the full record went out.
function syncChektSatelliteRows() {
  var ui = SpreadsheetApp.getUi();
  var sat = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SATELLITE_SHEET);
  if (!sat) { ui.alert('CHEKT Accounts', 'No "' + SATELLITE_SHEET + '" tab.', ui.ButtonSet.OK); return; }
  if (typeof recordsPublishSatelliteSheetRow_ !== 'function') {
    ui.alert('CHEKT Accounts', 'records.gs is not in this project (recordsPublishSatelliteSheetRow_ missing). Nothing was written.', ui.ButtonSet.OK);
    return;
  }
  var creds = getCredentials();
  var scope = chektSatelliteScope_();
  if (!scope.length) {
    ui.alert('Sync CHEKT Satellite rows',
      'No Satellite row belongs to a Chekt account. Run Add unmatched accounts to Satellite first.',
      ui.ButtonSet.OK);
    return;
  }
  var props = PropertiesService.getScriptProperties();
  var state = null;
  try { state = JSON.parse(props.getProperty(CHEKT_SAT_SYNC_PROP) || 'null'); } catch (e) { state = null; }
  var start = (state && typeof state.i === 'number' && state.n === scope.length && state.i < scope.length) ? state.i : 0;
  var started = Date.now();
  var ok = 0, stub = 0, skip = 0, fail = 0;
  var notes = [];
  var stamp = new Date().toLocaleString();
  var i = start;
  for (; i < scope.length; i++) {
    if (Date.now() - started > CHEKT_SAT_SYNC_MAX_MS) break;
    var item = scope[i];
    try {
      var r = recordsPublishSatelliteSheetRow_(item.vals, creds);
      if (r.kind === 'ok') {
        ok++;
        sat.getRange(item.row, SAT_COL_UPLOAD_DATE).setValue(stamp);
      } else if (r.kind === 'stub') {
        stub++;
      } else {
        skip++;
        if (notes.length < 10) notes.push('row ' + item.row + ' skipped: ' + (r.reason || ''));
      }
    } catch (e) {
      fail++;
      if (notes.length < 10) notes.push('row ' + item.row + ': ' + String(e.message || e));
    }
  }
  var finished = i >= scope.length;
  if (finished) props.deleteProperty(CHEKT_SAT_SYNC_PROP);
  else props.setProperty(CHEKT_SAT_SYNC_PROP, JSON.stringify({ i: i, n: scope.length }));
  ui.alert('Sync CHEKT Satellite rows',
    (finished ? 'Finished ' : 'Paused at 4.5 min after ') + (i - start) + ' of ' + scope.length + ' row(s)' +
    (start ? ' (resumed at ' + (start + 1) + ')' : '') + '.\n\n' +
    'Full record (pins): ' + ok + '\nIdentity stub (no pins yet): ' + stub + '\nSkipped: ' + skip + '\nFailed: ' + fail +
    (notes.length ? '\n\n' + notes.join('\n') : '') +
    (finished
      ? '\n\nNext: Match addresses to index, then Publish CHEKT accounts. Rows that went out as a stub open no 2D map until Pass 1 runs and this sync runs again.'
      : '\n\nRun Sync CHEKT Satellite rows again to continue.'),
    ui.ButtonSet.OK);
}

// Camera pins moved to property-intel-records cameras/{hub}.json.
// This name stays so an older menu item does not recreate the tab.
function setupChektCamerasSheet() {
  SpreadsheetApp.getUi().alert(
    'CHEKT Cameras',
    'Camera pins are on the records bucket, next to each property index.\n\n' +
      'Delete the Chekt Cameras tab if it is still in this spreadsheet.\n' +
      'The Chekt account tab was not changed.',
    SpreadsheetApp.getUi().ButtonSet.OK);
}
