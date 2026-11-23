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

// ---------- capas en el historial ----------
// Una hoja o el visor de fotos pueden ocupar una entrada del historial: el botón "atrás" del celular cierra
// solo la capa de arriba (visor → ficha → lista) y la página no cambia de paso. Al cerrar con la X se
// retrocede esa entrada sin que la página se entere. `trasHistorial` deja para después los pushState de la
// página mientras ese retroceso está en curso (si no, se mezclarían las entradas).
const capas = [];
let tragar = 0;
const enEspera = [];
export function trasHistorial(fn) { if (tragar) enEspera.push(fn); else fn(); }
function empujarCapa(alVolver) {
  history.pushState({ ...(history.state || {}), capa: (history.state?.capa || 0) + 1 }, '');
  capas.push(alVolver);
}
function quitarCapa(alVolver) {
  const i = capas.lastIndexOf(alVolver);
  if (i < 0) return;
  capas.splice(i, 1);
  tragar++;
  history.back();
}
addEventListener('popstate', (e) => {
  if (tragar) {
    tragar--;
    e.stopImmediatePropagation();
    if (!tragar) enEspera.splice(0).forEach((f) => f());
    return;
  }
  if (capas.length) {
    e.stopImmediatePropagation();
    capas.pop()();
  }
}, true);

// ---------- hoja inferior ----------
let hojaActual = null;
const hojaDesdeAtras = () => cerrarHoja(false, { desdeAtras: true });
/** `historial: true` → el botón "atrás" del celular cierra la hoja en vez de cambiar de página. */
export function abrirHoja(contenido, { alCerrar, clase = '', historial = false } = {}) {
  const teniaCapa = !!hojaActual?.conCapa;
  cerrarHoja(true, { mantenerCapa: historial });
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
  const esc = (e) => { if (e.key === 'Escape' && !document.querySelector('.visor')) cerrar(); };
  document.addEventListener('keydown', esc);
  if (historial && !teniaCapa) empujarCapa(hojaDesdeAtras);
  hojaActual = { velo, hoja, alCerrar, esc, conCapa: historial };
  setTimeout(() => hoja.querySelector('[autofocus]')?.focus(), 320);
  return hoja;
}
export function cerrarHoja(inmediato = false, { desdeAtras = false, mantenerCapa = false } = {}) {
  if (!hojaActual) return;
  const { velo, hoja, alCerrar, esc, conCapa } = hojaActual;
  hojaActual = null;
  document.removeEventListener('keydown', esc);
  document.body.classList.remove('con-hoja');
  velo.classList.remove('abierto');
  hoja.classList.remove('abierta');
  setTimeout(() => { velo.remove(); hoja.remove(); }, inmediato ? 0 : 300);
  if (conCapa && !desdeAtras && !mantenerCapa) quitarCapa(hojaDesdeAtras);
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
  lupa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5M11 8.5v5M8.5 11h5"/></svg>',
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

// ---------- imágenes livianas ----------
// Las fotos del sitio vienen en varios anchos (/img/nombre-320.webp, -480, -720, -960 …).
// `foto()` arma <img> con srcset/sizes para que cada celular baje solo el tamaño que necesita.
const RE_IMG = /^\/img\/([\w-]+)-(\d+)\.webp$/;
const ANCHOS = [320, 480, 720, 960];
const RE_CLOUD = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/;

/** Lista [url, ancho] de las variantes disponibles, o null si la foto no tiene variantes conocidas. */
export function variantes(url) {
  const s = String(url || '');
  const m = RE_IMG.exec(s);
  if (m) {
    const max = Number(m[2]);
    const l = ANCHOS.filter((a) => a < max).map((a) => [`/img/${m[1]}-${a}.webp`, a]);
    return [...l, [s, max]];
  }
  const c = RE_CLOUD.exec(s);
  if (c && !/(^|,)w_\d/.test(c[2].split('/')[0])) return [480, 720, 1080].map((a) => [`${c[1]}f_auto,q_auto,c_limit,w_${a}/${c[2]}`, a]);
  return null;
}

/** La variante más pequeña que cubre `ancho` píxeles (para fondos y miniaturas). */
export function fotoAncho(url, ancho) {
  const v = variantes(url);
  if (!v) return url;
  return (v.find(([, a]) => a >= ancho) || v[v.length - 1])[0];
}

/** <img> responsivo. `ancho`/`alto` reservan el espacio (sin saltos); `prioridad` para la primera pantalla. */
export function foto(url, { sizes = '100vw', ancho, alto, alt = '', clase = '', prioridad = false, lazy = true, id = '' } = {}) {
  if (!url) return '';
  const v = variantes(url);
  const src = v ? (v.find(([, a]) => a >= 480) || v[v.length - 1])[0] : url;
  const srcset = v && v.length > 1 ? v.map(([u, a]) => `${u} ${a}w`).join(', ') : '';
  return html`<img src="${src}"${srcset ? html` srcset="${srcset}" sizes="${sizes}"` : ''}${ancho ? html` width="${ancho}" height="${alto || ancho}"` : ''} alt="${alt}"${clase ? html` class="${clase}"` : ''}${id ? html` id="${id}"` : ''} ${crudo(prioridad ? 'fetchpriority="high"' : lazy ? 'loading="lazy"' : '')} decoding="async" referrerpolicy="no-referrer">`;
}

/** Videos de Cloudinary con ancho limitado (no bajar el original en el celular). */
export function videoLiviano(url) {
  const m = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/video\/upload\/)(.+)$/.exec(String(url || ''));
  if (!m) return url;
  const [primero, ...resto] = m[2].split('/');
  const esTrans = resto.length && /^[a-z]{1,3}_/.test(primero);
  if (esTrans && /(^|,)w_\d/.test(primero)) return url;
  return esTrans ? `${m[1]}${primero},w_720,c_limit/${resto.join('/')}` : `${m[1]}q_auto,f_auto,w_720,c_limit/${m[2]}`;
}

