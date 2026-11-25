// Clientas: etiquetas personalizables (con color), eliminar y datos de fidelidad (última cita, frecuencia).
import { falla } from '../http.js';
import * as v from '../validar.js';
import { puede } from '../auth.js';
import { difDias, sumarDias, ahoraBogota } from '../tiempo.js';

const COLOR = /^#[0-9a-fA-F]{6}$/;

/** Frecuencia de visitas: promedio de días entre visitas (asistió), última visita y cuándo le tocaría volver. */
export function fidelidad(fechasAsistio, hoy) {
  const f = [...new Set(fechasAsistio)].sort();
  if (!f.length) return { visitas: 0, ultima: null, frecuencia_dias: null, proxima_estimada: null, dias_sin_venir: null };
  const gaps = f.slice(1).map((x, i) => difDias(f[i], x)).filter((d) => d > 0);
  const frecuencia = gaps.length ? Math.round(gaps.reduce((a, d) => a + d, 0) / gaps.length) : null;
  const ultima = f[f.length - 1];
  return {
    visitas: f.length, ultima, frecuencia_dias: frecuencia,
    proxima_estimada: frecuencia ? sumarDias(ultima, frecuencia) : null,
    dias_sin_venir: difDias(ultima, hoy),
  };
}

export function rutasClientas(r) {
  r.get('/api/panel/etiquetas', 'sesion', async ({ db, sesion }) => {
    if (!puede(sesion, 'ver_clientas')) falla(403, 'No tienes permiso para ver clientas.');
    return { etiquetas: (await db.prepare('SELECT id, nombre, color, orden FROM etiquetas ORDER BY orden, nombre').all()).results };
  });

  r.post('/api/panel/etiquetas', 'propietaria', async ({ db, body }) => {
    const nombre = v.texto(body.nombre, 'nombre', { min: 2, max: 30 });
    const color = COLOR.test(String(body.color)) ? body.color : '#A98BBE';
    try {
      const f = await db.prepare('INSERT INTO etiquetas (nombre, color, orden) VALUES (?, ?, (SELECT COALESCE(MAX(orden),0)+1 FROM etiquetas)) RETURNING id').bind(nombre, color).first();
      return { id: f.id };
    } catch (e) { if (/UNIQUE/i.test(String(e.message))) falla(409, 'Ya existe esa etiqueta.'); throw e; }
  });

  r.put('/api/panel/etiquetas/:id', 'propietaria', async ({ db, params, body }) => {
    const id = v.entero(Number(params.id), 'etiqueta', { min: 1 });
    try {
      await db.prepare('UPDATE etiquetas SET nombre = ?, color = ? WHERE id = ?')
        .bind(v.texto(body.nombre, 'nombre', { min: 2, max: 30 }), COLOR.test(String(body.color)) ? body.color : '#A98BBE', id).run();
    } catch (e) { if (/UNIQUE/i.test(String(e.message))) falla(409, 'Ya existe esa etiqueta.'); throw e; }
    return { ok: true };
  });

  r.delete('/api/panel/etiquetas/:id', 'propietaria', async ({ db, params }) => {
    await db.prepare('DELETE FROM etiquetas WHERE id = ?').bind(v.entero(Number(params.id), 'etiqueta', { min: 1 })).run();
    return { ok: true };
  });

  r.put('/api/panel/clientas/:id/etiquetas', 'propietaria', async ({ db, params, body }) => {
    const id = v.entero(Number(params.id), 'clienta', { min: 1 });
    const ids = Array.isArray(body.ids) ? body.ids.slice(0, 20).map((x) => v.entero(Number(x), 'etiqueta', { min: 1 })) : [];
    await db.batch([
      db.prepare('DELETE FROM clienta_etiquetas WHERE clienta_id = ?').bind(id),
      ...ids.map((e) => db.prepare('INSERT OR IGNORE INTO clienta_etiquetas (clienta_id, etiqueta_id) SELECT ?, id FROM etiquetas WHERE id = ?').bind(id, e)),
    ]);
    return { ok: true };
  });

  // Eliminar: si nunca tuvo citas se borra; si tiene historial (cobros, analítica) se anonimiza para no
  // descuadrar las cuentas, y sus citas futuras se cancelan.
  r.delete('/api/panel/clientas/:id', 'propietaria', async ({ db, sesion, params }) => {
    const id = v.entero(Number(params.id), 'clienta', { min: 1 });
    const cl = await db.prepare('SELECT id, nombre FROM clientas WHERE id = ?').bind(id).first();
    if (!cl) falla(404, 'La clienta no existe.');
    const tiene = await db.prepare('SELECT COUNT(*) AS n FROM citas WHERE clienta_id = ?').bind(id).first();
    const hoy = ahoraBogota().fecha;
    if (!tiene.n) {
      await db.batch([
        db.prepare('UPDATE ventas SET clienta_id = NULL WHERE clienta_id = ?').bind(id),
        db.prepare('DELETE FROM clientas WHERE id = ?').bind(id),
      ]);
      return { ok: true, borrada: true };
    }
    await db.batch([
      db.prepare(`DELETE FROM cita_slots WHERE cita_id IN (SELECT id FROM citas WHERE clienta_id = ? AND estado = 'confirmada' AND fecha >= ?)`).bind(id, hoy),
      db.prepare(`UPDATE citas SET estado = 'cancelada', actualizado = datetime('now') WHERE clienta_id = ? AND estado = 'confirmada' AND fecha >= ?`).bind(id, hoy),
      db.prepare(`UPDATE clientas SET nombre = 'Clienta eliminada', celular = ?, email = '', notas = '', preferencias = '', cumpleanos = '' WHERE id = ?`).bind(`eliminada-${id}`, id),
      db.prepare('DELETE FROM clienta_etiquetas WHERE clienta_id = ?').bind(id),
      db.prepare('DELETE FROM push_suscripciones WHERE clienta_id = ?').bind(id),
      db.prepare("INSERT INTO registro (quien, accion, detalle) VALUES (?, 'clienta_eliminada', ?)").bind(`${sesion.nombre} (#${sesion.id})`, String(id)),
    ]);
    return { ok: true, anonimizada: true };
  });
}
