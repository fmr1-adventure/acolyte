# Acolyte — Fonctionnalités

*Document vivant, tenu à jour au fil des sessions de développement à
chaque fonctionnalité livrée. Objectif : donner une vue d'ensemble claire
de ce que fait l'application, utilisable pour en parler (famille,
professionnels, futurs collaborateurs...) sans avoir à lire le code. Pour
le détail technique, voir [`app/README.md`](../../app/README.md) ; pour
les pistes à venir, voir la section « Prochaines pistes » du
[`README`](../../README.md) à la racine.*

## En une phrase

Acolyte est une application pour tablette qui aide un enfant à accomplir
ses routines du quotidien — se réveiller, s'habiller, se préparer, se
coucher... — en autonomie, sous la forme d'un petit jeu doux en pixel
art, sans avoir besoin de savoir lire.

## Pour qui, et pourquoi

Conçue au départ pour deux enfants TSA et TDAH, mais pas réservée à eux :
n'importe quelle famille peut configurer l'app pour son ou ses propres
enfants (cf. "Première configuration" ci-dessous). Chaque enfant a son
propre appareil (ce n'est pas un sélecteur de profil dans une même app
partagée) ; s'il y en a plusieurs, tous affichent la même application,
chacun avec son prénom, son avatar et ses routines. Trois contraintes
façonnent chaque écran :

- **Pas besoin de savoir lire** — tout est jouable à l'oreille (voix
  automatique à chaque étape, rejouable) et à l'image (pictogrammes,
  sprites, couleurs), jamais au texte seul.
