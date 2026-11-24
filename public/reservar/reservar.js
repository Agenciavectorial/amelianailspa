// Reserva de citas para clientas (sin cuenta). Pasos: servicios → profesional → horario → datos → listo.
import {
  api, html, crudo, pintar, $, $$, toast, ocupado, hora, duracion, dinero, fechaLarga, ICONOS, inicial, celularBonito, abrirHoja, cerrarHoja,
  SITIO, aplicarAcento, foto, fotoAncho, videoLiviano, verFotos, trasHistorial, avatarAmpliable, activarAmpliar,
} from '/app-citas/js/util.js?v=9cba0f01ac';
import { crearSelector } from './selector.js?v=9cba0f01ac';
import { estadoPush, activarPush } from '/app-citas/js/push.js?v=9cba0f01ac';

const PUSH = { sw: '/reservar/sw.js', scope: '/reservar/' };

const PASOS = ['servicios', 'profesional', 'horario', 'datos', 'listo'];
const TITULOS = {
  servicios: '¿Qué te quieres hacer?',
  profesional: '¿Quién te atiende?',
  horario: 'Elige día y hora',
  datos: 'Tus datos',
};

const app = $('#app');
// Altura real del encabezado fijo (las categorías se pegan justo debajo, sin superponerse)
const cabecera = $('#cabeceraFija');
if (cabecera && 'ResizeObserver' in window) {
  new ResizeObserver(() => document.documentElement.style.setProperty('--alto-cabecera', cabecera.offsetHeight + 'px')).observe(cabecera);
}
const bandeja = $('#bandeja');
const E = { cat: null, sel: [], con: null, fecha: null, turno: null, paso: 'servicios', reserva: null };
let C; // catálogo

const porId = (id) => C.servicios.find((s) => s.id === id);
const colabPorSlug = (slug) => C.colaboradoras.find((c) => c.slug === slug);
const elegidos = () => E.sel.map(porId).filter(Boolean);
const durTotal = () => elegidos().reduce((a, s) => a + s.duracion, 0);
function precioTotal() {
  const l = elegidos();
  if (!l.length || l.some((s) => s.precio == null)) return null;
  return l.reduce((a, s) => a + s.precio, 0);
}
const hacenTodo = (c) => E.sel.every((id) => c.servicios.includes(id));

// ---------- navegación ----------
function irA(paso, { empujar = true } = {}) {
  E.paso = paso;
  if (empujar) trasHistorial(() => history.pushState({ paso }, '', location.search));
  pintarPaso();
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}
window.addEventListener('popstate', (e) => {
  const paso = e.state?.paso || 'servicios';
  if (E.paso === 'listo') { history.replaceState({ paso: 'listo' }, '', location.search); return; }
  E.paso = paso;
  pintarPaso();
});
$('#btnAtras').innerHTML = ICONOS.atras;
$('#btnAtras').onclick = () => history.back();

function pintarProgreso() {
  const i = PASOS.indexOf(E.paso);
  const visible = E.paso !== 'listo';
  $('#progreso').hidden = !visible;
  $('#btnAtras').hidden = i === 0 || !visible;
  if (!visible) return;
  $('#progresoRelleno').style.width = `${((i + 1) / 4) * 100}%`;
  $('#progresoTexto').textContent = `Paso ${i + 1} de 4 · ${TITULOS[E.paso]}`;
}

function pintarBandeja() {
  const n = E.sel.length;
  let mostrar = false, texto = '', boton = 'Continuar', listo = false;
  if (E.paso === 'servicios') {
    mostrar = n > 0;
    const p = precioTotal();
    texto = html`<strong>${n} servicio${n > 1 ? 's' : ''}</strong><span>${duracion(durTotal())}${p != null ? ' · ' + dinero(p) : ''}</span>`;
    listo = n > 0;
  } else if (E.paso === 'horario') {
    mostrar = true;
    texto = E.turno
      ? html`<strong>${fechaLarga(E.fecha)}</strong><span>${hora(E.turno.inicio)} – ${hora(E.turno.fin)}</span>`
      : html`<strong>Elige un horario</strong><span>${duracion(durTotal())}</span>`;
    listo = !!E.turno;
  }
  bandeja.hidden = !mostrar;
  document.body.classList.toggle('con-bandeja', mostrar);
  pintar($('#bandejaInfo'), texto);
  $('#btnSeguir').textContent = boton;
  $('#btnSeguir').disabled = !listo;
}
$('#btnSeguir').onclick = () => {
  if (E.paso === 'servicios') irA(siguienteDespuesDeServicios());
  else if (E.paso === 'horario' && E.turno) irA('datos');
};

