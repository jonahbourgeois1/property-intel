"""
clip_parcel_textured.py
Clips BlockR.obj to a single parcel polygon, preserving UV texture
coordinates and material assignments. Copies only the referenced
texture JPGs to the output folder.

Usage:
    python clip_parcel_textured.py <input.obj> <parcels.geojson> <TAXLOT_ID> <output_dir>

Output:
    <output_dir>/clipped.obj
    <output_dir>/clipped.mtl
    <output_dir>/BlockR_0_X.jpg  (only textures used by kept faces)
"""
import sys, json, math, os, shutil

# ── Transform matrix (local OBJ -> ECEF) ─────────────────────────────────
M = [
    0.8538393068677613, -0.5205366827108161, 0.0, 0.0,
    0.3618967178637809,  0.5936212624426974, 0.7187799123343397, 0.0,
   -0.3741513111656884, -0.6137225421380228, 0.6952376842667829, 0.0,
   -2390834.612219335,  -3921699.7301742565, 4412849.998474161,  1.0
]
R = [[M[0],M[4],M[8]], [M[1],M[5],M[9]], [M[2],M[6],M[10]]]
T = [M[12], M[13], M[14]]
R_T = [[R[j][i] for j in range(3)] for i in range(3)]

def ecef_to_local(ex, ey, ez):
    dx, dy, dz = ex-T[0], ey-T[1], ez-T[2]
    return (R_T[0][0]*dx+R_T[0][1]*dy+R_T[0][2]*dz,
            R_T[1][0]*dx+R_T[1][1]*dy+R_T[1][2]*dz,
            R_T[2][0]*dx+R_T[2][1]*dy+R_T[2][2]*dz)

WGS84_A, WGS84_E2 = 6378137.0, 0.00669437999014

def geodetic_to_ecef(lat, lon, h=0.0):
    lat, lon = math.radians(lat), math.radians(lon)
    sl = math.sin(lat)
    N = WGS84_A / math.sqrt(1 - WGS84_E2 * sl * sl)
    return ((N+h)*math.cos(lat)*math.cos(lon),
            (N+h)*math.cos(lat)*math.sin(lon),
            (N*(1-WGS84_E2)+h)*sl)

def latlon_to_local(lat, lon):
    return ecef_to_local(*geodetic_to_ecef(lat, lon))

def point_in_poly(x, y, poly):
    n, inside, j = len(poly), False, len(poly)-1
    for i in range(n):
        xi, yi = poly[i]; xj, yj = poly[j]
        if ((yi>y)!=(yj>y)) and (x < (xj-xi)*(y-yi)/(yj-yi+1e-15)+xi):
            inside = not inside
        j = i
    return inside

