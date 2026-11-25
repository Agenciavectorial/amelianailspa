// Mensajes (Erika): edita los textos que se envían a las clientas.
import { api, html, pintar, $$, toast, ocupado } from '/app-citas/js/util.js?v=0059637289';
import { S, recargar } from './estado.js?v=0059637289';
import { VARIABLES, rellenar } from './mensajes.js?v=0059637289';

const EJEMPLO = { nombre: 'Laura', servicio: 'Semipermanente', fecha: 'viernes 5 de diciembre', hora: '10:30 a. m.', colaboradora: 'Karla', codigo: 'AM-7K3PQX', enlace: 'https://amelianailspa.com/reservar/cita/#…', resena: '', spa: 'Amelia Nail Spa', direccion: '' };

export async function vista(v) {
  await recargar();
  const ej = { ...EJEMPLO, resena: S.ajustes.resena_url, direccion: S.ajustes.direccion, spa: S.ajustes.nombre_spa };
  pintar(v, html`
    <header class="cabeza-vista"><div><span class="script">Lo que decimos</span><h1>Mensajes</h1></div></header>
    <p class="muted">Estos textos se usan en los botones de WhatsApp de cada cita y en Fidelización. Puedes usar estas palabras entre llaves y se reemplazan solas:</p>
    <div class="chips-serv espacio-arriba">${VARIABLES.map((k) => html`<span class="pastilla">{${k}}</span>`)}</div>
    <div class="lista-plantillas">${S.plantillas.map((p) => html`
      <form class="tarjeta bloque-ajustes plantilla" data-clave="${p.clave}">
        <h2>${p.titulo}</h2>
        <textarea name="texto" maxlength="1000" rows="5">${p.texto}</textarea>
        <details><summary>Vista previa</summary><p class="vista-previa">${rellenar(p.texto, ej)}</p></details>
        <button class="btn sec chico espacio-arriba">Guardar</button>
      </form>`)}</div>
    <p class="muted small">El enlace de reseña de Google se cambia en <a href="#/ajustes">Reglas de reserva</a>.</p>`);
  for (const f of $$('.plantilla', v)) {
    f.texto.oninput = () => { f.querySelector('.vista-previa').textContent = rellenar(f.texto.value, ej); };
    f.onsubmit = (e) => {
      e.preventDefault();
      ocupado(f.querySelector('button'), async () => {
        try { await api(`/api/panel/plantillas/${f.dataset.clave}`, { metodo: 'PUT', datos: { texto: f.texto.value } }); toast('Mensaje guardado', 'ok'); await recargar(); } catch (x) { toast(x.message, 'error'); }
      });
    };
  }
}
