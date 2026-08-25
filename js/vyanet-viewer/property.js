// Hub logic only. vyanet-viewer.html does not render 3D, maps, or live
// video — it reads the index and points at the existing viewer pages.
// This module owns routing (which pages to iframe) and the gate's data
// questions (does this property have cameras; is this viewer key accepted).

export const MODEL_PAGE = 'model-viewer.html';
export const SAT_PAGE = 'viewer.html';
export const MODEL_VIEWS = ['drone-test', 'plane', 'drone'];
export const SAT_VIEWS = ['security', 'wildfire', 'plane', 'drone', 'drone-test'];
export const ROLES = ['customer', 'tech', 'responder'];

// Same default as model-viewer.html; ?gw= overrides, ?gw=0 disables.
export const GW_DEFAULT = 'https://xuzftiqa5gqy35yf26y2bca2ji0ivbnj.lambda-url.us-east-1.on.aws';

export async function fetchJson(url) {
  const res = await fetch(url);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return await res.json();
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
    modelHref: modelView ? (MODEL_PAGE + '?' + childQuery({ view: modelView })) : '',
    satHref: satView ? (SAT_PAGE + '?' + childQuery({ tab: satView })) : ''
  };
}

// Property ids the live gateway might key this property under — same walk
// order as model-viewer.html (the allowlist may predate the site_no hub id).
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
  return ids;
}

// Does this property have cameras? Sources the gate can read without a key:
// data/cameras/{propertyId}.json (404 = none) and the cameras array on the
// model view record the 3D page will load. The gateway allowlist is NOT
// probeable keylessly (it 401s before looking at ?property=), so it cannot
// answer this question pre-gate. Any fetch error counts as "no cameras" —
// the gate passcode is a front-load; model-viewer still asks on demand.
export async function detectCameras(root, idx, spec) {
  const jobs = [];
  jobs.push(fetchJson(root + 'cameras/' + idx.id + '.json').then(function (j) {
    return !!(j && Array.isArray(j.cameras) && j.cameras.length);
  }).catch(function () { return false; }));
  if (spec.modelView && idx.views && idx.views[spec.modelView]) {
    jobs.push(fetchJson(root + spec.modelView + '/' + idx.views[spec.modelView] + '.json').then(function (j) {
      return !!(j && Array.isArray(j.cameras) && j.cameras.length);
    }).catch(function () { return false; }));
  }
  const hits = await Promise.all(jobs);
  return hits.indexOf(true) !== -1;
}

// Ask the gateway whether it accepts this key. Walk the alias ids the same
// way model-viewer does: 200 = accepted and this property has live cameras;
// 401 = key rejected (stop — the gateway checks the key before the
// property); 404 = key fine, property unknown under that id, try the next.
// Anything else (429, 5xx, network) is inconclusive: accept the key and let
// model-viewer's own 401-retry loop sort it out on first live use.
export async function validateViewerKey(key, ids, gw) {
  if (gw.off) return { ok: true, live: false };
  for (let i = 0; i < ids.length; i++) {
    let r;
    try {
      r = await fetch(gw.url + '/live?property=' + encodeURIComponent(ids[i]), {
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
