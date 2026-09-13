window.PI_STATUS = {
  "as_of": "2026-09-13",
  "as_of_utc": "2026-09-13T00:19:23Z",
  "repo": "jonahbourgeois1/property-intel",
  "ref": "origin/main",
  "head": {
    "sha": "04ba593ab9a0bbc7fb5f04bf6bee4aa8d754c942",
    "short": "04ba593",
    "message": "Speed up Nearmap review open by overlapping Maps, nadir, and original regions.",
    "author_date": "2026-09-11T20:39:57Z"
  },
  "sources": {
    "git_log_since": "2026-09-12",
    "iso_week": "2026-W37",
    "changelog": "docs/NEARMAP_CHANGELOG.md (v1 Nearmap only; project CHANGELOG.md and CONTEXT absent)",
    "context": null,
    "property_intel_v2": "404 from this token; OneDrive v2 docs/ops not mounted",
    "note": "index.html embeds this snapshot so a stale sibling status.js without ## 2026-09-13 cannot hide today"
  },
  "weekly": {
    "label": "2026-W37",
    "start": "2026-09-07",
    "end": "2026-09-13",
    "shipped": [
      {
        "sha": "8be883dbbdc6591c0ace062c162adf196142f7d2",
        "short": "8be883d",
        "message": "Publish the Nearmap review page so GitHub Pages can serve Pass 1 QA.",
        "author_date": "2026-09-07T16:29:45Z",
        "evidence": "origin/main after 9/07 cron (da8dedf). nearmap-review.html BUILD v1.0.1. No apps scripts/, no data/."
      },
      {
        "sha": "949f6d6993ad21ae88f64eed6e24f3460c40340b",
        "short": "949f6d6",
        "message": "Show per-layer Nearmap AI colors and hint centroids on the review page (v1.2.0).",
        "author_date": "2026-09-07T17:29:46Z",
        "evidence": "origin/main at the 9/09 cron. nearmap-review.html BUILD v1.2.0 (no v1.1.0 commit on main) + docs/NEARMAP_CHANGELOG.md. No apps scripts/, no data/."
      },
      {
        "sha": "f2c9c3444bece96a7da3b82c14c8c92db62a89fa",
        "short": "f2c9c34",
        "message": "Show the Nearmap map before AI polygons so the review page opens reliably (v1.2.1).",
        "author_date": "2026-09-08T09:29:36-05:00",
        "evidence": "origin/main after 9/09 cron (head was 949f6d6). Show the Nearmap map before AI polygons so the review page opens reliably (v1.2.1)."
      },
      {
        "sha": "413b88607a1802729be801859f630e8a6ccd278f",
        "short": "413b886",
        "message": "Nearmap reviewer v1.3.29: Draw-only paint/erase on vendor regions, original/edits folders, testing-mode default",
        "author_date": "2026-09-09T12:13:08-05:00",
        "evidence": "origin/main after 9/09 cron (head was 949f6d6). Nearmap reviewer v1.3.29: Draw-only paint/erase on vendor regions, original/edits folders, testing-mode default"
      },
      {
        "sha": "3250ab7b1f3f177857ab4e401381f8d1683c1e81",
        "short": "3250ab7",
        "message": "Nearmap v1.4.0: sheet mode on the original/edits folder format",
        "author_date": "2026-09-09T12:38:13-05:00",
        "evidence": "origin/main after 9/09 cron (head was 949f6d6). Nearmap v1.4.0: sheet mode on the original/edits folder format"
      },
      {
        "sha": "83dcac79f4ec30fc9f4108ef78dc9c89022dc194",
        "short": "83dcac7",
        "message": "Nearmap reviewer v1.4.1: pin at the interior point of irregular shapes",
        "author_date": "2026-09-09T12:51:13-05:00",
        "evidence": "origin/main after 9/09 cron (head was 949f6d6). Nearmap reviewer v1.4.1: pin at the interior point of irregular shapes"
      },
      {
        "sha": "8c8f5c5e3a5d2a24cd2c0254c22c5ef273c1fc3f",
        "short": "8c8f5c5",
        "message": "Nearmap v1.5.0: two editors on one page (regions / pins)",
        "author_date": "2026-09-09T13:39:39-05:00",
        "evidence": "origin/main after 9/09 cron (head was 949f6d6). Nearmap v1.5.0: two editors on one page (regions / pins)"
      },
      {
        "sha": "dd7d539b32218e3961c43b0104cad6b0da029f71",
        "short": "dd7d539",
        "message": "Nearmap v1.5.1: regions edits push via Contents API with real error text; single-flight Save",
        "author_date": "2026-09-09T13:48:24-05:00",
        "evidence": "origin/main after 9/09 cron (head was 949f6d6). Nearmap v1.5.1: regions edits push via Contents API with real error text; single-flight Save"
      },
      {
        "sha": "fed22d466c1c6576a34608106f36cd70170dde85",
        "short": "fed22d4",
        "message": "Nearmap reviewer v1.5.2: Save retries once on Apps Script HTML error page",
        "author_date": "2026-09-09T13:56:29-05:00",
        "evidence": "origin/main after 9/09 cron (head was 949f6d6). Nearmap reviewer v1.5.2: Save retries once on Apps Script HTML error page"
      },
      {
        "sha": "c5a048537b5a6eed003d19e3af9a8d2cab53172b",
        "short": "c5a0485",
        "message": "Nearmap reviewer v1.5.3: Copy JSON is mode-aware",
        "author_date": "2026-09-09T14:01:02-05:00",
        "evidence": "origin/main after 9/09 cron (head was 949f6d6). Nearmap reviewer v1.5.3: Copy JSON is mode-aware"
      },
      {
        "sha": "786c251cc094d52acb736a9b45b8d5facbeab566",
        "short": "786c251",
        "message": "Nearmap regions — site VY-IN-002 (1 changed, 15 removed)",
        "author_date": "2026-09-09T14:15:04-05:00",
        "evidence": "origin/main after 9/09 cron (head was 949f6d6). Nearmap regions — site VY-IN-002 (1 changed, 15 removed)"
      },
      {
        "sha": "926ba987fbb38ea21b0a8ac11402a19efb136974",
        "short": "926ba98",
        "message": "Nearmap regions — site VY-IN-002 (1 changed, 15 removed)",
        "author_date": "2026-09-09T14:15:54-05:00",
        "evidence": "origin/main after 9/09 cron (head was 949f6d6). Nearmap regions — site VY-IN-002 (1 changed, 15 removed)"
      },
      {
        "sha": "c73442d94a5a56789214a5bcc3992f2aba8b844f",
        "short": "c73442d",
        "message": "Nearmap v1.6.0: regions edits go Apps Script -> S3; GitHub out of the regions path",
        "author_date": "2026-09-09T14:33:14-05:00",
        "evidence": "origin/main after 9/09 cron (head was 949f6d6). Nearmap v1.6.0: regions edits go Apps Script -> S3; GitHub out of the regions path"
      },
      {
        "sha": "caa39b50481a4819f338b598cd6ac2e99680ad7e",
        "short": "caa39b5",
        "message": "Nearmap reviewer v1.6.1: pin at the deepest interior point (max edge clearance), not a centroid that merely falls inside",
        "author_date": "2026-09-09T14:51:23-05:00",
        "evidence": "origin/main after 9/09 cron (head was 949f6d6). Nearmap reviewer v1.6.1: pin at the deepest interior point (max edge clearance), not a centroid that merely falls inside"
      },
      {
        "sha": "51dc3d53e8d0c242358e93dd68aa1d7fde735cc8",
        "short": "51dc3d5",
        "message": "Nearmap viewer v1.0.0 (2D / 3D / obliques, AI layers in both) + mesh_to_glb.py",
        "author_date": "2026-09-09T15:15:10-05:00",
        "evidence": "origin/main after 9/09 cron (head was 949f6d6). Nearmap viewer v1.0.0 (2D / 3D / obliques, AI layers in both) + mesh_to_glb.py"
      },
      {
        "sha": "2d26d36353030e47f6aea3d3f5d47dd8d6c3e083",
        "short": "2d26d36",
        "message": "nearmap-viewer v1.0.1: 3D camera/controls identical to model-viewer (left pan, middle rotate, right dolly, 0-90 polar lock, 45-degree opening, Reset View)",
        "author_date": "2026-09-09T15:30:27-05:00",
        "evidence": "origin/main after 9/09 cron (head was 949f6d6). nearmap-viewer v1.0.1: 3D camera/controls identical to model-viewer (left pan, middle rotate, right dolly, 0-90 polar lock, 45-degree opening, Reset View)"
      },
      {
        "sha": "ce346ce5600d8a095f84d37037378061e68efe5f",
        "short": "ce346ce",
        "message": "nearmap-viewer v1.0.2: re-read regions on tab focus and Reload; status shows save time",
        "author_date": "2026-09-09T15:49:18-05:00",
        "evidence": "origin/main after 9/09 cron (head was 949f6d6). nearmap-viewer v1.0.2: re-read regions on tab focus and Reload; status shows save time"
      },
      {
        "sha": "16ac48633f36362d241307953cebc152fd4a14bc",
        "short": "16ac486",
        "message": "nearmap-review v1.6.2: holes are real geometry - drawn as cutouts, respected by inside tests, kept across strokes",
        "author_date": "2026-09-09T16:10:25-05:00",
        "evidence": "origin/main after 9/09 cron (head was 949f6d6). nearmap-review v1.6.2: holes are real geometry - drawn as cutouts, respected by inside tests, kept across strokes"
      },
      {
        "sha": "4868b3278f7a610af2bec1593c5af2833500097a",
        "short": "4868b32",
        "message": "nearmap-review v1.6.3: grow strokes fill crumb/sliver holes; pre-existing holes protected",
        "author_date": "2026-09-09T16:18:03-05:00",
        "evidence": "origin/main after 9/09 cron (head was 949f6d6). nearmap-review v1.6.3: grow strokes fill crumb/sliver holes; pre-existing holes protected"
      },
      {
        "sha": "2136a2ba44725ab41eaa2e3cc910eac3d0e16b92",
        "short": "2136a2b",
        "message": "nearmap-review v1.6.4: hole-fill thresholds x4 (24 m2 / 3.2 m)",
        "author_date": "2026-09-09T16:21:05-05:00",
        "evidence": "origin/main after 9/09 cron (head was 949f6d6). nearmap-review v1.6.4: hole-fill thresholds x4 (24 m2 / 3.2 m)"
      },
      {
        "sha": "8972580555dae31a97983c26874c5831b2277c05",
        "short": "8972580",
        "message": "nearmap-review v1.6.5: hole-fill thresholds x10 (240 m2 / 32 m)",
        "author_date": "2026-09-09T16:26:17-05:00",
        "evidence": "origin/main after 9/09 cron (head was 949f6d6). nearmap-review v1.6.5: hole-fill thresholds x10 (240 m2 / 32 m)"
      },
      {
        "sha": "085033ba53471b26786dead1f98ce40d28d1f718",
        "short": "085033b",
        "message": "nearmap-review v1.6.6: drop loop autofill; leftover crumbs fill like erase fragments",
        "author_date": "2026-09-09T16:36:38-05:00",
        "evidence": "origin/main after 9/09 cron (head was 949f6d6). nearmap-review v1.6.6: drop loop autofill; leftover crumbs fill like erase fragments"
      },
      {
        "sha": "fa6019179db8b894031bd7d83e4e4116a7fdd59a",
        "short": "fa60191",
        "message": "nearmap-review v1.6.7: close leftover brush seams; do not flood-fill connected interiors",
        "author_date": "2026-09-09T16:47:56-05:00",
        "evidence": "origin/main after 9/09 cron (head was 949f6d6). nearmap-review v1.6.7: close leftover brush seams; do not flood-fill connected interiors"
      },
      {
        "sha": "edc8225cd4f88bf04f32927c67f2582828b687dd",
        "short": "edc8225",
        "message": "nearmap-review v1.6.8: gap-close radius x0.5 (1x brush)",
        "author_date": "2026-09-09T16:54:15-05:00",
        "evidence": "origin/main after 9/09 cron (head was 949f6d6). nearmap-review v1.6.8: gap-close radius x0.5 (1x brush)"
      },
      {
        "sha": "31e8672b3cf01c604a8c7822c922b038ef797320",
        "short": "31e8672",
        "message": "nearmap-review v1.6.9: gap-close only under this stroke; keep unpainted holes",
        "author_date": "2026-09-09T17:00:00-05:00",
        "evidence": "origin/main after 9/09 cron (head was 949f6d6). nearmap-review v1.6.9: gap-close only under this stroke; keep unpainted holes"
      },
      {
        "sha": "60093e9a9e924fc134cc4ee3dcb0024006a870eb",
        "short": "60093e9",
        "message": "nearmap-review v1.6.10: stronger stroke-local close; keep only substantial cutouts",
        "author_date": "2026-09-09T17:06:14-05:00",
        "evidence": "origin/main after 9/09 cron (head was 949f6d6). nearmap-review v1.6.10: stronger stroke-local close; keep only substantial cutouts"
      },
      {
        "sha": "54d0c8b71137aaf7125383ae432141e6fbaba770",
        "short": "54d0c8b",
        "message": "nearmap-review v1.6.11: Revert changes vs Revert to original",
        "author_date": "2026-09-09T17:11:46-05:00",
        "evidence": "origin/main after 9/09 cron (head was 949f6d6). nearmap-review v1.6.11: Revert changes vs Revert to original"
      },
      {
        "sha": "c45d69c6a4543375df039eb36da223b44611f9c3",
        "short": "c45d69c",
        "message": "nearmap-viewer v1.0.3: 3D fills cap the whole footprint like 2D",
        "author_date": "2026-09-09T17:22:33-05:00",
        "evidence": "origin/main after 9/09 cron (head was 949f6d6). nearmap-viewer v1.0.3: 3D fills cap the whole footprint like 2D"
      },
      {
        "sha": "5e36083786ba085d40c49f1fa3348a233ced747e",
        "short": "5e36083",
        "message": "Put Nearmap in the Vyanet hub with draped 3D fills.",
        "author_date": "2026-09-09T17:52:05-05:00",
        "evidence": "origin/main after 9/09 cron (head was 949f6d6). Put Nearmap in the Vyanet hub with draped 3D fills."
      },
      {
        "sha": "c925508bef2dd10cb3f7e8f6ece616f1a2dba369",
        "short": "c925508",
        "message": "Open Nearmap full-page from the hub; drop Property Facts from that rail.",
        "author_date": "2026-09-09T18:10:44-05:00",
        "evidence": "origin/main after 9/09 cron (head was 949f6d6). Open Nearmap full-page from the hub; drop Property Facts from that rail."
      },
      {
        "sha": "7dd60509a8fff8bea6040b0a6d3f4e98bd4f9cab",
        "short": "7dd6050",
        "message": "Clip Nearmap to the taxlot and keep observed facts when clip is off.",
        "author_date": "2026-09-10T10:56:55-05:00",
        "evidence": "origin/main after 9/10 cron (head was c925508). nearmap-viewer.html BUILD v1.1.2→v1.1.5 (no v1.1.3/v1.1.4 commits on main). Hub 1.8.16→1.8.17. Adds nearmap-lot.js, test-nearmap-lot.mjs, lot_clip.py. Review stays v1.6.11. nearmap.gs copy — not a deploy."
      },
      {
        "sha": "4937ac0aa89450a0d344ccb474ac104b9efab17a",
        "short": "4937ac0",
        "message": "Pass 2 Nearmap pins use region class names; place and delete only on painted regions.",
        "author_date": "2026-09-10T13:23:09-05:00",
        "evidence": "origin/main after 9/10 cron. nearmap-review.html BUILD v1.6.11→v1.7.6 (no v1.7.0–v1.7.5 commits on main). Viewer v1.1.5→v1.1.7. nearmap.gs + config.gs copies (NM_MAX_PINS=20 Pass 1 only) — not a deploy. Catalog role= untouched."
      },
      {
        "sha": "542bd096f8e55f680fb13f3575bdd22777fc74d7",
        "short": "542bd09",
        "message": "Sync Nearmap — row 2 — 9/10/2026, 2:01:10 PM",
        "author_date": "2026-09-10T14:01:11-05:00",
        "evidence": "origin/main after 9/10 cron. First published data/nearmap/{id}.json on main (d9f759d7351db3886c79dd689c41e3c0; 20 elements). Sync-owned."
      },
      {
        "sha": "c32f8a8dfdd7a23e5d95f1386d81fc989db3678e",
        "short": "c32f8a8",
        "message": "Sync Nearmap — row 2 — 9/10/2026, 2:06:35 PM",
        "author_date": "2026-09-10T14:06:35-05:00",
        "evidence": "origin/main after 9/10 cron. Empty: same tree as 542bd09."
      },
      {
        "sha": "68961de945ae08602971ee50d6d8fda802eaec84",
        "short": "68961de",
        "message": "Sync Nearmap — row 2 — 9/10/2026, 2:28:33 PM",
        "author_date": "2026-09-10T14:28:33-05:00",
        "evidence": "origin/main HEAD after 9/10 cron. Empty: same tree as 542bd09."
      },
      {
        "sha": "6a6b387b7f0062a5922bee28fb49e59a5e1c1f65",
        "short": "6a6b387",
        "message": "Publish Responder Intel — 1 property — 9/11/2026, 8:58:56 AM",
        "author_date": "2026-09-11T08:58:57-05:00",
        "evidence": "origin/main after 9/11 cron (head was 68961de). Added data/responder-drone/2f9752e06f4420499fdedb2f64332ec3.json. Sync-owned."
      },
      {
        "sha": "bca8b2b6c8cbf3d6c3bb3eb06e6b46a98384c3f2",
        "short": "bca8b2b",
        "message": "Publish Responder Intel — 1 property — 9/11/2026, 9:00:08 AM",
        "author_date": "2026-09-11T09:00:09-05:00",
        "evidence": "origin/main after 9/11 cron. Added data/responder-drone/35ba5fb366a3e74ad850fd67dbecb76a.json. Sync-owned."
      },
      {
        "sha": "2b1ea3c9e3623a04520867462d4d2def4dc3c333",
        "short": "2b1ea3c",
        "message": "Publish Responder Intel — 1 property — 9/11/2026, 9:00:24 AM",
        "author_date": "2026-09-11T09:00:25-05:00",
        "evidence": "origin/main after 9/11 cron. Added data/responder-drone/179ba3732f53b33cc66c1019be0c0552.json. Sync-owned."
      },
      {
        "sha": "5da783820877b82a41dc092ad716feb7041d6617",
        "short": "5da7838",
        "message": "Publish Responder Intel — 1 property — 9/11/2026, 9:00:42 AM",
        "author_date": "2026-09-11T09:00:42-05:00",
        "evidence": "origin/main after 9/11 cron. Added data/responder-drone/d0d9ecef8085810b95a893bb3ea83175.json. Sync-owned."
      },
      {
        "sha": "97714e5f3141c469210e2f1c4f656f83ed9af607",
        "short": "97714e5",
        "message": "Publish Responder Intel — 1 property — 9/11/2026, 9:00:57 AM",
        "author_date": "2026-09-11T09:00:58-05:00",
        "evidence": "origin/main after 9/11 cron. Added data/responder-drone/4f549e3ac8b21fb2d08b66a5d49c10e1.json. Sync-owned."
      },
      {
        "sha": "2fcc1be793e2cce330106c42dac4a50b1e2d410d",
        "short": "2fcc1be",
        "message": "Publish Responder Intel — 1 property — 9/11/2026, 9:01:17 AM",
        "author_date": "2026-09-11T09:01:17-05:00",
        "evidence": "origin/main after 9/11 cron. Added data/responder-drone/c952b44d8f725e23d9af67323ce56064.json. Sync-owned. responder-drone 131→137."
      },
      {
        "sha": "07b62a1d515c6f26e6f36e85546ad0b389d000ca",
        "short": "07b62a1",
        "message": "Show Nearmap Pass 3 FR/WF concern pins and descriptions on the product viewer.",
        "author_date": "2026-09-11T09:14:20-05:00",
        "evidence": "origin/main HEAD after 9/11 cron. nearmap-viewer.html BUILD v1.1.7→v1.1.13 (no v1.1.8–v1.1.12 commits on main). Hub stays 1.8.17. Review stays v1.7.6. nearmap.gs copy — not a deploy. Catalog role= untouched."
      },
      {
        "sha": "b9700afa31f52816183681e8ef834aee9e5989c7",
        "short": "b9700af",
        "message": "Fix Nearmap review scroll and Draw brush pick.",
        "author_date": "2026-09-11T12:25:56-05:00",
        "evidence": "origin/main after 9/12 cron (head was 07b62a1). nearmap-review.html BUILD v1.7.6→v1.7.8 (no v1.7.7 commit on main). Changelog titles: pin-editor frame lock; region brush pick (no 10 m snap). Viewer stays v1.1.13. Hub stays 1.8.17. No .gs / data/."
      },
      {
        "sha": "edcd83637e6d07682dc0e8c01fb99e0f52790447",
        "short": "edcd836",
        "message": "Fix Nearmap Draw: filled grow, cursor, and overlay targeting.",
        "author_date": "2026-09-11T14:56:27-05:00",
        "evidence": "origin/main after 9/12 cron. nearmap-review.html BUILD v1.7.8→v1.7.16 (no v1.7.9–v1.7.10 commits on main; docs/NEARMAP_CHANGELOG.md records v1.7.11–v1.7.16 in this same commit). Also tools/nearmap/review_server.py. Viewer stays v1.1.13. No .gs / data/."
      },
      {
        "sha": "04ba593ab9a0bbc7fb5f04bf6bee4aa8d754c942",
        "short": "04ba593",
        "message": "Speed up Nearmap review open by overlapping Maps, nadir, and original regions.",
        "author_date": "2026-09-11T15:39:57-05:00",
        "evidence": "origin/main HEAD after 9/12 cron. nearmap-review.html BUILD v1.7.16→v1.7.17. Viewer stays v1.1.13. Hub stays 1.8.17. No .gs / data/. Catalog role= untouched."
      }
    ],
    "still_open": [
      {
        "item": "Chat direction not visible to Log Bot",
        "evidence": "list-cloud-agents returned this cron (bc-152d50fe), 9/12 bc-01255360, 9/11 bc-56175265, 9/10 bc-db7958ae, 9/09 bc-134f8307, 9/08 bc-bbc69d44, 9/07 bc-cd56ff85, 9/06 bc-34e087f8, 9/05 bc-5c01f7f0, 9/04 bc-7fb90f35, 9/03 bc-b1bc2328, 9/02 bc-7de4187d, 9/01 bc-76a61999, 8/31 bc-f631c354, 8/30 bc-eb481f27, 8/29 bc-8dc1a78f, 8/28 bc-ede78703, 8/27 bc-d4995744, 8/26 bc-45e4c56a, plus internal Search 8/28 transcript for dashboard / Find original ops dashboard schema / Summarize yesterday log bot; desktop/web/local sources returned 0"
      },
      {
        "item": "Daily log PRs #1, #3, #4, #5, #6, #7, #8, #9, #10, #11, #12, #13, #14, #15, #16, #17, and #18 still DRAFT; docs/ops/ not on main",
        "evidence": "gh pr list: #1 cursor/property-intel-daily-log-4f45 DRAFT; #3 cursor/property-intel-daily-log-299e DRAFT; #4 cursor/property-intel-daily-log-0704 DRAFT; #5 cursor/property-intel-daily-log-3f6c DRAFT; #6 cursor/property-intel-daily-log-866d DRAFT; #7 cursor/property-intel-daily-log-0d29 DRAFT; #8 cursor/property-intel-daily-log-3473 DRAFT; #9 cursor/property-intel-daily-log-4466 DRAFT; #10 cursor/property-intel-daily-log-b7f8 DRAFT; #11 cursor/property-intel-daily-log-5d78 DRAFT; #12 cursor/bc-34e087f8-2e0e-4559-8504-282e90c95654-84fb DRAFT; #13 cursor/property-intel-daily-log-e481 DRAFT; #14 cursor/property-intel-daily-log-6e97 DRAFT; #15 cursor/property-intel-daily-log-04fc DRAFT; #16 cursor/property-intel-daily-log-6f76 DRAFT; #17 cursor/property-intel-daily-log-b231 DRAFT; #18 cursor/property-intel-daily-log-fbce DRAFT; origin/main has no docs/ops"
      },
      {
        "item": "Nearmap Apps Script deploy / S3 edits write unverified",
        "evidence": "7dd6050/4937ac0/07b62a1 copied apps scripts/nearmap.gs; 4937ac0 also copied config.gs — file copies, not a deploy. b9700af/edcd836/04ba593 added no .gs copy. 542bd09 published data/nearmap/d9f759d7351db3886c79dd689c41e3c0.json (20 elements). This clone cannot see the Apps Script editor or the S3 edits object; paste + new deployment and checkS3EditsWrite are not evidenced."
      }
    ],
    "watchouts": [
      "Apps Script editor-save is not a new deployment; .gs copies in git are not a deploy. No .gs copy in b9700af/edcd836/04ba593. nearmap.gs last copy remains 07b62a1; config.gs last Nearmap copy remains 4937ac0. satellite.gs last copy remains d688a65; no satellite.gs copy after that. MOCKINGBIRD row 277 is the first check after a real satellite.gs deploy.",
      "Public data/*.json is sync-owned. Last Sync/Publish on origin/main is 2fcc1be Publish Responder Intel — 1 property (six files; responder-drone 131→137). Nearmap JSON unchanged after 542bd09. No satellite/plane/drone Sync/Publish after 187a608. Recount 2026-09-13: satellite 506, plane 22, drone 128, drone-test 2, lane tiles 332, gis 3, hoa 5, responder-drone 137, nearmap 1.",
      "pins-catalog.json still has role= on every pin after the 256-pin update (195 primary, 61 concern); do not flatten it. Golf catalog is a separate Golf Pins sheet (ids 1001-1150 in the golf.gs seed); golf.gs header says never merge it into pins-catalog.json."
    ],
    "completion_percent": null,
    "pipelines": [
      {
        "id": "viewers",
        "name": "Responder viewers (v1 Pages)",
        "status": "on main",
        "evidence": "origin/main 04ba593; HUB_BUILD 1.8.17; element-review BUILD v6.8.20; golf-review BUILD v1.0.4; nearmap-review BUILD v1.7.17; nearmap-viewer BUILD v1.1.13"
      },
      {
        "id": "sync",
        "name": "Apps Script → GitHub data sync",
        "status": "last Sync/Publish 2026-09-11 responder-drone x6",
        "evidence": "6a6b387..2fcc1be added six data/responder-drone/{id}.json (131→137). 542bd09 remains the Nearmap JSON write. 187a608 remains last drone Sync. No satellite/plane Sync/Publish. b9700af..04ba593 did not touch data/. Editor-save is not a deploy."
      },
      {
        "id": "satellite",
        "name": "Satellite Pass 1 / review / Pass 2",
        "status": "viewers on main; deploy unverified",
        "evidence": "element-review.html BUILD v6.8.20 unchanged by b9700af..04ba593. satellite.gs copy last changed in d688a65; file copy is not a deploy. No satellite.gs copy 2026-09-03..2026-09-13."
      },
      {
        "id": "nearmap",
        "name": "Nearmap trial (review + viewer + hub)",
        "status": "review v1.7.17 + viewer v1.1.13 + hub 1.8.17 on main; one published JSON; Apps Script deploy / S3 edits unverified",
        "evidence": "b9700af/edcd836/04ba593 review v1.7.6→v1.7.17 (no .gs). Viewer stays v1.1.13. Hub stays 1.8.17. 542bd09 published data/nearmap/{id}.json unchanged today."
      },
      {
        "id": "golf",
        "name": "Golf review (sheet-only)",
        "status": "on main; Apps Script deploy unverified",
        "evidence": "golf-review.html BUILD v1.0.4 on origin/main 8b1d0d4; unchanged by b9700af..04ba593. Seed 150 pins ids 1001-1150; GOLF_MAX_PINS=200 in config.gs copy. golf.gs header: no data/golf/, never merge into pins-catalog.json. .gs copies are not a deploy."
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
        "evidence": "Hub 1.8.17 unchanged by 04ba593. Private rail copy still lists Live as this property's CHEKT cameras; Nearmap is a leave/return page. live-viewer.html still on origin/main. Unchanged CHEKT code path not re-probed."
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
        "evidence": "Draft PRs #1, #3, #4, #5, #6, #7, #8, #9, #10, #11, #12, #13, #14, #15, #16, #17, #18. origin/main has no docs/ops."
      },
      {
        "item": "Log Bot cannot see desktop/web/local chats",
        "evidence": "list-cloud-agents desktop/web/local sources returned 0 in this environment."
      },
      {
        "item": "v2 pipeline tree not mounted for Log Bot",
        "evidence": "property-intel-v2 404; OneDrive Desktop/property-intel-v2/docs/ops not writable from this VM."
      },
      {
        "item": "Golf Apps Script deploy unverified",
        "evidence": "a8b3ceb..8b1d0d4 committed golf.gs/config.gs/menu.gs/critique-api.gs copies. Editor-save is not a deploy. No golf-review or golf.gs commits after 8b1d0d4. config.gs was edited for Nearmap in 4937ac0 — still a file copy."
      },
      {
        "item": "satellite.gs / critique-api.gs deploy unverified after 9/01 evening + 9/02 copies",
        "evidence": "d688a65 copied satellite.gs and critique-api.gs; da8dedf copied critique-api.gs. File copies are not a deploy. b9700af..04ba593 did not copy satellite.gs or critique-api.gs. MOCKINGBIRD row 277 is the first check after a real satellite.gs deploy."
      },
      {
        "item": "Nearmap Apps Script deploy / S3 edits write unverified",
        "evidence": "7dd6050/4937ac0/07b62a1 copied nearmap.gs; 4937ac0 copied config.gs — file copies, not a deploy. b9700af..04ba593 added no .gs copy. Published JSON exists (542bd09). This clone cannot see the Apps Script editor or the S3 edits object."
      }
    ]
  },
  "days": [
    "2026-09-13",
    "2026-09-12",
    "2026-09-11",
    "2026-09-10",
    "2026-09-09",
    "2026-09-08",
    "2026-09-07",
    "2026-09-06",
    "2026-09-05",
    "2026-09-04",
    "2026-09-03",
    "2026-09-02",
    "2026-09-01",
    "2026-08-31",
    "2026-08-30",
    "2026-08-29",
    "2026-08-28",
    "2026-08-27",
    "2026-08-26",
    "2026-08-25"
  ],
  "shipped_today": [
    {
      "sha": "b9700afa31f52816183681e8ef834aee9e5989c7",
      "short": "b9700af",
      "message": "Fix Nearmap review scroll and Draw brush pick.",
      "author_date": "2026-09-11T12:25:56-05:00",
      "evidence": "origin/main after 9/12 cron (head was 07b62a1). nearmap-review.html BUILD v1.7.6→v1.7.8 (no v1.7.7 commit on main). Changelog titles: pin-editor frame lock; region brush pick (no 10 m snap). Viewer stays v1.1.13. Hub stays 1.8.17. No .gs / data/."
    },
    {
      "sha": "edcd83637e6d07682dc0e8c01fb99e0f52790447",
      "short": "edcd836",
      "message": "Fix Nearmap Draw: filled grow, cursor, and overlay targeting.",
      "author_date": "2026-09-11T14:56:27-05:00",
      "evidence": "origin/main after 9/12 cron. nearmap-review.html BUILD v1.7.8→v1.7.16 (no v1.7.9–v1.7.10 commits on main; docs/NEARMAP_CHANGELOG.md records v1.7.11–v1.7.16 in this same commit). Also tools/nearmap/review_server.py. Viewer stays v1.1.13. No .gs / data/."
    },
    {
      "sha": "04ba593ab9a0bbc7fb5f04bf6bee4aa8d754c942",
      "short": "04ba593",
      "message": "Speed up Nearmap review open by overlapping Maps, nadir, and original regions.",
      "author_date": "2026-09-11T15:39:57-05:00",
      "evidence": "origin/main HEAD after 9/12 cron. nearmap-review.html BUILD v1.7.16→v1.7.17. Viewer stays v1.1.13. Hub stays 1.8.17. No .gs / data/. Catalog role= untouched."
    }
  ],
  "shipped_this_week": [
    {
      "sha": "8be883dbbdc6591c0ace062c162adf196142f7d2",
      "short": "8be883d",
      "message": "Publish the Nearmap review page so GitHub Pages can serve Pass 1 QA.",
      "author_date": "2026-09-07T16:29:45Z",
      "evidence": "origin/main after 9/07 cron (da8dedf). nearmap-review.html BUILD v1.0.1. No apps scripts/, no data/."
    },
    {
      "sha": "949f6d6993ad21ae88f64eed6e24f3460c40340b",
      "short": "949f6d6",
      "message": "Show per-layer Nearmap AI colors and hint centroids on the review page (v1.2.0).",
      "author_date": "2026-09-07T17:29:46Z",
      "evidence": "origin/main at the 9/09 cron. nearmap-review.html BUILD v1.2.0 (no v1.1.0 commit on main) + docs/NEARMAP_CHANGELOG.md. No apps scripts/, no data/."
    },
    {
      "sha": "f2c9c3444bece96a7da3b82c14c8c92db62a89fa",
      "short": "f2c9c34",
      "message": "Show the Nearmap map before AI polygons so the review page opens reliably (v1.2.1).",
      "author_date": "2026-09-08T09:29:36-05:00",
      "evidence": "origin/main after 9/09 cron (head was 949f6d6). Show the Nearmap map before AI polygons so the review page opens reliably (v1.2.1)."
    },
    {
      "sha": "413b88607a1802729be801859f630e8a6ccd278f",
      "short": "413b886",
      "message": "Nearmap reviewer v1.3.29: Draw-only paint/erase on vendor regions, original/edits folders, testing-mode default",
      "author_date": "2026-09-09T12:13:08-05:00",
      "evidence": "origin/main after 9/09 cron (head was 949f6d6). Nearmap reviewer v1.3.29: Draw-only paint/erase on vendor regions, original/edits folders, testing-mode default"
    },
    {
      "sha": "3250ab7b1f3f177857ab4e401381f8d1683c1e81",
      "short": "3250ab7",
      "message": "Nearmap v1.4.0: sheet mode on the original/edits folder format",
      "author_date": "2026-09-09T12:38:13-05:00",
      "evidence": "origin/main after 9/09 cron (head was 949f6d6). Nearmap v1.4.0: sheet mode on the original/edits folder format"
    },
    {
      "sha": "83dcac79f4ec30fc9f4108ef78dc9c89022dc194",
      "short": "83dcac7",
      "message": "Nearmap reviewer v1.4.1: pin at the interior point of irregular shapes",
      "author_date": "2026-09-09T12:51:13-05:00",
      "evidence": "origin/main after 9/09 cron (head was 949f6d6). Nearmap reviewer v1.4.1: pin at the interior point of irregular shapes"
    },
    {
      "sha": "8c8f5c5e3a5d2a24cd2c0254c22c5ef273c1fc3f",
      "short": "8c8f5c5",
      "message": "Nearmap v1.5.0: two editors on one page (regions / pins)",
      "author_date": "2026-09-09T13:39:39-05:00",
      "evidence": "origin/main after 9/09 cron (head was 949f6d6). Nearmap v1.5.0: two editors on one page (regions / pins)"
    },
    {
      "sha": "dd7d539b32218e3961c43b0104cad6b0da029f71",
      "short": "dd7d539",
      "message": "Nearmap v1.5.1: regions edits push via Contents API with real error text; single-flight Save",
      "author_date": "2026-09-09T13:48:24-05:00",
      "evidence": "origin/main after 9/09 cron (head was 949f6d6). Nearmap v1.5.1: regions edits push via Contents API with real error text; single-flight Save"
    },
    {
      "sha": "fed22d466c1c6576a34608106f36cd70170dde85",
      "short": "fed22d4",
      "message": "Nearmap reviewer v1.5.2: Save retries once on Apps Script HTML error page",
      "author_date": "2026-09-09T13:56:29-05:00",
      "evidence": "origin/main after 9/09 cron (head was 949f6d6). Nearmap reviewer v1.5.2: Save retries once on Apps Script HTML error page"
    },
    {
      "sha": "c5a048537b5a6eed003d19e3af9a8d2cab53172b",
      "short": "c5a0485",
      "message": "Nearmap reviewer v1.5.3: Copy JSON is mode-aware",
      "author_date": "2026-09-09T14:01:02-05:00",
      "evidence": "origin/main after 9/09 cron (head was 949f6d6). Nearmap reviewer v1.5.3: Copy JSON is mode-aware"
    },
    {
      "sha": "786c251cc094d52acb736a9b45b8d5facbeab566",
      "short": "786c251",
      "message": "Nearmap regions — site VY-IN-002 (1 changed, 15 removed)",
      "author_date": "2026-09-09T14:15:04-05:00",
      "evidence": "origin/main after 9/09 cron (head was 949f6d6). Nearmap regions — site VY-IN-002 (1 changed, 15 removed)"
    },
    {
      "sha": "926ba987fbb38ea21b0a8ac11402a19efb136974",
      "short": "926ba98",
      "message": "Nearmap regions — site VY-IN-002 (1 changed, 15 removed)",
      "author_date": "2026-09-09T14:15:54-05:00",
      "evidence": "origin/main after 9/09 cron (head was 949f6d6). Nearmap regions — site VY-IN-002 (1 changed, 15 removed)"
    },
    {
      "sha": "c73442d94a5a56789214a5bcc3992f2aba8b844f",
      "short": "c73442d",
      "message": "Nearmap v1.6.0: regions edits go Apps Script -> S3; GitHub out of the regions path",
      "author_date": "2026-09-09T14:33:14-05:00",
      "evidence": "origin/main after 9/09 cron (head was 949f6d6). Nearmap v1.6.0: regions edits go Apps Script -> S3; GitHub out of the regions path"
    },
    {
      "sha": "caa39b50481a4819f338b598cd6ac2e99680ad7e",
      "short": "caa39b5",
      "message": "Nearmap reviewer v1.6.1: pin at the deepest interior point (max edge clearance), not a centroid that merely falls inside",
      "author_date": "2026-09-09T14:51:23-05:00",
      "evidence": "origin/main after 9/09 cron (head was 949f6d6). Nearmap reviewer v1.6.1: pin at the deepest interior point (max edge clearance), not a centroid that merely falls inside"
    },
    {
      "sha": "51dc3d53e8d0c242358e93dd68aa1d7fde735cc8",
      "short": "51dc3d5",
      "message": "Nearmap viewer v1.0.0 (2D / 3D / obliques, AI layers in both) + mesh_to_glb.py",
      "author_date": "2026-09-09T15:15:10-05:00",
      "evidence": "origin/main after 9/09 cron (head was 949f6d6). Nearmap viewer v1.0.0 (2D / 3D / obliques, AI layers in both) + mesh_to_glb.py"
    },
    {
      "sha": "2d26d36353030e47f6aea3d3f5d47dd8d6c3e083",
      "short": "2d26d36",
      "message": "nearmap-viewer v1.0.1: 3D camera/controls identical to model-viewer (left pan, middle rotate, right dolly, 0-90 polar lock, 45-degree opening, Reset View)",
      "author_date": "2026-09-09T15:30:27-05:00",
      "evidence": "origin/main after 9/09 cron (head was 949f6d6). nearmap-viewer v1.0.1: 3D camera/controls identical to model-viewer (left pan, middle rotate, right dolly, 0-90 polar lock, 45-degree opening, Reset View)"
    },
    {
      "sha": "ce346ce5600d8a095f84d37037378061e68efe5f",
      "short": "ce346ce",
      "message": "nearmap-viewer v1.0.2: re-read regions on tab focus and Reload; status shows save time",
      "author_date": "2026-09-09T15:49:18-05:00",
      "evidence": "origin/main after 9/09 cron (head was 949f6d6). nearmap-viewer v1.0.2: re-read regions on tab focus and Reload; status shows save time"
    },
    {
      "sha": "16ac48633f36362d241307953cebc152fd4a14bc",
      "short": "16ac486",
      "message": "nearmap-review v1.6.2: holes are real geometry - drawn as cutouts, respected by inside tests, kept across strokes",
      "author_date": "2026-09-09T16:10:25-05:00",
      "evidence": "origin/main after 9/09 cron (head was 949f6d6). nearmap-review v1.6.2: holes are real geometry - drawn as cutouts, respected by inside tests, kept across strokes"
    },
    {
      "sha": "4868b3278f7a610af2bec1593c5af2833500097a",
      "short": "4868b32",
      "message": "nearmap-review v1.6.3: grow strokes fill crumb/sliver holes; pre-existing holes protected",
      "author_date": "2026-09-09T16:18:03-05:00",
      "evidence": "origin/main after 9/09 cron (head was 949f6d6). nearmap-review v1.6.3: grow strokes fill crumb/sliver holes; pre-existing holes protected"
    },
    {
      "sha": "2136a2ba44725ab41eaa2e3cc910eac3d0e16b92",
      "short": "2136a2b",
      "message": "nearmap-review v1.6.4: hole-fill thresholds x4 (24 m2 / 3.2 m)",
      "author_date": "2026-09-09T16:21:05-05:00",
      "evidence": "origin/main after 9/09 cron (head was 949f6d6). nearmap-review v1.6.4: hole-fill thresholds x4 (24 m2 / 3.2 m)"
    },
    {
      "sha": "8972580555dae31a97983c26874c5831b2277c05",
      "short": "8972580",
      "message": "nearmap-review v1.6.5: hole-fill thresholds x10 (240 m2 / 32 m)",
      "author_date": "2026-09-09T16:26:17-05:00",
      "evidence": "origin/main after 9/09 cron (head was 949f6d6). nearmap-review v1.6.5: hole-fill thresholds x10 (240 m2 / 32 m)"
    },
    {
      "sha": "085033ba53471b26786dead1f98ce40d28d1f718",
      "short": "085033b",
      "message": "nearmap-review v1.6.6: drop loop autofill; leftover crumbs fill like erase fragments",
      "author_date": "2026-09-09T16:36:38-05:00",
      "evidence": "origin/main after 9/09 cron (head was 949f6d6). nearmap-review v1.6.6: drop loop autofill; leftover crumbs fill like erase fragments"
    },
    {
      "sha": "fa6019179db8b894031bd7d83e4e4116a7fdd59a",
      "short": "fa60191",
      "message": "nearmap-review v1.6.7: close leftover brush seams; do not flood-fill connected interiors",
      "author_date": "2026-09-09T16:47:56-05:00",
      "evidence": "origin/main after 9/09 cron (head was 949f6d6). nearmap-review v1.6.7: close leftover brush seams; do not flood-fill connected interiors"
    },
    {
      "sha": "edc8225cd4f88bf04f32927c67f2582828b687dd",
      "short": "edc8225",
      "message": "nearmap-review v1.6.8: gap-close radius x0.5 (1x brush)",
      "author_date": "2026-09-09T16:54:15-05:00",
      "evidence": "origin/main after 9/09 cron (head was 949f6d6). nearmap-review v1.6.8: gap-close radius x0.5 (1x brush)"
    },
    {
      "sha": "31e8672b3cf01c604a8c7822c922b038ef797320",
      "short": "31e8672",
      "message": "nearmap-review v1.6.9: gap-close only under this stroke; keep unpainted holes",
      "author_date": "2026-09-09T17:00:00-05:00",
      "evidence": "origin/main after 9/09 cron (head was 949f6d6). nearmap-review v1.6.9: gap-close only under this stroke; keep unpainted holes"
    },
    {
      "sha": "60093e9a9e924fc134cc4ee3dcb0024006a870eb",
      "short": "60093e9",
      "message": "nearmap-review v1.6.10: stronger stroke-local close; keep only substantial cutouts",
      "author_date": "2026-09-09T17:06:14-05:00",
      "evidence": "origin/main after 9/09 cron (head was 949f6d6). nearmap-review v1.6.10: stronger stroke-local close; keep only substantial cutouts"
    },
    {
      "sha": "54d0c8b71137aaf7125383ae432141e6fbaba770",
      "short": "54d0c8b",
      "message": "nearmap-review v1.6.11: Revert changes vs Revert to original",
      "author_date": "2026-09-09T17:11:46-05:00",
      "evidence": "origin/main after 9/09 cron (head was 949f6d6). nearmap-review v1.6.11: Revert changes vs Revert to original"
    },
    {
      "sha": "c45d69c6a4543375df039eb36da223b44611f9c3",
      "short": "c45d69c",
      "message": "nearmap-viewer v1.0.3: 3D fills cap the whole footprint like 2D",
      "author_date": "2026-09-09T17:22:33-05:00",
      "evidence": "origin/main after 9/09 cron (head was 949f6d6). nearmap-viewer v1.0.3: 3D fills cap the whole footprint like 2D"
    },
    {
      "sha": "5e36083786ba085d40c49f1fa3348a233ced747e",
      "short": "5e36083",
      "message": "Put Nearmap in the Vyanet hub with draped 3D fills.",
      "author_date": "2026-09-09T17:52:05-05:00",
      "evidence": "origin/main after 9/09 cron (head was 949f6d6). Put Nearmap in the Vyanet hub with draped 3D fills."
    },
    {
      "sha": "c925508bef2dd10cb3f7e8f6ece616f1a2dba369",
      "short": "c925508",
      "message": "Open Nearmap full-page from the hub; drop Property Facts from that rail.",
      "author_date": "2026-09-09T18:10:44-05:00",
      "evidence": "origin/main after 9/09 cron (head was 949f6d6). Open Nearmap full-page from the hub; drop Property Facts from that rail."
    },
    {
      "sha": "7dd60509a8fff8bea6040b0a6d3f4e98bd4f9cab",
      "short": "7dd6050",
      "message": "Clip Nearmap to the taxlot and keep observed facts when clip is off.",
      "author_date": "2026-09-10T10:56:55-05:00",
      "evidence": "origin/main after 9/10 cron (head was c925508). nearmap-viewer.html BUILD v1.1.2→v1.1.5 (no v1.1.3/v1.1.4 commits on main). Hub 1.8.16→1.8.17. Adds nearmap-lot.js, test-nearmap-lot.mjs, lot_clip.py. Review stays v1.6.11. nearmap.gs copy — not a deploy."
    },
    {
      "sha": "4937ac0aa89450a0d344ccb474ac104b9efab17a",
      "short": "4937ac0",
      "message": "Pass 2 Nearmap pins use region class names; place and delete only on painted regions.",
      "author_date": "2026-09-10T13:23:09-05:00",
      "evidence": "origin/main after 9/10 cron. nearmap-review.html BUILD v1.6.11→v1.7.6 (no v1.7.0–v1.7.5 commits on main). Viewer v1.1.5→v1.1.7. nearmap.gs + config.gs copies (NM_MAX_PINS=20 Pass 1 only) — not a deploy. Catalog role= untouched."
    },
    {
      "sha": "542bd096f8e55f680fb13f3575bdd22777fc74d7",
      "short": "542bd09",
      "message": "Sync Nearmap — row 2 — 9/10/2026, 2:01:10 PM",
      "author_date": "2026-09-10T14:01:11-05:00",
      "evidence": "origin/main after 9/10 cron. First published data/nearmap/{id}.json on main (d9f759d7351db3886c79dd689c41e3c0; 20 elements). Sync-owned."
    },
    {
      "sha": "c32f8a8dfdd7a23e5d95f1386d81fc989db3678e",
      "short": "c32f8a8",
      "message": "Sync Nearmap — row 2 — 9/10/2026, 2:06:35 PM",
      "author_date": "2026-09-10T14:06:35-05:00",
      "evidence": "origin/main after 9/10 cron. Empty: same tree as 542bd09."
    },
    {
      "sha": "68961de945ae08602971ee50d6d8fda802eaec84",
      "short": "68961de",
      "message": "Sync Nearmap — row 2 — 9/10/2026, 2:28:33 PM",
      "author_date": "2026-09-10T14:28:33-05:00",
      "evidence": "origin/main HEAD after 9/10 cron. Empty: same tree as 542bd09."
    },
    {
      "sha": "6a6b387b7f0062a5922bee28fb49e59a5e1c1f65",
      "short": "6a6b387",
      "message": "Publish Responder Intel — 1 property — 9/11/2026, 8:58:56 AM",
      "author_date": "2026-09-11T08:58:57-05:00",
      "evidence": "origin/main after 9/11 cron (head was 68961de). Added data/responder-drone/2f9752e06f4420499fdedb2f64332ec3.json. Sync-owned."
    },
    {
      "sha": "bca8b2b6c8cbf3d6c3bb3eb06e6b46a98384c3f2",
      "short": "bca8b2b",
      "message": "Publish Responder Intel — 1 property — 9/11/2026, 9:00:08 AM",
      "author_date": "2026-09-11T09:00:09-05:00",
      "evidence": "origin/main after 9/11 cron. Added data/responder-drone/35ba5fb366a3e74ad850fd67dbecb76a.json. Sync-owned."
    },
    {
      "sha": "2b1ea3c9e3623a04520867462d4d2def4dc3c333",
      "short": "2b1ea3c",
      "message": "Publish Responder Intel — 1 property — 9/11/2026, 9:00:24 AM",
      "author_date": "2026-09-11T09:00:25-05:00",
      "evidence": "origin/main after 9/11 cron. Added data/responder-drone/179ba3732f53b33cc66c1019be0c0552.json. Sync-owned."
    },
    {
      "sha": "5da783820877b82a41dc092ad716feb7041d6617",
      "short": "5da7838",
      "message": "Publish Responder Intel — 1 property — 9/11/2026, 9:00:42 AM",
      "author_date": "2026-09-11T09:00:42-05:00",
      "evidence": "origin/main after 9/11 cron. Added data/responder-drone/d0d9ecef8085810b95a893bb3ea83175.json. Sync-owned."
    },
    {
      "sha": "97714e5f3141c469210e2f1c4f656f83ed9af607",
      "short": "97714e5",
      "message": "Publish Responder Intel — 1 property — 9/11/2026, 9:00:57 AM",
      "author_date": "2026-09-11T09:00:58-05:00",
      "evidence": "origin/main after 9/11 cron. Added data/responder-drone/4f549e3ac8b21fb2d08b66a5d49c10e1.json. Sync-owned."
    },
    {
      "sha": "2fcc1be793e2cce330106c42dac4a50b1e2d410d",
      "short": "2fcc1be",
      "message": "Publish Responder Intel — 1 property — 9/11/2026, 9:01:17 AM",
      "author_date": "2026-09-11T09:01:17-05:00",
      "evidence": "origin/main after 9/11 cron. Added data/responder-drone/c952b44d8f725e23d9af67323ce56064.json. Sync-owned. responder-drone 131→137."
    },
    {
      "sha": "07b62a1d515c6f26e6f36e85546ad0b389d000ca",
      "short": "07b62a1",
      "message": "Show Nearmap Pass 3 FR/WF concern pins and descriptions on the product viewer.",
      "author_date": "2026-09-11T09:14:20-05:00",
      "evidence": "origin/main HEAD after 9/11 cron. nearmap-viewer.html BUILD v1.1.7→v1.1.13 (no v1.1.8–v1.1.12 commits on main). Hub stays 1.8.17. Review stays v1.7.6. nearmap.gs copy — not a deploy. Catalog role= untouched."
    },
    {
      "sha": "b9700afa31f52816183681e8ef834aee9e5989c7",
      "short": "b9700af",
      "message": "Fix Nearmap review scroll and Draw brush pick.",
      "author_date": "2026-09-11T12:25:56-05:00",
      "evidence": "origin/main after 9/12 cron (head was 07b62a1). nearmap-review.html BUILD v1.7.6→v1.7.8 (no v1.7.7 commit on main). Changelog titles: pin-editor frame lock; region brush pick (no 10 m snap). Viewer stays v1.1.13. Hub stays 1.8.17. No .gs / data/."
    },
    {
      "sha": "edcd83637e6d07682dc0e8c01fb99e0f52790447",
      "short": "edcd836",
      "message": "Fix Nearmap Draw: filled grow, cursor, and overlay targeting.",
      "author_date": "2026-09-11T14:56:27-05:00",
      "evidence": "origin/main after 9/12 cron. nearmap-review.html BUILD v1.7.8→v1.7.16 (no v1.7.9–v1.7.10 commits on main; docs/NEARMAP_CHANGELOG.md records v1.7.11–v1.7.16 in this same commit). Also tools/nearmap/review_server.py. Viewer stays v1.1.13. No .gs / data/."
    },
    {
      "sha": "04ba593ab9a0bbc7fb5f04bf6bee4aa8d754c942",
      "short": "04ba593",
      "message": "Speed up Nearmap review open by overlapping Maps, nadir, and original regions.",
      "author_date": "2026-09-11T15:39:57-05:00",
      "evidence": "origin/main HEAD after 9/12 cron. nearmap-review.html BUILD v1.7.16→v1.7.17. Viewer stays v1.1.13. Hub stays 1.8.17. No .gs / data/. Catalog role= untouched."
    }
  ],
  "still_open": [
    {
      "item": "Chat direction not visible to Log Bot",
      "evidence": "list-cloud-agents returned this cron (bc-152d50fe), 9/12 bc-01255360, 9/11 bc-56175265, 9/10 bc-db7958ae, 9/09 bc-134f8307, 9/08 bc-bbc69d44, 9/07 bc-cd56ff85, 9/06 bc-34e087f8, 9/05 bc-5c01f7f0, 9/04 bc-7fb90f35, 9/03 bc-b1bc2328, 9/02 bc-7de4187d, 9/01 bc-76a61999, 8/31 bc-f631c354, 8/30 bc-eb481f27, 8/29 bc-8dc1a78f, 8/28 bc-ede78703, 8/27 bc-d4995744, 8/26 bc-45e4c56a, plus internal Search 8/28 transcript for dashboard / Find original ops dashboard schema / Summarize yesterday log bot; desktop/web/local sources returned 0"
    },
    {
      "item": "Daily log PRs #1, #3, #4, #5, #6, #7, #8, #9, #10, #11, #12, #13, #14, #15, #16, #17, and #18 still DRAFT; docs/ops/ not on main",
      "evidence": "gh pr list: #1 cursor/property-intel-daily-log-4f45 DRAFT; #3 cursor/property-intel-daily-log-299e DRAFT; #4 cursor/property-intel-daily-log-0704 DRAFT; #5 cursor/property-intel-daily-log-3f6c DRAFT; #6 cursor/property-intel-daily-log-866d DRAFT; #7 cursor/property-intel-daily-log-0d29 DRAFT; #8 cursor/property-intel-daily-log-3473 DRAFT; #9 cursor/property-intel-daily-log-4466 DRAFT; #10 cursor/property-intel-daily-log-b7f8 DRAFT; #11 cursor/property-intel-daily-log-5d78 DRAFT; #12 cursor/bc-34e087f8-2e0e-4559-8504-282e90c95654-84fb DRAFT; #13 cursor/property-intel-daily-log-e481 DRAFT; #14 cursor/property-intel-daily-log-6e97 DRAFT; #15 cursor/property-intel-daily-log-04fc DRAFT; #16 cursor/property-intel-daily-log-6f76 DRAFT; #17 cursor/property-intel-daily-log-b231 DRAFT; #18 cursor/property-intel-daily-log-fbce DRAFT; origin/main has no docs/ops"
    },
    {
      "item": "Nearmap Apps Script deploy / S3 edits write unverified",
      "evidence": "7dd6050/4937ac0/07b62a1 copied apps scripts/nearmap.gs; 4937ac0 also copied config.gs — file copies, not a deploy. b9700af/edcd836/04ba593 added no .gs copy. 542bd09 published data/nearmap/d9f759d7351db3886c79dd689c41e3c0.json (20 elements). This clone cannot see the Apps Script editor or the S3 edits object; paste + new deployment and checkS3EditsWrite are not evidenced."
    }
  ],
  "open": [
    {
      "item": "Chat direction not visible to Log Bot",
      "evidence": "list-cloud-agents returned this cron (bc-152d50fe), 9/12 bc-01255360, 9/11 bc-56175265, 9/10 bc-db7958ae, 9/09 bc-134f8307, 9/08 bc-bbc69d44, 9/07 bc-cd56ff85, 9/06 bc-34e087f8, 9/05 bc-5c01f7f0, 9/04 bc-7fb90f35, 9/03 bc-b1bc2328, 9/02 bc-7de4187d, 9/01 bc-76a61999, 8/31 bc-f631c354, 8/30 bc-eb481f27, 8/29 bc-8dc1a78f, 8/28 bc-ede78703, 8/27 bc-d4995744, 8/26 bc-45e4c56a, plus internal Search 8/28 transcript for dashboard / Find original ops dashboard schema / Summarize yesterday log bot; desktop/web/local sources returned 0"
    },
    {
      "item": "Daily log PRs #1, #3, #4, #5, #6, #7, #8, #9, #10, #11, #12, #13, #14, #15, #16, #17, and #18 still DRAFT; docs/ops/ not on main",
      "evidence": "gh pr list: #1 cursor/property-intel-daily-log-4f45 DRAFT; #3 cursor/property-intel-daily-log-299e DRAFT; #4 cursor/property-intel-daily-log-0704 DRAFT; #5 cursor/property-intel-daily-log-3f6c DRAFT; #6 cursor/property-intel-daily-log-866d DRAFT; #7 cursor/property-intel-daily-log-0d29 DRAFT; #8 cursor/property-intel-daily-log-3473 DRAFT; #9 cursor/property-intel-daily-log-4466 DRAFT; #10 cursor/property-intel-daily-log-b7f8 DRAFT; #11 cursor/property-intel-daily-log-5d78 DRAFT; #12 cursor/bc-34e087f8-2e0e-4559-8504-282e90c95654-84fb DRAFT; #13 cursor/property-intel-daily-log-e481 DRAFT; #14 cursor/property-intel-daily-log-6e97 DRAFT; #15 cursor/property-intel-daily-log-04fc DRAFT; #16 cursor/property-intel-daily-log-6f76 DRAFT; #17 cursor/property-intel-daily-log-b231 DRAFT; #18 cursor/property-intel-daily-log-fbce DRAFT; origin/main has no docs/ops"
    },
    {
      "item": "Nearmap Apps Script deploy / S3 edits write unverified",
      "evidence": "7dd6050/4937ac0/07b62a1 copied apps scripts/nearmap.gs; 4937ac0 also copied config.gs — file copies, not a deploy. b9700af/edcd836/04ba593 added no .gs copy. 542bd09 published data/nearmap/d9f759d7351db3886c79dd689c41e3c0.json (20 elements). This clone cannot see the Apps Script editor or the S3 edits object; paste + new deployment and checkS3EditsWrite are not evidenced."
    }
  ],
  "watchouts": [
    "Apps Script editor-save is not a new deployment; .gs copies in git are not a deploy. No .gs copy in b9700af/edcd836/04ba593. nearmap.gs last copy remains 07b62a1; config.gs last Nearmap copy remains 4937ac0. satellite.gs last copy remains d688a65; no satellite.gs copy after that. MOCKINGBIRD row 277 is the first check after a real satellite.gs deploy.",
    "Public data/*.json is sync-owned. Last Sync/Publish on origin/main is 2fcc1be Publish Responder Intel — 1 property (six files; responder-drone 131→137). Nearmap JSON unchanged after 542bd09. No satellite/plane/drone Sync/Publish after 187a608. Recount 2026-09-13: satellite 506, plane 22, drone 128, drone-test 2, lane tiles 332, gis 3, hoa 5, responder-drone 137, nearmap 1.",
    "pins-catalog.json still has role= on every pin after the 256-pin update (195 primary, 61 concern); do not flatten it. Golf catalog is a separate Golf Pins sheet (ids 1001-1150 in the golf.gs seed); golf.gs header says never merge it into pins-catalog.json."
  ],
  "week_label": "2026-W37",
  "completion_percent": null,
  "percent": null,
  "completion_percent_reason": "not reported; no measured evidence",
  "log_markdown": "# Property Intel daily log\n\nEvidence-only. Newest day at the top. This cloud checkout is public `jonahbourgeois1/property-intel` (v1). Completeness % omitted unless measured. Do not flatten catalog `role=`. Editor-save ≠ deploy. `data/*.json` is sync-owned. MOCKINGBIRD row 277 after a real `satellite.gs` deploy.\n\n## 2026-09-13\n\nNo author-date 2026-09-12 or 2026-09-13 commits on `origin/main`. Head is `04ba593` (2026-09-11 15:39 -0500). Yesterday's 00:10 UTC log (draft PR **#18**, `cursor/property-intel-daily-log-fbce`, `4e61771`) stopped at `07b62a1` and recorded no author-date 2026-09-12 commits; the three commits below landed after that cron.\n\nLog Bot cron `41611cd5-a0bb-11f1-b532-320a589b8025` at 2026-09-13T00:15:45Z (`bc-152d50fe`). Template still says v2/master; this clone is public v1. CHANGELOG/CONTEXT and `property-intel-v2` are not in this clone (`property-intel-v2` 404). `list-cloud-agents` listed this cron plus prior Log Bot runs (9/12 `bc-01255360`, 9/11 `bc-56175265`, 9/10 `bc-db7958ae`, 9/09 `bc-134f8307`, 9/08 `bc-bbc69d44`, 9/07 `bc-cd56ff85`, 9/06 `bc-34e087f8`, 9/05 `bc-5c01f7f0`, 9/04 `bc-7fb90f35`, 9/03 `bc-b1bc2328`, 9/02 `bc-7de4187d`, 9/01 `bc-76a61999`, 8/31 `bc-f631c354`, 8/30 `bc-eb481f27`, 8/29 `bc-8dc1a78f`, 8/28 `bc-ede78703`, 8/27 `bc-d4995744`, 8/26 `bc-45e4c56a`) and three internal agents (\"Search 8/28 transcript for dashboard\", \"Find original ops dashboard schema\", \"Summarize yesterday log bot\"). Desktop/web/local sources returned 0.\n\n### Shipped\n- `b9700af` Fix Nearmap review scroll and Draw brush pick. `nearmap-review.html` BUILD **v1.7.6 → v1.7.8** (no v1.7.7 commit on main). Changelog titles in this commit: pin-editor frame lock; region brush pick (no 10 m snap). Viewer stays **v1.1.13**. Hub stays **1.8.17**. No `.gs` / `data/`. Author-date 2026-09-11 12:25 -0500. Co-authored-by Cursor.\n- `edcd836` Fix Nearmap Draw: filled grow, cursor, and overlay targeting. BUILD **v1.7.8 → v1.7.16** (no v1.7.9–v1.7.10 commits on main; `docs/NEARMAP_CHANGELOG.md` records v1.7.11–v1.7.16 in this same commit). Also `tools/nearmap/review_server.py`. Viewer stays **v1.1.13**. No `.gs` / `data/`. Author-date 2026-09-11 14:56 -0500. Co-authored-by Cursor.\n- `04ba593` Speed up Nearmap review open by overlapping Maps, nadir, and original regions. BUILD **v1.7.16 → v1.7.17**. HEAD. Viewer stays **v1.1.13**. Hub stays **1.8.17**. No `.gs` / `data/`. Author-date 2026-09-11 15:39 -0500. Co-authored-by Cursor.\n\nElement-review remains **v6.8.20**. Golf remains **v1.0.4**. No satellite/plane/drone Sync/Publish. `data/nearmap/` still one published JSON (`542bd09`).\n\n### Still open\n- Chat direction still not visible in the Log Bot environment (`list-cloud-agents` desktop/web/local sources returned 0).\n- Daily log PRs **#1** (`ops: daily log 2026-08-27`), **#3** (`ops: daily log 2026-08-28`), **#4** (`ops: daily log 2026-08-29`), **#5** (`ops: daily log 2026-08-30`), **#6** (`ops: daily log 2026-08-31`), **#7** (`ops: daily log 2026-09-01`), **#8** (`ops: daily log 2026-09-02`), **#9** (`ops: daily log 2026-09-03`), **#10** (`ops: daily log 2026-09-04`), **#11** (`ops: daily log 2026-09-05`), **#12** (`ops: daily log 2026-09-06`), **#13** (`ops: daily log 2026-09-07`), **#14** (`ops: daily log 2026-09-08`), **#15** (`ops: daily log 2026-09-09`), **#16** (`ops: daily log 2026-09-10`), **#17** (`ops: daily log 2026-09-11`), and **#18** (`ops: daily log 2026-09-12`) are still DRAFT; `docs/ops/` is not on `main`.\n- Nearmap `nearmap.gs` / `config.gs` / `menu.gs` copies are on `main`; paste + new deployment and S3 edits write (`checkS3EditsWrite`) are not evidenced in this clone. Published `data/nearmap/{id}.json` still one file (row 2). `b9700af`/`edcd836`/`04ba593` added no `.gs` copy.\n\n### Watchouts\n- Apps Script editor-save is not a new deployment. No `.gs` copy in today's three commits. `satellite.gs` last copy remains `d688a65`; MOCKINGBIRD row 277 is the first check after a real deploy.\n- Public `data/*.json` is sync-owned. Last Sync/Publish on `origin/main` is `2fcc1be` Publish Responder Intel — 1 property. Nearmap record unchanged after `542bd09`/`68961de`. No satellite/plane/drone `data/` sync. Recount: satellite 506, plane 22, drone 128, drone-test 2, Lane 332 tiles, gis 3, hoa 5, responder-drone 137, nearmap 1.\n- Catalog `role=` still present on all 256 pins after `06c9714` (195 primary, 61 concern); do not flatten it. Golf catalog is a separate Golf Pins sheet (ids 1001+); the `golf.gs` header says never merge it into `pins-catalog.json`.\n\n## 2026-09-12\n\nNo author-date 2026-09-12 commits on `origin/main`. Head is `07b62a1` (2026-09-11 09:14 -0500). Yesterday's 00:02 UTC log (draft PR **#17**, `cursor/property-intel-daily-log-b231`, `a5ecf19`) stopped at `68961de` and recorded no author-date 2026-09-11 commits; the seven commits below landed after that cron.\n\nLog Bot cron `41611cd5-a0bb-11f1-b532-320a589b8025` at 2026-09-12T00:10:18Z (`bc-01255360`). Template still says v2/master; this clone is public v1. CHANGELOG/CONTEXT and `property-intel-v2` are not in this clone (`property-intel-v2` 404). `list-cloud-agents` listed this cron plus prior Log Bot runs (9/11 `bc-56175265`, 9/10 `bc-db7958ae`, 9/09 `bc-134f8307`, 9/08 `bc-bbc69d44`, 9/07 `bc-cd56ff85`, 9/06 `bc-34e087f8`, 9/05 `bc-5c01f7f0`, 9/04 `bc-7fb90f35`, 9/03 `bc-b1bc2328`, 9/02 `bc-7de4187d`, 9/01 `bc-76a61999`, 8/31 `bc-f631c354`, 8/30 `bc-eb481f27`, 8/29 `bc-8dc1a78f`, 8/28 `bc-ede78703`, 8/27 `bc-d4995744`, 8/26 `bc-45e4c56a`) and three internal agents (\"Search 8/28 transcript for dashboard\", \"Find original ops dashboard schema\", \"Summarize yesterday log bot\"). Desktop/web/local sources returned 0.\n\n### Shipped\n- `6a6b387` `bca8b2b` `2b1ea3c` `5da7838` `97714e5` `2fcc1be` Publish Responder Intel — 1 property (six commits, 8:58–9:01 -0500). Each added one `data/responder-drone/{id}.json`. Recount 131 → 137. Sync-owned. `jonahbourgeois1`.\n- `07b62a1` Show Nearmap Pass 3 FR/WF concern pins and descriptions on the product viewer. `nearmap-viewer.html` BUILD **v1.1.7 → v1.1.13** (no v1.1.8–v1.1.12 commits on main; `docs/NEARMAP_CHANGELOG.md` records those versions as 2026-09-10 entries in this same commit). Hub stays **1.8.17**. Review stays **v1.7.6**. Same commit copied `apps scripts/nearmap.gs` — **file copy, not a deploy**. Author-date 2026-09-11 09:14 -0500. Co-authored-by Cursor.\n\nElement-review remains **v6.8.20**. Golf remains **v1.0.4**. No satellite/plane/drone Sync/Publish. `data/nearmap/` still one published JSON (`542bd09`).\n\n### Still open\n- Chat direction still not visible in the Log Bot environment (`list-cloud-agents` desktop/web/local sources returned 0).\n- Daily log PRs **#1** (`ops: daily log 2026-08-27`), **#3** (`ops: daily log 2026-08-28`), **#4** (`ops: daily log 2026-08-29`), **#5** (`ops: daily log 2026-08-30`), **#6** (`ops: daily log 2026-08-31`), **#7** (`ops: daily log 2026-09-01`), **#8** (`ops: daily log 2026-09-02`), **#9** (`ops: daily log 2026-09-03`), **#10** (`ops: daily log 2026-09-04`), **#11** (`ops: daily log 2026-09-05`), **#12** (`ops: daily log 2026-09-06`), **#13** (`ops: daily log 2026-09-07`), **#14** (`ops: daily log 2026-09-08`), **#15** (`ops: daily log 2026-09-09`), **#16** (`ops: daily log 2026-09-10`), and **#17** (`ops: daily log 2026-09-11`) are still DRAFT; `docs/ops/` is not on `main`.\n- Nearmap `nearmap.gs` / `config.gs` / `menu.gs` copies are on `main`; paste + new deployment and S3 edits write (`checkS3EditsWrite`) are not evidenced in this clone. Published `data/nearmap/{id}.json` still one file (row 2). `07b62a1` added another `nearmap.gs` copy — not a deploy.\n\n### Watchouts\n- Apps Script editor-save is not a new deployment. `.gs` copy today (`nearmap.gs` in `07b62a1`) is not a deploy. `satellite.gs` last copy remains `d688a65`; MOCKINGBIRD row 277 is the first check after a real deploy.\n- Public `data/*.json` is sync-owned. Last Sync/Publish on `origin/main` is `2fcc1be` Publish Responder Intel — 1 property (six new `data/responder-drone/` files after `6a6b387`). Nearmap record unchanged after `542bd09`/`68961de`. No satellite/plane/drone `data/` sync. Recount: satellite 506, plane 22, drone 128, drone-test 2, Lane 332 tiles, gis 3, hoa 5, responder-drone 137, nearmap 1.\n- Catalog `role=` still present on all 256 pins after `06c9714` (195 primary, 61 concern); do not flatten it. Golf catalog is a separate Golf Pins sheet (ids 1001+); the `golf.gs` header says never merge it into `pins-catalog.json`.\n\n## 2026-09-11\n\nNo author-date 2026-09-11 commits on `origin/main`. Head is `68961de` (2026-09-10 14:28 -0500). Yesterday's 00:04 UTC log (draft PR **#16**, `cursor/property-intel-daily-log-6f76`, `0b25a4e`) stopped at `c925508` and recorded no author-date 2026-09-10 commits; the five commits below landed after that cron.\n\nLog Bot cron `41611cd5-a0bb-11f1-b532-320a589b8025` at 2026-09-11T00:02:10Z (`bc-56175265`). Template still says v2/master; this clone is public v1. CHANGELOG/CONTEXT and `property-intel-v2` are not in this clone (`property-intel-v2` 404). `list-cloud-agents` listed this cron plus prior Log Bot runs (9/10 `bc-db7958ae`, 9/09 `bc-134f8307`, 9/08 `bc-bbc69d44`, 9/07 `bc-cd56ff85`, 9/06 `bc-34e087f8`, 9/05 `bc-5c01f7f0`, 9/04 `bc-7fb90f35`, 9/03 `bc-b1bc2328`, 9/02 `bc-7de4187d`, 9/01 `bc-76a61999`, 8/31 `bc-f631c354`, 8/30 `bc-eb481f27`, 8/29 `bc-8dc1a78f`, 8/28 `bc-ede78703`, 8/27 `bc-d4995744`, 8/26 `bc-45e4c56a`) and three internal agents (\"Search 8/28 transcript for dashboard\", \"Find original ops dashboard schema\", \"Summarize yesterday log bot\"). Desktop/web/local sources returned 0.\n\n### Shipped\n- `7dd6050` Clip Nearmap to the taxlot and keep observed facts when clip is off. `nearmap-viewer.html` BUILD **v1.1.2 → v1.1.5** (no v1.1.3/v1.1.4 commits on main). Hub **1.8.16 → 1.8.17**. Adds `js/vyanet-viewer/nearmap-lot.js`, `test-nearmap-lot.mjs`, and `tools/nearmap/lot_clip.py`. Review BUILD stays **v1.6.11**. Same commit copied `apps scripts/nearmap.gs` — **file copy, not a deploy**. Author-date 2026-09-10 10:56 -0500. Co-authored-by Cursor.\n- `4937ac0` Pass 2 Nearmap pins use region class names; place and delete only on painted regions. `nearmap-review.html` BUILD **v1.6.11 → v1.7.6** (no v1.7.0–v1.7.5 commits on main). Viewer **v1.1.5 → v1.1.7**. Same commit copied `apps scripts/nearmap.gs` and `config.gs` (`NM_MAX_PINS = 20` is Pass 1 only; Pass 2 is uncapped) — **file copies, not a deploy**. Catalog `role=` untouched. Author-date 2026-09-10 13:23 -0500. Co-authored-by Cursor.\n- `542bd09` Sync Nearmap — row 2. First published `data/nearmap/{id}.json` on `main` (`d9f759d7351db3886c79dd689c41e3c0`; 20 elements). Author-date 2026-09-10 14:01 -0500. `jonahbourgeois1`.\n- `c32f8a8` + `68961de` Sync Nearmap — row 2 again (14:06 and 14:28 -0500). Empty: same tree as `542bd09`. HEAD.\n\nElement-review remains **v6.8.20**. Golf remains **v1.0.4**. No satellite/plane/drone Sync/Publish.\n\n### Still open\n- Chat direction still not visible in the Log Bot environment (`list-cloud-agents` desktop/web/local sources returned 0).\n- Daily log PRs **#1** (`ops: daily log 2026-08-27`), **#3** (`ops: daily log 2026-08-28`), **#4** (`ops: daily log 2026-08-29`), **#5** (`ops: daily log 2026-08-30`), **#6** (`ops: daily log 2026-08-31`), **#7** (`ops: daily log 2026-09-01`), **#8** (`ops: daily log 2026-09-02`), **#9** (`ops: daily log 2026-09-03`), **#10** (`ops: daily log 2026-09-04`), **#11** (`ops: daily log 2026-09-05`), **#12** (`ops: daily log 2026-09-06`), **#13** (`ops: daily log 2026-09-07`), **#14** (`ops: daily log 2026-09-08`), **#15** (`ops: daily log 2026-09-09`), and **#16** (`ops: daily log 2026-09-10`) are still DRAFT; `docs/ops/` is not on `main`.\n- Nearmap `nearmap.gs` / `config.gs` / `menu.gs` copies are on `main`; paste + new deployment and S3 edits write (`checkS3EditsWrite`) are not evidenced in this clone. Published `data/nearmap/{id}.json` now exists (row 2, one file).\n\n### Watchouts\n- Apps Script editor-save is not a new deployment. `.gs` copies today (`nearmap.gs` in `7dd6050`/`4937ac0`, `config.gs` in `4937ac0`) are not a deploy. `satellite.gs` last copy remains `d688a65`; MOCKINGBIRD row 277 is the first check after a real deploy.\n- Public `data/*.json` is sync-owned. Last Sync/Publish on `origin/main` is `68961de` Sync Nearmap — row 2 (empty tree after `542bd09` wrote the record). No satellite/plane/drone `data/` sync. Recount: satellite 506, plane 22, drone 128, drone-test 2, Lane 332 tiles, gis 3, hoa 5, responder-drone 131, nearmap 1.\n- Catalog `role=` still present on all 256 pins after `06c9714` (195 primary, 61 concern); do not flatten it. Golf catalog is a separate Golf Pins sheet (ids 1001+); the `golf.gs` header says never merge it into `pins-catalog.json`.\n\n## 2026-09-10\n\nNo author-date 2026-09-10 commits on `origin/main`. Head is `c925508` (2026-09-09 18:10 -0500). Yesterday's 00:04 UTC log (draft PR **#15**, `cursor/property-intel-daily-log-04fc`, `6382d09`) stopped at `949f6d6` and recorded nothing shipped on 9/09; the 28 commits below landed after that cron (one author-date 2026-09-08 that was not on `origin/main` at the 9/09 cron, then 27 author-date 2026-09-09).\n\nLog Bot cron `41611cd5-a0bb-11f1-b532-320a589b8025` at 2026-09-10T00:04:11Z (`bc-db7958ae`). Template still says v2/master; this clone is public v1. CHANGELOG/CONTEXT and `property-intel-v2` are not in this clone (`property-intel-v2` 404). `list-cloud-agents` listed this cron plus prior Log Bot runs (9/09 `bc-134f8307`, 9/08 `bc-bbc69d44`, 9/07 `bc-cd56ff85`, 9/06 `bc-34e087f8`, 9/05 `bc-5c01f7f0`, 9/04 `bc-7fb90f35`, 9/03 `bc-b1bc2328`, 9/02 `bc-7de4187d`, 9/01 `bc-76a61999`, 8/31 `bc-f631c354`, 8/30 `bc-eb481f27`, 8/29 `bc-8dc1a78f`, 8/28 `bc-ede78703`, 8/27 `bc-d4995744`, 8/26 `bc-45e4c56a`) and three internal agents (\"Search 8/28 transcript for dashboard\", \"Find original ops dashboard schema\", \"Summarize yesterday log bot\"). Desktop/web/local sources returned 0.\n\n### Shipped\n- `f2c9c34` Show the Nearmap map before AI polygons so the review page opens reliably. `nearmap-review.html` BUILD **v1.2.1**. Author-date 2026-09-08 09:29 -0500. Not on `origin/main` at the 9/09 cron. Co-authored-by Cursor.\n- `413b886` Draw-only paint/erase on vendor regions; original/edits folders; testing-mode default. BUILD **v1.3.29**. First `apps scripts/nearmap.gs` copy, `data/nearmap/.gitkeep`, and `tools/nearmap/*`. **File copy, not a deploy.** Author-date 2026-09-09 12:13 -0500.\n- `3250ab7` Sheet mode on the original/edits folder format. BUILD **v1.4.0**.\n- `83dcac7` Pin at the interior point of irregular shapes. BUILD **v1.4.1**.\n- `8c8f5c5` Two editors on one page (regions / pins). BUILD **v1.5.0**. Also copied `menu.gs`.\n- `dd7d539` Regions edits push via Contents API with real error text; single-flight Save. BUILD **v1.5.1**.\n- `fed22d4` Save retries once on an Apps Script HTML error page. BUILD **v1.5.2**.\n- `c5a0485` Copy JSON is mode-aware. BUILD **v1.5.3**.\n- `786c251` + `926ba98` Nearmap regions — site VY-IN-002 (1 changed, 15 removed). Transient `data/nearmap/edits/` JSON; later removed.\n- `c73442d` Regions edits go Apps Script → S3; GitHub out of the regions path. BUILD **v1.6.0**. Deletes `data/nearmap/edits/`.\n- `caa39b5` Pin at the deepest interior point (max edge clearance). BUILD **v1.6.1**.\n- `16ac486` … `54d0c8b` Hole geometry and gap-close (`v1.6.2`–`v1.6.11`). HEAD review BUILD **v1.6.11** (Revert changes vs Revert to original).\n- `51dc3d5` Nearmap viewer **v1.0.0** (2D / 3D / obliques, AI layers in both) + `tools/nearmap/mesh_to_glb.py`. More `nearmap.gs` / `menu.gs` copies — **not a deploy**.\n- `2d26d36` Viewer **v1.0.1**: 3D camera/controls match model-viewer.\n- `ce346ce` Viewer **v1.0.2**: re-read regions on tab focus and Reload.\n- `c45d69c` Viewer **v1.0.3**: 3D fills cap the whole footprint like 2D.\n- `5e36083` Put Nearmap in the Vyanet hub with draped 3D fills. Hub **1.8.15**.\n- `c925508` Open Nearmap full-page from the hub; drop Property Facts from that rail. Hub **1.8.16**; `nearmap-viewer.html` BUILD **v1.1.2**. HEAD.\n\nElement-review remains **v6.8.20**. Golf remains **v1.0.4**. No Sync/Publish satellite/plane/drone commits. Viewer commits are Co-authored-by Cursor; the two VY-IN-002 regions commits are `jonahbourgeois1`.\n\n### Still open\n- Chat direction still not visible in the Log Bot environment (`list-cloud-agents` desktop/web/local sources returned 0).\n- Daily log PRs **#1** (`ops: daily log 2026-08-27`), **#3** (`ops: daily log 2026-08-28`), **#4** (`ops: daily log 2026-08-29`), **#5** (`ops: daily log 2026-08-30`), **#6** (`ops: daily log 2026-08-31`), **#7** (`ops: daily log 2026-09-01`), **#8** (`ops: daily log 2026-09-02`), **#9** (`ops: daily log 2026-09-03`), **#10** (`ops: daily log 2026-09-04`), **#11** (`ops: daily log 2026-09-05`), **#12** (`ops: daily log 2026-09-06`), **#13** (`ops: daily log 2026-09-07`), **#14** (`ops: daily log 2026-09-08`), and **#15** (`ops: daily log 2026-09-09`) are still DRAFT; `docs/ops/` is not on `main`.\n- Nearmap `nearmap.gs` / `menu.gs` copies are on `main`; paste + new deployment, S3 edits write (`checkS3EditsWrite`), and published `data/nearmap/{id}.json` are not evidenced in this clone.\n\n### Watchouts\n- Apps Script editor-save is not a new deployment. `.gs` copies today (`nearmap.gs`, `menu.gs`) are not a deploy. `satellite.gs` last copy remains `d688a65`; MOCKINGBIRD row 277 is the first check after a real deploy.\n- Public `data/*.json` is sync-owned. Last Sync/Publish on `origin/main` is `187a608` Sync Drone (2026-08-28). Transient Nearmap edits JSON for VY-IN-002 was added then deleted in `c73442d` (S3-only). HEAD `data/nearmap/` is only `.gitkeep`. Recount: satellite 506, plane 22, drone 128, drone-test 2, Lane 332 tiles, gis 3.\n- Catalog `role=` still present on all 256 pins after `06c9714` (195 primary, 61 concern); do not flatten it. Golf catalog is a separate Golf Pins sheet (ids 1001+); the `golf.gs` header says never merge it into `pins-catalog.json`.\n\n## 2026-09-09\n\nNothing shipped today on `origin/main`. Head remains `949f6d6` (2026-09-07 12:29 -0500).\n\nLog Bot cron `41611cd5-a0bb-11f1-b532-320a589b8025` at 2026-09-09T00:04:42Z (`bc-134f8307`). Yesterday's 00:03 UTC log (draft PR **#14**, `cursor/property-intel-daily-log-6e97`, `0921740`) already recorded `origin/main` at `949f6d6` and the two Nearmap ships after the 9/07 cron. No author-date 2026-09-08 or 2026-09-09 commits on `origin/main`. The only git event after that log is `0921740` `ops: daily log 2026-09-08` on draft PR **#14** — not on `main`. Template still says v2/master; this clone is public v1. CHANGELOG/CONTEXT and `property-intel-v2` are not in this clone (`property-intel-v2` 404). `list-cloud-agents` listed this cron plus prior Log Bot runs (9/08 `bc-bbc69d44`, 9/07 `bc-cd56ff85`, 9/06 `bc-34e087f8`, 9/05 `bc-5c01f7f0`, 9/04 `bc-7fb90f35`, 9/03 `bc-b1bc2328`, 9/02 `bc-7de4187d`, 9/01 `bc-76a61999`, 8/31 `bc-f631c354`, 8/30 `bc-eb481f27`, 8/29 `bc-8dc1a78f`, 8/28 `bc-ede78703`, 8/27 `bc-d4995744`, 8/26 `bc-45e4c56a`) and three internal agents (\"Search 8/28 transcript for dashboard\", \"Find original ops dashboard schema\", \"Summarize yesterday log bot\"). Desktop/web/local sources returned 0.\n\n### Shipped\nNone on 2026-09-09.\n\n### Still open\n- Chat direction still not visible in the Log Bot environment (`list-cloud-agents` desktop/web/local sources returned 0).\n- Daily log PRs **#1** (`ops: daily log 2026-08-27`), **#3** (`ops: daily log 2026-08-28`), **#4** (`ops: daily log 2026-08-29`), **#5** (`ops: daily log 2026-08-30`), **#6** (`ops: daily log 2026-08-31`), **#7** (`ops: daily log 2026-09-01`), **#8** (`ops: daily log 2026-09-02`), **#9** (`ops: daily log 2026-09-03`), **#10** (`ops: daily log 2026-09-04`), **#11** (`ops: daily log 2026-09-05`), **#12** (`ops: daily log 2026-09-06`), **#13** (`ops: daily log 2026-09-07`), and **#14** (`ops: daily log 2026-09-08`) are still DRAFT; `docs/ops/` is not on `main`.\n- Nearmap trial: review page is on `main`; Apps Script paste/deploy, Pass 1, and `data/nearmap/{id}.json` sync are not evidenced in this clone (`docs/NEARMAP_CHANGELOG.md` Status lines still list those as operator steps).\n\n### Watchouts\n- Apps Script editor-save is not a new deployment. No `.gs` copies and no `satellite.gs` deploy evidence today; MOCKINGBIRD row 277 is the first check after a real deploy.\n- Public `data/*.json` is sync-owned. Last Sync/Publish on `origin/main` is `187a608` Sync Drone (2026-08-28). No satellite/plane/drone/nearmap `data/` sync after yesterday's log. Head still has the three `data/gis/{id}.json` files from `4b35668`. No `data/nearmap/` records.\n- Catalog `role=` still present on all 256 pins after `06c9714` (195 primary, 61 concern); do not flatten it. Golf catalog is a separate Golf Pins sheet (ids 1001+); the `golf.gs` header says never merge it into `pins-catalog.json`.\n\n## 2026-09-08\n\nNo author-date 2026-09-08 commits on `origin/main`. Head is `949f6d6` (2026-09-07 12:29 -0500). Yesterday's 00:03 UTC log (draft PR **#13**, `cursor/property-intel-daily-log-e481`) stopped at `da8dedf` and recorded nothing shipped on 9/07; the two commits below landed after that cron.\n\nLog Bot cron `41611cd5-a0bb-11f1-b532-320a589b8025` at 2026-09-08T00:01:26Z (`bc-bbc69d44`). Template still says v2/master; this clone is public v1. CHANGELOG/CONTEXT and `property-intel-v2` are not in this clone (`property-intel-v2` 404). `list-cloud-agents` listed this cron plus prior Log Bot runs (9/07 `bc-cd56ff85`, 9/06 `bc-34e087f8`, 9/05 `bc-5c01f7f0`, 9/04 `bc-7fb90f35`, 9/03 `bc-b1bc2328`, 9/02 `bc-7de4187d`, 9/01 `bc-76a61999`, 8/31 `bc-f631c354`, 8/30 `bc-eb481f27`, 8/29 `bc-8dc1a78f`, 8/28 `bc-ede78703`, 8/27 `bc-d4995744`, 8/26 `bc-45e4c56a`) and three internal agents (\"Search 8/28 transcript for dashboard\", \"Find original ops dashboard schema\", \"Summarize yesterday log bot\"). Desktop/web/local sources returned 0.\n\n### Shipped\n- `8be883d` Publish `nearmap-review.html` so GitHub Pages can serve Nearmap Pass 1 QA. BUILD **v1.0.1**. Isolated trial page (sibling of golf-review / element-review; not on VIEW_ORDER). Author-date 2026-09-07 11:29 -0500. Co-authored-by Cursor.\n- `949f6d6` Per-layer Nearmap AI colors and hint centroids on the review page. `nearmap-review.html` BUILD **v1.2.0** (no v1.1.0 commit on main). Same commit added `docs/NEARMAP_CHANGELOG.md`. Author-date 2026-09-07 12:29 -0500. Co-authored-by Cursor.\n\nNeither commit touched `apps scripts/`, `data/`, element-review, golf-review, or the hub. Hub remains **1.8.14**. ER remains **v6.8.20**. Golf remains **v1.0.4**. No Sync/Publish satellite/plane/drone commits. `nearmap.gs` is not in this clone; `data/nearmap/` has no published JSON.\n\n### Still open\n- Chat direction still not visible in the Log Bot environment (`list-cloud-agents` desktop/web/local sources returned 0).\n- Daily log PRs **#1** (`ops: daily log 2026-08-27`), **#3** (`ops: daily log 2026-08-28`), **#4** (`ops: daily log 2026-08-29`), **#5** (`ops: daily log 2026-08-30`), **#6** (`ops: daily log 2026-08-31`), **#7** (`ops: daily log 2026-09-01`), **#8** (`ops: daily log 2026-09-02`), **#9** (`ops: daily log 2026-09-03`), **#10** (`ops: daily log 2026-09-04`), **#11** (`ops: daily log 2026-09-05`), **#12** (`ops: daily log 2026-09-06`), and **#13** (`ops: daily log 2026-09-07`) are still DRAFT; `docs/ops/` is not on `main`.\n- Nearmap trial: review page is on `main`; Apps Script paste/deploy, Pass 1, and `data/nearmap/{id}.json` sync are not evidenced in this clone (`docs/NEARMAP_CHANGELOG.md` Status lines still list those as operator steps).\n\n### Watchouts\n- Apps Script editor-save is not a new deployment. No `.gs` copies and no `satellite.gs` deploy evidence today; MOCKINGBIRD row 277 is the first check after a real deploy.\n- Public `data/*.json` is sync-owned. Last Sync/Publish on `origin/main` is `187a608` Sync Drone (2026-08-28). The two Nearmap commits did not touch `data/`. Head still has the three `data/gis/{id}.json` files from `4b35668`. No `data/nearmap/` records.\n- Catalog `role=` still present on all 256 pins after `06c9714` (195 primary, 61 concern); do not flatten it. Golf catalog is a separate Golf Pins sheet (ids 1001+); the `golf.gs` header says never merge it into `pins-catalog.json`.\n\n## 2026-09-07\n\nNothing shipped today on `origin/main`. Head remains `da8dedf` (2026-09-02 16:43 -0500).\n\nLog Bot cron `41611cd5-a0bb-11f1-b532-320a589b8025` at 2026-09-07T00:03:55Z (`bc-cd56ff85`). Yesterday's 00:16 UTC log (draft PR **#12**, `cursor/bc-34e087f8-2e0e-4559-8504-282e90c95654-84fb`, `3c89fa4`) already recorded `origin/main` at `da8dedf`. No author-date 2026-09-03 through 2026-09-07 commits on `origin/main`. The only git event after that log is `3c89fa4` `ops: daily log 2026-09-06` on draft PR **#12** — not on `main`. ISO week rolled to **2026-W37** (empty shipped). Template still says v2/master; this clone is public v1. CHANGELOG/CONTEXT and `property-intel-v2` are not in this clone (`property-intel-v2` 404). `list-cloud-agents` listed this cron plus prior Log Bot runs (9/06 `bc-34e087f8`, 9/05 `bc-5c01f7f0`, 9/04 `bc-7fb90f35`, 9/03 `bc-b1bc2328`, 9/02 `bc-7de4187d`, 9/01 `bc-76a61999`, 8/31 `bc-f631c354`, 8/30 `bc-eb481f27`, 8/29 `bc-8dc1a78f`, 8/28 `bc-ede78703`, 8/27 `bc-d4995744`, 8/26 `bc-45e4c56a`) and three internal agents (\"Search 8/28 transcript for dashboard\", \"Find original ops dashboard schema\", \"Summarize yesterday log bot\"). Desktop/web/local sources returned 0.\n\n### Shipped\nNone on 2026-09-07.\n\n### Still open\n- Chat direction still not visible in the Log Bot environment (`list-cloud-agents` desktop/web/local sources returned 0).\n- Daily log PRs **#1** (`ops: daily log 2026-08-27`), **#3** (`ops: daily log 2026-08-28`), **#4** (`ops: daily log 2026-08-29`), **#5** (`ops: daily log 2026-08-30`), **#6** (`ops: daily log 2026-08-31`), **#7** (`ops: daily log 2026-09-01`), **#8** (`ops: daily log 2026-09-02`), **#9** (`ops: daily log 2026-09-03`), **#10** (`ops: daily log 2026-09-04`), **#11** (`ops: daily log 2026-09-05`), and **#12** (`ops: daily log 2026-09-06`) are still DRAFT; `docs/ops/` is not on `main`.\n\n### Watchouts\n- Apps Script editor-save is not a new deployment. No `.gs` copies and no `satellite.gs` deploy evidence today; MOCKINGBIRD row 277 is the first check after a real deploy.\n- Public `data/*.json` is sync-owned. Last Sync/Publish on `origin/main` is `187a608` Sync Drone (2026-08-28). No satellite/plane/drone `data/` sync after yesterday's log. Head still has the three `data/gis/{id}.json` files from `4b35668`.\n- Catalog `role=` still present on all 256 pins after `06c9714` (195 primary, 61 concern); do not flatten it. Golf catalog is a separate Golf Pins sheet (ids 1001+); the `golf.gs` header says never merge it into `pins-catalog.json`.\n\n## 2026-09-06\n\nNothing shipped today on `origin/main`. Head remains `da8dedf` (2026-09-02 16:43 -0500).\n\nLog Bot cron `41611cd5-a0bb-11f1-b532-320a589b8025` at 2026-09-06T00:16:03Z (`bc-34e087f8`). Yesterday's 00:07 UTC log (draft PR **#11**, `cursor/property-intel-daily-log-5d78`, `f057564`) already recorded `origin/main` at `da8dedf`. No author-date 2026-09-03, 2026-09-04, 2026-09-05, or 2026-09-06 commits on `origin/main`. The only git event after that log is `f057564` `ops: daily log 2026-09-05` on draft PR **#11** — not on `main`. Template still says v2/master; this clone is public v1. CHANGELOG/CONTEXT and `property-intel-v2` are not in this clone (`property-intel-v2` 404). `list-cloud-agents` listed this cron plus prior Log Bot runs (9/05 `bc-5c01f7f0`, 9/04 `bc-7fb90f35`, 9/03 `bc-b1bc2328`, 9/02 `bc-7de4187d`, 9/01 `bc-76a61999`, 8/31 `bc-f631c354`, 8/30 `bc-eb481f27`, 8/29 `bc-8dc1a78f`, 8/28 `bc-ede78703`, 8/27 `bc-d4995744`, 8/26 `bc-45e4c56a`) and three internal agents (\"Search 8/28 transcript for dashboard\", \"Find original ops dashboard schema\", \"Summarize yesterday log bot\"). Desktop/web/local sources returned 0.\n\n### Shipped\nNone on 2026-09-06.\n\n### Still open\n- Chat direction still not visible in the Log Bot environment (`list-cloud-agents` desktop/web/local sources returned 0).\n- Daily log PRs **#1** (`ops: daily log 2026-08-27`), **#3** (`ops: daily log 2026-08-28`), **#4** (`ops: daily log 2026-08-29`), **#5** (`ops: daily log 2026-08-30`), **#6** (`ops: daily log 2026-08-31`), **#7** (`ops: daily log 2026-09-01`), **#8** (`ops: daily log 2026-09-02`), **#9** (`ops: daily log 2026-09-03`), **#10** (`ops: daily log 2026-09-04`), and **#11** (`ops: daily log 2026-09-05`) are still DRAFT; `docs/ops/` is not on `main`.\n\n### Watchouts\n- Apps Script editor-save is not a new deployment. No `.gs` copies and no `satellite.gs` deploy evidence today; MOCKINGBIRD row 277 is the first check after a real deploy.\n- Public `data/*.json` is sync-owned. Last Sync/Publish on `origin/main` is `187a608` Sync Drone (2026-08-28). No satellite/plane/drone `data/` sync after yesterday's log. Head still has the three `data/gis/{id}.json` files from `4b35668`.\n- Catalog `role=` still present on all 256 pins after `06c9714` (195 primary, 61 concern); do not flatten it. Golf catalog is a separate Golf Pins sheet (ids 1001+); the `golf.gs` header says never merge it into `pins-catalog.json`.\n\n## 2026-09-05\n\nNothing shipped today on `origin/main`. Head remains `da8dedf` (2026-09-02 16:43 -0500).\n\nLog Bot cron `41611cd5-a0bb-11f1-b532-320a589b8025` at 2026-09-05T00:07:22Z (`bc-5c01f7f0`). Yesterday's 00:04 UTC log (draft PR **#10**, `cursor/property-intel-daily-log-b7f8`, `2f04aa1`) already recorded `origin/main` at `da8dedf`. No author-date 2026-09-03, 2026-09-04, or 2026-09-05 commits on `origin/main`. The only git event after that log is `2f04aa1` `ops: daily log 2026-09-04` on draft PR **#10** — not on `main`. Template still says v2/master; this clone is public v1. CHANGELOG/CONTEXT and `property-intel-v2` are not in this clone (`property-intel-v2` 404). `list-cloud-agents` listed this cron plus prior Log Bot runs (9/04 `bc-7fb90f35`, 9/03 `bc-b1bc2328`, 9/02 `bc-7de4187d`, 9/01 `bc-76a61999`, 8/31 `bc-f631c354`, 8/30 `bc-eb481f27`, 8/29 `bc-8dc1a78f`, 8/28 `bc-ede78703`, 8/27 `bc-d4995744`, 8/26 `bc-45e4c56a`) and three internal agents (\"Search 8/28 transcript for dashboard\", \"Find original ops dashboard schema\", \"Summarize yesterday log bot\"). Desktop/web/local sources returned 0.\n\n### Shipped\nNone on 2026-09-05.\n\n### Still open\n- Chat direction still not visible in the Log Bot environment (`list-cloud-agents` desktop/web/local sources returned 0).\n- Daily log PRs **#1** (`ops: daily log 2026-08-27`), **#3** (`ops: daily log 2026-08-28`), **#4** (`ops: daily log 2026-08-29`), **#5** (`ops: daily log 2026-08-30`), **#6** (`ops: daily log 2026-08-31`), **#7** (`ops: daily log 2026-09-01`), **#8** (`ops: daily log 2026-09-02`), **#9** (`ops: daily log 2026-09-03`), and **#10** (`ops: daily log 2026-09-04`) are still DRAFT; `docs/ops/` is not on `main`.\n\n### Watchouts\n- Apps Script editor-save is not a new deployment. No `.gs` copies and no `satellite.gs` deploy evidence today; MOCKINGBIRD row 277 is the first check after a real deploy.\n- Public `data/*.json` is sync-owned. Last Sync/Publish on `origin/main` is `187a608` Sync Drone (2026-08-28). No satellite/plane/drone `data/` sync after yesterday's log. Head still has the three `data/gis/{id}.json` files from `4b35668`.\n- Catalog `role=` still present on all 256 pins after `06c9714` (195 primary, 61 concern); do not flatten it. Golf catalog is a separate Golf Pins sheet (ids 1001+); the `golf.gs` header says never merge it into `pins-catalog.json`.\n\n## 2026-09-04\n\nNothing shipped today on `origin/main`. Head remains `da8dedf` (2026-09-02 16:43 -0500).\n\nLog Bot cron `41611cd5-a0bb-11f1-b532-320a589b8025` at 2026-09-04T00:04:43Z (`bc-7fb90f35`). Yesterday's 00:03 UTC log (draft PR **#9**, `cursor/property-intel-daily-log-4466`, `a83c8fd`) already recorded `origin/main` at `da8dedf` and the seven ships after the 9/02 cron. No author-date 2026-09-03 or 2026-09-04 commits on `origin/main`. The only git event after that log is `a83c8fd` `ops: daily log 2026-09-03` on draft PR **#9** — not on `main`. Template still says v2/master; this clone is public v1. CHANGELOG/CONTEXT and `property-intel-v2` are not in this clone (`property-intel-v2` 404). `list-cloud-agents` listed this cron plus prior Log Bot runs (9/03 `bc-b1bc2328`, 9/02 `bc-7de4187d`, 9/01 `bc-76a61999`, 8/31 `bc-f631c354`, 8/30 `bc-eb481f27`, 8/29 `bc-8dc1a78f`, 8/28 `bc-ede78703`, 8/27 `bc-d4995744`, 8/26 `bc-45e4c56a`) and three internal agents (\"Search 8/28 transcript for dashboard\", \"Find original ops dashboard schema\", \"Summarize yesterday log bot\"). Desktop/web/local sources returned 0.\n\n### Shipped\nNone on 2026-09-04.\n\n### Still open\n- Chat direction still not visible in the Log Bot environment (`list-cloud-agents` desktop/web/local sources returned 0).\n- Daily log PRs **#1** (`ops: daily log 2026-08-27`), **#3** (`ops: daily log 2026-08-28`), **#4** (`ops: daily log 2026-08-29`), **#5** (`ops: daily log 2026-08-30`), **#6** (`ops: daily log 2026-08-31`), **#7** (`ops: daily log 2026-09-01`), **#8** (`ops: daily log 2026-09-02`), and **#9** (`ops: daily log 2026-09-03`) are still DRAFT; `docs/ops/` is not on `main`.\n\n### Watchouts\n- Apps Script editor-save is not a new deployment. No `.gs` copies and no `satellite.gs` deploy evidence today; MOCKINGBIRD row 277 is the first check after a real deploy.\n- Public `data/*.json` is sync-owned. Last Sync/Publish on `origin/main` is `187a608` Sync Drone (2026-08-28). No satellite/plane/drone `data/` sync after yesterday's log. Head still has the three `data/gis/{id}.json` files from `4b35668`.\n- Catalog `role=` still present on all 256 pins after `06c9714` (195 primary, 61 concern); do not flatten it. Golf catalog is a separate Golf Pins sheet (ids 1001+); the `golf.gs` header says never merge it into `pins-catalog.json`.\n\n## 2026-09-03\n\nNo author-date 2026-09-03 commits on `origin/main`. Head is `da8dedf` (2026-09-02 16:43 -0500). Yesterday's 00:01 UTC log (draft PR **#8**, `cursor/property-intel-daily-log-3473`) stopped at `8b1d0d4` and recorded no author-date 2026-09-02 commits; the seven commits below landed after that cron.\n\nLog Bot cron `41611cd5-a0bb-11f1-b532-320a589b8025` at 2026-09-03T00:03:15Z (`bc-b1bc2328`). Template still says v2/master; this clone is public v1. CHANGELOG/CONTEXT and `property-intel-v2` are not in this clone (`property-intel-v2` 404). `list-cloud-agents` listed this cron plus prior Log Bot runs (9/02 `bc-7de4187d`, 9/01 `bc-76a61999`, 8/31 `bc-f631c354`, 8/30 `bc-eb481f27`, 8/29 `bc-8dc1a78f`, 8/28 `bc-ede78703`, 8/27 `bc-d4995744`, 8/26 `bc-45e4c56a`) and three internal agents (\"Search 8/28 transcript for dashboard\", \"Find original ops dashboard schema\", \"Summarize yesterday log bot\"). Desktop/web/local sources returned 0.\n\n### Shipped\n- `d688a65` Pin identity is the marker number, not catalog id, so duplicate pins survive moves and removes. `element-review.html` BUILD **v6.8.11 → v6.8.13** (no v6.8.12 commit on main). Same commit copied `apps scripts/critique-api.gs` and `satellite.gs` — **file copies, not a deploy**. Author-date 2026-09-01 19:02 -0500 (2026-09-02T00:02:30Z, after yesterday's cron start).\n- `be175c0` Surface a stale server build on submit (min v6.8.2 for duplicate-pin identity). `element-review.html` BUILD **v6.8.14**. Author-date 2026-09-01 19:12 -0500.\n- `4987718` Fifth reviewer **DPC Prime** in the dropdown; `sandbox=1` routes GET/POST to Satellite Sandbox + Element Critique Sandbox (header dates this to v6.8.15; BUILD on the commit is **v6.8.17** — no v6.8.15/v6.8.16 commits on main). Author-date 2026-09-02 16:02 -0500.\n- `f1b002d` Rename the fifth reviewer to **DPC:** so the label matches the critique sheet. BUILD **v6.8.18**. Author-date 2026-09-02 16:11 -0500.\n- `6252628` Rename the fifth reviewer to **DPC'** (apostrophe, not a colon). BUILD **v6.8.19**. Author-date 2026-09-02 16:13 -0500.\n- `4b35668` Hub **1.8.14**: known GIS property facts on the Private rail (`js/vyanet-viewer/gis-facts.js`; assessor, DOGAMI, fire, flood, WUI). Three `data/gis/{id}.json` files plus `data/gis/.gitkeep`. Contract writer is Apps Script `gisFileForSync_` — not a Sync/Publish commit. Also updated `docs/INDEX_AND_CAMERAS_CONTRACT.md`, fixtures, `vyanet-viewer.html`, `viewer.html`, `model-viewer.html`, `test-vyanet-viewer.py`, and copied `apps scripts/shared.gs` — **file copy, not a deploy**. Author-date 2026-09-02 16:22 -0500.\n- `da8dedf` \"Show pins\" dropdown so reviewers can compare Bedrock and prior rounds. `element-review.html` BUILD **v6.8.20**. Same commit copied `apps scripts/critique-api.gs` — **file copy, not a deploy**. Author-date 2026-09-02 16:43 -0500.\n\nGolf remains **v1.0.4**. No Sync/Publish satellite/plane/drone commits. All seven Co-authored-by Cursor.\n\n### Still open\n- Chat direction still not visible in the Log Bot environment (`list-cloud-agents` desktop/web/local sources returned 0).\n- Daily log PRs **#1** (`ops: daily log 2026-08-27`), **#3** (`ops: daily log 2026-08-28`), **#4** (`ops: daily log 2026-08-29`), **#5** (`ops: daily log 2026-08-30`), **#6** (`ops: daily log 2026-08-31`), **#7** (`ops: daily log 2026-09-01`), and **#8** (`ops: daily log 2026-09-02`) are still DRAFT; `docs/ops/` is not on `main`.\n\n### Watchouts\n- Apps Script editor-save is not a new deployment. `.gs` copies in git today (`satellite.gs` + `critique-api.gs` in `d688a65`, `shared.gs` in `4b35668`, `critique-api.gs` in `da8dedf`) are not a deploy. `satellite.gs` changed in `d688a65`; MOCKINGBIRD row 277 is the first check after a real deploy.\n- Public `data/*.json` is sync-owned. Last Sync/Publish on `origin/main` is `187a608` Sync Drone (2026-08-28). `4b35668` added three `data/gis/{id}.json` files (GIS facts panel; writer `gisFileForSync_`). No satellite/plane/drone `data/` sync.\n- Catalog `role=` still present on all 256 pins after `06c9714` (195 primary, 61 concern); do not flatten it. Golf catalog is a separate Golf Pins sheet (ids 1001+); the `golf.gs` header says never merge it into `pins-catalog.json`.\n\n## 2026-09-02\n\nNo author-date 2026-09-02 commits on `origin/main`. Head is `8b1d0d4` (2026-09-01 18:06 -0500). Yesterday's 00:06 UTC log (`74df029` on draft PR **#7**) stopped at `064658b` and recorded no author-date 2026-09-01 commits; the five commits below landed after that cron.\n\nLog Bot cron `41611cd5-a0bb-11f1-b532-320a589b8025` at 2026-09-02T00:01:16Z (`bc-7de4187d`). Template still says v2/master; this clone is public v1. CHANGELOG/CONTEXT and `property-intel-v2` are not in this clone (`property-intel-v2` 404). `list-cloud-agents` listed this cron plus prior Log Bot runs (9/01 `bc-76a61999`, 8/31 `bc-f631c354`, 8/30 `bc-eb481f27`, 8/29 `bc-8dc1a78f`, 8/28 `bc-ede78703`, 8/27 `bc-d4995744`, 8/26 `bc-45e4c56a`) and three internal agents (\"Search 8/28 transcript for dashboard\", \"Find original ops dashboard schema\", \"Summarize yesterday log bot\"). Desktop/web/local sources returned 0.\n\n### Shipped\n- `a8b3ceb` Sheet-only golf review pipeline: `golf-review.html` BUILD **v1.0.0**, plus copies of `apps scripts/golf.gs`, `config.gs`, `menu.gs`, and `critique-api.gs`. Golf courses skip the satellite nadir screenshot and Bedrock pass; reviewers place an independent catalog (seed ids 1001–1150, 150 pins; `GOLF_MAX_PINS = 200` in the `config.gs` copy) as `{id, lat, lng}` on a live map and save only to the Golf tab. Publish (`data/golf/`) is out of scope in the `golf.gs` header. **File copies, not an Apps Script deployment.** Author-date 2026-09-01 13:19 -0500.\n- `30d546a` Yellow nadir pin at the geocoded golf address; also apply Elements Reviewed checkboxes on an empty Golf tab. `golf-review.html` BUILD **v1.0.1**. Same commit copied `apps scripts/golf.gs`. Author-date 2026-09-01 13:39 -0500.\n- `de7ad60` Blue dot for the golf address and a spinner until map tiles load. `golf-review.html` BUILD **v1.0.2**. Author-date 2026-09-01 13:44 -0500.\n- `2617114` Golf map starts from URL `?lat=&lng=` instead of waiting on Apps Script. `golf-review.html` BUILD **v1.0.3**. Author-date 2026-09-01 17:11 -0500.\n- `8b1d0d4` Duplicate catalog pins stay separate instances when adding or dragging (a second Roof or Parking was matching on catalog id alone). `element-review.html` BUILD **v6.8.10 → v6.8.11**; `golf-review.html` BUILD **v1.0.4**. Same commit copied `apps scripts/critique-api.gs` and `satellite.gs` — **file copies, not a deploy**. Author-date 2026-09-01 18:06 -0500.\n\nHub remains **1.8.13**. No `data/` sync commits. All five Co-authored-by Cursor.\n\n### Still open\n- Chat direction still not visible in the Log Bot environment (`list-cloud-agents` desktop/web/local sources returned 0).\n- Daily log PRs **#1** (`ops: daily log 2026-08-27`), **#3** (`ops: daily log 2026-08-28`), **#4** (`ops: daily log 2026-08-29`), **#5** (`ops: daily log 2026-08-30`), **#6** (`ops: daily log 2026-08-31`), and **#7** (`ops: daily log 2026-09-01`) are still DRAFT; `docs/ops/` is not on `main`.\n\n### Watchouts\n- Apps Script editor-save is not a new deployment. `.gs` copies in git today (`golf.gs`, `config.gs`, `menu.gs`, `critique-api.gs`, `satellite.gs`) are not a deploy. `satellite.gs` changed in `8b1d0d4`; MOCKINGBIRD row 277 is the first check after a real deploy.\n- Public `data/*.json` is sync-owned. Last sync on `origin/main` is `187a608` Sync Drone (2026-08-28). None of the five commits touched `data/`.\n- Catalog `role=` still present on all 256 pins after `06c9714` (195 primary, 61 concern); do not flatten it. Golf catalog is a separate Golf Pins sheet (ids 1001+); the `golf.gs` header says never merge it into `pins-catalog.json`.\n\n## 2026-09-01\n\nNo author-date 2026-09-01 commits on `origin/main`. Head is `064658b` (2026-08-31 12:19 -0500). Yesterday's 00:06 UTC log (`d046d39` on draft PR **#6**) stopped at `53346bd` and recorded nothing shipped on 8/31; the hub change below landed after that cron.\n\nLog Bot cron `41611cd5-a0bb-11f1-b532-320a589b8025` at 2026-09-01T00:03:44Z (`bc-76a61999`). Template still says v2/master; this clone is public v1. CHANGELOG/CONTEXT and `property-intel-v2` are not in this clone (`property-intel-v2` 404). `list-cloud-agents` listed this cron plus prior Log Bot runs (8/31 `bc-f631c354`, 8/30 `bc-eb481f27`, 8/29 `bc-8dc1a78f`, 8/28 `bc-ede78703`, 8/27 `bc-d4995744`, 8/26 `bc-45e4c56a`) and three internal agents (\"Summarize yesterday log bot\", \"Search 8/28 transcript for dashboard\", \"Find original ops dashboard schema\"). Desktop/web/local sources returned 0.\n\n### Shipped\n- `064658b` Hub **1.8.13**: property CHEKT moved under Private (nested 3D / 2D / Live / Plugins). Community gets its own Map / Live bar with an empty Community Live slot so neighborhood cameras can land later without sharing the property feed. `js/vyanet-viewer/property.js` `HUB_BUILD = '1.8.13'`. Same commit updated `vyanet-viewer.html`, `test-vyanet-viewer.py`, and `docs/INDEX_AND_CAMERAS_CONTRACT.md`. Co-authored-by Cursor. Author-date 2026-08-31 12:19 -0500.\n\nNot on `main`: 8/31 Log Bot follow-ups on draft PR **#6** (`4b4b06b`, `34d6a59`, `0d8fe5f`, `f69689d`) restyled `docs/ops/index.html` to the charcoal/gold board and put Daily log back under pipelines.\n\n### Still open\n- Chat direction still not visible in the Log Bot environment (`list-cloud-agents` desktop/web/local sources returned 0).\n- Daily log PRs **#1** (`ops: daily log 2026-08-27`), **#3** (`ops: daily log 2026-08-28`), **#4** (`ops: daily log 2026-08-29`), **#5** (`ops: daily log 2026-08-30`), and **#6** (`ops: daily log 2026-08-31`) are still DRAFT; `docs/ops/` is not on `main`.\n\n### Watchouts\n- Apps Script editor-save is not a new deployment. No `.gs` copies and no `satellite.gs` deploy evidence today; MOCKINGBIRD row 277 is the first check after a real deploy.\n- Public `data/*.json` is sync-owned. No sync commits on `main` since `187a608` (2026-08-28). `064658b` did not touch `data/`.\n- Catalog `role=` still present on all 256 pins after `06c9714` (195 primary, 61 concern); do not flatten it.\n\n## 2026-08-31\n\nNothing shipped today on `origin/main`. Head remains `53346bd` (2026-08-28 16:22 -0500).\n\nLog Bot cron `41611cd5-a0bb-11f1-b532-320a589b8025` at 2026-08-31T00:04:39Z (`bc-f631c354`). Yesterday's 00:23 UTC log already recorded that `origin/main` was still `53346bd`. No author-date 2026-08-29, 2026-08-30, or 2026-08-31 commits on `origin/main`. The only git event after that log is `7a40c02` `ops: daily log 2026-08-30` on draft PR **#5** (`cursor/property-intel-daily-log-3f6c`) — not on `main`. Template still says v2/master; this clone is public v1. CHANGELOG/CONTEXT and `property-intel-v2` are not in this clone (`property-intel-v2` 404). `list-cloud-agents` listed only Log Bot runs (this cron, 8/30 `bc-eb481f27`, 8/29 `bc-8dc1a78f`, 8/28 `bc-ede78703`, 8/27 `bc-d4995744`, 8/26 `bc-45e4c56a`) plus internal \"Summarize yesterday log bot\". Desktop/web/local sources returned 0.\n\n### Shipped\nNone on 2026-08-31.\n\n### Still open\n- Chat direction still not visible in the Log Bot environment (`list-cloud-agents` returned only Log Bot automations + one internal summarizer).\n- Daily log PRs **#1** (`ops: daily log 2026-08-27`), **#3** (`ops: daily log 2026-08-28`), **#4** (`ops: daily log 2026-08-29`), and **#5** (`ops: daily log 2026-08-30`) are still DRAFT; `docs/ops/` is not on `main`.\n\n### Watchouts\n- Apps Script editor-save is not a new deployment. No `.gs` copies and no `satellite.gs` deploy evidence today; MOCKINGBIRD row 277 is the first check after a real deploy.\n- Public `data/*.json` is sync-owned. No sync commits on `main` since yesterday's log.\n- Catalog `role=` still present on all 256 pins after `06c9714` (195 primary, 61 concern); do not flatten it.\n\n## 2026-08-30\n\nNothing shipped today on `origin/main`. Head remains `53346bd` (2026-08-28 16:22 -0500).\n\nLog Bot cron `41611cd5-a0bb-11f1-b532-320a589b8025` at 2026-08-30T00:20:58Z (`bc-eb481f27`). Yesterday's 00:16 UTC log already recorded the 8/28 afternoon work through `53346bd`. No author-date 2026-08-29 or 2026-08-30 commits on `origin/main`. The only git event after that log is `44da289` `ops: daily log 2026-08-29` on draft PR **#4** (`cursor/property-intel-daily-log-0704`) — not on `main`. Template still says v2/master; this clone is public v1. CHANGELOG/CONTEXT and `property-intel-v2` are not in this clone (`property-intel-v2` 404). `list-cloud-agents` listed only Log Bot runs (this cron, 8/29 `bc-8dc1a78f`, 8/28 `bc-ede78703`, 8/27 `bc-d4995744`, 8/26 `bc-45e4c56a`) plus internal \"Summarize yesterday log bot\". Desktop/web/local sources returned 0.\n\n### Shipped\nNone on 2026-08-30.\n\n### Still open\n- Chat direction still not visible in the Log Bot environment (`list-cloud-agents` returned only Log Bot automations + one internal summarizer).\n- Daily log PRs **#1** (`ops: daily log 2026-08-27`), **#3** (`ops: daily log 2026-08-28`), and **#4** (`ops: daily log 2026-08-29`) are still DRAFT; `docs/ops/` is not on `main`.\n\n### Watchouts\n- Apps Script editor-save is not a new deployment. No `.gs` copies and no `satellite.gs` deploy evidence today; MOCKINGBIRD row 277 is the first check after a real deploy.\n- Public `data/*.json` is sync-owned. No sync commits on `main` since yesterday's log.\n- Catalog `role=` still present on all 256 pins after `06c9714` (195 primary, 61 concern); do not flatten it.\n\n## 2026-08-29\n\nLog Bot cron `41611cd5-a0bb-11f1-b532-320a589b8025` at 2026-08-29T00:16:28Z (`bc-8dc1a78f`). Head of `origin/main` is `53346bd` (2026-08-28 16:22 -0500). Yesterday's 00:13 UTC log stopped at `606537c` and had no author-date 2026-08-28 commits; everything below is 2026-08-28 09:00–16:22 -0500. Template still says v2/master; this clone is public v1. CHANGELOG/CONTEXT and `property-intel-v2` are not in this clone (`property-intel-v2` 404). `list-cloud-agents` listed only Log Bot runs (this cron, 8/28 `bc-ede78703`, 8/27 `bc-d4995744`) plus internal \"Summarize yesterday log bot\".\n\n### Shipped\n- `53346bd` Hub **1.8.12**: Community iframe cache-bust so it drops the cached v2.3.4 `hoa-viewer`. `js/vyanet-viewer/property.js` `HUB_BUILD = '1.8.12'`.\n- `e3952cf` Community no longer fetches the deleted monolithic `data/index.json` (that 404 blanked the map). `hoa-viewer.html` loads each HOA member from `data/index/{id}.json` with satellite fallback.\n- `260c239` Match 2D camera pins to 3D: same popup, live LEDs, and 72-hour clip dots. Same commit set hub **1.8.11**, copied `apps scripts/shared.gs` (**file copy, not a deploy**), and deleted the duplicate Eugene cameras file `data/cameras/json/8eea64e5…` so HEAD has **2** camera json files.\n- `b44575a` Reviewers can pin outside the nadir crop (percentages may be <0 or >100) and open Google Earth from Element Review. `element-review.html` BUILD **v6.8.10**. Same commit copied `apps scripts/satellite.gs`, `plane.gs`, `drone-test.gs`, `critique-api.gs`, `shared.gs` — **file copies, not an Apps Script deployment**.\n- `cfde3ab` (merged `e4863fb`) Stop Lane road leftovers from painting as the property line (`nadir-geo.js` prefers `MAPTAXLOT` then `TAXLOT`).\n- Apps Script–style syncs on 8/28 (sync-owned `data/`): six `Publish Responder Intel — 1 property` (`ee91147` … `47def97`) and `187a608` Sync Drone (six `data/drone/{id}.json` plus index hubs).\n\nNot on HEAD: `100b135` added an on-page ER oblique pane (BUILD v6.8.11) and `0cf943b` reverted it the same afternoon; BUILD remains **v6.8.10**.\n\n### Still open\n- Chat direction still not visible in the Log Bot environment (`list-cloud-agents` returned only Log Bot automations + one internal summarizer).\n- Daily log PRs **#1** (`ops: daily log 2026-08-27`) and **#3** (`ops: daily log 2026-08-28`) are still DRAFT; `docs/ops/` is not on `main`.\n\n### Watchouts\n- Apps Script editor-save is not a new deployment. `.gs` copies in git (`satellite.gs` in `b44575a`, `shared.gs` in `b44575a` and `260c239`) are not a deploy. No `satellite.gs` deploy evidence today; MOCKINGBIRD row 277 is the first check after a real deploy.\n- Public `data/*.json` is sync-owned (six responder-intel publishes + Sync Drone + camera json delete/edit in `260c239`; next sync can overwrite).\n- Catalog `role=` still present on all 256 pins after `06c9714` (195 primary, 61 concern); do not flatten it.\n\n## 2026-08-28\n\nLog Bot cron `41611cd5-a0bb-11f1-b532-320a589b8025` at 2026-08-28T00:13:41Z. No commits with author date 2026-08-28. Head of `origin/main` is `606537c` (2026-08-27 16:53 -0500). Everything below landed after yesterday's 00:03 UTC log (author dates 2026-08-27 11:18–16:53 -0500). CHANGELOG/CONTEXT and `property-intel-v2` are not in this clone (`property-intel-v2` 404). `list-cloud-agents` listed only Log Bot runs (this cron, 8/27, 8/26) plus internal \"Summarize yesterday log bot\".\n\n### Shipped\n- `5c79788` merge of PR **#2** (`cursor/vyanet-viewer-gate-home`). Hub 1.6.4 lineage is on `main`. That branch has no commits not already on `main`.\n- `df985c1` Hub **1.7.3**: Eugene cameras on the live hub; four CHEKT feeds joined to stills. `js/vyanet-viewer/property.js` `HUB_BUILD = '1.7.3'`.\n- `9a754fb` Hub **1.7.2**: Eugene cameras, FR 3D pins, CHEKT live by address. Also copied `apps scripts/critique-api.gs`, `drone-test.gs`, `plane.gs`, `prompts.gs`, `shared.gs` — **file copies, not an Apps Script deployment**.\n- `6e693f0` + `11c0394`: Vyanet Eugene camera stills under `data/cameras/images/{id}/`; metadata settled at `data/cameras/json/{id}.json` (3 json files on HEAD).\n- `a302173` Redraw element-review pins immediately after rerun. `element-review.html` BUILD **v6.8.8**.\n- `9442d72` Drone-test element review georeferences CloudFront nadirs and identifies the row by taxlot.\n- `91556e6` Lane County lot-line tiles (`data/parcels/lane_*.geojson`, 332 files) and both-county grids in viewers.\n- `1f02d1b` Stop drawing the element-review pin-range box; allow reviewer duplicate pins; school cap **20** (`SCHOOL_PIN_LIMIT = 20`; `SAT_MAX_PINS` stays 12 in the `satellite.gs` copy). Same commit copied `apps scripts/satellite.gs` — **not a deploy**.\n- Apps Script–style syncs on 8/27 (sync-owned `data/`): six `Sync drone-test` (`e614910` … `0ef3f6f`) and `0b51828` Sync Row — Vyanet Eugene.\n\n### Still open\n- Chat direction still not visible in the Log Bot environment (`list-cloud-agents` returned only Log Bot automations + one internal summarizer).\n- Daily log PR **#1** (`ops: daily log 2026-08-27`, `cursor/property-intel-daily-log-4f45`) is still DRAFT; `docs/ops/` is not on `main`.\n\n### Watchouts\n- Apps Script editor-save is not a new deployment. `.gs` copies in git (`satellite.gs` in `1f02d1b`, plus `9a754fb`) are not a deploy. No `satellite.gs` deploy evidence today; MOCKINGBIRD row 277 is the first check after a real deploy.\n- Public `data/*.json` is sync-owned (drone-test + Eugene row + camera JSON landed via git; next sync can overwrite).\n- Catalog `role=` still present on all 256 pins after `06c9714` (195 primary, 61 concern); do not flatten it.\n\n## 2026-08-27\n\nNothing shipped today on `origin/main`. Head remains `06c9714` (2026-08-26 16:31 -0500).\n\nLog Bot cron `41611cd5-a0bb-11f1-b532-320a589b8025` at 2026-08-27T00:03:07Z, then follow-ups to wire the `file://` weekly page. v2 / OneDrive `docs/ops` is not mounted on this VM (`property-intel-v2` 404). `list-cloud-agents` listed only Log Bot runs. CHANGELOG/CONTEXT not in this clone.\n\n### Shipped\nNone on 2026-08-27.\n\n### Still open\n- Vyanet Viewer hub **1.6.4** on `origin/cursor/vyanet-viewer-gate-home` (`161a860`) not merged; `main` hub **1.0.3**.\n- Chat direction not visible in the Log Bot environment.\n\n### Watchouts\n- Apps Script editor-save is not a new deployment. `.gs` copies in git are not a deploy. No `satellite.gs` deploy evidence today.\n- Public `data/*.json` is sync-owned.\n- Catalog `role=` still present on all 256 pins after `06c9714`; do not flatten it.\n\n## 2026-08-26\n\nFirst write of this day into this `log.md` (8/26 Log Bot run `bc-45e4c56a` did not commit `docs/ops/`).\n\n### Shipped\n- `06c9714` \"Update pins-catalog.json\". Catalog `version` `2026-07-15` → `2026-08-26`; `pin_count` 239 → 256. Notes: pins 240–256 appended; `#30` Entry → Vehicle Entrance; `account_type` widened on `#30` / `#33` / `#127`. All 256 pins still have `role` (195 primary, 61 concern). Actions `33015751649` and Pages `33015750965` succeeded.\n- Last Apps Script–style property sync remains `86e00ef` (2026-08-24 drone-test). No satellite/plane/responder-intel `data/` sync this day.\n\n### Still open\n- `161a860` \"Ship Vyanet Viewer hub through 1.6.4: live tab, dashboard, and 3D cameras\" on `cursor/vyanet-viewer-gate-home`, not on `main`.\n- No GitHub pull requests listed on this repo.\n\n### Watchouts\nStanding rules above. No `satellite.gs` deploy evidence.\n\n## 2026-08-25\n\nReconstructed from v1 git (this VM cannot read the original OneDrive 8/25 block). If your local `log.md` already has a fuller 8/25 section, keep that block and leave this one as the git evidence.\n\n### Shipped\n- `8662883` \"Identify element-review critiques by site_no instead of address.\" `element-review.html` BUILD **v6.8.2**. Duplicate lots were rejected as ambiguous when the review link only carried addr; links now include `site_no`. Same commit added `apps scripts/*.gs` copies to the public repo — **file copy, not an Apps Script deployment**.\n- `fb9a0f2` merge of `main`.\n\n### Still open (that day)\n- `d32bb4a` \"Add gate and home shell to the Vyanet Viewer hub (1.1.1)\" on `cursor/vyanet-viewer-gate-home`, not merged to `main` (later advanced to 1.6.4 on 8/26).\n\n### Watchouts\n`.gs` in git ≠ deployed. `data/*.json` is sync-owned.\n",
  "pipelines": [
    {
      "id": "viewers",
      "name": "Responder viewers (v1 Pages)",
      "status": "on main",
      "evidence": "origin/main 04ba593; HUB_BUILD 1.8.17; element-review BUILD v6.8.20; golf-review BUILD v1.0.4; nearmap-review BUILD v1.7.17; nearmap-viewer BUILD v1.1.13"
    },
    {
      "id": "sync",
      "name": "Apps Script → GitHub data sync",
      "status": "last Sync/Publish 2026-09-11 responder-drone x6",
      "evidence": "6a6b387..2fcc1be added six data/responder-drone/{id}.json (131→137). 542bd09 remains the Nearmap JSON write. 187a608 remains last drone Sync. No satellite/plane Sync/Publish. b9700af..04ba593 did not touch data/. Editor-save is not a deploy."
    },
    {
      "id": "satellite",
      "name": "Satellite Pass 1 / review / Pass 2",
      "status": "viewers on main; deploy unverified",
      "evidence": "element-review.html BUILD v6.8.20 unchanged by b9700af..04ba593. satellite.gs copy last changed in d688a65; file copy is not a deploy. No satellite.gs copy 2026-09-03..2026-09-13."
    },
    {
      "id": "nearmap",
      "name": "Nearmap trial (review + viewer + hub)",
      "status": "review v1.7.17 + viewer v1.1.13 + hub 1.8.17 on main; one published JSON; Apps Script deploy / S3 edits unverified",
      "evidence": "b9700af/edcd836/04ba593 review v1.7.6→v1.7.17 (no .gs). Viewer stays v1.1.13. Hub stays 1.8.17. 542bd09 published data/nearmap/{id}.json unchanged today."
    },
    {
      "id": "golf",
      "name": "Golf review (sheet-only)",
      "status": "on main; Apps Script deploy unverified",
      "evidence": "golf-review.html BUILD v1.0.4 on origin/main 8b1d0d4; unchanged by b9700af..04ba593. Seed 150 pins ids 1001-1150; GOLF_MAX_PINS=200 in config.gs copy. golf.gs header: no data/golf/, never merge into pins-catalog.json. .gs copies are not a deploy."
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
      "evidence": "Hub 1.8.17 unchanged by 04ba593. Private rail copy still lists Live as this property's CHEKT cameras; Nearmap is a leave/return page. live-viewer.html still on origin/main. Unchanged CHEKT code path not re-probed."
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
      "evidence": "Draft PRs #1, #3, #4, #5, #6, #7, #8, #9, #10, #11, #12, #13, #14, #15, #16, #17, #18. origin/main has no docs/ops."
    },
    {
      "item": "Log Bot cannot see desktop/web/local chats",
      "evidence": "list-cloud-agents desktop/web/local sources returned 0 in this environment."
    },
    {
      "item": "v2 pipeline tree not mounted for Log Bot",
      "evidence": "property-intel-v2 404; OneDrive Desktop/property-intel-v2/docs/ops not writable from this VM."
    },
    {
      "item": "Golf Apps Script deploy unverified",
      "evidence": "a8b3ceb..8b1d0d4 committed golf.gs/config.gs/menu.gs/critique-api.gs copies. Editor-save is not a deploy. No golf-review or golf.gs commits after 8b1d0d4. config.gs was edited for Nearmap in 4937ac0 — still a file copy."
    },
    {
      "item": "satellite.gs / critique-api.gs deploy unverified after 9/01 evening + 9/02 copies",
      "evidence": "d688a65 copied satellite.gs and critique-api.gs; da8dedf copied critique-api.gs. File copies are not a deploy. b9700af..04ba593 did not copy satellite.gs or critique-api.gs. MOCKINGBIRD row 277 is the first check after a real satellite.gs deploy."
    },
    {
      "item": "Nearmap Apps Script deploy / S3 edits write unverified",
      "evidence": "7dd6050/4937ac0/07b62a1 copied nearmap.gs; 4937ac0 copied config.gs — file copies, not a deploy. b9700af..04ba593 added no .gs copy. Published JSON exists (542bd09). This clone cannot see the Apps Script editor or the S3 edits object."
    }
  ],
  "board": {
    "title": "Property Intel",
    "summary": "3 commits landed on origin/main after the 9/12 cron (head was 07b62a1). Head now 04ba593. Nearmap review v1.7.6→v1.7.17 (scroll/Draw + faster open). Viewer v1.1.13, hub 1.8.17, ER v6.8.20, golf v1.0.4 unchanged. No Sync/Publish. ISO week 2026-W37. Lane 332; satellite 506; plane 22; nearmap 1; responder-drone 137. Photo transport and EagleView access still block scale-out.",
    "as_of": "2026-09-13",
    "last_write": "2026-09-13 00:19 UTC",
    "source": "Public v1 · docs/ops",
    "kpis": [
      {
        "label": "Satellite records published",
        "value": "506",
        "sub": "target 30000 properties",
        "evidence": "len(data/satellite/*.json)=506 recount 2026-09-13"
      },
      {
        "label": "Plane-rendered properties",
        "value": "22",
        "sub": "target 44 Highlands roster",
        "evidence": "len(data/plane/*.json)=22 recount 2026-09-13 (was 20 on 2026-08-25)"
      },
      {
        "label": "Ranked open items",
        "value": "17",
        "sub": "still open of 18 listed",
        "evidence": "2026-08-25 board. Original 18-item list is not in this clone; no evidence those items closed. Recount 2026-09-13 unchanged."
      },
      {
        "label": "EagleView access",
        "value": "Not granted",
        "sub": "30-day eval clock has not started",
        "evidence": "2026-08-25 board; no grant file in this checkout. Recount 2026-09-13 unchanged."
      }
    ],
    "pipelines": [
      {
        "name": "1 — Ingest",
        "items": [
          {
            "status": "done",
            "label": "DONE",
            "title": "Capture ingest (5 gates, pyramid, manifest last)",
            "note": "1-ingest/ingest_capture.py in production."
          },
          {
            "status": "done",
            "label": "DONE",
            "title": "Promote to serving + registry (plane path)",
            "note": "Works for plane captures. Operator still stamps parcels_ref by hand."
          },
          {
            "status": "not_started",
            "label": "NOT-STARTED",
            "title": "Parameterize promote for drone prefix / type",
            "note": "Still hardcoded. Eugene used option B: plane prefix + type plane. Do not stamp type:drone until the four Lambdas are redeployed."
          }
        ]
      },
      {
        "name": "2 — Parcels",
        "items": [
          {
            "status": "done",
            "label": "DONE",
            "title": "Deschutes county published",
            "note": "109,474 features."
          },
          {
            "status": "done",
            "label": "DONE",
            "title": "Lane County source GeoJSON on disk",
            "note": "407 MB file gitignored. Must never be committed."
          },
          {
            "status": "done",
            "label": "DONE",
            "title": "Inspect → counties.json lane → publish → probe",
            "note": "2026-08-31: 332 viewer tiles on GitHub Pages (8/27 board: 159,131 features, 323 shards). Join MAPTAXLOT. CDN probe was 5/5. Owner fields stripped."
          }
        ]
      },
      {
        "name": "3 — Eligibility",
        "items": [
          {
            "status": "done",
            "label": "DONE",
            "title": "One opacity function for eligibility and render",
            "note": "Render gate imports 3-eligibility/eligibility_check.capture_coverage."
          },
          {
            "status": "blocked",
            "label": "BLOCKED",
            "title": "Eugene origin taxlot below 80% clip/render gate",
            "note": "Taxlot 1704233002104 is 65% opaque. Capture vyanet-eugene-2026-08-19 is in serving as type plane, parcels_ref lane."
          }
        ]
      },
      {
        "name": "4 — Clip / render",
        "items": [
          {
            "status": "done",
            "label": "DONE",
            "title": "Drone captures parcel-clipped like plane",
            "note": "Whole-mesh drone GLB path is superseded. parcels_ref required on every capture."
          },
          {
            "status": "not_started",
            "label": "NOT-STARTED",
            "title": "load_captures() plane|drone edit not deployed",
            "note": "Drone-typed captures stay invisible to clip/render until it ships. Re-baseline the row-3 oracle after."
          },
          {
            "status": "unknown",
            "label": "UNKNOWN",
            "title": "Row-3 render oracle (18775 Macalpine Loop)",
            "note": "Not re-run from this checkout. Expected: ok=true, tier ENTRANCE, alpha=231.3°, nadir 148/156."
          }
        ]
      },
      {
        "name": "5 — Satellite",
        "items": [
          {
            "status": "done",
            "label": "DONE",
            "title": "Pass 1 emits the twenty; reruns keep all 239",
            "note": "Two vocabularies by design. Do not unify. Catalog role= still on all 256 pins (195 primary, 61 concern)."
          },
          {
            "status": "in_progress",
            "label": "IN PROGRESS",
            "title": "MOCKINGBIRD row 277 redo",
            "note": "First check after any real satellite.gs deploy. Critique add-loss guard still missing. Editor-save ≠ deploy."
          },
          {
            "status": "in_progress",
            "label": "IN PROGRESS",
            "title": "Pass 1 placement-failure diagnostics",
            "note": "Corner-stack hypothesis: unit mismatch + clamp relocation."
          },
          {
            "status": "in_progress",
            "label": "IN PROGRESS",
            "title": "Reviewer revisit lists",
            "note": "Ross 88 / Eleanor 27. School cap is 20 as of 2026-08-27. SAT_MAX_PINS stays 12 in the satellite.gs copy."
          }
        ]
      },
      {
        "name": "6 — Live video + viewers",
        "items": [
          {
            "status": "done",
            "label": "DONE",
            "title": "Live CHEKT on the hub",
            "note": "origin/main 07b62a1; HUB_BUILD 1.8.17; GIS facts stay on Private 2D/3D; Nearmap is a full-page leave/return; property CHEKT still under Private per hub copy; live-viewer.html on main."
          },
          {
            "status": "done",
            "label": "DONE",
            "title": "Element Review outside-crop pins + Earth",
            "note": "element-review.html BUILD v6.8.20 unchanged by 6a6b387..07b62a1 (Show pins + DPC' + sandbox=1; duplicate identity is marker number since d688a65)."
          },
          {
            "status": "in_progress",
            "label": "IN PROGRESS",
            "title": "Golf review (sheet-only)",
            "note": "golf-review.html BUILD v1.0.4 on origin/main 8b1d0d4; unchanged by 6a6b387..07b62a1. Seed 150 pins ids 1001-1150; GOLF_MAX_PINS=200 in the config.gs copy. .gs copies are not a deploy. No data/golf/."
          },
          {
            "status": "in_progress",
            "label": "IN PROGRESS",
            "title": "Nearmap trial review page",
            "note": "nearmap-review.html BUILD v1.7.6 (4937ac0); nearmap-viewer.html BUILD v1.1.13 (07b62a1); hub 1.8.17 (7dd6050). First published data/nearmap/{id}.json in 542bd09 (20 elements). nearmap.gs copied again in 07b62a1; not a deploy."
          },
          {
            "status": "blocked",
            "label": "BLOCKED",
            "title": "responder-intel.html flat pixelToLatLng",
            "note": "0.488% N-S stretch. Migrate to nadir-geo; do not copy the flat helper."
          }
        ]
      },
      {
        "name": "7 — Photo intake + EagleView",
        "items": [
          {
            "status": "in_progress",
            "label": "IN PROGRESS",
            "title": "Photo-intake transport",
            "note": "Zoho Forms closed. Creator probe 2 ready; fallback own page + S3 presigned POST."
          },
          {
            "status": "blocked",
            "label": "BLOCKED",
            "title": "EagleView access",
            "note": "Not granted. 30-day eval clock has not started. License rights (analyze/cache/derive/resell) and 3D-mesh questions first."
          }
        ]
      }
    ]
  }
};
