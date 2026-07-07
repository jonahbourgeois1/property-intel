#!/usr/bin/env python3
"""
promote_capture.py — the manual-gate action between Stage 1 (Ingest) and the
serving/production side of the plane imagery pipeline.

INPUT CONTRACT : a completed capture in s3://property-intel-ingest
                 (captures/{id}/manifest.json with status ready_for_review)
OUTPUT CONTRACT: capture served from s3://property-intel-tiles under
                 captures/plane/{id}/ (v1-compatible layout), registry entry
                 merged into reference/captures.json, CloudFront invalidated.
FAILURE MODE   : fail-fast; registry is backed up in S3 before every write;
                 copies are server-side and resumable (skip if same size).

Usage:
  python promote_capture.py review  <capture-id>
  python promote_capture.py promote <capture-id> [dry]
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone

INGEST_BUCKET = "property-intel-ingest"
SERVING_BUCKET = "property-intel-tiles"
AWS_REGION = "us-east-1"
CDN_BASE = "https://d3fg47bqswi0rr.cloudfront.net"
CLOUDFRONT_DISTRIBUTION_ID = "EQJBJ6X237VQF"
REGISTRY_KEY = "reference/captures.json"
REGISTRY_BACKUP_PREFIX = "reference/backups/"
PRUNE_ORPHAN_TILES = True   # delete serving map/ tiles not in the new set

# ingest prefix -> serving prefix (relative to captures/{id}/ and
# captures/plane/{id}/ respectively)
COPY_MAP = [
    ("processed/tiles/", "map/"),
    ("processed/model/", "model/"),
    ("raw/models/pc/0/terra_b3dms/", "b3dm/"),
    ("raw/map/report/map_report.json", "map_report.json"),
]

REVIEW_CHECKLIST = """
Manual review checklist (RUNBOOK step 4):
  [ ] all validations 'pass' and errors is empty
  [ ] bounds sit where the flight actually was (paste lat/lon into a map)
  [ ] tile counts plausible for the flown area
  [ ] geo_crosscheck_delta_m at or near 0.0 / 0.0
  [ ] transform_method is 'metadata_xml' (escalate if 'tileset_recovery')
