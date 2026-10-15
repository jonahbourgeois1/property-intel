// ============================================================
// PROPERTY INTEL — Apps Script — records.gs
// Published JSON → s3://property-intel-records (CloudFront
// d1h1on7f1v1lpy.cloudfront.net). GitHub Pages data/ stays the live
// reader until a type is cut over.
//
// Long-term: Sheet Sync → records for mothership view JSON (pushAllToRecords_).
// Cameras and GIS are git files (data/cameras, data/gis) — copy those onto
// mothership hubs; do not read the Sheet for them. GitHub data/ is not
// updated by satellite/plane/nearmap/drone-test sync. Drone view JSON
// (data/responder-drone/ and data/drone/) dual-writes GitHub Pages on
// jonahbourgeois1/property-intel so responder-intel.html links stay live.
//
// Hub id is ALWAYS hashId(slug(site_no)) from the Satellite tab.
// Other tabs join that hub via indexHubId_ (explicit site_no, else
// unique Satellite name/address). They never mint a name-hash hub.
// View-record ids keep their own rules (plane name-plane, responder-drone
// frozen name-drone, nearmap = site_no hash).
//
// GitHub hub copy below is leftover from the first bucket fill. Do not
// use it as the architecture. Existence = S3 GET / PUT, never a CDN HEAD.
//
// Contract: docs/RECORDS_CONTRACT.md
// Paste into the editor as a new file, save, AND create a new
// deployment version.
// ============================================================

const RECORDS_KEY_RE =
  /^(_probe|index|satellite|plane|responder-drone|drone|drone-test|nearmap|interior|cameras|gis|pins|hoa)\/[A-Za-z0-9._-]+\.json$/;
// SAFE panels live one level deeper than the other records prefixes.
const RECORDS_SAFE_KEY_RE =
  /^safe\/[a-f0-9]{32}\/(report\.json|s\.jpg|a\.jpg|f\.jpg|e\.jpg)$/;
// Camera scans sit beside SAFE. The runner does not get an AWS key.
const RECORDS_SCAN_KEY_RE =
  /^camera-scans\/[a-f0-9]{32}\/[0-9]+\/[0-9]{8}T[0-9]{9}Z\.(jpg|json)$/;
// Clock state. Not under camera-scans/, so the 7-day lifecycle does not remove it.
const RECORDS_SCAN_STATE_KEY_RE =
  /^camera-scan-state\/[a-f0-9]{32}\.json$/;
// Patrol schedule. Not under camera-scans/, so the 7-day lifecycle does not remove it.
const RECORDS_PATROL_KEY_RE =
  /^camera-scan-patrol\/[a-f0-9]{32}\.json$/;
// Notes index. Not under camera-scans/, so the 7-day lifecycle does not remove it.
const RECORDS_NOTES_KEY_RE =
  /^camera-scan-notes\/[a-f0-9]{32}\.json$/;
// Live events. Separate from camera-scans/. A 7-day rule on camera-live/ does not match camera-watch/.
const RECORDS_LIVE_KEY_RE =
  /^camera-live\/[a-f0-9]{32}\/[0-9]+\/[0-9]{8}T[0-9]{9}Z\.(jpg|mp4|json)$/;
const RECORDS_WATCH_KEY_RE =
  /^camera-watch\/[a-f0-9]{32}\.json$/;
// Orders and finished clips for the task. Not under camera-live/, so the 7-day rule does not expire it.
const RECORDS_STATION_KEY_RE =
  /^camera-station\/[a-f0-9]{32}\.json$/;
// Property profile. Not under camera-scans/ or camera-live/, so the 7-day lifecycle does not remove it.
const RECORDS_PROFILE_KEY_RE =
  /^property-profile\/[a-f0-9]{32}\.json$/;
const RECORDS_PATROL_QA = { bronze: 12, silver: 24, gold: 48, platinum: 96 };

const RECORDS_VIEW_TO_FILES = {
  security: 'satellite',
  wildfire: 'satellite',
  plane: 'plane',
  drone: 'drone',
  'drone-test': 'drone-test',
  nearmap: 'nearmap',
  interior: 'interior'
};

const RECORDS_FILES_PREFIX = {
  satellite: 'satellite/',
  plane: 'plane/',
  drone: 'responder-drone/',
  'drone-test': 'drone-test/',
  nearmap: 'nearmap/',
  interior: 'interior/',
  cameras: 'cameras/',
  gis: 'gis/',
  pins: 'pins/',
  hoa: 'hoa/',
  safe: 'safe/'
};

const RECORDS_FILES_GITHUB_DIR = {
  satellite: 'data/satellite',
  plane: 'data/plane',
  drone: 'data/responder-drone',
  'drone-test': 'data/drone-test',
  nearmap: 'data/nearmap',
  interior: 'data/interior'
};
// Own literals — do not read GIS_JSON_DIR / PINS_JSON_DIR from shared.gs.
// Those consts landed in a later shared.gs than some editor copies.
const RECORDS_GH_GIS = 'data/gis';
const RECORDS_GH_PINS = 'data/pins';
const RECORDS_GH_CAMERAS = 'data/cameras/json';
const RECORDS_GH_HOA = 'data/hoa';

function recordsAssertKey_(key) {
  const k = String(key || '');
  if (RECORDS_KEY_RE.test(k) || RECORDS_SAFE_KEY_RE.test(k) || RECORDS_SCAN_KEY_RE.test(k) || RECORDS_SCAN_STATE_KEY_RE.test(k) || RECORDS_PATROL_KEY_RE.test(k) || RECORDS_NOTES_KEY_RE.test(k) || RECORDS_LIVE_KEY_RE.test(k) || RECORDS_WATCH_KEY_RE.test(k) || RECORDS_STATION_KEY_RE.test(k) || RECORDS_PROFILE_KEY_RE.test(k)) return k;
  throw new Error('records: refused S3 key "' + k + '"');
}

function recordsProfileKeyAllowed_() {
  return RECORDS_PROFILE_KEY_RE.test('property-profile/d9f759d7351db3886c79dd689c41e3c0.json');
}

function recordsS3Transient_(err) {
  const m = String((err && err.message) || err || '');
  if (/Address unavailable/i.test(m)) return true;
  if (/DNS|timed out|Timeout|Unexpected error/i.test(m)) return true;
  if (/HTTP 500|HTTP 503|HTTP 429/i.test(m)) return true;
  if (/SlowDown|ServiceUnavailable|InternalError|RequestTimeout/i.test(m)) return true;
  return false;
}

function recordsS3Retry_(label, fn) {
  const max = 4;
  let last = null;
  for (let a = 1; a <= max; a++) {
    try {
      return fn();
    } catch (e) {
      last = e;
      if (a === max || !recordsS3Transient_(e)) throw e;
      Logger.log('records S3 retry ' + a + '/' + max + ' ' + label + ' — ' + e.message);
      Utilities.sleep(500 * a * a);
    }
  }
  throw last;
}

function recordsS3PutObject_(key, body, contentType) {
  return recordsS3Retry_('PUT ' + key, function () {
    return recordsS3PutOnce_(key, body, contentType);
  });
}

function recordsS3PutOnce_(key, body, contentType, match) {
  const creds = getCredentials();
  if (!creds.awsKeyId || !creds.awsSecret) {
    throw new Error('AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY not set in Script Properties');
  }
  const k = recordsAssertKey_(key);
  const region = 'us-east-1';
  const service = 's3';
  const host = RECORDS_S3_HOST;
  const path = '/' + k.split('/').map(encodeURIComponent).join('/');
  const now = new Date();
  const dateStamp = Utilities.formatDate(now, 'UTC', 'yyyyMMdd');
  const amzDate = dateStamp + 'T' + Utilities.formatDate(now, 'UTC', 'HHmmss') + 'Z';
  const payloadHash = sha256Hex(body);
  const ctype = contentType || 'application/json';
  // match is omitted by every existing caller. The signed headers stay the same in that case.
  const matchName = match && match.ifMatch ? 'if-match' : (match && match.ifNoneMatch ? 'if-none-match' : '');
  const matchValue = matchName === 'if-match' ? match.ifMatch : (matchName ? match.ifNoneMatch : '');
  const canonLines = [
    'cache-control:no-cache',
    'content-type:' + ctype,
    'host:' + host
  ];
  if (matchName) canonLines.push(matchName + ':' + matchValue);
  canonLines.push('x-amz-content-sha256:' + payloadHash);
  canonLines.push('x-amz-date:' + amzDate);
  const canonicalHeaders = canonLines.join('\n') + '\n';
  const signedHeaders = 'cache-control;content-type;host;' + (matchName ? matchName + ';' : '') + 'x-amz-content-sha256;x-amz-date';
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
  if (matchName) headers[matchName === 'if-match' ? 'If-Match' : 'If-None-Match'] = matchValue;
  const res = UrlFetchApp.fetch('https://' + host + path, {
    method: 'put', headers, contentType: ctype, payload: body, muteHttpExceptions: true
  });
  const code = res.getResponseCode();
  if (code === 412) throw new Error('S3 PUT precondition HTTP 412');
  if (code !== 200) {
    const txt = res.getContentText();
    const m = txt.match(/<Code>([^<]+)<\/Code>[\s\S]*?<Message>([^<]+)<\/Message>/);
    throw new Error('S3 PUT ' + k + ' → HTTP ' + code + (m ? (': ' + m[1] + ' — ' + m[2]) : (': ' + txt.substring(0, 200))));
  }
  return { key: k, etag: recordsS3Etag_(res.getHeaders()) };
}

function recordsS3Etag_(headers) {
  headers = headers || {};
  let raw = '';
  Object.keys(headers).forEach(function (name) {
    if (String(name).toLowerCase() === 'etag' && !raw) raw = String(headers[name] || '').trim();
  });
  if (!raw) return '';
  raw = raw.split(',')[0].trim();
  if (raw.charAt(0) === '"' || raw.indexOf('W/') === 0) return raw;
  return '"' + raw + '"';
}

function recordsSha256HexBytes_(bytes) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes)
    .map(function (b) { return ('0' + (b & 0xFF).toString(16)).slice(-2); }).join('');
}

function recordsS3PutBytes_(key, bytes, contentType) {
  return recordsS3Retry_('PUT ' + key, function () {
    return recordsS3PutBytesOnce_(key, bytes, contentType);
  });
}

function recordsS3PutBytesOnce_(key, bytes, contentType) {
  const creds = getCredentials();
  if (!creds.awsKeyId || !creds.awsSecret) {
    throw new Error('AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY not set in Script Properties');
  }
  const k = recordsAssertKey_(key);
  const region = 'us-east-1';
  const service = 's3';
  const host = RECORDS_S3_HOST;
  const path = '/' + k.split('/').map(encodeURIComponent).join('/');
  const now = new Date();
  const dateStamp = Utilities.formatDate(now, 'UTC', 'yyyyMMdd');
  const amzDate = dateStamp + 'T' + Utilities.formatDate(now, 'UTC', 'HHmmss') + 'Z';
  const payloadHash = recordsSha256HexBytes_(bytes);
  const ctype = contentType || 'application/octet-stream';
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
  const sig = hmacSha256Bytes(stringToSign, kSigning).map(function (b) { return ('0' + (b & 0xFF).toString(16)).slice(-2); }).join('');
  const headers = {
    'Cache-Control': 'no-cache',
    'X-Amz-Content-Sha256': payloadHash,
    'X-Amz-Date': amzDate,
    'Authorization': 'AWS4-HMAC-SHA256 Credential=' + creds.awsKeyId + '/' + credentialScope +
      ', SignedHeaders=' + signedHeaders + ', Signature=' + sig
  };
  const res = UrlFetchApp.fetch('https://' + host + path, {
    method: 'put', headers: headers, contentType: ctype, payload: bytes, muteHttpExceptions: true
  });
  const code = res.getResponseCode();
  if (code !== 200) {
    const txt = res.getContentText();
    const m = txt.match(/<Code>([^<]+)<\/Code>[\s\S]*?<Message>([^<]+)<\/Message>/);
    throw new Error('S3 PUT ' + k + ' → HTTP ' + code + (m ? (': ' + m[1] + ' — ' + m[2]) : (': ' + txt.substring(0, 200))));
  }
  return { key: k, etag: res.getHeaders()['ETag'] || res.getHeaders()['Etag'] || '' };
}

function recordsS3GetObject_(key) {
  return recordsS3Retry_('GET ' + key, function () {
    return recordsS3GetOnce_(key);
  });
}

function recordsS3GetTextMeta_(key) {
  return recordsS3GetOnce_(key, true);
}

