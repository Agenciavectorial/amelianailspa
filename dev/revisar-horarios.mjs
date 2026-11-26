// Prueba de Horarios del mes en iPhone y computador: elegir por rango, atajos, columnas, intervalo de fechas,
// que elegir NO recargue la pantalla, y que al aplicar se guarde.   node dev/revisar-horarios.mjs
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { levantar, datosDemo } from './servidor.mjs';
const { chromium, devices } = createRequire(import.meta.url)('playwright');

const SALIDA = 'dev/test-results/revision/';
mkdirSync(SALIDA, { recursive: true });
const srv = await levantar({ puerto: 8797, estado: 'dev/.estado-horarios' });
const { pinErika } = await datosDemo(srv.base);
const b = await chromium.launch();
const fallas = [];
const ok = (n, c, msg) => { if (!c) fallas.push(`${n}: ${msg}`); };
for (const [n, opc] of [['iphone', { ...devices['iPhone 13'] }], ['pc', { viewport: { width: 1366, height: 768 } }]]) {
  const ctx = await b.newContext(opc);
  await ctx.addInitScript(() => { try { localStorage.setItem('amelia_tour_omitir', '1'); } catch { /* nada */ } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => fallas.push(`${n}: ${e.message}`));
  let pedidos = 0;
  p.on('request', (r) => { if (r.url().includes('/api/panel/horario-mes')) pedidos++; });
  await p.goto(`${srv.base}/panel/`, { waitUntil: 'networkidle' });
  await p.click('.persona >> text=Erika');
  for (const d of pinErika) await p.click(`.tecla[data-n="${d}"]`);
  await p.click('#entrar');
  await p.waitForSelector('.stats');
  await p.goto(`${srv.base}/panel/#/horarios`);
  await p.waitForSelector('.cal-horario');
  if (n === 'pc') { await p.click('[data-chica] >> nth=1'); await p.waitForTimeout(800); }
  await p.click('[data-mes="1"]'); // mes siguiente (días futuros completos)
  await p.waitForTimeout(800);
  const elegidos = () => p.$$eval('.ch-dia.elegido', (x) => x.length);
  const antes = pedidos;
  // Rango: del 3 al 12
  await p.click('#porRango');
  const dia = (k) => p.locator('.ch-dia b', { hasText: new RegExp(`^${k}$`) }).locator('..');
  await dia(3).click();
  await dia(12).click();
  const abiertos = await p.$$eval('.ch-dia:not([disabled])', (x) => x.map((d) => Number(d.querySelector('b').textContent)).filter((k) => k >= 3 && k <= 12).length);
  ok(n, (await elegidos()) === abiertos, `rango 3-12 eligió ${await elegidos()} y debía ${abiertos}`);
  ok(n, pedidos === antes, 'elegir días no debe recargar desde el servidor');
  ok(n, !(await p.isHidden('#panelAplicar')), 'el panel de aplicar debe aparecer');
  await p.screenshot({ path: `${SALIDA}${n}-horarios-rango.png`, fullPage: n === 'iphone' });
  // Quitar y usar atajo Lun a Vie
  await p.click('#quitarSel');
  ok(n, (await elegidos()) === 0, 'quitar selección');
  await p.click('#porRango'); // apagar rango
  await p.click('[data-atajo="semana"]');
  const lv = await p.$$eval('.ch-dia.elegido', (x) => x.length);
  ok(n, lv >= 18 && lv <= 23, `Lun a Vie eligió ${lv}`);
  // Tocar un día suelto lo quita
  const primero = p.locator('.ch-dia.elegido').first();
  await primero.click();
  ok(n, (await elegidos()) === lv - 1, 'tocar un día lo quita');
  // Aplicar: trabaja 14:00-18:00 (cada perfil usa una chica distinta: la base es la misma)
  await p.fill('#hAbre', '14:00'); await p.fill('#hCierra', '18:00');
  await p.click('#aplicar');
  await p.waitForTimeout(1200);
  const propios = await p.$$eval('.ch-dia .punto-propio', (x) => x.length);
  ok(n, propios === lv - 1, `se guardaron ${propios} y debían ${lv - 1}`);
  // Intervalo de fechas con días de la semana (solo sábados del intervalo)
  await p.click('.intervalo-fechas summary');
  const mes = await p.inputValue('#saltoMes');
  await p.fill('#intDesde', `${mes}-01`); await p.fill('#intHasta', `${mes}-28`);
  for (const ds of ['1', '2', '3', '4', '5', '0']) await p.uncheck(`.dias-intervalo input[value="${ds}"]`);
  await p.click('#elegirIntervalo');
  await p.waitForTimeout(300);
  const sab = await elegidos();
  ok(n, sab >= 3 && sab <= 4, `intervalo solo sábados eligió ${sab}`);
  await p.click('[data-modo-h="libre"]');
  await p.click('#aplicar');
  await p.waitForTimeout(1200);
  const libres = await p.$$eval('.ch-dia.libre .punto-propio', (x) => x.length);
  ok(n, libres === sab, `sábados libres guardados ${libres} de ${sab}`);
  const w = await p.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  ok(n, w[0] <= w[1], `desborde ${w}`);
  await p.screenshot({ path: `${SALIDA}${n}-horarios-aplicado.png`, fullPage: n === 'iphone' });
  await ctx.close();
}
await b.close();
srv.cerrar();
console.log(fallas.length ? 'FALLAS:\n- ' + fallas.join('\n- ') : 'Horarios OK: rango, atajos, día suelto, intervalo con días de la semana y aplicar, sin recargar al elegir.');
process.exit(fallas.length ? 1 : 0);
