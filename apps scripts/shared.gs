// ============================================================
// PROPERTY INTEL — Apps Script v5.24 — FILE 4/7: shared.gs
// Cross-pipeline helpers: AWS SigV4, Bedrock, Knowledge Base,
// image fetch, GitHub API, Intel Links, parcel geometry, pin
// coordinate math, geocoding, utilities.
//
// v5.24: FOLDER-ONLY INDEX. The monolithic data/index.json is GONE —
// deleted and never referenced. Each property is one file in a folder:
// data/index/{id}.json, holding identity (name/address/hoa/coords/
// account_type/has_nadir) plus its per-tab view hashes in `views`.
// Every sheet sync does read-merge-write PER PROPERTY: it fetches that
// property's index file, merges in ONLY the view keys it owns
// (security/wildfire for satellite, plane for plane, drone/interior for
// those sheets), and writes it back — creating the file if absent,
// updating if present. Because a sync never touches another sync's view
// keys, one account's file accumulates every tab and nothing clobbers.
// Stale sweep (Satellite): drop only the sweeper's own view keys; delete
// the file only when no views remain.
// Index helpers: INDEX_DIR, fetchIndexEntry_, mergeIndexEntry_,
// buildIndexEntryFile_, upsertIndexEntry_ (the per-sync primitive),
// listIndexIds_, deleteIndexEntryFile_. There is no fetchIndex(), no
// migration, and no monolith writer anywhere in v5.24.
//
// v5.27: camera metadata is property-level, not a view field.
// Canonical PUT: data/cameras/json/{hubId}.json
// (camerasFileForSync_). Plane/satellite must not write that file.
// pushAllToGitHub is UTF-8 text — never JPEG bytes through it.
// v5.28: property-level pins. Canonical PUT: data/pins/{hubId}.json
// (pinsFileForSync_). 3D writes always replace; satellite writes skip when
// an existing file is source: "3d". Merge pins_source onto the index.
// ============================================================

// ── AWS SigV4 helpers ────────────────────────────────────────────────────────

function sha256Hex(data) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, data, Utilities.Charset.UTF_8)
    .map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
}

function hmacSha256Bytes(data, keyBytes) {
  return Utilities.computeHmacSha256Signature(
    Utilities.newBlob(data).getBytes(),
    keyBytes
  );
}

function buildAwsHeaders(method, host, path, payload, creds, service) {
  service = service || 'bedrock';
  const now       = new Date();
  const dateStamp = Utilities.formatDate(now, 'UTC', 'yyyyMMdd');
  const amzDate   = dateStamp + 'T' + Utilities.formatDate(now, 'UTC', 'HHmmss') + 'Z';
  const region    = creds.awsRegion;

  const payloadHash      = sha256Hex(payload);
  const canonicalHeaders = 'content-type:application/json\nhost:' + host + '\nx-amz-date:' + amzDate + '\n';
  const signedHeaders    = 'content-type;host;x-amz-date';
  const canonicalRequest = [method, path, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const credentialScope  = dateStamp + '/' + region + '/' + service + '/aws4_request';
  const stringToSign     = 'AWS4-HMAC-SHA256\n' + amzDate + '\n' + credentialScope + '\n' + sha256Hex(canonicalRequest);

  const kDate    = hmacSha256Bytes(dateStamp,       Utilities.newBlob('AWS4' + creds.awsSecret).getBytes());
  const kRegion  = hmacSha256Bytes(region,          kDate);
  const kService = hmacSha256Bytes(service,         kRegion);
  const kSigning = hmacSha256Bytes('aws4_request',  kService);
  const sigBytes = hmacSha256Bytes(stringToSign,    kSigning);
  const sig      = sigBytes.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');

  return {
    'Content-Type':  'application/json',
    'X-Amz-Date':    amzDate,
    'Authorization': 'AWS4-HMAC-SHA256 Credential=' + creds.awsKeyId + '/' + credentialScope +
                     ', SignedHeaders=' + signedHeaders + ', Signature=' + sig
  };
}

// ── Bedrock API calls ────────────────────────────────────────────────────────

function queryKnowledgeBase(query) {
  const creds = getCredentials();
  if (!creds.kbId) { Logger.log('BEDROCK_KB_ID not set in Script Properties'); return ''; }

  const host    = 'bedrock-agent-runtime.' + creds.awsRegion + '.amazonaws.com';
  const path    = '/knowledgebases/' + creds.kbId + '/retrieve';
  const payload = JSON.stringify({
    retrievalQuery: { text: query },
    retrievalConfiguration: { vectorSearchConfiguration: { numberOfResults: 3 } }
  });
  const headers = buildAwsHeaders('POST', host, path, payload, creds, 'bedrock');

  try {
    const res  = UrlFetchApp.fetch('https://' + host + path, { method: 'post', headers, payload, muteHttpExceptions: true });
    const data = JSON.parse(res.getContentText());
    if (res.getResponseCode() !== 200) {
      Logger.log('KB query failed (' + res.getResponseCode() + '): ' + res.getContentText());
      return '';
    }
    return (data.retrievalResults || []).map(r => r.content.text).join('\n\n').substring(0, 2000);
  } catch(e) {
    Logger.log('queryKnowledgeBase error: ' + e.message);
    return '';
  }
}

function callBedrock(systemPrompt, userContent, maxTokens) {
  const creds   = getCredentials();
  const host    = 'bedrock-runtime.' + creds.awsRegion + '.amazonaws.com';
  const modelId = creds.modelId;
  const path    = '/model/' + encodeURIComponent(modelId) + '/invoke';

  const messages = Array.isArray(userContent)
    ? [{ role: 'user', content: userContent }]
    : [{ role: 'user', content: [{ type: 'text', text: userContent }] }];

  const payload = JSON.stringify({
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: maxTokens || 600,
    system: systemPrompt,
    messages
  });

  const headers = buildAwsHeaders('POST', host, path, payload, creds, 'bedrock');

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res  = UrlFetchApp.fetch('https://' + host + path, { method: 'post', headers, payload, muteHttpExceptions: true });
      const data = JSON.parse(res.getContentText());
      if (res.getResponseCode() === 429) { Logger.log('Bedrock rate limit, waiting 30s...'); Utilities.sleep(30000); continue; }
      if (res.getResponseCode() !== 200) { Logger.log('Bedrock error (' + res.getResponseCode() + '): ' + res.getContentText()); return null; }
      return data.content[0].text;
    } catch(e) { Logger.log('callBedrock error: ' + e.message); return null; }
  }
  Logger.log('callBedrock: all 3 attempts failed');
  return null;
}

