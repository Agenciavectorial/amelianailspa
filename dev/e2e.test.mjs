// Pruebas de punta a punta: API real (wrangler pages dev + D1 local) y navegador (Playwright/Chromium).
//   npm run test:e2e
// Usa solo datos ficticios. Las capturas quedan en dev/test-results/capturas/
// (con CAPTURAS_DOCS=1 actualiza las de referencia en docs/plataforma/capturas/).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { levantar, cliente, proximoDiaHabil, CLAVE_INICIAL } from './servidor.mjs';
import { generarVapid, b64u, deB64u } from '../functions/_lib/push.js';

const require = createRequire(import.meta.url);
let chromium, devices;
try { ({ chromium, devices } = require('playwright')); } catch { /* sin Playwright: se omiten pruebas de navegador */ }

const CAPTURAS = new URL(process.env.CAPTURAS_DOCS ? '../docs/plataforma/capturas/' : './test-results/capturas/', import.meta.url).pathname;
mkdirSync(CAPTURAS, { recursive: true });

let srv, base, erika, ids = {}, VAPID;
const DIA = proximoDiaHabil(3);
const CRON_CLAVE = 'clave-cron-de-pruebas-123456';
// Servicio de push simulado: recibe lo que enviaría Google/Apple/Mozilla para poder descifrarlo.
const PUSH = { recibidos: [], base: '' };
const servidorPush = createServer((req, res) => {
  const partes = [];
  req.on('data', (d) => partes.push(d));
  req.on('end', () => {
    PUSH.recibidos.push({ ruta: req.url, cabeceras: req.headers, cuerpo: Buffer.concat(partes) });
    res.writeHead(req.url.includes('expirada') ? 410 : 201).end();
  });
});

before(async () => {
  await new Promise((r) => servidorPush.listen(0, '127.0.0.1', r));
  PUSH.base = `http://127.0.0.1:${servidorPush.address().port}`;
  VAPID = await generarVapid();
  srv = await levantar({ puerto: 8799, estado: 'dev/.estado-e2e', variables: {
    LIMITE_RESERVAS_HORA: 500, VAPID_PUBLICA: VAPID.publica, VAPID_PRIVADA: VAPID.privada, VAPID_SUJETO: 'mailto:pruebas@example.com',
    PUSH_PERMITIR_LOCAL: '1', CRON_CLAVE,
  } });
  base = srv.base;
  erika = cliente(base);
});
after(() => { srv?.cerrar(); servidorPush.close(); });

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
  // El ingreso muestra a todo el equipo activo, aunque aún no tenga PIN (marcadas para que Erika se lo asigne)
  const todas = (await cliente(base).pedir('/api/auth/personas')).cuerpo.personas;
  assert.ok(todas.length >= 5, 'aparecen todas las chicas');
  assert.ok(todas.filter((x) => x.rol !== 'propietaria').every((x) => x.tiene_pin === false));
  const { cuerpo } = await erika.pedir('/api/panel/arranque');
  assert.equal(cuerpo.yo.esPropietaria, true);
  for (const c of cuerpo.colaboradoras) ids[c.slug] = c.id;
  for (const s of cuerpo.servicios) ids[s.slug] = s.id;
  // Escenario fijo para las pruebas (independiente de los datos reales cargados de Kumbio):
  // horario L-V 9-19, S 10-19, D 11-17 y todas las manicuristas con todos los servicios.
  await erika.pedir('/api/panel/spa', { metodo: 'PUT', datos: { horario: [0, 1, 2, 3, 4, 5, 6].map((dia) => ({
    dia, abierto: true, abre: dia === 0 ? '11:00' : dia === 6 ? '10:00' : '09:00', cierra: dia === 0 ? '17:00' : '19:00' })) } });
  for (const c of cuerpo.colaboradoras.filter((x) => x.agenda)) {
    const r = await erika.pedir(`/api/panel/colaboradoras/${c.id}`, { metodo: 'PUT', datos: { ...c, servicios: cuerpo.servicios.map((x) => x.id) } });
    assert.equal(r.status, 200);
  }
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
  const cat = await cliente(base).pedir('/api/public/catalogo');
  const dur = cat.cuerpo.servicios.find((x) => x.slug === 'acrilicas').duracion;
  assert.equal(r.cuerpo.duracion, dur);
  assert.equal(r.cuerpo.turnos[0].inicio, 540); // abre 9:00
  assert.ok(r.cuerpo.turnos.at(-1).fin <= 1140 && r.cuerpo.turnos.at(-1).fin > 1140 - 15, 'la última termina antes de las 19:00');
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
  const datos = (n) => ({ servicios: [ids.dipping], colaboradora_id: ids.daily, fecha: DIA, inicio: 900, nombre: `Forzada ${n}`, celular: `30077700${10 + n}`, forzar: true });
  const res = await Promise.all([1, 2, 3, 4].map((n) => erika.pedir('/api/panel/citas', { metodo: 'POST', datos: datos(n) })));
  assert.equal(res.filter((r) => r.status === 200).length, 1, JSON.stringify(res.map((r) => r.cuerpo)));
  assert.ok(res.filter((r) => r.status === 409).every((r) => r.cuerpo.codigo === 'ocupado'));
  const ag = await erika.pedir(`/api/panel/agenda?desde=${DIA}&hasta=${DIA}&colaboradora=${ids.daily}`);
  const activas = ag.cuerpo.citas.filter((c) => c.estado !== 'cancelada').sort((a, b) => a.inicio - b.inicio);
  for (let i = 1; i < activas.length; i++) assert.ok(activas[i].inicio >= activas[i - 1].fin, 'citas encimadas');
});

