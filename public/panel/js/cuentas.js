// Cuentas: reemplaza el Excel de Erika.
// - Erika: ingresos por día/semana/mes, por servicio y por chica, ticket promedio, servicio más rentable, gastos con
//   categorías y alerta de gastos hormiga, comisiones, metas de ahorro/inversión y deudas con cuotas.
// - Cada chica: SOLO lo suyo (servicios de hoy, de la semana y del mes, y cuánto gana).
import { api, html, crudo, pintar, $, $$, toast, ocupado, confirmar, abrirHoja, cerrarHoja, dinero, fechaCorta, sumarDias, ICONOS } from '/app-citas/js/util.js?v=0059637289';
import { S, esDuena, puede } from './estado.js?v=0059637289';

export const METODOS = { efectivo: 'Efectivo', nequi: 'Nequi', daviplata: 'Daviplata', tarjeta: 'Tarjeta', transferencia: 'Transferencia', otro: 'Otro' };
const PESTANAS = [['resumen', 'Resumen'], ['movimientos', 'Ventas'], ['gastos', 'Gastos'], ['comisiones', 'Comisiones'], ['metas', 'Metas'], ['deudas', 'Deudas']];

let pestana = 'resumen';
let rango = 'mes';

function rangos() {
  const hoy = S.hoy;
  const ini = hoy.slice(0, 8) + '01';
  const d = new Date(ini + 'T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() - 1);
  const lunes = sumarDias(hoy, -((new Date(hoy + 'T12:00:00Z').getUTCDay() + 6) % 7));
  return [
    ['hoy', 'Hoy', hoy, hoy, 'dia'],
    ['semana', 'Semana', lunes, hoy, 'dia'],
    ['mes', 'Mes', ini, hoy, 'dia'],
    ['anterior', 'Mes pasado', d.toISOString().slice(0, 10), sumarDias(ini, -1), 'dia'],
    ['90', '3 meses', sumarDias(hoy, -89), hoy, 'semana'],
    ['anio', 'Año', hoy.slice(0, 4) + '-01-01', hoy, 'mes'],
  ];
}

/** Anchos y altos de las barras (la CSP no deja usar style en el HTML). */
function estilos(raiz) {
  for (const el of raiz.querySelectorAll('[data-w]')) el.style.width = el.dataset.w;
  for (const el of raiz.querySelectorAll('[data-h]')) el.style.height = el.dataset.h;
  for (const el of raiz.querySelectorAll('[data-c]')) el.style.setProperty('--c', el.dataset.c);
}
const pct = (n, max) => `${Math.max(n > 0 ? 3 : 0, Math.round((Math.max(0, n) / Math.max(1, max)) * 100))}%`;
const etiquetaPeriodo = (p, agrupar) => {
  if (agrupar === 'mes') { const [y, m] = p.split('-'); return ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][Number(m) - 1] + (y !== S.hoy.slice(0, 4) ? ` ${y.slice(2)}` : ''); }
  if (agrupar === 'semana') return 'sem ' + fechaCorta(p).replace(/^\S+ /, '');
  return fechaCorta(p).replace(/ \S+$/, '').replace(/^(\S+) /, '$1 ');
};

/** Columnas por periodo. Una o dos series (ingresos y gastos) en el mismo eje de pesos, con leyenda y valor al tocar. */
function grafica(serie, { agrupar, gastos = false }) {
  if (!serie.length) return html`<p class="muted">Aún no hay movimientos en este rango.</p>`;
  const max = Math.max(1, ...serie.map((x) => Math.max(x.ingresos, gastos ? x.gastos : 0)));
  const muchas = serie.length > 14;
  return html`
    ${gastos ? html`<div class="leyenda"><span><i class="ley ing"></i>Ingresos</span><span><i class="ley gas"></i>Gastos</span></div>` : ''}
    <div class="columnas-cuentas ${muchas ? 'densa' : ''}" role="img" aria-label="Ingresos${gastos ? ' y gastos' : ''} por ${agrupar}">
      ${serie.map((x, i) => html`<button type="button" class="cc-col" data-valor="${etiquetaPeriodo(x.periodo, agrupar)}: ingresos ${dinero(x.ingresos)}${gastos ? ` · gastos ${dinero(x.gastos)}` : ''}" title="${etiquetaPeriodo(x.periodo, agrupar)}: ${dinero(x.ingresos)}">
        <span class="cc-barras"><span class="cc-ing" data-h="${pct(x.ingresos, max)}"></span>${gastos ? html`<span class="cc-gas" data-h="${pct(x.gastos, max)}"></span>` : ''}</span>
        <small>${!muchas || i % Math.ceil(serie.length / 10) === 0 ? etiquetaPeriodo(x.periodo, agrupar) : crudo('&nbsp;')}</small>
      </button>`)}
    </div>
    <p class="muted small">Máximo: ${dinero(max)} · toca una barra para ver el valor.</p>`;
}

function barras(lista, { valor, nombre, detalle, color }) {
  if (!lista.length) return html`<p class="muted">Sin datos en este rango.</p>`;
  const max = Math.max(1, ...lista.map(valor));
  return lista.map((x) => html`<div class="barra-fila"><span class="bf-nombre">${nombre(x)}</span>
    <span class="bf-barra"><span ${color ? html`data-c="${color(x)}"` : ''} data-w="${pct(valor(x), max)}"></span></span>
    <span class="bf-valor"><strong>${dinero(valor(x))}</strong><small>${detalle(x)}</small></span></div>`);
}

