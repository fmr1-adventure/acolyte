# Gérer les activités — conception

*Conception validée en discussion le 25/10/2026, avant implémentation
(les points marqués « à confirmer » restent à valider).
Complète `concept.md` (le pourquoi), `modele-de-donnees.md` (les entités)
et `parcours-journee.md` (le déroulé), qui seront mis à jour au fil de
l'implémentation.*

## Objectif

Deux publics, deux critères de réussite :

- **Les parents** savent d'un coup d'œil ce qui est prévu, et le
  préparent sans effort : un seul endroit par action, et ce qui revient
  chaque semaine n'est saisi qu'une fois.
- **L'enfant**, qui ne lit pas, comprend sa journée sans rien lire : une
  seule liste, dans l'ordre, « maintenant » et « après » toujours
  visibles, et tout s'écoute à tout moment.

## Constat

1. **Une activité ne peut être qu'une sortie.** Le modèle
   (`AVENTURES_COMMUNES`/`aventures_perso`) impose un trajet aller, une
   arrivée, trois étapes sur place et un trajet retour. Rien ne couvre
   « lecture », « temps calme » ou « devoirs ».
2. **L'enfant voit sa journée à trois endroits** : les routines au menu
   (`construireMenu()`), les sorties derrière la voiture
   (`allerVersDepart()` → `construireMissions()`, accessible seulement
   une fois « Se préparer à partir » validée), et la vue d'ensemble dans
   « Ma journée ». Aucun écran n'annonce ce qui vient après en traversant
   routines et activités.
3. **Les parents ont trois entrées pour planifier** : le catalogue
   « Activités » (toucher une activité bascule sa présence aujourd'hui),
   « Planning des journées » (aujourd'hui + 7 jours), et le mode édition
   de « Ma journée ».
4. **Rien ne se répète.** Une activité n'a qu'une `date` unique : une
   séance hebdomadaire doit être rajoutée à la main chaque semaine.
5. **Les récompenses ne mènent nulle part.** Les étoiles repartent à zéro
   chaque jour, le barème de fin de journée n'a jamais été défini, et
   les pièces s'accumulent sans rien débloquer (« Mes récompenses » se
   contente de les montrer).

Plusieurs pistes déjà notées convergent ici : notes libres dans le
planning, mode de transport d'une sortie, minuteur pour une activité,
« on fait… / après on fait… », proposition d'activité par l'enfant le
week-end.

## Pistes écartées

- **Une simple case « à la maison » sur l'activité** : règle le cas de la
  lecture, mais ni la dispersion pour l'enfant ni l'effort des parents.
- **Garder le menu et ajouter un écran « Programme »** pour les
  activités : l'enfant aurait toujours deux endroits à regarder, et pas
  de « après » commun aux routines et aux activités.

## 1. Les natures d'éléments de la journée

| Nature | Exemples | L'enfant… | Au lancement | Récompense | Couleur |
|---|---|---|---|---|---|
| Routine | S'habiller, Aller se coucher | fait une suite de tâches | écran de routine (inchangé) | étoile | bleu |
| **À la maison** (nouveau) | Lecture, temps calme, devoirs | fait une activité sur place | écran d'activité : lieu, consigne, minuteur facultatif | pièce en option | turquoise |
| Sortie | École, piscine, magasin | part et revient | trajet → arrivée → retour (inchangé) | pièce en option | violet |
| Séance | Chez une praticienne | part ; la praticienne prend la tablette | trajet → séance → note (inchangé) | aucune par défaut | violet |
| Repas | Goûter, dîner | rien à faire | aucun (repère) | — | vert |
| **Info** (nouveau) | « Maman vient te chercher » | rien à faire, l'entend | aucun (repère) | — | gris, pointillés |
| **Moment au choix** (nouveau) | Week-end : vélo, Lego ou lecture | choisit parmi 2 ou 3 idées préparées | écran de choix, puis l'activité choisie | celle de l'activité choisie | orange |

Sortie et séance partagent la même couleur : pour l'enfant, violet veut
dire « on part de la maison ».

## 2. Pour l'enfant : la journée en une seule liste

Le menu devient la journée elle-même, construite depuis le planning du
jour (`etat.planning`, déjà la seule source de vérité). Il remplace le
menu actuel, la porte « Partir à l'aventure » et la vue « Ma journée »
côté enfant.

- **Déjà fait** : une rangée de pictogrammes en haut.
- **Maintenant** : en grand, avec pictogramme, nom et bouton « C'est
  parti ▶ » qui ouvre l'écran propre à sa nature.
- **Après** : juste dessous, en moyen.
- **Plus tard** : le reste, en petit.
- L'avatar reste en haut et reflète toujours l'état réel (continuité
  visuelle, cf. `concept.md`).

Règles :

- « Maintenant » est le premier élément **à faire** (routine, à la
  maison, sortie, séance, moment au choix) non terminé, dans l'ordre du
  planning. Les repas et les infos sont des **repères** : affichés à
  leur place, jamais « maintenant », considérés comme passés dès que la
  liste les dépasse.
- **Seul « Maintenant » se lance** (décidé le 25/10) : une chose à la
  fois, comme aujourd'hui. Deux exceptions :
  - un élément débloqué par l'heure (le coucher, `disponibleApresHeure`)
    devient « Maintenant » à son heure, même si des éléments précédents
    ne sont pas faits — ils restent simplement « pas faits », sans
    reproche. Cohérent avec la fin de journée, qui ne dépend que du
    coucher ;
  - un parent peut **sauter** ou **déplacer** une carte depuis le
    planning.
- Le chaînage actuel (`chainee`, verrouillage séquentiel dans
  `construireMenu()`) disparaît : c'est l'ordre du planning, choisi par
  les parents, qui fait la séquence.
- La règle « prêt avant de partir » reste : une sortie ou une séance ne
  démarre que si « Se préparer à partir » est validée ; sinon la voix
  l'explique et cette routine est mise en avant (comportement actuel de
  la voiture, transposé). Dans la liste, la règle devient visible :
  « Se préparer à partir » est placée juste avant la sortie.
