var CACHE_NAME = 'fininv-v5';
var CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/recursos/media/global/pwa_fininv_256x256.png',
  '/recursos/media/global/favicon_fininv.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(CORE_ASSETS);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE_NAME; }).map(function (k) { return caches.delete(k); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Network-first para mantener código y datos siempre actualizados; respaldo en caché si no hay red
  event.respondWith(
    fetch(req).then(function (res) {
      if (res && res.status === 200 && res.type === 'basic') {
        var clone = res.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(req, clone);
        });
      }
      return res;
    }).catch(function () {
      return caches.match(req).then(function (cached) {
        return cached || (req.mode === 'navigate' ? caches.match('/index.html') : undefined);
      });
    })
  );
});
