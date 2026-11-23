// Lo que pasa en pantalla en cada escena. Todo corre contra el servidor LOCAL con datos ficticios.
// Cada acción recibe { page, base, d (duración de la escena en s), hasta(frac) } y debe terminar
// antes de que acabe su párrafo de voz; si se alarga, la escena simplemente dura un poco más.
import { cliente, CLAVE_INICIAL } from '../servidor.mjs';

// ---------- indicador de toques + vista previa de mensajes de WhatsApp (se inyecta en cada página) ----------
export const TOQUE = `(() => {
  const css = () => {
    if (document.getElementById('__v_css')) return;
    const st = document.createElement('style'); st.id = '__v_css';
    st.textContent = \`.__toque{position:fixed;z-index:2147483646;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;
      background:rgba(169,139,190,.38);border:3px solid rgba(122,100,148,.9);pointer-events:none;animation:__t .65s ease-out forwards}
      @keyframes __t{0%{transform:scale(.45);opacity:1}100%{transform:scale(1.55);opacity:0}}
      .__wa{position:fixed;inset:auto 14px 110px 14px;z-index:2147483645;background:#fff;border-radius:22px;padding:16px 18px 18px;
        box-shadow:0 20px 60px rgba(40,20,60,.35);font:15px/1.45 'DM Sans',system-ui,sans-serif;color:#2b2233;animation:__w .35s ease-out}
      .__wa b{display:flex;align-items:center;gap:8px;font-size:13px;color:#128C4B;margin-bottom:8px;letter-spacing:.02em}
      .__wa b i{width:10px;height:10px;border-radius:50%;background:#25D366;display:inline-block}
      .__wa p{margin:0;background:#E7FBEA;border-radius:14px 14px 14px 4px;padding:10px 12px;white-space:pre-wrap;max-height:300px;overflow:hidden}
      .__tarjeta{position:fixed;inset:0;z-index:2147483644;display:grid;place-items:center;background:rgba(247,244,250,.92);animation:__w .4s ease-out}
      @keyframes __w{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}\`;
    document.documentElement.appendChild(st);
  };
  addEventListener('pointerdown', (e) => {
    css();
    const d = document.createElement('div'); d.className = '__toque';
    d.style.left = e.clientX + 'px'; d.style.top = e.clientY + 'px';
    document.documentElement.appendChild(d); setTimeout(() => d.remove(), 750);
  }, true);
  window.__mostrarWA = (url) => {
    css();
    let t = ''; try { t = new URL(url).searchParams.get('text') || ''; } catch {}
    document.querySelectorAll('.__wa').forEach((x) => x.remove());
    const c = document.createElement('div'); c.className = '__wa';
    c.innerHTML = '<b><i></i>Mensaje listo para enviar por WhatsApp</b><p></p>';
    c.querySelector('p').textContent = t;
    document.documentElement.appendChild(c);
    setTimeout(() => c.remove(), 6000);
  };
  // Notificaciones simuladas SOLO para la grabación local (el navegador sin pantalla no tiene servicio push).
  try {
    let permiso = 'default', sub = null;
    Object.defineProperty(Notification, 'permission', { get: () => permiso });
    Notification.requestPermission = async () => (permiso = 'granted');
        const b64u = (u) => btoa(String.fromCharCode(...new Uint8Array(u))).replace(/[+]/g, '-').replace(/[/]/g, '_').replace(/=+$/, '');
    const falsa = async () => {
      const par = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
      const p256dh = b64u(await crypto.subtle.exportKey('raw', par.publicKey));
      const auth = b64u(crypto.getRandomValues(new Uint8Array(16)));
      return { endpoint: 'http://127.0.0.1:9/push-del-video-' + Date.now(), expirationTime: null, options: {},
        getKey: () => new Uint8Array(65), toJSON() { return { endpoint: this.endpoint, expirationTime: null, keys: { p256dh, auth } }; },
        unsubscribe: async () => { sub = null; return true; } };
    };
    PushManager.prototype.getSubscription = async () => sub;
    PushManager.prototype.subscribe = async () => (sub = await falsa());
  } catch {}
  try { localStorage.setItem('amelia-promo-visto', String(Date.now())); } catch {} // sin ventana de promo encima
  window.__etiqueta = (texto, color) => {
    const pon = () => {
      document.querySelectorAll('.__etq').forEach((x) => x.remove());
      const e = document.createElement('div'); e.className = '__etq'; e.textContent = texto;
      e.style.cssText = 'position:fixed;top:70px;left:50%;transform:translateX(-50%);z-index:2147483647;padding:8px 22px;border-radius:999px;font:700 15px/1.2 system-ui,sans-serif;letter-spacing:.18em;color:#fff;box-shadow:0 8px 24px rgba(0,0,0,.25);background:' + color;
      document.documentElement.appendChild(e);
    };
    if (document.body) pon(); else addEventListener('DOMContentLoaded', pon);
  };
  const abrir = window.open;
  window.open = function (url, ...r) { if (String(url).includes('wa.me')) { window.__mostrarWA(String(url)); return null; } return abrir.call(this, url, ...r); };
  addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href*="wa.me"]');
    if (a) { e.preventDefault(); e.stopPropagation(); window.__mostrarWA(a.href); }
  }, true);
})();`;

