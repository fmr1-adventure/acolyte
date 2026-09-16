# Handoff : application de routines en pixel art (« Le Matin »)

## Vue d'ensemble

Application mobile / tablette qui aide deux enfants (Iris, 5 ans, et Théo, 8 ans — tous deux TSA et TDAH) à accomplir leurs routines quotidiennes en autonomie. Le planning visuel de la journée et un jeu de vie en pixel art sont fusionnés en un seul objet : la journée est la carte, les lieux sont les niveaux, les routines sont les phases d'action, les trajets sont des phases d'attente.

Contrainte structurante : **les enfants ne savent pas lire**. Chaque écran enfant doit être jouable à l'oreille et à l'image. Le texte écrit existe mais n'est jamais porteur d'information seule.

Deuxième contrainte : **les réglages sensoriels sont propres à chaque enfant**. Théo a besoin de contrastes forts, Iris de contrastes doux. Ce n'est pas un thème clair/sombre, c'est un calibrage à quatre curseurs posé à la création du profil.

## À propos des fichiers de design

Le fichier `Dayrise Universe.dc.html` de ce dossier est une **référence de design réalisée en HTML** : un prototype qui montre l'intention visuelle et le comportement attendu, pas du code de production à reprendre tel quel.

Le travail consiste à **recréer ces designs dans l'environnement du dépôt cible** (React Native, Flutter, React web, SwiftUI…) en suivant ses conventions, ses composants et ses bibliothèques existantes. Si aucun environnement n'existe encore, choisir le framework le plus adapté au projet (une app installée sur tablette, hors ligne, avec stockage local et synthèse vocale : React Native ou Flutter sont les candidats naturels) et implémenter les designs dedans.

Le HTML n'utilise que des styles inline et aucune image : les scènes en pixel art sont des **zones repères annotées**, à remplacer par de vrais sprites (voir « Assets »).

## Fidélité

**Mixte, à lire écran par écran :**

- **Haute fidélité (hifi)** — les 12 maquettes de téléphone (390 × 800 pt) et le croquis de la chambre de Théo : couleurs, tailles de police, épaisseurs de bordure et espacements sont ceux à reproduire. Les valeurs exactes sont dans « Tokens ».
- **Basse fidélité (lofi)** — tout ce qui est marqué `[ ... ]` en majuscules dans les maquettes : ce sont les emplacements des sprites pixel art (chambre, avatar, coffre, intérieur de voiture, cabinet). La composition, les dimensions et la lumière sont fixées ; le dessin reste à produire.
- **Documentation, pas UI** — les cartes de la « bible » (boucle, personnages, règles audio, calibrage) sont du texte de cadrage à lire, pas des écrans à coder.

## Écrans

Numérotation reprise du fichier de design. Tous les écrans enfant sont dessinés pour un cadre de **390 × 800 pt**, à adapter en pleine hauteur sur tablette.

### Structure de navigation

Trois onglets en pied d'écran chez l'enfant, hauteur 58 pt, bordure supérieure 3 px :
`Chambre` · `Héros` · `Maison`. Les onglets sont des pictos, jamais des mots. L'onglet actif a un fond clair et un picto de la couleur d'accent ; les inactifs sont en contour sourd.

L'écran Parents n'est pas un onglet : il s'ouvre par un code à 4 chiffres et se ferme explicitement.

---

### 00 — La chambre de Théo (croquis de décor, pas un écran)

**But :** plan à donner à l'artiste pixel. Vue de face, canvas **1280 × 880**, tout aligné sur une grille de **16 px**.

Géométrie (coordonnées absolues dans le canvas) :

