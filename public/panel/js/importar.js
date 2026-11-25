// Importador CSV (solo Erika): servicios, clientas y citas (pensado para lo que se exporte de Kumbio).
import { api, html, crudo, pintar, $, $$, toast, ICONOS } from '/app-citas/js/util.js?v=c0f7d95cf2';
import { leerCSV, aObjetos, aCSV } from '/app-citas/js/csv.js?v=c0f7d95cf2';
import { recargar } from './estado.js?v=c0f7d95cf2';

// Formato de la exportación de Kumbio (docs/migracion-kumbio/FORMATO-IMPORTACION.md). También acepta sinónimos.
const TIPOS = {
  servicios: {
    titulo: 'Servicios', lote: 100, requeridos: ['nombre', 'duracion'],
    campos: ['categoria', 'nombre', 'precio', 'duracion', 'descripcion', 'colaboradoras', 'foto', 'visible'],
    ejemplo: [['categoria', 'nombre', 'precio', 'duracion_min', 'descripcion', 'colaboradoras', 'foto_url'], ['Uñas', 'Semipermanente', '45000', '75', 'Color por 3 semanas', 'Leidy|Karla', ''], ['Pestañas & Cejas', 'Lifting de Pestañas', '80000', '75', '', 'Julieth', '']],
    ayuda: 'Si el servicio ya existe (mismo nombre) se actualiza. "colaboradoras" va separado por | y reemplaza quién lo hace.',
  },
  colaboradoras: {
    titulo: 'Equipo', lote: 10, requeridos: ['nombre'],
    campos: ['nombre', 'celular', 'rol', 'servicios', 'horario'],
    ejemplo: [['nombre', 'celular', 'rol', 'servicios', 'horario'], ['Karla', '3000000000', 'colaboradora', 'Dipping|Semipermanente', 'lun-sab 09:00-19:00; dom cerrado']],
    ayuda: 'Crea o actualiza a cada persona (sin PIN: se lo pones en Equipo). Horario tipo "lun-sab 09:00-19:00; dom cerrado".',
  },
  clientas: {
    titulo: 'Clientas', lote: 100, requeridos: ['nombre', 'celular'],
    campos: ['nombre', 'celular', 'email', 'notas', 'ultima_visita', 'cumpleanos'],
    ejemplo: [['nombre', 'celular', 'email', 'notas', 'ultima_visita'], ['Clienta Ejemplo', '3001234567', 'ejemplo@correo.com', 'Prefiere tonos nude', '2026-10-23']],
    ayuda: 'El celular identifica a la clienta: si ya existe, se actualiza su nombre y correo.',
  },
  citas: {
    titulo: 'Citas', lote: 10, requeridos: ['fecha', 'hora', 'nombre', 'celular', 'servicio', 'colaboradora'],
    campos: ['fecha', 'hora', 'duracion', 'colaboradora', 'servicio', 'nombre', 'celular', 'precio', 'estado', 'notas'],
    ejemplo: [['fecha', 'hora_inicio', 'duracion_min', 'colaboradora', 'servicio', 'clienta_nombre', 'clienta_celular', 'estado', 'notas'], ['2026-12-05', '10:30', '75', 'Karla', 'Semipermanente', 'Clienta Ejemplo', '3001234567', 'confirmada', ''], ['2026-10-23', '16:00', '20', 'Leidy', 'Depilación Cejas/Bozo', 'Otra Ejemplo', '3109876543', 'asistio', '']],
    ayuda: 'Fechas AAAA-MM-DD (o DD/MM/AAAA). Varios servicios se separan con "+". Las citas pasadas quedan como historial; las futuras ocupan el turno (si se cruzan con otra, se reportan).',
  },
};

let tipo = 'servicios', datos = null;

