// ============================================================
// PROPERTY INTEL — Apps Script v5.25 — FILE 13: critique-api.gs
// The element-review.html <-> sheet bridge. Routes on ONE web app
// deployment:
//
//   GET  ?route=elements&site_no=<siteNo>   -> the row's nadir + element pins
//        (&key=, &addr= and &name= also resolve, in that order of preference)
//        &sandbox=1 (or JSON sandbox:true) reads Satellite Sandbox instead
//   GET  ?route=pin-freq                    -> {freq:{id:count}} for add-search
//        order (Satellite Nadir Elements + element-critique Pin n ID; 6 h cache)
//        &sandbox=1 counts the sandbox tabs instead (separate cache key)
//   GET  ?route=ping                        -> deployed build / layout check
//   GET  ?route=golf-catalog                -> Golf Pins sheet (NOT pins-catalog.json)
//   GET  ?route=golf-elements&site_no=      -> Golf tab pins only (never Satellite)
//   GET  ?route=rounds&site_no=             -> round history for element-review
//        Round 0 = Bedrock (first critique row's published XY). Round 1+ =
//        each filed review after verdicts. next_round is max(Round)+1, else 1.
//        &sandbox=1 reads Element Critique Sandbox. CORS simple GET.
//   POST ?route=critique  (JSON body)       -> file the analyst's critique
//        sandbox:true / ?sandbox=1 files to Element Critique Sandbox and
//        writes Nadir Fixes on Satellite Sandbox. Production tabs untouched.
//   POST ?route=golf-save  (view:"golf")    -> write Golf Nadir Elements only
//        Does NOT write element-critique, Nadir Fixes, or call Bedrock.
//
// HOW THE VIEWER IS REACHED
// The Satellite sheet's "Open Element Review (This Row)" menu action
// (openSatElementReviewForActiveRow -> buildSatElementReviewUrl_) builds the
// link WITH &site_no= (plus &addr= as a human-readable leftover). Address is
// NOT unique — 410 SW Columbia St is two rows — so a link that only carries
// &addr= is refused rather than guessed. Old bookmarked links without
// site_no still work when the address happens to be unique.
//
// ⭐ IDENTITY, REKEYED 2026-08-13. A satellite property id is
// hashId(slug(SITE_NO), HASH_SALT) — NOT the account name. site_no lives in
// column A and every other SAT_COL_* shifted +1. Account Name is DISPLAY ONLY:
// the July export has 145 duplicate-name groups (MOSAIC MEDICAL is 7 clinics),
// so a name is not a key on either side.
// ⚠️ Drone and plane are still NAME-based, deliberately, because client drone
// links are already delivered. Two hashing rules coexist on purpose — never
// "unify" them. Satellite lookups stay on site_no. view=drone-test is the
// sanctioned exception: GET/POST then resolve the drone-test tab by taxlot
// (key) so a shared address like 862 Bethel Dr cannot file against Satellite.
//
// WHY THIS FILE EXISTS
// element-review.html receives its pins baked into the URL, which makes the
// link a snapshot: a new round of pins needs a new link. Serving the pins over
// GET makes the link permanent (?key=<id>) and lets the page re-render a new
// round without a reload and without a GitHub sync, because the sheet is read
// live. That GET route is what the viewer's real-time refresh will poll — it is
// deployed now even though the viewer does not use it yet.
//
// ⭐ THE RE-PIN RUNS INLINE (Jonah, 2026-08-14: "I do not want it to queue to
// rerun. I want it to trigger the rerun immediately"). This SUPERSEDES both the
// 2026-08-11 "we will not automate the rerun yet" and the brief queue-it stage
// in between. On submit this file: files the row, writes the composed note to
// SAT_COL_FIXES, unticks SAT_COL_REVIEWED, calls rerunSatElementPinsRow_ right
// there, clears the consumed note, and RETURNS THE NEW PINS in the response so
// the viewer can redraw at once. See CRITIQUE_RERUN_MODE for the other two
// settings and the timing trade.
//
// ⚠️ BEFORE YOU PASTE THIS: only ONE doGet and ONE doPost may exist in an Apps
// Script project. Verified 2026-08-11 against the complete file list
// (Config, Prompts, Menu, Shared, Satellite, Plane, Drone Interior, Satellite
// migration v2, Responder Intel, Import Accounts, drone-test,
// responder-directions, golf, satellite-sandbox) plus no Libraries and no
// Services: NEITHER handler exists. The two wrappers at the bottom are safe as
// written. If a file is ever added that defines one, delete the wrappers and
// delegate instead:
//     if (e && e.parameter && e.parameter.route) return critiqueApiGet_(e);
// Everything above the wrappers is critique*-prefixed and cannot collide.
//
// ⚠️ CORS: responses go out through ContentService, which sends
// Access-Control-Allow-Origin: *. A GET, and a POST whose Content-Type is
// text/plain, are CORS "simple requests" — no OPTIONS preflight, which Apps
// Script cannot answer. Do NOT change the viewer to send application/json;
// that alone would trigger a preflight and fail. A ?callback= JSONP path is
// included on the GET as the escape hatch.
// ============================================================

// ── Config ──────────────────────────────────────────────────────────────────
// Property Intel's Satellite spreadsheet. Taken from the sheet URL:
// docs.google.com/spreadsheets/d/<THIS PART>/edit
// Left as a placeholder the script falls back to the spreadsheet this project is
// BOUND to (see critiqueOpenSpreadsheet_). That fallback is fine for the editor
// self-test but NOT for a deployment: getActiveSpreadsheet() is not guaranteed
// to resolve in every web-app execution context, and a null there fails every
// submission.
// ⚠️ BAKED IN ON PURPOSE, 2026-08-12. It was a placeholder, Jonah set it by hand,
// and then pasting a newer version of this file over the old one silently reset
// it — the self-test caught that as "CRITIQUE_SPREADSHEET_ID is NOT set". A
// value that has to be re-entered after every edit will eventually be forgotten
// right before a deployment. When copying this ID by hand, select the WHOLE
// string: a double-click stops at the hyphen and yields 31 of the 44 characters,
// which fails as "Illegal spreadsheet id or key".
const CRITIQUE_SPREADSHEET_ID = '1Bp4czq4QVIJfNvjaQAI7Zc_rlAdt9t-gb4xmjLZASVM';

// The audit tab — must match the tab name EXACTLY (Apps Script is case- and
// punctuation-sensitive here). Jonah created it by hand as `element-critique`
// 2026-08-11, which SUPERSEDES the earlier "Element Critique" naming.
// Created automatically if absent; if present, its header row is brought up to
// this layout (see the guard in critiqueEnsureLogSheet_).
const CRITIQUE_SHEET = 'element-critique';

// What "Rerun analysis" does, beyond filing the row:
//
//   'inline' — write the note to Nadir Fixes, then RUN the re-pin immediately,
//              in this same request, and hand the new pins back to the viewer.
//              ⭐ Jonah, 2026-08-14: "I do not want it to queue to rerun. I want
//              it to trigger the rerun immediately."
//   'queue'  — write the note and untick Reviewed, then leave the row for the
//              5-minute generateSatElementRerunAutoRun trigger.
//   'off'    — record only. The note stays in the log and has to be copied into
//              Nadir Fixes by hand.
//
// This replaced a boolean, which could no longer express three behaviours.
//
// ⚠️ 'inline' COSTS THE REVIEWER REAL TIME. The re-pin is one Bedrock vision
// call; the pilot batch measured ~9.7 s/row, so expect the submit to take on the
// order of ten seconds against a 6-minute execution ceiling. That is the trade
// asked for — the alternative was being told to wait five minutes.
//
// ⚠️ Writing SAT_COL_FIXES is by itself enough to fire the 5-minute trigger (its
// selector is `fixesNote && !reviewed`, and a freshly-pinned row is already
// unreviewed). So on a SUCCESSFUL inline re-pin the note is CLEARED, exactly as
// runSatElementRerunBatch_ does, or the trigger would redo the same work within
// five minutes. The note is not lost: "Fixes Note Sent" in element-critique is
// its durable record.
const CRITIQUE_RERUN_MODE = 'inline';

// Kept because the ping route and the log row both report it, and because
// several call sites still ask the yes/no question.
const CRITIQUE_QUEUE_RERUN = (CRITIQUE_RERUN_MODE !== 'off');

// Optional shared secret. '' disables it. When set, both routes require
// &token=<value>. Obfuscation, not authentication — but the pins already travel
// in plain URLs today, so it is not a new class of exposure.
const CRITIQUE_SHARED_TOKEN = '';

// Per-pin column groups. This is a HARD LIMIT. There is no overflow column.
//
// 2026-08-12: 12 slots (Jonah: "there will never be more than 12 pins").
// 2026-08-27: 20 slots, so a school row (SAT_MAX_PINS_SCHOOL) can actually be
// recorded. Standard satellite still emits at most 12; unused slots stay blank.
//
// Because the layout can no longer absorb a 21st pin, a submission carrying one
// is REFUSED and NOTHING is written. That is the point: dropping it instead
// would be the silent truncation the overflow column existed to prevent, and a
// refusal the reviewer can read beats a row that looks complete and isn't. The
// viewer enforces the same cap up front (12 standard / 20 school), so a refusal
// here means the two got out of step — a bug worth hearing about, not a routine
// outcome.
const CRITIQUE_PIN_SLOTS = 20;

// ── Which build is DEPLOYED ─────────────────────────────────────────────────
// Bump this on every meaningful change, and it will tell you whether /exec is
// serving the file you just saved.
//
// Why it exists: the editor self-test runs against the SAVED file, but /exec
// serves the file as of the last DEPLOYMENT VERSION. Saving without deploying
// leaves a green self-test in front of stale live code, and nothing in the old
// ping response could tell the two apart. This is the same failure the viewer
// already taught us — a cached copy of element-review.html looked current until
// the zoom button reading "1:1" instead of "Fit" gave it away. That label was an
// accident; this is the deliberate version of it.
//
// Check with:  <your /exec URL>?route=ping
// If `build` is not the value below, the deployment is behind: Deploy →
// Manage deployments → edit → New version.
const CRITIQUE_BUILD = 'v6.8.6 (2026-09-02) — round history for element-review';

// ── The Element Critique layout ─────────────────────────────────────────────
// ONE ROW PER SUBMISSION (Jonah, 2026-08-11), wide: a submission block, then
// one six-column group per pin. There is no overflow column: 20 is a hard limit
// (school cap), enforced in the viewer and refused here.
//
// Added pins share the per-pin groups rather than getting a block of their own,
// because the viewer numbers them continuously — six confirmed pins means an
// addition is pin 7, so it lands in slot 7. Its Verdict reads "added" and its
// "Pin n XY" is blank, because an added pin has no published position: the
// reviewer chose the only coordinate it has.
//
// ⚠️ A slot is a WITHIN-ROUND position, not an identity. Seq comes from the
// pins-array order, so after a re-pin "pin 3" may be a different element.
// Reading DOWN a per-pin column compares different elements between rounds —
// any round-over-round analysis must key on "Pin n ID", never on the slot.
const CRITIQUE_SUBMISSION_HEADERS = [
  'Submitted At',            // 1
  'Site No',                 // 2  ⭐ THE identity as of the 2026-08-13 rekey
  'Property Key',            // 3  hashId(slug(site_no)) — the published id
  'Account Name',            // 4  DISPLAY ONLY. Not a key: MOSAIC MEDICAL is 7 clinics
  'Property Address',        // 5
  'Satellite Row',           // 6  row number at submission time (a hint, not a key)
  'Round',                   // 7
  'Reviewer',                // 8
  'Viewer Version',          // 9
  'Pins Reviewed',           // 10 confirmed pins shown to the reviewer
  'Pins Added',              // 11
  'Marked OK',               // 12
  'Marked Fix',              // 13
  'Marked Remove',           // 14
  'Repositioned',            // 15 how many pins were dragged/typed to a new xy
  'Missed / General Notes',  // 16
  'Pin Requests',            // 17 how many new catalog element types were requested
  'New Pin Element Requests',// 18 the requests themselves — NOT sent to the analysis
  'Fixes Note Sent',         // 19 the composed Nadir Fixes note — see below
  'Rerun Status'             // 20
];

// Per-pin group. Order is load-bearing: the row is built positionally.
const CRITIQUE_PIN_FIELDS = [
  'ID',               // catalog id — the cross-round identity
  'Name',             // resolved catalog name
  'Verdict',          // ok | fix | remove | added | (blank)
  'XY',               // position AS PUBLISHED by Pass 1 (blank for an addition)
  'Fix XY',           // corrected position, or the chosen position for an addition
  'Fix Description'   // the reviewer's prose for this pin
];

// Column 16 ("Fixes Note Sent") is the one that must not be dropped in a
// redesign. Satellite's auto-rerun CLEARS SAT_COL_FIXES on success, so once a
// re-pin lands, column J is empty and the instruction that caused it is gone.
// This column is the only durable record of what was actually sent to Bedrock —
// and while CRITIQUE_QUEUE_RERUN is false it is the text to paste into Nadir
// Fixes by hand when you want the rerun.
function critiqueHeaders_() {
  var h = CRITIQUE_SUBMISSION_HEADERS.slice();
  for (var n = 1; n <= CRITIQUE_PIN_SLOTS; n++) {
    for (var i = 0; i < CRITIQUE_PIN_FIELDS.length; i++) {
      h.push('Pin ' + n + ' ' + CRITIQUE_PIN_FIELDS[i]);
    }
  }
  return h;
}

// ── Small helpers ───────────────────────────────────────────────────────────

