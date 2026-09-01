// ============================================================
// PROPERTY INTEL — Apps Script v5.28 — FILE 3/7: menu.gs
// Menu and thin sync wrappers. v5.20: the three [v1] Plane
// Imagery items are RETIRED (the v1 render Lambda writes to old
// column positions and must never fire against the new layout).
// v5.22: adds two Plane Pipeline items — "Rerun Element Pins from
// Fixes (This Row)" and "(All Flagged)" — for the Pass 1 rerun.
// v5.23: adds two Pass 2 items — "Generate Pass 2 — Concerns +
// Descriptions (This Row)" and "(All Reviewed)".
//
// v5.25 (2026-08-14): "Open Element Review (This Row)" — the SATELLITE one —
// is promoted to the FIRST item of the top-level menu, above "Sync This Row to
// GitHub". From Monday a team of four reviewers opens that page hundreds of
// times a day; it was three levels deep under Satellite Pipeline (v2) while the
// items above it were one-off admin actions. Its own separator keeps it from
// reading as part of the sync group.
// ⚠️ It is deliberately still listed inside Satellite Pipeline (v2) as well —
// same handler, two entry points. Anyone who learned the old location keeps it.
//
// v5.26 (2026-08-27): Drone Test This-Row items for 3D models, images, and
// GitHub sync, plus Approach handlers (old Storyboard labels were pointing
// at functions that did not exist). Aliases in drone-test.gs keep a stale
// deployed menu from throwing.
//
// v5.28 (2026-08-27): drone-test sync joins or creates an index file by
// property name (droneTestHubId_ in shared.gs). No new menu item.
//
// v5.31 (2026-09-01): Golf Pipeline — geocode-only Pass 1 + golf-review.html.
// Independent Golf Pins catalog. No Bedrock, no element-critique, no GitHub.
// ============================================================

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Property Intel')
    .addItem('Open Element Review (This Row)', 'openSatElementReviewForActiveRow')
    .addSeparator()
    .addItem('Sync This Row to GitHub', 'syncActiveRow')
    .addItem('Sync Satellite to GitHub', 'generateForSatellite')
    .addItem('Sync Plane', 'generateForPlane')
    .addItem('Sync Drone', 'generateForDrone')
    .addItem('Sync Interior', 'generateForInterior')
    .addItem('Sync Now (All)', 'syncNow')
    .addSeparator()
    .addSubMenu(SpreadsheetApp.getUi().createMenu('Plane Pipeline')
      .addItem('Check Plane Eligibility', 'checkPlaneEligibility')
      .addSeparator()
      .addItem('Generate 3D Models (v2)', 'generate3DModelsV2')
      .addItem('Regenerate 3D Model (This Row) (v2)', 'regeneratePlaneModelForActiveRow')
      .addItem('Regenerate 3D Models (Selected Rows) (v2)', 'regeneratePlaneModelsForSelectedRows')
      .addItem('Generate Property Images (v2)', 'generateImagesV2')
      .addItem('Generate Storyboard (v2)', 'generateStoryboardV2')
      .addItem('Generate Storyboard (This Row) (v2)', 'generateStoryboardForActiveRow')
      .addItem('Generate Element Pins — Pass 1 (v2)', 'generateElementPinsV2')
      .addItem('Generate Element Pins — Pass 1 (This Row) (v2)', 'generateElementPinsForActiveRow')
      .addItem('Open Element Review (This Row)', 'openElementReviewForActiveRow')
      .addItem('Rerun Element Pins from Fixes (This Row)', 'rerunElementPinsForActiveRow')
      .addItem('Rerun Element Pins from Fixes (All Flagged)', 'rerunElementPinsBatch')
      .addItem('Generate Pass 2 — Concerns + Descriptions (This Row)', 'generatePass2ForActiveRow')
      .addItem('Generate Pass 2 — Concerns + Descriptions (All Reviewed)', 'generatePass2V2')
      .addItem('Check v2 Job Status', 'checkV2JobStatus')
      .addItem('Cancel v2 Jobs', 'cancelV2Jobs'))
    .addSeparator()
    .addSubMenu(SpreadsheetApp.getUi().createMenu('Satellite Pipeline (v2)')
      .addItem('Generate Element Pins — Pass 1 (Batch)', 'generateSatElementPinsBatch')
      .addItem('Generate Element Pins — Pass 1 (This Row)', 'generateSatElementPinsForActiveRow')
      .addItem('Start Auto Element Pins (Pass 1, every 5 min)', 'startSatElementPinsAuto')
      .addItem('Stop Auto Element Pins (Pass 1)', 'stopSatElementPinsAuto')
      .addItem('Check Auto Element Pins Status', 'checkSatElementPinsAutoStatus')
      .addItem('Open Element Review (This Row)', 'openSatElementReviewForActiveRow')
      .addItem('Rerun Element Pins from Fixes (This Row)', 'rerunSatElementPinsForActiveRow')
      .addItem('Rerun Element Pins from Fixes (All Flagged)', 'rerunSatElementPinsBatch')
      .addItem('Start Auto Rerun from Fixes (every 5 min)', 'startSatElementRerunAuto')
      .addItem('Stop Auto Rerun from Fixes', 'stopSatElementRerunAuto')
      .addItem('Check Auto Rerun Status', 'checkSatElementRerunAutoStatus')
      .addItem('Generate Pass 2 — FR + Wildfire Concerns (This Row)', 'generateSatPass2ForActiveRow')
      .addItem('Generate Pass 2 — FR + Wildfire Concerns (All Reviewed)', 'generateSatPass2Batch'))
    .addSeparator()
    .addSubMenu(SpreadsheetApp.getUi().createMenu('Golf Pipeline')
      .addItem('Set Up Golf Sheet', 'setupGolfSheet')
      .addItem('Set Up Golf Pins Sheet', 'setupGolfPinsSheet')
      .addItem('Geocode Address — Pass 1 (This Row)', 'generateGolfGeocodeForActiveRow')
      .addItem('Geocode Address — Pass 1 (All Missing Coords)', 'generateGolfGeocodeBatch')
      .addItem('Open Golf Review (This Row)', 'openGolfReviewForActiveRow'))
  .addSeparator()
  .addSubMenu(SpreadsheetApp.getUi().createMenu('Responder Intel (Client)')
    .addItem('Publish This Row', 'publishResponderIntelThisRow')
    .addItem('Publish All Complete Rows', 'publishResponderIntel'))
  .addSeparator()
  .addSubMenu(SpreadsheetApp.getUi().createMenu('Drone Test')
    .addItem('Set Up drone-test Sheet',             'setupDroneTestSheet')
    .addItem('Generate 3D Models',                  'generate3DModelsDT')
    .addItem('Generate 3D Models (This Row)',       'generate3DModelsForActiveRowDT')
    .addItem('Generate Property Images',            'generateImagesDT')
    .addItem('Generate Property Images (This Row)', 'generateImagesForActiveRowDT')
    .addItem('Generate Approach',                   'generateApproachDT')
    .addItem('Generate Approach (This Row)',        'generateApproachForActiveRowDT')
    .addItem('Element Pins — Pass 1',               'generateElementPinsDT')
    .addItem('Element Pins — Pass 1 (This Row)',    'generateElementPinsForActiveRowDT')
    .addItem('Open Element Review (This Row)',      'openElementReviewForActiveRowDT')
    .addItem('Backfill Nadir Bounds (This Row)',     'backfillNadirBoundsForActiveRowDT')
    .addItem('Rerun Pins from Fixes (This Row)',    'rerunElementPinsForActiveRowDT')
    .addItem('Rerun Pins from Fixes (Flagged)',     'rerunElementPinsBatchDT')
    .addItem('Pass 2 — Concerns + Descriptions',    'generatePass2DT')
    .addItem('Pass 2 (This Row)',                   'generatePass2ForActiveRowDT')
    .addItem('Check Job Status',                    'checkDroneTestJobStatus')
    .addItem('Cancel Jobs',                         'cancelDroneTestJobs')
    .addItem('Sync This Row to GitHub',             'processDroneTestForActiveRowDT')
    .addItem('Sync drone-test to GitHub',           'processDroneTestSheet'))
  .addSubMenu(SpreadsheetApp.getUi().createMenu('Responder Directions')
    .addItem('Set Up responder-directions Sheet',  'setupDirectionsSheet')
    .addItem('Generate Directions (This Row)',     'generateDirectionsForActiveRowRD')
    .addItem('Generate Directions (All Ready)',    'generateDirectionsRD')
    .addItem('Open Route Review (This Row)',       'openDirectionsReviewForActiveRowRD')
    .addItem('Rerun from Fixes (This Row)',        'rerunDirectionsForActiveRowRD')
    .addItem('Rerun from Fixes (All Flagged)',     'rerunDirectionsBatchRD'))
    .addToUi();
}

function generateForSatellite() { processSatelliteSheet(); }
function generateForPlane()     { processPlaneSheet(); }
function generateForDrone()     { processSheet(DRONE_SHEET,    'drone'); }
function generateForInterior()  { processSheet(INTERIOR_SHEET, 'interior'); }
function syncNow() {
  processSatelliteSheet();
  processPlaneSheet();
  processSheet(DRONE_SHEET,    'drone');
  processSheet(INTERIOR_SHEET, 'interior');
}