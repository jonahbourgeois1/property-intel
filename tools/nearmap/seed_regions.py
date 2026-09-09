#!/usr/bin/env python3
"""Seed ai/original/regions.json and ai/edits/regions.json from features.json.

Rewrites original always. Seeds edits only when missing (unless --reset-edits).
Does not touch CloudFront or GitHub.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from normalize import write_regions_pair  # noqa: E402


def seed_ai_dir(ai_dir: Path, reduced: dict, reset_edits: bool) -> None:
    write_regions_pair(ai_dir, reduced, reset_edits=reset_edits)


def main() -> int:
    ap = argparse.ArgumentParser(description="Seed original + edits regions.json")
    ap.add_argument("--serve-dir", required=True)
    ap.add_argument("--delivery", default="")
    ap.add_argument("--reset-edits", action="store_true")
    args = ap.parse_args()
    root = Path(args.serve_dir)
    if args.delivery:
        folders = [root / args.delivery]
    else:
        folders = [p for p in root.iterdir() if p.is_dir() and (p / "ai" / "features.json").is_file()]
    for folder in folders:
        src = folder / "ai" / "features.json"
        if not src.is_file():
            raise SystemExit("missing " + str(src))
        reduced = json.loads(src.read_text(encoding="utf-8"))
        seed_ai_dir(folder / "ai", reduced, args.reset_edits)
        canon_ai = Path("tmp/nearmap-canonical") / folder.name / "canonical" / "ai"
        if (canon_ai / "features.json").is_file():
            packed = json.loads((canon_ai / "features.json").read_text(encoding="utf-8"))
            seed_ai_dir(canon_ai, packed, args.reset_edits)
        print("regions", folder.name,
              "original", (folder / "ai" / "original" / "regions.json").stat().st_size,
              "edits", (folder / "ai" / "edits" / "regions.json").stat().st_size)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
