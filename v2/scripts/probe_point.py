#!/usr/bin/env python3
"""
probe_point.py — perimeter consistency probe.

Fetches the tile covering ONE geographic point at every zoom level directly
from CloudFront (cache-busted, no browser, no viewer) and reports whether
that point is opaque imagery, transparent, or missing at each zoom.

If the pipeline guarantee holds, every zoom gives the same answer.

Usage:
  python probe_point.py <capture-id> <lat> <lon>
Example (a point inside the main strip):
  python probe_point.py bend-5-21-26 44.0450 -121.3690
"""
import io
import math
import sys
import time
import urllib.request

from PIL import Image

CDN = "https://d3fg47bqswi0rr.cloudfront.net"
ZOOMS = range(12, 22)


def tile_and_pixel(lat: float, lon: float, z: int):
    n = 2 ** z
    xf = (lon + 180.0) / 360.0 * n
    yf = (1.0 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2.0 * n
    x, y = int(xf), int(yf)
    px, py = int((xf - x) * 256), int((yf - y) * 256)
    return x, y, px, py


def main() -> int:
    if len(sys.argv) != 4:
        print(__doc__)
        return 2
    cid, lat, lon = sys.argv[1], float(sys.argv[2]), float(sys.argv[3])
    cb = int(time.time())
    print(f"point: {lat}, {lon}   capture: {cid}")
    print(f"{'z':>3} {'tile':>16} {'http':>5} {'point':>12} {'tile opaque%':>12}")
    verdicts = []
    for z in ZOOMS:
        x, y, px, py = tile_and_pixel(lat, lon, z)
        url = f"{CDN}/captures/plane/{cid}/map/{z}/{x}/{y}.png?cb={cb}"
        try:
            with urllib.request.urlopen(url, timeout=15) as r:
                img = Image.open(io.BytesIO(r.read())).convert("RGBA")
                a = img.getpixel((px, py))[3]
                alpha = img.getchannel("A")
                opaque = sum(1 for v in alpha.getdata() if v > 0)
                pct = 100.0 * opaque / (256 * 256)
                state = "OPAQUE" if a > 0 else "transparent"
                print(f"{z:>3} {f'{x}/{y}':>16} {'200':>5} {state:>12} {pct:>11.1f}%")
                verdicts.append(state == "OPAQUE")
        except urllib.error.HTTPError as e:
            print(f"{z:>3} {f'{x}/{y}':>16} {e.code:>5} {'no tile':>12} {'-':>12}")
            verdicts.append(False)
        except Exception as e:
            print(f"{z:>3} {f'{x}/{y}':>16} {'ERR':>5} {str(e)[:24]:>12}")
            verdicts.append(None)

    if all(verdicts):
        print("\nVERDICT: point is imagery at EVERY zoom — serving is "
              "consistent; what you see differing is browser cache or viewer.")
    elif not any(verdicts):
        print("\nVERDICT: point is outside the footprint at every zoom — "
              "consistent (pick a point you believe is inconsistent).")
    else:
        bad = [z for z, v in zip(ZOOMS, verdicts) if not v]
        print(f"\nVERDICT: INCONSISTENT — point missing at zooms {bad}. "
              "This is a real serving-side gap; report these zooms.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
