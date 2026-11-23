// Arma el video final: cortinilla de inicio + pantalla grabada dentro de un celular con encabezado,
// subtítulos quemados y voz + cortinilla de cierre. H.264 / AAC, pensado para pesar < 25 MB.
//   node dev/video/armar.mjs <erika|chicas|pagina> [--chica Leidy] [--horizontal] [--borrador]
// Lee dev/video/salida/<nombre>/pantalla.mp4 y tiempos.json (de grabar.mjs).
// Escribe dev/video/salida/<nombre>/<nombre>[-horizontal].mp4 y su portada .jpg
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { cargarGuion } from './voz.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..', '..');
const PUB = (f) => pathToFileURL(path.join(RAIZ, 'public', f)).href;
const FPS = 30;

export const COLORES = { lila: '#A98BBE', morado: '#7A6494', fondo: '#F7F4FA', tinta: '#2b2233', suave: '#6b6075' };

const CSS_BASE = `
@font-face{font-family:'DM Sans';src:url('${PUB('fonts/dm-sans.woff2')}') format('woff2');font-weight:100 900}
@font-face{font-family:'Playfair Display';src:url('${PUB('fonts/playfair-display.woff2')}') format('woff2');font-weight:400 900}
@font-face{font-family:'Playfair Display';font-style:italic;src:url('${PUB('fonts/playfair-display-italic.woff2')}') format('woff2');font-weight:400 900}
@font-face{font-family:'Great Vibes';src:url('${PUB('fonts/great-vibes.woff2')}') format('woff2')}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:100%;height:100%;background:transparent;overflow:hidden}
body{font-family:'DM Sans',sans-serif;color:${COLORES.tinta}}
.script{font-family:'Great Vibes',cursive;color:${COLORES.morado}}
.serif{font-family:'Playfair Display',serif}
em{font-family:'Playfair Display',serif;font-style:italic;color:${COLORES.morado};font-weight:500}
.logo{border-radius:50%;box-shadow:0 10px 30px rgba(122,100,148,.25)}
`;

/** Geometría según el formato. */
export function diseno(horizontal) {
  if (!horizontal) {
    const ancho = 640, alto = Math.round(ancho * 1688 / 780);
    return { W: 1080, H: 1920, tel: { x: (1080 - ancho) / 2, y: 236, ancho, alto, marco: 14, radio: 62 } };
  }
  const alto = 930, ancho = Math.round(alto * 780 / 1688);
  return { W: 1920, H: 1080, tel: { x: 250, y: 75, ancho, alto, marco: 12, radio: 52 } };
}

function htmlFondo(g, horizontal) {
  return `<style>${CSS_BASE}
  body{background:radial-gradient(1200px 900px at 15% 0%,#ffffff 0%,${COLORES.fondo} 55%,#EEE6F4 100%)}
  .o{position:absolute;border-radius:50%;filter:blur(2px)}
  </style>
  <div class="o" style="width:620px;height:620px;left:-260px;top:${horizontal ? 520 : 1300}px;background:radial-gradient(circle,rgba(169,139,190,.28),transparent 70%)"></div>
  <div class="o" style="width:700px;height:700px;right:-300px;top:-200px;background:radial-gradient(circle,rgba(169,139,190,.22),transparent 70%)"></div>
  <div style="position:absolute;left:${g.tel.x - g.tel.marco}px;top:${g.tel.y - g.tel.marco}px;width:${g.tel.ancho + 2 * g.tel.marco}px;height:${g.tel.alto + 2 * g.tel.marco}px;border-radius:${g.tel.radio}px;box-shadow:0 40px 90px rgba(60,30,90,.30),0 8px 24px rgba(60,30,90,.18);background:#1d1822"></div>`;
}

