// Servicios (solo Erika): catálogo con foto, precio, duración, quién lo hace y visibilidad.
import { api, html, crudo, pintar, $, $$, toast, ocupado, confirmar, abrirHoja, cerrarHoja, duracion, dinero, ICONOS, foto, SITIO } from '/app-citas/js/util.js?v=63bc4ab2f0';
import { S, recargar, categorias, conAgenda } from './estado.js?v=63bc4ab2f0';
import { editorGaleria, elegirMedio, agregarAGaleria } from './galeria.js?v=63bc4ab2f0';

/** Enlace directo que abre la reserva con ese servicio o combo ya elegido. */
export const enlaceServicio = (sv) => `${SITIO}/reservar/?servicio=${encodeURIComponent(sv.slug)}`;

export async function copiarEnlace(sv) {
  const url = enlaceServicio(sv);
  try { await navigator.clipboard.writeText(url); toast('Enlace copiado: pégalo en WhatsApp o Instagram', 'ok'); }
  catch { prompt('Copia este enlace:', url); }
}

function fila(s) {
  return html`<div class="fila-servicio-caja">
    <button class="fila-servicio tarjeta ${s.visible ? '' : 'oculto'} ${s.tipo === 'combo' ? 'es-combo' : ''}" data-id="${s.id}">
      <span class="fs-foto">${foto(s.foto, { sizes: '58px', ancho: 58 })}</span>
      <span class="fs-cuerpo"><strong>${s.nombre}</strong><span>${duracion(s.duracion)} · ${s.precio != null ? (s.precio_desde ? 'desde ' : '') + dinero(s.precio) : 'precio a consultar'}${s.precio_antes ? html` <s>${dinero(s.precio_antes)}</s>` : ''}</span></span>
      ${s.visible ? (s.destacado ? html`<span class="pastilla ok">Destacado</span>` : '') : html`<span class="pastilla aviso">Oculto</span>`}
    </button>
    <button class="icono-btn copiar-enlace" data-copiar="${s.id}" aria-label="Copiar enlace para agendar ${s.nombre}" title="Copiar enlace para agendar">${crudo(ICONOS.copiar)}</button>
  </div>`;
}

export async function vista(v) {
  await recargar();
  const combos = S.servicios.filter((s) => s.tipo === 'combo');
  const sueltos = S.servicios.filter((s) => s.tipo !== 'combo');
  const cats = [...new Set(sueltos.map((s) => s.categoria))];
  pintar(v, html`
    <header class="cabeza-vista">
      <div><span class="script">Catálogo</span><h1>Servicios y <em>combos</em></h1></div>
      <div class="fila-botones"><button class="btn chico" id="nuevoCombo">${crudo(ICONOS.chispa)} Combo</button><button class="btn sec chico" id="nuevoServ">${crudo(ICONOS.mas)} Servicio</button></div>
    </header>
    <p class="muted small">Toca ${crudo(ICONOS.copiar)} para copiar el enlace que abre la reserva con ese servicio ya elegido (para WhatsApp, Instagram o estados).</p>
    <section class="bloque-inicio bloque-combos">
      <h2>✨ Combos <span class="muted">lo que más se vende</span></h2>
      ${combos.length ? html`<div class="lista-servicios-panel">${combos.map(fila)}</div>`
    : html`<div class="vacio chico">${crudo(ICONOS.chispa)}<p>Crea tu primer combo, por ejemplo "Combo 1: manicure + pedicure semipermanente". Sale destacado arriba en la reserva.</p></div>`}
    </section>
    ${cats.map((cat) => html`
      <section class="bloque-inicio">
        <h2>${cat}</h2>
        <div class="lista-servicios-panel">${sueltos.filter((s) => s.categoria === cat).map(fila)}</div>
      </section>`)}`);
  $('#nuevoServ').onclick = () => editar(null, v);
  $('#nuevoCombo').onclick = () => editar({ tipo: 'combo' }, v);
  v.onclick = (e) => {
    const c = e.target.closest('[data-copiar]');
    if (c) return copiarEnlace(S.servicios.find((s) => s.id === Number(c.dataset.copiar)));
    const b = e.target.closest('.fila-servicio');
    if (b) editar(S.servicios.find((s) => s.id === Number(b.dataset.id)), v);
  };
}