function recordsS3GetOnce_(key, withEtag) {
  const creds = getCredentials();
  if (!creds.awsKeyId || !creds.awsSecret) {
    throw new Error('AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY not set in Script Properties');
  }
  const k = recordsAssertKey_(key);
  const region = 'us-east-1';
  const service = 's3';
  const host = RECORDS_S3_HOST;
  const path = '/' + k.split('/').map(encodeURIComponent).join('/');
  const now = new Date();
  const dateStamp = Utilities.formatDate(now, 'UTC', 'yyyyMMdd');
  const amzDate = dateStamp + 'T' + Utilities.formatDate(now, 'UTC', 'HHmmss') + 'Z';
  const payloadHash = sha256Hex('');
  const canonicalHeaders =
    'host:' + host + '\n' +
    'x-amz-content-sha256:' + payloadHash + '\n' +
    'x-amz-date:' + amzDate + '\n';
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = ['GET', path, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const credentialScope = dateStamp + '/' + region + '/' + service + '/aws4_request';
  const stringToSign = 'AWS4-HMAC-SHA256\n' + amzDate + '\n' + credentialScope + '\n' + sha256Hex(canonicalRequest);
  const kDate = hmacSha256Bytes(dateStamp, Utilities.newBlob('AWS4' + creds.awsSecret).getBytes());
  const kRegion = hmacSha256Bytes(region, kDate);
  const kService = hmacSha256Bytes(service, kRegion);
  const kSigning = hmacSha256Bytes('aws4_request', kService);
  const sig = hmacSha256Bytes(stringToSign, kSigning).map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
  const headers = {
    'X-Amz-Content-Sha256': payloadHash,
    'X-Amz-Date': amzDate,
    'Authorization': 'AWS4-HMAC-SHA256 Credential=' + creds.awsKeyId + '/' + credentialScope +
      ', SignedHeaders=' + signedHeaders + ', Signature=' + sig
  };
  const res = UrlFetchApp.fetch('https://' + host + path, {
    method: 'get', headers, muteHttpExceptions: true
  });
  const code = res.getResponseCode();
  if (code === 404) return null;
  if (code === 403) {
    const txt403 = res.getContentText();
    if (/<Code>NoSuchKey<\/Code>/.test(txt403)) return null;
  }
  if (code !== 200) {
    const txt = res.getContentText();
    const m = txt.match(/<Code>([^<]+)<\/Code>[\s\S]*?<Message>([^<]+)<\/Message>/);
    throw new Error('S3 GET ' + k + ' → HTTP ' + code + (m ? (': ' + m[1] + ' — ' + m[2]) : (': ' + txt.substring(0, 200))));
  }
  if (withEtag) return { text: res.getContentText(), etag: recordsS3Etag_(res.getHeaders()) };
  return res.getContentText();
}

function recordsS3GetBytes_(key) {
  return recordsS3Retry_('GET ' + key, function () {
    return recordsS3GetBytesOnce_(key);
  });
}

function recordsS3GetBytesOnce_(key) {
  const creds = getCredentials();
  if (!creds.awsKeyId || !creds.awsSecret) {
    throw new Error('AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY not set in Script Properties');
  }
  const k = recordsAssertKey_(key);
  const region = 'us-east-1';
  const service = 's3';
  const host = RECORDS_S3_HOST;
  const path = '/' + k.split('/').map(encodeURIComponent).join('/');
  const now = new Date();
  const dateStamp = Utilities.formatDate(now, 'UTC', 'yyyyMMdd');
  const amzDate = dateStamp + 'T' + Utilities.formatDate(now, 'UTC', 'HHmmss') + 'Z';
  const payloadHash = sha256Hex('');
  const canonicalHeaders =
    'host:' + host + '\n' +
    'x-amz-content-sha256:' + payloadHash + '\n' +
    'x-amz-date:' + amzDate + '\n';
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = ['GET', path, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const credentialScope = dateStamp + '/' + region + '/' + service + '/aws4_request';
  const stringToSign = 'AWS4-HMAC-SHA256\n' + amzDate + '\n' + credentialScope + '\n' + sha256Hex(canonicalRequest);
  const kDate = hmacSha256Bytes(dateStamp, Utilities.newBlob('AWS4' + creds.awsSecret).getBytes());
  const kRegion = hmacSha256Bytes(region, kDate);
  const kService = hmacSha256Bytes(service, kRegion);
  const kSigning = hmacSha256Bytes('aws4_request', kService);
  const sig = hmacSha256Bytes(stringToSign, kSigning).map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
  const headers = {
    'X-Amz-Content-Sha256': payloadHash,
    'X-Amz-Date': amzDate,
    'Authorization': 'AWS4-HMAC-SHA256 Credential=' + creds.awsKeyId + '/' + credentialScope +
      ', SignedHeaders=' + signedHeaders + ', Signature=' + sig
  };
  const res = UrlFetchApp.fetch('https://' + host + path, {
    method: 'get', headers: headers, muteHttpExceptions: true
  });
  const code = res.getResponseCode();
  if (code === 404) return null;
  if (code === 403) {
    const txt403 = res.getContentText();
    if (/<Code>NoSuchKey<\/Code>/.test(txt403) || txt403 === '') return null;
  }
  if (code !== 200) {
    const txt = res.getContentText();
    const m = txt.match(/<Code>([^<]+)<\/Code>[\s\S]*?<Message>([^<]+)<\/Message>/);
    throw new Error('S3 GET ' + k + ' → HTTP ' + code + (m ? (': ' + m[1] + ' — ' + m[2]) : (': ' + txt.substring(0, 200))));
  }
  return res.getContent();
}

function recordsPutJson_(key, obj) {
  const body = JSON.stringify(obj, null, 2);
  return recordsS3PutObject_(key, body, 'application/json');
}

function recordsFetchJson_(key) {
  const txt = recordsS3GetObject_(key);
  if (txt === null) return null;
  try {
    return JSON.parse(txt);
  } catch (e) {
    throw new Error('records: ' + key + ' is not JSON');
  }
}

// One camera folder. The script key needs s3:ListBucket on the records bucket,
// limited to prefix camera-scans/. This is not a public catalog object.
function recordsS3EncodeQuery_(params) {
  return Object.keys(params).sort().map(function (name) {
    return encodeURIComponent(name) + '=' + encodeURIComponent(String(params[name]));
  }).join('&');
}

function recordsXmlUnescape_(s) {
  return String(s || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
}

function recordsAssertScanPrefix_(prefix) {
  if (!/^camera-scans\/[a-f0-9]{32}\/[0-9]+\/$/.test(prefix)) {
    throw new Error('records: refused list prefix');
  }
  return prefix;
}

function recordsS3ListRequest_(params) {
  const creds = getCredentials();
  if (!creds.awsKeyId || !creds.awsSecret) {
    throw new Error('AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY not set in Script Properties');
  }
  const region = 'us-east-1';
  const service = 's3';
  const host = RECORDS_S3_HOST;
  const query = recordsS3EncodeQuery_(params);
  const now = new Date();
  const dateStamp = Utilities.formatDate(now, 'UTC', 'yyyyMMdd');
  const amzDate = dateStamp + 'T' + Utilities.formatDate(now, 'UTC', 'HHmmss') + 'Z';
  const payloadHash = sha256Hex('');
  const canonicalHeaders =
    'host:' + host + '\n' +
    'x-amz-content-sha256:' + payloadHash + '\n' +
    'x-amz-date:' + amzDate + '\n';
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = ['GET', '/', query, canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const credentialScope = dateStamp + '/' + region + '/' + service + '/aws4_request';
  const stringToSign = 'AWS4-HMAC-SHA256\n' + amzDate + '\n' + credentialScope + '\n' + sha256Hex(canonicalRequest);
  const kDate = hmacSha256Bytes(dateStamp, Utilities.newBlob('AWS4' + creds.awsSecret).getBytes());
  const kRegion = hmacSha256Bytes(region, kDate);
  const kService = hmacSha256Bytes(service, kRegion);
  const kSigning = hmacSha256Bytes('aws4_request', kService);
  const sig = hmacSha256Bytes(stringToSign, kSigning).map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
  return {
    url: 'https://' + host + '/?' + query,
    method: 'get',
    muteHttpExceptions: true,
    headers: {
      'X-Amz-Content-Sha256': payloadHash,
      'X-Amz-Date': amzDate,
      'Authorization': 'AWS4-HMAC-SHA256 Credential=' + creds.awsKeyId + '/' + credentialScope +
        ', SignedHeaders=' + signedHeaders + ', Signature=' + sig
    }
  };
}

function recordsS3ListText_(res) {
  const code = res.getResponseCode();
  const txt = res.getContentText();
  if (code !== 200) {
    const m = txt.match(/<Code>([^<]+)<\/Code>[\s\S]*?<Message>([^<]+)<\/Message>/);
    throw new Error('S3 LIST → HTTP ' + code + (m ? (': ' + m[1] + ' — ' + m[2]) : (': ' + txt.substring(0, 200))));
  }
  return txt;
}

function recordsS3KeysFromListXml_(xml, prefix) {
  const keys = [];
  const found = xml.match(/<Key>[^<]+<\/Key>/g) || [];
  for (let i = 0; i < found.length; i++) {
    const k = recordsXmlUnescape_(found[i].slice(5, -6));
    if (!/\.jpg$/.test(k)) continue;
    if (k.indexOf(prefix) !== 0) continue;
    keys.push(k.replace(/\.jpg$/, '.json'));
  }
  const next = xml.match(/<NextContinuationToken>([^<]*)<\/NextContinuationToken>/);
  return {
    keys: keys,
    truncated: /<IsTruncated>true<\/IsTruncated>/.test(xml),
    token: next ? recordsXmlUnescape_(next[1]) : ''
  };
}

function recordsS3FinishKeys_(keys) {
  keys.sort();
  keys.reverse();
  return keys.slice(0, 500);
}

function recordsS3ListPrefix_(prefix) {
  recordsAssertScanPrefix_(prefix);
  const keys = [];
  let token = '';
  for (let page = 0; page < 5 && keys.length < 500; page++) {
    const params = { 'list-type': '2', 'max-keys': '1000', prefix: prefix };
    if (token) params['continuation-token'] = token;
    const req = recordsS3ListRequest_(params);
    const xml = recordsS3ListText_(UrlFetchApp.fetch(req.url, req));
    const pageKeys = recordsS3KeysFromListXml_(xml, prefix);
    keys.push.apply(keys, pageKeys.keys);
    if (!pageKeys.truncated || !pageKeys.token) break;
    token = pageKeys.token;
  }
  return recordsS3FinishKeys_(keys);
}

// One round trip for every camera folder. Used by the scan viewer.
function recordsS3ListPrefixes_(prefixes) {
  const list = prefixes || [];
  if (!list.length) return [];
  const requests = list.map(function (prefix) {
    recordsAssertScanPrefix_(prefix);
    return recordsS3ListRequest_({ 'list-type': '2', 'max-keys': '1000', prefix: prefix });
  });
  const responses = UrlFetchApp.fetchAll(requests);
  const out = [];
  for (let i = 0; i < responses.length; i++) {
    const xml = recordsS3ListText_(responses[i]);
    const pageKeys = recordsS3KeysFromListXml_(xml, list[i]);
    if (pageKeys.truncated && pageKeys.token) out.push(recordsS3ListPrefix_(list[i]));
    else out.push(recordsS3FinishKeys_(pageKeys.keys));
  }
  return out;
}

function recordsS3HeadObject_(key) {
  return recordsS3Retry_('EXISTS ' + key, function () {
    return recordsS3HeadOnce_(key);
  });
}

// UrlFetchApp rejects method "head". Probe the S3 host with a signed GET of
// the first byte. 200, 206, and 416 mean the key exists. This is not a CloudFront request.
function recordsS3HeadOnce_(key) {
  const creds = getCredentials();
  if (!creds.awsKeyId || !creds.awsSecret) {
    throw new Error('AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY not set in Script Properties');
  }
  const k = recordsAssertKey_(key);
  const region = 'us-east-1';
  const service = 's3';
  const host = RECORDS_S3_HOST;
  const path = '/' + k.split('/').map(encodeURIComponent).join('/');
  const now = new Date();
  const dateStamp = Utilities.formatDate(now, 'UTC', 'yyyyMMdd');
  const amzDate = dateStamp + 'T' + Utilities.formatDate(now, 'UTC', 'HHmmss') + 'Z';
  const payloadHash = sha256Hex('');
  const canonicalHeaders =
    'host:' + host + '\n' +
    'range:bytes=0-0\n' +
    'x-amz-content-sha256:' + payloadHash + '\n' +
    'x-amz-date:' + amzDate + '\n';
  const signedHeaders = 'host;range;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = ['GET', path, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const credentialScope = dateStamp + '/' + region + '/' + service + '/aws4_request';
  const stringToSign = 'AWS4-HMAC-SHA256\n' + amzDate + '\n' + credentialScope + '\n' + sha256Hex(canonicalRequest);
  const kDate = hmacSha256Bytes(dateStamp, Utilities.newBlob('AWS4' + creds.awsSecret).getBytes());
  const kRegion = hmacSha256Bytes(region, kDate);
  const kService = hmacSha256Bytes(service, kRegion);
  const kSigning = hmacSha256Bytes('aws4_request', kService);
  const sig = hmacSha256Bytes(stringToSign, kSigning).map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
  const headers = {
    'Range': 'bytes=0-0',
    'X-Amz-Content-Sha256': payloadHash,
    'X-Amz-Date': amzDate,
    'Authorization': 'AWS4-HMAC-SHA256 Credential=' + creds.awsKeyId + '/' + credentialScope +
      ', SignedHeaders=' + signedHeaders + ', Signature=' + sig
  };
  const res = UrlFetchApp.fetch('https://' + host + path, {
    method: 'get', headers: headers, muteHttpExceptions: true
  });
  const code = res.getResponseCode();
  if (code === 200 || code === 206 || code === 416) return true;
  if (code === 404) return false;
  if (code === 403) {
    const txt403 = res.getContentText();
    if (/<Code>NoSuchKey<\/Code>/.test(txt403) || txt403 === '') return false;
  }
  const txt = res.getContentText();
  const m = txt.match(/<Code>([^<]+)<\/Code>[\s\S]*?<Message>([^<]+)<\/Message>/);
  throw new Error('S3 EXISTS ' + k + ' → HTTP ' + code + (m ? (': ' + m[1] + ' — ' + m[2]) : (': ' + txt.substring(0, 200))));
}

function recordsSafeKeys_(hubId) {
  const prefix = 'safe/' + hubId + '/';
  return {
    report: prefix + 'report.json',
    S: prefix + 's.jpg',
    A: prefix + 'a.jpg',
    F: prefix + 'f.jpg',
    E: prefix + 'e.jpg'
  };
}

// Resolve a tasked row to one mothership hub and the five SAFE keys.
// Order matches indexHubId_: explicit site_no, else unique Satellite account
// name, else unique Satellite address. A supplied 32-hex hub is accepted
// only when it equals satPropertyId_ of the site_no on that index.
function recordsSafeDest_(opts) {
  opts = opts || {};
  const creds = getCredentials();
  const salt = creds.hashSalt;
  let siteNo = (typeof satValidSiteNo_ === 'function') ? satValidSiteNo_(opts.site_no || opts.siteNo) : '';
  let hubId = '';
  let match = '';
  if (siteNo) {
    hubId = satPropertyId_(siteNo, salt);
    match = 'site_no';
  } else if (opts.hub && /^[a-f0-9]{32}$/.test(String(opts.hub))) {
    const supplied = String(opts.hub);
    const idx = recordsFetchJson_('index/' + supplied + '.json');
    if (!idx) return { ok: false, error: 'no index for hub ' + supplied };
    siteNo = (typeof satValidSiteNo_ === 'function') ? satValidSiteNo_(idx.site_no) : '';
    if (!siteNo) {
      return { ok: false, error: 'index has no site_no — refusing name-hash hub ' + supplied };
    }
    hubId = satPropertyId_(siteNo, salt);
    if (hubId !== supplied) {
      return { ok: false, error: 'hub does not match site_no hash', supplied: supplied, hubId: hubId, site_no: siteNo };
    }
    match = 'hub';
  } else {
    const found = recordsSafeLookup_(opts.name || opts.accountName, opts.address, salt);
    if (!found.ok) return found;
    siteNo = found.site_no;
    hubId = found.hubId;
    match = found.via;
  }
  if (!hubId) return { ok: false, error: 'site_no did not hash' };
  const keys = recordsSafeKeys_(hubId);
  const index = recordsFetchJson_(recordsIndexKey_(hubId));
  const reportExists = recordsS3HeadObject_(keys.report);
  return {
    ok: true,
    route: 'safe-dest',
    action: reportExists ? 'place' : 'create',
    match: match,
    hubId: hubId,
    site_no: (index && index.site_no) || siteNo,
    name: (index && index.name) || opts.name || opts.accountName || '',
    address: (index && index.address) || opts.address || '',
    bucket: 'property-intel-records',
    region: 'us-east-1',
    prefix: 'safe/' + hubId + '/',
    keys: keys,
    index_exists: !!index,
    report_exists: !!reportExists
  };
}

function recordsSafeLookup_(name, address, salt) {
  const idx = loadSatSiteNoIndex_();
  const byName = idx.byName[satNormKey_(name)] || [];
  const byAddr = idx.byAddr[satNormKey_(address)] || [];
  let siteNo = '';
  let via = '';
  if (byName.length === 1) {
    siteNo = byName[0];
    via = 'name';
  } else if (byAddr.length === 1) {
    siteNo = byAddr[0];
    via = 'address';
  } else if (byName.length > 1) {
    return { ok: false, error: 'ambiguous account name', site_nos: byName };
  } else if (byAddr.length > 1) {
    return { ok: false, error: 'ambiguous address', site_nos: byAddr };
  } else {
    return { ok: false, error: 'no Satellite row for that name or address' };
  }
  return { ok: true, site_no: siteNo, via: via, hubId: satPropertyId_(siteNo, salt) };
}

// One panel or the report JSON, posted by the bot. The script writes S3.
// The bot does not receive AWS credentials. part is report, S, A, F, or E.
function recordsSafePut_(opts) {
  opts = opts || {};
  const part = String(opts.part || '').trim();
  if (part !== 'report' && part !== 'S' && part !== 'A' && part !== 'F' && part !== 'E') {
    return { ok: false, error: 'part must be report, S, A, F, or E' };
  }
  const dest = recordsSafeDest_(opts);
  if (!dest.ok) return dest;
  const key = dest.keys[part];
  if (part === 'report') {
    let obj = opts.report;
    if (!obj && opts.body) {
      try { obj = JSON.parse(opts.body); }
      catch (e) { return { ok: false, error: 'report body is not JSON' }; }
    }
    if (!obj || typeof obj !== 'object') return { ok: false, error: 'report object required' };
    if (obj.schema !== 'property-intel-records/safe-report-v1') {
      return { ok: false, error: 'schema must be property-intel-records/safe-report-v1' };
    }
    obj.id = dest.hubId;
    obj.images = { S: dest.keys.S, A: dest.keys.A, F: dest.keys.F, E: dest.keys.E };
    const put = recordsPutJson_(key, obj);
    return { ok: true, route: 'safe-put', part: part, key: key, hubId: dest.hubId, etag: put.etag };
  }
  const b64 = String(opts.body_base64 || '').replace(/\s+/g, '');
  if (!b64) return { ok: false, error: 'body_base64 required' };
  let bytes;
  try { bytes = Utilities.base64Decode(b64); }
  catch (e) { return { ok: false, error: 'body_base64 is not base64' }; }
  if (!bytes || bytes.length < 100) return { ok: false, error: 'jpeg too small' };
  if (bytes.length > 12 * 1024 * 1024) return { ok: false, error: 'jpeg over 12MB' };
  if ((bytes[0] & 0xFF) !== 0xFF || (bytes[1] & 0xFF) !== 0xD8) {
    return { ok: false, error: 'not a jpeg' };
  }
  const put = recordsS3PutBytes_(key, bytes, 'image/jpeg');
  return {
    ok: true, route: 'safe-put', part: part, key: key, hubId: dest.hubId,
    bytes: bytes.length, etag: put.etag
  };
}

// SAFE hub only. A Chekt name-hash is refused when it does not match site_no.
function recordsScanHub_(hubId) {
  const hub = String(hubId || '').trim().toLowerCase();
  if (!/^[a-f0-9]{32}$/.test(hub)) return { ok: false, error: 'hub must be 32 hex' };
  const cache = CacheService.getScriptCache();
  if (cache.get('scan-hub:' + hub) === 'ok') return { ok: true, hubId: hub };
  const idx = recordsFetchJson_('index/' + hub + '.json');
  if (!idx) return { ok: false, error: 'no index for hub ' + hub };
  const siteNo = (typeof satValidSiteNo_ === 'function') ? satValidSiteNo_(idx.site_no) : '';
  if (!siteNo) return { ok: false, error: 'index has no site_no — refusing name-hash hub ' + hub };
  const creds = getCredentials();
  const expect = satPropertyId_(siteNo, creds.hashSalt);
  if (expect !== hub) {
    return { ok: false, error: 'hub does not match site_no hash', supplied: hub, hubId: expect, site_no: siteNo };
  }
  cache.put('scan-hub:' + hub, 'ok', 600);
  return { ok: true, hubId: hub, site_no: siteNo };
}

function recordsScanStamp_(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{3})Z$/);
  if (!m) return '';
  return m[1] + m[2] + m[3] + 'T' + m[4] + m[5] + m[6] + m[7] + 'Z';
}

// One JPEG or one JSON. The script writes S3. description and reviewed_at
// stay empty here; the bot overwrite is a later route.
function recordsScanPut_(opts) {
  opts = opts || {};
  const part = String(opts.part || '').trim();
  if (part !== 'jpeg' && part !== 'json') return { ok: false, error: 'part must be jpeg or json' };
  const dest = recordsScanHub_(opts.hub);
  if (!dest.ok) return dest;
  const device = String(opts.device_id || '').trim();
  if (!/^[0-9]{1,16}$/.test(device)) return { ok: false, error: 'device_id must be digits' };
  const stamp = String(opts.stamp || '').trim();
  if (!/^[0-9]{8}T[0-9]{9}Z$/.test(stamp)) return { ok: false, error: 'stamp must be yyyyMMddTHHmmssfffZ' };
  const requested = String(opts.requested_at || '').trim();
  if (recordsScanStamp_(requested) !== stamp) {
    return { ok: false, error: 'stamp does not match requested_at' };
  }
  const key = 'camera-scans/' + dest.hubId + '/' + device + '/' + stamp + (part === 'jpeg' ? '.jpg' : '.json');
  if (part === 'jpeg') {
    const b64 = String(opts.body_base64 || '').replace(/\s+/g, '');
    if (!b64) return { ok: false, error: 'body_base64 required' };
    let bytes;
    try { bytes = Utilities.base64Decode(b64); }
    catch (e) { return { ok: false, error: 'body_base64 is not base64' }; }
    if (!bytes || bytes.length < 100) return { ok: false, error: 'jpeg too small' };
    if (bytes.length > 12 * 1024 * 1024) return { ok: false, error: 'jpeg over 12MB' };
    if ((bytes[0] & 0xFF) !== 0xFF || (bytes[1] & 0xFF) !== 0xD8) {
      return { ok: false, error: 'not a jpeg' };
    }
    const put = recordsS3PutBytes_(key, bytes, 'image/jpeg');
    return {
      ok: true, route: 'scan-put', part: part, key: key, hubId: dest.hubId,
      bytes: bytes.length, etag: put.etag
    };
  }
  const scan = opts.scan || {};
  const name = String(scan.name || '').replace(/[\r\n]/g, ' ').trim();
  if (!name || name.length > 80) return { ok: false, error: 'name required' };
  const received = String(scan.received_at || '').trim();
  if (!recordsScanStamp_(received)) return { ok: false, error: 'received_at is not a UTC timestamp' };
  if (String(scan.source || '') !== 'mjpeg') return { ok: false, error: 'source must be mjpeg' };
  const previous = String(scan.previous || '');
  const own = 'camera-scans/' + dest.hubId + '/' + device + '/' + stamp + '.jpg';
  if (previous !== '') {
    const prevRe = new RegExp('^camera-scans/' + dest.hubId + '/' + device + '/[0-9]{8}T[0-9]{9}Z\\.jpg$');
    if (!prevRe.test(previous) || previous === own) {
      return { ok: false, error: 'previous must be the prior jpeg in this camera folder' };
    }
  }
  const obj = {
    schema: 'property-intel-records/camera-scan-v1',
    hub: dest.hubId,
    device_id: device,
    name: name,
    requested_at: requested,
    received_at: received,
    source: 'mjpeg',
    previous: previous,
    description: '',
    reviewed_at: ''
  };
  const put = recordsPutJson_(key, obj);
  return { ok: true, route: 'scan-put', part: part, key: key, hubId: dest.hubId, etag: put.etag };
}

// Overwrites description and reviewed_at on an existing scan JSON.
// The JPEG, the stamp, and previous stay as they are.
function recordsScanReview_(opts) {
  opts = opts || {};
  const key = String(opts.key || '').trim();
  if (!/^camera-scans\/[a-f0-9]{32}\/[0-9]+\/[0-9]{8}T[0-9]{9}Z\.json$/.test(key)) {
    return { ok: false, error: 'key must be a camera-scan json' };
  }
  const raw = recordsFetchJson_(key);
  if (!raw) return { ok: false, error: 'scan json is missing' };
  if (!raw.previous) return { ok: false, error: 'baseline is not reviewed', baseline: true };
  if (raw.reviewed_at) return { ok: true, route: 'scan-review', already: true, key: key };
  let description = String(opts.description == null ? '' : opts.description).replace(/[\r\n]+/g, ' ').trim();
  if (description.length > 280) return { ok: false, error: 'description is too long' };
  raw.description = description;
  raw.reviewed_at = new Date().toISOString();
  const put = recordsPutJson_(key, raw);
  return {
    ok: true, route: 'scan-review', key: key, hubId: raw.hub,
    device_id: String(raw.device_id || ''),
    name: String(raw.name || ''),
    requested_at: String(raw.requested_at || ''),
    description: description, reviewed_at: raw.reviewed_at, etag: put.etag
  };
}

function recordsScanNotesKey_(hub) {
  const id = String(hub || '').trim().toLowerCase();
  if (!/^[a-f0-9]{32}$/.test(id)) throw new Error('notes hub must be 32 hex');
  return 'camera-scan-notes/' + id + '.json';
}

function recordsScanNoteClean_(frame) {
  const key = String((frame && frame.key) || '').trim().replace(/\.jpg$/, '.json');
  if (!/^camera-scans\/[a-f0-9]{32}\/[0-9]+\/[0-9]{8}T[0-9]{9}Z\.json$/.test(key)) return null;
  const description = String((frame && frame.description) || '').replace(/[\r\n]+/g, ' ').trim();
  if (!description || description.length > 280) return null;
  const device = String((frame && frame.device_id) || '');
  if (!/^[0-9]{1,16}$/.test(device)) return null;
  return {
    key: key,
    device_id: device,
    name: String((frame && frame.name) || '').slice(0, 80),
    requested_at: String((frame && frame.requested_at) || ''),
    description: description,
    reviewed_at: String((frame && frame.reviewed_at) || '')
  };
}

function recordsScanNotesMerge_(hub, incoming) {
  const id = String(hub || '').trim().toLowerCase();
  const key = recordsScanNotesKey_(id);
  const obj = recordsFetchJson_(key) || {};
  const notes = Array.isArray(obj.notes) ? obj.notes : [];
  const seen = {};
  const out = [];
  function take(list) {
    const rows = Array.isArray(list) ? list : [];
    for (let i = 0; i < rows.length; i++) {
      const clean = recordsScanNoteClean_(rows[i]);
      if (!clean || seen[clean.key]) continue;
      seen[clean.key] = true;
      out.push(clean);
    }
  }
  take(incoming);
  take(notes);
  out.sort(function (a, b) { return String(b.requested_at).localeCompare(String(a.requested_at)); });
  const kept = out.slice(0, 400);
  const body = {
    schema: 'property-intel-records/camera-scan-notes-v1',
    hub: id,
    notes: kept
  };
  const put = recordsPutJson_(key, body);
  return { ok: true, route: 'scan-notes', hub: id, count: kept.length, etag: put.etag };
}

function recordsScanNotesAdd_(hub, frame) {
  const clean = recordsScanNoteClean_(frame);
  if (!clean) return { ok: true, skipped: true };
  return recordsScanNotesMerge_(hub, [clean]);
}

// Tracy's house only, until the profile writer is widened.
// SAFE hub for site_no 14725. Not the name-hash 6de88883… and not the fork 2dce25a3….
var RECORDS_PROFILE_HUB = 'd9f759d7351db3886c79dd689c41e3c0';

function recordsProfileKeyOk_(supplied) {
  if (typeof chektScanReviewKeyOk_ === 'function') return chektScanReviewKeyOk_(supplied);
  const expected = String(PropertiesService.getScriptProperties().getProperty('SCAN_REVIEW_KEY') || '').trim();
  if (!expected) return false;
  return String(supplied || '').trim() === expected;
}

function recordsProfileLiveReadOk_(supplied) {
  if (recordsProfileKeyOk_(supplied)) return true;
  if (typeof recordsLiveKeyOk_ === 'function') return recordsLiveKeyOk_(supplied);
  return false;
}


function recordsProfileSlug_(value) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(value || ''));
}