// ── Image fetch helper ───────────────────────────────────────────────────────

function fetchImageAsBase64(url) {
  try {
    const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) { Logger.log('fetchImageAsBase64 failed (' + res.getResponseCode() + '): ' + url); return null; }
    return Utilities.base64Encode(res.getContent());
  } catch(e) { Logger.log('fetchImageAsBase64 error: ' + e.message); return null; }
}

// ── GitHub helpers ───────────────────────────────────────────────────────────

function pushAllToGitHub(files, label) {
  const creds = getCredentials();
  const headers = {
    'Authorization': 'token ' + creds.githubToken,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json'
  };
  const base = 'https://api.github.com/repos/' + GITHUB_REPO;
  try {
    const refRes      = UrlFetchApp.fetch(base + '/git/ref/heads/' + GITHUB_BRANCH, { method: 'GET', headers, muteHttpExceptions: true });
    const latestSha   = JSON.parse(refRes.getContentText()).object.sha;
    const commitRes   = UrlFetchApp.fetch(base + '/git/commits/' + latestSha, { method: 'GET', headers, muteHttpExceptions: true });
    const baseTreeSha = JSON.parse(commitRes.getContentText()).tree.sha;
    const treeItems   = files.map(f => {
      const blobRes = UrlFetchApp.fetch(base + '/git/blobs', { method: 'POST', headers, payload: JSON.stringify({ content: f.content, encoding: 'utf-8' }), muteHttpExceptions: true });
      return { path: f.path, mode: '100644', type: 'blob', sha: JSON.parse(blobRes.getContentText()).sha };
    });
    const treeRes      = UrlFetchApp.fetch(base + '/git/trees', { method: 'POST', headers, payload: JSON.stringify({ base_tree: baseTreeSha, tree: treeItems }), muteHttpExceptions: true });
    const newTreeSha   = JSON.parse(treeRes.getContentText()).sha;
    const commitRes2   = UrlFetchApp.fetch(base + '/git/commits', { method: 'POST', headers, payload: JSON.stringify({ message: 'Sync ' + (label || 'data') + ' — ' + new Date().toLocaleString(), tree: newTreeSha, parents: [latestSha] }), muteHttpExceptions: true });
    const newCommitSha = JSON.parse(commitRes2.getContentText()).sha;
    const updateRes    = UrlFetchApp.fetch(base + '/git/refs/heads/' + GITHUB_BRANCH, { method: 'PATCH', headers, payload: JSON.stringify({ sha: newCommitSha, force: false }), muteHttpExceptions: true });
    if (updateRes.getResponseCode() !== 200) {
      Logger.log('Push failed. Status: ' + updateRes.getResponseCode() + ' — ' + updateRes.getContentText());
      return false;
    }
    return true;
  } catch(e) { Logger.log('pushAllToGitHub error: ' + e.message); return false; }
}

// (v5.24: fetchIndex() removed — the monolithic data/index.json no longer
// exists. Use fetchIndexEntry_(id) / upsertIndexEntry_(id, patch) instead.)

// ── Per-account index (v5.24) ────────────────────────────────────────────────
// data/index/{id}.json — one file per property. Replaces the monolithic
// data/index.json for lookups. Each sync merges only its own view keys, so
// no sync can clobber another's view pointer.

const INDEX_DIR = 'data/index';

// Read a single property's index file. Returns the parsed object, or null
// if it doesn't exist yet (or on error).
function fetchIndexEntry_(id) {
  const creds = getCredentials();
  const headers = { 'Authorization': 'token ' + creds.githubToken, 'Accept': 'application/vnd.github.v3+json' };
  try {
    const res = UrlFetchApp.fetch(
      'https://api.github.com/repos/' + GITHUB_REPO + '/contents/' + INDEX_DIR + '/' + id + '.json',
      { method: 'GET', headers, muteHttpExceptions: true });
    if (res.getResponseCode() === 200) {
      const content = JSON.parse(res.getContentText()).content;
      return JSON.parse(Utilities.newBlob(Utilities.base64Decode(content.replace(/\n/g, ''))).getDataAsString());
    }
  } catch (e) { Logger.log('fetchIndexEntry_ error (' + id + '): ' + e.message); }
  return null;
}

