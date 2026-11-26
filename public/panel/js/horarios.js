// Horarios del mes: Erika arma el horario de cada chica día por día (todo el mes, o el que quiera).
// Lo que se pone aquí manda sobre la semana tipo solo en esas fechas; las reservas en línea lo respetan.
// Elegir días es instantáneo (no recarga la pantalla): tocar días sueltos, "Por rango" (primer y último día),
// atajos (Lun a Vie, fines de semana, quincenas), columnas (todos los lunes…) o un intervalo de fechas
// con días de la semana. Luego Trabaja / Libre / Semana tipo → Aplicar.
import { api, html, crudo, pintar, $, $$, toast, ocupado, confirmar, aMin, ICONOS, inicial, sumarDias } from '/app-citas/js/util.js?v=ebff92790b';
import { S, esDuena, horarioSpa, recargar } from './estado.js?v=ebff92790b';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const CABEZA = [['L', 1], ['M', 2], ['M', 3], ['J', 4], ['V', 5], ['S', 6], ['D', 0]];
const NOMBRE_DIA = ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados'];

let mes = null;          // 'AAAA-MM'
let chicaId = null;
let elegidos = new Set(); // fechas elegidas (pueden ser de varios meses, con el intervalo de fechas)
let modo = 'trabaja';
let horas = { abre: '09:00', cierra: '19:00' };
let porRango = false, inicioRango = null;
addEventListener('hashchange', () => document.body.classList.remove('con-panel-horario'));
let arrastrando = false, arrastro = false, valorArrastre = true;
addEventListener('pointerup', () => { if (arrastrando && arrastro) setTimeout(() => { arrastro = false; }, 0); arrastrando = false; });

const diasDelMes = (m) => { const [y, mm] = m.split('-').map(Number); return new Date(Date.UTC(y, mm, 0)).getUTCDate(); };
const diaSem = (f) => new Date(f + 'T12:00:00Z').getUTCDay();
function moverMes(m, n) { const [y, mm] = m.split('-').map(Number); const d = new Date(Date.UTC(y, mm - 1 + n, 1)); return d.toISOString().slice(0, 7); }
const corta = (min) => { const h = Math.floor(min / 60), m = min % 60; return `${((h + 11) % 12) + 1}${m ? ':' + String(m).padStart(2, '0') : ''}${h < 12 ? 'a' : 'p'}`; };
const nombreMes = (m) => MESES[Number(m.slice(5)) - 1];
const spaAbre = (f) => !!horarioSpa(diaSem(f))?.abierto;

