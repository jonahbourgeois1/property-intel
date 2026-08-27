// ============================================================
// PROPERTY INTEL — Apps Script v5.24 — FILE 1/7: config.gs
// Constants, column maps, credentials, account-type helpers.
//
// Changes from v5.23:
//   - FOLDER-ONLY INDEX. The monolithic data/index.json is removed
//     entirely — deleted and no longer referenced. Each property is one
//     file in data/index/{id}.json holding identity + its per-tab view
//     hashes. Every sheet sync does read-merge-write PER PROPERTY: it
//     fetches that property's index file and merges in ONLY the view keys
//     it owns (satellite: security/wildfire; plane: plane; drone/interior:
//     their own), creating the file if absent and updating if present. A
//     sync never touches another sync's view keys, so one account's file
//     accumulates every tab and nothing clobbers — the fix for the FR link
//     opening satellite data. Helpers live in shared.gs (fetchIndexEntry_/
//     mergeIndexEntry_/buildIndexEntryFile_/upsertIndexEntry_/listIndexIds_/
//     deleteIndexEntryFile_). No migration and no monolith writer remain.
//     Satellite stale sweep: drop only security/wildfire from a stale
//     file; delete the file only when no views remain. (Viewers move to
//     data/index/{id}.json in a following change.)
//
// Changes from v5.22:
//   - PASS 2 (Stage 4) added — the reviewed-gated evaluative pass.
//     Runs only on rows with Elements Reviewed (Q) ticked; takes the
//     approved element pins (P) as trusted ground truth and, in one
//     Bedrock call over the same five images, writes the concern pins
//     (S), four oblique descriptions (T:W), responder considerations
//     (X), and clarifications (Y). Pass 2 NEVER writes P, Q, or R —
//     approved element pins are frozen.
//   - prompts.gs: planeConcernAndDescPrompt_ (Pass 2 system prompt,
//     concern-only vocabulary, same JSON shape parsePlaneDescriptions_
//     validates).
//   - plane.gs: fetchPinCatalog_ gained concernNames/concernIds (cache
//     key advanced to the v4 shape); validateConcernPins_ (concern-id-
//     gated, so element ids can't leak into S); planeRowReadyForPass2_
//     (Q === true AND Alpha Description empty/ERROR); runPass2Call_ /
//     processPass2Row_ + generatePass2V2 (batch, up to PLANE_DESC_BATCH)
//     and generatePass2ForActiveRow (this-row, requires Q, confirms
//     overwrite).
//   - menu: "Generate Pass 2 — Concerns + Descriptions (This Row)" and
//     "(All Reviewed)".
//   - A row becomes Sync-complete only after Pass 2 fills T:W; Sync
//     continues to skip element-only rows during the Pass 1→Pass 2 gap.
//
// Changes from v5.21:
//   - PASS 1 RERUN (Stage 3) added — re-pins a Plane row's ELEMENT
//     pins using the analyst's Nadir Fixes (R) note as authoritative
//     corrections. Option C: text coordinates, no render Lambda, no
//     AWS work. The rerun sends the SAME five clean images as Pass 1
//     plus the current pins as named text and the R note; the model
//     re-emits corrected element pins.
//   - runElementPinsCall_ extracted (plane.gs) as the shared core for
//     BOTH Pass 1 and the rerun (image fetch loop, Bedrock call, parse,
//     validate, write Nadir Elements (P), reset Elements Reviewed (Q)).
//     processElementPinsRow_ is now a thin Pass 1 wrapper;
//     rerunElementPinsRow_ is the rerun wrapper.
//   - fetchPinCatalog_ gained namesList ([{id,name}] for every pin) so
//     the rerun can render the current pins as named text; its cache
//     key was advanced to the v3 shape (the prior cached object lacked
//     namesList and would break the rerun prompt).
//   - The rerun NEVER writes Nadir Fixes (R) — R is the analyst's
//     standing record; overwrite it by hand to steer a later rerun.
//     R has no bearing on Pass 2: Elements Reviewed (Q) ALONE gates it.
//   - Menu: "Rerun Element Pins from Fixes (This Row)" and "(All
//     Flagged)". Batch selector: R non-empty AND Q unchecked. This-Row:
//     ignores Q (row explicitly picked) but requires a non-empty R.
//
// Changes from v5.20:
//   - STAGE 2 — TRUE PASS 1 (elements only): the interim combined
//     Stage C call is replaced by an element-pins-only pass. It
//     sends the five images with an ELEMENT-section-only pin
//     vocabulary (ids 1–150 ∪ 276–650, derived at runtime from the
//     single catalog — no second JSON) and writes element pins to
//     Nadir Elements (P) ONLY. It resets Elements Reviewed (Q) to
//     unchecked. It writes nothing to S:Y — concern pins, oblique
//     descriptions, considerations, and clarifications are Pass 2
//     (Stage 4, not yet built).
//   - Menu: "Generate Descriptions (v2)" → "Generate Element Pins
//     — Pass 1 (v2)" (+ This Row variant), wired to
//     generateElementPinsV2 / generateElementPinsForActiveRow.
//   - ELEMENT REVIEW: new "Open Element Review (This Row)" menu
//     action builds a query-param link to element-review.html
//     (a repo page) that renders numbered markers on the real
//     nadir with a named legend strip, so Pass 1 pins can be QA'd
//     before ticking Elements Reviewed. No new sheet column; the
//     link is shown in a dialog. Names resolve page-side from the
//     live catalog. ELEMENT_REVIEW_URL added below.
//   - GAP BEHAVIOR (Option B): no fallback combined call. Between
//     Stage 2 and Stage 4, rows can be pinned + reviewed but cannot
//     reach "complete", so Sync Plane intentionally skips them
//     until Pass 2 fills the oblique descriptions.
//   - Catalog cache key bumped: the cached object gained
//     elementNames/elementIds; the old shape would break Pass 1
//     validation.
//   - Retained but no longer called by Pass 1 (Pass 2 will use
//     them): validatePlanePins_ (full-catalog), splitPlanePinsBySection_,
//     parsePlaneDescriptions_, planeDescPromptResidential_/Commercial_.
//
// Changes from v5.19 (v5.20):
//   - Full 27-column Plane layout remap; v1 imagery retired; dead
//     code removed; monolith split into seven files. (See history.)
//
// Required Script Properties:
//   GITHUB_TOKEN, MAPS_KEY, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY,
//   AWS_REGION, BEDROCK_KB_ID, BEDROCK_MODEL_ID, HASH_SALT
// ============================================================

