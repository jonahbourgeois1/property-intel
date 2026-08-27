// Hub logic only. vyanet-viewer.html does not render 3D, maps, or live
// video — it reads the index and points at the existing viewer pages.
// This module owns routing (which pages to iframe) and the gate's data
// questions (does this property have cameras; is this viewer key accepted).

export const MODEL_PAGE = 'model-viewer.html';
export const SAT_PAGE = 'viewer.html';
export const LIVE_PAGE = 'live-viewer.html';
export const MODEL_VIEWS = ['drone-test', 'plane', 'drone'];
export const SAT_VIEWS = ['security', 'wildfire', 'plane', 'drone', 'drone-test'];
export const ROLES = ['customer', 'tech', 'responder'];
// Bump with the hub HTML BUILD so child iframes and this module cache-bust together.
export const HUB_BUILD = '1.7.2';

// Same default as model-viewer.html; ?gw= overrides, ?gw=0 disables.
export const GW_DEFAULT = 'https://xuzftiqa5gqy35yf26y2bca2ji0ivbnj.lambda-url.us-east-1.on.aws';

export async function fetchJson(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return await res.json();
}

// Property camera metadata: data/cameras/json/{id}.json.
// Fallbacks: flat data/cameras/{id}.json then data/cameras/images/json/{id}.json.
export async function fetchCamerasFile(root, id) {
  const paths = [
    root + 'cameras/json/' + id + '.json',
    root + 'cameras/' + id + '.json',
    root + 'cameras/images/json/' + id + '.json'
  ];
  for (let i = 0; i < paths.length; i++) {
    try {
      const j = await fetchJson(paths[i]);
      if (j && Array.isArray(j.cameras) && j.cameras.length) return j;
    } catch (e) {}
  }
  return null;
}

