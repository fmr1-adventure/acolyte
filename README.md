# Acolyte — jeu pixel art de routines pour enfants (TSA/TDAH)

**Essayer l'app :** https://kristenify.github.io/acolyte/ — à ouvrir de
préférence sur une tablette. Tout ce qui y est saisi (prénom, avatar,
routines...) reste sur l'appareil, rien n'est envoyé à un serveur.

## Contexte du projet

Application pour aider un ou plusieurs enfants — TSA et/ou TDAH à
l'origine du projet, mais pas seulement — à accomplir leurs routines
quotidiennes en autonomie, du réveil au coucher. Le planning visuel de
la journée et un jeu de vie en pixel art sont fusionnés en un seul
objet : la journée est la carte, les lieux sont les niveaux, les
routines sont des phases d'action (on doit faire quelque chose), les
trajets/attentes sont des phases sans pression (on n'a rien à faire).
Chaque enfant a son propre prénom, son propre avatar et ses propres
routines, configurés directement dans l'app (aucune information de
famille n'est codée en dur) — voir "Adapter à ta famille" plus bas.

**Appareil cible :** une tablette Android déjà possédée par la famille.
App web autonome, sans build, installée depuis le navigateur (Chrome,
Firefox... → "Ajouter à l'écran d'accueil"), fonctionnant **hors-ligne**.

**Contrainte structurante :** les enfants ne savent pas forcément lire.
Chaque écran doit être jouable à l'oreille et à l'image — le texte n'est
jamais porteur d'information seul.

## Ce que fait l'app

Vue d'ensemble non technique, tenue à jour :
[`docs/produit/fonctionnalites.md`](docs/produit/fonctionnalites.md).
Détail technique : [`app/README.md`](app/README.md). En bref :

- **Première configuration** sur chaque appareil : prénom, garçon ou
  fille, avatar personnalisé (coupe, couleur de peau, de cheveux et
  d'yeux), code parent. Trois routines de départ sont créées
  ("S'habiller", "Se préparer à partir", "Aller se coucher").
- **Réveil** : écran endormi avant l'heure, puis petit rituel (bonjour,
  sommeil, humeur).
- **Routines** : une suite de tâches, une à la fois, validées en glissant
  une icône vers l'avatar qui s'habille au fur et à mesure. Mini-jeu pour
  le brossage des dents, écran dédié pour l'histoire du soir. Le coucher
  se débloque à heure fixe.
- **Minuteur visuel** (optionnel) sur une tâche ou une routine entière,
  en jauge ou en cadran, avec un bouton 🆘 « Besoin d'aide » et une
  alerte au parent si l'enfant reste bloqué.
- **Validation par un parent** (code, relecture/correction), puis
  l'enfant ouvre lui-même un coffre qui lui donne son étoile.
  Récompense de fin de journée et pièces à collectionner.
- **Sorties** (école, courses, séance chez une praticienne...) : trajet
  puis arrivée, avec un déroulé à part pour les séances (la praticienne
  démarre la séance et laisse une note réservée aux parents).
- **« Ma journée »** : planning chronologique des routines, sorties et
  repas, modifiable par un parent, ajout rapide par phrase tapée ou
  dictée.
- **Espace parent** (code) : relancer une routine, historique des
  journées, notes des séances, planning, création/modification des
  routines et activités, entourage, profils de l'appareil.

## D'où vient ce projet (historique)

1. Premières explorations (boutons électroniques, liseuse recyclée)
   écartées — voir `docs/legacy/` pour le tout premier prototype
   (prénoms fictifs), qui documentait ces décisions.
2. **Handoff de design complet** reçu et versionné dans
   [`docs/design-handoff/`](docs/design-handoff/README.md) : bible
   d'univers, 12 maquettes d'écran, calibrage sensoriel, tokens de
   couleur/typo, modèle de données. Il porte l'ancien nom de travail du
   projet, "Dayrise". C'est la référence d'intention — **à lire avant
   toute décision de design ou de flux**.
3. Le prototype a ensuite été utilisé au quotidien par les deux premiers
   enfants pour qui il a été conçu. Leurs retours ont fait évoluer le
   parcours et le modèle de données au-delà du handoff initial ; ces
   décisions produit propres au projet sont versionnées dans
   [`docs/produit/`](docs/produit/concept.md), distinctes du handoff
   (figé).
4. Le projet a été rendu générique pour pouvoir être partagé : plus
   aucun prénom, avatar ou contenu de famille dans le code, tout se
   configure dans l'app.

## Où en est le projet

### Prototype fonctionnel (`app/`) — priorité actuelle

Tout le parcours décrit plus haut est jouable et utilisé en conditions
réelles. L'avatar utilise de vrais sprites pixel art (calques révélés au
fil des tâches) ; les autres décors restent simples (dégradés, formes
CSS, emoji, quelques scènes illustrées pour le trajet et l'histoire du
soir).

