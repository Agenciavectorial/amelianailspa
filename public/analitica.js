/* Google Analytics 4 — Amelia Nail Spa */
window.dataLayer = window.dataLayer || [];
function gtag() { window.dataLayer.push(arguments); }
gtag('js', new Date());
gtag('config', 'G-PPSD6EHCEW');

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
