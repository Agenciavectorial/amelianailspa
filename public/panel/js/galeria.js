// Editor de galería (fotos y videos por servicio) y selector de imagen reutilizable
// (galerías, promociones, portada de la reserva y foto de perfil).
import { api, html, crudo, pintar, $, $$, toast, ocupado, abrirHoja, cerrarHoja, ICONOS, foto } from '/app-citas/js/util.js?v=9cba0f01ac';

let fotosSpa = null;
async function cargarFotosSpa() {
  if (!fotosSpa) {
    try { fotosSpa = (await (await fetch('/app-citas/fotos.json')).json()).fotos; } catch { fotosSpa = []; }
  }
  return fotosSpa;
}

let subida = null;
async function subidaDisponible() {
  if (subida === null) { try { subida = (await api('/api/panel/subida')).disponible; } catch { subida = false; } }
  return subida;
}

export async function subirArchivo(archivo) {
  const res = await fetch('/api/panel/subir', { method: 'POST', headers: { 'Content-Type': archivo.type }, body: archivo, credentials: 'same-origin' });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error || 'No se pudo subir el archivo.');
  return d.url;
}

/**
 * Abre un selector de imagen. Resuelve con { tipo, url, portada } o null.
 * @param {{video?: boolean, titulo?: string}} o
 */
export function elegirMedio({ video = false, titulo = 'Agregar foto' } = {}) {
  return new Promise(async (resolver) => {
    let elegido = null;
    const fotos = await cargarFotosSpa();
    const puedeSubir = await subidaDisponible();
    const h = abrirHoja(html`
      <div class="cabeza-hoja"><div><span class="script">Galería</span><h2>${titulo}</h2></div><button class="icono-btn" data-cerrar aria-label="Cerrar">${crudo(ICONOS.cerrar)}</button></div>
      <div class="pestanas" role="tablist">
        <button data-tab="spa" aria-pressed="true">Fotos del spa</button>
        <button data-tab="subir">${puedeSubir ? 'Subir del celular' : 'Subir'}</button>
        <button data-tab="enlace">Pegar enlace</button>
      </div>
      <section data-panel="spa">
        <div class="selector-fotos">${fotos.map((f) => html`<button type="button" class="sf-foto" data-url="${f}">${foto(f, { sizes: '(min-width: 760px) 140px, 30vw', ancho: 140 })}</button>`)}</div>
      </section>
      <section data-panel="subir" hidden>
        ${puedeSubir ? html`<label class="zona-subir"><input type="file" id="archivoMedio" accept="image/*${video ? ',video/mp4' : ''}" class="sr">
          ${crudo(ICONOS.mas)}<strong>Toca para elegir una foto${video ? ' o video' : ''}</strong><span>Puedes tomarla con la cámara o elegirla de tu galería.</span></label>
          <p class="muted small" id="estadoSubida"></p>`
        : html`<p class="aviso info">La subida directa desde el celular se activa cuando la agencia conecte el almacenamiento de archivos. Mientras tanto, elige una foto del spa o pega un enlace (por ejemplo de Cloudinary).</p>`}
      </section>
      <section data-panel="enlace" hidden>
        <label class="campo"><span>Enlace (https) de la ${video ? 'foto o video' : 'foto'}</span><input id="enlaceMedio" type="url" placeholder="https://res.cloudinary.com/…"></label>
        ${video ? html`<label class="check"><input type="checkbox" id="esVideo"><span>Es un video (MP4)</span></label>
          <label class="campo espacio-arriba"><span>Portada del video (opcional)</span><input id="portadaMedio" type="url" placeholder="https://… o /img/…"></label>` : ''}
        <button class="btn bloque espacio-arriba" id="usarEnlace">Usar este enlace</button>
      </section>`, { alCerrar: () => resolver(elegido) });
    for (const b of $$('[data-tab]', h)) {
      b.onclick = () => {
        for (const x of $$('[data-tab]', h)) x.setAttribute('aria-pressed', String(x === b));
        for (const p of $$('[data-panel]', h)) p.hidden = p.dataset.panel !== b.dataset.tab;
      };
    }
    $('.selector-fotos', h).onclick = (e) => {
      const b = e.target.closest('[data-url]');
      if (!b) return;
      elegido = { tipo: 'foto', url: b.dataset.url, portada: '' };
      cerrarHoja();
    };
    $('#archivoMedio', h)?.addEventListener('change', async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      $('#estadoSubida', h).textContent = 'Subiendo…';
      try {
        const url = await subirArchivo(f);
        elegido = { tipo: f.type.startsWith('video/') ? 'video' : 'foto', url, portada: '' };
        cerrarHoja();
      } catch (x) { $('#estadoSubida', h).textContent = x.message; }
    });
    $('#usarEnlace', h).onclick = () => {
      const url = $('#enlaceMedio', h).value.trim();
      if (!/^(https:\/\/|\/img\/|\/api\/medios\/)/.test(url)) return toast('Pega un enlace que empiece por https://', 'error');
      const esVideo = $('#esVideo', h)?.checked || /\.mp4(\?|$)/i.test(url);
      elegido = { tipo: esVideo && video ? 'video' : 'foto', url, portada: $('#portadaMedio', h)?.value.trim() || '' };
      cerrarHoja();
    };
  });
}