// ⭐ THE SATELLITE IDENTITY, REKEYED 2026-08-13.
// Satellite ids are now hashId(slug(SITE_NO)), not hashId(slug(ACCOUNT NAME)).
// This file used to carry its own copy of the slug+hash. It no longer does:
// it DELEGATES to satPropertyId_ in Satellite.gs, which is the one place that
// rule lives. A second copy is exactly how two hashing rules drift apart, and
// a drifted key here would file critiques against the wrong property while
// looking perfectly healthy.
//
// ⚠️ DRONE AND PLANE ARE STILL NAME-BASED, on purpose, because client drone links
// are already out. Two hashing rules coexist deliberately — never "unify" them.
// This API only ever touches the Satellite sheet, so site_no is always correct
// here.
//
// The typeof guard turns a rename in Satellite.gs into a sentence you can act on
// instead of "satPropertyId_ is not defined" from three call sites.
function critiqueSiteId_(siteNo, salt) {
  if (typeof satPropertyId_ !== 'function') {
    throw new Error('satPropertyId_() not found. critique-api.gs delegates the ' +
      'site_no hash to Satellite.gs so the rule lives in one place — if that ' +
      'function was renamed, update this call rather than re-implementing the hash.');
  }
  return satPropertyId_(siteNo, salt);
}

// Is this cell a usable site_no? Satellite.gs owns the rule: any non-blank
// value (digits, VY- placeholders, interim ids like Cht-3). Format is not a
// gate — those interim values are the ids until they are replaced.
// ⚠️ A BLANK MUST BE REFUSED: hashId('') returns a perfectly valid-looking hash,
// so an empty site_no would silently mint an id that matches nothing.
function critiqueValidSite_(siteNo) {
  if (typeof satValidSiteNo_ === 'function') return !!satValidSiteNo_(siteNo);
  return !!String(siteNo || '').trim();
}

// The site_no exactly as the sheet holds it, trimmed. Read through one helper so
// the "which column is it" answer lives in one place.
function critiqueSiteNoOf_(rowVals) {
  return String(rowVals[SAT_COL_SITE_NO - 1] || '').trim();
}

// Loose comparison for the name/address fallbacks: case, punctuation and
// spacing all differ between a sheet cell and a URL param.
function critiqueNorm_(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

// Short fingerprint of the element cell. The viewer compares this to detect
// "the pins changed" without diffing arrays — the basis of the live refresh.
function critiqueRev_(raw) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, String(raw || ''));
  var hex = '';
  for (var i = 0; i < 4; i++) {
    var b = (bytes[i] + 256) % 256;
    hex += (b < 16 ? '0' : '') + b.toString(16);
  }
  return hex;
}

function critiqueXY_(x, y) {
  if (x === null || x === undefined || x === '' || y === null || y === undefined || y === '') return '';
  var nx = parseFloat(x), ny = parseFloat(y);
  if (!isFinite(nx) || !isFinite(ny)) return '';
  return (Math.round(nx * 10) / 10).toFixed(1) + ', ' + (Math.round(ny * 10) / 10).toFixed(1);
}

function critiqueParseXY_(s) {
  var m = String(s || '').match(/(-?[\d.]+)\s*,\s*(-?[\d.]+)/);
  if (!m) return null;
  var x = parseFloat(m[1]), y = parseFloat(m[2]);
  if (!isFinite(x) || !isFinite(y)) return null;
  return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
}

// JSON out, with optional JSONP. JSONP exists only as the CORS escape hatch: a
// <script> tag is not an XHR, so no CORS rules apply to it at all.
function critiqueJsonOut_(obj, callback) {
  var body = JSON.stringify(obj);
  if (callback && /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(callback)) {
    return ContentService.createTextOutput(callback + '(' + body + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(body)
    .setMimeType(ContentService.MimeType.JSON);
}

// Resolve the spreadsheet: the explicit id if set, otherwise the one this
// project is bound to. The fallback exists so the editor self-test works before
// you have gone hunting for the id — NOT as the deployed configuration.
function critiqueOpenSpreadsheet_() {
  var id = String(CRITIQUE_SPREADSHEET_ID || '');
  if (id && id.indexOf('PASTE_') !== 0) {
    // Deliberately NOT a length/shape pre-check: Drive ids vary (older files are
    // shorter than the modern 44 chars), so a guessed minimum would reject a
    // valid id. Instead let openById fail and turn its opaque "Illegal
    // spreadsheet id or key" into a message that names the CORRECT id.
    try {
      return { ss: SpreadsheetApp.openById(id), via: 'CRITIQUE_SPREADSHEET_ID' };
    } catch (e) {
      var hint = '';
      try {
        var bound = SpreadsheetApp.getActiveSpreadsheet();
        if (bound) {
          hint = ' This project is bound to ' + bound.getId() + ' (' +
                 bound.getId().length + ' chars) — use that.';
        }
      } catch (e2) { /* no bound spreadsheet in this context */ }
      throw new Error('CRITIQUE_SPREADSHEET_ID ("' + id + '", ' + id.length +
        ' chars) could not be opened: ' + String(e.message || e) +
        ' A Sheets id is usually 44 characters, so a shorter one is probably a ' +
        'copy that stopped early.' + hint);
    }
  }
  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return { ss: active, via: 'bound spreadsheet (id not set)' };
  throw new Error('CRITIQUE_SPREADSHEET_ID is not set and there is no bound ' +
    'spreadsheet in this execution context. Set the id: it is the long string ' +
    'between /d/ and /edit in the sheet URL.');
}

function critiqueIsSandbox_(p) {
  if (!p) return false;
  var v = p.sandbox;
  if (v === true || v === 1) return true;
  var s = String(v == null ? '' : v).trim().toLowerCase();
  if (s === '1' || s === 'true' || s === 'yes' || s === 'sandbox') return true;
  // Leftover review links from the first sandbox build used view=sandbox.
  // That label is displayed in element-review, so NEW links must not set view=.
  // Keep matching it so those old tabs still file to the sandbox after deploy.
  var view = String((p.view || p.View) || '').trim().toLowerCase();
  return view === 'sandbox' || view === 'sat-sandbox' || view === 'satellite-sandbox';
}

function critiqueSandboxNames_() {
  return {
    sat: (typeof SATELLITE_SANDBOX_SHEET === 'string') ? SATELLITE_SANDBOX_SHEET : 'Satellite Sandbox',
    log: (typeof CRITIQUE_SANDBOX_SHEET === 'string') ? CRITIQUE_SANDBOX_SHEET : 'Element Critique Sandbox'
  };
}

function critiqueOpenSatSheet_(p) {
  var opened = critiqueOpenSpreadsheet_();
  var sandbox = critiqueIsSandbox_(p);
  var name = sandbox ? critiqueSandboxNames_().sat : SATELLITE_SHEET;
  var sheet = opened.ss.getSheetByName(name);
  if (!sheet) throw new Error('sheet "' + name + '" not found' +
    (sandbox ? ' — run Property Intel → Satellite Sandbox → Set Up Sandbox Tabs' : ''));
  return { ss: opened.ss, sheet: sheet, via: opened.via, sandbox: sandbox };
}

function critiqueViewOf_(p) {
  return String((p && (p.view || p.View)) || '').trim().toLowerCase();
}

function critiqueOpenDtSheet_() {
  if (typeof DT_SHEET !== 'string') {
    throw new Error('drone-test.gs is not in this project — cannot look up a drone-test row');
  }
  var opened = critiqueOpenSpreadsheet_();
  var sheet = opened.ss.getSheetByName(DT_SHEET);
  if (!sheet) throw new Error('sheet "' + DT_SHEET + '" not found');
  return { ss: opened.ss, sheet: sheet, via: opened.via };
}

// Resolve a row from key | name | addr, in that order of trust. NEVER silently
// picks the first of several matches — a critique filed against the wrong
// property is worse than a visible error.
function critiqueFindRow_(sheet, p) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error('satellite sheet has no data rows');
  var width = Math.max(sheet.getLastColumn(), SAT_COL_UPLOAD_DATE);
  var data = sheet.getRange(2, 1, lastRow - 1, width).getValues();

  // Resolution order, most exact first. site_no is the sheet's own primary key
  // as of the rekey, so it goes ahead of the hash: it needs no salt, no hashing
  // and no guessing, and it is what a human reading the sheet can check.
  var site = String(p.site_no || p.site || '').trim();
  var key = String(p.key || '').trim();
  var addr = String(p.addr || p.address || '').trim();
  // ⚠️ NAME IS LAST AND IS NOT A KEY. The July export has 145 duplicate-name
  // groups — MOSAIC MEDICAL is 7 different clinics. It stays only as a
  // last-resort human convenience, and it reports "ambiguous" rather than
  // guessing.
  var name = String(p.name || '').trim();
  if (!site && !key && !addr && !name) {
    throw new Error('need one of site_no, key, addr or name');
  }

  var salt = key ? getCredentials().hashSalt : null;
  var hits = [];

  for (var i = 0; i < data.length; i++) {
    var rowSite = critiqueSiteNoOf_(data[i]);
    var rowName = String(data[i][SAT_COL_ACCOUNT - 1] || '').trim();
    // A row with no site_no cannot be identified or published at all, so it is
    // not a candidate for any lookup. The rebuilt tab gives every row one (the
    // 75 without a real number carry a VY- placeholder), so this only skips
    // genuinely broken rows.
    if (!rowSite) continue;
    var match = false;
    if (site) {
      match = (critiqueNorm_(rowSite) === critiqueNorm_(site));
    } else if (key) {
      // Only hash rows whose site_no is valid: hashId('') looks like a real hash
      // and would match a key derived the same wrong way.
      match = critiqueValidSite_(rowSite) && (critiqueSiteId_(rowSite, salt) === key);
    } else if (addr) {
      match = (critiqueNorm_(data[i][SAT_COL_ADDRESS - 1]) === critiqueNorm_(addr));
    } else {
      match = (critiqueNorm_(rowName) === critiqueNorm_(name));
    }
    if (match) hits.push({ row: i + 2, vals: data[i] });
  }

  if (!hits.length) throw new Error('no row matched');
  if (hits.length > 1) {
    throw new Error('ambiguous — ' + hits.length + ' rows matched (' +
      hits.map(function (h) { return 'row ' + h.row + ' (site ' +
        critiqueSiteNoOf_(h.vals) + ')'; }).join(', ') +
      '). Use ?site_no= — it is unique by construction.');
  }
  return hits[0];
}

// drone-test identity is the taxlot (clip/render key), not satellite site_no.
// Address is last and must be unique on THIS tab — 862 Bethel Dr is two
// Satellite rows (VY-IN-A03 / CHT-81) and must not be guessed there.
function critiqueFindDtRow_(sheet, p) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error('drone-test sheet has no data rows');
  var width = Math.max(sheet.getLastColumn(), DT_COL_SITE_NO);
  var data = sheet.getRange(2, 1, lastRow - 1, width).getValues();

  var key  = String(p.key || p.taxlot || '').trim();
  var addr = String(p.addr || p.address || '').trim();
  var name = String(p.name || '').trim();
  var site = String(p.site_no || p.site || '').trim();
  if (!key && !addr && !name && !site) {
    throw new Error('drone-test review needs key (taxlot), addr, or name');
  }

  var hits = [];
  for (var i = 0; i < data.length; i++) {
    var match = false;
    if (key) {
      match = (critiqueNorm_(data[i][DT_COL_TAXLOT - 1]) === critiqueNorm_(key));
    } else if (site) {
      match = (critiqueNorm_(data[i][DT_COL_SITE_NO - 1]) === critiqueNorm_(site));
    } else if (addr) {
      match = (critiqueNorm_(data[i][DT_COL_ADDRESS - 1]) === critiqueNorm_(addr));
    } else {
      match = (critiqueNorm_(data[i][DT_COL_ACCOUNT - 1]) === critiqueNorm_(name));
    }
    if (match) hits.push({ row: i + 2, vals: data[i] });
  }

  if (!hits.length) throw new Error('no drone-test row matched');
  if (hits.length > 1) {
    throw new Error('ambiguous — ' + hits.length + ' drone-test rows matched (' +
      hits.map(function (h) {
        return 'row ' + h.row + ' (taxlot ' +
          String(h.vals[DT_COL_TAXLOT - 1] || '').trim() + ')';
      }).join(', ') +
      '). Re-open from the Drone Test menu so the link includes the taxlot key.');
  }
  return hits[0];
}

// Create the tab on first use, and widen an existing one if CRITIQUE_PIN_SLOTS
// grows. Never rewrites populated header cells beyond appending.
// Returns null when the tab is absent and this is a read.
//
// `forWrite` false = a pure READ. It must not create the tab, and — as of
// 2026-08-14 — must not rewrite the header either.
//
// ⚠️ THE BUG THIS FIXES. The parameter used to be `createIfMissing`, and it only
// guarded the insertSheet(). Everything below it still ran on a read, so calling
// this from the GET route or from critiqueSelfTest_ silently REWROTE the header
// row — which is exactly what happened: the self-test relabelled the tab from 91
// to 92 columns while printing "read-only: this test writes nothing". Benign that
// time because the tab was empty, but a read that mutates the sheet is a lie in
// the code, and the same class of bug as the earlier "a GET created the tab".
function critiqueEnsureLogSheet_(ss, forWrite, sheetName) {
  var headers = critiqueHeaders_();
  var name = sheetName || CRITIQUE_SHEET;
  var sh = ss.getSheetByName(name);
  if (!sh) {
    if (!forWrite) return null;
    sh = ss.insertSheet(name);
  }
  // Hand a reader the tab exactly as it stands. Readers locate their columns from
  // the sheet's OWN header row (see critiqueNextRound_), so they do not need this
  // layout imposed on them first.
  if (!forWrite) return sh;

  if (sh.getMaxColumns() < headers.length) {
    var step = 20;
    while (sh.getMaxColumns() < headers.length) {
      var add = Math.min(step, headers.length - sh.getMaxColumns());
      sh.insertColumnsAfter(sh.getMaxColumns(), add);
      SpreadsheetApp.flush();
    }
  }
  var existing = sh.getRange(1, 1, 1, headers.length).getValues()[0];
  var firstMismatch = -1;
  for (var i = 0; i < headers.length; i++) {
    if (String(existing[i] || '').trim() !== headers[i]) { firstMismatch = i; break; }
  }
  if (firstMismatch !== -1) {
    // If the tab already holds submissions, relabelling the header would leave
    // every historical row silently misaligned under the new names — the worst
    // failure an audit tab can have, because it looks fine. Appending NEW
    // trailing columns is safe; anything else has to be a human decision.
    var hasData = sh.getLastRow() > 1;
    var pureExtension = hasData && String(existing[firstMismatch] || '').trim() === '';
    if (hasData && !pureExtension) {
      throw new Error('"' + name + '" has ' + (sh.getLastRow() - 1) +
        ' existing row(s) and its header no longer matches this layout (first ' +
        'difference at column ' + (firstMismatch + 1) + ': found "' +
        String(existing[firstMismatch] || '') + '", expected "' + headers[firstMismatch] +
        '"). Rename that tab (e.g. "' + name + ' v1") and a fresh one will ' +
        'be created, so the old rows keep their own header.');
    }
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
    // 4, not 3: Site No was inserted at column 2, and the point of freezing here
    // is to keep the identity columns visible while scrolling 92 columns sideways
    // — Submitted At · Site No · Property Key · Account Name.
    sh.setFrozenColumns(4);
  }
  return sh;
}

