# Acolyte — Fonctionnalités

*Document vivant, tenu à jour au fil des sessions de développement à
chaque fonctionnalité livrée. Objectif : donner une vue d'ensemble claire
de ce que fait l'application, utilisable pour en parler (famille,
professionnels, futurs collaborateurs...) sans avoir à lire le code. Pour
le détail technique, voir [`app/README.md`](../../app/README.md) ; pour
l'avancement au jour le jour (chantiers en cours, pas encore fait), voir
[`TODO.md`](../../TODO.md) à la racine.*

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
- **L'enfant garde la main** — aucune étape n'est minutée de façon
  anxiogène, aucune navigation n'est imposée de force ; quand quelque
  chose est verrouillé, l'app l'explique calmement plutôt que de
  bloquer sans raison.
- **Sur la tablette familiale, hors-ligne** — installée comme une
  vraie application (icône sur l'écran d'accueil), elle continue de
  fonctionner sans connexion internet une fois ouverte une première
  fois.

## Première configuration

Aucun prénom, avatar ou contenu de famille n'est intégré à l'application
: tout se configure directement dedans, sans jamais toucher au code. Au
tout premier lancement sur un appareil (ou en ajoutant un enfant
supplémentaire depuis l'espace parent), un court parcours demande le
prénom de l'enfant, si c'est un garçon ou une fille, puis son avatar —
coupe de cheveux, couleur de peau, de cheveux et d'yeux, chacun avec un
aperçu qui se met à jour au fur et à mesure des choix — et enfin un code
parent à définir (deux fois, comme un nouveau mot de passe) — trois
routines de départ (s'habiller, se préparer à partir, aller se coucher)
sont aussitôt disponibles, avec un texte déjà personnalisé au prénom
choisi, et librement modifiables ensuite depuis l'espace parent. Rien
n'est envoyé où que ce soit : tout reste sur l'appareil.

## Le parcours d'une journée

### Le réveil

Avant l'heure du réveil, l'application reste « endormie » : l'écran
montre l'avatar de l'enfant allongé de tout son long, yeux fermés, sous
sa couette — un fond sombre et volontairement sans décor, pour ne pas
être lumineux à cette heure — un bypass réservé aux parents permet de
l'ouvrir en cas de besoin exceptionnel. Une fois l'heure passée, un
simple tap sur cet écran
lance un petit rituel avant d'arriver dans sa chambre : « Bonjour
[prénom] » (réponse « Bonjour toi »), « As-tu bien dormi ? » (oui/non),
puis « Comment te sens-tu ? » avec un choix d'images (malade,
fatigué, en pleine forme, normal, triste, content).

### Le menu de la journée

Un menu affiche les routines du jour, la première seule accessible :
les suivantes se débloquent au fur et à mesure, dans l'ordre. Un
avatar de l'enfant, habillé progressivement au fil de ses tâches, et
une jauge d'étoiles donnent une vue d'ensemble en un coup d'œil.

### Les routines

Chaque routine (s'habiller, se préparer à partir, aller se coucher...)
est une suite de petites tâches à accomplir une par une, en glissant
une icône vers l'enfant — jamais plusieurs choses à la fois. Si plusieurs
enfants utilisent l'app, ils ont les mêmes routines de départ, dans le
même ordre — mais pas forcément les mêmes tâches à l'intérieur : selon
l'avatar choisi à la configuration, un enfant met une culotte, un haut et
une robe là où un autre met un caleçon, un t-shirt et un pantalon,
chacun avec l'avatar qui lui correspond. Deux tâches ont un
traitement particulier :

- **Le brossage des dents** est un mini-jeu avec un minuteur qui
  avance tout seul, sans rien à taper pendant le geste — les mains
  restent libres pour la vraie brosse à dents.
- **L'histoire du soir** ouvre un écran dédié (image + texte), et
  c'est le parent, présent pour la lecture, qui valide la fin de
  l'étape — pas l'enfant.

La routine du coucher se débloque à une heure fixe, indépendamment des
autres routines : un enfant qui n'a rien fait d'autre de la journée
peut toujours aller se coucher normalement.

### La validation par un parent

Une routine terminée déclenche des félicitations, puis un appel à un
parent : code à 4 chiffres, écran de relecture où chaque tâche peut
être décochée si besoin, puis validation — qui déverrouille le coffre
de la routine plutôt que de donner l'étoile directement. Le coffre
apparaît fermé (badge « FERMÉ »), toujours sous la forme d'un coffre :
c'est l'enfant qui appuie dessus pour l'ouvrir, et c'est ce geste-là qui
fait sortir l'étoile elle-même (pas un cadeau générique) et remplit la
jauge du jour.

### Les récompenses

Une fois toutes les routines validées, une récompense de fin de
journée s'ouvre automatiquement (confettis, total d'étoiles). Un écran
« Mes récompenses » présente les étoiles du jour et les pièces gagnées
comme de vrais objets à collectionner.

### Les sorties (« Partir à l'aventure »)

Une sortie programmée (ex. le magasin de bricolage, une séance chez une
praticienne, l'école) se joue en deux temps : le trajet (avec sa propre
petite scène) puis l'arrivée, avant de rentrer à la maison — chaque
étape confirmée par un parent. Une sortie peut rapporter des pièces,
une monnaie à part des étoiles, qui ne repart jamais à zéro d'un jour
sur l'autre.

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

### « Ma journée »

Un planning affiche, dans l'ordre chronologique, les routines, sorties
et repas du jour — modifiable par un parent (réorganiser, ajouter,
retirer), avec une couleur propre à chaque nature d'activité pour s'y
repérer d'un coup d'œil. Un parent peut y régler une heure pour un ou
plusieurs moments de la journée : un repère « maintenant » se déplace
alors tout seul au fil de l'horloge, pour voir en un instant où on en est
— sans jamais changer ce qui est réellement débloqué pour l'enfant, qui
continue de dépendre uniquement des routines terminées. Pour ajouter
plusieurs éléments d'un coup, un parent peut aussi taper (ou dicter, au
micro) une phrase comme « vélo 15h, goûter chez mamie 17h » : l'app
reconnaît les heures et propose les activités correspondantes, à
confirmer une par une.

