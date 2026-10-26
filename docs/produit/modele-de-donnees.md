# Modèle de données — notes en cours

Entités et relations, prises au fil des explications, avant
implémentation. Pas encore du code. Le pourquoi/l'intention est dans
`concept.md`, le déroulé écran par écran dans `parcours-journee.md`.

## Routine ↔ Tâche : relation mère-fille

Une **Routine** est indépendante des autres routines. Chaque routine a sa
propre liste ordonnée de **Tâches**.

Une tâche appartient à une routine (relation mère-fille : la routine est
la mère, ses tâches sont les filles). Pas de tâche partagée entre
plusieurs routines pour l'instant.

Les tâches seront **paramétrables par les parents** à terme (ajouter,
retirer, réordonner des tâches au sein d'une routine).

## Routines identifiées jusqu'ici

- **"S'habiller"** — du slip aux chaussettes : caleçon → t-shirt/pull →
  pantalon → chaussettes.
- **"Se préparer à partir"** — chaussures, manteau, sac.

(Ce découpage remplace la notion de "chambre"/"salon" par pièce codée en
dur dans le prototype actuel — à corriger : les routines sont l'unité de
modélisation, pas les pièces. Le lieu où ça se passe est une propriété de
la routine, pas l'inverse.)

## Récompense (aspect données)

- Chaque routine terminée + validée par un parent rapporte une étoile,
  **une fois par jour** : `etat.routines[id].etoileDonnee`, posé à
  l'ouverture du coffre et jamais remis à faux dans la journée. Une
  routine refaite (second passage dans le planning, ou relancée par un
  parent) se valide sans coffre ni nouvelle étoile ; la relance ne retire
  plus l'étoile.
- Le total d'étoiles du jour alimente une jauge de journée.
- Voir `concept.md` pour la philosophie (jauge, correction avant
  validation) et `parcours-journee.md` pour où ça se déclenche dans le
  flux.

## Aventure (aspect données)

Une **Aventure** est une sortie programmée (ex. "chez le/la praticien·ne",
"le magasin de bricolage") — cf. distinction Routine/Mission dans
`concept.md`. Dans le prototype (`AVENTURES_COMMUNES`/`aventures_perso`
dans `app.js`), une aventure porte : `lieu`, les textes du trajet et de
l'arrivée, le `programme` (3 lignes annoncées à l'arrivée) et une
`personne` optionnelle `{ emoji, nom }`. Une aventure avec `nature:
"maison"` est une **activité à la maison** : ni trajet ni programme, mais
`endroit` (`"chambre" | "salon" | "cuisine"`), `consigne` (la phrase dite
par l'acolyte), `minuteurMinutes` (0, 10, 20 ou 30) et `recompensePieces`.
Sans `nature`, c'est une sortie ; une sortie (ou une séance) porte
`modeTransport` (`"voiture" | "velo" | "pied"`, absent = voiture), qui
pilote le texte de trajet suggéré et la scène du trajet. Une aventure avec `personne` est
une **séance** : à l'arrivée, c'est l'écran de séance (code de la
praticienne) qui prend le relais. Une séance créée depuis le planning
porte la personne choisie dans l'entourage, qui figure aussi dans ses
`entourageIds`.

L'ancien champ `date` (une aventure qui n'apparaissait qu'un jour précis)
n'est plus lu : au premier lancement après la mise à jour, chaque
aventure datée d'aujourd'hui ou d'un jour à venir est recopiée dans le
planning de ce jour-là (aujourd'hui ou `planning_futur`), une seule fois
(drapeau `cle("migration_dates")`). Ce qui revient chaque semaine se met
désormais dans la semaine type.

Créer une activité depuis la **bibliothèque** ne l'ajoute qu'au
catalogue — la placer sur un jour est une action séparée, depuis
"AJOUTER À LA JOURNÉE". Créer une sortie ou une séance **depuis un jour
en cours de préparation** (« + Nouvelle sortie / À la maison / séance ») l'ajoute à ce
jour-là, quel qu'il soit (aujourd'hui, un jour à venir, un jour de la
semaine type). Une routine, elle, est ajoutée dès sa création à
aujourd'hui et aux 7 jours de la semaine type : structurellement
récurrente par nature, elle apparaît ensuite tous les jours.

## Pièce (aspect données) — monnaie distincte de l'étoile

- Une aventure peut rapporter des **pièces** au lieu d'une étoile de
  routine (`recompensePieces` sur l'Aventure). Voir `concept.md` pour
  la philosophie (pas une jauge de journée, se dépense plus tard ou se
  donne aux parents dans la vraie vie).
- Stockage à part de l'état du jour, justement parce que ça **ne suit
  pas le cycle quotidien** des étoiles : dans le prototype, une clé
  `localStorage` séparée (`cle("pieces")`) qui n'est jamais réinitialisée
  au changement de jour.
- Une pièce gagnée (jauge pleine ou activité) incrémente aussi
  `cle("pieces_a_poser")` ; l'enfant la pose ensuite sur le chemin
  (`cle("chemin").posees`). Les pièces d'avant le chemin sont devenues des
  pièces à poser (migration unique).

## Jauge d'étoiles et chemin (aspect données)

- `cle("jauge_etoiles")` = `{ dansLaJauge, aDecouvrir }`, jamais remis à
  zéro au changement de jour. Les étoiles du jour passent dans
  `aDecouvrir` à la validation du coucher, ou au changement de jour s'il
  n'a pas eu lieu (`etat.etoilesMisesDeCote` retient combien l'ont déjà
  été). La carte « Ce matin » les verse dans `dansLaJauge` à partir de
  `heureDecouverte` ; à `etoilesParPiece`, une pièce, le reste repart dans
  la jauge. L'étoile reste aussi comptée dans `etat.etoiles` (historique).
- `cle("chemin")` = `{ cases, etoilesParPiece, heureDecouverte, sons,
  recompenses: [{ case, emoji, nom }], posees, atteintes: [{ case, emoji,
  nom, gagneeLe, donneeLe? }], archives }`, avec `sons` = `"doux" |
  "arcade" | "coupes"`. La récompense finale est celle de la dernière case.
  `atteintes` garde le pictogramme et le nom au moment où la récompense
  est gagnée (« À donner » ne dépend pas d'un réglage modifié ensuite). Un
  chemin terminé est archivé avant d'en préparer un nouveau.

## Planning (aspect données) — items de "Ma journée"

Un item de `etat.planning` référence une routine, une aventure ou un
repas (`{ type, id }`) — jamais les données elles-mêmes, toujours résolu
depuis le catalogue correspondant à l'affichage (cf. `concept.md`,
principe déjà appliqué à l'aventure/la pièce). Un champ optionnel `heure`
("HH:MM") peut s'y ajouter : purement un repère d'affichage, jamais lu
par la logique de la liste — deux mécanismes volontairement séparés (cf.
`concept.md`).

Deux types d'items n'existent que dans le planning, pas dans la
bibliothèque : une **info** `{ type: "note", texte, entourageIds?, heure? }`
(un repère, jamais « maintenant », lue telle quelle) et un **moment au
choix** `{ type: "choix", options: [idActivite…], choisi?, heure? }` (2 ou 3
activités ; `choisi` est rempli par le choix de l'enfant, pour la journée,
et c'est la fin de l'activité choisie qui marque le moment au choix
`fait`). Un élément dont l'activité n'existe plus est ignoré par la liste.

Pour **aujourd'hui** seulement, deux champs de plus : `fait: true` quand
l'élément est terminé (une routine à l'ouverture de son coffre ou à sa
validation, une activité au retour confirmé par un parent — c'est
toujours le premier item restant de ce type et de cet id qui est marqué)
et `passe: true` quand un parent l'a sauté. La liste de l'enfant en
déduit, sans rien stocker de plus, ce qui est fait, « maintenant »,
« après » et « plus tard » (`app/journee.js`, testé par
`tests/journee.test.js`) : « maintenant » est le premier item à faire
(routine ou activité) ni fait ni sauté — ou le coucher, dès son heure
(`disponibleApresHeure`). Une journée commencée avant cette version
marque une fois le premier item de chaque routine déjà validée
(drapeau `etat.itemsMigres`).

**Semaine type** — `cle("semaine_type")`, map `{ "1": [items...], …,
"7": [items...] }` (1 = lundi … 7 = dimanche, même forme d'item). C'est
le modèle de chaque jour : une nouvelle journée (et un jour à venir non
modifié) part de la liste de son jour de la semaine. Créée au premier
lancement en recopiant sur les 7 jours l'ancienne journée par défaut
(repas, routines de départ et routines sur mesure). Logique pure dans
`app/semaine.js`, testée par `tests/semaine.test.js`.

**Planning à venir** — `etat.planning` reste strictement "aujourd'hui" ;
un carnet séparé (`cle("planning_futur")`, map `{ "YYYY-M-D":
[items...] }`, même forme d'item) porte les jours **futurs** qu'un
parent a modifiés à l'avance (onglet « Prochains jours » de l'écran
Planning, les 7 jours suivants). Une date n'y entre qu'à sa première
vraie modification — tant qu'elle n'y est pas, elle suit la semaine
type (« Comme d'habitude ») ; une fois dedans, elle est « Modifié » et ne
suit plus les changements de la semaine type. Quand ce jour-là devient
"aujourd'hui" (changement de date détecté au chargement de l'état), son
entrée est retirée du carnet et sert de graine à la nouvelle journée, à
la place du jour de la semaine type.

**Cible de l'éditeur** — l'écran "Ma journée" en mode édition modifie
l'un de ces trois plannings selon `planningCible` : `null` (aujourd'hui,
`etat.planning`), `{ date }` (un jour de `planning_futur`) ou
`{ jourSemaine }` (un jour de la semaine type). Jamais persistée.

## Entourage / Personne (aspect données)

`{ id, nom, emoji, role }` — `role` en texte libre (ex. "Grand-mère"), pas
une liste fermée de catégories. Persisté à part, propre à chaque appareil
comme les catalogues Routines/Activités perso.

Rattachable en option à une Routine ou une Aventure créée par un parent
via `entourageIds` (tableau d'ids) — **jamais** via le champ `personne`
déjà utilisé par une aventure praticienne (ajoutée depuis l'espace
parent) : ce champ-là n'est pas qu'un affichage, sa présence bascule tout
le déroulé de "Partir à l'aventure" vers l'écran séance (code praticienne,
note obligatoire). Les deux champs cohabitent sans jamais se substituer
l'un à l'autre.

Consommateur futur envisagé : l'écran dédié à la tâche "histoire" du soir
— "qui lit l'histoire, papa
ou maman ?" pourrait piocher dans ce même catalogue plutôt que d'inventer
son propre choix binaire.

## Ce qui reste à préciser (suite des explications à venir)

- Comment une journée assemble plusieurs routines/missions (ordre,
  dépendances, conditions de passage de l'une à l'autre) — au-delà du
  principe déjà posé ("routine suivante grisée tant que la précédente
  n'est pas finie", paramétrable par les parents).
- Ce qui est réellement paramétrable par tâche vs par routine côté parent.
- Modélisation des "missions" (sorties/activités) par rapport aux
  routines — même entité, ou distincte ?
- Barème précis étoiles → récompense de fin de journée.
- D'autres routines à venir (petit-déjeuner, envisagé comme un mini-jeu
  à part, sur le modèle du brossage des dents qui en est déjà un).
