// Merge rules, URL shape, and page structure for camera-pin-editor 1.0.14.
import { existsSync, readFileSync, writeFileSync, unlinkSync, readdirSync } from 'fs';
import { execFileSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';
import {
  BUILD, MAX_MOVE_M, editorHubUrl, editorUrl, clientLiveUrl, cameraFileCandidates, normHubId,
  camerasFileForHub, chektEditorCatalog, mergeCamerasRecord, validateGeometry, normalizeHeading,
  coordPair, reviewEntry, reviewStateFromJson, parcelTileName, PARCEL_COUNTIES,
  EDITOR_ACTORS, normActor, historyEventsFromJson, lastEditForHub,
  mergeReviewRecords
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

ok('build', BUILD === '1.0.14');
ok('four actors', EDITOR_ACTORS.join('|') === 'Jonah|Eleanor|Bot 1|Bot 2');
ok('norm actor', normActor(' Jonah ') === 'Jonah' && normActor('Ross') === '');
ok('null coord is unplaced', coordPair({ lat: null, lng: null }) === null);
ok('blank coord is unplaced', coordPair({ lat: '', lng: '' }) === null);
ok('real coord kept', coordPair({ lat: 44.07, lng: -123.09 }).lat === 44.07);
ok('review keeps a done note', reviewStateFromJson(JSON.stringify({
  '1512452d9e6e0f1cf0a32255a4392b12': { done: true, note: 'checked doors' }
}))['1512452d9e6e0f1cf0a32255a4392b12'].note === 'checked doors');
ok('review drops an empty row', Object.keys(reviewStateFromJson(JSON.stringify({
  '1512452d9e6e0f1cf0a32255a4392b12': { done: false, note: '' }
}))).length === 0);
ok('review ignores a bad id', Object.keys(reviewStateFromJson('{"nope":{"done":true}}')).length === 0);
ok('review file unwraps reviews', reviewStateFromJson(JSON.stringify({
  version: 1,
  reviews: { '1512452d9e6e0f1cf0a32255a4392b12': { done: true, note: 'shared' } }
}))['1512452d9e6e0f1cf0a32255a4392b12'].note === 'shared');
const rev = mergeReviewRecords({}, {
  '1512452d9e6e0f1cf0a32255a4392b12': { done: true, note: 'doors' }
}, 'Eleanor', '2026-10-06T18:00:00.000Z');
ok('review merge names Eleanor', rev.ok && rev.reviews['1512452d9e6e0f1cf0a32255a4392b12'].by === 'Eleanor');
ok('review merge refuses unnamed', mergeReviewRecords({}, {
  '1512452d9e6e0f1cf0a32255a4392b12': { done: true, note: 'x' }
}, '').ok === false);
ok('review entry is a checkbox', reviewEntry({ done: 1, note: 'x' }).done === false);
ok('lane parcel tile', parcelTileName(44.070, -123.092, PARCEL_COUNTIES[1]) === 'lane_44.03_-123.15.geojson');
ok('bend parcel tile', parcelTileName(44.068, -121.291, PARCEL_COUNTIES[0]) === 'deschutes_44.03_-121.31.geojson');
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
ok('no history without actor', !moved.record.editor_history);

const named = mergeCamerasRecord(gud, [{
  id: 'cam-01',
  lat: cam01.lat + 0.0001,
  lng: cam01.lng,
  heading: cam01.heading + 1,
  fov: cam01.fov,
  range: cam01.range
}], '2026-10-06T12:00:00.000Z', 'Eleanor');
ok('history names Eleanor', named.ok && named.record.editor_saved_by === 'Eleanor' &&
  named.record.editor_history[0].by === 'Eleanor' &&
  named.record.editor_history[0].cameras[0] === 'cam-01');
ok('history keeps from/to', named.record.editor_history[0].changes[0].from.lat === cam01.lat &&
  named.record.editor_history[0].changes[0].to.lat === moved.record.cameras[0].lat);
ok('unknown actor refused', mergeCamerasRecord(gud, [{
  id: 'cam-01', lat: cam01.lat + 0.0001, lng: cam01.lng,
  heading: cam01.heading, fov: cam01.fov, range: cam01.range
}], '2026-10-06T12:00:00.000Z', 'Ross').ok === false);
ok('history log keeps named events', historyEventsFromJson(JSON.stringify({
  events: [
    { at: '2026-10-06T00:00:00Z', by: 'Eleanor', property: GUD, cameras: ['cam-01'] },
    { at: 'x', by: 'Nope', property: GUD }
  ]
})).length === 1);
ok('history log keeps earlier save', historyEventsFromJson(JSON.stringify({
  events: [
    { at: '2026-10-02T17:37:45.273Z', by: '', property: SAMPLE, source: 'backfill' }
  ]
}))[0].source === 'backfill');
ok('last edit prefers later named', lastEditForHub([
  { at: '2026-10-02T00:00:00.000Z', by: '', property: SAMPLE, file_id: SAMPLE },
  { at: '2026-10-06T12:00:00.000Z', by: 'Jonah', property: SAMPLE, file_id: SAMPLE }
], SAMPLE).by === 'Jonah');

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
['indexView', 'indexSearch', 'indexList', 'indexLink', 'indexCount', 'indexBlurb',
  'actorSelect', 'actorGate', 'actorGateBlurb', 'actorGateChoices',
  'historyLink', 'historyView', 'historyBlurb', 'historyCount',
  'historyFilter', 'historyFeed', 'editHistory', 'historyList'].forEach((id) => {
  ok('index id ' + id, html.includes('id="' + id + '"'));
});
ok('history page query', html.includes('camera-pin-editor.html?history=1'));
ok('index hides save until editing', html.includes('body:not(.editing) #saveBtn'));

const scriptMatch = html.match(/<script type="module">([\s\S]*)<\/script>/);
ok('one module script', !!scriptMatch);
const script = scriptMatch ? scriptMatch[1] : '';
ok('history page boots', script.includes("params.get('history') === '1'"));
ok('property links open a tab', script.includes("link.target = '_blank'") &&
  script.includes("function setPropertyTabLink"));
const ids = new Set();
const idRe = /\bid="([^"]+)"/g;
let m;
while ((m = idRe.exec(html))) ids.add(m[1]);
const lookups = [];
const lookRe = /getElementById\('([^']+)'\)|\$\('([^']+)'\)/g;
while ((m = lookRe.exec(script))) lookups.push(m[1] || m[2]);
const missing = lookups.filter((id) => !ids.has(id));
ok('ids exist', missing.length === 0, missing.join(','));
ok('still lightbox', html.includes('id="stillLightbox"') && script.includes('function openStill') &&
  script.includes('function closeStill'));

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
ok('gs reuses records publish', gs.includes('recordsPublishGithubPath_(') && gs.includes('recordsSidecarHubId_('));
ok('gs no second s3 signer', gs.indexOf('recordsS3PutObject_') === -1 && gs.indexOf('AWS_SECRET') === -1);
ok('gs partial phrase', gs.includes('GitHub saved ') && gs.includes('but the AWS records copy failed'));
ok('gs github before records', gs.indexOf('camPinPut_') !== -1 && gs.indexOf('camPinPut_') < gs.indexOf('camPinRefreshRecords_'));
ok('page shows partial aws error', html.includes('j.github_saved') && html.includes('AWS records copy failed'));
ok('gs refuses create', gs.includes('refusing to create a cameras file'));
ok('gs requires actor', gs.includes("by must be Jonah, Eleanor, Bot 1, or Bot 2") &&
  gs.includes('CAM_PIN_ACTORS') && gs.includes('camPinAppendHistoryLog_'));
ok('gs review route', gs.includes("function camerasEditorReviewSave_") &&
  gs.includes('camera-pin-review.json'));
ok('page has actor picker', html.includes('id="actorSelect"') && html.includes('Bot 2'));
ok('page asks who is editing', html.includes('Who is editing?') && html.includes('function showActorGate') &&
  html.includes('data-actor="Jonah"'));
ok('page shares reviews', html.includes('camera-pins-review-save') &&
  html.includes('function flushReviews'));
ok('review file empty', Object.keys(JSON.parse(readFileSync(join(root, 'camera-pin-review.json'), 'utf8')).reviews).length === 0);
ok('page has last edited', html.includes('index-last') && html.includes('Earlier save'));
const histDoc = JSON.parse(readFileSync(join(root, 'camera-pin-history.json'), 'utf8'));
const histEvents = historyEventsFromJson(JSON.stringify(histDoc));
ok('history file has prior saves', histEvents.length === 87 && histEvents.every((ev) => ev.source === 'backfill'));
ok('achterhof last edited', lastEditForHub(histEvents, SAMPLE).at === '2026-10-02T17:37:45.273Z');
ok('gs limits', gs.includes('CAM_PIN_MAX_MOVE_M = 5000') && gs.includes('CAM_PIN_FOV_MAX = 360') &&
  gs.includes('CAM_PIN_RANGE_MAX = 500'));
[EUGENE, EUGENE_CAMS, JONES, TRACY, D9].forEach((id) => {
  ok('gs has ' + id.slice(0, 8), gs.includes(id));
});

const api = readFileSync(join(root, 'apps scripts/critique-api.gs'), 'utf8');
ok('ping flag', api.includes('camera_pins: (typeof camerasEditorSave_ === \'function\')') &&
  api.includes('camera_pins_review: (typeof camerasEditorReviewSave_ === \'function\')'));
ok('post route before critique', api.indexOf("postRoute === 'camera-pins-save'") !== -1 &&
  api.indexOf("postRoute === 'camera-pins-save'") < api.lastIndexOf('critiquePost_(payload)'));
ok('review post route before critique', api.indexOf("postRoute === 'camera-pins-review-save'") !== -1 &&
  api.indexOf("postRoute === 'camera-pins-review-save'") < api.lastIndexOf('critiquePost_(payload)'));

const ACHTERHOF = '933e6dd98ecb875eab79fdb3b103a938';
const NOT_CHEKT = '037c696d19c43c7d03c5b5d272658a09';
const camDir = join(root, 'data/cameras/json');
const cameraIds = readdirSync(camDir).filter((name) => name.endsWith('.json')).map((name) => name.slice(0, -5));
const committed = JSON.parse(readFileSync(join(root, 'camera-pin-properties.json'), 'utf8'));
const props = committed.properties || [];
const byId = {};
props.forEach((row) => { byId[row.id] = row; });
ok('catalog is the chekt tab', props.length === 321 && !byId[NOT_CHEKT]);
ok('achterhof is a chekt account', byId[ACHTERHOF] && byId[ACHTERHOF].cameras === 4 && byId[ACHTERHOF].cameras_file === ACHTERHOF);
ok('seeded wellman has no scratch fields', (() => {
  const doc = JSON.parse(readFileSync(join(camDir, '0bff28782e679ea68ce2994c5c2932f7.json'), 'utf8'));
  const raw = JSON.stringify(doc);
  return doc.property === '0bff28782e679ea68ce2994c5c2932f7' && doc.cameras.length === 3 &&
    !raw.includes('"review"') && !raw.includes('sub_review') && !raw.includes('confidence');
})());
ok('gud production pins kept', readFileSync(join(camDir, GUD + '.json'), 'utf8').includes('gud-cultures-2026-05-29'));
ok('butler still attached', (() => {
  const id = '305a44231fd0ee62c93819812e58bd38';
  const doc = JSON.parse(readFileSync(join(camDir, id + '.json'), 'utf8'));
  const photo = doc.cameras[0].photo;
  return doc.cameras[0].lat === 44.0701154 && doc.cameras[0].label === 'DRIVEWAY' &&
    photo === 'data/cameras/images/' + id + '/cam-01.jpg' && existsSync(join(root, photo));
})());
ok('wellman still attached', (() => {
  const id = '0bff28782e679ea68ce2994c5c2932f7';
  const doc = JSON.parse(readFileSync(join(camDir, id + '.json'), 'utf8'));
  const photo = doc.cameras[0].photo;
  return photo === 'data/cameras/images/' + id + '/cam-01.jpg' && existsSync(join(root, photo));
})());
ok('gud catalog count', byId[GUD] && byId[GUD].cameras === 15 && byId[GUD].cameras_file === GUD);
ok('eugene catalog file', byId[EUGENE] && byId[EUGENE].cameras === 11 && byId[EUGENE].cameras_file === EUGENE_CAMS);
ok('jones catalog file', byId[JONES] && byId[JONES].cameras === 14 && byId[JONES].cameras_file === JONES);
ok('catalog cameras first', props.length > 0 && props[0].cameras > 0 &&
  props.filter((row) => row.cameras > 0).length === props.filter((row, i, all) => {
    const lastWith = all.reduce((n, row2, j) => row2.cameras > 0 ? j : n, -1);
    return i <= lastWith;
  }).length);
ok('chekt catalog keeps a zero', chektEditorCatalog([
  { hub: GUD, name: 'Gud', address: 'a', cameras: 15 },
  { hub: ACHTERHOF, name: 'A', address: 'b', cameras: 0 }
], cameraIds).length === 2);
ok('catalog not under data', !readFileSync(join(root, 'camera-pin-editor.html'), 'utf8').includes('data/camera-pin-properties.json'));
ok('camerasFileForHub eugene', camerasFileForHub(EUGENE, cameraIds) === EUGENE_CAMS);
ok('camerasFileForHub missing', camerasFileForHub('00000000000000000000000000000000', cameraIds) === '');

const recordsSrc = readFileSync(join(root, 'apps scripts/records.gs'), 'utf8');
const sidecarStart = recordsSrc.indexOf('const RECORDS_SIDECAR_HUB_REMAP');
const sidecarEnd = recordsSrc.indexOf('function recordsRewriteCameraPhotos_');
ok('records remap present', sidecarStart !== -1 && recordsSrc.indexOf('function recordsSidecarHubId_') !== -1);
const sandbox = {
  console,
  recordsCalls: [],
  recordsPublishGithubPath_: function (path, content) {
    sandbox.recordsCalls.push({ path: path, content: content });
  }
};
vm.createContext(sandbox);
vm.runInContext(recordsSrc.slice(sidecarStart, recordsSrc.indexOf('function recordsPublishSidecarCameras_')), sandbox);
vm.runInContext(gs, sandbox);
const jonesBody = JSON.stringify({ property: JONES, cameras: [{ id: 'cam-01', lat: 1, lng: 2 }] });
const jonesSaved = sandbox.camPinAfterGithub_({
  property: JONES, fileId: JONES, path: 'data/cameras/json/' + JONES + '.json',
  updated: ['cam-01'], unchanged: false, commit: 'abc'
}, 'data/cameras/json/' + JONES + '.json', jonesBody);
ok('jones records hub', jonesSaved.ok === true && jonesSaved.records_hub === D9 &&
  jonesSaved.records_key === 'cameras/' + D9 + '.json', JSON.stringify(jonesSaved));
ok('jones publish path', sandbox.recordsCalls.length === 1 &&
  sandbox.recordsCalls[0].path === 'data/cameras/json/' + JONES + '.json' &&
  sandbox.recordsCalls[0].content === jonesBody);
const eugeneSaved = sandbox.camPinRefreshRecords_(
  'data/cameras/json/' + EUGENE_CAMS + '.json', '{}', EUGENE_CAMS);
ok('eugene records hub', eugeneSaved.ok === true && eugeneSaved.hubId === EUGENE &&
  eugeneSaved.key === 'cameras/' + EUGENE + '.json');
const gudSaved = sandbox.camPinRefreshRecords_(
  'data/cameras/json/' + GUD + '.json', '{}', GUD);
ok('gud records hub', gudSaved.ok === true && gudSaved.hubId === GUD && gudSaved.key === 'cameras/' + GUD + '.json');
sandbox.recordsPublishGithubPath_ = function () { throw new Error('S3 PUT cameras/x → HTTP 403: AccessDenied'); };
const partial = sandbox.camPinAfterGithub_({
  property: GUD, fileId: GUD, path: 'data/cameras/json/' + GUD + '.json',
  updated: ['cam-01'], unchanged: false, commit: 'def'
}, 'data/cameras/json/' + GUD + '.json', '{}');
ok('partial keeps github', partial.ok === false && partial.partial === true && partial.github_saved === true &&
  partial.error.indexOf('GitHub saved data/cameras/json/' + GUD + '.json') === 0 &&
  partial.error.indexOf('AWS records copy failed') !== -1 &&
  partial.error.indexOf('HTTP 403') !== -1, partial.error);
delete sandbox.recordsPublishGithubPath_;
const missingHelper = sandbox.camPinRefreshRecords_('data/cameras/json/' + GUD + '.json', '{}', GUD);
ok('missing helper', missingHelper.ok === false && missingHelper.error.indexOf('recordsPublishGithubPath_') !== -1);
ok('records comment names editor', recordsSrc.includes('Camera pin editor calls this after the GitHub Contents PUT'));

if (failed) {
  console.log(failed + ' failed');
  process.exit(1);
}
console.log('all passed');
