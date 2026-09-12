# Prototype de parcours

Prototype **HTML/CSS/JS vanilla, sans build, sans dépendance**. S'ouvre
directement dans un navigateur (`index.html`) ou via un petit serveur
statique local (`python3 -m http.server` depuis ce dossier) si le
navigateur bloque le chargement de `styles.css`/`app.js` en `file://`.

**Concept validé par un test réel.** Utilisé au quotidien par les deux
premiers enfants pour qui il a été conçu pendant que le reste de l'app se
construit — voir `TODO.md` à la racine et `docs/produit/` pour le modèle
qui a guidé cette version.

**Déploiement/installation sur la tablette d'un enfant** : l'app est
publiée sur GitHub Pages (URL stable, HTTPS, indépendante de toute
machine perso — cf. "Gestion des branches" dans le README racine, et
"Adapter à ta famille" pour installer ce projet pour tes propres
enfants). Ouvrir cette URL une fois dans le navigateur de la tablette,
puis "Ajouter à l'écran d'accueil" : `manifest.json` fournit l'icône,
`sw.js` (service worker) met l'app en cache pour qu'elle marche ensuite
**hors-ligne**, sans dépendre d'aucun serveur. Un serveur de dev local
(`python3 -m http.server`, ou l'équivalent utilisé pendant le
développement) reste utile pour tester en cours de route, mais n'est
jamais ce qu'une tablette réelle doit charger au quotidien.

**Piège de test une fois le service worker actif** : après avoir modifié
`app.js`/`styles.css`/`index.html`, un simple rechargement du navigateur
peut continuer à servir l'ancienne version depuis le cache
(stale-while-revalidate sert le cache en premier, cf. `sw.js`). Pendant
le développement, désenregistrer le service worker et vider le cache
avant de retester :
```js
navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()));
caches.keys().then(ns => ns.forEach(n => caches.delete(n)));
```
(bug réel rencontré en testant l'espace parent dans une session — un
correctif semblait ne rien changer, alors qu'il était simplement masqué
par le cache).

## Mode debug (tests)

Pour accéder à tous les écrans à tout moment, sans attendre que l'heure
réelle passe (réveil à `HEURE_REVEIL`, "Aller se coucher" débloquée à
`disponibleApresHeure`) : sur un serveur de dev local
(`localhost`/`127.0.0.1`, cf. `python3 -m http.server` plus haut), le
mode debug est **toujours actif**, quel que soit le port — pas besoin de
rien activer, y compris après avoir changé de port d'une session de test
à l'autre (cf. `modeDebugActif()` dans `app.js`). Ailleurs (ex. une URL
de prévisualisation non-localhost), ouvrir l'app avec `?debug=1` dans
l'URL une fois — retenu ensuite sur ce navigateur/appareil
(`acolyte_debug` dans `localStorage`, partagé par appareil, pas par
enfant ; `?debug=0` désactive). Jamais activé sur les tablettes réelles,
qui ne chargent que l'URL GitHub Pages publiée, jamais un localhost.
Fait apparaître un bouton 🧪 (à côté de ⚙️/↺) qui ouvre un panneau
listant tous les écrans — chacun atteint via sa vraie fonction d'entrée
(`demarrerRoutine()`, `allerAuTrajet()`...), jamais un `afficherEcran()`
nu, pour que l'écran obtenu ait toujours les données dont il dépend,
comme s'il avait été atteint normalement. Le panneau inclut aussi un
raccourci pour basculer entre les profils déjà configurés sur cet
appareil sans recomposer l'URL (`btn-debug-parent-appareil`, cf.
"Profils" plus bas). Inclut une horloge de test (`dateDebugForcee`, ±1h /
retour au temps réel — une vraie Date, pas juste l'heure du jour :
avancer peut faire passer minuit, sinon le réveil ne se débloquerait
jamais après un coucher simulé) pour les deux verrous ci-dessus, et le
code parent actuel affiché en clair. L'heure simulée ne survit pas à un
rechargement (repart du temps réel) — volontaire, pour ne jamais laisser
une session de test oubliée fausser un chargement ultérieur.

## Première configuration (aucune information de famille en dur)

Aucun prénom, avatar, praticien·ne ou activité n'est codé dans `app.js` :
tout est configuré depuis l'app elle-même, au premier lancement puis
depuis l'espace parent — voir "Adapter à ta famille" dans le README
racine pour le parcours côté utilisateur, et "Profils" plus bas pour le
détail technique.

## Ce qui est couvert

