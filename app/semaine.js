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

function cleJourDe(d) { return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); }

function lundiDe(cleJour) {
  const d = dateDeCle(cleJour);
  return cleJourDe(new Date(d.getFullYear(), d.getMonth(), d.getDate() - jourSemaineDe(cleJour) + 1));
}

// Écart arrondi : une semaine qui change d'heure dure 167 ou 169 heures.
function tombeCeJour(rythme, cleJour) {
  if (!rythme) return true;
  const semaines = Math.round((dateDeCle(lundiDe(cleJour)) - dateDeCle(lundiDe(rythme.depuis))) / 604800000);
  return semaines >= 0 && semaines % rythme.toutesLes === 0;
}

// Le rythme ne vit que dans la semaine type : un jour préparé n'en garde
// aucune trace.
function planningDuJour(semaineType, cleJour) {
  return copieProfonde(semaineType[String(jourSemaineDe(cleJour))] || [])
    .filter(item => tombeCeJour(item.rythme, cleJour))
    .map(item => { delete item.rythme; return item; });
}

function prochainesDates(jourSemaine, apresCle, n) {
  const d = dateDeCle(apresCle);
  const ecart = ((jourSemaine - jourSemaineDe(apresCle) + 6) % 7) + 1;
  const dates = [];
  for (let k = 0; k < n; k++) dates.push(cleJourDe(new Date(d.getFullYear(), d.getMonth(), d.getDate() + ecart + 7 * k)));
  return dates;
}

function prochaineFois(rythme, jourSemaine, apresCle) {
  return prochainesDates(jourSemaine, apresCle, 53).find(c => tombeCeJour(rythme, c));
}

// Juste avant le premier élément plus tardif, jamais après le coucher.
// Heures "HH:MM" à deux chiffres : comparées comme chaînes.
function placerSelonHeure(items, entree, estCoucher) {
  const resultat = copieProfonde(items);
  const positions = [
    entree.heure ? resultat.findIndex(it => it.heure && it.heure > entree.heure) : -1,
    estCoucher ? resultat.findIndex(estCoucher) : -1,
  ].filter(p => p !== -1);
  resultat.splice(positions.length ? Math.min(...positions) : resultat.length, 0, copieProfonde(entree));
  return resultat;
}

function estActivite(item, id) { return item.type === "aventure" && item.id === id; }

function quandDeLActivite(semaineType, id) {
  const jours = [];
  const heures = [];
  let rythme = null;
  for (let j = 1; j <= 7; j++) {
    const item = (semaineType[String(j)] || []).find(it => estActivite(it, id));
    if (!item) continue;
    jours.push(j);
    heures.push(item.heure || "");
    if (item.rythme && !rythme) rythme = copieProfonde(item.rythme);
  }
  const commune = heures.every(h => h === heures[0]);
  return { jours, heure: commune && heures[0] ? heures[0] : null, selonLeJour: !commune, rythme };
}

// Une activité a le même rythme sur tous ses jours (cf. appliquerQuand) :
// ajoutée à un autre jour de la semaine type, elle reprend le sien.
function avecRythmeDeLActivite(semaineType, item) {
  const entree = copieProfonde(item);
  if (item.type !== "aventure") return entree;
  const { rythme } = quandDeLActivite(semaineType, item.id);
  if (rythme) entree.rythme = rythme;
  return entree;
}

// « Enregistrer » de la fiche : un jour coché garde la place de l'activité
// si elle y est déjà ; `heure` vide garde celle de chaque jour.
function appliquerQuand(semaineType, id, quand, estCoucher) {
  const resultat = copieProfonde(semaineType);
  for (let j = 1; j <= 7; j++) {
    const items = resultat[String(j)] || [];
    if (!quand.jours.includes(j)) { resultat[String(j)] = items.filter(it => !estActivite(it, id)); continue; }
    let item = items.find(it => estActivite(it, id));
    if (!item) {
      const entree = { type: "aventure", id };
      if (quand.heure) entree.heure = quand.heure;
      if (quand.rythme) entree.rythme = copieProfonde(quand.rythme);
      resultat[String(j)] = placerSelonHeure(items, entree, estCoucher);
      continue;
    }
    if (quand.heure) item.heure = quand.heure;
    if (quand.rythme) item.rythme = copieProfonde(quand.rythme); else delete item.rythme;
  }
  return resultat;
}

