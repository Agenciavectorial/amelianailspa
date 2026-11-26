// Equipo (solo Erika): colaboradoras, servicios que hacen, horario, permisos, PIN y calendario.
import { api, html, crudo, pintar, $, $$, toast, ocupado, abrirHoja, cerrarHoja, hhmm, inicial, DIAS, ICONOS, SITIO } from '/app-citas/js/util.js?v=3aee244dd8';
import { S, recargar, horarioSpa, categorias } from './estado.js?v=3aee244dd8';

export const PERMISOS = [
  ['gestionar_citas', 'Gestionar sus citas', 'Crear, mover, cancelar y marcar asistencia de sus propias citas.'],
  ['gestionar_bloqueos', 'Bloquear su agenda', 'Crear y quitar sus bloqueos (almuerzo, diligencias…).'],
  ['editar_horario', 'Cambiar su horario semanal', 'Ajustar qué días y horas trabaja.'],
  ['ver_agenda_equipo', 'Ver la agenda del equipo', 'Ver (sin editar ni ver teléfonos) las citas de las compañeras.'],
  ['ver_clientas', 'Ver sus clientas', 'Ver historial de las clientas que ella ha atendido.'],
];

export const urlFeed = (token) => `${SITIO}/api/ics/${token}.ics`;

/** Editor del horario semanal de una colaboradora. Devuelve una función que lee los días. */
export function editorHorario(cont, c, editable = true) {
  const orden = [1, 2, 3, 4, 5, 6, 0];
  pintar(cont, html`<div class="horario-editor">${orden.map((d) => {
    const spa = horarioSpa(d);
    const h = c.horario?.find((x) => x.dia === d);
    const modo = !h ? 'spa' : (h.trabaja ? 'propio' : 'no');
    return html`<div class="he-fila" data-dia="${d}">
      <strong>${DIAS[d][0].toUpperCase() + DIAS[d].slice(1)}</strong>
      <select class="input he-modo" ${editable ? '' : crudo('disabled')}>
        <option value="spa" ${modo === 'spa' ? crudo('selected') : ''}>${spa?.abierto ? `Como el spa (${hhmm(spa.abre)}–${hhmm(spa.cierra)})` : 'Como el spa (cerrado)'}</option>
        <option value="propio" ${modo === 'propio' ? crudo('selected') : ''}>Horario propio</option>
        <option value="no" ${modo === 'no' ? crudo('selected') : ''}>No trabaja</option>
      </select>
      <span class="he-horas" ${modo === 'propio' ? '' : crudo('hidden')}>
        <input type="time" class="input" step="300" value="${hhmm(h?.trabaja ? h.abre : spa?.abre ?? 540)}" ${editable ? '' : crudo('disabled')}>
        <span>a</span>
        <input type="time" class="input" step="300" value="${hhmm(h?.trabaja ? h.cierra : spa?.cierra ?? 1140)}" ${editable ? '' : crudo('disabled')}>
      </span>
    </div>`;
  })}</div>`);
  for (const fila of $$('.he-fila', cont)) {
    $('.he-modo', fila).onchange = (e) => { $('.he-horas', fila).hidden = e.target.value !== 'propio'; };
  }
  return () => $$('.he-fila', cont).map((fila) => {
    const modo = $('.he-modo', fila).value;
    const [a, b] = $$('input[type=time]', fila).map((i) => i.value);
    return { dia: Number(fila.dataset.dia), usar_spa: modo === 'spa', trabaja: modo === 'propio', abre: a, cierra: b };
  });
}

export async function vista(v) {
  await recargar();
  pintar(v, html`
    <header class="cabeza-vista">
      <div><span class="script">Nuestro</span><h1>Equipo</h1></div>
      <button class="btn chico" id="nuevaColab">${crudo(ICONOS.mas)} Persona</button>
    </header>
    <div class="lista-equipo">
      ${S.colaboradoras.map((c) => html`
        <button class="tarjeta-equipo tarjeta ${c.activa ? '' : 'inactiva'}" data-id="${c.id}" data-c="${c.color}">
          ${c.foto ? html`<img class="avatar" src="${c.foto}" alt="">` : html`<span class="avatar inicial">${inicial(c.nombre)}</span>`}
          <span class="te-cuerpo"><strong>${c.nombre}</strong><span>${c.cargo || (c.rol === 'propietaria' ? 'Propietaria' : 'Colaboradora')}</span>
            <span class="te-pastillas">
              ${c.rol === 'propietaria' ? html`<span class="pastilla">Propietaria</span>` : ''}
              ${c.agenda ? html`<span class="pastilla ok">Recibe citas</span>` : ''}
              ${c.tiene_pin ? '' : html`<span class="pastilla aviso">Sin PIN</span>`}
              ${c.activa ? '' : html`<span class="pastilla mal">Inactiva</span>`}
            </span>
          </span>
          <span class="flecha-mas">›</span>
        </button>`)}
    </div>`);
  const { aplicarEstilos } = await import('./estado.js?v=3aee244dd8');
  aplicarEstilos(v);
  $('#nuevaColab').onclick = () => editar(null, v);
  v.onclick = (e) => { const b = e.target.closest('.tarjeta-equipo'); if (b) editar(S.colaboradoras.find((c) => c.id === Number(b.dataset.id)), v); };
}

