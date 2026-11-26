// Arranque del panel: sesión, navegación (dock en celular, barra lateral en computador) y rutas por hash.
import { api, html, crudo, pintar, $, $$, toast, inicial, ICONOS, cerrarHoja, botonTema, aplicarTema, temaGuardado } from '/app-citas/js/util.js?v=7462d0b2a7';

// Tema elegido en este dispositivo (botón junto al logo)
aplicarTema(temaGuardado());
import { S, recargar, esDuena, puede, moduloActivo } from './estado.js?v=7462d0b2a7';
import { pantallaIngreso } from './login.js?v=7462d0b2a7';

const raiz = $('#raiz');

const IC = {
  inicio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1h-5v-6h-6v6H4a1 1 0 01-1-1z"/></svg>',
  agenda: ICONOS.calendario,
  clientas: ICONOS.usuaria,
  servicios: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 21V9c0-3 1.5-6 3-6s3 3 3 6v12"/><path d="M6 21h12"/></svg>',
  equipo: ICONOS.equipo,
  spa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  ajustes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/></svg>',
  importar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5M4 21h16"/></svg>',
  cuenta: ICONOS.usuaria,
  mas: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
  fidelizacion: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 10-7.8 7.8L12 21.2l8.8-8.8a5.5 5.5 0 000-7.8z"/></svg>',
  horarios: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="17" rx="3"/><path d="M8 2.5v4M16 2.5v4M3 10h18M8 14h2M14 14h2M8 18h2"/></svg>',
  cuentas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="6" width="19" height="13" rx="2.5"/><path d="M2.5 10h19M7 15h3"/></svg>',
  seguridad: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg>',
  analitica: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  notas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/></svg>',
  promociones: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.6 13.4l-7.2 7.2a2 2 0 01-2.8 0L3 13V3h10l7.6 7.6a2 2 0 010 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>',
  mensajes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8.5 8.5 0 01-12.6 7.4L3 21l1.6-5.4A8.5 8.5 0 1121 12z"/></svg>',
};

function secciones() {
  const l = [
    { id: 'inicio', nombre: 'Inicio', dock: true },
    { id: 'agenda', nombre: 'Agenda', dock: true },
  ];
  if (moduloActivo('cuentas')) l.push({ id: 'cuentas', nombre: 'Cuentas', dock: true });
  if (puede('ver_clientas')) {
    l.push({ id: 'clientas', nombre: 'Clientas', dock: true });
    if (moduloActivo('fidelizacion')) l.push({ id: 'fidelizacion', nombre: 'Fidelización' });
  }
  if (esDuena() && moduloActivo('analitica')) l.push({ id: 'analitica', nombre: 'Analítica' });
  if (moduloActivo('notas')) l.push({ id: 'notas', nombre: 'Notas' });
  if (esDuena()) {
    l.push({ id: 'servicios', nombre: 'Servicios y combos' });
    if (moduloActivo('promociones')) l.push({ id: 'promociones', nombre: 'Promociones' });
    l.push({ id: 'equipo', nombre: 'Equipo' }, { id: 'horarios', nombre: 'Horarios del mes' },
      { id: 'mensajes', nombre: 'Mensajes' }, { id: 'spa', nombre: 'Horario y festivos' },
      { id: 'ajustes', nombre: 'Reglas y módulos' }, { id: 'seguridad', nombre: 'Seguridad y respaldos' }, { id: 'importar', nombre: 'Importar CSV' });
  }
  if (!esDuena() && S.yo.agenda && puede('editar_horario')) l.push({ id: 'horarios', nombre: 'Mi horario del mes' });
  l.push({ id: 'cuenta', nombre: esDuena() ? 'Mi cuenta' : 'Mi cuenta y horario' });
  return l;
}

const MODULOS = {
  inicio: () => import('./inicio.js?v=7462d0b2a7'), agenda: () => import('./agenda.js?v=7462d0b2a7'), clientas: () => import('./clientas.js?v=7462d0b2a7'),
  servicios: () => import('./servicios.js?v=7462d0b2a7'), equipo: () => import('./equipo.js?v=7462d0b2a7'), spa: () => import('./ajustes.js?v=7462d0b2a7'),
  ajustes: () => import('./ajustes.js?v=7462d0b2a7'), importar: () => import('./importar.js?v=7462d0b2a7'), cuenta: () => import('./ajustes.js?v=7462d0b2a7'),
  fidelizacion: () => import('./fidelizacion.js?v=7462d0b2a7'), analitica: () => import('./analitica.js?v=7462d0b2a7'), notas: () => import('./notas.js?v=7462d0b2a7'),
  promociones: () => import('./promociones.js?v=7462d0b2a7'), mensajes: () => import('./plantillas.js?v=7462d0b2a7'),
  horarios: () => import('./horarios.js?v=7462d0b2a7'), cuentas: () => import('./cuentas.js?v=7462d0b2a7'), seguridad: () => import('./seguridad.js?v=7462d0b2a7'),
  mas: null,
};

