# Plataforma de citas Amelia Nail Spa: arquitectura

Reemplaza a Kumbio. Vive en el mismo proyecto de Cloudflare Pages que la página principal
(`amelianailspa`), sin paso de build: HTML/CSS/JS servidos desde `public/` y la API en
Pages Functions (`functions/`) sobre una base **Cloudflare D1** (SQLite).

```
Clienta (celular) ──► /reservar ──┐
Erika / chicas ────► /panel (PWA) ┼──► /api/* (Pages Functions) ──► D1 "amelia-citas"
Google Calendar / iPhone ─────────┘    /api/ics/<token>.ics (feed de solo lectura)
```

## 1. Decisiones principales

| Tema | Decisión | Por qué |
|---|---|---|
| Fuente de verdad | **D1**. Cada dispositivo pide los datos a la API; nada se guarda como copia maestra en el navegador. | Dos clientas no pueden tomar el mismo turno. La sincronización por unión de 3 vías (MaxCool + Apps Script) sirve para listas, no para reservas. |
| Doble reserva | Tabla `cita_slots` con `PRIMARY KEY (colaboradora_id, fecha, minuto)`: cada cita ocupa un renglón por cada bloque de 5 min. La cita, sus servicios y sus bloques se insertan en **un solo `db.batch()`** (transacción). Si otro proceso tomó un bloque, SQLite rechaza el `INSERT` y la transacción entera se deshace → `409`. | La garantía la da la base de datos (restricción única), no el código: es imposible un cruce aunque lleguen dos peticiones en el mismo milisegundo. |
| Horas | Hora local de Colombia (UTC−5, sin horario de verano). Las citas guardan `fecha` (`AAAA-MM-DD`) + `inicio`/`fin` en minutos desde medianoche. Los .ics se emiten en UTC. | Simple, sin ambigüedades de zona horaria, fácil de comparar en SQL. |
| Duraciones | Múltiplos de 5 min. Varias citas de servicios se encadenan con la misma colaboradora. | Coincide con la granularidad de `cita_slots`. |
| Front | HTML + CSS + módulos ES sin build (como MaxCool). Fuentes y logo servidos localmente desde `public/app-citas/`. | Cero dependencias en producción, carga rápida, CSP estricta posible. |
| API | Una sola función comodín `functions/api/[[ruta]].js` con un enrutador pequeño (`functions/_lib/router.js`). | Un solo lugar para sesión, permisos, validación, errores y cabeceras; más fácil de probar que decenas de archivos. |
| Cabeceras de seguridad | `functions/reservar/_middleware.js`, `functions/panel/_middleware.js` y `functions/app-citas/_middleware.js` agregan CSP, `X-Robots-Tag`, etc. a sus rutas. | Así **no se toca** `public/_headers` (es de la página principal). Ver `PARA-LA-PAGINA.md` si se prefiere moverlas a `_headers`. |
| PIN | PBKDF2‑SHA256, 100 000 iteraciones, sal aleatoria de 16 bytes, formato `pbkdf2$100000$<sal>$<hash>`. Comparación en tiempo constante. | 100 000 es el máximo que permite WebCrypto en Workers. |
| Sesión | Token aleatorio de 32 bytes en cookie `amelia_sesion` (`HttpOnly; Secure; SameSite=Strict; Path=/`), 30 días. En D1 solo se guarda su SHA‑256. | Robar la base no da sesiones válidas; cerrar sesión o cambiar PIN las revoca. |
| CSRF | `SameSite=Strict` + las escrituras exigen `Content-Type: application/json` + se verifica `Origin` cuando viene. | Defensa en capas sin tokens extra. |
| Límite de intentos | Tabla `intentos`: 5 PIN fallidos por persona o 20 por IP → bloqueo de 15 min. Reservas públicas: 8 por IP por hora y máx. 3 citas futuras activas por celular. | Frena fuerza bruta de PIN (10 000 combinaciones) y spam de reservas. |

## 2. Lo que se reutiliza de MaxCool

> El repo `Agenciavectorial/MaxCool` no pudo adjuntarse a esta sesión (permiso denegado; ver
> `PENDIENTES.md`). Se siguieron los patrones descritos en el encargo; cuando haya acceso conviene
> compararlos y alinear nombres.

- **Login por persona con PIN:** pantalla de tarjetas con foto → teclado numérico. Igual flujo, pero
  la verificación es en el servidor (hash en D1) y no en el dispositivo.
