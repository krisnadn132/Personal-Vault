const CACHE_NAME = 'vault-cache-v6';
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './assets/icon-192.png',
  './assets/icon-512.png'
];
// ... sisa kode sw.js ke bawah tetap sama

// Meng-install Service Worker dan menyimpan file ke Cache
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

// Menampilkan file dari Cache saat aplikasi offline / loading
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request);
      })
  );
});