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
  // `leon_debug` : ancienne clé (avant le support multi-profil), lue en
  // secours pour ne pas redemander `?debug=1` sur un appareil qui l'avait
  // déjà activé — jamais réécrite.
  try { return localStorage.getItem("acolyte_debug") === "1" || localStorage.getItem("leon_debug") === "1"; } catch (e) { return false; }
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
// Première configuration — écran affiché quand cet appareil n'a encore
// AUCUN profil (cf. `demarrer()`, tout en bas du fichier), ou rouvert
// depuis "Cet appareil" ("+ Nouvel enfant") pour ajouter un profil
// supplémentaire sur un appareil déjà configuré. Prénom + avatar ici,
// code parent juste après (réutilise le pavé numérique existant, cf.
// `demarrerCodeInitial()`) — la création réelle du profil n'a lieu
// qu'une fois le code confirmé deux fois, cf. `finaliserPremiereConfiguration()`.
let configInitiale = { prenom: "", genre: "garcon", coupe: "court-net", peau: "p2", cheveux: "n4", yeux: "y1" };
// true seulement quand cet écran est rouvert depuis un appareil déjà
// configuré (bouton retour utile) ; false au tout premier lancement
// (aucun profil, donc aucun écran où revenir — bouton retour caché).
let premiereConfigEstAjout = false;

