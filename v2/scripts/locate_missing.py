#!/usr/bin/env python3
"""
locate_missing.py — pinpoint where a zoom's footprint is missing imagery
relative to the max-zoom reference, as concrete tile addresses.

For each z-level tile overlapping the missing region, reports whether the
tile file exists in staging and its opaque-pixel percentage, plus the same
for the corresponding max-zoom descendants.

Usage:
  python locate_missing.py <staging_tiles_dir> <suspect_zoom>
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image


def extents_of(zdir: Path):
    xs, ys = [], []
    for xdir in zdir.iterdir():
        if xdir.is_dir() and xdir.name.isdigit():
            tile_ys = [int(p.stem) for p in xdir.glob("*.png")
                       if p.stem.isdigit()]
            if tile_ys:
                xs.append(int(xdir.name))
                ys.extend(tile_ys)
    return (min(xs), max(xs), min(ys), max(ys))


def tile_alpha_pct(path: Path):
    if not path.is_file():
        return None
    a = np.array(Image.open(path).convert("RGBA"))[:, :, 3]
    return 100.0 * (a > 0).sum() / a.size


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__)
        return 2
    root = Path(sys.argv[1])
    zs = int(sys.argv[2])
    zooms = sorted(int(d.name) for d in root.iterdir()
                   if d.is_dir() and d.name.isdigit())
    mz = zooms[-1]
    scale = 2 ** (mz - zs)
    print(f"suspect z{zs} vs reference z{mz} (scale {scale})")

    # coverage sets at max zoom, aggregated to suspect-zoom addresses
    ref_children: dict[tuple[int, int], int] = {}
    for xdir in (root / str(mz)).iterdir():
        if not (xdir.is_dir() and xdir.name.isdigit()):
            continue
        x = int(xdir.name)
        for p in xdir.glob("*.png"):
            if p.stem.isdigit():
                key = (x // scale, int(p.stem) // scale)
                ref_children[key] = ref_children.get(key, 0) + 1

    print(f"\n{'z'+str(zs)+' tile':>16} {'exists':>7} {'alpha%':>7} "
          f"{'z'+str(mz)+' children':>13}")
    problems = 0
    for (tx, ty), nchildren in sorted(ref_children.items()):
        tile = root / str(zs) / str(tx) / f"{ty}.png"
        pct = tile_alpha_pct(tile)
        # flag: reference says imagery lives here, but suspect tile is
        # absent or dramatically less covered than child count implies
        child_cov = 100.0 * nchildren / (scale * scale)
        suspicious = pct is None or (child_cov - pct) > 15.0
        if suspicious:
            problems += 1
            print(f"{f'{tx}/{ty}':>16} {str(pct is not None):>7} "
                  f"{('-' if pct is None else f'{pct:.1f}'):>7} "
                  f"{nchildren:>4} ({child_cov:.0f}% area)   <-- MISMATCH")
    if problems == 0:
        print("no per-tile mismatches above threshold — the footprint "
              "difference is sub-tile boundary detail only")
    else:
        print(f"\n{problems} suspect tile(s) at z{zs}. For each, the z{mz} "
              "children exist but the parent covers far less.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
