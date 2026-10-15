/*
  safe-portal/portal/portal-patrol.js — Virtual Patrol page.
  Opens on the 24-hour schedule. Live Feed is every camera at once, with
  clips on the right. Images and notes stay one camera at a time.
*/
(function () {
  'use strict';
  var SP = window.SafePatrol;
  var state = {
    tab: 'schedule',
    cameras: [],
    qa: 'bronze',
    times: {},
    saved: false,
    zone: 'America/Chicago',
    reviewed: [],
    notes: [],
    editId: '',
    imageId: '',
    noteId: '',
    notePicked: false,
    painted: false
  };

  function el(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function setStatus(text) {
    var node = el('patrol-status');
    if (node) node.textContent = text || '';
  }
  function showGate(msg) {
    el('gate').classList.add('visible');
    var err = el('gate-err');
    if (msg) { err.textContent = msg; err.classList.add('visible'); }
    else { err.textContent = ''; err.classList.remove('visible'); }
  }
  function hideGate() { el('gate').classList.remove('visible'); }

  function minutes(mark) {
    var m = String(mark || '').match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    return Number(m[1]) * 60 + Number(m[2]);
  }

  function hourLabel(h) {
    if (h === 0 || h === 24) return '12a';
    if (h === 12) return '12p';
    return h < 12 ? h + 'a' : (h - 12) + 'p';
  }

  function used() {
    var n = 0;
    Object.keys(state.times).forEach(function (id) { n += (state.times[id] || []).length; });
    return n;
  }

  function poolSize() { return (SP.RATE[state.qa] || 0) * state.cameras.length; }

  function cameraName(id) {
    for (var i = 0; i < state.cameras.length; i++) {
      if (String(state.cameras[i].device_id) === String(id)) return state.cameras[i].name || id;
    }
    return id;
  }

  function countFor(frames, id) {
    var n = 0;
    frames.forEach(function (frame) { if (String(frame.device_id) === String(id)) n++; });
    return n;
  }

  function fillSelect(select, frames, current, allLabel) {
    var all = '';
    if (allLabel) {
      all = '<option value="*"' + (current === '*' ? ' selected' : '') + '>' + esc(allLabel) + ' · ' + frames.length + '</option>';
    }
    var html = state.cameras.map(function (cam) {
      var id = String(cam.device_id);
      var n = countFor(frames, id);
      var label = (cam.name || id) + (n ? ' · ' + n : '');
      return '<option value="' + esc(id) + '"' + (id === current ? ' selected' : '') + '>' + esc(label) + '</option>';
    }).join('');
    select.innerHTML = all + html || '<option value="">No cameras</option>';
  }

  function renderChart() {
    var labels = [];
    var h;
    for (h = 0; h <= 24; h += 3) labels.push('<span>' + hourLabel(h) + '</span>');
    var rows = state.cameras.map(function (cam) {
      var id = String(cam.device_id);
      var marks = (state.times[id] || []).map(function (mark) {
        var mins = minutes(mark);
        if (mins == null) return '';
        var left = (mins / 1440) * 100;
        return '<i class="mark" style="left:' + left + '%" title="' + esc(mark) + '"></i>';
      }).join('');
      return '<button type="button" class="day' + (id === state.editId ? ' on' : '') + '" data-id="' + esc(id) + '"><span>' + esc(cam.name || id) + '</span><span class="track">' + marks + '</span></button>';
    }).join('');
    el('chart').innerHTML =
      '<div class="axis"><span></span><div class="ticks">' + labels.join('') + '</div></div>' +
      rows;
    Array.prototype.forEach.call(el('chart').querySelectorAll('.day'), function (btn) {
      btn.onclick = function () {
        state.editId = btn.getAttribute('data-id');
        renderSchedule();
      };
    });
  }

  function renderEditor() {
    if (!state.cameras.length) {
      el('editor').innerHTML = '';
      return;
    }
    if (!state.editId) state.editId = String(state.cameras[0].device_id);
    var mine = (state.times[state.editId] || []).slice().sort();
    var options = state.cameras.map(function (cam) {
      var id = String(cam.device_id);
      var n = (state.times[id] || []).length;
      return '<option value="' + esc(id) + '"' + (id === state.editId ? ' selected' : '') + '>' + esc((cam.name || id) + ' · ' + n) + '</option>';
    }).join('');
    el('editor').innerHTML =
      '<label for="edit-cam">Edit one camera</label>' +
      '<select id="edit-cam">' + options + '</select>' +
      '<div class="chips" id="edit-chips"></div>' +
      '<div class="add"><input id="edit-time" type="time" step="300" aria-label="Review time"><button type="button" id="edit-add">Add</button></div>';
    var chips = el('edit-chips');
    mine.forEach(function (mark) {
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.textContent = mark + ' ×';
      chip.onclick = function () {
        var next = mine.filter(function (t) { return t !== mark; });
        if (next.length) state.times[state.editId] = next;
        else delete state.times[state.editId];
        setStatus('');
        renderSchedule();
      };
      chips.appendChild(chip);
    });
    el('edit-cam').onchange = function () {
      state.editId = el('edit-cam').value;
      renderSchedule();
    };
    el('edit-add').onclick = function () {
      var m = String(el('edit-time').value || '').match(/^(\d{1,2}):(\d{2})/);
      if (!m || Number(m[2]) % 5 !== 0) { setStatus('Use a 5-minute mark, such as 7:00 or 7:05.'); return; }
      var hm = (m[1].length === 1 ? '0' : '') + m[1] + ':' + m[2];
      var have = state.times[state.editId] || [];
      if (have.indexOf(hm) !== -1) { setStatus(hm + ' is already on this camera.'); return; }
      if (used() >= poolSize()) { setStatus('The budget is full. Remove a time or raise the level.'); return; }
      state.times[state.editId] = have.concat([hm]);
      setStatus('');
      renderSchedule();
    };
  }

  function renderSchedule() {
    var qa = el('qa');
    qa.innerHTML = '';
    ['bronze', 'silver', 'gold', 'platinum'].forEach(function (level) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = state.qa === level ? 'on' : '';
      b.textContent = level.charAt(0).toUpperCase() + level.slice(1) + ' · ' + SP.RATE[level] + '/camera';
      b.onclick = function () { state.qa = level; renderSchedule(); };
      qa.appendChild(b);
    });
    var presets = el('presets');
    presets.innerHTML = '';
    SP.presets(state.qa).forEach(function (preset) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = preset.name + ' · ' + preset.detail;
      b.onclick = function () { applyPreset(preset); };
      presets.appendChild(b);
    });
    var placed = used();
    var pool = poolSize();
    el('pool').textContent = state.cameras.length
      ? (placed + ' of ' + pool + ' reviews placed' + (placed > pool ? '. Remove times or raise the level.' : ''))
      : '';
    el('sched-note').textContent = state.saved
      ? 'This schedule replaces Scan hours. The same times repeat every day (' + state.zone + ').'
      : 'Scan hours on the sheet keep running until you save. Times use ' + state.zone + '.';
    renderChart();
    renderEditor();
  }

  function frameCard(frame, index) {
    var note = frame.description
      ? '<span class="note">' + esc(frame.description) + '</span>'
      : '<span class="note quiet">Nothing noted</span>';
    return '<button type="button" class="shot" data-i="' + index + '"><img alt="" src="' + esc(SP.jpegUrl(frame.key)) + '"><span class="cap"><b>' + esc(SP.when(frame.requested_at)) + '</b>' + note + '</span></button>';
  }

  function renderCameraFrames(selectId, gridId, frames, currentKey, empty, allLabel) {
    var select = el(selectId);
    var current = state[currentKey];
    if (!current) current = allLabel ? '*' : (state.cameras.length ? String(state.cameras[0].device_id) : '');
    state[currentKey] = current;
    fillSelect(select, frames, current, allLabel);
    select.onchange = function () {
      state[currentKey] = select.value;
      if (currentKey === 'noteId') state.notePicked = true;
      renderCameraFrames(selectId, gridId, frames, currentKey, empty, allLabel);
    };
    var all = !!(allLabel && current === '*');
    var mine = all ? frames.slice() : frames.filter(function (frame) { return String(frame.device_id) === String(state[currentKey]); });
    var grid = el(gridId);
    if (!mine.length) {
      grid.innerHTML = '<p class="empty">' + (all || !allLabel ? empty : 'No notes for this camera.') + '</p>';
      return;
    }
    var heading = all ? (allLabel + ' · ' + mine.length) : (cameraName(state[currentKey]) + ' · ' + mine.length);
    grid.innerHTML = '<p class="sub">' + esc(heading) + '</p><div class="grid">' + mine.map(frameCard).join('') + '</div>';
    Array.prototype.forEach.call(grid.querySelectorAll('.shot'), function (btn) {
      btn.onclick = function () { SP.openViewer(mine, Number(btn.getAttribute('data-i'))); };
    });
  }

  function renderImages() {
    renderCameraFrames('image-cam', 'image-grid', state.reviewed, 'imageId', 'No reviewed frames for this camera.');
  }

  function renderNotes() {
    if (!state.notePicked) state.noteId = '*';
    renderCameraFrames('note-cam', 'note-grid', state.notes, 'noteId', 'No notes yet.', 'All notes');
  }

  var GW = 'https://xuzftiqa5gqy35yf26y2bca2ji0ivbnj.lambda-url.us-east-1.on.aws';
  var live = { cameras: [], bot: [], chekt: [], at: 0, focus: -1, play: '', gen: 0, clipGen: 0 };

  function gridCols(n) {
    if (n <= 1) return 1;
    if (n <= 4) return 2;
    if (n <= 6) return 3;
    return 4;
  }

  function gwGet(path, timeoutMs) {
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, timeoutMs || 40000);
    return fetch(GW + path, { headers: { 'x-viewer-key': SP.pass() }, signal: ctrl.signal }).then(function (r) {
      clearTimeout(timer);
      if (r.status === 429) throw new Error('The camera service is busy. Wait a minute and open Live Feed again.');
      if (r.status === 401) throw new Error('That password did not open the cameras.');
      if (!r.ok) {
        return r.json().catch(function () { return {}; }).then(function (body) {
          throw new Error((body && body.error) || ('The camera service failed (' + r.status + ')'));
        });
      }
      return r.json();
    }).catch(function (e) {
      clearTimeout(timer);
      if (e && e.name === 'AbortError') throw new Error('The camera service timed out.');
      throw e;
    });
  }

  function snapUrls(cam) {
    try {
      var token = new URL(cam.mjpeg_url).searchParams.get('access_token');
      if (!token) return [];
      var part = token.split('.')[1] || '';
      var norm = part.replace(/-/g, '+').replace(/_/g, '/');
      var payload = JSON.parse(atob(norm + '==='.slice((norm.length + 3) % 4)));
      var mac = String(cam.mac || payload.sub || '').replace(/:/g, '').toUpperCase();
      if (!mac) return [];
      var ch = cam.channel != null ? cam.channel : (payload.channel != null ? payload.channel : 0);
      return ['https://api.chekt.com/api/v1/snapshots/' + encodeURIComponent(mac) + '/' + encodeURIComponent(ch) + '?access_token=' + encodeURIComponent(token)];
    } catch (e) {
      return [];
    }
  }

  function bindFeed(img, stateEl, cam, gen) {
    var url = cam.mjpeg_url;
    var snaps = snapUrls(cam);
    var stopped = false;
    var timer = 0;
    var poll = 0;
    var snapTimer = 0;
    var mjpegWait = 0;
    var busy = false;
    var streaming = false;
    function alive() { return !stopped && gen === live.gen; }
    function stopTimers() {
      if (timer) clearTimeout(timer);
      if (poll) clearInterval(poll);
      if (snapTimer) clearInterval(snapTimer);
      if (mjpegWait) clearTimeout(mjpegWait);
      timer = poll = snapTimer = mjpegWait = 0;
    }
    function mark(text, bad) {
      if (!alive() || !stateEl) return;
      stateEl.textContent = text;
      stateEl.classList.toggle('bad', !!bad);
      img.classList.toggle('on', text === 'LIVE');
    }
    img.__stop = function () {
      stopped = true;
      stopTimers();
      img.onload = null;
      img.onerror = null;
      img.removeAttribute('src');
      img.__stop = null;
    };
    function saw() { return img.naturalWidth > 0; }
    function pollSnap() {
      if (!alive() || busy || !snaps.length) return;
      busy = true;
      fetch(snaps[0], { mode: 'cors', cache: 'no-store', referrerPolicy: 'no-referrer' }).then(function (r) {
        if (!alive() || !r.ok) return null;
        return r.json();
      }).then(function (body) {
        if (!alive() || streaming || !body || body.data == null || body.data === '') return;
        img.onload = function () { if (alive() && saw()) mark('LIVE', false); };
        img.src = body.base64Encoded === false ? String(body.data) : ('data:image/jpeg;base64,' + body.data);
      }).catch(function () {}).then(function () { busy = false; });
    }
    function arm() {
      stopTimers();
      poll = setInterval(function () {
        if (!alive()) { stopTimers(); return; }
        if (saw()) { stopTimers(); mark('LIVE', false); }
      }, 400);
      timer = setTimeout(function () {
        if (!alive() || saw()) { if (saw()) mark('LIVE', false); return; }
        stopTimers();
        if (!snaps.length) { mark('no stream', true); return; }
        mark('connecting…', false);
        pollSnap();
        snapTimer = setInterval(pollSnap, 2000);
      }, 8000);
    }
    function startMjpeg() {
      if (!alive()) return;
      streaming = true;
      img.referrerPolicy = 'no-referrer';
      img.onload = function () { if (alive() && saw()) { stopTimers(); mark('LIVE', false); } };
      img.onerror = function () { if (alive() && !saw() && snaps.length) { stopTimers(); pollSnap(); snapTimer = setInterval(pollSnap, 2000); } };
      img.src = url;
      arm();
    }
    mark('connecting…', false);
    if (snaps.length) pollSnap();
    mjpegWait = setTimeout(startMjpeg, snaps.length ? 1800 : 0);
  }

  function stopLive() {
    live.gen++;
    var wall = el('live-wall');
    if (!wall) return;
    Array.prototype.forEach.call(wall.querySelectorAll('img.feed'), function (img) {
      if (typeof img.__stop === 'function') img.__stop();
      else img.removeAttribute('src');
    });
    var player = el('clip-video');
    if (player) { player.pause(); player.removeAttribute('src'); }
    var box = el('clip-box');
    if (box) box.hidden = true;
  }

  function applyLiveFocus() {
    var wall = el('live-wall');
    var back = el('live-back');
    if (!wall) return;
    var shown = 0;
    Array.prototype.forEach.call(wall.querySelectorAll('.live-cell'), function (cell) {
      var on = live.focus < 0 || Number(cell.getAttribute('data-i')) === live.focus;
      cell.hidden = !on;
      if (on) shown++;
    });
    var cols = live.focus >= 0 ? 1 : gridCols(shown);
    wall.style.gridTemplateColumns = 'repeat(' + cols + ', minmax(0, 1fr))';
    if (back) back.hidden = live.focus < 0;
  }

  function paintWall() {
    var wall = el('live-wall');
    var cams = live.cameras || [];
    if (!cams.length) {
      wall.innerHTML = '<p class="empty">No cameras came back from the live service.</p>';
      return;
    }
    live.gen++;
    var gen = live.gen;
    wall.innerHTML = cams.map(function (cam, i) {
      var name = cam.name || cam.device_id || 'Camera';
      var stateText = cam.mjpeg_url ? 'connecting…' : 'no stream';
      return '<button type="button" class="live-cell" data-i="' + i + '"><img class="feed" alt="" referrerpolicy="no-referrer"><span class="st' + (cam.mjpeg_url ? '' : ' bad') + '">' + esc(stateText) + '</span><span class="nm">' + esc(name) + '</span></button>';
    }).join('');
    wall.style.gridTemplateColumns = 'repeat(' + gridCols(cams.length) + ', minmax(0, 1fr))';
    Array.prototype.forEach.call(wall.querySelectorAll('.live-cell'), function (cell, i) {
      cell.onclick = function () {
        live.focus = live.focus === i ? -1 : i;
        applyLiveFocus();
      };
      var cam = cams[i];
      if (!cam || !cam.mjpeg_url) return;
      var img = cell.querySelector('img.feed');
      var stateEl = cell.querySelector('.st');
      setTimeout(function () {
        if (gen !== live.gen) return;
        bindFeed(img, stateEl, cam, gen);
      }, i * 120 + Math.floor(i / 4) * 1600);
    });
    if ((live.bot && live.bot.length) || (live.chekt && live.chekt.length)) {
      (live.bot || []).forEach(function (item) {
        if (item.device_id) item.name = nameFor(item.device_id, item.name);
      });
      paintClips();
    }
    el('live-sub').firstChild.textContent = cams.length + ' cameras together. Bot clips and CHEKT clips from the last 7 days are on the right. ';
  }

  function nameFor(id, fallback) {
    var want = String(id || '');
    var cams = live.cameras || [];
    for (var i = 0; i < cams.length; i++) {
      if (String(cams[i].device_id) === want && cams[i].name) return cams[i].name;
    }
    return fallback || want || 'Camera';
  }

  function asClip(raw, kind) {
    if (kind === 'bot') {
      return {
        device_id: raw.device_id || '',
        name: raw.name || nameFor(raw.device_id, ''),
        when: raw.started_at || '',
        thumb: raw.still_url || '',
        mp4: raw.clip_url || '',
        description: raw.description || '',
        json: String(raw.still_url || '').replace(/\.jpg(\?.*)?$/, '.json')
      };
    }
    return {
      name: raw.device_name || raw.camera || raw.name || 'Camera',
      when: raw.event_time || '',
      thumb: raw.thumbnail || '',
      mp4: raw.mp4 || '',
      description: ''
    };
  }

  function clipRow(item, key) {
    var thumb = item.thumb ? '<img alt="" src="' + esc(item.thumb) + '" referrerpolicy="no-referrer">' : '<img alt="">';
    var sentence = item.description ? '<span class="desc">' + esc(item.description) + '</span>' : '';
    return '<button type="button" class="live-clip' + (key === live.play ? ' on' : '') + '" data-k="' + esc(key) + '">' + thumb + '<span><b>' + esc(item.name) + '</b><span>' + esc(SP.when(item.when) || '') + '</span>' + sentence + '</span></button>';
  }

  function paintGroup(id, list, prefix, empty) {
    var box = el(id);
    if (!box) return;
    if (!list.length) {
      var retry = /timed out|did not|failed|busy|not on this deployment/i.test(empty || '');
      box.innerHTML = '<p class="empty">' + esc(empty) + (retry ? ' <button type="button" class="live-retry">Retry</button>' : '') + '</p>';
      var again = box.querySelector('.live-retry');
      if (again) again.onclick = function () { retryClips(id === 'live-bot' ? 'bot' : 'chekt'); };
      return;
    }
    box.innerHTML = list.map(function (item, i) {
      live.byKey[prefix + i] = item;
      return clipRow(item, prefix + i);
    }).join('');
    Array.prototype.forEach.call(box.querySelectorAll('.live-clip'), function (btn) {
      btn.onclick = function () { playClip(btn.getAttribute('data-k')); };
    });
  }

  function paintClips() {
    var bot = live.bot || [];
    var chekt = live.chekt || [];
    var count = el('live-clip-n');
    var total = bot.length + chekt.length;
    if (count) count.textContent = total ? '(' + total + ')' : '';
    live.byKey = {};
    paintGroup('live-bot', bot, 'b', live.botNote || 'No bot clips in the last 7 days.');
    paintGroup('live-clips', chekt, 'c', live.chektNote || 'No CHEKT clips in the last 7 days.');
  }

  function hideClip() {
    var video = el('clip-video');
    if (video) {
      video.pause();
      video.onerror = null;
      video.removeAttribute('src');
      video.load();
    }
    var box = el('clip-box');
    if (box) box.hidden = true;
    var fail = el('clip-fail');
    if (fail) { fail.hidden = true; fail.textContent = ''; }
  }

  function playClip(key) {
    var item = (live.byKey || {})[key];
    if (!item) return;
    live.play = key;
    el('clip-title').textContent = item.name || 'Camera';
    el('clip-when').textContent = SP.when(item.when) || '';
    el('clip-desc').textContent = item.description || '';
    var img = el('clip-still');
    if (item.thumb) {
      img.hidden = false;
      img.alt = item.name || 'Still';
      img.src = item.thumb;
    } else {
      img.hidden = true;
      img.removeAttribute('src');
    }
    var video = el('clip-video');
    var fail = el('clip-fail');
    fail.hidden = true;
    fail.textContent = '';
    video.onerror = function () {
      fail.hidden = false;
      fail.textContent = 'This browser cannot play this clip. The picture on the left is the saved still.';
    };
    if (item.mp4) {
      video.src = item.mp4;
      video.play().catch(function () {});
    } else {
      video.removeAttribute('src');
      video.load();
      fail.hidden = false;
      fail.textContent = 'No video file came back for this clip.';
    }
    el('clip-box').hidden = false;
    Array.prototype.forEach.call(el('live-side').querySelectorAll('.live-clip'), function (btn) {
      btn.classList.toggle('on', btn.getAttribute('data-k') === key);
    });
  }

  function hydrateBot(list) {
    var pending = list.filter(function (item) { return item.json && !item.description; });
    if (!pending.length) return;
    Promise.all(pending.map(function (item) {
      return fetch(item.json, { cache: 'force-cache' }).then(function (r) {
        return r.ok ? r.json() : null;
      }).then(function (obj) {
        if (!obj) return;
        if (obj.name) item.name = obj.name;
        else if (obj.device_id) item.name = nameFor(obj.device_id, item.name);
        if (obj.description) item.description = String(obj.description);
      }).catch(function () {});
    })).then(function () {
      if (state.tab !== 'live') return;
      paintClips();
      var open = (live.byKey || {})[live.play];
      var desc = el('clip-desc');
      var box = el('clip-box');
      if (open && desc && box && !box.hidden) desc.textContent = open.description || '';
    });
  }

  function loadBot(gen) {
    return SP.patrolClips().then(function (data) {
      if (gen !== live.clipGen || state.tab !== 'live') return;
      if (!data || data.ok === false) {
        var err = (data && data.error) || 'Bot clips did not load.';
        if (/unknown route/i.test(err)) err = 'Bot clips are not on this deployment yet.';
        if (/timed out/i.test(err)) err = 'Bot clips timed out.';
        live.bot = [];
        live.botNote = err;
        paintClips();
        return;
      }
      if (data.list === false) {
        live.bot = [];
        live.botNote = data.error || 'Bot clips did not load.';
        paintClips();
        return;
      }
      live.bot = (data.clips || []).map(function (row) { return asClip(row, 'bot'); });
      live.botNote = '';
      paintClips();
      hydrateBot(live.bot);
    }).catch(function (e) {
      if (gen !== live.clipGen || state.tab !== 'live') return;
      live.bot = [];
      live.botNote = /timed out/i.test(e.message || '') ? 'Bot clips timed out.' : (e.message || 'Bot clips did not load.');
      paintClips();
    });
  }

  function loadChekt(gen) {
    if (gen !== live.clipGen || state.tab !== 'live') return;
    live.chektNote = 'Loading CHEKT clips…';
    el('live-clips').innerHTML = '<p class="empty">Loading CHEKT clips…</p>';
    gwGet('/clips?property=' + encodeURIComponent(SP.HUB) + '&days=7&limit=20&quick=1', 70000).then(function (data) {
      if (gen !== live.clipGen || state.tab !== 'live') return;
      live.chekt = ((data && data.events) || []).map(function (row) { return asClip(row, 'chekt'); });
      live.chektNote = '';
      paintClips();
    }).catch(function (e) {
      if (gen !== live.clipGen || state.tab !== 'live') return;
      live.chekt = [];
      live.chektNote = /timed out/i.test(e.message || '') ? 'CHEKT clips timed out.' : (e.message || 'CHEKT clips did not load.');
      paintClips();
    });
  }

  function retryClips(which) {
    var gen = live.clipGen;
    if (which === 'bot') {
      el('live-bot').innerHTML = '<p class="empty">Loading bot clips…</p>';
      loadBot(gen);
      return;
    }
    loadChekt(gen);
  }

  function openLive() {
    if (!SP.pass()) {
      el('live-wall').innerHTML = '<p class="empty">Sign in to open the live feeds.</p>';
      live.bot = [];
      live.chekt = [];
      live.botNote = 'Sign in to open the clips.';
      live.chektNote = 'Sign in to open the clips.';
      paintClips();
      return;
    }
    var fresh = live.cameras.length && (Date.now() - live.at) < 50 * 60 * 1000;
    if (!fresh) el('live-wall').innerHTML = '<p class="empty">Opening the cameras…</p>';
    else paintWall();
    el('live-bot').innerHTML = '<p class="empty">Loading bot clips…</p>';
    live.chekt = [];
    live.chektNote = 'CHEKT clips load after the cameras.';
    el('live-clips').innerHTML = '<p class="empty">CHEKT clips load after the cameras.</p>';
    var gen = ++live.clipGen;
    loadBot(gen);
    var startChekt = function () {
      setTimeout(function () {
        if (gen !== live.clipGen || state.tab !== 'live') return;
        loadChekt(gen);
      }, 5000);
    };
    if (fresh) { startChekt(); return; }
    gwGet('/live?property=' + encodeURIComponent(SP.HUB), 40000).then(function (data) {
      if (state.tab !== 'live') return;
      live.cameras = (data && data.cameras) || [];
      live.at = Date.now();
      live.focus = -1;
      paintWall();
      startChekt();
    }).catch(function (e) {
      if (state.tab !== 'live') return;
      if (!live.cameras.length) el('live-wall').innerHTML = '<p class="empty">' + esc(e.message) + '</p>';
      startChekt();
    });
  }

  function showTab(name) {
    state.tab = name;
    ['schedule', 'live', 'images', 'notes', 'profile'].forEach(function (tab) {
      el('tab-' + tab).classList.toggle('on', tab === name);
      el('panel-' + tab).classList.toggle('on', tab === name);
    });
    if (name === 'images') renderImages();
    if (name === 'notes') renderNotes();
    if (name === 'profile') loadProfile();
    if (name === 'live') openLive();
    else stopLive();
  }

  function accountLabel(value) {
    var text = String(value || 'residential').trim();
    if (text.toLowerCase().indexOf('comm') !== 0) return 'Residential';
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  function whenText(when) {
    if (!when || !when.days || !when.days.length) return 'Any time';
    var days = when.days.map(function (day) {
      return day.charAt(0).toUpperCase() + day.slice(1);
    }).join(', ');
    return days + ' ' + when.start + '–' + when.end;
  }

  function renderProfile(data) {
    var name = data.name || 'Jones residence';
    var address = data.address || '18775 Macalpine Loop, Bend, OR 97702';
    var facts = '<dl class="profile-facts">' +
      '<dt>Name</dt><dd>' + esc(name) + '</dd>' +
      '<dt>Address</dt><dd>' + esc(address) + '</dd>' +
      '<dt>Account type</dt><dd>' + esc(accountLabel(data.account_type)) + '</dd>' +
      '</dl>';
    var description = data.saved && data.description
      ? '<p class="profile-desc">' + esc(data.description) + '</p>'
      : '<p class="empty">No description has been saved yet.</p>';
    var people = data.characters || [];
    var cards = people.length
      ? '<div class="profile-chars">' + people.map(function (row) {
        var kind = row.kind ? row.kind.charAt(0).toUpperCase() + row.kind.slice(1) : '';
        return '<article class="profile-char"><b>' + esc(row.label || row.id || 'Character') + '</b>' +
          (kind ? '<span>' + esc(kind) + '</span>' : '') +
          (row.appearance ? '<span>' + esc(row.appearance) + '</span>' : '') +
          '<span>' + esc(row.where || 'Any camera') + '</span>' +
          '<span>' + esc(whenText(row.when)) + '</span></article>';
      }).join('') + '</div>'
      : '<p class="empty">No characters yet. A character is written after the same thing has been seen more than once.</p>';
    el('profile-body').innerHTML = facts + description + cards;
  }

  function loadProfile() {
    if (!SP.pass()) {
      el('profile-body').innerHTML = '<p class="empty">Sign in to read the profile.</p>';
      return;
    }
    if (state.profile) { renderProfile(state.profile); return; }
    el('profile-body').innerHTML = '<p class="empty">Reading the profile…</p>';
    SP.patrolProfile().then(function (data) {
      if (!data || data.ok === false) {
        var err = (data && data.error) || 'The profile did not load.';
        if (/unknown route/i.test(err)) err = 'The profile is not on this deployment yet.';
        el('profile-body').innerHTML = '<p class="empty">' + esc(err) + '</p>';
        return;
      }
      state.profile = data;
      renderProfile(data);
    }).catch(function (e) {
      el('profile-body').innerHTML = '<p class="empty">' + esc(e.message || 'The profile did not load.') + '</p>';
    });
  }

  function applyPreset(preset) {
    var times = SP.presetTimes(preset, state.qa);
    if (!times || !state.cameras.length) { setStatus('The property is still loading.'); return; }
    var next = {};
    state.cameras.forEach(function (cam) { next[String(cam.device_id)] = times.slice(); });
    state.times = next;
    setStatus(preset.name + ' filled ' + times.length + ' times on each camera. Save when this is the schedule you want.');
    renderSchedule();
  }

  function remember() {
    var cache = SP.peek() || {};
    cache.name = el('property-name').textContent || cache.name || '';
    cache.cameras = state.cameras.map(function (cam) {
      return { device_id: String(cam.device_id), name: cam.name || String(cam.device_id) };
    });
    cache.qa = state.qa;
    cache.times = state.times;
    cache.saved = state.saved;
    cache.zone = state.zone;
    SP.writeCache(cache);
  }

  function save() {
    if (!state.cameras.length) { setStatus('The property is still loading.'); return; }
    if (used() > poolSize()) { setStatus('Too many times for this level.'); return; }
    setStatus('Saving…');
    SP.patrolSave(state.qa, state.times).then(function (data) {
      if (!data.ok) { setStatus(data.error || 'Save failed'); return; }
      state.saved = true;
      state.qa = data.qa || state.qa;
      renderSchedule();
      remember();
      setStatus('Saved. Scan hours on the sheet no longer run for this property.');
    }).catch(function (e) { setStatus(e.message); });
  }

  function applyPictures(cache) {
    state.reviewed = cache.reviewed || [];
    state.notes = cache.notes || [];
    el('image-count').textContent = state.reviewed.length + ' reviewed';
    el('note-count').textContent = state.notes.length + ' notes';
    if (state.tab === 'images') renderImages();
    if (state.tab === 'notes') renderNotes();
  }

  function show(cache) {
    if (!cache) return;
    var first = !state.painted;
    if (first) {
      state.painted = true;
      state.cameras = cache.cameras || [];
      state.qa = cache.qa || 'bronze';
      state.times = cache.times || {};
      state.saved = !!cache.saved;
      state.zone = cache.zone || 'America/Chicago';
      if (!state.editId && state.cameras.length) state.editId = String(state.cameras[0].device_id);
      el('property-name').textContent = cache.name || '';
      renderSchedule();
      setStatus('');
    }
    applyPictures(cache);
  }

  function waitForPictures() {
    SP.watch(show);
    var cache = SP.peek();
    if (cache) show(cache);
    else setStatus('Loading the schedule and pictures…');
    if (!SP.warming()) {
      SP.warm().then(show).catch(function (e) { setStatus(e.message); });
      return;
    }
    setTimeout(function () {
      if (state.painted || SP.peek() || SP.warming()) return;
      SP.warm().then(show).catch(function (e) { setStatus(e.message); });
    }, 4000);
  }

  function enter(password) {
    if (!password) { showGate('Enter the property password'); return; }
    el('gate-enter').disabled = true;
    el('gate-status').textContent = 'Checking…';
    SP.setPass(password);
    SP.check().then(function (data) {
      if (!data.ok) {
        SP.setPass('');
        el('gate-enter').disabled = false;
        el('gate-status').textContent = '';
        showGate(data.error || 'That password did not open the property');
        return;
      }
      el('gate-pass').value = '';
      hideGate();
      SP.warm(data).then(show).catch(function (e) { setStatus(e.message); });
    }).catch(function (e) {
      SP.setPass('');
      el('gate-enter').disabled = false;
      el('gate-status').textContent = '';
      showGate(e.message);
    });
  }

  function boot() {
    var theme = new URLSearchParams(location.search).get('theme') === 'dark' ? 'dark' : 'light';
    document.documentElement.classList.add('theme-' + theme);
    el('gate-form').onsubmit = function (ev) { ev.preventDefault(); enter(el('gate-pass').value); };
    ['schedule', 'live', 'images', 'notes', 'profile'].forEach(function (tab) {
      el('tab-' + tab).onclick = function () { showTab(tab); };
    });
    el('live-back').onclick = function () { live.focus = -1; applyLiveFocus(); };
    el('clip-close').onclick = hideClip;
    el('clip-box').onclick = function (ev) { if (ev.target === el('clip-box')) hideClip(); };
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && el('clip-box') && !el('clip-box').hidden) hideClip();
    });
    el('save').onclick = save;
    renderSchedule();
    showTab('schedule');
    if (!SP.pass()) { showGate(''); return; }
    hideGate();
    waitForPictures();
  }

  window.SafePatrolPage = { boot: boot, show: show };
})();
