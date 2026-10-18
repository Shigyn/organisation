// L'appli s'installe et s'ouvre meme sans reseau (les donnees, elles, passent
// toujours par le serveur). Reseau d'abord : une nouvelle version est prise
// des qu'elle est en ligne.
const CACHE = 'organisation-1';
const FICHIERS = ['./', 'index.html', 'app.css?v=1', 'app.js?v=1', 'manifest.webmanifest', 'icone-192.png', 'icone-512.png',
  'fonts/clash-display-600.woff2', 'fonts/switzer-400.woff2', 'fonts/switzer-500.woff2', 'fonts/switzer-600.woff2'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FICHIERS))); self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then((r) => {
    const copie = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copie)); return r;
  }).catch(() => caches.match(e.request).then((r) => r || caches.match('index.html'))));
});
