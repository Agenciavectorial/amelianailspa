// Importador CSV (las filas llegan ya convertidas en objetos desde el navegador).
// Pensado para los datos que se exporten de Kumbio: servicios, clientas y citas.
// Llamarlo por lotes pequeños (el panel envía 10 citas o 100 servicios/clientas por llamada).
import { falla } from '../http.js';
import * as v from '../validar.js';
import { insertarCita } from '../reservas.js';
import { ahoraBogota, aMinutos, esFecha } from '../tiempo.js';

const sinAcentos = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export function precioDe(s) {
  if (s == null || String(s).trim() === '') return null;
  const t = String(s).replace(/[^\d.,]/g, '');
  // "45.000" / "45,000" / "45000" / "45.000,00"
  const limpio = t.replace(/[.,]\d{2}$/, (m) => (t.length > 4 ? '' : m)).replace(/[.,]/g, '');
  const n = Number(limpio);
  return Number.isFinite(n) && limpio !== '' ? Math.round(n) : null;
}

export function duracionDe(s) {
  const t = sinAcentos(s);
  if (!t) return null;
  let min = null;
  let m;
  if ((m = /^(\d{1,2}):(\d{2})$/.exec(t))) min = +m[1] * 60 + +m[2];
  else if ((m = /^(\d+(?:[.,]\d+)?)\s*(h|hr|hrs|hora|horas)\s*(?:y\s*)?(\d+)?\s*(m|min|mins|minutos)?$/.exec(t))) min = Math.round(parseFloat(m[1].replace(',', '.')) * 60) + (m[3] ? +m[3] : 0);
  else if ((m = /^(\d+)\s*(m|min|mins|minutos)?$/.exec(t))) min = +m[1];
  if (!min || min <= 0 || min > 720) return null;
  return Math.ceil(min / 5) * 5;
}

export function fechaDe(s) {
  const t = String(s ?? '').trim();
  if (esFecha(t.slice(0, 10))) return t.slice(0, 10);
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/.exec(t); // DD/MM/AAAA (formato colombiano)
  if (m) {
    const f = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    if (esFecha(f)) return f;
  }
  return null;
}

export function horaDe(s) {
  const t = sinAcentos(s).replace(/\./g, '').replace(/\s+/g, ' ');
  const m = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm|a m|p m)?$/.exec(t);
  if (!m) {
    const iso = /T(\d{2}):(\d{2})/.exec(String(s)); // 2026-11-23T14:30
    return iso ? aMinutos(`${iso[1]}:${iso[2]}`) : null;
  }
  let h = +m[1];
  const mi = m[2] ? +m[2] : 0;
  const suf = m[3]?.replace(' ', '');
  if (suf === 'pm' && h < 12) h += 12;
  if (suf === 'am' && h === 12) h = 0;
  if (h > 23 || mi > 59) return null;
  return Math.round((h * 60 + mi) / 5) * 5;
}

const DIAS_CORTOS = { dom: 0, lun: 1, mar: 2, mie: 3, jue: 4, vie: 5, sab: 6 };
const diaDe = (t) => DIAS_CORTOS[sinAcentos(t).slice(0, 3)];

/**
 * "lun-sab 09:00-19:00; dom cerrado" → [{dia, trabaja, abre, cierra}] (solo los días mencionados).
 * También acepta "lun,mie,vie 10:00-18:00" y "lunes a viernes 9:00-17:00".
 */
export function horarioDe(texto) {
  const dias = new Map();
  for (const parte of String(texto || '').split(/[;\n]+/)) {
    const t = sinAcentos(parte).replace(/\s+a\s+/g, '-').trim();
    if (!t) continue;
    const m = /^([a-z,\- ]+?)\s+(cerrado|no trabaja|libre|descanso|(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2}))$/.exec(t);
    if (!m) throw new Error(`horario no reconocido: "${parte.trim()}"`);
    const lista = [];
    for (const trozo of m[1].split(/\s*,\s*/).filter(Boolean)) {
      const [a, b] = trozo.split(/\s*-\s*/).map(diaDe);
      if (a == null || (trozo.includes('-') && b == null)) throw new Error(`días no reconocidos: "${trozo}"`);
      if (b == null) lista.push(a);
      else for (let d = a; ; d = (d + 1) % 7) { lista.push(d); if (d === b) break; }
    }
    const abre = m[3] ? aMinutos(m[3]) : 0, cierra = m[4] ? aMinutos(m[4]) : 0;
    if (m[3] && (abre == null || cierra == null || cierra <= abre)) throw new Error(`horas inválidas en "${parte.trim()}"`);
    for (const d of lista) dias.set(d, { dia: d, trabaja: m[3] ? 1 : 0, abre, cierra });
  }
  return [...dias.values()];
}