- **PWA instalable:** `panel/manifest.webmanifest`, `panel/sw.js` (cachea solo la cáscara de la
  app; la API siempre va a la red) y `panel/instalar.js` (botón "Instalar" con
  `beforeinstallprompt` e instrucciones para iPhone).
- **CSP estricta sin scripts en línea**, como el `_headers` de MaxCool (aquí vía middleware).
- **Pruebas:** `dev/` con servidor local (`wrangler pages dev` + D1 local) y Playwright; `tests/`
  con pruebas unitarias en `node --test`.
- **Documentación:** `CONFIGURACION.md`, `TUTORIAL.md`, `PENDIENTES.md`.
- **No se reutiliza** la sincronización por Google Apps Script ni el estado completo en
  `localStorage`.

## 3. Esquema D1 (`migrations/0001_esquema.sql`)

| Tabla | Contenido |
|---|---|
| `ajustes(clave, valor)` | Reglas: `anticipacion_min` (120), `ventana_dias` (60), `intervalo_min` (15), `cancelacion_horas` (4), `max_citas_por_celular` (3), `whatsapp`, `direccion`, `politica_texto`, `ics_token_general`. |
| `horario_spa(dia, abierto, abre, cierra)` | 0 = domingo … 6 = sábado, minutos desde medianoche. |
| `festivos(fecha, motivo)` | Días en que el spa no abre. |
| `servicios(id, slug, nombre, categoria, descripcion, foto, precio, precio_desde, duracion, visible, orden)` | `precio` en pesos (NULL = "a consultar"). |
| `colaboradoras(id, slug, nombre, rol, cargo, bio, foto, color, pin_hash, activa, agenda, permisos, ics_token, orden)` | `rol`: `propietaria` / `colaboradora`. `agenda=1` si recibe citas. `permisos` JSON. |
| `colaboradora_servicios(colaboradora_id, servicio_id)` | Quién hace qué. |
| `horario_colaboradora(colaboradora_id, dia, trabaja, abre, cierra)` | Sin renglón = horario del spa. |
| `bloqueos(id, colaboradora_id, fecha, inicio, fin, motivo, creado_por)` | `colaboradora_id NULL` = bloquea a todo el spa. |
| `clientas(id, nombre, celular UNIQUE, email, notas, creado)` | Celular normalizado a dígitos (`573001234567`). |
| `citas(id, codigo UNIQUE, token UNIQUE, clienta_id, colaboradora_id, fecha, inicio, fin, estado, origen, notas, precio_total, creado, actualizado)` | `estado`: `confirmada`, `cancelada`, `asistio`, `no_asistio`. `token`: enlace privado de la clienta. |
| `cita_servicios(cita_id, servicio_id, nombre, precio, duracion, orden)` | Copia del servicio al momento de reservar. |
| `cita_slots(colaboradora_id, fecha, minuto, cita_id)` | **PK compuesta = anti doble reserva.** Se borra al cancelar. |
| `sesiones(token_hash, colaboradora_id, creado, expira)` | |
| `intentos(clave, conteo, ventana, bloqueado_hasta)` | Límite de intentos (PIN y reservas). |
| `registro(id, fecha, quien, accion, cita_id, detalle)` | Historial de cambios de citas (quién movió/canceló qué). |

`migrations/0002_datos_iniciales.sql` carga lo público de la página: horario, 16 servicios con
foto y duración, y el equipo (Erika propietaria; Leidy, Karla, Julieth y Daily con agenda), **sin
PIN** y **sin clientas**. Los precios quedan en "a consultar" hasta importar los de Kumbio.

### Reserva atómica (resumen)

```sql
-- todo en un db.batch() = una transacción
INSERT INTO citas (...) SELECT ... WHERE NOT EXISTS (bloqueo que se cruce);   -- 0 filas si hay bloqueo
INSERT INTO cita_servicios (...) SELECT ... FROM citas WHERE codigo = ?;
WITH RECURSIVE m(x) AS (SELECT ?inicio UNION ALL SELECT x+5 FROM m WHERE x+5 < ?fin)
INSERT INTO cita_slots SELECT ?colab, ?fecha, x, id FROM m, citas WHERE codigo = ?;  -- choca si el turno ya es de otra
```

