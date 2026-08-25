// ============================================================
// PROPERTY INTEL — Apps Script v5.27 — FILE 5/7: satellite.gs
// The Satellite pipeline, end to end, on the SAT_COL_* 20-column layout:
//
//   Pass 1   prepareSatNadir_        geocode + parcel-fitted nadir -> F/G/H
//            runSatElementPinsCall_  element pins -> I, unticks J
//            (+ batch, this-row, 5-minute auto-run, rerun-from-Nadir-Fixes)
//   Review   buildSatElementReviewUrl_ -> element-review.html
//   Pass 2   runSatPass2Half_ x2     FR -> L/M/N, Wildfire -> O/P/Q
//            Hard-gated on Elements Reviewed (J). Each half writes
//            independently, so a failed half is retried alone.
//   Sync     processSatelliteSheet / syncActiveRow -> data/satellite/{id}.json
//
// ⭐ IDENTITY. A satellite property id is hashId(slug(site_no)) — site_no in
// column A, NOT the account name. satPropertyId_ is the one place that rule
// lives. Plane, drone and Responder Intel stay NAME-based on purpose, because
// client links are already delivered; never "unify" the two rules.
//
// ⭐ 2026-08-18 (v5.27) — THE TWENTY-ELEMENT RESTRICTION.
// v5.26 opened Pass 1's vocabulary to all 239 catalog pins. Review showed 239
// bare "id. name" lines competing for 12 slots produced scattered, low-value
// pins, so the permitted set is now the ranked TOP TWENTY in
// SAT_PASS1_EMIT_IDS, each carrying detect/select/place/exclude rules inside
// satelliteElementPinsPrompt_.
//
// ⚠️ THE RESTRICTION IS ENFORCED IN CODE, NOT BY WORDING. v5.27 first shipped
// as a prompt change alone. A fresh run promptly returned #158 HVAC unit and
// #183 Circular driveway — real catalog ids, outside the twenty — because the
// prompt said twenty while satValidateElementPins_ was handed idSet(all 239).
// WHEN THE PROMPT AND THE VALIDATOR DISAGREE, THE VALIDATOR WINS. Do not try
// to fix a recurrence with stronger prompt language.
//
// ⭐⭐ TWO PATHS, TWO VOCABULARIES — this asymmetry IS the design:
//   FRESH Pass 1 (processSatElementPinsRow_ -> 3 args)  -> emitNames/emitIds
//        = the twenty. The model chooses freely, so it is held in code.
//   RERUN (rerunSatElementPinsRow_, critique-api inline re-pin -> 4th arg true)
//        -> elementNames/elementIds = all 239. An analyst has explicitly named
//        a pin, and the viewer offers all 239 by decision. Narrowing this path
//        silently drops their add — the MOCKINGBIRD failure.
// Never "simplify" these into one vocabulary. That is the bug, not the tidy-up.
//
// LOCAL FORKS OF SHARED PLANE HELPERS — deliberate, do not "de-duplicate":
//   satValidateElementPins_     12-pin cap, not plane's 10
//   satElementRerunInstruction_ 12-pin cap + the pin-loss hardening
//   satFetchPinCatalog_         emit/accept split described above
// Each exists so satellite can move without dragging plane and drone-test
// with it. drone-test.gs forks for the same reason.
//
// RETIRED (v5.24) and not present: the legacy single-pass code — analyzeImage,
// processNadirRow, parseAnalysisResult, buildAnnotatedNadirUrl,
// saveStructuredPins, generateRecommendation, and the generateNadir* / reprocess
// menu handlers. Their prompts were deleted from prompts.gs in v5.26.
// ⚠️ config.gs's legacy COL_* map is still read by plane.gs against THIS
// sheet, which is now wrong by one column — see the delivery note.
// ============================================================


// ── Property identity (v5.25) ───────────────────────────────────────────────
// THE single source of the Satellite property id. Hashes site_no (column A),
// not the account name.
//
// Why: an account can be renamed, and two different sites can legitimately
// share a name. 488 rows under the name hash produced only 469 ids — 19
// properties were silently overwriting each other's published file. site_no
// is unique per site, so that whole class of collision is gone.
//
// SATELLITE ONLY. Plane.gs, drone-test.gs and Responder Intel.gs deliberately
// keep the name-based hash, because client drone links are already in
// responders' hands and cannot be reissued. Do NOT "unify" the two rules.
//
// Column A is the identity, whatever is typed there. Interim values
// (digits, VY-AS-001, Cht-3, a CRM id) are real ids until they are replaced
// with the source-system number. Do not gate on format: the sheet is ahead
// of the catalog of "real" numbers, and rejecting Cht-3-class ids made those
// rows un-reviewable and unpublished.
//
// The ONLY refusal is blank. hashId('') is a valid-looking hash that every
// empty row would share, quietly publishing them all over one file. Callers
// MUST skip when this returns ''.
function satValidSiteNo_(raw) {
  return String(raw || '').trim();
}

function satPropertyId_(siteNo, salt) {
  const s = satValidSiteNo_(siteNo);
  if (!s) return null;
  return hashId(slugify(s), salt);
}

// ── Zoom selection ───────────────────────────────────────────────────────────

function selectBestZoom(lat, lng, accountType) {
  const zoomPrompt = accountType === 'commercial' ? ZOOM_PROMPT_COMMERCIAL : ZOOM_PROMPT_RESIDENTIAL;
  const urls = ZOOM_LEVELS.map(zoom => buildNadirUrl(lat, lng, zoom));
  const userContent = [];

  for (let i = 0; i < urls.length; i++) {
    const b64 = fetchImageAsBase64(urls[i]);
    if (!b64) { Logger.log('selectBestZoom: image fetch failed for zoom ' + ZOOM_LEVELS[i]); return 19; }
    userContent.push({ type: 'image', source: { type: 'base64', media_type: 'image/png', data: b64 } });
  }
  userContent.push({ type: 'text', text: 'Images show zoom 18 (first), 19 (second), 20 (third). Return ONLY 18, 19, or 20.' });

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = callBedrock(zoomPrompt, userContent, 5);
      if (!result) return 19;
      const zoom = parseInt(result.trim());
      return ZOOM_LEVELS.includes(zoom) ? zoom : 19;
    } catch(e) { Logger.log('selectBestZoom error: ' + e.message); return 19; }
  }
  return 19;
}

// Satellite element-pin validator — identical to Plane.gs's validateElementPins_
// except the cap is SAT_MAX_PINS (12) rather than PLANE_MAX_PINS (10). Kept as a
// deliberate local fork (the same pattern drone-test.gs uses) so satellite can
// diverge without touching the shared plane helper.
//
// ⭐ v5.27: this function did not change, but WHAT IT IS HANDED did. The caller
// now passes the twenty on a fresh Pass 1 and all 239 on a rerun. This is the
// single point where the restriction is actually enforced.
function satValidateElementPins_(pins, elementIds) {
  if (!Array.isArray(pins)) return [];
  const out = [];
  const seen = {};
  for (let i = 0; i < pins.length && out.length < SAT_MAX_PINS; i++) {
    const p = pins[i] || {};
    const x = parseFloat(p.x), y = parseFloat(p.y);
    if (isNaN(x) || isNaN(y)) continue;
    const id = parseInt(p.id, 10);
    if (isNaN(id) || !elementIds[id] || seen[id]) continue;
    seen[id] = true;
    const c = clampCoords(x, y);
    out.push({ id: id, x: c.x, y: c.y });
  }
  return out;
}

// ⭐ v5.27 — THE PASS 1 EMIT LIST. The ranked top twenty agreed 2026-08-18.
// A FRESH Pass 1 may propose and keep ONLY these ids. Deliberately NOT what the
// rerun path accepts (see satFetchPinCatalog_ and runSatElementPinsCall_).
//
// NOT account-type gated, by decision: a commercial row is still offered
// Residence, Pool, Front yard and Porch and must decline them on visual
// evidence. Nine of the twenty are catalog-tagged residential-only; gating
// would leave a commercial row only ten choices.
//
// Order is the reviewer ranking, kept for readability; the code treats it as a set.
// 61 Roof · 57 Residence · 114 Lawn · 19 Commercial Building · 150 Trees
// 148 Tree cluster · 206 Parking lot · 186 Driveway · 30 Entry · 87 Bare Ground
// 105 Front yard · 86 Back yard · 52 Patio · 217 Sidewalk · 147 Tree · 130 Pool
// 141 Storage Yard · 69 Solar panels · 54 Porch · 178 Shipping container
const SAT_PASS1_EMIT_IDS = [61, 57, 114, 19, 150, 148, 206, 186, 30, 87,
                            105, 86, 52, 217, 147, 130, 141, 69, 54, 178];

