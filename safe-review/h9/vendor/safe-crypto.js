/* Shared unlock, ciphertext fetch, and review export for SAFE review sites.
   Per-lot settings come from review-config.js (window.SAFE_REVIEW_CONFIG),
   written by `safe review-build`. The template itself carries no lot data.
   The derived AES key is kept in sessionStorage so one unlock carries across
   pages on this origin. Ciphertext is loaded from d/ when served locally,
   or from cfg.data_live when hosted. */
(function (global) {
  'use strict';
  var CFG = global.SAFE_REVIEW_CONFIG || {};
  var SALT = CFG.salt || '';
  var ITER = CFG.iter || 600000;
  var CHECK = CFG.check || '';
  var LOT = String(CFG.lot_key || 'lot');
  var TEMPLATE = String(CFG.template || 'safe-review');
  var SS_KEY = 'safe-aes-v1:' + LOT;
  var HANDOFF_KEY = 'safe-aes-handoff-v1:' + LOT;
  var HANDOFF_MS = 60000;
  var NAME_KEY = 'safe-reviewer-name';
  function k(kind) { return 'safe:' + LOT + ':' + kind; }
  var ANS_KEY = k('answers');
  var PINS_KEY = k('camera-pins');
  var ZONES_KEY = k('zone-pins');
  var APPROVE_KEY = k('approve');
  var REG_KEYS = [k('regions'), 'nm-regions:' + LOT];
  var DATA_LOCAL = CFG.data_base || 'd/';
  var DATA_LIVE = CFG.data_live || '';
  var KEY = null;
  var LOT_INFO = null;
  // Build id written by review-build: every asset and ciphertext URL carries ?v=<build>, so a browser can never mix
  // one build's code with another build's data, and an open tab notices when a newer build is published.
  var BUILD = /^[0-9a-f]{6,64}$/.test(String(CFG.build || '')) ? String(CFG.build) : '';
  function ver(u) { return BUILD ? u + (u.indexOf('?') < 0 ? '?' : '&') + 'v=' + BUILD : u; }

  // Carry reviewer work saved under an older build's keys (names come from config).
  (function migrateKeys() {
    var legacy = CFG.legacy_keys || {};
    var map = { answers: ANS_KEY, camera_pins: PINS_KEY, zone_pins: ZONES_KEY, regions: REG_KEYS[0], reviewer_name: NAME_KEY };
    Object.keys(map).forEach(function (kind) {
      var old = legacy[kind];
      if (!old) return;
      try {
        if (!localStorage.getItem(map[kind]) && localStorage.getItem(old)) localStorage.setItem(map[kind], localStorage.getItem(old));
      } catch (e) {}
    });
  })();

  function b64(s) { return Uint8Array.from(atob(s), function (c) { return c.charCodeAt(0); }); }
  function tob64(u) {
    var s = '', i;
    u = new Uint8Array(u);
    for (i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function isLocal() { return !DATA_LIVE || /^(localhost|127\.0\.0\.1)$/.test(location.hostname); }
  function canPut() { return /^(localhost|127\.0\.0\.1)$/.test(location.hostname); }
  function dataUrl(name) { return ver(isLocal() ? (DATA_LOCAL + name) : (DATA_LIVE + name)); }

  var STALE = false;
  function showStale() {
    STALE = true;
    if (!global.document || document.getElementById('safe-stale')) return;
    var d = document.createElement('div');
    d.id = 'safe-stale';
    d.setAttribute('role', 'alert');
    d.style.cssText = 'position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:2147483000;background:#8a4b00;' +
      'color:#fff;padding:10px 16px;border-radius:8px;font:600 14px/1.4 system-ui,sans-serif;box-shadow:0 4px 18px rgba(0,0,0,.35)';
    d.textContent = 'This review was updated after this tab was opened. ';
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = 'Reload now';
    b.style.cssText = 'margin-left:10px;font:inherit;padding:4px 12px;border-radius:6px;border:0;cursor:pointer;color:#222;background:#fff';
    b.onclick = function () { location.reload(); };
    d.appendChild(b);
    (document.body || document.documentElement).appendChild(d);
  }
  // Re-read review-config.js past every cache; a different build id means this tab shows an older build.
  async function checkBuild() {
    if (!BUILD) return false;
    try {
      var r = await fetch('review-config.js?cb=' + Date.now(), { cache: 'no-store' });
      if (!r.ok) return false;
      var m = (await r.text()).match(/"build":\s*"([0-9a-f]+)"/);
      if (m && m[1] !== BUILD) { showStale(); return true; }
    } catch (e) {}
    return false;
  }
  (function watchBuild() {
    if (!BUILD || !global.document || !global.fetch) return;
    setTimeout(checkBuild, 4000);
    setInterval(checkBuild, 5 * 60 * 1000);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') checkBuild(); });
    global.addEventListener('focus', function () { checkBuild(); });
  })();

  async function derive(pw) {
    var base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: b64(SALT), iterations: ITER, hash: 'SHA-256' },
      base, { name: 'AES-GCM', length: 256 }, true, ['decrypt', 'encrypt']
    );
  }
  async function importRaw(raw) {
    return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, true, ['decrypt', 'encrypt']);
  }
  async function dec(buf) {
    if (!KEY) throw new Error('locked');
    var u = new Uint8Array(buf);
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv: u.slice(0, 12) }, KEY, u.slice(12));
  }
  async function verify() {
    try { await dec(b64(CHECK).buffer); } catch (e) { throw new Error('bad'); }
  }
  async function remember(key) {
    KEY = key;
    var raw = new Uint8Array(await crypto.subtle.exportKey('raw', key));
    try { sessionStorage.setItem(SS_KEY, tob64(raw)); } catch (e) {}
  }
  async function unlockWithPassword(pw) {
    var key = await derive(pw);
    var prev = KEY;
    KEY = key;
    try { await verify(); } catch (e) { KEY = prev; throw e; }
    await remember(key);
    return KEY;
  }
  function writeHandoff() {
    var raw;
    try { raw = sessionStorage.getItem(SS_KEY); } catch (e) { raw = null; }
    if (!raw) return false;
    try {
      localStorage.setItem(HANDOFF_KEY, JSON.stringify({ k: raw, exp: Date.now() + HANDOFF_MS }));
      return true;
    } catch (e) { return false; }
  }
  function consumeHandoff() {
    var raw, o;
    try { raw = localStorage.getItem(HANDOFF_KEY); } catch (e) { raw = null; }
    if (!raw) return null;
    try { localStorage.removeItem(HANDOFF_KEY); } catch (e) {}
    try { o = JSON.parse(raw); } catch (e) { return null; }
    if (!o || !o.k || typeof o.exp !== 'number' || Date.now() > o.exp) return null;
    try { sessionStorage.setItem(SS_KEY, o.k); } catch (e) {}
    return o.k;
  }
  function isNewTabUnlockHref(href) {
    if (!href) return false;
    try { return /(model3d|cameras|zones|nearmap-review)\.html$/i.test(new URL(href, location.href).pathname); }
    catch (e) { return /(model3d|cameras|zones|nearmap-review)\.html/i.test(String(href)); }
  }
  function onNewTabUnlockNavigate(ev) {
    var a = ev.target && ev.target.closest ? ev.target.closest('a[href]') : null;
    if (a && isNewTabUnlockHref(a.getAttribute('href') || a.href)) writeHandoff();
  }
  function bindHandoff() {
    document.addEventListener('mousedown', onNewTabUnlockNavigate, true);
    document.addEventListener('pointerdown', onNewTabUnlockNavigate, true);
    document.addEventListener('click', onNewTabUnlockNavigate, true);
    document.addEventListener('auxclick', onNewTabUnlockNavigate, true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindHandoff);
  else bindHandoff();

  async function unlockFromSession() {
    var raw;
    consumeHandoff();
    try { raw = sessionStorage.getItem(SS_KEY); } catch (e) { return false; }
    if (!raw) return false;
    try {
      KEY = await importRaw(b64(raw));
      await verify();
      return true;
    } catch (e) {
      KEY = null;
      try { sessionStorage.removeItem(SS_KEY); } catch (e2) {}
      return false;
    }
  }
  function sleep(ms) { return new Promise(function (res) { setTimeout(res, ms); }); }
  async function fetchDecOnce(name, opts, init) {
    var onProgress = opts && opts.onProgress;
    var r = await fetch(dataUrl(name), init);
    if (!r.ok) throw new Error('load ' + name);
    var total = parseInt(r.headers.get('content-length') || '0', 10) || 0;
    var buf;
    if (onProgress && r.body && r.body.getReader) {
      var reader = r.body.getReader();
      var chunks = [], rec = 0, step;
      while (true) {
        step = await reader.read();
        if (step.done) break;
        chunks.push(step.value);
        rec += step.value.length;
        onProgress(rec, total);
      }
      var out = new Uint8Array(rec), off = 0, i;
      for (i = 0; i < chunks.length; i++) { out.set(chunks[i], off); off += chunks[i].length; }
      buf = out.buffer;
    } else {
      buf = await r.arrayBuffer();
      if (onProgress) onProgress(buf.byteLength, total || buf.byteLength);
    }
    if (onProgress) onProgress(-1, total); // decrypting
    return dec(buf);
  }
  async function fetchDec(name, opts) {
    var init = {};
    if (isLocal()) init.cache = 'no-store';
    var last, attempt;
    for (attempt = 0; attempt < 3; attempt++) {
      try { return await fetchDecOnce(name, opts, init); }
      catch (e) {
        last = e;
        if (opts && opts.onProgress) opts.onProgress(0, 0);
        if (attempt < 2) await sleep(800 * (attempt + 1));
      }
    }
    throw last;
  }
  async function sealJson(obj) {
    var iv = crypto.getRandomValues(new Uint8Array(12));
    var ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, KEY, new TextEncoder().encode(JSON.stringify(obj)));
    return { enc: 'AES-GCM', v: 1, kdf: 'PBKDF2-SHA256', iter: ITER, salt: SALT, iv: tob64(iv), ct: tob64(ct) };
  }
  async function openSealed(env) {
    if (!env || env.enc !== 'AES-GCM') throw new Error('not sealed');
    var pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(env.iv) }, KEY, b64(env.ct));
    return JSON.parse(new TextDecoder().decode(pt));
  }
  function reviewerName() {
    try { return localStorage.getItem(NAME_KEY) || ''; } catch (e) { return ''; }
  }
  function setReviewerName(n) {
    try { localStorage.setItem(NAME_KEY, String(n || '')); } catch (e) {}
  }
  async function maybeOpen(raw) {
    if (!raw) return null;
    var obj;
    try { obj = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) { return null; }
    if (obj && obj.enc === 'AES-GCM') {
      try { return await openSealed(obj); } catch (e) { return null; }
    }
    return obj;
  }
  function regionsRaw() {
    var i, raw;
    for (i = 0; i < REG_KEYS.length; i++) {
      try { raw = localStorage.getItem(REG_KEYS[i]); } catch (e) { raw = null; }
      if (raw) return raw;
    }
    return null;
  }
  function stored(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  // Lot name and question-set identity live in the encrypted lot.bin part.
  async function lotInfo() {
    if (LOT_INFO) return LOT_INFO;
    try { LOT_INFO = JSON.parse(new TextDecoder().decode(await fetchDec('lot.bin'))); }
    catch (e) { LOT_INFO = {}; }
    return LOT_INFO;
  }
  async function applyLotName() {
    var info = await lotInfo();
    var name = info.display_name || '';
    if (!name) return info;
    var els = document.querySelectorAll('.lotname'), i;
    for (i = 0; i < els.length; i++) els[i].textContent = name;
    if (document.title.indexOf(name) !== 0) document.title = document.title.replace(/^SAFE\b/, name);
    return info;
  }
  async function sha256Hex(text) {
    var d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.prototype.map.call(new Uint8Array(d), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }
  // Export v2: the review content is sealed with the lot key (AES-GCM) and carries the
  // SHA-256 of its plaintext; `safe pass1 ingest-review` opens and checks it.
  async function exportReview() {
    var info = await lotInfo();
    var inner = {
      kind: 'safe-review-content',
      version: 2,
      lot: info.slug || null,
      question_set_version: info.question_set_version || null,
      question_set_sha256: info.question_set_sha256 || null,
      payload_sha256: info.payload_sha256 || null,
      exported: new Date().toISOString(),
      reviewer: reviewerName(),
      answers: await maybeOpen(stored(ANS_KEY)),
      pins: await maybeOpen(stored(PINS_KEY)),
      zones: await maybeOpen(stored(ZONES_KEY)),
      regions: await maybeOpen(regionsRaw()),
      approve_request: await maybeOpen(stored(APPROVE_KEY))
    };
    var text = JSON.stringify(inner);
    var doc = {
      kind: 'safe-review-export',
      version: 2,
      lot: inner.lot,
      exported: inner.exported,
      reviewer: inner.reviewer,
      sealed: true,
      sha256: await sha256Hex(text),
      envelope: await sealJson(inner)
    };
    var blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    var who = (doc.reviewer || 'review').replace(/[^\w.-]+/g, '_').slice(0, 40);
    a.href = URL.createObjectURL(blob);
    a.download = 'safe-review-export-' + who + '-' + doc.exported.slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
    return doc;
  }
  // The reviewer asks for Pass 1 approval; the pipeline decides (safe pass1 approve).
  async function requestApproval(note, counts) {
    var req = { requested_at: new Date().toISOString(), reviewer: reviewerName(), note: String(note || '').slice(0, 2000),
                counts: counts || null };
    localStorage.setItem(APPROVE_KEY, JSON.stringify(await sealJson(req)));
    return req;
  }
  function fmtBytes(n) {
    if (!n || n < 0) return '';
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(0) + ' KB';
    return (n / 1048576).toFixed(1) + ' MB';
  }
  function progressMsg(rec, total) {
    if (rec < 0) return 'Decrypting…';
    if (!total) return rec ? ('Downloading… ' + fmtBytes(rec)) : 'Downloading…';
    return 'Downloading… ' + fmtBytes(rec) + ' of ' + fmtBytes(total) + ' (' + Math.min(100, Math.round(100 * rec / total)) + '%)';
  }
  async function wireUnlock(opts) {
    opts = opts || {};
    var form = document.getElementById(opts.form || 'lockform');
    var pw = document.getElementById(opts.pw || 'pw');
    var btn = document.getElementById(opts.btn || 'unl');
    var err = document.getElementById(opts.err || 'err');
    var lock = document.getElementById(opts.lock || 'lock');
    async function ready() {
      if (lock) lock.style.display = 'none';
      applyLotName().catch(function () {});
      if (opts.onReady) await opts.onReady();
    }
    if (await unlockFromSession()) { await ready(); return true; }
    if (!form) return false;
    form.addEventListener('submit', async function (ev) {
      ev.preventDefault();
      if (err) err.textContent = '';
      if (btn) { btn.textContent = 'Unlocking…'; btn.disabled = true; }
      try {
        await unlockWithPassword(pw ? pw.value : '');
        if (pw) pw.value = '';
        await ready();
      } catch (e) {
        if (err) {
          err.textContent = e.message === 'bad'
            ? 'That passphrase did not work.'
            : ('Could not unlock (' + e.message + ').');
        }
        if (btn) { btn.textContent = 'Unlock'; btn.disabled = false; }
      }
    });
    return false;
  }

  global.SafeCrypto = {
    SALT: SALT, ITER: ITER, CHECK: CHECK, LOT_KEY: LOT, TEMPLATE: TEMPLATE,
    isLocal: isLocal, canPut: canPut, dataUrl: dataUrl, BUILD: BUILD, ver: ver, checkBuild: checkBuild,
    isStale: function () { return STALE; },
    getKey: function () { return KEY; },
    setKey: function (k2) { KEY = k2; },
    derive: derive, dec: dec, verify: verify,
    unlockWithPassword: unlockWithPassword,
    unlockFromSession: unlockFromSession,
    fetchDec: fetchDec, sealJson: sealJson, openSealed: openSealed, maybeOpen: maybeOpen,
    reviewerName: reviewerName, setReviewerName: setReviewerName,
    exportReview: exportReview, requestApproval: requestApproval, sha256Hex: sha256Hex, wireUnlock: wireUnlock, lotInfo: lotInfo, applyLotName: applyLotName,
    progressMsg: progressMsg,
    writeHandoff: writeHandoff, consumeHandoff: consumeHandoff,
    ANS_KEY: ANS_KEY, PINS_KEY: PINS_KEY, ZONES_KEY: ZONES_KEY, APPROVE_KEY: APPROVE_KEY, REG_KEYS: REG_KEYS
  };
})(window);

