// Pruebas unitarias (sin servidor): node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { turnosDelDia } from '../functions/_lib/disponibilidad.js';
import { celular, slugDe, fecha as validarFecha } from '../functions/_lib/validar.js';
import { precioDe, duracionDe, fechaDe, horaDe, horarioDe, cumpleDe } from '../functions/_lib/rutas/importar.js';
import { generarICS, plegar, escaparICS } from '../functions/_lib/ics.js';
import { hashPin, verificarPin } from '../functions/_lib/auth.js';
import { ahoraBogota, aUTC, diaSemana, horaTexto } from '../functions/_lib/tiempo.js';
import { leerCSV, aObjetos, detectarSeparador } from '../public/app-citas/js/csv.js';

const AJ = { intervalo_min: 15, anticipacion_min: 120, ventana_dias: 60 };
const SPA = { abierto: 1, abre: 540, cierra: 1140 }; // 9:00 a 19:00
const base = { fecha: '2026-12-01', duracion: 60, candidatas: [1, 2], horarioSpa: SPA, festivo: false, ajustes: AJ, ahora: { fecha: '2026-11-25', minuto: 600 } };

test('turnos: día libre de 9 a 19 con servicio de 60 min', () => {
  const t = turnosDelDia(base);
  assert.equal(t[0].inicio, 540);
  assert.equal(t.at(-1).inicio, 1080); // 18:00, termina 19:00
  assert.equal(t.length, (1080 - 540) / 15 + 1);
  assert.deepEqual(t[0].colaboradoras, [1, 2]);
});

test('turnos: citas y bloqueos ocupan solo a quien corresponde', () => {
  const t = turnosDelDia({
    ...base,
    ocupadas: [{ id: 9, colaboradora_id: 1, inicio: 600, fin: 690 }],
    bloqueos: [{ colaboradora_id: 2, inicio: 600, fin: 660 }],
  });
  const a10 = t.find((x) => x.inicio === 600);
  assert.equal(a10, undefined, 'a las 10 nadie está libre');
  assert.deepEqual(t.find((x) => x.inicio === 660).colaboradoras, [2], '11:00: solo la 2 (la 1 sigue ocupada hasta 11:30)');
  assert.equal(t.find((x) => x.inicio === 555), undefined, '9:15 se cruza para ambas');
  assert.deepEqual(t.find((x) => x.inicio === 540).colaboradoras, [1, 2]);
});

test('turnos: un turno que termina justo cuando empieza otra cita sí vale', () => {
  const t = turnosDelDia({ ...base, candidatas: [1], ocupadas: [{ id: 1, colaboradora_id: 1, inicio: 600, fin: 660 }] });
  assert.ok(t.some((x) => x.inicio === 540), '9:00–10:00 cabe antes de la cita de las 10');
  assert.ok(!t.some((x) => x.inicio === 555), '9:15–10:15 se cruza');
  assert.ok(t.some((x) => x.inicio === 660), '11:00 justo al terminar');
});

test('turnos: bloqueo general (todo el spa) afecta a todas', () => {
  const t = turnosDelDia({ ...base, bloqueos: [{ colaboradora_id: null, inicio: 720, fin: 780 }] });
  assert.ok(!t.some((x) => x.inicio > 660 && x.inicio < 780));
});

test('turnos: horario propio de la colaboradora y día que no trabaja', () => {
  const t = turnosDelDia({ ...base, horariosColab: { 1: { trabaja: 1, abre: 720, cierra: 900 }, 2: { trabaja: 0, abre: 0, cierra: 0 } } });
  assert.equal(t[0].inicio, 720);
  assert.equal(t.at(-1).fin, 900);
  assert.ok(t.every((x) => x.colaboradoras.length === 1 && x.colaboradoras[0] === 1));
});

test('turnos: festivo, spa cerrado, fecha pasada y fuera de ventana → nada', () => {
  assert.deepEqual(turnosDelDia({ ...base, festivo: true }), []);
  assert.deepEqual(turnosDelDia({ ...base, horarioSpa: { abierto: 0, abre: 540, cierra: 1140 } }), []);
  assert.deepEqual(turnosDelDia({ ...base, fecha: '2026-11-24' }), []);
  assert.deepEqual(turnosDelDia({ ...base, fecha: '2027-03-01' }), []);
  assert.ok(turnosDelDia({ ...base, fecha: '2027-03-01', personal: true }).length > 0, 'el panel puede agendar lejos');
});

