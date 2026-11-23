// Enrutador mínimo para la API: rutas con parámetros (:id), sesión y protección CSRF.
import { HttpError, json, leerJSON } from './http.js';
import { leerSesion } from './auth.js';

export function crearRouter() {
  const rutas = [];
  const agregar = (metodo) => (patron, acceso, manejador) => {
    const claves = [];
    const re = new RegExp('^' + patron.replace(/:(\w+)/g, (_, k) => { claves.push(k); return '([^/]+)'; }) + '/?$');
    rutas.push({ metodo, re, claves, acceso, manejador });
  };
  const api = { get: agregar('GET'), post: agregar('POST'), put: agregar('PUT'), patch: agregar('PATCH'), delete: agregar('DELETE'), rutas };

  api.manejar = async (context) => {
    const { request, env } = context;
    const url = new URL(request.url);
    try {
      if (!env.DB) throw new HttpError(503, 'La base de datos no está configurada (binding DB).');
      let ruta, params = {};
      let metodoValido = false;
      for (const r of rutas) {
        const m = r.re.exec(url.pathname);
        if (!m) continue;
        metodoValido = true;
        if (r.metodo !== request.method && !(request.method === 'HEAD' && r.metodo === 'GET')) continue;
        ruta = r;
        r.claves.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
        break;
      }
      if (!ruta) throw new HttpError(metodoValido ? 405 : 404, metodoValido ? 'Método no permitido.' : 'No encontrado.');

      if (request.method !== 'GET' && request.method !== 'HEAD') {
        const origen = request.headers.get('Origin');
        if (origen && origen !== url.origin) throw new HttpError(403, 'Origen no permitido.');
      }

      let sesion = null;
      if (ruta.acceso !== 'publico') {
        sesion = await leerSesion(request, env.DB);
        if (!sesion) throw new HttpError(401, 'Tu sesión terminó. Ingresa de nuevo con tu PIN.');
        if (ruta.acceso === 'propietaria' && !sesion.esPropietaria) throw new HttpError(403, 'Solo la propietaria puede hacer esto.');
      }
      const body = ['POST', 'PUT', 'PATCH'].includes(request.method) ? await leerJSON(request) : {};
      const enSegundoPlano = (p) => { const seguro = Promise.resolve(p).catch((e) => console.error('segundo plano', e?.message || e)); if (context.waitUntil) context.waitUntil(seguro); };
      const r = await ruta.manejador({ request, env, db: env.DB, url, params, sesion, body, q: url.searchParams, context, enSegundoPlano });
      return r instanceof Response ? r : json(r ?? { ok: true });
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message, ...e.extra }, e.status);
      console.error('Error API', url.pathname, e?.stack || e);
      return json({ error: 'Ocurrió un error inesperado. Intenta de nuevo.' }, 500);
    }
  };
  return api;
}
