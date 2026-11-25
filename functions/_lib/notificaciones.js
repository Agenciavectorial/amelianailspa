// Notificaciones (Web Push):
// - Equipo: cita nueva, movida o cancelada al instante; resumen del día por la mañana; "en 1 hora" antes de cada cita.
// - Clienta: confirmación al agendar ("recuerda tu cita el día X a la hora Y"), la mañana del mismo día y 1 hora antes;
//   aviso si el spa le mueve o cancela la cita; "te toca volver" según el ciclo del servicio.
// Punto de integración futuro: WhatsApp Business API.
import { enviarPush, vapidDe } from './push.js';
import { ahoraBogota, aUTC, sumarDias, difDias, horaTexto, fechaTexto } from './tiempo.js';

/**
 * Punto de integración para WhatsApp Business API (decisión del usuario: tiene costo por mensaje).
 * Si algún día se configuran WHATSAPP_TOKEN y WHATSAPP_PHONE_ID (Meta Cloud API) y plantillas aprobadas,
 * implementar aquí el POST a https://graph.facebook.com/v20.0/<PHONE_ID>/messages con la plantilla.
 * Hoy no envía nada y lo dice.
 */
export async function enviarWhatsAppAutomatico(env /* , celular, plantilla, variables */) {
  if (!env.WHATSAPP_TOKEN || !env.WHATSAPP_PHONE_ID) return { enviado: false, motivo: 'WhatsApp Business API no configurada' };
  return { enviado: false, motivo: 'Integración pendiente de plantillas aprobadas (ver PENDIENTES.md)' };
}

async function enviarA(env, db, subs, datos, opciones = {}) {
  const vapid = vapidDe(env);
  if (!vapid || !subs.length) return { enviados: 0, fallidos: 0 };
  let enviados = 0, fallidos = 0;
  for (const s of subs) {
    try {
      const r = await enviarPush(s, datos, vapid, opciones);
      if (r.ok) {
        enviados++;
        await db.prepare("UPDATE push_suscripciones SET ultimo_envio = datetime('now'), fallos = 0 WHERE id = ?").bind(s.id).run();
      } else if (r.expirada) {
        fallidos++;
        await db.prepare('DELETE FROM push_suscripciones WHERE id = ?').bind(s.id).run();
      } else {
        fallidos++;
        await db.prepare('UPDATE push_suscripciones SET fallos = fallos + 1 WHERE id = ?').bind(s.id).run();
        await db.prepare('DELETE FROM push_suscripciones WHERE id = ? AND fallos >= 5').bind(s.id).run();
      }
    } catch (e) {
      fallidos++;
      console.error('push', e?.message || e);
    }
  }
  return { enviados, fallidos };
}

/**
 * Avisa a la colaboradora de la cita y a la propietaria (menos a quien hizo el cambio).
 * @param {'nueva'|'movida'|'cancelada'} tipo
 */
export async function avisarEquipo(env, citaId, tipo, { excluirId = null } = {}) {
  const db = env.DB;
  if (!vapidDe(env)) return { enviados: 0 };
  const c = await db.prepare(
    `SELECT ci.id, ci.fecha, ci.inicio, ci.colaboradora_id, ci.origen, cl.nombre AS clienta, co.nombre AS colaboradora,
            (SELECT GROUP_CONCAT(nombre, ' + ') FROM cita_servicios cs WHERE cs.cita_id = ci.id) AS servicios
       FROM citas ci JOIN clientas cl ON cl.id = ci.clienta_id JOIN colaboradoras co ON co.id = ci.colaboradora_id WHERE ci.id = ?`
  ).bind(citaId).first();
  if (!c) return { enviados: 0 };
  const { results: subs } = await db.prepare(
    `SELECT s.* FROM push_suscripciones s JOIN colaboradoras co ON co.id = s.colaboradora_id
      WHERE s.tipo = 'equipo' AND co.activa = 1 AND (s.colaboradora_id = ? OR co.rol = 'propietaria') AND s.colaboradora_id IS NOT ?`
  ).bind(c.colaboradora_id, excluirId).all();
  const cuando = `${fechaTexto(c.fecha)} · ${horaTexto(c.inicio)}`;
  const titulos = {
    nueva: c.origen === 'web' ? '💜 Nueva reserva en línea' : '📅 Nueva cita',
    movida: '🔁 Cita movida',
    cancelada: '✖️ Cita cancelada',
  };
  return enviarA(env, db, subs, {
    titulo: titulos[tipo] || 'Agenda actualizada',
    cuerpo: `${c.clienta} · ${c.servicios} con ${c.colaboradora} — ${cuando}`,
    url: `/panel/#/agenda/${c.fecha}/dia/`,
    tag: `cita-${c.id}`,
  }, { urgencia: 'high', ttl: 6 * 3600 });
}