test('turnos: anticipación mínima hoy (y que cruza la medianoche)', () => {
  const hoy = turnosDelDia({ ...base, fecha: '2026-11-25' }); // ahora 10:00 + 2 h
  assert.equal(hoy[0].inicio, 720);
  const noche = turnosDelDia({ ...base, fecha: '2026-11-26', ahora: { fecha: '2026-11-25', minuto: 23 * 60 }, ajustes: { ...AJ, anticipacion_min: 720 } });
  assert.equal(noche[0].inicio, 660, '23:00 + 12 h = 11:00 del día siguiente');
  const panel = turnosDelDia({ ...base, fecha: '2026-11-25', personal: true });
  assert.equal(panel[0].inicio, 600, 'el panel no exige anticipación, pero no agenda en el pasado');
});

test('turnos: duración larga no cabe al final del día; ignorarCita al reprogramar', () => {
  const t = turnosDelDia({ ...base, duracion: 120, candidatas: [1], ocupadas: [{ id: 5, colaboradora_id: 1, inicio: 540, fin: 1140 }] });
  assert.deepEqual(t, []);
  const r = turnosDelDia({ ...base, duracion: 120, candidatas: [1], ocupadas: [{ id: 5, colaboradora_id: 1, inicio: 540, fin: 1140 }], ignorarCita: 5 });
  assert.equal(r.at(-1).inicio, 1020);
});

test('celulares colombianos y extranjeros', () => {
  assert.equal(celular('300 123 4567'), '573001234567');
  assert.equal(celular('+57 (310) 702-7012'), '573107027012');
  assert.equal(celular('573107027012'), '573107027012');
  assert.equal(celular('+1 305 555 0100'), '13055550100');
  assert.throws(() => celular('12345'));
  assert.throws(() => celular('57123'));
  assert.throws(() => celular('5731070270'));
});

test('slugs y fechas', () => {
  assert.equal(slugDe('Pestañas & Cejas'), 'pestanas-y-cejas');
  assert.equal(slugDe('Depilación Cejas/Bozo'), 'depilacion-cejas-bozo');
  assert.throws(() => validarFecha('2026-02-30'));
  assert.equal(validarFecha('2028-02-29'), '2028-02-29');
});

test('importador: precios, duraciones, fechas y horas en formatos comunes', () => {
  assert.equal(precioDe('$45.000'), 45000);
  assert.equal(precioDe('45,000'), 45000);
  assert.equal(precioDe('120000'), 120000);
  assert.equal(precioDe('45.000,00'), 45000);
  assert.equal(precioDe(''), null);
  assert.equal(duracionDe('90'), 90);
  assert.equal(duracionDe('1:30'), 90);
  assert.equal(duracionDe('1h 30m'), 90);
  assert.equal(duracionDe('1 hora'), 60);
  assert.equal(duracionDe('1.5 h'), 90);
  assert.equal(duracionDe('47 min'), 50, 'redondea hacia arriba a 5');
  assert.equal(duracionDe('abc'), null);
  assert.equal(fechaDe('2026-12-05'), '2026-12-05');
  assert.equal(fechaDe('5/12/2026'), '2026-12-05');
  assert.equal(fechaDe('2026-12-05T10:00:00'), '2026-12-05');
  assert.equal(fechaDe('31/02/2026'), null);
  assert.equal(horaDe('14:30'), 870);
  assert.equal(horaDe('2:30 pm'), 870);
  assert.equal(horaDe('2:30 p. m.'), 870);
  assert.equal(horaDe('12:00 am'), 0);
  assert.equal(horaDe('9'), 540);
  assert.equal(horaDe('25:00'), null);
});

test('CSV: comillas, separador ; y encabezados de Kumbio', () => {
  const txt = '﻿Cliente;Teléfono;Correo electrónico;Observaciones\r\n"Gómez, Ana";300 111 2233;a@b.co;"Dice ""hola""\nsegunda línea"\r\n\r\nBea;3002223344;;\n';
  assert.equal(detectarSeparador(txt), ';');
  const filas = leerCSV(txt);
  assert.equal(filas.length, 3);
  assert.equal(filas[1][0], 'Gómez, Ana');
  assert.equal(filas[1][3], 'Dice "hola"\nsegunda línea');
  const { filas: obj, mapa } = aObjetos(filas, ['nombre', 'celular', 'email', 'notas']);
  assert.deepEqual(Object.values(mapa), ['nombre', 'celular', 'email', 'notas']);
  assert.equal(obj[1].celular, '3002223344');
});

