// Graba la pantalla de cada video al ritmo de la voz, con el servidor LOCAL y datos ficticios.
//   node dev/video/grabar.mjs <erika|chicas|pagina> [--chica Leidy]
// Usa el screencast de Chromium (cuadros JPEG con su hora) y luego arma un MP4 a 30 cps.
// Resultado: dev/video/salida/<video>[-chica]/pantalla.mp4 y tiempos.json (inicio/fin de cada escena)
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright'); // instalado globalmente en el entorno
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { levantar, datosDemo, cliente } from '../servidor.mjs';
import { cargarGuion } from './voz.mjs';
import { generarVapid } from '../../functions/_lib/push.js';
import { prepararDatos, TOQUE, limpiar } from './acciones.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const PUERTO = Number(process.env.PUERTO_VIDEO || 8789); // otro puerto permite grabar dos a la vez
const PAUSA = 0.55; // segundos de aire después de cada párrafo

const dur = (f) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString());
export function duracionEscena(video, e) {
  const f = path.join(AQUI, 'audio', video, `${e.id}.wav`);
  if (existsSync(f)) return { voz: dur(f), audio: f };
  return { voz: e.texto.split(/\s+/).length / 2.6, audio: null }; // borrador sin voz: estimado
}

export async function grabar(video, { chica, rapido = false, solo = null } = {}) {
  const guion = await cargarGuion(video);
  const escenas = chica ? guion.version(chica) : guion.escenas;
  const nombre = chica ? `${video}-${chica.toLowerCase()}` : video;
  const dir = path.join(AQUI, 'salida', rapido ? `${nombre}-prueba` : nombre);
  const cuadros = path.join(dir, 'cuadros');
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(cuadros, { recursive: true });

  // Llaves VAPID desechables, solo para este servidor local (así la pantalla de avisos se ve configurada).
  const { publica, privada } = await generarVapid();
  const srv = await levantar({ puerto: PUERTO, estado: `dev/.estado-video-${PUERTO}`, variables: { VAPID_PUBLICA: publica, VAPID_PRIVADA: privada, VAPID_SUJETO: 'mailto:video@ejemplo.local', PUSH_PERMITIR_LOCAL: '1' } });
  const base = srv.base;
  let srvAntes = null;
  let srvNuevo = null;
  try {
    await datosDemo(base);
    await prepararDatos(base, video);
    if (video === 'pagina') srvAntes = await servirAntes();
    // Para mostrar la pantalla de "primera vez" (crear PIN) se usa otra base local sin configurar.
    if (video === 'erika') srvNuevo = await levantar({ puerto: PUERTO + 4, estado: `dev/.estado-video-nuevo-${PUERTO}` });

    const navegador = await chromium.launch();
    const ctx = await navegador.newContext({
      viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
      locale: 'es-CO', timezoneId: 'America/Bogota', colorScheme: 'light',
      permissions: ['notifications'],
    });
    await ctx.addInitScript(TOQUE);
    await ctx.route('https://wa.me/**', (r) => r.abort());
    const page = await ctx.newPage();
    page.on('popup', (p) => p.close().catch(() => {}));
    page.on('pageerror', (e) => console.error('  [página]', e.message));

    // Screencast
    const cdp = await ctx.newCDPSession(page);
    const lista = [];
    let n = 0;
    cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
      const f = path.join(cuadros, `${String(n++).padStart(6, '0')}.jpg`);
      writeFileSync(f, Buffer.from(data, 'base64'));
      lista.push({ f, t: metadata.timestamp });
      cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
    });
    const ayuda = { base, baseAntes: srvAntes?.base, baseNuevo: srvNuevo?.base, page, ctx, chica, video };
    if (escenas[0].preparar) await escenas[0].preparar(ayuda);
    await page.goto(base + '/panel/', { waitUntil: 'networkidle' }).catch(() => {});
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 88, everyNthFrame: 1 });
    const t0 = Date.now() / 1000;
    const tiempos = [];
    for (const e of escenas) {
      const { voz, audio } = duracionEscena(video, e);
      const d = voz + PAUSA;
      const ini = Date.now() / 1000;
      const hasta = rapido ? async () => {} : async (frac) => { const falta = ini + d * frac - Date.now() / 1000; if (falta > 0) await page.waitForTimeout(falta * 1000); };
      process.stdout.write(`  ${e.id} (${d.toFixed(1)} s) … `);
      if (!e.mantener) await limpiar(page);
      try { await e.accion({ ...ayuda, d, hasta, escena: e }); } catch (x) {
        console.error(`\n  ⚠ ${e.id}: ${x.message.split('\n')[0]}`);
        await page.screenshot({ path: path.join(dir, `error-${e.id}.png`) }).catch(() => {});
      }
      await hasta(1);
      if (rapido) await page.screenshot({ path: path.join(dir, `fin-${e.id}.png`) }).catch(() => {});
      const fin = Date.now() / 1000;
      tiempos.push({ id: e.id, capitulo: e.capitulo, texto: e.texto, audio, voz, ini: ini - t0, fin: fin - t0 });
      console.log(`${(fin - ini).toFixed(1)} s${fin - ini > d + 0.3 ? ' (se alargó)' : ''}`);
    }
    await page.waitForTimeout(300);
    await cdp.send('Page.stopScreencast');
    const tFin = Date.now() / 1000;
    await navegador.close();

    // Cuadros → MP4 a 30 cps (cada cuadro dura hasta el siguiente)
    const lineas = ['ffconcat version 1.0'];
    for (let i = 0; i < lista.length; i++) {
      const a = Math.max(lista[i].t, t0);
      const b = i + 1 < lista.length ? Math.max(lista[i + 1].t, t0) : tFin;
      const di = i === 0 ? b - t0 : b - a;
      if (di <= 0) continue;
      lineas.push(`file '${lista[i].f}'`, `duration ${di.toFixed(4)}`);
    }
    lineas.push(`file '${lista[lista.length - 1].f}'`);
    const concat = path.join(dir, 'cuadros.txt');
    writeFileSync(concat, lineas.join('\n'));
    const mp4 = path.join(dir, 'pantalla.mp4');
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', concat,
      '-vf', 'scale=780:1688:flags=lanczos,fps=30,format=yuv420p', '-c:v', 'libx264', '-preset', 'fast', '-crf', '14', mp4]);
    writeFileSync(path.join(dir, 'tiempos.json'), JSON.stringify({ video, chica, total: tFin - t0, escenas: tiempos }, null, 2));
    rmSync(cuadros, { recursive: true, force: true });
    console.log(`Grabado: ${path.relative(process.cwd(), mp4)} (${(tFin - t0).toFixed(1)} s, ${lista.length} cuadros)`);
    return { dir, mp4 };
  } finally {
    srv.cerrar();
    srvAntes?.cerrar();
    srvNuevo?.cerrar();
  }
}

/** Sirve la versión anterior de la página (commit e68a802) en otro puerto. */
async function servirAntes() {
  const dir = path.join(AQUI, 'salida', 'pagina-antes');
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'index.html'), execFileSync('git', ['show', 'e68a802:index.html'], { cwd: path.join(AQUI, '..', '..') }));
  const proc = spawn('python3', ['-m', 'http.server', String(PUERTO + 3), '--bind', '127.0.0.1'], { cwd: dir, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 800));
  return { base: `http://127.0.0.1:${PUERTO + 3}`, cerrar: () => proc.kill() };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [video, ...resto] = process.argv.slice(2);
  const i = resto.indexOf('--chica');
  // --rapido: sin esperar la voz y con captura al final de cada escena (para depurar las acciones)
  await grabar(video, { chica: i >= 0 ? resto[i + 1] : undefined, rapido: resto.includes('--rapido') });
  process.exit(0);
}