| Élément | left | top | w | h | Couleur |
|---|---|---|---|---|---|
| Mur | 0 | 0 | 1280 | 640 | bandes `#212B47` / `#1E2740`, 96 px |
| Plinthe | 0 | 608 | 1280 | 32 | `#141C33` |
| Sol | 0 | 640 | 1280 | 240 | lames `#6B4A2E` / `#5E4028`, 40 px |
| Fenêtre (cadre) | 96 | 96 | 288 | 240 | fond `#141C33`, bordure 16 px `#8C9BBC` |
| Vitre | 128 | 128 | 224 | 176 | `#F3C98B` |
| Meneau vertical | 232 | 128 | 16 | 176 | `#8C9BBC` |
| Meneau horizontal | 128 | 208 | 224 | 16 | `#8C9BBC` |
| Rebord | 96 | 336 | 288 | 16 | `#C3CEE6` |
| Faisceau de lumière | 96 | 336 | 800 | 512 | `rgba(255,196,120,.16)`, `clip-path: polygon(0 0, 288px 0, 800px 512px, 176px 512px)` |
| Poster voiture | 480 | 112 | 176 | 224 | `#F0952F`, bordure 8 px `#C97622` |
| Poster n° | 704 | 128 | 144 | 176 | `#33406A`, bordure 8 px `#4A5880` |
| Étagère | 912 | 352 | 320 | 24 | `#8A6039` |
| Casque | 944 | 272 | 128 | 80 | `#F0952F` + visière `#141C33` |
| Médaille | 1136 | 288 | 32 | 40 | `#7FA6A1` + ruban `#E8B54C` |
| Bureau | 912 | 448 | 320 | 24 | `#8A6039`, pieds 24 × 168 `#6B4A2E` |
| Lit (tête) | 96 | 384 | 32 | 256 | `#8A6039` |
| Matelas | 128 | 424 | 416 | 32 | `#C3CEE6` |
| Couverture | 128 | 456 | 288 | 88 | `#F0952F`, liseré `#C97622` |
| Oreiller | 432 | 440 | 104 | 72 | `#E8EDF7` |
| Circuit (anneau) | 288 | 656 | 704 | 192 | bordure 32 px `#3A3A44`, **`box-sizing: border-box`** |
| Tapis | 400 | 704 | 464 | 96 | `#33406A`, bordure 8 px `#4A5880`, `border-box` |
| Voiture jouet | 656 | 632 | 96 | 40 | `#F0952F` |
| Biscuit (chat) | 128 | 768 | 144 | 64 | `#E0D2AE` |
| Ombres au sol | 96 / 912 | 640 | 448 / 320 | 24 | `rgba(10,14,26,.35)` |

**Règles de rendu :** une seule source de lumière (la fenêtre, à gauche), ombres longues et douces. **Aucun contour sur les meubles** ; le contour foncé est réservé aux personnages pour qu'ils se détachent du décor. Palette limitée à six couleurs (voir tokens `leon.*`) : toute couleur supplémentaire doit en remplacer une, pas s'ajouter.

**Le circuit au sol est fonctionnel** : la voiture posée dessus avance d'un cran par matin validé. C'est une progression lisible sans savoir lire un chiffre. Prévoir ~20 positions le long de l'anneau.

---

### 01 — Le réveil (Iris)

**But :** point d'entrée quotidien. L'enfant voit sa chambre et entend ce qu'il y a à faire.

**Layout** (colonne, de haut en bas) :
1. Barre d'état, padding `14px 18px 8px`, texte `Silkscreen 11px` `#8A6F75` : heure · prénom · état du son.
2. Scène de chambre, hauteur **290**, marge latérale 14, bordure 2 px `#221F1A`, fond en lames horizontales de 8 px `#E9D3D6` / `#E2CBCF`, plus une nappe de lumière `linear-gradient(105deg, rgba(255,240,220,.6), transparent 55%)`. Le chat en bas à droite, 34 × 34, animation `bob` 4 s.
3. **Bouton voix**, 76 × 76, fond `#F7B8CB`, bordure 3 px, ombre portée `4px 4px 0 #D9A3B4`, contenant 4 barres verticales de 5 px qui ondulent (`wave`, 1 s, décalages 0 / .15 / .3 / .45 s). À côté : titre 24 px gras (« Bonjour Iris. ») + ligne 16 px `#6B5257` (« Appuie pour réécouter. »).
4. Barre de progression segmentée : hauteur 16, bordure 2 px, `gap: 3px`, un segment par tâche — rempli `#C88AA0`, vide `#EDDCDF`. Légende `Silkscreen 10px` en dessous.
5. Grille de tâches, `repeat(3, 1fr)`, `gap: 12px`. Trois états :
   - **fait** : fond `#C88AA0`, picto en creux, mot en `#FAF0F0`
   - **en cours** : fond `#FFFBF6`, bordure **3 px**, ombre `4px 4px 0 #D9A3B4`
   - **à venir** : fond `#FAF0F0`, bordure 2 px, `opacity: .6`
   Chaque case = picto 44 × 44 + mot 13 px gras dessous.
