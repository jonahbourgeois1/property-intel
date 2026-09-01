// ============================================================
// PROPERTY INTEL — Apps Script — FILE: golf.gs
// Golf course satellite tab. Sibling of Satellite, not a mode of it.
//
// CONTRACT (Segment 6 has no contract yet; this is the golf clause):
//   Identity     Golf lookups key on Site No (column A), never address.
//                Same site_no rule as satellite; never fall through to the
//                Satellite tab (view=drone-test class of bug).
//   Pass 1       Geocode the address into Lat/Lng. No Static Maps nadir,
//                no Bedrock, no parcel-fit.
//   Pins         Stored as [{id, lat, lng}] in Nadir Elements (H). Not
//                percentages of a nadir frame. Duplicates allowed. Cap
//                GOLF_MAX_PINS (200): refuse over, never truncate.
//   Catalog      Independent Golf Pins sheet, ids 1001+. NEVER merge into
//                pins-catalog.json. No role / account_type / analysis tags.
//   Save         POST view=golf writes column H only. Does not write
//                element-critique, Nadir Fixes, or call Bedrock.
//   Publish      Out of scope this round: no data/golf/, no index hub.
//
// Menu: Set Up Golf Sheet / Golf Pins Sheet, Geocode Pass 1 (this row /
// all missing coords), Open Golf Review (This Row).
// After paste: save AND create a new web-app deployment version.
// ============================================================

// Nine dropdown groups, in display order. Seeded from
// "Pin Placement KB August 18 2026 - Golf.csv". Duplicate names across
// sections (e.g. Storm damage) are different ids — identity is id.
const GOLF_SECTION_NAMES = [
  'Property and Access',
  'Clubhouse and Public Areas',
  'Maintenance and High-Value Assets',
  'Security',
  'Course Infrastructure',
  'Turf and Agronomy',
  'Trees and Vegetation',
  'Change Detection',
  'Golf Course Community / Residential Interface'
];