/** Capa superior (transparente) con marco del celular, encabezado y subtítulo. */
function htmlCapa(g, horizontal, { capitulo, sub, marca }) {
  const t = g.tel;
  const marco = `<div style="position:absolute;left:${t.x - t.marco}px;top:${t.y - t.marco}px;width:${t.ancho + 2 * t.marco}px;height:${t.alto + 2 * t.marco}px;border:${t.marco}px solid #1d1822;border-radius:${t.radio}px"></div>`;
  if (!horizontal) {
    return `<style>${CSS_BASE}
      .cab{position:absolute;left:0;right:0;top:44px;display:flex;align-items:center;gap:22px;padding:0 70px}
      .cab .t{display:flex;flex-direction:column}
      .cab .m{font-size:30px;letter-spacing:.14em;text-transform:uppercase;color:${COLORES.suave};font-weight:600}
      .cab .c{font-family:'Playfair Display',serif;font-size:50px;font-weight:600;line-height:1.1;margin-top:4px}
      .sub{position:absolute;left:44px;right:44px;bottom:42px;min-height:200px;display:flex;align-items:center;justify-content:center;text-align:center;
        background:rgba(255,255,255,.96);border-radius:34px;padding:22px 34px;box-shadow:0 16px 44px rgba(60,30,90,.16);
        font-size:47px;line-height:1.28;font-weight:600;color:${COLORES.tinta};border-bottom:6px solid ${COLORES.lila}}
    </style>${marco}
    <div class="cab"><img class="logo" src="${PUB('icon-512.png')}" width="120" height="120"><div class="t"><span class="m">${marca}</span><span class="c">${capitulo || ''}</span></div></div>
    ${sub ? `<div class="sub">${sub}</div>` : ''}`;
  }
  return `<style>${CSS_BASE}
    .der{position:absolute;left:880px;right:110px;top:110px;bottom:90px;display:flex;flex-direction:column}
    .m{display:flex;align-items:center;gap:20px;font-size:26px;letter-spacing:.14em;text-transform:uppercase;color:${COLORES.suave};font-weight:600}
    .c{font-family:'Playfair Display',serif;font-size:72px;font-weight:600;line-height:1.08;margin-top:46px}
    .sub{margin-top:auto;background:rgba(255,255,255,.96);border-radius:30px;padding:30px 38px;box-shadow:0 16px 44px rgba(60,30,90,.14);
      font-size:44px;line-height:1.3;font-weight:600;border-left:8px solid ${COLORES.lila};min-height:220px;display:flex;align-items:center}
  </style>${marco}
  <div class="der"><div class="m"><img class="logo" src="${PUB('icon-512.png')}" width="96" height="96">${marca}</div>
  <div class="c">${capitulo || ''}</div>${sub ? `<div class="sub">${sub}</div>` : ''}</div>`;
}

/** Cortinilla animada (inicio o cierre). La animación se controla por tiempo para capturar cuadro a cuadro. */
function htmlCortinilla(g, horizontal, { tipo, titulo, subtitulo, para, foto }) {
  const grande = horizontal ? 1 : 1.15;
  const inicio = tipo === 'inicio';
  return `<style>${CSS_BASE}
    body{background:radial-gradient(1400px 1000px at 50% 30%,#ffffff 0%,${COLORES.fondo} 50%,#E9DFF1 100%);display:grid;place-items:center;text-align:center}
    .c{display:flex;flex-direction:column;align-items:center;gap:${18 * grande}px}
    .a{opacity:0;animation:entra .9s cubic-bezier(.2,.8,.2,1) forwards}
    @keyframes entra{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:none}}
    @keyframes aro{from{transform:scale(.6);opacity:0}to{transform:scale(1);opacity:1}}
    .aro{position:absolute;width:${900 * grande}px;height:${900 * grande}px;border-radius:50%;border:2px solid rgba(169,139,190,.35);animation:aro 1.6s ease-out forwards}
    .aro.b{width:${1250 * grande}px;height:${1250 * grande}px;border-color:rgba(169,139,190,.18);animation-duration:2.2s}
    .script{font-size:${84 * grande}px;line-height:1}
    h1{font-family:'Playfair Display',serif;font-size:${104 * grande}px;font-weight:600;line-height:1.05;max-width:${horizontal ? 1500 : 900}px}
    p{font-size:${40 * grande}px;color:${COLORES.suave};font-weight:500;max-width:${horizontal ? 1300 : 860}px;line-height:1.35}
    .pie{position:absolute;bottom:${horizontal ? 60 : 110}px;left:0;right:0;font-size:${30 * grande}px;letter-spacing:.12em;text-transform:uppercase;color:${COLORES.suave}}
    .foto{width:${230 * grande}px;height:${230 * grande}px;border-radius:50%;object-fit:cover;object-position:top;border:8px solid #fff;box-shadow:0 18px 44px rgba(60,30,90,.25)}
  </style>
  <div class="aro"></div><div class="aro b"></div>
  <div class="c">
    ${foto ? `<img class="foto a" style="animation-delay:.1s" src="${foto}">` : `<img class="logo a" style="animation-delay:.1s" src="${PUB('icon-512.png')}" width="${260 * grande}" height="${260 * grande}">`}
    ${inicio ? `
      <span class="script a" style="animation-delay:.45s">${para || 'Amelia Nail Spa'}</span>
      <h1 class="a" style="animation-delay:.7s">${titulo}</h1>
      <p class="a" style="animation-delay:1s">${subtitulo}</p>` : `
      <span class="script a" style="animation-delay:.4s">¡Gracias!</span>
      <h1 class="a" style="animation-delay:.65s">Amelia <em>Nail Spa</em></h1>
      <p class="a" style="animation-delay:.95s">amelianailspa.com</p>`}
  </div>
  <div class="pie a" style="animation-delay:1.2s">C.C. Bosque Plaza · Aranjuez, Medellín</div>`;
}

