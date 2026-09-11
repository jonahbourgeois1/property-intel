// ============================================================
// PROPERTY INTEL — Apps Script — FILE: nearmap.gs
// Nearmap trial pipeline. Sibling of Satellite, not a mode of it.
//
// CONTRACT (Segment 6 has no numbered contract; this is the Nearmap clause —
// docs/NEARMAP_CONTRACT.md):
//   Identity     Lookups key on Site No (column A), never address.
//                Published file = hashId(slug(site_no)). Never fall
//                through to the Satellite tab. Trial sync does NOT
//                upsert data/index/ (Jones hub is name-hashed; writing
//                hashId(site_no) would mint a second hub).
//   Nadir        CloudFront JPEG + explicit bounds (not Static Maps).
//                Pass 1 fetches vert-lot-p1.jpg when present, else vert-p1.jpg
//                (Bedrock 5 MB cap), never vert.jpg. Pin x,y stay percent of
//                the FULL vert.jpg (sheet bounds). AI features are filtered
//                to the taxlot before the prompt. Isolated from satellite.gs.
//   Pins         Pass 2 pin editor: one pin per regions.json feature, named
//                after the region class (not catalog ids). Uncapped. Packed
//                into column R so the 50k cell cap holds ~1.5k pins.
//                Pass 1 Bedrock still emits catalog ints (NM_MAX_PINS).
//   Pass 3       FR + wildfire concern pins (catalog role=concern ids) plus
//                considerations/recommendations. Gated on Elements Reviewed
//                and region-style pins in R. Two independent Bedrock halves.
//                Reuses validateConcernPins_ (plane.gs). Never flatten role=.
//   Catalog      pins-catalog.json. NM_PASS1_EMIT_IDS is a COPY of the
//                satellite standard/school lists, not an import from
//                satellite.gs. Fresh Pass 1 = emit list. Validator wins.
//   AI           Pass 1 pins copy centroids from ai/hints.json (lon/lat
//                → JPEG % via sheet bounds). Class names never enter
//                pins-catalog.json. Unmapped catalog ids are omitted.
//   Regions      original = S3/CloudFront ai/original/regions.json (immutable).
//                edits = S3/CloudFront ai/edits/regions.json, the working
//                FeatureCollection, written by nmSavePins_ with a SigV4 PUT
//                on reviewer Save. Never GitHub. Column W holds only a
//                summary. Revert regions = original.
//   Publish      data/nearmap/{id}.json only. Index views.nearmap is
//                promotion-time, onto the EXISTING hub, not this id.
//   Out of scope Mesh→GLB, VIEW_ORDER, satellite Pass 1/2.
//
// Menu: Set Up Nearmap Sheet, Import, Review/Pins/Viewer, Pass 3
// FR+WF concerns, Sync. First-round pins come from the reviewer.
// After paste: save AND create a new web-app deployment version.
// ============================================================

const NM_PASS1_EMIT_IDS_STANDARD = [
  61, 57, 19, 206, 186, 30, 217, 114, 105, 86, 240, 35, 26, 80, 33, 113, 135,
  52, 130, 150, 148, 141, 69
];
const NM_PASS1_EMIT_IDS_SCHOOL = [
  241, 242, 30, 36, 33, 252, 253, 254, 255, 256, 206, 243, 244, 246, 247, 251,
  249, 245, 127, 23, 248, 98, 250
];

// Pass 1 may emit a catalog id only when an AI feature of one of these
// classes exists. Location is that feature's centroid, never a visual guess.
// Ids in NM_PASS1_EMIT_IDS with no row here are dropped (validator wins).
const NM_AI_CLASS_MAP = [
  { id: 61, name: 'Roof', classes: ['Roof'] },
  { id: 57, name: 'Residence', classes: ['Building', 'Building (Deprecated)'] },
  { id: 19, name: 'Commercial Building', classes: ['Building', 'Building (Deprecated)'] },
  { id: 26, name: 'Detached structure', classes: ['Building', 'Building (Deprecated)'] },
  { id: 80, name: 'Warehouse', classes: ['Building', 'Building (Deprecated)'] },
  { id: 186, name: 'Driveway', classes: ['Driveway'] },
  { id: 69, name: 'Solar panels', classes: ['Solar Panel'] },
  { id: 130, name: 'Pool', classes: ['Swimming Pool'] },
  { id: 114, name: 'Lawn', classes: ['Lawn Grass'] },
  { id: 52, name: 'Patio', classes: ['Concrete Slab'] },
  { id: 113, name: 'Landscaping', classes: [
    'Low Vegetation (0.5m-2m)', 'Very Low Vegetation (<0.5m)', 'Natural (soft)'
  ] },
  { id: 135, name: 'Scattered Vegetation', classes: [
    'Low Vegetation (0.5m-2m)', 'Very Low Vegetation (<0.5m)', 'Natural (soft)'
  ] },
  { id: 150, name: 'Trees', classes: [
    'Woody Vegetation',
    'Medium and High Vegetation (>2m)',
    'Medium and High Vegetation with Woody Vegetation'
  ] },
  { id: 148, name: 'Tree cluster', classes: [
    'Woody Vegetation',
    'Medium and High Vegetation (>2m)',
    'Medium and High Vegetation with Woody Vegetation'
  ] }
];
const NM_AI_SNAP_MAX_PCT = 3;

function nmElementPinsPrompt_() {
  return `You are a First Responder Property Intelligence Analyst.
You will receive ONE aerial image: a NADIR (straight-down) Nearmap vertical JPEG of a property, AND a numbered list of VENDOR AI FEATURES. Each AI feature already has x,y as percent of THIS JPEG.

OBJECTIVE
Emit catalog element pins whose locations are copied from those AI features. This pass is ONLY about physical elements. Do NOT assess access difficulty, visibility, concerns, or hazards. Do NOT write any prose. Your entire output is the element pins.

LOCATION RULE — NO ASSUMPTIONS
Every pin location MUST be copied from one numbered AI feature. Do not estimate, interpolate, or "place near" a visual landmark. Do not move a pin to a door, curb cut, yard, or building edge unless that exact point is an AI feature centroid.
- Copy that feature's x and y exactly.
- Set "ai" to that feature's index.
- The JPEG is only for choosing WHICH numbered feature belongs to the TARGET property. It is not a source of coordinates.
- When a taxlot filter is applied, the numbered list is already restricted to that lot — do not pick neighbor features.
- x,y are percent of the FULL delivery Vert (sheet bounds), even if the JPEG you see is a lot crop. Copy them unchanged.
- If no AI feature of a mapped class sits on the target property, omit that catalog id.
- Do not emit a catalog id that has no class-mapping row and no matching AI feature. Front door, Vehicle Entrance, Fence, Sidewalk, Garage, Front yard, and Back yard have no Nearmap class — omit them.
- Never invent an id. Never use a Nearmap class name as an id. Never emit Building (Deprecated) as an id.

CLASS MAPPING
The caller appends the allowed Nearmap class names for each catalog id. Use only that table. One catalog id at most once. When several AI features share a class on the target property, pick one feature (largest / primary instance) and copy ITS coordinates — do not average them.

SELECTION
Select AT MOST ${NM_MAX_PINS} pins. There is no requirement to fill the cap. Fewer honest pins are better than a pin without an AI feature.

COORDINATES
(0,0) = top-left of the JPEG, (100,100) = bottom-right. Use the AI feature's x,y unchanged.

OUTPUT RULES
Return ONLY a single JSON object. No markdown, no code fences, no commentary.
{"nadir_pins": [{"id": 61, "x": 62.5, "y": 31.0, "ai": 3}]}
"nadir_pins" is an array of objects with integer "id", numeric "x" and "y" copied from the AI feature, and integer "ai" (that feature's index). Return an empty array if no mapped AI feature is on the target property.`;
}

function nmFrConcernsPrompt_() {
  return `You are a First Responder Property Intelligence Analyst producing the ACCESS & OPERATIONAL CONCERNS layer for a property.
You will receive a NADIR (straight-down) Nearmap vertical JPEG, zero or more COMPASS OBLIQUES (north / east / south / west — looking toward the property), a list of CONFIRMED PROPERTY ELEMENTS a human already verified, and a compact REGION CLASS INVENTORY (counts only — you do not receive polygons). Treat confirmed elements as established fact — do not re-identify elements or dispute them.

OBJECTIVE
From a first-responder perspective (fire, EMS, law enforcement reaching and operating on this property), identify ACCESS, EGRESS, VISIBILITY, and OPERATIONAL concerns, and mark each with a concern pin on the NADIR. Then write two short prose paragraphs: "considerations" and "recommendations". Use the obliques to confirm height, approach, and occlusion that the nadir cannot show. Use the region inventory only as context (how much lawn, vegetation, driveway, roof is present) — never invent a pin from a class count alone.

GROUNDING IN CONFIRMED ELEMENTS
Reason FROM the confirmed elements. Where a concern is driven by a specific confirmed element (e.g. a single narrow driveway implies slow apparatus egress; a pool implies a water-rescue target), place the concern pin on or beside that element's location. Some concerns are contextual or about the ABSENCE of a feature (open perimeter, blind approach, no turnaround, distant hydrant) — place those at the relevant location on the target property even if no single element drives them. Concerns are NOT limited to locations that have an element pin.

TARGET PROPERTY ONLY
Assess only this property's taxlot / Nearmap vertical. Do not pin neighboring parcels or streets beyond what directly affects access to the target.

CONFIDENCE STANDARD
Report only concerns supported by clear visual evidence and the confirmed elements — at least 95 percent confidence. Do not speculate about interior conditions, occupancy, ownership, code compliance, or hazards not visible. If uncertain, omit.

CONCERN PIN VOCABULARY
At the end of this prompt is a numbered list of approved CONCERN pin names. Use ONLY catalog integer ids from that list. Never invent an id, never reuse an id, never use a Nearmap region class name as an id. Select AT MOST ${PLANE_MAX_PINS} concern pins, prioritizing the most operationally significant.

COORDINATES
For every concern pin provide x,y percentage coordinates on the NADIR JPEG: (0,0) top-left, (100,100) bottom-right, (50,50) center. These percents are of the FULL delivery Vert (sheet bounds), even if the JPEG you see is a lot crop. Place each pin at the actual location of the concern. Do not clamp a guess into the frame — if you cannot place it honestly, omit it.

PROSE FIELDS
"considerations": 2–4 sentences summarizing the key access/egress/visibility/operational factors a responding crew should know for THIS property, grounded in the confirmed elements, the images, and the concern pins. Plain, factual, operational tone. No headers, no lists.
"recommendations": 2–4 sentences of concrete, actionable guidance for responders (e.g. staging, approach, apparatus placement, access workarounds). No headers, no lists.

OUTPUT RULES
Return ONLY a single JSON object. No markdown, no code fences, no commentary.
{"nadir_pins": [{"id": 190, "x": 40.0, "y": 55.5}], "considerations": "...", "recommendations": "..."}
"nadir_pins" may be an empty array if no approved concern applies. Both prose fields are required strings.`;
}

