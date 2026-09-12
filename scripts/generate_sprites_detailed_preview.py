"""
Générateur de l'avatar (paper-doll) — c'est CE script qui a produit les
sprites réellement déployés dans app/assets/avatar/ (avatar-*-*.png,
copiés depuis sa sortie <name>_calque_*.png ; malgré le nom du fichier, ce
n'est plus "juste" une exploration de preview). Chaque entrée de CHILDREN
ci-dessous est l'un des avatars proposés à la première configuration (cf.
AVATARS_DISPONIBLES dans app/app.js) — prénom/apparence choisis par le
parent à la création d'un profil, jamais fixés ici.

Dans l'esprit du handoff `docs/design-handoff/` :
  - grille de sprite alignée sur 32 px, personnage en pied
  - contour foncé réservé aux personnages (jamais sur le décor)
  - deux déclinaisons de contraste (doux / élevé, contour plus épais) —
    cf. "réglages sensoriels propres à chaque enfant"
  - paper-doll : le corps de base + des calques de vêtements superposables
    (une image par calque, empilées par app.js selon la tâche faite).

Deux silhouettes : une robe (draw_robe, une seule pièce évasée en
trapèze, pas juste le pantalon recolorié) pour "avatar-c"/"avatar-d", un
pantalon pour "avatar-a"/"avatar-b" — cf. `silhouette` sur chaque entrée
d'AVATARS_DISPONIBLES dans app/app.js, qui pilote le gabarit de routines
amorcé à la création d'un profil (routinesDemarrage()).

Usage :
    /usr/local/bin/python3 scripts/generate_sprites_detailed_preview.py

Sort dans ../assets/generated/sprites-preview/ (ne touche pas à
../assets/generated/sprites/, sortie d'un autre script/style).
"""

from PIL import Image, ImageDraw, ImageFilter, ImageChops
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(SCRIPT_DIR, "..", "assets", "generated", "sprites-preview")
os.makedirs(OUT, exist_ok=True)

W, H = 36, 56
SCALE = 8

OUTLINE_SOFT = (74, 68, 55, 255)     # ink.soft — contour doux
OUTLINE_HIGH = (14, 20, 36, 255)     # ink.high — contour plus dur/épais

EYE = (34, 30, 40, 255)
SPARKLE = (255, 255, 255, 220)
BLUSH = (232, 150, 150, 130)


def lighten(c, f=0.25):
    return tuple(min(255, int(c[i] + (255 - c[i]) * f)) for i in range(3)) + (255,)


def darken(c, f=0.78):
    return tuple(int(c[i] * f) for i in range(3)) + (255,)


def new_canvas():
    return Image.new("RGBA", (W, H), (0, 0, 0, 0))


def add_outline(img, color, thickness=1):
    alpha = img.split()[3]
    dilated = alpha
    for _ in range(thickness):
        dilated = dilated.filter(ImageFilter.MaxFilter(3))
    ring = ImageChops.subtract(dilated, alpha)
    mask = ring.point(lambda p: 255 if p > 10 else 0)
    solid = Image.new("RGBA", img.size, color)
    outline_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    outline_layer.paste(solid, (0, 0), mask)
    return Image.alpha_composite(outline_layer, img)


def save(img, name):
    img.resize((W * SCALE, H * SCALE), Image.NEAREST).save(f"{OUT}/{name}.png")


