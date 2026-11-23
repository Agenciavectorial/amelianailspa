// Copia los videos armados a public/capacitacion/ y genera la página privada (noindex) con
// portadas, capítulos y marca de "visto" (se guarda en el celular de cada persona).
//   node dev/video/publicar.mjs
import { readFileSync, writeFileSync, copyFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..', '..');
const DEST = path.join(RAIZ, 'public', 'capacitacion');
const LIMITE_MB = 25;

const GRUPOS = [
  { titulo: 'Para Erika', nota: 'Tu panel de propietaria, parte por parte.', videos: [
    { id: 'erika', nombre: 'erika', titulo: 'Tu panel de Amelia', descripcion: 'Citas, cobros, clientas, servicios, equipo, horario, promociones, mensajes, clientas que vuelven e importar Kumbio.' },
  ] },
  { titulo: 'Para el equipo', nota: 'Cada una tiene su video con su nombre.', videos: ['Leidy', 'Karla', 'Julieth', 'Daily'].map((n) => ({
    id: `chicas-${n.toLowerCase()}`, nombre: `chicas-${n.toLowerCase()}`, titulo: `Video de ${n}`, descripcion: 'Entrar con el PIN, instalar la app, ver la agenda y las citas, bloquear un horario, activar avisos y escribirle a la clienta.',
  })) },
  { titulo: 'La página y la reserva', nota: 'Lo que cambió en amelianailspa.com y cómo reserva una clienta.', videos: [
    { id: 'pagina', nombre: 'pagina', titulo: 'Tu nueva página (celular)', descripcion: 'Antes y después, velocidad, menú del celular, Google, la reserva en línea y la app de tus clientas.' },
    { id: 'pagina-horizontal', nombre: 'pagina', sufijo: '-horizontal', horizontal: true, titulo: 'Tu nueva página (horizontal)', descripcion: 'La misma explicación, para verla en computador o televisor.' },
  ] },
];

const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

mkdirSync(path.join(DEST, 'videos'), { recursive: true });
const resumen = [];
for (const g of GRUPOS) {
  for (const v of g.videos) {
    const base = path.join(AQUI, 'salida', v.nombre, `${v.nombre}${v.sufijo || ''}`);
    if (!existsSync(`${base}.mp4`)) { v.falta = true; console.log(`(falta ${v.id})`); continue; }
    const info = JSON.parse(readFileSync(`${base}.json`, 'utf8'));
    const mb = statSync(`${base}.mp4`).size / 1048576;
    if (mb > LIMITE_MB) throw new Error(`${v.id} pesa ${mb.toFixed(1)} MB (límite ${LIMITE_MB} MB de Pages)`);
    copyFileSync(`${base}.mp4`, path.join(DEST, 'videos', `${v.id}.mp4`));
    copyFileSync(`${base}.jpg`, path.join(DEST, 'videos', `${v.id}.jpg`));
    Object.assign(v, { dur: info.dur, mb, capitulos: v.id === 'erika' ? info.capitulos.filter((c, i, a) => i === 0 || c.titulo !== a[i - 1].titulo) : [] });
    resumen.push(`${v.id}: ${mmss(info.dur)} · ${mb.toFixed(1)} MB`);
  }
}

const tarjeta = (v) => v.falta ? '' : `
  <article class="video${v.horizontal ? ' ancho' : ''}" data-id="${v.id}">
    <div class="marco"><video controls preload="none" playsinline poster="videos/${v.id}.jpg" src="videos/${v.id}.mp4"></video></div>
    <div class="info">
      <h3>${esc(v.titulo)} <span class="visto-chip" hidden>✓ Visto</span></h3>
      <p class="meta">${mmss(v.dur)} min · ${esc(v.descripcion)}</p>
      ${v.capitulos.length ? `<details><summary>Capítulos</summary><ol class="caps">${v.capitulos.map((c) => `<li><button type="button" data-t="${c.t.toFixed(1)}"><span>${mmss(c.t)}</span>${esc(c.titulo)}</button></li>`).join('')}</ol></details>` : ''}
      <label class="marcar"><input type="checkbox"> Ya lo vi</label>
    </div>
  </article>`;

const html = `<!doctype html>
<html lang="es-CO">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow, noarchive">
<title>Capacitación · Amelia Nail Spa</title>
<link rel="icon" href="/favicon.ico">
<style>
@font-face{font-family:'DM Sans';src:url('/fonts/dm-sans.woff2') format('woff2');font-weight:100 900;font-display:swap}
@font-face{font-family:'Playfair Display';src:url('/fonts/playfair-display.woff2') format('woff2');font-weight:400 900;font-display:swap}
@font-face{font-family:'Playfair Display';font-style:italic;src:url('/fonts/playfair-display-italic.woff2') format('woff2');font-weight:400 900;font-display:swap}
@font-face{font-family:'Great Vibes';src:url('/fonts/great-vibes.woff2') format('woff2');font-display:swap}
:root{--lila:#A98BBE;--morado:#7A6494;--fondo:#F7F4FA;--tinta:#2b2233;--suave:#6b6075}
*{box-sizing:border-box}
body{margin:0;font-family:'DM Sans',system-ui,sans-serif;color:var(--tinta);background:var(--fondo)}
header{text-align:center;padding:36px 16px 10px}
header img{width:84px;height:84px;border-radius:50%;box-shadow:0 8px 24px rgba(122,100,148,.25)}
.script{font-family:'Great Vibes',cursive;color:var(--morado);font-size:30px;display:block;margin-top:10px}
h1{font-family:'Playfair Display',serif;font-size:clamp(30px,6vw,44px);margin:0;line-height:1.1}
h1 em{color:var(--morado)}
.intro{color:var(--suave);max-width:560px;margin:12px auto 0;line-height:1.5}
.progreso{display:inline-block;margin-top:14px;background:#fff;border-radius:999px;padding:8px 16px;font-weight:600;color:var(--morado);box-shadow:0 4px 14px rgba(122,100,148,.12)}
main{max-width:1100px;margin:0 auto;padding:10px 16px 60px}
section{margin-top:34px}
h2{font-family:'Playfair Display',serif;font-size:28px;margin:0}
.nota{color:var(--suave);margin:4px 0 16px}
.rejilla{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:18px}
.video{background:#fff;border-radius:22px;overflow:hidden;box-shadow:0 8px 26px rgba(122,100,148,.12)}
.video.ancho{grid-column:1/-1}
.marco{background:#1d1822}
video{display:block;width:100%;aspect-ratio:9/16;object-fit:contain;background:#1d1822}
.ancho video{aspect-ratio:16/9}
.info{padding:14px 16px 16px}
h3{margin:0;font-size:18px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.visto-chip{font-size:12px;background:#e6f4ea;color:#2f7a4a;border-radius:999px;padding:3px 10px}
.meta{color:var(--suave);font-size:14px;line-height:1.45;margin:6px 0 10px}
details summary{cursor:pointer;color:var(--morado);font-weight:600;font-size:14px;margin-bottom:6px}
.caps{list-style:none;padding:0;margin:0 0 8px;columns:2;column-gap:12px}
.caps button{all:unset;cursor:pointer;display:flex;gap:8px;font-size:13px;padding:4px 0;color:var(--tinta)}
.caps button span{color:var(--morado);font-variant-numeric:tabular-nums;min-width:34px}
.marcar{display:flex;gap:8px;align-items:center;font-size:14px;color:var(--suave);cursor:pointer}
.marcar input{accent-color:var(--morado);width:18px;height:18px}
.video.visto{outline:3px solid #cfe9d8}
footer{text-align:center;color:var(--suave);font-size:13px;padding:0 16px 30px}
@media (max-width:520px){.caps{columns:1}.rejilla{grid-template-columns:1fr}}
</style>
</head>
<body>
<header>
  <img src="/icon-512.png" alt="Amelia Nail Spa" width="84" height="84">
  <span class="script">Capacitación</span>
  <h1>Así funciona <em>tu Amelia</em></h1>
  <p class="intro">Videos cortos para Erika y el equipo. Se ven mejor en el celular. Cuando termines uno, márcalo como visto.</p>
  <span class="progreso" id="progreso"></span>
</header>
<main>
${GRUPOS.map((g) => `<section><h2>${esc(g.titulo)}</h2><p class="nota">${esc(g.nota)}</p><div class="rejilla">${g.videos.map(tarjeta).join('')}</div></section>`).join('\n')}
</main>
<footer>Amelia Nail Spa · C.C. Bosque Plaza, Aranjuez, Medellín · Página privada, no aparece en Google.</footer>
<script>
(function () {
  var CLAVE = 'amelia-capacitacion-vistos';
  var vistos = {};
  try { vistos = JSON.parse(localStorage.getItem(CLAVE) || '{}'); } catch (e) {}
  var guardar = function () { try { localStorage.setItem(CLAVE, JSON.stringify(vistos)); } catch (e) {} };
  var tarjetas = Array.prototype.slice.call(document.querySelectorAll('.video'));
  function pintar() {
    var n = 0;
    tarjetas.forEach(function (t) {
      var v = !!vistos[t.dataset.id];
      if (v) n++;
      t.classList.toggle('visto', v);
      t.querySelector('.visto-chip').hidden = !v;
      t.querySelector('.marcar input').checked = v;
    });
    document.getElementById('progreso').textContent = n + ' de ' + tarjetas.length + ' videos vistos';
  }
  tarjetas.forEach(function (t) {
    var video = t.querySelector('video');
    t.querySelector('.marcar input').addEventListener('change', function (e) { vistos[t.dataset.id] = e.target.checked; guardar(); pintar(); });
    video.addEventListener('timeupdate', function () {
      if (!vistos[t.dataset.id] && video.duration && video.currentTime / video.duration > 0.9) { vistos[t.dataset.id] = true; guardar(); pintar(); }
    });
    video.addEventListener('play', function () { tarjetas.forEach(function (o) { var ov = o.querySelector('video'); if (ov !== video) ov.pause(); }); });
    Array.prototype.forEach.call(t.querySelectorAll('[data-t]'), function (b) {
      b.addEventListener('click', function () { video.preload = 'auto'; video.currentTime = Number(b.dataset.t); video.play(); video.scrollIntoView({ behavior: 'smooth', block: 'center' }); });
    });
  });
  pintar();
})();
</script>
</body>
</html>
`;
writeFileSync(path.join(DEST, 'index.html'), html);

// robots.txt: que Google no entre a /capacitacion/
const robots = path.join(RAIZ, 'public', 'robots.txt');
const r = readFileSync(robots, 'utf8');
if (!r.includes('Disallow: /capacitacion/')) writeFileSync(robots, r.replace('Disallow: /reservar/cita/', 'Disallow: /reservar/cita/\nDisallow: /capacitacion/'));
console.log(resumen.join('\n'));
