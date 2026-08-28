// ============================================================
// PROPERTY INTEL — Apps Script — drone-test.gs
// Drone-capture test surface. Mirrors the Plane pipeline against its own
// `drone-test` tab so drone-mapping experiments can never write to, or be
// broken by, the production Plane sheet.
//
// CONTAINS (in order)
//   1. Config: DT_SHEET, the 30-column DT_COL_* map, DT_HEADERS, job keys
//   2. Sheet setup: setupDroneTestSheet, ensureDtHeaders_, dtSheet_
//   3. Capture check (column F)
//   4. Job control: triggers, cancel, status
//   5. Stage A — 3D models (/clip)
//   6. Stage B — property images (/render)
//   7. Approach record (plane.gs calls this 'storyboard')
//   8. Pass 1 — element pins, review link, rerun from Nadir Fixes
//   9. Pass 2 — concern pins + oblique descriptions + considerations
//  10. GitHub sync -> data/drone-test/{viewId}.json (carries the reviewed
//      responder directions inline; routes live in responder-directions.gs)
//      PLUS data/cameras/json/{hubId}.json when a cameras file
//      already exists (or cameras[] is still on the live view record).
//      Never attaches cameras[] to the view record. Stills stay in git.
//
// WHY THIS IS A FORK, NOT A WRAPPER
// plane.gs's per-row workers (processStoryboardRow_, processElementPinsRow_,
// runPass2Call_) take `sheet` as an argument but read PLANE_COL_* internally,
// so they can only run against a sheet whose column POSITIONS match Plane's.
// This sheet puts Capture at E, which shifts every later column, so those
// workers are re-implemented here with DT_COL_* offsets. Deliberate isolation,
// same reasoning as responder-intel.gs — at the cost that plane.gs
// improvements do not flow here automatically.
//
// WHAT IT REUSES (sheet-agnostic — do NOT duplicate these)
//   callV2_, callPlaneEligibility_, buildStoryboardViewerUrl_   (plane.gs)
//   geocodeAddress, writePlainCell                              (shared.gs)
//   normalizeAccountType                                        (config.gs)
//   BATCH_SIZE, V2_ELIG_BATCH, V2_MAX_POLLS, V2_FIRE_PER_TICK,
//   V2_VIEWER_BASE                                              (config.gs)
//
// CAPTURE SELECTION — READ THIS
// Nothing in the AWS pipeline accepts a capture id. /clip and /render select
// the newest capture covering the parcel (clip_parcel.load_captures, which as
// of 2026-08-06 accepts type in ("plane","drone")). So column E is an
// EXPECTATION, not an input: the Lambdas report which capture they used and
// column F records match / MISMATCH. Forcing a capture would need a new
// Lambda parameter.
//
// JOB STATE IS SEPARATE FROM PLANE'S
// Own Script Property keys (dtClipJob / dtImgJob) and own trigger handler
// names (pollClipDT_ / imagesTickDT_). This is load-bearing: sharing
// plane.gs's planeClipJobV2 / planeImgJobV2 or its handler names would make a
// drone-test run write its clip and render results onto the Plane sheet.
//
// ISOLATION IS SHEET-LEVEL, NOT S3-LEVEL
// The GLB and renders are keyed by (capture, taxlot), not by which sheet
// asked, so drone-test shares those artifacts with the Plane sheet whenever
// both point at the same parcel and capture.
//
// MENU (add to menu.gs, before .addToUi())
//   .addSubMenu(SpreadsheetApp.getUi().createMenu('Drone Test')
//     .addItem('Set Up drone-test Sheet',             'setupDroneTestSheet')
//     .addItem('Generate 3D Models',                  'generate3DModelsDT')
//     .addItem('Generate 3D Models (This Row)',       'generate3DModelsForActiveRowDT')
//     .addItem('Generate Property Images',            'generateImagesDT')
//     .addItem('Generate Property Images (This Row)', 'generateImagesForActiveRowDT')
//     .addItem('Generate Approach',                   'generateApproachDT')
//     .addItem('Generate Approach (This Row)',        'generateApproachForActiveRowDT')
//     .addItem('Element Pins — Pass 1',               'generateElementPinsDT')
//     .addItem('Element Pins — Pass 1 (This Row)',    'generateElementPinsForActiveRowDT')
//     .addItem('Open Element Review (This Row)',      'openElementReviewForActiveRowDT')
//     .addItem('Backfill Nadir Bounds (This Row)',     'backfillNadirBoundsForActiveRowDT')
//     .addItem('Rerun Pins from Fixes (This Row)',    'rerunElementPinsForActiveRowDT')
//     .addItem('Rerun Pins from Fixes (Flagged)',     'rerunElementPinsBatchDT')
//     .addItem('Pass 2 — Concerns + Descriptions',    'generatePass2DT')
//     .addItem('Pass 2 (This Row)',                   'generatePass2ForActiveRowDT')
//     .addItem('Check Job Status',                    'checkDroneTestJobStatus')
//     .addItem('Cancel Jobs',                         'cancelDroneTestJobs')
//     .addItem('Sync This Row to GitHub',             'processDroneTestForActiveRowDT')
//     .addItem('Sync drone-test to GitHub',           'processDroneTestSheet'))
// ============================================================

const DT_SHEET = 'drone-test';

// ── Column map (1-indexed) — 30 columns, A..AD ───────────────────────────────
// A Account Type · B Property Name · C Property Address · D HOA
// E Capture · F Capture Check · G Taxlot · H Lat · I Lng · J Upload Date
// K Nadir URL · L Nadir Bounds · M Alpha URL · N Bravo URL · O Charlie URL
// P Delta URL · Q 360 View URL · R Nadir Elements · S Elements Reviewed ☑
// T Nadir Fixes · U Nadir Concerns · V Alpha Desc · W Bravo Desc
// X Charlie Desc · Y Delta Desc · Z Responder Considerations
// AA Information Needing Clarification · AB FR Link · AC Status · AD Approach
const DT_COL_ACCOUNT_TYPE  = 1;   // A
const DT_COL_ACCOUNT       = 2;   // B
const DT_COL_ADDRESS       = 3;   // C
const DT_COL_HOA           = 4;   // D
const DT_COL_CAPTURE       = 5;   // E — expected drone mapping id (operator types this)
const DT_COL_CAPTURE_CHECK = 6;   // F — written by the script: match / MISMATCH
const DT_COL_TAXLOT        = 7;   // G
const DT_COL_LAT           = 8;   // H
const DT_COL_LNG           = 9;   // I
const DT_COL_UPLOAD_DATE   = 10;  // J
const DT_COL_NADIR_URL     = 11;  // K
const DT_COL_NADIR_BOUNDS  = 12;  // L
const DT_COL_ALPHA_URL     = 13;  // M
const DT_COL_BRAVO_URL     = 14;  // N
const DT_COL_CHARLIE_URL   = 15;  // O
const DT_COL_DELTA_URL     = 16;  // P
const DT_COL_VIEWER360     = 17;  // Q
const DT_COL_ELEMENTS      = 18;  // R — element pins JSON (Pass 1)
const DT_COL_REVIEWED      = 19;  // S — Elements Reviewed checkbox (Pass 2 gate)
const DT_COL_FIXES         = 20;  // T — Nadir Fixes free text (rerun input)
const DT_COL_CONCERNS      = 21;  // U — concern pins JSON (Pass 2)
const DT_COL_ALPHA_DESC    = 22;  // V
const DT_COL_BRAVO_DESC    = 23;  // W
const DT_COL_CHARLIE_DESC  = 24;  // X
const DT_COL_DELTA_DESC    = 25;  // Y
const DT_COL_CONSIDER      = 26;  // Z
const DT_COL_CLARIFY       = 27;  // AA
const DT_COL_FR_LINK       = 28;  // AB
const DT_COL_STATUS        = 29;  // AC
const DT_COL_APPROACH    = 30;  // AD
const DT_COL_NADIR_LOCAL = 31;  // AE — nadir crop corners in local model metres
const DT_COL_SITE_NO     = 32;  // AF — optional. Satellite site_no so this row merges onto the production hub instead of hashing Property Name. Append-only; do not insert.

const DT_HEADERS = [
  'Account Type', 'Property Name', 'Property Address', 'HOA',
  'Capture', 'Capture Check', 'Taxlot', 'Lat', 'Lng', 'Upload Date',
  'Nadir URL', 'Nadir Bounds', 'Alpha URL', 'Bravo URL', 'Charlie URL',
  'Delta URL', '360 View URL', 'Nadir Elements', 'Elements Reviewed',
  'Nadir Fixes', 'Nadir Concerns', 'Alpha Description', 'Bravo Description',
  'Charlie Description', 'Delta Description', 'Responder Considerations',
  'Information Needing Clarification', 'FR Link', 'Status', 'Approach',
  'Nadir Local', 'Site No'
];

const DT_IMG_COLS = {
  nadir:   DT_COL_NADIR_URL,
  alpha:   DT_COL_ALPHA_URL,
  bravo:   DT_COL_BRAVO_URL,
  charlie: DT_COL_CHARLIE_URL,
  delta:   DT_COL_DELTA_URL
};

// Job state + trigger names — deliberately distinct from plane.gs's.
const DT_CLIP_JOB_KEY = 'dtClipJob';
const DT_IMG_JOB_KEY  = 'dtImgJob';
const DT_CLIP_HANDLER = 'pollClipDT_';
const DT_IMG_HANDLER  = 'imagesTickDT_';

// ── Sheet setup ──────────────────────────────────────────────────────────────

// Create the drone-test tab (or bring an existing one up to layout): writes
// the header row, freezes it, and turns Elements Reviewed into real
// checkboxes for existing data rows. Safe to re-run — it only writes headers
// and never touches data cells.
function setupDroneTestSheet() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(DT_SHEET);
  const created = !sheet;
  if (!sheet) sheet = ss.insertSheet(DT_SHEET);

  if (sheet.getMaxColumns() < DT_HEADERS.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), DT_HEADERS.length - sheet.getMaxColumns());
  }
  sheet.getRange(1, 1, 1, DT_HEADERS.length).setValues([DT_HEADERS]).setFontWeight('bold');
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(3);

  const lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.getRange(2, DT_COL_REVIEWED, lastRow - 1, 1).insertCheckboxes();

  ui.alert('Drone Test',
    (created ? 'Created the "' + DT_SHEET + '" tab.' : 'Updated the "' + DT_SHEET + '" header row.') +
    '\n\n' + DT_HEADERS.length + ' columns, A..AF. Enter Account Type, Property Name, ' +
    'Property Address, HOA, expected Capture (column E), and Site No (AF, the satellite ' +
    'site_no so this row joins the production index). Then run "Generate 3D Models".',
    ui.ButtonSet.OK);
}

