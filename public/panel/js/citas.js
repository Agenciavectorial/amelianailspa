// Hojas de cita: ver/gestionar, crear, mover y bloqueos. Las usan Inicio y Agenda.
import {
  api, html, crudo, pintar, $, $$, toast, ocupado, confirmar, abrirHoja, cerrarHoja, hora, hhmm, aMin, duracion, dinero,
  fechaLarga, celularBonito, inicial, ICONOS, sumarDias,
} from '/app-citas/js/util.js?v=363881ba72';
import { S, esDuena, puede, colab, conAgenda, categorias, aplicarEstilos } from './estado.js?v=363881ba72';
import { botonesCita, datosCita, textoPlantilla, enviar } from './mensajes.js?v=363881ba72';

export const METODOS = [['efectivo', 'Efectivo'], ['nequi', 'Nequi'], ['daviplata', 'Daviplata'], ['tarjeta', 'Tarjeta'], ['transferencia', 'Transferencia'], ['otro', 'Otro']];

export const ESTADOS = {
  confirmada: ['Confirmada', ''], asistio: ['Asistió', 'ok'], no_asistio: ['No asistió', 'mal'], cancelada: ['Cancelada', 'aviso'],
};
const ORIGEN = { web: 'Reservó en línea', panel: 'Creada en el panel', importada: 'Importada' };

export function pastillaEstado(e) {
  const [t, c] = ESTADOS[e] || [e, ''];
  return html`<span class="pastilla ${c}">${t}</span>`;
}

