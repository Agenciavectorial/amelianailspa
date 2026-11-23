# Pendientes, decisiones y preguntas abiertas

Formato: **Decisión tomada por defecto** → qué hay que confirmar. Lo marcado ⚠️ bloquea la
publicación.

## Para publicar

Hecho el 2026-11-23 con un token de Cloudflare de permisos limitados:
- ✅ Base D1 `amelia-citas` creada (región ENAM) con las 4 migraciones; su ID ya está en `wrangler.toml`
  y en `workers/recordatorios/wrangler.toml`.
- ✅ Worker `amelia-recordatorios` publicado (cron cada 15 min).
- ✅ Llaves VAPID guardadas como secretos en el Worker y en Pages (producción y pruebas).
- ✅ Versión de prueba de la rama funcionando en Cloudflare Pages.

Falta:
- ⚠️ **Crear el secreto `CLAVE_INICIAL`** en Pages (Production y Preview) y dársela a Erika en persona (§4).
- ⚠️ **Rama de producción:** hoy el proyecto Pages publica la rama de la página principal. Al unir todo a
  `main` (squash), cambiar en Pages → Settings → Builds → *Production branch* a `main`.
- ⚠️ **Botones "Agendar"** de la página → `/reservar` (ver `PARA-LA-PAGINA.md`).
- **Ojo:** la versión de prueba usa la misma base que usará producción. Las reservas de prueba se pueden
  borrar desde el panel (Cancelar) o pedir una limpieza antes de abrir al público.
- Recomendado: base D1 aparte para pruebas (§10) cuando ya haya citas reales.

## Datos del spa (confirmar con Erika)

- **Precios:** la página no los publica, así que todos quedaron "Precio en el spa". → Se extraen
  de Kumbio y Erika los carga con **Importar CSV → Servicios** (o a mano en Servicios).
- **Duraciones:** se tomó el valor alto de los rangos de la página (p. ej. Acrílicas "90–120 min" →
  120). → Confirmar o corregir con lo de Kumbio.
- **Quién hace qué:** por defecto Leidy, Karla, Julieth y Daily hacen **todos** los servicios
  (incluidos pestañas, cejas y faciales). → Erika debe desmarcar en Equipo → Servicios lo que cada
  una no hace; si no, una clienta podría reservar un facial con quien no lo hace.
- **Erika no recibe citas** (`agenda` apagado), igual que en la página (`data-no-agenda`). → Si ella
  también atiende, encender "Recibe citas" en su tarjeta.
- **Valentina** (redes) no está en la plataforma. Se puede agregar si necesita entrar.
- **Horario:** el de los datos estructurados de la página (L‑V 9–19, S 10–19, D 11–17). Confirmar.
- **Festivos:** no se cargó ninguno porque el spa está en un centro comercial y seguramente abre.
  En *Horario y festivos* hay una lista de festivos de Colombia 2026–2027 para cerrar con un toque.
- **Fotos de servicios en sitios externos:** Lifting, Punto a punto, Laminado, Sombreado y
  Depilación usan fotos de otros sitios (catalinajaramillo.com, wixstatic, youtube, etc.) igual que la
  página. Pueden desaparecer o no ser de uso libre. → Subir fotos propias a Cloudinary y cambiarlas
  en Servicios.
- La foto de Daily en la página era `.heic`; aquí se pide a Cloudinary en `.jpg` (misma imagen).

## Reglas de reserva (valores por defecto, Erika los cambia en *Reglas de reserva*)

| Regla | Valor |
|---|---|
| Anticipación mínima | 2 horas |
| Ventana | 60 días |
| Intervalo entre turnos | 15 min |
| Cancelar/reprogramar en línea | hasta 4 h antes |
| Citas futuras por celular | máximo 3 |
| Reservas por IP por hora | 8 (anti‑spam) |

## Decisiones técnicas

- **MaxCool no se pudo consultar:** al intentar adjuntar `Agenciavectorial/MaxCool` a la sesión, el
  permiso fue denegado. Se siguieron los patrones descritos en el encargo (login por persona con
  PIN, `instalar.js`, `sw.js`, `functions/api`, CSP estricta, `dev/` + Playwright, docs). → Cuando
  haya acceso, comparar nombres y estilos (por ejemplo `instalar.js` y la pantalla de PIN) y
  unificarlos. Tampoco se consultó `thefedexbarbershop`; el dock inferior y las fuentes locales se
  hicieron según la descripción.
- **Una cita = una colaboradora.** Si la clienta pide varios servicios, los hace la misma persona
  en bloque seguido. Reservar "uñas con Karla + pestañas con Leidy" en la misma visita requiere dos
  reservas. → ¿Se necesita reservar combinaciones con varias personas?
