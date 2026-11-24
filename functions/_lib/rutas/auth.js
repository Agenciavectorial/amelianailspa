// Ingreso con PIN por persona, configuración inicial y cambio de PIN.
import { falla, json, ipDe } from '../http.js';
import * as v from '../validar.js';
import {
  hashPin, verificarPin, crearSesion, cookieSesion, leerCookie, sha256, COOKIE,
  revisarBloqueo, sumarIntento, limpiarIntentos, pinValido,
} from '../auth.js';

const LIM_PERSONA = { max: 5, ventanaMs: 15 * 60000, bloqueoMs: 15 * 60000 };
const LIM_IP = { max: 20, ventanaMs: 15 * 60000, bloqueoMs: 15 * 60000 };

export function yoPublico(s) {
  return { id: s.id, slug: s.slug, nombre: s.nombre, rol: s.rol, foto: s.foto, color: s.color, agenda: !!s.agenda, permisos: s.permisos, esPropietaria: s.esPropietaria };
}

async function iniciar(db, persona) {
  const token = await crearSesion(db, persona.id);
  return json({ ok: true }, 200, { 'Set-Cookie': cookieSesion(token) });
}

export function rutasAuth(r) {
  r.get('/api/auth/personas', 'publico', async ({ db }) => {
    const { results } = await db.prepare(
      'SELECT id, nombre, foto, rol, color, pin_hash IS NOT NULL AS tiene_pin FROM colaboradoras WHERE activa = 1 ORDER BY rol DESC, orden, nombre'
    ).all();
    const duena = results.find((p) => p.rol === 'propietaria');
    return {
      // Se muestran todas las activas; las que aún no tienen PIN aparecen marcadas para que Erika se lo asigne.
      personas: results.map((p) => ({ ...p, tiene_pin: !!p.tiene_pin })),
      necesita_configurar: !!duena && !duena.tiene_pin,
    };
  });

  r.post('/api/auth/login', 'publico', async ({ db, body, request }) => {
    const id = v.entero(body.id, 'persona', { min: 1 });
    const pin = String(body.pin ?? '');
    const claveIp = 'pin-ip:' + ipDe(request);
    const clavePersona = 'pin:' + id;
    await revisarBloqueo(db, claveIp);
    await revisarBloqueo(db, clavePersona);
    const p = await db.prepare('SELECT id, pin_hash FROM colaboradoras WHERE id = ? AND activa = 1').bind(id).first();
    if (!p || !(await verificarPin(pin, p.pin_hash))) {
      const n = await sumarIntento(db, clavePersona, LIM_PERSONA);
      await sumarIntento(db, claveIp, LIM_IP);
      const quedan = Math.max(0, LIM_PERSONA.max - n);
      falla(401, quedan > 0 ? `PIN incorrecto. Te quedan ${quedan} intento${quedan === 1 ? '' : 's'}.` : 'PIN incorrecto. Bloqueado por 15 minutos.');
    }
    await limpiarIntentos(db, clavePersona);
    return iniciar(db, p);
  });

  r.post('/api/auth/logout', 'publico', async ({ db, request }) => {
    const token = leerCookie(request, COOKIE);
    if (token) await db.prepare('DELETE FROM sesiones WHERE token_hash = ?').bind(await sha256(token)).run();
    return json({ ok: true }, 200, { 'Set-Cookie': cookieSesion('', 0) });
  });

  r.get('/api/auth/yo', 'sesion', async ({ sesion }) => yoPublico(sesion));

  // Primer ingreso de Erika: crea su PIN con la clave inicial (secreto CLAVE_INICIAL en Cloudflare).
  r.post('/api/auth/configurar', 'publico', async ({ db, env, body, request }) => {
    const claveIp = 'config-ip:' + ipDe(request);
    await revisarBloqueo(db, claveIp);
    const duena = await db.prepare(`SELECT id, pin_hash FROM colaboradoras WHERE rol = 'propietaria' AND activa = 1 ORDER BY id LIMIT 1`).first();
    if (!duena) falla(404, 'No hay propietaria registrada.');
    if (duena.pin_hash) falla(409, 'El PIN de la propietaria ya fue configurado.');
    const esperado = env.CLAVE_INICIAL || '';
    if (esperado.length < 8) falla(503, 'Falta configurar el secreto CLAVE_INICIAL en Cloudflare (mínimo 8 caracteres).');
    const dada = String(body.clave ?? '');
    const [a, b] = await Promise.all([sha256(dada), sha256(esperado)]);
    if (a !== b) {
      await sumarIntento(db, claveIp, { max: 5, ventanaMs: 3600000, bloqueoMs: 3600000 });
      falla(401, 'La clave inicial no es correcta.');
    }
    if (!pinValido(body.pin)) falla(400, 'El PIN debe tener de 4 a 8 números.');
    await db.prepare('UPDATE colaboradoras SET pin_hash = ? WHERE id = ? AND pin_hash IS NULL').bind(await hashPin(body.pin), duena.id).run();
    return iniciar(db, duena);
  });

  r.post('/api/auth/cambiar-pin', 'sesion', async ({ db, sesion, body, request }) => {
    const claveIp = 'pin-ip:' + ipDe(request);
    await revisarBloqueo(db, 'pin:' + sesion.id);
    const p = await db.prepare('SELECT pin_hash FROM colaboradoras WHERE id = ?').bind(sesion.id).first();
    if (!(await verificarPin(String(body.actual ?? ''), p.pin_hash))) {
      await sumarIntento(db, 'pin:' + sesion.id, LIM_PERSONA);
      await sumarIntento(db, claveIp, LIM_IP);
      falla(401, 'El PIN actual no es correcto.');
    }
    const nuevo = await hashPin(String(body.nuevo ?? ''));
    await db.batch([
      db.prepare('UPDATE colaboradoras SET pin_hash = ? WHERE id = ?').bind(nuevo, sesion.id),
      db.prepare('DELETE FROM sesiones WHERE colaboradora_id = ? AND token_hash <> ?').bind(sesion.id, sesion.token_hash),
    ]);
    return { ok: true };
  });
}
