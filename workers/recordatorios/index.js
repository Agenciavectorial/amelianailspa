// Worker programado: recordatorios por notificación push (al agendar, mismo día, 1 h antes, resumen del equipo, "te toca volver")
// y copia de seguridad diaria de la base.
// Pages Functions no ejecuta crons, por eso vive aparte, con la MISMA base D1 y la misma lógica
// (functions/_lib/notificaciones.js). Publicación: docs/plataforma/CONFIGURACION.md §13.
import { ejecutarRecordatorios } from '../../functions/_lib/notificaciones.js';
import { respaldoDiario } from '../../functions/_lib/respaldo.js';

export default {
  async scheduled(evento, env, ctx) {
    ctx.waitUntil(ejecutarRecordatorios(env).then((r) => console.log('recordatorios', JSON.stringify(r))));
    // Copia de seguridad diaria (una vez al día, desde las 3:00 a. m. de Colombia).
    ctx.waitUntil(respaldoDiario(env).then((r) => console.log('respaldo', JSON.stringify(r))).catch((e) => console.error('respaldo', e?.message || e)));
  },
  // Sin rutas públicas: cualquier visita recibe 404.
  async fetch() {
    return new Response('No encontrado', { status: 404 });
  },
};
