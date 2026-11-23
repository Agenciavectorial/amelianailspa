// Secciones "Horario y festivos", "Reglas de reserva" y "Mi cuenta".
import { api, html, crudo, pintar, $, $$, toast, ocupado, abrirHoja, cerrarHoja, hhmm, aMin, fechaLarga, DIAS, ICONOS } from '/app-citas/js/util.js';
import { S, recargar, esDuena, puede, colab } from './estado.js';
import { editorHorario, urlFeed } from './equipo.js';
import { salir } from './main.js';

// Festivos de Colombia (Ley Emiliani). Solo sugerencias: el spa puede abrir en festivos.
const FESTIVOS_CO = [
  ['2026-01-01', 'Año Nuevo'], ['2026-01-12', 'Reyes Magos'], ['2026-03-23', 'San José'], ['2026-04-02', 'Jueves Santo'], ['2026-04-03', 'Viernes Santo'],
  ['2026-05-01', 'Día del Trabajo'], ['2026-05-18', 'Ascensión'], ['2026-06-08', 'Corpus Christi'], ['2026-06-15', 'Sagrado Corazón'], ['2026-06-29', 'San Pedro y San Pablo'],
  ['2026-07-20', 'Independencia'], ['2026-08-07', 'Batalla de Boyacá'], ['2026-08-17', 'Asunción'], ['2026-10-12', 'Día de la Raza'], ['2026-11-02', 'Todos los Santos'],
  ['2026-11-16', 'Independencia de Cartagena'], ['2026-12-08', 'Inmaculada Concepción'], ['2026-12-25', 'Navidad'],
  ['2027-01-01', 'Año Nuevo'], ['2027-01-11', 'Reyes Magos'], ['2027-03-22', 'San José'], ['2027-03-25', 'Jueves Santo'], ['2027-03-26', 'Viernes Santo'],
  ['2027-05-01', 'Día del Trabajo'], ['2027-05-10', 'Ascensión'], ['2027-05-31', 'Corpus Christi'], ['2027-06-07', 'Sagrado Corazón'], ['2027-07-05', 'San Pedro y San Pablo'],
  ['2027-07-20', 'Independencia'], ['2027-08-07', 'Batalla de Boyacá'], ['2027-08-16', 'Asunción'], ['2027-10-18', 'Día de la Raza'], ['2027-11-01', 'Todos los Santos'],
  ['2027-11-15', 'Independencia de Cartagena'], ['2027-12-08', 'Inmaculada Concepción'], ['2027-12-25', 'Navidad'],
];

export async function vista(v, { seccion }) {
  if (seccion === 'spa') return vistaSpa(v);
  if (seccion === 'ajustes') return vistaReglas(v);
  return vistaCuenta(v);
}

