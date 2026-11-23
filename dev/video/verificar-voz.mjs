// Revisa que cada audio diga lo que dice el guion: lo transcribe con Gemini y compara palabras.
//   NODE_USE_ENV_PROXY=1 node dev/video/verificar-voz.mjs <video> [--por-escena]
// Escribe dev/video/audio/<video>/verificacion.json. Un parecido < 0.85 indica que hay que regenerar.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarGuion, bloques } from './voz.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const MODELOS = (process.env.MODELOS_TRANSCRIBIR || 'gemini-3.6-flash,gemini-3.5-flash,gemini-3.7-flash,gemini-3.8-flash,gemini-3-flash-preview').split(',');

export async function transcribir(wav) {
  const mp3 = execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', wav, '-b:a', '48k', '-f', 'mp3', '-'], { maxBuffer: 64e6 });
  for (let vuelta = 0; vuelta < 3; vuelta++) {
    for (const m of MODELOS) {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': 'la-pone-el-proxy' },
        body: JSON.stringify({ contents: [{ parts: [{ text: 'Transcribe exactamente este audio en español. Solo el texto, sin comentarios.' }, { inlineData: { mimeType: 'audio/mp3', data: mp3.toString('base64') } }] }] }),
      });
      if (r.ok) { const j = await r.json(); const t = j.candidates?.[0]?.content?.parts?.map((p) => p.text).join(''); if (t) return t; }
    }
    await new Promise((s) => setTimeout(s, 15000));
  }
  throw new Error('No se pudo transcribir');
}

const palabras = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zñ0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
/** Parecido por subsecuencia común más larga de palabras (0–1). */
export function parecido(a, b) {
  const x = palabras(a), y = palabras(b);
  const dp = Array.from({ length: x.length + 1 }, () => new Array(y.length + 1).fill(0));
  for (let i = 1; i <= x.length; i++) for (let j = 1; j <= y.length; j++) dp[i][j] = x[i - 1] === y[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
  return (2 * dp[x.length][y.length]) / (x.length + y.length || 1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [id, ...resto] = process.argv.slice(2);
  const porEscena = resto.includes('--por-escena');
  const guion = await cargarGuion(id);
  const dir = path.join(AQUI, 'audio', id);
  const archivo = path.join(dir, 'verificacion.json');
  const res = existsSync(archivo) ? JSON.parse(readFileSync(archivo, 'utf8')) : {};
  for (const b of bloques(guion)) {
    const items = porEscena ? b.partes.map((p) => ({ id: p.id, wav: path.join(dir, `${p.id}.wav`), texto: p.texto }))
      : [{ id: b.id, wav: path.join(dir, 'bloques', `${b.id}.wav`), texto: b.partes.map((p) => p.texto).join(' ') }];
    for (const it of items) {
      if (!existsSync(it.wav)) { console.log(`${it.id}: falta el audio`); continue; }
      const t = await transcribir(it.wav);
      const p = parecido(it.texto, t);
      res[it.id] = { parecido: Number(p.toFixed(3)), transcripcion: t.trim() };
      console.log(`${it.id}: ${p.toFixed(2)} ${p < 0.85 ? '⚠ REVISAR' : 'ok'}`);
    }
  }
  writeFileSync(archivo, JSON.stringify(res, null, 2));
}
