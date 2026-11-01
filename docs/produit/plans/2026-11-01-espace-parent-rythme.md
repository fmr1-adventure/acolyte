# Espace parent : chaque activité sait quand elle revient — plan de mise en œuvre

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** une activité se règle une fois (quels jours, quelle heure, chaque semaine ou une semaine sur deux) depuis sa fiche ; la semaine type se montre jour par jour avec le rythme de chaque activité ; les quatorze prochains jours disent ce qu'ils contiennent et ce qui change ; l'accueil parent tient en cinq entrées, la bibliothèque et le suivi passent en onglets.

**Architecture :** la semaine type (`cle("semaine_type")`) reste la seule vérité. Un item `aventure` peut y porter `rythme: { toutesLes: 2, depuis }` ; `planningDuJour()` le filtre et le retire de la copie, donc tout ce qui prépare un jour en hérite sans autre changement. La fiche lit la semaine type (`quandDeLActivite`) et y écrit (`appliquerQuand`). La logique pure va dans `app/semaine.js`, testée sous Node. L'écran Planning garde ses deux onglets, mais l'onglet « Semaine type » ouvre directement l'éditeur de journée existant (`screen-journee`), avec les onglets et les puces des jours en tête. Ainsi le glisser-déposer, l'ajout et les reconstructions (`construireJournee()`) restent intacts.

**Tech Stack :** JavaScript sans framework ni dépendance, `localStorage` par profil (`cle()`), service worker ; tests avec `node --test tests/`.

**Spec :** `docs/produit/specs/2026-11-01-espace-parent-rythme-design.md`. Maquette : page « Espace parent — le rythme des activités » du canevas de conception.

## Global Constraints

