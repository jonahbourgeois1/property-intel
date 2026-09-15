# Next session (2026-09-16) — build the intake groundwork

Read this first, then `PLANNED_MAP.md` (design rules R1–R8, N01–N05, N09, N11), then `DATA_MAP.md` §1b + findings F1–F14. Both render at `docs/audit/DATA_MAP.html` and `PLANNED_MAP.html` (Pages). Rebuild either with `python docs/audit/build_html.py [DATA_MAP.md|PLANNED_MAP.md]`; the builder prints table↔edge reconciliation and refuses nothing silently. Redact before publishing the current map (`%TEMP%\pi-audit\redact.py`; the identifiers are listed at the top of `DATA_MAP.md`).

## Goal for the day, in order

1. **Intake** — clear definitions of where each input comes from and how the sheet learns about it (N01–N05).
2. **Centralize the sheet** — from 13 tabs / 17 `.gs` files to a few tabs and one registry module (N05, R1).
3. **Publish back to S3 + the GitHub viewer** — the record schema, the S3 layout, the one writer, and the one HTML page that reads it (N09, N11, R2, R3, R7).

Do not start 2 before 1 is written down; do not start 3 before the `Properties` column list is frozen.

## Phase 1 — Intake definitions

**Decision that shapes everything else: where is the truth — the sheet or S3?**
Recommendation (R1/R2): S3 `reference/properties.json` is the truth; the sheet is an operator *view* of it. CLIs and Lambdas write S3; one Apps Script function `refreshRegistry()` pulls the JSON into the `Properties` tab (and `intake` pushes new rows through the intake Lambda). Today every tab is its own truth, hence F1/F2/F10.

Per source, write down these five things (a table in `PLANNED_MAP.md` under N01–N04 is the deliverable):

| Source | Who triggers | Lands where (S3) | Identity key | How the sheet learns |
|---|---|---|---|---|
| Nearmap export (N01) | operator CLI per `site_no` | `properties/{hub}/nearmap/{delivery}/` | `site_no` → `hub` | CLI `register` writes `reference/properties.json[hub].nearmap`; sheet refresh |
| Vyanet capture (N02, optional) | operator CLI per capture | `captures/{id}/` + `reference/captures.json` (with `type`, `parcels_ref` set by the CLI) | capture id; joined to properties by taxlot | same |
| Technician photos (N03) | technician via intake page | `property-intel-ingest/photos/{hub}/raw` → `properties/{hub}/cameras/` | `hub` in the intake URL | `photo-normalize` Lambda writes the flag |
| GIS parcels (N04) | operator CLI per county | `reference/parcels/{county}/` | county + taxlot | not a per-property row; intake Lambda resolves taxlot at row creation |

Facts to reuse (already true today):
- `site_no` is already the satellite id key **and** CHEKT's `account_reference_id` (P23 S03) — it is the right primary key. Plane / drone-test rows resolve a hub only when a Satellite row with the same `site_no` exists (`indexHubId_`, F10); rows without one will need a `site_no` assigned during migration.
- The eligibility Lambda already does geocode + taxlot + coverage (P04) and reads everything via CloudFront — the intake Lambda is a thin wrapper around `eligibility_check.find_parcel`, not new code.
- Nearmap registry import already exists (`importNearmapRegistry`, P19 S08) — the pattern (Lambda/CLI writes S3 JSON → sheet pulls) is proven.
- Photo intake transport is the unsolved piece (P24). Presigned POST from a Pages page to `property-intel-ingest` is the fallback the decision memo already names; raw photos must never reach the served bucket (invariant 10); orientation + heading rules (invariants 8–9).

## Phase 2 — Centralize the sheet

Today: tabs `Satellite`, `Plane`, `Drone`, `Interior`, `drone-test`, `Nearmap`, `Golf`, `Golf Pins`, `responder-directions`, `Intel Links`, `element-critique`, `Satellite Sandbox`, `Element Critique Sandbox` (13) and 17 `.gs` files (`apps scripts/`).

Target: `Properties` (registry view, one row per property), `Review Log` (append-only history, replaces `element-critique` + sandbox log; optional if history moves into `pins.json`), `Config` (script properties that are not secrets). Golf stays out (separate product, Q3).