/** Marca una clave de envío; devuelve true solo la primera vez (evita duplicados aunque el cron corra dos veces). */
async function primeraVez(db, clave) {
  const r = await db.prepare('INSERT OR IGNORE INTO push_enviados (clave) VALUES (?)').bind(clave).run();
  return r.meta.changes > 0;
}

const SQL_CITA = `SELECT ci.id, ci.token, ci.fecha, ci.inicio, ci.estado, ci.clienta_id, ci.colaboradora_id, cl.nombre AS clienta, co.nombre AS colaboradora,
        (SELECT GROUP_CONCAT(nombre, ' + ') FROM cita_servicios cs WHERE cs.cita_id = ci.id) AS servicios
   FROM citas ci JOIN clientas cl ON cl.id = ci.clienta_id JOIN colaboradoras co ON co.id = ci.colaboradora_id`;

const subsClienta = async (db, clientaId) => (await db.prepare('SELECT * FROM push_suscripciones WHERE clienta_id = ?').bind(clientaId).all()).results;

function diaRelativo(fecha, hoy) {
  if (fecha === hoy) return 'hoy';
  if (fecha === sumarDias(hoy, 1)) return 'mañana';
  return `el ${fechaTexto(fecha)}`;
}

/**
 * Aviso a la clienta (si activó las notificaciones) cuando se agenda, o cuando el spa le mueve o cancela la cita.
 * La confirmación sale una sola vez por cita.
 * @param {'nueva'|'movida'|'cancelada'} tipo
 */
export async function avisarClienta(env, citaId, tipo, { ahoraMs = Date.now() } = {}) {
  const db = env.DB;
  if (!vapidDe(env)) return { enviados: 0 };
  const c = await db.prepare(`${SQL_CITA} WHERE ci.id = ?`).bind(citaId).first();
  if (!c) return { enviados: 0 };
  const subs = await subsClienta(db, c.clienta_id);
  if (!subs.length) return { enviados: 0 };
  if (tipo === 'nueva' && !(await primeraVez(db, `conf:${c.id}`))) return { enviados: 0 };
  const { fecha: hoy } = ahoraBogota(ahoraMs);
  const nombre = c.clienta.split(' ')[0];
  const cuando = `${diaRelativo(c.fecha, hoy)} a las ${horaTexto(c.inicio)}`;
  const datos = {
    nueva: { titulo: `¡Listo, ${nombre}! Tu cita quedó agendada ✅`, cuerpo: `Recuerda tu cita ${c.fecha === hoy ? 'hoy' : `el ${fechaTexto(c.fecha)}`} a las ${horaTexto(c.inicio)}: ${c.servicios} con ${c.colaboradora}. Te avisaremos ese día y 1 hora antes.` },
    movida: { titulo: `${nombre}, tu cita cambió 🔁`, cuerpo: `Ahora es ${cuando} con ${c.colaboradora} (${c.servicios}). Toca para ver los detalles.` },
    cancelada: { titulo: `${nombre}, tu cita fue cancelada`, cuerpo: `${c.servicios} ${cuando}. Si quieres, agenda otra hora en un toque.` },
  }[tipo];
  if (!datos) return { enviados: 0 };
  return enviarA(env, db, subs, { ...datos, url: tipo === 'cancelada' ? '/reservar/' : `/reservar/cita/#${c.token}`, tag: `cita-${c.id}` },
    { urgencia: 'high', ttl: 12 * 3600 });
}

/** Confirma a la clienta su próxima cita al activar las notificaciones (si no se le había confirmado ya). */
export async function confirmarProxima(env, clientaId, { ahoraMs = Date.now() } = {}) {
  const { fecha: hoy } = ahoraBogota(ahoraMs);
  const c = await env.DB.prepare(`SELECT id FROM citas WHERE clienta_id = ? AND estado = 'confirmada' AND fecha >= ? ORDER BY id DESC LIMIT 1`)
    .bind(clientaId, hoy).first();
  return c ? avisarClienta(env, c.id, 'nueva', { ahoraMs }) : { enviados: 0 };
}

/**
 * Tarea programada (cada 15 min). Horas de Colombia.
 * Clientas con notificaciones:
 * - (al agendar: confirmación con día y hora, en avisarClienta)
 * - dia: la cita es hoy, ya son las 7:00 a. m. y faltan más de 100 min (si falta menos, sale solo la de 1 hora).
 * - r1: falta 1 hora o menos (75 min de margen por el intervalo del cron).
 * - vuelve: según el ciclo de retorno del último servicio (solo entre 10:00 y 19:00).
 * Equipo (colaboradoras con la app y los avisos activos):
 * - eq_dia: entre 7:00 y 10:00 a. m., resumen de sus citas del día (a Erika, el total del spa).
 * - eq_r1: 1 hora antes de cada cita, a la colaboradora que la atiende.
 */
