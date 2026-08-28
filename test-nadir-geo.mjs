// Unit + Cottage Grove oracle for NadirGeo.parcelHit (nadir-geo.js 1.3.2).
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = dirname(fileURLToPath(import.meta.url));
eval(readFileSync(join(root, 'nadir-geo.js'), 'utf8'));
const NG = globalThis.NadirGeo;
if (!NG || NG._version !== '1.3.2') {
  throw new Error('expected NadirGeo 1.3.2, got ' + (NG && NG._version));
}

let failed = 0;
function ok(name, cond, detail) {
  if (cond) console.log('ok  ' + name);
  else { failed++; console.log('FAIL ' + name + (detail ? ' — ' + detail : '')); }
}

const square = function (lng, lat, d) {
  return [[lng, lat], [lng + d, lat], [lng + d, lat + d], [lng, lat + d], [lng, lat]];
};

// Hole: outer 1x1, hole 0.2x0.2 in the middle. Point in hole is NOT inside.
const leftover = {
  type: 'Feature',
  properties: { MAPTAXLOT: '2003283300077', TAXLOT: '77', ACCTNO: '000None', MAPACRES: 11 },
  geometry: {
    type: 'Polygon',
    coordinates: [
      square(-123.064, 43.796, 0.002),
      square(-123.0634, 43.7964, 0.0004)
    ]
  }
};
const realLot = {
  type: 'Feature',
  properties: { MAPTAXLOT: '2003283304200', TAXLOT: '4200', ACCTNO: '0895522', MAPACRES: 0.13 },
  geometry: { type: 'Polygon', coordinates: [square(-123.0634, 43.7964, 0.0004)] }
};
const biggerLot = {
  type: 'Feature',
  properties: { MAPTAXLOT: '2003283304100', TAXLOT: '4100', ACCTNO: '0895514', MAPACRES: 0.38 },
  geometry: { type: 'Polygon', coordinates: [square(-123.0634, 43.7964, 0.0004)] }
};
const geo = { type: 'FeatureCollection', features: [leftover, biggerLot, realLot] };

ok('skip 000None', NG.isUnaccountedParcel(leftover.properties) === true);
ok('skip TAXLOT 77', NG.isUnaccountedParcel({ TAXLOT: '77' }) === true);
ok('skip TAXLOT 88', NG.isUnaccountedParcel({ TAXLOT: '88' }) === true);
ok('skip TAXLOT 99', NG.isUnaccountedParcel({ TAXLOT: '99' }) === true);
ok('keep real Lane lot', NG.isUnaccountedParcel(realLot.properties) === false);
ok('keep Deschutes TAXLOT', NG.isUnaccountedParcel({ TAXLOT: '191130DB00100' }) === false);

ok('hole is not inside leftover',
  NG.polyContains(leftover.geometry.coordinates, 43.79655, -123.06325) === false);
ok('outer but not hole is inside leftover',
  NG.polyContains(leftover.geometry.coordinates, 43.7961, -123.0639) === true);

const inLot = NG.parcelHit(geo, 43.79655, -123.06325);
ok('smallest accounted lot wins', inLot && inLot.taxlot === '2003283304200',
  inLot && inLot.taxlot);
ok('outer-only first-hit would have been the leftover',
  leftover.properties.TAXLOT === '77' && geo.features[0] === leftover);

const onStreet = NG.parcelHit(geo, 43.7961, -123.0639);
ok('street-only point draws nothing', onStreet === null);

const tilePath = join(root, 'data/parcels/lane_43.75_-123.08.geojson');
if (existsSync(tilePath)) {
  const tile = JSON.parse(readFileSync(tilePath, 'utf8'));
  const cg = NG.parcelHit(tile, 43.7965083, -123.0631915);
  ok('Cottage Grove building -> 2003283304200',
    cg && cg.taxlot === '2003283304200', cg && cg.taxlot);
  const street = NG.parcelHit(tile, 43.79650, -123.06285);
  ok('Cottage Grove S 5th centerline -> no overlay', street === null,
    street && street.taxlot);
} else {
  console.log('skip live tile (not in tree)');
}

if (failed) {
  console.log(failed + ' failed');
  process.exit(1);
}
console.log('all passed');