Reprogramar = `DELETE` de sus bloques + `UPDATE` de la cita + `INSERT` de los nuevos bloques, en
otro batch: si el nuevo turno está tomado, nada cambia.

## 4. Disponibilidad (`functions/_lib/disponibilidad.js`, función pura)

Para una fecha, la lista de servicios (duración total = suma) y las colaboradoras candidatas
(activas, con agenda y que hacen **todos** los servicios elegidos):

1. Fuera de la ventana de reserva, festivo o spa cerrado → sin turnos.
2. Rango de cada chica = intersección del horario del spa y el suyo.
3. Turnos cada `intervalo_min` desde la apertura; un turno vale si cabe completo en el rango, no se
   cruza con bloqueos (suyos o generales) ni con sus citas activas, y empieza después de
   `ahora + anticipacion_min`.
4. Resultado: `[{inicio, colaboradoras:[ids]}]`. Con "cualquiera disponible" el servidor asigna
   a la chica con menos citas ese día y, si justo le tomaron el turno, prueba con la siguiente.

## 5. Endpoints

`P` = público, `S` = cualquier sesión, `E` = solo Erika (propietaria), `C(permiso)` = colaboradora
con ese permiso (Erika siempre puede). Todas las respuestas son JSON salvo los `.ics`.

| Método y ruta | Quién | Qué hace |
|---|---|---|
| `GET /api/public/catalogo` | P | Servicios visibles, colaboradoras con agenda (sin datos privados), horario, reglas públicas. |
| `GET /api/public/dias?servicios=&con=&desde=&n=` | P | Qué días del rango tienen turnos (para pintar el calendario). |
| `GET /api/public/disponibilidad?fecha=&servicios=&con=` | P | Turnos de un día. `con` = slug o `cualquiera`. |
| `POST /api/public/reservar` | P | Crea la cita (con trampa anti‑bots `sitio_web`). Devuelve código y token. |
| `GET /api/public/cita?token=` | P (token) | Detalle para la clienta. |
| `POST /api/public/cita/cancelar` · `/reprogramar` | P (token) | Dentro de `cancelacion_horas`. |
| `GET /api/public/cita.ics?token=` | P (token) | Archivo para el calendario. |
| `GET /api/auth/personas` | P | Nombre y foto de quienes tienen PIN (para la pantalla de ingreso). |
| `POST /api/auth/login` · `logout` · `GET /api/auth/yo` | P/S | Sesión. |
| `POST /api/auth/configurar` | P + `CLAVE_INICIAL` | Solo mientras Erika no tenga PIN: lo crea. |
| `POST /api/auth/cambiar-pin` | S | Cambia el propio PIN (cierra las demás sesiones). |
| `GET /api/panel/agenda?desde=&hasta=&colaboradora=` | S | Citas y bloqueos. Una colaboradora solo ve las suyas salvo `ver_agenda_equipo`. Sin ese permiso tampoco ve citas ajenas. |
| `GET /api/panel/disponibilidad` | S | Igual que la pública pero sin anticipación mínima. |
| `POST /api/panel/citas` | E · C(`gestionar_citas`, solo propias) | Crear cita (Erika puede `forzar` fuera de horario; nunca encima de otra cita). |
| `PATCH /api/panel/citas/:id` | E · C(`gestionar_citas`, solo propias) | Mover, cambiar estado, notas, cancelar. |
| `GET/POST /api/panel/bloqueos`, `DELETE /api/panel/bloqueos/:id` | E · C(`gestionar_bloqueos`, solo propios) | Bloqueos. Generales solo Erika. |
| `GET/PUT /api/panel/mi-horario` | S · C(`editar_horario`) para escribir | Horario semanal propio. |
| `GET/POST /api/panel/colaboradoras`, `PUT/DELETE …/:id`, `POST …/:id/pin`, `POST …/:id/ics` | E | Equipo, permisos, PIN y token del feed. |
| `GET/POST /api/panel/servicios`, `PUT/DELETE …/:id` | E (GET: S) | Catálogo. |
| `GET/PUT /api/panel/spa`, `POST/DELETE /api/panel/festivos` | E | Horario del spa y festivos. |
| `GET/PUT /api/panel/ajustes` | E | Reglas de reserva. |
| `GET /api/panel/clientas?q=`, `GET/PUT …/:id` | E · C(`ver_clientas`, solo clientas que ha atendido) | Lista e historial. |
| `POST /api/panel/importar` | E | Importador CSV (servicios, clientas, citas). Valida fila por fila y responde qué entró y qué no. |
| `GET /api/panel/resumen` | S | Números del día (Erika: todo el spa; colaboradora: los suyos). |
| `GET /api/ics/<token>.ics` | token | Feed suscribible: el de cada chica o el general de Erika. Revocable regenerando el token. |

