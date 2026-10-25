"""
PREVIEW seulement — validation rapide du pipeline "vrais sprites Bitglow".

Assemble une chambre à partir des sprites extraits automatiquement des
packs gratuits Bitglow (voir extract_sprites.py). Pas encore un
assemblage final de chambre — juste de quoi voir si le rendu "vue du
dessus, vrais assets" convainc avant d'investir plus de temps dedans.

Usage :
    /usr/local/bin/python3 scripts/compose_room_from_assets.py
"""

from PIL import Image
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
EXT = os.path.join(ROOT, "..", "assets", "external")
OUT = os.path.join(ROOT, "..", "assets", "generated", "scenes-preview")
os.makedirs(OUT, exist_ok=True)

FLOORSWALLS = os.path.join(EXT, "pixelinterior_LRK_v1.1", "floorswalls_LRK.png")
BEDS_DIR = os.path.join(EXT, "pixelinterior_BR_v1.1", "beds_BR_sprites")
WARDROBES_DIR = os.path.join(EXT, "pixelinterior_BR_v1.1", "wardrobes_BR_sprites")
DECOR_DIR = os.path.join(EXT, "pixelinterior_BR_v1.1", "decorations_BR_sprites")

sheet = Image.open(FLOORSWALLS).convert("RGBA")

# colonne 3 du bloc "planches" (mur blanc + parquet foncé) — cf. relevé de
# coordonnées par balayage de lignes (extract_sprites ne peut pas détecter
# ces tuiles : elles se touchent, pas de séparation transparente)
WALL_COLOR = sheet.crop((145, 17, 206, 47))       # bande murale blanche
FLOOR_TILE = sheet.crop((145, 80, 206, 131))      # parquet foncé, 61x51

bed = Image.open(os.path.join(BEDS_DIR, "sprite_000_13x21_38x62.png")).convert("RGBA")
wardrobe = Image.open(os.path.join(WARDROBES_DIR, "sprite_018_13x189_54x70.png")).convert("RGBA")
trophies = Image.open(os.path.join(DECOR_DIR, "sprite_003_95x50_34x25.png")).convert("RGBA")
picture = Image.open(os.path.join(DECOR_DIR, "sprite_001_129x16_46x32.png")).convert("RGBA")

SCALE = 4
CW, CH = 320, 220  # même canvas logique que le générateur procédural (x4 = 1280x880)

room = Image.new("RGBA", (CW, CH), (0, 0, 0, 255))

WALL_H = 56
# mur : couleur unie répétée
wc = WALL_COLOR.resize((1, 1)).load()[0, 0]
for y in range(0, WALL_H):
    for x0 in range(0, CW, 4):
        room.paste(Image.new("RGBA", (4, 1), wc), (x0, y))

# sol : tuile de parquet répétée
tw, th = FLOOR_TILE.size
for y in range(WALL_H, CH, th):
    for x in range(0, CW, tw):
        room.paste(FLOOR_TILE, (x, y))

# plinthe simple entre mur et sol
room.paste(Image.new("RGBA", (CW, 3), (40, 30, 24, 255)), (0, WALL_H - 3))

def place(img, x, y, scale=1.0):
    if scale != 1.0:
        img = img.resize((int(img.width * scale), int(img.height * scale)), Image.NEAREST)
    room.alpha_composite(img, (x, y))

place(bed, 20, WALL_H - 20)
place(wardrobe, 230, WALL_H - 16)
place(picture, 110, 14)
place(trophies, 240, 20)

final = room.resize((CW * SCALE, CH * SCALE), Image.NEAREST)
out_path = os.path.join(OUT, "leon_chambre_vrais_sprites.png")
final.convert("RGB").save(out_path)
print(out_path)
