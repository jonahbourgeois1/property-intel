# SAFE portal mock-up package: Gartland + Jones (LOCAL DRAFT, NOT DELIVERED)

Built 2026-10-19 (America/Chicago) by `tools/build_portal_mockup.py` from the current kit files.
Nothing here was uploaded. `deliver.py --live` was not run. No Sheet or GitHub writes.
The JSON files here are for **mocking up the portal**. They are not the delivery format. The only locked delivery format is `report.json` (`safe-report-v1`), and it is included for reference.

## What's in it

```
portal-mockup/
  README.md                this file
  catalog/                 camera catalog shared by both properties
    catalog.json           9 Vyanet cameras + N85 NVR, read off the spec sheets (null where a sheet is silent)
    rules.json             goal -> ranked models (primary + alternates; S2 when there is no power)
    use-cases.md           human-readable goal tables + PoE/margin notes
    spec-sheets/*.pdf      the 10 source spec sheets
  shared/
    inferred-confidence.csv / .pdf / .png   confidence self-assessment for inferred items (both properties)
  gartland/  jones/
    safe.json              ONE portal-friendly file: property, imagery, georef, S/A/F/E items + map features
    cameras.json           existing cameras (Jones: CHEKT roster + survey pins) + recommended cameras with model picks
    report.json            current locked safe-report-v1 (id/images blank until delivery)
    images/
      SAFE-{S,A,F,E}-*.png    full-res panels (2560 px wide); s/a/f/e.jpg = the q90 JPEGs that delivery sends
      <slug>-full.png/pdf      one-page "full report view" (every item, tagged by source; amber = Inferred)
      <slug>-data-only.png/pdf one-page data-only view (no inference)
      <slug>-side-by-side.png  full view (left) vs data-only (right)
      SAFE-onepager-<slug>.png/pdf  marketing one-pager
      stills/cam-NN.jpg        (Jones) the 12 CHEKT roster stills, from the camera-pin-review pack
      jones-pool-evidence.png  (Jones) GE 2024 vs DJI 2026 crop, for known issue #1
```

## How the files relate

- `facts.json` (in the kit, not copied here) is the single source. The panels, `report.json`, the one-page sheets and both JSON files here are all generated from it.
- `safe.json.sections.<L>.items[]` is the same item list as the full-view sheet. Each item's `id` is `<slug>-<L>-<NN>`, and `NN` is its index in that section of `properties/<slug>/data-only/spec-full.json`.
  - That index is also the `item_index` key in `shared/inferred-confidence.csv`.
  - Items appear in this order: knowledge lines first, then `REC:` lines, then (S only) one `MODEL:` line per recommended camera.
- `items[].feature_ids` point into the same section's `map_features[]`. `items[].camera_ids` point into `cameras.json.recommended[].id`, or `existing` means all existing cameras.
- `items[].geometry` is a copy of the referenced features' geometry, so an item can be drawn without a lookup.
- `cameras.json.recommended[]` holds the same pins the S panel draws as dashed amber cones. Each pin's `models` and `spec_snapshot` are built from `catalog/`.

## Field guide (safe.json)

| Field | Meaning |
|---|---|
| `property.site_no` | Mothership Satellite-tab site number. Delivery identity. |
| `property.hubId` | SAFE hub (32 hex) **only if known from records**. Never computed. Gartland: `null`. Jones: `d9f759d7…`, taken from the scan-review training doc and the camera-pins canonical map. Not yet confirmed by a `safe-dest` response, because Jones was never delivered. See `hubId_source`. |
| `property.chekt_hub` | CHEKT / camera-pin hub. This is **not** the SAFE hubId. Jones: `6de88883…`. |
| `property.center` | Property centre lat/lng (the GE survey centre). |
| `imagery.date` / `survey_date` | Date of the Google Earth imagery, and the date we captured it. |
| `georef` | Settings that convert close-capture pixels to lat/lng (formula included). |
| `sections.<L>.status` | One-line headline that the panel header shows. |
| `items[].kind` | `data`: built only on a data source. `inferred`: a judgement made from imagery or data. `recommendation`: a `REC:` or `MODEL:` line (`subkind: model_pick`). |
| `items[].sources[]` | Where it comes from: `chekt`, `survey_gps`, `city_hydrant_gis`, `geocode`, `imagery`, `ge_ruler`, `mothership_sheet`. `inferred: true` is set when any part of the item is a judgement. |
| `items[].confidence` | `{level, band_pct, basis, failure_risk}` from `shared/inferred-confidence.csv`. **This is a self-assessment, not measured accuracy.** It is `null` for data items and for camera recommendations / model picks, which weren't rated; `confidence_note` says which. |
| `items[].confirm_by` | What would confirm the item (site visit, fire district, owner, taxlot, Nearmap…). |
| `map_features[]` | Every shape and callout drawn on that panel: `kind` (polygon, line, route, arrow, rect_m, circle, ring, x, callout, buffer, ruler, hydrant), `geometry` (`Point`/`LineString`/`Polygon` with `coordinates_latlng` as **[lat, lng]**, not GeoJSON order), `coord_source`, the original `style`, and `text` for callouts. |
| `map_features[].coord_source` | `latlng`: authored in lat/lng (GE survey clicks or GIS). `derived_from_px`: authored as pixels on the 02 close capture and converted with `georef` (≈ ±1–3 m; the original pixels are in `authored`). `none (label box only)`: a text box with no ground anchor. |
| `kind: buffer` | The geometry is the house outline. Draw a `radius_m` buffer around it for Zone 1 (9.1 m / 30 ft) and Zone 2 (30.5 m / 100 ft). |
| `kind: rect_m` | A true-size rectangle (ambulance, engine spot, staging). Corners are computed from centre, `size_m` and angle. |
| circle / ring `style.r` | Marker radius in panel pixels, **not metres**. |