function nmWfConcernsPrompt_() {
  return `You are a Wildfire Property Intelligence Analyst producing the WILDFIRE CONCERNS layer for a property.
You will receive a NADIR (straight-down) Nearmap vertical JPEG, zero or more COMPASS OBLIQUES (north / east / south / west — looking toward the property), a list of CONFIRMED PROPERTY ELEMENTS a human already verified, and a compact REGION CLASS INVENTORY (counts only — you do not receive polygons). Treat confirmed elements as established fact — do not re-identify elements or dispute them.

OBJECTIVE
From a wildfire perspective (ignition exposure, fuel continuity, defensible space, ember and fire spread, and firefighting access under fire conditions), identify WILDFIRE concerns and mark each with a concern pin on the NADIR. Then write two short prose paragraphs: "considerations" and "recommendations". Use the obliques to confirm vegetation height, roof/ember exposure, and clearance that the nadir cannot show. Use the region inventory only as context — never invent a pin from a class count alone.

GROUNDING IN CONFIRMED ELEMENTS
Reason FROM the confirmed elements. Where a concern is driven by a confirmed element (e.g. vegetation touching a structure, a woodpile against a wall, dense tree cover over the roofline), place the concern pin on or beside that element's location. Many wildfire concerns are about fuel continuity, defensible-space gaps, or the ABSENCE of clearance — place those at the relevant location on the target property even if no single element drives them. Concerns are NOT limited to locations that have an element pin.

TARGET PROPERTY ONLY
Assess only this property's taxlot / Nearmap vertical. Do not pin neighboring parcels beyond fuel/exposure that directly threatens the target.

CONFIDENCE STANDARD
Report only concerns supported by clear visual evidence and the confirmed elements — at least 95 percent confidence. Vegetation density and clearance may be obscured by shadow or resolution; only assess what is clearly visible. Do not speculate. If uncertain, omit.

CONCERN PIN VOCABULARY
At the end of this prompt is a numbered list of approved WILDFIRE CONCERN pin names. Use ONLY catalog integer ids from that list. Never invent an id, never reuse an id, never use a Nearmap region class name as an id. Select AT MOST ${PLANE_MAX_PINS} concern pins, prioritizing the most significant wildfire risks.

COORDINATES
For every concern pin provide x,y percentage coordinates on the NADIR JPEG: (0,0) top-left, (100,100) bottom-right, (50,50) center. These percents are of the FULL delivery Vert (sheet bounds), even if the JPEG you see is a lot crop. Place each pin at the actual location of the concern. Do not clamp a guess into the frame — if you cannot place it honestly, omit it.

PROSE FIELDS
"considerations": 2–4 sentences summarizing the key wildfire exposure and defensible-space factors for THIS property, grounded in the confirmed elements, the images, and the concern pins. Plain, factual tone. No headers, no lists.
"recommendations": 2–4 sentences of concrete, actionable wildfire-mitigation guidance (e.g. clearance, fuel removal, structure hardening priorities, access under fire conditions). No headers, no lists.

OUTPUT RULES
Return ONLY a single JSON object. No markdown, no code fences, no commentary.
{"nadir_pins": [{"id": 205, "x": 40.0, "y": 55.5}], "considerations": "...", "recommendations": "..."}
"nadir_pins" may be an empty array if no approved concern applies. Both prose fields are required strings.`;
}

const NM_PASS3_IMAGE_BUDGET = 3500000;

// Trial: never mint a hub. Flip only when Jonah names the existing hub
// (Jones = 6de88883bfd4a8349a901c54611ed9d7) and promotion is explicit.
const NM_UPSERT_INDEX = false;

// ── Regions: original / edits folder format (S3 only — no GitHub) ───────────
// original = s3://property-intel-tiles/nearmap/{delivery}/ai/original/regions.json
//            (vendor, immutable; promote.py writes it; nobody else does).
// edits    = s3://property-intel-tiles/nearmap/{delivery}/ai/edits/regions.json
//            the full working FeatureCollection, written by nmSavePins_ on
//            reviewer Save with a SigV4 PUT (same AWS key that calls Bedrock).
//            promote.py seeds it from original. Revert regions = original; the
//            next Save writes original back into edits.
// Both are read by the reviewer through CloudFront. Nearmap regions never touch
// GitHub: client data stays off the public repo.
// Column W (Drawn Features) holds a small JSON summary of the last edits save,
// never the regions themselves (a cell is capped at 50 000 characters).
const NM_S3_BUCKET = 'property-intel-tiles';
const NM_S3_HOST = NM_S3_BUCKET + '.s3.us-east-1.amazonaws.com';
const NM_S3_PREFIX = 'nearmap/';
const NM_EDITS_MAX_BYTES = 20 * 1024 * 1024;

function nmRegionsOriginalUrl_(aiUrl) {
  const s = String(aiUrl || '').trim();
  if (!s) return '';
  if (/\/ai\/original\/regions\.json(\?|$)/i.test(s)) return s;
  return s.replace(/\/ai\/features\.json(\?|$)/i, '/ai/original/regions.json$1');
}

function nmRegionsEditsUrl_(aiUrl) {
  const s = String(aiUrl || '').trim();
  if (!s) return '';
  if (/\/ai\/edits\/regions\.json(\?|$)/i.test(s)) return s;
  return s.replace(/\/ai\/features\.json(\?|$)/i, '/ai/edits/regions.json$1');
}

function nmEditsS3Key_(deliveryId) {
  const d = String(deliveryId || '').trim();
  if (!/^[a-z0-9][a-z0-9-]*$/.test(d)) throw new Error('bad delivery_id for S3 key: ' + d);
  return NM_S3_PREFIX + d + '/ai/edits/regions.json';
}

// SigV4 PUT of one object to property-intel-tiles. Signs content-type, host,
// x-amz-content-sha256 and x-amz-date (S3 requires the content hash header).
// Cache-Control: no-cache so CloudFront revalidates and a fresh Save shows up
// without an invalidation. Throws with the HTTP status + S3 message on failure.
function nmS3PutObject_(key, body, contentType) {
  const creds = getCredentials();
  if (!creds.awsKeyId || !creds.awsSecret) throw new Error('AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY not set in Script Properties');
  const region = 'us-east-1';
  const service = 's3';
  const host = NM_S3_HOST;
  const path = '/' + key.split('/').map(encodeURIComponent).join('/');
  const now = new Date();
  const dateStamp = Utilities.formatDate(now, 'UTC', 'yyyyMMdd');
  const amzDate = dateStamp + 'T' + Utilities.formatDate(now, 'UTC', 'HHmmss') + 'Z';
  const payloadHash = sha256Hex(body);
  const ctype = contentType || 'application/json';
  const canonicalHeaders =
    'cache-control:no-cache\n' +
    'content-type:' + ctype + '\n' +
    'host:' + host + '\n' +
    'x-amz-content-sha256:' + payloadHash + '\n' +
    'x-amz-date:' + amzDate + '\n';
  const signedHeaders = 'cache-control;content-type;host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = ['PUT', path, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const credentialScope = dateStamp + '/' + region + '/' + service + '/aws4_request';
  const stringToSign = 'AWS4-HMAC-SHA256\n' + amzDate + '\n' + credentialScope + '\n' + sha256Hex(canonicalRequest);
  const kDate = hmacSha256Bytes(dateStamp, Utilities.newBlob('AWS4' + creds.awsSecret).getBytes());
  const kRegion = hmacSha256Bytes(region, kDate);
  const kService = hmacSha256Bytes(service, kRegion);
  const kSigning = hmacSha256Bytes('aws4_request', kService);
  const sig = hmacSha256Bytes(stringToSign, kSigning).map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
  const headers = {
    'Cache-Control': 'no-cache',
    'X-Amz-Content-Sha256': payloadHash,
    'X-Amz-Date': amzDate,
    'Authorization': 'AWS4-HMAC-SHA256 Credential=' + creds.awsKeyId + '/' + credentialScope +
      ', SignedHeaders=' + signedHeaders + ', Signature=' + sig
  };
  const res = UrlFetchApp.fetch('https://' + host + path, {
    method: 'put', headers, contentType: ctype, payload: body, muteHttpExceptions: true
  });
  const code = res.getResponseCode();
  if (code !== 200) {
    const txt = res.getContentText();
    const m = txt.match(/<Code>([^<]+)<\/Code>[\s\S]*?<Message>([^<]+)<\/Message>/);
    throw new Error('S3 PUT ' + key + ' → HTTP ' + code + (m ? (': ' + m[1] + ' — ' + m[2]) : (': ' + txt.substring(0, 200))));
  }
  return { key: key, etag: res.getHeaders()['ETag'] || res.getHeaders()['Etag'] || '' };
}

// Run from the editor: can this project's AWS key write the Nearmap edits prefix?
// Writes a tiny probe object under nearmap/_probe/ and reports the result.
function checkS3EditsWrite() {
  let text;
  try {
    const r = nmS3PutObject_(NM_S3_PREFIX + '_probe/apps-script-write-check.json',
      JSON.stringify({ ok: true, at: new Date().toISOString() }), 'application/json');
    text = 'S3 PUT ok: s3://' + NM_S3_BUCKET + '/' + r.key + ' etag ' + r.etag;
  } catch (e) {
    text = 'S3 PUT failed: ' + e.message;
  }
  Logger.log(text);
  try { SpreadsheetApp.getUi().alert('S3 write check', text, SpreadsheetApp.getUi().ButtonSet.OK); } catch (e) {}
  return text;
}

// Column W: { drawn: FeatureCollection, edits: {url, changed, removed, saved} }.
// Older rows hold a bare FeatureCollection; both shapes parse.
function nmParseW_(raw) {
  const out = { drawn: { type: 'FeatureCollection', features: [] }, edits: null };
  if (!raw) return out;
  let o = raw;
  if (typeof raw !== 'object') {
    try { o = JSON.parse(String(raw)); } catch (e) { return out; }
  }
  if (!o || typeof o !== 'object') return out;
  if (Array.isArray(o.features)) { out.drawn = o; return out; }
  if (o.drawn && Array.isArray(o.drawn.features)) out.drawn = o.drawn;
  if (o.edits && typeof o.edits === 'object') out.edits = o.edits;
  return out;
}

// Run from the editor: does GITHUB_TOKEN in Script Properties still work? Used
// by the row sync (data/nearmap/{id}.json), not by regions. Reports the HTTP
// status of GET /user and GET /repos/{repo} and the token's length/prefix
// (never the token). 200/200 = fine; 401 = expired or revoked.
function checkGitHubToken() {
  const creds = getCredentials();
  const tok = creds.githubToken || '';
  const headers = { 'Authorization': 'token ' + tok, 'Accept': 'application/vnd.github.v3+json' };
  const lines = ['GITHUB_TOKEN: ' + (tok ? (tok.length + ' chars, starts "' + tok.substring(0, 4) + '…"') : 'NOT SET')];
  [['GET /user', 'https://api.github.com/user'],
   ['GET /repos/' + GITHUB_REPO, 'https://api.github.com/repos/' + GITHUB_REPO]
  ].forEach(function (pair) {
    try {
      const r = UrlFetchApp.fetch(pair[1], { method: 'GET', headers, muteHttpExceptions: true });
      let note = '';
      try { const j = JSON.parse(r.getContentText()); note = j.login ? (' (' + j.login + ')') : (j.message ? (' — ' + j.message) : ''); } catch (e) {}
      lines.push(pair[0] + ' → HTTP ' + r.getResponseCode() + note);
    } catch (e) {
      lines.push(pair[0] + ' → fetch error: ' + e.message);
    }
  });
  const text = lines.join('\n');
  Logger.log(text);
  try { SpreadsheetApp.getUi().alert('GitHub token check', text, SpreadsheetApp.getUi().ButtonSet.OK); } catch (e) {}
  return text;
}

function nmWriteW_(sheet, row, drawn, edits) {
  writePlainCell(sheet, row, NM_COL_DRAWN, JSON.stringify({
    drawn: drawn || { type: 'FeatureCollection', features: [] },
    edits: edits || null
  }));
}

function nmValidSiteNo_(raw) {
  return String(raw || '').trim();
}

function nmPropertyId_(siteNo, salt) {
  const s = nmValidSiteNo_(siteNo);
  if (!s) return null;
  return hashId(slugify(s), salt);
}

function nmSheet_(ss) {
  const book = ss || SpreadsheetApp.getActiveSpreadsheet();
  const sheet = book.getSheetByName(NEARMAP_SHEET);
  if (!sheet) throw new Error('Sheet "' + NEARMAP_SHEET + '" not found — run Set Up Nearmap Sheet first.');
  return sheet;
}

function nmActiveRow_() {
  const ui = SpreadsheetApp.getUi();
  const active = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const name = String(active.getName() || '').trim();
  if (name.toLowerCase() !== String(NEARMAP_SHEET).toLowerCase()) {
    ui.alert('Wrong sheet',
      'This action works on the "' + NEARMAP_SHEET + '" tab, but the active tab is "' + name + '".',
      ui.ButtonSet.OK);
    return null;
  }
  const row = active.getActiveCell().getRow();
  if (row < 2) {
    ui.alert('Select a data row', 'Row 1 is the header.', ui.ButtonSet.OK);
    return null;
  }
  return row;
}

function nmRowHasData_(siteNo, address, deliveryId) {
  return !!(String(siteNo || '').trim() || String(address || '').trim() ||
    String(deliveryId || '').trim());
}

