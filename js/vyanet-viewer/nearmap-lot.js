// Taxlot clip + observed Nearmap facts for product surfaces.
// Geometry in a local metre frame (never absolute projected metres).
// Does not write GitHub data/. Does not flatten catalog role=.
// Writer of observed.json is tools/nearmap/lot_clip.py → promote.py (S3).
// The viewer recomputes facts from ai/edits/regions.json so a reviewer save wins.

export const PARCEL_COUNTIES = [
  { name: 'deschutes', lat0: 43.61, lng0: -122.01, step: 0.07 },
  { name: 'lane', lat0: 43.40, lng0: -124.20, step: 0.07 }
];
export const PARCEL_PAGES = 'https://responder-intel.vyanet.com/data/parcels/';

export const COVER_GROUPS = {
  building: {
    id: 'building',
    label: 'Building',
    color: '#e85d04',
    classes: ['Building', 'Building (Deprecated)', 'Roof', 'Translucent Roofing']
  },
  drive: {
    id: 'drive',
    label: 'Driveway',
    color: '#f72585',
    classes: ['Driveway', 'Asphalt', 'Road (Driveable Surface)']
  },
  veg: {
    id: 'veg',
    label: 'Vegetation',
    color: '#2d6a4f',
    classes: [
      'Woody Vegetation',
      'Tree Overhang',
      'Medium and High Vegetation (>2m)',
      'Medium and High Vegetation with Woody Vegetation',
      'Leaf-off Vegetation'
    ]
  },
  pool: {
    id: 'pool',
    label: 'Pool',
    color: '#4cc9f0',
    classes: ['Swimming Pool', 'Water Body']
  }
};
export const COVER_ORDER = ['building', 'drive', 'veg', 'pool'];
export const FT5_M = 1.524;
export const FT30_M = 9.144;
export const EARTH_A = 6378137.0;

export function metresPerDegLat(lat) {
  const p = lat * Math.PI / 180;
  return 111132.954 - 559.822 * Math.cos(2 * p) + 1.175 * Math.cos(4 * p);
}
export function metresPerDegLng(lat) {
  return EARTH_A * Math.PI / 180 * Math.cos(lat * Math.PI / 180);
}

export function parcelFileFor(lat, lng, county) {
  const latCell = Math.floor((lat - county.lat0) / county.step) * county.step + county.lat0;
  const lngCell = Math.floor((lng - county.lng0) / county.step) * county.step + county.lng0;
  return county.name + '_' + latCell.toFixed(2) + '_' + lngCell.toFixed(2) + '.geojson';
}

export function isUnaccountedParcel(props) {
  props = props || {};
  if (String(props.ACCTNO || '') === '000None') return true;
  const raw = String(props.TAXLOT || '');
  if (!/^\d+$/.test(raw)) return false;
  const n = Number(raw);
  return n === 77 || n === 88 || n === 99;
}

export function featureClass(f) {
  return (f && f.properties && (f.properties['class'] || f.properties.description)) || 'Unknown';
}

export function coverGroup(className) {
  const n = String(className || '');
  for (let i = 0; i < COVER_ORDER.length; i++) {
    const id = COVER_ORDER[i];
    if (COVER_GROUPS[id].classes.indexOf(n) !== -1) return id;
  }
  return '';
}

export function featureRings(f) {
  const g = (f && f.geometry) || {};
  if (g.type === 'Polygon') return [g.coordinates];
  if (g.type === 'MultiPolygon') return g.coordinates || [];
  return [];
}

export function geojsonPolys(geom) {
  if (!geom) return [];
  if (geom.type === 'Polygon') return geom.coordinates ? [geom.coordinates] : [];
  if (geom.type === 'MultiPolygon') return geom.coordinates || [];
  return [];
}

export function pointInLngLatRing(lat, lng, ring) {
  let inside = false;
  if (!ring || ring.length < 4) return false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if (((yi > lat) !== (yj > lat)) &&
        (lng < (xj - xi) * (lat - yi) / ((yj - yi) || 1e-12) + xi)) inside = !inside;
  }
  return inside;
}

