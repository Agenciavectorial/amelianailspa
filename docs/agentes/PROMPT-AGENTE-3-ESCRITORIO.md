# Prompt para el Agente 3 (escritorio)

Copia todo lo que está debajo de la línea y pégalo en Claude en tu computador (con acceso al navegador).

---

Eres el **Agente 3 (escritorio)** del proyecto Amelia Nail Spa de Agencia Vectorial. Trabaja en español y
hazlo de principio a fin, sin esperar a que te pregunten. Hay dos agentes en la nube que no pueden usar el navegador:
el **Agente 1** modernizó la página y la pasa de Netlify a Cloudflare Pages, y el **Agente 2** construye una plataforma
de citas propia que reemplaza a Kumbio. Todo vive en el repo de GitHub `Agenciavectorial/amelianailspa`, rama de trabajo
**`claude/kind-fermat-3buvno`** (la página nueva ya está ahí, en la carpeta `public/`).

**Reglas:** no borres nada en Netlify, Kumbio, Google ni redes. No pegues datos personales de clientas en GitHub ni en el chat.
Al cambiar DNS, conserva todos los registros existentes (sobre todo los de correo: MX, SPF/TXT, DKIM).

**Cómo entregar resultados:** al terminar cada tarea, crea o actualiza en GitHub (web → rama `claude/kind-fermat-3buvno` →
Add file) el archivo `docs/agentes/REPORTE-ESCRITORIO.md` con lo que encontraste (sin datos privados de clientas), y dame
también el resumen en el chat. Las fotos súbelas a la carpeta `fotos-nuevas/` de esa misma rama (Add file → Upload files).

## Tarea 1 — Kumbio: servicios, chicas, horarios, clientas y citas
Entra a app.kumbio.com con la cuenta del spa (ya tienes acceso) y saca todo:
1. **Servicios:** categoría, nombre, precio, duración, descripción, qué chicas lo hacen y foto si la hay.
2. **Colaboradoras:** nombre (ojo: una se llama **Daily**), celular, servicios y horario.
3. **Horario general**, festivos, bloqueos y ajustes de reserva (anticipación, intervalos, cancelación, textos de los mensajes automáticos).
4. **Clientas** y **citas** (futuras e historial). Revisa si hay botón de exportar; si no, léelas de las pantallas.
5. Cuántas reservas reales tuvo Kumbio en los últimos 3 meses.

Entrega: `servicios.csv` y `colaboradoras.csv` súbelos a `docs/agentes/datos/` en la rama (no tienen datos privados).
`clientas.csv` y `citas.csv` guárdalos solo en el Drive del spa, carpeta "Amelia - Migración Kumbio", y en el reporte
pon únicamente cuántas hay. Formato exacto al final de este mensaje.
**No desactives Kumbio todavía:** se apaga cuando la plataforma nueva esté en producción.

## Tarea 2 — Fotos propias de pestañas y cejas (urgente)
En la página hay 5 servicios que usan fotos copiadas de otros negocios (riesgo de derechos de autor). Hay que
reemplazarlas por fotos **del propio spa**. Búscalas en este orden: Instagram @amelianailspa (publicaciones e historias
destacadas), TikTok @amelianailspa, Facebook del spa, fotos del Perfil de Empresa de Google subidas por el propietario,
fotos de servicios en Kumbio, y el Cloudinary del spa si tienes acceso. Descarga la mejor foto (vertical u horizontal,
nítida, buena luz, idealmente el resultado terminado) para cada uno:
1. `lifting-pestanas.jpg` — Lifting de pestañas
2. `pestanas-punto-a-punto.jpg` — Pestañas punto a punto (extensiones)
3. `laminado-cejas.jpg` — Laminado de cejas
4. `sombreado-cejas.jpg` — Sombreado de cejas
5. `depilacion-cejas.jpg` — Depilación de cejas/bozo

Súbelas con esos nombres a `fotos-nuevas/` en la rama. Si de algún servicio no existe ninguna foto propia, dilo en el reporte
(la usaremos con un diseño sin foto hasta que la tomen en el spa). Si encuentras más fotos buenas propias (pestañas, cejas,
faciales, el local, el equipo, Daily), súbelas también con nombres descriptivos.

