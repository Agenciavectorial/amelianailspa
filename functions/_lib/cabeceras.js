// Cabeceras de seguridad para /reservar, /panel y /app-citas (sin tocar public/_headers).
export const CSP = [
  "default-src 'self'",
  // Cloudflare Web Analytics (sin cookies) se inyecta en el dominio publicado.
  "script-src 'self' https://static.cloudflareinsights.com",
  "style-src 'self'",
  "img-src 'self' data: https:",
  "font-src 'self'",
  // Videos cortos del spa (Cloudinary) en la galería de cada servicio.
  "media-src 'self' https://res.cloudinary.com",
  "connect-src 'self' https://cloudflareinsights.com",
  "manifest-src 'self'",
  "worker-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

export function conCabeceras({ noindex = false } = {}) {
  return async function onRequest(context) {
    const res = await context.next();
    const r = new Response(res.body, res);
    const tipo = r.headers.get('Content-Type') || '';
    r.headers.set('X-Content-Type-Options', 'nosniff');
    r.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    r.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (tipo.includes('text/html')) {
      r.headers.set('Content-Security-Policy', CSP);
      r.headers.set('X-Frame-Options', 'DENY');
    }
    const u = new URL(context.request.url);
    r.headers.set('Cache-Control', cacheDe(u.pathname, tipo, r.headers.get('Cache-Control'), u.searchParams.has('v')));
    if (noindex) r.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return r;
  };
}

// Caché: el dominio pasa por el edge de Cloudflare, que respeta Cache-Control. HTML, CSS, JS, manifiestos
// y service workers se revalidan SIEMPRE (no-cache + ETag: si no cambió, responde 304 sin bajar nada),
// así nadie ve una versión vieja después de un despliegue. Fuentes: un año. Imágenes de la app: un día.
export function cacheDe(ruta, tipo = '', actual = '', versionado = false) {
  // Archivos con ?v=<huella> (dev/versionar.mjs): su contenido nunca cambia en esa dirección → un año.
  if (versionado && !tipo.includes('text/html') && /\.(js|css|webmanifest)$/.test(ruta)) return 'public, max-age=31536000, immutable';
  if (ruta.startsWith('/app-citas/fonts/')) return 'public, max-age=31536000, immutable';
  if (ruta.startsWith('/app-citas/img/') && !tipo.includes('text/html')) return 'public, max-age=86400';
  if (ruta.startsWith('/api/')) return actual || 'no-store';
  return 'no-cache';
}