// Source of truth AFTER setup is the Golf Pins sheet. This array is only
// the seed setupGolfPinsSheet writes. Ids start at 1001 so a mix-up with
// the 256-pin satellite catalog is obvious. Definitions are blank until
// authored on the sheet.
const GOLF_PIN_SEED = [
  { id: 1001, name: 'Property boundaries', section: 'Property and Access', definition: '' },
  { id: 1002, name: 'Public-road interfaces', section: 'Property and Access', definition: '' },
  { id: 1003, name: 'Main vehicle entrance', section: 'Property and Access', definition: '' },
  { id: 1004, name: 'Secondary entrances', section: 'Property and Access', definition: '' },
  { id: 1005, name: 'Maintenance/service entrances', section: 'Property and Access', definition: '' },
  { id: 1006, name: 'Gates', section: 'Property and Access', definition: '' },
  { id: 1007, name: 'Adjacent trails', section: 'Property and Access', definition: '' },
  { id: 1008, name: 'Neighboring residential/commercial interfaces', section: 'Property and Access', definition: '' },
  { id: 1009, name: 'Uncontrolled vehicle approaches', section: 'Property and Access', definition: '' },
  { id: 1010, name: 'Emergency access routes', section: 'Property and Access', definition: '' },
  { id: 1011, name: 'Clubhouse', section: 'Clubhouse and Public Areas', definition: '' },
  { id: 1012, name: 'Pro shop', section: 'Clubhouse and Public Areas', definition: '' },
  { id: 1013, name: 'Bag drop', section: 'Clubhouse and Public Areas', definition: '' },
  { id: 1014, name: 'Main parking', section: 'Clubhouse and Public Areas', definition: '' },
  { id: 1015, name: 'Overflow/event parking', section: 'Clubhouse and Public Areas', definition: '' },
  { id: 1016, name: 'Loading/service areas', section: 'Clubhouse and Public Areas', definition: '' },
  { id: 1017, name: 'Outdoor dining/event spaces', section: 'Clubhouse and Public Areas', definition: '' },
  { id: 1018, name: 'Driving range', section: 'Clubhouse and Public Areas', definition: '' },
  { id: 1019, name: 'Practice putting/chipping areas', section: 'Clubhouse and Public Areas', definition: '' },
  { id: 1020, name: 'Tournament gathering areas', section: 'Clubhouse and Public Areas', definition: '' },
  { id: 1021, name: 'Maintenance building', section: 'Maintenance and High-Value Assets', definition: '' },
  { id: 1022, name: 'Equipment yard', section: 'Maintenance and High-Value Assets', definition: '' },
  { id: 1023, name: 'Cart barn/storage', section: 'Maintenance and High-Value Assets', definition: '' },
  { id: 1024, name: 'Fuel tanks/pumps', section: 'Maintenance and High-Value Assets', definition: '' },
  { id: 1025, name: 'Pesticide storage area', section: 'Maintenance and High-Value Assets', definition: '' },
  { id: 1026, name: 'Fertilizer storage', section: 'Maintenance and High-Value Assets', definition: '' },
  { id: 1027, name: 'Chemical mixing/loading area', section: 'Maintenance and High-Value Assets', definition: '' },
  { id: 1028, name: 'Equipment wash area', section: 'Maintenance and High-Value Assets', definition: '' },
  { id: 1029, name: 'Waste/storage area', section: 'Maintenance and High-Value Assets', definition: '' },
  { id: 1030, name: 'Irrigation-control facility', section: 'Maintenance and High-Value Assets', definition: '' },
  { id: 1031, name: 'Pump station', section: 'Maintenance and High-Value Assets', definition: '' },
  { id: 1032, name: 'Wells', section: 'Maintenance and High-Value Assets', definition: '' },
  { id: 1033, name: 'High-value remote structures', section: 'Maintenance and High-Value Assets', definition: '' },
  { id: 1034, name: 'Exterior cameras', section: 'Security', definition: '' },
  { id: 1035, name: 'Camera direction/field of view', section: 'Security', definition: '' },
  { id: 1036, name: 'Access-controlled gates', section: 'Security', definition: '' },
  { id: 1037, name: 'Lighting around critical assets', section: 'Security', definition: '' },
  { id: 1038, name: 'Remote or concealed maintenance areas', section: 'Security', definition: '' },
  { id: 1039, name: 'Asset-removal routes', section: 'Security', definition: '' },
  { id: 1040, name: 'Unobserved approaches', section: 'Security', definition: '' },
  { id: 1041, name: 'Public access near critical infrastructure', section: 'Security', definition: '' },
  { id: 1042, name: 'Greens', section: 'Course Infrastructure', definition: '' },
  { id: 1043, name: 'Tees', section: 'Course Infrastructure', definition: '' },
  { id: 1044, name: 'Fairways', section: 'Course Infrastructure', definition: '' },
  { id: 1045, name: 'Rough', section: 'Course Infrastructure', definition: '' },
  { id: 1046, name: 'Bunkers', section: 'Course Infrastructure', definition: '' },
  { id: 1047, name: 'Native/naturalized areas', section: 'Course Infrastructure', definition: '' },
  { id: 1048, name: 'Cart paths', section: 'Course Infrastructure', definition: '' },
  { id: 1049, name: 'Bridges', section: 'Course Infrastructure', definition: '' },
  { id: 1050, name: 'Road crossings', section: 'Course Infrastructure', definition: '' },
  { id: 1051, name: 'Tunnels', section: 'Course Infrastructure', definition: '' },
  { id: 1052, name: 'Stairs/steep grades', section: 'Course Infrastructure', definition: '' },
  { id: 1053, name: 'Drainage structures', section: 'Course Infrastructure', definition: '' },
  { id: 1054, name: 'Stormwater channels', section: 'Course Infrastructure', definition: '' },
  { id: 1055, name: 'Irrigation ponds', section: 'Course Infrastructure', definition: '' },
  { id: 1056, name: 'Retention ponds', section: 'Course Infrastructure', definition: '' },
  { id: 1057, name: 'Streams/wetlands', section: 'Course Infrastructure', definition: '' },
  { id: 1058, name: 'Pump/intake areas', section: 'Course Infrastructure', definition: '' },
  { id: 1059, name: 'Apparent turf stress', section: 'Turf and Agronomy', definition: '' },
  { id: 1060, name: 'Dry areas', section: 'Turf and Agronomy', definition: '' },
  { id: 1061, name: 'Excessively wet areas', section: 'Turf and Agronomy', definition: '' },
  { id: 1062, name: 'Bare/thin turf', section: 'Turf and Agronomy', definition: '' },
  { id: 1063, name: 'Shade-related stress', section: 'Turf and Agronomy', definition: '' },
  { id: 1064, name: 'High-traffic wear', section: 'Turf and Agronomy', definition: '' },
  { id: 1065, name: 'Recently renovated turf', section: 'Turf and Agronomy', definition: '' },
  { id: 1066, name: 'Bunker washouts', section: 'Turf and Agronomy', definition: '' },
  { id: 1067, name: 'Erosion', section: 'Turf and Agronomy', definition: '' },
  { id: 1068, name: 'Standing water', section: 'Turf and Agronomy', definition: '' },
  { id: 1069, name: 'Irrigation anomalies', section: 'Turf and Agronomy', definition: '' },
  { id: 1070, name: 'Areas of inconsistent color or growth', section: 'Turf and Agronomy', definition: '' },
  { id: 1071, name: 'Fallen trees', section: 'Trees and Vegetation', definition: '' },
  { id: 1072, name: 'Dead/declining trees', section: 'Trees and Vegetation', definition: '' },
  { id: 1073, name: 'Canopy change', section: 'Trees and Vegetation', definition: '' },
  { id: 1074, name: 'Vegetation encroachment', section: 'Trees and Vegetation', definition: '' },
  { id: 1075, name: 'Shade impacts', section: 'Trees and Vegetation', definition: '' },
  { id: 1076, name: 'Storm damage', section: 'Trees and Vegetation', definition: '' },
  { id: 1077, name: 'Brush near structures', section: 'Trees and Vegetation', definition: '' },
  { id: 1078, name: 'Vegetation blocking sightlines/cameras', section: 'Trees and Vegetation', definition: '' },
  { id: 1079, name: 'Construction', section: 'Change Detection', definition: '' },
  { id: 1080, name: 'Renovation', section: 'Change Detection', definition: '' },
  { id: 1081, name: 'New or removed paths', section: 'Change Detection', definition: '' },
  { id: 1082, name: 'New or removed trees', section: 'Change Detection', definition: '' },
  { id: 1083, name: 'Bunker changes', section: 'Change Detection', definition: '' },
  { id: 1084, name: 'Drainage projects', section: 'Change Detection', definition: '' },
  { id: 1085, name: 'Irrigation work', section: 'Change Detection', definition: '' },
  { id: 1086, name: 'Shoreline change', section: 'Change Detection', definition: '' },
  { id: 1087, name: 'Storm damage', section: 'Change Detection', definition: '' },
  { id: 1088, name: 'Course closures/problem areas', section: 'Change Detection', definition: '' },
  { id: 1089, name: 'Temporary tournament infrastructure', section: 'Change Detection', definition: '' },
  { id: 1090, name: 'Any material change from prior imagery', section: 'Change Detection', definition: '' },
  { id: 1091, name: 'Homes directly adjoining fairways', section: 'Golf Course Community / Residential Interface', definition: '' },
  { id: 1092, name: 'Homes behind greens and tee boxes', section: 'Golf Course Community / Residential Interface', definition: '' },
  { id: 1093, name: 'Residential enclaves surrounded by course property', section: 'Golf Course Community / Residential Interface', definition: '' },
  { id: 1094, name: 'Course-to-residential property boundaries', section: 'Golf Course Community / Residential Interface', definition: '' },
  { id: 1095, name: 'Fences, walls, hedges, and other residential boundary treatments', section: 'Golf Course Community / Residential Interface', definition: '' },
  { id: 1096, name: 'Gaps or inconsistencies in course/residential boundaries', section: 'Golf Course Community / Residential Interface', definition: '' },
  { id: 1097, name: 'Residential streets crossing or bisecting the course', section: 'Golf Course Community / Residential Interface', definition: '' },
  { id: 1098, name: 'Golf-cart crossings of residential or public streets', section: 'Golf Course Community / Residential Interface', definition: '' },
  { id: 1099, name: 'Pedestrian crossings between neighborhoods and course areas', section: 'Golf Course Community / Residential Interface', definition: '' },
  { id: 1100, name: 'Cart paths immediately adjacent to residences', section: 'Golf Course Community / Residential Interface', definition: '' },
  { id: 1101, name: 'Maintenance roads adjacent to or behind residences', section: 'Golf Course Community / Residential Interface', definition: '' },
  { id: 1102, name: 'Course service routes passing through residential areas', section: 'Golf Course Community / Residential Interface', definition: '' },
  { id: 1103, name: 'Shared or interconnected gates and access points', section: 'Golf Course Community / Residential Interface', definition: '' },
  { id: 1104, name: 'Gated-community entrances and guard facilities', section: 'Golf Course Community / Residential Interface', definition: '' },
  { id: 1105, name: 'Secondary or emergency neighborhood entrances', section: 'Golf Course Community / Residential Interface', definition: '' },
  { id: 1106, name: 'HOA-owned roads and common areas', section: 'Golf Course Community / Residential Interface', definition: '' },
  { id: 1107, name: 'Community clubhouses, pools, fitness centers, and amenity buildings', section: 'Golf Course Community / Residential Interface', definition: '' },
  { id: 1108, name: 'Community parks, playgrounds, and gathering areas', section: 'Golf Course Community / Residential Interface', definition: '' },
  { id: 1109, name: 'Walking, biking, and recreational trails', section: 'Golf Course Community / Residential Interface', definition: '' },
  { id: 1110, name: 'Trail connections between neighborhoods and the golf course', section: 'Golf Course Community / Residential Interface', definition: '' },
  { id: 1111, name: 'Unofficial pedestrian paths or apparent shortcuts onto the course', section: 'Golf Course Community / Residential Interface', definition: '' },
  { id: 1112, name: 'Public trails or open spaces connecting to the development', section: 'Golf Course Community / Residential Interface', definition: '' },
  { id: 1113, name: 'Residential parking areas adjoining course property', section: 'Golf Course Community / Residential Interface', definition: '' },
  { id: 1114, name: 'Visitor and contractor access routes through the community', section: 'Golf Course Community / Residential Interface', definition: '' },
  { id: 1115, name: 'Delivery/service access patterns', section: 'Golf Course Community / Residential Interface', definition: '' },
  { id: 1116, name: 'Homes adjacent to maintenance compounds, fuel, chemical, or equipment areas', section: 'Golf Course Community / Residential Interface', definition: '' },
  { id: 1117, name: 'Homes adjacent to pump stations or other course infrastructure', section: 'Golf Course Community / Residential Interface', definition: '' },
  { id: 1118, name: 'Homes adjacent to ponds, lakes, streams, and drainage areas', section: 'Golf Course Community / Residential Interface', definition: '' },
  { id: 1119, name: 'Shared stormwater and drainage infrastructure', section: 'Golf Course Community / Residential Interface', definition: '' },
  { id: 1120, name: 'Retention/detention ponds affecting both course and residences', section: 'Golf Course Community / Residential Interface', definition: '' },
  { id: 1121, name: 'Apparent drainage pathways from the course toward homes', section: 'Golf Course Community / Residential Interface', definition: '' },
  { id: 1122, name: 'Low-lying residential areas potentially affected by course runoff or flooding', section: 'Golf Course Community / Residential Interface', definition: '' },
  { id: 1123, name: 'Erosion near residential/course boundaries', section: 'Golf Course Community / Residential Interface', definition: '' },
  { id: 1124, name: 'Trees capable of affecting both course and residential property', section: 'Golf Course Community / Residential Interface', definition: '' },
  { id: 1125, name: 'Vegetation creating concealed approaches between course and homes', section: 'Golf Course Community / Residential Interface', definition: '' },
  { id: 1126, name: 'Wildland/vegetation interfaces presenting shared wildfire exposure', section: 'Golf Course Community / Residential Interface', definition: '' },
  { id: 1127, name: 'Emergency vehicle routes serving both course and neighborhoods', section: 'Golf Course Community / Residential Interface', definition: '' },
  { id: 1128, name: 'Potential emergency staging locations within the community', section: 'Golf Course Community / Residential Interface', definition: '' },
  { id: 1129, name: 'Fire hydrants and other emergency infrastructure where data are available', section: 'Golf Course Community / Residential Interface', definition: '' },
  { id: 1130, name: 'Community evacuation routes and potential access constraints', section: 'Golf Course Community / Residential Interface', definition: '' },
  { id: 1131, name: 'Camera locations at shared community/course interfaces', section: 'Golf Course Community / Residential Interface', definition: '' },
  { id: 1132, name: 'Apparent gaps in surveillance at high-traffic shared interfaces', section: 'Golf Course Community / Residential Interface', definition: '' },
  { id: 1133, name: 'Community lighting along roads, paths, gates, and shared areas', section: 'Golf Course Community / Residential Interface', definition: '' },
  { id: 1134, name: 'Remote or poorly visible areas between residences and course property', section: 'Golf Course Community / Residential Interface', definition: '' },
  { id: 1135, name: 'Vacant lots or undeveloped parcels within the community', section: 'Golf Course Community / Residential Interface', definition: '' },
  { id: 1136, name: 'Construction sites and newly developing residential areas', section: 'Golf Course Community / Residential Interface', definition: '' },
  { id: 1137, name: 'Changes in residential development between imagery dates', section: 'Golf Course Community / Residential Interface', definition: '' },
  { id: 1138, name: 'New homes, roads, fences, gates, or paths affecting course operations', section: 'Golf Course Community / Residential Interface', definition: '' },
  { id: 1139, name: 'Shared utility corridors and easements where identifiable', section: 'Golf Course Community / Residential Interface', definition: '' },
  { id: 1140, name: 'Community assets located on or accessible through course property', section: 'Golf Course Community / Residential Interface', definition: '' },
  { id: 1141, name: 'Residential access points that could also provide unintended course access', section: 'Golf Course Community / Residential Interface', definition: '' },
  { id: 1142, name: 'Course access points that could provide unintended access toward residences', section: 'Golf Course Community / Residential Interface', definition: '' },
  { id: 1143, name: 'Locations of recurring course/resident interaction or conflict identified by management', section: 'Golf Course Community / Residential Interface', definition: '' },
  { id: 1144, name: 'Areas where errant golf balls create recurring property or pedestrian exposure', section: 'Golf Course Community / Residential Interface', definition: '' },
  { id: 1145, name: 'Homes and common areas with particularly close proximity to active playing corridors', section: 'Golf Course Community / Residential Interface', definition: '' },
  { id: 1146, name: 'Locations where course operations create potential noise, lighting, traffic, or maintenance conflicts with residences', section: 'Golf Course Community / Residential Interface', definition: '' },
  { id: 1147, name: 'Areas where homeowner landscaping or structures encroach toward course operations', section: 'Golf Course Community / Residential Interface', definition: '' },
  { id: 1148, name: 'Shared environmental concerns such as water, smoke, wildfire, storm damage, or fallen trees', section: 'Golf Course Community / Residential Interface', definition: '' },
  { id: 1149, name: 'HOA and course-management jurisdictional boundaries', section: 'Golf Course Community / Residential Interface', definition: '' },
  { id: 1150, name: 'Any location where responsibility is unclear between the golf course, HOA, municipality, and individual homeowner', section: 'Golf Course Community / Residential Interface', definition: '' }
];