export function dataRoot() {
  const params = new URLSearchParams(window.location.search);
  const explicit = params.get('dataRoot');
  if (explicit) return explicit.replace(/\/*$/, '/');
  if (window.location.protocol === 'file:') {
    return 'https://responder-intel.vyanet.com/data/';
  }
  return new URL('data/', window.location.href).href;
}

export function gwConfig() {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('gw');
  if (raw === '0') return { url: '', off: true };
  return { url: (raw || GW_DEFAULT).replace(/\/+$/, ''), off: false };
}

function childQuery(extra) {
  const src = new URLSearchParams(window.location.search);
  const out = new URLSearchParams();
  ['property', 'gw', 'chekt', 'debug', 'dataRoot', 'chektdev', 'chektch', 'livems'].forEach(function (k) {
    const v = src.get(k);
    if (v) out.set(k, v);
  });
  Object.keys(extra || {}).forEach(function (k) {
    if (extra[k] != null && extra[k] !== '') out.set(k, String(extra[k]));
  });
  if (!out.get('v')) out.set('v', HUB_BUILD);
  return out.toString();
}

export function framesFromIndex(idx) {
  const views = (idx && idx.views) || {};
  const modelView = MODEL_VIEWS.find(function (v) { return views[v]; });
  const satView = SAT_VIEWS.find(function (v) { return views[v]; });
  return {
    name: (idx && idx.name) || '',
    address: (idx && idx.address) || '',
    modelView: modelView || '',
    hasModel: !!modelView,
    hasSatellite: !!satView,
    // hasLive is filled by the hub after detectCameras (cameras file / any
    // view-record cameras array) OR when hasModel is true — Jones has live
    // via the CHEKT gateway with no cameras file yet.
    hasLive: false,
    // embed=1 tells the child pages the hub owns the always-on chrome
    // (live/weather/hazard buttons), so they don't reveal their own copies.
    modelHref: modelView ? (MODEL_PAGE + '?' + childQuery({ view: modelView, embed: '1' })) : '',
    satHref: satView ? (SAT_PAGE + '?' + childQuery({ tab: satView, embed: '1' })) : '',
    liveHref: LIVE_PAGE + '?' + childQuery({ embed: '1' })
  };
}

// The best available nadir render for this property, for the home hero.
// Walks the model views first (drone-test/plane/drone renders are the
// highest-caliber imagery), then the satellite views. Stops at the first
// record carrying nadir.url; returns '' when none do.
export async function findNadir(root, idx) {
  const views = (idx && idx.views) || {};
  const seen = [];
  const order = MODEL_VIEWS.concat(SAT_VIEWS);
  for (let i = 0; i < order.length; i++) {
    const v = order[i], id = views[v];
    if (!id || seen.indexOf(v + '/' + id) !== -1) continue;
    seen.push(v + '/' + id);
    try {
      const rec = await fetchJson(root + v + '/' + id + '.json');
      if (rec && rec.nadir && rec.nadir.url) return String(rec.nadir.url);
    } catch (e) {}
  }
  return '';
}

// Property ids the live gateway might key this property under — same walk
// order as model-viewer.html (the allowlist may predate the site_no hub id).
// Eugene currently has two index files for the same building: the site_no
// hub (8eea64e5, satellite + drone-test) and the name-hash hub (4a484f8c,
// drone + drone-test). Cameras were first published on 4a484f8c. Looking up
// either hub must find that file until the two indexes are merged.
const CAMERA_HUB_SIBLINGS = {
  '8eea64e5c09dc806f667b079e111a38d': ['4a484f8c273abef3c02cf91e274f9e2f'],
  '4a484f8c273abef3c02cf91e274f9e2f': ['8eea64e5c09dc806f667b079e111a38d']
};

export function liveAliasIds(idx, propertyId) {
  const ids = [];
  function add(x) {
    const s = String(x || '').trim();
    if (s && ids.indexOf(s) === -1) ids.push(s);
  }
  add(propertyId);
  if (idx) {
    add(idx.id);
    if (idx.views) {
      add(idx.views['drone-test']);
      add(idx.views.drone);
      add(idx.views.plane);
    }
  }
  ids.slice().forEach(function (id) {
    (CAMERA_HUB_SIBLINGS[id] || []).forEach(add);
  });
  return ids;
}

// Does this property have cameras? Sources the gate can read without a key:
// data/cameras/json/{idx.id|propertyId}.json (flat cameras/{id}.json and
// images/json/ are fallbacks), and a non-empty cameras
// array on ANY view record (not only the 3D view — live feed is its own
// plugin and must work without a GLB). The gateway allowlist is NOT
// probeable keylessly (it 401s before looking at ?property=), so it cannot
// answer this question pre-gate. Any fetch error counts as "no cameras".
// The hub still treats hasModel as a live proxy until cameras files are
// published (Jones: gateway live, no cameras file).
export async function detectCameras(root, idx, _spec, propertyId) {
  const jobs = [];
  liveAliasIds(idx, propertyId).forEach(function (id) {
    jobs.push(fetchCamerasFile(root, id).then(function (j) {
      return !!(j && Array.isArray(j.cameras) && j.cameras.length);
    }).catch(function () { return false; }));
  });
  const views = (idx && idx.views) || {};
  const seen = [];
  Object.keys(views).forEach(function (v) {
    const id = views[v];
    if (!id) return;
    const key = v + '/' + id;
    if (seen.indexOf(key) !== -1) return;
    seen.push(key);
    jobs.push(fetchJson(root + v + '/' + id + '.json').then(function (j) {
      return !!(j && Array.isArray(j.cameras) && j.cameras.length);
    }).catch(function () { return false; }));
  });
  if (!jobs.length) return false;
  const hits = await Promise.all(jobs);
  return hits.indexOf(true) !== -1;
}

export function gwLiveQuery(id, idx) {
  const q = new URLSearchParams();
  q.set('property', String(id || ''));
  if (idx && idx.address) q.set('address', String(idx.address));
  if (idx && idx.name) q.set('name', String(idx.name));
  if (idx && idx.site_no) q.set('site_no', String(idx.site_no));
  return q.toString();
}

// Ask the gateway whether it accepts this key. Walk the alias ids the same
// way model-viewer does: 200 = accepted and this property has live cameras;
// 401 = key rejected (stop — the gateway checks the key before the
// property); 404 = key fine, property unknown under that id, try the next.
// Address/name from the index let the gateway resolve CHEKT sites that are
// not in PROPERTY_MAP. Anything else (429, 5xx, network) is inconclusive:
// accept the key and let model-viewer's own 401-retry loop sort it out.
export async function validateViewerKey(key, ids, gw, idx) {
  if (gw.off) return { ok: true, live: false };
  for (let i = 0; i < ids.length; i++) {
    let r;
    try {
      r = await fetch(gw.url + '/live?' + gwLiveQuery(ids[i], idx), {
        headers: { 'x-viewer-key': key }
      });
    } catch (e) {
      return { ok: true, live: false };
    }
    if (r.status === 200) return { ok: true, live: true };
    if (r.status === 401) return { ok: false, live: false };
    if (r.status !== 404) return { ok: true, live: false };
  }
  return { ok: true, live: false };
}