# ---------------------------------------------------------------------------
# Corps de base (tête, visage, pyjama) — partagé, personnalisé par enfant
# ---------------------------------------------------------------------------
def draw_head(d, skin, hair, hair_line, messy, eyes_closed=False):
    d.ellipse([10, 8, 27, 23], fill=skin)
    d.rectangle([9, 15, 11, 18], fill=skin)
    d.rectangle([26, 15, 28, 18], fill=skin)

    if messy:
        d.rectangle([9, 7, 28, 13], fill=hair)
        d.polygon([(11, 7), (13, 3), (15, 7)], fill=hair)
        d.polygon([(17, 6), (19, 2), (21, 6)], fill=hair)
        d.polygon([(23, 7), (25, 3), (27, 7)], fill=hair)
        d.rectangle([7, 11, 10, 15], fill=hair)
        d.rectangle([27, 11, 30, 15], fill=hair)
        d.rectangle([12, 8, 16, 9], fill=lighten(hair, 0.3))
    else:
        d.rectangle([9, 6, 28, 13], fill=hair)
        d.rectangle([9, 13, 12, 16], fill=hair)
        d.rectangle([25, 13, 28, 16], fill=hair)
        d.line([(17, 6), (17, 11)], fill=hair_line, width=1)
        d.rectangle([19, 7, 24, 8], fill=lighten(hair, 0.3))

    d.rectangle([14, 14, 16, 14], fill=hair_line)
    d.rectangle([21, 14, 23, 14], fill=hair_line)

    if eyes_closed:
        # Yeux fermés (sommeil) : un simple trait incurvé plutôt que le
        # bloc + reflet des yeux ouverts — convention pixel art courante,
        # se lit sans ambiguïté à cette taille.
        d.line([(13, 17), (17, 16)], fill=EYE, width=1)
        d.line([(20, 16), (24, 17)], fill=EYE, width=1)
    else:
        d.rectangle([14, 16, 16, 17], fill=EYE)
        d.rectangle([21, 16, 23, 17], fill=EYE)
        d.point((14, 16), fill=SPARKLE)
        d.point((21, 16), fill=SPARKLE)

    d.ellipse([11, 18, 13, 19], fill=BLUSH)
    d.ellipse([24, 18, 26, 19], fill=BLUSH)
    d.rectangle([18, 19, 19, 19], fill=darken(skin, 0.85))


def draw_pyjama_base(d, pyjama, pyjama_hi, pyjama_shadow, skin):
    d.rectangle([17, 22, 20, 24], fill=skin)  # cou

    d.rectangle([12, 24, 25, 38], fill=pyjama)
    d.rectangle([14, 24, 23, 26], fill=pyjama_hi)
    d.rectangle([12, 35, 25, 38], fill=pyjama_shadow)
    d.rectangle([17, 24, 20, 26], fill=pyjama_shadow)

    d.rectangle([7, 24, 12, 34], fill=pyjama)
    d.rectangle([25, 24, 30, 34], fill=pyjama)
    d.rectangle([7, 31, 12, 34], fill=pyjama_shadow)
    d.rectangle([25, 31, 30, 34], fill=pyjama_shadow)
    d.ellipse([6, 33, 12, 37], fill=skin)
    d.ellipse([25, 33, 31, 37], fill=skin)

    d.rectangle([14, 38, 18, 50], fill=pyjama)
    d.rectangle([19, 38, 23, 50], fill=pyjama)
    d.rectangle([14, 47, 18, 50], fill=pyjama_shadow)
    d.rectangle([19, 47, 23, 50], fill=pyjama_shadow)
    d.ellipse([12, 49, 18, 53], fill=skin)
    d.ellipse([19, 49, 25, 53], fill=skin)


def build_avatar(skin, hair, messy, pyjama, outline_color, outline_thickness):
    hair_line = darken(hair, 0.6)
    pyjama_hi = lighten(pyjama, 0.28)
    pyjama_shadow = darken(pyjama, 0.75)
    img = new_canvas()
    d = ImageDraw.Draw(img)
    draw_head(d, skin, hair, hair_line, messy)
    draw_pyjama_base(d, pyjama, pyjama_hi, pyjama_shadow, skin)
    return add_outline(img, outline_color, outline_thickness)


# ---------------------------------------------------------------------------
# Calques vêtements (paper-doll), alignés sur les mêmes zones que le corps
# ---------------------------------------------------------------------------
def draw_calecon(couleur, outline_color, thickness):
    ombre = darken(couleur, 0.72)
    img = new_canvas()
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([13, 31, 24, 40], radius=2, fill=couleur)
    d.rectangle([13, 37, 24, 40], fill=ombre)
    d.line([(18, 31), (18, 37)], fill=ombre, width=1)  # petite couture centrale
    return add_outline(img, outline_color, thickness)


def draw_shirt(shirt, outline_color, thickness):
    shirt_hi = lighten(shirt, 0.28)
    shirt_shadow = darken(shirt, 0.75)
    img = new_canvas()
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([7, 24, 12, 33], radius=1, fill=shirt)
    d.rounded_rectangle([25, 24, 30, 33], radius=1, fill=shirt)
    d.rectangle([7, 30, 12, 33], fill=shirt_shadow)
    d.rectangle([25, 30, 30, 33], fill=shirt_shadow)
    d.rounded_rectangle([12, 23, 25, 38], radius=2, fill=shirt)
    d.rectangle([14, 23, 23, 25], fill=shirt_hi)
    d.rectangle([12, 34, 25, 38], fill=shirt_shadow)
    d.polygon([(15, 23), (22, 23), (20, 27), (17, 27)], fill=shirt_shadow)
    return add_outline(img, outline_color, thickness)