- Aucune dépendance, pas de `package.json`. Tests : `node --test tests/`.
- Clés de jour `"AAAA-M-J"` sans zéro, jamais comparées comme chaînes (passer par `dateDeCle`). Jours de semaine : 1 = lundi … 7 = dimanche.
- `rythme: { toutesLes: 2, depuis: "AAAA-M-J" }`, où `depuis` est le lundi de la semaine de la première fois. Seuls les items `aventure` de la semaine type le portent. Il n'est jamais recopié dans `etat.planning` ni dans `planning_futur`.
- Aucune migration : un item sans `rythme` revient chaque semaine. `planning_futur`, `etat.planning` et le format des items ne changent pas.
- Enregistrer une fiche ne change ni aujourd'hui (`etat.planning`) ni les jours déjà dans `planning_futur`.
- Rien ne change côté enfant, sauf qu'une activité est absente les semaines où elle ne tombe pas.
- Textes exacts : « Quand ça revient », « Quels jours », « À quelle heure (facultatif) », « selon le jour », « À quel rythme », « Chaque semaine », « Une semaine sur deux », « La première fois », « ✓ oui », « pas cette fois », « Enregistrer », « Modifier », « Aujourd'hui est déjà préparé : il ne change pas. », « <Jour J mois.> a été modifié à la main : il garde son programme. », « prochaine fois : », « comme d'hab. », « modifié », « en cours », « Ordre ou heures changés », « Semaine du <J mois.> ». Les retraits sont précédés du signe moins « − » (U+2212).
- Libellés en français. Aucun prénom réel dans le code, les tests ni la doc (le dépôt est publié).
- Commentaires en français, une ligne de « pourquoi » au plus, dans le style du code voisin.
- Version 25 partout : `VERSION_APP`, `<meta name="acolyte-version">`, `CACHE_NAME` = `"acolyte-v25"`.
- Interface vérifiée dans le navigateur sur un port jamais utilisé (le service worker garde l'ancien `app.js` sur un port connu).
- `TODO.md` n'est jamais commité. Messages de commit en français, terminés par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Activité glissée à la main, puis fiche enregistrée** : sur les jours où elle était déjà, elle garde exactement sa place, sans être replacée selon l'heure. → test « garde sa place » (tâche 1).
2. **Fiche rouverte des semaines plus tard et enregistrée sans rien toucher** : la semaine type est identique, et la « première fois » proposée correspond aux semaines où l'activité a déjà lieu. → tests « enregistrer sans rien toucher » et « prochaineFois depuis un départ passé » (tâche 1).
3. **Heure laissée vide alors que les jours ont des heures différentes** : chaque jour garde la sienne ; un jour nouvellement coché sans heure se place juste avant le coucher. → test « heure vide » (tâche 1).
4. **Jour à venir modifié puis remis à l'identique** : badge « comme d'hab. » sans ligne de changement, plutôt que « modifié » sans explication. → test « differencesJour identique » (tâche 2), règle d'affichage (tâche 5).
5. **Premier jour coché changé (mardi → jeudi) en une semaine sur deux, ou tous les jours décochés** : les deux choix de « La première fois » sont recalculés, l'alternance choisie est gardée ; sans jour coché, ni première fois ni calendrier, seulement « Pas programmée… ». Aucune erreur. → vérification de la tâche 3.

---

### Task 1 : le rythme et la règle d'insertion (`semaine.js`)

**Files :**
- Modify : `app/semaine.js` (nouvelles fonctions, `planningDuJour`, `module.exports`)
- Modify : `tests/semaine.test.js`

**Interfaces :**
- Produces (fonctions globales dans le navigateur, exportées sous Node) :
  - `lundiDe(cleJour) -> string` : clé du lundi de sa semaine.
  - `tombeCeJour(rythme | null | undefined, cleJour) -> boolean` : vrai sans rythme ; sinon, l'écart en semaines entre `lundiDe(cleJour)` et `lundiDe(rythme.depuis)` est ≥ 0 et multiple de `toutesLes`.
  - `planningDuJour(semaineType, cleJour) -> Item[]` : copie du jour, sans les items dont `tombeCeJour(item.rythme, cleJour)` est faux, et sans aucun champ `rythme`.
  - `prochainesDates(jourSemaine, apresCle, n) -> string[]` : les `n` prochaines dates de ce jour de semaine, strictement après `apresCle`.
  - `prochaineFois(rythme | null, jourSemaine, apresCle) -> string` : la première de ces dates où `tombeCeJour` est vrai.
  - `placerSelonHeure(items, entree, estCoucher?) -> Item[]` : nouveau tableau avec `entree` insérée.
  - `quandDeLActivite(semaineType, id) -> Quand`, avec `Quand = { jours: number[] (croissants), heure: string | null, selonLeJour: boolean, rythme: { toutesLes, depuis } | null }`.
  - `appliquerQuand(semaineType, id, { jours, heure, rythme }, estCoucher?) -> semaineType` : nouvel objet. `heure` vaut `""` ou `null` pour garder celle de chaque jour.

- [ ] **Step 1 : écrire les tests qui échouent.** En tête de `tests/semaine.test.js`, avant le `require`, ajouter `process.env.TZ = "Europe/Paris";` pour que le test du passage à l'heure d'hiver soit réel. Puis ajouter :

```js
const R = { toutesLes: 2, depuis: "2026-11-2" };
const coucher = (it) => it.id === "soir";

test("lundiDe : le lundi de la semaine, même à cheval sur deux années", () => {
  assert.equal(S.lundiDe("2026-11-1"), "2026-10-26");
  assert.equal(S.lundiDe("2026-11-3"), "2026-11-2");
  assert.equal(S.lundiDe("2027-1-1"), "2026-12-28");
});

test("tombeCeJour : une semaine sur deux sur six semaines, rien avant la première fois", () => {
  assert.equal(S.tombeCeJour(undefined, "2026-11-10"), true);
  const mardis = ["2026-11-3", "2026-11-10", "2026-11-17", "2026-11-24", "2026-12-1", "2026-12-8"];
  assert.deepEqual(mardis.map(c => S.tombeCeJour(R, c)), [true, false, true, false, true, false]);
  assert.equal(S.tombeCeJour(R, "2026-10-27"), false);
  assert.equal(S.tombeCeJour(R, "2026-10-20"), false);
  assert.equal(S.tombeCeJour(R, "2026-11-8"), true); // dimanche de la même semaine
});

test("tombeCeJour : changement d'année et passage à l'heure d'hiver", () => {
  const nouvelAn = { toutesLes: 2, depuis: "2026-12-28" };
  assert.deepEqual(["2026-12-29", "2027-1-5", "2027-1-12"].map(c => S.tombeCeJour(nouvelAn, c)), [true, false, true]);
  const hiver = { toutesLes: 2, depuis: "2026-10-19" }; // heure d'hiver le dimanche 25
  assert.deepEqual(["2026-10-20", "2026-10-25", "2026-10-26", "2026-10-27", "2026-11-3"].map(c => S.tombeCeJour(hiver, c)), [true, true, false, false, true]);
});

test("planningDuJour : filtre selon le rythme et ne recopie pas `rythme`", () => {
  const st = S.creerSemaineType([]);
  st["2"] = [{ type: "routine", id: "r" }, { type: "aventure", id: "ortho", heure: "17:15", rythme: R }];
  assert.deepEqual(S.planningDuJour(st, "2026-11-3"), [{ type: "routine", id: "r" }, { type: "aventure", id: "ortho", heure: "17:15" }]);
  assert.deepEqual(S.planningDuJour(st, "2026-11-10"), [{ type: "routine", id: "r" }]);
  assert.deepEqual(st["2"][1].rythme, R);
});

test("prochainesDates et prochaineFois : à partir du lendemain", () => {
  assert.deepEqual(S.prochainesDates(2, "2026-11-1", 5), ["2026-11-3", "2026-11-10", "2026-11-17", "2026-11-24", "2026-12-1"]);
  assert.deepEqual(S.prochainesDates(2, "2026-11-3", 2), ["2026-11-10", "2026-11-17"]);
  assert.deepEqual(S.prochainesDates(7, "2026-11-1", 1), ["2026-11-8"]);
  assert.equal(S.prochaineFois(null, 2, "2026-11-1"), "2026-11-3");
  assert.equal(S.prochaineFois({ toutesLes: 2, depuis: "2026-11-9" }, 2, "2026-11-1"), "2026-11-10");
});

test("prochaineFois depuis un départ passé : garde l'alternance déjà en cours", () => {
  assert.equal(S.prochaineFois({ toutesLes: 2, depuis: "2026-10-5" }, 2, "2026-11-1"), "2026-11-3");
  assert.equal(S.prochaineFois({ toutesLes: 2, depuis: "2026-10-12" }, 2, "2026-11-1"), "2026-11-10");
});

const JOURNEE = [
  { type: "repas", id: "petit-dej", heure: "07:30" },
  { type: "routine", id: "habiller" },
  { type: "aventure", id: "ecole", heure: "08:30" },
  { type: "repas", id: "gouter", heure: "16:45" },
  { type: "aventure", id: "lecture", heure: "18:15" },
  { type: "repas", id: "diner", heure: "19:00" },
  { type: "routine", id: "soir" },
];

test("placerSelonHeure : avant le premier élément plus tardif, sinon avant le coucher", () => {
  const ids = (items) => items.map(i => i.id);
  assert.equal(ids(S.placerSelonHeure(JOURNEE, { type: "aventure", id: "x", heure: "17:15" }, coucher)).indexOf("x"), 4);
  assert.deepEqual(ids(S.placerSelonHeure(JOURNEE, { type: "aventure", id: "x" }, coucher)).slice(-2), ["x", "soir"]);
  assert.deepEqual(ids(S.placerSelonHeure(JOURNEE, { type: "aventure", id: "x", heure: "20:00" }, coucher)).slice(-2), ["x", "soir"]);
  const desordre = [{ type: "aventure", id: "a", heure: "10:00" }, { type: "routine", id: "soir" }, { type: "aventure", id: "b", heure: "21:00" }];
  assert.deepEqual(ids(S.placerSelonHeure(desordre, { type: "aventure", id: "x", heure: "15:00" }, coucher)), ["a", "x", "soir", "b"]);
  assert.deepEqual(ids(S.placerSelonHeure([{ type: "repas", id: "r", heure: "08:00" }], { type: "aventure", id: "x", heure: "09:00" })), ["r", "x"]);
  assert.equal(JOURNEE.length, 7);
});

test("quandDeLActivite : jours, heure commune ou « selon le jour », rythme", () => {
  const st = S.creerSemaineType([]);
  st["2"] = [{ type: "aventure", id: "ortho", heure: "17:15", rythme: R }];
  st["4"] = [{ type: "aventure", id: "ortho", heure: "17:15", rythme: R }];
  st["1"] = [{ type: "aventure", id: "ecole", heure: "08:30" }];
  st["3"] = [{ type: "aventure", id: "ecole", heure: "08:45" }, { type: "aventure", id: "lecture" }];
  assert.deepEqual(S.quandDeLActivite(st, "ortho"), { jours: [2, 4], heure: "17:15", selonLeJour: false, rythme: R });
  assert.deepEqual(S.quandDeLActivite(st, "ecole"), { jours: [1, 3], heure: null, selonLeJour: true, rythme: null });
  assert.deepEqual(S.quandDeLActivite(st, "lecture"), { jours: [3], heure: null, selonLeJour: false, rythme: null });
  assert.deepEqual(S.quandDeLActivite(st, "absente"), { jours: [], heure: null, selonLeJour: false, rythme: null });
});

test("appliquerQuand : ajout à sa place selon l'heure, avec le rythme", () => {
  const st = S.creerSemaineType(JOURNEE);
  const apres = S.appliquerQuand(st, "ortho", { jours: [2, 4], heure: "17:15", rythme: R }, coucher);
  assert.deepEqual(apres["2"][4], { type: "aventure", id: "ortho", heure: "17:15", rythme: R });
  assert.deepEqual(apres["4"][4], { type: "aventure", id: "ortho", heure: "17:15", rythme: R });
  assert.equal(apres["3"].length, 7);
  assert.equal(st["2"].length, 7);
});

test("appliquerQuand : garde sa place, met à jour heure et rythme, retire les jours décochés", () => {
  const st = S.creerSemaineType(JOURNEE);
  st["2"] = [...JOURNEE.slice(0, 6), { type: "aventure", id: "ortho", heure: "17:00", rythme: R }, JOURNEE[6]];
  st["4"] = [...JOURNEE.slice(0, 2), { type: "aventure", id: "ortho", heure: "09:00", rythme: R }, ...JOURNEE.slice(2)];
  const gardee = S.appliquerQuand(st, "ortho", { jours: [2], heure: "", rythme: null }, coucher);
  assert.deepEqual(gardee["2"][6], { type: "aventure", id: "ortho", heure: "17:00" });
  assert.equal(gardee["4"].some(i => i.id === "ortho"), false);
  const heure = S.appliquerQuand(st, "ortho", { jours: [2, 4], heure: "18:30", rythme: R }, coucher);
  assert.deepEqual(heure["2"][6], { type: "aventure", id: "ortho", heure: "18:30", rythme: R });
  assert.deepEqual(heure["4"][2], { type: "aventure", id: "ortho", heure: "18:30", rythme: R });
  const aucun = S.appliquerQuand(st, "ortho", { jours: [], heure: "", rythme: null }, coucher);
  assert.equal(Object.values(aucun).flat().some(i => i.id === "ortho"), false);
});

test("appliquerQuand : heure vide, chaque jour garde la sienne ; nouveau jour sans heure avant le coucher", () => {
  const st = S.creerSemaineType(JOURNEE);
  st["1"] = S.placerSelonHeure(JOURNEE, { type: "aventure", id: "ortho", heure: "09:00" }, coucher);
  st["3"] = S.placerSelonHeure(JOURNEE, { type: "aventure", id: "ortho", heure: "17:15" }, coucher);
  const apres = S.appliquerQuand(st, "ortho", { jours: [1, 3, 5], heure: "", rythme: null }, coucher);
  assert.equal(apres["1"].find(i => i.id === "ortho").heure, "09:00");
  assert.equal(apres["3"].find(i => i.id === "ortho").heure, "17:15");
  assert.deepEqual(apres["5"].slice(-2), [{ type: "aventure", id: "ortho" }, { type: "routine", id: "soir" }]);
});

test("appliquerQuand : enregistrer sans rien toucher ne change rien", () => {
  const st = S.creerSemaineType(JOURNEE);
  st["2"] = S.placerSelonHeure(JOURNEE, { type: "aventure", id: "ortho", heure: "17:15", rythme: R }, coucher);
  const q = S.quandDeLActivite(st, "ortho");
  assert.deepEqual(S.appliquerQuand(st, "ortho", { jours: q.jours, heure: q.heure || "", rythme: q.rythme }, coucher), st);
});
```

- [ ] **Step 2 : lancer les tests, ils échouent.**
Run : `node --test tests/`
Expected : FAIL, `S.lundiDe is not a function` (et les autres nouvelles fonctions).

- [ ] **Step 3 : implémenter dans `app/semaine.js`** les signatures ci-dessus.
  - Écart en semaines : `Math.round((dateDeCle(lundiDe(cle)) - dateDeCle(lundiDe(depuis))) / 604800000)`. L'arrondi absorbe les semaines de 167 h ou 169 h.
  - Heures comparées comme chaînes `"HH:MM"` : elles viennent toutes d'un `<input type="time">` ou de valeurs à deux chiffres.
  - `placerSelonHeure` insère à la plus petite des deux positions trouvées : le premier item dont l'heure est plus tardive, et le coucher. Si aucune n'existe, l'entrée va à la fin.
  - `prochaineFois` cherche au plus 53 semaines.
  - `appliquerQuand` repère l'activité par `type === "aventure" && id === id`. Le rythme est copié en profondeur. `rythme: null` supprime la clé.

- [ ] **Step 4 : relancer les tests, ils passent.**
Run : `node --test tests/`
Expected : tous les tests passent, 0 échec (ceux de `journee` et `recompenses` compris).

- [ ] **Step 5 : commit.**

```bash
git add app/semaine.js tests/semaine.test.js
git commit -m "Semaine type : une activité peut revenir une semaine sur deux"
```

### Task 2 : textes et différences (`semaine.js`)

**Files :**
- Modify : `app/semaine.js`, `tests/semaine.test.js`

**Interfaces :**
- Consumes : `Quand` (tâche 1).
- Produces :
  - `joursCourts(jours: number[]) -> string` : `""` sans jour, `"tous les jours"` pour les sept, sinon les trois premières lettres de `NOMS_JOURS` jointes par `", "`.
  - `etiquetteRythme(quand, jourSemaine) -> string` : « tous les jours » (chaque semaine, les sept jours), « chaque mardi », « 1 mardi sur 2 ».
  - `phraseQuand(quand, premiereFois: string) -> string` : le résumé de la fiche. `quand.heure` vaut `""` ou `null` quand il n'y a pas d'heure.
  - `differencesJour(modifie, habituel) -> { ajoutes: Item[], retires: Item[], ordreOuHeures: boolean }`.

- [ ] **Step 1 : écrire les tests qui échouent.**

```js
test("joursCourts", () => {
  assert.equal(S.joursCourts([]), "");
  assert.equal(S.joursCourts([2]), "mar");
  assert.equal(S.joursCourts([1, 2, 4, 5]), "lun, mar, jeu, ven");
  assert.equal(S.joursCourts([1, 2, 3, 4, 5, 6, 7]), "tous les jours");
});

test("etiquetteRythme", () => {
  assert.equal(S.etiquetteRythme({ jours: [1, 2, 3, 4, 5, 6, 7], rythme: null }, 3), "tous les jours");
  assert.equal(S.etiquetteRythme({ jours: [2], rythme: null }, 2), "chaque mardi");
  assert.equal(S.etiquetteRythme({ jours: [2, 4], rythme: R }, 4), "1 jeudi sur 2");
  assert.equal(S.etiquetteRythme({ jours: [1, 2, 3, 4, 5, 6, 7], rythme: R }, 3), "1 mercredi sur 2");
});

test("phraseQuand", () => {
  const p = "mar. 3 nov.";
  assert.equal(S.phraseQuand({ jours: [], heure: "", rythme: null }, p), "Pas programmée : elle reste dans la bibliothèque.");
  assert.equal(S.phraseQuand({ jours: [2], heure: "17:15", rythme: null }, p), "Chaque mardi à 17:15.");
  assert.equal(S.phraseQuand({ jours: [2], heure: "", rythme: null }, p), "Chaque mardi.");
  assert.equal(S.phraseQuand({ jours: [2, 4], heure: "17:15", rythme: null }, p), "Chaque mardi et jeudi à 17:15.");
  assert.equal(S.phraseQuand({ jours: [1, 2, 3, 4, 5, 6, 7], heure: "18:15", rythme: null }, p), "Tous les jours à 18:15.");
  assert.equal(S.phraseQuand({ jours: [2], heure: "17:15", rythme: R }, p), "Un mardi sur deux à 17:15. Première fois : mar. 3 nov.");
  assert.equal(S.phraseQuand({ jours: [2, 4], heure: "17:15", rythme: R }, p), "Une semaine sur deux, le mardi et le jeudi, à 17:15. Première fois : mar. 3 nov.");
  assert.equal(S.phraseQuand({ jours: [2, 4, 5], heure: null, rythme: R }, p), "Une semaine sur deux, le mardi, le jeudi et le vendredi. Première fois : mar. 3 nov.");
});

test("differencesJour : ajouts, retraits, info, moment au choix, ordre seul, identique", () => {
  const habituel = [{ type: "repas", id: "gouter", heure: "16:45" }, { type: "aventure", id: "piscine" }, { type: "aventure", id: "lecture", heure: "18:15" }, { type: "routine", id: "soir" }];
  const anniv = { type: "aventure", id: "anniv", heure: "18:00" };
  const info = { type: "note", texte: "Mamie vient au goûter" };
  const r = S.differencesJour([habituel[0], habituel[2], anniv, info, habituel[3]], habituel);
  assert.deepEqual(r, { ajoutes: [anniv, info], retires: [habituel[1]], ordreOuHeures: false });
  const autreInfo = S.differencesJour([...habituel, { type: "note", texte: "Autre" }], [...habituel, info]);
  assert.equal(autreInfo.ajoutes.length, 1);
  assert.equal(autreInfo.retires.length, 1);
  const choix = { type: "choix", options: ["velo", "lego"] };
  assert.deepEqual(S.differencesJour([...habituel, { ...choix, choisi: "velo" }], [...habituel, choix]), { ajoutes: [], retires: [], ordreOuHeures: false });
  const ordre = S.differencesJour([habituel[2], habituel[0], habituel[1], habituel[3]], habituel);
  assert.deepEqual(ordre, { ajoutes: [], retires: [], ordreOuHeures: true });
  const heure = S.differencesJour([habituel[0], habituel[1], { ...habituel[2], heure: "18:30" }, habituel[3]], habituel);
  assert.equal(heure.ordreOuHeures, true);
  assert.deepEqual(S.differencesJour(habituel, habituel), { ajoutes: [], retires: [], ordreOuHeures: false });
});
```

- [ ] **Step 2 : lancer les tests, ils échouent.**
Run : `node --test tests/`
Expected : FAIL, `S.joursCourts is not a function`.

- [ ] **Step 3 : implémenter.**
  - Clé de comparaison d'un item dans `differencesJour` :
    - `type + ":" + id` pour une routine, une aventure ou un repas ;
    - `"note:" + texte` pour une info ;
    - `"choix:" + options.join(",")` pour un moment au choix ;
    - `fait`, `passe` et `choisi` sont ignorés.
  - `ordreOuHeures` porte sur les éléments communs aux deux jours : il est vrai si leur ordre diffère, ou si une heure diffère pour la même clé.
  - Dans les phrases, les listes de jours sont jointes par `", "` et `" et "`. On écrit « Tous les jours » seulement pour les sept jours, chaque semaine.

- [ ] **Step 4 : relancer les tests, ils passent.**
Run : `node --test tests/`
Expected : 0 échec.

- [ ] **Step 5 : commit.**

```bash
git add app/semaine.js tests/semaine.test.js
git commit -m "Semaine type : étiquettes, résumé du rythme et différences d'un jour"
```

### Task 3 : la fiche « Quand ça revient » et la liste des activités

**Files :**
- Modify : `app/index.html` (nouvel écran `screen-parent-fiche-activite`, après `screen-parent-activites`)
- Modify : `app/app.js` :
  - nouvelles fonctions de la fiche ;
  - `dateCourte` et `dateMoyenne` à côté de `dateLisible` ;
  - `construireParentActivites()`, `quitterFormulaireActivite()` et `creerNouvelleAventure()` (branche création) ;
  - les gestionnaires en bas de fichier.
- Modify : `app/styles.css`

**Interfaces :**
- Consumes : tâches 1 et 2 (fonctions globales de `semaine.js`, `dateDeCle` compris).
- Produces :
  - `dateCourte(cleJour) -> string` : `toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })`, soit « mar. 3 nov. ».
  - `dateMoyenne(cleJour) -> string` : `{ weekday: "long", day: "numeric", month: "short" }` avec une majuscule, soit « Mardi 10 nov. ».
  - `ouvrirFicheActivite(id: string, depuisJour?: 1…7)` : sans `depuisJour`, le retour mène à la bibliothèque ; avec, il mène à ce jour de la semaine type (`ouvrirJourSemaineType(depuisJour)`).
  - Classes CSS `.puces-jours` (grille de 7), `.puce-jour` et `.puce-jour.actif`, réutilisées par la tâche 4.

- [ ] **Step 1 : l'écran et ses styles.**
  - Écran : `<div id="screen-parent-fiche-activite" class="screen">` contient une `barre-haut` avec `btn-retour-fiche-activite` (←, `aria-label="Retour"`) et le titre `#titre-fiche-activite`, puis `<div id="parent-fiche-contenu"></div>`.
  - Styles, avec les jetons existants, angles droits et ombres franches comme la maquette :
    - `.bloc-quand` (bordure `--accent`) ;
    - `.puces-jours` / `.puce-jour` (44 px de haut ; `.actif` en `--accent`) ;
    - `.calendrier-quand`, `.semaine-quand` (pointillés) et `.semaine-quand.oui` ;
    - `.resume-quand` (filet gauche `--accent`) ;
    - `.info-quand` (pointillés).
  - Les choix « Chaque semaine / Une semaine sur deux » et « La première fois » réutilisent `.onglets-planning` / `.onglet-planning`.

- [ ] **Step 2 : la fiche.**
  - État : `let ficheActivite = null;` contient `{ id, depuisJour, avant: Quand, jours, heure, rythme: "semaine" | "deux", depuis: string | null }`.
  - `ouvrirFicheActivite(id, depuisJour)` initialise ce brouillon depuis `quandDeLActivite(chargerSemaineType(), id)`, construit l'écran puis l'affiche.
  - `quandDeLaFiche() -> { jours, heure, rythme }` donne le rythme `{ toutesLes: 2, depuis }` en « une semaine sur deux », sinon `null`. Par défaut, `depuis` vaut `lundiDe(prochainesDates(premierJour, cleJour(), 1)[0])`.
  - `construireFicheActivite()` affiche, dans l'ordre :
    1. un en-tête : emoji, nom (`aventureParId(id).lieu`, aussi dans le titre de l'écran), nature (même libellé que le formulaire), et un bouton « Modifier » → `ouvrirEditionAventure(id)` ;
    2. le titre de groupe « QUAND ÇA REVIENT » ;
    3. le bloc : « Quels jours » (7 puces L M M J V S D, `aria-pressed`, nom complet en `aria-label`) ;
    4. « À quelle heure (facultatif) », suivi de « — selon le jour » si `avant.selonLeJour` et que le champ est vide ; un `<input type="time">`, enregistré au `change` dans le brouillon, sans reconstruire l'écran ;
    5. « À quel rythme » ;
    6. en « une semaine sur deux » avec au moins un jour coché, « La première fois » : deux boutons `dateCourte` de `prochainesDates(premierJour, cleJour(), 2)`. Celui pour lequel `tombeCeJour` est vrai est actif ; un appui pose `depuis = lundiDe(date)` ;
    7. dès qu'un jour est coché, le calendrier des cinq `prochainesDates(premierJour, cleJour(), 5)`, chacune avec « ✓ oui » ou « pas cette fois » ;
    8. la phrase `phraseQuand(quandDeLaFiche(), dateCourte(prochaineFois(rythme, premierJour, cleJour())))` ;
    9. sous le bloc, les infos `.info-quand` sur les jours « concernés », c'est-à-dire l'union de `avant.jours` et des jours cochés :
       - le message sur aujourd'hui si `jourSemaineDe(cleJour())` en fait partie ;
       - une ligne `dateMoyenne(c) + " a été modifié à la main : il garde son programme."` pour chaque clé de `chargerPlanningFutur()` postérieure à aujourd'hui, dont le jour de semaine est concerné, triées par date ;
    10. le bouton « Enregistrer ».

    Chaque appui sur une puce ou un choix modifie le brouillon puis reconstruit l'écran.
  - `enregistrerFicheActivite()` : `sauverSemaineType(appliquerQuand(chargerSemaineType(), id, quandDeLaFiche(), estItemCoucher))`, puis `quitterFicheActivite()`.
  - `quitterFicheActivite()` remet `ficheActivite` à `null`, puis va à `ouvrirJourSemaineType(depuisJour)` ou à la bibliothèque (`construireParentActivites()` + `screen-parent-activites`).

- [ ] **Step 3 : brancher la fiche.**
  - `btn-retour-fiche-activite` → `quitterFicheActivite`.
  - Dans `quitterFormulaireActivite()`, juste après la branche `formulaireDepuisPlanning` : si `ficheActivite`, reconstruire la fiche et l'afficher.
  - Dans `creerNouvelleAventure()`, branche création :
    - depuis le planning, rien ne change (`ajouterItemPlanning` puis `quitterFormulaireActivite()`) ;
    - sinon, mettre `aventureEnEditionId = null` puis appeler `ouvrirFicheActivite(nouvelle.id)`.
  - `construireParentActivites()` : chaque ligne est un bouton qui ouvre la fiche (le ✏️ disparaît).
    - Elle montre emoji et nom, puis une sous-ligne : `joursCourts(q.jours)`, l'heure si elle est commune, et en une semaine sur deux `"prochaine fois " + dateCourte(...)` (la plus proche parmi les jours cochés). Les morceaux sont joints par `" · "`.
    - Elle porte une étiquette : « pas programmée » sans jour, « 1 sur 2 » (`.tag-rythme.deux`), sinon « chaque semaine ».

- [ ] **Step 4 : vérifier dans le navigateur.** Ajouter une configuration `.claude/launch.json` sur un port jamais utilisé et vérifier dans le panneau navigateur :
  1. Ouvrir une activité depuis la bibliothèque, cocher mardi, choisir « Une semaine sur deux », la première fois au deuxième choix. Le calendrier montre « pas cette fois » puis « ✓ oui », en alternance. Enregistrer, puis rouvrir : tout est repris.
  2. Passer du mardi au jeudi : les choix et le calendrier suivent, l'alternance est gardée. Tout décocher : seulement « Pas programmée… ». Recocher, puis remettre « Chaque semaine ».
  3. Modifier une date à venir concernée dans « Prochains jours » : la fiche affiche la ligne « … a été modifié à la main… ».
  4. « Modifier » ramène à la fiche après mise à jour ; une nouvelle activité créée depuis la bibliothèque ouvre sa fiche.
  5. `read_console_messages` ne montre aucune erreur.

- [ ] **Step 5 : commit.**

```bash
git add app/index.html app/app.js app/styles.css
git commit -m "Fiche d'activité : quand elle revient, chaque semaine ou une sur deux"
```

### Task 4 : la semaine type, un jour à la fois

**Files :**
- Modify : `app/index.html` (en-tête `#journee-entete-semaine` dans `screen-journee`, sous la `barre-haut`)
- Modify : `app/app.js` :
  - `construireJournee()`, `ouvrirJourSemaineType()`, `construireParentPlanningJournees()` (la branche « semaine » disparaît) ;
  - le gestionnaire `btn-retour-menu-journee` et ceux des onglets ;
  - nouvelles fonctions `ouvrirPlanning()` et `jourSemainePlanning`.
- Modify : `app/styles.css` (`.tag-rythme`, `.tag-rythme.deux`)

**Interfaces :**
- Consumes : `ouvrirFicheActivite(id, depuisJour)`, `.puces-jours` (tâche 3) ; `quandDeLActivite`, `etiquetteRythme`, `prochaineFois` (tâches 1 et 2).
- Produces :
  - `ouvrirPlanning()` : ouvre l'onglet `ongletPlanning`, sur le jour de semaine `jourSemainePlanning` (par défaut celui d'aujourd'hui). La tâche 6 l'utilise pour l'accueil.

- [ ] **Step 1 : l'en-tête.** `<div id="journee-entete-semaine" class="hidden">` contient :
  - les onglets `.onglets-planning` : « Semaine type » (actif) et `btn-onglet-jours-semaine` « Prochains jours » ;
  - `<div class="puces-jours" id="journee-puces-jours"></div>` ;
  - `<div class="groupe-journee-titre" id="journee-titre-jour"></div>`.

- [ ] **Step 2 : `ouvrirJourSemaineType(jour)` et `ouvrirPlanning()`.**
  - `let jourSemainePlanning = null;` est gardé d'une visite à l'autre, comme `ongletPlanning`.
  - `ouvrirJourSemaineType(jour)` pose `jourSemainePlanning = jour` et `ongletPlanning = "semaine"`, puis fait le reste comme aujourd'hui.
  - `ouvrirPlanning()` : sur l'onglet `"semaine"`, `ouvrirJourSemaineType(jourSemainePlanning || jourSemaineDe(cleJour()))` ; sinon `construireParentPlanningJournees()` et l'écran du planning.
  - Câblage :
    - `btn-onglet-semaine` → `ongletPlanning = "semaine"; ouvrirPlanning();` ;
    - `btn-onglet-jours-semaine` → `ongletPlanning = "jours"; ouvrirPlanning();` ;
    - l'entrée « Planning » de l'accueil actuel → `ouvrirPlanning()`.

- [ ] **Step 3 : `construireJournee()` sur un jour de la semaine type.**
  - L'en-tête n'est visible que si `planningCible.jourSemaine`. Le titre devient alors « Planning ».
  - Les puces L M M J V S D s'affichent, celle du jour active ; un appui ouvre `ouvrirJourSemaineType(i + 1)`.
  - `journee-titre-jour` affiche « Chaque mardi ».
  - Chaque ligne `aventure` reçoit une étiquette, un `<button class="tag-rythme">` (avec `.deux` en une semaine sur deux). Son texte est `etiquetteRythme(quandDeLActivite(st, item.id), jour)` et un appui ouvre `ouvrirFicheActivite(item.id, jour)`.
  - En une semaine sur deux, une sous-ligne `texte-journee-reveil` affiche « prochaine fois : » + `dateCourte(prochaineFois(item.rythme, jour, cleJour()))`.
  - Pour aujourd'hui et pour un jour à venir, rien ne change.

- [ ] **Step 4 : le retour.** `btn-retour-menu-journee` :
  - sur un jour de la semaine type, il mène à l'accueil parent (`construireEspaceParent()` + `screen-parent`) ;
  - sur un jour à venir, au planning (onglet « Prochains jours ») comme aujourd'hui ;
  - sur aujourd'hui, au menu.

- [ ] **Step 5 : vérifier dans le navigateur** (port neuf).
  1. Planning s'ouvre directement sur le jour d'aujourd'hui, et les puces changent de jour.
  2. Le glisser-déposer, l'heure, le retrait et « Ajouter à la journée » marchent comme avant ; une activité ajoutée ici porte « chaque mardi ».
  3. L'étiquette de l'activité réglée à la tâche 3 affiche « 1 mardi sur 2 » et « prochaine fois : … ». Un appui ouvre sa fiche, et ← y ramène.
  4. « Prochains jours » puis « Semaine type » ramène au même jour ; ← mène à l'accueil.
  5. Aucune erreur dans la console.

- [ ] **Step 6 : commit.**

```bash
git add app/index.html app/app.js app/styles.css
git commit -m "Planning : la semaine type s'ouvre jour par jour, avec le rythme de chaque activité"
```

### Task 5 : les quatorze prochains jours

**Files :**
- Modify : `app/app.js` (`JOURS_PLANNING_FUTUR = 14`, `construireParentPlanningJournees()`, nouvelles fonctions `emojisDuJour` et `libelleChangement`)
- Modify : `app/styles.css` (`.carte-jour`, `.carte-jour.modifie`, `.badge-jour`, `.badge-jour.change`, `.carte-jour-change`)

**Interfaces :**
- Consumes : `differencesJour`, `lundiDe` (tâches 1 et 2) ; `dateCourte` (tâche 3) ; `planningParDefaut`, `chargerPlanningFutur`, `libelleItemPlanning`.
- Produces :
  - `emojisDuJour(items) -> string` : emojis des items `aventure`, `choix` et `note`, dans l'ordre, séparés par une espace ; les références orphelines sont ignorées.
  - `libelleChangement(item) -> string` : `« Info : « texte » »` pour une info, sinon le nom ; suivi de `", " + heure` si l'item en a une.

- [ ] **Step 1 : la carte « Aujourd'hui ».** Nom « Aujourd'hui », `emojisDuJour(chargerEtat().planning)`, badge « en cours ». Un appui fait la même chose qu'aujourd'hui.

- [ ] **Step 2 : les quatorze jours.**
  - Pour `i = 1 … 14` :
    - `habituel = planningParDefaut(cle)` ;
    - `futur[cle]` s'il existe, sinon `habituel` ;
    - `d = differencesJour(futur[cle], habituel)` si le jour est dans `planning_futur`.
  - Le jour est « modifié » seulement si `d` contient un ajout, un retrait ou `ordreOuHeures`. Sinon, badge « comme d'hab. ».
  - Un titre de groupe `"Semaine du " + toLocaleDateString("fr-FR", { day: "numeric", month: "short" })` de `lundiDe(cle)` s'insère à chaque changement de lundi.
  - Chaque carte affiche :
    - `dateCourte(cle)`, `emojisDuJour(contenu)` et le badge ;
    - puis, pour un jour modifié, une ligne `"+ " + libelleChangement(item)` par ajout et une ligne `"− " + libelleChangement(item)` par retrait, ou « Ordre ou heures changés » s'il n'y a ni ajout ni retrait.
  - Un appui ouvre `ouvrirJourneeFuture(cle)`.

- [ ] **Step 3 : vérifier dans le navigateur** (port neuf).
  1. Quatorze jours, en deux ou trois groupes « Semaine du … ». L'activité une semaine sur deux n'apparaît qu'une semaine sur deux.
  2. Ajouter une sortie à un jour à venir donne « modifié » et « + … ». Retirer une activité d'un autre jour donne « − … ». Échanger deux éléments donne « Ordre ou heures changés ». Défaire tous les changements ramène à « comme d'hab. ».
  3. Régler à nouveau la fiche ne change pas un jour modifié ; sa liste de différences tient compte de la nouvelle semaine type.
  4. Aucune erreur dans la console.

- [ ] **Step 4 : commit.**

```bash
git add app/app.js app/styles.css
git commit -m "Prochains jours : deux semaines, ce que contient chaque jour et ce qui change"
```

### Task 6 : accueil à cinq entrées, bibliothèque et suivi en onglets

**Files :**
- Modify : `app/app.js` (`construireEspaceParent()`, nouvelles `ONGLETS_PARENT` et `ouvrirOnglet()`, câblage des `[data-onglet]`)
- Modify : `app/index.html` (barres d'onglets et titres de cinq écrans)
- Modify : `app/styles.css` (`.reglages-parent` : deux petits boutons côte à côte)

**Interfaces :**
- Consumes : `ouvrirPlanning()` (tâche 4).
- Produces :
  - `ouvrirOnglet(nom: "activites" | "routines" | "entourage" | "journees" | "seances")` : construit l'écran correspondant puis l'affiche. La correspondance est dans `ONGLETS_PARENT` :

    | Onglet | Construit par | Écran |
    |---|---|---|
    | `activites` | `construireParentActivites` | `screen-parent-activites` |
    | `routines` | `construireRoutinesCatalogue` | `screen-parent-routines-catalogue` |
    | `entourage` | `construireParentEntourage` | `screen-parent-entourage` |
    | `journees` | `construireHistorique` | `screen-parent-historique` |
    | `seances` | `construireParentSeances` | `screen-parent-seances` |

- [ ] **Step 1 : les onglets.**
  - Les trois écrans de la bibliothèque prennent le titre « Bibliothèque ». Chacun reçoit, sous sa `barre-haut`, une barre `.onglets-planning` de trois boutons `.onglet-planning` (`data-onglet="activites|routines|entourage"`, libellés « Activités », « Routines », « Entourage »). Celui de l'écran est `actif`, avec `aria-selected="true"`.
  - De même, l'historique et les séances prennent le titre « Journées et séances », avec deux onglets « Journées » (`journees`) et « Séances » (`seances`).
  - À l'initialisation, chaque `[data-onglet]` reçoit `onclick = () => ouvrirOnglet(b.dataset.onglet)`.
  - Les retours (←) mènent déjà à l'accueil et ne changent pas.

- [ ] **Step 2 : l'accueil.** `construireEspaceParent()` affiche quatre blocs, dans cet ordre :

  | Bloc | Entrée | Sous-titre | Action |
  |---|---|---|---|
  | LA JOURNÉE | 🗓️ Planning | « La semaine type, et les deux semaines à venir » | `ouvrirPlanning()` |
  | LA JOURNÉE | 🔁 Relancer une routine | sous-titre actuel | inchangée |
  | LA BIBLIOTHÈQUE | 🧰 Activités, routines, entourage | « Tout ce qui existe, et quand ça revient » | `ouvrirOnglet("activites")` |
  | LES RÉCOMPENSES | 🏆 Chemin et récompenses | sous-titre actuel, avec « à donner » | inchangée |
  | LE SUIVI | 📅 Journées et séances | « L'historique, et ce que les praticiennes ont noté » | `ouvrirOnglet("journees")` |

  Puis le titre « RÉGLAGES » et une ligne `.reglages-parent` de deux `.btn-secondaire` : « 🔑 Code parent » → `demarrerChangementCode()`, et « 📱 Cet appareil » → `construireParentAppareil()` + `screen-parent-appareil`. Le commentaire en tête de la fonction est mis à jour.

- [ ] **Step 3 : vérifier dans le navigateur** (port neuf).
  1. L'accueil montre cinq entrées et deux petits boutons.
  2. Les onglets de la bibliothèque et du suivi basculent sans repasser par l'accueil, et ← mène toujours à l'accueil.
  3. « + Nouvelle routine » et « + Nouvelle personne » reviennent sur leur onglet.
  4. Le badge « à donner » est toujours là.
  5. Aucune erreur dans la console.

- [ ] **Step 4 : commit.**

```bash
git add app/app.js app/index.html app/styles.css
git commit -m "Espace parent : cinq entrées, bibliothèque et suivi en onglets"
```

### Task 7 : version 25, documentation, vérification d'ensemble

**Files :**
- Modify : `app/app.js` (`VERSION_APP = "25"`), `app/index.html` (meta `acolyte-version` 25), `app/sw.js` (`CACHE_NAME = "acolyte-v25"`)
- Modify : `docs/produit/fonctionnalites.md` (« Préparer une journée (côté parents) » et « L'espace parent »)

- [ ] **Step 1 : version 25** aux trois endroits.

- [ ] **Step 2 : `fonctionnalites.md`.** Le document reste non technique. Décrire :
  - la fiche d'une activité et « Quand ça revient » (chaque semaine ou une semaine sur deux, première fois, rien ne bouge pour aujourd'hui ni pour les jours modifiés) ;
  - la semaine type montrée jour par jour avec ses étiquettes ;
  - les quatorze prochains jours avec ce qui change ;
  - l'accueil en cinq entrées ;
  - la bibliothèque et le suivi en onglets.

  Remplacer « aujourd'hui et les 7 jours suivants » et « rangé en cinq blocs… ».

- [ ] **Step 3 : vérification d'ensemble.**
  - `node --test tests/` : 0 échec.
  - Dans le navigateur, sur un port neuf, dérouler la section 6 de la spec :
    1. Régler une activité un mardi sur deux, puis vérifier les quatorze prochains jours et l'étiquette de la semaine type.
    2. Aujourd'hui et un jour déjà modifié ne bougent pas, et la fiche le signale.
    3. Vérifier l'accueil, les onglets et les retours.
  - Passer sur l'autre profil (« Cet appareil ») : le rythme réglé sur le premier n'y apparaît pas.
  - Côté enfant, la liste du jour s'ouvre normalement.
  - Aucune erreur dans la console. Joindre une capture de la fiche et des prochains jours.

- [ ] **Step 4 : commit.**

```bash
git add app/app.js app/index.html app/sw.js docs/produit/fonctionnalites.md
git commit -m "Version 25 : le rythme des activités, et la doc à jour"
```

- [ ] **Step 5 : publier la branche.** Pousser `feat/espace-parent-rythme` et ouvrir la PR vers `dev` dans `fmr1-adventure/dayrise`. La description se termine par la ligne d'attribution. Le parent fusionne lui-même.