function editar(c, v) {
  const nueva = !c;
  c = c || { nombre: '', cargo: '', bio: '', foto: '', color: '#A98BBE', agenda: 1, activa: 1, orden: S.colaboradoras.length, rol: 'colaboradora', servicios: S.servicios.map((s) => s.id), horario: [], permisos: { gestionar_citas: true, gestionar_bloqueos: true } };
  const duena = c.rol === 'propietaria';
  const h = abrirHoja(html`
    <div class="cabeza-hoja"><div><span class="script">${nueva ? 'Nueva' : 'Editar'}</span><h2>${nueva ? 'Persona del equipo' : c.nombre}</h2></div><button class="icono-btn" data-cerrar aria-label="Cerrar">${crudo(ICONOS.cerrar)}</button></div>
    <div class="pestanas" role="tablist">
      <button data-tab="datos" aria-pressed="true">Datos</button><button data-tab="servicios">Servicios</button>
      <button data-tab="horario">Horario</button>${duena ? '' : html`<button data-tab="permisos">Permisos</button>`}<button data-tab="acceso">Acceso</button>
    </div>
    <form id="formColab">
      <section data-panel="datos">
        <div class="dos-col">
          <label class="campo"><span>Nombre</span><input name="nombre" required maxlength="40" value="${c.nombre}"></label>
          <label class="campo"><span>Cargo</span><input name="cargo" maxlength="60" value="${c.cargo}" placeholder="Ej. Uñas acrílicas"></label>
        </div>
        <label class="campo"><span>Foto (enlace https)</span><input name="foto" type="url" value="${c.foto}" placeholder="https://res.cloudinary.com/..."></label>
        <label class="campo"><span>Descripción corta</span><textarea name="bio" maxlength="600">${c.bio || ''}</textarea></label>
        <div class="dos-col">
          <label class="campo"><span>Color en la agenda</span><input name="color" type="color" value="${c.color}"></label>
          <label class="campo"><span>Orden</span><input name="orden" type="number" min="0" max="999" value="${c.orden}"></label>
        </div>
        <label class="interruptor"><input type="checkbox" name="agenda" ${c.agenda ? crudo('checked') : ''}> Recibe citas (aparece en la reserva)</label>
        ${duena ? '' : html`<label class="interruptor espacio-arriba"><input type="checkbox" name="activa" ${c.activa ? crudo('checked') : ''}> Activa (si la apagas, no puede entrar ni recibir citas)</label>`}
      </section>
      <section data-panel="servicios" hidden>
        <p class="muted small">Solo aparecerá para reservar los servicios marcados.</p>
        ${categorias().map((cat) => html`<p class="cat-mini">${cat}</p><div class="chips-serv">
          ${S.servicios.filter((s) => s.categoria === cat).map((s) => html`<label class="chip-check"><input type="checkbox" name="serv" value="${s.id}" ${c.servicios.includes(s.id) ? crudo('checked') : ''}><span>${s.nombre}</span></label>`)}
        </div>`)}
      </section>
      <section data-panel="horario" hidden><div id="editorHorario"></div></section>
      ${duena ? '' : html`<section data-panel="permisos" hidden>
        ${PERMISOS.map(([k, t, d]) => html`<label class="permiso"><span><strong>${t}</strong><small>${d}</small></span><span class="interruptor"><input type="checkbox" name="perm_${k}" ${c.permisos?.[k] ? crudo('checked') : ''}></span></label>`)}
      </section>`}
      <section data-panel="acceso" hidden>
        <h3>PIN de ingreso</h3>
        <p class="muted small">${nueva ? 'Asigna un PIN de 6 números. Entrégaselo en persona.' : (c.tiene_pin ? 'Tiene PIN. Escribe uno nuevo solo si lo olvidó (cierra sus sesiones abiertas).' : 'Aún no tiene PIN: no puede entrar al panel.')}</p>
        <div class="fila-forzar"><input class="input" name="pin" type="password" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="new-password" placeholder="Nuevo PIN (6 números)">${nueva ? '' : html`<button type="button" class="btn sec chico" id="guardarPin">${c.tiene_pin ? 'Cambiar PIN' : 'Guardar PIN'}</button>`}</div>
        ${!nueva && c.tiene_pin && !duena ? html`<button type="button" class="btn ghost chico" id="quitarPin">Quitar acceso</button>` : ''}
        ${!nueva && c.tiene_pin ? html`<button type="button" class="btn ghost chico" id="cerrarSesiones">Cerrar sus sesiones abiertas</button>` : ''}
        ${nueva ? '' : html`
        <h3 class="espacio-arriba">Calendario en su celular</h3>
        <p class="muted small">Enlace secreto para suscribir su agenda en Google Calendar o iPhone. Si se comparte por error, genera uno nuevo y el anterior deja de funcionar.</p>
        <div id="feedColab"></div>`}
      </section>
      <p class="aviso error" id="errColab" hidden></p>
      <button class="btn bloque espacio-arriba" id="guardarColab">Guardar</button>
    </form>`);
  const f = $('#formColab', h);
  const leerHorario = editorHorario($('#editorHorario', h), c, true);
  for (const b of $$('[data-tab]', h)) {
    b.onclick = () => {
      for (const x of $$('[data-tab]', h)) x.setAttribute('aria-pressed', String(x === b));
      for (const p of $$('[data-panel]', h)) p.hidden = p.dataset.panel !== b.dataset.tab;
    };
  }
  const pintarFeed = () => {
    const caja = $('#feedColab', h);
    if (!caja) return;
    pintar(caja, c.ics_token ? html`
      <div class="feed"><code>${urlFeed(c.ics_token)}</code></div>
      <div class="fila-botones"><button type="button" class="btn sec chico" data-feed="copiar">${crudo(ICONOS.copiar)} Copiar</button><button type="button" class="btn ghost chico" data-feed="nuevo">Generar otro</button></div>
      <button type="button" class="btn ghost chico" data-feed="quitar">Desactivar enlace</button>`
      : html`<button type="button" class="btn sec chico" data-feed="nuevo">Crear enlace de calendario</button>`);
  };
  pintarFeed();
  h.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-feed]');
    if (!b) return;
    if (b.dataset.feed === 'copiar') { try { await navigator.clipboard.writeText(urlFeed(c.ics_token)); toast('Enlace copiado', 'ok'); } catch { toast('No se pudo copiar', 'error'); } return; }
    try {
      const r = await api(`/api/panel/colaboradoras/${c.id}/ics`, { metodo: 'POST', datos: { quitar: b.dataset.feed === 'quitar' } });
      c.ics_token = r.ics_token;
      pintarFeed();
      toast(r.ics_token ? 'Enlace creado' : 'Enlace desactivado', 'ok');
    } catch (x) { toast(x.message, 'error'); }
  });
  $('#guardarPin', h)?.addEventListener('click', (e) => ocupado(e.currentTarget, async () => {
    try { await api(`/api/panel/colaboradoras/${c.id}/pin`, { metodo: 'POST', datos: { pin: f.pin.value } }); f.pin.value = ''; toast('PIN actualizado', 'ok'); } catch (x) { toast(x.message, 'error'); }
  }));
  $('#quitarPin', h)?.addEventListener('click', (e) => ocupado(e.currentTarget, async () => {
    try { await api(`/api/panel/colaboradoras/${c.id}/pin`, { metodo: 'POST', datos: { quitar: true } }); toast('Acceso quitado', 'ok'); cerrarHoja(); vista(v); } catch (x) { toast(x.message, 'error'); }
  }));
  $('#cerrarSesiones', h)?.addEventListener('click', async () => {
    try { const r = await api(`/api/panel/colaboradoras/${c.id}/cerrar-sesiones`, { metodo: 'POST', datos: {} }); toast(r.cerradas ? `Se cerraron ${r.cerradas} sesiones de ${c.nombre}` : 'No tenía sesiones abiertas', 'ok'); } catch (x) { toast(x.message, 'error'); }
  });
  f.onsubmit = (e) => {
    e.preventDefault();
    ocupado($('#guardarColab', h), async () => {
      const datos = {
        nombre: f.nombre.value, cargo: f.cargo.value, foto: f.foto.value, bio: f.bio.value, color: f.color.value, orden: Number(f.orden.value || 0),
        agenda: f.agenda.checked, servicios: $$('[name=serv]:checked', f).map((x) => Number(x.value)),
        permisos: Object.fromEntries((duena ? [] : PERMISOS).map(([k]) => [k, f[`perm_${k}`].checked])),
      };
      if (!duena) datos.activa = f.activa ? f.activa.checked : true;
      if (nueva && f.pin.value) datos.pin = f.pin.value;
      try {
        let id = c.id;
        if (nueva) id = (await api('/api/panel/colaboradoras', { metodo: 'POST', datos })).id;
        else await api(`/api/panel/colaboradoras/${c.id}`, { metodo: 'PUT', datos });
        await api(`/api/panel/horario/${id}`, { metodo: 'PUT', datos: { dias: leerHorario() } });
        // Si escribió un PIN y tocó "Guardar" (y no "Guardar PIN"), también se guarda
        if (!nueva && f.pin.value) await api(`/api/panel/colaboradoras/${id}/pin`, { metodo: 'POST', datos: { pin: f.pin.value } });
        toast(!nueva && f.pin.value ? 'Guardado, con su PIN nuevo' : 'Guardado', 'ok');
        cerrarHoja();
        vista(v);
      } catch (x) { $('#errColab', h).textContent = x.message; $('#errColab', h).hidden = false; }
    });
  };
}
