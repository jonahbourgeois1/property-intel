// Home-dashboard data sources for vyanet-viewer.html. Lifted from
// model-viewer.html's weather + hazard panels (same public key-free
// endpoints, same radii and thresholds) so the hub card and the 3D page's
// panel can never disagree about the numbers. Each loader returns a card
// body as an HTML string, or throws — the hub renders the failure with the
// source's own link and a retry.

export const DASH_SOURCES = [
  { id: 'wx',    label: 'Weather',      accent: '#3b82f6',
    site: 'https://forecast.weather.gov/', siteName: 'NWS forecast page',
    source: 'National Weather Service' },
  { id: 'fire',  label: 'Wildfire',     accent: '#ef4444',
    site: 'https://www.nifc.gov/fire-information/nfn', siteName: 'NIFC fire information',
    source: 'NIFC WFIGS interagency perimeters' },
  { id: 'quake', label: 'Earthquakes',  accent: '#f97316',
    site: 'https://earthquake.usgs.gov/earthquakes/map/', siteName: 'USGS earthquake map',
    source: 'USGS Earthquake Catalog' },
  { id: 'fema',  label: 'FEMA',         accent: '#a78bfa',
    site: 'https://www.fema.gov/disaster/declarations', siteName: 'FEMA declarations',
    source: 'OpenFEMA disaster declarations' },
  { id: 'space', label: 'Space Wx',     accent: '#2dd4bf',
    site: 'https://www.spaceweather.gov/', siteName: 'NOAA Space Weather Prediction Center',
    source: 'NOAA SWPC alerts' },
  { id: 'info',  label: 'More sources', accent: '#8a93a2',
    site: 'https://www.fema.gov/about/openfema/data-sets', siteName: 'OpenFEMA data sets',
    source: 'Data sources reviewed for this viewer' }
];

const WX_API = 'https://api.weather.gov';

function escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
async function getJson(url) {
  const r = await fetch(url, { headers: { 'Accept': 'application/geo+json' } });
  if (!r.ok) throw new Error('HTTP ' + r.status + ' from ' + url);
  return await r.json();
}
function plural(n, unit) { return n + ' ' + unit + (Math.abs(n) === 1 ? '' : 's'); }
function ago(ms) {
  const s = (Date.now() - Number(ms)) / 1000;
  if (!isFinite(s)) return '';
  if (s < 90) return 'just now';
  if (s < 5400) return plural(Math.round(s / 60), 'minute') + ' ago';
  if (s < 86400) return plural(Math.round(s / 3600), 'hour') + ' ago';
  const d = Math.round(s / 86400);
  if (d < 45) return plural(d, 'day') + ' ago';
  if (d < 400) return plural(Math.round(d / 30), 'month') + ' ago';
  return plural(Math.round(d / 365), 'year') + ' ago';
}
function kmBetween(la1, lo1, la2, lo2) {
  if (![la1, lo1, la2, lo2].every(function (v) { return isFinite(Number(v)); })) return NaN;
  const R = 6371.0088, r = Math.PI / 180;
  const dp = (la2 - la1) * r, dl = (lo2 - lo1) * r;
  const a = Math.sin(dp / 2) * Math.sin(dp / 2) +
            Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin(dl / 2) * Math.sin(dl / 2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}
function bearingTo(la1, lo1, la2, lo2) {
  const r = Math.PI / 180;
  const dl = (lo2 - lo1) * r;
  const y = Math.sin(dl) * Math.cos(la2 * r);
  const x = Math.cos(la1 * r) * Math.sin(la2 * r) -
            Math.sin(la1 * r) * Math.cos(la2 * r) * Math.cos(dl);
  return (Math.atan2(y, x) / r + 360) % 360;
}
function compass16(d) {
  if (!isFinite(d)) return '';
  return ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW']
         [Math.floor(((Number(d) + 11.25) % 360) / 22.5)];
}
function cToF(c) { return (c === null || c === undefined) ? null : c * 9 / 5 + 32; }
function kmhToMph(k) { return (k === null || k === undefined) ? null : k * 0.621371; }

// ── mini basemap (ported from model-viewer's hzTileMap) ────────────────
// Tiles are plain <img> elements — images are not subject to CORS, so the
// basemap needs no key and no library. Markers are an SVG overlay positioned
// by the same Web Mercator maths the tiles use. Wildfire starts zoomed to
// nearby towns; earthquakes stay zoomed out. Both fill the card width,
// accept +/- zoom, and can be dragged. The blue dot is the property.
const TILE_BASE = 'https://server.arcgisonline.com/ArcGIS/rest/services/' +
                  'World_Topo_Map/MapServer/tile/';
const MAPS = {};
const MAP_PAD = 280;
function mercX(lon, z) { return (Number(lon) + 180) / 360 * Math.pow(2, z) * 256; }
function mercY(lat, z) {
  const r = Number(lat) * Math.PI / 180;
  return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * Math.pow(2, z) * 256;
}
function lonFromMerc(x, z) {
  return x / (Math.pow(2, z) * 256) * 360 - 180;
}
function latFromMerc(y, z) {
  const n = Math.PI - 2 * Math.PI * y / (Math.pow(2, z) * 256);
  return (180 / Math.PI) * Math.atan(Math.sinh(n));
}
function metersPerPx(lat, z) {
  return 156543.03392 * Math.cos(Number(lat) * Math.PI / 180) / Math.pow(2, z);
}
function zoomFor(lat, maxKm, sizePx) {
  for (let z = 13; z >= 3; z--) {
    if ((sizePx / 2) * metersPerPx(lat, z) >= maxKm * 1000 * 1.18) return z;
  }
  return 3;
}
function clampLat(lat) { return Math.max(-85, Math.min(85, lat)); }
function wrapLon(lon) {
  let x = lon;
  while (x < -180) x += 360;
  while (x > 180) x -= 360;
  return x;
}
function mapShell(id) {
  return '<div class="dash-map" id="dash-map-' + id + '">' +
    '<div class="dash-map-tools">' +
      '<button type="button" class="dash-zoom" id="dash-zoom-in-' + id +
        '" onclick="dashMapZoom(\'' + id + '\',1)" aria-label="Zoom in">+</button>' +
      '<button type="button" class="dash-zoom" id="dash-zoom-out-' + id +
        '" onclick="dashMapZoom(\'' + id + '\',-1)" aria-label="Zoom out">\u2212</button>' +
    '</div>' +
    '<div class="dash-tiles" id="dash-tiles-' + id + '"></div>' +
    '<div class="dash-map-cap" id="dash-map-cap-' + id + '"></div></div>';
}
function paintMap(id, fromSize) {
  const m = MAPS[id];
  const el = document.getElementById('dash-tiles-' + id);
  const cap = document.getElementById('dash-map-cap-' + id);
  if (!m || !el) return;
  if (m.clat == null) m.clat = m.lat;
  if (m.clng == null) m.clng = m.lng;
  const W = el.clientWidth, H = el.clientHeight;
  // Paint only once the box has a real size; ResizeObserver retries.
  if (W < 40 || H < 40) { observeMap(id); return; }
  if (fromSize && m.pw === W && m.ph === H && el.querySelector('.dash-tiles-inner')) {
    return;
  }
  m.pw = W; m.ph = H;
  if (m.z == null) m.z = m.startZoom(W, H);
  m.z = Math.max(4, Math.min(14, m.z));
  const z = m.z, pad = MAP_PAD;
  const innerW = W + pad * 2, innerH = H + pad * 2;
  const left = mercX(m.clng, z) - W / 2 - pad, top = mercY(m.clat, z) - H / 2 - pad;
  const n = Math.pow(2, z);
  let tiles = '';
  for (let ty = Math.floor(top / 256); ty <= Math.floor((top + innerH) / 256); ty++) {
    if (ty < 0 || ty >= n) continue;
    for (let tx = Math.floor(left / 256); tx <= Math.floor((left + innerW) / 256); tx++) {
      const wx = ((tx % n) + n) % n;
      tiles += '<img class="dash-tile" alt="" draggable="false" src="' +
               TILE_BASE + z + '/' + ty + '/' + wx + '" style="left:' +
               Math.round(tx * 256 - left) + 'px;top:' + Math.round(ty * 256 - top) + 'px">';
    }
  }
  let ov = '<svg class="dash-ov" viewBox="0 0 ' + innerW + ' ' + innerH +
           '" preserveAspectRatio="none">';
  (m.points || []).forEach(function (pt) {
    if (!isFinite(pt.lat) || !isFinite(pt.lng)) return;
    const x = mercX(pt.lng, z) - left, y = mercY(pt.lat, z) - top;
    if (x < -20 || y < -20 || x > innerW + 20 || y > innerH + 20) return;
    ov += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' +
          (pt.r || 5).toFixed(1) + '" fill="' + pt.fill + '" stroke="' + pt.stroke +
          '" stroke-width="1.3"><title>' + escHtml(pt.label || '') + '</title></circle>';
  });
  const px = mercX(m.lng, z) - left, py = mercY(m.lat, z) - top;
  ov += '<circle cx="' + px.toFixed(1) + '" cy="' + py.toFixed(1) + '" r="9" fill="none" ' +
        'stroke="#38bdf8" stroke-opacity="0.5"></circle>' +
        '<circle cx="' + px.toFixed(1) + '" cy="' + py.toFixed(1) + '" r="4.5" fill="#38bdf8" ' +
        'stroke="#0b0e12" stroke-width="1.4"></circle></svg>';
  el.innerHTML = '<div class="dash-tiles-inner" style="left:-' + pad +
    'px;top:-' + pad + 'px;width:' + innerW + 'px;height:' + innerH + 'px">' +
    tiles + ov + '</div>';
  const across = Math.round(W * metersPerPx(m.clat, z) / 1000);
  if (cap) {
    cap.innerHTML = escHtml('about ' + across + ' km across · drag to pan · blue dot is the property' +
      (m.capExtra ? ' · ' + m.capExtra : '')) + ' &middot; basemap Esri';
  }
  bindMapPan(id);
  observeMap(id);
}
function observeMap(id) {
  const el = document.getElementById('dash-tiles-' + id);
  if (!el || el.dataset.roBound) return;
  if (typeof ResizeObserver === 'undefined') return;
  el.dataset.roBound = '1';
  let t = 0;
  const ro = new ResizeObserver(function () {
    clearTimeout(t);
    t = setTimeout(function () { paintMap(id, true); }, 40);
  });
  ro.observe(el);
}
function bindMapPan(id) {
  const el = document.getElementById('dash-tiles-' + id);
  if (!el || el.dataset.panBound) return;
  el.dataset.panBound = '1';
  let dragging = false, sx = 0, sy = 0, dx = 0, dy = 0;
  function inner() { return el.querySelector('.dash-tiles-inner'); }
  function endDrag() {
    if (!dragging) return;
    dragging = false;
    el.classList.remove('dragging');
    const m = MAPS[id];
    const wrap = inner();
    if (!m) return;
    if (Math.abs(dx) < 4 && Math.abs(dy) < 4) {
      if (wrap) wrap.style.transform = '';
      return;
    }
    const z = m.z || 8;
    m.clng = wrapLon(lonFromMerc(mercX(m.clng, z) - dx, z));
    m.clat = clampLat(latFromMerc(mercY(m.clat, z) - dy, z));
    dx = dy = 0;
    paintMap(id);
  }
  el.addEventListener('pointerdown', function (e) {
    if (e.button) return;
    if (e.target && e.target.closest && e.target.closest('.dash-zoom')) return;
    dragging = true; sx = e.clientX; sy = e.clientY; dx = dy = 0;
    el.classList.add('dragging');
    try { el.setPointerCapture(e.pointerId); } catch (err) {}
    e.preventDefault();
  });
  el.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    dx = e.clientX - sx; dy = e.clientY - sy;
    const wrap = inner();
    if (wrap) wrap.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
  });
  el.addEventListener('pointerup', endDrag);
  el.addEventListener('pointercancel', endDrag);
  el.addEventListener('lostpointercapture', endDrag);
}
window.dashMapZoom = function (id, dz) {
  const m = MAPS[id];
  if (!m) return;
  const next = Math.max(4, Math.min(14, (m.z == null ? 8 : m.z) + dz));
  if (next === m.z) return;
  m.z = next;
  paintMap(id);
};
export function dashAfterPaint(id) {
  requestAnimationFrame(function () {
    requestAnimationFrame(function () { paintMap(id); });
  });
}
window.dashAfterPaint = dashAfterPaint;
let mapResizeTimer = 0;
window.addEventListener('resize', function () {
  clearTimeout(mapResizeTimer);
  mapResizeTimer = setTimeout(function () {
    Object.keys(MAPS).forEach(paintMap);
  }, 140);
});

