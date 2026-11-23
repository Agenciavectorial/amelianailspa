// Endpoints públicos: catálogo, disponibilidad, reservar y gestionar la cita con el enlace privado.
import { falla, ipDe } from '../http.js';
import * as v from '../validar.js';
import { revisarBloqueo, sumarIntento } from '../auth.js';
import {
  leerAjustes, disponibilidad, rangoFechas, clientaPorCelular, insertarCita, detalleCita,
  cancelarCita, moverCita, ESTADOS_ACTIVOS,
} from '../reservas.js';
import { ahoraBogota, aUTC, fechaTexto, horaTexto } from '../tiempo.js';
import { generarICS, respuestaICS } from '../ics.js';

const AJUSTES_PUBLICOS = ['anticipacion_min', 'ventana_dias', 'cancelacion_horas', 'whatsapp', 'nombre_spa', 'direccion', 'politica_texto', 'intervalo_min'];

function tokenValido(t) {
  if (typeof t !== 'string' || !/^[A-Za-z0-9_-]{20,64}$/.test(t)) falla(404, 'No encontramos esta cita. Revisa el enlace.');
  return t;
}

function puedeModificar(cita, ajustes, ahoraMs = Date.now()) {
  if (cita.estado !== 'confirmada') return false;
  const faltan = aUTC(cita.fecha, cita.inicio).getTime() - ahoraMs;
  return faltan >= ajustes.cancelacion_horas * 3600000;
}

function citaPublica(c, ajustes) {
  return {
    codigo: c.codigo, fecha: c.fecha, inicio: c.inicio, fin: c.fin, estado: c.estado,
    fecha_texto: fechaTexto(c.fecha), hora_texto: horaTexto(c.inicio),
    clienta: c.clienta_nombre.split(' ')[0],
    colaboradora: { nombre: c.colaboradora_nombre, slug: c.colaboradora_slug, foto: c.colaboradora_foto },
    servicios: c.servicios.map((s) => ({ id: s.servicio_id, nombre: s.nombre, precio: s.precio, duracion: s.duracion })),
    precio_total: c.precio_total,
    puede_modificar: puedeModificar(c, ajustes),
    cancelacion_horas: ajustes.cancelacion_horas,
  };
}

function eventoCita(c, ajustes) {
  return {
    uid: `${c.codigo}@amelianailspa.com`, fecha: c.fecha, inicio: c.inicio, fin: c.fin,
    titulo: `Cita en Amelia Nail Spa: ${c.servicios.map((s) => s.nombre).join(' + ')}`,
    descripcion: `Código ${c.codigo} · con ${c.colaboradora_nombre}. Si necesitas cambiarla, usa tu enlace privado o escríbenos al WhatsApp +${ajustes.whatsapp}.`,
    ubicacion: ajustes.direccion, cancelada: c.estado === 'cancelada', alarma: 120,
  };
}