6. Barre d'onglets.

**Audio :** au chargement, lecture unique de « Bonjour Iris. On va se brosser les dents. » Le bouton rose rejoue la même phrase à l'identique, autant de fois que voulu.

---

### 02 — S'habiller

**But :** la routine la plus détaillée. Un vêtement à la fois.

**Layout :** en-tête (retour · titre de quête · `3 / 5`) → sprite du héros, hauteur 280 → badge `3 PORTÉS` en haut à gauche → bouton voix 64 × 64 + consigne 22 px (« Mets ton gilet. ») → grille `repeat(3, 1fr)` de 6 cases carrées (`aspect-ratio: 1`) → bouton d'action pleine largeur, hauteur mini 64, fond `#221F1A`, texte 19 px (« Je l'ai mis »).

**États des cases :** porté = fond accent + mot clair ; à faire = fond crème, bordure 3 px, ombre ; verrouillé = `opacity: .5`. La dernière case peut être un `?` — un vêtement surprise.

**Comportement :** les étapes se **dévoilent** dans l'ordre, elles ne se listent pas. Seule l'étape en cours est actionnable. Sauter une étape est possible et **silencieux** : aucun message, aucune pénalité. Chaque vêtement est annoncé à voix haute ; le sprite gagne une couche à chaque validation.

Théo : mêmes règles, 6 étapes au lieu de 5.

---

### 03 — La maison

**But :** choisir où aller. C'est le planning visuel réduit à la maison.

**Layout :** bouton voix 56 × 56 + « On va où ? » → liste de pièces, `gap: 10px`. Chaque ligne : vignette de pièce 52 × 52 (motif diagonal 6 px, deux tons), nom de pièce 19 px gras, tâche associée 15 px `#6B5257`.

**États :** pièce en cours = fond `#FFFBF6`, bordure 3 px, ombre, plus un carré d'accent 22 × 22 en clignotement lent (`blink`, 2,4 s, `steps(1)`) ; pièce à venir = bordure 2 px ; pièce verrouillée = bordure **pointillée**, `opacity: .75`, mention « à la fin ».

En pied de liste, une carte noire `#221F1A` : la présence de Biscuit, en texte et en voix (« Biscuit est dans la cuisine, assis là où vont les assiettes. »).

**Comportement :** toucher une pièce **dit son nom à voix haute** avant d'y entrer. L'entrée est le seul élément verrouillé du jeu, et elle s'ouvre quand la liste est finie.

---

### 04 — Le coffre + code parent

**But :** validation adulte de fin de routine.

**Layout :** scène avec le coffre fermé au centre (130 × 100, `#C89A6B`, ombre `5px 5px 0 #A87E54`, serrure 34 × 30 `#E0C08B`, mention `FERMÉ`) → bouton voix + « Tu as tout fait, Iris. » / « Va chercher un grand pour ouvrir le coffre. » → **pavé de code** : 4 cases carrées (remplies = carré noir 14 × 14 ; case active = bordure 3 px + ombre) et un clavier `repeat(5, 1fr)`, cases de 44 pt mini → note en bas, bordure pointillée : le coffre attend, sans compte à rebours.

**Comportement :** code à 4 chiffres, défini par le parent. Sans code, l'écran **reste là indéfiniment** : rien ne clignote, rien ne presse, rien n'expire. Code faux = les cases se vident, sans son d'erreur ni message. Prévoir un délai croissant après 5 essais (protection enfant, pas sécurité).

**Contenu du coffre :** paramétrable côté parent — un vêtement (défaut), un objet de chambre, ou une récompense réelle saisie librement. **Décision volontairement laissée ouverte, à trancher enfant par enfant.**

