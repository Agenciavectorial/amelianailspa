// Copias de seguridad de la base: todas las tablas en un JSON comprimido (gzip).
// - Diario (Worker de recordatorios, ~3:00 a. m. de Colombia): se guarda en R2 (binding RESPALDOS) si existe,
//   y siempre en la tabla `respaldos` de la misma base (se conservan los últimos 14).
// - Manual desde el panel (Erika → Seguridad → "Hacer copia ahora" / "Descargar").
// Restaurar: docs/plataforma/SEGURIDAD.md (script dev/restaurar.mjs o Time Travel de D1).
import { ahoraBogota } from './tiempo.js';

// No se respaldan: sesiones e intentos (se regeneran solos), la cola de push y los propios respaldos.
// medios_archivos (fotos) no entra: pesaría demasiado; las fotos se pueden volver a subir.
const EXCLUIDAS = new Set(['sesiones', 'intentos', 'push_enviados', 'respaldos', 'medios_archivos', 'd1_migrations', '_cf_KV', 'sqlite_sequence']);
const CONSERVAR = 14;

export async function tablasDe(db) {
  const { results } = await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name").all();
  return results.map((r) => r.name).filter((n) => !EXCLUIDAS.has(n));
}

/** Exporta todo a un objeto { version, fecha, tablas: { nombre: filas[] } }. */
export async function exportar(db) {
  const tablas = {};
  let filas = 0;
  for (const t of await tablasDe(db)) {
    const { results } = await db.prepare(`SELECT * FROM "${t}"`).all();
    tablas[t] = results.map((f) => {
      // Los BLOB (p. ej. fotos guardadas en la base) van en base64.
      const o = {};
      for (const [k, val] of Object.entries(f)) o[k] = val instanceof ArrayBuffer || ArrayBuffer.isView(val) ? { b64: b64(val) } : Array.isArray(val) ? { b64: b64(new Uint8Array(val)) } : val;
      return o;
    });
    filas += results.length;
  }
  return { version: 1, app: 'amelia-citas', fecha: new Date().toISOString(), filas, tablas };
}

function b64(buf) {
  const u = buf instanceof ArrayBuffer ? new Uint8Array(buf) : new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
}

export async function comprimir(texto) {
  const flujo = new Blob([texto]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(flujo).arrayBuffer());
}

export async function descomprimir(bytes) {
  const flujo = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(flujo).text();
}

/** Hace una copia y la guarda (R2 si hay, y en la base). Devuelve { id, bytes, filas, destino }. */
export async function hacerRespaldo(env, { motivo = 'diario' } = {}) {
  const db = env.DB;
  const datos = await exportar(db);
  const gz = await comprimir(JSON.stringify(datos));
  const fecha = ahoraBogota().fecha;
  let destino = 'd1', clave = '';
  if (env.RESPALDOS) {
    clave = `amelia/${fecha}-${motivo}-${Date.now().toString(36)}.json.gz`;
    await env.RESPALDOS.put(clave, gz, { httpMetadata: { contentType: 'application/gzip' } });
    destino = 'r2';
  }
  // Copia fuera de la base en un espacio KV de Cloudflare (binding RESPALDOS_KV), si existe: vence a los 35 días.
  if (env.RESPALDOS_KV) {
    await env.RESPALDOS_KV.put(`base-${fecha}${motivo === 'diario' ? '' : '-' + motivo + '-' + Date.now().toString(36)}`, gz, { expirationTtl: 35 * 86400 });
    if (destino === 'd1') destino = 'kv';
  }
  // En la base solo si cabe (límite de D1 por fila ~2 MB). Si no cabe y no hay R2, se avisa en el registro.
  const cabe = gz.byteLength < 1_900_000;
  const f = await db.prepare('INSERT INTO respaldos (fecha, destino, clave, bytes, filas, datos) VALUES (?, ?, ?, ?, ?, ?) RETURNING id')
    .bind(fecha, destino, clave || motivo, gz.byteLength, datos.filas, cabe ? gz : null).first();
  await db.prepare('DELETE FROM respaldos WHERE id NOT IN (SELECT id FROM respaldos ORDER BY id DESC LIMIT ?)').bind(CONSERVAR).run();
  if (!cabe && destino === 'd1') console.error('respaldo: no cupo en D1 y no hay R2 configurado');
  return { id: f.id, bytes: gz.byteLength, filas: datos.filas, destino, en_base: cabe };
}

/** Respaldo diario: una vez por día, a partir de las 3:00 a. m. de Colombia. */
export async function respaldoDiario(env, { ahoraMs = Date.now() } = {}) {
  const { fecha, minuto } = ahoraBogota(ahoraMs);
  if (minuto < 180) return { hecho: false, motivo: 'aún no es la hora' };
  const ya = await env.DB.prepare("SELECT 1 FROM respaldos WHERE fecha = ? AND clave LIKE '%diario%' LIMIT 1").bind(fecha).first();
  if (ya) return { hecho: false, motivo: 'ya existe' };
  return { hecho: true, ...(await hacerRespaldo(env, { motivo: 'diario' })) };
}

/**
 * SQL para restaurar un respaldo (borra y vuelve a llenar cada tabla del respaldo).
 * Lo usa dev/restaurar.mjs; se aplica con `wrangler d1 execute --file`.
 */
export function sqlDeRestauracion(datos) {
  if (!datos || datos.app !== 'amelia-citas' || !datos.tablas) throw new Error('El archivo no es un respaldo de Amelia.');
  const lit = (val) => {
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'number') return Number.isFinite(val) ? String(val) : 'NULL';
    if (typeof val === 'boolean') return val ? '1' : '0';
    if (typeof val === 'object' && val.b64) return `X'${[...atob(val.b64)].map((c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join('')}'`;
    return `'${String(val).replace(/'/g, "''")}'`;
  };
  const lineas = ['PRAGMA defer_foreign_keys = ON;'];
  // Orden: primero las tablas "padre" para que las referencias existan.
  const orden = ['ajustes', 'horario_spa', 'festivos', 'servicios', 'colaboradoras', 'clientas', 'etiquetas', 'gasto_categorias', 'citas', 'metas', 'deudas'];
  const nombres = Object.keys(datos.tablas).sort((a, b) => ((orden.indexOf(a) + 1 || 99) - (orden.indexOf(b) + 1 || 99)) || a.localeCompare(b));
  for (const t of [...nombres].reverse()) lineas.push(`DELETE FROM "${t}";`);
  for (const t of nombres) {
    for (const f of datos.tablas[t]) {
      const cols = Object.keys(f);
      lineas.push(`INSERT INTO "${t}" (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${cols.map((c) => lit(f[c])).join(', ')});`);
    }
  }
  return lineas.join('\n') + '\n';
}
