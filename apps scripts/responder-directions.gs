// ============================================================
// PROPERTY INTEL — Apps Script — responder-directions.gs
// RESPONDER DIRECTIONS — guidance routes for drone-test properties.
//
// A set of RESPONDER DIRECTIONS is an ordered route for ONE scenario: waypoints from an access
// point to a target element, so a responder can see how to get there. MANY per
// property — pool incident, intruder at the rear, and so on. Each row on the
// `responder-directions` tab is one set of directions.
//
// NOT THE SAME THING as plane.gs's "storyboard" field, which is the single
// approach record {alpha, ent_x, ent_y} — that is a camera fly-in, not guidance.
// In drone-test.gs that column is named Approach for exactly this reason.
//
// COORDINATE SPACE
// Waypoints are x,y PERCENTAGES on the NADIR image — the same space as element
// and concern pins, so the drone-test row's Nadir Bounds already geo-reference
// them. Conversion to lat/lng (and from there to GLB local metres via
// latlon_to_local, if a 3D viewer ever animates the path) is deterministic.
//
// PREREQUISITE — a route targets CONFIRMED elements, so the drone-test row for
// the property must have Pass 1 element pins AND Elements Reviewed ticked.
// This is gated, not advisory.
//
// REUSED (do not duplicate): fetchPinCatalog_ (plane.gs), fetchImageAsBase64,
// callBedrock, queryKnowledgeBase, writePlainCell (shared.gs),
// normalizeAccountType (config.gs), responderDirectionsPrompt_ /
// responderDirectionsRerunInstruction_ (prompts.gs), plus drone-test.gs's
// DT_SHEET / DT_COL_* / dtSheet_ / dtActiveRow_, and ELEMENT_REVIEW_URL (config.gs).
//
// ROUTE REVIEW — element-review.html now accepts `&route=` (a numbered polyline
// over the nadir, drawn under the element markers) and `&rationale=`. The route
// layer is additive: without those params the page behaves exactly as before,
// so element-only reviews are unaffected. That page lives in the v1 repo
// (jonahbourgeois1/property-intel) and is served from GitHub Pages — the patched
// copy must be committed and pushed before this link works.
// ============================================================

const RD_SHEET = 'responder-directions';

// ── Column map (1-indexed) — 9 columns, A..I ────────────────────────────────
// A Property Name · B Direction Name · C Trigger / Event · D Target Element
// E Start · F Route · G Route Reviewed ☑ · H Route Fixes · I Status
// There is NO link column: directions are published inside the property's own
// drone-test JSON and surfaced by a button in the viewer, so there is no
// separate address to hand out.
const RD_COL_PROPERTY = 1;  // A — must match a drone-test Property Name exactly
const RD_COL_NAME     = 2;  // B — "Pool incident", "Intruder — rear"
const RD_COL_TRIGGER  = 3;  // C — event description handed to the model
const RD_COL_TARGET   = 4;  // D — confirmed element pin id, or its catalog name
const RD_COL_START    = 5;  // E — blank/"entrance" = the approach entrance, else a pin id
const RD_COL_ROUTE    = 6;  // F — ordered waypoints JSON
const RD_COL_REVIEWED = 7;  // G — Route Reviewed checkbox
const RD_COL_FIXES    = 8;  // H — analyst correction note (feeds the rerun)
const RD_COL_STATUS   = 9;  // I

const RD_HEADERS = [
  'Property Name', 'Direction Name', 'Trigger / Event', 'Target Element',
  'Start', 'Route', 'Route Reviewed', 'Route Fixes', 'Status'
];

// Waypoint cap. Deliberately above PLANE_MAX_PINS (10) — a path needs more
// points than a pin list. Referenced by responderDirectionsPrompt_.
const RD_MAX_WAYPOINTS = 12;

// ── Sheet setup ──────────────────────────────────────────────────────────────

