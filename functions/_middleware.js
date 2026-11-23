// Dominio único: amelianailspa.pages.dev redirige (301) a https://amelianailspa.com conservando ruta y parámetros.
// Las vistas previas con código (<hash>.amelianailspa.pages.dev) siguen funcionando para pruebas.
const DOMINIO = 'amelianailspa.com';
const ALIAS = 'amelianailspa.pages.dev';

export async function onRequest({ request, next }) {
  const url = new URL(request.url);
  if (url.hostname === ALIAS) {
    url.hostname = DOMINIO;
    url.protocol = 'https:';
    url.port = '';
    return Response.redirect(url.toString(), 301);
  }
  return next();
}