// ---------- horario y festivos ----------
async function vistaSpa(v) {
  await recargar();
  const orden = [1, 2, 3, 4, 5, 6, 0];
  pintar(v, html`
    <header class="cabeza-vista"><div><span class="script">El spa</span><h1>Horario y <em>festivos</em></h1></div></header>
    <section class="tarjeta bloque-ajustes">
      <h2>Horario de atención</h2>
      <p class="muted small">Es el marco general. Cada colaboradora puede tener un horario propio dentro de él (Equipo → Horario).</p>
      <form id="formSpa">
        ${orden.map((d) => {
          const h = S.horario_spa.find((x) => x.dia === d) || { abierto: 0, abre: 540, cierra: 1140 };
          return html`<div class="he-fila" data-dia="${d}">
            <strong>${DIAS[d][0].toUpperCase() + DIAS[d].slice(1)}</strong>
            <label class="interruptor"><input type="checkbox" name="abierto" ${h.abierto ? crudo('checked') : ''}> Abre</label>
            <span class="he-horas"><input type="time" class="input" step="300" value="${hhmm(h.abre)}"><span>a</span><input type="time" class="input" step="300" value="${hhmm(h.cierra)}"></span>
          </div>`;
        })}
        <button class="btn espacio-arriba" id="guardarSpa">Guardar horario</button>
      </form>
    </section>
    <section class="tarjeta bloque-ajustes">
      <h2>Festivos y días cerrados</h2>
      <p class="muted small">Esos días no se podrá reservar. Para cerrar solo unas horas, usa "Bloquear" en la agenda.</p>
      <form id="formFestivo" class="fila-festivo">
        <input type="date" class="input" name="fecha" required min="${S.hoy}">
        <input class="input" name="motivo" placeholder="Motivo (opcional)" maxlength="80">
        <button class="btn sec chico">Agregar</button>
      </form>
      <div id="listaFestivos"></div>
      <button class="btn ghost chico espacio-arriba" id="sugerirFestivos">Ver festivos de Colombia</button>
    </section>`);
  const pintarFestivos = () => pintar($('#listaFestivos'), S.festivos.length ? html`<ul class="lista-festivos">${S.festivos.map((f) => html`
    <li><span><strong>${fechaLarga(f.fecha)}</strong>${f.motivo ? html` · <span class="muted">${f.motivo}</span>` : ''}</span><button class="btn ghost chico" data-quitar="${f.fecha}">Quitar</button></li>`)}</ul>` : html`<p class="muted small">No hay días cerrados próximos.</p>`);
  pintarFestivos();
  $('#formSpa').onsubmit = (e) => {
    e.preventDefault();
    ocupado($('#guardarSpa'), async () => {
      const horario = $$('.he-fila', e.target).map((f) => {
        const [a, b] = $$('input[type=time]', f).map((i) => i.value);
        return { dia: Number(f.dataset.dia), abierto: $('[name=abierto]', f).checked, abre: a, cierra: b };
      });
      try { await api('/api/panel/spa', { metodo: 'PUT', datos: { horario } }); await recargar(); toast('Horario guardado', 'ok'); } catch (x) { toast(x.message, 'error'); }
    });
  };
  const agregar = async (fecha, motivo) => {
    await api('/api/panel/festivos', { metodo: 'POST', datos: { fecha, motivo } });
    await recargar();
    pintarFestivos();
  };
  $('#formFestivo').onsubmit = async (e) => {
    e.preventDefault();
    try { await agregar(e.target.fecha.value, e.target.motivo.value); e.target.reset(); toast('Día cerrado agregado', 'ok'); } catch (x) { toast(x.message, 'error'); }
  };
  $('#listaFestivos').onclick = async (e) => {
    const b = e.target.closest('[data-quitar]');
    if (!b) return;
    try { await api(`/api/panel/festivos/${b.dataset.quitar}`, { metodo: 'DELETE' }); await recargar(); pintarFestivos(); } catch (x) { toast(x.message, 'error'); }
  };
  $('#sugerirFestivos').onclick = () => {
    const ya = new Set(S.festivos.map((f) => f.fecha));
    const prox = FESTIVOS_CO.filter(([f]) => f >= S.hoy);
    const h = abrirHoja(html`
      <div class="cabeza-hoja"><div><span class="script">Colombia</span><h2>Festivos</h2></div><button class="icono-btn" data-cerrar aria-label="Cerrar">${crudo(ICONOS.cerrar)}</button></div>
      <p class="muted small">Agrega solo los días en que el spa no abrirá.</p>
      <ul class="lista-festivos">${prox.map(([f, n]) => html`<li><span><strong>${fechaLarga(f)}</strong> · <span class="muted">${n}</span></span>
        ${ya.has(f) ? html`<span class="pastilla ok">Cerrado</span>` : html`<button class="btn sec chico" data-fecha="${f}" data-motivo="${n}">Cerrar</button>`}</li>`)}</ul>`);
    h.onclick = async (e) => {
      const b = e.target.closest('[data-fecha]');
      if (!b) return;
      try { await agregar(b.dataset.fecha, b.dataset.motivo); b.outerHTML = '<span class="pastilla ok">Cerrado</span>'; } catch (x) { toast(x.message, 'error'); }
    };
  };
}

