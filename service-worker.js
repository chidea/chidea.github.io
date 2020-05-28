var cacheName = 'chideas-yew-pwaa-v0.0.1';
var files = [
  '/',
  '1.creole-live-editor.js',
  'creole-live-editor.js',
  'creole-live-editor.wasm'
];


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
    })
  );
});