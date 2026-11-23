// Service worker del panel: cachea solo la "cáscara" (HTML/CSS/JS/fuentes) para abrir rápido.
// La API (/api/*) siempre va a la red: los datos viven en D1 y nunca se sirven viejos.
// Subir VERSION cuando cambie la lista de la cáscara. La red va primero, así que un cambio de CSS/JS
// llega sin subirla; la versión solo limpia copias viejas de los celulares.
const VERSION = 'amelia-panel-v6';
const CASCARA = [
  '/panel/', '/panel/panel.css', '/panel/instalar.js', '/panel/manifest.webmanifest',
  '/panel/js/main.js', '/panel/js/estado.js', '/panel/js/login.js', '/panel/js/inicio.js', '/panel/js/agenda.js',
  '/panel/js/citas.js', '/panel/js/clientas.js', '/panel/js/equipo.js', '/panel/js/servicios.js', '/panel/js/ajustes.js',
  '/panel/js/importar.js', '/panel/js/mensajes.js', '/panel/js/analitica.js', '/panel/js/fidelizacion.js', '/panel/js/notas.js',
  '/panel/js/promociones.js', '/panel/js/plantillas.js', '/panel/js/galeria.js', '/panel/js/tour.js', '/panel/js/descargar.js', '/app-citas/base.css', '/app-citas/js/util.js', '/app-citas/js/csv.js', '/app-citas/js/push.js',
  '/app-citas/fonts/dmsans.woff2', '/app-citas/fonts/playfair.woff2', '/app-citas/fonts/playfair-italic.woff2',
  '/app-citas/fonts/greatvibes.woff2', '/app-citas/img/logo.webp', '/app-citas/img/icono-192.png',
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
  // Red primero (para recibir actualizaciones), caché si no hay conexión.
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' }).then((r) => {
      if (r.ok && CASCARA.includes(url.pathname)) {
        const copia = r.clone();
        caches.open(VERSION).then((c) => c.put(e.request, copia));
      }
      return r;
    }).catch(() => caches.match(e.request).then((r) => r || caches.match('/panel/')))
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
