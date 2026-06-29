#!/bin/bash
# generate-zoom-tiles.sh
# Generates z20 and z21 tiles by upscaling from z19
# Run in AWS CloudShell — no local install needed

BUCKET="property-intel-tiles"
CAPTURES=("bend-5-21-26" "bend-5-21-26-run3")
SOURCE_ZOOM=19
TARGET_ZOOMS=(20 21)
TMPDIR="/tmp/tiles"

# Install Pillow if needed
pip install Pillow --quiet --break-system-packages 2>/dev/null || pip install Pillow --quiet

python3 << 'PYEOF'
import boto3, os, sys
from PIL import Image
import io

BUCKET = "property-intel-tiles"
CAPTURES = ["bend-5-21-26", "bend-5-21-26-run3"]
SOURCE_ZOOM = 19
TARGET_ZOOMS = [20, 21]

s3 = boto3.client('s3', region_name='us-east-1')

def get_z19_tiles(capture_id):
    """List all z19 tiles for a capture"""
    prefix = f"captures/plane/{capture_id}/map/{SOURCE_ZOOM}/"
    paginator = s3.get_paginator('list_objects_v2')
    tiles = []
    for page in paginator.paginate(Bucket=BUCKET, Prefix=prefix):
        for obj in page.get('Contents', []):
            key = obj['Key']
            parts = key.split('/')
            if len(parts) >= 2 and parts[-1].endswith('.png'):
                x = int(parts[-2])
                y = int(parts[-1].replace('.png', ''))
                tiles.append((x, y, key))
    return tiles

def download_tile(key):
    """Download a tile and return as PIL Image"""
    resp = s3.get_object(Bucket=BUCKET, Key=key)
    return Image.open(io.BytesIO(resp['Body'].read())).convert('RGBA')

def upload_tile(img, key):
    """Upload a PIL Image as PNG to S3"""
    buf = io.BytesIO()
    img.save(buf, format='PNG', optimize=True)
    buf.seek(0)
    s3.put_object(
        Bucket=BUCKET,
        Key=key,
        Body=buf,
        ContentType='image/png',
        CacheControl='public, max-age=31536000'
    )

def generate_children(x, y, zoom, img):
    """
    Given a tile at (x, y, zoom), generate 4 child tiles at zoom+1.
    Each child is a 256x256 crop of the 512x512 upscaled parent.
    """
    # Upscale to 512x512
    big = img.resize((512, 512), Image.LANCZOS)
    # Child tile coordinates
    children = [
        (2*x,   2*y,   big.crop((0,   0,   256, 256))),  # top-left
        (2*x+1, 2*y,   big.crop((256, 0,   512, 256))),  # top-right
        (2*x,   2*y+1, big.crop((0,   256, 256, 512))),  # bottom-left
        (2*x+1, 2*y+1, big.crop((256, 256, 512, 512))),  # bottom-right
    ]
    return children

for capture_id in CAPTURES:
    print(f"\nProcessing {capture_id}...")
    tiles = get_z19_tiles(capture_id)
    print(f"  Found {len(tiles)} z19 tiles")

    for i, (x, y, key) in enumerate(tiles):
        print(f"  [{i+1}/{len(tiles)}] z19/{x}/{y}", end='\r')
        sys.stdout.flush()

        try:
            img = download_tile(key)
        except Exception as e:
            print(f"\n  ERROR downloading {key}: {e}")
            continue

        # Generate z20 children from z19 tile
        z20_children = generate_children(x, y, SOURCE_ZOOM, img)

        for cx, cy, child_img in z20_children:
            z20_key = f"captures/plane/{capture_id}/map/20/{cx}/{cy}.png"
            try:
                upload_tile(child_img, z20_key)
            except Exception as e:
                print(f"\n  ERROR uploading z20/{cx}/{cy}: {e}")
                continue

            # Generate z21 grandchildren from z20 child
            z21_children = generate_children(cx, cy, 20, child_img)
            for gcx, gcy, gc_img in z21_children:
                z21_key = f"captures/plane/{capture_id}/map/21/{gcx}/{gcy}.png"
                try:
                    upload_tile(gc_img, z21_key)
                except Exception as e:
                    print(f"\n  ERROR uploading z21/{gcx}/{gcy}: {e}")

    print(f"\n  Done {capture_id}")

print("\nAll done! Run update-tile-extents.ps1 to update captures.json")
PYEOF
