# Espace parent : chaque activité sait quand elle revient — conception

*Conception validée le 01/11/2026 sur la maquette « Espace parent — le
rythme des activités », avant implémentation. Complète la section 4 de
`2026-10-25-activites-design.md` (bibliothèque et planning), déjà
livrée ; les trois choix marqués « par défaut » restent à confirmer à la
relecture.*

## Objectif

Les parents préparent la semaine sans avoir à tout gérer en même temps :

- une activité qui revient (chaque semaine, ou une semaine sur deux) se
  règle **une seule fois, sur l'activité elle-même**, et l'app la place
  toute seule les bons jours ;
- les jours à venir disent **ce qu'ils contiennent et ce qui change**,
  sans avoir à les ouvrir un par un ;
- l'accueil de l'espace parent tient en **cinq entrées** au lieu de dix.

Le nombre d'appuis reste celui d'aujourd'hui (trois ou quatre au plus,
le maximum acceptable). Chaque tablette garde ses propres données : tout
ceci vaut à l'identique pour chaque enfant, sur son appareil.

## Constat

- La semaine type porte les activités jour par jour, mais ne sait dire
  que « chaque mardi ». Une séance un mardi sur deux se gère à la main,
  semaine après semaine, en modifiant les jours concernés.
- L'onglet « Prochains jours » affiche « Modifié » ou « Comme
  d'habitude » sans dire ce que contient le jour, ni ce qui a changé.
- L'accueil aligne dix cartes de même poids ; la bibliothèque est
  éclatée en trois entrées (Activités, Routines, Mon entourage) et le
  suivi en deux (Historique, Notes des séances).
- Ajouter au planning n'est pas jugé laborieux : le bloc « Ajouter à la
  journée » ne change pas.

## Pistes écartées

- **La règle portée seule par l'activité, la semaine type réduite au
  squelette** (routines, repas, coucher), les activités étant insérées
  chaque jour d'après leur heure : l'ordre de la journée ne dépendrait
  plus que des heures, toute activité devrait en avoir une, et on ne
  pourrait plus la glisser entre deux routines. Il faudrait aussi sortir
  les activités de la semaine type existante, au risque de décaler
  l'enchaînement des matins.
- **Une semaine A et une semaine B** qui alternent : tout le reste
  (routines, repas) serait à saisir deux fois, et seul le rythme d'une
  semaine sur deux serait couvert.
- **Mensuel, vacances scolaires, périodes** : pas de besoin aujourd'hui
  (les activités actuelles sont hebdomadaires ou bimensuelles). Restent
  dans « Plus tard ».

## 1. Le rythme d'une activité

**Une seule vérité : la semaine type.** C'est elle qui dit quels jours
une activité a lieu et où elle tombe dans la journée. La fiche de
l'activité n'est qu'une autre façon de la régler : elle lit la semaine
type et y écrit. Les deux restent donc toujours d'accord.

### Ce que voit le parent

Toucher une activité dans la bibliothèque ouvre sa **fiche** (nouvel
écran) : en haut, son résumé (icône, nom, nature) et un bouton
« Modifier » qui ouvre le formulaire actuel ; dessous, le bloc **Quand
ça revient** :

- **Quels jours** : sept boutons L M M J V S D, à cocher ou décocher ;
- **À quelle heure** (facultatif) : une heure commune aux jours cochés ;
- **À quel rythme** : « Chaque semaine » ou « Une semaine sur deux » ;
- en « une semaine sur deux », **La première fois** : deux choix, la
  prochaine date du premier jour coché à partir de demain, et celle de
  la semaine suivante (« mar. 3 nov. » ou « mar. 10 nov. ») ;
- dès qu'un jour est coché, les **cinq prochaines dates** de ce premier
  jour (à partir de demain), chacune marquée « oui » ou « pas cette
  fois », pour vérifier l'alternance d'un coup d'œil ;
- une **phrase de résumé** : « Chaque mardi à 17:15. », « Un mardi sur
  deux à 17:15. Première fois : mar. 3 nov. », « Une semaine sur deux, le
  mardi et le jeudi, à 17:15. Première fois : … », ou « Pas programmée :
  elle reste dans la bibliothèque. » quand aucun jour n'est coché ;
- un bouton **Enregistrer**.

À l'ouverture, le bloc reprend l'état de la semaine type : jours où
l'activité figure, son heure si elle est la même partout (sinon le champ
est vide, avec l'indication « selon le jour »), son rythme et sa première
fois. Une activité créée depuis la bibliothèque ouvre sa fiche juste
après sa création, pour qu'on règle tout de suite quand elle revient.