// Checkboxes count as content for getLastRow / appendRow. Never pre-fill a
// 50-row runway (that parked Macalpine on row 53). Boxes only on real rows.
function nmEnsureReviewedCheckboxes_(sheet) {
  const last = sheet.getLastRow();
  if (last < 2) return;
  const n = last - 1;
  const sites = sheet.getRange(2, NM_COL_SITE_NO, n, 1).getValues();
  const addrs = sheet.getRange(2, NM_COL_ADDRESS, n, 1).getValues();
  const dels = sheet.getRange(2, NM_COL_DELIVERY, n, 1).getValues();
  let dataLast = 0;
  for (let i = 0; i < n; i++) {
    if (nmRowHasData_(sites[i][0], addrs[i][0], dels[i][0])) dataLast = i + 1;
  }
  if (!dataLast) return;
  sheet.getRange(2, NM_COL_REVIEWED, dataLast, 1).insertCheckboxes();
}

function nmFirstEmptyDataRow_(sheet) {
  const last = Math.max(sheet.getLastRow(), 2);
  const n = last - 1;
  const sites = sheet.getRange(2, NM_COL_SITE_NO, n, 1).getValues();
  const addrs = sheet.getRange(2, NM_COL_ADDRESS, n, 1).getValues();
  const dels = sheet.getRange(2, NM_COL_DELIVERY, n, 1).getValues();
  for (let i = 0; i < n; i++) {
    if (!nmRowHasData_(sites[i][0], addrs[i][0], dels[i][0])) return i + 2;
  }
  return last + 1;
}

// Collapse checkbox-only gaps so a real row is not stuck at row 53.
function nmPackDataRows_(sheet) {
  const last = sheet.getLastRow();
  if (last < 2) return 0;
  const width = NM_HEADERS.length;
  const data = sheet.getRange(2, 1, last - 1, width).getValues();
  const kept = [];
  for (let i = 0; i < data.length; i++) {
    if (nmRowHasData_(data[i][NM_COL_SITE_NO - 1], data[i][NM_COL_ADDRESS - 1],
        data[i][NM_COL_DELIVERY - 1])) {
      kept.push(data[i]);
    }
  }
  const packedAtTop = kept.length > 0 &&
    !data.slice(0, kept.length).some(function (r) {
      return !nmRowHasData_(r[NM_COL_SITE_NO - 1], r[NM_COL_ADDRESS - 1], r[NM_COL_DELIVERY - 1]);
    });
  if (packedAtTop && kept.length === data.length) return kept.length;
  sheet.getRange(2, 1, last - 1, width).clearContent();
  sheet.getRange(2, NM_COL_REVIEWED, last - 1, 1).clearDataValidations();
  if (kept.length) {
    sheet.getRange(2, 1, kept.length, width).setValues(kept);
  }
  return kept.length;
}

function nmProtectedSheetNames_() {
  return [
    SATELLITE_SHEET, SATELLITE_SANDBOX_SHEET, CRITIQUE_SANDBOX_SHEET,
    PLANE_SHEET, DRONE_SHEET, INTERIOR_SHEET, INTEL_LINKS_SHEET,
    GOLF_SHEET, GOLF_PINS_SHEET, 'element-critique'
  ];
}

function setupNearmapSheet() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const previous = ss.getActiveSheet();
  if (nmProtectedSheetNames_().indexOf(NEARMAP_SHEET) !== -1) {
    ui.alert('Nearmap',
      'NEARMAP_SHEET is set to "' + NEARMAP_SHEET + '", which is a production tab. Refusing — current processes stay untouched.',
      ui.ButtonSet.OK);
    return;
  }
  let sheet = ss.getSheetByName(NEARMAP_SHEET);
  const created = !sheet;
  if (!sheet) sheet = ss.insertSheet(NEARMAP_SHEET, ss.getNumSheets());
  if (sheet.getName() !== NEARMAP_SHEET) {
    ui.alert('Nearmap', 'Refusing to write a sheet that is not named "' + NEARMAP_SHEET + '".', ui.ButtonSet.OK);
    return;
  }
  if (sheet.getMaxColumns() < NM_HEADERS.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), NM_HEADERS.length - sheet.getMaxColumns());
  }
  sheet.getRange(1, 1, 1, NM_HEADERS.length).setValues([NM_HEADERS]).setFontWeight('bold');
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(4);
  nmEnsureReviewedCheckboxes_(sheet);
  if (previous && previous.getSheetId() !== sheet.getSheetId()) {
    try { ss.setActiveSheet(previous); } catch (e) {}
  }
  ui.alert('Nearmap',
    (created ? 'Created' : 'Updated') + ' the "' + NEARMAP_SHEET + '" tab (' +
    NM_HEADERS.length + ' columns). Satellite, Plane, Drone, and Golf were not modified.\n\n' +
    'Import from CloudFront registry, then fill Site No by hand. Do not guess Jones site numbers.\n' +
    'Pass 3 columns are X–AC (FR/WF concerns). Tick Elements Reviewed after pin QA, then Generate Pass 3.',
    ui.ButtonSet.OK);
}

function nmFindRowByDelivery_(sheet, deliveryId) {
  const last = sheet.getLastRow();
  if (last < 2) return 0;
  const vals = sheet.getRange(2, NM_COL_DELIVERY, last - 1, 1).getValues();
  const want = String(deliveryId || '').trim().toLowerCase();
  for (let i = 0; i < vals.length; i++) {
    if (String(vals[i][0] || '').trim().toLowerCase() === want) return i + 2;
  }
  return 0;
}

