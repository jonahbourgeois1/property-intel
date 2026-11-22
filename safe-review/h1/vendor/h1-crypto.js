/* Shared unlock, ciphertext fetch, and review export for the H1 reviewer.
   The derived AES key is kept in sessionStorage so one unlock carries across
   pages on this origin. Ciphertext is loaded from d/ when served locally,
   or from the records review path when hosted. */
(function (global) {
  'use strict';
  var SALT = 'zSXnotE4tAr80QXNMHbJEw==';
  var ITER = 600000;
  var CHECK = '4Lj1EQdTVKf8yTbYoE5iTE1CWT898C4PXJzqmlVo6oDk83ZSEd0=';
  var SS_KEY = 'safe-h1-aes-v1';
  var HANDOFF_KEY = 'safe-h1-aes-handoff-v1';
  var HANDOFF_MS = 60000;
  var NAME_KEY = 'h1-reviewer-name';
  var ANS_KEY = 'h1-review-answers';
  var PINS_KEY = 'h1-camera-pins';
  var ZONES_KEY = 'h1-zone-pins';
  var REG_KEYS = ['h1-regions', 'nm-regions:h1'];
  var DATA_LIVE = 'https://d1h1on7f1v1lpy.cloudfront.net/review/d9f759d7351db3886c79dd689c41e3c0/h1/';
  var KEY = null;

  function b64(s) { return Uint8Array.from(atob(s), function (c) { return c.charCodeAt(0); }); }
  function tob64(u) {
    var s = '', i;
    u = new Uint8Array(u);
    for (i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function isLocal() { return /^(localhost|127\.0\.0\.1)$/.test(location.hostname); }
  function canPut() { return isLocal(); }
  function dataUrl(name) { return isLocal() ? ('d/' + name) : (DATA_LIVE + name); }

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
    try {
      for (i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf('nm-regions:') === 0) return localStorage.getItem(k);
      }
    } catch (e) {}
    return null;
  }
  async function exportReview() {
    var answers = await maybeOpen((function () { try { return localStorage.getItem(ANS_KEY); } catch (e) { return null; } })());
    var pins = await maybeOpen((function () { try { return localStorage.getItem(PINS_KEY); } catch (e) { return null; } })());
    var zones = await maybeOpen((function () { try { return localStorage.getItem(ZONES_KEY); } catch (e) { return null; } })());
    var regions = await maybeOpen(regionsRaw());
    var doc = {
      kind: 'h1-review-export',
      version: 1,
      exported: new Date().toISOString(),
      reviewer: reviewerName(),
      answers: answers,
      pins: pins,
      zones: zones,
      regions: regions
    };
    var blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    var who = (doc.reviewer || 'review').replace(/[^\w.-]+/g, '_').slice(0, 40);
    a.href = URL.createObjectURL(blob);
    a.download = 'h1-review-export-' + who + '-' + doc.exported.slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
    return doc;
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

  global.H1Crypto = {
    SALT: SALT, ITER: ITER, CHECK: CHECK,
    isLocal: isLocal, canPut: canPut, dataUrl: dataUrl,
    getKey: function () { return KEY; },
    setKey: function (k) { KEY = k; },
    derive: derive, dec: dec, verify: verify,
    unlockWithPassword: unlockWithPassword,
    unlockFromSession: unlockFromSession,
    fetchDec: fetchDec, sealJson: sealJson, openSealed: openSealed, maybeOpen: maybeOpen,
    reviewerName: reviewerName, setReviewerName: setReviewerName,
    exportReview: exportReview, wireUnlock: wireUnlock,
    progressMsg: progressMsg,
    writeHandoff: writeHandoff, consumeHandoff: consumeHandoff,
    ANS_KEY: ANS_KEY, PINS_KEY: PINS_KEY, ZONES_KEY: ZONES_KEY, REG_KEYS: REG_KEYS
  };
})(window);
