// Seguridad y respaldos (Erika): botón de emergencia para pausar las reservas en línea, revisión y borrado en
// bloque de reservas sospechosas, y copias de seguridad (automáticas cada día + manual + descarga).
import { api, html, crudo, pintar, $, $$, toast, ocupado, confirmar, fechaCorta, hora, ICONOS } from '/app-citas/js/util.js?v=3aee244dd8';

let horas = 48;

export async function vista(v) {
  const d = await api(`/api/panel/seguridad?horas=${horas}`);
  const sospechosas = d.reservas.filter((r) => r.sospechosa && r.estado === 'confirmada' && !r.cobros);
  pintar(v, html`
    <header class="cabeza-vista"><div><span class="script">Tranquilidad</span><h1>Seguridad y <em>respaldos</em></h1></div></header>

    <section class="tarjeta bloque-ajustes emergencia ${d.pausadas ? 'activa' : ''}">
      <h2>${d.pausadas ? '⏸️ Reservas en línea PAUSADAS' : 'Reservas en línea activas'}</h2>
      <p class="muted">${d.pausadas ? 'Nadie puede agendar desde la página ni la app. Tú y el equipo sí pueden agendar desde el panel.' : 'Si ves reservas raras (muchas de golpe, nombres falsos), pausa todo con un toque mientras revisas.'}</p>
      <label class="campo"><span>Mensaje para las clientas mientras está pausado</span><input id="msgPausa" maxlength="200" value="${d.mensaje}"></label>
      <button class="btn bloque ${d.pausadas ? '' : 'peligro'}" id="btnPausa">${d.pausadas ? '▶️ Reanudar reservas en línea' : '⏸️ Pausar reservas (emergencia)'}</button>
    </section>

    <section class="tarjeta bloque-ajustes espacio-arriba">
      <h2>Reservas en línea recientes</h2>
      <div class="segmentado ancho">${[[24, '24 h'], [48, '48 h'], [168, '7 días'], [720, '30 días']].map(([h, t]) => html`<button data-horas="${h}" aria-pressed="${h === horas}">${t}</button>`)}</div>
      <p class="muted small espacio-arriba">Se marcan como <strong>sospechosas</strong> las que llegan muchas desde la misma conexión (4 o más) o el mismo número (3 o más). Las citas con cobros nunca se borran.</p>
      ${d.reservas.length ? html`
        <div class="fila-botones espacio-arriba"><button class="btn sec chico" id="selSosp" ${sospechosas.length ? '' : crudo('disabled')}>Elegir sospechosas (${sospechosas.length})</button><button class="btn sec chico" id="selNada">Quitar selección</button></div>
        <div class="lista-reservas">${d.reservas.map((r) => html`
          <label class="fila-reserva ${r.sospechosa ? 'sospechosa' : ''}">
            <input type="checkbox" value="${r.id}" ${r.cobros ? crudo('disabled') : ''}>
            <span><strong>${r.clienta}</strong> <small>${r.celular}</small><br><small>${fechaCorta(r.fecha)} ${hora(r.inicio)} · ${r.servicios} · ${r.colaboradora} · ${r.estado}</small><br>
            <small class="muted">Creada ${r.creado.replace('T', ' ').slice(0, 16)} UTC${r.mismas_ip > 1 ? ` · ${r.mismas_ip} desde la misma conexión` : ''}${r.mismo_cel > 1 ? ` · ${r.mismo_cel} con este número` : ''}</small></span>
            ${r.sospechosa ? html`<span class="pastilla mal">Sospechosa</span>` : ''}
          </label>`)}</div>
        <button class="btn peligro bloque espacio-arriba" id="borrarSel">Borrar las seleccionadas</button>`
      : html`<p class="muted espacio-arriba">No hay reservas en línea en este periodo.</p>`}
    </section>

    <section class="tarjeta bloque-ajustes espacio-arriba">
      <h2>Copias de seguridad</h2>
      <p class="muted small">Se hace una copia automática cada día de madrugada (se guardan las últimas 14). Descárgala y guárdala en tu Drive de vez en cuando. Para restaurar, la agencia sigue la guía de restauración.</p>
      <button class="btn sec" id="hacerCopia">${crudo(ICONOS.mas)} Hacer copia ahora</button>
      <div class="lista-respaldos espacio-arriba">${d.respaldos.length ? d.respaldos.map((x) => html`
        <div class="fila-respaldo"><span><strong>${fechaCorta(x.fecha)}</strong><small>${x.clave.includes('manual') ? 'manual' : 'automática'} · ${x.filas} registros · ${Math.max(1, Math.round(x.bytes / 1024))} KB${x.destino === 'r2' ? ' · también en R2' : ''}</small></span>
        ${x.en_base || x.destino === 'r2' ? html`<a class="btn ghost chico" href="/api/panel/respaldos/${x.id}" download>Descargar</a>` : html`<small class="muted">solo en R2</small>`}</div>`) : html`<p class="muted">Aún no hay copias. Toca "Hacer copia ahora".</p>`}</div>
    </section>`);

  for (const b of $$('[data-horas]', v)) b.onclick = () => { horas = Number(b.dataset.horas); vista(v); };
  $('#btnPausa', v).onclick = async () => {
    const pausar = !d.pausadas;
    if (pausar && !(await confirmar('¿Pausar las reservas en línea?', 'Las clientas verán tu mensaje y el botón de WhatsApp. Puedes reanudarlas cuando quieras.', { si: 'Pausar', peligro: true }))) return;
    try { await api('/api/panel/seguridad/pausa', { metodo: 'PUT', datos: { pausadas: pausar, mensaje: $('#msgPausa', v).value } }); toast(pausar ? 'Reservas en línea pausadas' : 'Reservas en línea activas otra vez', 'ok'); vista(v); } catch (x) { toast(x.message, 'error'); }
  };
  const casillas = () => $$('.fila-reserva input:not(:disabled)', v);
  $('#selSosp', v)?.addEventListener('click', () => { const ids = new Set(sospechosas.map((r) => String(r.id))); for (const c of casillas()) c.checked = ids.has(c.value); });
  $('#selNada', v)?.addEventListener('click', () => { for (const c of casillas()) c.checked = false; });
  $('#borrarSel', v)?.addEventListener('click', async (e) => {
    const ids = casillas().filter((c) => c.checked).map((c) => Number(c.value));
    if (!ids.length) return toast('Elige al menos una reserva.');
    if (!(await confirmar(`¿Borrar ${ids.length} reserva${ids.length === 1 ? '' : 's'}?`, 'Se liberan esos horarios. Esto no se puede deshacer (queda en la copia de seguridad de hoy).', { si: 'Borrar', peligro: true }))) return;
    ocupado(e.target, async () => {
      try { const r = await api('/api/panel/seguridad/borrar-citas', { metodo: 'POST', datos: { ids } }); toast(`${r.borradas} reservas borradas`, 'ok'); vista(v); } catch (x) { toast(x.message, 'error'); }
    });
  });
  $('#hacerCopia', v).onclick = (e) => ocupado(e.target, async () => {
    try { const r = await api('/api/panel/respaldos', { metodo: 'POST', datos: {} }); toast(`Copia lista: ${r.filas} registros`, 'ok'); vista(v); } catch (x) { toast(x.message, 'error'); }
  });
}
