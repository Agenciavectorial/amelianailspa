// Cuentas: ventas, comisiones, gastos (con categorías y gastos hormiga), metas y deudas.
// Erika (propietaria) ve y maneja todo. Cada chica ve SOLO lo suyo: sus servicios y lo que gana.
// Cada escritura deja una línea en `registro` para que los demás dispositivos se actualicen solos.
import { falla } from '../http.js';
import * as v from '../validar.js';
import { puede } from '../auth.js';
import { ahoraBogota, difDias, sumarDias } from '../tiempo.js';
import { repartir, pctDe, tablaComisiones, resumir, gastosHormiga, lunesDe } from '../cuentas.js';
import { leerAjustes } from '../reservas.js';

export const METODOS_PAGO = ['efectivo', 'nequi', 'daviplata', 'tarjeta', 'transferencia', 'otro'];
const COLOR = /^#[0-9a-fA-F]{6}$/;
const quien = (s) => `${s.nombre} (#${s.id})`;
const pesos = (x, campo, opc = {}) => v.entero(Number(x), campo, { min: 0, max: 100_000_000, ...opc });
const marcar = (db, s, accion, detalle = '') => db.prepare('INSERT INTO registro (quien, accion, cita_id, detalle) VALUES (?, ?, NULL, ?)').bind(quien(s), accion, detalle);

export async function cargarTablaComisiones(db) {
  const [c, s] = await db.batch([
    db.prepare('SELECT id, comision_pct FROM colaboradoras'),
    db.prepare('SELECT colaboradora_id, servicio_id, pct FROM comisiones'),
  ]);
  return tablaComisiones(c.results, s.results);
}

function rango(q, hoy) {
  const desde = q.get('desde') ? v.fecha(q.get('desde'), 'desde') : hoy.slice(0, 8) + '01';
  const hasta = q.get('hasta') ? v.fecha(q.get('hasta'), 'hasta') : hoy;
  if (difDias(desde, hasta) < 0 || difDias(desde, hasta) > 400) falla(400, 'Rango inválido (máximo ~13 meses).');
  return { desde, hasta };
}

/**
 * Ingresos (cobros de citas + ventas sin cita) repartidos por servicio, con comisión y costo de materiales.
 * `colab` limita a una chica.
 */
