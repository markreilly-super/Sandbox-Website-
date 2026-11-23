/* Service worker for the Super Payments SDK sandbox.
 *
 * DELIBERATELY CONSERVATIVE. This app exists to reproduce SDK behaviour, so a
 * cache that serves anything stale would surface as a fake SDK bug. The rules:
 *
 *   1. Cross-origin requests are never intercepted. That covers the Flask
 *      backend (flask-backend.onrender.com), the SDK bundles on
 *      cdn.superpayments.com, and every api.*.superpayments.com call. They go
 *      straight to the network, exactly as they would without a worker.
 *   2. Only same-origin GETs are touched. The request log's EventSource and
 *      every POST (checkout-sessions, proceed, setup-intents) bypass the
 *      worker entirely.
 *   3. Hashed build assets (/static/*) are cache-first: the filename changes
 *      on every build, so a hit is always correct.
 *   4. Navigations are network-first, falling back to the cached app shell
 *      only when the network genuinely fails.
 *
 * Net effect: the shell installs and launches offline; nothing that carries a
 * token, a session, or a price is ever served from cache.
 */

const VERSION = 'sandbox-v1';
const SHELL_CACHE = `shell-${VERSION}`;
const ASSET_CACHE = `assets-${VERSION}`;

// Only the shell. Routes are client-side, so index.html covers all of them.
const SHELL_URLS = ['/', '/index.html', '/manifest.json', '/favicon.ico'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // cache: 'reload' so install never seeds the cache from the HTTP cache
      .then((cache) =>
        Promise.allSettled(
          SHELL_URLS.map((url) => cache.add(new Request(url, { cache: 'reload' })))
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== SHELL_CACHE && key !== ASSET_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Rules 1 and 2: leave everything else completely alone.
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // Never cache the Apple Pay domain association file — it is served with
  // specific headers and must always come from the origin.
  if (url.pathname.startsWith('/.well-known/')) return;

  // Rule 4: navigations.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put('/index.html', copy));
          return response;
        })
        .catch(() =>
          caches
            .match('/index.html', { ignoreSearch: true })
            .then((cached) => cached || Response.error())
        )
    );
    return;
  }

  // Rule 3: content-hashed build output.
  if (url.pathname.startsWith('/static/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(ASSET_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          })
      )
    );
    return;
  }

  // Remaining same-origin GETs (icons, manifest): network-first, cache as
  // a fallback so the installed shell still renders offline.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

// Lets the page trigger an immediate update instead of waiting for a reload.
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