function nmFindRowByAddress_(sheet, address) {
  const last = sheet.getLastRow();
  if (last < 2) return 0;
  const want = String(address || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
  if (!want) return 0;
  const vals = sheet.getRange(2, NM_COL_ADDRESS, last - 1, 1).getValues();
  const hits = [];
  for (let i = 0; i < vals.length; i++) {
    const have = String(vals[i][0] || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
    if (have && have === want) hits.push(i + 2);
  }
  return hits.length === 1 ? hits[0] : 0;
}

function importNearmapRegistry() {
  const ui = SpreadsheetApp.getUi();
  const sheet = nmSheet_();
  const res = UrlFetchApp.fetch(NM_REGISTRY_URL, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) {
    ui.alert('Nearmap import', 'Registry fetch failed HTTP ' + res.getResponseCode() + '\n' + NM_REGISTRY_URL, ui.ButtonSet.OK);
    return;
  }
  let body;
  try { body = JSON.parse(res.getContentText()); }
  catch (e) {
    ui.alert('Nearmap import', 'Registry JSON parse failed: ' + e.message, ui.ButtonSet.OK);
    return;
  }
  const deliveries = body.deliveries || [];
  if (!deliveries.length) {
    ui.alert('Nearmap import', 'Registry has no deliveries.', ui.ButtonSet.OK);
    return;
  }
  let updated = 0, appended = 0;
  const width = NM_HEADERS.length;
  deliveries.forEach(function (d) {
    const did = String(d.delivery_id || '').trim();
    if (!did) return;
    let row = nmFindRowByDelivery_(sheet, did);
    if (!row) row = nmFindRowByAddress_(sheet, d.address);
    const urls = d.urls || {};
    const bounds = d.bounds || {};
    if (!row) {
      row = nmFirstEmptyDataRow_(sheet);
      const rec = new Array(width).fill('');
      rec[NM_COL_ADDRESS - 1] = d.address || '';
      rec[NM_COL_DELIVERY - 1] = did;
      rec[NM_COL_SURVEY_DATE - 1] = d.survey_date || '';
      rec[NM_COL_NADIR_URL - 1] = urls.vert || '';
      rec[NM_COL_NADIR_BOUNDS - 1] = bounds.north ? JSON.stringify(bounds) : '';
      rec[NM_COL_NORTH_URL - 1] = urls.north || '';
      rec[NM_COL_EAST_URL - 1] = urls.east || '';
      rec[NM_COL_SOUTH_URL - 1] = urls.south || '';
      rec[NM_COL_WEST_URL - 1] = urls.west || '';
      rec[NM_COL_AI_URL - 1] = urls.ai || '';
      rec[NM_COL_MANIFEST_URL - 1] = urls.manifest || '';
      rec[NM_COL_STATUS - 1] = 'imported';
      rec[NM_COL_REVIEWED - 1] = false;
      sheet.getRange(row, 1, 1, width).setValues([rec]);
      appended++;
    } else {
      writePlainCell(sheet, row, NM_COL_DELIVERY, did);
      if (d.survey_date) writePlainCell(sheet, row, NM_COL_SURVEY_DATE, d.survey_date);
      if (urls.vert) writePlainCell(sheet, row, NM_COL_NADIR_URL, urls.vert);
      if (bounds.north) writePlainCell(sheet, row, NM_COL_NADIR_BOUNDS, JSON.stringify(bounds));
      if (urls.north) writePlainCell(sheet, row, NM_COL_NORTH_URL, urls.north);
      if (urls.east) writePlainCell(sheet, row, NM_COL_EAST_URL, urls.east);
      if (urls.south) writePlainCell(sheet, row, NM_COL_SOUTH_URL, urls.south);
      if (urls.west) writePlainCell(sheet, row, NM_COL_WEST_URL, urls.west);
      if (urls.ai) writePlainCell(sheet, row, NM_COL_AI_URL, urls.ai);
      if (urls.manifest) writePlainCell(sheet, row, NM_COL_MANIFEST_URL, urls.manifest);
      writePlainCell(sheet, row, NM_COL_STATUS, 'imported');
      updated++;
    }
  });
  const packed = nmPackDataRows_(sheet);
  nmEnsureReviewedCheckboxes_(sheet);
  ui.alert('Nearmap import',
    'Updated ' + updated + ', appended ' + appended +
    (packed ? ('. Data rows now start at row 2 (' + packed + ' packed).') : '.') +
    '\nFill Site No before Pass 1 sync. Do not guess among duplicate Jones site numbers.',
    ui.ButtonSet.OK);
}

function nmParseBounds_(raw) {
  if (!raw) return null;
  if (typeof raw === 'object' && raw.north != null) return raw;
  try {
    const o = JSON.parse(String(raw));
    if (o && o.north != null && o.south != null && o.east != null && o.west != null) return o;
  } catch (e) {}
  return null;
}

function nmPass1Kind_(rawAccountType) {
  return (typeof isSchoolAccountType_ === 'function' && isSchoolAccountType_(rawAccountType))
    ? 'school' : 'standard';
}

function nmPass1EmitIds_(rawAccountType) {
  return nmPass1Kind_(rawAccountType) === 'school'
    ? NM_PASS1_EMIT_IDS_SCHOOL
    : NM_PASS1_EMIT_IDS_STANDARD;
}

function nmFetchPinCatalog_(accountTypeRaw) {
  const kind = nmPass1Kind_(accountTypeRaw);
  const type = normalizeAccountType(accountTypeRaw);
  const cacheKey = 'nmPinCatalogV2:' + kind + ':' + type;
  const cache = CacheService.getScriptCache();
  const cached = cache.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const res = UrlFetchApp.fetch(PIN_CATALOG_URL, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) {
    throw new Error('Pin catalog fetch failed (HTTP ' + res.getResponseCode() + ')');
  }
  const cat = JSON.parse(res.getContentText());
  const all = cat.pins || [];
  const emitWant = {};
  nmPass1EmitIds_(accountTypeRaw).forEach(function (id) { emitWant[id] = true; });
  const emitPins = all.filter(function (p) { return emitWant[p.id]; });
  const numbered = function (arr) {
    return arr.map(function (p) { return p.id + '. ' + p.name; }).join('\n');
  };
  const idSet = function (arr) {
    const o = {};
    arr.forEach(function (p) { o[p.id] = true; });
    return o;
  };
  const hasAnalysis = function (p, a) {
    return Array.isArray(p.analysis) && p.analysis.indexOf(a) !== -1;
  };
  // Identical to satFetchPinCatalog_ concern filter. School uses commercial
  // (`type`) so FR/WF vocabularies stay populated. Do not flatten role=.
  const forType = all.filter(function (p) {
    return Array.isArray(p.account_type) && p.account_type.indexOf(type) !== -1;
  });
  const frConcern = forType.filter(function (p) {
    return p.role === 'concern' && hasAnalysis(p, 'fr');
  });
  const wfConcern = forType.filter(function (p) {
    return p.role === 'concern' && hasAnalysis(p, 'wf');
  });
  if (!frConcern.length || !wfConcern.length) {
    Logger.log('nmFetchPinCatalog_ WARNING [' + type + '/' + kind + ']: concern vocabulary is EMPTY (fr=' +
      frConcern.length + ', wf=' + wfConcern.length +
      '). Pass 3 will drop every concern pin. Has role= been flattened in pins-catalog.json?');
  }
  const out = {
    emitNames: numbered(emitPins),
    emitIds: idSet(emitPins),
    elementNames: numbered(all),
    elementIds: idSet(all),
    frConcernNames: numbered(frConcern),
    frConcernIds: idSet(frConcern),
    wfConcernNames: numbered(wfConcern),
    wfConcernIds: idSet(wfConcern)
  };
  try { cache.put(cacheKey, JSON.stringify(out), 21600); } catch (e) {}
  return out;
}

function nmValidateElementPins_(pins, elementIds) {
  if (!Array.isArray(pins)) return [];
  const out = [];
  const seen = {};
  for (let i = 0; i < pins.length && out.length < NM_MAX_PINS; i++) {
    const p = pins[i] || {};
    const x = parseFloat(p.x), y = parseFloat(p.y);
    if (isNaN(x) || isNaN(y)) continue;
    const id = parseInt(p.id, 10);
    if (isNaN(id) || !elementIds[id]) continue;
    if (Math.abs(x) > 500 || Math.abs(y) > 500) continue;
    const key = id + ':' + x + ':' + y;
    if (seen[key]) continue;
    seen[key] = true;
    const row = { id: id, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
    if (p.source) row.source = String(p.source);
    if (p.ai_class) row.ai_class = String(p.ai_class);
    if (p.drawn_id) row.drawn_id = String(p.drawn_id);
    if (p.region_id) row.region_id = String(p.region_id);
    if (Array.isArray(p.merged_from)) row.merged_from = p.merged_from.map(String);
    out.push(row);
  }
  return out;
}

function nmAiClassesForId_(id) {
  for (let i = 0; i < NM_AI_CLASS_MAP.length; i++) {
    if (NM_AI_CLASS_MAP[i].id === id) return NM_AI_CLASS_MAP[i].classes;
  }
  return null;
}

function nmAiClassAllowed_(id, className) {
  const classes = nmAiClassesForId_(id);
  if (!classes || !className) return false;
  return classes.indexOf(className) !== -1;
}

function nmLonLatToPct_(lon, lat, bounds) {
  if (!bounds) return null;
  const west = Number(bounds.west), east = Number(bounds.east);
  const north = Number(bounds.north), south = Number(bounds.south);
  if (!isFinite(west) || !isFinite(east) || !isFinite(north) || !isFinite(south)) return null;
  if (east === west || north === south) return null;
  const x = (Number(lon) - west) / (east - west) * 100;
  const y = (north - Number(lat)) / (north - south) * 100;
  if (!isFinite(x) || !isFinite(y)) return null;
  return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
}

function nmMappableAiClassSet_() {
  const o = {};
  NM_AI_CLASS_MAP.forEach(function (row) {
    row.classes.forEach(function (c) { o[c] = true; });
  });
  return o;
}

function nmPrepareAiFeatures_(body, bounds) {
  const mappable = nmMappableAiClassSet_();
  const raw = (body && (body.hints || body.features)) || [];
  const out = [];
  for (let i = 0; i < raw.length; i++) {
    const h = raw[i] || {};
    const cls = String(h.class || (h.properties && h.properties.class) || '').trim();
    if (!cls || !mappable[cls]) continue;
    let xy = null;
    if (h.x != null && h.y != null) {
      const x = parseFloat(h.x), y = parseFloat(h.y);
      if (isFinite(x) && isFinite(y)) xy = { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
    }
    if (!xy) xy = nmLonLatToPct_(h.lon, h.lat, bounds);
    if (!xy) continue;
    out.push({
      i: out.length,
      class: cls,
      x: xy.x,
      y: xy.y,
      lon: h.lon,
      lat: h.lat,
      confidence: h.confidence,
      area_sqm: h.area_sqm
    });
  }
  return out;
}

function nmFormatClassMapForPrompt_() {
  return NM_AI_CLASS_MAP.map(function (row) {
    return '#' + row.id + ' ' + row.name + ' ← ' + row.classes.join(' | ');
  }).join('\n');
}

function nmFormatAiFeaturesForPrompt_(features) {
  return features.map(function (f) {
    let line = '[' + f.i + '] class="' + f.class + '" x=' + f.x + ' y=' + f.y;
    if (f.confidence != null) line += ' conf=' + f.confidence;
    if (f.area_sqm != null) line += ' area_sqm=' + f.area_sqm;
    return line;
  }).join('\n');
}

function nmDistPct_(x1, y1, x2, y2) {
  const dx = x1 - x2, dy = y1 - y2;
  return Math.sqrt(dx * dx + dy * dy);
}

function nmValidatePass1Pins_(pins, elementIds, aiFeatures) {
  const basic = nmValidateElementPins_(pins, elementIds);
  if (!aiFeatures || !aiFeatures.length) return [];
  const byIndex = {};
  aiFeatures.forEach(function (f) { byIndex[f.i] = f; });
  const out = [];
  const seen = {};
  for (let n = 0; n < basic.length; n++) {
    const p = basic[n];
    if (seen[p.id]) continue;
    if (!nmAiClassesForId_(p.id)) continue;
    const raw = pins.filter(function (q) { return parseInt(q.id, 10) === p.id; })[0] || {};
    let feat = null;
    const aiIdx = parseInt(raw.ai, 10);
    if (!isNaN(aiIdx) && byIndex[aiIdx] && nmAiClassAllowed_(p.id, byIndex[aiIdx].class)) {
      feat = byIndex[aiIdx];
    } else {
      let best = null, bestD = NM_AI_SNAP_MAX_PCT + 1;
      for (let i = 0; i < aiFeatures.length; i++) {
        const f = aiFeatures[i];
        if (!nmAiClassAllowed_(p.id, f.class)) continue;
        const d = nmDistPct_(p.x, p.y, f.x, f.y);
        if (d < bestD) { bestD = d; best = f; }
      }
      if (best && bestD <= NM_AI_SNAP_MAX_PCT) feat = best;
    }
    if (!feat) continue;
    seen[p.id] = true;
    out.push({ id: p.id, x: feat.x, y: feat.y });
    if (out.length >= NM_MAX_PINS) break;
  }
  return out;
}

function nmFetchAiFeatures_(aiUrl, bounds) {
  if (!aiUrl) return [];
  const hintsUrl = String(aiUrl).replace(/\/ai\/features\.json(\?|$)/i, '/ai/hints.json$1');
  const tryUrls = hintsUrl === aiUrl ? [aiUrl] : [hintsUrl, aiUrl];
  for (let i = 0; i < tryUrls.length; i++) {
    const res = UrlFetchApp.fetch(tryUrls[i], { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) continue;
    let body;
    try { body = JSON.parse(res.getContentText()); }
    catch (e) { continue; }
    const prepared = nmPrepareAiFeatures_(body, bounds);
    if (prepared.length) return prepared;
  }
  return [];
}

function nmBedrockNadirUrl_(nadirUrl) {
  const s = String(nadirUrl || '');
  if (/\/vert\.jpg(\?|$)/i.test(s)) return s.replace(/\/vert\.jpg/i, '/vert-p1.jpg');
  return s;
}

function nmLotP1Url_(nadirUrl) {
  const s = String(nadirUrl || '');
  if (/\/vert\.jpg(\?|$)/i.test(s)) return s.replace(/\/vert\.jpg/i, '/vert-lot-p1.jpg');
  if (/\/vert-p1\.jpg(\?|$)/i.test(s)) return s.replace(/\/vert-p1\.jpg/i, '/vert-lot-p1.jpg');
  return '';
}

function nmFetchNadirForBedrock_(nadirUrl) {
  const lotP1 = nmLotP1Url_(nadirUrl);
  if (lotP1) {
    const lotB64 = fetchImageAsBase64(lotP1);
    if (lotB64) return { b64: lotB64, url: lotP1 };
  }
  const p1 = nmBedrockNadirUrl_(nadirUrl);
  let b64 = fetchImageAsBase64(p1);
  if (b64) return { b64: b64, url: p1 };
  if (p1 !== nadirUrl) {
    b64 = fetchImageAsBase64(nadirUrl);
    if (b64) return { b64: b64, url: nadirUrl };
  }
  return { b64: null, url: p1 };
}

const NM_PARCEL_PAGES = 'https://responder-intel.vyanet.com/data/parcels/';
const NM_PARCEL_COUNTIES = [
  { name: 'deschutes', lat0: 43.61, lng0: -122.01, step: 0.07 },
  { name: 'lane', lat0: 43.40, lng0: -124.20, step: 0.07 }
];

function nmParcelFileFor_(lat, lng, county) {
  const latCell = Math.floor((lat - county.lat0) / county.step) * county.step + county.lat0;
  const lngCell = Math.floor((lng - county.lng0) / county.step) * county.step + county.lng0;
  return county.name + '_' + latCell.toFixed(2) + '_' + lngCell.toFixed(2) + '.geojson';
}

function nmPointInRing_(lat, lng, ring) {
  let inside = false;
  if (!ring || ring.length < 4) return false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if (((yi > lat) !== (yj > lat)) &&
        (lng < (xj - xi) * (lat - yi) / ((yj - yi) || 1e-12) + xi)) inside = !inside;
  }
  return inside;
}

function nmPolyContains_(poly, lat, lng) {
  if (!poly || !poly[0] || !nmPointInRing_(lat, lng, poly[0])) return false;
  for (let h = 1; h < poly.length; h++) {
    if (poly[h] && nmPointInRing_(lat, lng, poly[h])) return false;
  }
  return true;
}

function nmUnaccountedParcel_(props) {
  props = props || {};
  if (String(props.ACCTNO || '') === '000None') return true;
  const raw = String(props.TAXLOT || '');
  if (!/^\d+$/.test(raw)) return false;
  const n = Number(raw);
  return n === 77 || n === 88 || n === 99;
}

function nmFetchLotPolys_(lat, lng) {
  if (!isFinite(lat) || !isFinite(lng)) return null;
  for (let c = 0; c < NM_PARCEL_COUNTIES.length; c++) {
    const name = nmParcelFileFor_(lat, lng, NM_PARCEL_COUNTIES[c]);
    try {
      const res = UrlFetchApp.fetch(NM_PARCEL_PAGES + name, { muteHttpExceptions: true });
      if (res.getResponseCode() !== 200) continue;
      const gj = JSON.parse(res.getContentText());
      const feats = (gj && gj.features) || [];
      let best = null, bestArea = Infinity;
      for (let i = 0; i < feats.length; i++) {
        const f = feats[i], g = f.geometry || {};
        if (nmUnaccountedParcel_(f.properties)) continue;
        const polys = g.type === 'Polygon' ? [g.coordinates]
                    : g.type === 'MultiPolygon' ? g.coordinates : [];
        let hit = false;
        for (let p = 0; p < polys.length; p++) {
          if (nmPolyContains_(polys[p], lat, lng)) { hit = true; break; }
        }
        if (!hit) continue;
        const acres = Number((f.properties || {}).MAPACRES);
        const area = isFinite(acres) && acres > 0 ? acres : polys.length;
        if (area < bestArea) { best = polys; bestArea = area; }
      }
      if (best) return best;
    } catch (e) { /* tile 404s are normal */ }
  }
  return null;
}

function nmFilterAiToLot_(features, lotPolys) {
  const out = [];
  (features || []).forEach(function (f) {
    const lat = parseFloat(f.lat), lon = parseFloat(f.lon);
    if (!isFinite(lat) || !isFinite(lon)) return;
    let hit = false;
    for (let p = 0; p < lotPolys.length; p++) {
      if (nmPolyContains_(lotPolys[p], lat, lon)) { hit = true; break; }
    }
    if (!hit) return;
    out.push({
      i: out.length,
      class: f.class,
      x: f.x,
      y: f.y,
      lon: f.lon,
      lat: f.lat,
      confidence: f.confidence,
      area_sqm: f.area_sqm
    });
  });
  return out;
}

function runNearmapElementPinsCall_(sheet, row) {
  const address = String(sheet.getRange(row, NM_COL_ADDRESS).getValue() || '').trim();
  const accountTypeRaw = sheet.getRange(row, NM_COL_ACCOUNT_TYPE).getValue();
  const nadirUrl = String(sheet.getRange(row, NM_COL_NADIR_URL).getValue() || '').trim();
  if (!nadirUrl) {
    writePlainCell(sheet, row, NM_COL_ELEMENTS, 'ERROR: no nadir URL — import registry first');
    return false;
  }
  const catalog = nmFetchPinCatalog_(accountTypeRaw);
  const promptFn = (typeof nmElementPinsPrompt_ === 'function')
    ? nmElementPinsPrompt_
    : null;
  if (!promptFn) {
    writePlainCell(sheet, row, NM_COL_ELEMENTS, 'ERROR: nmElementPinsPrompt_ missing');
    return false;
  }
  const bounds = nmParseBounds_(sheet.getRange(row, NM_COL_NADIR_BOUNDS).getValue());
  if (!bounds) {
    writePlainCell(sheet, row, NM_COL_ELEMENTS, 'ERROR: no nadir bounds — import registry first');
    return false;
  }
  const aiUrl = String(sheet.getRange(row, NM_COL_AI_URL).getValue() || '').trim();
  let aiFeatures = nmFetchAiFeatures_(aiUrl, bounds);
  const lat = parseFloat(sheet.getRange(row, NM_COL_LAT).getValue());
  const lng = parseFloat(sheet.getRange(row, NM_COL_LNG).getValue());
  const lotLat = isFinite(lat) ? lat : (Number(bounds.north) + Number(bounds.south)) / 2;
  const lotLng = isFinite(lng) ? lng : (Number(bounds.east) + Number(bounds.west)) / 2;
  const lotPolys = nmFetchLotPolys_(lotLat, lotLng);
  if (lotPolys) {
    const n0 = aiFeatures.length;
    aiFeatures = nmFilterAiToLot_(aiFeatures, lotPolys);
    Logger.log('Nearmap Pass 1 row ' + row + ' lot-filtered AI ' + n0 + ' → ' + aiFeatures.length);
  }
  if (!aiFeatures.length) {
    writePlainCell(sheet, row, NM_COL_ELEMENTS, 'ERROR: no AI features (hints.json + bounds)');
    return false;
  }
  let prompt = promptFn() +
    '\n\nAPPROVED ELEMENT PIN VOCABULARY (use ONLY these ids):\n' +
    catalog.emitNames +
    '\n\nNEARMAP CLASS → CATALOG ID (the only allowed location sources):\n' +
    nmFormatClassMapForPrompt_() +
    '\n\nVENDOR AI FEATURES (numbered). Copy x,y from one row. Set "ai" to that index.\n' +
    nmFormatAiFeaturesForPrompt_(aiFeatures);
  const fullPrompt = prompt;

  const fetched = nmFetchNadirForBedrock_(nadirUrl);
  const b64 = fetched.b64;
  if (!b64) {
    writePlainCell(sheet, row, NM_COL_ELEMENTS, 'ERROR: nadir image fetch failed');
    return false;
  }
  if (b64.length > 3500000) {
    writePlainCell(sheet, row, NM_COL_ELEMENTS,
      'ERROR: nadir too large for Bedrock (b64 ' + b64.length + ' chars). Promote vert-p1.jpg.');
    return false;
  }
  const media = (typeof guessImageMediaType_ === 'function')
    ? guessImageMediaType_(fetched.url) : 'image/jpeg';
  const userContent = [
    { type: 'text', text: 'IMAGE — NADIR (Nearmap vertical). Use it only to pick which numbered AI feature is on the target property. Copy that feature\'s x,y. Do not invent coordinates.' },
    { type: 'image', source: { type: 'base64', media_type: media, data: b64 } },
    { type: 'text', text: 'Property address: ' + address + '. Return ONLY the JSON object with nadir_pins.' }
  ];
  const result = callBedrock(fullPrompt, userContent, 1000);
  if (!result) {
    writePlainCell(sheet, row, NM_COL_ELEMENTS, 'ERROR: Bedrock call failed (check Executions log)');
    return false;
  }
  const parsed = (typeof parseElementPins_ === 'function') ? parseElementPins_(result) : null;
  if (!parsed) {
    writePlainCell(sheet, row, NM_COL_ELEMENTS, 'ERROR: JSON parse failed');
    return false;
  }
  const pins = nmValidatePass1Pins_(parsed.nadir_pins, catalog.emitIds, aiFeatures);
  const rejected = (parsed.nadir_pins || []).filter(function (p) {
    return !catalog.emitIds[parseInt(p.id, 10)];
  }).map(function (p) { return p.id; });
  if (rejected.length) {
    Logger.log('Nearmap Pass 1 row ' + row + ' rejected ids: ' + rejected.join(', '));
  }
  writePlainCell(sheet, row, NM_COL_ELEMENTS, pins.length ? JSON.stringify(pins) : '');
  sheet.getRange(row, NM_COL_REVIEWED).setValue(false);
  writePlainCell(sheet, row, NM_COL_STATUS, pins.length ? ('pass1:' + pins.length) : 'pass1:empty');
  SpreadsheetApp.flush();
  return true;
}

function generateNearmapElementPinsForActiveRow() {
  const sheet = nmSheet_();
  const row = nmActiveRow_();
  if (!row) return;
  const siteNo = nmValidSiteNo_(sheet.getRange(row, NM_COL_SITE_NO).getValue());
  if (!siteNo) {
    SpreadsheetApp.getUi().alert('Nearmap Pass 1', 'Row needs a Site No in column A.', SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }
  let ok = false;
  try {
    ok = runNearmapElementPinsCall_(sheet, row);
  } catch (e) {
    writePlainCell(sheet, row, NM_COL_ELEMENTS, 'ERROR: ' + String(e.message || e).substring(0, 120));
  }
  SpreadsheetApp.getUi().alert('Nearmap Pass 1', ok ? 'Pins written for row ' + row + '.' : 'Failed — see Nadir Elements / logs.', SpreadsheetApp.getUi().ButtonSet.OK);
}

function generateNearmapElementPinsBatch() {
  const ui = SpreadsheetApp.getUi();
  const sheet = nmSheet_();
  const last = sheet.getLastRow();
  if (last < 2) { ui.alert('Nearmap Pass 1', 'No data rows.', ui.ButtonSet.OK); return; }
  const width = Math.max(sheet.getLastColumn(), NM_COL_UPLOAD_DATE);
  const data = sheet.getRange(2, 1, last - 1, width).getValues();
  const ready = [];
  for (let i = 0; i < data.length; i++) {
    const siteNo = nmValidSiteNo_(data[i][NM_COL_SITE_NO - 1]);
    const nadir = String(data[i][NM_COL_NADIR_URL - 1] || '').trim();
    const els = String(data[i][NM_COL_ELEMENTS - 1] || '').trim();
    if (!siteNo || !nadir) continue;
    if (!els || els.indexOf('ERROR:') === 0) ready.push(i + 2);
  }
  if (!ready.length) {
    ui.alert('Nearmap Pass 1', 'No rows ready (need Site No, nadir URL, empty/ERROR elements).', ui.ButtonSet.OK);
    return;
  }
  const batch = ready.slice(0, BATCH_SIZE);
  let done = 0;
  for (let i = 0; i < batch.length; i++) {
    try { if (runNearmapElementPinsCall_(sheet, batch[i])) done++; }
    catch (e) {
      writePlainCell(sheet, batch[i], NM_COL_ELEMENTS, 'ERROR: ' + String(e.message || e).substring(0, 80));
    }
    Utilities.sleep(2000);
  }
  ui.alert('Nearmap Pass 1', 'Completed ' + done + ' of ' + batch.length + ' (queue ' + ready.length + ').', ui.ButtonSet.OK);
}

// ── Pass 3: FR + wildfire concerns (catalog role=concern) ────────────────────
// Sibling of satellite Pass 2. Isolated clone: do not call parseSatPass2_ /
// runSatPass2Half_ / satFetchPinCatalog_. Validator is validateConcernPins_
// in plane.gs (reuse, do not copy). Pin x,y stay percent of full vert.jpg.

function parseNmPass3_(text) {
  if (!text) return null;
  let t = String(text).replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = t.indexOf('{'), end = t.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  t = t.substring(start, end + 1);
  let parsed;
  try { parsed = JSON.parse(t); } catch (e) {
    Logger.log('parseNmPass3_: JSON.parse failed — ' + e.message);
    return null;
  }
  if (!Array.isArray(parsed.nadir_pins)) {
    Logger.log('parseNmPass3_: nadir_pins missing/!array');
    return null;
  }
  if (typeof parsed.considerations !== 'string' || !parsed.considerations.trim()) {
    Logger.log('parseNmPass3_: considerations missing');
    return null;
  }
  if (typeof parsed.recommendations !== 'string' || !parsed.recommendations.trim()) {
    Logger.log('parseNmPass3_: recommendations missing');
    return null;
  }
  return parsed;
}

function nmParseConcernCell_(raw) {
  const s = String(raw || '').trim();
  if (!s || s.indexOf('ERROR:') === 0) return [];
  let v;
  try { v = JSON.parse(s); } catch (e) { return []; }
  if (!Array.isArray(v)) return [];
  return v.filter(function (p) {
    return p && typeof p === 'object' &&
      !isNaN(parseInt(p.id, 10)) && !isNaN(parseFloat(p.x)) && !isNaN(parseFloat(p.y));
  }).map(function (p) {
    return { id: parseInt(p.id, 10), x: parseFloat(p.x), y: parseFloat(p.y) };
  });
}

function nmConcernBlockFromCells_(concernsRaw, considerRaw, recRaw) {
  return {
    concerns: nmParseConcernCell_(concernsRaw),
    considerations: String(considerRaw || '').trim(),
    recommendations: String(recRaw || '').trim()
  };
}

function nmConfirmedPinsAsText_(pins) {
  if (!pins || !pins.length) return '(no confirmed element pins were placed for this property)';
  return pins.map(function (p, i) {
    const name = String(p.name || p.class || p.ai_class || 'pin').trim();
    return (i + 1) + '. ' + name + ' at (' + p.x + ', ' + p.y + ')';
  }).join('\n');
}

function nmFormatRegionCounts_(counts, nFeat) {
  const keys = Object.keys(counts || {}).sort();
  if (!keys.length && !(nFeat > 0)) return '(no region inventory)';
  const lines = keys.map(function (k) { return k + ': ' + counts[k]; });
  return (nFeat > 0 ? (nFeat + ' features total.\n') : '') + lines.join('\n');
}

function nmCountsFromRegionsBody_(body) {
  if (!body || typeof body !== 'object') return null;
  if (body.counts && typeof body.counts === 'object' && !Array.isArray(body.counts)) {
    return { counts: body.counts, n: Array.isArray(body.features) ? body.features.length : 0 };
  }
  if (!Array.isArray(body.features)) return null;
  const counts = {};
  body.features.forEach(function (f) {
    const cls = (f && f.properties && (f.properties['class'] || f.properties.description)) || 'Unknown';
    counts[cls] = (counts[cls] || 0) + 1;
  });
  return { counts: counts, n: body.features.length };
}

function nmFetchRegionsCounts_(url) {
  const s = String(url || '').trim();
  if (!s) return null;
  try {
    const res = UrlFetchApp.fetch(s, { muteHttpExceptions: true, followRedirects: true });
    if (res.getResponseCode() !== 200) return null;
    return nmCountsFromRegionsBody_(JSON.parse(res.getContentText()));
  } catch (e) {
    Logger.log('nmFetchRegionsCounts_ failed: ' + e.message);
    return null;
  }
}

function nmCompactRegionsForPrompt_(sheet, row, aiUrl) {
  const w = nmParseW_(sheet.getRange(row, NM_COL_DRAWN).getValue());
  if (w.edits && w.edits.counts && typeof w.edits.counts === 'object') {
    const n = (typeof w.edits.features === 'number') ? w.edits.features : 0;
    return nmFormatRegionCounts_(w.edits.counts, n);
  }
  const fetched = nmFetchRegionsCounts_(nmRegionsEditsUrl_(aiUrl)) ||
    nmFetchRegionsCounts_(nmRegionsOriginalUrl_(aiUrl));
  if (fetched) return nmFormatRegionCounts_(fetched.counts, fetched.n);
  return '(no region inventory)';
}

function nmPctToLatLng_(x, y, bounds) {
  return {
    lat: bounds.north - (Number(y) / 100) * (bounds.north - bounds.south),
    lng: bounds.west + (Number(x) / 100) * (bounds.east - bounds.west)
  };
}

function nmFilterConcernsToLot_(pins, lotPolys, bounds) {
  if (!lotPolys || !bounds || !pins || !pins.length) return pins || [];
  const kept = [];
  pins.forEach(function (p) {
    const ll = nmPctToLatLng_(p.x, p.y, bounds);
    let hit = false;
    for (let i = 0; i < lotPolys.length; i++) {
      if (nmPolyContains_(lotPolys[i], ll.lat, ll.lng)) { hit = true; break; }
    }
    if (hit) kept.push(p);
  });
  if (kept.length !== pins.length) {
    Logger.log('nmFilterConcernsToLot_: dropped ' + (pins.length - kept.length) + ' off-lot concern pin(s)');
  }
  return kept;
}

function nmPass3Spec_(key) {
  if (key === 'fr') {
    return {
      key: 'fr',
      promptFn: nmFrConcernsPrompt_,
      kbQuery: 'first responder property access egress visibility operational concerns hazards',
      colConcerns: NM_COL_FR_CONCERNS,
      colConsider: NM_COL_FR_CONSIDER,
      colRec: NM_COL_FR_REC
    };
  }
  return {
    key: 'wf',
    promptFn: nmWfConcernsPrompt_,
    kbQuery: 'wildfire defensible space fuel continuity ember exposure structure hardening',
    colConcerns: NM_COL_WF_CONCERNS,
    colConsider: NM_COL_WF_CONSIDER,
    colRec: NM_COL_WF_REC
  };
}

function nmAppendObliqueImages_(userContent, urls, budgetUsed) {
  const labels = [
    { key: 'north', label: 'IMAGE — NORTH OBLIQUE (camera looking south toward the property).' },
    { key: 'east',  label: 'IMAGE — EAST OBLIQUE (camera looking west toward the property).' },
    { key: 'south', label: 'IMAGE — SOUTH OBLIQUE (camera looking north toward the property).' },
    { key: 'west',  label: 'IMAGE — WEST OBLIQUE (camera looking east toward the property).' }
  ];
  const attached = [];
  const skipped = [];
  let used = budgetUsed;
  labels.forEach(function (row) {
    const url = String(urls[row.key] || '').trim();
    if (!url) { skipped.push(row.key.toUpperCase() + ' (no URL)'); return; }
    const b64 = fetchImageAsBase64(url);
    if (!b64) { skipped.push(row.key.toUpperCase() + ' (fetch failed)'); return; }
    if (used + b64.length > NM_PASS3_IMAGE_BUDGET) {
      skipped.push(row.key.toUpperCase() + ' (payload budget)');
      Logger.log('Nearmap Pass 3: skipping ' + row.key + ' oblique — payload budget');
      return;
    }
    used += b64.length;
    userContent.push({ type: 'text', text: row.label });
    userContent.push({
      type: 'image',
      source: { type: 'base64', media_type: guessImageMediaType_(url), data: b64 }
    });
    attached.push(row.key.toUpperCase());
  });
  return { attached: attached, skipped: skipped, used: used };
}

function runNearmapPass3Half_(sheet, row, spec) {
  if (typeof validateConcernPins_ !== 'function') {
    throw new Error('validateConcernPins_ is not defined — paste plane.gs');
  }
  const address = String(sheet.getRange(row, NM_COL_ADDRESS).getValue() || '').trim();
  const accountTypeRaw = sheet.getRange(row, NM_COL_ACCOUNT_TYPE).getValue();
  const accountType = normalizeAccountType(accountTypeRaw);
  const nadirUrl = String(sheet.getRange(row, NM_COL_NADIR_URL).getValue() || '').trim();
  if (!nadirUrl) return false;

  const catalog = nmFetchPinCatalog_(accountTypeRaw);
  const vocab = spec.key === 'fr' ? catalog.frConcernNames : catalog.wfConcernNames;
  const ids = spec.key === 'fr' ? catalog.frConcernIds : catalog.wfConcernIds;
  if (!vocab || !String(vocab).trim()) {
    Logger.log('Nearmap Pass 3 ' + spec.key + ' row ' + row +
      ': EMPTY concern vocabulary — aborting half (do not flatten role= in pins-catalog.json)');
    return false;
  }

  const prompt = spec.promptFn() +
    '\n\nAPPROVED CONCERN PIN VOCABULARY (use ONLY these ids):\n' + vocab;
  let kbContext = '';
  try {
    if (typeof queryKnowledgeBase === 'function') kbContext = queryKnowledgeBase(spec.kbQuery) || '';
  } catch (e) {
    Logger.log('Nearmap Pass 3 KB query failed: ' + e.message);
  }
  const fullPrompt = kbContext ? prompt + '\n\nREFERENCE CONTEXT FROM KNOWLEDGE BASE:\n' + kbContext : prompt;

  const nadir = nmFetchNadirForBedrock_(nadirUrl);
  if (!nadir.b64) return false;

  const pins = nmParsePins_(sheet.getRange(row, NM_COL_ELEMENTS).getValue());
  const confirmedText = nmConfirmedPinsAsText_(pins);
  const aiUrl = String(sheet.getRange(row, NM_COL_AI_URL).getValue() || '').trim();
  const regionText = nmCompactRegionsForPrompt_(sheet, row, aiUrl);

  const userContent = [
    { type: 'text', text: 'IMAGE — NADIR (straight-down Nearmap vertical; x,y percent of the FULL delivery Vert). Source: ' + nadir.url },
    { type: 'image', source: { type: 'base64', media_type: guessImageMediaType_(nadir.url), data: nadir.b64 } }
  ];
  const obl = nmAppendObliqueImages_(userContent, {
    north: sheet.getRange(row, NM_COL_NORTH_URL).getValue(),
    east: sheet.getRange(row, NM_COL_EAST_URL).getValue(),
    south: sheet.getRange(row, NM_COL_SOUTH_URL).getValue(),
    west: sheet.getRange(row, NM_COL_WEST_URL).getValue()
  }, nadir.b64.length);
  const imageNote = 'Images attached: NADIR' +
    (obl.attached.length ? ', ' + obl.attached.join(', ') : '') + '.' +
    (obl.skipped.length ? ' Omitted: ' + obl.skipped.join(', ') + '.' : '');

  userContent.push({
    type: 'text',
    text:
      'Property address: ' + address + ' [' + accountType + '].\n' +
      imageNote + '\n\n' +
      'CONFIRMED PROPERTY ELEMENTS (human-approved, region-class names), as "n. Class at (x, y)" on the nadir:\n' +
      confirmedText +
      '\n\nREGION CLASS INVENTORY (counts only — polygons are not attached):\n' +
      regionText +
      '\n\nUsing these confirmed elements, the region inventory, and the attached images, return ONLY the JSON object described in your instructions (concern pins in "nadir_pins", plus "considerations" and "recommendations").'
  });

  const result = callBedrock(fullPrompt, userContent, 4000);
  if (!result) return false;
  const parsed = parseNmPass3_(result);
  if (!parsed) {
    Logger.log(spec.key + ' Nearmap Pass 3 raw (row ' + row + '): ' + result.substring(0, 500));
    return false;
  }

  let concernPins = validateConcernPins_(parsed.nadir_pins, ids);
  const lat = parseFloat(sheet.getRange(row, NM_COL_LAT).getValue());
  const lng = parseFloat(sheet.getRange(row, NM_COL_LNG).getValue());
  const bounds = nmParseBounds_(sheet.getRange(row, NM_COL_NADIR_BOUNDS).getValue());
  const lotPolys = nmFetchLotPolys_(lat, lng);
  if (lotPolys && bounds) concernPins = nmFilterConcernsToLot_(concernPins, lotPolys, bounds);

  writePlainCell(sheet, row, spec.colConcerns, concernPins.length ? JSON.stringify(concernPins) : '');
  writePlainCell(sheet, row, spec.colConsider, parsed.considerations.trim());
  writePlainCell(sheet, row, spec.colRec, parsed.recommendations.trim());
  Logger.log('Nearmap Pass 3 ' + spec.key.toUpperCase() + ': row ' + row + ' — ' +
    concernPins.length + ' concerns [' + address + ']');
  return true;
}

function runNearmapPass3Row_(sheet, row) {
  const reviewed = sheet.getRange(row, NM_COL_REVIEWED).getValue() === true;
  if (!reviewed) return { ran: false, fr: false, wf: false, gated: true, reason: 'not reviewed' };
  const pins = nmParsePins_(sheet.getRange(row, NM_COL_ELEMENTS).getValue());
  if (!pins.length) return { ran: false, fr: false, wf: false, gated: true, reason: 'no pins' };
  if (!nmPinsAreRegionStyle_(pins)) {
    return { ran: false, fr: false, wf: false, gated: true, reason: 'catalog leftovers' };
  }
  let fr = false, wf = false;
  try { fr = runNearmapPass3Half_(sheet, row, nmPass3Spec_('fr')); }
  catch (e) { Logger.log('Nearmap Pass 3 FR ERROR row ' + row + ': ' + e.message); }
  Utilities.sleep(1500);
  try { wf = runNearmapPass3Half_(sheet, row, nmPass3Spec_('wf')); }
  catch (e) { Logger.log('Nearmap Pass 3 WF ERROR row ' + row + ': ' + e.message); }
  const bits = [];
  if (fr) bits.push('fr');
  if (wf) bits.push('wf');
  writePlainCell(sheet, row, NM_COL_STATUS, bits.length ? ('pass3:' + bits.join(',')) : 'pass3:fail');
  return { ran: true, fr: fr, wf: wf, gated: false };
}

function generateNearmapPass3ForActiveRow() {
  const ui = SpreadsheetApp.getUi();
  const sheet = nmSheet_();
  const row = nmActiveRow_();
  if (!row) return;
  if (sheet.getMaxColumns() < NM_COL_WF_REC) {
    ui.alert('Pass 3', 'Run Set Up Nearmap Sheet first so columns X–AC (FR/WF concerns) exist.', ui.ButtonSet.OK);
    return;
  }
  const address = String(sheet.getRange(row, NM_COL_ADDRESS).getValue() || '').trim();
  if (sheet.getRange(row, NM_COL_REVIEWED).getValue() !== true) {
    ui.alert('Pass 3 blocked — review required',
      'Row ' + row + ' has not been marked "Elements Reviewed".\n\n' +
      'Finish the Pins editor (Open Nearmap Pins Editor), then tick "Elements Reviewed" before running Pass 3.',
      ui.ButtonSet.OK);
    return;
  }
  const pins = nmParsePins_(sheet.getRange(row, NM_COL_ELEMENTS).getValue());
  if (!pins.length || !nmPinsAreRegionStyle_(pins)) {
    ui.alert('Pass 3 blocked — pins required',
      'Row ' + row + ' needs confirmed region-class pins in Nadir Elements (column R).\n\n' +
      'Open Nearmap Pins Editor, Auto Generate / Place pins, Save, then tick Elements Reviewed.',
      ui.ButtonSet.OK);
    return;
  }
  const r = runNearmapPass3Row_(sheet, row);
  ui.alert('Nearmap Pass 3 — FR + Wildfire',
    'Property: ' + (address || ('row ' + row)) + '\n\n' +
    'FR concerns/considerations/recommendations: ' + (r.fr ? 'written ✓' : 'FAILED ✗') + '\n' +
    'Wildfire concerns/considerations/recommendations: ' + (r.wf ? 'written ✓' : 'FAILED ✗') +
    (r.fr && r.wf ? '' : '\n\nA failed analysis left its columns empty — rerun Pass 3 to retry the missing half. See logs.'),
    ui.ButtonSet.OK);
}

function nmRowReadyForPass3_(rowVals) {
  if (rowVals[NM_COL_REVIEWED - 1] !== true) return false;
  const pins = nmParsePins_(rowVals[NM_COL_ELEMENTS - 1]);
  if (!pins.length || !nmPinsAreRegionStyle_(pins)) return false;
  const fr = String(rowVals[NM_COL_FR_CONCERNS - 1] || '').trim();
  const wf = String(rowVals[NM_COL_WF_CONCERNS - 1] || '').trim();
  return !fr || !wf;
}

function generateNearmapPass3Batch() {
  const ui = SpreadsheetApp.getUi();
  const sheet = nmSheet_();
  if (sheet.getMaxColumns() < NM_COL_WF_REC) {
    ui.alert('Nearmap Pass 3', 'Run Set Up Nearmap Sheet first so columns X–AC (FR/WF concerns) exist.', ui.ButtonSet.OK);
    return;
  }
  const last = sheet.getLastRow();
  if (last < 2) { ui.alert('Nearmap Pass 3', 'No data rows.', ui.ButtonSet.OK); return; }
  const width = Math.max(sheet.getLastColumn(), NM_HEADERS.length);
  const data = sheet.getRange(2, 1, last - 1, width).getValues();
  const ready = [];
  for (let i = 0; i < data.length; i++) {
    if (nmRowReadyForPass3_(data[i])) ready.push(i + 2);
  }
  if (!ready.length) {
    ui.alert('Nearmap Pass 3 — FR + Wildfire',
      'No reviewed rows are awaiting Pass 3.\n(A row runs when "Elements Reviewed" is ticked, column R has region-class pins, and FR or Wildfire concerns are still empty.)',
      ui.ButtonSet.OK);
    return;
  }
  let frDone = 0, wfDone = 0, rows = 0, attempted = 0;
  for (let i = 0; i < ready.length; i++) {
    if (attempted >= BATCH_SIZE) break;
    attempted++; rows++;
    const r = runNearmapPass3Row_(sheet, ready[i]);
    if (r.fr) frDone++;
    if (r.wf) wfDone++;
    Utilities.sleep(2000);
  }
  const remaining = ready.length - attempted;
  ui.alert('Nearmap Pass 3 — FR + Wildfire',
    'Rows processed: ' + rows + '\n' +
    'FR analyses written: ' + frDone + '\nWildfire analyses written: ' + wfDone +
    (remaining > 0 ? '\nRemaining: ' + remaining + ' — run again to continue.' : '\nAll ready rows processed.') +
    '\n\nAny failed half left its columns empty and will be retried on the next run.',
    ui.ButtonSet.OK);
}

function nmParseOnePin_(p) {
  if (!p) return null;
  const x = parseFloat(p.x), y = parseFloat(p.y);
  if (isNaN(x) || isNaN(y)) return null;
  if (Math.abs(x) > 500 || Math.abs(y) > 500) return null;
  const name = String(p.name || p.class || p.ai_class || '').trim();
  const cls = String(p.class || p.ai_class || p.name || '').trim();
  if (name || cls) {
    const row = {
      id: String(p.id != null ? p.id : ''),
      name: name || cls,
      class: cls || name,
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10
    };
    if (p.source) row.source = String(p.source);
    if (p.ai_class) row.ai_class = String(p.ai_class);
    if (p.region_id) row.region_id = String(p.region_id);
    return row;
  }
  const id = parseInt(p.id, 10);
  if (isNaN(id)) return null;
  const row = { id: id, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
  if (p.source) row.source = String(p.source);
  if (p.ai_class) row.ai_class = String(p.ai_class);
  if (p.drawn_id) row.drawn_id = String(p.drawn_id);
  if (p.region_id) row.region_id = String(p.region_id);
  if (Array.isArray(p.merged_from)) row.merged_from = p.merged_from.map(String);
  return row;
}

function nmUnpackPackedPins_(v) {
  const classes = v.c || [];
  const out = [];
  (v.p || []).forEach(function (row) {
    if (!row || !row.length) return;
    const cls = String(classes[row[0]] || '');
    const x = parseFloat(row[1]), y = parseFloat(row[2]);
    if (!cls || isNaN(x) || isNaN(y)) return;
    const rid = row[3] != null ? String(row[3]) : '';
    out.push({
      id: rid || cls,
      name: cls,
      class: cls,
      x: x,
      y: y,
      source: 'region',
      region_id: rid,
      ai_class: cls
    });
  });
  return out;
}

function nmPackPinsForSheet_(pins) {
  const classes = [];
  const idx = {};
  function ci(name) {
    const n = String(name || '');
    if (idx[n] == null) { idx[n] = classes.length; classes.push(n); }
    return idx[n];
  }
  const p = (pins || []).map(function (pin) {
    const cls = String(pin.class || pin.name || pin.ai_class || '');
    return [ci(cls), pin.x, pin.y, String(pin.region_id || pin.id || '')];
  });
  return { v: 2, source: 'regions', c: classes, p: p };
}

function nmParsePins_(raw) {
  const s = String(raw || '').trim();
  if (!s || s.indexOf('ERROR:') === 0) return [];
  let v;
  try { v = JSON.parse(s); } catch (e) { return []; }
  if (v && v.v === 2 && Array.isArray(v.c) && Array.isArray(v.p)) return nmUnpackPackedPins_(v);
  if (!Array.isArray(v)) return [];
  return v.map(nmParseOnePin_).filter(Boolean);
}

function nmValidateRegionPins_(pins) {
  if (!Array.isArray(pins)) return [];
  const out = [];
  const seen = {};
  for (let i = 0; i < pins.length; i++) {
    const row = nmParseOnePin_(pins[i]);
    if (!row || !(row.name || row.class)) continue;
    const key = String(row.region_id || row.id) + ':' + row.x + ':' + row.y;
    if (seen[key]) continue;
    seen[key] = true;
    out.push(row);
  }
  return out;
}

function nmPinsAreRegionStyle_(pins) {
  if (!Array.isArray(pins) || !pins.length) return true;
  return pins.some(function (p) {
    return p && (p.name || p.class || p.source === 'region' ||
      (p.id != null && !/^\d+$/.test(String(p.id))));
  });
}

function nmParseDrawn_(raw) {
  return nmParseW_(raw).drawn;
}

function nmBuildRecord_(sheet, row, id) {
  const accountType = normalizeAccountType(sheet.getRange(row, NM_COL_ACCOUNT_TYPE).getValue());
  const accountName = String(sheet.getRange(row, NM_COL_ACCOUNT).getValue() || '').trim();
  const address = String(sheet.getRange(row, NM_COL_ADDRESS).getValue() || '').trim();
  const hoaTag = sheet.getRange(row, NM_COL_HOA).getValue();
  const lat = parseFloat(sheet.getRange(row, NM_COL_LAT).getValue());
  const lng = parseFloat(sheet.getRange(row, NM_COL_LNG).getValue());
  const delivery = String(sheet.getRange(row, NM_COL_DELIVERY).getValue() || '').trim();
  const bounds = nmParseBounds_(sheet.getRange(row, NM_COL_NADIR_BOUNDS).getValue());
  const rec = {
    view: 'nearmap',
    source: 'nearmap',
    name: accountName,
    address: address,
    hoa: slugify(hoaTag) || '',
    account_type: accountType,
    survey_date: String(sheet.getRange(row, NM_COL_SURVEY_DATE).getValue() || '').trim(),
    delivery_id: delivery,
    nadir: {
      url: String(sheet.getRange(row, NM_COL_NADIR_URL).getValue() || '').trim(),
      bounds: bounds
    },
    obliques: {
      north: { url: String(sheet.getRange(row, NM_COL_NORTH_URL).getValue() || '').trim() },
      east: { url: String(sheet.getRange(row, NM_COL_EAST_URL).getValue() || '').trim() },
      south: { url: String(sheet.getRange(row, NM_COL_SOUTH_URL).getValue() || '').trim() },
      west: { url: String(sheet.getRange(row, NM_COL_WEST_URL).getValue() || '').trim() }
    },
    ai_url: String(sheet.getRange(row, NM_COL_AI_URL).getValue() || '').trim(),
    elements: nmParsePins_(sheet.getRange(row, NM_COL_ELEMENTS).getValue()),
    drawn: null,
    regions: null,
    fr: nmConcernBlockFromCells_(
      sheet.getRange(row, NM_COL_FR_CONCERNS).getValue(),
      sheet.getRange(row, NM_COL_FR_CONSIDER).getValue(),
      sheet.getRange(row, NM_COL_FR_REC).getValue()
    ),
    wildfire: nmConcernBlockFromCells_(
      sheet.getRange(row, NM_COL_WF_CONCERNS).getValue(),
      sheet.getRange(row, NM_COL_WF_CONSIDER).getValue(),
      sheet.getRange(row, NM_COL_WF_REC).getValue()
    )
  };
  const w = nmParseW_(sheet.getRange(row, NM_COL_DRAWN).getValue());
  rec.drawn = w.drawn;
  rec.regions = {
    original: nmRegionsOriginalUrl_(rec.ai_url),
    edits: nmRegionsEditsUrl_(rec.ai_url),
    edits_saved: w.edits ? (w.edits.saved || '') : ''
  };
  if (!isNaN(lat) && !isNaN(lng)) { rec.lat = lat; rec.lng = lng; }
  rec.id = id;
  return rec;
}

function nmQueueSyncRow_(sheet, row, creds, files) {
  const siteNo = nmValidSiteNo_(sheet.getRange(row, NM_COL_SITE_NO).getValue());
  if (!siteNo) return { skipped: 'blank site_no' };
  const nadirUrl = String(sheet.getRange(row, NM_COL_NADIR_URL).getValue() || '').trim();
  if (!nadirUrl) return { skipped: 'no nadir' };
  const id = nmPropertyId_(siteNo, creds.hashSalt);
  const rec = nmBuildRecord_(sheet, row, id);
  files.push({ path: 'data/nearmap/' + id + '.json', content: JSON.stringify(rec, null, 2) });
  if (NM_UPSERT_INDEX) {
    const patch = {
      name: rec.name, address: rec.address, hoa: rec.hoa, account_type: rec.account_type,
      views: { nearmap: id }
    };
    if (rec.lat != null) { patch.lat = rec.lat; patch.lng = rec.lng; }
    files.push(upsertIndexEntry_(id, patch).file);
  }
  return { id: id, rec: rec, row: row };
}

function processNearmapSheet() {
  const creds = getCredentials();
  const sheet = nmSheet_();
  const last = sheet.getLastRow();
  if (last < 2) { Logger.log('Nearmap sheet empty'); return; }
  const files = [];
  const updates = [];
  for (let row = 2; row <= last; row++) {
    const r = nmQueueSyncRow_(sheet, row, creds, files);
    if (r && r.id) updates.push(r);
    else if (r && r.skipped) Logger.log('Nearmap skip row ' + row + ': ' + r.skipped);
  }
  if (!files.length) { Logger.log('Nearmap: nothing to push'); return; }
  if (!pushAllToGitHub(files, 'Nearmap')) return;
  updates.forEach(function (u) {
    const link = buildNearmapViewerUrl_(sheet, u.row);
    if (link) writePlainCell(sheet, u.row, NM_COL_REVIEW_LINK, link);
    sheet.getRange(u.row, NM_COL_UPLOAD_DATE).setValue(new Date().toLocaleString());
    writePlainCell(sheet, u.row, NM_COL_STATUS, 'synced');
  });
  Logger.log('Nearmap sync complete: ' + updates.length);
}

function processNearmapForActiveRow() {
  const creds = getCredentials();
  const sheet = nmSheet_();
  const row = nmActiveRow_();
  if (!row) return;
  const files = [];
  const r = nmQueueSyncRow_(sheet, row, creds, files);
  if (!r || !r.id) {
    SpreadsheetApp.getUi().alert('Nearmap sync', 'Row needs Site No and nadir URL.', SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }
  if (!pushAllToGitHub(files, 'Nearmap — row ' + row)) {
    SpreadsheetApp.getUi().alert('Nearmap sync', 'GitHub push failed.', SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }
  const link = buildNearmapViewerUrl_(sheet, row);
  if (link) writePlainCell(sheet, row, NM_COL_REVIEW_LINK, link);
  sheet.getRange(row, NM_COL_UPLOAD_DATE).setValue(new Date().toLocaleString());
  writePlainCell(sheet, row, NM_COL_STATUS, 'synced');
  SpreadsheetApp.getUi().alert('Nearmap sync', 'Published data/nearmap/' + r.id + '.json', SpreadsheetApp.getUi().ButtonSet.OK);
}

// Two editors on one page: mode=regions (default; Draw/erase vendor regions) and
// mode=pins (one pin per region, named after the region class). Never both at once.
function buildNearmapReviewUrl_(sheet, row, mode) {
  const delivery = String(sheet.getRange(row, NM_COL_DELIVERY).getValue() || '').trim();
  const siteNo = nmValidSiteNo_(sheet.getRange(row, NM_COL_SITE_NO).getValue());
  const creds = getCredentials();
  let url = NEARMAP_REVIEW_URL + '?';
  const parts = [];
  if (siteNo) {
    const id = nmPropertyId_(siteNo, creds.hashSalt);
    if (id) parts.push('property=' + encodeURIComponent(id));
    parts.push('site_no=' + encodeURIComponent(siteNo));
  }
  if (delivery) parts.push('delivery=' + encodeURIComponent(delivery));
  if (!parts.length) return null;
  if (mode === 'pins') parts.push('mode=pins');
  return url + parts.join('&');
}

function nmOpenEditor_(mode, label) {
  const sheet = nmSheet_();
  const row = nmActiveRow_();
  if (!row) return;
  const url = buildNearmapReviewUrl_(sheet, row, mode);
  if (!url) {
    SpreadsheetApp.getUi().alert(label, 'Row needs a Delivery Id (import registry) and/or Site No.', SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }
  const address = String(sheet.getRange(row, NM_COL_ADDRESS).getValue() || '').trim();
  reviewOpenDialog_((address || 'Nearmap') + ' — ' + label, url);
}

function openNearmapReviewForActiveRow() { nmOpenEditor_('regions', 'Regions'); }
function openNearmapPinsForActiveRow() { nmOpenEditor_('pins', 'Pins'); }

// Product viewer (full page, no hub redirect). Same URL written to column U on sync.
// Do not pass property=hashId(site_no) — that is not the Jones hub id.
function buildNearmapViewerUrl_(sheet, row) {
  const siteNo = nmValidSiteNo_(sheet.getRange(row, NM_COL_SITE_NO).getValue());
  const delivery = String(sheet.getRange(row, NM_COL_DELIVERY).getValue() || '').trim();
  const parts = ['full=1'];
  if (siteNo) parts.push('site_no=' + encodeURIComponent(siteNo));
  if (delivery) parts.push('delivery=' + encodeURIComponent(delivery));
  if (!siteNo && !delivery) return null;
  return NEARMAP_VIEWER_URL + '?' + parts.join('&');
}

function openNearmapViewerForActiveRow() {
  const sheet = nmSheet_();
  const row = nmActiveRow_();
  if (!row) return;
  const url = buildNearmapViewerUrl_(sheet, row);
  if (!url) {
    SpreadsheetApp.getUi().alert('Nearmap Viewer', 'Row needs a Site No and/or Delivery Id.', SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }
  const address = String(sheet.getRange(row, NM_COL_ADDRESS).getValue() || '').trim();
  reviewOpenDialog_((address || 'Nearmap') + ' — Viewer', url);
}

function nmGetElements_(p) {
  const siteNo = nmValidSiteNo_(p && (p.site_no || p.site));
  const deliveryWant = String((p && (p.delivery_id || p.delivery)) || '').trim().toLowerCase();
  if (!siteNo && !deliveryWant) throw new Error('site_no or delivery required');
  const sheet = nmSheet_();
  const last = sheet.getLastRow();
  if (last < 2) throw new Error('Nearmap sheet empty');
  const width = Math.max(sheet.getLastColumn(), NM_HEADERS.length);
  const vals = sheet.getRange(2, 1, last - 1, width).getValues();
  const creds = getCredentials();
  let found = -1;
  let deliveryHits = 0;
  for (let i = 0; i < vals.length; i++) {
    const rowSite = nmValidSiteNo_(vals[i][NM_COL_SITE_NO - 1]);
    const rowDel = String(vals[i][NM_COL_DELIVERY - 1] || '').trim().toLowerCase();
    if (siteNo) {
      if (rowSite === siteNo) { found = i; break; }
    } else if (deliveryWant && rowDel === deliveryWant) {
      deliveryHits++;
      if (found < 0) found = i;
    }
  }
  if (found < 0) {
    throw new Error(siteNo ? ('no Nearmap row for site_no ' + siteNo) : ('no Nearmap row for delivery ' + deliveryWant));
  }
  if (!siteNo && deliveryHits > 1) {
    throw new Error('delivery matches ' + deliveryHits + ' Nearmap rows — pass site_no (do not guess Jones)');
  }
  const i = found;
  const rowSite = nmValidSiteNo_(vals[i][NM_COL_SITE_NO - 1]);
  const bounds = nmParseBounds_(vals[i][NM_COL_NADIR_BOUNDS - 1]);
  const aiUrl = String(vals[i][NM_COL_AI_URL - 1] || '').trim();
  const w = nmParseW_(vals[i][NM_COL_DRAWN - 1]);
  const id = nmPropertyId_(rowSite, creds.hashSalt);
  const cell = function (col) {
    return (col > 0 && col <= vals[i].length) ? vals[i][col - 1] : '';
  };
  return {
    ok: true,
    route: 'nearmap-elements',
    site_no: rowSite,
    property_id: id,
    account_type: normalizeAccountType(cell(NM_COL_ACCOUNT_TYPE)),
    delivery_id: String(cell(NM_COL_DELIVERY) || '').trim(),
    address: String(cell(NM_COL_ADDRESS) || '').trim(),
    nadir_url: String(cell(NM_COL_NADIR_URL) || '').trim(),
    bounds: bounds,
    ai_url: aiUrl,
    regions_original_url: nmRegionsOriginalUrl_(aiUrl),
    regions_edits_url: nmRegionsEditsUrl_(aiUrl),
    regions_edits: w.edits,
    pins: nmParsePins_(cell(NM_COL_ELEMENTS)),
    drawn: w.drawn,
    north_url: String(cell(NM_COL_NORTH_URL) || '').trim(),
    east_url: String(cell(NM_COL_EAST_URL) || '').trim(),
    south_url: String(cell(NM_COL_SOUTH_URL) || '').trim(),
    west_url: String(cell(NM_COL_WEST_URL) || '').trim(),
    fr: nmConcernBlockFromCells_(cell(NM_COL_FR_CONCERNS), cell(NM_COL_FR_CONSIDER), cell(NM_COL_FR_REC)),
    wildfire: nmConcernBlockFromCells_(cell(NM_COL_WF_CONCERNS), cell(NM_COL_WF_CONSIDER), cell(NM_COL_WF_REC))
  };
}

// Reviewer working regions → validated ai/edits/regions.json document. Same shape
// the local review_server writes: a FeatureCollection with per-class counts.
// Geometry is checked for type and id only.
function nmValidateRegionsDoc_(regions, deliveryId) {
  if (!regions || typeof regions !== 'object' || !Array.isArray(regions.features)) {
    throw new Error('regions must be a FeatureCollection');
  }
  const counts = {};
  regions.features.forEach(function (f, i) {
    if (!f || f.type !== 'Feature' || !f.geometry ||
        (f.geometry.type !== 'Polygon' && f.geometry.type !== 'MultiPolygon')) {
      throw new Error('regions.features[' + i + '] is not a Polygon/MultiPolygon Feature');
    }
    if (f.id === undefined || f.id === null || String(f.id) === '') {
      throw new Error('regions.features[' + i + '] has no id');
    }
    const cls = (f.properties && (f.properties['class'] || f.properties.description)) || 'Unknown';
    counts[cls] = (counts[cls] || 0) + 1;
  });
  const doc = {
    type: 'FeatureCollection',
    name: 'nearmap-regions',
    source: 'edits',
    delivery_id: deliveryId || String(regions.delivery_id || ''),
    saved: new Date().toISOString(),
    saved_by: 'nearmap-review via Apps Script',
    counts: counts,
    features: regions.features
  };
  const text = JSON.stringify(doc);
  if (text.length > NM_EDITS_MAX_BYTES) {
    throw new Error('regions document too large (' + text.length + ' bytes)');
  }
  return { doc: doc, text: text };
}

// Save from either editor. The pins editor sends `pins`; the regions editor sends
// `regions` and NO `pins` key — column R is left alone in that case (an absent
// key is not an empty list).
function nmSavePins_(payload) {
  const siteNo = nmValidSiteNo_(payload && payload.site_no);
  if (!siteNo) throw new Error('site_no required');
  const hasPins = Array.isArray(payload.pins);
  let pins = null;
  if (hasPins) {
    if (nmPinsAreRegionStyle_(payload.pins)) {
      pins = nmValidateRegionPins_(payload.pins);
    } else {
      pins = nmValidateElementPins_(payload.pins, (function () {
        const cat = nmFetchPinCatalog_(payload.account_type || '');
        return cat.elementIds;
      })());
      if (payload.pins.length > NM_MAX_PINS) {
        throw new Error('refusing save over NM_MAX_PINS (' + NM_MAX_PINS + ')');
      }
    }
  }
  if (!hasPins && !payload.regions) throw new Error('nothing to save (no pins, no regions)');
  const sheet = nmSheet_();
  const last = sheet.getLastRow();
  if (last < 2) throw new Error('Nearmap sheet empty');
  const width = Math.max(sheet.getLastColumn(), NM_COL_DRAWN);
  const vals = sheet.getRange(2, 1, last - 1, width).getValues();
  for (let i = 0; i < vals.length; i++) {
    if (nmValidSiteNo_(vals[i][NM_COL_SITE_NO - 1]) !== siteNo) continue;
    const row = i + 2;
    if (hasPins) {
      let cell;
      if (nmPinsAreRegionStyle_(pins) || (pins.length && pins[0].class)) {
        cell = JSON.stringify(nmPackPinsForSheet_(pins));
        if (cell.length > 49000) {
          throw new Error('pin list too large for the sheet cell (' + cell.length + ' chars). Delete some pins or split the delivery.');
        }
      } else {
        cell = pins.length ? JSON.stringify(pins) : '';
      }
      writePlainCell(sheet, row, NM_COL_ELEMENTS, pins.length ? cell : '');
    }
    const prevW = nmParseW_(vals[i][NM_COL_DRAWN - 1]);
    const drawn = payload.drawn ? nmParseDrawn_(payload.drawn) : prevW.drawn;
    let edits = prevW.edits;
    let regionsOut = null;
    if (payload.regions) {
      // Write the working regions to S3 ai/edits/regions.json (the folder
      // format). No GitHub: Nearmap client data stays off the public repo.
      const deliveryId = String(vals[i][NM_COL_DELIVERY - 1] || '').trim();
      if (!deliveryId) throw new Error('row has no Delivery Id — import the registry first');
      const v = nmValidateRegionsDoc_(payload.regions, deliveryId);
      const put = nmS3PutObject_(nmEditsS3Key_(deliveryId), v.text, 'application/json');
      edits = {
        url: nmRegionsEditsUrl_(vals[i][NM_COL_AI_URL - 1]),
        features: v.doc.features.length,
        counts: v.doc.counts,
        saved: v.doc.saved,
        etag: put.etag
      };
      regionsOut = { features: edits.features, url: edits.url, saved: edits.saved };
    }
    nmWriteW_(sheet, row, drawn, edits);
    const parts = [];
    if (hasPins) parts.push('saved ' + pins.length + ' pin(s)');
    if (regionsOut) parts.push('regions ' + regionsOut.features + ' features → S3 edits');
    writePlainCell(sheet, row, NM_COL_STATUS, parts.join(' · '));
    return { ok: true, route: 'nearmap-save', site_no: siteNo, saved: hasPins ? pins.length : null, regions: regionsOut };
  }
  throw new Error('no Nearmap row for site_no ' + siteNo);
}