// Fill any blank header cell without disturbing existing ones.
function ensureDtHeaders_(sheet) {
  for (let i = 0; i < DT_HEADERS.length; i++) {
    const cell = sheet.getRange(1, i + 1);
    if (!String(cell.getValue() || '').trim()) cell.setValue(DT_HEADERS[i]);
  }
}

// Returns the active data row on `expectedName`, or null after alerting with a
// precise reason. Two bugs this fixes: the old guard compared tab names
// case- and whitespace-sensitively, and it read getActiveCell() from the
// looked-up sheet rather than the ACTIVE one (which returns a stale cell when
// that sheet is not focused). It also names the tab you are actually on.
function dtActiveRow_(expectedName) {
  const ui     = SpreadsheetApp.getUi();
  const active = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const name   = String(active.getName() || '').trim();
  if (name.toLowerCase() !== String(expectedName).trim().toLowerCase()) {
    ui.alert('Wrong sheet',
      'This action works on the "' + expectedName + '" tab, but the active tab is "' + name + '".\n\n' +
      'Click a cell on the row you want, then run it from the Property Intel menu. ' +
      'Running it from the Apps Script editor will not work — the editor has no active tab.',
      ui.ButtonSet.OK);
    return null;
  }
  const row = active.getActiveCell().getRow();
  if (row < 2) { ui.alert('Select a data row', 'Row 1 is the header.', ui.ButtonSet.OK); return null; }
  return row;
}

function dtSheet_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DT_SHEET);
  if (!sheet) {
    SpreadsheetApp.getUi().alert('Sheet "' + DT_SHEET + '" not found — run "Set Up drone-test Sheet" first.');
    return null;
  }
  return sheet;
}

// ── Capture check (column F) ─────────────────────────────────────────────────
// Records whether the capture the Lambda actually used matches column E.
// `actual` is the capture id reported by /clip or /render (may be '' / null).
function dtCaptureCheck_(sheet, row, actual) {
  const expected = String(sheet.getRange(row, DT_COL_CAPTURE).getValue() || '').trim();
  const got      = String(actual || '').trim();
  let verdict;
  if (!got)           verdict = 'no capture reported';
  else if (!expected) verdict = 'no expectation set (used ' + got + ')';
  else if (expected === got) verdict = 'match';
  else                verdict = 'MISMATCH: expected ' + expected + ', used ' + got;
  writePlainCell(sheet, row, DT_COL_CAPTURE_CHECK, verdict);
  return verdict.indexOf('MISMATCH') !== 0;
}

// ── Job control ──────────────────────────────────────────────────────────────

function dtSetTrigger_(handler) {
  dtClearTrigger_(handler);
  ScriptApp.newTrigger(handler).timeBased().everyMinutes(1).create();
}

function dtClearTrigger_(handler) {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === handler) ScriptApp.deleteTrigger(t);
  });
}

function cancelDroneTestJobs() {
  dtClearTrigger_(DT_CLIP_HANDLER);
  dtClearTrigger_(DT_IMG_HANDLER);
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty(DT_CLIP_JOB_KEY);
  props.deleteProperty(DT_IMG_JOB_KEY);
  SpreadsheetApp.getActiveSpreadsheet().toast('drone-test jobs cancelled.');
}

function checkDroneTestJobStatus() {
  const props = PropertiesService.getScriptProperties();
  const clip  = props.getProperty(DT_CLIP_JOB_KEY);
  const img   = props.getProperty(DT_IMG_JOB_KEY);
  const lines = [];
  if (clip) {
    const j = JSON.parse(clip);
    lines.push('3D Models: generating (' + j.batch.properties.length +
               ' rows, poll ' + j.polls + '/' + V2_MAX_POLLS + ')');
  } else lines.push('3D Models: no job running');
  if (img) {
    const j = JSON.parse(img);
    const c = { pending: 0, fired: 0, done: 0, error: 0 };
    j.items.forEach(function (it) { c[it.state] = (c[it.state] || 0) + 1; });
    lines.push('Images: pending ' + c.pending + ', rendering ' + c.fired +
               ', done ' + c.done + ', error ' + c.error);
  } else lines.push('Images: no job running');
  SpreadsheetApp.getUi().alert('drone-test Job Status', lines.join('\n'),
                               SpreadsheetApp.getUi().ButtonSet.OK);
}

// ── STAGE A — 3D MODELS (/clip) ──────────────────────────────────────────────
// Resolves taxlot + coords for rows that lack them (batched /eligibility, with
// a geocode fallback for coords), then convergent-polls /clip until every
// parcel's GLB is cached. Writes the model-viewer link to Q and the capture
// check to F.

function generate3DModelsDT() {
  generate3DModelsDT_(null);
}

function generate3DModelsForActiveRowDT() {
  const sheet = dtSheet_();
  if (!sheet) return;
  const row = dtActiveRow_(DT_SHEET);
  if (!row) return;
  const address = String(sheet.getRange(row, DT_COL_ADDRESS).getValue() || '').trim();
  if (!address) {
    SpreadsheetApp.getUi().alert('Row ' + row + ' has no Property Address.');
    return;
  }
  const existing = String(sheet.getRange(row, DT_COL_VIEWER360).getValue() || '').trim();
  if (existing) {
    const ans = SpreadsheetApp.getUi().alert('Regenerate?',
      'Row ' + row + ' already has a 3D viewer URL.\nQueue clip again for:\n' + address + '?',
      SpreadsheetApp.getUi().ButtonSet.YES_NO);
    if (ans !== SpreadsheetApp.getUi().Button.YES) return;
  }
  generate3DModelsDT_([row]);
}

function generate3DModelsDT_(onlyRows) {
  const sheet = dtSheet_();
  if (!sheet) return;
  ensureDtHeaders_(sheet);

  if (PropertiesService.getScriptProperties().getProperty(DT_CLIP_JOB_KEY)) {
    SpreadsheetApp.getUi().alert('drone-test 3D Models',
      'A 3D-model job is already running. Use Check Job Status, or Cancel Jobs first.',
      SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) { SpreadsheetApp.getUi().alert(DT_SHEET + ' is empty.'); return; }
  const width = Math.max(sheet.getLastColumn(), DT_COL_APPROACH);
  const data  = sheet.getRange(2, 1, lastRow - 1, width).getValues();

  const rows = [], needTaxlot = [], byRow = {};
  data.forEach(function (r, i) {
    const address = String(r[DT_COL_ADDRESS - 1] || '').trim();
    if (!address) return;
    const row  = i + 2;
    if (onlyRows && onlyRows.indexOf(row) === -1) return;
    const item = { row: row, address: address,
                   taxlot: String(r[DT_COL_TAXLOT - 1] || '').trim() };
    rows.push(item);
    byRow[row] = item;
    if (!item.taxlot) needTaxlot.push({ rowIndex: row, address: address });
  });
  if (!rows.length) {
    SpreadsheetApp.getUi().alert(onlyRows
      ? 'Row ' + onlyRows[0] + ' has no Property Address.'
      : 'No ' + DT_SHEET + ' rows with an address.');
    return;
  }

  // Taxlot + coords via the eligibility Lambda, one retry on a cold start.
  for (let i = 0; i < needTaxlot.length; i += V2_ELIG_BATCH) {
    const chunk = needTaxlot.slice(i, i + V2_ELIG_BATCH);
    let results;
    try {
      results = callPlaneEligibility_(chunk);
    } catch (e) {
      Logger.log('DT eligibility chunk failed (' + e.message + ') — retrying once');
      Utilities.sleep(2000);
      try {
        results = callPlaneEligibility_(chunk);
      } catch (e2) {
        chunk.forEach(function (c) {
          writePlainCell(sheet, c.rowIndex, DT_COL_STATUS,
            'taxlot lookup FAILED: ' + e2.message.substring(0, 80));
        });
        continue;
      }
    }
    results.forEach(function (res) {
      const r = byRow[res.rowIndex];
      if (!r) return;
      if (res.eligible && res.taxlot) {
        r.taxlot = String(res.taxlot);
        sheet.getRange(r.row, DT_COL_TAXLOT).setValue(r.taxlot);
        if (res.lat && res.lng) {
          sheet.getRange(r.row, DT_COL_LAT).setValue(res.lat);
          sheet.getRange(r.row, DT_COL_LNG).setValue(res.lng);
        }
        // Eligibility reports the TILE capture — an early signal only; the
        // authoritative check is the GLB capture from /clip below.
        if (res.capture) dtCaptureCheck_(sheet, r.row, res.capture);
      } else {
        writePlainCell(sheet, r.row, DT_COL_STATUS, 'not eligible: ' + (res.reason || '?'));
      }
    });
  }

  // Geocode fallback — Stage B needs coordinates.
  rows.forEach(function (r) {
    if (!r.taxlot) return;
    if (!isNaN(parseFloat(sheet.getRange(r.row, DT_COL_LAT).getValue()))) return;
    const c = geocodeAddress(r.address);
    if (c) {
      sheet.getRange(r.row, DT_COL_LAT).setValue(c.lat);
      sheet.getRange(r.row, DT_COL_LNG).setValue(c.lng);
    }
  });

  const props = rows.filter(function (r) { return r.taxlot; }).map(function (r) {
    const p   = { rowIndex: r.row, taxlot: r.taxlot };
    const lat = parseFloat(sheet.getRange(r.row, DT_COL_LAT).getValue());
    const lng = parseFloat(sheet.getRange(r.row, DT_COL_LNG).getValue());
    if (!isNaN(lat) && !isNaN(lng)) { p.lat = lat; p.lng = lng; }
    return p;
  });
  if (!props.length) {
    SpreadsheetApp.getUi().alert(onlyRows
      ? 'Row ' + onlyRows[0] + ' has no taxlot — see the Status column.'
      : 'No rows with a taxlot — see the Status column.');
    return;
  }

  const batch = { properties: props };
  const res = callV2_('/clip', batch);
  if (res.code === 200 && res.body && res.body.results) {
    writeClipResultsDT_(sheet, res.body.results);
    SpreadsheetApp.getActiveSpreadsheet().toast(
      '3D models: complete (' + res.body.results.length + ' rows).');
    return;
  }
  PropertiesService.getScriptProperties()
    .setProperty(DT_CLIP_JOB_KEY, JSON.stringify({ batch: batch, polls: 0 }));
  dtSetTrigger_(DT_CLIP_HANDLER);
  props.forEach(function (p) {
    writePlainCell(sheet, p.rowIndex, DT_COL_STATUS, 'generating 3D model...');
  });
  SpreadsheetApp.getActiveSpreadsheet().toast(
    '3D models: generating ' + props.length + ' — checking every minute.');
}

function pollClipDT_() {
  const propsSvc = PropertiesService.getScriptProperties();
  const raw = propsSvc.getProperty(DT_CLIP_JOB_KEY);
  if (!raw) { dtClearTrigger_(DT_CLIP_HANDLER); return; }
  const job   = JSON.parse(raw);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DT_SHEET);
  if (!sheet) { dtClearTrigger_(DT_CLIP_HANDLER); return; }

  const res = callV2_('/clip', job.batch);
  if (res.code === 200 && res.body && res.body.results) {
    writeClipResultsDT_(sheet, res.body.results);
    propsSvc.deleteProperty(DT_CLIP_JOB_KEY);
    dtClearTrigger_(DT_CLIP_HANDLER);
    SpreadsheetApp.getActiveSpreadsheet().toast('drone-test 3D models: complete.');
    return;
  }
  job.polls += 1;
  if (job.polls >= V2_MAX_POLLS) {
    propsSvc.deleteProperty(DT_CLIP_JOB_KEY);
    dtClearTrigger_(DT_CLIP_HANDLER);
    job.batch.properties.forEach(function (p) {
      writePlainCell(sheet, p.rowIndex, DT_COL_STATUS,
        '3D model TIMED OUT — check CloudWatch (plane-parcel-clip)');
    });
    return;
  }
  propsSvc.setProperty(DT_CLIP_JOB_KEY, JSON.stringify(job));
}