- **L'enfant garde la main** — aucune étape n'est minutée par défaut
  (un minuteur ne s'affiche que si un parent l'a choisi, et l'enfant
  peut toujours demander de l'aide), aucune navigation n'est imposée de
  force ; quand quelque chose est verrouillé, l'app l'explique calmement
  plutôt que de bloquer sans raison.
- **Sur la tablette familiale, hors-ligne** — installée comme une
  vraie application (icône sur l'écran d'accueil), elle continue de
  fonctionner sans connexion internet une fois ouverte une première
  fois.

## Première configuration

Aucun prénom, avatar ou contenu de famille n'est intégré à l'application
: tout se configure directement dedans, sans jamais toucher au code. Au
tout premier lancement sur un appareil (ou en ajoutant un enfant
supplémentaire depuis l'espace parent), l'acolyte se présente d'abord à
l'enfant lui-même, en trois messages courts (dits à voix haute, chacun
rejouable) qu'il valide un par un d'un tap — « Bienvenue, je suis ton
acolyte... », « Mon rôle est de t'accompagner... », « J'ai besoin de
quelques informations sur toi » — avant qu'un court parcours ne demande le
prénom de l'enfant, sa date de naissance (jour, mois, année, sur trois
roulettes à faire défiler plutôt qu'à taper), si c'est un garçon ou une
fille, puis son avatar — coupe de cheveux, couleur de peau, de cheveux et
d'yeux, chacun avec un aperçu qui se met à jour au fur et à mesure des
choix — et enfin un code parent à définir (deux fois, comme un nouveau
mot de passe) — trois
routines de départ (s'habiller, se préparer à partir, aller se coucher)
sont aussitôt disponibles, avec un texte déjà personnalisé au prénom
choisi, et librement modifiables ensuite depuis l'espace parent. Rien
n'est envoyé où que ce soit : tout reste sur l'appareil.

## Le parcours d'une journée

### Le réveil

Le tout premier jour d'un enfant sur l'application, ce rituel est sauté
: l'acolyte vient déjà de se présenter pendant l'accueil (cf. « Première
configuration » ci-dessus), et on arrive directement à la liste de la
journée. Les jours suivants, avant l'heure du réveil, l'application
reste « endormie » : l'écran
montre l'avatar de l'enfant allongé de tout son long, yeux fermés, sous
sa couette — un fond sombre et volontairement sans décor, pour ne pas
être lumineux à cette heure — un bypass réservé aux parents permet de
l'ouvrir en cas de besoin exceptionnel. Une fois l'heure passée, un
simple tap sur cet écran
lance un petit rituel avant d'arriver dans sa chambre : « Bonjour
[prénom] » (réponse « Bonjour toi »), « As-tu bien dormi ? » (oui/non),
puis « Comment te sens-tu ? » avec un choix d'images (malade,
fatigué, en pleine forme, normal, triste, content). Le jour de son
anniversaire (calculé depuis sa date de naissance), ce premier message
devient « Bonjour [prénom] ! Joyeux anniversaire, tu as maintenant
[âge] ans ! » avec une icône de gâteau — le reste du rituel ne change
pas.

### La journée en une seule liste

L'écran principal de l'enfant **est sa journée**, dans l'ordre choisi
par les parents : routines, activités à la maison, sorties, séances et
repas, chacun avec sa couleur. En haut, une rangée de pictogrammes
rappelle ce qui est **déjà fait** ; en dessous, en grand, ce qu'on fait
**maintenant**, avec un gros bouton « C'est parti ▶ » ; puis ce qui vient
**après**, en moyen, et le reste **plus tard**, en petit. Seul
« maintenant » se lance : une chose à la fois. Toucher une autre carte
dit simplement son nom. Les repas sont des repères : ils s'affichent à
leur place mais ne se « font » pas.

Quand une routine ou une activité est terminée, la liste avance toute
seule. Le coucher devient « maintenant » à son heure, même si tout n'a
pas été fait (sans reproche) ; avant, il attend, verrouillé (« Pas
encore l'heure »). Une sortie ne part que si l'enfant est prêt : si
« Se préparer à partir » (placée avant elle) n'est pas faite, la voix le
rappelle et la carte clignote.

L'avatar de l'enfant, habillé progressivement au fil de ses tâches, et
une jauge d'étoiles restent en haut de l'écran.

### Tout s'écoute

L'enfant ne lit pas : sur chaque écran (la liste, une routine, une
activité, le trajet, l'arrivée, les récompenses), deux boutons, toujours
au même endroit en haut :

- **🔊** redit ce qu'on fait maintenant et ce qui vient après
  (« Maintenant : Lecture. Après : le dîner. ») — dans une routine, il
  redit la tâche en cours ;
- **🗓️🔊** lit toute la journée dans l'ordre (« C'est fait : … »,
  « Maintenant : … », « Après : … », « Ensuite : … »), et chaque élément
  **s'allume au moment où il est lu**. Un second appui arrête la
  lecture ; toute autre annonce aussi.

Sur les écrans d'activité, une bande de pictogrammes de la journée reste
visible sous le bandeau, l'élément en cours entouré : un repère
permanent de « où j'en suis ». Rien de tout ça sur l'écran de séance,
tenu par la praticienne, ni côté parents.

### Les activités à la maison

Lecture, temps calme, devoirs : une activité **à la maison** n'a pas de
trajet. Son écran montre son pictogramme, l'endroit (chambre, salon,
cuisine) et dit la phrase choisie par les parents (« On lit un livre,
bien installé dans le salon »). Un minuteur facultatif (10, 20 ou
30 minutes) se vide pendant l'activité, même quand on écoute la
journée ; à la fin, un carillon et « C'est l'heure ! Tu as fini ? ».
« J'ai fini » mène aux félicitations puis à un parent, qui valide avec
son code — avec une pièce dans un coffre si l'activité en donne une.

### Les infos et les moments au choix

Une **info** (« Maman vient te chercher ») se glisse dans la journée
comme un repère, en gris et en pointillés : rien à faire, elle se lit
telle quelle quand on écoute la journée. Un **moment au choix** (le
week-end : vélo, Lego ou lecture) propose 2 ou 3 idées préparées par les
parents : quand c'est son tour, l'enfant les entend, en touche une, puis
« C'est parti » lance l'activité choisie — sans attendre personne.

### Les routines