function recordsProfileWhen_(when) {
  if (when == null) return { ok: true, when: null };
  if (!when || typeof when !== 'object' || Array.isArray(when)) return { ok: false, error: 'when must be null or a window' };
  const days = when.days;
  const allowed = { mon: 1, tue: 1, wed: 1, thu: 1, fri: 1, sat: 1, sun: 1 };
  if (!Array.isArray(days) || !days.length) return { ok: false, error: 'when.days is required' };
  const seen = {};
  for (let i = 0; i < days.length; i++) {
    const day = String(days[i] || '');
    if (!allowed[day] || seen[day]) return { ok: false, error: 'when.days has a bad day' };
    seen[day] = 1;
  }
  const hm = /^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/;
  if (!hm.test(String(when.start || '')) || !hm.test(String(when.end || ''))) {
    return { ok: false, error: 'when.start and when.end must be HH:mm' };
  }
  return { ok: true, when: { days: days.slice(), start: String(when.start), end: String(when.end) } };
}

function recordsPropertyProfileGet_(opts) {
  opts = opts || {};
  if (!recordsProfileLiveReadOk_(opts.review_key)) return { ok: false, error: 'review key refused' };
  const hub = String(opts.hub || RECORDS_PROFILE_HUB).trim().toLowerCase();
  if (hub !== RECORDS_PROFILE_HUB) return { ok: false, error: 'initial profile is Tracy\'s house only' };
  const dest = recordsScanHub_(hub);
  if (!dest.ok) return dest;
  const key = 'property-profile/' + dest.hubId + '.json';
  const raw = recordsFetchJson_(key);
  if (!raw) return { ok: true, route: 'property-profile', saved: false, hub: dest.hubId, key: key };
  return { ok: true, route: 'property-profile', saved: true, hub: dest.hubId, key: key, profile: raw };
}

function recordsPropertyProfilePut_(opts) {
  opts = opts || {};
  if (!recordsProfileKeyOk_(opts.review_key)) return { ok: false, error: 'review key refused' };
  const incoming = opts.profile || {};
  const hub = String(incoming.hub || opts.hub || '').trim().toLowerCase();
  if (hub !== RECORDS_PROFILE_HUB) return { ok: false, error: 'initial profile is Tracy\'s house only' };
  const dest = recordsScanHub_(hub);
  if (!dest.ok) return dest;
  const idx = recordsFetchJson_('index/' + dest.hubId + '.json') || {};
  let description = String(incoming.description || '').replace(/[\r\n]+/g, ' ').trim();
  if (!description || description.length > 2000) return { ok: false, error: 'description is required' };
  const kinds = { vehicle: 1, person: 1, routine: 1, object: 1 };
  const characters = [];
  const ids = {};
  const list = Array.isArray(incoming.characters) ? incoming.characters : null;
  if (!list) return { ok: false, error: 'characters must be a list' };
  for (let i = 0; i < list.length; i++) {
    const row = list[i] || {};
    const id = String(row.id || '');
    if (!recordsProfileSlug_(id) || ids[id]) return { ok: false, error: 'character id is not a unique slug' };
    if (!kinds[row.kind]) return { ok: false, error: 'character kind is not allowed' };
    if (String(row.who || '') !== '') return { ok: false, error: 'who stays empty until a customer form exists' };
    if (row.source !== 'images') return { ok: false, error: 'character source must be images' };
    const label = String(row.label || '').replace(/[\r\n]/g, ' ').trim();
    const appearance = String(row.appearance || '').replace(/[\r\n]/g, ' ').trim();
    const where = String(row.where || '').replace(/[\r\n]/g, ' ').trim();
    if (!label || label.length > 80 || !appearance || appearance.length > 120 || where.length > 80) {
      return { ok: false, error: 'character label, appearance, or place is missing' };
    }
    const when = recordsProfileWhen_(row.when);
    if (!when.ok) return when;
    ids[id] = 1;
    characters.push({
      id: id, kind: String(row.kind), label: label, who: '', source: 'images',
      appearance: appearance, where: where, when: when.when
    });
  }
  const historyIn = Array.isArray(incoming.history) ? incoming.history : null;
  if (!historyIn) return { ok: false, error: 'history must be a list' };
  const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const history = [];
  for (let h = 0; h < historyIn.length; h++) {
    const row = historyIn[h] || {};
    const at = String(row.at || '');
    const atMs = Date.parse(at);
    if (!atMs || atMs < cutoff) continue;
    const device = String(row.device_id || '');
    if (!/^[0-9]{1,16}$/.test(device)) return { ok: false, error: 'history device_id must be digits' };
    const camera = String(row.camera || '').replace(/[\r\n]/g, ' ').trim();
    if (!camera || camera.length > 80) return { ok: false, error: 'history camera is required' };
    const characterId = String(row.character_id || '');
    if (characterId !== '' && !ids[characterId]) return { ok: false, error: 'history names an unknown character' };
    if (row.depth !== 'light' && row.depth !== 'full') return { ok: false, error: 'history depth must be light or full' };
    let sentence = String(row.sentence == null ? '' : row.sentence).replace(/[\r\n]+/g, ' ').trim();
    if (sentence.length > 280) return { ok: false, error: 'history sentence is too long' };
    history.push({
      at: new Date(atMs).toISOString(), device_id: device, camera: camera,
      character_id: characterId, depth: row.depth, sentence: sentence
    });
  }
  history.sort(function (a, b) { return a.at < b.at ? 1 : (a.at > b.at ? -1 : 0); });
  const kept = history.slice(0, 200);
  const keptCounts = {};
  for (let k = 0; k < kept.length; k++) {
    const cid = kept[k].character_id;
    if (cid) keptCounts[cid] = (keptCounts[cid] || 0) + 1;
  }
  for (let c = 0; c < characters.length; c++) {
    if ((keptCounts[characters[c].id] || 0) < 2) {
      return { ok: false, error: 'character ' + characters[c].id + ' needs two history rows' };
    }
  }
  const zone = String(incoming.zone || 'America/Chicago');
  if (!/^[A-Za-z_]+\/[A-Za-z0-9_+-]+$/.test(zone)) return { ok: false, error: 'zone is not a timezone name' };
  const obj = {
    schema: 'property-intel-records/property-profile-v1',
    hub: dest.hubId,
    site_no: dest.site_no || String(idx.site_no || '14725'),
    name: String(idx.name || incoming.name || 'Jones').replace(/[\r\n]/g, ' ').trim(),
    address: String(idx.address || incoming.address || '').replace(/[\r\n]/g, ' ').trim(),
    account_type: String(idx.account_type || 'residential'),
    zone: zone,
    source: 'images',
    description: description,
    characters: characters,
    history: kept,
    updated_at: new Date().toISOString()
  };
  const key = 'property-profile/' + dest.hubId + '.json';
  const put = recordsPutJson_(key, obj);
  return {
    ok: true, route: 'property-profile', saved: true, key: key, hub: dest.hubId,
    characters: characters.length, history: kept.length, etag: put.etag
  };
}

// The live station and the live Grok bot share this key. It is not the scan review key.
function recordsLiveKeyOk_(supplied) {
  const expected = String(PropertiesService.getScriptProperties().getProperty('LIVE_STATION_KEY') || '').trim();
  if (!expected) return false;
  return String(supplied || '').trim() === expected;
}

function recordsLiveKeySet_() {
  return !!String(PropertiesService.getScriptProperties().getProperty('LIVE_STATION_KEY') || '').trim();
}

function recordsLiveWatchKey_() {
  const props = PropertiesService.getScriptProperties();
  let token = String(props.getProperty('LIVE_WATCH_TOKEN') || '').trim().toLowerCase();
  if (!/^[a-f0-9]{32}$/.test(token)) {
    token = Utilities.getUuid().replace(/-/g, '').toLowerCase();
    props.setProperty('LIVE_WATCH_TOKEN', token);
  }
  return 'camera-watch/' + token + '.json';
}

function recordsLiveStationKey_() {
  return recordsLiveWatchKey_().replace('camera-watch/', 'camera-station/');
}

function recordsLiveStationRead_() {
  const key = recordsLiveStationKey_();
  let got;
  try {
    got = recordsS3GetTextMeta_(key);
  } catch (e) {
    throw new Error('station object refused');
  }
  if (!got) return { key: key, obj: null, etag: '' };
  if (!got.text || got.text.length > 2000000) throw new Error('station object refused');
  let obj;
  try {
    obj = JSON.parse(got.text);
  } catch (e) {
    throw new Error('station object refused');
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('station object refused');
  if (obj.schema && obj.schema !== 'property-intel-records/camera-station-v1') {
    throw new Error('station object refused');
  }
  return { key: key, obj: obj, etag: got.etag || '' };
}

function recordsLiveStationOrders_(obj) {
  const rows = obj && Array.isArray(obj.orders) ? obj.orders : [];
  const out = [];
  for (let i = 0; i < rows.length && out.length < 40; i++) {
    const row = rows[i] || {};
    const action = String(row.action || '').trim();
    if (action !== 'start' && action !== 'stop') continue;
    const device = String(row.device_id || '').trim();
    if (!/^[0-9]{1,16}$/.test(device)) continue;
    const id = String(row.id || '').trim().toLowerCase();
    if (!/^[a-f0-9]{32}$/.test(id)) continue;
    const item = { id: id, action: action, device_id: device };
    if (action === 'stop') {
      const description = String(row.description == null ? '' : row.description).replace(/[\r\n]+/g, ' ').trim();
      if (!description || description.length > 280 || description.indexOf('://') >= 0) continue;
      item.description = description;
    }
    out.push(item);
  }
  return out;
}

function recordsLiveStationFinished_(obj) {
  const rows = obj && Array.isArray(obj.finished) ? obj.finished : [];
  const out = [];
  for (let i = 0; i < rows.length; i++) {
    const clean = recordsLiveFinishItem_(rows[i]);
    if (clean) out.push(clean);
  }
  return out.slice(-20);
}

function recordsLiveStationWrite_(key, doc, etag, create) {
  const body = JSON.stringify(doc);
  try {
    if (create) return recordsS3PutOnce_(key, body, 'application/json', { ifNoneMatch: '*' });
    return recordsS3PutOnce_(key, body, 'application/json', { ifMatch: etag });
  } catch (e) {
    const msg = String((e && e.message) || '');
    if (msg.indexOf('HTTP 412') >= 0) throw new Error('station object busy');
    throw new Error('station object refused');
  }
}

// Read, change, write with If-Match. A lost race tries again. change returns null when nothing should be written.
function recordsLiveStationMutate_(change) {
  let last = 'station object busy';
  for (let attempt = 0; attempt < 3; attempt++) {
    const got = recordsLiveStationRead_();
    const state = {
      orders: recordsLiveStationOrders_(got.obj),
      finished: recordsLiveStationFinished_(got.obj),
      feed_ack: got.obj && got.obj.feed_ack ? String(got.obj.feed_ack) : ''
    };
    let next;
    try {
      next = change(state);
    } catch (e) {
      if (e && e.queueFull) throw e;
      throw new Error('station object refused');
    }
    if (!next) return { ok: true, changed: false };
    const doc = {
      schema: 'property-intel-records/camera-station-v1',
      orders: next.orders || [],
      finished: (next.finished || []).slice(-20)
    };
    const ack = String(next.feed_ack || '').trim();
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(ack)) doc.feed_ack = ack;
    try {
      if (!got.obj) recordsLiveStationWrite_(got.key, doc, '', true);
      else {
        if (!got.etag) throw new Error('station object refused');
        recordsLiveStationWrite_(got.key, doc, got.etag, false);
      }
      return { ok: true, changed: true };
    } catch (e) {
      if (e && e.queueFull) throw e;
      const msg = String((e && e.message) || '');
      if (msg === 'station object busy') {
        last = msg;
        continue;
      }
      throw new Error('station object refused');
    }
  }
  throw new Error(last);
}

function recordsLiveStationDrop_(ids) {
  const skip = {};
  (ids || []).forEach(function (id) { skip[id] = true; });
  return recordsLiveStationMutate_(function (state) {
    const kept = state.orders.filter(function (row) { return !skip[row.id]; });
    if (kept.length === state.orders.length) return null;
    state.orders = kept;
    return state;
  });
}

function recordsLiveStationTakeFinished_() {
  let taken = [];
  recordsLiveStationMutate_(function (state) {
    taken = state.finished.slice();
    if (!taken.length) return null;
    state.finished = [];
    return state;
  });
  return taken;
}

function recordsLiveCacheDropOrder_(id) {
  return recordsLiveWithLock_(function () {
    const cache = CacheService.getScriptCache();
    const list = recordsLiveCacheList_('live-orders').filter(function (row) {
      return !row || String(row.id || '') !== id;
    });
    if (list.length) cache.put('live-orders', JSON.stringify(list), 300);
    else cache.remove('live-orders');
    return { ok: true };
  });
}

