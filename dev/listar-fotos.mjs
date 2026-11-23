// Genera public/app-citas/fotos.json: fotos publicadas del spa que Erika puede elegir para las galerías.
//   node dev/listar-fotos.mjs   (correr cuando se agreguen fotos nuevas a public/img)
import { readdirSync, writeFileSync } from 'node:fs';

const dir = new URL('../public/img/', import.meta.url);
const archivos = readdirSync(dir).filter((f) => f.endsWith('.webp'));
const bases = new Map();
for (const f of archivos) {
  const m = /^(.+)-(\d+)\.webp$/.exec(f);
  if (!m) continue;
  const [, base, ancho] = m;
  if (/^(logo|erika|leidy|karla|julieth|daily|valentina)$/.test(base)) continue; // fotos del equipo y logo
  const actual = bases.get(base);
  // Preferimos ~720 px para galerías (buen equilibrio peso/calidad)
  const puntaje = (w) => Math.abs(Number(w) - 720);
  if (!actual || puntaje(ancho) < puntaje(actual)) bases.set(base, ancho);
}
const fotos = [...bases].sort(([a], [b]) => a.localeCompare(b, 'es', { numeric: true })).map(([b, w]) => `/img/${b}-${w}.webp`);
writeFileSync(new URL('../public/app-citas/fotos.json', import.meta.url), JSON.stringify({ fotos }, null, 1) + '\n');
console.log(`${fotos.length} fotos`);
