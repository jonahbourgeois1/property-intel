/*
  safe-portal/mock-data.js — reads the portal mock-up package (Jones +
  Gartland) and turns each property into the record shape the SAFE portal
  engine already draws (portal-core.js SafePortal.load).  safe-portal 0.10.1

  Source: safe-portal/mock-data/<slug>/{safe.json, cameras.json, report.json}
          safe-portal/mock-data/catalog/{catalog.json, rules.json}
          built 2026-10-19 by tools/build_portal_mockup.py (see mock-data/README.md).
          LOCAL DRAFT, NOT DELIVERED. report.json is the only locked format.

  What this file does with the package:
    property     name, address, site_no, hubId (never computed), chekt_hub,
                 centre, imagery and georef → identity, facts, limits
    sections.L   status → the panel status line; items[] → the Items card;
                 map_features[] → the shapes layer (polygon / line / arrow /
                 ring / x / ruler) and the callout boxes; `buffer` features
                 are the house outline + radius, so the Zone 1 / Zone 2 rings
                 are drawn here as a buffer polygon (convex approximation)
    cameras.json existing survey pins → camera pins (GPS, true heading,
                 default FOV); the CHEKT roster → the live list (12, four
                 linked by name); recommended[] → dashed amber camera pins
                 and the Camera recommendations card (model picks, warnings,
                 spec snapshots); nvr_for_poe_picks → the N85 note
    report.json  lenses.L considerations / recommendations → SHOULD KNOW |
                 RECOMMENDATIONS (one bullet per line)
    catalog.json the camera lineup; images and spec sheets come from
                 safe-portal/cameras/{model}.jpg|pdf

  0.10.1 — fixture merge and community. When PROPERTIES.<slug>.fixtureSlug
  names a hand-built fixture (Jones → SAFE_FIXTURES.residence) the package is
  laid ON TOP of it: surveyed cameras keep the fixture photo / range / FOV,
  every non-camera fixture pin is kept (alarm devices, openings, detectors,
  pool, no-hydrant pin, hazards, Environment observations), and events, facts,
  monitoring, tier, roles and links come from the fixture with the package's
  facts / known issues / README appended. Fixture circle zones and the fixture
  approach route are dropped only where the package draws its own (F-zone
  buffers, line shapes). PROPERTIES.<slug>.hoa names the community record
  ('hoa' = Highlands for Jones, null for Gartland — its Community tab is left
  blank, never guessed from the address); the record carries hoaSlug / hoaName.

  Coordinates in the package are [lat, lng] (NOT GeoJSON order). Jones shapes
  are derived from image pixels (≈ ±1–3 m); its camera pins are technician GPS.
  Gartland shapes are authored in lat/lng. Colours for the kit's named styles
  (yellow, cyan, egress, trail, …) are chosen here; the package has no palette.

  Paths are relative to safe-portal/portal/*.html. Writes nothing.
*/
(function () {
  'use strict';

  var BASE = '../mock-data/';
  var CAMS = '../cameras/';

  // Static identity so the shell can paint the gate and chrome before the
  // JSON has loaded. Everything else comes from the files.
  var PROPERTIES = {
    jones: {
      slug: 'jones', name: 'Jones residence', address: '18775 MacAlpine Loop, Bend OR 97702',
      site_no: '14725', hub: 'd9f759d7351db3886c79dd689c41e3c0', chektHub: '6de88883bfd4a8349a901c54611ed9d7',
      cameras: true, label: 'Jones', owner: 'Tracy Jones', initials: 'TJ',
      // Jones is built ON TOP of the original fixture: its drone tier, alarm
      // and life-safety devices, openings, pool / hydrant pins, Nearmap
      // observations, events and mock clips stay; the package adds to them.
      fixtureSlug: 'residence', droneSlug: 'residence',
      // Jones sits in Highlands at Broken Top (fixture slug 'hoa').
      hoa: 'hoa', hoaName: 'Highlands at Broken Top'
    },
    gartland: {
      slug: 'gartland', name: 'Gartland residence', address: '3255 NW Celilo Ln, Bend OR 97703',
      site_no: '35801', hub: null, chektHub: null, cameras: false, label: 'Gartland', owner: 'Brian & Ashli Gartland', initials: 'BG',
      fixtureSlug: null, droneSlug: null,
      // Not in the Highlands; no community on record. The Community tab stays blank.
      hoa: null, hoaName: null
    }
  };
  var ALIAS = { residence: 'jones', jones: 'jones', gartland: 'gartland' };
  function slugFor(p) { return ALIAS[String(p || '').trim().toLowerCase()] || null; }

  // Known issues from mock-data/README.md, per property. Shown unchanged in
  // "What this map cannot establish" so the mock does not read as settled.
  var KNOWN_ISSUES = {
    jones: [
      'Pool: the DJI 3D model (7/21/2026) shows a lap pool on the E/NE side, beside the pergola patio. The Fire items, the F panel and the one-pager still say "no pool" and are not corrected here (README issue 1).',
      'Roof: the 2026 DJI model shows a dark rectangular panel on the main roof (solar or a skylight). The Environment roof line and the F roof callout are from 2024 imagery (README issue 2).',
      'R2 is the old NW track / open-land spot; the one-pager\u2019s R2 is a different spot. S rec item 4 still says "the 10 online-but-unassociated cameras" (README issue 3).',
      'Camera counts do not reconcile: 12 CHEKT roster cameras, 14 technician survey pins, 4 linked by name. Both lists are kept as-is; nothing is merged or dropped (README issue 4).',
      'Shapes and the recommended positions were authored as pixels on the close capture and converted (\u2248 \u00b11\u20133 m). Camera pins are technician GPS.',
      'The SAFE hub id d9f759d7\u2026 comes from the training notes, not from a delivery; no safe-dest response has confirmed it.'
    ],
    gartland: [
      'R4\u2019s cone points across the road (heading 20\u00b0), at the collector rather than the property-side frontage. Re-aiming needs approval; the spot is unchanged (README issue 5).',
      'Spot count: the panels and report.json have five recommended spots (R1\u2013R5); the marketing one-pager shows four and leaves R5 to a footnote (README issue 6).',
      'The subdivision was still being built in the 6/22/2024 imagery: the E/NE tract and the W/SW construction items may be out of date (README issue 10).',
      'No SAFE hub id is recorded for this property.'
    ],
    shared: [
      'All site observations come from Google Earth imagery dated 6/22/2024.',
      'No taxlot or parcel outline was retrieved for the package; parcel-edge claims are imagery-based. The lot line on this map is the county parcel layer, drawn by the portal.',
      'Confidence bands are a self-assessment, not measured accuracy. Camera recommendations and model picks are not rated.',
      'Camera power is unknown at every recommended spot; prices are blank for every model; the V5P sheet publishes Detect DORI only.',
      'Camera rankings are provisional: E1 leads most outdoor goals by 0.1\u20130.3 m of DORI and is not PoE; a tie-breaker (PoE preference, price, mount) is pending.'
    ]
  };

  // Named colours for the kit's panel styles.
  var PALETTE = {
    yellow: '#facc15', cyan: '#22d3ee', orange: '#fb923c', white: '#ffffff', 'hazard-red': '#ef4444',
    egress: '#4ade80', trail: '#d6b26a', surface: '#cbd5e1', roof: '#f472b6', storage: '#a78bfa',
    landscape: '#4ade80', 'e-hazard': '#ef4444', red: '#ef4444', green: '#22c55e', blue: '#3b82f6'
  };
  var AMBER = '#f59e0b';

  function col(v, fallback) {
    if (Array.isArray(v)) {
      var a = v.length > 3 ? v[3] / 255 : 1;
      return 'rgba(' + v[0] + ',' + v[1] + ',' + v[2] + ',' + a.toFixed(3) + ')';
    }
    if (typeof v === 'string') return PALETTE[v] || v;
    return fallback;
  }
  function solid(v, fallback) {
    // the same colour without alpha (for outlines when only a fill is given)
    if (Array.isArray(v)) return 'rgb(' + v[0] + ',' + v[1] + ',' + v[2] + ')';
    return col(v, fallback);
  }
  function dash(st) {
    if (!st) return null;
    if (st.dash && st.dash.length === 2) return st.dash[0] + ' ' + st.dash[1];
    if (st.dashed) return '8 6';
    if (st.dotted) return '2 4';
    return null;
  }
  function ll(c) { return { lat: c[0], lng: c[1] }; }
  function ring(geom) {
    if (!geom || !geom.coordinates_latlng) return [];
    var c = geom.coordinates_latlng;
    if (geom.type === 'Point') return [ll(c)];
    return c.map(ll);
  }
  function first(geom) { var r = ring(geom); return r.length ? r[0] : null; }

  // ---------- buffer: house outline + radius → one polygon ----------
  // Local metre frame around the outline centroid; sample a circle around
  // every vertex and every edge point; take the convex hull. Exact for a
  // convex outline, slightly generous in a notch — fine for a 9 m / 30 m ring.
  function bufferRing(points, r) {
    if (!points.length) return [];
    var lat0 = 0, lng0 = 0;
    points.forEach(function (p) { lat0 += p.lat; lng0 += p.lng; });
    lat0 /= points.length; lng0 /= points.length;
    var kx = 111320 * Math.cos(lat0 * Math.PI / 180), ky = 111132;
    var loc = points.map(function (p) { return { x: (p.lng - lng0) * kx, y: (p.lat - lat0) * ky }; });
    var samples = [];
    function around(x, y) { for (var k = 0; k < 24; k++) { var a = k / 24 * Math.PI * 2; samples.push({ x: x + r * Math.cos(a), y: y + r * Math.sin(a) }); } }
    for (var i = 0; i < loc.length; i++) {
      var a = loc[i], b = loc[(i + 1) % loc.length];
      around(a.x, a.y);
      var d = Math.hypot(b.x - a.x, b.y - a.y), n = Math.max(1, Math.ceil(d / 3));
      for (var s = 1; s < n; s++) around(a.x + (b.x - a.x) * s / n, a.y + (b.y - a.y) * s / n);
    }
    var hull = convexHull(samples);
    return hull.map(function (q) { return { lat: lat0 + q.y / ky, lng: lng0 + q.x / kx }; });
  }
  function convexHull(pts) {
    pts = pts.slice().sort(function (a, b) { return a.x - b.x || a.y - b.y; });
    if (pts.length < 3) return pts;
    function cross(o, a, b) { return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x); }
    var lower = [], upper = [];
    pts.forEach(function (p) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop(); lower.push(p); });
    for (var i = pts.length - 1; i >= 0; i--) { var p = pts[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop(); upper.push(p); }
    lower.pop(); upper.pop();
    return lower.concat(upper);
  }

  // ---------- fetch + cache ----------
  var cache = {}, pending = {}, catalogPromise = null;
  function getJSON(url) {
    return fetch(url, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error(url + ' \u2192 ' + r.status);
      return r.json();
    });
  }
  function catalog() {
    if (!catalogPromise) {
      catalogPromise = Promise.all([getJSON(BASE + 'catalog/catalog.json'), getJSON(BASE + 'catalog/rules.json').catch(function () { return null; })])
        .then(function (parts) {
          var cat = parts[0];
          cat.byModel = {};
          (cat.models || []).forEach(function (m) { cat.byModel[m.model] = m; m.img = CAMS + m.model + '.jpg'; m.pdf = CAMS + m.model + '.pdf'; });
          cat.rules = parts[1];
          return cat;
        });
    }
    return catalogPromise;
  }
  function peek(slug) { return cache[slug] || null; }
  function load(slug) {
    slug = slugFor(slug) || slug;
    if (cache[slug]) return Promise.resolve(cache[slug]);
    if (pending[slug]) return pending[slug];
    var dir = BASE + slug + '/';
    pending[slug] = Promise.all([getJSON(dir + 'safe.json'), getJSON(dir + 'cameras.json'), getJSON(dir + 'report.json'), catalog()])
      .then(function (parts) {
        var fx = toFixture(slug, parts[0], parts[1], parts[2], parts[3]);
        cache[slug] = fx;
        delete pending[slug];
        return fx;
      }, function (err) { delete pending[slug]; throw err; });
    return pending[slug];
  }

  // ---------- callout text: "1  TITLE: rest\nmore" → {title, text} ----------
  function splitCallout(text) {
    var lines = String(text || '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    if (!lines.length) return { title: '', text: '' };
    var head = lines[0].replace(/^\d+\s+/, '');
    var rest = lines.slice(1).join(' ').replace(/^\s*\d+\s+/, '');
    var m = head.match(/^([^:]{3,60}):\s*(.*)$/);
    if (m) { return { title: m[1].trim(), text: (m[2] + ' ' + rest).trim() }; }
    if (head.length <= 48) return { title: head.replace(/[.;,]+$/, ''), text: rest };
    return { title: head.split(/[.;]\s/)[0].slice(0, 60), text: (head + ' ' + rest).trim() };
  }

  // ---------- the adapter ----------
  function toFixture(slug, safe, cams, report, cat) {
    var P = PROPERTIES[slug] || {};
    var base = (P.fixtureSlug && window.SAFE_FIXTURES) ? window.SAFE_FIXTURES[P.fixtureSlug] : null;
    var basePins = {};
    (base && base.pins || []).forEach(function (p) { basePins[p.id] = p; });
    var prop = safe.property || {};
    var sections = safe.sections || {};
    var center = prop.center ? { lat: prop.center.lat, lng: prop.center.lng } : (base && base.center) || { lat: 0, lng: 0 };
    var pins = [], shapes = [], callouts = { S: [], A: [], F: [], E: [] }, zoneLabels = [], items = {};
    var stillUrl = function (still) { return still ? BASE + slug + '/' + String(still).replace(/^images\//, '') : null; };

    // -- cameras: survey pins (GPS) + roster + recommended spots. When the
    //    fixture has the same pin, keep its technician still and cone length.
    var ex = cams.existing || {};
    var roster = ex.chekt_roster || [];
    var byPin = {};
    roster.forEach(function (r) { if (r.survey_pin_id) byPin[r.survey_pin_id] = r; });
    (ex.survey_pins || []).forEach(function (s) {
      var r = byPin[s.id] || null, b = basePins[s.id] || null;
      pins.push({
        id: s.id, comp: 'S', kind: 'camera', name: s.label, lat: s.lat, lng: s.lng,
        heading: s.heading_deg, fov: s.fov_deg || (b && b.fov) || 90, range: (b && b.range) || s.cone_drawn_m || 12,
        photo: (b && b.photo) || stillUrl(s.still || (r && r.still)), vendor: r ? 'CHEKT' : (b && b.vendor) || 'Technician survey', placement: 'surveyed',
        status: r ? 'live' : 'online',
        live: r ? { name: r.chekt_name, device: String(r.device_id), site: String(r.chekt_site || '') } : null,
        desc: (s.coord_source || 'GPS') + ' \u00b7 ' + (s.heading_type || 'heading') + ' ' + s.heading_deg + '\u00b0 \u00b7 FOV ' + (s.fov_deg || 90) + '\u00b0 (' + (s.fov_note || 'default') + ') \u00b7 cone drawn ' + ((b && b.range) || s.cone_drawn_m || 12) + ' m, not a range. ' +
          (r ? 'Linked by name to CHEKT roster camera "' + r.chekt_name + '" (device ' + r.device_id + ').' : 'Not linked to a CHEKT roster camera by name; the technician reports it working.')
      });
    });
    // Everything else the fixture placed (alarm devices, openings, detectors,
    // pool, hydrant, Nearmap observations) stays on the map as before.
    (base && base.pins || []).forEach(function (p) {
      if (p.kind === 'camera' || p.kind === 'lot') return;
      if (pins.some(function (q) { return q.id === p.id; })) return;
      pins.push(Object.assign({}, p));   // copy: load() numbers pins in place
    });
    var recs = cams.recommended || [];
    recs.forEach(function (r) {
      pins.push({
        id: r.id, comp: 'S', kind: 'camera', name: r.id + ' \u00b7 ' + r.label, lat: r.lat, lng: r.lng,
        heading: r.heading_deg, fov: r.fov_deg || 90, range: r.cone_drawn_m || 12,
        vendor: 'Vyanet (proposed)', placement: 'recommended', status: null, rec: r,
        desc: r.status + '. ' + (r.models && r.models.why || '')
      });
    });

    // -- sections: shapes, callouts, hydrant pins, items
    ['S', 'A', 'F', 'E'].forEach(function (L) {
      var sec = sections[L] || {};
      items[L] = (sec.items || []);
      (sec.map_features || []).forEach(function (f) {
        var st = f.style || {}, under = st.layer === 'under';
        var pts = ring(f.geometry);
        switch (f.kind) {
          case 'polygon':
          case 'rect_m':
            if (pts.length < 3) return;
            shapes.push({ id: f.id, comp: L, kind: 'polygon', points: pts, under: true,
              style: { fill: col(st.fill, 'rgba(255,255,255,0.12)'), stroke: col(st.outline, st.fill ? solid(st.fill) : '#ffffff'), width: st.width || 2, dash: dash(st) },
              label: f.what || null });
            break;
          case 'route':
          case 'line':
          case 'arrow':
            if (pts.length < 2) return;
            shapes.push({ id: f.id, comp: L, kind: 'line', points: pts, under: under,
              style: { stroke: col(st.color, '#ffffff'), width: Math.min(6, st.width || 3), dash: dash(st), casing: !!st.casing,
                arrow: (f.kind === 'arrow' || st.arrow === true) ? (st.arrow_from === 1 ? 'start' : 'end') : null } });
            break;
          case 'ruler':
            if (pts.length < 2) return;
            shapes.push({ id: f.id, comp: L, kind: 'line', points: pts, under: false, label: f.text || null,
              style: { stroke: '#ffffff', width: 1.5, dash: '3 3', arrow: null, ruler: true } });
            break;
          case 'circle':
          case 'ring':
            if (!pts.length) return;
            shapes.push({ id: f.id, comp: L, kind: 'ring', point: pts[0], r: Math.max(6, Math.round((st.r || 12) * 0.6)),
              style: { stroke: col(st.color, '#ffffff'), width: st.width || 2, dash: dash(st) } });
            break;
          case 'x':
            if (!pts.length) return;
            shapes.push({ id: f.id, comp: L, kind: 'x', point: pts[0], r: Math.max(6, Math.round((st.r || 12) * 0.7)),
              style: { stroke: col(st.color, '#ef4444'), width: st.width || 3 } });
            break;
          case 'buffer':
            if (pts.length < 3 || !f.radius_m) return;
            var zone = f.radius_m < 15 ? 1 : 2, zc = zone === 1 ? '#facc15' : '#fb923c';
            var label = 'Zone ' + zone + ' \u00b7 ' + (zone === 1 ? '30 ft' : '100 ft') + ' (' + f.radius_m + ' m)';
            shapes.push({ id: f.id, comp: L, kind: 'polygon', points: bufferRing(pts, f.radius_m), under: true, label: label,
              style: { fill: zone === 1 ? 'rgba(250,204,21,0.06)' : 'rgba(251,146,60,0.05)', stroke: zc, width: 1.5, dash: '6 5' } });
            zoneLabels.push(label);
            break;
          case 'hydrant':
            if (!pts.length) return;
            pins.push({ id: f.id, comp: 'F', kind: 'hydrant', name: 'Hydrant ' + String(f.text || f.id).replace(/^hyd:/, ''), lat: pts[0].lat, lng: pts[0].lng,
              placement: 'surveyed', vendor: 'City of Bend GIS', desc: (f.text || '') + (f.diameter_in ? ' \u00b7 ' + f.diameter_in + ' in' : '') + ' \u00b7 ' + (f.coord_source || 'GIS') });
            break;
          case 'callout':
            var sp = splitCallout(f.text);
            var anchor = f.geometry ? first(f.geometry) : null;
            callouts[L].push({ id: f.id, point: anchor, title: sp.title, text: sp.text, side: anchor ? null : (callouts[L].length % 2 ? 'left' : 'right'), alert: false });
            break;
          default:
            break; // hydrant_query, measurements: text only
        }
      });
    });

    // -- report text: one bullet per line (SafePortal.sentences splits on \n).
    //    The package report is the text; the fixture's lede (summary) is kept.
    var rep = {};
    ['S', 'A', 'F', 'E'].forEach(function (L) {
      var lens = (report.lenses || {})[L] || {};
      var sec = sections[L] || {};
      var br = (base && base.report && base.report[L]) || {};
      rep[L] = { status: sec.status || lens.status || br.status || '', summary: br.summary || '', considerations: lens.considerations || br.considerations || '', recommendations: lens.recommendations || br.recommendations || '' };
    });

    // -- fixture layers the package does not replace: zones only when the
    //    package drew no buffer for that lens, routes only when it drew no line.
    var baseZones = (base && base.zones || []).filter(function (z) { return !shapes.some(function (s) { return s.comp === z.comp && /^F-zone/.test(s.id || ''); }); });
    var baseRoutes = (base && base.routes || []).filter(function (r) { return !shapes.some(function (s) { return s.comp === r.comp && s.kind === 'line'; }); });

    // -- facts, limits, monitoring
    var im = safe.imagery || {}, gr = (safe.georef || {}).close_capture || {}, counts = safe.counts || {};
    var facts = [
      ['Site no', prop.site_no || '\u2014'],
      ['SAFE hub', prop.hubId || 'not recorded'],
      ['Imagery', (im.source || 'Google Earth') + ', ' + (im.date || '?') + ' (captured ' + (im.survey_date || '?') + ')'],
      ['Geometry', slug === 'jones' ? 'shapes from image pixels (\u00b11\u20133 m); camera pins GPS' : 'authored in lat/lng (GE survey clicks, GIS)'],
      ['Scale', gr.m_per_px ? gr.m_per_px + ' m/px (' + (gr.mpp_source || 'scale bar') + ')' : '\u2014'],
      ['Items', 'data ' + (counts.data || 0) + ' \u00b7 inferred ' + (counts.inferred || 0) + ' \u00b7 recommendation ' + (counts.recommendation || 0)],
      ['Template', prop.template || '\u2014'],
      ['Delivered', safe.delivered ? 'yes' : 'no \u2014 local draft (report.json id / images blank)']
    ];
    if (prop.chekt_hub) facts.splice(2, 0, ['CHEKT hub', prop.chekt_hub]);
    if (prop.jurisdiction) facts.push(['Jurisdiction', prop.jurisdiction]);
    // Fixture facts (taxlot, year built, fire district, …) come first; package
    // facts follow, skipping labels the fixture already has.
    if (base && base.facts) {
      var have = {}; base.facts.forEach(function (f) { have[f[0].toLowerCase()] = true; });
      facts = base.facts.concat(facts.filter(function (f) { return !have[f[0].toLowerCase()]; }));
    }
    var liveCount = roster.length;
    var monitoring = (base && base.monitoring) || (liveCount
      ? { alarm: 'not in this package', cameras: 'CHEKT \u00b7 ' + liveCount + ' on roster \u00b7 site ' + (roster[0].chekt_site || ''), note: 'Vyanet account \u00b7 ' + (ex.survey_pins || []).length + ' technician survey pins \u00b7 ' + roster.filter(function (r) { return r.linked; }).length + ' linked by name' }
      : { alarm: 'not in this package', cameras: 'none on record', note: 'Imagery-only read; no CHEKT cameras, pins or prior records' });
    var limits = (base && base.limits || []).concat(KNOWN_ISSUES[slug] || [], KNOWN_ISSUES.shared);

    var links = (base && base.links ? base.links.slice() : []);
    links.push({ label: 'Package README (field guide)', href: BASE + 'README.md' });

    var panels = {};
    ['S', 'A', 'F', 'E'].forEach(function (L) { panels[L] = BASE + slug + '/panels/' + L.toLowerCase() + '.jpg'; });

    return {
      id: prop.chekt_hub || prop.hubId || (base && base.id) || slug,
      slug: slug, vertical: 'residence', verticalLabel: 'Residence',
      name: prop.name || P.name, address: prop.address || P.address, center: center, zoom: (base && base.zoom) || (slug === 'gartland' ? 20 : 19),
      status: 'draft',
      tier: (base && base.tier) || (slug === 'jones' ? ['Base SAFE map', 'Device layer (CHEKT)', 'Drone tier (3D model)'] : ['Base SAFE map (imagery-only)']),
      monitoring: monitoring,
      roles: (base && base.roles) || [{ id: 'owner', label: 'Owner' }, { id: 'responder', label: 'Responder' }],
      links: links, facts: facts, pins: pins, zones: baseZones, routes: baseRoutes, shapes: shapes, zoneLabels: zoneLabels,
      report: rep, limits: limits, events: (base && base.events) || [],
      roster: roster.map(function (r) { return { name: r.chekt_name, device: String(r.device_id), site: String(r.chekt_site || ''), photo: stillUrl(r.still), status: r.status }; }),
      fixtureSlug: P.fixtureSlug || null, droneSlug: P.droneSlug || null,
      hoaSlug: P.hoa || null, hoaName: P.hoaName || null,
      mock: {
        slug: slug, property: prop, imagery: im, georef: safe.georef || null, credit: safe.credit || '', counts: counts,
        sections: sections, items: items, callouts: callouts, legend: { S: (sections.S || {}).legend, A: (sections.A || {}).legend, F: (sections.F || {}).legend, E: (sections.E || {}).legend },
        cameras: cams, recommended: recs, nvr: cams.nvr_for_poe_picks || [], notes: cams.notes || [],
        report: report, catalog: cat, panels: panels, readme: BASE + 'README.md', knownIssues: KNOWN_ISSUES[slug] || []
      }
    };
  }

  window.SafeMock = {
    BUILD: 'safe-portal 0.10.1', BASE: BASE, PROPERTIES: PROPERTIES,
    slugFor: slugFor, load: load, peek: peek, catalog: catalog, bufferRing: bufferRing,
    modelImage: function (id) { return CAMS + id + '.jpg'; },
    modelPdf: function (id) { return CAMS + id + '.pdf'; }
  };
})();
