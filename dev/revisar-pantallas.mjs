// Revisión visual de todas las pantallas en iPhone (390 px), computador (1366 px) y computador con zoom
// del navegador al 125 % y 150 %: sin scroll horizontal, campos de 16 px o más en celular (iPhone no hace zoom)
// y sin errores de JavaScript. Deja capturas en dev/test-results/revision/.
//   node dev/revisar-pantallas.mjs
import { createRequire } from 'node:module';
const { chromium, devices } = createRequire(import.meta.url)('playwright');
import { mkdirSync } from 'node:fs';
import { levantar, datosDemo } from './servidor.mjs';

const SALIDA = 'dev/test-results/revision/';
mkdirSync(SALIDA, { recursive: true });
const srv = await levantar({ puerto: 8794, estado: 'dev/.estado-revision', variables: { LIMITE_RESERVAS_HORA: 500 } });
const { pinErika, pinChicas } = await datosDemo(srv.base);
const b = await chromium.launch();
const problemas = [];

const PERFILES = [
  ['iphone', { ...devices['iPhone 13'], viewport: { width: 390, height: 844 } }],
  ['pc', { viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 }],
  // Zoom del navegador: 1366 px físicos se ven como 1093 (125 %) o 911 (150 %) px de CSS.
  ['pc125', { viewport: { width: 1093, height: 614 }, deviceScaleFactor: 1.25 }],
  ['pc150', { viewport: { width: 911, height: 512 }, deviceScaleFactor: 1.5 }],
];

async function revisar(p, donde, movil) {
  await p.waitForTimeout(450);
  const r = await p.evaluate((movil) => {
    const ancho = document.documentElement.clientWidth;
    const w = document.documentElement.scrollWidth;
    const culpables = w > ancho ? [...document.querySelectorAll('body *')].filter((e) => e.getBoundingClientRect().right > ancho + 1 && getComputedStyle(e).position !== 'fixed')
      .filter((e) => !e.closest('.columnas-cuentas, .segmentado, .pestanas, .categorias, .promos, .populares, .combos, .filtro-etiquetas, .agenda-marco, .tira-dias, .chips-serv, .ag-grilla, .tabla-previa, .lista-reservas'))
      .slice(0, 4).map((e) => e.tagName.toLowerCase() + '.' + [...e.classList].join('.')) : [];
    const chicos = movil ? [...document.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=color]):not(.sr), select, textarea')]
      .filter((e) => e.offsetParent && parseFloat(getComputedStyle(e).fontSize) < 16).map((e) => (e.name || e.id || e.className) + ':' + getComputedStyle(e).fontSize) : [];
    return { w, ancho, culpables, chicos };
  }, movil);
  if (r.w > r.ancho) problemas.push(`${donde}: ancho ${r.w} > ${r.ancho} (${r.culpables.join(', ')})`);
  if (r.chicos.length) problemas.push(`${donde}: campos con letra < 16 px (iPhone hace zoom): ${r.chicos.join(', ')}`);
}

