// Clientas: búsqueda, historial y notas.
import { api, html, crudo, pintar, $, toast, ocupado, abrirHoja, cerrarHoja, hora, dinero, fechaCorta, celularBonito, inicial, ICONOS } from '/app-citas/js/util.js?v=9cba0f01ac';
import { esDuena, puede } from './estado.js?v=9cba0f01ac';
import { nuevaCita, pastillaEstado } from './citas.js?v=9cba0f01ac';

let pagina = 0, texto = '';

export async function vista(v) {
  pagina = 0;
  pintar(v, html`
    <header class="cabeza-vista"><div><span class="script">Nuestras</span><h1>Clientas</h1></div></header>
    <div class="buscador"><input class="input" id="buscarClienta" type="search" placeholder="Buscar por nombre o celular" value="${texto}" autocomplete="off"></div>
    <div id="listaClientas"></div>
    <button class="btn sec bloque" id="masClientas" hidden>Ver más</button>`);
  let t;
  $('#buscarClienta').oninput = (e) => { clearTimeout(t); t = setTimeout(() => { texto = e.target.value.trim(); pagina = 0; cargar(true); }, 250); };
  $('#masClientas').onclick = () => { pagina++; cargar(false); };
  await cargar(true);
}

async function cargar(reemplazar) {
  const lista = $('#listaClientas');
  if (reemplazar) pintar(lista, html`<div class="turnos-cargando"><span class="girando oscuro"></span></div>`);
  const r = await api(`/api/panel/clientas?q=${encodeURIComponent(texto)}&pagina=${pagina}`);
  const filas = html`${r.clientas.map((c) => html`
    <button class="fila-clienta tarjeta" data-id="${c.id}">
      <span class="avatar inicial">${inicial(c.nombre)}</span>
      <span class="fcl-cuerpo"><strong>${c.nombre}</strong><span>${celularBonito(c.celular)}</span></span>
      <span class="fcl-lado"><strong>${c.citas}</strong><small>${c.citas === 1 ? 'cita' : 'citas'}</small>${c.faltas ? html`<span class="pastilla mal">${c.faltas} falta${c.faltas > 1 ? 's' : ''}</span>` : ''}</span>
    </button>`)}`;
  if (reemplazar) {
    pintar(lista, r.clientas.length ? html`<div class="lista-clientas">${filas}</div>` : html`<div class="vacio">${crudo(ICONOS.usuaria)}<p>${texto ? 'No encontramos clientas con esa búsqueda.' : 'Aún no hay clientas.'}</p></div>`);
  } else {
    $('.lista-clientas', lista).insertAdjacentHTML('beforeend', String(filas));
  }
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
    <div class="stats mini">
      <div class="stat"><span>Visitas</span><strong>${asistidas.length}</strong></div>
      <div class="stat"><span>Faltas</span><strong>${d.citas.filter((x) => x.estado === 'no_asistio').length}</strong></div>
      ${esDuena() ? html`<div class="stat"><span>Total</span><strong>${gastado ? dinero(gastado) : '—'}</strong></div>` : ''}
    </div>
    ${esDuena() ? html`
      <form id="formClienta" class="espacio-arriba">
        <div class="dos-col">
          <label class="campo"><span>Nombre</span><input name="nombre" value="${c.nombre}" maxlength="80"></label>
          <label class="campo"><span>Celular</span><input name="celular" type="tel" value="${c.celular}"></label>
        </div>
        <div class="dos-col">
          <label class="campo"><span>Correo (opcional)</span><input name="email" type="email" value="${c.email}"></label>
          <label class="campo"><span>Cumpleaños (MM-DD)</span><input name="cumpleanos" value="${c.cumpleanos || ''}" placeholder="03-15" maxlength="5"></label>
        </div>
        <label class="campo"><span>Preferencias (colores, forma, largo…)</span><input name="preferencias" maxlength="500" value="${c.preferencias || ''}"></label>
        <label class="campo"><span>Notas internas (alergias, gustos…)</span><textarea name="notas" maxlength="1000">${c.notas}</textarea></label>
        <button class="btn sec bloque" id="guardarClienta">Guardar cambios</button>
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
  $('#citaClienta', h)?.addEventListener('click', () => { cerrarHoja(true); nuevaCita({ clienta: c }, () => verClienta(c.id)); });
}