const SATELLITE_SHEET   = 'Satellite';
const PLANE_SHEET       = 'Plane';
const DRONE_SHEET       = 'Drone';
const INTERIOR_SHEET    = 'Interior';
const INTEL_LINKS_SHEET = 'Intel Links';
const GITHUB_REPO       = 'jonahbourgeois1/property-intel';
const GITHUB_BRANCH     = 'main';
const VIEWER_BASE_URL   = 'https://responder-intel.vyanet.com/viewer.html';
const BATCH_SIZE        = 20;
const ZOOM_LEVELS       = [18, 19, 20];
const VIEW_ORDER        = ['security', 'wildfire', 'plane', 'drone', 'interior'];
const VIEW_LABELS       = { security: 'Security', wildfire: 'Wildfire', plane: 'Plane', drone: 'Drone', interior: 'Interior' };

const RESPONDER_INTEL_URL = 'https://responder-intel.vyanet.com/responder-intel.html';

// Plane pipeline (AWS) constants
const PLANE_API_BASE           = 'https://cdq6a4v125.execute-api.us-east-1.amazonaws.com/prod';
const ELIGIBILITY_BATCH_SIZE   = 50; // addresses per eligibility Lambda call (~200-400ms each; stays under API GW 29s)

// Plane pipeline v2 constants
const V2_FIRE_PER_TICK    = 3;  // async render dispatches per minute
const V2_MAX_POLLS        = 30; // ~30 minutes before giving up
const V2_ELIG_BATCH       = 5;  // v2 taxlot resolution batch (tile-opacity checks are ~1-2s each; stay far under API GW 29s)
const PLANE_DESC_BATCH    = 4;  // description rows per manual run (each ~60-90s; stays under the 6-min ceiling)
const PIN_CATALOG_URL  = 'https://responder-intel.vyanet.com/data/pin-catalog/pins-catalog.json';
const PLANE_MAX_PINS   = 10; // hard cap per property (PLANE + drone-test)
const SAT_MAX_PINS     = 12; // standard satellite element pins
const SAT_MAX_PINS_SCHOOL = 20; // school Pass 1 / review / rerun — campuses
                             // have more physical elements than a house.
                             // CRITIQUE_PIN_SLOTS must be >= this number.

// v5.24: the merged catalog (pins-catalog.json) tags each pin with role
// (primary|concern), account_type, and analysis (shared|fr|wf). fetchPinCatalog_
// filters on those tags per account type — the old PIN_ELEMENT_RANGES /
// PIN_CONCERN_RANGES id-range math is retired.
const ELEMENT_REVIEW_URL = 'https://responder-intel.vyanet.com/element-review.html'; // Pass 1 pin QA page

