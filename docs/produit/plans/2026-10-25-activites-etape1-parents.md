# Étape 1 — Côté parents : semaine type, prochains jours, sorties et séances — plan de mise en œuvre

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** donner aux parents un planning à deux onglets (semaine type qui revient toute seule, prochains jours « comme d'habitude » / « modifié »), la création de sorties et de séances depuis ce planning, et un espace parent regroupé — sans aucun changement visible pour l'enfant.

**Architecture :** la logique pure (semaine type, accès par jour de semaine, insertion et migration des activités datées) vit dans un nouveau fichier `app/semaine.js`, script classique chargé avant `app.js` et testable sous Node. `app.js` la branche sur le stockage (`cle("semaine_type")`) et réutilise l'éditeur de journée existant en lui ajoutant une troisième cible : un jour de la semaine type.

**Tech Stack :** JavaScript sans framework ni dépendance, `localStorage`, service worker ; tests avec le lanceur intégré de Node (`node --test`).

**Spec :** `docs/produit/specs/2026-10-25-activites-design.md` — sections 4 (bibliothèque et planning), 6 (modèle de données) et 8 (découpage, étape 1).

## Global Constraints

- Aucune dépendance ajoutée, pas de `package.json` : tests lancés par `node --test tests/`.
- Aucun changement visible côté enfant : menu, voiture, routines et « Ma journée » (y compris son bouton ✏️) restent identiques ; le ✏️ disparaîtra à l'étape 2.
- Clés de jour au format `"AAAA-M-J"` sans zéro (cf. `cleJourPour()`) ; jours de semaine numérotés 1 = lundi … 7 = dimanche.
- Forme d'un item de planning inchangée : `{ type: "routine" | "aventure" | "repas", id, heure? }`.
- Une séance reste une aventure portant `personne: { emoji, nom }` (invariant existant : c'est ce champ qui déclenche l'écran de séance).
- Toute nouvelle donnée par enfant passe par `cle(nom)`.
- Libellés en français ; aucun prénom réel dans le code ni la doc (dépôt publié).
- Commentaires : seulement un « pourquoi » non évident, une ligne.
- Vérifier l'interface dans le navigateur sur un port neuf (le cache garde l'ancien `app.js` sur un port déjà utilisé).

## Review Focus

1. **Tablette déjà utilisée** : après la mise à jour, le planning du jour en cours n'est pas re-semé, les jours à venir « modifiés » restent tels quels, et la semaine type initiale reproduit exactement l'ancienne journée par défaut — demain ressemble à hier. → test « semaine type initiale = ancienne journée par défaut » (tâche 2).
2. **Routine créée après coup** : elle apparaît aujourd'hui et dans les 7 jours de la semaine type, sans doublon. → tâches 1 (`ajouterAuxSeptJours`) et 2.
3. **Modifier le mardi de la semaine type un mardi** : le planning d'aujourd'hui ne bouge pas, un mardi à venir « comme d'habitude » suit, un mardi « modifié » non. → vérification de la tâche 3.
4. **Séance sans entourage** : message clair, aucune création, aucune erreur. → vérification de la tâche 5.
5. **Activités datées existantes** : une date future réapparaît bien ce jour-là après la mise à jour, une date passée est ignorée, la migration ne tourne qu'une fois. → tests de la tâche 1, vérification de la tâche 2.

---

### Task 1 : module `semaine.js` et ses tests

**Files :**
- Create : `app/semaine.js`
- Create : `tests/semaine.test.js`
- Modify : `app/index.html` (balise `<script src="semaine.js"></script>` juste avant celle de `app.js`)
- Modify : `app/sw.js` (`"./semaine.js"` dans `A_METTRE_EN_CACHE`, `CACHE_NAME` `"acolyte-v15"` → `"acolyte-v16"`)

