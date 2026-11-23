// Lado receptor de Web Push (RFC 8291) para pruebas: descifra lo que enviaría el servidor.
import assert from 'node:assert/strict';

/** Descifra como lo haría el navegador (lado receptor de RFC 8291). */
export async function descifrarPush(cuerpo, uaPar, authSecreto) {
  const enc = new TextEncoder();
  const sal = cuerpo.slice(0, 16);
  const idlen = cuerpo[20];
  const asPublica = cuerpo.slice(21, 21 + idlen);
  const cifrado = cuerpo.slice(21 + idlen);
  const uaPublica = new Uint8Array(await crypto.subtle.exportKey('raw', uaPar.publicKey));
  const llaveAs = await crypto.subtle.importKey('raw', asPublica, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: llaveAs }, uaPar.privateKey, 256));
  const hk = async (s, ikm, info, n) => new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: s, info },
    await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']), n * 8));
  const info = new Uint8Array([...enc.encode('WebPush: info\0'), ...uaPublica, ...asPublica]);
  const ikm = await hk(authSecreto, ecdh, info, 32);
  const cek = await hk(sal, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hk(sal, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const plano = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']), cifrado));
  let fin = plano.length - 1;
  while (plano[fin] === 0) fin--;
  assert.equal(plano[fin], 2, 'delimitador de último registro');
  return new TextDecoder().decode(plano.slice(0, fin));
}