// ── Spreadsheet helpers ─────────────────────────────────────────────────────

function golfOpenSs_() {
  if (typeof critiqueOpenSpreadsheet_ === 'function') {
    return critiqueOpenSpreadsheet_().ss;
  }
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;
  throw new Error('No spreadsheet in this execution context.');
}

function golfSheet_(ss) {
  const book = ss || golfOpenSs_();
  const sheet = book.getSheetByName(GOLF_SHEET);
  if (!sheet) throw new Error('Sheet "' + GOLF_SHEET + '" not found — run Set Up Golf Sheet first.');
  return sheet;
}

function golfPinsSheet_(ss) {
  const book = ss || golfOpenSs_();
  const sheet = book.getSheetByName(GOLF_PINS_SHEET);
  if (!sheet) throw new Error('Sheet "' + GOLF_PINS_SHEET + '" not found — run Set Up Golf Pins Sheet first.');
  return sheet;
}

function golfActiveRow_() {
  const ui = SpreadsheetApp.getUi();
  const active = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const name = String(active.getName() || '').trim();
  if (name.toLowerCase() !== String(GOLF_SHEET).toLowerCase()) {
    ui.alert('Wrong sheet',
      'This action works on the "' + GOLF_SHEET + '" tab, but the active tab is "' + name + '".\n\n' +
      'Click a cell on the row you want, then run it from the Property Intel menu.',
      ui.ButtonSet.OK);
    return null;
  }
  const row = active.getActiveCell().getRow();
  if (row < 2) {
    ui.alert('Select a data row', 'Row 1 is the header.', ui.ButtonSet.OK);
    return null;
  }
  return row;
}

