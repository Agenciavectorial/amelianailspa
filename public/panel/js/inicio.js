// Inicio: resumen del negocio, citas por gestionar (¿asistió?), próxima cita, hoy/mañana y clientas a contactar.
import { botonTema } from '/app-citas/js/util.js?v=0059637289';
import { api, html, crudo, pintar, $, toast, hora, dinero, fechaLarga, fechaCorta, sumarDias, inicial, ICONOS, SITIO } from '/app-citas/js/util.js?v=0059637289';
import { tarjetaDescarga, activarDescarga, tarjetaAvisos } from './descargar.js?v=0059637289';
import { S, esDuena, puede, colab, aplicarEstilos, moduloActivo } from './estado.js?v=0059637289';
import { verCita, nuevaCita, nuevoBloqueo, pastillaEstado, cobrar } from './citas.js?v=0059637289';
import { enviar, textoPlantilla } from './mensajes.js?v=0059637289';

function saludo() {
  const h = new Date(Date.now() - 5 * 3600000).getUTCHours();
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
}

export async function vista(v) {
  pintar(v, html`
    <header class="cabeza-vista">
      <div class="inicio-marca"><img class="inicio-logo" src="/app-citas/img/logo.webp" alt="" width="40" height="40"><div><span class="script">${saludo()}</span><h1>${S.yo.nombre.split(' ')[0]}, <em>${esDuena() ? 'así va tu negocio' : 'así va tu día'}</em></h1></div></div>
      ${botonTema()}
    </header>
    ${tarjetaDescarga()}
    <div id="tarjetaAvisos"></div>
    <div class="stats" id="stats">${[1, 2, 3, 4].map(() => html`<div class="stat esqueleto"></div>`)}</div>
    <div class="acciones-rapidas">
      ${puede('gestionar_citas') ? html`<button class="btn" id="irNueva">${crudo(ICONOS.mas)} Agendar cita</button>` : ''}
      ${puede('gestionar_citas') && moduloActivo('cuentas') ? html`<button class="btn sec" id="irVenta">💵 Registrar venta</button>` : ''}
      ${puede('gestionar_bloqueos') ? html`<button class="btn sec" id="irBloq">${crudo(ICONOS.reloj)} Bloquear horario</button>` : ''}
      <a class="btn sec" href="#/agenda">${crudo(ICONOS.calendario)} Calendario</a>
      <a class="btn sec" href="#/notas">Notas</a>
    </div>
    <div id="proxima"></div>
    <section class="bloque-inicio" id="bloqueGestionar" hidden><h2>Citas por gestionar <span class="muted">¿asistió?</span></h2><div id="listaGestionar"></div></section>
    <div class="columnas-inicio">
      <section class="bloque-inicio"><h2>Hoy <span class="muted">${fechaLarga(S.hoy)}</span></h2><div id="listaHoy"></div></section>
      <section class="bloque-inicio"><h2>Mañana</h2><div id="listaManana"></div></section>
    </div>
    ${puede('ver_clientas') ? html`<section class="bloque-inicio" id="bloqueContactar" hidden><h2>Clientas a contactar hoy <a class="muted" href="#/fidelizacion">ver todo</a></h2><div id="listaContactar"></div></section>` : ''}`);
  const recargar = () => vista(v);
  activarDescarga(v);
  tarjetaAvisos($('#tarjetaAvisos', v));
  $('#irNueva')?.addEventListener('click', () => nuevaCita({}, recargar));
  $('#irBloq')?.addEventListener('click', () => nuevoBloqueo({}, recargar));
  $('#irVenta')?.addEventListener('click', async () => (await import('./cuentas.js?v=0059637289')).nuevaVenta(recargar));

  const manana = sumarDias(S.hoy, 1);
  const filtro = puede('ver_agenda_equipo') ? '' : `&colaboradora=${S.yo.id}`;
  const [res, ag, pg, fid, cta] = await Promise.all([
    api('/api/panel/resumen2'),
    api(`/api/panel/agenda?desde=${S.hoy}&hasta=${manana}${filtro}`),
    api('/api/panel/por-gestionar'),
    puede('ver_clientas') ? api('/api/panel/fidelizacion').catch(() => null) : null,
    !esDuena() && moduloActivo('cuentas') ? api('/api/panel/cuentas').catch(() => null) : null,
  ]);
  const cl = res.clientas_mes;
  pintar($('#stats'), html`
    ${cta ? html`<a class="stat destacado" href="#/cuentas"><span>Ganas este mes</span><strong>${dinero(cta.mes.comision + cta.mes.propinas)}</strong><small>hoy ${dinero(cta.dia.comision + cta.dia.propinas)} · semana ${dinero(cta.semana.comision + cta.semana.propinas)}</small></a>`
    : html`<${crudo(esDuena() && moduloActivo('cuentas') ? 'a href="#/cuentas"' : 'div')} class="stat destacado"><span>${esDuena() ? 'Ingresos del mes' : 'Tus ingresos del mes'}</span><strong>${dinero(res.ingresos_mes.total)}</strong><small>${res.ingresos_mes.citas} ${res.ingresos_mes.citas === 1 ? 'cita cobrada' : 'citas cobradas'}${res.ingresos_mes.propinas ? ` · ${dinero(res.ingresos_mes.propinas)} propinas` : ''}</small></${crudo(esDuena() && moduloActivo('cuentas') ? 'a' : 'div')}>`}
    <div class="stat"><span>Citas esta semana</span><strong>${res.citas_semana}</strong><small>próximos 7 días</small></div>
    <div class="stat"><span>Asistencia del mes</span><strong>${res.asistencia_mes.pct != null ? res.asistencia_mes.pct + '%' : '—'}</strong><small>${res.asistencia_mes.si} ${res.asistencia_mes.si === 1 ? 'asistió' : 'asistieron'} · ${res.asistencia_mes.no} ${res.asistencia_mes.no === 1 ? 'faltó' : 'faltaron'}</small></div>
    <div class="stat"><span>Clientas del mes</span><strong>${cl.nuevas + cl.recurrentes}</strong><small>${cl.nuevas} ${cl.nuevas === 1 ? 'nueva' : 'nuevas'} · ${cl.recurrentes} ${cl.recurrentes === 1 ? 'recurrente' : 'recurrentes'}</small></div>`);

  if (res.proxima) {
    const p = res.proxima;
    pintar($('#proxima'), html`<button class="tarjeta proxima-cita" data-cita="${p.id}">
      <span class="pc-hora"><small>Próxima cita</small><strong>${p.fecha === S.hoy ? 'Hoy' : fechaCorta(p.fecha)} · ${hora(p.inicio)}</strong></span>
      <span class="pc-cuerpo"><strong>${p.clienta_nombre}</strong><span>${p.servicios} · con ${p.colaboradora_nombre}</span></span>
      <span class="flecha-mas">›</span></button>`);
    $('#proxima').onclick = () => verCita(p.id, recargar);
  }

  if (pg.citas.length) {
    $('#bloqueGestionar').hidden = false;
    pintar($('#listaGestionar'), html`<div class="lista-citas">${pg.citas.map((c) => html`
      <div class="fila-gestionar tarjeta" data-id="${c.id}">
        <span class="fg-texto"><strong>${c.servicios}</strong><span>${c.clienta_nombre} · con ${c.colaboradora_nombre}</span><small>${fechaLarga(c.fecha)} · ${hora(c.inicio)}</small></span>
        <span class="fg-botones">
          <button class="btn chico" data-asistio="1">Sí</button>
          <button class="btn sec chico" data-asistio="0">No</button>
        </span>
      </div>`)}</div>`);
    $('#listaGestionar').onclick = async (e) => {
      const b = e.target.closest('[data-asistio]');
      const fila = e.target.closest('.fila-gestionar');
      if (!fila) return;
      const c = pg.citas.find((x) => x.id === Number(fila.dataset.id));
      if (!b) return verCita(c.id, recargar);
      if (b.dataset.asistio === '1') {
        // Asistió: ofrece cobrar de una vez
        return cobrar(c, 0, recargar);
      }
      try {
        await api(`/api/panel/citas/${c.id}`, { metodo: 'PATCH', datos: { accion: 'estado', estado: 'no_asistio' } });
        toast('Marcada como no asistió');
        recargar();
      } catch (x) { toast(x.message, 'error'); }
    };
  }

  const pintarLista = (el, fecha) => {
    const l = ag.citas.filter((c) => c.fecha === fecha && c.estado !== 'cancelada');
    if (!l.length) { pintar(el, html`<div class="vacio chico">${crudo(ICONOS.calendario)}<p>Sin citas.</p></div>`); return; }
    pintar(el, html`<div class="lista-citas">${l.map((c) => {
      const co = colab(c.colaboradora_id);
      return html`<button class="fila-cita tarjeta" data-cita="${c.id}" data-propia="${c.propia ? 1 : 0}" data-c="${co?.color || '#A98BBE'}">
        <span class="fc-hora"><strong>${hora(c.inicio)}</strong><small>${hora(c.fin)}</small></span>
        <span class="fc-cuerpo"><strong>${c.clienta_nombre}</strong><span>${c.servicios.map((s) => s.nombre).join(' + ')}</span></span>
        <span class="fc-lado">${co ? html`<span class="fc-colab">${co.foto ? html`<img class="avatar" src="${co.foto}" alt="${co.nombre}">` : html`<span class="avatar inicial">${inicial(co.nombre)}</span>`}</span>` : ''}${c.estado !== 'confirmada' ? pastillaEstado(c.estado) : ''}</span>
      </button>`;
    })}</div>`);
    aplicarEstilos(el);
    el.onclick = (e) => {
      const b = e.target.closest('[data-cita]');
      if (b && b.dataset.propia === '1') verCita(Number(b.dataset.cita), recargar);
    };
  };
  pintarLista($('#listaHoy'), S.hoy);
  pintarLista($('#listaManana'), manana);

  if (esDuena() && fid && (fid.a_contactar.length || fid.cumpleanos.length)) {
    $('#bloqueContactar').hidden = false;
    const lista = [
      ...fid.cumpleanos.map((c) => ({ ...c, motivo: `🎂 Cumple el ${c.cumpleanos.split('-').reverse().join('/')}`, tipo: 'cumple' })),
      ...fid.a_contactar.slice(0, 6).map((c) => ({ ...c, motivo: `${c.servicios} · hace ${c.dias} días con ${c.colaboradora}`, tipo: 'vuelve' })),
    ];
    pintar($('#listaContactar'), html`<div class="lista-citas">${lista.map((c, i) => html`
      <div class="fila-gestionar tarjeta"><span class="fg-texto"><strong>${c.nombre}</strong><span>${c.motivo}</span></span>
      <button class="btn wa chico" data-i="${i}">${crudo(ICONOS.whatsapp)} Escribir</button></div>`)}</div>`);
    $('#listaContactar').onclick = (e) => {
      const b = e.target.closest('[data-i]');
      if (!b) return;
      const c = lista[Number(b.dataset.i)];
      const texto = c.tipo === 'cumple'
        ? `¡Feliz cumpleaños, ${c.nombre.split(' ')[0]}! 🎂💜\n\nTodo el equipo de Amelia Nail Spa te desea un día precioso.\n\nTe esperamos para consentirte:\n${SITIO}/reservar/`
        : textoPlantilla('vuelve', { nombre: c.nombre.split(' ')[0], servicio: c.servicios, colaboradora: c.colaboradora, enlace: enlaceRepetir(c), spa: S.ajustes.nombre_spa });
      enviar(c.celular, texto, { clienta_id: c.clienta_id, tipo: c.tipo === 'cumple' ? 'cumpleanos' : 'vuelve' });
      b.closest('.fila-gestionar').classList.add('hecha');
    };
  }
}

export function enlaceRepetir(c) {
  const p = new URLSearchParams();
  if (c.slugs) p.set('servicio', c.slugs.split(',')[0]);
  if (c.colab_slug) p.set('con', c.colab_slug);
  return `${SITIO}/reservar/?${p}`;
}
