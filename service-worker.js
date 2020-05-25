var cacheName = 'chideas-yew-pwaa';
var filesToCache = [
  './index.html',
  './creole-live-editor.js',
  './1.creole-live-editor.js',
  './creole-live-editor.wasm'
];


/* Start the service worker and cache all of the app's content */
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(cacheName).then(function(cache) {
      return cache.addAll(filesToCache);
    })
  );
});

/* Serve cached content when offline */
self.addEventListener('fetch', function(e) {
  e.respondWith(
    caches.match(e.request).then(function(response) {
      return response || fetch(e.request);
    })
  );
});