// ---------- utilidades ----------
const pausa = (page, ms) => page.waitForTimeout(ms);
const loc = (page, sel) => (typeof sel === 'string' ? page.locator(sel).first() : sel);

async function centrar(page, l) {
  await l.waitFor({ state: 'visible', timeout: 5000 });
  await l.evaluate((el) => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  await pausa(page, 650);
}
export async function tocar(page, sel, { espera = 450, centrar: c = true } = {}) {
  const l = loc(page, sel);
  if (c) await centrar(page, l); else await l.waitFor({ state: 'visible', timeout: 5000 });
  await l.click({ timeout: 5000 });
  await pausa(page, espera);
}
export async function escribir(page, sel, texto, { retraso = 75 } = {}) {
  const l = loc(page, sel);
  await tocar(page, l, { espera: 200 });
  await l.fill('');
  await l.pressSequentially(texto, { delay: retraso });
  await pausa(page, 250);
}
/** Desplazamiento suave de la ventana (o de un contenedor) en px. */
export async function bajar(page, px, ms = 1200, contenedor = null) {
  await page.evaluate(async ({ px, ms, contenedor }) => {
    const el = contenedor ? document.querySelector(contenedor) : null;
    const desde = el ? el.scrollTop : window.scrollY;
    const t0 = performance.now();
    await new Promise((fin) => {
      const paso = (t) => {
        const k = Math.min(1, (t - t0) / ms);
        const y = desde + px * (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
        if (el) el.scrollTop = y; else window.scrollTo(0, y);
        if (k < 1) requestAnimationFrame(paso); else fin();
      };
      requestAnimationFrame(paso);
    });
  }, { px, ms, contenedor });
}
export async function arriba(page, ms = 700) {
  const y = await page.evaluate(() => window.scrollY);
  if (y > 0) await bajar(page, -y, ms);
}
async function ir(page, base, hash) {
  if (!page.url().startsWith(base + '/panel/')) await page.goto(`${base}/panel/${hash}`, { waitUntil: 'networkidle' });
  else await page.evaluate((h) => { location.hash = h; }, hash);
  await pausa(page, 900);
}
async function dock(page, nombre) {
  const l = page.locator(`.dock a:has-text("${nombre}")`);
  try { await l.click({ timeout: 2500 }); } catch { await l.evaluate((el) => el.click()); }
  await pausa(page, 900);
}
async function seccionMas(page, nombre) {
  await dock(page, 'Más');
  await tocar(page, page.locator(`.fila-mas:has-text("${nombre}")`), { espera: 1000 });
}
async function cerrarHoja(page) {
  for (let i = 0; i < 3; i++) {
    const habia = await page.evaluate(() => {
      const x = document.querySelector('.hoja.abierta [data-cerrar], .hoja.abierta [data-no]');
      if (x) x.click(); else if (document.querySelector('.hoja.abierta')) document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      return !!document.querySelector('.hoja.abierta') || !!x;
    });
    if (!habia) break;
    await pausa(page, 420);
  }
  await page.evaluate(() => { if (window.scrollX) window.scrollTo(0, window.scrollY); document.querySelectorAll('.hoja').forEach((h) => { h.scrollLeft = 0; }); });
}
/** Se llama antes de cada escena: deja la pantalla sin hojas abiertas. */
export const limpiar = (page) => cerrarHoja(page).catch(() => {});
async function ingresar(page, base, nombre, pin) {
  if (!page.url().startsWith(base + '/panel/')) await page.goto(base + '/panel/', { waitUntil: 'networkidle' });
  await tocar(page, page.locator(`.persona:has-text("${nombre}")`), { espera: 600 });
  for (const n of pin) await tocar(page, page.locator(`.tecla[data-n="${n}"]`), { centrar: false, espera: 260 });
  await tocar(page, '#entrar', { centrar: false, espera: 1500 });
}
async function salir(page, base) {
  await page.evaluate(() => fetch('/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }));
  await page.goto(base + '/panel/', { waitUntil: 'networkidle' });
}

// ---------- datos ficticios extra para que cada pantalla tenga algo que mostrar ----------
const hace = (n) => { const d = new Date(Date.now() - 5 * 3600000); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
export async function prepararDatos(base, video) {
  const c = cliente(base);
  await c.pedir('/api/auth/login', { metodo: 'POST', datos: { id: (await c.pedir('/api/auth/personas')).cuerpo.personas.find((p) => p.rol === 'propietaria').id, pin: '1234' } });
  const filas = [
    { fecha: hace(26), hora: '15:00', colaboradora: 'Karla', servicio: 'Semipermanente', nombre: 'Laura Ficticia', celular: '3000000011', estado: 'asistio' },
    { fecha: hace(30), hora: '11:00', colaboradora: 'Leidy', servicio: 'Acrílicas', nombre: 'Sofi Demo', celular: '3000000012', estado: 'asistio' },
    { fecha: hace(24), hora: '16:00', colaboradora: 'Julieth', servicio: 'Dipping', nombre: 'Majo Ejemplo', celular: '3000000013', estado: 'asistio' },
  ];
  await c.pedir('/api/panel/importar', { metodo: 'POST', datos: { tipo: 'citas', filas } });
}

// =====================================================================================
// Video de Erika
// =====================================================================================
export const erika = {
  async bienvenida({ page, base, hasta }) {
    await page.goto(base + '/reservar/', { waitUntil: 'networkidle' });
    await hasta(0.12);
    await bajar(page, 700, 2600);
    await hasta(0.42);
    await bajar(page, 600, 2200);
    await hasta(0.62);
    await page.goto(base + '/panel/', { waitUntil: 'networkidle' });
  },
  async entrar({ page, base, baseNuevo, hasta }) {
    if (baseNuevo) {
      await page.goto(baseNuevo + '/panel/', { waitUntil: 'networkidle' });
      await pausa(page, 500);
      await escribir(page, 'input[name="clave"]', 'clave-inicial', { retraso: 45 });
      await escribir(page, 'input[name="pin"]', '1234', { retraso: 140 });
      await escribir(page, 'input[name="pin2"]', '1234', { retraso: 140 });
      await hasta(0.45);
      await page.goto(base + '/panel/', { waitUntil: 'networkidle' });
    }
    await ingresar(page, base, 'Erika', '1234');
  },
  async inicio({ page, hasta }) {
    await hasta(0.3);
    await centrar(page, page.locator('#proxima'));
    await hasta(0.55);
    await centrar(page, page.locator('#bloqueGestionar'));
    await hasta(0.75);
    await centrar(page, page.locator('#listaHoy'));
    await hasta(0.9);
    await arriba(page);
  },
  async agenda({ page, hasta }) {
    await dock(page, 'Agenda');
    await hasta(0.3);
    await tocar(page, '#agDespues', { centrar: false });
    await hasta(0.42);
    await tocar(page, page.locator('[data-modo="semana"]:visible').first(), { centrar: false });
    await hasta(0.62);
    await tocar(page, page.locator('[data-modo="dia"]:visible').first(), { centrar: false });
    await hasta(0.75);
    await tocar(page, '#agDespues', { centrar: false }); // queda en mañana: ahí se crea la cita de ejemplo
  },
  async crearCita({ page, hasta }) {
    await tocar(page, '#agNueva', { centrar: false, espera: 700 });
    await tocar(page, page.locator('.hoja [data-serv]:has-text("Semipermanente")'));
    await hasta(0.3);
    await pausa(page, 900);
    await tocar(page, page.locator('#turnosNueva .turno').nth(2), { espera: 400 });
    await hasta(0.55);
    await escribir(page, '.hoja input[name="celular"]', '3009998877', { retraso: 60 });
    await escribir(page, '.hoja input[name="nombre"]', 'Gina Ejemplo', { retraso: 60 });
    await hasta(0.85);
    await tocar(page, '#guardarCita', { espera: 1200 });
  },
  async moverCancelar({ page, hasta }) {
    await tocar(page, page.locator('.agenda-marco :text("Gina Ejemplo")'), { espera: 900 });
    await tocar(page, page.locator('.hoja [data-accion="mover"]'), { espera: 1000 });
    await hasta(0.38);
    await tocar(page, page.locator('#turnosMover .turno').nth(4), { espera: 500 });
    await cerrarHoja(page);
    await hasta(0.55);
    await tocar(page, page.locator('.agenda-marco :text("Gina Ejemplo")'), { espera: 900 });
    await tocar(page, page.locator('.hoja [data-accion="cancelar"]'), { espera: 900 });
    await hasta(0.8);
    await tocar(page, page.locator('.hoja [data-si]'), { centrar: false, espera: 900 });
  },
  async cobrar({ page, hasta }) {
    await dock(page, 'Inicio');
    await centrar(page, page.locator('#bloqueGestionar'));
    await hasta(0.18);
    await tocar(page, page.locator('#listaGestionar [data-asistio="1"]').first(), { espera: 1000 });
    await escribir(page, '#formCobro input[name="monto"]', '85000', { retraso: 110 });
    await hasta(0.45);
    await tocar(page, page.locator('#formCobro [data-metodo="nequi"]'), { espera: 600 });
    await hasta(0.62);
    await escribir(page, '#formCobro input[name="propina"]', '5000', { retraso: 110 });
    await hasta(0.8);
    await tocar(page, '#guardarCobro', { espera: 1200 });
    await arriba(page);
  },
  async clientas({ page, hasta }) {
    await dock(page, 'Clientas');
    await hasta(0.12);
    await escribir(page, '#buscarClienta', 'Ana', { retraso: 150 });
    await pausa(page, 800);
    await hasta(0.3);
    await tocar(page, page.locator('.vista :text("Ana Prueba")'), { espera: 1200 });
    await hasta(0.55);
    const pref = page.locator('.hoja input[name="preferencias"]');
    if (await pref.count()) await escribir(page, pref, 'Nude con brillo, almendra corta. Sin alergias.', { retraso: 45 });
    await hasta(0.85);
    await bajar(page, 500, 1500, '.hoja');
  },
  async servicios({ page, hasta }) {
    await cerrarHoja(page);
    await seccionMas(page, 'Servicios');
    await hasta(0.18);
    await tocar(page, page.locator('.vista :text("Semipermanente")').first(), { espera: 1100 });
    await hasta(0.35);
    await escribir(page, '.hoja input[name="precio"]', '65000', { retraso: 130 });
    await hasta(0.6);
    await centrar(page, page.locator('.hoja input[name="foto"]'));
    await hasta(0.8);
    await centrar(page, page.locator('.hoja input[name="duracion"], .hoja select[name="duracion"]'));
  },
  async equipo({ page, hasta }) {
    await cerrarHoja(page);
    await seccionMas(page, 'Equipo');
    await hasta(0.2);
    await tocar(page, page.locator('.vista :text("Leidy")').first(), { espera: 1000 });
    for (const [f, tab] of [[0.38, 'servicios'], [0.55, 'horario'], [0.7, 'permisos'], [0.82, 'acceso']]) {
      await hasta(f);
      await tocar(page, page.locator(`.hoja [data-tab="${tab}"]`), { centrar: false, espera: 600 });
    }
  },
  async horario({ page, hasta }) {
    await cerrarHoja(page);
    await seccionMas(page, 'Horario y festivos');
    await hasta(0.2);
    await bajar(page, 500, 2200);
    await hasta(0.5);
    await tocar(page, page.locator('.vista :text("Ver festivos de Colombia")'), { espera: 1000 });
    await hasta(0.75);
    await bajar(page, 300, 1500);
  },
  async reglas({ page, hasta }) {
    await seccionMas(page, 'Reglas de reserva');
    await hasta(0.3);
    await bajar(page, 260, 1600);
    await hasta(0.65);
    await bajar(page, 260, 1600);
  },
  async promociones({ page, hasta }) {
    await seccionMas(page, 'Promociones');
    await hasta(0.3);
    await tocar(page, page.locator('.vista button:has-text("Promoción")').first(), { centrar: false, espera: 900 });
    await escribir(page, '.hoja input[name="titulo"]', 'Viernes de pedi spa', { retraso: 70 });
    await hasta(0.75);
    await bajar(page, 400, 1400, '.hoja');
  },
  async mensajes({ page, hasta }) {
    await cerrarHoja(page);
    await seccionMas(page, 'Mensajes');
    await hasta(0.3);
    await tocar(page, page.locator('.vista summary:has-text("Vista previa")').first(), { espera: 800 });
    await hasta(0.55);
    await bajar(page, 550, 2000);
  },
  async fidelizacion({ page, hasta }) {
    await seccionMas(page, 'Fidelización');
    await hasta(0.35);
    await tocar(page, page.locator('.vista button:has-text("Escribir")').first(), { espera: 600 });
  },
  async notificaciones({ page, hasta }) {
    await seccionMas(page, 'Mi cuenta');
    await hasta(0.12);
    const b = page.locator('.vista button:has-text("notificaciones")').first();
    if (await b.count()) await tocar(page, b, { espera: 1200 });
    await hasta(0.6);
    const i = page.locator('.vista button:has-text("Instalar")').first();
    if (await i.count()) await tocar(page, i, { espera: 1200 });
  },
  async importar({ page, hasta }) {
    await cerrarHoja(page);
    await seccionMas(page, 'Importar CSV');
    for (const [f, t] of [[0.15, 'Servicios'], [0.25, 'Clientas']]) { await hasta(f); await tocar(page, page.locator(`.vista button:has-text("${t}")`).first(), { centrar: false }); }
    await hasta(0.32);
    const archivo = page.locator('.vista input[type="file"]').first();
    await archivo.setInputFiles({ name: 'clientas.csv', mimeType: 'text/csv', buffer: Buffer.from(CSV_CLIENTAS) }).catch(() => {});
    await pausa(page, 1000);
    await hasta(0.55);
    const rev = page.locator('.vista button:has-text("Revisar")').first();
    if (await rev.count()) await tocar(page, rev, { espera: 1200 });
    await hasta(0.75);
    await bajar(page, 400, 1500);
  },
  async cierre({ page, base }) {
    await dock(page, 'Inicio');
    await arriba(page);
  },
};

const CSV_CLIENTAS = 'nombre,celular,notas\nPaula Ejemplo,3000000101,Prefiere tonos nude\nVale Demo,3000000102,\nCami Prueba,3000000103,Viene los sábados\n';

// =====================================================================================
// Video de las chicas
// =====================================================================================
export const chicas = {
  async saludo({ page, base, chica, hasta }) {
    await page.goto(base + '/panel/', { waitUntil: 'networkidle' });
    await hasta(0.3);
    await page.locator(`.persona:has-text("${chica}")`).first().evaluate((el) => { el.style.transition = 'transform .5s, box-shadow .5s'; el.style.transform = 'scale(1.08)'; el.style.boxShadow = '0 10px 30px rgba(122,100,148,.35)'; });
  },
  async entrar({ page, base, chica, hasta }) {
    await page.goto(base + '/panel/', { waitUntil: 'networkidle' });
    await hasta(0.25);
    await ingresar(page, base, chica, '1111');
  },
  async instalar({ page, hasta }) {
    await hasta(0.12);
    await seccionMas(page, 'Mi cuenta');
    await hasta(0.35);
    const i = page.locator('.vista button:has-text("Instalar")').first();
    if (await i.count()) await tocar(page, i, { espera: 1500 });
  },
  async agenda({ page, hasta }) {
    await cerrarHoja(page);
    await dock(page, 'Inicio');
    await hasta(0.15);
    await centrar(page, page.locator('#listaHoy'));
    await hasta(0.4);
    await dock(page, 'Agenda');
    await hasta(0.6);
    await tocar(page, '#agDespues', { centrar: false });
    await hasta(0.75);
    await tocar(page, page.locator('[data-modo="semana"]:visible').first(), { centrar: false });
  },
  async citas({ page, hasta }) {
    await tocar(page, '#agHoy', { centrar: false, espera: 700 });
    await tocar(page, page.locator('[data-modo="dia"]:visible').first(), { centrar: false, espera: 800 });
    const c = page.locator('.agenda-marco [data-cita], .agenda-marco .cita').first();
    await tocar(page, c, { espera: 1200 });
    await hasta(0.55);
    await escribir(page, '#notasCita', 'Diseño francés con brillo', { retraso: 55 });
  },
  async bloquear({ page, hasta }) {
    await cerrarHoja(page);
    await tocar(page, '#agBloquear', { centrar: false, espera: 900 });
    await hasta(0.4);
    const ini = page.locator('#formBloq input[name="inicio"]');
    if (await ini.count()) { await ini.fill('13:00'); await pausa(page, 400); }
    const fin = page.locator('#formBloq input[name="fin"]');
    if (await fin.count()) { await fin.fill('14:00'); await pausa(page, 400); }
    const m = page.locator('#formBloq input[name="motivo"]');
    if (await m.count()) await escribir(page, m, 'Almuerzo', { retraso: 80 });
    await hasta(0.8);
    await tocar(page, '#guardarBloq', { espera: 1000 });
  },
  async avisos({ page, hasta }) {
    await seccionMas(page, 'Mi cuenta');
    await hasta(0.25);
    const b = page.locator('.vista button:has-text("notificaciones")').first();
    if (await b.count()) await tocar(page, b, { espera: 1200 });
  },
  async contactar({ page, hasta }) {
    await dock(page, 'Inicio');
    await tocar(page, page.locator('#listaHoy [data-cita], #listaManana [data-cita]').first(), { espera: 1200 });
    await hasta(0.3);
    const p = page.locator('.hoja [data-plantilla]').first();
    if (await p.count()) await tocar(page, p, { espera: 1500 });
    else await tocar(page, page.locator('.hoja .wa-btn'), { espera: 1500 });
  },
  async cierre({ page }) {
    await cerrarHoja(page);
    await dock(page, 'Inicio');
  },
};

// =====================================================================================
// Video de la página
// =====================================================================================
export const pagina = {
  async antes({ page, baseAntes, hasta }) {
    await page.goto(baseAntes + '/', { waitUntil: 'load' }).catch(() => {});
    await page.evaluate(() => window.__etiqueta('ANTES', '#9a8f9f'));
    await hasta(0.3);
    await bajar(page, 700, 2200);
  },
  async ahora({ page, base, hasta }) {
    await page.goto(base + '/', { waitUntil: 'networkidle' });
    await page.evaluate(() => window.__etiqueta('AHORA', '#7A6494'));
    await hasta(0.2);
    await bajar(page, 800, 2500);
    await hasta(0.55);
    await bajar(page, 900, 2500);
    await page.evaluate(() => document.querySelectorAll('.__etq').forEach((x) => x.remove()));
  },
  async velocidad({ page, hasta }) {
    await page.evaluate((h) => {
      const t = document.createElement('div'); t.className = '__tarjeta'; t.innerHTML = h; document.documentElement.appendChild(t);
      window.__tarjeta = t;
    }, TARJETA_VELOCIDAD);
    await hasta(0.92);
    await page.evaluate(() => window.__tarjeta?.remove());
  },
  async menu({ page, base, hasta }) {
    await arriba(page, 400);
    await hasta(0.15);
    await tocar(page, page.locator('.dock a:has-text("Servicios")'), { centrar: false, espera: 1400 });
    await hasta(0.4);
    await tocar(page, page.locator('.dock a:has-text("Diseños")'), { centrar: false, espera: 1400 });
    await hasta(0.6);
    await tocar(page, page.locator('.dock a:has-text("Llegar")'), { centrar: false, espera: 1400 });
    await hasta(0.85);
    await page.locator('.dock .dock-main').evaluate((el) => { el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.15)' }, { transform: 'scale(1)' }], { duration: 900, iterations: 2 }); });
  },
  async google({ page, hasta }) {
    await page.evaluate((h) => {
      const t = document.createElement('div'); t.className = '__tarjeta'; t.innerHTML = h; document.documentElement.appendChild(t);
      window.__tarjeta = t;
    }, TARJETA_GOOGLE);
    await hasta(0.95);
    await page.evaluate(() => window.__tarjeta?.remove());
  },
  async reserva({ page, hasta }) {
    await tocar(page, page.locator('.dock .dock-main'), { centrar: false, espera: 300 });
    await page.waitForURL('**/reservar/**').catch(() => {});
    await pausa(page, 900);
    await hasta(0.12);
    await tocar(page, page.locator('.servicio:has-text("Semipermanente")'), { espera: 500 });
    await tocar(page, '#btnSeguir', { centrar: false, espera: 900 });
    await hasta(0.3);
    await tocar(page, page.locator('.pro.cualquiera'), { espera: 900 });
    await tocar(page, page.locator('.dia').nth(1), { centrar: false, espera: 700 });
    await hasta(0.45);
    await tocar(page, page.locator('.turno').nth(3), { espera: 400 });
    await tocar(page, '#btnSeguir', { centrar: false, espera: 900 });
    await hasta(0.58);
    await escribir(page, 'input[name="nombre"]', 'Gina Ejemplo', { retraso: 55 });
    await escribir(page, 'input[name="celular"]', '3009998877', { retraso: 55 });
    await tocar(page, 'input[name="politica"]', { espera: 300 });
    await hasta(0.86);
    await tocar(page, '#btnReservar', { espera: 1500 });
  },
  async app({ page, base, hasta }) {
    await arriba(page, 400);
    const av = page.locator('#activarAvisos');
    if (await av.count()) await tocar(page, av, { espera: 1300 });
    await hasta(0.3);
    await page.goto(base + '/reservar/', { waitUntil: 'networkidle' });
    await hasta(0.45);
    await bajar(page, 350, 1500);
    await hasta(0.62);
    await arriba(page, 600);
    const rep = page.locator('#repetir');
    if (await rep.count()) await tocar(page, rep, { espera: 1200 });
  },
  async cierre({ page, base }) {
    await page.goto(base + '/', { waitUntil: 'networkidle' });
  },
};

const tarjeta = (titulo, cuerpo) => `<div style="width:330px;font-family:'DM Sans',system-ui,sans-serif;color:#2b2233;text-align:center">
  <div style="font-family:'Great Vibes',cursive;font-size:34px;color:#7A6494">${titulo[0]}</div>
  <div style="font-family:'Playfair Display',serif;font-size:30px;font-weight:600;margin:-4px 0 18px">${titulo[1]}</div>${cuerpo}</div>`;
const fila = (a, b, c, color) => `<div style="display:flex;justify-content:space-between;align-items:center;background:#fff;border-radius:18px;padding:14px 18px;margin:10px 0;box-shadow:0 6px 20px rgba(122,100,148,.12)">
  <span style="font-size:15px;color:#6b6075;text-align:left">${a}<br><small style="font-size:12px">${c}</small></span><strong style="font-size:28px;color:${color}">${b}</strong></div>`;
const TARJETA_VELOCIDAD = tarjeta(['Más liviana', 'y más rápida'],
  fila('Antes', '12 MB', 'peso al abrirla en el celular', '#b4566b') +
  fila('Ahora', '1,9 MB', 'fotos optimizadas en WebP', '#3f8f5f') +
  `<div style="margin-top:16px;font-size:19px;font-weight:600;color:#7A6494">≈ 6 veces menos datos</div>`);
const TARJETA_GOOGLE = tarjeta(['Lista para', 'Google'],
  `<div style="text-align:left;background:#fff;border-radius:18px;padding:16px 18px;box-shadow:0 6px 20px rgba(122,100,148,.12);margin-bottom:12px">
    <div style="font-size:12px;color:#5f6368">amelianailspa.com</div>
    <div style="font-size:18px;color:#1a0dab;margin:2px 0 4px">Amelia Nail Spa · Uñas en Aranjuez, Medellín</div>
    <div style="font-size:13px;color:#4d5156;line-height:1.4">Acrílicas, semipermanente, pedicure, pestañas y faciales en el C.C. Bosque Plaza. Agenda en línea.</div>
    <div style="font-size:13px;color:#4d5156;margin-top:6px">★ 4,8 · Spa · Abierto hoy</div></div>
  ${['Dirección, horario y teléfono para Google', 'Catálogo de servicios con fotos', 'Search Console verificado', 'Mapa del sitio enviado y aceptado'].map((t) => `<div style="display:flex;gap:10px;align-items:center;text-align:left;font-size:15px;margin:9px 4px"><span style="flex:none;width:24px;height:24px;border-radius:50%;background:#A98BBE;color:#fff;display:grid;place-items:center;font-size:14px">✓</span>${t}</div>`).join('')}`);
