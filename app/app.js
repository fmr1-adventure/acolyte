/*
 * Prototype de parcours — un ou plusieurs enfants : menu de la journée →
 * routines indépendantes ("S'habiller", "Se préparer à partir") →
 * félicitations → validation parent (code + relecture/correction) →
 * étoile + jauge de journée → retour au menu → récompense de fin de
 * journée une fois toutes les routines validées.
 *
 * Modèle : voir docs/produit/modele-de-donnees.md — une Routine a une
 * liste ordonnée de Tâches (relation mère-fille). `etat.routines[id].fait`
 * est un tableau d'id de tâches (pas d'index numériques), pour rester
 * robuste au fait qu'il y ait plusieurs routines indépendantes.
 *
 * Aventures : sorties programmées, accessibles depuis la porte "Partir à
 * l'aventure". Même écrans que le trajet/arrivée chez une praticienne
 * (génériques, alimentés par l'aventure du jour), mais certaines
 * rapportent une récompense différente d'une étoile de routine : une
 * pièce (cf. `chargerPieces`/`ajouterPieces` et
 * docs/produit/modele-de-donnees.md).
 *
 * Profils (PROFILS/tousLesProfils(), plus bas) : CHAQUE ENFANT UTILISE
 * SON PROPRE APPAREIL — ce n'est PAS un sélecteur dans une même app
 * partagée. Un profil est créé une fois sur l'appareil qui lui est dédié,
 * via l'écran de première configuration (prénom, avatar, code parent —
 * cf. `demarrerPremiereConfiguration()`), puis `profilActif()` détermine
 * "quel enfant est CET appareil" une bonne fois pour toutes (retenu dans
 * `localStorage` sur cet appareil, query param `?enfant=` possible pour
 * un profil déjà créé) — pas un choix qui revient à chaque session.
 * Toutes les clés `localStorage` propres à un enfant (journée, étoiles,
 * pièces, historique, routines/aventures perso) sont préfixées par
 * `profilActif().prefixe` (cf. `cle()`) ; celles de l'appareil/famille
 * (code parent, mode debug) restent partagées, cf. `codeParentActuel()`/
 * `modeDebugActif()`. Voir `docs/produit/modele-de-donnees.md` pour le
 * détail de ce qui est commun (REPAS, PLANNING_DEFAUT, moteur générique)
 * vs propre à un enfant (routines, vêtements/avatar, aventures avec une
 * praticienne précise).
 *
 * Code parent : partagé par appareil (pas par enfant — mêmes parents des
 * deux côtés), choisi à la première configuration.
 */

// ---------------------------------------------------------------------
// Version de l'app : la même ici, dans index.html (meta "acolyte-version")
// et dans le nom du cache de sw.js ("acolyte-v<VERSION_APP>"). Filet de
// sécurité contre une page faite de deux versions (index.html de l'une,
// app.js de l'autre — possible pendant la mise à jour du cache hors-ligne) :
// le câblage des boutons planterait au démarrage. Dans ce cas on vide les
// caches et on recharge, une seule fois par session, avant d'exécuter
// quoi que ce soit d'autre.
// ---------------------------------------------------------------------
const VERSION_APP = "20";
(function verifierVersionPage() {
  const meta = document.querySelector('meta[name="acolyte-version"]');
  if (meta && meta.content === VERSION_APP) {
    try { sessionStorage.removeItem("acolyte_rechargement_version"); } catch (e) {}
    // Caches d'une version précédente : plus jamais lus, on les retire.
    try { caches.keys().then(noms => noms.filter(n => n !== "acolyte-v" + VERSION_APP).forEach(n => caches.delete(n))); } catch (e) {}
    return;
  }
  try {
    if (sessionStorage.getItem("acolyte_rechargement_version") === "1") return; // déjà tenté : on n'insiste pas
    sessionStorage.setItem("acolyte_rechargement_version", "1");
  } catch (e) { return; }
  const recharger = () => location.reload();
  try { caches.keys().then(noms => Promise.all(noms.map(n => caches.delete(n)))).then(recharger, recharger); } catch (e) { recharger(); }
  throw new Error("Acolyte : versions mélangées, rechargement.");
})();

// ---------------------------------------------------------------------
// Mode debug (tests) : toujours actif sur un serveur de dev local
// (localhost/127.0.0.1, quel que soit le port — évite d'avoir à rouvrir
// `?debug=1` à chaque fois que le port change d'une session de test à
// l'autre) ; ailleurs (ex. une URL de prévisualisation non-localhost),
// activable une fois via `?debug=1` dans l'URL, retenu ensuite sur CET
// appareil/navigateur via `acolyte_debug` (localStorage) — partagé par
// appareil, pas par enfant (un appareil de test reste en debug quel que
// soit le profil affiché dessus, cf. `resoudreProfilActif()` plus bas).
// N'affecte jamais les tablettes réelles des enfants : elles ne
// chargent que l'URL GitHub Pages publiée, jamais un localhost (cf.
// app/README.md). Ajoute un bouton 🧪 (cf. index.html, symétrique de
// ⚙️/↺) qui ouvre un panneau listant tous les écrans, chacun atteint via
// sa vraie fonction d'entrée plutôt qu'un simple `afficherEcran` — pour
// ne jamais laisser un écran sans les données dont il dépend (routine en
// cours, aventure en cours...), comme s'il avait été atteint normalement.
(function initModeDebug() {
  try {
    const params = new URLSearchParams(location.search);
    if (params.has("debug")) {
      if (params.get("debug") === "0") localStorage.removeItem("acolyte_debug");
      else localStorage.setItem("acolyte_debug", "1");
    }
  } catch (e) {}
})();
function modeDebugActif() {
  if (location.hostname === "localhost" || location.hostname === "127.0.0.1") return true;
  // `<prénom>_debug` : ancienne clé (avant le support multi-profil), lue en
  // secours pour ne pas redemander `?debug=1` sur un appareil qui l'avait
  // déjà activé — jamais réécrite.
  try {
    if (localStorage.getItem("acolyte_debug") === "1") return true;
    return Object.keys(localStorage).some(k => k.endsWith("_debug") && localStorage.getItem(k) === "1");
  } catch (e) { return false; }
}

// `dateDebugForcee` (Date, null = heure réelle) simule le moment présent
// pour les deux seuls verrous qui en dépendent réellement (réveil, cf.
// `dortEncore()`/`prochainReveil()` ; déblocage `disponibleApresHeure`,
// cf. `construireMenu()`) sans avoir à attendre ni à changer l'heure de
// l'appareil. Une vraie Date (pas juste une heure du jour) : `dortEncore()`
// compare à un horodatage du LENDEMAIN une fois le coucher simulé (cf.
// `endormir()`), donc avancer doit pouvoir passer minuit — se contenter de
// changer l'heure du jour courant ne débloquerait jamais le réveil.
// Volontairement en mémoire seulement (pas persisté) : un rechargement
// repart de l'heure réelle plutôt que de risquer de fausser une session
// ultérieure oubliée en mode debug.
let dateDebugForcee = null;
function dateActuelle() {
  return dateDebugForcee || new Date();
}

// Code parent : persisté à part (`acolyte_code_parent`), modifiable depuis
// l'espace parent (cf. demarrerChangementCode()) — "1234" tant qu'aucun
// nouveau code n'a été enregistré. Partagé par APPAREIL, pas par enfant
// (cf. resoudreProfilActif() plus bas) : ce sont les mêmes parents des
// deux côtés, pas une raison d'avoir deux codes à retenir.
function codeParentActuel() {
  try {
    return localStorage.getItem("acolyte_code_parent") || "1234";
  } catch (e) { return "1234"; }
}
function sauverCodeParent(code) {
  try { localStorage.setItem("acolyte_code_parent", code); } catch (e) {}
}

// ---------------------------------------------------------------------
// Profils — CHAQUE ENFANT SUR SON PROPRE APPAREIL, PAS un sélecteur dans
// une même app partagée. Un déploiement neuf n'a AUCUN profil : le tout
// premier lancement affiche l'écran de première configuration (prénom,
// avatar, code parent — cf. `demarrerPremiereConfiguration()` plus bas,
// déclenché depuis `demarrer()` si `tousLesProfils()` est vide), qui crée
// le profil dans `profils_perso`. `PROFILS` reste le socle "en dur" —
// vide ici, mais une entrée peut y être ajoutée à la main (même forme
// qu'un profil créé par l'app, avec en plus des accesseurs `routines()`/
// `aventuresPropres()` vers des catalogues dédiés) pour un déploiement qui
// voudrait figer un profil au code plutôt que le configurer depuis l'app.
//
// `prefixe` (= `id` pour un profil créé depuis l'app) retrouve les clés
// `localStorage` propres à cet enfant (`<prefixe>_journee`,
// `<prefixe>_pieces`, ...) — cf. `cle()`.
const PROFILS = {};

// Profils créés depuis l'app (écran de première configuration, ou "+
// Nouvel enfant" dans "Cet appareil") — même pattern que
// routines_perso/aventures_perso/entourage_perso plus bas : persistés à
// part, jamais remis à zéro, fusionnés avec PROFILS via
// `tousLesProfils()`. Purement des données (JSON) : contrairement à une
// entrée PROFILS en dur, pas d'accesseurs `routines()`/`aventuresPropres()`
// — ces profils n'ont aucun catalogue de base, tout vit dans leurs propres
// `routines_perso`/`aventures_perso` (cf. `toutesLesRoutines()`/
// `toutesLesAventures()`, qui traitent un profil sans accesseur comme un
// catalogue de base vide).
function chargerProfilsPerso() {
  try { return JSON.parse(localStorage.getItem("acolyte_profils_perso") || "[]"); } catch (e) { return []; }
}
function sauverProfilsPerso(liste) {
  try { localStorage.setItem("acolyte_profils_perso", JSON.stringify(liste)); } catch (e) {}
}
// Même principe de masquage par id que toutesLesRoutines() : un profil
// perso remplace une éventuelle entrée PROFILS du même id plutôt que de
// s'y ajouter en double.
function tousLesProfils() {
  const perso = chargerProfilsPerso();
  const idsPerso = new Set(perso.map(p => p.id));
  const table = {};
  Object.values(PROFILS).filter(p => !idsPerso.has(p.id)).forEach(p => { table[p.id] = p; });
  perso.forEach(p => { table[p.id] = p; });
  return table;
}

(function initProfilActif() {
  try {
    const params = new URLSearchParams(location.search);
    if (params.has("enfant") && tousLesProfils()[params.get("enfant")]) {
      localStorage.setItem("acolyte_enfant", params.get("enfant"));
    }
  } catch (e) {}
})();
// `null` tant qu'aucun profil n'existe/n'est choisi sur cet appareil — cf.
// `demarrer()`, qui affiche alors la première configuration plutôt que
// d'appeler `chargerEtat()`/`profilActif()` (qui supposent un profil réel).
function profilActifId() {
  try {
    const stocke = localStorage.getItem("acolyte_enfant");
    if (stocke && tousLesProfils()[stocke]) return stocke;
  } catch (e) {}
  return null;
}
function profilActif() { return tousLesProfils()[profilActifId()] || null; }
// Préfixe une clé localStorage propre à l'enfant actif (journée, étoiles,
// historique, code, routines/aventures perso...) — jamais pour une clé
// partagée par appareil (code parent, debug), cf. plus haut. Suppose un
// profil actif réel (jamais appelée avant la première configuration).
function cle(nomBase) { return profilActif().prefixe + "_" + nomBase; }

// ---------------------------------------------------------------------
// Avatars proposés à la première configuration — mêmes calques qu'un
// profil codé en dur (base + calques, cf. `sprites` plus haut), générés
// par scripts/generate_sprites_detailed_preview.py (voir CHILDREN dans ce
// script pour les 4 combinaisons peau/cheveux ci-dessous, 2 par
// silhouette). `silhouette` ("pantalon"/"robe") pilote uniquement le
// gabarit de routines amorcé à la création (cf. `routinesDemarrage()`
// plus bas) — un parent peut ensuite ajouter les deux jeux de vêtements à
// une même routine si besoin, cf. l'espace parent.
// Avatar personnalisable — remplace l'ancien choix figé à 4 avatars par
// des traits combinables (genre, coupe, peau, cheveux, yeux), rendus à
// l'avance par scripts/generate_sprites_detailed_preview.py (320
// combinaisons corps/visage : 4 peaux × 5 couleurs de cheveux × 4 coupes
// × 4 couleurs d'yeux, chacune avec sa version "dodo" assortie) plutôt
// que composées en direct dans le navigateur — cf. app/assets/avatar/perso/,
// nommés "<coupe>-<peau>-<cheveux>-<yeux>-{base,dodo}.png". Les vêtements
// ne font pas partie de ce choix (non demandé) : ils restent les 2 jeux
// de calques déjà existants, un par silhouette, cf. CALQUES_PAR_SILHOUETTE.
//
// `p2`/`n4`/`y1`/"court-net" = les valeurs exactes de l'ancien "avatar-a"
// (lui-même la reprise générique d'un avatar réel) : gardées
// comme valeurs par défaut à l'ouverture de l'écran plutôt qu'un choix
// arbitraire.
const PEAUX = [
  { id: "p1", couleur: "#f5d6be" },
  { id: "p2", couleur: "#deb28c" },
  { id: "p3", couleur: "#b4825a" },
  { id: "p4", couleur: "#78523a" },
];
const CHEVEUX_COULEURS = [
  { id: "n1", couleur: "#e0ba5a" },
  { id: "n2", couleur: "#a84c30" },
  { id: "n3", couleur: "#785438" },
  { id: "n4", couleur: "#4a362a" },
  { id: "n5", couleur: "#1c1816" },
];
const YEUX_COULEURS = [
  { id: "y1", couleur: "#221e28" },
  { id: "y2", couleur: "#785430" },
  { id: "y3", couleur: "#3c6ea5" },
  { id: "y4", couleur: "#46825a" },
];
// Coupes propres à chaque genre (jamais mélangées dans le menu) — le
// genre choisi fixe aussi `silhouette` (cf. silhouettePourGenre()), donc
// le vêtement du bas de "S'habiller" (routinesDemarrage()).
const COUPES_PAR_GENRE = {
  garcon: [
    { id: "court-net", nom: "Coupe courte" },
    { id: "court-ebouriffe", nom: "Coupe ébouriffée" },
  ],
  fille: [
    { id: "carre", nom: "Carré" },
    { id: "couettes", nom: "Couettes" },
  ],
};
const CALQUES_PAR_SILHOUETTE = {
  pantalon: [
    { calque: "calque-calecon",     fichier: "assets/avatar/avatar-a-calecon.png" },
    { calque: "calque-haut",        fichier: "assets/avatar/avatar-a-haut.png" },
    { calque: "calque-pantalon",    fichier: "assets/avatar/avatar-a-pantalon.png" },
    { calque: "calque-chaussettes", fichier: "assets/avatar/avatar-a-chaussettes.png" },
    { calque: "calque-chaussures",  fichier: "assets/avatar/avatar-a-chaussures.png" },
    { calque: "calque-manteau",     fichier: "assets/avatar/avatar-a-manteau.png" },
  ],
  robe: [
    { calque: "calque-culotte",     fichier: "assets/avatar/avatar-c-culotte.png" },
    { calque: "calque-haut",        fichier: "assets/avatar/avatar-c-haut.png" },
    { calque: "calque-robe",        fichier: "assets/avatar/avatar-c-robe.png" },
    { calque: "calque-chaussettes", fichier: "assets/avatar/avatar-c-chaussettes.png" },
    { calque: "calque-chaussures",  fichier: "assets/avatar/avatar-c-chaussures.png" },
    { calque: "calque-manteau",     fichier: "assets/avatar/avatar-c-manteau.png" },
  ],
};
function silhouettePourGenre(genre) { return genre === "fille" ? "robe" : "pantalon"; }
// Un profil créé avant l'enregistrement de `genre` le retrouve par sa
// silhouette, elle-même tirée du genre choisi à la configuration.
function genreDuProfil(profil) {
  if (profil.genre) return profil.genre;
  const calques = (profil.sprites && profil.sprites.calques) || [];
  return calques.some(c => c.calque === "calque-robe") ? "fille" : "garcon";
}
// Textes écrits une seule fois en forme inclusive ("habillé·e", "il/elle"),
// accordés au moment où ils parlent d'un enfant précis — sinon la voix lit
// le point médian tel quel.
function accorderAuGenre(texte, genre) {
  const fille = genre === "fille";
  return texte
    .replace(/(\p{L}+)·e(s?)(?!\p{L})/gu, (_, mot, s) => mot + (fille ? "e" : "") + s)
    .replace(/\bil\/elle\b/g, fille ? "elle" : "il");
}
function accorderPourEnfant(texte) { return accorderAuGenre(texte, genreDuProfil(profilActif())); }
// Résout la combinaison de traits en cours (`configInitiale` ou un profil
// déjà créé) vers les fichiers réels — seul point qui connaît la
// convention de nommage des fichiers générés.
function spritesPourTraits(traits) {
  const silhouette = silhouettePourGenre(traits.genre);
  const prefixe = `assets/avatar/perso/${traits.coupe}-${traits.peau}-${traits.cheveux}-${traits.yeux}`;
  return {
    silhouette,
    dodo: `${prefixe}-dodo.png`,
    sprites: { base: `${prefixe}-base.png`, calques: CALQUES_PAR_SILHOUETTE[silhouette] },
  };
}

// ---------------------------------------------------------------------
// Accueil — première rencontre avec l'acolyte, avant la création du
// profil (cf. `ouvrirPremiereConfiguration()` juste après). Joué aussi
// bien au tout premier lancement de l'appareil (`demarrer()`, aucun
// profil) que pour un enfant ajouté depuis l'espace parent
// (`ouvrirNouveauProfilDepuisAppareil()`, appareil déjà configuré) :
// c'est toujours l'enfant qui rencontre l'acolyte en premier et valide
// chaque étape lui-même, jamais le parent qui remplit le formulaire
// suivant à sa place. 3 écrans séquentiels sans bouton retour, comme le
// rituel du réveil (cf. `ouvrirReveil()` plus bas) : une fois lancé, on
// avance jusqu'à la création du profil.
const TEXTE_ACCUEIL_1 = "Bienvenue, je suis ton acolyte, nous allons passer du temps ensemble tous les jours.";
const TEXTE_ACCUEIL_2 = "Mon rôle est de t'accompagner dans ton quotidien sur tes routines et tes activités.";
const TEXTE_ACCUEIL_3 = "Pour bien remplir mon rôle, j'ai besoin de quelques informations sur toi.";
// Porté jusqu'au bouton final de l'accueil, qui ouvre la première
// configuration avec le bon `estAjout` (cf. `ouvrirPremiereConfiguration()`).
let accueilEstAjout = false;

function ouvrirAccueil(estAjout) {
  accueilEstAjout = !!estAjout;
  document.getElementById("accueil-1-texte").textContent = TEXTE_ACCUEIL_1;
  afficherEcran("screen-accueil-1");
  dire(TEXTE_ACCUEIL_1);
}
function etapeAccueil2() {
  document.getElementById("accueil-2-texte").textContent = TEXTE_ACCUEIL_2;
  afficherEcran("screen-accueil-2");
  dire(TEXTE_ACCUEIL_2);
}
function etapeAccueil3() {
  document.getElementById("accueil-3-texte").textContent = TEXTE_ACCUEIL_3;
  afficherEcran("screen-accueil-3");
  dire(TEXTE_ACCUEIL_3);
}

// ---------------------------------------------------------------------
// Première configuration — écran affiché après l'accueil ci-dessus,
// qu'il s'agisse du tout premier lancement de l'appareil (cf.
// `demarrer()`, tout en bas du fichier) ou d'un ajout depuis
// "Cet appareil" ("+ Nouvel enfant") pour un appareil déjà configuré.
// Prénom + date de naissance + avatar ici,
// code parent juste après (réutilise le pavé numérique existant, cf.
// `demarrerCodeInitial()`) — la création réelle du profil n'a lieu
// qu'une fois le code confirmé deux fois, cf. `finaliserPremiereConfiguration()`.
let configInitiale = { prenom: "", naissanceJour: 1, naissanceMois: 1, naissanceAnnee: 2018, genre: "garcon", coupe: "court-net", peau: "p2", cheveux: "n4", yeux: "y1" };
// Change seulement où mène le bouton retour (cf. son wiring plus bas) :
// vers "Cet appareil" si on vient de l'espace parent, vers le dernier
// écran d'accueil (screen-accueil-3) au tout premier lancement — toujours
// visible depuis que cet écran n'est plus atteignable autrement qu'après
// l'accueil (cf. `ouvrirAccueil()`), qui laisse toujours un écran où
// revenir.
let premiereConfigEstAjout = false;

// Date de naissance par défaut à l'ouverture de l'écran : une roulette a
// toujours une valeur centrée (contrairement aux pastilles qu'elle
// remplace, cf. index.html), donc pas d'état "vide" possible — on centre
// une date plausible plutôt que le 1ᵉʳ janvier de l'année en cours.
function naissanceParDefaut() {
  const auj = dateActuelle();
  return { naissanceJour: auj.getDate(), naissanceMois: auj.getMonth() + 1, naissanceAnnee: auj.getFullYear() - 8 };
}

function ouvrirPremiereConfiguration(estAjout) {
  premiereConfigEstAjout = !!estAjout;
  configInitiale = Object.assign(
    { prenom: "", genre: "garcon", coupe: "court-net", peau: "p2", cheveux: "n4", yeux: "y1" },
    naissanceParDefaut()
  );
  document.getElementById("pc-prenom").value = "";
  document.getElementById("pc-erreur").textContent = "";
  document.getElementById("pc-genre-garcon").classList.add("choisi");
  document.getElementById("pc-genre-fille").classList.remove("choisi");
  construireRouesNaissanceInitiale();
  construireChoixApparenceInitiale();
  afficherEcran("screen-premiere-configuration");
}

// Jour/mois/année en 3 roulettes à faire défiler plutôt qu'un
// <input type="date"> (cf. commentaire dans index.html) : chacune est une
// colonne défilante avec accroche CSS (scroll-snap-type/scroll-snap-align)
// au centre — cf. la bande fixe .pc-date-roues::before dans styles.css.
// Années : les 18 dernières (couvre de nouveau-né à tout juste 17 ans),
// largement au-delà de l'âge visé par l'app.
const HAUTEUR_ROUE_DATE = 40;
const MOIS_NOMS_COURTS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
function construireRouesNaissanceInitiale() {
  const anneeActuelle = dateActuelle().getFullYear();
  const annees = [];
  for (let a = anneeActuelle; a >= anneeActuelle - 17; a--) annees.push(a);

  construireRoueDate("pc-naissance-jour-roue", Array.from({ length: 31 }, (_, i) => i + 1), null,
    configInitiale.naissanceJour, (v) => { configInitiale.naissanceJour = v; });
  construireRoueDate("pc-naissance-mois-roue", Array.from({ length: 12 }, (_, i) => i + 1), MOIS_NOMS_COURTS,
    configInitiale.naissanceMois, (v) => { configInitiale.naissanceMois = v; });
  construireRoueDate("pc-naissance-annee-roue", annees, null,
    configInitiale.naissanceAnnee, (v) => { configInitiale.naissanceAnnee = v; });
}

// `valeurs` = ce qui est stocké dans configInitiale (nombre) ; `labels`
// (optionnel) = ce qui s'affiche à la place (ex. noms de mois), même
// index. Détecte l'item centré par défilement au lieu d'un clic par item
// (même mécanique pour le clic direct sur un item : on scrolle jusqu'à
// lui, puis c'est le même code de détection qui le retient) — un simple
// timeout après le dernier événement `scroll` plutôt que l'événement
// `scrollend` (pas encore assez répandu sur les navigateurs de tablette
// visés) pour repérer que le défilement s'est arrêté.
function construireRoueDate(idRoue, valeurs, labels, valeurInitiale, onChange) {
  const roue = document.getElementById(idRoue);
  roue.innerHTML = "";
  valeurs.forEach((v, i) => {
    const item = document.createElement("div");
    item.className = "pc-date-roue-item" + (v === valeurInitiale ? " choisi" : "");
    item.textContent = labels ? labels[i] : v;
    item.onclick = () => roue.scrollTo({ top: i * HAUTEUR_ROUE_DATE, behavior: "smooth" });
    roue.appendChild(item);
  });
  const indexInitial = Math.max(0, valeurs.indexOf(valeurInitiale));
  roue.scrollTop = indexInitial * HAUTEUR_ROUE_DATE;

  let minuteur = null;
  roue.onscroll = () => {
    clearTimeout(minuteur);
    minuteur = setTimeout(() => {
      const index = Math.max(0, Math.min(valeurs.length - 1, Math.round(roue.scrollTop / HAUTEUR_ROUE_DATE)));
      Array.from(roue.children).forEach((el, i) => el.classList.toggle("choisi", i === index));
      onChange(valeurs[index]);
    }, 120);
  };
}

// Genre : change aussi le menu de coupes proposé juste en dessous (2
// propres à chaque genre, jamais les 4 mélangées) — si la coupe choisie
// jusque-là n'existe pas pour le nouveau genre, on retombe sur la
// première de sa liste plutôt que de garder un id invalide.
function choisirGenreInitial(genre) {
  configInitiale.genre = genre;
  document.getElementById("pc-genre-garcon").classList.toggle("choisi", genre === "garcon");
  document.getElementById("pc-genre-fille").classList.toggle("choisi", genre === "fille");
  if (!COUPES_PAR_GENRE[genre].some(c => c.id === configInitiale.coupe)) {
    configInitiale.coupe = COUPES_PAR_GENRE[genre][0].id;
  }
  construireChoixApparenceInitiale();
}

function choisirTraitInitial(trait, valeur) {
  configInitiale[trait] = valeur;
  construireChoixApparenceInitiale();
}

// Un menu à choix (boutons/pastilles) par trait plutôt qu'une grille
// d'avatars déjà composés à parcourir — à 320 combinaisons, une galerie
// de photos à faire défiler n'aurait plus de sens (demande explicite).
// L'aperçu (#pc-avatar-apercu-img) reste le seul retour visuel de la
// combinaison choisie, mis à jour à chaque changement.
function construireChoixApparenceInitiale() {
  const coupeConteneur = document.getElementById("pc-coupe-choix");
  coupeConteneur.innerHTML = "";
  COUPES_PAR_GENRE[configInitiale.genre].forEach(c => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "nr-lieu-btn" + (c.id === configInitiale.coupe ? " choisi" : "");
    b.textContent = c.nom;
    b.onclick = () => choisirTraitInitial("coupe", c.id);
    coupeConteneur.appendChild(b);
  });

  construireSwatchesInitiale("pc-peau-choix", PEAUX, "peau");
  construireSwatchesInitiale("pc-cheveux-choix", CHEVEUX_COULEURS, "cheveux");
  construireSwatchesInitiale("pc-yeux-choix", YEUX_COULEURS, "yeux");

  document.getElementById("pc-avatar-apercu-img").src = spritesPourTraits(configInitiale).sprites.base;
}

function construireSwatchesInitiale(idConteneur, options, trait) {
  const conteneur = document.getElementById(idConteneur);
  conteneur.innerHTML = "";
  options.forEach(o => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "pc-swatch" + (o.id === configInitiale[trait] ? " choisi" : "");
    b.style.background = o.couleur;
    b.setAttribute("aria-label", trait + " " + o.id);
    b.onclick = () => choisirTraitInitial(trait, o.id);
    conteneur.appendChild(b);
  });
}

// Pas de vérification sur la date de naissance : contrairement au
// prénom, une roulette a toujours une valeur centrée (cf.
// construireRoueDate()), jamais un état "vide" à bloquer.
function validerPremiereConfiguration() {
  const prenom = document.getElementById("pc-prenom").value.trim();
  if (!prenom) {
    document.getElementById("pc-erreur").textContent = "Donne un prénom avant de continuer.";
    return;
  }
  configInitiale.prenom = prenom;
  demarrerCodeInitial();
}

// Même pavé numérique que la vérification/le changement de code (cf.
// construireClavier()/majCasesCode() plus bas) — seul modeCode change ce
// qui se passe une fois les deux saisies confirmées identiques (cf.
// validerCode()).
function demarrerCodeInitial() {
  ecranAvantValidation = "screen-premiere-configuration";
  codeSaisi = "";
  modeCode = "initial1";
  premierNouveauCode = "";
  document.getElementById("validation-sous-titre").textContent = "Choisis un code parent à 4 chiffres.";
  document.getElementById("correction-wrap").classList.add("hidden");
  document.getElementById("pavecode-wrap").classList.remove("hidden");
  document.getElementById("pavecode-erreur").textContent = "";
  construireClavier(document.getElementById("pavecode-clavier"), appuyerTouche);
  majCasesCode(document.getElementById("pavecode-cases"), codeSaisi);
  afficherEcran("screen-validation");
}

// Code confirmé deux fois (cf. validerCode(), branche "initial2") : crée
// réellement le profil — jusqu'ici rien n'était encore écrit à part le
// prénom/avatar en mémoire (`configInitiale`). Ordre important : le
// profil doit exister dans `profils_perso` ET `acolyte_enfant` doit déjà
// pointer dessus avant d'amorcer routines_perso, puisque
// `sauverRoutinesPerso()` passe par `cle()` -> `profilActif()`.
function finaliserPremiereConfiguration() {
  const { silhouette, dodo, sprites } = spritesPourTraits(configInitiale);
  const id = "enfant-" + Date.now();
  // Format "AAAA-M-J", comme cleJourPour() — cf. anniversaireAujourdhui()/
  // ageDepuis() plus bas, qui la reparsent.
  const naissance = configInitiale.naissanceAnnee + "-" + configInitiale.naissanceMois + "-" + configInitiale.naissanceJour;
  const profil = { id, prefixe: id, prenom: configInitiale.prenom, genre: configInitiale.genre, naissance, dodo, sprites };

  const perso = chargerProfilsPerso();
  perso.push(profil);
  sauverProfilsPerso(perso);
  try { localStorage.setItem("acolyte_enfant", id); } catch (e) {}

  sauverRoutinesPerso(routinesDemarrage(profil.prenom, silhouette, profil.genre).map(r =>
    (r.id === "shabiller" || r.id === "partir") ? Object.assign({ chainee: true }, r) : r
  ));

  // L'acolyte vient déjà de se présenter pendant l'accueil (cf.
  // ouvrirAccueil()) — pas de rituel de réveil ("réveille l'avatar
  // endormi") ce tout premier jour, ça n'aurait pas de sens juste après
  // s'être rencontrés. `reveilFait` à `true` d'entrée pour que
  // `demarrer()` aille directement au menu au rechargement ci-dessous ;
  // les jours suivants suivent le rituel normal, cf. `endormir()`.
  const etat = chargerEtat();
  etat.reveilFait = true;
  sauverEtat(etat);

  location.reload();
}

// `calque` = data-calque (ou tableau de data-calque) à révéler sur le
// sprite ; `retire: true` les CACHE au lieu de les révéler (routine du
// soir : on déshabille). `badge` = badge emoji pour ce qui n'a pas de
// sprite dédié (sac, brossage de dents).
//
// Petit-déjeuner n'est pas une tâche ici : ce sera un mini-jeu dédié
// (table de la cuisine, plusieurs sous-étapes) — cf. TODO.md. Le
// brossage de dents est ici une simple tâche en attendant le mini-jeu
// miroir prévu plus tard (même TODO).
// `emoji` (par routine) : utilisé par l'écran "Ma journée"
// (`construireJournee()`) pour repérer chaque routine d'un coup d'œil.
//
// Gabarit de démarrage : un déploiement neuf n'a AUCUNE routine en dur —
// `routinesDemarrage(prenom, silhouette)` sert uniquement à AMORCER
// `routines_perso` du profil qu'on vient de créer (cf.
// `finaliserPremiereConfiguration()`), avec les mêmes `id`/`nom`/nombre de
// routines que le reste de l'app attend déjà ("shabiller"/"partir"/"soir",
// cf. PLANNING_DEFAUT plus bas) mais un contenu neutre, immédiatement
// modifiable comme n'importe quelle routine perso — aucune n'est figée.
// `silhouette` ("pantalon"/"robe", choisie avec l'avatar) ne pilote que
// les vêtements du bas de "S'habiller" et les calques déshabillés le
// soir ; le reste du moteur (synchroniserRoutineEcran, marquerTache,
// rendreGlissable...) reste entièrement générique et partagé : il ne lit
// jamais "shabiller" ou "calecon" en dur, seulement la structure
// Routine/Tâche.
function routinesDemarrage(prenom, silhouette, genre) {
  const enRobe = silhouette === "robe";
  const dessous = enRobe
    ? { id: "culotte",  texte: "Mets ta culotte.",  emoji: "🩲", zone: "zone-corps", calque: "calque-culotte" }
    : { id: "calecon",  texte: "Mets ton caleçon.", emoji: "🩲", zone: "zone-corps", calque: "calque-calecon" };
  const bas = enRobe
    ? { id: "robe",     texte: "Mets ta robe.",     emoji: "👗", zone: "zone-corps", calque: "calque-robe" }
    : { id: "pantalon", texte: "Mets ton pantalon.", emoji: "👖", zone: "zone-corps", calque: "calque-pantalon" };
  const calquesHabits = enRobe
    ? ["calque-haut", "calque-robe", "calque-chaussettes", "calque-chaussures", "calque-manteau"]
    : ["calque-haut", "calque-pantalon", "calque-chaussettes", "calque-chaussures", "calque-manteau"];
  return [
    {
      id: "shabiller",
      nom: "S'habiller",
      emoji: "👕",
      lieu: "chambre",
      felicitation: accorderAuGenre("Bravo " + prenom + ", tu t'es habillé·e tout seul·e !", genre),
      taches: [
        dessous,
        { id: "haut",        texte: "Mets ton haut.",        emoji: "👚", zone: "zone-corps",  calque: "calque-haut" },
        bas,
        { id: "chaussettes", texte: "Mets tes chaussettes.", emoji: "🧦", zone: "zone-corps",  calque: "calque-chaussettes" },
      ],
    },
    {
      id: "partir",
      nom: "Se préparer à partir",
      emoji: "🚪",
      lieu: "salon",
      felicitation: accorderAuGenre("Bravo " + prenom + ", tu es prêt·e à partir !", genre),
      // Manteau et sac volontairement absents du gabarit de départ (pas
      // toujours utiles selon la saison) — un parent peut ajouter une
      // tâche "Mets ton manteau" (calque "calque-manteau") ou "Prends ton
      // sac" (badge "dos") depuis l'espace parent (modifier la routine).
      taches: [
        { id: "chaussures", texte: "Mets tes chaussures.", emoji: "👟", zone: "zone-corps", calque: "calque-chaussures" },
      ],
    },
    {
      id: "soir",
      nom: "Aller se coucher",
      emoji: "🌙",
      lieu: "chambre",
      felicitation: accorderAuGenre("Bravo " + prenom + ", tu es prêt·e à dormir !", genre),
      // Volontairement PAS chaînée après "S'habiller"/"Se préparer à
      // partir" (contrairement aux autres routines, cf. construireMenu()) :
      // le coucher n'a rien à voir avec le fait d'être habillé pour sortir,
      // et les enchaîner créait un vrai risque — si un parent relance
      // "S'habiller" en soirée (cf. espace parent), "Aller se coucher" se
      // serait retrouvée verrouillée juste avant le coucher. À la place,
      // débloquée par l'heure : avant `disponibleApresHeure`, elle reste
      // inaccessible (pour éviter l'autre risque inverse — un enfant qui
      // irait se déshabiller pour "aller se coucher" en pleine journée sans
      // avoir rien fait d'autre), après, elle l'est, indépendamment de
      // l'état des autres routines.
      disponibleApresHeure: 18,
      taches: [
        // `avatarGlissable: true` (au lieu de `zone`) : contrairement aux
        // autres tâches, ce n'est pas l'icône de la liste qu'on glisse vers
        // l'avatar, mais l'avatar (habillé) lui-même qu'on tire hors de la
        // scène — plus logique pour DÉshabiller que d'amener une carte
        // jusqu'à lui (cf. rendreAvatarGlissable, plus bas).
        { id: "enlever",  texte: "Enlève tes vêtements.", emoji: "👕",
          calque: calquesHabits, retire: true, avatarGlissable: true },
        // `pileGlissable: true` : contrairement aux autres tâches, ce n'est
        // pas l'icône de la liste qui se glisse vers `zone` mais la pile de
        // vêtements qui apparaît dans la scène une fois "enlever" fait (cf.
        // #pile-vetements, synchroniserRoutineEcran()) — matérialise les
        // habits qui viennent de tomber, plutôt que de les faire disparaître
        // pour de bon avant même cette tâche.
        { id: "ranger",   texte: "Range tes vêtements ou mets-les au sale.", emoji: "🧺", zone: "zone-panier", pileGlissable: true },
        // `miniJeu: "dents"` (au lieu de `zone`) : cette tâche s'ouvre en
        // tapant sa ligne (cf. ouvrirMiniJeu()) plutôt qu'en y glissant
        // l'icône — lance l'écran dédié `screen-dents` (minuteur +
        // 6 zones). `badge`/`badgeFait` restent : le ✨ sur le visage de
        // l'avatar continue de refléter que les dents sont faites, une
        // fois le mini-jeu terminé (marquerTache() y est appelé pareil).
        { id: "dents",    texte: "Brosse-toi les dents.",                   emoji: "🪥", miniJeu: "dents", badge: "visage", badgeFait: "✨" },
        // `miniJeu: "histoire"` (au lieu de `zone`), même principe que
        // "dents" ci-dessus : ouvre l'écran dédié `screen-histoire`
        // (image + texte) en tapant la ligne, plutôt qu'un glisser-déposer
        // — pas de geste à faire, juste un moment calme sur le canapé.
        { id: "histoire", texte: "On lit l'histoire.",                      emoji: "📖", miniJeu: "histoire" },
        { id: "coucher",  texte: "Je vais me coucher.",                     emoji: "😴", zone: "zone-corps" },
      ],
    },
  ];
}

// Repas : purement informatifs pour l'écran "Ma journée"
// (`construireJournee()`) — pas des routines (pas de tâches, pas
// d'horaire pour l'instant). `id` sert de référence dans `PLANNING_DEFAUT`
// et dans le planning édité par les parents (cf. plus bas).
const REPAS = [
  { id: "petit-dej", nom: "Petit-déjeuner", emoji: "🍳" },
  { id: "dejeuner",  nom: "Déjeuner",       emoji: "🍽️" },
  { id: "gouter",    nom: "Goûter",         emoji: "🍪" },
  { id: "diner",     nom: "Dîner",          emoji: "🌙🍽️" },
];

// Aventures : sorties, sur le même principe que le trajet/arrivée d'une
// visite chez une praticienne (route en voiture -> programme annoncé à
// l'arrivée -> "C'est parti"). Une aventure n'apparaît un jour que si elle
// est dans le planning de ce jour (semaine type ou jour préparé) ; l'ancien
// champ `date` n'est plus lu qu'une fois, par migrerDatesUneFois().
// `personne` (emoji + nom) affiche un 2ᵉ sprite à l'arrivée quand
// l'aventure se passe chez quelqu'un ; absent pour une sortie sans
// praticien (magasin, école...).
// `recompensePieces` : 0 = pas de récompense propre à cette aventure
// (le cas d'une visite chez une praticienne, typiquement). > 0 = une
// pièce sort du coffre à la fin (monnaie distincte des étoiles de
// routine, cf. `ajouterPieces`).
// `texteTrajetRetour` : texte du trajet retour (vers la maison), une
// fois l'aventure terminée ("C'est parti" déclenche ce retour, pas la
// récompense directement, cf. `terminerAventure`) — texte par défaut si
// absent.
// `apres` : où insérer cette aventure dans le planning par défaut du
// jour (cf. `planningParDefaut()`) — référence `{ type, id }` vers un
// autre item ("routine"/"repas"/"aventure"). Absent = ajoutée en fin de
// journée.
//
// AVENTURES_COMMUNES : catalogue de départ, identique pour tous les
// profils (juste l'école, à titre d'exemple). Un profil n'a par ailleurs
// AUCUNE aventure propre en dur (cf. `aventuresPropres()`, absent d'un
// profil créé depuis l'app — `toutesLesAventures()` traite ça comme un
// catalogue vide) : une visite chez une praticienne, comme toute autre
// sortie propre à une famille, s'ajoute depuis l'espace parent ("+
// Nouvelle activité") plutôt que d'être codée en dur — même structure de
// données, rien de nouveau côté moteur.
const AVENTURES_COMMUNES = [
  {
    id: "ecole",
    lieu: "L'école",
    emoji: "🎒",
    texteTrajet: "On roule vers l'école.",
    texteArrivee: "On est arrivés à l'école.",
    programme: ["1. On dit au revoir", "2. On passe une bonne journée", "3. Un parent vient nous chercher"],
    recompensePieces: 0,
    texteTrajetRetour: "L'école est finie, on rentre à la maison.",
  },
];

let dragCtx = null;
let routineActuelleId = null;
let aventureActuelleId = null;
// "aller" (vers l'aventure) ou "retour" (vers la maison, après "C'est
// parti") — pilote le texte du trajet et ce que fait la validation
// parent de "On est arrivés" (cf. allerAuTrajet/allerValidationArrivee).
let sensTrajet = "aller";

// Activités créées par un parent (cf. ouvrirNouvelleAventure()) —
// persistées à part des catalogues en dur, jamais remises à zéro, sous
// une clé propre à l'enfant actif (cf. `cle()`). `toutesLesAventures()`
// est la vue combinée à utiliser partout où on cherche/liste des
// aventures : communes + propres au profil actif + créées par un parent
// pour ce profil — le reste du code n'a pas à savoir d'où une aventure
// donnée vient.
function chargerAventuresPerso() {
  try { return JSON.parse(localStorage.getItem(cle("aventures_perso")) || "[]"); } catch (e) { return []; }
}
function sauverAventuresPerso(liste) {
  try { localStorage.setItem(cle("aventures_perso"), JSON.stringify(liste)); } catch (e) {}
}
// Même principe que toutesLesRoutines() ci-dessus : une activité modifiée
// (cf. creerNouvelleAventure(), branche édition) est sauvée sous le même
// id, codé en dur ou déjà perso, et le remplace donc ici plutôt que de
// s'y ajouter en double.
function toutesLesAventures() {
  const perso = chargerAventuresPerso();
  const idsPerso = new Set(perso.map(a => a.id));
  // `aventuresPropres` : absent d'un profil créé depuis l'app (cf.
  // tousLesProfils() plus haut) — traité comme "aucune aventure propre en
  // dur", pas une erreur.
  const propres = profilActif().aventuresPropres ? profilActif().aventuresPropres() : [];
  return AVENTURES_COMMUNES.concat(propres).filter(a => !idsPerso.has(a.id)).concat(perso);
}

function aventureParId(id) { return toutesLesAventures().find(a => a.id === id); }
// Une aventure est accessible aujourd'hui dans "Partir à l'aventure" si
// et seulement si elle est dans le planning du jour (`etat.planning`). Ça lie directement les
// deux, comme demandé : ajouter/retirer une activité du planning
// l'ajoute/la retire de "Partir à l'aventure", que ce soit via "Ajouter
// à la journée" ou en créant une nouvelle activité.
function aventuresPlanifieesAujourdhui() {
  const etat = chargerEtat();
  return etat.planning
    .filter(it => it.type === "aventure")
    .map(it => aventureParId(it.id))
    .filter(Boolean);
}

// Journée par défaut d'origine : une suite d'items `{ type:
// "routine"|"aventure"|"repas", id }` dans l'ordre chronologique attendu,
// qui sert à initialiser la semaine type (cf. journeeTypeHistorique()).
const PLANNING_DEFAUT = [
  { type: "repas", id: "petit-dej" },
  { type: "routine", id: "shabiller" },
  { type: "routine", id: "partir" },
  { type: "repas", id: "dejeuner" },
  { type: "repas", id: "gouter" },
  { type: "repas", id: "diner" },
  { type: "routine", id: "soir" },
];
// Journée par défaut d'avant la semaine type : sert uniquement à
// initialiser la semaine type d'un appareil, pour que rien ne change à
// la mise à jour. `heureDefaut` des repas n'est copié dans `heure` qu'ici.
function journeeTypeHistorique() {
  const items = PLANNING_DEFAUT.map(ref => {
    const entree = { ...ref };
    if (ref.type === "repas") {
      const r = REPAS.find(x => x.id === ref.id);
      if (r && r.heureDefaut) entree.heure = r.heureDefaut;
    }
    return entree;
  });
  // Routines créées par un parent : absentes de PLANNING_DEFAUT (qui ne
  // connaît que le catalogue en dur), donc ajoutées ici en plus, à la
  // fin — récurrentes tous les jours comme les autres routines,
  // contrairement aux aventures qui ne reviennent que si programmées.
  chargerRoutinesPerso().forEach(r => {
    if (!items.some(it => it.type === "routine" && it.id === r.id)) items.push({ type: "routine", id: r.id });
  });
  return items;
}

// Semaine type (cf. semaine.js) : `{ "1": items, …, "7": items }`, lundi = 1.
function chargerSemaineType() {
  try {
    const st = JSON.parse(localStorage.getItem(cle("semaine_type")));
    if (st && Array.isArray(st["1"])) return st;
  } catch (e) {}
  const st = creerSemaineType(journeeTypeHistorique());
  sauverSemaineType(st);
  return st;
}
function sauverSemaineType(st) {
  try { localStorage.setItem(cle("semaine_type"), JSON.stringify(st)); } catch (e) {}
}

// Le coucher : la routine débloquée par l'heure (`disponibleApresHeure`),
// qui clôt la journée de l'enfant.
function estItemCoucher(item) {
  return item.type === "routine" && (routineParId(item.id) || {}).disponibleApresHeure !== undefined;
}

// Planning d'une journée qui n'a pas été préparée à l'avance : celui de
// son jour dans la semaine type. `dateKey` absent = aujourd'hui.
function planningParDefaut(dateKey) {
  return planningDuJour(chargerSemaineType(), dateKey || cleJour());
}

// Les activités portaient autrefois une `date` unique : à la première
// ouverture après la semaine type, chaque date à venir est recopiée dans le
// planning de ce jour, puis le champ n'est plus lu.
function migrerDatesUneFois() {
  try { if (localStorage.getItem(cle("migration_dates")) === "1") return; } catch (e) { return; }
  const aujourdhui = cleJour();
  const { planningFutur, pourAujourdhui } = migrerActivitesDatees(toutesLesAventures(), chargerPlanningFutur(), aujourdhui, planningParDefaut, estItemCoucher);
  let journee = null;
  try { journee = JSON.parse(localStorage.getItem(cle("journee"))); } catch (e) {}
  if (pourAujourdhui.length && journee && journee.jour === aujourdhui && Array.isArray(journee.planning)) {
    pourAujourdhui.forEach(a => { journee.planning = insererActivite(journee.planning, a, estItemCoucher); });
    sauverEtat(journee);
  } else if (pourAujourdhui.length) {
    let base = planningFutur[aujourdhui] || planningParDefaut(aujourdhui);
    pourAujourdhui.forEach(a => { base = insererActivite(base, a, estItemCoucher); });
    planningFutur[aujourdhui] = base;
  }
  sauverPlanningFutur(planningFutur);
  try { localStorage.setItem(cle("migration_dates"), "1"); } catch (e) {}
}
// Résout un item de planning en `{ emoji, nom }` à afficher — toujours
// dérivé des catalogues (ROUTINES/AVENTURES/REPAS), jamais dupliqué dans
// l'item lui-même, pour rester à jour si la routine/aventure change.
// Renvoie `null` pour une référence orpheline (id qui n'existe plus).
function libelleItemPlanning(item) {
  if (item.type === "routine") { const r = routineParId(item.id); return r ? { emoji: r.emoji, nom: r.nom, entourage: entourageDe(r) } : null; }
  if (item.type === "aventure") { const a = aventureParId(item.id); return a ? { emoji: a.emoji, nom: a.lieu, entourage: entourageDe(a) } : null; }
  if (item.type === "repas") { const r = REPAS.find(x => x.id === item.id); return r ? { emoji: r.emoji, nom: r.nom } : null; }
  if (item.type === "note") return item.texte ? { emoji: "💬", nom: item.texte, entourage: entourageDe(item) } : null;
  if (item.type === "choix") {
    // Une fois choisi, le moment au choix EST l'activité choisie ; avant,
    // il annonce ses idées (une activité supprimée depuis est ignorée).
    const choisie = item.choisi && aventureParId(item.choisi);
    if (choisie) return { emoji: choisie.emoji, nom: choisie.lieu, entourage: entourageDe(choisie) };
    const options = (item.options || []).map(aventureParId).filter(Boolean);
    return options.length ? { emoji: "🎲", nom: "Au choix : " + listeOu(options.map(a => a.lieu)) } : null;
  }
  return null;
}

// « A, B ou C »
function listeOu(noms) {
  return noms.length <= 1 ? noms.join("") : noms.slice(0, -1).join(", ") + " ou " + noms[noms.length - 1];
}

// ---------------------------------------------------------------------
// Persistance (reset automatique chaque matin)
// ---------------------------------------------------------------------
// Toujours l'HEURE RÉELLE (`new Date()`, jamais `dateActuelle()`) —
// délibéré : contrairement à l'affichage (heure/repère "maintenant" sur
// "Ma journée", déblocage horaire d'une routine), le jour lui-même
// n'est jamais simulable au panneau debug, pour ne jamais risquer
// d'écraser/archiver un vrai état de journée pendant un test.
function cleJourPour(d) { return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); }
function cleJour() { return cleJourPour(new Date()); }
// `planningSeed` optionnel : contenu d'un jour préparé à l'avance (cf.
// `consommerPlanningFuturPourAujourdhui()`, dans `chargerEtat()`), pour
// ne pas ré-écraser un planning déjà personnalisé par un parent avec le
// squelette générique dès que ce jour devient "aujourd'hui".
function etatParDefaut(planningSeed) {
  const routines = {};
  toutesLesRoutines().forEach(r => { routines[r.id] = { fait: [], valide: false, etoileDonnee: false }; });
  return { jour: cleJour(), routines, etoiles: 0, journeeFaite: false, reveilFait: false, reveil: { bienDormi: null, humeur: null }, planning: planningSeed || planningParDefaut(), seances: [], itemsMigres: true };
}
// Répare un état du jour dont la forme est incomplète (ex. un champ
// ajouté par une mise à jour de l'app depuis la dernière sauvegarde de
// la tablette) EN PLACE, plutôt que de tout jeter. Avant (`etatValide()`,
// tout-ou-rien), le moindre champ manquant faisait repartir d'un état
// neuf — un enfant a perdu une vraie progression de sa journée comme ça
// (cf. discussion produit, ajout de `planning`). Ne répare que si le
// JOUR correspond : un changement de date reste un vrai nouveau départ
// (l'ancien état est alors archivé, pas réparé — cf. `archiverJournee()`
// dans `chargerEtat()`). Renvoie `null` s'il n'y a vraiment rien
// d'exploitable (pas de `routines` du tout).
function etatRepare(etat) {
  if (!etat || typeof etat !== "object" || etat.jour !== cleJour()) return null;
  if (!etat.routines || typeof etat.routines !== "object") return null;
  toutesLesRoutines().forEach(r => {
    if (!etat.routines[r.id] || !Array.isArray(etat.routines[r.id].fait)) {
      etat.routines[r.id] = { fait: [], valide: false, etoileDonnee: false };
    }
    // L'étoile est acquise une fois par jour (cf. ouvrirCoffreRoutine()) ;
    // un état d'avant ce champ la déduit de `valide`.
    if (typeof etat.routines[r.id].etoileDonnee !== "boolean") etat.routines[r.id].etoileDonnee = !!etat.routines[r.id].valide;
  });
  if (!Array.isArray(etat.planning)) etat.planning = planningParDefaut();
  // Avancement par item (liste du jour) : une journée commencée avant
  // marque une seule fois le premier item de chaque routine déjà validée.
  if (!etat.itemsMigres) {
    toutesLesRoutines().forEach(r => { if (etat.routines[r.id].valide) marquerItemFait(etat, "routine", r.id); });
    etat.itemsMigres = true;
  }
  if (typeof etat.etoiles !== "number") etat.etoiles = 0;
  if (typeof etat.journeeFaite !== "boolean") etat.journeeFaite = false;
  if (typeof etat.reveilFait !== "boolean") etat.reveilFait = false;
  if (!etat.reveil || typeof etat.reveil !== "object") etat.reveil = { bienDormi: null, humeur: null };
  if (!Array.isArray(etat.seances)) etat.seances = [];
  return etat;
}

// Historique des journées passées (`cle("historique")`, ex.
// `<prefixe>_historique`) — jamais remis à zéro, contrairement à
// `cle("journee")`. Demandé explicitement une fois l'usage réel commencé :
// jusqu'ici, une journée terminée était perdue dès que la suivante
// commençait. Archivée ici, juste avant d'être écrasée par une nouvelle
// journée (cf. `chargerEtat()`) — pas à chaque reset de test
// (`reinitialiserTout()`), qui ne représente pas une vraie journée.
// Bornée à 90 entrées pour ne pas grossir sans fin.
function archiverJournee(etat) {
  if (!etat || !etat.routines) return; // rien d'exploitable à garder
  try {
    const historique = JSON.parse(localStorage.getItem(cle("historique")) || "[]");
    historique.push({
      jour: etat.jour,
      etoiles: etat.etoiles || 0,
      routinesValidees: toutesLesRoutines().filter(r => etat.routines[r.id] && etat.routines[r.id].valide).map(r => r.id),
      journeeFaite: !!etat.journeeFaite,
      reveil: etat.reveil || { bienDormi: null, humeur: null },
      // Notes de séance (cf. validerSeance()) : réservées aux parents,
      // jamais montrées à l'enfant (aucun écran enfant ne lit
      // `etat.seances`) — c'est pour ça qu'elles doivent survivre au
      // changement de jour comme le reste de l'historique, plutôt que
      // d'être jetées avec `cle("journee")`.
      seances: Array.isArray(etat.seances) ? etat.seances : [],
    });
    while (historique.length > 90) historique.shift();
    localStorage.setItem(cle("historique"), JSON.stringify(historique));
  } catch (e) {}
}

function chargerEtat() {
  let etat = null;
  try { const b = localStorage.getItem(cle("journee")); etat = b ? JSON.parse(b) : null; } catch (e) {}

  if (etat && etat.jour && etat.jour !== cleJour()) {
    // Coucher pas validé hier : ses étoiles attendent quand même ce matin.
    if (etat.routines) mettreDeCoteEtoiles(etat);
    archiverJournee(etat);
    etat = null;
    // Nouveau jour : les minuteurs d'hier n'ont plus de sens (cf. la
    // section "Minuteur générique" plus bas) — sans ça, un `tacheId`/
    // `routineId` qui coïncide avec une tâche d'aujourd'hui (cas courant,
    // mêmes ids d'un jour à l'autre) empêcherait à tort son minuteur de
    // redémarrer.
    sauverMinuteursActifs([]);
  }

  etat = etatRepare(etat) || etatParDefaut(consommerPlanningFuturPourAujourdhui());
  sauverEtat(etat);
  return etat;
}
function sauverEtat(etat) {
  try { localStorage.setItem(cle("journee"), JSON.stringify(etat)); } catch (e) {}
}
// Une routine ou une activité terminée fait avancer la liste du jour :
// c'est le premier item restant de ce type et de cet id (cf. journee.js)
// qui passe à `fait`. Modifie `etat` sans le sauver.
function marquerItemFait(etat, type, id) {
  const i = indexAMarquer(etat.planning, type, id);
  if (i !== -1) etat.planning[i].fait = true;
}

// Planning à venir — carnet de jours FUTURS que l'espace parent permet
// de préparer à l'avance (cf. construireParentPlanningJournees()), distinct
// de `etat.planning` (aujourd'hui, en direct). Map `{ "YYYY-M-D":
// [items...] }`, même forme d'item que `etat.planning`. Une date n'y
// apparaît qu'à la première vraie modification (cf.
// `chargerPlanningCible()`/`sauverPlanningCible()`) — l'avoir seulement
// ouverte ne fige rien. Chargement tolérant, même principe que
// `chargerAventuresPerso()`.
function chargerPlanningFutur() {
  try { return JSON.parse(localStorage.getItem(cle("planning_futur")) || "{}"); } catch (e) { return {}; }
}
function sauverPlanningFutur(map) {
  try { localStorage.setItem(cle("planning_futur"), JSON.stringify(map)); } catch (e) {}
}
// Appelée UNIQUEMENT depuis `chargerEtat()`, sur la branche "vrai
// changement de jour" (jamais sur la réparation same-day d'`etatRepare()`
// — donc jamais de double consommation en rechargeant plusieurs fois la
// même journée). Si le jour qui commence avait été préparé à l'avance,
// le retire du carnet à venir (il devient "aujourd'hui", les
// modifications suivantes passent par `etat.planning` normalement, pas
// par ce carnet) et sert de graine à `etatParDefaut()`.
function consommerPlanningFuturPourAujourdhui() {
  const futur = chargerPlanningFutur();
  const c = cleJour();
  if (!Array.isArray(futur[c])) return undefined;
  const seed = futur[c];
  delete futur[c];
  sauverPlanningFutur(futur);
  return seed;
}
// Routines créées par un parent (cf. creerNouvelleRoutine()) — même
// principe que chargerAventuresPerso()/toutesLesAventures() : persistées
// à part du catalogue en dur du profil actif, jamais remises à zéro,
// fusionnées partout où le code cherche/liste des routines pour que le
// reste ne distingue pas d'où une routine donnée vient.
function chargerRoutinesPerso() {
  try { return JSON.parse(localStorage.getItem(cle("routines_perso")) || "[]"); } catch (e) { return []; }
}
function sauverRoutinesPerso(liste) {
  try { localStorage.setItem(cle("routines_perso"), JSON.stringify(liste)); } catch (e) {}
}
// Une routine modifiée par un parent (cf. creerNouvelleRoutine(), branche
// édition) est sauvée dans `routines_perso` sous le MÊME id que
// l'originale, codée en dur ou déjà perso — elle la remplace donc ici
// plutôt que de s'y ajouter en double (`filter` sur les ids présents côté
// perso avant le concat). Reste vrai aussi pour une routine perso
// modifiée plusieurs fois : `chargerRoutinesPerso()` ne peut porter
// qu'une seule entrée par id (cf. la mise à jour "en place" au moment de
// la sauvegarde).
function toutesLesRoutines() {
  const perso = chargerRoutinesPerso();
  const idsPerso = new Set(perso.map(r => r.id));
  // `routines` : absent d'un profil créé depuis l'app (cf. tousLesProfils()
  // plus haut) — tout son catalogue vit alors dans routines_perso (amorcé
  // par routinesDemarrage() à la création, cf.
  // finaliserPremiereConfiguration()), traité ici comme un socle en dur
  // vide plutôt qu'une erreur.
  const base = profilActif().routines ? profilActif().routines() : [];
  return base.filter(r => !idsPerso.has(r.id)).concat(perso);
}

function routineParId(id) { return toutesLesRoutines().find(r => r.id === id); }

// Entourage ("qui est là ?") : catalogue léger — nom, emoji, rôle en
// texte libre. `ENTOURAGE_COMMUNES` est le socle en dur, identique sur
// tous les appareils, sur le même principe que `AVENTURES_COMMUNES` —
// vide par défaut (aucune famille/praticien(ne) n'est universelle) ; un
// parent ajoute les siens depuis l'espace parent ("+ Nouvelle personne"),
// persistés à part (`chargerEntouragePerso`/`sauverEntouragePerso`, même
// principe que les catalogues perso Activités/Routines) et propres à CET
// appareil, jamais remis à zéro.
//
// ⚠️ Volontairement DISTINCT du champ `personne` déjà présent sur les
// aventures chez une praticienne : `personne` n'est pas qu'un affichage,
// sa seule présence bascule "C'est parti" vers tout le flux "séance
// praticienne" (cf. `terminerVisite()`). Une activité/routine taguée avec
// une personne de CE catalogue (`entourageIds`, cf. `entourageDe()` plus
// bas) ne doit donc jamais se voir attribuer de `personne` — les deux
// notions ne se fusionnent pas, même si elles se ressemblent en surface
// (une praticienne peut exister dans LES DEUX catalogues à la fois, avec
// des rôles différents et non substituables — cf. `ouvrirEditionPersonne()`
// plus bas).
const ENTOURAGE_COMMUNES = [];
function chargerEntouragePerso() {
  try { return JSON.parse(localStorage.getItem(cle("entourage_perso")) || "[]"); } catch (e) { return []; }
}
function sauverEntouragePerso(liste) {
  try { localStorage.setItem(cle("entourage_perso"), JSON.stringify(liste)); } catch (e) {}
}
// Même principe de masquage par id que toutesLesRoutines()/
// toutesLesAventures() : une personne modifiée (cf. creerNouvellePersonne(),
// branche édition) est sauvée dans `entourage_perso` sous le même id que
// l'originale, codée en dur ou déjà perso, et la remplace donc ici
// plutôt que de s'y ajouter en double.
function toutesLesPersonnes() {
  const perso = chargerEntouragePerso();
  const idsPerso = new Set(perso.map(p => p.id));
  return ENTOURAGE_COMMUNES.filter(p => !idsPerso.has(p.id)).concat(perso);
}
function personneParId(id) { return toutesLesPersonnes().find(p => p.id === id); }

// Résout `entourageIds` (routine/aventure) en personnes complètes, dans
// le même esprit que le reste de `libelleItemPlanning()` : toujours
// dérivé du catalogue à l'affichage, jamais dupliqué dans l'item. `null`
// si absent/vide ou si toutes les personnes référencées ont été
// supprimées depuis (ids orphelins silencieusement ignorés).
function entourageDe(obj) {
  if (!obj.entourageIds || obj.entourageIds.length === 0) return null;
  const personnes = obj.entourageIds.map(personneParId).filter(Boolean);
  return personnes.length ? personnes : null;
}

// Pièces : monnaie gagnée en aventure, distincte des étoiles de routine.
// Stockée à part de `cle("journee")` et JAMAIS remise à zéro au
// changement de jour (contrairement aux étoiles) : une pièce reste
// gagnée jusqu'à être dépensée par l'enfant (activité de son choix) ou
// donnée à ses parents dans la vraie vie — ce n'est pas une jauge
// quotidienne.
function chargerPieces() {
  try {
    const n = JSON.parse(localStorage.getItem(cle("pieces")));
    return typeof n === "number" && n >= 0 ? n : 0;
  } catch (e) { return 0; }
}
function sauverPieces(n) {
  try { localStorage.setItem(cle("pieces"), JSON.stringify(n)); } catch (e) {}
}
// Seul point d'entrée qui écrit `cle("pieces")` (avec `sauverPieces`,
// jamais appelée ailleurs) : le total ne peut donc **jamais diminuer**,
// même si `n` était un jour négatif par erreur (`Math.max(0, n)`) — les
// pièces ne se remettent pas à zéro comme les étoiles, et rien dans
// l'app ne doit pouvoir les retirer du compte, cf. plus haut ("dépensée
// ... dans la vraie vie", pas une transaction dans l'app). Fonctionne
// pareil pour n'importe quel profil (clé propre via `cle()`) sans
// variante parallèle, pour garder la même garantie partout.
function ajouterPieces(n) {
  migrerPiecesUneFois();
  const total = chargerPieces() + Math.max(0, n);
  sauverPieces(total);
  sauverPiecesAPoser(chargerPiecesAPoser() + Math.max(0, n));
  return total;
}

// Pièces gagnées qui attendent d'être posées sur le chemin (cf. l'écran
// « Mon chemin ») — le total `cle("pieces")` ne fait que monter, celles-ci
// diminuent quand l'enfant en pose une.
function chargerPiecesAPoser() {
  try {
    const n = JSON.parse(localStorage.getItem(cle("pieces_a_poser")));
    return typeof n === "number" && n >= 0 ? n : 0;
  } catch (e) { return 0; }
}
function sauverPiecesAPoser(n) {
  try { localStorage.setItem(cle("pieces_a_poser"), JSON.stringify(Math.max(0, n))); } catch (e) {}
}
// Les pièces gagnées avant le chemin deviennent des pièces à poser : rien
// n'est perdu, et la première ouverture du chemin est déjà un moment de jeu.
function migrerPiecesUneFois() {
  try { if (localStorage.getItem(cle("pieces_a_poser")) !== null) return; } catch (e) { return; }
  sauverPiecesAPoser(chargerPieces());
}

// Jauge d'étoiles (`cle("jauge_etoiles")`) : `dansLaJauge` vers la
// prochaine pièce, `aDecouvrir` = étoiles mises de côté le soir, versées le
// lendemain matin. Jamais remise à zéro au changement de jour.
function chargerJauge() {
  try {
    const j = JSON.parse(localStorage.getItem(cle("jauge_etoiles")));
    if (j && typeof j === "object") return { dansLaJauge: Math.max(0, j.dansLaJauge | 0), aDecouvrir: Math.max(0, j.aDecouvrir | 0) };
  } catch (e) {}
  return { dansLaJauge: 0, aDecouvrir: 0 };
}
function sauverJauge(j) {
  try { localStorage.setItem(cle("jauge_etoiles"), JSON.stringify(j)); } catch (e) {}
}
// Chemin de pièces et ses réglages (cf. recompenses.js) ; valeurs par
// défaut tant qu'un parent n'a rien réglé.
function chargerChemin() {
  try { return normaliserChemin(JSON.parse(localStorage.getItem(cle("chemin")))); } catch (e) { return normaliserChemin(null); }
}
function sauverChemin(c) {
  try { localStorage.setItem(cle("chemin"), JSON.stringify(c)); } catch (e) {}
}
// Met de côté les étoiles du jour pour le lendemain matin (jamais deux
// fois, cf. etoilesAMettreDeCote()). Modifie `etat` sans le sauver.
function mettreDeCoteEtoiles(etat) {
  const nouvelles = etoilesAMettreDeCote(etat);
  if (nouvelles > 0) {
    const j = chargerJauge();
    j.aDecouvrir += nouvelles;
    sauverJauge(j);
  }
  etat.etoilesMisesDeCote = Math.max(etat.etoilesMisesDeCote || 0, etat.etoiles || 0);
}

// ---------------------------------------------------------------------
// La pièce Acolyte : un dessin original en pixel art (16 × 16, comme
// l'avatar), or épais et contour foncé, avec le « A » d'Acolyte gravé. Elle
// a une vraie épaisseur : une pile de tranches cannelées, découpées en
// escalier comme le disque de pixels de la face, et un dos — on la voit
// inclinée, et elle tourne à la sortie du coffre. `s` = taille d'un pixel
// (entière, pour des pixels nets) : la pièce mesure 16·s px.
// ---------------------------------------------------------------------
const MOTIF_A_PIECE = ["...##...", "..####..", ".##..##.", ".##..##.", ".######.", ".##..##.", ".##..##.", "........"];
const ombresFacePiece = {};
function dessinFacePiece(s) {
  if (ombresFacePiece[s]) return ombresFacePiece[s];
  const a = new Set();
  MOTIF_A_PIECE.forEach((ligne, y) => [...ligne].forEach((c, x) => { if (c === "#") a.add((x + 4) + "," + (y + 4)); }));
  const ombres = [];
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const dx = x + 0.5 - 8, dy = y + 0.5 - 8;
      const d = Math.hypot(dx, dy);
      if (d > 8) continue;
      let c;
      if (d > 7) c = "#4A3006";
      else if (d > 5.9) c = (dx + dy < 0) ? "#FBDD6E" : "#C38A18";
      else if (a.has(x + "," + y)) c = "#A8700E";
      else if (a.has((x + 1) + "," + (y + 1))) c = "#FFE88A";
      else if (dx + dy < -6.5) c = "#FFF3B5";
      else c = "#F2C23C";
      ombres.push((x * s) + "px " + (y * s) + "px 0 0 " + c);
    }
  }
  return (ombresFacePiece[s] = ombres.join(","));
}
let contourTranchePiece = null;
function contourPiece() {
  if (contourTranchePiece) return contourTranchePiece;
  const lignes = [];
  for (let y = 0; y < 16; y++) {
    const xs = [];
    for (let x = 0; x < 16; x++) if (Math.hypot(x + 0.5 - 8, y + 0.5 - 8) <= 8) xs.push(x);
    lignes.push({ y, min: Math.min(...xs), max: Math.max(...xs) + 1 });
  }
  const pct = (v) => (v * 100 / 16) + "%";
  const points = [];
  lignes.forEach(l => { points.push(pct(l.max) + " " + pct(l.y), pct(l.max) + " " + pct(l.y + 1)); });
  lignes.slice().reverse().forEach(l => { points.push(pct(l.min) + " " + pct(l.y + 1), pct(l.min) + " " + pct(l.y)); });
  return (contourTranchePiece = "polygon(" + points.join(",") + ")");
}
function elementPiece(s, options = {}) {
  const pose = options.pose || "rotateY(-28deg) rotateX(10deg)";
  const epaisseur = Math.max(2, Math.round(3 * s));
  const scene = document.createElement("span");
  scene.className = "piece3d";
  scene.style.width = scene.style.height = (16 * s) + "px";
  scene.setAttribute("aria-hidden", "true");
  const corps = document.createElement("span");
  corps.className = "piece3d-corps" + (options.tourne ? " tourne" : "");
  corps.style.transform = pose;
  corps.style.transformOrigin = "50% 50% " + (-epaisseur / 2) + "px";
  for (let k = 1; k < epaisseur; k++) {
    const t = document.createElement("span");
    t.className = "piece3d-tranche";
    t.style.transform = "translateZ(" + (-k) + "px)";
    t.style.background = Math.floor(k / s) % 2 ? "#8F620C" : "#C38A18";
    t.style.clipPath = contourPiece();
    corps.appendChild(t);
  }
  [["translateZ(" + (-epaisseur) + "px) rotateY(180deg)"], ["translateZ(0px)"]].forEach(([transform]) => {
    const face = document.createElement("span");
    face.className = "piece3d-face";
    face.style.transform = transform;
    const pixels = document.createElement("span");
    pixels.style.width = pixels.style.height = s + "px";
    pixels.style.boxShadow = dessinFacePiece(s);
    face.appendChild(pixels);
    corps.appendChild(face);
  });
  scene.appendChild(corps);
  return scene;
}
// Pièces écrites dans index.html (`<span data-piece="1">`, ex. un libellé
// de formulaire) : dessinées au démarrage.
function installerPiecesInline() {
  document.querySelectorAll("[data-piece]").forEach(el => el.replaceChildren(elementPiece(Number(el.dataset.piece) || 1)));
}

// toutes les tâches faites, toutes routines confondues — pour que
// l'avatar reste cohérent (habits déjà mis) sur tous les écrans
function tachesFaitesPartout(etat) {
  const s = new Set();
  toutesLesRoutines().forEach(r => (etat.routines[r.id].fait || []).forEach(id => s.add(id)));
  return s;
}

// ---------------------------------------------------------------------
// Voix (Web Speech API, native, hors-ligne) + petit son de validation
// ---------------------------------------------------------------------
let derniereEtapeAnnoncee = null;
function dire(texte) {
  // Une seule voix à la fois : toute annonce coupe la lecture de la
  // journée (cf. lireJournee()).
  if (lectureJourneeEnCours()) arreterLectureJournee();
  try {
    const u = new SpeechSynthesisUtterance(texte);
    u.lang = "fr-FR";
    u.rate = 0.92;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch (e) {}
}
let audioCtxPartage = null;
function jouerSon() {
  try {
    if (!audioCtxPartage) audioCtxPartage = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = audioCtxPartage;
    if (ctx.state === "suspended") ctx.resume();
    [523.25, 659.25].forEach((freq, i) => {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = "sine"; osc.frequency.value = freq;
      const t0 = ctx.currentTime + i * 0.12;
      gain.gain.setValueAtTime(0.001, t0);
      gain.gain.linearRampToValueAtTime(0.25, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0); osc.stop(t0 + 0.3);
    });
  } catch (e) {}
}

// Sons des étoiles et des pièces — même famille que jouerSon() (Web Audio,
// rien à télécharger), mais plus hauts et plus brillants que le carillon
// « bravo » et l'alerte du minuteur, pour ne jamais s'y confondre. Volume
// modéré, attaques adoucies ; style réglé par les parents (`chemin.sons`) :
// doux (triangle, par défaut), arcade (carré, plus « jeu vidéo ») ou coupés.
// Chaque son renvoie sa durée en secondes : la voix ne vient qu'après.
function jouerNotes(notes) {
  const style = chargerChemin().sons;
  if (style === "coupes") return 0;
  let fin = 0;
  try {
    if (!audioCtxPartage) audioCtxPartage = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = audioCtxPartage;
    if (ctx.state === "suspended") ctx.resume();
    const arcade = style === "arcade";
    notes.forEach(n => {
      const forme = n.forme || (arcade ? "square" : "triangle");
      const vol = (arcade ? 0.07 : 0.2) * (n.vol || 1);
      const t0 = ctx.currentTime + n.t;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = forme;
      o.frequency.value = n.f;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + n.d);
      o.connect(g).connect(ctx.destination);
      o.start(t0);
      o.stop(t0 + n.d + 0.03);
      fin = Math.max(fin, n.t + n.d);
    });
  } catch (e) { return 0; }
  return fin;
}
// Une étoile qui entre dans la jauge : un « ding » court, un demi-ton plus
// haut à chaque étoile — on entend la jauge monter.
function sonEtoile(rang) { return jouerNotes([{ f: 880 * Math.pow(2, Math.min(rang, 24) / 12), t: 0, d: 0.12 }]); }
// La jauge pleine : un scintillement, quatre notes très rapides qui montent.
function sonJaugePleine() { return jouerNotes([1318.51, 1567.98, 1760, 2093].map((f, i) => ({ f, t: i * 0.06, d: 0.1, vol: 0.8 }))); }
// La pièce : le « ting-ting » classique, deux notes aiguës, la seconde résonne.
function sonPiece() { return jouerNotes([{ f: 1975.53, t: 0, d: 0.09 }, { f: 2637.02, t: 0.09, d: 0.55 }]); }
// Une pièce posée sur son rond : un petit « clic », deux notes très brèves.
function sonPose() { return jouerNotes([{ f: 1760, t: 0, d: 0.06 }, { f: 2349.32, t: 0.05, d: 0.14, vol: 0.8 }]); }
// Une récompense atteinte : trois notes qui montent puis une note tenue,
// plus ample pour la récompense finale.
function sonFanfare(finale) {
  const notes = [523.25, 659.25, 783.99].map((f, i) => ({ f, t: i * 0.11, d: 0.16, vol: 0.8 }));
  notes.push({ f: 1046.5, t: 0.33, d: finale ? 0.9 : 0.5 });
  if (finale) notes.push({ f: 1318.51, t: 0.33, d: 0.9, forme: "sine", vol: 0.4 }, { f: 1567.98, t: 0.33, d: 0.9, forme: "sine", vol: 0.35 });
  return jouerNotes(notes);
}

// Signal d'attention (fin de minuteur non résolue, cf. tickMinuteurGlobal()/
// entrerBlocageMinuteur()) — volontairement distinct du carillon de succès
// ci-dessus (deux notes montantes en sinusoïde) : timbre carré, note grave,
// répétée deux fois, pour ne jamais se confondre avec "bravo".
function jouerAlerte() {
  try {
    if (!audioCtxPartage) audioCtxPartage = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = audioCtxPartage;
    if (ctx.state === "suspended") ctx.resume();
    [0, 1].forEach((tour) => {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = "square"; osc.frequency.value = 392;
      const t0 = ctx.currentTime + tour * 0.55;
      gain.gain.setValueAtTime(0.001, t0);
      gain.gain.linearRampToValueAtTime(0.2, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0); osc.stop(t0 + 0.4);
    });
  } catch (e) {}
}

function afficherEcran(id) {
  const precedent = document.querySelector(".screen.active");
  if (lectureJourneeEnCours() && (!precedent || precedent.id !== id)) arreterLectureJournee();
  if (id !== "screen-maison") arreterMinuteurMaison();
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const ecran = document.getElementById(id);
  ecran.classList.add("active");
  if (ecran.querySelector(".bande-journee") && profilActifId()) construireBandeJournee(ecran);
}

// ---------------------------------------------------------------------
// Avatar : construit les calques <img> depuis le profil actif, une seule
// fois au démarrage (cf. appliquerProfilAuDom(), appelée depuis demarrer())
// — seule leur VISIBILITÉ change ensuite à chaque rendu, cf.
// synchroniserAvatar() juste après. index.html ne contient pas de liste
// de calques en dur dans ses 3 emplacements (#avatar-wrap-menu,
// #avatar-wrap, #avatar-wrap-arrivee) : un seul point de vérité ici,
// alimenté par `profilActif().sprites`, plutôt que de dupliquer la liste
// de balises `<img>` par profil possible dans le HTML, alors qu'un seul
// profil est actif par appareil (cf. tousLesProfils()).
// Insère toujours AVANT les `.badge-zone` (dos/visage), qui restent en
// dur dans index.html et doivent rester par-dessus les vêtements.
function construireCalquesAvatar(idConteneur) {
  const conteneur = document.getElementById(idConteneur);
  if (!conteneur) return;
  conteneur.querySelectorAll(".avatar-calque").forEach(img => img.remove());
  const profil = profilActif();
  const base = document.createElement("img");
  base.className = "avatar-calque";
  base.src = profil.sprites.base;
  base.alt = "";
  conteneur.prepend(base);
  const avantBadge = conteneur.querySelector(".badge-zone");
  profil.sprites.calques.forEach(c => {
    const img = document.createElement("img");
    img.className = "avatar-calque";
    img.dataset.calque = c.calque;
    img.src = c.fichier;
    img.alt = "";
    conteneur.insertBefore(img, avantBadge);
  });
}

// Applique le profil actif aux quelques endroits du DOM qui affichent son
// prénom ou son avatar en dur dans index.html (le reste — routines,
// textes parlés... — vient déjà des catalogues par profil, cf.
// tousLesProfils()/toutesLesRoutines() plus haut). Appelé une seule fois au
// démarrage (cf. demarrer()) : le profil actif ne change pas en cours de
// session (cf. resoudreProfilActif()) — changer d'appareil, pas d'onglet.
function appliquerProfilAuDom() {
  const profil = profilActif();
  document.title = "Acolyte — " + profil.prenom;
  ["prenom-menu", "prenom-routine", "arrivee-prenom-enfant"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = profil.prenom;
  });
  ["avatar-wrap-menu", "avatar-wrap", "avatar-wrap-arrivee"].forEach(construireCalquesAvatar);
  // L'écran "en sommeil" reste volontairement SANS la photo de chambre
  // (contrairement à #scene pendant une routine, cf.
  // synchroniserRoutineEcran()) : fond sombre et uni pour ne pas être
  // lumineux juste avant/pendant le sommeil — cf. #screen-dodo dans
  // styles.css.
  //
  // Avatar endormi (allongé de tout son long, yeux fermés, sous une
  // couette) plutôt qu'un simple emoji générique — propre à chaque
  // enfant comme le reste de l'avatar (cf. PROFILS[id].dodo, généré par
  // scripts/generate_sprites_detailed_preview.py, draw_dodo()). Ses
  // couleurs sont volontairement atténuées en CSS (cf. #dodo-avatar dans
  // styles.css), même logique de sobriété que l'absence de décor.
  document.getElementById("dodo-avatar").src = profil.dodo;
}

// ---------------------------------------------------------------------
// Avatar : synchronise les calques visibles sur toutes les instances
// (menu + écran de routine), à partir de l'ensemble des tâches faites
// toutes routines confondues — continuité visuelle d'un écran à l'autre.
// ---------------------------------------------------------------------
function synchroniserAvatar(etat) {
  const faites = tachesFaitesPartout(etat);
  const calques = new Set();
  const badges = {};
  toutesLesRoutines().forEach(r => r.taches.forEach(t => {
    if (!faites.has(t.id)) return;
    if (t.calque) {
      const liste = Array.isArray(t.calque) ? t.calque : [t.calque];
      liste.forEach(c => { if (t.retire) calques.delete(c); else calques.add(c); });
    }
    if (t.badge) {
      if (t.retire) delete badges[t.badge]; else badges[t.badge] = t.badgeFait || t.emoji;
    }
  }));
  document.querySelectorAll(".avatar-calque[data-calque]").forEach(img => {
    img.classList.toggle("visible", calques.has(img.dataset.calque));
  });
  document.querySelectorAll(".badge-zone[data-badge]").forEach(b => {
    const texte = badges[b.dataset.badge];
    b.textContent = texte || "";
    b.classList.toggle("visible", !!texte);
  });
}

// ---------------------------------------------------------------------
// 0. Menu de la journée
// ---------------------------------------------------------------------
function construireMenu() {
  const etat = chargerEtat();
  // Retour au menu = plus rien en cours à reprendre au prochain lancement
  // (cf. memoriserEnCours()/reprendreEnCours()).
  if (etat.enCours) { delete etat.enCours; sauverEtat(etat); }
  // le mode édition de "Ma journée" ne survit pas à un retour au menu —
  // le code parent protège l'entrée en édition, pas juste un aller simple.
  journeeEnEdition = false;
  // Filet de sécurité : un retour au menu affiche forcément "aujourd'hui"
  // ensuite, jamais un jour futur resté ciblé (cf. planningCible,
  // "Ma journée" plus bas) — au cas où un point d'entrée l'aurait laissé
  // sur une date passée.
  ciblerAujourdhui();

  // Déclenché par "Aller se coucher" spécifiquement, pas par le fait que
  // toutes les routines du jour soient validées : un enfant peut très bien
  // n'avoir rien fait d'autre de la journée et aller directement se
  // coucher, ce doit quand même clôturer la journée.
  if (etat.routines.soir && etat.routines.soir.valide && !etat.journeeFaite) {
    allerDormir();
    return;
  }

  synchroniserAvatar(etat);

  construireBandeauRecompenses(etat);
  majBadgeEspaceParent();
  construireListeJour(etat);
  afficherEcran("screen-menu");
}

// ---------------------------------------------------------------------
// Liste du jour : le menu de l'enfant EST sa journée, dans l'ordre du
// planning (`etat.planning`, choisi par les parents) — plus de chaînage
// entre routines ni de porte « Partir à l'aventure » séparée. Statuts
// calculés par journee.js : seul « maintenant » se lance ; le coucher
// (`disponibleApresHeure`) devient « maintenant » à son heure, même si
// tout n'est pas fait ; un item sauté par un parent n'est pas montré.
// ---------------------------------------------------------------------
function horaireItem(item) {
  if (item.type !== "routine") return null;
  const r = routineParId(item.id);
  if (!r || r.disponibleApresHeure === undefined) return null;
  return dateActuelle().getHours() >= r.disponibleApresHeure;
}

// Nature d'un item pour sa couleur : une activité sans `nature` est une
// sortie (séance comprise — violet = « on part de la maison »).
function natureItem(item) {
  if (item.type !== "aventure") return item.type;
  const a = aventureParId(item.id);
  return a && a.nature === "maison" ? "maison" : "sortie";
}

function nomItemPlanning(item) {
  const lib = libelleItemPlanning(item);
  return lib ? lib.nom : null;
}

let listeJourConstruite = false;
// Lecture suivie de toute la journée (cf. lireJournee()) : `null` hors
// lecture.
let lectureJournee = null;
function lectureJourneeEnCours() { return lectureJournee !== null; }

// Planning du jour tel que la liste le voit : un élément orphelin (activité
// ou idées d'un moment au choix qui n'existent plus) compte comme sauté,
// pour ne jamais devenir un « maintenant » invisible.
function planningDeLaListe(etat) {
  return etat.planning.map(it => (libelleItemPlanning(it) ? it : Object.assign({}, it, { passe: true })));
}

// En haut de la liste : la jauge (étoiles vers la prochaine pièce), les
// étoiles d'aujourd'hui (qui ne la rempliront que demain matin) et les
// pièces ; un appui ouvre le chemin.
function construireBandeauRecompenses(etat) {
  const chemin = chargerChemin();
  const jauge = chargerJauge();
  const bloc = document.getElementById("jauge-jour");
  const barre = document.createElement("div");
  barre.className = "jauge-barre";
  const plein = document.createElement("div");
  plein.className = "jauge-plein";
  plein.style.width = Math.min(100, 100 * jauge.dansLaJauge / chemin.etoilesParPiece) + "%";
  barre.appendChild(plein);
  const aujourdhui = document.createElement("span");
  aujourdhui.className = "etoiles-aujourdhui";
  aujourdhui.textContent = "⭐ " + (etat.etoiles || 0);
  bloc.replaceChildren(barre, aujourdhui);
  const blocPieces = document.getElementById("pieces-total");
  blocPieces.replaceChildren(elementPiece(2), " " + chargerPieces());
  const aPoser = chargerPiecesAPoser();
  if (aPoser > 0) {
    const badge = document.createElement("span");
    badge.className = "badge-a-poser";
    badge.textContent = "+" + aPoser;
    blocPieces.appendChild(badge);
  }
}

// ---------------------------------------------------------------------
// Carte « Ce matin » : à partir de l'heure de découverte (8h30 par défaut),
// les étoiles mises de côté la veille attendent en haut de la liste — jamais
// pendant une activité. « Ajouter mes étoiles » les enregistre tout de
// suite (fermer l'app ne perd ni ne rejoue rien), puis les montre entrer
// une à une dans la jauge ; une jauge pleine devient une pièce.
// `matin` garde l'animation et son résultat tant que l'enfant ne l'a pas
// fermée (la liste se reconstruit toutes les 15 s).
// ---------------------------------------------------------------------
let matin = null;

function construireCarteMatin(liste) {
  const jauge = chargerJauge();
  const chemin = chargerChemin();
  if (!matin && !decouverteDisponible(jauge, heureActuelleHHMM(), chemin.heureDecouverte)) return;
  const carte = document.createElement("div");
  carte.className = "carte-matin";
  const n = matin ? matin.n : jauge.aDecouvrir;
  carte.innerHTML = `<div class="carte-jour-label">☀️ CE MATIN</div>`
    + `<div class="matin-texte">${matin && matin.fini ? (matin.pieces ? "Tes étoiles se sont transformées en pièce !" : "Tes étoiles sont dans ta jauge !") : "Tu as gagné"}</div>`
    + `<div class="matin-etoiles"></div>`
    + `<div class="matin-jauge"><div class="matin-jauge-plein"></div></div>`
    + `<div class="matin-piece"></div>`;
  const etoiles = carte.querySelector(".matin-etoiles");
  const restantes = matin ? n - matin.rang : n;
  etoiles.textContent = restantes > 12 ? "⭐ × " + restantes : "⭐".repeat(Math.max(0, restantes));
  const plein = carte.querySelector(".matin-jauge-plein");
  plein.style.width = Math.min(100, 100 * (matin ? matin.dans : jauge.dansLaJauge) / chemin.etoilesParPiece) + "%";
  if (matin && matin.pieceVisible) carte.querySelector(".matin-piece").appendChild(elementPiece(5, { tourne: true }));
  const bouton = document.createElement("button");
  bouton.type = "button";
  bouton.className = "btn-continuer btn-cest-parti-jour";
  if (!matin) {
    bouton.textContent = "Ajouter mes étoiles ⭐";
    bouton.onclick = ajouterEtoilesDuMatin;
  } else if (!matin.fini) {
    bouton.classList.add("hidden");
  } else if (matin.pieces) {
    bouton.textContent = "Poser ma pièce sur mon chemin →";
    bouton.onclick = () => { matin = null; ouvrirChemin(); };
  } else {
    bouton.textContent = "Super ! ⭐";
    bouton.onclick = () => { matin = null; construireListeJour(chargerEtat()); };
  }
  carte.appendChild(bouton);
  liste.appendChild(carte);
}

function ajouterEtoilesDuMatin() {
  const jauge = chargerJauge();
  const chemin = chargerChemin();
  const n = jauge.aDecouvrir;
  if (!n) return;
  const r = verserEtoiles(jauge.dansLaJauge, n, chemin.etoilesParPiece);
  sauverJauge({ dansLaJauge: r.dansLaJauge, aDecouvrir: 0 });
  if (r.pieces) ajouterPieces(r.pieces);
  matin = { n, rang: 0, dans: jauge.dansLaJauge, etapes: r.etapes, pieces: r.pieces, pieceVisible: false, fini: false };
  construireListeJour(chargerEtat());
  // Une étoile à la fois, plus vite s'il y en a beaucoup (plusieurs jours
  // sans ouvrir l'app).
  const pas = Math.max(140, Math.min(450, 6000 / n));
  const suivante = () => {
    if (!matin) return;
    // L'enfant est parti ailleurs : on termine sans bruit, le résultat
    // l'attend sur la liste.
    if (!document.getElementById("screen-menu").classList.contains("active")) {
      matin.rang = matin.etapes.length;
      matin.dans = matin.etapes.length ? matin.etapes[matin.etapes.length - 1].dans % chargerChemin().etoilesParPiece : matin.dans;
      matin.pieceVisible = matin.pieces > 0;
      matin.fini = true;
      return;
    }
    if (matin.rang >= matin.etapes.length) { finirMatin(); return; }
    const etape = matin.etapes[matin.rang];
    matin.rang++;
    matin.dans = etape.dans;
    sonEtoile(matin.rang - 1);
    rafraichirCarteMatin();
    if (!etape.piece) { setTimeout(suivante, pas); return; }
    // Jauge pleine : elle brille, puis devient une pièce ; la suite repart de zéro.
    setTimeout(() => {
      if (!matin) return;
      sonJaugePleine();
      document.querySelector(".matin-jauge")?.classList.add("pleine");
      setTimeout(() => {
        if (!matin) return;
        matin.pieceVisible = true;
        matin.dans = 0;
        const duree = sonPiece();
        rafraichirCarteMatin();
        setTimeout(suivante, Math.max(pas, duree * 1000 + 200));
      }, 500);
    }, 150);
  };
  setTimeout(suivante, 300);
}

function rafraichirCarteMatin() {
  const ecran = document.getElementById("screen-menu");
  if (ecran.classList.contains("active")) construireListeJour(chargerEtat());
}

function finirMatin() {
  matin.fini = true;
  rafraichirCarteMatin();
  construireBandeauRecompenses(chargerEtat());
  const texte = matin.pieces > 1
    ? "Bravo ! Tes étoiles se sont transformées en " + matin.pieces + " pièces. Tu peux les poser sur ton chemin."
    : matin.pieces ? "Bravo ! Tes étoiles se sont transformées en pièce. Tu peux la poser sur ton chemin."
    : "Bravo ! Tes étoiles sont dans ta jauge.";
  setTimeout(() => dire(texte), 300);
}

function construireListeJour(etat) {
  listeJourConstruite = true;
  const planning = planningDeLaListe(etat);
  const resultat = statutsJournee(planning, horaireItem);
  const liste = document.getElementById("liste-journee");
  liste.innerHTML = "";
  construireCarteMatin(liste);

  const visibles = planning.map((item, i) => ({ item, i, lib: libelleItemPlanning(item), statut: resultat.statuts[i] }))
    .filter(v => v.lib && v.statut !== "passe");
  if (visibles.length === 0) {
    liste.appendChild(messageListeJour("Rien de prévu aujourd'hui."));
    return;
  }

  // Déjà fait (ou dépassé) : une rangée de pictogrammes, en haut.
  const passes = visibles.filter(v => ["fait", "repere-passe", "rate"].includes(v.statut));
  if (passes.length) {
    const rangee = document.createElement("div");
    rangee.className = "jour-faits";
    passes.forEach(v => {
      const picto = document.createElement("button");
      picto.type = "button";
      picto.className = "picto-jour type-" + natureItem(v.item) + (v.statut === "fait" ? " fait" : " estompe");
      picto.dataset.index = v.i;
      picto.textContent = v.lib.emoji;
      picto.setAttribute("aria-label", v.lib.nom);
      picto.onclick = () => dire(v.statut === "fait" ? "C'est fait : " + v.lib.nom + "." : v.lib.nom + ".");
      rangee.appendChild(picto);
    });
    liste.appendChild(rangee);
  }

  const aVenir = visibles.filter(v => ["maintenant", "apres", "plus-tard"].includes(v.statut));
  if (aVenir.length === 0) liste.appendChild(messageListeJour("Tout est fait pour aujourd'hui ! 🎉"));
  let titrePlusTard = false;
  aVenir.forEach(v => {
    if (v.statut === "plus-tard" && !titrePlusTard) {
      const titre = document.createElement("div");
      titre.className = "groupe-journee-titre jour-plus-tard-titre";
      titre.textContent = "PLUS TARD";
      liste.appendChild(titre);
      titrePlusTard = true;
    }
    liste.appendChild(carteListeJour(v, resultat));
  });
}

function messageListeJour(texte) {
  const div = document.createElement("div");
  div.className = "jour-message";
  div.textContent = texte;
  return div;
}

function carteListeJour(v, resultat) {
  const carte = document.createElement("div");
  carte.className = "carte-jour carte-" + v.statut + " type-" + natureItem(v.item);
  carte.dataset.index = v.i;
  carte.dataset.id = v.item.id;
  const label = v.statut === "maintenant" ? "MAINTENANT" : v.statut === "apres" ? "APRÈS" : "";
  const heure = v.item.heure ? `<span class="carte-jour-heure">🕒 ${v.item.heure}</span>` : "";
  carte.innerHTML = (label ? `<div class="carte-jour-label">${label}</div>` : "")
    + `<div class="carte-jour-corps"><span class="carte-jour-emoji">${v.lib.emoji}</span>`
    + `<span class="carte-jour-texte"><span class="carte-jour-nom">${v.lib.nom}</span>${heure}</span></div>`;
  if (v.statut !== "maintenant") {
    const prefixe = v.statut === "apres" ? "Après : " : "Plus tard : ";
    carte.onclick = () => dire(prefixe + v.lib.nom + ".");
    return carte;
  }
  const bouton = document.createElement("button");
  bouton.type = "button";
  if (resultat.verrouille) {
    bouton.className = "btn-cest-parti-jour verrouille";
    bouton.textContent = "🕒 Pas encore l'heure";
    bouton.onclick = () => dire("Ce n'est pas encore l'heure pour « " + v.lib.nom + " ».");
  } else {
    bouton.className = "btn-continuer btn-cest-parti-jour";
    bouton.textContent = "C'est parti ▶";
    bouton.onclick = () => lancerItemJour(v.i);
  }
  carte.appendChild(bouton);
  return carte;
}

// ---------------------------------------------------------------------
// Tout s'écoute : sur chaque écran de l'enfant, 🔊 redit le moment en
// cours (et ce qui vient après) et 🗓️🔊 lit toute la journée, chaque
// élément s'allumant quand il est lu — les cartes sur la liste, une bande
// de pictogrammes ailleurs. Jamais sur la séance (la praticienne tient la
// tablette) ni côté parents.
// ---------------------------------------------------------------------
const ECRANS_ECOUTE = ["screen-menu", "screen-routine", "screen-trajet", "screen-arrivee", "screen-maison", "screen-choix", "screen-chemin", "screen-dents", "screen-histoire"];
const ECRANS_BANDE = ["screen-routine", "screen-trajet", "screen-arrivee", "screen-maison", "screen-choix", "screen-chemin"];
// Le calendrier en grand, le haut-parleur en badge : distinct du 🔊 seul.
const ICONE_ECOUTE_JOURNEE = '<span class="ecoute-cal">🗓️</span><span class="ecoute-badge">🔊</span>';

// Ajoute 🗓️🔊 à côté du 🔊 existant (ou les deux, s'il n'y en a pas) et
// la bande sous le bandeau. Une seule fois, au démarrage.
function installerEcoute() {
  ECRANS_ECOUTE.forEach(id => {
    const ecran = document.getElementById(id);
    const barre = ecran && ecran.querySelector(".barre-haut");
    if (!barre || barre.querySelector(".btn-ecoute-journee")) return;
    const groupe = document.createElement("div");
    groupe.className = "groupe-ecoute";
    let voix = barre.querySelector(".btn-voix");
    if (voix) {
      voix.replaceWith(groupe);
    } else {
      voix = document.createElement("button");
      voix.className = "btn-voix";
      voix.textContent = "🔊";
      voix.setAttribute("aria-label", "Écouter maintenant");
      voix.onclick = () => dire(phraseMaintenantDuJour());
      barre.insertBefore(groupe, barre.lastElementChild);
    }
    const journee = document.createElement("button");
    journee.className = "btn-voix btn-ecoute-journee";
    journee.innerHTML = ICONE_ECOUTE_JOURNEE;
    journee.setAttribute("aria-label", "Écouter toute ma journée");
    journee.onclick = basculerLectureJournee;
    groupe.append(voix, journee);
  });
  ECRANS_BANDE.forEach(id => {
    const ecran = document.getElementById(id);
    if (!ecran || ecran.querySelector(".bande-journee")) return;
    const bande = document.createElement("div");
    bande.className = "bande-journee";
    bande.setAttribute("aria-hidden", "true");
    ecran.querySelector(".barre-haut").after(bande);
  });
}

function phraseMaintenantDuJour() {
  const etat = chargerEtat();
  const planning = planningDeLaListe(etat);
  return phraseMaintenant(planning, statutsJournee(planning, horaireItem), nomItemPlanning);
}

// Pendant une sortie ou une activité, 🔊 redit l'écran puis annonce la
// suite : « … Après : le déjeuner. »
function suiteApres() {
  const etat = chargerEtat();
  const r = statutsJournee(planningDeLaListe(etat), horaireItem);
  const nom = r.apres === null ? null : nomItemPlanning(etat.planning[r.apres]);
  return nom ? " " + finPhrase("Après : " + nom) : "";
}

function construireBandeJournee(ecran) {
  const bande = ecran.querySelector(".bande-journee");
  if (!bande) return;
  const etat = chargerEtat();
  const r = statutsJournee(planningDeLaListe(etat), horaireItem);
  bande.innerHTML = "";
  etat.planning.forEach((item, i) => {
    const lib = libelleItemPlanning(item);
    if (!lib || r.statuts[i] === "passe") return;
    const picto = document.createElement("span");
    picto.className = "picto-bande type-" + natureItem(item)
      + (r.statuts[i] === "maintenant" ? " en-cours" : "")
      + (["fait", "repere-passe", "rate"].includes(r.statuts[i]) ? " passe" : "");
    picto.dataset.index = i;
    picto.textContent = lib.emoji;
    bande.appendChild(picto);
  });
}

function basculerLectureJournee() {
  if (lectureJourneeEnCours()) { arreterLectureJournee(); return; }
  lireJournee();
}

// Une phrase courte par élément, en file : chacune allume son élément au
// moment où elle commence (`onstart`). Le jeton ignore les événements
// d'une lecture déjà arrêtée (cancel() en déclenche sur la file restante).
function lireJournee() {
  const etat = chargerEtat();
  const planning = planningDeLaListe(etat);
  const phrases = phrasesJournee(planning, statutsJournee(planning, horaireItem), nomItemPlanning);
  try { speechSynthesis.cancel(); } catch (e) {}
  const jeton = {};
  lectureJournee = jeton;
  majBoutonsLecture(true);
  try {
    phrases.forEach((ph, n) => {
      const u = new SpeechSynthesisUtterance(ph.texte);
      u.lang = "fr-FR";
      u.rate = 0.92;
      u.onstart = () => { if (lectureJournee === jeton) allumerElementJournee(ph.index); };
      if (n === phrases.length - 1) u.onend = u.onerror = () => { if (lectureJournee === jeton) arreterLectureJournee(false); };
      speechSynthesis.speak(u);
    });
  } catch (e) { arreterLectureJournee(false); }
}

function allumerElementJournee(index) {
  document.querySelectorAll(".lue").forEach(el => el.classList.remove("lue"));
  if (index === null) return;
  const ecran = document.querySelector(".screen.active");
  const el = ecran && ecran.querySelector('#liste-journee [data-index="' + index + '"], .bande-journee [data-index="' + index + '"]');
  if (!el) return;
  el.classList.add("lue");
  el.scrollIntoView({ block: "nearest", inline: "nearest" });
}

// `couper` : false quand la lecture s'est terminée d'elle-même.
function arreterLectureJournee(couper = true) {
  lectureJournee = null;
  if (couper) { try { speechSynthesis.cancel(); } catch (e) {} }
  document.querySelectorAll(".lue").forEach(el => el.classList.remove("lue"));
  majBoutonsLecture(false);
}

function majBoutonsLecture(actif) {
  document.querySelectorAll(".btn-ecoute-journee").forEach(b => {
    if (actif) b.textContent = "⏹️"; else b.innerHTML = ICONE_ECOUTE_JOURNEE;
    b.setAttribute("aria-label", actif ? "Arrêter la lecture" : "Écouter toute ma journée");
  });
}

// « C'est parti » sur la carte « maintenant ».
function lancerItemJour(index) {
  const item = chargerEtat().planning[index];
  if (!item) return;
  if (item.type === "routine") { demarrerRoutine(item.id); return; }
  if (item.type === "aventure") { lancerActivite(item.id, index); return; }
  if (item.type === "choix") {
    if (item.choisi && aventureParId(item.choisi)) lancerActivite(item.choisi, index);
    else ouvrirChoix(index);
  }
}

// Une activité à la maison démarre tout de suite ; une sortie seulement si
// l'enfant est prêt (cf. partirSiPret()).
function lancerActivite(id, index) {
  const a = aventureParId(id);
  if (!a) return;
  if (a.nature === "maison") { demarrerAventure(a.id); return; }
  partirSiPret(a.id, index);
}

// ---------------------------------------------------------------------
// Moment au choix : l'enfant choisit parmi les 2 ou 3 idées préparées par
// les parents (`item.options`), sans attendre personne. Le choix est gardé
// pour la journée (`item.choisi`) ; la fin de l'activité choisie marque le
// moment au choix comme fait (cf. indexAMarquer() dans journee.js).
// ---------------------------------------------------------------------
let choixEnCours = null;
function optionsDuChoix(index) {
  const item = chargerEtat().planning[index];
  return item && item.type === "choix" ? (item.options || []).map(aventureParId).filter(Boolean) : [];
}
function phraseChoix(options) { return "Tu peux choisir : " + listeOu(options.map(a => a.lieu)) + "."; }

function ouvrirChoix(index) {
  const options = optionsDuChoix(index);
  if (!options.length) return;
  choixEnCours = { index, selection: null };
  construireOptionsChoix();
  afficherEcran("screen-choix");
  dire(phraseChoix(options));
}

function construireOptionsChoix() {
  const conteneur = document.getElementById("choix-options");
  conteneur.innerHTML = "";
  optionsDuChoix(choixEnCours.index).forEach(a => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "carte-choix type-" + (a.nature === "maison" ? "maison" : "sortie") + (choixEnCours.selection === a.id ? " choisie" : "");
    b.innerHTML = `<span class="carte-jour-emoji">${a.emoji}</span><span class="carte-jour-nom">${a.lieu}</span>`;
    b.onclick = () => { choixEnCours.selection = a.id; construireOptionsChoix(); dire(finPhrase(a.lieu)); };
    conteneur.appendChild(b);
  });
  document.getElementById("btn-choix-valider").disabled = !choixEnCours.selection;
}

// Enregistre le choix puis repasse par la liste : l'activité choisie y est
// « maintenant » et se lance comme les autres (une sortie pas prête y fait
// clignoter la routine à faire).
function validerChoix() {
  if (!choixEnCours || !choixEnCours.selection) return;
  const { index, selection } = choixEnCours;
  choixEnCours = null;
  const etat = chargerEtat();
  const item = etat.planning[index];
  if (item && item.type === "choix") { item.choisi = selection; sauverEtat(etat); }
  construireMenu();
  if (item && item.type === "choix") lancerItemJour(index);
}

// Activité en cours (`etat.enCours`) : routine ou étape d'aventure
// ouverte en ce moment, mémorisée dans la journée pour que quitter l'app
// (tablette mise en veille, app fermée par le système) ne ramène pas au
// menu au prochain lancement — cf. reprendreEnCours(), appelée depuis
// demarrer(). Effacée à chaque retour au menu (cf. construireMenu()) ;
// vit dans `cle("journee")`, donc disparaît d'elle-même au changement de
// jour.
function memoriserEnCours(enCours) {
  const etat = chargerEtat();
  etat.enCours = enCours;
  sauverEtat(etat);
}

// Rouvre l'activité mémorisée par memoriserEnCours(). Renvoie false s'il
// n'y a rien (ou plus rien de valable : routine déjà validée, routine ou
// aventure supprimée depuis) — l'appelant affiche alors le menu.
// Sous-écrans d'une routine (dents, histoire) : on reprend sur l'écran
// de la routine elle-même, rien n'y étant enregistré avant la fin.
function reprendreEnCours() {
  const enCours = chargerEtat().enCours;
  if (!enCours) return false;
  if (enCours.type === "routine") {
    const routine = routineParId(enCours.id);
    const etatR = routine && chargerEtat().routines[routine.id];
    if (!etatR || etatR.valide) return false;
    if (routine.taches.every(t => etatR.fait.includes(t.id))) {
      // Toutes les tâches faites mais pas encore validées par un parent :
      // retour sur les félicitations, d'où part la validation.
      routineActuelleId = routine.id;
      finDeRoutine();
      return true;
    }
    demarrerRoutine(routine.id);
    return true;
  }
  if (enCours.type === "aventure") {
    const a = aventureParId(enCours.id);
    if (!a) return false;
    if (enCours.etape === "maison" && a.nature === "maison") { ouvrirActiviteMaison(a, enCours.debut || Date.now()); return true; }
    aventureActuelleId = a.id;
    sensTrajet = enCours.sens === "retour" ? "retour" : "aller";
    if (enCours.etape === "arrivee") allerAArrivee();
    else if (enCours.etape === "seance" && a.personne) demarrerSeance(a);
    else allerAuTrajet();
    return true;
  }
  return false;
}

// Minuteur resté sur une question/un blocage quand l'app a été quittée :
// tickMinuteurGlobal() ne le redéclenche pas (il ne réagit qu'aux
// décomptes qui arrivent à zéro), donc on réaffiche l'écran ici, par-dessus
// l'activité reprise, plutôt que de le laisser coincé sans issue.
function reprendreDialogueMinuteur() {
  const m = chargerMinuteursActifs().find(x => x.etape === "verification1" || x.etape === "bloque");
  if (!m) return;
  minuteurEnDialogue = { portee: m.portee, routineId: m.routineId, tacheId: m.tacheId };
  if (m.etape === "verification1") {
    afficherEcran("screen-minuteur-verification");
    dire("As-tu besoin d'aide pour faire ta routine ou ta mission ?");
  } else {
    afficherEcran("screen-minuteur-bloque");
    dire("Un parent est nécessaire.");
  }
}

function demarrerRoutine(id) {
  // Routine déjà validée qui revient dans la journée (placée deux fois au
  // planning) : nouveau passage, tâches décochées — l'étoile reste acquise.
  const etat = chargerEtat();
  if (etat.routines[id] && etat.routines[id].valide) {
    etat.routines[id].fait = [];
    etat.routines[id].valide = false;
    sauverEtat(etat);
  }
  routineActuelleId = id;
  memoriserEnCours({ type: "routine", id: id });
  derniereEtapeAnnoncee = null;
  synchroniserRoutineEcran();
  afficherEcran("screen-routine");
}

// Échappatoire pour un tap accidentel sur la mauvaise routine au menu —
// ne perd rien : les tâches déjà cochées restent dans `etat.routines`,
// retaper la même routine plus tard reprend exactement où on en était.
function retourMenuDepuisRoutine() {
  routineActuelleId = null;
  construireMenu();
}

// Routines indispensables avant de pouvoir partir à l'aventure. "Aller se
// coucher" n'en fait pas partie (sans rapport avec la sortie).
const ROUTINES_REQUISES_DEPART = ["shabiller", "partir"];

// Une sortie ne démarre que si l'enfant est prêt : les routines
// indispensables placées AVANT elle dans le planning du jour (ni sautées
// ni absentes) doivent être validées. Sinon on ne navigue pas de force :
// la voix rappelle ce qu'il reste à faire et la carte clignote. Une
// routine placée après la sortie, sautée ou retirée du jour ne bloque
// jamais (sinon la sortie resterait coincée pour toute la journée).
function routinesManquantesAvantDepart(etat, indexSortie) {
  return ROUTINES_REQUISES_DEPART.filter(id =>
    etat.planning.some((it, i) => i < indexSortie && it.type === "routine" && it.id === id && !it.passe)
    && etat.routines[id] && !etat.routines[id].valide
  ).map(routineParId).filter(Boolean);
}
function partirSiPret(id, indexSortie) {
  const manquantes = routinesManquantesAvantDepart(chargerEtat(), indexSortie);
  if (manquantes.length === 0) { demarrerAventure(id); return; }
  dire("Avant de partir, il faut d'abord faire : " + manquantes.map(r => r.nom).join(", ") + ".");
  clignoterRoutine(manquantes[0].id);
}

// Écran des sorties du jour : liste les aventures du planning
// (`aventuresPlanifieesAujourdhui()`), sinon garde le texte d'origine
// "Rien de prévu aujourd'hui !".
function construireMissions() {
  const duJour = aventuresPlanifieesAujourdhui();
  const emoji = document.getElementById("missions-emoji");
  const texte = document.getElementById("missions-texte");
  const liste = document.getElementById("missions-liste");
  liste.innerHTML = "";
  if (duJour.length === 0) {
    emoji.textContent = "🚗";
    texte.textContent = "Rien de prévu aujourd'hui !";
    return;
  }
  emoji.textContent = duJour[0].emoji;
  texte.textContent = "";
  duJour.forEach(a => {
    const carte = document.createElement("div");
    carte.className = "carte-routine";
    carte.innerHTML = `<div class="carte-routine-nom">${a.emoji} ${a.lieu}</div><div class="carte-routine-etat"></div>`;
    carte.onclick = () => demarrerAventure(a.id);
    liste.appendChild(carte);
  });
}

function demarrerAventure(id) {
  const a = aventureParId(id);
  if (a && a.nature === "maison") { ouvrirActiviteMaison(a, Date.now()); return; }
  aventureActuelleId = id;
  sensTrajet = "aller";
  allerAuTrajet();
}

// ---------------------------------------------------------------------
// Activité à la maison (lecture, temps calme...) : pas de trajet. L'écran
// dit la consigne ; un minuteur facultatif part de `debut` (mémorisé dans
// `enCours`, pour reprendre au bon endroit si l'app est fermée) et continue
// pendant l'écoute de la journée. « J'ai fini » → félicitations → code
// parent → coffre s'il y a une pièce, sinon retour à la liste.
// ---------------------------------------------------------------------
let minuteurMaison = null;
function ouvrirActiviteMaison(a, debut) {
  aventureActuelleId = a.id;
  memoriserEnCours({ type: "aventure", id: a.id, etape: "maison", debut });
  document.getElementById("maison-nom").textContent = a.lieu;
  document.getElementById("maison-endroit").textContent = ENDROITS[a.endroit] || "";
  document.getElementById("maison-emoji").textContent = a.emoji;
  document.getElementById("maison-consigne").textContent = a.consigne;
  afficherEcran("screen-maison");
  demarrerMinuteurMaison(a, debut);
  dire(a.consigne);
}

function demarrerMinuteurMaison(a, debut) {
  arreterMinuteurMaison();
  const duree = (a.minuteurMinutes || 0) * 60000;
  document.getElementById("maison-minuteur").classList.toggle("hidden", !duree);
  if (!duree) return;
  // Déjà écoulé à la reprise : on affiche 00:00 sans réannoncer.
  let annonce = Date.now() - debut >= duree;
  const maj = () => {
    const reste = Math.max(0, duree - (Date.now() - debut));
    document.getElementById("maison-minuteur-remplissage").style.width = (100 * reste / duree) + "%";
    const s = Math.ceil(reste / 1000);
    document.getElementById("maison-minuteur-chrono").textContent =
      String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
    if (reste > 0) return;
    arreterMinuteurMaison();
    if (!annonce) { annonce = true; jouerSon(); dire("C'est l'heure ! Tu as fini ?"); }
  };
  maj();
  if (minuteurMaison === null && Date.now() - debut < duree) minuteurMaison = setInterval(maj, 1000);
}

function arreterMinuteurMaison() {
  if (minuteurMaison !== null) { clearInterval(minuteurMaison); minuteurMaison = null; }
}

function finActiviteMaison() {
  const a = aventureParId(aventureActuelleId);
  if (!a) { construireMenu(); return; }
  arreterMinuteurMaison();
  const titre = "Bravo " + profilActif().prenom + ", tu as fini : " + a.lieu + " !";
  const suite = "Maintenant va chercher papa ou maman.";
  document.getElementById("bravo-routine-titre").textContent = titre;
  document.getElementById("bravo-routine-soustitre").textContent = suite;
  suiteBravo = allerValidationMaison;
  afficherEcran("screen-bravo-routine");
  dire(titre + " " + suite);
}

function allerValidationMaison() {
  ecranAvantValidation = document.querySelector(".screen.active").id;
  const a = aventureParId(aventureActuelleId);
  codeSaisi = "";
  modeCode = "verifier";
  document.getElementById("validation-sous-titre").textContent = "Un parent entre le code pour valider « " + a.lieu + " ».";
  document.getElementById("correction-wrap").classList.add("hidden");
  document.getElementById("pavecode-wrap").classList.remove("hidden");
  document.getElementById("pavecode-erreur").textContent = "";
  construireClavier(document.getElementById("pavecode-clavier"), appuyerTouche);
  majCasesCode(document.getElementById("pavecode-cases"), codeSaisi);
  apresCodeValide = () => {
    terminerAventure(a);
    if (!(a.recompensePieces > 0)) dire("Bravo, c'est fait !");
  };
  afficherEcran("screen-validation");
}

// Écran "Ma journée" : le planning du jour (`etat.planning`), affiché
// dans l'ordre chronologique — pas de tâches à cocher ici, c'est un
// aperçu, pas un parcours. En lecture seule par défaut ; le mode édition
// (`journeeEnEdition`, activé via `basculerEditionJournee()`, protégé
// par le code parent) ajoute réordonnancement (▲▼), suppression et ajout
// depuis les catalogues existants (ROUTINES/AVENTURES/REPAS). Toujours
// remis en lecture seule en quittant vers le menu (cf. `construireMenu()`).
let journeeEnEdition = false;

// Ce que l'écran "Ma journée" affiche et modifie : `null` = aujourd'hui
// (`etat.planning` en direct), `{ date: "AAAA-M-J" }` = un jour à venir
// (`cle("planning_futur")`), `{ jourSemaine: 1…7 }` = un jour de la semaine
// type. Jamais persistée : chaque entrée qui affiche aujourd'hui passe par
// ciblerAujourdhui() ; les appels internes (édition, tick) gardent la cible.
let planningCible = null;
function planningCibleEstAujourdhui() { return planningCible === null; }
function ciblerAujourdhui() { planningCible = null; }
// Une date jamais personnalisée renvoie son planning par défaut, sans
// l'écrire dans cle("planning_futur") (cf. sauverPlanningCible()).
function chargerPlanningCible() {
  if (planningCibleEstAujourdhui()) return chargerEtat().planning;
  if (planningCible.jourSemaine) return chargerSemaineType()[String(planningCible.jourSemaine)];
  const futur = chargerPlanningFutur();
  return Array.isArray(futur[planningCible.date]) ? futur[planningCible.date] : planningParDefaut(planningCible.date);
}
function sauverPlanningCible(liste) {
  if (planningCibleEstAujourdhui()) { const etat = chargerEtat(); etat.planning = liste; sauverEtat(etat); return; }
  if (planningCible.jourSemaine) {
    const st = chargerSemaineType();
    st[String(planningCible.jourSemaine)] = liste;
    sauverSemaineType(st);
    return;
  }
  const futur = chargerPlanningFutur();
  futur[planningCible.date] = liste;
  sauverPlanningFutur(futur);
}
// "Mercredi 3 septembre" — même formatage que majHorloge(), capitalisé.
function dateLisible(dateKey) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const texte = new Date(y, m - 1, d).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

// "HH:MM" (24h, zéro-paddé) de l'heure actuelle — respecte
// `dateDebugForcee` comme `disponibleApresHeure` (cf. construireMenu),
// pour rester testable au panneau debug. Uniquement pour l'AFFICHAGE du
// repère "maintenant" ci-dessous, jamais pour du déblocage.
function heureActuelleHHMM() {
  const d = dateActuelle();
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}

// Repère "maintenant/ensuite" pour "Ma journée" : ne bloque/débloque
// jamais rien (cf. commentaire de `planningParDefaut()`). N'a de sens
// que pour AUJOURD'HUI (une date future n'a pas d'"heure actuelle" à
// comparer) — retourne directement les deux index à `null` sinon, qui
// est déjà exactement ce que le rendu sait afficher pour une journée
// sans heure : aucun branchement supplémentaire nécessaire pour faire
// disparaître le repère en mode planning à venir.
// Parcourt `planning` dans son ORDRE D'AFFICHAGE — jamais retrié par
// heure, l'ordre du planning reste la seule source de vérité, l'heure
// n'est qu'une annotation. Un item sans `heure` est simplement absent de
// ce calcul. "Courant" = le dernier item avec heure ≤ maintenant
// rencontré en parcourant la liste ; "suivant" = le premier avec
// heure > maintenant rencontré après.
function reperesJournee(planning) {
  if (!planningCibleEstAujourdhui()) return { courantIdx: null, suivantIdx: null };
  const maintenant = heureActuelleHHMM();
  const timed = [];
  planning.forEach((item, i) => { if (item.heure) timed.push(i); });
  let courantIdx = null;
  timed.forEach(i => { if (planning[i].heure <= maintenant) courantIdx = i; });
  const suivant = timed.find(i => i > (courantIdx === null ? -1 : courantIdx) && planning[i].heure > maintenant);
  return { courantIdx, suivantIdx: suivant === undefined ? null : suivant };
}

function construireJournee() {
  const planning = chargerPlanningCible();
  const conteneur = document.getElementById("journee-contenu");
  conteneur.innerHTML = "";
  const { courantIdx, suivantIdx } = reperesJournee(planning);

  document.getElementById("titre-journee").textContent =
    planningCibleEstAujourdhui() ? "Ma journée"
      : planningCible.jourSemaine ? "Chaque " + NOMS_JOURS[planningCible.jourSemaine - 1]
      : "Planning du " + dateLisible(planningCible.date);

  const liste = document.createElement("div");
  liste.className = "liste-planning";
  planning.forEach((item, i) => {
    const lib = libelleItemPlanning(item);
    if (!lib) return; // référence orpheline (id qui n'existe plus dans le catalogue) : ignorée proprement
    const ligne = document.createElement("div");
    // Liseré de couleur par nature (type-routine/repas/aventure, cf.
    // styles.css) : volontairement pas --accent/--rouge, déjà pris par
    // "fait"/"retirer" ailleurs dans l'app — un double sens rendrait ces
    // couleurs moins lisibles là où elles existent déjà.
    // Avancement (`fait`) et saut (`passe`) n'existent que pour aujourd'hui :
    // la semaine type et les jours à venir ne portent que le programme.
    const aujourdhui = planningCibleEstAujourdhui();
    ligne.className = "ligne-journee type-" + (natureItem(item) === "maison" ? "maison" : item.type)
      + (i === courantIdx ? " journee-maintenant" : "")
      + (i === suivantIdx ? " journee-suivant" : "")
      + (aujourdhui && item.passe ? " item-passe" : "");
    const sousLigneHeure = item.heure ? `<span class="texte-journee-reveil">🕒 ${item.heure}</span>` : "";
    const sousLigneEntourage = lib.entourage
      ? `<span class="texte-journee-reveil">👪 ${lib.entourage.map(p => p.emoji + " " + p.nom).join(", ")}</span>` : "";
    const badge = aujourdhui && item.passe ? `<span class="badge-maintenant">SAUTÉ</span>`
      : aujourdhui && item.fait ? `<span class="badge-fait">✓</span>`
      : i === courantIdx ? `<span class="badge-maintenant">MAINTENANT</span>` : "";
    ligne.innerHTML = `<span class="emoji-journee">${lib.emoji}</span>`
      + `<span class="texte-journee"><span>${lib.nom}</span>${sousLigneHeure}${sousLigneEntourage}</span>${badge}`;
    if (journeeEnEdition) {
      const controles = document.createElement("div");
      controles.className = "controles-edition-journee";
      const champHeure = document.createElement("input");
      champHeure.type = "time";
      champHeure.className = "input-heure-journee";
      champHeure.value = item.heure || "";
      champHeure.setAttribute("aria-label", "Heure de « " + lib.nom + " »");
      champHeure.onchange = (e) => definirHeureItemPlanning(i, e.target.value);
      const btnHaut = document.createElement("button");
      btnHaut.className = "btn-mini-edition"; btnHaut.textContent = "▲";
      btnHaut.disabled = i === 0;
      btnHaut.onclick = () => deplacerItemPlanning(i, -1);
      const btnBas = document.createElement("button");
      btnBas.className = "btn-mini-edition"; btnBas.textContent = "▼";
      btnBas.disabled = i === planning.length - 1;
      btnBas.onclick = () => deplacerItemPlanning(i, 1);
      const btnRetirer = document.createElement("button");
      btnRetirer.className = "btn-mini-edition btn-retirer"; btnRetirer.textContent = "✕";
      btnRetirer.onclick = () => retirerItemPlanning(i);
      controles.append(champHeure, btnHaut, btnBas);
      // Sauter un élément d'aujourd'hui sans le retirer (ex. une sortie
      // annulée) : il n'est plus jamais « maintenant » dans la liste de
      // l'enfant, et se reprend d'un appui.
      if (aujourdhui && estAFaire(item) && !item.fait) {
        const btnSauter = document.createElement("button");
        btnSauter.className = "btn-mini-edition";
        btnSauter.textContent = item.passe ? "↩︎" : "⏭";
        btnSauter.setAttribute("aria-label", (item.passe ? "Reprendre « " : "Sauter « ") + lib.nom + " »");
        btnSauter.onclick = () => basculerPasseItemPlanning(i);
        controles.appendChild(btnSauter);
      }
      controles.appendChild(btnRetirer);
      ligne.appendChild(controles);
    }
    liste.appendChild(ligne);
  });
  conteneur.appendChild(liste);

  if (journeeEnEdition) {
    conteneur.appendChild(construireAjoutPlanning(planning));
    conteneur.appendChild(construireAjoutTexteLibre());
    construireResultatsAjoutTexte();
  }

  const btnModifier = document.getElementById("btn-modifier-journee");
  btnModifier.textContent = journeeEnEdition ? "✅" : "✏️";
  btnModifier.setAttribute("aria-label", journeeEnEdition ? "Terminer la modification" : "Modifier la journée");
}

// Active le mode édition — protégé par le code parent, réutilise le même
// écran/pavé numérique que la validation d'une routine ou d'une arrivée
// (cf. `apresCodeValide`). Le désactiver ne redemande pas le code : le
// code protège l'ENTRÉE en édition, pas la sortie.
function basculerEditionJournee() {
  if (journeeEnEdition) {
    journeeEnEdition = false;
    construireJournee();
    return;
  }
  ecranAvantValidation = document.querySelector(".screen.active").id;
  codeSaisi = "";
  modeCode = "verifier";
  document.getElementById("validation-sous-titre").textContent = "Un parent entre le code pour modifier la journée.";
  document.getElementById("correction-wrap").classList.add("hidden");
  document.getElementById("pavecode-wrap").classList.remove("hidden");
  document.getElementById("pavecode-erreur").textContent = "";
  construireClavier(document.getElementById("pavecode-clavier"), appuyerTouche);
  majCasesCode(document.getElementById("pavecode-cases"), codeSaisi);
  apresCodeValide = () => {
    journeeEnEdition = true;
    afficherEcran("screen-journee");
    construireJournee();
  };
  afficherEcran("screen-validation");
}

function deplacerItemPlanning(i, delta) {
  const planning = chargerPlanningCible();
  const j = i + delta;
  if (j < 0 || j >= planning.length) return;
  const tmp = planning[i];
  planning[i] = planning[j];
  planning[j] = tmp;
  sauverPlanningCible(planning);
  construireJournee();
}

function retirerItemPlanning(i) {
  const planning = chargerPlanningCible();
  planning.splice(i, 1);
  sauverPlanningCible(planning);
  construireJournee();
}

function basculerPasseItemPlanning(i) {
  const planning = chargerPlanningCible();
  if (planning[i].passe) delete planning[i].passe; else planning[i].passe = true;
  sauverPlanningCible(planning);
  construireJournee();
}

// Valeur vide (`<input type="time">` vidé par le parent) : `heure`
// retiré plutôt que mis à "", pour que `item.heure` reste testable en
// simple booléen partout ailleurs (`if (item.heure)`, cf. reperesJournee/
// construireJournee/libelleItemPlanning).
function definirHeureItemPlanning(i, valeur) {
  const planning = chargerPlanningCible();
  if (valeur) planning[i].heure = valeur; else delete planning[i].heure;
  sauverPlanningCible(planning);
  construireJournee();
}

// Ajouté juste avant le coucher (routine à `disponibleApresHeure`) plutôt
// qu'en toute fin : dans la liste de l'enfant, rien ne se lance après le
// coucher, qui clôt la journée.
function ajouterItemPlanning(type, id) {
  insererItemPlanning({ type, id });
}
function insererItemPlanning(item) {
  const planning = chargerPlanningCible();
  const posCoucher = planning.findIndex(estItemCoucher);
  if (posCoucher === -1) planning.push(item); else planning.splice(posCoucher, 0, item);
  sauverPlanningCible(planning);
  construireJournee();
}

// Catalogue d'ajout : tout ce qui existe (routines, aventures — pas
// seulement celles du jour, un parent peut vouloir reprogrammer une
// activité récurrente par exemple —, repas) et n'est pas déjà dans le
// planning. Inclut les
// activités créées par un parent (cf. `toutesLesAventures()`) au même
// titre que celles du catalogue en dur.
function construireAjoutPlanning(planning) {
  const bloc = document.createElement("div");
  const label = document.createElement("div");
  label.className = "groupe-journee-titre";
  label.textContent = "AJOUTER À LA JOURNÉE";
  bloc.appendChild(label);

  const dejaLa = new Set(planning.map(it => it.type + ":" + it.id));
  const candidats = [
    ...toutesLesRoutines().map(r => ({ type: "routine", id: r.id, emoji: r.emoji, nom: r.nom })),
    ...toutesLesAventures().map(a => ({ type: "aventure", id: a.id, emoji: a.emoji, nom: a.lieu })),
    ...REPAS.map(r => ({ type: "repas", id: r.id, emoji: r.emoji, nom: r.nom })),
  ].filter(c => !dejaLa.has(c.type + ":" + c.id));

  if (candidats.length === 0) {
    const vide = document.createElement("div");
    vide.className = "recompenses-vide";
    vide.textContent = "Tout est déjà dans la journée.";
    bloc.appendChild(vide);
  } else {
    const grille = document.createElement("div");
    grille.className = "grille-ajout-planning";
    candidats.forEach(c => {
      const b = document.createElement("button");
      b.className = "btn-ajout-planning";
      b.innerHTML = `<span>${c.emoji}</span><span>${c.nom}</span>`;
      b.onclick = () => ajouterItemPlanning(c.type, c.id);
      grille.appendChild(b);
    });
    bloc.appendChild(grille);
  }

  // Une activité qui n'existe pas encore se crée sans quitter le jour
  // édité : elle y est ajoutée à la création (cf. formulaireDepuisPlanning).
  const creer = document.createElement("div");
  creer.className = "creer-depuis-planning";
  [["sortie", "+ Nouvelle sortie"], ["maison", "+ À la maison"], ["seance", "+ Nouvelle séance"]].forEach(([nature, texte]) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn-secondaire";
    b.textContent = texte;
    b.onclick = () => ouvrirNouvelleAventure({ nature, depuisPlanning: true });
    creer.appendChild(b);
  });
  bloc.appendChild(creer);
  bloc.appendChild(construireAjoutEnLigne());
  return bloc;
}

// Ajouts qui n'existent que dans le planning (pas dans la bibliothèque) :
// une info, un moment au choix — un petit bloc qui se déplie sous les
// boutons, sans quitter le jour édité. `ajoutEnLigne` survit aux
// reconstructions de l'éditeur.
let ajoutEnLigne = null;
let noteEntourageBrouillon = [];
let choixOptionsBrouillon = [];

function construireAjoutEnLigne() {
  const bloc = document.createElement("div");
  const boutons = document.createElement("div");
  boutons.className = "creer-depuis-planning";
  [["note", "+ Info"], ["choix", "+ Moment au choix"]].forEach(([type, texte]) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn-secondaire" + (ajoutEnLigne === type ? " ajout-ouvert" : "");
    b.textContent = texte;
    b.onclick = () => {
      ajoutEnLigne = ajoutEnLigne === type ? null : type;
      noteEntourageBrouillon = [];
      choixOptionsBrouillon = [];
      construireJournee();
    };
    boutons.appendChild(b);
  });
  bloc.appendChild(boutons);
  if (ajoutEnLigne === "note") bloc.appendChild(formulaireNoteEnLigne());
  if (ajoutEnLigne === "choix") bloc.appendChild(formulaireChoixEnLigne());
  return bloc;
}

function formulaireChoixEnLigne() {
  const f = document.createElement("div");
  f.className = "ajout-en-ligne";
  f.innerHTML = `<div class="champ-parent"><span>2 ou 3 idées, parmi les activités</span><div class="grille-entourage" id="ajout-choix-options"></div></div>`
    + `<div class="texte-erreur" id="ajout-choix-erreur"></div>`;
  const grille = f.querySelector("#ajout-choix-options");
  const construire = () => {
    grille.innerHTML = "";
    toutesLesAventures().forEach(a => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip-entourage" + (choixOptionsBrouillon.includes(a.id) ? " choisi" : "");
      b.textContent = a.emoji + " " + a.lieu;
      b.onclick = () => {
        const pos = choixOptionsBrouillon.indexOf(a.id);
        if (pos !== -1) choixOptionsBrouillon.splice(pos, 1);
        else if (choixOptionsBrouillon.length < 3) choixOptionsBrouillon.push(a.id);
        construire();
      };
      grille.appendChild(b);
    });
  };
  construire();
  const b = document.createElement("button");
  b.type = "button";
  b.className = "btn-continuer";
  b.textContent = "Ajouter le moment au choix";
  b.onclick = () => {
    if (choixOptionsBrouillon.length < 2) { f.querySelector("#ajout-choix-erreur").textContent = "Choisis 2 ou 3 activités."; return; }
    const item = { type: "choix", options: [...choixOptionsBrouillon] };
    ajoutEnLigne = null;
    choixOptionsBrouillon = [];
    insererItemPlanning(item);
  };
  f.appendChild(b);
  return f;
}

function formulaireNoteEnLigne() {
  const f = document.createElement("div");
  f.className = "ajout-en-ligne";
  f.innerHTML = `<label class="champ-parent"><span>L'info, telle qu'elle sera dite</span>`
    + `<input type="text" id="ajout-note-texte" maxlength="80" placeholder="Ex : Maman vient te chercher."></label>`
    + `<div class="champ-parent"><span>Avec qui ? (facultatif)</span><div class="grille-entourage" id="ajout-note-entourage"></div></div>`
    + `<div class="texte-erreur" id="ajout-note-erreur"></div>`;
  construireChoixEntourage(f.querySelector("#ajout-note-entourage"), noteEntourageBrouillon);
  const b = document.createElement("button");
  b.type = "button";
  b.className = "btn-continuer";
  b.textContent = "Ajouter l'info";
  b.onclick = () => {
    const texte = f.querySelector("#ajout-note-texte").value.trim();
    if (!texte) { f.querySelector("#ajout-note-erreur").textContent = "Écris l'info à ajouter."; return; }
    const item = { type: "note", texte };
    if (noteEntourageBrouillon.length) item.entourageIds = [...noteEntourageBrouillon];
    ajoutEnLigne = null;
    insererItemPlanning(item);
  };
  f.appendChild(b);
  return f;
}

// ---------------------------------------------------------------------
// Ajout au planning par texte libre + dictée (mode édition de "Ma
// journée") — reconnaissance LOCALE par mots-clés, PAS d'IA : extrait une
// heure si présente puis rapproche le reste du texte des catalogues
// existants (routines/aventures/repas) par comparaison normalisée sur le
// nom et `motsCles` (cf. creerNouvelleAventure/creerNouvelleRoutine).
// Chaque fragment reconnu est PROPOSÉ, jamais ajouté automatiquement (cf.
// confirmerAjoutTexte) — même principe que "le parent valide toujours au
// final" déjà appliqué ailleurs (correction avant validation d'une
// routine, code pour confirmer une arrivée...).
// ---------------------------------------------------------------------

// Minuscule + accents retirés — rapprochement texte robuste sans
// dépendance externe (ex. "Vélo" et "vélo 15h" doivent se reconnaître).
// Décompose (NFD, "é" → "e" + accent séparé) puis ne garde que les points
// de code HORS de la plage des marques diacritiques combinantes
// (U+0300–U+036F) — évite d'écrire cette plage en toutes lettres dans
// une regex, invisible et fragile à l'édition.
function normaliser(texte) {
  return Array.from(texte.toLowerCase().normalize("NFD"))
    .filter(c => c.codePointAt(0) < 0x0300 || c.codePointAt(0) > 0x036f)
    .join("")
    .trim();
}

// Motif "15h", "17h30", "9h05" → "HH:MM", ou `null` si absent. Seulement
// la PREMIÈRE occurrence : un fragment ne représente qu'un seul item.
function extraireHeure(fragment) {
  const m = fragment.match(/(\d{1,2})\s*h\s*(\d{2})?/i);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  if (h > 23 || min > 59) return null;
  return String(h).padStart(2, "0") + ":" + String(min).padStart(2, "0");
}

// Première correspondance dont le nom — ou un des `motsCles` — apparaît
// dans le texte du fragment. Pas de score de pertinence : un catalogue
// personnel et court rend une simple présence suffisamment fiable pour
// cette 1ʳᵉ version. `null` si rien ne correspond.
function trouverCorrespondance(texte) {
  const t = normaliser(texte);
  if (!t) return null;
  const candidats = [
    ...toutesLesRoutines().map(r => ({ type: "routine", id: r.id, emoji: r.emoji, nom: r.nom, motsCles: r.motsCles })),
    ...toutesLesAventures().map(a => ({ type: "aventure", id: a.id, emoji: a.emoji, nom: a.lieu, motsCles: a.motsCles })),
    ...REPAS.map(r => ({ type: "repas", id: r.id, emoji: r.emoji, nom: r.nom })),
  ];
  return candidats.find(c => [c.nom, ...(c.motsCles || [])].some(cle => cle && t.includes(normaliser(cle)))) || null;
}

// Découpe le texte (virgules/retours à la ligne = un fragment par item),
// extrait heure + correspondance pour chacun. Fonction PURE : n'écrit
// rien dans `etat.planning` (cf. confirmerAjoutTexte, appelée séparément
// par le parent, ligne par ligne, une fois les résultats affichés).
function analyserTexteLibre(texte) {
  return texte.split(/[,\n]/).map(f => f.trim()).filter(Boolean).map(fragment => {
    const heure = extraireHeure(fragment);
    const texteSansHeure = heure ? fragment.replace(/(\d{1,2})\s*h\s*(\d{2})?/i, "") : fragment;
    return { texteOriginal: fragment, heure, correspondance: trouverCorrespondance(texteSansHeure) };
  });
}

let texteAjoutBrut = "";
let resultatsAjoutTexte = [];

function analyserEtAfficherTexteLibre() {
  const champ = document.getElementById("ajout-texte-libre");
  texteAjoutBrut = champ.value;
  resultatsAjoutTexte = analyserTexteLibre(texteAjoutBrut);
  construireResultatsAjoutTexte();
}

function construireResultatsAjoutTexte() {
  const conteneur = document.getElementById("resultats-ajout-texte");
  if (!conteneur) return;
  conteneur.innerHTML = "";
  resultatsAjoutTexte.forEach((r, i) => {
    const ligne = document.createElement("div");
    ligne.className = "ligne-journee";
    if (!r.correspondance) {
      ligne.innerHTML = `<span class="emoji-journee">❔</span>`
        + `<span class="texte-journee"><span>« ${r.texteOriginal} »</span><span class="texte-journee-reveil">Aucune correspondance trouvée</span></span>`;
      conteneur.appendChild(ligne);
      return;
    }
    const c = r.correspondance;
    ligne.innerHTML = `<span class="emoji-journee">${c.emoji}</span>`
      + `<span class="texte-journee"><span>${c.nom}</span>${r.heure ? `<span class="texte-journee-reveil">🕒 ${r.heure}</span>` : ""}</span>`;
    const btn = document.createElement("button");
    btn.className = "btn-mini-edition";
    btn.textContent = "✓";
    btn.setAttribute("aria-label", "Ajouter « " + c.nom + " » à la journée");
    btn.onclick = () => confirmerAjoutTexte(i);
    ligne.appendChild(btn);
    conteneur.appendChild(ligne);
  });
}

// Ajoute réellement l'item confirmé au planning — réutilise
// ajouterItemPlanning()/definirHeureItemPlanning() déjà existants, sans
// nouvelle logique d'écriture. Si la correspondance est déjà dans le
// planning du jour (ex. "Petit-déjeuner", présent par défaut), ne
// l'ajoute pas une 2ᵉ fois : lui donne juste l'heure extraite, sur
// l'entrée existante.
function confirmerAjoutTexte(i) {
  const r = resultatsAjoutTexte[i];
  if (!r || !r.correspondance) return;
  const planning = chargerPlanningCible();
  const dejaPresent = planning.some(it => it.type === r.correspondance.type && it.id === r.correspondance.id);
  if (!dejaPresent) ajouterItemPlanning(r.correspondance.type, r.correspondance.id);
  if (r.heure) {
    const planningMaj = chargerPlanningCible();
    const pos = planningMaj.findIndex(it => it.type === r.correspondance.type && it.id === r.correspondance.id);
    if (pos !== -1) definirHeureItemPlanning(pos, r.heure);
  }
  resultatsAjoutTexte.splice(i, 1);
  // `ajouterItemPlanning()`/`definirHeureItemPlanning()` ci-dessus
  // reconstruisent tout `#journee-contenu` (donc aussi ce champ texte,
  // ré-affiché à partir de `texteAjoutBrut`, cf. construireAjoutTexteLibre())
  // — on retire ce fragment-là de `texteAjoutBrut` pour ne pas forcer à
  // tout retaper/re-analyser à chaque ligne confirmée, seulement ce qui
  // reste vraiment à traiter.
  texteAjoutBrut = resultatsAjoutTexte.map(x => x.texteOriginal).join("\n");
  const champ = document.getElementById("ajout-texte-libre");
  if (champ) champ.value = texteAjoutBrut;
  construireResultatsAjoutTexte();
}

function reconnaissanceVocaleDisponible() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

// Dictée (côté PARENT uniquement, jamais dans le parcours de l'enfant) :
// ajoute au texte déjà tapé plutôt que de l'écraser. ⚠️ Contrairement à
// la voix de l'app qui LIT les étapes (Web Speech API en sortie,
// entièrement hors-ligne, cf. dire()), la reconnaissance vocale envoie
// l'audio aux serveurs du navigateur (Google sur Chrome) pour être
// transcrite — pas hors-ligne, décision assumée avec la famille (cf.
// docs/produit/concept.md). Bouton absent si l'API n'existe pas (cf.
// reconnaissanceVocaleDisponible(), construireAjoutTexteLibre()) — pas
// de message d'erreur, juste rien à cet endroit.
function demarrerDicteeAjout() {
  const Reconnaissance = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Reconnaissance) return;
  const reconnaissance = new Reconnaissance();
  reconnaissance.lang = "fr-FR";
  const btn = document.getElementById("btn-dictee-ajout");
  if (btn) btn.classList.add("ecoute");
  reconnaissance.onresult = (e) => {
    const texte = e.results[0][0].transcript;
    texteAjoutBrut = texteAjoutBrut.trim() ? texteAjoutBrut.trim() + ", " + texte : texte;
    const champ = document.getElementById("ajout-texte-libre");
    if (champ) champ.value = texteAjoutBrut;
  };
  reconnaissance.onend = () => { if (btn) btn.classList.remove("ecoute"); };
  reconnaissance.onerror = () => { if (btn) btn.classList.remove("ecoute"); };
  reconnaissance.start();
}

function construireAjoutTexteLibre() {
  const bloc = document.createElement("div");
  const label = document.createElement("div");
  label.className = "groupe-journee-titre";
  label.textContent = "AJOUTER PAR TEXTE";
  bloc.appendChild(label);

  const champ = document.createElement("textarea");
  champ.id = "ajout-texte-libre";
  champ.placeholder = "Ex : vélo 15h, goûter chez mamie 17h";
  champ.value = texteAjoutBrut;
  champ.oninput = (e) => { texteAjoutBrut = e.target.value; };
  bloc.appendChild(champ);

  const ligneBoutons = document.createElement("div");
  ligneBoutons.className = "ligne-boutons-ajout-texte";
  if (reconnaissanceVocaleDisponible()) {
    const btnMicro = document.createElement("button");
    btnMicro.type = "button";
    btnMicro.id = "btn-dictee-ajout";
    btnMicro.className = "btn-dictee";
    btnMicro.textContent = "🎤";
    btnMicro.setAttribute("aria-label", "Dicter le texte à ajouter");
    btnMicro.onclick = demarrerDicteeAjout;
    ligneBoutons.appendChild(btnMicro);
  }
  const btnAnalyser = document.createElement("button");
  btnAnalyser.type = "button";
  btnAnalyser.className = "btn-continuer";
  btnAnalyser.textContent = "Analyser";
  btnAnalyser.onclick = analyserEtAfficherTexteLibre;
  ligneBoutons.appendChild(btnAnalyser);
  bloc.appendChild(ligneBoutons);

  const resultats = document.createElement("div");
  resultats.id = "resultats-ajout-texte";
  bloc.appendChild(resultats);

  return bloc;
}

// ---------------------------------------------------------------------
// Planning (espace parent) — deux onglets. « Semaine type » : les 7 jours
// qui servent de modèle (cf. chargerSemaineType()), chacun avec les emojis
// de ses activités. « Prochains jours » : UNE liste, aujourd'hui d'abord
// puis les JOURS_PLANNING_FUTUR prochains jours (demandé explicitement :
// deux boutons séparés pour "aujourd'hui" et "les jours suivants" dans
// l'espace parent gênait plus qu'autre chose). Chaque ligne ouvre "Ma
// journée" (devenue "Chaque [jour]" ou "Planning du [date]", cf.
// construireJournee()) — même écran, mêmes outils (heures, entourage,
// catalogue, texte libre), juste pointés ailleurs qu'aujourd'hui via
// `planningCible`. Calcul sur l'heure réelle (`new Date()`), jamais
// `dateActuelle()` — cohérent avec `cleJour()`, qui ignore déjà
// délibérément l'heure forcée du panneau debug (cf. son commentaire).
// ---------------------------------------------------------------------
const JOURS_PLANNING_FUTUR = 7;
// Onglet affiché, gardé d'une visite à l'autre de l'écran (on revient d'un
// jour modifié sur l'onglet d'où on l'a ouvert).
let ongletPlanning = "semaine";

function construireParentPlanningJournees() {
  [["btn-onglet-semaine", "semaine"], ["btn-onglet-jours", "jours"]].forEach(([id, onglet]) => {
    const bouton = document.getElementById(id);
    bouton.classList.toggle("actif", ongletPlanning === onglet);
    bouton.setAttribute("aria-selected", String(ongletPlanning === onglet));
  });
  const liste = document.getElementById("parent-planning-journees-liste");
  liste.innerHTML = "";
  // Petit constructeur de carte partagé plutôt que dupliqué entre la
  // ligne "Aujourd'hui" (cas particulier : ni "personnalisé" ni "par
  // défaut", juste "en cours") et la boucle des jours futurs.
  const ajouterCarte = (nom, etatTexte, accentuee, onClick) => {
    const carte = document.createElement("div");
    carte.className = "carte-routine" + (accentuee ? " faite" : "");
    const nomDiv = document.createElement("div");
    nomDiv.className = "carte-routine-nom";
    nomDiv.textContent = nom;
    const droite = document.createElement("div");
    droite.className = "carte-routine-droite";
    const etatDiv = document.createElement("div");
    etatDiv.className = "carte-routine-etat";
    etatDiv.textContent = etatTexte;
    droite.appendChild(etatDiv);
    carte.append(nomDiv, droite);
    carte.onclick = onClick;
    liste.appendChild(carte);
  };

  if (ongletPlanning === "semaine") {
    const semaineType = chargerSemaineType();
    NOMS_JOURS.forEach((nom, i) => {
      const emojis = (semaineType[String(i + 1)] || [])
        .filter(item => item.type === "aventure")
        .map(item => libelleItemPlanning(item))
        .filter(Boolean)
        .map(l => l.emoji);
      ajouterCarte(nom.charAt(0).toUpperCase() + nom.slice(1), emojis.join(" ") || "—", false, () => ouvrirJourSemaineType(i + 1));
    });
    return;
  }

  ajouterCarte("Aujourd'hui", "En cours", true, () => {
    ciblerAujourdhui();
    journeeEnEdition = true;
    construireJournee();
    afficherEcran("screen-journee");
  });

  const futur = chargerPlanningFutur();
  const aujourdhui = new Date();
  for (let i = 1; i <= JOURS_PLANNING_FUTUR; i++) {
    const d = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate() + i);
    const dateKey = cleJourPour(d);
    const personnalise = Array.isArray(futur[dateKey]);
    ajouterCarte(dateLisible(dateKey), personnalise ? "Modifié" : "Comme d'habitude", personnalise, () => ouvrirJourneeFuture(dateKey));
  }
}

function ouvrirJourneeFuture(dateKey) {
  planningCible = { date: dateKey };
  journeeEnEdition = true;
  construireJournee();
  afficherEcran("screen-journee");
}

function ouvrirJourSemaineType(jour) {
  planningCible = { jourSemaine: jour };
  journeeEnEdition = true;
  construireJournee();
  afficherEcran("screen-journee");
}

// ---------------------------------------------------------------------
// Mon chemin : une route qui serpente du départ (en bas) jusqu'à la
// récompense finale (en haut), en larges virages en épingle, avec un rond
// par pièce. L'enfant fait glisser chaque pièce à la main sur le prochain
// rond, qui brille : c'est là qu'il voit sa progression. Une récompense
// atteinte déclenche une fête et part dans « À donner » chez les parents.
// Pas de jauge ni d'étoiles ici. Dessiné dans une zone de 364 × 682 px,
// agrandie à la largeur de l'écran.
// ---------------------------------------------------------------------
const ZONE_CHEMIN = { largeur: 364, hauteur: 682, plateau: { x: 62, y: 627 } };
let feteChemin = null;
let glisserPiece = null;

// Route validée en maquette : tronçons légèrement bombés et virages en
// épingle assez ouverts pour que deux ronds ne se touchent jamais ; ronds
// espacés régulièrement le long de la route.
function geometrieChemin(cases) {
  const R = 60, XG = 96, XD = 268;
  const SEGMENTS = [
    ["l", 78, 518, XD, 518, -8], ["a", XD, 458, Math.PI / 2, -Math.PI / 2],
    ["l", XD, 398, XG, 398, 8], ["a", XG, 338, Math.PI / 2, 3 * Math.PI / 2],
    ["l", XG, 278, XD, 278, -8], ["a", XD, 218, Math.PI / 2, -Math.PI / 2],
    ["l", XD, 158, XG, 158, 8], ["a", XG, 98, Math.PI / 2, 3 * Math.PI / 2],
  ];
  const pts = [];
  SEGMENTS.forEach(seg => {
    for (let k = pts.length ? 1 : 0; k <= 80; k++) {
      const u = k / 80;
      if (seg[0] === "l") pts.push({ x: seg[1] + (seg[3] - seg[1]) * u, y: seg[2] + (seg[4] - seg[2]) * u + seg[5] * Math.pow(Math.sin(Math.PI * u), 2) });
      else { const a = seg[3] + (seg[4] - seg[3]) * u; pts.push({ x: seg[1] + R * Math.cos(a), y: seg[2] + R * Math.sin(a) }); }
    }
  });
  const cumul = [0];
  for (let k = 1; k < pts.length; k++) cumul.push(cumul[k - 1] + Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y));
  const L = cumul[cumul.length - 1];
  const auPoint = (dist) => {
    let k = 1;
    while (k < cumul.length - 1 && cumul[k] < dist) k++;
    const r = (dist - cumul[k - 1]) / (cumul[k] - cumul[k - 1] || 1);
    return { x: pts[k - 1].x + r * (pts[k].x - pts[k - 1].x), y: pts[k - 1].y + r * (pts[k].y - pts[k - 1].y) };
  };
  const ronds = [];
  for (let i = 0; i < cases - 1; i++) ronds.push(auPoint(16 + i * (L - 96) / (cases - 2)));
  ronds.push(auPoint(L - 6));
  let d = "";
  for (let k = 0; k < pts.length; k += 2) d += (k === 0 ? "M" : " L") + pts[k].x.toFixed(1) + " " + pts[k].y.toFixed(1);
  return { ronds, d };
}
const DECOR_CHEMIN = [
  { x: 28, y: 458, emoji: "🍄" }, { x: 182, y: 458, emoji: "🌳" }, { x: 330, y: 338, emoji: "🌻" },
  { x: 182, y: 338, emoji: "🌳" }, { x: 28, y: 218, emoji: "🌼" }, { x: 182, y: 218, emoji: "🌲" },
  { x: 300, y: 80, emoji: "⛰️" },
];

function ouvrirChemin() {
  feteChemin = null;
  glisserPiece = null;
  construireChemin();
  afficherEcran("screen-chemin");
  dire(phraseChemin(chargerChemin(), chargerPiecesAPoser()));
}

function construireChemin() {
  const chemin = chargerChemin();
  const aPoser = chargerPiecesAPoser();
  const finale = recompenseDeLaCase(chemin, chemin.cases);
  document.getElementById("chemin-but").textContent = "🏁 Au bout du chemin" + (finale ? " : " + finale.emoji + " " + finale.nom : "");

  const zone = document.getElementById("chemin-zone");
  zone.replaceChildren();
  const geo = geometrieChemin(chemin.cases);
  const paysage = document.createElement("div");
  paysage.className = "chemin-paysage";
  paysage.innerHTML = `<svg class="chemin-route" width="364" height="560" aria-hidden="true">`
    + `<path class="route-bord" d="${geo.d}"></path><path class="route-sol" d="${geo.d}"></path><path class="route-ligne" d="${geo.d}"></path></svg>`
    + DECOR_CHEMIN.map(dc => `<span class="chemin-deco" style="left:${dc.x}px;top:${dc.y}px">${dc.emoji}</span>`).join("")
    + `<span class="chemin-depart" style="left:66px;top:544px">DÉPART</span>`;
  const cible = !feteChemin && aPoser > 0 && chemin.posees < chemin.cases ? chemin.posees + 1 : null;
  geo.ronds.forEach((p, i) => {
    const n = i + 1;
    const rec = recompenseDeLaCase(chemin, n);
    const estFinale = n === chemin.cases;
    const pleine = n <= chemin.posees;
    const rond = document.createElement("div");
    rond.className = "chemin-rond" + (pleine ? " pleine" : "") + (rec && !estFinale ? " cadeau" : "") + (estFinale ? " finale" : "") + (n === cible ? " cible" : "");
    rond.style.left = Math.round(p.x) + "px";
    rond.style.top = Math.round(p.y) + "px";
    if (n === cible) rond.id = "chemin-cible";
    if (pleine) {
      // La pièce remplit exactement son rond (48 px, 64 au bout).
      rond.appendChild(elementPiece(estFinale ? 4 : 3, { pose: "rotateX(24deg)" }));
      if (rec) { const b = document.createElement("span"); b.className = "badge-cadeau"; b.textContent = rec.emoji; rond.appendChild(b); }
    } else if (rec) rond.textContent = rec.emoji;
    paysage.appendChild(rond);
  });
  zone.appendChild(paysage);

  if (feteChemin) {
    const fete = document.createElement("div");
    fete.className = "chemin-fete";
    fete.innerHTML = `<span class="fete-emoji">${feteChemin.emoji}</span><span class="fete-titre">${feteChemin.titre}</span>`
      + `<span class="fete-sous">Papa ou maman va te donner ta récompense.</span>`;
    const ok = document.createElement("button");
    ok.type = "button";
    ok.className = "btn-continuer";
    ok.textContent = "Super ! 🎉";
    ok.onclick = () => { feteChemin = null; construireChemin(); };
    fete.appendChild(ok);
    zone.appendChild(fete);
  } else if (cible) {
    const plateau = document.createElement("div");
    plateau.className = "chemin-plateau";
    plateau.innerHTML = `<span class="chemin-aide"><span class="aide-doigt">👆</span> Fais glisser ta pièce jusqu'au rond qui brille.</span>`;
    const piece = document.createElement("button");
    piece.type = "button";
    piece.className = "chemin-piece-plateau";
    piece.setAttribute("aria-label", "Ma pièce à poser : fais-la glisser sur le chemin");
    piece.style.left = ZONE_CHEMIN.plateau.x + "px";
    piece.style.top = ZONE_CHEMIN.plateau.y + "px";
    piece.appendChild(elementPiece(4));
    if (aPoser > 1) { const c = document.createElement("span"); c.className = "chemin-compte"; c.textContent = "×" + aPoser; piece.appendChild(c); }
    piece.onpointerdown = commencerGlisserPiece;
    zone.append(plateau, piece);
  } else {
    const rien = document.createElement("div");
    rien.className = "chemin-rien";
    rien.textContent = chemin.posees >= chemin.cases
      ? "Tu es au bout du chemin ! Papa ou maman va préparer la suite."
      : "Pas de pièce à poser pour l'instant. Les étoiles et les sorties en apportent !";
    zone.appendChild(rien);
  }
  ajusterZoneChemin();
}

// La zone garde ses 364 px de dessin et s'agrandit à la largeur de l'écran.
function ajusterZoneChemin() {
  const cadre = document.getElementById("chemin-cadre");
  const zone = document.getElementById("chemin-zone");
  const k = Math.max(0.8, Math.min(1.6, (cadre.clientWidth || ZONE_CHEMIN.largeur) / ZONE_CHEMIN.largeur));
  zone.style.transform = "scale(" + k + ")";
  cadre.style.height = Math.round(ZONE_CHEMIN.hauteur * k) + "px";
  zone.style.left = Math.max(0, Math.round(((cadre.clientWidth || 0) - ZONE_CHEMIN.largeur * k) / 2)) + "px";
}

function positionDansZone(e) {
  const zone = document.getElementById("chemin-zone");
  const rect = zone.getBoundingClientRect();
  const k = rect.width / ZONE_CHEMIN.largeur || 1;
  return { x: (e.clientX - rect.left) / k, y: (e.clientY - rect.top) / k };
}

function commencerGlisserPiece(e) {
  if (glisserPiece) return;
  e.preventDefault();
  const source = e.currentTarget;
  try { source.setPointerCapture(e.pointerId); } catch (err) {}
  source.classList.add("prise");
  const volante = document.createElement("div");
  volante.className = "chemin-piece-volante";
  volante.appendChild(elementPiece(4));
  document.getElementById("chemin-zone").appendChild(volante);
  glisserPiece = { source, volante, pointerId: e.pointerId };
  deplacerPiece(e);
  // Écouté sur la fenêtre : la pièce suit le doigt même hors du bouton,
  // et un lâcher n'importe où (ou une interruption) la fait toujours revenir.
  window.addEventListener("pointermove", deplacerPiece);
  window.addEventListener("pointerup", lacherPiece);
  window.addEventListener("pointercancel", lacherPiece);
}

function placerVolante(x, y, ajustee) {
  const v = glisserPiece.volante;
  v.style.left = x + "px";
  v.style.top = y + "px";
  v.classList.toggle("ajustee", ajustee);
}

function deplacerPiece(e) {
  if (!glisserPiece || e.pointerId !== glisserPiece.pointerId) return;
  const p = positionDansZone(e);
  const cible = document.getElementById("chemin-cible");
  const cx = cible ? parseFloat(cible.style.left) : NaN, cy = cible ? parseFloat(cible.style.top) : NaN;
  const distance = cible ? Math.hypot(p.x - cx, p.y - cy) : Infinity;
  if (cible) cible.classList.toggle("proche", distance < 60);
  // Près du bon rond, la pièce prend sa taille exacte et s'y aligne.
  if (distance <= 34) placerVolante(cx, cy, true); else placerVolante(p.x, p.y, false);
}

function lacherPiece(e) {
  if (!glisserPiece || e.pointerId !== glisserPiece.pointerId) return;
  const { source, volante } = glisserPiece;
  window.removeEventListener("pointermove", deplacerPiece);
  window.removeEventListener("pointerup", lacherPiece);
  window.removeEventListener("pointercancel", lacherPiece);
  const p = positionDansZone(e);
  const cible = document.getElementById("chemin-cible");
  const ok = cible && e.type === "pointerup" && Math.hypot(p.x - parseFloat(cible.style.left), p.y - parseFloat(cible.style.top)) <= 34;
  if (ok) { glisserPiece = null; poserPiece(); return; }
  // Lâchée ailleurs : elle revient toute seule sur le plateau.
  volante.classList.add("retour");
  placerVolante(ZONE_CHEMIN.plateau.x, ZONE_CHEMIN.plateau.y, false);
  setTimeout(() => {
    volante.remove();
    source.classList.remove("prise");
    if (cible) cible.classList.remove("proche");
    glisserPiece = null;
  }, 320);
  dire("Presque ! Pose ta pièce sur le rond qui brille.");
}

function poserPiece() {
  const chemin = chargerChemin();
  const aPoser = chargerPiecesAPoser();
  if (!aPoser || chemin.posees >= chemin.cases) { construireChemin(); return; }
  chemin.posees++;
  const n = chemin.posees;
  const rec = recompenseDeLaCase(chemin, n);
  if (rec) chemin.atteintes.push({ case: n, emoji: rec.emoji, nom: rec.nom, gagneeLe: cleJour() });
  sauverChemin(chemin);
  sauverPiecesAPoser(aPoser - 1);
  const dureePose = sonPose();
  try { if (navigator.vibrate) navigator.vibrate(45); } catch (err) {}
  if (rec) {
    const finale = n === chemin.cases;
    const titre = (finale ? "Bravo, tu as gagné : " : "Tu as gagné : ") + rec.nom + " !";
    feteChemin = { emoji: rec.emoji, titre };
    // La fanfare, puis seulement la voix : jamais les deux en même temps.
    setTimeout(() => {
      const duree = sonFanfare(finale);
      setTimeout(() => dire(titre), duree * 1000 + 150);
    }, dureePose * 1000 + 50);
  }
  construireChemin();
}

function clignoterRoutine(id) {
  const carte = document.querySelector('#liste-journee [data-id="' + id + '"]');
  if (!carte) return;
  carte.classList.remove("clignote");
  void carte.offsetWidth; // relance l'animation même si elle vient de jouer
  carte.classList.add("clignote");
}

// ---------------------------------------------------------------------
// 1. Écran d'une routine (générique, alimenté par ROUTINES)
// ---------------------------------------------------------------------
function synchroniserRoutineEcran() {
  const etat = chargerEtat();
  const routine = routineParId(routineActuelleId);
  const etatR = etat.routines[routine.id];

  synchroniserAvatar(etat);
  document.getElementById("nom-routine").textContent = routine.nom;
  const scene = document.getElementById("scene");
  scene.classList.toggle("scene-salon", routine.lieu === "salon");
  // Chambre du profil actif en fond quand la routine s'y déroule
  // (habillage, coucher) — même image que profilActif().chambre, un champ
  // optionnel (absent pour un profil créé depuis l'app, cf.
  // tousLesProfils() : pas de photo de chambre dédiée, seulement le
  // dégradé). Pas de décor pour "salon" (ni pour "chambre" sans photo) :
  // on efface l'image pour retrouver le dégradé placeholder de
  // #scene.scene-salon.
  scene.style.backgroundImage = (routine.lieu === "chambre" && profilActif().chambre) ? "url('" + profilActif().chambre + "')" : "";
  // Panier de linge : présent en permanence pendant "Aller se coucher",
  // pas seulement pendant la tâche "ranger" — sert de repère fixe avant
  // même que les vêtements ne tombent (cf. #panier-linge, index.html).
  document.getElementById("panier-linge").classList.toggle("visible", routine.id === "soir");

  // prochaine tâche à faire (première non cochée), seule jouable : les
  // suivantes n'ont pas d'icône glissable tant que celle-ci n'est pas
  // validée (ordre imposé).
  const prochaine = routine.taches.find(t => !etatR.fait.includes(t.id));

  const consigneEl = document.getElementById("etape-courante");
  if (prochaine) {
    consigneEl.textContent = prochaine.texte;
    if (derniereEtapeAnnoncee !== prochaine.id) {
      derniereEtapeAnnoncee = prochaine.id;
      dire(prochaine.texte);
    }
  }

  // Avatar directement glissable pour une tâche `avatarGlissable` (ex.
  // "enlève tes vêtements") : la poignée invisible est reconstruite à
  // chaque rendu (comme #chemin plus bas) pour ne jamais accumuler
  // d'écouteurs sur #avatar-wrap, qui lui reste le même élément DOM
  // d'un rendu à l'autre (contrairement aux lignes de #chemin, recréées
  // à chaque fois). L'avatar respire doucement (`.invite-glisser`) pour
  // inviter le geste tant que cette tâche est en cours.
  const avatarWrapRoutine = document.getElementById("avatar-wrap");
  avatarWrapRoutine.classList.toggle("invite-glisser", !!(prochaine && prochaine.avatarGlissable));
  document.getElementById("fleche-detacher").classList.toggle("visible", !!(prochaine && prochaine.avatarGlissable));
  const poignee = document.getElementById("avatar-poignee");
  poignee.innerHTML = "";
  if (prochaine && prochaine.avatarGlissable) {
    const poigneeGlissable = document.createElement("div");
    poigneeGlissable.className = "poignee-glissable";
    poignee.appendChild(poigneeGlissable);
    rendreAvatarGlissable(poigneeGlissable, avatarWrapRoutine, prochaine);
  }

  // Pile de vêtements pour une tâche `pileGlissable` (ex. "Range tes
  // vêtements") : matérialise dans la scène ce qui vient de tomber
  // pendant `avatarGlissable` (ci-dessus), plutôt que de le faire
  // disparaître pour de bon avant même cette tâche. Reconstruite à
  // chaque rendu (même raison que la poignée avatar) ; se glisse comme
  // n'importe quelle icône de tâche normale (rendreGlissable(), vers
  // `zone`), juste depuis la scène plutôt que depuis la liste.
  const pileConteneur = document.getElementById("pile-vetements");
  pileConteneur.innerHTML = "";
  if (prochaine && prochaine.pileGlissable) {
    const pile = document.createElement("div");
    pile.className = "pile-glissable";
    pile.textContent = "👕";
    pileConteneur.appendChild(pile);
    rendreGlissable(pile, prochaine);
  }

  // liste : toutes les tâches restent visibles, pour que l'enfant voie
  // d'un coup d'œil la quantité totale à accomplir. Plus aucune ligne
  // n'est tapable (retour de terrain : l'enfant hésitait entre taper la
  // ligne et glisser l'icône) — seule l'icône de l'étape en cours, agrandie,
  // est glissable ; le texte reste affiché à côté pendant le geste
  // (lecture globale). Les tâches faites descendent en bas de liste.
  // Exception : une tâche `avatarGlissable` (ci-dessus) n'a pas d'icône
  // glissable dans la liste — le geste se fait sur l'avatar, pas ici.
  const restantes = routine.taches.filter(t => !etatR.fait.includes(t.id));
  const faites = routine.taches.filter(t => etatR.fait.includes(t.id));
  const liste = document.getElementById("chemin"); liste.innerHTML = "";
  [...restantes, ...faites].forEach(t => {
    const fait = etatR.fait.includes(t.id);
    const enCours = prochaine && t.id === prochaine.id;
    const noeud = document.createElement("div");
    noeud.className = "noeud" + (fait ? " fait" : "") + (enCours ? " en-cours" : "") + (enCours && t.miniJeu ? " noeud-tapable" : "");
    // `!!t.zone` : une tâche sans zone (ex. "Fais tes devoirs", cf.
    // synchroniserMinuteurWidget() plus bas) n'a rien à glisser, même
    // sans être avatarGlissable/miniJeu/pileGlissable pour autant.
    const glisserIci = enCours && !!t.zone && !t.avatarGlissable && !t.miniJeu && !t.pileGlissable;
    const classeIcone = "pastille-mini" + (glisserIci ? " pastille-glissable" : "");
    noeud.innerHTML = `<div class="${classeIcone}">${t.emoji}</div><div class="texte-etape">${t.texte}</div><div class="coche-mini">✓</div>`;
    if (glisserIci) rendreGlissable(noeud.querySelector(".pastille-glissable"), t);
    // `miniJeu` (ex. "dents") : ouvre un écran dédié en tapant la ligne,
    // plutôt qu'en y glissant l'icône (cf. ouvrirMiniJeu()). Un minuteur
    // (`t.minuteurDuree`) n'a pas ce traitement : il se règle/se termine
    // depuis le widget sous la consigne, jamais en tapant la ligne
    // (cf. synchroniserMinuteurWidget()).
    if (enCours && t.miniJeu) noeud.onclick = () => ouvrirMiniJeu(t);
    liste.appendChild(noeud);
  });

  // barre de progression segmentée, propre à cette routine
  const barre = document.getElementById("barre-etapes");
  if (barre.childElementCount !== routine.taches.length) {
    barre.innerHTML = "";
    routine.taches.forEach(() => barre.appendChild(document.createElement("div")));
  }
  [...barre.children].forEach((seg, i) => seg.classList.toggle("fait", etatR.fait.includes(routine.taches[i].id)));

  // Minuteur global de routine : n'a de sens que tant qu'il reste une
  // tâche à faire — une fois la routine finie (`!prochaine`), on l'efface
  // plutôt que de le laisser tourner pour rien (cf. finDeRoutine() juste
  // en dessous, qui prend le relais).
  if (prochaine) synchroniserMinuteurRoutineWidget(routine);
  else {
    retirerUnMinuteur("routine", routine.id, null);
    document.getElementById("minuteur-routine-widget").classList.add("hidden");
  }
  synchroniserMinuteurWidget(prochaine, routine);

  if (!prochaine) setTimeout(() => finDeRoutine(), 500);
}

function marquerTache(id, valeur) {
  const etat = chargerEtat();
  const etatR = etat.routines[routineActuelleId];
  const pos = etatR.fait.indexOf(id);
  if (valeur && pos === -1) etatR.fait.push(id);
  if (!valeur && pos !== -1) etatR.fait.splice(pos, 1);
  sauverEtat(etat);
  // Le minuteur de cette tâche (s'il y en avait un) devient sans objet
  // dès qu'elle est faite — que ce soit via le glisser-déposer normal ou
  // "J'ai fini" (cf. synchroniserMinuteurWidget()), les deux passent par
  // ici : plus besoin de vérifier/alerter dessus. `routineId` ET
  // `tacheId` (pas `tacheId` seul, cf. assurerMinuteurPourTache()) :
  // "t1" d'une routine ne doit pas nettoyer le minuteur de "t1" d'une
  // autre routine.
  if (valeur) retirerUnMinuteur("tache", routineActuelleId, id);
  synchroniserRoutineEcran();
  if (valeur) {
    jouerSon();
    if (navigator.vibrate) navigator.vibrate(45);
    const w = document.getElementById("avatar-wrap");
    w.classList.remove("pop"); void w.offsetWidth; w.classList.add("pop");
  }
}

// L'icône vit maintenant dans la ligne de la liste, à côté de son texte
// (lecture globale : le mot reste visible pendant le geste). On glisse un
// CLONE positionné en `fixed` par-dessus tout, plutôt que l'élément
// d'origine : l'icône d'origine passe juste en `visibility:hidden` (garde
// sa place dans la ligne, le texte ne bouge pas) le temps du geste.
function rendreGlissable(el, etape) {
  function debut(ev) {
    ev.preventDefault();
    const rect = el.getBoundingClientRect();
    const clone = el.cloneNode(true);
    Object.assign(clone.style, { position: "fixed", left: rect.left + "px", top: rect.top + "px",
      width: rect.width + "px", height: rect.height + "px", zIndex: "100", margin: "0", pointerEvents: "none" });
    document.body.appendChild(clone);
    el.style.visibility = "hidden";
    dragCtx = { el, clone, etape, offsetX: ev.clientX - rect.left, offsetY: ev.clientY - rect.top,
                startLeft: rect.left, startTop: rect.top };
    el.setPointerCapture(ev.pointerId);
    const zone = document.getElementById(etape.zone);
    if (zone) zone.classList.add("active");
  }
  function deplace(ev) {
    if (!dragCtx || dragCtx.el !== el) return;
    dragCtx.clone.style.left = (ev.clientX - dragCtx.offsetX) + "px";
    dragCtx.clone.style.top = (ev.clientY - dragCtx.offsetY) + "px";
  }
  function fin(ev) {
    if (!dragCtx || dragCtx.el !== el) return;
    const zoneEl = document.getElementById(etape.zone);
    let succes = false;
    if (zoneEl) {
      const zr = zoneEl.getBoundingClientRect(), cr = dragCtx.clone.getBoundingClientRect();
      const cx = cr.left + cr.width / 2, cy = cr.top + cr.height / 2;
      succes = cx >= zr.left && cx <= zr.right && cy >= zr.top && cy <= zr.bottom;
    }
    if (zoneEl) zoneEl.classList.remove("active");
    if (succes) {
      dragCtx.clone.style.transition = "transform .18s ease, opacity .18s ease";
      dragCtx.clone.style.transform = "scale(0.3)";
      dragCtx.clone.style.opacity = "0";
      const clone = dragCtx.clone;
      setTimeout(() => { clone.remove(); marquerTache(etape.id, true); }, 160);
    } else {
      dragCtx.clone.style.transition = "left .3s ease, top .3s ease";
      dragCtx.clone.style.left = dragCtx.startLeft + "px";
      dragCtx.clone.style.top = dragCtx.startTop + "px";
      const clone = dragCtx.clone;
      setTimeout(() => { clone.remove(); el.style.visibility = ""; }, 300);
    }
    dragCtx = null;
  }
  el.addEventListener("pointerdown", debut);
  el.addEventListener("pointermove", deplace);
  el.addEventListener("pointerup", fin);
  el.addEventListener("pointercancel", fin);
}

// Variante de rendreGlissable() pour une tâche `avatarGlissable` (ex.
// "enlève tes vêtements") : ce qu'on glisse n'est pas une icône de la
// liste vers une zone, mais les vêtements ACTUELLEMENT PORTÉS (ceux
// listés dans `etape.calque`) tirés hors de la scène — succès si on les
// lâche sous le bas de #scene (pas de zone précise à viser, cible
// volontairement large et sans ambiguïté avec la tâche suivante "Range
// tes vêtements", qui cible "zone-panier").
//
// Retour de terrain (session précédente) : cloner tout #avatar-wrap et
// le cacher pendant le geste faisait disparaître l'enfant entier de la
// scène, pas juste ses habits — pas intuitif ("enlève TES vêtements",
// pas "pars"). Ici seuls les calques visibles concernés sont clonés
// (donc juste le t-shirt/pantalon/etc.) ; le reste de l'avatar (corps,
// visage...) ne bouge jamais.
//
// `poignee` est une zone de tap invisible superposée à l'avatar
// (#avatar-poignee, reconstruite à chaque rendu) : les calques de
// l'avatar ont `pointer-events:none`, il faut donc un élément dédié
// pour capter le geste, sur toute la silhouette (on peut attraper
// n'importe quel vêtement visible en tapant n'importe où sur lui).
// Cacher/remontrer un calque utilise le même mécanisme que
// synchroniserAvatar() (classe `visible`, jamais de style inline) pour
// qu'un futur passage de synchroniserAvatar() (ex. après un "Relancer
// une routine" parent) ne se heurte pas à un style oublié.
function rendreAvatarGlissable(poignee, avatarWrap, etape) {
  function debut(ev) {
    ev.preventDefault();
    const rect = avatarWrap.getBoundingClientRect();
    const calques = Array.isArray(etape.calque) ? etape.calque : [etape.calque];
    const imgs = calques
      .map(c => avatarWrap.querySelector('.avatar-calque[data-calque="' + c + '"]'))
      .filter(img => img && img.classList.contains("visible"));
    const clone = document.createElement("div");
    Object.assign(clone.style, { position: "fixed", left: rect.left + "px", top: rect.top + "px",
      width: rect.width + "px", height: rect.height + "px", zIndex: "100", pointerEvents: "none" });
    imgs.forEach(img => {
      const imgClone = img.cloneNode(true); // clone AVANT de cacher l'original : garde la classe "visible" (opacity/scale)
      Object.assign(imgClone.style, { position: "absolute", inset: "0", width: "100%", height: "100%" });
      clone.appendChild(imgClone);
      img.classList.remove("visible");
    });
    document.body.appendChild(clone);
    dragCtx = { el: avatarWrap, clone, etape, imgs, offsetX: ev.clientX - rect.left, offsetY: ev.clientY - rect.top,
                startLeft: rect.left, startTop: rect.top };
    poignee.setPointerCapture(ev.pointerId);
  }
  function deplace(ev) {
    if (!dragCtx || dragCtx.el !== avatarWrap) return;
    dragCtx.clone.style.left = (ev.clientX - dragCtx.offsetX) + "px";
    dragCtx.clone.style.top = (ev.clientY - dragCtx.offsetY) + "px";
  }
  function fin(ev) {
    if (!dragCtx || dragCtx.el !== avatarWrap) return;
    const sr = document.getElementById("scene").getBoundingClientRect();
    const cr = dragCtx.clone.getBoundingClientRect();
    const succes = (cr.top + cr.height / 2) > sr.bottom;
    const imgs = dragCtx.imgs;
    if (succes) {
      dragCtx.clone.style.transition = "transform .2s ease, opacity .2s ease";
      dragCtx.clone.style.transform = "translateY(40px)";
      dragCtx.clone.style.opacity = "0";
      const clone = dragCtx.clone;
      setTimeout(() => {
        clone.remove();
        // les vêtements restent cachés (classe déjà retirée) : la tâche
        // est faite, marquerTache() -> synchroniserAvatar() confirme le
        // même état, rien à restaurer ici contrairement à l'échec.
        marquerTache(etape.id, true);
      }, 180);
    } else {
      dragCtx.clone.style.transition = "left .3s ease, top .3s ease";
      dragCtx.clone.style.left = dragCtx.startLeft + "px";
      dragCtx.clone.style.top = dragCtx.startTop + "px";
      const clone = dragCtx.clone;
      setTimeout(() => {
        clone.remove();
        imgs.forEach(img => img.classList.add("visible")); // remis sur le vrai avatar
      }, 300);
    }
    dragCtx = null;
  }
  poignee.addEventListener("pointerdown", debut);
  poignee.addEventListener("pointermove", deplace);
  poignee.addEventListener("pointerup", fin);
  poignee.addEventListener("pointercancel", fin);
}

// ---------------------------------------------------------------------
// Mini-jeu : brossage de dents (tâche `miniJeu: "dents"`) — écran dédié
// (screen-dents), pas un simple glisser-déposer comme le reste. Deux
// PHASES avec chacune sa propre bouche illustrée (cf. index.html,
// #bouche-ouverte/#bouche-fermee) et son propre jeu de zones, demandées
// explicitement pour remplacer les 6 tuiles 🦷 abstraites d'origine :
//   1. "ouverte" — bouche grande ouverte, dents du haut ET du bas
//      visibles (surfaces internes/masticatoires), dit « Aaaa ».
//      4 zones, bas d'abord : bas-gauche, bas-droite, haut-gauche,
//      haut-droite (pas de zone "devant" : le geste passe déjà par le
//      centre en balayant d'un côté à l'autre bouche grande ouverte).
//   2. "fermee" — dents serrées, lèvres tirées en arrière (surfaces
//      externes), dit « Iiii ». 3 zones : droite, devant, gauche.
// Chaque zone dure 20s (DUREE_PAR_ZONE_DENTS), donc 7 × 20s = 2 min 20
// au total (contre 3 min sur les 6 zones d'origine, 30s/zone).
//
// Volontairement AUCUNE action requise de l'enfant pendant le brossage
// (inchangé) : il doit se concentrer sur le geste réel avec sa vraie
// brosse à dents, pas sur l'écran. Le minuteur démarre tout seul à
// l'ouverture et avance tout seul, zone après zone puis phase après
// phase (`dentsEnCours`, vrai par défaut) — la seule interaction
// possible est de le mettre en pause/reprendre (`toggleDentsPause()`),
// jamais requise. Une fois les deux phases épuisées, marque la tâche
// `dents` de la routine en cours comme faite (même geste que les
// autres — son, vibration, étoile de tâche via marquerTache()) et
// revient à l'écran de routine.
const PHASES_DENTS = [
  { id: "ouverte", zones: ["bas-gauche", "bas-droite", "haut-gauche", "haut-droite"],
    consigne: "Ouvre grand la bouche et dis « Aaaa »." },
  { id: "fermee", zones: ["droite", "devant", "gauche"],
    consigne: "Ferme les dents, tire les lèvres en arrière et fais « Iiii »." },
];
const LIBELLES_ZONES_DENTS = {
  "bas-gauche": "en bas, à gauche", "bas-droite": "en bas, à droite",
  "haut-gauche": "en haut, à gauche", "haut-droite": "en haut, à droite",
  "gauche": "à gauche", "devant": "devant", "droite": "à droite",
};
const DUREE_PAR_ZONE_DENTS = 20; // secondes — 7 zones × 20s = 2 min 20 au total

let dentsEtapeRoutine = null; // la tâche `dents` de la routine en cours, pour marquerTache() à la fin
let dentsPhaseIndex = 0;
let dentsZoneIndex = 0; // index DANS la phase courante (PHASES_DENTS[dentsPhaseIndex].zones)
let dentsTempsRestant = DUREE_PAR_ZONE_DENTS;
let dentsEnCours = true; // le minuteur avance tout seul par défaut ; false seulement si mis en pause
let dentsMinuteurId = null;

// Point d'entrée générique pour toute tâche `miniJeu` (aujourd'hui, une
// seule valeur possible : "dents") — dispatché depuis
// synchroniserRoutineEcran() au tap sur la ligne de la tâche.
function ouvrirMiniJeu(etape) {
  if (etape.miniJeu === "dents") demarrerBrossageDents(etape);
  if (etape.miniJeu === "histoire") ouvrirHistoire(etape);
}

// Nombre total de zones toutes phases confondues — pour la barre de
// progression (#dents-barre), une seule jauge continue plutôt qu'une
// par phase.
function totalZonesDents() { return PHASES_DENTS.reduce((n, p) => n + p.zones.length, 0); }
// Position globale de la zone courante dans cette jauge (zones des
// phases précédentes + position dans la phase courante).
function indexGlobalDents() {
  let n = 0;
  for (let i = 0; i < dentsPhaseIndex; i++) n += PHASES_DENTS[i].zones.length;
  return n + dentsZoneIndex;
}

function demarrerBrossageDents(etape) {
  dentsEtapeRoutine = etape;
  dentsEnCours = true; // démarre tout seul, cf. commentaire plus haut
  const barre = document.getElementById("dents-barre");
  const total = totalZonesDents();
  if (barre.childElementCount !== total) {
    barre.innerHTML = "";
    for (let i = 0; i < total; i++) barre.appendChild(document.createElement("div"));
  }
  afficherEcran("screen-dents");
  changerPhaseDents(0, true);
  if (dentsMinuteurId) clearInterval(dentsMinuteurId); // sécurité, ne devrait jamais rester actif
  dentsMinuteurId = setInterval(tickDents, 250);
}

// Bascule vers la phase `i` : remet zone/temps à zéro, échange la bouche
// visible (cf. #bouche-ouverte/#bouche-fermee, index.html) et annonce la
// consigne de la phase + la première zone en une seule phrase.
// `premiereFois` évite de répéter la consigne de phase quand on ne fait
// qu'avancer d'une zone à l'autre À L'INTÉRIEUR de la même phase (cf.
// avancerZoneDents(), qui n'appelle PAS cette fonction dans ce cas).
function changerPhaseDents(i, premiereFois) {
  dentsPhaseIndex = i;
  dentsZoneIndex = 0;
  dentsTempsRestant = DUREE_PAR_ZONE_DENTS;
  const phase = PHASES_DENTS[i];
  document.getElementById("bouche-ouverte").classList.toggle("hidden", phase.id !== "ouverte");
  document.getElementById("bouche-fermee").classList.toggle("hidden", phase.id !== "fermee");
  majAffichageDents();
  const premiereZone = LIBELLES_ZONES_DENTS[phase.zones[0]];
  dire(phase.consigne + " Brosse " + premiereZone + ".");
}

// Seule action possible pendant le brossage — jamais requise, juste
// disponible (ex. interruption). Ne modifie ni la zone/phase ni le temps
// restant, juste si le minuteur avance.
function toggleDentsPause() {
  dentsEnCours = !dentsEnCours;
  majAffichageDents();
}

function tickDents() {
  if (!dentsEnCours) return;
  dentsTempsRestant = Math.max(0, dentsTempsRestant - 0.25);
  majAffichageDents();
  if (dentsTempsRestant <= 0) avancerZoneDents();
}

function avancerZoneDents() {
  jouerSon();
  if (navigator.vibrate) navigator.vibrate(30);
  const phase = PHASES_DENTS[dentsPhaseIndex];
  dentsZoneIndex++;
  if (dentsZoneIndex >= phase.zones.length) {
    // Phase terminée : phase suivante (nouvelle bouche + consigne), ou
    // fin du brossage si c'était la dernière.
    if (dentsPhaseIndex + 1 >= PHASES_DENTS.length) { finBrossageDents(); return; }
    changerPhaseDents(dentsPhaseIndex + 1, false);
    return;
  }
  dentsTempsRestant = DUREE_PAR_ZONE_DENTS;
  // dentsEnCours n'est pas touché : le minuteur enchaîne sur la zone
  // suivante sans s'arrêter, sauf si l'enfant/parent l'a mis en pause.
  majAffichageDents();
  dire("Brosse maintenant " + LIBELLES_ZONES_DENTS[phase.zones[dentsZoneIndex]] + ".");
}

function finBrossageDents() {
  clearInterval(dentsMinuteurId);
  dentsMinuteurId = null;
  dire("Bravo, tes dents sont propres !");
  const etape = dentsEtapeRoutine;
  dentsEtapeRoutine = null;
  marquerTache(etape.id, true); // met à jour l'avatar (badge ✨), le son/vibration/étoile de tâche habituels
  afficherEcran("screen-routine");
}

// Quitter avant la fin (bouton retour) : rien n'est encore enregistré
// dans etat.routines (seul finBrossageDents() appelle marquerTache()),
// donc rien à perdre — mais il faut couper le minuteur, sinon il continue
// de tourner en arrière-plan et pourrait déclencher avancerZoneDents()
// sur un écran qu'on a quitté.
function quitterBrossageDents() {
  if (dentsMinuteurId) { clearInterval(dentsMinuteurId); dentsMinuteurId = null; }
  dentsEtapeRoutine = null;
  afficherEcran("screen-routine");
}

// ---------------------------------------------------------------------
// Mini-jeu : histoire du soir (tâche `miniJeu: "histoire"`) — écran dédié
// (screen-histoire), même principe que les dents ci-dessus mais sans
// minuteur : juste une image (parent/enfants sur le canapé, cf.
// app/assets/scenes/histoire-soir.jpg) et un texte, le temps que la
// lecture ait vraiment lieu à côté de la tablette. C'est un parent qui
// appuie sur "L'histoire est finie" une fois la lecture terminée (comme
// "On est arrivés"/"C'est parti" en aventure) — pas l'enfant, il n'y a
// rien à faire ici, juste à écouter.
const TEXTE_HISTOIRE = "On lit l'histoire du soir, on reste assis calmement sur le canapé et on profite de ce moment de détente et de partage.";
let histoireEtapeRoutine = null;

function ouvrirHistoire(etape) {
  histoireEtapeRoutine = etape;
  document.getElementById("histoire-texte").textContent = TEXTE_HISTOIRE;
  afficherEcran("screen-histoire");
  dire(TEXTE_HISTOIRE);
}

// Échappatoire pour un tap accidentel sur la ligne, même principe que
// retourMenuDepuisRoutine() : rien n'est encore enregistré (seul
// finHistoire() appelle marquerTache()), donc rien à perdre.
function quitterHistoire() {
  histoireEtapeRoutine = null;
  afficherEcran("screen-routine");
}

function finHistoire() {
  const etape = histoireEtapeRoutine;
  histoireEtapeRoutine = null;
  marquerTache(etape.id, true);
  afficherEcran("screen-routine");
}

// ---------------------------------------------------------------------
// Minuteur générique — deux portées possibles : "tache" (`tache.minuteurDuree`,
// widget sous la consigne courante) ou "routine" (`routine.dureeGlobale`,
// widget en haut de l'écran, cf. synchroniserMinuteurRoutineWidget() plus
// bas) — même mécanique pour les deux, juste des tailles/emplacements de
// widget différents. Affiché SUR l'écran de routine, jamais un écran
// séparé. Un minuteur de tâche est indépendant de `zone` : une tâche à
// glisser-déposer (ex. "Mets ton caleçon") garde son geste normal, le
// widget est juste un repère en plus ; une tâche SANS zone (ex. "Fais tes
// devoirs") se valide via le bouton "J'ai fini" du même widget, faute de
// cible à glisser (cf. synchroniserMinuteurWidget()).
//
// Plusieurs minuteurs peuvent tourner EN MÊME TEMPS (cle("minuteurs_actifs"),
// un tableau plutôt qu'un seul objet) : le minuteur global d'une routine
// et celui d'une de ses tâches, ou même les minuteurs de deux routines
// différentes si l'enfant a quitté l'une sans finir sa tâche chronométrée
// avant d'en commencer une autre — chacun identifié par
// (portee, routineId, tacheId), cf. trouverMinuteur()/sauverUnMinuteur().
//
// Le minuteur continue de tourner même si l'enfant quitte l'écran de la
// routine (menu, autre routine...) : vérifié par tickMinuteurGlobal(),
// lancé au chargement de la page (tout en bas du fichier) et jamais
// arrêté, indépendamment de l'écran affiché — c'est ce qui permet à la
// vérification/l'alerte d'interrompre l'enfant même s'il n'est pas
// devant la tablette au moment où le temps s'écoule (cf. "Fais tes
// devoirs").
//
// État persisté (horodatage de fin réel `finPrevue`) plutôt qu'un simple
// compte à rebours en mémoire — même principe que cle("reveil") : survit
// à une mise en veille/fermeture de l'app, contrairement à un nombre de
// secondes qui repartirait de zéro n'importe comment à la réouverture.
//
// Cycle si `alertes` est actif (sinon le minuteur s'arrête simplement à
// 00:00 sans rien déclencher d'autre, cf. tickMinuteurGlobal()) :
// decompte (durée réglée) -> temps écoulé, tâche/routine pas finie ->
// verification1 ("As-tu besoin d'aide ?", plein écran) -> "Non" ->
// decompte2 (durée réduite, widget à nouveau) -> temps écoulé -> bloque
// directement (pas de 3e question ; "Oui" à verification1 -> bloque
// aussi). "🆘 Besoin d'aide" (dans le widget, toujours visible pendant un
// décompte même si `alertes` est désactivé : l'enfant peut demander de
// l'aide même sur un minuteur sans escalade automatique) -> bloque
// directement, à tout moment. Une fois bloque résolu par un parent (code
// entré), l'aide vient d'être donnée : le cycle repart de `decompte`
// avec la durée d'origine, plutôt que de laisser le minuteur inerte (cf.
// debloquerMinuteurAvecCode()) — une nouvelle chance de finir dans les
// temps, avec le même filet en cas de blocage répété. `minuteurEnDialogue`
// retient LEQUEL des minuteurs actifs est concerné pendant qu'un écran de
// vérification/blocage est affiché (un seul à la fois peut interrompre
// l'enfant, cf. tickMinuteurGlobal()).
function chargerMinuteursActifs() {
  try { return JSON.parse(localStorage.getItem(cle("minuteurs_actifs")) || "[]"); } catch (e) { return []; }
}
function sauverMinuteursActifs(liste) {
  try { localStorage.setItem(cle("minuteurs_actifs"), JSON.stringify(liste)); } catch (e) {}
}
function trouverMinuteur(portee, routineId, tacheId) {
  return chargerMinuteursActifs().find(m => m.portee === portee && m.routineId === routineId && m.tacheId === tacheId) || null;
}
// Remplace l'entrée existante (même portee/routineId/tacheId) ou l'ajoute.
function sauverUnMinuteur(minuteur) {
  const liste = chargerMinuteursActifs();
  const idx = liste.findIndex(m => m.portee === minuteur.portee && m.routineId === minuteur.routineId && m.tacheId === minuteur.tacheId);
  if (idx === -1) liste.push(minuteur); else liste[idx] = minuteur;
  sauverMinuteursActifs(liste);
}
function retirerUnMinuteur(portee, routineId, tacheId) {
  sauverMinuteursActifs(chargerMinuteursActifs().filter(m => !(m.portee === portee && m.routineId === routineId && m.tacheId === tacheId)));
}
let minuteurEnDialogue = null;

// Démarre le minuteur de `etape` s'il n'existe pas encore, ou renvoie
// celui déjà en cours (decompte/decompte2/verification1/bloque) sans y
// toucher — appelée à CHAQUE rendu de l'écran de routine tant que la
// tâche courante a un minuteur (cf. synchroniserMinuteurWidget()), donc
// volontairement idempotente : ne doit jamais réinitialiser un minuteur
// déjà en cours pour la même tâche. `routineId` ET `tacheId` (pas
// `tacheId` seul) : les tâches créées depuis ce formulaire partagent le
// même id générique "t1".."t5" d'une routine à l'autre (cf.
// creerNouvelleRoutine()), donc un `tacheId` seul confondrait la tâche
// "t1" d'une routine avec la tâche "t1" d'une autre.
// `routine` (en plus de `etape`) seulement pour lire son `styleMinuteur` —
// posé sur la routine entière plutôt que par tâche (cf. dessinerMinuteur()
// plus bas) : pas d'écran de réglages sensoriels par enfant aujourd'hui,
// mais deux enfants peuvent déjà avoir des styles différents puisqu'une
// routine appartient à un seul profil.
function assurerMinuteurPourTache(etape, routine) {
  const existant = trouverMinuteur("tache", routineActuelleId, etape.id);
  if (existant) return existant;
  const minuteur = {
    portee: "tache",
    routineId: routineActuelleId,
    tacheId: etape.id,
    etape: "decompte",
    alertes: etape.minuteurAlertes !== false,
    style: (routine && routine.styleMinuteur) || "jauge",
    dureeEtape: etape.minuteurDuree,
    finPrevue: new Date(dateActuelle().getTime() + etape.minuteurDuree * 1000).toISOString(),
  };
  sauverUnMinuteur(minuteur);
  return minuteur;
}

// Même principe qu'assurerMinuteurPourTache(), pour le minuteur global
// d'une routine entière (`routine.dureeGlobale`) — `tacheId: null` le
// distingue de tous les minuteurs de tâche de cette même routine.
function assurerMinuteurPourRoutine(routine) {
  if (!routine.dureeGlobale) return null;
  const existant = trouverMinuteur("routine", routine.id, null);
  if (existant) return existant;
  const minuteur = {
    portee: "routine",
    routineId: routine.id,
    tacheId: null,
    etape: "decompte",
    alertes: routine.alertesGlobales !== false,
    style: routine.styleMinuteur || "jauge",
    dureeEtape: routine.dureeGlobale,
    finPrevue: new Date(dateActuelle().getTime() + routine.dureeGlobale * 1000).toISOString(),
  };
  sauverUnMinuteur(minuteur);
  return minuteur;
}

// Affiche/masque le widget de tâche (#minuteur-widget, dans screen-routine)
// selon la tâche courante — appelée depuis synchroniserRoutineEcran() à
// chaque rendu. Le widget doit apparaître si l'UN OU L'AUTRE est vrai :
// un minuteur est réglé (jauge/chrono/SOS, seulement pendant un vrai
// décompte — pas verification1/bloque, gérés par leurs propres écrans
// plein écran) OU la tâche n'a pas de zone à glisser (`btn-minuteur-widget-fini`,
// seule façon de la valider dans ce cas). Les deux sont indépendants
// (cf. creerNouvelleRoutine()) : une tâche sans zone ET sans minuteur
// doit quand même afficher le bouton "J'ai fini" — sinon elle n'est
// validable d'aucune façon (bug réel signalé en usage : case "Glisser
// pour valider" décochée sans minuteur réglé, tâche bloquée des deux
// côtés).
function synchroniserMinuteurWidget(prochaine, routine) {
  const widget = document.getElementById("minuteur-widget");
  const btnFini = document.getElementById("btn-minuteur-widget-fini");
  const aMinuteur = !!(prochaine && prochaine.minuteurDuree);
  // L'avatar à tirer ou le mini-jeu sont déjà le geste de la tâche : sans
  // eux, le bouton apparaissait sous la scène et permettait de les sauter.
  const sansGeste = !!(prochaine && !prochaine.zone && !prochaine.avatarGlissable && !prochaine.miniJeu);
  if (!prochaine || (!aMinuteur && !sansGeste)) { widget.classList.add("hidden"); return; }
  widget.classList.remove("hidden");
  let enDecompte = false;
  if (aMinuteur) {
    const minuteur = assurerMinuteurPourTache(prochaine, routine);
    enDecompte = minuteur.etape === "decompte" || minuteur.etape === "decompte2";
    if (enDecompte) dessinerMinuteurWidget(minuteur);
  }
  document.getElementById("minuteur-widget-decompte").classList.toggle("hidden", !enDecompte);
  btnFini.classList.toggle("hidden", !sansGeste);
  btnFini.onclick = () => marquerTache(prochaine.id, true);
}

// Même principe que synchroniserMinuteurWidget() ci-dessus, pour le
// widget global (#minuteur-routine-widget, en haut de screen-routine,
// cf. index.html) — pas de bouton "J'ai fini" ici : une routine se
// termine quand toutes ses tâches sont faites (cf. synchroniserRoutineEcran()),
// jamais par un geste dédié au minuteur lui-même.
function synchroniserMinuteurRoutineWidget(routine) {
  const widget = document.getElementById("minuteur-routine-widget");
  if (!routine.dureeGlobale) { widget.classList.add("hidden"); return; }
  const minuteur = assurerMinuteurPourRoutine(routine);
  const enDecompte = minuteur.etape === "decompte" || minuteur.etape === "decompte2";
  widget.classList.toggle("hidden", !enDecompte);
  if (enDecompte) dessinerMinuteurWidget(minuteur);
}

// Rendu (jauge + chrono) — appelé à la fois par synchroniserMinuteurWidget()/
// synchroniserMinuteurRoutineWidget() (dès qu'un décompte est affiché) et
// par tickMinuteurGlobal() (à chaque tick tant que ce décompte tourne).
// `minuteur.portee` choisit le widget (tâche ou routine) à mettre à jour ;
// sans effet visible si ce widget est masqué (l'élément existe quand même
// dans le DOM), donc pas besoin de vérifier lequel est affiché avant.
function dessinerMinuteurWidget(minuteur) {
  const restant = Math.max(0, (new Date(minuteur.finPrevue) - dateActuelle()) / 1000);
  const pourcentage = minuteur.dureeEtape > 0 ? Math.max(0, Math.min(1, restant / minuteur.dureeEtape)) : 0;
  const prefixe = minuteur.portee === "routine" ? "minuteur-routine" : "minuteur-widget";
  dessinerMinuteur(prefixe, pourcentage, minuteur.style || "jauge");
  document.getElementById(prefixe + "-chrono").textContent = formatChrono(restant);
}

// Fonction de rendu — deux styles au choix (routine.styleMinuteur, cf.
// creerNouvelleRoutine()) : "jauge" (barre qui se vide) ou "cadran"
// (disque qui rétrécit en rotation horaire, façon Time Timer). Les deux
// éléments existent toujours dans le DOM pour un widget donné (cf.
// index.html) ; seul celui du style actif est démasqué, plutôt que d'en
// injecter/retirer un dynamiquement à chaque tick. `prefixe` (pas un
// élément déjà résolu) car "cadran" et "jauge" ciblent des éléments
// différents — aux appelants de ne connaître que "quel widget, quel
// style, quelle fraction restante", jamais le détail de chaque style.
function dessinerMinuteur(prefixe, pourcentageRestant, style) {
  const enCadran = style === "cadran";
  document.getElementById(prefixe + "-jauge").classList.toggle("hidden", enCadran);
  document.getElementById(prefixe + "-cadran").classList.toggle("hidden", !enCadran);
  if (enCadran) {
    document.getElementById(prefixe + "-cadran").style.setProperty("--pct", pourcentageRestant);
  } else {
    document.getElementById(prefixe + "-remplissage").style.width = (pourcentageRestant * 100) + "%";
  }
}

// Vérifie l'état de TOUS les minuteurs actifs, indépendamment de l'écran
// affiché — c'est ce qui permet à la vérification/l'alerte d'apparaître
// même si l'enfant est revenu au menu (ou ailleurs) entre-temps, pas
// seulement s'il est resté sur l'écran de la routine. Lancé en continu
// depuis le tout début du chargement de la page (cf. tout en bas du
// fichier), pas seulement pendant une routine — sans effet la plupart du
// temps (pas de minuteur actif), coût négligeable (une lecture localStorage).
function tickMinuteurGlobal() {
  if (!profilActifId()) return; // pas encore de profil configuré sur cet appareil (cf. cle())
  const liste = chargerMinuteursActifs();
  if (!liste.length) return;

  // Rendu continu de tous les décomptes en cours, qu'ils soient affichés
  // ou non en ce moment (sans effet si le widget correspondant est
  // masqué) — avant toute transition, pour que le dernier chiffre visible
  // avant une éventuelle interruption soit à jour.
  liste.forEach(m => { if (m.etape === "decompte" || m.etape === "decompte2") dessinerMinuteurWidget(m); });

  // Un seul écran de vérification/blocage à la fois : si l'un est déjà
  // affiché (pour un autre minuteur, coïncidence rare), on attend qu'il
  // se résolve avant d'en déclencher un second.
  const ecranActifId = document.querySelector(".screen.active").id;
  if (ecranActifId === "screen-minuteur-verification" || ecranActifId === "screen-minuteur-bloque") return;

  for (const m of liste) {
    if (m.etape !== "decompte" && m.etape !== "decompte2") continue;
    const restant = (new Date(m.finPrevue) - dateActuelle()) / 1000;
    if (restant > 0) continue;

    if (!m.alertes) { retirerUnMinuteur(m.portee, m.routineId, m.tacheId); continue; }

    if (m.etape === "decompte") {
      m.etape = "verification1";
      sauverUnMinuteur(m);
      minuteurEnDialogue = { portee: m.portee, routineId: m.routineId, tacheId: m.tacheId };
      jouerAlerte();
      if (navigator.vibrate) navigator.vibrate([100, 80, 100, 80, 100]);
      afficherEcran("screen-minuteur-verification");
      dire("As-tu besoin d'aide pour faire ta routine ou ta mission ?");
    } else {
      entrerBlocageMinuteur(m);
    }
    return; // un seul déclenchement par tick, cf. commentaire plus haut
  }
}

function repondreVerificationMinuteur(besoinAide) {
  if (!minuteurEnDialogue) return;
  const minuteur = trouverMinuteur(minuteurEnDialogue.portee, minuteurEnDialogue.routineId, minuteurEnDialogue.tacheId);
  if (!minuteur) { minuteurEnDialogue = null; construireMenu(); return; }
  if (besoinAide) { entrerBlocageMinuteur(minuteur); return; }
  // "Non, ça va" : nouveau décompte, plus court (borné à 60s minimum pour
  // rester utile même sur un très petit minuteur d'origine) — pas de 3e
  // question si celui-ci arrive aussi à zéro, cf. tickMinuteurGlobal().
  // Retour sur l'écran de la routine : le(s) widget(s) reprennent le
  // décompte (cf. synchroniserMinuteurWidget()/synchroniserMinuteurRoutineWidget(),
  // assurerMinuteurPourTache()/assurerMinuteurPourRoutine()).
  minuteur.etape = "decompte2";
  minuteur.dureeEtape = Math.max(60, Math.round(minuteur.dureeEtape / 3));
  minuteur.finPrevue = new Date(dateActuelle().getTime() + minuteur.dureeEtape * 1000).toISOString();
  sauverUnMinuteur(minuteur);
  minuteurEnDialogue = null;
  demarrerRoutine(minuteur.routineId);
}

// "🆘 Besoin d'aide" (dans l'un des deux widgets, cf.
// demanderAideMinuteurTache()/demanderAideMinuteurRoutine()) ou 2e
// décompte écoulé sans réponse (cf. tickMinuteurGlobal()) : passe direct
// par-dessus une 3e question, sur l'idée que si ça bloque encore après
// une relance, un parent doit s'en mêler plutôt que d'insister.
function entrerBlocageMinuteur(minuteur) {
  minuteur.etape = "bloque";
  sauverUnMinuteur(minuteur);
  minuteurEnDialogue = { portee: minuteur.portee, routineId: minuteur.routineId, tacheId: minuteur.tacheId };
  jouerAlerte();
  if (navigator.vibrate) navigator.vibrate([150, 100, 150, 100, 150, 100, 150]);
  afficherEcran("screen-minuteur-bloque");
  dire("Un parent est nécessaire.");
}

// Boutons SOS des deux widgets — chacun cherche SON minuteur (celui de la
// tâche courante, ou celui de la routine active) plutôt que de supposer
// "le seul actif" : plusieurs peuvent tourner en même temps (cf. tête de
// section).
function demanderAideMinuteurTache() {
  const routine = routineParId(routineActuelleId);
  if (!routine) return;
  const etat = chargerEtat();
  const prochaine = routine.taches.find(t => !etat.routines[routine.id].fait.includes(t.id));
  const minuteur = prochaine && trouverMinuteur("tache", routineActuelleId, prochaine.id);
  if (minuteur) entrerBlocageMinuteur(minuteur);
}
function demanderAideMinuteurRoutine() {
  const minuteur = trouverMinuteur("routine", routineActuelleId, null);
  if (minuteur) entrerBlocageMinuteur(minuteur);
}

// Déblocage réservé à un parent — même pavé numérique que le reste (cf.
// construireClavier()/validerCode(), "Points d'entrée utiles" dans
// app/README.md), pas un mécanisme séparé. Une fois validé, l'aide vient
// d'être donnée : le cycle repart de `decompte` avec la durée d'origine
// (`tache.minuteurDuree` ou `routine.dureeGlobale`, jamais
// `minuteur.dureeEtape`, qui peut avoir été réduite par un décompte2
// entre-temps) et revient sur la routine concernée. Si la tâche/routine a
// disparu depuis (cas limite — modifiée entre-temps), efface simplement
// le minuteur plutôt que de planter.
function debloquerMinuteurAvecCode() {
  ecranAvantValidation = "screen-minuteur-bloque";
  codeSaisi = "";
  modeCode = "verifier";
  document.getElementById("validation-sous-titre").textContent = "Un parent entre le code pour continuer.";
  document.getElementById("correction-wrap").classList.add("hidden");
  document.getElementById("pavecode-wrap").classList.remove("hidden");
  document.getElementById("pavecode-erreur").textContent = "";
  construireClavier(document.getElementById("pavecode-clavier"), appuyerTouche);
  majCasesCode(document.getElementById("pavecode-cases"), codeSaisi);
  apresCodeValide = () => {
    if (!minuteurEnDialogue) { construireMenu(); return; }
    const { portee, routineId, tacheId } = minuteurEnDialogue;
    minuteurEnDialogue = null;
    const minuteur = trouverMinuteur(portee, routineId, tacheId);
    if (!minuteur) { construireMenu(); return; }
    const routine = routineParId(routineId);
    const dureeOrigine = routine && (portee === "tache" ? (routine.taches.find(t => t.id === tacheId) || {}).minuteurDuree : routine.dureeGlobale);
    if (!dureeOrigine) {
      retirerUnMinuteur(portee, routineId, tacheId);
    } else {
      minuteur.etape = "decompte";
      minuteur.dureeEtape = dureeOrigine;
      minuteur.finPrevue = new Date(dateActuelle().getTime() + dureeOrigine * 1000).toISOString();
      sauverUnMinuteur(minuteur);
    }
    demarrerRoutine(routineId);
  };
  afficherEcran("screen-validation");
}

function formatChrono(secondes) {
  const total = Math.ceil(secondes);
  return Math.floor(total / 60) + ":" + String(total % 60).padStart(2, "0");
}

// Ne touche que les zones de la bouche actuellement visible
// (`.svg-bouche:not(.hidden)` — l'autre reste cachée et inchangée, cf.
// changerPhaseDents()). La brillance progressive (`.zone-dent-remplissage`)
// est positionnée/dimensionnée ici à partir du rectangle réel de chaque
// dent (`getBBox()`), jamais codée en dur : fonctionne pareil pour les
// deux bouches malgré leurs coordonnées différentes.
function majAffichageDents() {
  const phase = PHASES_DENTS[dentsPhaseIndex];
  const svgActif = document.querySelector(".svg-bouche:not(.hidden)");
  svgActif.querySelectorAll(".zone-dent").forEach((zoneEl) => {
    const i = phase.zones.indexOf(zoneEl.dataset.zone);
    const base = zoneEl.querySelector(".zone-dent-base");
    const remplissage = zoneEl.querySelector(".zone-dent-remplissage");
    const { x, y, width, height } = base.getBBox();
    let progression; // 0..1, part déjà "brillante" de cette dent
    if (i < dentsZoneIndex) {
      zoneEl.classList.add("faite"); zoneEl.classList.remove("active", "brossage-actif");
      progression = 1;
    } else if (i === dentsZoneIndex) {
      zoneEl.classList.remove("faite"); zoneEl.classList.add("active");
      zoneEl.classList.toggle("brossage-actif", dentsEnCours); // anime tant que le minuteur avance, plus lié au toucher
      progression = 1 - dentsTempsRestant / DUREE_PAR_ZONE_DENTS;
    } else {
      zoneEl.classList.remove("faite", "active", "brossage-actif");
      progression = 0;
    }
    const hauteurRemplie = height * progression;
    remplissage.setAttribute("x", x);
    remplissage.setAttribute("width", width);
    remplissage.setAttribute("y", y + height - hauteurRemplie);
    remplissage.setAttribute("height", hauteurRemplie);
  });
  document.getElementById("dents-consigne").textContent = "Brosse " + LIBELLES_ZONES_DENTS[phase.zones[dentsZoneIndex]] + ".";
  document.getElementById("dents-chrono").textContent = formatChrono(dentsTempsRestant);
  const barre = document.getElementById("dents-barre");
  const global = indexGlobalDents();
  [...barre.children].forEach((seg, i) => seg.classList.toggle("fait", i < global));
  const btnPause = document.getElementById("btn-pause-dents");
  btnPause.textContent = dentsEnCours ? "⏸️ Pause" : "▶️ Reprendre";
}

// ---------------------------------------------------------------------
// 2. Fin de routine : félicitations puis appel au parent
// ---------------------------------------------------------------------
// Ce que fait « Un parent est avec moi » sur l'écran de félicitations :
// valider une routine (par défaut) ou une activité à la maison.
let suiteBravo = null;
function finDeRoutine() {
  suiteBravo = allerValidation;
  const routine = routineParId(routineActuelleId);
  const suite = "Maintenant va chercher papa ou maman pour obtenir ta récompense.";
  const felicitation = accorderPourEnfant(routine.felicitation);
  document.getElementById("bravo-routine-titre").textContent = felicitation;
  document.getElementById("bravo-routine-soustitre").textContent = suite;
  afficherEcran("screen-bravo-routine");
  dire(felicitation + " " + suite);
}

// ---------------------------------------------------------------------
// 3. Validation parent : code, puis une suite qui dépend de pourquoi on
// est là (`apresCodeValide`) — relecture/correction pour une routine
// (ci-dessous), ou juste continuer pour une simple confirmation
// d'arrivée (cf. allerValidationArrivee, pas de tâches à corriger).
// ---------------------------------------------------------------------
let codeSaisi = "";
let apresCodeValide = null;
// Écran actif juste avant d'ouvrir screen-validation (n'importe laquelle
// de ses 5 entrées : validation de routine, édition de la journée,
// espace parent, changement de code, confirmation d'arrivée) — capturé
// pour que le bouton retour du bandeau puisse y ramener sans avoir à
// connaître spécifiquement d'où on vient.
let ecranAvantValidation = null;
// "verifier" (code existant, cas normal) | "nouveau1"/"nouveau2" (les
// deux saisies successives d'un nouveau code, cf. demarrerChangementCode())
// | "initial1"/"initial2" (même mécanique, pour le tout premier code
// parent d'un profil qu'on vient de créer, cf. demarrerCodeInitial()).
let modeCode = "verifier";
let premierNouveauCode = "";
// Bouton de la correction (#btn-valider-routine) : sert à la fois à
// valider une routine tout juste finie (étoile) et à confirmer une
// relance de routine depuis l'espace parent (pas d'étoile en plus,
// cf. confirmerRelanceRoutine()) — même écran/liste, action différente.
let actionCorrection = null;

function allerValidation() {
  ecranAvantValidation = document.querySelector(".screen.active").id;
  const routine = routineParId(routineActuelleId);
  codeSaisi = "";
  modeCode = "verifier";
  document.getElementById("validation-sous-titre").textContent =
    "Un parent entre le code pour valider « " + routine.nom + " ».";
  document.getElementById("correction-wrap").classList.add("hidden");
  document.getElementById("pavecode-wrap").classList.remove("hidden");
  document.getElementById("pavecode-erreur").textContent = "";
  construireClavier(document.getElementById("pavecode-clavier"), appuyerTouche);
  majCasesCode(document.getElementById("pavecode-cases"), codeSaisi);
  apresCodeValide = () => {
    // Routine déjà faite une fois aujourd'hui (s'habiller à nouveau...) :
    // son étoile est acquise, ce passage se valide sans coffre.
    // Le coucher se valide aussi sans coffre : pas de fête avant de dormir.
    const coucher = estItemCoucher({ type: "routine", id: routine.id });
    const etoileDejaDonnee = chargerEtat().routines[routine.id].etoileDonnee;
    document.getElementById("correction-note").textContent = "Décoche ce qui n'a pas vraiment été fait, puis valide.";
    document.getElementById("btn-valider-routine").textContent = coucher || etoileDejaDonnee ? "Valider ✅" : "Déverrouiller le coffre 🔒";
    actionCorrection = coucher ? validerCoucher : etoileDejaDonnee ? validerRoutineSansCoffre : ouvrirCoffreRoutine;
    construireCorrection();
    document.getElementById("correction-wrap").classList.remove("hidden");
  };
  afficherEcran("screen-validation");
}

// Généralisé (conteneur + callback) pour servir aussi bien le pavé du
// code existant que celui d'un nouveau code (cf. demarrerChangementCode())
// sans dupliquer le clavier.
function construireClavier(conteneur, onTouche) {
  conteneur.innerHTML = "";
  const touches = ["1","2","3","4","5","6","7","8","9","⌫","0","OK"];
  touches.forEach(t => {
    const b = document.createElement("button");
    b.className = "touche-code";
    b.textContent = t;
    b.onclick = () => onTouche(t);
    conteneur.appendChild(b);
  });
}
function majCasesCode(conteneurCases, saisi) {
  const cases = conteneurCases.querySelectorAll(".case-code");
  cases.forEach((c, i) => c.classList.toggle("rempli", i < saisi.length));
}
function appuyerTouche(t) {
  if (t === "⌫") { codeSaisi = codeSaisi.slice(0, -1); majCasesCode(document.getElementById("pavecode-cases"), codeSaisi); return; }
  if (t === "OK") { validerCode(); return; }
  if (codeSaisi.length >= 4) return;
  codeSaisi += t;
  majCasesCode(document.getElementById("pavecode-cases"), codeSaisi);
  if (codeSaisi.length === 4) setTimeout(validerCode, 150);
}
function validerCode() {
  const cases = document.getElementById("pavecode-cases");

  if (modeCode === "verifier") {
    if (codeSaisi === codeParentActuel()) {
      document.getElementById("pavecode-erreur").textContent = "";
      document.getElementById("pavecode-wrap").classList.add("hidden");
      if (apresCodeValide) apresCodeValide();
    } else {
      document.getElementById("pavecode-erreur").textContent = "Code incorrect.";
      codeSaisi = "";
      majCasesCode(cases, codeSaisi);
    }
    return;
  }

  // Changement de code (cf. demarrerChangementCode()) ou tout premier code
  // parent d'un profil qu'on vient de créer (cf. demarrerCodeInitial()) :
  // deux saisies identiques de suite avant d'être enregistré, comme un
  // changement de mot de passe classique — évite d'enregistrer une faute
  // de frappe. Même mécanique pour les deux, seule la suite change une
  // fois enregistré (cf. plus bas).
  if (modeCode === "nouveau1" || modeCode === "initial1") {
    premierNouveauCode = codeSaisi;
    codeSaisi = "";
    modeCode = modeCode === "initial1" ? "initial2" : "nouveau2";
    document.getElementById("validation-sous-titre").textContent = "Retape le même code pour confirmer.";
    majCasesCode(cases, codeSaisi);
    return;
  }
  // modeCode === "nouveau2" ou "initial2"
  if (codeSaisi === premierNouveauCode) {
    const premiereConfig = modeCode === "initial2";
    sauverCodeParent(premierNouveauCode);
    document.getElementById("pavecode-wrap").classList.add("hidden");
    modeCode = "verifier";
    if (premiereConfig) {
      finaliserPremiereConfiguration();
    } else {
      dire("Nouveau code enregistré.");
      construireEspaceParent();
      afficherEcran("screen-parent");
    }
  } else {
    document.getElementById("pavecode-erreur").textContent = "Les deux codes ne correspondent pas. On recommence.";
    codeSaisi = "";
    premierNouveauCode = "";
    modeCode = modeCode === "initial2" ? "initial1" : "nouveau1";
    document.getElementById("validation-sous-titre").textContent = "Entre le nouveau code à 4 chiffres.";
    majCasesCode(cases, codeSaisi);
  }
}

// relecture/correction : toutes les tâches de la routine sont ici
// déclickables (pas seulement l'étape en cours comme pendant la
// routine), pour que le parent puisse décocher ce qui n'a pas été fait
// (ou plus vrai, cf. relancerRoutine()).
function construireCorrection() {
  const etat = chargerEtat();
  const routine = routineParId(routineActuelleId);
  const etatR = etat.routines[routine.id];
  const liste = document.getElementById("correction-liste");
  liste.innerHTML = "";
  routine.taches.forEach(t => {
    const fait = etatR.fait.includes(t.id);
    const noeud = document.createElement("div");
    noeud.className = "noeud correctible" + (fait ? " fait" : "");
    noeud.innerHTML = `<div class="pastille-mini">${t.emoji}</div><div class="texte-etape">${t.texte}</div><div class="coche-mini">✓</div>`;
    noeud.onclick = () => {
      const e2 = chargerEtat();
      const r2 = e2.routines[routine.id];
      const pos = r2.fait.indexOf(t.id);
      if (pos === -1) r2.fait.push(t.id); else r2.fait.splice(pos, 1);
      sauverEtat(e2);
      synchroniserAvatar(e2);
      construireCorrection();
    };
    liste.appendChild(noeud);
  });
}

// Appelée quand le parent tape "Déverrouiller le coffre" en fin de
// correction : ça déverrouille le coffre (l'enfant peut l'ouvrir), mais
// ça ne donne PAS encore l'étoile — voir ouvrirCoffre()/ouvrirCadenasCoffre()
// plus bas, où `avantOuverture` (ci-dessous) s'exécute seulement quand
// l'enfant tape lui-même sur le coffre. Le geste d'ouverture revient à
// l'enfant, la validation reste au parent (code + correction déjà faits).
// `emojiRevele: "⭐"` : à l'ouverture, le coffre révèle l'étoile
// elle-même, pas un cadeau générique.
function ouvrirCoffreRoutine() {
  const idRoutine = routineActuelleId;
  ouvrirCoffre(null, null, () => { routineActuelleId = null; construireMenu(); }, () => {
    const etat = chargerEtat();
    etat.routines[idRoutine].valide = true;
    etat.routines[idRoutine].etoileDonnee = true;
    etat.etoiles = (etat.etoiles || 0) + 1;
    marquerItemFait(etat, "routine", idRoutine);
    sauverEtat(etat);
    const felicitation = accorderPourEnfant(routineParId(idRoutine).felicitation);
    document.getElementById("coffre-texte").textContent = felicitation;
    document.getElementById("coffre-recompense-texte").textContent = "+ 1 ⭐ (" + etat.etoiles + " aujourd'hui)";
    return { texteVoix: felicitation, symbolesConfettis: ["⭐", "✨", "🎉"], emojiRevele: "⭐" };
  });
}

// Le coucher validé : son étoile est donnée sans coffre (si ce n'est déjà
// fait), puis la journée se termine en douceur (cf. allerDormir()).
function validerCoucher() {
  const idRoutine = routineActuelleId;
  const etat = chargerEtat();
  const r = etat.routines[idRoutine];
  r.valide = true;
  if (!r.etoileDonnee) { r.etoileDonnee = true; etat.etoiles = (etat.etoiles || 0) + 1; }
  marquerItemFait(etat, "routine", idRoutine);
  sauverEtat(etat);
  routineActuelleId = null;
  allerDormir();
}

// Second passage d'une routine dans la journée : validé par le parent
// comme le premier, mais sans coffre ni nouvelle étoile.
function validerRoutineSansCoffre() {
  const idRoutine = routineActuelleId;
  const etat = chargerEtat();
  etat.routines[idRoutine].valide = true;
  marquerItemFait(etat, "routine", idRoutine);
  sauverEtat(etat);
  jouerSon();
  if (navigator.vibrate) navigator.vibrate([40, 60, 40]);
  routineActuelleId = null;
  construireMenu();
  dire("Bravo, c'est fait !");
}

// ---------------------------------------------------------------------
// Espace parent — hub protégé par le code, pour que les changements
// faits ici aient un effet direct sur ce que l'enfant voit (même état
// `cle("journee")`/`localStorage`, pas un outil séparé). Cf.
// docs/produit/concept.md pour la philosophie.
// ---------------------------------------------------------------------
function ouvrirEspaceParent() {
  ecranAvantValidation = document.querySelector(".screen.active").id;
  codeSaisi = "";
  modeCode = "verifier";
  document.getElementById("validation-sous-titre").textContent = "Un parent entre le code pour accéder à l'espace parent.";
  document.getElementById("correction-wrap").classList.add("hidden");
  document.getElementById("pavecode-wrap").classList.remove("hidden");
  document.getElementById("pavecode-erreur").textContent = "";
  construireClavier(document.getElementById("pavecode-clavier"), appuyerTouche);
  majCasesCode(document.getElementById("pavecode-cases"), codeSaisi);
  apresCodeValide = () => {
    construireEspaceParent();
    afficherEcran("screen-parent");
  };
  afficherEcran("screen-validation");
}

function construireEspaceParent() {
  const conteneur = document.getElementById("parent-contenu");
  conteneur.innerHTML = "";
  // Quatre blocs : ce qui se passe (la journée), ce qui existe (la
  // bibliothèque), ce qui s'est passé (le suivi), et l'appareil.
  const blocs = [
    {
      titre: "LA JOURNÉE",
      options: [
        {
          emoji: "🗓️", titre: "Planning",
          soustitre: "La semaine type, et les jours qui changent",
          action: () => { construireParentPlanningJournees(); afficherEcran("screen-parent-planning-journees"); },
        },
        {
          emoji: "🔁", titre: "Relancer une routine",
          soustitre: accorderPourEnfant("Si l'état de " + profilActif().prenom + " a changé (ex. il/elle s'est redéshabillé·e)"),
          action: () => { construireParentRoutines(); afficherEcran("screen-parent-routines"); },
        },
      ],
    },
    {
      titre: "LA BIBLIOTHÈQUE",
      options: [
        {
          emoji: "🗺️", titre: "Activités",
          soustitre: "Voir toutes les sorties, ou en créer une nouvelle",
          action: () => { construireParentActivites(); afficherEcran("screen-parent-activites"); },
        },
        {
          emoji: "🧩", titre: "Routines",
          soustitre: "Voir toutes les routines, ou en créer une nouvelle",
          action: () => { construireRoutinesCatalogue(); afficherEcran("screen-parent-routines-catalogue"); },
        },
        {
          emoji: "👪", titre: "Mon entourage",
          soustitre: "Voir qui entoure " + profilActif().prenom + ", ou ajouter une nouvelle personne",
          action: () => { construireParentEntourage(); afficherEcran("screen-parent-entourage"); },
        },
      ],
    },
    {
      titre: "LE SUIVI",
      options: [
        {
          emoji: "📅", titre: "Historique des journées",
          soustitre: "Revoir les jours précédents",
          action: () => { construireHistorique(); afficherEcran("screen-parent-historique"); },
        },
        {
          emoji: "🧑‍⚕️", titre: "Notes des séances",
          soustitre: "Relire les notes laissées par les praticiennes",
          action: () => { construireParentSeances(); afficherEcran("screen-parent-seances"); },
        },
      ],
    },
    {
      titre: "LES RÉCOMPENSES",
      options: [
        {
          emoji: "🪜", titre: "Chemin et récompenses",
          soustitre: aDonner().length
            ? "🎁 " + aDonner().length + (aDonner().length > 1 ? " récompenses à donner" : " récompense à donner")
            : "La jauge, le chemin de pièces et ses récompenses",
          action: () => { construireParentChemin(); afficherEcran("screen-parent-chemin"); },
        },
      ],
    },
    {
      titre: "RÉGLAGES",
      options: [
        {
          emoji: "🔑", titre: "Changer le code parent",
          soustitre: "Code à 4 chiffres, actuellement " + codeParentActuel().replace(/./g, "•"),
          action: () => { demarrerChangementCode(); },
        },
        {
          emoji: "📱", titre: "Cet appareil",
          soustitre: "Affiche " + profilActif().prenom + " — changer l'enfant de cet appareil",
          action: () => { construireParentAppareil(); afficherEcran("screen-parent-appareil"); },
        },
      ],
    },
  ];
  blocs.forEach(bloc => {
    const titre = document.createElement("div");
    titre.className = "groupe-journee-titre groupe-parent-titre";
    titre.textContent = bloc.titre;
    conteneur.appendChild(titre);
    bloc.options.forEach(o => {
      const carte = document.createElement("div");
      carte.className = "carte-routine carte-parent" + (o.action ? "" : " verrouillee");
      carte.innerHTML =
        `<div class="carte-routine-nom">${o.emoji} ${o.titre}<div class="carte-parent-soustitre">${o.soustitre}</div></div>`;
      if (o.action) carte.onclick = o.action;
      conteneur.appendChild(carte);
    });
  });
}

// ---------------------------------------------------------------------
// Chemin et récompenses (espace parent) : ce qui est à donner (une
// récompense atteinte sur le chemin attend qu'un parent coche « Je l'ai
// donnée », pour que les deux parents sachent toujours ce qui est dû), les
// réglages de la jauge et du chemin, et les récompenses elles-mêmes.
// ---------------------------------------------------------------------
function aDonner() {
  try { return chargerChemin().atteintes.filter(a => !a.donneeLe); } catch (e) { return []; }
}

// Petit point sur ⚙️ tant qu'une récompense attend d'être donnée.
function majBadgeEspaceParent() {
  try { document.getElementById("btn-espace-parent").classList.toggle("a-donner", aDonner().length > 0); } catch (e) {}
}

let recompenseEnEdition = null;
let brouillonRecompense = null;

function construireParentChemin() {
  const conteneur = document.getElementById("parent-chemin-contenu");
  conteneur.replaceChildren();
  const chemin = chargerChemin();
  const titre = (texte) => { const t = document.createElement("div"); t.className = "groupe-journee-titre groupe-parent-titre"; t.textContent = texte; conteneur.appendChild(t); };
  const ligne = (html) => { const l = document.createElement("div"); l.className = "carte-routine parent-chemin-ligne"; l.innerHTML = html; conteneur.appendChild(l); return l; };

  titre("À DONNER");
  const dus = chemin.atteintes.map((a, i) => ({ a, i })).filter(x => !x.a.donneeLe);
  if (!dus.length) { const v = document.createElement("div"); v.className = "recompenses-vide"; v.textContent = "Rien à donner pour l'instant."; conteneur.appendChild(v); }
  dus.forEach(({ a, i }) => {
    const l = ligne(`<div class="carte-routine-nom">${a.emoji} ${a.nom}<div class="carte-parent-soustitre">Gagnée le ${dateLisible(a.gagneeLe).toLowerCase()}</div></div>`);
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn-secondaire";
    b.textContent = "Je l'ai donnée ✓";
    b.onclick = () => { const c = chargerChemin(); c.atteintes[i].donneeLe = cleJour(); sauverChemin(c); majBadgeEspaceParent(); construireParentChemin(); };
    l.appendChild(b);
  });

  titre("LE CHEMIN");
  if (chemin.posees >= chemin.cases) {
    const l = ligne(`<div class="carte-routine-nom">🏁 Le chemin est terminé<div class="carte-parent-soustitre">Préparez le suivant : les pièces gagnées entre-temps l'attendent.</div></div>`);
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn-secondaire";
    b.textContent = "Nouveau chemin";
    b.onclick = () => {
      const c = chargerChemin();
      c.archives.push({ termineLe: cleJour(), cases: c.cases, recompenses: c.recompenses });
      c.posees = 0;
      sauverChemin(c);
      construireParentChemin();
    };
    l.appendChild(b);
  }
  conteneur.appendChild(compteurChemin("⭐ Étoiles pour une pièce", chemin.etoilesParPiece, 5, 40, changerEtoilesParPiece));
  conteneur.appendChild(compteurChemin("🪜 Cases sur le chemin", chemin.cases, Math.max(5, chemin.posees), 30, changerCasesChemin));

  const heure = ligne(`<div class="carte-routine-nom">☀️ Découverte des étoiles<div class="carte-parent-soustitre">Le matin, à partir de cette heure</div></div>`);
  const champHeure = document.createElement("input");
  champHeure.type = "time";
  champHeure.className = "input-heure-journee";
  champHeure.value = chemin.heureDecouverte;
  champHeure.onchange = () => { if (!champHeure.value) return; const c = chargerChemin(); c.heureDecouverte = champHeure.value; sauverChemin(c); construireParentChemin(); };
  heure.appendChild(champHeure);

  const sons = ligne(`<div class="carte-routine-nom">🔔 Sons de la jauge et des pièces</div>`);
  const grilleSons = document.createElement("div");
  grilleSons.className = "grille-entourage";
  construireChoixUnique(grilleSons, [["doux", "Doux"], ["arcade", "Arcade"], ["coupes", "Coupés"]], chemin.sons, v => {
    const c = chargerChemin(); c.sons = v; sauverChemin(c); construireParentChemin(); sonPiece();
  });
  sons.appendChild(grilleSons);

  const jauge = chargerJauge();
  const etat = chargerEtat();
  const aujourdhui = etoilesAMettreDeCote(etat);
  const parJour = Math.max(1, toutesLesRoutines().length);
  const est = estimationRythme(chemin, parJour);
  const info = document.createElement("div");
  info.className = "parent-chemin-info";
  info.innerHTML = `<div>Jauge : ⭐ ${jauge.dansLaJauge} / ${chemin.etoilesParPiece}`
    + (jauge.aDecouvrir ? ` · ${jauge.aDecouvrir} à découvrir dès ${chemin.heureDecouverte}` : "")
    + (aujourdhui ? ` · + ${aujourdhui} d'aujourd'hui, découvertes demain matin` : "") + `</div>`
    + `<div>Pièces à poser : ${chargerPiecesAPoser()} · posées : ${chemin.posees} / ${chemin.cases}</div>`
    + `<div>Avec ${parJour} étoiles par jour, les étoiles seules donnent environ une pièce tous les ${est.joursParPiece} jours : `
    + `le chemin prendrait environ ${est.semaines} semaine${est.semaines > 1 ? "s" : ""}, sans compter les pièces des sorties.</div>`
    + (est.tropLong ? `<div class="texte-erreur">C'est long : rapprochez les récompenses, ou réduisez le nombre de cases ou d'étoiles par pièce.</div>` : "");
  conteneur.appendChild(info);

  titre("LES RÉCOMPENSES");
  chemin.recompenses.forEach((r, i) => {
    if (recompenseEnEdition === i) { conteneur.appendChild(formulaireRecompense(chemin)); return; }
    const l = ligne(`<div class="carte-routine-nom">${r.case === chemin.cases ? "Au bout" : "Case " + r.case} · ${r.emoji} ${r.nom}</div>`);
    const droite = document.createElement("div");
    droite.className = "carte-routine-droite";
    const modifier = document.createElement("button");
    modifier.type = "button"; modifier.className = "btn-mini-edition"; modifier.textContent = "✏️";
    modifier.setAttribute("aria-label", "Modifier « " + r.nom + " »");
    modifier.onclick = () => { recompenseEnEdition = i; brouillonRecompense = Object.assign({}, r); construireParentChemin(); };
    const retirer = document.createElement("button");
    retirer.type = "button"; retirer.className = "btn-mini-edition btn-retirer"; retirer.textContent = "✕";
    retirer.setAttribute("aria-label", "Retirer « " + r.nom + " »");
    retirer.onclick = () => { const c = chargerChemin(); c.recompenses.splice(i, 1); sauverChemin(c); construireParentChemin(); };
    droite.append(modifier, retirer);
    l.appendChild(droite);
  });
  if (recompenseEnEdition === "nouvelle") conteneur.appendChild(formulaireRecompense(chemin));
  else {
    const ajouter = document.createElement("button");
    ajouter.type = "button";
    ajouter.className = "btn-secondaire";
    ajouter.textContent = "+ Ajouter une récompense";
    ajouter.onclick = () => {
      const libre = [...Array(chemin.cases).keys()].map(k => k + 1).reverse().find(n => !recompenseDeLaCase(chemin, n)) || chemin.cases;
      recompenseEnEdition = "nouvelle";
      brouillonRecompense = { case: libre, emoji: "🎁", nom: "" };
      construireParentChemin();
    };
    conteneur.appendChild(ajouter);
  }
}

function compteurChemin(libelle, valeur, min, max, changer) {
  const l = document.createElement("div");
  l.className = "carte-routine parent-chemin-ligne";
  l.innerHTML = `<div class="carte-routine-nom">${libelle}</div>`;
  const c = document.createElement("div");
  c.className = "compteur-chemin";
  const moins = document.createElement("button");
  moins.type = "button"; moins.className = "btn-mini-edition"; moins.textContent = "−"; moins.disabled = valeur <= min;
  moins.onclick = () => changer(valeur - 1);
  const v = document.createElement("span");
  v.className = "compteur-valeur"; v.textContent = valeur;
  const plus = document.createElement("button");
  plus.type = "button"; plus.className = "btn-mini-edition"; plus.textContent = "+"; plus.disabled = valeur >= max;
  plus.onclick = () => changer(valeur + 1);
  c.append(moins, v, plus);
  l.appendChild(c);
  return l;
}

// Baisser le seuil sous ce qui est déjà dans la jauge donne la pièce tout
// de suite, sans perdre d'étoile (cf. verserEtoiles()).
function changerEtoilesParPiece(n) {
  const c = chargerChemin();
  c.etoilesParPiece = n;
  sauverChemin(c);
  const j = chargerJauge();
  const r = verserEtoiles(j.dansLaJauge, 0, n);
  if (r.pieces) { sauverJauge({ dansLaJauge: r.dansLaJauge, aDecouvrir: j.aDecouvrir }); ajouterPieces(r.pieces); }
  construireParentChemin();
}

// Moins de cases : la récompense finale suit la dernière case ; celles qui
// tomberaient hors du chemin sont retirées.
function changerCasesChemin(n) {
  const c = chargerChemin();
  const hors = c.recompenses.filter(r => r.case > n);
  c.recompenses = c.recompenses.filter(r => r.case <= n);
  if (hors.length && !c.recompenses.some(r => r.case === n)) {
    const derniere = hors[hors.length - 1];
    c.recompenses.push(Object.assign({}, derniere, { case: n }));
  }
  c.cases = n;
  sauverChemin(c);
  construireParentChemin();
}

function formulaireRecompense(chemin) {
  const f = document.createElement("div");
  f.className = "ajout-en-ligne";
  const b = brouillonRecompense;
  f.innerHTML = `<label class="champ-parent"><span>Case (1 à ${chemin.cases}, ${chemin.cases} = au bout du chemin)</span>`
    + `<input type="number" id="recompense-case" min="1" max="${chemin.cases}" value="${b.case}"></label>`
    + `<div class="champ-parent"><span>Icône</span><button type="button" class="emoji-trigger" id="recompense-emoji">${b.emoji}</button></div>`
    + `<label class="champ-parent"><span>La récompense, telle qu'elle sera dite (« Tu as gagné : … »)</span>`
    + `<input type="text" id="recompense-nom" maxlength="40" placeholder="Ex : choisir le dessert"></label>`
    + `<div class="texte-erreur" id="recompense-erreur"></div>`;
  f.querySelector("#recompense-nom").value = b.nom;
  f.querySelector("#recompense-emoji").onclick = () => {
    b.nom = f.querySelector("#recompense-nom").value;
    b.case = Number(f.querySelector("#recompense-case").value) || b.case;
    ouvrirSelecteurEmoji(["🍦", "🛝", "🎬", "🎁", "🧱", "🍕", "🎮", "📚", "🚲", "🏊", "🎨", "🍫"], b.emoji, (e) => { b.emoji = e; fermerSelecteurEmoji(); construireParentChemin(); });
  };
  const actions = document.createElement("div");
  actions.className = "creer-depuis-planning";
  const annuler = document.createElement("button");
  annuler.type = "button"; annuler.className = "btn-secondaire"; annuler.textContent = "Annuler";
  annuler.onclick = () => { recompenseEnEdition = null; brouillonRecompense = null; construireParentChemin(); };
  const enregistrer = document.createElement("button");
  enregistrer.type = "button"; enregistrer.className = "btn-secondaire"; enregistrer.textContent = "Enregistrer";
  enregistrer.onclick = () => {
    const n = Math.round(Number(f.querySelector("#recompense-case").value));
    const nom = f.querySelector("#recompense-nom").value.trim();
    const c = chargerChemin();
    const autres = c.recompenses.filter((r, i) => i !== recompenseEnEdition);
    if (!nom) { f.querySelector("#recompense-erreur").textContent = "Écris la récompense."; return; }
    if (!(n >= 1 && n <= c.cases)) { f.querySelector("#recompense-erreur").textContent = "Choisis une case entre 1 et " + c.cases + "."; return; }
    if (autres.some(r => r.case === n)) { f.querySelector("#recompense-erreur").textContent = "Il y a déjà une récompense sur cette case."; return; }
    if (n <= c.posees) { f.querySelector("#recompense-erreur").textContent = "Cette case est déjà dépassée sur le chemin."; return; }
    c.recompenses = autres.concat([{ case: n, emoji: b.emoji, nom }]);
    sauverChemin(normaliserChemin(c));
    recompenseEnEdition = null;
    brouillonRecompense = null;
    construireParentChemin();
  };
  actions.append(annuler, enregistrer);
  f.appendChild(actions);
  return f;
}

// "Cet appareil" : quel profil (tousLesProfils()) cet appareil affiche —
// PAS un sélecteur destiné à l'enfant (cf. profilActifId() plus haut, et
// le TODO "gestion des profils" qui a motivé cet écran) : chaque enfant a
// sa propre tablette. Sert à configurer un appareil une bonne fois pour
// toutes (au lieu de mémoriser la syntaxe `?enfant=...` dans l'URL), ou à
// en réattribuer un (remplacement, ajout d'un 2ᵉ enfant plus tard — il suffira d'une
// nouvelle entrée dans PROFILS pour qu'elle apparaisse ici automatiquement).
function construireParentAppareil() {
  const actif = profilActifId();
  const liste = document.getElementById("parent-appareil-liste");
  liste.innerHTML = "";
  Object.values(tousLesProfils()).forEach(p => {
    const carte = document.createElement("div");
    carte.className = "carte-routine" + (p.id === actif ? " faite" : "");
    carte.innerHTML = `<div class="carte-routine-nom">${p.prenom}</div><div class="carte-routine-etat">${p.id === actif ? "✓ actif" : ""}</div>`;
    if (p.id !== actif) carte.onclick = () => changerProfilAppareil(p.id);
    liste.appendChild(carte);
  });
}

// Rejoue le même accueil que le tout premier lancement (cf.
// ouvrirAccueil()) puis le même écran/formulaire de configuration (cf.
// ouvrirPremiereConfiguration()) — seul `estAjout` change, pour afficher
// un bouton retour sur ce dernier puisqu'il y a ici un espace parent où
// revenir. Le nouvel enfant découvre ainsi l'acolyte lui-même, plutôt que
// d'arriver directement sur le formulaire rempli par le parent.
function ouvrirNouveauProfilDepuisAppareil() {
  ouvrirAccueil(true);
}

// Change le profil de CET appareil (pas juste la session en cours) puis
// recharge : à peu près tout l'état affiché (routines, avatar, étoiles,
// jauge...) est déterminé au chargement via `profilActif()`, un
// rechargement est donc plus sûr qu'essayer de tout re-synchroniser à la
// main depuis ce seul écran.
function changerProfilAppareil(id) {
  try { localStorage.setItem("acolyte_enfant", id); } catch (e) {}
  location.reload();
}

// Exporte tout le localStorage de cet appareil (profils, routines,
// historique, code parent...) en JSON téléchargeable. localStorage est
// isolé par origine : un changement d'URL (ex. nouveau compte GitHub
// Pages, nouvelle tablette) n'y a plus accès sans ce transfert manuel.
// Cf. importerDonneesAppareil() et screen-restaurer (?restaurer=1).
function exporterDonneesAppareil() {
  const donnees = {};
  for (let i = 0; i < localStorage.length; i++) {
    const cle = localStorage.key(i);
    donnees[cle] = localStorage.getItem(cle);
  }
  const blob = new Blob([JSON.stringify(donnees, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = "acolyte-sauvegarde-" + new Date().toISOString().slice(0, 10) + ".json";
  lien.click();
  URL.revokeObjectURL(url);
}

// Écrase le localStorage de cet appareil avec le contenu d'un fichier
// exporté par exporterDonneesAppareil(), puis recharge sur l'URL sans
// `?restaurer=1` pour retomber sur le boot normal (cf. demarrer()).
function importerDonneesAppareil(fichier) {
  const lecteur = new FileReader();
  lecteur.onload = () => {
    let donnees;
    try { donnees = JSON.parse(lecteur.result); } catch (e) { alert("Fichier invalide."); return; }
    if (!confirm("Remplacer les données actuelles de cet appareil par celles de ce fichier ?")) return;
    Object.entries(donnees).forEach(([cle, valeur]) => { try { localStorage.setItem(cle, valeur); } catch (e) {} });
    location.href = location.pathname;
  };
  lecteur.readAsText(fichier);
}

// Liste des routines avec leur état, pour choisir laquelle relancer.
// Toutes affichées (pas seulement les validées) : un parent peut aussi
// vouloir corriger une routine en cours sans attendre la fin.
function construireParentRoutines() {
  const etat = chargerEtat();
  document.getElementById("parent-routines-intro").textContent =
    accorderPourEnfant("Si l'état de " + profilActif().prenom + " a changé (ex. il/elle s'est redéshabillé·e), choisis la routine à relancer.");
  const liste = document.getElementById("parent-routines-liste");
  liste.innerHTML = "";
  toutesLesRoutines().forEach(r => {
    const etatR = etat.routines[r.id];
    const etatTexte = etatR.valide
      ? "✓ validée"
      : (etatR.fait.length > 0 ? etatR.fait.length + "/" + r.taches.length : "pas commencée");
    const carte = document.createElement("div");
    carte.className = "carte-routine";
    carte.innerHTML = `<div class="carte-routine-nom">${r.emoji} ${r.nom}</div><div class="carte-routine-etat">${etatTexte}</div>`;
    carte.onclick = () => relancerRoutine(r.id);
    liste.appendChild(carte);
  });
}

// Réutilise l'écran/la liste de correction déjà construits pour la
// validation parent (mêmes éléments DOM), mais sans redemander le code
// (déjà dans l'espace parent authentifié) et avec une action différente
// à la confirmation (cf. confirmerRelanceRoutine, pas de nouvelle étoile).
function relancerRoutine(id) {
  routineActuelleId = id;
  const routine = routineParId(id);
  document.getElementById("validation-sous-titre").textContent = "Relancer « " + routine.nom + " ».";
  document.getElementById("pavecode-wrap").classList.add("hidden");
  document.getElementById("correction-note").textContent = "Décoche ce qui n'est plus vrai, puis mets à jour.";
  document.getElementById("btn-valider-routine").textContent = "Mettre à jour";
  actionCorrection = confirmerRelanceRoutine;
  construireCorrection();
  document.getElementById("correction-wrap").classList.remove("hidden");
  afficherEcran("screen-validation");
}

// Une étoile n'est jamais reprise : relancer une routine validée dont des
// tâches ont été décochées la rend juste à refaire — son dernier passage
// redevient à faire dans la liste du jour, l'étoile reste acquise (et le
// nouveau passage n'en redonne pas, cf. validerRoutineSansCoffre()).
// `journeeFaite` et le verrou de sommeil (`cle("reveil")`, cf. `endormir`)
// ne repassent à faux que si c'est "Aller se coucher" qu'on rouvre — cf.
// construireMenu() : c'est la seule routine qui conditionne la journée
// "finie".
function confirmerRelanceRoutine() {
  const etat = chargerEtat();
  const etatR = etat.routines[routineActuelleId];
  const routine = routineParId(routineActuelleId);
  const toutFait = routine.taches.every(t => etatR.fait.includes(t.id));
  if (etatR.valide && !toutFait) {
    etatR.valide = false;
    for (let i = etat.planning.length - 1; i >= 0; i--) {
      const it = etat.planning[i];
      if (it.type === "routine" && it.id === routineActuelleId && it.fait) { delete it.fait; break; }
    }
    if (routineActuelleId === "soir") {
      etat.journeeFaite = false;
      try { localStorage.removeItem(cle("reveil")); } catch (e) {}
    }
  }
  sauverEtat(etat);
  synchroniserAvatar(etat);
  jouerSon();
  if (navigator.vibrate) navigator.vibrate([40, 60, 40]);
  routineActuelleId = null;
  construireParentRoutines();
  afficherEcran("screen-parent-routines");
}

function construireHistorique() {
  const conteneur = document.getElementById("parent-historique-liste");
  conteneur.innerHTML = "";
  let historique = [];
  try { historique = JSON.parse(localStorage.getItem(cle("historique")) || "[]"); } catch (e) {}
  if (historique.length === 0) {
    const vide = document.createElement("div");
    vide.className = "recompenses-vide";
    vide.textContent = "Pas encore de journée archivée.";
    conteneur.appendChild(vide);
    return;
  }
  historique.slice().reverse().forEach(j => {
    const noms = j.routinesValidees.map(id => { const r = routineParId(id); return r ? r.nom : id; });
    const resume = noms.length > 0 ? noms.join(", ") : "aucune routine validée";
    const ligne = document.createElement("div");
    ligne.className = "ligne-journee";
    ligne.innerHTML =
      `<span class="emoji-journee">📅</span>` +
      `<span class="texte-journee">` +
        `<span>${j.jour} — ${j.etoiles} ⭐ — ${resume}</span>` +
        texteReveilHistorique(j.reveil) +
        texteSeancesHistorique(j.seances) +
      `</span>`;
    conteneur.appendChild(ligne);
  });
}

// Ligne secondaire "réveil" (bien dormi / humeur, cf. finReveil) sous une
// journée archivée. Chaîne vide (donc rien affiché) pour les journées
// d'avant cette fonctionnalité (pas de `reveil` dans l'archive, cf.
// archiverJournee) ou si le rituel n'a jamais été fait ce jour-là (les
// deux réponses restent à `null`) — pas de placeholder "pas de données"
// pour ne pas alourdir une liste qui peut compter jusqu'à 90 entrées.
function texteReveilHistorique(reveil) {
  if (!reveil || (reveil.bienDormi === null && !reveil.humeur)) return "";
  const parts = [];
  if (reveil.bienDormi !== null) parts.push(reveil.bienDormi ? "😊 A bien dormi" : "😞 N'a pas bien dormi");
  const h = reveil.humeur && EMOJI_HUMEUR.find(e => e.id === reveil.humeur);
  if (h) parts.push(h.emoji + " " + accorderPourEnfant(h.texte));
  return parts.length ? `<span class="texte-journee-reveil">${parts.join(" · ")}</span>` : "";
}

// Notes de séance (praticienne, cf. validerSeance()) sous une journée
// archivée — réservées à cette vue parent, jamais affichées à l'enfant
// (cf. commentaire dans archiverJournee()). Une ligne par séance ce
// jour-là (note en étoiles + appréciation si renseignée) ; chaîne vide
// pour les journées sans séance ou d'avant cette fonctionnalité (pas de
// `seances` dans l'archive).
function texteSeancesHistorique(seances) {
  if (!Array.isArray(seances) || seances.length === 0) return "";
  return seances.map(s => {
    const qui = s.personne ? "Chez " + s.personne : s.lieu;
    const etoiles = "⭐".repeat(s.note || 0);
    const appreciation = s.appreciation ? " — " + s.appreciation : "";
    return `<span class="texte-journee-reveil">🧑‍⚕️ ${qui} : ${etoiles}${appreciation}</span>`;
  }).join("");
}

// Vue dédiée aux notes de séance, accessible directement depuis le menu
// parent plutôt que noyées jour par jour dans l'Historique (cf.
// texteSeancesHistorique() ci-dessus, toujours utilisée là-bas) — plus
// rapide à relire quand on veut juste suivre le retour des praticiennes.
// Reprend les séances du jour en cours (etat.seances, pas encore
// archivées) puis celles déjà archivées, de la plus récente à la plus
// ancienne. Jamais accessible à l'enfant, comme texteSeancesHistorique().
function construireParentSeances() {
  const conteneur = document.getElementById("parent-seances-liste");
  conteneur.innerHTML = "";
  const etat = chargerEtat();
  let historique = [];
  try { historique = JSON.parse(localStorage.getItem(cle("historique")) || "[]"); } catch (e) {}
  const lignes = (etat.seances || []).map(s => ({ jour: etat.jour, seance: s }));
  historique.slice().reverse().forEach(j => {
    (j.seances || []).forEach(s => lignes.push({ jour: j.jour, seance: s }));
  });
  if (lignes.length === 0) {
    const vide = document.createElement("div");
    vide.className = "recompenses-vide";
    vide.textContent = "Pas encore de séance notée.";
    conteneur.appendChild(vide);
    return;
  }
  lignes.forEach(({ jour, seance: s }) => {
    const qui = s.personne ? "Chez " + s.personne : s.lieu;
    const etoiles = "⭐".repeat(s.note || 0);
    const ligne = document.createElement("div");
    ligne.className = "ligne-journee";
    ligne.innerHTML =
      `<span class="emoji-journee">🧑‍⚕️</span>` +
      `<span class="texte-journee">` +
        `<span>${jour} — ${qui} — ${etoiles}</span>` +
        (s.appreciation ? `<span class="texte-journee-reveil">${s.appreciation}</span>` : "") +
      `</span>`;
    conteneur.appendChild(ligne);
  });
}

// Deux saisies identiques de suite avant d'enregistrer (cf. `validerCode()`,
// branche "nouveau1"/"nouveau2") — réutilise le même pavé que la
// vérification du code existant, pas de nouvel écran.
function demarrerChangementCode() {
  ecranAvantValidation = document.querySelector(".screen.active").id;
  codeSaisi = "";
  modeCode = "nouveau1";
  premierNouveauCode = "";
  document.getElementById("validation-sous-titre").textContent = "Entre le nouveau code à 4 chiffres.";
  document.getElementById("correction-wrap").classList.add("hidden");
  document.getElementById("pavecode-wrap").classList.remove("hidden");
  document.getElementById("pavecode-erreur").textContent = "";
  construireClavier(document.getElementById("pavecode-clavier"), appuyerTouche);
  majCasesCode(document.getElementById("pavecode-cases"), codeSaisi);
  afficherEcran("screen-validation");
}

// Liste de toutes les activités (catalogue en dur + créées par un
// parent) — accès + création, cf. carte "Activités" du hub. Simple
// catalogue à consulter/éditer : programmer une activité pour un jour
// (aujourd'hui ou à venir) se fait depuis "Planning" (cf.
// construireParentPlanningJournees()) — rien ici à sélectionner ni à
// mettre en surbrillance, une carte ne fait qu'ouvrir son édition.
function construireParentActivites() {
  const liste = document.getElementById("parent-activites-liste");
  liste.innerHTML = "";
  toutesLesAventures().forEach(a => {
    const carte = document.createElement("div");
    carte.className = "carte-routine";
    const nom = document.createElement("div");
    nom.className = "carte-routine-nom";
    nom.textContent = a.emoji + " " + a.lieu;
    const btnEditer = document.createElement("button");
    btnEditer.type = "button";
    btnEditer.className = "btn-mini-edition";
    btnEditer.textContent = "✏️";
    btnEditer.setAttribute("aria-label", "Modifier « " + a.lieu + " »");
    btnEditer.onclick = () => ouvrirEditionAventure(a.id);
    carte.append(nom, btnEditer);
    liste.appendChild(carte);
  });
}

// Nouvelle activité : formulaire minimal. Une nouvelle aventure n'a ni
// `personne` ni `date` fixe : elle est ajoutée directement au planning
// du jour à la création (voir `creerNouvelleAventure()`), c'est ça qui
// la rend accessible dans "Partir à l'aventure" plutôt qu'un champ date
// à remplir.
// EMOJI_ACTIVITE/ROUTINE/PERSONNE (plus bas) restent les "favoris"
// montrés par défaut, sans recherche, à l'ouverture du sélecteur partagé
// (cf. ouvrirSelecteurEmoji plus bas, EMOJI_CATALOGUE pour la recherche
// complète) — inchangés, juste plus le seul choix possible (demandé
// explicitement : "la liste existante ne permet pas de tout traiter").
const EMOJI_ACTIVITE = ["🏊","🚲","🎨","🎪","🍕","🌳","⚽","🎬","🏥","🛒","🎵","🧩","🎡","🐶","🎳","🍦"];
let emojiChoisiActivite = EMOJI_ACTIVITE[0];

// Bouton "icône actuelle", commun aux 3 formulaires (activité/routine/
// personne) — remplace l'ancienne grille fixe affichée en permanence :
// un tap ouvre le sélecteur partagé recherchable (cf.
// ouvrirSelecteurEmoji plus bas).
function construireDeclencheurEmoji(idBouton, emoji) {
  document.getElementById(idBouton).textContent = emoji;
}

// Choix de l'entourage ("qui est là ?"), partagé par les formulaires
// nouvelle activité ET nouvelle routine — l'appelant possède le tableau
// `choisis` et reconstruit après chaque clic (même principe que le
// sélecteur d'emoji, cf. ouvrirSelecteurEmoji), mais à choix multiple
// (chips togglables, jamais fermé) plutôt qu'un choix unique qui ferme
// l'écran. N'affiche rien si le catalogue est vide plutôt qu'une grille
// vide déroutante — c'est au parent de créer d'abord une personne dans
// "Mon entourage" s'il veut s'en servir ici.
function construireChoixEntourage(conteneur, choisis) {
  conteneur.innerHTML = "";
  toutesLesPersonnes().forEach(p => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip-entourage" + (choisis.includes(p.id) ? " choisi" : "");
    b.textContent = p.emoji + " " + p.nom;
    b.onclick = () => {
      const pos = choisis.indexOf(p.id);
      if (pos === -1) choisis.push(p.id); else choisis.splice(pos, 1);
      construireChoixEntourage(conteneur, choisis);
    };
    conteneur.appendChild(b);
  });
}

let entourageChoisiActivite = [];
// `null` = formulaire en mode création (cf. ouvrirNouvelleAventure) ;
// sinon id de l'activité en cours de modification (cf.
// ouvrirEditionAventure) — même écran, mêmes champs, seule la branche
// finale de creerNouvelleAventure() change (mise à jour en place plutôt
// que nouvelle entrée).
let aventureEnEditionId = null;
// "sortie" | "seance" | "maison" — une séance est une aventure qui porte
// `personne` (cf. terminerVisite()) : le formulaire demande alors avec qui ;
// une activité à la maison (`nature: "maison"`) n'a ni trajet ni étapes,
// mais un endroit, une phrase et un minuteur facultatif.
let natureFormulaireActivite = "sortie";
const NATURES_ACTIVITE = [["sortie", "🚗 Sortie"], ["maison", "🏠 À la maison"], ["seance", "🧑‍⚕️ Séance"]];
const ENDROITS = { chambre: "🛏️ Chambre", salon: "🛋️ Salon", cuisine: "🍳 Cuisine" };
const MINUTEURS_MAISON = [0, 10, 20, 30];
const ETAPES_SEANCE = ["On dit bonjour", "On fait la séance", "On dit au revoir"];
const EMOJI_MAISON_DEFAUT = "📖";
let endroitChoisi = "salon";
let minuteurChoisi = 0;
// Sortie et séance : comment on y va (absent sur une activité = voiture).
const TRANSPORTS = [["voiture", "🚗 Voiture"], ["velo", "🚲 Vélo"], ["pied", "🚶 À pied"]];
const PICTO_TRANSPORT = { velo: "🚲", pied: "🚶" };
let transportChoisi = "voiture";
function texteTrajetSuggere(transport, nom) {
  if (transport === "velo") return contracterA("On pédale jusqu'à " + nom + ".");
  if (transport === "pied") return contracterA("On marche jusqu'à " + nom + ".");
  return "On roule vers " + nom + ".";
}
// « à le parc » → « au parc », « à les » → « aux » (noms tapés par un parent).
function contracterA(texte) {
  return texte.replace(/(^|[\s'])à le /gi, "$1au ").replace(/(^|[\s'])à les /gi, "$1aux ");
}
// Formulaire ouvert depuis l'éditeur de journée (cf. construireAjoutPlanning())
// plutôt que depuis la bibliothèque : l'activité créée est ajoutée au jour
// édité, et ← comme la création ramènent à ce jour.
let formulaireDepuisPlanning = false;
// Personne de l'entourage choisie pour une séance (choix unique), ou `null`.
let personneSeanceId = null;

// Choix unique, contrairement à construireChoixEntourage() (choix multiple).
function construireChoixPersonneSeance() {
  const grille = document.getElementById("na-seance-grille");
  grille.innerHTML = "";
  const personnes = toutesLesPersonnes();
  if (!personnes.length) {
    const vide = document.createElement("div");
    vide.className = "recompenses-vide";
    vide.textContent = "Ajoute d'abord la personne dans « Mon entourage ».";
    grille.appendChild(vide);
    return;
  }
  personnes.forEach(p => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip-entourage" + (p.id === personneSeanceId ? " choisi" : "");
    b.textContent = p.emoji + " " + p.nom;
    b.onclick = () => { personneSeanceId = p.id; construireChoixPersonneSeance(); };
    grille.appendChild(b);
  });
}

// La nature se choisit à la création ; en modification, elle est fixée.
// Chaque nature ne montre que ses champs.
function afficherNatureFormulaireActivite() {
  const nature = natureFormulaireActivite;
  document.getElementById("na-nature-bloc").classList.toggle("hidden", !!aventureEnEditionId);
  construireChoixUnique(document.getElementById("na-nature-grille"), NATURES_ACTIVITE, nature, choisirNatureFormulaire);
  document.getElementById("na-seance-bloc").classList.toggle("hidden", nature !== "seance");
  document.getElementById("na-sortie-bloc").classList.toggle("hidden", nature === "maison");
  document.getElementById("na-maison-bloc").classList.toggle("hidden", nature !== "maison");
  document.getElementById("na-nom").placeholder = nature === "maison" ? "Ex : Lecture" : "Ex : La piscine";
  if (nature !== "maison") {
    construireChoixUnique(document.getElementById("na-transport-grille"), TRANSPORTS, transportChoisi, choisirTransport);
  }
  if (nature === "seance") construireChoixPersonneSeance();
  if (nature === "maison") {
    construireChoixUnique(document.getElementById("na-endroit-grille"), Object.entries(ENDROITS), endroitChoisi,
      v => { endroitChoisi = v; afficherNatureFormulaireActivite(); });
    construireChoixUnique(document.getElementById("na-minuteur-grille"), MINUTEURS_MAISON.map(m => [m, m ? m + " min" : "Aucun"]), minuteurChoisi,
      v => { minuteurChoisi = v; afficherNatureFormulaireActivite(); });
  }
  if (!aventureEnEditionId) {
    document.getElementById("nouvelle-aventure-titre").textContent =
      nature === "seance" ? "Nouvelle séance" : nature === "maison" ? "Nouvelle activité à la maison" : "Nouvelle sortie";
  }
}

// Puces à choix unique (`options` : [valeur, texte]), même style que
// l'entourage.
function construireChoixUnique(grille, options, valeur, choisir) {
  grille.innerHTML = "";
  options.forEach(([v, texte]) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip-entourage" + (v === valeur ? " choisi" : "");
    b.textContent = texte;
    b.onclick = () => choisir(v);
    grille.appendChild(b);
  });
}

// Le texte du trajet suit le mode de transport tant que le parent ne l'a
// pas réécrit (il vaut encore la suggestion de l'ancien mode).
function choisirTransport(transport) {
  const nom = document.getElementById("na-nom").value.trim();
  const trajet = document.getElementById("na-trajet");
  if (nom && trajet.value.trim() === texteTrajetSuggere(transportChoisi, nom)) trajet.value = texteTrajetSuggere(transport, nom);
  transportChoisi = transport;
  afficherNatureFormulaireActivite();
}

function choisirNatureFormulaire(nature) {
  natureFormulaireActivite = nature;
  appliquerDefautsNature();
  afficherNatureFormulaireActivite();
}

// Valeurs par défaut d'une nature, en création : étapes d'une séance
// (sans écraser des étapes déjà tapées), pièce pour une sortie seulement.
function appliquerDefautsNature() {
  const champs = ["na-etape1", "na-etape2", "na-etape3"].map(id => document.getElementById(id));
  const valeurs = champs.map(c => c.value.trim());
  const vides = valeurs.every(v => !v);
  const defautsSeance = valeurs.every((v, i) => v === ETAPES_SEANCE[i]);
  if (natureFormulaireActivite === "seance" && vides) champs.forEach((c, i) => { c.value = ETAPES_SEANCE[i]; });
  if (natureFormulaireActivite !== "seance" && defautsSeance) champs.forEach(c => { c.value = ""; });
  document.getElementById("na-piece").checked = natureFormulaireActivite === "sortie";
  // Icône par défaut de la nature, tant que le parent n'en a pas choisi une.
  if (emojiChoisiActivite === EMOJI_ACTIVITE[0] || emojiChoisiActivite === EMOJI_MAISON_DEFAUT) {
    emojiChoisiActivite = natureFormulaireActivite === "maison" ? EMOJI_MAISON_DEFAUT : EMOJI_ACTIVITE[0];
  }
  construireDeclencheurEmoji("na-emoji-trigger", emojiChoisiActivite);
}

function ouvrirNouvelleAventure(options = {}) {
  aventureEnEditionId = null;
  natureFormulaireActivite = options.nature || "sortie";
  formulaireDepuisPlanning = !!options.depuisPlanning;
  personneSeanceId = null;
  endroitChoisi = "salon";
  minuteurChoisi = 0;
  transportChoisi = "voiture";
  document.getElementById("btn-creer-aventure").textContent = "Créer l'activité";
  ["na-nom", "na-trajet", "na-arrivee", "na-etape1", "na-etape2", "na-etape3", "na-mots-cles", "na-consigne"]
    .forEach(id => { document.getElementById(id).value = ""; });
  emojiChoisiActivite = EMOJI_ACTIVITE[0];
  appliquerDefautsNature();
  document.getElementById("na-erreur").textContent = "";
  entourageChoisiActivite = [];
  construireChoixEntourage(document.getElementById("na-entourage-grille"), entourageChoisiActivite);
  afficherNatureFormulaireActivite();
  afficherEcran("screen-parent-nouvelle-aventure");
}

// Sortie du formulaire (création, modification ou ←) : vers le jour édité
// s'il a été ouvert depuis le planning, sinon vers la bibliothèque.
function quitterFormulaireActivite() {
  aventureEnEditionId = null;
  if (formulaireDepuisPlanning) {
    formulaireDepuisPlanning = false;
    journeeEnEdition = true;
    construireJournee();
    afficherEcran("screen-journee");
    return;
  }
  construireParentActivites();
  afficherEcran("screen-parent-activites");
}

// Retire le préfixe numérique ("1. ", "2. "...) ajouté par
// creerNouvelleAventure() pour reconstruire les 3 champs d'étape
// individuels à l'ouverture de l'édition — cf. `a.programme`.
function sansNumeroEtape(ligne) {
  return (ligne || "").replace(/^\d+\.\s*/, "");
}

// Pré-remplit le formulaire (partagé avec la création) avec l'activité
// existante — codée en dur ou déjà perso, peu importe (cf.
// toutesLesAventures()) — puis bascule creerNouvelleAventure() en mode
// mise à jour via `aventureEnEditionId`.
function ouvrirEditionAventure(id) {
  const a = aventureParId(id);
  if (!a) return;
  aventureEnEditionId = id;
  formulaireDepuisPlanning = false;
  natureFormulaireActivite = a.nature === "maison" ? "maison" : a.personne ? "seance" : "sortie";
  // Retrouvée par son nom : `personne` ne garde que { emoji, nom }. Une
  // praticienne absente de l'entourage n'est simplement pas présélectionnée
  // — sa `personne` est conservée telle quelle (cf. creerNouvelleAventure()).
  const personneConnue = a.personne && toutesLesPersonnes().find(p => p.nom === a.personne.nom);
  personneSeanceId = personneConnue ? personneConnue.id : null;
  document.getElementById("nouvelle-aventure-titre").textContent = "Modifier l'activité";
  document.getElementById("btn-creer-aventure").textContent = "Enregistrer les modifications";
  document.getElementById("na-nom").value = a.lieu;
  // Une activité à la maison n'a ni trajet ni programme (et inversement).
  const programme = a.programme || [];
  document.getElementById("na-trajet").value = a.texteTrajet || "";
  document.getElementById("na-arrivee").value = a.texteArrivee || "";
  document.getElementById("na-etape1").value = sansNumeroEtape(programme[0]);
  document.getElementById("na-etape2").value = sansNumeroEtape(programme[1]);
  document.getElementById("na-etape3").value = sansNumeroEtape(programme[2]);
  document.getElementById("na-consigne").value = a.consigne || "";
  endroitChoisi = a.endroit || "salon";
  minuteurChoisi = a.minuteurMinutes || 0;
  transportChoisi = a.modeTransport || "voiture";
  document.getElementById("na-piece").checked = a.recompensePieces > 0;
  document.getElementById("na-mots-cles").value = (a.motsCles || []).join(", ");
  document.getElementById("na-erreur").textContent = "";
  emojiChoisiActivite = a.emoji;
  construireDeclencheurEmoji("na-emoji-trigger", emojiChoisiActivite);
  entourageChoisiActivite = a.entourageIds ? [...a.entourageIds] : [];
  construireChoixEntourage(document.getElementById("na-entourage-grille"), entourageChoisiActivite);
  afficherNatureFormulaireActivite();
  afficherEcran("screen-parent-nouvelle-aventure");
}

// Pré-remplit trajet/arrivée à partir du nom dès qu'il quitte le champ —
// simple suggestion (grammaire pas garantie, ex. "à le" au lieu de "au"),
// jamais écrasée si le parent a déjà tapé quelque chose dans ces champs.
function suggererTextesActivite() {
  const nom = document.getElementById("na-nom").value.trim();
  if (!nom) return;
  const trajetEl = document.getElementById("na-trajet");
  const arriveeEl = document.getElementById("na-arrivee");
  if (!trajetEl.value.trim()) trajetEl.value = texteTrajetSuggere(transportChoisi, nom);
  if (!arriveeEl.value.trim()) arriveeEl.value = contracterA("On est arrivés à " + nom + ".");
}

function creerNouvelleAventure() {
  const nom = document.getElementById("na-nom").value.trim();
  const texteTrajet = document.getElementById("na-trajet").value.trim();
  const texteArrivee = document.getElementById("na-arrivee").value.trim();
  const e1 = document.getElementById("na-etape1").value.trim();
  const e2 = document.getElementById("na-etape2").value.trim();
  const e3 = document.getElementById("na-etape3").value.trim();
  const pieceOui = document.getElementById("na-piece").checked;
  const personneSeance = toutesLesPersonnes().find(p => p.id === personneSeanceId) || null;

  // Création d'une séance : une personne est obligatoire (c'est elle qui
  // bascule l'arrivée vers l'écran de séance). En modification, une
  // séance sans personne rechoisie garde la sienne.
  if (natureFormulaireActivite === "seance" && !aventureEnEditionId && !personneSeance) {
    document.getElementById("na-erreur").textContent = toutesLesPersonnes().length
      ? "Choisis avec qui a lieu la séance."
      : "Ajoute d'abord la personne dans « Mon entourage ».";
    return;
  }

  // Champs propres à la nature (le reste est commun : entourage, mots-clés).
  let champs;
  if (natureFormulaireActivite === "maison") {
    const consigne = document.getElementById("na-consigne").value.trim();
    if (!nom || !consigne) {
      document.getElementById("na-erreur").textContent = "Donne un nom à l'activité et ce que dit l'acolyte.";
      return;
    }
    champs = { lieu: nom, emoji: emojiChoisiActivite, nature: "maison", endroit: endroitChoisi, consigne, minuteurMinutes: minuteurChoisi, recompensePieces: pieceOui ? 1 : 0 };
  } else {
    if (!nom || !texteTrajet || !texteArrivee || !e1 || !e2 || !e3) {
      document.getElementById("na-erreur").textContent = "Remplis tous les champs avant de créer l'activité.";
      return;
    }
    champs = { lieu: nom, emoji: emojiChoisiActivite, modeTransport: transportChoisi, texteTrajet, texteArrivee, programme: ["1. " + e1, "2. " + e2, "3. " + e3], recompensePieces: pieceOui ? 1 : 0 };
  }

  const motsCles = document.getElementById("na-mots-cles").value.trim();

  // Édition d'une activité existante : fusionne les champs du formulaire
  // SUR l'objet d'origine (Object.assign) plutôt que d'en repartir de
  // zéro — préserve `id`, et pour les 3 aventures praticienne codées en
  // dur, des champs absents de ce formulaire mais essentiels ailleurs
  // (`personne` pilote l'écran de séance au code, cf. terminerVisite() ;
  // `apres`/`date` pilotent le placement dans le planning). Sauvée dans
  // `aventures_perso` sous le même id, qui masque alors l'originale (cf.
  // toutesLesAventures()).
  if (aventureEnEditionId) {
    const original = aventureParId(aventureEnEditionId);
    const maj = Object.assign({}, original, champs);
    if (entourageChoisiActivite.length) maj.entourageIds = [...entourageChoisiActivite]; else delete maj.entourageIds;
    if (motsCles) maj.motsCles = motsCles.split(",").map(m => m.trim()).filter(Boolean); else delete maj.motsCles;
    if (personneSeance) attacherPersonneSeance(maj, personneSeance);

    const perso = chargerAventuresPerso();
    const pos = perso.findIndex(x => x.id === maj.id);
    if (pos === -1) perso.push(maj); else perso[pos] = maj;
    sauverAventuresPerso(perso);

    dire("Activité modifiée : " + nom + ".");
    quitterFormulaireActivite();
    return;
  }

  // Depuis la bibliothèque, créer une activité ne l'ajoute qu'au
  // CATALOGUE (demandé explicitement) — c'est "AJOUTER À LA JOURNÉE" qui
  // la place ensuite sur un jour. Depuis l'éditeur de journée (« + Nouvelle
  // sortie/séance », cf. formulaireDepuisPlanning), elle est ajoutée au
  // jour édité — aujourd'hui, un jour à venir ou un jour de la semaine type.
  const nouvelle = Object.assign({ id: "perso-" + Date.now() }, champs,
    champs.nature === "maison" ? {} : { texteTrajetRetour: "On a fini, on rentre à la maison." });
  // Champs optionnels omis (plutôt que mis à `[]`/`""`) si vides : garde
  // une activité sans entourage/mots-clés indistinguable d'une activité
  // créée avant l'existence de ces champs. `personne` seulement pour une
  // séance créée comme telle (cf. avertissement sur chargerEntouragePerso()).
  if (entourageChoisiActivite.length) nouvelle.entourageIds = [...entourageChoisiActivite];
  if (motsCles) nouvelle.motsCles = motsCles.split(",").map(m => m.trim()).filter(Boolean);
  if (natureFormulaireActivite === "seance") attacherPersonneSeance(nouvelle, personneSeance);

  const perso = chargerAventuresPerso();
  perso.push(nouvelle);
  sauverAventuresPerso(perso);

  dire("Nouvelle activité créée : " + nom + ".");
  if (formulaireDepuisPlanning) ajouterItemPlanning("aventure", nouvelle.id);
  quitterFormulaireActivite();
}

// Une séance porte `personne` (affichage + bascule vers l'écran de
// séance) ET compte cette personne dans son entourage, pour que la ligne
// de planning la montre comme les autres.
function attacherPersonneSeance(aventure, personne) {
  aventure.personne = { emoji: personne.emoji, nom: personne.nom };
  const ids = aventure.entourageIds ? [...aventure.entourageIds] : [];
  if (!ids.includes(personne.id)) ids.push(personne.id);
  aventure.entourageIds = ids;
}

// Catalogue des routines (accès + création, carte "Routines" du hub).
// Contrairement aux activités, une routine n'a pas d'interrupteur
// jour par jour — elle fait partie du parcours tous les jours dès
// qu'elle existe (cf. `toutesLesRoutines()`, `planningParDefaut()`).
// Liste donc en lecture seule (mêmes lignes que l'historique, pas des
// cartes tapables) plutôt qu'un bascule comme pour les activités — pour
// corriger une routine précise, "Relancer une routine" reste l'écran
// dédié.
function construireRoutinesCatalogue() {
  const etat = chargerEtat();
  const liste = document.getElementById("parent-routines-catalogue-liste");
  liste.innerHTML = "";
  toutesLesRoutines().forEach(r => {
    const etatR = etat.routines[r.id];
    const etatTexte = etatR.valide
      ? "✓ validée"
      : (etatR.fait.length > 0 ? etatR.fait.length + "/" + r.taches.length : "pas commencée");
    const ligne = document.createElement("div");
    ligne.className = "ligne-journee";
    ligne.innerHTML =
      `<span class="emoji-journee">${r.emoji}</span><span class="texte-journee">${r.nom}</span><span class="carte-routine-etat">${etatTexte}</span>`;
    const btnEditer = document.createElement("button");
    btnEditer.type = "button";
    btnEditer.className = "btn-mini-edition";
    btnEditer.textContent = "✏️";
    btnEditer.setAttribute("aria-label", "Modifier « " + r.nom + " »");
    btnEditer.onclick = () => ouvrirEditionRoutine(r.id);
    ligne.appendChild(btnEditer);
    liste.appendChild(ligne);
  });
}

// Nouvelle routine : contrairement à une activité, une routine a un
// nombre variable de tâches, chacune ciblant une zone précise de
// l'avatar (`.zone-cible` dans index.html) — jusqu'à 5 lignes de tâche
// fixes dans le formulaire, les vides sont simplement ignorées (au
// moins une requise). Pas de `calque` proposé (ça demanderait un sprite
// existant pour chaque nouveau vêtement/objet) : chaque tâche a son
// propre emoji, affiché tel quel, sans effet persistant sur l'avatar —
// comme "Range tes vêtements"/"Je vais me coucher" dans "Aller se
// coucher" aujourd'hui.
const EMOJI_ROUTINE = ["🪥","🛁","🧦","🧸","📚","🍽️","🧴","✏️","🧹","🚿","🎒","👕","🧼","⏰","🌟","🧦"];
let emojiChoisiRoutine = EMOJI_ROUTINE[0];
let lieuChoisiRoutine = "chambre";

function choisirLieuRoutine(lieu) {
  lieuChoisiRoutine = lieu;
  document.getElementById("nr-lieu-chambre").classList.toggle("choisi", lieu === "chambre");
  document.getElementById("nr-lieu-salon").classList.toggle("choisi", lieu === "salon");
}

// Style visuel des minuteurs de cette routine (cf. dessinerMinuteur() —
// "jauge" ou "cadran"), même principe de bouton à deux choix que
// choisirLieuRoutine() ci-dessus.
let styleMinuteurChoisi = "jauge";
function choisirStyleMinuteur(style) {
  styleMinuteurChoisi = style;
  document.getElementById("nr-style-jauge").classList.toggle("choisi", style === "jauge");
  document.getElementById("nr-style-cadran").classList.toggle("choisi", style === "cadran");
}

let entourageChoisiRoutine = [];
// Même principe que aventureEnEditionId ci-dessus : `null` = création,
// sinon id de la routine en cours de modification.
let routineEnEditionId = null;

// Bouton "⏱️ Minuteur" par tâche (cf. index.html, .btn-toggle-minuteur) :
// replié par défaut, ne montre les champs (durée/alertes) que si un
// parent l'ouvre explicitement ou que la tâche en avait déjà un à
// l'édition — évite que 5 lignes toujours visibles allongent le
// formulaire pour rien pour la grande majorité des tâches sans minuteur.
function afficherChampsMinuteurRoutine(i, visible) {
  document.getElementById("nr-t" + i + "-minuteur-champs").classList.toggle("hidden", !visible);
  document.getElementById("nr-t" + i + "-minuteur-toggle").classList.toggle("actif", visible);
}
function toggleChampsMinuteurRoutine(i) {
  const champs = document.getElementById("nr-t" + i + "-minuteur-champs");
  afficherChampsMinuteurRoutine(i, champs.classList.contains("hidden"));
}

// Même principe qu'afficherChampsMinuteurRoutine()/toggleChampsMinuteurRoutine()
// ci-dessus, pour le minuteur global (au niveau de la routine entière plutôt
// que d'une tâche) — un seul jeu de champs, pas besoin d'index `i`.
function afficherChampsMinuteurGlobal(visible) {
  document.getElementById("nr-global-minuteur-champs").classList.toggle("hidden", !visible);
  document.getElementById("nr-global-minuteur-toggle").classList.toggle("actif", visible);
}
function toggleChampsMinuteurGlobal() {
  const champs = document.getElementById("nr-global-minuteur-champs");
  afficherChampsMinuteurGlobal(champs.classList.contains("hidden"));
}

function ouvrirNouvelleRoutine() {
  routineEnEditionId = null;
  document.getElementById("nouvelle-routine-titre").textContent = "Nouvelle routine";
  document.getElementById("btn-creer-routine").textContent = "Créer et ajouter à la journée";
  document.getElementById("nr-nom").value = "";
  for (let i = 1; i <= 5; i++) {
    document.getElementById("nr-t" + i + "-texte").value = "";
    document.getElementById("nr-t" + i + "-emoji").value = "";
    document.getElementById("nr-t" + i + "-corps").checked = true;
    document.getElementById("nr-t" + i + "-minuteur").value = "";
    document.getElementById("nr-t" + i + "-minuteur-alertes").checked = true;
    afficherChampsMinuteurRoutine(i, false);
  }
  document.getElementById("nr-global-minuteur").value = "";
  document.getElementById("nr-global-minuteur-alertes").checked = true;
  afficherChampsMinuteurGlobal(false);
  choisirStyleMinuteur("jauge");
  document.getElementById("nr-mots-cles").value = "";
  document.getElementById("nr-erreur").textContent = "";
  emojiChoisiRoutine = EMOJI_ROUTINE[0];
  construireDeclencheurEmoji("nr-emoji-trigger", emojiChoisiRoutine);
  choisirLieuRoutine("chambre");
  entourageChoisiRoutine = [];
  construireChoixEntourage(document.getElementById("nr-entourage-grille"), entourageChoisiRoutine);
  afficherEcran("screen-parent-nouvelle-routine");
}

// Pré-remplit le formulaire (partagé avec la création) avec la routine
// existante — codée en dur ou déjà perso (cf. toutesLesRoutines()) —
// chaque tâche dans le même emplacement (1 à 5) que dans `r.taches`, pour
// que la fusion positionnelle de creerNouvelleRoutine() retrouve la bonne
// tâche d'origine à la sauvegarde.
function ouvrirEditionRoutine(id) {
  const r = routineParId(id);
  if (!r) return;
  routineEnEditionId = id;
  document.getElementById("nouvelle-routine-titre").textContent = "Modifier la routine";
  document.getElementById("btn-creer-routine").textContent = "Enregistrer les modifications";
  document.getElementById("nr-nom").value = r.nom;
  for (let i = 1; i <= 5; i++) {
    const t = r.taches[i - 1];
    document.getElementById("nr-t" + i + "-texte").value = t ? t.texte : "";
    document.getElementById("nr-t" + i + "-emoji").value = t ? t.emoji : "";
    // `!t || !!t.zone` — un emplacement encore vide (nouvelle tâche) part
    // coché par défaut ; une tâche existante reflète son vrai état (ex.
    // décoché pour "Fais tes devoirs", ou dents/histoire qui n'ont de
    // toute façon pas de zone).
    document.getElementById("nr-t" + i + "-corps").checked = !t || !!t.zone;
    document.getElementById("nr-t" + i + "-minuteur").value = (t && t.minuteurDuree) ? Math.round(t.minuteurDuree / 60) : "";
    document.getElementById("nr-t" + i + "-minuteur-alertes").checked = !t || t.minuteurAlertes !== false;
    afficherChampsMinuteurRoutine(i, !!(t && t.minuteurDuree));
  }
  document.getElementById("nr-global-minuteur").value = r.dureeGlobale ? Math.round(r.dureeGlobale / 60) : "";
  document.getElementById("nr-global-minuteur-alertes").checked = r.alertesGlobales !== false;
  afficherChampsMinuteurGlobal(!!r.dureeGlobale);
  choisirStyleMinuteur(r.styleMinuteur || "jauge");
  document.getElementById("nr-mots-cles").value = (r.motsCles || []).join(", ");
  document.getElementById("nr-erreur").textContent = "";
  emojiChoisiRoutine = r.emoji;
  construireDeclencheurEmoji("nr-emoji-trigger", emojiChoisiRoutine);
  choisirLieuRoutine(r.lieu || "chambre");
  entourageChoisiRoutine = r.entourageIds ? [...r.entourageIds] : [];
  construireChoixEntourage(document.getElementById("nr-entourage-grille"), entourageChoisiRoutine);
  afficherEcran("screen-parent-nouvelle-routine");
}

function creerNouvelleRoutine() {
  const nom = document.getElementById("nr-nom").value.trim();
  const original = routineEnEditionId ? routineParId(routineEnEditionId) : null;
  const taches = [];
  for (let i = 1; i <= 5; i++) {
    const texte = document.getElementById("nr-t" + i + "-texte").value.trim();
    if (!texte) continue;
    const emoji = document.getElementById("nr-t" + i + "-emoji").value.trim() || "✅";
    const corpsCoche = document.getElementById("nr-t" + i + "-corps").checked;
    const minuteurMinutes = document.getElementById("nr-t" + i + "-minuteur").value.trim();
    const minuteurAlertes = document.getElementById("nr-t" + i + "-minuteur-alertes").checked;
    // Fusion positionnelle (emplacement i du formulaire <- tâche i de
    // l'originale) plutôt qu'un objet neuf : préserve les champs propres
    // à certaines routines codées en dur, absents de ce formulaire mais
    // essentiels ailleurs (`calque`/`retire`/`avatarGlissable` pour
    // l'habillage, `badge`/`badgeFait`/`pileGlissable` pour le coucher,
    // cf. routinesDemarrage() plus haut).
    const origTache = original && original.taches[i - 1];
    const tache = Object.assign({}, origTache, { texte, emoji, id: (origTache && origTache.id) || ("t" + i) });
    // Minuteur : indépendant de la case "Glisser pour valider" — une
    // tâche à glisser-déposer (ex. "Mets ton caleçon") peut très bien
    // avoir un minuteur affiché à côté (cf. synchroniserMinuteurWidget())
    // sans que ça change comment elle se valide. Seule une tâche SANS
    // zone (case décochée, ex. "Fais tes devoirs") s'appuie sur le
    // bouton "J'ai fini" du widget pour se faire valider, minuteur réglé
    // ou non (corrigé : ce bouton restait caché sans minuteur avant).
    if (minuteurMinutes) {
      tache.minuteurDuree = Math.max(1, Math.round(parseFloat(minuteurMinutes) * 60));
      tache.minuteurAlertes = minuteurAlertes;
    } else {
      delete tache.minuteurDuree; delete tache.minuteurAlertes;
    }
    // Case "Glisser pour valider" (une seule cible pour tout l'habillage,
    // #zone-corps, cf. index.html/styles.css) : jamais pour "dents"/"histoire"
    // (miniJeu déjà présent sur l'originale, préservé tel quel par
    // Object.assign() ci-dessus) ni pour une tâche structurellement à
    // part (`avatarGlissable`/"enlève tes vêtements", `pileGlissable`/
    // "range tes vêtements" qui cible "zone-panier") — ces trois gèrent
    // leur propre zone (ou absence de zone) indépendamment de cette case,
    // qui ne les concerne pas.
    const zoneAPart = origTache && (origTache.avatarGlissable || origTache.pileGlissable);
    if ((!origTache || !origTache.miniJeu) && !zoneAPart) {
      if (corpsCoche) tache.zone = "zone-corps"; else delete tache.zone;
    }
    taches.push(tache);
  }

  if (!nom || taches.length === 0) {
    document.getElementById("nr-erreur").textContent = "Donne un nom et remplis au moins une tâche avant de créer la routine.";
    return;
  }

  const motsCles = document.getElementById("nr-mots-cles").value.trim();
  // Minuteur global : même logique que le minuteur par tâche plus haut,
  // au niveau de la routine entière (cf. assurerMinuteurPourRoutine()) —
  // coexiste sans conflit avec les minuteurs de tâche individuels.
  const globalMinutes = document.getElementById("nr-global-minuteur").value.trim();
  const globalAlertes = document.getElementById("nr-global-minuteur-alertes").checked;

  // Édition d'une routine existante : fusionne les champs du formulaire
  // SUR l'objet d'origine (Object.assign), comme creerNouvelleAventure()
  // — préserve `id`, `felicitation` (souvent personnalisée sur les
  // routines codées en dur, pas régénérée ici) et `disponibleApresHeure`
  // ("Aller se coucher"). Sauvée dans `routines_perso` sous le même id,
  // qui masque alors l'originale (cf. toutesLesRoutines()).
  if (original) {
    const maj = Object.assign({}, original, { nom, emoji: emojiChoisiRoutine, lieu: lieuChoisiRoutine, taches, styleMinuteur: styleMinuteurChoisi });
    if (entourageChoisiRoutine.length) maj.entourageIds = [...entourageChoisiRoutine]; else delete maj.entourageIds;
    if (motsCles) maj.motsCles = motsCles.split(",").map(m => m.trim()).filter(Boolean); else delete maj.motsCles;
    if (globalMinutes) { maj.dureeGlobale = Math.max(1, Math.round(parseFloat(globalMinutes) * 60)); maj.alertesGlobales = globalAlertes; }
    else { delete maj.dureeGlobale; delete maj.alertesGlobales; }

    const perso = chargerRoutinesPerso();
    const pos = perso.findIndex(x => x.id === maj.id);
    if (pos === -1) perso.push(maj); else perso[pos] = maj;
    sauverRoutinesPerso(perso);

    dire("Routine modifiée : " + nom + ".");
    routineEnEditionId = null;
    construireRoutinesCatalogue();
    afficherEcran("screen-parent-routines-catalogue");
    return;
  }

  const nouvelle = {
    id: "routine-perso-" + Date.now(),
    nom,
    emoji: emojiChoisiRoutine,
    lieu: lieuChoisiRoutine,
    styleMinuteur: styleMinuteurChoisi,
    felicitation: "Bravo " + profilActif().prenom + ", tu as fini : " + nom + " !",
    taches,
  };
  if (entourageChoisiRoutine.length) nouvelle.entourageIds = [...entourageChoisiRoutine];
  if (motsCles) nouvelle.motsCles = motsCles.split(",").map(m => m.trim()).filter(Boolean);
  if (globalMinutes) { nouvelle.dureeGlobale = Math.max(1, Math.round(parseFloat(globalMinutes) * 60)); nouvelle.alertesGlobales = globalAlertes; }

  const perso = chargerRoutinesPerso();
  perso.push(nouvelle);
  sauverRoutinesPerso(perso);

  // Ajoutée tout de suite à l'état du jour (etat.routines) et au
  // planning d'aujourd'hui — sinon `toutesLesRoutines()` la connaîtrait
  // déjà, mais un `etat.routines`/`etat.planning` chargé avant sa
  // création ne l'aurait pas. Les jours suivants la tiennent de la
  // semaine type, où elle est ajoutée aux 7 jours.
  const etat = chargerEtat();
  etat.routines[nouvelle.id] = { fait: [], valide: false };
  etat.planning.push({ type: "routine", id: nouvelle.id });
  sauverEtat(etat);
  sauverSemaineType(ajouterAuxSeptJours(chargerSemaineType(), { type: "routine", id: nouvelle.id }));

  dire("Nouvelle routine créée : " + nom + ".");
  construireRoutinesCatalogue();
  afficherEcran("screen-parent-routines-catalogue");
}

// Catalogue "Mon entourage" (accès + création, carte du hub parent) —
// même lecture seule que le catalogue Routines (pas d'interrupteur jour
// par jour à proposer ici non plus, cf. commentaire de
// construireRoutinesCatalogue()) plutôt que les cartes tapables des
// Activités.
function construireParentEntourage() {
  const liste = document.getElementById("parent-entourage-liste");
  liste.innerHTML = "";
  const personnes = toutesLesPersonnes();
  if (personnes.length === 0) {
    const vide = document.createElement("div");
    vide.className = "recompenses-vide";
    vide.textContent = "Personne dans l'entourage pour l'instant.";
    liste.appendChild(vide);
    return;
  }
  personnes.forEach(p => {
    const ligne = document.createElement("div");
    ligne.className = "ligne-journee";
    ligne.innerHTML = `<span class="emoji-journee">${p.emoji}</span>`
      + `<span class="texte-journee"><span>${p.nom}</span>${p.role ? `<span class="texte-journee-reveil">${p.role}</span>` : ""}</span>`;
    const btnEditer = document.createElement("button");
    btnEditer.type = "button";
    btnEditer.className = "btn-mini-edition";
    btnEditer.textContent = "✏️";
    btnEditer.setAttribute("aria-label", "Modifier « " + p.nom + " »");
    btnEditer.onclick = () => ouvrirEditionPersonne(p.id);
    ligne.appendChild(btnEditer);
    liste.appendChild(ligne);
  });
}

const EMOJI_PERSONNE = ["👩","🧑","👨","👵","👴","🧑‍⚕️","👩‍⚕️","🧑‍🏫","👧","👦","🦸","🐶"];
let emojiChoisiPersonne = EMOJI_PERSONNE[0];
// Même principe que aventureEnEditionId/routineEnEditionId : `null` =
// création, sinon id de la personne en cours de modification.
let personneEnEditionId = null;

function ouvrirNouvellePersonne() {
  personneEnEditionId = null;
  document.getElementById("nouvelle-personne-titre").textContent = "Nouvelle personne";
  document.getElementById("btn-creer-personne").textContent = "Créer";
  document.getElementById("np-nom").value = "";
  document.getElementById("np-role").value = "";
  document.getElementById("np-erreur").textContent = "";
  emojiChoisiPersonne = EMOJI_PERSONNE[0];
  construireDeclencheurEmoji("np-emoji-trigger", emojiChoisiPersonne);
  afficherEcran("screen-parent-nouvelle-personne");
}

// Pré-remplit le formulaire (partagé avec la création) avec la personne
// existante — codée en dur ou déjà perso (cf. toutesLesPersonnes()) —
// puis bascule creerNouvellePersonne() en mode mise à jour via
// `personneEnEditionId`. ⚠️ Ne touche jamais au champ `personne` des
// aventures praticienne : volontairement distinct de ce catalogue (cf.
// commentaire sur ENTOURAGE_COMMUNES plus haut) — renommer une praticienne
// ici ne la renomme pas dans l'écran de séance.
function ouvrirEditionPersonne(id) {
  const p = personneParId(id);
  if (!p) return;
  personneEnEditionId = id;
  document.getElementById("nouvelle-personne-titre").textContent = "Modifier la personne";
  document.getElementById("btn-creer-personne").textContent = "Enregistrer les modifications";
  document.getElementById("np-nom").value = p.nom;
  document.getElementById("np-role").value = p.role || "";
  document.getElementById("np-erreur").textContent = "";
  emojiChoisiPersonne = p.emoji;
  construireDeclencheurEmoji("np-emoji-trigger", emojiChoisiPersonne);
  afficherEcran("screen-parent-nouvelle-personne");
}

// ---------------------------------------------------------------------
// Sélecteur d'emoji recherchable façon Slack (demandé explicitement :
// "la liste existante ne permet pas de tout traiter") — un seul écran
// partagé par les 3 boutons "icône actuelle" (activité/routine/
// personne, cf. construireDeclencheurEmoji plus haut) plutôt qu'un
// widget par formulaire. Sans recherche : la liste "favoris" du
// formulaire d'où on l'a ouvert (EMOJI_ACTIVITE/ROUTINE/PERSONNE,
// inchangées). Avec recherche : filtre EMOJI_CATALOGUE (large, mots-clés
// français) via normaliser() — même fonction déjà utilisée par l'ajout
// au planning par texte libre, pour rester cohérent (accents/casse
// ignorés partout pareil). Recherche 100% locale, aucune dépendance
// externe — cohérent avec le reste de l'app hors-ligne.
const EMOJI_CATALOGUE = [
  // Sports et activités
  { e: "🏊", mots: ["natation", "piscine", "nager"] },
  { e: "🚲", mots: ["velo", "bicyclette"] },
  { e: "🎨", mots: ["dessin", "peinture", "art"] },
  { e: "🎪", mots: ["cirque", "fete foraine"] },
  { e: "⚽", mots: ["foot", "football", "ballon"] },
  { e: "🏀", mots: ["basket", "basketball"] },
  { e: "🏈", mots: ["football americain"] },
  { e: "⚾", mots: ["baseball"] },
  { e: "🎾", mots: ["tennis"] },
  { e: "🏐", mots: ["volley", "volleyball"] },
  { e: "🏓", mots: ["ping-pong", "tennis de table"] },
  { e: "🏸", mots: ["badminton"] },
  { e: "🥊", mots: ["boxe"] },
  { e: "🥋", mots: ["judo", "karate", "arts martiaux"] },
  { e: "⛸️", mots: ["patinage", "patin a glace"] },
  { e: "🎿", mots: ["ski"] },
  { e: "🏂", mots: ["snowboard", "surf des neiges"] },
  { e: "🤸", mots: ["gymnastique", "culbute", "roulade"] },
  { e: "🧘", mots: ["yoga", "meditation", "relaxation"] },
  { e: "🎣", mots: ["peche"] },
  { e: "🏹", mots: ["tir a l'arc", "archerie"] },
  { e: "🚣", mots: ["aviron", "canoe", "kayak"] },
  { e: "🏄", mots: ["surf"] },
  { e: "🚴", mots: ["cyclisme", "faire du velo"] },
  { e: "🧗", mots: ["escalade", "grimper"] },
  { e: "🎯", mots: ["flechettes", "cible", "precision"] },
  { e: "🎮", mots: ["jeu video", "console", "manette"] },
  { e: "🎲", mots: ["des", "jeu de societe"] },
  { e: "🧩", mots: ["puzzle", "casse-tete"] },
  { e: "🎭", mots: ["theatre", "spectacle"] },
  { e: "🎤", mots: ["chant", "karaoke", "micro", "chanter"] },
  { e: "🎸", mots: ["guitare"] },
  { e: "🥁", mots: ["batterie", "tambour"] },
  { e: "🎹", mots: ["piano"] },
  { e: "🎻", mots: ["violon"] },
  { e: "🎬", mots: ["cinema", "film"] },
  { e: "🎳", mots: ["bowling"] },
  { e: "🏆", mots: ["trophee", "victoire", "gagne"] },
  { e: "🥇", mots: ["medaille", "or", "premiere place"] },
  { e: "🛹", mots: ["skateboard", "planche a roulettes"] },
  { e: "🛼", mots: ["roller", "patins a roulettes"] },
  { e: "🪁", mots: ["cerf-volant"] },
  { e: "🤾", mots: ["handball"] },
  { e: "🚵", mots: ["vtt", "velo tout terrain"] },
  { e: "🏇", mots: ["equitation", "cheval", "poney"] },
  { e: "🤺", mots: ["escrime"] },
  { e: "🏋️", mots: ["musculation", "halteres", "sport"] },
  { e: "🤹", mots: ["jonglage"] },
  { e: "🎱", mots: ["billard"] },
  // Nourriture et repas
  { e: "🍕", mots: ["pizza"] },
  { e: "🍦", mots: ["glace"] },
  { e: "🍪", mots: ["biscuit", "cookie", "gateau sec"] },
  { e: "🍰", mots: ["gateau", "part de gateau"] },
  { e: "🎂", mots: ["gateau anniversaire", "anniversaire"] },
  { e: "🍫", mots: ["chocolat"] },
  { e: "🍿", mots: ["popcorn"] },
  { e: "🍭", mots: ["sucette", "bonbon"] },
  { e: "🍬", mots: ["bonbon"] },
  { e: "🥐", mots: ["croissant", "viennoiserie"] },
  { e: "🍞", mots: ["pain"] },
  { e: "🥖", mots: ["baguette"] },
  { e: "🍳", mots: ["oeuf", "oeuf au plat"] },
  { e: "🥞", mots: ["crepe", "pancake"] },
  { e: "🧇", mots: ["gaufre"] },
  { e: "🍔", mots: ["hamburger", "burger"] },
  { e: "🌭", mots: ["hot-dog"] },
  { e: "🥪", mots: ["sandwich"] },
  { e: "🌮", mots: ["taco"] },
  { e: "🌯", mots: ["burrito"] },
  { e: "🥗", mots: ["salade"] },
  { e: "🍝", mots: ["pates", "spaghetti"] },
  { e: "🍜", mots: ["nouilles", "soupe"] },
  { e: "🍣", mots: ["sushi"] },
  { e: "🍱", mots: ["bento", "plateau repas"] },
  { e: "🍎", mots: ["pomme"] },
  { e: "🍌", mots: ["banane"] },
  { e: "🍇", mots: ["raisin"] },
  { e: "🍓", mots: ["fraise"] },
  { e: "🍉", mots: ["pasteque"] },
  { e: "🍒", mots: ["cerise"] },
  { e: "🍑", mots: ["peche"] },
  { e: "🥕", mots: ["carotte"] },
  { e: "🥦", mots: ["brocoli"] },
  { e: "🍅", mots: ["tomate"] },
  { e: "🥛", mots: ["lait"] },
  { e: "🧃", mots: ["jus"] },
  { e: "🍽️", mots: ["repas", "assiette", "manger"] },
  { e: "🧁", mots: ["cupcake", "petit gateau"] },
  // Animaux
  { e: "🐶", mots: ["chien"] },
  { e: "🐱", mots: ["chat"] },
  { e: "🐰", mots: ["lapin"] },
  { e: "🐻", mots: ["ours"] },
  { e: "🐼", mots: ["panda"] },
  { e: "🦁", mots: ["lion"] },
  { e: "🐯", mots: ["tigre"] },
  { e: "🐸", mots: ["grenouille"] },
  { e: "🐵", mots: ["singe"] },
  { e: "🐷", mots: ["cochon"] },
  { e: "🐮", mots: ["vache"] },
  { e: "🐴", mots: ["cheval"] },
  { e: "🐔", mots: ["poule", "poulet"] },
  { e: "🐧", mots: ["pingouin", "manchot"] },
  { e: "🦋", mots: ["papillon"] },
  { e: "🐝", mots: ["abeille"] },
  { e: "🐢", mots: ["tortue"] },
  { e: "🦕", mots: ["dinosaure"] },
  { e: "🦖", mots: ["dinosaure", "t-rex"] },
  { e: "🐠", mots: ["poisson"] },
  { e: "🐬", mots: ["dauphin"] },
  { e: "🐳", mots: ["baleine"] },
  { e: "🦄", mots: ["licorne"] },
  { e: "🐦", mots: ["oiseau"] },
  { e: "🐹", mots: ["hamster"] },
  { e: "🐭", mots: ["souris"] },
  { e: "🦉", mots: ["hibou", "chouette"] },
  { e: "🐍", mots: ["serpent"] },
  { e: "🦒", mots: ["girafe"] },
  { e: "🐘", mots: ["elephant"] },
  // Lieux et transports
  { e: "🏥", mots: ["hopital", "medecin"] },
  { e: "🏫", mots: ["ecole"] },
  { e: "🏠", mots: ["maison"] },
  { e: "🏖️", mots: ["plage"] },
  { e: "🏕️", mots: ["camping", "tente"] },
  { e: "🏰", mots: ["chateau"] },
  { e: "🎡", mots: ["grande roue", "fete foraine"] },
  { e: "🎢", mots: ["montagnes russes", "fete foraine"] },
  { e: "🚗", mots: ["voiture"] },
  { e: "🚌", mots: ["bus"] },
  { e: "✈️", mots: ["avion"] },
  { e: "⛴️", mots: ["bateau", "ferry"] },
  { e: "🚀", mots: ["fusee", "espace"] },
  { e: "🚂", mots: ["train"] },
  { e: "🛒", mots: ["courses", "magasin", "supermarche"] },
  { e: "🌳", mots: ["arbre", "parc", "nature"] },
  { e: "🏙️", mots: ["ville"] },
  { e: "🛍️", mots: ["shopping", "achats"] },
  { e: "🚕", mots: ["taxi"] },
  { e: "🚁", mots: ["helicoptere"] },
  { e: "⛺", mots: ["tente", "camping"] },
  { e: "🗺️", mots: ["carte", "voyage"] },
  { e: "🧳", mots: ["valise", "voyage"] },
  // Objets, école, hygiène
  { e: "🧸", mots: ["nounours", "peluche", "doudou"] },
  { e: "🎁", mots: ["cadeau"] },
  { e: "🎈", mots: ["ballon", "fete"] },
  { e: "🎀", mots: ["ruban", "noeud"] },
  { e: "📚", mots: ["livre", "lecture"] },
  { e: "✏️", mots: ["crayon", "dessiner", "ecrire"] },
  { e: "🖍️", mots: ["crayon de couleur", "feutre"] },
  { e: "🎒", mots: ["sac a dos", "cartable"] },
  { e: "🔬", mots: ["microscope", "science"] },
  { e: "🔭", mots: ["telescope"] },
  { e: "📱", mots: ["telephone", "tablette"] },
  { e: "🧴", mots: ["flacon", "creme", "savon"] },
  { e: "🧼", mots: ["savon"] },
  { e: "🪥", mots: ["brosse a dents", "dents"] },
  { e: "🛁", mots: ["bain", "baignoire"] },
  { e: "🚿", mots: ["douche"] },
  { e: "🧹", mots: ["balai", "ranger"] },
  { e: "👕", mots: ["vetement", "t-shirt", "habiller"] },
  { e: "🧦", mots: ["chaussettes"] },
  { e: "👟", mots: ["chaussures", "baskets"] },
  { e: "🎓", mots: ["diplome", "ecole"] },
  { e: "⏰", mots: ["reveil", "horloge", "heure"] },
  // Météo et nature
  { e: "☀️", mots: ["soleil"] },
  { e: "🌙", mots: ["lune", "nuit"] },
  { e: "⭐", mots: ["etoile"] },
  { e: "🌈", mots: ["arc-en-ciel"] },
  { e: "☁️", mots: ["nuage"] },
  { e: "🌧️", mots: ["pluie"] },
  { e: "❄️", mots: ["neige"] },
  { e: "🌸", mots: ["fleur"] },
  { e: "🌻", mots: ["tournesol", "fleur"] },
  { e: "🍁", mots: ["automne", "feuille"] },
  { e: "🌊", mots: ["vague", "mer"] },
  { e: "🔥", mots: ["feu"] },
  // Émotions et divers
  { e: "❤️", mots: ["coeur", "amour"] },
  { e: "✨", mots: ["etincelle", "magie", "brille"] },
  { e: "🎉", mots: ["fete", "confettis", "celebration"] },
  { e: "🎊", mots: ["fete", "confettis"] },
  { e: "😊", mots: ["sourire", "content"] },
  { e: "😄", mots: ["content", "rire", "heureux"] },
  { e: "🙂", mots: ["normal", "calme"] },
  { e: "😢", mots: ["triste"] },
  { e: "🤒", mots: ["malade"] },
  { e: "😴", mots: ["fatigue", "dormir", "sommeil"] },
  { e: "💪", mots: ["fort", "en forme", "muscle"] },
  { e: "🎵", mots: ["musique", "note"] },
  { e: "🔔", mots: ["cloche", "sonnerie"] },
];

let emojiPickerFavoris = [];
let emojiPickerOnChoix = null;

function ouvrirSelecteurEmoji(favoris, actuel, onChoix) {
  emojiPickerFavoris = favoris;
  emojiPickerOnChoix = onChoix;
  document.getElementById("emoji-picker-recherche").value = "";
  construireGrilleSelecteurEmoji("");
  document.getElementById("emoji-picker").classList.remove("hidden");
  document.getElementById("emoji-picker-recherche").focus();
}

function fermerSelecteurEmoji() {
  document.getElementById("emoji-picker").classList.add("hidden");
  emojiPickerOnChoix = null;
}

function choisirEmojiPicker(e) {
  if (emojiPickerOnChoix) emojiPickerOnChoix(e);
  fermerSelecteurEmoji();
}

// Sans recherche : favoris du formulaire d'origine (ordre conservé,
// utile — les tout premiers restent les plus rapides d'accès). Avec
// recherche : parcourt EMOJI_CATALOGUE, comparaison normalisée
// (accents/casse ignorés, cf. normaliser()) sur chaque mot-clé — pas de
// score de pertinence, un simple "contient" suffit pour un catalogue de
// cette taille (même principe que trouverCorrespondance() pour l'ajout
// par texte libre).
function construireGrilleSelecteurEmoji(recherche) {
  const grille = document.getElementById("emoji-picker-grille");
  grille.innerHTML = "";
  const t = normaliser(recherche);
  const liste = t
    ? EMOJI_CATALOGUE.filter(x => x.mots.some(m => normaliser(m).includes(t))).map(x => x.e)
    : emojiPickerFavoris;
  if (liste.length === 0) {
    const vide = document.createElement("div");
    vide.className = "recompenses-vide";
    vide.textContent = "Aucun emoji trouvé.";
    grille.appendChild(vide);
    return;
  }
  liste.forEach(e => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "emoji-choix-btn";
    b.textContent = e;
    b.onclick = () => choisirEmojiPicker(e);
    grille.appendChild(b);
  });
}

function creerNouvellePersonne() {
  const nom = document.getElementById("np-nom").value.trim();
  if (!nom) {
    document.getElementById("np-erreur").textContent = "Donne un nom avant de créer.";
    return;
  }
  const role = document.getElementById("np-role").value.trim();

  // Édition d'une personne existante : fusionne les champs du formulaire
  // SUR l'objet d'origine (même principe que creerNouvelleAventure()/
  // creerNouvelleRoutine()) plutôt que d'en repartir de zéro — préserve
  // `id`. Sauvée dans `entourage_perso` sous le même id, qui masque alors
  // l'originale (cf. toutesLesPersonnes()).
  if (personneEnEditionId) {
    const original = personneParId(personneEnEditionId);
    const maj = Object.assign({}, original, { nom, emoji: emojiChoisiPersonne, role });
    const perso = chargerEntouragePerso();
    const pos = perso.findIndex(x => x.id === maj.id);
    if (pos === -1) perso.push(maj); else perso[pos] = maj;
    sauverEntouragePerso(perso);
    dire("Personne modifiée : " + nom + ".");
    personneEnEditionId = null;
    construireParentEntourage();
    afficherEcran("screen-parent-entourage");
    return;
  }

  const nouvelle = { id: "personne-" + Date.now(), nom, emoji: emojiChoisiPersonne, role };
  const perso = chargerEntouragePerso();
  perso.push(nouvelle);
  sauverEntouragePerso(perso);
  dire("Nouvelle personne ajoutée : " + nom + ".");
  construireParentEntourage();
  afficherEcran("screen-parent-entourage");
}

// ---------------------------------------------------------------------
// 4. Récompense de fin de journée (une fois "Aller se coucher" validée),
// puis endormissement de l'app jusqu'au lendemain HEURE_REVEIL
// ---------------------------------------------------------------------
// Message de clôture de la journée, dit au coucher (cf. allerDormir()) :
// calme, sans récapitulatif ni fête — les étoiles du jour se découvrent le
// lendemain matin. Fonction (pas une constante) : dépend du prénom du
// profil actif.
function texteFinJournee(profil) {
  return "Bonne nuit " + profil.prenom + ", tes étoiles t'attendent demain matin.";
}
const HEURE_REVEIL = 7;
// `profil.naissance` ("AAAA-M-J", cf. `finaliserPremiereConfiguration()`)
// absente pour un profil créé avant l'ajout de ce champ — d'où les gardes
// `if (!naissance)` : pas d'anniversaire à fêter plutôt qu'une erreur.
function ageDepuis(naissance) {
  if (!naissance) return null;
  const [annee, mois, jour] = naissance.split("-").map(Number);
  const auj = dateActuelle();
  let age = auj.getFullYear() - annee;
  if (auj.getMonth() + 1 < mois || (auj.getMonth() + 1 === mois && auj.getDate() < jour)) age--;
  return age;
}
function anniversaireAujourdhui(naissance) {
  if (!naissance) return false;
  const [, mois, jour] = naissance.split("-").map(Number);
  const auj = dateActuelle();
  return auj.getMonth() + 1 === mois && auj.getDate() === jour;
}
function texteReveilBonjour(profil) {
  if (anniversaireAujourdhui(profil.naissance)) {
    return "Bonjour " + profil.prenom + " ! Joyeux anniversaire, tu as maintenant " + ageDepuis(profil.naissance) + " ans !";
  }
  return "Bonjour " + profil.prenom;
}
const TEXTE_REVEIL_DORMI = "As-tu bien dormi ?";
const TEXTE_REVEIL_HUMEUR = "Comment te sens-tu ? Choisis bien ta réponse avec l'image qui te plaît le plus.";


// `cle("reveil")` (horodatage ISO, prochain HEURE_REVEIL) est
// volontairement une clé à part de `cle("journee")` : cette dernière
// repart de zéro dès que la date change (cf. `chargerEtat`), ce qui
// arrive à minuit — bien avant l'heure de réveil. Le verrou doit
// survivre à ce passage de minuit pour tenir jusqu'au matin.
function prochainReveil(depuis) {
  const reveil = new Date(depuis);
  reveil.setHours(HEURE_REVEIL, 0, 0, 0);
  if (reveil <= depuis) reveil.setDate(reveil.getDate() + 1);
  return reveil;
}

function dortEncore() {
  const reveil = localStorage.getItem(cle("reveil"));
  if (reveil && dateActuelle() < new Date(reveil)) return true;
  try { localStorage.removeItem(cle("reveil")); } catch (e) {}
  return false;
}

// Écran "en sommeil" (screen-dodo) : aucune carte, aucun bouton, rien à
// faire tant que `dortEncore()` est vrai. Seul le bouton global ⚙️ espace
// parent (hors des .screen, toujours affiché ; ↺ reset aussi si le mode
// debug est actif) reste atteignable : c'est le bypass parental
// exceptionnel, via le code déjà existant (cf. ouvrirEspaceParent). construireMenu() ne
// revérifie pas ce verrou : une fois le code entré, revenir à l'écran
// enfant depuis l'espace parent suffit à le lever pour la session en
// cours (il retient au prochain rechargement si l'heure n'est pas
// encore passée, cf. `demarrer`).
//
// Une fois l'heure passée, ce même écran devient tapable (cf. wiring de
// `#screen-dodo` plus bas) : un tap de l'enfant lance le rituel du réveil
// (`ouvrirReveil`) plutôt qu'un retour direct au menu. `reveilFait` (sur
// `etat`, réparé comme `journeeFaite` dans `etatRepare`) retient que le
// rituel a eu lieu pour ne pas le rejouer à chaque rechargement du reste
// de la journée — cf. `demarrer` et `finReveil`.
function endormir() {
  const etat = chargerEtat();
  etat.journeeFaite = true;
  sauverEtat(etat);
  try { localStorage.setItem(cle("reveil"), prochainReveil(dateActuelle()).toISOString()); } catch (e) {}
  afficherEcran("screen-dodo");
}

// Rituel du réveil (bonjour → as-tu bien dormi → comment te sens-tu),
// avant d'arriver au menu du jour déjà connu de l'enfant. Les 3 écrans
// sont volontairement sans bouton retour (comme screen-bravo-routine/
// screen-coffre) : une fois lancé, on ne revient pas en arrière dans le
// rituel, on avance jusqu'au menu.
function ouvrirReveil() {
  const profil = profilActif();
  const texte = texteReveilBonjour(profil);
  document.getElementById("reveil-emoji").textContent = anniversaireAujourdhui(profil.naissance) ? "🎂" : "☀️";
  document.getElementById("reveil-bonjour-texte").textContent = texte;
  afficherEcran("screen-reveil-bonjour");
  dire(texte);
}

function etapeReveilDormi() {
  document.getElementById("reveil-dormi-texte").textContent = TEXTE_REVEIL_DORMI;
  afficherEcran("screen-reveil-dormi");
  dire(TEXTE_REVEIL_DORMI);
}

const EMOJI_HUMEUR = [
  { id: "malade", emoji: "🤒", texte: "Malade" },
  { id: "fatigue", emoji: "😴", texte: "Fatigué·e" },
  { id: "pleine-forme", emoji: "💪", texte: "En pleine forme" },
  { id: "normal", emoji: "🙂", texte: "Normal" },
  { id: "triste", emoji: "😢", texte: "Triste" },
  { id: "content", emoji: "😄", texte: "Content·e" },
];
function construireGrilleHumeur() {
  const conteneur = document.getElementById("reveil-humeur-grille");
  conteneur.innerHTML = "";
  EMOJI_HUMEUR.forEach(h => {
    const b = document.createElement("button");
    b.className = "btn-humeur";
    b.innerHTML = `<span class="btn-humeur-emoji">${h.emoji}</span><span class="btn-humeur-texte">${accorderPourEnfant(h.texte)}</span>`;
    b.onclick = () => finReveil(h.id);
    conteneur.appendChild(b);
  });
}
// `bienDormi` vient du tap précédent (oui/non), pas encore enregistré à
// ce stade (cf. wiring de btn-dormi-oui/non plus bas) — stocké ici plutôt
// que dans une fonction dédiée, pour éviter un aller-retour localStorage
// en plus par étape.
function etapeReveilHumeur(bienDormi) {
  const etat = chargerEtat();
  etat.reveil.bienDormi = bienDormi;
  sauverEtat(etat);
  document.getElementById("reveil-humeur-texte").textContent = TEXTE_REVEIL_HUMEUR;
  construireGrilleHumeur();
  afficherEcran("screen-reveil-humeur");
  dire(TEXTE_REVEIL_HUMEUR);
}

// `humeurId` : un des `id` de EMOJI_HUMEUR, choisi par le bouton tapé
// dans `construireGrilleHumeur()`. Stocké dans `etat.reveil` (jour
// courant) puis, au changement de jour, recopié dans `cle("historique")`
// par `archiverJournee()` — pas d'écran dédié pour le consulter encore,
// juste le stockage (même approche que l'a été l'historique au départ).
function finReveil(humeurId) {
  const etat = chargerEtat();
  etat.reveil.humeur = humeurId;
  etat.reveilFait = true;
  sauverEtat(etat);
  construireMenu();
}

// Fin de journée, après « Aller se coucher » : ni coffre ni confettis, pour
// un coucher calme. Les étoiles du jour sont mises de côté et attendent le
// lendemain matin (carte « Ce matin », cf. construireCarteMatin()).
function allerDormir() {
  const etat = chargerEtat();
  mettreDeCoteEtoiles(etat);
  sauverEtat(etat);
  endormir();
  dire(texteFinJournee(profilActif()));
}

// Écran coffre : partagé entre la récompense de fin de journée (étoiles),
// la récompense d'une aventure (pièce, cf. `terminerAventure`) et
// désormais l'étoile d'une routine (cf. `ouvrirCoffreRoutine`) — même
// geste d'ouverture, seuls le texte, l'emoji révélé et la monnaie des
// confettis changent. `retour` est appelé quand le bouton "Terminé !"
// est pressé (pas toujours la même destination selon d'où vient la
// récompense).
//
// `avantOuverture` (optionnel) : pour une routine, le coffre arrive
// VERROUILLÉ — mais reste visuellement LE MÊME COFFRE (#coffre-emoji,
// toujours 🎁, jamais remplacé par un cadenas ou une autre icône :
// l'enfant doit voir un coffre à ouvrir, pas un symbole abstrait), juste
// rendu tapable (`.coffre-fermable`, respire doucement pour inviter le
// tap) avec le badge "FERMÉ". C'est ce tap (cf. `ouvrirCadenasCoffre`),
// PAS l'arrivée sur cet écran, qui appelle `avantOuverture()` : c'est ce
// moment-là, pas la validation du parent qui précède, qui doit vraiment
// donner l'étoile. `avantOuverture` doit mettre à jour l'état ET
// renseigner `#coffre-texte`/`#coffre-recompense-texte`, puis renvoyer
// `{ texteVoix, symbolesConfettis, emojiRevele }` — `emojiRevele` (ex.
// "⭐") remplace le 🎁 au moment de l'ouverture, pour que ce soit
// l'étoile (ou la pièce, cf. `terminerAventure`) elle-même qui
// apparaisse, pas un cadeau générique. Sans `avantOuverture` (fin de
// journée seulement, désormais) : comportement inchangé, ouverture
// immédiate, 🎁 reste 🎁 — pas de parent qui vient de taper un code
// juste avant dans ce cas, contrairement à une routine ou une aventure
// (cf. TODO.md, point resté ouvert : faut-il aligner aussi celle-là ?).
let coffreRetour = null;
let coffreAvantOuverture = null;
function ouvrirCoffre(texteVoix, symbolesConfettis, retour, avantOuverture) {
  coffreRetour = retour;
  document.getElementById("coffre-titre").textContent = "Bravo " + profilActif().prenom + " !";
  afficherEcran("screen-coffre");
  const emoji = document.getElementById("coffre-emoji");
  emoji.textContent = "🎁";
  emoji.classList.remove("pop-ouverture");
  emoji.classList.toggle("coffre-fermable", !!avantOuverture);
  document.getElementById("coffre-statut").classList.toggle("hidden", !avantOuverture);
  document.getElementById("coffre-recompense").classList.toggle("hidden", !!avantOuverture);
  if (avantOuverture) {
    coffreAvantOuverture = avantOuverture;
    document.getElementById("coffre-texte").textContent = "Le coffre est déverrouillé. Appuie dessus pour l'ouvrir !";
    dire("Le coffre est déverrouillé. Appuie dessus pour l'ouvrir !");
    return;
  }
  jouerOuvertureCoffre(texteVoix, symbolesConfettis, "🎁");
}

function jouerOuvertureCoffre(texteVoix, symbolesConfettis, emojiRevele) {
  dire(texteVoix);
  jouerSon();
  if (navigator.vibrate) navigator.vibrate([40, 60, 40]);
  const emoji = document.getElementById("coffre-emoji");
  // La pièce sort du coffre en tournant sur elle-même.
  if (emojiRevele === "pièce") emoji.replaceChildren(elementPiece(6, { tourne: true, pose: "rotateY(-30deg) rotateX(8deg)" }));
  else emoji.textContent = emojiRevele;
  emoji.classList.remove("pop-ouverture"); void emoji.offsetWidth; emoji.classList.add("pop-ouverture");
  lancerConfettis(symbolesConfettis);
}

// Tap sur #coffre-emoji (tapable seulement si `ouvrirCoffre()` a reçu un
// `avantOuverture`, cf. `.coffre-fermable` plus haut — sans quoi ce tap
// ne fait rien, ex. sur le coffre déjà ouvert de fin de journée) : c'est
// ICI, pas avant, que la récompense est vraiment donnée (ex. étoile de
// routine), et que 🎁 devient l'étoile elle-même.
function ouvrirCadenasCoffre() {
  if (!coffreAvantOuverture) return;
  const { texteVoix, symbolesConfettis, emojiRevele } = coffreAvantOuverture();
  coffreAvantOuverture = null;
  document.getElementById("coffre-emoji").classList.remove("coffre-fermable");
  document.getElementById("coffre-statut").classList.add("hidden");
  document.getElementById("coffre-recompense").classList.remove("hidden");
  jouerOuvertureCoffre(texteVoix, symbolesConfettis, emojiRevele);
}

// petite volée de particules qui s'envolent à l'ouverture de la
// récompense — purement décoratif, respecte prefers-reduced-motion
function lancerConfettis(symboles) {
  const zone = document.getElementById("coffre-particules");
  zone.innerHTML = "";
  symboles.forEach((s, i) => {
    const p = document.createElement("span");
    p.className = "confetti";
    p.textContent = s;
    const angle = (i / symboles.length) * 360 + (Math.random() * 30 - 15);
    const distance = 70 + Math.random() * 30;
    p.style.setProperty("--dx", (Math.cos(angle * Math.PI / 180) * distance) + "px");
    p.style.setProperty("--dy", (Math.sin(angle * Math.PI / 180) * distance) + "px");
    p.style.animationDelay = (i * 40) + "ms";
    zone.appendChild(p);
  });
}

// Aventure suivante dans le planning du jour — seulement si elle suit
// IMMÉDIATEMENT l'aventure `id` dans `etat.planning`, rien entre les deux
// (sinon un repas ou une routine s'intercale : on rentre bien à la
// maison d'abord, pas droit à la suivante). Sert à personnaliser le
// texte du trajet retour ci-dessous : si un parent enchaîne deux
// activités dans le planning (ex. deux visites à la suite), le trajet
// retour de la première n'est pas un vrai retour à la maison mais un
// aller vers la seconde.
function prochaineAventureSansEscale(id) {
  const etat = chargerEtat();
  const pos = etat.planning.findIndex(it => it.type === "aventure" && it.id === id);
  if (pos === -1) return null;
  const suivant = etat.planning[pos + 1];
  if (!suivant || suivant.type !== "aventure") return null;
  const a = aventureParId(suivant.id);
  // Une activité à la maison qui suit : on rentre bien d'abord.
  return a && a.nature !== "maison" ? a : null;
}

// ---------------------------------------------------------------------
// Trajet + arrivée — alimentés par l'aventure choisie (`aventureActuelleId`)
// et son sens (`sensTrajet`). Pas de minuteur/barre de progression : le
// trajet est un simple temps d'attente, et c'est un parent qui confirme
// "On est arrivés" (bouton -> code, cf. allerValidationArrivee) — pas
// l'enfant tout seul, et pas une horloge. Seules les aventures du
// planning du jour sont atteignables depuis l'écran des sorties.
// ---------------------------------------------------------------------
function allerAuTrajet() {
  const a = aventureParId(aventureActuelleId);
  // Retour qui enchaîne directement sur une autre activité (cf.
  // prochaineAventureSansEscale) : reprend le texte "aller" de CETTE
  // activité-là (déjà écrit pour annoncer qu'on roule vers elle) plutôt
  // que le texte de retour à la maison de l'activité qu'on quitte.
  const prochaine = sensTrajet === "retour" ? prochaineAventureSansEscale(aventureActuelleId) : null;
  const texte = prochaine ? prochaine.texteTrajet
    : sensTrajet === "retour" ? (a.texteTrajetRetour || "On rentre à la maison.")
    : a.texteTrajet;
  memoriserEnCours({ type: "aventure", id: a.id, sens: sensTrajet, etape: "trajet" });
  afficherEcran("screen-trajet");
  document.getElementById("trajet-texte").textContent = texte;
  document.getElementById("scene-trajet").classList.toggle("retour", sensTrajet === "retour");
  // À vélo ou à pied : la fenêtre de voiture n'a pas de sens, un grand
  // pictogramme la remplace en attendant un vrai décor.
  const picto = PICTO_TRANSPORT[(prochaine || a).modeTransport];
  document.getElementById("scene-trajet").classList.toggle("hidden", !!picto);
  const transport = document.getElementById("trajet-transport");
  transport.textContent = picto || "";
  transport.classList.toggle("hidden", !picto);
  dire(texte);
}

function allerAArrivee() {
  const a = aventureParId(aventureActuelleId);
  memoriserEnCours({ type: "aventure", id: a.id, sens: sensTrajet, etape: "arrivee" });
  afficherEcran("screen-arrivee");
  document.getElementById("arrivee-lieu").textContent = a.lieu;
  document.getElementById("arrivee-texte").textContent = a.texteArrivee;

  synchroniserAvatar(chargerEtat());
  const spritePersonne = document.getElementById("sprite-personne");
  if (a.personne) {
    spritePersonne.innerHTML = a.personne.emoji + "<span>" + a.personne.nom + "</span>";
    spritePersonne.classList.remove("hidden");
  } else {
    spritePersonne.classList.add("hidden");
    spritePersonne.innerHTML = "";
  }

  const programme = document.getElementById("arrivee-programme");
  programme.innerHTML = "";
  a.programme.forEach(ligne => {
    const div = document.createElement("div");
    div.className = "ligne-programme";
    div.textContent = ligne;
    programme.appendChild(div);
  });

  dire(a.texteArrivee);
}

// "C'est parti" (côté arrivée) : deux cas bien différents derrière le
// même bouton (#btn-cest-parti). Pour une aventure "praticienne" (a un
// champ `personne`), l'enfant ne pilote plus
// rien à partir d'ici : c'est LA PRATICIENNE qui doit valider avec le
// code pour démarrer la séance (cf. `demarrerSeanceCode()`), garder
// l'appareil le temps de la séance, puis le revalider avec le code pour
// la terminer et noter comment ça s'est passé. Pour les autres aventures
// (magasin, école — pas de praticienne précise), rien ne change :
// `partirEnActivite()` reste tel quel, direct vers le trajet retour.
function terminerVisite() {
  const a = aventureParId(aventureActuelleId);
  if (a.personne) { demarrerSeanceCode(); return; }
  partirEnActivite();
}

// "C'est parti" ne termine pas l'aventure tout de suite : on repart
// d'abord vers la maison (trajet retour), et c'est cette arrivée-là, une
// fois validée par un parent, qui déclenche la récompense (cf.
// allerValidationArrivee).
function partirEnActivite() {
  sensTrajet = "retour";
  allerAuTrajet();
}

// Code parent détourné ici pour la praticienne : même pavé numérique que
// partout ailleurs (cf. `apresCodeValide`), mais c'est elle qui le
// connaît/le tape, pas un parent au sens propre — le texte le dit
// explicitement pour ne pas laisser croire à l'enfant qu'il doit ou peut
// le faire lui-même.
function demarrerSeanceCode() {
  ecranAvantValidation = document.querySelector(".screen.active").id;
  const a = aventureParId(aventureActuelleId);
  codeSaisi = "";
  modeCode = "verifier";
  document.getElementById("validation-sous-titre").textContent =
    "La praticienne entre le code pour commencer la séance.";
  document.getElementById("correction-wrap").classList.add("hidden");
  document.getElementById("pavecode-wrap").classList.remove("hidden");
  document.getElementById("pavecode-erreur").textContent = "";
  construireClavier(document.getElementById("pavecode-clavier"), appuyerTouche);
  majCasesCode(document.getElementById("pavecode-cases"), codeSaisi);
  apresCodeValide = () => demarrerSeance(a);
  afficherEcran("screen-validation");
}

// Séance en cours (screen-seance) : volontairement minimal, rien à faire
// ni pour l'enfant ni pour la praticienne avant la fin — juste le bouton
// "Terminer la séance", pour elle, quand c'est fini. C'est elle qui garde
// l'appareil jusque-là (cf. commentaire de `terminerVisite()`).
function demarrerSeance(a) {
  memoriserEnCours({ type: "aventure", id: a.id, sens: sensTrajet, etape: "seance" });
  document.getElementById("seance-titre").textContent = a.lieu;
  document.getElementById("seance-emoji").textContent = a.personne.emoji;
  const texte = "Séance avec " + a.personne.nom + " en cours.";
  document.getElementById("seance-texte").textContent = texte;
  dire(texte);
  afficherEcran("screen-seance");
}

// Tap sur "Terminer la séance" : redemande le code (c'est bien la
// praticienne qui clôt la séance, pas l'enfant qui aurait pu ramasser
// l'appareil resté sur la table) avant de montrer le formulaire de note.
function terminerSeanceCode() {
  ecranAvantValidation = document.querySelector(".screen.active").id;
  codeSaisi = "";
  modeCode = "verifier";
  document.getElementById("validation-sous-titre").textContent =
    "La praticienne entre le code pour terminer la séance.";
  document.getElementById("correction-wrap").classList.add("hidden");
  document.getElementById("pavecode-wrap").classList.remove("hidden");
  document.getElementById("pavecode-erreur").textContent = "";
  construireClavier(document.getElementById("pavecode-clavier"), appuyerTouche);
  majCasesCode(document.getElementById("pavecode-cases"), codeSaisi);
  apresCodeValide = () => ouvrirNoteSeance();
  afficherEcran("screen-validation");
}

// Note de séance (screen-seance-note) : à destination des parents,
// jamais affichée à l'enfant (cf. `texteSeancesHistorique()`) — la note
// (1 à 5 étoiles) est obligatoire pour valider, l'appréciation écrite
// reste optionnelle. Le formulaire n'apparaît qu'APRÈS le code (cf.
// `terminerSeanceCode()`), jamais avant : rien de saisi ne peut se perdre
// sur un code refusé, il n'y a simplement pas encore de formulaire à ce
// moment-là.
let noteSeanceChoisie = 0;
function ouvrirNoteSeance() {
  noteSeanceChoisie = 0;
  document.getElementById("seance-appreciation").value = "";
  document.getElementById("seance-note-erreur").textContent = "";
  construireEtoilesNoteSeance();
  afficherEcran("screen-seance-note");
}

function construireEtoilesNoteSeance() {
  const conteneur = document.getElementById("seance-note-etoiles");
  conteneur.innerHTML = "";
  for (let i = 1; i <= 5; i++) {
    const b = document.createElement("button");
    b.className = "etoile-note-btn" + (i <= noteSeanceChoisie ? " choisie" : "");
    b.textContent = "⭐";
    b.setAttribute("aria-label", i + " étoile" + (i > 1 ? "s" : ""));
    b.onclick = () => { noteSeanceChoisie = i; construireEtoilesNoteSeance(); };
    conteneur.appendChild(b);
  }
}

// Enregistre la séance dans `etat.seances` (cf. `archiverJournee()` pour
// pourquoi ça survit au changement de jour comme le reste de
// l'historique) puis enchaîne sur le trajet retour, exactement comme
// `partirEnActivite()` pour une aventure sans praticienne — la séance
// elle-même est terminée, il ne reste que le retour à la maison.
function validerSeance() {
  if (noteSeanceChoisie === 0) {
    document.getElementById("seance-note-erreur").textContent = "Choisis une note avant de valider.";
    return;
  }
  const a = aventureParId(aventureActuelleId);
  const etat = chargerEtat();
  if (!Array.isArray(etat.seances)) etat.seances = [];
  etat.seances.push({
    aventureId: a.id,
    lieu: a.lieu,
    personne: a.personne ? a.personne.nom : null,
    note: noteSeanceChoisie,
    appreciation: document.getElementById("seance-appreciation").value.trim(),
  });
  sauverEtat(etat);
  dire("Note enregistrée.");
  sensTrajet = "retour";
  allerAuTrajet();
}

// Bouton "On est arrivés" du trajet (aller ou retour) : rien ne se passe
// tant qu'un parent n'a pas confirmé avec le code — même logique que la
// validation d'une routine, mais sans étape de correction (rien à
// décocher pour une simple confirmation d'arrivée).
function allerValidationArrivee() {
  ecranAvantValidation = document.querySelector(".screen.active").id;
  const a = aventureParId(aventureActuelleId);
  codeSaisi = "";
  modeCode = "verifier";
  const prochaine = sensTrajet === "retour" ? prochaineAventureSansEscale(aventureActuelleId) : null;
  const lieu = prochaine ? prochaine.lieu : (sensTrajet === "retour" ? "la maison" : a.lieu);
  document.getElementById("validation-sous-titre").textContent =
    "Un parent entre le code pour confirmer l'arrivée : « " + lieu + " ».";
  document.getElementById("correction-wrap").classList.add("hidden");
  document.getElementById("pavecode-wrap").classList.remove("hidden");
  document.getElementById("pavecode-erreur").textContent = "";
  construireClavier(document.getElementById("pavecode-clavier"), appuyerTouche);
  majCasesCode(document.getElementById("pavecode-cases"), codeSaisi);
  apresCodeValide = sensTrajet === "retour" ? () => terminerAventure(a) : () => allerAArrivee();
  afficherEcran("screen-validation");
}

// Fin d'une aventure (une fois l'arrivée à la maison confirmée). Sans
// récompense propre (une visite chez une praticienne, typiquement) :
// retour direct au menu. Avec récompense (`recompensePieces` > 0) :
// même principe "parent déverrouille, enfant ouvre" que
// `ouvrirCoffreRoutine()` — le code parent qu'on vient de taper pour
// confirmer l'arrivée tient lieu de déverrouillage, mais la pièce n'est
// donnée (`ajouterPieces()`) que quand l'enfant tape lui-même le coffre
// (cf. `avantOuverture` dans `ouvrirCoffre()`/`ouvrirCadenasCoffre()`).
function terminerAventure(a) {
  aventureActuelleId = null;
  const etat = chargerEtat();
  marquerItemFait(etat, "aventure", a.id);
  sauverEtat(etat);
  if (a.recompensePieces > 0) {
    ouvrirCoffre(null, null, () => construireMenu(), () => {
      const total = ajouterPieces(a.recompensePieces);
      const prenom = profilActif().prenom;
      document.getElementById("coffre-texte").textContent = "Bravo " + prenom + ", tu as fait : " + a.lieu + " !";
      document.getElementById("coffre-recompense-texte").replaceChildren(
        "+ " + a.recompensePieces + " ", elementPiece(1), " (" + total + " au total)");
      return { texteVoix: "Bravo " + prenom + ", tu as gagné une pièce !", symbolesConfettis: ["✨", "⭐", "🎉", "✨", "⭐"], emojiRevele: "pièce" };
    });
    return;
  }
  construireMenu();
}

function reinitialiserTout() {
  try { localStorage.removeItem(cle("journee")); } catch (e) {}
  derniereEtapeAnnoncee = null;
  routineActuelleId = null;
  construireMenu();
}

// Reset protégé par appui long (~900ms) : un tap accidentel ne doit jamais
// effacer la progression du jour. Remplit visuellement le bouton pendant
// l'appui pour que l'intention soit claire avant que ça se déclenche.
function protegerParAppuiLong(bouton, action, duree = 900) {
  let minuteur = null;
  const annuler = () => { clearTimeout(minuteur); minuteur = null; bouton.classList.remove("maintien"); };
  const demarrer = (ev) => {
    ev.preventDefault();
    bouton.classList.add("maintien");
    minuteur = setTimeout(() => {
      annuler();
      if (navigator.vibrate) navigator.vibrate(60);
      action();
    }, duree);
  };
  bouton.addEventListener("pointerdown", demarrer);
  ["pointerup", "pointercancel", "pointerleave"].forEach(ev => bouton.addEventListener(ev, annuler));
}

// ---------------------------------------------------------------------
// Panneau debug (cf. modeDebugActif() en tête de fichier). Les listes de
// routines/aventures sont reconstruites à chaque ouverture (pas une
// seule fois au chargement) pour refléter une activité/routine créée
// entre-temps par un parent (cf. toutesLesRoutines()/toutesLesAventures()).
// ---------------------------------------------------------------------

// Enveloppe une action de navigation du panneau : l'exécute puis referme
// le panneau, pour que l'écran visé (dessous, plein écran lui aussi)
// redevienne visible immédiatement — sinon le panneau resterait au-dessus.
// Pas utilisé pour les actions qui restent DANS le panneau (horloge de
// test, fermeture).
function puisFermerDebug(action) {
  return () => { action(); document.getElementById("debug-panel").classList.add("hidden"); };
}

function boutonDebug(texte, action) {
  const b = document.createElement("button");
  b.className = "btn-debug-item";
  b.textContent = texte;
  b.onclick = action;
  return b;
}

function construireDebug() {
  document.getElementById("debug-code-parent").textContent = codeParentActuel();
  document.getElementById("debug-profil-valeur").textContent = profilActif().prenom;
  const boutonsProfil = document.getElementById("debug-profils");
  boutonsProfil.innerHTML = "";
  Object.values(PROFILS).forEach(p => {
    if (p.id === profilActifId()) return; // déjà actif, rien à proposer
    boutonsProfil.appendChild(boutonDebug("👤 Passer à " + p.prenom, () => changerProfilAppareil(p.id)));
  });
  majAffichageHeureDebug();

  const routines = document.getElementById("debug-routines");
  routines.innerHTML = "";
  toutesLesRoutines().forEach(r => {
    routines.appendChild(boutonDebug("▶️ " + r.nom, puisFermerDebug(() => demarrerRoutine(r.id))));
    routines.appendChild(boutonDebug("🎉 Fin — " + r.nom, puisFermerDebug(() => { routineActuelleId = r.id; finDeRoutine(); })));
    routines.appendChild(boutonDebug("🔑 Valider — " + r.nom, puisFermerDebug(() => { routineActuelleId = r.id; allerValidation(); })));
  });

  const aventures = document.getElementById("debug-aventures");
  aventures.innerHTML = "";
  toutesLesAventures().forEach(a => {
    if (a.nature === "maison") {
      aventures.appendChild(boutonDebug("🏠 Activité — " + a.lieu, puisFermerDebug(() => ouvrirActiviteMaison(a, Date.now()))));
      return;
    }
    aventures.appendChild(boutonDebug("🚗 Trajet — " + a.lieu, puisFermerDebug(() => { aventureActuelleId = a.id; sensTrajet = "aller"; allerAuTrajet(); })));
    aventures.appendChild(boutonDebug("📍 Arrivée — " + a.lieu, puisFermerDebug(() => { aventureActuelleId = a.id; allerAArrivee(); })));
    if (a.personne) {
      aventures.appendChild(boutonDebug("🧑‍⚕️ Séance — " + a.lieu, puisFermerDebug(() => { aventureActuelleId = a.id; demarrerSeance(a); })));
      aventures.appendChild(boutonDebug("📝 Note de séance — " + a.lieu, puisFermerDebug(() => { aventureActuelleId = a.id; ouvrirNoteSeance(); })));
    }
  });
}

// Affiche juste l'heure ("18h05") si la date simulée reste le jour réel
// en cours, ou date + heure ("1 sept. 07h00") une fois minuit passé —
// sinon un saut de jour (ex. après avoir simulé le coucher, cf.
// `endormir()`) resterait invisible dans le panneau.
function majAffichageHeureDebug() {
  const el = document.getElementById("debug-heure-valeur");
  if (dateDebugForcee === null) { el.textContent = "réelle"; return; }
  const heure = dateDebugForcee.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const memeJour = dateDebugForcee.toDateString() === new Date().toDateString();
  el.textContent = memeJour ? heure : dateDebugForcee.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) + " " + heure;
}

function ajusterHeureDebug(delta) {
  dateDebugForcee = new Date(dateActuelle().getTime() + delta * 3600000);
  majAffichageHeureDebug();
  tickHorloge();
}

function reinitialiserHeureDebug() {
  dateDebugForcee = null;
  majAffichageHeureDebug();
  tickHorloge();
}

function toggleDebug() {
  const panneau = document.getElementById("debug-panel");
  const ouverture = panneau.classList.contains("hidden");
  if (ouverture) construireDebug();
  panneau.classList.toggle("hidden", !ouverture);
}

// ---------------------------------------------------------------------
// Horloge du menu — jour + heure, purement informatif (repère pour
// l'enfant/le parent, ne pilote aucune logique). Mise à jour même quand
// le menu n'est pas l'écran actif : coût négligeable, évite d'avoir à
// se souvenir de la relancer à chaque retour au menu.
// ---------------------------------------------------------------------
function majHorloge() {
  const el = document.getElementById("horloge");
  if (!el) return;
  const maintenant = dateActuelle();
  const jour = maintenant.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  const heure = maintenant.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  // 🧪 en préfixe quand l'heure est simulée (cf. dateDebugForcee) — pour
  // ne jamais laisser croire, y compris à qui teste, que c'est l'heure réelle.
  el.textContent = (dateDebugForcee !== null ? "🧪 " : "") + jour.charAt(0).toUpperCase() + jour.slice(1) + " — " + heure;
}
// `majHorloge()` reste à usage unique (juste le texte de l'horloge) ;
// c'est ce wrapper qui profite du même tick pour garder le repère
// "maintenant/ensuite" de "Ma journée" à jour pendant qu'elle est
// ouverte — coupé en mode édition pour ne pas effacer sous la main d'un
// parent un `<input type="time">` en cours de saisie (cf.
// definirHeureItemPlanning/construireJournee).
function tickHorloge() {
  majHorloge();
  const ecranJournee = document.getElementById("screen-journee");
  if (!journeeEnEdition && ecranJournee && ecranJournee.classList.contains("active")) construireJournee();
  // Liste du jour ouverte : le coucher se déverrouille tout seul à son
  // heure — sauf pendant la lecture de la journée, qui allume les cartes.
  // Jamais au tout premier tick (avant demarrer()) : seulement une liste
  // déjà construite.
  const ecranMenu = document.getElementById("screen-menu");
  if (listeJourConstruite && ecranMenu.classList.contains("active") && !lectureJourneeEnCours()) construireListeJour(chargerEtat());
}
tickHorloge();
setInterval(tickHorloge, 15000);

// ---------------------------------------------------------------------
// Câblage des boutons + démarrage
// ---------------------------------------------------------------------
installerEcoute();
installerPiecesInline();
document.getElementById("btn-retour-routine").onclick = retourMenuDepuisRoutine;
document.getElementById("btn-voix-routine").onclick = () => dire(document.getElementById("etape-courante").textContent);
document.getElementById("btn-retour-dents").onclick = quitterBrossageDents;
document.getElementById("btn-pause-dents").onclick = toggleDentsPause;
document.getElementById("btn-retour-histoire").onclick = quitterHistoire;
document.getElementById("btn-voix-histoire").onclick = () => dire(document.getElementById("histoire-texte").textContent);
document.getElementById("btn-fini-histoire").onclick = finHistoire;
document.getElementById("btn-minuteur-widget-aide").onclick = demanderAideMinuteurTache;
document.getElementById("btn-minuteur-routine-aide").onclick = demanderAideMinuteurRoutine;
document.getElementById("btn-minuteur-verif-non").onclick = () => repondreVerificationMinuteur(false);
document.getElementById("btn-minuteur-verif-oui").onclick = () => repondreVerificationMinuteur(true);
document.getElementById("btn-minuteur-bloque-code").onclick = debloquerMinuteurAvecCode;
document.getElementById("btn-voix-coffre").onclick = () => dire(document.getElementById("coffre-texte").textContent);
document.getElementById("btn-voix-trajet").onclick = () => dire(document.getElementById("trajet-texte").textContent + suiteApres());
document.getElementById("btn-voix-arrivee").onclick = () => dire(document.getElementById("arrivee-texte").textContent + suiteApres());
document.getElementById("btn-voix-reveil-bonjour").onclick = () => dire(document.getElementById("reveil-bonjour-texte").textContent);
document.getElementById("btn-voix-reveil-dormi").onclick = () => dire(document.getElementById("reveil-dormi-texte").textContent);
document.getElementById("btn-voix-reveil-humeur").onclick = () => dire(document.getElementById("reveil-humeur-texte").textContent);
document.getElementById("btn-accueil-1").onclick = etapeAccueil2;
document.getElementById("btn-accueil-2").onclick = etapeAccueil3;
document.getElementById("btn-accueil-3").onclick = () => ouvrirPremiereConfiguration(accueilEstAjout);
document.getElementById("btn-voix-accueil-1").onclick = () => dire(document.getElementById("accueil-1-texte").textContent);
document.getElementById("btn-voix-accueil-2").onclick = () => dire(document.getElementById("accueil-2-texte").textContent);
document.getElementById("btn-voix-accueil-3").onclick = () => dire(document.getElementById("accueil-3-texte").textContent);

protegerParAppuiLong(document.getElementById("btn-reset-test"), reinitialiserTout);

document.getElementById("btn-exporter-donnees").onclick = exporterDonneesAppareil;
document.getElementById("btn-restaurer-choisir").onclick = () => document.getElementById("input-restaurer").click();
document.getElementById("input-restaurer").onchange = (ev) => {
  const fichier = ev.target.files[0];
  if (fichier) importerDonneesAppareil(fichier);
};

document.getElementById("btn-un-parent").onclick = () => (suiteBravo || allerValidation)();
document.getElementById("btn-maison-fini").onclick = finActiviteMaison;
document.getElementById("btn-choix-valider").onclick = validerChoix;
document.getElementById("btn-retour-choix").onclick = () => { choixEnCours = null; construireMenu(); };
document.getElementById("btn-voix-choix").onclick = () => { if (choixEnCours) dire(phraseChoix(optionsDuChoix(choixEnCours.index))); };
document.getElementById("btn-retour-maison").onclick = () => { arreterMinuteurMaison(); aventureActuelleId = null; construireMenu(); };
document.getElementById("btn-voix-maison").onclick = () => dire(document.getElementById("maison-consigne").textContent + suiteApres());
document.getElementById("btn-valider-routine").onclick = () => { if (actionCorrection) actionCorrection(); };
// Retour discret : ramène à l'écran actif juste avant l'ouverture de
// screen-validation (cf. ecranAvantValidation, capturé à chacune de ses
// 5 entrées) — rien n'est perdu, aucune des 5 entrées ne modifie l'état
// avant que le code soit validé (sauf décocher/recocher en relecture,
// qui reste tel quel, cf. construireCorrection()).
document.getElementById("btn-retour-validation").onclick = () => afficherEcran(ecranAvantValidation || "screen-menu");

document.getElementById("btn-retour-menu").onclick = construireMenu;

// Un jour à venir ou de la semaine type s'ouvre depuis l'écran Planning : on
// y revient, plutôt que de sauter au menu de l'enfant.
document.getElementById("btn-retour-menu-journee").onclick = () => {
  ajoutEnLigne = null;
  if (planningCibleEstAujourdhui()) { construireMenu(); return; }
  construireParentPlanningJournees();
  afficherEcran("screen-parent-planning-journees");
};
document.getElementById("btn-modifier-journee").onclick = basculerEditionJournee;

document.getElementById("btn-mes-recompenses").onclick = () => ouvrirChemin();
document.getElementById("btn-retour-chemin").onclick = () => { feteChemin = null; construireMenu(); };
document.getElementById("btn-voix-chemin").onclick = () => dire(feteChemin ? feteChemin.titre : phraseChemin(chargerChemin(), chargerPiecesAPoser()));
window.addEventListener("resize", () => { if (document.getElementById("screen-chemin").classList.contains("active")) ajusterZoneChemin(); });

document.getElementById("btn-espace-parent").onclick = ouvrirEspaceParent;
document.getElementById("btn-retour-parent-chemin").onclick = () => { recompenseEnEdition = null; brouillonRecompense = null; construireEspaceParent(); afficherEcran("screen-parent"); };
document.getElementById("btn-retour-menu-parent").onclick = construireMenu;
document.getElementById("btn-retour-parent-routines").onclick = () => { construireEspaceParent(); afficherEcran("screen-parent"); };
document.getElementById("btn-retour-parent-historique").onclick = () => { construireEspaceParent(); afficherEcran("screen-parent"); };
document.getElementById("btn-retour-parent-seances").onclick = () => { construireEspaceParent(); afficherEcran("screen-parent"); };

document.getElementById("na-nom").addEventListener("blur", suggererTextesActivite);
document.getElementById("na-emoji-trigger").onclick = () =>
  ouvrirSelecteurEmoji(EMOJI_ACTIVITE, emojiChoisiActivite, (e) => { emojiChoisiActivite = e; construireDeclencheurEmoji("na-emoji-trigger", e); });
document.getElementById("btn-creer-aventure").onclick = creerNouvelleAventure;
document.getElementById("btn-retour-parent-nouvelle-aventure").onclick = quitterFormulaireActivite;

document.getElementById("btn-nouvelle-activite").onclick = () => ouvrirNouvelleAventure();
document.getElementById("btn-retour-parent-activites").onclick = () => { construireEspaceParent(); afficherEcran("screen-parent"); };

document.getElementById("btn-nouvelle-routine").onclick = ouvrirNouvelleRoutine;
document.getElementById("btn-retour-parent-routines-catalogue").onclick = () => { construireEspaceParent(); afficherEcran("screen-parent"); };
document.getElementById("nr-emoji-trigger").onclick = () =>
  ouvrirSelecteurEmoji(EMOJI_ROUTINE, emojiChoisiRoutine, (e) => { emojiChoisiRoutine = e; construireDeclencheurEmoji("nr-emoji-trigger", e); });
document.getElementById("nr-lieu-chambre").onclick = () => choisirLieuRoutine("chambre");
document.getElementById("nr-lieu-salon").onclick = () => choisirLieuRoutine("salon");
document.getElementById("nr-style-jauge").onclick = () => choisirStyleMinuteur("jauge");
document.getElementById("nr-style-cadran").onclick = () => choisirStyleMinuteur("cadran");
document.getElementById("btn-creer-routine").onclick = creerNouvelleRoutine;
for (let i = 1; i <= 5; i++) {
  document.getElementById("nr-t" + i + "-minuteur-toggle").onclick = () => toggleChampsMinuteurRoutine(i);
}
document.getElementById("nr-global-minuteur-toggle").onclick = toggleChampsMinuteurGlobal;
document.getElementById("btn-retour-parent-nouvelle-routine").onclick = () => { routineEnEditionId = null; construireRoutinesCatalogue(); afficherEcran("screen-parent-routines-catalogue"); };

document.getElementById("btn-nouvelle-personne").onclick = ouvrirNouvellePersonne;
document.getElementById("btn-retour-parent-entourage").onclick = () => { construireEspaceParent(); afficherEcran("screen-parent"); };
document.getElementById("btn-retour-parent-planning-journees").onclick = () => { construireEspaceParent(); afficherEcran("screen-parent"); };
document.getElementById("btn-onglet-semaine").onclick = () => { ongletPlanning = "semaine"; construireParentPlanningJournees(); };
document.getElementById("btn-onglet-jours").onclick = () => { ongletPlanning = "jours"; construireParentPlanningJournees(); };
document.getElementById("np-emoji-trigger").onclick = () =>
  ouvrirSelecteurEmoji(EMOJI_PERSONNE, emojiChoisiPersonne, (e) => { emojiChoisiPersonne = e; construireDeclencheurEmoji("np-emoji-trigger", e); });
document.getElementById("btn-creer-personne").onclick = creerNouvellePersonne;
document.getElementById("btn-retour-parent-nouvelle-personne").onclick = () => { personneEnEditionId = null; construireParentEntourage(); afficherEcran("screen-parent-entourage"); };

// Sélecteur d'emoji partagé (cf. ouvrirSelecteurEmoji) : recherche live à
// chaque frappe, fermeture par le ✕ sans rien choisir (emojiPickerOnChoix
// remis à null, cf. fermerSelecteurEmoji) — l'icône du formulaire reste
// celle d'avant l'ouverture.
document.getElementById("emoji-picker-recherche").addEventListener("input", (e) => construireGrilleSelecteurEmoji(e.target.value));
document.getElementById("btn-emoji-picker-fermer").onclick = fermerSelecteurEmoji;

document.getElementById("btn-retour-parent-appareil").onclick = () => { construireEspaceParent(); afficherEcran("screen-parent"); };
document.getElementById("btn-nouvel-enfant").onclick = ouvrirNouveauProfilDepuisAppareil;

// Vers "Cet appareil" si on vient de l'espace parent ("+ Nouvel
// enfant"), vers le dernier écran de l'accueil sinon (tout premier
// lancement) — cf. commentaire sur `premiereConfigEstAjout`.
document.getElementById("btn-retour-premiere-configuration").onclick = () => {
  if (premiereConfigEstAjout) { construireParentAppareil(); afficherEcran("screen-parent-appareil"); }
  else { etapeAccueil3(); }
};
document.getElementById("btn-continuer-premiere-configuration").onclick = validerPremiereConfiguration;
document.getElementById("pc-genre-garcon").onclick = () => choisirGenreInitial("garcon");
document.getElementById("pc-genre-fille").onclick = () => choisirGenreInitial("fille");

// Le bouton "Terminé !" du coffre ne va pas toujours au même endroit
// (fin de journée vs retour d'aventure) : `coffreRetour` est fixé par
// `ouvrirCoffre()` juste avant l'ouverture de l'écran.
document.getElementById("btn-continuer-coffre").onclick = () => { if (coffreRetour) coffreRetour(); };
document.getElementById("coffre-emoji").onclick = ouvrirCadenasCoffre;
document.getElementById("btn-arrive").onclick = allerValidationArrivee;
document.getElementById("btn-cest-parti").onclick = terminerVisite;
document.getElementById("btn-terminer-seance").onclick = terminerSeanceCode;
document.getElementById("btn-valider-seance").onclick = validerSeance;

// Tap sur l'écran dodo : n'agit que si l'heure est passée (cf.
// `ouvrirReveil`/`demarrer`) — avant ça, `dortEncore()` garde l'écran
// volontairement inerte, seul le bypass parental (⚙️, hors des .screen)
// reste atteignable.
document.getElementById("screen-dodo").onclick = () => { if (!dortEncore()) ouvrirReveil(); };
document.getElementById("btn-reveil-bonjour").onclick = etapeReveilDormi;
document.getElementById("btn-dormi-oui").onclick = () => etapeReveilHumeur(true);
document.getElementById("btn-dormi-non").onclick = () => etapeReveilHumeur(false);

// Panneau debug (cf. modeDebugActif() en tête de fichier) : masqué par
// défaut (classe .hidden posée dans index.html), révélé ici seulement si
// activé sur CET appareil/navigateur.
document.getElementById("btn-debug").onclick = toggleDebug;
document.getElementById("btn-debug-fermer").onclick = toggleDebug;
document.getElementById("btn-debug-heure-moins").onclick = () => ajusterHeureDebug(-1);
document.getElementById("btn-debug-heure-plus").onclick = () => ajusterHeureDebug(1);
document.getElementById("btn-debug-heure-reelle").onclick = reinitialiserHeureDebug;

document.getElementById("btn-debug-dodo").onclick = puisFermerDebug(() => afficherEcran("screen-dodo"));
document.getElementById("btn-debug-bonjour").onclick = puisFermerDebug(ouvrirReveil);
document.getElementById("btn-debug-dormi").onclick = puisFermerDebug(etapeReveilDormi);
document.getElementById("btn-debug-humeur").onclick = puisFermerDebug(() => etapeReveilHumeur(true));

document.getElementById("btn-debug-menu").onclick = puisFermerDebug(construireMenu);
document.getElementById("btn-debug-missions").onclick = puisFermerDebug(() => { construireMissions(); afficherEcran("screen-missions"); });
document.getElementById("btn-debug-journee").onclick = puisFermerDebug(() => { ciblerAujourdhui(); construireJournee(); afficherEcran("screen-journee"); });
document.getElementById("btn-debug-recompenses").onclick = puisFermerDebug(ouvrirChemin);
document.getElementById("btn-debug-coffre").onclick = puisFermerDebug(allerDormir);

document.getElementById("btn-debug-parent").onclick = puisFermerDebug(() => { construireEspaceParent(); afficherEcran("screen-parent"); });
document.getElementById("btn-debug-parent-routines").onclick = puisFermerDebug(() => { construireParentRoutines(); afficherEcran("screen-parent-routines"); });
document.getElementById("btn-debug-parent-historique").onclick = puisFermerDebug(() => { construireHistorique(); afficherEcran("screen-parent-historique"); });
document.getElementById("btn-debug-parent-seances").onclick = puisFermerDebug(() => { construireParentSeances(); afficherEcran("screen-parent-seances"); });
document.getElementById("btn-debug-parent-activites").onclick = puisFermerDebug(() => { construireParentActivites(); afficherEcran("screen-parent-activites"); });
document.getElementById("btn-debug-parent-routines-catalogue").onclick = puisFermerDebug(() => { construireRoutinesCatalogue(); afficherEcran("screen-parent-routines-catalogue"); });
document.getElementById("btn-debug-parent-entourage").onclick = puisFermerDebug(() => { construireParentEntourage(); afficherEcran("screen-parent-entourage"); });
document.getElementById("btn-debug-parent-planning-journees").onclick = puisFermerDebug(() => { construireParentPlanningJournees(); afficherEcran("screen-parent-planning-journees"); });
document.getElementById("btn-debug-parent-appareil").onclick = puisFermerDebug(() => { construireParentAppareil(); afficherEcran("screen-parent-appareil"); });
document.getElementById("btn-debug-nouvelle-activite").onclick = puisFermerDebug(ouvrirNouvelleAventure);
document.getElementById("btn-debug-nouvelle-routine").onclick = puisFermerDebug(ouvrirNouvelleRoutine);
document.getElementById("btn-debug-nouvelle-personne").onclick = puisFermerDebug(ouvrirNouvellePersonne);
document.getElementById("btn-debug-code-reel").onclick = puisFermerDebug(ouvrirEspaceParent);

document.getElementById("btn-debug-reset").onclick = puisFermerDebug(reinitialiserTout);

document.getElementById("btn-debug").classList.toggle("hidden", !modeDebugActif());
// Outil de test, jamais vu en usage réel (PROD) : même garde que #btn-debug
// ci-dessus, pour ne pas exposer un reset accidentel de la journée.
document.getElementById("btn-reset-test").classList.toggle("hidden", !modeDebugActif());

// Service worker : rend l'app utilisable hors-ligne après un premier
// chargement, indépendamment de la disponibilité d'un serveur particulier
// ensuite (cf. sw.js). Échoue silencieusement sur http:// simple (une IP
// locale par ex.) — les navigateurs n'activent les service workers que
// sur HTTPS ou localhost ; l'app fonctionne quand même, juste sans cache
// hors-ligne dans ce cas.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

// Vérification du minuteur actif (cf. tickMinuteurGlobal() plus haut) —
// tourne en continu dès le chargement, pas seulement pendant une routine,
// pour que la vérification/l'alerte puisse interrompre n'importe quel
// écran. Premier appel immédiat (pas seulement dans 1s) pour éviter
// qu'un minuteur déjà écoulé pendant que l'app était fermée laisse
// passer un instant sur le mauvais écran au rechargement.
tickMinuteurGlobal();
setInterval(tickMinuteurGlobal, 1000);

// point d'entrée : menu de la journée (le réveil, écran 01 du handoff,
// reste sauté pour ce prototype). Filet de sécurité : si quoi que ce
// soit plante ici (ex. un état corrompu malgré `etatRepare()`), on
// repart d'un état neuf plutôt que de laisser un écran vide sans recours
// pour un enfant seul devant la tablette — dernier recours seulement,
// `chargerEtat()` répare déjà les cas courants sans perdre la journée.
(function demarrer() {
  // Atteint uniquement via ?restaurer=1 (jamais montré sans, pour ne
  // jamais exposer ce chemin à un enfant qui tape au hasard) : restaure
  // une sauvegarde avant même le reste du boot, cf. screen-restaurer et
  // importerDonneesAppareil().
  try {
    if (new URLSearchParams(location.search).get("restaurer") === "1") { afficherEcran("screen-restaurer"); return; }
  } catch (e) {}
  // Avant même le filet de sécurité ci-dessous : cet appareil n'a encore
  // aucun profil actif (premier lancement, ou profil jamais choisi) —
  // tout le reste (appliquerProfilAuDom(), chargerEtat()...) suppose un
  // profil réel et plante sinon. Accueil (cf. ouvrirAccueil()) puis écran
  // de première configuration plutôt que le filet de sécurité générique,
  // qui présuppose lui aussi un profil (cf. son propre appel à `cle()`
  // dans le catch plus bas).
  if (!profilActifId()) { ouvrirAccueil(false); return; }
  try {
    // Avant toute chose : calques d'avatar + prénom du profil actif dans
    // le DOM (cf. appliquerProfilAuDom()) — les écrans qui suivent
    // (dodo ou menu) en dépendent déjà (synchroniserAvatar() ne fait que
    // basculer la visibilité de calques qui doivent déjà exister).
    appliquerProfilAuDom();
    migrerDatesUneFois();
    migrerPiecesUneFois();
    // Encore en sommeil (tablette rouverte en pleine nuit) : reste sur
    // l'écran dodo, avant même de toucher à l'état du jour — pas
    // d'interaction possible avant `dortEncore()` == false (cf. `endormir`).
    // Heure passée mais rituel du réveil pas encore fait aujourd'hui (ex.
    // tablette éteinte puis rallumée après l'heure) : même écran dodo,
    // mais tapable cette fois — cf. wiring de `#screen-dodo`.
    if (dortEncore() || !chargerEtat().reveilFait) { afficherEcran("screen-dodo"); return; }
    if (!reprendreEnCours()) construireMenu();
    reprendreDialogueMinuteur();
  } catch (e) {
    try { localStorage.removeItem(cle("journee")); } catch (e2) {}
    construireMenu();
  }
})();