// NWS period icons as cells: image fills the frame, date + forecast under it.
function wxIcon(url) {
  if (!url) return '';
  const s = String(url);
  if (/[?&]size=/.test(s)) return s.replace(/([?&]size=)[^&]*/, '$1large');
  return s + (s.indexOf('?') >= 0 ? '&' : '?') + 'size=large';
}
function fcDate(p) {
  const t = p && p.startTime ? new Date(p.startTime) : null;
  if (t && !isNaN(t.getTime())) {
    return t.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  }
  return String((p && p.name) || '').replace('This Afternoon', 'Today')
    .replace('Overnight', 'Tonight');
}
function nwsVal(q) {
  if (!q || q.value === null || q.value === undefined) return null;
  const n = Number(q.value);
  return isFinite(n) ? n : null;
}
function mToMi(m) { return m / 1609.344; }
function paToInHg(pa) { return pa / 3386.389; }
function mToFt(m) { return m * 3.28084; }
function cloudLine(layers) {
  if (!Array.isArray(layers) || !layers.length) return '';
  return layers.slice(0, 3).map(function (c) {
    const amt = String(c.amount || '').replace(/_/g, ' ');
    const base = nwsVal(c.base);
    return amt + (base !== null ? ' ' + Math.round(mToFt(base)).toLocaleString() + ' ft' : '');
  }).filter(Boolean).join(', ');
}
function wxTime(iso) {
  if (!iso) return '';
  const t = new Date(iso);
  if (isNaN(t.getTime())) return '';
  return t.toLocaleString([], { month: 'short', day: 'numeric',
                                hour: 'numeric', minute: '2-digit' });
}
function wxHour(iso) {
  if (!iso) return '';
  const t = new Date(iso);
  if (isNaN(t.getTime())) return '';
  return t.toLocaleTimeString([], { hour: 'numeric' });
}
function wxClock(iso) {
  if (!iso) return '';
  const t = new Date(iso);
  if (isNaN(t.getTime())) return '';
  return t.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
function fcStrip(periods) {
  const ps = (periods || []).slice(0, 8);
  if (!ps.length) return '';
  let h = '<div class="dash-wx-sec">Forecast</div><div class="dash-fc">';
  ps.forEach(function (p) {
    const icon = wxIcon(p.icon);
    const pop = nwsVal(p.probabilityOfPrecipitation);
    const meta = [];
    if (p.windSpeed) meta.push((p.windDirection ? p.windDirection + ' ' : '') + p.windSpeed);
    if (p.windGust) meta.push('gust ' + p.windGust);
    if (pop !== null) meta.push(pop + '% precip');
    const rhP = nwsVal(p.relativeHumidity);
    if (rhP !== null) meta.push(Math.round(rhP) + '% RH');
    h += '<div class="dash-fc-p">' +
         (icon ? '<img src="' + escHtml(icon) + '" alt="">' : '<div class="dash-fc-ph"></div>') +
         '<span class="dash-fc-n">' + escHtml(fcDate(p) || p.name || '') + '</span>' +
         '<span class="dash-fc-f">' + escHtml(p.shortForecast || '') + '</span>' +
         '<span class="dash-fc-t">' + escHtml(String(p.temperature)) + '\u00B0</span>' +
         (meta.length ? '<span class="dash-fc-m">' + escHtml(meta.join(' \u00B7 ')) + '</span>' : '') +
         '</div>';
  });
  return h + '</div>';
}
function hourlyStrip(periods) {
  const ps = (periods || []).slice(0, 18);
  if (!ps.length) return '';
  let h = '<div class="dash-wx-sec">Next hours</div><div class="dash-hr">';
  ps.forEach(function (p) {
    const pop = nwsVal(p.probabilityOfPrecipitation);
    h += '<div class="dash-hr-p"' +
         (p.shortForecast ? ' title="' + escHtml(p.shortForecast) + '"' : '') + '>' +
         '<span class="dash-hr-h">' + escHtml(wxHour(p.startTime) || p.name || '') + '</span>' +
         '<span class="dash-hr-t">' + escHtml(String(p.temperature)) + '\u00B0</span>' +
         (pop !== null ? '<span class="dash-hr-r">' + pop + '%</span>' : '') +
         '</div>';
  });
  return h + '</div>';
}
window.dashWxToggle = function (i) {
  const d = document.getElementById('dash-wx-d-' + i);
  const more = document.getElementById('dash-wx-m-' + i);
  if (!d) return;
  const on = d.classList.toggle('open');
  if (more) more.textContent = on ? 'hide details' : 'show details';
};
function alertBlock(feats) {
  if (!feats.length) return '';
  let h = '<div class="dash-wx-sec">Active alerts</div>';
  feats.forEach(function (f, i) {
    const a = f.properties || {};
    const detail = [a.areaDesc && ('Area: ' + a.areaDesc),
                    a.description && a.description.trim(),
                    a.instruction && ('What to do: ' + a.instruction.trim())]
      .filter(Boolean).join('\n\n');
    h += '<div class="dash-wx-alert' + (detail ? ' can-open' : '') + '"' +
         (detail ? ' onclick="dashWxToggle(' + i + ')"' : '') + '>' +
         '<div class="dash-wx-ev">' + escHtml(a.event || 'Alert') + '</div>' +
         (a.headline ? '<div class="dash-wx-hd">' + escHtml(a.headline) + '</div>' : '') +
         '<div class="dash-wx-tm">' +
           escHtml([a.severity, (a.ends || a.expires) ? 'until ' + wxTime(a.ends || a.expires) : '']
             .filter(Boolean).join(' \u00B7 ')) +
         '</div>' +
         (detail ? '<div class="dash-wx-more" id="dash-wx-m-' + i + '">show details</div>' +
                   '<div class="dash-wx-detail" id="dash-wx-d-' + i + '">' +
                   escHtml(detail) + '</div>' : '') +
         '</div>';
  });
  return h;
}
function listBlock(rowsHtml) {
  return '<div class="dash-list">' + rowsHtml + '</div>';
}

// ── card building blocks (hub styles .dash-*) ─────────────────────────
function head(big, small, rows, sub) {
  let h = '<div class="dash-head"><div class="dash-big' +
          (String(big).replace(/<[^>]*>/g, '').length > 4 ? ' sm' : '') + '">' + big +
          '</div><div class="dash-small">' + small + '</div></div>';
  if (rows && rows.length) {
    h += '<div class="dash-rows">';
    rows.forEach(function (r) {
      h += '<div class="dash-k">' + escHtml(r[0]) + '</div><div class="dash-v' +
           (r[2] ? ' ' + r[2] : '') + '">' + r[1] + '</div>';
    });
    h += '</div>';
  }
  if (sub) h += '<div class="dash-sub">' + escHtml(sub) + '</div>';
  return h;
}
export function foot(src, extra) {
  return '<div class="dash-foot">' + (extra ? escHtml(extra) + '<br>' : '') +
         escHtml(src.source) +
         '<br><a href="' + escHtml(src.site) + '" target="_blank" rel="noopener">' +
         escHtml(src.siteName) + '</a>' +
         ' &middot; <a href="#" onclick="dashRetry(\'' + src.id + '\');return false;">Refresh</a>' +
         '</div>';
}

// One /points lookup shared by weather and FEMA (county), cached per page.
let ptsCache = null, ptsKey = '';
function points(lat, lng) {
  const k = lat.toFixed(4) + ',' + lng.toFixed(4);
  if (!ptsCache || ptsKey !== k) {
    ptsKey = k;
    ptsCache = getJson(WX_API + '/points/' + k);
  }
  return ptsCache;
}

const STATE_FIPS = {AL:'01',AK:'02',AZ:'04',AR:'05',CA:'06',CO:'08',CT:'09',DE:'10',
 DC:'11',FL:'12',GA:'13',HI:'15',ID:'16',IL:'17',IN:'18',IA:'19',KS:'20',KY:'21',
 LA:'22',ME:'23',MD:'24',MA:'25',MI:'26',MN:'27',MS:'28',MO:'29',MT:'30',NE:'31',
 NV:'32',NH:'33',NJ:'34',NM:'35',NY:'36',NC:'37',ND:'38',OH:'39',OK:'40',OR:'41',
 PA:'42',RI:'44',SC:'45',SD:'46',TN:'47',TX:'48',UT:'49',VT:'50',VA:'51',WA:'53',
 WV:'54',WI:'55',WY:'56',PR:'72'};

// ── Weather (NWS): current observation, next period, active alerts ────
async function loadWx(lat, lng, src) {
  const pt = lat.toFixed(4) + ',' + lng.toFixed(4);
  const pp = ((await points(lat, lng)) || {}).properties || {};
  const [fc, hourly, alerts, stations] = await Promise.all([
    pp.forecast ? getJson(pp.forecast).catch(function () { return null; }) : null,
    pp.forecastHourly ? getJson(pp.forecastHourly).catch(function () { return null; }) : null,
    getJson(WX_API + '/alerts/active?point=' + pt).catch(function () { return null; }),
    pp.observationStations ? getJson(pp.observationStations).catch(function () { return null; }) : null
  ]);
  let obs = null, stationName = '';
  const sf = (stations && stations.features) || [];
  for (let i = 0; i < Math.min(3, sf.length) && !obs; i++) {
    const sp = sf[i].properties || {};
    if (!sp.stationIdentifier) continue;
    const list = await getJson(WX_API + '/stations/' + sp.stationIdentifier +
                               '/observations?limit=8').catch(function () { return null; });
    const recs = (list && list.features) || [];
    for (let k = 0; k < recs.length; k++) {
      const o = recs[k].properties || {};
      if (o.temperature && o.temperature.value !== null && o.temperature.value !== undefined) {
        obs = o; stationName = sp.name || sp.stationIdentifier;
        break;
      }
    }
  }
  const periods = (fc && fc.properties && fc.properties.periods) || [];
  const hours = (hourly && hourly.properties && hourly.properties.periods) || [];
  const p0 = periods[0] || null;
  const alertList = (alerts && alerts.features) || [];
  let big = '--', small = 'No current observation';
  if (obs) {
    const f = cToF(obs.temperature.value);
    big = Math.round(f) + '&deg;';
    small = escHtml(obs.textDescription || (p0 ? p0.shortForecast : '') || '');
  } else if (p0) {
    big = p0.temperature + '&deg;';
    small = escHtml(p0.shortForecast || '');
  }
  const rows = [];
  if (obs) {
    const spd = kmhToMph(nwsVal(obs.windSpeed));
    const gst = kmhToMph(nwsVal(obs.windGust));
    const dir = nwsVal(obs.windDirection);
    if (spd !== null) {
      const dirTxt = compass16(dir);
      rows.push(['Wind', (Math.round(spd) === 0 ? 'calm' :
        (dirTxt ? dirTxt + ' ' : '') + Math.round(spd) + ' mph') +
        (gst !== null && gst > 0 ? ' (gusting ' + Math.round(gst) + ')' : '')]);
    }
    const rh = nwsVal(obs.relativeHumidity);
    if (rh !== null) rows.push(['Humidity', Math.round(rh) + '%']);
    const dp = cToF(nwsVal(obs.dewpoint));
    if (dp !== null) rows.push(['Dewpoint', Math.round(dp) + '&deg;']);
    const vis = nwsVal(obs.visibility);
    if (vis !== null) rows.push(['Visibility', mToMi(vis) >= 10 ? '10+ mi' : mToMi(vis).toFixed(1) + ' mi']);
    const pres = nwsVal(obs.barometricPressure) || nwsVal(obs.seaLevelPressure);
    if (pres !== null) rows.push(['Pressure', paToInHg(pres).toFixed(2) + ' inHg']);
    const hi24 = cToF(nwsVal(obs.maxTemperatureLast24Hours));
    const lo24 = cToF(nwsVal(obs.minTemperatureLast24Hours));
    if (hi24 !== null || lo24 !== null) {
      rows.push(['High / low (24h)',
        (hi24 !== null ? Math.round(hi24) + '&deg;' : '--') + ' / ' +
        (lo24 !== null ? Math.round(lo24) + '&deg;' : '--')]);
    }
    const clouds = cloudLine(obs.cloudLayers);
    if (clouds) rows.push(['Clouds', escHtml(clouds)]);
    const wc = cToF(nwsVal(obs.windChill));
    if (wc !== null) rows.push(['Wind chill', Math.round(wc) + '&deg;']);
    const hi = cToF(nwsVal(obs.heatIndex));
    if (hi !== null) rows.push(['Heat index', Math.round(hi) + '&deg;']);
    const pcp = nwsVal(obs.precipitationLastHour);
    if (pcp !== null && pcp > 0) rows.push(['Precip (1h)', (pcp / 25.4).toFixed(2) + ' in']);
  }
  const astro = pp.astronomicalData || {};
  if (astro.sunrise || astro.sunset) {
    rows.push(['Sun', [astro.sunrise && ('up ' + wxClock(astro.sunrise)),
                       astro.sunset && ('down ' + wxClock(astro.sunset))]
      .filter(Boolean).join(' \u00B7 ')]);
  }
  if (astro.civilTwilightBegin || astro.civilTwilightEnd) {
    rows.push(['Civil twilight', [astro.civilTwilightBegin && wxClock(astro.civilTwilightBegin),
                                  astro.civilTwilightEnd && wxClock(astro.civilTwilightEnd)]
      .filter(Boolean).join(' \u2013 ')]);
  }
  const nwr = pp.nwr && pp.nwr.transmitter;
  if (nwr) rows.push(['Weather radio', escHtml(nwr)]);
  rows.push(['Alerts', alertList.length
    ? escHtml(plural(alertList.length, 'active alert') + ' \u00B7 ' +
              (alertList[0].properties && alertList[0].properties.event || ''))
    : 'none active', alertList.length ? 'warn' : '']);
  const rl = (pp.relativeLocation && pp.relativeLocation.properties) || {};
  const place = [rl.city, rl.state].filter(Boolean).join(', ');
  const elevM = nwsVal(pp.elevation);
  const sub = [stationName && ('Observed at ' + stationName),
               obs && obs.timestamp && wxTime(obs.timestamp),
               place,
               elevM !== null ? Math.round(mToFt(elevM)).toLocaleString() + ' ft' : '',
               pp.radarStation ? 'radar ' + pp.radarStation : '',
               pp.gridId ? pp.gridId + ' grid' : '']
    .filter(Boolean).join(' \u00B7 ');
  const narr = p0 && p0.detailedForecast
    ? '<div class="dash-wx-sec">Today</div><div class="dash-wx-narr">' +
      escHtml(p0.detailedForecast) + '</div>'
    : '';
  const map = 'https://forecast.weather.gov/MapClick.php?lat=' + lat.toFixed(4) +
              '&lon=' + lng.toFixed(4);
  const alertsHtml = alertBlock(alertList);
  return '<div class="dash-wx">' +
         (alertsHtml ? '<div class="dash-wx-alerts">' + alertsHtml + '</div>' : '') +
         '<div class="dash-wx-now">' + head(big, small, rows, sub) + narr + '</div>' +
         '<div class="dash-wx-fc">' + fcStrip(periods) + hourlyStrip(hours) + '</div>' +
         '<div class="dash-wx-end"><div class="dash-foot">' + escHtml(src.source) +
         '<br><a href="' + escHtml(map) + '" target="_blank" rel="noopener">Full NWS forecast page</a>' +
         ' &middot; <a href="#" onclick="dashRetry(\'' + src.id + '\');return false;">Refresh</a></div></div>' +
         '</div>';
}

// ── Wildfire (NIFC WFIGS perimeters, ~250 km box) ─────────────────────
async function loadFire(lat, lng, src) {
  const env = { xmin: lng - 2.6, ymin: lat - 2.0, xmax: lng + 2.6, ymax: lat + 2.0,
                spatialReference: { wkid: 4326 } };
  const url = 'https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/' +
    'WFIGS_Interagency_Perimeters_Current/FeatureServer/0/query?f=json&returnGeometry=false' +
    '&returnCentroid=true&outSR=4326' +
    '&outFields=poly_IncidentName,poly_GISAcres,attr_FireDiscoveryDateTime,attr_POOState,attr_IncidentTypeCategory' +
    '&where=1%3D1&geometryType=esriGeometryEnvelope&inSR=4326' +
    '&spatialRel=esriSpatialRelIntersects&resultRecordCount=40' +
    '&geometry=' + encodeURIComponent(JSON.stringify(env));
  const j = await getJson(url);
  if (j && j.error) throw new Error('ArcGIS: ' + ((j.error && j.error.message) || 'query rejected'));
  const fires = ((j && j.features) || []).map(function (x) {
    const a = x.attributes || {}, c = x.centroid || {};
    return { name: a.poly_IncidentName || 'Unnamed incident',
             acres: Number(a.poly_GISAcres),
             found: Number(a.attr_FireDiscoveryDateTime),
             lat: Number(c.y), lng: Number(c.x),
             km: kmBetween(lat, lng, Number(c.y), Number(c.x)),
             brg: bearingTo(lat, lng, Number(c.y), Number(c.x)) };
  }).sort(function (a, b) {
    return (isFinite(a.km) ? a.km : 1e9) - (isFinite(b.km) ? b.km : 1e9);
  });
  const pts = fires.map(function (f) {
    return { lat: f.lat, lng: f.lng, km: f.km,
             r: Math.max(4, Math.min(15, Math.sqrt(Math.max(1, f.acres || 1)) / 24)),
             fill: 'rgba(239,68,68,0.42)', stroke: '#ef4444',
             label: f.name + ' — ' + Math.round(f.km) + ' km ' + compass16(f.brg) };
  });
  MAPS.fire = {
    lat: lat, lng: lng, points: pts, z: null, capExtra: 'dot size is acreage',
    startZoom: function (W, H) { return zoomFor(lat, 30, Math.min(W, H)); }
  };
  if (!fires.length) {
    MAPS.fire.points = [];
    MAPS.fire.capExtra = '';
    return head('0', 'mapped perimeters nearby',
      [['Search', 'about 250 km around the property']]) +
      mapShell('fire') +
      foot(src, 'Mapped perimeters only — a new fire can burn for hours before a perimeter is published.');
  }
  const near = fires[0];
  const totalAcres = fires.reduce(function (s, f) { return s + (isFinite(f.acres) ? f.acres : 0); }, 0);
  return head(
    isFinite(near.km) ? Math.round(near.km) + '<span class="dash-unit">km</span>' : '--',
    'to the nearest active perimeter',
    [['Nearest', escHtml(near.name) +
        (isFinite(near.acres) ? ' &middot; ' + Math.round(near.acres).toLocaleString() + ' acres' : ''),
      near.km < 25 ? 'warn' : ''],
     ['Bearing', isFinite(near.brg) ? compass16(near.brg) + ' (' + Math.round(near.brg) + '&deg;)' : 'unknown'],
     ['Found', isFinite(near.found) ? escHtml(ago(near.found)) : 'unknown'],
     ['Nearby', plural(fires.length, 'fire') + ' &middot; ' +
        Math.round(totalAcres).toLocaleString() + ' acres total']],
    'Perimeters intersecting a ~250 km box') +
    mapShell('fire') + foot(src);
}

// ── Earthquakes (USGS, M2.5+ within 300 km) ───────────────────────────
async function loadQuake(lat, lng, src) {
  const url = 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson' +
    '&latitude=' + lat.toFixed(4) + '&longitude=' + lng.toFixed(4) +
    '&maxradiuskm=300&minmagnitude=2.5&orderby=time&limit=30';
  const j = await getJson(url);
  const f = ((j && j.features) || []).map(function (q) {
    const p = q.properties || {}, c = (q.geometry && q.geometry.coordinates) || [];
    return { mag: Number(p.mag), place: p.place || 'Unknown location',
             time: Number(p.time), lat: Number(c[1]), lng: Number(c[0]),
             km: kmBetween(lat, lng, c[1], c[0]) };
  });
  const pts = f.map(function (q) {
    return { lat: q.lat, lng: q.lng, km: q.km,
             r: Math.max(3.5, Math.min(14, Math.pow(Math.max(1, q.mag), 1.9) / 2.6)),
             fill: q.mag >= 5 ? 'rgba(239,68,68,0.45)' : 'rgba(249,115,22,0.38)',
             stroke: q.mag >= 5 ? '#ef4444' : '#f97316',
             label: 'M' + q.mag.toFixed(1) + ' — ' + q.place };
  });
  MAPS.quake = {
    lat: lat, lng: lng, points: pts, z: null, capExtra: 'dot size is magnitude',
    startZoom: function (W, H) {
      const far = Math.max(150, Math.max.apply(null, pts.map(function (p) {
        return isFinite(p.km) ? p.km : 0;
      }).concat([0])));
      return zoomFor(lat, far, Math.min(W, H));
    }
  };
  if (!f.length) {
    MAPS.quake.points = [];
    MAPS.quake.capExtra = '';
    return head('0', 'No recorded quakes', [['Search', 'M2.5+ within 300 km']]) +
           mapShell('quake') +
           foot(src, 'Nothing in the USGS catalog for this area.');
  }
  const nearest = f.slice().sort(function (a, b) { return a.km - b.km; })[0];
  const largest = f.slice().sort(function (a, b) { return b.mag - a.mag; })[0];
  return head(
    isFinite(nearest.km) ? Math.round(nearest.km) + '<span class="dash-unit">km</span>' : '--',
    'to the nearest recorded quake',
    [['Nearest', 'M' + nearest.mag.toFixed(1) + ' &middot; ' + escHtml(ago(nearest.time))],
     ['Largest', 'M' + largest.mag.toFixed(1) + ' &middot; ' + escHtml(ago(largest.time)),
      largest.mag >= 5 ? 'warn' : ''],
     ['Total', plural(f.length, 'event') + ' in the search window']],
    'M2.5+ within 300 km of the property') +
    mapShell('quake') + foot(src);
}

// ── FEMA declarations (OpenFEMA, keyed on the county from NWS /points) ─
async function loadFema(lat, lng, src) {
  const pp = ((await points(lat, lng)) || {}).properties || {};
  const zone = String(pp.county || '').split('/').pop();
  const m = /^([A-Z]{2})C(\d{3})$/.exec(zone);
  if (!m || !STATE_FIPS[m[1]]) throw new Error('Could not determine the county');
  const filt = "fipsStateCode eq '" + STATE_FIPS[m[1]] + "' and fipsCountyCode eq '" + m[2] + "'";
  const base = 'https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries?$filter=' +
    encodeURIComponent(filt) + '&$orderby=declarationDate desc';
  const rows = [];
  for (let skip = 0; skip < 1000; skip += 100) {
    const j = await getJson(base + '&$top=100&$skip=' + skip);
    const page = (j && j.DisasterDeclarationsSummaries) || [];
    rows.push.apply(rows, page);
    if (page.length < 100) break;
  }
  if (!rows.length) return head('0', 'federal declarations on record', []) + foot(src);
  const byType = {};
  rows.forEach(function (d) {
    const k = d.incidentType || 'Other';
    byType[k] = (byType[k] || 0) + 1;
  });
  const top = Object.keys(byType).sort(function (a, b) { return byType[b] - byType[a]; });
  const newest = rows[0];
  const since = String(rows[rows.length - 1].declarationDate || '').slice(0, 4);
  const list = rows.map(function (d) {
    const when = String(d.declarationDate || '').slice(0, 10);
    const title = d.declarationTitle || d.disasterNumber || '';
    return '<div class="dash-list-row"><div class="dash-list-k">' +
      escHtml(when) + (d.incidentType ? ' \u00B7 ' + escHtml(d.incidentType) : '') +
      '</div>' + escHtml(title) + '</div>';
  }).join('');
  return head(String(rows.length), 'federal declarations since ' + escHtml(since),
    [['County', escHtml(String(newest.designatedArea || 'this county').replace(' (County)', ' County'))],
     ['Most recent', escHtml(newest.incidentType || '') + ' &middot; ' +
        escHtml(String(newest.declarationDate || '').slice(0, 4))],
     ['Most common', top.slice(0, 3).map(function (k) {
        return escHtml(k) + ' (' + byType[k] + ')'; }).join(', ')]]) +
    listBlock(list) + foot(src);
}

// ── Space weather (NOAA SWPC bulletins + scale meter) ─────────────────
function scaleName(s) {
  const n = { G: 'Geomagnetic storm', R: 'Radio blackout', S: 'Solar radiation storm' }[s[0]];
  const lvl = ['', 'minor', 'moderate', 'strong', 'severe', 'extreme'][Number(s[1])] || '';
  return (n || 'Space weather') + (lvl ? ' — ' + lvl : '');
}
function spaceMeter(sc) {
  const fam = sc.charAt(0), lvl = Number(sc.charAt(1));
  const cols = ['#22c55e', '#eab308', '#f59e0b', '#f97316', '#ef4444'];
  const words = ['minor', 'moderate', 'strong', 'severe', 'extreme'];
  let h = '<div class="dash-meter">';
  for (let i = 1; i <= 5; i++) {
    h += '<div class="dash-seg' + (i <= lvl ? ' on' : '') + '"' +
         (i <= lvl ? ' style="background:' + cols[i - 1] + ';border-color:' + cols[i - 1] + '"' : '') +
         '><span>' + fam + i + '</span><em>' + words[i - 1] + '</em></div>';
  }
  return h + '</div>';
}
async function loadSpace(lat, lng, src) {
  const j = await getJson('https://services.swpc.noaa.gov/products/alerts.json');
  const rows = Array.isArray(j) ? j : [];
  if (!rows.length) return head('0', 'active bulletins', []) + foot(src);
  const newest = rows[0];
  const scale = (String(newest.message || '').match(/\b([GRS][1-5])\b/) || [])[1];
  let h = head(escHtml(scale || String(newest.product_id || '?')),
    scale ? escHtml(scaleName(scale)) : 'most recent bulletin',
    [['Issued', escHtml(String(newest.issue_datetime || '')) + ' UTC'],
     ['Active', plural(rows.length, 'bulletin') + ' in the current feed']],
    'NOAA Space Weather Prediction Center');
  if (scale) h += spaceMeter(scale);
  const list = rows.map(function (d) {
    const msg = String(d.message || '');
    const sc = (msg.match(/\b([GRS][1-5])\b/) || [])[1];
    const line = msg.split('\n').map(function (s) { return s.trim(); })
      .filter(function (s) { return s && !/^ALERT:/i.test(s); })[0] || msg.slice(0, 120);
    return '<div class="dash-list-row"><div class="dash-list-k">' +
      escHtml(String(d.issue_datetime || '')) + ' UTC' +
      (d.product_id ? ' \u00B7 ' + escHtml(d.product_id) : '') +
      '</div>' + escHtml(sc ? scaleName(sc) : line) + '</div>';
  }).join('');
  return h + listBlock(list) + foot(src);
}

// ── More sources (static list, mirrors model-viewer's info tab) ────────
const UNAVAILABLE = [
  { group: 'Planned additions', items: [
      { n: 'Satellite wildfire detection', u: 'https://firms.modaps.eosdis.nasa.gov/',
        w: 'New fire detections within hours of ignition.' },
      { n: 'Air quality index', u: 'https://www.airnow.gov/',
        w: 'EPA air quality readings and forecasts.' },
      { n: 'Drought conditions', u: 'https://droughtmonitor.unl.edu/',
        w: 'Weekly drought severity for the county.' }
    ] },
  { group: 'Under review', items: [
      { n: 'River levels and flood forecast', u: 'https://water.noaa.gov/',
        w: 'River gauge levels, flood stage and forecast crest.' },
      { n: 'Deschutes County open data', u: 'https://data-deschutes.opendata.arcgis.com/',
        w: 'County parcels, zoning, hazard overlays and public safety layers.' },
      { n: 'City of Bend open data', u: 'https://data-bendoregon.opendata.arcgis.com/',
        w: 'City addresses, utilities, zoning and public safety layers.' }
    ] }
];
async function loadInfo(lat, lng, src) {
  let h = head(String(UNAVAILABLE.reduce(function (s, g) { return s + g.items.length; }, 0)),
    'additional data sources being added', []);
  UNAVAILABLE.forEach(function (g) {
    h += '<div class="dash-sec">' + escHtml(g.group) + '</div>';
    g.items.forEach(function (it) {
      h += '<div class="dash-item"><a href="' + escHtml(it.u) +
           '" target="_blank" rel="noopener">' + escHtml(it.n) + '</a>' +
           '<div class="dash-item-w">' + escHtml(it.w) + '</div></div>';
    });
  });
  return h + foot(src);
}

const LOADERS = { wx: loadWx, fire: loadFire, quake: loadQuake,
                  fema: loadFema, space: loadSpace, info: loadInfo };

export function loadSourceCard(id, lat, lng) {
  const src = DASH_SOURCES.find(function (s) { return s.id === id; });
  if (!src || !LOADERS[id]) return Promise.reject(new Error('unknown source ' + id));
  return LOADERS[id](lat, lng, src);
}