export async function vista(v) {
  const r = rangos().find((x) => x[0] === rango) || rangos()[2];
  pintar(v, html`
    <header class="cabeza-vista">
      <div><span class="script">${esDuena() ? 'Tu negocio' : 'Lo tuyo'}</span><h1>Cuentas</h1></div>
      ${puede('gestionar_citas') ? html`<button class="btn chico" id="nuevaVenta">${crudo(ICONOS.mas)} Venta</button>` : ''}
    </header>
    ${esDuena() ? html`<div class="pestanas" role="tablist">${PESTANAS.map(([k, t]) => html`<button data-pest="${k}" aria-pressed="${k === pestana}">${t}</button>`)}</div>` : ''}
    ${!esDuena() || ['resumen', 'movimientos', 'gastos'].includes(pestana) ? html`<div class="segmentado ancho rango-analitica">${rangos().map(([k, t]) => html`<button data-rango="${k}" aria-pressed="${k === rango}">${t}</button>`)}</div>` : ''}
    <div id="cuentas"><div class="turnos-cargando"><span class="girando oscuro"></span></div></div>`);
  for (const b of $$('[data-pest]', v)) b.onclick = () => { pestana = b.dataset.pest; vista(v); };
  for (const b of $$('[data-rango]', v)) b.onclick = () => { rango = b.dataset.rango; vista(v); };
  $('#nuevaVenta', v)?.addEventListener('click', () => nuevaVenta(() => vista(v)));
  const caja = $('#cuentas', v);
  caja.addEventListener('click', (e) => { const b = e.target.closest('[data-valor]'); if (b) toast(b.dataset.valor); });
  if (!esDuena()) return vistaChica(caja, r, v);
  const fn = { resumen: vistaResumen, movimientos: vistaMovimientos, gastos: vistaGastos, comisiones: vistaComisiones, metas: vistaMetas, deudas: vistaDeudas }[pestana];
  await fn(caja, r, v);
  estilos(caja);
}

// ---------- vista de cada chica ----------
async function vistaChica(caja, [, , desde, hasta, agrupar], v) {
  const d = await api(`/api/panel/cuentas?desde=${desde}&hasta=${hasta}&agrupar=${agrupar}`);
  const tile = (t, x, dest) => html`<div class="stat ${dest ? 'destacado' : ''}"><span>${t}</span><strong>${dinero(x.comision + x.propinas)}</strong>
    <small>${x.servicios} servicio${x.servicios === 1 ? '' : 's'}${x.propinas ? ` · ${dinero(x.propinas)} propinas` : ''}</small></div>`;
  pintar(caja, html`
    <div class="stats">
      ${tile('Ganas hoy', d.dia, true)}${tile('Esta semana', d.semana)}${tile('Este mes', d.mes)}
      <div class="stat"><span>Tu comisión</span><strong>${d.comision_pct}%</strong><small>la define Erika por servicio</small></div>
    </div>
    <section class="tarjeta bloque-ajustes"><h2>Lo que vendiste</h2>${grafica(d.serie, { agrupar })}</section>
    <section class="tarjeta bloque-ajustes espacio-arriba"><h2>Tus servicios <span class="muted">${d.rango.servicios} · ganas ${dinero(d.rango.comision + d.rango.propinas)}</span></h2>
      ${listaMovimientos(d.movimientos, { propia: true })}</section>
    <p class="muted small espacio-arriba">Ves solo tus servicios y tu comisión. Si algo no cuadra, díselo a Erika.</p>`);
  estilos(caja);
  activarBorrar(caja, d.movimientos, v);
}

function listaMovimientos(l, { propia = false } = {}) {
  if (!l.length) return html`<div class="vacio chico">${crudo(ICONOS.chispa)}<p>Sin ventas en este rango.</p></div>`;
  return html`<div class="lista-mov">${l.map((m, i) => html`
    <div class="fila-mov">
      <span class="fm-fecha"><strong>${fechaCorta(m.fecha).replace(/ \S+$/, '')}</strong><small>${m.tipo === 'venta' ? 'Venta' : 'Cita'}</small></span>
      <span class="fm-cuerpo"><strong>${m.concepto}</strong><span>${[m.clienta, !propia && m.colaboradora, METODOS[m.metodo]].filter(Boolean).join(' · ')}</span></span>
      <span class="fm-valor"><strong>${dinero(m.monto)}</strong><small>${propia ? `ganas ${dinero(m.comision + (m.propina || 0))}` : `comisión ${dinero(m.comision)}`}${m.propina ? ` · +${dinero(m.propina)} propina` : ''}</small></span>
      ${esDuena() || (m.tipo === 'venta' && m.fecha === S.hoy) ? html`<button class="icono-btn chico" data-borrar="${i}" aria-label="Borrar">${crudo(ICONOS.cerrar)}</button>` : ''}
    </div>`)}</div>`;
}