// ---------- ver una cita ----------
export async function verCita(id, alCambiar) {
  let c, pagos = [];
  try {
    [c, { pagos }] = await Promise.all([api(`/api/panel/citas/${id}`), api(`/api/panel/citas/${id}/pagos`)]);
  } catch (e) { toast(e.message, 'error'); return; }
  const pagado = pagos.reduce((a, p) => a + p.monto, 0);
  const co = colab(c.colaboradora_id);
  const editable = puede('gestionar_citas') && (esDuena() || c.colaboradora_id === S.yo.id);
  const wa = `https://wa.me/${c.clienta_celular}?text=${encodeURIComponent(`¡Hola ${c.clienta_nombre.split(' ')[0]}! Te escribimos de Amelia Nail Spa sobre tu cita del ${fechaLarga(c.fecha)} a las ${hora(c.inicio)}.`)}`;
  const h = abrirHoja(html`
    <div class="cabeza-hoja">
      <div><p class="muted small">${fechaLarga(c.fecha)}</p><h2>${hora(c.inicio)} – ${hora(c.fin)}</h2></div>
      <button class="icono-btn" data-cerrar aria-label="Cerrar">${crudo(ICONOS.cerrar)}</button>
    </div>
    <div class="detalle-cita">
      <div class="dc-clienta tarjeta">
        <span class="avatar inicial grande">${inicial(c.clienta_nombre)}</span>
        <div><strong>${c.clienta_nombre}</strong><a href="tel:+${c.clienta_celular}">${celularBonito(c.clienta_celular)}</a></div>
        <a class="icono-btn wa-btn" href="${wa}" target="_blank" rel="noopener" aria-label="Escribir por WhatsApp">${crudo(ICONOS.whatsapp)}</a>
      </div>
      <div class="tarjeta dc-datos">
        <div class="dc-fila"><span>Estado</span>${pastillaEstado(c.estado)}</div>
        <div class="dc-fila"><span>Con</span><strong class="con-color" data-c="${co?.color || '#A98BBE'}">${c.colaboradora_nombre}</strong></div>
        ${c.servicios.map((s) => html`<div class="dc-fila"><span>${s.nombre}</span><span>${duracion(s.duracion)} · ${dinero(s.precio)}</span></div>`)}
        ${c.precio_total != null ? html`<div class="dc-fila total"><span>Total</span><strong>${dinero(c.precio_total)}</strong></div>` : ''}
        <div class="dc-fila"><span>Código</span><code>${c.codigo}</code></div>
        <div class="dc-fila"><span>Origen</span><span>${ORIGEN[c.origen] || c.origen}</span></div>
      </div>
      ${pagos.length ? html`<div class="tarjeta dc-datos pagos-cita">${pagos.map((p) => html`<div class="dc-fila"><span>Cobrado · ${(METODOS.find((m) => m[0] === p.metodo) || [, p.metodo])[1]}</span><strong>${dinero(p.monto)}${p.propina ? html` <small class="muted">+ ${dinero(p.propina)} propina</small>` : ''}</strong></div>`)}</div>` : ''}
      ${editable && c.estado !== 'cancelada' ? html`<button class="btn ${pagos.length ? 'sec' : ''} bloque" data-accion="cobrar">${pagos.length ? 'Registrar otro pago' : `Cobrar${c.precio_total != null ? ' ' + dinero(Math.max(0, c.precio_total - pagado)) : ''}`}</button>` : ''}
      ${editable ? botonesCita(c) : ''}
      <label class="campo"><span>Notas</span><textarea id="notasCita" maxlength="400" ${editable ? '' : crudo('readonly')}>${c.notas}</textarea></label>
      ${editable ? html`
        <div class="acciones-cita">
          ${c.estado === 'cancelada' ? html`<button class="btn bloque" data-accion="reactivar">Reactivar cita</button>` : html`
            <div class="dos-col">
              <button class="btn ${c.estado === 'asistio' ? '' : 'sec'}" data-accion="asistio">${crudo(ICONOS.check)} Asistió</button>
              <button class="btn ${c.estado === 'no_asistio' ? 'peligro' : 'sec'}" data-accion="no_asistio">No asistió</button>
            </div>
            <div class="dos-col">
              <button class="btn sec" data-accion="mover">Mover</button>
              <button class="btn ghost" data-accion="cancelar">Cancelar cita</button>
            </div>`}
        </div>` : ''}
      ${c.registro?.length ? html`<details class="registro"><summary>Historial de cambios</summary>
        <ul>${c.registro.map((r) => html`<li><strong>${r.accion}</strong> · ${r.quien}<br><span class="muted small">${r.fecha} UTC ${r.detalle ? '· ' + r.detalle : ''}</span></li>`)}</ul></details>` : ''}
    </div>`);
  aplicarEstilos(h);
  const notas = $('#notasCita', h);
  if (editable) {
    notas.onchange = async () => {
      try { await api(`/api/panel/citas/${c.id}`, { metodo: 'PATCH', datos: { accion: 'notas', notas: notas.value } }); toast('Notas guardadas', 'ok'); } catch (e) { toast(e.message, 'error'); }
    };
  }
  h.onclick = async (e) => {
    const pl = e.target.closest('[data-plantilla]');
    if (pl) return enviar(c.clienta_celular, textoPlantilla(pl.dataset.plantilla, datosCita(c)), { cita_id: c.id, tipo: pl.dataset.plantilla });
    const b = e.target.closest('[data-accion]');
    if (!b) return;
    const a = b.dataset.accion;
    if (a === 'mover') return moverCita(c, alCambiar);
    if (a === 'cobrar') return cobrar(c, pagado, alCambiar);
    if (a === 'cancelar' && !(await confirmar('¿Cancelar esta cita?', `${c.clienta_nombre} · ${fechaLarga(c.fecha)} ${hora(c.inicio)}. El turno quedará libre.`, { si: 'Cancelar cita', peligro: true }))) return verCita(c.id, alCambiar);
    const datos = a === 'cancelar' ? { accion: 'cancelar' }
      : a === 'reactivar' ? { accion: 'estado', estado: 'confirmada' }
        : { accion: 'estado', estado: c.estado === a ? 'confirmada' : a };
    await ocupado(b, async () => {
      try {
        await api(`/api/panel/citas/${c.id}`, { metodo: 'PATCH', datos });
        toast('Listo', 'ok');
        cerrarHoja();
        alCambiar?.();
      } catch (x) { toast(x.message, 'error'); }
    });
  };
}