export function polyContainsLngLat(poly, lat, lng) {
  if (!poly || !poly[0] || poly[0].length < 4 || !pointInLngLatRing(lat, lng, poly[0])) return false;
  for (let h = 1; h < poly.length; h++) {
    if (poly[h] && poly[h].length >= 4 && pointInLngLatRing(lat, lng, poly[h])) return false;
  }
  return true;
}

export function lotContainsLngLat(lotPolys, lat, lng) {
  if (!lotPolys || !lotPolys.length) return false;
  for (let i = 0; i < lotPolys.length; i++) {
    if (polyContainsLngLat(lotPolys[i], lat, lng)) return true;
  }
  return false;
}

function featAreaAbs(feat) {
  const acres = Number((feat.properties || {}).MAPACRES);
  if (isFinite(acres) && acres > 0) return acres;
  const polys = geojsonPolys(feat.geometry);
  let sum = 0;
  for (let i = 0; i < polys.length; i++) {
    const ring = polys[i] && polys[i][0];
    if (!ring) continue;
    let a = 0;
    for (let j = 0, k = ring.length - 1; j < ring.length; k = j++) {
      a += ring[k][0] * ring[j][1] - ring[j][0] * ring[k][1];
    }
    sum += Math.abs(a) / 2;
  }
  return sum;
}

export function parcelMatch(geojson, lat, lng) {
  if (!geojson || !geojson.features) return null;
  let best = null, bestArea = Infinity;
  for (let i = 0; i < geojson.features.length; i++) {
    const f = geojson.features[i], g = f.geometry;
    if (!g || isUnaccountedParcel(f.properties)) continue;
    const polys = geojsonPolys(g);
    let hit = false;
    for (let p = 0; p < polys.length; p++) {
      if (polyContainsLngLat(polys[p], lat, lng)) { hit = true; break; }
    }
    if (!hit) continue;
    const area = featAreaAbs(f);
    if (area < bestArea) { best = f; bestArea = area; }
  }
  return best;
}

export function lotFromFeature(feat) {
  if (!feat || !feat.geometry) return null;
  const polys = geojsonPolys(feat.geometry);
  if (!polys.length) return null;
  const p = feat.properties || {};
  return {
    feature: feat,
    polys: polys,
    taxlot: String(p.MAPTAXLOT || p.TAXLOT || ''),
    bounds: lotBounds(polys)
  };
}

export function lotBounds(lotPolys) {
  let north = -Infinity, south = Infinity, east = -Infinity, west = Infinity;
  (lotPolys || []).forEach(function (poly) {
    (poly[0] || []).forEach(function (pt) {
      const lng = pt[0], lat = pt[1];
      if (lat > north) north = lat;
      if (lat < south) south = lat;
      if (lng > east) east = lng;
      if (lng < west) west = lng;
    });
  });
  if (!isFinite(north) || !(north > south) || !(east > west)) return null;
  return { north: north, south: south, east: east, west: west };
}

async function fetchGeojson(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) return null;
  return await res.json();
}

export async function loadTaxlot(dataRoot, lat, lng) {
  const la = Number(lat), lo = Number(lng);
  if (!isFinite(la) || !isFinite(lo)) return null;
  const root = String(dataRoot || '').replace(/\/?$/, '/');
  const names = PARCEL_COUNTIES.map(function (c) { return parcelFileFor(la, lo, c); });
  const bases = [];
  if (root) bases.push(root + 'parcels/');
  if (bases.indexOf(PARCEL_PAGES) === -1) bases.push(PARCEL_PAGES);
  for (let b = 0; b < bases.length; b++) {
    for (let i = 0; i < names.length; i++) {
      try {
        const gj = await fetchGeojson(bases[b] + names[i]);
        const feat = parcelMatch(gj, la, lo);
        const lot = lotFromFeature(feat);
        if (lot) return lot;
      } catch (e) { /* tile 404s are normal */ }
    }
  }
  return null;
}

