// Suscripciones a notificaciones push (clienta y equipo) y disparo protegido de recordatorios.
import { falla, ipDe } from '../http.js';
import { sha256, revisarBloqueo, sumarIntento } from '../auth.js';
import { endpointValido, vapidDe, enviarPush } from '../push.js';
import { ejecutarRecordatorios } from '../notificaciones.js';

function leerSuscripcion(env, s) {
  const endpoint = s?.endpoint, p256dh = s?.keys?.p256dh, auth = s?.keys?.auth;
  if (typeof endpoint !== 'string' || endpoint.length > 1000 || !endpointValido(endpoint, { permitirLocal: env.PUSH_PERMITIR_LOCAL === '1' })) {
    falla(400, 'Suscripción no válida.');
  }
  if (typeof p256dh !== 'string' || !/^[A-Za-z0-9_-]{80,100}$/.test(p256dh) || typeof auth !== 'string' || !/^[A-Za-z0-9_-]{16,30}$/.test(auth)) {
    falla(400, 'Suscripción no válida.');
  }
  return { endpoint, p256dh, auth };
}

async function guardar(db, sub, { tipo, colaboradoraId = null, clientaId = null }) {
  await db.prepare(
    `INSERT INTO push_suscripciones (endpoint, p256dh, auth, tipo, colaboradora_id, clienta_id) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth, tipo = excluded.tipo,
       colaboradora_id = excluded.colaboradora_id, clienta_id = excluded.clienta_id, fallos = 0`
  ).bind(sub.endpoint, sub.p256dh, sub.auth, tipo, colaboradoraId, clientaId).run();
}

export function rutasPush(r) {
  r.get('/api/public/push/clave', 'publico', async ({ env }) => {
    const v = vapidDe(env);
    if (!v) falla(404, 'Las notificaciones no están configuradas.');
    return { clave: v.publica };
  });

  // La clienta se suscribe con los enlaces privados de sus citas (no hay cuenta).
  r.post('/api/public/push/suscribir', 'publico', async ({ db, env, body, request }) => {
    if (!vapidDe(env)) falla(404, 'Las notificaciones no están configuradas.');
    const claveIp = 'push-ip:' + ipDe(request);
    await revisarBloqueo(db, claveIp);
    await sumarIntento(db, claveIp, { max: 30, ventanaMs: 3600000, bloqueoMs: 3600000 });
    const sub = leerSuscripcion(env, body.suscripcion);
    const tokens = (Array.isArray(body.tokens) ? body.tokens : []).filter((t) => typeof t === 'string' && /^[A-Za-z0-9_-]{20,64}$/.test(t)).slice(-12);
    if (!tokens.length) falla(400, 'Primero reserva una cita.');
    const marcas = tokens.map(() => '?').join(',');
    const c = await db.prepare(`SELECT clienta_id FROM citas WHERE token IN (${marcas}) ORDER BY id DESC LIMIT 1`).bind(...tokens).first();
    if (!c) falla(404, 'No encontramos tus citas.');
    await guardar(db, sub, { tipo: 'clienta', clientaId: c.clienta_id });
    return { ok: true };
  });

  r.post('/api/public/push/cancelar', 'publico', async ({ db, body }) => {
    if (typeof body.endpoint === 'string') await db.prepare('DELETE FROM push_suscripciones WHERE endpoint = ?').bind(body.endpoint).run();
    return { ok: true };
  });

  r.post('/api/panel/push/suscribir', 'sesion', async ({ db, env, sesion, body }) => {
    if (!vapidDe(env)) falla(404, 'Las notificaciones no están configuradas.');
    await guardar(db, leerSuscripcion(env, body.suscripcion), { tipo: 'equipo', colaboradoraId: sesion.id });
    return { ok: true };
  });

  r.post('/api/panel/push/prueba', 'sesion', async ({ db, env, sesion }) => {
    const v = vapidDe(env);
    if (!v) falla(404, 'Las notificaciones no están configuradas.');
    const { results } = await db.prepare("SELECT * FROM push_suscripciones WHERE tipo = 'equipo' AND colaboradora_id = ?").bind(sesion.id).all();
    if (!results.length) falla(404, 'Este celular aún no tiene las notificaciones activas.');
    let ok = 0;
    for (const s of results) {
      const res = await enviarPush(s, { titulo: '¡Notificaciones activas! 💜', cuerpo: `Hola ${sesion.nombre}, aquí te avisaremos de citas nuevas y cambios.`, url: '/panel/' }, v);
      if (res.ok) ok++;
      else if (res.expirada) await db.prepare('DELETE FROM push_suscripciones WHERE id = ?').bind(s.id).run();
    }
    return { enviados: ok, total: results.length };
  });

  // Disparo manual o externo de los recordatorios (el Worker con cron llama a la misma función).
  r.post('/api/interno/recordatorios', 'publico', async ({ env, request, body }) => {
    const esperado = env.CRON_CLAVE || '';
    const dada = request.headers.get('X-Cron-Clave') || '';
    if (esperado.length < 16 || (await sha256(dada)) !== (await sha256(esperado))) falla(404, 'No encontrado.');
    const ahoraMs = Number.isFinite(body.ahora_ms) ? body.ahora_ms : Date.now();
    return ejecutarRecordatorios(env, { ahoraMs, maxEnvios: Number(body.max_envios) || 10 });
  });
}
