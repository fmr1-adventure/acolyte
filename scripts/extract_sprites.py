"""
Utilitaire : découpe automatiquement les sprites individuels d'une feuille
(atlas) en repérant les blocs de pixels non transparents connectés, sans
dépendre d'une grille fixe (les packs Bitglow n'ont pas de métadonnées
JSON/XML, juste des PNG).

Usage :
    /usr/local/bin/python3 scripts/extract_sprites.py <feuille.png> [out_dir]

Sort un PNG par sprite détecté + une planche-contact annotée pour vérifier
visuellement le découpage.
"""

from PIL import Image, ImageDraw
from scipy import ndimage
import numpy as np
import os
import sys


def extract(sheet_path, out_dir, pad=1, min_area=12):
    os.makedirs(out_dir, exist_ok=True)
    img = Image.open(sheet_path).convert("RGBA")
    arr = np.array(img)
    mask = arr[:, :, 3] > 8

    # dilate légèrement pour souder les pixels d'un même objet séparés par
    # 1-2px transparents (contours, anti-aliasing)
    structure = np.ones((3, 3), dtype=bool)
    dilated = ndimage.binary_dilation(mask, structure=structure, iterations=2)

    labeled, n = ndimage.label(dilated, structure=structure)
    slices = ndimage.find_objects(labeled)

    contact = img.copy()
    cd = ImageDraw.Draw(contact)

    items = []
    for i, sl in enumerate(slices):
        if sl is None:
            continue
        y0, y1 = sl[0].start, sl[0].stop
        x0, x1 = sl[1].start, sl[1].stop
        w, h = x1 - x0, y1 - y0
        if w * h < min_area:
            continue
        x0p, y0p = max(0, x0 - pad), max(0, y0 - pad)
        x1p, y1p = min(img.width, x1 + pad), min(img.height, y1 + pad)
        crop = img.crop((x0p, y0p, x1p, y1p))
        name = f"sprite_{i:03d}_{x0p}x{y0p}_{crop.width}x{crop.height}.png"
        crop.save(os.path.join(out_dir, name))
        items.append((x0p, y0p, x1p, y1p, name))
        cd.rectangle([x0p, y0p, x1p - 1, y1p - 1], outline=(255, 0, 255, 255))

    contact.save(os.path.join(out_dir, "_contact_sheet.png"))
    print(f"{len(items)} sprites détectés -> {out_dir}")
    for x0, y0, x1, y1, name in items:
        print(f"  {name}  ({x1 - x0}x{y1 - y0} @ {x0},{y0})")


if __name__ == "__main__":
    sheet = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else os.path.splitext(sheet)[0] + "_sprites"
    extract(sheet, out)
