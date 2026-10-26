// Semaine type : logique pure du planning récurrent (aucun accès au DOM ni
// au stockage), chargée avant app.js et testée sous Node (tests/).

const NOMS_JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

function copieProfonde(valeur) { return JSON.parse(JSON.stringify(valeur)); }

// Clés "AAAA-M-J" sans zéro : jamais comparées comme chaînes.
function dateDeCle(cleJour) {
  const [a, m, j] = cleJour.split("-").map(Number);
  return new Date(a, m - 1, j);
}

function jourSemaineDe(cleJour) {
  const jour = dateDeCle(cleJour).getDay();
  return jour === 0 ? 7 : jour;
}

function creerSemaineType(journeeType) {
  const semaineType = {};
  for (let j = 1; j <= 7; j++) semaineType[String(j)] = copieProfonde(journeeType);
  return semaineType;
}

function planningDuJour(semaineType, cleJour) {
  return copieProfonde(semaineType[String(jourSemaineDe(cleJour))] || []);
}

function ajouterAuxSeptJours(semaineType, item) {
  const resultat = copieProfonde(semaineType);
  Object.keys(resultat).forEach(j => {
    if (!resultat[j].some(it => it.type === item.type && it.id === item.id)) resultat[j].push(copieProfonde(item));
  });
  return resultat;
}

// `estCoucher(item)` (facultatif) : sans `apres`, l'activité se place
// juste avant le coucher plutôt qu'en toute fin — rien ne se lance après
// le coucher dans la liste de l'enfant.
function insererActivite(items, aventure, estCoucher) {
  const resultat = copieProfonde(items);
  if (resultat.some(it => it.type === "aventure" && it.id === aventure.id)) return resultat;
  const entree = { type: "aventure", id: aventure.id };
  if (aventure.heureDefaut) entree.heure = aventure.heureDefaut;
  const pos = aventure.apres ? resultat.findIndex(it => it.type === aventure.apres.type && it.id === aventure.apres.id) : -1;
  if (pos !== -1) { resultat.splice(pos + 1, 0, entree); return resultat; }
  const coucher = estCoucher ? resultat.findIndex(estCoucher) : -1;
  if (coucher === -1) resultat.push(entree); else resultat.splice(coucher, 0, entree);
  return resultat;
}

function migrerActivitesDatees(aventures, planningFutur, aujourdhui, planningPour, estCoucher) {
  const resultat = copieProfonde(planningFutur);
  const pourAujourdhui = [];
  const reference = dateDeCle(aujourdhui).getTime();
  aventures.forEach(a => {
    if (!a.date) return;
    const t = dateDeCle(a.date).getTime();
    if (t === reference) { pourAujourdhui.push(a); return; }
    if (t < reference) return;
    resultat[a.date] = insererActivite(resultat[a.date] || planningPour(a.date), a, estCoucher);
  });
  return { planningFutur: resultat, pourAujourdhui };
}

if (typeof module !== "undefined") {
  module.exports = { NOMS_JOURS, jourSemaineDe, creerSemaineType, planningDuJour, ajouterAuxSeptJours, insererActivite, migrerActivitesDatees };
}