function recordsLiveWithLock_(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(8000)) return { ok: false, error: 'station lock busy' };
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function recordsLiveCacheList_(name) {
  const raw = CacheService.getScriptCache().get(name);
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

function recordsLiveRoster_(raw) {
  if (!Array.isArray(raw)) return { ok: false, error: 'roster must be a list' };
  if (raw.length > 16) return { ok: false, error: 'roster is too long' };
  const out = [];
  for (let i = 0; i < raw.length; i++) {
    const row = raw[i] || {};
    const device = String(row.device_id || '').trim();
    if (!/^[0-9]{1,16}$/.test(device)) return { ok: false, error: 'roster device_id must be digits' };
    const name = String(row.name || '').replace(/[\r\n]/g, ' ').trim();
    if (!name || name.length > 80) return { ok: false, error: 'roster name required' };
    const clip = String(row.clip || 'idle');
    if (clip !== 'idle' && clip !== 'open' && clip !== 'maxed') {
      return { ok: false, error: 'roster clip must be idle, open, or maxed' };
    }
    const item = { device_id: device, name: name, clip: clip };
    if (row.started_at) {
      const started = String(row.started_at).trim();
      if (!recordsScanStamp_(started)) return { ok: false, error: 'started_at is not a UTC timestamp' };
      item.started_at = started;
    }
    out.push(item);
  }
  return { ok: true, roster: out };
}

function recordsLiveFinishItem_(item) {
  item = item || {};
  const device = String(item.device_id || '').trim();
  if (!/^[0-9]{1,16}$/.test(device)) return null;
  if (item.ok === false) {
    let error = String(item.error || 'clip failed').replace(/[\r\n]/g, ' ').trim();
    if (!error || /:\/\//.test(error) || /token/i.test(error)) error = 'clip failed';
    return { ok: false, device_id: device, error: error.slice(0, 160) };
  }
  const description = String(item.description || '').replace(/[\r\n]+/g, ' ').trim();
  if (!description || description.length > 280) return null;
  const still = String(item.still || '');
  const clip = String(item.clip || '');
  const jpgRe = /^camera-live\/[a-f0-9]{32}\/[0-9]+\/[0-9]{8}T[0-9]{9}Z\.jpg$/;
  const mp4Re = /^camera-live\/[a-f0-9]{32}\/[0-9]+\/[0-9]{8}T[0-9]{9}Z\.mp4$/;
  if (!jpgRe.test(still) || !mp4Re.test(clip)) return null;
  const name = String(item.name || '').replace(/[\r\n]/g, ' ').trim();
  return {
    ok: true,
    device_id: device,
    name: name.slice(0, 80),
    description: description,
    started_at: String(item.started_at || ''),
    ended_at: String(item.ended_at || ''),
    still: still,
    clip: clip,
    seconds: Number(item.seconds) || 0
  };
}

// The station posts the current wall. The bot reads it with live-look.
// One overwritten object. This is not a saved event.
function recordsLiveBeat_(opts) {
  opts = opts || {};
  if (!recordsLiveKeyOk_(opts.review_key)) return { ok: false, error: 'live station key refused' };
  const roster = recordsLiveRoster_(opts.roster);
  if (!roster.ok) return roster;
  const b64 = String(opts.sheet_base64 || '').replace(/\s+/g, '');
  if (!b64) return { ok: false, error: 'sheet_base64 required' };
  if (b64.length > 2 * 1024 * 1024) return { ok: false, error: 'sheet is too large' };
  let bytes;
  try { bytes = Utilities.base64Decode(b64); }
  catch (e) { return { ok: false, error: 'sheet_base64 is not base64' }; }
  if (!bytes || bytes.length < 100 || bytes.length > 1500000) return { ok: false, error: 'sheet jpeg size refused' };
  if ((bytes[0] & 0xFF) !== 0xFF || (bytes[1] & 0xFF) !== 0xD8) {
    return { ok: false, error: 'sheet is not a jpeg' };
  }
  const finishedIn = Array.isArray(opts.finished) ? opts.finished : [];
  const put = recordsPutJson_(recordsLiveWatchKey_(), {
    schema: 'property-intel-records/camera-watch-v1',
    at: new Date().toISOString(),
    roster: roster.roster,
    sheet_base64: b64
  });
  const noted = recordsLiveWithLock_(function () {
    const cache = CacheService.getScriptCache();
    let list = recordsLiveCacheList_('live-finished');
    finishedIn.forEach(function (item) {
      const clean = recordsLiveFinishItem_(item);
      if (clean) list.push(clean);
    });
    if (list.length > 20) list = list.slice(list.length - 20);
    if (list.length) cache.put('live-finished', JSON.stringify(list), 600);
    const orders = recordsLiveCacheList_('live-orders');
    cache.remove('live-orders');
    return { ok: true, orders: orders };
  });
  if (!noted.ok) return noted;
  const ids = [];
  (noted.orders || []).forEach(function (row) {
    const id = String((row && row.id) || '').trim().toLowerCase();
    if (/^[a-f0-9]{32}$/.test(id)) ids.push(id);
  });
  if (ids.length) {
    try { recordsLiveStationDrop_(ids); }
    catch (e) { /* The PC already has these orders. Do not fail the beat. */ }
  }
  return { ok: true, route: 'live-beat', orders: noted.orders, etag: put.etag };
}

function recordsLiveNoteAck_(since) {
  const text = String(since || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(text)) return;
  const at = Date.parse(text);
  if (isNaN(at)) return;
  const age = Date.now() - at;
  if (age < -60000 || age > 10 * 60 * 1000) return;
  try {
    recordsLiveStationMutate_(function (state) {
      state.feed_ack = text;
      return state;
    });
  } catch (e) { /* A missed ack repeats a stretch. It does not stop the look. */ }
}

function recordsLiveLook_(opts) {
  opts = opts || {};
  if (!recordsLiveKeyOk_(opts.review_key)) return { ok: false, error: 'live station key refused' };
  recordsLiveNoteAck_(opts.since);
  const obj = recordsFetchJson_(recordsLiveWatchKey_());
  let live = false;
  let age = null;
  let roster = [];
  let sheet = '';
  if (obj && obj.at) {
    const at = Date.parse(obj.at);
    if (!isNaN(at)) {
      age = Math.max(0, Math.round((Date.now() - at) / 1000));
      live = age <= 45;
    }
    if (live) {
      roster = Array.isArray(obj.roster) ? obj.roster : [];
      sheet = String(obj.sheet_base64 || '');
    }
  }
  const finished = recordsLiveWithLock_(function () {
    const cache = CacheService.getScriptCache();
    const list = recordsLiveCacheList_('live-finished');
    cache.remove('live-finished');
    return { ok: true, finished: list };
  });
  let fromStation = [];
  let station = true;
  try {
    fromStation = recordsLiveStationTakeFinished_();
  } catch (e) {
    station = false;
    fromStation = [];
  }
  const both = (finished.ok ? finished.finished : []).concat(fromStation);
  return {
    ok: true,
    route: 'live-look',
    live: live,
    age_s: age,
    roster: roster,
    sheet_base64: sheet,
    feed_base64: recordsLiveFeed_(obj, live),
    feed_from: live && obj ? String(obj.feed_from || '') : '',
    feed_to: live && obj ? String(obj.feed_to || '') : '',
    feed_fps: 2,
    feed_seq: live && obj ? Number(obj.feed_seq) || 0 : 0,
    finished: both.slice(-20),
    station: station,
    patrol: recordsPatrolPingRead_()
  };
}

// The patrol bot pings the live bot after a notable Tracy frame. One waiting ping.
// The live bot sees it on live-look. The profile is not the reason to watch.
function recordsPatrolPing_(opts) {
  opts = opts || {};
  if (!recordsProfileKeyOk_(opts.review_key)) return { ok: false, error: 'review key refused' };
  const hub = String(opts.hub || '').trim().toLowerCase();
  if (hub !== RECORDS_PROFILE_HUB) return { ok: false, error: 'patrol ping is Tracy\'s house only' };
  const device = String(opts.device_id || '').trim();
  const camera = String(opts.camera || '').replace(/[\r\n]/g, ' ').trim();
  if (!camera || camera.length > 80) return { ok: false, error: 'camera is required' };
  const sentence = String(opts.sentence || '').replace(/[\r\n]+/g, ' ').trim();
  if (!sentence || sentence.length > 280) return { ok: false, error: 'sentence is required' };
  const source = String(opts.source || 'scan').trim();
  const key = String(opts.key || '').trim();
  const logId = String(opts.log_id || '').trim();
  if (source === 'log') {
    if (!/^[A-Za-z0-9|._:-]{1,80}$/.test(logId)) return { ok: false, error: 'log id is required' };
  } else if (source !== 'scan') {
    return { ok: false, error: 'source must be scan or log' };
  } else if (!/^camera-scans\/d9f759d7351db3886c79dd689c41e3c0\/[0-9]+\/[0-9]{8}T[0-9]{9}Z\.json$/.test(key)) {
    return { ok: false, error: 'key must be a Tracy scan' };
  }
  const atMs = Date.parse(String(opts.at || '').trim());
  if (!atMs) return { ok: false, error: 'at is not a UTC timestamp' };
  const deviceOut = /^[0-9]{1,16}$/.test(device) ? device : '';
  if (source !== 'log' && !deviceOut) return { ok: false, error: 'device_id must be digits' };
  const ping = {
    id: Utilities.getUuid().replace(/-/g, '').toLowerCase(),
    hub: RECORDS_PROFILE_HUB,
    source: source,
    device_id: deviceOut,
    camera: camera,
    sentence: sentence,
    at: new Date(atMs).toISOString(),
    key: source === 'log' ? '' : key,
    log_id: source === 'log' ? logId : ''
  };
  CacheService.getScriptCache().put('patrol-ping', JSON.stringify(ping), 1200);
  return { ok: true, route: 'patrol-ping', id: ping.id };
}

function recordsPatrolPingRead_() {
  const raw = CacheService.getScriptCache().get('patrol-ping');
  if (!raw) return null;
  try {
    const ping = JSON.parse(raw);
    if (!ping || !ping.id || !ping.sentence) return null;
    return ping;
  } catch (e) {
    return null;
  }
}

// The page reads the same wall. It does not take finished clips away from the bot.
function recordsLiveFeed_(obj, live) {
  if (!live || !obj) return '';
  const feed = String(obj.feed_base64 || '').replace(/\s+/g, '');
  if (!feed || feed.length > 4000000) return '';
  return feed;
}

function recordsLiveWall_(opts) {
  opts = opts || {};
  if (!recordsLiveKeyOk_(opts.review_key)) return { ok: false, error: 'live station key refused' };
  const obj = recordsFetchJson_(recordsLiveWatchKey_());
  let live = false;
  let age = null;
  let roster = [];
  let sheet = '';
  if (obj && obj.at) {
    const at = Date.parse(obj.at);
    if (!isNaN(at)) {
      age = Math.max(0, Math.round((Date.now() - at) / 1000));
      live = age <= 45;
    }
    if (live) {
      roster = Array.isArray(obj.roster) ? obj.roster : [];
      sheet = String(obj.sheet_base64 || '');
    }
  }
  return {
    ok: true,
    route: 'live-wall',
    live: live,
    age_s: age,
    roster: roster,
    sheet_base64: sheet,
    feed_base64: recordsLiveFeed_(obj, live),
    feed_from: live && obj ? String(obj.feed_from || '') : '',
    feed_to: live && obj ? String(obj.feed_to || '') : '',
    feed_fps: 2,
    feed_seq: live && obj ? Number(obj.feed_seq) || 0 : 0
  };
}

function recordsLiveClipPage_(xml) {
  const keys = [];
  const found = xml.match(/<Key>[^<]+<\/Key>/g) || [];
  const re = new RegExp('^camera-live/' + RECORDS_JONES_HUB + '/[0-9]+/[0-9]{8}T[0-9]{9}Z\\.json$');
  for (let i = 0; i < found.length; i++) {
    const k = recordsXmlUnescape_(found[i].slice(5, -6));
    if (re.test(k)) keys.push(k);
  }
  const next = xml.match(/<NextContinuationToken>([^<]*)<\/NextContinuationToken>/);
  return {
    keys: keys,
    truncated: /<IsTruncated>true<\/IsTruncated>/.test(xml),
    token: next ? recordsXmlUnescape_(next[1]) : ''
  };
}

// Saved Jones visits for the station page. Does not read the watch object.
function recordsLiveClips_(opts) {
  opts = opts || {};
  if (!recordsLiveKeyOk_(opts.review_key)) return { ok: false, error: 'live station key refused' };
  const prefix = 'camera-live/' + RECORDS_JONES_HUB + '/';
  const keys = [];
  let token = '';
  try {
    for (let page = 0; page < 3 && keys.length < 1000; page++) {
      const params = { 'list-type': '2', 'max-keys': '1000', prefix: prefix };
      if (token) params['continuation-token'] = token;
      const req = recordsS3ListRequest_(params);
      const res = UrlFetchApp.fetch(req.url, req);
      const code = res.getResponseCode();
      const txt = res.getContentText();
      if (code !== 200) {
        if (code === 403 || /AccessDenied/.test(txt)) {
          return { ok: true, route: 'live-clips', list: false, clips: [], error: 'clip list was not granted' };
        }
        return { ok: true, route: 'live-clips', list: false, clips: [], error: 'clip list failed' };
      }
      const got = recordsLiveClipPage_(txt);
      for (let i = 0; i < got.keys.length; i++) keys.push(got.keys[i]);
      if (!got.truncated || !got.token) break;
      token = got.token;
    }
  } catch (e) {
    return { ok: true, route: 'live-clips', list: false, clips: [], error: 'clip list failed' };
  }
  keys.sort();
  keys.reverse();
  const clips = [];
  const take = keys.slice(0, 40);
  for (let i = 0; i < take.length; i++) {
    let obj = null;
    try { obj = recordsFetchJson_(take[i]); } catch (e) { obj = null; }
    if (!obj || obj.schema !== 'property-intel-records/camera-live-v1') continue;
    const still = String(obj.still || '');
    const clip = String(obj.clip || '');
    if (!RECORDS_LIVE_KEY_RE.test(still) || !RECORDS_LIVE_KEY_RE.test(clip)) continue;
    if (still.indexOf(prefix) !== 0 || clip.indexOf(prefix) !== 0) continue;
    clips.push({
      name: String(obj.name || '').replace(/[\r\n]/g, ' ').trim().slice(0, 80),
      device_id: String(obj.device_id || ''),
      description: String(obj.description || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 280),
      started_at: String(obj.started_at || ''),
      ended_at: String(obj.ended_at || ''),
      seconds: Number(obj.seconds) || 0,
      still_url: RECORDS_CF_BASE + still,
      clip_url: RECORDS_CF_BASE + clip
    });
  }
  return { ok: true, route: 'live-clips', list: true, clips: clips };
}

function recordsLiveClip_(opts) {
  opts = opts || {};
  if (!recordsLiveKeyOk_(opts.review_key)) return { ok: false, error: 'live station key refused' };
  const action = String(opts.action || '').trim();
  if (action !== 'start' && action !== 'stop') return { ok: false, error: 'action must be start or stop' };
  const device = String(opts.device_id || '').trim();
  if (!/^[0-9]{1,16}$/.test(device)) return { ok: false, error: 'device_id must be digits' };
  const order = {
    id: Utilities.getUuid().replace(/-/g, '').toLowerCase(),
    action: action,
    device_id: device
  };
  if (action === 'stop') {
    const description = String(opts.description == null ? '' : opts.description).replace(/[\r\n]+/g, ' ').trim();
    if (!description) return { ok: false, error: 'an event needs a description' };
    if (description.length > 280) return { ok: false, error: 'description is too long' };
    if (description.indexOf('://') >= 0) return { ok: false, error: 'description refused' };
    order.description = description;
  }
  const cached = recordsLiveWithLock_(function () {
    const cache = CacheService.getScriptCache();
    const list = recordsLiveCacheList_('live-orders');
    if (list.length >= 40) return { ok: false, error: 'clip queue is full' };
    list.push(order);
    cache.put('live-orders', JSON.stringify(list), 300);
    return { ok: true };
  });
  if (!cached.ok) return cached;
  try {
    recordsLiveStationMutate_(function (state) {
      if (state.orders.length >= 40) {
        const full = new Error('clip queue is full');
        full.queueFull = true;
        throw full;
      }
      state.orders.push(order);
      return state;
    });
  } catch (e) {
    recordsLiveCacheDropOrder_(order.id);
    if (e && e.queueFull) return { ok: false, error: 'clip queue is full' };
    if (String((e && e.message) || '') === 'station object busy') {
      return { ok: false, error: 'station object busy' };
    }
    return { ok: false, error: 'station object refused' };
  }
  return { ok: true, route: 'live-clip', queued: true, action: action, device_id: device };
}

function recordsLiveBytes_(b64, kind) {
  const clean = String(b64 || '').replace(/\s+/g, '');
  if (!clean) return { ok: false, error: 'body_base64 required' };
  let bytes;
  try { bytes = Utilities.base64Decode(clean); }
  catch (e) { return { ok: false, error: 'body_base64 is not base64' }; }
  if (!bytes || bytes.length < 100) return { ok: false, error: kind + ' too small' };
  if (kind === 'jpeg') {
    if (bytes.length > 12 * 1024 * 1024) return { ok: false, error: 'jpeg over 12MB' };
    if ((bytes[0] & 0xFF) !== 0xFF || (bytes[1] & 0xFF) !== 0xD8) return { ok: false, error: 'not a jpeg' };
  } else {
    if (bytes.length > 32 * 1024 * 1024) return { ok: false, error: 'video over 32MB' };
    let head = '';
    const n = Math.min(bytes.length, 32);
    for (let i = 0; i < n; i++) head += String.fromCharCode(bytes[i] & 0xFF);
    if (head.indexOf('ftyp') < 0) return { ok: false, error: 'not an mp4' };
  }
  return { ok: true, bytes: bytes };
}

// One still, one video, or the sentence. The script writes S3. The bot decides the clip.
function recordsLivePut_(opts) {
  opts = opts || {};
  if (!recordsLiveKeyOk_(opts.review_key)) return { ok: false, error: 'live station key refused' };
  const part = String(opts.part || '').trim();
  if (part !== 'jpeg' && part !== 'mp4' && part !== 'json') return { ok: false, error: 'part must be jpeg, mp4, or json' };
  const dest = recordsScanHub_(opts.hub);
  if (!dest.ok) return dest;
  const device = String(opts.device_id || '').trim();
  if (!/^[0-9]{1,16}$/.test(device)) return { ok: false, error: 'device_id must be digits' };
  const stamp = String(opts.stamp || '').trim();
  if (!/^[0-9]{8}T[0-9]{9}Z$/.test(stamp)) return { ok: false, error: 'stamp must be yyyyMMddTHHmmssfffZ' };
  const started = String(opts.started_at || '').trim();
  if (recordsScanStamp_(started) !== stamp) return { ok: false, error: 'stamp does not match started_at' };
  const ended = String(opts.ended_at || '').trim();
  if (!recordsScanStamp_(ended)) return { ok: false, error: 'ended_at is not a UTC timestamp' };
  const ext = part === 'jpeg' ? '.jpg' : (part === 'mp4' ? '.mp4' : '.json');
  const key = 'camera-live/' + dest.hubId + '/' + device + '/' + stamp + ext;
  if (part === 'jpeg' || part === 'mp4') {
    const body = recordsLiveBytes_(opts.body_base64, part === 'jpeg' ? 'jpeg' : 'mp4');
    if (!body.ok) return body;
    const put = recordsS3PutBytes_(key, body.bytes, part === 'jpeg' ? 'image/jpeg' : 'video/mp4');
    return {
      ok: true, route: 'live-put', part: part, key: key, hubId: dest.hubId,
      bytes: body.bytes.length, etag: put.etag
    };
  }
  const name = String(opts.name || '').replace(/[\r\n]/g, ' ').trim();
  if (!name || name.length > 80) return { ok: false, error: 'name required' };
  const description = String(opts.description == null ? '' : opts.description).replace(/[\r\n]+/g, ' ').trim();
  if (!description) return { ok: false, error: 'an event needs a description' };
  if (description.length > 280) return { ok: false, error: 'description is too long' };
  const still = 'camera-live/' + dest.hubId + '/' + device + '/' + stamp + '.jpg';
  const clip = 'camera-live/' + dest.hubId + '/' + device + '/' + stamp + '.mp4';
  const obj = {
    schema: 'property-intel-records/camera-live-v1',
    hub: dest.hubId,
    device_id: device,
    name: name,
    started_at: started,
    ended_at: ended,
    source: 'live',
    still: still,
    clip: clip,
    description: description,
    seconds: Number(opts.seconds) || 0,
    saved_at: new Date().toISOString()
  };
  const put = recordsPutJson_(key, obj);
  return { ok: true, route: 'live-put', part: part, key: key, hubId: dest.hubId, etag: put.etag };
}

function recordsScanStateKey_(hub) {
  const id = String(hub || '').trim().toLowerCase();
  if (!/^[a-f0-9]{32}$/.test(id)) throw new Error('scan state hub must be 32 hex');
  return 'camera-scan-state/' + id + '.json';
}

function recordsScanStateGet_(hub) {
  const obj = recordsFetchJson_(recordsScanStateKey_(hub));
  if (!obj) return null;
  if (!obj.previous || typeof obj.previous !== 'object') obj.previous = {};
  if (!Array.isArray(obj.queue)) obj.queue = [];
  if (!Array.isArray(obj.backlog)) obj.backlog = [];
  if (!obj.walks || typeof obj.walks !== 'object') obj.walks = {};
  return obj;
}

function recordsPatrolKey_(hub) {
  const id = String(hub || '').trim().toLowerCase();
  if (!/^[a-f0-9]{32}$/.test(id)) throw new Error('patrol hub must be 32 hex');
  return 'camera-scan-patrol/' + id + '.json';
}

function recordsPatrolNormalize_(obj) {
  obj = obj || {};
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
    qa: RECORDS_PATROL_QA[qa] ? qa : '',
    times: times
  };
}

function recordsPatrolGet_(hub) {
  const obj = recordsFetchJson_(recordsPatrolKey_(hub));
  if (!obj) return null;
  return recordsPatrolNormalize_(obj);
}

function recordsPatrolCheck_(times) {
  var src = (times && typeof times === 'object') ? times : {};
  var kept = {};
  var ids = Object.keys(src);
  var i, j, id, seen, out, s;
  for (i = 0; i < ids.length; i++) {
    id = ids[i];
    if (!/^[0-9]{1,16}$/.test(id)) return { ok: false, error: 'bad camera id' };
    if (!Array.isArray(src[id])) return { ok: false, error: 'times must be a list' };
    seen = {};
    out = [];
    for (j = 0; j < src[id].length; j++) {
      s = String(src[id][j] || '').trim();
      if (!/^([01][0-9]|2[0-3]):[0-5][05]$/.test(s)) {
        return { ok: false, error: 'time must be HH:mm on a 5-minute mark' };
      }
      if (seen[s]) return { ok: false, error: 'duplicate time ' + s };
      seen[s] = true;
      out.push(s);
    }
    out.sort();
    if (out.length) kept[id] = out;
  }
  return { ok: true, times: kept };
}

function recordsPatrolCount_(times) {
  var n = 0;
  var ids = Object.keys(times || {});
  for (var i = 0; i < ids.length; i++) n += (times[ids[i]] || []).length;
  return n;
}

// cameraIds are the cameras already known on this row. The pool is
// (reviews per camera) times that count. Times may all sit on one camera.
function recordsPatrolPut_(hub, qa, times, cameraIds) {
  var id = String(hub || '').trim().toLowerCase();
  var level = String(qa || '').trim().toLowerCase();
  var rate = RECORDS_PATROL_QA[level];
  if (!rate) return { ok: false, error: 'qa must be bronze, silver, gold, or platinum' };
  var known = {};
  var devices = cameraIds || [];
  var i, d;
  for (i = 0; i < devices.length; i++) {
    d = String(devices[i] || '');
    if (/^[0-9]{1,16}$/.test(d)) known[d] = true;
  }
  var cameras = Object.keys(known).length;
  var checked = recordsPatrolCheck_(times);
  if (!checked.ok) return checked;
  var keptTimes = checked.times;
  var placed = recordsPatrolCount_(keptTimes);
  var pool = rate * cameras;
  if (placed > pool) {
    return { ok: false, error: placed + ' reviews placed. This level allows ' + pool + '.' };
  }
  var names = Object.keys(keptTimes);
  var unknown = '';
  for (i = 0; i < names.length; i++) {
    if (!known[names[i]]) { unknown = names[i]; break; }
  }
  if (unknown) return { ok: false, error: 'unknown camera ' + unknown };
  const obj = {
    schema: 'property-intel-records/camera-scan-patrol-v1',
    hub: id,
    qa: level,
    times: keptTimes
  };
  const put = recordsPutJson_(recordsPatrolKey_(id), obj);
  return {
    ok: true, route: 'scan-patrol', hub: id, qa: level,
    pool: pool, placed: placed, rate: rate, cameras: cameras, etag: put.etag
  };
}

function recordsScanStatePut_(hub, obj) {
  obj = obj || {};
  obj.schema = 'property-intel-records/camera-scan-state-v1';
  obj.hub = String(hub || '').trim().toLowerCase();
  if (!obj.previous || typeof obj.previous !== 'object') obj.previous = {};
  if (!Array.isArray(obj.queue)) obj.queue = [];
  if (obj.queue.length > 80) obj.queue = obj.queue.slice(obj.queue.length - 80);
  if (!Array.isArray(obj.backlog)) obj.backlog = [];
  if (!obj.walks || typeof obj.walks !== 'object') obj.walks = {};
  return recordsPutJson_(recordsScanStateKey_(hub), obj);
}

// After the five objects exist, merge files.safe. Does not create an index.
function recordsSafeAttach_(opts) {
  const dest = recordsSafeDest_(opts);
  if (!dest.ok) return dest;
  const missing = [];
  const names = ['report', 'S', 'A', 'F', 'E'];
  for (let i = 0; i < names.length; i++) {
    if (!recordsS3HeadObject_(dest.keys[names[i]])) missing.push(dest.keys[names[i]]);
  }
  if (missing.length) {
    return { ok: false, error: 'report objects missing', hubId: dest.hubId, missing: missing };
  }
  if (!dest.index_exists) {
    return {
      ok: true,
      route: 'safe-attach',
      attached: false,
      hubId: dest.hubId,
      reason: 'report is in place; index does not exist and was not created'
    };
  }
  recordsUpsertIndex_(dest.hubId, { files: { safe: { key: dest.keys.report } } });
  return { ok: true, route: 'safe-attach', attached: true, hubId: dest.hubId, key: dest.keys.report };
}

function recordsIndexPatchFromGithubEntry_(hubId, gh) {
  gh = gh && typeof gh === 'object' ? gh : {};
  const patch = { files: {}, views: {} };
  ['name', 'address', 'hoa', 'account_type', 'site_no'].forEach(function (k) {
    if (gh[k] !== undefined && gh[k] !== null && gh[k] !== '') patch[k] = gh[k];
  });
  if (gh.has_nadir !== undefined) patch.has_nadir = gh.has_nadir;
  if (typeof gh.lat === 'number' && typeof gh.lng === 'number') {
    patch.lat = gh.lat;
    patch.lng = gh.lng;
  }
  if (gh.schema === RECORDS_SCHEMA && gh.files && typeof gh.files === 'object') {
    Object.keys(gh.files).forEach(function (k) { patch.files[k] = gh.files[k]; });
    if (gh.views && typeof gh.views === 'object') {
      Object.keys(gh.views).forEach(function (v) { patch.views[v] = gh.views[v]; });
    }
    return patch;
  }
  const viewsIn = gh.views && typeof gh.views === 'object' ? gh.views : {};
  Object.keys(viewsIn).forEach(function (viewName) {
    if (viewName === 'satellite' || viewName === 'safety' || viewName === 'fr') return;
    const viewId = viewsIn[viewName];
    if (typeof viewId !== 'string' || !viewId) return;
    const filesKey = RECORDS_VIEW_TO_FILES[viewName];
    const prefix = filesKey ? RECORDS_FILES_PREFIX[filesKey] : '';
    if (!filesKey || !prefix) return;
    const ent = { key: prefix + viewId + '.json' };
    if (/^[a-f0-9]{32}$/.test(viewId)) ent.id = viewId;
    patch.files[filesKey] = ent;
    patch.views[viewName] = filesKey;
  });
  const hoaSlug = String(gh.hoa || '').trim();
  if (hoaSlug && /^[a-z0-9][a-z0-9-]*$/.test(hoaSlug)) {
    patch.files.hoa = { slug: hoaSlug, key: RECORDS_FILES_PREFIX.hoa + hoaSlug + '.json' };
  }
  return patch;
}

function recordsJoinViewIndex_(filesKey, viewName, viewId, obj) {
  const opts = {
    siteNo: obj && obj.site_no,
    accountName: obj && obj.name,
    address: obj && obj.address,
    salt: getCredentials().hashSalt
  };
  let hubId = '';
  if (filesKey === 'drone-test' && typeof droneTestHubId_ === 'function') {
    hubId = droneTestHubId_(opts);
  } else if (typeof indexHubId_ === 'function') {
    hubId = indexHubId_(opts);
  }
  if (!hubId) return;
  const prefix = RECORDS_FILES_PREFIX[filesKey];
  const s3Key = prefix + viewId + '.json';
  const files = {};
  files[filesKey] = { id: viewId, key: s3Key };
  const views = {};
  views[viewName] = filesKey;
  recordsUpsertIndex_(hubId, { files: files, views: views });
}

function recordsPublishGithubPath_(path, content) {
  const p = String(path || '').replace(/^\/+/, '');
  const obj = JSON.parse(content);
  let m = p.match(/^data\/(satellite|plane|drone-test|nearmap|interior)\/([A-Za-z0-9]+)\.json$/);
  if (m) {
    const filesKey = m[1];
    const id = m[2];
    if (filesKey === 'satellite') recordsKeepParcelRing_(id, obj);
    recordsPutJson_(RECORDS_FILES_PREFIX[filesKey] + id + '.json', obj);
    if (filesKey === 'plane') recordsJoinViewIndex_('plane', 'plane', id, obj);
    else if (filesKey === 'drone-test') recordsJoinViewIndex_('drone-test', 'drone-test', id, obj);
    else if (filesKey === 'nearmap') {
      recordsUpsertIndex_(id, {
        files: { nearmap: { id: id, key: RECORDS_FILES_PREFIX.nearmap + id + '.json' } },
        views: { nearmap: 'nearmap' }
      });
    } else if (filesKey === 'interior') {
      recordsJoinViewIndex_('interior', 'interior', id, obj);
    }
    return;
  }
  m = p.match(/^data\/(responder-drone|drone)\/([A-Za-z0-9]+)\.json$/);
  if (m) {
    const id = m[2];
    const key = RECORDS_FILES_PREFIX.drone + id + '.json';
    recordsPutJson_(key, obj);
    recordsJoinViewIndex_('drone', 'drone', id, obj);
    return;
  }
  m = p.match(/^data\/hoa\/([A-Za-z0-9][A-Za-z0-9-]*)\.json$/);
  if (m) {
    const slug = m[1];
    if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) throw new Error('records: bad hoa slug "' + slug + '"');
    recordsPutJson_(RECORDS_FILES_PREFIX.hoa + slug + '.json', obj);
    return;
  }
  m = p.match(/^data\/pins\/([A-Za-z0-9]+)\.json$/);
  if (m) {
    const id = m[1];
    const existing = recordsFetchJson_(RECORDS_FILES_PREFIX.pins + id + '.json');
    if (obj.source !== '3d' && existing && existing.source === '3d') {
      Logger.log('records sync: keep 3d pins for ' + id);
      return;
    }
    recordsPutJson_(RECORDS_FILES_PREFIX.pins + id + '.json', obj);
    recordsUpsertIndex_(id, { files: { pins: { key: RECORDS_FILES_PREFIX.pins + id + '.json' } } });
    return;
  }
  // Camera pin editor calls this after the GitHub Contents PUT, with the
  // merged JSON it just wrote. Same remap as publishRecordsSidecarsFromGithub.
  m = p.match(/^data\/cameras\/(?:json\/)?([A-Za-z0-9]+)\.json$/);
  if (m) {
    const gitId = m[1];
    const hubId = recordsSidecarHubId_(gitId);
    if (!hubId) {
      Logger.log('records sync: skip cameras ' + gitId);
      return;
    }
    const body = recordsRewriteCameraPhotos_(obj, hubId);
    const key = RECORDS_FILES_PREFIX.cameras + hubId + '.json';
    recordsPutJson_(key, body);
    recordsUpsertIndex_(hubId, { files: { cameras: { key: key } } });
    return;
  }
  m = p.match(/^data\/gis\/([A-Za-z0-9]+)\.json$/);
  if (m) {
    const gitId = m[1];
    const hubId = recordsSidecarHubId_(gitId);
    if (!hubId) {
      Logger.log('records sync: skip gis ' + gitId);
      return;
    }
    obj.property = hubId;
    const key = RECORDS_FILES_PREFIX.gis + hubId + '.json';
    recordsPutJson_(key, obj);
    recordsUpsertIndex_(hubId, { files: { gis: { key: key } } });
    return;
  }
  m = p.match(/^data\/index\/([A-Za-z0-9]+)\.json$/);
  if (m) {
    const hubId = m[1];
    recordsUpsertIndex_(hubId, recordsIndexPatchFromGithubEntry_(hubId, obj));
    return;
  }
  throw new Error('records: refused to publish path "' + path + '" to S3');
}

