// Clientas: búsqueda, historial y notas.
import { api, html, crudo, pintar, $, $$, toast, ocupado, abrirHoja, cerrarHoja, confirmar, hora, dinero, fechaCorta, celularBonito, inicial, ICONOS } from '/app-citas/js/util.js?v=0059637289';
import { esDuena, puede } from './estado.js?v=0059637289';
import { nuevaCita, pastillaEstado } from './citas.js?v=0059637289';

let pagina = 0, texto = '', filtroEtiqueta = 0;
let ETIQUETAS = [];
const chipEtiqueta = (id) => { const e = ETIQUETAS.find((x) => x.id === id); return e ? html`<span class="etiqueta-cl" data-c="${e.color}">${e.nombre}</span>` : ''; };
function colorear(raiz) { for (const el of raiz.querySelectorAll('[data-c]')) el.style.setProperty('--c', el.dataset.c); }

export async function vista(v) {
  pagina = 0;
  pintar(v, html`
    <header class="cabeza-vista"><div><span class="script">Nuestras</span><h1>Clientas</h1></div></header>
    <div class="buscador"><input class="input" id="buscarClienta" type="search" placeholder="Buscar por nombre o celular" value="${texto}" autocomplete="off"></div>
    <div class="filtro-etiquetas" id="filtroEtiquetas"></div>
    <div id="listaClientas"></div>
    <button class="btn sec bloque" id="masClientas" hidden>Ver más</button>`);
  let t;
  $('#buscarClienta').oninput = (e) => { clearTimeout(t); t = setTimeout(() => { texto = e.target.value.trim(); pagina = 0; cargar(true); }, 250); };
  $('#masClientas').onclick = () => { pagina++; cargar(false); };
  try { ETIQUETAS = (await api('/api/panel/etiquetas')).etiquetas; } catch { ETIQUETAS = []; }
  pintarFiltro(v);
  await cargar(true);
}

function pintarFiltro(v) {
  const caja = $('#filtroEtiquetas', v);
  pintar(caja, html`<button class="chip" data-et="0" aria-pressed="${!filtroEtiqueta}">Todas</button>${ETIQUETAS.map((e) => html`<button class="chip chip-et" data-et="${e.id}" data-c="${e.color}" aria-pressed="${filtroEtiqueta === e.id}">${e.nombre}</button>`)}
    ${esDuena() ? html`<button class="chip" id="gestionarEt">✎ Etiquetas</button>` : ''}`);
  colorear(caja);
  caja.onclick = (e) => {
    if (e.target.closest('#gestionarEt')) return gestionarEtiquetas(() => vista(v));
    const b = e.target.closest('[data-et]');
    if (!b) return;
    filtroEtiqueta = Number(b.dataset.et);
    pintarFiltro(v);
    pagina = 0;
    cargar(true);
  };
}

async function cargar(reemplazar) {
  const lista = $('#listaClientas');
  if (reemplazar) pintar(lista, html`<div class="turnos-cargando"><span class="girando oscuro"></span></div>`);
  const r = await api(`/api/panel/clientas?q=${encodeURIComponent(texto)}&pagina=${pagina}${filtroEtiqueta ? `&etiqueta=${filtroEtiqueta}` : ''}`);
  const filas = html`${r.clientas.map((c) => html`
    <button class="fila-clienta tarjeta" data-id="${c.id}">
      <span class="avatar inicial">${inicial(c.nombre)}</span>
      <span class="fcl-cuerpo"><strong>${c.nombre}</strong><span>${celularBonito(c.celular)}</span>${c.etiquetas.length ? html`<span class="te-pastillas">${c.etiquetas.map(chipEtiqueta)}</span>` : ''}</span>
      <span class="fcl-lado"><strong>${c.citas}</strong><small>${c.citas === 1 ? 'cita' : 'citas'}</small>${c.faltas ? html`<span class="pastilla mal">${c.faltas} falta${c.faltas > 1 ? 's' : ''}</span>` : ''}</span>
    </button>`)}`;
  if (reemplazar) {
    pintar(lista, r.clientas.length ? html`<div class="lista-clientas">${filas}</div>` : html`<div class="vacio">${crudo(ICONOS.usuaria)}<p>${texto ? 'No encontramos clientas con esa búsqueda.' : 'Aún no hay clientas.'}</p></div>`);
  } else {
    $('.lista-clientas', lista).insertAdjacentHTML('beforeend', String(filas));
  }
  colorear(lista);
  $('#masClientas').hidden = !r.hay_mas;
  lista.onclick = (e) => { const b = e.target.closest('[data-id]'); if (b) verClienta(Number(b.dataset.id)); };
}

