# Activités, étape 3 (compléments) — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** trois compléments à la liste du jour : les **infos** (« Maman vient te chercher »), les **moments au choix** (l'enfant choisit parmi 2 ou 3 activités préparées) et le **mode de transport** d'une sortie (voiture, vélo, à pied).

**Architecture :** deux nouveaux types d'items de planning, `note` (repère) et `choix` (à faire), pris en compte par `journee.js` (testé) ; l'ajout se fait dans l'éditeur de journée par de petits blocs en ligne (pas d'écran plein) ; un écran `screen-choix` côté enfant ; un champ `modeTransport` sur les sorties.

**Tech Stack :** JS/CSS/HTML vanilla, `node --test`.

**Spec :** `docs/produit/specs/2026-10-25-activites-design.md` (sections 1, 3, 4, 6 ; étape 3 de la section 8).

## Global Constraints

- Aucun prénom réel dans le code ni la doc.
- Une info n'est jamais « maintenant » ; elle est lue telle quelle, jamais avec « C'est fait ».
- Un moment au choix ne propose que des activités de la bibliothèque (2 ou 3) ; l'enfant choisit sans attendre personne ; la récompense est celle de l'activité choisie.
- Tant qu'il n'y a pas de décor dédié, la scène de la fenêtre de voiture est masquée hors voiture.
- Couleurs : info gris en pointillés, moment au choix orange (distinct de `--accent`).
- Commande de test : `node --test tests/*.test.js`. `CACHE_NAME` incrémenté.

## Review Focus

1. Moment au choix déjà choisi puis app fermée : à la réouverture, l'activité choisie reprend, et sa fin marque bien le moment au choix comme fait.
2. Activité choisie qui figure aussi ailleurs dans la journée : c'est le premier item restant (dans l'ordre) qui est marqué.
3. Info placée avant « maintenant » : ni lue comme « C'est fait », ni montrée comme faite.
4. Moment au choix dont une activité a été supprimée de la bibliothèque : l'option disparaît, sans plantage.
5. Sortie sans `modeTransport` (toutes les sorties existantes) : comportement inchangé (voiture).

---

### Task 1 : `journee.js` connaît les infos et les moments au choix

**Files :** Modify `app/journee.js`, `tests/journee.test.js`

**Interfaces :**
- `estAFaire(item)` : `routine`, `aventure` ou `choix`. Une `note` est un repère.
- `indexAMarquer(planning, "aventure", id)` trouve aussi un item `{ type: "choix", choisi: id }` restant (le premier dans l'ordre, quel que soit son type).
- `phrasesJournee` : une `note` passée n'est pas lue ; une note à venir garde son préfixe (« Après : … »).

- [ ] Tests d'abord (choix « maintenant », note jamais « maintenant », indexAMarquer sur un choix, note passée non lue), RED, puis code, puis `node --test tests/*.test.js`, commit « Prend en compte les infos et les moments au choix dans la liste du jour ».

### Task 2 : les infos

**Files :** `app/app.js` (`libelleItemPlanning`, `natureItem`, `construireJournee`, `construireAjoutPlanning`), `app/styles.css`

**Interfaces :**
- Item `{ type: "note", texte, entourageIds?, heure? }`. Libellé `{ emoji: "💬", nom: texte, entourage }`.
- Éditeur : bouton « + Info » qui déplie en ligne un champ texte (80 car.), les puces de l'entourage (facultatif) et « Ajouter l'info » (texte obligatoire), inséré avant le coucher.
- Liste et bande : carte grise en pointillés, pas de bouton ; toucher dit le texte.

- [ ] Implémenter ; vérifier (ajout aujourd'hui et semaine type, rendu, lecture « Après : Maman vient te chercher. ») ; commit « Ajoute les infos à la journée ».

### Task 3 : les moments au choix

**Files :** `app/index.html` (`screen-choix`), `app/app.js`, `app/styles.css`

**Interfaces :**
- Item `{ type: "choix", options: [idAventure…], choisi?, heure? }` (2 ou 3 options). Libellé : choisi → l'activité choisie ; sinon `{ emoji: "🎲", nom: "Au choix : A, B ou C" }`. Nature `"choix"` (orange).
- Éditeur : « + Moment au choix » déplie en ligne les puces des activités de la bibliothèque (choix multiple, 2 à 3) et « Ajouter le moment au choix ».
- Liste : « C'est parti » sur un choix non choisi → `ouvrirChoix(index)` ; déjà choisi → lance l'activité choisie (maison, ou sortie avec « prêt avant de partir »).
- `screen-choix` : bandeau (←, « À toi de choisir », 🔊, 🗓️🔊), bande, une grande carte par option ; toucher une carte dit son nom et la sélectionne ; « C'est parti ▶ » (actif une fois sélectionnée) enregistre `choisi` dans `etat.planning[index]` et lance l'activité. 🔊 : « Tu peux choisir : A, B ou C. »
- Fin de l'activité choisie → l'item `choix` passe `fait` (via `indexAMarquer`).

- [ ] Implémenter ; vérifier (choix créé, écran, sélection, lancement maison et sortie, reprise après fermeture, item fait, option orpheline ignorée) ; commit « Ajoute les moments au choix ».

### Task 4 : le mode de transport

**Files :** `app/index.html` (formulaire : `#na-transport-bloc` ; trajet : `#trajet-transport`), `app/app.js`, `app/styles.css`

**Interfaces :**
- Sortie et séance : `modeTransport: "voiture" | "velo" | "pied"` (absent = voiture). Puces dans le formulaire (défaut voiture).
- Texte de trajet suggéré : voiture « On roule vers X. », vélo « On pédale jusqu'à X. », à pied « On marche jusqu'à X. » (la suggestion suit le mode tant que le parent n'a pas modifié le texte).
- Trajet : voiture → scène actuelle ; vélo / à pied → scène masquée, grand pictogramme 🚲 / 🚶 à la place.

- [ ] Implémenter ; vérifier (création vélo, trajet sans voiture, sortie existante inchangée) ; commit « Ajoute le mode de transport des sorties ».

### Task 5 : docs, cache et vérification

- [ ] `fonctionnalites.md`, `modele-de-donnees.md`, `app/README.md`, README racine ; `sw.js` en v18 ; parcours complet avec une info, un moment au choix et une sortie à vélo ; console sans erreur ; tests ; commit « Documente les infos, les moments au choix et le mode de transport ».