// ---------- reglas de reserva ----------
async function vistaReglas(v) {
  await recargar();
  const a = S.ajustes;
  const general = a.ics_token_general;
  pintar(v, html`
    <header class="cabeza-vista"><div><span class="script">Ajustes</span><h1>Reglas de <em>reserva</em></h1></div></header>
    <form id="formReglas" class="tarjeta bloque-ajustes">
      <div class="dos-col">
        <label class="campo"><span>Anticipación mínima</span>
          <select name="anticipacion_min">${[[0, 'Sin mínimo'], [30, '30 minutos'], [60, '1 hora'], [120, '2 horas'], [180, '3 horas'], [240, '4 horas'], [720, '12 horas'], [1440, '1 día'], [2880, '2 días']].map(([m, t]) => html`<option value="${m}" ${a.anticipacion_min === m ? crudo('selected') : ''}>${t}</option>`)}</select>
          <span class="ayuda">Cuánto antes como mínimo puede reservar una clienta.</span></label>
        <label class="campo"><span>Ventana de reserva (días)</span><input name="ventana_dias" type="number" min="1" max="365" value="${a.ventana_dias}">
          <span class="ayuda">Hasta cuántos días adelante se puede reservar.</span></label>
      </div>
      <div class="dos-col">
        <label class="campo"><span>Intervalo entre turnos</span>
          <select name="intervalo_min">${[10, 15, 20, 30, 45, 60].map((m) => html`<option value="${m}" ${a.intervalo_min === m ? crudo('selected') : ''}>Cada ${m} min</option>`)}</select></label>
        <label class="campo"><span>Cancelar/cambiar en línea hasta</span>
          <select name="cancelacion_horas">${[0, 1, 2, 3, 4, 6, 12, 24, 48].map((m) => html`<option value="${m}" ${a.cancelacion_horas === m ? crudo('selected') : ''}>${m ? `${m} h antes` : 'Cualquier momento'}</option>`)}</select></label>
      </div>
      <div class="dos-col">
        <label class="campo"><span>Máx. citas próximas por celular</span><input name="max_citas_por_celular" type="number" min="1" max="20" value="${a.max_citas_por_celular}"></label>
        <label class="campo"><span>WhatsApp del spa</span><input name="whatsapp" type="tel" value="${a.whatsapp}"></label>
      </div>
      <label class="campo"><span>Dirección</span><input name="direccion" maxlength="200" value="${a.direccion}"></label>
      <label class="campo"><span>Texto de la política (lo ve la clienta al reservar)</span><textarea name="politica_texto" maxlength="600">${a.politica_texto}</textarea></label>
      <button class="btn" id="guardarReglas">Guardar reglas</button>
    </form>
    <section class="tarjeta bloque-ajustes">
      <h2>Calendario general</h2>
      <p class="muted small">Todas las citas del spa en tu Google Calendar o iPhone. Se actualiza solo (cada 15 min a pocas horas, según la app).</p>
      <div id="feedGeneral"></div>
      ${ayudaCalendario()}
    </section>`);
  $('#formReglas').onsubmit = (e) => {
    e.preventDefault();
    ocupado($('#guardarReglas'), async () => {
      const d = Object.fromEntries(new FormData(e.target));
      for (const k of ['anticipacion_min', 'ventana_dias', 'intervalo_min', 'cancelacion_horas', 'max_citas_por_celular']) d[k] = Number(d[k]);
      try { await api('/api/panel/ajustes', { metodo: 'PUT', datos: d }); await recargar(); toast('Reglas guardadas', 'ok'); } catch (x) { toast(x.message, 'error'); }
    });
  };
  let token = general;
  const pintarFeed = () => pintar($('#feedGeneral'), token ? html`
    <div class="feed"><code>${urlFeed(token)}</code></div>
    <div class="fila-botones"><button class="btn sec chico" data-g="copiar">${crudo(ICONOS.copiar)} Copiar</button><button class="btn ghost chico" data-g="nuevo">Generar otro</button></div>`
    : html`<button class="btn sec chico" data-g="nuevo">Crear enlace</button>`);
  pintarFeed();
  $('#feedGeneral').onclick = async (e) => {
    const b = e.target.closest('[data-g]');
    if (!b) return;
    if (b.dataset.g === 'copiar') { try { await navigator.clipboard.writeText(urlFeed(token)); toast('Copiado', 'ok'); } catch { toast('No se pudo copiar', 'error'); } return; }
    try { token = (await api('/api/panel/ics-general', { metodo: 'POST', datos: {} })).ics_token; pintarFeed(); } catch (x) { toast(x.message, 'error'); }
  };
}

function ayudaCalendario() {
  return html`<details class="ayuda-cal"><summary>¿Cómo lo agrego a mi celular?</summary>
    <p><strong>Google Calendar</strong> (desde un computador): calendar.google.com → al lado de "Otros calendarios" toca <em>+</em> → <em>Desde URL</em> → pega el enlace → <em>Agregar calendario</em>. Luego aparece en el celular.</p>
    <p><strong>iPhone</strong>: Ajustes → Calendario → Cuentas → Añadir cuenta → Otra → <em>Añadir calendario suscrito</em> → pega el enlace.</p>
    <p class="muted small">Es de solo lectura: las citas se crean y mueven en este panel.</p></details>`;
}