function golfSiteNoOf_(raw) {
  return String(raw || '').trim();
}

function golfRoundCoord_(n) {
  return Math.round(Number(n) * 1e6) / 1e6;
}

// Checkboxes on I for current rows plus a runway so new typed rows get a
// box without re-running setup. Setup used to insert them only when the
// tab already had data, so a headers-only first run left Golf-1..n with
// a plain Elements Reviewed column. Also moves a stray "saved N pin(s)"
// string (that is Status text) out of I and into J.
function golfEnsureReviewedCheckboxes_(sheet) {
  const last = Math.max(sheet.getLastRow(), 2);
  const rows = Math.max(last - 1, 1) + 50;
  const range = sheet.getRange(2, GOLF_COL_REVIEWED, rows, 1);
  const vals = range.getValues();
  for (let i = 0; i < vals.length; i++) {
    const v = vals[i][0];
    if (v === true || v === false || v === '' || v === null) continue;
    const s = String(v).trim();
    if (/^saved \d+ pin/i.test(s)) {
      writePlainCell(sheet, i + 2, GOLF_COL_STATUS, s);
    }
    sheet.getRange(i + 2, GOLF_COL_REVIEWED).clearContent();
  }
  range.insertCheckboxes();
}

// ── Sheet setup ─────────────────────────────────────────────────────────────

