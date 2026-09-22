// Hub logic only. vyanet-viewer.html does not render 3D, maps, or live
// video â€” it reads the index and points at the existing viewer pages.
// This module owns routing (which pages to iframe) and the gate's data
// questions (does this property have cameras; is this viewer key accepted).

export const MODEL_PAGE = 'model-viewer.html';
export const SAT_PAGE = 'viewer.html';
export const LIVE_PAGE = 'live-viewer.html';
export const HOA_PAGE = 'hoa-viewer.html';
export const NEARMAP_PAGE = 'nearmap-viewer.html';
export const CF_NEARMAP = 'https://d3fg47bqswi0rr.cloudfront.net/nearmap/';
// Trial join: Nearmap delivery_id â†’ existing index hub. Do not hash site_no
// (Jones is name-keyed 6de88883, not hash(14725)). Promotion later writes
// views.nearmap onto that same hub; this table is the trial stand-in.
export const NEARMAP_DELIVERY_HUB = {
  '18775-macalpine-loop-bend-or-97702': '6de88883bfd4a8349a901c54611ed9d7',
  '410-sw-columbia-st-bend-or-97702': '744a3639be95ce309192dc69b5a8e9f6'
};
export const NEARMAP_HUB_DELIVERY = (function () {
  const out = {};
  Object.keys(NEARMAP_DELIVERY_HUB).forEach(function (d) {
    out[NEARMAP_DELIVERY_HUB[d]] = d;
  });
  return out;
})();
export const MODEL_VIEWS = ['drone-test', 'plane', 'drone'];
export const SAT_VIEWS = ['drone-test', 'security', 'wildfire', 'plane', 'drone'];
export const ROLES = ['customer', 'tech', 'responder'];
export const PLUGINS = [
  { id: 'security-companies', label: 'Security Companies', blurb: 'White-label property intelligence across entire protected customer portfolios.' },
  { id: 'multifamily-housing', label: 'Multifamily Housing', blurb: 'Security, maintenance, operations, and resident intelligence across housing portfolios.' },
  { id: 'property-portfolios', label: 'Property Portfolios', blurb: 'Enterprise intelligence across diverse commercial real estate holdings.' },
  { id: 'industrial-facilities', label: 'Industrial Facilities', blurb: 'Security and operational intelligence for complex, changing industrial sites.' },
  { id: 'healthcare-campuses', label: 'Healthcare Campuses', blurb: 'Spatial intelligence for security, operations, access, and emergency response.' },
  { id: 'planned-communities', label: 'Planned Communities', blurb: 'Community-wide intelligence connecting shared assets, infrastructure, and residences.' },
  { id: 'data-centers', label: 'Data Centers', blurb: 'Continuous change intelligence for critical campuses and surrounding environments.' },
  { id: 'logistics-centers', label: 'Logistics Centers', blurb: 'Security and operational intelligence across warehouses, yards, and distribution networks.' },
  { id: 'golf-courses', label: 'Golf Courses', blurb: 'Course, maintenance, security, environmental, and community intelligence from above.' },
  { id: 'school-districts', label: 'School Districts', blurb: 'Districtwide security, responder, facility, and organizational execution intelligence.' },
  { id: 'agricultural-farms', label: 'Agricultural Farms', blurb: 'Current crop, infrastructure, water, equipment, and operational property intelligence.' },
  { id: 'vineyards-wineries', label: 'Vineyards Wineries', blurb: 'Agricultural, production, hospitality, asset, and security intelligence combined.' },
  { id: 'local-governments', label: 'Local Governments', blurb: 'Portfolio intelligence across municipal facilities, infrastructure, parks, and assets.' },
  { id: 'destination-resorts', label: 'Destination Resorts', blurb: 'Property-wide intelligence across lodging, amenities, infrastructure, and guest environments.' },
  { id: 'construction-sites', label: 'Construction Sites', blurb: 'Recurring change intelligence documenting progress, conditions, assets, and risks.' },
  { id: 'critical-infrastructure', label: 'Critical Infrastructure', blurb: 'Spatial intelligence for essential assets, access, resilience, and inspection.' },
  { id: 'university-campuses', label: 'University Campuses', blurb: 'Campus-wide security, facilities, movement, infrastructure, and emergency intelligence.' },
  { id: 'auto-dealerships', label: 'Auto Dealerships', blurb: 'Inventory, perimeter, parking, access, and theft-prevention intelligence.' },
  { id: 'religious-campuses', label: 'Religious Campuses', blurb: 'Security and operational intelligence across worship and community facilities.' },
  { id: 'self-storage', label: 'Self Storage', blurb: 'Scalable security and property intelligence across standardized national portfolios.' },
  { id: 'specialty-orchards', label: 'Specialty Orchards', blurb: 'Recurring crop, irrigation, canopy, weather, and infrastructure intelligence.' },
  { id: 'livestock-ranches', label: 'Livestock Ranches', blurb: 'Intelligence across vast fencing, water, livestock, equipment, and infrastructure.' },
  { id: 'cannabis-cultivation', label: 'Cannabis Cultivation', blurb: 'High-value agricultural intelligence combined with intensive physical security.' },
  { id: 'food-processing', label: 'Food Processing', blurb: 'Operational intelligence across processing, storage, utilities, loading, and security.' },
  { id: 'retail-centers', label: 'Retail Centers', blurb: 'Parking, pedestrian, security, maintenance, and portfolio-wide property intelligence.' },
  { id: 'outdoor-recreation', label: 'Outdoor Recreation', blurb: 'Intelligence across trails, campsites, infrastructure, hazards, and changing terrain.' },
  { id: 'sports-complexes', label: 'Sports Complexes', blurb: 'Crowd, parking, facility, security, maintenance, and emergency intelligence.' },
  { id: 'waterfront-marinas', label: 'Waterfront Marinas', blurb: 'Dock, shoreline, vessel, infrastructure, security, and storm intelligence.' },
  { id: 'memorial-parks', label: 'Memorial Parks', blurb: 'Land, infrastructure, vegetation, maintenance, and location-management intelligence.' },
  { id: 'luxury-estates', label: 'Luxury Estates', blurb: 'Premium security and property intelligence for complex high-value residences.' }
];
export const AHART_PLUGINS = PLUGINS;
export const HUB_BUILD = '1.8.42';
export const LIVE_PAGE_SIZE = 4;