function pushAllToRecords_(files, label) {
  const list = files || [];
  Logger.log('pushAllToRecords_ ' + (label || '') + ': ' + list.length + ' file(s) → s3://' + RECORDS_BUCKET);
  let fail = 0;
  for (let i = 0; i < list.length; i++) {
    const f = list[i];
    try {
      recordsPublishGithubPath_(f.path, f.content);
    } catch (e) {
      fail++;
      Logger.log('pushAllToRecords_ FAIL ' + f.path + ': ' + e.message);
    }
  }
  if (fail) throw new Error('records publish: ' + fail + '/' + list.length + ' failed (label ' + (label || '') + ')');
  return true;
}

function recordsIndexKey_(hubId) {
  if (!/^[a-f0-9]{32}$/.test(String(hubId || ''))) {
    throw new Error('records: hub id must be a 32-char hex hash, got "' + hubId + '"');
  }
  return 'index/' + hubId + '.json';
}

function recordsMergeIndex_(existing, patch) {
  const base = existing ? JSON.parse(JSON.stringify(existing)) : {};
  patch = patch || {};
  base.schema = RECORDS_SCHEMA;
  if (!base.files || typeof base.files !== 'object') base.files = {};
  if (!base.views || typeof base.views !== 'object') base.views = {};
  ['id', 'name', 'address', 'hoa', 'account_type', 'site_no'].forEach(function (k) {
    if (patch[k] !== undefined && patch[k] !== null && patch[k] !== '') base[k] = patch[k];
  });
  if (patch.has_nadir !== undefined) base.has_nadir = patch.has_nadir;
  if (typeof patch.lat === 'number' && !isNaN(patch.lat) &&
      typeof patch.lng === 'number' && !isNaN(patch.lng)) {
    base.lat = patch.lat;
    base.lng = patch.lng;
  }
  if (patch.files && typeof patch.files === 'object') {
    Object.keys(patch.files).forEach(function (k) {
      const ent = patch.files[k];
      if (!ent || typeof ent !== 'object' || !ent.key) return;
      recordsAssertKey_(ent.key);
      base.files[k] = JSON.parse(JSON.stringify(ent));
    });
  }
  if (Array.isArray(patch.deleteFiles)) {
    patch.deleteFiles.forEach(function (k) { delete base.files[k]; });
  }
  if (patch.views && typeof patch.views === 'object') {
    Object.keys(patch.views).forEach(function (v) {
      const dest = patch.views[v];
      if (dest === null || dest === undefined || dest === '') return;
      base.views[v] = dest;
    });
  }
  if (Array.isArray(patch.deleteViews)) {
    patch.deleteViews.forEach(function (v) { delete base.views[v]; });
  }
  return base;
}

function recordsUpsertIndex_(hubId, patch) {
  const key = recordsIndexKey_(hubId);
  const merged = recordsMergeIndex_(recordsFetchJson_(key), patch);
  merged.id = hubId;
  recordsPutJson_(key, merged);
  return merged;
}

// Full replace used by the GitHub → records copy. Pipeline writers should
// call recordsUpsertIndex_ so they cannot drop another tab's files keys.
function recordsWriteIndex_(hubId, patch) {
  const key = recordsIndexKey_(hubId);
  const merged = recordsMergeIndex_({}, patch);
  merged.id = hubId;
  recordsPutJson_(key, merged);
  return merged;
}

function checkRecordsWrite() {
  let text;
  try {
    const r = recordsPutJson_('_probe/apps-script-write-check.json', {
      ok: true,
      at: new Date().toISOString(),
      bucket: RECORDS_BUCKET
    });
    const back = recordsFetchJson_('_probe/apps-script-write-check.json');
    if (!back || back.ok !== true) throw new Error('S3 GET did not return the probe object');
    text = 'S3 PUT ok: s3://' + RECORDS_BUCKET + '/' + r.key + ' etag ' + r.etag +
      '\nGET ok. CDN (do not HEAD): ' + RECORDS_CF_BASE + r.key;
  } catch (e) {
    text = 'S3 PUT/GET failed: ' + e.message +
      '\nThe Script Properties AWS key needs s3:PutObject and s3:GetObject on arn:aws:s3:::' +
      RECORDS_BUCKET + '/*';
  }
  Logger.log(text);
  try { SpreadsheetApp.getUi().alert('Records S3 write check', text, SpreadsheetApp.getUi().ButtonSet.OK); } catch (e) {}
  return text;
}

// Camera stills and parcel GeoJSON are git files on disk —
// tools/publish-records-static.py syncs them to property-intel-tiles.
// This sidecar copies the same git JSON (GitHub Contents API), not the
// Sheet. JPEG bytes never go through UrlFetch.
const RECORDS_TILES_CF = 'https://d3fg47bqswi0rr.cloudfront.net/';
const RECORDS_SIDECAR_HUB_REMAP = {
  '6de88883bfd4a8349a901c54611ed9d7': 'd9f759d7351db3886c79dd689c41e3c0',
  '4a484f8c273abef3c02cf91e274f9e2f': '8eea64e5c09dc806f667b079e111a38d'
};
const RECORDS_SIDECAR_GIS_SKIP = {
  '2dce25a3643b86a7d8a1551228c3306f': true
};
const RECORDS_JONES_HUB = 'd9f759d7351db3886c79dd689c41e3c0';
const RECORDS_JONES_PLANE = 'ccd8c44194813010120989ab863e77b5';
const RECORDS_JONES_DRONE = '2dcf6ccab84215660872a52d13214aa0';

function recordsRewriteCameraPhotos_(rec, hubId) {
  const out = rec && typeof rec === 'object' ? JSON.parse(JSON.stringify(rec)) : {};
  out.property = hubId;
  const cams = Array.isArray(out.cameras) ? out.cameras : [];
  out.cameras = cams.map(function (c) {
    const cam = c && typeof c === 'object' ? JSON.parse(JSON.stringify(c)) : {};
    const s = String(cam.photo || '').trim();
    if (/^https?:\/\//i.test(s) && s.indexOf('/cameras/') !== -1) {
      const mHttps = s.match(/(cam-\d+\.(?:jpe?g|png|webp))$/i);
      if (mHttps) {
        let n = mHttps[1].toLowerCase();
        if (n.substring(n.length - 5) === '.jpeg') n = n.substring(0, n.length - 5) + '.jpg';
        cam.photo = RECORDS_TILES_CF + 'cameras/' + hubId + '/' + n;
      }
      return cam;
    }
    const m = s.match(/(cam-\d+\.(?:jpe?g|png|webp))$/i);
    if (m) {
      let name = m[1].toLowerCase();
      if (name.substring(name.length - 5) === '.jpeg') {
        name = name.substring(0, name.length - 5) + '.jpg';
      }
      cam.photo = RECORDS_TILES_CF + 'cameras/' + hubId + '/' + name;
    }
    return cam;
  });
  return out;
}

function recordsSidecarHubId_(githubId) {
  if (RECORDS_SIDECAR_GIS_SKIP[githubId]) return '';
  if (Object.prototype.hasOwnProperty.call(RECORDS_SIDECAR_HUB_REMAP, githubId)) {
    return RECORDS_SIDECAR_HUB_REMAP[githubId];
  }
  return githubId;
}

function recordsPublishSidecarCameras_(githubId) {
  let rec = githubGetDecodedJson_(RECORDS_GH_CAMERAS + '/' + githubId + '.json');
  if (!rec && typeof fetchCamerasRecord_ === 'function') rec = fetchCamerasRecord_(githubId);
  if (!rec || !Array.isArray(rec.cameras) || !rec.cameras.length) {
    return { kind: 'skip', reason: 'no git cameras JSON for ' + githubId };
  }
  const hubId = recordsSidecarHubId_(githubId);
  if (!hubId) return { kind: 'skip', reason: 'no mothership hub for cameras ' + githubId };
  const body = recordsRewriteCameraPhotos_(rec, hubId);
  const key = RECORDS_FILES_PREFIX.cameras + hubId + '.json';
  recordsPutJson_(key, body);
  recordsUpsertIndex_(hubId, { files: { cameras: { key: key } } });
  return { kind: 'ok', hubId: hubId, key: key };
}

function recordsPublishSidecarGis_(githubId) {
  if (RECORDS_SIDECAR_GIS_SKIP[githubId]) {
    return { kind: 'skip', reason: 'drone-test-only GIS fork ' + githubId };
  }
  const gis = githubGetDecodedJson_(RECORDS_GH_GIS + '/' + githubId + '.json');
  if (!gis) return { kind: 'skip', reason: 'no git gis ' + githubId };
  const hubId = recordsSidecarHubId_(githubId);
  if (!hubId) return { kind: 'skip', reason: 'no mothership hub for gis ' + githubId };
  const body = JSON.parse(JSON.stringify(gis));
  body.property = hubId;
  const key = RECORDS_FILES_PREFIX.gis + hubId + '.json';
  recordsPutJson_(key, body);
  recordsUpsertIndex_(hubId, { files: { gis: { key: key } } });
  return { kind: 'ok', hubId: hubId, key: key };
}

function recordsAttachJonesViews_() {
  const planeKey = RECORDS_FILES_PREFIX.plane + RECORDS_JONES_PLANE + '.json';
  const droneKey = RECORDS_FILES_PREFIX.drone + RECORDS_JONES_DRONE + '.json';
  recordsUpsertIndex_(RECORDS_JONES_HUB, {
    files: {
      plane: { id: RECORDS_JONES_PLANE, key: planeKey },
      drone: { id: RECORDS_JONES_DRONE, key: droneKey }
    },
    views: { plane: 'plane', drone: 'drone' }
  });
  return RECORDS_JONES_HUB;
}

function publishRecordsSidecarsFromGithub() {
  const ui = SpreadsheetApp.getUi();
  const go = ui.alert(
    'Copy cameras + GIS from GitHub',
    'Source is git: data/cameras/json and data/gis (not the Sheet).\n' +
      'Puts them on mothership hubs (site_no hash).\n' +
      'Jones 6de88883… → site_no 14725. Eugene 4a484f8c… → VY-IN-003.\n' +
      'Tracy GIS fork skipped. Also attach Jones plane + drone onto that hub.\n' +
      'JPEGs and parcel tiles: tools/publish-records-static.py from the repo.\n' +
      'Live Pages stays on GitHub.\n\nContinue?',
    ui.ButtonSet.YES_NO);
  if (go !== ui.Button.YES) return;
  const lines = [];
  ['6de88883bfd4a8349a901c54611ed9d7', '4a484f8c273abef3c02cf91e274f9e2f'].forEach(function (id) {
    try {
      const r = recordsPublishSidecarCameras_(id);
      lines.push('cameras ' + githubIdLabel_(r));
    } catch (e) {
      lines.push('cameras ' + id + ' FAIL ' + e.message);
    }
  });
  ['d9f759d7351db3886c79dd689c41e3c0',
    '6de88883bfd4a8349a901c54611ed9d7',
    '2dce25a3643b86a7d8a1551228c3306f'].forEach(function (id) {
    try {
      const r = recordsPublishSidecarGis_(id);
      lines.push('gis ' + githubIdLabel_(r));
    } catch (e) {
      lines.push('gis ' + id + ' FAIL ' + e.message);
    }
  });
  try {
    lines.push('jones views → ' + recordsAttachJonesViews_());
  } catch (e) {
    lines.push('jones views FAIL ' + e.message);
  }
  const text = lines.join('\n');
  Logger.log(text);
  ui.alert('Cameras + GIS → records', text, ui.ButtonSet.OK);
  return text;
}

function githubIdLabel_(r) {
  if (!r) return '?';
  return r.kind + ' ' + (r.hubId || '') + (r.reason ? (' ' + r.reason) : '') + (r.key ? (' ' + r.key) : '');
}

