// Heure de Paris : la semaine du passage à l'heure d'hiver est un vrai cas.
process.env.TZ = "Europe/Paris";
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

test("ajouterAuxSeptJours : juste avant le coucher s'il est indiqué", () => {
  const st = S.creerSemaineType([{ type: "routine", id: "r1" }, { type: "routine", id: "soir" }]);
  const apres = S.ajouterAuxSeptJours(st, { type: "routine", id: "r2" }, (it) => it.id === "soir");
  assert.deepEqual(apres["3"].map(it => it.id), ["r1", "r2", "soir"]);
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

test("insererActivite : sans `apres`, juste avant le coucher s'il est indiqué", () => {
  const base = [{ type: "routine", id: "shabiller" }, { type: "routine", id: "soir" }];
  const estCoucher = (it) => it.type === "routine" && it.id === "soir";
  assert.deepEqual(S.insererActivite(base, { id: "x" }, estCoucher).map(i => i.id), ["shabiller", "x", "soir"]);
  const { planningFutur } = S.migrerActivitesDatees([{ id: "m", date: "2026-10-27" }], {}, "2026-10-25", () => base, estCoucher);
  assert.deepEqual(planningFutur["2026-10-27"].map(i => i.id), ["shabiller", "m", "soir"]);
});

test("deplacerElement : position d'insertion, vers le haut comme vers le bas", () => {
  const ids = l => l.map(it => it.id);
  const jour = [{ id: "a" }, { id: "b", heure: "10:00" }, { id: "c" }, { id: "d", heure: "08:00" }];
  assert.deepEqual(ids(S.deplacerElement(jour, 3, 0)), ["d", "a", "b", "c"]);
  assert.deepEqual(ids(S.deplacerElement(jour, 0, 4)), ["b", "c", "d", "a"]);
  assert.deepEqual(ids(S.deplacerElement(jour, 0, 2)), ["b", "a", "c", "d"]);
  assert.deepEqual(ids(S.deplacerElement(jour, 2, 1)), ["a", "c", "b", "d"]);
  assert.equal(jour[0].id, "a"); // liste d'origine intacte
});

test("deplacerElement : lâcher sur place ne change rien, les heures ne trient pas", () => {
  const jour = [{ id: "a", heure: "18:00" }, { id: "b", heure: "07:00" }, { id: "c" }];
  assert.deepEqual(S.deplacerElement(jour, 1, 1), jour);
  assert.deepEqual(S.deplacerElement(jour, 1, 2), jour);
  assert.deepEqual(S.deplacerElement(jour, 5, 0), jour);
  assert.deepEqual(S.deplacerElement(jour, 2, 0).map(it => it.id), ["c", "a", "b"]);
  assert.equal(S.deplacerElement(jour, 0, 3)[2].heure, "18:00");
});

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

test("differencesJour : deux éléments identiques comptent pour deux", () => {
  const info = { type: "note", texte: "Papa vient te chercher" };
  const base = [{ type: "repas", id: "gouter" }, info, { type: "routine", id: "soir" }];
  assert.deepEqual(S.differencesJour([base[0], info, info, base[2]], base), { ajoutes: [info], retires: [], ordreOuHeures: false });
  assert.deepEqual(S.differencesJour(base, [base[0], info, info, base[2]]), { ajoutes: [], retires: [info], ordreOuHeures: false });
  const choix = { type: "choix", options: ["velo", "lego"] };
  const deuxChoix = [choix, { type: "repas", id: "gouter" }, choix];
  assert.deepEqual(S.differencesJour(deuxChoix, deuxChoix), { ajoutes: [], retires: [], ordreOuHeures: false });
});

test("avecRythmeDeLActivite : ajoutée à un autre jour, une activité reprend son rythme", () => {
  const st = S.creerSemaineType([]);
  st["2"] = [{ type: "aventure", id: "ortho", heure: "17:15", rythme: R }];
  assert.deepEqual(S.avecRythmeDeLActivite(st, { type: "aventure", id: "ortho" }), { type: "aventure", id: "ortho", rythme: R });
  assert.deepEqual(S.avecRythmeDeLActivite(st, { type: "aventure", id: "piscine" }), { type: "aventure", id: "piscine" });
  assert.deepEqual(S.avecRythmeDeLActivite(st, { type: "note", texte: "x" }), { type: "note", texte: "x" });
  // Enregistrer la fiche sans rien toucher ne change alors rien.
  const ajoute = { ...st, "4": [S.avecRythmeDeLActivite(st, { type: "aventure", id: "ortho" })] };
  const q = S.quandDeLActivite(ajoute, "ortho");
  assert.deepEqual(S.appliquerQuand(ajoute, "ortho", { jours: q.jours, heure: q.heure || "", rythme: q.rythme }), ajoute);
});