// ---------- ver fotos en grande ----------
/**
 * Visor a pantalla completa. Desliza entre fotos; pellizca o toca dos veces para acercar; desliza hacia abajo,
 * toca la X, Esc o "atrás" para cerrar (vuelve a donde estaba, por ejemplo a la ficha del servicio).
 * @param {{url: string, titulo?: string, texto?: string}[]} lista
 */
export function verFotos(lista, inicio = 0) {
  const fotos = (lista || []).filter((f) => f && f.url);
  if (!fotos.length || document.querySelector('.visor')) return;
  inicio = Math.min(Math.max(0, inicio), fotos.length - 1);
  const capa = document.createElement('div');
  capa.className = 'visor';
  capa.setAttribute('role', 'dialog');
  capa.setAttribute('aria-modal', 'true');
  capa.setAttribute('aria-label', fotos[inicio]?.titulo || 'Foto');
  const ancho = Math.min(1440, Math.round(innerWidth * (devicePixelRatio || 1)));
  capa.innerHTML = String(html`
    <button type="button" class="visor-cerrar" aria-label="Cerrar">${crudo(ICONOS.cerrar)}</button>
    <div class="visor-pista">${fotos.map((f, i) => html`<figure class="visor-foto">
      <div class="visor-marco"><img src="${fotoAncho(f.url, ancho)}" alt="${f.titulo || ''}" ${crudo(Math.abs(i - inicio) > 1 ? 'loading="lazy"' : '')} decoding="async" referrerpolicy="no-referrer" draggable="false"></div>
      ${f.titulo || f.texto ? html`<figcaption>${f.titulo ? html`<strong>${f.titulo}</strong>` : ''}${f.texto ? html`<span>${f.texto}</span>` : ''}</figcaption>` : ''}
    </figure>`)}</div>
    <p class="visor-cuenta" aria-live="polite">${fotos.length > 1 ? html`<span>${inicio + 1}</span> / ${fotos.length} · ` : ''}Pellizca para acercar</p>`);
  document.body.append(capa);
  document.body.classList.add('con-visor');
  const pista = capa.querySelector('.visor-pista');
  pista.scrollLeft = pista.clientWidth * inicio;
  const cuenta = capa.querySelector('.visor-cuenta span');
  const actual = () => Math.round(pista.scrollLeft / Math.max(1, pista.clientWidth));
  pista.addEventListener('scroll', () => { if (cuenta) cuenta.textContent = String(actual() + 1); }, { passive: true });

  // ---- zoom (pellizcar / doble toque), mover la foto acercada y deslizar hacia abajo para cerrar ----
  let z = 1, tx = 0, ty = 0, img = null;
  const punteros = new Map();
  let inicioGesto = null, ultimoToque = 0, bajando = 0;
  const aplicar = () => {
    if (!img) return;
    img.style.transform = `translate(${tx}px, ${ty}px) scale(${z})`;
    capa.classList.toggle('acercado', z > 1.01);
  };
  const reiniciar = () => { if (img) { img.style.transform = ''; } z = 1; tx = 0; ty = 0; capa.classList.remove('acercado'); };
  const limitar = () => {
    const r = img.getBoundingClientRect();
    const mx = Math.max(0, (r.width - innerWidth) / 2 + 20), my = Math.max(0, (r.height - innerHeight) / 2 + 20);
    tx = Math.min(mx, Math.max(-mx, tx)); ty = Math.min(my, Math.max(-my, ty));
  };
  pista.addEventListener('pointerdown', (e) => {
    const el = e.target.closest('.visor-marco img');
    if (!el) return;
    if (img !== el) { reiniciar(); img = el; }
    punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { el.setPointerCapture(e.pointerId); } catch { /* sin captura */ }
    const p = [...punteros.values()];
    if (p.length === 2) inicioGesto = { d: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y), z, tx, ty };
    else if (p.length === 1) {
      inicioGesto = { x: e.clientX, y: e.clientY, tx, ty, z };
      const ahora = Date.now();
      if (ahora - ultimoToque < 300) {
        // doble toque: acercar donde se tocó, o volver al tamaño normal
        if (z > 1.01) reiniciar();
        else { z = 2.5; const r = el.getBoundingClientRect(); tx = (r.left + r.width / 2 - e.clientX) * 1.5; ty = (r.top + r.height / 2 - e.clientY) * 1.5; limitar(); aplicar(); }
        ultimoToque = 0;
      } else ultimoToque = ahora;
    }
  });
  pista.addEventListener('pointermove', (e) => {
    if (!punteros.has(e.pointerId) || !inicioGesto) return;
    punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const p = [...punteros.values()];
    if (p.length === 2 && inicioGesto.d) {
      z = Math.min(4, Math.max(1, inicioGesto.z * Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) / inicioGesto.d));
      aplicar();
    } else if (p.length === 1 && inicioGesto.x != null) {
      const dx = e.clientX - inicioGesto.x, dy = e.clientY - inicioGesto.y;
      if (z > 1.01) { tx = inicioGesto.tx + dx; ty = inicioGesto.ty + dy; limitar(); aplicar(); }
      else if (dy > 0 && Math.abs(dy) > Math.abs(dx) * 1.2) {
        bajando = dy;
        img.style.transform = `translateY(${dy}px) scale(${Math.max(0.85, 1 - dy / 1500)})`;
        capa.style.setProperty('--velo', String(Math.max(0.35, 0.94 - dy / 500)));
      }
    }
  });
  const soltar = (e) => {
    punteros.delete(e.pointerId);
    if (bajando && !punteros.size) {
      const d = bajando;
      bajando = 0;
      if (d > 110) return cerrar();
      if (img) img.style.transform = '';
      capa.style.removeProperty('--velo');
    }
    if (z <= 1.01 && !punteros.size) reiniciar();
    const p = [...punteros.values()];
    inicioGesto = p.length === 1 ? { x: p[0].x, y: p[0].y, tx, ty, z } : null;
  };
  pista.addEventListener('pointerup', soltar);
  pista.addEventListener('pointercancel', soltar);
  pista.addEventListener('scroll', () => { if (z <= 1.01 && img) { reiniciar(); img = null; } }, { passive: true });

  // ---- cerrar ----
  let cerrado = false;
  const cerrar = (desdeAtras = false) => {
    if (cerrado) return;
    cerrado = true;
    removeEventListener('keydown', tecla, true);
    document.body.classList.remove('con-visor');
    capa.classList.add('saliendo');
    setTimeout(() => capa.remove(), 160);
    if (!desdeAtras) quitarCapa(alVolver);
  };
  const alVolver = () => cerrar(true);
  const tecla = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); cerrar(); }
    if (e.key === 'ArrowRight') pista.scrollBy({ left: pista.clientWidth, behavior: 'smooth' });
    if (e.key === 'ArrowLeft') pista.scrollBy({ left: -pista.clientWidth, behavior: 'smooth' });
  };
  empujarCapa(alVolver);
  addEventListener('keydown', tecla, true);
  capa.querySelector('.visor-cerrar').onclick = () => cerrar();
  capa.addEventListener('click', (e) => { if (z <= 1.01 && (e.target === capa || e.target.classList.contains('visor-foto') || e.target.classList.contains('visor-marco'))) cerrar(); });
  capa.querySelector('.visor-cerrar').focus();
}

