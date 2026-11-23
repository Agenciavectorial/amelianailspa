#!/usr/bin/env python3
"""Cambia el enlace de "Agendar" de toda la página (botones, menú, dock, tarjetas y datos para Google).

Hoy apunta a Kumbio. Cuando la plataforma propia esté en producción:
    python3 scripts/cambiar-agenda.py /reservar/
Para volver a Kumbio:
    python3 scripts/cambiar-agenda.py https://agenda.kumbio.com/amelia-nail-spa

Con /reservar:
- cada tarjeta de servicio abre /reservar?servicio=<slug> (atributo data-servicio de la tarjeta);
- el botón "Agenda con ella" del equipo abre /reservar?con=<slug> (lo arma app.js con data-con);
- los enlaces se abren en la misma pestaña;
- /reservar se agrega al sitemap.
"""
import re, sys, pathlib

if len(sys.argv) != 2:
    sys.exit(__doc__)
nuevo = sys.argv[1]
if nuevo.rstrip('/') == '/reservar':
    nuevo = '/reservar/'   # con barra final: Cloudflare redirige /reservar a /reservar/
interno = nuevo.startswith('/')
raiz = pathlib.Path(__file__).resolve().parent.parent / 'public'
pagina = raiz / 'index.html'
html = pagina.read_text(encoding='utf-8')

ACTUAL = r'(?:https://agenda\.kumbio\.com/amelia-nail-spa|https://amelianailspa\.com/reservar/?|/reservar/?)(?:\?[^"]*)?'
cambios = 0

def etiqueta(m):
    """Cambia el href de una etiqueta <a> que apunta a la agenda."""
    global cambios
    tag = m.group(0)
    destino = nuevo
    serv = re.search(r'data-servicio="([^"]+)"', tag)
    con = re.search(r'data-con="([^"]+)"', tag)
    if interno and serv:
        destino = f'{nuevo}?servicio={serv.group(1)}'
    elif interno and con:
        destino = f'{nuevo}?con={con.group(1)}'
    tag = re.sub(r'href="%s"' % ACTUAL, f'href="{destino}"', tag)
    tag = re.sub(r'\s+target="_blank"', '', tag)
    tag = re.sub(r'\s+rel="noopener"', '', tag)
    if not interno:
        tag = tag.replace(f'href="{destino}"', f'href="{destino}" target="_blank" rel="noopener"', 1)
    cambios += 1
    return tag

html = re.sub(r'<a\b[^>]*href="%s"[^>]*>' % ACTUAL, etiqueta, html)
# Datos para Google: la dirección debe ser completa.
completa = f'https://amelianailspa.com{nuevo}' if interno else nuevo
html = re.sub(r'"urlTemplate": "[^"]*"', f'"urlTemplate": "{completa}"', html)
pagina.write_text(html, encoding='utf-8')

# Sitemap: /reservar se indexa solo cuando la plataforma está activa.
sitemap = raiz / 'sitemap.xml'
sm = sitemap.read_text(encoding='utf-8')
bloque = '  <url>\n    <loc>https://amelianailspa.com/reservar/</loc>\n  </url>\n'
if interno and '/reservar/</loc>' not in sm:
    sm = sm.replace('</urlset>', bloque + '</urlset>')
elif not interno:
    sm = sm.replace(bloque, '')
sitemap.write_text(sm, encoding='utf-8')

print(f'{cambios} enlaces ahora apuntan a {nuevo}')
