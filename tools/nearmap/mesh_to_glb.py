#!/usr/bin/env python3
"""Nearmap MapBrowser MeshTiledOBJ -> GLB in a local metre frame, for nearmap-viewer.

Input : the MapBrowser 3D delivery (outer zip, or the MeshTiledOBJ-*.zip, or an
        extracted folder holding Mesh/Mesh.obj + Mesh.mtl + textures + .ofs + Tiles.prj)
        and the delivery's serve folder (manifest.json with WGS84 nadir bounds).
Output: {serve}/mesh/model.glb        textured mesh (Draco-compressed if gltf-pipeline works)
        {serve}/mesh/mesh.json        frame + nadir.local corners + stats
        manifest.json gains urls.mesh / urls.mesh_meta / mesh{...}

Frame : X east, Y north, Z up, metres. Origin = centre of the nadir bounds,
        projected through the delivery's own Tiles.prj (NAD83 Oregon North, intl ft),
        so grid convergence is carried by the nadir.local corners exactly as
        model-viewer's bilinear localFromPct expects. Z0 = 2nd percentile of z.

Does not call AWS or GitHub. promote.py uploads mesh/* with the rest of the serve dir.

  python tools/nearmap/mesh_to_glb.py --zip "C:/.../Ahartsi.zip" ^
      --member "Ahartsi/MapBrowser_3D/18775 MACALPINE LOOP.zip" ^
      --serve-dir tmp/nearmap-serve/18775-macalpine-loop-bend-or-97702
"""
from __future__ import annotations

import argparse
import io
import json
import shutil
import struct
import subprocess
import tempfile
import zipfile
from pathlib import Path

import numpy as np

FT_INTL = 0.3048


def open_mesh_source(args) -> tuple[dict, str]:
    """Return {name: bytes} for the Mesh folder + Tiles.prj, and a label."""
    files: dict[str, bytes] = {}

    def take_from_zip(zf: zipfile.ZipFile):
        for info in zf.infolist():
            n = info.filename
            base = n.split("/")[-1]
            if n.startswith("Mesh/") and base:
                files["Mesh/" + base] = zf.read(n)
            elif base.lower() in ("tiles.prj", "readme.pdf"):
                files[base] = zf.read(n)

    if args.folder:
        root = Path(args.folder)
        for p in root.rglob("*"):
            if p.is_file():
                rel = p.relative_to(root).as_posix()
                if rel.startswith("Mesh/") or p.name.lower() in ("tiles.prj",):
                    files[rel if rel.startswith("Mesh/") else p.name] = p.read_bytes()
        return files, str(root)

    zp = Path(args.zip)
    with zipfile.ZipFile(zp) as z:
        names = z.namelist()
        if args.member:
            outer = zipfile.ZipFile(io.BytesIO(z.read(args.member)))
            inner_name = next(n for n in outer.namelist() if "MeshTiledOBJ" in n and n.lower().endswith(".zip"))
            inner = zipfile.ZipFile(io.BytesIO(outer.read(inner_name)))
            take_from_zip(inner)
            return files, f"{zp.name}::{args.member}::{inner_name}"
        if any(n.startswith("Mesh/") for n in names):
            take_from_zip(z)
            return files, zp.name
        inner_name = next(n for n in names if "MeshTiledOBJ" in n and n.lower().endswith(".zip"))
        inner = zipfile.ZipFile(io.BytesIO(z.read(inner_name)))
        take_from_zip(inner)
        return files, f"{zp.name}::{inner_name}"


def parse_obj(data: bytes):
    """Return positions (N,3) float64, uvs (M,2) float32, and per-material face arrays
    of (v_idx, vt_idx) int32 shaped (F,3,2). Handles 'f v/vt' and 'f v/vt/vn'."""
    v, vt = [], []
    groups: dict[str, list] = {}
    cur = "default"
    for line in data.split(b"\n"):
        if line.startswith(b"v "):
            p = line.split()
            v.append((float(p[1]), float(p[2]), float(p[3])))
        elif line.startswith(b"vt "):
            p = line.split()
            vt.append((float(p[1]), float(p[2])))
        elif line.startswith(b"usemtl"):
            cur = line.split(None, 1)[1].decode().strip() if b" " in line else "default"
            groups.setdefault(cur, [])
        elif line.startswith(b"f "):
            p = line.split()[1:]
            if len(p) < 3:
                continue
            idx = []
            for tok in p:
                parts = tok.split(b"/")
                vi = int(parts[0]) - 1
                ti = int(parts[1]) - 1 if len(parts) > 1 and parts[1] else -1
                idx.append((vi, ti))
            g = groups.setdefault(cur, [])
            for k in range(1, len(idx) - 1):  # fan-triangulate polygons
                g.append((idx[0], idx[k], idx[k + 1]))
    pos = np.asarray(v, dtype=np.float64)
    uv = np.asarray(vt, dtype=np.float32) if vt else np.zeros((0, 2), np.float32)
    faces = {m: np.asarray(f, dtype=np.int64) for m, f in groups.items() if f}
    return pos, uv, faces


