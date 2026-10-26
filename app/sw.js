/*
 * Service worker — rend l'app utilisable hors-ligne une fois chargée une
 * première fois, et indépendante de la disponibilité d'un serveur
 * particulier ensuite (cf. discussion produit sur la réinitialisation :
 * ne plus dépendre d'un serveur de dev qui peut changer d'adresse ou
 * être éteint). Stratégie "stale-while-revalidate" : sert le cache
 * immédiatement si présent (marche hors-ligne), tout en rafraîchissant
 * le cache en tâche de fond dès qu'un réseau est disponible.
 *
 * Nécessite HTTPS (ou localhost) — les navigateurs n'activent pas les
 * service workers sur http:// simple (ex. une IP locale), cf. app/README.md.
 *
 * Incrémenter CACHE_NAME à chaque publication, au même numéro que
 * VERSION_APP (app.js) et la meta "acolyte-version" (index.html) :
 * `activate` supprime les caches d'un nom différent, et app.js recharge
 * une page dont index.html et app.js ne sont pas de la même version.
 *
 * Le service worker ne lit QUE son propre cache (jamais `caches.match()`
 * sur tous les caches) : un cache d'une version précédente, même recréé
 * par une mise à jour tardive de l'ancien service worker, ne peut plus
 * se mélanger à la version en cours.
 *
 * Avatar personnalisable (cf. PEAUX/CHEVEUX_COULEURS/COUPES_PAR_GENRE/
 * YEUX_COULEURS dans app.js) : 320 combinaisons possibles pour le corps/
 * visage (assets/avatar/perso/), bien trop pour toutes les précharger
 * comme au temps des 4 avatars fixes. Seuls les 2 jeux de vêtements
 * partagés (silhouette pantalon/robe, réutilisés par toutes les
 * combinaisons) sont précachés ici ; le corps/visage choisi par la
 * famille est mis en cache la première fois qu'il s'affiche (install
 * initiale, en ligne) grâce à la stratégie stale-while-revalidate
 * ci-dessous — jamais un problème en usage réel, seulement le tout
 * premier écran de configuration doit être en ligne.
 */
const CACHE_NAME = "acolyte-v19";
const A_METTRE_EN_CACHE = [
  "./",
  "./index.html",
  "./styles.css",
  "./semaine.js",
  "./journee.js",
  "./app.js",
  "./manifest.json",
  "./assets/avatar/avatar-a-calecon.png",
  "./assets/avatar/avatar-a-haut.png",
  "./assets/avatar/avatar-a-pantalon.png",
  "./assets/avatar/avatar-a-chaussettes.png",
  "./assets/avatar/avatar-a-chaussures.png",
  "./assets/avatar/avatar-a-manteau.png",
  "./assets/avatar/avatar-c-culotte.png",
  "./assets/avatar/avatar-c-haut.png",
  "./assets/avatar/avatar-c-robe.png",
  "./assets/avatar/avatar-c-chaussettes.png",
  "./assets/avatar/avatar-c-chaussures.png",
  "./assets/avatar/avatar-c-manteau.png",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/scenes/fenetre-voiture.jpg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    // `reload` : jamais une copie du cache HTTP du navigateur, pour que
    // l'installation prenne un jeu de fichiers d'une seule version.
    caches.open(CACHE_NAME).then((cache) => cache.addAll(A_METTRE_EN_CACHE.map(u => new Request(u, { cache: "reload" }))))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((noms) =>
      Promise.all(noms.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(event.request).then((reponseEnCache) => {
        const misAJour = fetch(event.request)
          .then((reponseReseau) => {
            if (reponseReseau && reponseReseau.ok) cache.put(event.request, reponseReseau.clone());
            return reponseReseau;
          })
          .catch(() => reponseEnCache);
        return reponseEnCache || misAJour;
      })
    )
  );
});
