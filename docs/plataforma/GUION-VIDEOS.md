# Guion para grabar los videos tutoriales

Grabar **siempre en local** con datos ficticios, nunca en producción:

```bash
npm install
npm run dev        # http://localhost:8788  (Erika PIN 1234, chicas PIN 1111)
```

Recomendado: Playwright con `devices['iPhone 13']` (o un Android de 360 px) y `recordVideo`. Antes de
grabar, para que el tour no salga en todos los videos (salvo en el que lo muestra):
`localStorage.setItem('amelia_tour_omitir', '1')` (con `context.addInitScript`).

Para las horas, elige un **día futuro** en la tira de días: hoy puede no tener turnos según la hora en
que se grabe.

---

## Video 1 · La clienta reserva desde el celular (≈ 60 s)

| Paso | Qué se ve / qué se dice | Acción (selector) |
|---|---|---|
| 1 | La portada del spa y las promociones | `goto /reservar/` |
| 2 | "Toca un servicio para ver fotos y video" | `click .servicio-abrir >> text=Press On` |
| 3 | Desliza el carrusel; el video corre sin sonido | deslizar `.ficha-carrusel` |
| 4 | "Agendar este servicio" | `click #fichaAgendar` |
| 5 | Elegir con quién (o cualquiera) | `click .pro.cualquiera` |
| 6 | Elegir día en la tira y una hora | `click .dia[data-fecha="AAAA-MM-DD"]` → `click .turno >> nth=2` |
| 7 | Continuar (botón abajo, con el pulgar) | `click #btnSeguir` |
| 8 | Nombre, celular y aceptar | `fill [name=nombre]`, `fill [name=celular]`, `check [name=politica]` |
| 9 | Confirmar | `click #btnReservar` |
| 10 | Código, WhatsApp, calendario y "Avísame antes de mi cita" | esperar `.listo .codigo` |

## Video 2 · La clienta cambia o cancela su cita (≈ 30 s)

| Paso | Acción |
|---|---|
| 1 | Volver a `/reservar/` → tocar "Tu próxima cita" (`.proxima`) |
| 2 | "Cambiar día u hora" (`#reprogramar`) → elegir día y hora → "Confirmar cambio" (`#btnSeguir`) |
| 3 | Mostrar "Cancelar cita" (`#cancelar`) sin confirmar |

## Video 3 · Erika: primer ingreso y su día (≈ 75 s)

| Paso | Acción |
|---|---|
| 1 | `goto /panel/` → tocar su foto (`.persona >> text=Erika`) → PIN `1234` (`.tecla[data-n=…]`) → `#entrar` |
| 2 | Tour de bienvenida: mostrar los pasos (`#tourSeguir`) |
| 3 | Inicio: ingresos, asistencia, próxima cita, "Citas por gestionar" (Sí/No) |
| 4 | Agenda en tarjetas: menú inferior **Agenda** (`.dock a[data-sec="agenda"]`) |
| 5 | En una tarjeta: **WhatsApp**, **Llamar**, **Llegó** (`[data-accion="asistio"]`), **Cobrar** (`[data-accion="cobrar"]`) |
| 6 | Cobrar: valor, método Nequi (`[data-metodo="nequi"]`), `#guardarCobro` |

## Video 4 · Agendar y bloquear en segundos (≈ 40 s)

| Paso | Acción |
|---|---|
| 1 | Botón **+** (`#fab`) → tocar un servicio (`[data-serv] >> nth=0`) |
| 2 | Tocar una hora (`#turnosNueva .turno`) → tocar una clienta reciente (`#chipsRecientes .chip`) → `#guardarCita` |
| 3 | Agenda → "Bloquear" (en computador) o tocar un espacio libre en vista Día → **Bloquear este horario** → atajo "Almuerzo 1–2 p. m." (`[data-atajo="almuerzo"]`) → `#guardarBloq` |

## Video 5 · Erika personaliza el spa (≈ 75 s)

| Paso | Acción |
|---|---|
| 1 | Más → **Servicios** → tocar un servicio → precio y duración → Guardar |
| 2 | Pestaña **Galería de fotos y video** (`[data-tab="galeria"]`) → **Agregar** (`#geAgregar`) → elegir una foto del spa (`.sf-foto`) → ordenar con ‹ › |
| 3 | Más → **Reglas de reserva** → **Apariencia de la reserva**: título, color de acento, "Cambiar portada", `#apGuardar` |
| 4 | Abrir `/reservar/` y mostrar el cambio |
| 5 | Más → **Promociones** → "+ Promoción" con foto (`#elegirFotoPromo`) |
| 6 | Más → **Equipo** → una chica → pestañas Servicios, Horario, Permisos, Acceso (PIN) |
| 7 | Más → **Horario y festivos** |

## Video 6 · Para cada chica (≈ 50 s)

| Paso | Acción |
|---|---|
| 1 | Ingreso con su foto y PIN `1111` |
| 2 | Agenda en tarjetas (solo sus citas): Llegó, Cobrar, WhatsApp |
| 3 | Más → **Mi cuenta**: "Cambiar mi foto", su color (`#misColores .color-op`), "Activar notificaciones" |
| 4 | Instalar la app (Mi cuenta → Instalar app; en iPhone: Compartir → Agregar a inicio) |

## Video 7 · Fidelización y mensajes (≈ 40 s)

| Paso | Acción |
|---|---|
| 1 | Más → **Fidelización**: "Les toca volver", "Cumpleaños", "Recuperar" → **Escribir** abre WhatsApp con el mensaje listo |
| 2 | Más → **Mensajes**: editar un texto y ver la vista previa |
| 3 | Más → **Analítica**: cambiar entre "Este mes" y "Últimos 30 días" |

---

Datos de ejemplo: los crea `npm run dev` (clientas "Ana Prueba", "Bea Demo"…, cobros y una promoción).
Las capturas de referencia de cada pantalla están en `docs/plataforma/capturas/` (`movil-*`).
