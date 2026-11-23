/* Google Analytics 4 — Amelia Nail Spa */
window.dataLayer = window.dataLayer || [];
function gtag() { window.dataLayer.push(arguments); }
gtag('js', new Date());
gtag('config', 'G-PPSD6EHCEW');

/* La librería de Google se carga cuando la página ya está lista (no compite con lo importante) */
function cargarGtag() {
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=G-PPSD6EHCEW';
  document.head.appendChild(s);
}
if (document.readyState === 'complete') setTimeout(cargarGtag, 1500);
else window.addEventListener('load', function () { setTimeout(cargarGtag, 1500); });

/* Clics que importan para el negocio: agendar, WhatsApp, cómo llegar y reseñas */
document.addEventListener('click', function (e) {
  var a = e.target.closest && e.target.closest('a[href]');
  if (!a) return;
  var href = a.getAttribute('href');
  var evento = null;
  if (/^\/reservar|agenda\.kumbio\.com/.test(href)) evento = 'agendar';
  else if (/wa\.me\//.test(href)) evento = 'whatsapp';
  else if (/google\.com\/maps/.test(href)) evento = 'como_llegar';
  else if (/writereview/.test(href)) evento = 'dejar_resena';
  if (!evento) return;
  gtag('event', evento, {
    ubicacion: (a.closest('[id]') || {}).id || '',
    servicio: a.getAttribute('data-servicio') || ''
  });
}, true);