**Interfaces :**
- Produces (fonctions globales dans le navigateur, exportées sous Node par `if (typeof module !== "undefined") module.exports = { … }`) :
  - `NOMS_JOURS` : `["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]`
  - `jourSemaineDe(cleJour: string) -> number` (1 à 7)
  - `creerSemaineType(journeeType: Item[]) -> { "1": Item[], …, "7": Item[] }` — 7 copies indépendantes
  - `planningDuJour(semaineType, cleJour: string) -> Item[]` — copie du jour correspondant, `[]` si absent
  - `ajouterAuxSeptJours(semaineType, item: Item) -> semaineType` — nouvel objet ; un jour qui contient déjà le même `type` + `id` est laissé tel quel
  - `insererActivite(items: Item[], aventure: { id, apres?, heureDefaut? }) -> Item[]` — nouveau tableau ; sans effet si `{ type: "aventure", id }` y est déjà ; inséré juste après l'item désigné par `apres` (`{ type, id }`) s'il existe, sinon à la fin ; `heure` = `heureDefaut` si présent
  - `migrerActivitesDatees(aventures, planningFutur, aujourdhui: string, planningPour: (cle) => Item[]) -> { planningFutur, pourAujourdhui: aventure[] }` — fonction pure : chaque aventure dont `date` est postérieure à `aujourdhui` est insérée dans `planningFutur[date]` (base : l'entrée existante, sinon `planningPour(date)`) ; celles datées d'aujourd'hui sont renvoyées dans `pourAujourdhui` ; les dates passées sont ignorées ; le `planningFutur` reçu n'est pas modifié

- [ ] **Step 1 : écrire les tests qui échouent** (`tests/semaine.test.js`, `node:test` + `node:assert/strict`, `const S = require("../app/semaine.js")`)

```js
test("jourSemaineDe : lundi = 1, dimanche = 7", () => {
  assert.equal(S.jourSemaineDe("2026-10-26"), 1);
  assert.equal(S.jourSemaineDe("2026-10-25"), 7);
  assert.equal(S.jourSemaineDe("2026-11-1"), 7);
});
test("creerSemaineType : 7 copies indépendantes", () => {
  const jour = [{ type: "repas", id: "petit-dej", heure: "07:30" }];
  const st = S.creerSemaineType(jour);
  assert.deepEqual(Object.keys(st), ["1", "2", "3", "4", "5", "6", "7"]);
  st["2"].push({ type: "routine", id: "x" });
  assert.equal(st["3"].length, 1);
  assert.equal(jour.length, 1);
});
test("planningDuJour : copie du bon jour", () => {
  const st = S.creerSemaineType([]);
  st["2"] = [{ type: "aventure", id: "a" }];
  const mardi = S.planningDuJour(st, "2026-10-27");
  assert.deepEqual(mardi, [{ type: "aventure", id: "a" }]);
  mardi.push({ type: "repas", id: "diner" });
  assert.equal(st["2"].length, 1);
});
test("ajouterAuxSeptJours : sans doublon, sans muter l'entrée", () => {
  const st = S.creerSemaineType([{ type: "routine", id: "r1" }]);
  const apres = S.ajouterAuxSeptJours(S.ajouterAuxSeptJours(st, { type: "routine", id: "r2" }), { type: "routine", id: "r2" });
  for (const j of ["1", "4", "7"]) assert.deepEqual(apres[j].map(i => i.id), ["r1", "r2"]);
  assert.equal(st["1"].length, 1);
});
test("insererActivite : après `apres`, sinon à la fin, heureDefaut, idempotent", () => {
  const base = [{ type: "routine", id: "partir" }, { type: "repas", id: "dejeuner" }];
  const a = { id: "piscine", apres: { type: "routine", id: "partir" }, heureDefaut: "10:00" };
  const r = S.insererActivite(base, a);
  assert.deepEqual(r[1], { type: "aventure", id: "piscine", heure: "10:00" });
  assert.equal(S.insererActivite(r, a).length, 3);
  assert.equal(S.insererActivite(base, { id: "x" })[2].id, "x");
  assert.equal(base.length, 2);
});
test("migrerActivitesDatees : futur inséré, aujourd'hui renvoyé, passé ignoré", () => {
  const aventures = [{ id: "f", date: "2026-11-3" }, { id: "t", date: "2026-10-25" }, { id: "p", date: "2026-9-1" }, { id: "n" }];
  const futur = { "2026-11-3": [{ type: "repas", id: "gouter" }] };
  const { planningFutur, pourAujourdhui } = S.migrerActivitesDatees(aventures, futur, "2026-10-25", () => [{ type: "repas", id: "diner" }]);
  assert.deepEqual(planningFutur["2026-11-3"].map(i => i.id), ["gouter", "f"]);
  assert.deepEqual(pourAujourdhui.map(a => a.id), ["t"]);
  assert.equal(planningFutur["2026-9-1"], undefined);
  assert.equal(futur["2026-11-3"].length, 1);
});
test("migrerActivitesDatees : jour futur absent semé depuis planningPour", () => {
  const { planningFutur } = S.migrerActivitesDatees([{ id: "f", date: "2026-12-1" }], {}, "2026-10-25", () => [{ type: "repas", id: "diner" }]);
  assert.deepEqual(planningFutur["2026-12-1"].map(i => i.id), ["diner", "f"]);
});
```

- [ ] **Step 2 : lancer les tests, ils échouent**

Run : `node --test tests/`
Expected : FAIL — `Cannot find module '../app/semaine.js'`.

- [ ] **Step 3 : écrire `app/semaine.js`** avec les signatures ci-dessus. `jourSemaineDe` passe par `new Date(a, m - 1, j).getDay()` (heure locale) et ramène dimanche (0) à 7. Comparaison des dates de `migrerActivitesDatees` par valeur de `Date`, pas par chaîne (les clés ne sont pas complétées par des zéros). Copies profondes par `JSON.parse(JSON.stringify(…))` (items simples).

- [ ] **Step 4 : relancer les tests, ils passent**

Run : `node --test tests/`
Expected : 7 tests, 0 échec.

- [ ] **Step 5 : charger le script et le mettre en cache** — balise dans `index.html`, entrée et version dans `sw.js` (cf. Files). Vérifier : `node --check app/semaine.js` ne signale rien, et dans le navigateur (port neuf) `typeof creerSemaineType === "function"` avant tout autre test.

- [ ] **Step 6 : commit**

```bash
git add app/semaine.js tests/semaine.test.js app/index.html app/sw.js
git commit -m "Ajoute le module de semaine type et ses tests"
```

### Task 2 : brancher la semaine type et migrer les activités datées

**Files :**
- Modify : `app/app.js` — `planningParDefaut()`, `creerNouvelleRoutine()` (branche création), `demarrer()`, nouvelles fonctions de stockage ; suppression de `aventuresPourDate()` et `aventuresDuJour()`

**Interfaces :**
- Consumes : tâche 1.
- Produces :
  - `journeeTypeHistorique() -> Item[]` — exactement la première partie de l'ancien `planningParDefaut()` : `PLANNING_DEFAUT` + `heure` des repas depuis `REPAS[].heureDefaut` + routines perso absentes, à la fin. Sans les activités datées.
  - `chargerSemaineType() -> semaineType` — lit `cle("semaine_type")` ; si absente ou illisible, la crée par `creerSemaineType(journeeTypeHistorique())`, la sauve et la renvoie.
  - `sauverSemaineType(semaineType)`.
  - `planningParDefaut(dateKey)` devient `planningDuJour(chargerSemaineType(), dateKey || cleJour())`.
  - `migrerDatesUneFois()` — sans effet si `cle("migration_dates")` vaut `"1"`. Sinon : `migrerActivitesDatees(toutesLesAventures(), chargerPlanningFutur(), cleJour(), planningParDefaut)`, sauve le `planningFutur` obtenu ; chaque aventure de `pourAujourdhui` est insérée par `insererActivite` dans `etat.planning` si `cle("journee")` existe déjà pour aujourd'hui, sinon dans `planningFutur[cleJour()]` (consommé par `chargerEtat()`) ; puis pose le drapeau.

- [ ] **Step 1 : écrire les fonctions de stockage et réécrire `planningParDefaut()`**, puis supprimer `aventuresPourDate()`/`aventuresDuJour()` et mettre à jour les commentaires qui les citent.

- [ ] **Step 2 : appeler `migrerDatesUneFois()` dans `demarrer()`**, juste après `appliquerProfilAuDom()` et avant le premier `chargerEtat()`.

- [ ] **Step 3 : dans `creerNouvelleRoutine()`, branche création seulement**, ajouter `sauverSemaineType(ajouterAuxSeptJours(chargerSemaineType(), { type: "routine", id: nouvelle.id }))` à côté de l'ajout existant au planning du jour.

- [ ] **Step 4 : vérifier dans le navigateur (port neuf)**, chaque point par `javascript_tool` puis `localStorage.clear()` :
  - nouveau profil (configuration complète) : `cle("semaine_type")` contient 7 jours, chacun égal à l'ancienne journée par défaut — petit-déjeuner, S'habiller, Se préparer à partir, déjeuner, goûter, dîner, Aller se coucher, avec les heures des repas ;
  - simulation d'une tablette existante : une `cle("journee")` du jour déjà présente, une aventure perso avec `date` dans 3 jours et une avec `date` passée → recharger : `planning_futur` du jour J+3 contient l'aventure, rien pour la date passée, `etat.planning` du jour inchangé, `cle("migration_dates") === "1"` ; recharger encore : pas de doublon ;
  - créer une routine depuis « + Nouvelle routine » : elle est dans `etat.planning` et dans les 7 jours de `cle("semaine_type")`, une seule fois.

- [ ] **Step 5 : `node --test tests/` passe toujours, puis commit**

```bash
git add app/app.js
git commit -m "Sème chaque journée depuis la semaine type et migre les activités datées"
```

### Task 3 : l'éditeur de journée cible aussi un jour de la semaine type

**Files :**
- Modify : `app/app.js` — variable de cible, `chargerPlanningCible()`, `sauverPlanningCible()`, `construireJournee()` (titre), points d'entrée, retour de `screen-journee`

**Interfaces :**
- Consumes : `chargerSemaineType()`, `sauverSemaineType()`, `NOMS_JOURS`.
- Produces :
  - `planningCible` remplace `planningCibleDate` : `null` (aujourd'hui) | `{ date: "AAAA-M-J" }` | `{ jourSemaine: 1…7 }` ; `planningCibleEstAujourdhui()` garde son contrat.
  - `ciblerAujourdhui()` — remplace chaque `planningCibleDate = null` actuel (menu, ligne « Aujourd'hui », bouton « Afficher ma journée », raccourci debug).
  - `ouvrirJourneeFuture(dateKey)` cible `{ date }` ; nouveau `ouvrirJourSemaineType(jour: number)` cible `{ jourSemaine }`, active l'édition, construit et affiche `screen-journee`.
  - Titre : `"Chaque " + NOMS_JOURS[jour - 1]` pour un jour de semaine ; inchangé sinon.
  - Retour (←) de `screen-journee` : vers l'écran Planning (`construireParentPlanningJournees()` + `screen-parent-planning-journees`) quand la cible n'est pas aujourd'hui, vers le menu sinon (comportement actuel).

- [ ] **Step 1 : remplacer la cible et brancher la semaine type** dans `chargerPlanningCible()`/`sauverPlanningCible()` (lecture et écriture de `semaineType[String(jour)]`).

- [ ] **Step 2 : titre, entrées et retour** comme décrit.

- [ ] **Step 3 : vérifier dans le navigateur** (le jour réel d'aujourd'hui = J) :
  - `ouvrirJourSemaineType(jourSemaineDe(cleJour()))` : titre « Chaque <jour> » ; ajouter une activité, en retirer un item, changer une heure → `cle("semaine_type")` change pour ce jour seulement, `chargerEtat().planning` ne change pas ;
  - le même jour de la semaine suivante, non personnalisé (`ouvrirJourneeFuture`) reflète la modification ; après l'avoir personnalisé (une modification), une nouvelle modification de la semaine type ne le touche plus ;
  - ← depuis « Chaque <jour> » ramène à l'écran Planning ; « Afficher ma journée » au menu affiche bien « Ma journée » d'aujourd'hui.

- [ ] **Step 4 : commit**

```bash
git add app/app.js
git commit -m "Permet de modifier la semaine type avec l'éditeur de journée"
```

### Task 4 : écran Planning à deux onglets

**Files :**
- Modify : `app/index.html` — `screen-parent-planning-journees` : titre « Planning », deux boutons d'onglet `#btn-onglet-semaine` / `#btn-onglet-jours` au-dessus de `#parent-planning-journees-liste`
- Modify : `app/app.js` — `construireParentPlanningJournees()`, câblage des onglets, carte du hub
- Modify : `app/styles.css` — onglets (même famille que `.btn-secondaire`, état actif en `--accent`)

**Interfaces :**
- Consumes : `NOMS_JOURS`, `chargerSemaineType()`, `libelleItemPlanning()`, `ouvrirJourSemaineType()`, `ouvrirJourneeFuture()`.
- Produces : `ongletPlanning` (`"semaine"` par défaut | `"jours"`).
  - Onglet « Semaine type » : 7 cartes « Lundi » … « Dimanche » ; à droite, les emojis des activités (`type === "aventure"`) de ce jour, ou « — » ; un tap ouvre `ouvrirJourSemaineType(j)`.
  - Onglet « Prochains jours » : liste actuelle, avec « Comme d'habitude » / « Modifié » au lieu de « Planning par défaut » / « Planning personnalisé » ; « Aujourd'hui · En cours » inchangé.
  - Carte du hub : titre « Planning », sous-titre « La semaine type, et les jours qui changent ».

- [ ] **Step 1 : HTML, rendu des deux onglets et câblage.**
- [ ] **Step 2 : vérifier** : capture des deux onglets ; une activité ajoutée au mardi apparaît sur la carte « Mardi » ; un jour personnalisé affiche « Modifié ».
- [ ] **Step 3 : commit**

```bash
git add app/index.html app/app.js app/styles.css
git commit -m "Ajoute la semaine type et les prochains jours à l'écran Planning"
```

### Task 5 : créer une sortie ou une séance depuis le planning

**Files :**
- Modify : `app/index.html` — formulaire `screen-parent-nouvelle-aventure` : bloc « Avec qui » (`#na-seance-bloc`, grille `#na-seance-grille`, masqué hors séance) ; libellé initial du bouton « Créer l'activité »
- Modify : `app/app.js` — `ouvrirNouvelleAventure()`, `ouvrirEditionAventure()`, `creerNouvelleAventure()`, `construireAjoutPlanning()`, retour du formulaire

**Interfaces :**
- Consumes : `ajouterItemPlanning(type, id)` (ajoute à la cible courante), `toutesLesPersonnes()`.
- Produces :
  - `ouvrirNouvelleAventure(options = {})` avec `options.nature` (`"sortie"` par défaut | `"seance"`) et `options.depuisPlanning` (`false` par défaut) ; l'appel sans argument (« + Nouvelle activité » de la bibliothèque) garde son comportement.
  - Variables de module `natureFormulaireActivite`, `formulaireDepuisPlanning`, `personneSeanceId`.
  - Séance : choix unique parmi `toutesLesPersonnes()` ; l'aventure créée porte `personne: { emoji, nom }` de la personne choisie et l'inclut dans `entourageIds`. Étapes préremplies si vides : « On dit bonjour », « On fait la séance », « On dit au revoir ». Entourage vide : texte « Ajoute d'abord la personne dans « Mon entourage ». », création bloquée ; aucune personne choisie : erreur « Choisis avec qui a lieu la séance. ».
  - Bouton de création : « Créer l'activité » (création), « Enregistrer les modifications » (édition) — corrige l'ancien « Créer et ajouter à aujourd'hui », qui ne faisait qu'ajouter au catalogue.
  - Après création avec `depuisPlanning` : `ajouterItemPlanning("aventure", id)`, puis retour à `screen-journee` en édition ; sinon, retour à la bibliothèque comme aujourd'hui. Même règle pour ← du formulaire.
  - `construireAjoutPlanning()` (mode édition) : deux boutons en fin de bloc, « + Nouvelle sortie » et « + Nouvelle séance ».
  - Édition d'une séance existante (`a.personne` présent) : nature « séance », personne présélectionnée par son `nom` ; `personne` conservée si rien n'est rechoisi.

- [ ] **Step 1 : formulaire et logique de création**, comme décrit.
- [ ] **Step 2 : vérifier dans le navigateur** :
  - entourage vide → « + Nouvelle séance » affiche le message, rien n'est créé, aucune erreur en console ;
  - avec une personne : séance créée depuis « Chaque mardi » → présente dans ce jour de la semaine type, `aventureParId(id).personne` défini ; lancée un jour où elle est au planning, elle mène à l'écran de séance (code praticienne) après l'arrivée ;
  - sortie créée depuis un jour à venir → présente ce jour-là seulement ;
  - « + Nouvelle activité » de la bibliothèque : bouton « Créer l'activité », l'activité n'est ajoutée à aucun jour.
- [ ] **Step 3 : commit**

```bash
git add app/index.html app/app.js
git commit -m "Crée sorties et séances depuis le planning"
```

### Task 6 : espace parent regroupé

**Files :**
- Modify : `app/app.js` — `construireEspaceParent()`
- Modify : `app/styles.css` — titre de bloc (même style que `.groupe-journee-titre`)

**Interfaces :**
- Produces : quatre blocs titrés, dans cet ordre, mêmes actions qu'aujourd'hui :
  - LA JOURNÉE : Planning ; Relancer une routine
  - LA BIBLIOTHÈQUE : Activités ; Routines ; Mon entourage
  - LE SUIVI : Historique des journées ; Notes des séances
  - RÉGLAGES : Changer le code parent ; Cet appareil
  (La spec réunit « Activités » et « Routines » en une carte : gardées séparées ici, même contenu, pour ne pas fusionner deux écrans à l'étape 1.)

- [ ] **Step 1 : rendu par blocs.**
- [ ] **Step 2 : vérifier** : capture de l'espace parent ; chaque carte ouvre le même écran qu'avant.
- [ ] **Step 3 : commit**

```bash
git add app/app.js app/styles.css
git commit -m "Regroupe l'espace parent en quatre blocs"
```

### Task 7 : documentation et vérification d'ensemble

**Files :**
- Modify : `docs/produit/fonctionnalites.md` — « Préparer le planning » : semaine type, jours « modifiés », création de sorties et de séances ; espace parent en blocs
- Modify : `docs/produit/modele-de-donnees.md` — `cle("semaine_type")`, fin du champ `date` (migration), cible de l'éditeur
- Modify : `docs/produit/concept.md` — paragraphe « Le planning est la seule source de vérité » : la journée vient de la semaine type ; supprimer « créer une activité l'ajoute immédiatement au planning »
- Modify : `app/README.md` — `semaine.js` et la commande de test

- [ ] **Step 1 : mettre à jour ces quatre documents.**
- [ ] **Step 2 : vérification d'ensemble** : `node --test tests/` passe ; dans le navigateur, parcours enfant inchangé (menu, une routine jusqu'au coffre, voiture vers une sortie, « Ma journée ») et aucune erreur en console.
- [ ] **Step 3 : commit**

```bash
git add docs/produit/fonctionnalites.md docs/produit/modele-de-donnees.md docs/produit/concept.md app/README.md
git commit -m "Documente la semaine type et la création des séances"
```
