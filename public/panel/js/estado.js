// Estado compartido del panel. La fuente de verdad es la API (D1); esto es solo lo cargado en pantalla.
import { api } from '/app-citas/js/util.js?v=ebff92790b';

export const S = {
  yo: null, hoy: null, ajustes: {}, servicios: [], colaboradoras: [], horario_spa: [], festivos: [],
};

export async function recargar() {
  const d = await api('/api/panel/arranque');
  Object.assign(S, d);
  return S;
}

export const esDuena = () => !!S.yo?.esPropietaria;
/** Módulos que Erika muestra u oculta en Reglas y módulos (por defecto, todos visibles). */
export function moduloActivo(k) {
  try { return (JSON.parse(S.ajustes?.modulos || '{}')[k]) !== false; } catch { return true; }
}
export const puede = (p) => esDuena() || S.yo?.permisos?.[p] === true;
export const colab = (id) => S.colaboradoras.find((c) => c.id === Number(id));
export const servicio = (id) => S.servicios.find((s) => s.id === Number(id));
/** Colaboradoras con agenda que se muestran en la agenda. */
export const conAgenda = () => S.colaboradoras.filter((c) => c.activa && c.agenda);
export function horarioSpa(dia) { return S.horario_spa.find((h) => h.dia === dia); }
export function categorias() { return [...new Set(S.servicios.map((s) => s.categoria))]; }

/** Rango [abre, cierra] de una colaboradora un día (null si no trabaja). Con `fecha`, el horario del mes manda. */
export function rangoColab(c, dia, fecha) {
  const spa = horarioSpa(dia);
  if (!spa || !spa.abierto) return null;
  const h = (fecha && c.horario_fechas?.find((x) => x.fecha === fecha)) || c.horario?.find((x) => x.dia === dia);
  if (h && !h.trabaja) return null;
  return { abre: Math.max(spa.abre, h ? h.abre : spa.abre), cierra: Math.min(spa.cierra, h ? h.cierra : spa.cierra) };
}

/** Aplica colores y posiciones dinámicas (la CSP no permite atributos style en el HTML). */
export function aplicarEstilos(raiz) {
  for (const el of raiz.querySelectorAll('[data-c]')) el.style.setProperty('--c', el.dataset.c);
  for (const el of raiz.querySelectorAll('[data-top]')) {
    el.style.top = el.dataset.top + 'px';
    if (el.dataset.alto) el.style.height = el.dataset.alto + 'px';
  }
  for (const el of raiz.querySelectorAll('[data-ancho]')) el.style.width = el.dataset.ancho;
}
