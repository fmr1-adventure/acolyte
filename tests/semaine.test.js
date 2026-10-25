const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../app/semaine.js");

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
