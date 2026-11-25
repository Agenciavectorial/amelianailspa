// Seguridad (solo Erika): pausa de emergencia de las reservas en línea, revisión y borrado en bloque de
// reservas sospechosas, y copias de seguridad.
import { falla } from '../http.js';
import * as v from '../validar.js';
import { hacerRespaldo, descomprimir } from '../respaldo.js';

const quien = (s) => `${s.nombre} (#${s.id})`;

export function rutasSeguridad(r) {
  r.get('/api/panel/seguridad', 'propietaria', async ({ db, q }) => {
    const horas = v.entero(Number(q.get('horas') || 48), 'horas', { min: 1, max: 720 });
    const [aj, citas, resp] = await db.batch([
      db.prepare("SELECT clave, valor FROM ajustes WHERE clave IN ('reservas_pausadas', 'pausa_mensaje', 'max_citas_por_celular', 'max_reservas_celular_dia')"),
      // Reservas en línea recientes, con la huella de IP (no la IP) para ver si muchas vienen del mismo lugar.
      db.prepare(
        `SELECT ci.id, ci.codigo, ci.fecha, ci.inicio, ci.estado, ci.creado, ci.ip_hash, cl.nombre AS clienta, cl.celular, co.nombre AS colaboradora,
                (SELECT GROUP_CONCAT(nombre, ' + ') FROM cita_servicios cs WHERE cs.cita_id = ci.id) AS servicios,
                (SELECT COUNT(*) FROM pagos p WHERE p.cita_id = ci.id) AS cobros
           FROM citas ci JOIN clientas cl ON cl.id = ci.clienta_id JOIN colaboradoras co ON co.id = ci.colaboradora_id
          WHERE ci.origen = 'web' AND ci.creado >= datetime('now', ?) ORDER BY ci.creado DESC LIMIT 500`
      ).bind(`-${horas} hours`),
      db.prepare('SELECT id, fecha, destino, clave, bytes, filas, datos IS NOT NULL AS en_base, creado FROM respaldos ORDER BY id DESC LIMIT 14'),
    ]);
    const a = Object.fromEntries(aj.results.map((x) => [x.clave, x.valor]));
    const porIp = {};
    for (const c of citas.results) if (c.ip_hash) porIp[c.ip_hash] = (porIp[c.ip_hash] || 0) + 1;
    const porCel = {};
    for (const c of citas.results) porCel[c.celular] = (porCel[c.celular] || 0) + 1;
    return {
      pausadas: a.reservas_pausadas === '1', mensaje: a.pausa_mensaje || '',
      horas,
      // Sospechosa: muchas desde la misma conexión o el mismo número en poco tiempo.
      reservas: citas.results.map((c) => ({ ...c, mismas_ip: c.ip_hash ? porIp[c.ip_hash] : 1, mismo_cel: porCel[c.celular], sospechosa: (c.ip_hash && porIp[c.ip_hash] >= 4) || porCel[c.celular] >= 3 })),
      respaldos: resp.results.map((x) => ({ ...x, en_base: !!x.en_base })),
    };
  });

  r.put('/api/panel/seguridad/pausa', 'propietaria', async ({ db, sesion, body }) => {
    const pausadas = v.bool(body.pausadas);
    const sent = [db.prepare("INSERT INTO ajustes (clave, valor) VALUES ('reservas_pausadas', ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor").bind(pausadas ? '1' : '0')];
    if (body.mensaje !== undefined) {
      sent.push(db.prepare("INSERT INTO ajustes (clave, valor) VALUES ('pausa_mensaje', ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor")
        .bind(v.texto(body.mensaje, 'mensaje', { max: 200, opcional: true })));
    }
    sent.push(db.prepare("INSERT INTO registro (quien, accion, detalle) VALUES (?, 'seguridad', ?)").bind(quien(sesion), pausadas ? 'reservas pausadas' : 'reservas reanudadas'));
    await db.batch(sent);
    return { ok: true, pausadas };
  });

  // Borra en bloque citas creadas en línea (p. ej. un ataque que llenó la agenda). Las que ya tienen cobros no se tocan.
  r.post('/api/panel/seguridad/borrar-citas', 'propietaria', async ({ db, sesion, body }) => {
    const ids = Array.isArray(body.ids) ? body.ids.map((x) => v.entero(Number(x), 'cita', { min: 1 })) : falla(400, 'Faltan las citas.');
    if (!ids.length || ids.length > 500) falla(400, 'Elige entre 1 y 500 citas.');
    let borradas = 0;
    for (let i = 0; i < ids.length; i += 50) {
      const lote = ids.slice(i, i + 50);
      const marcas = lote.map(() => '?').join(',');
      const cond = `id IN (${marcas}) AND origen = 'web' AND NOT EXISTS (SELECT 1 FROM pagos p WHERE p.cita_id = citas.id)`;
      const [, , , del] = await db.batch([
        db.prepare(`DELETE FROM cita_slots WHERE cita_id IN (SELECT id FROM citas WHERE ${cond})`).bind(...lote),
        db.prepare(`DELETE FROM cita_servicios WHERE cita_id IN (SELECT id FROM citas WHERE ${cond})`).bind(...lote),
        db.prepare(`DELETE FROM registro WHERE cita_id IN (SELECT id FROM citas WHERE ${cond})`).bind(...lote),
        db.prepare(`DELETE FROM citas WHERE ${cond}`).bind(...lote),
      ]);
      borradas += del.meta.changes || 0;
    }
    // Clientas que quedaron sin ninguna cita (creadas por el ataque)
    await db.prepare('DELETE FROM clientas WHERE NOT EXISTS (SELECT 1 FROM citas WHERE citas.clienta_id = clientas.id) AND NOT EXISTS (SELECT 1 FROM ventas WHERE ventas.clienta_id = clientas.id) AND creado >= datetime(\'now\', \'-30 days\') AND notas = \'\'').run();
    await db.prepare("INSERT INTO registro (quien, accion, detalle) VALUES (?, 'seguridad', ?)").bind(quien(sesion), `borradas ${borradas} reservas en línea`).run();
    return { ok: true, borradas };
  });

  // ---------- copias de seguridad ----------
  r.post('/api/panel/respaldos', 'propietaria', async ({ env }) => hacerRespaldo(env, { motivo: 'manual' }));

  r.get('/api/panel/respaldos/:id', 'propietaria', async ({ db, env, params }) => {
    const f = await db.prepare('SELECT fecha, destino, clave, datos FROM respaldos WHERE id = ?').bind(v.entero(Number(params.id), 'respaldo', { min: 1 })).first();
    if (!f) falla(404, 'No existe ese respaldo.');
    let gz = f.datos;
    if (!gz && f.destino === 'r2' && env.RESPALDOS) gz = await (await env.RESPALDOS.get(f.clave))?.arrayBuffer();
    if (!gz) falla(404, 'Ese respaldo ya no está disponible.');
    const texto = await descomprimir(gz instanceof ArrayBuffer ? new Uint8Array(gz) : new Uint8Array(gz));
    return new Response(texto, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="respaldo-amelia-${f.fecha}.json"`,
        'Cache-Control': 'no-store',
      },
    });
  });
}

