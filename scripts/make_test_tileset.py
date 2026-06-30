"""
make_test_tileset.py
Builds a minimal tileset.json wrapping a single b3dm, using the
known local->ECEF transform from the parent capture's tileset.

Usage: python make_test_tileset.py <output_tileset.json>
"""
import json, sys

M = [
    0.8538393068677613, -0.5205366827108161, 0.0, 0.0,
    0.3618967178637809,  0.5936212624426974, 0.7187799123343397, 0.0,
   -0.3741513111656884, -0.6137225421380228, 0.6952376842667829, 0.0,
   -2390834.612219335,  -3921699.7301742565, 4412849.998474161,  1.0
]

# Bounding box for the clipped parcel (local-space, from earlier output):
# x = -470.65 to -247.82, y = -806.74 to -518.96
cx = (-470.65 + -247.82) / 2
cy = (-806.74 + -518.96) / 2
hx = (-247.82 - -470.65) / 2
hy = (-518.96 - -806.74) / 2

tileset = {
    "asset": {"version": "1.0"},
    "geometricError": 50,
    "root": {
        "boundingVolume": {
            "box": [cx, cy, 0, hx, 0, 0, 0, hy, 0, 0, 0, 30]
        },
        "geometricError": 10,
        "refine": "ADD",
        "transform": M,
        "content": {"uri": "clipped.b3dm"}
    }
}

out_path = sys.argv[1] if len(sys.argv) > 1 else "tileset.json"
with open(out_path, 'w') as f:
    json.dump(tileset, f, indent=2)
print(f"Tileset written: {out_path}")