def main():
    if len(sys.argv) != 5:
        print("Usage: python clip_parcel_textured.py <input.obj> <parcels.geojson> <TAXLOT_ID> <output_dir>")
        sys.exit(1)

    obj_path, geojson_path, taxlot_id, out_dir = sys.argv[1:5]
    obj_dir = os.path.dirname(obj_path)
    os.makedirs(out_dir, exist_ok=True)

    # Load parcel
    with open(geojson_path) as f:
        parcels = json.load(f)
    parcel = next((f for f in parcels['features'] if f['properties']['TAXLOT'] == taxlot_id), None)
    if not parcel:
        print(f"TAXLOT {taxlot_id} not found"); sys.exit(1)

    lonlat_coords = parcel['geometry']['coordinates'][0]
    local_poly = [(lambda lx,ly,lz: (lx,ly))(*latlon_to_local(lat, lon)) for lon, lat in lonlat_coords]
    print(f"Parcel {taxlot_id}: {len(local_poly)} boundary points")

    # Parse OBJ — vertices, UV coords, faces with material
    vertices = []   # (x, y, z)
    uvs = []        # (u, v)
    faces = []      # (vi1, vti1, vi2, vti2, vi3, vti3, mtl_name)
    current_mtl = None

    print("Parsing OBJ...", flush=True)
    with open(obj_path) as f:
        for line in f:
            if line.startswith('v '):
                p = line.split()
                vertices.append((float(p[1]), float(p[2]), float(p[3])))
            elif line.startswith('vt '):
                p = line.split()
                uvs.append((float(p[1]), float(p[2])))
            elif line.startswith('usemtl '):
                current_mtl = line.split()[1]
            elif line.startswith('f '):
                parts = line.split()[1:]
                def parse_vert(s):
                    v = s.split('/')
                    return int(v[0]), int(v[1]) if len(v) > 1 and v[1] else 0
                idxs = [parse_vert(p) for p in parts]
                if len(idxs) == 3:
                    faces.append((idxs[0][0], idxs[0][1],
                                  idxs[1][0], idxs[1][1],
                                  idxs[2][0], idxs[2][1], current_mtl))
                elif len(idxs) == 4:
                    faces.append((idxs[0][0], idxs[0][1],
                                  idxs[1][0], idxs[1][1],
                                  idxs[2][0], idxs[2][1], current_mtl))
                    faces.append((idxs[0][0], idxs[0][1],
                                  idxs[2][0], idxs[2][1],
                                  idxs[3][0], idxs[3][1], current_mtl))

    print(f"Parsed: {len(vertices)} verts, {len(uvs)} UVs, {len(faces)} faces")

    # Inside flags
    print("Testing vertices against parcel boundary...", flush=True)
    inside_flags = [point_in_poly(v[0], v[1], local_poly) for v in vertices]
    n_inside = sum(inside_flags)
    print(f"Vertices inside parcel: {n_inside}/{len(vertices)}")

    if n_inside == 0:
        print("ERROR: no vertices inside parcel — check transform"); sys.exit(1)

    # Keep faces where all 3 vertices are inside
    kept = [f for f in faces if inside_flags[f[0]-1] and inside_flags[f[2]-1] and inside_flags[f[4]-1]]
    print(f"Faces kept: {len(kept)}/{len(faces)}")

    # Collect used vertices, UVs, materials
    used_vi  = sorted(set(i for f in kept for i in [f[0], f[2], f[4]]))
    used_vti = sorted(set(i for f in kept for i in [f[1], f[3], f[5]] if i > 0))
    used_mtls = sorted(set(f[6] for f in kept if f[6]))

    vi_map  = {old: new+1 for new, old in enumerate(used_vi)}
    vti_map = {old: new+1 for new, old in enumerate(used_vti)}

    # Write clipped OBJ
    obj_out = os.path.join(out_dir, 'clipped.obj')
    with open(obj_out, 'w') as f:
        f.write(f"# Clipped to parcel {taxlot_id}\n")
        f.write("mtllib clipped.mtl\n")
        for vi in used_vi:
            x, y, z = vertices[vi-1]
            f.write(f"v {x} {y} {z}\n")
        for vti in used_vti:
            u, v = uvs[vti-1]
            f.write(f"vt {u} {v}\n")

        # Group faces by material
        from collections import defaultdict
        by_mtl = defaultdict(list)
        for face in kept:
            by_mtl[face[6]].append(face)

        for mtl, mtl_faces in by_mtl.items():
            f.write(f"usemtl {mtl}\n")
            for face in mtl_faces:
                v1, vt1 = vi_map[face[0]], vti_map.get(face[1], face[1])
                v2, vt2 = vi_map[face[2]], vti_map.get(face[3], face[3])
                v3, vt3 = vi_map[face[4]], vti_map.get(face[5], face[5])
                f.write(f"f {v1}/{vt1} {v2}/{vt2} {v3}/{vt3}\n")

    print(f"OBJ written: {obj_out}")

    # Write trimmed MTL — only materials used by kept faces
    # Read original MTL
    mtl_src = os.path.join(obj_dir, 'BlockR.mtl')
    mtl_entries = {}
    current_entry_name = None
    current_entry_lines = []
    with open(mtl_src) as f:
        for line in f:
            if line.startswith('newmtl '):
                if current_entry_name:
                    mtl_entries[current_entry_name] = current_entry_lines
                current_entry_name = line.split()[1]
                current_entry_lines = [line]
            elif current_entry_name:
                current_entry_lines.append(line)
        if current_entry_name:
            mtl_entries[current_entry_name] = current_entry_lines

    mtl_out = os.path.join(out_dir, 'clipped.mtl')
    copied_textures = set()
    with open(mtl_out, 'w') as f:
        for mtl_name in used_mtls:
            if mtl_name in mtl_entries:
                for line in mtl_entries[mtl_name]:
                    f.write(line)
                    if line.strip().startswith('map_Kd'):
                        tex_name = line.strip().split()[-1]
                        copied_textures.add(tex_name)

    print(f"MTL written: {mtl_out} ({len(used_mtls)} materials)")

    # Copy only referenced texture JPGs
    for tex in copied_textures:
        src = os.path.join(obj_dir, tex)
        dst = os.path.join(out_dir, tex)
        if os.path.exists(src):
            shutil.copy2(src, dst)
            size_mb = os.path.getsize(dst) / 1024 / 1024
            print(f"Copied texture: {tex} ({size_mb:.1f} MB)")
        else:
            print(f"WARNING: texture not found: {src}")

    print(f"\nDone. Output in: {out_dir}")
    print(f"  Vertices: {len(used_vi)}, UVs: {len(used_vti)}, Faces: {len(kept)}")
    print(f"  Materials: {used_mtls}")
    print(f"  Textures copied: {sorted(copied_textures)}")

if __name__ == '__main__':
    main()