export async function partesDeIngresos(db, desde, hasta, colab = null) {
  const fP = colab ? 'AND COALESCE(p.colaboradora_id, c.colaboradora_id) = ?' : '';
  const fV = colab ? 'AND v.colaboradora_id = ?' : '';
  const b = colab ? [colab] : [];
  const [pagos, lineas, ventas, serv] = await db.batch([
    db.prepare(`SELECT p.id, p.fecha, p.monto, p.propina, p.metodo, p.comision, p.cita_id, COALESCE(p.colaboradora_id, c.colaboradora_id) AS colaboradora_id,
                       cl.nombre AS clienta FROM pagos p JOIN citas c ON c.id = p.cita_id JOIN clientas cl ON cl.id = c.clienta_id
                 WHERE p.fecha BETWEEN ? AND ? ${fP} ORDER BY p.fecha, p.id`).bind(desde, hasta, ...b),
    db.prepare(`SELECT cs.cita_id, cs.servicio_id, cs.nombre, cs.precio FROM cita_servicios cs
                 WHERE cs.cita_id IN (SELECT p.cita_id FROM pagos p JOIN citas c ON c.id = p.cita_id WHERE p.fecha BETWEEN ? AND ? ${fP}) ORDER BY cs.cita_id, cs.orden`).bind(desde, hasta, ...b),
    db.prepare(`SELECT v.id, v.fecha, v.concepto, v.servicio_id, v.colaboradora_id, v.monto, v.propina, v.metodo, v.comision, v.costo,
                       cl.nombre AS clienta FROM ventas v LEFT JOIN clientas cl ON cl.id = v.clienta_id
                 WHERE v.fecha BETWEEN ? AND ? ${fV} ORDER BY v.fecha, v.id`).bind(desde, hasta, ...b),
    db.prepare('SELECT id, nombre, costo FROM servicios'),
  ]);
  const tabla = await cargarTablaComisiones(db);
  const costoDe = new Map(serv.results.map((s) => [s.id, s.costo || 0]));
  const porCita = new Map();
  for (const l of lineas.results) { if (!porCita.has(l.cita_id)) porCita.set(l.cita_id, []); porCita.get(l.cita_id).push(l); }
  const partes = [], movimientos = [];
  for (const p of pagos.results) {
    const reparto = repartir(p.monto, porCita.get(p.cita_id) || []);
    // Comisión: la congelada al cobrar; si es un cobro viejo (sin comisión guardada) se calcula con el % actual.
    const comisiones = reparto.map((r) => Math.round((r.monto * pctDe(tabla, p.colaboradora_id, r.servicio_id)) / 100));
    const totalCalc = comisiones.reduce((a, x) => a + x, 0);
    const total = p.comision ?? totalCalc;
    let resto = total;
    reparto.forEach((r, i) => {
      const com = i === reparto.length - 1 ? resto : (totalCalc ? Math.round((comisiones[i] * total) / totalCalc) : 0);
      resto -= com;
      partes.push({
        fecha: p.fecha, colaboradora_id: p.colaboradora_id, servicio_id: r.servicio_id, nombre: r.nombre, monto: r.monto,
        comision: com, costo: r.servicio_id != null ? costoDe.get(r.servicio_id) || 0 : 0,
        propina: i === 0 ? p.propina : 0, metodo: p.metodo, ticket: 'p' + p.cita_id,
      });
    });
    movimientos.push({ tipo: 'cobro', id: p.id, cita_id: p.cita_id, fecha: p.fecha, concepto: reparto.map((r) => r.nombre).join(' + '), clienta: p.clienta,
      colaboradora_id: p.colaboradora_id, monto: p.monto, propina: p.propina, metodo: p.metodo, comision: total });
  }
  for (const x of ventas.results) {
    const com = x.comision ?? Math.round((x.monto * pctDe(tabla, x.colaboradora_id, x.servicio_id)) / 100);
    partes.push({
      fecha: x.fecha, colaboradora_id: x.colaboradora_id, servicio_id: x.servicio_id, nombre: x.concepto, monto: x.monto, comision: com,
      costo: x.costo || (x.servicio_id != null ? costoDe.get(x.servicio_id) || 0 : 0), propina: x.propina, metodo: x.metodo, ticket: 'v' + x.id,
    });
    movimientos.push({ tipo: 'venta', id: x.id, fecha: x.fecha, concepto: x.concepto, clienta: x.clienta || '', colaboradora_id: x.colaboradora_id,
      monto: x.monto, propina: x.propina, metodo: x.metodo, comision: com });
  }
  movimientos.sort((a, b) => (b.fecha.localeCompare(a.fecha)) || (b.id - a.id));
  return { partes, movimientos };
}