// ---------- cobrar ----------
export function cobrar(c, pagado = 0, alCambiar) {
  const sugerido = c.precio_total != null ? Math.max(0, c.precio_total - pagado) : '';
  let metodo = 'efectivo';
  const h = abrirHoja(html`
    <div class="cabeza-hoja"><div><p class="muted small">${c.clienta_nombre} · ${fechaLarga(c.fecha)}</p><h2>Cobrar</h2></div><button class="icono-btn" data-cerrar aria-label="Cerrar">${crudo(ICONOS.cerrar)}</button></div>
    <form id="formCobro">
      <label class="campo"><span>Valor cobrado (COP)</span><input name="monto" type="number" inputmode="numeric" min="0" step="1000" required value="${sugerido}" autofocus></label>
      <div class="campo"><span>Método de pago</span><div class="chips-serv metodos">
        ${METODOS.map(([k, t]) => html`<button type="button" class="chip" data-metodo="${k}" aria-pressed="${k === metodo}">${t}</button>`)}
      </div></div>
      <div class="dos-col">
        <label class="campo"><span>Propina (opcional)</span><input name="propina" type="number" inputmode="numeric" min="0" step="1000" value=""></label>
        <label class="campo"><span>Nota (opcional)</span><input name="nota" maxlength="200" placeholder="Abono, descuento…"></label>
      </div>
      <p class="aviso error" id="errCobro" hidden></p>
      <button class="btn bloque" id="guardarCobro">Registrar cobro</button>
      <p class="muted small espacio-arriba">Al cobrar, la cita queda marcada como "asistió".</p>
    </form>`);
  h.querySelector('.metodos').onclick = (e) => {
    const b = e.target.closest('[data-metodo]');
    if (!b) return;
    metodo = b.dataset.metodo;
    for (const x of $$('[data-metodo]', h)) x.setAttribute('aria-pressed', String(x === b));
  };
  const f = $('#formCobro', h);
  f.onsubmit = (e) => {
    e.preventDefault();
    ocupado($('#guardarCobro', h), async () => {
      try {
        await api(`/api/panel/citas/${c.id}/pagos`, { metodo: 'POST', datos: { monto: Number(f.monto.value), propina: Number(f.propina.value || 0), metodo, nota: f.nota.value } });
        toast('Cobro registrado', 'ok');
        cerrarHoja();
        alCambiar?.();
      } catch (x) { $('#errCobro', h).textContent = x.message; $('#errCobro', h).hidden = false; }
    });
  };
}

// ---------- selector de turnos del panel ----------
function selectorTurnos(cont, { obtenerParams, alElegir, permitirForzar }) {
  let elegido = null;
  async function cargar() {
    const p = obtenerParams();
    elegido = null;
    alElegir(null);
    if (!p) { pintar(cont, html`<p class="muted small">Elige servicio, colaboradora y fecha para ver horarios.</p>`); return; }
    pintar(cont, html`<div class="turnos-cargando"><span class="girando oscuro"></span></div>`);
    try {
      const q = new URLSearchParams({ servicios: p.servicios.join(','), fecha: p.fecha, con: p.con });
      if (p.ignorar) q.set('ignorar', p.ignorar);
      const d = await api(`/api/panel/disponibilidad?${q}`);
      pintar(cont, html`
        ${d.turnos.length ? html`<div class="rejilla-turnos chica">${d.turnos.map((t) => html`<button type="button" class="turno" data-inicio="${t.inicio}">${hora(t.inicio)}</button>`)}</div>`
          : html`<p class="aviso">No hay horarios libres ese día (${duracion(d.duracion)}).</p>`}
        ${permitirForzar ? html`<details class="forzar"><summary>Poner otra hora (fuera de horario)</summary>
          <div class="fila-forzar"><input type="time" step="300" class="input" id="horaForzada"><button type="button" class="btn sec chico" id="usarForzada">Usar</button></div>
          <p class="muted small">Ignora horarios y bloqueos, pero nunca permite cruzarse con otra cita.</p></details>` : ''}`);
      for (const b of $$('.turno', cont)) {
        b.onclick = () => {
          elegido = { inicio: Number(b.dataset.inicio), forzar: false };
          for (const x of $$('.turno', cont)) x.setAttribute('aria-pressed', String(x === b));
          alElegir(elegido);
        };
      }
      $('#usarForzada', cont)?.addEventListener('click', () => {
        const m = aMin($('#horaForzada', cont).value);
        if (m == null || m % 5) return toast('Escribe una hora válida (minutos de 5 en 5).', 'error');
        elegido = { inicio: m, forzar: true };
        for (const x of $$('.turno', cont)) x.setAttribute('aria-pressed', 'false');
        alElegir(elegido);
        toast(`Hora ${hora(m)} seleccionada`);
      });
    } catch (e) { pintar(cont, html`<p class="aviso error">${e.message}</p>`); }
  }
  return { cargar };
}