export function featureIntersectsLot(feat, lotPolys) {
  if (!lotPolys || !lotPolys.length) return false;
  const rings = featureRings(feat);
  for (let r = 0; r < rings.length; r++) {
    const outer = rings[r][0] || [];
    for (let i = 0; i < outer.length; i++) {
      if (lotContainsLngLat(lotPolys, outer[i][1], outer[i][0])) return true;
    }
  }
  for (let p = 0; p < lotPolys.length; p++) {
    const lotOuter = lotPolys[p][0] || [];
    for (let i = 0; i < lotOuter.length; i++) {
      const lng = lotOuter[i][0], lat = lotOuter[i][1];
      for (let r = 0; r < rings.length; r++) {
        if (polyContainsLngLat(rings[r], lat, lng)) return true;
      }
    }
  }
  return false;
}

export function displayFeatures(fc, lotPolys, clip) {
  const feats = (fc && fc.features) || [];
  if (!clip || !lotPolys) return feats.slice();
  return feats.filter(function (f) { return featureIntersectsLot(f, lotPolys); });
}

export function padBounds(b, frac) {
  if (!b) return null;
  const f = frac == null ? 0.12 : frac;
  const dlat = (b.north - b.south) * f;
  const dlng = (b.east - b.west) * f;
  return {
    north: b.north + dlat,
    south: b.south - dlat,
    east: b.east + dlng,
    west: b.west - dlng
  };
}

export function maskOuterRing(aoiBounds, padFrac) {
  const b = aoiBounds;
  const pad = padFrac == null ? 3 : padFrac;
  const dlat = (b.north - b.south) * pad;
  const dlng = (b.east - b.west) * pad;
  return [
    [b.west - dlng, b.north + dlat],
    [b.east + dlng, b.north + dlat],
    [b.east + dlng, b.south - dlat],
    [b.west - dlng, b.south - dlat],
    [b.west - dlng, b.north + dlat]
  ];
}

export function mapsPathsFromLot(lotPolys) {
  return (lotPolys || []).map(function (poly) {
    return (poly[0] || []).map(function (pt) { return { lat: pt[1], lng: pt[0] }; });
  }).filter(function (path) { return path.length >= 3; });
}

export function mapsMaskPaths(aoiBounds, lotPolys) {
  // Modest pad around the lot (camera is locked to the lot). Huge geodesic
  // outers swallow the hole and paint the taxlot black.
  const lotB = lotBounds(lotPolys);
  const b = lotB || aoiBounds;
  const outer = maskOuterRing(b, 3).map(function (pt) {
    return { lat: pt[1], lng: pt[0] };
  });
  const holes = mapsPathsFromLot(lotPolys).map(function (path) {
    return path.slice();
  });
  function signedArea(path) {
    let sum = 0;
    for (let i = 0, j = path.length - 1; i < path.length; j = i++) {
      sum += path[j].lng * path[i].lat - path[i].lng * path[j].lat;
    }
    return sum;
  }
  if (signedArea(outer) > 0) outer.reverse();
  holes.forEach(function (path) {
    if (signedArea(path) < 0) path.reverse();
  });
  return [outer].concat(holes);
}

function localFrame(lng0, lat0) {
  return {
    kx: metresPerDegLng(lat0),
    ky: metresPerDegLat(lat0),
    lng0: lng0,
    lat0: lat0,
    xy: function (lng, lat) {
      return { x: (lng - lng0) * this.kx, y: (lat - lat0) * this.ky };
    }
  };
}

function ringAreaM2(ringLngLat, fr) {
  if (!ringLngLat || ringLngLat.length < 4) return 0;
  const pts = [];
  for (let i = 0; i < ringLngLat.length; i++) {
    pts.push(fr.xy(ringLngLat[i][0], ringLngLat[i][1]));
  }
  if (pts.length > 1) {
    const a = pts[0], b = pts[pts.length - 1];
    if (Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6) pts.pop();
  }
  let sum = 0;
  const n = pts.length;
  if (n < 3) return 0;
  for (let i = 0, j = n - 1; i < n; j = i++) sum += pts[j].x * pts[i].y - pts[i].x * pts[j].y;
  return Math.abs(sum) / 2;
}

export function lotAreaM2(lotPolys) {
  if (!lotPolys || !lotPolys.length) return 0;
  const o = lotPolys[0][0][0];
  const fr = localFrame(o[0], o[1]);
  let area = 0;
  lotPolys.forEach(function (poly) {
    area += ringAreaM2(poly[0], fr);
    for (let h = 1; h < poly.length; h++) area -= ringAreaM2(poly[h], fr);
  });
  return Math.max(0, area);
}

function distPointSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const L2 = dx * dx + dy * dy;
  let t = L2 ? ((px - ax) * dx + (py - ay) * dy) / L2 : 0;
  t = t < 0 ? 0 : (t > 1 ? 1 : t);
  const qx = ax + t * dx, qy = ay + t * dy;
  return Math.sqrt((px - qx) * (px - qx) + (py - qy) * (py - qy));
}

function minDistRingsM(ringsA, ringsB, fr) {
  let best = Infinity;
  function verts(rings) {
    const out = [];
    rings.forEach(function (ring) {
      (ring || []).forEach(function (pt) { out.push(fr.xy(pt[0], pt[1])); });
    });
    return out;
  }
  function segs(rings) {
    const out = [];
    rings.forEach(function (ring) {
      if (!ring || ring.length < 2) return;
      for (let i = 0; i < ring.length - 1; i++) {
        const a = fr.xy(ring[i][0], ring[i][1]);
        const b = fr.xy(ring[i + 1][0], ring[i + 1][1]);
        out.push([a, b]);
      }
    });
    return out;
  }
  const va = verts(ringsA), sb = segs(ringsB);
  const vb = verts(ringsB), sa = segs(ringsA);
  va.forEach(function (p) {
    sb.forEach(function (s) {
      const d = distPointSeg(p.x, p.y, s[0].x, s[0].y, s[1].x, s[1].y);
      if (d < best) best = d;
    });
  });
  vb.forEach(function (p) {
    sa.forEach(function (s) {
      const d = distPointSeg(p.x, p.y, s[0].x, s[0].y, s[1].x, s[1].y);
      if (d < best) best = d;
    });
  });
  return best;
}

function outersOf(features) {
  const rings = [];
  features.forEach(function (f) {
    featureRings(f).forEach(function (poly) {
      if (poly[0] && poly[0].length >= 4) rings.push(poly[0]);
    });
  });
  return rings;
}

export function observedFacts(features, lotPolys, opt) {
  opt = opt || {};
  const lot_area_m2 = lotAreaM2(lotPolys);
  const onLot = (features || []).filter(function (f) {
    return !lotPolys || featureIntersectsLot(f, lotPolys);
  });
  const byGroup = { building: [], drive: [], veg: [], pool: [], roof: [], solar: [], lawn: [], overhang: [] };
  onLot.forEach(function (f) {
    const cls = featureClass(f);
    const g = coverGroup(cls);
    if (g) byGroup[g].push(f);
    if (cls === 'Roof' || cls === 'Translucent Roofing') byGroup.roof.push(f);
    if (cls === 'Solar Panel') byGroup.solar.push(f);
    if (cls === 'Lawn Grass') byGroup.lawn.push(f);
    if (cls === 'Tree Overhang') byGroup.overhang.push(f);
  });
  const origin = (lotPolys && lotPolys[0] && lotPolys[0][0] && lotPolys[0][0][0]) || [0, 0];
  const fr = localFrame(origin[0], origin[1]);
  function areaOf(list) {
    let a = 0;
    list.forEach(function (f) {
      featureRings(f).forEach(function (poly) {
        a += ringAreaM2(poly[0], fr);
        for (let h = 1; h < poly.length; h++) a -= ringAreaM2(poly[h], fr);
      });
    });
    return Math.max(0, a);
  }
  // Full vendor polygons that merely touch the lot over-count. Cap at lot area.
  function cap(v) { return lot_area_m2 > 0 ? Math.min(v, lot_area_m2) : v; }
  const building_m2 = cap(areaOf(byGroup.building));
  const driveway_m2 = cap(areaOf(byGroup.drive));
  const veg_m2 = cap(areaOf(byGroup.veg));
  const pool_m2 = cap(areaOf(byGroup.pool));
  const roof_m2 = cap(areaOf(byGroup.roof));
  const solar_m2 = cap(areaOf(byGroup.solar));
  const lawn_m2 = cap(areaOf(byGroup.lawn));
  let min_veg_to_building_m = null;
  let within_5ft = 0;
  let within_30ft = 0;
  const bRings = outersOf(byGroup.building);
  const vFeats = byGroup.veg;
  if (bRings.length && vFeats.length) {
    min_veg_to_building_m = Infinity;
    vFeats.forEach(function (f) {
      const d = minDistRingsM(outersOf([f]), bRings, fr);
      if (d < min_veg_to_building_m) min_veg_to_building_m = d;
      if (d <= FT5_M) within_5ft += 1;
      if (d <= FT30_M) within_30ft += 1;
    });
    if (!isFinite(min_veg_to_building_m)) min_veg_to_building_m = null;
  }
  const overhang = byGroup.overhang.length > 0 ||
    (min_veg_to_building_m != null && min_veg_to_building_m < 0.5);
  const veg_pct_lot = lot_area_m2 > 0 ? (100 * veg_m2 / lot_area_m2) : null;
  return {
    source: 'regions',
    survey_date: opt.survey_date || '',
    taxlot: opt.taxlot || '',
    lot_area_m2: round1(lot_area_m2),
    building_m2: round1(building_m2),
    driveway_m2: round1(driveway_m2),
    veg_m2: round1(veg_m2),
    pool_m2: round1(pool_m2),
    roof_m2: round1(roof_m2),
    solar_m2: round1(solar_m2),
    lawn_m2: round1(lawn_m2),
    veg_pct_lot: veg_pct_lot == null ? null : round1(veg_pct_lot),
    defensible: {
      min_veg_to_building_m: min_veg_to_building_m == null ? null : round1(min_veg_to_building_m),
      within_5ft: within_5ft,
      within_30ft: within_30ft,
      overhang: !!overhang
    },
    counts: {
      building: byGroup.building.length,
      drive: byGroup.drive.length,
      veg: byGroup.veg.length,
      pool: byGroup.pool.length
    }
  };
}