// ⭐ SATELLITE'S OWN CATALOG LOADER. A deliberate fork of plane.gs's
// fetchPinCatalog_, for exactly the reason satValidateElementPins_ is one:
// satellite needs to diverge and plane / drone-test must not move.
//
// WHAT IT RETURNS — THREE vocabularies, and they are not interchangeable:
//   emitNames / emitIds        the TWENTY. Fresh Pass 1, prompt AND validator.
//   elementNames / elementIds  all 239. Rerun path only.
//   frConcern* / wfConcern*    Pass 2, filtered by role + analysis tag + type.
//
// WHY all 239 survive as the rerun vocabulary. The first round of real review
// (2026-08-17) filed 99 submissions asking for 179 pins across 12 element
// types, and EVERY ONE already existed in the catalog. Nothing was missing;
// the vocabulary was being filtered before the model ever saw it:
//   114 requests (64%)  role=concern      parking lot, driveway, sidewalk, railroad
//    54 requests (30%)  residential-only  entryway, fence, patio, awning, playground
// The viewer therefore offers reviewers all 239, and a reviewer's explicit ADD
// must survive the re-pin. That is why the rerun path keeps elementIds.
//
// ⚠️ THE PASS 2 INVARIANT — the fr/wf concern vocabularies below are computed
// EXACTLY as plane.gs computes them: role=concern, gated by analysis tag AND
// account type. DO NOT simplify them, and do not flatten role= in
// pins-catalog.json to achieve the same thing. If a concern id set comes back
// empty then validateConcernPins_ silently drops every Pass 2 pin, AND
// satRowReadyForPass2_ (which tests `!fr || !wf` on the CONCERN columns) never
// goes false — so Pass 2 re-runs two Bedrock calls per row on every batch, for
// ever, writing nothing. That failure is silent and it costs money, which is
// why the check below logs rather than trusting the file.
//
// ⚠️ CACHE KEY IS satPinCatalogV2 (was V1 in v5.26). The cached object's SHAPE
// changed — a V1 entry has no emitIds, and satValidateElementPins_ would then
// be handed undefined and throw on every row. The key bump makes that
// impossible rather than relying on someone remembering to clear the cache.
// Distinct from plane's pinCatalogV5 so neither can serve the other's shape.
// 6-hour TTL: after editing this function OR the catalog, run
// clearSatPinCatalogCache() rather than waiting it out.
function satFetchPinCatalog_(accountType) {
  const type = normalizeAccountType(accountType);
  const cacheKey = 'satPinCatalogV2:' + type;
  const cache = CacheService.getScriptCache();
  const cached = cache.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const res = UrlFetchApp.fetch(PIN_CATALOG_URL, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) {
    throw new Error('Pin catalog fetch failed (HTTP ' + res.getResponseCode() + ')');
  }
  const cat = JSON.parse(res.getContentText());
  const all = cat.pins || [];

  const numbered    = function (arr) { return arr.map(function (p) { return p.id + '. ' + p.name; }).join('\n'); };
  const idSet       = function (arr) { const o = {}; arr.forEach(function (p) { o[p.id] = true; }); return o; };
  const hasAnalysis = function (p, a) { return Array.isArray(p.analysis) && p.analysis.indexOf(a) !== -1; };

  // PASS 1 EMIT — the twenty. Fresh Pass 1's prompt AND its validator.
  const emitPins = all.filter(function (p) { return SAT_PASS1_EMIT_IDS.indexOf(p.id) !== -1; });
  if (emitPins.length !== SAT_PASS1_EMIT_IDS.length) {
    Logger.log('satFetchPinCatalog_ WARNING: emit list resolved ' + emitPins.length + ' of ' +
      SAT_PASS1_EMIT_IDS.length + ' ids. An id in SAT_PASS1_EMIT_IDS is missing from ' +
      'pins-catalog.json — Pass 1 is running on a short vocabulary.');
  }

  // ACCEPT — all 239. RERUN path only, because an analyst may add any catalog pin.
  const elementPins = all;

  // PASS 2 — untouched. Identical to plane.gs's filtering.
  const forType = all.filter(function (p) {
    return Array.isArray(p.account_type) && p.account_type.indexOf(type) !== -1;
  });
  const frConcern = forType.filter(function (p) { return p.role === 'concern' && hasAnalysis(p, 'fr'); });
  const wfConcern = forType.filter(function (p) { return p.role === 'concern' && hasAnalysis(p, 'wf'); });

  // The invariant, checked rather than assumed. An empty concern set is the
  // expensive silent failure described above, so say so loudly in the log.
  if (!frConcern.length || !wfConcern.length) {
    Logger.log('satFetchPinCatalog_ WARNING [' + type + ']: concern vocabulary is ' +
      'EMPTY (fr=' + frConcern.length + ', wf=' + wfConcern.length + '). Pass 2 will ' +
      'drop every concern pin and re-run for ever. Has role= been flattened in ' +
      'pins-catalog.json? It must keep role=concern on ids 179-239.');
  }

  const out = {
    pinCount:       cat.pin_count,
    // namesList covers ALL pins, not just this account type. That also fixes a
    // latent bug in the rerun: a residential-only id on a commercial row used
    // to render as "id 30" instead of "Entry" in currentPinsAsText_, so the
    // model was told the analyst's own pin had no name.
    namesList:      all.map(function (p) { return { id: p.id, name: p.name }; }),
    emitNames:      numbered(emitPins),
    emitIds:        idSet(emitPins),
    elementNames:   numbered(elementPins),
    elementIds:     idSet(elementPins),
    frConcernNames: numbered(frConcern),
    frConcernIds:   idSet(frConcern),
    wfConcernNames: numbered(wfConcern),
    wfConcernIds:   idSet(wfConcern)
  };
  cache.put(cacheKey, JSON.stringify(out), 21600);
  return out;
}

// Clears the Pass 1 / Pass 2 vocabulary cache for both account types, so the
// next run re-reads pins-catalog.json instead of waiting out the 6-hour TTL.
// Run from the editor after changing SAT_PASS1_EMIT_IDS or the catalog.
// Clears BOTH key generations so a stale V1 entry can never be read back.
function clearSatPinCatalogCache() {
  CacheService.getScriptCache().removeAll(
    ['satPinCatalogV2:residential', 'satPinCatalogV2:commercial',
     'satPinCatalogV1:residential', 'satPinCatalogV1:commercial']);
  const c = satFetchPinCatalog_('commercial');
  const r = satFetchPinCatalog_('residential');
  const msg = 'Satellite pin-catalog cache cleared and re-read.\n\n' +
    'Pass 1 EMIT (fresh runs): ' + Object.keys(c.emitIds).length + ' commercial / ' +
    Object.keys(r.emitIds).length + ' residential — expect 20 / 20\n' +
    'Rerun ACCEPT: ' + Object.keys(c.elementIds).length + ' / ' +
    Object.keys(r.elementIds).length + ' — expect 239 / 239\n' +
    'Pass 2 FR concerns: ' + Object.keys(c.frConcernIds).length + ' / ' +
    Object.keys(r.frConcernIds).length + ' — expect 44 / 40\n' +
    'Pass 2 WF concerns: ' + Object.keys(c.wfConcernIds).length + ' / ' +
    Object.keys(r.wfConcernIds).length + ' — expect 25 / 27' +
    '\n\nIf EMIT is not 20, Pass 1 is NOT restricted to the twenty.' +
    '\nIf either Pass 2 number is 0, STOP — see satFetchPinCatalog_.';
  Logger.log(msg);
  try { SpreadsheetApp.getUi().alert('Pin Catalog', msg, SpreadsheetApp.getUi().ButtonSet.OK); }
  catch (e) { /* editor run, no UI */ }
  return msg;
}

// Satellite rerun instruction — a local copy of planeElementRerunInstruction_
// with the 12-pin cap. Without this the rerun would tell the model 10 and the
// cap would quietly come back on every re-pin from a Nadir Fixes note.
//
// ⚠️ 2026-08-17: HARDENED after a data-loss incident. On PRIDESTAFF the round-2
// critique was a single "ADD #2 Apartment Building" line. The model read the
// correction list as the COMPLETE answer and returned ONE pin, destroying the
// five the analyst had left alone. An ADD-only (or REMOVE-only) critique is the
// dangerous shape, because a short list of corrections reads like a short list of
// pins. The changes below make the arithmetic explicit rather than implied:
// the current pins are numbered and counted, the expected output count is stated,
// and the KEEP rule is the first and last thing the model reads.
// critique-api.gs also rolls back any re-pin that drops an untouched pin — a
// prompt is a request, not a guarantee.
function satElementRerunInstruction_(address, accountType, currentPinsText, fixesNote) {
  const pinLines = String(currentPinsText || '').split('\n').filter(function (l) { return l.trim(); });
  const currentCount = pinLines.length;

  return `Property address: ${address} [${accountType}].

This is a RE-RUN of the element-pin pass for this property. A human analyst reviewed the previous element pins and wrote corrections. Return a CORRECTED set of element pins for the NADIR image.

⚠️ THE CORRECTIONS BELOW ARE A LIST OF CHANGES, NOT A LIST OF PINS. They are not the answer. The answer is the CURRENT PINS with those changes applied. If the analyst wrote only one line, you still return every current pin, plus or minus that one change.

CURRENT ELEMENT PINS — there are ${currentCount}. Each is "id = name at (x, y)" on the nadir:
${currentPinsText || '(none were placed on the previous run)'}

ANALYST CORRECTIONS (authoritative — follow these exactly):
${fixesNote}

HOW TO APPLY THE CORRECTIONS
Start from the ${currentCount} current pins above and change ONLY what the analyst named:
- KEEP every current pin the analyst did not mention. This is the default. A pin the analyst was silent about is a pin they were happy with.
- KEEP every current pin the analyst marked correct.
- FIX pins the analyst says are wrong — correct the id (choose the right approved element id) and/or move x,y to the true centroid of the feature. A fixed pin is still IN the output.
- ADD element pins the analyst says are missing, each at the coordinate they gave, or at the feature's centroid on the nadir.
- REMOVE only the pins the analyst explicitly says do not belong.

COUNT CHECK BEFORE YOU ANSWER
Start from ${currentCount}. Subtract only the pins the analyst explicitly asked to REMOVE. Add only the pins the analyst explicitly asked to ADD. That number is how many pins your answer must contain. If your answer has fewer pins than that, you have dropped something the analyst wanted kept — go back and put it in.

CONSTRAINTS (unchanged from the element-pin pass)
Select AT MOST ${SAT_MAX_PINS} pins. Use ONLY approved ELEMENT ids from the vocabulary above — never invent an id, never use a non-element id. Do not use the same id twice. Coordinates are x,y percentages on the NADIR image ((0,0) top-left, (100,100) bottom-right). Place each pin at the feature's actual centroid.

Return ONLY the single JSON object described in your instructions: {"nadir_pins": [{"id": 12, "x": 62.5, "y": 31.0}]}. No markdown, no commentary.`;
}

