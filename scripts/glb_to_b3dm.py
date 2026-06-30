"""
glb_to_b3dm.py
Wraps a GLB file in a minimal B3DM container (3D Tiles 1.0 spec).

B3DM layout:
  [28-byte header]
  [Feature Table JSON]  (padded to 8-byte boundary)
  [Feature Table Binary] (empty for our case)
  [Batch Table JSON]     (empty)
  [Batch Table Binary]   (empty)
  [GLB body]

Usage: python glb_to_b3dm.py <input.glb> <output.b3dm>
"""
import sys, json, struct

def pad_to_8(data: bytes, pad_char=b' ') -> bytes:
    rem = len(data) % 8
    if rem == 0:
        return data
    return data + pad_char * (8 - rem)

def main():
    if len(sys.argv) != 3:
        print("Usage: python glb_to_b3dm.py <input.glb> <output.b3dm>")
        sys.exit(1)

    glb_path, b3dm_path = sys.argv[1], sys.argv[2]

    with open(glb_path, 'rb') as f:
        glb_data = f.read()

    # Minimal feature table: BATCH_LENGTH=0 is required by spec
    feature_table = {"BATCH_LENGTH": 0}
    feature_table_json = pad_to_8(json.dumps(feature_table).encode('utf-8'))
    feature_table_bin = b''

    batch_table_json = pad_to_8(b'{}')
    batch_table_bin = b''

    # Body (glTF/GLB) must also be 8-byte aligned per spec recommendation
    glb_padded = pad_to_8(glb_data, pad_char=b'\x00')

    header_len = 28
    ft_json_len = len(feature_table_json)
    ft_bin_len = len(feature_table_bin)
    bt_json_len = len(batch_table_json)
    bt_bin_len = len(batch_table_bin)
    glb_len = len(glb_padded)

    total_len = header_len + ft_json_len + ft_bin_len + bt_json_len + bt_bin_len + glb_len

    # B3DM header: magic(4) + version(4) + byteLength(4) + ftJSONLen(4) + ftBinLen(4) + btJSONLen(4) + btBinLen(4)
    header = struct.pack(
        '<4sIIIIII',
        b'b3dm', 1, total_len,
        ft_json_len, ft_bin_len,
        bt_json_len, bt_bin_len
    )

    with open(b3dm_path, 'wb') as f:
        f.write(header)
        f.write(feature_table_json)
        f.write(feature_table_bin)
        f.write(batch_table_json)
        f.write(batch_table_bin)
        f.write(glb_padded)

    print(f"B3DM written: {b3dm_path}")
    print(f"  Total size: {total_len} bytes")

if __name__ == '__main__':
    main()