function round1(n) { return Math.round(Number(n) * 10) / 10; }

export function fmtM2(n) {
  if (n == null || !isFinite(n)) return '—';
  if (n >= 1000) return Math.round(n).toLocaleString() + ' m²';
  return (Math.round(n * 10) / 10) + ' m²';
}

export function factsHtml(facts, esc) {
  const e = typeof esc === 'function' ? esc : function (s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c];
    });
  };
  if (!facts) return '';
  const d = facts.defensible || {};
  const min = d.min_veg_to_building_m;
  const minTxt = min == null ? 'no woody veg on lot' : (min + ' m');
  const date = facts.survey_date ? e(facts.survey_date) : '';
  const rows = [
    ['Lot', fmtM2(facts.lot_area_m2)],
    ['Building', fmtM2(facts.building_m2)],
    ['Roof', fmtM2(facts.roof_m2)],
    ['Driveway', fmtM2(facts.driveway_m2)],
    ['Woody veg', fmtM2(facts.veg_m2) + (facts.veg_pct_lot != null ? ' (' + facts.veg_pct_lot + '% of lot)' : '')],
    ['Lawn', fmtM2(facts.lawn_m2)],
    ['Pool', fmtM2(facts.pool_m2)],
    ['Solar', fmtM2(facts.solar_m2)],
    ['Veg → building', minTxt],
    ['Inside 5 ft / 30 ft', d.within_5ft + ' / ' + d.within_30ft + ' patches'],
    ['Roof overhang', d.overhang ? 'Yes' : 'No']
  ];
  let html = '<div class="nm-obs">';
  html += '<div class="nm-obs-kicker">Observed' + (date ? ' · Nearmap ' + date : '') + '</div>';
  if (facts.taxlot) html += '<div class="nm-obs-tax">' + e(facts.taxlot) + '</div>';
  rows.forEach(function (row) {
    html += '<div class="nm-obs-row"><span>' + e(row[0]) + '</span><span>' + e(row[1]) + '</span></div>';
  });
  html += '<div class="nm-obs-note">From edited Nearmap regions clipped to the taxlot. GIS Property Facts stay on hub 2D/3D.</div>';
  html += '</div>';
  return html;
}

export async function fetchObservedJson(url) {
  if (!url) return null;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const j = await res.json();
    return j && typeof j === 'object' ? j : null;
  } catch (e) {
    return null;
  }
}