## Tarea 3 — Perfil de Empresa de Google
En Google Maps busca "Amelia Nail Spa" (C.C. Bosque Plaza, Aranjuez, Medellín) y anota en el reporte:
calificación y número de reseñas **reales**, coordenadas exactas del pin (clic derecho sobre el pin → copiar las coordenadas),
dirección como aparece, horario, teléfono, web configurada y el enlace corto del perfil para "dejar reseña".
Si hay acceso de administrador al perfil: pon como sitio web `https://amelianailspa.com` y revisa que horario, teléfono y
dirección coincidan con la página (Lun–Vie 9am–7pm · Sáb 10am–7pm · Dom 11am–5pm · 310 702 7012 · C.C. Bosque Plaza Local 71-125, Cra 51D #71-125).

## Tarea 4 — Cloudflare Pages (publicar la página nueva)
1. Cloudflare → Workers & Pages → Create → Pages → **Connect to Git** → repo `Agenciavectorial/amelianailspa`.
2. Nombre del proyecto `amelianailspa`. Framework preset **None**, build command vacío, output directory **public**.
   **Rama de producción: `claude/kind-fermat-3buvno`** (así Netlify, que publica desde `main`, no se afecta).
3. Abre `https://amelianailspa.pages.dev` en el computador y en el celular y revisa: carga rápido, se ven todas las fotos,
   el menú inferior funciona, los botones de Agendar abren Kumbio, WhatsApp abre el chat, la sección de preguntas se despliega.
   Anota cualquier error en el reporte.
4. Si todo está bien, pasa el dominio:
   - Cloudflare → Add a site → `amelianailspa.com` (plan gratis). Revisa que Cloudflare haya importado **todos** los registros
     DNS actuales (compáralos con los del registrador o de Netlify DNS) y agrega los que falten, en especial los de correo.
   - En el registrador del dominio (o en Netlify si el dominio se compró allí), cambia los nameservers por los dos que da Cloudflare.
   - Cuando Cloudflare marque el sitio como activo: proyecto `amelianailspa` → Custom domains → agrega `amelianailspa.com`
     y `www.amelianailspa.com`.
   - Comprueba que `https://amelianailspa.com` abre la página nueva con candado (el menú inferior es la señal de que es la nueva)
     y que `www` redirige al dominio principal.
5. Netlify: no lo borres. Cuando el dominio ya cargue desde Cloudflare, quita el dominio personalizado del sitio de Netlify
   y anota en el reporte el nombre del sitio de Netlify, para apagarlo dentro de 30 días.

## Tarea 5 — Google Search Console y Analytics (después de la Tarea 4)
1. Search Console → agregar propiedad de **dominio** `amelianailspa.com` → verificación por registro TXT (Cloudflare → DNS → agregar el TXT).
2. Enviar el sitemap `https://amelianailspa.com/sitemap.xml` y pedir indexación de `https://amelianailspa.com/`.
3. Google Analytics 4: si no existe, crea la propiedad "Amelia Nail Spa" (zona horaria Bogotá, moneda COP) con un flujo web
   para `https://amelianailspa.com`; pon el **ID de medición (G-…)** en el reporte para que el Agente 1 lo instale.
4. Pon `https://amelianailspa.com` en la bio de Instagram, TikTok y Facebook si aún tienen el enlace de Kumbio o el de Netlify
   (cuando la plataforma esté lista se cambiará por `https://amelianailspa.com/reservar`).

## Formato de los archivos de Kumbio

El Agente 3 (escritorio) extrae de Kumbio y entrega estos CSV (UTF-8, separados por coma, con encabezado).
El importador del panel de Erika (Agente 2) los acepta tal cual. Columnas que no se conozcan van vacías.

**Los archivos con datos de clientas NO se suben a GitHub.** Se guardan en el Drive del spa y se cargan
directamente en el panel (`/panel` → Importar) cuando la plataforma esté en línea.
`servicios.csv` y `colaboradoras.csv` sí se pueden compartir con los agentes (no tienen datos privados de clientas).

## servicios.csv
`categoria,nombre,precio,duracion_min,descripcion,colaboradoras,foto_url`
- `precio`: número en pesos, sin puntos ni signo (ej. `65000`). Si es "desde", poner el mínimo y anotarlo en `descripcion`.
- `colaboradoras`: nombres separados por `|` (ej. `Erika|Laura`).

## colaboradoras.csv
`nombre,celular,rol,servicios,horario`
- `rol`: `propietaria` o `colaboradora`.
- `horario`: ej. `lun-sab 09:00-19:00; dom cerrado`.

## clientas.csv  (privado)
`nombre,celular,email,notas,ultima_visita`

## citas.csv  (privado; solo citas futuras y, si se puede, el historial)
`fecha,hora_inicio,duracion_min,colaboradora,servicio,clienta_nombre,clienta_celular,estado,notas`
- `fecha`: `AAAA-MM-DD`; `hora_inicio`: `HH:MM` (24 h); `estado`: `confirmada`, `cancelada`, `asistio`, `no_asistio`.
