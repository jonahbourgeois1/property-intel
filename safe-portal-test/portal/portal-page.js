/*
  safe-portal/portal/portal-page.js — renders ONE SAFE component page for the
  Zoho Creator portal mock.  safe-portal 0.5.0

  The portal is built around SAFE: one portal page per component. Each page is
  its own HTML file (security.html / access.html / fire.html / emergency.html)
  that calls SafePage.boot('S'|'A'|'F'|'E'). The page is laid out one of three
  ways (?layout=a|b|c) around the same centrepiece, the SAFE FIGURE — the panel
  from the reference deck:

      [ dark header: badge · COMPONENT · property, address · status ]
      [ annotated image: nadir / Google map / obliques / 3D with numbered pins,
        LIVE tags, cones, zone rings, routes, the staging box, and white
        callout boxes with leader lines ]
      [ dark two-column panel: SHOULD KNOW | RECOMMENDATIONS ]
      [ footer: date · source note ]

    a  figure + rail        figure left; module, pins and facts in a right rail
    b  briefing             figure full width, then module | pins, then facts
    c  dashboard cards      figure card (8 cols) + module card (4), then pins
                            table / limits / facts cards

  Modules: Security = CHEKT live feeds + clips · Access = openings with unlock
  + confirmation cameras · Fire = detectors, water, defensible space ·
  Emergency service = routes, positions, responder packet.

  Shared engine: ../portal-core.js (+ ../portal-core.css); styles here are in
  portal-page.css. Data: ../fixtures.js (?p=residence). ?theme=light (default,
  Zoho look) | dark. Writes nothing.
*/
(function () {
  'use strict';
  var SP = window.SafePortal;
  var P = SP.params;
  var esc = SP.esc;
  var BUILD = 'safe-portal 0.5.0';

  // ---------- callouts: the white boxes on the reference panels ----------
  // Authored per component for the reference property. `pins` anchors the box
  // to a pin (leader line + number); `route` anchors to a route midpoint; no
  // anchor = a free note placed on the given side. {len:route} and {d:a:b}
  // are filled from the record (metres + feet).
  var CALLOUTS = {
    residence: {
      S: [
        { pins: ['cam-11', 'cam-12'], title: 'Perimeter approach cameras', text: '11 north lawn edge · 12 west side path — not yet on live feeds; the alarm-event review views.' },
        { pins: ['cam-14'], title: 'Strongest coverage: frontage + rear decks', text: 'LIVE: 1 front door · 7 upper deck · 8 lower deck · 14 driveway (CHEKT site 3525).' },
        { pins: ['cam-04'], title: 'Side gate camera, south', text: 'Covers the pedestrian gate; cone 90°, 25 m.' },
        { pins: ['panel'], title: 'Alarm: 6 zones', text: 'Panel + 4 door contacts, great-room motion, living-room glass-break (mock placement).' },
        { title: 'Open perimeter; no fencing', text: 'Dense conifers limit sightlines around the house on all sides.', side: 'right' },
        { title: '8 roster cameras not yet pinned', text: 'Front courtyard, garage corner / exterior, HVAC enclosure, lower deck doubles, upper deck family + living room doors, side drone.', side: 'left' }
      ],
      A: [
        { pins: ['gate-road'], title: 'Only vehicle entry, off Macalpine Loop', text: 'Gate / barrier UNCONFIRMED (clarification #2). Proposed keypad gate: unlock + \u201cwho\u2019s there\u201d.' },
        { pins: ['priv-road'], title: 'Private drive \u2248 {d:gate-road:entry-court} to the court', text: 'Curved, narrow, limited forward visibility for large apparatus. Amber dashes = approach drive.' },
        { pins: ['loop'], title: 'Circular driveway / turnaround', text: 'Limited multi-point turn; not a rated loop (clarification #1).' },
        { pins: ['entry-court'], title: 'Primary entry \u2014 driveway court', text: 'Paved court at the building cluster; cars park in the court.' },
        { pins: ['garage-door'], title: 'Garage door, detached garage', text: 'Remote open / close (proposed); the DRIVEWAY cam confirms who is there. Separate entry unconfirmed (clarification #3).' },
        { pins: ['side-gate'], title: 'Side gate, south \u2014 pedestrian', text: 'No hardware on file (seen in technician still cam-04).' },
        { title: 'No secondary access', text: 'No access from any other side of the parcel.', side: 'right' }
      ],
      F: [
        { pins: ['dsg-sw'], title: 'SW + SE: fuels against the structure', text: 'Shrubs and tree fuels press against the house; no cleared buffer like the north lawns.' },
        { pins: ['open-perim'], title: 'Open perimeter W / N', text: 'Unmanaged fuels, no fencing \u2014 surface and crown fire can run to the structure.' },
        { pins: ['drive-veg'], title: 'Single access drive through dense vegetation', text: 'No second egress.' },
        { pins: ['pool-water'], title: 'Pool: supplemental water / tanker fill', text: 'Access from the drive is indirect, partly under canopy.' },
        { pins: ['no-hydrant'], title: '0 hydrants within 150 m', text: 'Plan a tanker shuttle or pool draft; confirm the nearest hydrant with Bend Fire.' },
        { pins: ['smoke-base'], title: 'Basement smoke: LOW BATTERY', text: 'Trouble reported 2 days ago.', alert: true },
        { title: 'Dashed rings = Zone 1 (30 ft) \u00b7 Zone 2 (100 ft)', text: 'Ember-resistant zone and defensible space, drawn from the structure centre.', side: 'left' },
        { title: 'Roof: 2 chimneys + solar array', text: 'Ember-intrusion points: spark arrestors, soffits and mounting gaps.', side: 'right' }
      ],
      E: [
        { route: 'pool-route', title: 'INCIDENT ROUTE \u2248 {len:pool-route}', text: 'Entrance \u2192 court \u2192 west side path \u2192 north lawn \u2192 NE pool area; 6 waypoints.' },
        { pins: ['staging'], title: 'EMS + COMMAND: paved apron, south side', text: 'Purple box = staging, clear of the egress corridor.' },
        { pins: ['dead-end'], title: 'Dead end, single access', text: 'Forward-in / reverse-out, or multi-point turn in the court.' },
        { pins: ['pendant'], title: 'Panic / medical pendant \u2014 master suite', text: 'Two-way voice to Vyanet central station.' },
        { pins: ['lz-none'], title: 'No helicopter LZ on parcel', text: 'Dense canopy; open ground west is unrated. Designate the nearest LZ with the agency.' },
        { pins: ['tennis'], title: 'Tennis court: hard surface, not staging', text: 'Can impede apparatus if units position there.' },
        { title: 'Hold the driveway entrance', text: 'One engine stages at the entrance to keep the egress corridor open.', side: 'left' },
        { title: 'On arrival: defensive perimeter', text: 'Assess NORTH and WEST flanks first.', side: 'right' }
      ]
    }
  };
  // Extra overlays per component for the reference property (page-local; the
  // fixture itself is not edited).
  function extrasFor(R, comp) {
    if (R.slug !== 'residence') return;
    if (comp === 'A') {
      var pool = (R.fx.routes || []).filter(function (r) { return r.id === 'pool-route'; })[0];
      if (pool && !(R.fx.routes || []).some(function (r) { return r.id === 'approach'; })) {
        R.fx.routes.push({ id: 'approach', comp: 'A', name: 'Approach drive', trigger: 'Vehicle approach from Macalpine Loop', start: 'Road entry', target: 'Court', points: pool.points.slice(0, 3), estimated: true, numbered: false });
      }
    }
    if (comp === 'E') {
      var s = R.byId.staging;
      if (s) R.fx.areas = [{ comp: 'E', lat: s.lat, lng: s.lng, w_m: 16, h_m: 11, color: '#a855f7', label: 'EMS / COMMAND' }];
    }
  }
  function ft(m) { return Math.round(m) + ' m (' + SP.fmt(Math.round(m * 3.28084)) + ' ft)'; }
  function fill(ctx, s) {
    var R = ctx.R;
    return String(s || '').replace(/\{len:([\w-]+)\}/g, function (m, id) {
      var r = (R.fx.routes || []).filter(function (x) { return x.id === id; })[0]; if (!r) return '?';
      var len = 0; for (var i = 1; i < r.points.length; i++) len += SP.haversine(r.points[i - 1], r.points[i]);
      return ft(len);
    }).replace(/\{d:([\w-]+):([\w-]+)\}/g, function (m, a, b) {
      var p = R.byId[a], q = R.byId[b]; return (p && q) ? ft(SP.haversine(p, q)) : '?';
    });
  }
  function calloutsFor(ctx) {
    var list = (CALLOUTS[ctx.R.slug] || {})[ctx.comp];
    if (!list) list = ctx.pins.slice(0, 8).map(function (p) { return { pins: [p.id], title: p.name, text: firstSentence(p.desc) }; });
    return list.map(function (c) {
      var p = c.pins && ctx.R.byId[c.pins[0]];
      return { pins: c.pins || [], route: c.route || null, side: c.side || null, alert: !!c.alert, n: p ? p.n : null, title: fill(ctx, c.title), text: fill(ctx, c.text) };
    });
  }

  // ---------- boot ----------
  function boot(comp) {
    var layout = String(P.get('layout') || 'a').toLowerCase();
    if (['a', 'b', 'c'].indexOf(layout) < 0) layout = 'a';
    var theme = P.get('theme') === 'dark' ? 'dark' : 'light';
    document.documentElement.classList.add('theme-' + theme);
    var R = SP.load(P.get('p') || 'residence');
    extrasFor(R, comp);
    var ctx = {
      R: R, comp: comp, layout: layout, theme: theme,
      C: SP.COMP[comp], report: R.fx.report[comp], pins: R.byComp[comp], mod: MODULES[comp],
      state: { sel: null, sub: null, all: false, labels: false, lot: true, still: 'alpha', callouts: true }
    };
    ctx.callouts = calloutsFor(ctx);
    document.body.className = 'pg pg-' + layout + ' comp-' + comp;
    document.title = 'Vyanet SAFE \u2014 ' + ctx.C.label + ' \u00b7 ' + R.name + ' (mock)';
    LAYOUTS[layout](ctx);
    var modal = document.createElement('div');
    modal.className = 'pg-modal'; modal.id = 'pg-modal';
    modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
    document.body.appendChild(modal);
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (modal.classList.contains('on')) closeModal(); else if (ctx.state.sel) clearSel(ctx);
    });
    var pin = P.get('pin');
    if (pin && R.byId[pin]) setTimeout(function () { selectPin(ctx, pin, 'url'); }, 400);
    try { window.parent.postMessage({ type: 'safe-page', comp: comp, title: ctx.C.label, status: ctx.report.status, build: BUILD }, '*'); } catch (e) {}
    window.SAFE_PAGE = ctx;
  }

  // ---------- shared pieces ----------
  function onlyLayers(ctx) { var o = {}; SP.ORDER.forEach(function (c) { o[c] = ctx.state.all || c === ctx.comp; }); return o; }
  function firstSentence(t) { var s = SP.sentences(t); return s.length ? s[0] : ''; }
  function segHTML(ctx) {
    var d = !!ctx.R.drone, dis = d ? '' : ' disabled title="No drone capture on this record"';
    return '<div class="sp-seg seg"><button data-sub="nadir"' + dis + '>Drone nadir</button><button data-sub="map">2D map</button><button data-sub="still"' + dis + '>Obliques</button><button data-sub="3d"' + dis + '>3D model</button></div>';
  }
  function toolsHTML() {
    return '<button class="sp-tool on tool-co" title="Callout boxes on the image">Callouts</button><button class="sp-tool tool-all" title="Show the other SAFE layers, dimmed">All layers</button><button class="sp-tool tool-labels">Labels</button><button class="sp-tool on tool-lot">Lot</button><button class="sp-tool tool-fit">Fit</button>';
  }
  function bulletsHTML(ctx, key) {
    return '<ul>' + SP.sentences(ctx.report[key]).map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>';
  }
  function pinRowsHTML(ctx) { return ctx.pins.map(function (p) { return SP.pinRowHTML(p); }).join(''); }
  function pinTableHTML(ctx) {
    return '<table class="pg-table"><thead><tr><th></th><th>Pin</th><th>Kind</th><th>Status</th></tr></thead><tbody>' + ctx.pins.map(function (p) {
      var kind = p.kind + (p.placement && p.placement !== 'surveyed' ? ' \u00b7 ' + p.placement : '');
      var mt = p.kind === 'camera' ? (p.heading != null ? p.heading + '\u00b0 \u00b7 ' + (p.fov || 90) + '\u00b0 fov' : '') + (p.live ? ' \u00b7 ' + p.live.name : '') : (p.vendor || '');
      var dashed = p.placement && p.placement !== 'surveyed';
      return '<tr class="row ' + p.comp + '" data-id="' + p.id + '"><td class="num"><span class="n ' + p.comp + (dashed ? ' dash' : '') + '">' + p.n + '</span></td>' +
        '<td><div class="nm">' + esc(p.name) + '</div>' + (mt ? '<div class="mt">' + esc(mt) + '</div>' : '') + '</td><td class="sp-mono" style="font-size:11px;color:var(--text2)">' + esc(kind) + '</td><td>' + (p.status ? '<span class="sp-st ' + esc(p.status === 'n/a' ? 'na' : p.status) + '">' + esc(p.status === 'n/a' ? 'no device' : p.status) + '</span>' : '') + '</td></tr>';
    }).join('') + '</tbody></table>';
  }
  function wireRows(ctx, root) {
    root.querySelectorAll('.sp-pinrow[data-id], tr.row[data-id]').forEach(function (r) {
      r.addEventListener('click', function () { selectPin(ctx, r.dataset.id, 'list'); });
    });
    root.querySelectorAll('[data-act="map"][data-id]').forEach(function (b) {
      b.addEventListener('click', function (e) { e.stopPropagation(); showOnMap(ctx, b.dataset.id); });
    });
  }
  function markRows(ctx, id) {
    document.querySelectorAll('.sp-pinrow[data-id], tr.row[data-id], .fig-note[data-id]').forEach(function (r) {
      var on = !!id && r.dataset.id === id;
      r.classList.toggle('sel', on);
      if (on && r.scrollIntoView && !r.classList.contains('fig-note')) r.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
    document.querySelectorAll('.co-box[data-pin]').forEach(function (b) { b.classList.toggle('sel', !!id && b.dataset.pin === id); });
  }

  // ---------- the SAFE figure ----------
  function figureHTML(ctx) {
    var R = ctx.R, c = ctx.comp;
    var notes = ctx.callouts.map(function (co, i) {
      return '<div class="fig-note' + (co.alert ? ' alert' : '') + '" data-i="' + i + '"' + (co.pins[0] ? ' data-id="' + co.pins[0] + '"' : '') + '>' + (co.n ? '<span class="co-n ' + c + '">' + co.n + '</span>' : '<span class="co-n free"></span>') + '<div><b>' + esc(co.title) + '</b><span>' + esc(co.text) + '</span></div></div>';
    }).join('');
    return '<section class="fig comp-' + c + '">' +
      '<header class="fig-head"><span class="sp-k ' + c + '">' + c + '</span><div class="fig-ttl"><b>' + esc(ctx.C.label.toUpperCase()) + ' \u00b7 ' + esc(R.name) + ', ' + esc(R.address) + '</b><span>' + esc(ctx.report.status) + '</span></div>' +
        '<div class="fig-ctl">' + segHTML(ctx) + toolsHTML() + '</div><span class="fig-brand">Vyanet <i>S</i><i>A</i><i>F</i><i>E</i></span></header>' +
      '<div class="pg-stage"></div>' +
      '<div class="fig-notes"><div class="fig-notes-h">Callouts</div>' + notes + '</div>' +
      '<div class="fig-measures">' + SP.measuresHTML(R, c) + '</div>' +
      '<div class="fig-text"><div><h4>Should know</h4>' + bulletsHTML(ctx, 'considerations') + '</div><div><h4>Recommendations</h4>' + bulletsHTML(ctx, 'recommendations') + '</div></div>' +
      '<footer class="fig-foot"><span>' + new Date().toLocaleDateString() + ' \u00b7 Pins from the SAFE record (mock) \u00b7 measurements approximate</span><span>solid = surveyed \u00b7 dashed = estimated / mock \u00b7 LIVE = CHEKT feed (simulated) \u00b7 ' + BUILD + '</span></footer>' +
    '</section>';
  }
  function wireFigure(ctx, fig) {
    buildStage(ctx, fig.querySelector('.pg-stage'), { defaultSub: ctx.R.drone ? 'nadir' : 'map' });
    wireControls(ctx, fig);
    fig.querySelectorAll('.fig-note').forEach(function (n) {
      n.addEventListener('click', function () { if (n.dataset.id) selectPin(ctx, n.dataset.id, 'note'); });
    });
    ctx.fig = fig;
  }

  // ---------- callout layer: boxes at the image edges, leader lines to pins ----------
  function createCallouts(ctx, stage) {
    var layer = document.createElement('div'); layer.className = 'co-layer';
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('class', 'co-lines');
    var boxes = document.createElement('div'); boxes.className = 'co-boxes';
    layer.appendChild(svg); layer.appendChild(boxes); stage.el.appendChild(layer);
    var items = ctx.callouts, raf = 0, BOX_W = 214;
    boxes.innerHTML = items.map(function (c, i) {
      return '<div class="co-box' + (c.alert ? ' alert' : '') + '" data-i="' + i + '"' + (c.pins[0] ? ' data-pin="' + c.pins[0] + '"' : '') + '>' + (c.n ? '<span class="co-n ' + ctx.comp + '">' + c.n + '</span>' : '') + '<b>' + esc(c.title) + '</b>' + (c.text ? '<span>' + esc(c.text) + '</span>' : '') + '</div>';
    }).join('');
    var boxEls = Array.prototype.slice.call(boxes.children);
    boxEls.forEach(function (b, i) { b.addEventListener('click', function () { var c = items[i]; if (c.pins[0]) selectPin(ctx, c.pins[0], 'callout'); }); });

    function engine() { var s = ctx.state.sub; return s === 'map' ? stage.map : (s === 'nadir' ? stage.nadir : null); }
    function anchorPx(c) {
      var eng = engine(); if (!eng || !eng.containerPx) return null;
      if (c.route) {
        var r = (ctx.R.fx.routes || []).filter(function (x) { return x.id === c.route; })[0]; if (!r) return null;
        var pt = r.points[Math.floor(r.points.length / 2)]; return eng.containerPx(pt.lat, pt.lng);
      }
      if (c.pins.length) { var p = ctx.R.byId[c.pins[0]]; return p ? eng.containerPx(p.lat, p.lng) : null; }
      return null;
    }
    function layout() {
      raf = 0;
      var W = stage.el.clientWidth, H = stage.el.clientHeight, sub = ctx.state.sub;
      var show = ctx.state.callouts && (sub === 'map' || sub === 'nadir') && W >= 720 && H >= 360;
      layer.classList.toggle('on', show);
      if (ctx.fig) ctx.fig.classList.toggle('co-off', !show);
      if (!show) return;
      var pad = 12, gap = 8, sides = { left: [], right: [] }, lines = [];
      // keep the columns clear of the legend (bottom-left) and the open detail card (bottom-right)
      var legend = stage.el.querySelector('.legend'), card = stage.el.querySelector('.card');
      var floor = {
        left: H - pad - (legend && legend.offsetParent ? legend.offsetHeight + 10 : 0),
        right: H - pad - (card && card.classList.contains('on') ? card.offsetHeight + 10 : 0)
      };
      items.forEach(function (c, i) {
        var a = anchorPx(c), b = boxEls[i], side;
        if (a && (a.x < -30 || a.x > W + 30 || a.y < -30 || a.y > H + 30)) { b.style.display = 'none'; return; }
        if (a) side = a.x < W / 2 ? 'left' : 'right';
        else side = c.side || (sides.left.length <= sides.right.length ? 'left' : 'right');
        b.style.display = '';
        sides[side].push({ i: i, a: a, h: b.offsetHeight });
      });
      ['left', 'right'].forEach(function (side) {
        var list = sides[side];
        var frees = list.filter(function (it) { return !it.a; });
        frees.forEach(function (it, k) { it.ty = (k + 1) * H / (frees.length + 1); });
        list.forEach(function (it) { if (it.a) it.ty = it.a.y; it.top = it.ty - it.h / 2; });
        list.sort(function (p, q) { return p.ty - q.ty; });
        var y = pad;
        list.forEach(function (it) { if (it.top < y) it.top = y; y = it.top + it.h + gap; });
        var bottom = floor[side];
        for (var k = list.length - 1; k >= 0; k--) { var it = list[k]; if (it.top + it.h > bottom) it.top = bottom - it.h; bottom = it.top - gap; }
        var x = side === 'left' ? pad : W - pad - BOX_W;
        list.forEach(function (it) {
          var b = boxEls[it.i];
          it.top = Math.max(pad, it.top);
          b.style.left = x + 'px'; b.style.top = it.top + 'px';
          if (it.a) {
            var sx = side === 'left' ? x + BOX_W : x, sy = it.top + Math.min(it.h / 2, 16);
            var dx = it.a.x - sx, dy = it.a.y - sy, L = Math.sqrt(dx * dx + dy * dy) || 1, cut = 13;
            lines.push({ x1: sx, y1: sy, x2: it.a.x - dx / L * cut, y2: it.a.y - dy / L * cut });
          }
        });
      });
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.setAttribute('width', W); svg.setAttribute('height', H);
      svg.innerHTML = lines.map(function (l) {
        var a = 'x1="' + l.x1.toFixed(1) + '" y1="' + l.y1.toFixed(1) + '" x2="' + l.x2.toFixed(1) + '" y2="' + l.y2.toFixed(1) + '"';
        return '<line class="halo" ' + a + '/><line class="lead" ' + a + '/><circle class="tip" cx="' + l.x2.toFixed(1) + '" cy="' + l.y2.toFixed(1) + '" r="2.5"/>';
      }).join('');
    }
    function schedule() { if (!raf) raf = requestAnimationFrame(layout); }
    if (window.ResizeObserver) new ResizeObserver(schedule).observe(stage.el);
    return { schedule: schedule, layout: layout };
  }

  // ---------- stage: nadir · 2D map · obliques · 3D ----------
  function buildStage(ctx, el, opts) {
    opts = opts || {};
    var R = ctx.R, st = ctx.state;
    el.innerHTML = '<div class="sp-sub sub-map"></div><div class="sp-sub sub-nadir"></div>' +
      '<div class="sp-sub sub-still"><div class="sp-still"></div><div class="sp-thumbs"></div></div><div class="sp-sub sub-3d"></div>' +
      '<div class="sp-mapnote note"></div>' + (opts.legend === false ? '' : '<div class="sp-legend legend"></div>') + '<div class="sp-card card"></div>';
    var layers = onlyLayers(ctx);
    function onDraw() { if (ctx.co) ctx.co.schedule(); }
    var map = SP.createMap(el.querySelector('.sub-map'), R, {
      layers: layers, focus: ctx.comp, lot: true, zoom: 19, onDraw: onDraw,
      onSelect: function (p, meta) { if (p) selectPin(ctx, p.id, 'map'); else if (meta.source === 'map') clearSel(ctx); },
      onFail: function () { if (R.drone && st.sub === 'map') { setSub('nadir'); note('Google Maps is not available from this origin \u2014 showing the drone nadir instead.'); } }
    });
    var nadir = R.drone ? SP.createNadir(el.querySelector('.sub-nadir'), R, {
      layers: layers, focus: ctx.comp, labels: false, onDraw: onDraw,
      onSelect: function (p, meta) { if (p) selectPin(ctx, p.id, 'nadir'); else if (meta.source === 'nadir') clearSel(ctx); }
    }) : null;
    var model = R.drone ? SP.createModel(el.querySelector('.sub-3d'), R) : null;
    var legend = el.querySelector('.legend');
    if (legend) legend.innerHTML = SP.legendHTML(R);
    function note(msg) { var n = el.querySelector('.note'); n.textContent = msg; n.classList.add('on'); setTimeout(function () { n.classList.remove('on'); }, 6000); }
    function renderStill() {
      var ob = R.drone.obliques.filter(function (o) { return o.id === st.still; })[0] || R.drone.obliques[0];
      el.querySelector('.sub-still .sp-still').innerHTML = SP.stillHTML(ob);
      var th = el.querySelector('.sub-still .sp-thumbs');
      th.innerHTML = SP.thumbsHTML(R, st.still, true);
      th.querySelectorAll('button').forEach(function (b) {
        b.addEventListener('click', function () {
          var v = b.dataset.view;
          if (v === 'nadir' || v === '3d') { setSub(v); return; }
          st.still = v; renderStill();
        });
      });
    }
    function setSub(s) {
      if (s !== 'map' && !R.drone) return;
      var prev = st.sub; st.sub = s;
      el.querySelectorAll('.sp-sub').forEach(function (e) { e.classList.toggle('on', e.classList.contains('sub-' + s)); });
      document.querySelectorAll('.seg button').forEach(function (b) { b.classList.toggle('on', b.dataset.sub === s); });
      document.querySelectorAll('.tool-fit').forEach(function (b) { b.disabled = s !== 'map'; });
      if (legend) legend.style.display = (s === 'map' || s === 'nadir') ? '' : 'none';
      var card = el.querySelector('.card');
      if (s === 'still' || s === '3d') card.classList.remove('on'); else if (st.sel) renderCard(ctx, R.byId[st.sel]);
      if (s === '3d' && model) model.show(); else if (prev === '3d' && model) model.hide();
      if (s === 'still') renderStill();
      if (s === 'map') map.resize();
      if (s === 'nadir' && nadir) nadir.resize();
      onDraw();
    }
    function applyLayers() {
      var L = onlyLayers(ctx);
      map.setLayers(L); map.setFocus(st.all ? ctx.comp : null);
      if (nadir) { nadir.setLayers(L); nadir.setFocus(st.all ? ctx.comp : null); }
      document.querySelectorAll('.tool-all').forEach(function (b) { b.classList.toggle('on', st.all); });
    }
    ctx.stage = {
      el: el, map: map, nadir: nadir, model: model, setSub: setSub, applyLayers: applyLayers, note: note,
      setAll: function (b) { st.all = !!b; applyLayers(); },
      setLabels: function (v) { st.labels = v; if (nadir) nadir.setLabels(v); map.setLabels(v === true); document.querySelectorAll('.tool-labels').forEach(function (x) { x.classList.toggle('on', v === true); }); },
      setLot: function (b) { st.lot = !!b; map.setLot(b); if (nadir) nadir.setLot(b); document.querySelectorAll('.tool-lot').forEach(function (x) { x.classList.toggle('on', !!b); }); },
      setCallouts: function (b) { st.callouts = !!b; document.querySelectorAll('.tool-co').forEach(function (x) { x.classList.toggle('on', !!b); }); onDraw(); },
      fit: function () { if (st.sub === 'map') map.fit(); },
      showRoute: function (r) { if (st.sub !== 'map' && st.sub !== 'nadir') setSub(R.drone ? 'nadir' : 'map'); if (st.sub === 'map') map.fitPoints(r.points, 80); }
    };
    ctx.co = createCallouts(ctx, ctx.stage);
    setSub(opts.defaultSub && (R.drone || opts.defaultSub === 'map') ? opts.defaultSub : 'map');
    return ctx.stage;
  }
  function wireControls(ctx, root) {
    root.querySelectorAll('.seg button').forEach(function (b) { b.addEventListener('click', function () { ctx.stage.setSub(b.dataset.sub); }); });
    root.querySelectorAll('.tool-co').forEach(function (b) { b.addEventListener('click', function () { ctx.stage.setCallouts(!ctx.state.callouts); }); });
    root.querySelectorAll('.tool-all').forEach(function (b) { b.addEventListener('click', function () { ctx.stage.setAll(!ctx.state.all); }); });
    root.querySelectorAll('.tool-labels').forEach(function (b) { b.addEventListener('click', function () { ctx.stage.setLabels(ctx.state.labels === true ? false : true); }); });
    root.querySelectorAll('.tool-lot').forEach(function (b) { b.addEventListener('click', function () { ctx.stage.setLot(!ctx.state.lot); }); });
    root.querySelectorAll('.tool-fit').forEach(function (b) { b.addEventListener('click', function () { ctx.stage.fit(); }); });
  }

  // ---------- selection + card ----------
  function selectPin(ctx, id, source) {
    var R = ctx.R, st = ctx.state, S = ctx.stage, p = R.byId[id];
    if (!p || !S) return;
    st.sel = id;
    if (p.comp !== ctx.comp && !st.all) S.setAll(true);
    if (source !== 'map' && S.map.state.sel !== id) S.map.select(id, st.sub === 'map', 'sync');
    if (S.nadir && source !== 'nadir' && S.nadir.state.sel !== id) S.nadir.select(id, 'sync');
    if (st.sub === 'still' || st.sub === '3d') S.setSub(R.drone ? 'nadir' : 'map');
    renderCard(ctx, p);
    markRows(ctx, id);
  }
  function clearSel(ctx) {
    var S = ctx.stage;
    ctx.state.sel = null;
    if (S) { S.el.querySelector('.card').classList.remove('on'); S.map.clear('sync'); if (S.nadir) S.nadir.clear('sync'); }
    markRows(ctx, null);
    if (ctx.co) ctx.co.schedule();
  }
  function showOnMap(ctx, id) {
    var S = ctx.stage;
    if (!S) return;
    if (ctx.state.sub !== 'map' && ctx.state.sub !== 'nadir') S.setSub(ctx.R.drone ? 'nadir' : 'map');
    selectPin(ctx, id, 'module');
    if (ctx.state.sub === 'map') S.map.select(id, true, 'sync');
    if (ctx.layout !== 'a') S.el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  function renderCard(ctx, p) {
    var card = ctx.stage.el.querySelector('.card');
    card.innerHTML = SP.cardHTML(p, ctx.R, { showMap: ctx.state.sub !== 'map' });
    card.classList.add('on');
    card.querySelectorAll('[data-act]').forEach(function (b) {
      b.addEventListener('click', function () {
        var act = b.dataset.act;
        if (act === 'close') clearSel(ctx);
        else if (act === 'live') openCamera(ctx, p, null, 'live');
        else if (act === 'clips') openCamera(ctx, p, null, 'clips');
        else if (act === 'unlock') SP.toast('<b>Unlock sent</b> \u2014 ' + esc(p.name) + '. Relocks in 30 s. Logged to events. (mock)');
        else if (act === 'map') { ctx.stage.setSub('map'); ctx.stage.map.select(p.id, true, 'sync'); }
      });
    });
    card.querySelectorAll('.sp-pinrow[data-id]').forEach(function (r) { r.addEventListener('click', function () { selectPin(ctx, r.dataset.id, 'card'); }); });
    if (ctx.co) ctx.co.schedule();
  }

  // ---------- cameras: the Security module player, or a modal on the other pages ----------
  function openCamera(ctx, cam, clip, tab) {
    if (!cam) return;
    if (ctx.player) { ctx.player.focus(cam.id, clip || null, tab); return; }
    var m = document.getElementById('pg-modal');
    m.innerHTML = '<div class="box"><div class="top"><span class="sp-k S">S</span><b>' + esc(cam.live ? cam.live.name : cam.name) + '</b><button class="close" title="Close">\u00d7</button></div>' +
      '<div class="sp-player">' + SP.playerHTML(cam, clip || null) + '</div>' +
      '<div class="sp-h" style="margin-top:12px">Clips \u00b7 this camera</div><div class="sp-clips">' + SP.clipsHTML(ctx.R, { camId: cam.id }) + '</div>' +
      '<div class="sp-note" style="margin-top:10px">Production: the gateway opens this camera\u2019s 60-minute MJPEG URL; clips are 1-hour signed links. Live cameras are managed on the Security page.</div></div>';
    m.classList.add('on');
    m.querySelector('.close').addEventListener('click', closeModal);
    m.querySelectorAll('.sp-player [data-act]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.dataset.act === 'live') openCamera(ctx, cam, null);
        else if (b.dataset.act === 'snap') SP.toast('Snapshot saved (mock).');
        else if (b.dataset.act === 'map') { closeModal(); showOnMap(ctx, cam.id); }
      });
    });
    m.querySelectorAll('.sp-clip').forEach(function (r) { r.addEventListener('click', function () { openCamera(ctx, cam, ctx.R.clips[Number(r.dataset.i)]); }); });
  }
  function closeModal() { var m = document.getElementById('pg-modal'); if (m) { m.classList.remove('on'); m.innerHTML = ''; } }

  // ---------- modules ----------
  var MODULES = {
    S: {
      title: 'Live cameras \u00b7 CHEKT',
      sub: function (ctx) { return ctx.R.live.length + ' live \u00b7 ' + ctx.R.cams.length + ' surveyed \u00b7 site ' + ((ctx.R.live[0] && ctx.R.live[0].live.site) || '3525'); },
      html: function () {
        return '<div class="mod-player sp-player"></div><div class="mod-feeds compact"></div>' +
          '<div class="mod-clips"><div class="sp-h">Clips \u00b7 <span class="clips-title">last 7 days</span><button class="sp-tool sm clips-all" hidden style="margin-left:auto">All cameras</button></div><div class="sp-clips"></div></div>';
      },
      wire: function (ctx, el, opts) {
        var R = ctx.R, playerEl = el.querySelector('.mod-player'), clipsEl = el.querySelector('.sp-clips');
        var st = { cam: null, clip: null, clipCam: null };
        var feeds = SP.renderFeeds(el.querySelector('.mod-feeds'), R, { layout: opts.feedsLayout || 'grid2', small: true, onFocus: function (cam) { focus(cam.id, null); filter(cam.id); } });
        function focus(id, clip, tab) {
          var cam = R.byId[id]; if (!cam) return;
          st.cam = id; st.clip = clip;
          feeds.setActive(id);
          playerEl.classList.add('on');
          playerEl.innerHTML = SP.playerHTML(cam, clip);
          playerEl.querySelectorAll('[data-act]').forEach(function (b) {
            b.addEventListener('click', function () {
              if (b.dataset.act === 'live') focus(id, null);
              else if (b.dataset.act === 'snap') SP.toast('Snapshot saved (mock) \u2014 production: gateway snapshot JPEG for ' + esc(cam.live ? cam.live.name : cam.name) + '.');
              else if (b.dataset.act === 'map') showOnMap(ctx, id);
            });
          });
          if (tab === 'clips') filter(id);
          clipsEl.querySelectorAll('.sp-clip').forEach(function (r) { r.classList.toggle('on', !!clip && Number(r.dataset.i) === clip.i); });
          if (ctx.layout !== 'a') playerEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
        function renderClips() {
          clipsEl.innerHTML = SP.clipsHTML(R, { camId: st.clipCam });
          clipsEl.querySelectorAll('.sp-clip').forEach(function (r) { r.addEventListener('click', function () { var c = R.clips[Number(r.dataset.i)]; focus(c.cam, c); }); });
          var cam = st.clipCam ? R.byId[st.clipCam] : null;
          el.querySelector('.clips-title').textContent = cam ? (cam.live ? cam.live.name : cam.name) : 'last 7 days';
          el.querySelector('.clips-all').hidden = !st.clipCam;
        }
        function filter(camId) { st.clipCam = camId; renderClips(); }
        el.querySelector('.clips-all').addEventListener('click', function () { filter(null); });
        renderClips();
        ctx.player = { focus: focus, filter: filter };
      }
    },
    A: {
      title: 'Openings & confirmation',
      sub: function (ctx) { return ctx.pins.filter(function (p) { return (p.actions || []).indexOf('unlock') >= 0; }).length + ' remote-operable (proposed)'; },
      html: function (ctx) {
        var R = ctx.R;
        var openings = ctx.pins.filter(function (p) { return p.kind === 'gate' || p.kind === 'door'; });
        var others = ctx.pins.filter(function (p) { return p.kind !== 'gate' && p.kind !== 'door'; });
        var cams = {};
        openings.forEach(function (p) { if (p.near && R.byId[p.near]) cams[p.near] = R.byId[p.near]; });
        var html = '<div class="sp-h A">Openings</div>' + openings.map(function (p) {
          var unlock = (p.actions || []).indexOf('unlock') >= 0;
          var near = p.near && R.byId[p.near];
          return '<div class="mod-row" data-id="' + p.id + '"><div><div class="nm"><span class="n A' + (p.placement !== 'surveyed' ? ' dash' : '') + '">' + p.n + '</span>' + esc(p.name) + ' ' + (p.status && p.status !== 'n/a' ? '<span class="sp-st ' + esc(p.status) + '">' + esc(p.status) + '</span>' : '<span class="sp-st na">no hardware</span>') + '</div>' +
            '<div class="mt">' + esc(p.vendor || 'Owner') + (unlock ? ' \u00b7 remote ' + (/garage/i.test(p.name) ? 'open / close' : 'unlock') + ' through the panel' : '') + (near ? ' \u00b7 confirmation camera: ' + esc(near.live ? near.live.name : near.name) : '') + '</div></div>' +
            '<div class="acts">' + (unlock ? '<button class="sp-act sm unlock" data-act="unlock" data-id="' + p.id + '">' + (/garage/i.test(p.name) ? 'Open' : 'Unlock') + '</button>' : '') + (near ? '<button class="sp-act sm" data-act="who" data-id="' + p.id + '">Who\u2019s there?</button>' : '') + '<button class="sp-act sm" data-act="map" data-id="' + p.id + '">Map</button></div></div>';
        }).join('');
        var camList = Object.keys(cams).map(function (k) { return cams[k]; });
        if (camList.length) html += '<div class="sp-h A">Confirmation cameras</div><div class="mod-conf">' + camList.map(function (c) { return SP.tileHTML(c, true); }).join('') + '</div>';
        if (others.length) html += '<div class="sp-h A">Approach</div>' + others.map(function (p) {
          return '<div class="mod-row" data-id="' + p.id + '"><div><div class="nm"><span class="n A' + (p.placement !== 'surveyed' ? ' dash' : '') + '">' + p.n + '</span>' + esc(p.name) + '</div><div class="mt">' + esc(firstSentence(p.desc)) + '</div></div><div class="acts"><button class="sp-act sm" data-act="map" data-id="' + p.id + '">Map</button></div></div>';
        }).join('');
        return html;
      },
      wire: function (ctx, el) {
        var R = ctx.R;
        el.querySelectorAll('[data-act="unlock"]').forEach(function (b) {
          b.addEventListener('click', function () {
            var p = R.byId[b.dataset.id], row = b.closest('.mod-row');
            var old = row.querySelector('.mod-confirm'); if (old) { old.remove(); return; }
            var c = document.createElement('div'); c.className = 'mod-confirm';
            var near = p.near && R.byId[p.near];
            c.innerHTML = 'Send <b>' + esc(p.name) + '</b> an ' + (/garage/i.test(p.name) ? 'open' : 'unlock') + '? It relocks after 30 s. The event is logged with your name and the ' + (near ? esc(near.live ? near.live.name : near.name) : 'nearest') + ' camera clip.' +
              '<div class="acts"><button class="sp-act sm unlock go">Yes, ' + (/garage/i.test(p.name) ? 'open' : 'unlock') + '</button><button class="sp-act sm cancel">Cancel</button></div>';
            row.appendChild(c);
            c.querySelector('.cancel').addEventListener('click', function () { c.remove(); });
            c.querySelector('.go').addEventListener('click', function () {
              c.remove();
              SP.toast('<b>' + (/garage/i.test(p.name) ? 'Open' : 'Unlock') + ' sent</b> \u2014 ' + esc(p.name) + '. Relocks in 30 s. Logged to events. (mock)');
              if (near) setTimeout(function () { openCamera(ctx, near, null); }, 500);
            });
          });
        });
        el.querySelectorAll('[data-act="who"]').forEach(function (b) {
          b.addEventListener('click', function () { var p = R.byId[b.dataset.id]; if (p && p.near && R.byId[p.near]) openCamera(ctx, R.byId[p.near], null); });
        });
        el.querySelectorAll('.sp-tile').forEach(function (t) { t.addEventListener('click', function () { openCamera(ctx, R.byId[t.dataset.id], null); }); });
      }
    },
    F: {
      title: 'Detectors, water & defensible space',
      sub: function (ctx) { var t = ctx.pins.filter(function (p) { return p.status === 'trouble'; }).length; return t ? t + ' device in trouble' : 'all devices normal'; },
      html: function (ctx) {
        var R = ctx.R;
        var det = ctx.pins.filter(function (p) { return p.kind === 'smoke'; });
        var water = ctx.pins.filter(function (p) { return p.kind === 'water' || p.kind === 'hydrant'; });
        var haz = ctx.pins.filter(function (p) { return p.kind === 'hazard'; });
        function row(p, extra) {
          return '<div class="mod-row' + (p.status === 'trouble' ? ' alert' : '') + '" data-id="' + p.id + '"><div><div class="nm"><span class="n F' + (p.placement !== 'surveyed' ? ' dash' : '') + '">' + p.n + '</span>' + esc(p.name) + ' ' + (p.status && p.status !== 'n/a' ? '<span class="sp-st ' + esc(p.status) + '">' + esc(p.status) + '</span>' : '') + '</div><div class="mt">' + esc(extra || firstSentence(p.desc)) + '</div></div><div class="acts"><button class="sp-act sm" data-act="map" data-id="' + p.id + '">Map</button></div></div>';
        }
        var html = '<div class="sp-h F">Life-safety detectors</div>' + det.map(function (p) { return row(p, p.status === 'trouble' ? 'Low-battery trouble reported 2 days ago \u2014 replace the battery or schedule service.' : (p.vendor + ' \u00b7 monitored by Vyanet central station')); }).join('');
        html += '<div class="sp-h F">Water</div>' + water.map(function (p) { return row(p); }).join('');
        html += '<div class="sp-h F">Defensible space</div>' + (R.fx.zones || []).map(function (z) {
          return '<div class="mod-zone"><i></i><div><b>' + esc(z.name) + '</b><span>radius ' + z.radius_m + ' m \u00b7 ' + Math.round(z.radius_m * 3.28084) + ' ft \u00b7 dashed ring on the image</span></div></div>';
        }).join('') + haz.map(function (p) { return row(p); }).join('');
        return html;
      },
      wire: function () {}
    },
    E: {
      title: 'Response plan',
      sub: function (ctx) { return (ctx.R.fx.routes || []).filter(function (r) { return r.comp === 'E'; }).length + ' route \u00b7 ' + ctx.pins.length + ' positions'; },
      html: function (ctx) {
        var R = ctx.R;
        var routes = (R.fx.routes || []).filter(function (r) { return r.comp === 'E'; });
        var html = '<div class="sp-h E">Routes</div>' + routes.map(function (r) {
          var len = 0; for (var k = 1; k < r.points.length; k++) len += SP.haversine(r.points[k - 1], r.points[k]);
          return '<div class="mod-route" data-route="' + esc(r.id) + '"><b>' + esc(r.name) + '</b><div class="trig">' + esc(r.trigger) + '.</div>' +
            '<div class="meta"><span class="sp-chip">' + esc(r.start) + ' \u2192 ' + esc(r.target) + '</span><span class="sp-chip">\u2248 ' + Math.round(len) + ' m \u00b7 ' + SP.fmt(Math.round(len * 3.28084)) + ' ft</span><span class="sp-chip">' + r.points.length + ' waypoints</span></div>' +
            '<button class="sp-act sm go" data-act="route" data-route="' + esc(r.id) + '">Show route</button></div>';
        }).join('');
        html += '<div class="sp-h E">Positions & devices</div>' + ctx.pins.map(function (p) {
          return '<div class="mod-row" data-id="' + p.id + '"><div><div class="nm"><span class="n E' + (p.placement !== 'surveyed' ? ' dash' : '') + '">' + p.n + '</span>' + esc(p.name) + ' ' + (p.status && p.status !== 'n/a' ? '<span class="sp-st ' + esc(p.status) + '">' + esc(p.status) + '</span>' : '') + '</div><div class="mt">' + esc(firstSentence(p.desc)) + '</div></div><div class="acts"><button class="sp-act sm" data-act="map" data-id="' + p.id + '">Map</button></div></div>';
        }).join('');
        html += '<div class="sp-h E">Responder packet</div><div class="sp-note" style="margin:0 0 8px">One printable page per component plus facts and open clarifications \u2014 what travels with the dispatch.</div><button class="sp-act go" data-act="packet">Open responder packet</button>';
        return html;
      },
      wire: function (ctx, el) {
        el.querySelectorAll('[data-act="route"]').forEach(function (b) {
          b.addEventListener('click', function () {
            var r = (ctx.R.fx.routes || []).filter(function (x) { return x.id === b.dataset.route; })[0];
            if (!r) return;
            ctx.stage.showRoute(r);
            if (ctx.layout !== 'a') ctx.stage.el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          });
        });
        var pk = el.querySelector('[data-act="packet"]'); if (pk) pk.addEventListener('click', function () { openPacket(ctx); });
      }
    }
  };
  function wireModule(ctx, el, opts) { el.innerHTML = ctx.mod.html(ctx); ctx.mod.wire(ctx, el, opts || {}); wireRows(ctx, el); }

  // ---------- responder packet (print view, new window) ----------
  function openPacket(ctx) {
    var R = ctx.R;
    function section(c) {
      var r = R.fx.report[c];
      return '<h2><span class="k" style="background:' + SP.color(c) + '">' + c + '</span>' + esc(SP.COMP[c].label) + '</h2><p class="st">' + esc(r.status) + '</p>' +
        '<h3>Should know</h3><ul>' + SP.sentences(r.considerations).map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>' +
        '<h3>Recommendations</h3><ul>' + SP.sentences(r.recommendations).map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>' +
        '<table><thead><tr><th>#</th><th>Pin</th><th>Kind</th><th>Position</th></tr></thead><tbody>' + R.byComp[c].map(function (p) {
          return '<tr><td>' + p.n + '</td><td><b>' + esc(p.name) + '</b></td><td>' + esc(p.kind) + (p.placement !== 'surveyed' ? ' \u00b7 ' + esc(p.placement) : '') + '</td><td class="mono">' + p.lat.toFixed(5) + ', ' + p.lng.toFixed(5) + '</td></tr>';
        }).join('') + '</tbody></table>';
    }
    var routes = (R.fx.routes || []).filter(function (r) { return r.comp === 'E'; }).map(function (r) { return '<p><b>' + esc(r.name) + '</b> \u2014 ' + esc(r.trigger) + '. From ' + esc(r.start) + ' to ' + esc(r.target) + ', ' + r.points.length + ' waypoints.</p>'; }).join('');
    var html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Responder packet \u2014 ' + esc(R.name) + '</title><style>' +
      'body{font-family:Georgia,serif;color:#111;max-width:820px;margin:34px auto;padding:0 24px}.eyebrow{font:700 11px system-ui,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:#CD3333}h1{font:400 30px/1.1 Georgia,serif;margin:4px 0}.meta{font:13px system-ui,sans-serif;color:#6E7279;border-bottom:3px solid #CD3333;padding-bottom:14px;margin-bottom:18px}' +
      'h2{font:400 20px/1.2 Georgia,serif;margin:22px 0 6px;display:flex;align-items:center;gap:10px}h2 .k{width:22px;height:22px;border-radius:5px;display:inline-grid;place-items:center;font:700 12px ui-monospace,monospace;color:#fff}h3{font:700 11px system-ui,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#6E7279;margin:12px 0 4px}' +
      'p,li{font:14px/1.55 system-ui,sans-serif}.st{color:#6E7279}ul{margin:0 0 8px 18px}table{width:100%;border-collapse:collapse;font:12.5px system-ui,sans-serif;margin:8px 0 10px}th{text-align:left;font:700 10px system-ui,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#6E7279;border-bottom:2px solid #111;padding:0 10px 6px 0}td{padding:6px 10px 6px 0;border-bottom:1px solid #DEDBD5;vertical-align:top}td.mono{font:11px ui-monospace,monospace;white-space:nowrap}' +
      'dl{display:grid;grid-template-columns:170px 1fr;gap:4px 10px;font:13px system-ui,sans-serif}dt{color:#6E7279}.tools{display:flex;gap:8px;justify-content:flex-end;margin-bottom:14px}.tools button{font:600 12px system-ui,sans-serif;padding:8px 12px;border-radius:6px;border:1px solid #111;background:#fff;cursor:pointer}.tools .p{background:#CD3333;border-color:#CD3333;color:#fff}.small{font:11.5px/1.5 system-ui,sans-serif;color:#6E7279}@media print{.tools{display:none}}' +
      '</style></head><body><div class="tools"><button class="p" onclick="window.print()">Print / save PDF</button><button onclick="window.close()">Close</button></div>' +
      '<div class="eyebrow">Vyanet SAFE \u00b7 Responder packet</div><h1>' + esc(R.name) + '</h1><div class="meta">' + esc(R.address) + '</div>' +
      '<dl>' + R.fx.facts.slice(0, 8).map(function (f) { return '<dt>' + esc(f[0]) + '</dt><dd>' + esc(f[1]) + '</dd>'; }).join('') + '</dl>' +
      section('E') + (routes ? '<h3>Routes</h3>' + routes : '') + section('F') + section('A') + section('S') +
      '<h2>What this map cannot establish</h2><ul>' + (R.fx.limits || []).map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ul>' +
      '<p class="small">Prepared from the SAFE record on ' + new Date().toLocaleDateString() + ' \u00b7 mock packet, ' + BUILD + ' \u00b7 dashed pins are estimated or mock placements.</p></body></html>';
    var w = window.open('', '_blank');
    if (!w) { SP.toast('Pop-up blocked \u2014 allow pop-ups to open the packet.'); return; }
    w.document.open(); w.document.write(html); w.document.close();
  }

  // ---------- layouts ----------
  function modulePanelHTML(ctx) {
    return '<section class="panel panel-mod"><div class="panel-h"><span class="sp-k ' + ctx.comp + '" style="width:22px;height:22px;font-size:11px">' + ctx.comp + '</span><h2>' + esc(ctx.mod.title) + '</h2><span class="sub' + (ctx.comp === 'S' ? ' live' : '') + '">' + esc(ctx.mod.sub(ctx)) + '</span></div><div class="panel-b mod"></div></section>';
  }
  function limitsPanelHTML(ctx, cls) {
    return '<section class="panel ' + (cls || '') + '"><div class="panel-h"><h2>What this map cannot establish</h2></div><div class="panel-b"><ul class="sp-limits">' + (ctx.R.fx.limits || []).map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ul></div></section>';
  }
  function factsPanelHTML(ctx, cls, limit) {
    return '<section class="panel ' + (cls || '') + '"><div class="panel-h"><h2>Property facts</h2></div><div class="panel-b">' + SP.factsHTML(ctx.R, limit ? { limit: limit } : {}) + '</div></section>';
  }
  function pinsPanelHTML(ctx, cls) {
    return '<section class="panel card-pins ' + (cls || '') + '"><div class="panel-h"><h2>On the map</h2><span class="sub">' + ctx.pins.length + ' pins</span></div><div class="panel-b">' + pinTableHTML(ctx) + '</div></section>';
  }

  var LAYOUTS = {
    a: function (ctx) {
      var body = document.body;
      body.innerHTML =
        '<div class="pg-body"><div class="pg-main sp-scroll">' + figureHTML(ctx) + '</div>' +
        '<aside class="pg-rail sp-scroll">' +
          '<div class="sec"><div class="sp-h ' + ctx.comp + '">' + esc(ctx.mod.title) + ' <span class="sp-mono" style="margin-left:auto;font-size:10px;color:var(--text3);text-transform:none;letter-spacing:0">' + esc(ctx.mod.sub(ctx)) + '</span></div><div class="mod"></div></div>' +
          '<div class="sec"><div class="sp-h">On the map \u00b7 ' + ctx.pins.length + '</div><div class="sp-pinlist">' + pinRowsHTML(ctx) + '</div></div>' +
          (ctx.comp === 'E' ? '<div class="sec">' + SP.limitsHTML(ctx.R) + '</div>' : '') +
          '<div class="sec">' + SP.factsHTML(ctx.R, { limit: 8 }) + '</div>' +
        '</aside></div>';
      wireFigure(ctx, body.querySelector('.fig'));
      wireRows(ctx, body.querySelector('.pg-rail'));
      wireModule(ctx, body.querySelector('.mod'), { feedsLayout: 'grid2' });
    },
    b: function (ctx) {
      var body = document.body;
      body.innerHTML = '<div class="wrap">' + figureHTML(ctx) +
        '<div class="two">' + modulePanelHTML(ctx) + pinsPanelHTML(ctx) + '</div>' +
        '<div class="two">' + (ctx.comp === 'E' ? limitsPanelHTML(ctx) : '') + factsPanelHTML(ctx, '', 9) + '</div>' +
      '</div>';
      wireFigure(ctx, body.querySelector('.fig'));
      wireRows(ctx, body.querySelector('.card-pins'));
      wireModule(ctx, body.querySelector('.mod'), { feedsLayout: 'strip', wide: true });
    },
    c: function (ctx) {
      var body = document.body;
      body.innerHTML =
        '<div class="grid">' +
          '<div class="card-fig">' + figureHTML(ctx) + '</div>' +
          '<div class="card-mod">' + modulePanelHTML(ctx) + '</div>' +
          pinsPanelHTML(ctx, ctx.comp === 'E' ? 'card-4' : 'card-6') +
          (ctx.comp === 'E' ? limitsPanelHTML(ctx, 'card-4') : '') +
          factsPanelHTML(ctx, ctx.comp === 'E' ? 'card-4' : 'card-6') +
        '</div>';
      wireFigure(ctx, body.querySelector('.fig'));
      wireRows(ctx, body.querySelector('.card-pins'));
      wireModule(ctx, body.querySelector('.mod'), { feedsLayout: 'grid2' });
    }
  };

  window.SafePage = { boot: boot, BUILD: BUILD, select: function (id) { if (window.SAFE_PAGE) selectPin(window.SAFE_PAGE, id, 'api'); } };
})();
