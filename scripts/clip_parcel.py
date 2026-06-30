"""
clip_parcel.py
Clips BlockR.obj to a single parcel polygon (from Deschutes County GeoJSON).
"""
import sys, json, math

# ── B3DM tileset transform — EXACT flat array as it appears in tileset.json ──
# 3D Tiles spec: column-major 4x4. m[0:4]=col0, m[4:8]=col1, m[8:12]=col2, m[12:16]=col3(translation)
M = [
    0.8538393068677613, -0.5205366827108161, 0.0, 0.0,
    0.3618967178637809,  0.5936212624426974, 0.7187799123343397, 0.0,
   -0.3741513111656884, -0.6137225421380228, 0.6952376842667829, 0.0,
   -2390834.612219335,  -3921699.7301742565, 4412849.998474161,  1.0
]

col0 = M[0:4]
col1 = M[4:8]
col2 = M[8:12]
col3 = M[12:16]

# R[row][col] = col_col[row]  (local -> ECEF: ECEF = R @ local + T)
R = [
    [col0[0], col1[0], col2[0]],
    [col0[1], col1[1], col2[1]],
    [col0[2], col1[2], col2[2]],
]
T = [col3[0], col3[1], col3[2]]

def mat3_transpose(m):
    return [[m[j][i] for j in range(3)] for i in range(3)]

R_T = mat3_transpose(R)  # R is orthonormal -> R^-1 == R^T

def ecef_to_local(ex, ey, ez):
    dx, dy, dz = ex - T[0], ey - T[1], ez - T[2]
    lx = R_T[0][0]*dx + R_T[0][1]*dy + R_T[0][2]*dz
    ly = R_T[1][0]*dx + R_T[1][1]*dy + R_T[1][2]*dz
    lz = R_T[2][0]*dx + R_T[2][1]*dy + R_T[2][2]*dz
    return lx, ly, lz

WGS84_A = 6378137.0
WGS84_E2 = 0.00669437999014

def geodetic_to_ecef(lat_deg, lon_deg, h=0.0):
    lat = math.radians(lat_deg)
    lon = math.radians(lon_deg)
    sin_lat = math.sin(lat)
    N = WGS84_A / math.sqrt(1 - WGS84_E2 * sin_lat * sin_lat)
    x = (N + h) * math.cos(lat) * math.cos(lon)
    y = (N + h) * math.cos(lat) * math.sin(lon)
    z = (N * (1 - WGS84_E2) + h) * sin_lat
    return x, y, z

def latlon_to_local(lat, lon):
    ex, ey, ez = geodetic_to_ecef(lat, lon)
    return ecef_to_local(ex, ey, ez)

def point_in_poly(x, y, poly):
    n = len(poly)
    inside = False
    j = n - 1
    for i in range(n):
        xi, yi = poly[i]
        xj, yj = poly[j]
        if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi + 1e-15) + xi):
            inside = not inside
        j = i
    return inside

def main():
    if len(sys.argv) != 5:
        print("Usage: python clip_parcel.py <input.obj> <parcels.geojson> <TAXLOT_ID> <output.obj>")
        sys.exit(1)

    obj_path, geojson_path, taxlot_id, out_path = sys.argv[1:5]

    with open(geojson_path) as f:
        parcels = json.load(f)
    parcel = next((f for f in parcels['features'] if f['properties']['TAXLOT'] == taxlot_id), None)
    if not parcel:
        print(f"TAXLOT {taxlot_id} not found")
        sys.exit(1)

    lonlat_coords = parcel['geometry']['coordinates'][0]
    print(f"Parcel {taxlot_id}: {len(lonlat_coords)} boundary points")

    local_poly = []
    for lon, lat in lonlat_coords:
        lx, ly, lz = latlon_to_local(lat, lon)
        local_poly.append((lx, ly))

    xs = [p[0] for p in local_poly]
    ys = [p[1] for p in local_poly]
    print(f"Local-space bbox: x={min(xs):.2f} to {max(xs):.2f}, y={min(ys):.2f} to {max(ys):.2f}")

    vertices = []
    faces = []
    with open(obj_path) as f:
        for line in f:
            if line.startswith('v '):
                parts = line.split()
                vertices.append((float(parts[1]), float(parts[2]), float(parts[3])))
            elif line.startswith('f '):
                parts = line.split()[1:]
                idxs = [int(p.split('/')[0]) for p in parts]
                if len(idxs) == 3:
                    faces.append(tuple(idxs))
                elif len(idxs) == 4:
                    faces.append((idxs[0], idxs[1], idxs[2]))
                    faces.append((idxs[0], idxs[2], idxs[3]))

    vxs = [v[0] for v in vertices]
    vys = [v[1] for v in vertices]
    print(f"OBJ vertex bbox: x={min(vxs):.2f} to {max(vxs):.2f}, y={min(vys):.2f} to {max(vys):.2f}")
    print(f"OBJ loaded: {len(vertices)} vertices, {len(faces)} faces")

    inside_flags = [point_in_poly(v[0], v[1], local_poly) for v in vertices]
    n_inside = sum(inside_flags)
    print(f"Vertices inside parcel: {n_inside} / {len(vertices)}")

    if n_inside == 0:
        print("WARNING: still zero matches — check axis order or units")
        sys.exit(1)

    kept_faces = [f for f in faces if all(inside_flags[i-1] for i in f)]
    print(f"Faces fully inside parcel: {len(kept_faces)} / {len(faces)}")

    used_verts = sorted(set(i for f in kept_faces for i in f))
    remap = {old: new+1 for new, old in enumerate(used_verts)}

    with open(out_path, 'w') as f:
        f.write(f"# Clipped to parcel {taxlot_id}\n")
        for old_idx in used_verts:
            x, y, z = vertices[old_idx - 1]
            f.write(f"v {x} {y} {z}\n")
        for face in kept_faces:
            new_idxs = [remap[i] for i in face]
            f.write(f"f {new_idxs[0]} {new_idxs[1]} {new_idxs[2]}\n")

    print(f"\nClipped OBJ written: {out_path}")
    print(f"  {len(used_verts)} vertices, {len(kept_faces)} faces")

if __name__ == '__main__':
    main()
