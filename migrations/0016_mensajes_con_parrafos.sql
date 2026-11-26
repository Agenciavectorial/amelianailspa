-- Mensajes de WhatsApp con párrafos y el enlace en su propia línea (se lee mejor y el enlace no se corta).
-- Solo cambia las plantillas que Erika no ha editado (si las personalizó, se respetan).
UPDATE plantillas SET texto = '¡Hola {nombre}! 💜

Tu cita en {spa} quedó confirmada:

• {servicio}
• {fecha} a las {hora}
• Con {colaboradora}
• Código {codigo}

📍 {direccion}

Si necesitas cambiarla, entra aquí:
{enlace}'
 WHERE clave = 'confirmacion' AND texto = '¡Hola {nombre}! 💜 Tu cita en {spa} quedó confirmada:

• {servicio}
• {fecha} a las {hora}
• Con {colaboradora}
• Código {codigo}

📍 {direccion}
Si necesitas cambiarla: {enlace}';
UPDATE plantillas SET texto = '¡Hola {nombre}! ✨

Te recordamos tu cita de {servicio}:
📅 {fecha} a las {hora}
💅 Con {colaboradora}

¡Te esperamos! Si no puedes venir, avísanos o cámbiala aquí:
{enlace}'
 WHERE clave = 'recordatorio' AND texto = '¡Hola {nombre}! ✨ Te recordamos tu cita de {servicio} el {fecha} a las {hora} con {colaboradora}. ¡Te esperamos! Si no puedes venir, avísanos o cámbiala aquí: {enlace}';
UPDATE plantillas SET texto = 'Hola {nombre} 💜

Tu cita quedó para el {fecha} a las {hora} con {colaboradora} ({servicio}).
Código {codigo}.

Cualquier cosa nos escribes.'
 WHERE clave = 'cambio' AND texto = 'Hola {nombre}, tu cita quedó para el {fecha} a las {hora} con {colaboradora} ({servicio}). Código {codigo}. Cualquier cosa nos escribes 💜';
UPDATE plantillas SET texto = 'Hola {nombre},

tu cita de {servicio} del {fecha} a las {hora} quedó cancelada.

Cuando quieras volver a agendar, entra aquí 💜
https://amelianailspa.com/reservar'
 WHERE clave = 'cancelacion' AND texto = 'Hola {nombre}, tu cita de {servicio} del {fecha} a las {hora} quedó cancelada. Cuando quieras volver a agendar: https://amelianailspa.com/reservar 💜';
UPDATE plantillas SET texto = '¡Gracias por visitarnos, {nombre}! 💅

Fue un gusto atenderte.

Si te encantó, nos ayudas muchísimo con una reseña en Google:
{resena}'
 WHERE clave = 'gracias' AND texto = '¡Gracias por visitarnos, {nombre}! 💅 Fue un gusto atenderte. Si te encantó, nos ayudas muchísimo con una reseña en Google: {resena}';
UPDATE plantillas SET texto = '¡Hola {nombre}! 💜

Ya va siendo hora de consentirte otra vez con tu {servicio}.

¿Te agendamos con {colaboradora}? Reserva en un toque:
{enlace}'
 WHERE clave = 'vuelve' AND texto = '¡Hola {nombre}! 💜 Ya va siendo hora de consentirte otra vez con tu {servicio}. ¿Te agendamos con {colaboradora}? Reserva en un toque: {enlace}';
