/*
  safe-portal/portal/portal-home.js — the HOME page of the SAFE portal.
  safe-portal 0.5.0

  The portal is built around SAFE, so the home page explains the portal
  through the four lenses — Security, Access, Fire, Emergency service —
  and lands the owner on the property's current picture:

    hero       property, lede ("one property, four lenses"), status chips,
               and THE WHOLE PICTURE: the drone nadir with all four layers
               on (click a pin → its lens page, pin selected)
    lenses     one block per component: the question it answers, this
               property's status + summary, what you can do on the page,
               the numbers, open trouble, "Open <lens> →"
    anatomy    how every SAFE page is built: figure · module · on the map ·
               facts & limits
    roles      owner · Vyanet · responders
    status     chips, open trouble, recent activity, open clarifications,
               the record

  Same three layouts as the component pages (?layout=a|b|c): a = overview +
  rail, b = briefing column, c = dashboard cards. Inside the portal shell
  the links post {type:'safe-nav'} so the shell's menu follows; standalone
  they are plain links. Shared engine: ../portal-core.js; styles in
  portal-page.css (Home section). Writes nothing.
*/
(function () {
  'use strict';
  var SP = window.SafePortal;
  var P = SP.params;
  var esc = SP.esc;
  var BUILD = 'safe-portal 0.5.0';
  var PAGE = { S: 'security', A: 'access', F: 'fire', E: 'emergency' };

  // What each lens answers and what the page lets you do — written for the
  // portal (any property), not for one record.
  var LENS = {
    S: {
      q: 'What is watching, and what can it see?',
      fns: [
        'Watch the live CHEKT feeds and open any camera full-size',
        'Review the last seven days of clips, filtered by camera',
        'Every camera\u2019s field of view drawn on the picture, LIVE tags on the ones you can watch',
        'Alarm panel, door contacts, motion and glass-break \u2014 each zone pinned where it lives'
      ]
    },
    A: {
      q: 'Who can get in, and how?',
      fns: [
        'Every opening \u2014 gate, garage, doors \u2014 with its hardware status',
        'Unlock or open remote-operable openings, confirmation camera first (\u201cWho\u2019s there?\u201d)',
        'The approach drive measured: length, pinch points, turnaround',
        'What the imagery cannot confirm, listed as open clarifications'
      ]
    },
    F: {
      q: 'What burns, what protects, and where is the water?',
      fns: [
        'Smoke, heat and CO detector health, with trouble conditions called out',
        '30 ft and 100 ft defensible-space rings drawn around the structure',
        'Fuel gaps, open perimeter and ember-intrusion points on the roof',
        'Water: pool draft or tanker fill, and the nearest hydrant'
      ]
    },
    E: {
      q: 'How do responders get in, work, and get out?',
      fns: [
        'Incident routes with numbered waypoints from the entrance to the target',
        'Staging and command positions, dead ends and turnarounds, helicopter ground',
        'Panic and medical devices that reach the central station',
        'The printable responder packet \u2014 all four lenses on paper for dispatch'
      ]
    }
  };
  var JOBS = [
    { c: 'S', verb: 'Watch the property', d: 'Live CHEKT cameras, seven days of clips, and every alarm zone pinned on the picture.' },
    { c: 'A', verb: 'Get in \u2014 and let the right people in', d: 'Openings, remote unlock, the confirmation camera, and the measured approach drive.' },
    { c: 'F', verb: 'Know what burns and where the water is', d: 'Detector health, 30 / 100 ft rings, fuel gaps, pool draft, nearest hydrant.' },
    { c: 'E', verb: 'Tell responders how to work it', d: 'Incident route, staging, dead ends, medical devices, and the printable packet.' }
  ];
  var ANATOMY = [
    { t: 'The figure', d: 'The annotated picture of the property \u2014 drone nadir, 2D map, four compass obliques or the 3D model \u2014 with numbered pins, LIVE tags and callouts on leader lines. SHOULD KNOW and RECOMMENDATIONS sit under it, like the printed SAFE panel.' },
    { t: 'The module', d: 'The tools that belong to the lens: live cameras and clips (S), openings with unlock and the confirmation camera (A), detectors, water and defensible space (F), routes, positions and the responder packet (E).' },
    { t: 'On the map', d: 'Every pin of the lens in a table \u2014 the same number as on the picture, its kind and status. Click a row, a pin or a callout and the others follow.' },
    { t: 'Facts & limits', d: 'The property record \u2014 taxlot, year built, fire district, WUI, hydrants \u2014 and \u201cwhat this map cannot establish\u201d: the clarifications Vyanet still owes.' }
  ];
  var ROLES = [
    { t: 'Owner \u00b7 portal user', who: 'Tracy Jones', d: 'Watch cameras, unlock openings, review clips, see what Vyanet recommends and what is still unconfirmed.' },
    { t: 'Vyanet', who: 'Operators \u00b7 technicians', d: 'Keep the record current \u2014 technician stills, the device layer, callouts, drone captures \u2014 and monitor alarm and life-safety at central station.' },
    { t: 'Responders', who: 'Fire \u00b7 EMS \u00b7 law', d: 'The same picture, read-only: routes, staging, water, the packet. Nothing to log into at 3 a.m.' }
  ];

  function boot() {
    var layout = String(P.get('layout') || 'a').toLowerCase();
    if (['a', 'b', 'c'].indexOf(layout) < 0) layout = 'a';
    var theme = P.get('theme') === 'dark' ? 'dark' : 'light';
    document.documentElement.classList.add('theme-' + theme);
    var R = SP.load(P.get('p') || 'residence');
    var ctx = { R: R, layout: layout, theme: theme, inFrame: window.parent !== window };
    document.body.className = 'pg pg-' + layout + ' pg-home';
    document.title = 'Vyanet SAFE \u2014 Home \u00b7 ' + R.name + ' (mock)';
    LAYOUTS[layout](ctx);
    wire(ctx);
    try { window.parent.postMessage({ type: 'safe-page', comp: null, title: 'Home', status: statusLine(R), build: BUILD }, '*'); } catch (e) {}
    window.SAFE_HOME = ctx;
  }

  // ---------- derived numbers ----------
  function statusLine(R) {
    var t = troubles(R).length;
    return R.pins.length + ' pins \u00b7 ' + R.cams.length + ' cameras \u00b7 ' + R.live.length + ' live \u00b7 ' + (t ? t + ' open trouble' : 'no open trouble') + (R.drone ? ' \u00b7 drone tier' : '');
  }
  function troubles(R) { return R.pins.filter(function (p) { return p.status === 'trouble'; }); }
  function ft(m) { return Math.round(m) + ' m'; }
  function stats(R, c) {
    var pins = R.byComp[c];
    if (c === 'S') return [[R.cams.length, 'cameras'], [R.live.length, 'live feeds'], [pins.filter(function (p) { return p.kind !== 'camera'; }).length, 'alarm devices'], [R.clips.length, 'clips \u00b7 7 days']];
    if (c === 'A') {
      var open = pins.filter(function (p) { return p.kind === 'gate' || p.kind === 'door'; });
      var remote = pins.filter(function (p) { return (p.actions || []).indexOf('unlock') >= 0; });
      var cams = {}; open.forEach(function (p) { if (p.near && R.byId[p.near]) cams[p.near] = 1; });
      var g = R.byId['gate-road'], e = R.byId['entry-court'];
      return [[open.length, 'openings'], [remote.length, 'remote-operable'], [Object.keys(cams).length, 'confirmation cams'], [g && e ? ft(SP.haversine(g, e)) : '\u2014', 'approach drive']];
    }
    if (c === 'F') {
      var det = pins.filter(function (p) { return p.kind === 'smoke'; });
      return [[det.length, 'detectors'], [det.filter(function (p) { return p.status === 'trouble'; }).length, 'in trouble'], [pins.filter(function (p) { return p.kind === 'water'; }).length, 'water sources'], [(R.fx.zones || []).filter(function (z) { return z.comp === 'F'; }).length, 'space rings']];
    }
    var routes = (R.fx.routes || []).filter(function (r) { return r.comp === 'E'; });
    return [[routes.length, routes.length === 1 ? 'route' : 'routes'], [pins.length, 'positions'], [pins.filter(function (p) { return p.kind === 'medical'; }).length, 'medical devices'], [R.byId['lz-none'] ? 'none' : '\u2014', 'helicopter ground']];
  }
  function href(ctx, page, pin) {
    var q = new URLSearchParams();
    q.set('p', ctx.R.slug); q.set('layout', ctx.layout); q.set('theme', ctx.theme);
    if (pin) q.set('pin', pin);
    return page + '.html?' + q.toString();
  }
  function go(ctx, page, pin) {
    if (ctx.inFrame) {
      try { window.parent.postMessage({ type: 'safe-nav', page: page, pin: pin || null }, '*'); return; } catch (e) {}
    }
    window.location.href = href(ctx, page, pin);
  }
  function link(ctx, page, pin, cls, inner, extra) {
    return '<a class="' + cls + '" href="' + href(ctx, page, pin) + '" data-nav="' + page + '"' + (pin ? ' data-pin="' + esc(pin) + '"' : '') + (extra || '') + '>' + inner + '</a>';
  }

  // ---------- blocks ----------
  function heroTextHTML(ctx) {
    var R = ctx.R, t = troubles(R);
    return '<div class="hm-hero-text">' +
      '<div class="hm-eyebrow">Vyanet <i>S</i><i>A</i><i>F</i><i>E</i> \u00b7 Property Intel portal</div>' +
      '<h1>' + esc(R.name) + '</h1><div class="addr">' + esc(R.address) + '</div>' +
      '<p class="lede">This portal is built around <b class="S">S</b>ecurity, <b class="A">A</b>ccess, <b class="F">F</b>ire and <b class="E">E</b>mergency service \u2014 the four jobs a responder, an owner and Vyanet share on a property. Each letter is a page. Each page is the same annotated picture with the tools that belong to that job.</p>' +
      '<div class="hm-chips">' + SP.chipsHTML(R, { build: false }) + (t.length ? '<span class="sp-chip" style="color:var(--F);border-color:rgba(239,68,68,0.5)">' + t.length + ' open trouble</span>' : '') + '</div>' +
      jobsListHTML(ctx, 'hm-jobs compact') +
    '</div>';
  }
  function jobsListHTML(ctx, cls) {
    return '<div class="' + cls + '">' + JOBS.map(function (j) {
      return link(ctx, PAGE[j.c], null, 'job comp-' + j.c, '<span class="sp-k ' + j.c + '">' + j.c + '</span><div><b>' + esc(j.verb) + '</b><p>' + esc(j.d) + '</p></div>');
    }).join('') + '</div>';
  }
  function jobsHTML(ctx) {
    return '<section class="hm-jobs-wrap"><div class="hm-sec-h"><h2>What this portal does</h2><span>Four jobs. Four pages. One property.</span></div>' + jobsListHTML(ctx, 'hm-jobs') + '</section>';
  }
  function pictureHTML(ctx) {
    var R = ctx.R;
    return '<section class="fig hm-fig">' +
      '<header class="fig-head"><span class="fig-brand">Vyanet <i>S</i><i>A</i><i>F</i><i>E</i></span><div class="fig-ttl"><b>THE WHOLE PICTURE \u00b7 ' + esc(R.name) + ', ' + esc(R.address) + '</b><span>' + R.pins.length + ' pins in four colours \u00b7 ' + (R.drone ? 'drone nadir, flown ' + esc(R.drone.flown) : '2D map') + ' \u00b7 click a pin to open its lens</span></div></header>' +
      '<div class="pg-stage"><div class="sp-sub on sub-pic"></div><div class="sp-legend legend"></div></div>' +
      '<footer class="fig-foot"><span>solid = surveyed \u00b7 dashed = estimated / mock \u00b7 LIVE = CHEKT feed (simulated)</span><span>' + BUILD + '</span></footer>' +
    '</section>';
  }
  function lensHTML(ctx, c) {
    var R = ctx.R, C = SP.COMP[c], rep = R.fx.report[c], L = LENS[c];
    var trouble = R.byComp[c].filter(function (p) { return p.status === 'trouble'; });
    return '<section class="hm-lens comp-' + c + '" style="--c:var(--' + c + ')">' +
      '<div class="hm-lens-id"><span class="sp-k ' + c + '">' + c + '</span><div><h3>' + esc(C.label) + '</h3><p class="q">' + esc(L.q) + '</p></div>' +
        link(ctx, PAGE[c], null, 'sp-act go', 'Open \u2192') + '</div>' +
      '<div class="hm-lens-side"><div class="stats">' + stats(R, c).map(function (s) { return '<div><b>' + esc(s[0]) + '</b><span>' + esc(s[1]) + '</span></div>'; }).join('') + '</div></div>' +
      '<div class="hm-lens-body">' +
        '<div class="st">' + esc(rep.status) + '</div>' +
        '<p class="sum">' + esc(rep.summary) + '</p>' +
        '<div class="sp-h ' + c + '">What you can do</div><ul class="fns">' + L.fns.map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ul>' +
        (trouble.length ? '<div class="hm-alerts">' + trouble.map(function (p) { return link(ctx, PAGE[c], p.id, 'alert', '<span class="sp-st trouble">trouble</span><b>' + esc(p.name) + '</b><span>' + esc(SP.sentences(p.desc).slice(-1)[0] || '') + '</span>'); }).join('') + '</div>' : '') +
      '</div>' +
    '</section>';
  }
  function lensesHTML(ctx) { return '<div class="hm-lenses">' + SP.ORDER.map(function (c) { return lensHTML(ctx, c); }).join('') + '</div>'; }
  function anatomyHTML() {
    return '<section class="hm-anatomy"><div class="hm-sec-h"><h2>How every SAFE page is built</h2><span>Same anatomy on all four lenses \u2014 learn it once</span></div><div class="items">' + ANATOMY.map(function (a, i) {
      return '<div class="item"><span class="k">' + (i + 1) + '</span><b>' + esc(a.t) + '</b><p>' + esc(a.d) + '</p></div>';
    }).join('') + '</div></section>';
  }
  function rolesHTML() {
    return '<section class="hm-roles"><div class="hm-sec-h"><h2>Who uses it</h2><span>One record, three readers</span></div><div class="items">' + ROLES.map(function (r) {
      return '<div class="item"><b>' + esc(r.t) + '</b><span class="who">' + esc(r.who) + '</span><p>' + esc(r.d) + '</p></div>';
    }).join('') + '</div></section>';
  }
  function activityHTML(ctx) {
    var R = ctx.R;
    return '<div class="hm-activity">' + (R.events || []).map(function (ev) {
      var p = ev.pin && R.byId[ev.pin], c = p ? p.comp : null;
      var inner = '<span class="t">' + esc(ev.t) + '</span><span class="kind ' + esc(ev.kind) + '">' + esc(ev.kind) + '</span><span class="tx">' + esc(ev.text) + '</span>';
      return c ? link(ctx, PAGE[c], p.id, 'ev comp-' + c, inner) : '<div class="ev">' + inner + '</div>';
    }).join('') + '</div>';
  }
  function troubleHTML(ctx) {
    var R = ctx.R, t = troubles(R);
    if (!t.length) return '<div class="sp-note" style="margin:0">No open trouble. Alarm: ' + esc(R.fx.monitoring.alarm) + ' \u00b7 CHEKT ' + R.live.length + ' live.</div>';
    return '<div class="hm-alerts">' + t.map(function (p) { return link(ctx, PAGE[p.comp], p.id, 'alert', '<span class="sp-st trouble">trouble</span><b>' + esc(p.name) + '</b><span>' + esc(SP.sentences(p.desc).slice(-1)[0] || '') + '</span>'); }).join('') + '</div>';
  }
  function limitsHTML(ctx) {
    return '<ul class="sp-limits">' + (ctx.R.fx.limits || []).map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ul>';
  }
  function panel(title, sub, body, cls) {
    return '<section class="panel ' + (cls || '') + '"><div class="panel-h"><h2>' + title + '</h2>' + (sub ? '<span class="sub">' + sub + '</span>' : '') + '</div><div class="panel-b">' + body + '</div></section>';
  }

  // ---------- wiring ----------
  function wire(ctx) {
    var R = ctx.R;
    // the whole picture: nadir with all four layers on; a pin click opens its lens
    var pic = document.querySelector('.hm-fig .sub-pic');
    if (pic) {
      var layers = { S: true, A: true, F: true, E: true };
      var onSel = function (p) { if (p) setTimeout(function () { go(ctx, PAGE[p.comp], p.id); }, 120); };
      if (R.drone) SP.createNadir(pic, R, { layers: layers, focus: null, labels: false, onSelect: onSel });
      else SP.createMap(pic, R, { layers: layers, focus: null, lot: true, zoom: R.fx.zoom || 18, onSelect: onSel });
      var legend = document.querySelector('.hm-fig .legend');
      if (legend) legend.innerHTML = SP.legendHTML(R);
    }
    if (ctx.inFrame) document.querySelectorAll('a[data-nav]').forEach(function (a) {
      a.addEventListener('click', function (e) { e.preventDefault(); go(ctx, a.dataset.nav, a.dataset.pin || null); });
    });
  }

  // ---------- layouts ----------
  var LAYOUTS = {
    a: function (ctx) {
      document.body.innerHTML =
        '<div class="pg-body"><div class="pg-main sp-scroll hm-main">' +
          '<div class="hm-hero">' + heroTextHTML(ctx) + '</div>' + pictureHTML(ctx) + lensesHTML(ctx) + anatomyHTML() + rolesHTML() +
        '</div><aside class="pg-rail sp-scroll">' +
          '<div class="sec"><div class="sp-h">Open trouble</div>' + troubleHTML(ctx) + '</div>' +
          '<div class="sec"><div class="sp-h">Recent activity</div>' + activityHTML(ctx) + '</div>' +
          '<div class="sec">' + SP.limitsHTML(ctx.R) + '</div>' +
          '<div class="sec">' + SP.factsHTML(ctx.R, { limit: 8 }) + '</div>' +
        '</aside></div>';
    },
    b: function (ctx) {
      document.body.innerHTML = '<div class="wrap">' +
        '<div class="hm-hero two">' + heroTextHTML(ctx) + pictureHTML(ctx) + '</div>' +
        lensesHTML(ctx) + anatomyHTML() + rolesHTML() +
        '<div class="two">' + panel('Recent activity', (ctx.R.events || []).length + ' events', activityHTML(ctx)) + panel('Open trouble & clarifications', '', troubleHTML(ctx) + '<div class="sp-h" style="margin-top:14px">What this map cannot establish</div>' + limitsHTML(ctx)) + '</div>' +
        '<div class="two">' + panel('Property facts', '', SP.factsHTML(ctx.R, { limit: 10 })) + '</div>' +
      '</div>';
    },
    c: function (ctx) {
      document.body.innerHTML = '<div class="grid">' +
        '<div class="card-8"><section class="panel hm-hero-card"><div class="hm-hero two">' + heroTextHTML(ctx) + pictureHTML(ctx) + '</div></section></div>' +
        '<div class="card-4">' + panel('Status', esc(statusLine(ctx.R)), troubleHTML(ctx) + '<div class="sp-h" style="margin-top:14px">Recent activity</div>' + activityHTML(ctx), 'hm-status') + '</div>' +
        SP.ORDER.map(function (c) { return '<div class="card-6">' + lensHTML(ctx, c) + '</div>'; }).join('') +
        '<div class="card-8"><section class="panel"><div class="panel-b">' + anatomyHTML() + '</div></section></div>' +
        '<div class="card-4"><section class="panel"><div class="panel-b">' + rolesHTML() + '</div></section></div>' +
        '<div class="card-6">' + panel('What this map cannot establish', '', limitsHTML(ctx)) + '</div>' +
        '<div class="card-6">' + panel('Property facts', '', SP.factsHTML(ctx.R, { limit: 10 })) + '</div>' +
      '</div>';
    }
  };

  window.SafeHome = { boot: boot, BUILD: BUILD };
})();