// ── URL builders ─────────────────────────────────────────────────────────────

function buildNadirUrl(lat, lng, zoom) {
  const creds = getCredentials();
  return 'https://maps.googleapis.com/maps/api/staticmap?center=' + lat + ',' + lng +
    '&zoom=' + (zoom || 19) + '&size=640x640&maptype=satellite&key=' + creds.mapsKey;
}

function buildParcelFittedNadirUrl(centerLat, centerLng, zoom, mapsKey) {
  return 'https://maps.googleapis.com/maps/api/staticmap' +
    '?center=' + centerLat + ',' + centerLng +
    '&zoom=' + zoom + '&size=640x640&maptype=satellite' +
    '&markers=color:yellow%7Csize:small%7C' + centerLat + ',' + centerLng +
    '&key=' + mapsKey;
}

// ── Satellite sheet GitHub sync ──────────────────────────────────────────────

// Parse a pin-cell (JSON array of {id,x,y}) into a clean array; [] on empty
// or malformed. Used by the two-pass sync to publish x,y pin overlays.
function parsePinCell_(raw) {
  const s = String(raw || '').trim();
  if (!s || s.indexOf('ERROR:') === 0) return [];
  let v;
  try { v = JSON.parse(s); } catch (e) { return []; }
  if (!Array.isArray(v)) return [];
  return v.filter(function (p) {
    return p && typeof p === 'object' &&
      !isNaN(parseInt(p.id, 10)) && !isNaN(parseFloat(p.x)) && !isNaN(parseFloat(p.y));
  }).map(function (p) { return { id: parseInt(p.id, 10), x: parseFloat(p.x), y: parseFloat(p.y) }; });
}

function processSatelliteSheet() {
  const creds = getCredentials();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SATELLITE_SHEET);
  if (!sheet) { Logger.log('Satellite sheet not found'); return; }

  const data   = sheet.getDataRange().getValues();
  const hoaMap = fetchHoaMap();

  const sheetIds = new Set();
  for (let i = 1; i < data.length; i++) {
    const sweepId = satPropertyId_(data[i][SAT_COL_SITE_NO - 1], creds.hashSalt);
    if (sweepId) sheetIds.add(sweepId);
  }

  // v5.24 stale sweep (folder-only): for every index file NOT backed by a
  // Satellite row, drop ONLY satellite's own view keys (security/wildfire).
  // Any plane/drone/interior pointer survives; a file with no remaining view
  // is deleted. Index files with no security/wildfire view aren't satellite's.
  const files        = [];
  const sweepDeletes = [];
  let removed = 0;
  listIndexIds_().forEach(id => {
    if (sheetIds.has(id)) return;
    const entry = fetchIndexEntry_(id);
    if (!entry || !entry.views || (!entry.views.security && !entry.views.wildfire)) return;
    Logger.log('Sweeping satellite views from stale property: ' + (entry.name || id));
    const merged = mergeIndexEntry_(entry, { deleteViews: ['security', 'wildfire'] });
    delete merged.has_nadir;
    if (Object.keys(merged.views || {}).length === 0) sweepDeletes.push(id);
    else files.push(buildIndexEntryFile_(id, merged));
    removed++;
  });

  Object.keys(hoaMap).forEach(slug => {
    const before = hoaMap[slug].properties.length;
    hoaMap[slug].properties = hoaMap[slug].properties.filter(id => sheetIds.has(id));
    if (before !== hoaMap[slug].properties.length) Logger.log('HOA ' + slug + ': removed stale entries');
  });
  if (removed > 0) Logger.log('Swept satellite views from ' + removed + ' stale index files');

  const updates = [];
  let processed = 0, skipped = 0;

  for (let i = 1; i < data.length; i++) {
    const row         = data[i];
    const accountType = normalizeAccountType(row[SAT_COL_ACCOUNT_TYPE - 1]);
    const accountName = String(row[SAT_COL_ACCOUNT - 1] || '').trim();
    const address     = String(row[SAT_COL_ADDRESS - 1] || '').trim();
    const hoaTag      = row[SAT_COL_HOA - 1];
    const nadirUrl    = String(row[SAT_COL_NADIR_URL - 1] || '').trim();
    const elementsRaw = String(row[SAT_COL_ELEMENTS - 1] || '').trim();
    const lat         = parseFloat(row[SAT_COL_LAT - 1]);
    const lng         = parseFloat(row[SAT_COL_LNG - 1]);

    if (!accountName || !address) { skipped++; continue; }
    // Publish gate (per Stage 5 decision): any row that has element pins.
    if (!elementsRaw || elementsRaw.indexOf('ERROR:') === 0) { skipped++; continue; }

    const siteNo  = satValidSiteNo_(row[SAT_COL_SITE_NO - 1]);
    if (!siteNo) {
      Logger.log('SKIPPED — blank site_no (sheet row ' + (i + 1) + '): "' +
                 String(row[SAT_COL_SITE_NO - 1] || '') + '" [' + accountName + ']');
      skipped++; continue;
    }
    const id      = satPropertyId_(siteNo, creds.hashSalt);
    const hoaSlug = slugify(hoaTag);

    const propertyData = {
      name: accountName, address: address, hoa: hoaSlug || '', account_type: accountType,
      nadir_url: nadirUrl,
      elements: parsePinCell_(elementsRaw),
      fr: {
        concerns:        parsePinCell_(row[SAT_COL_FR_CONCERNS - 1]),
        considerations:  String(row[SAT_COL_FR_CONSIDER - 1] || '').trim(),
        recommendations: String(row[SAT_COL_FR_REC - 1] || '').trim()
      },
      wildfire: {
        concerns:        parsePinCell_(row[SAT_COL_WF_CONCERNS - 1]),
        considerations:  String(row[SAT_COL_WF_CONSIDER - 1] || '').trim(),
        recommendations: String(row[SAT_COL_WF_REC - 1] || '').trim()
      }
    };
    if (!isNaN(lat) && !isNaN(lng)) { propertyData.lat = lat; propertyData.lng = lng; }
    files.push({ path: 'data/satellite/' + id + '.json', content: JSON.stringify(propertyData, null, 2) });

    // v5.24: read-merge-write this property's index file. Satellite owns
    // security + wildfire; both views publish together once element pins
    // exist (each tab overlays the shared elements plus its concern pins,
    // which fill in once Pass 2 runs). deleteViews clears legacy aliases.
    const patch = {
      name: accountName, address: address, hoa: hoaSlug || '', account_type: accountType,
      has_nadir: true,
      views: { security: id, wildfire: id },
      deleteViews: ['satellite', 'safety', 'fr']
    };
    if (!isNaN(lat) && !isNaN(lng)) { patch.lat = lat; patch.lng = lng; }
    const up = upsertIndexEntry_(id, patch);
    files.push(up.file);

    if (hoaSlug) {
      if (!hoaMap[hoaSlug]) hoaMap[hoaSlug] = { name: hoaTag, properties: [] };
      if (!hoaMap[hoaSlug].properties.includes(id)) hoaMap[hoaSlug].properties.push(id);
    }

    updates.push({ rowIndex: i, id, accountName, address, hoaTag, views: up.entry.views });
    processed++;
    Logger.log('Queued: ' + accountName);
  }

  if (!files.length) { Logger.log('Nothing to push.'); return; }

  Object.keys(hoaMap).forEach(slug => {
    files.push({ path: 'data/hoa/' + slug + '.json', content: JSON.stringify(hoaMap[slug], null, 2) });
  });

  Logger.log('Pushing ' + files.length + ' files...');
  if (!pushAllToGitHub(files, 'Satellite')) return;

  sweepDeletes.forEach(id => { if (deleteIndexEntryFile_(id)) Logger.log('Deleted empty index file: ' + id); });

  updates.forEach(u => {
    const secLink   = VIEWER_BASE_URL + '?property=' + u.id + '&tab=security&mode=fr';
    const wfLink    = VIEWER_BASE_URL + '?property=' + u.id + '&tab=wildfire&mode=fr';
    const intelLink = VIEWER_BASE_URL + '?property=' + u.id;
    sheet.getRange(u.rowIndex + 1, SAT_COL_FR_LINK).setValue(secLink);
    sheet.getRange(u.rowIndex + 1, SAT_COL_WF_LINK).setValue(wfLink);
    sheet.getRange(u.rowIndex + 1, SAT_COL_UPLOAD_DATE).setValue(new Date().toLocaleString());
    updateIntelLinksSheet(u.accountName, u.address, intelLink, u.views, u.hoaTag);
    Logger.log('Links written: ' + u.accountName);
  });

  Logger.log('Satellite sync complete. Processed: ' + processed + ' | Skipped: ' + skipped);
}

// ── Single-row GitHub sync ───────────────────────────────────────────────────

