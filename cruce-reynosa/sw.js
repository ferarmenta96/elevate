const CACHE_NAME = 'cruce-reynosa-v44';
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

// Activación: limpia caches viejos y fuerza recarga
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    ).then(() => {
      // Fuerza recarga en todos los clientes abiertos
      return self.clients.matchAll({ type: 'window' }).then((clients) => {
        clients.forEach((client) => client.navigate(client.url));
      });
    })
  );
  self.clients.claim();
});

// Fetch: Network-first para API y HTML, Cache-first para assets
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  
  const url = new URL(event.request.url);
  
  // 1. IGNORAR MAPAS Y APIS EXTERNAS (Google, Leaflet, CartoDB)
  if (url.hostname.includes('googleapis.com') || url.hostname.includes('gstatic.com') || url.hostname.includes('cartocdn.com') || url.hostname.includes('leaflet')) {
    return; 
  }

  // 2. API calls (Google Apps Script) — siempre red primero, NUNCA caché
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

  // 🚨 3. LA SOLUCIÓN: Network-First para tu página principal (HTML)
  // Siempre intentará descargar tu última actualización primero.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).then((response) => {
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, response.clone());
          return response;
        });
      }).catch(() => {
        // Solo usa la caché si el usuario se quedó sin internet
        return caches.match('/cruce-reynosa/index.html');
      })
    );
    return;
  }
  
  // 4. Fuentes de Google — Cache-first
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
  
  // 5. Assets estáticos (Imágenes e iconos) — Cache-first con fallback a red
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((res) => {
        if (res.ok && url.protocol === 'https:') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return res;
      }).catch(() => {
        // El modo navigate ya se manejó arriba, no es necesario hacer nada aquí
      });
    })
  );
});

// Push notifications
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
