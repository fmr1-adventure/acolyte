# Parcours de la journée — écran par écran

Séquence attendue, prise au fil des explications. Les principes derrière
ces étapes (pourquoi une jauge, pourquoi une correction parent...) sont
dans `concept.md` ; les entités de données dans `modele-de-donnees.md`.

## Séquence

1. **Réveil** — l'enfant prend la tablette pour la première fois de la
   journée, arrive sur le **menu de la journée** (liste des routines et
   missions du jour).
2. Dans ce menu, seule la première routine (ex. "S'habiller") est
   cliquable ; les autres routines/missions sont **grisées, non
   cliquables**, tant que celle-ci n'est pas terminée (ordre/blocage
   paramétrable par les parents — cf. `concept.md`).
3. L'enfant choisit une routine → écran d'exécution de la routine
   (l'écran drag-and-drop existant dans `app/`). Il doit aller
   **jusqu'au bout** pour obtenir l'étoile de cette routine.
4. **Fin de routine — félicitations puis appel au parent** : message
   écrit + dit, spécifique à la routine et personnalisé avec le prénom de
   l'enfant (ex. "Bravo Sacha, tu t'es habillé·e tout seul·e !"), suivi de
   "Maintenant va chercher papa ou maman pour obtenir ta récompense."
5. **Relecture/correction parent** : les tâches de la routine terminée
   deviennent déclickables (togglables), pour que le parent puisse
   décocher une tâche pas réellement effectuée avant de valider. Mode
   distinct de la routine elle-même (où seule l'étape en cours est
   cliquable).
6. **Validation parent** — au final le parent valide toujours (la
   correction ajuste, elle ne bloque pas). À la validation : l'enfant
   reçoit son étoile, la jauge de journée se remplit visiblement.
7. Retour à l'écran des routines/missions — idéalement une scène montrant
   l'enfant **dans son état actuel** (habillé ou non, coiffé ou non...),
   en train d'attendre, avec accès au menu du jour.
8. Répétition des étapes 2 à 7 pour chaque routine/mission programmée.
9. **Récompense de fin de journée**, dépendante de la quantité totale
   d'étoiles accumulées (cf. `concept.md`).

## Écran parallèle : "Ma journée"

En dehors de cette séquence (accessible à tout moment depuis le menu),
"Ma journée" donne une vue d'ensemble plutôt qu'un parcours à suivre :
mêmes routines/aventures/repas, dans l'ordre, avec un repère "maintenant"
qui suit l'horloge quand des heures ont été réglées par un parent — sans
jamais influencer le déblocage réel des étapes 2-3 ci-dessus, qui reste
strictement séquentiel/par tâche. Détail des principes dans `concept.md`.

## Cas particulier : journée sans planification (ex. week-end)

Si aucune mission n'est programmée, l'enfant peut proposer une activité
au menu du jour ; elle doit être validée par un parent avant de devenir
faisable. Flux pas encore détaillé.

## Questions ouvertes

- Barème précis étoiles → récompense de fin de journée.
- Mécanique concrète de proposition d'activité par l'enfant + validation
  parent (quel écran, quelle interaction).
- Écran d'attente entre routines : à quoi il ressemble concrètement, quel
  lieu par défaut.
