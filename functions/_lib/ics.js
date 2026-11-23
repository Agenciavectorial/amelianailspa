// Generación de calendarios iCalendar (RFC 5545) para citas y feeds suscribibles.
import { aUTC } from './tiempo.js';

const pad = (n) => String(n).padStart(2, '0');

export function fechaICS(d) {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

export function escaparICS(s) {
  return String(s ?? '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/([,;])/g, '\\$1');
}

/** Corta líneas a 75 octetos como pide el estándar. */
export function plegar(linea) {
  const bytes = new TextEncoder().encode(linea);
  if (bytes.length <= 75) return linea;
  const partes = [];
  let actual = '', largo = 0;
  for (const ch of linea) {
    const l = new TextEncoder().encode(ch).length;
    if (largo + l > (partes.length ? 74 : 75)) { partes.push(actual); actual = ''; largo = 0; }
    actual += ch; largo += l;
  }
  partes.push(actual);
  return partes.join('\r\n ');
}

/**
 * @param {{uid:string,fecha:string,inicio:number,fin:number,titulo:string,descripcion?:string,ubicacion?:string,cancelada?:boolean,actualizado?:string}[]} eventos
 */
export function generarICS(eventos, { nombre = 'Amelia Nail Spa', metodo } = {}) {
  const ahora = fechaICS(new Date());
  const l = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Agencia Vectorial//Amelia Nail Spa Citas//ES', 'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${escaparICS(nombre)}`, 'X-WR-TIMEZONE:America/Bogota', 'REFRESH-INTERVAL;VALUE=DURATION:PT15M',
    'X-PUBLISHED-TTL:PT15M',
  ];
  if (metodo) l.push(`METHOD:${metodo}`);
  for (const e of eventos) {
    l.push(
      'BEGIN:VEVENT',
      `UID:${e.uid}`,
      `DTSTAMP:${ahora}`,
      `DTSTART:${fechaICS(aUTC(e.fecha, e.inicio))}`,
      `DTEND:${fechaICS(aUTC(e.fecha, e.fin))}`,
      `SUMMARY:${escaparICS(e.titulo)}`,
    );
    if (e.descripcion) l.push(`DESCRIPTION:${escaparICS(e.descripcion)}`);
    if (e.ubicacion) l.push(`LOCATION:${escaparICS(e.ubicacion)}`);
    if (e.secuencia != null) l.push(`SEQUENCE:${e.secuencia}`);
    l.push(`STATUS:${e.cancelada ? 'CANCELLED' : 'CONFIRMED'}`);
    if (e.alarma) l.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escaparICS(e.titulo)}`, `TRIGGER:-PT${e.alarma}M`, 'END:VALARM');
    l.push('END:VEVENT');
  }
  l.push('END:VCALENDAR');
  return l.map(plegar).join('\r\n') + '\r\n';
}

export function respuestaICS(texto, nombreArchivo) {
  return new Response(texto, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `${nombreArchivo ? 'attachment' : 'inline'}; filename="${nombreArchivo || 'agenda.ics'}"`,
      'Cache-Control': 'private, max-age=300',
      'X-Robots-Tag': 'noindex',
    },
  });
}
