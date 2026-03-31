const CACHE_NAME = 'cruce-reynosa-v8';
const STATIC_ASSETS = [
  '/cruce-reynosa/',
  '/cruce-reynosa/index.html',
  '/cruce-reynosa/manifest.json',
  '/cruce-reynosa/public/icon-192.png',
  '/cruce-reynosa/public/icon-512.png',
];

// Instalación: cachea assets estáticos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activación: limpia caches viejos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

// Fetch: Network-first para API, Cache-first para assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API calls (Google Apps Script) — siempre red primero
  if (url.hostname.includes('script.google.com')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(JSON.stringify({ reports: [], error: 'Sin conexión' }), {
          headers: { 'Content-Type': 'application/json' },
        });
      })
    );
    return;
  }

  // Fuentes de Google — Cache-first
  if (url.hostname.includes('fonts.')) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request).then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return res;
      }))
    );
    return;
  }

  // Assets estáticos — Cache-first con fallback a red
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return res;
      }).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('/cruce-reynosa/index.html');
        }
      });
    })
  );
});

// Push notifications (preparado para futuro)
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'Cruce Reynosa', {
      body: data.body,
      icon: '/cruce-reynosa/public/icon-192.png',
      badge: '/cruce-reynosa/public/icon-192.png',
      vibrate: [200, 100, 200],
      data: { url: '/cruce-reynosa/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/cruce-reynosa/'));
});
