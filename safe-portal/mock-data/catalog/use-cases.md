# Vyanet camera use cases for SAFE recommended positions

Source data: `catalog.json` (transcribed from `src/*.pdf`; null = not printed on the sheet). Machine rules: `rules.json`.
Helper: `python3 tools/recommend_models.py properties/<slug>/facts.json [--write]` or `--goal G --distance M --power yes|no|unknown`.

Every pick is **inferred** from spec sheets and the aerial imagery, not a site survey. Confirm the mount, power, Wi-Fi signal and distance on site.

## How a pick is made

1. **Goal**: what the position has to do (table below). The goal sets the DORI level needed: Identify (faces), Recognise (vehicle / known person), Observe (activity), Detect (something is there).
2. **Distance** (`distance_m`): measured on the georeferenced close view from the pin to the target, when the imagery allows it. A model whose DORI distance at the needed level is shorter than the target moves down the list. Night range is checked as well.
3. **Power** (`power_available`): with `no`, only models that run without wired power stay (S2). With `unknown` and an outdoor goal, S2 is added as the "if no power" alternate.
4. **PoE**: T1 and F1 are PoE (802.3af) and pair with the **N85 8-ch PoE NVR** (802.3at/af, up to 5MP per channel, so 8 cameras max per unit). The N85 sheet does not give its PoE port count or power budget. Ethernet runs over about 100 m need a switch or extender (that limit comes from the Ethernet standard, not the sheet).

## Goal → models

Models are ranked by **how well they fit the goal**; no model is the default. Coverage width or sweep decides overview, perimeter and frontage goals. Deterrence decides lots, Identify range decides entries, Recognise range decides driveways, and reach along the length decides narrow corridors. **No catalog camera has a 180° view.** The widest fixed outdoor lens is F1 at 94.5° H. E1 is 90.7° H but pans 355°. D1 is 152° H but is a doorbell only.

| Goal (`rules.json` key) | Ranked on | Primary | Alternates | No power | Why (spec numbers) |
|---|---|---|---|---|---|
| Entry door, identify faces (`entry_door_identify`) | Identify range | **E1** | T1, F1, D1 | S2 | E1 has the longest outdoor Identify (6.6 m), auto-tracks and has a 110 dB siren. T1 and F1 reach 6.5 m. D1 works only at a doorbell (3.5 m). |
| Front door with doorbell (`doorbell_visitor`) | Doorbell fit | **D1** | E1, T1 | S2 | D1 runs on existing bell wiring, 152° H, face recognition, Identify 3.5 m. |
| Driveway / gate, vehicle approach (`driveway_vehicle_approach`) | Recognise range | **E1** | T1, F1, V5P | S2 | E1 has Recognise 13.3 m and tracks a vehicle along the drive. T1 13.1 m, F1 13.0 m (with lights + siren). |
| Wide lot / yard / open land (`wide_yard_overview`) | Coverage width / sweep | **E1** | F1, T1, V5P | S2 | E1 sweeps 355°, Observe 26.4 m. F1 is the widest fixed at 94.5° H. T1 and V5P are 91.6° H. |
| **Street frontage / property edge** (`street_frontage_property_edge`) | Coverage width over reach | **E1** | F1, T1 | S2 | Aim along the property edge or into the yard, **not across the road**. E1 sweeps the frontage yard. F1 is the widest fixed view aimed along the edge. |
| Perimeter / long fence line (`perimeter_fence_line`) | Coverage width / sweep | **E1** | F1, T1, V5P | S2 | One E1 can sweep two fence legs. F1 is the widest fixed. With T1, plan one per ~20–25 m. |
| **Narrow side yard / corridor** (`side_yard_corridor`) | Reach along the strip | **T1** | F1, V5P | S2 | Walls on both sides, so a wide or panning view is wasted. T1 has Observe 25.9 m down the strip. F1 adds lights + siren on the blind side. |
| Parking lot deterrence (`parking_lot_deterrence`) | Deterrence | **F1** | E1, V5P, T1 | S2 | F1 has red/blue lights + spotlight + 100 dB siren at 94.5° H. E1 has the loudest siren (110 dB). |
| Motor court, follow arrivals (`motor_court_tracking`) | Tracking | **E1** | F1, T1 | S2 | E1 auto-tracks people and vehicles, Recognise 13.3 m. |
| Remote outbuilding, no power (`remote_outbuilding_no_power`) | No wired power | **S2** | V5P, E1 (only if 12 V is available) | S2 | S2 is the only camera without wired power: battery + 5 W solar, Recognise 11.3 m, 2.4 GHz only. |
| Indoor common area (`indoor_common_area`) | Identify + tracking | **M1** | P1, R5 | n/a | M1: 8MP, 108° H, Identify 7.1 m, radar tracking. |
| Indoor small room (`indoor_small_room`) | Width | **P1** | R5, M1 | n/a | P1: 111.4° H, Identify 5.2 m. |