function recordsGithubDir_(filesKey) {
  const d = RECORDS_FILES_GITHUB_DIR[filesKey];
  if (!d) throw new Error('records: no GitHub folder for files key "' + filesKey + '"');
  return d;
}

function recordsCopyGithubJson_(githubPath, s3Key) {
  const rec = githubGetDecodedJson_(githubPath);
  if (!rec) throw new Error('GitHub missing ' + githubPath + ' (listed on the index — refused to publish a hole)');
  recordsPutJson_(s3Key, rec);
  return rec;
}

function recordsPublishHubFromGithub_(hubId) {
  const gh = fetchIndexEntry_(hubId);
  if (!gh) throw new Error('No GitHub data/index/' + hubId + '.json — nothing to copy');
  const viewsIn = gh.views && typeof gh.views === 'object' ? gh.views : {};
  const files = {};
  const viewsOut = {};
  const written = {};
  Object.keys(viewsIn).forEach(function (viewName) {
    const viewId = viewsIn[viewName];
    if (typeof viewId !== 'string' || !viewId) return;
    const filesKey = RECORDS_VIEW_TO_FILES[viewName];
    if (!filesKey) throw new Error('records: unknown view "' + viewName + '"');
    const prefix = RECORDS_FILES_PREFIX[filesKey];
    if (!prefix) throw new Error('records: no S3 prefix for "' + filesKey + '"');
    const s3Key = prefix + viewId + '.json';
    if (!written[s3Key]) {
      recordsCopyGithubJson_(recordsGithubDir_(filesKey) + '/' + viewId + '.json', s3Key);
      written[s3Key] = true;
    }
    const ent = { id: viewId, key: s3Key };
    files[filesKey] = ent;
    viewsOut[viewName] = filesKey;
  });
  const camId = (typeof camerasCanonicalId_ === 'function') ? camerasCanonicalId_(hubId) : hubId;
  if (camId === hubId) {
    let cams = null;
    if (typeof fetchCamerasRecord_ === 'function') {
      cams = fetchCamerasRecord_(hubId);
    } else {
      cams = githubGetDecodedJson_(RECORDS_GH_CAMERAS + '/' + hubId + '.json');
    }
    if (cams && typeof cams === 'object') {
      const ck = RECORDS_FILES_PREFIX.cameras + hubId + '.json';
      recordsPutJson_(ck, cams);
      files.cameras = { key: ck };
    }
  }
  const gis = githubGetDecodedJson_(RECORDS_GH_GIS + '/' + hubId + '.json');
  if (gis) {
    const gk = RECORDS_FILES_PREFIX.gis + hubId + '.json';
    recordsPutJson_(gk, gis);
    files.gis = { key: gk };
  }
  const pins = githubGetDecodedJson_(RECORDS_GH_PINS + '/' + hubId + '.json');
  if (pins) {
    const pk = RECORDS_FILES_PREFIX.pins + hubId + '.json';
    recordsPutJson_(pk, pins);
    files.pins = { key: pk };
  }
  const hoaSlug = String(gh.hoa || '').trim();
  if (hoaSlug) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(hoaSlug)) {
      throw new Error('records: bad hoa slug "' + hoaSlug + '"');
    }
    const hoaPath = RECORDS_GH_HOA + '/' + hoaSlug + '.json';
    const hoaDoc = githubGetDecodedJson_(hoaPath);
    if (!hoaDoc) throw new Error('GitHub missing ' + hoaPath + ' (index.hoa is set)');
    const hk = RECORDS_FILES_PREFIX.hoa + hoaSlug + '.json';
    recordsPutJson_(hk, hoaDoc);
    files.hoa = { slug: hoaSlug, key: hk };
  }
  const patch = {
    id: hubId,
    name: gh.name,
    address: gh.address,
    hoa: gh.hoa,
    account_type: gh.account_type,
    has_nadir: gh.has_nadir,
    files: files,
    views: viewsOut
  };
  if (typeof gh.lat === 'number' && typeof gh.lng === 'number') {
    patch.lat = gh.lat;
    patch.lng = gh.lng;
  }
  const index = recordsWriteIndex_(hubId, patch);
  const back = recordsFetchJson_(recordsIndexKey_(hubId));
  if (!back || back.id !== hubId || !back.files) {
    throw new Error('records: index PUT did not round-trip for ' + hubId);
  }
  return {
    hubId: hubId,
    name: index.name || '',
    files: Object.keys(index.files || {}),
    url: RECORDS_CF_BASE + recordsIndexKey_(hubId)
  };
}

function recordsIdentityFromActiveRow_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet();
  const row = ss.getActiveCell().getRow();
  const tab = String(sheet.getName() || '').trim();
  if (row < 2) throw new Error('Select a data row (not the header).');
  const out = { tab: tab, row: row, siteNo: '', name: '', address: '' };
  if (tab === SATELLITE_SHEET) {
    out.siteNo = String(sheet.getRange(row, SAT_COL_SITE_NO).getValue() || '').trim();
    out.name = String(sheet.getRange(row, SAT_COL_ACCOUNT).getValue() || '').trim();
    out.address = String(sheet.getRange(row, SAT_COL_ADDRESS).getValue() || '').trim();
    return out;
  }
  if (tab === PLANE_SHEET) {
    out.siteNo = String(sheet.getRange(row, PLANE_COL_SITE_NO).getValue() || '').trim();
    out.name = String(sheet.getRange(row, PLANE_COL_ACCOUNT).getValue() || '').trim();
    out.address = String(sheet.getRange(row, PLANE_COL_ADDRESS).getValue() || '').trim();
    return out;
  }
  if (typeof DT_SHEET === 'string' && tab === DT_SHEET) {
    out.siteNo = String(sheet.getRange(row, DT_COL_SITE_NO).getValue() || '').trim();
    out.name = String(sheet.getRange(row, DT_COL_ACCOUNT).getValue() || '').trim();
    out.address = String(sheet.getRange(row, DT_COL_ADDRESS).getValue() || '').trim();
    return out;
  }
  throw new Error('Publish hub works from the Satellite, Plane, or drone-test tab. Active tab is "' + tab + '".');
}

// A GitHub index that only has views.drone-test is a nickname fork
// (Tracy d9f759… / 2dce25a3… at Jones's address). Satellite/Plane
// publish must not pick those when Jones 6de88883… exists.
function recordsIsDroneTestOnly_(entry) {
  const v = (entry && entry.views) || {};
  const keys = Object.keys(v);
  if (!keys.length) return false;
  return keys.every(function (k) { return k === 'drone-test'; });
}

function recordsExpandStreet_(s) {
  let t = ' ' + String(s || '').toLowerCase() + ' ';
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
  t = t.replace(/\bloop\b/g, 'lp');
  return satNormKey_(t);
}

function recordsHouseZip_(s) {
  const t = String(s || '');
  const house = t.match(/^\s*(\d{3,6})\b/);
  const zip = t.match(/\b(\d{5})(?:-\d{4})?\s*$/);
  if (!house || !zip) return null;
  return house[1] + ':' + zip[1];
}

function recordsPickProductionHub_(name, address) {
  const cache = loadIndexNameCache_();
  function pick(list) {
    if (!list || !list.length) return null;
    const prod = list.filter(function (x) { return x && !recordsIsDroneTestOnly_(x.entry); });
    if (!prod.length) return null;
    return chooseIndexHub_(prod, 'production hub');
  }
  const byName = pick(cache.byName[satNormKey_(name)]);
  if (byName) return byName;
  const exact = pick(cache.byAddr[satNormKey_(address)]);
  if (exact) return exact;
  const expanded = recordsExpandStreet_(address);
  const hits = [];
  Object.keys(cache.byAddr).forEach(function (k) {
    if (recordsExpandStreet_(k) !== expanded) return;
    (cache.byAddr[k] || []).forEach(function (x) { hits.push(x); });
  });
  const fromExpand = pick(hits);
  if (fromExpand) return fromExpand;
  const hz = recordsHouseZip_(address);
  if (!hz) return null;
  const hzHits = [];
  Object.keys(cache.byAddr).forEach(function (k) {
    (cache.byAddr[k] || []).forEach(function (x) {
      const a = x && x.entry && x.entry.address;
      if (recordsHouseZip_(a) === hz) hzHits.push(x);
    });
  });
  return pick(hzHits);
}

function recordsResolveHubId_(ident) {
  const siteNo = (typeof satValidSiteNo_ === 'function')
    ? satValidSiteNo_(ident.siteNo)
    : String(ident.siteNo || '').trim();
  const fromSite = siteNo ? satPropertyId_(siteNo, getCredentials().hashSalt) : '';
  if (fromSite) {
    const e = fetchIndexEntry_(fromSite);
    if (e && !recordsIsDroneTestOnly_(e)) return fromSite;
  }
  const prod = recordsPickProductionHub_(ident.name, ident.address);
  if (prod) return prod;
  if (ident.tab === SATELLITE_SHEET || ident.tab === PLANE_SHEET) return null;
  const existing = pickExistingIndexHub_(ident.name, ident.address);
  if (existing && fetchIndexEntry_(existing)) return existing;
  if (fromSite && fetchIndexEntry_(fromSite)) return fromSite;
  return null;
}

function publishRecordsForActiveRow() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet();
  const tab = String(sheet.getName() || '').trim();
  const row = ss.getActiveCell().getRow();
  if (row < 2) {
    ui.alert('Publish row to records', 'Select a data row (not the header).', ui.ButtonSet.OK);
    return;
  }
  const go = ui.alert(
    'Publish row to records',
    'Write this ' + tab + ' row onto s3://' + RECORDS_BUCKET + '.\n' +
      'Hub = hash(site_no) from the Satellite mothership. Live Pages stays on GitHub.\n\nContinue?',
    ui.ButtonSet.YES_NO);
  if (go !== ui.Button.YES) return;
  satSiteNoIndexCache_ = null;
  const creds = getCredentials();
  const width = Math.max(sheet.getLastColumn(), 36);
  const vals = sheet.getRange(row, 1, 1, width).getValues()[0];
  try {
    let r;
    if (tab === SATELLITE_SHEET) r = recordsPublishSatelliteSheetRow_(vals, creds);
    else if (tab === PLANE_SHEET) r = recordsPublishPlaneSheetRow_(vals, creds);
    else if (tab === DRONE_SHEET) r = recordsPublishDroneSheetRow_(vals, creds);
    else if (typeof DT_SHEET === 'string' && tab === DT_SHEET) r = recordsPublishDroneTestSheetRow_(vals, creds);
    else if (typeof NEARMAP_SHEET === 'string' && tab === NEARMAP_SHEET) r = recordsPublishNearmapSheetRow_(sheet, row, creds);
    else {
      ui.alert('Publish row to records',
        'Supported tabs: Satellite, Plane, Drone, drone-test, Nearmap. Active tab is "' + tab + '".',
        ui.ButtonSet.OK);
      return;
    }
    const msg = r.kind === 'skip'
      ? ('Skipped: ' + r.reason)
      : (r.kind + ' hub ' + (r.hubId || r.satId || '') + ' (' + (r.name || '') + ')' +
        (r.viewId ? ('\nview ' + r.viewId) : '') +
        '\n' + RECORDS_CF_BASE + 'index/' + (r.hubId || r.satId) + '.json');
    Logger.log(msg);
    ui.alert('Publish row to records', msg, ui.ButtonSet.OK);
    return r;
  } catch (e) {
    Logger.log('publishRecordsForActiveRow: ' + e.message);
    ui.alert('Publish row to records failed', e.message, ui.ButtonSet.OK);
  }
}

// ── Mass publish (notable tabs → unique production hubs) ──────────────────────
// Apps Script dies at 6 minutes. Each hub is several GitHub GETs + S3 PUTs.
// Collect unique hubs from Satellite / Plane / drone-test / Drone /
// Interior / Nearmap, skip drone-test-only forks, then copy until the
// time budget. Resume from Script Properties. Does not stop GitHub sync.

const RECORDS_MASS_PROP = 'RECORDS_MASS_STATE';
const RECORDS_MASS_MAX_MS = 4.5 * 60 * 1000;
const RECORDS_MASS_ERR_CAP = 25;

function recordsMassSheetSpecs_() {
  const specs = [
    { tab: SATELLITE_SHEET, siteCol: SAT_COL_SITE_NO, nameCol: SAT_COL_ACCOUNT, addrCol: SAT_COL_ADDRESS },
    { tab: PLANE_SHEET, siteCol: PLANE_COL_SITE_NO, nameCol: PLANE_COL_ACCOUNT, addrCol: PLANE_COL_ADDRESS }
  ];
  if (typeof DT_SHEET === 'string' && typeof DT_COL_ACCOUNT === 'number') {
    specs.push({
      tab: DT_SHEET,
      siteCol: (typeof DT_COL_SITE_NO === 'number') ? DT_COL_SITE_NO : 0,
      nameCol: DT_COL_ACCOUNT,
      addrCol: DT_COL_ADDRESS
    });
  }
  specs.push({ tab: DRONE_SHEET, siteCol: 0, nameCol: COL_ACCOUNT, addrCol: COL_ADDRESS });
  specs.push({ tab: INTERIOR_SHEET, siteCol: 0, nameCol: COL_ACCOUNT, addrCol: COL_ADDRESS });
  if (typeof NEARMAP_SHEET === 'string' && typeof NM_COL_SITE_NO === 'number') {
    specs.push({
      tab: NEARMAP_SHEET,
      siteCol: NM_COL_SITE_NO,
      nameCol: NM_COL_ACCOUNT,
      addrCol: NM_COL_ADDRESS
    });
  }
  return specs;
}

function recordsByIdFromCache_() {
  const cache = loadIndexNameCache_();
  const byId = {};
  ['byName', 'byAddr'].forEach(function (mapName) {
    const map = cache[mapName] || {};
    Object.keys(map).forEach(function (k) {
      (map[k] || []).forEach(function (x) {
        if (x && x.id) byId[x.id] = x.entry;
      });
    });
  });
  return byId;
}

function recordsResolveHubIdCached_(ident, byId) {
  const siteNo = (typeof satValidSiteNo_ === 'function')
    ? satValidSiteNo_(ident.siteNo)
    : String(ident.siteNo || '').trim();
  const fromSite = siteNo ? satPropertyId_(siteNo, getCredentials().hashSalt) : '';
  if (fromSite && byId[fromSite] && !recordsIsDroneTestOnly_(byId[fromSite])) return fromSite;
  const prod = recordsPickProductionHub_(ident.name, ident.address);
  if (prod) return prod;
  if (ident.tab === SATELLITE_SHEET || ident.tab === PLANE_SHEET) return null;
  const existing = pickExistingIndexHub_(ident.name, ident.address);
  if (existing && byId[existing] && !recordsIsDroneTestOnly_(byId[existing])) return existing;
  if (fromSite && byId[fromSite] && !recordsIsDroneTestOnly_(byId[fromSite])) return fromSite;
  return null;
}

function recordsCollectHubIdsFromNotableTabs_() {
  indexNameCache_ = null;
  const byId = recordsByIdFromCache_();
  const seen = {};
  const ids = [];
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const specs = recordsMassSheetSpecs_();
  specs.forEach(function (spec) {
    const sheet = ss.getSheetByName(spec.tab);
    if (!sheet) {
      Logger.log('records mass: no sheet "' + spec.tab + '"');
      return;
    }
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const ident = {
        tab: spec.tab,
        siteNo: spec.siteCol ? String(row[spec.siteCol - 1] || '').trim() : '',
        name: String(row[spec.nameCol - 1] || '').trim(),
        address: String(row[spec.addrCol - 1] || '').trim()
      };
      if (!ident.siteNo && !ident.name && !ident.address) continue;
      const hubId = recordsResolveHubIdCached_(ident, byId);
      if (!hubId || seen[hubId]) continue;
      if (recordsIsDroneTestOnly_(byId[hubId])) continue;
      seen[hubId] = true;
      ids.push(hubId);
    }
    Logger.log('records mass: ' + spec.tab + ' → running unique ' + ids.length);
  });
  return ids;
}

