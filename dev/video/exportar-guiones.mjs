// Escribe docs/capacitacion/GUIONES.md: el texto de cada párrafo con el nombre de archivo que debe
// tener su grabación (por si se graba la voz a mano). node dev/video/exportar-guiones.mjs
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarGuion } from './voz.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..', '..');
const lineas = ['# Guiones de los videos de capacitación', '',
  'Cada párrafo es una escena. Si vas a grabar la voz, graba **un archivo por párrafo** y ponle el nombre indicado',
  '(por ejemplo `e01.m4a`). Tono: cálido y tranquilo, como explicándole a una amiga. Deja medio segundo de silencio',
  'al inicio y al final. Luego: `node dev/video/importar-audios.mjs erika carpeta-con-audios`.', ''];
let total = 0;
for (const id of ['erika', 'chicas', 'pagina']) {
  const g = await cargarGuion(id);
  lineas.push(`## ${g.titulo} (\`${id}\`)`, '');
  for (const e of g.escenas) {
    const wav = path.join(AQUI, 'audio', id, `${e.id}.wav`);
    let d = '';
    if (existsSync(wav)) { const s = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', wav]).toString()); total += s; d = ` · ${s.toFixed(0)} s`; }
    else d = ' · sin voz todavía';
    lineas.push(`**\`${e.id}\`** — ${e.capitulo}${d}`, '', `> ${e.texto}`, '');
  }
}
lineas.push(`Total de voz generada: ${(total / 60).toFixed(1)} minutos.`, '');
mkdirSync(path.join(RAIZ, 'docs', 'capacitacion'), { recursive: true });
writeFileSync(path.join(RAIZ, 'docs', 'capacitacion', 'GUIONES.md'), lineas.join('\n'));
console.log('docs/capacitacion/GUIONES.md');