/** Cumpleaños → 'MM-DD' (acepta AAAA-MM-DD, DD/MM/AAAA, DD/MM). */
export function cumpleDe(s) {
  const t = String(s ?? '').trim();
  if (!t) return '';
  const f = fechaDe(t);
  if (f) return f.slice(5);
  const m = /^(\d{1,2})[/.-](\d{1,2})$/.exec(t);
  if (m && +m[2] >= 1 && +m[2] <= 12 && +m[1] >= 1 && +m[1] <= 31) return `${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return '';
}

const ESTADOS = {
  confirmada: 'confirmada', agendada: 'confirmada', pendiente: 'confirmada', programada: 'confirmada', reservada: 'confirmada',
  asistio: 'asistio', atendida: 'asistio', completada: 'asistio', finalizada: 'asistio', realizada: 'asistio',
  'no asistio': 'no_asistio', no_asistio: 'no_asistio', 'no show': 'no_asistio', inasistencia: 'no_asistio',
  cancelada: 'cancelada', cancelado: 'cancelada', anulada: 'cancelada',
};

export function rutasImportar(r) {
  r.post('/api/panel/importar', 'propietaria', async ({ db, body, sesion }) => {
    const { tipo } = body;
    const filas = Array.isArray(body.filas) ? body.filas : falla(400, 'Faltan las filas.');
    const simular = v.bool(body.simular);
    const limite = tipo === 'citas' || tipo === 'colaboradoras' ? 10 : 100;
    if (filas.length > limite) falla(400, `Máximo ${limite} filas por lote.`);
    const resultado = [];
    const ok = (i, msg) => resultado.push({ fila: i, ok: true, msg });
    const mal = (i, msg) => resultado.push({ fila: i, ok: false, msg });
    const desplazamiento = Number(body.desde || 0);

    if (tipo === 'servicios') {
      const sentencias = [];
      const asignar = [];
      const { results: equipo } = await db.prepare('SELECT id, nombre FROM colaboradoras').all();
      filas.forEach((f, k) => {
        const i = desplazamiento + k;
        try {
          const nombre = v.texto(f.nombre, 'nombre', { min: 2, max: 80 });
          const duracion = duracionDe(f.duracion);
          if (!duracion) throw new Error('duración inválida (ej. 60, 1:30, 1h 30m)');
          const precio = precioDe(f.precio);
          const visible = f.visible === undefined || f.visible === '' ? 1 : (v.bool(sinAcentos(f.visible)) ? 1 : 0);
          sentencias.push(db.prepare(
            `INSERT INTO servicios (slug, nombre, categoria, descripcion, foto, precio, duracion, visible, orden)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 500)
             ON CONFLICT(slug) DO UPDATE SET nombre = excluded.nombre, categoria = excluded.categoria,
               descripcion = CASE WHEN excluded.descripcion <> '' THEN excluded.descripcion ELSE servicios.descripcion END,
               foto = CASE WHEN excluded.foto <> '' THEN excluded.foto ELSE servicios.foto END,
               precio = COALESCE(excluded.precio, servicios.precio), duracion = excluded.duracion, visible = excluded.visible`
          ).bind(v.slugDe(nombre), nombre, v.texto(f.categoria, 'categoría', { max: 40, opcional: true }) || 'Otros',
            v.texto(f.descripcion, 'descripción', { max: 500, opcional: true }), v.url(f.foto), precio, duracion, visible));
          let aviso = '';
          if (f.colaboradoras) {
            const nombres = String(f.colaboradoras).split(/\s*[|,;]\s*/).filter(Boolean);
            const ids = nombres.map((n) => equipo.find((c) => sinAcentos(c.nombre) === sinAcentos(n))?.id);
            const faltan = nombres.filter((_, k2) => !ids[k2]);
            if (faltan.length) aviso = ` · no encontré a: ${faltan.join(', ')}`;
            asignar.push({ slug: v.slugDe(nombre), ids: ids.filter(Boolean) });
          }
          ok(i, `${nombre} · ${duracion} min${precio != null ? ` · $${precio.toLocaleString('es-CO')}` : ''}${aviso}`);
        } catch (e) { mal(i, e.message); }
      });
      if (!simular && sentencias.length) {
        await db.batch(sentencias);
        const extra = asignar.flatMap((a) => [
          db.prepare('DELETE FROM colaboradora_servicios WHERE servicio_id = (SELECT id FROM servicios WHERE slug = ?)').bind(a.slug),
          ...a.ids.map((cid) => db.prepare('INSERT OR IGNORE INTO colaboradora_servicios (colaboradora_id, servicio_id) SELECT ?, id FROM servicios WHERE slug = ?').bind(cid, a.slug)),
        ]);
        if (extra.length) await db.batch(extra);
      }
      return { resultado };
    }

    if (tipo === 'colaboradoras') {
      const [{ results: equipo }, { results: servs }] = await db.batch([
        db.prepare('SELECT id, slug, nombre, rol FROM colaboradoras'),
        db.prepare('SELECT id, nombre FROM servicios'),
      ]);
      for (let k = 0; k < filas.length; k++) {
        const f = filas[k], i = desplazamiento + k;
        try {
          const nombre = v.texto(f.nombre, 'nombre', { min: 2, max: 40 });
          const cel = f.celular ? v.celular(f.celular) : '';
          const rol = sinAcentos(f.rol).startsWith('prop') ? 'propietaria' : 'colaboradora';
          const horario = f.horario ? horarioDe(f.horario) : null;
          const nombresServ = String(f.servicios || '').split(/\s*[|,;]\s*/).filter(Boolean);
          const idsServ = nombresServ.map((n) => servs.find((s2) => sinAcentos(s2.nombre) === sinAcentos(n))?.id);
          const faltan = nombresServ.filter((_, k2) => !idsServ[k2]);
          let existente = equipo.find((c) => sinAcentos(c.nombre) === sinAcentos(nombre) || c.slug === v.slugDe(nombre));
          if (!existente && rol === 'propietaria') existente = equipo.find((c) => c.rol === 'propietaria');
          const msg = `${nombre}${existente ? ' (actualizada)' : ' (nueva)'}${horario ? ` · horario de ${horario.length} día(s)` : ''}${faltan.length ? ` · servicios no encontrados: ${faltan.join(', ')}` : ''}`;
          if (simular) { ok(i, msg); continue; }
          let id = existente?.id;
          if (id) {
            await db.prepare("UPDATE colaboradoras SET celular = CASE WHEN ? <> '' THEN ? ELSE celular END WHERE id = ?").bind(cel, cel, id).run();
          } else {
            let slug = v.slugDe(nombre);
            if (equipo.some((c) => c.slug === slug)) slug += '-' + Date.now().toString(36).slice(-3);
            id = (await db.prepare(
              `INSERT INTO colaboradoras (slug, nombre, rol, celular, agenda, permisos, orden) VALUES (?, ?, 'colaboradora', ?, 1, ?, 50) RETURNING id`
            ).bind(slug, nombre, cel, JSON.stringify({ gestionar_citas: true, gestionar_bloqueos: true })).first()).id;
            equipo.push({ id, slug, nombre, rol: 'colaboradora' });
          }
          const sent = [];
          if (nombresServ.length) {
            sent.push(db.prepare('DELETE FROM colaboradora_servicios WHERE colaboradora_id = ?').bind(id));
            for (const sid of idsServ.filter(Boolean)) sent.push(db.prepare('INSERT OR IGNORE INTO colaboradora_servicios (colaboradora_id, servicio_id) VALUES (?, ?)').bind(id, sid));
          }
          if (horario) {
            for (const h of horario) {
              sent.push(db.prepare(`INSERT INTO horario_colaboradora (colaboradora_id, dia, trabaja, abre, cierra) VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(colaboradora_id, dia) DO UPDATE SET trabaja = excluded.trabaja, abre = excluded.abre, cierra = excluded.cierra`).bind(id, h.dia, h.trabaja, h.abre, h.cierra));
            }
          }
          if (sent.length) await db.batch(sent);
          ok(i, msg);
        } catch (e) { mal(i, e.message); }
      }
      return { resultado };
    }

    if (tipo === 'clientas') {
      const sentencias = [];
      filas.forEach((f, k) => {
        const i = desplazamiento + k;
        try {
          const nombre = v.texto(f.nombre, 'nombre', { min: 2, max: 80 });
          const celular = v.celular(f.celular);
          const email = (() => { try { return v.email(f.email); } catch { return ''; } })();
          let notas = v.texto(f.notas, 'notas', { max: 500, opcional: true });
          const ultima = fechaDe(f.ultima_visita);
          if (ultima) notas = `${notas} (Última visita en Kumbio: ${ultima})`.trim();
          const cumple = cumpleDe(f.cumpleanos);
          sentencias.push(db.prepare(
            `INSERT INTO clientas (nombre, celular, email, notas, cumpleanos) VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(celular) DO UPDATE SET nombre = excluded.nombre,
               email = CASE WHEN excluded.email <> '' THEN excluded.email ELSE clientas.email END,
               notas = CASE WHEN excluded.notas <> '' AND instr(clientas.notas, excluded.notas) = 0 THEN trim(clientas.notas || ' ' || excluded.notas) ELSE clientas.notas END,
               cumpleanos = CASE WHEN excluded.cumpleanos <> '' THEN excluded.cumpleanos ELSE clientas.cumpleanos END`
          ).bind(nombre, celular, email, notas, cumple));
          ok(i, `${nombre} · +${celular}`);
        } catch (e) { mal(i, e.message); }
      });
      if (!simular && sentencias.length) await db.batch(sentencias);
      return { resultado };
    }

    if (tipo === 'citas') {
      const [colab, serv] = await db.batch([
        db.prepare('SELECT id, slug, nombre FROM colaboradoras'),
        db.prepare('SELECT id, slug, nombre, precio, duracion FROM servicios'),
      ]);
      const buscarColab = (n) => colab.results.find((c) => sinAcentos(c.nombre) === sinAcentos(n) || c.slug === v.slugDe(n))
        || colab.results.find((c) => sinAcentos(n).split(' ')[0] === sinAcentos(c.nombre).split(' ')[0]);
      const buscarServ = (n) => serv.results.find((s) => sinAcentos(s.nombre) === sinAcentos(n) || s.slug === v.slugDe(n));
      const hoy = ahoraBogota().fecha;
      for (let k = 0; k < filas.length; k++) {
        const f = filas[k], i = desplazamiento + k;
        try {
          const fecha = fechaDe(f.fecha);
          if (!fecha) throw new Error('fecha inválida (use AAAA-MM-DD o DD/MM/AAAA)');
          const inicio = horaDe(f.hora);
          if (inicio == null) throw new Error('hora inválida (ej. 14:30 o 2:30 pm)');
          const nombre = v.texto(f.nombre, 'nombre', { min: 2, max: 80 });
          const celular = v.celular(f.celular);
          const co = buscarColab(f.colaboradora || '');
          if (!co) throw new Error(`no encuentro a la colaboradora "${f.colaboradora || ''}"`);
          const nombresServ = String(f.servicio || '').split(/\s*\+\s*|\s*;\s*/).filter(Boolean);
          if (!nombresServ.length) throw new Error('falta el servicio');
          const durFila = duracionDe(f.duracion);
          const precioFila = precioDe(f.precio);
          const servicios = nombresServ.map((n) => {
            const s = buscarServ(n);
            if (s) return { id: s.id, nombre: s.nombre, precio: s.precio, duracion: s.duracion };
            return { id: null, nombre: v.texto(n, 'servicio', { max: 80 }), precio: null, duracion: null };
          });
          // Duración/precio de la fila mandan si vienen (Kumbio puede tener valores distintos al catálogo).
          if (durFila) {
            const resto = servicios.slice(1).reduce((a, s) => a + (s.duracion || 0), 0);
            servicios[0].duracion = Math.max(5, durFila - resto);
          }
          if (servicios.some((s) => !s.duracion)) throw new Error('servicio desconocido y sin columna duración');
          if (precioFila != null) { servicios.forEach((s) => { s.precio = 0; }); servicios[0].precio = precioFila; }
          const estadoTexto = sinAcentos(f.estado).replace(/_/g, ' ');
          const estado = ESTADOS[estadoTexto] || ESTADOS[estadoTexto.replace(/ /g, '_')] || (fecha < hoy ? 'asistio' : 'confirmada');
          if (simular) { ok(i, `${fecha} ${f.hora} · ${nombre} con ${co.nombre} · ${servicios.map((s) => s.nombre).join(' + ')} · ${estado}`); continue; }

          const clienta = await db.prepare(
            `INSERT INTO clientas (nombre, celular) VALUES (?, ?) ON CONFLICT(celular) DO UPDATE SET nombre = clientas.nombre RETURNING id`
          ).bind(nombre, celular).first();
          const existe = await db.prepare(
            'SELECT 1 FROM citas WHERE clienta_id = ? AND colaboradora_id = ? AND fecha = ? AND inicio = ?'
          ).bind(clienta.id, co.id, fecha, inicio).first();
          if (existe) { ok(i, 'ya existía (omitida)'); continue; }
          const conSlots = estado !== 'cancelada' && fecha >= hoy;
          await insertarCita(db, {
            clientaId: clienta.id, colaboradoraId: co.id, fecha, inicio, servicios, origen: 'importada',
            notas: v.texto(f.notas, 'notas', { max: 400, opcional: true }), quien: `importador (${sesion.nombre})`,
            forzar: true, estado, conSlots,
          });
          ok(i, `${fecha} · ${nombre} con ${co.nombre}`);
        } catch (e) {
          mal(i, e.status === 409 ? 'se cruza con otra cita de esa colaboradora' : e.message);
        }
      }
      return { resultado };
    }
    falla(400, 'Tipo de importación inválido (servicios, colaboradoras, clientas o citas).');
  });
}