// ---------- nueva cita ----------
export function nuevaCita({ fecha = S.hoy, colaboradoraId, inicio, clienta } = {}, alCambiar) {
  const colabs = esDuena() ? conAgenda() : conAgenda().filter((c) => c.id === S.yo.id);
  if (!colabs.length) return toast('No hay colaboradoras con agenda.', 'error');
  const sel = new Set();
  let con = colaboradoraId || (colabs.length === 1 ? colabs[0].id : colabs[0].id);
  let turno = null;
  const h = abrirHoja(html`
    <div class="cabeza-hoja"><div><span class="script">Nueva</span><h2>Cita</h2></div><button class="icono-btn" data-cerrar aria-label="Cerrar">${crudo(ICONOS.cerrar)}</button></div>
    <form id="formCita" novalidate>
      <div class="campo"><span>Servicios</span>
        ${categorias().map((cat) => html`<p class="cat-mini">${cat}</p><div class="chips-serv">
          ${S.servicios.filter((s) => s.categoria === cat && (s.visible || esDuena())).map((s) => html`<button type="button" class="chip" data-serv="${s.id}" aria-pressed="false">${s.nombre} <small>${duracion(s.duracion)}</small></button>`)}
        </div>`)}
      </div>
      <div class="dos-col">
        <label class="campo"><span>Colaboradora</span>
          <select name="colaboradora" ${colabs.length === 1 ? crudo('disabled') : ''}>${colabs.map((c) => html`<option value="${c.id}" ${c.id === con ? crudo('selected') : ''}>${c.nombre}</option>`)}</select></label>
        <label class="campo"><span>Fecha</span><input type="date" name="fecha" value="${fecha}" required></label>
      </div>
      <div class="campo"><span>Hora</span><div id="turnosNueva"></div></div>
      <div class="recientes" id="recientes" hidden><span class="etiqueta">Clientas recientes</span><div class="chips-serv" id="chipsRecientes"></div></div>
      <div class="dos-col">
        <label class="campo"><span>Celular</span><input name="celular" type="tel" inputmode="tel" required placeholder="300 123 4567" value="${clienta?.celular ? String(clienta.celular).replace(/^57/, '') : ''}" list="sugClientas" autocomplete="off"></label>
        <label class="campo"><span>Nombre de la clienta</span><input name="nombre" required maxlength="80" value="${clienta?.nombre || ''}"></label>
      </div>
      <datalist id="sugClientas"></datalist>
      <label class="campo"><span>Notas (opcional)</span><textarea name="notas" maxlength="400"></textarea></label>
      <p class="aviso error" id="errCita" hidden></p>
      <button class="btn bloque" type="submit" id="guardarCita">Guardar cita</button>
    </form>`);
  const f = $('#formCita', h);
  if (puede('ver_clientas') && !clienta) {
    api('/api/panel/clientas').then((r) => {
      const l = r.clientas.slice(0, 6);
      if (!l.length || !document.body.contains(h)) return;
      $('#recientes', h).hidden = false;
      pintar($('#chipsRecientes', h), html`${l.map((c) => html`<button type="button" class="chip" data-cel="${c.celular.replace(/^57/, '')}" data-nom="${c.nombre}">${c.nombre.split(' ').slice(0, 2).join(' ')}</button>`)}`);
      $('#chipsRecientes', h).onclick = (e) => {
        const b = e.target.closest('[data-cel]');
        if (!b) return;
        f.celular.value = b.dataset.cel;
        f.nombre.value = b.dataset.nom;
        for (const x of $$('#chipsRecientes .chip', h)) x.setAttribute('aria-pressed', String(x === b));
      };
    }).catch(() => {});
  }
  const sel_ = selectorTurnos($('#turnosNueva', h), {
    permitirForzar: esDuena(),
    obtenerParams: () => (sel.size && f.fecha.value ? { servicios: [...sel], fecha: f.fecha.value, con: String(con) } : null),
    alElegir: (t) => { turno = t; },
  });
  for (const b of $$('[data-serv]', h)) {
    b.onclick = () => {
      const id = Number(b.dataset.serv);
      if (sel.has(id)) sel.delete(id); else sel.add(id);
      b.setAttribute('aria-pressed', String(sel.has(id)));
      sel_.cargar();
    };
  }
  f.colaboradora.onchange = () => { con = Number(f.colaboradora.value); sel_.cargar(); };
  f.fecha.onchange = () => sel_.cargar();
  sel_.cargar();
  if (inicio != null) toast(`Elige los servicios para las ${hora(inicio)}`);

  // Sugerencias de clientas existentes por celular o nombre
  if (puede('ver_clientas')) {
    let t;
    const buscar = (texto) => {
      clearTimeout(t);
      if (texto.length < 3) return;
      t = setTimeout(async () => {
        try {
          const r = await api(`/api/panel/clientas?q=${encodeURIComponent(texto)}`);
          pintar($('#sugClientas', h), html`${r.clientas.slice(0, 8).map((c) => html`<option value="${c.celular.replace(/^57/, '')}">${c.nombre}</option>`)}`);
          const exacta = r.clientas.find((c) => c.celular.endsWith(f.celular.value.replace(/\D/g, '')) && f.celular.value.replace(/\D/g, '').length >= 10);
          if (exacta && !f.nombre.value) f.nombre.value = exacta.nombre;
        } catch { /* sin sugerencias */ }
      }, 250);
    };
    f.celular.oninput = () => buscar(f.celular.value.replace(/\D/g, ''));
  }

  f.onsubmit = async (e) => {
    e.preventDefault();
    const err = $('#errCita', h);
    err.hidden = true;
    const fallo = (m) => { err.textContent = m; err.hidden = false; };
    if (!sel.size) return fallo('Elige al menos un servicio.');
    if (!turno) return fallo('Elige la hora.');
    await ocupado($('#guardarCita', h), async () => {
      try {
        await api('/api/panel/citas', {
          metodo: 'POST',
          datos: { servicios: [...sel], colaboradora_id: con, fecha: f.fecha.value, inicio: turno.inicio, forzar: turno.forzar, nombre: f.nombre.value, celular: f.celular.value, notas: f.notas.value },
        });
        toast('Cita creada', 'ok');
        cerrarHoja();
        alCambiar?.();
      } catch (x) {
        fallo(x.message);
        if (x.status === 409) sel_.cargar();
      }
    });
  };
}