function setupGolfSheet() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(GOLF_SHEET);
  const created = !sheet;
  if (!sheet) sheet = ss.insertSheet(GOLF_SHEET);

  if (sheet.getMaxColumns() < GOLF_HEADERS.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), GOLF_HEADERS.length - sheet.getMaxColumns());
  }
  sheet.getRange(1, 1, 1, GOLF_HEADERS.length).setValues([GOLF_HEADERS]).setFontWeight('bold');
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(4);
  golfEnsureReviewedCheckboxes_(sheet);

  ui.alert('Golf',
    (created ? 'Created the "' + GOLF_SHEET + '" tab.' : 'Updated the "' + GOLF_SHEET + '" header row.') +
    '\n\n' + GOLF_HEADERS.length + ' columns, A..J. Enter Site No, Account Type, Account Name, ' +
    'Property Address (and HOA if any), then run "Geocode Address — Pass 1".',
    ui.ButtonSet.OK);
}

function setupGolfPinsSheet() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(GOLF_PINS_SHEET);
  const created = !sheet;
  if (!sheet) sheet = ss.insertSheet(GOLF_PINS_SHEET);

  if (sheet.getMaxColumns() < GOLF_PIN_HEADERS.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), GOLF_PIN_HEADERS.length - sheet.getMaxColumns());
  }
  sheet.getRange(1, 1, 1, GOLF_PIN_HEADERS.length).setValues([GOLF_PIN_HEADERS]).setFontWeight('bold');
  sheet.setFrozenRows(1);

  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    ui.alert('Golf Pins',
      'The "' + GOLF_PINS_SHEET + '" tab already has ' + (lastRow - 1) + ' pin row(s). ' +
      'Left them alone so authored definitions are not overwritten.\n\n' +
      'To re-seed from GOLF_PIN_SEED, blank rows 2+ and run this again.',
      ui.ButtonSet.OK);
    return;
  }

  const rows = GOLF_PIN_SEED.map(function (p) {
    return [p.id, p.name, p.definition || '', p.section];
  });
  sheet.getRange(2, 1, rows.length, 4).setValues(rows);
  ui.alert('Golf Pins',
    (created ? 'Created' : 'Seeded') + ' the "' + GOLF_PINS_SHEET + '" tab with ' +
    rows.length + ' pins in ' + GOLF_SECTION_NAMES.length + ' sections (ids 1001–' +
    GOLF_PIN_SEED[GOLF_PIN_SEED.length - 1].id + ').\n\n' +
    'This catalog is independent of pins-catalog.json. Do not merge them.',
    ui.ButtonSet.OK);
}