test('ICS: escapa, pliega líneas largas y usa UTC', () => {
  assert.equal(escaparICS('a,b;c\nd'), 'a\\,b\\;c\\nd');
  const larga = 'DESCRIPTION:' + 'ñ'.repeat(100);
  assert.ok(plegar(larga).split('\r\n ').every((l) => new TextEncoder().encode(l).length <= 75));
  const ics = generarICS([{ uid: 'x@y', fecha: '2026-12-01', inicio: 600, fin: 660, titulo: 'Cita' }]);
  assert.match(ics, /DTSTART:20261201T150000Z/); // 10:00 Bogotá = 15:00 UTC
  assert.match(ics, /DTEND:20261201T160000Z/);
  assert.ok(ics.includes('\r\n'));
});

test('PIN: hash con sal, verificación y rechazo', async () => {
  const h1 = await hashPin('246813');
  const h2 = await hashPin('246813');
  assert.notEqual(h1, h2);
  assert.ok(await verificarPin('246813', h1));
  assert.ok(!(await verificarPin('246814', h1)));
  assert.ok(!(await verificarPin('abcdef', h1)));
  await assert.rejects(hashPin('12'));
  await assert.rejects(hashPin('2468'), /6 números/, 'los PIN nuevos son de 6 números');
  for (const facil of ['123456', '000000', '121212', '123123', '654321']) await assert.rejects(hashPin(facil), /fácil/, facil);
});

test('tiempo en Bogotá (UTC-5)', () => {
  assert.deepEqual(ahoraBogota(Date.UTC(2026, 11, 1, 3, 30)), { fecha: '2026-11-30', minuto: 22 * 60 + 30 });
  assert.equal(aUTC('2026-12-01', 0).toISOString(), '2026-12-01T05:00:00.000Z');
  assert.equal(diaSemana('2026-11-23'), 1);
  assert.equal(horaTexto(870), '2:30 p. m.');
  assert.equal(horaTexto(0), '12:00 a. m.');
});

test('importador: horario de colaboradoras (formato de la exportación de Kumbio) y cumpleaños', () => {
  const h = horarioDe('lun-sab 09:00-19:00; dom cerrado');
  assert.equal(h.length, 7);
  assert.deepEqual(h.find((x) => x.dia === 6), { dia: 6, trabaja: 1, abre: 540, cierra: 1140 });
  assert.equal(h.find((x) => x.dia === 0).trabaja, 0);
  assert.deepEqual(horarioDe('mar,jue 10:00-14:00').map((x) => x.dia), [2, 4]);
  assert.equal(horarioDe('lunes a viernes 9:00-17:00').length, 5);
  assert.deepEqual(horarioDe('vie-lun 10:00-12:00').map((x) => x.dia), [5, 6, 0, 1], 'rango que cruza el domingo');
  assert.throws(() => horarioDe('todos los días'));
  assert.throws(() => horarioDe('lun 18:00-09:00'));
  assert.equal(cumpleDe('1990-03-15'), '03-15');
  assert.equal(cumpleDe('15/03'), '03-15');
  assert.equal(cumpleDe('32/13'), '');
});

// ---------- Web Push (RFC 8291 / 8292) ----------
import { cifrar, cabeceraVapid, generarVapid, b64u, deB64u, endpointValido } from '../functions/_lib/push.js';
import { descifrarPush } from './ayuda-push.mjs';

test('push: el mensaje cifrado se descifra con la llave del navegador', async () => {
  const ua = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const auth = crypto.getRandomValues(new Uint8Array(16));
  const p256dh = b64u(await crypto.subtle.exportKey('raw', ua.publicKey));
  const datos = JSON.stringify({ titulo: 'Recordatorio 💅', cuerpo: 'Mañana a las 10:30 a. m. con Karla', url: '/reservar/cita/#x' });
  const cuerpo = await cifrar(datos, p256dh, b64u(auth));
  assert.equal(cuerpo[16] * 2 ** 24 + cuerpo[17] * 2 ** 16 + cuerpo[18] * 256 + cuerpo[19], 4096);
  assert.equal(await descifrarPush(cuerpo, ua, auth), datos);
  // dos envíos del mismo texto no se parecen (sal y llave efímera nuevas)
  assert.notDeepEqual(await cifrar(datos, p256dh, b64u(auth)), cuerpo);
});

