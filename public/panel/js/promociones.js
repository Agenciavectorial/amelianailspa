// Promociones (Erika): aparecen arriba en la app/página de reservas mientras estén vigentes.
import { api, html, crudo, pintar, $, toast, ocupado, confirmar, abrirHoja, cerrarHoja, dinero, fechaLarga, ICONOS, foto, SITIO } from '/app-citas/js/util.js?v=3aee244dd8';
import { S } from './estado.js?v=3aee244dd8';
import { elegirMedio } from './galeria.js?v=3aee244dd8';

export async function vista(v) {
  const { promociones } = await api('/api/panel/promociones');
  const vigente = (p) => p.activa && (!p.desde || p.desde <= S.hoy) && (!p.hasta || p.hasta >= S.hoy);
  pintar(v, html`
    <header class="cabeza-vista">
      <div><span class="script">Antójalas</span><h1>Promociones</h1></div>
      <button class="btn chico" id="nuevaPromo">${crudo(ICONOS.mas)} Promoción</button>
    </header>
    <p class="muted">Las promociones vigentes salen de primeras en la reserva y en la app de la clienta, con botón para agendar.</p>
    <div class="lista-servicios-panel espacio-arriba">${promociones.length ? promociones.map((p) => html`
      <button class="fila-servicio tarjeta ${vigente(p) ? '' : 'oculto'}" data-id="${p.id}">
        <span class="fs-foto">${foto(p.foto, { sizes: '58px', ancho: 58 })}</span>
        <span class="fs-cuerpo"><strong>${p.titulo}</strong><span>${p.precio_promo != null ? dinero(p.precio_promo) + ' · ' : ''}${p.hasta ? `hasta el ${fechaLarga(p.hasta)}` : 'sin fecha de fin'}</span></span>
        ${vigente(p) ? html`<span class="pastilla ok">Vigente</span>` : html`<span class="pastilla aviso">No visible</span>`}
      </button>`) : html`<div class="vacio">${crudo(ICONOS.chispa)}<p>Crea tu primera promoción: elige el servicio o combo, ponle precio y sale con botón Agendar.</p></div>`}</div>`);
  $('#nuevaPromo').onclick = () => editar(null, v);
  v.querySelector('.lista-servicios-panel').onclick = (e) => { const b = e.target.closest('[data-id]'); if (b) editar(promociones.find((p) => p.id === Number(b.dataset.id)), v); };
}

function editar(p, v, forzarNueva) {
  const nueva = forzarNueva ?? !p?.id;
  p = p || { titulo: '', descripcion: '', foto: '', servicio_id: null, precio_promo: null, desde: '', hasta: '', activa: 1, orden: 0 };
  const h = abrirHoja(html`
    <div class="cabeza-hoja"><div><span class="script">${nueva ? 'Nueva' : 'Editar'}</span><h2>Promoción</h2></div><button class="icono-btn" data-cerrar aria-label="Cerrar">${crudo(ICONOS.cerrar)}</button></div>
    <form id="formPromo">
      <label class="campo"><span>Título</span><input name="titulo" required maxlength="80" value="${p.titulo}" placeholder="Ej. Martes de semipermanente"></label>
      <label class="campo"><span>Descripción</span><textarea name="descripcion" maxlength="300">${p.descripcion}</textarea></label>
      <div class="dos-col">
        <label class="campo"><span>Servicio o combo que se agenda</span><select name="servicio_id" required><option value="">Elige…</option>
          ${S.servicios.filter((s) => s.visible).map((s) => html`<option value="${s.id}" ${s.id === p.servicio_id ? crudo('selected') : ''}>${s.tipo === 'combo' ? '✨ ' : ''}${s.nombre}${s.precio != null ? ` · ${dinero(s.precio)}` : ''}</option>`)}</select></label>
        <label class="campo"><span>Precio promo (COP)</span><input name="precio_promo" type="number" inputmode="numeric" min="0" step="1000" required value="${p.precio_promo ?? ''}"></label>
      </div>
      <div class="dos-col">
        <label class="campo"><span>Desde</span><input name="desde" type="date" value="${p.desde}"></label>
        <label class="campo"><span>Hasta</span><input name="hasta" type="date" value="${p.hasta}"></label>
      </div>
      <div class="campo"><span>Foto</span><div class="fila-forzar"><input name="foto" class="input" value="${p.foto}" placeholder="Elige o pega un enlace"><button type="button" class="btn sec chico" id="elegirFotoPromo">Elegir</button></div></div>
      <label class="interruptor"><input type="checkbox" name="activa" ${p.activa ? crudo('checked') : ''}> Activa</label>
      <p class="muted small">La clienta ve la promo con su precio y un botón <strong>Agendar</strong> que abre la reserva con el servicio ya elegido. La cita queda con el precio de la promo.</p>
      ${nueva ? '' : html`<div class="campo"><span>Enlace directo de la promoción</span><div class="feed"><code>${SITIO}/reservar/?promo=${p.id}</code></div><button type="button" class="btn sec chico" id="copiarPromo">${crudo(ICONOS.copiar)} Copiar enlace</button></div>`}
      <p class="aviso error" id="errPromo" hidden></p>
      <button class="btn bloque espacio-arriba" id="guardarPromo">Guardar</button>
      ${nueva ? '' : html`<button type="button" class="btn ghost bloque" id="borrarPromo">Eliminar</button>`}
    </form>`);
  const f = $('#formPromo', h);
  $('#elegirFotoPromo', h).onclick = async () => {
    const datos = { titulo: f.titulo.value, descripcion: f.descripcion.value, servicio_id: f.servicio_id.value ? Number(f.servicio_id.value) : null, precio_promo: f.precio_promo.value === '' ? null : Number(f.precio_promo.value), desde: f.desde.value, hasta: f.hasta.value, activa: f.activa.checked ? 1 : 0, orden: p.orden, id: p.id };
    const m = await elegirMedio({ titulo: 'Foto de la promoción' });
    editar({ ...p, ...datos, foto: m ? m.url : f.foto.value }, v, nueva);
  };
  f.onsubmit = (e) => {
    e.preventDefault();
    ocupado($('#guardarPromo', h), async () => {
      const datos = { titulo: f.titulo.value, descripcion: f.descripcion.value, servicio_id: f.servicio_id.value || null, precio_promo: f.precio_promo.value, desde: f.desde.value, hasta: f.hasta.value, foto: f.foto.value, activa: f.activa.checked, orden: p.orden };
      try {
        await api(nueva ? '/api/panel/promociones' : `/api/panel/promociones/${p.id}`, { metodo: nueva ? 'POST' : 'PUT', datos });
        toast('Promoción guardada', 'ok'); cerrarHoja(); vista(v);
      } catch (x) { $('#errPromo', h).textContent = x.message; $('#errPromo', h).hidden = false; }
    });
  };
  $('#copiarPromo', h)?.addEventListener('click', async () => {
    const url = `${SITIO}/reservar/?promo=${p.id}`;
    try { await navigator.clipboard.writeText(url); toast('Enlace copiado', 'ok'); } catch { prompt('Copia este enlace:', url); }
  });
  $('#borrarPromo', h)?.addEventListener('click', async () => {
    if (!(await confirmar('¿Eliminar la promoción?', p.titulo, { si: 'Eliminar', peligro: true }))) return;
    try { await api(`/api/panel/promociones/${p.id}`, { metodo: 'DELETE' }); vista(v); } catch (x) { toast(x.message, 'error'); }
  });
}