// Deep-merge an index patch onto an existing entry WITHOUT dropping view
// keys the caller doesn't own. Identity fields (name/address/hoa/coords/
// account_type/has_nadir) are overwritten when the patch provides a
// non-empty value; `patch.views` is merged key-by-key on top of the
// existing views. `patch.deleteViews` (array) removes specific view keys
// (used by the Satellite stale sweep, which owns security/wildfire).
// Returns the merged entry (a new object; inputs are not mutated).
function mergeIndexEntry_(existing, patch) {
  const base = existing ? JSON.parse(JSON.stringify(existing)) : {};
  if (!base.views || typeof base.views !== 'object') base.views = {};
  patch = patch || {};
  ['id', 'name', 'address', 'hoa', 'account_type'].forEach(function (k) {
    if (patch[k] !== undefined && patch[k] !== null && patch[k] !== '') base[k] = patch[k];
  });
  if (patch.has_nadir !== undefined) base.has_nadir = patch.has_nadir;
  if (patch.pins_source === '3d') base.pins_source = '3d';
  if (patch.pins_source === 'satellite' && base.pins_source !== '3d') {
    base.pins_source = 'satellite';
  }
  if (typeof patch.lat === 'number' && !isNaN(patch.lat) &&
      typeof patch.lng === 'number' && !isNaN(patch.lng)) {
    base.lat = patch.lat; base.lng = patch.lng;
  }
  if (patch.views && typeof patch.views === 'object') {
    Object.keys(patch.views).forEach(function (v) { base.views[v] = patch.views[v]; });
  }
  if (Array.isArray(patch.deleteViews)) {
    patch.deleteViews.forEach(function (v) { delete base.views[v]; });
  }
  return base;
}

// Build a { path, content } file object for a property's index entry, ready
// to drop into a pushAllToGitHub batch. `id` is stamped into the entry so
// the file is self-identifying.
function buildIndexEntryFile_(id, entry) {
  const e = JSON.parse(JSON.stringify(entry || {}));
  e.id = id;
  if (!e.views || typeof e.views !== 'object') e.views = {};
  return { path: INDEX_DIR + '/' + id + '.json', content: JSON.stringify(e, null, 2) };
}

// List every property id currently present in data/index/ (filenames minus
// the .json extension). Returns [] if the folder doesn't exist yet. Used by
// the Satellite stale sweep to find index files no longer backed by a sheet
// row.
function listIndexIds_() {
  const creds = getCredentials();
  const headers = { 'Authorization': 'token ' + creds.githubToken, 'Accept': 'application/vnd.github.v3+json' };
  const ids = [];
  try {
    const res = UrlFetchApp.fetch(
      'https://api.github.com/repos/' + GITHUB_REPO + '/contents/' + INDEX_DIR,
      { method: 'GET', headers, muteHttpExceptions: true });
    if (res.getResponseCode() === 200) {
      JSON.parse(res.getContentText()).forEach(function (f) {
        if (f.name && f.name.endsWith('.json')) ids.push(f.name.replace('.json', ''));
      });
    }
  } catch (e) { Logger.log('listIndexIds_ error: ' + e.message); }
  return ids;
}