function activarBorrar(caja, l, v) {
  for (const b of $$('[data-borrar]', caja)) {
    b.onclick = async (e) => {
      e.stopPropagation();
      const m = l[Number(b.dataset.borrar)];
      if (!(await confirmar(m.tipo === 'venta' ? '¿Borrar esta venta?' : '¿Borrar este cobro?', `${m.concepto} · ${dinero(m.monto)}. ${m.tipo === 'cobro' ? 'La cita queda sin cobrar.' : ''}`, { si: 'Borrar', peligro: true }))) return;
      try { await api(m.tipo === 'venta' ? `/api/panel/ventas/${m.id}` : `/api/panel/cobros/${m.id}`, { metodo: 'DELETE' }); toast('Borrado'); vista(v); } catch (x) { toast(x.message, 'error'); }
    };
  }
}

// ---------- Erika: resumen ----------
async function vistaResumen(caja, [, , desde, hasta, agrupar]) {
  const d = await api(`/api/panel/cuentas?desde=${desde}&hasta=${hasta}&agrupar=${agrupar}`);
  const h = d.hormiga;
  pintar(caja, html`
    <div class="stats">
      <div class="stat destacado"><span>Ingresos</span><strong>${dinero(d.ingresos)}</strong><small>${d.tickets} venta${d.tickets === 1 ? '' : 's'}${d.propinas ? ` · +${dinero(d.propinas)} propinas` : ''}</small></div>
      <div class="stat"><span>Gastos</span><strong>${dinero(d.gastos)}</strong><small>${d.lista_gastos.length} registro${d.lista_gastos.length === 1 ? '' : 's'}</small></div>
      <div class="stat"><span>Comisiones</span><strong>${dinero(d.comisiones)}</strong><small>a pagar al equipo</small></div>
      <div class="stat ${d.utilidad < 0 ? 'negativo' : ''}"><span>Te queda (utilidad)</span><strong>${dinero(d.utilidad)}</strong><small>ingresos − comisiones − materiales − gastos</small></div>
      <div class="stat"><span>Ticket promedio</span><strong>${d.tickets ? dinero(d.ticket_promedio) : '—'}</strong><small>por clienta atendida</small></div>
      <div class="stat"><span>Más rentable</span><strong class="stat-texto">${d.mas_rentable ? d.mas_rentable.nombre : '—'}</strong><small>${d.mas_rentable ? `deja ${dinero(d.mas_rentable.utilidad)} libres` : 'registra cobros para verlo'}</small></div>
    </div>
    ${h.alerta ? html`<p class="aviso espacio-abajo" role="alert">🐜 <strong>Gastos hormiga:</strong> ${h.cantidad} gastos pequeños (de ${dinero(h.umbral)} o menos) suman <strong>${dinero(h.total)}</strong> en este rango.${h.top.length ? ` Lo que más pesa: ${h.top.slice(0, 3).map((x) => `${x.concepto} (${x.veces}×, ${dinero(x.total)})`).join(', ')}.` : ''}</p>` : ''}
    <section class="tarjeta bloque-ajustes"><h2>Ingresos y gastos <span class="muted">por ${d.agrupar === 'dia' ? 'día' : d.agrupar}</span></h2>${grafica(d.serie, { agrupar: d.agrupar, gastos: true })}</section>
    <div class="rejilla-analitica espacio-arriba">
      <section class="tarjeta bloque-ajustes"><h2>Por servicio</h2>
        ${barras(d.servicios.slice(0, 10), { valor: (x) => x.ingresos, nombre: (x) => x.nombre, detalle: (x) => `${x.cantidad}× · utilidad ${dinero(x.utilidad)}` })}
        <p class="muted small">Utilidad = lo cobrado − comisión − costo de materiales (se pone en cada servicio).</p></section>
      <section class="tarjeta bloque-ajustes"><h2>Por chica</h2>
        ${barras(d.chicas, { valor: (x) => x.ingresos, nombre: (x) => x.nombre, color: (x) => x.color, detalle: (x) => `${x.servicios} serv. · gana ${dinero(x.comision + x.propinas)}` })}</section>
      <section class="tarjeta bloque-ajustes"><h2>Métodos de pago</h2>
        ${barras(d.metodos, { valor: (x) => x.total, nombre: (x) => METODOS[x.metodo] || x.metodo, detalle: () => '' })}</section>
      <section class="tarjeta bloque-ajustes"><h2>Gastos por categoría</h2>
        ${barras(d.gastos_categorias, { valor: (x) => x.total, nombre: (x) => x.categoria, color: (x) => x.color, detalle: (x) => `${x.n} gasto${x.n === 1 ? '' : 's'}` })}</section>
    </div>`);
}

// ---------- Erika: ventas ----------
async function vistaMovimientos(caja, [, , desde, hasta], v) {
  const d = await api(`/api/panel/cuentas?desde=${desde}&hasta=${hasta}`);
  pintar(caja, html`<p class="muted small espacio-abajo">${d.movimientos.length} movimiento${d.movimientos.length === 1 ? '' : 's'} · ${dinero(d.ingresos)}. Los cobros de citas se registran con "Cobrar" en la cita; las ventas sin cita, con el botón "+ Venta".</p>
    ${listaMovimientos(d.movimientos)}`);
  activarBorrar(caja, d.movimientos, v);
}