- L'heure reste une annotation affichée sur la carte, jamais une logique
  de déblocage (hors `disponibleApresHeure`).
- La fin d'un élément ne change pas (félicitations, validation parent,
  coffre), puis retour à la liste, où « Maintenant » a avancé. Une
  routine déjà faite dans la journée se termine sans coffre : son
  étoile est déjà acquise (cf. section 5).

## 3. Tout s'écoute, partout (exigence du 25/10)

L'enfant ne lit pas : il doit pouvoir, à tout moment, entendre ce qu'il
est en train de faire **et** toute sa journée. Sur **chaque écran
enfant** (liste, routine, activité, trajet, arrivée, moment au choix…),
deux boutons, toujours au même endroit dans le bandeau du haut :

- 🔊 **Maintenant** : redit l'élément en cours et le suivant
  (« Maintenant : Lecture. Après : le dîner. »). Dans une routine, il
  garde son rôle actuel : redire la tâche en cours.
- 🗓️🔊 **Toute ma journée** : lit toute la journée dans l'ordre —
  « C'est fait : … » pour ce qui est passé, puis « Maintenant : … »,
  « Après : … », « Ensuite : … ». **Chaque élément s'allume au moment où
  il est lu** (lecture suivie). Un second appui arrête la lecture (le
  bouton devient ⏹️).

Précisions :

