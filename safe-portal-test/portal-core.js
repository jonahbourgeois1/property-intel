/*
  safe-portal/portal-core.js — shared engine for the SAFE portal layout
  variants (layout-a.html / layout-b.html / layout-c.html).  safe-portal 0.2.0

  What lives here (so the three pages differ only in layout):
    SafePortal.load(slug)            the record: fixture + numbered pins, cameras,
                                     live feeds, drone tier, mock clips, lot lines
    SafePortal.createMap(el, R, o)   Google satellite canvas (tilt 0, no rotation)
                                     with one projection positioning pins, cones,
                                     fire zones, routes and the county lot line
    SafePortal.createNadir(el, R, o) the drone nadir (orthographic render) with the
                                     same pins / cones / zones / routes drawn in
                                     local metres — the substrate the SAFE report
                                     panels in the reference deck use
    SafePortal.createModel(el, R)    lazy iframe of ../model-viewer.html (embed=1,
                                     gw=0) driving the vyanet-stage handshake
    SafePortal.renderFeeds(...)      CHEKT live tiles (SIMULATED: technician still +
                                     LIVE badge + clock; production = gateway MJPEG)
    SafePortal.clipsHTML / playerHTML / safeHTML / cardHTML / factsHTML / legendHTML
    SafePortal.brandHTML / chipsHTML / switchHTML / toast

  Data source: safe-portal/fixtures.js (window.SAFE_FIXTURES). Nothing here reads
  or writes data/ records. Camera stills are loaded from the live site so the
  mock renders from any origin (the local checkout carries no stills).
  Lot lines: public parcel tiles + ../nadir-geo.js parcelMatch, as customer-map.
*/
(function () {
  'use strict';

  var BUILD = 'safe-portal 0.2.0';
  // Same public browser key customer-map.html / golf-viewer.html / safe-portal
  // index.html load for the Maps JavaScript API (not config.js GEOCODE_KEY).
  var MAPS_KEY = 'AIzaSyD2tWrnRhCaicAwtp_32xe5zG5YGuntfuI';
  var PARCEL_BASE = 'https://raw.githubusercontent.com/jonahbourgeois1/property-intel/main/data/parcels/';
  var DESCHUTES = { name: 'deschutes', lat0: 43.61, lng0: -122.01, step: 0.07 };
  var STILLS_BASE = 'https://responder-intel.vyanet.com/data/cameras/images/';
  var MODEL_VIEWER = '../model-viewer.html';

  var COMP = {
    S: { label: 'Security', short: 'Security', color: '#3b82f6', what: 'Perimeter, approaches, sightlines, blind spots, structures and their functions. Cameras with field of view, motion, glass-break, door and window contacts.' },
    A: { label: 'Access', short: 'Access', color: '#f59e0b', what: 'Gates, driveways, service roads, doors, codes — who can get in and how. Readers, keypads, remote unlock, gate sensors.' },
    F: { label: 'Fire', short: 'Fire', color: '#ef4444', what: 'Defensible space, fuel concentration, vegetation against structures, hydrants and water sources, wildfire exposure. Smoke, heat and life-safety detectors.' },
    E: { label: 'Emergency service', short: 'Emergency', color: '#22c55e', what: 'Routes a vehicle can use, turning space, helicopter ground, hazards, occupant considerations. Panic and medical alerts; the responder packet.' }
  };
  var ORDER = ['S', 'A', 'F', 'E'];

  var ICON = {
    camera: '<rect x="2" y="4.5" width="8.5" height="7.5" rx="1.5"/><path d="M10.5 7.5l3.5-2v6l-3.5-2z"/>',
    panel: '<rect x="3.5" y="2" width="9" height="12" rx="1"/><path d="M6 5h4M6 8h4M6 11h2"/>',
    contact: '<rect x="2" y="3" width="6" height="10" rx="1"/><rect x="9.5" y="5" width="4.5" height="6" rx="1"/>',
    motion: '<circle cx="8" cy="8" r="1.8"/><path d="M3.5 4.5a6.5 6.5 0 0 1 9 0M3.5 11.5a6.5 6.5 0 0 0 9 0"/>',
    glass: '<path d="M3 3h10v10H3z"/><path d="M8.5 3l-2 4.5 3 1-2 4.5"/>',
    gate: '<path d="M2.5 14V3M13.5 14V3M2.5 6h11M2.5 10h11M6 3v11M10 3v11"/>',
    door: '<path d="M4 2h8v12H4z"/><circle cx="9.8" cy="8" r="0.9"/>',
    key: '<circle cx="6" cy="6" r="3"/><path d="M8.2 8.2L14 14M11 11l2-2M12 14l2-2"/>',
    smoke: '<circle cx="8" cy="8" r="6"/><circle cx="8" cy="8" r="1.8"/>',
    water: '<path d="M8 2s-5 5.5-5 8.5a5 5 0 0 0 10 0C13 7.5 8 2 8 2z"/>',
    hydrant: '<path d="M5 14h6M6 14V6a2 2 0 0 1 4 0v8M4 8.5h8M8 2v2"/>',
    hazard: '<path d="M8 2.5l6 10.5H2z"/><path d="M8 7v3M8 12v0.3"/>',
    staging: '<path d="M2 11h12M4 11V8l2-3h4l2 3v3"/><circle cx="5" cy="12.5" r="1"/><circle cx="11" cy="12.5" r="1"/>',
    lz: '<circle cx="8" cy="8" r="6"/><path d="M5.5 5v6M10.5 5v6M5.5 8h5"/>',
    medical: '<path d="M6 2h4v4h4v4h-4v4H6v-4H2V6h4z"/>',
    alert: '<path d="M8 2a4 4 0 0 1 4 4v3l1.5 2h-11L4 9V6a4 4 0 0 1 4-4z"/><path d="M6.5 13a1.5 1.5 0 0 0 3 0"/>',
    route: '<circle cx="4" cy="12" r="2"/><circle cx="12" cy="4" r="2"/><path d="M5.5 10.5l5-5"/>',
    feature: '<circle cx="8" cy="8" r="2.5"/>',
    building: '<path d="M2 14V6l6-4 6 4v8z"/><path d="M6 14v-4h4v4"/>',
    cube: '<path d="M12 2l9 5v10l-9 5-9-5V7z"/><path d="M3 7l9 5 9-5M12 12v10"/>'
  };

  // Drone tier per fixture slug — the drone-test record's nadir render, the four
  // compass obliques and the parcel-clipped GLB (data/drone-test/83af9960….json).
  var TRACY = 'https://d3fg47bqswi0rr.cloudfront.net/captures/plane/tracy-residence-2026-06-16/parcels/181102C000600/';
  var DRONE = {
    residence: {
      capture: 'tracy-residence-2026-06-16',
      taxlot: '181102C000600',
      flown: 'June 16, 2026',
      nadir: {
        url: TRACY + 'renders/nadir.jpg', w: 1568, h: 1367,
        bounds: { north: 44.04270592455917, south: 44.04005000315991, east: -121.37701615691185, west: -121.38125136494637 },
        local: { nw: [-165.146, 205.744], ne: [174.308, 205.744], sw: [-165.146, -89.364], se: [174.308, -89.364] }
      },
      // alpha = frontage bearing (row-3 oracle 231.3°); bravo/charlie/delta = +90/180/270 clockwise
      obliques: [
        { id: 'alpha', label: 'Alpha', side: 'Front', bearing: 231, url: TRACY + 'renders/alpha.jpg',
          desc: 'The front oblique shows the main residence set well back from the road, accessed by a curved private driveway that winds through scattered high-desert scrub and conifer clusters|The tennis court is visible to the upper left of the structure|The approach from the front is lengthy with limited straight-line visibility of the structure until close to the building|Dense tree clusters flank both sides of the driveway corridor, narrowing effective sightlines|The frontage road curves away from the property with no immediate turnaround visible at the entry point.' },
        { id: 'bravo', label: 'Bravo', side: 'Right', bearing: 321, url: TRACY + 'renders/bravo.jpg',
          desc: 'The right-side oblique shows the rear/right flank of the property dominated by open high-desert terrain with scattered conifers and sagebrush|The driveway loop is visible curving around the right side of the residence|Limited access from this side is evident — no secondary road or dedicated path approaches from the right|Tree clusters close to the right side of the structure could impede ground movement and ladder access|The open terrain beyond the landscaped zone transitions quickly to unimproved native scrub.' },
        { id: 'charlie', label: 'Charlie', side: 'Rear', bearing: 51, url: TRACY + 'renders/charlie.jpg',
          desc: 'The rear oblique shows the back of the main residence surrounded by a landscaped lawn island with dense tree and shrub planting tightly encircling the structure|A separate rectangular hardcourt (tennis court) is visible to the upper right|No rear access road or lane is visible — the rear of the structure is accessible only by looping around from the front driveway|Heavy conifer and shrub planting directly against the rear and sides of the structure limits both sightlines and ground movement to rear walls.' },
        { id: 'delta', label: 'Delta', side: 'Left', bearing: 141, url: TRACY + 'renders/delta.jpg',
          desc: 'The left-side oblique shows a detached structure (garage/outbuilding) to the left of the main residence, connected via the curved driveway|A separate smaller hardcourt or paved pad is visible on the far left|The driveway curves prominently here, and the vegetation canopy overhangs portions of the drive|The left flank of the property transitions into open native terrain with scattered conifers|No secondary egress or turnaround area is visible on this side beyond the main driveway loop.' }
      ],
      model: TRACY + 'clipped.glb'
    }
  };

  // Mock clips (what the gateway /clips call returns in production: 7-day
  // events with 1-hour signed links). Camera ids are the fixture's pins.
  var CLIPS = {
    residence: [
      { cam: 'cam-14', t: 'Today 06:42', kind: 'vehicle', title: 'Vehicle on the frontage', dur: 14 },
      { cam: 'cam-01', t: 'Today 06:40', kind: 'person', title: 'Person at the front walkway', dur: 9 },
      { cam: 'cam-01', t: 'Yesterday 21:15', kind: 'access', title: 'Front door opened — disarmed by user code 2', dur: 22 },
      { cam: 'cam-14', t: 'Yesterday 18:07', kind: 'motion', title: 'Motion — driveway court', dur: 9 },
      { cam: 'cam-08', t: 'Yesterday 07:55', kind: 'person', title: 'Person on the lower deck', dur: 22 },
      { cam: 'cam-07', t: '2 days ago 02:51', kind: 'alarm', title: 'Alarm review — glass-break, living room (no activity seen)', dur: 31 },
      { cam: 'cam-08', t: '2 days ago 02:50', kind: 'alarm', title: 'Alarm review — glass-break, living room (no activity seen)', dur: 28 },
      { cam: 'cam-14', t: '3 days ago 16:20', kind: 'vehicle', title: 'Delivery vehicle — driveway court', dur: 12 },
      { cam: 'cam-14', t: '5 days ago 17:30', kind: 'access', title: 'Garage door opened remotely for landscaping contractor', dur: 18 }
    ]
  };

  // ---------- helpers ----------
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function el(tag, cls) { var e = document.createElement(tag); if (cls) e.className = cls; return e; }
  function svgEl(tag) { return document.createElementNS('http://www.w3.org/2000/svg', tag); }
  function icon(kind) { return '<svg viewBox="0 0 16 16">' + (ICON[kind] || ICON.feature) + '</svg>'; }
  function color(c) { return (COMP[c] || COMP.S).color; }
  function fmt(n) { return Number(n).toLocaleString(); }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function clock() { var d = new Date(); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds()); }
  function haversine(a, b) {
    var R = 6371000, toR = Math.PI / 180;
    var dLat = (b.lat - a.lat) * toR, dLng = (b.lng - a.lng) * toR;
    var s = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(s));
  }
  var SPLIT_RE;
  try { SPLIT_RE = new RegExp('(?<=[.!?])\\s+(?=[A-Z0-9(\u201C"])'); } catch (e) { SPLIT_RE = /\.\s+(?=[A-Z])/; }
  // Report prose → bullet list (the reference deck shows SHOULD KNOW and
  // RECOMMENDATIONS as bullets; the record stores them as paragraphs).
  function sentences(text) {
    return String(text || '').split(SPLIT_RE).map(function (s) { return s.trim(); }).filter(Boolean);
  }
  var params = new URLSearchParams(window.location.search);

  // One clock for every simulated-live timestamp on the page.
  setInterval(function () {
    var t = clock();
    document.querySelectorAll('[data-sp-clock]').forEach(function (e) { e.textContent = t; });
  }, 1000);

  var toastEl = null;
  function toast(html) {
    if (!toastEl) { toastEl = el('div', 'sp-toast'); document.body.appendChild(toastEl); }
    toastEl.innerHTML = html; toastEl.classList.add('on');
    clearTimeout(toastEl.__tm); toastEl.__tm = setTimeout(function () { toastEl.classList.remove('on'); }, 3200);
  }

  // ---------- record ----------
  function load(slug) {
    var all = window.SAFE_FIXTURES || {};
    var fx = all[slug] || all.residence;
    var pins = fx.pins.filter(function (p) { return p.kind !== 'lot'; });
    var byId = {}, byComp = { S: [], A: [], F: [], E: [] };
    pins.forEach(function (p) { byId[p.id] = p; (byComp[p.comp] || (byComp[p.comp] = [])).push(p); });
    // Stable numbering per component: the map, the nadir and the report list
    // all show the same number for the same pin.
    ORDER.forEach(function (c) { byComp[c].forEach(function (p, i) { p.n = i + 1; }); });
    var cams = pins.filter(function (p) { return p.kind === 'camera'; });
    cams.forEach(function (p) {
      if (p.photo && p.photo.indexOf('../data/cameras/images/') === 0) p.photo = STILLS_BASE + p.photo.slice('../data/cameras/images/'.length);
    });
    var live = cams.filter(function (p) { return p.live; });
    var clips = (CLIPS[fx.slug] || []).map(function (c, i) {
      return { i: i, cam: c.cam, camera: byId[c.cam] || null, t: c.t, kind: c.kind, title: c.title, dur: c.dur };
    });
    var R = {
      fx: fx, slug: fx.slug, hub: fx.id, name: fx.name, address: fx.address,
      pins: pins, byId: byId, byComp: byComp, cams: cams, live: live,
      drone: DRONE[fx.slug] || null, clips: clips, events: fx.events || [],
      counts: {}
    };
    ORDER.forEach(function (c) { R.counts[c] = byComp[c].length; });
    R.parcels = loadParcels(R);
    return R;
  }

  // ---------- lot lines (same public tiles + matcher customer-map.html uses) ----------
  function parcelFileFor(lat, lng, county) {
    var latCell = Math.floor((lat - county.lat0) / county.step) * county.step + county.lat0;
    var lngCell = Math.floor((lng - county.lng0) / county.step) * county.step + county.lng0;
    return county.name + '_' + latCell.toFixed(2) + '_' + lngCell.toFixed(2) + '.geojson';
  }
  function ringsOf(feat) {
    var g = feat && feat.geometry;
    var polys = !g ? [] : g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
    return polys.map(function (poly) { return (poly[0] || []).map(function (c) { return { lat: c[1], lng: c[0] }; }); })
      .filter(function (ring) { return ring.length >= 3; });
  }
  function lotLabel(props) {
    props = props || {};
    return String(props.MAPTAXLOT || props.TAXLOT || props.MapNum || props.PIN || props.PROP_ID || '');
  }
  function loadParcels(R) {
    if (typeof NadirGeo === 'undefined' || typeof NadirGeo.parcelMatch !== 'function') return Promise.resolve([]);
    var c = R.fx.center;
    return fetch(PARCEL_BASE + parcelFileFor(c.lat, c.lng, DESCHUTES))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (gj) {
        if (!gj) return [];
        var m = NadirGeo.parcelMatch(gj, c.lat, c.lng);
        return m ? [{ rings: ringsOf(m), subject: true, label: lotLabel(m.properties) }] : [];
      })
      .catch(function () { return []; });
  }

  // ---------- pins (DOM) ----------
  function pinEl(p, style) {
    var e = el('div', ['sp-pin', p.comp, 'kind-' + p.kind, 'pl-' + (p.placement || 'surveyed')].join(' '));
    if (p.status) e.classList.add('st-' + String(p.status).replace('/', ''));
    e.dataset.id = p.id;
    var inner = style === 'icon' ? icon(p.kind) : String(p.n);
    e.innerHTML = '<div class="dot">' + inner + '</div><span class="led"></span><span class="warn"></span>' +
      (p.live ? '<span class="livetag">LIVE</span>' : '') + '<span class="lbl">' + esc(p.name) + '</span>';
    return e;
  }
  // Rectangle in metres centred on a point (e.g. the EMS / command staging box).
  function rectPath(x, y, w, h) {
    return 'M' + (x - w / 2).toFixed(2) + ' ' + (y - h / 2).toFixed(2) + 'h' + w.toFixed(2) + 'v' + h.toFixed(2) + 'h' + (-w).toFixed(2) + 'Z';
  }
  function conePath(x, y, r, heading, fov) {
    var a0 = (heading - fov / 2) * Math.PI / 180, a1 = (heading + fov / 2) * Math.PI / 180;
    var x0 = x + r * Math.sin(a0), y0 = y - r * Math.cos(a0);
    var x1 = x + r * Math.sin(a1), y1 = y - r * Math.cos(a1);
    var large = fov > 180 ? 1 : 0;
    return 'M' + x.toFixed(2) + ' ' + y.toFixed(2) + 'L' + x0.toFixed(2) + ' ' + y0.toFixed(2) + 'A' + r.toFixed(2) + ' ' + r.toFixed(2) + ' 0 ' + large + ' 1 ' + x1.toFixed(2) + ' ' + y1.toFixed(2) + 'Z';
  }

  // ---------- Google Maps loader (one script per page) ----------
  var mapsPromise = null, authFailHandlers = [];
  function loadGoogleMaps() {
    if (mapsPromise) return mapsPromise;
    mapsPromise = new Promise(function (resolve, reject) {
      if (window.google && window.google.maps && window.google.maps.Map) { resolve(window.google.maps); return; }
      if (params.get('flat') === '1') { reject(new Error('flat=1 requested')); return; }
      var done = false;
      var timer = setTimeout(function () { if (!done) { done = true; reject(new Error('Maps did not answer in 9 s')); } }, 9000);
      window.__spMapsReady = function () { if (done) return; done = true; clearTimeout(timer); resolve(window.google.maps); };
      window.gm_authFailure = function () {
        if (!done) { done = true; clearTimeout(timer); reject(new Error('Maps key rejected for this origin')); return; }
        authFailHandlers.forEach(function (fn) { fn('Maps key rejected for this origin'); });
      };
      var s = document.createElement('script');
      s.src = 'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(MAPS_KEY) + '&callback=__spMapsReady&v=weekly';
      s.async = true; s.defer = true;
      s.onerror = function () { if (done) return; done = true; clearTimeout(timer); reject(new Error('Maps script did not load')); };
      document.head.appendChild(s);
    });
    return mapsPromise;
  }

  // ---------- Google map canvas ----------
  // opts: { layers, focus, lot, labels, pinStyle:'num'|'icon', onSelect(p|null, meta), onFail(reason), onReady() }
  function createMap(container, R, opts) {
    opts = opts || {};
    var st = {
      layers: { S: true, A: true, F: true, E: true }, focus: opts.focus || null,
      lot: opts.lot !== false, labels: !!opts.labels, sel: null,
      map: null, overlay: null, parcels: [], ready: false, failed: null
    };
    if (opts.layers) ORDER.forEach(function (c) { if (c in opts.layers) st.layers[c] = !!opts.layers[c]; });
    var mapDiv = el('div', 'sp-mapdiv'); container.appendChild(mapDiv);
    var note = el('div', 'sp-mapnote'); container.appendChild(note);
    var loading = el('div', 'sp-loading'); loading.innerHTML = '<div class="sp-spinner"></div><span>Loading satellite canvas…</span>'; container.appendChild(loading);
    var host = el('div', 'sp-ovhost');
    var svg = svgEl('svg'); svg.setAttribute('class', 'sp-ovsvg'); host.appendChild(svg);
    var pinLayer = el('div'); host.appendChild(pinLayer);
    host.classList.toggle('labels', st.labels);
    var els = {}, px = {};

    function visible(p) { return !!st.layers[p.comp]; }
    function dim(c) { return !!(st.focus && c !== st.focus); }
    function fail(reason) {
      st.failed = reason;
      loading.classList.add('hidden');
      note.textContent = 'Google Maps unavailable here — ' + reason + '. Serve from localhost or responder-intel.vyanet.com for the satellite canvas.';
      note.classList.add('on');
      if (opts.onFail) opts.onFail(reason);
    }

    function rebuildPins() {
      pinLayer.innerHTML = ''; els = {};
      R.pins.filter(visible).forEach(function (p) {
        var e = pinEl(p, opts.pinStyle || 'num');
        e.classList.toggle('sel', st.sel === p.id);
        e.classList.toggle('dim', dim(p.comp));
        e.addEventListener('click', function (ev) { ev.stopPropagation(); select(p.id, false, 'map'); });
        els[p.id] = e;
        pinLayer.appendChild(e);
      });
      relayout();
    }

    // One projection positions every pin, cone, zone, route and lot line.
    function layout(project, mpp) {
      var pins = R.pins.filter(visible);
      var pts = [];
      px = {};
      pins.forEach(function (p) {
        var q = project(p.lat, p.lng);
        px[p.id] = q;
        var e = els[p.id];
        if (e) { e.style.left = q.x + 'px'; e.style.top = q.y + 'px'; }
        pts.push(q);
        if (p.kind === 'camera' && p.range) { var r = p.range / mpp; pts.push({ x: q.x - r, y: q.y - r }, { x: q.x + r, y: q.y + r }); }
      });
      var fx = R.fx;
      var zones = (fx.zones || []).filter(function (z) { return st.layers[z.comp]; });
      zones.forEach(function (z) { var q = project(z.lat, z.lng); var r = z.radius_m / mpp; z.__q = q; z.__r = r; pts.push({ x: q.x - r, y: q.y - r }, { x: q.x + r, y: q.y + r }); });
      var routes = (fx.routes || []).filter(function (r) { return st.layers[r.comp]; });
      routes.forEach(function (r) { r.__q = r.points.map(function (pt) { var q = project(pt.lat, pt.lng); pts.push(q); return q; }); });
      var areas = (fx.areas || []).filter(function (a) { return st.layers[a.comp]; });
      areas.forEach(function (a) { a.__q = project(a.lat, a.lng); pts.push(a.__q); });
      var parcels = st.lot ? st.parcels : [];
      parcels.forEach(function (pc) { pc.__q = pc.rings.map(function (ring) { return ring.map(function (pt) { var q = project(pt.lat, pt.lng); pts.push(q); return q; }); }); });
      if (!pts.length) { svg.innerHTML = ''; if (opts.onDraw) opts.onDraw(); return; }
      var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      pts.forEach(function (q) { if (q.x < minX) minX = q.x; if (q.y < minY) minY = q.y; if (q.x > maxX) maxX = q.x; if (q.y > maxY) maxY = q.y; });
      var pad = 60;
      minX -= pad; minY -= pad; maxX += pad; maxY += pad;
      svg.style.left = minX + 'px'; svg.style.top = minY + 'px';
      svg.setAttribute('width', Math.max(1, maxX - minX));
      svg.setAttribute('height', Math.max(1, maxY - minY));
      var out = ['<g transform="translate(' + (-minX) + ',' + (-minY) + ')">'];
      parcels.forEach(function (pc) {
        pc.__q.forEach(function (ring) {
          out.push('<path class="parcel" d="' + ring.map(function (q, i) { return (i ? 'L' : 'M') + q.x.toFixed(1) + ' ' + q.y.toFixed(1); }).join('') + 'Z"/>');
        });
      });
      zones.forEach(function (z) {
        out.push('<circle class="zone' + (dim(z.comp) ? ' dim' : '') + '" cx="' + z.__q.x.toFixed(1) + '" cy="' + z.__q.y.toFixed(1) + '" r="' + z.__r.toFixed(1) + '"/>');
        if (z.__r > 28 && !dim(z.comp)) out.push('<text class="zone-label" x="' + (z.__q.x + z.__r * 0.72).toFixed(1) + '" y="' + (z.__q.y - z.__r * 0.72).toFixed(1) + '">' + esc(z.name) + '</text>');
      });
      pins.forEach(function (p) {
        if (p.kind !== 'camera' || p.heading == null) return;
        var q = px[p.id], r = (p.range || 25) / mpp;
        var cls = 'cone' + (p.status === 'live' ? ' live' : '') + (p.status === 'offline' || dim(p.comp) ? ' dim' : '');
        out.push('<path class="' + cls + '" style="fill:' + color(p.comp) + ';stroke:' + color(p.comp) + '" d="' + conePath(q.x, q.y, r, p.heading, p.fov || 90) + '"/>');
      });
      areas.forEach(function (a) {
        var col = a.color || color(a.comp);
        out.push('<path class="area' + (dim(a.comp) ? ' dim' : '') + '" style="stroke:' + col + ';fill:' + col + '" d="' + rectPath(a.__q.x, a.__q.y, a.w_m / mpp, a.h_m / mpp) + '"/>');
        if (a.label && !dim(a.comp)) out.push('<text class="area-label" style="fill:' + col + '" x="' + (a.__q.x - a.w_m / mpp / 2).toFixed(1) + '" y="' + (a.__q.y - a.h_m / mpp / 2 - 5).toFixed(1) + '">' + esc(a.label) + '</text>');
      });
      routes.forEach(function (r) {
        var d = r.__q.map(function (q, i) { return (i ? 'L' : 'M') + q.x.toFixed(1) + ' ' + q.y.toFixed(1); }).join('');
        var dd = dim(r.comp), col = r.color || color(r.comp);
        out.push('<path class="route-halo" d="' + d + '"/><path class="route' + (dd ? ' dim' : '') + (r.estimated ? ' estimated' : '') + '" style="stroke:' + col + '" d="' + d + '"/>');
        if (!dd && r.numbered !== false) r.__q.forEach(function (q, i) {
          out.push('<circle class="route-pt" style="stroke:' + col + '" cx="' + q.x.toFixed(1) + '" cy="' + q.y.toFixed(1) + '" r="8"/><text class="route-num" style="fill:' + col + '" x="' + q.x.toFixed(1) + '" y="' + q.y.toFixed(1) + '">' + (i + 1) + '</text>');
        });
      });
      if (st.sel && px[st.sel]) {
        var s = px[st.sel];
        out.push('<circle class="hl" cx="' + s.x.toFixed(1) + '" cy="' + s.y.toFixed(1) + '" r="19"/>');
      }
      out.push('</g>');
      svg.innerHTML = out.join('');
      if (opts.onDraw) opts.onDraw();
    }

    function relayout() { if (st.overlay) st.overlay.draw(); }

    function init(gm) {
      var fx = R.fx;
      var map = new gm.Map(mapDiv, {
        center: fx.center, zoom: opts.zoom || fx.zoom,
        mapTypeId: gm.MapTypeId.SATELLITE,
        tilt: 0, rotateControl: false, maxZoom: 21,
        mapTypeControl: opts.mapTypeControl !== false,
        mapTypeControlOptions: { style: gm.MapTypeControlStyle.DROPDOWN_MENU, mapTypeIds: ['satellite', 'hybrid', 'roadmap'], position: gm.ControlPosition[opts.typePos || 'TOP_LEFT'] },
        zoomControl: opts.zoomControl !== false, zoomControlOptions: { position: gm.ControlPosition[opts.zoomPos || 'LEFT_CENTER'] },
        streetViewControl: false, fullscreenControl: false, clickableIcons: false,
        gestureHandling: 'greedy', scrollwheel: true
      });
      map.setTilt(0);
      st.map = map;
      var ov = new gm.OverlayView();
      ov.onAdd = function () { this.getPanes().overlayMouseTarget.appendChild(host); };
      ov.draw = function () {
        var proj = this.getProjection();
        if (!proj) return;
        var z = map.getZoom(), c = map.getCenter();
        var mpp = 156543.03392 * Math.cos(c.lat() * Math.PI / 180) / Math.pow(2, z);
        layout(function (lat, lng) { var p = proj.fromLatLngToDivPixel(new gm.LatLng(lat, lng)); return { x: p.x, y: p.y }; }, mpp);
      };
      ov.onRemove = function () { if (host.parentNode) host.parentNode.removeChild(host); };
      ov.setMap(map);
      st.overlay = ov;
      map.addListener('click', function () { clear('map'); });
      // Keep the same ground point centred when the container changes size
      // (Google anchors the top-left on resize; an iframe that grows would
      // otherwise slide the property out of view).
      if (window.ResizeObserver) {
        var lastW = container.clientWidth, lastH = container.clientHeight;
        new ResizeObserver(function () {
          var w = container.clientWidth, h = container.clientHeight;
          if (!w || !h || (w === lastW && h === lastH)) return;
          lastW = w; lastH = h;
          var c = map.getCenter();
          gm.event.trigger(map, 'resize');
          if (c) map.setCenter(c);
          relayout();
        }).observe(container);
      }
      loading.classList.add('hidden');
      st.ready = true;
      authFailHandlers.push(fail);
      if (opts.onReady) opts.onReady(ctl);
    }

    function select(id, fly, source) {
      var p = R.byId[id];
      if (!p) return;
      if (!visible(p)) { st.layers[p.comp] = true; rebuildPins(); }
      st.sel = id;
      Object.keys(els).forEach(function (k) { els[k].classList.toggle('sel', k === id); });
      var e = els[id];
      if (e) { e.classList.remove('pulse'); void e.offsetWidth; e.classList.add('pulse'); }
      if (fly && st.map) {
        st.map.panTo({ lat: p.lat, lng: p.lng });
        if (st.map.getZoom() < (opts.minZoom || R.fx.zoom)) st.map.setZoom(opts.minZoom || R.fx.zoom);
      }
      relayout();
      if (opts.onSelect) opts.onSelect(p, { source: source || 'api' });
    }
    function clear(source) {
      if (!st.sel) return;
      st.sel = null;
      Object.keys(els).forEach(function (k) { els[k].classList.remove('sel'); });
      relayout();
      if (opts.onSelect) opts.onSelect(null, { source: source || 'api' });
    }

    var ctl = {
      state: st,
      select: select,
      clear: clear,
      relayout: relayout,
      setLayers: function (obj) { ORDER.forEach(function (c) { if (c in obj) st.layers[c] = !!obj[c]; }); rebuildPins(); },
      toggleLayer: function (c) { st.layers[c] = !st.layers[c]; rebuildPins(); return st.layers[c]; },
      setFocus: function (c) { st.focus = c || null; Object.keys(els).forEach(function (k) { els[k].classList.toggle('dim', dim(R.byId[k].comp)); }); relayout(); },
      setLot: function (b) { st.lot = !!b; relayout(); },
      setLabels: function (b) { st.labels = !!b; host.classList.toggle('labels', st.labels); },
      setView: function (center, zoom) { if (st.map) { st.map.setCenter(center); if (zoom) st.map.setZoom(zoom); } },
      zoomBy: function (d) { if (st.map) st.map.setZoom(Math.max(12, Math.min(21, st.map.getZoom() + d))); },
      fitPoints: function (pts, pad) {
        if (!st.map || !window.google || !pts || !pts.length) return;
        var b = new google.maps.LatLngBounds();
        pts.forEach(function (p) { b.extend({ lat: p.lat, lng: p.lng }); });
        st.map.fitBounds(b, pad == null ? 60 : pad);
      },
      fit: function () {
        if (!st.map || !window.google) return;
        var pins = R.pins.filter(visible);
        if (!pins.length) return;
        var b = new google.maps.LatLngBounds();
        pins.forEach(function (p) { b.extend({ lat: p.lat, lng: p.lng }); });
        st.map.fitBounds(b, opts.fitPad || 40);
      },
      resize: function () { if (st.map && window.google) { google.maps.event.trigger(st.map, 'resize'); relayout(); } },
      // Pixel position of a ground point relative to the map container (for
      // callout boxes and leader lines drawn outside the overlay panes).
      containerPx: function (lat, lng) {
        if (!st.overlay || !window.google) return null;
        var proj = st.overlay.getProjection();
        if (!proj) return null;
        var p = proj.fromLatLngToContainerPixel(new google.maps.LatLng(lat, lng));
        return p ? { x: p.x, y: p.y } : null;
      }
    };

    R.parcels.then(function (pc) { st.parcels = pc; relayout(); });
    loadGoogleMaps().then(function (gm) { init(gm); rebuildPins(); }, function (err) { fail(err && err.message || String(err)); });
    rebuildPins();
    return ctl;
  }

  // ---------- drone nadir with the same pins, drawn in local metres ----------
  // opts: { layers, focus, labels:true|false|'auto', pinStyle, onSelect(p|null, meta), showRoutes, showZones, showLot }
  function createNadir(container, R, opts) {
    opts = opts || {};
    var D = R.drone;
    if (!D) { container.innerHTML = '<div class="sp-loading" style="position:static">No drone capture on this record</div>'; return null; }
    var N = D.nadir, b = N.bounds, L = N.local;
    var W = L.ne[0] - L.nw[0], H = L.nw[1] - L.sw[1];
    var st = { layers: { S: true, A: true, F: true, E: true }, focus: opts.focus || null, labels: opts.labels == null ? 'auto' : opts.labels, sel: null, parcels: [], lot: opts.showLot !== false };
    if (opts.layers) ORDER.forEach(function (c) { if (c in opts.layers) st.layers[c] = !!opts.layers[c]; });

    function pct(lat, lng) { return { x: (lng - b.west) / (b.east - b.west) * 100, y: (b.north - lat) / (b.north - b.south) * 100 }; }
    function mtr(lat, lng) { var q = pct(lat, lng); return { x: L.nw[0] + q.x / 100 * W, y: -L.nw[1] + q.y / 100 * H }; }

    container.classList.add('sp-nadir');
    var frame = el('div', 'frame');
    var img = new Image(); img.alt = ''; img.referrerPolicy = 'no-referrer'; img.src = N.url;
    var svg = svgEl('svg');
    svg.setAttribute('viewBox', [L.nw[0], -L.nw[1], W, H].join(' '));
    svg.setAttribute('preserveAspectRatio', 'none');
    var pins = el('div', 'pins');
    var north = el('div', 'north'); north.textContent = 'N';
    var scale = el('div', 'scale'); scale.innerHTML = '<i></i>50 m';
    var src = el('div', 'src'); src.textContent = 'Drone nadir · ' + D.capture;
    frame.appendChild(img); frame.appendChild(svg); frame.appendChild(pins); frame.appendChild(north); frame.appendChild(scale); frame.appendChild(src);
    container.appendChild(frame);
    var els = {};

    function visible(p) { return !!st.layers[p.comp]; }
    function dim(c) { return !!(st.focus && c !== st.focus); }
    function inFrame(q) { return q.x >= -1 && q.x <= 101 && q.y >= -1 && q.y <= 101; }
    function fitFrame() {
      var cw = container.clientWidth, ch = container.clientHeight;
      if (!cw || !ch) return;
      var a = N.w / N.h, w, h;
      if (cw / ch > a) { h = ch; w = ch * a; } else { w = cw; h = cw / a; }
      frame.style.width = w + 'px'; frame.style.height = h + 'px';
      scale.querySelector('i').style.width = Math.max(10, 50 / W * w).toFixed(0) + 'px';
      if (opts.onDraw) opts.onDraw();
    }
    function labelsOn() {
      if (st.labels === 'auto') return R.pins.filter(visible).length <= 10;
      return !!st.labels;
    }
    function draw() {
      pins.innerHTML = ''; els = {};
      frame.classList.toggle('labels', labelsOn());
      var out = [];
      if (st.lot) st.parcels.forEach(function (pc) {
        pc.rings.forEach(function (ring) {
          out.push('<path class="parcel" d="' + ring.map(function (pt, i) { var q = mtr(pt.lat, pt.lng); return (i ? 'L' : 'M') + q.x.toFixed(2) + ' ' + q.y.toFixed(2); }).join('') + 'Z"/>');
        });
      });
      if (opts.showZones !== false) (R.fx.zones || []).filter(function (z) { return st.layers[z.comp]; }).forEach(function (z) {
        var q = mtr(z.lat, z.lng);
        out.push('<circle class="zone' + (dim(z.comp) ? ' dim' : '') + '" cx="' + q.x.toFixed(2) + '" cy="' + q.y.toFixed(2) + '" r="' + z.radius_m + '"/>');
      });
      R.pins.filter(visible).forEach(function (p) {
        if (p.kind !== 'camera' || p.heading == null) return;
        var q = mtr(p.lat, p.lng);
        var cls = 'cone' + (p.status === 'live' ? ' live' : '') + (p.status === 'offline' || dim(p.comp) ? ' dim' : '');
        out.push('<path class="' + cls + '" style="fill:' + color(p.comp) + ';stroke:' + color(p.comp) + '" d="' + conePath(q.x, q.y, p.range || 25, p.heading, p.fov || 90) + '"/>');
      });
      (R.fx.areas || []).filter(function (a) { return st.layers[a.comp]; }).forEach(function (a) {
        var q = mtr(a.lat, a.lng), col = a.color || color(a.comp);
        out.push('<path class="area' + (dim(a.comp) ? ' dim' : '') + '" style="stroke:' + col + ';fill:' + col + '" d="' + rectPath(q.x, q.y, a.w_m, a.h_m) + '"/>');
      });
      if (opts.showRoutes !== false) (R.fx.routes || []).filter(function (r) { return st.layers[r.comp]; }).forEach(function (r) {
        var d = r.points.map(function (pt, i) { var q = mtr(pt.lat, pt.lng); return (i ? 'L' : 'M') + q.x.toFixed(2) + ' ' + q.y.toFixed(2); }).join('');
        var col = r.color || color(r.comp);
        out.push('<path class="route-halo" d="' + d + '"/><path class="route' + (dim(r.comp) ? ' dim' : '') + (r.estimated ? ' estimated' : '') + '" style="stroke:' + col + '" d="' + d + '"/>');
        if (r.numbered !== false) r.points.forEach(function (pt, i) {
          var q = pct(pt.lat, pt.lng);
          var e = el('div', 'rpt' + (dim(r.comp) ? ' dim' : ''));
          e.style.left = q.x + '%'; e.style.top = q.y + '%'; e.style.borderColor = col; e.style.color = col; e.textContent = i + 1;
          pins.appendChild(e);
        });
      });
      svg.innerHTML = out.join('');
      R.pins.filter(visible).forEach(function (p) {
        var q = pct(p.lat, p.lng);
        if (!inFrame(q)) return;
        var e = pinEl(p, opts.pinStyle || 'num');
        e.style.left = q.x + '%'; e.style.top = q.y + '%';
        e.classList.toggle('sel', st.sel === p.id);
        e.classList.toggle('dim', dim(p.comp));
        e.addEventListener('click', function (ev) { ev.stopPropagation(); select(p.id, 'nadir'); });
        els[p.id] = e;
        pins.appendChild(e);
      });
      if (opts.onDraw) opts.onDraw();
    }
    function containerPx(lat, lng) {
      var q = pct(lat, lng);
      var fr = frame.getBoundingClientRect(), cr = container.getBoundingClientRect();
      return { x: fr.left - cr.left + q.x / 100 * fr.width, y: fr.top - cr.top + q.y / 100 * fr.height };
    }
    function select(id, source) {
      var p = R.byId[id];
      if (!p) return;
      if (!visible(p)) { st.layers[p.comp] = true; draw(); }
      st.sel = id;
      Object.keys(els).forEach(function (k) { els[k].classList.toggle('sel', k === id); });
      var e = els[id];
      if (e) { e.classList.remove('pulse'); void e.offsetWidth; e.classList.add('pulse'); }
      if (opts.onSelect) opts.onSelect(p, { source: source || 'api', offFrame: !e });
    }
    function clear(source) {
      if (!st.sel) return;
      st.sel = null;
      Object.keys(els).forEach(function (k) { els[k].classList.remove('sel'); });
      if (opts.onSelect) opts.onSelect(null, { source: source || 'api' });
    }
    container.addEventListener('click', function (e) { if (!e.target.closest('.sp-pin')) clear('nadir'); });
    if (window.ResizeObserver) new ResizeObserver(fitFrame).observe(container); else window.addEventListener('resize', fitFrame);
    fitFrame();
    R.parcels.then(function (pc) { st.parcels = pc; draw(); });
    draw();
    return {
      state: st,
      select: select,
      clear: clear,
      redraw: draw,
      resize: fitFrame,
      setLayers: function (obj) { ORDER.forEach(function (c) { if (c in obj) st.layers[c] = !!obj[c]; }); draw(); },
      toggleLayer: function (c) { st.layers[c] = !st.layers[c]; draw(); return st.layers[c]; },
      setFocus: function (c) { st.focus = c || null; draw(); },
      setLabels: function (v) { st.labels = v; draw(); },
      setLot: function (b) { st.lot = !!b; draw(); },
      containerPx: containerPx,
      offFrame: function () { return R.pins.filter(visible).filter(function (p) { return !inFrame(pct(p.lat, p.lng)); }); }
    };
  }

  // ---------- 3D model (model-viewer.html in an iframe, lazy) ----------
  // The hub protocol: embed=1 keeps the render loop off until the parent posts
  // {type:'vyanet-stage', stage:'3d'}; the child announces vyanet-ready first.
  function createModel(container, R, opts) {
    opts = opts || {};
    var st = { iframe: null, ready: false, wantOn: false };
    var origin = (window.location.origin && window.location.origin !== 'null') ? window.location.origin : '*';
    function post() {
      if (!st.iframe || !st.ready) return;
      try { st.iframe.contentWindow.postMessage({ type: 'vyanet-stage', stage: st.wantOn ? '3d' : 'off' }, origin); } catch (e) {}
    }
    function mount() {
      var q = new URLSearchParams();
      // Default: the bare parcel-clipped GLB (clean orbit, no rail panels). The
      // record-driven form (property=<hub>) adds camera pins + facts but
      // auto-opens the Property Facts panel, which hides the mesh in a mock.
      if (opts.byRecord || !(R.drone && R.drone.model)) q.set('property', R.hub); else q.set('model', R.drone.model);
      q.set('embed', '1'); q.set('gw', '0'); q.set('role', opts.role || 'customer');
      var f = el('iframe');
      f.title = '3D model'; f.allow = 'fullscreen';
      f.src = MODEL_VIEWER + '?' + q.toString();
      container.appendChild(f);
      st.iframe = f;
      window.addEventListener('message', function (e) {
        if (e.source !== f.contentWindow) return;
        if (e.data && e.data.type === 'vyanet-ready' && e.data.page === 'model-viewer') { st.ready = true; post(); }
      });
    }
    return {
      state: st,
      show: function () { st.wantOn = true; if (!st.iframe) mount(); else post(); },
      hide: function () { st.wantOn = false; post(); },
      mounted: function () { return !!st.iframe; }
    };
  }

  // ---------- obliques ----------
  function stillHTML(ob) {
    var items = String(ob.desc || '').split('|').map(function (s) { return s.trim(); }).filter(Boolean);
    return '<div class="img"><img src="' + esc(ob.url) + '" alt="" referrerpolicy="no-referrer"></div>' +
      '<div class="cap"><b>' + esc(ob.label) + ' · ' + esc(ob.side) + ' oblique · ' + ob.bearing + '° true</b>' +
      '<ul>' + items.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul></div>';
  }
  function thumbsHTML(R, active, withModel) {
    var D = R.drone; if (!D) return '';
    var html = '<button data-view="nadir"' + (active === 'nadir' ? ' class="on"' : '') + ' title="Nadir"><img src="' + esc(D.nadir.url) + '" alt="" referrerpolicy="no-referrer"><span>Nadir</span></button>';
    html += D.obliques.map(function (o) {
      return '<button data-view="' + o.id + '"' + (active === o.id ? ' class="on"' : '') + ' title="' + esc(o.label + ' · ' + o.side) + '"><img src="' + esc(o.url) + '" alt="" referrerpolicy="no-referrer"><span>' + esc(o.label) + '</span></button>';
    }).join('');
    if (withModel !== false) html += '<button data-view="3d" class="model' + (active === '3d' ? ' on' : '') + '" title="3D model">' + '<svg viewBox="0 0 24 24">' + ICON.cube + '</svg>3D</button>';
    return html;
  }

  // ---------- CHEKT feeds (simulated) ----------
  function tileHTML(p, small) {
    var nm = p.live ? p.live.name : p.name;
    var media = p.photo ? '<img src="' + esc(p.photo) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : '<div class="noimg">no still on file</div>';
    return '<div class="sp-tile" data-id="' + p.id + '" title="' + esc(p.name) + '">' + media +
      '<span class="name">' + esc(nm) + '</span>' +
      (p.live ? '<span class="st">LIVE</span>' : '<span class="st off">STILL</span>') +
      (p.live ? '<span class="scan"></span>' : '') +
      (small ? '' : '<span class="ts"><span data-sp-clock>' + clock() + '</span>' + (p.live ? ' · simulated' : '') + '</span>') +
      '</div>';
  }
  // opts: { layout:'grid2'|'strip'|'stack', all:false, small:false, onFocus(cam) }
  function renderFeeds(container, R, opts) {
    opts = opts || {};
    container.classList.add('sp-feeds', opts.layout || 'grid2');
    var cams = opts.all ? R.cams : R.live;
    container.innerHTML = cams.map(function (p) { return tileHTML(p, opts.small); }).join('');
    container.querySelectorAll('.sp-tile').forEach(function (t) {
      t.addEventListener('click', function () { if (opts.onFocus) opts.onFocus(R.byId[t.dataset.id]); });
    });
    return {
      setActive: function (id) { container.querySelectorAll('.sp-tile').forEach(function (t) { t.classList.toggle('on', t.dataset.id === id); }); }
    };
  }
  // The big player: a live feed, or a clip on one camera.
  function playerHTML(cam, clip) {
    var media = cam.photo ? '<img src="' + esc(cam.photo) + '" alt="" referrerpolicy="no-referrer">' : '<div class="noimg">no still on file</div>';
    var badge = clip ? '<span class="badge clip">CLIP · ' + clip.dur + ' s</span>' : '<span class="badge">LIVE · simulated</span>';
    var ts = clip ? '<span class="ts">' + esc(clip.t) + '</span>' : '<span class="ts"><span data-sp-clock>' + clock() + '</span></span>';
    var play = clip ? '<span class="play"><svg viewBox="0 0 24 24"><path d="M7 4l12 8-12 8z"/></svg></span>' : '<span class="scan"></span>';
    var sub = clip ? esc(clip.title) + ' · ' + esc(cam.live ? cam.live.name : cam.name)
      : (cam.live ? 'CHEKT · ' + esc(cam.live.name) + ' · device ' + esc(cam.live.device) + ' · site ' + esc(cam.live.site || '3525') : 'technician still · not yet associated');
    return '<div class="media">' + media + badge + play + ts + '</div>' +
      '<div class="row"><div class="ttl"><b>' + esc(cam.name) + '</b><span>' + sub + '</span></div>' +
      '<button class="sp-act sm live' + (clip ? '' : ' on') + '" data-act="live">' + (clip ? 'Back to live' : 'Live') + '</button>' +
      '<button class="sp-act sm" data-act="snap">Snapshot</button>' +
      '<button class="sp-act sm" data-act="map">On map</button></div>';
  }
  function clipsHTML(R, opts) {
    opts = opts || {};
    var list = R.clips.filter(function (c) { return (!opts.camId || c.cam === opts.camId) && (!opts.excludeCam || c.cam !== opts.excludeCam); });
    if (opts.limit) list = list.slice(0, opts.limit);
    if (!list.length) return '<div class="sp-note">No clips on this camera in the window.</div>';
    return list.map(function (c) {
      var cam = c.camera;
      var th = cam && cam.photo ? '<img src="' + esc(cam.photo) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : '';
      return '<div class="sp-clip" data-i="' + c.i + '" data-cam="' + esc(c.cam) + '"><div class="th">' + th + '<i></i></div>' +
        '<div class="t"><b><span class="kind ' + esc(c.kind) + '">' + esc(c.kind) + '</span>' + esc(c.title) + '</b><span>' + esc(cam && cam.live ? cam.live.name : (cam ? cam.name : c.cam)) + ' · ' + esc(c.t) + '</span></div>' +
        '<div class="d">' + c.dur + ' s</div></div>';
    }).join('');
  }

  // ---------- SAFE report content ----------
  function statusTag(st) {
    if (!st || st === 'n/a') return '<span class="sp-st na">no device</span>';
    return '<span class="sp-st ' + esc(st) + '">' + esc(st) + '</span>';
  }
  function placementTag(pl) {
    var txt = { surveyed: 'surveyed', estimated: 'estimated placement', mock: 'mock device' }[pl || 'surveyed'];
    return '<span class="sp-tag pl-' + (pl || 'surveyed') + '">' + txt + '</span>';
  }
  function pinRowHTML(p, opts) {
    opts = opts || {};
    var mt = p.kind === 'camera'
      ? (p.heading != null ? p.heading + '° · ' + (p.fov || 90) + '° fov · ' + (p.range || 25) + ' m' : 'camera') + (p.live ? ' · ' + p.live.name : '')
      : (p.vendor ? p.vendor + ' · ' : '') + p.kind + (p.placement && p.placement !== 'surveyed' ? ' · ' + p.placement : '');
    return '<div class="sp-pinrow ' + p.comp + ' pl-' + (p.placement || 'surveyed') + '" data-id="' + p.id + '">' +
      '<span class="num">' + p.n + '</span>' +
      '<div><div class="nm">' + esc(p.name) + '</div>' + (opts.meta === false ? '' : '<div class="mt">' + esc(mt) + '</div>') + '</div>' +
      (p.status ? statusTag(p.status) : '<span></span>') + '</div>';
  }
  // opts: { bullets:true, pins:true, limits:false, lede:true, head:false }
  function safeHTML(R, c, opts) {
    opts = opts || {};
    var r = R.fx.report[c];
    var pins = R.byComp[c];
    var html = '';
    if (opts.head) html += '<div class="sp-sec-head"><span class="sp-k ' + c + '">' + c + '</span><h3>' + esc(COMP[c].label) + '</h3></div>';
    html += '<div class="sp-status">' + esc(r.status) + '</div>';
    if (opts.lede !== false) html += '<div class="sp-lede">' + esc(r.summary) + '</div>';
    html += '<div class="sp-h ' + c + '">Should know</div><ul class="sp-bullets ' + c + '">' + sentences(r.considerations).map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>';
    html += '<div class="sp-h ' + c + '">Recommendations</div><ul class="sp-bullets ' + c + '">' + sentences(r.recommendations).map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>';
    if (opts.pins !== false) html += '<div class="sp-h ' + c + '">On the map · ' + pins.length + '</div><div class="sp-pinlist">' + pins.map(function (p) { return pinRowHTML(p); }).join('') + '</div>';
    if (opts.limits && R.fx.limits && R.fx.limits.length) html += limitsHTML(R);
    return html;
  }
  // A few measurements the record supports (haversine between surveyed /
  // estimated pins). Approximate by construction — the mock says so.
  function measures(R, c) {
    var out = [];
    function d(a, b) { var p = R.byId[a], q = R.byId[b]; return (p && q) ? haversine(p, q) : null; }
    function ft(m) { return Math.round(m) + ' m · ' + fmt(Math.round(m * 3.28084)) + ' ft'; }
    if (c === 'S') {
      out.push(R.cams.length + ' cameras · ' + R.live.length + ' live');
      var fovs = R.cams.map(function (p) { return p.fov || 90; });
      if (fovs.length) out.push('cones ' + Math.min.apply(null, fovs) + '–' + Math.max.apply(null, fovs) + '° · 25 m');
    }
    if (c === 'A') { var m = d('gate-road', 'entry-court'); if (m) out.push('road entry → court ≈ ' + ft(m)); var g = d('gate-road', 'garage-door'); if (g) out.push('entry → garage ≈ ' + ft(g)); }
    if (c === 'F') { (R.fx.zones || []).forEach(function (z) { out.push(z.name.split(' – ')[0] + ' r = ' + z.radius_m + ' m'); }); var h = R.byId['no-hydrant']; if (h) out.push('0 hydrants within 150 m'); }
    if (c === 'E') {
      (R.fx.routes || []).forEach(function (r) {
        var len = 0; for (var i = 1; i < r.points.length; i++) len += haversine(r.points[i - 1], r.points[i]);
        out.push(r.name + ' route ≈ ' + ft(len) + ' · ' + r.points.length + ' waypoints');
      });
      var s = d('gate-road', 'staging'); if (s) out.push('entry → staging ≈ ' + ft(s));
    }
    return out;
  }
  function measuresHTML(R, c) {
    return measures(R, c).map(function (m) { return '<span class="sp-chip">' + esc(m) + '</span>'; }).join('');
  }
  function limitsHTML(R) {
    return '<div class="sp-h">What this map cannot establish</div><ul class="sp-limits">' + (R.fx.limits || []).map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ul>';
  }
  function factsHTML(R, opts) {
    opts = opts || {};
    var fx = R.fx;
    var html = '<div class="sp-h">Tier</div><div class="sp-chips">' + fx.tier.map(function (t) { return '<span class="sp-chip">' + esc(t) + '</span>'; }).join('') + '</div>';
    html += '<div class="sp-h">Monitoring</div><div class="sp-note" style="border:0;padding:0;color:var(--text-soft)">Alarm: ' + esc(fx.monitoring.alarm) + ' · Cameras: ' + esc(fx.monitoring.cameras) + '<br>' + esc(fx.monitoring.note) + '</div>';
    html += '<div class="sp-h">Known facts</div><dl class="sp-facts">' + fx.facts.slice(0, opts.limit || fx.facts.length).map(function (f) { return '<dt>' + esc(f[0]) + '</dt><dd>' + esc(f[1]) + '</dd>'; }).join('') + '</dl>';
    if (R.drone) html += '<div class="sp-h">Drone tier</div><dl class="sp-facts"><dt>Capture</dt><dd>' + esc(R.drone.capture) + '</dd><dt>Flown</dt><dd>' + esc(R.drone.flown) + '</dd><dt>Products</dt><dd>Nadir · 4 obliques · parcel-clipped 3D model</dd></dl>';
    if (fx.links && fx.links.length) html += '<div class="sp-h">Open</div>' + fx.links.map(function (l) { return '<a class="sp-act sm" style="margin:0 6px 6px 0" href="' + esc(l.href) + '" target="_blank" rel="noopener">' + esc(l.label) + ' ↗</a>'; }).join('');
    return html;
  }
  function legendHTML(R, opts) {
    opts = opts || {};
    var html = ORDER.map(function (c) { return '<div><span class="sw" style="background:' + color(c) + '"></span>' + COMP[c].label + '</div>'; }).join('');
    html += '<div><span class="sw" style="background:#555"></span>surveyed &nbsp;<span class="sw dash"></span>estimated / mock</div>';
    html += '<div><span class="sw led"></span>live feed associated</div>';
    if (opts.lot !== false) html += '<div><span class="sw lot"></span>lot line (county parcel)</div>';
    return html;
  }
  // The pin detail card. opts: { showMap:true, live:true }
  function cardHTML(p, R, opts) {
    opts = opts || {};
    var media = '';
    if (p.photo) {
      media = '<div class="media"><img src="' + esc(p.photo) + '" alt="" referrerpolicy="no-referrer">' +
        (p.live ? '<span class="badge">LIVE · simulated</span><span class="ts"><span data-sp-clock>' + clock() + '</span></span>' : '<span class="ts">technician still</span>') + '</div>';
    }
    var meta = [];
    if (p.vendor) meta.push(['Vendor', p.vendor]);
    if (p.kind === 'camera') {
      meta.push(['Heading', p.heading != null ? p.heading + '° true' : '—']);
      meta.push(['Field of view', (p.fov || 90) + '° · ' + (p.range || 25) + ' m']);
      if (p.live) meta.push(['Live feed', p.live.name + ' · device ' + p.live.device]);
    }
    meta.push(['Position', p.lat.toFixed(6) + ', ' + p.lng.toFixed(6)]);
    var acts = [];
    if (p.kind === 'camera' && p.live && opts.live !== false) acts.push('<button class="sp-act live" data-act="live">Open live</button><button class="sp-act" data-act="clips">Clips</button>');
    if ((p.actions || []).indexOf('unlock') >= 0) acts.push('<button class="sp-act unlock" data-act="unlock">' + (/garage/i.test(p.name) ? 'Open' : 'Unlock') + '</button>');
    if (opts.showMap !== false) acts.push('<button class="sp-act" data-act="map">Show on map</button>');
    var near = R.pins.filter(function (q) { return q.id !== p.id; }).map(function (q) { return { p: q, d: haversine(p, q) }; }).sort(function (a, b) { return a.d - b.d; }).slice(0, 3);
    return media + '<div class="body">' +
      '<div class="top"><span class="sp-k ' + p.comp + '">' + p.comp + '</span><h3>' + p.n + '. ' + esc(p.name) + '</h3><button class="close" data-act="close" title="Close">×</button></div>' +
      '<div class="sp-tags">' + placementTag(p.placement) + statusTag(p.status) + '<span class="sp-tag">' + esc(COMP[p.comp].label) + ' · ' + esc(p.kind) + '</span></div>' +
      '<dl>' + meta.map(function (m) { return '<dt>' + esc(m[0]) + '</dt><dd>' + esc(m[1]) + '</dd>'; }).join('') + '</dl>' +
      '<div class="desc">' + esc(p.desc || '') + '</div>' +
      '<div class="acts">' + acts.join('') + '</div>' +
      '<div class="sp-h" style="margin-top:12px">Nearby</div>' + near.map(function (n) {
        return '<div class="sp-pinrow ' + n.p.comp + '" data-id="' + n.p.id + '" style="padding:3px 6px"><span class="num">' + n.p.n + '</span><div><div class="nm">' + esc(n.p.name) + '</div></div><span class="sp-mono" style="font-size:10px;color:var(--text3)">' + Math.round(n.d) + ' m</span></div>';
      }).join('') +
      '</div>';
  }

  // ---------- header bits ----------
  function brandHTML(tag) {
    return '<div class="sp-brand"><span class="mark">VYANET</span><span class="safe"><b>S</b><b>A</b><b>F</b><b>E</b></span>' + (tag ? '<span class="tag">' + esc(tag) + '</span>' : '') + '</div>';
  }
  function chipsHTML(R, opts) {
    opts = opts || {};
    var fx = R.fx;
    var html = '<span class="sp-chip strong">' + esc(fx.verticalLabel) + '</span>';
    html += '<span class="sp-chip">Alarm: ' + esc(fx.monitoring.alarm) + '</span>';
    html += '<span class="sp-chip live">CHEKT · ' + R.live.length + ' live</span>';
    if (R.drone) html += '<span class="sp-chip ok">Drone tier</span>';
    html += fx.status === 'draft' ? '<span class="sp-chip" style="color:var(--A)">DRAFT</span>' : '<span class="sp-chip">Reviewed</span>';
    if (opts.build !== false) html += '<span class="sp-chip" style="color:var(--text3)">' + esc(opts.build || BUILD) + '</span>';
    return html;
  }
  function switchHTML(current) {
    var q = '?p=' + encodeURIComponent(params.get('p') || 'residence');
    return '<span class="sp-switch"><span class="lab">Layout</span>' + [['a', 'A'], ['b', 'B'], ['c', 'C']].map(function (v) {
      return '<a href="layout-' + v[0] + '.html' + q + '"' + (current === v[0] ? ' class="on"' : '') + ' title="Layout ' + v[1] + '">' + v[1] + '</a>';
    }).join('') + '</span>';
  }

  window.SafePortal = {
    BUILD: BUILD, COMP: COMP, ORDER: ORDER, params: params,
    esc: esc, icon: icon, color: color, fmt: fmt, sentences: sentences, toast: toast, haversine: haversine,
    load: load,
    createMap: createMap, createNadir: createNadir, createModel: createModel,
    renderFeeds: renderFeeds, tileHTML: tileHTML, playerHTML: playerHTML, clipsHTML: clipsHTML,
    safeHTML: safeHTML, pinRowHTML: pinRowHTML, limitsHTML: limitsHTML, factsHTML: factsHTML, legendHTML: legendHTML, cardHTML: cardHTML,
    measures: measures, measuresHTML: measuresHTML,
    stillHTML: stillHTML, thumbsHTML: thumbsHTML,
    brandHTML: brandHTML, chipsHTML: chipsHTML, switchHTML: switchHTML
  };
})();
