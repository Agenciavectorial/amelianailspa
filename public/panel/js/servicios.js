// Servicios (solo Erika): catálogo con foto, precio, duración, quién lo hace y visibilidad.
import { api, html, crudo, pintar, $, $$, toast, ocupado, confirmar, abrirHoja, cerrarHoja, duracion, dinero, ICONOS } from '/app-citas/js/util.js';
import { S, recargar, categorias, conAgenda } from './estado.js';

export async function vista(v) {
  await recargar();
  const cats = categorias();
  pintar(v, html`
    <header class="cabeza-vista">
      <div><span class="script">Catálogo</span><h1>Servicios</h1></div>
      <button class="btn chico" id="nuevoServ">${crudo(ICONOS.mas)} Servicio</button>
    </header>
    ${cats.map((cat) => html`
      <section class="bloque-inicio">
        <h2>${cat}</h2>
        <div class="lista-servicios-panel">
          ${S.servicios.filter((s) => s.categoria === cat).map((s) => html`
            <button class="fila-servicio tarjeta ${s.visible ? '' : 'oculto'}" data-id="${s.id}">
              <span class="fs-foto">${s.foto ? html`<img src="${s.foto}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}</span>
              <span class="fs-cuerpo"><strong>${s.nombre}</strong><span>${duracion(s.duracion)} · ${s.precio != null ? (s.precio_desde ? 'desde ' : '') + dinero(s.precio) : 'precio a consultar'}</span></span>
              ${s.visible ? '' : html`<span class="pastilla aviso">Oculto</span>`}
            </button>`)}
        </div>
      </section>`)}`);
  $('#nuevoServ').onclick = () => editar(null, v);
  v.onclick = (e) => { const b = e.target.closest('.fila-servicio'); if (b) editar(S.servicios.find((s) => s.id === Number(b.dataset.id)), v); };
}

function editar(s, v) {
  const nuevo = !s;
  s = s || { nombre: '', categoria: categorias()[0] || 'Uñas', descripcion: '', foto: '', precio: null, precio_desde: 0, duracion: 60, visible: 1, orden: 100 };
  const quienes = new Set(S.colaboradoras.filter((c) => c.servicios.includes(s.id)).map((c) => c.id));
  if (nuevo) conAgenda().forEach((c) => quienes.add(c.id));
  const h = abrirHoja(html`
    <div class="cabeza-hoja"><div><span class="script">${nuevo ? 'Nuevo' : 'Editar'}</span><h2>${nuevo ? 'Servicio' : s.nombre}</h2></div><button class="icono-btn" data-cerrar aria-label="Cerrar">${crudo(ICONOS.cerrar)}</button></div>
    <form id="formServ">
      <div class="vista-foto">${s.foto ? html`<img src="${s.foto}" alt="" id="prevFoto" referrerpolicy="no-referrer">` : html`<img alt="" id="prevFoto" hidden>`}</div>
      <label class="campo"><span>Nombre</span><input name="nombre" required maxlength="80" value="${s.nombre}"></label>
      <div class="dos-col">
        <label class="campo"><span>Categoría</span><input name="categoria" list="listaCats" maxlength="40" value="${s.categoria}"></label>
        <label class="campo"><span>Duración (min)</span><input name="duracion" type="number" min="5" max="720" step="5" required value="${s.duracion}"></label>
      </div>
      <datalist id="listaCats">${categorias().map((c) => html`<option value="${c}">`)}</datalist>
      <div class="dos-col">
        <label class="campo"><span>Precio (COP)</span><input name="precio" type="number" min="0" step="1000" value="${s.precio ?? ''}" placeholder="Vacío = a consultar"></label>
        <label class="interruptor alinear-campo"><input type="checkbox" name="precio_desde" ${s.precio_desde ? crudo('checked') : ''}> Mostrar "desde"</label>
      </div>
      <label class="campo"><span>Descripción</span><textarea name="descripcion" maxlength="500">${s.descripcion}</textarea></label>
      <label class="campo"><span>Foto (enlace https, ej. Cloudinary)</span><input name="foto" type="url" value="${s.foto}" placeholder="https://res.cloudinary.com/..."></label>
      <div class="campo"><span>¿Quién lo hace?</span>
        <div class="chips-serv">${S.colaboradoras.filter((c) => c.activa && c.agenda).map((c) => html`<label class="chip-check"><input type="checkbox" name="quien" value="${c.id}" ${quienes.has(c.id) ? crudo('checked') : ''}><span>${c.nombre}</span></label>`)}</div>
      </div>
      <div class="dos-col">
        <label class="interruptor"><input type="checkbox" name="visible" ${s.visible ? crudo('checked') : ''}> Visible para reservar</label>
        <label class="campo"><span>Orden</span><input name="orden" type="number" min="0" max="9999" value="${s.orden}"></label>
      </div>
      <p class="aviso error" id="errServ" hidden></p>
      <button class="btn bloque" id="guardarServ">Guardar</button>
      ${nuevo ? '' : html`<button type="button" class="btn ghost bloque" id="borrarServ">Eliminar servicio</button>`}
    </form>`);
  const f = $('#formServ', h);
  f.foto.oninput = () => { const p = $('#prevFoto', h); p.hidden = !f.foto.value; if (f.foto.value.startsWith('https://')) p.src = f.foto.value; };
  f.onsubmit = (e) => {
    e.preventDefault();
    ocupado($('#guardarServ', h), async () => {
      const datos = {
        nombre: f.nombre.value, categoria: f.categoria.value, duracion: Number(f.duracion.value), precio: f.precio.value === '' ? null : Number(f.precio.value),
        precio_desde: f.precio_desde.checked, descripcion: f.descripcion.value, foto: f.foto.value, visible: f.visible.checked, orden: Number(f.orden.value || 0),
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
