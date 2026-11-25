// Servidor local para desarrollo y pruebas: `wrangler pages dev` con una D1 local nueva.
//   node dev/servidor.mjs            → levanta en http://localhost:8788 con datos de demostración ficticios
//   (las pruebas lo importan y usan otro puerto y otra carpeta de estado)
import { spawn, execFileSync } from 'node:child_process';
import { rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WRANGLER = path.join(RAIZ, 'node_modules', '.bin', 'wrangler');
export const CLAVE_INICIAL = 'clave-local-de-pruebas';

export async function levantar({ puerto = 8788, estado = 'dev/.estado', limpio = true, variables = {} } = {}) {
  const dirEstado = path.join(RAIZ, estado);
  if (limpio && existsSync(dirEstado)) rmSync(dirEstado, { recursive: true, force: true });
  execFileSync(WRANGLER, ['d1', 'migrations', 'apply', 'amelia-citas', '--local', '--persist-to', dirEstado], {
    cwd: RAIZ, stdio: 'pipe', env: { ...process.env, CI: '1' },
  });
  const binds = Object.entries({ CLAVE_INICIAL, ...variables }).flatMap(([k, v]) => ['--binding', `${k}=${v}`]);
  const proc = spawn(WRANGLER, ['pages', 'dev', 'public', '--port', String(puerto), '--persist-to', dirEstado, '--ip', '127.0.0.1', ...binds], {
    cwd: RAIZ, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, CI: '1' },
  });
  let log = '';
  proc.stdout.on('data', (d) => { log += d; });
  proc.stderr.on('data', (d) => { log += d; });
  const base = `http://127.0.0.1:${puerto}`;
  for (let i = 0; i < 120; i++) {
    try {
      const r = await fetch(`${base}/api/public/catalogo`);
      if (r.ok) return { base, proc, log: () => log, cerrar: () => proc.kill('SIGTERM') };
    } catch { /* aún no */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  proc.kill('SIGTERM');
  throw new Error('El servidor local no arrancó:\n' + log);
}

/** Cliente HTTP mínimo con cookie de sesión. */
export function cliente(base) {
  let cookie = '';
  async function pedir(ruta, { metodo = 'GET', datos } = {}) {
    const headers = {};
    if (cookie) headers.Cookie = cookie;
    if (datos !== undefined) headers['Content-Type'] = 'application/json';
    const r = await fetch(base + ruta, { method: metodo, headers, body: datos !== undefined ? JSON.stringify(datos) : undefined });
    const sc = r.headers.get('set-cookie');
    if (sc) cookie = sc.split(';')[0].endsWith('=') ? '' : sc.split(';')[0];
    const tipo = r.headers.get('content-type') || '';
    const cuerpo = tipo.includes('json') ? await r.json() : await r.text();
    return { status: r.status, cuerpo, headers: r.headers };
  }
  return { pedir, get cookie() { return cookie; } };
}

/** Próxima fecha (desde hoy+desde) que caiga entre lunes y viernes, en hora de Colombia. */
export function proximoDiaHabil(desde = 2) {
  const d = new Date(Date.now() - 5 * 3600000);
  d.setUTCDate(d.getUTCDate() + desde);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Crea PINs y algunas citas ficticias para ver el panel con datos. */
export async function datosDemo(base) {
  const erika = cliente(base);
  await erika.pedir('/api/auth/configurar', { metodo: 'POST', datos: { clave: CLAVE_INICIAL, pin: '246813' } });
  const { cuerpo: a } = await erika.pedir('/api/panel/arranque');
  for (const c of a.colaboradoras.filter((x) => x.rol !== 'propietaria')) {
    await erika.pedir(`/api/panel/colaboradoras/${c.id}/pin`, { metodo: 'POST', datos: { pin: '135792' } });
  }
  const ficticias = [
    ['Ana Prueba', '3000000001'], ['Bea Demo', '3000000002'], ['Caro Ejemplo', '3000000003'],
    ['Dani Ficticia', '3000000004'], ['Eva Muestra', '3000000005'], ['Fer Inventada', '3000000006'],
  ];
  const hoy = new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);
  const manana = proximoDiaHabil(1);
  const agenda = a.colaboradoras.filter((c) => c.agenda);
  const plan = [
    [hoy, 0, 600, [6]], [hoy, 1, 660, [1]], [hoy, 2, 840, [5, 16]], [hoy, 3, 720, [7]],
    [manana, 0, 540, [2]], [manana, 1, 600, [9]], [manana, 2, 900, [14]], [manana, 3, 1020, [3]],
  ];
  let i = 0;
  for (const [fecha, ci, inicio, servicios] of plan) {
    const [nombre, celular] = ficticias[i++ % ficticias.length];
    await erika.pedir('/api/panel/citas', { metodo: 'POST', datos: { servicios, colaboradora_id: agenda[ci].id, fecha, inicio, nombre, celular, forzar: true } });
  }
  await erika.pedir('/api/panel/bloqueos', { metodo: 'POST', datos: { colaboradora_id: agenda[0].id, fecha: manana, inicio: '13:00', fin: '14:00', motivo: 'Almuerzo' } });
  // Historial ficticio: visitas pasadas (unas cobradas), una por gestionar y una promoción.
  const hace = (n) => { const d = new Date(Date.now() - 5 * 3600000); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
  const pasadas = [[20, 'Karla', 'Semipermanente', 'asistio'], [9, 'Leidy', 'Acrílicas', 'asistio'], [5, 'Julieth', 'Lifting de Pestañas', 'asistio'],
    [3, 'Daily', 'Dipping', 'no_asistio'], [1, 'Leidy', 'Forrado', 'confirmada'], [120, 'Karla', 'Pedi Spa', 'asistio']];
  await erika.pedir('/api/panel/importar', { metodo: 'POST', datos: { tipo: 'citas', filas: pasadas.map(([d, col, serv, estado], k) => ({
    fecha: hace(d), hora: '10:00', colaboradora: col, servicio: serv, nombre: ficticias[k % ficticias.length][0], celular: ficticias[k % ficticias.length][1], estado,
  })) } });
  const metodos = ['nequi', 'efectivo', 'tarjeta'];
  const ag = await erika.pedir(`/api/panel/agenda?desde=${hace(30)}&hasta=${hoy}`);
  let m = 0;
  for (const c of ag.cuerpo.citas.filter((x) => x.estado === 'asistio')) {
    await erika.pedir(`/api/panel/citas/${c.id}/pagos`, { metodo: 'POST', datos: { monto: [45000, 85000, 70000][m % 3], metodo: metodos[m % 3] } });
    m++;
  }
  const semi = a.servicios.find((s) => s.slug === 'semipermanente');
  await erika.pedir('/api/panel/promociones', { metodo: 'POST', datos: { titulo: 'Martes de semipermanente', descripcion: 'Color que dura 3 semanas a precio especial.', servicio_id: semi.id, precio_promo: 39000, activa: true, foto: semi.foto } });
  return { pinErika: '246813', pinChicas: '135792' };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const s = await levantar({ puerto: 8788 });
  await datosDemo(s.base);
  console.log(`\nListo: ${s.base}/reservar  ·  ${s.base}/panel  (Erika PIN 246813, chicas PIN 135792; datos ficticios)\nCtrl+C para salir.`);
  process.on('SIGINT', () => { s.cerrar(); process.exit(0); });
}
