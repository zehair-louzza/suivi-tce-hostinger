/* Service Worker ANELEC Suivi TCE
 * - rend l'application installable sur téléphone (Android / iOS / ordinateur)
 * - met en cache l'interface pour un démarrage rapide et un mode hors-ligne minimal
 * - ne met JAMAIS en cache les données métier (/api) ni le temps réel (/socket.io)
 */
const CACHE_VERSION = 'anelec-tce-v7';
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const ASSET_CACHE = `${CACHE_VERSION}-assets`;
const SHELL_URLS = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];

function isSensitivePath(pathname) {
  const lower = String(pathname || '').toLowerCase();
  return (
    lower === '/api' ||
    lower.startsWith('/api/') ||
    lower.startsWith('/socket.io') ||
    lower.startsWith('/devis-client/') ||
    lower.startsWith('/rapport-client/') ||
    lower.startsWith('/invitation')
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.startsWith(CACHE_VERSION)).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }
  if (event.data === 'CLEAR_AUTH_CACHES') {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
    );
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (isSensitivePath(url.pathname)) return;

  // Pages : réseau d'abord (toujours la dernière version), cache en secours hors-ligne (hors chemins sensibles)
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const finalUrl = res.url ? new URL(res.url) : url;
          if (res.ok && res.type === 'basic' && !isSensitivePath(finalUrl.pathname)) {
            const copy = res.clone();
            caches.open(SHELL_CACHE).then((c) => c.put('/', copy));
          }
          return res;
        })
        .catch(() => caches.match('/'))
    );
    return;
  }

  // Fichiers versionnés (/assets/*-hash.js|css) et icônes : cache d'abord
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(ASSET_CACHE).then((c) => c.put(req, copy));
            }
            return res;
          })
      )
    );
  }
});