test('push: cabecera VAPID es un JWT ES256 válido para el origen del servicio', async () => {
  const v = await generarVapid();
  const cab = await cabeceraVapid('https://fcm.googleapis.com/fcm/send/abc', { ...v, sujeto: 'mailto:prueba@example.com' }, Date.UTC(2026, 0, 1));
  const m = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(cab);
  assert.ok(m);
  assert.equal(m[4], v.publica);
  const carga = JSON.parse(new TextDecoder().decode(deB64u(m[2])));
  assert.equal(carga.aud, 'https://fcm.googleapis.com');
  assert.equal(carga.sub, 'mailto:prueba@example.com');
  assert.equal(carga.exp, Date.UTC(2026, 0, 1) / 1000 + 12 * 3600);
  const pub = await crypto.subtle.importKey('raw', deB64u(v.publica), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, deB64u(m[3]), new TextEncoder().encode(`${m[1]}.${m[2]}`));
  assert.ok(ok, 'la firma verifica con la llave pública');
});

test('push: solo se aceptan servicios de push reales', () => {
  assert.ok(endpointValido('https://fcm.googleapis.com/fcm/send/x'));
  assert.ok(endpointValido('https://web.push.apple.com/QG...'));
  assert.ok(endpointValido('https://updates.push.services.mozilla.com/wpush/v2/x'));
  assert.ok(!endpointValido('https://evil.example.com/x'));
  assert.ok(!endpointValido('https://fcm.googleapis.com.evil.com/x'));
  assert.ok(!endpointValido('http://fcm.googleapis.com/x'));
  assert.ok(!endpointValido('http://127.0.0.1:9/x'));
  assert.ok(endpointValido('http://127.0.0.1:9/x', { permitirLocal: true }));
});

test('los JS y CSS de la plataforma tienen la versión al día (node dev/versionar.mjs)', async () => {
  const { execFileSync } = await import('node:child_process');
  execFileSync(process.execPath, [new URL('../dev/versionar.mjs', import.meta.url).pathname, '--revisar'], { stdio: 'pipe' });
});

// ---------- cuentas, fidelidad, respaldos ----------
import { repartir, calcularComision, tablaComisiones, resumir, gastosHormiga, lunesDe } from '../functions/_lib/cuentas.js';
import { fidelidad } from '../functions/_lib/rutas/clientas.js';
import { sqlDeRestauracion, comprimir, descomprimir } from '../functions/_lib/respaldo.js';
import { nombreDispositivo, pinDebil } from '../functions/_lib/auth.js';

test('comisiones: % por chica y por servicio, redondeo a pesos y reparto exacto', () => {
  const tabla = tablaComisiones([{ id: 1, comision_pct: 40 }, { id: 2, comision_pct: 0 }], [{ colaboradora_id: 1, servicio_id: 9, pct: 50 }]);
  // Un servicio sin % propio usa el general (40 %)
  assert.equal(calcularComision(tabla, 1, 45000, [{ servicio_id: 3, nombre: 'Semi', precio: 45000 }]), 18000);
  // Combo manos (45.000, 40 %) + pies (35.000, 50 % por servicio) cobrado con descuento a 70.000
  const l = [{ servicio_id: 3, nombre: 'Manos', precio: 45000 }, { servicio_id: 9, nombre: 'Pies', precio: 35000 }];
  const r = repartir(70000, l);
  assert.equal(r.reduce((a, x) => a + x.monto, 0), 70000, 'el reparto suma exacto');
  assert.deepEqual(r.map((x) => x.monto), [39375, 30625]);
  assert.equal(calcularComision(tabla, 1, 70000, l), Math.round(39375 * 0.4 + 30625 * 0.5));
  // Sin precios: partes iguales; montos impares sin perder pesos
  assert.deepEqual(repartir(100001, [{ nombre: 'a' }, { nombre: 'b' }, { nombre: 'c' }]).map((x) => x.monto), [33334, 33334, 33333]);
  assert.equal(calcularComision(tabla, 2, 50000, l), 0);
  assert.equal(calcularComision(tabla, 99, 50000, l), 0, 'chica sin configurar: 0 %');
});