function siguienteDespuesDeServicios() {
  if (E.con && E.con !== 'cualquiera') {
    const c = colabPorSlug(E.con);
    if (c && hacenTodo(c)) return 'horario';
    E.con = null;
  }
  return 'profesional';
}

function pintarPaso() {
  pintarProgreso();
  ({ servicios: pasoServicios, profesional: pasoProfesional, horario: pasoHorario, datos: pasoDatos, listo: pasoListo })[E.paso]();
  pintarBandeja();
}

// ---------- paso 1: servicios ----------
function pasoServicios() {
  const cats = [...new Set(C.servicios.map((s) => s.categoria))];
  if (!E.cat || !cats.includes(E.cat)) E.cat = cats[0];
  const proxima = proximaGuardada();
  const conColab = E.con && E.con !== 'cualquiera' ? colabPorSlug(E.con) : null;
  pintar(app, html`
    <section class="paso paso-servicios">
      ${portada()}
      ${proxima ? html`<a class="proxima" href="/reservar/cita/#${proxima.token}">
          ${crudo(ICONOS.calendario)}<span><strong>Tu próxima cita</strong>${fechaLarga(proxima.fecha)} · ${hora(proxima.inicio)}</span><span class="flecha">Ver</span></a>` : ''}
      <div id="misCitas"></div>
      <div id="avisosInicio"></div>
      ${!conColab && C.promociones?.length ? html`<h2 class="titulo-bloque">Promociones</h2><div class="promos">${C.promociones.map((p) => html`
        <div class="promo-caja">${p.foto ? html`<button type="button" class="mini-zoom" data-ampliar-url="${p.foto}" data-ampliar-titulo="${p.titulo}" data-ampliar-texto="${p.descripcion || ''}" aria-label="Ver la foto de ${p.titulo} en grande">${crudo(ICONOS.lupa)}</button>` : ''}
        <button class="promo" data-promo="${p.id}">
          ${foto(p.foto, { sizes: '(min-width: 760px) 320px, 80vw' })}
          <span class="promo-texto"><strong>${p.titulo}</strong>${p.descripcion ? html`<span>${p.descripcion}</span>` : ''}
            <span class="promo-pie">${p.precio_promo != null ? html`<b>${dinero(p.precio_promo)}</b>` : ''}${p.hasta ? html`<small>hasta ${fechaLarga(p.hasta).replace(/^\S+ /, '')}</small>` : ''}</span></span>
        </button></div>`)}</div>` : ''}
      ${!conColab && populares().length ? html`<h2 class="titulo-bloque">Lo más pedido</h2><div class="populares">${populares().map((s) => html`
        <div class="popular-caja"><button class="popular" data-pop="${s.id}">${foto(s.foto, { sizes: '116px', ancho: 116 })}<span>${s.nombre}</span></button>${fotosDe(s).length ? html`<button type="button" class="mini-zoom" data-ampliar-lista="servicio:${s.id}" aria-label="Ver fotos de ${s.nombre}">${crudo(ICONOS.lupa)}</button>` : ''}</div>`)}</div>
        <h2 class="titulo-bloque">Todos los servicios</h2>` : ''}
      ${conColab ? html`<div class="con-colab">${avatarAmpliable(conColab, { tam: 52 })}<span>Reservando con <strong>${conColab.nombre}</strong></span><button class="btn ghost chico" id="quitarCon">Cambiar</button></div>` : ''}
      <div class="categorias" role="tablist">
        ${cats.map((c) => html`<button class="chip" role="tab" data-cat="${c}" aria-pressed="${c === E.cat}">${c}</button>`)}
      </div>
      <div class="lista-servicios">
        ${C.servicios.filter((s) => s.categoria === E.cat).map(tarjetaServicio)}
      </div>
    </section>`);
  for (const b of $$('.categorias .chip', app)) b.onclick = () => { E.cat = b.dataset.cat; pasoServicios(); };
  for (const b of $$('[data-promo]', app)) {
    b.onclick = () => {
      const p = C.promociones.find((x) => x.id === Number(b.dataset.promo));
      const s = p.servicio_id && porId(p.servicio_id);
      if (s) { E.sel = [s.id]; E.cat = s.categoria; irA(siguienteDespuesDeServicios()); } else toast('Escríbenos por WhatsApp para esta promoción 💜');
    };
  }
  for (const b of $$('[data-pop]', app)) {
    b.onclick = () => { const s = porId(Number(b.dataset.pop)); if (!E.sel.includes(s.id)) E.sel.push(s.id); E.cat = s.categoria; irA(siguienteDespuesDeServicios()); };
  }
  pintarMisCitas();
  if (tokensGuardados().length) ofrecerAvisos($('#avisosInicio'));
  aplicarPortada();
  $('.lista-servicios', app).onclick = (e) => {
    const t = e.target.closest('[data-alternar]');
    if (t) return alternar(Number(t.dataset.alternar));
    const a = e.target.closest('[data-abrir]');
    if (a) abrirFicha(Number(a.dataset.abrir));
  };
  $('#quitarCon', app)?.addEventListener('click', () => { E.con = null; pasoServicios(); });
  // Centra la categoría activa moviendo solo la fila de chips (sin desplazar la página)
  const chipActivo = $('.categorias .chip[aria-pressed="true"]', app);
  if (chipActivo) chipActivo.parentElement.scrollLeft = chipActivo.offsetLeft - 16;
}