// ---------- mover ----------
function moverCita(c, alCambiar) {
  const colabs = esDuena() ? conAgenda() : conAgenda().filter((x) => x.id === S.yo.id);
  let turno = null;
  const servicios = c.servicios.map((s) => s.servicio_id).filter(Boolean);
  const h = abrirHoja(html`
    <div class="cabeza-hoja"><div><p class="muted small">${c.clienta_nombre}</p><h2>Mover cita</h2></div><button class="icono-btn" data-cerrar aria-label="Cerrar">${crudo(ICONOS.cerrar)}</button></div>
    <p class="muted small">Ahora: ${fechaLarga(c.fecha)} · ${hora(c.inicio)} con ${c.colaboradora_nombre}</p>
    <form id="formMover">
      <div class="dos-col">
        <label class="campo"><span>Colaboradora</span><select name="colaboradora" ${colabs.length < 2 ? crudo('disabled') : ''}>
          ${colabs.map((x) => html`<option value="${x.id}" ${x.id === c.colaboradora_id ? crudo('selected') : ''}>${x.nombre}</option>`)}</select></label>
        <label class="campo"><span>Fecha</span><input type="date" name="fecha" value="${c.fecha}"></label>
      </div>
      <div class="campo"><span>Nueva hora</span><div id="turnosMover"></div></div>
      ${servicios.length !== c.servicios.length ? html`<p class="aviso">Esta cita tiene servicios que ya no están en el catálogo: usa "otra hora".</p>` : ''}
      <p class="aviso error" id="errMover" hidden></p>
      <button class="btn bloque" id="guardarMover">Mover</button>
    </form>`);
  const f = $('#formMover', h);
  const st = selectorTurnos($('#turnosMover', h), {
    permitirForzar: esDuena(),
    obtenerParams: () => (servicios.length === c.servicios.length && servicios.length ? { servicios, fecha: f.fecha.value, con: f.colaboradora.value, ignorar: c.id } : null),
    alElegir: (t) => { turno = t; },
  });
  f.colaboradora.onchange = st.cargar;
  f.fecha.onchange = st.cargar;
  st.cargar();
  f.onsubmit = async (e) => {
    e.preventDefault();
    if (!turno) { $('#errMover', h).textContent = 'Elige la nueva hora.'; $('#errMover', h).hidden = false; return; }
    await ocupado($('#guardarMover', h), async () => {
      try {
        await api(`/api/panel/citas/${c.id}`, { metodo: 'PATCH', datos: { accion: 'mover', fecha: f.fecha.value, inicio: turno.inicio, colaboradora_id: Number(f.colaboradora.value), forzar: turno.forzar } });
        toast('Cita movida', 'ok');
        cerrarHoja();
        alCambiar?.();
      } catch (x) { $('#errMover', h).textContent = x.message; $('#errMover', h).hidden = false; }
    });
  };
}

