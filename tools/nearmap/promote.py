#!/usr/bin/env python3
"""Promote Nearmap serving subset to property-intel-tiles.

Existence checks use s3.head_object (never CloudFront HEAD).
Invalidates CloudFront after stills + registry write.
Does not call GitHub.

Folder format on CloudFront: ai/original/regions.json (vendor, immutable) and
ai/edits/regions.json (seeded from original here; reviewer edits themselves are
published by Apps Script to GitHub data/nearmap/edits/{id}.json, not to S3).
"""
from __future__ import annotations

import argparse
import json
import mimetypes
from datetime import datetime, timezone
from pathlib import Path

BUCKET = "property-intel-tiles"
DIST_ID = "EQJBJ6X237VQF"
REGION = "us-east-1"
PREFIX = "nearmap"
REGISTRY_KEY = "reference/nearmap.json"


def content_type(path: Path) -> str:
    if path.suffix.lower() == ".jpg":
        return "image/jpeg"
    if path.suffix.lower() == ".json":
        return "application/json"
    if path.suffix.lower() == ".glb":
        return "model/gltf-binary"
    guess, _ = mimetypes.guess_type(path.name)
    return guess or "application/octet-stream"


def put_and_head(s3, local: Path, key: str) -> None:
    extra = {"ContentType": content_type(local)}
    if local.suffix.lower() == ".json":
        extra["CacheControl"] = "no-cache"
    else:
        extra["CacheControl"] = "public, max-age=86400"
    s3.upload_file(str(local), BUCKET, key, ExtraArgs=extra)
    s3.head_object(Bucket=BUCKET, Key=key)
    print(f"  PUT+HEAD s3://{BUCKET}/{key} ({local.stat().st_size} bytes)")


def load_registry(s3) -> dict:
    try:
        obj = s3.get_object(Bucket=BUCKET, Key=REGISTRY_KEY)
        return json.loads(obj["Body"].read().decode("utf-8"))
    except s3.exceptions.NoSuchKey:
        return {"version": 1, "deliveries": []}
    except Exception as e:
        code = getattr(e, "response", {}).get("Error", {}).get("Code", "")
        if code in ("NoSuchKey", "404", "NotFound"):
            return {"version": 1, "deliveries": []}
        raise


def merge_delivery(reg: dict, manifest: dict) -> dict:
    did = manifest["delivery_id"]
    others = [d for d in (reg.get("deliveries") or []) if d.get("delivery_id") != did]
    others.append({
        "delivery_id": did,
        "address": manifest.get("address"),
        "survey_date": manifest.get("survey_date"),
        "site_no": manifest.get("site_no"),
        "prefix": f"{PREFIX}/{did}/",
        "urls": manifest.get("urls") or {},
        "bounds": manifest.get("bounds"),
        "hint_count": manifest.get("hint_count"),
        "ai_counts": manifest.get("ai_counts") or {},
    })
    others.sort(key=lambda d: d.get("delivery_id") or "")
    return {
        "version": 1,
        "updated": datetime.now(timezone.utc).isoformat(),
        "deliveries": others,
    }


def invalidate(cf, paths: list[str]) -> None:
    cf.create_invalidation(
        DistributionId=DIST_ID,
        InvalidationBatch={
            "Paths": {"Quantity": len(paths), "Items": paths},
            "CallerReference": f"nearmap-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
        },
    )
    print("  invalidated", paths)


def iter_serve_files(folder: Path):
    for p in sorted(folder.rglob("*")):
        if not p.is_file():
            continue
        rel = p.relative_to(folder).as_posix()
        if rel.startswith("ai/edits/") or "/ai/edits/" in rel:
            print(f"  skip local reviewer edits {rel}")
            continue
        yield p


def key_exists(s3, key: str) -> bool:
    try:
        s3.head_object(Bucket=BUCKET, Key=key)
        return True
    except Exception as e:  # head_object only; never a CloudFront HEAD
        code = getattr(e, "response", {}).get("Error", {}).get("Code", "")
        if code in ("404", "NotFound", "NoSuchKey"):
            return False
        raise


def seed_edits(s3, folder: Path, did: str, reset: bool) -> None:
    """Serving follows the original/edits folder format. ai/edits/regions.json on
    S3 is seeded from ai/original/regions.json so both folders exist; the local
    working edits file is never uploaded. An existing S3 edits object is left
    alone unless --reset-edits (reviewer edits are published via the sheet, not
    by promote)."""
    orig = folder / "ai" / "original" / "regions.json"
    if not orig.is_file():
        print("  no ai/original/regions.json — edits not seeded")
        return
    key = f"{PREFIX}/{did}/ai/edits/regions.json"
    if key_exists(s3, key) and not reset:
        print(f"  keep existing s3://{BUCKET}/{key} (use --reset-edits to reseed)")
        return
    put_and_head(s3, orig, key)
    print("  seeded ai/edits/regions.json from original")


def promote_one(s3, cf, folder: Path, reset_edits: bool = False) -> str:
    man_path = folder / "manifest.json"
    if not man_path.is_file():
        raise SystemExit(f"missing {man_path}")
    manifest = json.loads(man_path.read_text(encoding="utf-8"))
    did = manifest["delivery_id"]
    print(f"Promoting {did}")
    for p in iter_serve_files(folder):
        rel = p.relative_to(folder).as_posix()
        key = f"{PREFIX}/{did}/{rel}"
        put_and_head(s3, p, key)
    seed_edits(s3, folder, did, reset_edits)
    reg = load_registry(s3)
    merged = merge_delivery(reg, manifest)
    tmp = folder / "_registry_upload.json"
    tmp.write_text(json.dumps(merged, indent=2), encoding="utf-8")
    put_and_head(s3, tmp, REGISTRY_KEY)
    tmp.unlink(missing_ok=True)
    invalidate(cf, [f"/{PREFIX}/{did}/*", f"/{REGISTRY_KEY}"])
    return did


def main() -> int:
    ap = argparse.ArgumentParser(description="Promote Nearmap serving subset to tiles + CloudFront")
    ap.add_argument("--serve-dir", required=True)
    ap.add_argument("--delivery", default="", help="One delivery_id folder; default = all")
    ap.add_argument("--reset-edits", action="store_true",
                    help="Reseed s3 ai/edits/regions.json from original even if it exists")
    args = ap.parse_args()

    import boto3
    from botocore.config import Config

    cfg = Config(retries={"max_attempts": 3})
    s3 = boto3.client("s3", region_name=REGION, config=cfg)
    cf = boto3.client("cloudfront", region_name="us-east-1")

    root = Path(args.serve_dir)
    if not root.is_dir():
        raise SystemExit(f"serve-dir not found: {root}")

    if args.delivery:
        folders = [root / args.delivery]
        if not folders[0].is_dir():
            raise SystemExit(f"delivery folder not found: {folders[0]}")
    else:
        folders = [p for p in root.iterdir() if p.is_dir() and (p / "manifest.json").is_file()]
        if not folders:
            raise SystemExit(f"no delivery folders with manifest.json under {root}")

    for folder in folders:
        promote_one(s3, cf, folder, reset_edits=args.reset_edits)
    print("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
