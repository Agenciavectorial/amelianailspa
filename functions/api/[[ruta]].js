// Punto de entrada de toda la API de citas (/api/*). Ver docs/plataforma/ARQUITECTURA.md.
import { crearRouter } from '../_lib/router.js';
import { rutasPublicas } from '../_lib/rutas/publico.js';
import { rutasAuth } from '../_lib/rutas/auth.js';
import { rutasPanel } from '../_lib/rutas/panel.js';
import { rutasImportar } from '../_lib/rutas/importar.js';
import { rutasFeed } from '../_lib/rutas/feed.js';

const router = crearRouter();
rutasPublicas(router);
rutasAuth(router);
rutasPanel(router);
rutasImportar(router);
rutasFeed(router);

export async function onRequest(context) {
  const res = await router.manejar(context);
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Robots-Tag', 'noindex');
  res.headers.set('Referrer-Policy', 'same-origin');
  return res;
}
