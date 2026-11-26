// Analítica (Erika): ingresos, métodos de pago, rendimiento por colaboradora y servicio, asistencia y clientas.
import { api, html, pintar, $, $$, dinero, sumarDias, DIAS_CORTOS } from '/app-citas/js/util.js?v=3aee244dd8';
import { S, aplicarEstilos } from './estado.js?v=3aee244dd8';

const METODO = { efectivo: 'Efectivo', nequi: 'Nequi', daviplata: 'Daviplata', tarjeta: 'Tarjeta', transferencia: 'Transferencia', otro: 'Otro' };

function rangos() {
  const hoy = S.hoy;
  const ini = hoy.slice(0, 8) + '01';
  const d = new Date(ini + 'T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() - 1);
  const iniAnt = d.toISOString().slice(0, 10);
  return [
    ['mes', 'Este mes', ini, hoy],
    ['anterior', 'Mes pasado', iniAnt, sumarDias(ini, -1)],
    ['30', 'Últimos 30 días', sumarDias(hoy, -29), hoy],
    ['90', 'Últimos 90 días', sumarDias(hoy, -89), hoy],
    ...(otroMes ? [['otro', 'Otro mes', otroMes, finMes(otroMes)]] : []),
  ];
}
// Cualquier mes hacia atrás (no solo el actual y el pasado).
let otroMes = null;
function finMes(ini) { const d = new Date(ini + 'T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() + 1); d.setUTCDate(0); return d.toISOString().slice(0, 10); }

let actual = 'mes';

export async function vista(v) {
  pintar(v, html`
    <header class="cabeza-vista"><div><span class="script">Números</span><h1>Analítica</h1></div></header>
    <div class="segmentado ancho rango-analitica">${rangos().map(([k, t]) => html`<button data-rango="${k}" aria-pressed="${k === actual}">${t}</button>`)}</div>
    <label class="campo otro-mes"><span>Ver otro mes</span><input type="month" id="otroMes" value="${(otroMes || S.hoy).slice(0, 7)}" max="${S.hoy.slice(0, 7)}"></label>
    <div id="analitica"><div class="turnos-cargando"><span class="girando oscuro"></span></div></div>`);
  for (const b of $$('[data-rango]', v)) b.onclick = () => { actual = b.dataset.rango; vista(v); };
  $('#otroMes', v).onchange = (e) => { if (!e.target.value) return; otroMes = `${e.target.value}-01`; actual = 'otro'; vista(v); };
  const [, , desde, hasta] = rangos().find((r) => r[0] === actual);
  const a = await api(`/api/panel/analitica?desde=${desde}&hasta=${hasta}`);
  const maxCol = Math.max(1, ...a.colaboradoras.map((c) => c.ingresos || c.atendidas));
  const maxServ = Math.max(1, ...a.servicios.map((s) => s.n));
  const maxMet = Math.max(1, ...a.metodos.map((m) => m.total));
  const maxDia = Math.max(1, ...a.por_dia);
  const pct = (n, max) => `${Math.max(2, Math.round((n / max) * 100))}%`;
  pintar($('#analitica', v), html`
    <div class="stats">
      <div class="stat destacado"><span>Ingresos</span><strong>${dinero(a.ingresos)}</strong><small>${a.propinas ? `+ ${dinero(a.propinas)} en propinas` : 'cobros registrados'}</small></div>
      <div class="stat"><span>Ticket promedio</span><strong>${a.ticket_promedio != null ? dinero(a.ticket_promedio) : '—'}</strong><small>${a.citas_cobradas} citas cobradas</small></div>
      <div class="stat"><span>Asistencia</span><strong>${a.asistencia_pct != null ? a.asistencia_pct + '%' : '—'}</strong><small>${a.estados.asistio || 0} asistieron · ${a.estados.no_asistio || 0} faltaron · ${a.estados.cancelada || 0} canceladas</small></div>
      <div class="stat"><span>Clientas</span><strong>${a.clientas.nuevas + a.clientas.recurrentes}</strong><small>${a.clientas.nuevas} nuevas · ${a.clientas.recurrentes} recurrentes</small></div>
    </div>
    <div class="rejilla-analitica">
      <section class="tarjeta bloque-ajustes"><h2>Por colaboradora</h2>
        ${a.colaboradoras.length ? a.colaboradoras.map((c) => html`<div class="barra-fila"><span class="bf-nombre">${c.nombre}</span>
          <span class="bf-barra"><span data-c="${c.color}" data-ancho="${pct(c.ingresos || c.atendidas, maxCol)}"></span></span>
          <span class="bf-valor"><strong>${dinero(c.ingresos)}</strong><small>${c.atendidas} cita${c.atendidas === 1 ? '' : 's'}${c.faltas ? ` · ${c.faltas} falta${c.faltas === 1 ? '' : 's'}` : ''}</small></span></div>`) : html`<p class="muted">Sin datos.</p>`}
      </section>
      <section class="tarjeta bloque-ajustes"><h2>Servicios más vendidos</h2>
        ${a.servicios.length ? a.servicios.map((s) => html`<div class="barra-fila"><span class="bf-nombre">${s.nombre}</span>
          <span class="bf-barra"><span data-ancho="${pct(s.n, maxServ)}"></span></span>
          <span class="bf-valor"><strong>${s.n}</strong><small>${s.valor ? dinero(s.valor) : ''}</small></span></div>`) : html`<p class="muted">Sin datos.</p>`}
      </section>
      <section class="tarjeta bloque-ajustes"><h2>Métodos de pago</h2>
        ${a.metodos.length ? a.metodos.map((m) => html`<div class="barra-fila"><span class="bf-nombre">${METODO[m.metodo] || m.metodo}</span>
          <span class="bf-barra"><span data-ancho="${pct(m.total, maxMet)}"></span></span>
          <span class="bf-valor"><strong>${dinero(m.total)}</strong><small>${m.n} pago${m.n === 1 ? '' : 's'}</small></span></div>`) : html`<p class="muted">Aún no hay cobros registrados. Usa "Cobrar" en cada cita.</p>`}
      </section>
      <section class="tarjeta bloque-ajustes"><h2>Días con más citas</h2>
        <div class="columnas-dias">${[1, 2, 3, 4, 5, 6, 0].map((d) => html`<div class="cd"><span class="cd-barra"><span data-alto-pct="${pct(a.por_dia[d], maxDia)}"></span></span><small>${DIAS_CORTOS[d]}</small><strong>${a.por_dia[d]}</strong></div>`)}</div>
        <p class="muted small espacio-arriba">Reservas en línea: <strong>${a.origen.web || 0}</strong> · desde el panel: <strong>${a.origen.panel || 0}</strong>${a.origen.importada ? ` · importadas: ${a.origen.importada}` : ''}</p>
      </section>
    </div>`);
  aplicarEstilos(v);
  for (const el of v.querySelectorAll('[data-alto-pct]')) el.style.height = el.dataset.altoPct;
}
