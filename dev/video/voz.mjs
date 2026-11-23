// Genera audios de voz en off con Gemini TTS (la credencial la pone el entorno).
//   node dev/video/voz.mjs <guion.json> [--solo id1,id2] [--forzar]
// Cada párrafo del guion se guarda como WAV en dev/video/audio/<video>/<id>.wav
// Si un archivo ya existe (o fue grabado a mano e importado) no se vuelve a generar.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const MODELO = process.env.TTS_MODELO || 'gemini-2.5-pro-preview-tts';
export const VOZ = process.env.TTS_VOZ || 'Sulafat';
export const ESTILO = process.env.TTS_ESTILO ||
  'Lee esto con voz de mujer joven de Medellín, Colombia, con acento paisa natural y suave, ' +
  'cálida, cercana y tranquila, como una amiga que le explica algo con cariño a otra. ' +
  'Ritmo conversacional natural, tranquilo pero ágil, sonriendo al hablar, sin exagerar el acento ni sonar a locutora:';

function wav(pcm, rate = 24000) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36);
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

export async function sintetizar(texto, { voz = VOZ, modelo = MODELO, estilo = ESTILO } = {}) {
  const cuerpo = {
    contents: [{ parts: [{ text: `${estilo}\n\n${texto}` }] }],
    generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voz } } } },
  };
  for (let intento = 1; intento <= 6; intento++) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': 'x' }, body: JSON.stringify(cuerpo),
    });
    if (r.ok) {
      const j = await r.json();
      const b64 = j.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData?.data;
      if (b64) return wav(Buffer.from(b64, 'base64'));
      console.error('  respuesta sin audio, reintento', intento);
    } else {
      const t = await r.text();
      if (r.status === 429 || r.status >= 500) {
        const espera = Math.min(60, 5 * intento * intento);
        console.error(`  ${r.status}; espero ${espera}s`, (t.match(/Quota exceeded[^\\]*/)||[t.slice(0,200)])[0]);
        if (r.status === 429 && /per day|PerDay/i.test(t) && intento > 2) throw Object.assign(new Error('CUOTA_DIARIA'), { detalle: t });
        await new Promise((s) => setTimeout(s, espera * 1000));
      } else throw new Error(`${r.status} ${t.slice(0, 400)}`);
    }
  }
  throw new Error('No se pudo generar el audio');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [archivo, ...resto] = process.argv.slice(2);
  const forzar = resto.includes('--forzar');
  const iSolo = resto.indexOf('--solo');
  const solo = iSolo >= 0 ? resto[iSolo + 1].split(',') : null;
  const guion = JSON.parse(readFileSync(archivo, 'utf8'));
  const dir = path.join(AQUI, 'audio', guion.id);
  mkdirSync(dir, { recursive: true });
  let hechos = 0;
  for (const p of guion.parrafos) {
    if (solo && !solo.includes(p.id)) continue;
    const destino = path.join(dir, `${p.id}.wav`);
    if (existsSync(destino) && !forzar) continue;
    process.stdout.write(`${guion.id}/${p.id} … `);
    const audio = await sintetizar(p.voz || p.texto);
    writeFileSync(destino, audio);
    hechos++;
    console.log(`${(audio.length / 48000).toFixed(1)} s`);
  }
  console.log(`Listo: ${hechos} audios nuevos en ${path.relative(process.cwd(), dir)}`);
}