/**
 * Editor de la galería de un servicio. Cada cambio se guarda al instante.
 * @param {HTMLElement} cont
 * @param {number} servicioId
 * @param {{alAgregar: () => void}} o  la ficha decide cómo abrir el selector (y reabrirse después)
 */
export async function editorGaleria(cont, servicioId, { alAgregar } = {}) {
  let medios = [];
  try { medios = (await api(`/api/panel/servicios/${servicioId}/medios`)).medios; } catch (e) { pintar(cont, html`<p class="aviso error">${e.message}</p>`); return; }
  const guardar = async () => {
    try { await api(`/api/panel/servicios/${servicioId}/medios`, { metodo: 'PUT', datos: { medios } }); toast('Galería guardada', 'ok'); } catch (x) { toast(x.message, 'error'); }
  };
  const pintarLista = () => {
    pintar(cont, html`
      <p class="muted small">Las clientas las ven al tocar el servicio. La primera foto es la principal. Los cambios se guardan solos.</p>
      <div class="galeria-editor">
        ${medios.map((m, i) => html`<div class="ge-item" data-i="${i}">
          <span class="ge-mini">${m.tipo === 'video' ? html`${foto(m.portada, { sizes: '30vw', ancho: 140 })}<span class="ge-video">▶</span>` : foto(m.url, { sizes: '(min-width: 760px) 140px, 30vw', ancho: 140 })}</span>
          <span class="ge-botones">
            <button type="button" class="icono-btn chico" data-mover="-1" aria-label="Mover antes" ${i === 0 ? crudo('disabled') : ''}>‹</button>
            <button type="button" class="icono-btn chico" data-mover="1" aria-label="Mover después" ${i === medios.length - 1 ? crudo('disabled') : ''}>›</button>
            <button type="button" class="icono-btn chico peligro-suave" data-quitar aria-label="Quitar">${crudo(ICONOS.cerrar)}</button>
          </span>
        </div>`)}
        <button type="button" class="ge-agregar" id="geAgregar">${crudo(ICONOS.mas)}<span>Agregar</span></button>
      </div>`);
    $('#geAgregar', cont).onclick = () => alAgregar?.();
    cont.querySelector('.galeria-editor').onclick = async (e) => {
      const it = e.target.closest('.ge-item');
      if (!it) return;
      const i = Number(it.dataset.i);
      const mv = e.target.closest('[data-mover]');
      if (mv) {
        const j = i + Number(mv.dataset.mover);
        [medios[i], medios[j]] = [medios[j], medios[i]];
      } else if (e.target.closest('[data-quitar]')) {
        medios.splice(i, 1);
      } else return;
      pintarLista();
      await guardar();
    };
  };
  pintarLista();
}

/** Agrega un medio a la galería de un servicio (lo usa la ficha después de elegirlo). */
export async function agregarAGaleria(servicioId, medio) {
  const { medios } = await api(`/api/panel/servicios/${servicioId}/medios`);
  medios.push(medio);
  await api(`/api/panel/servicios/${servicioId}/medios`, { metodo: 'PUT', datos: { medios } });
}
