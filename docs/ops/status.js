window.PI_STATUS = {
  "as_of": "2026-08-31",
  "as_of_utc": "2026-08-31T00:04:39Z",
  "repo": "jonahbourgeois1/property-intel",
  "ref": "origin/main",
  "head": {
    "sha": "53346bd43e8865eb2971cded9780b2544d4f793f",
    "short": "53346bd",
    "message": "Bump hub to 1.8.12 so the Community iframe drops its cached v2.3.4 hoa-viewer.",
    "author_date": "2026-08-28T21:22:27Z"
  },
  "sources": {
    "git_log_since": "2026-08-30",
    "iso_week": "2026-W36",
    "changelog": null,
    "context": null,
    "property_intel_v2": "404 from this token; OneDrive v2 docs/ops not mounted",
    "note": "index.html embeds this snapshot so a stale sibling status.js without ## 2026-08-31 cannot hide today"
  },
  "weekly": {
    "label": "2026-W36",
    "start": "2026-08-31",
    "end": "2026-09-06",
    "shipped": [],
    "still_open": [
      {
        "item": "Chat direction not visible to Log Bot",
        "evidence": "list-cloud-agents returned this cron (bc-f631c354), 8/30 bc-eb481f27, 8/29 bc-8dc1a78f, 8/28 bc-ede78703, 8/27 bc-d4995744, 8/26 bc-45e4c56a, plus internal Summarize yesterday log bot; desktop/web/local sources returned 0"
      },
      {
        "item": "Daily log PRs #1, #3, #4, #5, and #6 still DRAFT; docs/ops/ not on main",
        "evidence": "gh pr list: #1 cursor/property-intel-daily-log-4f45 DRAFT; #3 cursor/property-intel-daily-log-299e DRAFT; #4 cursor/property-intel-daily-log-0704 DRAFT; #5 cursor/property-intel-daily-log-3f6c DRAFT; #6 cursor/property-intel-daily-log-866d DRAFT; origin/main has no docs/ops"
      }
    ],
    "watchouts": [
      "Apps Script editor-save is not a new deployment; .gs copies in git are not a deploy. No .gs copies and no satellite.gs deploy evidence on 2026-08-31; MOCKINGBIRD row 277 is the first check after a real deploy.",
      "Public data/*.json is sync-owned. No sync commits on origin/main since 53346bd (2026-08-28T21:22:27Z).",
      "pins-catalog.json still has role= on every pin after the 256-pin update (195 primary, 61 concern); do not flatten it."
    ],
    "completion_percent": null,
    "pipelines": [
      {
        "id": "viewers",
        "name": "Responder viewers (v1 Pages)",
        "status": "on main",
        "evidence": "origin/main 53346bd; HUB_BUILD 1.8.12; element-review BUILD v6.8.10"
      },
      {
        "id": "sync",
        "name": "Apps Script → GitHub data sync",
        "status": "last sync 2026-08-28",
        "evidence": "187a608 Sync Drone; six Publish Responder Intel ee91147..47def97. Editor-save is not a deploy."
      },
      {
        "id": "satellite",
        "name": "Satellite Pass 1 / review / Pass 2",
        "status": "viewers on main; deploy unverified",
        "evidence": "element-review.html on HEAD. satellite.gs copies in git are not a deploy. No satellite.gs deploy evidence 2026-08-29..31."
      },
      {
        "id": "plane",
        "name": "Plane capture (ingest → eligibility → clip → render)",
        "status": "not in this clone",
        "evidence": "property-intel-v2 404 from this token. CHANGELOG and CONTEXT absent."
      },
      {
        "id": "live",
        "name": "Live CHEKT",
        "status": "on main",
        "evidence": "live-viewer.html and hub 1.8.12 on origin/main."
      },
      {
        "id": "photo",
        "name": "Photo intake",
        "status": "not in this clone",
        "evidence": "no photo-intake source in this v1 checkout."
      }
    ],
    "in_progress": [
      {
        "item": "Daily ops page (docs/ops/) still off main",
        "evidence": "Draft PRs #1, #3, #4, #5, #6. origin/main has no docs/ops."
      },
      {
        "item": "Log Bot cannot see desktop/web/local chats",
        "evidence": "list-cloud-agents desktop/web/local sources returned 0 in this environment."
      },
      {
        "item": "v2 pipeline tree not mounted for Log Bot",
        "evidence": "property-intel-v2 404; OneDrive Desktop/property-intel-v2/docs/ops not writable from this VM."
      }
    ]
  },
  "days": [
    "2026-08-31",
    "2026-08-30",
    "2026-08-29",
    "2026-08-28",
    "2026-08-27",
    "2026-08-26",
    "2026-08-25"
  ],
  "shipped_today": [],
  "shipped_this_week": [],
  "still_open": [
    {
      "item": "Chat direction not visible to Log Bot",
      "evidence": "list-cloud-agents returned this cron (bc-f631c354), 8/30 bc-eb481f27, 8/29 bc-8dc1a78f, 8/28 bc-ede78703, 8/27 bc-d4995744, 8/26 bc-45e4c56a, plus internal Summarize yesterday log bot; desktop/web/local sources returned 0"
    },
    {
      "item": "Daily log PRs #1, #3, #4, #5, and #6 still DRAFT; docs/ops/ not on main",
      "evidence": "gh pr list: #1 cursor/property-intel-daily-log-4f45 DRAFT; #3 cursor/property-intel-daily-log-299e DRAFT; #4 cursor/property-intel-daily-log-0704 DRAFT; #5 cursor/property-intel-daily-log-3f6c DRAFT; #6 cursor/property-intel-daily-log-866d DRAFT; origin/main has no docs/ops"
    }
  ],
  "open": [
    {
      "item": "Chat direction not visible to Log Bot",
      "evidence": "list-cloud-agents returned this cron (bc-f631c354), 8/30 bc-eb481f27, 8/29 bc-8dc1a78f, 8/28 bc-ede78703, 8/27 bc-d4995744, 8/26 bc-45e4c56a, plus internal Summarize yesterday log bot; desktop/web/local sources returned 0"
    },
    {
      "item": "Daily log PRs #1, #3, #4, #5, and #6 still DRAFT; docs/ops/ not on main",
      "evidence": "gh pr list: #1 cursor/property-intel-daily-log-4f45 DRAFT; #3 cursor/property-intel-daily-log-299e DRAFT; #4 cursor/property-intel-daily-log-0704 DRAFT; #5 cursor/property-intel-daily-log-3f6c DRAFT; #6 cursor/property-intel-daily-log-866d DRAFT; origin/main has no docs/ops"
    }
  ],
  "watchouts": [
    "Apps Script editor-save is not a new deployment; .gs copies in git are not a deploy. No .gs copies and no satellite.gs deploy evidence on 2026-08-31; MOCKINGBIRD row 277 is the first check after a real deploy.",
    "Public data/*.json is sync-owned. No sync commits on origin/main since 53346bd (2026-08-28T21:22:27Z).",
    "pins-catalog.json still has role= on every pin after the 256-pin update (195 primary, 61 concern); do not flatten it."
  ],
  "week_label": "2026-W36",
  "completion_percent": null,
  "percent": null,
  "completion_percent_reason": "not reported; no measured evidence",
  "log_markdown": "# Property Intel daily log\n\nEvidence-only. Newest day at the top. This cloud checkout is public `jonahbourgeois1/property-intel` (v1). Completeness % omitted unless measured. Do not flatten catalog `role=`. Editor-save ≠ deploy. `data/*.json` is sync-owned. MOCKINGBIRD row 277 after a real `satellite.gs` deploy.\n\n## 2026-08-31\n\nNothing shipped today on `origin/main`. Head remains `53346bd` (2026-08-28 16:22 -0500).\n\nLog Bot cron `41611cd5-a0bb-11f1-b532-320a589b8025` at 2026-08-31T00:04:39Z (`bc-f631c354`). Yesterday's 00:23 UTC log already recorded that `origin/main` was still `53346bd`. No author-date 2026-08-29, 2026-08-30, or 2026-08-31 commits on `origin/main`. The only git event after that log is `7a40c02` `ops: daily log 2026-08-30` on draft PR **#5** (`cursor/property-intel-daily-log-3f6c`) — not on `main`. Template still says v2/master; this clone is public v1. CHANGELOG/CONTEXT and `property-intel-v2` are not in this clone (`property-intel-v2` 404). `list-cloud-agents` listed only Log Bot runs (this cron, 8/30 `bc-eb481f27`, 8/29 `bc-8dc1a78f`, 8/28 `bc-ede78703`, 8/27 `bc-d4995744`, 8/26 `bc-45e4c56a`) plus internal \"Summarize yesterday log bot\". Desktop/web/local sources returned 0.\n\n### Shipped\nNone on 2026-08-31.\n\n### Still open\n- Chat direction still not visible in the Log Bot environment (`list-cloud-agents` returned only Log Bot automations + one internal summarizer).\n- Daily log PRs **#1** (`ops: daily log 2026-08-27`), **#3** (`ops: daily log 2026-08-28`), **#4** (`ops: daily log 2026-08-29`), and **#5** (`ops: daily log 2026-08-30`) are still DRAFT; `docs/ops/` is not on `main`.\n\n### Watchouts\n- Apps Script editor-save is not a new deployment. No `.gs` copies and no `satellite.gs` deploy evidence today; MOCKINGBIRD row 277 is the first check after a real deploy.\n- Public `data/*.json` is sync-owned. No sync commits on `main` since yesterday's log.\n- Catalog `role=` still present on all 256 pins after `06c9714` (195 primary, 61 concern); do not flatten it.\n\n## 2026-08-30\n\nNothing shipped today on `origin/main`. Head remains `53346bd` (2026-08-28 16:22 -0500).\n\nLog Bot cron `41611cd5-a0bb-11f1-b532-320a589b8025` at 2026-08-30T00:20:58Z (`bc-eb481f27`). Yesterday's 00:16 UTC log already recorded the 8/28 afternoon work through `53346bd`. No author-date 2026-08-29 or 2026-08-30 commits on `origin/main`. The only git event after that log is `44da289` `ops: daily log 2026-08-29` on draft PR **#4** (`cursor/property-intel-daily-log-0704`) — not on `main`. Template still says v2/master; this clone is public v1. CHANGELOG/CONTEXT and `property-intel-v2` are not in this clone (`property-intel-v2` 404). `list-cloud-agents` listed only Log Bot runs (this cron, 8/29 `bc-8dc1a78f`, 8/28 `bc-ede78703`, 8/27 `bc-d4995744`, 8/26 `bc-45e4c56a`) plus internal \"Summarize yesterday log bot\". Desktop/web/local sources returned 0.\n\n### Shipped\nNone on 2026-08-30.\n\n### Still open\n- Chat direction still not visible in the Log Bot environment (`list-cloud-agents` returned only Log Bot automations + one internal summarizer).\n- Daily log PRs **#1** (`ops: daily log 2026-08-27`), **#3** (`ops: daily log 2026-08-28`), and **#4** (`ops: daily log 2026-08-29`) are still DRAFT; `docs/ops/` is not on `main`.\n\n### Watchouts\n- Apps Script editor-save is not a new deployment. No `.gs` copies and no `satellite.gs` deploy evidence today; MOCKINGBIRD row 277 is the first check after a real deploy.\n- Public `data/*.json` is sync-owned. No sync commits on `main` since yesterday's log.\n- Catalog `role=` still present on all 256 pins after `06c9714` (195 primary, 61 concern); do not flatten it.\n\n## 2026-08-29\n\nLog Bot cron `41611cd5-a0bb-11f1-b532-320a589b8025` at 2026-08-29T00:16:28Z (`bc-8dc1a78f`). Head of `origin/main` is `53346bd` (2026-08-28 16:22 -0500). Yesterday's 00:13 UTC log stopped at `606537c` and had no author-date 2026-08-28 commits; everything below is 2026-08-28 09:00–16:22 -0500. Template still says v2/master; this clone is public v1. CHANGELOG/CONTEXT and `property-intel-v2` are not in this clone (`property-intel-v2` 404). `list-cloud-agents` listed only Log Bot runs (this cron, 8/28 `bc-ede78703`, 8/27 `bc-d4995744`) plus internal \"Summarize yesterday log bot\".\n\n### Shipped\n- `53346bd` Hub **1.8.12**: Community iframe cache-bust so it drops the cached v2.3.4 `hoa-viewer`. `js/vyanet-viewer/property.js` `HUB_BUILD = '1.8.12'`.\n- `e3952cf` Community no longer fetches the deleted monolithic `data/index.json` (that 404 blanked the map). `hoa-viewer.html` loads each HOA member from `data/index/{id}.json` with satellite fallback.\n- `260c239` Match 2D camera pins to 3D: same popup, live LEDs, and 72-hour clip dots. Same commit set hub **1.8.11**, copied `apps scripts/shared.gs` (**file copy, not a deploy**), and deleted the duplicate Eugene cameras file `data/cameras/json/8eea64e5…` so HEAD has **2** camera json files.\n- `b44575a` Reviewers can pin outside the nadir crop (percentages may be <0 or >100) and open Google Earth from Element Review. `element-review.html` BUILD **v6.8.10**. Same commit copied `apps scripts/satellite.gs`, `plane.gs`, `drone-test.gs`, `critique-api.gs`, `shared.gs` — **file copies, not an Apps Script deployment**.\n- `cfde3ab` (merged `e4863fb`) Stop Lane road leftovers from painting as the property line (`nadir-geo.js` prefers `MAPTAXLOT` then `TAXLOT`).\n- Apps Script–style syncs on 8/28 (sync-owned `data/`): six `Publish Responder Intel — 1 property` (`ee91147` … `47def97`) and `187a608` Sync Drone (six `data/drone/{id}.json` plus index hubs).\n\nNot on HEAD: `100b135` added an on-page ER oblique pane (BUILD v6.8.11) and `0cf943b` reverted it the same afternoon; BUILD remains **v6.8.10**.\n\n### Still open\n- Chat direction still not visible in the Log Bot environment (`list-cloud-agents` returned only Log Bot automations + one internal summarizer).\n- Daily log PRs **#1** (`ops: daily log 2026-08-27`) and **#3** (`ops: daily log 2026-08-28`) are still DRAFT; `docs/ops/` is not on `main`.\n\n### Watchouts\n- Apps Script editor-save is not a new deployment. `.gs` copies in git (`satellite.gs` in `b44575a`, `shared.gs` in `b44575a` and `260c239`) are not a deploy. No `satellite.gs` deploy evidence today; MOCKINGBIRD row 277 is the first check after a real deploy.\n- Public `data/*.json` is sync-owned (six responder-intel publishes + Sync Drone + camera json delete/edit in `260c239`; next sync can overwrite).\n- Catalog `role=` still present on all 256 pins after `06c9714` (195 primary, 61 concern); do not flatten it.\n\n## 2026-08-28\n\nLog Bot cron `41611cd5-a0bb-11f1-b532-320a589b8025` at 2026-08-28T00:13:41Z. No commits with author date 2026-08-28. Head of `origin/main` is `606537c` (2026-08-27 16:53 -0500). Everything below landed after yesterday's 00:03 UTC log (author dates 2026-08-27 11:18–16:53 -0500). CHANGELOG/CONTEXT and `property-intel-v2` are not in this clone (`property-intel-v2` 404). `list-cloud-agents` listed only Log Bot runs (this cron, 8/27, 8/26) plus internal \"Summarize yesterday log bot\".\n\n### Shipped\n- `5c79788` merge of PR **#2** (`cursor/vyanet-viewer-gate-home`). Hub 1.6.4 lineage is on `main`. That branch has no commits not already on `main`.\n- `df985c1` Hub **1.7.3**: Eugene cameras on the live hub; four CHEKT feeds joined to stills. `js/vyanet-viewer/property.js` `HUB_BUILD = '1.7.3'`.\n- `9a754fb` Hub **1.7.2**: Eugene cameras, FR 3D pins, CHEKT live by address. Also copied `apps scripts/critique-api.gs`, `drone-test.gs`, `plane.gs`, `prompts.gs`, `shared.gs` — **file copies, not an Apps Script deployment**.\n- `6e693f0` + `11c0394`: Vyanet Eugene camera stills under `data/cameras/images/{id}/`; metadata settled at `data/cameras/json/{id}.json` (3 json files on HEAD).\n- `a302173` Redraw element-review pins immediately after rerun. `element-review.html` BUILD **v6.8.8**.\n- `9442d72` Drone-test element review georeferences CloudFront nadirs and identifies the row by taxlot.\n- `91556e6` Lane County lot-line tiles (`data/parcels/lane_*.geojson`, 332 files) and both-county grids in viewers.\n- `1f02d1b` Stop drawing the element-review pin-range box; allow reviewer duplicate pins; school cap **20** (`SCHOOL_PIN_LIMIT = 20`; `SAT_MAX_PINS` stays 12 in the `satellite.gs` copy). Same commit copied `apps scripts/satellite.gs` — **not a deploy**.\n- Apps Script–style syncs on 8/27 (sync-owned `data/`): six `Sync drone-test` (`e614910` … `0ef3f6f`) and `0b51828` Sync Row — Vyanet Eugene.\n\n### Still open\n- Chat direction still not visible in the Log Bot environment (`list-cloud-agents` returned only Log Bot automations + one internal summarizer).\n- Daily log PR **#1** (`ops: daily log 2026-08-27`, `cursor/property-intel-daily-log-4f45`) is still DRAFT; `docs/ops/` is not on `main`.\n\n### Watchouts\n- Apps Script editor-save is not a new deployment. `.gs` copies in git (`satellite.gs` in `1f02d1b`, plus `9a754fb`) are not a deploy. No `satellite.gs` deploy evidence today; MOCKINGBIRD row 277 is the first check after a real deploy.\n- Public `data/*.json` is sync-owned (drone-test + Eugene row + camera JSON landed via git; next sync can overwrite).\n- Catalog `role=` still present on all 256 pins after `06c9714` (195 primary, 61 concern); do not flatten it.\n\n## 2026-08-27\n\nNothing shipped today on `origin/main`. Head remains `06c9714` (2026-08-26 16:31 -0500).\n\nLog Bot cron `41611cd5-a0bb-11f1-b532-320a589b8025` at 2026-08-27T00:03:07Z, then follow-ups to wire the `file://` weekly page. v2 / OneDrive `docs/ops` is not mounted on this VM (`property-intel-v2` 404). `list-cloud-agents` listed only Log Bot runs. CHANGELOG/CONTEXT not in this clone.\n\n### Shipped\nNone on 2026-08-27.\n\n### Still open\n- Vyanet Viewer hub **1.6.4** on `origin/cursor/vyanet-viewer-gate-home` (`161a860`) not merged; `main` hub **1.0.3**.\n- Chat direction not visible in the Log Bot environment.\n\n### Watchouts\n- Apps Script editor-save is not a new deployment. `.gs` copies in git are not a deploy. No `satellite.gs` deploy evidence today.\n- Public `data/*.json` is sync-owned.\n- Catalog `role=` still present on all 256 pins after `06c9714`; do not flatten it.\n\n## 2026-08-26\n\nFirst write of this day into this `log.md` (8/26 Log Bot run `bc-45e4c56a` did not commit `docs/ops/`).\n\n### Shipped\n- `06c9714` \"Update pins-catalog.json\". Catalog `version` `2026-07-15` → `2026-08-26`; `pin_count` 239 → 256. Notes: pins 240–256 appended; `#30` Entry → Vehicle Entrance; `account_type` widened on `#30` / `#33` / `#127`. All 256 pins still have `role` (195 primary, 61 concern). Actions `33015751649` and Pages `33015750965` succeeded.\n- Last Apps Script–style property sync remains `86e00ef` (2026-08-24 drone-test). No satellite/plane/responder-intel `data/` sync this day.\n\n### Still open\n- `161a860` \"Ship Vyanet Viewer hub through 1.6.4: live tab, dashboard, and 3D cameras\" on `cursor/vyanet-viewer-gate-home`, not on `main`.\n- No GitHub pull requests listed on this repo.\n\n### Watchouts\nStanding rules above. No `satellite.gs` deploy evidence.\n\n## 2026-08-25\n\nReconstructed from v1 git (this VM cannot read the original OneDrive 8/25 block). If your local `log.md` already has a fuller 8/25 section, keep that block and leave this one as the git evidence.\n\n### Shipped\n- `8662883` \"Identify element-review critiques by site_no instead of address.\" `element-review.html` BUILD **v6.8.2**. Duplicate lots were rejected as ambiguous when the review link only carried addr; links now include `site_no`. Same commit added `apps scripts/*.gs` copies to the public repo — **file copy, not an Apps Script deployment**.\n- `fb9a0f2` merge of `main`.\n\n### Still open (that day)\n- `d32bb4a` \"Add gate and home shell to the Vyanet Viewer hub (1.1.1)\" on `cursor/vyanet-viewer-gate-home`, not merged to `main` (later advanced to 1.6.4 on 8/26).\n\n### Watchouts\n`.gs` in git ≠ deployed. `data/*.json` is sync-owned.\n",
  "pipelines": [
    {
      "id": "viewers",
      "name": "Responder viewers (v1 Pages)",
      "status": "on main",
      "evidence": "origin/main 53346bd; HUB_BUILD 1.8.12; element-review BUILD v6.8.10"
    },
    {
      "id": "sync",
      "name": "Apps Script → GitHub data sync",
      "status": "last sync 2026-08-28",
      "evidence": "187a608 Sync Drone; six Publish Responder Intel ee91147..47def97. Editor-save is not a deploy."
    },
    {
      "id": "satellite",
      "name": "Satellite Pass 1 / review / Pass 2",
      "status": "viewers on main; deploy unverified",
      "evidence": "element-review.html on HEAD. satellite.gs copies in git are not a deploy. No satellite.gs deploy evidence 2026-08-29..31."
    },
    {
      "id": "plane",
      "name": "Plane capture (ingest → eligibility → clip → render)",
      "status": "not in this clone",
      "evidence": "property-intel-v2 404 from this token. CHANGELOG and CONTEXT absent."
    },
    {
      "id": "live",
      "name": "Live CHEKT",
      "status": "on main",
      "evidence": "live-viewer.html and hub 1.8.12 on origin/main."
    },
    {
      "id": "photo",
      "name": "Photo intake",
      "status": "not in this clone",
      "evidence": "no photo-intake source in this v1 checkout."
    }
  ],
  "in_progress": [
    {
      "item": "Daily ops page (docs/ops/) still off main",
      "evidence": "Draft PRs #1, #3, #4, #5, #6. origin/main has no docs/ops."
    },
    {
      "item": "Log Bot cannot see desktop/web/local chats",
      "evidence": "list-cloud-agents desktop/web/local sources returned 0 in this environment."
    },
    {
      "item": "v2 pipeline tree not mounted for Log Bot",
      "evidence": "property-intel-v2 404; OneDrive Desktop/property-intel-v2/docs/ops not writable from this VM."
    }
  ]
};
