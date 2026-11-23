// Web Push sin dependencias: cifrado aes128gcm (RFC 8291) y autenticación VAPID (RFC 8292) con Web Crypto.
// Funciona igual en Cloudflare Workers/Pages y en Node 20+ (pruebas).
const enc = new TextEncoder();

export function b64u(datos) {
  const bytes = typeof datos === 'string' ? enc.encode(datos) : new Uint8Array(datos);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function deB64u(s) {
  const t = String(s).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(t + '='.repeat((4 - (t.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function unir(...partes) {
  const total = partes.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(total);
  let i = 0;
  for (const p of partes) { out.set(p, i); i += p.length; }
  return out;
}

async function hkdf(salt, ikm, info, largo) {
  const k = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, k, largo * 8));
}

/** Genera un par de llaves VAPID: { publica (65 bytes, b64url), privada (d, b64url) }. */
export async function generarVapid() {
  const par = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const jwk = await crypto.subtle.exportKey('jwk', par.privateKey);
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', par.publicKey));
  return { publica: b64u(raw), privada: jwk.d };
}

/** Cabecera Authorization VAPID (JWT ES256) para el origen del endpoint. */
export async function cabeceraVapid(endpoint, { publica, privada, sujeto }, ahoraMs = Date.now()) {
  const pub = deB64u(publica);
  if (pub.length !== 65 || pub[0] !== 4) throw new Error('VAPID_PUBLICA inválida');
  const llave = await crypto.subtle.importKey(
    'jwk',
    { kty: 'EC', crv: 'P-256', x: b64u(pub.slice(1, 33)), y: b64u(pub.slice(33, 65)), d: privada, ext: true },
    { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'],
  );
  const cab = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const carga = b64u(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(ahoraMs / 1000) + 12 * 3600, sub: sujeto || 'mailto:hola@amelianailspa.com' }));
  const firma = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, llave, enc.encode(`${cab}.${carga}`));
  return `vapid t=${cab}.${carga}.${b64u(firma)}, k=${publica}`;
}

/**
 * Cifra el mensaje para una suscripción (RFC 8291, un solo registro).
 * @param {string} texto
 * @param {string} p256dh  llave pública del navegador (b64url, 65 bytes)
 * @param {string} auth    secreto de autenticación del navegador (b64url, 16 bytes)
 */
export async function cifrar(texto, p256dh, auth) {
  const uaPublica = deB64u(p256dh);
  const secreto = deB64u(auth);
  if (uaPublica.length !== 65 || secreto.length !== 16) throw new Error('Suscripción inválida');
  const efimera = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublica = new Uint8Array(await crypto.subtle.exportKey('raw', efimera.publicKey));
  const llaveUa = await crypto.subtle.importKey('raw', uaPublica, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: llaveUa }, efimera.privateKey, 256));
  const ikm = await hkdf(secreto, ecdh, unir(enc.encode('WebPush: info\0'), uaPublica, asPublica), 32);
  const sal = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(sal, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(sal, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const llave = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const plano = unir(enc.encode(texto), new Uint8Array([2])); // delimitador de último registro
  const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, llave, plano));
  const rs = new Uint8Array([0, 0, 0x10, 0]); // 4096
  return unir(sal, rs, new Uint8Array([65]), asPublica, cifrado);
}

// Solo servicios de push reales (evita que alguien use el servidor para llamar a cualquier URL).
const SERVICIOS = ['fcm.googleapis.com', 'android.googleapis.com', 'updates.push.services.mozilla.com', 'push.services.mozilla.com',
  'push.apple.com', 'notify.windows.com'];

export function endpointValido(endpoint, { permitirLocal = false } = {}) {
  let u;
  try { u = new URL(endpoint); } catch { return false; }
  if (permitirLocal && u.protocol === 'http:' && u.hostname === '127.0.0.1') return true;
  if (u.protocol !== 'https:') return false;
  return SERVICIOS.some((h) => u.hostname === h || u.hostname.endsWith('.' + h));
}

export function vapidDe(env) {
  if (!env.VAPID_PUBLICA || !env.VAPID_PRIVADA) return null;
  return { publica: env.VAPID_PUBLICA, privada: env.VAPID_PRIVADA, sujeto: env.VAPID_SUJETO || 'mailto:hola@amelianailspa.com' };
}

/**
 * Envía una notificación. Devuelve { ok, status, expirada } (expirada = el navegador ya no la acepta: borrarla).
 * @param {{endpoint:string,p256dh:string,auth:string}} sub
 * @param {{titulo:string,cuerpo:string,url?:string,tag?:string}} datos
 */
export async function enviarPush(sub, datos, vapid, { ttl = 12 * 3600, urgencia = 'normal', fetchFn = fetch } = {}) {
  const cuerpo = await cifrar(JSON.stringify(datos), sub.p256dh, sub.auth);
  const res = await fetchFn(sub.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await cabeceraVapid(sub.endpoint, vapid),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(ttl),
      Urgency: urgencia,
    },
    body: cuerpo,
  });
  return { ok: res.ok, status: res.status, expirada: res.status === 404 || res.status === 410 };
}
