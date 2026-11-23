# Videos de capacitación

Los videos se publican en **amelianailspa.com/capacitacion/**. Es una página privada: tiene `noindex` y
`robots.txt` la excluye con `Disallow: /capacitacion/`. Quien tenga el enlace puede verla.

| Video | Para quién | Formato |
|---|---|---|
| `erika.mp4` | Erika (panel de propietaria) | vertical 1080×1920 |
| `chicas-leidy.mp4`, `chicas-karla.mp4`, `chicas-julieth.mp4`, `chicas-daily.mp4` | cada chica, con su saludo | vertical 1080×1920 |
| `pagina.mp4` / `pagina-horizontal.mp4` | Erika: la página y la reserva | vertical y 16:9 (1920×1080) |

Cada video lleva cortinilla de inicio y de cierre con la marca, el celular con la pantalla real, el capítulo
arriba, subtítulos quemados y voz en off. No lleva música. Solo se usan datos ficticios: el servidor local
crea clientas como "Ana Prueba" o "Gina Ejemplo".

## Cómo está hecho (`dev/video/`)

| Archivo | Qué hace |
|---|---|
| `guiones/*.mjs` | Texto de cada escena (un párrafo de voz) y la acción que se ve en pantalla. |
| `acciones.mjs` | Las acciones de pantalla (Playwright): toques, escritura, desplazamientos. También el indicador de toques y la vista previa de los mensajes de WhatsApp. |
| `voz.mjs` | Genera la voz con Gemini TTS. Pide un bloque de párrafos en una sola solicitud y lo corta por los silencios. |
| `verificar-voz.mjs` | Transcribe cada bloque y lo compara con el guion. Si el parecido baja de 0,85, hay que regenerar ese bloque. |
| `grabar.mjs` | Levanta el servidor **local** con datos ficticios y graba la pantalla del celular al ritmo de la voz. Usa el screencast de Chromium. |
| `armar.mjs` | Arma el video: fondo, marco del celular, encabezado con capítulo, subtítulos, cortinillas, voz y H.264. |
| `publicar.mjs` | Copia los videos y portadas a `public/capacitacion/videos/` y genera `public/capacitacion/index.html`. |
| `importar-audios.mjs` | Si se graba la voz a mano: convierte los audios (`e01.m4a`, …) al formato de la tubería. |
| `exportar-guiones.mjs` | Escribe `docs/capacitacion/GUIONES.md`, con todos los párrafos y el nombre de archivo de cada uno. |
| `todo.sh` | Graba, arma y publica todo. |

Los audios de voz quedan en `dev/video/audio/<video>/<escena>.wav` y se guardan en el repositorio. Así no hay
que volver a generarlos. Los intermedios van a `dev/video/salida/` y no se suben.

## Regenerar

```bash
npm install                                        # wrangler para el servidor local
# 1) Voz (solo lo que falte; los .wav existentes no se repiten)
NODE_USE_ENV_PROXY=1 node dev/video/voz.mjs erika   # también: chicas, pagina
NODE_USE_ENV_PROXY=1 node dev/video/verificar-voz.mjs erika
# 2) Grabar + armar + publicar (unos 25 minutos en total)
bash dev/video/todo.sh
```

Para un solo video:

```bash
node dev/video/grabar.mjs chicas --chica Karla
node dev/video/armar.mjs chicas --chica Karla
node dev/video/grabar.mjs pagina && node dev/video/armar.mjs pagina --horizontal
node dev/video/publicar.mjs
```

Para depurar acciones de pantalla sin esperar la voz, usa `node dev/video/grabar.mjs erika --rapido`. Deja
capturas `fin-<escena>.png` y `error-<escena>.png` en `dev/video/salida/erika-prueba/`.

### Notas

- **Nunca se graba en producción.** `grabar.mjs` levanta su propio servidor local con una base nueva en
  `dev/.estado-video-<puerto>/`, en el puerto 8789. Con `PUERTO_VIDEO=8800` se puede grabar otro video a la vez.
- Las notificaciones push se simulan solo dentro de la grabación, porque el navegador sin pantalla no tiene
  servicio push. Las llaves VAPID del servidor local son desechables y se crean en cada corrida.
- El celular se graba a 390×844 (×2) con agente de iPhone, para que se vean los pasos de "Agregar a inicio".
- **Voz:** modelo `gemini-2.5-flash-preview-tts`, voz `Sulafat`, con una instrucción de acento paisa (ver
  `ESTILO` en `voz.mjs`). Se cambia con `TTS_MODELO`, `TTS_VOZ` y `TTS_ESTILO`. El plan gratuito permite
  **10 solicitudes al día por modelo**. Cada bloque es una solicitud y todo el material son unas 9.
  A veces la voz se inventa el texto o se corta, y por eso existe `verificar-voz.mjs`. Las muestras de voces
  están en `dev/video/muestras/`.
- **Peso:** Cloudflare Pages acepta hasta 25 MB por archivo. `armar.mjs` usa H.264 con CRF 25 (vertical) o
  24 (horizontal), y AAC a 96 kbps. `publicar.mjs` se detiene si algún video pasa el límite.
- **Voz grabada a mano:** graba los párrafos de `GUIONES.md`, un archivo por párrafo con el nombre indicado.
  Luego corre `node dev/video/importar-audios.mjs <video> <carpeta>` y después `todo.sh`.
- La versión anterior de la página, para el "antes", sale del commit `e68a802` y se sirve localmente.
- Las cifras de velocidad (12 MB antes, 1,9 MB ahora) se midieron cargando y recorriendo las dos versiones en
  un celular emulado.