def draw_pull(pull, outline_color, thickness):
    # silhouette plus large que le t-shirt (porté par-dessus) + côtes
    # tricotées aux poignets/col/bas, pour se distinguer nettement au
    # premier coup d'œil plutôt que de juste recolorier le même patron.
    pull_hi = lighten(pull, 0.22)
    pull_shadow = darken(pull, 0.7)
    cote = darken(pull, 0.6)
    img = new_canvas()
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([5, 24, 12, 35], radius=1, fill=pull)
    d.rounded_rectangle([25, 24, 32, 35], radius=1, fill=pull)
    for sx in (5, 25):
        d.rectangle([sx, 32, sx + 7, 35], fill=cote)
    d.rounded_rectangle([10, 22, 27, 39], radius=2, fill=pull)
    d.rectangle([12, 22, 25, 25], fill=pull_hi)
    d.rectangle([10, 35, 27, 39], fill=cote)
    # col rond, plus couvrant que l'encolure du t-shirt
    d.pieslice([14, 20, 23, 27], 180, 360, fill=pull_shadow)
    d.arc([14, 20, 23, 27], 180, 360, fill=cote)
    # côtes verticales sur le corps, discrètes
    for lx in (14, 17.5, 21, 24.5):
        d.line([(lx, 27), (lx, 34)], fill=pull_shadow, width=1)
    return add_outline(img, outline_color, thickness)


def draw_robe(robe, outline_color, thickness):
    # Une seule pièce évasée (trapèze qui s'élargit vers l'ourlet), PAS deux
    # jambes séparées comme draw_pants — sinon ça reste visuellement un
    # pantalon recolorié. Manches courtes plus hautes que celles du haut
    # porté dessous (draw_shirt) : un peu de "haut" dépasse à l'épaule,
    # comme pull/shirt se distinguent déjà sur la silhouette pantalon
    # (cf. draw_pull).
    hi = lighten(robe, 0.25)
    shadow = darken(robe, 0.75)
    ourlet = darken(robe, 0.62)
    img = new_canvas()
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([8, 24, 12, 29], radius=1, fill=robe)
    d.rounded_rectangle([25, 24, 29, 29], radius=1, fill=robe)
    d.rounded_rectangle([13, 23, 24, 33], radius=2, fill=robe)
    d.rectangle([15, 23, 22, 25], fill=hi)
    # jupe évasée : un seul polygone, plus large en bas qu'en haut
    d.polygon([(13, 32), (24, 32), (29, 46), (8, 46)], fill=robe)
    d.polygon([(9, 43), (28, 43), (29, 46), (8, 46)], fill=ourlet)
    d.line([(18, 33), (18, 45)], fill=shadow, width=1)
    return add_outline(img, outline_color, thickness)


def draw_pants(pants, outline_color, thickness):
    pants_shadow = darken(pants, 0.68)
    img = new_canvas()
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([14, 37, 18, 44], radius=1, fill=pants)
    d.rounded_rectangle([19, 37, 23, 44], radius=1, fill=pants)
    d.rectangle([14, 41, 18, 44], fill=pants_shadow)
    d.rectangle([19, 41, 23, 44], fill=pants_shadow)
    # ourlet net : liseré sombre qui referme la jambe avant la chaussette
    d.rectangle([14, 43, 18, 44], fill=darken(pants, 0.55))
    d.rectangle([19, 43, 23, 44], fill=darken(pants, 0.55))
    return add_outline(img, outline_color, thickness)


def draw_socks(sock, stripe, outline_color, thickness):
    sock_shadow = darken(sock, 0.85)
    img = new_canvas()
    d = ImageDraw.Draw(img)
    d.rectangle([14, 44, 18, 49], fill=sock)
    d.rectangle([19, 44, 23, 49], fill=sock)
    d.rectangle([14, 46, 17, 46], fill=stripe)
    d.rectangle([20, 46, 23, 46], fill=stripe)
    d.rectangle([14, 47, 18, 49], fill=sock_shadow)
    d.rectangle([19, 47, 23, 49], fill=sock_shadow)
    return add_outline(img, outline_color, thickness)


