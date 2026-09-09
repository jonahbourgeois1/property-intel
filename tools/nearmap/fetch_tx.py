#!/usr/bin/env python3
"""Pull Nearmap Transactional Content + AI for one address into the canonical tree.

Auth: NEARMAP_API_KEY in the environment. Do not commit the key.

  python tools/nearmap/fetch_tx.py --address "410 SW Columbia St, Bend, OR 97702" --preview
  python tools/nearmap/fetch_tx.py --address "410 SW Columbia St, Bend, OR 97702" --commit

Preview does not charge credits (no transactionToken).
--commit charges once, then downloads Vert / N/E/S/W / DSM / DTM / TrueOrtho + AI.
dates=single = latest survey per type (not every historical date; that costs 1.5x).

Does not write GitHub data/. Does not promote to CloudFront unless --promote.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from normalize import (  # noqa: E402
    BEDROCK_LONG_EDGE,
    CF_BASE,
    cap_long_edge,
    save_jpeg,
    slugify,
    write_regions_pair,
)
from PIL import Image

API = "https://api.nearmap.com"
COVERAGE = API + "/coverage/v2/tx/address"
STATIC = API + "/staticmap/v3/surveys"

RASTER_TYPES = [
    "Vert", "North", "East", "South", "West",
    "DetailDsm", "DetailDtm", "TrueOrtho",
]
AI_PACKS = [
    "building", "building_char", "construction", "debris",
    "pavement_marking", "poles", "pool", "postcat",
    "roof_char", "roof_cond", "roof_objects", "solar",
    "surface_permeability", "surfaces", "trampoline", "vegetation",
]


def resources_csv() -> str:
    rasters = ",".join("raster:" + t for t in RASTER_TYPES)
    packs = ",".join("aiPacks:" + p for p in AI_PACKS)
    return rasters + "," + packs


def api_key() -> str:
    k = (os.environ.get("NEARMAP_API_KEY") or os.environ.get("NEARMAP_APIKEY") or "").strip()
    if not k:
        raise SystemExit(
            "NEARMAP_API_KEY is not set.\n"
            "In PowerShell:  $env:NEARMAP_API_KEY = 'your-key'\n"
            "Then re-run this command. The key is never written to the repo."
        )
    return k


def http_json(url: str, method: str = "GET", body: dict | None = None, headers: dict | None = None) -> dict:
    data = None
    hdrs = dict(headers or {})
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        hdrs["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            raw = r.read()
            return json.loads(raw.decode("utf-8"))
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8", errors="replace")
        raise SystemExit(f"HTTP {e.code} {url}\n{err[:2000]}") from e


def http_bytes(url: str) -> tuple[bytes, str]:
    req = urllib.request.Request(url)
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            return r.read(), r.headers.get_content_type() or ""
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8", errors="replace")
        raise SystemExit(f"HTTP {e.code} {url}\n{err[:2000]}") from e


def coverage(key: str, address: str, preview: bool, dates: str) -> dict:
    url = COVERAGE + "?" + urllib.parse.urlencode({"apikey": key, "limit": 100})
    payload = {
        "country": "US",
        "address": address,
        "resources": resources_csv(),
        "dates": dates,
        "overlap": "all",
        "preview": "true" if preview else "false",
    }
    return http_json(url, method="POST", body=payload)


def summarize(cov: dict) -> None:
    print("geocoded:", cov.get("geocodedAddress"), "confidence", cov.get("geocodedConfidence"))
    print("bbox:", cov.get("bbox"))
    print("costOfTransaction:", cov.get("costOfTransaction"),
          "(preview has no token / no charge)" if not cov.get("transactionToken") else "")
    print("surveys returned:", len(cov.get("surveys") or []), "total", cov.get("total"))
    for s in (cov.get("surveys") or [])[:12]:
        types = s.get("contentTypes") or list((s.get("scale") or {}).keys())
        print(" ", s.get("captureDate"), s.get("id"), ",".join(types)[:120],
              "ai=" + str(s.get("aiResourceId") or ""))
    if (cov.get("total") or 0) > 12:
        print("  …")


def parse_bbox(bbox: str) -> dict | None:
    if not bbox:
        return None
    parts = [float(x) for x in bbox.split(",")]
    if len(parts) != 4:
        return None
    west, south, east, north = parts
    return {"west": west, "south": south, "east": east, "north": north}


def newest_with(surveys: list, needle: str) -> dict | None:
    for s in surveys:
        types = s.get("contentTypes") or []
        scale = s.get("scale") or {}
        if needle in types or needle in scale:
            return s
        if needle.startswith("raster:") and needle.split(":", 1)[1] in types:
            return s
    return None


def fill_template(tmpl: str, **kw) -> str:
    out = tmpl
    for k, v in kw.items():
        out = out.replace("{" + k + "}", str(v))
    return out


def pack_features(fc: dict, survey_date: str) -> dict:
    counts = {}
    feats = []
    hints = []
    for i, f in enumerate(fc.get("features") or [], start=1):
        props = dict(f.get("properties") or {})
        cls = str(props.get("description") or props.get("class") or props.get("classId") or "Unknown")
        geom = f.get("geometry")
        if not geom:
            continue
        counts[cls] = counts.get(cls, 0) + 1
        out_props = {
            "class": cls,
            "confidence": props.get("confidence"),
            "area_sqm": props.get("clippedAreaSqm") or props.get("areaSqm") or props.get("area"),
            "origin": "vendor",
        }
        if props.get("attributes"):
            out_props["attributes"] = props["attributes"]
        fid = f.get("id") or f"r{i}"
        feats.append({"type": "Feature", "id": f"r{i}" if not f.get("id") else str(fid),
                      "geometry": geom, "properties": out_props})
        lon = lat = None
        try:
            from normalize import centroid_lonlat
            cxy = centroid_lonlat(geom)
            if cxy:
                lon, lat = cxy
        except Exception:
            pass
        hints.append({"class": cls, "lon": lon, "lat": lat, "area_sqm": out_props["area_sqm"]})
    return {
        "type": "FeatureCollection",
        "name": "nearmap-ai-layers",
        "survey_date": survey_date,
        "counts": dict(sorted(counts.items())),
        "hints": hints,
        "features": feats,
    }


def write_stills(serve: Path, canon: Path, name: str, data: bytes, kind: str) -> None:
    dest_raw = canon / "imagery" / name.lower()
    if kind in ("DetailDsm", "DetailDtm"):
        dest_raw = canon / "elevation"
        dest_raw.mkdir(parents=True, exist_ok=True)
        dest_raw.joinpath("dsm.tif" if kind == "DetailDsm" else "dtm.tif").write_bytes(data)
        return
    dest_raw.mkdir(parents=True, exist_ok=True)
    suffix = ".jpg" if data[:3] == b"\xff\xd8" else ".tif"
    dest_raw.joinpath(name.lower() + suffix).write_bytes(data)
    if suffix == ".jpg":
        im = Image.open(dest_raw / (name.lower() + suffix))
        save_jpeg(im, serve / (name.lower() + ".jpg" if name != "Vert" else "vert.jpg"))
        if name == "Vert":
            save_jpeg(cap_long_edge(im, BEDROCK_LONG_EDGE), serve / "vert-p1.jpg")
    elif name == "Vert":
        im = Image.open(dest_raw / (name.lower() + suffix))
        save_jpeg(im, serve / "vert.jpg")
        save_jpeg(cap_long_edge(im, BEDROCK_LONG_EDGE), serve / "vert-p1.jpg")
    elif name == "TrueOrtho":
        dest_raw.joinpath("trueortho.tif").write_bytes(data)


def download_commit(cov: dict, out_root: Path, serve_root: Path, address: str) -> Path:
    token = cov.get("transactionToken")
    if not token:
        raise SystemExit("coverage response has no transactionToken — use --commit, not --preview")
    bbox = cov.get("bbox") or ""
    bounds = parse_bbox(bbox)
    surveys = cov.get("surveys") or []
    if not surveys:
        raise SystemExit("no surveys in coverage")
    date = surveys[0].get("captureDate") or "unknown"
    delivery = slugify(address)
    canon = out_root / delivery / "canonical"
    serve = serve_root / delivery
    (canon / "ai" / "raw").mkdir(parents=True, exist_ok=True)
    serve.mkdir(parents=True, exist_ok=True)
    (canon / "tx-coverage.json").write_text(
        json.dumps({k: v for k, v in cov.items() if k != "transactionToken"}, indent=2),
        encoding="utf-8",
    )

    raster_tmpl = (cov.get("resourceServers") or {}).get("raster") or (
        STATIC + "/{id}/{type}.{format}?transactionToken={transactionToken}"
    )
    ai_tmpl = (cov.get("resourceServers") or {}).get("aiPacks") or (
        API + "/ai/features/v4/tx/surveyresources/{aiResourceId}/features.json?transactionToken={transactionToken}"
    )

    got = []
    for rtype in RASTER_TYPES:
        needle = "raster:" + rtype
        s = newest_with(surveys, needle)
        if not s:
            print("skip", rtype, "(no survey)")
            continue
        fmt = "tif" if rtype in ("DetailDsm", "DetailDtm", "TrueOrtho") else "jpg"
        url = fill_template(
            raster_tmpl,
            id=s["id"],
            type=rtype,
            format=fmt,
            x=0,
            y=0,
            transactionToken=token,
        )
        if "transactionToken=" not in url:
            url += ("&" if "?" in url else "?") + "transactionToken=" + urllib.parse.quote(token)
        print("GET", rtype, s.get("captureDate"), s["id"])
        data, _ = http_bytes(url)
        write_stills(serve, canon, rtype if rtype != "Vert" else "vert", data, rtype)
        got.append(rtype)

    ai_s = None
    for s in surveys:
        if s.get("aiResourceId"):
            ai_s = s
            break
    if ai_s and ai_s.get("aiResourceId"):
        url = fill_template(
            ai_tmpl,
            aiResourceId=ai_s["aiResourceId"],
            id=ai_s["id"],
            transactionToken=token,
        )
        if "transactionToken=" not in url:
            url += ("&" if "?" in url else "?") + "transactionToken=" + urllib.parse.quote(token)
        print("GET AI", ai_s.get("captureDate"), ai_s["aiResourceId"])
        body = http_json(url)
        (canon / "ai" / "raw" / "features.json").write_text(json.dumps(body, indent=2), encoding="utf-8")
        packed = pack_features(body, date)
        (canon / "ai" / "features.json").write_text(json.dumps(packed, indent=2), encoding="utf-8")
        (serve / "ai").mkdir(parents=True, exist_ok=True)
        (serve / "ai" / "features.json").write_text(json.dumps(packed, indent=2), encoding="utf-8")
        hints = {"counts": packed["counts"], "hints": packed["hints"]}
        (serve / "ai" / "hints.json").write_text(json.dumps(hints, indent=2), encoding="utf-8")
        write_regions_pair(canon / "ai", packed)
        write_regions_pair(serve / "ai", packed)
        got.append("AI")
    else:
        print("skip AI (no aiResourceId)")
        packed = {"type": "FeatureCollection", "features": [], "counts": {}, "hints": []}

    urls = {}
    base = f"{CF_BASE}/nearmap/{delivery}"
    urls = {
        "manifest": f"{base}/manifest.json",
        "vert": f"{base}/vert.jpg",
        "vert_p1": f"{base}/vert-p1.jpg",
        "north": f"{base}/north.jpg",
        "east": f"{base}/east.jpg",
        "south": f"{base}/south.jpg",
        "west": f"{base}/west.jpg",
        "ai": f"{base}/ai/features.json",
        "ai_hints": f"{base}/ai/hints.json",
        "ai_original": f"{base}/ai/original/regions.json",
        "ai_edits": f"{base}/ai/edits/regions.json",
    }
    manifest = {
        "delivery_id": delivery,
        "address": cov.get("geocodedAddress") or address,
        "source": "api",
        "survey_date": date,
        "crs": "EPSG:3857",
        "bounds": bounds,
        "site_no": None,
        "ai_counts": packed.get("counts") or {},
        "hint_count": len(packed.get("hints") or []),
        "urls": urls,
        "tx_got": got,
        "normalized_at": datetime.now(timezone.utc).isoformat(),
    }
    (canon / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    (serve / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print("OK", delivery, "got", ",".join(got), "bounds", bounds)
    return serve


def main() -> int:
    ap = argparse.ArgumentParser(description="Nearmap transactional pull for one address")
    ap.add_argument("--address", required=True)
    ap.add_argument("--preview", action="store_true", help="No charge; list coverage only")
    ap.add_argument("--commit", action="store_true", help="Charge credits and download")
    ap.add_argument("--dates", default="single", choices=("single", "all"))
    ap.add_argument("--out", default="tmp/nearmap-canonical")
    ap.add_argument("--serve-out", default="tmp/nearmap-serve")
    args = ap.parse_args()
    if not args.preview and not args.commit:
        args.preview = True
    key = api_key()
    if args.preview:
        print("=== PREVIEW (no credits) ===")
        prev = coverage(key, args.address, preview=True, dates=args.dates)
        summarize(prev)
        (Path(args.out) / "_preview").mkdir(parents=True, exist_ok=True)
        dest = Path(args.out) / "_preview" / (slugify(args.address) + "-preview.json")
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(json.dumps(prev, indent=2), encoding="utf-8")
        print("wrote", dest)
        if not args.commit:
            print("Re-run with --commit to charge and download.")
            return 0
    print("=== COMMIT (charges credits) ===")
    cov = coverage(key, args.address, preview=False, dates=args.dates)
    summarize(cov)
    download_commit(cov, Path(args.out), Path(args.serve_out), args.address)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
