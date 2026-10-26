// Liste du jour côté enfant — logique pure, sans DOM ni stockage, testée
// sous Node (tests/journee.test.js) et chargée avant app.js dans la page.
// Un item de planning `{ type, id, heure?, fait?, passe? }` est soit à
// faire (routine, activité, moment au choix), soit un repère (repas,
// info) : un repère n'est jamais « maintenant », il est passé dès que la
// liste le dépasse.

function estAFaire(item) { return item.type === "routine" || item.type === "aventure" || item.type === "choix"; }
function resteAFaire(item) { return estAFaire(item) && !item.fait && !item.passe; }

// `horaire(item)` : `null` si l'item n'a pas d'heure de déblocage, sinon
// `true`/`false` selon qu'elle est atteinte (le coucher). Un item débloqué
// par son heure passe devant ce qui n'est pas fait (statut "rate", sans
// reproche) ; avant son heure, il peut être « maintenant » mais verrouillé.
function statutsJournee(planning, horaire) {
  let maintenant = planning.findIndex(it => resteAFaire(it) && horaire(it) === true);
  if (maintenant === -1) maintenant = planning.findIndex(resteAFaire);
  const statuts = planning.map(it => (it.fait ? "fait" : it.passe ? "passe" : null));

  let debutSuite;
  if (maintenant !== -1) {
    statuts[maintenant] = "maintenant";
    for (let i = 0; i < maintenant; i++) {
      if (statuts[i] === null) statuts[i] = estAFaire(planning[i]) ? "rate" : "repere-passe";
    }
    debutSuite = maintenant + 1;
  } else {
    // Plus rien à faire : les repères d'avant le dernier item fait sont
    // passés, ceux d'après restent à venir (ex. le dîner après la
    // dernière routine).
    let dernierFait = -1;
    planning.forEach((it, i) => { if (it.fait) dernierFait = i; });
    for (let i = 0; i <= dernierFait; i++) if (statuts[i] === null) statuts[i] = "repere-passe";
    debutSuite = dernierFait + 1;
  }

  let apres = null;
  for (let i = debutSuite; i < planning.length; i++) {
    if (statuts[i] !== null) continue;
    if (apres === null) { statuts[i] = "apres"; apres = i; } else statuts[i] = "plus-tard";
  }
  return {
    statuts,
    maintenant: maintenant === -1 ? null : maintenant,
    apres,
    verrouille: maintenant !== -1 && horaire(planning[maintenant]) === false,
  };
}

// « Après : » + nom, terminé par un point — sauf si le nom (une info
// écrite par un parent) a déjà sa ponctuation.
function finPhrase(texte) { return /[.!?…]$/.test(texte.trim()) ? texte.trim() : texte + "."; }

// Lecture de toute la journée : une phrase courte par élément, ce qui est
// fait d'abord, puis maintenant / après / ensuite. Ni les items sautés ni
// ceux restés pas faits (pas de reproche). `nomDe(item)` peut renvoyer
// `null` (référence orpheline) : l'item est alors ignoré.
function phrasesJournee(planning, resultat, nomDe) {
  const faits = [];
  const suite = [];
  const prefixes = { maintenant: "Maintenant : ", apres: "Après : ", "plus-tard": "Ensuite : " };
  resultat.statuts.forEach((statut, i) => {
    const nom = nomDe(planning[i]);
    if (!nom) return;
    // Une info passée n'est pas « faite » : elle n'est simplement plus lue.
    if (statut === "repere-passe" && planning[i].type === "note") return;
    if (statut === "fait" || statut === "repere-passe") faits.push({ index: i, nom });
    else if (prefixes[statut]) suite.push({ index: i, texte: finPhrase(prefixes[statut] + nom) });
  });
  const phrases = faits.map((f, n) => ({ index: f.index, texte: finPhrase((n === 0 ? "C'est fait : " : "") + f.nom) })).concat(suite);
  return phrases.length ? phrases : [{ index: null, texte: "Rien de prévu aujourd'hui." }];
}

// Ce que dit 🔊 sur la liste : l'élément en cours et le suivant.
function phraseMaintenant(planning, resultat, nomDe) {
  if (!planning.some(it => !it.passe)) return "Rien de prévu aujourd'hui.";
  const nom = (i) => (i === null ? null : nomDe(planning[i]));
  const m = nom(resultat.maintenant);
  const a = nom(resultat.apres);
  if (m && a) return finPhrase("Maintenant : " + m) + " " + finPhrase("Après : " + a);
  if (m) return finPhrase("Maintenant : " + m);
  if (a) return finPhrase("Après : " + a);
  return "Tout est fait pour aujourd'hui !";
}

// L'item à marquer fait quand une routine ou une activité se termine : le
// premier de ce type et de cet id qui reste à faire — pour une activité,
// un moment au choix où elle a été choisie compte aussi.
function indexAMarquer(planning, type, id) {
  return planning.findIndex(it => !it.fait && !it.passe
    && ((it.type === type && it.id === id) || (type === "aventure" && it.type === "choix" && it.choisi === id)));
}

if (typeof module !== "undefined") module.exports = { estAFaire, statutsJournee, phrasesJournee, phraseMaintenant, indexAMarquer, finPhrase };