Chaque routine (s'habiller, se préparer à partir, aller se coucher...)
est une suite de petites tâches à accomplir une par une, en glissant
une icône vers l'enfant — jamais plusieurs choses à la fois. Si plusieurs
enfants utilisent l'app, ils ont les mêmes routines de départ, dans le
même ordre — mais pas forcément les mêmes tâches à l'intérieur : selon
l'avatar choisi à la configuration, un enfant met une culotte, un haut et
une robe là où un autre met un caleçon, un t-shirt et un pantalon,
chacun avec l'avatar qui lui correspond. Une tâche sans geste à faire
sur l'avatar (ex. « Fais tes devoirs ») se valide simplement avec un
bouton « J'ai fini ». Deux tâches ont un traitement particulier :

- **Le brossage des dents** est un mini-jeu avec un minuteur qui
  avance tout seul, sans rien à taper pendant le geste — les mains
  restent libres pour la vraie brosse à dents.
- **L'histoire du soir** ouvre un écran dédié (image + texte), et
  c'est le parent, présent pour la lecture, qui valide la fin de
  l'étape — pas l'enfant.

La routine du coucher se débloque à une heure fixe, indépendamment des
autres routines : un enfant qui n'a rien fait d'autre de la journée
peut toujours aller se coucher normalement.

Si l'application est quittée en pleine activité (tablette mise en
veille, app fermée), elle **reprend là où on en était** à la
réouverture — même routine, même étape de sortie, même minuteur d'une
activité à la maison — plutôt que de revenir à la liste.

### Le minuteur visuel

Un parent peut ajouter un minuteur à une tâche (ex. 10 minutes pour
les devoirs) ou à une routine entière. Il s'affiche directement sur
l'écran de la routine, à côté de la consigne, sans empêcher de faire
glisser les icônes — au choix sous forme de jauge qui se vide ou de
cadran qui rétrécit, pour voir le temps passer plutôt que lire des
chiffres. Un bouton 🆘 « Besoin d'aide » reste toujours visible.

Si le temps est écoulé et que la tâche n'est pas finie, l'app demande
d'abord « As-tu besoin d'aide ? ». Si l'enfant répond non, un
deuxième temps plus court lui est laissé ; s'il est à nouveau écoulé
(ou si l'enfant a demandé de l'aide), l'écran attend un parent, qui
débloque avec son code — et le minuteur repart pour une nouvelle
chance. Ces alertes peuvent être désactivées : le minuteur devient
alors un simple repère visuel qui s'arrête à zéro.

### La validation par un parent

Une routine terminée déclenche des félicitations, puis un appel à un
parent : code à 4 chiffres, écran de relecture où chaque tâche peut
être décochée si besoin, puis validation — qui déverrouille le coffre
de la routine plutôt que de donner l'étoile directement. Le coffre
apparaît fermé (badge « FERMÉ »), toujours sous la forme d'un coffre :
c'est l'enfant qui appuie dessus pour l'ouvrir, et c'est ce geste-là qui
fait sortir l'étoile elle-même (pas un cadeau générique) et remplit la
jauge du jour.

Une étoile n'est jamais reprise : une routine qui se refait dans la
journée (se rhabiller, remettre ses chaussures) se valide de la même
façon, mais sans coffre — son étoile est déjà acquise.

### Les récompenses : des étoiles aux pièces, des pièces au chemin

**Une étoile n'est jamais reprise.** Chaque routine faite dans la journée
donne son étoile (une fois par jour, même si la routine se refait),
comptée en « étoiles d'aujourd'hui » en haut de la liste.

**Le soir, pas de fête.** Après « Aller se coucher », ni coffre ni
confettis : « Bonne nuit, tes étoiles t'attendent demain matin. » Les
étoiles du jour sont mises de côté.