function setupDirectionsSheet() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(RD_SHEET);
  const created = !sheet;
  if (!sheet) sheet = ss.insertSheet(RD_SHEET);

  if (sheet.getMaxColumns() < RD_HEADERS.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), RD_HEADERS.length - sheet.getMaxColumns());
  }
  sheet.getRange(1, 1, 1, RD_HEADERS.length).setValues([RD_HEADERS]).setFontWeight('bold');
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(2);

  const lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.getRange(2, RD_COL_REVIEWED, lastRow - 1, 1).insertCheckboxes();

  ui.alert('Responder Directions',
    (created ? 'Created the "' + RD_SHEET + '" tab.' : 'Updated the "' + RD_SHEET + '" header row.') +
    '\n\nOne row per set of directions. Enter Property Name (matching the drone-test row exactly), ' +
    'Direction Name, Trigger / Event and Target Element, then run "Generate Directions".\n\n' +
    'The property\'s drone-test row must already have Pass 1 element pins with ' +
    '"Elements Reviewed" ticked — a route targets confirmed elements.',
    ui.ButtonSet.OK);
}

function ensureRdHeaders_(sheet) {
  for (let i = 0; i < RD_HEADERS.length; i++) {
    const cell = sheet.getRange(1, i + 1);
    if (!String(cell.getValue() || '').trim()) cell.setValue(RD_HEADERS[i]);
  }
}

function rdSheet_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(RD_SHEET);
  if (!sheet) {
    SpreadsheetApp.getUi().alert('Sheet "' + RD_SHEET + '" not found — run "Set Up responder-directions Sheet" first.');
    return null;
  }
  return sheet;
}

// ── Property lookup (into the drone-test tab) ────────────────────────────────
// Returns the source data a route needs, or { ok:false, reason } explaining
// precisely which prerequisite is missing.
function rdFindProperty_(propertyName) {
  const name = String(propertyName || '').trim();
  if (!name) return { ok: false, reason: 'no Property Name on this row' };

  const dt = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DT_SHEET);
  if (!dt) return { ok: false, reason: 'the "' + DT_SHEET + '" sheet does not exist' };

  const lastRow = dt.getLastRow();
  if (lastRow < 2) return { ok: false, reason: '"' + DT_SHEET + '" has no data rows' };
  const width = Math.max(dt.getLastColumn(), DT_COL_APPROACH);
  const rows  = dt.getRange(2, 1, lastRow - 1, width).getValues();

  const key = name.toLowerCase();
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (String(r[DT_COL_ACCOUNT - 1] || '').trim().toLowerCase() !== key) continue;

    const elementsRaw = String(r[DT_COL_ELEMENTS - 1] || '').trim();
    if (!elementsRaw || elementsRaw.indexOf('ERROR:') === 0) {
      return { ok: false, reason: 'drone-test row ' + (i + 2) + ' has no element pins — run Pass 1 first' };
    }
    if (r[DT_COL_REVIEWED - 1] !== true) {
      return { ok: false, reason: 'drone-test row ' + (i + 2) + ' is not marked "Elements Reviewed"' };
    }
    let pins;
    try { pins = JSON.parse(elementsRaw); } catch (e) {
      return { ok: false, reason: 'drone-test row ' + (i + 2) + ' has unparseable element pins' };
    }
    if (!Array.isArray(pins) || !pins.length) {
      return { ok: false, reason: 'drone-test row ' + (i + 2) + ' has an empty element pin set' };
    }

    const urls = {
      nadir:   String(r[DT_COL_NADIR_URL - 1]   || '').trim(),
      alpha:   String(r[DT_COL_ALPHA_URL - 1]   || '').trim(),
      bravo:   String(r[DT_COL_BRAVO_URL - 1]   || '').trim(),
      charlie: String(r[DT_COL_CHARLIE_URL - 1] || '').trim(),
      delta:   String(r[DT_COL_DELTA_URL - 1]   || '').trim()
    };
    const missing = Object.keys(urls).filter(function (k) { return !urls[k]; });
    if (missing.length) {
      return { ok: false, reason: 'drone-test row ' + (i + 2) + ' is missing image URLs: ' + missing.join(', ') };
    }

    let approach = null;
    const apRaw = String(r[DT_COL_APPROACH - 1] || '').trim();
    if (apRaw) { try { approach = JSON.parse(apRaw); } catch (e) { approach = null; } }

    return { ok: true, dtRow: i + 2, name: String(r[DT_COL_ACCOUNT - 1]).trim(),
             address: String(r[DT_COL_ADDRESS - 1] || '').trim(),
             siteNo: String(r[DT_COL_SITE_NO - 1] || '').trim(),
             accountType: normalizeAccountType(r[DT_COL_ACCOUNT_TYPE - 1]),
             urls: urls, pins: pins, approach: approach };
  }
  return { ok: false, reason: 'no "' + DT_SHEET + '" row with Property Name "' + name + '"' };
}

