# Reporte de la migración

Actualizado: 23 nov 2026 (segunda revisión). Sin datos personales de clientas.

## Estado para continuar
**Listo:** dominio en Cloudflare con HTTPS; `www` y `http` redirigen a `https://amelianailspa.com`; `/reservar` y `/panel` cargan en producción; botones de Agendar apuntan a `/reservar`; Analytics puesto; Search Console verificado, sitemap enviado (Correcto, 2 páginas) e indexación de la portada solicitada.

**Desarrollo:**
1. `sitemap.xml` lista `/reservar`, pero esa URL responde 308 a `/reservar/`. Unificar en sitemap, canonical y enlaces.
2. Veloterapia no tiene foto en el catálogo. Lifting, punto a punto, laminado y sombreado usan arte de la marca, a falta de foto propia.
3. Horario: la base usa el de Kumbio (lun-jue 9-20, vie 10-19, sáb 8-18, dom 11-17); Google tiene otro (lun-vie 9-19, sáb 10-19, dom 11-17). Con lo que confirme Erika, dejar iguales base, página y datos estructurados.

**Agencia / Erika:**
1. Entrar a `/panel` con la clave inicial y crear el PIN de Erika. Al revisar, el panel aún pedía esa configuración, así que nadie podía ver reservas todavía.
2. Importar clientas y citas (Drive privado). Hay una cita futura, el 24 nov, que vive solo en Kumbio hasta importarla o crearla a mano. Los CSV pueden estar desactualizados.
3. Precios, celulares, horario y quién atiende (Karla y Daily están inactivas en Kumbio, pero reciben reservas en la plataforma).
4. Acceso de administrador al Perfil de Google, y sesión en Instagram, Facebook y TikTok.

**Kumbio:** no desactivar hasta tener el panel configurado, la cita del 24 importada y una primera reserva real. Mientras las dos agendas estén abiertas puede haber cruces de horario.

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
- Kumbio sigue activo; no se cambió nada (revisado otra vez el 23 nov: la página pública de reservas sigue abierta).

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

## Tarea 4 — Cloudflare y dominio: hecha
- Nameservers `ada` y `venkat.ns.cloudflare.com` activos en el registro. DNSSEC sin firmar. Sin registros de correo (tampoco los había antes).
- Custom domains raíz y `www`: activos, SSL habilitado. DNS: CNAME de ambos a Pages y el TXT de Google.
- Regla de redirección `www` a raíz (301, conserva ruta y parámetros): probada.
- Equipos con DNS en caché pueden ver un 404 de Netlify durante unas horas.
- Netlify: sitio `amelianailspa`, sin borrar; ya no responde al dominio (404). Su panel no se revisó. Apagarlo hacia el 23 dic 2026.

## Tarea 5 — Search Console y Analytics: hecha; perfil de Google y redes pendientes
- Search Console: propiedad de dominio verificada por DNS (no borrar el TXT). Sitemap enviado, estado Correcto, 2 páginas. La portada ya estaba indexada; se pidió nuevo rastreo.
- GA4 **G-PPSD6EHCEW** está en la página y la CSP lo permite. No se comprobó la llegada de datos.
- Perfil de Google: Amelia no está entre los 6 perfiles de la cuenta de la agencia. Falta el acceso para poner la web.
- Redes: sin cambios. beacons.ai/amelianailspa no enlaza la página, y su WhatsApp apunta a `wa.me/Amelia%20Nails%20Spa` (no es un número).

## Tarea 6 — Plataforma de citas: publicada, falta configurar el panel
- Producción responde con la base: 17 servicios y disponibilidad. No se hizo ninguna reserva de prueba.
- `CLAVE_INICIAL` y los tres secretos VAPID existen en producción (valores no vistos). Vista previa sin revisar.
- Servicios por persona, ya según Kumbio: Leidy todo; Karla faciales, cejas y pestañas; Julieth y Daily uñas (y Veloterapia). Duraciones ajustadas. Precios vacíos.
- Sin probar: ingreso al panel, notificaciones y recordatorios.