// Round n+1 for this property, read from the log's own Round column. A null
// sheet means the tab does not exist yet, so nothing has been filed: round 1.
//
// ⚠️ Columns are located BY HEADER NAME, not by a hardcoded offset. The previous
// version read `getRange(2, 2, n, 5)` and trusted "Property Key is r[0], Round is
// r[4]" — inserting Site No at column 2 shifted both and would have silently
// compared a key against a site_no and read Reviewer as the round number. The
// row WRITER already worked by header name; the reader had not caught up.
//
// Matches on SITE NO, which is the identity now, and falls back to Property Key
// so rows filed before the rekey still resolve.
//
// ⚠️ Columns are located from the SHEET'S OWN header row, not from
// critiqueHeaders_(). Those two disagree exactly when the tab predates a layout
// change — which is the moment this function is most likely to be wrong. Using
// the code's layout against a 91-column sheet would read Property Key out of the
// Site No column and Reviewer as the round number, and report a plausible number
// either way. Reading the sheet's own labels also means a read never has to
// rewrite the header to make itself correct.
function critiqueNextRound_(logSheet, siteNo, key) {
  if (!logSheet) return 1;
  var lastRow = logSheet.getLastRow();
  if (lastRow < 2) return 1;
  if (!siteNo && !key) return 1;

  var lastCol = Math.max(1, logSheet.getLastColumn());
  var headers = logSheet.getRange(1, 1, 1, lastCol).getValues()[0]
                        .map(function (c) { return String(c || '').trim(); });
  var cSite = headers.indexOf('Site No');
  var cKey = headers.indexOf('Property Key');
  var cRound = headers.indexOf('Round');
  if (cRound === -1) return 1;

  var width = Math.max(cSite, cKey, cRound) + 1;
  var vals = logSheet.getRange(2, 1, lastRow - 1, width).getValues();
  var wantSite = critiqueNorm_(siteNo);
  var max = 0;
  vals.forEach(function (r) {
    var same = false;
    if (wantSite && cSite !== -1 && critiqueNorm_(r[cSite]) === wantSite) same = true;
    else if (key && cKey !== -1 && String(r[cKey] || '').trim() === key) same = true;
    if (!same) return;
    var n = parseInt(r[cRound], 10);
    if (isFinite(n) && n > max) max = n;
  });
  return max + 1;
}

// Rebuild a pin array from one Element Critique row.
//   published — Pin n XY only (what Pass 1 / the last re-pin showed). Skips
//               additions, which have no published position.
//   result    — after the reviewer's verdicts: OK/blank keep XY, FIX/ADD use
//               Fix XY, REMOVE drops. A moved pin with a blank verdict still
//               uses Fix XY (the ALLISON DERMATOLOGY case).
function critiquePinsFromLogRow_(headers, rowVals, mode) {
  var idx = {};
  (headers || []).forEach(function (h, i) { idx[String(h || '').trim()] = i; });
  var pins = [];
  var want = String(mode || 'result');
  for (var n = 1; n <= CRITIQUE_PIN_SLOTS; n++) {
    var idAt = idx['Pin ' + n + ' ID'];
    if (idAt === undefined) break;
    var id = parseInt(rowVals[idAt], 10);
    if (!isFinite(id)) continue;
    var verdict = String(rowVals[idx['Pin ' + n + ' Verdict']] || '').trim().toLowerCase();
    var pub = critiqueParseXY_(rowVals[idx['Pin ' + n + ' XY']]);
    var fix = critiqueParseXY_(rowVals[idx['Pin ' + n + ' Fix XY']]);
    if (want === 'published') {
      if (verdict === 'added') continue;
      if (!pub) continue;
      pins.push({ id: id, x: pub.x, y: pub.y });
      continue;
    }
    if (verdict === 'remove') continue;
    var xy = null;
    if (verdict === 'added') xy = fix;
    else if (verdict === 'fix' || (fix && verdict !== 'ok')) xy = fix || pub;
    else xy = pub || fix;
    if (!xy) continue;
    pins.push({ id: id, x: xy.x, y: xy.y });
  }
  return pins;
}

function critiqueStamp_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime())) {
    return v.toISOString();
  }
  return String(v || '').trim();
}

// Every filed critique for this site, plus Round 0 (Bedrock) when we can
// recover it from the first review's published XY.
function critiqueHistoryFor_(logSheet, siteNo, key) {
  var empty = { next_round: 1, bedrock: null, rounds: [] };
  if (!logSheet) return empty;
  var lastRow = logSheet.getLastRow();
  if (lastRow < 2) return empty;
  if (!siteNo && !key) return empty;

  var lastCol = Math.max(1, logSheet.getLastColumn());
  var headers = logSheet.getRange(1, 1, 1, lastCol).getValues()[0]
                        .map(function (c) { return String(c || '').trim(); });
  var cSite = headers.indexOf('Site No');
  var cKey = headers.indexOf('Property Key');
  var cRound = headers.indexOf('Round');
  var cWho = headers.indexOf('Reviewer');
  var cAt = headers.indexOf('Submitted At');
  if (cRound === -1) return empty;

  var vals = logSheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var wantSite = critiqueNorm_(siteNo);
  var byRound = {};
  vals.forEach(function (r) {
    var same = false;
    if (wantSite && cSite !== -1 && critiqueNorm_(r[cSite]) === wantSite) same = true;
    else if (key && cKey !== -1 && String(r[cKey] || '').trim() === key) same = true;
    if (!same) return;
    var n = parseInt(r[cRound], 10);
    if (!isFinite(n) || n < 1) return;
    var rec = {
      round: n,
      reviewer: cWho === -1 ? '' : String(r[cWho] || '').trim(),
      submitted_at: cAt === -1 ? '' : critiqueStamp_(r[cAt]),
      pins: critiquePinsFromLogRow_(headers, r, 'result'),
      published: critiquePinsFromLogRow_(headers, r, 'published')
    };
    var prev = byRound[n];
    if (!prev || String(rec.submitted_at) > String(prev.submitted_at)) byRound[n] = rec;
  });
  var rounds = Object.keys(byRound).map(function (k) { return parseInt(k, 10); })
                 .sort(function (a, b) { return a - b; })
                 .map(function (k) { return byRound[k]; });
  var next = 1;
  rounds.forEach(function (r) { if (r.round >= next) next = r.round + 1; });
  var bedrock = rounds.length ? rounds[0].published : null;
  return { next_round: next, bedrock: bedrock, rounds: rounds };
}

function critiqueGetRounds_(p) {
  if (critiqueViewOf_(p) === 'drone-test') {
    var dt = critiqueGetDtElements_(p);
    return {
      ok: true,
      route: 'rounds',
      view: 'drone-test',
      sandbox: false,
      site_no: dt.site_no || '',
      key: dt.key || '',
      next_round: dt.next_round || 1,
      current: dt.pins || [],
      bedrock: dt.pins || [],
      rounds: []
    };
  }
  var h = critiqueOpenSatSheet_(p);
  var el = critiqueGetElements_(p);
  var logName = h.sandbox ? critiqueSandboxNames_().log : CRITIQUE_SHEET;
  var hist = { next_round: el.next_round || 1, bedrock: null, rounds: [] };
  try {
    hist = critiqueHistoryFor_(critiqueEnsureLogSheet_(h.ss, false, logName),
                               el.site_no, el.key);
  } catch (e) {
    Logger.log('critiqueGetRounds_ history: ' + e.message);
  }
  return {
    ok: true,
    route: 'rounds',
    sandbox: !!h.sandbox,
    site_no: el.site_no,
    key: el.key,
    next_round: hist.next_round || el.next_round || 1,
    current: el.pins || [],
    bedrock: hist.bedrock || el.pins || [],
    rounds: (hist.rounds || []).map(function (r) {
      return {
        round: r.round,
        reviewer: r.reviewer,
        submitted_at: r.submitted_at,
        pins: r.pins
      };
    })
  };
}

// ── GET route: serve the row's nadir + element pins ─────────────────────────
// This is the viewer's live-refresh source. `rev` changes whenever the elements
// cell changes, so the page can poll cheaply and re-render only on a real
// change; `fixes_pending` lets it say "round N+1 in progress" instead of
// looking idle.
function critiqueGetElements_(p) {
  if (critiqueViewOf_(p) === 'drone-test') return critiqueGetDtElements_(p);
  var h = critiqueOpenSatSheet_(p);
  var hit = critiqueFindRow_(h.sheet, p);
  var v = hit.vals;

  var elementsRaw = String(v[SAT_COL_ELEMENTS - 1] || '').trim();
  var errored = elementsRaw.indexOf('ERROR:') === 0;
  var lat = parseFloat(v[SAT_COL_LAT - 1]);
  var lng = parseFloat(v[SAT_COL_LNG - 1]);
  var accountName = String(v[SAT_COL_ACCOUNT - 1] || '').trim();
  var siteNo = critiqueSiteNoOf_(v);
  // A row without a valid site_no has no published id, so return '' rather than
  // hashing a blank into something that looks like a key.
  var propKey = critiqueValidSite_(siteNo)
    ? critiqueSiteId_(siteNo, getCredentials().hashSalt) : '';
  var logName = h.sandbox ? critiqueSandboxNames_().log : CRITIQUE_SHEET;

  var out = {
    ok: true,
    route: 'elements',
    sandbox: !!h.sandbox,
    row: hit.row,
    site_no: siteNo,
    key: propKey,
    name: accountName,
    address: String(v[SAT_COL_ADDRESS - 1] || '').trim(),
    account_type: normalizeAccountType(v[SAT_COL_ACCOUNT_TYPE - 1]),
    nadir_url: String(v[SAT_COL_NADIR_URL - 1] || '').trim(),
    // parsePinCell_ (Satellite.gs) is the ONE parser for this cell — reused here
    // so the API and the GitHub sync can never disagree about a pin.
    pins: errored ? [] : parsePinCell_(elementsRaw),
    pin_error: errored ? elementsRaw : '',
    reviewed: v[SAT_COL_REVIEWED - 1] === true,
    fixes_pending: String(v[SAT_COL_FIXES - 1] || '').trim() !== '',
    rev: critiqueRev_(elementsRaw),
    // What a re-pin will EMIT. Satellite diverged to 12 on 2026-08-13 (the 10-pin
    // cap was truncating ~45% of properties); schools moved to 20 on 2026-08-27.
    // Report the row's number so the viewer's advisory matches reality.
    max_pins: (typeof satMaxPins_ === 'function')
      ? satMaxPins_(v[SAT_COL_ACCOUNT_TYPE - 1])
      : ((typeof SAT_MAX_PINS === 'number') ? SAT_MAX_PINS : PLANE_MAX_PINS),
    rerun_automated: CRITIQUE_QUEUE_RERUN,
    server_time: new Date().toISOString()
  };
  if (!isNaN(lat) && !isNaN(lng)) { out.lat = lat; out.lng = lng; }

  try {
    // false: a GET must never create the tab.
    out.next_round = critiqueNextRound_(critiqueEnsureLogSheet_(h.ss, false, logName),
                                        out.site_no, out.key);
  } catch (e) {
    out.next_round = 1;
  }
  return out;
}

function critiqueGetDtElements_(p) {
  var h = critiqueOpenDtSheet_();
  var hit = critiqueFindDtRow_(h.sheet, p);
  var v = hit.vals;

  var elementsRaw = String(v[DT_COL_ELEMENTS - 1] || '').trim();
  var errored = elementsRaw.indexOf('ERROR:') === 0;
  var lat = parseFloat(v[DT_COL_LAT - 1]);
  var lng = parseFloat(v[DT_COL_LNG - 1]);
  var accountName = String(v[DT_COL_ACCOUNT - 1] || '').trim();
  var taxlot = String(v[DT_COL_TAXLOT - 1] || '').trim();
  var siteNo = String(v[DT_COL_SITE_NO - 1] || '').trim();

  var out = {
    ok: true,
    route: 'elements',
    view: 'drone-test',
    row: hit.row,
    site_no: siteNo,
    key: taxlot,
    name: accountName,
    address: String(v[DT_COL_ADDRESS - 1] || '').trim(),
    account_type: normalizeAccountType(v[DT_COL_ACCOUNT_TYPE - 1]),
    nadir_url: String(v[DT_COL_NADIR_URL - 1] || '').trim(),
    pins: errored ? [] : parsePinCell_(elementsRaw),
    pin_error: errored ? elementsRaw : '',
    reviewed: v[DT_COL_REVIEWED - 1] === true,
    fixes_pending: String(v[DT_COL_FIXES - 1] || '').trim() !== '',
    rev: critiqueRev_(elementsRaw),
    max_pins: (typeof PLANE_MAX_PINS === 'number') ? PLANE_MAX_PINS : 10,
    rerun_automated: CRITIQUE_QUEUE_RERUN,
    server_time: new Date().toISOString()
  };
  if (!isNaN(lat) && !isNaN(lng)) { out.lat = lat; out.lng = lng; }

  try {
    out.next_round = critiqueNextRound_(critiqueEnsureLogSheet_(h.ss, false),
                                        siteNo, taxlot);
  } catch (e) {
    out.next_round = 1;
  }
  return out;
}

