from PIL import Image, ImageDraw, ImageFont
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
SPRITES = os.path.join(ROOT, "..", "assets", "generated", "sprites")
PREVIEW = os.path.join(ROOT, "..", "assets", "generated", "sprites-preview")
OUT = os.path.join(ROOT, "..", "assets", "generated", "sprites-preview", "_comparaison.png")

CELL = 260
PAD = 24
LABEL_H = 34
ROW_LABEL_W = 210

try:
    font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 18)
    font_row = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 20)
    font_title = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 28)
except Exception:
    font = font_row = font_title = ImageFont.load_default()

rows = [
    ("Actuel (prototype)", [
        ("pyjama", os.path.join(SPRITES, "av_claire_brun_coiffe.png")),
    ]),
    ("Avatar A/B (pantalon) — piste détaillée", [
        ("pyjama", os.path.join(PREVIEW, "avatar-a_pyjama.png")),
        ("habillé", os.path.join(PREVIEW, "avatar-a_habille.png")),
        ("prêt", os.path.join(PREVIEW, "avatar-a_pret.png")),
        ("manteau", os.path.join(PREVIEW, "avatar-a_manteau.png")),
    ]),
    ("Avatar C/D (robe) — piste détaillée", [
        ("pyjama", os.path.join(PREVIEW, "avatar-c_pyjama.png")),
        ("habillée", os.path.join(PREVIEW, "avatar-c_habille_robe.png")),
        ("prête", os.path.join(PREVIEW, "avatar-c_pret.png")),
        ("manteau", os.path.join(PREVIEW, "avatar-c_manteau.png")),
    ]),
]

n_cols = max(len(r[1]) for r in rows)
title_h = 50
width = ROW_LABEL_W + n_cols * (CELL + PAD) + PAD
height = title_h + len(rows) * (CELL + LABEL_H + PAD) + PAD

canvas = Image.new("RGBA", (width, height), (243, 231, 231, 255))
d = ImageDraw.Draw(canvas)
d.text((PAD, 14), "Sprites d'avatar — comparaison actuel / piste plus détaillée", font=font_title, fill=(34, 31, 26, 255))

y = title_h + PAD
for row_label, cells in rows:
    d.text((PAD, y + CELL // 2 - 10), row_label, font=font_row, fill=(34, 31, 26, 255))
    x = ROW_LABEL_W
    for label, path in cells:
        img = Image.open(path).convert("RGBA")
        ratio = min(CELL / img.width, CELL / img.height)
        new_size = (int(img.width * ratio), int(img.height * ratio))
        img_resized = img.resize(new_size, Image.NEAREST)
        cell_bg = Image.new("RGBA", (CELL, CELL), (255, 255, 255, 0))
        d.rectangle([x, y, x + CELL, y + CELL], outline=(200, 190, 180, 255), width=1)
        offset = ((CELL - new_size[0]) // 2, (CELL - new_size[1]) // 2)
        canvas.alpha_composite(img_resized, (x + offset[0], y + offset[1]))
        d.text((x + 8, y + CELL + 4), label, font=font, fill=(74, 68, 55, 255))
        x += CELL + PAD
    y += CELL + LABEL_H + PAD

canvas.convert("RGB").save(OUT)
print(OUT)
