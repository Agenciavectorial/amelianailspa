// Respuestas JSON, errores y lectura segura del cuerpo.
export class HttpError extends Error {
  constructor(status, mensaje, extra = {}) {
    super(mensaje);
    this.status = status;
    this.extra = extra;
  }
}

export function json(datos, status = 200, cabeceras = {}) {
  return new Response(JSON.stringify(datos), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...cabeceras,
    },
  });
}

export function falla(status, mensaje, extra) {
  throw new HttpError(status, mensaje, extra);
}

const MAX_CUERPO = 2_000_000; // 2 MB (importador CSV por lotes)

export async function leerJSON(request) {
  const tipo = request.headers.get('Content-Type') || '';
  if (!tipo.toLowerCase().startsWith('application/json')) falla(415, 'Se esperaba JSON.');
  const texto = await request.text();
  if (texto.length > MAX_CUERPO) falla(413, 'La solicitud es demasiado grande.');
  if (!texto) return {};
  try {
    const v = JSON.parse(texto);
    if (!v || typeof v !== 'object' || Array.isArray(v)) falla(400, 'Formato inválido.');
    return v;
  } catch (e) {
    if (e instanceof HttpError) throw e;
    falla(400, 'JSON inválido.');
  }
}

export function ipDe(request) {
  return request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() || 'local';
}