// ---------- mi cuenta ----------
async function vistaCuenta(v) {
  await recargar();
  const yo = colab(S.yo.id) || S.yo;
  const editaHorario = puede('editar_horario');
  pintar(v, html`
    <header class="cabeza-vista"><div><span class="script">Hola, ${S.yo.nombre}</span><h1>Mi <em>cuenta</em></h1></div></header>
    <section class="tarjeta bloque-ajustes instalar-app">
      <h2>App en tu celular</h2>
      <p class="muted small">Instala el panel como una app: abre más rápido y queda en tu pantalla de inicio.</p>
      <button class="btn sec" id="instalar">${crudo(ICONOS.chispa)} Instalar app</button>
      <p class="muted small" id="pasosIos" hidden>En iPhone: toca el botón <strong>Compartir</strong> de Safari y luego <strong>"Agregar a inicio"</strong>.</p>
    </section>
    ${S.yo.agenda ? html`
    <section class="tarjeta bloque-ajustes">
      <h2>Mi horario semanal</h2>
      ${editaHorario ? html`<p class="muted small">Ajusta los días y horas en que recibes citas.</p>` : html`<p class="muted small">Solo Erika puede cambiar tu horario. Pídeselo si necesitas un ajuste.</p>`}
      <div id="miHorario"></div>
      ${editaHorario ? html`<button class="btn espacio-arriba" id="guardarHorario">Guardar horario</button>` : ''}
    </section>
    <section class="tarjeta bloque-ajustes">
      <h2>Mi calendario</h2>
      ${yo.ics_token ? html`<p class="muted small">Suscribe tu agenda en tu celular con este enlace secreto (no lo compartas).</p>
        <div class="feed"><code>${urlFeed(yo.ics_token)}</code></div>
        <button class="btn sec chico" id="copiarFeed">${crudo(ICONOS.copiar)} Copiar enlace</button>${ayudaCalendario()}`
        : html`<p class="muted small">${esDuena() ? 'Créalo en Equipo → tu tarjeta → Acceso.' : 'Pídele a Erika que active tu enlace de calendario.'}</p>`}
    </section>` : ''}
    <section class="tarjeta bloque-ajustes">
      <h2>Cambiar mi PIN</h2>
      <form id="formPin">
        <div class="dos-col">
          <label class="campo"><span>PIN actual</span><input name="actual" type="password" inputmode="numeric" autocomplete="current-password" required></label>
          <label class="campo"><span>PIN nuevo (4 a 8 números)</span><input name="nuevo" type="password" inputmode="numeric" autocomplete="new-password" required></label>
        </div>
        <button class="btn sec" id="guardarPin">Cambiar PIN</button>
      </form>
    </section>
    <button class="btn ghost bloque" id="salir">Cerrar sesión</button>`);
  const leer = S.yo.agenda ? editorHorario($('#miHorario'), yo, editaHorario) : null;
  $('#guardarHorario')?.addEventListener('click', (e) => ocupado(e.currentTarget, async () => {
    try { await api(`/api/panel/horario/${S.yo.id}`, { metodo: 'PUT', datos: { dias: leer() } }); toast('Horario guardado', 'ok'); } catch (x) { toast(x.message, 'error'); }
  }));
  $('#copiarFeed')?.addEventListener('click', async () => { try { await navigator.clipboard.writeText(urlFeed(yo.ics_token)); toast('Copiado', 'ok'); } catch { toast('No se pudo copiar', 'error'); } });
  $('#formPin').onsubmit = (e) => {
    e.preventDefault();
    ocupado($('#guardarPin'), async () => {
      try { await api('/api/auth/cambiar-pin', { metodo: 'POST', datos: Object.fromEntries(new FormData(e.target)) }); e.target.reset(); toast('PIN cambiado', 'ok'); } catch (x) { toast(x.message, 'error'); }
    });
  };
  $('#instalar').onclick = async () => {
    const r = window.ameliaInstalar ? await window.ameliaInstalar() : 'manual';
    if (r === 'instalada') toast('¡Listo! Ya tienes la app.', 'ok');
    else if (r === 'ios') $('#pasosIos').hidden = false;
    else if (r === 'manual') toast('Abre el menú del navegador y elige "Instalar app" o "Agregar a pantalla de inicio".');
  };
  $('#salir').onclick = salir;
  void aMin; void cerrarHoja;
}