function editar(s, v, pestana = 'datos') {
  const nuevo = !s?.id;
  s = { nombre: '', categoria: s?.tipo === 'combo' ? 'Combos' : (categorias()[0] || 'Uñas'), descripcion: '', foto: '', precio: null, precio_desde: 0, duracion: 60, visible: 1, orden: s?.tipo === 'combo' ? 0 : 100, tipo: 'servicio', incluye: '', precio_antes: null, costo: 0, destacado: s?.tipo === 'combo' ? 1 : 0, ...(s || {}) };
  const esCombo = s.tipo === 'combo';
  const quienes = new Set(S.colaboradoras.filter((c) => c.servicios.includes(s.id)).map((c) => c.id));
  if (nuevo) conAgenda().forEach((c) => quienes.add(c.id));
  const h = abrirHoja(html`
    <div class="cabeza-hoja"><div><span class="script">${nuevo ? 'Nuevo' : 'Editar'}</span><h2>${nuevo ? (esCombo ? 'Combo' : 'Servicio') : s.nombre}</h2></div><button class="icono-btn" data-cerrar aria-label="Cerrar">${crudo(ICONOS.cerrar)}</button></div>
    ${nuevo ? '' : html`<div class="pestanas" role="tablist"><button type="button" data-tab="datos" aria-pressed="${pestana === 'datos'}">Datos</button><button type="button" data-tab="galeria" aria-pressed="${pestana === 'galeria'}">Galería de fotos y video</button></div>
    <section data-panel="galeria" ${pestana === 'galeria' ? '' : crudo('hidden')}><div id="editorGaleria"><span class="girando oscuro"></span></div></section>`}
    <form id="formServ" ${pestana === 'galeria' ? crudo('hidden') : ''} data-panel="datos">
      <div class="vista-foto">${s.foto ? html`<img src="${s.foto}" alt="" id="prevFoto" referrerpolicy="no-referrer">` : html`<img alt="" id="prevFoto" hidden>`}</div>
      <label class="campo"><span>Nombre</span><input name="nombre" required maxlength="80" value="${s.nombre}" placeholder="${esCombo ? 'Ej. Combo 1: manos y pies semipermanente' : ''}"></label>
      ${esCombo ? html`<div class="campo"><span>Armar el combo con servicios (calcula duración y precio por separado)</span>
        <div class="chips-serv" id="armarCombo">${S.servicios.filter((x) => x.tipo !== 'combo' && x.visible).map((x) => html`<label class="chip-check"><input type="checkbox" value="${x.id}" ${s.incluye.split('\n').includes(x.nombre) ? crudo('checked') : ''}><span>${x.nombre}</span></label>`)}</div></div>
        <label class="campo"><span>Qué incluye (uno por línea)</span><textarea name="incluye" maxlength="600" rows="3" placeholder="Manicure semipermanente&#10;Pedicure semipermanente">${s.incluye}</textarea></label>` : ''}
      <div class="dos-col">
        <label class="campo"><span>Categoría</span><input name="categoria" list="listaCats" maxlength="40" value="${s.categoria}"></label>
        <label class="campo"><span>Duración (min)</span><input name="duracion" type="number" min="5" max="720" step="5" required value="${s.duracion}"></label>
      </div>
      <datalist id="listaCats">${categorias().map((c) => html`<option value="${c}">`)}</datalist>
      <div class="dos-col">
        <label class="campo"><span>Precio (COP)</span><input name="precio" type="number" inputmode="numeric" min="0" step="1000" value="${s.precio ?? ''}" placeholder="Vacío = a consultar"></label>
        <label class="campo"><span>${esCombo ? 'Precio por separado (tachado)' : 'Precio antes (tachado, opcional)'}</span><input name="precio_antes" type="number" inputmode="numeric" min="0" step="1000" value="${s.precio_antes ?? ''}"></label>
      </div>
      <div class="dos-col">
        <label class="campo"><span>Costo de materiales (COP)</span><input name="costo" type="number" inputmode="numeric" min="0" step="500" value="${s.costo || ''}" placeholder="0">
          <span class="ayuda">Para saber cuánto deja de verdad (Cuentas → utilidad).</span></label>
        <div class="alinear-campo"><label class="interruptor"><input type="checkbox" name="precio_desde" ${s.precio_desde ? crudo('checked') : ''}> Mostrar "desde"</label>
          <label class="interruptor"><input type="checkbox" name="destacado" ${s.destacado ? crudo('checked') : ''}> Destacar en la reserva</label></div>
      </div>
      <label class="campo"><span>Ciclo de retorno (días)</span><input name="ciclo_dias" type="number" min="1" max="365" value="${s.ciclo_dias ?? ''}" placeholder="Ej. 21">
        <span class="ayuda">Cada cuánto suele volver una clienta por este servicio. Se usa en Fidelización para recordarle.</span></label>
      <label class="campo"><span>Descripción</span><textarea name="descripcion" maxlength="500">${s.descripcion}</textarea></label>
      <div class="campo"><span>Foto</span><div class="fila-forzar"><input name="foto" class="input" value="${s.foto}" placeholder="Sube una foto o elige una del spa"><button type="button" class="btn sec chico" id="subirFotoServ">Subir o elegir</button></div></div>
      <div class="campo"><span>¿Quién lo hace?</span>
        <div class="chips-serv">${S.colaboradoras.filter((c) => c.activa && c.agenda).map((c) => html`<label class="chip-check"><input type="checkbox" name="quien" value="${c.id}" ${quienes.has(c.id) ? crudo('checked') : ''}><span>${c.nombre}</span></label>`)}</div>
      </div>
      <div class="dos-col">
        <label class="interruptor"><input type="checkbox" name="visible" ${s.visible ? crudo('checked') : ''}> Visible para reservar</label>
        <label class="campo"><span>Orden</span><input name="orden" type="number" min="0" max="9999" value="${s.orden}"></label>
      </div>
      ${nuevo ? '' : html`<div class="campo"><span>Enlace directo para agendar</span><div class="feed"><code>${enlaceServicio(s)}</code></div><button type="button" class="btn sec chico" id="copiarServ">${crudo(ICONOS.copiar)} Copiar enlace</button></div>`}
      <p class="aviso error" id="errServ" hidden></p>
      <button class="btn bloque" id="guardarServ">Guardar</button>
      ${nuevo ? '' : html`<button type="button" class="btn ghost bloque" id="borrarServ">Eliminar servicio</button>`}
    </form>`);
  const f = $('#formServ', h);
  for (const b of $$('[data-tab]', h)) {
    b.onclick = () => {
      for (const x of $$('[data-tab]', h)) x.setAttribute('aria-pressed', String(x === b));
      for (const p of $$('[data-panel]', h)) p.hidden = p.dataset.panel !== b.dataset.tab;
    };
  }
  if (!nuevo) {
    editorGaleria($('#editorGaleria', h), s.id, {
      alAgregar: async () => {
        const m = await elegirMedio({ video: true, titulo: `Agregar a ${s.nombre}` });
        if (m) {
          try { await agregarAGaleria(s.id, m); toast('Agregada a la galería', 'ok'); } catch (x) { toast(x.message, 'error'); }
        }
        await recargar();
        editar(S.servicios.find((x) => x.id === s.id) || s, v, 'galeria');
      },
    });
  }
  $('#copiarServ', h)?.addEventListener('click', () => copiarEnlace(s));
  $('#subirFotoServ', h).onclick = async () => {
    const m = await elegirMedio({ titulo: `Foto de ${f.nombre.value || 'servicio'}` });
    if (m) { f.foto.value = m.url; const p = $('#prevFoto', h); p.hidden = false; p.src = m.url; }
  };
  // Combo: al marcar servicios se llenan "incluye", duración y precio por separado.
  $('#armarCombo', h)?.addEventListener('change', () => {
    const elegidos = $$('#armarCombo input:checked', h).map((i) => S.servicios.find((x) => x.id === Number(i.value))).filter(Boolean);
    f.incluye.value = elegidos.map((x) => x.nombre).join('\n');
    if (elegidos.length) {
      f.duracion.value = elegidos.reduce((a, x) => a + x.duracion, 0);
      const suma = elegidos.every((x) => x.precio != null) ? elegidos.reduce((a, x) => a + x.precio, 0) : '';
      f.precio_antes.value = suma;
      f.costo.value = elegidos.reduce((a, x) => a + (x.costo || 0), 0) || '';
      // Lo hacen las chicas que hacen todos los servicios del combo
      const pueden = new Set(S.colaboradoras.filter((c) => elegidos.every((x) => c.servicios.includes(x.id))).map((c) => c.id));
      for (const q of $$('[name=quien]', f)) q.checked = pueden.has(Number(q.value));
    }
  });
  f.foto.oninput = () => { const p = $('#prevFoto', h); p.hidden = !f.foto.value; if (f.foto.value.startsWith('https://')) p.src = f.foto.value; };
  f.onsubmit = (e) => {
    e.preventDefault();
    ocupado($('#guardarServ', h), async () => {
      const datos = {
        nombre: f.nombre.value, categoria: f.categoria.value, duracion: Number(f.duracion.value), precio: f.precio.value === '' ? null : Number(f.precio.value),
        precio_antes: f.precio_antes.value === '' ? null : Number(f.precio_antes.value), costo: f.costo.value === '' ? 0 : Number(f.costo.value),
        destacado: f.destacado.checked, tipo: s.tipo, incluye: f.incluye ? f.incluye.value : '',
        precio_desde: f.precio_desde.checked, ciclo_dias: f.ciclo_dias.value === '' ? null : Number(f.ciclo_dias.value), descripcion: f.descripcion.value, foto: f.foto.value, visible: f.visible.checked, orden: Number(f.orden.value || 0),
        colaboradoras: $$('[name=quien]:checked', f).map((x) => Number(x.value)),
      };
      try {
        await api(nuevo ? '/api/panel/servicios' : `/api/panel/servicios/${s.id}`, { metodo: nuevo ? 'POST' : 'PUT', datos });
        toast('Servicio guardado', 'ok');
        cerrarHoja();
        vista(v);
      } catch (x) { $('#errServ', h).textContent = x.message; $('#errServ', h).hidden = false; }
    });
  };
  $('#borrarServ', h)?.addEventListener('click', async () => {
    if (!(await confirmar(`¿Eliminar ${s.nombre}?`, 'Si ya tiene citas, solo se ocultará para conservar el historial.', { si: 'Eliminar', peligro: true }))) return;
    try {
      const r = await api(`/api/panel/servicios/${s.id}`, { metodo: 'DELETE' });
      toast(r.archivado ? 'Tenía citas: quedó oculto.' : 'Servicio eliminado', 'ok');
      vista(v);
    } catch (x) { toast(x.message, 'error'); }
  });
}