export async function ejecutarRecordatorios(env, { ahoraMs = Date.now(), maxEnvios = 25 } = {}) {
  // Tope por ejecución: el plan gratuito limita las consultas por invocación; lo que falte sale en la siguiente (15 min).
  const db = env.DB;
  const res = { dia: 0, r1: 0, eq_dia: 0, eq_r1: 0, vuelve: 0, pendientes: false, sin_vapid: !vapidDe(env) };
  let presupuesto = maxEnvios;
  if (res.sin_vapid) return res;
  const { fecha: hoy, minuto } = ahoraBogota(ahoraMs);

  // ---------- clientas ----------
  const { results: citas } = await db.prepare(
    `${SQL_CITA}
      WHERE ci.estado = 'confirmada' AND ci.fecha = ?
        AND EXISTS (SELECT 1 FROM push_suscripciones s WHERE s.clienta_id = ci.clienta_id)`
  ).bind(hoy).all();

  for (const c of citas) {
    const faltanMin = (aUTC(c.fecha, c.inicio).getTime() - ahoraMs) / 60000;
    let tipo = null;
    // Tres avisos por cita: al agendar (avisarClienta), la mañana del mismo día y 1 hora antes.
    if (faltanMin > 0 && faltanMin <= 75) tipo = 'r1';
    else if (c.fecha === hoy && minuto >= 420 && faltanMin > 100) tipo = 'dia';
    if (!tipo) continue;
    if (presupuesto <= 0) { res.pendientes = true; break; }
    if (!(await primeraVez(db, `${tipo}:${c.id}`))) continue;
    presupuesto--;
    const nombre = c.clienta.split(' ')[0];
    const textos = {
      dia: [`¡Hoy es tu cita, ${nombre}! 💜`, `Recuerda: hoy a las ${horaTexto(c.inicio)}, ${c.servicios} con ${c.colaboradora}. Si necesitas cambiarla, toca aquí.`],
      r1: [`${nombre}, tu cita es en 1 hora ✨`, `${c.servicios} a las ${horaTexto(c.inicio)} con ${c.colaboradora}. ¡Nos vemos pronto!`],
    }[tipo];
    const r = await enviarA(env, db, await subsClienta(db, c.clienta_id), {
      titulo: textos[0], cuerpo: textos[1], url: `/reservar/cita/#${c.token}`, tag: `recordatorio-${c.id}`,
    }, { urgencia: tipo === 'r1' ? 'high' : 'normal', ttl: tipo === 'r1' ? 3600 : 10 * 3600 });
    if (r.enviados) res[tipo]++;
  }

  // ---------- equipo ----------
  const { results: subsEquipo } = await db.prepare(
    `SELECT s.*, co.nombre AS nombre_colab, co.rol FROM push_suscripciones s JOIN colaboradoras co ON co.id = s.colaboradora_id
      WHERE s.tipo = 'equipo' AND co.activa = 1`
  ).all();
  if (subsEquipo.length) {
    const { results: deHoy } = await db.prepare(`${SQL_CITA} WHERE ci.estado = 'confirmada' AND ci.fecha = ? ORDER BY ci.inicio`).bind(hoy).all();
    const porColab = new Map();
    for (const s of subsEquipo) {
      if (!porColab.has(s.colaboradora_id)) porColab.set(s.colaboradora_id, { nombre: s.nombre_colab, rol: s.rol, subs: [] });
      porColab.get(s.colaboradora_id).subs.push(s);
    }
    // 1 hora antes, a quien atiende
    for (const c of deHoy) {
      const faltanMin = (aUTC(c.fecha, c.inicio).getTime() - ahoraMs) / 60000;
      const q = porColab.get(c.colaboradora_id);
      if (!q || !(faltanMin > 0 && faltanMin <= 75)) continue;
      if (presupuesto <= 0) { res.pendientes = true; break; }
      if (!(await primeraVez(db, `eq_r1:${c.id}`))) continue;
      presupuesto--;
      const r = await enviarA(env, db, q.subs, {
        titulo: `⏰ En 1 hora: ${c.clienta}`,
        cuerpo: `${c.servicios} a las ${horaTexto(c.inicio)}.`,
        url: `/panel/#/agenda/${c.fecha}/lista/`, tag: `eq-r1-${c.id}`,
      }, { urgencia: 'high', ttl: 3600 });
      if (r.enviados) res.eq_r1++;
    }
    // Resumen de la mañana
    if (minuto >= 420 && minuto < 600) {
      for (const [id, q] of porColab) {
        const duena = q.rol === 'propietaria';
        const lista = duena ? deHoy : deHoy.filter((c) => c.colaboradora_id === id);
        const proximas = lista.filter((c) => aUTC(c.fecha, c.inicio).getTime() > ahoraMs);
        if (!proximas.length) continue;
        if (presupuesto <= 0) { res.pendientes = true; break; }
        if (!(await primeraVez(db, `eq_dia:${id}:${hoy}`))) continue;
        presupuesto--;
        const p = proximas[0];
        const n = lista.length;
        const r = await enviarA(env, db, q.subs, {
          titulo: `☀️ Buenos días, ${q.nombre.split(' ')[0]}`,
          cuerpo: duena
            ? `Hoy hay ${n} ${n === 1 ? 'cita' : 'citas'} en el spa. La próxima: ${horaTexto(p.inicio)} · ${p.clienta} con ${p.colaboradora}.`
            : `Hoy tienes ${n} ${n === 1 ? 'cita' : 'citas'}. La primera: ${horaTexto(p.inicio)} · ${p.clienta} (${p.servicios}).`,
          url: `/panel/#/agenda/${hoy}/lista/`, tag: `eq-dia-${hoy}`,
        }, { ttl: 4 * 3600 });
        if (r.enviados) res.eq_dia++;
      }
    }
  }

  // "Te toca volver": solo en horario amable
  if (minuto >= 600 && minuto < 1140) {
    const { results } = await db.prepare(
      `WITH ultima AS (
         SELECT c.clienta_id, c.id AS cita_id, c.fecha, c.colaboradora_id,
                ROW_NUMBER() OVER (PARTITION BY c.clienta_id ORDER BY c.fecha DESC, c.inicio DESC) AS rn
           FROM citas c WHERE c.estado = 'asistio' AND c.clienta_id IN (SELECT clienta_id FROM push_suscripciones WHERE clienta_id IS NOT NULL))
       SELECT u.clienta_id, u.fecha AS ultima, cl.nombre, co.nombre AS colaboradora, co.slug AS colab_slug, co.activa AS colab_activa,
              (SELECT MIN(s.ciclo_dias) FROM cita_servicios cs JOIN servicios s ON s.id = cs.servicio_id WHERE cs.cita_id = u.cita_id) AS ciclo,
              (SELECT GROUP_CONCAT(cs.nombre, ' + ') FROM cita_servicios cs WHERE cs.cita_id = u.cita_id) AS servicios,
              (SELECT GROUP_CONCAT(s.slug) FROM cita_servicios cs JOIN servicios s ON s.id = cs.servicio_id WHERE cs.cita_id = u.cita_id AND s.visible = 1) AS slugs
         FROM ultima u JOIN clientas cl ON cl.id = u.clienta_id JOIN colaboradoras co ON co.id = u.colaboradora_id
        WHERE u.rn = 1 AND NOT EXISTS (SELECT 1 FROM citas f WHERE f.clienta_id = u.clienta_id AND f.estado = 'confirmada' AND f.fecha >= ?)`
    ).bind(hoy).all();
    for (const c of results) {
      if (!c.ciclo) continue;
      const dias = difDias(c.ultima, hoy);
      if (dias < c.ciclo || dias > c.ciclo + 14) continue; // le toca (y no hace demasiado)
      if (presupuesto <= 0) { res.pendientes = true; break; }
      if (!(await primeraVez(db, `vuelve:${c.clienta_id}:${c.ultima}`))) continue;
      presupuesto--;
      const p = new URLSearchParams();
      if (c.slugs) p.set('servicio', c.slugs);
      if (c.colab_activa) p.set('con', c.colab_slug);
      const { results: subs } = await db.prepare('SELECT * FROM push_suscripciones WHERE clienta_id = ?').bind(c.clienta_id).all();
      const r = await enviarA(env, db, subs, {
        titulo: `${c.nombre.split(' ')[0]}, ¿te consentimos otra vez? 💜`,
        cuerpo: `Ya va siendo hora de tu ${c.servicios}${c.colab_activa ? ` con ${c.colaboradora}` : ''}. Reserva en un toque.`,
        url: `/reservar/?${p}`,
        tag: `vuelve-${c.clienta_id}`,
      });
      if (r.enviados) {
        res.vuelve++;
        await db.prepare(`INSERT INTO mensajes (clienta_id, tipo, canal, quien) VALUES (?, 'vuelve', 'push', 'automático')`).bind(c.clienta_id).run();
      }
    }
  }
  // Limpieza de claves viejas
  await db.prepare("DELETE FROM push_enviados WHERE creado < datetime('now', '-120 days')").run();
  return res;
}
