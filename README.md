# Amelia Nail Spa

Página web y plataforma de citas de **Amelia Nail Spa** (C.C. Bosque Plaza, Aranjuez, Medellín),
hechas por Agencia Vectorial. Todo se publica en **Cloudflare Pages** (proyecto `amelianailspa`).

| Ruta | Contenido |
|---|---|
| `public/` | La página principal (estática, sin build). |
| `public/reservar/`, `public/panel/` | Plataforma de citas: clientas, Erika (propietaria) y colaboradoras. *(en desarrollo)* |
| `functions/api/` | Funciones de Cloudflare (API de la plataforma). *(en desarrollo)* |
| `docs/` | Plan, configuración y prompts de coordinación entre agentes. |

## Publicar en Cloudflare Pages
1. Cloudflare → Workers & Pages → Create → Pages → conectar este repositorio.
2. Framework preset: **None**. Build command: *(vacío)*. Output directory: **public** (también lo fija `wrangler.toml`).
3. Probar en `amelianailspa.pages.dev`; cuando todo esté bien, agregar `amelianailspa.com` en *Custom domains*
   y apagar el sitio de Netlify.