Un ou plusieurs enfants, chacun sur son **propre appareil** — ce n'est
pas un sélecteur de profil dans une même app partagée, cf. "Profils" plus
bas. Un seul jour type. Modèle : une **Routine** a une liste ordonnée de
**Tâches** (relation mère-fille — voir
`docs/produit/modele-de-donnees.md`). Trois routines de départ, amorcées
pour chaque profil à sa création (`routinesDemarrage()` dans `app.js`,
cf. "Profils") puis librement modifiables comme n'importe quelle routine :

- **"S'habiller"** — dessous → haut → bas → chaussettes, deux gabarits
  selon la silhouette choisie à la création du profil : caleçon →
  t-shirt → pantalon → chaussettes, ou culotte → haut → robe →
  chaussettes (`draw_robe()` dans
  `scripts/generate_sprites_detailed_preview.py` — une vraie silhouette
  de robe évasée, pas un pantalon recolorié).
- **"Se préparer à partir"** — chaussures seulement pour l'instant,
  identique quelle que soit la silhouette ; manteau et sac faciles à
  ajouter depuis l'espace parent (modifier la routine) selon la saison.
- **"Aller se coucher"** — enlève les vêtements (retire plusieurs
  calques d'un coup, `retire: true`) → range/sale → dents → histoire →
  coucher. **Débloquée par l'heure** (`disponibleApresHeure: 18`), pas
  par les autres routines — volontairement sortie du chaînage séquentiel
  (cf. plus bas, "Menu de la journée").

Séquence :

1. **Menu de la journée** — liste des routines. Seule la première non
   validée est cliquable ; les suivantes sont grisées/verrouillées (🔒)
   tant que **toutes** les précédentes ne sont pas validées (pas
   seulement l'immédiatement précédente — sinon relancer une routine du
   milieu depuis l'espace parent peut laisser une routine plus loin
   débloquée à tort, cf. `construireMenu()`, `toutPrecedentValide`). Une
   routine peut sortir de ce chaînage et se débloquer par l'heure plutôt
   que par les précédentes (`disponibleApresHeure`, cf. "Aller se
   coucher" plus haut) — icône 🕒 au lieu de 🔒, message vocal dédié tant
   que l'heure n'est pas là. L'avatar y est affiché dans son état réel du
   moment (habillé ou non selon ce qui est déjà fait), avec une jauge de
   journée (une étoile par routine validée), et une horloge (jour +
   heure, `#horloge`/`majHorloge()`, purement informative). Un bouton
   voiture 🚗 distinct ("Partir à l'aventure") ouvre `screen-missions`
   (actuellement vide, pas encore de mission) **seulement si** "Se
   préparer à partir" est validée — sinon il ramène directement dans
   cette routine (`allerVersDepart()`).
2. **Écran de routine** (générique, alimenté par la routine choisie) —
   liste récapitulative complète toujours visible (l'enfant mesure ce
   qu'il reste à faire), ordre imposé (une seule tâche actionnable à la
   fois). Aucune ligne n'est tapable : seule l'icône de l'étape en cours,
   agrandie (72px), est glissable — directement dans sa ligne, le texte
   reste affiché à côté pendant le geste (lecture globale). Les tâches
   faites redescendent en bas de la liste. Un bouton retour discret (←,
   `btn-retour-routine`) ramène au menu sans rien perdre — pour un tap
   accidentel sur la mauvaise routine.
3. **Fin de routine** — félicitations spécifiques à la routine (texte +
   voix, personnalisées avec le prénom de l'enfant), puis message pour
   aller chercher un parent.
4. **Validation parent** — code à 4 chiffres (choisi à la première
   configuration, cf. "Profils" plus bas) puis écran de
   **relecture/correction** : toutes les tâches redeviennent cliquables
   pour que le parent décoche ce qui n'a pas été réellement fait avant de
   valider. À la validation : étoile gagnée, retour au menu.
5. **Récompense de fin de journée** — automatique une fois toutes les
   routines validées : confettis, total d'étoiles.
6. **Aventures** (`AVENTURES_COMMUNES` dans `app.js` — un catalogue de
   départ commun, un exemple générique ; un profil n'a par ailleurs
   aucune aventure propre en dur, cf. "Profils" plus bas) — depuis le
   menu, "Partir à l'aventure" ouvre `screen-missions`, qui liste les
   aventures programmées pour aujourd'hui (champ `date`, même format que
   `cleJour()`). Taper une carte lance :
   - **Trajet** — pas de barre de progression/minuteur, juste un temps
     d'attente avec la scène de la fenêtre de voiture
     (`app/assets/scenes/fenetre-voiture.jpg`) et l'enfant de profil en
     silhouette SVG au premier plan (`#silhouette-enfant`, partagée entre
     tous les profils — à contre-jour, elle n'a pas besoin de les
     distinguer) → bouton "On est arrivés", qui ouvre l'écran de
     **validation parent** (code à 4 chiffres, pas de correction) plutôt
     que d'avancer tout seul.
   - **Arrivée** — le vrai sprite avatar de l'enfant actif (habillé selon
     l'état réel, pas un emoji générique), programme annoncé (3 lignes)
     → "C'est parti", qui déclenche un **trajet retour** vers la maison
     (texte différent, fenêtre + silhouette retournées en CSS,
     `sensTrajet`) plutôt que la récompense directement.
   - Une fois l'arrivée à la maison confirmée par un parent : la
     récompense. Une aventure peut rapporter des **pièces**
     (`recompensePieces`) au lieu d'une étoile de routine : monnaie
     séparée, stockée à part (`cle("pieces")`), jamais remise à zéro au
     changement de jour, affichée en permanence à côté de la jauge de
     journée dès qu'elle est non nulle. Sort du même coffre que la
     récompense de fin de journée (texte + confettis adaptés). Voir
     `docs/produit/concept.md` et `modele-de-donnees.md` pour la
     philosophie (pourquoi pas une étoile). Une visite chez une
     praticienne est une aventure comme une autre, ajoutée depuis
     l'espace parent ("+ Nouvelle activité") avec un champ `personne` —
     cf. plus bas, "Espace parent".
7. **"Ma journée"** (`construireJournee()`, bouton secondaire sur le
   menu) — le planning du jour (`etat.planning`) affiché **dans l'ordre
   chronologique** (routines, aventure(s) du jour, repas — `REPAS` —
   mélangés en une seule liste, pas d'horaire pour l'instant). Calculé
   par défaut à chaque nouvelle journée (`PLANNING_DEFAUT` +
   insertion des aventures du jour via leur champ `apres`), puis
   **éditable** via un mode protégé par le code parent (bouton ✏️ →
   code → ▲/▼/✕ sur chaque ligne + un catalogue "Ajouter à la journée").
   Sortir du mode édition ne redemande pas le code ; revenir au menu si.
8. **"Mes récompenses"** (`construireRecompenses()`, en tapant sur les
   étoiles/pièces du menu) — étoiles du jour et total de pièces
   présentés comme des objets à collectionner (rotation continue,
   brillent au toucher). La pièce affiche un petit portrait de l'enfant
   teinté façon profil gravé sur une pièce d'or (`.piece-visage`),
   recadré depuis le sprite avatar existant — pas de nouvel asset dédié.
9. **Espace parent** (`ouvrirEspaceParent()`, bouton ⚙️ discret en haut à
   gauche, sur tous les écrans — symétrique du reset, mais un simple tap
   suffit : rien ici n'est destructif) — hub protégé par le code parent,
   **directement lié à l'espace enfant** (même `app.js`, même état,
   aucun outil séparé) :
   - **Relancer une routine** — pour corriger l'état si l'enfant a changé
     entre-temps (ex. redéshabillé après une routine validée). Réutilise
     l'écran de correction déjà existant (`construireCorrection()`,
     `screen-validation`) plutôt que d'en dupliquer un : mêmes tâches
     décochables, bouton "Mettre à jour" au lieu de "Valider". Si la
     routine était validée, son étoile est retirée (regagnée à la
     revalidation par l'enfant) et `journeeFaite` repasse à `false`.
   - **Historique des journées** — lecture seule de `cle("historique")`.
   - **Changer le code parent** — deux saisies identiques de suite avant
     d'enregistrer, réutilise le même pavé numérique que la vérification
     (généralisé, cf. "Points d'entrée" plus bas). Partagé par
     **appareil**, pas par enfant (`acolyte_code_parent`, cf. "Profils").
   - **Planning du jour** — lien direct vers le mode édition de "Ma
     journée" existant, sans redemander le code.
   - **Activités** — liste toutes les activités (`toutesLesAventures()`),
     chacune tapable pour l'ajouter/retirer du planning du jour
     (`basculerActivitePlanning()`) — donc de "Partir à l'aventure".
     Bouton "+ Nouvelle activité" → formulaire (nom, icône, texte du
     trajet, texte de l'arrivée, 3 étapes sur place, pièce à la fin
     oui/non), ajoutée directement au planning du jour à la création
     (`creerNouvelleAventure()`) — c'est ce qui la rend accessible dans
     "Partir à l'aventure" tout de suite, pas un champ date à renseigner.
     Persistée à part (`cle("aventures_perso")`), fusionnée avec le
     catalogue commun (`AVENTURES_COMMUNES`) via `toutesLesAventures()`
     partout où le code cherche une aventure — pas de distinction entre
     les sources ailleurs dans l'app.
   - **Routines** — liste toutes les routines (`toutesLesRoutines()`)
     avec leur état du jour, en **lecture seule** (contrairement aux
     activités, pas de bascule planning : une routine fait partie du
     parcours tous les jours dès qu'elle existe, pas d'interrupteur jour
     par jour). Bouton "+ Nouvelle routine" → formulaire (nom, icône,
     lieu chambre/salon, jusqu'à 5 tâches — texte + emoji + zone parmi
     les 6 `.zone-cible`). Pas de `calque` proposé (demanderait un sprite
     existant) : chaque tâche a son propre emoji, sans effet persistant
     sur l'avatar. Persistée à part (`cle("routines_perso")`), fusionnée
     avec le socle du profil actif via `toutesLesRoutines()`, utilisée
     partout où `app.js` cherchait un catalogue de routines directement
     (menu, avatar, jauge, planning...) pour qu'une routine créée se
     comporte identiquement aux trois routines de départ.
   - **Cet appareil** — indique quel profil (`tousLesProfils()`) cet
     appareil affiche, et permet de le changer
     (`changerProfilAppareil()`, écrit `acolyte_enfant` puis recharge la
     page) ou d'en créer un nouveau ("+ Nouvel enfant", réutilise l'écran
     de première configuration). Pas un sélecteur destiné à l'enfant :
     sert à configurer un appareil une bonne fois pour toutes, ou à en
     réattribuer un — cf. "Profils" plus bas.

Voix : synthèse vocale native du navigateur (`SpeechSynthesis`, `fr-FR`),
annoncée automatiquement à chaque nouvelle étape, rejouable via le bouton
🔊. Retour haptique (`navigator.vibrate`) sur chaque validation —
Android/Chrome uniquement.

Bouton reset (coin haut-droit sur tous les écrans, ou en pied de l'écran
de fin) protégé par un **appui long** (~900ms) plutôt qu'un simple tap,
pour qu'un enfant ne puisse pas effacer sa journée par accident.

## Ce qui n'est volontairement PAS couvert (voir `docs/produit/` et `docs/design-handoff/`)

- **Ordre/verrouillage entre routines** : toujours séquentiel et figé
  (`chainee: true` posé sur les routines de départ, cf. "Profils" plus
  bas) — pas encore reconfigurable depuis une UI parent. Un parent peut
  déjà librement créer/modifier des routines et des aventures depuis
  l'app (cf. "Espace parent" plus haut) ; c'est seulement l'ORDRE/le
  chaînage entre elles qui reste à coder en dur.
- **Dépense des pièces** : le total s'accumule et s'affiche, mais aucune
  boutique/mécanique de dépense n'est encore conçue (cf. `TODO.md`,
  section "Pas encore désigné").