export function rutasPublicas(r) {
  r.get('/api/public/catalogo', 'publico', async ({ db }) => {
    const ajustes = await leerAjustes(db);
    const [serv, colab, cs, spa] = await db.batch([
      db.prepare('SELECT id, slug, nombre, categoria, descripcion, foto, precio, precio_desde, duracion FROM servicios WHERE visible = 1 ORDER BY orden, nombre'),
      db.prepare('SELECT id, slug, nombre, cargo, foto FROM colaboradoras WHERE activa = 1 AND agenda = 1 ORDER BY orden, nombre'),
      db.prepare('SELECT cs.colaboradora_id, cs.servicio_id FROM colaboradora_servicios cs JOIN servicios s ON s.id = cs.servicio_id WHERE s.visible = 1'),
      db.prepare('SELECT dia, abierto, abre, cierra FROM horario_spa ORDER BY dia'),
    ]);
    const colaboradoras = colab.results.map((c) => ({
      ...c, servicios: cs.results.filter((x) => x.colaboradora_id === c.id).map((x) => x.servicio_id),
    }));
    return {
      ajustes: Object.fromEntries(AJUSTES_PUBLICOS.map((k) => [k, ajustes[k]])),
      servicios: serv.results, colaboradoras, horario: spa.results, hoy: ahoraBogota().fecha,
    };
  });

  r.get('/api/public/dias', 'publico', async ({ db, q }) => {
    const servicioIds = v.listaIds(q.get('servicios'));
    const desde = q.get('desde') ? v.fecha(q.get('desde'), 'desde') : ahoraBogota().fecha;
    const n = v.entero(q.get('n') || '14', 'n', { min: 1, max: 42 });
    const d = await disponibilidad(db, { servicioIds, con: q.get('con') || 'cualquiera', fechas: rangoFechas(desde, n) });
    const dias = Object.fromEntries(Object.entries(d.porFecha).map(([f, t]) => [f, t.length]));
    return { dias, duracion: d.duracion, hay_candidatas: d.candidatas.length > 0 };
  });

  r.get('/api/public/disponibilidad', 'publico', async ({ db, q }) => {
    const servicioIds = v.listaIds(q.get('servicios'));
    const fecha = v.fecha(q.get('fecha'));
    const d = await disponibilidad(db, { servicioIds, con: q.get('con') || 'cualquiera', fechas: [fecha] });
    return {
      fecha, duracion: d.duracion, hay_candidatas: d.candidatas.length > 0,
      turnos: d.porFecha[fecha].map((t) => ({ inicio: t.inicio, fin: t.fin })),
    };
  });

  r.post('/api/public/reservar', 'publico', async ({ db, request, body: datos }) => {
    const ip = ipDe(request);
    await revisarBloqueo(db, 'reserva-ip:' + ip);
    if (datos.sitio_web) falla(400, 'No pudimos procesar la reserva.');
    const servicioIds = v.listaIds(datos.servicios);
    const fecha = v.fecha(datos.fecha);
    const inicio = v.entero(datos.inicio, 'hora', { min: 0, max: 1435 });
    const nombre = v.texto(datos.nombre, 'nombre', { min: 2, max: 80 });
    const celular = v.celular(datos.celular);
    const notas = v.texto(datos.notas, 'notas', { max: 400, opcional: true });
    const con = typeof datos.con === 'string' && datos.con ? datos.con.slice(0, 60) : 'cualquiera';

    await sumarIntento(db, 'reserva-ip:' + ip, { max: 8, ventanaMs: 3600000, bloqueoMs: 3600000 });

    const d = await disponibilidad(db, { servicioIds, con, fechas: [fecha] });
    const turno = d.porFecha[fecha].find((t) => t.inicio === inicio);
    if (!turno) falla(409, 'Ese horario ya no está disponible. Elige otro, por favor.', { codigo: 'ocupado' });

    const hoy = d.ahora.fecha;
    const activas = await db.prepare(
      `SELECT COUNT(*) AS n FROM citas ci JOIN clientas cl ON cl.id = ci.clienta_id
        WHERE cl.celular = ? AND ci.estado = 'confirmada' AND ci.fecha >= ?`
    ).bind(celular, hoy).first();
    if (activas.n >= d.ajustes.max_citas_por_celular) {
      falla(409, `Ya tienes ${activas.n} citas próximas con este número. Escríbenos por WhatsApp si necesitas otra.`, { codigo: 'limite' });
    }

    // Reparte: primero la colaboradora con menos citas ese día.
    let orden = turno.colaboradoras;
    if (orden.length > 1) {
      const marcas = orden.map(() => '?').join(',');
      const { results } = await db.prepare(
        `SELECT colaboradora_id, COUNT(*) AS n FROM citas WHERE fecha = ? AND estado IN ${ESTADOS_ACTIVOS} AND colaboradora_id IN (${marcas}) GROUP BY colaboradora_id`
      ).bind(fecha, ...orden).all();
      const carga = Object.fromEntries(results.map((x) => [x.colaboradora_id, x.n]));
      orden = [...orden].sort((a, b) => (carga[a] || 0) - (carga[b] || 0));
    }

    const clientaId = await clientaPorCelular(db, nombre, celular);
    let creada = null, ultimoError;
    for (const colaboradoraId of orden) {
      try {
        creada = await insertarCita(db, { clientaId, colaboradoraId, fecha, inicio, servicios: d.servicios, notas, quien: 'web' });
        break;
      } catch (e) {
        if (e.status === 409) { ultimoError = e; continue; }
        throw e;
      }
    }
    if (!creada) throw ultimoError;
    const c = await detalleCita(db, 'id', creada.id);
    return { ...citaPublica(c, d.ajustes), token: creada.token };
  });

  r.get('/api/public/cita', 'publico', async ({ db, q }) => {
    const c = await detalleCita(db, 'token', tokenValido(q.get('token')));
    if (!c) falla(404, 'No encontramos esta cita. Revisa el enlace.');
    const ajustes = await leerAjustes(db);
    return citaPublica(c, ajustes);
  });

  r.post('/api/public/cita/cancelar', 'publico', async ({ db, body }) => {
    const c = await detalleCita(db, 'token', tokenValido(body.token));
    if (!c) falla(404, 'No encontramos esta cita.');
    const ajustes = await leerAjustes(db);
    if (!puedeModificar(c, ajustes)) falla(409, `Ya no es posible cancelar en línea (menos de ${ajustes.cancelacion_horas} h). Escríbenos por WhatsApp.`);
    await cancelarCita(db, c.id, 'clienta', 'cancelada desde el enlace');
    return citaPublica(await detalleCita(db, 'id', c.id), ajustes);
  });

  r.post('/api/public/cita/reprogramar', 'publico', async ({ db, body }) => {
    const c = await detalleCita(db, 'token', tokenValido(body.token));
    if (!c) falla(404, 'No encontramos esta cita.');
    const ajustes = await leerAjustes(db);
    if (!puedeModificar(c, ajustes)) falla(409, `Ya no es posible reprogramar en línea (menos de ${ajustes.cancelacion_horas} h). Escríbenos por WhatsApp.`);
    const fecha = v.fecha(body.fecha);
    const inicio = v.entero(body.inicio, 'hora', { min: 0, max: 1435 });
    const servicioIds = c.servicios.map((s) => s.servicio_id).filter(Boolean);
    if (servicioIds.length !== c.servicios.length) falla(409, 'Esta cita debe reprogramarse por WhatsApp.');
    const d = await disponibilidad(db, { servicioIds, con: c.colaboradora_slug, fechas: [fecha], soloVisibles: false, ignorarCita: c.id });
    const turno = d.porFecha[fecha].find((t) => t.inicio === inicio);
    if (!turno) falla(409, 'Ese horario ya no está disponible.', { codigo: 'ocupado' });
    await moverCita(db, c, { colaboradoraId: c.colaboradora_id, fecha, inicio, quien: 'clienta' });
    return citaPublica(await detalleCita(db, 'id', c.id), ajustes);
  });

  // Turnos para reprogramar (misma colaboradora, ignora la propia cita)
  r.get('/api/public/cita/turnos', 'publico', async ({ db, q }) => {
    const c = await detalleCita(db, 'token', tokenValido(q.get('token')));
    if (!c) falla(404, 'No encontramos esta cita.');
    const servicioIds = c.servicios.map((s) => s.servicio_id).filter(Boolean);
    if (servicioIds.length !== c.servicios.length) return { dias: {}, turnos: [] };
    const desde = q.get('desde') ? v.fecha(q.get('desde'), 'desde') : ahoraBogota().fecha;
    const n = v.entero(q.get('n') || '1', 'n', { min: 1, max: 42 });
    const d = await disponibilidad(db, { servicioIds, con: c.colaboradora_slug, fechas: rangoFechas(desde, n), soloVisibles: false, ignorarCita: c.id });
    return {
      dias: Object.fromEntries(Object.entries(d.porFecha).map(([f, t]) => [f, t.length])),
      turnos: n === 1 ? d.porFecha[desde].map((t) => ({ inicio: t.inicio, fin: t.fin })) : undefined,
    };
  });

  r.get('/api/public/cita.ics', 'publico', async ({ db, q }) => {
    const c = await detalleCita(db, 'token', tokenValido(q.get('token')));
    if (!c) falla(404, 'No encontramos esta cita.');
    const ajustes = await leerAjustes(db);
    return respuestaICS(generarICS([eventoCita(c, ajustes)], { metodo: 'PUBLISH' }), `cita-${c.codigo}.ics`);
  });
}

