// Botón "Descargar la app" del panel, visible apenas se abre (ingreso e Inicio) mientras no esté instalada.
// Android/Chrome: abre el instalador del sistema. iPhone y otros navegadores: muestra los pasos.
import { html, crudo, $, toast, abrirHoja, ICONOS } from '/app-citas/js/util.js?v=ebff92790b';
import { esDuena } from './estado.js?v=ebff92790b';

const ICONO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/></svg>';
const CLAVE_OCULTO = 'amelia_descarga_oculta';

export const estaInstalada = () =>
  document.documentElement.classList.contains('instalada')
  || window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

const esIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** Botón grande para la pantalla de ingreso. */
export function botonDescarga() {
  if (estaInstalada()) return '';
  return html`<button type="button" class="btn sec descargar-app" data-descargar>${crudo(ICONO)} Descargar la app</button>`;
}

/** Tarjeta para Inicio (se puede ocultar con "Ahora no"). */
export function tarjetaDescarga() {
  if (estaInstalada()) return '';
  try { if (localStorage.getItem(CLAVE_OCULTO)) return ''; } catch { /* sin almacenamiento */ }
  return html`<section class="tarjeta tarjeta-descarga" id="tarjetaDescarga">
    <span class="td-icono">${crudo(ICONO)}</span>
    <div><strong>Lleva tu agenda en el celular</strong><p class="muted small">Descarga la app: abre en un toque desde tu pantalla de inicio y te avisa de tus citas.</p></div>
    <div class="td-botones"><button type="button" class="btn" data-descargar>Descargar la app</button><button type="button" class="btn ghost chico" id="tdOcultar">Ahora no</button></div>
  </section>`;
}

function pasos() {
  const ios = esIos();
  abrirHoja(html`
    <div class="cabeza-hoja"><h2>Descargar la <em>app</em></h2><button class="icono-btn" data-cerrar aria-label="Cerrar">${crudo(ICONOS.cerrar)}</button></div>
    ${ios ? html`<ol class="pasos-descarga">
        <li>Abre este enlace en <strong>Safari</strong> (no dentro de WhatsApp ni Instagram).</li>
        <li>Toca el botón <strong>Compartir</strong> <span aria-hidden="true">⬆︎</span> (abajo en el centro).</li>
        <li>Baja y elige <strong>"Agregar a inicio"</strong> y luego <strong>Agregar</strong>.</li>
        <li>Abre la app <strong>Amelia</strong> desde el ícono de tu pantalla de inicio.</li>
      </ol>`
      : html`<ol class="pasos-descarga">
        <li>Abre este enlace en <strong>Chrome</strong> (no dentro de WhatsApp ni Instagram).</li>
        <li>Toca el menú <strong>⋮</strong> (arriba a la derecha).</li>
        <li>Elige <strong>"Instalar app"</strong> o <strong>"Agregar a pantalla principal"</strong>.</li>
        <li>Abre la app <strong>Amelia</strong> desde el ícono de tu celular.</li>
      </ol>`}
    <p class="muted small">El enlace es <strong>amelianailspa.com/panel</strong>. Entras con tu foto y tu PIN, igual que aquí.</p>
    <button class="btn bloque" data-cerrar>Entendido</button>`, { clase: 'hoja-descarga' });
}

async function descargar() {
  const r = window.ameliaInstalar ? await window.ameliaInstalar() : 'manual';
  if (r === 'instalada') {
    toast('¡Listo! Ya tienes la app en tu celular.', 'ok');
    document.querySelectorAll('[data-descargar], #tarjetaDescarga').forEach((e) => e.remove());
  } else if (r !== 'cancelada') (window.ameliaGuiaInstalar || pasos)();
}

/** Conecta los botones de descarga que haya dentro de `raiz`. */
export function activarDescarga(raiz = document) {
  for (const b of raiz.querySelectorAll('[data-descargar]')) b.onclick = descargar;
  const ocultar = $('#tdOcultar', raiz);
  if (ocultar) ocultar.onclick = () => {
    try { localStorage.setItem(CLAVE_OCULTO, '1'); } catch { /* sin almacenamiento */ }
    $('#tarjetaDescarga')?.remove();
  };
}

// ---------- avisos en el celular ----------
// En Inicio, si la app puede recibir notificaciones y aún no están activas, invita a activarlas:
// así cada chica se entera al instante cuando le agendan, mueven o cancelan, y 1 hora antes de cada cita.
const PUSH = { sw: '/panel/sw.js', scope: '/panel/' };

export async function tarjetaAvisos(caja) {
  if (!caja) return;
  const { estadoPush, activarPush } = await import('/app-citas/js/push.js?v=ebff92790b');
  const estado = await estadoPush(PUSH).catch(() => 'no-soportado');
  const ruta = '/api/panel/push/suscribir';
  // Ya activos: se vuelve a registrar en silencio por si el servidor la perdió (cambio de celular, vencida…)
  if (estado === 'activo') { activarPush({ ...PUSH, ruta }).catch(() => {}); return; }
  const quien = esDuena() ? 'cuando alguien agenda, cambia o cancela una cita' : 'cuando te agendan, mueven o cancelan una cita, y 1 hora antes de cada una';
  const textos = {
    inactivo: [`Te llega una notificación ${quien}.`, html`<button type="button" class="btn" id="activarAvisosEquipo">Activar avisos</button>`],
    'ios-instalar': ['En iPhone los avisos solo funcionan con la app descargada: toca "Descargar la app", ábrela desde el ícono y vuelve a entrar.', html`<button type="button" class="btn" data-descargar>Descargar la app</button>`],
    bloqueado: ['Los avisos están bloqueados en este celular. Actívalos en los ajustes del navegador para amelianailspa.com y vuelve a entrar.', ''],
  }[estado];
  if (!textos) return;
  caja.innerHTML = String(html`<section class="tarjeta tarjeta-descarga tarjeta-avisos">
    <span class="td-icono" aria-hidden="true">🔔</span>
    <div><strong>Activa tus avisos</strong><p class="muted small">${textos[0]}</p></div>
    ${textos[1] ? html`<div class="td-botones">${textos[1]}</div>` : ''}
  </section>`);
  activarDescarga(caja);
  $('#activarAvisosEquipo', caja)?.addEventListener('click', async (e) => {
    const b = e.currentTarget;
    b.disabled = true;
    try {
      await activarPush({ ...PUSH, ruta });
      toast('¡Listo! Te avisaremos al instante.', 'ok');
      caja.innerHTML = '';
    } catch (x) { toast(x.message, 'error'); b.disabled = false; }
  });
}
