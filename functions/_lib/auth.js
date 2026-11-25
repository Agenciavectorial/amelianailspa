// PIN (PBKDF2), sesiones con cookie HttpOnly y límite de intentos.
import { falla } from './http.js';

const ITER = 100_000; // máximo permitido por WebCrypto en Workers
const enc = new TextEncoder();
export const COOKIE = 'amelia_sesion';
const DURACION_SESION = 30 * 24 * 3600 * 1000;      // vence a los 30 días pase lo que pase
const INACTIVIDAD_MAX = 14 * 24 * 3600 * 1000;      // o a los 14 días sin usarse
const MARCAR_USO_CADA = 10 * 60 * 1000;

const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const deB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
export const b64url = (buf) => b64(buf).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export function aleatorio(bytes = 32) {
  return crypto.getRandomValues(new Uint8Array(bytes));
}

export function tokenAleatorio(bytes = 32) {
  return b64url(aleatorio(bytes));
}

export async function sha256(texto) {
  const h = await crypto.subtle.digest('SHA-256', enc.encode(texto));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function derivar(pin, sal, iter) {
  const clave = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: iter }, clave, 256);
}

/** PIN nuevo: exactamente 6 números. */
export function pinValido(pin) {
  return typeof pin === 'string' && /^\d{6}$/.test(pin);
}
/** Al ingresar se aceptan también los PIN viejos (4 a 8) para poder migrarlos a 6. */
export function pinAceptable(pin) {
  return typeof pin === 'string' && /^\d{4,8}$/.test(pin);
}
/** Rechaza PIN fáciles de adivinar (123456, 000000, 111222…). */
export function pinDebil(pin) {
  if (/^(\d)\1{5}$/.test(pin)) return true;
  if ('0123456789012345'.includes(pin) || '9876543210987654'.includes(pin)) return true;
  if (/^(\d\d)\1\1$/.test(pin) || /^(\d\d\d)\1$/.test(pin)) return true;
  return false;
}

export async function hashPin(pin) {
  if (!pinValido(pin)) falla(400, 'El PIN debe tener 6 números.');
  if (pinDebil(pin)) falla(400, 'Ese PIN es muy fácil de adivinar. Elige otro (evita 123456, 000000, 121212…).');
  const sal = aleatorio(16);
  const bits = await derivar(pin, sal, ITER);
  return `pbkdf2$${ITER}$${b64(sal)}$${b64(bits)}`;
}

function igualesTiempoConstante(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a[i] ^ b[i];
  return r === 0;
}

export async function verificarPin(pin, guardado) {
  if (!guardado || !pinAceptable(pin)) return false;
  const [alg, iter, sal, hash] = guardado.split('$');
  if (alg !== 'pbkdf2') return false;
  const bits = new Uint8Array(await derivar(pin, deB64(sal), Number(iter)));
  return igualesTiempoConstante(bits, deB64(hash));
}

// ---------- sesiones ----------

export function leerCookie(request, nombre) {
  const c = request.headers.get('Cookie') || '';
  for (const parte of c.split(';')) {
    const [k, ...v] = parte.trim().split('=');
    if (k === nombre) return v.join('=');
  }
  return null;
}

export function cookieSesion(token, maxAgeSeg = DURACION_SESION / 1000) {
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAgeSeg}`;
}

/** Nombre legible del dispositivo a partir del navegador ("iPhone · Safari"). No se guarda la IP. */
export function nombreDispositivo(ua = '') {
  const so = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS X|Macintosh/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'Otro';
  const nav = /Edg\//.test(ua) ? 'Edge' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /FxiOS|Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Navegador';
  return `${so} · ${nav}`;
}

export async function crearSesion(db, colaboradoraId, dispositivo = '') {
  const token = tokenAleatorio(32);
  const ahora = Date.now();
  await db.batch([
    db.prepare('DELETE FROM sesiones WHERE expira < ? OR ultimo_uso < ?').bind(ahora, ahora - INACTIVIDAD_MAX),
    db.prepare('INSERT INTO sesiones (token_hash, colaboradora_id, expira, dispositivo, ultimo_uso) VALUES (?, ?, ?, ?, ?)')
      .bind(await sha256(token), colaboradoraId, ahora + DURACION_SESION, String(dispositivo).slice(0, 60), ahora),
  ]);
  return token;
}

/** Devuelve la persona de la sesión o null. */
export async function leerSesion(request, db) {
  const token = leerCookie(request, COOKIE);
  if (!token || token.length > 100) return null;
  const hash = await sha256(token);
  const fila = await db.prepare(
    `SELECT c.id, c.slug, c.nombre, c.rol, c.foto, c.color, c.permisos, c.agenda, c.pin_seis, s.token_hash, s.ultimo_uso
       FROM sesiones s JOIN colaboradoras c ON c.id = s.colaboradora_id
      WHERE s.token_hash = ? AND s.expira > ? AND s.ultimo_uso > ? AND c.activa = 1 AND c.pin_hash IS NOT NULL`
  ).bind(hash, Date.now(), Date.now() - INACTIVIDAD_MAX).first();
  if (!fila) return null;
  // Marca el uso cada 10 min (la sesión vence tras 14 días sin abrir el panel).
  if (Date.now() - fila.ultimo_uso > MARCAR_USO_CADA) {
    await db.prepare('UPDATE sesiones SET ultimo_uso = ? WHERE token_hash = ?').bind(Date.now(), hash).run();
  }
  let permisos = {};
  try { permisos = JSON.parse(fila.permisos || '{}'); } catch { /* vacío */ }
  return { ...fila, permisos, esPropietaria: fila.rol === 'propietaria' };
}

export function puede(sesion, permiso) {
  return !!sesion && (sesion.esPropietaria || sesion.permisos?.[permiso] === true);
}

// ---------- límite de intentos ----------

/**
 * Revisa si `clave` está bloqueada. Lanza 429 si lo está.
 */
export async function revisarBloqueo(db, clave) {
  const f = await db.prepare('SELECT bloqueado_hasta FROM intentos WHERE clave = ?').bind(clave).first();
  if (f && f.bloqueado_hasta > Date.now()) {
    const min = Math.ceil((f.bloqueado_hasta - Date.now()) / 60000);
    falla(429, `Demasiados intentos. Intenta de nuevo en ${min} min.`);
  }
}

/**
 * Suma un intento a `clave`. Si supera `max` dentro de `ventanaMs`, bloquea por `bloqueoMs`.
 * Devuelve el conteo actual.
 */
export async function sumarIntento(db, clave, { max, ventanaMs, bloqueoMs }) {
  const ahora = Date.now();
  const f = await db.prepare(
    `INSERT INTO intentos (clave, conteo, ventana) VALUES (?1, 1, ?2)
     ON CONFLICT(clave) DO UPDATE SET
       conteo = CASE WHEN intentos.ventana < ?2 - ?3 THEN 1 ELSE intentos.conteo + 1 END,
       ventana = CASE WHEN intentos.ventana < ?2 - ?3 THEN ?2 ELSE intentos.ventana END
     RETURNING conteo`
  ).bind(clave, ahora, ventanaMs).first();
  if (f.conteo >= max) {
    await db.prepare('UPDATE intentos SET bloqueado_hasta = ?, conteo = 0, ventana = ? WHERE clave = ?')
      .bind(ahora + bloqueoMs, ahora, clave).run();
  }
  return f.conteo;
}

export async function limpiarIntentos(db, clave) {
  await db.prepare('DELETE FROM intentos WHERE clave = ?').bind(clave).run();
}
