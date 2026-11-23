// Service worker del panel: cachea solo la "cáscara" (HTML/CSS/JS/fuentes) para abrir rápido.
// La API (/api/*) siempre va a la red: los datos viven en D1 y nunca se sirven viejos.
const VERSION = 'amelia-panel-v1';
const CASCARA = [
  '/panel/', '/panel/panel.css', '/panel/instalar.js', '/panel/manifest.webmanifest',
  '/panel/js/main.js', '/panel/js/estado.js', '/panel/js/login.js', '/panel/js/inicio.js', '/panel/js/agenda.js',
  '/panel/js/citas.js', '/panel/js/clientas.js', '/panel/js/equipo.js', '/panel/js/servicios.js', '/panel/js/ajustes.js',
  '/panel/js/importar.js', '/app-citas/base.css', '/app-citas/js/util.js', '/app-citas/js/csv.js',
  '/app-citas/fonts/dmsans.woff2', '/app-citas/fonts/playfair.woff2', '/app-citas/fonts/playfair-italic.woff2',
  '/app-citas/fonts/greatvibes.woff2', '/app-citas/img/logo.webp', '/app-citas/img/icono-192.png',
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
  // Red primero (para recibir actualizaciones), caché si no hay conexión.
  e.respondWith(
    fetch(e.request).then((r) => {
      if (r.ok && CASCARA.includes(url.pathname)) {
        const copia = r.clone();
        caches.open(VERSION).then((c) => c.put(e.request, copia));
      }
      return r;
    }).catch(() => caches.match(e.request).then((r) => r || caches.match('/panel/')))
  );
});