// ---------- Erika: gastos ----------
async function vistaGastos(caja, [, , desde, hasta], v) {
  const [d, { categorias }] = await Promise.all([api(`/api/panel/cuentas?desde=${desde}&hasta=${hasta}`), api('/api/panel/gasto-categorias')]);
  pintar(caja, html`
    <div class="fila-botones espacio-abajo"><button class="btn" id="nuevoGasto">${crudo(ICONOS.mas)} Gasto</button><button class="btn sec" id="categorias">Categorías</button></div>
    ${d.hormiga.cantidad ? html`<p class="aviso ${d.hormiga.alerta ? '' : 'info'} espacio-abajo">🐜 Gastos pequeños (≤ ${dinero(d.hormiga.umbral)}): ${d.hormiga.cantidad} por ${dinero(d.hormiga.total)}.${d.hormiga.alerta ? ' ¡Ojo, ya pesan!' : ''}</p>` : ''}
    ${d.lista_gastos.length ? html`<div class="lista-mov">${d.lista_gastos.map((g) => html`
      <button class="fila-mov" data-gasto="${g.id}">
        <span class="fm-fecha"><strong>${fechaCorta(g.fecha).replace(/ \S+$/, '')}</strong></span>
        <span class="fm-cuerpo"><strong>${g.concepto}</strong><span><i class="punto" data-c="${g.color || '#9C8FA8'}"></i>${g.categoria || 'Sin categoría'} · ${METODOS[g.metodo] || g.metodo}</span></span>
        <span class="fm-valor"><strong>${dinero(g.monto)}</strong></span>
      </button>`)}</div>` : html`<div class="vacio chico">${crudo(ICONOS.chispa)}<p>Sin gastos en este rango.</p></div>`}`);
  estilos(caja);
  $('#nuevoGasto', caja).onclick = () => editarGasto(null, categorias, () => vista(v));
  $('#categorias', caja).onclick = () => editarCategorias(categorias, () => vista(v));
  for (const b of $$('[data-gasto]', caja)) b.onclick = () => editarGasto(d.lista_gastos.find((g) => g.id === Number(b.dataset.gasto)), categorias, () => vista(v));
}

function opcionesMetodo(sel = 'efectivo') {
  return Object.entries(METODOS).map(([k, t]) => html`<option value="${k}" ${k === sel ? crudo('selected') : ''}>${t}</option>`);
}

function editarGasto(g, categorias, listo) {
  const nuevo = !g;
  g = g || { fecha: S.hoy, concepto: '', monto: '', metodo: 'efectivo', categoria_id: categorias[0]?.id, nota: '' };
  const h = abrirHoja(html`
    <div class="cabeza-hoja"><div><span class="script">${nuevo ? 'Nuevo' : 'Editar'}</span><h2>Gasto</h2></div><button class="icono-btn" data-cerrar aria-label="Cerrar">${crudo(ICONOS.cerrar)}</button></div>
    <form id="formGasto">
      <label class="campo"><span>¿En qué se gastó?</span><input name="concepto" required maxlength="120" value="${g.concepto}" placeholder="Ej. Esmaltes, arriendo, tinto…"></label>
      <div class="dos-col">
        <label class="campo"><span>Valor (COP)</span><input name="monto" type="number" inputmode="numeric" min="1" step="100" required value="${g.monto}"></label>
        <label class="campo"><span>Fecha</span><input name="fecha" type="date" required value="${g.fecha}" max="${S.hoy}"></label>
      </div>
      <div class="dos-col">
        <label class="campo"><span>Categoría</span><select name="categoria_id">${categorias.filter((c) => c.activa || c.id === g.categoria_id).map((c) => html`<option value="${c.id}" ${c.id === g.categoria_id ? crudo('selected') : ''}>${c.nombre}</option>`)}</select></label>
        <label class="campo"><span>Cómo se pagó</span><select name="metodo">${opcionesMetodo(g.metodo)}</select></label>
      </div>
      <label class="campo"><span>Nota (opcional)</span><input name="nota" maxlength="300" value="${g.nota || ''}"></label>
      <p class="aviso error" hidden id="errGasto"></p>
      <button class="btn bloque espacio-arriba" id="guardarGasto">Guardar</button>
      ${nuevo ? '' : html`<button type="button" class="btn ghost bloque" id="borrarGasto">Eliminar</button>`}
    </form>`, { historial: true });
  $('#formGasto', h).onsubmit = (e) => {
    e.preventDefault();
    ocupado($('#guardarGasto', h), async () => {
      try {
        await api(nuevo ? '/api/panel/gastos' : `/api/panel/gastos/${g.id}`, { metodo: nuevo ? 'POST' : 'PUT', datos: Object.fromEntries(new FormData(e.target)) });
        toast('Gasto guardado', 'ok'); cerrarHoja(); listo();
      } catch (x) { $('#errGasto', h).textContent = x.message; $('#errGasto', h).hidden = false; }
    });
  };
  $('#borrarGasto', h)?.addEventListener('click', async () => {
    if (!(await confirmar('¿Eliminar el gasto?', `${g.concepto} · ${dinero(g.monto)}`, { si: 'Eliminar', peligro: true }))) return;
    try { await api(`/api/panel/gastos/${g.id}`, { metodo: 'DELETE' }); listo(); } catch (x) { toast(x.message, 'error'); }
  });
}

