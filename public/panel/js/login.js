// Ingreso por persona con PIN (patrón MaxCool) y configuración del primer PIN de Erika.
import { api, html, crudo, pintar, $, $$, toast, inicial, ICONOS, foto } from '/app-citas/js/util.js?v=363881ba72';
import { botonDescarga, activarDescarga } from './descargar.js?v=363881ba72';

export async function pantallaIngreso(raiz, alEntrar) {
  let datos;
  try { datos = await api('/api/auth/personas'); } catch (e) {
    pintar(raiz, html`<div class="ingreso"><p class="aviso error">${e.message}</p><button class="btn" id="re">Reintentar</button></div>`);
    $('#re').onclick = () => pantallaIngreso(raiz, alEntrar);
    return;
  }
  if (datos.necesita_configurar) return pantallaConfigurar(raiz, alEntrar);
  pintar(raiz, html`
    <div class="ingreso">
      <img class="ingreso-logo" src="/app-citas/img/logo.webp" alt="Amelia Nail Spa" width="84" height="84">
      <span class="script">Hola de nuevo</span>
      <h1>¿Quién <em>eres</em>?</h1>
      <div class="personas">
        ${datos.personas.map((p) => html`
          <button class="persona" data-id="${p.id}" data-nombre="${p.nombre}">
            ${p.foto ? foto(p.foto, { sizes: '96px', ancho: 96 }) : html`<span class="avatar inicial">${inicial(p.nombre)}</span>`}
            <strong>${p.nombre}</strong>${p.rol === 'propietaria' ? html`<span class="pastilla">Propietaria</span>` : ''}
          </button>`)}
      </div>
      ${!datos.personas.length ? html`<p class="aviso info">Aún no hay personas con PIN.</p>` : ''}
      ${botonDescarga()}
      <p class="muted small ingreso-pie">¿Olvidaste tu PIN? Pídele a Erika que te asigne uno nuevo.</p>
    </div>`);
  activarDescarga(raiz);
  for (const b of $$('.persona', raiz)) b.onclick = () => pedirPin(raiz, { id: Number(b.dataset.id), nombre: b.dataset.nombre, foto: b.querySelector('img')?.src }, alEntrar);
}

function teclado() {
  return html`<div class="teclado">
    ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => html`<button type="button" class="tecla" data-n="${n}">${n}</button>`)}
    <span></span><button class="tecla" data-n="0">0</button>
    <button type="button" class="tecla borrar" data-borrar aria-label="Borrar">⌫</button>
  </div>`;
}

function pedirPin(raiz, persona, alEntrar) {
  let pin = '';
  pintar(raiz, html`
    <div class="ingreso">
      <button class="icono-btn volver-ingreso" id="volver" aria-label="Volver">${crudo(ICONOS.atras)}</button>
      ${persona.foto ? html`<img class="ingreso-foto" src="${persona.foto}" alt="">` : html`<span class="avatar inicial ingreso-foto">${inicial(persona.nombre)}</span>`}
      <h1>Hola, <em>${persona.nombre}</em></h1>
      <p class="muted">Escribe tu PIN</p>
      <div class="puntos" aria-live="polite"><span></span><span></span><span></span><span></span></div>
      <p class="aviso error" id="errPin" hidden></p>
      <form id="formPin" class="form-pin">
        <input id="pinOculto" class="sr" type="password" inputmode="numeric" autocomplete="current-password" maxlength="8" aria-label="PIN">
        ${teclado()}
        <button class="btn bloque" id="entrar" type="submit" disabled>Entrar</button>
      </form>
    </div>`);
  $('#volver').onclick = () => pantallaIngreso(raiz, alEntrar);
  const puntos = $('.puntos', raiz);
  const pintarPuntos = () => {
    const n = Math.max(4, pin.length);
    puntos.innerHTML = Array.from({ length: n }, (_, i) => `<span class="${i < pin.length ? 'lleno' : ''}"></span>`).join('');
    $('#entrar').disabled = pin.length < 4;
  };
  const tecla = (n) => { if (pin.length < 8) { pin += n; pintarPuntos(); if (pin.length === 4 && autoEnviar) enviar(); } };
  let autoEnviar = false; // los PIN pueden ser de 4 a 8 dígitos: se entra con el botón
  const borrar = () => { pin = pin.slice(0, -1); pintarPuntos(); };
  raiz.querySelector('.teclado').onclick = (e) => {
    const b = e.target.closest('.tecla');
    if (!b) return;
    if (b.dataset.borrar !== undefined) borrar(); else tecla(b.dataset.n);
  };
  const oculto = $('#pinOculto');
  document.onkeydown = (e) => {
    if (!document.body.contains(oculto)) { document.onkeydown = null; return; }
    if (/^\d$/.test(e.key)) { tecla(e.key); e.preventDefault(); } else if (e.key === 'Backspace') { borrar(); e.preventDefault(); }
  };
  async function enviar() {
    const err = $('#errPin');
    err.hidden = true;
    $('#entrar').disabled = true;
    try {
      await api('/api/auth/login', { metodo: 'POST', datos: { id: persona.id, pin } });
      document.onkeydown = null;
      alEntrar();
    } catch (e) {
      pin = '';
      pintarPuntos();
      err.textContent = e.message;
      err.hidden = false;
      puntos.classList.add('sacude');
      setTimeout(() => puntos.classList.remove('sacude'), 500);
    }
  }
  $('#formPin').onsubmit = (e) => { e.preventDefault(); if (pin.length >= 4) enviar(); };
  pintarPuntos();
}

function pantallaConfigurar(raiz, alEntrar) {
  pintar(raiz, html`
    <div class="ingreso">
      <img class="ingreso-logo" src="/app-citas/img/logo.webp" alt="Amelia Nail Spa" width="84" height="84">
      <span class="script">Bienvenida, Erika</span>
      <h1>Configura tu <em>PIN</em></h1>
      <p class="muted">Es la primera vez que entras. Escribe la clave inicial que te dio la agencia y elige tu PIN personal.</p>
      <form id="formConfig" class="tarjeta form-config">
        <label class="campo"><span>Clave inicial</span><input name="clave" type="password" autocomplete="off" required></label>
        <label class="campo"><span>Tu PIN (4 a 8 números)</span><input name="pin" type="password" inputmode="numeric" pattern="[0-9]{4,8}" autocomplete="new-password" required></label>
        <label class="campo"><span>Repite el PIN</span><input name="pin2" type="password" inputmode="numeric" autocomplete="new-password" required></label>
        <p class="aviso error" id="errConfig" hidden></p>
        <button class="btn bloque" type="submit">Guardar y entrar</button>
      </form>
    </div>`);
  $('#formConfig').onsubmit = async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    const err = $('#errConfig');
    err.hidden = true;
    if (!/^\d{4,8}$/.test(d.pin)) { err.textContent = 'El PIN debe tener de 4 a 8 números.'; err.hidden = false; return; }
    if (d.pin !== d.pin2) { err.textContent = 'Los PIN no coinciden.'; err.hidden = false; return; }
    try {
      await api('/api/auth/configurar', { metodo: 'POST', datos: { clave: d.clave, pin: d.pin } });
      toast('¡PIN guardado!', 'ok');
      alEntrar();
    } catch (x) { err.textContent = x.message; err.hidden = false; }
  };
}