---

### 05 — Théo, deuxième peau

**But :** montrer que c'est le **même écran 01 avec un autre calibrage**, pas un autre écran.

Différences, toutes issues du profil : palette bleu nuit / orange (`#1E2740`, `#F0952F`), 5 tâches visibles au lieu de 3 (grille `repeat(3, 1fr)` sur deux lignes, dernière case = le coffre en pointillés), bordures plus épaisses, étape en cours en **orange plein bordé de clair** (`#33406A` + bordure 3 px `#E8EDF7`), et une ligne de contexte `2 / 5 · HIER : 6 MIN`.

**Le temps d'hier ne se compare qu'à lui-même. Jamais à sa sœur.** Aucun compteur inter-profils, aucun classement.

---

### 06 — Écran Parents

**But :** piloter. Le seul écran avec du texte dense, sans pixel art et sans son.

**Layout :** en-tête avec bordure basse → sélecteur d'enfant (deux onglets, l'actif en `#221F1A` sur texte clair) → trois blocs :
1. **La semaine** — 7 colonnes (`aspect-ratio: .55`), remplissage en `linear-gradient(to top, ...)` proportionnel aux tâches validées, jour courant en bordure 3 px, week-end en pointillés. Une phrase de synthèse en dessous, factuelle (« Quatre matins validés sur cinq. Jeudi, elle a arrêté après les dents. »).
2. **Ses tâches** — liste réordonnable, picto + nom + nombre d'étapes, plus une ligne pointillée « Ajouter une tâche ». Lien `MODIFIER` en `#2F6E6B`.
3. **Le coffre de ce soir** — carte noire, trois choix segmentés (`un vêtement` / `un objet` / `à moi`) + la précision de ce qui a été choisi.

---

### 07 — Création de profil, étape de calibrage

**But :** régler l'univers sensoriel de l'enfant. **Troisième étape sur quatre**, entre le prénom et le choix de la chambre. Modifiable ensuite à tout moment.

Trois groupes de segments (3 options chacun, option active en `#221F1A` sur texte clair) : **contraste** doux / moyen / élevé — **tâches visibles** une / trois / tout — **mouvement** aucun / discret / vivant. Puis un **aperçu en direct** : une carte de tâche réelle qui se re-rend à chaque changement. Bouton `CONTINUER` en pied.

Un quatrième curseur (**voix** : débit lent ou normal, lecture auto ou sur appui) et un cinquième (**chrono** visible ou masqué) sont décrits dans la bible et à ajouter ici.

**Les trois rendus de contraste** (documentés côte à côte dans le design) :

| | Doux | Moyen | Élevé |
|---|---|---|---|
| Fond | `#F3E7E7` | `#E7E2D6` | `#1E2740` |
| Carte inactive | `#FAF0F0`, bordure `#A88A90` | `#F6F1E7`, bordure `#6B6353` | `#2A3556`, bordure `#8C9BBC` |
| Carte active | `#FFFBF6`, bordure 2 px `#6B5257`, ombre | `#FFFDF7`, bordure **3 px** `#221F1A`, ombre | `#F0952F`, bordure **4 px** `#FFF6E8` |
| Signal de l'état actif | ombre + épaisseur | bordure noire + accent sur le picto | aplat de couleur |

Dans les trois cas, fait / en cours / à venir restent distinguables **sans la couleur** (épaisseur du trait, ombre portée, picto éteint) : un écran en plein soleil ou une perception atypique des couleurs ne cassent pas la lecture.

---

### 08 — La carte de la journée

**But :** le planning visuel de la journée = la carte du jeu.

**Layout :** en-tête (`MA JOURNÉE` · jour · niveau) → **barre des trois monnaies** (étoiles `#E8B54C`, expérience `#7FA6A1`, objets `#B98BA4`, chacune = carré 20 × 20 + nombre 15 px gras) → liste verticale des étapes du jour.

**États d'une étape :** passée = `opacity: .55` + coche verte ; **en cours** = fond `#F0952F`, bordure 4 px `#FFF6E8`, texte foncé, badge `ICI` clignotant ; à venir = fond `#33406A`, bordure `#8C9BBC`, gain annoncé (`+30`) ; **zone libre** = bordure **pointillée** `#B98BA4` et la mention explicite **« rien à faire là-bas »**.

