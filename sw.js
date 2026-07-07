// ============================================================
// FILE: sw.js (Service Worker)
// ============================================================
const CACHE_NAME = 'melodify-v1';
const ASSETS = [
  '/home.html',
  '/upload.html',
  '/admin.html',
  '/profile.html',
  '/search.html',
  '/library.html',
  '/css/global.css',
  '/css/components.css',
  '/css/home.css',
  '/css/player.css',
  '/css/lyrics.css',
  '/css/upload.css',
  '/css/admin.css',
  '/css/profile.css',
  '/css/search.css',
  '/css/library.css',
  '/css/ads.css',
  '/js/app.js',
  '/js/firebase-config.js',
  '/js/auth.js',
  '/js/player.js',
  '/js/lyrics.js',
  '/js/playlist.js',
  '/js/upload.js',
  '/js/utils.js',
  '/manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400..900&display=swap'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    ))
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then(res => res || fetch(e.request))
  );
});