function recordsMassLoad_() {
  const raw = PropertiesService.getScriptProperties().getProperty(RECORDS_MASS_PROP);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

function recordsMassSave_(state) {
  PropertiesService.getScriptProperties().setProperty(RECORDS_MASS_PROP, JSON.stringify(state));
}

function recordsMassClear_() {
  PropertiesService.getScriptProperties().deleteProperty(RECORDS_MASS_PROP);
}

function recordsMassTick_(state, started) {
  const n = (state.ids || []).length;
  const i = state.i || 0;
  while (state.i < n) {
    if (Date.now() - started > RECORDS_MASS_MAX_MS) {
      recordsMassSave_(state);
      return { done: false, state: state };
    }
    const hubId = state.ids[state.i];
    try {
      const r = recordsPublishHubFromGithub_(hubId);
      state.ok = (state.ok || 0) + 1;
      Logger.log('records mass ok ' + (state.i + 1) + '/' + n + ' ' + r.hubId + ' ' + r.name);
    } catch (e) {
      state.fail = (state.fail || 0) + 1;
      const msg = hubId + ': ' + e.message;
      Logger.log('records mass fail ' + msg);
      if (!state.errors) state.errors = [];
      if (state.errors.length < RECORDS_MASS_ERR_CAP) state.errors.push(msg);
    }
    state.i = state.i + 1;
    recordsMassSave_(state);
    if ((state.i % 5) === 0) {
      try {
        SpreadsheetApp.getActiveSpreadsheet().toast(
          'Records mass ' + state.i + '/' + n + ' (ok ' + state.ok + ', fail ' + (state.fail || 0) + ')',
          'property-intel-records', 8);
      } catch (e2) {}
    }
  }
  recordsMassClear_();
  return { done: true, state: state };
}

function recordsMassSummary_(result) {
  const s = result.state || {};
  const n = (s.ids || []).length;
  const lines = [
    (result.done ? 'Finished.' : 'Paused at 4.5 min — run Resume mass publish.'),
    'Hubs: ' + (s.i || 0) + ' / ' + n,
    'ok: ' + (s.ok || 0) + '  fail: ' + (s.fail || 0)
  ];
  if (s.errors && s.errors.length) {
    lines.push('Errors (first ' + s.errors.length + '):');
    s.errors.forEach(function (e) { lines.push('  ' + e); });
  }
  if (!result.done) {
    lines.push('Remaining: ' + (n - (s.i || 0)));
  }
  return lines.join('\n');
}

function publishRecordsAllHubs() {
  const ui = SpreadsheetApp.getUi();
  const existing = recordsMassLoad_();
  if (existing && existing.ids && existing.i < existing.ids.length) {
    const ans = ui.alert(
      'Mass publish already in progress',
      'In progress: ' + (existing.i || 0) + ' / ' + existing.ids.length +
        ' (ok ' + (existing.ok || 0) + ', fail ' + (existing.fail || 0) + ').\n\n' +
        'YES = resume. NO = start over (re-collect from sheets).',
      ui.ButtonSet.YES_NO);
    if (ans === ui.Button.YES) {
      resumeRecordsMassPublish();
      return;
    }
    if (ans !== ui.Button.NO) return;
    recordsMassClear_();
  }
  const go = ui.alert(
    'Publish all hubs to records',
    'Collect unique production hubs from Satellite, Plane, drone-test, Drone, Interior, and Nearmap (GitHub → s3://' +
      RECORDS_BUCKET + '). Skips drone-test-only forks. Live Pages stays on GitHub.\n\n' +
      'This will take several runs if there are many properties. Continue?',
    ui.ButtonSet.YES_NO);
  if (go !== ui.Button.YES) return;
  const started = Date.now();
  const ids = recordsCollectHubIdsFromNotableTabs_();
  if (!ids.length) {
    ui.alert('Mass publish', 'No production hubs resolved from those tabs.', ui.ButtonSet.OK);
    return;
  }
  const state = { ids: ids, i: 0, ok: 0, fail: 0, errors: [], started: new Date().toISOString() };
  recordsMassSave_(state);
  const result = recordsMassTick_(state, started);
  const text = recordsMassSummary_(result);
  Logger.log(text);
  ui.alert('Mass publish', text, ui.ButtonSet.OK);
}

function resumeRecordsMassPublish() {
  const ui = SpreadsheetApp.getUi();
  const state = recordsMassLoad_();
  if (!state || !state.ids || state.i >= state.ids.length) {
    ui.alert('Resume mass publish', 'Nothing to resume. Run Publish all hubs from notable tabs.', ui.ButtonSet.OK);
    return;
  }
  const result = recordsMassTick_(state, Date.now());
  const text = recordsMassSummary_(result);
  Logger.log(text);
  ui.alert('Mass publish', text, ui.ButtonSet.OK);
}

function checkRecordsMassPublish() {
  const ui = SpreadsheetApp.getUi();
  const state = recordsMassLoad_();
  if (!state || !state.ids) {
    ui.alert('Mass publish status', 'Idle. No run in progress.', ui.ButtonSet.OK);
    return;
  }
  ui.alert('Mass publish status', recordsMassSummary_({
    done: state.i >= state.ids.length,
    state: state
  }), ui.ButtonSet.OK);
}

function cancelRecordsMassPublish() {
  recordsMassClear_();
  try {
    SpreadsheetApp.getUi().alert('Mass publish', 'Cleared. Next full run will re-collect.', SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) {}
}

// ── Sheet → records (mothership) ─────────────────────────────────────────────
// One house, one index: index/{hashId(slug(site_no))}.json
// Satellite owns identity + files.satellite + views.security/wildfire + hoa.
// Plane / drone / drone-test / nearmap only merge the files/views they own.

const RECORDS_SHEET_MASS_PROP = 'RECORDS_SHEET_MASS_STATE';
const RECORDS_SAT_MASS_PROP = 'RECORDS_SHEET_MASS_STATE';
const RECORDS_SHEET_PHASES = ['satellite', 'plane', 'drone', 'drone-test', 'nearmap', 'retry', 'hoa'];

function recordsKeepParcelRing_(satId, rec) {
  const prev = recordsFetchJson_(RECORDS_FILES_PREFIX.satellite + satId + '.json');
  if (prev && prev.parcel_ring) rec.parcel_ring = prev.parcel_ring;
  return rec;
}

function recordsPutSatPins_(hubId, propertyData) {
  const key = RECORDS_FILES_PREFIX.pins + hubId + '.json';
  const existing = recordsFetchJson_(key);
  if (existing && existing.source === '3d') {
    Logger.log('records sat: keep 3d pins for ' + hubId);
    return null;
  }
  const element = (propertyData && propertyData.elements) || [];
  const concern = (propertyData && propertyData.fr && propertyData.fr.concerns) || [];
  if (!element.length && !concern.length) return null;
  recordsPutJson_(key, {
    property: hubId,
    source: 'satellite',
    element: element,
    concern: concern,
    poi: []
  });
  return key;
}

function recordsPublishSatelliteSheetRow_(row, creds) {
  const accountName = String(row[SAT_COL_ACCOUNT - 1] || '').trim();
  const address = String(row[SAT_COL_ADDRESS - 1] || '').trim();
  if (!accountName || !address) return { kind: 'skip', reason: 'no name/address' };

  const siteNo = satValidSiteNo_(row[SAT_COL_SITE_NO - 1]);
  if (!siteNo) return { kind: 'skip', reason: 'blank site_no [' + accountName + ']' };

  const satId = satPropertyId_(siteNo, creds.hashSalt);
  if (!satId) return { kind: 'skip', reason: 'site_no did not hash' };

  const accountType = normalizeAccountType(row[SAT_COL_ACCOUNT_TYPE - 1]);
  const hoaTag = row[SAT_COL_HOA - 1];
  const hoaSlug = slugify(hoaTag);
  const nadirUrl = String(row[SAT_COL_NADIR_URL - 1] || '').trim();
  const elementsRaw = String(row[SAT_COL_ELEMENTS - 1] || '').trim();
  const lat = parseFloat(row[SAT_COL_LAT - 1]);
  const lng = parseFloat(row[SAT_COL_LNG - 1]);
  const hasPins = !!(elementsRaw && elementsRaw.indexOf('ERROR:') !== 0);

  const identity = {
    name: accountName,
    address: address,
    hoa: hoaSlug || '',
    account_type: accountType,
    site_no: siteNo
  };
  if (!isNaN(lat) && !isNaN(lng)) {
    identity.lat = lat;
    identity.lng = lng;
  }

  let propertyData = null;
  const satKey = RECORDS_FILES_PREFIX.satellite + satId + '.json';
  if (hasPins) {
    propertyData = {
      name: accountName,
      address: address,
      hoa: hoaSlug || '',
      account_type: accountType,
      nadir_url: nadirUrl,
      elements: parsePinCell_(elementsRaw),
      fr: {
        concerns: parsePinCell_(row[SAT_COL_FR_CONCERNS - 1]),
        considerations: String(row[SAT_COL_FR_CONSIDER - 1] || '').trim(),
        recommendations: String(row[SAT_COL_FR_REC - 1] || '').trim()
      },
      wildfire: {
        concerns: parsePinCell_(row[SAT_COL_WF_CONCERNS - 1]),
        considerations: String(row[SAT_COL_WF_CONSIDER - 1] || '').trim(),
        recommendations: String(row[SAT_COL_WF_REC - 1] || '').trim()
      }
    };
    if (!isNaN(lat) && !isNaN(lng)) {
      propertyData.lat = lat;
      propertyData.lng = lng;
    }
    recordsKeepParcelRing_(satId, propertyData);
    recordsPutJson_(satKey, propertyData);
  }

  const patch = {
    name: identity.name,
    address: identity.address,
    hoa: identity.hoa,
    account_type: identity.account_type,
    site_no: siteNo,
    files: {}
  };
  if (typeof identity.lat === 'number') {
    patch.lat = identity.lat;
    patch.lng = identity.lng;
  }
  if (hoaSlug) {
    patch.files.hoa = { slug: hoaSlug, key: RECORDS_FILES_PREFIX.hoa + hoaSlug + '.json' };
  }
  if (hasPins) {
    patch.has_nadir = true;
    patch.files.satellite = { id: satId, key: satKey };
    patch.views = { security: 'satellite', wildfire: 'satellite' };
    const pinsKey = recordsPutSatPins_(satId, propertyData);
    if (pinsKey) patch.files.pins = { key: pinsKey };
  }
  recordsUpsertIndex_(satId, patch);

  return {
    kind: hasPins ? 'ok' : 'stub',
    satId: satId,
    hubId: satId,
    name: accountName
  };
}

function recordsHubId_(opts, creds) {
  return indexHubId_({
    siteNo: opts.siteNo,
    accountName: opts.accountName,
    address: opts.address,
    salt: creds.hashSalt
  });
}

function recordsPut3dPins_(hubId, element, concern) {
  const el = element || [];
  const co = concern || [];
  if (!el.length && !co.length) return null;
  const key = RECORDS_FILES_PREFIX.pins + hubId + '.json';
  recordsPutJson_(key, {
    property: hubId,
    source: '3d',
    element: el,
    concern: co,
    poi: []
  });
  return key;
}

function recordsViewPatch_(filesKey, viewName, viewId) {
  const prefix = RECORDS_FILES_PREFIX[filesKey];
  const s3Key = prefix + viewId + '.json';
  const files = {};
  files[filesKey] = { id: viewId, key: s3Key };
  const views = {};
  views[viewName] = filesKey;
  return { s3Key: s3Key, files: files, views: views };
}

function recordsPublishPlaneSheetRow_(row, creds) {
  const accountName = String(row[PLANE_COL_ACCOUNT - 1] || '').trim();
  const address = String(row[PLANE_COL_ADDRESS - 1] || '').trim();
  if (!accountName || !address) return { kind: 'skip', reason: 'no name/address' };
  const nadirUrl = String(row[PLANE_COL_NADIR_URL - 1] || '').trim();
  const elementsRaw = String(row[PLANE_COL_ELEMENTS - 1] || '').trim();
  const alphaUrl = String(row[PLANE_COL_ALPHA_URL - 1] || '').trim();
  const alphaDesc = String(row[PLANE_COL_ALPHA_DESC - 1] || '').trim();
  const bravoUrl = String(row[PLANE_COL_BRAVO_URL - 1] || '').trim();
  const bravoDesc = String(row[PLANE_COL_BRAVO_DESC - 1] || '').trim();
  const charlieUrl = String(row[PLANE_COL_CHARLIE_URL - 1] || '').trim();
  const charlieDesc = String(row[PLANE_COL_CHARLIE_DESC - 1] || '').trim();
  const deltaUrl = String(row[PLANE_COL_DELTA_URL - 1] || '').trim();
  const deltaDesc = String(row[PLANE_COL_DELTA_DESC - 1] || '').trim();
  if (!nadirUrl || !elementsRaw || !alphaUrl || !alphaDesc ||
      !bravoUrl || !bravoDesc || !charlieUrl || !charlieDesc ||
      !deltaUrl || !deltaDesc) {
    return { kind: 'skip', reason: 'incomplete [' + accountName + ']' };
  }
  if (alphaDesc.indexOf('ERROR:') === 0) {
    return { kind: 'skip', reason: 'errored descriptions [' + accountName + ']' };
  }
  let elementPins = [], concernPins = [], bounds = null;
  try { elementPins = JSON.parse(elementsRaw) || []; } catch (e) {
    return { kind: 'skip', reason: 'bad Nadir Elements JSON [' + accountName + ']' };
  }
  const concernsRaw = String(row[PLANE_COL_CONCERNS_P - 1] || '').trim();
  if (concernsRaw) {
    try { concernPins = JSON.parse(concernsRaw) || []; } catch (e) {
      return { kind: 'skip', reason: 'bad Nadir Concerns JSON [' + accountName + ']' };
    }
  }
  try {
    const boundsRaw = String(row[PLANE_COL_NADIR_BOUNDS - 1] || '').trim();
    bounds = boundsRaw ? JSON.parse(boundsRaw) : null;
  } catch (e) { bounds = null; }

  const hubId = recordsHubId_({
    siteNo: row[PLANE_COL_SITE_NO - 1],
    accountName: accountName,
    address: address
  }, creds);
  if (!hubId) {
    return { kind: 'skip', reason: 'no unique Satellite site_no [' + accountName + '] — set Plane column AC' };
  }

  const viewId = hashId(slugify(accountName) + '-plane', creds.hashSalt);
  const loc = recordsViewPatch_('plane', 'plane', viewId);
  const lat = parseFloat(row[PLANE_COL_LAT - 1]);
  const lng = parseFloat(row[PLANE_COL_LNG - 1]);
  const propertyData = {
    name: accountName,
    address: address,
    view: 'plane',
    hoa: slugify(row[PLANE_COL_HOA - 1]) || '',
    account_type: normalizeAccountType(row[PLANE_COL_ACCOUNT_TYPE - 1]),
    nadir: {
      url: nadirUrl,
      pins: elementPins.concat(concernPins),
      element_pins: elementPins,
      concern_pins: concernPins,
      bounds: bounds
    },
    alpha: { url: alphaUrl, desc: toBullets(alphaDesc) },
    bravo: { url: bravoUrl, desc: toBullets(bravoDesc) },
    charlie: { url: charlieUrl, desc: toBullets(charlieDesc) },
    delta: { url: deltaUrl, desc: toBullets(deltaDesc) },
    considerations: String(row[PLANE_COL_CONSIDER - 1] || ''),
    clarifications: String(row[PLANE_COL_CLARIFY - 1] || ''),
    viewer360: String(row[PLANE_COL_VIEWER360 - 1] || '')
  };
  if (!isNaN(lat) && !isNaN(lng)) { propertyData.lat = lat; propertyData.lng = lng; }
  recordsPutJson_(loc.s3Key, propertyData);

  const patch = { files: loc.files, views: loc.views };
  const pinsKey = recordsPut3dPins_(hubId, elementPins, concernPins);
  if (pinsKey) patch.files.pins = { key: pinsKey };
  recordsUpsertIndex_(hubId, patch);
  return { kind: 'ok', hubId: hubId, viewId: viewId, name: accountName };
}

function recordsPublishDroneSheetRow_(row, creds) {
  const accountName = String(row[RI_C.NAME] || '').trim();
  const address = String(row[RI_C.ADDR] || '').trim();
  if (!accountName || !address) return { kind: 'skip', reason: 'no name/address' };
  const missing = (typeof riMissingFields_ === 'function') ? riMissingFields_(row) : [];
  if (missing && missing.length) {
    return { kind: 'skip', reason: 'incomplete [' + accountName + ']: ' + missing.join(', ') };
  }
  const hubId = recordsHubId_({ accountName: accountName, address: address }, creds);
  if (!hubId) {
    return { kind: 'skip', reason: 'no unique Satellite site_no [' + accountName + ']' };
  }
  const riSalt = (typeof riCreds_ === 'function') ? riCreds_().hashSalt : creds.hashSalt;
  const viewId = (typeof riHashId_ === 'function')
    ? riHashId_(riSlug_(accountName) + '-' + RI_VIEW_SUFFIX, riSalt)
    : hashId(slugify(accountName) + '-drone', creds.hashSalt);
  const loc = recordsViewPatch_('drone', 'drone', viewId);
  const payload = (typeof riBuildPayload_ === 'function')
    ? riBuildPayload_(row)
    : { name: accountName, address: address, view: 'drone' };
  recordsPutJson_(loc.s3Key, payload);
  recordsUpsertIndex_(hubId, { files: loc.files, views: loc.views });
  return { kind: 'ok', hubId: hubId, viewId: viewId, name: accountName };
}

function recordsPublishDroneTestSheetRow_(row, creds, beforeAnalysis) {
  const accountName = String(row[DT_COL_ACCOUNT - 1] || '').trim();
  const address = String(row[DT_COL_ADDRESS - 1] || '').trim();
  if (!accountName || !address) return { kind: 'skip', reason: 'no name/address' };
  const nadirUrl = String(row[DT_COL_NADIR_URL - 1] || '').trim();
  const elementsRaw = String(row[DT_COL_ELEMENTS - 1] || '').trim();
  const alphaUrl = String(row[DT_COL_ALPHA_URL - 1] || '').trim();
  const alphaDesc = String(row[DT_COL_ALPHA_DESC - 1] || '').trim();
  const bravoUrl = String(row[DT_COL_BRAVO_URL - 1] || '').trim();
  const bravoDesc = String(row[DT_COL_BRAVO_DESC - 1] || '').trim();
  const charlieUrl = String(row[DT_COL_CHARLIE_URL - 1] || '').trim();
  const charlieDesc = String(row[DT_COL_CHARLIE_DESC - 1] || '').trim();
  const deltaUrl = String(row[DT_COL_DELTA_URL - 1] || '').trim();
  const deltaDesc = String(row[DT_COL_DELTA_DESC - 1] || '').trim();
  const viewer360 = String(row[DT_COL_VIEWER360 - 1] || '').trim();
  if (beforeAnalysis) {
    if (!viewer360) return { kind: 'skip', reason: 'need 360 View URL [' + accountName + ']' };
  } else if (!nadirUrl || !alphaUrl || !alphaDesc ||
      !bravoUrl || !bravoDesc || !charlieUrl || !charlieDesc ||
      !deltaUrl || !deltaDesc) {
    return { kind: 'skip', reason: 'incomplete [' + accountName + ']' };
  }
  if (!beforeAnalysis && alphaDesc.indexOf('ERROR:') === 0) {
    return { kind: 'skip', reason: 'errored descriptions [' + accountName + ']' };
  }
  let elementPins = [], concernPins = [], bounds = null, localCorners = null;
  if (elementsRaw) {
    try { elementPins = JSON.parse(elementsRaw) || []; } catch (e) {
      return { kind: 'skip', reason: 'bad Nadir Elements JSON [' + accountName + ']' };
    }
  }
  const concernsRaw = String(row[DT_COL_CONCERNS - 1] || '').trim();
  if (concernsRaw) {
    try { concernPins = JSON.parse(concernsRaw) || []; } catch (e) {
      return { kind: 'skip', reason: 'bad Nadir Concerns JSON [' + accountName + ']' };
    }
  }
  try {
    const boundsRaw = String(row[DT_COL_NADIR_BOUNDS - 1] || '').trim();
    bounds = boundsRaw ? JSON.parse(boundsRaw) : null;
  } catch (e) { bounds = null; }
  try {
    const localRaw = String(row[DT_COL_NADIR_LOCAL - 1] || '').trim();
    localCorners = localRaw ? JSON.parse(localRaw) : null;
  } catch (e) { localCorners = null; }

  const hubId = recordsHubId_({
    siteNo: (typeof DT_COL_SITE_NO === 'number') ? row[DT_COL_SITE_NO - 1] : '',
    accountName: accountName,
    address: address
  }, creds);
  if (!hubId) {
    return { kind: 'skip', reason: 'no unique Satellite site_no [' + accountName + '] — will not mint a name-hash hub' };
  }

  const viewId = hashId(slugify(accountName) + '-drone-test', creds.hashSalt);
  const loc = recordsViewPatch_('drone-test', 'drone-test', viewId);
  let directions = [];
  if (typeof rdDirectionsForProperty_ === 'function') {
    const dir = rdDirectionsForProperty_(accountName);
    directions = (dir && dir.directions) || [];
    if (typeof dtAttachLocalXY_ === 'function') dtAttachLocalXY_(directions, localCorners);
  }
  const lat = parseFloat(row[DT_COL_LAT - 1]);
  const lng = parseFloat(row[DT_COL_LNG - 1]);
  let propertyData = {
    name: accountName,
    address: address,
    view: 'drone-test',
    hoa: slugify(row[DT_COL_HOA - 1]) || '',
    account_type: normalizeAccountType(row[DT_COL_ACCOUNT_TYPE - 1]),
    capture: String(row[DT_COL_CAPTURE - 1] || '').trim(),
    nadir: {
      url: nadirUrl,
      pins: elementPins.concat(concernPins),
      element_pins: elementPins,
      concern_pins: concernPins,
      bounds: bounds,
      local: localCorners
    },
    alpha: { url: alphaUrl, desc: toBullets(alphaDesc) },
    bravo: { url: bravoUrl, desc: toBullets(bravoDesc) },
    charlie: { url: charlieUrl, desc: toBullets(charlieDesc) },
    delta: { url: deltaUrl, desc: toBullets(deltaDesc) },
    considerations: String(row[DT_COL_CONSIDER - 1] || ''),
    clarifications: String(row[DT_COL_CLARIFY - 1] || ''),
    viewer360: viewer360,
    directions: directions
  };
  if (!isNaN(lat) && !isNaN(lng)) { propertyData.lat = lat; propertyData.lng = lng; }
  if (beforeAnalysis && typeof dtMergeEarlyView_ === 'function') {
    propertyData = dtMergeEarlyView_(propertyData, dtExistingView_(viewId));
  }
  recordsPutJson_(loc.s3Key, propertyData);

  const patch = { files: loc.files, views: loc.views };
  const pinsKey = recordsPut3dPins_(hubId, elementPins, concernPins);
  if (pinsKey) patch.files.pins = { key: pinsKey };
  recordsUpsertIndex_(hubId, patch);
  return { kind: 'ok', hubId: hubId, viewId: viewId, name: accountName };
}

function recordsPublishNearmapSheetRow_(sheet, rowNum, creds) {
  const siteNo = nmValidSiteNo_(sheet.getRange(rowNum, NM_COL_SITE_NO).getValue());
  if (!siteNo) return { kind: 'skip', reason: 'blank site_no row ' + rowNum };
  const nadirUrl = String(sheet.getRange(rowNum, NM_COL_NADIR_URL).getValue() || '').trim();
  if (!nadirUrl) return { kind: 'skip', reason: 'no nadir row ' + rowNum };
  const hubId = nmPropertyId_(siteNo, creds.hashSalt);
  const rec = nmBuildRecord_(sheet, rowNum, hubId);
  const loc = recordsViewPatch_('nearmap', 'nearmap', hubId);
  recordsPutJson_(loc.s3Key, rec);
  recordsUpsertIndex_(hubId, { files: loc.files, views: loc.views });
  return { kind: 'ok', hubId: hubId, name: rec.name || '' };
}

function recordsSatMassLoad_() {
  const raw = PropertiesService.getScriptProperties().getProperty(RECORDS_SAT_MASS_PROP);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

function recordsSatMassSave_(state) {
  PropertiesService.getScriptProperties().setProperty(RECORDS_SAT_MASS_PROP, JSON.stringify(state));
}

function recordsSatMassClear_() {
  PropertiesService.getScriptProperties().deleteProperty(RECORDS_SAT_MASS_PROP);
}

function recordsBuildHoaMapFromSatelliteSheet_(data) {
  const creds = getCredentials();
  const hoaMap = {};
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const accountName = String(row[SAT_COL_ACCOUNT - 1] || '').trim();
    const address = String(row[SAT_COL_ADDRESS - 1] || '').trim();
    if (!accountName || !address) continue;
    const siteNo = satValidSiteNo_(row[SAT_COL_SITE_NO - 1]);
    if (!siteNo) continue;
    const satId = satPropertyId_(siteNo, creds.hashSalt);
    if (!satId) continue;
    const hoaTag = row[SAT_COL_HOA - 1];
    const hoaSlug = slugify(hoaTag);
    if (!hoaSlug) continue;
    if (!hoaMap[hoaSlug]) hoaMap[hoaSlug] = { name: hoaTag, properties: [] };
    if (hoaMap[hoaSlug].properties.indexOf(satId) === -1) {
      hoaMap[hoaSlug].properties.push(satId);
    }
  }
  return hoaMap;
}

function recordsCollectRetryJobs_(state) {
  const seen = {};
  const jobs = [];
  function add(phase, row) {
    const p = String(phase || 'satellite').toLowerCase();
    const n = parseInt(row, 10);
    if (!n || n < 2) return;
    if (p === 'retry' || p === 'hoa') return;
    const k = p + ':' + n;
    if (seen[k]) return;
    seen[k] = true;
    jobs.push({ phase: p, row: n });
  }
  (state.failRows || []).forEach(function (j) {
    if (j) add(j.phase, j.row);
  });
  (state.errors || []).forEach(function (e) {
    const m = String(e || '').match(/^(satellite|plane|drone-test|drone|nearmap) row (\d+)/i);
    if (m) add(m[1].toLowerCase(), m[2]);
  });
  return jobs;
}

function recordsPublishSheetJob_(job, creds, ss) {
  const phase = job.phase;
  const rowNum = job.row;
  let tab = SATELLITE_SHEET;
  if (phase === 'plane') tab = PLANE_SHEET;
  else if (phase === 'drone') tab = DRONE_SHEET;
  else if (phase === 'drone-test') tab = DT_SHEET;
  else if (phase === 'nearmap') tab = NEARMAP_SHEET;
  const sheet = ss.getSheetByName(tab);
  if (!sheet) throw new Error('no tab "' + tab + '"');
  if (phase === 'nearmap') return recordsPublishNearmapSheetRow_(sheet, rowNum, creds);
  const width = Math.max(sheet.getLastColumn(), 36);
  const vals = sheet.getRange(rowNum, 1, 1, width).getValues()[0];
  if (phase === 'satellite') return recordsPublishSatelliteSheetRow_(vals, creds);
  if (phase === 'plane') return recordsPublishPlaneSheetRow_(vals, creds);
  if (phase === 'drone') return recordsPublishDroneSheetRow_(vals, creds);
  if (phase === 'drone-test') return recordsPublishDroneTestSheetRow_(vals, creds);
  throw new Error('unknown phase "' + phase + '"');
}

function recordsRetryFailTick_(state, creds, started, ss, bump_, noteFail_) {
  const jobs = recordsCollectRetryJobs_(state);
  if (typeof state.retryI !== 'number') state.retryI = 0;
  state.n = jobs.length;
  if (!jobs.length) {
    Logger.log('records retry: nothing to retry');
    return true;
  }
  while (state.retryI < jobs.length) {
    if (Date.now() - started > RECORDS_MASS_MAX_MS) {
      recordsSatMassSave_(state);
      return false;
    }
    const job = jobs[state.retryI];
    try {
      const r = recordsPublishSheetJob_(job, creds, ss);
      bump_('retry', (r.kind === 'ok' || r.kind === 'stub' || r.kind === 'skip') ? r.kind : 'skip');
      Logger.log('records retry ' + r.kind + ' ' + job.phase + ' row ' + job.row + ' ' + (r.name || ''));
    } catch (e) {
      noteFail_('retry', job.phase + ' row ' + job.row + ': ' + e.message);
    }
    state.retryI = state.retryI + 1;
    recordsSatMassSave_(state);
  }
  return true;
}

function recordsSatMassTick_(state, started) {
  if (state.phase === 'rows') state.phase = 'satellite';
  satSiteNoIndexCache_ = null;
  const creds = getCredentials();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!state.tally) state.tally = {};
  if (typeof state.hoaI !== 'number') state.hoaI = 0;

  function bump_(phase, kind) {
    if (!state.tally[phase]) state.tally[phase] = { ok: 0, stub: 0, skip: 0, fail: 0 };
    state.tally[phase][kind] = (state.tally[phase][kind] || 0) + 1;
  }

  function timedOut_() {
    return Date.now() - started > RECORDS_MASS_MAX_MS;
  }

  function noteFail_(phase, msg, sheetRow) {
    bump_(phase, 'fail');
    Logger.log('records sheet fail ' + phase + ' ' + msg);
    if (!state.errors) state.errors = [];
    if (state.errors.length < RECORDS_MASS_ERR_CAP) state.errors.push(phase + ' ' + msg);
    if (sheetRow) {
      if (!state.failRows) state.failRows = [];
      if (state.failRows.length < 200) {
        state.failRows.push({ phase: phase, row: sheetRow });
      }
    }
  }

  while (state.phase && state.phase !== 'hoa') {
    const phase = state.phase;
    if (phase === 'retry') {
      if (state.retryArmed !== true) {
        state.retryI = 0;
        state.retryArmed = true;
      }
      if (!recordsRetryFailTick_(state, creds, started, ss, bump_, noteFail_)) {
        return { done: false, state: state };
      }
      state.phase = 'hoa';
      recordsSatMassSave_(state);
      continue;
    }
    let tab = '';
    if (phase === 'satellite') tab = SATELLITE_SHEET;
    else if (phase === 'plane') tab = PLANE_SHEET;
    else if (phase === 'drone') tab = DRONE_SHEET;
    else if (phase === 'drone-test') tab = (typeof DT_SHEET === 'string') ? DT_SHEET : '';
    else if (phase === 'nearmap') tab = (typeof NEARMAP_SHEET === 'string') ? NEARMAP_SHEET : '';
    else {
      state.phase = 'hoa';
      break;
    }
    const sheet = tab ? ss.getSheetByName(tab) : null;
    if (!sheet) {
      Logger.log('records sheet: no tab "' + tab + '" — skipping ' + phase);
      const idx = RECORDS_SHEET_PHASES.indexOf(phase);
      state.phase = RECORDS_SHEET_PHASES[idx + 1] || 'hoa';
      state.i = 0;
      continue;
    }
    const data = sheet.getDataRange().getValues();
    const nRows = Math.max(0, data.length - 1);
    state.n = nRows;
    while (state.i < nRows) {
      if (timedOut_()) {
        recordsSatMassSave_(state);
        return { done: false, state: state };
      }
      const sheetRow = state.i + 2;
      try {
        let r;
        if (phase === 'satellite') r = recordsPublishSatelliteSheetRow_(data[state.i + 1], creds);
        else if (phase === 'plane') r = recordsPublishPlaneSheetRow_(data[state.i + 1], creds);
        else if (phase === 'drone') r = recordsPublishDroneSheetRow_(data[state.i + 1], creds);
        else if (phase === 'drone-test') r = recordsPublishDroneTestSheetRow_(data[state.i + 1], creds);
        else if (phase === 'nearmap') r = recordsPublishNearmapSheetRow_(sheet, sheetRow, creds);
        else r = { kind: 'skip', reason: 'unknown phase' };
        bump_(phase, r.kind === 'ok' || r.kind === 'stub' || r.kind === 'skip' ? r.kind : 'skip');
        if (r.kind === 'skip') Logger.log('records sheet skip ' + phase + ' row ' + sheetRow + ' ' + r.reason);
        else Logger.log('records sheet ' + r.kind + ' ' + phase + ' row ' + sheetRow + ' ' + (r.hubId || r.satId || '') + ' ' + (r.name || ''));
      } catch (e) {
        noteFail_(phase, 'row ' + sheetRow + ': ' + e.message, sheetRow);
      }
      state.i = state.i + 1;
      recordsSatMassSave_(state);
      if ((state.i % 10) === 0) {
        try {
          SpreadsheetApp.getActiveSpreadsheet().toast(
            phase + ' ' + state.i + '/' + nRows,
            'property-intel-records', 8);
        } catch (e2) {}
      }
    }
    const idxDone = RECORDS_SHEET_PHASES.indexOf(phase);
    state.phase = RECORDS_SHEET_PHASES[idxDone + 1] || 'hoa';
    state.i = 0;
    recordsSatMassSave_(state);
  }

  if (state.phase === 'hoa') {
    const satSheet = ss.getSheetByName(SATELLITE_SHEET);
    if (!satSheet) throw new Error('No "' + SATELLITE_SHEET + '" tab');
    const hoaMap = recordsBuildHoaMapFromSatelliteSheet_(satSheet.getDataRange().getValues());
    const slugs = Object.keys(hoaMap);
    state.n = slugs.length;
    while (state.hoaI < slugs.length) {
      if (timedOut_()) {
        recordsSatMassSave_(state);
        return { done: false, state: state };
      }
      const slug = slugs[state.hoaI];
      try {
        if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) throw new Error('bad hoa slug "' + slug + '"');
        recordsPutJson_(RECORDS_FILES_PREFIX.hoa + slug + '.json', hoaMap[slug]);
        bump_('hoa', 'ok');
        Logger.log('records sheet hoa ' + slug + ' (' + hoaMap[slug].properties.length + ' members)');
      } catch (e) {
        noteFail_('hoa', slug + ': ' + e.message);
      }
      state.hoaI = state.hoaI + 1;
      recordsSatMassSave_(state);
    }
    recordsSatMassClear_();
    return { done: true, state: state };
  }

  recordsSatMassClear_();
  return { done: true, state: state };
}

