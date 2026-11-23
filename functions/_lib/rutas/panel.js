// Endpoints del panel (Erika y colaboradoras). Cada ruta revisa rol y permisos en el servidor.
import { falla } from '../http.js';
import * as v from '../validar.js';
import { puede, hashPin, tokenAleatorio } from '../auth.js';
import { yoPublico } from './auth.js';
import {
  leerAjustes, disponibilidad, cargarServicios, clientaPorCelular, insertarCita, moverCita,
  cancelarCita, cambiarEstado, detalleCita, ESTADOS_ACTIVOS,
} from '../reservas.js';
import { ahoraBogota, difDias, sumarDias, aMinutos } from '../tiempo.js';

const PERMISOS = ['gestionar_citas', 'gestionar_bloqueos', 'editar_horario', 'ver_agenda_equipo', 'ver_clientas'];
const AJUSTES_EDITABLES = {
  anticipacion_min: [0, 10080], ventana_dias: [1, 365], intervalo_min: [5, 120],
  cancelacion_horas: [0, 168], max_citas_por_celular: [1, 20], dias_inactiva: [15, 730],
};
const AJUSTES_TEXTO = { whatsapp: 20, nombre_spa: 80, direccion: 200, politica_texto: 600, resena_url: 300 };

function permisosLimpios(p = {}) {
  return Object.fromEntries(PERMISOS.map((k) => [k, v.bool(p[k])]));
}

function exigir(sesion, permiso) {
  if (!puede(sesion, permiso)) falla(403, 'No tienes permiso para hacer esto. Pídeselo a Erika.');
}

/** Una colaboradora solo actúa sobre sí misma; la propietaria sobre cualquiera. */
function exigirPropia(sesion, colaboradoraId) {
  if (!sesion.esPropietaria && Number(colaboradoraId) !== sesion.id) falla(403, 'Solo puedes gestionar tu propia agenda.');
}

function minutos(v1, campo) {
  if (typeof v1 === 'number') return v.entero(v1, campo, { min: 0, max: 1440 });
  const m = aMinutos(v1);
  if (m == null) falla(400, `${campo}: hora inválida.`);
  return m;
}

async function citaDe(db, id) {
  const c = await db.prepare('SELECT * FROM citas WHERE id = ?').bind(v.entero(Number(id), 'cita', { min: 1 })).first();
  if (!c) falla(404, 'La cita no existe.');
  return c;
}

async function colaboradoraDe(db, id) {
  const c = await db.prepare('SELECT * FROM colaboradoras WHERE id = ?').bind(v.entero(Number(id), 'colaboradora', { min: 1 })).first();
  if (!c) falla(404, 'La colaboradora no existe.');
  return c;
}

function quien(sesion) { return `${sesion.nombre} (#${sesion.id})`; }