def draw_shoes(shoe, sole, outline_color, thickness):
    img = new_canvas()
    d = ImageDraw.Draw(img)
    d.ellipse([12, 48, 18, 53], fill=shoe)
    d.ellipse([19, 48, 25, 53], fill=shoe)
    d.rectangle([12, 51, 18, 53], fill=sole)
    d.rectangle([19, 51, 25, 53], fill=sole)
    # trait de lacet, pour que la chaussure se lise comme un objet distinct
    d.line([(14, 49), (16, 49)], fill=darken(shoe, 0.7), width=1)
    d.line([(21, 49), (23, 49)], fill=darken(shoe, 0.7), width=1)
    return add_outline(img, outline_color, thickness)


def draw_coat(coat, coat_trim, outline_color, thickness):
    coat_shadow = darken(coat, 0.72)
    coat_hi = lighten(coat, 0.22)
    img = new_canvas()
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([4, 24, 10, 33], radius=1, fill=coat)
    d.rounded_rectangle([27, 24, 33, 33], radius=1, fill=coat)
    d.rectangle([4, 30, 10, 33], fill=coat_shadow)
    d.rectangle([27, 30, 33, 33], fill=coat_shadow)
    # poignets contrastés — marquent la limite de la manche même si la
    # teinte du manteau est proche de celle du haut porté dessous
    d.rectangle([4, 30, 10, 32], fill=coat_trim)
    d.rectangle([27, 30, 33, 32], fill=coat_trim)
    d.rounded_rectangle([9, 23, 28, 41], radius=2, fill=coat)
    d.rectangle([11, 23, 26, 25], fill=coat_hi)
    d.polygon([(15, 23), (22, 23), (24, 28), (13, 28)], fill=coat_shadow)
    # col contrasté
    d.polygon([(14, 23), (16, 23), (18, 26), (16, 26)], fill=coat_trim)
    d.polygon([(23, 23), (21, 23), (19, 26), (21, 26)], fill=coat_trim)
    d.rectangle([9, 37, 28, 41], fill=coat_shadow)
    # fermeture centrale + boutons — signale "manteau ouvert par-dessus",
    # pas "un autre haut de la même couleur"
    d.line([(18, 27), (18, 40)], fill=coat_shadow, width=1)
    d.line([(19, 27), (19, 40)], fill=coat_shadow, width=1)
    for by in (29, 33, 37):
        d.point((18, by), fill=coat_trim)
        d.point((19, by), fill=coat_trim)
    return add_outline(img, outline_color, thickness)


def composite(*layers):
    base = layers[0].copy()
    for layer in layers[1:]:
        base.alpha_composite(layer)
    return base


# ---------------------------------------------------------------------------
# Deux déclinaisons enfant (palette + épaisseur de contour du handoff)
# ---------------------------------------------------------------------------
CHILDREN = {
    "avatar-a": {
        "skin": (222, 178, 140, 255),
        "hair": (74, 54, 42, 255),
        "messy": False,
        "pyjama": (100, 149, 168, 255),
        "calecon": (140, 168, 150, 255),
        "shirt": (58, 130, 138, 255),
        "pull": (46, 90, 96, 255),
        "pants": (52, 62, 88, 255),
        "sock": (238, 238, 230, 255),
        "sock_stripe": (58, 130, 138, 255),
        "shoe": (238, 238, 230, 255),
        "sole": (60, 50, 44, 255),
        "coat": (46, 90, 96, 255),
        "coat_trim": (52, 62, 88, 255),
        "outline": OUTLINE_SOFT,
        "thickness": 1,
    },
    "avatar-b": {
        "skin": (190, 132, 92, 255),
        "hair": (168, 76, 48, 255),
        "messy": True,
        "pyjama": (150, 108, 168, 255),
        "calecon": (120, 150, 110, 255),
        "shirt": (142, 96, 168, 255),
        "pull": (94, 60, 116, 255),
        "pants": (52, 92, 60, 255),
        "sock": (232, 230, 240, 255),
        "sock_stripe": (142, 96, 168, 255),
        "shoe": (232, 230, 240, 255),
        "sole": (20, 20, 28, 255),
        "coat": (94, 60, 116, 255),
        "coat_trim": (52, 92, 60, 255),
        "outline": OUTLINE_HIGH,
        "thickness": 2,
    },
    "avatar-c": {
        "skin": (120, 82, 58, 255),
        "hair": (24, 22, 22, 255),
        "messy": False,
        "pyjama": (214, 178, 90, 255),
        "calecon": (198, 168, 120, 255),
        "shirt": (214, 178, 90, 255),
        "pull": (168, 132, 58, 255),
        "pants": (198, 168, 120, 255),
        "robe": (198, 150, 60, 255),
        "sock": (245, 240, 225, 255),
        "sock_stripe": (198, 150, 60, 255),
        "shoe": (245, 240, 225, 255),
        "sole": (90, 70, 40, 255),
        "coat": (168, 132, 58, 255),
        "coat_trim": (245, 240, 225, 255),
        "outline": OUTLINE_SOFT,
        "thickness": 1,
    },
    "avatar-d": {
        "skin": (238, 200, 168, 255),
        "hair": (224, 186, 90, 255),
        "messy": True,
        "pyjama": (224, 140, 150, 255),
        "calecon": (200, 150, 160, 255),
        "shirt": (224, 140, 150, 255),
        "pull": (168, 96, 106, 255),
        "pants": (150, 168, 190, 255),
        "robe": (64, 156, 158, 255),
        "sock": (250, 245, 245, 255),
        "sock_stripe": (64, 156, 158, 255),
        "shoe": (250, 245, 245, 255),
        "sole": (60, 90, 92, 255),
        "coat": (168, 96, 106, 255),
        "coat_trim": (250, 245, 245, 255),
        "outline": OUTLINE_HIGH,
        "thickness": 2,
    },
}


