/* sw.js — Service worker de la PWA.
   El build (scripts/build-site.js) reemplaza %%CACHE_VERSION%% por un sello
   unico para invalidar la cache vieja en cada deploy. Ademas inyecta la lista
   de recursos del app-shell en %%PRECACHE_URLS%%.

   Estrategia:
     - Navegaciones (documentos): network-first, con fallback a la copia
       cacheada (permite abrir la app sin conexion).
     - Otros recursos same-origin (assets): stale-while-revalidate.
*/
'use strict';

const CACHE = 'gc-pwa-%%CACHE_VERSION%%';
const PRECACHE_URLS = %%PRECACHE_URLS%%;

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(PRECACHE_URLS);
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (key !== CACHE) return caches.delete(key);
        return null;
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // ignora terceros (analytics, etc.)

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(function (res) {
        const copy = res.clone();
        caches.open(CACHE).then(function (cache) { cache.put(req, copy); });
        return res;
      }).catch(function () {
        return caches.match(req).then(function (hit) {
          return hit || caches.match('%%START_URL%%');
        });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(function (hit) {
      const fetchPromise = fetch(req).then(function (res) {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then(function (cache) { cache.put(req, copy); });
        }
        return res;
      }).catch(function () { return hit; });
      return hit || fetchPromise;
    })
  );
});