function syncActiveRow() {
  const creds = getCredentials();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SATELLITE_SHEET);
  const row   = sheet.getActiveCell().getRow();
  if (row < 2) { SpreadsheetApp.getUi().alert('Please select a data row.'); return; }

  const accountType = normalizeAccountType(sheet.getRange(row, SAT_COL_ACCOUNT_TYPE).getValue());
  const accountName = String(sheet.getRange(row, SAT_COL_ACCOUNT).getValue() || '').trim();
  const address     = String(sheet.getRange(row, SAT_COL_ADDRESS).getValue() || '').trim();
  const hoaTag      = sheet.getRange(row, SAT_COL_HOA).getValue();
  const nadirUrl    = String(sheet.getRange(row, SAT_COL_NADIR_URL).getValue() || '').trim();
  const elementsRaw = String(sheet.getRange(row, SAT_COL_ELEMENTS).getValue() || '').trim();
  const lat         = parseFloat(sheet.getRange(row, SAT_COL_LAT).getValue());
  const lng         = parseFloat(sheet.getRange(row, SAT_COL_LNG).getValue());

  if (!accountName || !address) { SpreadsheetApp.getUi().alert('Row is missing account name or address.'); return; }
  if (!elementsRaw || elementsRaw.indexOf('ERROR:') === 0) {
    SpreadsheetApp.getUi().alert('Row has no element pins yet. Run Element Pins — Pass 1 first.');
    return;
  }

  const siteNo = satValidSiteNo_(sheet.getRange(row, SAT_COL_SITE_NO).getValue());
  if (!siteNo) {
    SpreadsheetApp.getUi().alert('Row ' + row + ' has a blank site_no in column A.\n\n' +
      'Put any id there (the source-system number when you have it, or the ' +
      'interim value already in use). A blank hashes every empty row onto one file.');
    return;
  }
  const id      = satPropertyId_(siteNo, creds.hashSalt);
  const hoaSlug = slugify(hoaTag);

  // Preserve a stored parcel_ring if the property JSON already has one.
  let existingRing = null;
  try {
    const headers = { 'Authorization': 'token ' + creds.githubToken, 'Accept': 'application/vnd.github.v3+json' };
    const res = UrlFetchApp.fetch(
      'https://api.github.com/repos/' + GITHUB_REPO + '/contents/data/satellite/' + id + '.json',
      { method: 'GET', headers, muteHttpExceptions: true }
    );
    if (res.getResponseCode() === 200) {
      const file = JSON.parse(res.getContentText());
      const prev = JSON.parse(Utilities.newBlob(Utilities.base64Decode(file.content.replace(/\n/g, ''))).getDataAsString());
      if (prev && prev.parcel_ring) existingRing = prev.parcel_ring;
    }
  } catch (e) { Logger.log('syncActiveRow: could not fetch existing JSON — ' + e.message); }

  const propertyData = {
    name: accountName, address: address, hoa: hoaSlug || '', account_type: accountType,
    nadir_url: nadirUrl,
    elements: parsePinCell_(elementsRaw),
    fr: {
      concerns:        parsePinCell_(sheet.getRange(row, SAT_COL_FR_CONCERNS).getValue()),
      considerations:  String(sheet.getRange(row, SAT_COL_FR_CONSIDER).getValue() || '').trim(),
      recommendations: String(sheet.getRange(row, SAT_COL_FR_REC).getValue() || '').trim()
    },
    wildfire: {
      concerns:        parsePinCell_(sheet.getRange(row, SAT_COL_WF_CONCERNS).getValue()),
      considerations:  String(sheet.getRange(row, SAT_COL_WF_CONSIDER).getValue() || '').trim(),
      recommendations: String(sheet.getRange(row, SAT_COL_WF_REC).getValue() || '').trim()
    }
  };
  if (!isNaN(lat) && !isNaN(lng)) { propertyData.lat = lat; propertyData.lng = lng; }
  if (existingRing) propertyData.parcel_ring = existingRing;

  const hoaMap = fetchHoaMap();

  const patch = {
    name: accountName, address: address, hoa: hoaSlug || '', account_type: accountType,
    has_nadir: true,
    views: { security: id, wildfire: id },
    deleteViews: ['satellite', 'safety', 'fr']
  };
  if (!isNaN(lat) && !isNaN(lng)) { patch.lat = lat; patch.lng = lng; }
  const up = upsertIndexEntry_(id, patch);

  if (hoaSlug) {
    if (!hoaMap[hoaSlug]) hoaMap[hoaSlug] = { name: hoaTag, properties: [] };
    if (!hoaMap[hoaSlug].properties.includes(id)) hoaMap[hoaSlug].properties.push(id);
  }

  const files = [
    { path: 'data/satellite/' + id + '.json', content: JSON.stringify(propertyData, null, 2) },
    up.file
  ];
  if (hoaSlug && hoaMap[hoaSlug]) {
    files.push({ path: 'data/hoa/' + hoaSlug + '.json', content: JSON.stringify(hoaMap[hoaSlug], null, 2) });
  }

  Logger.log('syncActiveRow: pushing ' + files.length + ' files for ' + accountName);
  if (!pushAllToGitHub(files, 'Row — ' + accountName)) {
    SpreadsheetApp.getUi().alert('GitHub push failed. Check execution logs.');
    return;
  }

  const secLink   = VIEWER_BASE_URL + '?property=' + id + '&tab=security&mode=fr';
  const wfLink    = VIEWER_BASE_URL + '?property=' + id + '&tab=wildfire&mode=fr';
  const intelLink = VIEWER_BASE_URL + '?property=' + id;
  sheet.getRange(row, SAT_COL_FR_LINK).setValue(secLink);
  sheet.getRange(row, SAT_COL_WF_LINK).setValue(wfLink);
  sheet.getRange(row, SAT_COL_UPLOAD_DATE).setValue(new Date().toLocaleString());
  updateIntelLinksSheet(accountName, address, intelLink, up.entry.views, hoaTag);

  Logger.log('syncActiveRow: complete for ' + accountName);
  SpreadsheetApp.getUi().alert('Row synced to GitHub: ' + accountName);
}

// ============================================================
// SATELLITE PIPELINE — PASS 1: ELEMENT PINS (single nadir)
// ============================================================
// The satellite analog of the plane Pass 1 flow, on the NEW SAT_COL_*
// layout. Two steps:
//   (A) prepareSatNadir_  — for a row missing coords or a nadir URL:
//       geocode, parcel-fit (yellow centroid marker), write Lat/Lng (F/G)
//       and the single clean Nadir URL (H). No analysis.
//   (B) runSatElementPinsCall_ — send that ONE nadir image with the ELEMENT
//       vocabulary, parse + validate element ids, write the element pins to
//       Nadir Elements (I), and reset Elements Reviewed (J) to unchecked.
//       Writes NOTHING to concerns/considerations/recs — those are Pass 2.
//       Shared core for BOTH Pass 1 and the rerun-from-fixes, and the ONE
//       place the emit/accept split is applied.
// Pins are {id,x,y} percentages (viewer converts to lat/lng on the Maps
// overlay — no bounds stored). Reuses the shared helpers defined in
// plane.gs: parseElementPins_, currentPinsAsText_, guessImageMediaType_.
// The catalog comes from satFetchPinCatalog_ (this file), NOT plane's.

// (A) Ensure a row has coordinates + a clean nadir URL. Returns true if the
// row is ready for element pinning, false (with a status written) on failure.
//
// ⚠️ COST NOTE: this returns immediately when a Nadir URL already exists.
// Blanking the Nadir URL column forces a rebuild, and where fetchParcelRing
// returns nothing it falls through to selectBestZoom — 3 Static Maps fetches
// plus a Bedrock call, per row. Parcel tiles are Deschutes-only, so every
// Prineville / Madras / Crook / Jefferson / Harney / Asante row pays that
// toll. Do not blank Nadir URLs in bulk to force a re-pin; blank Nadir
// Elements instead.
function prepareSatNadir_(sheet, row) {
  const creds   = getCredentials();
  const address = String(sheet.getRange(row, SAT_COL_ADDRESS).getValue() || '').trim();
  if (!address) { writePlainCell(sheet, row, SAT_COL_ELEMENTS, 'ERROR: no address'); return false; }
  const accountType = normalizeAccountType(sheet.getRange(row, SAT_COL_ACCOUNT_TYPE).getValue());

  let lat = parseFloat(sheet.getRange(row, SAT_COL_LAT).getValue());
  let lng = parseFloat(sheet.getRange(row, SAT_COL_LNG).getValue());
  if (isNaN(lat) || isNaN(lng)) {
    const coords = geocodeAddress(address);
    if (!coords) { writePlainCell(sheet, row, SAT_COL_ELEMENTS, 'ERROR: Geocoding failed'); return false; }
    lat = coords.lat; lng = coords.lng;
    sheet.getRange(row, SAT_COL_LAT).setValue(lat);
    sheet.getRange(row, SAT_COL_LNG).setValue(lng);
  }

  // Already has a nadir URL? Nothing to do.
  if (String(sheet.getRange(row, SAT_COL_NADIR_URL).getValue() || '').trim()) return true;

  const ring = fetchParcelRing(lat, lng);
  let nadirUrl;
  if (ring && ring.length >= 3) {
    const bounds = parcelBounds(ring);
    const zoom   = zoomForBounds(bounds.minLat, bounds.maxLat, bounds.minLng, bounds.maxLng);
    nadirUrl = buildParcelFittedNadirUrl(bounds.centerLat, bounds.centerLng, zoom, creds.mapsKey);
    Logger.log('Sat nadir (parcel-fit z' + zoom + '): ' + address + ' [' + accountType + ']');
  } else {
    const zoom = selectBestZoom(lat, lng, accountType);
    // buildParcelFittedNadirUrl also draws the yellow centroid marker at lat/lng.
    nadirUrl = buildParcelFittedNadirUrl(lat, lng, zoom, creds.mapsKey);
    Logger.log('Sat nadir (standard z' + zoom + ', no parcel ring): ' + address + ' [' + accountType + ']');
  }
  sheet.getRange(row, SAT_COL_NADIR_URL).setValue(nadirUrl);
  SpreadsheetApp.flush();
  return true;
}