/** Parte el texto de una escena en subtítulos cortos (≤ maxCar), cortando en puntuación. */
export function partirSubtitulos(texto, maxCar = 78) {
  const frases = texto.replace(/\s+/g, ' ').match(/[^.!?…:;]+[.!?…:;]*\s*/g) || [texto];
  const out = [];
  for (let f of frases) {
    f = f.trim();
    while (f.length > maxCar) {
      // cortar en la coma más cercana a la mitad, o en un espacio
      const objetivo = Math.min(maxCar, Math.ceil(f.length / Math.ceil(f.length / maxCar)));
      let corte = -1;
      for (let d = 0; d < 30 && corte < 0; d++) {
        for (const i of [objetivo - d, objetivo + d]) if (i > 15 && i < f.length - 10 && i <= maxCar && /[,]/.test(f[i])) { corte = i + 1; break; }
      }
      if (corte < 0) corte = f.lastIndexOf(' ', objetivo);
      out.push(f.slice(0, corte).trim());
      f = f.slice(corte).trim();
    }
    if (f) {
      const ult = out[out.length - 1];
      if (ult && ult.length + f.length + 1 <= 40) out[out.length - 1] = `${ult} ${f}`; else out.push(f);
    }
  }
  return out;
}
const sinMuletillas = (t) => t.replace(/amelianailspa punto com, barra panel/gi, 'amelianailspa.com/panel').replace(/amelianailspa punto com/gi, 'amelianailspa.com');

// Las páginas se abren desde un archivo (file://) para que carguen fuentes y logo locales.
async function abrir(p, html, archivo) {
  const f = archivo.replace(/\.png$/, '') + '.html';
  writeFileSync(f, `<!doctype html><meta charset="utf-8">${html}`);
  await p.goto(pathToFileURL(f).href, { waitUntil: 'load' });
}
async function capturar(navegador, g, html, archivo, transparente = true) {
  const p = await navegador.newPage({ viewport: { width: g.W, height: g.H } });
  await abrir(p, html, archivo);
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: archivo, omitBackground: transparente });
  await p.close();
}

async function cuadrosCortinilla(navegador, g, html, dir, segundos) {
  mkdirSync(dir, { recursive: true });
  const p = await navegador.newPage({ viewport: { width: g.W, height: g.H } });
  await abrir(p, html, path.join(dir, 'pagina.png'));
  await p.evaluate(() => document.fonts.ready);
  await p.evaluate(() => document.getAnimations().forEach((a) => a.pause()));
  const n = Math.round(segundos * FPS);
  for (let i = 0; i < n; i++) {
    await p.evaluate((t) => document.getAnimations().forEach((a) => { a.currentTime = t; }), (i / FPS) * 1000);
    await p.screenshot({ path: path.join(dir, `${String(i).padStart(4, '0')}.png`) });
  }
  await p.close();
}

const ff = (args) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: ['ignore', 'inherit', 'inherit'] });