/* Display units. Lot data, JSON and method text stay metric; the viewer shows distances in feet and yards
   (e.g. "976 ft (325 yd)") and kilometres in miles. Areas (m²) are left as they are. Converted on render:
   SafeUnits.watch() rewrites distance values in page text, SVG labels and tooltips as nodes are added, except
   inside [data-metric] (method text) and form fields. Pure formatters are exported for templates and tests. */
(function (global) {
  'use strict';
  var FT = 1/0.3048, YD = 1/0.9144, MI = 1000/1609.344;
  function num(v) { return typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, '')); }
  function group(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function ftNum(m) { var f = num(m) * FT; return Math.abs(f) >= 10 ? group(Math.round(f)) : f.toFixed(1); }
  function ydNum(m) { var y = Math.round(num(m) * YD); return (y === 0 && num(m) > 0) ? '<1' : group(y); }
  function ftyd(m) { if (!isFinite(num(m))) return String(m); return ftNum(m) + ' ft (' + ydNum(m) + ' yd)'; }
  function ft(m) { return isFinite(num(m)) ? ftNum(m) + ' ft' : String(m); }
  function mi(km) {
    var x = num(km) * MI;
    if (!isFinite(x)) return String(km);
    return (Math.abs(x) < 10 ? x.toFixed(2) : group(Math.round(x))) + ' mi';
  }
  // value + unit as stored (unit "m" / "km" converts; anything else, e.g. "m²", is returned unchanged)
  function dist(v, unit) {
    var u = String(unit || '').trim();
    if (v === null || v === undefined || v === '') return '';
    if (u === 'm' || u === 'metres' || u === 'meters') return ftyd(v);
    if (u === 'km') return mi(v);
    return String(v) + (u ? ' ' + u : '');
  }
  var N = '(\\d[\\d,]*(?:\\.\\d+)?)';
  var TAIL = '(?![\\w²³/])';
  var RANGE2 = new RegExp(N + '\\s?(km|m)\\s?[–-]\\s?' + N + '\\s?\\2' + TAIL, 'g');   // 0.5m-2m
  var RANGE = new RegExp(N + '\\s?(?:[–-]|to)\\s?' + N + '\\s?(km|m)' + TAIL, 'g');     // 3–10 m, 2.5 to 4 m
  var ONE = new RegExp(N + '\\s?(km|m)' + TAIL, 'g');
  // inside brackets or after >/< (class names such as "(>2m)") feet alone read better than "ft (yd)"
  function tight(str, off, len) { return /[(<>≤≥]\s*$/.test(str.slice(Math.max(0, off - 2), off)) || str[off + len] === ')'; }
  function glued(str, off) { return off > 0 && /[\w.]/.test(str[off - 1]); }  // part of a token such as "gen6m"
  function rng(a, b, u, short) {
    if (u === 'km') return mi(a).replace(' mi', '') + '–' + mi(b);
    return ftNum(a) + '–' + ftNum(b) + ' ft' + (short ? '' : ' (' + ydNum(a) + '–' + ydNum(b) + ' yd)');
  }
  // rewrite every metric distance in free text ("129 m", "0.5m-2m", "3–10 m", "1.2 km")
  function prose(text) {
    var s = String(text);
    if (!/\d\s?k?m/.test(s)) return s;
    s = s.replace(RANGE2, function (all, a, u, b, off, str) {
      return glued(str, off) ? all : rng(a, b, u, tight(str, off, all.length));
    });
    s = s.replace(RANGE, function (all, a, b, u, off, str) {
      return glued(str, off) ? all : rng(a, b, u, tight(str, off, all.length));
    });
    s = s.replace(ONE, function (all, a, u, off, str) {
      if (glued(str, off)) return all;
      return u === 'km' ? mi(a) : (tight(str, off, all.length) ? ft(a) : ftyd(a));
    });
    return s;
  }
  var ATTRS = ['title', 'data-tip', 'aria-label'];
  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, INPUT: 1, SELECT: 1, OPTION: 1, CODE: 1 };
  function metric(el) { return !el || (el.closest && el.closest('[data-metric]')); }
  function convert(root) {
    if (!root) return;
    if (root.nodeType === 3) {
      var p = root.parentNode;
      if (p && !SKIP[p.nodeName] && !metric(p)) { var t = prose(root.nodeValue); if (t !== root.nodeValue) root.nodeValue = t; }
      return;
    }
    if (root.nodeType !== 1 || SKIP[root.nodeName] || metric(root)) return;
    var all = [root].concat(Array.prototype.slice.call(root.querySelectorAll('[title],[data-tip],[aria-label]')));
    all.forEach(function (el) {
      if (metric(el)) return;
      ATTRS.forEach(function (a) {
        var v = el.getAttribute && el.getAttribute(a);
        if (v) { var t = prose(v); if (t !== v) el.setAttribute(a, t); }
      });
    });
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), n;
    while ((n = w.nextNode())) convert(n);
  }
  var obs = null;
  function watch() {
    if (obs || !global.MutationObserver || !global.document) return;
    var start = function () {
      convert(document.body);
      obs = new MutationObserver(function (list) {
        list.forEach(function (m) {
          if (m.type === 'characterData') convert(m.target);
          else if (m.type === 'attributes') convert(m.target);
          else m.addedNodes.forEach(convert);
        });
      });
      obs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true,
        attributeFilter: ATTRS });
    };
    if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
  }
  global.SafeUnits = { ftyd: ftyd, ft: ft, mi: mi, dist: dist, prose: prose, convert: convert, watch: watch,
    FT: FT, YD: YD, MI: MI };
  watch();
})(window);
