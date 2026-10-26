# Activités, étape 4 (récompenses) — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** les étoiles mises de côté le soir et découvertes le matin remplissent une jauge (20 étoiles = 1 pièce) ; les pièces se posent à la main sur un vrai chemin bordé de récompenses ; les parents règlent le chemin et voient ce qui est « à donner » ; la pièce Acolyte en pixel art remplace 🪙 partout ; des sons classiques accompagnent étoiles et pièces.

**Architecture :** logique pure dans `app/recompenses.js` (jauge, découverte, chemin, estimation), testée sous Node ; stockage par profil (`cle("jauge_etoiles")`, `cle("pieces_a_poser")`, `cle("chemin")`) ; la pièce est un petit composant DOM (face 16 × 16 en ombres portées + tranches empilées en 3D) ; un écran `screen-chemin` remplace « Mes récompenses » ; un écran parent `screen-parent-chemin`.

**Spec :** `docs/produit/specs/2026-10-25-activites-design.md`, section 5 et section 6 (Jauge, Pièces à poser, Chemin), étape 4 de la section 8.

## Global Constraints

- Une étoile n'est jamais reprise ; chaque routine donne son étoile comme aujourd'hui (coffre), affichée en « aujourd'hui », sans remplir la jauge.
- Le soir : après « Aller se coucher », ni coffre ni confettis : « Bonne nuit, tes étoiles t'attendent demain matin. » Les étoiles du jour passent dans `aDecouvrir` à la validation du coucher, ou au changement de jour s'il n'a pas eu lieu.
- Le matin, à partir de `heureDecouverte` (`"08:30"` par défaut), une carte « Ce matin » sur la liste seulement (jamais pendant une activité) ; « Ajouter mes étoiles » les verse une à une dans la jauge ; à `etoilesParPiece` (20 par défaut) une pièce, le reste repart dans la jauge.
- Pièce gagnée (jauge ou activité) : `pieces` +1 et `pieces_a_poser` +1. Migration : `pieces_a_poser` = `pieces` actuel, une fois.
- Chemin : `cases` (20 par défaut), ronds le long d'une route en épingles, récompenses sur certaines cases, la dernière = récompense finale ; la pièce se glisse au doigt sur le rond qui brille (et le remplit exactement) ; lâchée ailleurs, elle revient (« Presque ! Pose ta pièce sur le rond qui brille. ») ; récompense atteinte → fanfare, fête, voix « Tu as gagné : … ! », puis « À donner » chez les parents jusqu'à « Je l'ai donnée ». Pas de jauge ni d'étoiles sur cet écran. 🔊 : « Encore N pièces avant … ».
- Sons (Web Audio, aucun fichier) : ding par étoile, une note plus haut à chaque fois ; scintillement (4 notes rapides montantes) à la jauge pleine ; « ting-ting » de la pièce ; clic de pose ; fanfare (3 notes + note tenue, plus ample pour la finale) ; jamais un son et la voix en même temps ; réglage doux (défaut) / arcade / coupés ; aucun son le soir.
- `prefers-reduced-motion` : pas de battement, pas de rotation.
- Réglages parents : étoiles par pièce, heure de découverte, nombre de cases, sons, récompenses (case, pictogramme, nom) ; état de la jauge (dont les étoiles à découvrir) ; estimation du rythme ; baisser `etoilesParPiece` sous la jauge donne la pièce tout de suite.
- Version 20 partout (`VERSION_APP`, meta, `CACHE_NAME`) ; `recompenses.js` dans le cache.

## Review Focus

1. Journée en cours au moment de la mise à jour (étoiles déjà gagnées, pas de jauge) : rien n'est perdu ni compté deux fois.
2. Coucher validé deux fois, ou changement de jour après un coucher validé : les étoiles ne sont versées qu'une fois dans `aDecouvrir`.
3. Application fermée pendant l'animation du matin : les étoiles et la pièce sont déjà comptées, jamais rejouées.
4. Plus de pièces que de cases restantes : les pièces en trop attendent le chemin suivant.
5. Glisser au doigt sur la tablette (pointer events, Firefox Android) et lâcher hors de l'écran : la pièce revient toujours.

---

### Task 1 : `recompenses.js` (logique pure)

`CHEMIN_DEFAUT`, `normaliserChemin(c)`, `verserEtoiles(dansLaJauge, n, etoilesParPiece) -> { dansLaJauge, pieces, etapes: [{ dans, piece }] }`, `decouverteDisponible(jauge, "HH:MM", heureDecouverte)`, `recompenseDeLaCase(chemin, n)`, `prochaineRecompense(chemin) -> { case, emoji, nom, reste } | null`, `phraseChemin(chemin, aPoser)`, `estimationRythme(chemin, etoilesParJour)`. Tests d'abord.

### Task 2 : données, coucher calme et mise de côté des étoiles

`chargerJauge/sauverJauge`, `chargerChemin/sauverChemin`, `chargerPiecesAPoser/…`, `ajouterPieces()` incrémente aussi les pièces à poser, migration une fois ; `mettreDeCoteEtoiles(etat)` (drapeau `etat.etoilesMisesDeCote`) au coucher et au changement de jour ; coucher validé sans coffre (« Valider ✅ ») → étoile donnée si pas encore, « Bonne nuit… » puis écran endormi ; fin de journée à confettis supprimée.

### Task 3 : la pièce Acolyte

`elementPiece(s, { pose, tourne })` (face 16 × 16, tranches cannelées en escalier, dos ; épaisseur 3 px) ; partout à la place de 🪙 : coffre (elle tourne), texte du coffre, bandeau, formulaire parent.

### Task 4 : les sons

`sonEtoile(i)`, `sonJaugePleine()`, `sonPiece()`, `sonPose()`, `sonFanfare(finale)` selon `chemin.sons` ; durée renvoyée pour enchaîner la voix après.

### Task 5 : carte « Ce matin » et jauge en haut de la liste

Bandeau : jauge (étoiles vers la prochaine pièce), étoiles d'aujourd'hui, pièces ; tap → chemin. Carte « ☀️ CE MATIN — Hier, tu as gagné ⭐… » + « Ajouter mes étoiles ⭐ » → enregistrement immédiat, puis animation une étoile à la fois (ding), pièce (scintillement, ting-ting, voix), bouton « Poser ma pièce sur mon chemin → ».

### Task 6 : l'écran « Mon chemin »

Route SVG (géométrie validée en maquette), ronds 48 px (finale 64 px), récompenses et badge, plateau avec la pièce à poser (×N), glisser-déposer au pointeur avec ajustement près du rond, retour animé, fête et « À donner », 🔊/🗓️🔊/bande. Remplace « Mes récompenses ».

### Task 7 : côté parents « Chemin et récompenses »

Bloc « LES RÉCOMPENSES » dans l'espace parent (badge du nombre à donner) ; écran : À DONNER (« Je l'ai donnée »), LE CHEMIN (étoiles par pièce, cases, heure de découverte, sons, estimation, état de la jauge), LES RÉCOMPENSES (ajouter, modifier, retirer), « Préparer un nouveau chemin » une fois au bout.

### Task 8 : docs, version 20, vérification d'ensemble

Soirée (coucher calme, étoiles mises de côté) → matin avant 8h30 (rien) → après (carte, jauge, pièce) → chemin (pose, récompense, à donner) → parents ; tablette existante (pièces migrées) ; console sans erreur ; tests.