Le retour (←) et « Enregistrer » ramènent là d'où l'on vient : la
bibliothèque, ou la semaine type si la fiche a été ouverte depuis une
étiquette. « Modifier » ouvre le formulaire actuel, qui revient à la
fiche.

### Ce que fait « Enregistrer »

Pour chacun des sept jours de la semaine type :

- **jour coché, activité absente** : elle est ajoutée juste avant le
  premier élément dont l'heure est plus tardive que la sienne ; sans
  heure, ou si rien n'est plus tard, juste avant le coucher (comme
  aujourd'hui) ;
- **jour coché, activité présente** : elle garde sa place ; son rythme
  est mis à jour, et son heure aussi si le champ est rempli (vide, chaque
  jour garde la sienne) ;
- **jour décoché, activité présente** : elle est retirée de ce jour.

Le rythme est le même pour tous les jours cochés d'une activité.

### Ce qui ne bouge pas

- **Aujourd'hui** est déjà préparé : il ne change pas, comme quand on
  modifie la semaine type aujourd'hui. Si le jour de la semaine
  d'aujourd'hui est concerné (coché, ou décoché alors que l'activité y
  figurait), la fiche le dit : « Aujourd'hui est déjà préparé : il ne
  change pas. »
- **Un jour déjà modifié à la main** (dans « Prochains jours ») garde son
  programme. La fiche le signale pour chaque jour à venir modifié dont le
  jour de la semaine est concerné : « Mardi 10 nov. a été modifié à la
  main : il garde son programme. »
- **Les activités déjà dans la semaine type** sont « chaque semaine » :
  aucune migration, rien ne change pour l'enfant.
- **Routines, repas, infos et moments au choix** n'ont pas de rythme :
  ils reviennent chaque semaine, les jours où ils sont placés.
- **Ajouter à un jour de la semaine type** (bloc « Ajouter à la
  journée », ou création depuis ce jour) place l'activité chaque semaine
  ce jour-là, comme aujourd'hui.

### Où le rythme se règle (par défaut)

Seulement dans la fiche. Dans la semaine type, chaque activité porte une
étiquette (« chaque mardi », « 1 mardi sur 2 », « tous les jours ») ;
la toucher ouvre sa fiche.

## 2. Le planning

### Semaine type

- L'onglet montre directement **la journée d'un jour**, avec les sept
  puces L M M J V S D en haut pour en changer (par défaut, le jour de la
  semaine d'aujourd'hui) : un appui de moins qu'aujourd'hui, où l'on
  passe par une liste des sept jours.
- La journée reste éditable comme aujourd'hui (glisser-déposer, heure,
  retirer, bloc « Ajouter à la journée »).
- Chaque **activité** (sortie, maison, séance) porte son étiquette de
  rythme, qui ouvre sa fiche : « tous les jours » si elle est chaque
  semaine sur les sept jours, « chaque mardi » si elle est chaque
  semaine, « 1 mardi sur 2 » en une semaine sur deux, avec dessous
  « prochaine fois : mar. 3 nov. ».

### Prochains jours

