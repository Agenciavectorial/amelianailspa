// Tour corto la primera vez que cada persona entra (se puede saltar y volver a ver desde Mi cuenta).
import { html, crudo, pintar, $, ICONOS } from '/app-citas/js/util.js?v=ebff92790b';
import { S, esDuena, puede } from './estado.js?v=ebff92790b';

const clave = () => `amelia_tour_v1_${S.yo?.id}`;

function pasos() {
  const l = [
    { icono: ICONOS.chispa, titulo: `¡Hola, ${S.yo.nombre.split(' ')[0]}!`, texto: 'Esta es tu agenda de Amelia Nail Spa. Todo lo que hagas aquí se ve al instante en los celulares del equipo y en la reserva de las clientas.' },
    { icono: ICONOS.calendario, titulo: 'Tus citas en tarjetas', texto: 'En Agenda ves cada cita en grande. Con un toque escribes por WhatsApp, llamas, marcas que llegó o cobras.' },
  ];
  if (puede('gestionar_citas')) l.push({ icono: ICONOS.mas, titulo: 'Agendar en segundos', texto: 'El botón + de abajo crea una cita: eliges el servicio, la hora y la clienta. Listo.' });
  l.push(esDuena()
    ? { icono: ICONOS.equipo, titulo: 'Tú lo controlas todo', texto: 'En Más encuentras servicios y galerías, equipo, horarios, promociones, mensajes y la apariencia de la reserva.' }
    : { icono: ICONOS.usuaria, titulo: 'Hazla tuya', texto: 'En Más → Mi cuenta eliges tu foto, tu color en la agenda y activas los avisos en tu celular.' });
  return l;
}

export function tourSiEsPrimeraVez() {
  try { if (localStorage.getItem(clave()) || localStorage.getItem('amelia_tour_omitir')) return; } catch { return; }
  mostrarTour();
}

export function mostrarTour() {
  const lista = pasos();
  let i = 0;
  const capa = document.createElement('div');
  capa.className = 'tour';
  capa.setAttribute('role', 'dialog');
  capa.setAttribute('aria-modal', 'true');
  capa.setAttribute('aria-label', 'Bienvenida');
  document.body.append(capa);
  const terminar = () => {
    try { localStorage.setItem(clave(), '1'); } catch { /* sin almacenamiento */ }
    capa.remove();
  };
  const pintarPaso = () => {
    const p = lista[i];
    pintar(capa, html`<div class="tour-tarjeta">
      <span class="tour-icono">${crudo(p.icono)}</span>
      <h2>${p.titulo}</h2>
      <p>${p.texto}</p>
      <div class="tour-puntos">${lista.map((_, k) => html`<span class="${k === i ? 'activo' : ''}"></span>`)}</div>
      <div class="tour-botones">
        <button class="btn ghost" id="tourSaltar">${i === lista.length - 1 ? 'Cerrar' : 'Saltar'}</button>
        <button class="btn" id="tourSeguir" autofocus>${i === lista.length - 1 ? '¡Empezar!' : 'Siguiente'}</button>
      </div>
    </div>`);
    $('#tourSaltar', capa).onclick = terminar;
    $('#tourSeguir', capa).onclick = () => { if (i < lista.length - 1) { i++; pintarPaso(); } else terminar(); };
    $('#tourSeguir', capa).focus();
  };
  pintarPaso();
}