// ── Catalog ─────────────────────────────────────────────────────────────────

function golfCatalogFromSeed_() {
  return GOLF_PIN_SEED.map(function (p) {
    return { id: p.id, name: p.name, definition: p.definition || '', section: p.section };
  });
}

function golfReadPinsSheet_(ss) {
  let sheet;
  try { sheet = golfPinsSheet_(ss); } catch (e) { return null; }
  const last = sheet.getLastRow();
  if (last < 2) return null;
  const vals = sheet.getRange(2, 1, last - 1, 4).getValues();
  const out = [];
  for (let i = 0; i < vals.length; i++) {
    const id = parseInt(vals[i][0], 10);
    const name = String(vals[i][1] || '').trim();
    if (!isFinite(id) || id < 1 || !name) continue;
    out.push({
      id: id,
      name: name,
      definition: String(vals[i][2] || '').trim(),
      section: String(vals[i][3] || '').trim()
    });
  }
  return out.length ? out : null;
}

function golfFetchPinCatalog_() {
  const ss = golfOpenSs_();
  const pins = golfReadPinsSheet_(ss) || golfCatalogFromSeed_();
  const byId = {};
  const ids = {};
  for (let i = 0; i < pins.length; i++) {
    byId[pins[i].id] = pins[i];
    ids[pins[i].id] = true;
  }
  const grouped = {};
  GOLF_SECTION_NAMES.forEach(function (s) { grouped[s] = []; });
  pins.forEach(function (p) {
    if (!grouped[p.section]) grouped[p.section] = [];
    grouped[p.section].push(p);
  });
  const sections = [];
  const seen = {};
  GOLF_SECTION_NAMES.forEach(function (s) {
    sections.push({ name: s, pins: grouped[s] || [] });
    seen[s] = true;
  });
  Object.keys(grouped).forEach(function (s) {
    if (!seen[s] && grouped[s].length) sections.push({ name: s, pins: grouped[s] });
  });
  return { pins: pins, byId: byId, ids: ids, sections: sections };
}

function golfGetCatalog_() {
  const cat = golfFetchPinCatalog_();
  return {
    ok: true,
    route: 'golf-catalog',
    pin_count: cat.pins.length,
    max_pins: GOLF_MAX_PINS,
    sections: cat.sections,
    server_time: new Date().toISOString()
  };
}

// ── Pin parse / validate ────────────────────────────────────────────────────

function golfParsePinCell_(raw) {
  const s = String(raw || '').trim();
  if (!s || s.indexOf('ERROR:') === 0) return [];
  let v;
  try { v = JSON.parse(s); } catch (e) { return []; }
  if (!Array.isArray(v)) return [];
  return v.filter(function (p) {
    return p && typeof p === 'object' &&
      isFinite(parseInt(p.id, 10)) &&
      isFinite(parseFloat(p.lat)) &&
      isFinite(parseFloat(p.lng));
  }).map(function (p) {
    return {
      id: parseInt(p.id, 10),
      lat: golfRoundCoord_(p.lat),
      lng: golfRoundCoord_(p.lng)
    };
  });
}