function shell() {
  const secs = secciones();
  const dock = secs.filter((s) => s.dock);
  pintar(raiz, html`
    <div class="app">
      <nav class="lateral-panel" aria-label="Secciones">
        <div class="lp-marca"><img src="/app-citas/img/logo.webp" alt="" width="42" height="42"><span><strong>Amelia</strong><em>Panel</em></span>${botonTema()}</div>
        ${secs.map((s) => html`<a href="#/${s.id}" data-sec="${s.id}">${crudo(IC[s.id])}<span>${s.nombre}</span></a>`)}
        <div class="lp-pie">
          <a class="ver-reservas" href="/reservar/" target="_blank" rel="noopener">Ver página de reservas ↗</a>
          <div class="lp-yo">${S.yo.foto ? html`<img class="avatar" src="${S.yo.foto}" alt="">` : html`<span class="avatar inicial">${inicial(S.yo.nombre)}</span>`}<span><strong>${S.yo.nombre}</strong><small>${esDuena() ? 'Propietaria' : 'Colaboradora'}</small></span></div>
        </div>
      </nav>
      <main id="vista" class="vista"></main>
      ${puede('gestionar_citas') ? html`<button class="fab" id="fab" aria-label="Agendar cita">${crudo(ICONOS.mas)}</button>` : ''}
      <nav class="dock" aria-label="Secciones">
        ${dock.map((s) => html`<a href="#/${s.id}" data-sec="${s.id}">${crudo(IC[s.id])}<span>${s.nombre}</span></a>`)}
        <a href="#/mas" data-sec="mas">${crudo(IC.mas)}<span>Más</span></a>
      </nav>
    </div>`);
}

function pantallaMas(v) {
  const secs = secciones().filter((s) => !s.dock);
  pintar(v, html`
    <header class="cabeza-vista"><div><span class="script">Amelia</span><h1>Más <em>opciones</em></h1></div>${botonTema()}</header>
    <div class="lista-mas">
      ${secs.map((s) => html`<a class="fila-mas tarjeta" href="#/${s.id}">${crudo(IC[s.id])}<span>${s.nombre}</span><span class="flecha-mas">›</span></a>`)}
      <a class="fila-mas tarjeta" href="/reservar/" target="_blank" rel="noopener">${crudo(ICONOS.calendario)}<span>Ver página de reservas</span><span class="flecha-mas">↗</span></a>
    </div>`);
}

