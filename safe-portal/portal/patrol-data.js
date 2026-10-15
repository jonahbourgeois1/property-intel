/*
  safe-portal/portal/patrol-data.js — Jones virtual patrol for the SAFE portal.
  Reads scan-list / scan-patrol and the records CDN. The property password
  stays in sessionStorage for this visit. Writes only through scan-patrol.
*/
(function () {
  'use strict';
  var EXEC = 'https://script.google.com/macros/s/AKfycbzHkj4fNRBJ7839babxL2Gp1A2ka9Em05rOQRZUNg_X0lMrOAMEKtEXEXxuU9_u7iKERA/exec';
  var CDN = 'https://d1h1on7f1v1lpy.cloudfront.net/';
  var HUB = '6de88883bfd4a8349a901c54611ed9d7';
  var PASS_KEY = 'safe-portal-pass';
  var RATE = { bronze: 12, silver: 24, gold: 48, platinum: 96 };

  function pass() { try { return sessionStorage.getItem(PASS_KEY) || ''; } catch (e) { return ''; } }
  function setPass(value) { try { sessionStorage.setItem(PASS_KEY, value || ''); } catch (e) {} }

  function callApi(params, timeoutMs) {
    var q = new URLSearchParams();
    Object.keys(params).forEach(function (k) {
      if (params[k] !== undefined && params[k] !== null && params[k] !== '') q.set(k, params[k]);
    });
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, timeoutMs || 45000);
    return fetch(EXEC + '?' + q.toString(), { signal: ctrl.signal, redirect: 'follow' }).then(function (r) {
      clearTimeout(timer);
      if (!r.ok) throw new Error('The request failed (' + r.status + ')');
      return r.text();
    }).then(function (text) {
      try { return JSON.parse(text); }
      catch (e) { throw new Error('The sign-in service did not answer. Try again.'); }
    }).catch(function (e) {
      clearTimeout(timer);
      if (e && e.name === 'AbortError') throw new Error('The request timed out. Try again.');
      throw e;
    });
  }

  function postApi(body) {
    return fetch(EXEC + '?route=' + encodeURIComponent(body.route || ''), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    }).then(function (r) {
      if (!r.ok) throw new Error('The request failed (' + r.status + ')');
      return r.json();
    });
  }

  function jpegUrl(key) { return CDN + String(key || '').replace(/\.json$/, '.jpg'); }
  function jsonUrl(key) { return CDN + String(key || '').replace(/\.jpg$/, '.json'); }

  function when(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString('en-US', {
      timeZone: 'America/Chicago',
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
    });
  }

  function list() {
    return callApi({ route: 'scan-list', hub: HUB, pass: pass() });
  }

  function check() {
    return callApi({ route: 'scan-patrol', hub: HUB, pass: pass() }, 60000);
  }

  function cdnJson(key) {
    return fetch(CDN + String(key || '').replace(/^\//, '')).then(function (r) {
      if (!r.ok) return null;
      return r.json();
    }).catch(function () { return null; });
  }

  function keysFor(cam) {
    if (cam.keys && cam.keys.length) return cam.keys.slice();
    if (cam.latest && cam.latest.key) return [cam.latest.key];
    return [];
  }

  function pool(items, limit, worker) {
    var cursor = 0;
    var running = [];
    function next() {
      if (cursor >= items.length) return Promise.resolve();
      var item = items[cursor++];
      return worker(item).then(next, next);
    }
    var n = Math.min(limit, items.length);
    for (var i = 0; i < n; i++) running.push(next());
    return Promise.all(running);
  }

  function collect(cameras, mode, limit, onProgress, maxLook) {
    var jobs = [];
    var lists = cameras.map(keysFor);
    var guard = 0;
    while (guard < 20000) {
      var any = false;
      for (var c = 0; c < cameras.length; c++) {
        if (!lists[c].length) continue;
        jobs.push({ key: lists[c].shift(), name: cameras[c].name || cameras[c].device_id, device_id: String(cameras[c].device_id) });
        any = true;
        if (maxLook && jobs.length >= maxLook) { any = false; break; }
      }
      if (!any) break;
      guard++;
    }
    var found = [];
    var seen = 0;
    var stop = false;
    return pool(jobs, 24, function (job) {
      if (stop) return Promise.resolve();
      return fetch(jsonUrl(job.key)).then(function (r) {
        if (!r.ok) return null;
        return r.json();
      }).then(function (obj) {
        seen++;
        if (onProgress && (seen === 1 || seen % 40 === 0)) onProgress(seen, jobs.length);
        if (!obj || stop) return;
        var description = String(obj.description || '');
        var reviewed = String(obj.reviewed_at || '');
        var keep = mode === 'notes' ? !!description : !!reviewed;
        if (!keep) return;
        found.push({
          key: job.key,
          name: obj.name || job.name,
          device_id: String(obj.device_id || job.device_id),
          requested_at: obj.requested_at || '',
          description: description,
          reviewed_at: reviewed
        });
        if (limit && found.length >= limit) stop = true;
      }).catch(function () {});
    }).then(function () {
      found.sort(function (a, b) { return String(b.requested_at).localeCompare(String(a.requested_at)); });
      return limit ? found.slice(0, limit) : found;
    });
  }

  function patrolGet() {
    return callApi({ route: 'scan-patrol', hub: HUB, pass: pass() });
  }

  function patrolSave(qa, times) {
    return postApi({ route: 'scan-patrol', hub: HUB, pass: pass(), qa: qa, times: times });
  }

  function hm(mins) {
    var h = Math.floor(mins / 60);
    var m = mins % 60;
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  }

  function windowSlots(start, end) {
    var slots = [];
    var m;
    if (end > start) {
      for (m = start; m < end; m += 5) slots.push(m);
    } else {
      for (m = start; m < 1440; m += 5) slots.push(m);
      for (m = 0; m < end; m += 5) slots.push(m);
    }
    return slots;
  }

  function evenTimes(slots, count) {
    if (!count || count > slots.length) return null;
    var out = [];
    for (var i = 0; i < count; i++) out.push(hm(slots[Math.floor(i * slots.length / count)]));
    return out;
  }

  function presets(qa) {
    var rate = RATE[qa] || 0;
    var cadence = { bronze: 'every 2 hours', silver: 'every hour', gold: 'every 30 min', platinum: 'every 15 min' };
    var evening = rate > 60
      ? { id: 'evening', name: 'Evening', detail: '4:00–12:00', start: 16 * 60, end: 24 * 60 }
      : { id: 'evening', name: 'Evening', detail: '5:00–10:00', start: 17 * 60, end: 22 * 60 };
    return [
      { id: 'all', name: 'All day', detail: cadence[qa] || '', start: 0, end: 24 * 60 },
      { id: 'work', name: 'Work hours', detail: '8:00–5:00', start: 8 * 60, end: 17 * 60 },
      evening
    ];
  }

  function presetTimes(preset, qa) {
    return evenTimes(windowSlots(preset.start, preset.end), RATE[qa] || 0);
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  var CACHE_KEY = 'safe-portal-patrol-cache';
  var STAMP_KEY = 'safe-portal-patrol-stamp';
  var WARM_KEY = 'safe-portal-patrol-warming';
  var warmPromise = null;

  function peek() {
    try {
      var raw = sessionStorage.getItem(CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function writeCache(cache) {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(cache));
      sessionStorage.setItem(STAMP_KEY, String(Date.now()));
    } catch (e) {}
  }

  // The patrol page lives in an iframe. sessionStorage is shared with the
  // portal frame, but a storage event is not reliable here, so poll the stamp.
  function watch(cb) {
    var last = '';
    try { last = sessionStorage.getItem(STAMP_KEY) || ''; } catch (e) {}
    setInterval(function () {
      var stamp = '';
      try { stamp = sessionStorage.getItem(STAMP_KEY) || ''; } catch (e) {}
      if (!stamp || stamp === last) return;
      last = stamp;
      var next = peek();
      if (next) cb(next);
    }, 400);
  }

  function warming() {
    try { return sessionStorage.getItem(WARM_KEY) === '1'; } catch (e) { return false; }
  }

  function markWarming(on) {
    try {
      if (on) sessionStorage.setItem(WARM_KEY, '1');
      else sessionStorage.removeItem(WARM_KEY);
    } catch (e) {}
  }

  function whenReady(cb) {
    var cur = peek();
    if (cur) { cb(cur); return; }
    var timer = setInterval(function () {
      var next = peek();
      if (!next) return;
      clearInterval(timer);
      window.removeEventListener('storage', onStore);
      cb(next);
    }, 400);
    function onStore(e) {
      if (e.key !== CACHE_KEY) return;
      var next = peek();
      if (!next) return;
      clearInterval(timer);
      window.removeEventListener('storage', onStore);
      cb(next);
    }
    window.addEventListener('storage', onStore);
  }

  function ingest(cameras, onProgress) {
    var jobs = [];
    var lists = cameras.map(keysFor);
    var guard = 0;
    while (guard < 20000) {
      var any = false;
      for (var c = 0; c < cameras.length; c++) {
        if (!lists[c].length) continue;
        jobs.push({ key: lists[c].shift(), name: cameras[c].name || cameras[c].device_id, device_id: String(cameras[c].device_id) });
        any = true;
      }
      if (!any) break;
      guard++;
    }
    var reviewed = [];
    var notes = [];
    var seen = 0;
    return pool(jobs, 24, function (job) {
      return fetch(jsonUrl(job.key)).then(function (r) {
        if (!r.ok) return null;
        return r.json();
      }).then(function (obj) {
        seen++;
        if (onProgress && (seen === 1 || seen % 40 === 0)) onProgress(seen, jobs.length);
        if (!obj) return;
        var description = String(obj.description || '');
        var reviewedAt = String(obj.reviewed_at || '');
        if (!reviewedAt) return;
        var frame = {
          key: job.key,
          name: obj.name || job.name,
          device_id: String(obj.device_id || job.device_id),
          requested_at: obj.requested_at || '',
          description: description,
          reviewed_at: reviewedAt
        };
        reviewed.push(frame);
        if (description) notes.push(frame);
      }).catch(function () {});
    }).then(function () {
      reviewed.sort(function (a, b) { return String(b.requested_at).localeCompare(String(a.requested_at)); });
      notes.sort(function (a, b) { return String(b.requested_at).localeCompare(String(a.requested_at)); });
      return { reviewed: reviewed, notes: notes };
    });
  }

  function preload(frames) {
    var seen = {};
    var jobs = [];
    (frames || []).forEach(function (frame) {
      if (!frame || !frame.key || seen[frame.key]) return;
      seen[frame.key] = true;
      jobs.push(frame);
    });
    return pool(jobs, 6, function (frame) {
      return new Promise(function (resolve) {
        var img = new Image();
        img.onload = function () { resolve(); };
        img.onerror = function () { resolve(); };
        img.src = jpegUrl(frame.key);
      });
    });
  }

  function pack(listData, patrol, frames) {
    var known = {};
    var cameras = (listData.cameras || []).map(function (cam) {
      var id = String(cam.device_id);
      known[id] = true;
      return { device_id: id, name: cam.name || id };
    });
    var times = {};
    Object.keys((patrol && patrol.times) || {}).forEach(function (id) {
      if (known[id]) times[id] = (patrol.times[id] || []).slice();
    });
    return {
      name: listData.name || '',
      cameras: cameras,
      qa: patrol && patrol.saved ? (patrol.qa || 'bronze') : 'bronze',
      times: times,
      saved: !!(patrol && patrol.saved),
      zone: (patrol && patrol.zone) || 'America/Chicago',
      reviewed: frames.reviewed || [],
      notes: frames.notes || []
    };
  }

  function camerasFromState(state, patrol) {
    var prev = (state && state.previous) || {};
    var times = (patrol && patrol.times) || {};
    var ids = {};
    Object.keys(prev).forEach(function (id) { if (/^[0-9]{1,16}$/.test(id)) ids[id] = prev[id]; });
    Object.keys(times).forEach(function (id) { if (/^[0-9]{1,16}$/.test(id) && !ids[id]) ids[id] = ''; });
    return Object.keys(ids).map(function (id) {
      return { device_id: id, name: id, latest: String(ids[id] || '') };
    });
  }

  function nameCameras(cameras) {
    return pool(cameras, 12, function (cam) {
      if (!cam.latest) return Promise.resolve();
      return cdnJson(jsonUrl(cam.latest).slice(CDN.length)).then(function (obj) {
        if (obj && obj.name) cam.name = String(obj.name);
      });
    }).then(function () { return cameras; });
  }

  function scheduleCache(patrol, cameras) {
    var known = {};
    var times = {};
    cameras.forEach(function (cam) { known[String(cam.device_id)] = true; });
    Object.keys((patrol && patrol.times) || {}).forEach(function (id) {
      if (known[id]) times[id] = (patrol.times[id] || []).slice();
    });
    return {
      name: (patrol && patrol.name) || '',
      cameras: cameras.map(function (cam) {
        return { device_id: String(cam.device_id), name: cam.name || String(cam.device_id) };
      }),
      qa: patrol && patrol.saved ? (patrol.qa || 'bronze') : 'bronze',
      times: times,
      saved: !!(patrol && patrol.saved),
      zone: (patrol && patrol.zone) || 'America/Chicago',
      reviewed: [],
      notes: []
    };
  }

  // Newest picture first. Each stored frame points at the one before it, so the
  // page can show the schedule and the latest pictures without asking Apps
  // Script to list every file.
  function walkHistory(cameras, onBatch) {
    var reviewed = [];
    var notes = [];
    var pending = cameras.map(function (cam) { return cam.latest || ''; });
    var seen = {};
    function wave() {
      var batch = [];
      for (var i = 0; i < pending.length; i++) {
        var key = jsonUrl(pending[i]).slice(CDN.length);
        pending[i] = '';
        if (!key || seen[key]) continue;
        seen[key] = true;
        batch.push({ index: i, key: key, cam: cameras[i] });
      }
      if (!batch.length) return Promise.resolve();
      return pool(batch, 24, function (job) {
        return cdnJson(job.key).then(function (obj) {
          if (!obj) return;
          var prev = String(obj.previous || '');
          if (prev.indexOf('camera-scans/') === 0) pending[job.index] = prev;
          if (!obj.reviewed_at) return;
          var frame = {
            key: job.key,
            name: obj.name || job.cam.name,
            device_id: String(obj.device_id || job.cam.device_id),
            requested_at: obj.requested_at || '',
            description: String(obj.description || ''),
            reviewed_at: String(obj.reviewed_at || '')
          };
          reviewed.push(frame);
          if (frame.description) notes.push(frame);
        });
      }).then(function () {
        reviewed.sort(function (a, b) { return String(b.requested_at).localeCompare(String(a.requested_at)); });
        notes.sort(function (a, b) { return String(b.requested_at).localeCompare(String(a.requested_at)); });
        onBatch(reviewed.slice(), notes.slice());
        return wave();
      });
    }
    return wave().then(function () { return { reviewed: reviewed, notes: notes }; });
  }

  function warm(patrolData) {
    if (warmPromise) return warmPromise;
    markWarming(true);
    var patrolPromise = (patrolData && patrolData.ok && patrolData.times)
      ? Promise.resolve(patrolData)
      : cdnJson('camera-scan-patrol/' + HUB + '.json').then(function (obj) {
        if (obj && obj.times) {
          return {
            ok: true,
            saved: !!obj.qa,
            qa: obj.qa || '',
            times: obj.times,
            zone: 'America/Chicago',
            name: ''
          };
        }
        return patrolGet();
      });
    warmPromise = patrolPromise.then(function (patrol) {
      if (!patrol || !patrol.ok) {
        var err = new Error((patrol && patrol.error) || 'Could not open the property');
        err.auth = true;
        throw err;
      }
      return cdnJson('camera-scan-state/' + HUB + '.json').then(function (state) {
        if (!state || !state.previous) {
          return list().then(function (data) {
            if (!data || !data.ok) {
              var err = new Error((data && data.error) || 'Could not open the property');
              err.auth = true;
              throw err;
            }
            return ingest(data.cameras || []).then(function (frames) {
              var cache = pack(data, patrol, frames);
              writeCache(cache);
              markWarming(false);
              preload((cache.reviewed || []).slice(0, 24));
              return cache;
            });
          });
        }
        var cameras = camerasFromState(state, patrol);
        return nameCameras(cameras).then(function () {
          var cache = scheduleCache(patrol, cameras);
          writeCache(cache);
          return walkHistory(cameras, function (reviewed, notes) {
            cache.reviewed = reviewed;
            cache.notes = notes;
            writeCache(cache);
          }).then(function () {
            markWarming(false);
            preload((cache.reviewed || []).slice(0, 24));
            return cache;
          });
        });
      });
    }).catch(function (err) {
      markWarming(false);
      warmPromise = null;
      throw err;
    });
    return warmPromise;
  }

  function openViewer(frames, index) {
    var list = frames || [];
    if (!list.length) return;
    var i = index || 0;
    if (i < 0) i = 0;
    if (i >= list.length) i = list.length - 1;
    var old = document.getElementById('patrol-view');
    if (old) old.remove();
    var root = document.createElement('div');
    root.id = 'patrol-view';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'Patrol picture');
    root.innerHTML = '<button type="button" class="pv-nav" id="pv-prev" aria-label="Previous picture">\u2039</button>' +
      '<figure class="pv-fig"><img id="pv-img" alt=""><figcaption><b id="pv-name"></b><span id="pv-when"></span><p id="pv-note"></p></figcaption></figure>' +
      '<button type="button" class="pv-nav" id="pv-next" aria-label="Next picture">\u203a</button>' +
      '<button type="button" id="pv-close">Close</button>';
    document.body.appendChild(root);
    function paint() {
      var frame = list[i];
      root.querySelector('#pv-img').src = jpegUrl(frame.key);
      root.querySelector('#pv-name').textContent = frame.name || '';
      root.querySelector('#pv-when').textContent = when(frame.requested_at);
      var note = root.querySelector('#pv-note');
      note.textContent = frame.description || 'Nothing noted';
      note.className = frame.description ? '' : 'quiet';
      root.querySelector('#pv-prev').hidden = list.length < 2;
      root.querySelector('#pv-next').hidden = list.length < 2;
    }
    function step(delta) {
      i = (i + delta + list.length) % list.length;
      paint();
    }
    function close() {
      document.removeEventListener('keydown', onKey);
      root.remove();
    }
    function onKey(ev) {
      if (ev.key === 'Escape') close();
      else if (ev.key === 'ArrowRight') step(1);
      else if (ev.key === 'ArrowLeft') step(-1);
    }
    root.querySelector('#pv-prev').onclick = function (ev) { ev.stopPropagation(); step(-1); };
    root.querySelector('#pv-next').onclick = function (ev) { ev.stopPropagation(); step(1); };
    root.querySelector('#pv-close').onclick = function (ev) { ev.stopPropagation(); close(); };
    root.onclick = function (ev) { if (ev.target === root) close(); };
    document.addEventListener('keydown', onKey);
    paint();
    root.querySelector('#pv-close').focus();
  }

  function paintHomeNotes(box, notes, openPage) {
    var top = (notes || []).slice(0, 8);
    if (!top.length) {
      box.innerHTML = '<p class="empty">No notes yet. Quiet reviews stay off this list.</p>';
      return;
    }
    box.innerHTML = '<div class="hm-note-grid">' + top.map(function (frame) {
      return '<button type="button" class="hm-note"><img alt="" src="' + esc(jpegUrl(frame.key)) + '"><span><b>' + esc(frame.name) + '</b><i>' + esc(when(frame.requested_at)) + '</i><em>' + esc(frame.description) + '</em></span></button>';
    }).join('') + '</div>';
    Array.prototype.forEach.call(box.querySelectorAll('.hm-note'), function (btn, index) {
      var img = btn.querySelector('img');
      if (img) {
        img.onclick = function (ev) {
          ev.stopPropagation();
          openViewer(top, index);
        };
      }
      btn.onclick = function () { if (openPage) openPage(); };
    });
  }

  function fillHome(box, openPage) {
    if (!box) return;
    if (!pass()) {
      box.innerHTML = '<p class="empty">Enter the property password to see patrol notes.</p>';
      return;
    }
    watch(function (next) { paintHomeNotes(box, next.notes, openPage); });
    var cache = peek();
    if (cache) { paintHomeNotes(box, cache.notes, openPage); return; }
    box.innerHTML = '<p class="empty">Reading notes…</p>';
    var apply = function (next) { paintHomeNotes(box, next.notes, openPage); };
    if (warming()) {
      whenReady(apply);
      setTimeout(function () {
        if (peek() || warming()) return;
        warm().then(apply).catch(function (e) {
          box.innerHTML = '<p class="empty">' + esc(e.message) + '</p>';
        });
      }, 4000);
      return;
    }
    warm().then(apply).catch(function (e) {
      box.innerHTML = '<p class="empty">' + esc(e.message) + '</p>';
    });
  }

  window.SafePatrol = {
    HUB: HUB,
    RATE: RATE,
    pass: pass,
    setPass: setPass,
    list: list,
    check: check,
    collect: collect,
    patrolGet: patrolGet,
    patrolSave: patrolSave,
    presets: presets,
    presetTimes: presetTimes,
    jpegUrl: jpegUrl,
    when: when,
    peek: peek,
    writeCache: writeCache,
    watch: watch,
    warming: warming,
    whenReady: whenReady,
    warm: warm,
    fillHome: fillHome,
    openViewer: openViewer
  };
})();