### Exploration de direction artistique (`scripts/`, `assets/`)

En parallèle, exploration de sprites et décors plus détaillés :
- génération procédurale (Python/Pillow) — voir `scripts/generate_*.py`
  (c'est ce générateur qui produit les sprites de l'avatar utilisés par
  l'app, dans `app/assets/avatar/`)
- intégration d'assets sous licence libre (packs Bitglow, pièces vue du
  dessus) — voir `scripts/extract_sprites.py` et
  `scripts/compose_room_from_assets.py`. Les packs eux-mêmes ne sont pas
  versionnés (licence qui interdit leur redistribution), à télécharger
  dans `assets/external/` pour lancer ces scripts.

Les décors de pièces issus de cette exploration ne sont pas encore
reliés à l'app — seul l'avatar l'est.

### Prochaines pistes

- Calibrage sensoriel par enfant (contraste, densité, mouvement, débit
  vocal).
- Vrais décors de pièces dans l'app.
- Récompense de fin de journée différenciée selon les étoiles gagnées.
- Notes libres dans le planning ("un parent emmène un autre enfant à
  l'école"), mode de transport par sortie (voiture, vélo, à pied).
- Annoncer à l'enfant ce qui vient après ("On fait... / après on
  fait...").

## Structure du dépôt

```
acolyte/
├── README.md                     ce fichier
├── .github/workflows/deploy.yml  publication de app/ sur GitHub Pages à chaque push sur main
├── app/                          l'application (voir app/README.md)
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   ├── sw.js                     service worker : fonctionnement hors-ligne
│   ├── manifest.json             installation sur l'écran d'accueil
│   └── assets/
│       ├── avatar/               sprites de l'avatar (dont perso/ : toutes les combinaisons coupe/peau/cheveux/yeux)
│       ├── icons/                icônes de l'app
│       └── scenes/               images de scène (trajet, histoire du soir)
├── docs/
│   ├── design-handoff/           référence de design reçue (figée, à lire avant toute décision de flux/UI)
│   ├── produit/                  décisions produit (concept, parcours, modèle de données) + fonctionnalites.md (vue d'ensemble tenue à jour)
│   └── legacy/                   tout premier prototype (prénoms fictifs), conservé pour mémoire
├── scripts/                      génération procédurale + extraction de sprites (Python/Pillow)
└── assets/
    └── generated/                sorties des scripts (sprites, aperçus) — pas de travail manuel dedans
```

## Gestion des branches

Une fois l'app installée sur les tablettes de vos enfants, ils l'utilisent
tous les jours : le dépôt distingue donc une branche stable de ce qu'ils
ont réellement sous les mains d'une branche de travail.

- **`main`** — version stable, celle qui est publiée et installée sur
  les tablettes. On n'y touche pas directement.
- **`dev`** — branche de développement, où se fait tout le travail en
  cours.

Workflow :

1. Le travail se fait sur `dev` (ou une branche dédiée créée depuis
   `dev` pour un chantier précis, fusionnée dans `dev` une fois prête).
2. Une fois un changement testé et jugé prêt, fusionner `dev` dans
   `main` (de préférence via une pull request, pour relire avant).
3. Pousser `main` déclenche automatiquement la publication de `app/` sur
   GitHub Pages (cf. "Déploiement" ci-dessous) — c'est ce qui rend le
   changement réellement disponible pour les tablettes.

## Déploiement

- **Dépôt** : le tien, une fois ce projet forké.
- **App en ligne** : active GitHub Pages sur ton dépôt (Settings → Pages
  → Source : GitHub Actions) — `.github/workflows/deploy.yml` publie
  automatiquement `app/` à chaque push sur `main`, sur l'URL
  `https://<ton-compte>.github.io/<ton-dépôt>/`.
- **Installation sur la tablette d'un enfant** : ouvrir cette URL une
  fois dans le navigateur, puis "Ajouter à l'écran d'accueil". Un
  service worker (`app/sw.js`) met ensuite l'app en cache : elle
  continue de fonctionner **hors-ligne**, sans dépendre d'aucun serveur
  (ni GitHub, ni la machine utilisée pour développer) — voir
  `app/README.md` pour le détail technique. La première configuration
  doit se faire avec une connexion internet.
- **Mises à jour** : la tablette récupère la nouvelle version en tâche
  de fond quand elle est connectée ; elle s'affiche à une ouverture
  suivante de l'app (pas forcément la toute prochaine).
- **Les données restent attachées à l'adresse** : pièces, historique et
  réglages sont stockés par le navigateur pour cette URL précise. Changer
  d'adresse (renommer le dépôt, changer de compte) ou de navigateur
  repart d'une app vide.

## Adapter à ta famille

Aucune information de famille n'est codée en dur : ni prénom, ni avatar,
ni praticien·ne, ni activité. Pour installer ce projet pour tes propres
enfants :

1. **Fork** ce dépôt sur ton compte GitHub (bouton "Fork" en haut de la
   page du dépôt).
2. **Active GitHub Pages** sur ton fork (Settings → Pages → Source :
   GitHub Actions) — le premier push sur `main` déclenche `deploy.yml` et
   publie `app/` sur ton URL `https://<ton-compte>.github.io/<ton-dépôt>/`.
3. Sur la tablette de chaque enfant, ouvre cette URL une fois, puis
   "Ajouter à l'écran d'accueil" (cf. "Déploiement" ci-dessus).
4. **Premier lancement** : l'app demande le prénom de l'enfant, s'il
   s'agit d'un garçon ou d'une fille, puis de composer son avatar (coupe
   de cheveux, couleur de peau, de cheveux et d'yeux), et enfin un code
   parent à 4 chiffres (à saisir deux fois). Ça crée le profil de cet
   appareil, avec trois routines de départ aussitôt modifiables. Chaque
   enfant a son propre appareil : répète cette étape sur chaque
   tablette.
5. Depuis l'espace parent (icône ⚙️ discrète en haut, code demandé),
   personnalise ensuite : les tâches de chaque routine (et leur
   minuteur éventuel), les activités/sorties (dont une visite chez une
   praticienne, si besoin — "+ Nouvelle activité"), l'entourage
   ("+ Nouvelle personne"), le planning du jour, ou ajoute un 2ᵉ enfant
   sur le même appareil ("Cet appareil" → "+ Nouvel enfant") si jamais
   deux enfants partagent exceptionnellement une tablette.

Rien de tout ça ne touche au code : tout est stocké sur l'appareil
(`localStorage`), jamais envoyé à un serveur ni au dépôt Git — voir
`app/README.md` ("État et persistance") pour le détail technique. Éditer
`app.js` reste utile pour des changements plus profonds (nouveaux
vêtements, nouveau type d'écran...) mais n'est pas nécessaire pour
l'usage courant.