function ouvrirPremiereConfiguration(estAjout) {
  premiereConfigEstAjout = !!estAjout;
  configInitiale = { prenom: "", genre: "garcon", coupe: "court-net", peau: "p2", cheveux: "n4", yeux: "y1" };
  document.getElementById("pc-prenom").value = "";
  document.getElementById("pc-erreur").textContent = "";
  document.getElementById("btn-retour-premiere-configuration").classList.toggle("hidden", !premiereConfigEstAjout);
  document.getElementById("pc-genre-garcon").classList.add("choisi");
  document.getElementById("pc-genre-fille").classList.remove("choisi");
  construireChoixApparenceInitiale();
  afficherEcran("screen-premiere-configuration");
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
  const profil = { id, prefixe: id, prenom: configInitiale.prenom, dodo, sprites };

  const perso = chargerProfilsPerso();
  perso.push(profil);
  sauverProfilsPerso(perso);
  try { localStorage.setItem("acolyte_enfant", id); } catch (e) {}

  sauverRoutinesPerso(routinesDemarrage(profil.prenom, silhouette).map(r =>
    (r.id === "shabiller" || r.id === "partir") ? Object.assign({ chainee: true }, r) : r
  ));

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
function routinesDemarrage(prenom, silhouette) {
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
      felicitation: "Bravo " + prenom + ", tu t'es habillé·e tout seul·e !",
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
      felicitation: "Bravo " + prenom + ", tu es prêt·e à partir !",
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
      felicitation: "Bravo " + prenom + ", tu es prêt·e à dormir !",
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
// l'arrivée -> "C'est parti"). `date` (même format que `cleJour()`, ex.
// "2026-8-27") sert de filtre pour `aventuresDuJour()` — une aventure
// sans date (ex. une praticienne récurrente) n'apparaît jamais toute
// seule dans les sorties du jour, elle attend d'être reprogrammée
// explicitement le moment venu.
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
// Généralisée pour semer le planning d'une date future (cf.
// planningParDefaut(dateKey) plus bas) — comportement inchangé pour
// aujourd'hui, aventuresDuJour() n'est qu'un raccourci sur la date du jour.
function aventuresPourDate(dateKey) { return toutesLesAventures().filter(a => a.date === dateKey); }
function aventuresDuJour() { return aventuresPourDate(cleJour()); }
// Une aventure est accessible aujourd'hui dans "Partir à l'aventure" si
// et seulement si elle est dans le planning du jour (`etat.planning`) —
// pas directement via son champ `date`, qui ne sert qu'à l'y insérer une
// première fois (cf. `planningParDefaut()`). Ça lie directement les
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

// Planning par défaut d'une journée type (écran "Ma journée") : une
// suite d'items `{ type: "routine"|"aventure"|"repas", id }`, dans
// l'ordre chronologique attendu. Les aventures du jour (`aventuresDuJour()`)
// s'y insèrent à la position indiquée par leur champ `apres` (fin de
// journée si absent). C'est cette liste, recalculée à chaque nouvelle
// journée puis copiée dans `etat.planning`, qui sert de point de départ
// éditable par un parent (cf. `construireJournee()`).
const PLANNING_DEFAUT = [
  { type: "repas", id: "petit-dej" },
  { type: "routine", id: "shabiller" },
  { type: "routine", id: "partir" },
  { type: "repas", id: "dejeuner" },
  { type: "repas", id: "gouter" },
  { type: "repas", id: "diner" },
  { type: "routine", id: "soir" },
];
// `heureDefaut` (REPAS/aventures) n'est copié dans `heure` qu'ICI, au
// moment où une nouvelle journée est semée — ne touche jamais un
// `etat.planning` déjà en cours. `heure` reste ensuite un champ
// d'affichage libre, modifiable/effaçable par un parent (mode édition de
// "Ma journée"), jamais relu par la logique de déblocage des routines.
// `dateKey` optionnel ("YYYY-M-D") : sème le planning par défaut d'une
// date PRÉCISE plutôt que forcément aujourd'hui — utilisé par
// `chargerPlanningCible()` pour une date du planning à venir pas encore
// personnalisée. Comportement inchangé sans argument (= cleJour()).
function planningParDefaut(dateKey) {
  const cible = dateKey || cleJour();
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
  aventuresPourDate(cible).forEach(a => {
    const entree = { type: "aventure", id: a.id };
    if (a.heureDefaut) entree.heure = a.heureDefaut;
    const pos = a.apres ? items.findIndex(it => it.type === a.apres.type && it.id === a.apres.id) : -1;
    if (pos === -1) items.push(entree); else items.splice(pos + 1, 0, entree);
  });
  return items;
}
// Résout un item de planning en `{ emoji, nom }` à afficher — toujours
// dérivé des catalogues (ROUTINES/AVENTURES/REPAS), jamais dupliqué dans
// l'item lui-même, pour rester à jour si la routine/aventure change.
// Renvoie `null` pour une référence orpheline (id qui n'existe plus).
function libelleItemPlanning(item) {
  if (item.type === "routine") { const r = routineParId(item.id); return r ? { emoji: r.emoji, nom: r.nom, entourage: entourageDe(r) } : null; }
  if (item.type === "aventure") { const a = aventureParId(item.id); return a ? { emoji: a.emoji, nom: a.lieu, entourage: entourageDe(a) } : null; }
  if (item.type === "repas") { const r = REPAS.find(x => x.id === item.id); return r ? { emoji: r.emoji, nom: r.nom } : null; }
  return null;
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
  toutesLesRoutines().forEach(r => { routines[r.id] = { fait: [], valide: false }; });
  return { jour: cleJour(), routines, etoiles: 0, journeeFaite: false, reveilFait: false, reveil: { bienDormi: null, humeur: null }, planning: planningSeed || planningParDefaut(), seances: [] };
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
      etat.routines[r.id] = { fait: [], valide: false };
    }
  });
  if (!Array.isArray(etat.planning)) etat.planning = planningParDefaut();
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
      // d'être jetées avec `leon_journee`.
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
  const total = chargerPieces() + Math.max(0, n);
  sauverPieces(total);
  return total;
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
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
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
  // le mode édition de "Ma journée" ne survit pas à un retour au menu —
  // le code parent protège l'entrée en édition, pas juste un aller simple.
  journeeEnEdition = false;
  // Filet de sécurité : un retour au menu affiche forcément "aujourd'hui"
  // ensuite, jamais un jour futur resté ciblé (cf. planningCibleDate,
  // "Ma journée" plus bas) — au cas où un point d'entrée l'aurait laissé
  // sur une date passée.
  planningCibleDate = null;

  // Déclenché par "Aller se coucher" spécifiquement, pas par le fait que
  // toutes les routines du jour soient validées : un enfant peut très bien
  // n'avoir rien fait d'autre de la journée et aller directement se
  // coucher, ce doit quand même clôturer la journée.
  if (etat.routines.soir.valide && !etat.journeeFaite) {
    allerFinDeJournee();
    return;
  }

  synchroniserAvatar(etat);

  // jauge de journée : une étoile par routine, gagnée une fois validée
  const jauge = document.getElementById("jauge-jour");
  jauge.innerHTML = "";
  toutesLesRoutines().forEach(r => {
    const etoile = document.createElement("div");
    etoile.className = "etoile-jauge" + (etat.routines[r.id].valide ? " gagnee" : "");
    etoile.textContent = "⭐";
    jauge.appendChild(etoile);
  });
  const piecesTotal = chargerPieces();
  document.getElementById("pieces-total").textContent = piecesTotal > 0 ? "🪙 " + piecesTotal : "";

  // cartes de routines : la première non validée est jouable, les
  // suivantes restent grisées tant que TOUTES les précédentes ne sont
  // pas validées — pas juste l'immédiatement précédente. Distinction qui
  // ne se voyait pas tant que les routines s'enchaînaient forcément dans
  // l'ordre, mais compte depuis qu'un parent peut relancer une routine
  // du milieu (cf. relancerRoutine()) : sans ça, une routine plus loin
  // dans la liste réapparaîtrait débloquée juste parce que celle qui la
  // précède immédiatement est restée validée, en sautant celle qu'on
  // vient de relancer.
  //
  // Une routine avec `disponibleApresHeure` (ex. "Aller se coucher")
  // sort volontairement de ce chaînage : ni bloquée par les précédentes,
  // ni prise en compte pour bloquer une éventuelle suivante — débloquée
  // par l'heure plutôt que par les autres routines (cf. sa définition
  // dans routinesDemarrage() pour le pourquoi).
  //
  // De même, seules les routines marquées `chainee: true` s'enchaînent
  // entre elles — posé sur "shabiller"/"partir" au moment où
  // finaliserPremiereConfiguration() les sème dans routines_perso (préservé
  // ensuite si un parent les modifie, cf. creerNouvelleRoutine() qui
  // fusionne sur l'objet d'origine). Une routine ajoutée après coup par un
  // parent (via "+ Nouvelle routine") ne l'a jamais : toujours disponible,
  // ni bloquée par les précédentes ni prise en compte pour bloquer une
  // suivante — sinon un petit-déjeuner ajouté par un parent se
  // retrouverait verrouillé derrière "S'habiller"/"Se préparer à partir"
  // du seul fait d'avoir été créé après elles, sans aucun rapport réel
  // entre les deux.
  const liste = document.getElementById("liste-routines");
  liste.innerHTML = "";
  let toutPrecedentValide = true;
  toutesLesRoutines().forEach(r => {
    const etatR = etat.routines[r.id];
    const carte = document.createElement("div");
    carte.dataset.id = r.id;

    if (r.disponibleApresHeure !== undefined) {
      const heureAtteinte = dateActuelle().getHours() >= r.disponibleApresHeure;
      const debloquee = heureAtteinte && !etatR.valide;
      carte.className = "carte-routine" + (etatR.valide ? " faite" : (!heureAtteinte ? " verrouillee" : ""));
      carte.innerHTML = `<div class="carte-routine-nom">${r.nom}</div><div class="carte-routine-etat">${etatR.valide ? "✓" : (heureAtteinte ? "" : "🕒")}</div>`;
      if (debloquee) carte.onclick = () => demarrerRoutine(r.id);
      else if (!etatR.valide) carte.onclick = () => dire("Ce n'est pas encore l'heure pour « " + r.nom + " ».");
      liste.appendChild(carte);
      return;
    }

    const chainee = !!r.chainee;
    const verrouillee = chainee && !toutPrecedentValide;
    const debloquee = !verrouillee && !etatR.valide;
    // "verrouillee" ne s'applique qu'à une routine PAS ENCORE validée —
    // sinon une routine déjà faite (ex. "Se préparer à partir") peut se
    // retrouver visuellement "verrouillée" après qu'un parent a relancé
    // une routine précédente depuis l'espace parent, alors qu'elle reste
    // bel et bien validée.
    carte.className = "carte-routine" + (etatR.valide ? " faite" : (verrouillee ? " verrouillee" : ""));
    carte.innerHTML = `<div class="carte-routine-nom">${r.nom}</div><div class="carte-routine-etat">${etatR.valide ? "✓" : (verrouillee ? "🔒" : "")}</div>`;
    if (debloquee) carte.onclick = () => demarrerRoutine(r.id);
    liste.appendChild(carte);
    if (chainee) toutPrecedentValide = toutPrecedentValide && etatR.valide;
  });

  afficherEcran("screen-menu");
}