function golfValidatePins_(pins, ids) {
  if (!Array.isArray(pins)) {
    return { ok: false, error: 'pins is not an array' };
  }
  if (pins.length > GOLF_MAX_PINS) {
    return { ok: false, error: 'refused: ' + pins.length + ' pins exceeds GOLF_MAX_PINS (' + GOLF_MAX_PINS + ')' };
  }
  const out = [];
  const bad = [];
  for (let i = 0; i < pins.length; i++) {
    const p = pins[i] || {};
    const id = parseInt(p.id, 10);
    const lat = parseFloat(p.lat);
    const lng = parseFloat(p.lng);
    if (!isFinite(id) || !ids[id]) {
      bad.push('index ' + i + ' unknown id ' + p.id);
      continue;
    }
    if (!isFinite(lat) || !isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      bad.push('index ' + i + ' id ' + id + ' bad lat/lng');
      continue;
    }
    out.push({ id: id, lat: golfRoundCoord_(lat), lng: golfRoundCoord_(lng) });
  }
  if (bad.length) {
    return { ok: false, error: 'refused: ' + bad.length + ' invalid pin(s): ' + bad.slice(0, 8).join('; ') };
  }
  return { ok: true, pins: out };
}

function golfFindRowBySiteNo_(sheet, siteNo) {
  const key = golfSiteNoOf_(siteNo);
  if (!key) throw new Error('site_no is required');
  const last = sheet.getLastRow();
  if (last < 2) throw new Error('Golf sheet has no data rows');
  const vals = sheet.getRange(2, GOLF_COL_SITE_NO, last - 1, 1).getValues();
  let found = 0;
  let row = 0;
  for (let i = 0; i < vals.length; i++) {
    if (golfSiteNoOf_(vals[i][0]) === key) {
      found++;
      if (!row) row = i + 2;
    }
  }
  if (!found) throw new Error('no Golf row for site_no "' + key + '"');
  if (found > 1) {
    Logger.log('golfFindRowBySiteNo_: ' + found + ' Golf rows share site_no "' + key + '"; using row ' + row);
  }
  return row;
}

function golfGetElements_(p) {
  p = p || {};
  const siteNo = golfSiteNoOf_(p.site_no || p.siteNo);
  if (!siteNo) throw new Error('golf-elements requires site_no');
  const ss = golfOpenSs_();
  const sheet = golfSheet_(ss);
  const row = golfFindRowBySiteNo_(sheet, siteNo);
  const width = Math.max(sheet.getLastColumn(), GOLF_COL_STATUS);
  const v = sheet.getRange(row, 1, 1, width).getValues()[0];
  const elementsRaw = String(v[GOLF_COL_ELEMENTS - 1] || '').trim();
  const lat = parseFloat(v[GOLF_COL_LAT - 1]);
  const lng = parseFloat(v[GOLF_COL_LNG - 1]);
  const out = {
    ok: true,
    route: 'golf-elements',
    view: 'golf',
    row: row,
    site_no: siteNo,
    name: String(v[GOLF_COL_ACCOUNT - 1] || '').trim(),
    address: String(v[GOLF_COL_ADDRESS - 1] || '').trim(),
    account_type: String(v[GOLF_COL_ACCOUNT_TYPE - 1] || '').trim(),
    pins: golfParsePinCell_(elementsRaw),
    reviewed: v[GOLF_COL_REVIEWED - 1] === true,
    max_pins: GOLF_MAX_PINS,
    server_time: new Date().toISOString()
  };
  if (isFinite(lat) && isFinite(lng)) { out.lat = lat; out.lng = lng; }
  return out;
}

function golfSavePins_(payload) {
  payload = payload || {};
  const siteNo = golfSiteNoOf_(payload.site_no || payload.siteNo);
  if (!siteNo) return { ok: false, error: 'site_no is required' };

  const cat = golfFetchPinCatalog_();
  const checked = golfValidatePins_(payload.pins, cat.ids);
  if (!checked.ok) return { ok: false, error: checked.error };

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const ss = golfOpenSs_();
    const sheet = golfSheet_(ss);
    const row = golfFindRowBySiteNo_(sheet, siteNo);
    writePlainCell(sheet, row, GOLF_COL_ELEMENTS,
      checked.pins.length ? JSON.stringify(checked.pins) : '');
    writePlainCell(sheet, row, GOLF_COL_STATUS,
      'saved ' + checked.pins.length + ' pin(s) ' + new Date().toISOString());
    golfEnsureReviewedCheckboxes_(sheet);
    SpreadsheetApp.flush();
    return {
      ok: true,
      route: 'golf-save',
      view: 'golf',
      site_no: siteNo,
      row: row,
      count: checked.pins.length,
      pins: checked.pins
    };
  } finally {
    lock.releaseLock();
  }
}

// ── Pass 1: geocode only ────────────────────────────────────────────────────

