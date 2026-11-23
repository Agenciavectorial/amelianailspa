// Genera un par de llaves VAPID para las notificaciones push e imprime los comandos para guardarlas.
//   node dev/vapid.mjs
// La PRIVADA es secreta: nunca la subas al repositorio ni la pegues en un chat.
import { generarVapid } from '../functions/_lib/push.js';

const { publica, privada } = await generarVapid();
console.log(`
Llaves VAPID nuevas (guárdalas en un lugar seguro, por ejemplo el gestor de contraseñas del spa):

  VAPID_PUBLICA = ${publica}
  VAPID_PRIVADA = ${privada}
  VAPID_SUJETO  = mailto:<correo del spa>

Guárdalas como secretos en los DOS lugares (proyecto Pages y Worker de recordatorios):

  npx wrangler pages secret put VAPID_PUBLICA --project-name amelianailspa
  npx wrangler pages secret put VAPID_PRIVADA --project-name amelianailspa
  npx wrangler pages secret put VAPID_SUJETO  --project-name amelianailspa
  npx wrangler secret put VAPID_PUBLICA --config workers/recordatorios/wrangler.toml
  npx wrangler secret put VAPID_PRIVADA --config workers/recordatorios/wrangler.toml
  npx wrangler secret put VAPID_SUJETO  --config workers/recordatorios/wrangler.toml

Si cambias las llaves, las suscripciones existentes dejan de funcionar y cada persona debe
volver a activar las notificaciones.
`);
