// sw.js — caches the launcher's own shell (HTML/CSS/JS/icons/data) so the
// UI still loads offline. It deliberately does NOT try to cache the
// external game URLs (e.g. eaglercraft.com) — those still require a live
// connection, which the app already checks for before navigating.
//
// Bump CACHE_NAME on every deploy. Old caches are purged on activate, and
// the app shell uses a stale-while-revalidate strategy below: the cached
// copy is served instantly, while a background fetch refreshes the cache
// for *next* time — this is what fixes the original "cache-first locks
// users onto an old main.js forever" bug. main.js listens for the
// resulting 'updatefound'/'controllerchange' events and shows a banner
// prompting a reload once a new version is ready.

const CACHE_NAME = "mlauncher-shell-v4";
const SHELL_FILES = [
  "./index.html",
  "./style.css",
  "./manifest.json",
  "./icons/icon.svg",
  "./data/news.json",
  "./js/main.js",
  "./js/storage.js",
  "./js/network.js",
  "./js/bookmarks.js",
  "./js/versions.js",
  "./js/accounts.js",
  "./js/firebase-config.js",
  "./js/firebase-auth.js",
  "./js/skin.js",
  "./js/audio.js",
  "./js/newsfeed.js",
  "./js/wasm-warmup.js",
  "./js/log.js",
  "./js/auth.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)));
  // Do NOT auto skipWaiting here — that would silently swap the running
  // app out from under an active session. Activation waits for the user
  // to confirm via the update banner (main.js posts SKIP_WAITING below).
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Only handle same-origin GET requests for the app shell; let everything
  // else (including navigation to the external game) pass through normally.
  if (event.request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request);
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response && response.ok) cache.put(event.request, response.clone());
          return response;
        })
        .catch(() => null);

      // Stale-while-revalidate: return the cached response immediately if
      // we have one (fast + works offline), but still let the network
      // fetch above run in the background to refresh the cache for the
      // next load. If there's no cached copy yet, fall back to waiting
      // on the network once.
      return cached || (await networkFetch) || Response.error();
    })
  );
});