## L'espace parent

Protégé par un code, accessible en permanence depuis un bouton
discret, directement connecté à ce que voit l'enfant (rien à
synchroniser séparément) :

- **Relancer une routine** si la situation a changé (ex. l'enfant
  s'est redéshabillé après coup).
- **Historique des journées** — chaque jour archivé avec ses étoiles,
  ses routines faites, et désormais **les réponses du réveil**
  (sommeil, humeur).
- **Notes des séances** — toutes les notes laissées par les
  praticiennes, les plus récentes d'abord, sans avoir à les chercher
  jour par jour dans l'historique.
- **Changer le code parent.**
- **Modifier le planning du jour.**
- **Créer et modifier des activités et des routines sur mesure**, sans
  toucher au code — y compris les routines de départ (S'habiller...),
  pas seulement celles créées après coup. L'icône se choisit dans un
  large choix d'emoji qu'on retrouve en tapant un mot (« vélo », « chat »,
  « pizza »...), plutôt que dans une petite liste figée.
- **Mon entourage** — un petit carnet des personnes autour de l'enfant,
  vide au départ, à remplir au fil des besoins (famille proche,
  praticiennes...) avec un nom, une icône et un rôle. Sert à associer en
  option des personnes à une activité ou une routine sur mesure et à voir
  « avec qui » directement sur « Ma journée ».
- **Cet appareil** — indique quel profil cet appareil affiche, pour le
  configurer une bonne fois pour toutes, ou pour ajouter un enfant
  supplémentaire (« + Nouvel enfant », cf. "Première configuration"
  ci-dessus).

## En bref, côté technique

Installée une fois sur la tablette, l'application continue de
fonctionner **sans connexion internet**. Pas de compte à créer, pas de
donnée envoyée à un serveur : tout reste sur la tablette.

## Et ensuite

Toujours en développement actif. Pistes en cours : concevoir
l'enchaînement d'écrans propre aux sorties chez une praticienne (au-delà
du trajet/arrivée génériques actuels), rendre le contenu (routines,
sorties) paramétrable par un parent sans limite, affiner la direction
artistique des décors — détail à jour dans [`TODO.md`](../../TODO.md).
