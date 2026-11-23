# Reporte de la migración

Actualizado: 23 nov 2026. Sin datos personales de clientas.

## Tarea 1 — Kumbio: hecha
- `docs/migracion-kumbio/datos/servicios.csv` (16 servicios) y `colaboradoras.csv` (Daily, Julieth, Leidy).
- Clientas: **6**. Citas: **6** en total (1 futura, el 24 nov 2026). Una clienta y su cita parecen de prueba. Los dos CSV están en el Drive de la agencia (cuenta vectorialmarketing), carpeta "Amelia - Migración Kumbio" (privada).
- Uso: 3 citas con fecha en los últimos 3 meses (1 asistió, 1 no asistió, 1 sin marcar), más la futura.
- Se leyó de pantalla; no se usó el botón de descarga de citas.
- **Precios:** Kumbio tiene $0 en 15 servicios y $10 en Semipermanente. Van vacíos: los debe dar el spa (Instagram tiene un destacado "precios" que pide iniciar sesión).
- **Equipo:** activas en Kumbio: Julieth y Leidy. Inactivas: Daily (allí aparece como "Dayli") y Karla (faciales, cejas, pestañas). Daily se incluyó en los CSV porque el encargo la nombra; Karla no, falta confirmar. Erika no existe como profesional en Kumbio, y Valentina tampoco. Celulares vacíos: todas tienen el del spa.
- "Sombreado de Cejas" está en la página pero no en Kumbio. Veloterapia sí está en ambos.
- Horario en Kumbio (sede y profesionales): lun-jue 9-20, vie 10-19, sáb 8-18, dom 11-17. **No coincide** con la página ni con Google (lun-vie 9-19, sáb 10-19, dom 11-17). El CSV lleva el de Kumbio; confirmar con el spa.
- Sin descansos ni tiempo libre por profesional. En el calendario de noviembre no se ven bloqueos (no se revisaron otros meses). No se encontró ajuste de festivos ni política de cancelación.
- Reservas: anticipación mínima 0 días, intervalos de 30 min, cupo 1, nombre y teléfono obligatorios, apellido y correo opcionales, COP, impuesto y comisión 0 %.
- Mensajes de WhatsApp activos (número genérico de Kumbio): confirmación, recordatorio 24 h antes, pedir reseña, reagendamiento si no asiste. Segundo recordatorio apagado.
- Kumbio sigue activo; no se cambió nada.

## Tarea 2 — Fotos: 1 de 5
- Subida: `fotos-nuevas/depilacion-cejas.jpg` (496x720), portada del video propio "Depilación de cejas" del TikTok del spa (23 sep 2025).
- **Sin foto propia encontrada:** lifting de pestañas, pestañas punto a punto, laminado de cejas, sombreado de cejas.
- Revisado: TikTok (51 publicaciones, por título), Instagram (12 visibles sin sesión), Google (1 foto del propietario, de uñas), Kumbio (sin fotos de servicios), Cloudinary (solo las URL que usa la web).
- **No revisado por falta de sesión:** resto y destacados de Instagram, y Facebook.
- **Posible riesgo adicional:** `servicios-nuevos-3` (Limpieza facial) y `servicios-nuevos-4` (Dermapen) parecen fotos de banco con texto del spa. Confirmar licencia.

## Tarea 3 — Google: datos listos, perfil sin acceso
- 4,8 con 27 reseñas. Categoría: Spa.
- Coordenadas (URL de la ficha en Maps): **6.2683668, -75.5649006**. Plus code 7C9P+82.
- Dirección: Cra. 51D #71-125, Aranjuez, Medellín, Aranjuez, Medellín, Antioquia. En Centro Comercial Bosque Plaza. No menciona "Local 71-125".
- Horario: lun-vie 9-19, sáb 10-19, dom 11-17. Teléfono: 310 702 7012. Coinciden con la página.
- Web: **ninguna** ("Añadir sitio web").
- Dejar reseña (probado, abre el formulario): https://search.google.com/local/writereview?placeid=ChIJE1p6ZtApRI4RySgvgmAtowc
- La cuenta de la agencia no administra este perfil, así que no se puso la web. El dueño sigue sin identificar.