**Le matin, la jauge se remplit.** À partir de 8 h 30 (heure réglable),
une carte « Ce matin » apparaît en haut de la liste (jamais au milieu
d'une activité) : l'enfant appuie sur « Ajouter mes étoiles » et les
voit entrer une à une dans la jauge, avec un petit « ding » de plus en
plus aigu. À 20 étoiles (réglable), la jauge pleine scintille et devient
une **pièce** (« ting-ting », puis la voix) ; les étoiles en trop
repartent dans la jauge. S'il n'ouvre pas l'app un jour, les étoiles
s'additionnent et l'attendent.

**La pièce Acolyte** est un dessin original en pixel art : une pièce
d'or épaisse avec le « A » d'Acolyte gravé, qui tourne sur elle-même en
sortant du coffre. Les sorties (et, en option, les activités à la
maison) en donnent aussi directement.

**Le chemin.** Les pièces gagnées attendent d'être posées sur « Mon
chemin » (ouvert depuis la jauge) : une route qui serpente du départ
jusqu'à la récompense finale, bordée de quelques arbres, avec un rond par
pièce. L'enfant fait glisser chaque pièce **à la main** jusqu'au rond qui
brille : elle s'y pose avec un petit clic et une vibration ; lâchée
ailleurs, elle revient toute seule. Certaines cases portent une
récompense (choisir le dessert, un tour au parc…) : y arriver déclenche
une petite fanfare et une fête, dite à voix haute. La récompense est
ensuite donnée dans la vraie vie par un parent.

### Les sorties

Une sortie programmée (ex. le magasin de bricolage, une séance chez une
praticienne, l'école) se fait en voiture, à vélo ou à pied — le texte
du trajet et la scène suivent — et se joue en deux temps : le trajet (avec sa propre
petite scène) puis l'arrivée, avant de rentrer à la maison — chaque
étape confirmée par un parent. Une sortie peut rapporter des pièces,
une monnaie à part des étoiles, qui ne repart jamais à zéro d'un jour
sur l'autre. Comme pour les routines, la pièce sort d'un coffre :
le parent le déverrouille en confirmant le retour, et c'est l'enfant
qui l'ouvre.

Quand deux sorties se suivent directement dans le planning du jour (ex.
deux visites chez une praticienne à la suite, sans repas ni routine
entre les deux), le trajet qui suit la première ne raconte pas un retour
à la maison qui n'a pas lieu : il annonce directement la sortie suivante.

Certaines sorties peuvent être propres à un enfant (une praticienne qu'il
est seul à voir), d'autres communes à plusieurs — comme l'école.

Une séance chez une praticienne suit un déroulé à part, une fois sur
place : c'est elle, avec le code, qui démarre la séance et garde
l'appareil pendant qu'elle a lieu ; l'enfant n'a plus la main à partir
de ce moment-là. À la fin, toujours avec le code, elle note comment ça
s'est passé (une note en étoiles obligatoire, une appréciation écrite
optionnelle) avant que le trajet retour ne commence. Cette note est
réservée aux parents — jamais visible dans un écran accessible à
l'enfant — et se retrouve dans un écran dédié de l'espace parent,
« Notes des séances », en plus de l'historique du jour où elle a eu
lieu.

### Préparer une journée (côté parents)

Depuis l'espace parent, chaque journée (aujourd'hui, un jour à venir ou
un jour de la semaine type) s'ouvre dans le même éditeur : les routines,
activités et repas dans l'ordre, avec une couleur propre à chaque nature
— réorganiser, ajouter, retirer. Pour aujourd'hui, ce qui est déjà fait
est coché, et un parent peut **sauter** un élément (une sortie annulée)
sans le retirer : il disparaît de la liste de l'enfant et se reprend d'un
appui. Un parent peut aussi régler une heure pour un ou plusieurs
moments : c'est une simple annotation, affichée sur la carte de l'enfant,
jamais lue à voix haute et jamais un verrou. Pour ajouter
plusieurs éléments d'un coup, un parent peut aussi taper (ou dicter, au
micro) une phrase comme « vélo 15h, goûter chez mamie 17h » : l'app
reconnaît les heures et propose les activités correspondantes, à
confirmer une par une.

## L'espace parent

Protégé par un code, accessible en permanence depuis un bouton
discret, directement connecté à ce que voit l'enfant (rien à
synchroniser séparément). Il est rangé en cinq blocs : **la journée**
(le planning, relancer une routine), **la bibliothèque** (activités,
routines, entourage), **le suivi** (historique, notes des séances),
**les récompenses** (le chemin) et **les réglages** (code parent, cet
appareil).