function editarCategorias(categorias, listo) {
  const h = abrirHoja(html`
    <div class="cabeza-hoja"><div><span class="script">Gastos</span><h2>Categorías</h2></div><button class="icono-btn" data-cerrar aria-label="Cerrar">${crudo(ICONOS.cerrar)}</button></div>
    <div class="lista-categorias">${categorias.map((c) => html`
      <form class="fila-categoria" data-id="${c.id}">
        <input type="color" name="color" value="${c.color}" aria-label="Color">
        <input class="input" name="nombre" value="${c.nombre}" maxlength="40" aria-label="Nombre">
        <label class="check"><input type="checkbox" name="activa" ${c.activa ? crudo('checked') : ''}><span>Activa</span></label>
        <button class="btn sec chico">Guardar</button>
      </form>`)}</div>
    <form id="nuevaCat" class="fila-categoria espacio-arriba">
      <input type="color" name="color" value="#A98BBE" aria-label="Color"><input class="input" name="nombre" placeholder="Nueva categoría" maxlength="40" required aria-label="Nueva categoría">
      <button class="btn chico">Agregar</button>
    </form>`, { alCerrar: listo });
  for (const f of $$('.fila-categoria[data-id]', h)) {
    f.onsubmit = async (e) => {
      e.preventDefault();
      try { await api(`/api/panel/gasto-categorias/${f.dataset.id}`, { metodo: 'PUT', datos: { nombre: f.nombre.value, color: f.color.value, activa: f.activa.checked } }); toast('Categoría guardada', 'ok'); } catch (x) { toast(x.message, 'error'); }
    };
  }
  $('#nuevaCat', h).onsubmit = async (e) => {
    e.preventDefault();
    try { await api('/api/panel/gasto-categorias', { metodo: 'POST', datos: { nombre: e.target.nombre.value, color: e.target.color.value } }); cerrarHoja(); } catch (x) { toast(x.message, 'error'); }
  };
}

// ---------- Erika: comisiones ----------
async function vistaComisiones(caja, _r, v) {
  const { colaboradoras } = await api('/api/panel/comisiones');
  const servs = S.servicios.filter((s) => s.visible);
  pintar(caja, html`
    <p class="muted espacio-abajo">Porcentaje que gana cada chica. El general aplica a todo; si un servicio tiene su propio %, ese manda. Se calcula en pesos (redondeado) al momento de cobrar.</p>
    <div class="lista-comisiones">${colaboradoras.map((c) => html`
      <details class="tarjeta comision" data-id="${c.id}">
        <summary><span class="avatar inicial" data-c="${c.color}">${c.nombre[0]}</span><strong>${c.nombre}</strong><span class="pastilla">${c.comision_pct}%${Object.keys(c.servicios).length ? ` · ${Object.keys(c.servicios).length} por servicio` : ''}</span></summary>
        <form class="form-comision">
          <label class="campo"><span>Comisión general (%)</span><input name="general" type="number" inputmode="decimal" min="0" max="100" step="0.5" value="${c.comision_pct}"></label>
          <div class="tabla-comision">${servs.map((s) => html`<label><span>${s.nombre}</span><input type="number" inputmode="decimal" min="0" max="100" step="0.5" data-serv="${s.id}" value="${c.servicios[s.id] ?? ''}" placeholder="${c.comision_pct}"></label>`)}</div>
          <button class="btn bloque espacio-arriba">Guardar comisiones de ${c.nombre}</button>
        </form>
      </details>`)}</div>
    <section class="tarjeta bloque-ajustes espacio-arriba"><h2>¿Cambiaste un porcentaje?</h2>
      <p class="muted small">Los cobros ya hechos guardan la comisión de ese momento. Para recalcular un mes con los porcentajes de hoy:</p>
      <div class="fila-botones"><button class="btn sec" id="recalcMes">Recalcular este mes</button></div></section>`);
  estilos(caja);
  for (const f of $$('.form-comision', caja)) {
    f.onsubmit = (e) => {
      e.preventDefault();
      const id = f.closest('[data-id]').dataset.id;
      const servicios = Object.fromEntries($$('[data-serv]', f).map((i) => [i.dataset.serv, i.value]));
      ocupado(f.querySelector('.btn'), async () => {
        try { await api(`/api/panel/comisiones/${id}`, { metodo: 'PUT', datos: { comision_pct: f.general.value || 0, servicios } }); toast('Comisiones guardadas', 'ok'); vista(v); } catch (x) { toast(x.message, 'error'); }
      });
    };
  }
  $('#recalcMes', caja).onclick = async () => {
    if (!(await confirmar('¿Recalcular las comisiones de este mes?', 'Se usan los porcentajes actuales para todos los cobros del mes.', { si: 'Recalcular' }))) return;
    try { await api('/api/panel/comisiones/recalcular', { metodo: 'POST', datos: { desde: S.hoy.slice(0, 8) + '01', hasta: S.hoy } }); toast('Listo', 'ok'); } catch (x) { toast(x.message, 'error'); }
  };
}

