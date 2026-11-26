// Prueba rápida de Cuentas: moverse hacia atrás varios meses, saltar a un mes, ver un año y un rango de fechas.
//   node dev/revisar-periodos.mjs   (capturas en dev/test-results/revision/)
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { levantar, datosDemo } from './servidor.mjs';
const { chromium, devices } = createRequire(import.meta.url)('playwright');

const SALIDA = 'dev/test-results/revision/';
mkdirSync(SALIDA, { recursive: true });
const srv = await levantar({ puerto: 8796, estado: 'dev/.estado-periodos' });
const { pinErika } = await datosDemo(srv.base);
const b = await chromium.launch();
const fallas = [];
for (const [n, opc] of [['iphone', { ...devices['iPhone 13'] }], ['pc', { viewport: { width: 1366, height: 768 } }]]) {
  const ctx = await b.newContext(opc);
  await ctx.addInitScript(() => { try { localStorage.setItem('amelia_tour_omitir', '1'); } catch { /* nada */ } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => fallas.push(`${n}: ${e.message}`));
  await p.goto(`${srv.base}/panel/`, { waitUntil: 'networkidle' });
  await p.click('.persona >> text=Erika');
  for (const d of pinErika) await p.click(`.tecla[data-n="${d}"]`);
  await p.click('#entrar');
  await p.waitForSelector('.stats');
  await p.goto(`${srv.base}/panel/#/cuentas`);
  await p.waitForSelector('.nav-periodo strong');
  const etiqueta = () => p.textContent('.nav-periodo strong');
  const inicial = await etiqueta();
  const vistas = [inicial];
  for (let i = 0; i < 3; i++) { await p.click('[data-mover="-1"]'); await p.waitForTimeout(500); vistas.push(await etiqueta()); }
  if (new Set(vistas).size !== 4) fallas.push(`${n}: las flechas no cambian de mes (${vistas.join(' / ')})`);
  if (!(await p.$('[data-hoy]'))) fallas.push(`${n}: falta "Volver a hoy"`);
  await p.screenshot({ path: `${SALIDA}${n}-cuentas-3-meses-atras.png` });
  // Saltar directo a un mes con el selector
  await p.fill('#saltoPeriodo', '2026-02');
  await p.dispatchEvent('#saltoPeriodo', 'change');
  await p.waitForTimeout(500);
  if (!/febrero 2026/i.test(await etiqueta())) fallas.push(`${n}: el selector de mes no salta (${await etiqueta()})`);
  // Año y fechas libres
  await p.click('[data-modo="anio"]'); await p.waitForTimeout(500);
  await p.click('[data-mover="-1"]'); await p.waitForTimeout(500);
  if (!/^\d{4}$/.test((await etiqueta()).trim())) fallas.push(`${n}: modo año`);
  await p.click('[data-modo="rango"]'); await p.waitForSelector('#libreDesde');
  await p.fill('#libreHasta', '2026-11-20'); await p.dispatchEvent('#libreHasta', 'change'); await p.waitForTimeout(600);
  await p.fill('#libreDesde', '2026-09-01'); await p.dispatchEvent('#libreDesde', 'change'); await p.waitForTimeout(600);
  if ((await p.inputValue('#libreDesde')) !== '2026-09-01') fallas.push(`${n}: rango libre`);
  const w = await p.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  if (w[0] > w[1]) fallas.push(`${n}: desborde ${w}`);
  await p.screenshot({ path: `${SALIDA}${n}-cuentas-fechas.png` });
  await p.click('[data-hoy]'); await p.waitForTimeout(500);
  // Día: ir 40 días atrás de a uno no hace falta; la flecha retrocede un día
  await p.click('[data-modo="dia"]'); await p.waitForTimeout(400);
  await p.click('[data-mover="-1"]'); await p.waitForTimeout(400);
  if ((await etiqueta()) === 'Hoy') fallas.push(`${n}: modo día no retrocede`);
  // Analítica: otro mes
  await p.goto(`${srv.base}/panel/#/analitica`); await p.waitForSelector('#otroMes');
  await p.fill('#otroMes', '2026-08'); await p.dispatchEvent('#otroMes', 'change'); await p.waitForTimeout(700);
  if (!(await p.$('[data-rango="otro"][aria-pressed="true"]'))) fallas.push(`${n}: analítica otro mes`);
  await ctx.close();
}
await b.close();
srv.cerrar();
console.log(fallas.length ? 'FALLAS:\n- ' + fallas.join('\n- ') : 'Periodos OK: flechas, selector de mes, año, fechas libres y analítica.');
process.exit(fallas.length ? 1 : 0);