// Hard-delete a single property index file (used by the stale sweep when a
// property's views become empty). Uses the contents API (needs the blob sha).
function deleteIndexEntryFile_(id) {
  const creds = getCredentials();
  const headers = { 'Authorization': 'token ' + creds.githubToken, 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json' };
  const url = 'https://api.github.com/repos/' + GITHUB_REPO + '/contents/' + INDEX_DIR + '/' + id + '.json';
  try {
    const getRes = UrlFetchApp.fetch(url, { method: 'GET', headers, muteHttpExceptions: true });
    if (getRes.getResponseCode() !== 200) return false;
    const sha = JSON.parse(getRes.getContentText()).sha;
    const delRes = UrlFetchApp.fetch(url, {
      method: 'DELETE', headers,
      payload: JSON.stringify({ message: 'Remove stale index entry ' + id, sha: sha }),
      muteHttpExceptions: true });
    const ok = delRes.getResponseCode() === 200;
    if (!ok) Logger.log('deleteIndexEntryFile_ failed (' + id + '): ' + delRes.getResponseCode());
    return ok;
  } catch (e) { Logger.log('deleteIndexEntryFile_ error (' + id + '): ' + e.message); return false; }
}

// THE per-sync primitive. Read a property's existing index file, merge this
// sync's patch onto it (mergeIndexEntry_ only touches the view keys and
// identity fields the patch provides — it never drops another sync's view
// pointer), and return { entry, file }:
//   entry — the merged index object (use entry.views for Intel Links / links)
//   file  — a { path, content } object to add to the pushAllToGitHub batch
// This is the create-or-update: absent file -> fresh entry; present file ->
// merged. Every sheet sync calls this for each property it processes.
function upsertIndexEntry_(id, patch) {
  const merged = mergeIndexEntry_(fetchIndexEntry_(id), patch);
  return { entry: merged, file: buildIndexEntryFile_(id, merged) };
}

// ── Camera metadata (property-level, keyed by index hub id) ──────────────────
// Canonical file: data/cameras/json/{hubId}.json
// Stills (repo, until CloudFront tiles): data/cameras/images/{hubId}/cam-NN.jpg
// Viewers try this path first, then the flat data/cameras/{id}.json, then
// data/cameras/images/json/{id}.json. 404 = no cameras.
//
// Rules:
//   - Key on hashId(slug(site_no)), never a view-record hash.
//   - Never attach cameras[] to a view record (index does not inline it).
//   - Never write data/drone-test/cameras/.
//   - Never nest JSON under data/cameras/images/.
//   - Never invent an empty cameras file.
//   - Repo-relative still URLs are rewritten onto the hub-id image folder.
//     http(s) URLs (CloudFront later) are left alone.
//   - pushAllToGitHub encodes utf-8 text blobs only. JPEG bytes stay in git
//     (or later tiles). Do not PUT stills through this helper.
//   - Plane / satellite sync must not call camerasFileForSync_ — they do
//     not own this file. Drone-test sync is the writer for now.

const CAMERAS_JSON_DIR = 'data/cameras/json';
// Eugene stills and cameras JSON live on the name-hash hub. The site_no hub
// must not publish a second copy — viewers walk CAMERA_HUB_SIBLINGS.
const CAMERAS_JSON_CANONICAL = {
  '8eea64e5c09dc806f667b079e111a38d': '4a484f8c273abef3c02cf91e274f9e2f'
};
function camerasCanonicalId_(propertyId) {
  return CAMERAS_JSON_CANONICAL[propertyId] || propertyId;
}

function githubGetDecodedJson_(repoPath) {
  const creds = getCredentials();
  const headers = {
    'Authorization': 'token ' + creds.githubToken,
    'Accept': 'application/vnd.github.v3+json'
  };
  try {
    const res = UrlFetchApp.fetch(
      'https://api.github.com/repos/' + GITHUB_REPO + '/contents/' + repoPath,
      { method: 'GET', headers, muteHttpExceptions: true });
    const code = res.getResponseCode();
    if (code === 404) return null;
    if (code !== 200) {
      Logger.log('githubGetDecodedJson_ ' + repoPath + ': HTTP ' + code);
      return null;
    }
    const content = JSON.parse(res.getContentText()).content;
    return JSON.parse(
      Utilities.newBlob(Utilities.base64Decode(content.replace(/\n/g, ''))).getDataAsString()
    );
  } catch (e) {
    Logger.log('githubGetDecodedJson_ error (' + repoPath + '): ' + e.message);
    return null;
  }
}

function fetchCamerasRecord_(propertyId) {
  if (!propertyId) return null;
  const paths = [
    CAMERAS_JSON_DIR + '/' + propertyId + '.json',
    'data/cameras/' + propertyId + '.json',
    'data/cameras/images/json/' + propertyId + '.json'
  ];
  for (let i = 0; i < paths.length; i++) {
    const rec = githubGetDecodedJson_(paths[i]);
    if (rec && typeof rec === 'object') return rec;
  }
  return null;
}

function rewriteCameraPhotoUrl_(photo, propertyId) {
  const s = String(photo || '').trim();
  if (!s) return s;
  if (/^https?:\/\//i.test(s)) return s;
  const m = s.match(/(cam-\d+\.(?:jpe?g|png|webp))$/i);
  if (!m) return s;
  let name = m[1].toLowerCase();
  if (name.substring(name.length - 5) === '.jpeg') {
    name = name.substring(0, name.length - 5) + '.jpg';
  }
  return 'data/cameras/images/' + propertyId + '/' + name;
}

function rewriteCamerasRecord_(rec, propertyId) {
  const out = rec && typeof rec === 'object' ? JSON.parse(JSON.stringify(rec)) : {};
  out.property = propertyId;
  const cams = Array.isArray(out.cameras) ? out.cameras : [];
  out.cameras = cams.map(function (c) {
    const cam = c && typeof c === 'object' ? JSON.parse(JSON.stringify(c)) : {};
    if (cam.photo) cam.photo = rewriteCameraPhotoUrl_(cam.photo, propertyId);
    return cam;
  });
  return out;
}

function buildCamerasFile_(propertyId, rec) {
  const body = rewriteCamerasRecord_(rec, propertyId);
  return {
    path: CAMERAS_JSON_DIR + '/' + propertyId + '.json',
    content: JSON.stringify(body, null, 2)
  };
}

// Fetch existing cameras JSON (canonical, then fallbacks). If none, lift a
// leftover cameras[] off fallbackViewPath (an existing GitHub view record)
// so the next view PUT does not silently drop them. Returns a
// { path, content } for pushAllToGitHub, or null when there is nothing to
// publish. Never invents an empty cameras file.
function camerasFileForSync_(propertyId, fallbackViewPath) {
  if (!propertyId) return null;
  const canonical = camerasCanonicalId_(propertyId);
  let rec = fetchCamerasRecord_(canonical);
  if (!rec || !Array.isArray(rec.cameras) || !rec.cameras.length) {
    rec = fetchCamerasRecord_(propertyId);
  }
  if (!rec || !Array.isArray(rec.cameras) || !rec.cameras.length) {
    if (fallbackViewPath) {
      const view = githubGetDecodedJson_(fallbackViewPath);
      if (view && Array.isArray(view.cameras) && view.cameras.length) {
        rec = { property: canonical, cameras: view.cameras };
        Logger.log('camerasFileForSync_: lifted cameras[] from ' + fallbackViewPath);
      }
    }
  }
  if (!rec || !Array.isArray(rec.cameras) || !rec.cameras.length) return null;
  return buildCamerasFile_(canonical, rec);
}

// ── Property-level pins (highest-caliber mapping wins) ───────────────────────
// Canonical file: data/pins/{hubId}.json
// 3D / drone-test / plane writes always replace. Satellite writes are skipped
// when an existing file is source: "3d". Never flatten catalog role=. Never
// invent an empty pins file. Never clamp; validators drop OOB pins first.
const PINS_JSON_DIR = 'data/pins';

function pinsFileForSync_(propertyId, rec) {
  if (!propertyId || !rec || typeof rec !== 'object') return null;
  const incoming = rec.source === '3d' ? '3d' : 'satellite';
  const existing = githubGetDecodedJson_(PINS_JSON_DIR + '/' + propertyId + '.json');
  if (incoming === 'satellite' && existing && existing.source === '3d') {
    Logger.log('pinsFileForSync_: keep 3d pins for ' + propertyId);
    return null;
  }
  const element = Array.isArray(rec.element) ? rec.element : [];
  const concern = Array.isArray(rec.concern) ? rec.concern : [];
  if (!element.length && !concern.length) return null;
  const body = {
    property: propertyId,
    source: incoming,
    element: element,
    concern: concern,
    poi: Array.isArray(rec.poi) ? rec.poi : []
  };
  return {
    path: PINS_JSON_DIR + '/' + propertyId + '.json',
    content: JSON.stringify(body, null, 2)
  };
}

// ── Index hub id (satellite site_no) ─────────────────────────────────────────
// The index filename is ALWAYS hashId(slug(site_no)). Plane / drone-test
// merge a single views.* key onto that file. They must never hash Account
// Name to mint a second hub (that is how "Tracy Residence Drone Test"
// forked Jones into 2dce25a3…). responder-drone record ids stay name-hashed
// and are not resolved here.
//
// Resolution order: explicit site_no on the calling row → unique Satellite
// match by account name → unique Satellite match by address. Ambiguous or
// missing → null (publish the view record, skip the index write).
var satSiteNoIndexCache_ = null;

function satNormKey_(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/^\s+|\s+$/g, '');
}

function loadSatSiteNoIndex_() {
  if (satSiteNoIndexCache_) return satSiteNoIndexCache_;
  const byName = {};
  const byAddr = {};
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SATELLITE_SHEET);
  if (sheet) {
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const siteNo = satValidSiteNo_(data[i][SAT_COL_SITE_NO - 1]);
      if (!siteNo) continue;
      const name = satNormKey_(data[i][SAT_COL_ACCOUNT - 1]);
      const addr = satNormKey_(data[i][SAT_COL_ADDRESS - 1]);
      if (name) {
        if (!byName[name]) byName[name] = [];
        if (byName[name].indexOf(siteNo) === -1) byName[name].push(siteNo);
      }
      if (addr) {
        if (!byAddr[addr]) byAddr[addr] = [];
        if (byAddr[addr].indexOf(siteNo) === -1) byAddr[addr].push(siteNo);
      }
    }
  }
  satSiteNoIndexCache_ = { byName: byName, byAddr: byAddr };
  return satSiteNoIndexCache_;
}

