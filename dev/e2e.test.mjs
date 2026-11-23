// Pruebas de punta a punta: API real (wrangler pages dev + D1 local) y navegador (Playwright/Chromium).
//   npm run test:e2e
// Usa solo datos ficticios. Las capturas quedan en dev/test-results/capturas/
// (con CAPTURAS_DOCS=1 actualiza las de referencia en docs/plataforma/capturas/).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { levantar, cliente, proximoDiaHabil, CLAVE_INICIAL } from './servidor.mjs';

const require = createRequire(import.meta.url);
let chromium, devices;
try { ({ chromium, devices } = require('playwright')); } catch { /* sin Playwright: se omiten pruebas de navegador */ }

const CAPTURAS = new URL(process.env.CAPTURAS_DOCS ? '../docs/plataforma/capturas/' : './test-results/capturas/', import.meta.url).pathname;
mkdirSync(CAPTURAS, { recursive: true });

let srv, base, erika, ids = {};
const DIA = proximoDiaHabil(3);

before(async () => {
  srv = await levantar({ puerto: 8799, estado: 'dev/.estado-e2e', variables: { LIMITE_RESERVAS_HORA: 500 } });
  base = srv.base;
  erika = cliente(base);
});
after(() => srv?.cerrar());

const reservar = (datos) => cliente(base).pedir('/api/public/reservar', { metodo: 'POST', datos });

test('configuración inicial: solo con CLAVE_INICIAL y una sola vez', async () => {
  const p = await cliente(base).pedir('/api/auth/personas');
  assert.equal(p.cuerpo.necesita_configurar, true);
  const mala = await cliente(base).pedir('/api/auth/configurar', { metodo: 'POST', datos: { clave: 'no-es', pin: '1234' } });
  assert.equal(mala.status, 401);
  const ok = await erika.pedir('/api/auth/configurar', { metodo: 'POST', datos: { clave: CLAVE_INICIAL, pin: '2468' } });
  assert.equal(ok.status, 200);
  assert.match(ok.headers.get('set-cookie'), /HttpOnly; Secure; SameSite=Strict/);
  const otra = await cliente(base).pedir('/api/auth/configurar', { metodo: 'POST', datos: { clave: CLAVE_INICIAL, pin: '9999' } });
  assert.equal(otra.status, 409);
  const { cuerpo } = await erika.pedir('/api/panel/arranque');
  assert.equal(cuerpo.yo.esPropietaria, true);
  for (const c of cuerpo.colaboradoras) ids[c.slug] = c.id;
  for (const s of cuerpo.servicios) ids[s.slug] = s.id;
  for (const slug of ['leidy', 'karla']) {
    const r = await erika.pedir(`/api/panel/colaboradoras/${ids[slug]}/pin`, { metodo: 'POST', datos: { pin: '1357' } });
    assert.equal(r.status, 200);
  }
});

test('el PIN se guarda con PBKDF2 y sal (nunca en claro)', async () => {
  const { execFileSync } = await import('node:child_process');
  const out = execFileSync('node_modules/.bin/wrangler', ['d1', 'execute', 'amelia-citas', '--local', '--persist-to', 'dev/.estado-e2e', '--json', '--command', "SELECT pin_hash FROM colaboradoras WHERE slug IN ('erika','leidy','karla')"], { encoding: 'utf8', env: { ...process.env, CI: '1' } });
  const hashes = JSON.parse(out)[0].results.map((r) => r.pin_hash);
  assert.equal(hashes.length, 3);
  for (const h of hashes) assert.match(h, /^pbkdf2\$100000\$[A-Za-z0-9+/=]{24}\$[A-Za-z0-9+/=]{44}$/);
  assert.notEqual(hashes[1], hashes[2], 'mismo PIN, distinta sal → distinto hash');
});

test('disponibilidad pública respeta horario y duración', async () => {
  const r = await cliente(base).pedir(`/api/public/disponibilidad?fecha=${DIA}&servicios=${ids.acrilicas}&con=leidy`);
  assert.equal(r.status, 200);
  assert.equal(r.cuerpo.duracion, 120);
  assert.equal(r.cuerpo.turnos[0].inicio, 540); // abre 9:00
  assert.equal(r.cuerpo.turnos.at(-1).fin, 1140); // la última termina a las 19:00
});