export function stopMjpegImg(img) {
  if (!img) return;
  if (typeof img.__mjpegStop === 'function') img.__mjpegStop();
  img.onload = null;
  img.onerror = null;
  img.classList.remove('on');
  img.removeAttribute('src');
}

// Tear down the wall (leave Live / rebuild). Parcel tabs must not call this.
export function invalidateLiveWall(main) {
  if (!main) return;
  main.__streamGen = (main.__streamGen || 0) + 1;
}

function jwtPayload_(token) {
  const b64 = String(token || '').split('.')[1] || '';
  const norm = b64.replace(/-/g, '+').replace(/_/g, '/');
  const pad = norm + '==='.slice((norm.length + 3) % 4);
  return JSON.parse(atob(pad));
}

// CHEKT portal tiles are snapshot JPEGs, not MJPEG. Same access_token as
// /api/v1/mjpeg. Gud Cultures Parcel 3 (site 11788) hangs forever on
// multipart MJPEG but can still serve /api/v1/snapshots/{mac}/{channel}.
export function snapshotUrlsFromMjpeg(mjpegUrl, cam) {
  try {
    const token = new URL(mjpegUrl).searchParams.get('access_token');
    if (!token) return [];
    const p = jwtPayload_(token);
    const mac = String((cam && cam.mac) || p.sub || '').replace(/:/g, '').toUpperCase();
    if (!mac) return [];
    const chans = [];
    function add(ch) {
      if (ch == null || ch === '') return;
      const n = Number(ch);
      const s = isFinite(n) ? String(n) : String(ch);
      if (chans.indexOf(s) === -1) chans.push(s);
    }
    add(cam && cam.channel);
    add(p.channel);
    add(p.group_channel);
    if (!chans.length) add(0);
    return chans.map(function (ch) {
      return 'https://api.chekt.com/api/v1/snapshots/' + encodeURIComponent(mac) +
        '/' + encodeURIComponent(ch) + '?access_token=' + encodeURIComponent(token);
    });
  } catch (e) {
    return [];
  }
}