function recordsSatMassSummary_(result) {
  const s = result.state || {};
  const lines = [
    (result.done ? 'Finished.' : 'Paused at 4.5 min — run Resume mothership publish.'),
    'Phase: ' + (s.phase || '?') + '  row ' + (s.i || 0) + ' / ' + (s.n || 0)
  ];
  const tally = s.tally || {};
  RECORDS_SHEET_PHASES.forEach(function (p) {
    const t = tally[p];
    if (!t) return;
    lines.push(p + ': ok ' + (t.ok || 0) + '  stub ' + (t.stub || 0) +
      '  skip ' + (t.skip || 0) + '  fail ' + (t.fail || 0));
  });
  if (s.errors && s.errors.length) {
    lines.push('Errors (first ' + s.errors.length + '):');
    s.errors.forEach(function (e) { lines.push('  ' + e); });
  }
  return lines.join('\n');
}

function publishRecordsFromSheets() {
  const ui = SpreadsheetApp.getUi();
  const existing = recordsSatMassLoad_();
  if (existing && existing.phase) {
    const ans = ui.alert(
      'Mothership publish in progress',
      'Phase ' + existing.phase + ': row ' + (existing.i || 0) + ' / ' + (existing.n || '?') +
        '.\n\nYES = resume. NO = start over.',
      ui.ButtonSet.YES_NO);
    if (ans === ui.Button.YES) {
      resumeRecordsSatSheetPublish();
      return;
    }
    if (ans !== ui.Button.NO) return;
    recordsSatMassClear_();
  }
  const go = ui.alert(
    'Publish mothership to records',
    'Write the Sheet onto s3://' + RECORDS_BUCKET + '.\n\n' +
      'Hub = hash(site_no) from Satellite. One house, one index.\n' +
      'Then Plane, Drone, drone-test, Nearmap join that hub.\n' +
      'No GitHub copy. No name-hash hubs. Live Pages stays on GitHub until viewers cut over.\n\nContinue?',
    ui.ButtonSet.YES_NO);
  if (go !== ui.Button.YES) return;
  satSiteNoIndexCache_ = null;
  const state = {
    phase: 'satellite',
    i: 0,
    n: 0,
    hoaI: 0,
    tally: {},
    errors: [],
    started: new Date().toISOString()
  };
  recordsSatMassSave_(state);
  const result = recordsSatMassTick_(state, Date.now());
  const text = recordsSatMassSummary_(result);
  Logger.log(text);
  ui.alert('Mothership → records', text, ui.ButtonSet.OK);
}

function publishRecordsFromSatelliteSheet() {
  publishRecordsFromSheets();
}

function resumeRecordsSatSheetPublish() {
  const ui = SpreadsheetApp.getUi();
  const state = recordsSatMassLoad_();
  if (!state || !state.phase) {
    ui.alert('Resume mothership publish',
      'Nothing to resume. Run Publish mothership to records.',
      ui.ButtonSet.OK);
    return;
  }
  const result = recordsSatMassTick_(state, Date.now());
  const text = recordsSatMassSummary_(result);
  Logger.log(text);
  ui.alert('Mothership → records', text, ui.ButtonSet.OK);
}

function checkRecordsSatSheetPublish() {
  const ui = SpreadsheetApp.getUi();
  const state = recordsSatMassLoad_();
  const auto = recordsSheetAutoIsRunning_() ? 'Overnight trigger: ON (every 5 min)' : 'Overnight trigger: off';
  if (!state || !state.phase) {
    ui.alert('Mothership publish', 'Idle. No run in progress.\n' + auto, ui.ButtonSet.OK);
    return;
  }
  ui.alert('Mothership publish', recordsSatMassSummary_({
    done: false,
    state: state
  }) + '\n' + auto, ui.ButtonSet.OK);
}

function cancelRecordsSatSheetPublish() {
  recordsSheetClearAutoTrigger_();
  recordsSatMassClear_();
  try {
    SpreadsheetApp.getUi().alert('Mothership publish', 'Cleared checkpoint and stopped the overnight trigger.', SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) {}
}

function publishRecordsSatelliteForActiveRow() {
  publishRecordsForActiveRow();
}

// ── Overnight (time-driven, every 5 minutes) ───────────────────────────────
// Trigger must not open a UI dialog. Lock skips overlap if a tick still
// holds the 4.5 min budget. Stops itself when the checkpoint is gone (done).
const RECORDS_SHEET_AUTO_TRIGGER = 'recordsSheetAutoTick_';

function recordsSheetClearAutoTrigger_() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === RECORDS_SHEET_AUTO_TRIGGER) ScriptApp.deleteTrigger(t);
  });
}

function recordsSheetAutoIsRunning_() {
  return ScriptApp.getProjectTriggers().some(function (t) {
    return t.getHandlerFunction() === RECORDS_SHEET_AUTO_TRIGGER;
  });
}

function recordsSheetAutoTick_() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) {
    Logger.log('records auto: another tick holds the lock — skipping');
    return;
  }
  try {
    const state = recordsSatMassLoad_();
    if (!state || !state.phase) {
      Logger.log('records auto: no checkpoint — stopping trigger');
      recordsSheetClearAutoTrigger_();
      return;
    }
    const result = recordsSatMassTick_(state, Date.now());
    const text = recordsSatMassSummary_(result);
    Logger.log(text);
    try {
      SpreadsheetApp.getActiveSpreadsheet().toast(
        (result.done ? 'Finished' : (state.phase + ' ' + (state.i || 0) + '/' + (state.n || 0))),
        'records auto', 8);
    } catch (e2) {}
    if (result.done) {
      recordsSheetClearAutoTrigger_();
      Logger.log('records auto: finished — trigger off');
    }
  } catch (e) {
    Logger.log('records auto ERROR: ' + e.message);
  } finally {
    lock.releaseLock();
  }
}

function startRecordsSheetAuto() {
  const ui = SpreadsheetApp.getUi();
  let state = recordsSatMassLoad_();
  if (!state || !state.phase) {
    satSiteNoIndexCache_ = null;
    state = {
      phase: 'satellite',
      i: 0,
      n: 0,
      hoaI: 0,
      tally: {},
      errors: [],
      started: new Date().toISOString()
    };
    recordsSatMassSave_(state);
  }
  recordsSheetClearAutoTrigger_();
  ScriptApp.newTrigger(RECORDS_SHEET_AUTO_TRIGGER).timeBased().everyMinutes(5).create();
  const where = 'Phase ' + state.phase + ': row ' + (state.i || 0) + ' / ' + (state.n || '?');
  ui.alert(
    'Mothership overnight',
    'Trigger on (every 5 minutes). ' + where + '.\n\n' +
      'Each tick uses the 4.5 min budget, then the next fire continues.\n' +
      'When Finished, the trigger deletes itself.\n' +
      'Close this and leave the sheet. Status is in Executions.\n\n' +
      'Stop overnight keeps the checkpoint. Cancel mothership publish clears both.',
    ui.ButtonSet.OK);
}

function stopRecordsSheetAuto() {
  const ui = SpreadsheetApp.getUi();
  const was = recordsSheetAutoIsRunning_();
  recordsSheetClearAutoTrigger_();
  ui.alert(
    'Mothership overnight',
    was
      ? 'Stopped the trigger. Checkpoint is still there — Resume or Start overnight to continue.'
      : 'No overnight trigger was running.',
    ui.ButtonSet.OK);
}

const RECORDS_SAT_BLIP_ROWS = [217, 264, 347, 419, 767, 1318, 1490, 1605, 1655, 1830, 2191, 2200, 2239, 2499, 2500];

function retryRecordsFailedSheetRows() {
  const ui = SpreadsheetApp.getUi();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(2000)) {
    ui.alert('Retry failed rows',
      'An overnight tick is running. Wait until it finishes this 4.5 min (or Stop overnight), then retry.',
      ui.ButtonSet.OK);
    return;
  }
  try {
    satSiteNoIndexCache_ = null;
    const live = recordsSatMassLoad_();
    const work = {
      errors: (live && live.errors) ? live.errors.slice() : [],
      failRows: (live && live.failRows) ? live.failRows.slice() : [],
      tally: {},
      retryI: 0
    };
    if (!recordsCollectRetryJobs_(work).length) {
      RECORDS_SAT_BLIP_ROWS.forEach(function (n) {
        work.failRows.push({ phase: 'satellite', row: n });
      });
    }
    const jobs = recordsCollectRetryJobs_(work);
    const creds = getCredentials();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const started = Date.now();
    let ok = 0, fail = 0, skip = 0;
    const errLines = [];
    for (let i = 0; i < jobs.length; i++) {
      if (Date.now() - started > RECORDS_MASS_MAX_MS) {
        ui.alert('Retry failed rows',
          'Paused at 4.5 min after ' + i + '/' + jobs.length +
            ' (ok ' + ok + ', fail ' + fail + '). Run again.',
          ui.ButtonSet.OK);
        return;
      }
      const job = jobs[i];
      try {
        const r = recordsPublishSheetJob_(job, creds, ss);
        if (r.kind === 'skip') skip++;
        else if (r.kind === 'ok' || r.kind === 'stub') ok++;
        Logger.log('records retry ' + r.kind + ' ' + job.phase + ' row ' + job.row);
      } catch (e) {
        fail++;
        errLines.push(job.phase + ' row ' + job.row + ': ' + e.message);
        Logger.log('records retry fail ' + job.phase + ' row ' + job.row + ' ' + e.message);
      }
    }
    ui.alert('Retry failed rows',
      'Queued ' + jobs.length + '\nok ' + ok + '  skip ' + skip + '  fail ' + fail +
        (errLines.length ? ('\n' + errLines.slice(0, 15).join('\n')) : ''),
      ui.ButtonSet.OK);
  } finally {
    lock.releaseLock();
  }
}