function golfGeocodeRow_(sheet, row) {
  const address = String(sheet.getRange(row, GOLF_COL_ADDRESS).getValue() || '').trim();
  if (!address) {
    writePlainCell(sheet, row, GOLF_COL_STATUS, 'ERROR: no address');
    return false;
  }
  let lat = parseFloat(sheet.getRange(row, GOLF_COL_LAT).getValue());
  let lng = parseFloat(sheet.getRange(row, GOLF_COL_LNG).getValue());
  if (isFinite(lat) && isFinite(lng)) {
    writePlainCell(sheet, row, GOLF_COL_STATUS, 'coords already set');
    return true;
  }
  const coords = geocodeAddress(address);
  if (!coords) {
    writePlainCell(sheet, row, GOLF_COL_STATUS, 'ERROR: Geocoding failed');
    return false;
  }
  sheet.getRange(row, GOLF_COL_LAT).setValue(coords.lat);
  sheet.getRange(row, GOLF_COL_LNG).setValue(coords.lng);
  writePlainCell(sheet, row, GOLF_COL_STATUS, 'geocoded');
  golfEnsureReviewedCheckboxes_(sheet);
  SpreadsheetApp.flush();
  return true;
}

function generateGolfGeocodeForActiveRow() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(GOLF_SHEET);
  if (!sheet) {
    SpreadsheetApp.getUi().alert('Sheet "' + GOLF_SHEET + '" not found — run Set Up Golf Sheet first.');
    return;
  }
  const row = golfActiveRow_();
  if (!row) return;
  const ok = golfGeocodeRow_(sheet, row);
  const address = String(sheet.getRange(row, GOLF_COL_ADDRESS).getValue() || '').trim();
  SpreadsheetApp.getUi().alert('Golf Pass 1 (Geocode)',
    ok ? ('Coordinates written for:\n' + address + '\n\nOpen Golf Review to place pins.')
       : ('Geocode failed for row ' + row + '. See Status.'),
    SpreadsheetApp.getUi().ButtonSet.OK);
}

function generateGolfGeocodeBatch() {
  const ui = SpreadsheetApp.getUi();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(GOLF_SHEET);
  if (!sheet) {
    ui.alert('Sheet "' + GOLF_SHEET + '" not found — run Set Up Golf Sheet first.');
    return;
  }
  const last = sheet.getLastRow();
  if (last < 2) { ui.alert('Golf Pass 1 (Geocode)', 'No data rows.', ui.ButtonSet.OK); return; }
  const width = Math.max(sheet.getLastColumn(), GOLF_COL_STATUS);
  const data = sheet.getRange(2, 1, last - 1, width).getValues();
  const ready = [];
  for (let i = 0; i < data.length; i++) {
    const address = String(data[i][GOLF_COL_ADDRESS - 1] || '').trim();
    if (!address) continue;
    const lat = parseFloat(data[i][GOLF_COL_LAT - 1]);
    const lng = parseFloat(data[i][GOLF_COL_LNG - 1]);
    if (isFinite(lat) && isFinite(lng)) continue;
    ready.push(i + 2);
  }
  if (!ready.length) {
    ui.alert('Golf Pass 1 (Geocode)', 'No rows with an address and missing coordinates.', ui.ButtonSet.OK);
    return;
  }
  const batch = ready.slice(0, BATCH_SIZE);
  let ok = 0;
  for (let i = 0; i < batch.length; i++) {
    if (golfGeocodeRow_(sheet, batch[i])) ok++;
  }
  ui.alert('Golf Pass 1 (Geocode)',
    'Geocoded ' + ok + ' of ' + batch.length + ' (queue was ' + ready.length + ').',
    ui.ButtonSet.OK);
}

// ── Review link ─────────────────────────────────────────────────────────────

function buildGolfReviewUrl_(sheet, row) {
  const siteNo = golfSiteNoOf_(sheet.getRange(row, GOLF_COL_SITE_NO).getValue());
  const address = String(sheet.getRange(row, GOLF_COL_ADDRESS).getValue() || '').trim();
  const lat = parseFloat(sheet.getRange(row, GOLF_COL_LAT).getValue());
  const lng = parseFloat(sheet.getRange(row, GOLF_COL_LNG).getValue());
  if (!siteNo) return null;
  if (!isFinite(lat) || !isFinite(lng)) return null;
  return GOLF_REVIEW_URL +
    '?site_no=' + encodeURIComponent(siteNo) +
    '&lat=' + encodeURIComponent(String(lat)) +
    '&lng=' + encodeURIComponent(String(lng)) +
    (address ? '&addr=' + encodeURIComponent(address) : '');
}

function openGolfReviewForActiveRow() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(GOLF_SHEET);
  if (!sheet) {
    SpreadsheetApp.getUi().alert('Sheet "' + GOLF_SHEET + '" not found — run Set Up Golf Sheet first.');
    return;
  }
  const row = golfActiveRow_();
  if (!row) return;
  const url = buildGolfReviewUrl_(sheet, row);
  if (!url) {
    SpreadsheetApp.getUi().alert('Golf Review',
      'Row ' + row + ' needs a Site No and geocoded Lat/Lng.\nRun "Geocode Address — Pass 1 (This Row)" first. Empty pins are fine — placement starts from scratch.',
      SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }
  const address = String(sheet.getRange(row, GOLF_COL_ADDRESS).getValue() || '').trim();
  reviewOpenDialog_(address, url);
}