test('dos clientas reservan el MISMO turno al mismo tiempo: solo una gana', async () => {
  const datos = (n) => ({ servicios: [ids.semipermanente], con: 'karla', fecha: DIA, inicio: 600, nombre: `Clienta Ficticia ${n}`, celular: `30099900${10 + n}` });
  const res = await Promise.all([reservar(datos(1)), reservar(datos(2))]);
  const estados = res.map((r) => r.status).sort();
  assert.deepEqual(estados, [200, 409], JSON.stringify(res.map((r) => r.cuerpo)));
});

test('ráfaga de 12 reservas que se cruzan (horas distintas): nunca quedan citas encimadas', async () => {
  const res = await Promise.all(Array.from({ length: 12 }, (_, i) => reservar({
    servicios: [ids.acrilicas], con: 'julieth', fecha: DIA, inicio: 600 + (i % 4) * 15, nombre: `Ráfaga ${i}`, celular: `3008880${String(i).padStart(3, '0')}`,
  })));
  const ganadoras = res.filter((r) => r.status === 200);
  assert.equal(ganadoras.length, 1, 'solo una cita de 2 h puede caber entre 10:00 y 12:45');
  assert.ok(res.every((r) => r.status === 200 || r.status === 409));
});

test('la restricción de la base de datos frena el cruce aunque se salte la verificación previa (forzar)', async () => {
  // "forzar" (solo Erika) se salta horario y bloqueos: lo único que impide el cruce es la PK de cita_slots.
  const datos = (n) => ({ servicios: [ids.dipping], colaboradora_id: ids.darly, fecha: DIA, inicio: 900, nombre: `Forzada ${n}`, celular: `30077700${10 + n}`, forzar: true });
  const res = await Promise.all([1, 2, 3, 4].map((n) => erika.pedir('/api/panel/citas', { metodo: 'POST', datos: datos(n) })));
  assert.equal(res.filter((r) => r.status === 200).length, 1, JSON.stringify(res.map((r) => r.cuerpo)));
  assert.ok(res.filter((r) => r.status === 409).every((r) => r.cuerpo.codigo === 'ocupado'));
  const ag = await erika.pedir(`/api/panel/agenda?desde=${DIA}&hasta=${DIA}&colaboradora=${ids.darly}`);
  const activas = ag.cuerpo.citas.filter((c) => c.estado !== 'cancelada').sort((a, b) => a.inicio - b.inicio);
  for (let i = 1; i < activas.length; i++) assert.ok(activas[i].inicio >= activas[i - 1].fin, 'citas encimadas');
});

test('cancelar libera el turno y la clienta puede reprogramar con su enlace', async () => {
  const r = await reservar({ servicios: [ids['press-on']], con: 'leidy', fecha: DIA, inicio: 840, nombre: 'Gestiona Ficticia', celular: '3005550101' });
  assert.equal(r.status, 200);
  const token = r.cuerpo.token;
  const mover = await cliente(base).pedir('/api/public/cita/reprogramar', { metodo: 'POST', datos: { token, fecha: DIA, inicio: 900 } });
  assert.equal(mover.status, 200);
  assert.equal(mover.cuerpo.inicio, 900);
  const libre = await cliente(base).pedir(`/api/public/disponibilidad?fecha=${DIA}&servicios=${ids['press-on']}&con=leidy`);
  assert.ok(libre.cuerpo.turnos.some((t) => t.inicio === 840), 'el turno viejo quedó libre');
  const ics = await cliente(base).pedir(`/api/public/cita.ics?token=${token}`);
  assert.match(ics.cuerpo, /BEGIN:VCALENDAR[\s\S]*BEGIN:VEVENT[\s\S]*END:VCALENDAR/);
  const cancel = await cliente(base).pedir('/api/public/cita/cancelar', { metodo: 'POST', datos: { token } });
  assert.equal(cancel.cuerpo.estado, 'cancelada');
  const otra = await reservar({ servicios: [ids['press-on']], con: 'leidy', fecha: DIA, inicio: 900, nombre: 'Toma Turno', celular: '3005550102' });
  assert.equal(otra.status, 200, 'el turno cancelado se puede volver a tomar');
});