// ---------- bloqueos ----------
export function nuevoBloqueo({ fecha = S.hoy, colaboradoraId, inicio } = {}, alCambiar) {
  const colabs = esDuena() ? conAgenda() : conAgenda().filter((c) => c.id === S.yo.id);
  const ini = inicio ?? 13 * 60;
  const h = abrirHoja(html`
    <div class="cabeza-hoja"><div><span class="script">Bloquear</span><h2>Horario</h2></div><button class="icono-btn" data-cerrar aria-label="Cerrar">${crudo(ICONOS.cerrar)}</button></div>
    <p class="muted small">En un bloqueo no se pueden reservar citas (almuerzo, vacaciones, una diligencia…).</p>
    <form id="formBloq">
      <label class="campo"><span>¿Para quién?</span><select name="colaboradora">
        ${esDuena() ? html`<option value="">Todo el spa</option>` : ''}
        ${colabs.map((c) => html`<option value="${c.id}" ${c.id === (colaboradoraId ?? (esDuena() ? -1 : S.yo.id)) ? crudo('selected') : ''}>${c.nombre}</option>`)}
      </select></label>
      <div class="dos-col">
        <label class="campo"><span>Desde el día</span><input type="date" name="fecha" value="${fecha}" required></label>
        <label class="campo"><span>Hasta el día</span><input type="date" name="fecha_hasta" value="${fecha}"></label>
      </div>
      <div class="campo"><span>Rápido</span><div class="chips-serv atajos-bloqueo">
        <button type="button" class="chip" data-atajo="hora">La próxima hora</button>
        <button type="button" class="chip" data-atajo="almuerzo">Almuerzo 1–2 p. m.</button>
        <button type="button" class="chip" data-atajo="resto">Resto del día</button>
        <button type="button" class="chip" data-atajo="dia">Todo el día</button>
      </div></div>
      <label class="interruptor"><input type="checkbox" name="todo_el_dia"> Todo el día</label>
      <div class="dos-col horas-bloq">
        <label class="campo"><span>Desde</span><input type="time" name="inicio" step="300" value="${hhmm(ini)}"></label>
        <label class="campo"><span>Hasta</span><input type="time" name="fin" step="300" value="${hhmm(Math.min(ini + 60, 1435))}"></label>
      </div>
      <label class="campo"><span>Motivo (opcional)</span><input name="motivo" maxlength="120" placeholder="Almuerzo, vacaciones…"></label>
      <p class="aviso error" id="errBloq" hidden></p>
      <button class="btn bloque" id="guardarBloq">Bloquear</button>
    </form>`);
  const f = $('#formBloq', h);
  f.todo_el_dia.onchange = () => { $('.horas-bloq', h).hidden = f.todo_el_dia.checked; };
  $('.atajos-bloqueo', h).onclick = (e) => {
    const b = e.target.closest('[data-atajo]');
    if (!b) return;
    for (const x of $$('[data-atajo]', h)) x.setAttribute('aria-pressed', String(x === b));
    const ahora = (() => { const d = new Date(Date.now() - 5 * 3600000); return Math.ceil((d.getUTCHours() * 60 + d.getUTCMinutes()) / 5) * 5; })();
    const fijar = (a, z) => { f.todo_el_dia.checked = false; $('.horas-bloq', h).hidden = false; f.inicio.value = hhmm(a); f.fin.value = hhmm(Math.min(z, 1435)); };
    if (b.dataset.atajo === 'hora') { f.fecha.value = f.fecha_hasta.value = S.hoy; fijar(ahora, ahora + 60); f.motivo.value ||= 'Ocupada'; }
    if (b.dataset.atajo === 'almuerzo') { fijar(780, 840); f.motivo.value = 'Almuerzo'; }
    if (b.dataset.atajo === 'resto') { f.fecha.value = f.fecha_hasta.value = S.hoy; fijar(ahora, 1435); f.motivo.value ||= 'Salida temprano'; }
    if (b.dataset.atajo === 'dia') { f.todo_el_dia.checked = true; $('.horas-bloq', h).hidden = true; }
  };
  f.fecha.onchange = () => { if (f.fecha_hasta.value < f.fecha.value) f.fecha_hasta.value = f.fecha.value; };
  f.onsubmit = async (e) => {
    e.preventDefault();
    await ocupado($('#guardarBloq', h), async () => {
      try {
        const r = await api('/api/panel/bloqueos', {
          metodo: 'POST',
          datos: {
            colaboradora_id: f.colaboradora.value || null, fecha: f.fecha.value, fecha_hasta: f.fecha_hasta.value || f.fecha.value,
            todo_el_dia: f.todo_el_dia.checked, inicio: f.inicio.value, fin: f.fin.value, motivo: f.motivo.value,
          },
        });
        toast(r.citas_afectadas ? `Bloqueado. Ojo: ${r.citas_afectadas} cita(s) ya agendadas en ese horario.` : 'Horario bloqueado', r.citas_afectadas ? '' : 'ok');
        cerrarHoja();
        alCambiar?.();
      } catch (x) { $('#errBloq', h).textContent = x.message; $('#errBloq', h).hidden = false; }
    });
  };
}