// CHEKT MJPEG is multipart/x-mixed-replace. Chrome often fires img.onerror
// before the first JPEG, or never fires onload. Treat naturalWidth as LIVE.
// If the stream never sends a frame, poll snapshot JPEGs with the same token.
export function bindMjpegImg(img, stateEl, url, isCurrent, opts) {
  if (!img || !url) return;
  stopMjpegImg(img);
  const maxTries = (opts && opts.maxTries != null) ? opts.maxTries : 3;
  const watchMs = (opts && opts.watchMs != null) ? opts.watchMs : 10000;
  const deadLabel = (opts && opts.deadLabel) || 'no stream';
  const snapUrls = snapshotUrlsFromMjpeg(url, opts && opts.cam);
  let tries = 0;
  let timer = 0;
  let poll = 0;
  let snapTimer = 0;
  let snapBusy = false;
  let snapIdx = 0;
  let stopped = false;
  function alive() { return !stopped && (!isCurrent || isCurrent()); }
  function stopTimers() {
    if (timer) { clearTimeout(timer); timer = 0; }
    if (poll) { clearInterval(poll); poll = 0; }
    if (snapTimer) { clearInterval(snapTimer); snapTimer = 0; }
  }
  img.__mjpegStop = function () {
    stopped = true;
    stopTimers();
    img.onload = null;
    img.onerror = null;
    img.classList.remove('on');
    img.removeAttribute('src');
    img.__mjpegStop = null;
  };
  function markLive() {
    if (!alive() || !stateEl) return;
    img.classList.add('on');
    stateEl.textContent = 'LIVE';
    stateEl.classList.remove('bad');
  }
  function markDead() {
    if (!alive() || !stateEl) return;
    img.classList.remove('on');
    stateEl.textContent = deadLabel;
    stateEl.classList.add('bad');
  }
  function sawFrame() { return img.naturalWidth > 0; }
  function paintJpeg(data) {
    if (!alive() || !data) return false;
    const src = String(data).indexOf('data:') === 0 ? String(data)
      : ('data:image/jpeg;base64,' + data);
    img.onload = function () {
      if (alive() && sawFrame()) markLive();
    };
    img.onerror = null;
    img.src = src;
    return true;
  }
  function tickSnap() {
    if (!alive() || snapBusy || !snapUrls.length) return;
    snapBusy = true;
    const snapUrl = snapUrls[snapIdx];
    fetch(snapUrl, { mode: 'cors', cache: 'no-store', referrerPolicy: 'no-referrer' })
      .then(function (r) {
        if (!alive()) return null;
        if (r.status === 401) {
          markDead();
          stopTimers();
          return { __stop: true };
        }
        if (r.status === 403) {
          snapIdx = (snapIdx + 1) % snapUrls.length;
          return null;
        }
        if (!r.ok) return null;
        return r.json();
      })
      .then(function (j) {
        if (!alive() || !j || j.__stop || j.data == null || j.data === '') return;
        if (j.base64Encoded === false) {
          img.onload = function () { if (alive() && sawFrame()) markLive(); };
          img.onerror = null;
          img.src = String(j.data);
          return;
        }
        paintJpeg(j.data);
      })
      .catch(function () {
        if (!alive()) return;
        snapIdx = (snapIdx + 1) % snapUrls.length;
      })
      .then(function () { snapBusy = false; });
  }
  function startSnapshotPoll() {
    if (!alive() || !snapUrls.length) { markDead(); return; }
    stopTimers();
    img.onload = null;
    img.onerror = null;
    img.removeAttribute('src');
    if (stateEl) {
      stateEl.textContent = 'connectingâ€¦';
      stateEl.classList.remove('bad');
    }
    tickSnap();
    snapTimer = setInterval(tickSnap, 2000);
  }
  function armWatch() {
    stopTimers();
    poll = setInterval(function () {
      if (!alive()) { stopTimers(); return; }
      if (sawFrame()) { stopTimers(); markLive(); }
    }, 400);
    timer = setTimeout(function () {
      if (!alive()) return;
      stopTimers();
      if (sawFrame()) { markLive(); return; }
      if (snapUrls.length) {
        startSnapshotPoll();
        return;
      }
      if (tries < maxTries) {
        tries++;
        retry();
        return;
      }
      markDead();
    }, watchMs);
  }
  function retry() {
    if (!alive()) return;
    stopTimers();
    img.onload = null;
    img.onerror = null;
    img.removeAttribute('src');
    setTimeout(function () { if (alive()) start(); }, 700);
  }
  function start() {
    if (!alive()) return;
    img.referrerPolicy = 'no-referrer';
    img.onload = function () {
      if (alive() && sawFrame()) { stopTimers(); markLive(); }
    };
    img.onerror = function () {
      if (!alive() || sawFrame()) return;
      if (tries < maxTries) {
        tries++;
        retry();
      } else if (snapUrls.length) {
        startSnapshotPoll();
      }
    };
    img.src = url;
    armWatch();
  }
  start();
}

