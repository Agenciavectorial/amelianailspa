// Notas rápidas del negocio (insumos por pedir, recados), compartidas por todo el equipo.
import { api, html, pintar, $, toast, ocupado } from '/app-citas/js/util.js?v=363881ba72';
import { S, esDuena } from './estado.js?v=363881ba72';

export async function vista(v) {
  const { notas } = await api('/api/panel/notas');
  pintar(v, html`
    <header class="cabeza-vista"><div><span class="script">Para no olvidar</span><h1>Notas</h1></div></header>
    <form id="formNota" class="tarjeta nueva-nota">
      <textarea name="texto" maxlength="500" placeholder="Ej. Pedir esmalte nude, llamar al proveedor de gel…" required></textarea>
      <div class="fila-nota"><label class="interruptor small"><input type="checkbox" name="fijada"> Fijar arriba</label><button class="btn chico" id="guardarNota">Guardar nota</button></div>
    </form>
    <div class="lista-notas">${notas.length ? notas.map((n) => html`
      <div class="nota tarjeta ${n.hecha ? 'hecha' : ''} ${n.fijada ? 'fijada' : ''}" data-id="${n.id}">
        <label class="check"><input type="checkbox" data-hecha ${n.hecha ? 'checked' : ''}><span class="nota-texto">${n.texto}</span></label>
        <div class="nota-pie"><small class="muted">${n.autor || '—'} · ${n.creado.slice(0, 10)}</small>
          <span>
            <button class="btn ghost chico" data-fijar>${n.fijada ? 'Desfijar' : 'Fijar'}</button>
            ${esDuena() || n.autor_id === S.yo.id ? html`<button class="btn ghost chico" data-borrar>Borrar</button>` : ''}
          </span>
        </div>
      </div>`) : html`<div class="vacio"><p>Aún no hay notas.</p></div>`}</div>`);
  $('#formNota').onsubmit = (e) => {
    e.preventDefault();
    ocupado($('#guardarNota'), async () => {
      try { await api('/api/panel/notas', { metodo: 'POST', datos: { texto: e.target.texto.value, fijada: e.target.fijada.checked } }); vista(v); } catch (x) { toast(x.message, 'error'); }
    });
  };
  v.querySelector('.lista-notas').onclick = async (e) => {
    const n = e.target.closest('.nota');
    if (!n) return;
    const id = n.dataset.id;
    const nota = notas.find((x) => x.id === Number(id));
    try {
      if (e.target.matches('[data-hecha]')) await api(`/api/panel/notas/${id}`, { metodo: 'PATCH', datos: { hecha: e.target.checked } });
      else if (e.target.closest('[data-fijar]')) await api(`/api/panel/notas/${id}`, { metodo: 'PATCH', datos: { fijada: !nota.fijada } });
      else if (e.target.closest('[data-borrar]')) await api(`/api/panel/notas/${id}`, { metodo: 'DELETE' });
      else return;
      vista(v);
    } catch (x) { toast(x.message, 'error'); }
  };
}