// ── Route parsing + validation ───────────────────────────────────────────────

// Strip fences, isolate the outermost JSON object, require a route array.
function parseDirections_(text) {
  if (!text) return null;
  let t = String(text).replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = t.indexOf('{'), end = t.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  t = t.substring(start, end + 1);
  let parsed;
  try { parsed = JSON.parse(t); } catch (e) {
    Logger.log('parseDirections_: JSON.parse failed — ' + e.message);
    return null;
  }
  if (!Array.isArray(parsed.route)) {
    Logger.log('parseDirections_: route missing or not an array');
    return null;
  }
  return parsed;
}

// Route validator. Element pins are validated by catalog id; a waypoint has no
// id at all — the seq number is its only identity — so validateElementPins_
// cannot be reused, it would discard every waypoint. Validates GEOMETRY and
// SEQUENCE instead: renumbers seq 1..N contiguously from input order, clamps
// coordinates, caps at RD_MAX_WAYPOINTS, and drops anything non-numeric.
function validateWaypoints_(route) {
  if (!Array.isArray(route)) return [];
  const out = [];
  for (let i = 0; i < route.length && out.length < RD_MAX_WAYPOINTS; i++) {
    const w = route[i] || {};
    const x = parseFloat(w.x), y = parseFloat(w.y);
    if (isNaN(x) || isNaN(y)) continue;
    const c = clampCoords(x, y);
    out.push({ seq: out.length + 1, x: c.x, y: c.y });
  }
  return out;
}

// Render a stored route as "seq N at (x, y)" lines for the rerun prompt.
function waypointsAsText_(routeRaw) {
  let route;
  try { route = JSON.parse(routeRaw); } catch (e) { return ''; }
  if (!Array.isArray(route) || !route.length) return '';
  return route.map(function (w) {
    return 'seq ' + w.seq + ' at (' + w.x + ', ' + w.y + ')';
  }).join('\n');
}

// Resolve the Target/Start cell to a description the model can act on.
// Accepts a confirmed element pin id, or a catalog name matching one of this
// property's confirmed pins. Start also accepts blank/"entrance".
function rdResolveAnchor_(raw, prop, catalog, isStart) {
  const s = String(raw || '').trim();
  const nameById = {};
  ((catalog && catalog.namesList) || []).forEach(function (n) { nameById[n.id] = n.name; });

  if (isStart && (!s || s.toLowerCase() === 'entrance')) {
    return { ok: true, text: 'the driveway entrance / main access point to the property, as visible in the images' };
  }
  if (!s) return { ok: false, reason: 'Target Element is empty' };

  const asId = parseInt(s, 10);
  let pin = null;
  if (!isNaN(asId)) {
    pin = prop.pins.filter(function (p) { return parseInt(p.id, 10) === asId; })[0] || null;
  } else {
    const key = s.toLowerCase();
    pin = prop.pins.filter(function (p) {
      return String(nameById[parseInt(p.id, 10)] || '').toLowerCase() === key;
    })[0] || null;
  }
  if (!pin) {
    const available = prop.pins.map(function (p) {
      return p.id + ' = ' + (nameById[parseInt(p.id, 10)] || '?');
    }).join(', ');
    return { ok: false, reason: '"' + s + '" is not a confirmed element on this property. Confirmed: ' + available };
  }
  const label = nameById[parseInt(pin.id, 10)] || ('element id ' + pin.id);
  return { ok: true, id: parseInt(pin.id, 10),
           text: label + ' (element id ' + pin.id + ') at (' + pin.x + ', ' + pin.y + ') on the nadir' };
}