// (B) Shared element-pins core for Pass 1 AND the rerun.
//
// ⭐ v5.27 — THE FOURTH PARAMETER IS THE WHOLE RESTRICTION.
//   useFullVocab omitted/false -> emitNames + emitIds  = the TWENTY.
//        Fresh Pass 1. The model chooses freely, so it is held in code:
//        anything outside the twenty is rejected by satValidateElementPins_
//        and logged, never written to the sheet.
//   useFullVocab true          -> elementNames + elementIds = all 239.
//        Rerun from a Nadir Fixes note, and critique-api's inline re-pin.
//        An analyst has explicitly named a pin and the viewer offers all 239,
//        so narrowing here would silently drop their ADD — MOCKINGBIRD.
// processSatElementPinsRow_ calls this with THREE arguments, which is what
// selects the restricted vocabulary. Do not "helpfully" add a fourth there.
//
// Returns true on success (pins written or a legitimately empty set), false
// on any failure.
function runSatElementPinsCall_(sheet, row, trailingInstruction, useFullVocab) {
  const address     = String(sheet.getRange(row, SAT_COL_ADDRESS).getValue() || '').trim();
  const accountType = normalizeAccountType(sheet.getRange(row, SAT_COL_ACCOUNT_TYPE).getValue());
  const nadirUrl    = String(sheet.getRange(row, SAT_COL_NADIR_URL).getValue() || '').trim();
  if (!nadirUrl) { writePlainCell(sheet, row, SAT_COL_ELEMENTS, 'ERROR: no nadir URL — run Prepare Nadir first'); return false; }

  const catalog    = satFetchPinCatalog_(accountType);
  const vocabNames = useFullVocab ? catalog.elementNames : catalog.emitNames;
  const vocabIds   = useFullVocab ? catalog.elementIds   : catalog.emitIds;

  const prompt = satelliteElementPinsPrompt_() +
    '\n\nAPPROVED ELEMENT PIN VOCABULARY (use ONLY these ids):\n' +
    vocabNames;
  const kbContext  = queryKnowledgeBase('aerial property intelligence property elements structures access vegetation');
  const fullPrompt = kbContext ? prompt + '\n\nREFERENCE CONTEXT FROM KNOWLEDGE BASE:\n' + kbContext : prompt;

  const b64 = fetchImageAsBase64(nadirUrl);
  if (!b64) { writePlainCell(sheet, row, SAT_COL_ELEMENTS, 'ERROR: nadir image fetch failed'); return false; }

  const userContent = [
    { type: 'text',  text: 'IMAGE — NADIR (straight-down satellite view; yellow marker = target property centroid). Place element pins on this image.' },
    { type: 'image', source: { type: 'base64', media_type: guessImageMediaType_(nadirUrl), data: b64 } },
    { type: 'text',  text: trailingInstruction }
  ];

  const result = callBedrock(fullPrompt, userContent, 1000);
  if (!result) { writePlainCell(sheet, row, SAT_COL_ELEMENTS, 'ERROR: Bedrock call failed'); return false; }
  const parsed = parseElementPins_(result);
  if (!parsed) {
    Logger.log('Sat element pins raw (row ' + row + '): ' + result.substring(0, 400));
    writePlainCell(sheet, row, SAT_COL_ELEMENTS, 'ERROR: JSON parse failed');
    return false;
  }

  const pins = satValidateElementPins_(parsed.nadir_pins, vocabIds);

  // Say so when the model reached outside its vocabulary. Here the drop is
  // CORRECT, but silent dropping is exactly what hid the MOCKINGBIRD failure,
  // so it is logged by id — a drift back toward the full catalog stays visible
  // in the execution log instead of only showing up in review.
  const rejected = (parsed.nadir_pins || []).filter(function (p) {
    return !vocabIds[parseInt(p.id, 10)];
  }).map(function (p) { return p.id; });
  if (rejected.length) {
    Logger.log('Sat element pins: row ' + row + ' — ' + rejected.length + ' pin(s) REJECTED as ' +
      'outside the ' + (useFullVocab ? 'full catalog' : 'Pass 1 emit list (the twenty)') +
      ' — ids: ' + rejected.join(', '));
  }

  writePlainCell(sheet, row, SAT_COL_ELEMENTS, pins.length ? JSON.stringify(pins) : '');
  sheet.getRange(row, SAT_COL_REVIEWED).setValue(false); // fresh pins invalidate prior review
  SpreadsheetApp.flush();
  Logger.log('Sat element pins: row ' + row + ' — ' + address + ' [' + accountType + ', ' + pins.length + ' elements]');
  return pins.length > 0 || parsed.nadir_pins.length === 0;
}

// Pass 1 per-row: prepare nadir (if needed) then element-pin it.
// ⚠️ Calls runSatElementPinsCall_ with THREE arguments on purpose — the
// missing fourth is what restricts this path to the twenty.
function processSatElementPinsRow_(sheet, row) {
  const address     = String(sheet.getRange(row, SAT_COL_ADDRESS).getValue() || '').trim();
  const accountType = normalizeAccountType(sheet.getRange(row, SAT_COL_ACCOUNT_TYPE).getValue());
  if (!prepareSatNadir_(sheet, row)) return false;
  const trailing =
    'Property address: ' + address + ' [' + accountType + ']. ' +
    'Identify the physical property elements on the target property (yellow marker) and return ONLY the JSON object described in your instructions.';
  return runSatElementPinsCall_(sheet, row, trailing);
}

// Pass 1 readiness: address present AND Nadir Elements (I) empty or a prior
// ERROR. (Nadir URL is generated on demand by prepareSatNadir_, so a row
// without one is still "ready" — it just gets a nadir first.)
// ⚠️ A row that already HAS pins is NOT ready, whatever its review state. To
// force a re-pin in bulk, blank the Nadir Elements column on those rows.
function satRowReadyForElementPins_(rowVals) {
  const address = String(rowVals[SAT_COL_ADDRESS - 1] || '').trim();
  if (!address) return false;
  const elements = String(rowVals[SAT_COL_ELEMENTS - 1] || '').trim();
  return !elements || elements.indexOf('ERROR:') === 0;
}

// Pass 1 batch CORE (UI-free): process up to BATCH_SIZE ready rows. Returns
// { ready, attempted, done, failed, remaining }. Shared by the menu wrapper
// (which alerts) and the 5-minute auto-run (which logs). A row is "ready"
// when it has an address AND Nadir Elements is blank or starts with ERROR:.
function runSatElementPinsBatch_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { ready: 0, attempted: 0, done: 0, failed: 0, remaining: 0 };
  const width = Math.max(sheet.getLastColumn(), SAT_COL_UPLOAD_DATE);
  const data  = sheet.getRange(2, 1, lastRow - 1, width).getValues();

  const ready = [];
  data.forEach(function (r, i) { if (satRowReadyForElementPins_(r)) ready.push(i + 2); });

  let done = 0, failed = 0, attempted = 0;
  for (let i = 0; i < ready.length; i++) {
    if (attempted >= BATCH_SIZE) break;
    attempted++;
    try { if (processSatElementPinsRow_(sheet, ready[i])) done++; else failed++; }
    catch (e) {
      failed++;
      Logger.log('Sat element pins ERROR row ' + ready[i] + ': ' + e.message);
      writePlainCell(sheet, ready[i], SAT_COL_ELEMENTS, 'ERROR: ' + e.message.substring(0, 80));
    }
    Utilities.sleep(2000);
  }
  return { ready: ready.length, attempted: attempted, done: done, failed: failed,
           remaining: Math.max(0, ready.length - attempted) };
}

// Pass 1 batch (menu): up to BATCH_SIZE ready rows, with a summary dialog.
function generateSatElementPinsBatch() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SATELLITE_SHEET);
  if (!sheet) { SpreadsheetApp.getUi().alert('Sheet "' + SATELLITE_SHEET + '" not found'); return; }
  if (sheet.getLastRow() < 2) { SpreadsheetApp.getUi().alert('Satellite sheet is empty.'); return; }

  const r = runSatElementPinsBatch_(sheet);
  if (r.ready === 0) {
    SpreadsheetApp.getUi().alert('Satellite Element Pins (Pass 1)',
      'No rows ready.\n(A row is ready when it has an address and Nadir Elements is blank or shows an error.)',
      SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }
  SpreadsheetApp.getUi().alert('Satellite Element Pins (Pass 1)',
    'Completed: ' + r.done + '\nFailed: ' + r.failed +
    (r.remaining > 0 ? '\nRemaining: ' + r.remaining + ' — run again to continue.' : '\nAll ready rows processed.') +
    (r.done > 0 ? '\n\nReview the element pins (Open Element Review), then tick "Elements Reviewed" — or write a "Nadir Fixes" note to rerun. Pass 2 (FR + Wildfire concerns) runs after review.' : ''),
    SpreadsheetApp.getUi().ButtonSet.OK);
}

// ── Pass 1 AUTO-RUN (time-driven trigger, every 5 minutes) ─────────────────
// Trigger entry point: NO UI (triggered context has none) — logs only. Runs
// the same batch core (20 rows/run) as the menu action. A ScriptLock guards
// against overlap if a run ever exceeds 5 minutes. Install/stop/status below.
const SAT_ELEMENT_AUTO_TRIGGER = 'generateSatElementPinsAutoRun';

function generateSatElementPinsAutoRun() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) { Logger.log('Sat Pass 1 auto-run: another run holds the lock — skipping.'); return; }
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SATELLITE_SHEET);
    if (!sheet) { Logger.log('Sat Pass 1 auto-run: sheet "' + SATELLITE_SHEET + '" not found.'); return; }
    if (sheet.getLastRow() < 2) { Logger.log('Sat Pass 1 auto-run: sheet empty.'); return; }
    const r = runSatElementPinsBatch_(sheet);
    Logger.log('Sat Pass 1 auto-run: ready=' + r.ready + ' attempted=' + r.attempted +
               ' done=' + r.done + ' failed=' + r.failed + ' remaining=' + r.remaining);
  } catch (e) {
    Logger.log('Sat Pass 1 auto-run ERROR: ' + e.message);
  } finally {
    lock.releaseLock();
  }
}