function weaveByParcel_(list) {
  const buckets = {};
  const keys = [];
  (list || []).forEach(function (j) {
    const k = String(j.parcel);
    if (!buckets[k]) { buckets[k] = []; keys.push(k); }
    buckets[k].push(j);
  });
  const out = [];
  let n = 0;
  let more = true;
  while (more) {
    more = false;
    keys.forEach(function (k) {
      if (buckets[k][n]) { out.push(buckets[k][n]); more = true; }
    });
    n++;
  }
  return out;
}

// Start every camera that has an MJPEG URL. Do not cap, do not skip CHEKT
// `offline` (Gud Cultures Parcel 3 was LIVE on All while status said
// offline), do not drop src on parcel tabs. Stagger round-robin across
// parcels so Parcel 2/3 start in the first wave, not after Parcel 1.
export function syncLiveWallStreams(main, rows, maxN) {
  if (!main) return;
  if (!main.__streamGen) main.__streamGen = 1;
  const gen = main.__streamGen;
  const cells = main.querySelectorAll('.quad-cell');
  const want = [];
  cells.forEach(function (el) {
    const i = Number(el.getAttribute('data-i'));
    const img = el.querySelector('img.quad-mjpeg') || el.querySelector('img');
    const st = el.querySelector('.quad-state');
    const cam = rows[i] && rows[i].cam;
    if (!cam || !cam.mjpeg_url || !img) return;
    want.push({
      el: el, i: i, img: img, st: st, cam: cam,
      parcel: el.getAttribute('data-parcel') || '0'
    });
  });
  weaveByParcel_(want).forEach(function (job, n) {
    if (job.img.naturalWidth > 0) return;
    if (typeof job.img.__mjpegStop === 'function') return;
    if (job.img.getAttribute('src') && !job.img.__still) return;
    if (job.st) { job.st.textContent = 'connectingâ€¦'; job.st.classList.remove('bad'); }
    setTimeout(function () {
      if (main.__streamGen !== gen) return;
      bindMjpegImg(job.img, job.st, job.cam.mjpeg_url, function () {
        return main.__streamGen === gen;
      }, { cam: job.cam });
    }, n * 180);
  });
}

// Newest clip thumbnail behind a hung MJPEG. Never stamp it onto a
// cell that already has a live frame â€” that swapped daytime LIVE to
// last-night stills (hub 1.8.28). CHEKT can report `online` while
// /api/v1/mjpeg never sends a first byte (Gud Cultures Parcel 3).
export function applyClipPosters(main, rows, clips) {
  if (!main) return;
  const byName = {};
  (clips || []).forEach(function (e) {
    const n = e && e.device_name && String(e.device_name).trim();
    if (n && e.thumbnail && !byName[n]) byName[n] = e.thumbnail;
  });
  main.querySelectorAll('.quad-cell').forEach(function (el) {
    const i = Number(el.getAttribute('data-i'));
    const row = rows && rows[i];
    const mjpeg = el.querySelector('img.quad-mjpeg') || el.querySelector('img:not(.quad-poster)');
    const live = !!(mjpeg && (mjpeg.classList.contains('on') || mjpeg.naturalWidth > 0));
    const name = row && row.cam && String(row.cam.name || '').trim();
    const url = (!live && name && byName[name]) || '';
    let poster = el.querySelector('img.quad-poster');
    if (!url) {
      el.classList.remove('has-poster');
      return;
    }
    if (!poster) {
      poster = document.createElement('img');
      poster.className = 'quad-poster';
      poster.alt = '';
      el.insertBefore(poster, el.firstChild);
    }
    poster.referrerPolicy = 'no-referrer';
    if (poster.getAttribute('src') !== url) poster.src = url;
    el.classList.add('has-poster');
  });
}

