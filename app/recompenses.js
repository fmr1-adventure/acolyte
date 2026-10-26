// Récompenses — logique pure, sans DOM ni stockage, testée sous Node
// (tests/recompenses.test.js) et chargée avant app.js dans la page.
// Les étoiles de la journée sont mises de côté le soir, versées le matin
// dans une jauge ; une jauge pleine donne une pièce, que l'enfant pose à la
// main sur un chemin bordé de récompenses (cf. la spec des activités,
// section 5).

const SONS_CHEMIN = ["doux", "arcade", "coupes"];

// Exemples de départ, à adapter par les parents (écran « Chemin et
// récompenses ») : la dernière case porte la récompense finale.
const CHEMIN_DEFAUT = {
  cases: 20,
  etoilesParPiece: 20,
  heureDecouverte: "08:30",
  sons: "doux",
  recompenses: [
    { case: 5, emoji: "🍦", nom: "choisir le dessert" },
    { case: 10, emoji: "🛝", nom: "un tour au parc" },
    { case: 15, emoji: "🎬", nom: "un film en famille" },
    { case: 20, emoji: "🎁", nom: "une grande surprise" },
  ],
  posees: 0,
  atteintes: [],
};

function borne(valeur, min, max, defaut) {
  const n = Math.round(Number(valeur));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : defaut;
}

// Remet un chemin lu du stockage dans une forme sûre : valeurs par défaut,
// bornes, récompenses triées par case (une seule par case, dans le chemin).
function normaliserChemin(c) {
  const src = c && typeof c === "object" ? c : JSON.parse(JSON.stringify(CHEMIN_DEFAUT));
  const cases = borne(src.cases, 5, 30, CHEMIN_DEFAUT.cases);
  const vues = new Set();
  const recompenses = (Array.isArray(src.recompenses) ? src.recompenses : [])
    .map(r => ({ case: borne(r && r.case, 1, 999, 0), emoji: String((r && r.emoji) || "🎁"), nom: String((r && r.nom) || "").trim() }))
    .filter(r => r.case >= 1 && r.case <= cases && r.nom && !vues.has(r.case) && vues.add(r.case))
    .sort((a, b) => a.case - b.case);
  return {
    cases,
    etoilesParPiece: borne(src.etoilesParPiece, 5, 40, CHEMIN_DEFAUT.etoilesParPiece),
    heureDecouverte: /^\d\d:\d\d$/.test(src.heureDecouverte) ? src.heureDecouverte : CHEMIN_DEFAUT.heureDecouverte,
    sons: SONS_CHEMIN.includes(src.sons) ? src.sons : CHEMIN_DEFAUT.sons,
    recompenses,
    posees: borne(src.posees, 0, cases, 0),
    atteintes: Array.isArray(src.atteintes) ? src.atteintes : [],
    archives: Array.isArray(src.archives) ? src.archives : [],
  };
}

// Verse `n` étoiles dans la jauge. `etapes` décrit, étoile par étoile, ce
// que montre l'animation (la jauge pleine à `etoilesParPiece` quand une
// pièce sort). Une jauge déjà au-dessus du seuil (seuil baissé par un
// parent) donne d'abord ses pièces, sans perdre d'étoile.
function verserEtoiles(dansLaJauge, n, etoilesParPiece) {
  let dans = Math.max(0, Math.floor(dansLaJauge) || 0);
  let pieces = 0;
  const etapes = [];
  while (dans >= etoilesParPiece) { dans -= etoilesParPiece; pieces++; }
  for (let i = 0; i < n; i++) {
    dans++;
    if (dans >= etoilesParPiece) { etapes.push({ dans: etoilesParPiece, piece: true }); dans = 0; pieces++; }
    else etapes.push({ dans, piece: false });
  }
  return { dansLaJauge: dans, pieces, etapes };
}

// La carte « Ce matin » : des étoiles attendent et l'heure est passée
// (heures au format "HH:MM", comparables comme des chaînes).
function decouverteDisponible(jauge, maintenant, heureDecouverte) {
  return !!jauge && jauge.aDecouvrir > 0 && maintenant >= heureDecouverte;
}

function recompenseDeLaCase(chemin, n) {
  return chemin.recompenses.find(r => r.case === n) || null;
}

function prochaineRecompense(chemin) {
  const r = chemin.recompenses.find(x => x.case > chemin.posees);
  return r ? { case: r.case, emoji: r.emoji, nom: r.nom, reste: r.case - chemin.posees } : null;
}

// Ce que dit 🔊 sur l'écran du chemin.
function phraseChemin(chemin, aPoser) {
  if (chemin.posees >= chemin.cases) return "Tu es au bout du chemin !";
  if (aPoser === 1) return "Tu as une pièce ! Fais-la glisser jusqu'au rond qui brille.";
  if (aPoser > 1) return "Tu as " + aPoser + " pièces ! Fais-les glisser une par une jusqu'au rond qui brille.";
  const p = prochaineRecompense(chemin);
  const reste = p ? p.reste : chemin.cases - chemin.posees;
  return "Encore " + reste + (reste > 1 ? " pièces" : " pièce") + " avant " + (p ? p.nom : "le bout du chemin") + ".";
}

// Pour calibrer sans calcul (écran parent) : avec `etoilesParJour` étoiles
// par jour, combien de jours pour une pièce, et de semaines pour finir le
// chemin avec les étoiles seules. Au-delà de 10 semaines, c'est trop long.
function estimationRythme(chemin, etoilesParJour) {
  const parJour = Math.max(1, etoilesParJour);
  const jours = chemin.etoilesParPiece / parJour;
  const semaines = Math.round(((chemin.cases - chemin.posees) * jours) / 7);
  return { joursParPiece: Math.round(jours), semaines, tropLong: semaines > 10 };
}

// Étoiles de la journée pas encore mises de côté pour le lendemain matin :
// `etat.etoilesMisesDeCote` retient combien l'ont déjà été (coucher validé
// deux fois, puis changement de jour), pour ne jamais en compter deux fois.
function etoilesAMettreDeCote(etat) {
  const deja = typeof etat.etoilesMisesDeCote === "number" ? etat.etoilesMisesDeCote : 0;
  return Math.max(0, (etat.etoiles || 0) - deja);
}

if (typeof module !== "undefined") {
  module.exports = { SONS_CHEMIN, CHEMIN_DEFAUT, normaliserChemin, verserEtoiles, decouverteDisponible, recompenseDeLaCase, prochaineRecompense, phraseChemin, estimationRythme, etoilesAMettreDeCote };
}
