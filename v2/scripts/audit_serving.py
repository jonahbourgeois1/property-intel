#!/usr/bin/env python3
"""
audit_serving.py — byte-level audit: does the serving bucket's map/ prefix
contain exactly the tiles in local staging, with identical content?
Compares local MD5 vs S3 ETag (equal for single-part puts/copies).

Usage:
  python audit_serving.py <staging_tiles_dir> <capture-id>
Example:
  python audit_serving.py "C:\\...\\staging\\bend-5-21-26\\tiles" bend-5-21-26
"""
import hashlib
import sys
from pathlib import Path

import boto3

def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__)
        return 2
    staging = Path(sys.argv[1])
    capture_id = sys.argv[2]
    if not staging.is_dir():
        print(f"FAIL: not a directory: {staging}")
        return 1
    prefix = f"captures/plane/{capture_id}/map/"
    s3 = boto3.client("s3", region_name="us-east-1")

    serving = {}
    for page in s3.get_paginator("list_objects_v2").paginate(
            Bucket="property-intel-tiles", Prefix=prefix):
        for o in page.get("Contents", []):
            serving[o["Key"][len(prefix):]] = o["ETag"].strip('"')

    local = {}
    for p in staging.rglob("*.png"):
        local[p.relative_to(staging).as_posix()] = \
            hashlib.md5(p.read_bytes()).hexdigest()

    only_serving = sorted(set(serving) - set(local))
    only_local = sorted(set(local) - set(serving))
    mismatch = sorted(k for k in set(local) & set(serving)
                      if local[k] != serving[k])

    print(f"staging tiles : {len(local)}")
    print(f"serving tiles : {len(serving)}")
    print(f"only in serving (stale?)   : {len(only_serving)} {only_serving[:5]}")
    print(f"only in staging (missing!) : {len(only_local)} {only_local[:5]}")
    print(f"content mismatch           : {len(mismatch)} {mismatch[:5]}")

    by_zoom: dict[str, int] = {}
    for k in mismatch + only_serving + only_local:
        z = k.split("/")[0]
        by_zoom[z] = by_zoom.get(z, 0) + 1
    if by_zoom:
        print("problems by zoom:",
              dict(sorted(by_zoom.items(), key=lambda i: int(i[0]))))
    else:
        print("RESULT: serving is byte-identical to staging — "
              "pipeline fully verified; issue is presentation-side")
    return 0

if __name__ == "__main__":
    sys.exit(main())
