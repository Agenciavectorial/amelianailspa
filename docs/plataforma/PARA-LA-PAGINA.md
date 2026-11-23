# Página principal: cómo conectar la plataforma de citas

La plataforma **no toca** `public/index.html`, `styles.css`, `app.js`, `img/`, `fonts/`,
`robots.txt`, `sitemap.xml` ni `public/_headers`. Esto es lo que le toca integrar a la página.

## 1. Botones "Agendar"

Reemplazar todos los enlaces a `https://agenda.kumbio.com/amelia-nail-spa` por enlaces internos
(sin `target="_blank"`):

| Botón | Enlace |
|---|---|
| "Agendar ahora" general | `/reservar` |
| Tarjeta de un servicio | `/reservar?servicio=<slug>` |
| Tarjeta de una manicurista | `/reservar?con=<slug>` |

Con `?servicio=` la reserva salta directo a elegir profesional; con ambos parámetros, directo al
horario. Se pueden combinar: `/reservar?servicio=dipping&con=karla`.

**Slugs de servicios** (vienen de `migrations/0002_datos_iniciales.sql`; si Erika crea uno nuevo, su
slug es el nombre en minúsculas sin tildes y con guiones):

| Servicio | slug |
|---|---|
| Acrílicas | `acrilicas` |
| Poligel | `poligel` |
| Press On | `press-on` |
| Forrado | `forrado` |
| Dipping | `dipping` |
| Semipermanente | `semipermanente` |
| Tradicional Manos/Pies | `tradicional` |
| Pedi Spa | `pedi-spa` |
| Lifting de Pestañas | `lifting-pestanas` |
| Pestañas Punto a Punto | `pestanas-punto-a-punto` |
| Laminado de Cejas | `laminado-cejas` |
| Sombreado de Cejas | `sombreado-cejas` |
| Depilación Cejas/Bozo | `depilacion-cejas-bozo` |
| Limpieza Facial Profunda | `limpieza-facial` |
| Dermapen | `dermapen` |
| Hidragloss | `hidragloss` |

**Slugs de manicuristas:** `leidy`, `karla`, `julieth`, `daily` (Erika y Valentina no reciben citas).

Un slug que no exista simplemente se ignora (la clienta empieza desde el paso 1).

## 2. `robots.txt`

Agregar:

```
Disallow: /panel/
Disallow: /api/
Disallow: /reservar/cita/
```

(`/panel` y `/api` además envían `X-Robots-Tag: noindex`; `/reservar/cita/` tiene `meta robots noindex`.)

## 3. `sitemap.xml`

Agregar `https://amelianailspa.com/reservar` (sí debe indexarse).

## 4. `_headers`

**No hace falta nada.** Las cabeceras de seguridad de `/reservar/*`, `/panel/*` y `/app-citas/*`
las agregan los middlewares `functions/<ruta>/_middleware.js` (CSP sin scripts en línea,
`X-Frame-Options: DENY`, `noindex` en el panel). Si algún día se prefiere moverlas a `_headers`,
el equivalente es:

```
/reservar/*
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'; manifest-src 'self'; worker-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'
  X-Frame-Options: DENY
/panel/*
  Content-Security-Policy: (la misma)
  X-Frame-Options: DENY
  X-Robots-Tag: noindex, nofollow
```

El middleware **reemplaza** (no suma) esas cabeceras en sus rutas, así que una regla `/*` del
`_headers` de la raíz no las debilita. Igual conviene no poner en `/*` una CSP que choque con estas.

## 5. Recursos compartidos

`public/app-citas/` tiene las fuentes (Playfair Display, DM Sans, Great Vibes en WOFF2), el logo en
WebP y los íconos. La página puede reutilizarlos si quiere (`/app-citas/fonts/*.woff2`).
