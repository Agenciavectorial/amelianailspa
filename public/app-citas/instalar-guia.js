// Mini tutorial para instalar la app (reserva de clientas y panel del equipo).
// - Aparece solo, al abrir, en celular: en la 1.ª, 3.ª, 7.ª, 15.ª y 30.ª visita (y nunca más después).
// - Desaparece para siempre si la app ya está instalada (display-mode standalone / navigator.standalone),
//   si se toca "Ya la instalé" o "No volver a mostrar".
// - iPhone: pasos Compartir → Agregar a inicio (y si está dentro de Instagram/Facebook/WhatsApp, abrir en Safari).
// - Android: el instalador nativo del navegador (beforeinstallprompt) o, si no existe, los pasos del menú ⋮.
// window.ameliaGuiaInstalar() la abre cuando se quiera (p. ej. antes de activar avisos en iPhone).
(function () {
  var raiz = document.documentElement;
  var zona = location.pathname.indexOf('/panel') === 0 ? 'panel' : 'reservar';
  var CLAVE = 'amelia_instalar_' + zona;
  var VISITAS_QUE_MUESTRAN = [1, 3, 7, 15, 30];
  var leer = function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } };
  var guardar = function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } };

  var standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if (standalone) guardar(CLAVE + '_nunca', 'instalada');
  window.addEventListener('appinstalled', function () { guardar(CLAVE + '_nunca', 'instalada'); cerrar(); });

  var ua = navigator.userAgent || '';
  var ios = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var android = /android/i.test(ua);
  var dentroDeApp = /FBAN|FBAV|Instagram|Line\/|WhatsApp|TikTok|musical_ly|Snapchat/i.test(ua);
  var esSafari = ios && /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|GSA\//i.test(ua);
  var nombre = zona === 'panel' ? 'Amelia Panel' : 'Amelia';

  var ICONO_COMPARTIR = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="M8 7l4-4 4 4"/><path d="M5 11v8a2 2 0 002 2h10a2 2 0 002-2v-8"/></svg>';
  var ICONO_MAS = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 8v8M8 12h8"/></svg>';

  function pasos() {
    if (ios && (dentroDeApp || !esSafari)) {
      return '<ol class="ig-pasos">' +
        '<li><span class="ig-num">1</span><span>Toca los <strong>tres puntos ⋯</strong> o el ícono de brújula y elige <strong>"Abrir en Safari"</strong>.</span></li>' +
        '<li><span class="ig-num">2</span><span>En Safari toca <strong>Compartir</strong> ' + ICONO_COMPARTIR + ' (abajo en el centro).</span></li>' +
        '<li><span class="ig-num">3</span><span>Baja y elige <strong>"Agregar a inicio"</strong> ' + ICONO_MAS + ' y luego <strong>Agregar</strong>.</span></li></ol>';
    }
    if (ios) {
      return '<ol class="ig-pasos">' +
        '<li><span class="ig-num">1</span><span>Toca <strong>Compartir</strong> ' + ICONO_COMPARTIR + ' en la barra de Safari (abajo en el centro; en iPad, arriba).</span></li>' +
        '<li><span class="ig-num">2</span><span>Baja y elige <strong>"Agregar a inicio"</strong> ' + ICONO_MAS + '.</span></li>' +
        '<li><span class="ig-num">3</span><span>Toca <strong>Agregar</strong> y abre <strong>' + nombre + '</strong> desde el ícono.</span></li></ol>' +
        '<p class="ig-nota">En iPhone las notificaciones de tus citas solo funcionan con la app agregada al inicio (iOS 16.4 o más nuevo).</p>';
    }
    return '<ol class="ig-pasos">' +
      '<li><span class="ig-num">1</span><span>Toca el menú <strong>⋮</strong> del navegador (arriba a la derecha).</span></li>' +
      '<li><span class="ig-num">2</span><span>Elige <strong>"Instalar app"</strong> o <strong>"Agregar a pantalla principal"</strong>.</span></li>' +
      '<li><span class="ig-num">3</span><span>Abre <strong>' + nombre + '</strong> desde el ícono de tu celular.</span></li></ol>';
  }

  var capa = null;
  function cerrar() {
    if (!capa) return;
    var c = capa; capa = null;
    c.classList.remove('abierta');
    document.body.classList.remove('con-guia');
    setTimeout(function () { c.remove(); }, 250);
  }

  function abrir(automatica) {
    if (capa || standalone) return;
    var nativo = !ios && raiz.classList.contains('puede-instalar') && typeof window.ameliaInstalar === 'function';
    capa = document.createElement('div');
    capa.className = 'instalar-guia';
    capa.setAttribute('role', 'dialog');
    capa.setAttribute('aria-modal', 'true');
    capa.setAttribute('aria-labelledby', 'igTitulo');
    capa.innerHTML =
      '<div class="ig-tarjeta">' +
        '<button type="button" class="ig-cerrar" aria-label="Cerrar">×</button>' +
        '<img class="ig-icono" src="/app-citas/img/icono-192.png" alt="" width="64" height="64">' +
        '<h2 id="igTitulo">Lleva a ' + nombre + ' en tu celular</h2>' +
        '<p class="ig-texto">' + (zona === 'panel'
          ? 'Abre tu agenda en un toque desde la pantalla de inicio y recibe avisos de tus citas.'
          : 'Reserva en un toque, mira tus citas y recibe recordatorios. Gratis y sin ocupar espacio.') + '</p>' +
        (nativo ? '<button type="button" class="btn bloque ig-instalar">Instalar la app</button>' : pasos()) +
        '<div class="ig-pie">' +
          '<button type="button" class="ig-ya">Ya la instalé</button>' +
          '<button type="button" class="ig-luego">' + (automatica ? 'Ahora no' : 'Cerrar') + '</button>' +
        '</div>' +
        (automatica ? '<button type="button" class="ig-nunca">No volver a mostrar</button>' : '') +
      '</div>';
    document.body.appendChild(capa);
    document.body.classList.add('con-guia');
    requestAnimationFrame(function () { capa && capa.classList.add('abierta'); });
    capa.addEventListener('click', function (e) {
      if (e.target === capa || e.target.closest('.ig-cerrar, .ig-luego')) return cerrar();
      if (e.target.closest('.ig-ya, .ig-nunca')) { guardar(CLAVE + '_nunca', e.target.closest('.ig-ya') ? 'instalada' : 'no'); return cerrar(); }
      if (e.target.closest('.ig-instalar')) {
        window.ameliaInstalar().then(function (r) {
          if (r === 'instalada') { guardar(CLAVE + '_nunca', 'instalada'); cerrar(); }
        });
      }
    });
    document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { cerrar(); document.removeEventListener('keydown', esc); } });
    var b = capa.querySelector('.ig-instalar, .ig-luego');
    if (b) setTimeout(function () { b.focus(); }, 300);
  }

  window.ameliaGuiaInstalar = function () { abrir(false); };

  // ---------- aparición automática ----------
  if (standalone || leer(CLAVE + '_nunca')) return;
  // Navegadores automatizados (pruebas) no la ven sola, salvo que la pidan con ?guia=1.
  if (navigator.webdriver && !/[?&]guia=1/.test(location.search)) return;
  var esCelular = ios || android || window.matchMedia('(pointer: coarse) and (max-width: 900px)').matches;
  if (!esCelular) return;
  var nuevaVisita = false;
  try { if (!sessionStorage.getItem(CLAVE + '_sesion')) { sessionStorage.setItem(CLAVE + '_sesion', '1'); nuevaVisita = true; } } catch (e) { nuevaVisita = true; }
  if (!nuevaVisita) return;
  var n = Number(leer(CLAVE + '_visitas') || 0) + 1;
  guardar(CLAVE + '_visitas', String(n));
  if (VISITAS_QUE_MUESTRAN.indexOf(n) < 0) return;
  // Espera a que la página cargue y no tapa una hoja ya abierta.
  setTimeout(function intentar() {
    if (document.body.classList.contains('con-hoja') || document.querySelector('.tour-tarjeta')) return setTimeout(intentar, 4000);
    abrir(true);
  }, 2500);
})();