// ---------- Erika: metas ----------
async function vistaMetas(caja, _r, v) {
  const { metas } = await api('/api/panel/metas');
  pintar(caja, html`
    <div class="fila-botones espacio-abajo"><button class="btn" id="nuevaMeta">${crudo(ICONOS.mas)} Meta</button></div>
    ${metas.length ? html`<div class="lista-metas">${metas.map((m) => {
      const p = Math.min(100, Math.round((m.ahorrado / m.objetivo) * 100));
      const faltan = Math.max(0, m.objetivo - m.ahorrado);
      let ritmo = '';
      if (m.fecha_meta && faltan && !m.cerrada) {
        const meses = Math.max(1, Math.round((new Date(m.fecha_meta) - new Date(S.hoy)) / (30.4 * 864e5)));
        ritmo = `Para llegar el ${fechaCorta(m.fecha_meta)}: ahorra ${dinero(Math.ceil(faltan / meses))} al mes.`;
      }
      return html`<div class="tarjeta meta ${m.cerrada ? 'cerrada' : ''}">
        <div class="meta-cabeza"><span class="pastilla">${m.tipo === 'inversion' ? 'Inversión' : 'Ahorro'}</span><strong>${m.nombre}</strong><button class="icono-btn chico" data-editar-meta="${m.id}" aria-label="Editar">✎</button></div>
        <div class="barra-progreso" role="progressbar" aria-valuenow="${p}" aria-valuemin="0" aria-valuemax="100"><span data-w="${p}%"></span></div>
        <p><strong>${dinero(m.ahorrado)}</strong> de ${dinero(m.objetivo)} · ${p}%${faltan ? ` · faltan ${dinero(faltan)}` : ' · ¡lograda! 🎉'}</p>
        ${ritmo ? html`<p class="muted small">${ritmo}</p>` : ''}
        ${m.cerrada ? '' : html`<button class="btn sec chico" data-aportar="${m.id}">${crudo(ICONOS.mas)} Aportar</button>`}
      </div>`;
    })}</div>` : html`<div class="vacio">${crudo(ICONOS.chispa)}<p>Crea una meta, por ejemplo "Comprar la máquina de pedicure" o "Fondo de emergencia".</p></div>`}`);
  estilos(caja);
  $('#nuevaMeta', caja).onclick = () => editarMeta(null, () => vista(v));
  for (const b of $$('[data-editar-meta]', caja)) b.onclick = () => editarMeta(metas.find((m) => m.id === Number(b.dataset.editarMeta)), () => vista(v));
  for (const b of $$('[data-aportar]', caja)) b.onclick = () => movimientoSimple({ titulo: 'Aporte a la meta', ruta: `/api/panel/metas/${b.dataset.aportar}/aportes`, permitirNegativo: true, ayuda: 'Para un retiro escribe el valor en negativo (ej. -50000).' }, () => vista(v));
}

function editarMeta(m, listo) {
  const nueva = !m;
  m = m || { nombre: '', tipo: 'ahorro', objetivo: '', fecha_meta: '', cerrada: 0 };
  const h = abrirHoja(html`
    <div class="cabeza-hoja"><div><span class="script">${nueva ? 'Nueva' : 'Editar'}</span><h2>Meta</h2></div><button class="icono-btn" data-cerrar aria-label="Cerrar">${crudo(ICONOS.cerrar)}</button></div>
    <form id="formMeta">
      <label class="campo"><span>Nombre</span><input name="nombre" required maxlength="80" value="${m.nombre}" placeholder="Ej. Máquina de pedicure"></label>
      <div class="dos-col">
        <label class="campo"><span>Tipo</span><select name="tipo"><option value="ahorro">Ahorro</option><option value="inversion" ${m.tipo === 'inversion' ? crudo('selected') : ''}>Inversión</option></select></label>
        <label class="campo"><span>Meta (COP)</span><input name="objetivo" type="number" inputmode="numeric" min="1" step="1000" required value="${m.objetivo}"></label>
      </div>
      <label class="campo"><span>¿Para cuándo? (opcional)</span><input name="fecha_meta" type="date" value="${m.fecha_meta}"></label>
      ${nueva ? '' : html`<label class="check"><input type="checkbox" name="cerrada" ${m.cerrada ? crudo('checked') : ''}><span>Meta cerrada</span></label>`}
      <button class="btn bloque espacio-arriba" id="guardarMeta">Guardar</button>
      ${nueva ? '' : html`<button type="button" class="btn ghost bloque" id="borrarMeta">Eliminar</button>`}
    </form>`, { historial: true });
  $('#formMeta', h).onsubmit = (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    d.cerrada = !!e.target.cerrada?.checked;
    ocupado($('#guardarMeta', h), async () => {
      try { await api(nueva ? '/api/panel/metas' : `/api/panel/metas/${m.id}`, { metodo: nueva ? 'POST' : 'PUT', datos: d }); cerrarHoja(); listo(); } catch (x) { toast(x.message, 'error'); }
    });
  };
  $('#borrarMeta', h)?.addEventListener('click', async () => {
    if (!(await confirmar('¿Eliminar la meta?', 'Se borran también sus aportes.', { si: 'Eliminar', peligro: true }))) return;
    try { await api(`/api/panel/metas/${m.id}`, { metodo: 'DELETE' }); listo(); } catch (x) { toast(x.message, 'error'); }
  });
}

