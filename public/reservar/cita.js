// Gestionar la cita con el enlace privado (/reservar/cita/#<token>): ver, reprogramar, cancelar.
import { api, html, crudo, pintar, $, toast, ocupado, confirmar, hora, duracion, dinero, fechaLarga, ICONOS, hoyBogota } from '/app-citas/js/util.js?v=14671ef4de';
import { crearSelector } from './selector.js?v=14671ef4de';
import { estadoPush, activarPush } from '/app-citas/js/push.js?v=14671ef4de';

const app = $('#app');
const bandeja = $('#bandeja');
const token = decodeURIComponent(location.hash.slice(1));
let cita, cat, nuevo = null;

const ESTADOS = {
  confirmada: ['Confirmada', 'ok'], cancelada: ['Cancelada', 'mal'], asistio: ['Atendida', ''], no_asistio: ['No asistió', 'aviso'],
};

async function cargar() {
  if (!token) return error('Este enlace no es válido. Revisa el mensaje donde lo recibiste.');
  try {
    [cita, cat] = await Promise.all([api(`/api/public/cita?token=${encodeURIComponent(token)}`), api('/api/public/catalogo')]);
  } catch (e) { return error(e.message); }
  ver();
}

function error(m) {
  pintar(app, html`<div class="vacio">${crudo(ICONOS.calendario)}<p>${m}</p><a class="btn" href="/reservar/">Reservar una cita</a></div>`);
}

function ver() {
  bandeja.hidden = true;
  document.body.classList.remove('con-bandeja');
  const [estado, clase] = ESTADOS[cita.estado] || [cita.estado, ''];
  const wa = `https://wa.me/${cat.ajustes.whatsapp}?text=${encodeURIComponent(`¡Hola! Tengo una pregunta sobre mi cita ${cita.codigo} del ${cita.fecha_texto} a las ${cita.hora_texto}.`)}`;
  const pasada = cita.fecha < hoyBogota();
  pintar(app, html`
    <section class="paso">
      <div class="saludo">
        <span class="script">Hola, ${cita.clienta}</span>
        <h1>Tu <em>cita</em></h1>
      </div>
      <span class="pastilla estado-cita ${clase}">${estado}</span>
      <div class="tarjeta resumen-cita">
        <div class="resumen-fecha">
          <span class="resumen-dia">${cita.fecha_texto}</span>
          <span class="resumen-hora">${hora(cita.inicio)} – ${hora(cita.fin)} · ${duracion(cita.fin - cita.inicio)}</span>
        </div>
        <ul class="resumen-lista">
          ${cita.servicios.map((s) => html`<li><span>${s.nombre}</span><span>${s.precio != null ? dinero(s.precio) : '—'}</span></li>`)}
        </ul>
        <div class="resumen-pie"><span>Con <strong>${cita.colaboradora.nombre}</strong></span><span class="muted">Código <strong>${cita.codigo}</strong></span></div>
      </div>
      ${cita.estado === 'confirmada' && !pasada ? html`
        <div class="gestion">
          <div class="acciones-listo">
            <div class="dos">
              <a class="btn sec" href="/api/public/cita.ics?token=${encodeURIComponent(token)}">${crudo(ICONOS.calendario)} Calendario</a>
              <a class="btn sec" href="${wa}" target="_blank" rel="noopener">${crudo(ICONOS.whatsapp)} WhatsApp</a>
            </div>
          </div>
          ${cita.puede_modificar ? html`
            <button class="btn bloque" id="reprogramar">Cambiar día u hora</button>
            <button class="btn ghost bloque" id="cancelar">Cancelar cita</button>
            <p class="muted small politica">${cat.ajustes.politica_texto}</p>`
          : html`<p class="aviso">Faltan menos de ${cita.cancelacion_horas} horas para tu cita, así que los cambios se hacen por WhatsApp.</p>`}
        </div>` : ''}
      ${cita.estado === 'cancelada' ? html`<a class="btn bloque" href="/reservar/">Reservar otra cita</a>` : ''}
      ${pasada && cita.estado !== 'cancelada' ? html`<a class="btn bloque" href="/reservar/">Volver a reservar</a>` : ''}
    </section>`);
  $('#reprogramar')?.addEventListener('click', reprogramar);
  // Guarda la cita en este celular (para "Mis citas") y ofrece recordatorios
  try {
    const lista = JSON.parse(localStorage.getItem('amelia_citas') || '[]');
    if (!lista.some((x) => x.token === token)) { lista.push({ token, fecha: cita.fecha, inicio: cita.inicio }); localStorage.setItem('amelia_citas', JSON.stringify(lista.slice(-12))); }
  } catch { /* sin almacenamiento */ }
  if (cita.estado === 'confirmada' && !pasada) avisos();
  $('#cancelar')?.addEventListener('click', cancelar);
}

