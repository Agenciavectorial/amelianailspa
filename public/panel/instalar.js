// Botón "Instalar app" del panel: usa beforeinstallprompt (Android/Chrome) o muestra pasos para iPhone.
(function () {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('/panel/sw.js', { scope: '/panel/' }).catch(function () {}); });
  }
  var aviso = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    aviso = e;
    document.documentElement.classList.add('puede-instalar');
  });
  window.addEventListener('appinstalled', function () {
    aviso = null;
    document.documentElement.classList.remove('puede-instalar');
  });
  var standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if (standalone) document.documentElement.classList.add('instalada');
  var ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (ios && !standalone) document.documentElement.classList.add('puede-instalar', 'es-ios');

  /** Devuelve 'instalada', 'ios' (mostrar pasos) o 'cancelada'. */
  window.ameliaInstalar = function () {
    if (standalone) return Promise.resolve('instalada');
    if (aviso) {
      aviso.prompt();
      return aviso.userChoice.then(function (r) { aviso = null; return r.outcome === 'accepted' ? 'instalada' : 'cancelada'; });
    }
    return Promise.resolve(ios ? 'ios' : 'manual');
  };
})();