Steps:
1. **Column crosswalk** — one table: every column of the five property tabs (Satellite A–T incl. `site_no`; Plane A–AC; drone-test A–AJ; Drone `RI_C`; Nearmap A–AC) → its `Properties` column, or *drop*, or *moves to S3 JSON*. Column maps are in `config.gs` (`SAT_COL_*`, `PLANE_COL_*`, `DT_COL_*`, `NM_COL_*`) and `responder intel.gs` (`RI_C`). Everything AI-generated (pins, concerns, descriptions) moves to `properties/{hub}/review/*.json`; the sheet keeps identity, source flags, review flags, links, dates.
2. **Function triage** — from the 17 files keep: `shared.gs` helpers (SigV4, `geocodeAddress`, `callBedrock`, `queryKnowledgeBase`, `hashId`, `slugify`), `config.gs` (trimmed), `menu.gs` (rewritten). New: `registry.gs` (`intake`, `refreshRegistry`, `publish`, `links`). Retire: per-tab pipelines (`satellite.gs`, `plane.gs`, `drone-test.gs`, `drone interior.gs`, `nearmap.gs` pass code), `records.gs` (mothership), `critique-api.gs` (web app), `golf.gs`, `responder-directions.gs`, one-shots. Keep the exported copies as reference.
3. **One-shot migration** — build `Properties` from the existing tabs keyed by `site_no`; report rows that cannot be keyed (plane / drone rows with no Satellite match) for hand assignment. Dry-run first, like `satellite migration v2.gs` did.
4. **Triggers** — none of the 1-min pollers or 5-min auto-runs survive; the only recurring job is `refreshRegistry` (5 min) if the sheet is a view. Remember: save **and** create a new deployment version (invariant 17).

## Phase 3 — Publish to S3 and the GitHub viewer

1. **`property.json` schema** — draft it as a table (block → fields → producer): `identity` (N05), `sources` (flags + ids), `nearmap` (manifest URLs), `capture` (optional refs, GLB), `parcel` (ring, taxlot, county), `regions`, `pins`, `descriptions` (FR/WF), `cameras`, `hoa`. Producer of the file: the `publish` Lambda only (R3). Keys under `properties/{hub}/`; `property.json` is a stable key → invalidate after every write (invariant 5); everything under `review/` is `no-cache`.
2. **Viewer** — `property-viewer.html` on Pages reads `https://<tiles CloudFront>/properties/{hub}/property.json` and media by the URLs inside it. The tiles CloudFront already serves GLBs and renders to browsers, so CORS is in place for GETs; confirm for JSON. GitHub carries **code only** — no `data/` writes (retires P15–P18, fixes F1).
3. **Bridge** — until every source is migrated, `publish` may read today's records (`property-intel-records` or Pages `data/`) to assemble `property.json`, so the new viewer works for existing properties on day one (Q5 migration order).

## Invariants that still bind (from CLAUDE.md)

Never CloudFront HEAD for existence (S3 `head_object`); invalidate after every stable-key write; `parcels_ref` on every capture entry; photo heading per `GPSImgDirectionRef`, orientation resolved to 1; raw photos never in the served bucket; Apps Script save + new deployment; `config.js` is Action-generated. The v1 repo is public — keep identifiers out of anything under `docs/`.

## Prep before opening the chat (5 minutes)

- `gh auth login` — lets the agent check Pages / the v2 repo / Actions.
- An AWS session (`aws sts get-caller-identity`) — lets the agent read `reference/captures.json`, list `properties/`, check CloudFront CORS. Without it, everything S3-side stays `[UNVERIFIED]` as it did today.
- Decide Q1 (sheet stays as console: yes/no) and Q2 (Nearmap licence covers served derivatives: yes/no/unknown) — both change Phase 1.
- Have the current `.gs` exports in `apps scripts/` up to date with the editor (they were exported 2026-09-14).

## Suggested opening prompt

> Read `docs/audit/NEXT_SESSION_2026-09-16.md`, then `docs/audit/PLANNED_MAP.md`, then `docs/audit/DATA_MAP.md` §1b and the F1–F14 findings. Today is Phase 1: produce the intake definitions table (five columns, four sources) and the `Properties` column crosswalk. Ask me Q1 and Q2 before drafting. Keep every fact cited to a file or marked as a design decision. Do not write code until both tables are approved.
