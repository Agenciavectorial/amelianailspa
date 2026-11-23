// Voz en off con Gemini TTS (la credencial la pone el entorno; correr con NODE_USE_ENV_PROXY=1).
//   NODE_USE_ENV_PROXY=1 node dev/video/voz.mjs <video> [--forzar] [--solo bloque1,bloque2]
//   <video> = erika | chicas | pagina   (ver dev/video/guiones/)
// Cada "bloque" del guion (varios párrafos) se pide en UNA sola solicitud para ahorrar cuota
// (el plan gratuito permite pocas solicitudes al día por modelo) y luego se corta en un audio
// por escena usando los silencios entre párrafos. Resultado: dev/video/audio/<video>/<escena>.wav
// Los audios que ya existen (generados o grabados a mano con importar-audios.mjs) no se repiten.
import { writeFileSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const MODELO = process.env.TTS_MODELO || 'gemini-2.5-flash-preview-tts';
export const VOZ = process.env.TTS_VOZ || 'Sulafat';
export const ESTILO = process.env.TTS_ESTILO ||
  'Lee esto con voz de mujer joven de Medellín, Colombia, con acento paisa natural y suave, ' +
  'cálida, cercana y tranquila, como una amiga que le explica algo con cariño a otra. ' +
  'Ritmo conversacional natural, tranquilo pero ágil, sonriendo al hablar, sin exagerar el acento ni sonar a locutora.';

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
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': 'la-pone-el-proxy' }, body: JSON.stringify(cuerpo),
    });
    if (r.ok) {
      const j = await r.json();
      const b64 = j.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData?.data;
      if (b64) return wav(Buffer.from(b64, 'base64'));
      console.error('  respuesta sin audio, reintento', intento);
      continue;
    }
    const t = await r.text();
    if (r.status === 429 && /per day|PerDay/i.test(t)) throw Object.assign(new Error('CUOTA_DIARIA'), { detalle: t });
    if (r.status === 429 || r.status >= 500) {
      const espera = Math.min(60, 5 * intento * intento);
      console.error(`  ${r.status}; espero ${espera}s`);
      await new Promise((s) => setTimeout(s, espera * 1000));
    } else throw new Error(`${r.status} ${t.slice(0, 400)}`);
  }
  throw new Error('No se pudo generar el audio');
}

const dur = (f) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString());

function leerSilencios(f, umbral, min) {
  let txt = '';
  try { execFileSync('ffmpeg', ['-hide_banner', '-nostats', '-i', f, '-af', `silencedetect=n=${umbral}dB:d=${min}`, '-f', 'null', '-'], { stdio: ['ignore', 'ignore', 'pipe'] }); } catch (e) { txt = String(e.stderr || ''); }
  if (!txt) txt = execFileSync('sh', ['-c', `ffmpeg -hide_banner -nostats -i "${f}" -af silencedetect=n=${umbral}dB:d=${min} -f null - 2>&1`]).toString();
  const s = [];
  let ini = null;
  for (const l of txt.split('\n')) {
    let m = l.match(/silence_start: ([\d.]+)/); if (m) ini = Number(m[1]);
    m = l.match(/silence_end: ([\d.]+)/); if (m && ini !== null) { s.push({ ini, fin: Number(m[1]) }); ini = null; }
  }
  return s;
}

/** Corta un audio de varios párrafos en partes, buscando los silencios más cercanos a lo esperado. */
export function cortar(archivo, textos, destinos) {
  const total = dur(archivo);
  const sil = leerSilencios(archivo, -38, 0.22).filter((x) => x.ini > 0.3 && x.fin < total - 0.3);
  const largos = textos.map((t) => t.length);
  const suma = largos.reduce((a, b) => a + b, 0);
  const cortes = [];
  let acum = 0;
  let desde = 0;
  for (let i = 0; i < textos.length - 1; i++) {
    acum += largos[i];
    const esperado = (acum / suma) * total;
    let mejor = null;
    for (const x of sil) {
      const medio = (x.ini + x.fin) / 2;
      if (medio <= desde + 0.5) continue;
      const puntaje = Math.abs(medio - esperado) / total * 10 - Math.min(1.2, x.fin - x.ini) * 3;
      if (!mejor || puntaje < mejor.puntaje) mejor = { puntaje, medio, x };
    }
    const c = mejor ? mejor.medio : esperado;
    cortes.push(c);
    desde = c;
  }
  const lims = [0, ...cortes, total];
  for (let i = 0; i < destinos.length; i++) {
    const a = lims[i], b = lims[i + 1];
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', archivo, '-ss', String(a), '-to', String(b),
      '-af', 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.08,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.12,areverse',
      '-ar', '24000', '-ac', '1', destinos[i]]);
  }
  return lims;
}

export async function cargarGuion(id) {
  return (await import(pathToFileURL(path.join(AQUI, 'guiones', `${id}.mjs`)).href)).default;
}

/** Párrafos que lleva cada bloque (texto de voz por escena, con variantes p. ej. por chica). */
export function bloques(guion) {
  return guion.bloques.map((b) => ({ id: b.id, partes: b.escenas.map((e) => ({ id: e.id, texto: e.texto })) }));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [id, ...resto] = process.argv.slice(2);
  const forzar = resto.includes('--forzar');
  const iSolo = resto.indexOf('--solo');
  const solo = iSolo >= 0 ? resto[iSolo + 1].split(',') : null;
  const guion = await cargarGuion(id);
  const dir = path.join(AQUI, 'audio', id);
  const crudos = path.join(dir, 'bloques');
  mkdirSync(crudos, { recursive: true });
  let solicitudes = 0;
  for (const b of bloques(guion)) {
    if (solo && !solo.includes(b.id)) continue;
    const destinos = b.partes.map((p) => path.join(dir, `${p.id}.wav`));
    if (!forzar && destinos.every(existsSync)) continue;
    const crudo = path.join(crudos, `${b.id}.wav`);
    if (forzar || !existsSync(crudo)) {
      process.stdout.write(`${id}/${b.id} (${b.partes.length} párrafos) … `);
      const texto = b.partes.length > 1
        ? 'Entre un párrafo y el siguiente haz una pausa clara de un segundo.\n\n' + b.partes.map((p) => p.texto).join('\n\n')
        : b.partes[0].texto;
      try {
        writeFileSync(crudo, await sintetizar(texto));
      } catch (e) {
        if (e.message === 'CUOTA_DIARIA') { console.log(`\nSe acabó la cuota diaria del modelo ${MODELO}. Solicitudes hechas en esta corrida: ${solicitudes}.`); process.exit(2); }
        throw e;
      }
      solicitudes++;
      const esperado = b.partes.map((p) => p.texto).join(' ').split(/\s+/).length / 2.8;
      console.log(`${dur(crudo).toFixed(1)} s (esperado ~${esperado.toFixed(0)} s)`);
      if (dur(crudo) < esperado * 0.6) {
        execFileSync('mv', [crudo, crudo.replace(/\.wav$/, `-incompleto-${Date.now()}.wav`)]);
        console.log('   ⚠ El audio salió cortado (la voz no leyó todo el bloque). Vuelve a correr este bloque.');
        continue;
      }
    }
    if (b.partes.length === 1) execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', crudo,
      '-af', 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.08,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.12,areverse', destinos[0]]);
    else cortar(crudo, b.partes.map((p) => p.texto), destinos);
    for (const [i, d] of destinos.entries()) console.log(`   ${b.partes[i].id}: ${dur(d).toFixed(1)} s`);
  }
  console.log(`Listo (${solicitudes} solicitudes).`);
}
