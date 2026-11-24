// Selector de día + turno (lo usan la reserva y la página para reprogramar).
import { html, crudo, pintar, $, $$, DIAS_CORTOS, MESES, fechaD, sumarDias, hora, fechaLarga, ICONOS } from '/app-citas/js/util.js?v=f24229204c';

const TRAMO = 14;

/**
 * @param {object} o
 * @param {HTMLElement} o.raiz
 * @param {string} o.hoy
 * @param {number} o.ventana              días hacia adelante
 * @param {(desde:string,n:number)=>Promise<Record<string,number>>} o.cargarDias
 * @param {(fecha:string)=>Promise<{inicio:number,fin:number}[]>} o.cargarTurnos
 * @param {(fecha:string, turno:{inicio:number,fin:number})=>void} o.alElegir
 * @param {string} [o.fecha]  fecha preseleccionada
 * @param {number} [o.inicio] turno preseleccionado
 */
export function crearSelector(o) {
  const dias = {};          // fecha -> n turnos (undefined = sin cargar)
  let hasta = o.hoy;        // última fecha cargada (exclusiva)
  let fecha = o.fecha || null;
  let elegido = o.inicio ?? null;
  const limite = sumarDias(o.hoy, o.ventana);

  pintar(o.raiz, html`
    <div class="dias-cabeza"><h3 id="mesTitulo"></h3></div>
    <div class="dias" role="listbox" aria-label="Días disponibles"></div>
    <div class="turnos"></div>`);
  const tira = $('.dias', o.raiz);
  const cajaTurnos = $('.turnos', o.raiz);

  async function cargarMas() {
    if (hasta > limite) return;
    const desde = hasta;
    const n = Math.min(TRAMO, 1 + Math.round((fechaD(limite) - fechaD(desde)) / 86400000));
    if (n <= 0) return;
    hasta = sumarDias(desde, n);
    for (let i = 0; i < n; i++) {
      const f = sumarDias(desde, i);
      const d = fechaD(f);
      const b = document.createElement('button');
      b.className = 'dia cargando';
      b.dataset.fecha = f;
      b.setAttribute('role', 'option');
      b.innerHTML = String(html`<span class="dia-sem">${f === o.hoy ? 'hoy' : DIAS_CORTOS[d.getUTCDay()]}</span><span class="dia-num">${d.getUTCDate()}</span><span class="dia-punto"></span>`);
      b.disabled = true;
      tira.append(b);
    }
    try {
      const res = await o.cargarDias(desde, n);
      Object.assign(dias, res);
    } catch {
      for (let i = 0; i < n; i++) dias[sumarDias(desde, i)] = 0;
    }
    for (const b of $$('.dia.cargando', tira)) {
      const c = dias[b.dataset.fecha];
      if (c === undefined) continue;
      b.classList.remove('cargando');
      b.disabled = !c;
      b.classList.toggle('lleno', !c);
      b.title = c ? `${c} horarios` : 'Sin horarios';
    }
  }

  function actualizarMes() {
    const f = fecha || o.hoy;
    const d = fechaD(f);
    $('#mesTitulo', o.raiz).textContent = `${MESES[d.getUTCMonth()][0].toUpperCase()}${MESES[d.getUTCMonth()].slice(1)} ${d.getUTCFullYear()}`;
  }

  async function elegirDia(f, desplazar = true) {
    fecha = f;
    actualizarMes();
    for (const b of $$('.dia', tira)) b.setAttribute('aria-selected', String(b.dataset.fecha === f));
    const b = tira.querySelector(`[data-fecha="${f}"]`);
    if (b && desplazar) b.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    pintar(cajaTurnos, html`<div class="turnos-cargando"><span class="girando oscuro"></span></div>`);
    let turnos = [];
    try { turnos = await o.cargarTurnos(f); } catch (e) {
      pintar(cajaTurnos, html`<p class="aviso error">${e.message}</p>`);
      return;
    }
    if (fecha !== f) return;
    pintarTurnos(turnos);
  }

  function pintarTurnos(turnos) {
    if (!turnos.length) {
      pintar(cajaTurnos, html`<div class="vacio">${ICONOS_CAL}<p>No quedan horarios este día.<br>Prueba otro día.</p></div>`);
      return;
    }
    const grupos = [
      ['Mañana', turnos.filter((t) => t.inicio < 720)],
      ['Tarde', turnos.filter((t) => t.inicio >= 720 && t.inicio < 1020)],
      ['Noche', turnos.filter((t) => t.inicio >= 1020)],
    ].filter(([, l]) => l.length);
    pintar(cajaTurnos, html`
      <p class="turnos-fecha">${fechaLarga(fecha)}</p>
      ${grupos.map(([n, l]) => html`
        <div class="grupo-turnos">
          <h4>${n} <span>${l.length}</span></h4>
          <div class="rejilla-turnos">
            ${l.map((t) => html`<button class="turno" data-inicio="${t.inicio}" aria-pressed="${t.inicio === elegido}">${hora(t.inicio)}</button>`)}
          </div>
        </div>`)}`);
    for (const b of $$('.turno', cajaTurnos)) {
      b.onclick = () => {
        elegido = Number(b.dataset.inicio);
        for (const x of $$('.turno', cajaTurnos)) x.setAttribute('aria-pressed', String(x === b));
        const t = turnos.find((x) => x.inicio === elegido);
        o.alElegir(fecha, t);
      };
    }
  }

  tira.addEventListener('click', (e) => {
    const b = e.target.closest('.dia');
    if (b && !b.disabled) { elegido = null; elegirDia(b.dataset.fecha); o.alElegir(null, null); }
  });
  tira.addEventListener('scroll', () => {
    if (tira.scrollLeft + tira.clientWidth > tira.scrollWidth - 120) cargarMas();
  }, { passive: true });

  async function iniciar() {
    await cargarMas();
    // Busca el primer día con turnos (hasta toda la ventana)
    let primero = fecha && dias[fecha] ? fecha : Object.keys(dias).sort().find((f) => dias[f] > 0);
    while (!primero && hasta <= limite) {
      await cargarMas();
      primero = Object.keys(dias).sort().find((f) => dias[f] > 0);
    }
    if (primero) elegirDia(primero);
    else {
      actualizarMes();
      pintar(cajaTurnos, html`<div class="vacio">${ICONOS_CAL}<p>No encontramos horarios disponibles en las próximas semanas.<br>Escríbenos por WhatsApp y te ayudamos.</p></div>`);
    }
  }
  iniciar();
  return { recargar: () => fecha && elegirDia(fecha, false), get fecha() { return fecha; } };
}

const ICONOS_CAL = crudo(ICONOS.calendario);
