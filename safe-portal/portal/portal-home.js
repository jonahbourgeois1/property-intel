/*
  safe-portal/portal/portal-home.js — the HOME page of the SAFE portal.
  safe-portal 0.5.0

  The portal is built around SAFE, so the home page explains the portal
  through the four lenses — Security, Access, Fire, Environment —
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
  var BUILD = 'safe-portal 0.9.0';
  var PAGE = { S: 'security', A: 'access', F: 'fire', E: 'environment' };
  var SCOPE_PAGE = { residence: 'residence', hoa: 'community' };

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
        'The approach drive measured: length, pinch points, turnaround \u2014 this is also how responders arrive',
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
      q: 'What does the imagery show, and what do you want to do about it?',
      fns: [
        'Trash, debris, and hazards isolated from the Nearmap debris layer',
        'Road and roof condition \u2014 damage called only when the surface or roof layer shows it',
        'Irrigation as visible cover: maintained turf against native ground, not a watering schedule',
        'A look-list. Vyanet identifies. You, or your contractor, decide'
      ]
    }
  };
  var JOBS = {
    residence: [
      { c: 'S', verb: 'Watch the property', d: 'Live CHEKT cameras, seven days of clips, and every alarm zone pinned on the picture.' },
      { c: 'A', verb: 'Get in \u2014 and let the right people in', d: 'Openings, remote unlock, the confirmation camera, and the measured approach. This is also how responders arrive.' },
      { c: 'F', verb: 'Know what burns and where the water is', d: 'Detector health, 30 / 100 ft rings, fuel gaps, pool draft, nearest hydrant.' },
      { c: 'E', verb: 'See the condition of the place', d: 'Debris, trash, hazards, road and roof condition, and irrigation \u2014 located from Nearmap. You decide what to do.' }
    ],
    hoa: [
      { c: 'S', verb: 'See the protective circle', d: 'Which lots have a SAFE map, which have a live device canvas, and what the community itself is watching.' },
      { c: 'A', verb: 'Know how the neighborhood opens', d: 'One arterial in, the loop, the dead-end courts, and any gate still unconfirmed. Turnarounds live here.' },
      { c: 'F', verb: 'Treat fuels as shared', d: 'WUI across every lot, the hydrant survey, and the western-edge fuel break.' },
      { c: 'E', verb: 'See condition across the circle', d: 'Debris, paving, and where common ground is being watered. Per-lot maintenance stays the owner\u2019s call.' }
    ]
  };
  var LENS_HOA = {
    S: { q: 'Who is on the circle, and who is watching the entry?', fns: ['See coverage on all 46 lots \u2014 live canvas, base SAFE, or satellite only', 'Open a lot to jump into its residence SAFE when one exists', 'The proposed entry camera \u2014 Community Live is empty until it exists', 'Each home\u2019s devices stay that home\u2019s, whoever monitors them'] },
    A: { q: 'How does the neighborhood open?', fns: ['The single arterial connection and the loop that distributes from it', 'Five dead-end courts that empty onto the loop \u2014 the bulbs are the turnarounds', 'Entry geometry and any gate \u2014 still a capture item', 'Long private drives (the Jones lot is the worked example)'] },
    F: { q: 'Where does one lot\u2019s gap become the next lot\u2019s exposure?', fns: ['WUI on every assessed lot', 'The pending community hydrant survey', 'Unmanaged fuels on the western edge', 'A shared fuel-break the board can coordinate'] },
    E: { q: 'What does the imagery show across the neighborhood?', fns: ['Vegetation debris where lots meet the western edge', 'Loop and court pavement \u2014 damage called only when a survey shows it', 'Common ground as turf versus native cover, the visible irrigation extent', 'Per-lot roof, debris, and irrigation findings live on each residence, when that lot has Nearmap'] }
  };
  var ANATOMY = [
    { t: 'The figure', d: 'The annotated picture of the property \u2014 drone nadir, 2D map, four compass obliques or the 3D model \u2014 with numbered pins, LIVE tags and callouts on leader lines. SHOULD KNOW and RECOMMENDATIONS sit under it, like the printed SAFE panel.' },
    { t: 'The module', d: 'The tools that belong to the lens: live cameras and clips (S), openings with unlock and the confirmation camera (A), detectors, water and defensible space (F), Nearmap conditions \u2014 debris, roof, road, irrigation \u2014 for the user to judge (E).' },
    { t: 'On the map', d: 'Every pin of the lens in a table \u2014 the same number as on the picture, its kind and status. Click a row, a pin or a callout and the others follow.' },
    { t: 'Facts & limits', d: 'The property record \u2014 taxlot, year built, fire district, WUI, hydrants \u2014 and \u201cwhat this map cannot establish\u201d: the clarifications Vyanet still owes.' }
  ];
  var ROLES = [
    { t: 'Owner \u00b7 portal user', who: 'Tracy Jones', d: 'Watch cameras, unlock openings, review clips, see what Vyanet recommends and what is still unconfirmed.' },
    { t: 'Vyanet', who: 'Operators \u00b7 technicians', d: 'Keep the record current \u2014 technician stills, the device layer, callouts, drone captures \u2014 and monitor alarm and life-safety at central station.' },
    { t: 'Responders', who: 'Fire \u00b7 EMS \u00b7 law', d: 'The same picture, read-only: how to get in on Access, water and fuels on Fire. Nothing to log into at 3 a.m.' }
  ];

  function boot() {
    var layout = String(P.get('layout') || 'c').toLowerCase();
    if (['a', 'b', 'c'].indexOf(layout) < 0) layout = 'a';
    var theme = P.get('theme') === 'dark' ? 'dark' : 'light';
    document.documentElement.classList.add('theme-' + theme);
    var portal = P.get('mode') === 'portal';
    var R = SP.load(P.get('p') || 'residence');
    var C = portal ? SP.load('hoa') : null;
    var ctx = { R: R, C: C, portal: portal, layout: layout, theme: theme, inFrame: window.parent !== window };
    document.body.className = 'pg pg-' + layout + ' pg-home' + (portal ? ' pg-portal' : '');
    document.title = portal ? 'Vyanet SAFE \u2014 Home (mock)' : 'Vyanet SAFE \u2014 ' + (R.slug === 'hoa' ? 'Community' : 'Residence') + ' \u00b7 ' + R.name + ' (mock)';
    if (portal) PORTAL[layout](ctx); else LAYOUTS[layout](ctx);
    if (portal && window.SafePatrol) {
      SafePatrol.fillHome(document.getElementById('hm-patrol-notes'), function () {
        if (ctx.inFrame) {
          try { window.parent.postMessage({ type: 'safe-nav', page: 'patrol' }, '*'); } catch (e) {}
        } else {
          location.href = 'patrol.html?theme=' + ctx.theme;
        }
      });
    }
    wire(ctx);
    var status = portal ? 'One portal \u00b7 two SAFE maps \u00b7 residence and community' : statusLine(R);
    try { window.parent.postMessage({ type: 'safe-page', comp: null, title: portal ? 'Home' : (R.slug === 'hoa' ? 'Community (SAFE)' : 'Residence (SAFE)'), status: status, build: BUILD }, '*'); } catch (e) {}
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
    if (c === 'S') {
      if (R.slug === 'hoa') {
        var lots = pins.filter(function (p) { return p.kind === 'lot'; });
        return [[lots.length, 'lots'], [lots.filter(function (p) { return p.coverage === 'canvas'; }).length, 'live canvas'], [lots.filter(function (p) { return p.coverage === 'safe'; }).length, 'base SAFE'], [lots.filter(function (p) { return p.coverage === 'pending'; }).length, 'in production']];
      }
      return [[R.cams.length, 'cameras'], [R.live.length, 'live feeds'], [pins.filter(function (p) { return p.kind !== 'camera' && p.kind !== 'lot'; }).length, 'alarm devices'], [R.clips.length, 'clips \u00b7 7 days']];
    }
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
    return [[pins.length, 'observations'], [pins.filter(function (p) { return p.kind === 'debris'; }).length, 'debris'], [pins.filter(function (p) { return p.kind === 'roof' || p.kind === 'road'; }).length, 'roof / paving'], [pins.filter(function (p) { return p.kind === 'irrigation' || p.kind === 'green' || p.kind === 'water'; }).length, 'irrigation']];
  }
  function href(ctx, page, pin, slug) {
    var q = new URLSearchParams();
    var p = slug || ctx.R.slug;
    if (page === 'home') q.set('mode', 'portal'); else q.set('p', p);
    q.set('layout', ctx.layout); q.set('theme', ctx.theme);
    if (pin) q.set('pin', pin);
    var file = (page === 'home' || page === 'residence' || page === 'community') ? 'home.html' : page + '.html';
    return file + '?' + q.toString();
  }
  function go(ctx, page, pin, slug) {
    if (ctx.inFrame) {
      try { window.parent.postMessage({ type: 'safe-nav', page: page, pin: pin || null, p: slug || (page === 'home' ? null : ctx.R.slug) }, '*'); return; } catch (e) {}
    }
    window.location.href = href(ctx, page, pin, slug);
  }
  function link(ctx, page, pin, cls, inner, extra, slug) {
    return '<a class="' + cls + '" href="' + href(ctx, page, pin, slug) + '" data-nav="' + page + '"' + (pin ? ' data-pin="' + esc(pin) + '"' : '') + (slug ? ' data-p="' + esc(slug) + '"' : '') + (extra || '') + '>' + inner + '</a>';
  }

  // ---------- blocks ----------
  function heroTextHTML(ctx) {
    var R = ctx.R, t = troubles(R);
    return '<div class="hm-hero-text">' +
      '<div class="hm-eyebrow">Vyanet <i>S</i><i>A</i><i>F</i><i>E</i> \u00b7 ' + (R.slug === 'hoa' ? 'Community' : 'Residence') + '</div>' +
      '<h1>' + esc(R.name) + '</h1><div class="addr">' + esc(R.address) + '</div>' +
      '<p class="lede">' + (R.slug === 'hoa'
        ? 'The community SAFE map. Same four jobs \u2014 <b class="S">S</b>ecurity, <b class="A">A</b>ccess, <b class="F">F</b>ire, <b class="E">E</b>nvironment \u2014 drawn on the neighborhood, not the house. Each lot is a pin. The Jones residence is the one live canvas inside the circle.'
        : 'The residence SAFE map. Everything Vyanet knows about this house, organised as <b class="S">S</b>ecurity, <b class="A">A</b>ccess, <b class="F">F</b>ire and <b class="E">E</b>nvironment. Each letter is a page on this same annotated picture.') + '</p>' +
      '<div class="hm-chips">' + SP.chipsHTML(R, { build: false }) + (t.length ? '<span class="sp-chip" style="color:var(--F);border-color:rgba(239,68,68,0.5)">' + t.length + ' open trouble</span>' : '') + '</div>' +
      jobsListHTML(ctx, 'hm-jobs compact') +
    '</div>';
  }
  function jobsListHTML(ctx, cls, rec) {
    rec = rec || ctx.R;
    return '<div class="' + cls + '">' + (JOBS[rec.slug] || JOBS.residence).map(function (j) {
      return link(ctx, PAGE[j.c], null, 'job comp-' + j.c, '<span class="sp-k ' + j.c + '">' + j.c + '</span><div><b>' + esc(j.verb) + '</b><p>' + esc(j.d) + '</p></div>', '', rec.slug);
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
    var R = ctx.R, C = SP.COMP[c], rep = R.fx.report[c], L = (R.slug === 'hoa' ? LENS_HOA : LENS)[c];
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
  function mountPicture(el, rec, ctx) {
    if (!el) return;
    var layers = { S: true, A: true, F: true, E: true };
    var onSel = function (p) {
      if (!p) return;
      var page = PAGE[p.comp];
      var slug = rec.slug;
      if (p.kind === 'lot' && p.hub === '6de88883') { page = 'residence'; slug = 'residence'; }
      setTimeout(function () { go(ctx, page, p.kind === 'lot' && slug === 'residence' ? null : p.id, slug); }, 120);
    };
    if (rec.drone) SP.createNadir(el, rec, { layers: layers, focus: null, labels: false, onSelect: onSel });
    else SP.createMap(el, rec, { layers: layers, focus: null, lot: rec.slug !== 'hoa', zoom: rec.fx.zoom || 18, onSelect: onSel });
    var legend = el.parentNode && el.parentNode.querySelector('.legend');
    if (legend) legend.innerHTML = SP.legendHTML(rec);
  }
  function wire(ctx) {
    if (ctx.portal) {
      mountPicture(document.querySelector('.hm-fig-res .sub-pic'), ctx.R, ctx);
      mountPicture(document.querySelector('.hm-fig-com .sub-pic'), ctx.C, ctx);
    } else {
      mountPicture(document.querySelector('.hm-fig .sub-pic'), ctx.R, ctx);
    }
    if (ctx.inFrame) document.querySelectorAll('a[data-nav]').forEach(function (a) {
      a.addEventListener('click', function (e) { e.preventDefault(); go(ctx, a.dataset.nav, a.dataset.pin || null, a.dataset.p || null); });
    });
  }

  function portalHeroHTML() {
    return '<div class="hm-hero-text">' +
      '<div class="hm-eyebrow">Vyanet <i>S</i><i>A</i><i>F</i><i>E</i> \u00b7 Property Intel portal</div>' +
      '<h1>Two pictures. Same four jobs.</h1>' +
      '<p class="lede">This portal distinguishes the <b>residence</b> from the <b>community</b>. Each has its own SAFE map \u2014 <b class="S">S</b>ecurity, <b class="A">A</b>ccess, <b class="F">F</b>ire, <b class="E">E</b>nvironment \u2014 because a responder arriving at 18775 Macalpine Loop is not working the same picture as the board looking at Highlands at Broken Top. Home explains the split. Residence (SAFE) and Community (SAFE) are the two maps.</p>' +
    '</div>';
  }
  function patrolNotesHTML(ctx) {
    return '<section class="hm-patrol" id="hm-patrol"><div class="hm-sec-h"><h2>Virtual Patrol</h2><span>Frames with a note</span>' +
      link(ctx, 'patrol', null, 'sp-act go', 'Open \u2192', '') +
      '</div><div id="hm-patrol-notes"></div></section>';
  }
  function scopeCardHTML(ctx, rec, kind) {
    var jobs = JOBS[rec.slug] || JOBS.residence;
    var landing = SCOPE_PAGE[rec.slug];
    return '<section class="hm-scope scope-' + kind + '">' +
      '<div class="hm-scope-h"><span class="scope-k">' + (kind === 'res' ? 'R' : 'C') + '</span><div><h2>' + (kind === 'res' ? 'Residence' : 'Community') + ' <i>SAFE</i></h2><b>' + esc(rec.name) + '</b><span>' + esc(rec.address) + '</span></div>' +
        link(ctx, landing, null, 'sp-act go', 'Open \u2192', '', rec.slug) + '</div>' +
      '<div class="hm-chips">' + SP.chipsHTML(rec, { build: false }) + '</div>' +
      pictureHTML({ R: rec }).replace('class="fig hm-fig"', 'class="fig hm-fig hm-fig-' + kind + '"') +
      '<div class="hm-scope-jobs">' + jobs.map(function (j) {
        return link(ctx, PAGE[j.c], null, 'job comp-' + j.c, '<span class="sp-k ' + j.c + '">' + j.c + '</span><b>' + esc(j.verb) + '</b>', '', rec.slug);
      }).join('') + '</div>' +
    '</section>';
  }

  var PORTAL = {
    a: function (ctx) {
      document.body.innerHTML =
        '<div class="pg-body"><div class="pg-main sp-scroll hm-main">' +
          portalHeroHTML() +
          '<div class="hm-scopes">' + scopeCardHTML(ctx, ctx.R, 'res') + scopeCardHTML(ctx, ctx.C, 'com') + '</div>' +
          patrolNotesHTML(ctx) +
          anatomyHTML() +
        '</div><aside class="pg-rail sp-scroll">' +
          '<div class="sec"><div class="sp-h">Who uses it</div>' + rolesHTML().replace('class="hm-roles"', 'class="hm-roles rail"') + '</div>' +
          '<div class="sec"><div class="sp-h">Residence activity</div>' + activityHTML({ R: ctx.R, layout: ctx.layout, theme: ctx.theme, inFrame: ctx.inFrame }) + '</div>' +
          '<div class="sec"><div class="sp-h">Community activity</div>' + activityHTML({ R: ctx.C, layout: ctx.layout, theme: ctx.theme, inFrame: ctx.inFrame }) + '</div>' +
        '</aside></div>';
    },
    b: function (ctx) {
      document.body.innerHTML = '<div class="wrap">' +
        portalHeroHTML() +
        '<div class="hm-scopes two-col">' + scopeCardHTML(ctx, ctx.R, 'res') + scopeCardHTML(ctx, ctx.C, 'com') + '</div>' +
        patrolNotesHTML(ctx) +
        anatomyHTML() + rolesHTML() +
      '</div>';
    },
    c: function (ctx) {
      document.body.innerHTML = '<div class="grid">' +
        '<div class="card-12"><section class="panel hm-hero-card">' + portalHeroHTML() + '</section></div>' +
        '<div class="card-6">' + scopeCardHTML(ctx, ctx.R, 'res') + '</div>' +
        '<div class="card-6">' + scopeCardHTML(ctx, ctx.C, 'com') + '</div>' +
        '<div class="card-12"><section class="panel"><div class="panel-b">' + patrolNotesHTML(ctx) + '</div></section></div>' +
        '<div class="card-8"><section class="panel"><div class="panel-b">' + anatomyHTML() + '</div></section></div>' +
        '<div class="card-4"><section class="panel"><div class="panel-b">' + rolesHTML() + '</div></section></div>' +
      '</div>';
    }
  };

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
