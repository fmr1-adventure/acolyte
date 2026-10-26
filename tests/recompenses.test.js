const test = require("node:test");
const assert = require("node:assert/strict");
const R = require("../app/recompenses.js");

test("verserEtoiles : la jauge pleine donne une pièce, l'étoile en trop reste", () => {
  assert.deepEqual(R.verserEtoiles(18, 3, 20), {
    dansLaJauge: 1, pieces: 1,
    etapes: [{ dans: 19, piece: false }, { dans: 20, piece: true }, { dans: 1, piece: false }],
  });
  const r = R.verserEtoiles(0, 45, 20);
  assert.equal(r.dansLaJauge, 5);
  assert.equal(r.pieces, 2);
  assert.equal(r.etapes.length, 45);
});

test("verserEtoiles : une jauge déjà au-dessus du seuil (seuil baissé) donne la pièce tout de suite", () => {
  assert.deepEqual(R.verserEtoiles(25, 0, 20), { dansLaJauge: 5, pieces: 1, etapes: [] });
  assert.deepEqual(R.verserEtoiles(12, 0, 10), { dansLaJauge: 2, pieces: 1, etapes: [] });
});

test("decouverteDisponible : seulement s'il y a des étoiles et à partir de l'heure", () => {
  assert.equal(R.decouverteDisponible({ dansLaJauge: 0, aDecouvrir: 3 }, "08:29", "08:30"), false);
  assert.equal(R.decouverteDisponible({ dansLaJauge: 0, aDecouvrir: 3 }, "08:30", "08:30"), true);
  assert.equal(R.decouverteDisponible({ dansLaJauge: 4, aDecouvrir: 0 }, "12:00", "08:30"), false);
});

test("normaliserChemin : valeurs par défaut et bornes", () => {
  const c = R.normaliserChemin(null);
  assert.equal(c.cases, 20);
  assert.equal(c.etoilesParPiece, 20);
  assert.equal(c.heureDecouverte, "08:30");
  assert.equal(c.sons, "doux");
  assert.equal(c.posees, 0);
  const b = R.normaliserChemin({ cases: 99, etoilesParPiece: 1, sons: "fort", heureDecouverte: "8h", recompenses: [{ case: 40, emoji: "x", nom: "trop loin" }, { case: 3, emoji: "🍦", nom: "dessert" }] });
  assert.equal(b.cases, 30);
  assert.equal(b.etoilesParPiece, 5);
  assert.equal(b.sons, "doux");
  assert.equal(b.heureDecouverte, "08:30");
  assert.deepEqual(b.recompenses.map(r => r.case), [3]);
});

test("prochaineRecompense et recompenseDeLaCase", () => {
  const c = R.normaliserChemin({ cases: 10, posees: 3, recompenses: [{ case: 5, emoji: "🍦", nom: "le dessert" }, { case: 10, emoji: "🧱", nom: "des Lego" }] });
  assert.deepEqual(R.prochaineRecompense(c), { case: 5, emoji: "🍦", nom: "le dessert", reste: 2 });
  assert.equal(R.recompenseDeLaCase(c, 10).nom, "des Lego");
  assert.equal(R.recompenseDeLaCase(c, 4), null);
  assert.equal(R.prochaineRecompense({ ...c, posees: 10 }), null);
});

test("phraseChemin : pièce à poser, prochaine récompense, bout du chemin", () => {
  const c = R.normaliserChemin({ cases: 10, posees: 3, recompenses: [{ case: 5, emoji: "🍦", nom: "le dessert" }] });
  assert.equal(R.phraseChemin(c, 1), "Tu as une pièce ! Fais-la glisser jusqu'au rond qui brille.");
  assert.equal(R.phraseChemin(c, 2), "Tu as 2 pièces ! Fais-les glisser une par une jusqu'au rond qui brille.");
  assert.equal(R.phraseChemin(c, 0), "Encore 2 pièces avant le dessert.");
  assert.equal(R.phraseChemin({ ...c, posees: 4 }, 0), "Encore 1 pièce avant le dessert.");
  assert.equal(R.phraseChemin({ ...c, posees: 6 }, 0), "Encore 4 pièces avant le bout du chemin.");
  assert.equal(R.phraseChemin({ ...c, posees: 10 }, 0), "Tu es au bout du chemin !");
});

test("estimationRythme : jours par pièce et semaines pour finir", () => {
  const c = R.normaliserChemin({ cases: 20, etoilesParPiece: 20 });
  const e = R.estimationRythme(c, 3);
  assert.equal(e.joursParPiece, 7);
  assert.equal(e.semaines, 19);
  assert.equal(e.tropLong, true);
  assert.equal(R.estimationRythme(R.normaliserChemin({ cases: 8, etoilesParPiece: 15 }), 3).tropLong, false);
});

test("etoilesAMettreDeCote : seulement celles qui ne l'ont pas déjà été", () => {
  assert.equal(R.etoilesAMettreDeCote({ etoiles: 3 }), 3);
  assert.equal(R.etoilesAMettreDeCote({ etoiles: 3, etoilesMisesDeCote: 3 }), 0);
  assert.equal(R.etoilesAMettreDeCote({ etoiles: 4, etoilesMisesDeCote: 3 }), 1);
  assert.equal(R.etoilesAMettreDeCote({ etoiles: 0 }), 0);
});
