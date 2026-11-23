#!/usr/bin/env python3
"""Pone una versión (huella del contenido) a styles.css, app.js y analitica.js en las páginas.

Cloudflare y los navegadores guardan esos archivos en caché; con ?v=<huella> cada cambio
se descarga al instante. Correr después de editar CSS o JS:
    python3 scripts/version-archivos.py
"""
import hashlib, pathlib, re

PUBLIC = pathlib.Path(__file__).resolve().parent.parent / 'public'
ARCHIVOS = ['styles.css', 'app.js', 'analitica.js']
PAGINAS = ['index.html', '404.html']

huellas = {a: hashlib.sha256((PUBLIC / a).read_bytes()).hexdigest()[:10] for a in ARCHIVOS if (PUBLIC / a).exists()}
for pag in PAGINAS:
    ruta = PUBLIC / pag
    html = ruta.read_text(encoding='utf-8')
    for a, h in huellas.items():
        html = re.sub(r'(["\'])/%s(?:\?v=[0-9a-f]+)?\1' % re.escape(a), r'\g<1>/%s?v=%s\g<1>' % (a, h), html)
    ruta.write_text(html, encoding='utf-8')
print(', '.join(f'{a}?v={h}' for a, h in huellas.items()))
