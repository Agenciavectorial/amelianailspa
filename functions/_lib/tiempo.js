// Utilidades de fecha/hora. Todo en hora de Colombia (UTC-5, sin horario de verano).
export const OFFSET_MIN = -5 * 60;

const pad = (n) => String(n).padStart(2, '0');

/** Fecha y minuto actuales en Bogotá. `ms` permite inyectar la hora en pruebas. */
export function ahoraBogota(ms = Date.now()) {
  const d = new Date(ms + OFFSET_MIN * 60000);
  return {
    fecha: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
    minuto: d.getUTCHours() * 60 + d.getUTCMinutes(),
  };
}

export function esFecha(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** 0 = domingo … 6 = sábado */
export function diaSemana(fecha) {
  return new Date(fecha + 'T00:00:00Z').getUTCDay();
}

export function sumarDias(fecha, n) {
  const d = new Date(fecha + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Días entre dos fechas (b - a). */
export function difDias(a, b) {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
}

/** Instante UTC (Date) de una fecha local + minutos. */
export function aUTC(fecha, minuto) {
  return new Date(Date.parse(fecha + 'T00:00:00Z') + (minuto - OFFSET_MIN) * 60000);
}

export function horaTexto(min) {
  const h = Math.floor(min / 60), m = min % 60;
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${pad(m)} ${h < 12 ? 'a. m.' : 'p. m.'}`;
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export function fechaTexto(fecha) {
  const d = new Date(fecha + 'T00:00:00Z');
  return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`;
}

/** "HH:MM" → minutos */
export function aMinutos(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim());
  if (!m) return null;
  const h = +m[1], mi = +m[2];
  if (h > 24 || mi > 59 || (h === 24 && mi > 0)) return null;
  return h * 60 + mi;
}
