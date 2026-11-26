// Suscripción a notificaciones push desde el navegador (clienta en /reservar, equipo en /panel).
import { api } from './util.js?v=7462d0b2a7';

function deB64u(s) {
  const t = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(t + '='.repeat((4 - (t.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export const esIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
export const instalada = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

async function registro(sw, scope) {
  return (await navigator.serviceWorker.getRegistration(scope)) || navigator.serviceWorker.register(sw, { scope });
}

/**
 * Estado en este dispositivo: 'activo' | 'inactivo' | 'bloqueado' | 'ios-instalar' | 'no-soportado' | 'sin-configurar'
 */
export async function estadoPush({ sw, scope }) {
  if (!('serviceWorker' in navigator)) return 'no-soportado';
  if (!('PushManager' in window) || !('Notification' in window)) return esIOS() && !instalada() ? 'ios-instalar' : 'no-soportado';
  if (Notification.permission === 'denied') return 'bloqueado';
  try { await api('/api/public/push/clave'); } catch { return 'sin-configurar'; }
  const reg = await registro(sw, scope);
  const sub = await reg.pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? 'activo' : 'inactivo';
}

/** Pide permiso, se suscribe y guarda la suscripción en el servidor (ruta y datos extra según quién). */
export async function activarPush({ sw, scope, ruta, extra = {} }) {
  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') throw new Error(permiso === 'denied' ? 'Bloqueaste las notificaciones. Actívalas en los ajustes del navegador.' : 'No se activaron las notificaciones.');
  const { clave } = await api('/api/public/push/clave');
  await registro(sw, scope);
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: deB64u(clave) });
  await api(ruta, { metodo: 'POST', datos: { suscripcion: sub.toJSON(), ...extra } });
  return sub;
}

export async function desactivarPush({ scope }) {
  const reg = await navigator.serviceWorker.getRegistration(scope);
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await api('/api/public/push/cancelar', { metodo: 'POST', datos: { endpoint: sub.endpoint } }).catch(() => {});
  await sub.unsubscribe();
}
