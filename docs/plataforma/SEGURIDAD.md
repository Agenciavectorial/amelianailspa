# Seguridad, copias de seguridad y cómo restaurar

Decisiones de seguridad de la plataforma de citas de Amelia Nail Spa y los pasos para recuperar los datos.
Este repositorio es **público**: aquí no hay llaves, contraseñas, datos de clientas ni respaldos. Todo lo secreto
vive en Cloudflare (Settings → Variables and Secrets) y los respaldos dentro de la base o en R2.

## 1. Revisión del repositorio (nov 2026)

| Hallazgo | Riesgo | Qué se hizo |
|---|---|---|
| `dev/.estado-aud/` y `dev/.estado-repro/` estaban subidos: bases SQLite locales de pruebas. | Bajo: solo tenían datos **ficticios** (Ana Prueba, 573000000001…) y hashes de PIN de prueba. No había clientas reales. | Se quitaron del repositorio y `.gitignore` ahora ignora `dev/.estado*/`, `*.sqlite*` y los respaldos. Siguen en el historial de git; como son ficticios no hace falta reescribirlo. |
| Llaves VAPID, `CLAVE_INICIAL`, `CRON_CLAVE` | — | Nunca se subieron: solo valores de prueba (`clave-local-de-pruebas`) y el código que lee los secretos. |
| `database_id` de D1 en `wrangler.toml` | Ninguno | No es secreto: sin el token de Cloudflare no da acceso. |
| `docs/migracion-kumbio/datos/` | Ninguno | Solo servicios y nombres del equipo (sin celulares). Clientas y citas de Kumbio están fuera del repo. |

**Pendiente de la agencia:** revisar que el Google Sheet / Apps Script de otros proyectos no esté publicado
"para cualquiera con el enlace" y que el Google Calendar del ataque anterior ya no tenga scripts con permiso de escritura.

## 2. Datos protegidos

- Toda la información vive en **Cloudflare D1** y solo se lee por la API (`/api/*`). No hay hojas de cálculo ni archivos públicos.
- Lo público (`/api/public/*`) solo entrega catálogo, horarios y turnos libres. Una cita solo se ve con su **enlace privado**
  (token aleatorio de 24 bytes).
- El panel exige sesión. Cada ruta revisa en el servidor el rol y los permisos (esconder un botón no es seguridad).
- Las colaboradoras ven el celular de las clientas oculto (`•••• 4567`) y en **Cuentas** solo lo suyo: sus servicios,
  sus ventas y su comisión. Gastos, metas, deudas, comisiones de otras y respaldos son solo de Erika.
- Cabeceras: CSP estricta sin scripts en línea, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `noindex` en el
  panel y la API (`functions/_lib/cabeceras.js`, `functions/api/[[ruta]].js`). Las fotos subidas se sirven con
  `Content-Security-Policy: default-src 'none'; sandbox`.
- Subida de fotos: el servidor revisa los primeros bytes del archivo (no basta con que el navegador diga "es imagen").

## 3. Acceso del equipo (PIN)

| Medida | Detalle |
|---|---|
| PIN de **6 números** | Los PIN nuevos deben tener 6 números y no pueden ser fáciles (123456, 000000, 121212, 123123…). |
| Migración desde 4 | Quien tenga un PIN viejo de 4 entra una vez y la app le pide crear uno de 6 antes de seguir. |
| Bloqueo | 5 PIN incorrectos de una persona (o 20 desde la misma conexión) → bloqueo de 15 minutos. Se cuenta **en el servidor** (tabla `intentos`), no en el celular. |
| Guardado | PBKDF2-SHA256, 100 000 iteraciones y sal aleatoria. Nunca se guarda el PIN. |
| Sesiones que caducan | Cookie `HttpOnly; Secure; SameSite=Strict`. Vence a los **30 días** o a los **14 días sin usarse**. |
| Cerrar otros dispositivos | Mi cuenta → "Cerrar las demás sesiones" (con la lista de dispositivos). Erika: Equipo → la chica → Acceso → "Cerrar sus sesiones abiertas". Cambiar el PIN también cierra las demás. |

## 4. Anti-spam de reservas

Antecedente: alguien metió ~300 citas a un Google Calendar conectado por un script. Capas actuales (todas en el servidor):

1. **Pausa de emergencia:** Panel → Seguridad y respaldos → "Pausar reservas". Nadie puede reservar en línea; las clientas
   ven un mensaje y el botón de WhatsApp. El equipo sigue agendando desde el panel.
2. **Por conexión (IP):** 8 reservas por hora (`LIMITE_RESERVAS_HORA`). La IP no se guarda: solo una huella (SHA-256 recortada) para detectar ráfagas.
3. **Por celular:** 4 intentos por hora (`LIMITE_RESERVAS_CELULAR_HORA`), máximo de reservas nuevas en línea por número al día
   (`max_reservas_celular_dia`, 3, editable) y máximo de citas futuras activas (`max_citas_por_celular`, 3).
