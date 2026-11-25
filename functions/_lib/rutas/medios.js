// Galería por servicio, perfil propio (foto y color) y subida de archivos (R2 opcional).
import { falla, json } from '../http.js';
import * as v from '../validar.js';
import { tokenAleatorio } from '../auth.js';

const TIPOS_SUBIDA = {
  'image/jpeg': ['jpg', 6_000_000], 'image/png': ['png', 6_000_000], 'image/webp': ['webp', 6_000_000],
  'video/mp4': ['mp4', 30_000_000],
};
const COLORES_EQUIPO = /^#[0-9a-fA-F]{6}$/;

/** URL de medio: propia del sitio (/img/…, /api/medios/…) o https externa (Cloudinary, etc.). */
function urlMedio(u, campo) {
  const s = v.texto(u, campo, { max: 600 });
  if (/^\/(img|api\/medios|app-citas)\/[\w./-]+$/.test(s)) return s;
  return v.url(s, campo);
}

export function rutasMedios(r) {
  r.get('/api/panel/servicios/:id/medios', 'sesion', async ({ db, params }) => {
    const { results } = await db.prepare('SELECT id, tipo, url, portada, orden FROM servicio_medios WHERE servicio_id = ? ORDER BY orden, id')
      .bind(v.entero(Number(params.id), 'servicio', { min: 1 })).all();
    return { medios: results };
  });

  // Reemplaza la galería completa (el orden del arreglo es el orden en pantalla).
  r.put('/api/panel/servicios/:id/medios', 'propietaria', async ({ db, params, body }) => {
    const id = v.entero(Number(params.id), 'servicio', { min: 1 });
    if (!(await db.prepare('SELECT 1 FROM servicios WHERE id = ?').bind(id).first())) falla(404, 'El servicio no existe.');
    const lista = Array.isArray(body.medios) ? body.medios : falla(400, 'Faltan los medios.');
    if (lista.length > 24) falla(400, 'Máximo 24 fotos o videos por servicio.');
    const filas = lista.map((m, i) => {
      const tipo = m.tipo === 'video' ? 'video' : 'foto';
      return [tipo, urlMedio(m.url, tipo === 'video' ? 'video' : 'foto'), m.portada ? urlMedio(m.portada, 'portada') : '', i];
    });
    await db.batch([
      db.prepare('DELETE FROM servicio_medios WHERE servicio_id = ?').bind(id),
      ...filas.map((f) => db.prepare('INSERT INTO servicio_medios (servicio_id, tipo, url, portada, orden) VALUES (?, ?, ?, ?, ?)').bind(id, ...f)),
    ]);
    // La primera foto queda como foto principal del servicio.
    const primera = filas.find((f) => f[0] === 'foto');
    if (primera) await db.prepare('UPDATE servicios SET foto = ? WHERE id = ?').bind(primera[1], id).run();
    return { ok: true };
  });

  // Cada persona personaliza su foto y su color en la agenda.
  r.put('/api/panel/mi-perfil', 'sesion', async ({ db, sesion, body }) => {
    const foto = body.foto === undefined ? undefined : (body.foto ? urlMedio(body.foto, 'foto') : '');
    const color = body.color === undefined ? undefined : (COLORES_EQUIPO.test(String(body.color)) ? body.color : falla(400, 'Color inválido.'));
    if (foto !== undefined) await db.prepare('UPDATE colaboradoras SET foto = ? WHERE id = ?').bind(foto, sesion.id).run();
    if (color !== undefined) await db.prepare('UPDATE colaboradoras SET color = ? WHERE id = ?').bind(color, sesion.id).run();
    return { ok: true };
  });

  // ¿Está activa la subida de archivos? Siempre: R2 (MEDIOS) si existe, si no Cloudinary firmado, si no la base.
  r.get('/api/panel/subida', 'sesion', async ({ env }) => ({ disponible: true, destino: destinoSubida(env) }));

  // Subida desde el celular o el computador: el cuerpo es el archivo (la app ya lo comprimió a WebP ~1600 px).
  r.post('/api/panel/subir', 'sesion', async ({ env, db, request, sesion }) => {
    const tipo = (request.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
    const regla = TIPOS_SUBIDA[tipo];
    if (!regla) falla(415, 'Formato no permitido. Usa JPG, PNG, WebP o MP4.');
    const datos = await request.arrayBuffer();
    if (!datos.byteLength) falla(400, 'El archivo está vacío.');
    if (datos.byteLength > regla[1]) falla(413, `El archivo es muy grande (máximo ${Math.round(regla[1] / 1e6)} MB).`);
    if (!firmaValida(new Uint8Array(datos.slice(0, 16)), regla[0])) falla(415, 'El archivo no parece una imagen o video válido.');
    const clave = `${new Date().toISOString().slice(0, 7)}/${tokenAleatorio(12)}.${regla[0]}`;
    const destino = destinoSubida(env);
    if (destino === 'r2') {
      await env.MEDIOS.put(clave, datos, { httpMetadata: { contentType: tipo }, customMetadata: { subido_por: String(sesion.id) } });
      return { url: `/api/medios/${clave}` };
    }
    if (destino === 'cloudinary') return { url: await subirCloudinary(env, datos, tipo) };
    if (datos.byteLength > 1_500_000) falla(413, 'La foto es muy pesada para guardarla. Prueba con otra o recórtala.');
    if (tipo === 'video/mp4') falla(501, 'Para subir videos hay que activar el almacenamiento de archivos (R2 o Cloudinary).');
    await db.prepare('INSERT INTO medios_archivos (clave, tipo, datos, bytes, subido_por) VALUES (?, ?, ?, ?, ?)').bind(clave, tipo, datos, datos.byteLength, sesion.id).run();
    return { url: `/api/medios/${clave}` };
  }, { crudo: true });

  r.get('/api/medios/:anio/:archivo', 'publico', async ({ env, db, params }) => {
    const clave = `${params.anio}/${params.archivo}`;
    if (!/^\d{4}-\d{2}\/[A-Za-z0-9_-]{8,40}\.(jpg|png|webp|mp4)$/.test(clave)) falla(404, 'No encontrado.');
    const cab = { 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox" };
    if (env.MEDIOS) {
      const obj = await env.MEDIOS.get(clave);
      if (obj) return new Response(obj.body, { headers: { 'Content-Type': obj.httpMetadata?.contentType || 'application/octet-stream', ...cab } });
    }
    const f = await db.prepare('SELECT tipo, datos FROM medios_archivos WHERE clave = ?').bind(clave).first();
    if (!f) falla(404, 'No encontrado.');
    return new Response(new Uint8Array(f.datos), { headers: { 'Content-Type': f.tipo, ...cab } });
  });
}

function destinoSubida(env) {
  if (env.MEDIOS) return 'r2';
  if (env.CLOUDINARY_CLOUD && env.CLOUDINARY_KEY && env.CLOUDINARY_SECRET) return 'cloudinary';
  return 'd1';
}

/** Revisa los primeros bytes (no basta con el Content-Type que dice el navegador). */
function firmaValida(b, ext) {
  const hex = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  if (ext === 'jpg') return hex.startsWith('ffd8ff');
  if (ext === 'png') return hex.startsWith('89504e47');
  if (ext === 'webp') return hex.startsWith('52494646') && hex.slice(16, 24) === '57454250';
  if (ext === 'mp4') return hex.slice(8, 16) === '66747970';
  return false;
}

/** Subida firmada desde el servidor: el secreto de Cloudinary nunca llega al navegador. */
async function subirCloudinary(env, datos, tipo) {
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = 'amelia-panel';
  const firma = [...new Uint8Array(await crypto.subtle.digest('SHA-1', new TextEncoder().encode(`folder=${folder}&timestamp=${timestamp}${env.CLOUDINARY_SECRET}`)))]
    .map((x) => x.toString(16).padStart(2, '0')).join('');
  const form = new FormData();
  form.append('file', new Blob([datos], { type: tipo }));
  form.append('api_key', env.CLOUDINARY_KEY);
  form.append('timestamp', String(timestamp));
  form.append('folder', folder);
  form.append('signature', firma);
  const recurso = tipo.startsWith('video/') ? 'video' : 'image';
  const r = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(env.CLOUDINARY_CLOUD)}/${recurso}/upload`, { method: 'POST', body: form });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.secure_url) { console.error('cloudinary', r.status, d?.error?.message); falla(502, 'No se pudo subir la foto. Intenta de nuevo.'); }
  return d.secure_url;
}

export { json };
