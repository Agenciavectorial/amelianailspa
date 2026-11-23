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
> funciones. Por eso este paso va antes de unir la rama `claude/plataforma-citas` a `main`.

## 3. Crear las tablas y los datos iniciales

```bash
npx wrangler d1 migrations apply amelia-citas --remote
```

Esto crea las tablas y carga lo público de la página: horario, los 16 servicios con foto y duración
y el equipo (Erika, Leidy, Karla, Julieth y Darly). **No** carga clientas ni PIN.

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

Haz merge de la rama `claude/plataforma-citas` (con el `database_id` real) y Cloudflare Pages
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

El Agente 1 (página) debe cambiar los botones "Agendar" de Kumbio por `/reservar`. Los detalles
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
`docs/plataforma/capturas/`.

## 12. Límites del plan gratuito de Cloudflare

Sobran para un spa: Workers/Pages Functions 100 000 peticiones al día; D1 5 millones de filas leídas
y 100 000 escritas al día, 5 GB. El importador CSV envía lotes pequeños (10 citas o 100 servicios o
clientas por llamada) para no pasar el límite de consultas por petición.
