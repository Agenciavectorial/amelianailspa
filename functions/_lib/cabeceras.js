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
      r.headers.set('Cache-Control', 'no-cache');
    }
    if (noindex) r.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return r;
  };
}
