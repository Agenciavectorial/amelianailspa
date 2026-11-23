// Inicio: saludo, números del día y las citas de hoy y mañana.
import { api, html, crudo, pintar, $, hora, dinero, fechaLarga, sumarDias, inicial, ICONOS } from '/app-citas/js/util.js';
import { S, esDuena, puede, colab, aplicarEstilos } from './estado.js';
import { verCita, nuevaCita, nuevoBloqueo, pastillaEstado } from './citas.js';

function saludo() {
  const h = new Date(Date.now() - 5 * 3600000).getUTCHours();
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
}

export async function vista(v) {
  pintar(v, html`
    <header class="cabeza-vista">
      <div><span class="script">${saludo()}</span><h1>${S.yo.nombre.split(' ')[0]}, <em>así va tu día</em></h1></div>
    </header>
    <div class="stats" id="stats">${[1, 2, 3, 4].map(() => html`<div class="stat esqueleto"></div>`)}</div>
    <div class="acciones-rapidas">
      ${puede('gestionar_citas') ? html`<button class="btn" id="irNueva">${crudo(ICONOS.mas)} Nueva cita</button>` : ''}
      ${puede('gestionar_bloqueos') ? html`<button class="btn sec" id="irBloq">${crudo(ICONOS.reloj)} Bloquear horario</button>` : ''}
      <a class="btn sec" href="#/agenda">${crudo(ICONOS.calendario)} Ver agenda</a>
    </div>
    <section class="bloque-inicio"><h2>Hoy <span class="muted">${fechaLarga(S.hoy)}</span></h2><div id="listaHoy"></div></section>
    <section class="bloque-inicio"><h2>Mañana</h2><div id="listaManana"></div></section>`);
  const recargar = () => vista(v);
  $('#irNueva')?.addEventListener('click', () => nuevaCita({}, recargar));
  $('#irBloq')?.addEventListener('click', () => nuevoBloqueo({}, recargar));

  const manana = sumarDias(S.hoy, 1);
  const filtro = puede('ver_agenda_equipo') ? '' : `&colaboradora=${S.yo.id}`;
  const [res, ag] = await Promise.all([
    api('/api/panel/resumen'),
    api(`/api/panel/agenda?desde=${S.hoy}&hasta=${manana}${filtro}`),
  ]);
  pintar($('#stats'), html`
    <div class="stat destacado"><span>Citas hoy</span><strong>${res.dia.citas || 0}</strong><small>${res.dia.atendidas || 0} atendidas</small></div>
    <div class="stat"><span>Valor estimado hoy</span><strong>${res.dia.valor ? dinero(res.dia.valor) : '—'}</strong><small>con precios registrados</small></div>
    <div class="stat"><span>Próximos 7 días</span><strong>${res.semana.citas || 0}</strong><small>${res.semana.valor ? dinero(res.semana.valor) : 'citas agendadas'}</small></div>
    <div class="stat"><span>Este mes</span><strong>${res.mes.web || 0}</strong><small>reservas en línea · ${res.mes.faltas || 0} faltas</small></div>`);
  const pintarLista = (el, fecha) => {
    const l = ag.citas.filter((c) => c.fecha === fecha && c.estado !== 'cancelada' && (esDuena() || c.propia || puede('ver_agenda_equipo')));
    if (!l.length) { pintar(el, html`<div class="vacio chico">${crudo(ICONOS.calendario)}<p>Sin citas.</p></div>`); return; }
    pintar(el, html`<div class="lista-citas">${l.map((c) => {
      const co = colab(c.colaboradora_id);
      return html`<button class="fila-cita tarjeta" data-cita="${c.id}" data-propia="${c.propia ? 1 : 0}" data-c="${co?.color || '#A98BBE'}">
        <span class="fc-hora"><strong>${hora(c.inicio)}</strong><small>${hora(c.fin)}</small></span>
        <span class="fc-cuerpo"><strong>${c.clienta_nombre}</strong><span>${c.servicios.map((s) => s.nombre).join(' + ')}</span></span>
        <span class="fc-lado">${co ? html`<span class="fc-colab">${co.foto ? html`<img class="avatar" src="${co.foto}" alt="${co.nombre}">` : html`<span class="avatar inicial">${inicial(co.nombre)}</span>`}</span>` : ''}${c.estado !== 'confirmada' ? pastillaEstado(c.estado) : ''}</span>
      </button>`;
    })}</div>`);
    aplicarEstilos(el);
    el.onclick = (e) => {
      const b = e.target.closest('[data-cita]');
      if (b && b.dataset.propia === '1') verCita(Number(b.dataset.cita), recargar);
    };
  };
  pintarLista($('#listaHoy'), S.hoy);
  pintarLista($('#listaManana'), manana);
}
