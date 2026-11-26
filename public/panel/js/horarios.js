// Horarios del mes: Erika arma el horario de cada chica día por día (todo el mes, o el que quiera).
// Lo que se pone aquí manda sobre la semana tipo solo en esas fechas; las reservas en línea lo respetan.
// Uso: elegir chica → tocar días (o una columna para "todos los lunes") → Trabaja / Libre / Semana tipo → Aplicar.
import { api, html, crudo, pintar, $, $$, toast, ocupado, confirmar, aMin, ICONOS, inicial } from '/app-citas/js/util.js?v=63bc4ab2f0';
import { S, esDuena, horarioSpa, recargar } from './estado.js?v=63bc4ab2f0';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const CABEZA = [['L', 1], ['M', 2], ['M', 3], ['J', 4], ['V', 5], ['S', 6], ['D', 0]];

let mes = null;          // 'AAAA-MM'
let chicaId = null;
let elegidos = new Set();
let modo = 'trabaja';
let horas = { abre: '09:00', cierra: '19:00' };

const diasDelMes = (m) => { const [y, mm] = m.split('-').map(Number); return new Date(Date.UTC(y, mm, 0)).getUTCDate(); };
const diaSem = (f) => new Date(f + 'T12:00:00Z').getUTCDay();
function moverMes(m, n) { const [y, mm] = m.split('-').map(Number); const d = new Date(Date.UTC(y, mm - 1 + n, 1)); return d.toISOString().slice(0, 7); }
const corta = (min) => { const h = Math.floor(min / 60), m = min % 60; return `${((h + 11) % 12) + 1}${m ? ':' + String(m).padStart(2, '0') : ''}${h < 12 ? 'a' : 'p'}`; };

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
  const primero = `${mes}-01`;
  const hueco = (diaSem(primero) + 6) % 7; // lunes primero

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
  const trabajados = fechas.filter((f) => efectivo(f).tipo === 'trabaja').length;

  pintar(v, html`
    <header class="cabeza-vista"><div><span class="script">Del equipo</span><h1>Horarios del <em>mes</em></h1></div></header>
    <p class="muted small">Arma el horario de cada chica día por día. Lo que pongas aquí manda sobre su semana tipo solo en esos días, y las reservas en línea lo respetan.</p>
    ${chicas.length > 1 ? html`<div class="filtro-etiquetas chicas-horario">${chicas.map((c) => html`<button class="chip chip-et" data-chica="${c.id}" data-c="${c.color}" aria-pressed="${c.id === chicaId}">${c.nombre}</button>`)}</div>` : ''}
    <div class="nav-periodo">
      <button class="icono-btn" data-mes="-1" aria-label="Mes anterior">${crudo(ICONOS.atras)}</button>
      <div class="nav-periodo-centro"><strong>${MESES[Number(mes.slice(5)) - 1]} ${mes.slice(0, 4)}</strong>
        <input type="month" class="input-periodo" id="saltoMes" value="${mes}" aria-label="Elegir mes"></div>
      <button class="icono-btn voltear" data-mes="1" aria-label="Mes siguiente">${crudo(ICONOS.atras)}</button>
    </div>
    <div class="resumen-horario">
      <span class="avatar inicial" data-c="${chica.color}">${inicial(chica.nombre)}</span>
      <span><strong>${chica.nombre}</strong><small class="muted">${trabajados} días de trabajo en ${MESES[Number(mes.slice(5)) - 1]}</small></span>
    </div>
    <div class="leyenda leyenda-horario"><span><i class="ley lh-trabaja" data-c="${chica.color}"></i>Trabaja</span><span><i class="ley lh-libre"></i>Libre</span><span><i class="ley lh-cerrado"></i>Spa cerrado</span><span><i class="punto-propio"></i>Ajustado este mes</span></div>
    <div class="cal-horario" data-c="${chica.color}">
      ${CABEZA.map(([t, ds]) => html`<button type="button" class="ch-cabeza" data-columna="${ds}" title="Elegir todos los ${['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados'][ds]}">${t}</button>`)}
      ${Array.from({ length: hueco }, () => html`<span class="ch-vacio"></span>`)}
      ${fechas.map((f) => { const e = efectivo(f); return html`<button type="button" class="ch-dia ${e.tipo} ${elegidos.has(f) ? 'elegido' : ''} ${f === S.hoy ? 'hoy' : ''}" data-fecha="${f}" ${e.tipo === 'cerrado' ? crudo('disabled') : ''} aria-pressed="${elegidos.has(f)}">
        <b>${Number(f.slice(8))}</b><small>${e.texto}</small>${e.propio ? html`<i class="punto-propio" aria-label="ajustado"></i>` : ''}</button>`; })}
    </div>
    <div class="fila-botones espacio-arriba"><button class="btn ghost chico" id="elegirTodo">Elegir todo el mes</button><button class="btn ghost chico" id="quitarSel" ${elegidos.size ? '' : crudo('hidden')}>Quitar selección</button></div>
    <section class="tarjeta bloque-ajustes panel-aplicar" ${elegidos.size ? '' : crudo('hidden')}>
      <h2>${elegidos.size} día${elegidos.size === 1 ? '' : 's'} elegido${elegidos.size === 1 ? '' : 's'}</h2>
      <div class="segmentado ancho">${[['trabaja', 'Trabaja'], ['libre', 'Libre'], ['semana', 'Semana tipo']].map(([k, t]) => html`<button data-modo-h="${k}" aria-pressed="${k === modo}">${t}</button>`)}</div>
      ${modo === 'trabaja' ? html`<div class="dos-col"><label class="campo"><span>Entra</span><input type="time" id="hAbre" step="300" value="${horas.abre}"></label><label class="campo"><span>Sale</span><input type="time" id="hCierra" step="300" value="${horas.cierra}"></label></div>` : ''}
      <p class="muted small">${modo === 'semana' ? 'Esos días vuelven a su horario semanal de siempre.' : modo === 'libre' ? 'Esos días no recibe citas.' : 'Las horas se ajustan solas al horario del spa de cada día.'}</p>
      <button class="btn bloque" id="aplicar">Aplicar a ${elegidos.size} día${elegidos.size === 1 ? '' : 's'}</button>
    </section>
    <section class="tarjeta bloque-ajustes espacio-arriba">
      <h2>Repetir el horario</h2>
      <p class="muted small">Copia lo ajustado de ${MESES[Number(mes.slice(5)) - 1]} a ${MESES[Number(moverMes(mes, 1).slice(5)) - 1]}, día de la semana por día de la semana (1.er lunes → 1.er lunes…).</p>
      <button class="btn sec" id="copiarMes">Copiar a ${MESES[Number(moverMes(mes, 1).slice(5)) - 1]}</button>
    </section>`);
  for (const el of v.querySelectorAll('[data-c]')) el.style.setProperty('--c', el.dataset.c);

  const repintar = () => vista(v);
  for (const b of $$('[data-chica]', v)) b.onclick = () => { chicaId = Number(b.dataset.chica); elegidos = new Set(); repintar(); };
  for (const b of $$('[data-mes]', v)) b.onclick = () => { mes = moverMes(mes, Number(b.dataset.mes)); elegidos = new Set(); repintar(); };
  $('#saltoMes', v).onchange = (e) => { if (e.target.value) { mes = e.target.value; elegidos = new Set(); repintar(); } };
  v.querySelector('.cal-horario').onclick = (e) => {
    const dia = e.target.closest('.ch-dia');
    if (dia && !dia.disabled) { const f = dia.dataset.fecha; if (elegidos.has(f)) elegidos.delete(f); else elegidos.add(f); return repintar(); }
    const col = e.target.closest('[data-columna]');
    if (col) {
      const ds = Number(col.dataset.columna);
      const delDia = fechas.filter((f) => diaSem(f) === ds && efectivo(f).tipo !== 'cerrado');
      const todos = delDia.every((f) => elegidos.has(f));
      for (const f of delDia) { if (todos) elegidos.delete(f); else elegidos.add(f); }
      repintar();
    }
  };
  $('#elegirTodo', v).onclick = () => { for (const f of fechas) if (efectivo(f).tipo !== 'cerrado') elegidos.add(f); repintar(); };
  $('#quitarSel', v).onclick = () => { elegidos = new Set(); repintar(); };
  for (const b of $$('[data-modo-h]', v)) b.onclick = () => { leerHoras(v); modo = b.dataset.modoH; repintar(); };
  $('#aplicar', v)?.addEventListener('click', (e) => ocupado(e.currentTarget, async () => {
    leerHoras(v);
    if (modo === 'trabaja' && (aMin(horas.cierra) ?? 0) <= (aMin(horas.abre) ?? 0)) return toast('La hora de salida debe ser después de la entrada.', 'error');
    const cambios = [...elegidos].sort().map((fecha) => ({ fecha, modo, abre: horas.abre, cierra: horas.cierra }));
    try {
      await api(`/api/panel/horario-mes/${chicaId}`, { metodo: 'PUT', datos: { cambios } });
      toast(`Horario guardado (${cambios.length} día${cambios.length === 1 ? '' : 's'})`, 'ok');
      elegidos = new Set();
      repintar();
    } catch (x) { toast(x.message, 'error'); }
  }));
  $('#copiarMes', v).onclick = async (e) => {
    const sig = moverMes(mes, 1);
    if (!(await confirmar(`¿Copiar a ${MESES[Number(sig.slice(5)) - 1]}?`, `Se reemplaza lo ajustado de ${chica.nombre} en ${MESES[Number(sig.slice(5)) - 1]} por lo de este mes.`, { si: 'Copiar' }))) return;
    ocupado(e.target, async () => {
      try { const r = await api(`/api/panel/horario-mes/${chicaId}/copiar`, { metodo: 'POST', datos: { de: mes, a: sig } }); toast(`Copiado: ${r.dias} días`, 'ok'); mes = sig; repintar(); } catch (x) { toast(x.message, 'error'); }
    });
  };
}

function leerHoras(v) {
  const a = $('#hAbre', v), c = $('#hCierra', v);
  if (a && c) horas = { abre: a.value || horas.abre, cierra: c.value || horas.cierra };
}