export async function armar(video, { chica, horizontal = false, borrador = false } = {}) {
  const guion = await cargarGuion(video);
  const nombre = chica ? `${video}-${chica.toLowerCase()}` : video;
  const dir = path.join(AQUI, 'salida', nombre);
  const t = JSON.parse(readFileSync(path.join(dir, 'tiempos.json'), 'utf8'));
  const g = diseno(horizontal);
  const sufijo = horizontal ? '-horizontal' : '';
  const tmp = path.join(dir, `tmp${sufijo}`);
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  const marca = 'Amelia Nail Spa';
  const titulo = guion.titulo;
  const subtitulo = chica ? 'Tu panel de colaboradora, paso a paso' : guion.subtitulo;
  const para = chica ? `Para ${chica}` : (video === 'pagina' ? 'Para Erika' : 'Para Erika');
  const foto = chica ? PUB(`img/${chica.toLowerCase()}-600.webp`) : null;

  // 1) Imágenes: fondo, capas por subtítulo y cortinillas
  const navegador = await chromium.launch();
  await capturar(navegador, g, htmlFondo(g, horizontal), path.join(tmp, 'fondo.png'), false);
  const capas = []; // { archivo, ini, fin }
  let k = 0;
  const pintar = async (capitulo, sub, ini, fin) => {
    const f = path.join(tmp, `capa-${String(k++).padStart(3, '0')}.png`);
    await capturar(navegador, g, htmlCapa(g, horizontal, { capitulo, sub, marca }), f);
    capas.push({ archivo: f, ini, fin });
  };
  let cursor = 0;
  for (const e of t.escenas) {
    const partes = partirSubtitulos(sinMuletillas(e.texto), horizontal ? 90 : 78);
    const total = partes.reduce((a, p) => a + p.length, 0);
    const vozFin = e.ini + e.voz;
    let ini = e.ini;
    if (ini > cursor) await pintar(e.capitulo, '', cursor, ini);
    for (const [i, p] of partes.entries()) {
      const fin = i === partes.length - 1 ? vozFin : ini + (p.length / total) * e.voz;
      await pintar(e.capitulo, p, ini, fin);
      ini = fin;
    }
    const finEscena = Math.min(e.fin, t.total);
    if (finEscena > vozFin) await pintar(e.capitulo, '', vozFin, finEscena);
    cursor = finEscena;
  }
  if (cursor < t.total) capas.push({ ...capas[capas.length - 1], ini: cursor, fin: t.total });
  const DUR_INI = 3.4, DUR_FIN = 3.2;
  await cuadrosCortinilla(navegador, g, htmlCortinilla(g, horizontal, { tipo: 'inicio', titulo, subtitulo, para, foto }), path.join(tmp, 'inicio'), DUR_INI);
  await cuadrosCortinilla(navegador, g, htmlCortinilla(g, horizontal, { tipo: 'cierre' }), path.join(tmp, 'cierre'), DUR_FIN);
  await navegador.close();

  // 2) Lista de capas (concat con duraciones)
  const lineas = ['ffconcat version 1.0'];
  for (const c of capas) lineas.push(`file '${c.archivo}'`, `duration ${(c.fin - c.ini).toFixed(4)}`);
  lineas.push(`file '${capas[capas.length - 1].archivo}'`);
  writeFileSync(path.join(tmp, 'capas.txt'), lineas.join('\n'));

  // 3) Parte central: fondo + pantalla escalada + capas
  const centro = path.join(tmp, 'centro.mp4');
  const { x, y, ancho, alto } = g.tel;
  ff(['-loop', '1', '-framerate', String(FPS), '-i', path.join(tmp, 'fondo.png'),
    '-i', path.join(dir, 'pantalla.mp4'),
    '-f', 'concat', '-safe', '0', '-i', path.join(tmp, 'capas.txt'),
    '-filter_complex',
    `[1:v]scale=${ancho}:${alto}:flags=lanczos,setsar=1[p];[0:v][p]overlay=${x}:${y}:shortest=1[a];` +
    `[2:v]fps=${FPS},format=rgba[c];[a][c]overlay=0:0:eof_action=repeat,format=yuv420p[v]`,
    '-map', '[v]', '-t', t.total.toFixed(3), '-r', String(FPS), '-c:v', 'libx264', '-preset', borrador ? 'veryfast' : 'medium', '-crf', '16', centro]);

  // 4) Voz: cada audio en el inicio de su escena
  const conAudio = t.escenas.filter((e) => e.audio && existsSync(e.audio));
  const voz = path.join(tmp, 'voz.wav');
  if (conAudio.length) {
    const ent = conAudio.flatMap((e) => ['-i', e.audio]);
    const filtros = conAudio.map((e, i) => `[${i}:a]aresample=48000,adelay=${Math.round(e.ini * 1000)}:all=1[a${i}]`).join(';');
    ff([...ent, '-filter_complex', `${filtros};${conAudio.map((_, i) => `[a${i}]`).join('')}amix=inputs=${conAudio.length}:normalize=0:dropout_transition=0,apad,atrim=0:${t.total.toFixed(3)},loudnorm=I=-16:TP=-1.5:LRA=11[s]`,
      '-map', '[s]', '-ar', '48000', '-ac', '1', voz]);
  } else {
    ff(['-f', 'lavfi', '-i', `anullsrc=r=48000:cl=mono`, '-t', t.total.toFixed(3), voz]);
  }

  // 5) Unir: cortinilla de inicio + centro (con voz) + cierre, con fundidos suaves
  const salida = path.join(dir, `${nombre}${sufijo}.mp4`);
  const F = 0.45;
  ff(['-framerate', String(FPS), '-i', path.join(tmp, 'inicio', '%04d.png'),
    '-i', centro, '-i', voz,
    '-framerate', String(FPS), '-i', path.join(tmp, 'cierre', '%04d.png'),
    '-filter_complex',
    `[0:v]format=yuv420p,setsar=1,fps=${FPS}[i];[1:v]setsar=1,fps=${FPS}[c];[3:v]format=yuv420p,setsar=1,fps=${FPS}[f];` +
    `[i][c]xfade=transition=fade:duration=${F}:offset=${(DUR_INI - F).toFixed(3)}[ic];` +
    `[ic][f]xfade=transition=fade:duration=${F}:offset=${(DUR_INI - F + t.total - F).toFixed(3)},format=yuv420p[v];` +
    `[2:a]adelay=${Math.round((DUR_INI - F) * 1000)}:all=1,apad=pad_dur=${DUR_FIN + 1},afade=t=out:st=${(DUR_INI - F + t.total + DUR_FIN - F - 0.8).toFixed(2)}:d=0.8[a]`,
    '-map', '[v]', '-map', '[a]', '-t', (DUR_INI + t.total + DUR_FIN - 2 * F).toFixed(3),
    '-c:v', 'libx264', '-preset', borrador ? 'veryfast' : 'slow', '-crf', horizontal ? '24' : '25', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', salida]);

  // 6) Portada (cuadro de la cortinilla de inicio ya completa)
  const portada = path.join(dir, `${nombre}${sufijo}.jpg`);
  ff(['-i', path.join(tmp, 'inicio', `${String(Math.round(DUR_INI * FPS) - 1).padStart(4, '0')}.png`), '-vf', `scale=${horizontal ? 960 : 540}:-2`, '-q:v', '4', portada]);
  if (!borrador) rmSync(tmp, { recursive: true, force: true });
  const dur = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', salida]).toString());
  const mb = Number(execFileSync('du', ['-k', salida]).toString().split('\t')[0]) / 1024;
  console.log(`Video: ${path.relative(process.cwd(), salida)} · ${Math.floor(dur / 60)}:${String(Math.round(dur % 60)).padStart(2, '0')} · ${mb.toFixed(1)} MB`);
  return { salida, portada, dur, mb, capitulos: t.escenas.map((e) => ({ titulo: e.capitulo, t: e.ini + DUR_INI - F })) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [video, ...resto] = process.argv.slice(2);
  const i = resto.indexOf('--chica');
  const r = await armar(video, { chica: i >= 0 ? resto[i + 1] : undefined, horizontal: resto.includes('--horizontal'), borrador: resto.includes('--borrador') });
  writeFileSync(r.salida.replace(/\.mp4$/, '.json'), JSON.stringify(r, null, 2));
}
