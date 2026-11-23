// Notificaciones: avisos al equipo (cita nueva, cambio, cancelación) y recordatorios a clientas
// (24 h y 2 h antes, "te toca volver"). Canal hoy: Web Push. Punto de integración: WhatsApp Business API.
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

/**
 * Tarea programada (cada 15 min): recordatorios a clientas con notificaciones activas.
 * - r24: la cita empieza entre 20 y 24 h desde ahora.
 * - r2: la cita empieza en menos de 2 h 15 min.
 * - vuelve: según el ciclo de retorno del último servicio (solo entre 10:00 y 19:00).
 */
export async function ejecutarRecordatorios(env, { ahoraMs = Date.now(), maxEnvios = 10 } = {}) {
  // Tope por ejecución: el plan gratuito limita las consultas por invocación; lo que falte sale en la siguiente (15 min).
  const db = env.DB;
  const res = { r24: 0, r2: 0, vuelve: 0, pendientes: false, sin_vapid: !vapidDe(env) };
  let presupuesto = maxEnvios;
  if (res.sin_vapid) return res;
  const { fecha: hoy, minuto } = ahoraBogota(ahoraMs);
  const manana = sumarDias(hoy, 1);

  const { results: citas } = await db.prepare(
    `SELECT ci.id, ci.token, ci.fecha, ci.inicio, ci.clienta_id, co.nombre AS colaboradora, cl.nombre AS clienta,
            (SELECT GROUP_CONCAT(nombre, ' + ') FROM cita_servicios cs WHERE cs.cita_id = ci.id) AS servicios
       FROM citas ci JOIN colaboradoras co ON co.id = ci.colaboradora_id JOIN clientas cl ON cl.id = ci.clienta_id
      WHERE ci.estado = 'confirmada' AND ci.fecha BETWEEN ? AND ?
        AND EXISTS (SELECT 1 FROM push_suscripciones s WHERE s.clienta_id = ci.clienta_id)`
  ).bind(hoy, sumarDias(hoy, 2)).all();

  for (const c of citas) {
    const faltanMin = (aUTC(c.fecha, c.inicio).getTime() - ahoraMs) / 60000;
    let tipo = null;
    if (faltanMin > 20 * 60 && faltanMin <= 24 * 60) tipo = 'r24';
    else if (faltanMin > 0 && faltanMin <= 135) tipo = 'r2';
    if (!tipo) continue;
    if (presupuesto <= 0) { res.pendientes = true; break; }
    if (!(await primeraVez(db, `${tipo}:${c.id}`))) continue;
    presupuesto--;
    const { results: subs } = await db.prepare('SELECT * FROM push_suscripciones WHERE clienta_id = ?').bind(c.clienta_id).all();
    const nombre = c.clienta.split(' ')[0];
    const dia = c.fecha === hoy ? 'hoy' : c.fecha === manana ? 'mañana' : fechaTexto(c.fecha);
    const r = await enviarA(env, db, subs, {
      titulo: tipo === 'r24' ? `${nombre}, te esperamos ${dia} 💅` : `¡Ya casi, ${nombre}! ✨`,
      cuerpo: `${c.servicios} a las ${horaTexto(c.inicio)} con ${c.colaboradora}. Toca para ver o cambiar tu cita.`,
      url: `/reservar/cita/#${c.token}`,
      tag: `recordatorio-${c.id}`,
    }, { urgencia: tipo === 'r2' ? 'high' : 'normal', ttl: tipo === 'r2' ? 2 * 3600 : 12 * 3600 });
    if (r.enviados) res[tipo]++;
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
