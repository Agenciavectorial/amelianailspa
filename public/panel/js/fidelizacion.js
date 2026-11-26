// Fidelización: a quién le toca volver (ciclo de retorno del servicio), cumpleaños e inactivas para recuperar.
import { api, html, crudo, pintar, $, $$, fechaLarga, celularBonito, ICONOS, SITIO } from '/app-citas/js/util.js?v=63bc4ab2f0';
import { S, esDuena } from './estado.js?v=63bc4ab2f0';
import { enviar, textoPlantilla } from './mensajes.js?v=63bc4ab2f0';
import { enlaceRepetir } from './inicio.js?v=63bc4ab2f0';

let pestana = 'contactar';

export async function vista(v) {
  const d = await api('/api/panel/fidelizacion');
  const listas = {
    contactar: d.a_contactar.map((c) => ({ ...c, motivo: `${c.servicios} · última vez ${fechaLarga(c.ultima)} con ${c.colaboradora}`, extra: c.toca <= S.hoy ? 'Le toca ya' : `Le toca el ${fechaLarga(c.toca)}`, tipo: 'vuelve' })),
    cumple: d.cumpleanos.map((c) => ({ ...c, motivo: `Cumpleaños: ${c.cumpleanos.split('-').reverse().join('/')}`, tipo: 'cumpleanos' })),
    inactivas: d.inactivas.map((c) => ({ ...c, motivo: `${c.visitas} visita${c.visitas > 1 ? 's' : ''} · última hace ${c.dias} días (${c.servicios})`, tipo: 'recuperar' })),
  };
  pintar(v, html`
    <header class="cabeza-vista"><div><span class="script">Que vuelvan</span><h1>Fidelización</h1></div></header>
    <div class="stats mini fid-stats">
      <div class="stat"><span>Les toca volver</span><strong>${listas.contactar.length}</strong></div>
      <div class="stat"><span>Recurrentes</span><strong>${d.recurrentes}</strong></div>
      <div class="stat"><span>Inactivas (+${d.dias_inactiva} días)</span><strong>${listas.inactivas.length}</strong></div>
    </div>
    <p class="muted small espacio-arriba">Cada servicio tiene un "ciclo de retorno" (Servicios → editar). Cuando a una clienta le toca volver y no tiene cita, aparece aquí con el mensaje listo para WhatsApp. Al escribirle sale de la lista.</p>
    <div class="segmentado ancho">${[['contactar', 'Les toca volver'], ['cumple', 'Cumpleaños'], ['inactivas', 'Recuperar']].map(([k, t]) => html`<button data-p="${k}" aria-pressed="${k === pestana}">${t} (${listas[k].length})</button>`)}</div>
    <div class="lista-citas">${listas[pestana].length ? listas[pestana].map((c, i) => html`
      <div class="fila-gestionar tarjeta">
        <span class="fg-texto"><strong>${c.nombre}</strong><span>${c.motivo}</span>${c.extra ? html`<small>${c.extra}</small>` : html`<small>${celularBonito(c.celular)}</small>`}</span>
        ${esDuena() ? html`<button class="btn wa chico" data-i="${i}">${crudo(ICONOS.whatsapp)} Escribir</button>` : ''}
      </div>`) : html`<div class="vacio">${crudo(ICONOS.chispa)}<p>Nadie en esta lista por ahora.</p></div>`}</div>`);
  for (const b of $$('[data-p]', v)) b.onclick = () => { pestana = b.dataset.p; vista(v); };
  v.querySelector('.lista-citas').onclick = (e) => {
    const b = e.target.closest('[data-i]');
    if (!b) return;
    const c = listas[pestana][Number(b.dataset.i)];
    const nombre = c.nombre.split(' ')[0];
    let texto;
    if (c.tipo === 'cumpleanos') texto = `¡Feliz cumpleaños, ${nombre}! 🎂💜 Todo el equipo de ${S.ajustes.nombre_spa || 'Amelia Nail Spa'} te desea un día precioso. Te esperamos para consentirte: ${SITIO}/reservar/`;
    else if (c.tipo === 'recuperar') texto = `¡Hola ${nombre}! 💜 Te extrañamos en ${S.ajustes.nombre_spa || 'Amelia Nail Spa'}. ¿Te animas a consentirte esta semana? Reserva en un toque: ${enlaceRepetir(c)}`;
    else texto = textoPlantilla('vuelve', { nombre, servicio: c.servicios, colaboradora: c.colaboradora, enlace: enlaceRepetir(c), spa: S.ajustes.nombre_spa });
    enviar(c.celular, texto, { clienta_id: c.clienta_id, tipo: c.tipo });
    b.closest('.fila-gestionar').classList.add('hecha');
  };
  void $;
}
