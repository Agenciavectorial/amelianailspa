// Arranque del panel: sesión, navegación (dock en celular, barra lateral en computador) y rutas por hash.
import { api, html, crudo, pintar, $, $$, toast, inicial, ICONOS, cerrarHoja } from '/app-citas/js/util.js';
import { S, recargar, esDuena, puede } from './estado.js';
import { pantallaIngreso } from './login.js';

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
  if (puede('ver_clientas')) l.push({ id: 'clientas', nombre: 'Clientas', dock: true }, { id: 'fidelizacion', nombre: 'Fidelización' });
  if (esDuena()) l.push({ id: 'analitica', nombre: 'Analítica' });
  l.push({ id: 'notas', nombre: 'Notas' });
  if (esDuena()) {
    l.push({ id: 'servicios', nombre: 'Servicios' }, { id: 'promociones', nombre: 'Promociones' }, { id: 'equipo', nombre: 'Equipo' },
      { id: 'mensajes', nombre: 'Mensajes' }, { id: 'spa', nombre: 'Horario y festivos' },
      { id: 'ajustes', nombre: 'Reglas de reserva' }, { id: 'importar', nombre: 'Importar CSV' });
  }
  l.push({ id: 'cuenta', nombre: esDuena() ? 'Mi cuenta' : 'Mi cuenta y horario' });
  return l;
}

const MODULOS = {
  inicio: () => import('./inicio.js'), agenda: () => import('./agenda.js'), clientas: () => import('./clientas.js'),
  servicios: () => import('./servicios.js'), equipo: () => import('./equipo.js'), spa: () => import('./ajustes.js'),
  ajustes: () => import('./ajustes.js'), importar: () => import('./importar.js'), cuenta: () => import('./ajustes.js'),
  fidelizacion: () => import('./fidelizacion.js'), analitica: () => import('./analitica.js'), notas: () => import('./notas.js'),
  promociones: () => import('./promociones.js'), mensajes: () => import('./plantillas.js'),
  mas: null,
};

function shell() {
  const secs = secciones();
  const dock = secs.filter((s) => s.dock);
  pintar(raiz, html`
    <div class="app">
      <nav class="lateral-panel" aria-label="Secciones">
        <div class="lp-marca"><img src="/app-citas/img/logo.webp" alt="" width="42" height="42"><span><strong>Amelia</strong><em>Panel</em></span></div>
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
    <header class="cabeza-vista"><div><span class="script">Amelia</span><h1>Más <em>opciones</em></h1></div></header>
    <div class="lista-mas">
      ${secs.map((s) => html`<a class="fila-mas tarjeta" href="#/${s.id}">${crudo(IC[s.id])}<span>${s.nombre}</span><span class="flecha-mas">›</span></a>`)}
      <a class="fila-mas tarjeta" href="/reservar/" target="_blank" rel="noopener">${crudo(ICONOS.calendario)}<span>Ver página de reservas</span><span class="flecha-mas">↗</span></a>
    </div>`);
}

let rutaActual = null;
async function navegar() {
  const [, sec = 'inicio', ...resto] = location.hash.replace(/^#/, '').split('/');
  const valida = sec === 'mas' || secciones().some((s) => s.id === sec);
  const id = valida ? sec : 'inicio';
  // Al cambiar de sección se cierra la hoja que hubiera abierta (si no, tapa la pantalla nueva).
  if (id !== rutaActual && document.body.classList.contains('con-hoja')) cerrarHoja(true);
  rutaActual = id;
  for (const a of $$('[data-sec]')) a.classList.toggle('activo', a.dataset.sec === id || (id !== 'mas' && a.dataset.sec === 'mas' && !secciones().find((s) => s.id === id)?.dock && window.innerWidth < 900));
  const v = $('#vista');
  v.classList.remove('entra');
  void v.offsetWidth;
  v.classList.add('entra');
  window.scrollTo(0, 0);
  if (id === 'mas') return pantallaMas(v);
  try {
    const m = await MODULOS[id]();
    if (rutaActual !== id) return;
    await m.vista(v, { seccion: id, resto });
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
    const { nuevaCita } = await import('./citas.js');
    const m = /^#\/agenda\/(\d{4}-\d{2}-\d{2})/.exec(location.hash);
    nuevaCita({ fecha: m ? m[1] : S.hoy, colaboradoraId: esDuena() ? undefined : S.yo.id }, () => navegar());
  });
  setTimeout(() => import('./tour.js').then((t) => t.tourSiEsPrimeraVez()), 700);
  window.removeEventListener('hashchange', navegar);
  window.addEventListener('hashchange', navegar);
  navegar();
}

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