test('cuentas: resumen por servicio, chica, ticket promedio y servicio más rentable', () => {
  const partes = [
    { fecha: '2026-11-23', colaboradora_id: 1, servicio_id: 3, nombre: 'Semi', monto: 45000, comision: 18000, costo: 5000, propina: 2000, metodo: 'nequi', ticket: 'p1' },
    { fecha: '2026-11-23', colaboradora_id: 1, servicio_id: 9, nombre: 'Pies', monto: 35000, comision: 17500, costo: 3000, propina: 0, metodo: 'nequi', ticket: 'p1' },
    { fecha: '2026-11-24', colaboradora_id: 2, servicio_id: 3, nombre: 'Semi', monto: 45000, comision: 0, costo: 5000, propina: 0, metodo: 'efectivo', ticket: 'p2' },
  ];
  const r = resumir(partes, [{ fecha: '2026-11-24', monto: 10000 }], { agrupar: 'dia' });
  assert.equal(r.ingresos, 125000);
  assert.equal(r.tickets, 2);
  assert.equal(r.ticket_promedio, 62500);
  assert.equal(r.utilidad, 125000 - 35500 - 13000 - 10000);
  assert.equal(r.mas_rentable.nombre, 'Semi');
  assert.deepEqual(r.serie.map((x) => [x.periodo, x.ingresos, x.gastos]), [['2026-11-23', 80000, 0], ['2026-11-24', 45000, 10000]]);
  assert.equal(resumir(partes, [], { agrupar: 'semana' }).serie[0].periodo, '2026-11-23');
  assert.equal(lunesDe('2026-11-29'), '2026-11-23', 'domingo cuenta en la semana del lunes anterior');
  assert.equal(r.chicas[0].colaboradora_id, 1);
});

test('gastos hormiga: suma los gastos pequeños y avisa cuando pesan', () => {
  const g = [...Array(12)].map(() => ({ concepto: 'Tinto', monto: 3000 })).concat([{ concepto: 'Arriendo', monto: 1800000 }, { concepto: 'Domicilio', monto: 15000 }]);
  const h = gastosHormiga(g, { umbral: 20000, alerta: 40000 });
  assert.equal(h.total, 51000);
  assert.equal(h.cantidad, 13);
  assert.ok(h.alerta);
  assert.equal(h.top[0].concepto, 'Tinto');
  assert.equal(gastosHormiga(g, { umbral: 20000, alerta: 100000 }).alerta, false);
});

test('fidelidad: última visita, frecuencia y próxima estimada', () => {
  assert.deepEqual(fidelidad([], '2026-11-25').visitas, 0);
  const f = fidelidad(['2026-09-01', '2026-09-22', '2026-10-13'], '2026-11-25');
  assert.equal(f.ultima, '2026-10-13');
  assert.equal(f.frecuencia_dias, 21);
  assert.equal(f.proxima_estimada, '2026-11-03');
  assert.equal(f.dias_sin_venir, 43);
});

test('respaldo: comprime y genera SQL de restauración con comillas y binarios', async () => {
  const datos = { app: 'amelia-citas', version: 1, tablas: { clientas: [{ id: 1, nombre: "D'Amelia", celular: '573000000001' }], citas: [{ id: 5, clienta_id: 1, notas: null }], medios: [{ id: 1, datos: { b64: btoa('ab') } }] } };
  const sql = sqlDeRestauracion(datos);
  assert.match(sql, /INSERT INTO "clientas" \("id", "nombre", "celular"\) VALUES \(1, 'D''Amelia', '573000000001'\);/);
  assert.match(sql, /X'6162'/);
  assert.ok(sql.indexOf('INSERT INTO "clientas"') < sql.indexOf('INSERT INTO "citas"'), 'primero las clientas, luego sus citas');
  assert.throws(() => sqlDeRestauracion({ tablas: {} }), /no es un respaldo/);
  const gz = await comprimir(JSON.stringify(datos));
  assert.deepEqual(JSON.parse(await descomprimir(gz)), datos);
});

test('seguridad: nombre del dispositivo y PIN débiles', () => {
  assert.equal(nombreDispositivo('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1'), 'iPhone · Safari');
  assert.equal(nombreDispositivo('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36'), 'Android · Chrome');
  for (const p of ['111111', '123456', '987654', '121212', '456456']) assert.ok(pinDebil(p), p);
  for (const p of ['246813', '135792', '903172']) assert.ok(!pinDebil(p), p);
});
