# Amelia Nail Spa

Página web y plataforma de citas de **Amelia Nail Spa** (C.C. Bosque Plaza, Aranjuez, Medellín),
hechas por Agencia Vectorial. Todo se publica en **Cloudflare Pages** (proyecto `amelianailspa`).

| Ruta | Contenido |
|---|---|
| `public/index.html` | La página principal (estática, sin build). |
| `public/styles.css`, `public/app.js` | Estilos e interacción de la página (sin scripts en línea). |
| `public/img/` | Fotos en WebP en varios tamaños (480/720/960…), servidas desde el mismo sitio. |
| `public/fonts/` | Playfair Display, DM Sans y Great Vibes servidas localmente (más rápido que Google Fonts). |
| `public/reservar/`, `public/panel/`, `functions/` | Plataforma de citas (rama `claude/plataforma-citas`, en desarrollo). |
| `scripts/cambiar-agenda.py` | Cambia el enlace de "Agendar" de toda la página (Kumbio → `/reservar`). |
| `docs/agentes/` | Prompt del agente de escritorio y formato de importación desde Kumbio. |

## Velocidad (Lighthouse, celular, con compresión como en Cloudflare)
| | Antes (Netlify) | Ahora |
|---|---|---|
| Rendimiento | 66 | **94** |
| Accesibilidad / Buenas prácticas / SEO | 95 / 100 / 100 | 95 / 100 / 100 |
| Contenido principal (LCP) | 8,1 s | **3,1 s** |
| Bloqueo (TBT) | 370 ms | **10 ms** |
| Peso total | 4,7 MB | **0,7 MB** |

Para mantenerlo: fotos nuevas siempre en WebP con varios tamaños y `loading="lazy"` (salvo las del inicio);
videos con `preload="none"`.

## SEO local
- Título, descripción y Open Graph (imagen propia `og.jpg`) con "spa de uñas Medellín / Aranjuez".
- Datos estructurados (JSON-LD): `NailSalon` con dirección, horario, zona, redes, catálogo de servicios y
  acción de reserva; `WebSite` y `FAQPage` con las mismas preguntas que se ven en la sección de preguntas.
- `sitemap.xml` con imágenes, `robots.txt` (excluye `/panel` y `/api/`), `404.html`, manifest e íconos propios.
- Pendiente con datos reales: coordenadas exactas del pin de Google Maps y calificación real (no se marca
  `aggregateRating` hasta tenerla), y ID de Google Analytics 4.

## Agenda
Hoy los botones "Agendar" apuntan a Kumbio. Cuando la plataforma propia esté en producción:
```bash
python3 scripts/cambiar-agenda.py /reservar
```

## Publicar en Cloudflare Pages
1. Cloudflare → Workers & Pages → Create → Pages → conectar este repositorio.
2. Framework preset: **None**. Build command: *(vacío)*. Output directory: **public** (también lo fija `wrangler.toml`).
3. Probar en `amelianailspa.pages.dev`; cuando todo esté bien, agregar `amelianailspa.com` en *Custom domains*
   y apagar el sitio de Netlify.
