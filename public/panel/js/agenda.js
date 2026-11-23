// Agenda: vista día (columnas por colaboradora) y semana (una colaboradora), con citas y bloqueos.
import { api, html, crudo, pintar, $, $$, abrirHoja, cerrarHoja, hora, horaCorta, fechaLarga, fechaCorta, DIAS_CORTOS, fechaD, sumarDias, diaSemana, inicial, ICONOS, toast } from '/app-citas/js/util.js';
import { S, esDuena, puede, colab, conAgenda, horarioSpa, rangoColab, aplicarEstilos } from './estado.js';
import { verCita, nuevaCita, nuevoBloqueo, verBloqueo } from './citas.js';

const PX = 1.5; // píxeles por minuto
let estado = null;

function lunesDe(f) {
  const d = diaSemana(f);
  return sumarDias(f, d === 0 ? -6 : 1 - d);
}

export async function vista(v, { resto }) {
  const [f, modo, c] = resto || [];
  const verEquipo = puede('ver_agenda_equipo');
  estado = {
    fecha: /^\d{4}-\d{2}-\d{2}$/.test(f || '') ? f : (estado?.fecha || S.hoy),
    modo: modo === 'semana' || modo === 'dia' ? modo : (estado?.modo || (window.innerWidth < 700 && !verEquipo ? 'semana' : 'dia')),
    colab: Number(c) || estado?.colab || (S.yo.agenda ? S.yo.id : conAgenda()[0]?.id),
    canceladas: estado?.canceladas || false,
  };
  if (!verEquipo) estado.colab = S.yo.id;
  pintar(v, html`
    <header class="cabeza-vista agenda-cabeza">
      <div class="ag-titulo">
        <h1 id="agTitulo"></h1>
        <div class="ag-nav">
          <button class="icono-btn" id="agAntes" aria-label="Anterior">${crudo(ICONOS.atras)}</button>
          <button class="btn sec chico" id="agHoy">Hoy</button>
          <button class="icono-btn gira" id="agDespues" aria-label="Siguiente">${crudo(ICONOS.atras)}</button>
          <input type="date" class="input ag-fecha" id="agFecha" aria-label="Ir a fecha">
        </div>
      </div>
      <div class="ag-controles">
        <div class="segmentado" role="tablist">
          <button data-modo="dia">Día</button><button data-modo="semana">Semana</button>
        </div>
        <select class="input ag-colab" id="agColab" aria-label="Colaboradora" ${verEquipo ? '' : crudo('hidden')}>
          ${conAgenda().map((x) => html`<option value="${x.id}">${x.nombre}</option>`)}
        </select>
        <label class="interruptor small"><input type="checkbox" id="agCanceladas"> Canceladas</label>
        <span class="ag-espacio"></span>
        ${puede('gestionar_bloqueos') ? html`<button class="btn sec chico" id="agBloquear">Bloquear</button>` : ''}
        ${puede('gestionar_citas') ? html`<button class="btn chico" id="agNueva">${crudo(ICONOS.mas)} Cita</button>` : ''}
      </div>
    </header>
    <div class="agenda-marco" id="agMarco"><div class="turnos-cargando"><span class="girando oscuro"></span></div></div>`);

  const mover = (n) => { estado.fecha = sumarDias(estado.fecha, estado.modo === 'semana' ? 7 * n : n); cargar(); };
  $('#agAntes').onclick = () => mover(-1);
  $('#agDespues').onclick = () => mover(1);
  $('#agHoy').onclick = () => { estado.fecha = S.hoy; cargar(); };
  $('#agFecha').onchange = (e) => { if (e.target.value) { estado.fecha = e.target.value; cargar(); } };
  for (const b of $$('[data-modo]')) b.onclick = () => { estado.modo = b.dataset.modo; cargar(); };
  $('#agColab').onchange = (e) => { estado.colab = Number(e.target.value); if (estado.modo === 'dia') estado.modo = 'semana'; cargar(); };
  $('#agCanceladas').onchange = (e) => { estado.canceladas = e.target.checked; cargar(); };
  $('#agNueva')?.addEventListener('click', () => nuevaCita({ fecha: estado.fecha, colaboradoraId: estado.modo === 'semana' ? estado.colab : undefined }, cargar));
  $('#agBloquear')?.addEventListener('click', () => nuevoBloqueo({ fecha: estado.fecha, colaboradoraId: estado.modo === 'semana' ? estado.colab : undefined }, cargar));
  // Deslizar con el dedo para cambiar de día/semana
  let x0 = null;
  const marco = $('#agMarco');
  marco.addEventListener('touchstart', (e) => { x0 = marco.scrollLeft <= 0 || marco.scrollLeft + marco.clientWidth >= marco.scrollWidth - 2 ? e.touches[0].clientX : null; }, { passive: true });
  marco.addEventListener('touchend', (e) => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 90 && marco.scrollWidth <= marco.clientWidth + 2) mover(dx < 0 ? 1 : -1);
    x0 = null;
  }, { passive: true });
  await cargar();
}

