// Feed de calendario suscribible (Google Calendar, iPhone): uno por colaboradora y uno general.
import { falla } from '../http.js';
import { generarICS, respuestaICS } from '../ics.js';
import { ahoraBogota, sumarDias } from '../tiempo.js';

export function rutasFeed(r) {
  r.get('/api/ics/:archivo', 'publico', async ({ db, params }) => {
    const token = String(params.archivo).replace(/\.ics$/, '');
    if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) falla(404, 'Calendario no encontrado.');
    let colab = await db.prepare('SELECT id, nombre FROM colaboradoras WHERE ics_token = ? AND activa = 1').bind(token).first();
    let general = false;
    if (!colab) {
      const g = await db.prepare(`SELECT valor FROM ajustes WHERE clave = 'ics_token_general'`).first();
      if (!g || !g.valor || g.valor !== token) falla(404, 'Calendario no encontrado.');
      general = true;
    }
    const hoy = ahoraBogota().fecha;
    const desde = sumarDias(hoy, -30), hasta = sumarDias(hoy, 120);
    const filtro = general ? '' : 'AND ci.colaboradora_id = ?';
    const extra = general ? [] : [colab.id];
    const [citas, serv, bloq, dir] = await db.batch([
      db.prepare(
        `SELECT ci.id, ci.codigo, ci.fecha, ci.inicio, ci.fin, ci.estado, ci.notas, cl.nombre AS clienta, cl.celular, co.nombre AS colaboradora
           FROM citas ci JOIN clientas cl ON cl.id = ci.clienta_id JOIN colaboradoras co ON co.id = ci.colaboradora_id
          WHERE ci.fecha BETWEEN ? AND ? AND ci.estado <> 'cancelada' ${filtro}`
      ).bind(desde, hasta, ...extra),
      db.prepare(
        `SELECT cs.cita_id, cs.nombre FROM cita_servicios cs JOIN citas ci ON ci.id = cs.cita_id
          WHERE ci.fecha BETWEEN ? AND ? AND ci.estado <> 'cancelada' ${filtro} ORDER BY cs.orden`
      ).bind(desde, hasta, ...extra),
      db.prepare(
        `SELECT b.id, b.fecha, b.inicio, b.fin, b.motivo, b.colaboradora_id FROM bloqueos b
          WHERE b.fecha BETWEEN ? AND ? ${general ? '' : 'AND (b.colaboradora_id IS NULL OR b.colaboradora_id = ?)'}`
      ).bind(desde, hasta, ...extra),
      db.prepare(`SELECT valor FROM ajustes WHERE clave = 'direccion'`),
    ]);
    const nombres = {};
    for (const s of serv.results) (nombres[s.cita_id] ||= []).push(s.nombre);
    const ubicacion = dir.results[0]?.valor || '';
    const eventos = citas.results.map((c) => ({
      uid: `cita-${c.id}@amelianailspa.com`, fecha: c.fecha, inicio: c.inicio, fin: c.fin,
      titulo: `${general ? c.colaboradora + ' · ' : ''}${(nombres[c.id] || []).join(' + ')} · ${c.clienta}`,
      descripcion: `Código ${c.codigo}\nClienta: ${c.clienta} (+${c.celular})${c.notas ? '\nNotas: ' + c.notas : ''}\nEstado: ${c.estado}`,
      ubicacion,
    }));
    for (const b of bloq.results) {
      if (general && b.colaboradora_id != null) continue;
      eventos.push({
        uid: `bloqueo-${b.id}@amelianailspa.com`, fecha: b.fecha, inicio: b.inicio, fin: Math.min(b.fin, 1440 - 1),
        titulo: `Bloqueado${b.motivo ? ': ' + b.motivo : ''}`,
      });
    }
    const nombre = general ? 'Amelia Nail Spa · Todas las citas' : `Amelia Nail Spa · ${colab.nombre}`;
    return respuestaICS(generarICS(eventos, { nombre }));
  });
}