// (v5.24: PIN_ELEMENT_RANGES / PIN_CONCERN_RANGES removed — the merged
// pins-catalog.json is tag-based; fetchPinCatalog_ filters on role/analysis/
// account_type instead of id ranges.)

// Parcel constants
const PARCEL_BASE    = 'https://raw.githubusercontent.com/jonahbourgeois1/property-intel/main/data/parcels/';
const PARCEL_LAT_MIN = 43.61;
const PARCEL_LNG_MIN = -122.01;
const PARCEL_CELL    = 0.07;

// ── Satellite sheet column map (1-indexed) — LEGACY pre-v5.24 single-pass ──
// Retained ONLY until the satellite pipeline is rewritten to the two-pass
// layout below; the current satellite.gs code still reads/writes these.
// Retire COL_* (and the annotated-nadir machinery) when that rewrite lands.
// A Account Type · B Account Name · C Property Address · D HOA · E Nadir View
// URL · F FR Nadir URL · G FR Elements · H FR Considerations · I FR Rec ·
// J WF Nadir URL · K WF Conditions · L WF Rec · M FR Link · N WF Link ·
// O Upload Date · P Latitude · Q Longitude
const COL_ACCOUNT_TYPE = 1;
const COL_ACCOUNT      = 2;
const COL_ADDRESS      = 3;
const COL_HOA          = 4;
const COL_NADIR        = 5;
const COL_FR_NADIR     = 6;
const COL_ELEMENTS     = 7;
const COL_CONCERNS     = 8;
const COL_FR_REC       = 9;
const COL_WF_NADIR     = 10;
const COL_WF_CONDS     = 11;
const COL_WF_REC       = 12;
const COL_FR_LINK      = 13;
const COL_WF_LINK      = 14;
const COL_DATE         = 15;
const COL_LAT          = 16;
const COL_LNG          = 17;

const SAT_COL_SITE_NO      = 1;  // A — site_no. THE IDENTITY: hashed to the property id.
const SAT_COL_ACCOUNT_TYPE = 2;  // B
const SAT_COL_ACCOUNT      = 3;  // C — display label only, no longer identity
const SAT_COL_ADDRESS      = 4;  // D
const SAT_COL_HOA          = 5;  // E
const SAT_COL_LAT          = 6;  // F
const SAT_COL_LNG          = 7;  // G
const SAT_COL_NADIR_URL    = 8;  // H — single clean nadir
const SAT_COL_ELEMENTS     = 9;  // I — element pins JSON (Pass 1)
const SAT_COL_REVIEWED     = 10; // J — Elements Reviewed checkbox (Pass 2 gate)
const SAT_COL_FIXES        = 11; // K — Nadir Fixes free text (rerun)
const SAT_COL_FR_CONCERNS  = 12; // L — FR concern pins JSON (Pass 2)
const SAT_COL_FR_CONSIDER  = 13; // M — FR considerations paragraph
const SAT_COL_FR_REC       = 14; // N — FR recommendations
const SAT_COL_WF_CONCERNS  = 15; // O — Wildfire concern pins JSON (Pass 2)
const SAT_COL_WF_CONSIDER  = 16; // P — Wildfire considerations paragraph
const SAT_COL_WF_REC       = 17; // Q — Wildfire recommendations
const SAT_COL_FR_LINK      = 18; // R
const SAT_COL_WF_LINK      = 19; // S
const SAT_COL_UPLOAD_DATE  = 20; // T