async function cargar() {
  const e = estado;
  history.replaceState(null, '', `#/agenda/${e.fecha}/${e.modo}/${e.colab || ''}`);
  for (const b of $$('[data-modo]')) b.setAttribute('aria-pressed', String(b.dataset.modo === e.modo));
  $('#agColab').value = String(e.colab || '');
  $('#agColab').classList.toggle('atenuado', e.modo === 'dia');
  $('#agFecha').value = e.fecha;
  $('#agCanceladas').checked = e.canceladas;
  const desde = e.modo === 'semana' ? lunesDe(e.fecha) : e.fecha;
  const hasta = e.modo === 'semana' ? sumarDias(desde, 6) : e.fecha;
  const d0 = fechaD(desde), d1 = fechaD(hasta);
  $('#agTitulo').innerHTML = e.modo === 'semana'
    ? String(html`${d0.getUTCDate()} – ${fechaCorta(hasta).replace(/^\S+ /, '')} <em>${colab(e.colab)?.nombre || ''}</em>`)
    : String(html`${fechaLarga(e.fecha)}${e.fecha === S.hoy ? html` <em>hoy</em>` : ''}`);
  void d1;
  const q = new URLSearchParams({ desde, hasta });
  if (e.modo === 'semana' && e.colab) q.set('colaboradora', e.colab);
  let datos;
  try { datos = await api(`/api/panel/agenda?${q}`); } catch (x) {
    if (x.status === 401) throw x;
    pintar($('#agMarco'), html`<p class="aviso error">${x.message}</p>`);
    return;
  }
  if (estado !== e) return;
  pintarGrilla(datos, desde);
}

function columnas(desde) {
  const e = estado;
  if (e.modo === 'semana') {
    const c = colab(e.colab);
    return Array.from({ length: 7 }, (_, i) => {
      const f = sumarDias(desde, i);
      return { clave: f, fecha: f, colab: c, titulo: html`<span class="ag-dia ${f === S.hoy ? 'hoy' : ''}"><small>${DIAS_CORTOS[diaSemana(f)]}</small><strong>${fechaD(f).getUTCDate()}</strong></span>` };
    });
  }
  const lista = puede('ver_agenda_equipo') ? conAgenda() : conAgenda().filter((c) => c.id === S.yo.id);
  return lista.map((c) => ({
    clave: c.id, fecha: e.fecha, colab: c,
    titulo: html`<span class="ag-persona" data-c="${c.color}">${c.foto ? html`<img class="avatar" src="${c.foto}" alt="">` : html`<span class="avatar inicial">${inicial(c.nombre)}</span>`}<strong>${c.nombre}</strong></span>`,
  }));
}