export function rutasCuentas(r) {
  // ---------- resumen (Erika: todo el spa; chica: lo suyo) ----------
  r.get('/api/panel/cuentas', 'sesion', async ({ db, sesion, q }) => {
    const hoy = ahoraBogota().fecha;
    const { desde, hasta } = rango(q, hoy);
    const agrupar = ['dia', 'semana', 'mes'].includes(q.get('agrupar')) ? q.get('agrupar') : (difDias(desde, hasta) > 62 ? 'mes' : difDias(desde, hasta) > 21 ? 'semana' : 'dia');
    if (!sesion.esPropietaria) {
      // Vista de la chica: hoy, esta semana, este mes y lo del rango pedido. Nada de otras chicas ni gastos del spa.
      const inicioMes = hoy.slice(0, 8) + '01';
      const lunes = lunesDe(hoy);
      const desdeTodo = [desde, inicioMes, lunes].sort()[0];
      const { partes, movimientos } = await partesDeIngresos(db, desdeTodo, [hasta, hoy].sort().at(-1), sesion.id);
      const gana = (l) => ({ servicios: l.length, ventas: l.reduce((a, p) => a + p.monto, 0), comision: l.reduce((a, p) => a + p.comision, 0), propinas: l.reduce((a, p) => a + (p.propina || 0), 0) });
      const en = (a, b) => partes.filter((p) => p.fecha >= a && p.fecha <= b);
      const tabla = await cargarTablaComisiones(db);
      const t = tabla.get(sesion.id);
      return {
        propia: true, desde, hasta, hoy,
        dia: gana(en(hoy, hoy)), semana: gana(en(lunes, hoy)), mes: gana(en(inicioMes, hoy)), rango: gana(en(desde, hasta)),
        serie: resumir(en(desde, hasta), [], { agrupar }).serie.map((x) => ({ periodo: x.periodo, ingresos: x.ingresos })),
        movimientos: movimientos.filter((m) => m.fecha >= desde && m.fecha <= hasta).slice(0, 200),
        comision_pct: t?.general ?? 0,
      };
    }
    const [{ partes, movimientos }, gas, ajustes, colab] = await Promise.all([
      partesDeIngresos(db, desde, hasta),
      db.prepare(`SELECT g.id, g.fecha, g.descripcion AS concepto, g.monto, g.metodo, g.nota, g.categoria_id, gc.nombre AS categoria, gc.color
                    FROM gastos g LEFT JOIN gasto_categorias gc ON gc.id = g.categoria_id WHERE g.fecha BETWEEN ? AND ? ORDER BY g.fecha DESC, g.id DESC`).bind(desde, hasta).all(),
      leerAjustes(db),
      db.prepare('SELECT id, nombre, color FROM colaboradoras').all(),
    ]);
    const res = resumir(partes, gas.results, { agrupar });
    const nombres = new Map(colab.results.map((c) => [c.id, c]));
    res.chicas = res.chicas.map((c) => ({ ...c, nombre: nombres.get(c.colaboradora_id)?.nombre || 'Sin asignar', color: nombres.get(c.colaboradora_id)?.color || '#A98BBE' }));
    const porCat = new Map();
    for (const g of gas.results) {
      const k = g.categoria || 'Sin categoría';
      const x = porCat.get(k) || { categoria: k, color: g.color || '#9C8FA8', total: 0, n: 0 };
      x.total += g.monto; x.n++;
      porCat.set(k, x);
    }
    return {
      propia: false, desde, hasta, hoy, agrupar, ...res,
      gastos_categorias: [...porCat.values()].sort((a, b) => b.total - a.total),
      hormiga: gastosHormiga(gas.results, { umbral: Number(ajustes.hormiga_umbral) || 20000, alerta: Number(ajustes.hormiga_alerta) || 150000 }),
      movimientos: movimientos.slice(0, 300).map((m) => ({ ...m, colaboradora: nombres.get(m.colaboradora_id)?.nombre || '' })),
      lista_gastos: gas.results.slice(0, 300),
    };
  });

  // ---------- ventas sin cita ----------
  r.post('/api/panel/ventas', 'sesion', async ({ db, sesion, body }) => {
    if (!puede(sesion, 'gestionar_citas')) falla(403, 'No tienes permiso para registrar ventas.');
    const hoy = ahoraBogota().fecha;
    const fecha = body.fecha ? v.fecha(body.fecha) : hoy;
    if (!sesion.esPropietaria && (difDias(fecha, hoy) > 2 || difDias(fecha, hoy) < 0)) falla(400, 'Solo puedes registrar ventas de hoy o de los últimos 2 días.');
    const colab = sesion.esPropietaria ? (body.colaboradora_id ? v.entero(Number(body.colaboradora_id), 'colaboradora', { min: 1 }) : null) : sesion.id;
    const servicioId = body.servicio_id ? v.entero(Number(body.servicio_id), 'servicio', { min: 1 }) : null;
    const serv = servicioId ? await db.prepare('SELECT id, nombre, costo FROM servicios WHERE id = ?').bind(servicioId).first() : null;
    if (servicioId && !serv) falla(404, 'El servicio no existe.');
    const concepto = v.texto(body.concepto || serv?.nombre, 'concepto', { min: 2, max: 120 });
    const monto = pesos(body.monto, 'valor');
    const propina = pesos(body.propina || 0, 'propina');
    if (!METODOS_PAGO.includes(body.metodo)) falla(400, 'Elige el método de pago.');
    const tabla = await cargarTablaComisiones(db);
    const comision = colab ? Math.round((monto * pctDe(tabla, colab, servicioId)) / 100) : 0;
    const clientaId = body.clienta_id ? v.entero(Number(body.clienta_id), 'clienta', { min: 1 }) : null;
    const [ins] = await db.batch([
      db.prepare(`INSERT INTO ventas (fecha, concepto, servicio_id, colaboradora_id, clienta_id, monto, propina, metodo, comision, costo, nota, registrado_por)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`)
        .bind(fecha, concepto, servicioId, colab, clientaId, monto, propina, body.metodo, comision, serv?.costo || 0, v.texto(body.nota, 'nota', { max: 200, opcional: true }), sesion.id),
      marcar(db, sesion, 'venta', `${monto} ${body.metodo}`),
    ]);
    return { ok: true, id: ins.results[0].id, comision };
  });

  r.delete('/api/panel/ventas/:id', 'sesion', async ({ db, sesion, params }) => {
    const id = v.entero(Number(params.id), 'venta', { min: 1 });
    const x = await db.prepare('SELECT id, registrado_por, fecha FROM ventas WHERE id = ?').bind(id).first();
    if (!x) falla(404, 'La venta no existe.');
    if (!sesion.esPropietaria && (x.registrado_por !== sesion.id || x.fecha !== ahoraBogota().fecha)) falla(403, 'Solo Erika puede borrar esta venta.');
    await db.batch([db.prepare('DELETE FROM ventas WHERE id = ?').bind(id), marcar(db, sesion, 'venta_borrada', String(id))]);
    return { ok: true };
  });

  r.delete('/api/panel/cobros/:id', 'propietaria', async ({ db, sesion, params }) => {
    const id = v.entero(Number(params.id), 'cobro', { min: 1 });
    await db.batch([db.prepare('DELETE FROM pagos WHERE id = ?').bind(id), marcar(db, sesion, 'cobro_borrado', String(id))]);
    return { ok: true };
  });

  // ---------- comisiones (Erika) ----------
  r.get('/api/panel/comisiones', 'propietaria', async ({ db }) => {
    const [c, s] = await db.batch([
      db.prepare('SELECT id, nombre, color, foto, comision_pct, activa, agenda FROM colaboradoras WHERE activa = 1 ORDER BY orden, nombre'),
      db.prepare('SELECT colaboradora_id, servicio_id, pct FROM comisiones'),
    ]);
    return { colaboradoras: c.results.map((x) => ({ ...x, servicios: Object.fromEntries(s.results.filter((y) => y.colaboradora_id === x.id).map((y) => [y.servicio_id, y.pct])) })) };
  });

  r.put('/api/panel/comisiones/:id', 'propietaria', async ({ db, sesion, params, body }) => {
    const id = v.entero(Number(params.id), 'colaboradora', { min: 1 });
    const pct = (x, campo) => { const n = Number(x); if (!Number.isFinite(n) || n < 0 || n > 100) falla(400, `${campo}: escribe un porcentaje entre 0 y 100.`); return Math.round(n * 100) / 100; };
    const general = pct(body.comision_pct, 'Comisión general');
    const servicios = body.servicios && typeof body.servicios === 'object' ? body.servicios : {};
    const filas = Object.entries(servicios).filter(([, p]) => p !== '' && p != null).map(([sid, p]) => [v.entero(Number(sid), 'servicio', { min: 1 }), pct(p, 'Comisión del servicio')]);
    await db.batch([
      db.prepare('UPDATE colaboradoras SET comision_pct = ? WHERE id = ?').bind(general, id),
      db.prepare('DELETE FROM comisiones WHERE colaboradora_id = ?').bind(id),
      ...filas.map(([sid, p]) => db.prepare('INSERT INTO comisiones (colaboradora_id, servicio_id, pct) SELECT ?, id, ? FROM servicios WHERE id = ?').bind(id, p, sid)),
      marcar(db, sesion, 'comisiones', String(id)),
    ]);
    return { ok: true };
  });

  // Recalcula con los % actuales las comisiones guardadas en un rango (por si Erika corrigió un porcentaje).
  r.post('/api/panel/comisiones/recalcular', 'propietaria', async ({ db, sesion, body }) => {
    const desde = v.fecha(body.desde, 'desde'), hasta = v.fecha(body.hasta, 'hasta');
    await db.batch([
      db.prepare('UPDATE pagos SET comision = NULL WHERE fecha BETWEEN ? AND ?').bind(desde, hasta),
      db.prepare('UPDATE ventas SET comision = NULL WHERE fecha BETWEEN ? AND ?').bind(desde, hasta),
      marcar(db, sesion, 'comisiones', `recalcular ${desde} ${hasta}`),
    ]);
    return { ok: true };
  });

  // ---------- gastos ----------
  r.get('/api/panel/gasto-categorias', 'propietaria', async ({ db }) => ({
    categorias: (await db.prepare('SELECT id, nombre, color, orden, activa FROM gasto_categorias ORDER BY activa DESC, orden, nombre').all()).results,
  }));
  r.post('/api/panel/gasto-categorias', 'propietaria', async ({ db, body }) => {
    const nombre = v.texto(body.nombre, 'nombre', { min: 2, max: 40 });
    const color = COLOR.test(String(body.color)) ? body.color : '#A98BBE';
    try {
      const f = await db.prepare('INSERT INTO gasto_categorias (nombre, color, orden) VALUES (?, ?, (SELECT COALESCE(MAX(orden),0)+1 FROM gasto_categorias)) RETURNING id').bind(nombre, color).first();
      return { id: f.id };
    } catch (e) { if (/UNIQUE/i.test(String(e.message))) falla(409, 'Ya existe esa categoría.'); throw e; }
  });
  r.put('/api/panel/gasto-categorias/:id', 'propietaria', async ({ db, params, body }) => {
    const id = v.entero(Number(params.id), 'categoría', { min: 1 });
    await db.prepare('UPDATE gasto_categorias SET nombre = ?, color = ?, activa = ? WHERE id = ?')
      .bind(v.texto(body.nombre, 'nombre', { min: 2, max: 40 }), COLOR.test(String(body.color)) ? body.color : '#A98BBE', body.activa === false ? 0 : 1, id).run();
    return { ok: true };
  });
  r.delete('/api/panel/gasto-categorias/:id', 'propietaria', async ({ db, params }) => {
    await db.prepare('DELETE FROM gasto_categorias WHERE id = ?').bind(v.entero(Number(params.id), 'categoría', { min: 1 })).run();
    return { ok: true };
  });

  function datosGasto(body) {
    return [
      body.fecha ? v.fecha(body.fecha) : ahoraBogota().fecha,
      body.categoria_id ? v.entero(Number(body.categoria_id), 'categoría', { min: 1 }) : null,
      v.texto(body.concepto, 'concepto', { min: 2, max: 120 }),
      pesos(body.monto, 'valor', { min: 1 }),
      METODOS_PAGO.includes(body.metodo) ? body.metodo : 'efectivo',
      v.texto(body.nota, 'nota', { max: 300, opcional: true }),
    ];
  }
  r.post('/api/panel/gastos', 'propietaria', async ({ db, sesion, body }) => {
    const d = datosGasto(body);
    // Sin categoría elegida va a "Otros" (así nada queda suelto en el resumen).
    if (d[1] == null) d[1] = (await db.prepare("SELECT id FROM gasto_categorias WHERE nombre = 'Otros'").first())?.id ?? null;
    const [ins] = await db.batch([
      db.prepare("INSERT INTO gastos (tipo, fecha, categoria_id, descripcion, monto, metodo, nota, registrado_por) VALUES ('variable', ?, ?, ?, ?, ?, ?, ?) RETURNING id").bind(...d, sesion.id),
      marcar(db, sesion, 'gasto', `${d[3]}`),
    ]);
    return { id: ins.results[0].id };
  });
  r.put('/api/panel/gastos/:id', 'propietaria', async ({ db, sesion, params, body }) => {
    const id = v.entero(Number(params.id), 'gasto', { min: 1 });
    await db.batch([
      db.prepare('UPDATE gastos SET fecha = ?, categoria_id = ?, descripcion = ?, monto = ?, metodo = ?, nota = ? WHERE id = ?').bind(...datosGasto(body), id),
      marcar(db, sesion, 'gasto', String(id)),
    ]);
    return { ok: true };
  });
  r.delete('/api/panel/gastos/:id', 'propietaria', async ({ db, sesion, params }) => {
    const id = v.entero(Number(params.id), 'gasto', { min: 1 });
    await db.batch([db.prepare('DELETE FROM gastos WHERE id = ?').bind(id), marcar(db, sesion, 'gasto_borrado', String(id))]);
    return { ok: true };
  });

  // ---------- metas de ahorro / inversión ----------
  r.get('/api/panel/metas', 'propietaria', async ({ db }) => {
    const { results } = await db.prepare(
      `SELECT m.*, COALESCE((SELECT SUM(monto) FROM meta_aportes a WHERE a.meta_id = m.id), 0) AS ahorrado,
              (SELECT MAX(fecha) FROM meta_aportes a WHERE a.meta_id = m.id) AS ultimo_aporte
         FROM metas m ORDER BY m.cerrada, m.id DESC`
    ).all();
    return { metas: results };
  });
  r.post('/api/panel/metas', 'propietaria', async ({ db, sesion, body }) => {
    const f = await db.prepare('INSERT INTO metas (nombre, tipo, objetivo, fecha_meta) VALUES (?, ?, ?, ?) RETURNING id').bind(
      v.texto(body.nombre, 'nombre', { min: 2, max: 80 }), body.tipo === 'inversion' ? 'inversion' : 'ahorro',
      pesos(body.objetivo, 'meta', { min: 1 }), body.fecha_meta ? v.fecha(body.fecha_meta, 'fecha meta') : '',
    ).first();
    await marcar(db, sesion, 'meta', String(f.id)).run();
    return { id: f.id };
  });
  r.put('/api/panel/metas/:id', 'propietaria', async ({ db, sesion, params, body }) => {
    const id = v.entero(Number(params.id), 'meta', { min: 1 });
    await db.batch([
      db.prepare('UPDATE metas SET nombre = ?, tipo = ?, objetivo = ?, fecha_meta = ?, cerrada = ? WHERE id = ?').bind(
        v.texto(body.nombre, 'nombre', { min: 2, max: 80 }), body.tipo === 'inversion' ? 'inversion' : 'ahorro', pesos(body.objetivo, 'meta', { min: 1 }),
        body.fecha_meta ? v.fecha(body.fecha_meta, 'fecha meta') : '', v.bool(body.cerrada) ? 1 : 0, id),
      marcar(db, sesion, 'meta', String(id)),
    ]);
    return { ok: true };
  });
  r.delete('/api/panel/metas/:id', 'propietaria', async ({ db, sesion, params }) => {
    const id = v.entero(Number(params.id), 'meta', { min: 1 });
    await db.batch([db.prepare('DELETE FROM metas WHERE id = ?').bind(id), marcar(db, sesion, 'meta', String(id))]);
    return { ok: true };
  });
  r.post('/api/panel/metas/:id/aportes', 'propietaria', async ({ db, sesion, params, body }) => {
    const id = v.entero(Number(params.id), 'meta', { min: 1 });
    const monto = v.entero(Number(body.monto), 'valor', { min: -100_000_000, max: 100_000_000 });
    if (!monto) falla(400, 'Escribe el valor del aporte.');
    await db.batch([
      db.prepare('INSERT INTO meta_aportes (meta_id, fecha, monto, nota) SELECT id, ?, ?, ? FROM metas WHERE id = ?')
        .bind(body.fecha ? v.fecha(body.fecha) : ahoraBogota().fecha, monto, v.texto(body.nota, 'nota', { max: 200, opcional: true }), id),
      marcar(db, sesion, 'meta', String(id)),
    ]);
    return { ok: true };
  });

  // ---------- deudas y préstamos ----------
  r.get('/api/panel/deudas', 'propietaria', async ({ db }) => {
    const hoy = ahoraBogota().fecha;
    const [d, p] = await db.batch([
      db.prepare('SELECT * FROM deudas ORDER BY cerrada, id DESC'),
      db.prepare('SELECT id, deuda_id, fecha, monto, nota FROM deuda_pagos ORDER BY fecha DESC, id DESC'),
    ]);
    return {
      deudas: d.results.map((x) => {
        const pagos = p.results.filter((y) => y.deuda_id === x.id);
        const pagado = pagos.reduce((a, y) => a + y.monto, 0);
        const cuota = Math.ceil(x.total / x.cuotas);
        // Próxima fecha de pago: el día de pago de este mes o del siguiente.
        let proxima = null;
        if (x.dia_pago && pagado < x.total) {
          const dia = String(Math.min(28, x.dia_pago)).padStart(2, '0');
          proxima = `${hoy.slice(0, 8)}${dia}`;
          if (proxima < hoy) proxima = sumarDias(`${hoy.slice(0, 8)}01`, 32).slice(0, 8) + dia;
        }
        return { ...x, pagos, pagado, saldo: Math.max(0, x.total - pagado), cuota, cuotas_pagadas: Math.min(x.cuotas, Math.floor(pagado / cuota)), proxima };
      }),
    };
  });
  function datosDeuda(body) {
    return [
      v.texto(body.nombre, 'nombre', { min: 2, max: 80 }), body.tipo === 'me_deben' ? 'me_deben' : 'debo',
      v.texto(body.persona, 'persona', { max: 80, opcional: true }), pesos(body.total, 'valor total', { min: 1 }),
      v.entero(Number(body.cuotas || 1), 'cuotas', { min: 1, max: 360 }),
      body.dia_pago ? v.entero(Number(body.dia_pago), 'día de pago', { min: 1, max: 31 }) : null,
      body.inicio ? v.fecha(body.inicio, 'inicio') : ahoraBogota().fecha, v.texto(body.nota, 'nota', { max: 300, opcional: true }),
    ];
  }
  r.post('/api/panel/deudas', 'propietaria', async ({ db, sesion, body }) => {
    const f = await db.prepare('INSERT INTO deudas (nombre, tipo, persona, total, cuotas, dia_pago, inicio, nota) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id').bind(...datosDeuda(body)).first();
    await marcar(db, sesion, 'deuda', String(f.id)).run();
    return { id: f.id };
  });
  r.put('/api/panel/deudas/:id', 'propietaria', async ({ db, sesion, params, body }) => {
    const id = v.entero(Number(params.id), 'deuda', { min: 1 });
    await db.batch([
      db.prepare('UPDATE deudas SET nombre = ?, tipo = ?, persona = ?, total = ?, cuotas = ?, dia_pago = ?, inicio = ?, nota = ?, cerrada = ? WHERE id = ?').bind(...datosDeuda(body), v.bool(body.cerrada) ? 1 : 0, id),
      marcar(db, sesion, 'deuda', String(id)),
    ]);
    return { ok: true };
  });
  r.delete('/api/panel/deudas/:id', 'propietaria', async ({ db, sesion, params }) => {
    const id = v.entero(Number(params.id), 'deuda', { min: 1 });
    await db.batch([db.prepare('DELETE FROM deudas WHERE id = ?').bind(id), marcar(db, sesion, 'deuda', String(id))]);
    return { ok: true };
  });
  r.post('/api/panel/deudas/:id/pagos', 'propietaria', async ({ db, sesion, params, body }) => {
    const id = v.entero(Number(params.id), 'deuda', { min: 1 });
    await db.batch([
      db.prepare('INSERT INTO deuda_pagos (deuda_id, fecha, monto, nota) SELECT id, ?, ?, ? FROM deudas WHERE id = ?')
        .bind(body.fecha ? v.fecha(body.fecha) : ahoraBogota().fecha, pesos(body.monto, 'valor', { min: 1 }), v.texto(body.nota, 'nota', { max: 200, opcional: true }), id),
      db.prepare('UPDATE deudas SET cerrada = 1 WHERE id = ? AND total <= (SELECT COALESCE(SUM(monto),0) FROM deuda_pagos WHERE deuda_id = ?)').bind(id, id),
      marcar(db, sesion, 'deuda', String(id)),
    ]);
    return { ok: true };
  });
  r.delete('/api/panel/deuda-pagos/:id', 'propietaria', async ({ db, sesion, params }) => {
    const id = v.entero(Number(params.id), 'pago', { min: 1 });
    await db.batch([db.prepare('DELETE FROM deuda_pagos WHERE id = ?').bind(id), marcar(db, sesion, 'deuda', String(id))]);
    return { ok: true };
  });
}