test('cancelar libera el turno y la clienta puede reprogramar con su enlace', async () => {
  const r = await reservar({ servicios: [ids['press-on']], con: 'leidy', fecha: DIA, inicio: 840, nombre: 'Gestiona Ficticia', celular: '3005550101' });
  assert.equal(r.status, 200);
  const token = r.cuerpo.token;
  const mover = await cliente(base).pedir('/api/public/cita/reprogramar', { metodo: 'POST', datos: { token, fecha: DIA, inicio: 960 } });
  assert.equal(mover.status, 200);
  assert.equal(mover.cuerpo.inicio, 960);
  const libre = await cliente(base).pedir(`/api/public/disponibilidad?fecha=${DIA}&servicios=${ids['press-on']}&con=leidy`);
  assert.ok(libre.cuerpo.turnos.some((t) => t.inicio === 840), 'el turno viejo quedó libre');
  const ics = await cliente(base).pedir(`/api/public/cita.ics?token=${token}`);
  assert.match(ics.cuerpo, /BEGIN:VCALENDAR[\s\S]*BEGIN:VEVENT[\s\S]*END:VCALENDAR/);
  const cancel = await cliente(base).pedir('/api/public/cita/cancelar', { metodo: 'POST', datos: { token } });
  assert.equal(cancel.cuerpo.estado, 'cancelada');
  const otra = await reservar({ servicios: [ids['press-on']], con: 'leidy', fecha: DIA, inicio: 960, nombre: 'Toma Turno', celular: '3005550102' });
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
  const deLeidy = await erika.pedir('/api/panel/citas', { metodo: 'POST', datos: { servicios: [ids.tradicional], colaboradora_id: ids.leidy, fecha: DIA, inicio: 1080, nombre: 'Privada Ficticia', celular: '3005550300' } });
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
  for (let i = 0; i < 6; i++) estados.push((await atacante.pedir('/api/auth/login', { metodo: 'POST', datos: { id: ids.daily, pin: String(1000 + i) } })).status);
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

const haceDias = (n) => { const d = new Date(Date.now() - 5 * 3600000); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };

test('importador con el formato de Kumbio (servicios con colaboradoras, equipo con horario, citas)', async () => {
  const serv = await erika.pedir('/api/panel/importar', { metodo: 'POST', datos: { tipo: 'servicios', filas: [
    { categoria: 'Uñas', nombre: 'Dipping', precio: '65000', duracion: '90', descripcion: '', colaboradoras: 'Karla|Daily', foto: '' },
  ] } });
  assert.ok(serv.cuerpo.resultado[0].ok, JSON.stringify(serv.cuerpo));
  const eq = await erika.pedir('/api/panel/importar', { metodo: 'POST', datos: { tipo: 'colaboradoras', filas: [
    { nombre: 'Julieth', celular: '3000000099', rol: 'colaboradora', servicios: 'Lifting de Pestañas|Laminado de Cejas', horario: 'lun-vie 10:00-18:00; sab 10:00-14:00; dom cerrado' },
    { nombre: 'Nueva Ficticia', celular: '', rol: 'colaboradora', servicios: 'Semipermanente', horario: 'mar,jue 09:00-13:00' },
    { nombre: 'Mal Horario', horario: 'todos los días' },
  ] } });
  assert.deepEqual(eq.cuerpo.resultado.map((r) => r.ok), [true, true, false], JSON.stringify(eq.cuerpo.resultado));
  const { cuerpo: a } = await erika.pedir('/api/panel/arranque');
  const jul = a.colaboradoras.find((c) => c.slug === 'julieth');
  assert.deepEqual(jul.servicios.sort(), [ids['lifting-pestanas'], ids['laminado-cejas']].sort());
  assert.equal(jul.horario.find((h) => h.dia === 6).cierra, 14 * 60);
  assert.equal(jul.horario.find((h) => h.dia === 0).trabaja, 0);
  const dip = a.colaboradoras.filter((c) => c.servicios.includes(ids.dipping)).map((c) => c.slug).sort();
  assert.deepEqual(dip, ['daily', 'karla']);
  assert.ok(a.colaboradoras.some((c) => c.nombre === 'Nueva Ficticia' && c.agenda));
  // citas con las columnas exactas del formato (hora_inicio, duracion_min, clienta_nombre, clienta_celular)
  const ci = await erika.pedir('/api/panel/importar', { metodo: 'POST', datos: { tipo: 'citas', filas: [
    { fecha: haceDias(20), hora: '10:00', duracion: '75', colaboradora: 'Karla', servicio: 'Semipermanente', nombre: 'Vuelve Ficticia', celular: '3005550600', estado: 'asistio' },
    { fecha: haceDias(2), hora: '11:00', duracion: '60', colaboradora: 'Leidy', servicio: 'Forrado', nombre: 'Pendiente Ficticia', celular: '3005550601', estado: 'confirmada' },
  ] } });
  assert.ok(ci.cuerpo.resultado.every((r) => r.ok), JSON.stringify(ci.cuerpo.resultado));
});

test('citas por gestionar, cobro con método de pago, resumen y analítica', async () => {
  const pg = await erika.pedir('/api/panel/por-gestionar');
  const pend = pg.cuerpo.citas.find((c) => c.clienta_nombre === 'Pendiente Ficticia');
  assert.ok(pend, 'una cita pasada sin marcar aparece para preguntar ¿asistió?');
  const karla = cliente(base);
  await karla.pedir('/api/auth/login', { metodo: 'POST', datos: { id: ids.karla, pin: '1357' } });
  assert.equal((await karla.pedir(`/api/panel/citas/${pend.id}/pagos`, { metodo: 'POST', datos: { monto: 50000, metodo: 'nequi' } })).status, 403, 'no cobra citas ajenas');
  assert.equal((await erika.pedir(`/api/panel/citas/${pend.id}/pagos`, { metodo: 'POST', datos: { monto: 50000, metodo: 'bitcoin' } })).status, 400);
  const ok = await erika.pedir(`/api/panel/citas/${pend.id}/pagos`, { metodo: 'POST', datos: { monto: 50000, propina: 5000, metodo: 'nequi' } });
  assert.equal(ok.status, 200);
  const pg2 = await erika.pedir('/api/panel/por-gestionar');
  assert.ok(!pg2.cuerpo.citas.some((c) => c.id === pend.id), 'cobrar la marca como asistió');
  const r = await erika.pedir('/api/panel/resumen2');
  assert.equal(r.status, 200);
  const an = await erika.pedir(`/api/panel/analitica?desde=${haceDias(30)}&hasta=${DIA}`);
  assert.equal(an.cuerpo.ingresos, 50000);
  assert.equal(an.cuerpo.propinas, 5000);
  assert.equal(an.cuerpo.metodos[0].metodo, 'nequi');
  assert.equal(an.cuerpo.colaboradoras.find((c) => c.nombre === 'Leidy').ingresos, 50000);
  assert.equal((await karla.pedir('/api/panel/analitica')).status, 403, 'la analítica es solo de Erika');
});

test('fidelización: a quién le toca volver, inactivas y registro del mensaje', async () => {
  const f = await erika.pedir('/api/panel/fidelizacion');
  assert.equal(f.status, 200);
  const vuelve = f.cuerpo.a_contactar.find((c) => c.nombre === 'Vuelve Ficticia');
  assert.ok(vuelve, 'semipermanente hace 20 días (ciclo 21) → le toca volver');
  assert.equal(vuelve.colab_slug, 'karla');
  assert.ok(f.cuerpo.inactivas.some((c) => c.nombre === 'Histórica Ficticia'), 'última visita hace meses → inactiva');
  await erika.pedir('/api/panel/mensajes', { metodo: 'POST', datos: { clienta_id: vuelve.clienta_id, tipo: 'vuelve' } });
  const f2 = await erika.pedir('/api/panel/fidelizacion');
  assert.ok(!f2.cuerpo.a_contactar.some((c) => c.nombre === 'Vuelve Ficticia'), 'tras escribirle sale de la lista');
  const karla = cliente(base);
  await karla.pedir('/api/auth/login', { metodo: 'POST', datos: { id: ids.karla, pin: '1357' } });
  assert.equal((await karla.pedir('/api/panel/fidelizacion')).status, 403);
});

test('solo el negocio contacta a las clientas: las colaboradoras ven el celular oculto y agendan a una clienta reciente sin verlo', async () => {
  const karla = cliente(base);
  assert.equal((await karla.pedir('/api/auth/login', { metodo: 'POST', datos: { id: ids.karla, pin: '1357' } })).status, 200);
  const nueva = await reservar({ servicios: [ids['lifting-pestanas']], con: 'karla', fecha: DIA, inicio: 1020, nombre: 'Oculta Ficticia', celular: '3005550777' });
  assert.equal(nueva.status, 200, JSON.stringify(nueva.cuerpo));
  const ag = await karla.pedir(`/api/panel/agenda?desde=${DIA}&hasta=${DIA}`);
  const mia = ag.cuerpo.citas.find((c) => c.clienta_nombre.startsWith('Oculta'));
  assert.ok(mia, 've su cita');
  assert.equal(mia.clienta_celular, '•••• 0777', 'celular oculto para la colaboradora');
  const det = await karla.pedir(`/api/panel/citas/${mia.id}`);
  assert.doesNotMatch(JSON.stringify(det.cuerpo), /3005550777|573005550777/, 'el detalle tampoco trae el celular');
  const cls = await karla.pedir('/api/panel/clientas');
  if (cls.status === 200) assert.ok(cls.cuerpo.clientas.every((c) => c.celular.startsWith('••••')));
  // Erika sí lo ve
  const agE = await erika.pedir(`/api/panel/agenda?desde=${DIA}&hasta=${DIA}`);
  assert.equal(agE.cuerpo.citas.find((c) => c.id === mia.id).clienta_celular, '573005550777');
  // Karla agenda otra vez a esa clienta por id, sin saber su celular
  const otra = await karla.pedir('/api/panel/citas', { metodo: 'POST', datos: { servicios: [ids['lifting-pestanas']], colaboradora_id: ids.karla, fecha: proximoDiaHabil(6), inicio: 600, clienta_id: mia.clienta_id } });
  assert.equal(otra.status, 200, JSON.stringify(otra.cuerpo));
  // Novedades al instante: Karla se entera de una reserva nueva suya, no de las de otras
  const base0 = (await karla.pedir('/api/panel/novedades?desde=0')).cuerpo.ultimo;
  await reservar({ servicios: [ids['lifting-pestanas']], con: 'karla', fecha: proximoDiaHabil(6), inicio: 780, nombre: 'Novedad Ficticia', celular: '3005550778' });
  await reservar({ servicios: [ids.tradicional], con: 'leidy', fecha: proximoDiaHabil(6), inicio: 780, nombre: 'Ajena Ficticia', celular: '3005550779' });
  const nov = (await karla.pedir(`/api/panel/novedades?desde=${base0}`)).cuerpo;
  assert.deepEqual(nov.novedades.map((n) => n.clienta), ['Novedad Ficticia']);
  const novE = (await erika.pedir(`/api/panel/novedades?desde=${base0}`)).cuerpo;
  assert.equal(novE.novedades.length, 2, 'Erika ve todas');
});

test('equipo: el PIN escrito en Acceso se guarda también con el botón "Guardar"', { skip: !chromium && 'Playwright no disponible' }, async () => {
  const b = await chromium.launch();
  try {
    const ctx = await b.newContext({ viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true });
    await ctx.addInitScript(() => localStorage.setItem('amelia_tour_omitir', '1'));
    const p = await ctx.newPage();
    await p.goto(`${base}/panel/`, { waitUntil: 'networkidle' });
    await p.click('.persona >> text=Erika');
    for (const d of '2468') await p.click(`.tecla[data-n="${d}"]`);
    await p.click('#entrar');
    await p.waitForSelector('.dock');
    await p.goto(`${base}/panel/#/equipo`);
    await p.click('.tarjeta-equipo >> text=Julieth');
    await p.click('[data-tab="acceso"]');
    await p.fill('#formColab [name=pin]', '2580');
    await p.click('#guardarColab');
    await p.waitForSelector('#formColab', { state: 'detached' });
    const jul = cliente(base);
    assert.equal((await jul.pedir('/api/auth/login', { metodo: 'POST', datos: { id: ids.julieth, pin: '2580' } })).status, 200, 'el PIN quedó guardado');
    await erika.pedir(`/api/panel/colaboradoras/${ids.julieth}/pin`, { metodo: 'POST', datos: { pin: '1357' } });
  } finally { await b.close(); }
});

test('notas, plantillas y promociones con sus permisos', async () => {
  const karla = cliente(base);
  await karla.pedir('/api/auth/login', { metodo: 'POST', datos: { id: ids.karla, pin: '1357' } });
  const n = await karla.pedir('/api/panel/notas', { metodo: 'POST', datos: { texto: 'Pedir esmalte nude' } });
  assert.equal(n.status, 200);
  const nE = await erika.pedir('/api/panel/notas', { metodo: 'POST', datos: { texto: 'Nota de Erika' } });
  assert.equal((await karla.pedir(`/api/panel/notas/${nE.cuerpo.id}`, { metodo: 'DELETE' })).status, 403);
  assert.equal((await karla.pedir(`/api/panel/notas/${n.cuerpo.id}`, { metodo: 'DELETE' })).status, 200);
  assert.equal((await karla.pedir('/api/panel/plantillas/recordatorio', { metodo: 'PUT', datos: { texto: 'Hola {nombre}' } })).status, 403);
  assert.equal((await erika.pedir('/api/panel/plantillas/recordatorio', { metodo: 'PUT', datos: { texto: 'Hola {nombre}, te esperamos el {fecha}' } })).status, 200);
  const pl = await karla.pedir('/api/panel/plantillas');
  assert.match(pl.cuerpo.plantillas.find((p) => p.clave === 'recordatorio').texto, /te esperamos/);
  assert.equal((await karla.pedir('/api/panel/promociones', { metodo: 'POST', datos: { titulo: 'X' } })).status, 403);
  await erika.pedir('/api/panel/promociones', { metodo: 'POST', datos: { titulo: 'Martes de semi', servicio_id: ids.semipermanente, precio_promo: 39000, activa: true } });
  await erika.pedir('/api/panel/promociones', { metodo: 'POST', datos: { titulo: 'Vencida', activa: true, hasta: '2020-01-01' } });
  const cat = await cliente(base).pedir('/api/public/catalogo');
  assert.deepEqual(cat.cuerpo.promociones.map((p) => p.titulo), ['Martes de semi']);
  assert.equal(cat.cuerpo.promociones[0].servicio_slug, 'semipermanente');
  assert.ok(Array.isArray(cat.cuerpo.populares));
});

test('mis citas (app de la clienta) con los enlaces guardados en el celular', async () => {
  const r = await reservar({ servicios: [ids.forrado], con: 'leidy', fecha: DIA, inicio: 690, nombre: 'App Ficticia', celular: '3005550700' });
  assert.equal(r.status, 200);
  const m = await cliente(base).pedir(`/api/public/mis-citas?tokens=${r.cuerpo.token},token-que-no-existe-123456,<script>`);
  assert.equal(m.cuerpo.citas.length, 1);
  assert.equal(m.cuerpo.citas[0].codigo, r.cuerpo.codigo);
  assert.ok(!('clienta_celular' in m.cuerpo.citas[0]), 'no expone el celular');
});

test('notificaciones push: equipo avisado de citas nuevas, recordatorios 24 h / 2 h a la clienta, sin duplicados', async () => {
  const { descifrarPush } = await import('../tests/ayuda-push.mjs');
  const navegador = async (nombre) => {
    const par = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    const auth = crypto.getRandomValues(new Uint8Array(16));
    return {
      par, auth, nombre,
      sub: { endpoint: `${PUSH.base}/push/${nombre}`, keys: { p256dh: b64u(await crypto.subtle.exportKey('raw', par.publicKey)), auth: b64u(auth) } },
      recibidos: () => PUSH.recibidos.filter((r) => r.ruta === `/push/${nombre}`),
      async ultimo() { const l = this.recibidos(); return JSON.parse(await descifrarPush(new Uint8Array(l.at(-1).cuerpo), par, auth)); },
    };
  };
  const esperar = async (fn, ms = 6000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return true; await new Promise((r) => setTimeout(r, 100)); } return false; };

  assert.equal((await cliente(base).pedir('/api/public/push/clave')).cuerpo.clave, VAPID.publica);
  const karla = cliente(base);
  await karla.pedir('/api/auth/login', { metodo: 'POST', datos: { id: ids.karla, pin: '1357' } });
  const navK = await navegador('karla'), navE = await navegador('erika');
  assert.equal((await karla.pedir('/api/panel/push/suscribir', { metodo: 'POST', datos: { suscripcion: navK.sub } })).status, 200);
  assert.equal((await erika.pedir('/api/panel/push/suscribir', { metodo: 'POST', datos: { suscripcion: navE.sub } })).status, 200);
  const mala = await karla.pedir('/api/panel/push/suscribir', { metodo: 'POST', datos: { suscripcion: { ...navK.sub, endpoint: 'https://evil.example.com/x' } } });
  assert.equal(mala.status, 400, 'no acepta URLs que no sean servicios de push');

  // 1) Reserva en línea con Karla → avisa a Karla y a Erika
  const r = await reservar({ servicios: [ids.semipermanente], con: 'karla', fecha: DIA, inicio: 780, nombre: 'Push Ficticia', celular: '3005550800' });
  assert.equal(r.status, 200, JSON.stringify(r.cuerpo));
  assert.ok(await esperar(() => navK.recibidos().length >= 1 && navE.recibidos().length >= 1), 'llegan los avisos');
  const msgK = await navK.ultimo();
  assert.match(msgK.titulo, /Nueva reserva en línea/);
  assert.match(msgK.cuerpo, /Push Ficticia/);
  assert.match(msgK.url, /^\/panel\/#\/agenda\//);
  // la petición lleva VAPID válido y cifrado aes128gcm
  const req = navK.recibidos().at(-1);
  assert.equal(req.cabeceras['content-encoding'], 'aes128gcm');
  const m = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(req.cabeceras.authorization);
  const pub = await crypto.subtle.importKey('raw', deB64u(VAPID.publica), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  assert.ok(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, deB64u(m[3]), new TextEncoder().encode(`${m[1]}.${m[2]}`)));

  // 2) Erika crea una cita para Karla desde el panel → avisa a Karla, no a Erika (ella hizo el cambio)
  const antesE = navE.recibidos().length, antesK = navK.recibidos().length;
  const cp = await erika.pedir('/api/panel/citas', { metodo: 'POST', datos: { servicios: [ids.forrado], colaboradora_id: ids.karla, fecha: DIA, inicio: 900, nombre: 'Panel Ficticia', celular: '3005550801', forzar: true } });
  assert.equal(cp.status, 200, JSON.stringify(cp.cuerpo));
  assert.ok(await esperar(() => navK.recibidos().length > antesK));
  await new Promise((s) => setTimeout(s, 500));
  assert.equal(navE.recibidos().length, antesE, 'quien hace el cambio no se auto-notifica');

  // 3) Suscripción vencida (410) se borra sola
  const leidy = cliente(base);
  await leidy.pedir('/api/auth/login', { metodo: 'POST', datos: { id: ids.leidy, pin: '1357' } });
  const navL = await navegador('expirada');
  await leidy.pedir('/api/panel/push/suscribir', { metodo: 'POST', datos: { suscripcion: navL.sub } });
  const cv = await erika.pedir('/api/panel/citas', { metodo: 'POST', datos: { servicios: [ids.forrado], colaboradora_id: ids.leidy, fecha: DIA, inicio: 1200, nombre: 'Vence Ficticia', celular: '3005550802', forzar: true } });
  assert.equal(cv.status, 200, JSON.stringify(cv.cuerpo));
  assert.ok(await esperar(() => navL.recibidos().length >= 1));
  await new Promise((s) => setTimeout(s, 400));
  assert.equal((await leidy.pedir('/api/panel/push/prueba', { metodo: 'POST', datos: {} })).status, 404, 'la suscripción vencida se eliminó');

  // 4) La clienta activa recordatorios con su enlace privado
  const cita = await reservar({ servicios: [ids.forrado], con: 'daily', fecha: DIA, inicio: 600, nombre: 'Recuerda Ficticia', celular: '3005550803' });
  assert.equal(cita.status, 200, JSON.stringify(cita.cuerpo));
  const navC = await navegador('clienta');
  assert.equal((await cliente(base).pedir('/api/public/push/suscribir', { metodo: 'POST', datos: { suscripcion: navC.sub, tokens: ['token-falso-que-no-existe-000'] } })).status, 404);
  assert.equal((await cliente(base).pedir('/api/public/push/suscribir', { metodo: 'POST', datos: { suscripcion: navC.sub, tokens: [cita.cuerpo.token] } })).status, 200);

  const disparar = (ahora_ms, clave = CRON_CLAVE) => fetch(base + '/api/interno/recordatorios', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Cron-Clave': clave }, body: JSON.stringify({ ahora_ms }),
  });
  assert.equal((await disparar(Date.now(), 'clave-equivocada-1234567')).status, 404, 'sin la clave no se puede disparar');
  const inicioMs = Date.parse(DIA + 'T00:00:00Z') + (600 + 300) * 60000; // 10:00 Bogotá en UTC
  // Confirmación al activar los avisos (una sola vez por cita)
  assert.ok(await esperar(() => navC.recibidos().length >= 1), 'llega la confirmación al agendar');
  assert.match((await navC.ultimo()).titulo, /Tu cita quedó agendada/);
  // Víspera: el día anterior entre 6 y 9 p. m. (aquí 7:00 p. m.)
  const vis = await (await disparar(inicioMs - 15 * 3600000)).json();
  assert.equal(vis.vispera, 1, JSON.stringify(vis));
  assert.equal((await (await disparar(inicioMs - 14.5 * 3600000)).json()).vispera, 0, 'no se repite');
  // Mañana del mismo día: no repite si ya recibió la de la víspera; Erika recibe el resumen del día
  const man = await (await disparar(inicioMs - 135 * 60000)).json();
  assert.equal(man.dia, 0, JSON.stringify(man));
  assert.ok(man.eq_dia >= 1, 'resumen de la mañana al equipo');
  // 1 hora antes
  const r1 = await (await disparar(inicioMs - 60 * 60000)).json();
  assert.equal(r1.r1, 1, JSON.stringify(r1));
  assert.ok(await esperar(() => navC.recibidos().length >= 3));
  const msgC = await navC.ultimo();
  assert.match(msgC.titulo, /Recuerda, tu cita es en 1 hora/);
  assert.match(msgC.cuerpo, /Forrado a las 10:00 a\. m\. con Daily/);
  assert.equal(msgC.url, `/reservar/cita/#${cita.cuerpo.token}`);
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
    // Un día futuro: si fuera hoy, la cita podría quedar a menos de 4 h y ya no se podría reprogramar en línea.
    await p.click(`.dia[data-fecha="${DIA}"]`);
    await p.waitForSelector(`.dia[data-fecha="${DIA}"][aria-selected="true"]`);
    await p.waitForSelector('.turno');
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
    assert.match(r.headers.get('content-security-policy'), /script-src 'self'( https:\/\/static\.cloudflareinsights\.com)?;/);
  } finally { await b.close(); }
});