export async function vista(v) {
  datos = null;
  pintar(v, html`
    <header class="cabeza-vista"><div><span class="script">Traer datos</span><h1>Importar <em>CSV</em></h1></div></header>
    <section class="tarjeta bloque-ajustes">
      <p class="muted">Sube un archivo .csv (de Kumbio o de Excel/Google Sheets → "Descargar como CSV"). Primero se revisa sin guardar nada.</p>
      <div class="segmentado ancho" role="tablist">${Object.entries(TIPOS).map(([k, t]) => html`<button data-tipo="${k}" aria-pressed="${k === tipo}">${t.titulo}</button>`)}</div>
      <p class="muted small" id="ayudaTipo"></p>
      <div class="fila-botones">
        <label class="btn sec subir">${crudo(ICONOS.copiar)} Elegir archivo<input type="file" id="archivo" accept=".csv,text/csv,text/plain" class="sr"></label>
        <button class="btn ghost" id="plantilla">Descargar plantilla</button>
      </div>
    </section>
    <section id="previa"></section>`);
  const pintarAyuda = () => {
    const t = TIPOS[tipo];
    $('#ayudaTipo').textContent = `Columnas: ${t.campos.join(', ')} (obligatorias: ${t.requeridos.join(', ')}). ${t.ayuda}`;
  };
  pintarAyuda();
  for (const b of $$('[data-tipo]', v)) {
    b.onclick = () => {
      tipo = b.dataset.tipo;
      for (const x of $$('[data-tipo]', v)) x.setAttribute('aria-pressed', String(x === b));
      pintarAyuda();
      if (datos) analizar(datos.texto);
    };
  }
  $('#plantilla').onclick = () => {
    const blob = new Blob(['﻿' + aCSV(TIPOS[tipo].ejemplo)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `plantilla-${tipo}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  $('#archivo').onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 5_000_000) return toast('El archivo es muy grande (máx. 5 MB).', 'error');
    analizar(await f.text());
  };
}

function analizar(texto) {
  const t = TIPOS[tipo];
  const matriz = leerCSV(texto);
  const { mapa, encabezados, filas } = aObjetos(matriz, t.campos);
  datos = { texto, filas };
  const encontrados = new Set(Object.values(mapa));
  const faltan = t.requeridos.filter((c) => !encontrados.has(c));
  pintar($('#previa'), html`
    <div class="tarjeta bloque-ajustes">
      <h2>${filas.length} filas encontradas</h2>
      <div class="mapa-columnas">${encabezados.map((h, i) => html`<span class="pastilla ${mapa[i] ? 'ok' : ''}">${h || '(vacío)'}${mapa[i] ? ` → ${mapa[i]}` : ' · se ignora'}</span>`)}</div>
      ${faltan.length ? html`<p class="aviso error">Faltan columnas obligatorias: ${faltan.join(', ')}. Renombra los encabezados del archivo o usa la plantilla.</p>` : html`
        <div class="tabla-previa"><table><thead><tr>${t.campos.filter((c) => encontrados.has(c)).map((c) => html`<th>${c}</th>`)}</tr></thead>
        <tbody>${filas.slice(0, 5).map((f) => html`<tr>${t.campos.filter((c) => encontrados.has(c)).map((c) => html`<td>${f[c]}</td>`)}</tr>`)}</tbody></table></div>
        <div class="fila-botones">
          <button class="btn sec" id="probar">Revisar sin guardar</button>
          <button class="btn" id="importar">Importar ${filas.length}</button>
        </div>`}
      <div id="progresoImp"></div>
      <div id="resultadoImp"></div>
    </div>`);
  $('#probar')?.addEventListener('click', () => enviar(true));
  $('#importar')?.addEventListener('click', () => enviar(false));
}

async function enviar(simular) {
  const t = TIPOS[tipo];
  const botones = $$('#probar, #importar');
  botones.forEach((b) => { b.disabled = true; });
  const resultado = [];
  const prog = $('#progresoImp');
  try {
    for (let i = 0; i < datos.filas.length; i += t.lote) {
      pintar(prog, html`<div class="barra-progreso"><span data-ancho="${Math.round((i / datos.filas.length) * 100)}%"></span></div><p class="muted small">${simular ? 'Revisando' : 'Importando'} ${i} de ${datos.filas.length}…</p>`);
      $('[data-ancho]', prog).style.width = $('[data-ancho]', prog).dataset.ancho;
      const r = await api('/api/panel/importar', { metodo: 'POST', datos: { tipo, simular, desde: i, filas: datos.filas.slice(i, i + t.lote) } });
      resultado.push(...r.resultado);
    }
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    botones.forEach((b) => { b.disabled = false; });
    pintar(prog, '');
  }
  const ok = resultado.filter((r) => r.ok), mal = resultado.filter((r) => !r.ok);
  pintar($('#resultadoImp'), html`
    <p class="aviso ${mal.length ? '' : 'info'}">${simular ? 'Revisión' : 'Importación'}: <strong>${ok.length}</strong> correctas, <strong>${mal.length}</strong> con problemas.${simular && !mal.length ? ' Todo listo para importar.' : ''}</p>
    ${mal.length ? html`<h3 class="espacio-arriba">Filas con problemas</h3><ul class="lista-errores">${mal.slice(0, 200).map((r) => html`<li><strong>Fila ${r.fila + 2}</strong>: ${r.msg}</li>`)}</ul>` : ''}
    <details class="espacio-arriba"><summary>Ver filas correctas</summary><ul class="lista-errores ok">${ok.slice(0, 300).map((r) => html`<li>Fila ${r.fila + 2}: ${r.msg}</li>`)}</ul></details>`);
  if (!simular && ok.length) { toast(`Se importaron ${ok.length} filas`, 'ok'); recargar(); }
}