- **Préparer le planning**, en deux onglets :
  - **Semaine type** — un modèle pour chaque jour de la semaine (le
    lundi, le mardi...) : on y met une fois pour toutes ce qui revient
    chaque semaine (l'école, une séance chez une praticienne...). Chaque
    journée de l'enfant se prépare toute seule à partir de son jour de
    la semaine type.
  - **Prochains jours** — aujourd'hui et les 7 jours suivants, pour les
    exceptions : un jour qu'on modifie (une sortie en plus, un rendez-vous
    déplacé) devient « Modifié » et ne bouge plus ensuite, même si la
    semaine type change ; les autres restent « Comme d'habitude ».

  Depuis n'importe quel jour en cours de préparation, on peut créer
  directement une **nouvelle sortie**, une **activité à la maison** ou une
  **nouvelle séance** (on choisit alors avec qui, dans « Mon
  entourage ») : elle est ajoutée au jour qu'on prépare, sans passer par
  la bibliothèque. On y ajoute aussi une **info** ou un **moment au
  choix**.
- **Relancer une routine** si la situation a changé (ex. l'enfant
  s'est redéshabillé après coup) : les tâches décochées sont à refaire
  et la routine redevient « maintenant » dans la liste — l'étoile
  gagnée, elle, reste acquise.
- **Historique des journées** — chaque jour archivé avec ses étoiles,
  ses routines faites, et désormais **les réponses du réveil**
  (sommeil, humeur).
- **Notes des séances** — toutes les notes laissées par les
  praticiennes, les plus récentes d'abord, sans avoir à les chercher
  jour par jour dans l'historique.
- **Changer le code parent.**
- **Créer et modifier des activités et des routines sur mesure**, sans
  toucher au code — y compris les routines de départ (S'habiller...),
  pas seulement celles créées après coup. Pour chaque tâche : une icône
  à glisser vers l'avatar ou un simple bouton « J'ai fini », et un
  minuteur optionnel. L'icône se choisit dans un
  large choix d'emoji qu'on retrouve en tapant un mot (« vélo », « chat »,
  « pizza »...), plutôt que dans une petite liste figée.
- **Mon entourage** — un petit carnet des personnes autour de l'enfant,
  vide au départ, à remplir au fil des besoins (famille proche,
  praticiennes...) avec un nom, une icône et un rôle. Sert à associer en
  option des personnes à une activité ou une routine sur mesure et à voir
  « avec qui » directement sur « Ma journée ».
- **Chemin et récompenses** — ce qui est **à donner** (une récompense
  atteinte sur le chemin attend qu'un parent coche « Je l'ai donnée » ; un
  petit point sur ⚙️ le rappelle), les réglages (étoiles par pièce, nombre
  de cases, heure de découverte des étoiles, sons doux, arcade ou coupés),
  l'état de la jauge, une estimation du rythme (« environ une pièce tous
  les 7 jours… ») et les récompenses elles-mêmes (case, pictogramme, nom).
  Au bout du chemin, on en prépare un nouveau ; les pièces ne sont jamais
  perdues.
- **Cet appareil** — indique quel profil cet appareil affiche, pour le
  configurer une bonne fois pour toutes, ou pour ajouter un enfant
  supplémentaire (« + Nouvel enfant », cf. "Première configuration"
  ci-dessus).

## En bref, côté technique

Installée une fois sur la tablette, l'application continue de
fonctionner **sans connexion internet**. Pas de compte à créer, pas de
donnée envoyée à un serveur : tout reste sur la tablette.

## Et ensuite

Toujours en développement actif. Pistes : des réglages sensoriels
propres à chaque enfant (contraste, mouvement, débit de la voix), de
vrais décors de pièces, des notes libres dans le planning, le mode de
transport avec de vrais décors (vélo, à pied), une animation plus riche
des étoiles qui deviennent une pièce, et une période « vacances » qui
retire l'école sur plusieurs jours d'un coup.