function writeClipResultsDT_(sheet, results) {
  results.forEach(function (r) {
    if (!r.rowIndex) return;
    if (r.ok) {
      sheet.getRange(r.rowIndex, DT_COL_VIEWER360).setValue(V2_VIEWER_BASE + r.glb_url);
      const ok = dtCaptureCheck_(sheet, r.rowIndex, r.capture);
      writePlainCell(sheet, r.rowIndex, DT_COL_STATUS,
        '3D model ' + r.status + ' (' + (r.capture || '') + ')' +
        (ok ? '' : ' — CAPTURE MISMATCH, see column F'));
    } else {
      writePlainCell(sheet, r.rowIndex, DT_COL_STATUS, '3D model FAILED: ' + (r.reason || '?'));
    }
  });
}

// ── STAGE B — PROPERTY IMAGES (/render) ──────────────────────────────────────
// Requires Stage A (taxlot in G, coords in H/I, cached GLB). Fires each render
// async (202) and probes with {probe:true} — a pure S3 status check with no
// side effects, so it never re-renders. Fills K/M/N/O/P, bounds into L, and
// re-checks the capture from the probe's capture_3d.

function generateImagesDT() {
  generateImagesDT_(null);
}

function generateImagesForActiveRowDT() {
  const sheet = dtSheet_();
  if (!sheet) return;
  const row = dtActiveRow_(DT_SHEET);
  if (!row) return;
  const address = String(sheet.getRange(row, DT_COL_ADDRESS).getValue() || '').trim();
  if (!address) {
    SpreadsheetApp.getUi().alert('Row ' + row + ' has no Property Address.');
    return;
  }
  const existing = String(sheet.getRange(row, DT_COL_NADIR_URL).getValue() || '').trim();
  if (existing) {
    const ans = SpreadsheetApp.getUi().alert('Regenerate?',
      'Row ' + row + ' already has image URLs.\nQueue a new render for:\n' + address + '?',
      SpreadsheetApp.getUi().ButtonSet.YES_NO);
    if (ans !== SpreadsheetApp.getUi().Button.YES) return;
  }
  generateImagesDT_([row]);
}

function generateImagesDT_(onlyRows) {
  const sheet = dtSheet_();
  if (!sheet) return;
  ensureDtHeaders_(sheet);

  if (PropertiesService.getScriptProperties().getProperty(DT_IMG_JOB_KEY)) {
    SpreadsheetApp.getUi().alert('drone-test Images',
      'An image job is already running. Use Check Job Status, or Cancel Jobs first.',
      SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) { SpreadsheetApp.getUi().alert(DT_SHEET + ' is empty.'); return; }
  const width = Math.max(sheet.getLastColumn(), DT_COL_APPROACH);
  const data  = sheet.getRange(2, 1, lastRow - 1, width).getValues();

  const items = [];
  let skipped = 0;
  data.forEach(function (r, i) {
    const address = String(r[DT_COL_ADDRESS - 1] || '').trim();
    if (!address) return;
    const row = i + 2;
    if (onlyRows && onlyRows.indexOf(row) === -1) return;
    const taxlot = String(r[DT_COL_TAXLOT - 1] || '').trim();
    const lat = parseFloat(r[DT_COL_LAT - 1]);
    const lng = parseFloat(r[DT_COL_LNG - 1]);
    if (!taxlot || isNaN(lat) || isNaN(lng)) { skipped++; return; }
    items.push({ row: row, taxlot: taxlot, lat: lat, lng: lng,
                 address: address, state: 'pending', polls: 0 });
  });
  if (!items.length) {
    SpreadsheetApp.getUi().alert(onlyRows
      ? 'Row ' + onlyRows[0] + ' is not ready. Run "Generate 3D Models (This Row)" first' +
        (skipped ? ' (missing taxlot/coords).' : '.')
      : 'No rows ready. Run "Generate 3D Models" first' +
        (skipped ? ' (' + skipped + ' rows missing taxlot/coords).' : '.'));
    return;
  }
  PropertiesService.getScriptProperties()
    .setProperty(DT_IMG_JOB_KEY, JSON.stringify({ items: items }));
  dtSetTrigger_(DT_IMG_HANDLER);
  SpreadsheetApp.getActiveSpreadsheet().toast(
    'Images: queued ' + items.length + ' (' + V2_FIRE_PER_TICK + '/minute).');
  imagesTickDT_();
}

function imagesTickDT_() {
  const propsSvc = PropertiesService.getScriptProperties();
  const raw = propsSvc.getProperty(DT_IMG_JOB_KEY);
  if (!raw) { dtClearTrigger_(DT_IMG_HANDLER); return; }
  const job   = JSON.parse(raw);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DT_SHEET);
  if (!sheet) { dtClearTrigger_(DT_IMG_HANDLER); return; }

  let fired = 0;
  job.items.forEach(function (it) {
    if (it.state === 'pending' && fired < V2_FIRE_PER_TICK) {
      const res = callV2_('/render', { taxlot: it.taxlot, lat: it.lat, lng: it.lng,
                                       address: it.address, rowIndex: it.row, async: true });
      if (res.code === 202 || (res.body && res.body.dispatched)) {
        it.state = 'fired'; fired += 1;
        writePlainCell(sheet, it.row, DT_COL_STATUS, 'rendering images...');
      } else {
        it.state = 'error';
        writePlainCell(sheet, it.row, DT_COL_STATUS,
          'render DISPATCH FAILED: ' + ((res.body && res.body.reason) || res.code));
      }
    } else if (it.state === 'fired') {
      const p = callV2_('/render', { taxlot: it.taxlot, probe: true });
      it.polls += 1;
      // nadir_local only exists once a POST-PATCH render has completed, so it
      // doubles as the "this is the NEW render, not the old artifacts" signal.
      // A re-render's images always look complete instantly (same S3 keys), so
      // without this the poll declares done before the fresh render lands.
      // polls >= 8 is the escape hatch (~8 min) so a genuinely stuck meta
      // can't wedge the job forever.
      if (p.body && p.body.complete && p.body.images &&
          (p.body.nadir_local || it.polls >= 8)) {
        Object.keys(DT_IMG_COLS).forEach(function (v) {
          if (p.body.images[v]) sheet.getRange(it.row, DT_IMG_COLS[v]).setValue(p.body.images[v]);
        });
        if (p.body.nadir_bounds) {
          writePlainCell(sheet, it.row, DT_COL_NADIR_BOUNDS, JSON.stringify(p.body.nadir_bounds));
        }
        if (p.body.nadir_local) {
          writePlainCell(sheet, it.row, DT_COL_NADIR_LOCAL, JSON.stringify(p.body.nadir_local));
        }
        const ok = dtCaptureCheck_(sheet, it.row, p.body.capture_3d);
        let extra = '';
        if (!p.body.nadir_bounds) {
          extra = ' — Nadir Bounds empty (nadir-meta.json missing; run Backfill Nadir Bounds after the render Lambda writes it)';
        }
        writePlainCell(sheet, it.row, DT_COL_STATUS,
          'images done (' + (p.body.capture_3d || '') + ')' +
          (ok ? '' : ' — CAPTURE MISMATCH, see column F') + extra);
        it.state = 'done';
      } else if (p.body && p.body.note && p.body.note.indexOf('no cached 3D model') !== -1) {
        writePlainCell(sheet, it.row, DT_COL_STATUS, 'NEEDS 3D MODEL — run Generate 3D Models');
        it.state = 'error';
      } else if (it.polls >= V2_MAX_POLLS) {
        writePlainCell(sheet, it.row, DT_COL_STATUS,
          'render TIMED OUT — check CloudWatch (plane-parcel-render)');
        it.state = 'error';
      }
    }
  });

  const open = job.items.filter(function (it) {
    return it.state === 'pending' || it.state === 'fired';
  }).length;
  if (open === 0) {
    propsSvc.deleteProperty(DT_IMG_JOB_KEY);
    dtClearTrigger_(DT_IMG_HANDLER);
    const done = job.items.filter(function (it) { return it.state === 'done'; }).length;
    SpreadsheetApp.getActiveSpreadsheet().toast(
      'drone-test images: finished — ' + done + '/' + job.items.length + ' rendered.');
  } else {
    propsSvc.setProperty(DT_IMG_JOB_KEY, JSON.stringify(job));
  }
}

