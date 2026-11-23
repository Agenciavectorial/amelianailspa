// Importa voces grabadas a mano (celular, grabadora…) en lugar de la voz generada.
//   node dev/video/importar-audios.mjs <video> <carpeta-con-audios>
// Cada archivo se llama como la escena del guion: e01.m4a, e02.mp3, saludo-leidy.ogg, p05.wav…
// (la lista está en docs/capacitacion/GUIONES.md). Se convierte a WAV mono, se le quita el silencio
// del inicio y del final, se normaliza el volumen y se guarda en dev/video/audio/<video>/<escena>.wav.
// Luego basta con volver a grabar y armar: node dev/video/grabar.mjs <video> && node dev/video/armar.mjs <video>
import { readdirSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarGuion } from './voz.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const [video, carpeta] = process.argv.slice(2);
if (!video || !carpeta) { console.log('Uso: node dev/video/importar-audios.mjs <erika|chicas|pagina> <carpeta>'); process.exit(1); }
const guion = await cargarGuion(video);
const ids = new Set(guion.escenas.map((e) => e.id));
const dest = path.join(AQUI, 'audio', video);
mkdirSync(dest, { recursive: true });
let n = 0;
for (const f of readdirSync(carpeta)) {
  const id = path.parse(f).name.toLowerCase();
  if (!/\.(wav|mp3|m4a|aac|ogg|opus|webm|flac|mp4)$/i.test(f)) continue;
  if (!ids.has(id)) { console.log(`  (se ignora ${f}: no hay escena "${id}")`); continue; }
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', path.join(carpeta, f),
    '-af', 'highpass=f=70,silenceremove=start_periods=1:start_threshold=-42dB:start_silence=0.1,areverse,silenceremove=start_periods=1:start_threshold=-42dB:start_silence=0.15,areverse,loudnorm=I=-16:TP=-1.5',
    '-ar', '24000', '-ac', '1', path.join(dest, `${id}.wav`)]);
  console.log(`  ✓ ${id}`);
  n++;
}
const faltan = [...ids].filter((id) => !readdirSync(dest).includes(`${id}.wav`));
console.log(`Importados: ${n}. ${faltan.length ? `Siguen sin audio: ${faltan.join(', ')}` : 'Todas las escenas tienen voz.'}`);
