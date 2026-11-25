// Restaura un respaldo (el JSON que se descarga en Panel → Seguridad y respaldos → Descargar).
//   node dev/restaurar.mjs respaldo-amelia-2026-11-25.json            → genera respaldo-amelia-2026-11-25.sql (no toca nada)
//   node dev/restaurar.mjs respaldo-amelia-2026-11-25.json --local    → lo aplica a la base local de desarrollo
//   node dev/restaurar.mjs respaldo-amelia-2026-11-25.json --remoto   → lo aplica a la base REAL (pide confirmación)
// Antes de restaurar en la base real se hace una copia completa con `wrangler d1 export` por si hay que deshacer.
// Ver docs/plataforma/SEGURIDAD.md.
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { sqlDeRestauracion } from '../functions/_lib/respaldo.js';

const [archivo, modo] = process.argv.slice(2);
if (!archivo) { console.error('Uso: node dev/restaurar.mjs <respaldo.json> [--local | --remoto]'); process.exit(1); }
const datos = JSON.parse(readFileSync(archivo, 'utf8'));
const sql = sqlDeRestauracion(datos) + 'DELETE FROM sesiones;\n';
const salida = archivo.replace(/\.json$/, '') + '.sql';
writeFileSync(salida, sql);
const filas = Object.values(datos.tablas).reduce((a, t) => a + t.length, 0);
console.log(`Respaldo del ${datos.fecha}: ${Object.keys(datos.tablas).length} tablas, ${filas} registros → ${salida}`);
if (!modo) process.exit(0);

const wrangler = 'node_modules/.bin/wrangler';
if (modo === '--remoto') {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const r = await rl.question('Esto REEMPLAZA los datos de la base real por los del respaldo. Escribe RESTAURAR para seguir: ');
  rl.close();
  if (r.trim() !== 'RESTAURAR') { console.log('Cancelado.'); process.exit(0); }
  const antes = `antes-de-restaurar-${new Date().toISOString().replace(/[:.]/g, '-')}.sql`;
  console.log(`Copia de lo que hay ahora en ${antes} …`);
  execFileSync(wrangler, ['d1', 'export', 'amelia-citas', '--remote', '--output', antes], { stdio: 'inherit' });
  execFileSync(wrangler, ['d1', 'execute', 'amelia-citas', '--remote', '--file', salida], { stdio: 'inherit' });
} else if (modo === '--local') {
  execFileSync(wrangler, ['d1', 'execute', 'amelia-citas', '--local', '--persist-to', 'dev/.estado', '--file', salida], { stdio: 'inherit' });
} else {
  console.error('Modo desconocido. Usa --local o --remoto.');
  process.exit(1);
}
console.log('Listo. Las sesiones se cierran (todas deben entrar de nuevo con su PIN).');
