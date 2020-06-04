var cacheName = 'chideas-yew-pwaa-qr-v0.0.1';
var files = [
  '/',
  '1.app.js',
  'app.js',
  'app.wasm'
];

self.addEventListener('activate', event => {
  const cacheWhitelist = [cacheName];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

/* Start the service worker and cache all of the app's content */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(cacheName).then(cache => {
      return cache.addAll(files);
    })
  );
});

/* Serve cached content when offline */
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(response => {
      return response || fetch(e.request);
    }).catch(e => {
      // offline without cache
    })
  );
});