Chaque ligne : vignette 44 × 44, nom du lieu 16 px gras, sous-titre 13 px (routine, durée, ou nature de l'activité).

---

### 09 — La transition (le trajet)

**But :** rendre le déplacement lisible sans rien demander.

**Layout :** scène intérieur de voiture, hauteur 330, avec paysage qui défile lentement → bouton voix + « On roule vers chez Camille. » / « Tu n'as rien à faire. Tu peux regarder dehors. » → carte `LE TRAJET` avec une barre qui **se remplit toute seule** (aucun chiffre, aucune minute) → carte pointillée signalant la présence de l'autre enfant → note de bas d'écran rappelant que c'est une phase d'attente.

**Comportement :** aucun chrono, aucun bouton, aucune étoile à gagner. L'écran peut rester allumé ou s'éteindre sans conséquence. **C'est ici que le monde partagé se voit** : les deux avatars dans la même voiture, sans interaction ni compétition.

---

### 10 — L'arrivée chez la praticienne

**But :** rendre le rendez-vous prévisible avant d'entrer.

**Layout :** scène du cabinet avec **deux sprites** posés au sol (l'enfant 66 × 96, la praticienne 66 × 110, prénoms en `Silkscreen 8px`) → bouton voix + « Camille est là. » / « Orthophoniste. Une demi-heure, comme mardi dernier. » → carte `CE QUI VA SE PASSER`, **toujours les trois mêmes lignes** (on entre et on s'assoit / on travaille avec Camille / on repart) → bouton `C'est parti` en orange → note : pendant la séance, l'app se met en veille, rien ne vibre, rien à toucher.

**Représentation des praticiennes : avatar de métier + prénom.** Pas de photo, pas de portrait ressemblant. Cela évite de collecter un accord et une image par soignante (RGPD) et reste identifiable par l'enfant. Un avatar dédié peut être ajouté au cas par cas, avec accord écrit.

---

### 11 — La note de la praticienne (écran adulte)

**But :** clôturer l'activité et alimenter l'expérience.

**Layout :** en-tête `ÉCRAN PRATICIENNE` → contexte de séance → **note sur 5** en 5 cases carrées, la sélectionnée en `#7FA6A1` bordure 3 px + ombre → champ de commentaire libre facultatif → carte noire `CE QUE THÉO VA VOIR` montrant uniquement `+ 30 expérience` → bouton `VALIDER LA SÉANCE` en `#7FA6A1`.

**Règle non négociable :** la note module l'expérience gagnée mais **n'est jamais montrée à l'enfant**. Une note basse donne moins d'expérience, **jamais zéro**, et jamais de message négatif. L'enfant voit un gain, pas une évaluation. Sans cette séparation, un rendez-vous de soin devient un examen noté — et un enfant TSA retiendra le chiffre bien plus que le gain.

---

### 12 — Le renfort (temps dépassé)

**But :** gérer le dépassement du chrono sans sanction.

**Layout :** scène avec l'avatar assis par terre — **aucune animation d'échec**, la lumière reste chaude → bouton voix + « Ça bloque, c'est normal. » / « J'ai appelé du renfort. » → carte annonçant qu'un adulte arrive, avec la sous-étape précise qui bloque → liste `CE QUI NE CHANGE PAS`, trois lignes, une par monnaie : les étoiles restent, l'expérience ne baisse pas, la routine reste ouverte → bouton `J'attends ici`.

**Comportement :** le dépassement déclenche un **appel à l'adulte**, pas une pénalité. L'écran **nomme explicitement ce qui ne change pas** — c'est le point à observer en premier lors des tests avec les enfants.

## Interactions et comportement

### Audio (transverse, structurant)

- Synthèse vocale française, voix calme, débit lent par défaut et réglable par profil.
- **Lecture automatique une fois** à l'ouverture d'un écran, puis **rejouable à volonté** par le bouton haut-parleur.
- **Aucun son ne surprend** : rien ne se joue sans qu'un écran vienne de s'ouvrir ou qu'un doigt ait touché. Coupure du son en un appui, depuis n'importe où.
- **Une phrase courte par consigne.** Sujet, verbe, objet. « Mets ton pantalon. » Jamais deux consignes dans la même phrase.
- Le bouton voix pulse pendant la lecture (barres animées), s'immobilise à l'arrêt.
- Toucher une pièce, une tâche ou un vêtement en dit le nom.

### Chrono

- Compte le **temps écoulé**, ne décompte pas un temps restant.
- Visible en minutes chez Théo, masqué chez Iris — c'est un réglage de profil.
- **Aucune couleur ne change au dépassement, aucun son ne se déclenche.** Le dépassement ouvre l'écran 12.

### Validation adulte

- Fin de routine seulement (réglable : par tâche).
- L'enfant va chercher l'adulte, qui valide sur la tablette avec son code à 4 chiffres.
- Les récompenses **attendent le code** : le coffre reste fermé jusque-là.
- Pas de notification push dans cette version (choix explicite). L'architecture doit néanmoins prévoir un point d'extension : un événement « routine terminée, en attente de validation » émis à un canal remplaçable.

### Animations

Trois seulement, toutes discrètes, toutes désactivables par le curseur mouvement :

| Nom | Durée | Courbe | Effet |
|---|---|---|---|
| `bob` | 4 s, infini | `ease-in-out` | `translateY(0 → -3px → 0)` — le chat, les objets vivants |
| `blink` | 2,4 s, infini | `steps(1)` | `opacity 1 → .3` — badge de l'étape en cours |
| `wave` | 1 s, infini, décalages .15 s | `ease-in-out` | `scaleY(.4 → 1 → .4)` — barres du bouton voix |

**Jamais** d'animation plein écran, de secousse, de flash, de confetti. « Mouvement : aucun » coupe même la respiration des rideaux — respecter aussi `prefers-reduced-motion`.

Reste à concevoir : l'animation de succès de fin de routine et l'attente de l'avatar dans l'entrée.

### Règles d'accessibilité (contraignantes)

- **Plancher de contraste : 4,5:1 pour tout texte, 3:1 pour les pictos et les bordures**, y compris en mode doux. Baisser le contraste ne veut pas dire devenir illisible.
- **Jamais la couleur seule** : un état est toujours porté par au moins deux signaux (couleur + forme, couleur + mot, ou couleur + voix).
- **Aucun blanc pur, aucun noir pur.** Crème et encre chaude à la place.
- Cibles tactiles : **44 pt minimum**, 64 pt pour les boutons d'action et le bouton voix.
- Le fait sort du chemin : une tâche terminée s'éteint au lieu de concurrencer visuellement la suivante.
- **Rien ne se perd** : pas de série à tenir, pas de compte à rebours, pas d'urgence. Un matin manqué ne remet aucun compteur à zéro.

## Gestion d'état

### Modèle de données

```
Profile
  id, prénom, âge
  skin            : 'iris' | 'leon'          // palette + décor
  calibration     : { contrast: 'soft'|'medium'|'high',
                      density: 1|3|'all',
                      motion: 'none'|'subtle'|'lively',
                      voice: { rate: 'slow'|'normal', autoplay: bool },
                      timer: { visible: bool } }
  wallet          : { stars: int, xp: int, items: [ItemId] }
  visibleCurrencies : [ 'stars' | 'xp' | 'items' ]   // Iris : ['stars'] seulement
  wardrobe        : [GarmentId]
  roomState       : { placedItems: [...], trackPosition: int }

Routine
  id, profileId, nom, picto, ordre
  steps          : [ { id, picto, mot, garmentId? } ]
  targetMinutes  : int | null

DayPlan  (défini par l'adulte)
  date, profileId
  entries : [ { type: 'routine'|'transit'|'activity'|'free',
                placeId, routineId?, practitionerId?,
                xpReward?, starReward? } ]

RunLog
  routineId, date, startedAt, completedAt, elapsedSeconds
  stepsDone      : [stepId]
  helpRequested  : bool
  validatedBy    : 'parent' | null, validatedAt

ActivityLog
  activityId, date, practitionerId
  score          : 1..5 | null     // jamais exposé à l'enfant
  note           : string | null
  xpGranted      : int
```

### Transitions

- `routine.start` → phase d'action, chrono démarre si `targetMinutes` défini.
- `step.complete` → sprite gagne une couche, étape suivante dévoilée, son de validation.
- `elapsed > targetMinutes` → `helpRequested = true`, écran 12. **Aucun autre effet.**
- toutes les étapes faites → coffre fermé, en attente de code.
- `parentCode.valid` → `validatedAt`, ouverture du coffre, crédit des étoiles.
- `activity.finish` → écran praticienne, `score` saisi → `xpGranted = f(score)`, plancher strictement > 0.

### Formule d'expérience

`xpGranted = base × (0,6 + 0,1 × score)` — soit 70 % à 110 % de la base pour une note de 1 à 5. Une note de 1 rapporte encore 70 % : le gain existe toujours.

### Persistance

Local d'abord, hors ligne par défaut. Aucune donnée d'enfant ni de praticienne ne quitte l'appareil dans cette version. Le code parent est stocké haché.

## Tokens de design

### Couleurs — communes

| Nom | Hex | Usage |
|---|---|---|
| `ink` | `#221F1A` | encre, bordures, texte principal |
| `ink.soft` | `#4A4437` | texte secondaire |
| `ink.mute` | `#6B6353` | légendes |
| `ink.faint` | `#8A7F6C` | libellés Silkscreen |
| `paper` | `#EDE6DA` | fond de document |
| `paper.card` | `#F6F1E7` | fond de carte |
| `paper.edge` | `#DCD3C3` | fond de barre, puces |
| `shadow.warm` | `#D2C8B5` | ombre portée dure |
| `dashed` | `#A99E8B` | bordure pointillée (verrouillé, à ajouter) |
| `link` | `#2F6E6B` / `#1F4D4B` | lien, survol |

### Couleurs — monnaies

| Nom | Hex |
|---|---|
| `currency.stars` | `#E8B54C` |
| `currency.xp` | `#7FA6A1` |
| `currency.items` | `#B98BA4` |

### Couleurs — peau Iris (contraste doux)

| Nom | Hex |
|---|---|
| `iris.bg` | `#F3E7E7` |
| `iris.surface` | `#FAF0F0` |
| `iris.surface.raised` | `#FFFBF6` |
| `iris.scene.a` / `.b` | `#E9D3D6` / `#E2CBCF` |
| `iris.scene.alt.a` / `.b` | `#EDDCDF` / `#E6D4D8` |
| `iris.accent` | `#C88AA0` |
| `iris.accent.voice` | `#F7B8CB` |
| `iris.accent.shadow` | `#D9A3B4` |
| `iris.text` | `#6B5257` |
| `iris.text.faint` | `#8A6F75` |
| `iris.tabbar` | `#E4CFD3` |
| `iris.border.soft` | `#A88A90` |
| `iris.dashed` | `#B79AA0` |

### Couleurs — peau Théo (contraste élevé)

| Nom | Hex |
|---|---|
| `leon.bg` | `#1E2740` |
| `leon.bg.alt` | `#212B47` |
| `leon.deep` | `#141C33` |
| `leon.outline` | `#0E1424` |
| `leon.surface` | `#263050` |
| `leon.surface.raised` | `#2A3556` |
| `leon.surface.active` | `#33406A` |
| `leon.surface.high` | `#4A5880` |
| `leon.accent` | `#F0952F` |
| `leon.accent.voice` | `#E08A3C` |
| `leon.accent.shadow` | `#8A4E1C` |
| `leon.accent.dark` | `#C97622` |
| `leon.accent.edge` | `#FFF6E8` |
| `leon.text` | `#E8EDF7` |
| `leon.text.soft` | `#C3CEE6` |
| `leon.text.mute` | `#A9B6D4` |
| `leon.text.faint` | `#8C9BBC` |
| `leon.wood` | `#6B4A2E` / `#5E4028` / `#8A6039` |
| `leon.light` | `#F3C98B` |
| `leon.track` | `#3A3A44` |

### Typographie

| Rôle | Police | Taille | Graisse |
|---|---|---|---|
| Titre de section | Silkscreen | 30 px | 400 |
| Titre de bloc | Silkscreen | 20-24 px | 400 |
| Libellé technique | Silkscreen | 9-12 px, `letter-spacing: 1-2px` | 400 |
| Titre d'écran | Atkinson Hyperlegible | 22-25 px | 700 |
| Titre de carte | Atkinson Hyperlegible | 17-20 px | 700 |
| Corps | Atkinson Hyperlegible | 15-17 px, `line-height: 1.45` | 400 |
| Mot sous picto | Atkinson Hyperlegible | 11-13 px | 700 |

**Atkinson Hyperlegible** est un choix délibéré (lisibilité, distinction des glyphes proches). **Silkscreen** est réservé aux libellés courts en majuscules — jamais pour du texte destiné à l'enfant. `text-wrap: pretty` sur les paragraphes.

### Espacement, bordures, ombres

- Échelle : 4 / 6 / 8 / 10 / 12 / 14 / 16 / 18 / 20 / 24 / 28 / 36 / 40 px.
- Padding d'écran enfant : 14-20 px. Padding de carte : 12-16 px. Padding de carte de doc : 22-28 px.
- Bordures : **2 px** par défaut, **3 px** pour l'élément actif, **4 px** pour l'actif en contraste élevé, **pointillé 2 px** pour le verrouillé.
- **`border-radius: 0` partout.** Seule exception : le cadre de téléphone des maquettes (30 px / 22 px), qui n'est pas dans l'app.
- Ombres dures uniquement, jamais de flou : `3px 3px 0`, `4px 4px 0`, `6px 6px 0`, `10px 10px 0`, `12px 12px 0`.
- Grille de sprite : **16 px**, sprites de personnages à **32 px**.

## Assets

**Aucun asset binaire dans ce paquet.** Tout ce qui est marqué `[ ... ]` dans les maquettes est un emplacement.

**Polices** — Google Fonts : `Silkscreen` (400, 700) et `Atkinson Hyperlegible` (400, 700, italique). À embarquer localement pour le fonctionnement hors ligne.

**Pixel art à produire** (le poste de travail principal du projet) :

- 2 chambres (Iris, Théo) — le croquis 00 fixe la composition de celle de Théo
- 4 lieux communs : salle de bain, cuisine, salon, entrée
- 2 lieux de transition : intérieur de voiture, cabinet
- 2 avatars d'enfant, avec couches de vêtements superposables (~40 pièces de garde-robe à terme, 14 au départ)
- Biscuit le chat, quelques poses
- Avatars de praticiennes par métier (orthophoniste, psychomotricienne, école…)
- Pictos de tâches et de vêtements, 44 × 44 minimum
- Coffre : états fermé et ouvert
- Objets de collection pour les étagères

Deux voies : commander à un artiste pixel sur la base de ce document, ou acheter un pack d'intérieurs cosy et l'adapter. Les deux palettes de six couleurs par peau doivent être imposées à l'artiste.

**Voix** : synthèse vocale de la plateforme (`SpeechSynthesis` web, `AVSpeechSynthesizer` iOS, `TextToSpeech` Android), locale `fr-FR`, débit réduit. Aucun enregistrement à produire.

## Fichiers

- `Dayrise Universe.dc.html` — le document de design complet : bible d'univers, croquis de la chambre de Théo, calibrage sensoriel avec les trois rendus de contraste, et les 12 maquettes d'écran. Ouvrable directement dans un navigateur.
- `support.js` — runtime du format de design. Nécessaire pour ouvrir le HTML, **sans aucun intérêt pour l'implémentation**.

## Ce qui n'est pas encore conçu

À ne pas inventer sans arbitrage : l'animation de succès et l'attente de l'avatar dans l'entrée · l'écran adulte de composition de la journée · la boutique des prix · la routine du soir · le contenu du coffre par enfant · la représentation des zones libres (Papi et Mamie) au-delà de la mention « rien à faire là-bas ».
