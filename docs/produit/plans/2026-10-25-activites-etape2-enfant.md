# Activités, étape 2 (côté enfant) — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** la journée de l'enfant devient une seule liste (déjà fait / maintenant / après / plus tard) à la place du menu, de la voiture et de « Ma journée » ; tout s'écoute partout (🔊 maintenant, 🗓️🔊 toute la journée avec lecture suivie) ; une nouvelle nature d'activité « à la maison » avec son écran.

**Architecture :** la logique pure de la liste (statut de chaque item, phrases lues) vit dans un nouveau module `app/journee.js`, testé sous Node comme `semaine.js`. L'avancement passe au niveau de l'item de planning (`fait`, `passe`) ; l'étoile reste une par routine et par jour (`etoileDonnee`). `app.js` garde l'affichage, le lancement et les écrans.

**Tech Stack :** JS/CSS/HTML vanilla, Web Speech API, `node --test`.

**Spec :** `docs/produit/specs/2026-10-25-activites-design.md` (sections 1, 2, 3, 6 et 8, étape 2).

## Global Constraints

- Aucun prénom réel dans le code ni la doc (dépôt publié) ; « l'enfant ».
- Rien ne doit casser le matin : réveil → liste → routine → validation → coffre → liste ; reprise après fermeture.
- Une seule voix à la fois : toute annonce coupe la lecture en cours (`dire()` annule déjà).
- Pas de boutons d'écoute sur l'écran de séance ni dans l'espace parent.
- Les heures sont une annotation, jamais lues, jamais un verrou (hors `disponibleApresHeure`).
- Commande de test : `node --test tests/*.test.js`.
- Service worker : `CACHE_NAME` incrémenté et `./journee.js` ajouté à la liste.

## Review Focus

