// Service worker de la app de la clienta: cachea la cáscara para abrir rápido. La API siempre va a la red.
// Subir VERSION cuando cambie la lista de la cáscara. La red va primero, así que un cambio de CSS/JS
// llega sin subirla; la versión solo limpia copias viejas de los celulares.
const VERSION = 'amelia-reservar-v6';
const CASCARA = [
  '/reservar/', '/reservar/reservar.css', '/reservar/reservar.js', '/reservar/selector.js', '/reservar/instalar.js', '/app-citas/instalar-guia.js',
  '/reservar/cita/', '/reservar/cita.js', '/reservar/manifest.webmanifest',
  '/app-citas/base.css', '/app-citas/js/util.js', '/app-citas/js/push.js', '/app-citas/fonts/dmsans.woff2', '/app-citas/fonts/playfair.woff2',
  '/app-citas/fonts/playfair-italic.woff2', '/app-citas/fonts/greatvibes.woff2', '/app-citas/img/logo.webp', '/app-citas/img/icono-192.png',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CASCARA.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' }).then((r) => {
      if (r.ok && CASCARA.includes(url.pathname)) { const copia = r.clone(); caches.open(VERSION).then((c) => c.put(url.pathname, copia)); }
      return r;
    }).catch(() => caches.match(url.pathname).then((r) => r || caches.match('/reservar/')))
  );
});

// ---------- notificaciones push ----------
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { cuerpo: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.titulo || 'Amelia Nail Spa', {
    body: d.cuerpo || '', icon: '/app-citas/img/icono-192.png', badge: '/app-citas/img/icono-192.png',
    tag: d.tag, renotify: !!d.tag, data: { url: d.url || self.registration.scope },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || '/', self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((lista) => {
    for (const c of lista) {
      if (c.url.split('#')[0] === url.split('#')[0] && 'focus' in c) return c.navigate(url).then((x) => (x || c).focus());
    }
    return self.clients.openWindow(url);
  }));
});