// ── POST route: file a critique ─────────────────────────────────────────────

// Turn the structured critique into the prose note planeElementRerunInstruction_
// feeds back to Bedrock. Only actionable items go in: an OK with no comment
// would just pad the prompt. The v5 viewer guarantees that an OK or Remove pin
// carries no note and no correction, so nothing is being silently dropped here.
//
// Coordinates are included because they are the whole point of the drag UI: a
// re-pin is far more accurate given "move to (58.4, 44.1)" than any prose
// description of the same correction.
//
// ⚠️ `pin_requests` is NOT a parameter here and must never become one. A request
// for a catalog element that does not exist yet is not an instruction about this
// property; feeding it to Bedrock would invite invented ids, and the vocabulary
// is a closed list validateElementPins_ enforces. Requests go to the sheet only.
// Which pins did the analyst NOT ask to change?
//
// A pin is PROTECTED when the analyst did not ask to remove it and did not
// ask to change its id. Blank/'ok' with no note is the original case
// (PRIDESTAFF add-only wipe). A FIX that only MOVES the pin is the same
// contract: keep that id, at the coordinate they gave. The model is still
// allowed to change the id when the verdict is 'fix' with no corrected xy
// (wrong label, no drag).
function critiqueProtectedIds_(p) {
  var out = [];
  ((p && p.elements) || []).forEach(function (el) {
    var v = String(el.verdict || '').toLowerCase();
    if (v === 'remove') return;
    var moved = !!critiqueXY_(el.corrected_x, el.corrected_y);
    if (v === 'fix' && !moved) return;
    if (!moved && String(el.note || '').trim()) return;
    var id = parseInt(el.id, 10);
    if (isFinite(id)) out.push({
      seq: parseInt(el.seq, 10),
      id: id,
      name: String(el.name || ('#' + id)),
      x: el.x,
      y: el.y,
      wantX: moved ? el.corrected_x : el.x,
      wantY: moved ? el.corrected_y : el.y
    });
  });
  return out;
}

// Names of protected pins the re-pin failed to return. Empty means the round is safe.
//
// ⚠️ THE INCIDENT THIS EXISTS FOR (2026-08-17, PRIDESTAFF site 100024245).
// Round 2's critique was a single "ADD #2 Apartment Building" and nothing else.
// The model read the correction list as the COMPLETE answer and returned one pin,
// destroying the five the analyst had left alone — and because the note is
// consumed on success, there was nothing to retry from. Round 1 on the same
// property was correct, which is the tell: an ADD-only critique is the dangerous
// shape, because the list of corrections reads like a list of pins.
// satElementRerunInstruction_ has been strengthened, but a prompt is a request,
// not a guarantee. This check is the guarantee.
function critiquePinLoss_(p, beforeRaw, after) {
  var beforeList = [];
  try {
    beforeList = parsePinCell_(beforeRaw);
  } catch (e) { return []; }
  var claimed = (after || []).map(function () { return false; });
  var lost = [];
  critiqueProtectedIds_(p).forEach(function (inst) {
    var onRow = false;
    var b;
    for (b = 0; b < beforeList.length; b++) {
      if (parseInt(beforeList[b].id, 10) === inst.id &&
          critiqueSameSpot_(beforeList[b], inst.x, inst.y)) {
        onRow = true;
        break;
      }
    }
    if (!onRow) {
      for (b = 0; b < beforeList.length; b++) {
        if (parseInt(beforeList[b].id, 10) === inst.id) { onRow = true; break; }
      }
    }
    if (!onRow) return;
    var i = critiqueClaimPin_(after || [], claimed, inst.id, inst.wantX, inst.wantY);
    if (i < 0) i = critiqueClaimPin_(after || [], claimed, inst.id, inst.x, inst.y);
    if (i < 0) {
      lost.push(inst.name + ' (#' + inst.id +
        (isFinite(inst.seq) ? ', pin ' + inst.seq : '') + ')');
    }
  });
  return lost;
}

// Bedrock will not emit x,y outside 0–100 (the Pass 1 prompt says the nadir
// frame is the whole world). A reviewer who dragged onto the live basemap
// stores percentages <0 or >100. The model then DROPS that pin, and the
// pin-loss guard used to treat FIX as fair game, so the note was consumed
// and the pin vanished (Baert / Boyd Ct, 2026-08-28). The structured
// payload is the authority: write those coordinates after the re-pin.
var CRITIQUE_COORD_ABS_MAX = 500;
var CRITIQUE_SPOT_EPS = 0.15; // 1.5x the 0.1 rounding quantum

function critiqueRoundXY_(x, y) {
  var nx = parseFloat(x), ny = parseFloat(y);
  if (!isFinite(nx) || !isFinite(ny)) return null;
  if (Math.abs(nx) > CRITIQUE_COORD_ABS_MAX || Math.abs(ny) > CRITIQUE_COORD_ABS_MAX) return null;
  return { x: Math.round(nx * 10) / 10, y: Math.round(ny * 10) / 10 };
}

function critiqueSameSpot_(pin, x, y) {
  var c = critiqueRoundXY_(x, y);
  if (!c || !pin) return false;
  return Math.abs(parseFloat(pin.x) - c.x) <= CRITIQUE_SPOT_EPS &&
         Math.abs(parseFloat(pin.y) - c.y) <= CRITIQUE_SPOT_EPS;
}

function critiqueFindPinAt_(pins, id, x, y) {
  var n = parseInt(id, 10);
  var i;
  for (i = 0; i < pins.length; i++) {
    if (parseInt(pins[i].id, 10) === n && critiqueSameSpot_(pins[i], x, y)) return i;
  }
  return -1;
}

// Claim the unused instance at this id+xy. Do not fall back to another
// placed pin that shares the catalog id — that is how pin 10 stole pin 9.
function critiqueClaimPin_(pins, claimed, id, x, y) {
  var n = parseInt(id, 10);
  var i;
  if (!isFinite(parseFloat(x)) || !isFinite(parseFloat(y))) return -1;
  for (i = 0; i < pins.length; i++) {
    if (claimed[i]) continue;
    if (parseInt(pins[i].id, 10) === n && critiqueSameSpot_(pins[i], x, y)) {
      claimed[i] = true;
      return i;
    }
  }
  return -1;
}

// Label-only FIX may change catalog id. Match the unused pin at this spot,
// never another instance of the old id sitting elsewhere.
function critiqueClaimUnusedAt_(pins, claimed, x, y) {
  var i;
  if (!isFinite(parseFloat(x)) || !isFinite(parseFloat(y))) return -1;
  for (i = 0; i < pins.length; i++) {
    if (claimed[i]) continue;
    if (critiqueSameSpot_(pins[i], x, y)) {
      claimed[i] = true;
      return i;
    }
  }
  return -1;
}

function critiqueFirstPinId_(pins, id) {
  var n = parseInt(id, 10);
  var i;
  for (i = 0; i < pins.length; i++) {
    if (parseInt(pins[i].id, 10) === n) return i;
  }
  return -1;
}

// Relocate the instance at fromX/fromY. If that spot is gone, append — never
// steal another placed pin that shares the catalog id.
function critiqueForceMove_(pins, id, fromX, fromY, toX, toY, claimed) {
  var n = parseInt(id, 10);
  var c = critiqueRoundXY_(toX, toY);
  if (!isFinite(n) || n < 1 || !c) return;
  if (!claimed) claimed = pins.map(function () { return false; });
  var i = critiqueClaimPin_(pins, claimed, n, fromX, fromY);
  if (i < 0) i = critiqueClaimPin_(pins, claimed, n, c.x, c.y);
  if (i >= 0) {
    pins[i] = { id: n, x: c.x, y: c.y };
    return;
  }
  if (pins.length < CRITIQUE_PIN_SLOTS) {
    claimed.push(true);
    pins.push({ id: n, x: c.x, y: c.y });
  }
}

function critiqueForceAdd_(pins, id, x, y) {
  var n = parseInt(id, 10);
  var c = critiqueRoundXY_(x, y);
  if (!isFinite(n) || n < 1 || !c) return;
  if (pins.length < CRITIQUE_PIN_SLOTS) pins.push({ id: n, x: c.x, y: c.y });
}

function critiqueForcePin_(pins, id, x, y) {
  critiqueForceMove_(pins, id, null, null, x, y);
}

// Instance identity is the review-page pin NUMBER (seq — the number on the
// marker), not catalog id. Reconstruct from payload.elements in that order:
// skip only the removed seq, keep/move every other seq at its (corrected)
// xy, append added[]. Bedrock is consulted only for a label-only FIX at the
// same spot. Never steal another placed instance of the same catalog id —
// that is how moving pin 10 deleted pin 9.
function critiqueApplyForcedPins_(p, pins) {
  pins = (pins || []).slice();
  var claimed = pins.map(function () { return false; });
  var out = [];

  ((p && p.elements) || []).forEach(function (el) {
    var v = String(el.verdict || '').toLowerCase();
    var id = parseInt(el.id, 10);
    if (v === 'remove') {
      critiqueClaimPin_(pins, claimed, id, el.x, el.y);
      return;
    }
    var moved = !!critiqueXY_(el.corrected_x, el.corrected_y);
    var want = moved
      ? critiqueRoundXY_(el.corrected_x, el.corrected_y)
      : critiqueRoundXY_(el.x, el.y);
    if (!isFinite(id) || !want) return;
    if (v === 'fix' && !moved) {
      var i = critiqueClaimPin_(pins, claimed, id, el.x, el.y);
      if (i < 0) i = critiqueClaimUnusedAt_(pins, claimed, el.x, el.y);
      if (i >= 0) {
        var bid = parseInt(pins[i].id, 10);
        out.push({ id: isFinite(bid) ? bid : id, x: want.x, y: want.y });
        return;
      }
    } else {
      critiqueClaimPin_(pins, claimed, id, el.x, el.y);
    }
    out.push({ id: id, x: want.x, y: want.y });
  });

  ((p && p.added) || []).forEach(function (a) {
    var id = parseInt(a.id, 10);
    var want = critiqueRoundXY_(a.x, a.y);
    if (!isFinite(id) || !want) return;
    critiqueClaimPin_(pins, claimed, id, want.x, want.y);
    out.push({ id: id, x: want.x, y: want.y });
  });

  if (out.length > CRITIQUE_PIN_SLOTS) out = out.slice(0, CRITIQUE_PIN_SLOTS);
  return out;
}

// Is the 5-minute re-pin trigger actually installed?
//   true  = yes, a submission really will be picked up automatically
//   false = no, the note lands in Nadir Fixes and waits for a human
//   null  = could not tell (no permission, or the API threw) — say so rather
//           than guessing in either direction
//
// ScriptApp is already used by startSatElementRerunAuto/startSatElementPinsAuto
// in Satellite.gs, so the scope is declared and reading triggers adds no new
// authorization prompt. The try/catch is there in case that ever stops being
// true: an unavailable check must degrade to "unknown", never to a false promise.
// A human-readable timestamp that NAMES ITS TIMEZONE.
// Jonah works Central (Texas); Vyanet is in Oregon (Pacific). A bare "11:49 AM"
// in an audit note is read as local by whoever opens it, so the same string means
// two different moments to the two halves of the company. `z` resolves from the
// Apps Script project timezone, so this follows the project setting instead of
// hardcoding a zone that would silently drift if that setting ever changes.
function critiqueStamp_(d) {
  try {
    return Utilities.formatDate(d, Session.getScriptTimeZone(), 'M/d/yyyy h:mm:ss a z');
  } catch (e) {
    return d.toLocaleString();     // never let a label break a submission
  }
}

function critiqueRerunTriggerState_(handlerName) {
  try {
    var wanted = handlerName || 'generateSatElementRerunAutoRun';
    var found = ScriptApp.getProjectTriggers().some(function (t) {
      return t.getHandlerFunction() === wanted;
    });
    return !!found;
  } catch (e) {
    return null;
  }
}

// A corrected coordinate IS a fix, whatever the verdict chips say. The viewer
// used to let a reviewer drag a pin without ever tapping Fix, which filed a row
// where "Pin n Fix XY" held a correction, the composed note said FIX, and
// "Pin n Verdict" was blank — so the prose and the structured columns disagreed
// and "Marked Fix" undercounted. v5.6 of the viewer sets the verdict on drag;
// this normalises server-side as well, so an older cached viewer, a replayed
// payload or a hand-built one can never file that shape again.
//
// Pure and idempotent. Runs BEFORE the note and the row are built, so both read
// the same verdicts. OK and REMOVE are never overridden: both clear the
// correction in the viewer, and if one somehow arrives WITH a corrected xy then
// the explicit verdict is the reviewer's stated intent and wins.
function critiqueNormalizeVerdicts_(p) {
  ((p && p.elements) || []).forEach(function (el) {
    var v = String(el.verdict || '').toLowerCase();
    if (v === 'ok' || v === 'remove' || v === 'fix') { el.verdict = v; return; }
    el.verdict = critiqueXY_(el.corrected_x, el.corrected_y) ? 'fix' : v;
  });
  return p;
}

