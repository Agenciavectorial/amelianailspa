// Capturas de todas las pantallas (con 'npm run dev' corriendo en otra terminal): node dev/capturar-avance.cjs
const { chromium, devices } = require('playwright');
const B = 'http://127.0.0.1:8788';
const DIR = require('path').join(__dirname, 'test-results', 'avance', 'img') + '/';
require('fs').mkdirSync(DIR, { recursive: true });
const errs = [];
async function foto(p, nombre, opciones = {}) {
  await p.waitForTimeout(450);
  await p.screenshot({ path: DIR + nombre + '.jpg', type: 'jpeg', quality: 78, ...opciones });
}
async function entrar(p, quien, pin) {
  await p.goto(B + '/panel/', { waitUntil: 'networkidle' });
  await p.click(`.persona >> text=${quien}`);
  for (const k of pin) await p.click(`.tecla[data-n="${k}"]`);
  await p.click('#entrar');
  await p.waitForSelector('.stats .stat:not(.esqueleto)');
}
(async () => {
  const b = await chromium.launch();
  const vigilar = (p) => { p.on('pageerror', (e) => errs.push(e.message)); };

  // ---------- Clienta en celular ----------
  const cm = await b.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 2 });
  const c = await cm.newPage(); vigilar(c);
  await c.goto(B + '/reservar/', { waitUntil: 'networkidle' });
  await foto(c, 'c1-inicio');
  await c.evaluate(() => window.scrollTo(0, 620)); await foto(c, 'c2-servicios');
  await c.evaluate(() => window.scrollTo(0, 0));
  await c.click('.categorias .chip >> nth=0');
  await c.click('.servicio >> nth=5'); await c.click('.servicio >> nth=7');
  await foto(c, 'c3-elegidos');
  await c.click('#btnSeguir'); await c.waitForSelector('.pro'); await foto(c, 'c4-profesional');
  await c.click('.pro >> nth=2'); await c.waitForSelector('.turno'); await c.click('.turno >> nth=1'); await foto(c, 'c5-horario');
  await c.click('#btnSeguir'); await c.fill('[name=nombre]', 'Laura Ejemplo'); await c.fill('[name=celular]', '300 555 1234'); await c.check('[name=politica]');
  await foto(c, 'c6-datos');
  await c.click('#btnReservar'); await c.waitForSelector('.listo .codigo'); await c.waitForTimeout(700); await foto(c, 'c7-confirmada');
  await c.evaluate(() => window.scrollTo(0, 700)); await foto(c, 'c8-confirmada-acciones');
  await c.goto(B + '/reservar/', { waitUntil: 'networkidle' }); await c.click('.proxima'); await c.waitForSelector('#reprogramar'); await foto(c, 'c9-mi-cita');
  await c.click('#reprogramar'); await c.waitForSelector('.turno'); await foto(c, 'c10-reprogramar');

  // ---------- Reserva en computador ----------
  const cd = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 });
  const d = await cd.newPage(); vigilar(d);
  await d.goto(B + '/reservar/', { waitUntil: 'networkidle' }); await foto(d, 'r-computador');

  // ---------- Panel en computador (Erika) ----------
  const pd = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 });
  const p = await pd.newPage(); vigilar(p);
  await p.goto(B + '/panel/', { waitUntil: 'networkidle' }); await foto(p, 'e0-ingreso');
  await entrar(p, 'Erika', '1234'); await foto(p, 'e1-inicio');
  const hoy = new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);
  await p.goto(B + `/panel/#/agenda/${hoy}/dia/`); await p.waitForSelector('.ag-cita'); await foto(p, 'e2-agenda-dia');
  await p.click('.ag-cita >> nth=0'); await p.waitForSelector('.mensajes-cita'); await foto(p, 'e3-cita');
  await p.click('[data-accion="cobrar"]'); await p.waitForSelector('#formCobro'); await foto(p, 'e4-cobrar');
  await p.keyboard.press('Escape');
  await p.goto(B + `/panel/#/agenda/${hoy}/semana/`); await p.waitForSelector('.ag-grilla'); await foto(p, 'e5-agenda-semana');
  await p.goto(B + '/panel/#/analitica'); await p.waitForSelector('.rejilla-analitica'); await foto(p, 'e6-analitica', { fullPage: true });
  await p.goto(B + '/panel/#/fidelizacion'); await p.waitForSelector('.fid-stats'); await foto(p, 'e7-fidelizacion');
  await p.goto(B + '/panel/#/clientas'); await p.waitForSelector('.fila-clienta'); await p.click('.fila-clienta >> nth=0'); await p.waitForSelector('.historial'); await foto(p, 'e8-clienta');
  await p.keyboard.press('Escape');
  await p.goto(B + '/panel/#/equipo'); await p.waitForSelector('.tarjeta-equipo'); await foto(p, 'e9-equipo');
  await p.click('.tarjeta-equipo >> text=Karla'); await p.click('[data-tab="permisos"]'); await foto(p, 'e10-permisos');
  await p.click('[data-tab="horario"]'); await foto(p, 'e11-horario-chica');
  await p.keyboard.press('Escape');
  await p.goto(B + '/panel/#/servicios'); await p.waitForSelector('.fila-servicio'); await foto(p, 'e12-servicios');
  await p.click('.fila-servicio >> nth=5'); await p.waitForSelector('#formServ'); await foto(p, 'e13-editar-servicio');
  await p.keyboard.press('Escape');
  await p.goto(B + '/panel/#/promociones'); await p.waitForSelector('.fila-servicio'); await foto(p, 'e14-promociones');
  await p.goto(B + '/panel/#/mensajes'); await p.waitForSelector('.plantilla'); await foto(p, 'e15-mensajes');
  await p.goto(B + '/panel/#/spa'); await p.waitForSelector('#formSpa'); await foto(p, 'e16-horario-spa');
  await p.goto(B + '/panel/#/ajustes'); await p.waitForSelector('#formReglas'); await foto(p, 'e17-reglas');
  await p.goto(B + '/panel/#/importar'); await p.waitForSelector('#archivo', { state: 'attached' }); await foto(p, 'e18-importar');
  await p.goto(B + '/panel/#/notas'); await p.waitForSelector('#formNota');
  await p.fill('#formNota textarea', 'Pedir esmalte nude y acetona'); await p.click('#guardarNota'); await p.waitForSelector('.nota'); await foto(p, 'e19-notas');

  // ---------- Panel en celular (colaboradora y Erika) ----------
  const pm = await b.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 2 });
  const m = await pm.newPage(); vigilar(m);
  await m.goto(B + '/panel/', { waitUntil: 'networkidle' }); await foto(m, 'm0-quien');
  await m.click('.persona >> text=Karla'); for (const k of '11') await m.click(`.tecla[data-n="${k}"]`); await foto(m, 'm1-pin');
  for (const k of '11') await m.click(`.tecla[data-n="${k}"]`); await m.click('#entrar'); await m.waitForSelector('.stats .stat:not(.esqueleto)'); await foto(m, 'm2-inicio-chica');
  await m.goto(B + `/panel/#/agenda/${hoy}/semana/`); await m.waitForSelector('.ag-grilla'); await foto(m, 'm3-semana-chica');
  await m.goto(B + '/panel/#/mas'); await m.waitForSelector('.lista-mas'); await foto(m, 'm4-mas-chica');
  await m.goto(B + '/panel/#/cuenta'); await m.waitForSelector('#formPin'); await foto(m, 'm5-cuenta-chica');
  const pe = await b.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 2 });
  const e = await pe.newPage(); vigilar(e);
  await entrar(e, 'Erika', '1234'); await foto(e, 'm6-inicio-erika');
  await e.goto(B + `/panel/#/agenda/${hoy}/dia/`); await e.waitForSelector('.ag-cita'); await foto(e, 'm7-agenda-erika');
  await e.goto(B + '/panel/#/mas'); await e.waitForSelector('.lista-mas'); await foto(e, 'm8-mas-erika');

  console.log(errs.join('\n') || 'sin errores');
  await b.close();
})();