async function verClienta(id) {
  let d;
  try { d = await api(`/api/panel/clientas/${id}`); } catch (e) { toast(e.message, 'error'); return; }
  const c = d.clienta;
  const asistidas = d.citas.filter((x) => x.estado === 'asistio');
  const gastado = asistidas.reduce((a, x) => a + (x.precio_total || 0), 0);
  const h = abrirHoja(html`
    <div class="cabeza-hoja"><div><span class="script">Clienta</span><h2>${c.nombre}</h2></div><button class="icono-btn" data-cerrar aria-label="Cerrar">${crudo(ICONOS.cerrar)}</button></div>
    <div class="dc-clienta tarjeta">
      <span class="avatar inicial grande">${inicial(c.nombre)}</span>
      <div><strong>${celularBonito(c.celular)}</strong><span class="muted small">Cliente desde ${c.creado.slice(0, 10)}</span></div>
      ${esDuena() ? html`<a class="icono-btn wa-btn" href="https://wa.me/${c.celular}" target="_blank" rel="noopener" aria-label="WhatsApp">${crudo(ICONOS.whatsapp)}</a>` : ''}
    </div>
    ${ETIQUETAS.length ? html`<div class="etiquetas-clienta" id="etiquetasClienta">${ETIQUETAS.map((e) => esDuena()
    ? html`<button type="button" class="chip chip-et" data-et="${e.id}" data-c="${e.color}" aria-pressed="${c.etiquetas.includes(e.id)}">${e.nombre}</button>`
    : (c.etiquetas.includes(e.id) ? chipEtiqueta(e.id) : ''))}</div>` : ''}
    <div class="stats mini">
      <div class="stat"><span>Visitas</span><strong>${asistidas.length}</strong></div>
      <div class="stat"><span>Faltas</span><strong>${d.citas.filter((x) => x.estado === 'no_asistio').length}</strong></div>
      ${esDuena() ? html`<div class="stat"><span>Total</span><strong>${gastado ? dinero(gastado) : '—'}</strong></div>` : ''}
    </div>
    ${d.fidelidad?.visitas ? html`<p class="muted small espacio-arriba">Última visita: <strong>${fechaCorta(d.fidelidad.ultima)}</strong> (hace ${d.fidelidad.dias_sin_venir} días)${d.fidelidad.frecuencia_dias ? html` · viene cada <strong>~${d.fidelidad.frecuencia_dias} días</strong> · le tocaría el ${fechaCorta(d.fidelidad.proxima_estimada)}` : ''}</p>` : ''}
    ${esDuena() ? html`
      <form id="formClienta" class="espacio-arriba">
        <div class="dos-col">
          <label class="campo"><span>Nombre</span><input name="nombre" value="${c.nombre}" maxlength="80"></label>
          <label class="campo"><span>Celular</span><input name="celular" type="tel" value="${c.celular}"></label>
        </div>
        <div class="dos-col">
          <label class="campo"><span>Correo (opcional)</span><input name="email" type="email" value="${c.email}"></label>
          <label class="campo"><span>Cumpleaños</span><input name="cumpleanos" type="date" value="${c.cumpleanos ? `2000-${c.cumpleanos}` : ''}" min="1930-01-01" max="2030-12-31"><span class="ayuda">El año no importa: solo se guarda día y mes.</span></label>
        </div>
        <label class="campo"><span>Preferencias (colores, forma, largo…)</span><input name="preferencias" maxlength="500" value="${c.preferencias || ''}"></label>
        <label class="campo"><span>Notas internas (alergias, gustos…)</span><textarea name="notas" maxlength="1000">${c.notas}</textarea></label>
        <button class="btn sec bloque" id="guardarClienta">Guardar cambios</button>
        <button type="button" class="btn ghost bloque" id="borrarClienta">Eliminar clienta</button>
      </form>` : (c.notas ? html`<p class="aviso info espacio-arriba">${c.notas}</p>` : '')}
    ${puede('gestionar_citas') ? html`<button class="btn bloque espacio-arriba" id="citaClienta">${crudo(ICONOS.mas)} Nueva cita para ${c.nombre.split(' ')[0]}</button>` : ''}
    <h3 class="espacio-arriba">Historial</h3>
    <div class="historial">${d.citas.length ? d.citas.map((x) => html`
      <div class="fila-historial"><span><strong>${fechaCorta(x.fecha)}</strong><small>${hora(x.inicio)} · ${x.colaboradora}</small></span>
      <span class="fh-serv">${x.servicios || ''}</span>${pastillaEstado(x.estado)}</div>`) : html`<p class="muted">Sin citas.</p>`}</div>`);
  $('#formClienta', h)?.addEventListener('submit', (e) => {
    e.preventDefault();
    ocupado($('#guardarClienta', h), async () => {
      try {
        await api(`/api/panel/clientas/${c.id}`, { metodo: 'PUT', datos: Object.fromEntries(new FormData(e.target)) });
        toast('Clienta actualizada', 'ok');
        cerrarHoja();
        cargar(true);
      } catch (x) { toast(x.message, 'error'); }
    });
  });
  $('#etiquetasClienta', h)?.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-et]');
    if (!b || !esDuena()) return;
    b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'));
    const ids = $$('[data-et][aria-pressed="true"]', h).map((x) => Number(x.dataset.et));
    try { await api(`/api/panel/clientas/${c.id}/etiquetas`, { metodo: 'PUT', datos: { ids } }); c.etiquetas = ids; cargar(true); } catch (x) { toast(x.message, 'error'); }
  });
  colorear(h);
  $('#borrarClienta', h)?.addEventListener('click', async () => {
    if (!(await confirmar(`¿Eliminar a ${c.nombre}?`, d.citas.length ? 'Tiene historial: se borran sus datos personales (nombre, celular, notas) y se cancelan sus citas futuras. Los cobros pasados se conservan en las cuentas.' : 'Se borra por completo.', { si: 'Eliminar', peligro: true }))) return;
    try { await api(`/api/panel/clientas/${c.id}`, { metodo: 'DELETE' }); toast('Clienta eliminada', 'ok'); cerrarHoja(); cargar(true); } catch (x) { toast(x.message, 'error'); }
  });
  $('#citaClienta', h)?.addEventListener('click', () => { cerrarHoja(true); nuevaCita({ clienta: c }, () => verClienta(c.id)); });
}