## Tarea 4 — Cloudflare: página publicada, dominio pendiente
- Proyecto Pages `amelianailspa`, conectado al repositorio, preset None, sin build, salida `public`, despliegue automático activo: **https://amelianailspa.pages.dev**
- Probado: 189 recursos del HTML responden 200; celular (375 px): menú inferior, preguntas y fotos sin errores; los enlaces de Agendar apuntan a Kumbio y los de WhatsApp al número del spa (enlaces leídos, no abiertos uno a uno). Velocidad no medida. Escritorio revisado solo a ~980 px de ancho.
- **Por corregir en la página:** a ~980 px la barra superior morada se parte en dos líneas y tapa el menú y parte del logo.
- Zona `amelianailspa.com` creada en Cloudflare (plan gratis), estado **pendiente**. Registros importados = los actuales: A 75.2.60.5 y CNAME www -> amelianailspa.netlify.app. No hay MX, TXT, DMARC ni CAA hoy (DNS público). Se agregó el TXT de Search Console. Bot Preference Sync apagado para no alterar robots.txt.
- **Falta:** el dominio está en **Spaceship** (nameservers launch1/launch2.spaceship.net) y pide inicio de sesión. Cambiar los nameservers a `ada.ns.cloudflare.com` y `venkat.ns.cloudflare.com`.
- Después: Custom domains (raíz y www), redirección de www, quitar el dominio en Netlify (sitio `amelianailspa`) y apagarlo a los 30 días. El sitio actual sigue en Netlify, sin cambios.

## Tarea 5 — Search Console y Analytics: parcial
- Search Console: propiedad de dominio agregada, **sin verificar** (el TXT ya está en la zona de Cloudflare y será visible al cambiar nameservers). Sitemap e indexación: después.
- Google Analytics 4: propiedad "Amelia Nail Spa" (Bogotá, COP) dentro de la cuenta Agencia Vectorial. **ID de medición: G-PPSD6EHCEW**
- **Por corregir en la página:** la CSP actual (`script-src 'self'; connect-src 'self'`) bloquearía Analytics; hay que permitir los dominios de Google.
- Redes: sin sesión, no se cambió nada. Instagram enlaza a beacons.ai/amelianailspa, que no muestra la página ni Kumbio, y cuyo ícono de WhatsApp apunta a `wa.me/Amelia%20Nails%20Spa` (no es un número). TikTok no muestra enlace web en la bio. Facebook no se pudo ver.

## Tarea 6 — Plataforma de citas: base lista, falta la clave inicial
- **La base D1 `amelia-citas` está lista.** Ya estaba creada y su ID está en `wrangler.toml`; no se creó otra.
- Comprobado en la versión de prueba: `/api/public/catalogo` responde 16 servicios; `/reservar` y `/panel` cargan. El Worker `amelia-recordatorios` existe en Cloudflare.
- En Pages hay 3 secretos en producción (nombres no visibles en la revisión); según PENDIENTES.md son los de notificaciones.
- **Falta:** el secreto `CLAVE_INICIAL` (lo crea la agencia en Cloudflare, Production y Preview), unir la plataforma a la página publicada y cambiar los botones de Kumbio a `/reservar`. En la página publicada `/reservar` y `/panel` aún dan 404.
- **Diferencias entre la base y Kumbio, por confirmar con el spa:** en la base Leidy, Karla, Julieth y Daily hacen todos los servicios; en Kumbio Julieth y Daily solo uñas, Karla solo faciales, cejas y pestañas, Leidy todo; Karla y Daily están inactivas allí. Las duraciones también difieren (p. ej. Acrílicas: base 120 min, Kumbio 135).
- El horario de la base es el de la página; el de los CSV es el de Kumbio. Definir cuál vale antes de importar colaboradoras.
- Kumbio sigue activo.