// Append &site_no= to an element-review URL. Address is not unique
// (duplicate lots, placeholders, interim ids); site_no is the sheet key.
// Blank is omitted rather than sent, so a row with no id still falls
// through to &addr= and the API can refuse an ambiguous match in the open.
function withReviewSiteNo_(url, siteNo) {
  const s = String(siteNo || '').trim();
  if (!s) return url;
  return url + '&site_no=' + encodeURIComponent(s);
}

function pickUniqueSiteNo_(list, label) {
  if (!list || !list.length) return '';
  if (list.length === 1) return list[0];
  Logger.log('indexHubId_: ambiguous site_no for ' + label + ' (' + list.join(', ') +
             ') — set Site No on this row');
  return '';
}

function indexHubId_(opts) {
  opts = opts || {};
  const explicit = (typeof satValidSiteNo_ === 'function') ? satValidSiteNo_(opts.siteNo) : '';
  if (explicit) return satPropertyId_(explicit, opts.salt);
  const idx = loadSatSiteNoIndex_();
  let siteNo = pickUniqueSiteNo_(idx.byName[satNormKey_(opts.accountName)],
                                 'name "' + (opts.accountName || '') + '"');
  if (!siteNo) {
    siteNo = pickUniqueSiteNo_(idx.byAddr[satNormKey_(opts.address)],
                               'address "' + (opts.address || '') + '"');
  }
  if (!siteNo) {
    Logger.log('indexHubId_: no unique satellite site_no for "' +
               (opts.accountName || '') + '" — skipping index write');
    return null;
  }
  return satPropertyId_(siteNo, opts.salt);
}

// Existing index files keyed by display name / address. Used by drone-test
// so a row joins the hub that already has this property (Vyanet Eugene →
// 4a484f8c) instead of minting a second file when Satellite site_no is
// missing or ambiguous. Plane still uses indexHubId_ and skips.
var indexNameCache_ = null;

function indexHubScore_(entry) {
  const v = (entry && entry.views) || {};
  let s = 0;
  if (v.security) s += 4;
  if (v.wildfire) s += 4;
  if (v.plane) s += 2;
  if (v.drone) s += 2;
  if (v['drone-test']) s += 1;
  return s;
}

