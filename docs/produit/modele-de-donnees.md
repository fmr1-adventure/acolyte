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

- Chaque routine terminée + validée par un parent rapporte une étoile
  (champ à porter par la routine ou par l'état du jour — à trancher).
- Le total d'étoiles du jour alimente une jauge de journée.
- Voir `concept.md` pour la philosophie (jauge, correction avant
  validation) et `parcours-journee.md` pour où ça se déclenche dans le
  flux.

## Aventure (aspect données)

Une **Aventure** est une sortie programmée (ex. "chez le/la praticien·ne",
"le magasin de bricolage") — cf. distinction Routine/Mission dans
`concept.md`. Dans le prototype (`AVENTURES_COMMUNES`/`aventures_perso`
dans `app.js`), une aventure porte : `lieu`, les textes du trajet et de
l'arrivée, le `programme` (3 lignes annoncées à l'arrivée), une
`personne` optionnelle (pour une sortie chez quelqu'un) et une `date`
optionnelle (filtre pour savoir si elle apparaît dans les sorties du jour
— une aventure sans date, comme une visite récurrente chez une
praticienne, n'apparaît jamais toute seule, cf. TODO.md).

Créer une activité (espace parent) ne l'ajoute qu'au **catalogue** —
jamais à un planning précis, ni aujourd'hui ni un jour futur. La placer
sur un jour donné est une action séparée, volontaire, depuis "AJOUTER À
LA JOURNÉE" sur ce jour-là (aujourd'hui ou à venir). Une routine, elle,
reste ajoutée à aujourd'hui dès sa création : structurellement
récurrente par nature (contrairement à une activité), elle apparaît de
toute façon tous les jours suivants sans action supplémentaire.

## Pièce (aspect données) — monnaie distincte de l'étoile

- Une aventure peut rapporter des **pièces** au lieu d'une étoile de
  routine (`recompensePieces` sur l'Aventure). Voir `concept.md` pour
  la philosophie (pas une jauge de journée, se dépense plus tard ou se
  donne aux parents dans la vraie vie).
- Stockage à part de l'état du jour, justement parce que ça **ne suit
  pas le cycle quotidien** des étoiles : dans le prototype, une clé
  `localStorage` séparée (`leon_pieces`) qui n'est jamais réinitialisée
  au changement de jour.
- Pas encore de mécanique de dépense modélisée (boutique, choix
  d'activité) — juste le total qui s'accumule pour l'instant.

## Planning (aspect données) — items de "Ma journée"

Un item de `etat.planning` référence une routine, une aventure ou un
repas (`{ type, id }`) — jamais les données elles-mêmes, toujours résolu
depuis le catalogue correspondant à l'affichage (cf. `concept.md`,
principe déjà appliqué à l'aventure/la pièce). Un champ optionnel `heure`
("HH:MM") peut s'y ajouter : purement un repère d'affichage pour le
regroupement "maintenant/ensuite", jamais lu par la logique de déblocage
des routines — deux mécanismes volontairement séparés (cf. `concept.md`).

**Planning à venir** — `etat.planning` reste strictement "aujourd'hui" ;
un carnet séparé (`cle("planning_futur")`, map `{ "YYYY-M-D":
[items...] }`, même forme d'item) porte les jours **futurs** qu'un
parent a préparés à l'avance depuis l'espace parent ("Planning des
prochains jours", les 7 jours suivants). Une date n'y entre qu'à sa
première vraie modification — l'avoir seulement consultée ne fige rien
contre les routines récurrentes ajoutées ensuite. Quand ce jour-là
devient "aujourd'hui" (changement de date détecté au chargement de
l'état), son entrée est retirée du carnet et sert de graine à la
nouvelle journée, à la place du squelette générique.

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
(cf. `TODO.md`, section "Pas encore designé") — "qui lit l'histoire, papa
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
- D'autres routines à venir (dents, petit-déjeuner — déjà notées comme
  mini-jeux à part dans `TODO.md`).
