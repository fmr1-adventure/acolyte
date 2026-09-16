# Concept — principes produit

Notes prises au fil des explications, au-delà de ce que couvrait le
handoff initial (`docs/design-handoff/`). Ce sont des principes/décisions
produit — le "pourquoi" et l'intention — pas le détail écran par écran
(→ `parcours-journee.md`) ni les entités techniques (→
`modele-de-donnees.md`).

## Routines vs missions

Deux natures de choses au menu de la journée :

- **Routines** — blocs de tâches répétées structurellement (ex.
  "S'habiller", "Se préparer à partir"). Voir `modele-de-donnees.md`.
- **Missions** — sorties/activités programmées par les parents pour la
  journée (aller chez l'orthophoniste, aller faire des courses, aller
  faire du vélo...). Pas forcément récurrentes.

## Ordre et blocage, paramétrables par les parents

Dans le menu de la journée, une seule routine/mission est cliquable à la
fois ; les autres sont grisées tant que la précédente n'est pas finie.
**L'ordre et les dépendances entre routines/missions sont paramétrables
par les parents** — pas un enchaînement figé dans le code.

Toutes les routines ne se prêtent pas à ce chaînage : "Aller se
coucher" n'a **aucun rapport** avec "S'habiller"/"Se préparer à
partir" — l'enchaîner quand même créait un vrai risque, découvert en
ajoutant "Relancer une routine" (espace parent) : un parent corrigeant
une routine de journée en soirée se retrouvait avec le coucher
verrouillé juste avant l'heure de dormir. Le coucher se débloque donc
par **l'heure**, pas par les autres routines — et réciproquement, c'est
justement cette notion d'heure qui empêche l'autre risque (un enfant
sautant direct au coucher, donc au déshabillage, sans avoir rien fait
d'autre de sa journée). Un rappel qu'une dépendance entre deux routines
doit avoir un vrai rapport de cause à effet, pas juste suivre l'ordre où
elles ont été codées.

## Récompense : étoiles par routine → jauge de journée

- Chaque routine terminée rapporte une **étoile**.
- Les étoiles remplissent une **jauge de journée** au fur et à mesure.
- La **récompense de fin de journée dépend de la quantité d'étoiles**
  accumulées (barème encore à définir).

Ça remplace/étend le mécanisme du prototype pilote actuel (une seule
récompense "coffre" après l'unique routine) — à revoir une fois le modèle
Routine/Tâche implémenté.

## Récompense d'une aventure : la pièce, pas une étoile

Une aventure (ex. "aller au magasin de bricolage") peut, elle aussi,
rapporter une récompense — mais **pas une étoile** : l'étoile reste
propre aux routines et à leur jauge de journée. La monnaie d'une
aventure est une **pièce**.

- La pièce **ne se remet pas à zéro chaque jour** (contrairement aux
  étoiles) : elle reste acquise jusqu'à être dépensée.
- Elle se dépense à un moment choisi par l'enfant, pour **une activité
  de son choix** — le "quand" et le "quoi" précis restent à définir
  (pas de boutique conçue pour l'instant, cf. `TODO.md`, section "Pas
  encore désigné").
- Elle peut aussi être **échangée dans la vraie vie**, donnée aux
  parents en dehors de l'app.
- Elle sort du **même coffre** que la récompense de fin de journée
  (même écran, même geste d'ouverture) — pas un écran de récompense à
  part.

## "Ma journée" : aperçu chronologique + premier pas vers le paramétrage parent

Écran séparé du parcours actif (menu → routines → aventures) : un simple
**aperçu de la journée**, dans l'**ordre chronologique** — routines,
mission(s) du jour, repas mélangés dans une seule liste plutôt que
groupés par nature.

Chaque item peut recevoir une **heure facultative** (réglée par un parent
en mode édition) : purement un repère visuel, jamais lu par la logique de
déblocage des routines (`disponibleApresHeure`, menu du jour) — les deux
restent deux mécanismes séparés, la leçon retenue du bug "Aller se
coucher" (cf. plus haut, "Ordre et blocage"). L'ordre du planning reste la
seule source de vérité ; l'heure n'est qu'une annotation dessus, jamais un
tri. Quand au moins un item a une heure, un repère **"maintenant"**
(dérivé de l'horloge déjà affichée au menu) met en avant l'item en cours
et, s'il y en a un, le suivant — pour qu'un enfant ou un parent voie d'un
coup d'œil où on en est dans la journée, pas seulement ce qui reste à
faire. Un item sans heure n'est simplement pas concerné : une journée qui
n'utilise aucune heure s'affiche exactement comme avant. Un **code
couleur** (routine/repas/sortie) complète ce coup d'œil.

On peut aussi ajouter des items d'un coup à partir d'un texte libre tapé
ou dicté (ex. "vélo 15h, goûter chez mamie 17h") : l'app reconnaît une
heure et rapproche le reste du texte des routines/aventures/repas déjà
connus (par leur nom ou des mots-clés), puis **propose** chaque
correspondance trouvée — jamais d'ajout automatique, un parent confirme
ligne par ligne, même principe que "le parent valide toujours au final"
plus bas. Ce n'est pas de l'IA : une reconnaissance locale par mots-clés,
qui ne comprend que ce qui existe déjà dans les catalogues — délibéré,
pour ne dépendre d'aucun serveur (cf. "En bref, côté technique" dans
`fonctionnalites.md`).

Premier pas concret vers le principe déjà posé plus haut ("Ordre et
blocage, paramétrables par les parents") : un **mode édition protégé par
le code parent** permet de réordonner et retirer les items du jour, et
d'en ajouter d'autres — soit en piochant dans ce qui existe déjà
(routines/aventures/repas déjà définis), soit en **créant une page
entièrement nouvelle** depuis l'espace parent, pour une activité comme
pour une routine ("Activités"/"Routines", cf. section dédiée
ci-dessous). Ce mode édition est maintenant repris tel quel comme une
des options de l'espace parent.

**Le planning est la seule source de vérité pour ce qui est accessible
aujourd'hui** : une activité apparaît dans "Partir à l'aventure" si et
seulement si elle est dans le planning du jour — pas via un champ date
séparé qu'il faudrait aussi penser à mettre à jour. Concrètement : créer
une activité l'ajoute immédiatement au planning (donc à "Partir à
l'aventure") ; la retirer du planning la retire aussi des sorties
possibles. Les deux écrans (aperçu du jour, sorties jouables) sont deux
vues du même état, pas deux systèmes à synchroniser à la main.

## Entourage : qui est là

Un petit catalogue, géré depuis l'espace parent ("Mon entourage"), pour
nommer les personnes qui gravitent autour de l'enfant (famille, aidants...)
et les rattacher à une activité ou une routine créée par un parent — pour
que "Ma journée" puisse répondre, en un coup d'œil, pas seulement "quoi"
mais aussi "avec qui". Rien d'obligatoire : une entrée sans personne
rattachée s'affiche exactement comme avant.

**Distinct des praticiennes** déjà présentes dans les aventures propres à
la famille (ajoutées depuis l'espace parent) : celles-ci déclenchent un vrai déroulé à part
(la praticienne prend l'appareil, code de fin de séance, note obligatoire
— cf. plus bas, "Les sorties"). L'entourage de cette section n'a aucun
effet sur le déroulé : c'est une simple étiquette visuelle. Les deux
notions se ressemblent en surface mais ne doivent jamais se confondre.

## Espace parent : lié à l'espace enfant, pas un outil séparé

Les réglages destinés aux parents vivent dans la
**même application** que ce que voit l'enfant — même `app.js`, même
`localStorage` — et pas dans un outil séparé (site d'admin, autre app).
**Un changement fait dans l'espace parent a un effet immédiat sur
l'espace enfant**, parce que c'est littéralement le même état qui est lu
des deux côtés. Protégé par le même code parent que le reste, via un
point d'entrée discret (pas caché — un enfant curieux tombe juste sur
l'écran du code, rien de plus).

**Relancer une routine** en fait partie, demandé explicitement : si
l'état réel de l'enfant a changé depuis qu'une routine a été validée
(ex. il s'est redéshabillé en rentrant à la maison), un parent doit
pouvoir la rouvrir plutôt que de tout réinitialiser la journée. Réutilise
le principe déjà posé ailleurs (correction avant validation) : on
décoche ce qui n'est plus vrai, la routine redevient à faire pour
l'enfant. L'étoile déjà donnée est reprise (pas donnée deux fois), pas
un blocage/une punition — cohérent avec "le parent valide toujours au
final" déjà posé plus bas.

**"Activités" et "Routines"** (accès à tout ce qui existe + création)
suivent le même principe de fond mais pas la même interaction, pour une
vraie raison de modèle de données et pas juste par cohérence de façade :
une activité a un interrupteur jour par jour (le planning décide si elle
est proposée aujourd'hui, cf. plus haut), donc toucher une activité
existante bascule sa présence dans le planning. Une routine, elle, fait
partie du parcours tous les jours dès qu'elle existe — il n'y a pas
d'interrupteur équivalent à proposer, donc la liste des routines reste
en lecture seule ; "Relancer une routine" (ci-dessus) reste l'écran dédié
pour agir sur une routine précise.

## Correction parent avant validation

Après une routine, avant la récompense, le parent doit pouvoir **corriger**
: décocher une tâche que l'enfant a validée mais qui n'a pas été
réellement faite. C'est une relecture, pas un blocage — **le parent
valide toujours au final** ; la correction ajuste ce qui est validé,
elle ne sert pas à refuser la récompense.

## Continuité visuelle de l'avatar

Entre deux routines, l'enfant retourne à un écran d'attente (chambre ou
autre pièce) où l'**avatar reflète son état réel du moment** — habillé ou
non, coiffé ou non, etc. — plutôt que de repartir à zéro visuellement à
chaque écran.

## Cas non planifié (ex. week-end)

Quand aucune mission n'est programmée par les parents, **l'enfant peut
proposer des activités**, qui doivent ensuite être **validées par les
parents** avant de devenir faisables. Flux encore à préciser.

## Porte de sortie vers les missions

Le menu de la journée a un point de sortie unique vers l'écran des
sorties/missions — pas une carte comme les routines, un vrai "portail",
façon écran de niveau d'un jeu où le héros part à l'aventure. Options
envisagées :

- **Une voiture** (retenue, implémentée) — cohérent avec "Se préparer à
  partir" et un thème course exploré pour la chambre d'un des enfants
  (cf. `docs/legacy/`).
- Une porte.
- Un chemin/route à suivre.

**Comportement si des routines indispensables manquent** ("S'habiller",
"Se préparer à partir" — "Aller se coucher" n'est pas concernée, sans
rapport avec la sortie) : **pas de navigation forcée**. L'enfant a pu
appuyer sur la voiture sans le vouloir. À la place : rappel vocal des
routines manquantes ("Avant de partir à l'aventure, il faut d'abord
faire : ..."), et la routine de rang 1 (la seule débloquée) **clignote**
sur le menu pour attirer l'attention, sans s'ouvrir toute seule — c'est
à l'enfant de décider de la lancer.

**Comportement** (implémenté) : cliquer dessus vérifie que la routine
"Se préparer à partir" est validée. Si oui → ouvre l'écran des sorties.
Si non → ramène directement dans cette routine, sans passer par le menu
— l'enfant ne peut pas "partir" avant d'être prêt.