- **Quatorze jours** à partir de demain (par défaut ; sept aujourd'hui),
  pour voir les deux semaines d'une activité une semaine sur deux.
  Regroupés par semaine calendaire, sous un titre « Semaine du 2 nov. ».
- En tête, **Aujourd'hui**, marqué « en cours ».
- Chaque jour montre les **icônes de ce qu'il contient** — activités,
  moments au choix et infos, dans l'ordre de la journée (les routines et
  repas, identiques d'un jour à l'autre, n'y figurent pas) — et un badge
  « comme d'hab. » ou « modifié ».
- Un jour modifié dit **ce qui change** par rapport à son jour habituel,
  une ligne par élément : « + Anniversaire de Mamie, 18:00 », « − La
  piscine ». Si seuls l'ordre ou les heures ont changé : « Ordre ou
  heures changés ».
- Toucher un jour l'ouvre pour le modifier, comme aujourd'hui.

## 3. L'accueil et la bibliothèque

### Accueil : cinq entrées

| Bloc | Entrée | Ouvre |
|---|---|---|
| La journée | 🗓️ Planning | Semaine type, prochains jours |
| La journée | 🔁 Relancer une routine | inchangé |
| La bibliothèque | 🧰 Activités, routines, entourage | la bibliothèque, à trois onglets |
| Les récompenses | 🏆 Chemin et récompenses | inchangé (avec « à donner ») |
| Le suivi | 📅 Journées et séances | l'historique et les notes, à deux onglets (par défaut) |

En bas, **Réglages** devient deux petits boutons côte à côte : 🔑 Code
parent et 📱 Cet appareil.

### Bibliothèque : un écran, trois onglets

- **Activités** : chaque activité avec, sous son nom, ses jours et son
  heure (« mar · 17:15 »), suivis de « prochaine fois mar. 3 nov. » en
  une semaine sur deux, et une étiquette « chaque semaine », « 1 sur 2 »
  ou « pas programmée ». La toucher ouvre sa fiche. Bouton « + Nouvelle
  activité ».
- **Routines** et **Entourage** : les listes actuelles, avec leurs
  boutons « + Nouvelle routine » et « + Nouvelle personne ».
- Le retour (←) ramène toujours à l'accueil.

### Suivi : un écran, deux onglets (par défaut)

« Journées » (l'historique actuel) et « Séances » (les notes actuelles),
sans autre changement.

## 4. Modèle de données

- **Item de la semaine type** : un item `aventure` peut porter
  `rythme: { toutesLes: 2, depuis: "AAAA-M-J" }`, où `depuis` est le
  lundi de la semaine de la première fois. Sans `rythme` : chaque
  semaine. Aucun autre type d'item n'en porte.
- **Préparer un jour** (`planningDuJour(semaineType, cleJour)`, donc
  `planningParDefaut()`) : un item avec `rythme` n'est gardé que si la
  semaine du jour est à un nombre de semaines de `depuis` positif ou nul
  et multiple de `toutesLes`. Le champ `rythme` n'est pas recopié dans
  le planning du jour ni dans `planning_futur`.
- Semaines comptées de lundi à lundi, à partir des dates locales
  arrondies au jour (le passage à l'heure d'hiver ne décale rien).
- `planning_futur`, `etat.planning` et le format des clés de jour ne
  changent pas.
- **Logique pure dans `semaine.js`**, testée sous Node :
  - `tombeCeJour(rythme, cleJour)` : vrai sans rythme, sinon le calcul
    ci-dessus ;
  - `quandDeLActivite(semaineType, id)` : jours, heure commune (ou
    `null`), rythme ;
  - `appliquerQuand(semaineType, id, quand, estCoucher)` : les trois
    cas de « Enregistrer » ;
  - `placerSelonHeure(items, entree, estCoucher)` : la règle
    d'insertion ;
  - `differencesJour(modifie, habituel)` : éléments ajoutés et retirés
    (comparés par type et id ; une info par son texte, un moment au
    choix par ses options), et si l'ordre ou les heures diffèrent.

## 5. Ce qui ne change pas

- Rien de visible côté enfant : sa liste du jour est préparée comme
  avant, simplement sans l'activité les semaines où elle ne tombe pas.
- Le bloc « Ajouter à la journée » (bibliothèque, créer, info, moment au
  choix, texte et dictée) et le formulaire d'une activité.
- Modifier un jour à venir ne change que ce jour-là ; modifier la
  semaine type ne change ni aujourd'hui ni les jours déjà modifiés.
- Le code parent protège tout l'espace parent.

## 6. Vérification

- Tests Node de `semaine.js` :
  - une semaine sur deux depuis un lundi donné, sur six semaines ;
  - avant la première fois, l'activité n'apparaît pas ;
  - changement d'année, et semaine du passage à l'heure d'hiver ;
  - « Enregistrer » : ajout à la bonne place selon l'heure, place
    gardée, retrait, heure vide qui garde celle de chaque jour ;
  - `differencesJour` : ajout, retrait, info, ordre seul.
- Dans le navigateur, sur un port neuf :
  - régler l'orthophoniste un mardi sur deux, puis vérifier les quatorze
    prochains jours et l'étiquette dans la semaine type ;
  - un jour déjà modifié et aujourd'hui ne bougent pas, et la fiche le
    signale ;
  - l'accueil à cinq entrées, les onglets de la bibliothèque et du suivi,
    le retour à l'accueil ;
  - aucune erreur dans la console.
- Mise à jour de `docs/produit/fonctionnalites.md`.

## Plus tard (hors périmètre)

- Une fois par mois (« le 1er samedi »), et les périodes : vacances
  scolaires qui retirent l'école et certaines séances d'un coup.
- Régler le rythme directement depuis une ligne de la semaine type.
- « Se préparer à partir » ajouté tout seul juste avant chaque sortie.