// ── Route generation (shared core for first run AND rerun) ───────────────────

function runDirectionsCall_(sheet, row, trailingInstruction, statusVerb) {
  const prop = rdFindProperty_(sheet.getRange(row, RD_COL_PROPERTY).getValue());
  if (!prop.ok) {
    writePlainCell(sheet, row, RD_COL_STATUS, 'route BLOCKED: ' + prop.reason);
    return false;
  }

  const catalog = fetchPinCatalog_(prop.accountType);
  const prompt  = responderDirectionsPrompt_();
  const kbContext = queryKnowledgeBase('first responder property access route egress approach path obstructions');
  const fullPrompt = kbContext ? prompt + '\n\nREFERENCE CONTEXT FROM KNOWLEDGE BASE:\n' + kbContext : prompt;

  writePlainCell(sheet, row, RD_COL_STATUS, statusVerb + '...');
  SpreadsheetApp.flush();

  const viewDefs = [
    { key: 'nadir',   label: 'IMAGE 1 — NADIR (straight-down orthophoto view — the route is expressed on this image)' },
    { key: 'alpha',   label: 'IMAGE 2 — ALPHA (oblique, FRONT of the property)' },
    { key: 'bravo',   label: 'IMAGE 3 — BRAVO (oblique, RIGHT side of the property)' },
    { key: 'charlie', label: 'IMAGE 4 — CHARLIE (oblique, REAR of the property)' },
    { key: 'delta',   label: 'IMAGE 5 — DELTA (oblique, LEFT side of the property)' }
  ];
  const userContent = [];
  for (let i = 0; i < viewDefs.length; i++) {
    const v   = viewDefs[i];
    const url = prop.urls[v.key];
    const b64 = fetchImageAsBase64(url);
    if (!b64) {
      writePlainCell(sheet, row, RD_COL_STATUS, 'route FAILED: image fetch (' + v.key + ')');
      return false;
    }
    userContent.push({ type: 'text', text: v.label });
    userContent.push({ type: 'image', source: { type: 'base64', media_type: guessImageMediaType_(url), data: b64 } });
  }

  const nameById = {};
  catalog.namesList.forEach(function (n) { nameById[n.id] = n.name; });
  const confirmedText = prop.pins.map(function (p) {
    const id = parseInt(p.id, 10);
    return id + ' = ' + (nameById[id] || ('id ' + id)) + ' at (' + p.x + ', ' + p.y + ')';
  }).join('\n');

  userContent.push({ type: 'text',
    text: 'Property: ' + prop.name + ' — ' + prop.address + ' [' + prop.accountType + '].\n\n' +
          'CONFIRMED PROPERTY ELEMENTS (human-approved ground truth), as "id = name at (x, y)" on the nadir:\n' +
          confirmedText + '\n\n' + trailingInstruction });

  const result = callBedrock(fullPrompt, userContent, 1500);
  if (!result) {
    writePlainCell(sheet, row, RD_COL_STATUS, 'route FAILED: Bedrock call — see logs');
    return false;
  }
  const parsed = parseDirections_(result);
  if (!parsed) {
    Logger.log('SB route raw response (row ' + row + '): ' + result.substring(0, 600));
    writePlainCell(sheet, row, RD_COL_STATUS, 'route FAILED: JSON parse — see logs');
    return false;
  }

  const waypoints = validateWaypoints_(parsed.route);

  writePlainCell(sheet, row, RD_COL_ROUTE, waypoints.length ? JSON.stringify(waypoints) : '');
  sheet.getRange(row, RD_COL_REVIEWED).setValue(false); // a fresh route invalidates prior review
  writePlainCell(sheet, row, RD_COL_STATUS,
    waypoints.length
      ? 'route done (' + waypoints.length + ' waypoints) — awaiting review · ' +
        String(parsed.rationale || '').substring(0, 160)
      : 'route EMPTY — no traversable path reported. ' + String(parsed.rationale || '').substring(0, 160));
  SpreadsheetApp.flush();
  Logger.log('SB route: row ' + row + ' — ' + prop.name + ' [' + waypoints.length + ' waypoints]');
  return waypoints.length > 0;
}