export function liveWallGrid(n) {
  const count = Math.max(0, n | 0);
  let cols = 1;
  if (count <= 1) cols = 1;
  else if (count <= 4) cols = 2;
  else if (count <= 6) cols = 3;
  else cols = 4;
  return { cols: cols, rows: Math.max(1, Math.ceil(count / cols) || 1) };
}

export function flattenLiveGroups(groups, parcelIdx) {
  const out = [];
  if (parcelIdx == null || parcelIdx < 0) {
    (groups || []).forEach(function (g) {
      (g.cameras || []).forEach(function (c) { out.push(c); });
    });
  } else {
    const g = (groups || [])[parcelIdx];
    ((g && g.cameras) || []).forEach(function (c) { out.push(c); });
  }
  return out.filter(function (c) { return c && c.mjpeg_url; });
}

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

// Property-level pin document. 404 = not published yet; viewers then fall
// back to the supersession rule (3D nadir pins, else satellite).
export async function fetchPropertyPins(root, propertyId) {
  const id = String(propertyId || '').trim();
  if (!id) return null;
  try {
    const rec = await fetchJson(root + 'pins/' + id + '.json');
    if (!rec || typeof rec !== 'object') return null;
    return rec;
  } catch (e) {
    return null;
  }
}

function asPinArr(v) {
  return Array.isArray(v) ? v : [];
}

export function nadirPinSetsFromRecord(rec) {
  const n = (rec && rec.nadir) || {};
  if (Array.isArray(n.element_pins) || Array.isArray(n.concern_pins)) {
    return { element: asPinArr(n.element_pins), concern: asPinArr(n.concern_pins) };
  }
  return { element: asPinArr(n.pins), concern: [] };
}

// Highest-caliber pin set for Private. A published pins file always wins.
// Else 3D/drone/plane nadir pins replace satellite. Else satellite
// elements + FR concerns. Never flattens catalog role=.
export function resolvePinSets(pinFile, modelRec, satRec) {
  if (pinFile && (asPinArr(pinFile.element).length || asPinArr(pinFile.concern).length)) {
    return {
      element: asPinArr(pinFile.element),
      concern: asPinArr(pinFile.concern),
      source: pinFile.source === 'satellite' ? 'satellite' : '3d',
      from: 'file'
    };
  }
  const modelSets = nadirPinSetsFromRecord(modelRec);
  if (modelSets.element.length || modelSets.concern.length) {
    return { element: modelSets.element, concern: modelSets.concern, source: '3d', from: '3d' };
  }
  if (satRec) {
    const element = asPinArr(satRec.elements);
    const concern = asPinArr(satRec.fr && satRec.fr.concerns);
    if (element.length || concern.length) {
      return { element: element, concern: concern, source: 'satellite', from: 'satellite' };
    }
  }
  return { element: [], concern: [], source: '', from: 'none' };
}

