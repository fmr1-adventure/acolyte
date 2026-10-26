const test = require("node:test");
const assert = require("node:assert/strict");
const J = require("../app/journee.js");

// Journée type : petit-déjeuner, S'habiller, Se préparer, déjeuner, coucher.
function journee() {
  return [
    { type: "repas", id: "petit-dej" },
    { type: "routine", id: "shabiller" },
    { type: "routine", id: "partir" },
    { type: "repas", id: "dejeuner" },
    { type: "routine", id: "soir" },
  ];
}
// Le coucher est la seule routine débloquée par l'heure.
const horaire = (heureAtteinte) => (item) => (item.id === "soir" ? heureAtteinte : null);
const NOMS = { "petit-dej": "Petit-déjeuner", shabiller: "S'habiller", partir: "Se préparer à partir", dejeuner: "Déjeuner", soir: "Aller se coucher", lecture: "Lecture" };
const nomDe = (item) => NOMS[item.id];

test("estAFaire : routines et aventures seulement", () => {
  assert.equal(J.estAFaire({ type: "routine", id: "a" }), true);
  assert.equal(J.estAFaire({ type: "aventure", id: "a" }), true);
  assert.equal(J.estAFaire({ type: "repas", id: "a" }), false);
});

test("journée neuve : maintenant = première routine, le repas d'avant est passé", () => {
  const r = J.statutsJournee(journee(), horaire(false));
  assert.equal(r.maintenant, 1);
  assert.equal(r.apres, 2);
  assert.equal(r.verrouille, false);
  assert.deepEqual(r.statuts, ["repere-passe", "maintenant", "apres", "plus-tard", "plus-tard"]);
});

test("un item fait fait avancer maintenant", () => {
  const p = journee();
  p[1].fait = true;
  const r = J.statutsJournee(p, horaire(false));
  assert.equal(r.maintenant, 2);
  assert.equal(r.apres, 3);
  assert.deepEqual(r.statuts, ["repere-passe", "fait", "maintenant", "apres", "plus-tard"]);
});

test("le coucher débloqué passe devant ce qui n'est pas fait", () => {
  const r = J.statutsJournee(journee(), horaire(true));
  assert.equal(r.maintenant, 4);
  assert.equal(r.apres, null);
  assert.equal(r.verrouille, false);
  assert.deepEqual(r.statuts, ["repere-passe", "rate", "rate", "repere-passe", "maintenant"]);
});

test("tout fait sauf le coucher avant son heure : maintenant verrouillé", () => {
  const p = journee();
  p[1].fait = true;
  p[2].fait = true;
  const r = J.statutsJournee(p, horaire(false));
  assert.equal(r.maintenant, 4);
  assert.equal(r.verrouille, true);
  assert.deepEqual(r.statuts, ["repere-passe", "fait", "fait", "repere-passe", "maintenant"]);
});

test("un item sauté n'est jamais maintenant", () => {
  const p = journee();
  p[1].passe = true;
  const r = J.statutsJournee(p, horaire(false));
  assert.equal(r.maintenant, 2);
  assert.equal(r.statuts[1], "passe");
});

test("tout est fait : plus de maintenant, le repas d'après reste à venir", () => {
  const p = [
    { type: "routine", id: "shabiller", fait: true },
    { type: "repas", id: "dejeuner" },
  ];
  const r = J.statutsJournee(p, horaire(false));
  assert.equal(r.maintenant, null);
  assert.equal(r.apres, 1);
  assert.deepEqual(r.statuts, ["fait", "apres"]);
});

test("phrases lues dans l'ordre, chacune avec son index", () => {
  const p = journee();
  p[1].fait = true;
  const r = J.statutsJournee(p, horaire(false));
  assert.deepEqual(J.phrasesJournee(p, r, nomDe), [
    { index: 0, texte: "C'est fait : Petit-déjeuner." },
    { index: 1, texte: "S'habiller." },
    { index: 2, texte: "Maintenant : Se préparer à partir." },
    { index: 3, texte: "Après : Déjeuner." },
    { index: 4, texte: "Ensuite : Aller se coucher." },
  ]);
});

test("phrases : ni les items sautés ni ceux pas faits", () => {
  const p = journee();
  p[0].passe = true;
  const r = J.statutsJournee(p, horaire(true));
  const lues = J.phrasesJournee(p, r, nomDe).map(ph => ph.index);
  assert.deepEqual(lues, [3, 4]);
});

