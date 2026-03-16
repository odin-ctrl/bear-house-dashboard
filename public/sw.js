const CACHE_VERSION = 'bearhouse-team-v1.0-2026-03-16';
const CACHE_FILES = [
  '/',
  '/index.html',
  '/login.html',
  '/tasks.html',
  '/admin.html',
  '/style.css',
  '/dashboard.js',
  '/bearhousekaffekopp.png',
  '/bearhouseblaskrift.png',
  '/offline.html'
];

// Install - cache kritiske filer
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => {
      console.log('[SW] Caching app shell');
      return cache.addAll(CACHE_FILES.map(url => new Request(url, {cache: 'reload'})));
    })
  );
  self.skipWaiting();
});

// Activate - rydd gamle caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_VERSION)
           .map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch - network first, fallback til cache
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Lagre nye ressurser i cache
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then(cache => {
            cache.put(event.request, clone);
          });
        }
        return response;
      })
      .catch(() => {
        // Fallback til cache hvis offline
        return caches.match(event.request).then(cached => {
          return cached || caches.match('/offline.html');
        });
      })
  );
});