// Ready when: Property Name + Target present AND Route (F) empty or a prior ERROR.
function rdRowReadyForDirections_(rowVals) {
  if (!String(rowVals[RD_COL_PROPERTY - 1] || '').trim()) return false;
  if (!String(rowVals[RD_COL_TARGET - 1] || '').trim()) return false;
  const route = String(rowVals[RD_COL_ROUTE - 1] || '').trim();
  return !route || route.indexOf('ERROR:') === 0;
}

function processDirectionsRow_(sheet, row) {
  const prop = rdFindProperty_(sheet.getRange(row, RD_COL_PROPERTY).getValue());
  if (!prop.ok) {
    writePlainCell(sheet, row, RD_COL_STATUS, 'route BLOCKED: ' + prop.reason);
    return false;
  }
  const catalog  = fetchPinCatalog_(prop.accountType);
  const scenario = String(sheet.getRange(row, RD_COL_NAME).getValue() || '').trim() || '(unnamed scenario)';
  const trigger  = String(sheet.getRange(row, RD_COL_TRIGGER).getValue() || '').trim();

  const target = rdResolveAnchor_(sheet.getRange(row, RD_COL_TARGET).getValue(), prop, catalog, false);
  if (!target.ok) { writePlainCell(sheet, row, RD_COL_STATUS, 'route BLOCKED: ' + target.reason); return false; }
  const start = rdResolveAnchor_(sheet.getRange(row, RD_COL_START).getValue(), prop, catalog, true);
  if (!start.ok) { writePlainCell(sheet, row, RD_COL_STATUS, 'route BLOCKED: start — ' + start.reason); return false; }

  const trailing =
    'SCENARIO: ' + scenario + (trigger ? '\nEVENT: ' + trigger : '') +
    '\nSTART: ' + start.text +
    '\nTARGET: ' + target.text +
    '\n\nProduce the ordered route from START to TARGET and return ONLY the JSON object described in your instructions.';
  return runDirectionsCall_(sheet, row, trailing, 'generating route');
}

function rerunDirectionsRow_(sheet, row) {
  const fixesNote = String(sheet.getRange(row, RD_COL_FIXES).getValue() || '').trim();
  if (!fixesNote) return 'no-fixes';

  const prop = rdFindProperty_(sheet.getRange(row, RD_COL_PROPERTY).getValue());
  if (!prop.ok) {
    writePlainCell(sheet, row, RD_COL_STATUS, 'route BLOCKED: ' + prop.reason);
    return false;
  }
  const catalog  = fetchPinCatalog_(prop.accountType);
  const scenario = String(sheet.getRange(row, RD_COL_NAME).getValue() || '').trim() || '(unnamed scenario)';

  const target = rdResolveAnchor_(sheet.getRange(row, RD_COL_TARGET).getValue(), prop, catalog, false);
  if (!target.ok) { writePlainCell(sheet, row, RD_COL_STATUS, 'route BLOCKED: ' + target.reason); return false; }
  const start = rdResolveAnchor_(sheet.getRange(row, RD_COL_START).getValue(), prop, catalog, true);
  if (!start.ok) { writePlainCell(sheet, row, RD_COL_STATUS, 'route BLOCKED: start — ' + start.reason); return false; }

  const currentRouteText = waypointsAsText_(String(sheet.getRange(row, RD_COL_ROUTE).getValue() || '').trim());
  const trailing = responderDirectionsRerunInstruction_(
    scenario, start.text, target.text, currentRouteText, fixesNote);
  return runDirectionsCall_(sheet, row, trailing, 'rerunning route');
}