// ── Plane sheet column map (1-indexed) — NEW 27-column layout (v5.20) ───────
// Migrated by plane-migration-v1.gs on 2026-07-14. Blocks read left-to-right
// in pipeline order: identity -> capture -> Pass 1 + review -> Pass 2 -> output.
// A  Account Type          | B  Property Name       | C  Property Address
// D  HOA                   | E  Taxlot              | F  Lat
// G  Lng                   | H  Upload Date         | I  Nadir Image URL
// J  Nadir Bounds          | K  Alpha Image URL     | L  Bravo Image URL
// M  Charlie Image URL     | N  Delta Image URL     | O  360 View URL
// P  Nadir Elements        | Q  Elements Reviewed ☑ | R  Nadir Fixes
// S  Nadir Concerns        | T  Alpha Description   | U  Bravo Description
// V  Charlie Description   | W  Delta Description   | X  Responder Considerations
// Y  Information Needing Clarification              | Z  FR Link
// AA v2 Status
const PLANE_COL_ACCOUNT_TYPE = 1;  // A
const PLANE_COL_ACCOUNT      = 2;  // B — Property Name
const PLANE_COL_ADDRESS      = 3;  // C
const PLANE_COL_HOA          = 4;  // D
const PLANE_COL_TAXLOT       = 5;  // E
const PLANE_COL_LAT          = 6;  // F
const PLANE_COL_LNG          = 7;  // G
const PLANE_COL_UPLOAD_DATE  = 8;  // H
const PLANE_COL_NADIR_URL    = 9;  // I
const PLANE_COL_NADIR_BOUNDS = 10; // J — nadir image geographic bounds (JSON)
const PLANE_COL_ALPHA_URL    = 11; // K
const PLANE_COL_BRAVO_URL    = 12; // L
const PLANE_COL_CHARLIE_URL  = 13; // M
const PLANE_COL_DELTA_URL    = 14; // N
const PLANE_COL_VIEWER360    = 15; // O
const PLANE_COL_ELEMENTS     = 16; // P — element pins JSON (Pass 1)
const PLANE_COL_REVIEWED     = 17; // Q — Elements Reviewed checkbox (Pass 2 / rerun gate)
const PLANE_COL_FIXES        = 18; // R — Nadir Fixes free text (consumed by rerun)
const PLANE_COL_CONCERNS_P   = 19; // S — concern pins JSON (Pass 2)
const PLANE_COL_ALPHA_DESC   = 20; // T
const PLANE_COL_BRAVO_DESC   = 21; // U
const PLANE_COL_CHARLIE_DESC = 22; // V
const PLANE_COL_DELTA_DESC   = 23; // W
const PLANE_COL_CONSIDER     = 24; // X
const PLANE_COL_CLARIFY      = 25; // Y
const PLANE_COL_FR_LINK      = 26; // Z
const PLANE_COL_V2_STATUS    = 27; // AA
const PLANE_COL_STORYBOARD   = 28; // AB — storyboard {alpha,ent_x,ent_y} JSON (Layer 3)
const PLANE_COL_SITE_NO      = 29; // AC — optional. Satellite site_no so Sync Plane merges onto the site_no hub. Append-only; do not insert.

// Derived plane column groups
const V2_IMG_COLS  = { nadir: PLANE_COL_NADIR_URL, alpha: PLANE_COL_ALPHA_URL,
                       bravo: PLANE_COL_BRAVO_URL, charlie: PLANE_COL_CHARLIE_URL,
                       delta: PLANE_COL_DELTA_URL };
const V2_VIEWER_COL  = PLANE_COL_VIEWER360;
const V2_VIEWER_BASE = 'https://responder-intel.vyanet.com/model-viewer.html?model=';

const ELEMENT_LABELS = ['1','2','3','4','5','6','7','8','9','0'];
const CONCERN_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

// ── Credentials ─────────────────────────────────────────────────────────────

function getCredentials() {
  const props = PropertiesService.getScriptProperties();
  const get = function (key, fallback) {
    const v = props.getProperty(key);
    return v === null || v === undefined ? (fallback || null) : String(v).trim();
  };
  return {
    githubToken: get('GITHUB_TOKEN'),
    mapsKey:     get('MAPS_KEY'),
    awsKeyId:    get('AWS_ACCESS_KEY_ID'),
    awsSecret:   get('AWS_SECRET_ACCESS_KEY'),
    awsRegion:   get('AWS_REGION')       || 'us-east-1',
    kbId:        get('BEDROCK_KB_ID'),
    modelId:     get('BEDROCK_MODEL_ID') || 'us.anthropic.claude-sonnet-4-6',
    hashSalt:    get('HASH_SALT')        || 'vyanet-intel-2026-secure'
  };
}

// ── Account type helpers ─────────────────────────────────────────────────────

// Pass 1 school/standard split reads the RAW sheet cell (column B). Do not
// fold School into this helper's return value — Pass 2 concern filters and
// the published index only understand residential | commercial. School rows
// publish and run Pass 2 as commercial (schools run as commercial accounts;
// school-list pins are catalog-tagged commercial). The Pass 1 emit list is
// chosen by isSchoolAccountType_, not by this function.
function isSchoolAccountType_(val) {
  return String(val || '').trim().toLowerCase() === 'school';
}

// The pin cap for this row's Pass 1 kind. Standard satellite stays 12;
// school rows are 20. Plane / drone-test keep PLANE_MAX_PINS and do not
// call this.
function satMaxPins_(rawAccountType) {
  return isSchoolAccountType_(rawAccountType) ? SAT_MAX_PINS_SCHOOL : SAT_MAX_PINS;
}

function normalizeAccountType(val) {
  const v = String(val || '').trim().toLowerCase();
  if (v === 'school' || v.startsWith('comm')) return 'commercial';
  return 'residential';
}