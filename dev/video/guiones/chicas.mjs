// Video para las chicas (panel de colaboradora). Una versión por chica: cambia el saludo y la sesión.
import * as A from '../acciones.mjs';

export const CHICAS = ['Leidy', 'Karla', 'Julieth', 'Daily'];

const saludos = CHICAS.map((n) => ({
  id: `saludo-${n.toLowerCase()}`, bloque: 'saludos', capitulo: `Hola, ${n}`, chica: n,
  texto: `¡Hola, ${n}! Este video es para ti. Te muestro tu nueva agenda de Amelia.`,
  accion: A.chicas.saludo,
}));

const comunes = [
  { id: 'c01', bloque: 'c1', capitulo: 'Entrar con tu PIN', texto: 'Para entrar, abres amelianailspa punto com, barra panel. Tocas tu foto y escribes el PIN que te dio Erika. Si se te olvida, ella te pone uno nuevo.',
    accion: A.chicas.entrar },
  { id: 'c02', bloque: 'c1', capitulo: 'Instalar la app', texto: 'Te recomiendo instalarla como app. En Más, Mi cuenta, tocas Instalar app. En iPhone es con el botón Compartir y Agregar a inicio. Así te queda en el celular como cualquier aplicación.',
    accion: A.chicas.instalar },
  { id: 'c03', bloque: 'c1', capitulo: 'Tu agenda', texto: 'En Inicio ves tus citas de hoy y de mañana, y en Agenda tu día completo. Con las flechas cambias de día, y en Semana ves toda tu semana.',
    accion: A.chicas.agenda },
  { id: 'c04', bloque: 'c1', capitulo: 'Tus citas', texto: 'Tocas una cita y ves la clienta, el servicio y la hora. Ahí marcas si asistió, la puedes mover, o anotar algo, como el diseño que quiere.',
    accion: A.chicas.citas },
  { id: 'c05', bloque: 'c1', capitulo: 'Bloquear un horario', texto: 'Si vas a almorzar o tienes una diligencia, tocas Bloquear, eliges la hora, y listo: en ese rato nadie te puede reservar.',
    accion: A.chicas.bloquear },
  { id: 'c06', bloque: 'c1', capitulo: 'Activar avisos', texto: 'En Mi cuenta activa las notificaciones, para que te llegue un aviso cada vez que te agenden, te muevan o te cancelen una cita. En iPhone, primero instala la app.',
    accion: A.chicas.avisos },
  { id: 'c07', bloque: 'c1', capitulo: 'Contactar a la clienta', texto: 'Y para hablar con la clienta, en la cita tocas el botón de WhatsApp: se abre con el mensaje listo, la confirmación o el recordatorio. Solo le das enviar.',
    accion: A.chicas.contactar },
  { id: 'c08', bloque: 'c1', capitulo: 'Listo', texto: 'Eso es todo. Cualquier duda, pregúntale a Erika. ¡Que tengas un día muy bonito!',
    accion: A.chicas.cierre },
];

const escenas = [...saludos, ...comunes];
export default {
  id: 'chicas',
  titulo: 'Tu agenda de Amelia',
  subtitulo: 'Para el equipo · panel de colaboradora',
  escenas,
  /** Escenas de la versión de una chica. */
  version: (nombre) => [saludos.find((s) => s.chica === nombre), ...comunes],
  bloques: [...new Set(escenas.map((e) => e.bloque))].map((id) => ({ id, escenas: escenas.filter((e) => e.bloque === id) })),
};