// Customer does not see responder-concern pins. Elements stay. Tech and
// responder get the full set. Role never forks the HTML files.
export function filterPinSetsForRole(sets, role) {
  const element = asPinArr(sets && sets.element);
  const concern = role === 'customer' ? [] : asPinArr(sets && sets.concern);
  return {
    element: element,
    concern: concern,
    source: (sets && sets.source) || '',
    from: (sets && sets.from) || ''
  };
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

function sessionRole() {
  try { return sessionStorage.getItem('vyRole') || ''; } catch (e) { return ''; }
}

// live=1 is the customer link that must not show Nearmap yet.
// live=0, and a URL with no live param, keep Nearmap on.
export function nearmapVisible() {
  try {
    return new URLSearchParams(window.location.search).get('live') !== '1';
  } catch (e) {
    return true;
  }
}

function childQuery(extra) {
  const src = new URLSearchParams(window.location.search);
  const out = new URLSearchParams();
  ['property', 'gw', 'chekt', 'debug', 'dataRoot', 'chektdev', 'chektch', 'livems', 'live'].forEach(function (k) {
    const v = src.get(k);
    if (v) out.set(k, v);
  });
  const role = src.get('role') || sessionRole();
  if (role && ROLES.indexOf(role) !== -1) out.set('role', role);
  Object.keys(extra || {}).forEach(function (k) {
    if (extra[k] != null && extra[k] !== '') out.set(k, String(extra[k]));
  });
  if (!out.get('v')) out.set('v', HUB_BUILD);
  return out.toString();
}

export function framesFromIndex(idx, nm) {
  const views = (idx && idx.views) || {};
  const modelView = MODEL_VIEWS.find(function (v) { return views[v]; });
  const satView = SAT_VIEWS.find(function (v) { return views[v]; });
  const hoa = String((idx && idx.hoa) || '').trim();
  const hubId = String((idx && idx.id) || (nm && nm.propertyId) || '').trim();
  let delivery = String((nm && nm.delivery) || '').trim();
  if (!delivery) delivery = NEARMAP_HUB_DELIVERY[hubId] || '';
  const siteNo = String((nm && nm.siteNo) || '').trim();
  const tiles = String((nm && nm.tiles) || '').trim();
  const hasNearmap = nearmapVisible() && !!(delivery || views.nearmap);
  return {
    name: (idx && idx.name) || '',
    address: (idx && idx.address) || '',
    hoa: hoa,
    modelView: modelView || '',
    hasModel: !!modelView,
    hasSatellite: !!satView,
    hasNearmap: hasNearmap,
    hasPrivate: !!(modelView || satView || hasNearmap),
    hasHoa: !!hoa,
    // hasLive is filled by the hub after detectCameras (cameras file / any
    // view-record cameras array) OR when hasModel is true â€” Jones has live
    // via the CHEKT gateway with no cameras file yet.
    hasLive: false,
    delivery: delivery,
    privateDefault: modelView ? '3d' : (satView ? 'satellite' : ''),
    // embed=1 tells the child pages the hub owns the always-on chrome
    // (live/weather/hazard buttons), so they don't reveal their own copies.
    modelHref: modelView ? (MODEL_PAGE + '?' + childQuery({ view: modelView, embed: '1' })) : '',
    satHref: satView ? (SAT_PAGE + '?' + childQuery({ tab: satView, embed: '1' })) : '',
    liveHref: LIVE_PAGE + '?' + childQuery({ embed: '1' }),
    hoaHref: hoa ? (HOA_PAGE + '?' + childQuery({ hoa: hoa, embed: '1' })) : '',
    nmHref: hasNearmap ? (NEARMAP_PAGE + '?' + childQuery({
      full: '1',
      delivery: delivery,
      site_no: siteNo,
      tiles: tiles
    })) : ''
  };
}

// Hubs whose home hero comes from the drone-sheet overhead (views.drone)
// instead of the parcel render. Checked 2026-09-21 by measuring the black
// fraction of a 2.5:1 cover crop: render vs sheet â€” PPS strip vs 9%,
// Bend 58% vs 26%, Roseburg 52% vs 26%, Myrtle Creek 55% vs 13%.
export const HERO_SHEET_HUBS = [
  '135df629a0d634d16324320a6f02f329', // PPS Industries
  '744a3639be95ce309192dc69b5a8e9f6', // Vyanet Bend
  'a06c4a93e36cf6473c153f88ac51113a', // Lauren Young Tire (Roseburg)
  '6d70b38ed1ad99d5a2f10f4e31921054'  // Lauren Young Tire (Myrtle Creek)
];

// The best available nadir for the home hero. Nearmap vert.jpg wins when
// this hub has a trial delivery. Otherwise the first record in
// model-then-satellite order that has nadir.url. The Drone sheet is a
// tab on 2D and 3D, not a replacement for this image.
export async function findNadir(root, idx, nm) {
  const hubId = String((idx && idx.id) || (nm && nm.propertyId) || '').trim();
  const delivery = String((nm && nm.delivery) || '').trim() || NEARMAP_HUB_DELIVERY[hubId] || '';
  if (delivery && nearmapVisible()) {
    const tiles = String((nm && nm.tiles) || CF_NEARMAP).replace(/\/?$/, '/');
    return tiles + delivery + '/vert.jpg';
  }
  const views = (idx && idx.views) || {};
  // These parcel renders are mostly empty frame (PPS is a tall strip; Bend,
  // Roseburg, and Myrtle Creek are over half black). Cover-cropping them
  // shows a corner of the site or a black card. Their drone-sheet overhead
  // is the framed property photo. The other hubs' renders fill the crop.
  if (HERO_SHEET_HUBS.indexOf(hubId) !== -1 && views.drone) {
    try {
      const sheet = await fetchJson(root + 'drone/' + views.drone + '.json');
      if (sheet && sheet.nadir && sheet.nadir.url) return String(sheet.nadir.url);
    } catch (e) {}
  }
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

// Property ids the live gateway might key this property under â€” same walk
// order as model-viewer.html (the allowlist may predate the site_no hub id).
// Eugene currently has two index files for the same building: the site_no
// hub (8eea64e5, satellite + drone-test) and the name-hash hub (4a484f8c,
// drone + drone-test). Cameras were first published on 4a484f8c. Looking up
// either hub must find that file until the two indexes are merged.
const CAMERA_HUB_SIBLINGS = {
  '8eea64e5c09dc806f667b079e111a38d': ['4a484f8c273abef3c02cf91e274f9e2f'],
  '4a484f8c273abef3c02cf91e274f9e2f': ['8eea64e5c09dc806f667b079e111a38d'],
  '2dce25a3643b86a7d8a1551228c3306f': ['6de88883bfd4a8349a901c54611ed9d7'],
  '6de88883bfd4a8349a901c54611ed9d7': ['2dce25a3643b86a7d8a1551228c3306f']
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
// array on ANY view record (not only the 3D view â€” live feed is its own
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
  const prop = String((idx && idx.id) || id || '').trim();
  if (prop) q.set('property', prop);
  const sites = idx && idx.chekt_sites;
  if (Array.isArray(sites) && sites.length) {
    q.set('site', sites.map(function (s) { return String(s); }).join('+'));
  }
  return q.toString();
}

// Unique key for a CHEKT camera. device_id is unique even when several
// channels share a bridge MAC (Gud Cultures parcels 2 and 3). Fall back
// to MAC for older Jones/Eugene rows that only have that.
export function liveCamKey(c) {
  if (!c) return '';
  if (c.device_id != null && c.device_id !== '') return String(c.device_id).toUpperCase();
  return String(c.mac || '').toUpperCase();
}

// Index /live cameras by device_id. Also index unique MACs so Jones pins
// that still store live.device as a MAC keep resolving.
export function indexLiveRoster(cameras) {
  const m = {};
  const macCount = {};
  (cameras || []).forEach(function (c) {
    const mac = String((c && c.mac) || '').toUpperCase();
    if (mac) macCount[mac] = (macCount[mac] || 0) + 1;
  });
  (cameras || []).forEach(function (c) {
    if (!c) return;
    const id = liveCamKey(c);
    if (id) m[id] = c;
    const mac = String(c.mac || '').toUpperCase();
    if (mac && macCount[mac] === 1) m[mac] = c;
  });
  return m;
}

export function parcelLabel(c) {
  const n = String((c && c.site_name) || '');
  const m = n.match(/PARCEL\s+(\d+)/i);
  if (m) return 'Parcel ' + m[1];
  if (n) return n.replace(/^VSO\s*-\s*/i, '').trim() || n;
  if (c && c.site_id != null && c.site_id !== '') return 'Site ' + c.site_id;
  return 'Cameras';
}

export function groupLiveCameras(list) {
  const groups = [];
  const byKey = {};
  (list || []).forEach(function (c) {
    const k = (c && c.site_id != null && c.site_id !== '')
      ? String(c.site_id) : parcelLabel(c);
    if (!byKey[k]) {
      byKey[k] = { key: k, label: parcelLabel(c), cameras: [] };
      groups.push(byKey[k]);
    }
    byKey[k].cameras.push(c);
  });
  return groups;
}

// Ask the gateway whether it accepts this key. Walk the alias ids the same
// way model-viewer does: 200 = accepted and this property has live cameras;
// 401 = key rejected (stop â€” the gateway checks the key before the
// property); 404 = this property id has no CHEKT sites, try the next.
// The query is only the property id. The gateway does not match address,
// name, or site_no. Anything else (429, 5xx, network) is inconclusive:
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
