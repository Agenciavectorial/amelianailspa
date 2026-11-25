// Cuentas del spa: comisiones por chica y por servicio, ingresos repartidos por servicio y resúmenes.
// Funciones puras (sin base de datos) para poder probarlas solas; las rutas están en rutas/cuentas.js.

/** % que le toca a una chica por un servicio: el del servicio si Erika lo definió, si no el general. */
export function pctDe(tabla, colaboradoraId, servicioId) {
  const c = tabla.get(colaboradoraId);
  if (!c) return 0;
  if (servicioId != null && c.servicios.has(servicioId)) return c.servicios.get(servicioId);
  return c.general;
}

/**
 * Reparte un cobro entre los servicios de la cita. Con precios, en proporción a cada precio; sin precios, en partes iguales.
 * Devuelve [{servicio_id, nombre, monto}] con montos enteros que suman exactamente `monto`.
 */
export function repartir(monto, lineas) {
  if (!lineas.length) return [{ servicio_id: null, nombre: 'Venta', monto }];
  const conPrecio = lineas.every((l) => l.precio > 0);
  const base = conPrecio ? lineas.reduce((a, l) => a + l.precio, 0) : lineas.length;
  let asignado = 0;
  return lineas.map((l, i) => {
    const parte = i === lineas.length - 1 ? monto - asignado : Math.round((monto * (conPrecio ? l.precio : 1)) / base);
    asignado += parte;
    return { servicio_id: l.servicio_id ?? null, nombre: l.nombre, monto: parte };
  });
}

/** Comisión en pesos (redondeada a pesos enteros) de un cobro. */
export function calcularComision(tabla, colaboradoraId, monto, lineas) {
  return Math.round(repartir(monto, lineas).reduce((a, p) => a + (p.monto * pctDe(tabla, colaboradoraId, p.servicio_id)) / 100, 0));
}

/** Arma la tabla de porcentajes a partir de las filas de la base. */
export function tablaComisiones(colaboradoras, porServicio) {
  const t = new Map();
  for (const c of colaboradoras) t.set(c.id, { general: Number(c.comision_pct) || 0, servicios: new Map() });
  for (const x of porServicio) t.get(x.colaboradora_id)?.servicios.set(x.servicio_id, Number(x.pct));
  return t;
}

/** Lunes (AAAA-MM-DD) de la semana de una fecha. */
export function lunesDe(fecha) {
  const d = new Date(fecha + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

/**
 * Resumen a partir de los ingresos ya repartidos por servicio y de los gastos.
 * @param {{fecha, colaboradora_id, servicio_id, nombre, monto, comision, costo, propina, metodo, ticket}[]} partes
 */
export function resumir(partes, gastos = [], { agrupar = 'dia' } = {}) {
  const sum = (l, k) => l.reduce((a, x) => a + (x[k] || 0), 0);
  const clave = (f) => (agrupar === 'mes' ? f.slice(0, 7) : agrupar === 'semana' ? lunesDe(f) : f);
  const serie = new Map();
  for (const p of partes) {
    const k = clave(p.fecha);
    const s = serie.get(k) || { periodo: k, ingresos: 0, gastos: 0 };
    s.ingresos += p.monto;
    serie.set(k, s);
  }
  for (const g of gastos) {
    const k = clave(g.fecha);
    const s = serie.get(k) || { periodo: k, ingresos: 0, gastos: 0 };
    s.gastos += g.monto;
    serie.set(k, s);
  }
  const porServicio = new Map();
  for (const p of partes) {
    const k = p.servicio_id ?? 'x:' + p.nombre;
    const s = porServicio.get(k) || { servicio_id: p.servicio_id ?? null, nombre: p.nombre, cantidad: 0, ingresos: 0, costo: 0, comision: 0 };
    s.cantidad++; s.ingresos += p.monto; s.costo += p.costo || 0; s.comision += p.comision || 0;
    porServicio.set(k, s);
  }
  const servicios = [...porServicio.values()].map((s) => ({ ...s, utilidad: s.ingresos - s.costo - s.comision }))
    .sort((a, b) => b.ingresos - a.ingresos);
  const porChica = new Map();
  for (const p of partes) {
    const s = porChica.get(p.colaboradora_id) || { colaboradora_id: p.colaboradora_id, ingresos: 0, comision: 0, propinas: 0, servicios: 0 };
    s.ingresos += p.monto; s.comision += p.comision || 0; s.propinas += p.propina || 0; s.servicios++;
    porChica.set(p.colaboradora_id, s);
  }
  const porMetodo = {};
  for (const p of partes) porMetodo[p.metodo] = (porMetodo[p.metodo] || 0) + p.monto;
  const tickets = new Set(partes.map((p) => p.ticket));
  const ingresos = sum(partes, 'monto');
  const comisiones = sum(partes, 'comision');
  const costos = sum(partes, 'costo');
  const totalGastos = sum(gastos, 'monto');
  const masRentable = servicios.filter((s) => s.servicio_id != null).sort((a, b) => b.utilidad - a.utilidad)[0] || null;
  return {
    ingresos, propinas: sum(partes, 'propina'), comisiones, costos, gastos: totalGastos,
    utilidad: ingresos - comisiones - costos - totalGastos,
    tickets: tickets.size, ticket_promedio: tickets.size ? Math.round(ingresos / tickets.size) : 0,
    serie: [...serie.values()].sort((a, b) => a.periodo.localeCompare(b.periodo)),
    servicios, chicas: [...porChica.values()].sort((a, b) => b.ingresos - a.ingresos),
    metodos: Object.entries(porMetodo).map(([metodo, total]) => ({ metodo, total })).sort((a, b) => b.total - a.total),
    mas_rentable: masRentable,
  };
}

/** Gastos hormiga: muchos gastos pequeños que juntos pesan. */
export function gastosHormiga(gastos, { umbral = 20000, alerta = 150000 } = {}) {
  const chicos = gastos.filter((g) => g.monto <= umbral);
  const total = chicos.reduce((a, g) => a + g.monto, 0);
  const porConcepto = new Map();
  for (const g of chicos) {
    const k = (g.concepto || '').trim().toLowerCase();
    const x = porConcepto.get(k) || { concepto: g.concepto, veces: 0, total: 0 };
    x.veces++; x.total += g.monto;
    porConcepto.set(k, x);
  }
  return {
    umbral, total, cantidad: chicos.length, alerta: total >= alerta,
    top: [...porConcepto.values()].sort((a, b) => b.total - a.total).slice(0, 5),
  };
}