test('validación de entradas públicas', async () => {
  const base_ = { servicios: [ids.forrado], con: 'karla', fecha: DIA, inicio: 1020, nombre: 'Valida Ficticia', celular: '3005550200' };
  assert.equal((await reservar({ ...base_, celular: '123' })).status, 400);
  assert.equal((await reservar({ ...base_, nombre: '' })).status, 400);
  assert.equal((await reservar({ ...base_, fecha: '2026-02-31' })).status, 400);
  assert.equal((await reservar({ ...base_, inicio: 1021 })).status, 409);
  assert.equal((await reservar({ ...base_, sitio_web: 'http://spam' })).status, 400, 'trampa anti-bots');
  const sinJson = await fetch(base + '/api/public/reservar', { method: 'POST', body: 'a=1', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  assert.equal(sinJson.status, 415, 'solo JSON (protege contra formularios de otros sitios)');
  const otroOrigen = await fetch(base + '/api/auth/login', { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json', Origin: 'https://malo.example' } });
  assert.equal(otroOrigen.status, 403);
});

test('permisos: una colaboradora no ve ni edita lo que no le corresponde', async () => {
  const karla = cliente(base);
  const login = await karla.pedir('/api/auth/login', { metodo: 'POST', datos: { id: ids.karla, pin: '1357' } });
  assert.equal(login.status, 200);
  // Cita de Leidy creada por Erika
  const deLeidy = await erika.pedir('/api/panel/citas', { metodo: 'POST', datos: { servicios: [ids.tradicional], colaboradora_id: ids.leidy, fecha: DIA, inicio: 1020, nombre: 'Privada Ficticia', celular: '3005550300' } });
  assert.equal(deLeidy.status, 200);
  const idLeidy = deLeidy.cuerpo.id;

  const ag = await karla.pedir(`/api/panel/agenda?desde=${DIA}&hasta=${DIA}`);
  assert.equal(ag.status, 200);
  assert.ok(ag.cuerpo.citas.length > 0);
  assert.ok(ag.cuerpo.citas.every((c) => c.colaboradora_id === ids.karla), 'solo ve sus citas');
  const pidiendoOtra = await karla.pedir(`/api/panel/agenda?desde=${DIA}&hasta=${DIA}&colaboradora=${ids.leidy}`);
  assert.ok(pidiendoOtra.cuerpo.citas.every((c) => c.colaboradora_id === ids.karla), 'el filtro no se puede forzar');

  assert.equal((await karla.pedir(`/api/panel/citas/${idLeidy}`)).status, 403);
  assert.equal((await karla.pedir(`/api/panel/citas/${idLeidy}`, { metodo: 'PATCH', datos: { accion: 'cancelar' } })).status, 403);
  assert.equal((await karla.pedir('/api/panel/citas', { metodo: 'POST', datos: { servicios: [ids.tradicional], colaboradora_id: ids.leidy, fecha: DIA, inicio: 1080, nombre: 'Intrusa', celular: '3005550301' } })).status, 403);
  assert.equal((await karla.pedir('/api/panel/servicios', { metodo: 'POST', datos: { nombre: 'X', duracion: 30 } })).status, 403);
  assert.equal((await karla.pedir(`/api/panel/colaboradoras/${ids.leidy}/pin`, { metodo: 'POST', datos: { pin: '0000' } })).status, 403);
  assert.equal((await karla.pedir('/api/panel/importar', { metodo: 'POST', datos: { tipo: 'clientas', filas: [] } })).status, 403);
  assert.equal((await karla.pedir('/api/panel/clientas')).status, 403, 'sin permiso ver_clientas');
  assert.equal((await karla.pedir(`/api/panel/horario/${ids.karla}`, { metodo: 'PUT', datos: { dias: [] } })).status, 403, 'sin permiso editar_horario');
  assert.equal((await karla.pedir('/api/panel/bloqueos', { metodo: 'POST', datos: { colaboradora_id: null, fecha: DIA, inicio: '12:00', fin: '13:00' } })).status, 403, 'bloqueo general solo Erika');
  assert.equal((await karla.pedir('/api/panel/bloqueos', { metodo: 'POST', datos: { colaboradora_id: ids.leidy, fecha: DIA, inicio: '12:00', fin: '13:00' } })).status, 403);
  assert.equal((await karla.pedir('/api/panel/ajustes', { metodo: 'PUT', datos: { ventana_dias: 5 } })).status, 403);
  const propio = await karla.pedir('/api/panel/bloqueos', { metodo: 'POST', datos: { colaboradora_id: ids.karla, fecha: DIA, inicio: '18:00', fin: '19:00', motivo: 'Diligencia' } });
  assert.equal(propio.status, 200, 'sí puede bloquear su propia agenda');
  const arr = await karla.pedir('/api/panel/arranque');
  assert.ok(arr.cuerpo.colaboradoras.every((c) => c.id === ids.karla), 'no recibe datos del resto del equipo');
  assert.ok(!('pin_hash' in arr.cuerpo.colaboradoras[0]));

  // Erika le da permisos y ahora sí puede (verificado en el servidor en cada llamada)
  const { cuerpo: a } = await erika.pedir('/api/panel/arranque');
  const k = a.colaboradoras.find((c) => c.id === ids.karla);
  await erika.pedir(`/api/panel/colaboradoras/${ids.karla}`, { metodo: 'PUT', datos: { ...k, permisos: { ...k.permisos, ver_agenda_equipo: true, editar_horario: true } } });
  const ag2 = await karla.pedir(`/api/panel/agenda?desde=${DIA}&hasta=${DIA}`);
  const ajena = ag2.cuerpo.citas.find((c) => c.id === idLeidy);
  assert.ok(ajena, 'con permiso ve la agenda del equipo');
  assert.equal(ajena.clienta_celular, '', 'pero sin el teléfono de clientas ajenas');
  assert.equal((await karla.pedir(`/api/panel/citas/${idLeidy}`, { metodo: 'PATCH', datos: { accion: 'cancelar' } })).status, 403, 'ver no es editar');
  assert.equal((await karla.pedir(`/api/panel/horario/${ids.karla}`, { metodo: 'PUT', datos: { dias: [{ dia: 1, trabaja: true, abre: '10:00', cierra: '16:00' }] } })).status, 200);
});

test('sin sesión no hay panel; cerrar sesión revoca la cookie', async () => {
  assert.equal((await cliente(base).pedir('/api/panel/arranque')).status, 401);
  const leidy = cliente(base);
  await leidy.pedir('/api/auth/login', { metodo: 'POST', datos: { id: ids.leidy, pin: '1357' } });
  const cookieVieja = leidy.cookie;
  assert.equal((await leidy.pedir('/api/auth/yo')).status, 200);
  await leidy.pedir('/api/auth/logout', { metodo: 'POST', datos: {} });
  const r = await fetch(base + '/api/auth/yo', { headers: { Cookie: cookieVieja } });
  assert.equal(r.status, 401);
});

test('límite de intentos de PIN: bloquea tras 5 fallos', async () => {
  const atacante = cliente(base);
  const estados = [];
  for (let i = 0; i < 6; i++) estados.push((await atacante.pedir('/api/auth/login', { metodo: 'POST', datos: { id: ids.darly, pin: String(1000 + i) } })).status);
  assert.deepEqual(estados.slice(0, 5), [401, 401, 401, 401, 401]);
  assert.equal(estados[5], 429);
});

test('feed .ics por colaboradora con token secreto y revocable', async () => {
  const r = await erika.pedir(`/api/panel/colaboradoras/${ids.karla}/ics`, { metodo: 'POST', datos: {} });
  const url = `/api/ics/${r.cuerpo.ics_token}.ics`;
  const feed = await cliente(base).pedir(url);
  assert.equal(feed.status, 200);
  assert.match(feed.headers.get('content-type'), /text\/calendar/);
  assert.match(feed.cuerpo, /X-WR-CALNAME:Amelia Nail Spa · Karla/);
  assert.match(feed.cuerpo, /Semipermanente/);
  assert.doesNotMatch(feed.cuerpo, /Privada Ficticia/, 'no incluye citas de otras');
  await erika.pedir(`/api/panel/colaboradoras/${ids.karla}/ics`, { metodo: 'POST', datos: {} });
  assert.equal((await cliente(base).pedir(url)).status, 404, 'el enlace viejo deja de funcionar');
});

test('importador CSV: servicios con precios y citas de Kumbio (simular y luego guardar)', async () => {
  const servicios = [
    { nombre: 'Semipermanente', categoria: 'Uñas', precio: '$45.000', duracion: '1:15' },
    { nombre: 'Servicio Nuevo Ficticio', categoria: 'Uñas', precio: '30000', duracion: '40 min' },
    { nombre: 'Sin Duración', precio: '1' },
  ];
  const sim = await erika.pedir('/api/panel/importar', { metodo: 'POST', datos: { tipo: 'servicios', simular: true, filas: servicios } });
  assert.deepEqual(sim.cuerpo.resultado.map((r) => r.ok), [true, true, false]);
  const real = await erika.pedir('/api/panel/importar', { metodo: 'POST', datos: { tipo: 'servicios', filas: servicios } });
  assert.equal(real.cuerpo.resultado.filter((r) => r.ok).length, 2);
  const cat = await cliente(base).pedir('/api/public/catalogo');
  const semi = cat.cuerpo.servicios.find((s) => s.slug === 'semipermanente');
  assert.equal(semi.precio, 45000);
  assert.equal(semi.duracion, 75);
  const citas = [
    { fecha: '15/01/2026', hora: '3:00 pm', nombre: 'Histórica Ficticia', celular: '300 555 0400', servicio: 'Semipermanente', colaboradora: 'Karla', estado: 'Atendida' },
    { fecha: DIA, hora: '09:00', nombre: 'Futura Ficticia', celular: '3005550401', servicio: 'Acrílicas', colaboradora: 'leidy' },
    { fecha: DIA, hora: '09:30', nombre: 'Choca Ficticia', celular: '3005550402', servicio: 'Acrílicas', colaboradora: 'Leidy' },
    { fecha: DIA, hora: '9:00', nombre: 'Sin Colab', celular: '3005550403', servicio: 'Acrílicas', colaboradora: 'Nadie' },
  ];
  const ri = await erika.pedir('/api/panel/importar', { metodo: 'POST', datos: { tipo: 'citas', filas: citas } });
  assert.deepEqual(ri.cuerpo.resultado.map((r) => r.ok), [true, true, false, false], JSON.stringify(ri.cuerpo.resultado));
  const rep = await erika.pedir('/api/panel/importar', { metodo: 'POST', datos: { tipo: 'citas', filas: citas.slice(0, 2) } });
  assert.ok(rep.cuerpo.resultado.every((r) => /ya existía/.test(r.msg)), 'reimportar no duplica');
});

test('navegador: reserva en celular desde un botón "Agendar" de la página', { skip: !chromium && 'Playwright no disponible' }, async () => {
  const b = await chromium.launch();
  try {
    const ctx = await b.newContext({ ...devices['iPhone 13'] });
    const p = await ctx.newPage();
    const errores = [];
    p.on('pageerror', (e) => errores.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
    await p.goto(`${base}/reservar`, { waitUntil: 'networkidle' });
    await p.screenshot({ path: CAPTURAS + 'reservar-1-servicios.png' });
    await p.goto(`${base}/reservar?servicio=lifting-pestanas&con=julieth`, { waitUntil: 'networkidle' });
    await p.waitForSelector('.turno');
    assert.match(await p.textContent('.con-quien'), /Julieth/);
    await p.click('.turno >> nth=1');
    await p.screenshot({ path: CAPTURAS + 'reservar-2-horario.png' });
    await p.click('#btnSeguir');
    await p.fill('[name=nombre]', 'Navegadora Ficticia');
    await p.fill('[name=celular]', '300 555 0500');
    await p.check('[name=politica]');
    await p.screenshot({ path: CAPTURAS + 'reservar-3-datos.png' });
    await p.click('#btnReservar');
    await p.waitForSelector('.listo .codigo');
    await p.waitForTimeout(600);
    const codigo = (await p.textContent('.codigo')).trim();
    assert.match(codigo, /^AM-[A-Z2-9]{6}$/);
    const wa = await p.getAttribute('.btn.wa', 'href');
    assert.ok(wa.startsWith('https://wa.me/573107027012?text='));
    assert.ok(decodeURIComponent(wa).includes(codigo));
    await p.screenshot({ path: CAPTURAS + 'reservar-4-confirmada.png', fullPage: true });
    // Página "Mi cita" desde el banner de próxima cita
    await p.goto(`${base}/reservar`, { waitUntil: 'networkidle' });
    await p.click('.proxima');
    await p.waitForSelector('#reprogramar');
    await p.screenshot({ path: CAPTURAS + 'reservar-5-mi-cita.png' });
    assert.deepEqual(errores, []);
    // CSP estricta en /reservar
    const r = await fetch(`${base}/reservar/`);
    assert.match(r.headers.get('content-security-policy'), /script-src 'self'/);
  } finally { await b.close(); }
});

test('navegador: panel de Erika (computador y celular) y de una colaboradora', { skip: !chromium && 'Playwright no disponible' }, async () => {
  const b = await chromium.launch();
  try {
    const ctx = await b.newContext({ viewport: { width: 1366, height: 860 }, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    const errores = [];
    p.on('pageerror', (e) => errores.push(e.message));
    await p.goto(`${base}/panel/`, { waitUntil: 'networkidle' });
    await p.screenshot({ path: CAPTURAS + 'panel-1-ingreso.png' });
    await p.click('.persona >> text=Erika');
    for (const d of '2468') await p.click(`.tecla[data-n="${d}"]`);
    await p.click('#entrar');
    await p.waitForSelector('.stats .stat:not(.esqueleto)');
    await p.screenshot({ path: CAPTURAS + 'panel-2-inicio.png' });
    await p.goto(`${base}/panel/#/agenda/${DIA}/dia/`);
    await p.waitForSelector('.ag-cita');
    await p.waitForTimeout(500);
    await p.screenshot({ path: CAPTURAS + 'panel-3-agenda-dia.png' });
    await p.click('.ag-cita >> nth=0');
    await p.waitForSelector('[data-accion="asistio"]');
    await p.screenshot({ path: CAPTURAS + 'panel-4-cita.png' });
    await p.click('[data-accion="asistio"]');
    await p.waitForTimeout(800);
    assert.ok(await p.$('.ag-cita.estado-asistio'), 'quedó marcada como asistió');
    await p.goto(`${base}/panel/#/equipo`);
    await p.click('.tarjeta-equipo >> text=Karla');
    await p.click('[data-tab="permisos"]');
    await p.screenshot({ path: CAPTURAS + 'panel-5-permisos.png' });
    await p.keyboard.press('Escape');
    await p.goto(`${base}/panel/#/importar`);
    await p.waitForSelector('#archivo', { state: 'attached' });
    await p.screenshot({ path: CAPTURAS + 'panel-6-importar.png' });
    assert.deepEqual(errores, []);
    const r = await fetch(`${base}/panel/`);
    assert.equal(r.headers.get('x-robots-tag'), 'noindex, nofollow');

    const movil = await b.newContext({ ...devices['iPhone 13'] });
    const m = await movil.newPage();
    await m.goto(`${base}/panel/`, { waitUntil: 'networkidle' });
    await m.click('.persona >> text=Karla');
    for (const d of '1357') await m.click(`.tecla[data-n="${d}"]`);
    await m.click('#entrar');
    await m.waitForSelector('.dock');
    await m.screenshot({ path: CAPTURAS + 'panel-7-colaboradora-inicio.png' });
    await m.goto(`${base}/panel/#/agenda/${DIA}/semana/`);
    await m.waitForSelector('.ag-grilla');
    await m.waitForTimeout(500);
    await m.screenshot({ path: CAPTURAS + 'panel-8-colaboradora-semana.png' });
    assert.equal(await m.$('a[data-sec="equipo"]'), null, 'una colaboradora no ve la sección Equipo');
  } finally { await b.close(); }
});
