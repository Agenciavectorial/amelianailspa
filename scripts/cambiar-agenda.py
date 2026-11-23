#!/usr/bin/env python3
"""Cambia el enlace de "Agendar" de toda la página (botones, menú, dock y datos para Google).

Hoy apunta a Kumbio. Cuando la plataforma propia esté en producción:
    python3 scripts/cambiar-agenda.py /reservar
Para volver a Kumbio:
    python3 scripts/cambiar-agenda.py https://agenda.kumbio.com/amelia-nail-spa
"""
import re, sys, pathlib

if len(sys.argv) != 2:
    sys.exit(__doc__)
nuevo = sys.argv[1].rstrip('/') or '/reservar'
pagina = pathlib.Path(__file__).resolve().parent.parent / 'public' / 'index.html'
html = pagina.read_text(encoding='utf-8')
actual = re.compile(r'https://agenda\.kumbio\.com/amelia-nail-spa|https://amelianailspa\.com/reservar|(?<=")/reservar(?=")')
interno = nuevo.startswith('/')
cambios = 0

def enlace(m):
    global cambios
    cambios += 1
    return nuevo

html = actual.sub(enlace, html)
# Los enlaces internos se abren en la misma pestaña; los externos en una nueva.
if interno:
    html = re.sub(r'(href="%s")\s+target="_blank"(\s+rel="noopener")?' % re.escape(nuevo), r'\1', html)
# En los datos para Google la dirección debe ser completa.
html = html.replace('"urlTemplate": "%s"' % nuevo, '"urlTemplate": "https://amelianailspa.com%s"' % nuevo) if interno else html
pagina.write_text(html, encoding='utf-8')
print(f'{cambios} enlaces ahora apuntan a {nuevo}')
