// Utilidades compartidas del front (reservar + panel). Sin dependencias.

/** Dominio para enlaces que salen de la app (WhatsApp, calendario, copiar enlace). En desarrollo local, el local. */
export const SITIO = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? location.origin : 'https://amelianailspa.com';

/** Acentos de marca permitidos (todos de la paleta del spa, con contraste AA para texto blanco). */
export const ACENTOS = {
  lavanda: { nombre: 'Lavanda', rosa: '#A98BBE', deep: '#7A6494', soft: '#EDE5F2', grad: ['#B79BCB', '#8E74AA', '#7A6494'] },
  ciruela: { nombre: 'Ciruela', rosa: '#9C7AA8', deep: '#5E4570', soft: '#EAE1EF', grad: ['#A887B5', '#7A5A8C', '#5E4570'] },
  rosa: { nombre: 'Rosa antiguo', rosa: '#C48BB0', deep: '#8E5579', soft: '#F5E6EF', grad: ['#D19BBD', '#A86D93', '#8E5579'] },
  malva: { nombre: 'Malva', rosa: '#A88AA0', deep: '#6F5468', soft: '#EFE6EC', grad: ['#B79CB0', '#8A6C82', '#6F5468'] },
};
export function aplicarAcento(clave) {
  const a = ACENTOS[clave] || ACENTOS.lavanda;
  const r = document.documentElement.style;
  r.setProperty('--rosa', a.rosa);
  r.setProperty('--rosa-deep', a.deep);
  r.setProperty('--rosa-soft', a.soft);
  r.setProperty('--grad', `linear-gradient(135deg, ${a.grad[0]} 0%, ${a.grad[1]} 55%, ${a.grad[2]} 100%)`);
}

/** Escapa texto para insertarlo en HTML. */
export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Plantilla segura: los valores se escapan salvo que vengan de otra `html`. */
export function html(partes, ...valores) {
  let s = '';
  partes.forEach((p, i) => {
    s += p;
    if (i < valores.length) s += valor(valores[i]);
  });
  return new Seguro(s);
}
class Seguro { constructor(s) { this.s = s; } toString() { return this.s; } }
function valor(v) {
  if (v instanceof Seguro) return v.s;
  if (Array.isArray(v)) return v.map(valor).join('');
  if (v === false || v == null) return '';
  return esc(v);
}
export const crudo = (s) => new Seguro(String(s));

export const $ = (sel, raiz = document) => raiz.querySelector(sel);
export const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];

export function pintar(el, contenido) {
  el.innerHTML = String(contenido);
  return el;
}

/** Llama la API. Lanza Error con .status y .datos si falla. */
export async function api(ruta, { metodo = 'GET', datos, señal } = {}) {
  const opciones = { method: metodo, headers: {}, credentials: 'same-origin', signal: señal };
  if (datos !== undefined) {
    opciones.headers['Content-Type'] = 'application/json';
    opciones.body = JSON.stringify(datos);
  }
  let res;
  try {
    res = await fetch(ruta, opciones);
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    const err = new Error('Sin conexión. Revisa tu internet e intenta de nuevo.');
    err.status = 0;
    throw err;
  }
  let cuerpo = null;
  try { cuerpo = await res.json(); } catch { /* sin cuerpo */ }
  if (!res.ok) {
    const err = new Error(cuerpo?.error || 'Ocurrió un error. Intenta de nuevo.');
    err.status = res.status;
    err.datos = cuerpo || {};
    throw err;
  }
  return cuerpo;
}