function pintarGrilla({ citas, bloqueos }, desde) {
  const marco = $('#agMarco');
  const cols = columnas(desde);
  if (!cols.length || cols.some((c) => !c.colab)) {
    pintar(marco, html`<div class="vacio">${crudo(ICONOS.equipo)}<p>No hay colaboradoras con agenda.</p></div>`);
    return;
  }
  const visibles = citas.filter((c) => estado.canceladas || c.estado !== 'cancelada');
  // Rango de horas a mostrar
  let ini = 24 * 60, fin = 0;
  for (const c of cols) {
    const h = horarioSpa(diaSemana(c.fecha));
    if (h?.abierto) { ini = Math.min(ini, h.abre); fin = Math.max(fin, h.cierra); }
  }
  for (const c of visibles) { ini = Math.min(ini, c.inicio); fin = Math.max(fin, c.fin); }
  if (ini >= fin) { ini = 8 * 60; fin = 19 * 60; }
  ini = Math.floor(ini / 60) * 60; fin = Math.ceil(fin / 60) * 60;
  const alto = (fin - ini) * PX;
  const festivos = new Set(S.festivos.map((x) => x.fecha));
  const ahora = (() => { const d = new Date(Date.now() - 5 * 3600000); return d.getUTCHours() * 60 + d.getUTCMinutes(); })();

  const horas = [];
  for (let m = ini; m < fin; m += 60) horas.push(m);

  pintar(marco, html`
    <div class="ag-grilla" data-cols="${cols.length}" data-modo="${estado.modo}">
      <div class="ag-cabeza">
        <div class="ag-esquina"></div>
        ${cols.map((c) => html`<div class="ag-col-titulo">${c.titulo}</div>`)}
      </div>
      <div class="ag-cuerpo">
        <div class="ag-eje" data-top="0" data-alto="${alto}">
          ${horas.map((m) => html`<span data-top="${(m - ini) * PX}">${horaCorta(m)}</span>`)}
        </div>
        ${cols.map((c) => {
          const dia = diaSemana(c.fecha);
          const r = festivos.has(c.fecha) ? null : rangoColab(c.colab, dia);
          const fuera = [];
          if (!r) fuera.push([ini, fin]);
          else { if (r.abre > ini) fuera.push([ini, r.abre]); if (r.cierra < fin) fuera.push([r.cierra, fin]); }
          const susCitas = visibles.filter((x) => x.fecha === c.fecha && x.colaboradora_id === c.colab.id);
          const susBloq = bloqueos.filter((b) => b.fecha === c.fecha && (b.colaboradora_id == null || b.colaboradora_id === c.colab.id));
          return html`
          <div class="ag-col" data-fecha="${c.fecha}" data-colab="${c.colab.id}" data-top="0" data-alto="${alto}">
            ${fuera.map(([a, b]) => html`<div class="ag-fuera" data-top="${(a - ini) * PX}" data-alto="${(b - a) * PX}"></div>`)}
            ${festivos.has(c.fecha) ? html`<div class="ag-etiqueta-dia">Festivo</div>` : (!r ? html`<div class="ag-etiqueta-dia">No trabaja</div>` : '')}
            ${susBloq.map((b) => {
              const a = Math.max(b.inicio, ini), z = Math.min(b.fin, fin);
              if (z <= a) return '';
              return html`<button class="ag-bloqueo" data-bloqueo="${b.id}" data-top="${(a - ini) * PX}" data-alto="${(z - a) * PX - 2}"><span>${b.motivo || 'Bloqueado'}${b.colaboradora_id == null ? ' · spa' : ''}</span></button>`;
            })}
            ${susCitas.map((x) => {
              const co = colab(x.colaboradora_id);
              const corto = (x.fin - x.inicio) < 40;
              return html`<button class="ag-cita estado-${x.estado} ${corto ? 'corta' : ''} ${x.propia ? '' : 'ajena'}" data-cita="${x.id}" data-c="${co?.color || '#A98BBE'}" data-top="${(x.inicio - ini) * PX + 1}" data-alto="${(x.fin - x.inicio) * PX - 3}">
                <span class="agc-hora">${hora(x.inicio)}${x.origen === 'web' ? ' · web' : ''}</span>
                <strong>${x.clienta_nombre}</strong>
                <span class="agc-serv">${x.servicios.map((s) => s.nombre).join(' + ')}</span>
              </button>`;
            })}
            ${c.fecha === S.hoy && ahora > ini && ahora < fin ? html`<div class="ag-ahora" data-top="${(ahora - ini) * PX}"></div>` : ''}
          </div>`;
        })}
      </div>
    </div>`);
  const grilla = $('.ag-grilla', marco);
  grilla.style.setProperty('--hora', `${60 * PX}px`);
  grilla.style.setProperty('--cols', cols.length);
  aplicarEstilos(marco);

  marco.onclick = (ev) => {
    const ci = ev.target.closest('[data-cita]');
    if (ci) {
      const x = citas.find((c) => c.id === Number(ci.dataset.cita));
      if (!x.propia) return toast(`Cita de ${colab(x.colaboradora_id)?.nombre}: ${x.clienta_nombre}, ${hora(x.inicio)}`);
      return verCita(x.id, cargar);
    }
    const bl = ev.target.closest('[data-bloqueo]');
    if (bl) return verBloqueo(bloqueos.find((b) => b.id === Number(bl.dataset.bloqueo)), cargar);
    const col = ev.target.closest('.ag-col');
    if (!col) return;
    const y = ev.clientY - col.getBoundingClientRect().top;
    const paso = S.ajustes.intervalo_min || 15;
    const minuto = Math.floor((ini + y / PX) / paso) * paso;
    accionRapida(col.dataset.fecha, Number(col.dataset.colab), minuto);
  };
  // Lleva la vista a la hora actual o a la primera cita
  const primera = visibles.filter((c) => c.fecha === estado.fecha || estado.modo === 'semana').sort((a, b) => a.inicio - b.inicio)[0];
  const objetivo = estado.fecha === S.hoy ? ahora - 60 : (primera ? primera.inicio - 30 : ini);
  const scrollY = Math.max(0, (objetivo - ini) * PX);
  marco.scrollTop = scrollY;
}

function accionRapida(fecha, colaboradoraId, inicio) {
  const propia = esDuena() || colaboradoraId === S.yo.id;
  if (!propia) return;
  const opciones = [];
  if (puede('gestionar_citas')) opciones.push(['cita', 'Nueva cita aquí', ICONOS.mas]);
  if (puede('gestionar_bloqueos')) opciones.push(['bloqueo', 'Bloquear este horario', ICONOS.reloj]);
  if (!opciones.length) return;
  const h = abrirHoja(html`
    <div class="cabeza-hoja"><div><p class="muted small">${fechaLarga(fecha)} · ${colab(colaboradoraId)?.nombre}</p><h2>${hora(inicio)}</h2></div><button class="icono-btn" data-cerrar aria-label="Cerrar">${crudo(ICONOS.cerrar)}</button></div>
    <div class="lista-mas">${opciones.map(([k, t, i]) => html`<button class="fila-mas tarjeta" data-op="${k}">${crudo(i)}<span>${t}</span><span class="flecha-mas">›</span></button>`)}</div>`);
  h.querySelector('.lista-mas').onclick = (e) => {
    const b = e.target.closest('[data-op]');
    if (!b) return;
    cerrarHoja(true);
    if (b.dataset.op === 'cita') nuevaCita({ fecha, colaboradoraId, inicio }, cargar);
    else nuevoBloqueo({ fecha, colaboradoraId, inicio }, cargar);
  };
}