4. **Freno general:** más de 40 reservas en línea en una hora (`LIMITE_RESERVAS_GLOBAL_HORA`) frena todas las reservas en
   línea durante 1 hora (un ataque con muchos números distintos).
5. **Trampas para robots:** campo oculto (`sitio_web`) y tiempo mínimo de 1,5 s en el formulario.
6. **Borrado en bloque:** Seguridad y respaldos lista las reservas en línea recientes, marca las sospechosas (4+ desde la misma
   conexión o 3+ del mismo número) y las borra en bloque. Las que tienen cobros nunca se borran.
7. La agenda se protege con la base de datos: dos citas nunca pueden ocupar el mismo turno (restricción única).

## 5. Copias de seguridad

| Copia | Cuándo | Dónde | Cuánto dura |
|---|---|---|---|
| **Time Travel de D1** | Automática, continua | Cloudflare | 30 días: se puede volver a cualquier minuto. |
| **Respaldo diario** | Cada día desde las 3:00 a. m. (Worker `amelia-recordatorios`) | Tabla `respaldos` de la base (últimos 14) y, si se configura, bucket R2 `amelia-respaldos` | 14 días en la base; en R2 lo que se quiera. |
| **Respaldo manual** | Panel → Seguridad y respaldos → "Hacer copia ahora" | Igual | Se descarga como JSON. |

Se respaldan todas las tablas salvo sesiones, intentos, cola de notificaciones y las fotos subidas (se pueden volver a subir).
Recomendado: descargar una copia al mes y guardarla en el Drive del spa (tiene datos de clientas: **nunca** en este repositorio).

Para guardar también en R2 (fuera de la base, recomendado):
```bash
npx wrangler r2 bucket create amelia-respaldos
# quitar el comentario del bloque [[r2_buckets]] en workers/recordatorios/wrangler.toml y volver a publicar:
npx wrangler deploy --config workers/recordatorios/wrangler.toml
```

## 6. Cómo restaurar

**Opción A — Time Travel (lo más rápido, últimos 30 días):**
```bash
npx wrangler d1 time-travel info amelia-citas                       # muestra el "bookmark" actual
npx wrangler d1 time-travel restore amelia-citas --timestamp=2026-11-25T08:00:00-05:00
```
Vuelve TODA la base a ese minuto (lo que se hizo después se pierde). La respuesta incluye un bookmark para deshacerlo.

**Opción B — desde un respaldo descargado (JSON):**
1. Panel → Seguridad y respaldos → Descargar (queda `respaldo-amelia-AAAA-MM-DD.json`).
2. Probarlo primero en local: `npm run dev` en otra terminal y luego
   `node dev/restaurar.mjs respaldo-amelia-AAAA-MM-DD.json --local`.
3. En la base real: `node dev/restaurar.mjs respaldo-amelia-AAAA-MM-DD.json --remoto`. Pide escribir `RESTAURAR`,
   guarda antes una copia completa de lo que hay (`antes-de-restaurar-….sql`) y cierra todas las sesiones.
4. Solo para revisar el contenido sin tocar nada: `node dev/restaurar.mjs respaldo.json` (genera el `.sql`).

**Opción C — export SQL completo** (por ejemplo antes de una migración grande):
```bash
npx wrangler d1 export amelia-citas --remote --output respaldo-$(date +%F).sql
npx wrangler d1 execute amelia-citas --remote --file respaldo-AAAA-MM-DD.sql   # para restaurarlo en una base vacía
```

## 7. Secretos y variables (Cloudflare → amelianailspa → Settings → Variables and Secrets)

| Nombre | Tipo | Para qué |
|---|---|---|
| `CLAVE_INICIAL` | Secreto | Primer PIN de Erika. Se puede borrar después. |
| `VAPID_PUBLICA`, `VAPID_PRIVADA`, `VAPID_SUJETO` | Secretos | Notificaciones (también en el Worker). |
| `CRON_CLAVE` | Secreto (opcional) | Disparar recordatorios a mano. |
| `CLOUDINARY_CLOUD`, `CLOUDINARY_KEY`, `CLOUDINARY_SECRET` | Secretos (opcional) | Subida firmada de fotos a Cloudinary. Sin ellos (y sin R2) las fotos se guardan en la base. |
| `LIMITE_RESERVAS_HORA`, `LIMITE_RESERVAS_CELULAR_HORA`, `LIMITE_RESERVAS_GLOBAL_HORA` | Variables (opcional) | Ajustar los frenos de reservas (8 / 4 / 40 por defecto). |
| Bucket R2 `MEDIOS` / `RESPALDOS` | Binding (opcional) | Fotos y respaldos fuera de la base. |
