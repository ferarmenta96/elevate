// ================================================================
//  Horus Pay — Service Worker
//  Horus System Co. · horussystemco.com
//  Permite instalación como PWA y caché offline básico
// ================================================================

var CACHE_NAME = 'horus-pay-v1';

var ASSETS = [
  '/horuspay/sender.html',
  '/horuspay/receiver.html',
  '/horuspay/manifest.json',
  '/horuspay/icon-192.png',
  '/horuspay/icon-512.png',
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,600&family=Inter:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap'
];

// Instalación — pre-cachea los assets principales
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(ASSETS).catch(function() {
        // Si algún asset falla no bloquea la instalación
      });
    })
  );
  self.skipWaiting();
});

// Activación — limpia cachés viejos
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
            .map(function(k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

// Fetch — cache-first para assets locales, network-first para GAS
self.addEventListener('fetch', function(e) {
  var url = e.request.url;

  // Peticiones al GAS siempre van a la red (no cachear datos dinámicos)
  if (url.indexOf('script.google.com') > -1 || url.indexOf('fonts.g') > -1) {
    e.respondWith(fetch(e.request).catch(function() {
      return caches.match(e.request);
    }));
    return;
  }

  // Para el resto: cache-first con fallback a red
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      return cached || fetch(e.request).then(function(response) {
        // Guarda en caché si es una respuesta válida
        if (response && response.status === 200 && response.type === 'basic') {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) { cache.put(e.request, clone); });
        }
        return response;
      });
    })
  );
});