## 6. Permisos de colaboradora (los da Erika)

| Permiso | Por defecto | Permite |
|---|---|---|
| `gestionar_citas` | sí | Crear, mover, cancelar y marcar asistencia de **sus** citas. |
| `gestionar_bloqueos` | sí | Crear y borrar **sus** bloqueos (almuerzo, cita médica…). |
| `editar_horario` | no | Cambiar su horario semanal. |
| `ver_agenda_equipo` | no | Ver (sin editar) las agendas de las compañeras. |
| `ver_clientas` | no | Ver la lista e historial de las clientas que ha atendido. |

Cada endpoint vuelve a revisar rol y permisos en el servidor; esconder botones en el front es
solo comodidad.

## 7. Estructura de archivos

```
functions/
  api/[[ruta]].js           enrutador de toda la API
  _lib/                     db, auth (PBKDF2, sesiones), disponibilidad, reservas, ics, csv, validar, http
  reservar/_middleware.js   cabeceras de /reservar
  panel/_middleware.js      cabeceras + noindex de /panel
  app-citas/_middleware.js  cabeceras de los recursos compartidos
migrations/                 0001_esquema.sql, 0002_datos_iniciales.sql
public/app-citas/           base.css, fuentes, logo, íconos, js/util.js (compartidos)
public/reservar/            index.html, reservar.css, reservar.js; cita/ (gestionar la cita)
public/panel/               index.html, panel.css, js/*.js, manifest, sw.js, instalar.js
dev/                        e2e.mjs (Playwright), semilla-pruebas.sql (datos ficticios), capturas/
tests/                      pruebas unitarias (node --test)
docs/plataforma/            esta documentación
```

## 8. Fase 2: negocio, mensajes, fidelización y app de la clienta

Requisitos para superar a Kumbio. Migración
`migrations/0003_negocio.sql` y rutas en `functions/_lib/rutas/negocio.js`.

| Pieza | Cómo funciona |
|---|---|
| **Cobros ("Facturar")** | Tabla `pagos` (monto, propina, método: efectivo, Nequi, Daviplata, tarjeta, transferencia, otro). `POST /api/panel/citas/:id/pagos` (Erika o la dueña de la cita con `gestionar_citas`). Cobrar marca la cita como *asistió*. Alimenta ingresos y analítica. |
| **Citas por gestionar** | `GET /api/panel/por-gestionar`: citas *confirmadas* que ya terminaron (30 días atrás). En Inicio: "¿Asistió? Sí / No"; "Sí" abre el cobro. |
| **Dashboard** | `GET /api/panel/resumen2`: ingresos del mes, citas de la semana, % de asistencia, clientas nuevas vs recurrentes, mensajes enviados, próxima cita. |
| **Analítica** (Erika) | `GET /api/panel/analitica?desde&hasta`: ingresos, propinas, ticket promedio, por método, por colaboradora, servicios más vendidos, asistencia, días con más citas, origen (web/panel). |
| **Notas** | Tabla `notas_negocio`, compartidas por el equipo; cada quien borra las suyas, Erika todas. |
| **Mensajes con plantillas** | Tabla `plantillas` (confirmación, recordatorio, cambio, cancelación, gracias + reseña, te toca volver) editable por Erika con variables `{nombre} {servicio} {fecha} {hora} {colaboradora} {codigo} {enlace} {resena} {spa} {direccion}`. Hoy se envían como **WhatsApp prellenado con un toque** (sin cupos). Cada envío queda en `mensajes` (para contarlos y no repetir). |
| **Fidelización** | `servicios.ciclo_dias` (ciclo de retorno, editable). `GET /api/panel/fidelizacion`: clientas cuya última visita + ciclo ya llegó (o llega en 3 días) y no tienen cita futura, cumpleaños de la semana, inactivas (+`dias_inactiva`, 90 por defecto) y recurrentes. El mensaje lleva un enlace `/reservar?servicio=…&con=…` con su servicio y colaboradora de siempre. |
| **Promociones** | Tabla `promociones` con vigencia; las vigentes salen en `/api/public/catalogo` y arriba en la reserva, con botón que agenda el servicio. |
| **App de la clienta (PWA)** | `/reservar` es instalable (`manifest.webmanifest`, `sw.js`, `instalar.js` con pasos para iPhone). Muestra promociones, lo más pedido (últimos 90 días), su próxima cita, su historial y **"Repetir mi último servicio"**. |