function critiqueComposeFixesNote_(p) {
  var lines = [];
  var who = p.reviewer ? p.reviewer : 'analyst';
  lines.push('Analyst critique — round ' + p.round + ' (' + who + ', ' + p.stamp + '):');

  (p.elements || []).forEach(function (el) {
    var verdict = String(el.verdict || '').toLowerCase();
    var note = String(el.note || '').trim();
    var fix = critiqueXY_(el.corrected_x, el.corrected_y);
    if (verdict !== 'fix' && verdict !== 'remove' && !note && !fix) return;

    var at = critiqueXY_(el.x, el.y);
    var label = 'pin ' + el.seq + ' (#' + el.id + ' ' + el.name + (at ? ' at ' + at : '') + ')';
    if (verdict === 'remove') {
      lines.push('- REMOVE ' + label + (note ? ': ' + note : '.'));
    } else if (fix) {
      lines.push('- FIX ' + label + ' — move to (' + fix + ')' + (note ? ': ' + note : '.'));
    } else {
      lines.push('- ' + (verdict === 'fix' ? 'FIX ' : 'NOTE ') + label + (note ? ': ' + note : '.'));
    }
  });

  (p.added || []).forEach(function (a) {
    var at = critiqueXY_(a.x, a.y);
    var note = String(a.note || '').trim();
    var seq = parseInt(a.seq, 10);
    var label = isFinite(seq)
      ? 'pin ' + seq + ' (#' + a.id + ' ' + a.name + ')'
      : '#' + a.id + ' ' + a.name;
    lines.push('- ADD ' + label + (at ? ' at (' + at + ')' : '') +
               (note ? ': ' + note : '.'));
  });

  var missed = String(p.missed || '').trim();
  if (missed) lines.push('- MISSED / GENERAL: ' + missed);

  // Only the header line means nothing actionable was said.
  if (lines.length === 1) return '';
  return lines.join('\n');
}

// Build the single wide row. Pure — no sheet access — so it can be unit-tested
// outside Apps Script, and so the column arithmetic lives in exactly one place.
// Submission cells are written BY HEADER NAME, not by index: inserting a column
// into the submission block used to mean renumbering a dozen literals, and that
// is precisely the edit most likely to shift data into the wrong column.
function critiqueBuildRow_(ctx) {
  var headers = critiqueHeaders_();
  var row = new Array(headers.length).fill('');
  var p = ctx.payload;
  var idx = {};
  headers.forEach(function (h, i) { idx[h] = i; });
  function set(name, value) {
    if (idx[name] === undefined) throw new Error('unknown Element Critique column "' + name + '"');
    row[idx[name]] = value;
  }

  var els = p.elements || [];
  var adds = p.added || [];
  var reqs = p.pin_requests || [];
  var count = function (v) {
    return els.filter(function (e) { return String(e.verdict || '').toLowerCase() === v; }).length;
  };

  set('Submitted At', ctx.now);
  set('Site No', ctx.siteNo);
  set('Property Key', ctx.key);
  set('Account Name', ctx.accountName);
  set('Property Address', ctx.address);
  set('Satellite Row', ctx.row);
  set('Round', ctx.round);
  set('Reviewer', String(p.reviewer || '').trim());
  set('Viewer Version', String(p.version || ''));
  set('Pins Reviewed', els.length);
  set('Pins Added', adds.length);
  set('Marked OK', count('ok'));
  set('Marked Fix', count('fix'));
  set('Marked Remove', count('remove'));
  set('Repositioned', els.filter(function (e) { return !!e.moved; }).length);
  set('Missed / General Notes', String(p.missed || '').trim());
  // Catalog requests: recorded here and NOWHERE else. They are not instructions
  // about this property, so they never enter the Nadir Fixes note.
  set('Pin Requests', reqs.length);
  set('New Pin Element Requests', reqs.map(function (r) {
    var n = String(r.name || '').trim();
    var note = String(r.note || '').trim();
    return note ? n + ' — ' + note : n;
  }).filter(function (s) { return s !== ''; }).join('\n'));
  set('Fixes Note Sent', ctx.note);
  set('Rerun Status', ctx.rerunStatus);

  var base = CRITIQUE_SUBMISSION_HEADERS.length;
  var stride = CRITIQUE_PIN_FIELDS.length;
  // Pins with no slot. Returned to the caller, which REFUSES the whole
  // submission rather than writing a row that quietly omits them.
  var overCap = [];

  // Slot by seq, so a slot number always equals the pin number the reviewer saw
  // on the marker, the card and the legend row.
  //
  // The id is coerced to a NUMBER. Confirmed pins carry whatever type the
  // Nadir Elements cell held (validateElementPins_ writes integers, but a
  // hand-edited cell can hold "101"), while an added pin is already an int from
  // the viewer. Left alone, one column would mix 101 and "101" and every lookup
  // or pivot against it would quietly half-work.
  function place(seq, id, name, verdict, xy, fixXy, desc) {
    var slot = parseInt(seq, 10);
    var nid = parseInt(id, 10);
    if (isFinite(nid)) id = nid;
    if (!isFinite(slot) || slot < 1 || slot > CRITIQUE_PIN_SLOTS) {
      overCap.push('pin ' + seq + ' (#' + id + ' ' + name + ')');
      return;
    }
    var o = base + (slot - 1) * stride;
    row[o]     = id;
    row[o + 1] = name;
    row[o + 2] = verdict;
    row[o + 3] = xy;
    row[o + 4] = fixXy;
    row[o + 5] = desc;
  }

  els.forEach(function (e) {
    place(e.seq, e.id, e.name, String(e.verdict || ''),
          critiqueXY_(e.x, e.y), critiqueXY_(e.corrected_x, e.corrected_y),
          String(e.note || '').trim());
  });
  // An addition has no published position, so "Pin n XY" stays blank and its
  // chosen coordinate goes in "Fix XY" — the same column a correction uses,
  // because both answer "where should this pin be".
  adds.forEach(function (a) {
    place(a.seq, a.id, a.name, 'added', '', critiqueXY_(a.x, a.y),
          String(a.note || '').trim());
  });

  return { row: row, overCap: overCap, headerCount: headers.length };
}

function critiquePostDt_(p) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) {
    return { ok: false, error: 'sheet busy (a re-run is in progress) — try again in a moment' };
  }
  try {
    critiqueNormalizeVerdicts_(p);

    var h = critiqueOpenDtSheet_();
    var hit = critiqueFindDtRow_(h.sheet, p);
    var v = hit.vals;
    var row = hit.row;

    var accountName = String(v[DT_COL_ACCOUNT - 1] || '').trim();
    var address = String(v[DT_COL_ADDRESS - 1] || '').trim();
    var taxlot = String(v[DT_COL_TAXLOT - 1] || '').trim();
    var siteNo = String(v[DT_COL_SITE_NO - 1] || '').trim();
    var key = taxlot || ('dt-row-' + row);

    var round = parseInt(p.round, 10);
    if (!isFinite(round) || round < 1) {
      round = critiqueNextRound_(critiqueEnsureLogSheet_(h.ss, false), siteNo, key);
    }

    var now = new Date();
    var note = critiqueComposeFixesNote_({
      round: round,
      reviewer: String(p.reviewer || '').trim(),
      stamp: critiqueStamp_(now),
      elements: p.elements || [],
      added: p.added || [],
      missed: p.missed || ''
    });
    var reqCount = (p.pin_requests || []).length;

    var willQueue = CRITIQUE_QUEUE_RERUN && !!note;
    var rerunStatus;
    var trigState = null;
    if (willQueue) {
      if (CRITIQUE_RERUN_MODE === 'inline') {
        rerunStatus = '';
      } else {
        rerunStatus = 'note written to Nadir Fixes — run Rerun Pins from Fixes (This Row) on the Drone Test menu';
      }
    } else if (!note) {
      rerunStatus = reqCount ? 'catalog request only — no re-pin needed' : 'nothing actionable';
    } else {
      rerunStatus = 'not queued — run the rerun from the Drone Test menu';
    }

    var built = critiqueBuildRow_({
      payload: p, now: now, siteNo: siteNo || ('dt:' + key), key: key,
      accountName: accountName, address: address, row: row, round: round,
      note: note, rerunStatus: rerunStatus
    });

    if (built.overCap.length) {
      var total = (p.elements || []).length + (p.added || []).length;
      return { ok: false,
        error: 'This round carries ' + total + ' pins but the sheet has ' +
          CRITIQUE_PIN_SLOTS + ' slots, so nothing was saved. No slot for ' +
          built.overCap.join(', ') + '.' };
    }

    var log = critiqueEnsureLogSheet_(h.ss, true);
    var logRow = log.getLastRow() + 1;
    log.getRange(logRow, 1, 1, built.headerCount).setValues([built.row]);
    log.getRange(logRow, 1).setNumberFormat('M/d/yyyy h:mm:ss am/pm');

    var queued = false;
    var rerunRan = null;
    var rerunError = '';
    var freshPins = null;
    var freshRev = null;

    if (willQueue) {
      writePlainCell(h.sheet, row, DT_COL_FIXES, note);
      h.sheet.getRange(row, DT_COL_REVIEWED).setValue(false);
      SpreadsheetApp.flush();
      queued = true;

      if (CRITIQUE_RERUN_MODE === 'inline') {
        var beforeRaw = String(h.sheet.getRange(row, DT_COL_ELEMENTS).getValue() || '').trim();
        var beforeReviewed = h.sheet.getRange(row, DT_COL_REVIEWED).getValue();

        if (typeof rerunElementPinsRowDT_ !== 'function') {
          rerunRan = false;
          rerunError = 'rerunElementPinsRowDT_() not found in this project';
        } else {
          var outcome;
          try {
            outcome = rerunElementPinsRowDT_(h.sheet, row);
          } catch (err) {
            outcome = false;
            rerunError = String(err && err.message ? err.message : err);
          }
          rerunRan = (outcome === true);
          if (!rerunRan && !rerunError) {
            rerunError = (outcome === 'no-fixes')
              ? 'the Nadir Fixes note was not readable back — nothing was re-pinned'
              : 'the re-pin failed; see the Nadir Elements cell and the execution log';
          }
        }

        if (rerunRan) {
          var freshRaw = String(h.sheet.getRange(row, DT_COL_ELEMENTS).getValue() || '').trim();
          var candidate = (freshRaw.indexOf('ERROR:') === 0) ? [] : parsePinCell_(freshRaw);
          candidate = critiqueApplyForcedPins_(p, candidate);
          writePlainCell(h.sheet, row, DT_COL_ELEMENTS,
            candidate.length ? JSON.stringify(candidate) : '');
          SpreadsheetApp.flush();
          var lost = critiquePinLoss_(p, beforeRaw, candidate);
          if (lost.length) {
            writePlainCell(h.sheet, row, DT_COL_ELEMENTS, beforeRaw);
            h.sheet.getRange(row, DT_COL_REVIEWED).setValue(beforeReviewed);
            writePlainCell(h.sheet, row, DT_COL_FIXES, note);
            SpreadsheetApp.flush();
            rerunRan = false;
            rerunError = 'the re-pin dropped ' + lost.length + ' pin(s) you did not ask to ' +
              'remove (' + lost.join(', ') + '), so it was ROLLED BACK — your pins are ' +
              'unchanged and the note is still in Nadir Fixes';
            Logger.log('critique ROLLED BACK drone-test taxlot ' + key + ' row ' + row +
                       ': re-pin returned ' + candidate.length + ' pin(s) and dropped ' +
                       lost.join(', '));
          } else {
            writePlainCell(h.sheet, row, DT_COL_FIXES, '');
            SpreadsheetApp.flush();
            freshPins = candidate;
            freshRev = critiqueRev_(candidate.length ? JSON.stringify(candidate) : '');
          }
        }

        rerunStatus = rerunRan
          ? 'RE-PINNED immediately — ' + (freshPins ? freshPins.length : 0) + ' pin(s), note consumed'
          : 'FAILED to re-pin: ' + rerunError + ' — the note is still in Nadir Fixes';
        try {
          var cRerun = critiqueHeaders_().indexOf('Rerun Status') + 1;
          if (cRerun > 0) log.getRange(logRow, cRerun).setValue(rerunStatus);
        } catch (e) {
          Logger.log('critique DT: could not write Rerun Status back — ' + e.message);
        }
      }
    }

    Logger.log('critique filed: drone-test ' + key + ' ' + accountName +
               ' round ' + round + ' — ' +
               (p.elements || []).length + ' pins, ' + (p.added || []).length + ' added');

    return {
      ok: true, route: 'critique', view: 'drone-test', rows: 1, round: round, row: row,
      site_no: siteNo, key: key,
      rerun_mode: CRITIQUE_RERUN_MODE,
      rerun_ran: rerunRan,
      rerun_error: rerunError,
      pins: freshPins,
      rev: freshRev,
      rerun_trigger: trigState,
      build: CRITIQUE_BUILD,
      rerun_queued: queued,
      pin_requests: reqCount,
      message: (CRITIQUE_RERUN_MODE === 'inline' && queued
        ? (rerunRan
            ? 'Round ' + round + ' filed and re-pinned on drone-test — ' +
              (freshPins ? freshPins.length : 0) + ' new pin(s) on the image.'
            : 'Round ' + round + ' filed to drone-test, but the re-pin FAILED: ' + rerunError)
        : queued
          ? 'Round ' + round + ' filed to drone-test. ' + rerunStatus
          : 'Round ' + round + ' filed to drone-test.')
    };
  } finally {
    lock.releaseLock();
  }
}

