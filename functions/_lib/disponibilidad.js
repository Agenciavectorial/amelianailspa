// Cálculo de turnos disponibles. Función pura (sin base de datos) para poder probarla a fondo.
import { difDias } from './tiempo.js';

/**
 * @param {object} p
 * @param {string} p.fecha                 'AAAA-MM-DD'
 * @param {number} p.duracion              minutos totales de los servicios
 * @param {number[]} p.candidatas          ids de colaboradoras que pueden atender
 * @param {{abierto:number,abre:number,cierra:number}|undefined} p.horarioSpa  del día de la semana
 * @param {boolean} p.festivo
 * @param {Record<number,{trabaja:number,abre:number,cierra:number}>} p.horariosColab  del día (sin entrada = horario del spa)
 * @param {{colaboradora_id:number|null,inicio:number,fin:number}[]} p.bloqueos
 * @param {{colaboradora_id:number,inicio:number,fin:number}[]} p.ocupadas  citas activas del día
 * @param {{intervalo_min:number,anticipacion_min:number,ventana_dias:number}} p.ajustes
 * @param {{fecha:string,minuto:number}} p.ahora
 * @param {boolean} [p.personal]           true desde el panel: sin anticipación mínima ni ventana
 * @param {number} [p.ignorarCita]         id de cita a ignorar (al reprogramar)
 * @returns {{inicio:number,fin:number,colaboradoras:number[]}[]}
 */
export function turnosDelDia(p) {
  const { fecha, duracion, candidatas, horarioSpa, festivo, horariosColab = {}, bloqueos = [], ocupadas = [], ajustes, ahora } = p;
  if (!duracion || duracion <= 0 || !candidatas?.length) return [];
  const dias = difDias(ahora.fecha, fecha);
  if (dias < 0) return [];
  if (!p.personal && dias > ajustes.ventana_dias) return [];
  if (festivo || !horarioSpa || !horarioSpa.abierto) return [];

  const paso = Math.max(5, ajustes.intervalo_min || 15);
  const minimo = p.personal
    ? (dias === 0 ? ahora.minuto : -Infinity)
    : ahora.minuto + (ajustes.anticipacion_min || 0) - dias * 1440;

  const rangos = new Map();
  for (const id of candidatas) {
    const h = horariosColab[id];
    if (h && !h.trabaja) continue;
    const abre = Math.max(horarioSpa.abre, h ? h.abre : horarioSpa.abre);
    const cierra = Math.min(horarioSpa.cierra, h ? h.cierra : horarioSpa.cierra);
    if (cierra - abre < duracion) continue;
    const ocupado = [
      ...bloqueos.filter((b) => b.colaboradora_id == null || b.colaboradora_id === id),
      ...ocupadas.filter((c) => c.colaboradora_id === id && c.id !== p.ignorarCita),
    ];
    rangos.set(id, { abre, cierra, ocupado });
  }

  const turnos = [];
  for (let t = horarioSpa.abre; t + duracion <= horarioSpa.cierra; t += paso) {
    if (t < minimo) continue;
    const fin = t + duracion;
    const libres = [];
    for (const [id, r] of rangos) {
      if (t < r.abre || fin > r.cierra) continue;
      if (r.ocupado.some((o) => o.inicio < fin && o.fin > t)) continue;
      libres.push(id);
    }
    if (libres.length) turnos.push({ inicio: t, fin, colaboradoras: libres });
  }
  return turnos;
}

/** ¿Se cruza [inicio, fin) con alguno de los intervalos? */
export function seCruza(inicio, fin, intervalos) {
  return intervalos.some((o) => o.inicio < fin && o.fin > inicio);
}
