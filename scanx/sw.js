/* ═══════════════════════════════════════════════
   ScanX — Service Worker
   sw.js
═══════════════════════════════════════════════ */

const CACHE_NAME = 'scanx-v1.2';
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// ─── INSTALL ─────────────────────────────────
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS).catch(err => {
        console.warn('SW cache partial fail:', err);
      });
    })
  );
  self.skipWaiting();
});

// ─── ACTIVATE ────────────────────────────────
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ─── FETCH ───────────────────────────────────
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // For CDN resources (ZXing), try network first, fallback to cache
  if (url.hostname === 'unpkg.com' || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        fetch(e.request).then(response => {
          cache.put(e.request, response.clone());
          return response;
        }).catch(() => cache.match(e.request))
      )
    );
    return;
  }

  // For local assets: cache first, then network
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        if (response && response.status === 200 && response.type !== 'opaque') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(e.request, responseClone);
          });
        }
        return response;
      }).catch(() => {
        // Offline fallback for navigation
        if (e.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
