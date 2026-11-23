// Lector de CSV sin dependencias: comillas, saltos de línea dentro de comillas, separador , ; o tabulador.

export function detectarSeparador(texto) {
  const linea = texto.split(/\r?\n/).find((l) => l.trim()) || '';
  const cuenta = (c) => linea.split(c).length - 1;
  return [';', ',', '\t'].sort((a, b) => cuenta(b) - cuenta(a))[0];
}

/** Devuelve una matriz de filas (arreglos de texto). */
export function leerCSV(texto, sep = detectarSeparador(texto)) {
  texto = texto.replace(/^﻿/, '');
  const filas = [];
  let fila = [], campo = '', comillas = false;
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];
    if (comillas) {
      if (ch === '"') {
        if (texto[i + 1] === '"') { campo += '"'; i++; } else comillas = false;
      } else campo += ch;
    } else if (ch === '"' && campo === '') comillas = true;
    else if (ch === sep) { fila.push(campo); campo = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && texto[i + 1] === '\n') i++;
      fila.push(campo); campo = '';
      if (fila.some((c) => c.trim() !== '')) filas.push(fila);
      fila = [];
    } else campo += ch;
  }
  fila.push(campo);
  if (fila.some((c) => c.trim() !== '')) filas.push(fila);
  return filas.map((f) => f.map((c) => c.trim()));
}

export const normalizar = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Sinónimos de encabezados (Kumbio y hojas hechas a mano) → nombre interno. */
export const ALIAS = {
  nombre: ['nombre', 'nombre completo', 'cliente', 'clienta', 'nombre cliente', 'nombre clienta', 'clienta nombre', 'cliente nombre', 'servicio nombre', 'name', 'customer', 'nombres'],
  celular: ['celular', 'telefono', 'tel', 'movil', 'whatsapp', 'phone', 'numero', 'telefono cliente', 'celular cliente', 'clienta celular', 'cliente celular', 'mobile'],
  email: ['email', 'correo', 'correo electronico', 'e mail', 'mail'],
  notas: ['notas', 'nota', 'observaciones', 'comentarios', 'comentario', 'notes'],
  categoria: ['categoria', 'category', 'tipo', 'grupo'],
  precio: ['precio', 'valor', 'costo', 'price', 'tarifa', 'total'],
  duracion: ['duracion', 'duracion min', 'duracion minutos', 'minutos', 'tiempo', 'duration'],
  descripcion: ['descripcion', 'detalle', 'description'],
  foto: ['foto', 'imagen', 'image', 'url foto', 'url imagen', 'foto url', 'imagen url'],
  visible: ['visible', 'activo', 'publicado', 'activa'],
  fecha: ['fecha', 'dia', 'date', 'fecha cita', 'fecha de la cita'],
  hora: ['hora', 'hora inicio', 'inicio', 'time', 'hora de inicio', 'start'],
  servicio: ['servicio', 'service', 'tratamiento', 'servicios'],
  colaboradora: ['colaboradora', 'colaborador', 'profesional', 'empleado', 'empleada', 'manicurista', 'estilista', 'staff', 'atendido por'],
  estado: ['estado', 'status', 'estado cita'],
  colaboradoras: ['colaboradoras', 'profesionales', 'quien lo hace', 'empleados'],
  servicios: ['servicios', 'servicios que hace'],
  rol: ['rol', 'cargo', 'tipo usuario'],
  horario: ['horario', 'horarios', 'disponibilidad'],
  ultima_visita: ['ultima visita', 'ultima cita', 'last visit'],
  cumpleanos: ['cumpleanos', 'fecha nacimiento', 'nacimiento', 'birthday'],
};

/** Mapea encabezados a campos internos. Devuelve { indice -> campo }. */
export function mapearEncabezados(encabezados, campos) {
  const mapa = {};
  const usados = new Set();
  encabezados.forEach((h, i) => {
    const n = normalizar(h);
    for (const campo of campos) {
      if (usados.has(campo)) continue;
      if ((ALIAS[campo] || [campo]).includes(n)) { mapa[i] = campo; usados.add(campo); break; }
    }
  });
  return mapa;
}

/** Convierte matriz → objetos con los campos internos. */
export function aObjetos(filas, campos) {
  const [enc, ...resto] = filas;
  const mapa = mapearEncabezados(enc || [], campos);
  return {
    mapa,
    encabezados: enc || [],
    filas: resto.map((f) => {
      const o = {};
      for (const [i, campo] of Object.entries(mapa)) o[campo] = f[i] ?? '';
      return o;
    }),
  };
}

export function aCSV(filas, sep = ',') {
  return filas.map((f) => f.map((c) => {
    const s = String(c ?? '');
    return /[",;\n\r]/.test(s) || s.includes(sep) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(sep)).join('\r\n');
}