- **Barème de récompense de fin de journée** : le total d'étoiles
  s'affiche, mais rien ne varie encore selon la quantité.
- **Dents et petit-déjeuner** ne sont plus des étapes drag-and-drop ici :
  ce seront des mini-jeux dédiés construits plus tard (brossage devant un
  miroir dans la salle de bain avec ses propres animations ; préparation
  de la table dans la cuisine).
- **Visites chez une praticienne** : ajoutées comme une aventure depuis
  l'espace parent (mêmes écrans génériques `screen-trajet`/`screen-arrivee`
  que les autres aventures), avec un champ `personne` qui déclenche le
  flux dédié (cf. `terminerVisite()`) — mais sans `date`, une aventure
  n'apparaît jamais toute seule dans les sorties du jour : à programmer
  explicitement le jour voulu.
- Écran de réveil (01) — sauté pour ce prototype, l'app démarre
  directement sur le menu de la journée.
- **Sélecteur de profil dans l'app** — volontairement absent côté enfant,
  et pas prévu : chaque enfant a son propre appareil (cf. "Profils" plus
  bas), pas un même appareil partagé entre plusieurs enfants (un parent
  peut techniquement configurer plusieurs profils sur un même appareil
  depuis "Cet appareil", mais c'est pensé comme un outil de test/
  réattribution, pas un sélecteur pour l'enfant). Le créateur d'avatar
  reste non couvert (avatar choisi parmi un jeu fixe de looks à la
  création du profil, pas personnalisable trait par trait par l'enfant).
- Décor de pièce : la scène reste un simple dégradé CSS (teinte
  différente par routine via `lieu`), pas de vrai décor illustré, y
  compris pour la "chambre" (aucune photo de chambre par profil créé
  depuis l'app). L'avatar, lui, est un vrai sprite (voir
  `assets/generated/` et `scripts/generate_*.py` pour le générateur qui
  l'alimente, dans `app/assets/avatar/`).
- Écran parent (06), calibrage sensoriel (07, au-delà du contour
  doux/appuyé déjà propre à chaque avatar — cf. "Profils"), écran
  praticienne (11, cf. `TODO.md`), renfort en cas de dépassement (12).

## Profils

Aucun profil n'est codé en dur par défaut : `PROFILS` (`app.js`) est un
socle vide, prévu pour qu'une entrée puisse y être ajoutée à la main si
un déploiement veut un jour figer un profil au code plutôt que le
configurer depuis l'app (avec dans ce cas des accesseurs
`routines()`/`aventuresPropres()` vers des catalogues dédiés — cf.
commentaire au-dessus de `PROFILS`). En usage normal, un profil est créé
depuis l'app : au tout premier lancement sur un appareil (écran de
première configuration — prénom, avatar choisi parmi
`AVATARS_DISPONIBLES`, code parent) ou plus tard depuis l'espace parent
("Cet appareil" → "+ Nouvel enfant"). Un profil créé ainsi est persisté
dans `profils_perso` (`localStorage`, clé `acolyte_profils_perso`) — même
principe que `routines_perso`/`aventures_perso`/`entourage_perso` plus
bas : `tousLesProfils()` fusionne `PROFILS` et `profils_perso` (un profil
perso masque une éventuelle entrée en dur du même id), et c'est cette
fonction qu'il faut utiliser partout où le code cherche/liste des
profils — jamais `PROFILS` seul. `id`/`prefixe` sont identiques pour un
profil créé depuis l'app (un timestamp, ex. `enfant-1788536651477`) ;
`sprites`/`dodo` sont copiés depuis l'entrée choisie d'`AVATARS_DISPONIBLES`
au moment de la création (cf. `finaliserPremiereConfiguration()`), pas
recalculés ensuite. À sa création, un profil est amorcé avec trois
routines de départ génériques (`routinesDemarrage(prenom, silhouette)`,
cf. "Ce qui est couvert" plus haut), directement dans `routines_perso` —
ce ne sont pas des routines "en dur" spéciales, juste le point de départ,
librement modifiable ensuite. Ajouter un enfant plus tard = "Cet
appareil" → "+ Nouvel enfant" ; il apparaît alors automatiquement dans
l'écran parent "Cet appareil".

**Chaque enfant a son propre appareil** — ce n'est **pas** un sélecteur
de profil dans une même app partagée (cf. "Ce qui n'est volontairement
PAS couvert" plus haut). `profilActifId()`/`profilActif()` déterminent
une bonne fois pour toutes quel enfant un appareil donné affiche : query
param `?enfant=<id>` (une fois dans l'URL, pour un profil déjà créé —
même mécanisme que `?debug=1`, cf. plus haut), retenu ensuite dans
`localStorage` (`acolyte_enfant`) **sur cet appareil**. Si rien ne
résout (aucun profil créé, ou `acolyte_enfant` ne correspond à aucun
profil connu) : `profilActifId()` renvoie `null`, et `demarrer()` affiche
l'écran de première configuration plutôt que le parcours normal — cf.
tout en bas de `app.js`. Un parent peut aussi changer le profil d'un
appareil depuis l'espace parent ("Cet appareil", cf. plus haut) — écrit
la même clé puis recharge la page.

`cle(nomBase)` (ex. `cle("journee")`) préfixe une clé `localStorage`
propre à l'enfant actif avec `profilActif().prefixe` — cf. "État et
persistance" ci-dessous pour la liste. Deux clés restent volontairement
**partagées par appareil**, pas préfixées par enfant, car ce sont les
mêmes parents des deux côtés : le code parent (`acolyte_code_parent`) et
le mode debug (`acolyte_debug`).

### Avatars

`AVATARS_DISPONIBLES` (`app.js`) — 4 avatars complets (base + calques,
même forme qu'un `sprites` de profil), générés par
`scripts/generate_sprites_detailed_preview.py` (cf. le dict `CHILDREN` en
tête de ce script pour les 4 combinaisons peau/cheveux/silhouette) puis
copiés dans `app/assets/avatar/` sous ces noms. Deux silhouettes (champ
`silhouette`, "pantalon"/"robe") : pilote uniquement le gabarit de
routines de départ amorcé à la création d'un profil
(`routinesDemarrage()`) — un parent peut ensuite ajouter les deux jeux de
vêtements à une même routine si besoin. Proposés dans une grille à la
première configuration (`construireGrilleAvatarsInitiale()`) ; le choix
est définitif pour ce profil (pas de re-sélection depuis l'espace
parent pour l'instant — recréer un profil si besoin, cf. "Cet appareil").
Ajouter un 5ᵉ avatar = ajouter une entrée à `CHILDREN` dans le script,
relancer `python3 scripts/generate_sprites_detailed_preview.py`, copier
les fichiers `<id>_calque_*.png`/`<id>_dodo.png` obtenus dans
`app/assets/avatar/` sous `<id>-*.png` (cf. le script pour le détail du
mapping nom de sortie → nom copié), ajouter l'entrée dans
`AVATARS_DISPONIBLES`, et penser à ajouter les nouveaux fichiers à
`A_METTRE_EN_CACHE` dans `sw.js` (cf. "Points d'entrée" plus bas).

## État et persistance

`localStorage`, clé `cle("journee")` (ex. `enfant-1788536651477_journee`
pour un profil créé depuis l'app — cf. "Profils" ci-dessus), remise à
zéro automatiquement si la date stockée diffère d'aujourd'hui. Forme :

```
{
  jour: "2026-8-26",
  routines: { shabiller: { fait: [...idsDeTâches], valide: bool },
              partir:    { fait: [...idsDeTâches], valide: bool } },
  etoiles: 0,
  journeeFaite: bool,
  planning: [ { type: "routine"|"aventure"|"repas", id: "..." }, ... ]
}
```

`fait` est un tableau d'**id de tâches** (pas d'index numériques) —
robuste au fait qu'il y ait plusieurs routines indépendantes.

`planning` est la version *éditable* de "Ma journée" (cf. plus haut) :
calculé une fois par `planningParDefaut()` à la création de l'état du
jour, puis modifié en place par le mode édition
(`deplacerItemPlanning`/`retirerItemPlanning`/`ajouterItemPlanning`).
Chaque item ne stocke qu'une référence `{ type, id }`, jamais le
nom/emoji : `libelleItemPlanning()` les résout à l'affichage depuis les
catalogues de routines/aventures du profil actif + `REPAS`, pour rester
à jour si le catalogue change. Une référence qui ne résout plus rien (id
supprimé du catalogue) est silencieusement ignorée à l'affichage plutôt
que de planter.

Les **pièces** sont dans une clé séparée, `cle("pieces")`, volontairement
**hors de `cle("journee")`** : contrairement aux étoiles, elles ne
doivent pas être remises à zéro au changement de jour
(`chargerPieces`/`sauverPieces`/`ajouterPieces` dans `app.js`).

L'**historique** des journées passées est dans une troisième clé,
`cle("historique")` (tableau, jamais remis à zéro, borné à 90 entrées) :
chaque journée y est archivée (`archiverJournee()`) au moment où
`chargerEtat()` détecte un changement de date, juste avant que
`cle("journee")` ne soit écrasée par la nouvelle journée. Entrée :
`{ jour, etoiles, routinesValidees: [...ids], journeeFaite }`. Consultable
en lecture seule depuis l'espace parent (`construireHistorique()`).

Le **code parent** est dans `acolyte_code_parent` (une chaîne de 4
chiffres, **partagée par appareil, pas par enfant** — cf. "Profils"),
choisie à la première configuration de l'appareil — `codeParentActuel()`
retombe sur `"1234"` tant qu'aucun code n'a encore été enregistré (ne
devrait normalement pas arriver en usage réel, la première configuration
en demandant toujours un). Modifiable depuis l'espace parent
(`demarrerChangementCode()`/`sauverCodeParent()`).

Les **profils** créés depuis l'app sont dans `acolyte_profils_perso` (cf.
"Profils" plus haut) — partagée par appareil comme le code parent,
jamais remise à zéro.

Les **activités créées par un parent** sont dans `cle("aventures_perso")`
(tableau d'objets au même format que les entrées du catalogue commun),
jamais remise à zéro. `toutesLesAventures()` = `AVENTURES_COMMUNES` + ce
tableau : c'est cette fonction qu'il faut utiliser partout où on
cherche/liste des aventures (`aventureParId()`, le catalogue "Ajouter à
la journée"...), jamais le catalogue en dur seul, sous peine d'ignorer
les activités créées depuis l'app.

Les **routines créées par un parent** suivent exactement le même
principe dans `cle("routines_perso")` (même format que les trois routines
de départ), fusionnée via `toutesLesRoutines()` = socle du profil actif
(vide pour un profil créé depuis l'app, cf. "Profils") + ce tableau.
**Un socle de routines seul ne doit quasiment jamais être utilisé
directement dans le code** (menu, avatar, jauge, planning,
historique...) — toujours `toutesLesRoutines()`, sous peine qu'une
routine se comporte différemment des trois routines de départ.

**Important si tu changes la forme de `cle("journee")`** :
`chargerEtat()` appelle `etatRepare()`, qui **complète en place** les
champs manquants d'un état dont le jour est bon plutôt que de tout jeter
(seul un changement de date fait vraiment repartir de zéro — et archive
l'ancien état au lieu de le perdre, cf. ci-dessus). Avant, un
`etatValide()` tout-ou-rien repartait d'un état neuf au moindre champ
manquant, y compris quand seule la *forme* avait changé (ex. l'ajout du
champ `planning`) — **ça a fait perdre une vraie progression d'un enfant
en cours de journée**, pas juste un bug théorique. Si tu ajoutes un champ
à la forme de l'état, ajoute sa réparation dans `etatRepare()` (valeur
par défaut sensée), pas juste sa vérification. Il y a aussi un filet de
sécurité au démarrage (`try/catch` dans l'IIFE `demarrer()`) pour le
seul cas vraiment irrécupérable (JSON corrompu) — dernier recours, pas
le mécanisme principal.

## Points d'entrée utiles pour étendre

- `routinesDemarrage(prenom, silhouette)` (`app.js`) — le gabarit de
  routines amorcé à la création d'un profil (cf. "Profils" plus haut),
  chacune avec `id`, `nom`, `emoji` (repris par l'écran "Ma journée"),
  `lieu` (pilote la teinte de scène), `felicitation` (texte de fin,
  personnalisé avec le prénom), et `taches` (`zone` doit correspondre à
  un élément `.zone-cible` dans `index.html`, `calque` révèle un sprite
  du profil actif via `data-calque` — cf. `profilActif().sprites`,
  `badge` affiche un emoji via `data-badge` si aucun sprite n'existe
  encore), et `disponibleApresHeure` optionnel (nombre, 0-23) : si
  présent, la routine sort du chaînage séquentiel et se débloque à partir
  de cette heure au lieu d'attendre que les précédentes soient validées
  (cf. "Aller se coucher"). `chainee: true` (posé sur "shabiller"/
  "partir") marque une routine comme participant au chaînage/verrouillage
  séquentiel du menu (cf. `construireMenu()`) — absent sur une routine
  créée depuis l'espace parent, qui reste donc toujours disponible. Pour
  une routine créée par un parent depuis l'app, cf.
  `cle("routines_perso")`/`toutesLesRoutines()` plus haut — même format,
  sans `chainee`. Une routine apparaît automatiquement au menu.
- `REPAS` (`app.js`) — tableau plat `{ id, nom, emoji }`, commun à tous
  les profils (les repas ne dépendent pas du profil), purement informatif
  pour l'écran "Ma journée" (pas de tâches, pas d'horaire).
- `AVENTURES_COMMUNES` (`app.js`) — catalogue de départ commun à tous les
  profils (l'école, à titre d'exemple). Chaque aventure a `lieu`, `emoji`,
  `texteTrajet`, `texteArrivee`, `texteTrajetRetour` (trajet du retour
  vers la maison — texte générique par défaut si absent), `programme`
  (3 lignes), `personne` optionnelle (`{ emoji, nom }`, affiche un 2ᵉ
  sprite à l'arrivée à côté du vrai avatar de l'enfant actif — c'est ce
  champ qui distingue une visite chez une praticienne d'une sortie
  ordinaire, cf. "Ce qui n'est volontairement pas couvert"), `date`
  optionnelle (format `cleJour()`, ex. `"2026-8-27"` — sert uniquement à
  ensemencer le planning d'une nouvelle journée via `planningParDefaut()`,
  cf. plus bas ; absente pour une activité créée depuis l'espace parent,
  qui est ajoutée directement au planning à la création), `apres`
  optionnelle (`{ type, id }` d'un autre item du planning — où l'insérer
  dans `PLANNING_DEFAUT` quand elle est programmée ; absente = ajoutée en
  fin de journée) et `recompensePieces` (0 = pas de récompense propre,
  sinon une pièce sort du coffre une fois le retour à la maison
  confirmé). Ajouter une aventure commune = ajouter une entrée à ce
  tableau. **Ce qui la rend accessible dans "Partir à l'aventure" n'est
  plus `date` mais sa présence dans `etat.planning` du jour**
  (`aventuresPlanifieesAujourdhui()`, utilisée par `construireMissions()`)
  — `date` ne fait que la faire entrer dans ce planning la première fois
  qu'un jour est ensemencé, après quoi le planning (édité par un parent
  ou peuplé à la création d'une activité) fait foi.
- `PLANNING_DEFAUT` (`app.js`) — le squelette de journée type utilisé par
  `planningParDefaut()` pour initialiser `etat.planning` à chaque
  nouveau jour (avant édition éventuelle par un parent, cf. plus haut).
  Référence les ids `shabiller`/`partir`/`soir` du gabarit de départ —
  cf. `routinesDemarrage()` ci-dessus.
- `synchroniserAvatar()` — recalcule les calques/badges visibles à partir
  de **toutes** les routines (pas seulement la routine en cours), pour
  que l'avatar reste cohérent entre le menu et l'écran de routine.
- `rendreGlissable(el, etape)` — moteur générique de glisser-déposer
  (pointer events, hit-test). Glisse un **clone** de `el` positionné en
  `fixed`, pas `el` lui-même (qui passe juste en `visibility:hidden` le
  temps du geste) : ça permet à `el` de vivre dans une ligne de liste,
  à côté de son texte, sans faire sauter la mise en page quand le geste
  commence.
- Panneau debug (`btn-debug-parent-appareil` en plus des boutons
  existants) affiche le code parent en clair (`debug-code-parent`, cf.
  `codeParentActuel()`) pour ajuster rapidement le code pendant les
  tests, plutôt qu'une constante en tête de fichier.
- `#silhouette-enfant` (`index.html`/`styles.css`) — l'enfant de profil
  sur l'écran de trajet est un `<path>` SVG à aplat uni (`fill`), pas un
  sprite, **partagé entre tous les profils** (à contre-jour, une
  silhouette n'a pas besoin de les distinguer) : simple à retourner
  (`scaleX(-1)`, cf. `.retour`) et à recolorer, mais grossier — à
  remplacer par un vrai sprite de profil si la direction artistique
  l'exige un jour.
- `.piece-visage` (`styles.css`) — portrait de pièce recadré via un
  positionnement `absolute` en px (pas de détourage réel) puis teinté au
  filtre CSS (`grayscale`+`sepia`+`hue-rotate`) façon profil gravé.
  `construireRecompenses()` (`app.js`) pointe la balise `<img>` vers
  `profilActif().sprites.base` : mêmes valeurs de recadrage pour tous les
  avatars, parce que tous les sprites de base viennent du même générateur
  avec la tête au même endroit sur la même grille (cf.
  `scripts/generate_sprites_detailed_preview.py`) — à recalculer
  seulement si cette grille change.
- `A_METTRE_EN_CACHE` (`sw.js`) — liste des fichiers mis en cache pour le
  fonctionnement hors-ligne. **Si tu ajoutes un asset référencé par
  `index.html`/`styles.css`/un nouvel avatar** (nouvelle image, nouvelle
  scène...), ajoute-le ici aussi, sinon il ne sera pas disponible
  hors-ligne. Incrémenter `CACHE_NAME` (ex. `acolyte-v15`) force le
  renouvellement du cache d'un appareil déjà installé au prochain
  chargement en ligne.
- `construireClavier(conteneur, onTouche)` / `majCasesCode(conteneurCases, saisi)`
  (`app.js`) — pavé numérique générique (partagé entre la vérification du
  code existant, la saisie d'un nouveau code et le tout premier code
  parent d'un profil, cf. `modeCode` dans `validerCode()`), pas un
  composant par écran. Pour un nouvel écran de code, appeler ces deux
  fonctions avec les éléments `.case-code`/`.touche-code` de cet écran
  plutôt que d'en dupliquer le HTML/JS.