function movimientoSimple({ titulo, ruta, permitirNegativo = false, ayuda = '', sugerido = '' }, listo) {
  const h = abrirHoja(html`
    <div class="cabeza-hoja"><h2>${titulo}</h2><button class="icono-btn" data-cerrar aria-label="Cerrar">${crudo(ICONOS.cerrar)}</button></div>
    <form id="formMov">
      <div class="dos-col">
        <label class="campo"><span>Valor (COP)</span><input name="monto" type="number" inputmode="numeric" ${permitirNegativo ? '' : crudo('min="1"')} step="100" required value="${sugerido}" autofocus></label>
        <label class="campo"><span>Fecha</span><input name="fecha" type="date" value="${S.hoy}"></label>
      </div>
      <label class="campo"><span>Nota (opcional)</span><input name="nota" maxlength="200"></label>
      ${ayuda ? html`<p class="muted small">${ayuda}</p>` : ''}
      <button class="btn bloque espacio-arriba" id="guardarMov">Guardar</button>
    </form>`);
  $('#formMov', h).onsubmit = (e) => {
    e.preventDefault();
    ocupado($('#guardarMov', h), async () => {
      try { await api(ruta, { metodo: 'POST', datos: Object.fromEntries(new FormData(e.target)) }); toast('Guardado', 'ok'); cerrarHoja(); listo(); } catch (x) { toast(x.message, 'error'); }
    });
  };
}

// ---------- Erika: deudas ----------
async function vistaDeudas(caja, _r, v) {
  const { deudas } = await api('/api/panel/deudas');
  const debo = deudas.filter((d) => d.tipo === 'debo' && !d.cerrada).reduce((a, d) => a + d.saldo, 0);
  const meDeben = deudas.filter((d) => d.tipo === 'me_deben' && !d.cerrada).reduce((a, d) => a + d.saldo, 0);
  pintar(caja, html`
    <div class="stats mini"><div class="stat"><span>Debes</span><strong>${dinero(debo)}</strong></div><div class="stat"><span>Te deben</span><strong>${dinero(meDeben)}</strong></div>
      <div class="stat"><span>Abiertas</span><strong>${deudas.filter((d) => !d.cerrada).length}</strong></div></div>
    <div class="fila-botones espacio-arriba espacio-abajo"><button class="btn" id="nuevaDeuda">${crudo(ICONOS.mas)} Deuda o préstamo</button></div>
    ${deudas.length ? html`<div class="lista-metas">${deudas.map((d) => {
      const p = Math.min(100, Math.round((d.pagado / d.total) * 100));
      const vence = d.proxima && d.proxima <= sumarDias(S.hoy, 3);
      return html`<div class="tarjeta meta ${d.cerrada ? 'cerrada' : ''}">
        <div class="meta-cabeza"><span class="pastilla ${d.tipo === 'debo' ? 'aviso' : 'ok'}">${d.tipo === 'debo' ? 'Debo' : 'Me deben'}</span><strong>${d.nombre}</strong><button class="icono-btn chico" data-editar-deuda="${d.id}" aria-label="Editar">✎</button></div>
        ${d.persona ? html`<p class="muted small">${d.tipo === 'debo' ? 'A' : 'De'}: ${d.persona}</p>` : ''}
        <div class="barra-progreso"><span data-w="${p}%"></span></div>
        <p><strong>Saldo ${dinero(d.saldo)}</strong> de ${dinero(d.total)} · cuota ${dinero(d.cuota)} · ${d.cuotas_pagadas}/${d.cuotas} cuotas</p>
        ${d.proxima && !d.cerrada ? html`<p class="${vence ? 'aviso' : 'muted small'}">Próxima cuota: ${fechaCorta(d.proxima)}${vence ? ' ⏰' : ''}</p>` : ''}
        ${d.cerrada ? html`<p class="muted small">✔ Pagada</p>` : html`<button class="btn sec chico" data-pagar="${d.id}">${d.tipo === 'debo' ? 'Pagar cuota' : 'Registrar abono'}</button>`}
      </div>`;
    })}</div>` : html`<div class="vacio">${crudo(ICONOS.chispa)}<p>Registra préstamos o deudas con sus cuotas y aquí verás cuánto falta.</p></div>`}`);
  estilos(caja);
  $('#nuevaDeuda', caja).onclick = () => editarDeuda(null, () => vista(v));
  for (const b of $$('[data-editar-deuda]', caja)) b.onclick = () => editarDeuda(deudas.find((d) => d.id === Number(b.dataset.editarDeuda)), () => vista(v));
  for (const b of $$('[data-pagar]', caja)) {
    const d = deudas.find((x) => x.id === Number(b.dataset.pagar));
    b.onclick = () => movimientoSimple({ titulo: d.tipo === 'debo' ? `Cuota: ${d.nombre}` : `Abono: ${d.nombre}`, ruta: `/api/panel/deudas/${d.id}/pagos`, sugerido: Math.min(d.cuota, d.saldo) }, () => vista(v));
  }
}

