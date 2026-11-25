// Validación y normalización de entradas. Cada función lanza HttpError 400 con un mensaje claro.
import { falla } from './http.js';
import { esFecha } from './tiempo.js';

export function texto(v, campo, { min = 0, max = 200, opcional = false } = {}) {
  if (v === undefined || v === null) v = '';
  if (typeof v !== 'string' && typeof v !== 'number') falla(400, `${campo}: valor inválido.`);
  // quita caracteres de control (deja saltos de línea en notas)
  const s = String(v).replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '').trim();
  if (!s && opcional) return '';
  if (s.length < Math.max(min, opcional ? 0 : 1)) falla(400, `${campo}: es obligatorio.`);
  if (s.length > max) falla(400, `${campo}: máximo ${max} caracteres.`);
  return s;
}

export function entero(v, campo, { min = -Infinity, max = Infinity, opcional = false } = {}) {
  if ((v === undefined || v === null || v === '') && opcional) return null;
  const n = typeof v === 'string' ? Number(v.trim()) : v;
  if (!Number.isInteger(n)) falla(400, `${campo}: debe ser un número entero.`);
  if (n < min || n > max) falla(400, `${campo}: fuera de rango.`);
  return n;
}

export function fecha(v, campo = 'fecha') {
  if (!esFecha(v)) falla(400, `${campo}: use el formato AAAA-MM-DD.`);
  return v;
}

export function bool(v) {
  return v === true || v === 1 || v === '1' || v === 'true' || v === 'si' || v === 'sí';
}

/**
 * Normaliza un celular a solo dígitos con indicativo.
 * Colombia: 10 dígitos que empiezan por 3 → 57XXXXXXXXXX. Otros países: 8 a 15 dígitos con su indicativo.
 */
export function celular(v, campo = 'celular', { opcional = false } = {}) {
  const d = String(v ?? '').replace(/\D/g, '');
  if (!d && opcional) return '';
  let n = d;
  if (/^3\d{9}$/.test(n)) n = '57' + n;
  else if (/^0057\d{10}$/.test(n)) n = n.slice(2);
  const valido = n.startsWith('57') ? /^573\d{9}$/.test(n) : /^[1-9]\d{7,14}$/.test(n);
  if (!valido) falla(400, `${campo}: escribe un número de celular válido.`);
  return n;
}

export function email(v, { opcional = true } = {}) {
  const s = texto(v, 'correo', { max: 120, opcional });
  if (s && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) falla(400, 'correo: no es válido.');
  return s.toLowerCase();
}

export function url(v, campo = 'foto') {
  const s = texto(v, campo, { max: 600, opcional: true });
  if (!s) return '';
  if (s.startsWith('/') && !s.startsWith('//') && !s.includes('\\')) return s;
  try {
    const u = new URL(s);
    if (u.protocol !== 'https:') throw new Error();
    return u.toString();
  } catch {
    falla(400, `${campo}: debe ser un enlace https.`);
  }
}

export function color(v) {
  const s = String(v || '').trim();
  return /^#[0-9a-fA-F]{6}$/.test(s) ? s : '#A98BBE';
}

export function slugDe(s) {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/&/g, ' y ')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'item';
}

export function listaIds(v, campo = 'servicios', max = 10) {
  let arr = v;
  if (typeof v === 'string') arr = v.split(',').filter(Boolean);
  if (!Array.isArray(arr) || !arr.length) falla(400, `${campo}: elige al menos uno.`);
  if (arr.length > max) falla(400, `${campo}: máximo ${max}.`);
  const ids = arr.map((x) => entero(x, campo, { min: 1 }));
  return [...new Set(ids)];
}
