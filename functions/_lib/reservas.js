// Lógica de reservas sobre D1: contexto, disponibilidad y escrituras atómicas.
import { falla } from './http.js';
import { turnosDelDia, seCruza } from './disponibilidad.js';
import { ahoraBogota, diaSemana, sumarDias } from './tiempo.js';
import { tokenAleatorio, aleatorio } from './auth.js';

const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const ESTADOS_ACTIVOS = "('confirmada','asistio','no_asistio')";

export function nuevoCodigo() {
  return 'AM-' + [...aleatorio(6)].map((b) => ALFABETO[b % ALFABETO.length]).join('');
}

const NUMERICOS = ['anticipacion_min', 'ventana_dias', 'intervalo_min', 'cancelacion_horas', 'max_citas_por_celular'];

export async function leerAjustes(db) {
  const { results } = await db.prepare('SELECT clave, valor FROM ajustes').all();
  const a = Object.fromEntries(results.map((r) => [r.clave, r.valor]));
  for (const k of NUMERICOS) a[k] = Number(a[k] ?? 0);
  return a;
}

/** Servicios por id, en el orden pedido. Lanza 400 si alguno no existe (o no es visible, para el público). */
export async function cargarServicios(db, ids, { soloVisibles = false } = {}) {
  const marcas = ids.map(() => '?').join(',');
  const { results } = await db.prepare(
    `SELECT id, slug, nombre, precio, duracion, visible FROM servicios WHERE id IN (${marcas})`
  ).bind(...ids).all();
  const porId = new Map(results.map((s) => [s.id, s]));
  const lista = ids.map((id) => porId.get(id));
  if (lista.some((s) => !s || (soloVisibles && !s.visible))) falla(400, 'Alguno de los servicios ya no está disponible.');
  return lista;
}

/** Colaboradoras activas con agenda que hacen TODOS los servicios. */
export async function candidatasPara(db, servicioIds) {
  const marcas = servicioIds.map(() => '?').join(',');
  const { results } = await db.prepare(
    `SELECT c.id, c.slug, c.nombre FROM colaboradoras c
       JOIN colaboradora_servicios cs ON cs.colaboradora_id = c.id
      WHERE c.activa = 1 AND c.agenda = 1 AND cs.servicio_id IN (${marcas})
      GROUP BY c.id HAVING COUNT(DISTINCT cs.servicio_id) = ?
      ORDER BY c.orden, c.nombre`
  ).bind(...servicioIds, servicioIds.length).all();
  return results;
}

/** Carga todo lo necesario para calcular turnos entre dos fechas (inclusive). */
export async function cargarContexto(db, desde, hasta, colabIds) {
  const marcas = colabIds.map(() => '?').join(',') || 'NULL';
  const [spa, festivos, horarios, bloqueos, citas] = await db.batch([
    db.prepare('SELECT dia, abierto, abre, cierra FROM horario_spa'),
    db.prepare('SELECT fecha FROM festivos WHERE fecha BETWEEN ? AND ?').bind(desde, hasta),
    db.prepare(`SELECT colaboradora_id, dia, trabaja, abre, cierra FROM horario_colaboradora WHERE colaboradora_id IN (${marcas})`).bind(...colabIds),
    db.prepare(`SELECT colaboradora_id, fecha, inicio, fin FROM bloqueos WHERE fecha BETWEEN ? AND ? AND (colaboradora_id IS NULL OR colaboradora_id IN (${marcas}))`).bind(desde, hasta, ...colabIds),
    db.prepare(`SELECT id, colaboradora_id, fecha, inicio, fin FROM citas WHERE fecha BETWEEN ? AND ? AND estado IN ${ESTADOS_ACTIVOS} AND colaboradora_id IN (${marcas})`).bind(desde, hasta, ...colabIds),
  ]);
  return {
    spa: Object.fromEntries(spa.results.map((h) => [h.dia, h])),
    festivos: new Set(festivos.results.map((f) => f.fecha)),
    horarios: horarios.results,
    bloqueos: bloqueos.results,
    citas: citas.results,
  };
}

export function turnosConContexto(ctx, { fecha, duracion, candidatas, ajustes, ahora, personal, ignorarCita }) {
  const dia = diaSemana(fecha);
  const horariosColab = {};
  for (const h of ctx.horarios) if (h.dia === dia) horariosColab[h.colaboradora_id] = h;
  return turnosDelDia({
    fecha, duracion, candidatas, ajustes, ahora, personal, ignorarCita,
    horarioSpa: ctx.spa[dia],
    festivo: ctx.festivos.has(fecha),
    horariosColab,
    bloqueos: ctx.bloqueos.filter((b) => b.fecha === fecha),
    ocupadas: ctx.citas.filter((c) => c.fecha === fecha),
  });
}