// Install the every-5-minutes trigger (idempotent — clears any existing one
// first so you never end up with duplicates). Menu-driven; shows a dialog.
function startSatElementPinsAuto() {
  const ui = SpreadsheetApp.getUi();
  let removed = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === SAT_ELEMENT_AUTO_TRIGGER) { ScriptApp.deleteTrigger(t); removed++; }
  });
  ScriptApp.newTrigger(SAT_ELEMENT_AUTO_TRIGGER).timeBased().everyMinutes(5).create();
  ui.alert('Auto Element Pins (Pass 1)',
    'Started. Pass 1 will run automatically every 5 minutes, up to ' + BATCH_SIZE + ' rows per run, ' +
    'for any row whose Nadir Elements cell is blank or shows an error.' +
    (removed ? '\n\n(Replaced ' + removed + ' existing auto trigger.)' : '') +
    '\n\nUse "Stop Auto Element Pins" to turn it off.',
    ui.ButtonSet.OK);
}

function stopSatElementPinsAuto() {
  const ui = SpreadsheetApp.getUi();
  let removed = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === SAT_ELEMENT_AUTO_TRIGGER) { ScriptApp.deleteTrigger(t); removed++; }
  });
  ui.alert('Auto Element Pins (Pass 1)',
    removed ? 'Stopped. Removed ' + removed + ' auto trigger(s).' : 'No auto trigger was running.',
    ui.ButtonSet.OK);
}

function checkSatElementPinsAutoStatus() {
  const ui = SpreadsheetApp.getUi();
  const running = ScriptApp.getProjectTriggers().some(function (t) {
    return t.getHandlerFunction() === SAT_ELEMENT_AUTO_TRIGGER;
  });
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SATELLITE_SHEET);
  let readyCount = 0;
  if (sheet && sheet.getLastRow() >= 2) {
    const width = Math.max(sheet.getLastColumn(), SAT_COL_UPLOAD_DATE);
    const data  = sheet.getRange(2, 1, sheet.getLastRow() - 1, width).getValues();
    data.forEach(function (r) { if (satRowReadyForElementPins_(r)) readyCount++; });
  }
  ui.alert('Auto Element Pins (Pass 1)',
    'Auto-run: ' + (running ? 'ACTIVE (every 5 minutes, ' + BATCH_SIZE + '/run)' : 'not running') + '\n' +
    'Rows still needing Pass 1: ' + readyCount,
    ui.ButtonSet.OK);
}

// Pass 1 this-row (confirms overwrite if pins already exist).
function generateSatElementPinsForActiveRow() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SATELLITE_SHEET);
  if (!sheet) { SpreadsheetApp.getUi().alert('Sheet "' + SATELLITE_SHEET + '" not found'); return; }
  const row = sheet.getActiveCell().getRow();
  if (row < 2) { SpreadsheetApp.getUi().alert('Please select a data row.'); return; }
  const address = String(sheet.getRange(row, SAT_COL_ADDRESS).getValue() || '').trim();
  if (!address) { SpreadsheetApp.getUi().alert('Row ' + row + ' has no Property Address.'); return; }

  const existing = String(sheet.getRange(row, SAT_COL_ELEMENTS).getValue() || '').trim();
  if (existing && existing.indexOf('ERROR:') !== 0) {
    const ui = SpreadsheetApp.getUi();
    const ans = ui.alert('Regenerate?',
      'Row ' + row + ' already has element pins.\nRegenerate for:\n' + address + '?\n\n(This also clears the Elements Reviewed checkbox.)',
      ui.ButtonSet.YES_NO);
    if (ans !== ui.Button.YES) return;
  }
  const ok = processSatElementPinsRow_(sheet, row);
  SpreadsheetApp.getUi().alert('Satellite Element Pins (Pass 1)',
    ok ? 'Element pins written for:\n' + address + '\n\nReview them, then tick "Elements Reviewed" (or write a "Nadir Fixes" note to rerun).'
       : 'Element pin generation FAILED for:\n' + address + '\nSee the Nadir Elements cell and execution logs.',
    SpreadsheetApp.getUi().ButtonSet.OK);
}

// ── Satellite Pass 1 RERUN — re-pin from analyst Nadir Fixes (K) ────────────
// Reuses satElementRerunInstruction_ + currentPinsAsText_. Rewrites I,
// resets J; never writes K. Returns 'no-fixes' | true | false.
//
// ⚠️ THIS PATH PASSES useFullVocab = true ON PURPOSE. An analyst may ADD any
// of the 239 catalog pins from the viewer, and restricting this call to the
// twenty would silently discard that add — the MOCKINGBIRD failure, on every
// row. If you ever "tidy" the fourth argument away, you reintroduce it.
function rerunSatElementPinsRow_(sheet, row) {
  const address     = String(sheet.getRange(row, SAT_COL_ADDRESS).getValue() || '').trim();
  const accountType = normalizeAccountType(sheet.getRange(row, SAT_COL_ACCOUNT_TYPE).getValue());
  const fixesNote   = String(sheet.getRange(row, SAT_COL_FIXES).getValue() || '').trim();
  if (!fixesNote) return 'no-fixes';
  if (!prepareSatNadir_(sheet, row)) return false;

  const pinsRaw = String(sheet.getRange(row, SAT_COL_ELEMENTS).getValue() || '').trim();
  const catalog = satFetchPinCatalog_(accountType);
  const currentPinsText = currentPinsAsText_(pinsRaw, catalog);
  const trailing = satElementRerunInstruction_(address, accountType, currentPinsText, fixesNote);
  return runSatElementPinsCall_(sheet, row, trailing, true);
}

function rerunSatElementPinsForActiveRow() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SATELLITE_SHEET);
  if (!sheet) { SpreadsheetApp.getUi().alert('Sheet "' + SATELLITE_SHEET + '" not found'); return; }
  const row = sheet.getActiveCell().getRow();
  if (row < 2) { SpreadsheetApp.getUi().alert('Please select a data row.'); return; }
  const address = String(sheet.getRange(row, SAT_COL_ADDRESS).getValue() || '').trim();
  if (!address) { SpreadsheetApp.getUi().alert('Row ' + row + ' has no Property Address.'); return; }
  const fixesNote = String(sheet.getRange(row, SAT_COL_FIXES).getValue() || '').trim();
  if (!fixesNote) {
    SpreadsheetApp.getUi().alert('Rerun Element Pins',
      'Row ' + row + ' has no "Nadir Fixes" note.\nWrite the correction in column K, then rerun.',
      SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }
  const outcome = rerunSatElementPinsRow_(sheet, row);
  SpreadsheetApp.getUi().alert('Rerun Element Pins (Pass 1)',
    outcome === true
      ? 'Element pins re-generated from your Nadir Fixes note for:\n' + address +
        '\n\nYour note is kept for the record. Review the new pins, then tick "Elements Reviewed".'
      : 'Rerun FAILED for:\n' + address + '\nSee the Nadir Elements cell and execution logs.',
    SpreadsheetApp.getUi().ButtonSet.OK);
}

function rerunSatElementPinsBatch() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SATELLITE_SHEET);
  if (!sheet) { SpreadsheetApp.getUi().alert('Sheet "' + SATELLITE_SHEET + '" not found'); return; }
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) { SpreadsheetApp.getUi().alert('Satellite sheet is empty.'); return; }
  const width = Math.max(sheet.getLastColumn(), SAT_COL_UPLOAD_DATE);
  const data  = sheet.getRange(2, 1, lastRow - 1, width).getValues();

  const flagged = [];
  data.forEach(function (r, i) {
    const fixesNote = String(r[SAT_COL_FIXES - 1] || '').trim();
    const reviewed  = r[SAT_COL_REVIEWED - 1] === true;
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
    if (attempted >= BATCH_SIZE) break;
    attempted++;
    try { if (rerunSatElementPinsRow_(sheet, flagged[i]) === true) done++; else failed++; }
    catch (e) {
      failed++;
      Logger.log('Sat rerun ERROR row ' + flagged[i] + ': ' + e.message);
      writePlainCell(sheet, flagged[i], SAT_COL_ELEMENTS, 'ERROR: ' + e.message.substring(0, 80));
    }
    Utilities.sleep(2000);
  }
  const remaining = flagged.length - attempted + failed;
  SpreadsheetApp.getUi().alert('Rerun Element Pins (All Flagged)',
    'Completed: ' + done + '\nFailed: ' + failed +
    (remaining > 0 ? '\nRemaining: ' + remaining + ' — run again to continue.' : '\nAll flagged rows processed.') +
    '\n\n"Nadir Fixes" notes are kept for the record. Review the new pins and tick "Elements Reviewed".',
    SpreadsheetApp.getUi().ButtonSet.OK);
}

// ── Pass 1 RERUN AUTO-RUN (time-driven, every 5 minutes) ───────────────────
// Companion to the Pass 1 auto-run: watches the Nadir Fixes column for new
// batches of reviewer corrections and regenerates those rows automatically.
// Selector: Nadir Fixes non-empty AND Elements Reviewed unchecked (same as
// the manual "All Flagged" batch), capped at BATCH_SIZE per run. Runs exactly
// ONCE per note — on a SUCCESSFUL rerun it CLEARS the Nadir Fixes cell, so the
// row won't re-fire next cycle (old notes/pins are archived separately, per
// the batch workflow). A failed rerun leaves the note in place to retry. When
// a fresh batch of notes is pasted in, those cells become non-empty again and
// are picked up within 5 minutes. NO UI (triggered context) — logs only.
//
// ⚠️ DURING A BULK PASS 1 RERUN: a row whose Nadir Elements you blanked but
// which still holds a Nadir Fixes note is claimed by THIS trigger, not the
// Pass 1 one — and the rerun prompt will hand the model an analyst correction
// list against zero current pins. Clear the Nadir Fixes column on those rows,
// or stop this trigger until the bulk Pass 1 finishes.