async function avisos() {
  const PUSH = { sw: '/reservar/sw.js', scope: '/reservar/' };
  const estado = await estadoPush(PUSH).catch(() => 'no-soportado');
  const caja = document.createElement('div');
  $('.gestion')?.prepend(caja);
  if (estado === 'activo') { caja.innerHTML = '<p class="avisos-ok">🔔 Te avisaremos un día antes y 2 horas antes.</p>'; return; }
  if (estado !== 'inactivo') return;
  caja.innerHTML = '<button class="tarjeta avisos" id="activarAvisos"><strong>🔔 Avísame antes de mi cita</strong><span>Te recordamos la víspera y 1 hora antes.</span></button>';
  $('#activarAvisos').onclick = async () => {
    try {
      await activarPush({ ...PUSH, ruta: '/api/public/push/suscribir', extra: { tokens: [token] } });
      caja.innerHTML = '<p class="avisos-ok">🔔 ¡Listo! Te avisaremos antes de tu cita.</p>';
    } catch (x) { toast(x.message, 'error'); }
  };
}

async function cancelar() {
  const ok = await confirmar('¿Cancelar tu cita?', `Liberaremos tu turno del ${cita.fecha_texto} a las ${cita.hora_texto}.`, { si: 'Sí, cancelar', peligro: true });
  if (!ok) return;
  try {
    cita = await api('/api/public/cita/cancelar', { metodo: 'POST', datos: { token } });
    toast('Tu cita fue cancelada.', 'ok');
    ver();
  } catch (e) { toast(e.message, 'error'); }
}

function reprogramar() {
  nuevo = null;
  pintar(app, html`
    <section class="paso">
      <button class="btn ghost chico" id="volver">${crudo(ICONOS.atras)} Volver</button>
      <h2 class="titulo-paso">Elige tu nuevo horario</h2>
      <div class="con-quien"><img class="avatar" src="${cita.colaboradora.foto}" alt=""><span>Con <strong>${cita.colaboradora.nombre}</strong> · ${duracion(cita.fin - cita.inicio)}</span></div>
      <div id="selector"></div>
    </section>`);
  $('#volver').onclick = ver;
  const t = encodeURIComponent(token);
  crearSelector({
    raiz: $('#selector'), hoy: cat.hoy, ventana: Math.min(cat.ajustes.ventana_dias, 90),
    cargarDias: async (desde, n) => (await api(`/api/public/cita/turnos?token=${t}&desde=${desde}&n=${n}`)).dias,
    cargarTurnos: async (f) => (await api(`/api/public/cita/turnos?token=${t}&desde=${f}&n=1`)).turnos
      .filter((x) => !(f === cita.fecha && x.inicio === cita.inicio)),
    alElegir: (f, turno) => {
      nuevo = turno ? { fecha: f, inicio: turno.inicio, fin: turno.fin } : null;
      bandeja.hidden = !nuevo;
      document.body.classList.toggle('con-bandeja', !!nuevo);
      if (nuevo) pintar($('#bandejaInfo'), html`<strong>${fechaLarga(f)}</strong><span>${hora(turno.inicio)} – ${hora(turno.fin)}</span>`);
    },
  });
}

$('#btnSeguir').onclick = (e) => ocupado(e.currentTarget, async () => {
  if (!nuevo) return;
  try {
    cita = await api('/api/public/cita/reprogramar', { metodo: 'POST', datos: { token, fecha: nuevo.fecha, inicio: nuevo.inicio } });
    toast('¡Listo! Tu cita quedó reprogramada.', 'ok');
    ver();
  } catch (x) { toast(x.message, 'error'); }
});

window.addEventListener('hashchange', () => location.reload());
cargar();