function demarrerRoutine(id) {
  routineActuelleId = id;
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

// Porte de sortie du menu vers les aventures/missions. Si des routines
// indispensables manquent, on NE NAVIGUE PAS de force vers l'une d'elles
// — l'enfant a pu appuyer sur la voiture par erreur. On reste sur le
// menu, on rappelle à voix haute ce qu'il reste à faire, et on fait
// clignoter la routine de rang 1 (la seule débloquée) pour attirer
// l'attention dessus sans forcer le geste.
function allerVersDepart() {
  const etat = chargerEtat();
  const manquantes = toutesLesRoutines().filter(r => ROUTINES_REQUISES_DEPART.includes(r.id) && !etat.routines[r.id].valide);
  if (manquantes.length === 0) {
    dire("On part à l'aventure !");
    construireMissions();
    afficherEcran("screen-missions");
    return;
  }
  const noms = manquantes.map(r => r.nom).join(", ");
  dire("Avant de partir à l'aventure, il faut d'abord faire : " + noms + ".");
  clignoterRoutine(manquantes[0].id);
}

// Écran des sorties du jour : liste les aventures du planning
// (`aventuresPlanifieesAujourdhui()` — pas `aventuresDuJour()`, qui ne
// sert qu'à l'ensemencement initial d'une nouvelle journée), sinon
// garde le texte d'origine "Rien de prévu aujourd'hui !".
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
  aventureActuelleId = id;
  sensTrajet = "aller";
  allerAuTrajet();
}

// Écran "Ma journée" : le planning du jour (`etat.planning`), affiché
// dans l'ordre chronologique — pas de tâches à cocher ici, c'est un
// aperçu, pas un parcours. En lecture seule par défaut ; le mode édition
// (`journeeEnEdition`, activé via `basculerEditionJournee()`, protégé
// par le code parent) ajoute réordonnancement (▲▼), suppression et ajout
// depuis les catalogues existants (ROUTINES/AVENTURES/REPAS). Toujours
// remis en lecture seule en quittant vers le menu (cf. `construireMenu()`).
let journeeEnEdition = false;

