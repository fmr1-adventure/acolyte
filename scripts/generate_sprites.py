"""
Génère tous les sprites pixel art de l'application "routine du matin".

Usage :
    pip install --break-system-packages pillow
    python3 generate_sprites.py

Produit un dossier ../sprites/ contenant :
  - av_{carnation}_{cheveux}_{ebouriffe|coiffe}.png   (40 fichiers, l'avatar)
  - overlay_vetements.png, overlay_chaussures.png,
    overlay_manteau.png, overlay_sparkle.png           (calques indépendants de l'avatar)
  - bol_vide.png, bol_plein.png                        (objet petit-déjeuner)
  - sac_pas_pret.png, sac_pret.png                     (objet sac à dos)

Toutes les images sont des grilles pixel art dessinées avec des formes
géométriques simples (ellipses/rectangles) à basse résolution, puis
agrandies avec un rééchantillonnage NEAREST (pas de lissage) pour garder
un rendu "blocs" net. C'est un choix délibéré : ça reste 100% généré par
code, sans dépendance à des assets externes, et facilement paramétrable.

Pour ajouter une carnation ou une couleur de cheveux : ajoutez une entrée
dans SKINS ou HAIRS ci-dessous et relancez le script.
"""

from PIL import Image, ImageDraw
import os

# ---------------------------------------------------------------------------
# Réglages généraux
# ---------------------------------------------------------------------------
W, H = 24, 32          # grille native du personnage
PW, PH = 20, 16        # grille native des objets (bol, sac)
SCALE = 8              # facteur d'agrandissement (rendu net, sans lissage)

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(SCRIPT_DIR, "..", "assets", "generated", "sprites")
os.makedirs(OUT, exist_ok=True)

# ---------------------------------------------------------------------------
# Palette de personnalisation de l'avatar
# ---------------------------------------------------------------------------
SKINS = {
    "claire":  (244, 201, 160, 255),
    "halee":   (216, 163, 122, 255),
    "mate":    (176, 124, 84, 255),
    "foncee":  (120, 80, 56, 255),
}

HAIRS = {
    "brun":  (91, 62, 41, 255),
    "noir":  (43, 35, 33, 255),
    "blond": (214, 175, 99, 255),
    "roux":  (176, 88, 53, 255),
    "bleu":  (91, 124, 214, 255),   # option fantaisie, non réaliste
}

EYE = (42, 38, 48, 255)
PYJAMA = (219, 213, 201, 255)
PYJAMA_SHADOW = (196, 189, 175, 255)

# Couleurs des calques (indépendantes de la carnation/cheveux)
SHIRT = (76, 139, 245, 255); SHIRT_SHADOW = (54, 108, 209, 255)
PANTS = (244, 163, 64, 255); PANTS_SHADOW = (214, 137, 45, 255)
SHOE = (247, 247, 244, 255); SHOE_SOLE = (60, 60, 66, 255)
COAT = (193, 80, 46, 255); COAT_SHADOW = (158, 60, 32, 255)
SPARKLE = (255, 232, 130, 255)

# Couleurs des objets de la pièce
BOWL = (247, 247, 244, 255); BOWL_SHADOW = (210, 208, 200, 255)
FOOD = (216, 140, 70, 255); FOOD_LIGHT = (235, 178, 110, 255)
BAG = (76, 139, 245, 255); BAG_SHADOW = (54, 108, 209, 255)
BAG_FLAP_OPEN = (150, 176, 231, 255)


def darken(c, f=0.8):
    return (int(c[0] * f), int(c[1] * f), int(c[2] * f), 255)


def new_canvas(w, h):
    return Image.new("RGBA", (w, h), (0, 0, 0, 0))


def save(img, name, w, h):
    img.resize((w * SCALE, h * SCALE), Image.NEAREST).save(f"{OUT}/{name}.png")


# ---------------------------------------------------------------------------
# Avatar (base personnalisable)
# ---------------------------------------------------------------------------
def draw_base(skin, hair, messy_hair):
    skin_shadow = darken(skin)
    hair_line = darken(hair, 0.65)
    img = new_canvas(W, H)
    d = ImageDraw.Draw(img)

    d.ellipse([6, 2, 17, 12], fill=skin)
    d.rectangle([5, 6, 6, 8], fill=skin)
    d.rectangle([17, 6, 18, 8], fill=skin)
    d.rectangle([9, 7, 10, 8], fill=EYE)
    d.rectangle([13, 7, 14, 8], fill=EYE)
    d.point((8, 9), fill=skin_shadow)
    d.point((15, 9), fill=skin_shadow)

    if messy_hair:
        d.rectangle([5, 0, 18, 4], fill=hair)
        d.rectangle([3, 2, 5, 5], fill=hair)
        d.rectangle([18, 1, 20, 4], fill=hair)
        d.rectangle([9, -1, 11, 1], fill=hair)
        d.rectangle([14, -1, 16, 2], fill=hair)
    else:
        d.rectangle([5, 1, 18, 4], fill=hair)
        d.rectangle([5, 3, 8, 5], fill=hair)
        d.line([(11, 0), (11, 3)], fill=hair_line, width=1)

    d.rectangle([3, 14, 5, 21], fill=PYJAMA)
    d.rectangle([18, 14, 20, 21], fill=PYJAMA)
    d.rectangle([3, 20, 5, 22], fill=skin)
    d.rectangle([18, 20, 20, 22], fill=skin)

    d.rectangle([7, 13, 16, 22], fill=PYJAMA)
    d.rectangle([7, 20, 16, 22], fill=PYJAMA_SHADOW)

    d.rectangle([8, 23, 11, 29], fill=PYJAMA)
    d.rectangle([12, 23, 15, 29], fill=PYJAMA)

    d.rectangle([7, 29, 11, 31], fill=skin)
    d.rectangle([12, 29, 16, 31], fill=skin)

    return img