test('navegador: panel de Erika (computador y celular) y de una colaboradora', { skip: !chromium && 'Playwright no disponible' }, async () => {
  const b = await chromium.launch();
  try {
    const ctx = await b.newContext({ viewport: { width: 1366, height: 860 }, deviceScaleFactor: 1 });
    await ctx.addInitScript(() => { try { localStorage.setItem('amelia_tour_omitir', '1'); } catch { /* nada */ } });
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
    await movil.addInitScript(() => { try { localStorage.setItem('amelia_tour_omitir', '1'); } catch { /* nada */ } });
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

test('caché: HTML/CSS/JS de la plataforma siempre se revalidan; fuentes por un año; pestañas y cejas con su foto', async () => {
  for (const ruta of ['/reservar/', '/reservar/reservar.js', '/reservar/reservar.css', '/panel/', '/panel/js/main.js', '/panel/sw.js', '/app-citas/base.css', '/app-citas/js/util.js']) {
    const r = await fetch(base + ruta);
    assert.equal(r.status, 200, ruta);
    assert.equal(r.headers.get('cache-control'), 'no-cache', ruta);
    const etag = r.headers.get('etag');
    if (etag) assert.equal((await fetch(base + ruta, { headers: { 'If-None-Match': etag } })).status, 304, `${ruta} responde 304 si no cambió`);
  }
  assert.match((await fetch(base + '/app-citas/fonts/dmsans.woff2')).headers.get('cache-control'), /max-age=31536000/);
  const conVersion = (await (await fetch(base + '/reservar/')).text()).match(/\/reservar\/reservar\.js\?v=[0-9a-f]{10}/);
  assert.ok(conVersion, 'la página carga sus archivos con ?v=<huella>');
  assert.match((await fetch(base + conVersion[0])).headers.get('cache-control'), /max-age=31536000, immutable/, 'lo versionado se guarda un año');
  const cat = await cliente(base).pedir('/api/public/catalogo');
  for (const slug of ['lifting-pestanas', 'pestanas-punto-a-punto', 'laminado-cejas', 'sombreado-cejas']) {
    const s = cat.cuerpo.servicios.find((x) => x.slug === slug);
    if (!s) continue;
    assert.doesNotMatch(s.foto, /\/arte\//, `${slug} ya no usa el arte`);
    assert.ok(s.medios.some((m) => m.url === `/img/${slug}-720.webp`), `${slug} tiene su foto en la galería`);
  }
});

test('galerías: catálogo con fotos y video, edición solo de Erika, subida sin R2 responde amable', async () => {
  const cat = await cliente(base).pedir('/api/public/catalogo');
  const press = cat.cuerpo.servicios.find((s) => s.slug === 'press-on');
  assert.ok(press.medios.length >= 5, 'Press On trae su galería');
  assert.equal(press.medios[0].tipo, 'video');
  assert.match(press.medios[0].portada, /^\/img\//);
  assert.ok(cat.cuerpo.ajustes.bienvenida_titulo);
  assert.ok(Array.isArray(cat.cuerpo.festivos), 'el catálogo trae los días cerrados');
  const karla = cliente(base);
  await karla.pedir('/api/auth/login', { metodo: 'POST', datos: { id: ids.karla, pin: '1357' } });
  assert.equal((await karla.pedir(`/api/panel/servicios/${press.id}/medios`, { metodo: 'PUT', datos: { medios: [] } })).status, 403);
  const malo = await erika.pedir(`/api/panel/servicios/${press.id}/medios`, { metodo: 'PUT', datos: { medios: [{ tipo: 'foto', url: 'javascript:alert(1)' }] } });
  assert.equal(malo.status, 400, 'solo enlaces https o fotos del sitio');
  const nuevos = [{ tipo: 'foto', url: '/img/press-on-3-720.webp' }, ...press.medios];
  assert.equal((await erika.pedir(`/api/panel/servicios/${press.id}/medios`, { metodo: 'PUT', datos: { medios: nuevos } })).status, 200);
  const cat2 = await cliente(base).pedir('/api/public/catalogo');
  const press2 = cat2.cuerpo.servicios.find((s) => s.slug === 'press-on');
  assert.equal(press2.medios[0].url, '/img/press-on-3-720.webp', 'respeta el orden');
  assert.equal(press2.foto, '/img/press-on-3-720.webp', 'la primera foto es la principal');
  const sub = await fetch(base + '/api/panel/subir', { method: 'POST', headers: { 'Content-Type': 'image/png', Cookie: erika.cookie }, body: new Uint8Array([137, 80, 78, 71]) });
  assert.equal(sub.status, 501, 'sin bucket R2 avisa que la subida no está activa');
  // perfil propio y apariencia
  assert.equal((await karla.pedir('/api/panel/mi-perfil', { metodo: 'PUT', datos: { color: '#00897B', foto: '/img/karla-600.webp' } })).status, 200);
  assert.equal((await karla.pedir('/api/panel/mi-perfil', { metodo: 'PUT', datos: { color: 'rojo' } })).status, 400);
  assert.equal((await karla.pedir('/api/panel/ajustes', { metodo: 'PUT', datos: { bienvenida_titulo: 'X' } })).status, 403);
  assert.equal((await erika.pedir('/api/panel/ajustes', { metodo: 'PUT', datos: { bienvenida_titulo: 'Consiéntete hoy', color_acento: 'ciruela' } })).status, 200);
  assert.equal((await erika.pedir('/api/panel/ajustes', { metodo: 'PUT', datos: { color_acento: 'verde' } })).status, 400);
  const cat3 = await cliente(base).pedir('/api/public/catalogo');
  assert.equal(cat3.cuerpo.ajustes.bienvenida_titulo, 'Consiéntete hoy');
  assert.equal(cat3.cuerpo.ajustes.color_acento, 'ciruela');
});

for (const ancho of [360, 390]) {
  test(`panel a ${ancho} px: ninguna pantalla se desborda a lo ancho y el menú inferior responde`, { skip: !chromium && 'Playwright no disponible' }, async () => {
    const b = await chromium.launch();
    try {
      const ctx = await b.newContext({ viewport: { width: ancho, height: 780 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, locale: 'en-US' });
      await ctx.addInitScript(() => localStorage.setItem('amelia_tour_omitir', '1'));
      const p = await ctx.newPage();
      const errores = [];
      p.on('pageerror', (e) => errores.push(e.message));
      const revisar = async (donde) => {
        await p.waitForLoadState('networkidle');
        await p.waitForTimeout(250);
        const w = await p.evaluate(() => document.documentElement.scrollWidth);
        const culpables = w > ancho ? await p.evaluate((a) => [...document.querySelectorAll('body *')].filter((e) => e.getBoundingClientRect().right > a + 0.5)
          .slice(-4).map((e) => `${e.tagName.toLowerCase()}.${[...e.classList].join('.')}#${e.id}`), ancho) : [];
        assert.ok(w <= ancho, `${donde}: la página mide ${w}px en una pantalla de ${ancho}px (${culpables.join(', ')})`);
        const mas = await p.$('.dock a[data-sec="mas"]');
        if (mas && !(await p.$('.hoja'))) {
          const ok = await mas.evaluate((el) => { const r = el.getBoundingClientRect(); const x = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!x && el.contains(x); });
          assert.ok(ok, `${donde}: el botón "Más" queda tapado`);
        }
      };
      const entrar = async (quien, pin) => {
        await p.goto(`${base}/panel/`, { waitUntil: 'networkidle' });
        await p.click(`.persona >> text=${quien}`);
        for (const d of pin) await p.click(`.tecla[data-n="${d}"]`);
        await p.click('#entrar');
        await p.waitForSelector('.dock');
      };
      // Botón "Descargar la app" apenas se abre el panel (sin instalador del sistema → muestra los pasos)
      await p.goto(`${base}/panel/`, { waitUntil: 'networkidle' });
      await p.click('.ingreso [data-descargar]');
      await p.waitForSelector('.pasos-descarga li');
      if (ancho === 390) await p.screenshot({ path: CAPTURAS + 'movil-panel-9-descargar.png' });
      await p.click('.hoja-descarga .btn.bloque');
      await entrar('Erika', '2468');
      await p.waitForSelector('#tarjetaDescarga [data-descargar]');
      await p.click('#tdOcultar');
      await p.waitForSelector('#tarjetaDescarga', { state: 'detached' });
      for (const sec of ['inicio', `agenda/${DIA}/lista/`, `agenda/${DIA}/dia/`, `agenda/${DIA}/semana/`, 'clientas', 'fidelizacion', 'analitica', 'notas',
        'servicios', 'promociones', 'equipo', 'mensajes', 'spa', 'ajustes', 'importar', 'cuenta', 'mas']) {
        await p.goto(`${base}/panel/#/${sec}`);
        await revisar(`#/${sec}`);
      }
      await p.goto(`${base}/panel/#/servicios`);
      await p.click('.fila-servicio >> nth=0');
      await revisar('ficha de servicio');
      await p.goto(`${base}/panel/#/equipo`);
      await p.waitForSelector('.tarjeta-equipo');
      await p.click('.tarjeta-equipo >> nth=1');
      await p.click('[data-tab="horario"]');
      await revisar('horario de una colaboradora');
      await p.click('.he-modo >> nth=0');
      await p.selectOption('.he-modo >> nth=0', 'propio');
      await revisar('horario propio de una colaboradora');
      await p.goto(`${base}/panel/#/spa`);
      await p.waitForSelector('.he-fila');
      await p.screenshot({ path: CAPTURAS + `movil-panel-8-horario-${ancho}.png` });
      await p.click('.dock a[data-sec="mas"]');
      await p.waitForURL(/#\/mas/);
      await p.context().clearCookies();
      await entrar('Karla', '1357');
      for (const sec of ['inicio', `agenda/${DIA}/lista/`, 'notas', 'cuenta', 'mas']) {
        await p.goto(`${base}/panel/#/${sec}`);
        await revisar(`colaboradora #/${sec}`);
      }
      assert.deepEqual(errores, []);
    } finally { await b.close(); }
  });
}

for (const [nombre, disp] of [['iPhone 13', 'iPhone 13'], ['Android 360 px', 'Galaxy S8']]) {
  test(`celular (${nombre}): reserva con ficha y galería, en pocos toques`, { skip: !chromium && 'Playwright no disponible' }, async () => {
    const b = await chromium.launch();
    try {
      const ctx = await b.newContext({ ...devices[disp] });
      const p = await ctx.newPage();
      const errores = [];
      p.on('pageerror', (e) => errores.push(e.message));
      await p.goto(`${base}/reservar/`, { waitUntil: 'networkidle' });
      const ancho = devices[disp].viewport.width;
      assert.ok(await p.evaluate((w) => document.documentElement.scrollWidth <= w, ancho), 'sin desplazamiento horizontal');
      assert.match(await p.textContent('#heroReserva h1'), /Consiéntete hoy/);
      // áreas táctiles de 48 px o más
      for (const sel of ['.chip', '.servicio-marca', '.servicio-abrir']) {
        const alto = await p.$eval(sel, (e) => e.getBoundingClientRect().height);
        assert.ok(alto >= 48, `${sel} mide ${alto}px`);
      }
      const suf = disp === 'Galaxy S8' ? '-android' : '';
      await p.screenshot({ path: CAPTURAS + `movil-reservar-1-inicio${suf}.png` });
      const img = await p.$eval('.servicio-foto img[srcset]', (e) => ({ srcset: e.getAttribute('srcset') || '', w: e.getAttribute('width'), lazy: e.loading, actual: e.currentSrc }));
      assert.match(img.srcset, /-320\.webp 320w/, 'fotos con srcset');
      assert.ok(img.w && img.lazy === 'lazy', 'tamaño reservado y carga diferida');
      assert.doesNotMatch(img.actual, /-(960|1080|1200|1440)\.webp/, 'el celular no baja la foto grande');
      // Toque 1: abrir la ficha de Press On (galería con video)
      await p.click('.servicio-abrir >> text=Press On');
      await p.waitForSelector('.ficha-carrusel .ficha-medio');
      assert.ok((await p.$$('.ficha-carrusel .ficha-medio')).length >= 5);
      assert.ok(await p.$('.ficha-carrusel video[preload="none"][muted]'), 'video discreto: sin sonido y sin precarga');
      await p.screenshot({ path: CAPTURAS + `movil-reservar-2-ficha${suf}.png` });
      // Tocar una foto de las uñas la abre en grande
      await p.click('.ficha-medio[data-ver] >> nth=0');
      await p.waitForSelector('.visor .visor-foto img');
      await p.waitForTimeout(300);
      await p.screenshot({ path: CAPTURAS + `movil-reservar-2b-foto-grande${suf}.png` });
      await p.click('.visor-cerrar');
      await p.waitForSelector('.visor', { state: 'detached' });
      await p.waitForTimeout(400);
      assert.ok(await p.isVisible('#fichaAgendar'), 'al cerrar la foto con la X sigue en la ficha');
      // "Atrás" del celular respeta el orden: foto → ficha → lista
      await p.click('.ficha-medio[data-ver] >> nth=0');
      await p.waitForSelector('.visor .visor-marco img');
      await p.goBack();
      await p.waitForSelector('.visor', { state: 'detached' });
      await p.waitForTimeout(400);
      assert.ok(await p.isVisible('#fichaAgendar'), 'atrás cierra solo la foto');
      await p.goBack();
      await p.waitForSelector('.hoja.ficha', { state: 'detached' });
      assert.ok(await p.isVisible('.servicio-abrir >> text=Press On'), 'atrás otra vez cierra la ficha y queda la lista');
      // La miniatura de la tarjeta abre las fotos directamente
      await p.click('.servicio:has(.servicio-abrir:has-text("Press On")) .servicio-zoom');
      await p.waitForSelector('.visor .visor-marco img');
      await p.keyboard.press('Escape');
      await p.waitForSelector('.visor', { state: 'detached' });
      await p.click('.servicio-abrir >> text=Press On');
      await p.waitForSelector('#fichaAgendar');
      // Toque 2: agendar este servicio → profesional
      await p.click('#fichaAgendar');
      await p.waitForSelector('.pro');
      await p.waitForLoadState('networkidle');
      await p.screenshot({ path: CAPTURAS + `movil-reservar-3-profesional${suf}.png` });
      // Tocar la foto de una profesional la muestra en grande, sin elegirla
      await p.click('.pro-foto >> nth=0');
      await p.waitForSelector('.visor figcaption strong');
      await p.waitForTimeout(400);
      await p.screenshot({ path: CAPTURAS + `movil-reservar-3b-profesional-grande${suf}.png` });
      await p.click('.visor-cerrar');
      await p.waitForSelector('.visor', { state: 'detached' });
      assert.ok(await p.isVisible('.pro.cualquiera'), 'sigue en la lista de profesionales');
      // Toque 3: cualquiera disponible → horario en día futuro
      await p.click('.pro.cualquiera');
      await p.waitForSelector('.turno');
      await p.click(`.dia[data-fecha="${DIA}"]`);
      await p.waitForSelector(`.dia[data-fecha="${DIA}"][aria-selected="true"]`);
      await p.waitForSelector('.turno');
      const altoTurno = await p.$eval('.turno', (e) => e.getBoundingClientRect().height);
      assert.ok(altoTurno >= 48);
      await p.click('.turno >> nth=-1');
      await p.screenshot({ path: CAPTURAS + `movil-reservar-4-horario${suf}.png` });
      assert.equal(await p.isVisible('#btnSeguir'), true, 'botón principal fijo abajo');
      await p.click('#btnSeguir');
      // Volver con "atrás" no pierde lo elegido
      await p.goBack();
      await p.waitForSelector('.turno[aria-pressed="true"]');
      await p.click('#btnSeguir');
      await p.fill('[name=nombre]', `Celular Ficticia ${nombre}`);
      await p.fill('[name=celular]', disp === 'Galaxy S8' ? '300 555 0901' : '300 555 0902');
      await p.check('[name=politica]');
      const boton = await p.$eval('#btnReservar', (e) => { const r = e.getBoundingClientRect(); return { alto: r.height, abajo: window.innerHeight - r.bottom }; });
      assert.ok(boton.alto >= 52, 'botón de confirmar grande');
      await p.screenshot({ path: CAPTURAS + `movil-reservar-5-datos${suf}.png` });
      await p.click('#btnReservar');
      await p.waitForSelector('.listo .codigo');
      await p.waitForTimeout(500);
      await p.screenshot({ path: CAPTURAS + `movil-reservar-6-listo${suf}.png` });
      const wa = await p.getAttribute('.btn.wa', 'href');
      assert.ok(wa.startsWith('https://wa.me/573107027012'));
      assert.deepEqual(errores, []);
    } finally { await b.close(); }
  });

  test(`celular (${nombre}): panel tipo app — tarjetas, llegó, cobrar, agendar con +`, { skip: !chromium && 'Playwright no disponible' }, async () => {
    const b = await chromium.launch();
    try {
      const ctx = await b.newContext({ ...devices[disp] });
      const p = await ctx.newPage();
      const errores = [];
      p.on('pageerror', (e) => errores.push(e.message));
      const suf = disp === 'Galaxy S8' ? '-android' : '';
      await p.goto(`${base}/panel/`, { waitUntil: 'networkidle' });
      await p.click('.persona >> text=Erika');
      for (const d of '2468') await p.click(`.tecla[data-n="${d}"]`);
      await p.click('#entrar');
      // Tour de bienvenida (primera vez): se puede saltar
      await p.waitForSelector('.tour-tarjeta');
      await p.waitForTimeout(400);
      await p.screenshot({ path: CAPTURAS + `movil-panel-0-tour${suf}.png` });
      await p.click('#tourSaltar');
      await p.waitForSelector('.stats .stat:not(.esqueleto)');
      await p.screenshot({ path: CAPTURAS + `movil-panel-1-inicio${suf}.png` });
      await p.goto(`${base}/panel/#/agenda/${DIA}/lista/`);
      await p.waitForSelector('.tarjeta-cita');
      await p.waitForTimeout(300);
      await p.screenshot({ path: CAPTURAS + `movil-panel-2-tarjetas${suf}.png` });
      const accion = await p.$eval('.tc-acciones > *', (e) => e.getBoundingClientRect().height);
      assert.ok(accion >= 48, 'acciones de un toque grandes');
      // Llegó (un toque)
      const primera = await p.$('.tarjeta-cita:has([data-accion="asistio"]:not([aria-pressed="true"]))');
      const idCita = await primera.getAttribute('data-cita');
      await p.click(`.tarjeta-cita[data-cita="${idCita}"] [data-accion="asistio"]`);
      await p.waitForSelector(`.tarjeta-cita[data-cita="${idCita}"] [data-accion="asistio"][aria-pressed="true"]`);
      // Cobrar
      await p.click(`.tarjeta-cita[data-cita="${idCita}"] [data-accion="cobrar"]`);
      await p.waitForSelector('#formCobro');
      await p.fill('#formCobro [name=monto]', '50000');
      await p.click('[data-metodo="nequi"]');
      await p.screenshot({ path: CAPTURAS + `movil-panel-3-cobrar${suf}.png` });
      await p.click('#guardarCobro');
      await p.waitForSelector('#formCobro', { state: 'detached' });
      // Agendar con el botón + : servicio → hora → clienta reciente → guardar
      await p.click('#fab');
      await p.waitForSelector('#formCita');
      await p.click('[data-serv] >> nth=0');
      const otroDia = new Date(Date.parse(DIA + 'T12:00:00Z') + (disp === 'Galaxy S8' ? 2 : 1) * 86400000).toISOString().slice(0, 10);
      await p.fill('#formCita [name=fecha]', otroDia);
      await p.dispatchEvent('#formCita [name=fecha]', 'change');
      await p.waitForSelector('#turnosNueva .turno');
      await p.click('#turnosNueva .turno >> nth=-1');
      await p.waitForSelector('#chipsRecientes .chip');
      await p.click('#chipsRecientes .chip >> nth=0');
      await p.screenshot({ path: CAPTURAS + `movil-panel-4-nueva-cita${suf}.png` });
      await p.click('#guardarCita');
      await p.waitForSelector('#formCita', { state: 'detached' });
      // Bloqueo rápido
      await p.goto(`${base}/panel/#/agenda/${DIA}/lista/`);
      await p.waitForSelector('.tira-dias');
      await p.goto(`${base}/panel/#/cuenta`);
      await p.waitForSelector('#misColores');
      await p.screenshot({ path: CAPTURAS + `movil-panel-5-mi-cuenta${suf}.png` });
      await p.goto(`${base}/panel/#/ajustes`);
      await p.waitForSelector('#previaHero');
      await p.screenshot({ path: CAPTURAS + `movil-panel-6-apariencia${suf}.png` });
      await p.goto(`${base}/panel/#/servicios`);
      await p.click('.fila-servicio >> text=Press On');
      await p.click('[data-tab="galeria"]');
      await p.waitForSelector('.galeria-editor .ge-item');
      await p.screenshot({ path: CAPTURAS + `movil-panel-7-galeria${suf}.png` });
      assert.ok(await p.evaluate((w) => document.documentElement.scrollWidth <= w, devices[disp].viewport.width), 'sin desplazamiento horizontal');
      assert.deepEqual(errores, []);
    } finally { await b.close(); }
  });
}