let rutaActual = null;
async function navegar(opciones) {
  const suave = opciones?.suave === true;
  const [, sec = 'inicio', ...resto] = location.hash.replace(/^#/, '').split('/');
  const valida = sec === 'mas' || secciones().some((s) => s.id === sec);
  const id = valida ? sec : 'inicio';
  // Al cambiar de sección se cierra la hoja que hubiera abierta (si no, tapa la pantalla nueva).
  if (id !== rutaActual && document.body.classList.contains('con-hoja')) cerrarHoja(true);
  rutaActual = id;
  for (const a of $$('[data-sec]')) a.classList.toggle('activo', a.dataset.sec === id || (id !== 'mas' && a.dataset.sec === 'mas' && !secciones().find((s) => s.id === id)?.dock && window.innerWidth < 900));
  const v = $('#vista');
  const y = window.scrollY;
  if (!suave) {
    v.classList.remove('entra');
    void v.offsetWidth;
    v.classList.add('entra');
    window.scrollTo(0, 0);
  }
  if (id === 'mas') return pantallaMas(v);
  try {
    const m = await MODULOS[id]();
    if (rutaActual !== id) return;
    await m.vista(v, { seccion: id, resto });
    if (suave) window.scrollTo(0, y);
  } catch (e) {
    if (e.status === 401) return entrar();
    console.error(e);
    pintar(v, html`<div class="vacio"><p>${e.message || 'No se pudo cargar esta sección.'}</p><button class="btn" id="reintentar">Reintentar</button></div>`);
    $('#reintentar').onclick = navegar;
  }
}

async function entrar() {
  try {
    await recargar();
  } catch (e) {
    if (e.status === 401) {
      window.removeEventListener('hashchange', navegar);
      return pantallaIngreso(raiz, entrar);
    }
    pintar(raiz, html`<div class="ingreso"><p class="aviso error">${e.message}</p><button class="btn" id="re">Reintentar</button></div>`);
    $('#re').onclick = entrar;
    return;
  }
  shell();
  $('#fab')?.addEventListener('click', async () => {
    const { nuevaCita } = await import('./citas.js?v=7462d0b2a7');
    const m = /^#\/agenda\/(\d{4}-\d{2}-\d{2})/.exec(location.hash);
    nuevaCita({ fecha: m ? m[1] : S.hoy, colaboradoraId: esDuena() ? undefined : S.yo.id }, () => navegar());
  });
  vigilarNovedades();
  setTimeout(() => import('./tour.js?v=7462d0b2a7').then((t) => t.tourSiEsPrimeraVez()), 700);
  window.removeEventListener('hashchange', navegar);
  window.addEventListener('hashchange', navegar);
  navegar();
}

// ---------- sincronización entre dispositivos ----------
// Además de las notificaciones push, cada 20 s (solo con la pantalla visible) y cada vez que se vuelve a la app
// pregunta si hubo cambios: citas, cobros, ventas, gastos… hechos desde CUALQUIER dispositivo (también el mismo
// usuario en otro celular). Si los hay, recarga la vista abierta; las citas de otras personas salen en un aviso.
let ultimoRegistro = 0, relojNovedades = null, consultarNovedades = null, consultando = false;
const TEXTO_NOVEDAD = { creada: ['💜', 'Nueva cita'], movida: ['🔁', 'Cita movida'], cancelada: ['✖️', 'Cita cancelada'], cobro: ['💵', 'Cobro registrado'] };
const VISTAS_VIVAS = ['inicio', 'agenda', 'cuentas', 'clientas', 'fidelizacion', 'analitica'];
function vigilarNovedades() {
  clearInterval(relojNovedades);
  ultimoRegistro = 0;
  const consultar = async () => {
    if (document.hidden || consultando) return;
    consultando = true;
    try {
      const r = await api(`/api/panel/novedades?desde=${ultimoRegistro}`);
      const habiaBase = ultimoRegistro > 0;
      ultimoRegistro = r.ultimo;
      if (!habiaBase || !r.cambios) return;
      for (const n of r.novedades.slice(-3)) {
        const [ic, t] = TEXTO_NOVEDAD[n.accion] || ['📅', 'Agenda actualizada'];
        const [, mes, d] = n.fecha.split('-');
        const h = Math.floor(n.inicio / 60), m = n.inicio % 60;
        toast(`${ic} ${t}${n.origen === 'web' && n.accion === 'creada' ? ' en línea' : ''}: ${n.clienta} · ${d}/${mes} ${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'a. m.' : 'p. m.'} con ${n.colaboradora}`, 'ok');
      }
      // Recarga la vista abierta (si no hay una hoja encima, para no borrar lo que se está escribiendo).
      if (VISTAS_VIVAS.includes(rutaActual) && !document.body.classList.contains('con-hoja')) navegar({ suave: true });
      else pendienteRecargar = true;
    } catch { /* sin conexión: se intenta en la próxima vuelta */ } finally { consultando = false; }
  };
  consultarNovedades = consultar;
  consultar();
  relojNovedades = setInterval(consultar, 20000);
}
// Si llegó un cambio con una hoja abierta, se aplica al cerrarla.
let pendienteRecargar = false;
document.addEventListener('hoja-cerrada', () => { if (pendienteRecargar && VISTAS_VIVAS.includes(rutaActual) && !document.body.classList.contains('con-hoja')) { pendienteRecargar = false; navegar({ suave: true }); } });
document.addEventListener('visibilitychange', () => { if (!document.hidden) consultarNovedades?.(); });
addEventListener('focus', () => consultarNovedades?.());
addEventListener('online', () => consultarNovedades?.());
// Después de guardar algo en este dispositivo, se consulta de una vez (así el número de "último cambio" queda al día).
export const avisarCambio = () => setTimeout(() => consultarNovedades?.(), 400);

// Si cualquier llamada responde 401, vuelve a la pantalla de ingreso.
window.addEventListener('unhandledrejection', (e) => {
  if (e.reason?.status === 401) { e.preventDefault(); toast('Tu sesión terminó. Ingresa de nuevo.'); entrar(); }
});

export async function salir() {
  try { await api('/api/auth/logout', { metodo: 'POST', datos: {} }); } catch { /* igual sale */ }
  location.hash = '';
  entrar();
}

entrar();
