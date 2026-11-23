# Tarea 6 para el agente de escritorio (encender la plataforma de citas)

Copia lo de debajo de la línea y pégaselo al agente de escritorio en la misma conversación.

---

**Tarea 6: encender la plataforma de citas en Cloudflare.** Hazla después de la Tarea 4 (el proyecto Pages `amelianailspa` ya
creado). Los pasos completos están en el repo, rama `claude/plataforma-citas`, archivo `docs/plataforma/CONFIGURACION.md`.
Resumen:

1. **Crear la base D1** llamada `amelia-citas`:
   - Por terminal (si tienes Node 20+): clona el repo, `git checkout claude/plataforma-citas`, `npm install`,
     `npx wrangler login` y `npx wrangler d1 create amelia-citas`.
   - Sin terminal: Cloudflare → Storage & Databases → D1 → Create → nombre `amelia-citas`.
2. **Poner el ID de la base** (`database_id`, no es secreto) en `wrangler.toml` de la rama `claude/plataforma-citas`,
   en lugar de `00000000-0000-0000-0000-000000000000`. Puedes editar el archivo desde GitHub web. Commit: "ID de la base D1".
3. **Crear las tablas y los datos iniciales:**
   - Por terminal: `npx wrangler d1 migrations apply amelia-citas --remote`.
   - Sin terminal: D1 → `amelia-citas` → Console. Pega y ejecuta en orden el contenido de
     `migrations/0001_esquema.sql` y luego el de `migrations/0002_datos_iniciales.sql`.
   - Comprueba con `SELECT nombre, duracion FROM servicios;`: deben salir 16 servicios.
4. **Conectar la base al proyecto:** Workers & Pages → `amelianailspa` → Settings → Bindings → Add → D1 database →
   Variable name `DB` → base `amelia-citas`. Hazlo para Production y Preview.
5. **Clave inicial de Erika:** Settings → Variables and Secrets → Add → tipo **Secret** → nombre `CLAVE_INICIAL` → una clave de 8
   o más caracteres que inventes. **No la escribas en GitHub ni en el chat con los agentes**: guárdala para dársela a Erika en persona.
6. **Si el Agente 2 ya publicó las notificaciones push**, sigue también la sección de llaves VAPID y del Worker de recordatorios
   de `docs/plataforma/CONFIGURACION.md`.
7. **Avisa en `docs/agentes/REPORTE-ESCRITORIO.md`** (rama `claude/kind-fermat-3buvno`) que la base quedó lista. El Agente 1
   une la plataforma a la página, cambia los botones de Kumbio a `/reservar` y publica.
8. Cuando el Agente 1 avise que está publicado, comprueba:
   - `https://amelianailspa.com/reservar` muestra los servicios;
   - `https://amelianailspa.com/panel` pide configurar el PIN.

   Luego entra con Erika (o pásale la clave) para que cree su PIN, y carga en Panel → Importar los CSV de Kumbio que guardaste en Drive.
9. **Kumbio:** solo cuando la primera reserva real por `/reservar` funcione, desactiva la página de agendamiento de Kumbio
   (no borres la cuenta) y cambia el enlace de las bios por `https://amelianailspa.com/reservar`.