function gestionarEtiquetas(listo) {
  const h = abrirHoja(html`
    <div class="cabeza-hoja"><div><span class="script">Clientas</span><h2>Etiquetas</h2></div><button class="icono-btn" data-cerrar aria-label="Cerrar">${crudo(ICONOS.cerrar)}</button></div>
    <p class="muted small">Etiquetas privadas para el equipo (las clientas nunca las ven). Ej.: buena clienta, mala paga, grosera, VIP.</p>
    <div class="lista-categorias">${ETIQUETAS.map((e) => html`
      <form class="fila-categoria" data-id="${e.id}">
        <input type="color" name="color" value="${e.color}" aria-label="Color">
        <input class="input" name="nombre" value="${e.nombre}" maxlength="30" aria-label="Nombre">
        <button class="btn sec chico">Guardar</button>
        <button type="button" class="icono-btn chico" data-borrar-et="${e.id}" aria-label="Borrar">${crudo(ICONOS.cerrar)}</button>
      </form>`)}</div>
    <form id="nuevaEt" class="fila-categoria espacio-arriba">
      <input type="color" name="color" value="#A98BBE" aria-label="Color"><input class="input" name="nombre" placeholder="Nueva etiqueta" maxlength="30" required aria-label="Nueva etiqueta">
      <button class="btn chico">Agregar</button>
    </form>`, { alCerrar: listo });
  for (const f of $$('.fila-categoria[data-id]', h)) {
    f.onsubmit = async (e) => {
      e.preventDefault();
      try { await api(`/api/panel/etiquetas/${f.dataset.id}`, { metodo: 'PUT', datos: { nombre: f.nombre.value, color: f.color.value } }); toast('Etiqueta guardada', 'ok'); } catch (x) { toast(x.message, 'error'); }
    };
  }
  h.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-borrar-et]');
    if (!b) return;
    try { await api(`/api/panel/etiquetas/${b.dataset.borrarEt}`, { metodo: 'DELETE' }); b.closest('form').remove(); } catch (x) { toast(x.message, 'error'); }
  });
  $('#nuevaEt', h).onsubmit = async (e) => {
    e.preventDefault();
    try { await api('/api/panel/etiquetas', { metodo: 'POST', datos: { nombre: e.target.nombre.value, color: e.target.color.value } }); cerrarHoja(); } catch (x) { toast(x.message, 'error'); }
  };
}
