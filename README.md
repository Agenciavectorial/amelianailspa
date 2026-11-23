# Amelia Nail Spa

Página web y plataforma de citas de **Amelia Nail Spa** (C.C. Bosque Plaza, Aranjuez, Medellín),
hechas por Agencia Vectorial. Todo se publica en **Cloudflare Pages** (proyecto `amelianailspa`).

| Ruta | Contenido |
|---|---|
| `public/index.html` | La página principal (estática, sin build). |
| `public/styles.css`, `public/app.js` | Estilos e interacción de la página (sin scripts en línea). |
| `public/img/` | Fotos en WebP en varios tamaños (480/720/960…), servidas desde el mismo sitio. |
| `public/fonts/` | Playfair Display, DM Sans y Great Vibes servidas localmente (más rápido que Google Fonts). |
| `public/reservar/`, `public/panel/`, `functions/` | Plataforma de citas (en desarrollo). |
| `scripts/cambiar-agenda.py` | Cambia el enlace de "Agendar" de toda la página (Kumbio → `/reservar`). |
| `docs/migracion-kumbio/` | Formato de importación desde Kumbio y reporte de la migración. |

## Velocidad (Lighthouse, con compresión como en Cloudflare)
| | Antes (Netlify, celular) | Ahora celular | Ahora computador |
|---|---|---|---|
| Rendimiento | 66 | **94** | **100** |
| Accesibilidad | 95 | **100** | **100** |
| Buenas prácticas / SEO | 100 / 100 | 100 / 100 | 100 / 100 |
| Contenido principal (LCP) | 8,1 s | 3,1 s | 0,7 s |
| Bloqueo (TBT) | 370 ms | 20 ms | 0 ms |
| Peso total | 4,7 MB | 0,7 MB | 1,0 MB |

Para mantenerlo: fotos nuevas siempre por `scripts/optimizar-fotos.py` (WebP en varios tamaños) y con
`loading="lazy"` (salvo las del inicio); videos con `preload="none"`. Las fuentes están recortadas a los
caracteres del español.

## Fotos pendientes
Lifting de pestañas, pestañas punto a punto, laminado y sombreado de cejas usaban fotos de otros negocios;
hoy muestran un arte de la marca (depilación ya tiene foto propia) (`public/img/arte/`). Cuando lleguen las fotos propias a
`fotos-nuevas/`, se optimizan con el script y se cambia el `<div class="sc-img sc-arte …">` de cada servicio por el `<img>`.

## SEO local
- Título, descripción y Open Graph (imagen propia `og.jpg`) con "spa de uñas Medellín / Aranjuez".
- Datos estructurados (JSON-LD): `NailSalon` con dirección, horario, zona, redes, catálogo de servicios y
  acción de reserva; `WebSite` y `FAQPage` con las mismas preguntas que se ven en la sección de preguntas.
- `sitemap.xml` con imágenes, `robots.txt` (excluye `/panel` y `/api/`), `404.html`, manifest e íconos propios.
- Coordenadas exactas de la ficha de Google Maps; "Cómo llegar" y "Dejar reseña" abren directamente la ficha del spa.
- Google Analytics 4 (`G-PPSD6EHCEW`, `public/analitica.js`) con eventos de agendar, WhatsApp, cómo llegar y reseña.

## Agenda
Los botones "Agendar" ya apuntan a la plataforma propia (`/reservar`). Para volver a Kumbio en una emergencia:
```bash
python3 scripts/cambiar-agenda.py https://agenda.kumbio.com/amelia-nail-spa
```
El cambio se hizo con:
```bash
python3 scripts/cambiar-agenda.py /reservar
```
Eso deja cada tarjeta de servicio en `/reservar?servicio=<slug>` (atributo `data-servicio`), el botón
"Agenda con ella" del equipo en `/reservar?con=<slug>` (atributo `data-con`), abre todo en la misma pestaña
y agrega `/reservar` al sitemap. Los slugs coinciden con `docs/plataforma/PARA-LA-PAGINA.md`.

## Publicar en Cloudflare Pages
1. Cloudflare → Workers & Pages → Create → Pages → conectar este repositorio.
2. Framework preset: **None**. Build command: *(vacío)*. Output directory: **public** (también lo fija `wrangler.toml`).
3. Probar en `amelianailspa.pages.dev`; cuando todo esté bien, agregar `amelianailspa.com` en *Custom domains*
   y apagar el sitio de Netlify.