export function rutasPanel(r) {
  // ---------- arranque: todo lo que el panel necesita en una sola llamada ----------
  r.get('/api/panel/arranque', 'sesion', async ({ db, sesion }) => {
    const ajustes = await leerAjustes(db);
    const hoy = ahoraBogota().fecha;
    const [serv, colab, cs, hc, spa, fest, plant] = await db.batch([
      db.prepare('SELECT * FROM servicios ORDER BY orden, nombre'),
      db.prepare('SELECT id, slug, nombre, rol, cargo, bio, foto, color, activa, agenda, permisos, ics_token, orden, pin_hash IS NOT NULL AS tiene_pin FROM colaboradoras ORDER BY activa DESC, orden, nombre'),
      db.prepare('SELECT colaboradora_id, servicio_id FROM colaboradora_servicios'),
      db.prepare('SELECT colaboradora_id, dia, trabaja, abre, cierra FROM horario_colaboradora'),
      db.prepare('SELECT dia, abierto, abre, cierra FROM horario_spa ORDER BY dia'),
      db.prepare('SELECT fecha, motivo FROM festivos WHERE fecha >= ? ORDER BY fecha').bind(sumarDias(hoy, -1)),
      db.prepare('SELECT clave, titulo, texto FROM plantillas ORDER BY orden'),
    ]);
    const verEquipo = puede(sesion, 'ver_agenda_equipo');
    let colaboradoras = colab.results.map((c) => ({
      ...c,
      permisos: JSON.parse(c.permisos || '{}'),
      servicios: cs.results.filter((x) => x.colaboradora_id === c.id).map((x) => x.servicio_id),
      horario: hc.results.filter((x) => x.colaboradora_id === c.id),
    }));
    if (!sesion.esPropietaria) {
      colaboradoras = colaboradoras
        .filter((c) => c.activa && (c.id === sesion.id || (verEquipo && c.agenda)))
        .map((c) => ({
          id: c.id, slug: c.slug, nombre: c.nombre, rol: c.rol, cargo: c.cargo, foto: c.foto, color: c.color,
          activa: c.activa, agenda: c.agenda, servicios: c.servicios, horario: c.horario,
          ...(c.id === sesion.id ? { ics_token: c.ics_token, permisos: c.permisos } : {}),
        }));
    }
    return {
      yo: yoPublico(sesion), hoy,
      ajustes: sesion.esPropietaria ? ajustes : { intervalo_min: ajustes.intervalo_min, whatsapp: ajustes.whatsapp, nombre_spa: ajustes.nombre_spa, direccion: ajustes.direccion, resena_url: ajustes.resena_url },
      plantillas: plant.results,
      servicios: sesion.esPropietaria ? serv.results : serv.results.filter((s) => s.visible || colaboradoras.some((c) => c.servicios.includes(s.id))),
      colaboradoras, horario_spa: spa.results, festivos: fest.results,
    };
  });

  // ---------- agenda ----------
  r.get('/api/panel/agenda', 'sesion', async ({ db, sesion, q }) => {
    const desde = v.fecha(q.get('desde'), 'desde');
    const hasta = v.fecha(q.get('hasta') || desde, 'hasta');
    if (difDias(desde, hasta) < 0 || difDias(desde, hasta) > 42) falla(400, 'Rango de fechas inválido (máximo 6 semanas).');
    let filtro = q.get('colaboradora') ? v.entero(Number(q.get('colaboradora')), 'colaboradora', { min: 1 }) : null;
    const verEquipo = puede(sesion, 'ver_agenda_equipo');
    if (!verEquipo) filtro = sesion.id;
    const condC = filtro ? 'AND ci.colaboradora_id = ?' : '';
    const condB = filtro ? 'AND (b.colaboradora_id IS NULL OR b.colaboradora_id = ?)' : '';
    const extra = filtro ? [filtro] : [];
    const [citas, serv, bloq] = await db.batch([
      db.prepare(
        `SELECT ci.id, ci.codigo, ci.colaboradora_id, ci.fecha, ci.inicio, ci.fin, ci.estado, ci.origen, ci.notas, ci.precio_total,
                ci.clienta_id, cl.nombre AS clienta_nombre, cl.celular AS clienta_celular
           FROM citas ci JOIN clientas cl ON cl.id = ci.clienta_id
          WHERE ci.fecha BETWEEN ? AND ? ${condC} ORDER BY ci.fecha, ci.inicio`
      ).bind(desde, hasta, ...extra),
      db.prepare(
        `SELECT cs.cita_id, cs.servicio_id, cs.nombre, cs.precio, cs.duracion FROM cita_servicios cs JOIN citas ci ON ci.id = cs.cita_id
          WHERE ci.fecha BETWEEN ? AND ? ${condC} ORDER BY cs.orden`
      ).bind(desde, hasta, ...extra),
      db.prepare(`SELECT b.* FROM bloqueos b WHERE b.fecha BETWEEN ? AND ? ${condB} ORDER BY b.fecha, b.inicio`).bind(desde, hasta, ...extra),
    ]);
    const porCita = {};
    for (const s of serv.results) (porCita[s.cita_id] ||= []).push(s);
    const lista = citas.results.map((c) => {
      const propia = sesion.esPropietaria || c.colaboradora_id === sesion.id;
      const base = { ...c, servicios: porCita[c.id] || [], propia };
      if (!propia) { // compañeras: sin datos de contacto
        base.clienta_nombre = c.clienta_nombre.split(' ')[0];
        base.clienta_celular = '';
        base.notas = '';
      }
      return base;
    });
    return { citas: lista, bloqueos: bloq.results };
  });

  r.get('/api/panel/disponibilidad', 'sesion', async ({ db, sesion, q }) => {
    const servicioIds = v.listaIds(q.get('servicios'));
    const fecha = v.fecha(q.get('fecha'));
    let con = q.get('con') || 'cualquiera';
    if (!sesion.esPropietaria) con = String(sesion.id);
    const ignorar = q.get('ignorar') ? Number(q.get('ignorar')) : undefined;
    const d = await disponibilidad(db, { servicioIds, con, fechas: [fecha], personal: true, soloVisibles: false, ignorarCita: ignorar });
    return { fecha, duracion: d.duracion, candidatas: d.candidatas, turnos: d.porFecha[fecha] };
  });

  // ---------- citas ----------
  r.get('/api/panel/citas/:id', 'sesion', async ({ db, sesion, params }) => {
    const c = await detalleCita(db, 'id', v.entero(Number(params.id), 'cita', { min: 1 }));
    if (!c) falla(404, 'La cita no existe.');
    if (!sesion.esPropietaria && c.colaboradora_id !== sesion.id) falla(403, 'Esta cita no es tuya.');
    const { results } = await db.prepare('SELECT fecha, quien, accion, detalle FROM registro WHERE cita_id = ? ORDER BY id DESC LIMIT 30').bind(c.id).all();
    // El token (enlace privado de la clienta) solo se entrega a quien puede ver la cita, para enviárselo.
    return { ...c, registro: results };
  });

  r.post('/api/panel/citas', 'sesion', async ({ db, sesion, body }) => {
    exigir(sesion, 'gestionar_citas');
    const colaboradoraId = v.entero(body.colaboradora_id, 'colaboradora', { min: 1 });
    exigirPropia(sesion, colaboradoraId);
    const servicioIds = v.listaIds(body.servicios);
    const fecha = v.fecha(body.fecha);
    const inicio = minutos(body.inicio, 'hora');
    const nombre = v.texto(body.nombre, 'nombre de la clienta', { min: 2, max: 80 });
    const celular = v.celular(body.celular);
    const notas = v.texto(body.notas, 'notas', { max: 400, opcional: true });
    const forzar = sesion.esPropietaria && v.bool(body.forzar);
    let servicios;
    if (forzar) {
      servicios = await cargarServicios(db, servicioIds);
      await colaboradoraDe(db, colaboradoraId);
    } else {
      const d = await disponibilidad(db, { servicioIds, con: String(colaboradoraId), fechas: [fecha], personal: true, soloVisibles: false });
      if (!d.candidatas.length) falla(409, 'Esa colaboradora no tiene asignados todos esos servicios.');
      if (!d.porFecha[fecha].some((t) => t.inicio === inicio)) {
        falla(409, 'Ese horario no está libre (fuera de horario, bloqueado u ocupado).', { codigo: 'ocupado', puede_forzar: sesion.esPropietaria });
      }
      servicios = d.servicios;
    }
    const clientaId = await clientaPorCelular(db, nombre, celular);
    const c = await insertarCita(db, { clientaId, colaboradoraId, fecha, inicio, servicios, origen: 'panel', notas, quien: quien(sesion), forzar });
    return { id: c.id, codigo: c.codigo };
  });

  r.patch('/api/panel/citas/:id', 'sesion', async ({ db, sesion, params, body }) => {
    exigir(sesion, 'gestionar_citas');
    const cita = await citaDe(db, params.id);
    exigirPropia(sesion, cita.colaboradora_id);
    const accion = body.accion;
    if (accion === 'cancelar') {
      if (cita.estado === 'cancelada') return { ok: true };
      await cancelarCita(db, cita.id, quien(sesion), v.texto(body.motivo, 'motivo', { max: 200, opcional: true }));
    } else if (accion === 'estado') {
      const estado = body.estado;
      if (!['asistio', 'no_asistio', 'confirmada'].includes(estado)) falla(400, 'Estado inválido.');
      if (cita.estado === 'cancelada') {
        if (estado !== 'confirmada') falla(409, 'Primero reactiva la cita.');
        await moverCita(db, cita, { colaboradoraId: cita.colaboradora_id, fecha: cita.fecha, inicio: cita.inicio, quien: quien(sesion), forzar: true, estado });
      } else {
        await cambiarEstado(db, cita.id, estado, quien(sesion));
      }
    } else if (accion === 'notas') {
      await db.prepare(`UPDATE citas SET notas = ?, actualizado = datetime('now') WHERE id = ?`)
        .bind(v.texto(body.notas, 'notas', { max: 400, opcional: true }), cita.id).run();
    } else if (accion === 'mover') {
      const fecha = v.fecha(body.fecha);
      const inicio = minutos(body.inicio, 'hora');
      const colaboradoraId = body.colaboradora_id ? v.entero(body.colaboradora_id, 'colaboradora', { min: 1 }) : cita.colaboradora_id;
      exigirPropia(sesion, colaboradoraId);
      const forzar = sesion.esPropietaria && v.bool(body.forzar);
      if (!forzar) {
        const { results } = await db.prepare('SELECT servicio_id FROM cita_servicios WHERE cita_id = ?').bind(cita.id).all();
        const ids = results.map((x) => x.servicio_id).filter(Boolean);
        const libre = ids.length === results.length && ids.length > 0 && (await disponibilidad(db, {
          servicioIds: ids, con: String(colaboradoraId), fechas: [fecha], personal: true, soloVisibles: false, ignorarCita: cita.id,
        })).porFecha[fecha].some((t) => t.inicio === inicio);
        if (!libre) falla(409, 'Ese horario no está libre (fuera de horario, bloqueado u ocupado).', { codigo: 'ocupado', puede_forzar: sesion.esPropietaria });
      }
      await moverCita(db, cita, { colaboradoraId, fecha, inicio, quien: quien(sesion), forzar });
    } else {
      falla(400, 'Acción inválida.');
    }
    return { ok: true };
  });

  // ---------- bloqueos ----------
  r.post('/api/panel/bloqueos', 'sesion', async ({ db, sesion, body }) => {
    exigir(sesion, 'gestionar_bloqueos');
    const general = body.colaboradora_id == null || body.colaboradora_id === '';
    if (general && !sesion.esPropietaria) falla(403, 'Solo Erika puede bloquear a todo el spa.');
    const colaboradoraId = general ? null : v.entero(Number(body.colaboradora_id), 'colaboradora', { min: 1 });
    if (!general) exigirPropia(sesion, colaboradoraId);
    const fecha = v.fecha(body.fecha);
    const hasta = body.fecha_hasta ? v.fecha(body.fecha_hasta, 'hasta') : fecha;
    const dias = difDias(fecha, hasta);
    if (dias < 0 || dias > 62) falla(400, 'El rango de días es inválido (máximo 2 meses).');
    const todoElDia = v.bool(body.todo_el_dia);
    const inicio = todoElDia ? 0 : minutos(body.inicio, 'desde');
    const fin = todoElDia ? 1440 : minutos(body.fin, 'hasta');
    if (fin <= inicio) falla(400, 'La hora final debe ser después de la inicial.');
    const motivo = v.texto(body.motivo, 'motivo', { max: 120, opcional: true });
    const sentencias = [];
    for (let i = 0; i <= dias; i++) {
      sentencias.push(db.prepare('INSERT INTO bloqueos (colaboradora_id, fecha, inicio, fin, motivo, creado_por) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(colaboradoraId, sumarDias(fecha, i), inicio, fin, motivo, sesion.id));
    }
    await db.batch(sentencias);
    const cruces = await db.prepare(
      `SELECT COUNT(*) AS n FROM citas WHERE fecha BETWEEN ? AND ? AND estado = 'confirmada' AND inicio < ? AND fin > ? ${general ? '' : 'AND colaboradora_id = ?'}`
    ).bind(fecha, hasta, fin, inicio, ...(general ? [] : [colaboradoraId])).first();
    return { ok: true, creados: sentencias.length, citas_afectadas: cruces.n };
  });

  r.delete('/api/panel/bloqueos/:id', 'sesion', async ({ db, sesion, params }) => {
    exigir(sesion, 'gestionar_bloqueos');
    const b = await db.prepare('SELECT * FROM bloqueos WHERE id = ?').bind(v.entero(Number(params.id), 'bloqueo', { min: 1 })).first();
    if (!b) falla(404, 'El bloqueo no existe.');
    if (b.colaboradora_id == null && !sesion.esPropietaria) falla(403, 'Solo Erika puede quitar bloqueos generales.');
    if (b.colaboradora_id != null) exigirPropia(sesion, b.colaboradora_id);
    await db.prepare('DELETE FROM bloqueos WHERE id = ?').bind(b.id).run();
    return { ok: true };
  });

  // ---------- horario semanal de una colaboradora ----------
  r.put('/api/panel/horario/:id', 'sesion', async ({ db, sesion, params, body }) => {
    const id = v.entero(Number(params.id), 'colaboradora', { min: 1 });
    exigirPropia(sesion, id);
    if (!sesion.esPropietaria) exigir(sesion, 'editar_horario');
    if (!Array.isArray(body.dias)) falla(400, 'Faltan los días.');
    const sentencias = [db.prepare('DELETE FROM horario_colaboradora WHERE colaboradora_id = ?').bind(id)];
    for (const d of body.dias) {
      if (d.usar_spa) continue; // sin renglón = horario del spa
      const dia = v.entero(d.dia, 'día', { min: 0, max: 6 });
      const trabaja = v.bool(d.trabaja) ? 1 : 0;
      const abre = trabaja ? minutos(d.abre, 'entrada') : 0;
      const cierra = trabaja ? minutos(d.cierra, 'salida') : 0;
      if (trabaja && cierra <= abre) falla(400, 'La hora de salida debe ser después de la entrada.');
      sentencias.push(db.prepare('INSERT INTO horario_colaboradora (colaboradora_id, dia, trabaja, abre, cierra) VALUES (?, ?, ?, ?, ?)').bind(id, dia, trabaja, abre, cierra));
    }
    await db.batch(sentencias);
    return { ok: true };
  });

  // ---------- equipo (solo Erika) ----------
  async function guardarColaboradora(db, id, body) {
    const nombre = v.texto(body.nombre, 'nombre', { min: 2, max: 40 });
    const datos = {
      nombre,
      cargo: v.texto(body.cargo, 'cargo', { max: 60, opcional: true }),
      bio: v.texto(body.bio, 'bio', { max: 600, opcional: true }),
      foto: v.url(body.foto),
      color: v.color(body.color),
      agenda: v.bool(body.agenda) ? 1 : 0,
      orden: v.entero(body.orden ?? 0, 'orden', { min: 0, max: 999 }),
      permisos: JSON.stringify(permisosLimpios(body.permisos)),
    };
    const servicios = Array.isArray(body.servicios) ? body.servicios.map((x) => v.entero(Number(x), 'servicio', { min: 1 })) : [];
    if (id == null) {
      let slug = v.slugDe(nombre);
      const existe = await db.prepare('SELECT 1 FROM colaboradoras WHERE slug = ?').bind(slug).first();
      if (existe) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
      const f = await db.prepare(
        `INSERT INTO colaboradoras (slug, nombre, cargo, bio, foto, color, agenda, orden, permisos) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`
      ).bind(slug, datos.nombre, datos.cargo, datos.bio, datos.foto, datos.color, datos.agenda, datos.orden, datos.permisos).first();
      id = f.id;
    } else {
      await db.prepare(
        'UPDATE colaboradoras SET nombre = ?, cargo = ?, bio = ?, foto = ?, color = ?, agenda = ?, orden = ?, permisos = ? WHERE id = ?'
      ).bind(datos.nombre, datos.cargo, datos.bio, datos.foto, datos.color, datos.agenda, datos.orden, datos.permisos, id).run();
    }
    await db.batch([
      db.prepare('DELETE FROM colaboradora_servicios WHERE colaboradora_id = ?').bind(id),
      ...servicios.map((s) => db.prepare('INSERT OR IGNORE INTO colaboradora_servicios (colaboradora_id, servicio_id) SELECT ?, id FROM servicios WHERE id = ?').bind(id, s)),
    ]);
    return id;
  }

  r.post('/api/panel/colaboradoras', 'propietaria', async ({ db, body }) => {
    const id = await guardarColaboradora(db, null, body);
    if (body.pin) await db.prepare('UPDATE colaboradoras SET pin_hash = ? WHERE id = ?').bind(await hashPin(String(body.pin)), id).run();
    return { id };
  });

  r.put('/api/panel/colaboradoras/:id', 'propietaria', async ({ db, params, body }) => {
    const c = await colaboradoraDe(db, params.id);
    await guardarColaboradora(db, c.id, body);
    if (body.activa !== undefined && c.rol !== 'propietaria') {
      const activa = v.bool(body.activa) ? 1 : 0;
      await db.prepare('UPDATE colaboradoras SET activa = ? WHERE id = ?').bind(activa, c.id).run();
      if (!activa) await db.prepare('DELETE FROM sesiones WHERE colaboradora_id = ?').bind(c.id).run();
    }
    return { ok: true };
  });

  r.post('/api/panel/colaboradoras/:id/pin', 'propietaria', async ({ db, params, body }) => {
    const c = await colaboradoraDe(db, params.id);
    if (body.quitar) {
      if (c.rol === 'propietaria') falla(400, 'No puedes quitar el PIN de la propietaria.');
      await db.batch([
        db.prepare('UPDATE colaboradoras SET pin_hash = NULL WHERE id = ?').bind(c.id),
        db.prepare('DELETE FROM sesiones WHERE colaboradora_id = ?').bind(c.id),
      ]);
      return { ok: true };
    }
    const hash = await hashPin(String(body.pin ?? ''));
    await db.batch([
      db.prepare('UPDATE colaboradoras SET pin_hash = ? WHERE id = ?').bind(hash, c.id),
      db.prepare('DELETE FROM sesiones WHERE colaboradora_id = ?').bind(c.id),
    ]);
    return { ok: true };
  });

  r.post('/api/panel/colaboradoras/:id/ics', 'propietaria', async ({ db, params, body }) => {
    const c = await colaboradoraDe(db, params.id);
    const token = body.quitar ? null : tokenAleatorio(24);
    await db.prepare('UPDATE colaboradoras SET ics_token = ? WHERE id = ?').bind(token, c.id).run();
    return { ics_token: token };
  });

  r.post('/api/panel/ics-general', 'propietaria', async ({ db, body }) => {
    const token = body.quitar ? '' : tokenAleatorio(24);
    await db.prepare(`INSERT INTO ajustes (clave, valor) VALUES ('ics_token_general', ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor`).bind(token).run();
    return { ics_token: token || null };
  });

  // ---------- servicios ----------
  async function guardarServicio(db, id, body) {
    const nombre = v.texto(body.nombre, 'nombre', { min: 2, max: 80 });
    const duracion = v.entero(Number(body.duracion), 'duración', { min: 5, max: 720 });
    if (duracion % 5) falla(400, 'La duración debe ser múltiplo de 5 minutos.');
    const d = [
      nombre,
      v.texto(body.categoria, 'categoría', { max: 40, opcional: true }) || 'Otros',
      v.texto(body.descripcion, 'descripción', { max: 500, opcional: true }),
      v.url(body.foto),
      body.precio === '' || body.precio == null ? null : v.entero(Number(body.precio), 'precio', { min: 0, max: 100_000_000 }),
      v.bool(body.precio_desde) ? 1 : 0,
      duracion,
      body.visible === undefined ? 1 : (v.bool(body.visible) ? 1 : 0),
      v.entero(Number(body.orden ?? 0), 'orden', { min: 0, max: 9999 }),
      body.ciclo_dias === '' || body.ciclo_dias == null ? null : v.entero(Number(body.ciclo_dias), 'ciclo de retorno', { min: 1, max: 365 }),
    ];
    if (id == null) {
      let slug = v.slugDe(nombre);
      if (await db.prepare('SELECT 1 FROM servicios WHERE slug = ?').bind(slug).first()) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
      id = (await db.prepare(
        'INSERT INTO servicios (nombre, categoria, descripcion, foto, precio, precio_desde, duracion, visible, orden, ciclo_dias, slug) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id'
      ).bind(...d, slug).first()).id;
    } else {
      await db.prepare(
        'UPDATE servicios SET nombre = ?, categoria = ?, descripcion = ?, foto = ?, precio = ?, precio_desde = ?, duracion = ?, visible = ?, orden = ?, ciclo_dias = ? WHERE id = ?'
      ).bind(...d, id).run();
    }
    if (Array.isArray(body.colaboradoras)) {
      const ids = body.colaboradoras.map((x) => v.entero(Number(x), 'colaboradora', { min: 1 }));
      await db.batch([
        db.prepare('DELETE FROM colaboradora_servicios WHERE servicio_id = ?').bind(id),
        ...ids.map((c) => db.prepare('INSERT OR IGNORE INTO colaboradora_servicios (colaboradora_id, servicio_id) SELECT id, ? FROM colaboradoras WHERE id = ?').bind(id, c)),
      ]);
    }
    return id;
  }

  r.post('/api/panel/servicios', 'propietaria', async ({ db, body }) => ({ id: await guardarServicio(db, null, body) }));

  r.put('/api/panel/servicios/:id', 'propietaria', async ({ db, params, body }) => {
    const s = await db.prepare('SELECT id FROM servicios WHERE id = ?').bind(v.entero(Number(params.id), 'servicio', { min: 1 })).first();
    if (!s) falla(404, 'El servicio no existe.');
    await guardarServicio(db, s.id, body);
    return { ok: true };
  });

  r.delete('/api/panel/servicios/:id', 'propietaria', async ({ db, params }) => {
    const id = v.entero(Number(params.id), 'servicio', { min: 1 });
    const usado = await db.prepare('SELECT 1 FROM cita_servicios WHERE servicio_id = ? LIMIT 1').bind(id).first();
    if (usado) {
      await db.prepare('UPDATE servicios SET visible = 0 WHERE id = ?').bind(id).run();
      return { ok: true, archivado: true };
    }
    await db.prepare('DELETE FROM servicios WHERE id = ?').bind(id).run();
    return { ok: true };
  });

  // ---------- spa: horario, festivos, ajustes ----------
  r.put('/api/panel/spa', 'propietaria', async ({ db, body }) => {
    if (!Array.isArray(body.horario) || body.horario.length !== 7) falla(400, 'Se esperan los 7 días.');
    const sentencias = body.horario.map((h) => {
      const dia = v.entero(h.dia, 'día', { min: 0, max: 6 });
      const abierto = v.bool(h.abierto) ? 1 : 0;
      const abre = minutos(h.abre, 'apertura'), cierra = minutos(h.cierra, 'cierre');
      if (abierto && cierra <= abre) falla(400, 'El cierre debe ser después de la apertura.');
      return db.prepare('INSERT INTO horario_spa (dia, abierto, abre, cierra) VALUES (?, ?, ?, ?) ON CONFLICT(dia) DO UPDATE SET abierto = excluded.abierto, abre = excluded.abre, cierra = excluded.cierra')
        .bind(dia, abierto, abre, cierra);
    });
    await db.batch(sentencias);
    return { ok: true };
  });

  r.post('/api/panel/festivos', 'propietaria', async ({ db, body }) => {
    const fecha = v.fecha(body.fecha);
    await db.prepare('INSERT INTO festivos (fecha, motivo) VALUES (?, ?) ON CONFLICT(fecha) DO UPDATE SET motivo = excluded.motivo')
      .bind(fecha, v.texto(body.motivo, 'motivo', { max: 80, opcional: true })).run();
    return { ok: true };
  });

  r.delete('/api/panel/festivos/:fecha', 'propietaria', async ({ db, params }) => {
    await db.prepare('DELETE FROM festivos WHERE fecha = ?').bind(v.fecha(params.fecha)).run();
    return { ok: true };
  });

  r.put('/api/panel/ajustes', 'propietaria', async ({ db, body }) => {
    const sentencias = [];
    const up = (k, val) => db.prepare('INSERT INTO ajustes (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor').bind(k, String(val));
    for (const [k, [min, max]] of Object.entries(AJUSTES_EDITABLES)) {
      if (body[k] !== undefined) sentencias.push(up(k, v.entero(Number(body[k]), k, { min, max })));
    }
    for (const [k, max] of Object.entries(AJUSTES_TEXTO)) {
      if (body[k] === undefined) continue;
      let val = v.texto(body[k], k, { max, opcional: k !== 'nombre_spa' });
      if (k === 'whatsapp') val = v.celular(val, 'WhatsApp');
      sentencias.push(up(k, val));
    }
    if (body.intervalo_min !== undefined && Number(body.intervalo_min) % 5) falla(400, 'El intervalo debe ser múltiplo de 5.');
    if (sentencias.length) await db.batch(sentencias);
    return { ok: true };
  });

  // ---------- clientas ----------
  r.get('/api/panel/clientas', 'sesion', async ({ db, sesion, q }) => {
    exigir(sesion, 'ver_clientas');
    const texto = v.texto(q.get('q'), 'búsqueda', { max: 60, opcional: true });
    const pagina = v.entero(Number(q.get('pagina') || 0), 'página', { min: 0, max: 1000 });
    const digitos = texto.replace(/\D/g, '');
    const conds = [], bind = [];
    if (texto) {
      conds.push(digitos.length >= 3 ? '(cl.nombre LIKE ? OR cl.celular LIKE ?)' : 'cl.nombre LIKE ?');
      bind.push(`%${texto}%`);
      if (digitos.length >= 3) bind.push(`%${digitos}%`);
    }
    if (!sesion.esPropietaria) { conds.push('EXISTS (SELECT 1 FROM citas x WHERE x.clienta_id = cl.id AND x.colaboradora_id = ?)'); bind.push(sesion.id); }
    const { results } = await db.prepare(
      `SELECT cl.id, cl.nombre, cl.celular, cl.notas,
              (SELECT COUNT(*) FROM citas c WHERE c.clienta_id = cl.id AND c.estado <> 'cancelada') AS citas,
              (SELECT COUNT(*) FROM citas c WHERE c.clienta_id = cl.id AND c.estado = 'no_asistio') AS faltas,
              (SELECT MAX(fecha) FROM citas c WHERE c.clienta_id = cl.id AND c.estado <> 'cancelada') AS ultima
         FROM clientas cl ${conds.length ? 'WHERE ' + conds.join(' AND ') : ''}
        ORDER BY ultima IS NULL, ultima DESC, cl.nombre LIMIT 51 OFFSET ?`
    ).bind(...bind, pagina * 50).all();
    return { clientas: results.slice(0, 50), hay_mas: results.length > 50 };
  });

  r.get('/api/panel/clientas/:id', 'sesion', async ({ db, sesion, params }) => {
    exigir(sesion, 'ver_clientas');
    const id = v.entero(Number(params.id), 'clienta', { min: 1 });
    const cl = await db.prepare('SELECT * FROM clientas WHERE id = ?').bind(id).first();
    if (!cl) falla(404, 'La clienta no existe.');
    const filtro = sesion.esPropietaria ? '' : 'AND ci.colaboradora_id = ?';
    const { results } = await db.prepare(
      `SELECT ci.id, ci.codigo, ci.fecha, ci.inicio, ci.fin, ci.estado, ci.precio_total, co.nombre AS colaboradora,
              (SELECT GROUP_CONCAT(nombre, ' + ') FROM cita_servicios cs WHERE cs.cita_id = ci.id) AS servicios
         FROM citas ci JOIN colaboradoras co ON co.id = ci.colaboradora_id
        WHERE ci.clienta_id = ? ${filtro} ORDER BY ci.fecha DESC, ci.inicio DESC LIMIT 200`
    ).bind(id, ...(sesion.esPropietaria ? [] : [sesion.id])).all();
    if (!sesion.esPropietaria && !results.length) falla(403, 'No has atendido a esta clienta.');
    return { clienta: cl, citas: results };
  });

  r.put('/api/panel/clientas/:id', 'propietaria', async ({ db, params, body }) => {
    const id = v.entero(Number(params.id), 'clienta', { min: 1 });
    try {
      const cumple = String(body.cumpleanos || '').trim();
      if (cumple && !/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(cumple)) falla(400, 'Cumpleaños: usa el formato MM-DD.');
      await db.prepare('UPDATE clientas SET nombre = ?, celular = ?, email = ?, notas = ?, preferencias = ?, cumpleanos = ? WHERE id = ?').bind(
        v.texto(body.nombre, 'nombre', { min: 2, max: 80 }), v.celular(body.celular), v.email(body.email),
        v.texto(body.notas, 'notas', { max: 1000, opcional: true }), v.texto(body.preferencias, 'preferencias', { max: 500, opcional: true }), cumple, id,
      ).run();
    } catch (e) {
      if (/UNIQUE/i.test(String(e.message))) falla(409, 'Ya existe otra clienta con ese celular.');
      throw e;
    }
    return { ok: true };
  });

  // ---------- resumen ----------
  r.get('/api/panel/resumen', 'sesion', async ({ db, sesion }) => {
    const hoy = ahoraBogota().fecha;
    const inicioMes = hoy.slice(0, 8) + '01';
    const filtro = sesion.esPropietaria ? '' : 'AND colaboradora_id = ?';
    const b = sesion.esPropietaria ? [] : [sesion.id];
    const [dia, semana, mes] = await db.batch([
      db.prepare(`SELECT COUNT(*) AS citas, SUM(CASE WHEN estado = 'asistio' THEN 1 ELSE 0 END) AS atendidas, COALESCE(SUM(precio_total), 0) AS valor FROM citas WHERE fecha = ? AND estado IN ${ESTADOS_ACTIVOS} ${filtro}`).bind(hoy, ...b),
      db.prepare(`SELECT COUNT(*) AS citas, COALESCE(SUM(precio_total), 0) AS valor FROM citas WHERE fecha BETWEEN ? AND ? AND estado IN ${ESTADOS_ACTIVOS} ${filtro}`).bind(hoy, sumarDias(hoy, 6), ...b),
      db.prepare(`SELECT SUM(CASE WHEN estado = 'no_asistio' THEN 1 ELSE 0 END) AS faltas, SUM(CASE WHEN estado = 'cancelada' THEN 1 ELSE 0 END) AS canceladas, SUM(CASE WHEN origen = 'web' THEN 1 ELSE 0 END) AS web, COUNT(*) AS total FROM citas WHERE fecha BETWEEN ? AND ? ${filtro}`).bind(inicioMes, hoy, ...b),
    ]);
    return { hoy, dia: dia.results[0], semana: semana.results[0], mes: mes.results[0] };
  });
}