/**
 * Resuelve servicios + colaboradora(s) y devuelve los turnos de un día o de un rango de días.
 * `con`: slug, id numérico o 'cualquiera'.
 */
export async function disponibilidad(db, { servicioIds, con, fechas, personal = false, soloVisibles = true, ignorarCita, ahoraMs }) {
  const servicios = await cargarServicios(db, servicioIds, { soloVisibles });
  const duracion = servicios.reduce((s, x) => s + x.duracion, 0);
  let candidatas = await candidatasPara(db, servicioIds);
  if (con && con !== 'cualquiera') {
    candidatas = candidatas.filter((c) => c.slug === con || String(c.id) === String(con));
  }
  const ajustes = await leerAjustes(db);
  const ahora = ahoraBogota(ahoraMs);
  const ids = candidatas.map((c) => c.id);
  const porFecha = {};
  if (ids.length) {
    const ctx = await cargarContexto(db, fechas[0], fechas[fechas.length - 1], ids);
    for (const f of fechas) {
      porFecha[f] = turnosConContexto(ctx, { fecha: f, duracion, candidatas: ids, ajustes, ahora, personal, ignorarCita });
    }
  } else {
    for (const f of fechas) porFecha[f] = [];
  }
  return { servicios, duracion, candidatas, porFecha, ajustes, ahora };
}

export function rangoFechas(desde, n) {
  return Array.from({ length: n }, (_, i) => sumarDias(desde, i));
}

/** Busca o crea la clienta por celular. Devuelve su id. */
export async function clientaPorCelular(db, nombre, celular) {
  const f = await db.prepare(
    `INSERT INTO clientas (nombre, celular) VALUES (?, ?)
     ON CONFLICT(celular) DO UPDATE SET nombre = CASE WHEN clientas.nombre = '' THEN excluded.nombre ELSE clientas.nombre END
     RETURNING id`
  ).bind(nombre, celular).first();
  return f.id;
}

function sentenciaSlots(db, colaboradoraId, fecha, inicio, fin, whereCita, ...bind) {
  return db.prepare(
    `WITH RECURSIVE m(x) AS (SELECT ?1 UNION ALL SELECT x + 5 FROM m WHERE x + 5 < ?2)
     INSERT INTO cita_slots (colaboradora_id, fecha, minuto, cita_id)
     SELECT ?3, ?4, m.x, citas.id FROM m, citas WHERE ${whereCita}`
  ).bind(inicio, fin, colaboradoraId, fecha, ...bind);
}

function esChoque(e) {
  return /UNIQUE constraint failed: cita_slots|SQLITE_CONSTRAINT/i.test(String(e?.message || e) + String(e?.cause?.message || ''));
}

/**
 * Inserta una cita de forma atómica. Lanza 409 si el turno ya está tomado o bloqueado.
 * @returns {{id:number,codigo:string,token:string}}
 */
export async function insertarCita(db, { clientaId, colaboradoraId, fecha, inicio, servicios, origen = 'web', notas = '', quien = 'web', forzar = false, estado = 'confirmada', conSlots = true, ipHash = '' }) {
  const duracion = servicios.reduce((s, x) => s + x.duracion, 0);
  const fin = inicio + duracion;
  if (inicio % 5 || fin > 1440) falla(400, 'Hora inválida.');
  const codigo = nuevoCodigo();
  const token = tokenAleatorio(24);
  const precioTotal = servicios.every((s) => s.precio != null) ? servicios.reduce((s, x) => s + x.precio, 0) : null;

  const condBloqueo = forzar ? '' :
    `WHERE NOT EXISTS (SELECT 1 FROM bloqueos WHERE fecha = ?6 AND (colaboradora_id IS NULL OR colaboradora_id = ?5) AND inicio < ?8 AND fin > ?7)`;
  const sentencias = [
    db.prepare(
      `INSERT INTO citas (codigo, token, clienta_id, colaboradora_id, fecha, inicio, fin, estado, origen, notas, precio_total, ip_hash)
       SELECT ?1, ?2, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13 ${condBloqueo}`
    ).bind(codigo, token, null, clientaId, colaboradoraId, fecha, inicio, fin, estado, origen, notas, precioTotal, ipHash),
    ...servicios.map((s, i) => db.prepare(
      `INSERT INTO cita_servicios (cita_id, servicio_id, nombre, precio, duracion, orden)
       SELECT id, ?, ?, ?, ?, ? FROM citas WHERE codigo = ?`
    ).bind(s.id ?? null, s.nombre, s.precio ?? null, s.duracion, i, codigo)),
  ];
  if (conSlots) sentencias.push(sentenciaSlots(db, colaboradoraId, fecha, inicio, fin, 'citas.codigo = ?5', codigo));
  sentencias.push(db.prepare(
    `INSERT INTO registro (quien, accion, cita_id, detalle) SELECT ?, 'creada', id, ? FROM citas WHERE codigo = ?`
  ).bind(quien, `${fecha} ${inicio}-${fin} colab ${colaboradoraId}`, codigo));

  let res;
  try {
    res = await db.batch(sentencias);
  } catch (e) {
    if (esChoque(e)) falla(409, 'Ese horario se acaba de ocupar. Elige otro, por favor.', { codigo: 'ocupado' });
    throw e;
  }
  if (!res[0].meta.changes) falla(409, 'Ese horario no está disponible.', { codigo: 'bloqueado' });
  const fila = await db.prepare('SELECT id FROM citas WHERE codigo = ?').bind(codigo).first();
  return { id: fila.id, codigo, token, fin, precioTotal };
}