### Identificación de la clienta (decisión)

**Sin cuenta ni contraseña: el celular de la clienta guarda los enlaces privados de sus reservas**
(token aleatorio de 24 bytes por cita, en `localStorage`). `GET /api/public/mis-citas?tokens=…` solo
devuelve las citas cuyos tokens conoce el dispositivo, sin exponer su celular. Así reserva en pocos
toques y no hay datos que robar con un número de teléfono.

- Por qué no "celular + código": enviar el código exige un proveedor de SMS o WhatsApp Business API
  (costo por mensaje y verificación del número). Queda preparado como siguiente paso (ver
  `PENDIENTES.md`). Pedir solo el celular sin código permitiría a cualquiera ver las citas de otra.
- Si cambia de celular: el enlace de cada cita sigue sirviendo (lo tiene en WhatsApp y en su
  calendario); al abrirlo se vuelve a guardar en el dispositivo.

### Notificaciones push (Web Push + VAPID)

- `functions/_lib/push.js`: cifrado aes128gcm (RFC 8291) y JWT VAPID ES256 (RFC 8292) con Web Crypto,
  sin dependencias. Solo acepta endpoints de servicios de push reales (FCM, Mozilla, Apple, Windows).
- `migrations/0004_push.sql`: `push_suscripciones` (clienta o equipo) y `push_enviados` (anti duplicados).
- Rutas (`rutas/push.js`): `GET /api/public/push/clave`, `POST /api/public/push/suscribir` (clienta,
  con los tokens de sus citas), `POST /api/public/push/cancelar`, `POST /api/panel/push/suscribir` y
  `/prueba` (equipo), `POST /api/interno/recordatorios` (protegida con `CRON_CLAVE`).
- `functions/_lib/notificaciones.js`: `avisarEquipo()` se llama en segundo plano (`waitUntil`) al
  crear, mover o cancelar citas; `ejecutarRecordatorios()` (24 h, 2 h, te toca volver) la corre el Worker
  `workers/recordatorios/` cada 15 min con la misma base D1. Tope de 10 envíos por ejecución.
- Los service workers de `/panel` y `/reservar` muestran la notificación y abren la cita al tocarla.
- `enviarWhatsAppAutomatico()` es el punto de integración para WhatsApp Business API (hoy no envía).

## Velocidad y caché

- **Fotos:** `foto()` en `app-citas/js/util.js` arma `<img>` con `srcset`/`sizes` a partir de las variantes
  `-320/-480/-720/-960` de `/img/`, con `width`/`height` (sin saltos), `loading="lazy"` fuera de la primera
  pantalla y `fetchpriority="high"` en la primera foto de la ficha. Las fotos de Cloudinary se piden con
  `f_auto,q_auto,c_limit,w_…`, y los videos con un ancho máximo de 720 (`videoLiviano()`). La portada usa la
  variante justa para el ancho de la pantalla (`fotoAncho()`).
- **Caché:** `functions/_lib/cabeceras.js` (`cacheDe`) pone `no-cache` a HTML, CSS, JS, manifiestos y service
  workers de `/reservar`, `/panel` y `/app-citas`: el navegador y el edge de Cloudflare revalidan con ETag
  (304 si no cambió), así un despliegue se ve de inmediato sin versionar a mano cada módulo ES. Las fuentes
  van con un año (`immutable`) y las fotos de `/img/` ya traen un año desde `public/_headers`.
- **Service workers:** red primero (`cache: 'no-cache'`) y caché solo sin conexión; al instalar descargan la
  cáscara saltándose la caché HTTP. Subir `VERSION` cuando cambie la lista de la cáscara.
- **Versiones:** todos los JS y CSS se cargan con `?v=<huella>` (`node dev/versionar.mjs`, una huella común
  para todos). Lo versionado se guarda un año; las páginas HTML siempre se revalidan. **Antes de cada commit
  que toque `/reservar`, `/panel` o `/app-citas`, correr `node dev/versionar.mjs`** (las pruebas unitarias
  fallan si se olvida).