// Rerun CORE (UI-free): reruns flagged rows, clears the note on success.
// Returns { flagged, attempted, done, failed, remaining }.
function runSatElementRerunBatch_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { flagged: 0, attempted: 0, done: 0, failed: 0, remaining: 0 };
  const width = Math.max(sheet.getLastColumn(), SAT_COL_UPLOAD_DATE);
  const data  = sheet.getRange(2, 1, lastRow - 1, width).getValues();

  const flagged = [];
  data.forEach(function (r, i) {
    const fixesNote = String(r[SAT_COL_FIXES - 1] || '').trim();
    const reviewed  = r[SAT_COL_REVIEWED - 1] === true;
    if (fixesNote && !reviewed) flagged.push(i + 2);
  });

  let done = 0, failed = 0, attempted = 0;
  for (let i = 0; i < flagged.length; i++) {
    if (attempted >= BATCH_SIZE) break;
    attempted++;
    try {
      if (rerunSatElementPinsRow_(sheet, flagged[i]) === true) {
        done++;
        // Clear the consumed note so this row won't re-fire next cycle.
        // (The note is archived separately by the batch workflow.)
        writePlainCell(sheet, flagged[i], SAT_COL_FIXES, '');
      } else {
        failed++;
      }
    } catch (e) {
      failed++;
      Logger.log('Sat rerun auto ERROR row ' + flagged[i] + ': ' + e.message);
      writePlainCell(sheet, flagged[i], SAT_COL_ELEMENTS, 'ERROR: ' + e.message.substring(0, 80));
    }
    Utilities.sleep(2000);
  }
  return { flagged: flagged.length, attempted: attempted, done: done, failed: failed,
           remaining: Math.max(0, flagged.length - attempted) };
}

const SAT_RERUN_AUTO_TRIGGER = 'generateSatElementRerunAutoRun';

function generateSatElementRerunAutoRun() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) { Logger.log('Sat rerun auto-run: another run holds the lock — skipping.'); return; }
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SATELLITE_SHEET);
    if (!sheet) { Logger.log('Sat rerun auto-run: sheet "' + SATELLITE_SHEET + '" not found.'); return; }
    if (sheet.getLastRow() < 2) { Logger.log('Sat rerun auto-run: sheet empty.'); return; }
    const r = runSatElementRerunBatch_(sheet);
    Logger.log('Sat rerun auto-run: flagged=' + r.flagged + ' attempted=' + r.attempted +
               ' done=' + r.done + ' failed=' + r.failed + ' remaining=' + r.remaining);
  } catch (e) {
    Logger.log('Sat rerun auto-run ERROR: ' + e.message);
  } finally {
    lock.releaseLock();
  }
}

function startSatElementRerunAuto() {
  const ui = SpreadsheetApp.getUi();
  let removed = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === SAT_RERUN_AUTO_TRIGGER) { ScriptApp.deleteTrigger(t); removed++; }
  });
  ScriptApp.newTrigger(SAT_RERUN_AUTO_TRIGGER).timeBased().everyMinutes(5).create();
  ui.alert('Auto Rerun from Nadir Fixes (Pass 1)',
    'Started. Every 5 minutes, up to ' + BATCH_SIZE + ' rows that have a "Nadir Fixes" note ' +
    'and an unchecked "Elements Reviewed" box will be regenerated. On success the note is cleared ' +
    'so each edit reruns once.' +
    (removed ? '\n\n(Replaced ' + removed + ' existing rerun trigger.)' : '') +
    '\n\nUse "Stop Auto Rerun from Fixes" to turn it off.',
    ui.ButtonSet.OK);
}

function stopSatElementRerunAuto() {
  const ui = SpreadsheetApp.getUi();
  let removed = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === SAT_RERUN_AUTO_TRIGGER) { ScriptApp.deleteTrigger(t); removed++; }
  });
  ui.alert('Auto Rerun from Nadir Fixes (Pass 1)',
    removed ? 'Stopped. Removed ' + removed + ' rerun trigger(s).' : 'No rerun trigger was running.',
    ui.ButtonSet.OK);
}

function checkSatElementRerunAutoStatus() {
  const ui = SpreadsheetApp.getUi();
  const running = ScriptApp.getProjectTriggers().some(function (t) {
    return t.getHandlerFunction() === SAT_RERUN_AUTO_TRIGGER;
  });
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SATELLITE_SHEET);
  let flaggedCount = 0;
  if (sheet && sheet.getLastRow() >= 2) {
    const width = Math.max(sheet.getLastColumn(), SAT_COL_UPLOAD_DATE);
    const data  = sheet.getRange(2, 1, sheet.getLastRow() - 1, width).getValues();
    data.forEach(function (r) {
      const note = String(r[SAT_COL_FIXES - 1] || '').trim();
      if (note && r[SAT_COL_REVIEWED - 1] !== true) flaggedCount++;
    });
  }
  ui.alert('Auto Rerun from Nadir Fixes (Pass 1)',
    'Auto-rerun: ' + (running ? 'ACTIVE (every 5 minutes, ' + BATCH_SIZE + '/run)' : 'not running') + '\n' +
    'Rows with a pending Nadir Fixes note: ' + flaggedCount,
    ui.ButtonSet.OK);
}

// ── Element review link (satellite) ─────────────────────────────────────────
// Builds the element-review.html URL from the row's nadir + element pins,
// adding &type= so the review page can flag misfiled pins, and &site_no=
// so the critique API can file against THIS row when the address is shared.
// One row at a time.
function buildSatElementReviewUrl_(sheet, row) {
  const nadirUrl = String(sheet.getRange(row, SAT_COL_NADIR_URL).getValue() || '').trim();
  const pinsRaw  = String(sheet.getRange(row, SAT_COL_ELEMENTS).getValue() || '').trim();
  const address  = String(sheet.getRange(row, SAT_COL_ADDRESS).getValue() || '').trim();
  const acctType = normalizeAccountType(sheet.getRange(row, SAT_COL_ACCOUNT_TYPE).getValue());
  const siteNo   = String(sheet.getRange(row, SAT_COL_SITE_NO).getValue() || '').trim();
  if (!nadirUrl || !pinsRaw) return null;
  let pins;
  try { pins = JSON.parse(pinsRaw); } catch (e) { return null; }
  if (!Array.isArray(pins)) return null;
  return withReviewSiteNo_(
    ELEMENT_REVIEW_URL +
      '?nadir=' + encodeURIComponent(nadirUrl) +
      '&pins='  + encodeURIComponent(JSON.stringify(pins)) +
      '&type='  + encodeURIComponent(acctType) +
      (address ? '&addr=' + encodeURIComponent(address) : ''),
    siteNo);
}

function openSatElementReviewForActiveRow() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SATELLITE_SHEET);
  if (!sheet) { SpreadsheetApp.getUi().alert('Sheet "' + SATELLITE_SHEET + '" not found'); return; }
  const row = sheet.getActiveCell().getRow();
  if (row < 2) { SpreadsheetApp.getUi().alert('Please select a data row.'); return; }
  const url = buildSatElementReviewUrl_(sheet, row);
  if (!url) {
    SpreadsheetApp.getUi().alert('Element Review',
      'Row ' + row + ' has no nadir image or no element pins yet.\nRun "Generate Element Pins — Pass 1 (This Row)" first.',
      SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }
  const address = String(sheet.getRange(row, SAT_COL_ADDRESS).getValue() || '').trim();
  const html = HtmlService.createHtmlOutput(
      '<div style="font-family:system-ui,-apple-system,sans-serif;padding:14px 16px;font-size:14px;line-height:1.5">' +
      '<p style="margin:0 0 12px">Element review for<br><b>' +
      (address ? address.replace(/</g, '&lt;') : 'row ' + row) + '</b></p>' +
      '<p style="margin:0 0 16px"><a href="' + url + '" target="_blank" rel="noopener" ' +
      'style="display:inline-block;background:#ffd23f;color:#1b2027;font-weight:600;' +
      'text-decoration:none;padding:9px 16px;border-radius:8px">Open review page ↗</a></p>' +
      '<p style="margin:0;color:#667380;font-size:12px">Opens in a new tab. Tick "Elements Reviewed" ' +
      'once the pins look right, or write a "Nadir Fixes" note to rerun.</p></div>')
    .setWidth(340).setHeight(180);
  SpreadsheetApp.getUi().showModalDialog(html, 'Element Review');
}

// ============================================================
// SATELLITE PIPELINE — PASS 2: FR + WILDFIRE CONCERNS
// ============================================================
// One action per reviewed row makes TWO Bedrock calls — FR then WF — each
// grounded in the human-CONFIRMED element pins (Pass 1). Hard-gated on
// Elements Reviewed (J) = true. Each analysis writes independently:
//   FR: concern pins -> L, considerations -> M, recommendations -> N
//   WF: concern pins -> O, considerations -> P, recommendations -> Q
// A failed half leaves its columns empty; the batch selector re-picks any
// reviewed row that still has an empty concern column, so a partial row is
// retried for just the missing analysis. Reuses shared helpers from
// plane.gs (currentPinsAsText_, validateConcernPins_, guessImageMediaType_).
//
// ⭐ UNAFFECTED BY THE v5.27 TWENTY-ELEMENT RESTRICTION. Pass 2 draws on
// frConcernIds / wfConcernIds, which are computed independently of the emit
// list. Expect 44/40 FR and 25/27 WF (commercial/residential) — verify with
// clearSatPinCatalogCache().