// ============================================================
// APPROACH RECORD  (plane.gs calls this 'storyboard')
// ============================================================
// Sibling stage to images/Pass 1/Pass 2: for a row with taxlot + coords + a
// cached GLB, calls plane-parcel-render with {storyboard:true} — the
// prepare_render-only branch, no rendering — stores {alpha,ent_x,ent_y} in
// Approach (AD), re-checks the capture from capture_3d, and rewrites the
// 360 View URL (Q) to model-viewer.html with those params baked in.
//
// ACCEPTANCE NOTE
// alpha is the compass bearing from the ADDRESS point to the ENTRANCE point,
// both in the GLB's local frame — derived from the address via Directions,
// NOT from the mesh. For 18775 Macalpine the plane-sourced oracle is
// alpha 231.3 (231.25 observed 2026-08-05, Directions jitter). If a row
// returns ~231.2-231.3 from the 4 cm drone mesh, frontage survives the
// capture swap. ent_x/ent_y are null for frontage tiers 3/4.
// ============================================================

// Ready when: taxlot + coords present AND Approach (AD) empty or a prior
// ERROR. Mirrors planeRowReadyForStoryboard_ on DT_COL_* offsets.
function dtRowReadyForApproach_(rowVals) {
  const taxlot = String(rowVals[DT_COL_TAXLOT - 1] || '').trim();
  const lat = parseFloat(rowVals[DT_COL_LAT - 1]);
  const lng = parseFloat(rowVals[DT_COL_LNG - 1]);
  if (!taxlot || isNaN(lat) || isNaN(lng)) return false;
  const sb = String(rowVals[DT_COL_APPROACH - 1] || '').trim();
  return !sb || sb.indexOf('ERROR:') === 0;
}

function processApproachRowDT_(sheet, row) {
  const taxlot  = String(sheet.getRange(row, DT_COL_TAXLOT).getValue() || '').trim();
  const address = String(sheet.getRange(row, DT_COL_ADDRESS).getValue() || '').trim();
  const lat = parseFloat(sheet.getRange(row, DT_COL_LAT).getValue());
  const lng = parseFloat(sheet.getRange(row, DT_COL_LNG).getValue());
  if (!taxlot || isNaN(lat) || isNaN(lng)) {
    writePlainCell(sheet, row, DT_COL_STATUS,
      'approach SKIPPED: needs taxlot + coords (run Generate 3D Models first)');
    return false;
  }

  const payload = { storyboard: true, taxlot: taxlot, lat: lat, lng: lng,
                    address: address, rowIndex: row };
  let res = callV2_('/render', payload);
  // One retry on a cold render Lambda — the same guard plane.gs uses.
  if (!res.ok && (res.code === 504 || res.code === 502 ||
                  /tim(ed)? ?out|gateway/i.test(res.error || ''))) {
    Logger.log('DT approach: first call timed out (cold Lambda) — retrying once');
    Utilities.sleep(2000);
    res = callV2_('/render', payload);
  }

  const body = res.body;
  if (res.code !== 200 || !body || !body.ok) {
    writePlainCell(sheet, row, DT_COL_STATUS,
      'approach FAILED: ' + ((body && body.reason) || ('HTTP ' + res.code)));
    return false;
  }

  writePlainCell(sheet, row, DT_COL_APPROACH,
    JSON.stringify({ alpha: body.alpha, ent_x: body.ent_x, ent_y: body.ent_y }));
  sheet.getRange(row, DT_COL_VIEWER360)
       .setValue(buildStoryboardViewerUrl_(body.glb_url, body.alpha, body.ent_x, body.ent_y));

  const ok = dtCaptureCheck_(sheet, row, body.capture_3d);
  const entTxt = (body.ent_x === null || body.ent_x === undefined)
    ? 'no entrance point (tier 3/4)'
    : 'ent=(' + body.ent_x + ',' + body.ent_y + ')';
  writePlainCell(sheet, row, DT_COL_STATUS,
    'approach done (alpha=' + body.alpha + ', ' + entTxt + ')' +
    (ok ? '' : ' — CAPTURE MISMATCH, see column F'));
  return true;
}

// Batch: every ready row, up to BATCH_SIZE per run, 1 s apart.
function generateApproachDT() {
  const sheet = dtSheet_();
  if (!sheet) return;
  ensureDtHeaders_(sheet);

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) { SpreadsheetApp.getUi().alert(DT_SHEET + ' is empty.'); return; }
  const width = Math.max(sheet.getLastColumn(), DT_COL_APPROACH);
  const data  = sheet.getRange(2, 1, lastRow - 1, width).getValues();

  const readyRows = [];
  data.forEach(function (r, i) {
    const address = String(r[DT_COL_ADDRESS - 1] || '').trim();
    if (address && dtRowReadyForApproach_(r)) readyRows.push(i + 2);
  });
  if (!readyRows.length) {
    SpreadsheetApp.getUi().alert('drone-test Approach',
      'No rows ready.\n(A row is ready when it has a Taxlot + coords and the Approach cell is empty. Run Generate 3D Models first.)',
      SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }

  let done = 0, failed = 0, attempted = 0;
  for (let i = 0; i < readyRows.length; i++) {
    if (attempted >= BATCH_SIZE) break;
    attempted++;
    try { if (processApproachRowDT_(sheet, readyRows[i])) done++; else failed++; }
    catch (e) {
      failed++;
      Logger.log('DT approach ERROR row ' + readyRows[i] + ': ' + e.message);
      writePlainCell(sheet, readyRows[i], DT_COL_STATUS,
        'approach FAILED: ' + e.message.substring(0, 80));
    }
    Utilities.sleep(1000);
  }

  const remaining = readyRows.length - attempted + failed;
  SpreadsheetApp.getUi().alert('drone-test Approach',
    'Completed: ' + done + '\nFailed: ' + failed +
    (remaining > 0 ? '\nRemaining: ' + remaining + ' — run again to continue.'
                   : '\nAll ready rows processed.') +
    (done > 0 ? '\n\nThe 360 View URL now points at the approach viewer.' : ''),
    SpreadsheetApp.getUi().ButtonSet.OK);
}

// This-row: confirms before overwriting an existing approach record.
function generateApproachForActiveRowDT() {
  const sheet = dtSheet_();
  if (!sheet) return;
  const row = dtActiveRow_(DT_SHEET);
  if (!row) return;

  const address = String(sheet.getRange(row, DT_COL_ADDRESS).getValue() || '').trim();
  if (!address) { SpreadsheetApp.getUi().alert('Row ' + row + ' has no Property Address.'); return; }

  const existing = String(sheet.getRange(row, DT_COL_APPROACH).getValue() || '').trim();
  if (existing && existing.indexOf('ERROR:') !== 0) {
    const ui = SpreadsheetApp.getUi();
    const ans = ui.alert('Regenerate?',
      'Row ' + row + ' already has approach data.\nRegenerate for:\n' + address + '?',
      ui.ButtonSet.YES_NO);
    if (ans !== ui.Button.YES) return;
  }

  const ok = processApproachRowDT_(sheet, row);
  SpreadsheetApp.getUi().alert('drone-test Approach',
    ok ? 'Approach written for:\n' + address +
         '\n\nThe 360 View URL now points at the approach viewer.'
       : 'Approach generation FAILED for:\n' + address +
         '\nSee the Status column and execution logs.',
    SpreadsheetApp.getUi().ButtonSet.OK);
}

// Old menu.gs labels said "Storyboard" but the handlers were never named that.
// Keep these aliases so a stale deployed menu still fires.
function generateStoryboardDT() { generateApproachDT(); }
function generateStoryboardForActiveRowDT() { generateApproachForActiveRowDT(); }

// ============================================================
// PASS 1 — ELEMENT PINS
// ============================================================
// Sends the five images with an ELEMENT-only pin vocabulary and writes the
// element pins to Nadir Elements (R), resetting Elements Reviewed (S) —
// fresh pins invalidate any prior human review. Writes NOTHING to Nadir
// Fixes (T) or to U:AA; concerns and descriptions are Pass 2.
//
// Pins are {id,x,y} PERCENTAGES on the nadir image. Column L's bounds
// geo-reference that image, so no separate coordinate transform is needed.
//
// REUSED (do not duplicate): fetchPinCatalog_, planeElementPinsPrompt_,
// parseElementPins_, validateElementPins_, currentPinsAsText_,
// guessImageMediaType_, planeElementRerunInstruction_ (plane.gs / prompts.gs),
// fetchImageAsBase64, callBedrock, queryKnowledgeBase, writePlainCell
// (shared.gs), normalizeAccountType (config.gs).
// ============================================================

// Ready when: all five image URLs present AND Nadir Elements (R) empty or a
// prior ERROR.
function dtRowReadyForElementPins_(rowVals) {
  const urlCols = [DT_COL_NADIR_URL, DT_COL_ALPHA_URL, DT_COL_BRAVO_URL,
                   DT_COL_CHARLIE_URL, DT_COL_DELTA_URL];
  for (let i = 0; i < urlCols.length; i++) {
    if (!String(rowVals[urlCols[i] - 1] || '').trim()) return false;
  }
  const elements = String(rowVals[DT_COL_ELEMENTS - 1] || '').trim();
  return !elements || elements.indexOf('ERROR:') === 0;
}