// ---------- formato ----------
const pad = (n) => String(n).padStart(2, '0');
export function hora(min) {
  const h = Math.floor(min / 60), m = min % 60;
  return `${((h + 11) % 12) + 1}:${pad(m)} ${h < 12 ? 'a. m.' : 'p. m.'}`;
}
export function horaCorta(min) {
  const h = Math.floor(min / 60), m = min % 60;
  return `${((h + 11) % 12) + 1}${m ? ':' + pad(m) : ''}${h < 12 ? 'am' : 'pm'}`;
}
export const hhmm = (min) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
export function aMin(s) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s || '');
  return m ? +m[1] * 60 + +m[2] : null;
}
export function duracion(min) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
export function dinero(n) {
  if (n == null) return 'A consultar';
  return '$' + Number(n).toLocaleString('es-CO', { maximumFractionDigits: 0 });
}
export const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
export const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const fechaD = (f) => new Date(f + 'T12:00:00Z');
export function sumarDias(f, n) {
  const d = fechaD(f);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function fechaLarga(f) {
  const d = fechaD(f);
  return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`;
}
export function fechaCorta(f) {
  const d = fechaD(f);
  return `${DIAS_CORTOS[d.getUTCDay()]} ${d.getUTCDate()} ${MESES[d.getUTCMonth()].slice(0, 3)}`;
}
export const diaSemana = (f) => fechaD(f).getUTCDay();
export function hoyBogota() {
  const d = new Date(Date.now() - 5 * 3600000);
  return d.toISOString().slice(0, 10);
}
export function celularBonito(c) {
  const d = String(c || '');
  if (/^573\d{9}$/.test(d)) return `+57 ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8)}`;
  return d ? '+' + d : '';
}
export const inicial = (n) => (String(n || '?').trim()[0] || '?').toUpperCase();

// ---------- avisos ----------
export function toast(msg, tipo = '') {
  let caja = $('.toasts');
  if (!caja) { caja = document.createElement('div'); caja.className = 'toasts'; caja.setAttribute('role', 'status'); document.body.append(caja); }
  const t = document.createElement('div');
  t.className = 'toast ' + tipo;
  t.textContent = msg;
  caja.append(t);
  setTimeout(() => t.remove(), tipo === 'error' ? 5200 : 3200);
}

// ---------- hoja inferior ----------
let hojaActual = null;
export function abrirHoja(contenido, { alCerrar, clase = '' } = {}) {
  cerrarHoja(true);
  const velo = document.createElement('div');
  velo.className = 'velo';
  const hoja = document.createElement('div');
  hoja.className = 'hoja ' + clase;
  hoja.setAttribute('role', 'dialog');
  hoja.setAttribute('aria-modal', 'true');
  pintar(hoja, contenido);
  document.body.append(velo, hoja);
  document.body.classList.add('con-hoja');
  requestAnimationFrame(() => { velo.classList.add('abierto'); hoja.classList.add('abierta'); });
  const cerrar = () => cerrarHoja();
  velo.addEventListener('click', cerrar);
  hoja.addEventListener('click', (e) => { if (e.target.closest('[data-cerrar]')) cerrar(); });
  const esc = (e) => { if (e.key === 'Escape') cerrar(); };
  document.addEventListener('keydown', esc);
  hojaActual = { velo, hoja, alCerrar, esc };
  setTimeout(() => hoja.querySelector('[autofocus]')?.focus(), 320);
  return hoja;
}
export function cerrarHoja(inmediato = false) {
  if (!hojaActual) return;
  const { velo, hoja, alCerrar, esc } = hojaActual;
  hojaActual = null;
  document.removeEventListener('keydown', esc);
  document.body.classList.remove('con-hoja');
  velo.classList.remove('abierto');
  hoja.classList.remove('abierta');
  setTimeout(() => { velo.remove(); hoja.remove(); }, inmediato ? 0 : 300);
  alCerrar?.();
}

export function confirmar(titulo, texto, { si = 'Sí, continuar', peligro = false } = {}) {
  return new Promise((ok) => {
    let decidido = false;
    const h = abrirHoja(html`
      <h2>${titulo}</h2>
      <p class="muted texto-confirmar">${texto}</p>
      <div class="fila-botones">
        <button class="btn sec" data-no>Volver</button>
        <button class="btn ${peligro ? 'peligro' : ''}" data-si>${si}</button>
      </div>`, { alCerrar: () => { if (!decidido) ok(false); } });
    h.querySelector('[data-si]').onclick = () => { decidido = true; cerrarHoja(); ok(true); };
    h.querySelector('[data-no]').onclick = () => { decidido = true; cerrarHoja(); ok(false); };
  });
}

/** Ocupa un botón mientras corre una promesa. */
export async function ocupado(boton, fn) {
  if (!boton) return fn();
  const antes = boton.innerHTML;
  boton.disabled = true;
  boton.innerHTML = '<span class="girando"></span>';
  try { return await fn(); } finally { boton.disabled = false; boton.innerHTML = antes; }
}

export const ICONOS = {
  atras: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  cerrar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>',
  reloj: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  calendario: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4.5" width="18" height="17" rx="3"/><path d="M8 2.5v4M16 2.5v4M3 10h18"/></svg>',
  whatsapp: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.4-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.2-.3-.3-.6-.4zM12 21.8c-1.8 0-3.5-.5-5-1.4l-.4-.2-3.7 1 1-3.6-.2-.4c-1-1.6-1.5-3.4-1.5-5.2C2.2 6.6 6.6 2.2 12 2.2c2.6 0 5.1 1 6.9 2.9 1.8 1.8 2.9 4.3 2.9 6.9 0 5.4-4.4 9.8-9.8 9.8zm8.3-18.1C18.1 1.5 15.1.2 12 .2 5.5.2.2 5.5.2 12c0 2.1.5 4.1 1.6 5.9L.1 24l6.3-1.7c1.7.9 3.7 1.4 5.6 1.4 6.5 0 11.8-5.3 11.8-11.8 0-3.1-1.2-6.1-3.5-8.2z"/></svg>',
  usuaria: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/></svg>',
  equipo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.3 2.9-6 6.5-6s6.5 2.7 6.5 6"/><path d="M16 4.5a3.5 3.5 0 010 7M18.5 14.5c1.8.8 3 2.9 3 5.5"/></svg>',
  chispa: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9z"/><circle cx="19" cy="19" r="2"/><circle cx="5" cy="4" r="1.3"/></svg>',
  mas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  copiar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="12" height="12" rx="2.5"/><path d="M5 15V5a2 2 0 012-2h10"/></svg>',
  ubicacion: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0114 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
};