function loadIndexNameCache_() {
  if (indexNameCache_) return indexNameCache_;
  const byName = {};
  const byAddr = {};
  const ids = listIndexIds_();
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    const e = fetchIndexEntry_(id);
    if (!e) continue;
    const n = satNormKey_(e.name);
    const a = satNormKey_(e.address);
    if (n) {
      if (!byName[n]) byName[n] = [];
      byName[n].push({ id: id, entry: e });
    }
    if (a) {
      if (!byAddr[a]) byAddr[a] = [];
      byAddr[a].push({ id: id, entry: e });
    }
  }
  indexNameCache_ = { byName: byName, byAddr: byAddr };
  Logger.log('loadIndexNameCache_: ' + ids.length + ' index files');
  return indexNameCache_;
}

function chooseIndexHub_(list, label) {
  if (!list || !list.length) return null;
  if (list.length === 1) return list[0].id;
  const scored = list.slice().sort(function (a, b) {
    return indexHubScore_(b.entry) - indexHubScore_(a.entry);
  });
  Logger.log('chooseIndexHub_: ' + list.length + ' index files for ' + label +
             ' — using ' + scored[0].id + ' (score ' +
             indexHubScore_(scored[0].entry) + ')');
  return scored[0].id;
}

function pickExistingIndexHub_(accountName, address) {
  const cache = loadIndexNameCache_();
  const byName = chooseIndexHub_(cache.byName[satNormKey_(accountName)],
                                 'name "' + (accountName || '') + '"');
  if (byName) return byName;
  return chooseIndexHub_(cache.byAddr[satNormKey_(address)],
                         'address "' + (address || '') + '"');
}

// Drone-test hub: never skip the index write.
// 1. Existing index file with this property name (or address) — merge.
//    Prefer the hub that already has satellite/plane/drone views when more
//    than one file shares the name (Eugene: 4a484f8c over a drone-test-only
//    stray).
// 2. Else unique satellite site_no (indexHubId_).
// 3. Else mint hashId(slug(name)) and create the file.
// Address match is how "Tracy Residence Drone Test" still joins Jones.
function droneTestHubId_(opts) {
  opts = opts || {};
  const existing = pickExistingIndexHub_(opts.accountName, opts.address);
  if (existing) {
    Logger.log('droneTestHubId_: joining existing index ' + existing +
               ' for "' + (opts.accountName || '') + '"');
    return existing;
  }
  const fromSat = indexHubId_(opts);
  if (fromSat) return fromSat;
  const slug = slugify(opts.accountName);
  if (!slug) {
    Logger.log('droneTestHubId_: empty slug for "' +
               (opts.accountName || '') + '" — cannot mint an index file');
    return null;
  }
  const minted = hashId(slug, opts.salt);
  Logger.log('droneTestHubId_: no index for "' + opts.accountName +
             '" — creating ' + minted);
  return minted;
}

function fetchHoaMap() {
  const creds = getCredentials();
  const headers = { 'Authorization': 'token ' + creds.githubToken, 'Accept': 'application/vnd.github.v3+json' };
  const hoaMap = {};
  try {
    const res = UrlFetchApp.fetch('https://api.github.com/repos/' + GITHUB_REPO + '/contents/data/hoa', { method: 'GET', headers, muteHttpExceptions: true });
    if (res.getResponseCode() === 200) {
      JSON.parse(res.getContentText()).forEach(file => {
        if (file.name.endsWith('.json')) {
          const fr = UrlFetchApp.fetch(file.download_url, { muteHttpExceptions: true });
          if (fr.getResponseCode() === 200) hoaMap[file.name.replace('.json', '')] = JSON.parse(fr.getContentText());
        }
      });
    }
  } catch(e) { Logger.log('fetchHoaMap error: ' + e.message); }
  return hoaMap;
}

function updateIntelLinksSheet(accountName, address, intelLink, views, hoaTag) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(INTEL_LINKS_SHEET);
  if (!sheet) return;
  const data           = sheet.getDataRange().getValues();
  const availableViews = VIEW_ORDER.filter(v => views[v]).map(v => VIEW_LABELS[v]).join(', ');
  const today          = new Date().toLocaleString();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === accountName) {
      sheet.getRange(i + 1, 3).setValue(intelLink);
      sheet.getRange(i + 1, 4).setValue(availableViews);
      sheet.getRange(i + 1, 5).setValue(today);
      sheet.getRange(i + 1, 6).setValue(hoaTag || '');
      return;
    }
  }
  sheet.appendRow([accountName, address, intelLink, availableViews, today, hoaTag || '']);
}

// ── Parcel helpers ───────────────────────────────────────────────────────────

function getParcelFile(lat, lng) {
  const latCell = Math.floor((lat - PARCEL_LAT_MIN) / PARCEL_CELL) * PARCEL_CELL + PARCEL_LAT_MIN;
  const lngCell = Math.floor((lng - PARCEL_LNG_MIN) / PARCEL_CELL) * PARCEL_CELL + PARCEL_LNG_MIN;
  return 'deschutes_' + latCell.toFixed(2) + '_' + lngCell.toFixed(2) + '.geojson';
}

function fetchParcelRing(lat, lng) {
  try {
    const url = PARCEL_BASE + getParcelFile(lat, lng);
    const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) { Logger.log('fetchParcelRing: no tile for ' + lat.toFixed(5) + ',' + lng.toFixed(5)); return null; }
    const geojson = JSON.parse(res.getContentText());
    for (let i = 0; i < geojson.features.length; i++) {
      const coords = geojson.features[i].geometry && geojson.features[i].geometry.coordinates;
      if (!coords || !coords[0]) continue;
      if (pointInPolygon(lat, lng, coords[0])) {
        Logger.log('fetchParcelRing: matched polygon with ' + coords[0].length + ' points');
        return coords[0];
      }
    }
    Logger.log('fetchParcelRing: no polygon matched for ' + lat.toFixed(5) + ',' + lng.toFixed(5));
    return null;
  } catch(e) { Logger.log('fetchParcelRing error: ' + e.message); return null; }
}

