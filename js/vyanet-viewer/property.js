// Hub routing only. vyanet-viewer.html does not render 3D, maps, or live
// video — it reads the index and points at the existing viewer pages.

export const MODEL_PAGE = 'model-viewer.html';
export const SAT_PAGE = 'viewer.html';
export const MODEL_VIEWS = ['drone-test', 'plane', 'drone'];
export const SAT_VIEWS = ['security', 'wildfire', 'plane', 'drone', 'drone-test'];

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