export async function vista(v) {
  await recargar();
  const chicas = S.colaboradoras.filter((c) => c.activa && c.agenda && (esDuena() || c.id === S.yo.id));
  if (!chicas.length) return pintar(v, html`<div class="vacio"><p>No hay personas con agenda.</p></div>`);
  if (!chicas.some((c) => c.id === chicaId)) chicaId = chicas[0].id;
  mes = mes || S.hoy.slice(0, 7);
  const chica = chicas.find((c) => c.id === chicaId);
  const d = await api(`/api/panel/horario-mes?colaboradora=${chicaId}&mes=${mes}`);
  const porFecha = new Map(d.dias.map((x) => [x.fecha, x]));
  const festivos = new Map(d.festivos.map((x) => [x.fecha, x.motivo]));
  const semanal = new Map(d.semanal.map((x) => [x.dia, x]));
  const n = diasDelMes(mes);
  const hueco = (diaSem(`${mes}-01`) + 6) % 7; // lunes primero

  const efectivo = (f) => {
    const spa = horarioSpa(diaSem(f));
    if (festivos.has(f)) return { tipo: 'cerrado', texto: 'Festivo' };
    if (!spa?.abierto) return { tipo: 'cerrado', texto: 'Spa cerrado' };
    const o = porFecha.get(f);
    if (o) return o.trabaja ? { tipo: 'trabaja', propio: true, texto: `${corta(Math.max(o.abre, spa.abre))}–${corta(Math.min(o.cierra, spa.cierra))}` } : { tipo: 'libre', propio: true, texto: 'Libre' };
    const s = semanal.get(diaSem(f));
    if (s && !s.trabaja) return { tipo: 'libre', texto: 'Libre' };
    return { tipo: 'trabaja', texto: `${corta(Math.max(s ? s.abre : spa.abre, spa.abre))}–${corta(Math.min(s ? s.cierra : spa.cierra, spa.cierra))}` };
  };
  const fechas = Array.from({ length: n }, (_, i) => `${mes}-${String(i + 1).padStart(2, '0')}`);
  const abiertos = fechas.filter((f) => efectivo(f).tipo !== 'cerrado');
  const trabajados = fechas.filter((f) => efectivo(f).tipo === 'trabaja').length;

  pintar(v, html`
    <header class="cabeza-vista"><div><span class="script">Del equipo</span><h1>Horarios del <em>mes</em></h1></div></header>
    <p class="muted small">Elige los días, di si trabaja (y a qué hora) o si está libre, y toca Aplicar. Manda sobre su semana de siempre solo en esos días, y las reservas en línea lo respetan.</p>
    ${chicas.length > 1 ? html`<div class="filtro-etiquetas chicas-horario">${chicas.map((c) => html`<button class="chip chip-et" data-chica="${c.id}" data-c="${c.color}" aria-pressed="${c.id === chicaId}">${c.nombre}</button>`)}</div>` : ''}
    <div class="nav-periodo">
      <button class="icono-btn" data-mes="-1" aria-label="Mes anterior">${crudo(ICONOS.atras)}</button>
      <div class="nav-periodo-centro"><strong>${nombreMes(mes)} ${mes.slice(0, 4)}</strong>
        <input type="month" class="input-periodo" id="saltoMes" value="${mes}" aria-label="Elegir mes"></div>
      <button class="icono-btn voltear" data-mes="1" aria-label="Mes siguiente">${crudo(ICONOS.atras)}</button>
    </div>
    <div class="resumen-horario">
      <span class="avatar inicial" data-c="${chica.color}">${inicial(chica.nombre)}</span>
      <span><strong>${chica.nombre}</strong><small class="muted">${trabajados} días de trabajo en ${nombreMes(mes)}</small></span>
    </div>

    <div class="atajos-horario" role="group" aria-label="Elegir rápido">
      <button class="chip" data-atajo="todo">Todo el mes</button>
      <button class="chip" data-atajo="semana">Lun a Vie</button>
      <button class="chip" data-atajo="finde">Sáb y Dom</button>
      <button class="chip" data-atajo="q1">Del 1 al 15</button>
      <button class="chip" data-atajo="q2">Del 16 al ${n}</button>
      <button class="chip chip-rango" id="porRango" aria-pressed="${porRango}">↔ Por rango</button>
    </div>
    <p class="muted small ayuda-rango" id="ayudaRango" ${porRango ? '' : crudo('hidden')}>${inicioRango ? `Ahora toca el último día (desde el ${Number(inicioRango.slice(8))}).` : 'Toca el primer día y luego el último: se eligen todos los del medio.'}</p>

    <div class="leyenda leyenda-horario"><span><i class="ley lh-trabaja" data-c="${chica.color}"></i>Trabaja</span><span><i class="ley lh-libre"></i>Libre</span><span><i class="ley lh-cerrado"></i>Spa cerrado</span><span><i class="punto-propio"></i>Ajustado</span></div>
    <div class="cal-horario" data-c="${chica.color}">
      ${CABEZA.map(([t, ds]) => html`<button type="button" class="ch-cabeza" data-columna="${ds}" title="Elegir todos los ${NOMBRE_DIA[ds]}">${t}</button>`)}
      ${Array.from({ length: hueco }, () => html`<span class="ch-vacio"></span>`)}
      ${fechas.map((f) => { const e = efectivo(f); return html`<button type="button" class="ch-dia ${e.tipo} ${f === S.hoy ? 'hoy' : ''}" data-fecha="${f}" ${e.tipo === 'cerrado' ? crudo('disabled') : ''} aria-pressed="false">
        <b>${Number(f.slice(8))}</b><small>${e.texto}</small>${e.propio ? html`<i class="punto-propio" aria-label="ajustado"></i>` : ''}</button>`; })}
    </div>

    <details class="tarjeta bloque-ajustes intervalo-fechas espacio-arriba">
      <summary><strong>Elegir un intervalo de fechas</strong><span class="muted small">por ejemplo del 1 al 20, solo lunes a sábado</span></summary>
      <div class="dos-col espacio-arriba"><label class="campo"><span>Desde</span><input type="date" id="intDesde" value="${mes}-01"></label>
        <label class="campo"><span>Hasta</span><input type="date" id="intHasta" value="${fechas[n - 1]}"></label></div>
      <div class="dias-intervalo" role="group" aria-label="Días de la semana">${CABEZA.map(([t, ds]) => html`<label class="chip-check"><input type="checkbox" value="${ds}" checked><span>${t}</span></label>`)}</div>
      <button class="btn sec bloque espacio-arriba" id="elegirIntervalo">Elegir esos días</button>
    </details>

    <section class="tarjeta bloque-ajustes panel-aplicar" id="panelAplicar" hidden>
      <div class="pa-cabeza"><h2 id="cuentaSel"></h2><button class="btn ghost chico" id="quitarSel">Quitar selección</button></div>
      <div class="segmentado ancho">${[['trabaja', 'Trabaja'], ['libre', 'Libre'], ['semana', 'Semana tipo']].map(([k, t]) => html`<button data-modo-h="${k}" aria-pressed="${k === modo}">${t}</button>`)}</div>
      <div class="dos-col" id="horasTrabajo" ${modo === 'trabaja' ? '' : crudo('hidden')}><label class="campo"><span>Entra</span><input type="time" id="hAbre" step="300" value="${horas.abre}"></label><label class="campo"><span>Sale</span><input type="time" id="hCierra" step="300" value="${horas.cierra}"></label></div>
      <p class="muted small" id="ayudaModo"></p>
      <button class="btn bloque" id="aplicar">Aplicar</button>
    </section>

    <section class="tarjeta bloque-ajustes espacio-arriba">
      <h2>Repetir el horario</h2>
      <p class="muted small">Copia lo ajustado de ${nombreMes(mes)} a ${nombreMes(moverMes(mes, 1))}, día de la semana por día de la semana (1.er lunes → 1.er lunes…).</p>
      <button class="btn sec" id="copiarMes">Copiar a ${nombreMes(moverMes(mes, 1))}</button>
    </section>`);
  for (const el of v.querySelectorAll('[data-c]')) el.style.setProperty('--c', el.dataset.c);

  const recargarVista = () => vista(v);
  const cal = $('.cal-horario', v);
  const panel = $('#panelAplicar', v);

  // ---- selección sin recargar la pantalla ----
  function refrescar() {
    for (const b of $$('.ch-dia', cal)) {
      const si = elegidos.has(b.dataset.fecha);
      b.classList.toggle('elegido', si);
      b.setAttribute('aria-pressed', String(si));
      b.classList.toggle('inicio-rango', b.dataset.fecha === inicioRango);
    }
    const total = elegidos.size;
    const fuera = [...elegidos].filter((f) => !f.startsWith(mes)).length;
    panel.hidden = !total;
    document.body.classList.toggle('con-panel-horario', total > 0); // el botón + no tapa "Aplicar"
    $('#cuentaSel', v).textContent = `${total} día${total === 1 ? '' : 's'} elegido${total === 1 ? '' : 's'}${fuera ? ` (${fuera} de otros meses)` : ''}`;
    $('#aplicar', v).textContent = `Aplicar a ${total} día${total === 1 ? '' : 's'}`;
    $('#ayudaModo', v).textContent = modo === 'semana' ? 'Esos días vuelven a su horario semanal de siempre.' : modo === 'libre' ? 'Esos días no recibe citas.' : 'Las horas se ajustan solas al horario del spa de cada día.';
    $('#porRango', v).setAttribute('aria-pressed', String(porRango));
    const ayuda = $('#ayudaRango', v);
    ayuda.hidden = !porRango;
    ayuda.textContent = inicioRango ? `Ahora toca el último día (desde el ${Number(inicioRango.slice(8))}).` : 'Toca el primer día y luego el último: se eligen todos los del medio.';
  }
  const poner = (lista, valor = true) => { for (const f of lista) { if (valor) elegidos.add(f); else elegidos.delete(f); } refrescar(); };
  const alternarGrupo = (lista) => poner(lista, !lista.every((f) => elegidos.has(f)));

  cal.addEventListener('click', (e) => {
    if (arrastro) return;
    const dia = e.target.closest('.ch-dia');
    if (dia && !dia.disabled) {
      const f = dia.dataset.fecha;
      if (porRango) {
        if (!inicioRango) { inicioRango = f; elegidos.add(f); return refrescar(); }
        const [a, b] = [inicioRango, f].sort();
        inicioRango = null;
        return poner(abiertos.filter((x) => x >= a && x <= b));
      }
      return poner([f], !elegidos.has(f));
    }
    const col = e.target.closest('[data-columna]');
    if (col) alternarGrupo(abiertos.filter((f) => diaSem(f) === Number(col.dataset.columna)));
  });

  // Con mouse (computador) se puede arrastrar sobre los días para elegir varios.
  cal.addEventListener('pointerdown', (e) => {
    const dia = e.target.closest('.ch-dia');
    if (e.pointerType !== 'mouse' || !dia || dia.disabled || porRango) return;
    arrastrando = true; arrastro = false; valorArrastre = !elegidos.has(dia.dataset.fecha);
  });
  cal.addEventListener('pointerover', (e) => {
    if (!arrastrando) return;
    const dia = e.target.closest('.ch-dia');
    if (!dia || dia.disabled) return;
    arrastro = true;
    poner([dia.dataset.fecha], valorArrastre);
  });

  for (const b of $$('[data-atajo]', v)) {
    b.onclick = () => {
      const k = b.dataset.atajo;
      const grupo = abiertos.filter((f) => {
        const ds = diaSem(f), dd = Number(f.slice(8));
        return k === 'todo' || (k === 'semana' && ds >= 1 && ds <= 5) || (k === 'finde' && (ds === 0 || ds === 6)) || (k === 'q1' && dd <= 15) || (k === 'q2' && dd >= 16);
      });
      alternarGrupo(grupo);
    };
  }
  $('#porRango', v).onclick = () => { porRango = !porRango; inicioRango = null; refrescar(); };
  $('#quitarSel', v).onclick = () => { elegidos = new Set(); inicioRango = null; refrescar(); };
  $('#elegirIntervalo', v).onclick = () => {
    let a = $('#intDesde', v).value, b = $('#intHasta', v).value;
    if (!a || !b) return toast('Elige las dos fechas.');
    if (a > b) [a, b] = [b, a];
    const dias = new Set($$('.dias-intervalo input:checked', v).map((x) => Number(x.value)));
    if (!dias.size) return toast('Marca al menos un día de la semana.');
    const lista = [];
    for (let f = a; f <= b && lista.length <= 93; f = sumarDias(f, 1)) if (dias.has(diaSem(f)) && spaAbre(f) && !festivos.has(f)) lista.push(f);
    if (lista.length > 93) return toast('Máximo 93 días a la vez (unos 3 meses).');
    poner(lista);
    toast(`${lista.length} días elegidos`, 'ok');
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  // ---- aplicar ----
  for (const b of $$('[data-modo-h]', v)) {
    b.onclick = () => {
      leerHoras(v);
      modo = b.dataset.modoH;
      for (const x of $$('[data-modo-h]', v)) x.setAttribute('aria-pressed', String(x === b));
      $('#horasTrabajo', v).hidden = modo !== 'trabaja';
      refrescar();
    };
  }
  $('#aplicar', v).addEventListener('click', (e) => ocupado(e.currentTarget, async () => {
    leerHoras(v);
    if (modo === 'trabaja' && (aMin(horas.cierra) ?? 0) <= (aMin(horas.abre) ?? 0)) return toast('La hora de salida debe ser después de la entrada.', 'error');
    const lista = [...elegidos].sort();
    if (lista.length > 93) return toast('Máximo 93 días a la vez. Aplica por partes.', 'error');
    const cambios = lista.map((fecha) => ({ fecha, modo, abre: horas.abre, cierra: horas.cierra }));
    try {
      await api(`/api/panel/horario-mes/${chicaId}`, { metodo: 'PUT', datos: { cambios } });
      toast(`Horario guardado (${cambios.length} día${cambios.length === 1 ? '' : 's'})`, 'ok');
      elegidos = new Set();
      inicioRango = null;
      recargarVista();
    } catch (x) { toast(x.message, 'error'); }
  }));

  // ---- navegación ----
  for (const b of $$('[data-chica]', v)) b.onclick = () => { chicaId = Number(b.dataset.chica); elegidos = new Set(); inicioRango = null; recargarVista(); };
  for (const b of $$('[data-mes]', v)) b.onclick = () => { mes = moverMes(mes, Number(b.dataset.mes)); inicioRango = null; recargarVista(); };
  $('#saltoMes', v).onchange = (e) => { if (e.target.value) { mes = e.target.value; inicioRango = null; recargarVista(); } };
  $('#copiarMes', v).onclick = async (e) => {
    const sig = moverMes(mes, 1);
    if (!(await confirmar(`¿Copiar a ${nombreMes(sig)}?`, `Se reemplaza lo ajustado de ${chica.nombre} en ${nombreMes(sig)} por lo de este mes.`, { si: 'Copiar' }))) return;
    ocupado(e.target, async () => {
      try { const r = await api(`/api/panel/horario-mes/${chicaId}/copiar`, { metodo: 'POST', datos: { de: mes, a: sig } }); toast(`Copiado: ${r.dias} días`, 'ok'); mes = sig; recargarVista(); } catch (x) { toast(x.message, 'error'); }
    });
  };
  refrescar();
}

function leerHoras(v) {
  const a = $('#hAbre', v), c = $('#hCierra', v);
  if (a && c) horas = { abre: a.value || horas.abre, cierra: c.value || horas.cierra };
}