- **No se modelan recursos físicos** (sillas de pedicure, camilla de faciales). Si dos chicas no
  pueden hacer Pedi Spa a la vez por falta de silla, hay que decirlo y se agrega.
- **Cabeceras de seguridad por middleware** y no en `public/_headers` para no chocar con el
  la página principal.
- **Sesión de 30 días** en el dispositivo (cómodo en el celular personal). En un dispositivo compartido
  hay que usar "Cerrar sesión". Cambiar el PIN cierra las demás sesiones.
- **PIN de 4 a 8 números**, por eso el teclado no entra solo al cuarto dígito: hay que tocar "Entrar".
- **La lista de personas en la pantalla de ingreso es pública** (nombre y foto, lo mismo que ya
  muestra la página). El PIN es lo que protege.
- **Feeds .ics con nombre y celular de la clienta** para que las chicas los vean en su calendario.
  El enlace es secreto y se puede regenerar (el viejo deja de funcionar).
- **"Forzar" (solo Erika):** permite agendar fuera de horario o encima de un bloqueo, nunca encima de
  otra cita (eso lo impide la base de datos).
- **Citas importadas del pasado** se guardan como historial sin ocupar turnos; las futuras sí ocupan
  turno y, si se cruzan con otra, se reportan como error en esa fila.
- **Zona horaria fija UTC−5** (Colombia no tiene horario de verano).
- **Fuentes locales** en `public/app-citas/fonts/` (licencia OFL de Google Fonts) en vez de cargar
  Google Fonts: más rápido y permite `font-src 'self'`.

## Fase 2: qué falta

- **Decisión (2026-11-23): NO se usará WhatsApp Business API por ahora.**
  Los avisos automáticos van por notificaciones push, y los mensajes por WhatsApp se envían prellenados
  con un toque desde el panel. `enviarWhatsAppAutomatico()` en `functions/_lib/notificaciones.js`
  queda como punto de integración futuro, sin activar. Si algún día se quiere, requiere cuenta
  verificada de Meta, plantillas aprobadas y tiene costo por conversación.
- **Notificaciones push web: HECHAS** (avisos al equipo, recordatorios 24 h / 2 h y "te toca volver").
  Falta solo crear las llaves VAPID y publicar el Worker de recordatorios (`CONFIGURACION.md` §13).
- **Identificar a la clienta con celular + código:** depende del mismo proveedor de mensajería. Hoy
  se identifica por los enlaces guardados en su celular (ver `ARQUITECTURA.md` §8).
- **Enlace de reseñas de Google:** quedó una búsqueda genérica. Erika debe pegar el enlace real
  ("Pedir reseñas" en su perfil de Google) en *Reglas de reserva*.
- **Ciclos de retorno** cargados por defecto (semipermanente/acrílicas/poligel 21 días, pestañas punto
  a punto 18, lifting y laminado 45, faciales 30…). Erika debe confirmarlos en Servicios.
- **Fuentes:** la página tiene las suyas en `public/fonts/`; la plataforma usa su copia en
  `public/app-citas/fonts/` (mismos tipos de letra) para no depender de archivos de la página
  principal. Se pueden unificar más adelante.
- **Cabeceras:** se podían agregar bloques al final de `public/_headers`. No hace falta:
  los middlewares de `functions/` ya las ponen en `/reservar`, `/panel`, `/app-citas` y `/api`.

## Ideas para una siguiente fase

- **Recordatorios automáticos por WhatsApp** (24 h y 2 h antes) con la API de WhatsApp Business y un
  Cron de Cloudflare. Tiene costo por mensaje y requiere verificar el número. Hoy la clienta envía su
  confirmación con un toque (`wa.me`) y puede añadir la cita a su calendario con alarma.
- **Anticipo/depósito** para servicios largos (Wompi, Mercado Pago, Bold).
- **Lista de espera** cuando un día está lleno.
- **Exportar** la analítica a CSV/Excel y comisiones por colaboradora.
- **Política de privacidad** completa en la página (Ley 1581 de 2012). La reserva ya pide
  autorización explícita para usar nombre y celular solo para gestionar la cita; falta la página con
  la política (página principal / asesoría legal).
- Formato real de la exportación de Kumbio: el importador reconoce muchos encabezados (cliente,
  teléfono, profesional, fecha, hora, servicio, estado…). Si el archivo de Kumbio trae otros nombres,
  basta renombrar las columnas o agregar sinónimos en `public/app-citas/js/csv.js` (`ALIAS`).