// « A, B et C »
function listeEt(noms) {
  return noms.length <= 1 ? noms.join("") : noms.slice(0, -1).join(", ") + " et " + noms[noms.length - 1];
}

function joursCourts(jours) {
  if (jours.length === 7) return "tous les jours";
  return jours.map(j => NOMS_JOURS[j - 1].slice(0, 3)).join(", ");
}

function etiquetteRythme(quand, jourSemaine) {
  if (quand.rythme) return "1 " + NOMS_JOURS[jourSemaine - 1] + " sur " + quand.rythme.toutesLes;
  return quand.jours.length === 7 ? "tous les jours" : "chaque " + NOMS_JOURS[jourSemaine - 1];
}

function phraseQuand(quand, premiereFois) {
  if (!quand.jours.length) return "Pas programmée : elle reste dans la bibliothèque.";
  const noms = quand.jours.map(j => NOMS_JOURS[j - 1]);
  const heure = quand.heure ? " à " + quand.heure : "";
  if (!quand.rythme) return (quand.jours.length === 7 ? "Tous les jours" : "Chaque " + listeEt(noms)) + heure + ".";
  const suite = " Première fois : " + premiereFois;
  if (noms.length === 1) return "Un " + noms[0] + " sur deux" + heure + "." + suite;
  return "Une semaine sur deux, " + listeEt(noms.map(n => "le " + n)) + (heure ? "," + heure : "") + "." + suite;
}

// Une info se reconnaît à son texte, un moment au choix à ses options ;
// le choix fait par l'enfant ne compte pas.
function cleComparaison(item) {
  if (item.type === "note") return "note:" + item.texte;
  if (item.type === "choix") return "choix:" + (item.options || []).join(",");
  return item.type + ":" + item.id;
}

// Chaque élément du jour modifié est apparié à une occurrence encore libre
// du jour habituel : deux infos identiques comptent pour deux.
function differencesJour(modifie, habituel) {
  const libres = habituel.map(cleComparaison);
  const apparies = modifie.map(item => {
    const i = libres.indexOf(cleComparaison(item));
    if (i !== -1) libres[i] = null;
    return i;
  });
  const ajoutes = modifie.filter((_, k) => apparies[k] === -1);
  const pris = new Set(apparies.filter(i => i !== -1));
  const retires = habituel.filter((_, i) => !pris.has(i));
  const paires = modifie.map((item, k) => [item, apparies[k]]).filter(([, i]) => i !== -1);
  const ordreOuHeures = paires.some(([item, i], n) =>
    (n > 0 && i < paires[n - 1][1]) || (item.heure || "") !== (habituel[i].heure || ""));
  return { ajoutes, retires, ordreOuHeures };
}

// `estCoucher(item)` (facultatif) : l'item se place juste avant le coucher
// plutôt qu'en toute fin, comme insererActivite().
function ajouterAuxSeptJours(semaineType, item, estCoucher) {
  const resultat = copieProfonde(semaineType);
  Object.keys(resultat).forEach(j => {
    if (resultat[j].some(it => it.type === item.type && it.id === item.id)) return;
    const pos = estCoucher ? resultat[j].findIndex(estCoucher) : -1;
    resultat[j].splice(pos === -1 ? resultat[j].length : pos, 0, copieProfonde(item));
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

// Glisser-déposer du planning : `vers` est la position d'insertion dans
// la liste d'origine (0 = tout en haut, items.length = tout en bas), donc
// lâcher un élément juste avant ou juste après lui-même ne change rien.
// L'heure éventuelle voyage avec l'élément sans jamais trier la liste.
function deplacerElement(items, de, vers) {
  const resultat = copieProfonde(items);
  if (de < 0 || de >= resultat.length) return resultat;
  const borne = Math.max(0, Math.min(vers, resultat.length));
  const [element] = resultat.splice(de, 1);
  resultat.splice(borne > de ? borne - 1 : borne, 0, element);
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
  module.exports = { NOMS_JOURS, jourSemaineDe, lundiDe, tombeCeJour, creerSemaineType, planningDuJour, prochainesDates, prochaineFois, placerSelonHeure, quandDeLActivite, avecRythmeDeLActivite, appliquerQuand, joursCourts, etiquetteRythme, phraseQuand, differencesJour, ajouterAuxSeptJours, insererActivite, deplacerElement, migrerActivitesDatees };
}