function critiquePost_(p) {
  if (critiqueViewOf_(p) === 'drone-test') return critiquePostDt_(p);
  Logger.log('critiquePost_ sandbox=' + critiqueIsSandbox_(p) +
             ' view=' + critiqueViewOf_(p) + ' site_no=' + String((p && p.site_no) || ''));
  var lock = LockService.getScriptLock();
  // The same lock the two Satellite auto-runs take. Without it a submission
  // landing mid-rerun could interleave with the trigger's own writes.
  if (!lock.tryLock(20000)) {
    return { ok: false, error: 'sheet busy (a re-run is in progress) — try again in a moment' };
  }
  try {
    // Before anything reads a verdict: a corrected xy with no chip is a fix.
    critiqueNormalizeVerdicts_(p);

    var h = critiqueOpenSatSheet_(p);
    var hit = critiqueFindRow_(h.sheet, p);
    var v = hit.vals;
    var row = hit.row;
    var logName = h.sandbox ? critiqueSandboxNames_().log : CRITIQUE_SHEET;
    var menuLabel = h.sandbox ? 'Satellite Sandbox' : 'Satellite';
    var rerunHandler = h.sandbox ? 'generateSbElementRerunAutoRun' : 'generateSatElementRerunAutoRun';
    var startRerunFn = h.sandbox ? 'startSbElementRerunAuto' : 'startSatElementRerunAuto';

    var accountName = String(v[SAT_COL_ACCOUNT - 1] || '').trim();
    var address = String(v[SAT_COL_ADDRESS - 1] || '').trim();
    var siteNo = critiqueSiteNoOf_(v);

    // ⚠️ REFUSE a row with no usable site_no rather than filing a critique that
    // can never be joined back to a property. hashId('') returns a valid-looking
    // hash, so without this the row would carry a key that matches nothing and
    // look perfectly healthy in the sheet.
    if (!critiqueValidSite_(siteNo)) {
      return { ok: false, error: 'Satellite row ' + row + ' ("' + accountName +
        '") has no valid site_no in column ' + SAT_COL_SITE_NO + ', so this ' +
        'critique cannot be filed against a property. Nothing was saved.' };
    }
    var key = critiqueSiteId_(siteNo, getCredentials().hashSalt);

    // Read the round WITHOUT creating the tab — a refused submission should not
    // leave a new empty tab behind as its only trace.
    var round = parseInt(p.round, 10);
    if (!isFinite(round) || round < 1) {
      round = critiqueNextRound_(critiqueEnsureLogSheet_(h.ss, false, logName), siteNo, key);
    }

    var now = new Date();
    var note = critiqueComposeFixesNote_({
      round: round,
      reviewer: String(p.reviewer || '').trim(),
      stamp: critiqueStamp_(now),
      elements: p.elements || [],
      added: p.added || [],
      missed: p.missed || ''
      // p.pin_requests is deliberately NOT passed — see the note above.
    });
    var reqCount = (p.pin_requests || []).length;

    // The automation DECISION is made here but not acted on yet, because the row
    // has to be validated before anything is written anywhere.
    var willQueue = CRITIQUE_QUEUE_RERUN && !!note;
    var rerunStatus;
    // true / false / null — see critiqueRerunTriggerState_. Held in one variable
    // so the sheet's Rerun Status column and the message the reviewer reads are
    // derived from the SAME answer. Two independent phrasings of "what happens
    // next" is how a UI ends up contradicting its own audit log.
    var trigState = null;
    if (willQueue) {
      // ⚠️ Do not PROMISE an automatic re-pin. The rekey deleted both 5-minute
      // triggers before the bulk load, and they have to be recreated from the
      // menu — so "queued, runs within 5 min" can be a straight lie, and the
      // symptom (a row that just sits there) looks like a broken API rather than
      // a missing trigger. Report what is actually scheduled.
      if (CRITIQUE_RERUN_MODE === 'inline') {
        // ⭐ SNAPSHOT BEFORE THE RE-PIN, so a destructive result can be undone.
        // 2026-08-17: an ADD-only critique on PRIDESTAFF (site 100024245) caused
        // the model to return ONLY the added pin — five pins the analyst had not
        // touched were silently destroyed, and the note was consumed, so there
        // was nothing left to retry from. See critiqueProtectedIds_.
        var beforeRaw = String(h.sheet.getRange(row, SAT_COL_ELEMENTS).getValue() || '').trim();
        var beforeReviewed = h.sheet.getRange(row, SAT_COL_REVIEWED).getValue();

        // Filled in after the re-pin actually runs — see below. A placeholder
        // here would be a guess about work that has not happened yet.
        rerunStatus = '';
      } else {
        trigState = critiqueRerunTriggerState_(rerunHandler);
        var trig = trigState;
        rerunStatus = (trig === true)
          ? 'queued — auto re-pin within 5 min'
          : (trig === false
              ? 'note written to Nadir Fixes, but NO rerun trigger is installed — ' +
                'run it from the ' + menuLabel + ' menu, or install it with ' + startRerunFn
              : 'note written to Nadir Fixes — the rerun trigger could not be checked');
      }
    } else if (!note) {
      // A submission can legitimately carry nothing but catalog requests.
      rerunStatus = reqCount ? 'catalog request only — no re-pin needed' : 'nothing actionable';
    } else {
      rerunStatus = 'not queued — run the rerun from the sheet';
    }

    var built = critiqueBuildRow_({
      payload: p, now: now, siteNo: siteNo, key: key, accountName: accountName,
      address: address, row: row, round: round, note: note, rerunStatus: rerunStatus
    });

    // HARD STOP. There are exactly CRITIQUE_PIN_SLOTS slots and no overflow
    // column, so a pin without a slot cannot be recorded. Refuse the whole
    // submission and write NOTHING — no row, no Nadir Fixes, no tab — rather
    // than file a row that silently omits it. The viewer blocks this at 12
    // (standard) / 20 (school), so reaching here means the two are out of step.
    if (built.overCap.length) {
      var total = (p.elements || []).length + (p.added || []).length;
      Logger.log('critique REFUSED for ' + accountName + ': ' + total + ' pins, ' +
                 CRITIQUE_PIN_SLOTS + ' slots. No slot for ' + built.overCap.join(', '));
      return { ok: false,
        error: 'This round carries ' + total + ' pins but the sheet has ' +
          CRITIQUE_PIN_SLOTS + ' slots, so nothing was saved. No slot for ' +
          built.overCap.join(', ') + '. Remove ' + built.overCap.length +
          ' pin(s) and submit again.' };
    }

    // Validated — now write. The row goes down BEFORE the re-pin is queued, so a
    // queued rerun always has its logged justification behind it.
    var log = critiqueEnsureLogSheet_(h.ss, true, logName);
    var logRow = log.getLastRow() + 1;
    var target = logRow;
    log.getRange(target, 1, 1, built.headerCount).setValues([built.row]);
    // "Submitted At" is a Date. A default-formatted column renders it as
    // 8/12/2026 and the time-of-day is invisible, which matters as soon as two
    // rounds are filed on one day. Format the cell we just wrote rather than the
    // whole column, so this stays O(1) and never touches historical rows.
    log.getRange(target, 1).setNumberFormat('M/d/yyyy h:mm:ss am/pm');

    var queued = false;
    var rerunRan = null;          // true / false / null (not attempted)
    var rerunError = '';
    var freshPins = null;         // the NEW pins, handed straight back to the viewer
    var freshRev = null;

    if (willQueue) {
      writePlainCell(h.sheet, row, SAT_COL_FIXES, note);
      h.sheet.getRange(row, SAT_COL_REVIEWED).setValue(false);
      SpreadsheetApp.flush();
      queued = true;

      if (CRITIQUE_RERUN_MODE === 'inline') {
        // Run the re-pin NOW, inside this request. rerunSatElementPinsRow_ takes
        // no lock of its own — only the auto-run WRAPPER does — so calling it
        // while we hold the script lock cannot deadlock. It reads the note we
        // just wrote, so the write above must come first and be flushed.
        if (typeof rerunSatElementPinsRow_ !== 'function') {
          rerunRan = false;
          rerunError = 'rerunSatElementPinsRow_() not found in this project';
        } else {
          var outcome;
          try {
            outcome = rerunSatElementPinsRow_(h.sheet, row);
          } catch (err) {
            outcome = false;
            rerunError = String(err && err.message ? err.message : err);
          }
          // It returns true | false | 'no-fixes'. Only an exact true is success;
          // 'no-fixes' here would mean our own write did not land.
          rerunRan = (outcome === true);
          if (!rerunRan && !rerunError) {
            rerunError = (outcome === 'no-fixes')
              ? 'the Nadir Fixes note was not readable back — nothing was re-pinned'
              : 'the re-pin failed; see the Nadir Elements cell and the execution log';
          }
        }

        if (rerunRan) {
          // Read the result BEFORE consuming anything, so a bad round can be undone.
          var freshRaw = String(h.sheet.getRange(row, SAT_COL_ELEMENTS).getValue() || '').trim();
          var candidate = (freshRaw.indexOf('ERROR:') === 0) ? [] : parsePinCell_(freshRaw);
          candidate = critiqueApplyForcedPins_(p, candidate);
          writePlainCell(h.sheet, row, SAT_COL_ELEMENTS,
            candidate.length ? JSON.stringify(candidate) : '');
          SpreadsheetApp.flush();

          // ⭐ THE PIN-LOSS GUARD. The model is asked to keep every pin the
          // analyst did not comment on, and usually does — but not always, and a
          // silent loss is unrecoverable once the note is consumed.
          var lost = critiquePinLoss_(p, beforeRaw, candidate);
          if (lost.length) {
            // ROLL BACK. Put the pins back, leave the note in Nadir Fixes so it
            // can be retried, and restore the review flag. Reporting a failure
            // the analyst can act on beats a round that looks fine and isn't.
            writePlainCell(h.sheet, row, SAT_COL_ELEMENTS, beforeRaw);
            h.sheet.getRange(row, SAT_COL_REVIEWED).setValue(beforeReviewed);
            writePlainCell(h.sheet, row, SAT_COL_FIXES, note);
            SpreadsheetApp.flush();
            rerunRan = false;
            rerunError = 'the re-pin dropped ' + lost.length + ' pin(s) you did not ask to ' +
              'remove (' + lost.join(', ') + '), so it was ROLLED BACK — your pins are ' +
              'unchanged and the note is still in Nadir Fixes';
            Logger.log('critique ROLLED BACK site ' + siteNo + ' row ' + row +
                       ': re-pin returned ' + candidate.length + ' pin(s) and dropped ' +
                       lost.join(', '));
          } else {
            // Consume the note, exactly as runSatElementRerunBatch_ does, so the
            // 5-minute trigger does not redo work already done. The durable copy
            // lives in this submission's "Fixes Note Sent" column.
            writePlainCell(h.sheet, row, SAT_COL_FIXES, '');
            SpreadsheetApp.flush();
            freshPins = candidate;
            freshRev = critiqueRev_(candidate.length ? JSON.stringify(candidate) : '');
          }
        }

        // The row was written BEFORE the re-pin ran — deliberately, so a crash in
        // Bedrock still leaves the critique on record — so its Rerun Status cell
        // is empty at this point. Fill in what actually happened.
        rerunStatus = rerunRan
          ? 'RE-PINNED immediately — ' + (freshPins ? freshPins.length : 0) + ' pin(s), note consumed'
          : 'FAILED to re-pin: ' + rerunError + ' — the note is still in Nadir Fixes, so ' +
            'the 5-minute trigger or the ' + menuLabel + ' menu can retry it';
        try {
          var cRerun = critiqueHeaders_().indexOf('Rerun Status') + 1;
          if (cRerun > 0) log.getRange(logRow, cRerun).setValue(rerunStatus);
        } catch (e) {
          // A failed label must never turn a successful re-pin into an error.
          Logger.log('critique: could not write Rerun Status back — ' + e.message);
        }
      }
    }

    Logger.log('critique filed' + (h.sandbox ? ' [SANDBOX]' : '') +
               ': site ' + siteNo + ' ' + accountName +
               ' round ' + round + ' — ' +
               (p.elements || []).length + ' pins, ' + (p.added || []).length + ' added, ' +
               reqCount + ' request(s), rerun ' + (queued ? 'QUEUED' : 'not queued'));

    return {
      ok: true, route: 'critique', rows: 1, round: round, row: row,
      sandbox: !!h.sandbox,
      site_no: siteNo, key: key,
      rerun_mode: CRITIQUE_RERUN_MODE,
      rerun_ran: rerunRan,             // true / false / null (not attempted)
      rerun_error: rerunError,
      // ⭐ The new round, straight back in the POST response. The viewer can show
      // it at once instead of waiting up to 20 s for its next poll — the whole
      // point of running the re-pin inline.
      pins: freshPins,
      rev: freshRev,
      rerun_trigger: trigState,        // true / false / null — see the message above
      // So the viewer's status line names the server build that accepted the
      // round, not just the viewer version that sent it.
      build: CRITIQUE_BUILD,
      rerun_queued: queued,
      pin_requests: reqCount,
      // ⚠️ The reviewer's message must not promise more than the sheet's Rerun
      // Status column does. `queued` only means "the note was written to Nadir
      // Fixes" — whether anything then PICKS IT UP depends on the trigger
      // existing, which the rekey deleted. Telling someone to wait five minutes
      // for a re-pin that nothing is scheduled to perform sends them away happy
      // and wrong, and the symptom surfaces much later looking like a bug here.
      message: (CRITIQUE_RERUN_MODE === 'inline' && queued
        ? (rerunRan
            ? 'Round ' + round + ' filed and re-pinned' + (h.sandbox ? ' (sandbox)' : '') + ' — ' +
              (freshPins ? freshPins.length : 0) + ' new pin(s) on the image.'
            : 'Round ' + round + ' filed, but the re-pin FAILED: ' + rerunError +
              ' The note is still in Nadir Fixes, so it can be retried.')
        : queued
        ? (trigState === true
            ? 'Round ' + round + ' filed — re-pin queued, runs within 5 minutes.'
            : trigState === false
              ? 'Round ' + round + ' filed, and the note was written to Nadir Fixes — ' +
                'but no rerun trigger is installed, so run it from the ' + menuLabel + ' menu.'
              : 'Round ' + round + ' filed, and the note was written to Nadir Fixes. ' +
                'The rerun trigger could not be checked — confirm it ran.')
        : (note
            ? 'Round ' + round + ' filed to "' + logName +
              '". Run the rerun from the ' + menuLabel + ' menu when ready.'
            : 'Round ' + round + ' filed to "' + logName + '".')) +
        (reqCount ? ' ' + reqCount + ' catalog request(s) logged for review.' : '')
    };
  } finally {
    lock.releaseLock();
  }
}

