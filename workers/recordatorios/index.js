// Worker programado: recordatorios por notificación push (24 h y 2 h antes, "te toca volver").
// Pages Functions no ejecuta crons, por eso vive aparte, con la MISMA base D1 y la misma lógica
// (functions/_lib/notificaciones.js). Publicación: docs/plataforma/CONFIGURACION.md §13.
import { ejecutarRecordatorios } from '../../functions/_lib/notificaciones.js';

export default {
  async scheduled(evento, env, ctx) {
    ctx.waitUntil(ejecutarRecordatorios(env).then((r) => console.log('recordatorios', JSON.stringify(r))));
  },
  // Sin rutas públicas: cualquier visita recibe 404.
  async fetch() {
    return new Response('No encontrado', { status: 404 });
  },
};