// ── Route review link ────────────────────────────────────────────────────────
// Opens element-review.html with BOTH layers: the property's confirmed element
// pins (so you can see what the route passes) and this row's ordered waypoints
// drawn as a numbered polyline. The page renders the route only when &route= is
// present, so element-only reviews are unaffected.
//
// The model's rationale is recovered from the Status cell rather than stored in
// its own column — runDirectionsCall_ writes it after a ' · ' separator. If the
// rationale ever needs to be first-class, give it a column instead of parsing.
function buildDirectionsReviewUrl_(sheet, row) {
  const prop = rdFindProperty_(sheet.getRange(row, RD_COL_PROPERTY).getValue());
  if (!prop.ok) return { ok: false, reason: prop.reason };

  const routeRaw = String(sheet.getRange(row, RD_COL_ROUTE).getValue() || '').trim();
  if (!routeRaw || routeRaw.indexOf('ERROR:') === 0) {
    return { ok: false, reason: 'this row has no route yet — run "Generate Directions" first' };
  }
  let route;
  try { route = JSON.parse(routeRaw); } catch (e) {
    return { ok: false, reason: 'the Route cell is not valid JSON' };
  }
  if (!Array.isArray(route) || !route.length) {
    return { ok: false, reason: 'the Route cell holds an empty route' };
  }

  const status = String(sheet.getRange(row, RD_COL_STATUS).getValue() || '');
  const parts  = status.split(' \u00b7 ');
  const rationale = parts.length > 1 ? parts.slice(1).join(' \u00b7 ') : '';

  let url = ELEMENT_REVIEW_URL +
    '?nadir=' + encodeURIComponent(prop.urls.nadir) +
    '&pins='  + encodeURIComponent(JSON.stringify(prop.pins)) +
    '&route=' + encodeURIComponent(JSON.stringify(route)) +
    '&type='  + encodeURIComponent(prop.accountType);
  if (prop.address) url += '&addr=' + encodeURIComponent(prop.address);
  if (rationale)    url += '&rationale=' + encodeURIComponent(rationale);
  url = withReviewSiteNo_(url, prop.siteNo);
  return { ok: true, url: url };
}