def generer_avatars():
    n = 0
    for skin_name, skin_color in SKINS.items():
        for hair_name, hair_color in HAIRS.items():
            save(draw_base(skin_color, hair_color, True), f"av_{skin_name}_{hair_name}_ebouriffe", W, H)
            save(draw_base(skin_color, hair_color, False), f"av_{skin_name}_{hair_name}_coiffe", W, H)
            n += 2
    print(f"{n} sprites d'avatar générés ({len(SKINS)} carnations x {len(HAIRS)} couleurs x 2 états)")


# ---------------------------------------------------------------------------
# Calques portés par l'avatar (indépendants de la carnation/cheveux)
# ---------------------------------------------------------------------------
def draw_vetements():
    img = new_canvas(W, H)
    d = ImageDraw.Draw(img)
    d.rectangle([3, 14, 5, 20], fill=SHIRT)
    d.rectangle([18, 14, 20, 20], fill=SHIRT)
    d.rectangle([7, 13, 16, 21], fill=SHIRT)
    d.rectangle([7, 19, 16, 21], fill=SHIRT_SHADOW)
    d.rectangle([8, 22, 11, 29], fill=PANTS)
    d.rectangle([12, 22, 15, 29], fill=PANTS)
    d.rectangle([8, 27, 11, 29], fill=PANTS_SHADOW)
    d.rectangle([12, 27, 15, 29], fill=PANTS_SHADOW)
    return img


def draw_chaussures():
    img = new_canvas(W, H)
    d = ImageDraw.Draw(img)
    d.rectangle([6, 29, 11, 31], fill=SHOE)
    d.rectangle([12, 29, 17, 31], fill=SHOE)
    d.rectangle([6, 31, 11, 32], fill=SHOE_SOLE)
    d.rectangle([12, 31, 17, 32], fill=SHOE_SOLE)
    return img


def draw_manteau():
    img = new_canvas(W, H)
    d = ImageDraw.Draw(img)
    d.rectangle([2, 13, 21, 23], fill=COAT)
    d.rectangle([2, 13, 21, 15], fill=COAT_SHADOW)
    d.polygon([(9, 13), (11, 13), (12, 16), (8, 16)], fill=COAT_SHADOW)
    d.rectangle([2, 20, 21, 23], fill=COAT_SHADOW)
    return img


def draw_sparkle():
    img = new_canvas(W, H)
    d = ImageDraw.Draw(img)
    d.point((17, 9), fill=SPARKLE)
    d.point((18, 8), fill=SPARKLE)
    d.point((19, 9), fill=SPARKLE)
    d.point((18, 10), fill=SPARKLE)
    d.rectangle([18, 9, 18, 9], fill=(255, 255, 255, 255))
    return img


def generer_calques():
    save(draw_vetements(), "overlay_vetements", W, H)
    save(draw_chaussures(), "overlay_chaussures", W, H)
    save(draw_manteau(), "overlay_manteau", W, H)
    save(draw_sparkle(), "overlay_sparkle", W, H)
    print("4 calques générés (vêtements, chaussures, manteau, sparkle)")


# ---------------------------------------------------------------------------
# Objets de la pièce
# ---------------------------------------------------------------------------
def draw_bol(plein):
    img = new_canvas(PW, PH)
    d = ImageDraw.Draw(img)
    d.rectangle([3, 9, 16, 13], fill=BOWL)
    d.rectangle([3, 12, 16, 13], fill=BOWL_SHADOW)
    d.rectangle([2, 8, 17, 9], fill=BOWL)
    if plein:
        d.rectangle([4, 6, 15, 9], fill=FOOD)
        d.rectangle([5, 6, 9, 7], fill=FOOD_LIGHT)
    return img


def draw_sac(pret):
    img = new_canvas(PW, PH)
    d = ImageDraw.Draw(img)
    if pret:
        d.rectangle([5, 3, 14, 15], fill=BAG)
        d.rectangle([5, 3, 14, 6], fill=BAG_SHADOW)
        d.rectangle([8, 0, 11, 3], fill=BAG_SHADOW)
        d.line([(9, 7), (9, 12)], fill=BAG_SHADOW, width=1)
    else:
        d.polygon([(4, 6), (15, 4), (16, 15), (5, 15)], fill=BAG)
        d.polygon([(4, 6), (15, 4), (14, 7), (5, 8)], fill=BAG_FLAP_OPEN)
        d.rectangle([7, 1, 10, 5], fill=BAG_SHADOW)
    return img


def generer_objets():
    save(draw_bol(False), "bol_vide", PW, PH)
    save(draw_bol(True), "bol_plein", PW, PH)
    save(draw_sac(False), "sac_pas_pret", PW, PH)
    save(draw_sac(True), "sac_pret", PW, PH)
    print("4 objets générés (bol vide/plein, sac pas prêt/prêt)")


if __name__ == "__main__":
    generer_avatars()
    generer_calques()
    generer_objets()
    print(f"\nTous les sprites sont dans : {os.path.abspath(OUT)}")
