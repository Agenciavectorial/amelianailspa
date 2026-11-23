// Pone ?v=<huella> a todos los JS y CSS de la plataforma (/reservar, /panel, /app-citas).
// Así cada publicación usa direcciones nuevas y ni el navegador ni el edge de Cloudflare sirven copias viejas.
// La huella es la misma para todos los archivos (si cambia uno, cambian todos): un módulo ES siempre se
// importa con la misma dirección y no se carga dos veces.
//
//   node dev/versionar.mjs            → actualiza las versiones (correr antes de cada commit que toque estos archivos)
//   node dev/versionar.mjs --revisar  → solo revisa; sale con error si falta actualizar (lo usan las pruebas)
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CARPETAS = ['public/reservar', 'public/panel', 'public/app-citas/js'];
const NO_VERSIONAR = new Set(['sw.js']); // el service worker debe tener siempre la misma dirección

function archivos(dir) {
  const out = [];
  for (const n of readdirSync(dir)) {
    const p = path.join(dir, n);
    if (statSync(p).isDirectory()) out.push(...archivos(p));
    else if (/\.(js|css|html|webmanifest)$/.test(n)) out.push(p);
  }
  return out;
}

const lista = CARPETAS.flatMap((d) => archivos(path.join(RAIZ, d))).sort();
const sinVersion = (t) => t.replace(/\?v=[0-9a-f]{10}/g, '');

const h = createHash('sha256');
for (const f of lista) h.update(path.relative(RAIZ, f)).update('\0').update(sinVersion(readFileSync(f, 'utf8')));
const V = h.digest('hex').slice(0, 10);

// Rutas locales a .js/.css/.webmanifest dentro de import/from/import() o de src=/href= en HTML.
const RE = /((?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)['"]|(?:src|href)=")((?:\/|\.\/|\.\.\/)[^'"?#\s]+\.(?:js|css))(?:\?v=[0-9a-f]{10})?(?=['"])/g;
const versionar = (t) => t.replace(RE, (m, antes, ruta) => (NO_VERSIONAR.has(path.basename(ruta)) ? `${antes}${ruta}` : `${antes}${ruta}?v=${V}`));

const revisar = process.argv.includes('--revisar');
const pendientes = [];
for (const f of lista) {
  const t = readFileSync(f, 'utf8');
  const n = versionar(t);
  if (n !== t) {
    pendientes.push(path.relative(RAIZ, f));
    if (!revisar) writeFileSync(f, n);
  }
}
if (revisar && pendientes.length) {
  console.error(`Faltan versiones (${V}) en: ${pendientes.join(', ')}. Corre: node dev/versionar.mjs`);
  process.exit(1);
}
console.log(revisar ? `Versiones al día (${V}).` : `Versión ${V} · ${pendientes.length} archivos actualizados.`);
