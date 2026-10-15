/*
  safe-portal/portal/portal-patrol.js — Virtual Patrol page.
  Opens on the 24-hour schedule. Images and notes are separate subtabs,
  one camera at a time. Pictures are prepared when the portal password is entered.
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
    renderCameraFrames('note-cam', 'note-grid', state.notes, 'noteId', 'No notes yet.', 'All notes');
  }

  function showTab(name) {
    state.tab = name;
    ['schedule', 'images', 'notes'].forEach(function (tab) {
      el('tab-' + tab).classList.toggle('on', tab === name);
      el('panel-' + tab).classList.toggle('on', tab === name);
    });
    if (name === 'images') renderImages();
    if (name === 'notes') renderNotes();
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
    ['schedule', 'images', 'notes'].forEach(function (tab) {
      el('tab-' + tab).onclick = function () { showTab(tab); };
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
