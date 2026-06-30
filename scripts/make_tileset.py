"""
make_tileset.py
Generates a tileset.json for a clipped parcel B3DM.
Correctly computes the camera position using Bowring ECEF->geodetic.

Usage: python make_tileset.py <taxlot_id> <local_x_min> <local_x_max> <local_y_min> <local_y_max> <local_z_center> <b3dm_uri> <output.json>
   Or: python make_tileset.py --parcel 181102D000600 clipped.b3dm output.json
"""
import sys, json, math

M = [
    0.8538393068677613, -0.5205366827108161, 0.0, 0.0,
    0.3618967178637809,  0.5936212624426974, 0.7187799123343397, 0.0,
   -0.3741513111656884, -0.6137225421380228, 0.6952376842667829, 0.0,
   -2390834.612219335,  -3921699.7301742565, 4412849.998474161,  1.0
]
R = [[M[0],M[4],M[8]], [M[1],M[5],M[9]], [M[2],M[6],M[10]]]
T = [M[12], M[13], M[14]]

WGS84_A = 6378137.0
WGS84_E2 = 0.00669437999014

def local_to_ecef(lx, ly, lz):
    return (
        R[0][0]*lx + R[0][1]*ly + R[0][2]*lz + T[0],
        R[1][0]*lx + R[1][1]*ly + R[1][2]*lz + T[1],
        R[2][0]*lx + R[2][1]*ly + R[2][2]*lz + T[2]
    )

def ecef_to_geodetic(x, y, z):
    """Bowring iterative method — accurate for all latitudes"""
    a, e2 = WGS84_A, WGS84_E2
    b = a * math.sqrt(1 - e2)
    ep2 = (a**2 - b**2) / b**2
    p = math.sqrt(x**2 + y**2)
    theta = math.atan2(z * a, p * b)
    lat = math.atan2(z + ep2 * b * math.sin(theta)**3,
                     p - e2 * a * math.cos(theta)**3)
    for _ in range(10):
        sl = math.sin(lat)
        N = a / math.sqrt(1 - e2 * sl**2)
        lat_new = math.atan2(z + e2 * N * sl, p)
        if abs(lat_new - lat) < 1e-12:
            break
        lat = lat_new
    lon = math.atan2(y, x)
    sl = math.sin(lat)
    N = a / math.sqrt(1 - e2 * sl**2)
    h = p / math.cos(lat) - N
    return math.degrees(lat), math.degrees(lon), h

def make_tileset(taxlot, x_min, x_max, y_min, y_max, z_center, b3dm_uri, out_path):
    cx = (x_min + x_max) / 2
    cy = (y_min + y_max) / 2
    hx = (x_max - x_min) / 2
    hy = (y_max - y_min) / 2

    # Convert center to geodetic to verify placement
    ex, ey, ez = local_to_ecef(cx, cy, z_center)
    lat, lon, alt = ecef_to_geodetic(ex, ey, ez)
    print(f"Parcel {taxlot} center: lat={lat:.5f}, lon={lon:.5f}, alt={alt:.0f}m")

    tileset = {
        "asset": {"version": "1.0"},
        "geometricError": 50,
        "root": {
            "boundingVolume": {
                "box": [cx, cy, z_center, hx, 0, 0, 0, hy, 0, 0, 0, 30]
            },
            "geometricError": 10,
            "refine": "ADD",
            "transform": M,
            "content": {"uri": b3dm_uri}
        }
    }

    with open(out_path, 'w') as f:
        json.dump(tileset, f, indent=2)
    print(f"Tileset written: {out_path}")
    return lat, lon, alt

if __name__ == '__main__':
    # Default: test parcel 181102D000600
    # Local bbox from clip output: x=-470.65 to -247.82, y=-806.74 to -518.96, z~-384
    make_tileset(
        taxlot='181102D000600',
        x_min=-470.65, x_max=-247.82,
        y_min=-806.74, y_max=-518.96,
        z_center=-384.0,
        b3dm_uri='clipped.b3dm',
        out_path=sys.argv[1] if len(sys.argv) > 1 else 'tileset.json'
    )
