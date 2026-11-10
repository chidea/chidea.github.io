/* Offline app shell for the Creole live editor (cache-then-network).

   Same-origin GETs fall into three groups:

     document navigations  always fetched, and the fresh copy is stored under the fixed
                           key '/' so an offline boot is the newest version the user saw
                           online. Offline the stored shell answers instead and the router
                           takes it from there: a deep link needs no server, because the
                           note text lives in IndexedDB. (GH Pages' 404.html is only the
                           online way to resolve a deep link.)
     hashed boot assets    /<app>-<hash>.js and /<app>-<hash>_bg.wasm are content
                           addressed, so a cached copy can never be stale and the network
                           is not consulted. Trunk renames them per build, which is why
                           nothing below lists them.
     everything else       cache-then-network, storing only status 200.

   Navigations are network-first, so a deploy is picked up without touching this file;
   bumping cacheName only flushes the hashed assets left behind by earlier builds.
   Cross-origin requests are never touched, which is what keeps the "hackable JS links"
   and every external target working as before.
 */
var cacheName = 'chideas-pwaa-v2.0.0';

/* Handled inside the respondWith chain rather than with waitUntil: the put is awaited
   before the response reaches the page, so the worker cannot be killed between fetch and
   cache. A failed put must never cost the page its response, hence the swallow. */
function thenStore(request, response) {
  if (response.status !== 200) {
    return response;
  }
  var copy = response.clone();
  return caches
    .open(cacheName)
    .then(cache => cache.put(request, copy))
    .catch(() => undefined)
    .then(() => response);
}

/* Trunk renames the boot assets on every build, so the generated index.html is the only
   source of truth for their names: fetch the shell, cache it, then cache what it imports.
   Without this the hashed .js / _bg.wasm would only reach the cache on a later load, since
   on a first visit they are fetched before this worker exists - the second load would then
   be the first one able to boot offline. The worker script is not an app asset. */
function bootAssetPaths(html) {
  var paths = [];
  var re = /['"`](\/[^'"`\s]*\.(?:js|wasm))['"`]/g;
  for (var match = re.exec(html); match; match = re.exec(html)) {
    if (paths.indexOf(match[1]) === -1 && match[1] !== '/service-worker.js') {
      paths.push(match[1]);
    }
  }
  return paths;
}

function precacheShell() {
  return fetch(new Request('/', { cache: 'reload' }))
    .then(shell => {
      var copy = shell.clone();
      return shell.text().then(html =>
        caches.open(cacheName).then(cache =>
          cache
            .put(new Request('/'), copy)
            .catch(() => undefined)
            .then(() =>
              Promise.all(
                bootAssetPaths(html).map(path =>
                  cache.add(new Request(path, { cache: 'reload' })).catch(() => undefined)
                )
              )
            )
        )
      );
    })
    .catch(() => undefined);
}

self.addEventListener('install', event => {
  // Activate at once: the requests of the page this worker claims are then answered from
  // the cache it just filled, so ONE online visit is enough to boot offline afterwards.
  self.skipWaiting();
  // The document of the very first visit cannot be intercepted, hence precacheShell(); the
  // manifest is what the install UI reads. Nothing missing may sink the install.
  event.waitUntil(
    Promise.all([
      precacheShell(),
      caches
        .open(cacheName)
        .then(cache => cache.add(new Request('/manifest.json', { cache: 'reload' })))
        .catch(() => undefined),
    ])
  );
});

self.addEventListener('activate', event => {
  var cacheWhitelist = [cacheName];
  event.waitUntil(
    caches
      .keys()
      .then(cacheNames =>
        Promise.all(
          cacheNames
            .filter(name => cacheWhitelist.indexOf(name) === -1)
            .map(name => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  var request = event.request;
  if (request.method !== 'GET') {
    return;
  }
  var url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => thenStore(new Request('/'), response))
        .catch(() =>
          caches.match('/').then(shell => {
            if (shell) {
              return shell;
            }
            // Nothing cached yet: say so instead of letting the platform guess.
            return new Response('This app has to be opened once while online.\n', {
              status: 503,
              headers: { 'Content-Type': 'text/plain' },
            });
          })
        )
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(response => thenStore(request, response)))
  );
});
