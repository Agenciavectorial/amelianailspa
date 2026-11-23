// Video de la página y la reserva: "Erika, mira lo que le hicimos a tu página".
import * as A from '../acciones.mjs';

const escenas = [
  { id: 'p01', bloque: 'p1', capitulo: 'Antes', texto: 'Erika, mira lo que le hicimos a tu página. Así se veía antes…',
    accion: A.pagina.antes },
  { id: 'p02', bloque: 'p1', capitulo: 'Ahora', texto: 'Y así se ve ahora: más elegante, con tus fotos reales, tus servicios, tu equipo, y las reseñas de tus clientas.',
    accion: A.pagina.ahora },
  { id: 'p03', bloque: 'p1', capitulo: 'Más rápida', texto: 'Además, es mucho más rápida. Optimizamos cada foto, y la página pesa mucho menos, entonces abre al instante, hasta con datos en el celular.',
    accion: A.pagina.velocidad },
  { id: 'p04', bloque: 'p1', capitulo: 'Menú en el celular', texto: 'En el celular tiene un menú abajo, a la mano del dedo: servicios, diseños, cómo llegar, WhatsApp, y en el centro, el botón para agendar.',
    accion: A.pagina.menu },
  { id: 'p05', bloque: 'p1', capitulo: 'Google', texto: 'Y la dejamos lista para Google: le dice dónde estás, tu horario, tu teléfono y tus servicios. Ya está verificada en Search Console, con el mapa del sitio enviado, para que te encuentren cuando busquen uñas en Aranjuez o en Medellín.',
    accion: A.pagina.google },
  { id: 'p06', bloque: 'p1', capitulo: 'Así reserva una clienta', texto: 'Ahora mira cómo reserva una clienta desde el celular. Toca Agendar, elige su servicio, escoge con quién, o cualquiera disponible, toca una hora libre, pone su nombre y su celular, y confirma. Listo, en menos de un minuto.',
    accion: A.pagina.reserva },
  { id: 'p07', bloque: 'p1', capitulo: 'La app de tus clientas', texto: 'Y si quiere, instala la app de Amelia. Ahí ve tus promociones y su próxima cita, le llega un recordatorio antes de la cita, y con Repetir mi último servicio vuelve a reservar en dos toques.',
    accion: A.pagina.app },
  { id: 'p08', bloque: 'p1', capitulo: 'Listo', texto: 'Todo esto ya está funcionando en amelianailspa punto com. ¡Quedó divina, Erika!',
    accion: A.pagina.cierre },
];

export default {
  id: 'pagina',
  titulo: 'Tu nueva página',
  subtitulo: 'La página y la reserva en línea',
  escenas,
  bloques: [...new Set(escenas.map((e) => e.bloque))].map((id) => ({ id, escenas: escenas.filter((e) => e.bloque === id) })),
};