/** Mueve una cita a otra fecha/hora/colaboradora de forma atómica (o reactiva una cancelada). */
export async function moverCita(db, cita, { colaboradoraId, fecha, inicio, quien, forzar = false, estado }) {
  const duracion = cita.fin - cita.inicio;
  const fin = inicio + duracion;
  if (inicio % 5 || fin > 1440 || inicio < 0) falla(400, 'Hora inválida.');
  if (!forzar) {
    const { results } = await db.prepare(
      'SELECT inicio, fin FROM bloqueos WHERE fecha = ? AND (colaboradora_id IS NULL OR colaboradora_id = ?)'
    ).bind(fecha, colaboradoraId).all();
    if (seCruza(inicio, fin, results)) falla(409, 'Ese horario está bloqueado.', { codigo: 'bloqueado' });
  }
  const nuevoEstado = estado || (cita.estado === 'cancelada' ? 'confirmada' : cita.estado);
  try {
    await db.batch([
      db.prepare('DELETE FROM cita_slots WHERE cita_id = ?').bind(cita.id),
      db.prepare(`UPDATE citas SET colaboradora_id = ?, fecha = ?, inicio = ?, fin = ?, estado = ?, actualizado = datetime('now') WHERE id = ?`)
        .bind(colaboradoraId, fecha, inicio, fin, nuevoEstado, cita.id),
      sentenciaSlots(db, colaboradoraId, fecha, inicio, fin, 'citas.id = ?5', cita.id),
      db.prepare(`INSERT INTO registro (quien, accion, cita_id, detalle) VALUES (?, 'movida', ?, ?)`)
        .bind(quien, cita.id, `${cita.fecha} ${cita.inicio} → ${fecha} ${inicio} colab ${colaboradoraId}`),
    ]);
  } catch (e) {
    if (esChoque(e)) falla(409, 'Ese horario ya está ocupado.', { codigo: 'ocupado' });
    throw e;
  }
  return { fin, estado: nuevoEstado };
}

export async function cancelarCita(db, citaId, quien, motivo = '') {
  await db.batch([
    db.prepare(`UPDATE citas SET estado = 'cancelada', actualizado = datetime('now') WHERE id = ?`).bind(citaId),
    db.prepare('DELETE FROM cita_slots WHERE cita_id = ?').bind(citaId),
    db.prepare(`INSERT INTO registro (quien, accion, cita_id, detalle) VALUES (?, 'cancelada', ?, ?)`).bind(quien, citaId, motivo),
  ]);
}

export async function cambiarEstado(db, citaId, estado, quien) {
  await db.batch([
    db.prepare(`UPDATE citas SET estado = ?, actualizado = datetime('now') WHERE id = ?`).bind(estado, citaId),
    db.prepare(`INSERT INTO registro (quien, accion, cita_id, detalle) VALUES (?, 'estado', ?, ?)`).bind(quien, citaId, estado),
  ]);
}

/** Detalle completo de una cita (para clienta o panel). */
export async function detalleCita(db, where, valor) {
  const c = await db.prepare(
    `SELECT ci.*, cl.nombre AS clienta_nombre, cl.celular AS clienta_celular,
            co.nombre AS colaboradora_nombre, co.slug AS colaboradora_slug, co.foto AS colaboradora_foto
       FROM citas ci JOIN clientas cl ON cl.id = ci.clienta_id JOIN colaboradoras co ON co.id = ci.colaboradora_id
      WHERE ci.${where} = ?`
  ).bind(valor).first();
  if (!c) return null;
  const { results } = await db.prepare('SELECT servicio_id, nombre, precio, duracion FROM cita_servicios WHERE cita_id = ? ORDER BY orden').bind(c.id).all();
  c.servicios = results;
  return c;
}
