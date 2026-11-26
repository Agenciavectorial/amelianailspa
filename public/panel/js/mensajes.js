// Mensajes a clientas con las plantillas que edita Erika. Hoy se envían por WhatsApp prellenado
// (un toque, sin cupos). Punto de integración para envío automático: ver docs/plataforma/PENDIENTES.md.
import { api, html, crudo, hora, fechaLarga, ICONOS, toast, SITIO } from '/app-citas/js/util.js?v=63bc4ab2f0';
import { S } from './estado.js?v=63bc4ab2f0';

export const VARIABLES = ['nombre', 'servicio', 'fecha', 'hora', 'colaboradora', 'codigo', 'enlace', 'resena', 'spa', 'direccion'];

export function rellenar(texto, datos) {
  return String(texto || '').replace(/\{(\w+)\}/g, (m, k) => (datos[k] != null && datos[k] !== '' ? String(datos[k]) : m === '{enlace}' ? `${SITIO}/reservar/` : ''));
}

/** Datos de una cita para las plantillas. */
export function datosCita(c) {
  return {
    nombre: (c.clienta_nombre || '').split(' ')[0],
    servicio: (c.servicios || []).map?.((s) => s.nombre).join(' + ') || c.servicios || '',
    fecha: c.fecha ? fechaLarga(c.fecha) : '',
    hora: c.inicio != null ? hora(c.inicio) : '',
    colaboradora: c.colaboradora_nombre || '',
    codigo: c.codigo || '',
    enlace: c.token ? `${SITIO}/reservar/cita/#${c.token}` : `${SITIO}/reservar/`,
    resena: S.ajustes.resena_url || '',
    spa: S.ajustes.nombre_spa || 'Amelia Nail Spa',
    direccion: S.ajustes.direccion || '',
  };
}

export function textoPlantilla(clave, datos) {
  const p = S.plantillas?.find((x) => x.clave === clave);
  return p ? rellenar(p.texto, datos) : '';
}

export function urlWhatsApp(celular, texto) {
  return `https://wa.me/${String(celular).replace(/\D/g, '')}?text=${encodeURIComponent(texto)}`;
}

/** Registra el mensaje (para contar "mensajes enviados" y no repetir avisos) y abre WhatsApp. */
export function enviar(celular, texto, registro) {
  window.open(urlWhatsApp(celular, texto), '_blank', 'noopener');
  api('/api/panel/mensajes', { metodo: 'POST', datos: registro }).catch((e) => toast(e.message, 'error'));
}

/** Botones de plantillas para una cita (según su estado). */
export function botonesCita(c) {
  const claves = c.estado === 'cancelada' ? ['cancelacion']
    : c.estado === 'asistio' ? ['gracias', 'vuelve'] : ['confirmacion', 'recordatorio', 'cambio', 'gracias'];
  const ps = (S.plantillas || []).filter((p) => claves.includes(p.clave));
  if (!ps.length) return '';
  return html`<div class="mensajes-cita"><span class="etiqueta">Enviar por WhatsApp</span>
    <div class="chips-serv">${ps.map((p) => html`<button type="button" class="chip chip-wa" data-plantilla="${p.clave}">${crudo(ICONOS.whatsapp)} ${p.titulo}</button>`)}</div></div>`;
}
