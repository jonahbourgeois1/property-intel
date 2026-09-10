// node --check + synthetic lot/region tests for js/vyanet-viewer/nearmap-lot.js
import {
  parcelFileFor, PARCEL_COUNTIES, coverGroup, featureIntersectsLot,
  displayFeatures, observedFacts, lotAreaM2, FT5_M, FT30_M,
  mapsMaskPaths, padBounds, lotContainsLngLat
} from './js/vyanet-viewer/nearmap-lot.js';

let failed = 0;
function eq(name, got, want) {
  const ok = Object.is(got, want) || (got === want);
  if (!ok) {
    failed += 1;
    console.error('FAIL', name, 'got', got, 'want', want);
  }
}
function near(name, got, want, tol) {
  if (!(Math.abs(got - want) <= (tol || 0.15))) {
    failed += 1;
    console.error('FAIL', name, 'got', got, 'want', want);
  }
}

const jonesLat = 44.0414545, jonesLng = -121.3786406;
eq('jones parcel file', parcelFileFor(jonesLat, jonesLng, PARCEL_COUNTIES[0]),
  'deschutes_44.03_-121.38.geojson');
eq('building group', coverGroup('Building'), 'building');
eq('driveway group', coverGroup('Driveway'), 'drive');
eq('woody group', coverGroup('Woody Vegetation'), 'veg');
eq('pool group', coverGroup('Swimming Pool'), 'pool');
eq('lawn not cover', coverGroup('Lawn Grass'), '');

// 10 m × 10 m lot around a local origin, plus a 4×4 m building and a veg patch.
const lat0 = 44.04, lng0 = -121.38;
const mLat = 111132.954 - 559.822 * Math.cos(2 * lat0 * Math.PI / 180);
const mLng = 6378137 * Math.PI / 180 * Math.cos(lat0 * Math.PI / 180);
function ll(x, y) { return [lng0 + x / mLng, lat0 + y / mLat]; }
function sq(x0, y0, x1, y1) {
  return [[ll(x0, y0), ll(x1, y0), ll(x1, y1), ll(x0, y1), ll(x0, y0)]];
}
const lotPolys = [sq(0, 0, 10, 10)];
near('lot area', lotAreaM2(lotPolys), 100, 1);

const building = {
  type: 'Feature',
  properties: { class: 'Building' },
  geometry: { type: 'Polygon', coordinates: sq(3, 3, 7, 7) }
};
const vegFar = {
  type: 'Feature',
  properties: { class: 'Woody Vegetation' },
  geometry: { type: 'Polygon', coordinates: sq(8.5, 8.5, 9.5, 9.5) }
};
const vegClose = {
  type: 'Feature',
  properties: { class: 'Woody Vegetation' },
  geometry: { type: 'Polygon', coordinates: sq(7.2, 4, 8.2, 5) }
};
const neighbor = {
  type: 'Feature',
  properties: { class: 'Driveway' },
  geometry: { type: 'Polygon', coordinates: sq(20, 20, 22, 22) }
};
eq('building on lot', featureIntersectsLot(building, lotPolys), true);
eq('neighbor off lot', featureIntersectsLot(neighbor, lotPolys), false);
eq('display drops neighbor', displayFeatures({ features: [building, neighbor] }, lotPolys, true).length, 1);
eq('display keeps all when unclipped', displayFeatures({ features: [building, neighbor] }, lotPolys, false).length, 2);
eq('lot contains building centre', lotContainsLngLat(lotPolys, ll(5, 5)[1], ll(5, 5)[0]), true);
eq('lot excludes neighbor', lotContainsLngLat(lotPolys, ll(21, 21)[1], ll(21, 21)[0]), false);
const mask = mapsMaskPaths({ north: lat0 + 1, south: lat0 - 1, east: lng0 + 1, west: lng0 - 1 }, lotPolys);
eq('mask outer plus hole', mask.length, 2);
eq('mask hole is the lot ring', mask[1].length >= 4, true);
function signed(path) {
  let sum = 0;
  for (let i = 0, j = path.length - 1; i < path.length; j = i++) {
    sum += path[j].lng * path[i].lat - path[i].lng * path[j].lat;
  }
  return sum;
}
eq('mask outer clockwise', signed(mask[0]) < 0, true);
eq('mask hole ccw', signed(mask[1]) > 0, true);
const padded = padBounds({ north: 1, south: 0, east: 1, west: 0 }, 0.1);
near('pad north', padded.north, 1.1, 1e-9);

const facts = observedFacts([building, vegFar, vegClose, neighbor], lotPolys, { survey_date: '2026-07-02' });
near('building m2', facts.building_m2, 16, 1);
eq('neighbor driveway excluded', facts.driveway_m2, 0);
eq('two veg patches', facts.counts.veg, 2);
eq('close patch inside 5ft', facts.defensible.within_5ft >= 1, true);
eq('far patch inside 30ft', facts.defensible.within_30ft, 2);
eq('min dist finite', facts.defensible.min_veg_to_building_m != null && facts.defensible.min_veg_to_building_m < FT5_M, true);
eq('min dist not the far patch only', facts.defensible.min_veg_to_building_m < 4, true);
eq('30ft constant', FT30_M > 9, true);

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('test-nearmap-lot.mjs ok');