## Field guide (cameras.json)

- `existing.chekt_roster[]` (Jones): `pack_id`, `chekt_name`, `device_id`, `status`, `still`, `linked`, `survey_pin_id`.
- `existing.survey_pins[]` (Jones):
  - `lat`/`lng` from the technician's GPS.
  - `heading_deg` is a surveyed true heading.
  - `fov_deg` is a default for the camera type, not surveyed.
  - `linked` / `chekt_name` say whether the pin is matched to a roster camera.
  - `cone_drawn_m` is the length drawn on the map, not a range.
- `recommended[]`:
  - Position: `lat`/`lng` + `coord_source`. Gartland is `latlng`. Jones is `derived_from_px`, with the source pixels in `authored`.
  - Aim and reach: `heading_deg`, `fov_deg`, `distance_m` (pin to target, from the georef, approx) + `distance_source`.
  - Power: `power_available` (all `unknown`) + `power_note`. `aim_note` is set on Gartland R4.
  - Model pick: `models{primary, alternates, why}`.
  - `warnings[]`: range checks (night range or a DORI level shorter than the target distance, or a missing DORI value).
  - `spec_snapshot` per model: resolution, lens, FOV, pan/tilt, auto-tracking, power, connectivity, night, DORI, IP rating, `price_usd` (null), and the spec-sheet path.
- `nvr_for_poe_picks`: the N85 8-channel PoE NVR pairs with the T1 and F1 (PoE) picks. Its PoE port count and budget aren't on the sheet.

## Known issues (not fixed; Jonah said not yet)

1. **Jones has a pool.** The DJI 3D model "Tracy Residence 7-21-26" shows a lap pool on the **E/NE** side, beside the pergola patio. In GE 6/22/2024 the same footprint is a tan strip, probably a covered pool. The following still say "no pool":
   - F know item 2 and the F status line
   - `data-only` "no pool visible"
   - the F panel
   - the one-pager, which says "pool (reported): likely N courtyard", so the location is wrong too

   The pool is a possible drafting source; the fire district should confirm. Evidence: `jones/images/jones-pool-evidence.png`.
2. **Jones roof.** The DJI 2026 model shows a dark rectangular panel on the main roof (solar or a skylight). E item 0 ("no … solar"), the E panel and the F roof callout are based on 2024 imagery and are probably out of date.
3. **Jones old R2 and "10 unassociated" wording.**
   - facts.json R2 is the old NW track / open-land spot (wide yard, E1). The one-pager's R2 is a different spot: drive approach to the motor court.
   - S rec item 4 says "associate the 10 online-but-unassociated cameras".
   - Both are kept as they are.
4. **Jones camera counts don't reconcile.**
   - 12 CHEKT roster cameras in the pack, all `online`.
   - 14 technician survey pins.
   - Only 4 pins are linked by name to a roster camera.
   - Jonah reports all 14 work. Unresolved: both lists are kept as-is, and nothing is merged or dropped.
5. **Gartland R4's cone points across the road.** It's aimed at the collector, not the property-side frontage. Re-aiming needs approval (`aim_note`).
6. **Gartland spot count.** facts, panels and `report.json` have 5 recommended spots (R1–R5). The marketing one-pager shows 4 (R1–R4); R5 (S side yard) is left off via a footnote.
7. **V5P DORI.** Its spec sheet publishes Detect only. Observe, Recognise and Identify are null, so range checks for V5P are incomplete.
8. **No prices.** `price_usd` is null for every model.
9. **Rankings are provisional.**
   - E1 wins most outdoor goals by only 0.1–0.3 m of DORI.
   - E1 needs 12 V + Wi-Fi; it isn't PoE.
   - A tie-breaker (PoE preference, price, mount) is pending.
   - Power is `unknown` at every spot, so S2 (no power) is always listed as an alternate.
10. **Imagery age.** All site observations come from GE 6/22/2024. Gartland's subdivision was still being built then, so the E/NE tract and W/SW construction items may be out of date.
11. **No taxlot or parcel outline** was retrieved for either property. Parcel-edge claims are imagery-based.
12. **Confidence bands** are self-assessed, not measured, and camera recommendations / model picks aren't rated.

## Coordinates: real vs pixel

| | Gartland | Jones |
|---|---|---|
| Shapes / callouts / named geometry | `latlng` (authored in lat/lng) | `derived_from_px` (authored on the 02 close capture; converted, ≈ ±1–3 m) |
| Recommended cameras | `latlng` | `derived_from_px` |
| Existing cameras | none | survey pins `latlng` (technician GPS) |
| Hydrants | `latlng` (City of Bend GIS, approx) | none within 800 m |
| Ruler lines | endpoints `latlng`; value = GE ruler readout | ruler values are in the text only (no line features in facts) |
| Label boxes (`label_box`, `tag_box`) | panel base px (layout only) | panel base px (layout only) |