// Parse a Pass 2 response: {nadir_pins:[...], considerations, recommendations}.
function parseSatPass2_(text) {
  if (!text) return null;
  let t = String(text).replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = t.indexOf('{'), end = t.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  t = t.substring(start, end + 1);
  let parsed;
  try { parsed = JSON.parse(t); } catch (e) {
    Logger.log('parseSatPass2_: JSON.parse failed — ' + e.message);
    return null;
  }
  if (!Array.isArray(parsed.nadir_pins)) { Logger.log('parseSatPass2_: nadir_pins missing/!array'); return null; }
  if (typeof parsed.considerations !== 'string' || !parsed.considerations.trim()) { Logger.log('parseSatPass2_: considerations missing'); return null; }
  if (typeof parsed.recommendations !== 'string' || !parsed.recommendations.trim()) { Logger.log('parseSatPass2_: recommendations missing'); return null; }
  return parsed;
}

// One analysis half (FR or WF). `spec` selects prompt, concern id set, KB
// query, and the three target columns. Writes on success; returns true/false.
function runSatPass2Half_(sheet, row, spec) {
  const address     = String(sheet.getRange(row, SAT_COL_ADDRESS).getValue() || '').trim();
  const accountType = normalizeAccountType(sheet.getRange(row, SAT_COL_ACCOUNT_TYPE).getValue());
  const nadirUrl    = String(sheet.getRange(row, SAT_COL_NADIR_URL).getValue() || '').trim();
  if (!nadirUrl) return false;

  const catalog = satFetchPinCatalog_(accountType);
  const vocab   = spec.key === 'fr' ? catalog.frConcernNames : catalog.wfConcernNames;
  const ids     = spec.key === 'fr' ? catalog.frConcernIds   : catalog.wfConcernIds;

  const prompt = spec.promptFn() +
    '\n\nAPPROVED CONCERN PIN VOCABULARY (use ONLY these ids):\n' + vocab;
  const kbContext  = queryKnowledgeBase(spec.kbQuery);
  const fullPrompt = kbContext ? prompt + '\n\nREFERENCE CONTEXT FROM KNOWLEDGE BASE:\n' + kbContext : prompt;

  const b64 = fetchImageAsBase64(nadirUrl);
  if (!b64) return false;

  const pinsRaw       = String(sheet.getRange(row, SAT_COL_ELEMENTS).getValue() || '').trim();
  const confirmedText = currentPinsAsText_(pinsRaw, catalog);

  const userContent = [
    { type: 'text',  text: 'IMAGE — NADIR (straight-down satellite view; yellow marker = target property centroid).' },
    { type: 'image', source: { type: 'base64', media_type: guessImageMediaType_(nadirUrl), data: b64 } },
    { type: 'text',  text:
        'Property address: ' + address + ' [' + accountType + '].\n\n' +
        'CONFIRMED PROPERTY ELEMENTS (human-approved ground truth), as "id = name at (x, y)" on the nadir:\n' +
        (confirmedText || '(no element pins were placed for this property)') +
        '\n\nUsing these confirmed elements and the nadir image, return ONLY the JSON object described in your instructions (concern pins in "nadir_pins", plus "considerations" and "recommendations").' }
  ];

  const result = callBedrock(fullPrompt, userContent, 4000);
  if (!result) return false;
  const parsed = parseSatPass2_(result);
  if (!parsed) { Logger.log(spec.key + ' Pass 2 raw (row ' + row + '): ' + result.substring(0, 500)); return false; }

  const concernPins = validateConcernPins_(parsed.nadir_pins, ids);
  writePlainCell(sheet, row, spec.colConcerns, concernPins.length ? JSON.stringify(concernPins) : '');
  writePlainCell(sheet, row, spec.colConsider, parsed.considerations.trim());
  writePlainCell(sheet, row, spec.colRec,      parsed.recommendations.trim());
  Logger.log('Sat Pass 2 ' + spec.key.toUpperCase() + ': row ' + row + ' — ' + concernPins.length + ' concerns [' + address + ']');
  return true;
}

const SAT_PASS2_FR = {
  key: 'fr', promptFn: satFrConcernsPrompt_,
  kbQuery: 'first responder property access egress visibility operational concerns hazards',
  colConcerns: SAT_COL_FR_CONCERNS, colConsider: SAT_COL_FR_CONSIDER, colRec: SAT_COL_FR_REC
};
const SAT_PASS2_WF = {
  key: 'wf', promptFn: satWfConcernsPrompt_,
  kbQuery: 'wildfire defensible space fuel continuity ember exposure structure hardening',
  colConcerns: SAT_COL_WF_CONCERNS, colConsider: SAT_COL_WF_CONSIDER, colRec: SAT_COL_WF_REC
};

// Full Pass 2 for one row: hard-gated on Elements Reviewed. Runs FR then WF,
// each writing independently. Returns { ran, fr, wf, gated } for reporting.
function runSatPass2Row_(sheet, row) {
  const reviewed = sheet.getRange(row, SAT_COL_REVIEWED).getValue() === true;
  if (!reviewed) return { ran: false, fr: false, wf: false, gated: true };
  let fr = false, wf = false;
  try { fr = runSatPass2Half_(sheet, row, SAT_PASS2_FR); }
  catch (e) { Logger.log('Sat Pass 2 FR ERROR row ' + row + ': ' + e.message); }
  Utilities.sleep(1500);
  try { wf = runSatPass2Half_(sheet, row, SAT_PASS2_WF); }
  catch (e) { Logger.log('Sat Pass 2 WF ERROR row ' + row + ': ' + e.message); }
  return { ran: true, fr: fr, wf: wf, gated: false };
}

// Pass 2 this-row (hard gate; no override).
function generateSatPass2ForActiveRow() {
  const ui = SpreadsheetApp.getUi();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SATELLITE_SHEET);
  if (!sheet) { ui.alert('Sheet "' + SATELLITE_SHEET + '" not found'); return; }
  const row = sheet.getActiveCell().getRow();
  if (row < 2) { ui.alert('Please select a data row.'); return; }
  const address = String(sheet.getRange(row, SAT_COL_ADDRESS).getValue() || '').trim();
  if (!address) { ui.alert('Row ' + row + ' has no Property Address.'); return; }

  if (sheet.getRange(row, SAT_COL_REVIEWED).getValue() !== true) {
    ui.alert('Pass 2 blocked — review required',
      'Row ' + row + ' has not been marked "Elements Reviewed".\n\n' +
      'Review the Pass 1 element pins (Open Element Review), correct them if needed ' +
      '(write a "Nadir Fixes" note and rerun), then tick "Elements Reviewed" before running Pass 2.',
      ui.ButtonSet.OK);
    return;
  }
  const r = runSatPass2Row_(sheet, row);
  ui.alert('Satellite Pass 2 — FR + Wildfire',
    'Property: ' + address + '\n\n' +
    'FR concerns/considerations/recommendations: ' + (r.fr ? 'written ✓' : 'FAILED ✗') + '\n' +
    'Wildfire concerns/considerations/recommendations: ' + (r.wf ? 'written ✓' : 'FAILED ✗') +
    (r.fr && r.wf ? '' : '\n\nA failed analysis left its columns empty — rerun Pass 2 to retry the missing half. See logs.'),
    ui.ButtonSet.OK);
}

// Pass 2 readiness for batch: Reviewed = true AND at least one concern
// column (L FR or O WF) still empty (so completed rows are skipped, and a
// partially-done row is retried).
function satRowReadyForPass2_(rowVals) {
  if (rowVals[SAT_COL_REVIEWED - 1] !== true) return false;
  const fr = String(rowVals[SAT_COL_FR_CONCERNS - 1] || '').trim();
  const wf = String(rowVals[SAT_COL_WF_CONCERNS - 1] || '').trim();
  return !fr || !wf;
}

// Pass 2 batch: all reviewed rows still needing FR or WF, up to BATCH_SIZE.
function generateSatPass2Batch() {
  const ui = SpreadsheetApp.getUi();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SATELLITE_SHEET);
  if (!sheet) { ui.alert('Sheet "' + SATELLITE_SHEET + '" not found'); return; }
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) { ui.alert('Satellite sheet is empty.'); return; }
  const width = Math.max(sheet.getLastColumn(), SAT_COL_UPLOAD_DATE);
  const data  = sheet.getRange(2, 1, lastRow - 1, width).getValues();

  const ready = [];
  data.forEach(function (r, i) { if (satRowReadyForPass2_(r)) ready.push(i + 2); });
  if (!ready.length) {
    ui.alert('Satellite Pass 2 — FR + Wildfire',
      'No reviewed rows are awaiting Pass 2.\n(A row runs when "Elements Reviewed" is ticked and its FR or Wildfire concerns are still empty.)',
      ui.ButtonSet.OK);
    return;
  }
  let frDone = 0, wfDone = 0, rows = 0, attempted = 0;
  for (let i = 0; i < ready.length; i++) {
    if (attempted >= BATCH_SIZE) break;
    attempted++; rows++;
    const r = runSatPass2Row_(sheet, ready[i]);
    if (r.fr) frDone++;
    if (r.wf) wfDone++;
    Utilities.sleep(2000);
  }
  const remaining = ready.length - attempted;
  ui.alert('Satellite Pass 2 — FR + Wildfire',
    'Rows processed: ' + rows + '\n' +
    'FR analyses written: ' + frDone + '\nWildfire analyses written: ' + wfDone +
    (remaining > 0 ? '\nRemaining: ' + remaining + ' — run again to continue.' : '\nAll ready rows processed.') +
    '\n\nAny failed half left its columns empty and will be retried on the next run.',
    ui.ButtonSet.OK);
}