// ── Route dispatch ──────────────────────────────────────────────────────────

function critiqueCheckToken_(p) {
  if (!CRITIQUE_SHARED_TOKEN) return;
  if (String(p.token || '') !== CRITIQUE_SHARED_TOKEN) throw new Error('bad or missing token');
}

function critiqueApiGet_(e) {
  var p = (e && e.parameter) ? e.parameter : {};
  var cb = p.callback;
  try {
    critiqueCheckToken_(p);
    var route = String(p.route || 'elements');
    if (route === 'ping') {
      var sbNames = critiqueSandboxNames_();
      var sandboxOn = critiqueIsSandbox_(p);
      return critiqueJsonOut_({ ok: true, route: 'ping',
                                sheet: sandboxOn ? sbNames.log : CRITIQUE_SHEET,
                                satellite_sheet: sandboxOn ? sbNames.sat : SATELLITE_SHEET,
                                sandbox: sandboxOn,
                                sandbox_tabs: { satellite: sbNames.sat, critique: sbNames.log },
                                build: CRITIQUE_BUILD,
                                columns: critiqueHeaders_().length,
                                pin_slots: CRITIQUE_PIN_SLOTS,
                                rerun_automated: CRITIQUE_QUEUE_RERUN,
                                rerun_mode: CRITIQUE_RERUN_MODE,
                                golf: true,
                                golf_max_pins: (typeof GOLF_MAX_PINS === 'number') ? GOLF_MAX_PINS : 200,
                                server_time: new Date().toISOString() }, cb);
    }
    if (route === 'pin-freq') {
      return critiqueJsonOut_(critiqueGetPinFreq_(p), cb);
    }
    if (route === 'golf-catalog') {
      if (typeof golfGetCatalog_ !== 'function') {
        throw new Error('golfGetCatalog_ is not defined — paste golf.gs and save');
      }
      return critiqueJsonOut_(golfGetCatalog_(), cb);
    }
    if (route === 'golf-elements') {
      if (typeof golfGetElements_ !== 'function') {
        throw new Error('golfGetElements_ is not defined — paste golf.gs and save');
      }
      return critiqueJsonOut_(golfGetElements_(p), cb);
    }
    if (route === 'rounds') {
      return critiqueJsonOut_(critiqueGetRounds_(p), cb);
    }
    if (route !== 'elements') throw new Error('unknown route "' + route + '"');
    return critiqueJsonOut_(critiqueGetElements_(p), cb);
  } catch (err) {
    return critiqueJsonOut_({ ok: false, error: String(err.message || err) }, cb);
  }
}

function critiqueApiPost_(e) {
  try {
    var p = (e && e.parameter) ? e.parameter : {};
    critiqueCheckToken_(p);
    if (!e || !e.postData || !e.postData.contents) throw new Error('empty request body');
    var payload;
    try { payload = JSON.parse(e.postData.contents); }
    catch (err) { throw new Error('body is not JSON: ' + err.message); }
    // The token may travel in the body too, so a POST still works if the query
    // string is lost to a redirect.
    if (!p.token && payload.token) critiqueCheckToken_({ token: payload.token });
    if (critiqueIsSandbox_(p) && !critiqueIsSandbox_(payload)) payload.sandbox = true;
    var postRoute = String(p.route || payload.route || '').trim().toLowerCase();
    var postView = String(payload.view || '').trim().toLowerCase();
    if (postRoute === 'golf-save' || postView === 'golf') {
      if (typeof golfSavePins_ !== 'function') {
        throw new Error('golfSavePins_ is not defined — paste golf.gs and save');
      }
      return critiqueJsonOut_(golfSavePins_(payload));
    }
    return critiqueJsonOut_(critiquePost_(payload));
  } catch (err) {
    return critiqueJsonOut_({ ok: false, error: String(err.message || err) });
  }
}

// ── Web app entry points ────────────────────────────────────────────────────
// Verified 2026-08-11: no other file in this project defines either handler.

function doGet(e)  { return critiqueApiGet_(e); }
function doPost(e) { return critiqueApiPost_(e); }

// Catalog add-search order: most-used pin ids first, unused alphabetical
// (the viewer sorts names client-side). Counts Satellite Nadir Elements (I)
// plus every Pin n ID on the element-critique tab. Cached 6 hours so opening
// review is not a full-sheet scan.
function critiqueGetPinFreq_(p) {
  var sandbox = critiqueIsSandbox_(p);
  var names = sandbox ? critiqueSandboxNames_() : { sat: SATELLITE_SHEET, log: CRITIQUE_SHEET };
  var cacheKey = sandbox ? 'pinFreqSandboxV1' : 'pinFreqV1';
  var cache = CacheService.getScriptCache();
  var hit = cache.get(cacheKey);
  if (hit) {
    try {
      return { ok: true, route: 'pin-freq', sandbox: sandbox, freq: JSON.parse(hit), cached: true };
    } catch (e) {}
  }
  var freq = {};
  function bump(id) {
    var n = parseInt(id, 10);
    if (!isFinite(n) || n < 1) return;
    var k = String(n);
    freq[k] = (freq[k] || 0) + 1;
  }
  var opened = critiqueOpenSpreadsheet_();
  var ss = opened && opened.ss;
  if (!ss) return { ok: true, route: 'pin-freq', sandbox: sandbox, freq: freq, cached: false };

  try {
    var sat = ss.getSheetByName(names.sat);
    if (sat && sat.getLastRow() >= 2 && typeof parsePinCell_ === 'function') {
      var vals = sat.getRange(2, SAT_COL_ELEMENTS, sat.getLastRow() - 1, 1).getValues();
      for (var i = 0; i < vals.length; i++) {
        var pins = parsePinCell_(vals[i][0]);
        for (var pi = 0; pi < pins.length; pi++) bump(pins[pi].id);
      }
    }
  } catch (e) {}

  try {
    var log = ss.getSheetByName(names.log);
    if (log && log.getLastRow() >= 2) {
      var lastCol = log.getLastColumn();
      var headers = log.getRange(1, 1, 1, lastCol).getValues()[0];
      var idCols = [];
      for (var c = 0; c < headers.length; c++) {
        if (/^Pin \d+ ID$/.test(String(headers[c] || ''))) idCols.push(c);
      }
      if (idCols.length) {
        var data = log.getRange(2, 1, log.getLastRow() - 1, lastCol).getValues();
        for (var r = 0; r < data.length; r++) {
          for (var k = 0; k < idCols.length; k++) bump(data[r][idCols[k]]);
        }
      }
    }
  } catch (e2) {}

  try { cache.put(cacheKey, JSON.stringify(freq), 21600); } catch (e) {}
  return { ok: true, route: 'pin-freq', sandbox: sandbox, freq: freq, cached: false };
}

