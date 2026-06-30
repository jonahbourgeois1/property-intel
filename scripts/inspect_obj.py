"""Quick inspection of the OBJ file structure"""
import sys

obj_path = sys.argv[1]

vt_count = 0
vn_count = 0
usemtl_list = []
face_formats = set()
current_mtl = None

with open(obj_path) as f:
    for i, line in enumerate(f):
        line = line.strip()
        if line.startswith('vt '): vt_count += 1
        elif line.startswith('vn '): vn_count += 1
        elif line.startswith('usemtl '):
            mtl = line.split()[1]
            if mtl not in usemtl_list:
                usemtl_list.append(mtl)
            current_mtl = mtl
        elif line.startswith('f '):
            parts = line.split()[1:]
            fmt = '/'.join(['v/vt/vn' if p.count('/') == 2 else 
                           'v/vt' if p.count('/') == 1 else 'v' 
                           for p in parts[:1]])
            face_formats.add(fmt)

print(f"UV coords (vt): {vt_count}")
print(f"Normals (vn): {vn_count}")
print(f"Unique materials: {len(usemtl_list)}")
print(f"First 10 materials: {usemtl_list[:10]}")
print(f"Face formats: {face_formats}")