- Sur la liste, ce sont les cartes elles-mêmes qui s'allument. Sur les
  autres écrans, une **bande de pictogrammes** de la journée, toujours
  visible sous le bandeau (l'élément en cours entouré), s'allume
  pictogramme par pictogramme. Jamais d'écran plein qui recouvrirait
  l'activité en cours. Sans le son, cette bande sert aussi de repère
  permanent : « où j'en suis ».
- La lecture ne met pas en pause l'activité en cours : un minuteur
  continue d'avancer.
- Une seule voix à la fois : toute autre annonce (bouton, étape
  suivante) coupe la lecture en cours. C'est déjà le comportement de
  `dire()`, qui annule avant de parler. La lecture de la journée devient
  une file de phrases courtes, une par élément, chacune allumant son
  élément quand elle démarre (`onstart` de l'énoncé).
- Les infos sont lues telles quelles (« Maman vient te chercher »). Les
  heures ne sont pas lues.
- Pas de boutons d'écoute sur l'écran de séance tenu par la
  praticienne, ni dans l'espace parent.

## 4. Pour les parents : une bibliothèque, un planning

**Une règle : la bibliothèque, c'est ce qui existe ; le planning, c'est
quand ça a lieu.**

- **Bibliothèque** (« Activités et routines », « Mon entourage ») : on y
  crée et modifie des définitions, sans date. Toucher une activité
  n'ajoute plus rien à aujourd'hui (fin de l'interrupteur jour par jour
  du catalogue actuel). Une routine créée ici est ajoutée aux 7 jours de
  la semaine type.
- **Planning**, en deux onglets :
  - **Semaine type** : pour chaque jour de la semaine, la liste
    complète (routines et repas compris), avec heure facultative. Elle
    revient chaque semaine sans rien refaire.
  - **Prochains jours** : aujourd'hui et les 7 jours suivants, chacun
    marqué « comme d'habitude » ou « modifié ». Modifier un jour ne
    touche que ce jour-là.
- **Un seul bouton « + Ajouter »**, depuis un jour (de la semaine type
  ou une date précise) : piocher dans la bibliothèque, ou créer en
  choisissant d'abord la nature. Le formulaire ne montre ensuite que les
  champs de cette nature :
  - *À la maison* : nom, icône, lieu (chambre, salon, cuisine), phrase
    dite par l'acolyte, minuteur (aucun, 10, 20 ou 30 min), pièce
    oui/non ;
  - *Sortie* : nom, icône, comment on y va (voiture, vélo, à pied), ce
    qui va se passer (3 étapes), pièce oui/non ;
  - *Séance* : avec qui (entourage), comment on y va ;
  - *Info* : le texte, et qui (entourage, facultatif) ;
  - *Moment au choix* : 2 ou 3 activités de la bibliothèque ;
  - puis **Quand** : heure facultative, « ce jour seulement » ou
    « chaque semaine » (jours à cocher).
- **Espace parent regroupé** en quatre blocs au lieu de neuf options à
  plat : *La journée* (Planning, Relancer une routine), *La
  bibliothèque* (Activités et routines, Mon entourage), *Le suivi*
  (Historique, Notes des séances), *Réglages* (Code parent, Cet
  appareil).
- Le mode édition de « Ma journée » disparaît : on modifie aujourd'hui
  depuis le planning, comme n'importe quel autre jour.

Le moment au choix remplace le flux « l'enfant propose, un parent
valide » prévu pour le week-end et jamais conçu : les parents valident
en amont en choisissant les idées, l'enfant choisit sans attendre
personne.

## 5. Les récompenses : des étoiles aux pièces, des pièces au chemin (ajout du 25/10)

C'est la partie la plus « jeu » de l'app : l'enfant voit concrètement
qu'il avance.

**Une étoile n'est jamais reprise** (décidé le 25/10). Elle veut dire
que la routine a été faite au moins une fois dans la journée. Certaines
routines se refont plusieurs fois (s'habiller, mettre ses chaussures) :
relancer une routine permet de la refaire en entier, sans retirer
l'étoile et sans en donner une nouvelle. C'est un changement par rapport
à `concept.md`, où la relance reprenait l'étoile.

**La jauge d'étoiles** (décidé le 25/10).

- Pendant la journée, chaque routine donne son étoile comme aujourd'hui
  (coffre ouvert par l'enfant). Elle s'affiche en « étoiles
  d'aujourd'hui », à côté de la jauge, sans encore la remplir.
- **Le soir, les étoiles sont mises de côté, sans fête**, pour ne pas
  créer d'excitation avant le coucher : après « Aller se coucher », ni
  coffre ni confettis, seulement « Bonne nuit, tes étoiles t'attendent
  demain matin ». (Lecture de la consigne « pas d'excitation le soir »,
  à confirmer.)
- **Le lendemain, à partir de 8h30** (heure réglable), une carte « Ce
  matin » apparaît en haut de la liste du jour : « Hier, tu as gagné
  ⭐⭐⭐ ». L'enfant appuie sur « Ajouter mes étoiles » et les voit
  remplir la jauge une à une. Elle n'apparaît que sur la liste, jamais
  au milieu d'une activité : si l'enfant est en pleine routine à 8h30,
  la carte l'attend à son retour sur la liste. S'il n'ouvre pas l'app ce
  jour-là, les étoiles s'additionnent et l'attendent.
- **Une jauge = 20 étoiles = 1 pièce** (valeur par défaut, réglable).
  Elle ne se vide jamais d'elle-même : pleine, elle donne une pièce et
  repart à zéro ; une étoile en trop passe dans la jauge suivante. Une
  journée sans étoile ne fait rien perdre.

**Les pièces.** Deux sources : la jauge d'étoiles, et les activités qui
en donnent directement (sorties, et en option une activité à la maison
— `recompensePieces`, inchangé). Une pièce gagnée **attend d'être
posée**.

**Le chemin.** Un vrai chemin, pas une grille : une route qui serpente
du « départ », en bas, jusqu'à la récompense finale, en haut, bordée de
quelques éléments de décor. Le long de la route, des **emplacements
ronds** (20 par défaut, réglable), un par pièce. Certains portent une
**récompense intermédiaire** ; le dernier, plus grand, porte la
**récompense finale**, visible dès le départ pour savoir vers quoi on
avance.

- C'est l'enfant qui **fait glisser chaque pièce à la main** (décidé le
  25/10), depuis le plateau en bas de l'écran jusqu'au prochain
  emplacement, qui brille et bat doucement (sans animation si le système
  demande « mouvement réduit »). Lâchée sur le bon rond, la pièce s'y
  pose, avec un petit son et une courte vibration ; lâchée ailleurs,
  elle revient toute seule sur le plateau et la voix guide (« Presque !
  Pose ta pièce sur le rond qui brille. »). C'est le même geste que dans
  les routines (`rendreGlissable()`). C'est le moment où il voit sa
  progression, plutôt qu'un compteur qui change tout seul.
- **La pièce remplit exactement son rond** (décidé le 25/10) : c'est le
  même objet dessiné partout (sur le plateau, pendant le glisser, une
  fois posée), et non un pictogramme plus petit que l'emplacement. Près
  du bon rond, la pièce glissée prend sa taille exacte et s'y aligne,
  pour montrer qu'elle « rentre » avant même d'être lâchée. Une pièce
  posée sur une récompense garde un petit badge avec le pictogramme de
  la récompense.
- La route est faite de tronçons légèrement bombés reliés par de larges
  virages en épingle : assez ouverts pour que deux ronds ne se touchent
  jamais, avec des emplacements assez grands pour un doigt d'enfant.
- Cet écran ne montre que les pièces : pas de jauge ni de décompte
  d'étoiles (décidé le 25/10), qui restent sur la liste du jour.
- Arriver sur une case récompense déclenche une fête à l'écran, dite à
  voix haute (« Tu as gagné : choisir le dessert ! »). La récompense
  elle-même est donnée dans la vraie vie par un parent.
- Côté parents, elle passe dans **« À donner »**, avec un badge sur
  l'espace parent, jusqu'à ce que l'un des deux coche « Je l'ai
  donnée » : les deux parents savent toujours ce qui est dû.
- Au bout du chemin, les parents en préparent un nouveau (cases et
  récompenses). Les pièces gagnées entre-temps attendent dessus.
- Le chemin s'ouvre depuis la jauge affichée en haut de la liste du jour
  (étoiles vers la prochaine pièce, et nombre de pièces). Il porte les
  deux boutons d'écoute comme tout écran enfant ; 🔊 y dit ce qu'il
  reste : « Encore 1 pièce avant choisir le dessert. »

**Réglages parents** (bloc « Les récompenses » de l'espace parent) :
étoiles par pièce, heure de découverte des étoiles, nombre de cases,
récompenses (case, pictogramme, nom), récompense finale. L'écran montre
aussi l'état de la jauge (dont les étoiles qui attendent le lendemain
matin) et une estimation du rythme pour calibrer sans calcul : « avec
3 routines par jour, les étoiles seules donnent environ une pièce par
semaine ». Au-delà de 10 semaines pour finir le chemin, il suggère de
rapprocher les récompenses intermédiaires ou de réduire le nombre de
cases. Avec 20 étoiles par pièce, un chemin de 20 cases prendrait près
de 20 semaines sans les pièces des sorties : le nombre de cases du
premier chemin reste à régler.

**Ce que ça remplace.** L'écran « Mes récompenses » devient le chemin.
La récompense de fin de journée (confettis, total d'étoiles) et son
barème jamais défini disparaissent : le soir reste calme, la découverte
se fait le matin. Le principe « la pièce se dépense pour une activité
de son choix » (`concept.md`) est remplacé par le chemin.

**Migration.** Les pièces déjà accumulées deviennent des pièces à poser
sur le premier chemin : rien n'est perdu, et la première ouverture du
chemin est déjà un moment de jeu.

**À terme : l'animation « étoiles → pièce ».** Elle a lieu le matin,
dans la carte « Ce matin », au moment où les étoiles de la veille
complètent la jauge :

1. après l'appui sur « Ajouter mes étoiles », les étoiles d'hier filent
   une à une vers la jauge, qui monte à chaque étoile ;
2. à la 20ᵉ, la jauge pleine s'illumine, puis se resserre vers son
   centre ;
3. elle se fond en une pièce, et la voix dit : « Bravo ! Tes étoiles se
   sont transformées en pièce. Tu peux la poser sur ton chemin. » La
   jauge repart de zéro (avec les étoiles en trop), et la pièce part
   vers le chemin, où elle attend d'être posée.

Elle dure quelques secondes, reste dans la carte (pas d'écran
supplémentaire), et respecte le réglage « mouvement réduit » du système
(`prefers-reduced-motion` : simple fondu). En attendant cette
animation, la jauge se remplit sans effet, avec la même phrase.

**Les sons** (demandé le 25/10). Le passage des étoiles à la pièce
s'entend, avec les sons classiques de ce genre de mécanique. Ils
arrivent dès l'étape 4, sans attendre l'animation :

1. chaque étoile qui entre dans la jauge : un « ding » court, une note
   plus haut à chaque étoile — on entend la jauge monter ;
2. la jauge pleine : un scintillement, quatre notes très rapides qui
   montent ;
3. la pièce : le « ting-ting » classique, deux notes aiguës dont la
   seconde résonne ;
4. puis seulement la voix (« Bravo ! … ») : jamais un son et la voix en
   même temps.

Ils sont synthétisés comme le carillon de validation actuel
(`jouerSon()`, Web Audio) : aucun fichier, hors-ligne. Le son de la
pièce reste nettement distinct des deux sons existants, le carillon
« bravo » (deux notes en sinusoïde) et l'alerte du minuteur (timbre
carré, grave), en se plaçant plus haut et plus brillant. Volume modéré
et attaques adoucies, l'enfant étant sensible aux stimulations. Un
réglage parent « Sons de la jauge et des pièces » propose *doux* (par
défaut), *arcade* (timbre carré, plus « jeu vidéo ») ou *coupés* ; il
rejoint le calibrage sensoriel par enfant déjà noté. Aucun son le soir :
tout se passe le matin. Sur le chemin, la même famille de sons : une
pièce qui se pose sur son rond fait un petit « clic » (deux notes très
brèves, plus aiguës que le son de la pièce) ; une récompense atteinte
déclenche une courte fanfare (trois notes qui montent, puis une note
tenue), un peu plus ample pour la récompense finale ; la voix vient
après.

**La pièce Acolyte** (décidé le 25/10). Un dessin original, et non une
reprise de la pièce d'un jeu existant : l'app est publique et
partageable. C'est une pièce en pixel art (16 × 16, comme l'avatar), or
épais et contour foncé, avec un « A » d'Acolyte gravé en relief. Elle a
une vraie épaisseur : une tranche cannelée, pixellisée comme la face
(une bande de couleur par pixel d'épaisseur, 3 pixels par défaut), et
un dos. On la voit inclinée au repos, et elle tourne sur elle-même à la
sortie du coffre (rotation coupée si le système demande « mouvement
réduit »). Elle remplace l'emoji 🪙 partout dans l'app : liste du jour,
chemin, plateau, coffre, écran des récompenses.

## 6. Modèle de données (esquisse)

- **Activité** (aujourd'hui `aventure`) : nouveau champ
  `nature: "maison" | "sortie"`. Absent = `"sortie"`, donc rien à migrer
  pour l'existant. Une séance reste une sortie avec `personne`
  (invariant actuel inchangé).
  - `maison` : `lieu` (`"chambre" | "salon" | "cuisine"`), `consigne`,
    `minuteurMinutes` (facultatif), `recompensePieces`. Ni
    `texteTrajet` ni `programme`.
  - `sortie` : gagne `modeTransport` (`"voiture" | "velo" | "pied"`),
    qui pilote le texte de trajet suggéré et la scène. Tant qu'il n'y a
    pas de décor dédié, la scène voiture est masquée hors voiture.
- **Item de planning** : deux types en plus de
  `routine`/`aventure`/`repas` :
  - `{ type: "note", texte, entourageIds?, heure? }`, saisi dans le
    planning, pas dans la bibliothèque ;
  - `{ type: "choix", options: [idActivite…], choisi?, heure? }`, où
    `choisi` est rempli par le choix de l'enfant, pour la journée ;
  - et `passe: true` sur n'importe quel item quand un parent le saute.
- **Semaine type** : nouvelle clé par profil,
  `cle("semaine_type")` = `{ "1": [items…], …, "7": [items…] }`
  (lundi = 1). `planningParDefaut(dateKey)` sème la journée depuis le
  jour de la semaine correspondant, au lieu de `PLANNING_DEFAUT`. À la
  première ouverture, la semaine type est initialisée avec le planning
  par défaut actuel (+ routines perso) sur les 7 jours : rien ne change
  pour l'enfant tant qu'un parent ne la modifie pas.
- **Prochains jours** : `planning_futur` est inchangé (il porte déjà les
  jours modifiés). Un jour sans entrée = « comme d'habitude ».
- **Migration du champ `date`** : chaque activité datée est recopiée
  dans `planning_futur` à sa date (si elle n'est pas passée), puis le
  champ n'est plus lu.
- **Routines répétées** : une même routine peut revenir plusieurs fois
  dans la journée (relancée par un parent, ou placée deux fois dans le
  planning, par exemple « Se préparer à partir » avant chaque sortie).
  L'avancement de la liste se note donc par item de planning
  (`fait: true`), et plus seulement par routine ; chaque passage
  repart de tâches non cochées. L'étoile reste une par routine et par
  jour : `etat.routines[id].etoileDonnee`, jamais remis à `false` dans
  la journée (la relance ne la retire plus).
- **Jauge** : `cle("jauge_etoiles")` =
  `{ dansLaJauge, aDecouvrir }`, jamais remis à zéro au changement de
  jour. Les étoiles du jour passent dans `aDecouvrir` à la validation
  du coucher (ou au changement de jour s'il n'a pas eu lieu). La carte
  « Ce matin » les verse dans `dansLaJauge` à partir de
  `heureDecouverte` (`"08:30"` par défaut) ; chaque fois que
  `dansLaJauge` atteint `etoilesParPiece` (20 par défaut), il retombe au
  reste et ajoute une pièce à poser. L'étoile reste aussi comptée dans
  `etat.etoiles`, pour l'historique du jour.
- **Pièces à poser** : `cle("pieces_a_poser")`. Une pièce gagnée
  (jauge ou activité) l'incrémente, ainsi que le total `pieces`
  existant ; poser une pièce la décrémente. Migration :
  `pieces_a_poser` = `pieces` actuel.
- **Chemin** : `cle("chemin")` =
  `{ cases, etoilesParPiece, heureDecouverte, sons, recompenses: [{ case, emoji, nom }], posees, atteintes: [{ case, gagneeLe, donneeLe? }] }`,
  avec `sons` = `"doux" | "arcade" | "coupes"`.
  La récompense finale est celle de la dernière case. Un chemin terminé
  est archivé dans l'historique avant d'en préparer un nouveau.
- Baisser `etoilesParPiece` sous le nombre d'étoiles déjà dans la jauge
  donne la pièce tout de suite, sans perdre d'étoile.

## 7. Ce qui ne change pas

Une étoile par routine faite dans la journée ; des pièces pour les
sorties ; correction et validation par un parent ; coffre (sauf le soir,
cf. section 5) ; coucher débloqué à
l'heure et fin de journée sur le coucher ; déroulé d'une séance chez une
praticienne et ses notes ; reprise de l'activité en cours à la
réouverture ; tout reste sur la tablette, hors-ligne.

## 8. Découpage

Quatre étapes livrables séparément, chacune utilisable seule :

1. **Côté parents** : semaine type et prochains jours, bibliothèque sans
   interrupteur, « + Ajouter » unique (sortie et séance seulement à ce
   stade), espace parent regroupé, migration des `date`. Aucun
   changement visible pour l'enfant.
2. **Côté enfant** : la liste du jour à la place du menu, de la voiture
   et de « Ma journée » ; les deux boutons d'écoute et la bande de
   pictogrammes sur tous les écrans enfant ; la nature « à la maison »
   et son écran.
3. **Compléments** : infos, moments au choix, mode de transport.
4. **Récompenses** : jauge d'étoiles et sa découverte du matin, avec
   ses sons ; pièces à poser, chemin, réglages et « À donner » côté
   parents, migration des pièces. Indépendante des étapes 1 à 3 : elle
   peut aussi passer avant. L'animation « étoiles → pièce » vient
   ensuite.

## 9. Vérification

L'app n'a pas de tests automatisés : chaque étape se vérifie dans le
navigateur (serveur de dev sur un port neuf, pour éviter le cache), puis
en usage réel.

- Planning : une semaine type modifiée se retrouve bien le jour
  correspondant suivant ; modifier un jour ne touche pas la semaine
  type ; une activité datée existante réapparaît à sa date après
  migration.
- Liste : « Maintenant » avance après chaque validation ; les repères
  passent ; le coucher devient « Maintenant » à son heure même si rien
  n'est fait ; une carte sautée par un parent n'est jamais
  « Maintenant ».
- Une sortie lancée sans « Se préparer à partir » validée : explication
  vocale, pas de départ.
- Écoute : les deux boutons sont présents sur chaque écran enfant,
  absents en séance et côté parent ; la lecture complète allume chaque
  élément dans l'ordre, s'arrête au second appui ou à toute autre
  annonce, et ne met pas en pause un minuteur.
- Reprise après fermeture de l'app : retour sur l'élément en cours.
- Étoiles : relancer une routine ne retire pas son étoile ; la refaire
  (ou la faire une deuxième fois dans la journée) n'en donne pas une
  nouvelle.
- Jauge : le soir, aucune fête après le coucher ; le lendemain, rien
  avant 8h30 ; à partir de 8h30, la carte « Ce matin » apparaît sur la
  liste, jamais pendant une activité ; des étoiles non découvertes
  s'additionnent si l'app n'est pas ouverte ; à 20, une pièce, et
  l'étoile en trop reste dans la jauge.
- Sons : un « ding » par étoile, de plus en plus haut ; le scintillement
  à la 20ᵉ ; le son de la pièce, distinct du carillon « bravo » et de
  l'alerte du minuteur ; la voix ne commence qu'après ; « coupés »
  n'émet rien ; aucun son le soir.
- Chemin : une pièce glissée sur le rond qui brille s'y pose (son,
  vibration) ; lâchée ailleurs, elle revient sur le plateau ; le geste
  marche au doigt sur la tablette ; une récompense atteinte déclenche la
  fanfare et la fête, puis apparaît « à donner » chez les parents, et
  « Je l'ai donnée » la retire ; les pièces existantes sont à poser au
  premier chemin ; aucun décompte d'étoiles sur cet écran.

## Plus tard (hors périmètre)

- « Se préparer à partir » proposé automatiquement juste avant chaque
  sortie.
- Une période « vacances » qui retire l'école sur plusieurs jours d'un
  coup.
- Dépenser ses pièces pour obtenir un moment au choix.
- Lire la journée par moments (« ce matin… cet après-midi… ce
  soir… »).
- L'animation « étoiles → pièce », décrite en section 5.
- L'enfant choisit sa récompense finale parmi 2 ou 3 idées proposées
  par les parents, au début d'un nouveau chemin.