export function verBloqueo(b, alCambiar) {
  const co = b.colaboradora_id ? colab(b.colaboradora_id) : null;
  const puedeBorrar = puede('gestionar_bloqueos') && (esDuena() || b.colaboradora_id === S.yo.id);
  const h = abrirHoja(html`
    <div class="cabeza-hoja"><div><p class="muted small">${fechaLarga(b.fecha)}</p><h2>Bloqueado</h2></div><button class="icono-btn" data-cerrar aria-label="Cerrar">${crudo(ICONOS.cerrar)}</button></div>
    <div class="tarjeta dc-datos">
      <div class="dc-fila"><span>Para</span><strong>${co ? co.nombre : 'Todo el spa'}</strong></div>
      <div class="dc-fila"><span>Horario</span><span>${b.inicio === 0 && b.fin >= 1440 ? 'Todo el día' : `${hora(b.inicio)} – ${hora(Math.min(b.fin, 1439))}`}</span></div>
      ${b.motivo ? html`<div class="dc-fila"><span>Motivo</span><span>${b.motivo}</span></div>` : ''}
    </div>
    ${puedeBorrar ? html`<button class="btn peligro bloque espacio-arriba" id="borrarBloq">Quitar bloqueo</button>` : ''}`);
  $('#borrarBloq', h)?.addEventListener('click', (e) => ocupado(e.currentTarget, async () => {
    try { await api(`/api/panel/bloqueos/${b.id}`, { metodo: 'DELETE' }); toast('Bloqueo quitado', 'ok'); cerrarHoja(); alCambiar?.(); } catch (x) { toast(x.message, 'error'); }
  }));
}

export { sumarDias };
