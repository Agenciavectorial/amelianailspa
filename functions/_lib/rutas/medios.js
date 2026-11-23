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

  // ¿Está activa la subida de archivos? (requiere un bucket R2 con binding MEDIOS)
  r.get('/api/panel/subida', 'sesion', async ({ env }) => ({ disponible: !!env.MEDIOS }));

  // Subida desde el celular: el cuerpo es el archivo tal cual (Content-Type image/* o video/mp4).
  r.post('/api/panel/subir', 'sesion', async ({ env, request, sesion }) => {
    if (!env.MEDIOS) falla(501, 'La subida de archivos aún no está activada. Mientras tanto pega un enlace o elige una foto publicada.');
    const tipo = (request.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
    const regla = TIPOS_SUBIDA[tipo];
    if (!regla) falla(415, 'Formato no permitido. Usa JPG, PNG, WebP o MP4.');
    const datos = await request.arrayBuffer();
    if (!datos.byteLength) falla(400, 'El archivo está vacío.');
    if (datos.byteLength > regla[1]) falla(413, `El archivo es muy grande (máximo ${Math.round(regla[1] / 1e6)} MB).`);
    const clave = `${new Date().toISOString().slice(0, 7)}/${tokenAleatorio(12)}.${regla[0]}`;
    await env.MEDIOS.put(clave, datos, { httpMetadata: { contentType: tipo }, customMetadata: { subido_por: String(sesion.id) } });
    return { url: `/api/medios/${clave}` };
  }, { crudo: true });

  r.get('/api/medios/:anio/:archivo', 'publico', async ({ env, params }) => {
    if (!env.MEDIOS) falla(404, 'No encontrado.');
    const clave = `${params.anio}/${params.archivo}`;
    if (!/^\d{4}-\d{2}\/[A-Za-z0-9_-]{8,40}\.(jpg|png|webp|mp4)$/.test(clave)) falla(404, 'No encontrado.');
    const obj = await env.MEDIOS.get(clave);
    if (!obj) falla(404, 'No encontrado.');
    return new Response(obj.body, {
      headers: {
        'Content-Type': obj.httpMetadata?.contentType || 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  });
}

export { json };