# ---------------------------------------------------------------------------
# Écran "en sommeil" (screen-dodo, app.js) : l'enfant allongé de tout son
# long, yeux fermés, sous une couette — PAS un calque du paper-doll
# ci-dessus (canvas dédié, vertical, pas 36×56) : c'est une scène à part,
# pas une étape d'habillage. Vue de dessus (tête en haut sur l'oreiller,
# pieds tout en bas sous la couette) pour représenter TOUTE la hauteur de
# l'enfant, pas juste tête et buste. Réutilise draw_head() telle quelle
# (mêmes coordonnées que le paper-doll debout, cf. plus haut) avec
# eyes_closed=True — un oreiller derrière et une couette par-dessus
# l'entourent, à la couleur du pyjama de l'enfant (cf.
# CHILDREN[...]["pyjama"]) pour rester dans sa palette, avec une bosse de
# chaque côté tout en bas pour suggérer les pieds sous la couette. Le
# "Zzz" reste un emoji animé en CSS (cf. index.html), pas dessiné ici.
DODO_W, DODO_H = 40, 84


def draw_dodo(skin, hair, messy, couette, outline_color, thickness):
    hair_line = darken(hair, 0.6)
    oreiller = (247, 244, 236, 255)
    oreiller_ombre = darken(oreiller, 0.9)
    couette_hi = lighten(couette, 0.22)
    couette_ombre = darken(couette, 0.75)

    img = Image.new("RGBA", (DODO_W, DODO_H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # Oreiller : posé derrière/sous la tête, dépasse largement de chaque
    # côté (une tête qui dort est toujours plus étroite que l'oreiller).
    d.rounded_rectangle([1, 3, 38, 25], radius=4, fill=oreiller)
    d.rounded_rectangle([1, 20, 38, 25], radius=4, fill=oreiller_ombre)

    draw_head(d, skin, hair, hair_line, messy, eyes_closed=True)

    # Couette : recouvre tout le reste du corps, du menton jusqu'aux
    # pieds tout en bas du canvas — dépasse des bords gauche/droit/bas
    # (pas juste jusqu'au bord) pour donner l'impression qu'elle continue
    # hors champ plutôt que de s'arrêter pile au cadre.
    d.rounded_rectangle([-4, 19, DODO_W + 4, DODO_H + 4], radius=8, fill=couette)
    d.rounded_rectangle([-4, 19, DODO_W + 4, 23], radius=8, fill=couette_hi)
    for lx in (10, 20, 30):
        d.line([(lx, 23), (lx, DODO_H - 14)], fill=couette_ombre, width=1)

    # Pieds : deux petites bosses sous la couette tout en bas — sans elles,
    # la couette lit comme un simple rectangle plutôt qu'un corps allongé
    # de tout son long.
    d.rounded_rectangle([8, DODO_H - 16, 19, DODO_H - 4], radius=5, fill=couette)
    d.rounded_rectangle([21, DODO_H - 16, 32, DODO_H - 4], radius=5, fill=couette)
    d.rounded_rectangle([8, DODO_H - 16, 19, DODO_H - 11], radius=5, fill=couette_hi)
    d.rounded_rectangle([21, DODO_H - 16, 32, DODO_H - 11], radius=5, fill=couette_hi)

    return add_outline(img, outline_color, thickness)


def save_dodo(img, name):
    img.resize((DODO_W * SCALE, DODO_H * SCALE), Image.NEAREST).save(f"{OUT}/{name}.png")


# ---------------------------------------------------------------------------
# Avatar personnalisable (première configuration, app.js) — remplace les 4
# avatars figés de CHILDREN ci-dessus par des traits combinables : peau,
# couleur de cheveux, coupe (2 par genre), couleur d'yeux. Écrit
# DIRECTEMENT dans app/assets/avatar/perso/ (pas de détour par OUT + copie
# manuelle comme pour avatar-a/b/c/d : ici les 320 combinaisons sont
# TOUTES utilisées telles quelles, rien à curer/sélectionner à la main).
# Les vêtements ne sont volontairement pas concernés par ce système : la
# silhouette (garçon -> pantalon, fille -> robe) réutilise directement les
# calques déjà générés pour "avatar-a"/"avatar-c" ci-dessus (cf.
# CALQUES_PAR_SILHOUETTE dans app.js) — seuls corps/visage se
# personnalisent. Les valeurs ci-dessous DOIVENT rester synchronisées
# avec PEAUX/CHEVEUX_COULEURS/COUPES_PAR_GENRE/YEUX_COULEURS dans app.js
# (mêmes ids p1-4/n1-5/y1-4/noms de coupe) : ce sont ces ids qui composent
# le nom de fichier attendu par spritesPourTraits().
PEAUX_PERSO = [("p1", (245,214,190,255)), ("p2", (222,178,140,255)), ("p3", (180,130,90,255)), ("p4", (120,82,58,255))]
CHEVEUX_PERSO = [("n1", (224,186,90,255)), ("n2", (168,76,48,255)), ("n3", (120,84,56,255)), ("n4", (74,54,42,255)), ("n5", (28,24,22,255))]
YEUX_PERSO = [("y1", (34,30,40,255)), ("y2", (120,84,48,255)), ("y3", (60,110,165,255)), ("y4", (70,130,90,255))]
COUPES_PERSO = ["court-net", "court-ebouriffe", "carre", "couettes"]
OUT_PERSO = os.path.join(SCRIPT_DIR, "..", "app", "assets", "avatar", "perso")
# Couette (couverture, écran "dodo") neutre unique — pas un trait proposé
# au choix (non demandé), donc pas besoin de varier avec le reste.
COUETTE_PERSO = (100, 130, 150, 255)


def draw_tete_perso(d, skin, hair, hair_line, coupe, eye, eyes_closed=False):
    d.ellipse([10, 8, 27, 23], fill=skin)
    d.rectangle([9, 15, 11, 18], fill=skin)
    d.rectangle([26, 15, 28, 18], fill=skin)
    if coupe == "court-ebouriffe":
        d.rectangle([9, 7, 28, 13], fill=hair)
        d.polygon([(11, 7), (13, 3), (15, 7)], fill=hair)
        d.polygon([(17, 6), (19, 2), (21, 6)], fill=hair)
        d.polygon([(23, 7), (25, 3), (27, 7)], fill=hair)
        d.rectangle([7, 11, 10, 15], fill=hair)
        d.rectangle([27, 11, 30, 15], fill=hair)
        d.rectangle([12, 8, 16, 9], fill=lighten(hair, 0.3))
    elif coupe == "court-net":
        d.rectangle([9, 6, 28, 13], fill=hair)
        d.rectangle([9, 13, 12, 16], fill=hair)
        d.rectangle([25, 13, 28, 16], fill=hair)
        d.line([(17, 6), (17, 11)], fill=hair_line, width=1)
        d.rectangle([19, 7, 24, 8], fill=lighten(hair, 0.3))
    elif coupe == "carre":
        d.rectangle([9, 6, 28, 13], fill=hair)
        d.rectangle([8, 13, 12, 21], fill=hair)
        d.rectangle([25, 13, 29, 21], fill=hair)
        d.line([(17, 6), (17, 11)], fill=hair_line, width=1)
        d.rectangle([19, 7, 24, 8], fill=lighten(hair, 0.3))
    elif coupe == "couettes":
        d.rectangle([9, 6, 28, 13], fill=hair)
        d.rectangle([9, 13, 12, 15], fill=hair)
        d.rectangle([25, 13, 28, 15], fill=hair)
        d.line([(17, 6), (17, 11)], fill=hair_line, width=1)
        d.rectangle([19, 7, 24, 8], fill=lighten(hair, 0.3))
        d.ellipse([2, 12, 10, 21], fill=hair)
        d.ellipse([27, 12, 35, 21], fill=hair)
        d.ellipse([4, 13, 8, 17], fill=lighten(hair, 0.25))
        d.ellipse([29, 13, 33, 17], fill=lighten(hair, 0.25))
    d.rectangle([14, 14, 16, 14], fill=hair_line)
    d.rectangle([21, 14, 23, 14], fill=hair_line)
    if eyes_closed:
        d.line([(13, 17), (17, 16)], fill=(34, 30, 40, 255), width=1)
        d.line([(20, 16), (24, 17)], fill=(34, 30, 40, 255), width=1)
    else:
        d.rectangle([14, 16, 16, 17], fill=eye)
        d.rectangle([21, 16, 23, 17], fill=eye)
        d.point((14, 16), fill=SPARKLE)
        d.point((21, 16), fill=SPARKLE)
    d.ellipse([11, 18, 13, 19], fill=BLUSH)
    d.ellipse([24, 18, 26, 19], fill=BLUSH)
    d.rectangle([18, 19, 19, 19], fill=darken(skin, 0.85))


def generer_avatars_perso():
    os.makedirs(OUT_PERSO, exist_ok=True)
    total = 0
    for coupe in COUPES_PERSO:
        for pid, skin in PEAUX_PERSO:
            for nid, hair in CHEVEUX_PERSO:
                for yid, eye in YEUX_PERSO:
                    hair_line = darken(hair, 0.6)
                    nom = f"{coupe}-{pid}-{nid}-{yid}"

                    naked = new_canvas()
                    d = ImageDraw.Draw(naked)
                    draw_tete_perso(d, skin, hair, hair_line, coupe, eye)
                    skin_shadow = darken(skin, 0.88)
                    d.rectangle([17, 22, 20, 24], fill=skin)
                    d.rounded_rectangle([12, 23, 25, 38], radius=2, fill=skin)
                    d.rectangle([12, 34, 25, 38], fill=skin_shadow)
                    d.rounded_rectangle([8, 24, 12, 33], radius=1, fill=skin)
                    d.rounded_rectangle([25, 24, 29, 33], radius=1, fill=skin)
                    d.ellipse([6, 33, 12, 37], fill=skin)
                    d.ellipse([25, 33, 31, 37], fill=skin)
                    d.rectangle([14, 37, 18, 49], fill=skin)
                    d.rectangle([19, 37, 23, 49], fill=skin)
                    d.ellipse([12, 49, 18, 53], fill=skin)
                    d.ellipse([19, 49, 25, 53], fill=skin)
                    base = add_outline(naked, OUTLINE_SOFT, 1)
                    base.resize((W * SCALE, H * SCALE), Image.NEAREST).save(f"{OUT_PERSO}/{nom}-base.png")

                    oreiller = (247, 244, 236, 255)
                    oreiller_ombre = darken(oreiller, 0.9)
                    couette_hi = lighten(COUETTE_PERSO, 0.22)
                    couette_ombre = darken(COUETTE_PERSO, 0.75)
                    dodo_img = Image.new("RGBA", (DODO_W, DODO_H), (0, 0, 0, 0))
                    dd = ImageDraw.Draw(dodo_img)
                    dd.rounded_rectangle([1, 3, 38, 25], radius=4, fill=oreiller)
                    dd.rounded_rectangle([1, 20, 38, 25], radius=4, fill=oreiller_ombre)
                    draw_tete_perso(dd, skin, hair, hair_line, coupe, eye, eyes_closed=True)
                    dd.rounded_rectangle([-4, 19, DODO_W + 4, DODO_H + 4], radius=8, fill=COUETTE_PERSO)
                    dd.rounded_rectangle([-4, 19, DODO_W + 4, 23], radius=8, fill=couette_hi)
                    for lx in (10, 20, 30):
                        dd.line([(lx, 23), (lx, DODO_H - 14)], fill=couette_ombre, width=1)
                    dd.rounded_rectangle([8, DODO_H - 16, 19, DODO_H - 4], radius=5, fill=COUETTE_PERSO)
                    dd.rounded_rectangle([21, DODO_H - 16, 32, DODO_H - 4], radius=5, fill=COUETTE_PERSO)
                    dd.rounded_rectangle([8, DODO_H - 16, 19, DODO_H - 11], radius=5, fill=couette_hi)
                    dd.rounded_rectangle([21, DODO_H - 16, 32, DODO_H - 11], radius=5, fill=couette_hi)
                    dodo = add_outline(dodo_img, OUTLINE_SOFT, 1)
                    dodo.resize((DODO_W * SCALE, DODO_H * SCALE), Image.NEAREST).save(f"{OUT_PERSO}/{nom}-dodo.png")
                    total += 2
    print(f"Avatar personnalisable : {total} fichiers dans {os.path.abspath(OUT_PERSO)}")


def main():
    generer_avatars_perso()
    for name, c in CHILDREN.items():
        base = build_avatar(c["skin"], c["hair"], c["messy"], c["pyjama"], c["outline"], c["thickness"])
        save(base, f"{name}_pyjama")

        dodo = draw_dodo(c["skin"], c["hair"], c["messy"], c["pyjama"], c["outline"], c["thickness"])
        save_dodo(dodo, f"{name}_dodo")

        shirt = draw_shirt(c["shirt"], c["outline"], c["thickness"])
        pull = draw_pull(c["pull"], c["outline"], c["thickness"])
        pants = draw_pants(c["pants"], c["outline"], c["thickness"])
        robe = draw_robe(c["robe"], c["outline"], c["thickness"]) if "robe" in c else None
        socks = draw_socks(c["sock"], c["sock_stripe"], c["outline"], c["thickness"])
        shoes = draw_shoes(c["shoe"], c["sole"], c["outline"], c["thickness"])
        coat = draw_coat(c["coat"], c["coat_trim"], c["outline"], c["thickness"])

        # corps nu complet (tête, torse, bras, jambes) : point de départ réel
        # de la routine ("partir de l'enfant nu"), pas seulement un squelette
        # de compositing — donc pas de trou au torse/bras.
        skin_shadow = darken(c["skin"], 0.88)
        naked = new_canvas()
        d = ImageDraw.Draw(naked)
        hair_line = darken(c["hair"], 0.6)
        draw_head(d, c["skin"], c["hair"], hair_line, c["messy"])
        d.rectangle([17, 22, 20, 24], fill=c["skin"])
        d.rounded_rectangle([12, 23, 25, 38], radius=2, fill=c["skin"])
        d.rectangle([12, 34, 25, 38], fill=skin_shadow)
        d.rounded_rectangle([8, 24, 12, 33], radius=1, fill=c["skin"])
        d.rounded_rectangle([25, 24, 29, 33], radius=1, fill=c["skin"])
        d.ellipse([6, 33, 12, 37], fill=c["skin"])
        d.ellipse([25, 33, 31, 37], fill=c["skin"])
        d.rectangle([14, 37, 18, 49], fill=c["skin"])
        d.rectangle([19, 37, 23, 49], fill=c["skin"])
        d.ellipse([12, 49, 18, 53], fill=c["skin"])
        d.ellipse([19, 49, 25, 53], fill=c["skin"])
        naked = add_outline(naked, c["outline"], c["thickness"])

        calecon = draw_calecon(c["calecon"], c["outline"], c["thickness"])

        save(composite(naked, calecon, shirt, pull, pants, socks), f"{name}_habille")
        save(composite(naked, calecon, shirt, pull, pants, socks, shoes), f"{name}_pret")
        save(composite(naked, calecon, shirt, pull, pants, socks, shoes, coat), f"{name}_manteau")

        # calques individuels séparés, pour un empilage progressif côté app
        # (une couche par étape de la routine, plutôt que des combos figés)
        save(naked, f"{name}_calque_corps")
        save(calecon, f"{name}_calque_calecon")
        save(shirt, f"{name}_calque_haut")
        save(pull, f"{name}_calque_pull")
        save(pants, f"{name}_calque_pantalon")
        if robe is not None:
            save(composite(naked, calecon, shirt, robe), f"{name}_habille_robe")
            save(robe, f"{name}_calque_robe")
        save(socks, f"{name}_calque_chaussettes")
        save(shoes, f"{name}_calque_chaussures")
        save(coat, f"{name}_calque_manteau")

    print(f"Sprites de preview dans : {os.path.abspath(OUT)}")


if __name__ == "__main__":
    main()
