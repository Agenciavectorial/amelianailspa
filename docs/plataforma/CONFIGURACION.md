# Configuración de la plataforma de citas (paso a paso)

Lo que está aquí lo hace **una persona con acceso a la cuenta de Cloudflare** del spa o de la agencia.
Nada de esto se puede hacer desde el repositorio. Tiempo estimado: 20 minutos.

> Requisitos: Node.js 20 o más en el computador, y este repositorio clonado.
> Todos los comandos se escriben en una terminal dentro de la carpeta del repositorio.

## 1. Instalar las herramientas (una sola vez)

```bash
npm install          # instala wrangler (la herramienta de Cloudflare) en node_modules
npx wrangler login   # abre el navegador para autorizar tu cuenta de Cloudflare
```

## 2. Crear la base de datos D1

```bash
npx wrangler d1 create amelia-citas
```

La respuesta muestra algo como:

```toml
[[d1_databases]]
binding = "DB"
database_name = "amelia-citas"
database_id = "1234abcd-....-....-....-............"
```

Copia **solo el `database_id`** y reemplaza los ceros en `wrangler.toml`:

```toml
database_id = "00000000-0000-0000-0000-000000000000"   ← poner aquí el ID real
```

El ID no es secreto: se puede subir al repositorio. Haz commit de ese cambio.

> ⚠️ Mientras el ID siga en ceros, los despliegues de Cloudflare Pages fallarán al publicar las
> funciones. Por eso este paso va antes de unir la rama de la plataforma a `main`.

## 3. Crear las tablas y los datos iniciales

```bash
npx wrangler d1 migrations apply amelia-citas --remote
```

Esto crea las tablas y carga lo público de la página: horario, los 16 servicios con foto y duración
y el equipo (Erika, Leidy, Karla, Julieth y Daily). **No** carga clientas ni PIN.

Para revisar que quedó bien:

```bash
npx wrangler d1 execute amelia-citas --remote --command "SELECT nombre, duracion FROM servicios"
```

## 4. Crear el secreto `CLAVE_INICIAL`

Es una clave de un solo uso para que Erika cree su PIN la primera vez. Elige una de 8 caracteres o
más (por ejemplo tres palabras: `uñas-lila-2027`) y guárdala para dársela a Erika en persona.

Opción A, en el panel de Cloudflare:
1. Workers & Pages → **amelianailspa** → **Settings** → **Variables and Secrets**.
2. **Add** → Type: **Secret** → Name: `CLAVE_INICIAL` → Value: la clave → Save.
3. Hazlo para **Production** (y para **Preview** si vas a probar en una rama).

Opción B, por terminal:

```bash
npx wrangler pages secret put CLAVE_INICIAL --project-name amelianailspa
```

La clave solo sirve mientras Erika no tenga PIN. Después de configurarlo puedes borrar el secreto.

### Variables opcionales

| Nombre | Para qué | Por defecto |
|---|---|---|
| `LIMITE_RESERVAS_HORA` | Reservas en línea permitidas por IP por hora (anti‑spam). | 8 |

## 5. Publicar

Une la rama de la plataforma a `main` (con el `database_id` real) usando **"Squash and merge"** y un
mensaje propio de la agencia (así `main` queda con un historial limpio), y borra la rama después. Cloudflare Pages
despliega solo. El build sigue siendo **sin comando** y con salida `public` (ver `README.md`).

Comprueba en `https://amelianailspa.pages.dev` (o el dominio):

- `/reservar` muestra los servicios.
- `/panel` muestra "Configura tu PIN".
- `/api/public/catalogo` responde JSON (si dice *"La base de datos no está configurada"*, revisa el paso 2).

## 6. Primer ingreso de Erika

1. Erika abre `https://amelianailspa.com/panel` en su celular.
2. Escribe la **clave inicial** y elige su PIN (4 a 8 números).
3. En **Equipo** asigna un PIN a cada chica (pestaña *Acceso*) y revisa servicios, horario y permisos.
4. Opcional: instala el panel como app (Mi cuenta → *Instalar app*).

Si Erika olvida su PIN: hay que borrarlo en la base para que vuelva a aparecer "Configura tu PIN":

```bash
npx wrangler d1 execute amelia-citas --remote --command "UPDATE colaboradoras SET pin_hash = NULL WHERE rol = 'propietaria'"
npx wrangler pages secret put CLAVE_INICIAL --project-name amelianailspa   # una clave nueva
```

## 7. Conectar la página principal

En la página principal hay que cambiar los botones "Agendar" de Kumbio por `/reservar`. Los detalles
están en `docs/plataforma/PARA-LA-PAGINA.md`.

## 8. Dominio

Si `amelianailspa.com` ya está en *Custom domains* del proyecto, no hay que hacer nada más: la
plataforma vive en el mismo dominio (`/reservar`, `/panel`). Si todavía está en Netlify, sigue los
pasos del `README.md`.

## 9. Copias de seguridad

- D1 guarda historial automático (**Time Travel**) y permite volver a un punto anterior:
  `npx wrangler d1 time-travel info amelia-citas`.
- Copia manual completa (recomendado una vez al mes, guárdala fuera del repositorio porque tiene datos de clientas):

```bash
npx wrangler d1 export amelia-citas --remote --output respaldo-$(date +%F).sql
```