def parse_mtl(data: bytes) -> dict[str, str]:
    mats, cur = {}, None
    for line in data.decode("utf-8", "replace").splitlines():
        s = line.strip()
        if s.startswith("newmtl"):
            cur = s.split(None, 1)[1].strip()
        elif s.startswith("map_Kd") and cur:
            mats[cur] = s.split(None, 1)[1].strip()
    return mats


def project_frame(prj_wkt: str, bounds: dict):
    from pyproj import CRS, Transformer
    crs_local = CRS.from_wkt(prj_wkt)
    tf = Transformer.from_crs("EPSG:4326", crs_local, always_xy=True)
    lat0 = (bounds["north"] + bounds["south"]) / 2
    lng0 = (bounds["east"] + bounds["west"]) / 2
    e0, n0 = tf.transform(lng0, lat0)

    def local_xy(lng, lat):
        e, n = tf.transform(lng, lat)
        return [(e - e0) * FT_INTL, (n - n0) * FT_INTL]

    corners = {
        "nw": local_xy(bounds["west"], bounds["north"]),
        "ne": local_xy(bounds["east"], bounds["north"]),
        "sw": local_xy(bounds["west"], bounds["south"]),
        "se": local_xy(bounds["east"], bounds["south"]),
    }
    return crs_local, (e0, n0), (lat0, lng0), corners


def encode_texture(jpg_bytes: bytes, max_px: int, quality: int) -> tuple[bytes, tuple[int, int]]:
    from PIL import Image
    im = Image.open(io.BytesIO(jpg_bytes)).convert("RGB")
    if max(im.size) > max_px:
        im.thumbnail((max_px, max_px), Image.LANCZOS)
    out = io.BytesIO()
    im.save(out, format="JPEG", quality=quality, optimize=True)
    return out.getvalue(), im.size


def build_glb(prims: list[dict], textures: list[bytes]) -> bytes:
    """prims: [{pos: (N,3) f32, uv: (N,2) f32, idx: (F*3,) u32, tex: int}]"""
    import pygltflib as g

    blob = bytearray()
    buffer_views, accessors, meshes_prims, images, gtextures, materials = [], [], [], [], [], []

    def add_view(data: bytes, target=None) -> int:
        while len(blob) % 4:
            blob.extend(b"\0")
        off = len(blob)
        blob.extend(data)
        bv = g.BufferView(buffer=0, byteOffset=off, byteLength=len(data))
        if target:
            bv.target = target
        buffer_views.append(bv)
        return len(buffer_views) - 1

    for ti, tex in enumerate(textures):
        bvi = add_view(tex)
        images.append(g.Image(bufferView=bvi, mimeType="image/jpeg"))
        gtextures.append(g.Texture(source=ti, sampler=0))
        materials.append(g.Material(
            pbrMetallicRoughness=g.PbrMetallicRoughness(
                baseColorTexture=g.TextureInfo(index=ti), metallicFactor=0.0, roughnessFactor=1.0),
            doubleSided=True, name=f"Mesh-{ti}"))

    for p in prims:
        pos = np.ascontiguousarray(p["pos"], dtype=np.float32)
        uv = np.ascontiguousarray(p["uv"], dtype=np.float32)
        idx = np.ascontiguousarray(p["idx"], dtype=np.uint32)
        bv_pos = add_view(pos.tobytes(), g.ARRAY_BUFFER)
        bv_uv = add_view(uv.tobytes(), g.ARRAY_BUFFER)
        bv_idx = add_view(idx.tobytes(), g.ELEMENT_ARRAY_BUFFER)
        accessors.append(g.Accessor(bufferView=bv_pos, componentType=g.FLOAT, count=len(pos), type=g.VEC3,
                                    min=pos.min(axis=0).tolist(), max=pos.max(axis=0).tolist()))
        a_pos = len(accessors) - 1
        accessors.append(g.Accessor(bufferView=bv_uv, componentType=g.FLOAT, count=len(uv), type=g.VEC2))
        a_uv = len(accessors) - 1
        accessors.append(g.Accessor(bufferView=bv_idx, componentType=g.UNSIGNED_INT, count=len(idx), type=g.SCALAR))
        a_idx = len(accessors) - 1
        meshes_prims.append(g.Primitive(attributes=g.Attributes(POSITION=a_pos, TEXCOORD_0=a_uv),
                                        indices=a_idx, material=p["tex"]))

    gltf = g.GLTF2(
        asset=g.Asset(version="2.0", generator="property-intel mesh_to_glb"),
        scene=0,
        scenes=[g.Scene(nodes=[0])],
        nodes=[g.Node(mesh=0, name="nearmap-mesh")],
        meshes=[g.Mesh(primitives=meshes_prims, name="nearmap-mesh")],
        accessors=accessors,
        bufferViews=buffer_views,
        buffers=[g.Buffer(byteLength=len(blob))],
        images=images,
        textures=gtextures,
        samplers=[g.Sampler(magFilter=g.LINEAR, minFilter=g.LINEAR_MIPMAP_LINEAR, wrapS=g.CLAMP_TO_EDGE, wrapT=g.CLAMP_TO_EDGE)],
        materials=materials,
    )
    gltf.set_binary_blob(bytes(blob))
    return b"".join(gltf.save_to_bytes())