for (const [nombre, ctxOpc] of PERFILES) {
  const movil = nombre === 'iphone';
  const ctx = await b.newContext(ctxOpc);
  await ctx.addInitScript(() => { try { localStorage.setItem('amelia_tour_omitir', '1'); } catch { /* nada */ } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => problemas.push(`${nombre} error JS: ${e.message}`));
  // Reserva (clienta)
  await p.goto(`${srv.base}/reservar/`, { waitUntil: 'networkidle' });
  await revisar(p, `${nombre} /reservar`, movil);
  await p.screenshot({ path: `${SALIDA}${nombre}-reservar.png`, fullPage: movil });
  if (movil) {
    // Guía de instalar la app (en celular aparece sola al abrir; aquí se pide con ?guia=1)
    const ig = await b.newContext({ ...devices['iPhone 13'] });
    const pi = await ig.newPage();
    await pi.goto(`${srv.base}/reservar/?guia=1`, { waitUntil: 'networkidle' });
    await pi.waitForSelector('.instalar-guia.abierta', { timeout: 6000 }).catch(() => problemas.push('la guía de instalar no apareció en iPhone'));
    await pi.screenshot({ path: `${SALIDA}iphone-guia-instalar.png` });
    await pi.click('.ig-ya').catch(() => {});
    await pi.reload({ waitUntil: 'networkidle' });
    await pi.waitForTimeout(3200);
    if (await pi.$('.instalar-guia')) problemas.push('la guía volvió a salir después de "Ya la instalé"');
    await ig.close();
    // Combo con enlace directo
    await p.goto(`${srv.base}/reservar/`, { waitUntil: 'networkidle' });
    await p.click('[data-combo]');
    await p.waitForTimeout(600);
    await p.screenshot({ path: `${SALIDA}iphone-combo-elegido.png` });
  }
  // Panel de Erika
  await p.goto(`${srv.base}/panel/`, { waitUntil: 'networkidle' });
  await p.click('.persona >> text=Erika');
  for (const d of pinErika) await p.click(`.tecla[data-n="${d}"]`);
  await p.click('#entrar');
  await p.waitForSelector('.stats .stat:not(.esqueleto)');
  for (const sec of ['inicio', 'cuentas', 'clientas', 'servicios', 'promociones', 'seguridad', 'ajustes', 'cuenta', 'equipo', 'agenda']) {
    await p.goto(`${srv.base}/panel/#/${sec}`);
    await p.waitForTimeout(700);
    await revisar(p, `${nombre} erika #/${sec}`, movil);
    await p.screenshot({ path: `${SALIDA}${nombre}-erika-${sec}.png`, fullPage: movil });
  }
  // Pestañas de Cuentas
  await p.goto(`${srv.base}/panel/#/cuentas`);
  for (const t of ['movimientos', 'gastos', 'comisiones', 'metas', 'deudas']) {
    await p.click(`[data-pest="${t}"]`);
    await p.waitForTimeout(700);
    await revisar(p, `${nombre} cuentas/${t}`, movil);
    await p.screenshot({ path: `${SALIDA}${nombre}-cuentas-${t}.png`, fullPage: movil });
  }
  await p.click('[data-pest="resumen"]');
  if (movil) {
    // Hojas: venta, gasto, cliente
    await p.goto(`${srv.base}/panel/#/cuentas`); await p.waitForTimeout(600);
    await p.click('#nuevaVenta'); await p.waitForSelector('#formVenta');
    await revisar(p, 'iphone hoja venta', true); await p.screenshot({ path: `${SALIDA}iphone-hoja-venta.png` });
    await p.keyboard.press('Escape');
    await p.goto(`${srv.base}/panel/#/clientas`); await p.waitForSelector('.fila-clienta');
    await p.click('.fila-clienta'); await p.waitForSelector('#formClienta');
    await revisar(p, 'iphone hoja clienta', true); await p.screenshot({ path: `${SALIDA}iphone-hoja-clienta.png`, fullPage: false });
    await p.keyboard.press('Escape');
    // Tema oscuro con el botón junto al logo
    await p.goto(`${srv.base}/panel/#/inicio`); await p.waitForTimeout(800);
    for (let i = 0; i < 4; i++) await p.click('.cabeza-vista [data-tema-btn]');
    await p.waitForTimeout(300);
    if (await p.evaluate(() => document.documentElement.dataset.tema) !== 'oscuro') problemas.push('el botón de tema no llega al modo oscuro');
    await p.screenshot({ path: `${SALIDA}iphone-tema-oscuro.png` });
    await p.click('.cabeza-vista [data-tema-btn]');
  }
  // Colaboradora: solo lo suyo
  const c2 = await b.newContext(ctxOpc);
  await c2.addInitScript(() => { try { localStorage.setItem('amelia_tour_omitir', '1'); } catch { /* nada */ } });
  const k = await c2.newPage();
  k.on('pageerror', (e) => problemas.push(`${nombre} colaboradora error JS: ${e.message}`));
  await k.goto(`${srv.base}/panel/`, { waitUntil: 'networkidle' });
  await k.click('.persona >> text=Leidy');
  for (const d of pinChicas) await k.click(`.tecla[data-n="${d}"]`);
  await k.click('#entrar');
  await k.waitForSelector('.stats .stat:not(.esqueleto)');
  for (const sec of ['inicio', 'cuentas', 'cuenta']) {
    await k.goto(`${srv.base}/panel/#/${sec}`); await k.waitForTimeout(700);
    await revisar(k, `${nombre} leidy #/${sec}`, movil);
    await k.screenshot({ path: `${SALIDA}${nombre}-leidy-${sec}.png`, fullPage: movil });
  }
  if (await k.$('[data-pest="gastos"]')) problemas.push('la colaboradora ve la pestaña de gastos');
  await c2.close();
  await ctx.close();
}
await b.close();
srv.cerrar();
console.log(problemas.length ? 'PROBLEMAS:\n- ' + problemas.join('\n- ') : 'Todo bien: sin desbordes, campos ≥ 16 px y sin errores.');
process.exit(problemas.length ? 1 : 0);
