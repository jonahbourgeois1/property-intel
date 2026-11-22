/* Passphrase helpers for the Lane 1 review directory.
   Derives a per-lot AES-GCM key (PBKDF2-SHA256, that lot's salt) and stores it
   as sessionStorage['safe-aes-v1:' + lot_key], the same slot the reviewer reads.
   Never logs the passphrase, salt, check token, or raw key. */
(function (global) {
  'use strict';
  var HANDOFF_MS = 60000;

  function b64(s) { return Uint8Array.from(atob(s), function (c) { return c.charCodeAt(0); }); }
  function tob64(u) {
    var s = '', i;
    u = new Uint8Array(u);
    for (i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
    return btoa(s);
  }
  function sessionName(lotKey) { return 'safe-aes-v1:' + String(lotKey || ''); }
  function handoffName(lotKey) { return 'safe-aes-handoff-v1:' + String(lotKey || ''); }

  function parseConfig(text) {
    var m = String(text || '').match(/=\s*(\{[\s\S]*\})\s*;?\s*$/);
    if (!m) throw new Error('config');
    return JSON.parse(m[1]);
  }

  async function derive(pw, saltB64, iter) {
    var base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: b64(saltB64), iterations: iter || 600000, hash: 'SHA-256' },
      base, { name: 'AES-GCM', length: 256 }, true, ['decrypt', 'encrypt']
    );
  }

  async function verify(key, checkB64) {
    var u = b64(checkB64);
    await crypto.subtle.decrypt({ name: 'AES-GCM', iv: u.slice(0, 12) }, key, u.slice(12));
  }

  async function remember(lotKey, key) {
    var raw = new Uint8Array(await crypto.subtle.exportKey('raw', key));
    try { sessionStorage.setItem(sessionName(lotKey), tob64(raw)); } catch (e) {}
  }

  function hasSessionKey(lotKey) {
    try { return !!sessionStorage.getItem(sessionName(lotKey)); } catch (e) { return false; }
  }

  function writeHandoff(lotKey) {
    var raw;
    try { raw = sessionStorage.getItem(sessionName(lotKey)); } catch (e) { raw = null; }
    if (!raw) return false;
    try {
      localStorage.setItem(handoffName(lotKey), JSON.stringify({ k: raw, exp: Date.now() + HANDOFF_MS }));
      return true;
    } catch (e) { return false; }
  }

  async function unlockConfig(pw, cfg) {
    if (!cfg || !cfg.lot_key || !cfg.salt || !cfg.check) throw new Error('config');
    var key = await derive(pw, cfg.salt, cfg.iter);
    try { await verify(key, cfg.check); } catch (e) { throw new Error('bad'); }
    await remember(cfg.lot_key, key);
    return cfg.lot_key;
  }

  function safeFromParam(value) {
    if (!value || typeof value !== 'string') return '';
    if (value.charAt(0) !== '/' || value.indexOf('//') === 0) return '';
    if (/[:\\]/.test(value) || value.indexOf('..') !== -1) return '';
    if (value.indexOf('/safe-review/') !== 0) return '';
    if (value.indexOf('/safe-review/dir') === 0) return '';
    return value;
  }

  function configUrl(lot, baseHref) {
    var href = (lot && (lot.href_local || lot.href_live)) || '';
    if (!href) return '';
    try { return new URL('review-config.js', new URL(href, baseHref || location.href)).href; }
    catch (e) { return String(href).replace(/\/?$/, '/') + 'review-config.js'; }
  }

  global.SafeUnlock = {
    parseConfig: parseConfig,
    unlockConfig: unlockConfig,
    remember: remember,
    hasSessionKey: hasSessionKey,
    writeHandoff: writeHandoff,
    sessionName: sessionName,
    safeFromParam: safeFromParam,
    configUrl: configUrl,
    HANDOFF_MS: HANDOFF_MS
  };
})(typeof window !== 'undefined' ? window : globalThis);
