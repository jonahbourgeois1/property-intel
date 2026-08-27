window.PI_STATUS = {
  "as_of": "2026-08-27",
  "as_of_utc": "2026-08-27T00:03:07Z",
  "repo": "jonahbourgeois1/property-intel",
  "ref": "origin/main",
  "head": {
    "sha": "06c9714760bdaf635d7aa19f1d82c4c7d605348f",
    "short": "06c9714",
    "message": "Update pins-catalog.json",
    "author_date": "2026-08-26T21:31:22Z"
  },
  "sources": {
    "git_log_since": "2026-08-26",
    "changelog": null,
    "context": null,
    "context_draft": null,
    "property_intel_v2": "404 from this token",
    "cloud_agents_listed_in_this_environment": [
      "bc-d4995744-9e87-4fbc-bbb8-3497e55e4057",
      "bc-45e4c56a-3ad9-4797-a94a-c20f1f5d6893"
    ],
    "other_property_intel_chats": "not listed in this Log Bot environment"
  },
  "shipped_today": [],
  "lookback": [
    {
      "date": "2026-08-26",
      "sha": "06c9714",
      "message": "Update pins-catalog.json",
      "evidence": "catalog version 2026-07-15 -> 2026-08-26; pin_count 239 -> 256; all 256 pins still have role (195 primary, 61 concern); Actions runs 33015751649 and 33015750965 success"
    }
  ],
  "still_open": [
    {
      "item": "Vyanet Viewer hub 1.6.4 not merged to main",
      "evidence": "origin/cursor/vyanet-viewer-gate-home @ 161a860 (2026-08-26); main vyanet-viewer.html BUILD 1.0.3; gh pr list empty"
    },
    {
      "item": "Chat direction not visible to Log Bot",
      "evidence": "list-cloud-agents in this environment returned only Log Bot automations"
    }
  ],
  "watchouts": [
    "Apps Script editor-save is not a new deployment; .gs copies in this repo are not a deploy. No satellite.gs deploy evidence on 2026-08-27; MOCKINGBIRD row 277 not checked.",
    "Public data/*.json is sync-owned. 06c9714 is a GitHub commit to data/pin-catalog/pins-catalog.json, not an Apps Script sync message.",
    "pins-catalog.json still has role= on every pin after the 256-pin update; do not flatten it."
  ],
  "completion_percent": null,
  "completion_percent_reason": "not reported; no measured evidence"
};