function populares() {
  const ids = C.populares?.length ? C.populares : [];
  return ids.map(porId).filter(Boolean).slice(0, 4);
}

function tokensGuardados() {
  try { return JSON.parse(localStorage.getItem('amelia_citas') || '[]').map((x) => x.token).filter(Boolean); } catch { return []; }
}

let misCitas = null;
async function pintarMisCitas() {
  const caja = $('#misCitas');
  const tokens = tokensGuardados();
  if (!caja || !tokens.length) return;
  if (!misCitas) {
    try { misCitas = (await api(`/api/public/mis-citas?tokens=${tokens.join(',')}`)).citas; } catch { return; }
  }
  if (!document.body.contains(caja)) return;
  const ultima = misCitas.find((c) => c.estado !== 'cancelada' && c.fecha <= C.hoy) || misCitas.find((c) => c.estado !== 'cancelada');
  const historial = misCitas.filter((c) => c.fecha < C.hoy || c.estado !== 'confirmada').slice(0, 5);
  if (!ultima && !historial.length) return;
  pintar(caja, html`
    ${ultima ? html`<button class="repetir" id="repetir">
      <span class="repetir-icono">${crudo(ICONOS.chispa)}</span>
      <span class="repetir-texto"><strong>Repetir mi último servicio</strong><span>${ultima.servicios.map((s) => s.nombre).join(' + ')} con ${ultima.colaboradora.nombre}</span></span>
      <span class="flecha">→</span></button>` : ''}
    ${historial.length ? html`<details class="historial-clienta"><summary>Mi historial (${historial.length})</summary>
      <ul>${historial.map((c) => html`<li><a href="/reservar/cita/#${c.token}"><span>${c.fecha_texto}</span><span>${c.servicios.map((s) => s.nombre).join(' + ')}</span></a></li>`)}</ul></details>` : ''}`);
  $('#repetir')?.addEventListener('click', () => {
    const ids = ultima.servicios.map((s) => s.id).filter((id) => porId(id));
    if (!ids.length) return toast('Ese servicio ya no está disponible. Elige otro 💜');
    E.sel = ids;
    E.cat = porId(ids[0]).categoria;
    E.con = colabPorSlug(ultima.colaboradora.slug) ? ultima.colaboradora.slug : null;
    irA(siguienteDespuesDeServicios());
  });
}