// ── Editor-runnable self test ───────────────────────────────────────────────
// Run from the Apps Script editor (Run > critiqueSelfTest_) BEFORE deploying. It
// exercises config, the layout arithmetic, row lookup, the GET payload and the
// note composition with NO HTTP and NO writes. Paste the log back if it fails.
function critiqueSelfTest_() {
  var out = [];
  try {
    var headers = critiqueHeaders_();
    // This is the build of the SAVED file. What /exec serves is the build of the
    // last deployment version, which is not the same thing — compare them.
    out.push('OK  build (saved file): ' + CRITIQUE_BUILD);
    out.push('    to check the DEPLOYED build: <your /exec URL>?route=ping');
    out.push('    if its "build" differs, save then Deploy > Manage deployments > New version');
    out.push('OK  layout: ' + headers.length + ' columns (' +
             CRITIQUE_SUBMISSION_HEADERS.length + ' submission + ' +
             CRITIQUE_PIN_SLOTS + ' pins x ' + CRITIQUE_PIN_FIELDS.length + ')');
    out.push('    last column: "' + headers[headers.length - 1] + '"');
    out.push('    pin limit: ' + CRITIQUE_PIN_SLOTS + ' (hard — a submission with more is refused)');

    // Resolve the BOUND spreadsheet's real id first and print it, so a wrong or
    // truncated CRITIQUE_SPREADSHEET_ID still hands you the value to paste
    // instead of the test dying before it can help.
    var boundId = null;
    try {
      var bound = SpreadsheetApp.getActiveSpreadsheet();
      boundId = bound ? bound.getId() : null;
    } catch (e) { boundId = null; }
    if (boundId) {
      out.push('OK  this spreadsheet id: ' + boundId + '   (' + boundId.length + ' chars)');
      var idSet = String(CRITIQUE_SPREADSHEET_ID || '');
      if (!idSet || idSet.indexOf('PASTE_') === 0) {
        out.push('    CRITIQUE_SPREADSHEET_ID is NOT set — paste the id above into it.');
      } else if (idSet !== boundId) {
        out.push('    *** MISMATCH: CRITIQUE_SPREADSHEET_ID = "' + idSet + '" (' +
                 idSet.length + ' chars)');
        out.push('        ' + (idSet.length < boundId.length
          ? 'It is SHORTER than the real id — a truncated copy.'
          : 'It is not this spreadsheet.') + ' Replace it with the id above.');
      } else {
        out.push('    CRITIQUE_SPREADSHEET_ID matches this spreadsheet.');
      }
    } else {
      out.push('    NOTE no bound spreadsheet in this context — cannot print the id.');
    }

    var h = critiqueOpenSatSheet_();
    out.push('OK  spreadsheet + "' + SATELLITE_SHEET + '" tab opened via ' + h.via);
    if (h.via.indexOf('bound') === 0) {
      out.push('    WARN set CRITIQUE_SPREADSHEET_ID before deploying — the bound');
      out.push('         fallback is not guaranteed inside a web app.');
    }
    var lastRow = h.sheet.getLastRow();
    out.push('    data rows: ' + Math.max(0, lastRow - 1));
    if (lastRow < 2) throw new Error('no data rows to test with');

    var salt = getCredentials().hashSalt;
    var name = String(h.sheet.getRange(2, SAT_COL_ACCOUNT).getValue() || '').trim();
    var siteNo = String(h.sheet.getRange(2, SAT_COL_SITE_NO).getValue() || '').trim();
    if (!siteNo) {
      throw new Error('row 2 has no site_no in column ' + SAT_COL_SITE_NO +
        '. Is this the REBUILT Satellite tab? site_no belongs in column A and ' +
        'every other column shifted +1 on 2026-08-13.');
    }
    out.push((critiqueValidSite_(siteNo) ? 'OK ' : 'BAD') +
             ' row 2 site_no "' + siteNo + '" passes the validator');
    var key = critiqueSiteId_(siteNo, salt);
    out.push('OK  row 2 site ' + siteNo + ' "' + name + '" -> key ' + key);

    // The identity is the site_no, so THAT is the primary lookup to prove.
    var bySite = critiqueGetElements_({ site_no: siteNo });
    out.push('OK  GET by site_no: row ' + bySite.row + ', ' + bySite.pins.length +
             ' pins, rev ' + bySite.rev + ', reviewed=' + bySite.reviewed +
             ', fixes_pending=' + bySite.fixes_pending + ', next_round=' + bySite.next_round +
             ', max_pins=' + bySite.max_pins);
    var got = bySite;
    if (got.pin_error) out.push('    NOTE elements cell holds an error: ' + got.pin_error);
    if (!got.nadir_url) out.push('    WARN no nadir URL on this row');
    out.push((got.key === key ? 'OK ' : 'BAD') +
             ' the GET reports the same key it would publish');

    var byKey = critiqueGetElements_({ key: key });
    out.push((byKey.row === got.row ? 'OK ' : 'BAD') +
             ' GET by key resolves to the same row');
    // Address is NOT a key. Duplicate lots (410 SW Columbia St is two rows)
    // must refuse rather than guess — the same rule as name.
    try {
      var byAddr = critiqueGetElements_({ addr: got.address });
      out.push((byAddr.row === got.row ? 'OK ' : 'BAD') +
               ' GET by address resolves to the same row');
    } catch (addrErr) {
      out.push('OK  GET by address refused rather than guessing: ' +
               String(addrErr.message || addrErr).slice(0, 90));
    }
    // Name is LAST and is not a key — 145 duplicate-name groups in the export.
    // Report an ambiguous name as OK: refusing to guess is the correct behaviour.
    try {
      var byName = critiqueGetElements_({ name: name });
      out.push((byName.row === got.row ? 'OK ' : 'BAD') +
               ' GET by name resolves to the same row');
    } catch (nameErr) {
      out.push('OK  GET by name refused rather than guessing: ' +
               String(nameErr.message || nameErr).slice(0, 90));
    }

    // A synthetic payload: a correction, a removal, an OK, an addition — and
    // pin 4, which is the ONE case the fixture used to be missing. A pin dragged
    // in the viewer with no chip ever tapped arrives moved with a BLANK verdict,
    // and that is what filed the ALLISON DERMATOLOGY row with "Fix XY" set,
    // "Verdict" empty and "Marked Fix" undercounting. A fixture where every
    // verdict is already populated cannot fail that way, so a green self-test
    // said nothing about it. Note the string id — the pre-v5.6 viewer sent
    // sheet-parsed ids as strings, and a cached viewer still will.
    var demo = {
      version: 'v5', reviewer: 'selftest', round: 2, missed: 'side gate on the north fence',
      elements: [
        { seq: 1, id: 101, name: 'Front Door', x: 50, y: 61.5, corrected_x: 30, corrected_y: 40,
          moved: true, verdict: 'fix', note: 'it is on the north face' },
        { seq: 2, id: 102, name: 'Driveway', x: 33.2, y: 74.8, corrected_x: null,
          corrected_y: null, moved: false, verdict: 'ok', note: '' },
        { seq: 3, id: 901, name: 'Overgrown Vegetation', x: 80, y: 85, corrected_x: null,
          corrected_y: null, moved: false, verdict: 'remove', note: '' },
        { seq: 4, id: '148', name: 'Tree cluster', x: 30, y: 25, corrected_x: 62.8,
          corrected_y: 39.1, moved: true, verdict: '', note: '' }
      ],
      added: [{ seq: 5, id: 105, name: 'Side Gate', section: 'Site & Access',
                x: 75, y: 20, note: 'visible on the fence line' }]
    };

    // This is the first thing critiquePost_ does, so the self-test must do it in
    // the same order or it is testing a different code path than production.
    critiqueNormalizeVerdicts_(demo);
    var drag = demo.elements[3];
    out.push((drag.verdict === 'fix' ? 'OK ' : 'BAD') +
             ' drag-only pin 4 normalises to verdict "' + drag.verdict + '" (blank on the wire)');
    var orphans = demo.elements.filter(function (e) {
      return critiqueXY_(e.corrected_x, e.corrected_y) && !e.verdict;
    }).map(function (e) { return e.seq; });
    out.push((orphans.length === 0 ? 'OK ' : 'BAD') +
             ' INVARIANT: no pin carries a corrected xy with a blank verdict' +
             (orphans.length ? ' — ORPHANS: ' + orphans.join(', ') : ''));

    var note = critiqueComposeFixesNote_({
      round: 2, reviewer: 'selftest', stamp: new Date().toLocaleString(),
      elements: demo.elements, added: demo.added, missed: demo.missed
    });
    out.push('OK  composed note:');
    out.push(note.split('\n').map(function (l) { return '      ' + l; }).join('\n'));

    var built = critiqueBuildRow_({
      payload: demo, now: new Date(), siteNo: siteNo, key: key, accountName: name,
      address: got.address,
      row: got.row, round: 2, note: note, rerunStatus: 'self test'
    });
    out.push((built.row.length === headers.length ? 'OK ' : 'BAD') +
             ' row width ' + built.row.length + ' matches ' + headers.length + ' headers');
    var base = CRITIQUE_SUBMISSION_HEADERS.length;
    var grp = function (n) { return built.row.slice(base + (n - 1) * 6, base + n * 6); };
    out.push('    pin 1 group: ' + JSON.stringify(grp(1)));
    out.push('    pin 4 group (dragged, no chip): ' + JSON.stringify(grp(4)));
    out.push('    pin 5 group (the addition): ' + JSON.stringify(grp(5)));
    var pubPins = critiquePinsFromLogRow_(headers, built.row, 'published');
    var resPins = critiquePinsFromLogRow_(headers, built.row, 'result');
    var pubIds = pubPins.map(function (p) { return p.id; }).join(',');
    var resIds = resPins.map(function (p) { return p.id; }).join(',');
    out.push((pubIds === '101,102,901,148' ? 'OK ' : 'BAD') +
             ' round-0 published pins skip the add: ' + pubIds);
    out.push((resIds === '101,102,148,105' ? 'OK ' : 'BAD') +
             ' round-result drops REMOVE, keeps FIX/ADD: ' + resIds);
    var door = resPins.filter(function (p) { return p.id === 101; })[0];
    out.push((door && door.x === 30 && door.y === 40 ? 'OK ' : 'BAD') +
             ' FIX uses Fix XY (want 30,40 got ' +
             (door ? door.x + ',' + door.y : 'missing') + ')');
    out.push((grp(4)[0] === 148 ? 'OK ' : 'BAD') +
             ' pin 4 id coerced from the string "148" to the number ' + JSON.stringify(grp(4)[0]));

    // The counters and the prose must tell the same story. This is the assertion
    // the ALLISON DERMATOLOGY row would have failed: 6 FIX lines, "Marked Fix" 2.
    var pick = function (n) { return built.row[headers.indexOf(n)]; };
    var noteFix = (note.match(/^- FIX /gm) || []).length;
    var noteRem = (note.match(/^- REMOVE /gm) || []).length;
    out.push((noteFix === pick('Marked Fix') && noteRem === pick('Marked Remove') ? 'OK ' : 'BAD') +
             ' note vs columns: ' + noteFix + ' FIX lines / Marked Fix ' + pick('Marked Fix') +
             ', ' + noteRem + ' REMOVE lines / Marked Remove ' + pick('Marked Remove'));
    var tally = pick('Marked OK') + pick('Marked Fix') + pick('Marked Remove');
    out.push((tally === pick('Pins Reviewed') ? 'OK ' : 'BAD') +
             ' verdicts account for every pin: ' + pick('Marked OK') + ' OK + ' +
             pick('Marked Fix') + ' fix + ' + pick('Marked Remove') + ' remove = ' + tally +
             ' of ' + pick('Pins Reviewed') + ' reviewed');
    out.push((pick('Marked Fix') >= pick('Repositioned') ? 'OK ' : 'BAD') +
             ' Marked Fix (' + pick('Marked Fix') + ') >= Repositioned (' +
             pick('Repositioned') + ')');

    // Duplicate catalog id: adding a second instance must not relocate the first.
    // Fixture: Parking #105 at 20,30 already on the row; reviewer adds another
    // #105 at 70,80. After force-apply both spots must survive.
    var dupeBefore = [
      { id: 105, x: 20, y: 30 },
      { id: 101, x: 50, y: 50 }
    ];
    var dupePayload = {
      elements: [
        { seq: 1, id: 105, name: 'Parking lot', x: 20, y: 30,
          corrected_x: null, corrected_y: null, verdict: 'ok', note: '' },
        { seq: 2, id: 101, name: 'Front Door', x: 50, y: 50,
          corrected_x: null, corrected_y: null, verdict: 'ok', note: '' }
      ],
      added: [{ seq: 3, id: 105, name: 'Parking lot', x: 70, y: 80, note: '' }]
    };
    var dupeAfter = critiqueApplyForcedPins_(dupePayload, dupeBefore);
    var park = dupeAfter.filter(function (x) { return parseInt(x.id, 10) === 105; });
    var parkSpots = park.map(function (x) { return x.x + ',' + x.y; }).sort().join(' ');
    out.push((park.length === 2 ? 'OK ' : 'BAD') +
             ' duplicate add keeps both #' + 105 + ' instances (' + park.length + ' of 2)');
    out.push((parkSpots === '20,30 70,80' ? 'OK ' : 'BAD') +
             ' duplicate add locations: ' + parkSpots + ' (want 20,30 and 70,80)');
    // Bedrock relocated the original onto the add's coordinates — restore it.
    var stacked = critiqueApplyForcedPins_(dupePayload, [{ id: 105, x: 70, y: 80 }, { id: 101, x: 50, y: 50 }]);
    var stackedPark = stacked.filter(function (x) { return parseInt(x.id, 10) === 105; });
    var stackedSpots = stackedPark.map(function (x) { return x.x + ',' + x.y; }).sort().join(' ');
    out.push((stackedSpots === '20,30 70,80' ? 'OK ' : 'BAD') +
             ' sibling restore after Bedrock stacked both at the add: ' + stackedSpots);

    // Placing a second Roof: Bedrock often emits two #61 both at the ADD
    // spot (it treated the add as a move of the original). Payload pin 10
    // stayed at 20,30; pin 9 is the add at 70,80. Both must survive there.
    var placePayload = {
      elements: [
        { seq: 10, id: 61, name: 'Roof', x: 20, y: 30,
          corrected_x: null, corrected_y: null, verdict: 'ok', note: '' }
      ],
      added: [{ seq: 9, id: 61, name: 'Roof', x: 70, y: 80, note: '' }]
    };
    var placeAfter = critiqueApplyForcedPins_(placePayload,
      [{ id: 61, x: 70, y: 80 }, { id: 61, x: 70, y: 80 }]);
    var placedRoofs = placeAfter.filter(function (x) { return parseInt(x.id, 10) === 61; });
    var placedSpots = placedRoofs.map(function (x) { return x.x + ',' + x.y; }).sort().join(' ');
    out.push((placedSpots === '20,30 70,80' ? 'OK ' : 'BAD') +
             ' place pin 9 must not move pin 10: ' + placedSpots);

    // MOVE of pin 10 when two Roof #61 share a spot. Bedrock often emits only
    // one. Matching on catalog id stole pin 9 and the sibling vanished.
    var movePayload = {
      elements: [
        { seq: 9, id: 61, name: 'Roof', x: 46.6, y: 39.7,
          corrected_x: null, corrected_y: null, verdict: 'ok', note: '' },
        { seq: 10, id: 61, name: 'Roof', x: 46.6, y: 39.7,
          corrected_x: 70, corrected_y: 80, verdict: 'fix', note: '' }
      ],
      added: []
    };
    var moveAfter = critiqueApplyForcedPins_(movePayload, [{ id: 61, x: 70, y: 80 }]);
    var roofs = moveAfter.filter(function (x) { return parseInt(x.id, 10) === 61; });
    var roofSpots = roofs.map(function (x) { return x.x + ',' + x.y; }).sort().join(' ');
    out.push((roofs.length === 2 ? 'OK ' : 'BAD') +
             ' move of pin 10 keeps pin 9 (' + roofs.length + ' of 2 Roof pins)');
    out.push((roofSpots === '46.6,39.7 70,80' ? 'OK ' : 'BAD') +
             ' move of pin 10 locations: ' + roofSpots + ' (want 46.6,39.7 and 70,80)');
    var lostMove = critiquePinLoss_(movePayload,
      JSON.stringify([{ id: 61, x: 46.6, y: 39.7 }, { id: 61, x: 46.6, y: 39.7 }]),
      moveAfter);
    out.push((lostMove.length === 0 ? 'OK ' : 'BAD') +
             ' pin-loss after duplicate move: ' + (lostMove.length ? lostMove.join(', ') : 'none'));
    var remAfter = critiqueApplyForcedPins_({
      elements: [
        { seq: 9, id: 61, name: 'Roof', x: 46.6, y: 39.7, verdict: 'ok' },
        { seq: 10, id: 61, name: 'Roof', x: 46.6, y: 39.7, verdict: 'remove' }
      ],
      added: []
    }, [{ id: 61, x: 46.6, y: 39.7 }, { id: 61, x: 46.6, y: 39.7 }]);
    var remRoofs = remAfter.filter(function (x) { return parseInt(x.id, 10) === 61; });
    out.push((remRoofs.length === 1 && remRoofs[0].x === 46.6 ? 'OK ' : 'BAD') +
             ' remove of pin 10 keeps pin 9 (' + remRoofs.length +
             ' at ' + (remRoofs[0] ? remRoofs[0].x + ',' + remRoofs[0].y : '?') + ')');

    out.push('    over the limit: ' + (built.overCap.length ? built.overCap.join(', ') : 'none'));
    out.push('    rerun automation: ' + (CRITIQUE_QUEUE_RERUN ? 'ON' : 'OFF (record only)'));
    var log = h.ss.getSheetByName(CRITIQUE_SHEET);
    if (!log) {
      out.push('    "' + CRITIQUE_SHEET + '" tab: does not exist — the first submission creates it');
    } else {
      var rows = Math.max(0, log.getLastRow() - 1);
      out.push('    "' + CRITIQUE_SHEET + '" tab: exists, ' + rows + ' submission(s) filed');
      var cur = log.getRange(1, 1, 1, Math.max(1, log.getLastColumn())).getValues()[0]
                   .filter(function (c) { return String(c || '').trim() !== ''; });
      var match = cur.length === headers.length && cur.every(function (c, i) {
        return String(c).trim() === headers[i];
      });
      out.push('    header row: ' + cur.length + ' non-empty cell(s) — ' +
               (match ? 'already matches this layout'
                      : (rows === 0 ? 'will be REPLACED by the ' + headers.length +
                                      ' headers on first submission'
                                    : 'MISMATCH with ' + rows + ' row(s) present — the write will REFUSE; ' +
                                      'rename the tab and let a fresh one be created')));
      if (cur.length && !match) out.push('    current: ' + JSON.stringify(cur.slice(0, 8)));
    }
    var sb = critiqueSandboxNames_();
    var sbSat = h.ss.getSheetByName(sb.sat);
    var sbLog = h.ss.getSheetByName(sb.log);
    out.push('    sandbox satellite tab "' + sb.sat + '": ' +
             (sbSat ? (Math.max(0, sbSat.getLastRow() - 1) + ' data row(s)')
                    : 'missing — run Set Up Sandbox Tabs'));
    out.push('    sandbox critique tab "' + sb.log + '": ' +
             (sbLog ? (Math.max(0, sbLog.getLastRow() - 1) + ' submission(s)')
                    : 'missing — run Set Up Sandbox Tabs'));
    if (sbSat && sbSat.getLastRow() >= 2) {
      try {
        var sbEl = critiqueGetElements_({ site_no: siteNo, sandbox: true });
        out.push((sbEl.sandbox === true ? 'OK ' : 'BAD') +
                 ' GET sandbox=1 stays on "' + sb.sat + '" (row ' + sbEl.row +
                 ', sandbox=' + sbEl.sandbox + ')');
      } catch (sbErr) {
        out.push('OK  GET sandbox=1 refused (sandbox empty or site not copied yet): ' +
                 String(sbErr.message || sbErr).slice(0, 90));
      }
    }
    out.push('NOTE read-only: no cell is written and no tab is created. Every');
    out.push('     critiqueEnsureLogSheet_ call here passes forWrite=false, which');
    out.push('     since 2026-08-14 also blocks the header rewrite that used to');
    out.push('     happen on a read.');
  } catch (e) {
    out.push('FAIL ' + String(e.message || e));
  }
  Logger.log(out.join('\n'));
  return out.join('\n');
}