function pointInPolygon(lat, lng, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    if (((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}

function filterPinsToParcel(pins, ring) {
  if (ring) {
    pins.forEach(function(pin) {
      const inside = pointInPolygon(pin.lat, pin.lng, ring);
      if (!inside) Logger.log('  Exterior pin (kept): ' + pin.label + ' (' + pin.lat.toFixed(5) + ',' + pin.lng.toFixed(5) + ')');
    });
  }
  return pins;
}

// ── Parcel-fitted image helpers ──────────────────────────────────────────────

function parcelBounds(ring) {
  let minLat =  90, maxLat = -90, minLng = 180, maxLng = -180;
  ring.forEach(function(pt) {
    if (pt[1] < minLat) minLat = pt[1]; if (pt[1] > maxLat) maxLat = pt[1];
    if (pt[0] < minLng) minLng = pt[0]; if (pt[0] > maxLng) maxLng = pt[0];
  });
  return { minLat, maxLat, minLng, maxLng, centerLat: (minLat + maxLat) / 2, centerLng: (minLng + maxLng) / 2 };
}

function zoomForBounds(minLat, maxLat, minLng, maxLng) {
  const IMAGE_SIZE = 640;
  const centerLat  = (minLat + maxLat) / 2;
  const latMeters  = Math.abs(maxLat - minLat) * 110574;
  const lngMeters  = Math.abs(maxLng - minLng) * 111320 * Math.cos(centerLat * Math.PI / 180);
  const maxMeters  = Math.max(latMeters, lngMeters);
  const targetPx   = IMAGE_SIZE * 0.7;
  const mppTarget  = maxMeters / targetPx;
  const metersBase = 156543.03392 * Math.cos(centerLat * Math.PI / 180);
  const zoom       = Math.floor(Math.log2(metersBase / mppTarget));
  return Math.max(17, Math.min(20, zoom));
}

// ── Pin coordinate helpers ───────────────────────────────────────────────────

function clampCoords(x, y) {
  // Named clamp for history. As of 2026-08-28 this only ROUNDS to 0.1 — it
  // does not squeeze into 5..95. Reviewers may pin on the Google Maps basemap
  // outside the cropped nadir (percentages <0 or >100). A silent 5..95 clamp
  // relocated those pins. Keep rounding in lockstep with element-review
  // roundPct().
  return { x: Math.round(Number(x) * 10) / 10, y: Math.round(Number(y) * 10) / 10 };
}

function googleEarthSearchUrl_(address) {
  var q = String(address || '').trim();
  if (!q) return '';
  return 'https://earth.google.com/web/search/' + encodeURIComponent(q);
}

function htmlEscAttr_(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function reviewOpenDialog_(address, reviewUrl) {
  var addr = String(address || '').trim();
  var addrSafe = htmlEscAttr_(addr || 'this row');
  var earth = googleEarthSearchUrl_(addr);
  var buttons =
    '<p style="margin:0 0 14px;display:flex;gap:10px;flex-wrap:wrap">' +
    '<a href="' + htmlEscAttr_(reviewUrl) + '" target="_blank" rel="noopener" ' +
    'style="display:inline-block;background:#ffd23f;color:#1b2027;font-weight:600;' +
    'text-decoration:none;padding:9px 16px;border-radius:8px">Open review page ↗</a>';
  if (earth) {
    buttons +=
      '<a href="' + htmlEscAttr_(earth) + '" target="_blank" rel="noopener" ' +
      'style="display:inline-block;background:#1a73e8;color:#fff;font-weight:600;' +
      'text-decoration:none;padding:9px 16px;border-radius:8px">Google Earth ↗</a>';
  }
  buttons += '</p>';
  var html = HtmlService.createHtmlOutput(
      '<div style="font-family:system-ui,-apple-system,sans-serif;padding:14px 16px;font-size:14px;line-height:1.5">' +
      '<p style="margin:0 0 12px">Element review for<br><b>' + addrSafe + '</b></p>' +
      buttons +
      '<p style="margin:0;color:#667380;font-size:12px">Review pins on the page. Use Google Earth ' +
      'to check the same address at an oblique angle. Tick "Elements Reviewed" when the pins look right.</p></div>')
    .setWidth(440).setHeight(240);
  SpreadsheetApp.getUi().showModalDialog(html, 'Element Review');
}

function pixelToLatLng(centerLat, centerLng, zoom, xPct, yPct) {
  const size   = 640;
  const pixelX = (xPct / 100) * size - size / 2;
  const pixelY = (yPct / 100) * size - size / 2;
  const mpp    = (40075016.686 * Math.cos(centerLat * Math.PI / 180)) / (256 * Math.pow(2, zoom));
  return {
    lat: centerLat - (pixelY * mpp) / 110574,
    lng: centerLng + (pixelX * mpp) / (111320 * Math.cos(centerLat * Math.PI / 180))
  };
}

function buildLatLngPins(items, centerLat, centerLng, zoom, ring) {
  if (!items || !items.length) return [];
  const converted = items.map(function(item) {
    const c = pixelToLatLng(centerLat, centerLng, zoom, item.x, item.y);
    return { label: item.label, lat: parseFloat(c.lat.toFixed(7)), lng: parseFloat(c.lng.toFixed(7)) };
  });
  return filterPinsToParcel(converted, ring);
}

// ── Geocoding ────────────────────────────────────────────────────────────────

function geocodeAddress(address) {
  const creds = getCredentials();
  const res   = UrlFetchApp.fetch(
    'https://maps.googleapis.com/maps/api/geocode/json?address=' + encodeURIComponent(address) + '&key=' + creds.mapsKey,
    { muteHttpExceptions: true }
  );
  const data = JSON.parse(res.getContentText());
  if (data.status === 'OK') return { lat: data.results[0].geometry.location.lat, lng: data.results[0].geometry.location.lng };
  Logger.log('Geocoding failed: ' + address + ' — ' + data.status);
  return null;
}

// ── Utility ──────────────────────────────────────────────────────────────────

function hashId(input, salt) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, input + (salt || ''), Utilities.Charset.UTF_8)
    .map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('').substring(0, 32);
}
function slugify(str) {
  if (!str) return '';
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
function toBullets(desc) {
  if (!desc) return '';
  return desc.split(/\.\s+|\n/).map(s => s.trim()).filter(s => s.length > 2).join('|');
}

function writePlainCell(sheet, row, col, value) {
  const cell = sheet.getRange(row, col);
  cell.setValue(value); cell.setFontLine('none'); cell.setFontColor('#000000'); cell.setFontStyle('normal');
}

function debugAwsCreds() {
  const p = PropertiesService.getScriptProperties();
  ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_REGION'].forEach(function (k) {
    const v = p.getProperty(k) || '';
    Logger.log(k + ': length=' + v.length +
               ' | trimmedLength=' + v.trim().length +
               ' | hasStrayWhitespace=' + (v !== v.trim()) +
               ' | first4=' + v.substring(0, 4));
  });
  const res = callBedrock('You are a test. Reply with exactly: OK', 'ping', 10);
  Logger.log('Bedrock test result: ' + (res === null ? 'FAILED (see error above)' : res));
}

// Read-only Knowledge Base probe. Writes nothing, touches no sheet.
// Run from the editor and read the log. NOTE: no trailing underscore —
// a name ending in _ is private and won't appear in the Run dropdown.
function testKnowledgeBase() {
  const creds = getCredentials();
  Logger.log('BEDROCK_KB_ID = ' + (creds.kbId || '(NOT SET)'));
  Logger.log('AWS_REGION    = ' + creds.awsRegion);
  const t = queryKnowledgeBase(
    'aerial property intelligence property elements structures access vegetation');
  if (!t) {
    Logger.log('RESULT: EMPTY — the KB returned nothing. The real error is the line above.');
    return;
  }
  Logger.log('RESULT: ' + t.length + ' characters returned. First 300:');
  Logger.log(t.substring(0, 300));
}

function testKnowledgeBaseRaw() {
  const creds = getCredentials();
  const host = 'bedrock-agent-runtime.' + creds.awsRegion + '.amazonaws.com';
  const path = '/knowledgebases/' + creds.kbId + '/retrieve';
  const payload = JSON.stringify({
    retrievalQuery: { text: 'property elements structures access vegetation' },
    retrievalConfiguration: { vectorSearchConfiguration: { numberOfResults: 3 } }
  });
  const headers = buildAwsHeaders('POST', host, path, payload, creds, 'bedrock');
  const res = UrlFetchApp.fetch('https://' + host + path,
    { method: 'post', headers, payload, muteHttpExceptions: true });
  const code = res.getResponseCode();
  const text = res.getContentText();
  Logger.log('KB_ID  = ' + creds.kbId);
  Logger.log('REGION = ' + creds.awsRegion);
  Logger.log('HTTP ' + code);
  if (code !== 200) { Logger.log('BODY: ' + text); return; }
  const d = JSON.parse(text);
  const n = (d.retrievalResults || []).length;
  Logger.log('retrievalResults: ' + n);
  if (!n) {
    Logger.log('=> Index reachable, 0 matches. Has the data source finished syncing?');
    return;
  }
  Logger.log('first result (300 chars): ' + d.retrievalResults[0].content.text.substring(0, 300));
}

// One-time: create the Bedrock KB vector index on the OpenSearch managed domain.
// Reuses the same SigV4 signer as the Bedrock calls, but for service 'es'.
function createKbVectorIndex() {
  const creds = getCredentials();
  const host  = 'search-property-intel-vectors-njxy72x3hxcbfbmwjfazqf566y.us-east-1.es.amazonaws.com';
  const path  = '/property-intel-index';
  const body  = JSON.stringify({
    settings: { index: { knn: true, 'knn.algo_param.ef_search': 512 } },
    mappings: { properties: {
      'bedrock-knowledge-base-default-vector': {
        type: 'knn_vector', dimension: 1024,
        method: { name: 'hnsw', engine: 'faiss', space_type: 'l2',
                  parameters: { ef_construction: 128, m: 16 } }
      },
      'AMAZON_BEDROCK_TEXT':     { type: 'text' },
      'AMAZON_BEDROCK_METADATA': { type: 'text', index: false }
    }}
  });
  const headers = buildAwsHeaders('PUT', host, path, body, creds, 'es');
  const res = UrlFetchApp.fetch('https://' + host + path,
    { method: 'put', headers, payload: body, muteHttpExceptions: true });
  Logger.log('HTTP ' + res.getResponseCode());
  Logger.log(res.getContentText());
}