// Planning à venir (cf. construireParentPlanningJournees() plus bas) :
// `null` = "Ma journée" pointe sur aujourd'hui, `etat.planning` en
// direct — sinon une clé "YYYY-M-D" et l'écran devient "Planning du
// [date]", pointé sur `cle("planning_futur")[planningCibleDate]`.
// Variable de module, jamais persistée : chaque point d'entrée qui
// affiche explicitement AUJOURD'HUI (construireMenu(), la ligne
// "Aujourd'hui" de "Planning des journées", le bouton "Afficher ma
// journée" du menu, le raccourci debug correspondant) la remet à `null`
// avant de construire l'écran — les appels internes à "Ma journée"
// (édition, mutateurs, tick d'horloge) ne la touchent jamais, ils continuent
// d'afficher la cible déjà en cours.
let planningCibleDate = null;
function planningCibleEstAujourdhui() { return planningCibleDate === null; }
// Retourne toujours le tableau nu (même contrat que chargerEtat().planning
// avant ce changement) — une date future jamais encore personnalisée est
// simplement son planning par défaut, pas encore écrit dans
// cle("planning_futur") (cf. sauverPlanningCible()).
function chargerPlanningCible() {
  if (planningCibleEstAujourdhui()) return chargerEtat().planning;
  const futur = chargerPlanningFutur();
  return Array.isArray(futur[planningCibleDate]) ? futur[planningCibleDate] : planningParDefaut(planningCibleDate);
}
function sauverPlanningCible(liste) {
  if (planningCibleEstAujourdhui()) { const etat = chargerEtat(); etat.planning = liste; sauverEtat(etat); return; }
  const futur = chargerPlanningFutur();
  futur[planningCibleDate] = liste;
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
    planningCibleEstAujourdhui() ? "Ma journée" : "Planning du " + dateLisible(planningCibleDate);

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
    ligne.className = "ligne-journee type-" + item.type
      + (i === courantIdx ? " journee-maintenant" : "")
      + (i === suivantIdx ? " journee-suivant" : "");
    const sousLigneHeure = item.heure ? `<span class="texte-journee-reveil">🕒 ${item.heure}</span>` : "";
    const sousLigneEntourage = lib.entourage
      ? `<span class="texte-journee-reveil">👪 ${lib.entourage.map(p => p.emoji + " " + p.nom).join(", ")}</span>` : "";
    const badge = i === courantIdx ? `<span class="badge-maintenant">MAINTENANT</span>` : "";
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
      controles.append(champHeure, btnHaut, btnBas, btnRetirer);
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

function ajouterItemPlanning(type, id) {
  const planning = chargerPlanningCible();
  planning.push({ type, id });
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
    return bloc;
  }

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
  return bloc;
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
// Planning des journées (espace parent) — UNE liste, aujourd'hui d'abord
// puis les JOURS_PLANNING_FUTUR prochains jours (demandé explicitement :
// deux boutons séparés pour "aujourd'hui" et "les jours suivants" dans
// l'espace parent gênait plus qu'autre chose). Chaque ligne ouvre "Ma
// journée" (devenue "Planning du [date]" pour un jour futur, cf.
// construireJournee()) — même écran, mêmes outils (heures, entourage,
// catalogue, texte libre), juste pointés ailleurs qu'aujourd'hui via
// `planningCibleDate`. Calcul sur l'heure réelle (`new Date()`), jamais
// `dateActuelle()` — cohérent avec `cleJour()`, qui ignore déjà
// délibérément l'heure forcée du panneau debug (cf. son commentaire).
// ---------------------------------------------------------------------
const JOURS_PLANNING_FUTUR = 7;

function construireParentPlanningJournees() {
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

  ajouterCarte("Aujourd'hui", "En cours", true, () => {
    planningCibleDate = null;
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
    ajouterCarte(dateLisible(dateKey), personnalise ? "Planning personnalisé" : "Planning par défaut", personnalise, () => ouvrirJourneeFuture(dateKey));
  }
}

function ouvrirJourneeFuture(dateKey) {
  planningCibleDate = dateKey;
  journeeEnEdition = true;
  construireJournee();
  afficherEcran("screen-journee");
}

// Écran "Mes récompenses" : les étoiles gagnées aujourd'hui et les
// pièces accumulées (cf. `chargerPieces` — pas remises à zéro chaque
// jour, donc affichées en total plutôt qu'"aujourd'hui"), présentées
// comme des objets à collectionner plutôt qu'un simple compteur —
// accessible en tapant sur les étoiles/pièces du menu (`btn-mes-recompenses`).
function construireRecompenses() {
  const etat = chargerEtat();
  const conteneur = document.getElementById("recompenses-contenu");
  conteneur.innerHTML = "";

  function ajouterGroupe(titre, n, visuelHTML, texteVide) {
    const groupe = document.createElement("div");
    const label = document.createElement("div");
    label.className = "groupe-journee-titre";
    label.textContent = titre;
    groupe.appendChild(label);
    if (n === 0) {
      const vide = document.createElement("div");
      vide.className = "recompenses-vide";
      vide.textContent = texteVide;
      groupe.appendChild(vide);
    } else {
      const grille = document.createElement("div");
      grille.className = "grille-recompenses";
      for (let i = 0; i < n; i++) {
        const item = document.createElement("div");
        item.className = "recompense-item";
        item.innerHTML = `<div class="visuel">${visuelHTML}</div>`;
        item.onclick = () => faireBrillier(item);
        grille.appendChild(item);
      }
      groupe.appendChild(grille);
    }
    conteneur.appendChild(groupe);
  }

  ajouterGroupe("MES ÉTOILES — AUJOURD'HUI", etat.etoiles || 0, "⭐", "Pas encore d'étoile aujourd'hui !");
  ajouterGroupe(
    "MES PIÈCES — AU TOTAL",
    chargerPieces(),
    // Même recadrage CSS (.piece-visage) pour les deux enfants : les deux
    // sprites de base viennent du même générateur, tête au même endroit
    // sur la même grille (cf. scripts/generate_sprites_detailed_preview.py).
    '<div class="piece-visage"><img src="' + profilActif().sprites.base + '" alt=""></div>',
    "Pas encore de pièce !"
  );
}

function faireBrillier(el) {
  el.classList.remove("briller");
  void el.offsetWidth; // relance l'animation même si elle vient de jouer
  el.classList.add("briller");
  jouerSon();
  if (navigator.vibrate) navigator.vibrate(30);
}

function clignoterRoutine(id) {
  const carte = document.querySelector('.carte-routine[data-id="' + id + '"]');
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
  const sansGeste = !!(prochaine && !prochaine.zone);
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
function finDeRoutine() {
  const routine = routineParId(routineActuelleId);
  const suite = "Maintenant va chercher papa ou maman pour obtenir ta récompense.";
  document.getElementById("bravo-routine-titre").textContent = routine.felicitation;
  document.getElementById("bravo-routine-soustitre").textContent = suite;
  afficherEcran("screen-bravo-routine");
  dire(routine.felicitation + " " + suite);
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
    document.getElementById("correction-note").textContent = "Décoche ce qui n'a pas vraiment été fait, puis valide.";
    document.getElementById("btn-valider-routine").textContent = "Déverrouiller le coffre 🔒";
    actionCorrection = ouvrirCoffreRoutine;
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
    etat.etoiles = (etat.etoiles || 0) + 1;
    sauverEtat(etat);
    const routine = routineParId(idRoutine);
    document.getElementById("coffre-texte").textContent = routine.felicitation;
    document.getElementById("coffre-recompense-texte").textContent = "+ 1 ⭐ (" + etat.etoiles + " aujourd'hui)";
    return { texteVoix: routine.felicitation, symbolesConfettis: ["⭐", "✨", "🎉"], emojiRevele: "⭐" };
  });
}

// ---------------------------------------------------------------------
// Espace parent — hub protégé par le code, pour que les changements
// faits ici aient un effet direct sur ce que l'enfant voit (même état
// `leon_journee`/`localStorage`, pas un outil séparé). Cf.
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
  const options = [
    {
      emoji: "🔁", titre: "Relancer une routine",
      soustitre: "Si l'état de " + profilActif().prenom + " a changé (ex. il/elle s'est redéshabillé·e)",
      action: () => { construireParentRoutines(); afficherEcran("screen-parent-routines"); },
    },
    {
      emoji: "🗓️", titre: "Planning des journées",
      soustitre: "Aujourd'hui et les prochains jours — réordonner, ajouter, planifier à l'avance",
      action: () => { construireParentPlanningJournees(); afficherEcran("screen-parent-planning-journees"); },
    },
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
    {
      emoji: "🔑", titre: "Changer le code parent",
      soustitre: "Code à 4 chiffres, actuellement " + codeParentActuel().replace(/./g, "•"),
      action: () => { demarrerChangementCode(); },
    },
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
    {
      emoji: "📱", titre: "Cet appareil",
      soustitre: "Affiche " + profilActif().prenom + " — changer l'enfant de cet appareil",
      action: () => { construireParentAppareil(); afficherEcran("screen-parent-appareil"); },
    },
  ];
  options.forEach(o => {
    const carte = document.createElement("div");
    carte.className = "carte-routine carte-parent" + (o.action ? "" : " verrouillee");
    carte.innerHTML =
      `<div class="carte-routine-nom">${o.emoji} ${o.titre}<div class="carte-parent-soustitre">${o.soustitre}</div></div>`;
    if (o.action) carte.onclick = o.action;
    conteneur.appendChild(carte);
  });
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

// Réutilise le même écran/formulaire que la toute première configuration
// (cf. ouvrirPremiereConfiguration()) — seul `premiereConfigEstAjout`
// change, pour afficher un bouton retour puisqu'il y a ici un espace
// parent où revenir.
function ouvrirNouveauProfilDepuisAppareil() {
  ouvrirPremiereConfiguration(true);
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

// Liste des routines avec leur état, pour choisir laquelle relancer.
// Toutes affichées (pas seulement les validées) : un parent peut aussi
// vouloir corriger une routine en cours sans attendre la fin.
function construireParentRoutines() {
  const etat = chargerEtat();
  document.getElementById("parent-routines-intro").textContent =
    "Si l'état de " + profilActif().prenom + " a changé (ex. il/elle s'est redéshabillé·e), choisis la routine à relancer.";
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

// Si la routine était validée, on retire l'étoile qu'elle avait
// rapportée : elle sera regagnée quand l'enfant la revalidera pour de
// bon, sinon le compteur d'étoiles serait gonflé. `journeeFaite` et le
// verrou de sommeil (`cle("reveil")`, cf. `endormir`) ne repassent à faux
// que si c'est "Aller se coucher" qu'on relance — cf. construireMenu() :
// c'est la seule routine qui conditionne la journée "finie", relancer
// une autre routine (ex. correction sur "S'habiller" après coup) n'a pas
// à rouvrir l'écran de clôture ni à réveiller l'app.
function confirmerRelanceRoutine() {
  const etat = chargerEtat();
  const etatR = etat.routines[routineActuelleId];
  if (etatR.valide) {
    etatR.valide = false;
    etat.etoiles = Math.max(0, (etat.etoiles || 0) - 1);
  }
  if (routineActuelleId === "soir") {
    etat.journeeFaite = false;
    try { localStorage.removeItem(cle("reveil")); } catch (e) {}
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
  if (h) parts.push(h.emoji + " " + h.texte);
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
// (aujourd'hui ou à venir) se fait depuis "Planning des journées" (cf.
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

function ouvrirNouvelleAventure() {
  aventureEnEditionId = null;
  document.getElementById("nouvelle-aventure-titre").textContent = "Nouvelle activité";
  document.getElementById("btn-creer-aventure").textContent = "Créer et ajouter à aujourd'hui";
  ["na-nom", "na-trajet", "na-arrivee", "na-etape1", "na-etape2", "na-etape3", "na-mots-cles"]
    .forEach(id => { document.getElementById(id).value = ""; });
  document.getElementById("na-piece").checked = true;
  document.getElementById("na-erreur").textContent = "";
  emojiChoisiActivite = EMOJI_ACTIVITE[0];
  construireDeclencheurEmoji("na-emoji-trigger", emojiChoisiActivite);
  entourageChoisiActivite = [];
  construireChoixEntourage(document.getElementById("na-entourage-grille"), entourageChoisiActivite);
  afficherEcran("screen-parent-nouvelle-aventure");
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
  document.getElementById("nouvelle-aventure-titre").textContent = "Modifier l'activité";
  document.getElementById("btn-creer-aventure").textContent = "Enregistrer les modifications";
  document.getElementById("na-nom").value = a.lieu;
  document.getElementById("na-trajet").value = a.texteTrajet;
  document.getElementById("na-arrivee").value = a.texteArrivee;
  document.getElementById("na-etape1").value = sansNumeroEtape(a.programme[0]);
  document.getElementById("na-etape2").value = sansNumeroEtape(a.programme[1]);
  document.getElementById("na-etape3").value = sansNumeroEtape(a.programme[2]);
  document.getElementById("na-piece").checked = a.recompensePieces > 0;
  document.getElementById("na-mots-cles").value = (a.motsCles || []).join(", ");
  document.getElementById("na-erreur").textContent = "";
  emojiChoisiActivite = a.emoji;
  construireDeclencheurEmoji("na-emoji-trigger", emojiChoisiActivite);
  entourageChoisiActivite = a.entourageIds ? [...a.entourageIds] : [];
  construireChoixEntourage(document.getElementById("na-entourage-grille"), entourageChoisiActivite);
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
  if (!trajetEl.value.trim()) trajetEl.value = "On roule vers " + nom + ".";
  if (!arriveeEl.value.trim()) arriveeEl.value = "On est arrivés à " + nom + ".";
}

function creerNouvelleAventure() {
  const nom = document.getElementById("na-nom").value.trim();
  const texteTrajet = document.getElementById("na-trajet").value.trim();
  const texteArrivee = document.getElementById("na-arrivee").value.trim();
  const e1 = document.getElementById("na-etape1").value.trim();
  const e2 = document.getElementById("na-etape2").value.trim();
  const e3 = document.getElementById("na-etape3").value.trim();
  const pieceOui = document.getElementById("na-piece").checked;

  if (!nom || !texteTrajet || !texteArrivee || !e1 || !e2 || !e3) {
    document.getElementById("na-erreur").textContent = "Remplis tous les champs avant de créer l'activité.";
    return;
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
    const maj = Object.assign({}, original, {
      lieu: nom,
      emoji: emojiChoisiActivite,
      texteTrajet,
      texteArrivee,
      programme: ["1. " + e1, "2. " + e2, "3. " + e3],
      recompensePieces: pieceOui ? 1 : 0,
    });
    if (entourageChoisiActivite.length) maj.entourageIds = [...entourageChoisiActivite]; else delete maj.entourageIds;
    if (motsCles) maj.motsCles = motsCles.split(",").map(m => m.trim()).filter(Boolean); else delete maj.motsCles;

    const perso = chargerAventuresPerso();
    const pos = perso.findIndex(x => x.id === maj.id);
    if (pos === -1) perso.push(maj); else perso[pos] = maj;
    sauverAventuresPerso(perso);

    dire("Activité modifiée : " + nom + ".");
    aventureEnEditionId = null;
    construireParentActivites();
    afficherEcran("screen-parent-activites");
    return;
  }

  // Créer une activité ne l'ajoute qu'au CATALOGUE (demandé
  // explicitement) — jamais au planning d'un jour précis, aujourd'hui ou
  // futur : `apres` n'a donc plus lieu d'être ici, il ne servait qu'à
  // positionner cette injection immédiate (seules les aventures à `date`
  // fixe, ex. "Le magasin de bricolage", l'utilisent encore, cf.
  // `planningParDefaut()`). C'est "AJOUTER À LA JOURNÉE" (déjà existant,
  // sur n'importe quelle journée, aujourd'hui ou à venir) qui place
  // ensuite une activité du catalogue sur un jour précis.
  const nouvelle = {
    id: "perso-" + Date.now(),
    lieu: nom,
    emoji: emojiChoisiActivite,
    texteTrajet,
    texteArrivee,
    programme: ["1. " + e1, "2. " + e2, "3. " + e3],
    recompensePieces: pieceOui ? 1 : 0,
    texteTrajetRetour: "On a fini, on rentre à la maison.",
  };
  // Champs optionnels omis (plutôt que mis à `[]`/`""`) si vides : garde
  // une activité sans entourage/mots-clés indistinguable d'une activité
  // créée avant l'existence de ces champs. Jamais de champ `personne`
  // ici (cf. avertissement sur chargerEntouragePerso()) — seules les 3
  // aventures praticienne codées en dur en ont un.
  if (entourageChoisiActivite.length) nouvelle.entourageIds = [...entourageChoisiActivite];
  if (motsCles) nouvelle.motsCles = motsCles.split(",").map(m => m.trim()).filter(Boolean);

  const perso = chargerAventuresPerso();
  perso.push(nouvelle);
  sauverAventuresPerso(perso);

  dire("Nouvelle activité créée : " + nom + ".");
  construireParentActivites();
  afficherEcran("screen-parent-activites");
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
  // création ne l'aurait pas. `planningParDefaut()` s'occupe des jours
  // suivants (routine récurrente, cf. sa définition).
  const etat = chargerEtat();
  etat.routines[nouvelle.id] = { fait: [], valide: false };
  etat.planning.push({ type: "routine", id: nouvelle.id });
  sauverEtat(etat);

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
// Message de clôture de la journée, pas un récapitulatif des routines
// faites (cf. les appelants : déclenché par "Aller se coucher" seule,
// même si l'enfant n'a rien fait d'autre de la journée). Identique à
// l'écrit et à l'oral (cf. `dire`). Fonction (pas une constante) : dépend
// du prénom du profil actif.
function texteFinJournee(profil) {
  return "Bravo pour toutes les routines que tu as faites aujourd'hui " + profil.prenom + ". Bonne nuit et à demain.";
}
const HEURE_REVEIL = 7;
function texteReveilBonjour(profil) { return "Bonjour " + profil.prenom; }
const TEXTE_REVEIL_DORMI = "As-tu bien dormi ?";
const TEXTE_REVEIL_HUMEUR = "Comment te sens-tu ? Choisis bien ta réponse avec l'image qui te plaît le plus.";

function afficherRecompenseFinDeJournee(etat) {
  document.getElementById("coffre-texte").textContent = texteFinJournee(profilActif());
  document.getElementById("coffre-recompense-texte").textContent = "+ " + (etat.etoiles || 0) + " ⭐ aujourd'hui";
}

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
// faire tant que `dortEncore()` est vrai. Seuls les boutons globaux
// (⚙️ espace parent, ↺ reset — hors des .screen, toujours affichés)
// restent atteignables : c'est le bypass parental exceptionnel, via le
// code déjà existant (cf. ouvrirEspaceParent). construireMenu() ne
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
  const texte = texteReveilBonjour(profilActif());
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
  { id: "fatigue", emoji: "😴", texte: "Fatigué" },
  { id: "pleine-forme", emoji: "💪", texte: "En pleine forme" },
  { id: "normal", emoji: "🙂", texte: "Normal" },
  { id: "triste", emoji: "😢", texte: "Triste" },
  { id: "content", emoji: "😄", texte: "Content" },
];
function construireGrilleHumeur() {
  const conteneur = document.getElementById("reveil-humeur-grille");
  conteneur.innerHTML = "";
  EMOJI_HUMEUR.forEach(h => {
    const b = document.createElement("button");
    b.className = "btn-humeur";
    b.innerHTML = `<span class="btn-humeur-emoji">${h.emoji}</span><span class="btn-humeur-texte">${h.texte}</span>`;
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
// courant) puis, au changement de jour, recopié dans `leon_historique`
// par `archiverJournee()` — pas d'écran dédié pour le consulter encore,
// juste le stockage (même approche que l'a été l'historique au départ).
function finReveil(humeurId) {
  const etat = chargerEtat();
  etat.reveil.humeur = humeurId;
  etat.reveilFait = true;
  sauverEtat(etat);
  construireMenu();
}

function allerFinDeJournee() {
  const etat = chargerEtat();
  afficherRecompenseFinDeJournee(etat);
  ouvrirCoffre(texteFinJournee(profilActif()), ["⭐", "✨", "🎉", "⭐", "✨"], endormir);
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
  emoji.textContent = emojiRevele;
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
  return aventureParId(suivant.id) || null;
}

// ---------------------------------------------------------------------
// Trajet + arrivée — alimentés par l'aventure choisie (`aventureActuelleId`)
// et son sens (`sensTrajet`). Pas de minuteur/barre de progression : le
// trajet est un simple temps d'attente, et c'est un parent qui confirme
// "On est arrivés" (bouton -> code, cf. allerValidationArrivee) — pas
// l'enfant tout seul, et pas une horloge. Une aventure sans `date` (ex.
// une praticienne récurrente) reste accessible via ce même mécanisme mais
// n'est jamais programmée automatiquement ; pour le moment seules les
// aventures listées dans `aventuresDuJour()` sont atteignables depuis
// l'écran des sorties.
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
  afficherEcran("screen-trajet");
  document.getElementById("trajet-texte").textContent = texte;
  document.getElementById("scene-trajet").classList.toggle("retour", sensTrajet === "retour");
  dire(texte);
}

function allerAArrivee() {
  const a = aventureParId(aventureActuelleId);
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
  if (a.recompensePieces > 0) {
    ouvrirCoffre(null, null, () => construireMenu(), () => {
      const total = ajouterPieces(a.recompensePieces);
      const prenom = profilActif().prenom;
      document.getElementById("coffre-texte").textContent = "Bravo " + prenom + ", tu as fait : " + a.lieu + " !";
      document.getElementById("coffre-recompense-texte").textContent =
        "+ " + a.recompensePieces + " 🪙 (" + total + " au total)";
      return { texteVoix: "Bravo " + prenom + ", tu as gagné une pièce !", symbolesConfettis: ["🪙", "✨", "🎉", "🪙", "✨"], emojiRevele: "🪙" };
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
}
tickHorloge();
setInterval(tickHorloge, 15000);

// ---------------------------------------------------------------------
// Câblage des boutons + démarrage
// ---------------------------------------------------------------------
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
document.getElementById("btn-voix-trajet").onclick = () => dire(document.getElementById("trajet-texte").textContent);
document.getElementById("btn-voix-arrivee").onclick = () => dire(document.getElementById("arrivee-texte").textContent);
document.getElementById("btn-voix-reveil-bonjour").onclick = () => dire(document.getElementById("reveil-bonjour-texte").textContent);
document.getElementById("btn-voix-reveil-dormi").onclick = () => dire(document.getElementById("reveil-dormi-texte").textContent);
document.getElementById("btn-voix-reveil-humeur").onclick = () => dire(document.getElementById("reveil-humeur-texte").textContent);

protegerParAppuiLong(document.getElementById("btn-reset-test"), reinitialiserTout);

document.getElementById("btn-un-parent").onclick = allerValidation;
document.getElementById("btn-valider-routine").onclick = () => { if (actionCorrection) actionCorrection(); };
// Retour discret : ramène à l'écran actif juste avant l'ouverture de
// screen-validation (cf. ecranAvantValidation, capturé à chacune de ses
// 5 entrées) — rien n'est perdu, aucune des 5 entrées ne modifie l'état
// avant que le code soit validé (sauf décocher/recocher en relecture,
// qui reste tel quel, cf. construireCorrection()).
document.getElementById("btn-retour-validation").onclick = () => afficherEcran(ecranAvantValidation || "screen-menu");

document.getElementById("btn-depart").onclick = allerVersDepart;
document.getElementById("btn-retour-menu").onclick = construireMenu;

document.getElementById("btn-journee").onclick = () => { planningCibleDate = null; construireJournee(); afficherEcran("screen-journee"); };
document.getElementById("btn-retour-menu-journee").onclick = construireMenu;
document.getElementById("btn-modifier-journee").onclick = basculerEditionJournee;

document.getElementById("btn-mes-recompenses").onclick = () => { construireRecompenses(); afficherEcran("screen-recompenses"); };
document.getElementById("btn-retour-menu-recompenses").onclick = construireMenu;

document.getElementById("btn-espace-parent").onclick = ouvrirEspaceParent;
document.getElementById("btn-retour-menu-parent").onclick = construireMenu;
document.getElementById("btn-retour-parent-routines").onclick = () => { construireEspaceParent(); afficherEcran("screen-parent"); };
document.getElementById("btn-retour-parent-historique").onclick = () => { construireEspaceParent(); afficherEcran("screen-parent"); };
document.getElementById("btn-retour-parent-seances").onclick = () => { construireEspaceParent(); afficherEcran("screen-parent"); };

document.getElementById("na-nom").addEventListener("blur", suggererTextesActivite);
document.getElementById("na-emoji-trigger").onclick = () =>
  ouvrirSelecteurEmoji(EMOJI_ACTIVITE, emojiChoisiActivite, (e) => { emojiChoisiActivite = e; construireDeclencheurEmoji("na-emoji-trigger", e); });
document.getElementById("btn-creer-aventure").onclick = creerNouvelleAventure;
document.getElementById("btn-retour-parent-nouvelle-aventure").onclick = () => { aventureEnEditionId = null; construireParentActivites(); afficherEcran("screen-parent-activites"); };

document.getElementById("btn-nouvelle-activite").onclick = ouvrirNouvelleAventure;
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

// Caché au tout premier lancement (rien où revenir, cf.
// ouvrirPremiereConfiguration()) ; visible depuis "Cet appareil" -> "+
// Nouvel enfant".
document.getElementById("btn-retour-premiere-configuration").onclick = () => { construireParentAppareil(); afficherEcran("screen-parent-appareil"); };
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
document.getElementById("btn-debug-journee").onclick = puisFermerDebug(() => { planningCibleDate = null; construireJournee(); afficherEcran("screen-journee"); });
document.getElementById("btn-debug-recompenses").onclick = puisFermerDebug(() => { construireRecompenses(); afficherEcran("screen-recompenses"); });
document.getElementById("btn-debug-coffre").onclick = puisFermerDebug(allerFinDeJournee);

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
  // Avant même le filet de sécurité ci-dessous : cet appareil n'a encore
  // aucun profil actif (premier lancement, ou profil jamais choisi) —
  // tout le reste (appliquerProfilAuDom(), chargerEtat()...) suppose un
  // profil réel et plante sinon. Écran de première configuration plutôt
  // que le filet de sécurité générique, qui présuppose lui aussi un
  // profil (cf. son propre appel à `cle()` dans le catch plus bas).
  if (!profilActifId()) { ouvrirPremiereConfiguration(false); return; }
  try {
    // Avant toute chose : calques d'avatar + prénom du profil actif dans
    // le DOM (cf. appliquerProfilAuDom()) — les écrans qui suivent
    // (dodo ou menu) en dépendent déjà (synchroniserAvatar() ne fait que
    // basculer la visibilité de calques qui doivent déjà exister).
    appliquerProfilAuDom();
    // Encore en sommeil (tablette rouverte en pleine nuit) : reste sur
    // l'écran dodo, avant même de toucher à l'état du jour — pas
    // d'interaction possible avant `dortEncore()` == false (cf. `endormir`).
    // Heure passée mais rituel du réveil pas encore fait aujourd'hui (ex.
    // tablette éteinte puis rallumée après l'heure) : même écran dodo,
    // mais tapable cette fois — cf. wiring de `#screen-dodo`.
    if (dortEncore() || !chargerEtat().reveilFait) { afficherEcran("screen-dodo"); return; }
    construireMenu();
  } catch (e) {
    try { localStorage.removeItem(cle("journee")); } catch (e2) {}
    construireMenu();
  }
})();
