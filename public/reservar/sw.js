// Service worker de la app de la clienta: cachea la cáscara para abrir rápido. La API siempre va a la red.
const VERSION = 'amelia-reservar-v1';
const CASCARA = [
  '/reservar/', '/reservar/reservar.css', '/reservar/reservar.js', '/reservar/selector.js', '/reservar/instalar.js',
  '/reservar/cita/', '/reservar/cita.js', '/reservar/manifest.webmanifest',
  '/app-citas/base.css', '/app-citas/js/util.js', '/app-citas/fonts/dmsans.woff2', '/app-citas/fonts/playfair.woff2',
  '/app-citas/fonts/playfair-italic.woff2', '/app-citas/fonts/greatvibes.woff2', '/app-citas/img/logo.webp', '/app-citas/img/icono-192.png',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CASCARA)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  e.respondWith(
    fetch(e.request).then((r) => {
      if (r.ok && CASCARA.includes(url.pathname)) { const copia = r.clone(); caches.open(VERSION).then((c) => c.put(url.pathname, copia)); }
      return r;
    }).catch(() => caches.match(url.pathname).then((r) => r || caches.match('/reservar/')))
  );
});