// Shared core for Pass 1 AND the rerun. `trailingInstruction` is the only
// thing that differs between them.
function runElementPinsCallDT_(sheet, row, trailingInstruction, statusVerb, kbQuery) {
  const address     = String(sheet.getRange(row, DT_COL_ADDRESS).getValue() || '').trim();
  const accountType = normalizeAccountType(sheet.getRange(row, DT_COL_ACCOUNT_TYPE).getValue());

  const viewDefs = [
    { key: 'nadir',   urlCol: DT_COL_NADIR_URL,   label: 'IMAGE 1 — NADIR (straight-down orthophoto view — place pins on this image)' },
    { key: 'alpha',   urlCol: DT_COL_ALPHA_URL,   label: 'IMAGE 2 — ALPHA (oblique, FRONT of the property)' },
    { key: 'bravo',   urlCol: DT_COL_BRAVO_URL,   label: 'IMAGE 3 — BRAVO (oblique, RIGHT side of the property)' },
    { key: 'charlie', urlCol: DT_COL_CHARLIE_URL, label: 'IMAGE 4 — CHARLIE (oblique, REAR of the property)' },
    { key: 'delta',   urlCol: DT_COL_DELTA_URL,   label: 'IMAGE 5 — DELTA (oblique, LEFT side of the property)' }
  ];

  const catalog = fetchPinCatalog_(accountType);
  const prompt = planeElementPinsPrompt_() +
    '\n\nAPPROVED ELEMENT PIN VOCABULARY (use ONLY these ids):\n' + catalog.elementNames;
  const kbContext  = queryKnowledgeBase(kbQuery);
  const fullPrompt = kbContext ? prompt + '\n\nREFERENCE CONTEXT FROM KNOWLEDGE BASE:\n' + kbContext : prompt;

  writePlainCell(sheet, row, DT_COL_STATUS, statusVerb + '...');
  SpreadsheetApp.flush();

  const userContent = [];
  for (let i = 0; i < viewDefs.length; i++) {
    const v   = viewDefs[i];
    const url = String(sheet.getRange(row, v.urlCol).getValue() || '').trim();
    if (!url) {
      writePlainCell(sheet, row, DT_COL_STATUS, 'element pins FAILED: missing ' + v.key + ' image URL');
      return false;
    }
    const b64 = fetchImageAsBase64(url);
    if (!b64) {
      writePlainCell(sheet, row, DT_COL_STATUS, 'element pins FAILED: image fetch (' + v.key + ')');
      return false;
    }
    userContent.push({ type: 'text', text: v.label });
    userContent.push({ type: 'image', source: { type: 'base64', media_type: guessImageMediaType_(url), data: b64 } });
  }
  userContent.push({ type: 'text', text: trailingInstruction });

  const result = callBedrock(fullPrompt, userContent, 1000);
  if (!result) {
    writePlainCell(sheet, row, DT_COL_STATUS, 'element pins FAILED: Bedrock call — see logs');
    return false;
  }
  const parsed = parseElementPins_(result);
  if (!parsed) {
    Logger.log('DT element pins raw response (row ' + row + '): ' + result.substring(0, 500));
    writePlainCell(sheet, row, DT_COL_STATUS, 'element pins FAILED: JSON parse — see logs');
    return false;
  }

  const pins = validateElementPins_(parsed.nadir_pins, catalog.elementIds);
  writePlainCell(sheet, row, DT_COL_ELEMENTS, pins.length ? JSON.stringify(pins) : '');
  sheet.getRange(row, DT_COL_REVIEWED).setValue(false); // fresh pins invalidate prior review
  writePlainCell(sheet, row, DT_COL_STATUS,
    'element pins done [' + accountType + ', ' + pins.length + ' elements] — awaiting review');
  SpreadsheetApp.flush();
  Logger.log('DT element pins: row ' + row + ' — ' + address +
             ' [' + accountType + ', ' + pins.length + ' elements]');
  return pins.length > 0 || parsed.nadir_pins.length === 0;
}

function processElementPinsRowDT_(sheet, row) {
  const address     = String(sheet.getRange(row, DT_COL_ADDRESS).getValue() || '').trim();
  const accountType = normalizeAccountType(sheet.getRange(row, DT_COL_ACCOUNT_TYPE).getValue());
  const trailingInstruction =
    'Property address: ' + address + ' [' + accountType + ']. ' +
    'Identify the physical property elements and return ONLY the JSON object described in your instructions.';
  return runElementPinsCallDT_(sheet, row, trailingInstruction,
    'generating element pins',
    'aerial property intelligence property elements structures access');
}

function generateElementPinsDT() {
  const sheet = dtSheet_();
  if (!sheet) return;
  ensureDtHeaders_(sheet);

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) { SpreadsheetApp.getUi().alert(DT_SHEET + ' is empty.'); return; }
  const width = Math.max(sheet.getLastColumn(), DT_COL_APPROACH);
  const data  = sheet.getRange(2, 1, lastRow - 1, width).getValues();

  const readyRows = [];
  data.forEach(function (r, i) {
    const address = String(r[DT_COL_ADDRESS - 1] || '').trim();
    if (address && dtRowReadyForElementPins_(r)) readyRows.push(i + 2);
  });
  if (!readyRows.length) {
    SpreadsheetApp.getUi().alert('drone-test Element Pins (Pass 1)',
      'No rows ready.\n(A row is ready when all five image URLs are present and Nadir Elements is empty.)',
      SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }

  let done = 0, failed = 0, attempted = 0;
  for (let i = 0; i < readyRows.length; i++) {
    if (attempted >= PLANE_DESC_BATCH) break;
    attempted++;
    try { if (processElementPinsRowDT_(sheet, readyRows[i])) done++; else failed++; }
    catch (e) {
      failed++;
      Logger.log('DT element pins ERROR row ' + readyRows[i] + ': ' + e.message);
      writePlainCell(sheet, readyRows[i], DT_COL_STATUS,
        'element pins FAILED: ' + e.message.substring(0, 80));
    }
    Utilities.sleep(2000);
  }

  const remaining = readyRows.length - attempted + failed;
  SpreadsheetApp.getUi().alert('drone-test Element Pins (Pass 1)',
    'Completed: ' + done + '\nFailed: ' + failed +
    (remaining > 0 ? '\nRemaining: ' + remaining + ' — run again to continue.'
                   : '\nAll ready rows processed.') +
    (done > 0 ? '\n\nReview the pins (Open Element Review), then tick "Elements Reviewed" — or write a "Nadir Fixes" note to rerun. Pass 2 runs after review.' : ''),
    SpreadsheetApp.getUi().ButtonSet.OK);
}

function generateElementPinsForActiveRowDT() {
  const sheet = dtSheet_();
  if (!sheet) return;
  const row = dtActiveRow_(DT_SHEET);
  if (!row) return;

  const address = String(sheet.getRange(row, DT_COL_ADDRESS).getValue() || '').trim();
  if (!address) { SpreadsheetApp.getUi().alert('Row ' + row + ' has no Property Address.'); return; }

  const existing = String(sheet.getRange(row, DT_COL_ELEMENTS).getValue() || '').trim();
  if (existing && existing.indexOf('ERROR:') !== 0) {
    const ui = SpreadsheetApp.getUi();
    const ans = ui.alert('Regenerate?',
      'Row ' + row + ' already has element pins.\nRegenerate for:\n' + address +
      '?\n\n(This also clears the Elements Reviewed checkbox.)',
      ui.ButtonSet.YES_NO);
    if (ans !== ui.Button.YES) return;
  }

  const ok = processElementPinsRowDT_(sheet, row);
  SpreadsheetApp.getUi().alert('drone-test Element Pins (Pass 1)',
    ok ? 'Element pins written for:\n' + address +
         '\n\nReview them on the nadir, then tick "Elements Reviewed".'
       : 'Element pin generation FAILED for:\n' + address +
         '\nSee the Status column and execution logs.',
    SpreadsheetApp.getUi().ButtonSet.OK);
}

// ── Element review link ──────────────────────────────────────────────────────
// Builds the element-review.html URL from the row's nadir + element pins.
// Carries view=drone-test and key=taxlot so the critique API files against
// THIS tab (address is not unique on Satellite). CloudFront nadirs have no
// Static Maps center/zoom — &nb= passes the crop bounds for map mode.
function buildElementReviewUrlDT_(sheet, row) {
  const nadirUrl = String(sheet.getRange(row, DT_COL_NADIR_URL).getValue() || '').trim();
  const pinsRaw  = String(sheet.getRange(row, DT_COL_ELEMENTS).getValue() || '').trim();
  const address  = String(sheet.getRange(row, DT_COL_ADDRESS).getValue() || '').trim();
  const acctType = normalizeAccountType(sheet.getRange(row, DT_COL_ACCOUNT_TYPE).getValue());
  const siteNo   = String(sheet.getRange(row, DT_COL_SITE_NO).getValue() || '').trim();
  const taxlot   = String(sheet.getRange(row, DT_COL_TAXLOT).getValue() || '').trim();
  if (!nadirUrl || !pinsRaw) return null;
  let pins;
  try { pins = JSON.parse(pinsRaw); } catch (e) { return null; }
  if (!Array.isArray(pins)) return null;
  let url = ELEMENT_REVIEW_URL +
      '?nadir=' + encodeURIComponent(nadirUrl) +
      '&pins='  + encodeURIComponent(JSON.stringify(pins)) +
      '&type='  + encodeURIComponent(acctType) +
      '&view=drone-test' +
      (taxlot  ? '&key='  + encodeURIComponent(taxlot)  : '') +
      (address ? '&addr=' + encodeURIComponent(address) : '');
  const geo = dtReviewGeoParams_(sheet, row);
  if (geo) url += '&' + geo;
  return withReviewSiteNo_(url, siteNo);
}

// CloudFront nadirs have no Static Maps center/zoom. Pass the crop bounds so
// element-review can georeference via NadirGeo.geoFromBounds (z20 mosaic).
function dtReviewGeoParams_(sheet, row) {
  const raw = String(sheet.getRange(row, DT_COL_NADIR_BOUNDS).getValue() || '').trim();
  if (!raw) return '';
  let b;
  try { b = JSON.parse(raw); } catch (e) { return ''; }
  if (!b || !isFinite(b.north) || !isFinite(b.south) ||
      !isFinite(b.east) || !isFinite(b.west)) return '';
  return 'nb=' + encodeURIComponent(b.north + ',' + b.south + ',' + b.east + ',' + b.west) +
         '&nz=20';
}