**Margins are small.** E1 beats T1 and F1 by only 0.1–0.3 m on Identify and Recognise. E1 needs 12 V plus Wi-Fi and is not PoE. T1 and F1 run on one PoE cable to an N85. If an install standardises on PoE and an N85, read the PoE alternate as the practical pick.

## Catalog at a glance

| Model | Type | Power | Night | Identify | Best use |
|---|---|---|---|---|---|
| D1 | 4MP video doorbell (IP65) | AC 8–24 V bell wiring / USB-C 5 V / DC 12–30 V | 5 m | 3.5 m | Front door with doorbell |
| E1 | 5MP outdoor Wi-Fi 6 PT dome, auto-tracking (IP65) | DC 12 V | 20 m (colour) | 6.6 m | Yard overview, motor court tracking |
| F1 | 5MP outdoor PoE, red/blue lights + siren (IP66) | PoE 802.3af / DC 12 V | 20 m (colour) | 6.5 m | Parking lot deterrence |
| M1 | 8MP indoor PT, mmWave radar tracking | USB-C 5 V | 8 m | 7.1 m | Indoor common area |
| P1 | 5MP indoor PT (manual) | USB-C 5 V | 8 m | 5.2 m | Small office / room |
| R5 | 5MP indoor Wi-Fi PT | USB-C 5 V | 8 m | 5.9 m | Indoor alternate |
| S2 | 4MP solar/battery bullet (IP66) | Battery + 5 W solar | 10 m (colour) | 5.6 m | No-power outbuildings / gates |
| T1 | 5MP outdoor PoE turret (IP66) | PoE 802.3af / DC 12 V | 20 m (colour) | 6.5 m | Driveway, entry, perimeter |
| V5P | 5MP outdoor Wi-Fi bullet (IP66) | DC 12 V | 20 m (colour) | not on sheet | Wi-Fi alternate to T1 |
| N85 | 8-ch 5MP PoE NVR | DC 48 V | n/a | n/a | Recorder for T1 / F1 |

## Known spec gaps

- **V5P**: the sheet publishes only Detect (65.3 m). Observe, Recognise and Identify are not printed. It has the same 4 mm F2.1 lens and 91.6° H view as T1, but we don't copy T1's numbers.
- **N85**: PoE port count, PoE power budget and whether an HDD is included are not stated.
- **D1**: the sheet is an image-only PDF, read from a 200 dpi render. It has no siren row (`siren_db` is null). IP65 is printed.
- **P1**: the spec table says 802.11b/g/n, but the features list says 802.11ac and dual-band.
- **R5**: no Ethernet, and the Wi-Fi band isn't stated (b/g/n).
- **F1**: the siren is 100 dB, not 110 dB.
- **E1**: the rating is IP65, not IP66.
- **Prices**: none of the sheets have prices (`price_usd` is null).
