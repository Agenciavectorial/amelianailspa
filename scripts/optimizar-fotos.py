#!/usr/bin/env python3
"""Convierte fotos nuevas a WebP livianas en varios tamaños para la página.

    python3 scripts/optimizar-fotos.py fotos-nuevas/lifting-pestanas.jpg [más fotos...]

Crea public/img/<nombre>-480.webp, -720.webp y -960.webp (sin agrandar fotos pequeñas)
y muestra el <img> listo para pegar. Requiere Pillow (pip install pillow; para HEIC: pillow-heif).
"""
import sys, pathlib
from PIL import Image, ImageOps
try:
    import pillow_heif; pillow_heif.register_heif_opener()
except ImportError:
    pass

RAIZ = pathlib.Path(__file__).resolve().parent.parent
SALIDA = RAIZ / 'public' / 'img'

def optimizar(ruta):
    ruta = pathlib.Path(ruta)
    nombre = ruta.stem.lower().replace(' ', '-').replace('_', '-')
    im = ImageOps.exif_transpose(Image.open(ruta)).convert('RGB')
    W, H = im.size
    anchos = [w for w in (480, 720, 960) if w < W] or [W]
    variantes = []
    for w in anchos:
        f = SALIDA / f'{nombre}-{w}.webp'
        im.resize((w, round(H * w / W)), Image.LANCZOS).save(f, 'WEBP', quality=74, method=6)
        variantes.append((w, f'/img/{f.name}', f.stat().st_size // 1024))
    srcset = ', '.join(f'{u} {w}w' for w, u, _ in variantes)
    principal = variantes[-1]
    print(f'{ruta.name}: ' + ', '.join(f'{w}px {kb} KB' for w, _, kb in variantes))
    print(f'  <img loading="lazy" decoding="async" width="{principal[0]}" height="{round(H * principal[0] / W)}" '
          f'src="{principal[1]}" srcset="{srcset}" sizes="(max-width: 700px) 92vw, 420px" alt="">')

if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    for r in sys.argv[1:]:
        optimizar(r)