// Pull Nadir Bounds / Nadir Local from the render probe (S3 nadir-meta.json).
// Does not re-render. Clip and Approach never write these columns.
function backfillNadirBoundsForActiveRowDT() {
  const sheet = dtSheet_();
  if (!sheet) return;
  const row = dtActiveRow_(DT_SHEET);
  if (!row) return;
  const taxlot = String(sheet.getRange(row, DT_COL_TAXLOT).getValue() || '').trim();
  if (!taxlot) {
    SpreadsheetApp.getUi().alert('Row ' + row + ' has no taxlot.');
    return;
  }
  const p = callV2_('/render', { taxlot: taxlot, probe: true });
  if (p.body && p.body.nadir_bounds) {
    writePlainCell(sheet, row, DT_COL_NADIR_BOUNDS, JSON.stringify(p.body.nadir_bounds));
    if (p.body.nadir_local) {
      writePlainCell(sheet, row, DT_COL_NADIR_LOCAL, JSON.stringify(p.body.nadir_local));
    }
    SpreadsheetApp.getUi().alert('drone-test Nadir Bounds',
      'Wrote bounds' + (p.body.nadir_local ? ' and local corners' : '') +
      ' for taxlot ' + taxlot + '.\nRe-open Element Review (This Row).',
      SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }
  SpreadsheetApp.getUi().alert('drone-test Nadir Bounds',
    'No nadir-meta.json for taxlot ' + taxlot +
    '.\n\nGenerate 3D Models / Approach do not write this column. Images should, ' +
    'but the render Lambda was building the JSON and never uploading it. ' +
    'After that put is deployed, run this again (or Generate Property Images).',
    SpreadsheetApp.getUi().ButtonSet.OK);
}

function openElementReviewForActiveRowDT() {
  const sheet = dtSheet_();
  if (!sheet) return;
  const row = dtActiveRow_(DT_SHEET);
  if (!row) return;

  const url = buildElementReviewUrlDT_(sheet, row);
  if (!url) {
    SpreadsheetApp.getUi().alert('Element Review',
      'Row ' + row + ' has no nadir image or no element pins yet.\nRun Pass 1 first.',
      SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }
  const address = String(sheet.getRange(row, DT_COL_ADDRESS).getValue() || '').trim();
  reviewOpenDialog_(address, url);
}

// The element-review page numbers pins 1..N by their position in the pins
// array, so an analyst naturally writes "pin 6". plane.gs's currentPinsAsText_
// emits only "id = name at (x, y)", giving a note that says "pin 6" nothing to
// bind to — the model would have to guess. This variant appends the same
// display number the review page shows, so an analyst can refer to a pin by
// number, by name, or by id and all three resolve. The line still leads with
// "id = name at (x, y)", which is the format the rerun prompt describes.
function dtCurrentPinsAsText_(pinsRaw, catalog) {
  let pins;
  try { pins = JSON.parse(pinsRaw); } catch (e) { return ''; }
  if (!Array.isArray(pins) || !pins.length) return '';
  const nameById = {};
  ((catalog && catalog.namesList) || []).forEach(function (n) { nameById[n.id] = n.name; });
  const lines = [];
  pins.forEach(function (p, i) {
    if (!p) return;
    const id = parseInt(p.id, 10);
    if (isNaN(id)) return;
    const name = nameById[id] || ('id ' + id);
    const x = (typeof p.x === 'number') ? p.x : parseFloat(p.x);
    const y = (typeof p.y === 'number') ? p.y : parseFloat(p.y);
    lines.push(id + ' = ' + name + ' at (' + x + ', ' + y + ')   [pin ' + (i + 1) + ' on the review page]');
  });
  return lines.join('\n');
}

// ── Pass 1 rerun from Nadir Fixes (T) ────────────────────────────────────────
// Re-sends the same five images plus the current pins as named text and the
// analyst's correction note. Rewrites R and resets S; NEVER writes T — the
// note is the analyst's standing record. T has no bearing on Pass 2; S alone
// gates it. Returns 'no-fixes' | true | false.
function rerunElementPinsRowDT_(sheet, row) {
  const address     = String(sheet.getRange(row, DT_COL_ADDRESS).getValue() || '').trim();
  const accountType = normalizeAccountType(sheet.getRange(row, DT_COL_ACCOUNT_TYPE).getValue());
  const fixesNote   = String(sheet.getRange(row, DT_COL_FIXES).getValue() || '').trim();
  if (!fixesNote) return 'no-fixes';

  const pinsRaw = String(sheet.getRange(row, DT_COL_ELEMENTS).getValue() || '').trim();
  const catalog = fetchPinCatalog_(accountType);
  // dtCurrentPinsAsText_, not plane.gs's currentPinsAsText_ — this one carries
  // the review-page pin numbers so a note saying "pin 6" resolves.
  const currentPinsText = dtCurrentPinsAsText_(pinsRaw, catalog);

  const trailingInstruction =
    planeElementRerunInstruction_(address, accountType, currentPinsText, fixesNote);
  return runElementPinsCallDT_(sheet, row, trailingInstruction,
    'rerunning element pins',
    'aerial property intelligence property elements structures access');
}

function rerunElementPinsForActiveRowDT() {
  const sheet = dtSheet_();
  if (!sheet) return;
  const row = dtActiveRow_(DT_SHEET);
  if (!row) return;

  const address = String(sheet.getRange(row, DT_COL_ADDRESS).getValue() || '').trim();
  if (!address) { SpreadsheetApp.getUi().alert('Row ' + row + ' has no Property Address.'); return; }

  const fixesNote = String(sheet.getRange(row, DT_COL_FIXES).getValue() || '').trim();
  if (!fixesNote) {
    SpreadsheetApp.getUi().alert('Rerun Element Pins',
      'Row ' + row + ' has no "Nadir Fixes" note.\nWrite the correction you want applied in column T, then rerun.',
      SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }

  const outcome = rerunElementPinsRowDT_(sheet, row);
  SpreadsheetApp.getUi().alert('Rerun Element Pins (Pass 1)',
    outcome === true
      ? 'Element pins re-generated from your Nadir Fixes note for:\n' + address +
        '\n\nYour note is kept for the record (not cleared). Review the new pins, then tick "Elements Reviewed".'
      : 'Rerun FAILED for:\n' + address +
        '\nSee the Status column and execution logs.\n\nYour "Nadir Fixes" note was left untouched.',
    SpreadsheetApp.getUi().ButtonSet.OK);
}

function rerunElementPinsBatchDT() {
  const sheet = dtSheet_();
  if (!sheet) return;
  ensureDtHeaders_(sheet);

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) { SpreadsheetApp.getUi().alert(DT_SHEET + ' is empty.'); return; }
  const width = Math.max(sheet.getLastColumn(), DT_COL_APPROACH);
  const data  = sheet.getRange(2, 1, lastRow - 1, width).getValues();

  const flagged = [];
  data.forEach(function (r, i) {
    const address = String(r[DT_COL_ADDRESS - 1] || '').trim();
    if (!address) return;
    const fixesNote = String(r[DT_COL_FIXES - 1] || '').trim();
    const reviewed  = r[DT_COL_REVIEWED - 1] === true;
    if (fixesNote && !reviewed) flagged.push(i + 2);
  });
  if (!flagged.length) {
    SpreadsheetApp.getUi().alert('Rerun Element Pins (All Flagged)',
      'No flagged rows.\n(A row is flagged when it has a "Nadir Fixes" note AND "Elements Reviewed" is unchecked.)',
      SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }

  let done = 0, failed = 0, attempted = 0;
  for (let i = 0; i < flagged.length; i++) {
    if (attempted >= PLANE_DESC_BATCH) break;
    attempted++;
    try { if (rerunElementPinsRowDT_(sheet, flagged[i]) === true) done++; else failed++; }
    catch (e) {
      failed++;
      Logger.log('DT rerun ERROR row ' + flagged[i] + ': ' + e.message);
      writePlainCell(sheet, flagged[i], DT_COL_STATUS, 'rerun FAILED: ' + e.message.substring(0, 80));
    }
    Utilities.sleep(2000);
  }

  const remaining = flagged.length - attempted + failed;
  SpreadsheetApp.getUi().alert('Rerun Element Pins (All Flagged)',
    'Completed: ' + done + '\nFailed: ' + failed +
    (remaining > 0 ? '\nRemaining: ' + remaining + ' — run again to continue.'
                   : '\nAll flagged rows processed.') +
    '\n\n"Nadir Fixes" notes are kept for the record (never cleared).',
    SpreadsheetApp.getUi().ButtonSet.OK);
}

// ============================================================
// PASS 2 — CONCERNS + DESCRIPTIONS
// ============================================================
// Runs ONLY on rows a human has reviewed (Elements Reviewed / S ticked). One
// Bedrock call over the same five images, with the approved element pins
// supplied as trusted ground truth. Writes:
//   U  Nadir Concerns      (concern pins JSON — concern-section ids only)
//   V  Alpha Description   W  Bravo    X  Charlie    Y  Delta
//   Z  Responder Considerations        AA Information Needing Clarification
// NEVER writes R (element pins), S (reviewed) or T (fixes) — approved element
// pins are frozen.
// ============================================================

// Ready when: Elements Reviewed (S) === true AND Alpha Description (V) still
// empty or a prior ERROR.
function dtRowReadyForPass2_(rowVals) {
  if (rowVals[DT_COL_REVIEWED - 1] !== true) return false;
  const alpha = String(rowVals[DT_COL_ALPHA_DESC - 1] || '').trim();
  return !alpha || alpha.indexOf('ERROR:') === 0;
}

function runPass2CallDT_(sheet, row) {
  const address     = String(sheet.getRange(row, DT_COL_ADDRESS).getValue() || '').trim();
  const accountType = normalizeAccountType(sheet.getRange(row, DT_COL_ACCOUNT_TYPE).getValue());

  const viewDefs = [
    { key: 'nadir',   urlCol: DT_COL_NADIR_URL,   label: 'IMAGE 1 — NADIR (straight-down orthophoto view — place concern pins on this image)' },
    { key: 'alpha',   urlCol: DT_COL_ALPHA_URL,   label: 'IMAGE 2 — ALPHA (oblique, FRONT of the property)' },
    { key: 'bravo',   urlCol: DT_COL_BRAVO_URL,   label: 'IMAGE 3 — BRAVO (oblique, RIGHT side of the property)' },
    { key: 'charlie', urlCol: DT_COL_CHARLIE_URL, label: 'IMAGE 4 — CHARLIE (oblique, REAR of the property)' },
    { key: 'delta',   urlCol: DT_COL_DELTA_URL,   label: 'IMAGE 5 — DELTA (oblique, LEFT side of the property)' }
  ];

  const catalog = fetchPinCatalog_(accountType);
  const prompt = planeConcernAndDescPrompt_() +
    '\n\nAPPROVED CONCERN PIN VOCABULARY (use ONLY these ids):\n' + catalog.frConcernNames;
  const kbContext  = queryKnowledgeBase('first responder property access hazards egress visibility operational concerns');
  const fullPrompt = kbContext ? prompt + '\n\nREFERENCE CONTEXT FROM KNOWLEDGE BASE:\n' + kbContext : prompt;

  writePlainCell(sheet, row, DT_COL_STATUS, 'generating concerns + descriptions...');
  SpreadsheetApp.flush();

  const userContent = [];
  for (let i = 0; i < viewDefs.length; i++) {
    const v   = viewDefs[i];
    const url = String(sheet.getRange(row, v.urlCol).getValue() || '').trim();
    if (!url) {
      writePlainCell(sheet, row, DT_COL_STATUS, 'pass 2 FAILED: missing ' + v.key + ' image URL');
      return false;
    }
    const b64 = fetchImageAsBase64(url);
    if (!b64) {
      writePlainCell(sheet, row, DT_COL_STATUS, 'pass 2 FAILED: image fetch (' + v.key + ')');
      return false;
    }
    userContent.push({ type: 'text', text: v.label });
    userContent.push({ type: 'image', source: { type: 'base64', media_type: guessImageMediaType_(url), data: b64 } });
  }

  const pinsRaw = String(sheet.getRange(row, DT_COL_ELEMENTS).getValue() || '').trim();
  const confirmedText = currentPinsAsText_(pinsRaw, catalog);
  userContent.push({ type: 'text',
    text: 'Property address: ' + address + ' [' + accountType + '].\n\n' +
          'CONFIRMED PROPERTY ELEMENTS (human-approved ground truth), as "id = name at (x, y)" on the nadir:\n' +
          (confirmedText || '(no element pins were placed for this property)') +
          '\n\nUsing these confirmed elements and all five images, return ONLY the JSON object described in your instructions (concern pins in "nadir_pins", plus the four view descriptions, considerations, and clarifications).' });

  const result = callBedrock(fullPrompt, userContent, 4000);
  if (!result) {
    writePlainCell(sheet, row, DT_COL_STATUS, 'pass 2 FAILED: Bedrock call — see logs');
    return false;
  }
  const parsed = parsePlaneDescriptions_(result);
  if (!parsed) {
    Logger.log('DT pass 2 raw response (row ' + row + '): ' + result.substring(0, 600));
    writePlainCell(sheet, row, DT_COL_STATUS, 'pass 2 FAILED: JSON parse — see logs');
    return false;
  }

  const concernPins = validateConcernPins_(parsed.nadir_pins, catalog.frConcernIds);
  writePlainCell(sheet, row, DT_COL_CONCERNS, concernPins.length ? JSON.stringify(concernPins) : '');
  writePlainCell(sheet, row, DT_COL_ALPHA_DESC,   parsed.alpha);
  writePlainCell(sheet, row, DT_COL_BRAVO_DESC,   parsed.bravo);
  writePlainCell(sheet, row, DT_COL_CHARLIE_DESC, parsed.charlie);
  writePlainCell(sheet, row, DT_COL_DELTA_DESC,   parsed.delta);
  writePlainCell(sheet, row, DT_COL_CONSIDER,     parsed.considerations);
  writePlainCell(sheet, row, DT_COL_CLARIFY,      parsed.clarifications);
  writePlainCell(sheet, row, DT_COL_STATUS,
    'pass 2 done [' + accountType + ', ' + concernPins.length + ' concerns]');
  SpreadsheetApp.flush();
  Logger.log('DT pass 2: row ' + row + ' — ' + address +
             ' [' + accountType + ', ' + concernPins.length + ' concerns]');
  return true;
}

function processPass2RowDT_(sheet, row) {
  return runPass2CallDT_(sheet, row);
}

function generatePass2DT() {
  const sheet = dtSheet_();
  if (!sheet) return;
  ensureDtHeaders_(sheet);

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) { SpreadsheetApp.getUi().alert(DT_SHEET + ' is empty.'); return; }
  const width = Math.max(sheet.getLastColumn(), DT_COL_APPROACH);
  const data  = sheet.getRange(2, 1, lastRow - 1, width).getValues();

  const readyRows = [];
  data.forEach(function (r, i) {
    const address = String(r[DT_COL_ADDRESS - 1] || '').trim();
    if (address && dtRowReadyForPass2_(r)) readyRows.push(i + 2);
  });
  if (!readyRows.length) {
    SpreadsheetApp.getUi().alert('drone-test Pass 2 (Concerns + Descriptions)',
      'No rows ready.\n(A row is ready when "Elements Reviewed" is ticked and the Alpha Description is still empty.)',
      SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }

  let done = 0, failed = 0, attempted = 0;
  for (let i = 0; i < readyRows.length; i++) {
    if (attempted >= PLANE_DESC_BATCH) break;
    attempted++;
    try { if (processPass2RowDT_(sheet, readyRows[i])) done++; else failed++; }
    catch (e) {
      failed++;
      Logger.log('DT pass 2 ERROR row ' + readyRows[i] + ': ' + e.message);
      writePlainCell(sheet, readyRows[i], DT_COL_STATUS, 'pass 2 FAILED: ' + e.message.substring(0, 80));
    }
    Utilities.sleep(2000);
  }

  const remaining = readyRows.length - attempted + failed;
  SpreadsheetApp.getUi().alert('drone-test Pass 2 (Concerns + Descriptions)',
    'Completed: ' + done + '\nFailed: ' + failed +
    (remaining > 0 ? '\nRemaining: ' + remaining + ' — run again to continue.'
                   : '\nAll ready rows processed.'),
    SpreadsheetApp.getUi().ButtonSet.OK);
}

function generatePass2ForActiveRowDT() {
  const sheet = dtSheet_();
  if (!sheet) return;
  const row = dtActiveRow_(DT_SHEET);
  if (!row) return;

  const address = String(sheet.getRange(row, DT_COL_ADDRESS).getValue() || '').trim();
  if (!address) { SpreadsheetApp.getUi().alert('Row ' + row + ' has no Property Address.'); return; }

  if (sheet.getRange(row, DT_COL_REVIEWED).getValue() !== true) {
    SpreadsheetApp.getUi().alert('Pass 2 blocked — review required',
      'Row ' + row + ' has not been marked "Elements Reviewed".\n\n' +
      'Review the Pass 1 element pins (Open Element Review), correct them if needed ' +
      '(write a "Nadir Fixes" note and rerun), then tick "Elements Reviewed".',
      SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }

  const existing = String(sheet.getRange(row, DT_COL_ALPHA_DESC).getValue() || '').trim();
  if (existing && existing.indexOf('ERROR:') !== 0) {
    const ui = SpreadsheetApp.getUi();
    const ans = ui.alert('Regenerate?',
      'Row ' + row + ' already has Pass 2 output.\nRegenerate concerns + descriptions for:\n' + address + '?',
      ui.ButtonSet.YES_NO);
    if (ans !== ui.Button.YES) return;
  }

  const ok = processPass2RowDT_(sheet, row);
  SpreadsheetApp.getUi().alert('drone-test Pass 2 (Concerns + Descriptions)',
    ok ? 'Concerns + descriptions written for:\n' + address
       : 'Pass 2 FAILED for:\n' + address + '\nSee the Status column and execution logs.',
    SpreadsheetApp.getUi().ButtonSet.OK);
}

// ============================================================
// GITHUB SYNC — data/drone-test/
// ============================================================
// Publishes each complete drone-test row to data/drone-test/{viewId}.json in
// the SAME schema plane.gs publishes (name/address/view/hoa/account_type,
// nadir with pins + bounds, four obliques with descriptions, considerations,
// clarifications, viewer360, lat/lng) plus two additions:
//   capture     — the drone capture the pipeline selected
//   directions  — the REVIEWED responder directions for this property,
//                 gathered from the responder-directions tab
// Directions ride inside the property record rather than in files of their
// own, so the viewer needs one fetch, the property name is the only join, and
// renaming a property cannot orphan a set of directions.
//
// Identity: viewId = hashId(slug(name) + '-drone-test', salt) — that is the
// record filename under data/drone-test/. The INDEX hub is NOT that hash.
// Hub id = droneTestHubId_: an existing data/index file with this property
// name (or address) wins, so Vyanet Eugene merges onto 4a484f8c instead of
// a second hub. Else unique satellite site_no. Else mint
// hashId(slug(name)) and CREATE the index file. Never skip the index write
// when the name is usable. Address match is how Tracy still joins Jones.
//
// upsertIndexEntry_ merges views.drone-test onto that hub, so plane/security/
// wildfire pointers survive.
//
// DELIBERATELY NOT DONE: this does not call updateIntelLinksSheet. drone-test is
// a test surface and Intel Links is the production client-facing register; add
// 'drone-test' to VIEW_ORDER / VIEW_LABELS in config.gs and call it here if you
// later want it listed.
//
// COMPLETENESS GATE (same as plane): five image URLs, element pins, and all
// four oblique descriptions. A row that has had Pass 1 but not Pass 2 is
// intentionally skipped — the viewer has nothing to say about it yet.
// ============================================================

// ── Nadir percentage -> local model metres ───────────────────────────────────
// Bilinear interpolation of the four corners the render Lambda publishes.
// FOUR corners, not two: the local frame is ENU about the CAPTURE's origin, so
// it is only near-north-up over one parcel; bilinear absorbs the skew exactly.
function dtLocalFromPct_(x, y, c) {
  const u = Number(x) / 100, v = Number(y) / 100;
  const w = [(1 - u) * (1 - v), u * (1 - v), (1 - u) * v, u * v];
  const k = [c.nw, c.ne, c.sw, c.se];
  let mx = 0, my = 0;
  for (let i = 0; i < 4; i++) { mx += w[i] * k[i][0]; my += w[i] * k[i][1]; }
  return { mx: Math.round(mx * 100) / 100, my: Math.round(my * 100) / 100 };
}

// True only when all four corners are [x, y] number pairs. A row rendered
// before the Lambda patch fails this — deliberately, so the sync publishes
// 2D-only rather than silently emitting garbage metres.
function dtValidCorners_(c) {
  if (!c) return false;
  return ['nw', 'ne', 'sw', 'se'].every(function (k) {
    return Array.isArray(c[k]) && c[k].length >= 2 &&
           isFinite(Number(c[k][0])) && isFinite(Number(c[k][1]));
  });
}

// Adds mx,my to every waypoint, leaving x,y untouched. Returns the number
// converted so the sync can report it.
function dtAttachLocalXY_(directions, corners) {
  if (!dtValidCorners_(corners)) return 0;
  let n = 0;
  directions.forEach(function (d) {
    d.route = (d.route || []).map(function (w) {
      const m = dtLocalFromPct_(w.x, w.y, corners);
      n++;
      return { seq: w.seq, x: w.x, y: w.y, mx: m.mx, my: m.my };
    });
  });
  return n;
}

// ── 360 View URL page ────────────────────────────────────────────────────────
// Rewrites only the PAGE of whatever URL the Plane builders produced; their
// query string is carried across verbatim. Keeps drone-test on model-viewer.html
// without touching config.gs or plane.gs.
const DT_VIEWER_PAGE = 'https://responder-intel.vyanet.com/model-viewer.html';

function dtRebaseViewer_(url, propertyId) {
  let s = String(url || '').trim();
  if (!s) return '';
  const q = s.indexOf('?');
  s = q === -1 ? DT_VIEWER_PAGE : DT_VIEWER_PAGE + s.substring(q);
  if (propertyId && s.indexOf('property=') === -1) {
    s += (s.indexOf('?') === -1 ? '?' : '&') +
         'property=' + encodeURIComponent(propertyId) + '&view=drone-test';
  }
  return s;
}

const DT_DATA_DIR = 'data/drone-test';

function processDroneTestSheet() {
  processDroneTestRows_(null);
}

function processDroneTestForActiveRowDT() {
  const row = dtActiveRow_(DT_SHEET);
  if (!row) return;
  processDroneTestRows_(row);
}

function processDroneTestRows_(onlySheetRow) {
  const creds = getCredentials();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DT_SHEET);
  if (!sheet) { Logger.log('Sheet not found: ' + DT_SHEET); return; }
  indexNameCache_ = null;

  const data    = sheet.getDataRange().getValues();
  const files   = [];
  const updates = [];
  let processed = 0, skipped = 0, directionsTotal = 0, directionsSkipped = 0;
  let waypointsInMetres = 0;
  let skipReason = '';

  if (onlySheetRow && (onlySheetRow < 2 || onlySheetRow > data.length)) {
    SpreadsheetApp.getUi().alert('drone-test Sync',
      'Row ' + onlySheetRow + ' is empty.',
      SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }

  for (let i = 1; i < data.length; i++) {
    if (onlySheetRow && (i + 1) !== onlySheetRow) continue;
    const row         = data[i];
    const accountType = normalizeAccountType(row[DT_COL_ACCOUNT_TYPE - 1]);
    const accountName = String(row[DT_COL_ACCOUNT - 1] || '').trim();
    const address     = String(row[DT_COL_ADDRESS - 1] || '').trim();
    const hoaTag      = row[DT_COL_HOA - 1];
    const capture     = String(row[DT_COL_CAPTURE - 1] || '').trim();
    const nadirUrl    = String(row[DT_COL_NADIR_URL - 1] || '').trim();
    const elementsRaw = String(row[DT_COL_ELEMENTS - 1] || '').trim();
    const concernsRaw = String(row[DT_COL_CONCERNS - 1] || '').trim();
    const boundsRaw   = String(row[DT_COL_NADIR_BOUNDS - 1] || '').trim();
    const localRaw    = String(row[DT_COL_NADIR_LOCAL - 1] || '').trim();
    const alphaUrl    = String(row[DT_COL_ALPHA_URL - 1] || '').trim();
    const alphaDesc   = String(row[DT_COL_ALPHA_DESC - 1] || '').trim();
    const bravoUrl    = String(row[DT_COL_BRAVO_URL - 1] || '').trim();
    const bravoDesc   = String(row[DT_COL_BRAVO_DESC - 1] || '').trim();
    const charlieUrl  = String(row[DT_COL_CHARLIE_URL - 1] || '').trim();
    const charlieDesc = String(row[DT_COL_CHARLIE_DESC - 1] || '').trim();
    const deltaUrl    = String(row[DT_COL_DELTA_URL - 1] || '').trim();
    const deltaDesc   = String(row[DT_COL_DELTA_DESC - 1] || '').trim();
    const lat         = parseFloat(row[DT_COL_LAT - 1]);
    const lng         = parseFloat(row[DT_COL_LNG - 1]);

    if (!accountName || !address) {
      skipped++;
      skipReason = 'missing Property Name or Address';
      continue;
    }
    if (!nadirUrl || !elementsRaw || !alphaUrl || !alphaDesc ||
        !bravoUrl || !bravoDesc || !charlieUrl || !charlieDesc ||
        !deltaUrl || !deltaDesc) {
      Logger.log('drone-test sync skipping (incomplete): ' + accountName);
      skipped++;
      skipReason = 'incomplete — need images, element pins, and all four descriptions';
      continue;
    }
    if (alphaDesc.indexOf('ERROR:') === 0) {
      Logger.log('drone-test sync skipping (errored descriptions): ' + accountName);
      skipped++;
      skipReason = 'errored descriptions in Alpha';
      continue;
    }

    let elementPins = [], concernPins = [], bounds = null;
    try { elementPins = JSON.parse(elementsRaw) || []; } catch (e) {
      Logger.log('drone-test sync skipping (bad Nadir Elements JSON): ' + accountName);
      skipped++;
      skipReason = 'Nadir Elements is not valid JSON';
      continue;
    }
    if (concernsRaw) {
      try { concernPins = JSON.parse(concernsRaw) || []; } catch (e) {
        Logger.log('drone-test sync skipping (bad Nadir Concerns JSON): ' + accountName);
        skipped++;
        skipReason = 'Nadir Concerns is not valid JSON';
        continue;
      }
    }
    try { bounds = boundsRaw ? JSON.parse(boundsRaw) : null; } catch (e) { bounds = null; }
    let localCorners = null;
    try { localCorners = localRaw ? JSON.parse(localRaw) : null; } catch (e) { localCorners = null; }

    const baseKey = accountName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const viewId  = hashId(baseKey + '-drone-test', creds.hashSalt);
    const hubId   = droneTestHubId_({
      siteNo: row[DT_COL_SITE_NO - 1],
      accountName: accountName,
      address: address,
      salt: creds.hashSalt
    });
    const hoaSlug = slugify(hoaTag);

    const dir = rdDirectionsForProperty_(accountName);
    directionsTotal   += dir.directions.length;
    directionsSkipped += dir.skipped;
    const wpConverted = dtAttachLocalXY_(dir.directions, localCorners);
    waypointsInMetres += wpConverted;
    if (dir.directions.length && !wpConverted) {
      Logger.log('drone-test sync: ' + accountName + ' has directions but no ' +
                 'Nadir Local (column AE) — publishing 2D-only. Re-run Generate ' +
                 'Property Images to backfill it.');
    }

    // Cameras are property-level (data/cameras/json/{hubId}.json).
    // Do not put cameras[] on this view record — a later sync would own
    // the drop. camerasFileForSync_ PUTs the cameras file separately.
    const propertyData = {
      name:           accountName,
      address:        address,
      view:           'drone-test',
      hoa:            hoaSlug || '',
      account_type:   accountType,
      capture:        capture,
      nadir:          { url: nadirUrl,
                        pins: elementPins.concat(concernPins),
                        element_pins: elementPins,
                        concern_pins: concernPins,
                        bounds: bounds,
                        local: localCorners },
      alpha:          { url: alphaUrl,   desc: toBullets(alphaDesc)   },
      bravo:          { url: bravoUrl,   desc: toBullets(bravoDesc)   },
      charlie:        { url: charlieUrl, desc: toBullets(charlieDesc) },
      delta:          { url: deltaUrl,   desc: toBullets(deltaDesc)   },
      considerations: String(row[DT_COL_CONSIDER - 1] || ''),
      clarifications: String(row[DT_COL_CLARIFY - 1] || ''),
      viewer360:      String(row[DT_COL_VIEWER360 - 1] || ''),
      directions:     dir.directions
    };
    if (!isNaN(lat) && !isNaN(lng)) { propertyData.lat = lat; propertyData.lng = lng; }

    files.push({ path: DT_DATA_DIR + '/' + viewId + '.json',
                 content: JSON.stringify(propertyData, null, 2) });

    if (hubId) {
      const patch = {
        name: accountName, address: address, hoa: hoaSlug || '',
        account_type: accountType, views: {}
      };
      patch.views['drone-test'] = viewId;
      if (!isNaN(lat) && !isNaN(lng)) { patch.lat = lat; patch.lng = lng; }
      const up = upsertIndexEntry_(hubId, patch);
      files.push(up.file);
      const camFile = camerasFileForSync_(hubId, DT_DATA_DIR + '/' + viewId + '.json');
      if (camFile) files.push(camFile);
    } else {
      Logger.log('drone-test sync: could not resolve an index hub for "' + accountName +
                 '" — published ' + DT_DATA_DIR + '/' + viewId + '.json, skipped index.');
    }

    updates.push({ rowIndex: i, id: hubId, viewId: viewId, accountName: accountName });
    processed++;
  }

  if (!files.length) {
    Logger.log('Nothing to push for: ' + DT_SHEET);
    if (onlySheetRow) {
      SpreadsheetApp.getUi().alert('drone-test Sync',
        'Row ' + onlySheetRow + ' was not published' +
        (skipReason ? ':\n' + skipReason : '.') +
        '\n\nFinish images, Pass 1, and Pass 2 on this row, then sync it again.',
        SpreadsheetApp.getUi().ButtonSet.OK);
    } else {
      SpreadsheetApp.getActiveSpreadsheet().toast('drone-test sync: no complete rows to push.');
    }
    return;
  }

  if (!pushAllToGitHub(files, 'drone-test')) {
    SpreadsheetApp.getActiveSpreadsheet().toast('drone-test sync: GitHub push FAILED — see execution logs.');
    return;
  }

  updates.forEach(function (u) {
    if (!u.id) return;
    const q = String(data[u.rowIndex][DT_COL_VIEWER360 - 1] || '').trim();
    sheet.getRange(u.rowIndex + 1, DT_COL_FR_LINK).setValue(
      q ? dtRebaseViewer_(q, u.id)
        : (VIEWER_BASE_URL + '?property=' + u.id + '&tab=drone-test'));
    sheet.getRange(u.rowIndex + 1, DT_COL_UPLOAD_DATE).setValue(new Date().toLocaleString());
  });

  Logger.log('Done [drone-test]. Processed: ' + processed + ' | Skipped: ' + skipped +
             ' | Directions published: ' + directionsTotal + ' | Directions skipped: ' + directionsSkipped);
  SpreadsheetApp.getUi().alert('drone-test Sync',
    'Properties published: ' + processed + '\nProperties skipped (incomplete): ' + skipped +
    '\n\nResponder directions published: ' + directionsTotal +
    '\nDirections skipped (unreviewed or empty): ' + directionsSkipped +
    (directionsSkipped ? '\n\nUnreviewed directions are never published — tick "Route Reviewed" first.' : ''),
    SpreadsheetApp.getUi().ButtonSet.OK);
}