1. Journée en cours au moment de la mise à jour (routines déjà validées, aucun `fait` sur les items) : la liste doit repartir au bon endroit, sans redonner d'étoile.
2. « Se préparer à partir » absent du planning du jour ou sauté : une sortie ne doit pas rester bloquée pour toujours.
3. Tout est fait avant l'heure du coucher : « Maintenant » = le coucher, verrouillé (🕒), sans plantage ni boucle.
4. Une routine présente deux fois : le second passage repart de tâches vides et se termine sans coffre.
5. Lecture de la journée interrompue (second appui, autre annonce, changement d'écran) : plus aucune carte allumée, bouton revenu à 🗓️🔊.

---

### Task 1 : module `journee.js` — statuts de la liste et phrases

**Files :**
- Create : `app/journee.js` (fonctions globales + garde `module.exports`, comme `semaine.js`)
- Create : `tests/journee.test.js`

**Interfaces :**
- Produces :
  - `estAFaire(item) -> boolean` — `routine` ou `aventure`.
  - `statutsJournee(planning, horaire) -> { statuts: string[], maintenant: number|null, apres: number|null, verrouille: boolean }`. `horaire(item)` renvoie `null` (pas d'heure de déblocage), `true` (heure atteinte) ou `false` (pas encore). Statuts : `"fait"`, `"passe"`, `"rate"`, `"repere-passe"`, `"maintenant"`, `"apres"`, `"plus-tard"`.
    - « maintenant » = le premier item à faire, ni `fait` ni `passe`, dont `horaire` vaut `true` ; sinon le premier item à faire ni `fait` ni `passe` (`verrouille: true` si son `horaire` vaut `false`).
    - avant « maintenant » : `fait` → `"fait"`, `passe` → `"passe"`, repère → `"repere-passe"`, à faire non fait → `"rate"`.
    - après : `fait`/`passe` gardent leur statut ; le premier autre item (repère compris) → `"apres"`, les suivants → `"plus-tard"`.
    - sans « maintenant » (tout est fait) : les repères situés après le dernier item fait suivent la règle « après / plus tard », les autres sont `"repere-passe"`.
  - `phrasesJournee(planning, resultat, nomDe) -> { index, texte }[]` — dans l'ordre de la liste : le premier `fait`/`repere-passe` « C'est fait : X. », les suivants « X. » ; « Maintenant : X. », « Après : X. », puis « Ensuite : X. » pour chaque `plus-tard`. Ni `passe` ni `rate`. Liste vide → `[{ index: null, texte: "Rien de prévu aujourd'hui." }]`.
  - `phraseMaintenant(planning, resultat, nomDe) -> string` — « Maintenant : X. Après : Y. » ; sans après : « Maintenant : X. » ; sans maintenant mais avec après : « Après : Y. » ; rien : « Tout est fait pour aujourd'hui ! ».
  - `indexAMarquer(planning, type, id) -> number` — premier item de ce type et de cet id ni `fait` ni `passe`, sinon -1.

- [ ] **Step 1 : écrire `tests/journee.test.js`** — au minimum : journée neuve (`repas, routine, routine, repas, routine-soir`) → maintenant = 1, après = 2, item 0 `"repere-passe"` ; item 1 `fait` → maintenant = 2 ; coucher débloqué alors que 1 et 2 ne sont pas faits → maintenant = coucher, 1 et 2 `"rate"` ; tout fait sauf le coucher avant son heure → maintenant = coucher, `verrouille: true` ; item `passe` jamais maintenant ; tout fait → `maintenant: null`, repère final `"apres"` ; phrases dans l'ordre avec leurs index ; `phraseMaintenant` dans ses quatre cas ; `indexAMarquer` saute un item `fait` et un item `passe`.
- [ ] **Step 2 : lancer** `node --test tests/journee.test.js` — Expected : FAIL (`journee.js` introuvable).
- [ ] **Step 3 : écrire `app/journee.js`.**
- [ ] **Step 4 : lancer** `node --test tests/*.test.js` — Expected : tout passe.
- [ ] **Step 5 : commit** « Ajoute la logique de la liste du jour et ses tests ».

### Task 2 : avancement par item, étoile une fois par jour

**Files :**
- Modify : `app/index.html` (charger `journee.js` avant `app.js`), `app/sw.js` (`acolyte-v17`, `./journee.js`)
- Modify : `app/app.js` — `etatRepare()`, `ouvrirCoffreRoutine()`, `allerValidation()`, `terminerAventure()`, `demarrerRoutine()`, `confirmerRelanceRoutine()`, `construireJournee()` (éditeur)

**Interfaces :**
- Consumes : `indexAMarquer()`.
- Produces :
  - `marquerItemFait(type, id)` — met `fait: true` sur `indexAMarquer(etat.planning, type, id)` (rien si -1).
  - `etat.routines[id].etoileDonnee` — posé à l'ouverture du coffre ; jamais remis à `false` dans la journée. `etatRepare()` le déduit de `valide` s'il est absent, et marque `fait` le premier item de chaque routine déjà validée (une seule fois, drapeau `etat.itemsMigres`).
  - Fin de routine : étoile pas encore donnée → coffre comme aujourd'hui (le coffre ouvert marque `valide`, `etoileDonnee`, l'item `fait`) ; étoile déjà donnée → le bouton de correction devient « Valider ✅ », marque `valide` et l'item `fait`, dit « Bravo, c'est fait ! » et revient à la liste, sans coffre.
  - `demarrerRoutine(id)` : si la routine est déjà `valide`, nouveau passage → `fait: []`, `valide: false` (l'étoile reste).
  - `terminerAventure(a)` marque l'item `fait` (avec ou sans coffre).
  - Relance (espace parent) : ne retire plus d'étoile ; si des tâches ont été décochées, `valide: false` et le dernier item `fait` de cette routine redevient à faire. Le cas « Aller se coucher » (journée et sommeil rouverts) est conservé.
  - Éditeur, jour = aujourd'hui seulement : un item `fait` affiche ✓ ; bouton ⏭ « Sauter » / « Reprendre » qui bascule `passe` ; un item sauté est grisé.

- [ ] **Step 1 : implémenter**, puis `node --check app/app.js`.
- [ ] **Step 2 : vérifier dans le navigateur (port neuf)** : routine faite → item `fait`, une étoile ; la relancer en décochant une tâche → étoile conservée, item à refaire ; la refaire → validation sans coffre, toujours une étoile ; sortie terminée → item `fait` ; ⏭ sur un item → `passe` ; état « journée en cours d'avant la mise à jour » (routine `valide`, aucun `fait`) → l'item est marqué une seule fois.
- [ ] **Step 3 : commit** « Note l'avancement de la journée par élément et garde l'étoile acquise ».

### Task 3 : la liste du jour à la place du menu

**Files :**
- Modify : `app/index.html` — `screen-menu` : retirer `#titre-menu`, `#liste-routines`, `#btn-depart`, `#btn-journee` ; ajouter `#liste-journee`
- Modify : `app/app.js` — `construireMenu()`, `allerVersDepart()` (devient la vérification « prêt avant de partir » d'une sortie), `clignoterRoutine()`, câblage
- Modify : `app/styles.css` — cartes de la liste et couleurs par nature (`--type-maison` turquoise ajouté)

**Interfaces :**
- Consumes : `statutsJournee()`, `phraseMaintenant()`, `libelleItemPlanning()`.
- Produces :
  - `horaireItem(item)` — `null` sauf routine à `disponibleApresHeure` (`true`/`false` selon `dateActuelle()`).
  - `naturesItem(item) -> "routine" | "maison" | "sortie" | "repas"` pour la couleur (`aventure` sans `nature` ou `nature: "sortie"` → sortie).
  - Rendu : une rangée « déjà fait » (pictogrammes des items `fait`, `repere-passe`, `rate` estompés), la carte « Maintenant » en grand (pictogramme, nom, heure en annotation, bouton « C'est parti ▶ » ; 🕒 et « Pas encore l'heure » si `verrouille`), la carte « Après » en moyen, « Plus tard » en petit. Les items `passe` ne sont pas montrés. Chaque carte porte `data-index` (lecture suivie) et `data-id`.
  - « C'est parti ▶ » : routine → `demarrerRoutine()` ; aventure de nature maison → écran maison (tâche 5) ; sortie/séance → `partirSiPret(id)` : les routines de `ROUTINES_REQUISES_DEPART` présentes au planning, ni `passe` ni validées, manquent → voix « Avant de partir, il faut d'abord faire : … » et la carte clignote ; sinon `demarrerAventure()`.
  - Toucher une autre carte dit seulement son nom. Liste vide : « Rien de prévu aujourd'hui. »
  - Le chaînage `chainee` n'est plus lu par la liste. Les écrans `screen-missions` et « Ma journée » ne sont plus atteignables par l'enfant (le panneau debug les garde).

- [ ] **Step 1 : implémenter.**
- [ ] **Step 2 : vérifier** : capture de la liste sur une journée neuve ; le parcours du matin (S'habiller → validation → coffre → retour : « Maintenant » a avancé) ; sortie lancée sans « Se préparer à partir » → voix et clignotement, pas de départ ; avec → trajet ; coucher à l'heure forcée (panneau debug) → « Maintenant » ; avant → verrouillé ; console sans erreur.
- [ ] **Step 3 : commit** « Remplace le menu par la liste du jour ».

### Task 4 : tout s'écoute — 🔊, 🗓️🔊 et bande de pictogrammes

**Files :**
- Modify : `app/index.html` — conteneurs `.bande-journee` sous le bandeau de `screen-routine`, `screen-trajet`, `screen-arrivee`, `screen-recompenses` ; boutons dans les bandeaux
- Modify : `app/app.js` — `dire()`, nouvelles fonctions d'écoute, `afficherEcran()`
- Modify : `app/styles.css`

**Interfaces :**
- Consumes : `phrasesJournee()`, `phraseMaintenant()`, `statutsJournee()`.
- Produces :
  - `ECRANS_ECOUTE` : `screen-menu`, `screen-routine`, `screen-trajet`, `screen-arrivee`, `screen-maison`, `screen-recompenses`, `screen-dents`, `screen-histoire`. Chacun a un bouton 🗓️🔊 (`.btn-ecoute-journee`) ; ceux qui n'ont pas de 🔊 en reçoivent un.
  - 🔊 : liste et récompenses → `phraseMaintenant()` ; routine → inchangé (redit la tâche) ; trajet, arrivée, maison → le texte de l'écran puis « Après : X. » s'il y a un après ; dents, histoire → inchangé.
  - `lireJournee()` : file d'énoncés (un par phrase, `fr-FR`, même débit que `dire()`), chacun allume à son `onstart` la carte `[data-index]` de la liste, ou le pictogramme de la bande visible ; le bouton devient ⏹️ ; un second appui ou toute annonce via `dire()` arrête tout et éteint ; `onend` du dernier énoncé éteint et remet 🗓️🔊.
  - `construireBandeJournee()` (appelée par `afficherEcran()` pour les écrans à bande) : un pictogramme par item non `passe`, l'item « maintenant » entouré, les faits estompés.
  - Aucun bouton sur `screen-seance`, `screen-seance-note`, ni les écrans parent.

- [ ] **Step 1 : implémenter.**
- [ ] **Step 2 : vérifier** : boutons présents sur chaque écran de la liste ci-dessus, absents en séance et côté parent ; la lecture complète (énoncés interceptés dans la console si la synthèse ne parle pas) allume chaque carte dans l'ordre, s'arrête au second appui ; un 🔊 pendant la lecture la coupe et éteint ; capture d'un écran de routine avec sa bande.
- [ ] **Step 3 : commit** « Permet d'écouter la journée sur chaque écran de l'enfant ».

### Task 5 : la nature « à la maison » et son écran

**Files :**
- Modify : `app/index.html` — `screen-maison` ; formulaire d'activité : choix de nature (Sortie / À la maison / Séance) en création, bloc maison (`#na-maison-bloc` : endroit, consigne, minuteur)
- Modify : `app/app.js` — formulaire (`ouvrirNouvelleAventure()`, `ouvrirEditionAventure()`, `creerNouvelleAventure()`), `construireAjoutPlanning()` (« + À la maison »), `demarrerAventure()`, `reprendreEnCours()`, `libelleItemPlanning()`, panneau debug
- Modify : `app/styles.css`

**Interfaces :**
- Produces :
  - Activité maison : `{ id, nature: "maison", lieu (le nom), emoji, endroit: "chambre"|"salon"|"cuisine", consigne, minuteurMinutes: 0|10|20|30, recompensePieces }`. Ni trajet ni programme. `ENDROITS = { chambre: "🛏️ Chambre", salon: "🛋️ Salon", cuisine: "🍳 Cuisine" }`.
  - Formulaire : en création, trois puces de nature ; « à la maison » masque trajet, arrivée, étapes et montre endroit (puces), consigne (texte), minuteur (Aucun / 10 / 20 / 30 min), pièce. Erreur si nom ou consigne vide. Par défaut : endroit `salon`, minuteur 0, pièce non.
  - `ouvrirActiviteMaison(a, debut)` : `screen-maison` (bandeau : ←, nom, 🔊, 🗓️🔊 ; bande), grand pictogramme, endroit, consigne dite à l'ouverture ; minuteur facultatif calculé depuis `debut` (mémorisé dans `enCours` : `{ type: "aventure", id, etape: "maison", debut }`), qui continue pendant la lecture ; à zéro, carillon et « C'est l'heure ! Tu as fini ? ». Bouton « J'ai fini ✅ » → félicitations (« Bravo, tu as fini : X ! ») → « Un parent est avec moi » → code → coffre si `recompensePieces` > 0, sinon « Bravo ! » et retour à la liste ; l'item est marqué `fait` dans les deux cas.
  - « Prêt avant de partir » ne s'applique pas à une activité maison. Couleur turquoise partout (liste, bande, éditeur).

- [ ] **Step 1 : implémenter.**
- [ ] **Step 2 : vérifier** : créer « Lecture » (salon, 20 min, pièce) depuis « Chaque <jour> » puis depuis aujourd'hui ; la lancer depuis la liste → consigne dite, minuteur qui décompte ; fermer/rouvrir l'app → reprise avec le minuteur au bon endroit ; « J'ai fini » → code → coffre → pièce ; sans pièce → retour direct à la liste ; une sortie existante est inchangée ; console sans erreur.
- [ ] **Step 3 : commit** « Ajoute les activités à la maison ».

### Task 6 : documentation et vérification d'ensemble

**Files :**
- Modify : `docs/produit/fonctionnalites.md`, `docs/produit/modele-de-donnees.md`, `docs/produit/concept.md`, `docs/produit/parcours-journee.md`, `app/README.md`

- [ ] **Step 1 : mettre à jour** : la liste du jour (déjà fait / maintenant / après / plus tard, seul « maintenant » se lance, coucher à l'heure, prêt avant de partir), l'écoute, la nature maison, l'avancement par item et l'étoile acquise, `journee.js` et ses tests.
- [ ] **Step 2 : vérification d'ensemble** sur un profil neuf ET sur un état « tablette existante » (journée de la veille dans `cle("journee")` → archivée, nouvelle journée depuis la semaine type) : réveil → liste → S'habiller → coffre → Se préparer → sortie (trajet, arrivée, retour, pièce) → activité maison → coucher à l'heure → fin de journée ; console sans erreur ; `node --test tests/*.test.js`.
- [ ] **Step 3 : commit** « Documente la liste du jour, l'écoute et les activités à la maison ».