If all boxes check:  python promote_capture.py promote <capture-id> dry
"""


# ----------------------------------------------------------------------------
# S3 helpers
# ----------------------------------------------------------------------------

def s3_client():
    import boto3
    return boto3.client("s3", region_name=AWS_REGION)


def fetch_json(s3, bucket: str, key: str):
    obj = s3.get_object(Bucket=bucket, Key=key)
    return json.loads(obj["Body"].read().decode("utf-8-sig"))


def list_keys(s3, bucket: str, prefix: str):
    """Yield (key, size) under prefix."""
    paginator = s3.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
        for item in page.get("Contents", []):
            yield item["Key"], item["Size"]


def get_manifest(s3, capture_id: str) -> dict:
    key = f"captures/{capture_id}/manifest.json"
    try:
        manifest = fetch_json(s3, INGEST_BUCKET, key)
    except Exception as e:
        sys.exit(f"FAIL: cannot fetch s3://{INGEST_BUCKET}/{key} — {e}\n"
                 "Has the capture been uploaded? (RUNBOOK step 3)")
    if manifest.get("status") != "ready_for_review":
        sys.exit(f"FAIL: manifest status is '{manifest.get('status')}' — "
                 "only ready_for_review captures may be promoted")
    return manifest


# ----------------------------------------------------------------------------
# Registry entry construction + merge (tested against real captures.json)
# ----------------------------------------------------------------------------

def _find_number(obj, name_parts):
    """First numeric value whose key contains all name_parts (recursive)."""
    if isinstance(obj, dict):
        for k, v in obj.items():
            kl = k.lower()
            if isinstance(v, (int, float)) and all(p in kl for p in name_parts):
                return float(v)
        for v in obj.values():
            found = _find_number(v, name_parts)
            if found is not None:
                return found
    elif isinstance(obj, list):
        for v in obj:
            found = _find_number(v, name_parts)
            if found is not None:
                return found
    return None


def build_registry_entry(manifest: dict, existing: dict | None,
                         map_report: dict | None) -> tuple[dict, list[str]]:
    cid = manifest["capture_id"]
    zooms = sorted(int(z) for z in manifest["tiles"]["tile_extents"])
    b = manifest["bounds_wgs84_tile_edges"]
    entry = dict(existing or {})   # preserve unknown fields (parcels_key, …)
    warnings: list[str] = []

    gsd_cm = None
    g = _find_number(map_report or {}, ["gsd"])
    if g is not None:
        gsd_cm = round(g * 100, 2) if g < 1 else round(g, 2)
    if gsd_cm is None:
        gsd_cm = entry.get("gsd_cm")
        warnings.append("gsd not found in map_report; preserved existing value")

    area_km2 = None
    a = _find_number(map_report or {}, ["area"])
    if a is not None:
        area_km2 = round(a / 1e6, 2) if a > 1000 else round(a, 2)
    if area_km2 is None:
        area_km2 = entry.get("area_km2")
        warnings.append("area not found in map_report; preserved existing value")

    entry.update({
        "id": cid,
        "type": "plane",
        "label": manifest["display_name"],
        "gsd_cm": gsd_cm,
        "area_km2": area_km2,
        "bounds": {"north": b["north"], "south": b["south"],
                   "east": b["east"], "west": b["west"]},
        "tiles": f"{CDN_BASE}/captures/plane/{cid}/map",
        "b3dm": f"{CDN_BASE}/captures/plane/{cid}/b3dm/tileset.json",
        "map_report": f"{CDN_BASE}/captures/plane/{cid}/map_report.json",
        "tile_levels": {"min": zooms[0], "max": zooms[-1]},
        "tile_extents": manifest["tiles"]["tile_extents"],
        "captured": manifest["captured"],
        "enabled": entry.get("enabled", True),
        "model_source": f"captures/plane/{cid}/model/BlockR.obj",
        "model_transform": manifest["model"]["transform_ecef"],
    })
    return entry, warnings


def merge_registry(registry: dict, new_entry: dict) -> tuple[dict, bool]:
    caps = registry.get("captures", [])
    out = [c for c in caps if c.get("id") != new_entry["id"]]
    replaced = len(out) != len(caps)
    out.append(new_entry)
    out.sort(key=lambda c: (c.get("captured", ""), c.get("id", "")))
    return {**registry, "captures": out}, replaced


# ----------------------------------------------------------------------------
# Copy plan (server-side; no data leaves S3)
# ----------------------------------------------------------------------------

def build_copy_plan(s3, capture_id: str) -> list[tuple[str, str, int]]:
    """Return (src_key, dst_key, size). Sources in INGEST, dests in SERVING."""
    ingest_base = f"captures/{capture_id}/"
    serve_base = f"captures/plane/{capture_id}/"
    plan: list[tuple[str, str, int]] = []
    for src_rel, dst_rel in COPY_MAP:
        if src_rel.endswith("/"):
            for key, size in list_keys(s3, INGEST_BUCKET, ingest_base + src_rel):
                plan.append((key, serve_base + dst_rel +
                             key[len(ingest_base + src_rel):], size))
        else:
            src_key = ingest_base + src_rel
            try:
                head = s3.head_object(Bucket=INGEST_BUCKET, Key=src_key)
                plan.append((src_key, serve_base + dst_rel,
                             head["ContentLength"]))
            except Exception:
                pass  # optional file (e.g. delivery had no map_report.json)
    return plan


def execute_copies(s3, plan) -> tuple[int, int]:
    copied = skipped = 0
    for i, (src, dst, size) in enumerate(plan, 1):
        try:
            head = s3.head_object(Bucket=SERVING_BUCKET, Key=dst)
            if head["ContentLength"] == size:
                skipped += 1
                continue
        except Exception:
            pass
        ctype = ("image/png" if dst.endswith(".png") else
                 "application/json" if dst.endswith(".json") else
                 "application/octet-stream")
        s3.copy_object(Bucket=SERVING_BUCKET, Key=dst,
                       CopySource={"Bucket": INGEST_BUCKET, "Key": src},
                       MetadataDirective="REPLACE",
                       ContentType=ctype,
                       CacheControl="public, max-age=3600")
        copied += 1
        if copied % 1000 == 0:
            print(f"  ... {i}/{len(plan)} (copied {copied}, skipped {skipped})")
    return copied, skipped


# ----------------------------------------------------------------------------
# Commands
# ----------------------------------------------------------------------------

def cmd_review(capture_id: str) -> int:
    s3 = s3_client()
    manifest = get_manifest(s3, capture_id)
    print(json.dumps(manifest, indent=2))
    print(REVIEW_CHECKLIST)
    return 0


def cmd_promote(capture_id: str, dry: bool) -> int:
    s3 = s3_client()
    manifest = get_manifest(s3, capture_id)

    # map_report (optional) for gsd/area
    map_report = None
    try:
        map_report = fetch_json(
            s3, INGEST_BUCKET,
            f"captures/{capture_id}/raw/map/report/map_report.json")
    except Exception:
        print("note: no map_report.json in ingest; gsd/area will be "
              "preserved from any existing registry entry")

    # current registry + existing entry
    try:
        registry = fetch_json(s3, SERVING_BUCKET, REGISTRY_KEY)
    except Exception as e:
        sys.exit(f"FAIL: cannot fetch registry "
                 f"s3://{SERVING_BUCKET}/{REGISTRY_KEY} — {e}")
    existing = next((c for c in registry.get("captures", [])
                     if c.get("id") == capture_id), None)

    entry, warnings = build_registry_entry(manifest, existing, map_report)
    merged, replaced = merge_registry(registry, entry)
    plan = build_copy_plan(s3, capture_id)
    total_bytes = sum(s for _, _, s in plan)

    print(f"copy plan: {len(plan)} objects, {total_bytes:,} bytes "
          f"(server-side, {INGEST_BUCKET} -> {SERVING_BUCKET})")
    print(f"registry: {'REPLACING existing' if replaced else 'ADDING new'} "
          f"entry '{capture_id}' ({len(merged['captures'])} captures total)")
    for w in warnings:
        print(f"  warn: {w}")

    if PRUNE_ORPHAN_TILES:
        planned = {dst for _, dst, _ in plan}
        map_prefix = f"captures/plane/{capture_id}/map/"
        orphans = [k for k, _ in list_keys(s3, SERVING_BUCKET, map_prefix)
                    if k not in planned]
        print(f"  DRY orphan prune would delete {len(orphans)} "
                f"stale tiles under map/")

    if dry:
        groups: dict[str, list[int]] = {}
        for _, dst, size in plan:
            g = "/".join(dst.split("/")[:4])
            groups.setdefault(g, [0, 0])
            groups[g][0] += 1
            groups[g][1] += size
        for g, (n, byt) in sorted(groups.items()):
            print(f"  DRY {g:44s} files={n:6d}  bytes={byt:,}")
        print("  DRY registry entry that would be written:")
        print(json.dumps(entry, indent=2))
        print("\nDRY RUN — nothing copied, registry untouched.")
        return 0

    # 1) copies first (serving content must exist before the registry points at it)
    copied, skipped = execute_copies(s3, plan)
    print(f"copies done: {copied} copied, {skipped} skipped (already present)")
    if PRUNE_ORPHAN_TILES:
        planned = {dst for _, dst, _ in plan}
        map_prefix = f"captures/plane/{capture_id}/map/"
        orphans = [k for k, _ in list_keys(s3, SERVING_BUCKET, map_prefix)
                   if k not in planned]
        for i in range(0, len(orphans), 1000):
            batch = orphans[i:i + 1000]
            s3.delete_objects(Bucket=SERVING_BUCKET,
                              Delete={"Objects": [{"Key": k} for k in batch]})
        print(f"  orphan prune pending: {len(orphans)} stale tiles under map/")

    # 2) registry backup, then write
    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup_key = f"{REGISTRY_BACKUP_PREFIX}captures-{ts}.json"
    s3.copy_object(Bucket=SERVING_BUCKET, Key=backup_key,
                   CopySource={"Bucket": SERVING_BUCKET, "Key": REGISTRY_KEY})
    print(f"registry backed up to s3://{SERVING_BUCKET}/{backup_key}")
    s3.put_object(Bucket=SERVING_BUCKET, Key=REGISTRY_KEY,
                  Body=json.dumps(merged, indent=2).encode("utf-8"),
                  ContentType="application/json")
    print(f"registry written: s3://{SERVING_BUCKET}/{REGISTRY_KEY}")

    # 3) CloudFront invalidation
    import boto3
    cf = boto3.client("cloudfront")
    inv = cf.create_invalidation(
        DistributionId=CLOUDFRONT_DISTRIBUTION_ID,
        InvalidationBatch={
            "Paths": {"Quantity": 2,
                      "Items": [f"/{REGISTRY_KEY}",
                                f"/captures/plane/{capture_id}/*"]},
            "CallerReference": f"promote-{capture_id}-{ts}",
        })
    print(f"cloudfront invalidation created: "
          f"{inv['Invalidation']['Id']} (takes a few minutes to complete)")
    print(f"\nPROMOTED — {capture_id} is now live for downstream stages.")
    return 0


def main(argv: list[str]) -> int:
    if len(argv) >= 3 and argv[1] == "review" and len(argv) == 3:
        return cmd_review(argv[2])
    if len(argv) >= 3 and argv[1] == "promote" and len(argv) in (3, 4):
        if len(argv) == 4 and argv[3] != "dry":
            print(__doc__)
            return 2
        return cmd_promote(argv[2], dry=(len(argv) == 4))
    print(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv))