/** Foto de una profesional que se amplía al tocarla (con una lupita que lo indica). */
export function avatarAmpliable(c, { tam = 48 } = {}) {
  if (!c?.foto) return html`<span class="avatar inicial">${inicial(c?.nombre)}</span>`;
  return html`<button type="button" class="avatar-ampliar" data-ampliar-url="${c.foto}" data-ampliar-titulo="${c.nombre}" data-ampliar-texto="${c.cargo || ''}" aria-label="Ver la foto de ${c.nombre} en grande">${foto(c.foto, { sizes: `${tam}px`, ancho: tam, clase: 'avatar', lazy: false })}<span class="lupa-mini" aria-hidden="true">${crudo(ICONOS.lupa)}</span></button>`;
}

/**
 * Un solo manejador para todo lo que se amplía: [data-ampliar-url] (una foto) o [data-ampliar-lista]
 * (la página resuelve la lista con `resolver(clave)`; p. ej. "servicio:3").
 */
export function activarAmpliar(resolver = () => null) {
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-ampliar-url], [data-ampliar-lista]');
    if (!b) return;
    e.preventDefault();
    e.stopPropagation();
    if (b.dataset.ampliarLista) {
      const r = resolver(b.dataset.ampliarLista);
      if (r?.length) verFotos(r);
      return;
    }
    verFotos([{ url: b.dataset.ampliarUrl, titulo: b.dataset.ampliarTitulo || '', texto: b.dataset.ampliarTexto || '' }]);
  }, true);
}
