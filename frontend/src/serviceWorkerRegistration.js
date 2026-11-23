/* Registers public/sw.js.
 *
 * Deliberately not using CRA's cra-template-pwa helper: that one is
 * Workbox-driven and precaches the whole build manifest, which is the wrong
 * policy for this app (see the comment block at the top of public/sw.js).
 *
 * Registration is skipped unless the context can actually support it, so
 * `npm start` on http://localhost keeps working untouched and no worker is
 * ever registered against the dev server's unhashed bundles.
 */

const isLocalhost = Boolean(
  window.location.hostname === 'localhost' ||
    window.location.hostname === '[::1]' ||
    window.location.hostname.match(/^127(?:\.\d{1,3}){3}$/)
);

export function register() {
  if (!('serviceWorker' in navigator)) return;

  // Service workers need a secure context. localhost is exempt, but we only
  // want one there when explicitly asked for, so that the default dev loop
  // never has a worker sitting in front of it.
  const wantLocal = process.env.REACT_APP_ENABLE_SW === 'true';
  if (isLocalhost && !wantLocal) return;
  if (!isLocalhost && window.location.protocol !== 'https:') return;

  // PUBLIC_URL must share an origin with the page or the worker's scope is invalid.
  if (process.env.PUBLIC_URL) {
    const publicUrl = new URL(process.env.PUBLIC_URL, window.location.href);
    if (publicUrl.origin !== window.location.origin) return;
  }

  window.addEventListener('load', () => {
    const swUrl = `${process.env.PUBLIC_URL || ''}/sw.js`;

    navigator.serviceWorker
      .register(swUrl)
      .then((registration) => {
        registration.onupdatefound = () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.onstatechange = () => {
            if (installing.state !== 'installed') return;
            if (navigator.serviceWorker.controller) {
              console.log('[PWA] New content available; close all tabs to update.');
            } else {
              console.log('[PWA] Shell cached — the app will now launch offline.');
            }
          };
        };
      })
      .catch((error) => {
        console.error('[PWA] Service worker registration failed:', error);
      });
  });
}

export function unregister() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.ready
    .then((registration) => registration.unregister())
    .catch((error) => console.error('[PWA] Unregister failed:', error));
}