function editarDeuda(d, listo) {
  const nueva = !d;
  d = d || { nombre: '', tipo: 'debo', persona: '', total: '', cuotas: 1, dia_pago: '', inicio: S.hoy, nota: '', cerrada: 0 };
  const h = abrirHoja(html`
    <div class="cabeza-hoja"><div><span class="script">${nueva ? 'Nueva' : 'Editar'}</span><h2>Deuda o préstamo</h2></div><button class="icono-btn" data-cerrar aria-label="Cerrar">${crudo(ICONOS.cerrar)}</button></div>
    <form id="formDeuda">
      <label class="campo"><span>Tipo</span><select name="tipo"><option value="debo">Yo debo (préstamo, crédito, proveedor)</option><option value="me_deben" ${d.tipo === 'me_deben' ? crudo('selected') : ''}>Me deben</option></select></label>
      <label class="campo"><span>¿Qué es?</span><input name="nombre" required maxlength="80" value="${d.nombre}" placeholder="Ej. Préstamo de la silla"></label>
      <label class="campo"><span>Persona o entidad (opcional)</span><input name="persona" maxlength="80" value="${d.persona}"></label>
      <div class="dos-col">
        <label class="campo"><span>Valor total (COP)</span><input name="total" type="number" inputmode="numeric" min="1" step="1000" required value="${d.total}"></label>
        <label class="campo"><span>Número de cuotas</span><input name="cuotas" type="number" inputmode="numeric" min="1" max="360" required value="${d.cuotas}"></label>
      </div>
      <div class="dos-col">
        <label class="campo"><span>Día de pago (1-31)</span><input name="dia_pago" type="number" inputmode="numeric" min="1" max="31" value="${d.dia_pago ?? ''}"></label>
        <label class="campo"><span>Desde</span><input name="inicio" type="date" value="${d.inicio}"></label>
      </div>
      <label class="campo"><span>Nota (opcional)</span><input name="nota" maxlength="300" value="${d.nota}"></label>
      ${nueva ? '' : html`<label class="check"><input type="checkbox" name="cerrada" ${d.cerrada ? crudo('checked') : ''}><span>Ya está pagada</span></label>`}
      <button class="btn bloque espacio-arriba" id="guardarDeuda">Guardar</button>
      ${nueva ? '' : html`<button type="button" class="btn ghost bloque" id="borrarDeuda">Eliminar</button>`}
    </form>`, { historial: true });
  $('#formDeuda', h).onsubmit = (e) => {
    e.preventDefault();
    const datos = Object.fromEntries(new FormData(e.target));
    datos.cerrada = !!e.target.cerrada?.checked;
    ocupado($('#guardarDeuda', h), async () => {
      try { await api(nueva ? '/api/panel/deudas' : `/api/panel/deudas/${d.id}`, { metodo: nueva ? 'POST' : 'PUT', datos }); cerrarHoja(); listo(); } catch (x) { toast(x.message, 'error'); }
    });
  };
  $('#borrarDeuda', h)?.addEventListener('click', async () => {
    if (!(await confirmar('¿Eliminar?', 'Se borran también sus pagos.', { si: 'Eliminar', peligro: true }))) return;
    try { await api(`/api/panel/deudas/${d.id}`, { metodo: 'DELETE' }); listo(); } catch (x) { toast(x.message, 'error'); }
  });
}

// ---------- venta sin cita (Erika o la chica, para ella misma) ----------
export function nuevaVenta(listo) {
  const servs = S.servicios.filter((s) => s.visible);
  const h = abrirHoja(html`
    <div class="cabeza-hoja"><div><span class="script">Nueva</span><h2>Venta sin cita</h2></div><button class="icono-btn" data-cerrar aria-label="Cerrar">${crudo(ICONOS.cerrar)}</button></div>
    <form id="formVenta">
      <label class="campo"><span>Servicio o producto</span><select name="servicio_id"><option value="">Otro (escribir abajo)</option>${servs.map((s) => html`<option value="${s.id}" data-precio="${s.precio ?? ''}">${s.nombre}${s.precio != null ? ` · ${dinero(s.precio)}` : ''}</option>`)}</select></label>
      <label class="campo"><span>Concepto</span><input name="concepto" maxlength="120" placeholder="Ej. Retoque, esmalte para llevar…"></label>
      <div class="dos-col">
        <label class="campo"><span>Valor cobrado (COP)</span><input name="monto" type="number" inputmode="numeric" min="0" step="100" required></label>
        <label class="campo"><span>Propina</span><input name="propina" type="number" inputmode="numeric" min="0" step="100" value="0"></label>
      </div>
      <div class="dos-col">
        <label class="campo"><span>Cómo pagó</span><select name="metodo">${opcionesMetodo()}</select></label>
        ${esDuena() ? html`<label class="campo"><span>¿Quién la atendió?</span><select name="colaboradora_id"><option value="">Nadie (venta del spa)</option>${S.colaboradoras.filter((c) => c.activa).map((c) => html`<option value="${c.id}">${c.nombre}</option>`)}</select></label>`
    : html`<label class="campo"><span>Fecha</span><input name="fecha" type="date" value="${S.hoy}" max="${S.hoy}" min="${sumarDias(S.hoy, -2)}"></label>`}
      </div>
      ${esDuena() ? html`<label class="campo"><span>Fecha</span><input name="fecha" type="date" value="${S.hoy}" max="${S.hoy}"></label>` : ''}
      <p class="aviso error" hidden id="errVenta"></p>
      <button class="btn bloque espacio-arriba" id="guardarVenta">Registrar venta</button>
    </form>`, { historial: true });
  const f = $('#formVenta', h);
  f.servicio_id.onchange = () => { const o = f.servicio_id.selectedOptions[0]; if (o?.dataset.precio && !f.monto.value) f.monto.value = o.dataset.precio; };
  f.onsubmit = (e) => {
    e.preventDefault();
    ocupado($('#guardarVenta', h), async () => {
      try {
        const r = await api('/api/panel/ventas', { metodo: 'POST', datos: Object.fromEntries(new FormData(f)) });
        toast(r.comision ? `Venta registrada · comisión ${dinero(r.comision)}` : 'Venta registrada', 'ok');
        cerrarHoja(); listo?.();
      } catch (x) { $('#errVenta', h).textContent = x.message; $('#errVenta', h).hidden = false; }
    });
  };
}

