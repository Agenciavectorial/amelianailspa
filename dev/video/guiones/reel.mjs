// Reel corto para redes (Instagram, TikTok, estados): "Ya tenemos nuestra propia app".
import * as A from '../acciones.mjs';

const escenas = [
  { id: 'r01', bloque: 'r1', capitulo: 'Nuestra app', texto: '¡Hola, hermosa! Ya tenemos nuestra propia app.',
    accion: A.reel.hola },
  { id: 'r02', bloque: 'r1', capitulo: 'Agenda en un minuto', texto: 'Agenda tu cita en menos de un minuto: eliges tu servicio, con quién, y la hora que mejor te quede.',
    accion: A.reel.agendar },
  { id: 'r03', bloque: 'r1', capitulo: 'Servicios y diseños', texto: 'Mira nuestros servicios y diseños, y te recordamos tu cita para que no se te pase.',
    accion: A.reel.combos },
  { id: 'r04', bloque: 'r1', capitulo: 'amelianailspa.com', texto: 'Instálala gratis desde amelianailspa punto com. ¡Te esperamos para consentirte!', mantener: true,
    accion: A.reel.instalar },
];

export default {
  id: 'reel',
  pausa: 0.7,
  titulo: 'Ya tenemos nuestra app',
  subtitulo: 'Agenda tu cita en un minuto',
  para: 'Amelia Nail Spa',
  escenas,
  bloques: [{ id: 'r1', escenas }],
};
