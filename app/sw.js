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
 * Incrémenter CACHE_NAME à chaque changement de cette liste (ou pour
 * forcer un rafraîchissement) : `activate` supprime les caches d'un nom
 * différent.
 *
 * Les 4 jeux d'avatar proposés à la première configuration (cf.
 * AVATARS_DISPONIBLES dans app.js) sont tous mis en cache ici, même si un
 * appareil donné n'en affiche jamais qu'un seul (celui choisi pour son
 * profil) : ce fichier ne sait pas à l'avance lequel, et le coût
 * (quelques petits PNG) est négligeable pour un usage à la maison.
 */
const CACHE_NAME = "acolyte-v14";
const A_METTRE_EN_CACHE = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.json",
  "./assets/avatar/avatar-a-base.png",
  "./assets/avatar/avatar-a-calecon.png",
  "./assets/avatar/avatar-a-haut.png",
  "./assets/avatar/avatar-a-pantalon.png",
  "./assets/avatar/avatar-a-chaussettes.png",
  "./assets/avatar/avatar-a-chaussures.png",
  "./assets/avatar/avatar-a-manteau.png",
  "./assets/avatar/avatar-a-dodo.png",
  "./assets/avatar/avatar-b-base.png",
  "./assets/avatar/avatar-b-calecon.png",
  "./assets/avatar/avatar-b-haut.png",
  "./assets/avatar/avatar-b-pantalon.png",
  "./assets/avatar/avatar-b-chaussettes.png",
  "./assets/avatar/avatar-b-chaussures.png",
  "./assets/avatar/avatar-b-manteau.png",
  "./assets/avatar/avatar-b-dodo.png",
  "./assets/avatar/avatar-c-base.png",
  "./assets/avatar/avatar-c-culotte.png",
  "./assets/avatar/avatar-c-haut.png",
  "./assets/avatar/avatar-c-robe.png",
  "./assets/avatar/avatar-c-chaussettes.png",
  "./assets/avatar/avatar-c-chaussures.png",
  "./assets/avatar/avatar-c-manteau.png",
  "./assets/avatar/avatar-c-dodo.png",
  "./assets/avatar/avatar-d-base.png",
  "./assets/avatar/avatar-d-culotte.png",
  "./assets/avatar/avatar-d-haut.png",
  "./assets/avatar/avatar-d-robe.png",
  "./assets/avatar/avatar-d-chaussettes.png",
  "./assets/avatar/avatar-d-chaussures.png",
  "./assets/avatar/avatar-d-manteau.png",
  "./assets/avatar/avatar-d-dodo.png",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/scenes/fenetre-voiture.jpg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(A_METTRE_EN_CACHE))
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
    caches.match(event.request).then((reponseEnCache) => {
      const misAJour = fetch(event.request)
        .then((reponseReseau) => {
          if (reponseReseau && reponseReseau.ok) {
            const copie = reponseReseau.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copie));
          }
          return reponseReseau;
        })
        .catch(() => reponseEnCache);
      return reponseEnCache || misAJour;
    })
  );
});
