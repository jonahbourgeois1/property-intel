// Merge rules, URL shape, and page structure for camera-pin-editor 1.0.1.
import { readFileSync, writeFileSync, unlinkSync, readdirSync } from 'fs';
import { execFileSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import {
  BUILD, MAX_MOVE_M, editorHubUrl, editorUrl, clientLiveUrl, cameraFileCandidates, normHubId,
  camerasFileForHub, editorCatalog, mergeCamerasRecord, validateGeometry, normalizeHeading
} from './js/camera-pin-editor.js';

const root = dirname(fileURLToPath(import.meta.url));
let failed = 0;
function ok(name, cond, detail) {
  if (cond) console.log('ok  ' + name);
  else {
    failed++;
    console.log('FAIL ' + name + (detail ? ' — ' + detail : ''));
  }
}

const EUGENE = '8eea64e5c09dc806f667b079e111a38d';
const EUGENE_CAMS = '4a484f8c273abef3c02cf91e274f9e2f';
const JONES = '6de88883bfd4a8349a901c54611ed9d7';
const TRACY = '2dce25a3643b86a7d8a1551228c3306f';
const D9 = 'd9f759d7351db3886c79dd689c41e3c0';
const GUD = '1512452d9e6e0f1cf0a32255a4392b12';
const SAMPLE = '933e6dd98ecb875eab79fdb3b103a938';

ok('build', BUILD === '1.0.1');
ok('hub url', editorHubUrl() === 'https://responder-intel.vyanet.com/camera-pin-editor.html');
ok('client url', clientLiveUrl(SAMPLE) ===
  'https://responder-intel.vyanet.com/vyanet-viewer.html?property=' + SAMPLE + '&live=1');
ok('editor url', editorUrl(SAMPLE) ===
  'https://responder-intel.vyanet.com/camera-pin-editor.html?property=' + SAMPLE);
ok('bad id', editorUrl('not-a-hub') === '' && normHubId('ZZ') === '');
ok('eugene order', JSON.stringify(cameraFileCandidates(EUGENE)) ===
  JSON.stringify([EUGENE, EUGENE_CAMS]));
ok('tracy reaches jones', cameraFileCandidates(TRACY).indexOf(JONES) > 0);
ok('jones is first for jones', cameraFileCandidates(JONES)[0] === JONES);
ok('d9 reaches jones', cameraFileCandidates(D9).indexOf(JONES) > 0);
ok('heading wrap', normalizeHeading(360) === 0 && normalizeHeading(-10) === 350);

const gud = JSON.parse(readFileSync(join(root, 'data/cameras/json/' + GUD + '.json'), 'utf8'));
const before = JSON.stringify(gud);
const cam01 = gud.cameras[0];
const moved = mergeCamerasRecord(gud, [{
  id: 'cam-01',
  lat: cam01.lat + 0.0001,
  lng: cam01.lng,
  heading: cam01.heading + 1,
  fov: cam01.fov,
  range: cam01.range
}], '2026-09-30T00:00:00.000Z');
ok('gud merge ok', moved.ok && moved.updated.length === 1 && moved.updated[0] === 'cam-01');
ok('gud source untouched', JSON.stringify(gud) === before);
ok('live kept', moved.record.cameras[0].live.name === 'BARN BACK' &&
  moved.record.cameras[0].live.site === 11831);
ok('mount kept', moved.record.cameras[0].mount_height === cam01.mount_height);
ok('note kept', moved.record.placement_note === gud.placement_note);
ok('sibling taxlot kept', moved.record.cameras.find((c) => c.id === 'cam-12').taxlot === '36061600000103');
ok('stamp', moved.record.editor_saved_at === '2026-09-30T00:00:00.000Z');
ok('heading updated', moved.record.cameras[0].heading === normalizeHeading(cam01.heading + 1));

const withMx = JSON.parse(JSON.stringify(gud));
withMx.cameras[0].mx = 1;
withMx.cameras[0].my = 2;
withMx.cameras[1].mx = 9;
const stripped = mergeCamerasRecord(withMx, [{
  id: 'cam-01', lat: cam01.lat + 0.0002, lng: cam01.lng,
  heading: cam01.heading, fov: cam01.fov, range: cam01.range
}], 't');
ok('mx dropped on moved pin', stripped.ok && !('mx' in stripped.record.cameras[0]) &&
  !('my' in stripped.record.cameras[0]));
ok('sibling mx kept', stripped.record.cameras[1].mx === 9);

const jonesLike = {
  property: JONES,
  placement_note: 'keep me',
  cameras: [{
    id: 'cam-01',
    label: 'Front walkway',
    photo: 'data/cameras/images/' + JONES + '/cam-01.jpg',
    lat: 44.0414194,
    lng: -121.3786611,
    heading: 241.45,
    fov: 90,
    range: 25,
    mount_height: 3,
    heading_magnetic: 227.45,
    declination: 14,
    live: { device: 'E8ABFAAC68C9', channel: 0, name: 'FRONT DOOR' }
  }, {
    id: 'cam-02',
    label: 'Front lawn',
    lat: 44.0412611,
    lng: -121.3786472,
    heading: 238.24,
    fov: 90,
    range: 25,
    live: { device: 'ABC' }
  }]
};
const turned = mergeCamerasRecord(jonesLike, [{
  id: 'cam-01', lat: 44.0414194, lng: -121.3786611, heading: 250, fov: 90, range: 25
}], 't');
ok('magnetic follows declination', turned.ok && turned.record.cameras[0].heading_magnetic === 236);
ok('live device kept', turned.record.cameras[0].live.device === 'E8ABFAAC68C9' &&
  turned.record.cameras[0].live.name === 'FRONT DOOR');
ok('photo kept', turned.record.cameras[0].photo.indexOf(JONES) !== -1);
ok('omitted camera kept', turned.record.cameras[1].live.device === 'ABC' &&
  turned.record.cameras[1].heading === 238.24);
ok('note on jones-like', turned.record.placement_note === 'keep me');

const same = mergeCamerasRecord(jonesLike, [{
  id: 'cam-01', lat: 44.0414194, lng: -121.3786611, heading: 241.45, fov: 90, range: 25
}], 't');
ok('unchanged', same.ok && same.unchanged && same.record === jonesLike && !jonesLike.editor_saved_at);

const unknown = mergeCamerasRecord(jonesLike, [
  { id: 'cam-01', lat: 44.0415, lng: -121.3786611, heading: 241.45, fov: 90, range: 25 },
  { id: 'cam-99', lat: 44.0415, lng: -121.3786611, heading: 10, fov: 90, range: 25 }
], 't');
ok('unknown refuses whole save', !unknown.ok && jonesLike.cameras[0].lat === 44.0414194);

const dup = mergeCamerasRecord(jonesLike, [
  { id: 'cam-01', lat: 44.0414194, lng: -121.3786611, heading: 241.45, fov: 90, range: 25 },
  { id: 'cam-01', lat: 44.0415, lng: -121.3786611, heading: 10, fov: 90, range: 25 }
], 't');
ok('duplicate refuses', !dup.ok && dup.error.indexOf('duplicate') !== -1);

ok('lat 91', !validateGeometry({ id: 'cam-01', lat: 91, lng: 0, heading: 1, fov: 90, range: 20 }, jonesLike.cameras[0]).ok);
ok('fov 0', !validateGeometry({ id: 'cam-01', lat: 44.0414194, lng: -121.3786611, heading: 1, fov: 0, range: 20 }, jonesLike.cameras[0]).ok);
ok('fov 360', validateGeometry({ id: 'cam-01', lat: 44.0414194, lng: -121.3786611, heading: 1, fov: 360, range: 20 }, jonesLike.cameras[0]).ok);
ok('fov 361', !validateGeometry({ id: 'cam-01', lat: 44.0414194, lng: -121.3786611, heading: 1, fov: 361, range: 20 }, jonesLike.cameras[0]).ok);
ok('range 500', validateGeometry({ id: 'cam-01', lat: 44.0414194, lng: -121.3786611, heading: 1, fov: 90, range: 500 }, jonesLike.cameras[0]).ok);
ok('range 501', !validateGeometry({ id: 'cam-01', lat: 44.0414194, lng: -121.3786611, heading: 1, fov: 90, range: 501 }, jonesLike.cameras[0]).ok);
const far = validateGeometry({
  id: 'cam-01', lat: 44.0414194 + 0.1, lng: -121.3786611, heading: 1, fov: 90, range: 20
}, jonesLike.cameras[0]);
ok('far move refused', !far.ok && far.error.indexOf(String(MAX_MOVE_M)) !== -1 && far.error.indexOf('not moved') !== -1);
ok('empty file', !mergeCamerasRecord({ cameras: [] }, [{ id: 'cam-01' }], 't').ok);

const html = readFileSync(join(root, 'camera-pin-editor.html'), 'utf8');
const er = readFileSync(join(root, 'element-review.html'), 'utf8');
const mapsKey = (er.match(/ER_MAPS_KEY = '([^']+)'/) || [])[1];
const saveUrl = (er.match(/CRITIQUE_POST_URL = '([^']+)'/) || [])[1];
ok('maps key matches element-review', !!mapsKey && html.includes(mapsKey));
ok('save url matches critique web app', !!saveUrl && html.includes(saveUrl));
ok('no github api in the page', html.indexOf('api.github.com') === -1);
ok('no onclick', html.indexOf('onclick=') === -1);
ok('client page named', html.includes('vyanet-viewer.html'));
ok('internal banner', html.includes('Not a client link'));
['indexView', 'indexSearch', 'indexList', 'indexLink', 'indexCount', 'indexBlurb'].forEach((id) => {
  ok('index id ' + id, html.includes('id="' + id + '"'));
});
ok('index hides save until editing', html.includes('body:not(.editing) #saveBtn'));

const scriptMatch = html.match(/<script type="module">([\s\S]*)<\/script>/);
ok('one module script', !!scriptMatch);
const script = scriptMatch ? scriptMatch[1] : '';
const ids = new Set();
const idRe = /\bid="([^"]+)"/g;
let m;
while ((m = idRe.exec(html))) ids.add(m[1]);
const lookups = [];
const lookRe = /getElementById\('([^']+)'\)|\$\('([^']+)'\)/g;
while ((m = lookRe.exec(script))) lookups.push(m[1] || m[2]);
const missing = lookups.filter((id) => !ids.has(id));
ok('ids exist', missing.length === 0, missing.join(','));

const fnRe = /^\s*function\s+([A-Za-z0-9_]+)\s*\(/gm;
const fns = [];
while ((m = fnRe.exec(script))) fns.push(m[1]);
const dupFns = fns.filter((name, i) => fns.indexOf(name) !== i);
ok('no duplicate functions', dupFns.length === 0, dupFns.join(','));

const tmp = join(root, '_check-camera-pin-editor.mjs');
writeFileSync(tmp, script.replace('?v=' + BUILD, ''));
try {
  execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' });
  ok('node --check page module', true);
} catch (err) {
  ok('node --check page module', false, String(err.stderr || err.message));
} finally {
  try { unlinkSync(tmp); } catch (e) {}
}

try {
  execFileSync(process.execPath, ['--check', join(root, 'js/camera-pin-editor.js')], { stdio: 'pipe' });
  ok('node --check merge module', true);
} catch (err) {
  ok('node --check merge module', false, String(err.stderr || err.message));
}

const gsPath = join(root, 'apps scripts/camera-pins.gs');
const gs = readFileSync(gsPath, 'utf8');
const gsCheck = join(root, '_check-camera-pins.mjs');
writeFileSync(gsCheck, gs);
try {
  execFileSync(process.execPath, ['--check', gsCheck], { stdio: 'pipe' });
  ok('node --check camera-pins.gs', true);
} catch (err) {
  ok('node --check camera-pins.gs', false, String(err.stderr || err.message));
} finally {
  try { unlinkSync(gsCheck); } catch (e) {}
}
ok('gs route name', gs.includes("route: 'camera-pins-save'") && gs.includes('function camerasEditorSave_'));
ok('gs refuses create', gs.includes('refusing to create a cameras file'));
ok('gs limits', gs.includes('CAM_PIN_MAX_MOVE_M = 5000') && gs.includes('CAM_PIN_FOV_MAX = 360') &&
  gs.includes('CAM_PIN_RANGE_MAX = 500'));
[EUGENE, EUGENE_CAMS, JONES, TRACY, D9].forEach((id) => {
  ok('gs has ' + id.slice(0, 8), gs.includes(id));
});

const api = readFileSync(join(root, 'apps scripts/critique-api.gs'), 'utf8');
ok('ping flag', api.includes('camera_pins: (typeof camerasEditorSave_ === \'function\')'));
ok('post route before critique', api.indexOf("postRoute === 'camera-pins-save'") !== -1 &&
  api.indexOf("postRoute === 'camera-pins-save'") < api.lastIndexOf('critiquePost_(payload)'));

const indexDir = join(root, 'data/index');
const camDir = join(root, 'data/cameras/json');
const records = readdirSync(indexDir).filter((name) => name.endsWith('.json')).map((name) => {
  const doc = JSON.parse(readFileSync(join(indexDir, name), 'utf8'));
  return {
    id: name.slice(0, -5),
    name: doc.name || doc.property_name || '',
    address: doc.address || ''
  };
});
const cameraCounts = {};
readdirSync(camDir).filter((name) => name.endsWith('.json')).forEach((name) => {
  const doc = JSON.parse(readFileSync(join(camDir, name), 'utf8'));
  cameraCounts[name.slice(0, -5)] = Array.isArray(doc.cameras) ? doc.cameras.length : 0;
});
const built = editorCatalog(records, cameraCounts);
const committed = JSON.parse(readFileSync(join(root, 'camera-pin-properties.json'), 'utf8'));
ok('catalog matches index and cameras files', JSON.stringify(committed.properties) === JSON.stringify(built),
  'regenerate camera-pin-properties.json from editorCatalog');
const byId = {};
built.forEach((row) => { byId[row.id] = row; });
ok('gud catalog count', byId[GUD] && byId[GUD].cameras === 15 && byId[GUD].cameras_file === GUD);
ok('eugene catalog file', byId[EUGENE] && byId[EUGENE].cameras_file === EUGENE_CAMS && byId[EUGENE].cameras > 0);
ok('tracy catalog file', byId[TRACY] && byId[TRACY].cameras_file === JONES);
ok('catalog cameras first', built.length > 0 && built[0].cameras > 0 &&
  built.filter((row) => row.cameras > 0).length === built.filter((row, i, all) => {
    const lastWith = all.reduce((n, row2, j) => row2.cameras > 0 ? j : n, -1);
    return i <= lastWith;
  }).length);
ok('catalog not under data', !readFileSync(join(root, 'camera-pin-editor.html'), 'utf8').includes('data/camera-pin-properties.json'));
ok('camerasFileForHub eugene', camerasFileForHub(EUGENE, Object.keys(cameraCounts)) === EUGENE_CAMS);
ok('camerasFileForHub missing', camerasFileForHub('00000000000000000000000000000000', Object.keys(cameraCounts)) === '');

if (failed) {
  console.log(failed + ' failed');
  process.exit(1);
}
console.log('all passed');