function openDirectionsReviewForActiveRowRD() {
  const sheet = rdSheet_();
  if (!sheet) return;
  const row = dtActiveRow_(RD_SHEET);
  if (!row) return;

  const built = buildDirectionsReviewUrl_(sheet, row);
  if (!built.ok) {
    SpreadsheetApp.getUi().alert('Route Review', 'Cannot open review for row ' + row + ':\n\n' +
      built.reason, SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }
  const label = String(sheet.getRange(row, RD_COL_NAME).getValue() || '').trim() || ('row ' + row);
  const html = HtmlService.createHtmlOutput(
      '<div style="font-family:system-ui,-apple-system,sans-serif;padding:14px 16px;font-size:14px;line-height:1.5">' +
      '<p style="margin:0 0 12px">Route review for<br><b>' + label.replace(/</g, '&lt;') + '</b></p>' +
      '<p style="margin:0 0 16px"><a href="' + built.url + '" target="_blank" rel="noopener" ' +
      'style="display:inline-block;background:#ffd23f;color:#1b2027;font-weight:600;' +
      'text-decoration:none;padding:9px 16px;border-radius:8px">Open route review &#8599;</a></p>' +
      '<p style="margin:0;color:#667380;font-size:12px">Opens in a new tab, showing the route over the ' +
      'confirmed element pins. Tick "Route Reviewed" once it looks right, or write a "Route Fixes" ' +
      'note and rerun.</p></div>')
    .setWidth(360).setHeight(190);
  SpreadsheetApp.getUi().showModalDialog(html, 'Route Review');
}

// ── Publication ──────────────────────────────────────────────────────────────
// Returns the REVIEWED sets of directions for one property, in sheet order,
// shaped for the published JSON. Called by processDroneTestSheet_ in
// drone-test.gs — directions ride inside the property record rather than in
// files of their own, so the viewer needs one fetch and there is no orphan
// risk if a property is renamed.
//
// Unreviewed rows are skipped on purpose: an AI-drawn path through a property
// is exactly the kind of thing that must not reach a responder unchecked. The
// count of skipped rows is returned so the sync can report it.
function rdDirectionsForProperty_(propertyName) {
  const out = { directions: [], skipped: 0 };
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(RD_SHEET);
  if (!sheet) return out;
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return out;

  const key  = String(propertyName || '').trim().toLowerCase();
  if (!key) return out;
  const rows = sheet.getRange(2, 1, lastRow - 1, RD_COL_STATUS).getValues();

  rows.forEach(function (r) {
    if (String(r[RD_COL_PROPERTY - 1] || '').trim().toLowerCase() !== key) return;
    const routeRaw = String(r[RD_COL_ROUTE - 1] || '').trim();
    if (!routeRaw || routeRaw.indexOf('ERROR:') === 0) { out.skipped++; return; }
    if (r[RD_COL_REVIEWED - 1] !== true) { out.skipped++; return; }
    let route;
    try { route = JSON.parse(routeRaw); } catch (e) { out.skipped++; return; }
    if (!Array.isArray(route) || !route.length) { out.skipped++; return; }
    out.directions.push({
      name:    String(r[RD_COL_NAME - 1] || '').trim(),
      trigger: String(r[RD_COL_TRIGGER - 1] || '').trim(),
      target:  String(r[RD_COL_TARGET - 1] || '').trim(),
      start:   String(r[RD_COL_START - 1] || '').trim() || 'entrance',
      route:   route
    });
  });
  return out;
}

// ── Menu entry points ────────────────────────────────────────────────────────

function generateDirectionsRD() {
  const sheet = rdSheet_();
  if (!sheet) return;
  ensureRdHeaders_(sheet);

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) { SpreadsheetApp.getUi().alert(RD_SHEET + ' is empty.'); return; }
  const width = Math.max(sheet.getLastColumn(), RD_COL_STATUS);
  const data  = sheet.getRange(2, 1, lastRow - 1, width).getValues();

  const readyRows = [];
  data.forEach(function (r, i) { if (rdRowReadyForDirections_(r)) readyRows.push(i + 2); });
  if (!readyRows.length) {
    SpreadsheetApp.getUi().alert('Responder Directions',
      'No rows ready.\n(A row is ready when it has a Property Name and a Target Element, and the Route cell is empty.)',
      SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }

  let done = 0, failed = 0, attempted = 0;
  for (let i = 0; i < readyRows.length; i++) {
    if (attempted >= PLANE_DESC_BATCH) break;
    attempted++;
    try { if (processDirectionsRow_(sheet, readyRows[i])) done++; else failed++; }
    catch (e) {
      failed++;
      Logger.log('SB route ERROR row ' + readyRows[i] + ': ' + e.message);
      writePlainCell(sheet, readyRows[i], RD_COL_STATUS, 'route FAILED: ' + e.message.substring(0, 80));
    }
    Utilities.sleep(2000);
  }

  const remaining = readyRows.length - attempted + failed;
  SpreadsheetApp.getUi().alert('Responder Directions',
    'Routes generated: ' + done + '\nFailed/blocked: ' + failed +
    (remaining > 0 ? '\nRemaining: ' + remaining + ' — run again to continue.'
                   : '\nAll ready rows processed.') +
    (done > 0 ? '\n\nReview each route, then tick "Route Reviewed" — or write a "Route Fixes" note and rerun.' : ''),
    SpreadsheetApp.getUi().ButtonSet.OK);
}

function generateDirectionsForActiveRowRD() {
  const sheet = rdSheet_();
  if (!sheet) return;
  const row = dtActiveRow_(RD_SHEET);
  if (!row) return;

  const existing = String(sheet.getRange(row, RD_COL_ROUTE).getValue() || '').trim();
  if (existing && existing.indexOf('ERROR:') !== 0) {
    const ui = SpreadsheetApp.getUi();
    const ans = ui.alert('Regenerate?',
      'Row ' + row + ' already has a route.\nRegenerate it?\n\n(This also clears the Route Reviewed checkbox.)',
      ui.ButtonSet.YES_NO);
    if (ans !== ui.Button.YES) return;
  }

  const ok = processDirectionsRow_(sheet, row);
  SpreadsheetApp.getUi().alert('Responder Directions',
    ok ? 'Route written for row ' + row + '.\n\nReview it, then tick "Route Reviewed".'
       : 'Route generation FAILED or was BLOCKED for row ' + row +
         '.\nSee the Status column — it names the missing prerequisite.',
    SpreadsheetApp.getUi().ButtonSet.OK);
}

function rerunDirectionsForActiveRowRD() {
  const sheet = rdSheet_();
  if (!sheet) return;
  const row = dtActiveRow_(RD_SHEET);
  if (!row) return;

  const outcome = rerunDirectionsRow_(sheet, row);
  if (outcome === 'no-fixes') {
    SpreadsheetApp.getUi().alert('Rerun Route',
      'Row ' + row + ' has no "Route Fixes" note.\nWrite the correction you want applied in column H, then rerun.',
      SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }
  SpreadsheetApp.getUi().alert('Rerun Route',
    outcome === true
      ? 'Route re-generated from your Route Fixes note for row ' + row +
        '.\n\nYour note is kept for the record. Review the new route, then tick "Route Reviewed".'
      : 'Rerun FAILED or was BLOCKED for row ' + row + '.\nSee the Status column.',
    SpreadsheetApp.getUi().ButtonSet.OK);
}

function rerunDirectionsBatchRD() {
  const sheet = rdSheet_();
  if (!sheet) return;
  ensureRdHeaders_(sheet);

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) { SpreadsheetApp.getUi().alert(RD_SHEET + ' is empty.'); return; }
  const width = Math.max(sheet.getLastColumn(), RD_COL_STATUS);
  const data  = sheet.getRange(2, 1, lastRow - 1, width).getValues();

  const flagged = [];
  data.forEach(function (r, i) {
    const note     = String(r[RD_COL_FIXES - 1] || '').trim();
    const reviewed = r[RD_COL_REVIEWED - 1] === true;
    if (note && !reviewed) flagged.push(i + 2);
  });
  if (!flagged.length) {
    SpreadsheetApp.getUi().alert('Rerun Routes (All Flagged)',
      'No flagged rows.\n(A row is flagged when it has a "Route Fixes" note AND "Route Reviewed" is unchecked.)',
      SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }

  let done = 0, failed = 0, attempted = 0;
  for (let i = 0; i < flagged.length; i++) {
    if (attempted >= PLANE_DESC_BATCH) break;
    attempted++;
    try { if (rerunDirectionsRow_(sheet, flagged[i]) === true) done++; else failed++; }
    catch (e) {
      failed++;
      Logger.log('SB rerun ERROR row ' + flagged[i] + ': ' + e.message);
      writePlainCell(sheet, flagged[i], RD_COL_STATUS, 'rerun FAILED: ' + e.message.substring(0, 80));
    }
    Utilities.sleep(2000);
  }

  const remaining = flagged.length - attempted + failed;
  SpreadsheetApp.getUi().alert('Rerun Routes (All Flagged)',
    'Completed: ' + done + '\nFailed/blocked: ' + failed +
    (remaining > 0 ? '\nRemaining: ' + remaining + ' — run again to continue.'
                   : '\nAll flagged rows processed.') +
    '\n\n"Route Fixes" notes are kept for the record (never cleared).',
    SpreadsheetApp.getUi().ButtonSet.OK);
}