## 10. Base de pruebas para ramas (opcional, recomendado)

Por defecto, los despliegues de vista previa (otras ramas) usan **la misma base** que producción.
Para probar sin tocar citas reales, crea otra base y agrégala a `wrangler.toml`:

```bash
npx wrangler d1 create amelia-citas-pruebas
npx wrangler d1 migrations apply amelia-citas-pruebas --remote
```

```toml
[[env.preview.d1_databases]]
binding = "DB"
database_name = "amelia-citas-pruebas"
database_id = "<ID de la base de pruebas>"
migrations_dir = "migrations"
```

## 11. Desarrollo local (agencia)

```bash
npm install
npm run dev          # http://localhost:8788/reservar y /panel con datos FICTICIOS (Erika 1234, chicas 1111)
npm run test:unit    # pruebas unitarias
npm run test:e2e     # pruebas de punta a punta (levanta su propio servidor y usa Chromium)
```

La base local vive en `dev/.estado/` (ignorada por git). Las capturas de las pruebas quedan en
`dev/test-results/capturas/`; `CAPTURAS_DOCS=1 npm run test:e2e` actualiza las de referencia en
`docs/plataforma/capturas/`.

## 12. Límites del plan gratuito de Cloudflare

Sobran para un spa: Workers/Pages Functions 100 000 peticiones al día; D1 5 millones de filas leídas
y 100 000 escritas al día, 5 GB. El importador CSV envía lotes pequeños (10 citas o 100 servicios o
clientas por llamada) para no pasar el límite de consultas por petición.

## 13. Notificaciones push (recordatorios y avisos al equipo)

Gratis y sin cupos. Dos piezas: el proyecto Pages (avisos al equipo al instante) y un Worker pequeño
con cron (recordatorios a clientas cada 15 min), porque Pages Functions no ejecuta crons.

1. **Generar las llaves VAPID** (una sola vez):

   ```bash
   node dev/vapid.mjs
   ```

   Imprime `VAPID_PUBLICA`, `VAPID_PRIVADA` y los comandos para guardarlas. La privada es secreta.

2. **Guardar los secretos en el proyecto Pages** (`amelianailspa`): `VAPID_PUBLICA`, `VAPID_PRIVADA`
   y `VAPID_SUJETO` (`mailto:` + correo del spa), con los comandos que imprime el script o en
   Settings → Variables and Secrets. Volver a desplegar.

3. **Publicar el Worker de recordatorios:**

   ```bash
   # poner el mismo database_id de wrangler.toml en workers/recordatorios/wrangler.toml
   npx wrangler deploy --config workers/recordatorios/wrangler.toml
   npx wrangler secret put VAPID_PUBLICA --config workers/recordatorios/wrangler.toml
   npx wrangler secret put VAPID_PRIVADA --config workers/recordatorios/wrangler.toml
   npx wrangler secret put VAPID_SUJETO  --config workers/recordatorios/wrangler.toml
   ```

   Corre cada 15 minutos. En Cloudflare → Workers → `amelia-recordatorios` → *Logs* se ve qué envió.

4. **Aplicar la migración nueva** (si la base ya existía): `npx wrangler d1 migrations apply amelia-citas --remote`.

5. Opcional, `CRON_CLAVE` (16+ caracteres) en Pages: permite disparar los recordatorios a mano con
   `curl -X POST https://amelianailspa.com/api/interno/recordatorios -H "X-Cron-Clave: <clave>" -H "Content-Type: application/json" -d "{}"`.
   Sin ese secreto, la ruta responde 404.

Qué se envía:

| A quién | Cuándo |
|---|---|
| La colaboradora y Erika | Cita nueva (en línea o desde el panel), movida o cancelada. No le llega a quien hizo el cambio. |
| La clienta (si tocó "Avísame antes de mi cita") | 24 h antes (entre 20 y 24 h) y 2 h antes. |
| La clienta | "Te toca volver" cuando se cumple el ciclo de retorno de su último servicio, entre 10:00 y 19:00. |

Cada recordatorio sale una sola vez (tabla `push_enviados`). Las suscripciones vencidas se borran solas.
En iPhone las notificaciones web solo funcionan con la app instalada en la pantalla de inicio (iOS 16.4+).

## 14. Subir fotos y videos desde el celular (opcional, R2)

Hoy Erika arma las galerías eligiendo entre las fotos publicadas del spa o pegando un enlace (por
ejemplo de Cloudinary). Para que pueda **subir desde el celular**, hay que conectar un bucket R2:

1. Cloudflare → **R2** → activar R2 en la cuenta (el plan gratuito incluye 10 GB) → **Create bucket**
   con el nombre `amelia-medios`.
2. Agregar el binding a `wrangler.toml` y desplegar:

   ```toml
   [[r2_buckets]]
   binding = "MEDIOS"
   bucket_name = "amelia-medios"
   ```

3. Listo: en Panel → Servicios → Galería → Agregar → **Subir del celular** aparece la cámara/galería.
   Los archivos se sirven desde `/api/medios/…` (JPG, PNG, WebP hasta 6 MB; MP4 hasta 30 MB).

Cuando se agreguen fotos nuevas a `public/img/`, correr `node dev/listar-fotos.mjs` para que aparezcan
en "Fotos del spa".
