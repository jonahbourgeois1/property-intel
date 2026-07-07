#!/usr/bin/env python3
"""
compare_footprints.py — quantitative perimeter-consistency referee.

Renders the imagery footprint (alpha > 0) of EVERY zoom level onto one
common geographic grid and measures how much each zoom's footprint differs
from the z21 reference. If the single-source guarantee holds, mismatch is
only resampling noise at the boundary (well under ~1-2%).

Also writes footprint_z{z}.png masks + footprint_diff_z{z}.png overlays
(red = this zoom has imagery where z21 doesn't; blue = the reverse) into
an 'footprint_report' folder next to the staging dir, so any residual
disagreement is visible as a picture, not an impression.

Usage:
  python compare_footprints.py <staging_tiles_dir>
"""
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image

TILE = 256


def zoom_dirs(root: Path):
    return sorted((int(d.name), d) for d in root.iterdir()
                  if d.is_dir() and d.name.isdigit())


def extents_of(zdir: Path):
    xs, ys = [], []
    for xdir in zdir.iterdir():
        if xdir.is_dir() and xdir.name.isdigit():
            tile_ys = [int(p.stem) for p in xdir.glob("*.png")
                       if p.stem.isdigit()]
            if tile_ys:
                xs.append(int(xdir.name))
                ys.extend(tile_ys)
    return (min(xs), max(xs), min(ys), max(ys)) if xs else None


def render_mask(zdir: Path, z: int, geo, grid_w: int, grid_h: int):
    """Rasterize alpha>0 coverage of zoom z onto the common grid."""
    west, east, north_merc, south_merc = geo  # mercator-fraction space
    mask = np.zeros((grid_h, grid_w), dtype=bool)
    n = 2 ** z
    for xdir in zdir.iterdir():
        if not (xdir.is_dir() and xdir.name.isdigit()):
            continue
        x = int(xdir.name)
        for p in xdir.glob("*.png"):
            if not p.stem.isdigit():
                continue
            y = int(p.stem)
            a = np.array(Image.open(p).convert("RGBA"))[:, :, 3] > 0
            # tile's mercator-fraction bounds
            tw, te = x / n, (x + 1) / n
            tn, ts = y / n, (y + 1) / n
            # map to grid pixel range
            gx0 = (tw - west) / (east - west) * grid_w
            gx1 = (te - west) / (east - west) * grid_w
            gy0 = (tn - north_merc) / (south_merc - north_merc) * grid_h
            gy1 = (ts - north_merc) / (south_merc - north_merc) * grid_h
            dst_w = max(1, round(gx1 - gx0))
            dst_h = max(1, round(gy1 - gy0))
            small = np.array(Image.fromarray(a.astype(np.uint8) * 255)
                             .resize((dst_w, dst_h), Image.BILINEAR)) > 127
            x0, y0 = round(gx0), round(gy0)
            x1, y1 = min(grid_w, x0 + dst_w), min(grid_h, y0 + dst_h)
            if x0 < grid_w and y0 < grid_h and x1 > max(0, x0) and y1 > max(0, y0):
                sx0, sy0 = max(0, -x0), max(0, -y0)
                x0, y0 = max(0, x0), max(0, y0)
                mask[y0:y1, x0:x1] |= small[sy0:sy0 + (y1 - y0),
                                            sx0:sx0 + (x1 - x0)]
    return mask


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    root = Path(sys.argv[1])
    zooms = zoom_dirs(root)
    if not zooms:
        print("no zoom directories found")
        return 1

    # common geographic window: union extents at max zoom, in
    # web-mercator fraction space (x/n, y/n are already mercator fractions)
    mz, mzdir = zooms[-1]
    e = extents_of(mzdir)
    n = 2 ** mz
    geo = (e[0] / n, (e[1] + 1) / n, e[2] / n, (e[3] + 1) / n)
    grid_w = 1024
    grid_h = max(1, round(grid_w * (geo[3] - geo[2]) / (geo[1] - geo[0])))
    print(f"reference: z{mz}, grid {grid_w}x{grid_h}")

    report = root.parent / "footprint_report"
    report.mkdir(exist_ok=True)

    masks = {}
    for z, zdir in zooms:
        masks[z] = render_mask(zdir, z, geo, grid_w, grid_h)
        Image.fromarray(masks[z].astype(np.uint8) * 255).save(
            report / f"footprint_z{z}.png")

    ref = masks[mz]
    total = ref.sum()
    print(f"{'z':>3} {'extra px':>9} {'missing px':>11} {'mismatch %':>11}")
    worst = 0.0
    for z, _ in zooms:
        extra = masks[z] & ~ref
        missing = ~masks[z] & ref
        pct = 100.0 * (extra.sum() + missing.sum()) / max(1, total)
        worst = max(worst, pct if z != mz else 0)
        print(f"{z:>3} {extra.sum():>9} {missing.sum():>11} {pct:>10.2f}%")
        rgb = np.zeros((grid_h, grid_w, 3), dtype=np.uint8)
        rgb[..., 1] = (masks[z] & ref) * 90          # green: agree
        rgb[..., 0] = extra * 255                    # red: extra vs z21
        rgb[..., 2] = missing * 255                  # blue: missing vs z21
        Image.fromarray(rgb).save(report / f"footprint_diff_z{z}.png")

    print(f"\nreport images: {report}")
    if worst < 2.0:
        print("VERDICT: footprints consistent across all zooms "
              "(differences are boundary resampling only)")
    else:
        print("VERDICT: REAL footprint disagreement — open the diff PNGs; "
              "red/blue regions show exactly where and at which zoom")
    return 0


if __name__ == "__main__":
    sys.exit(main())