/** Fotos (no videos) de un servicio, para el visor. */
function fotosDe(s) {
  const l = (s.medios || []).filter((m) => m.tipo !== 'video').map((m) => m.url);
  return l.length ? l : (s.foto && !/\/arte\//.test(s.foto) ? [s.foto] : []);
}
activarAmpliar((clave) => {
  const [tipo, id] = clave.split(':');
  if (tipo !== 'servicio') return null;
  const s = porId(Number(id));
  const l = s ? fotosDe(s) : [];
  return l.map((url, k) => ({ url, titulo: s.nombre, texto: l.length > 1 ? `Foto ${k + 1} de ${l.length}` : '' }));
});

function tarjetaServicio(s) {
  const marcado = E.sel.includes(s.id);
  const conColab = E.con && E.con !== 'cualquiera' ? colabPorSlug(E.con) : null;
  const noHace = conColab && !conColab.servicios.includes(s.id);
  return html`
    <div class="servicio ${marcado ? 'marcado' : ''} ${noHace ? 'no-disponible' : ''}" data-id="${s.id}">
      <button type="button" class="servicio-abrir" data-abrir="${s.id}" ${noHace ? crudo('disabled') : ''} aria-label="Ver ${s.nombre}">
      <span class="servicio-foto">${foto(s.foto, { sizes: '112px', ancho: 112 })}</span>
      <span class="servicio-cuerpo">
        <span class="servicio-nombre">${s.nombre}</span>
        <span class="servicio-desc">${noHace ? `${conColab.nombre} no hace este servicio` : s.descripcion}</span>
        <span class="servicio-meta">
          <span>${crudo(ICONOS.reloj)}${duracion(s.duracion)}</span>
          <span class="precio">${s.precio != null ? (s.precio_desde ? 'Desde ' : '') + dinero(s.precio) : 'Precio en el spa'}</span>
        </span>
      </span>
      </button>
      ${fotosDe(s).length ? html`<button type="button" class="servicio-zoom" data-ampliar-lista="servicio:${s.id}" aria-label="Ver fotos de ${s.nombre} en grande"><span class="servicio-num">${crudo(ICONOS.lupa)}${fotosDe(s).length > 1 ? ` ${fotosDe(s).length} fotos` : ' Ver'}${s.medios?.some((m) => m.tipo === 'video') ? ' · ▶' : ''}</span></button>` : ''}
      <button type="button" class="servicio-marca" data-alternar="${s.id}" aria-pressed="${marcado}" aria-label="${marcado ? 'Quitar' : 'Agregar'} ${s.nombre}" ${noHace ? crudo('disabled') : ''}>${crudo(marcado ? ICONOS.check : ICONOS.mas)}</button>
    </div>`;
}

function alternar(id) {
  const i = E.sel.indexOf(id);
  if (i >= 0) E.sel.splice(i, 1);
  else {
    if (E.sel.length >= 4) { toast('Puedes elegir hasta 4 servicios por cita.'); return; }
    E.sel.push(id);
  }
  E.turno = null;
  const b = app.querySelector(`.servicio[data-id="${id}"]`);
  if (b) b.outerHTML = String(tarjetaServicio(porId(id)));
  pintarBandeja();
}

// ---------- portada y ficha de servicio ----------
function portada() {
  const titulo = (C.ajustes.bienvenida_titulo || 'Reserva tu momento').trim();
  const partes = titulo.split(' ');
  const ultima = partes.pop();
  return html`<div class="hero-reserva ${C.ajustes.portada_url ? 'con-foto' : ''}" id="heroReserva">
    <span class="script">Bienvenida</span>
    <h1>${partes.join(' ')} <em>${ultima}</em></h1>
    <p>${C.ajustes.bienvenida_texto || 'Elige tu servicio y la hora que te quede mejor. Sin crear cuenta.'}</p>
  </div>`;
}
function aplicarPortada() {
  const h = $('#heroReserva');
  const url = C.ajustes.portada_url;
  if (h && url && /^(https:\/\/|\/)[^"'()\s]+$/.test(url)) h.style.setProperty('--portada', `url("${fotoAncho(url, Math.min(1080, innerWidth * (devicePixelRatio || 1)))}")`);
}

function abrirFicha(id) {
  const s = porId(id);
  if (!s) return;
  const medios = s.medios?.length ? s.medios : (s.foto ? [{ tipo: 'foto', url: s.foto }] : []);
  const marcado = E.sel.includes(s.id);
  const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const h = abrirHoja(html`
    ${medios.length ? html`<div class="ficha-carrusel" id="fichaCarrusel">
      ${medios.map((m, i) => m.tipo === 'video'
        ? html`<div class="ficha-medio"><video muted loop playsinline preload="none" ${crudo(reducido ? 'controls' : '')} poster="${fotoAncho(m.portada || '', 720)}" aria-label="Video de ${s.nombre}"><source src="${videoLiviano(m.url)}" type="video/mp4"></video></div>`
        : html`<div class="ficha-medio" data-ver="${m.url}" title="Toca para ver en grande">${foto(m.url, { sizes: '(min-width: 760px) 600px, 100vw', ancho: 720, alto: 900, alt: `${s.nombre} ${i + 1}`, prioridad: !i })}</div>`)}
    </div>
    ${medios.length > 1 ? html`<div class="ficha-puntos" aria-hidden="true">${medios.map((_, i) => html`<span class="${i ? '' : 'activo'}"></span>`)}</div>` : ''}` : ''}
    <div class="ficha-cuerpo">
      <div class="cabeza-hoja"><div><p class="muted small">${s.categoria}</p><h2>${s.nombre}</h2></div><button class="icono-btn" data-cerrar aria-label="Cerrar">${crudo(ICONOS.cerrar)}</button></div>
      <div class="ficha-meta"><span>${crudo(ICONOS.reloj)} ${duracion(s.duracion)}</span><span class="precio">${s.precio != null ? (s.precio_desde ? 'Desde ' : '') + dinero(s.precio) : 'Precio en el spa'}</span></div>
      ${s.descripcion ? html`<p class="ficha-desc">${s.descripcion}</p>` : ''}
    </div>
    <div class="ficha-acciones">
      <button class="btn bloque grande" id="fichaAgendar">Agendar este servicio</button>
      <button class="btn ghost bloque" id="fichaAlternar">${marcado ? 'Quitar de mi cita' : 'Agregar y seguir viendo'}</button>
    </div>`, { clase: 'ficha', historial: true });
  const car = $('#fichaCarrusel', h);
  if (car) {
    const items = $$('.ficha-medio', car);
    const puntos = $$('.ficha-puntos span', h);
    const obs = new IntersectionObserver((entradas) => {
      for (const en of entradas) {
        const i = items.indexOf(en.target);
        if (en.isIntersecting && en.intersectionRatio > 0.6) {
          puntos.forEach((p, k) => p.classList.toggle('activo', k === i));
          const v = en.target.querySelector('video');
          if (v && !reducido) v.play().catch(() => {});
        } else {
          en.target.querySelector('video')?.pause();
        }
      }
    }, { root: car, threshold: [0, 0.6, 1] });
    items.forEach((it) => obs.observe(it));
    // Tocar una foto la abre en grande (se desliza entre todas las fotos del servicio)
    car.addEventListener('click', (e) => {
      const m = e.target.closest('[data-ver]');
      if (!m) return;
      const fotos = medios.filter((x) => x.tipo !== 'video');
      verFotos(fotos.map((x, k) => ({ url: x.url, titulo: s.nombre, texto: fotos.length > 1 ? `Foto ${k + 1} de ${fotos.length}` : '' })),
        Math.max(0, fotos.findIndex((x) => x.url === m.dataset.ver)));
    });
  }
  $('#fichaAgendar', h).onclick = () => {
    if (!E.sel.includes(s.id)) {
      if (E.sel.length >= 4) return toast('Puedes elegir hasta 4 servicios por cita.');
      E.sel.push(s.id);
    }
    E.turno = null;
    cerrarHoja(true);
    irA(siguienteDespuesDeServicios());
  };
  $('#fichaAlternar', h).onclick = () => { cerrarHoja(); alternar(s.id); };
}

// ---------- paso 2: profesional ----------
function pasoProfesional() {
  const aptas = C.colaboradoras.filter(hacenTodo);
  pintar(app, html`
    <section class="paso">
      ${resumenServicios()}
      <h2 class="titulo-paso">¿Con quién te gustaría?</h2>
      ${aptas.length ? html`
      <div class="lista-pros">
        <button class="pro cualquiera" data-slug="cualquiera">
          <span class="avatar destello">${crudo(ICONOS.chispa)}</span>
          <span class="pro-texto"><strong>Cualquiera disponible</strong><span>Te mostramos más horarios y asignamos a quien esté libre.</span></span>
          <span class="flecha-pro">${crudo(ICONOS.atras)}</span>
        </button>
        ${aptas.map((c) => html`
        <div class="pro-caja">
          <button class="pro" data-slug="${c.slug}">
            ${c.foto ? foto(c.foto, { sizes: '92px', ancho: 92, clase: 'avatar', lazy: false }) : html`<span class="avatar inicial">${inicial(c.nombre)}</span>`}
            <span class="pro-texto"><strong>${c.nombre}</strong><span>${c.cargo || 'Manicurista'}</span>${c.foto ? html`<small class="pro-ver">${crudo(ICONOS.lupa)} Toca su foto para verla</small>` : ''}</span>
            <span class="flecha-pro">${crudo(ICONOS.atras)}</span>
          </button>
          ${c.foto ? html`<button type="button" class="pro-foto" data-foto-de="${c.slug}" aria-label="Ver la foto de ${c.nombre} en grande"></button>` : ''}
        </div>`)}
      </div>` : html`<p class="aviso">Ninguna de nuestras chicas hace todos esos servicios en una misma cita. Quita alguno o escríbenos por WhatsApp.</p>`}
    </section>`);
  for (const b of $$('.pro', app)) b.onclick = () => { E.con = b.dataset.slug; E.turno = null; irA('horario'); };
  for (const b of $$('.pro-foto', app)) b.onclick = () => {
    const c = aptas.find((x) => x.slug === b.dataset.fotoDe);
    if (c) verFotos([{ url: c.foto, titulo: c.nombre, texto: c.cargo || 'Manicurista' }]);
  };
}

function resumenServicios() {
  return html`<div class="resumen-mini">
    <div class="resumen-mini-lista">${elegidos().map((s) => html`<span class="pastilla">${s.nombre}</span>`)}</div>
    <span class="muted small">${duracion(durTotal())}${precioTotal() != null ? ' · ' + dinero(precioTotal()) : ''}</span>
  </div>`;
}

// ---------- paso 3: horario ----------
function pasoHorario() {
  const c = E.con !== 'cualquiera' ? colabPorSlug(E.con) : null;
  pintar(app, html`
    <section class="paso">
      ${resumenServicios()}
      <div class="con-quien">
        ${c ? html`${avatarAmpliable(c, { tam: 52 })}<span>Con <strong>${c.nombre}</strong></span>` : html`<span class="avatar destello">${crudo(ICONOS.chispa)}</span><span>Con <strong>quien esté disponible</strong></span>`}
        <button class="btn ghost chico" id="cambiarPro">Cambiar</button>
      </div>
      <div id="selector"></div>
    </section>`);
  $('#cambiarPro').onclick = () => irA('profesional');
  const params = () => `servicios=${E.sel.join(',')}&con=${encodeURIComponent(E.con || 'cualquiera')}`;
  crearSelector({
    raiz: $('#selector'), hoy: C.hoy, ventana: Math.min(C.ajustes.ventana_dias, 90),
    fecha: E.fecha, inicio: E.turno?.inicio,
    cargarDias: async (desde, n) => (await api(`/api/public/dias?${params()}&desde=${desde}&n=${n}`)).dias,
    cargarTurnos: async (f) => (await api(`/api/public/disponibilidad?${params()}&fecha=${f}`)).turnos,
    alElegir: (f, t) => { if (f) E.fecha = f; E.turno = t; pintarBandeja(); },
  });
}

// ---------- paso 4: datos ----------
function pasoDatos() {
  const c = E.con !== 'cualquiera' ? colabPorSlug(E.con) : null;
  const guardado = leerDatosGuardados();
  pintar(app, html`
    <section class="paso">
      <div class="tarjeta resumen-cita">
        <div class="resumen-fecha">
          <span class="resumen-dia">${fechaLarga(E.fecha)}</span>
          <span class="resumen-hora">${hora(E.turno.inicio)} – ${hora(E.turno.fin)}</span>
        </div>
        <ul class="resumen-lista">
          ${elegidos().map((s) => html`<li><span>${s.nombre}</span><span>${s.precio != null ? dinero(s.precio) : '—'}</span></li>`)}
        </ul>
        <div class="resumen-pie">
          <span>${c ? html`Con <strong>${c.nombre}</strong>` : 'Te asignamos a quien esté libre'}</span>
          <strong>${precioTotal() != null ? dinero(precioTotal()) : 'Precio en el spa'}</strong>
        </div>
      </div>
      <form id="formDatos" class="form-datos" novalidate>
        <label class="campo"><span>Nombre y apellido</span>
          <input name="nombre" autocomplete="name" required minlength="2" maxlength="80" value="${guardado.nombre || ''}" placeholder="Ej. Laura Gómez"></label>
        <label class="campo"><span>Celular (WhatsApp)</span>
          <span class="tel"><span class="tel-prefijo">+57</span><input name="celular" type="tel" inputmode="tel" autocomplete="tel-national" required value="${guardado.celular || ''}" placeholder="300 123 4567"></span>
          <span class="ayuda">Te escribiremos solo para tu cita.</span></label>
        <label class="campo"><span>¿Algo que debamos saber? <em class="muted">(opcional)</em></span>
          <textarea name="notas" maxlength="400" placeholder="Ej. diseño que quieres, alergias…"></textarea></label>
        <label class="sr" aria-hidden="true">No llenar <input name="sitio_web" tabindex="-1" autocomplete="off"></label>
        <label class="check"><input type="checkbox" name="politica" required><span>${C.ajustes.politica_texto} Autorizo a Amelia Nail Spa a usar mi nombre y celular solo para gestionar mis citas (Ley 1581 de 2012).</span></label>
        <p class="aviso error" id="errorDatos" hidden></p>
        <div class="accion-fija"><button class="btn bloque grande" type="submit" id="btnReservar">Confirmar reserva</button></div>
      </form>
    </section>`);
  $('#formDatos').onsubmit = reservar;
}

function leerDatosGuardados() {
  try { return JSON.parse(localStorage.getItem('amelia_datos') || '{}'); } catch { return {}; }
}

async function reservar(e) {
  e.preventDefault();
  const f = e.target;
  const err = $('#errorDatos');
  err.hidden = true;
  const datos = Object.fromEntries(new FormData(f));
  const fallo = (m) => { err.textContent = m; err.hidden = false; };
  if ((datos.nombre || '').trim().length < 2) return fallo('Escribe tu nombre.');
  if ((datos.celular || '').replace(/\D/g, '').length < 10) return fallo('Escribe tu número de celular completo.');
  if (!f.politica.checked) return fallo('Acepta la política y la autorización de datos para continuar.');
  await ocupado($('#btnReservar'), async () => {
    try {
      const r = await api('/api/public/reservar', {
        metodo: 'POST',
        datos: { servicios: E.sel, con: E.con, fecha: E.fecha, inicio: E.turno.inicio, nombre: datos.nombre, celular: datos.celular, notas: datos.notas, sitio_web: datos.sitio_web },
      });
      E.reserva = r;
      try {
        localStorage.setItem('amelia_datos', JSON.stringify({ nombre: datos.nombre.trim(), celular: datos.celular.trim() }));
        const lista = JSON.parse(localStorage.getItem('amelia_citas') || '[]');
        lista.push({ token: r.token, fecha: r.fecha, inicio: r.inicio });
        localStorage.setItem('amelia_citas', JSON.stringify(lista.slice(-12)));
      } catch { /* almacenamiento no disponible */ }
      history.replaceState({ paso: 'listo' }, '', location.pathname);
      irA('listo', { empujar: false });
    } catch (x) {
      if (x.status === 409 && x.datos?.codigo === 'ocupado') {
        toast(x.message, 'error');
        E.turno = null;
        irA('horario', { empujar: false });
      } else fallo(x.message);
    }
  });
}

function proximaGuardada() {
  try {
    const l = JSON.parse(localStorage.getItem('amelia_citas') || '[]').filter((x) => x.fecha >= C.hoy);
    l.sort((a, b) => (a.fecha + a.inicio).localeCompare(b.fecha + b.inicio));
    return l[0];
  } catch { return null; }
}

// ---------- paso 5: listo ----------
function pasoListo() {
  const r = E.reserva;
  const enlace = `${SITIO}/reservar/cita/#${r.token}`;
  const servicios = r.servicios.map((s) => s.nombre).join(' + ');
  const msg = `¡Hola! Acabo de reservar en Amelia Nail Spa 💅\n\n` +
    `• Código: ${r.codigo}\n• Servicio: ${servicios}\n• Fecha: ${r.fecha_texto}\n• Hora: ${r.hora_texto}\n• Con: ${r.colaboradora.nombre}\n• A nombre de: ${r.clienta}`;
  const wa = `https://wa.me/${C.ajustes.whatsapp}?text=${encodeURIComponent(msg)}`;
  const gcal = googleCalendar(r);
  pintar(app, html`
    <section class="paso listo">
      <div class="listo-sello">${crudo(ICONOS.check)}</div>
      <span class="script">¡Te esperamos!</span>
      <h1>Tu cita está <em>confirmada</em></h1>
      <p class="muted">Guarda tu código. Lo puedes mostrar al llegar.</p>
      <div class="codigo" aria-label="Código de reserva">${r.codigo}</div>
      <div class="tarjeta ticket">
        <div class="ticket-fila"><span>${crudo(ICONOS.calendario)}</span><div><strong>${r.fecha_texto}</strong><span>${r.hora_texto} · ${duracion(r.fin - r.inicio)}</span></div></div>
        <div class="ticket-fila">${avatarAmpliable(r.colaboradora, { tam: 52 })}<div><strong>Con ${r.colaboradora.nombre}</strong><span>${servicios}</span></div></div>
        <div class="ticket-fila"><span>${crudo(ICONOS.ubicacion)}</span><div><strong>C.C. Bosque Plaza</strong><span>${C.ajustes.direccion}</span></div></div>
        ${r.precio_total != null ? html`<div class="ticket-total"><span>Total estimado</span><strong>${dinero(r.precio_total)}</strong></div>` : ''}
      </div>
      <div class="acciones-listo">
        <a class="btn wa bloque" href="${wa}" target="_blank" rel="noopener">${crudo(ICONOS.whatsapp)} Enviar confirmación por WhatsApp</a>
        <div class="dos">
          <a class="btn sec" href="/api/public/cita.ics?token=${r.token}">${crudo(ICONOS.calendario)} iPhone / Outlook</a>
          <a class="btn sec" href="${gcal}" target="_blank" rel="noopener">${crudo(ICONOS.calendario)} Google Calendar</a>
        </div>
        <button class="btn ghost bloque" id="copiarEnlace">${crudo(ICONOS.copiar)} Copiar enlace para cancelar o cambiar</button>
      </div>
      <div id="avisoPush"></div>
      <p class="muted small politica">${C.ajustes.politica_texto}</p>
      <a class="btn ghost" href="/">Volver a la página</a>
    </section>`);
  ofrecerAvisos($('#avisoPush'));
  $('#copiarEnlace').onclick = async () => {
    try { await navigator.clipboard.writeText(enlace); toast('Enlace copiado. Guárdalo en tus notas.', 'ok'); } catch { prompt('Copia tu enlace:', enlace); }
  };
}

/** Botón "Avísame antes de mi cita" (notificación push). */
export async function ofrecerAvisos(caja) {
  if (!caja) return;
  const estado = await estadoPush(PUSH).catch(() => 'no-soportado');
  if (estado === 'activo') { pintar(caja, html`<p class="avisos-ok">🔔 Te avisaremos un día antes y 2 horas antes de tu cita.</p>`); return; }
  if (estado === 'ios-instalar') {
    pintar(caja, html`<div class="tarjeta avisos"><strong>🔔 ¿Quieres recordatorios?</strong><span>En iPhone, instala la app de Amelia (Compartir → Agregar a inicio) y actívalos desde ahí.</span></div>`);
    return;
  }
  if (estado !== 'inactivo') return;
  pintar(caja, html`<button class="tarjeta avisos" id="activarAvisos"><strong>🔔 Avísame antes de mi cita</strong><span>Te confirmamos al instante y te recordamos la víspera y 1 hora antes. Sin mensajes de más.</span></button>`);
  $('#activarAvisos').onclick = async () => {
    let tokens = [];
    try { tokens = JSON.parse(localStorage.getItem('amelia_citas') || '[]').map((x) => x.token); } catch { /* sin almacenamiento */ }
    if (E.reserva?.token && !tokens.includes(E.reserva.token)) tokens.push(E.reserva.token);
    try {
      await activarPush({ ...PUSH, ruta: '/api/public/push/suscribir', extra: { tokens } });
      toast('¡Listo! Te avisaremos antes de tu cita 💜', 'ok');
      ofrecerAvisos(caja);
    } catch (x) { toast(x.message, 'error'); }
  };
}

function googleCalendar(r) {
  const z = (f, m) => {
    const d = new Date(Date.parse(f + 'T00:00:00Z') + (m + 300) * 60000);
    return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  };
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Cita en Amelia Nail Spa (${r.codigo})`,
    dates: `${z(r.fecha, r.inicio)}/${z(r.fecha, r.fin)}`,
    details: `${r.servicios.map((s) => s.nombre).join(' + ')} con ${r.colaboradora.nombre}. Gestiona tu cita: ${SITIO}/reservar/cita/#${r.token}`,
    location: C.ajustes.direccion,
  });
  return `https://calendar.google.com/calendar/render?${p}`;
}

// ---------- inicio ----------
async function iniciar() {
  try {
    C = await api('/api/public/catalogo');
    aplicarAcento(C.ajustes.color_acento);
  } catch (e) {
    pintar(app, html`<div class="vacio"><p>${e.message}</p><p>También puedes reservar por WhatsApp: <a href="https://wa.me/573107027012">${celularBonito('573107027012')}</a></p><button class="btn" id="reintentar">Reintentar</button></div>`);
    $('#reintentar').onclick = () => location.reload();
    return;
  }
  const q = new URLSearchParams(location.search);
  const slugServicio = q.get('servicio');
  const slugCon = q.get('con');
  if (slugCon && colabPorSlug(slugCon)) E.con = slugCon;
  if (slugServicio) {
    const ss = slugServicio.split(',').map((sl) => C.servicios.find((x) => x.slug === sl.trim())).filter(Boolean);
    if (ss.length) { E.sel = ss.slice(0, 4).map((s) => s.id); E.cat = ss[0].categoria; }
  }
  history.replaceState({ paso: 'servicios' }, '', location.search);
  if (E.sel.length) {
    E.paso = 'servicios';
    irA(siguienteDespuesDeServicios());
  } else {
    pintarPaso();
  }
}
iniciar();

// Instalar la app (Android: aviso del navegador; iPhone: pasos)
$('#btnInstalar').onclick = async () => {
  const r = window.ameliaInstalar ? await window.ameliaInstalar() : 'manual';
  if (r === 'instalada') toast('¡Listo! Ya tienes la app de Amelia 💜', 'ok');
  else if (r === 'ios' || r === 'manual') {
    abrirHoja(html`<div class="cabeza-hoja"><div><span class="script">Amelia</span><h2>en tu celular</h2></div><button class="icono-btn" data-cerrar aria-label="Cerrar">${crudo(ICONOS.cerrar)}</button></div>
      <ol class="pasos-ios">
        <li>Toca el botón <strong>Compartir</strong> <span class="muted">(el cuadrito con flecha ↑ abajo en Safari)</span>.</li>
        <li>Elige <strong>"Agregar a inicio"</strong>.</li>
        <li>Toca <strong>Agregar</strong>. ¡Listo! Tendrás a Amelia en tu pantalla, con tus citas y promociones.</li>
      </ol>
      <p class="muted small">En Android: menú ⋮ del navegador → <strong>Instalar app</strong>.</p>`);
  }
};