test("phrases : journée vide", () => {
  const r = J.statutsJournee([], horaire(false));
  assert.deepEqual(J.phrasesJournee([], r, nomDe), [{ index: null, texte: "Rien de prévu aujourd'hui." }]);
});

test("phraseMaintenant dans ses quatre cas", () => {
  const p = journee();
  assert.equal(J.phraseMaintenant(p, J.statutsJournee(p, horaire(false)), nomDe), "Maintenant : S'habiller. Après : Se préparer à partir.");
  assert.equal(J.phraseMaintenant(p, J.statutsJournee(p, horaire(true)), nomDe), "Maintenant : Aller se coucher.");
  const fini = [{ type: "routine", id: "shabiller", fait: true }, { type: "repas", id: "dejeuner" }];
  assert.equal(J.phraseMaintenant(fini, J.statutsJournee(fini, horaire(false)), nomDe), "Après : Déjeuner.");
  const toutFait = [{ type: "routine", id: "shabiller", fait: true }];
  assert.equal(J.phraseMaintenant(toutFait, J.statutsJournee(toutFait, horaire(false)), nomDe), "Tout est fait pour aujourd'hui !");
  assert.equal(J.phraseMaintenant([], J.statutsJournee([], horaire(false)), nomDe), "Rien de prévu aujourd'hui.");
});

test("phrases : ce qui est fait est lu d'abord, même placé plus loin", () => {
  const p = journee();
  p[2].fait = true; // refait plus tard après une relance de S'habiller
  const r = J.statutsJournee(p, horaire(false));
  assert.deepEqual(J.phrasesJournee(p, r, nomDe).map(ph => ph.index), [0, 2, 1, 3, 4]);
});

test("indexAMarquer saute les items faits et sautés", () => {
  const p = [
    { type: "routine", id: "partir", fait: true },
    { type: "routine", id: "partir", passe: true },
    { type: "aventure", id: "partir" },
    { type: "routine", id: "partir" },
  ];
  assert.equal(J.indexAMarquer(p, "routine", "partir"), 3);
  assert.equal(J.indexAMarquer(p, "routine", "absente"), -1);
});

test("un moment au choix est à faire, une info est un repère", () => {
  assert.equal(J.estAFaire({ type: "choix", options: ["a", "b"] }), true);
  assert.equal(J.estAFaire({ type: "note", texte: "Maman vient te chercher" }), false);
  const p = [
    { type: "note", texte: "Maman vient te chercher" },
    { type: "choix", options: ["velo", "lego"] },
  ];
  const r = J.statutsJournee(p, () => null);
  assert.equal(r.maintenant, 1);
  assert.equal(r.statuts[0], "repere-passe");
});

test("indexAMarquer trouve aussi l'activité choisie d'un moment au choix", () => {
  const p = [
    { type: "choix", options: ["velo", "lego"], choisi: "lego" },
    { type: "aventure", id: "lego" },
  ];
  assert.equal(J.indexAMarquer(p, "aventure", "lego"), 0);
  p[0].fait = true;
  assert.equal(J.indexAMarquer(p, "aventure", "lego"), 1);
  assert.equal(J.indexAMarquer([{ type: "choix", options: ["velo"] }], "aventure", "velo"), -1);
});

test("une info passée n'est pas lue, une info à venir l'est", () => {
  const p = [
    { type: "note", texte: "Papi passe ce matin" },
    { type: "routine", id: "shabiller" },
    { type: "note", texte: "Maman vient te chercher" },
  ];
  const r = J.statutsJournee(p, () => null);
  const nom = (it) => it.type === "note" ? it.texte : NOMS[it.id];
  assert.deepEqual(J.phrasesJournee(p, r, nom).map(ph => ph.texte), ["Maintenant : S'habiller.", "Après : Maman vient te chercher."]);
});

test("pas de double ponctuation quand le texte en a déjà une", () => {
  const p = [{ type: "routine", id: "shabiller" }, { type: "note", texte: "Maman vient te chercher." }, { type: "note", texte: "On va au parc !" }];
  const r = J.statutsJournee(p, () => null);
  const nom = (it) => it.type === "note" ? it.texte : NOMS[it.id];
  assert.equal(J.phraseMaintenant(p, r, nom), "Maintenant : S'habiller. Après : Maman vient te chercher.");
  assert.deepEqual(J.phrasesJournee(p, r, nom).map(ph => ph.texte).slice(1), ["Après : Maman vient te chercher.", "Ensuite : On va au parc !"]);
});