def draco_compress(src: Path, dst: Path) -> bool:
    try:
        r = subprocess.run(["npx", "--yes", "gltf-pipeline", "-i", str(src), "-o", str(dst), "-d",
                            "--draco.compressionLevel", "7"], capture_output=True, text=True, timeout=900, shell=True)
        return r.returncode == 0 and dst.is_file() and dst.stat().st_size > 0
    except Exception:
        return False


def main() -> int:
    ap = argparse.ArgumentParser(description="MapBrowser OBJ mesh -> GLB (local metre frame) for nearmap-viewer")
    ap.add_argument("--zip", help="Ahartsi.zip (outer) or MeshTiledOBJ-*.zip")
    ap.add_argument("--member", default="", help="inner MapBrowser_3D zip path inside --zip (when --zip is the outer delivery)")
    ap.add_argument("--folder", default="", help="extracted folder holding Mesh/ and Tiles.prj (instead of --zip)")
    ap.add_argument("--serve-dir", required=True, help="tmp/nearmap-serve/{delivery_id}")
    ap.add_argument("--max-texture", type=int, default=4096)
    ap.add_argument("--jpeg-quality", type=int, default=82)
    ap.add_argument("--no-draco", action="store_true")
    args = ap.parse_args()
    if not args.zip and not args.folder:
        raise SystemExit("need --zip or --folder")

    serve = Path(args.serve_dir)
    man_path = serve / "manifest.json"
    if not man_path.is_file():
        raise SystemExit(f"missing {man_path}")
    manifest = json.loads(man_path.read_text(encoding="utf-8"))
    bounds = manifest.get("bounds") or {}
    if not all(k in bounds for k in ("north", "south", "east", "west")):
        raise SystemExit("manifest.json has no WGS84 bounds")
    did = manifest.get("delivery_id") or serve.name

    files, label = open_mesh_source(args)
    print(f"source: {label}")
    obj_name = next((k for k in files if k.lower().endswith(".obj")), None)
    mtl_name = next((k for k in files if k.lower().endswith(".mtl")), None)
    ofs_name = next((k for k in files if k.lower().endswith(".ofs")), None)
    prj_name = next((k for k in files if k.lower().endswith(".prj")), None)
    if not (obj_name and mtl_name and ofs_name and prj_name):
        raise SystemExit(f"mesh source incomplete: obj={obj_name} mtl={mtl_name} ofs={ofs_name} prj={prj_name}")

    ofs = [float(x) for x in files[ofs_name].decode().strip().split(",")]
    prj_wkt = files[prj_name].decode("utf-8", "replace").strip()
    crs_local, (e0, n0), (lat0, lng0), corners = project_frame(prj_wkt, bounds)
    print(f"crs: {crs_local.name}")
    print(f"origin: lat {lat0:.7f} lng {lng0:.7f} -> E {e0:.3f} N {n0:.3f} (ft)")

    print("parsing OBJ …")
    pos_ft, uv, faces = parse_obj(files[obj_name])
    mats = parse_mtl(files[mtl_name])
    print(f"  vertices {len(pos_ft):,} uvs {len(uv):,} materials {list(faces)}")

    # local metres: X east, Y north, Z up. Z0 = 2nd percentile so the ground sits near 0.
    z_ft = pos_ft[:, 2] + ofs[2]
    z0_ft = float(np.percentile(z_ft, 2))
    local = np.empty_like(pos_ft)
    local[:, 0] = (pos_ft[:, 0] + ofs[0] - e0) * FT_INTL
    local[:, 1] = (pos_ft[:, 1] + ofs[1] - n0) * FT_INTL
    local[:, 2] = (z_ft - z0_ft) * FT_INTL

    # textures, one per material in MTL order
    mat_names = list(mats.keys())
    textures, tex_sizes = [], []
    for m in mat_names:
        raw = files.get("Mesh/" + mats[m])
        if raw is None:
            raise SystemExit(f"texture {mats[m]} missing for material {m}")
        enc, size = encode_texture(raw, args.max_texture, args.jpeg_quality)
        textures.append(enc)
        tex_sizes.append(size)
        print(f"  texture {mats[m]} -> {size[0]}x{size[1]} {len(enc)/1e6:.1f} MB")

    # per material: unique (v, vt) pairs -> vertex arrays + indices
    prims = []
    total_tris = 0
    for m, tri in faces.items():
        if m not in mats:
            print(f"  warn: faces use material {m} not in MTL; skipping {len(tri):,} tris")
            continue
        flat = tri.reshape(-1, 2)  # (F*3, 2) of (v, vt)
        key = flat[:, 0].astype(np.int64) * (len(uv) + 1) + (flat[:, 1] + 1)
        uniq, inv = np.unique(key, return_inverse=True)
        vi = uniq // (len(uv) + 1)
        ti = uniq % (len(uv) + 1) - 1
        p = local[vi].astype(np.float32)
        t = np.zeros((len(uniq), 2), np.float32)
        ok = ti >= 0
        t[ok] = uv[ti[ok]]
        t[:, 1] = 1.0 - t[:, 1]  # OBJ v-up -> glTF v-down
        prims.append({"pos": p, "uv": t, "idx": inv.astype(np.uint32), "tex": mat_names.index(m)})
        total_tris += len(tri)
        print(f"  primitive {m}: {len(uniq):,} verts, {len(tri):,} tris")

    out_dir = serve / "mesh"
    out_dir.mkdir(parents=True, exist_ok=True)
    raw_glb = out_dir / "model.raw.glb"
    glb = out_dir / "model.glb"
    print("writing GLB …")
    raw_glb.write_bytes(build_glb(prims, textures))
    print(f"  {raw_glb.name}: {raw_glb.stat().st_size/1e6:.1f} MB")
    draco = False
    if not args.no_draco:
        print("draco (gltf-pipeline) …")
        draco = draco_compress(raw_glb, glb)
    if draco:
        print(f"  {glb.name}: {glb.stat().st_size/1e6:.1f} MB (draco)")
        raw_glb.unlink(missing_ok=True)
    else:
        shutil.move(str(raw_glb), str(glb))
        print(f"  {glb.name}: {glb.stat().st_size/1e6:.1f} MB (uncompressed; gltf-pipeline unavailable or --no-draco)")

    bbox_min = local.min(axis=0).tolist()
    bbox_max = local.max(axis=0).tolist()
    base = None
    for k in ("manifest", "vert"):
        u = (manifest.get("urls") or {}).get(k)
        if u:
            base = u.rsplit("/", 1)[0]
            break
    meta = {
        "delivery_id": did,
        "source": "Nearmap MapBrowser MeshTiledOBJ",
        "glb": "mesh/model.glb",
        "draco": draco,
        "units": "m",
        "axes": "x east, y north, z up",
        "crs_source": crs_local.name,
        "origin": {"lat": lat0, "lng": lng0, "e_ft": e0, "n_ft": n0, "z0_ft": z0_ft, "ofs": ofs},
        "bounds": bounds,
        "local": corners,
        "bbox": {"min": bbox_min, "max": bbox_max},
        "vertices": int(len(pos_ft)),
        "triangles": int(total_tris),
        "textures": [{"px": list(s)} for s in tex_sizes],
        "generated_at": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
    }
    (out_dir / "mesh.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    manifest.setdefault("urls", {})
    if base:
        manifest["urls"]["mesh"] = f"{base}/mesh/model.glb"
        manifest["urls"]["mesh_meta"] = f"{base}/mesh/mesh.json"
    manifest["mesh"] = {"glb": "mesh/model.glb", "meta": "mesh/mesh.json", "draco": draco,
                        "local": corners, "bbox": meta["bbox"], "triangles": meta["triangles"]}
    man_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"manifest.json updated (urls.mesh, urls.mesh_meta, mesh). local corners: {json.dumps(corners)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
