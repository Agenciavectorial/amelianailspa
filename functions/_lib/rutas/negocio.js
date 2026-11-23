// Fase 2 del panel: cobros, citas por gestionar, analítica, notas, plantillas de mensajes,
// registro de mensajes, fidelización (ciclo de retorno) y promociones.
import { falla } from '../http.js';
import * as v from '../validar.js';
import { puede } from '../auth.js';
import { leerAjustes, ESTADOS_ACTIVOS } from '../reservas.js';
import { ahoraBogota, sumarDias, difDias } from '../tiempo.js';

export const METODOS = ['efectivo', 'nequi', 'daviplata', 'tarjeta', 'transferencia', 'otro'];
const quien = (s) => `${s.nombre} (#${s.id})`;

function exigirCitaPropia(sesion, cita) {
  if (!sesion.esPropietaria && cita.colaboradora_id !== sesion.id) falla(403, 'Esta cita no es tuya.');
}

function rangoMes(hoy) {
  return { desde: hoy.slice(0, 8) + '01', hasta: hoy };
}

export function rutasNegocio(r) {
  // ---------- cobros ----------
  r.get('/api/panel/citas/:id/pagos', 'sesion', async ({ db, sesion, params }) => {
    const cita = await db.prepare('SELECT id, colaboradora_id FROM citas WHERE id = ?').bind(v.entero(Number(params.id), 'cita', { min: 1 })).first();
    if (!cita) falla(404, 'La cita no existe.');
    exigirCitaPropia(sesion, cita);
    const { results } = await db.prepare('SELECT id, monto, propina, metodo, nota, creado FROM pagos WHERE cita_id = ? ORDER BY id').bind(cita.id).all();
    return { pagos: results };
  });

  r.post('/api/panel/citas/:id/pagos', 'sesion', async ({ db, sesion, params, body }) => {
    if (!puede(sesion, 'gestionar_citas')) falla(403, 'No tienes permiso para registrar cobros.');
    const cita = await db.prepare('SELECT id, colaboradora_id, fecha, estado FROM citas WHERE id = ?').bind(v.entero(Number(params.id), 'cita', { min: 1 })).first();
    if (!cita) falla(404, 'La cita no existe.');
    exigirCitaPropia(sesion, cita);
    if (cita.estado === 'cancelada') falla(409, 'La cita está cancelada.');
    const monto = v.entero(Number(body.monto), 'monto', { min: 0, max: 50_000_000 });
    const propina = v.entero(Number(body.propina || 0), 'propina', { min: 0, max: 10_000_000 });
    if (!METODOS.includes(body.metodo)) falla(400, 'Elige el método de pago.');
    const sent = [
      db.prepare('INSERT INTO pagos (cita_id, fecha, monto, propina, metodo, nota, registrado_por) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind(cita.id, cita.fecha, monto, propina, body.metodo, v.texto(body.nota, 'nota', { max: 200, opcional: true }), sesion.id),
      db.prepare(`INSERT INTO registro (quien, accion, cita_id, detalle) VALUES (?, 'cobro', ?, ?)`).bind(quien(sesion), cita.id, `${monto} ${body.metodo}`),
    ];
    // Cobrar implica que asistió
    if (cita.estado === 'confirmada' || cita.estado === 'no_asistio') {
      sent.push(db.prepare(`UPDATE citas SET estado = 'asistio', actualizado = datetime('now') WHERE id = ?`).bind(cita.id));
    }
    await db.batch(sent);
    return { ok: true };
  });

  r.delete('/api/panel/pagos/:id', 'propietaria', async ({ db, params }) => {
    await db.prepare('DELETE FROM pagos WHERE id = ?').bind(v.entero(Number(params.id), 'pago', { min: 1 })).run();
    return { ok: true };
  });

  // ---------- citas por gestionar: ya pasaron y nadie marcó si asistió ----------
  r.get('/api/panel/por-gestionar', 'sesion', async ({ db, sesion }) => {
    const { fecha: hoy, minuto } = ahoraBogota();
    const filtro = sesion.esPropietaria ? '' : 'AND ci.colaboradora_id = ?';
    const { results } = await db.prepare(
      `SELECT ci.id, ci.fecha, ci.inicio, ci.fin, ci.colaboradora_id, ci.precio_total, ci.clienta_id,
              cl.nombre AS clienta_nombre, cl.celular AS clienta_celular, co.nombre AS colaboradora_nombre,
              (SELECT GROUP_CONCAT(nombre, ' + ') FROM cita_servicios cs WHERE cs.cita_id = ci.id) AS servicios
         FROM citas ci JOIN clientas cl ON cl.id = ci.clienta_id JOIN colaboradoras co ON co.id = ci.colaboradora_id
        WHERE ci.estado = 'confirmada' AND ci.fecha >= ? AND (ci.fecha < ? OR (ci.fecha = ? AND ci.fin <= ?)) ${filtro}
        ORDER BY ci.fecha DESC, ci.inicio DESC LIMIT 50`
    ).bind(sumarDias(hoy, -30), hoy, hoy, minuto, ...(sesion.esPropietaria ? [] : [sesion.id])).all();
    return { citas: results };
  });

  // ---------- resumen ampliado (dashboard) ----------
  r.get('/api/panel/resumen2', 'sesion', async ({ db, sesion }) => {
    const { fecha: hoy, minuto } = ahoraBogota();
    const { desde } = rangoMes(hoy);
    const f = sesion.esPropietaria ? '' : 'AND ci.colaboradora_id = ?';
    const b = sesion.esPropietaria ? [] : [sesion.id];
    const [ing, asis, sem, prox, men, cli] = await db.batch([
      db.prepare(`SELECT COALESCE(SUM(p.monto), 0) AS total, COALESCE(SUM(p.propina), 0) AS propinas, COUNT(DISTINCT p.cita_id) AS citas FROM pagos p JOIN citas ci ON ci.id = p.cita_id WHERE p.fecha BETWEEN ? AND ? ${f}`).bind(desde, hoy, ...b),
      db.prepare(`SELECT SUM(estado = 'asistio') AS si, SUM(estado = 'no_asistio') AS no FROM citas ci WHERE fecha BETWEEN ? AND ? ${f}`).bind(desde, hoy, ...b),
      db.prepare(`SELECT COUNT(*) AS n FROM citas ci WHERE fecha BETWEEN ? AND ? AND estado IN ${ESTADOS_ACTIVOS} ${f}`).bind(hoy, sumarDias(hoy, 6), ...b),
      db.prepare(
        `SELECT ci.id, ci.fecha, ci.inicio, cl.nombre AS clienta_nombre, co.nombre AS colaboradora_nombre,
                (SELECT GROUP_CONCAT(nombre, ' + ') FROM cita_servicios cs WHERE cs.cita_id = ci.id) AS servicios
           FROM citas ci JOIN clientas cl ON cl.id = ci.clienta_id JOIN colaboradoras co ON co.id = ci.colaboradora_id
          WHERE ci.estado = 'confirmada' AND (ci.fecha > ? OR (ci.fecha = ? AND ci.inicio >= ?)) ${f}
          ORDER BY ci.fecha, ci.inicio LIMIT 1`
      ).bind(hoy, hoy, minuto, ...b),
      db.prepare(`SELECT COUNT(*) AS n FROM mensajes WHERE creado >= ?`).bind(desde),
      db.prepare(
        `SELECT SUM(primera >= ?) AS nuevas, SUM(primera < ?) AS recurrentes FROM (
           SELECT ci.clienta_id, (SELECT MIN(x.fecha) FROM citas x WHERE x.clienta_id = ci.clienta_id AND x.estado <> 'cancelada') AS primera
             FROM citas ci WHERE ci.fecha BETWEEN ? AND ? AND ci.estado <> 'cancelada' ${f} GROUP BY ci.clienta_id)`
      ).bind(desde, desde, desde, hoy, ...b),
    ]);
    const a = asis.results[0];
    return {
      hoy,
      ingresos_mes: ing.results[0],
      asistencia_mes: { si: a.si || 0, no: a.no || 0, pct: (a.si || 0) + (a.no || 0) ? Math.round(((a.si || 0) * 100) / ((a.si || 0) + (a.no || 0))) : null },
      citas_semana: sem.results[0].n,
      proxima: prox.results[0] || null,
      mensajes_mes: men.results[0].n,
      clientas_mes: { nuevas: cli.results[0]?.nuevas || 0, recurrentes: cli.results[0]?.recurrentes || 0 },
    };
  });

  // ---------- analítica (Erika) ----------
  r.get('/api/panel/analitica', 'propietaria', async ({ db, q }) => {
    const hoy = ahoraBogota().fecha;
    const desde = q.get('desde') ? v.fecha(q.get('desde'), 'desde') : rangoMes(hoy).desde;
    const hasta = q.get('hasta') ? v.fecha(q.get('hasta'), 'hasta') : hoy;
    if (difDias(desde, hasta) < 0 || difDias(desde, hasta) > 400) falla(400, 'Rango inválido (máximo ~13 meses).');
    const [tot, met, col, serv, est, dia, cli, org] = await db.batch([
      db.prepare('SELECT COALESCE(SUM(monto),0) AS ingresos, COALESCE(SUM(propina),0) AS propinas, COUNT(DISTINCT cita_id) AS citas_cobradas FROM pagos WHERE fecha BETWEEN ? AND ?').bind(desde, hasta),
      db.prepare('SELECT metodo, SUM(monto) AS total, COUNT(*) AS n FROM pagos WHERE fecha BETWEEN ? AND ? GROUP BY metodo ORDER BY total DESC').bind(desde, hasta),
      db.prepare(
        `SELECT co.id, co.nombre, co.color,
                (SELECT COUNT(*) FROM citas c WHERE c.colaboradora_id = co.id AND c.fecha BETWEEN ?1 AND ?2 AND c.estado = 'asistio') AS atendidas,
                (SELECT COUNT(*) FROM citas c WHERE c.colaboradora_id = co.id AND c.fecha BETWEEN ?1 AND ?2 AND c.estado = 'no_asistio') AS faltas,
                (SELECT COALESCE(SUM(p.monto),0) FROM pagos p JOIN citas c ON c.id = p.cita_id WHERE c.colaboradora_id = co.id AND p.fecha BETWEEN ?1 AND ?2) AS ingresos
           FROM colaboradoras co WHERE co.agenda = 1 OR co.id IN (SELECT colaboradora_id FROM citas WHERE fecha BETWEEN ?1 AND ?2)
          ORDER BY ingresos DESC, atendidas DESC`
      ).bind(desde, hasta),
      db.prepare(
        `SELECT cs.nombre, COUNT(*) AS n, COALESCE(SUM(cs.precio),0) AS valor FROM cita_servicios cs JOIN citas c ON c.id = cs.cita_id
          WHERE c.fecha BETWEEN ? AND ? AND c.estado IN ('asistio','confirmada') GROUP BY cs.nombre ORDER BY n DESC LIMIT 12`
      ).bind(desde, hasta),
      db.prepare('SELECT estado, COUNT(*) AS n FROM citas WHERE fecha BETWEEN ? AND ? GROUP BY estado').bind(desde, hasta),
      db.prepare(`SELECT CAST(strftime('%w', fecha) AS INTEGER) AS dia, COUNT(*) AS n FROM citas WHERE fecha BETWEEN ? AND ? AND estado <> 'cancelada' GROUP BY dia`).bind(desde, hasta),
      db.prepare(
        `SELECT SUM(primera >= ?1) AS nuevas, SUM(primera < ?1) AS recurrentes FROM (
           SELECT c.clienta_id, (SELECT MIN(x.fecha) FROM citas x WHERE x.clienta_id = c.clienta_id AND x.estado <> 'cancelada') AS primera
             FROM citas c WHERE c.fecha BETWEEN ?1 AND ?2 AND c.estado <> 'cancelada' GROUP BY c.clienta_id)`
      ).bind(desde, hasta),
      db.prepare(`SELECT origen, COUNT(*) AS n FROM citas WHERE fecha BETWEEN ? AND ? AND estado <> 'cancelada' GROUP BY origen`).bind(desde, hasta),
    ]);
    const estados = Object.fromEntries(est.results.map((e) => [e.estado, e.n]));
    const si = estados.asistio || 0, no = estados.no_asistio || 0;
    const t = tot.results[0];
    return {
      desde, hasta, ...t,
      ticket_promedio: t.citas_cobradas ? Math.round(t.ingresos / t.citas_cobradas) : null,
      asistencia_pct: si + no ? Math.round((si * 100) / (si + no)) : null,
      estados, metodos: met.results, colaboradoras: col.results, servicios: serv.results,
      por_dia: Array.from({ length: 7 }, (_, d) => dia.results.find((x) => x.dia === d)?.n || 0),
      clientas: { nuevas: cli.results[0]?.nuevas || 0, recurrentes: cli.results[0]?.recurrentes || 0 },
      origen: Object.fromEntries(org.results.map((o) => [o.origen, o.n])),
    };
  });

  // ---------- notas rápidas del negocio ----------
  r.get('/api/panel/notas', 'sesion', async ({ db }) => {
    const { results } = await db.prepare(
      `SELECT n.*, c.nombre AS autor FROM notas_negocio n LEFT JOIN colaboradoras c ON c.id = n.autor_id
        ORDER BY n.hecha, n.fijada DESC, n.id DESC LIMIT 200`
    ).all();
    return { notas: results };
  });
  r.post('/api/panel/notas', 'sesion', async ({ db, sesion, body }) => {
    const f = await db.prepare('INSERT INTO notas_negocio (texto, autor_id, fijada) VALUES (?, ?, ?) RETURNING id')
      .bind(v.texto(body.texto, 'nota', { min: 1, max: 500 }), sesion.id, v.bool(body.fijada) ? 1 : 0).first();
    return { id: f.id };
  });
  r.patch('/api/panel/notas/:id', 'sesion', async ({ db, params, body }) => {
    const id = v.entero(Number(params.id), 'nota', { min: 1 });
    if (body.hecha !== undefined) await db.prepare('UPDATE notas_negocio SET hecha = ? WHERE id = ?').bind(v.bool(body.hecha) ? 1 : 0, id).run();
    if (body.fijada !== undefined) await db.prepare('UPDATE notas_negocio SET fijada = ? WHERE id = ?').bind(v.bool(body.fijada) ? 1 : 0, id).run();
    return { ok: true };
  });
  r.delete('/api/panel/notas/:id', 'sesion', async ({ db, sesion, params }) => {
    const n = await db.prepare('SELECT autor_id FROM notas_negocio WHERE id = ?').bind(v.entero(Number(params.id), 'nota', { min: 1 })).first();
    if (!n) falla(404, 'La nota no existe.');
    if (!sesion.esPropietaria && n.autor_id !== sesion.id) falla(403, 'Solo quien la escribió o Erika pueden borrarla.');
    await db.prepare('DELETE FROM notas_negocio WHERE id = ?').bind(Number(params.id)).run();
    return { ok: true };
  });

  // ---------- plantillas de mensajes ----------
  r.get('/api/panel/plantillas', 'sesion', async ({ db }) => {
    const { results } = await db.prepare('SELECT clave, titulo, texto FROM plantillas ORDER BY orden').all();
    return { plantillas: results };
  });
  r.put('/api/panel/plantillas/:clave', 'propietaria', async ({ db, params, body }) => {
    const res = await db.prepare('UPDATE plantillas SET texto = ? WHERE clave = ?')
      .bind(v.texto(body.texto, 'mensaje', { min: 5, max: 1000 }), String(params.clave).slice(0, 40)).run();
    if (!res.meta.changes) falla(404, 'Plantilla no encontrada.');
    return { ok: true };
  });

  // ---------- registro de mensajes enviados (WhatsApp prellenado) ----------
  r.post('/api/panel/mensajes', 'sesion', async ({ db, sesion, body }) => {
    const tipo = v.texto(body.tipo, 'tipo', { max: 30 });
    let clientaId = body.clienta_id ? v.entero(Number(body.clienta_id), 'clienta', { min: 1 }) : null;
    const citaId = body.cita_id ? v.entero(Number(body.cita_id), 'cita', { min: 1 }) : null;
    if (citaId) {
      const c = await db.prepare('SELECT clienta_id, colaboradora_id FROM citas WHERE id = ?').bind(citaId).first();
      if (!c) falla(404, 'La cita no existe.');
      exigirCitaPropia(sesion, c);
      clientaId = c.clienta_id;
    } else if (!sesion.esPropietaria && !puede(sesion, 'ver_clientas')) falla(403, 'No tienes permiso.');
    if (!clientaId) falla(400, 'Falta la clienta.');
    await db.prepare('INSERT INTO mensajes (clienta_id, cita_id, tipo, quien) VALUES (?, ?, ?, ?)').bind(clientaId, citaId, tipo, quien(sesion)).run();
    return { ok: true };
  });

  // ---------- fidelización ----------
  r.get('/api/panel/fidelizacion', 'sesion', async ({ db, sesion }) => {
    if (!puede(sesion, 'ver_clientas')) falla(403, 'No tienes permiso para ver clientas.');
    const hoy = ahoraBogota().fecha;
    const ajustes = await leerAjustes(db);
    const diasInactiva = Number(ajustes.dias_inactiva) || 90;
    const filtro = sesion.esPropietaria ? '' : 'AND u.colaboradora_id = ?';
    const { results } = await db.prepare(
      `WITH ultima AS (
         SELECT c.clienta_id, c.id AS cita_id, c.fecha, c.colaboradora_id,
                ROW_NUMBER() OVER (PARTITION BY c.clienta_id ORDER BY c.fecha DESC, c.inicio DESC) AS rn
           FROM citas c WHERE c.estado = 'asistio')
       SELECT u.clienta_id, cl.nombre, cl.celular, cl.cumpleanos, u.fecha AS ultima, u.cita_id, u.colaboradora_id,
              co.nombre AS colaboradora, co.slug AS colab_slug,
              (SELECT MIN(s.ciclo_dias) FROM cita_servicios cs JOIN servicios s ON s.id = cs.servicio_id WHERE cs.cita_id = u.cita_id) AS ciclo,
              (SELECT GROUP_CONCAT(cs.nombre, ' + ') FROM cita_servicios cs WHERE cs.cita_id = u.cita_id) AS servicios,
              (SELECT GROUP_CONCAT(s.slug) FROM cita_servicios cs JOIN servicios s ON s.id = cs.servicio_id WHERE cs.cita_id = u.cita_id) AS slugs,
              (SELECT COUNT(*) FROM citas x WHERE x.clienta_id = u.clienta_id AND x.estado = 'asistio') AS visitas,
              (SELECT MAX(substr(m.creado, 1, 10)) FROM mensajes m WHERE m.clienta_id = u.clienta_id AND m.tipo IN ('vuelve','recuperar')) AS ultimo_aviso
         FROM ultima u JOIN clientas cl ON cl.id = u.clienta_id JOIN colaboradoras co ON co.id = u.colaboradora_id
        WHERE u.rn = 1 ${filtro}
          AND NOT EXISTS (SELECT 1 FROM citas f WHERE f.clienta_id = u.clienta_id AND f.estado = 'confirmada' AND f.fecha >= ?)
        LIMIT 1000`
    ).bind(...(sesion.esPropietaria ? [] : [sesion.id]), hoy).all();
    const a_contactar = [], inactivas = [];
    for (const c of results) {
      const dias = difDias(c.ultima, hoy);
      const avisada = c.ultimo_aviso && c.ultimo_aviso >= c.ultima;
      c.dias = dias;
      if (dias >= diasInactiva) { if (!avisada) inactivas.push(c); continue; }
      if (c.ciclo && dias >= c.ciclo - 3 && !avisada) { c.toca = sumarDias(c.ultima, c.ciclo); a_contactar.push(c); }
    }
    a_contactar.sort((x, y) => x.toca.localeCompare(y.toca));
    inactivas.sort((x, y) => y.visitas - x.visitas || x.dias - y.dias);
    const proximos = new Set(Array.from({ length: 8 }, (_, i) => sumarDias(hoy, i).slice(5)));
    const { results: cumple } = await db.prepare(
      `SELECT id AS clienta_id, nombre, celular, cumpleanos FROM clientas WHERE cumpleanos <> '' ${sesion.esPropietaria ? '' : 'AND EXISTS (SELECT 1 FROM citas x WHERE x.clienta_id = clientas.id AND x.colaboradora_id = ?)'}`
    ).bind(...(sesion.esPropietaria ? [] : [sesion.id])).all();
    const cumpleanos = cumple.filter((c) => proximos.has(c.cumpleanos)).sort((x, y) => x.cumpleanos.localeCompare(y.cumpleanos));
    const recurrentes = results.filter((c) => c.visitas >= 2).length;
    return { a_contactar: a_contactar.slice(0, 100), inactivas: inactivas.slice(0, 100), cumpleanos, recurrentes, con_visitas: results.length, dias_inactiva: diasInactiva };
  });

  // ---------- promociones ----------
  r.get('/api/panel/promociones', 'propietaria', async ({ db }) => {
    const { results } = await db.prepare('SELECT * FROM promociones ORDER BY activa DESC, orden, id DESC').all();
    return { promociones: results };
  });
  async function guardarPromo(db, id, body) {
    const d = [
      v.texto(body.titulo, 'título', { min: 2, max: 80 }),
      v.texto(body.descripcion, 'descripción', { max: 300, opcional: true }),
      v.url(body.foto),
      body.servicio_id ? v.entero(Number(body.servicio_id), 'servicio', { min: 1 }) : null,
      body.precio_promo === '' || body.precio_promo == null ? null : v.entero(Number(body.precio_promo), 'precio', { min: 0, max: 50_000_000 }),
      body.desde ? v.fecha(body.desde, 'desde') : '',
      body.hasta ? v.fecha(body.hasta, 'hasta') : '',
      v.bool(body.activa) ? 1 : 0,
      v.entero(Number(body.orden || 0), 'orden', { min: 0, max: 999 }),
    ];
    if (id == null) return (await db.prepare('INSERT INTO promociones (titulo, descripcion, foto, servicio_id, precio_promo, desde, hasta, activa, orden) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id').bind(...d).first()).id;
    await db.prepare('UPDATE promociones SET titulo = ?, descripcion = ?, foto = ?, servicio_id = ?, precio_promo = ?, desde = ?, hasta = ?, activa = ?, orden = ? WHERE id = ?').bind(...d, id).run();
    return id;
  }
  r.post('/api/panel/promociones', 'propietaria', async ({ db, body }) => ({ id: await guardarPromo(db, null, body) }));
  r.put('/api/panel/promociones/:id', 'propietaria', async ({ db, params, body }) => {
    await guardarPromo(db, v.entero(Number(params.id), 'promoción', { min: 1 }), body);
    return { ok: true };
  });
  r.delete('/api/panel/promociones/:id', 'propietaria', async ({ db, params }) => {
    await db.prepare('DELETE FROM promociones WHERE id = ?').bind(v.entero(Number(params.id), 'promoción', { min: 1 })).run();
    return { ok: true };
  });
}
