/* Amelia Nail Spa — interacción de la página */
document.addEventListener('DOMContentLoaded', function () {

  /* ===== NAV: scroll shrink + hamburguesa móvil ===== */
  var nav = document.getElementById('mainNav');
  var hamburger = document.getElementById('navHamburger');
  var mobileMenu = document.getElementById('mobileMenu');
  var mobileClose = document.getElementById('mobileClose');

  window.addEventListener('scroll', function () {
    if (window.scrollY > 40) { nav.classList.add('scrolled'); }
    else { nav.classList.remove('scrolled'); }
  }, { passive: true });

  function openMobileMenu() {
    mobileMenu.classList.add('open');
    hamburger.classList.add('open');
  }
  function closeMobileMenu() {
    mobileMenu.classList.remove('open');
    hamburger.classList.remove('open');
  }
  if (hamburger) hamburger.addEventListener('click', function () {
    mobileMenu.classList.contains('open') ? closeMobileMenu() : openMobileMenu();
  });
  if (mobileClose) mobileClose.addEventListener('click', closeMobileMenu);
  document.querySelectorAll('.mobile-nav-link').forEach(function (a) {
    a.addEventListener('click', closeMobileMenu);
  });

  /* ===== HERO STATS: contador animado ===== */
  document.querySelectorAll('.hero-stat-val[data-count]').forEach(function (el) {
    var target = parseInt(el.getAttribute('data-count'), 10) || 0;
    var duration = 1400;
    var startTime = null;
    function step(ts) {
      if (!startTime) startTime = ts;
      var progress = Math.min((ts - startTime) / duration, 1);
      el.textContent = Math.floor(progress * target).toLocaleString('es-CO');
      if (progress < 1) requestAnimationFrame(step);
      else el.textContent = target.toLocaleString('es-CO');
    }
    requestAnimationFrame(step);
  });


  /* ===== SERVICIOS: tabs por categoría ===== */
  var tabBtns = document.querySelectorAll('.tab-btn');
  var servicioCards = document.querySelectorAll('.servicio-card');
  tabBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var cat = btn.getAttribute('data-cat');
      tabBtns.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      servicioCards.forEach(function (card) {
        card.classList.toggle('active', card.getAttribute('data-cat') === cat);
      });
    });
  });

  /* ===== GALERIA: filtros + ver más ===== */
  var filterBtns = document.querySelectorAll('.filter-btn');
  var masonryItems = document.querySelectorAll('.masonry-item');
  var verMasBtn = document.getElementById('verMasBtn');
  var COLLAPSED_COUNT = 8;
  var expanded = false;
  var currentFilter = 'all';

  function applyFilter() {
    var visibleIdx = 0;
    masonryItems.forEach(function (item) {
      var tags = item.getAttribute('data-tags') || '';
      var matches = currentFilter === 'all' || tags.indexOf(currentFilter) !== -1;
      if (!matches) {
        item.classList.add('hidden');
        return;
      }
      item.classList.remove('hidden');
      visibleIdx++;
      if (!expanded && visibleIdx > COLLAPSED_COUNT) {
        item.classList.add('hidden');
      }
    });
  }

  filterBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      filterBtns.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      currentFilter = btn.getAttribute('data-filter');
      expanded = false;
      if (verMasBtn) {
        verMasBtn.classList.remove('expanded');
        verMasBtn.querySelector('.vmtxt').textContent = 'Ver más diseños';
      }
      applyFilter();
    });
  });

  if (verMasBtn) {
    verMasBtn.addEventListener('click', function () {
      expanded = !expanded;
      verMasBtn.classList.toggle('expanded', expanded);
      verMasBtn.querySelector('.vmtxt').textContent = expanded ? 'Ver menos' : 'Ver más diseños';
      applyFilter();
    });
  }
  applyFilter();

  /* ===== LIGHTBOX (galería) ===== */
  var lightbox = document.getElementById('lightbox');
  var lbImg = document.getElementById('lbImg');
  var lbCaption = document.getElementById('lbCaption');
  var lbClose = document.getElementById('lbClose');
  var lbPrev = document.getElementById('lbPrev');
  var lbNext = document.getElementById('lbNext');
  var galleryImgs = [];
  var lbIndex = 0;

  function rebuildGalleryList() {
    galleryImgs = Array.prototype.filter.call(masonryItems, function (item) {
      return !item.classList.contains('hidden');
    });
  }

  function openLightbox(idx) {
    rebuildGalleryList();
    if (!galleryImgs.length) return;
    lbIndex = idx;
    showLightbox();
    lightbox.classList.add('open');
  }
  function showLightbox() {
    var item = galleryImgs[lbIndex];
    if (!item) return;
    var img = item.querySelector('img');
    // La variante más grande del srcset (no la miniatura estirada); el CSS la limita al tamaño de la pantalla.
    var mayor = (img.getAttribute('srcset') || '').split(',').map(function (x) { var p = x.trim().split(/\s+/); return { u: p[0], w: parseInt(p[1], 10) || 0 }; })
      .filter(function (x) { return x.u; }).sort(function (a, b) { return b.w - a.w; })[0];
    lbImg.src = mayor ? mayor.u : (img.currentSrc || img.src);
    lbImg.alt = img.alt;
    lbCaption.textContent = img.alt;
  }
  masonryItems.forEach(function (item, i) {
    var img = item.querySelector('img');
    if (img) img.addEventListener('click', function () {
      rebuildGalleryList();
      var pos = galleryImgs.indexOf(item);
      openLightbox(pos >= 0 ? pos : 0);
    });
  });
  if (lbClose) lbClose.addEventListener('click', function () { lightbox.classList.remove('open'); });
  if (lbPrev) lbPrev.addEventListener('click', function () {
    lbIndex = (lbIndex - 1 + galleryImgs.length) % galleryImgs.length;
    showLightbox();
  });
  if (lbNext) lbNext.addEventListener('click', function () {
    lbIndex = (lbIndex + 1) % galleryImgs.length;
    showLightbox();
  });
  if (lightbox) lightbox.addEventListener('click', function (e) {
    if (e.target === lightbox) lightbox.classList.remove('open');
  });
  document.addEventListener('keydown', function (e) {
    if (!lightbox || !lightbox.classList.contains('open')) return;
    if (e.key === 'Escape') lightbox.classList.remove('open');
    if (e.key === 'ArrowLeft' && lbPrev) lbPrev.click();
    if (e.key === 'ArrowRight' && lbNext) lbNext.click();
  });

  /* ===== ANTES/DESPUES: slider de comparación ===== */
  document.querySelectorAll('.ba-wrap').forEach(function (wrap) {
    var afterImg = wrap.querySelector('.ba-after');
    var line = wrap.querySelector('.ba-line');
    var dragging = false;

    function setPosition(clientX) {
      var rect = wrap.getBoundingClientRect();
      var x = Math.max(0, Math.min(clientX - rect.left, rect.width));
      var pct = (x / rect.width) * 100;
      afterImg.style.clipPath = 'inset(0 ' + (100 - pct) + '% 0 0)';
      line.style.left = pct + '%';
    }
    wrap.addEventListener('mousedown', function (e) { dragging = true; setPosition(e.clientX); });
    window.addEventListener('mousemove', function (e) { if (dragging) setPosition(e.clientX); });
    window.addEventListener('mouseup', function () { dragging = false; });
    wrap.addEventListener('touchstart', function (e) { dragging = true; setPosition(e.touches[0].clientX); }, { passive: true });
    wrap.addEventListener('touchmove', function (e) { if (dragging) setPosition(e.touches[0].clientX); }, { passive: true });
    wrap.addEventListener('touchend', function () { dragging = false; });
  });

  /* ===== VIDEOS: lazy-load + play/pause on tap ===== */
  function toggleVideo(wrapEl) {
    var video = wrapEl.querySelector('video');
    if (!video) return;
    if (!video.src && video.dataset.src) {
      video.src = video.dataset.src;
    }
    if (video.paused) {
      document.querySelectorAll('.exp-vw video').forEach(function (v) { if (v !== video) v.pause(); });
      video.play();
      wrapEl.classList.add('playing');
    } else {
      video.pause();
      wrapEl.classList.remove('playing');
    }
  }
  document.querySelectorAll('[data-toggle-video]').forEach(function (el) {
    el.addEventListener('click', function () { toggleVideo(el); });
  });

  /* Lazy-load de videos cuando entran en viewport (mejor performance) */
  if ('IntersectionObserver' in window) {
    var videoObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var v = entry.target;
          if (!v.src && v.dataset.src) v.src = v.dataset.src;
          if (v.dataset.autoplay === 'true') { v.play(); }
        } else {
          if (entry.target.dataset.autoplay === 'true') entry.target.pause();
        }
      });
    }, { rootMargin: '200px' });
    document.querySelectorAll('video[data-src], video[data-autoplay]').forEach(function (v) { videoObserver.observe(v); });
  }

  /* ===== SCROLL REVEAL ===== */
  var revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    revealEls.forEach(function (el) { revealObserver.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('visible'); });
  }

  /* ===== MODAL EQUIPO ===== */
  var teamModal = document.getElementById('teamModal');
  var teamModalImg = document.getElementById('teamModalImg');
  var teamModalName = document.getElementById('teamModalName');
  var teamModalRole = document.getElementById('teamModalRole');
  var teamModalBio = document.getElementById('teamModalBio');
  var teamModalClose = document.getElementById('teamModalClose');
  var lastFocusedCard = null;

  function openTeamModal(card) {
    var name = card.getAttribute('data-name') || '';
    var role = card.getAttribute('data-role') || '';
    var bio = card.getAttribute('data-bio') || '';
    var img = card.getAttribute('data-img') || '';
    var noAgenda = card.getAttribute('data-no-agenda') === 'true';
    teamModalImg.src = img;
    teamModalImg.alt = name;
    teamModalName.textContent = name;
    teamModalRole.textContent = role;
    teamModalBio.textContent = bio;
    // Ocultar/mostrar botón de agenda según si atiende público
    var agendaBtn = document.getElementById('teamModalAgenda');
    if (agendaBtn) {
      agendaBtn.style.display = noAgenda ? 'none' : '';
      // Con la plataforma propia, el botón abre la agenda de esa profesional.
      var base = agendaBtn.getAttribute('href').split('?')[0];
      var con = card.getAttribute('data-con');
      if (base === '/reservar' || base === '/reservar/') agendaBtn.setAttribute('href', con ? '/reservar/?con=' + encodeURIComponent(con) : '/reservar/');
    }
    teamModal.classList.add('open');
    lastFocusedCard = card;
  }
  function closeTeamModal() {
    teamModal.classList.remove('open');
    if (lastFocusedCard) lastFocusedCard.focus();
  }

  document.querySelectorAll('.team-card[data-name]').forEach(function (card) {
    card.addEventListener('click', function () {
      if (!card.getAttribute('data-img')) return;
      openTeamModal(card);
    });
    card.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (!card.getAttribute('data-img')) return;
        openTeamModal(card);
      }
    });
  });
  if (teamModalClose) teamModalClose.addEventListener('click', closeTeamModal);
  if (teamModal) teamModal.addEventListener('click', function (e) {
    if (e.target === teamModal) closeTeamModal();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && teamModal && teamModal.classList.contains('open')) closeTeamModal();
  });

  /* ===== HERO: parallax sutil con el mouse (solo desktop) ===== */
  var heroRight = document.querySelector('.hero-right');
  if (heroRight && window.matchMedia('(pointer: fine)').matches) {
    var heroImgs = heroRight.querySelectorAll('.hero-img img');
    heroRight.addEventListener('mousemove', function (e) {
      var rect = heroRight.getBoundingClientRect();
      var x = (e.clientX - rect.left) / rect.width - 0.5;
      var y = (e.clientY - rect.top) / rect.height - 0.5;
      heroImgs.forEach(function (img, i) {
        var depth = (i % 2 === 0) ? 8 : 12;
        img.style.transform = 'translate(' + (x * depth) + 'px,' + (y * depth) + 'px) scale(1.04)';
      });
    });
    heroRight.addEventListener('mouseleave', function () {
      heroImgs.forEach(function (img) { img.style.transform = ''; });
    });
  }


  /* ===== DOCK: sección activa + oculto sobre el inicio en computador ===== */
  var dock = document.querySelector('.dock');
  var hero = document.getElementById('inicio');
  var desk = window.matchMedia('(min-width: 960px)');
  function dockVisibility() {
    if (dock && hero) dock.classList.toggle('hide', desk.matches && window.scrollY < hero.offsetHeight * 0.55);
  }
  window.addEventListener('scroll', dockVisibility, { passive: true });
  dockVisibility();
  if ('IntersectionObserver' in window) {
    var dockLinks = document.querySelectorAll('.dock-item[data-sec]');
    var secObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        dockLinks.forEach(function (a) {
          a.classList.toggle('active', a.getAttribute('data-sec') === entry.target.id ||
            (a.getAttribute('data-sec') === 'sede' && entry.target.id === 'llegada'));
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    ['servicios', 'galeria', 'sede', 'llegada', 'inicio', 'antesdespues', 'veloterapia', 'experiencias', 'nosotros', 'testimonios', 'preguntas', 'agenda-cta'].forEach(function (id) {
      var el = document.getElementById(id); if (el) secObserver.observe(el);
    });
  }

  /* ===== AVISO DE BIENVENIDA: una vez cada 7 días, tras 20 s o al bajar ===== */
  var promo = document.getElementById('promo');
  var PROMO_KEY = 'amelia-promo-visto';
  function promoSeen() {
    try { return Date.now() - Number(localStorage.getItem(PROMO_KEY) || 0) < 7 * 864e5; } catch (e) { return false; }
  }
  function markPromo() { try { localStorage.setItem(PROMO_KEY, String(Date.now())); } catch (e) {} }
  if (promo && !promoSeen()) {
    var promoShown = false;
    var showPromo = function () {
      if (promoShown) return; promoShown = true;
      window.removeEventListener('scroll', onPromoScroll);
      promo.hidden = false;
      requestAnimationFrame(function () { requestAnimationFrame(function () { promo.classList.add('show'); }); });
      markPromo();
    };
    var onPromoScroll = function () {
      if (window.scrollY > document.documentElement.scrollHeight * 0.35) showPromo();
    };
    window.addEventListener('scroll', onPromoScroll, { passive: true });
    setTimeout(showPromo, 20000);
    var hidePromo = function () { promo.classList.remove('show'); setTimeout(function () { promo.hidden = true; }, 450); };
    document.getElementById('promoClose').addEventListener('click', hidePromo);
    promo.querySelector('.promo-cta').addEventListener('click', hidePromo);
  }

  /* ===== Portadas de los videos: se cargan al acercarse ===== */
  var conPortada = document.querySelectorAll('video[data-poster]');
  if ('IntersectionObserver' in window) {
    var obsPortada = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.poster = en.target.dataset.poster;
        obsPortada.unobserve(en.target);
      });
    }, { rootMargin: '400px 0px' });
    conPortada.forEach(function (v) { obsPortada.observe(v); });
  } else {
    conPortada.forEach(function (v) { v.poster = v.dataset.poster; });
  }

  /* ===== Fotos 2-4 del inicio: se cargan cuando la página ya está lista ===== */
  function cargarHeroDiferidas() {
    document.querySelectorAll('.hero-right img[data-src]').forEach(function (img) {
      if (img.dataset.srcset) img.srcset = img.dataset.srcset;
      img.src = img.dataset.src;
      img.removeAttribute('data-src'); img.removeAttribute('data-srcset');
    });
  }
  if (!window.matchMedia('(max-width: 768px)').matches) cargarHeroDiferidas();
  else if (document.readyState === 'complete') setTimeout(cargarHeroDiferidas, 1200);
  else window.addEventListener('load', function () { setTimeout(cargarHeroDiferidas, 1200); });

  /* ===== REDISEÑO: inicio con fotos que se alternan (celular) ===== */
  var movil = window.matchMedia('(max-width: 768px)');
  var heroImgs = document.querySelectorAll('.hero-right .hero-img');
  if (heroImgs.length > 1 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var heroIdx = 0;
    heroImgs[0].classList.add('activa');
    setInterval(function () {
      if (!movil.matches || document.hidden) return;
      heroImgs[heroIdx].classList.remove('activa');
      heroImgs[heroIdx].classList.add('apagada');
      heroIdx = (heroIdx + 1) % heroImgs.length;
      heroImgs[heroIdx].classList.remove('apagada');
      heroImgs[heroIdx].classList.add('activa');
    }, 4500);
  }

  /* ===== REDISEÑO: accesos por categoría abren su pestaña de servicios ===== */
  document.querySelectorAll('.cat-chip[data-cat]').forEach(function (chip) {
    chip.addEventListener('click', function () {
      var tab = document.querySelector('.tab-btn[data-cat="' + chip.getAttribute('data-cat') + '"]');
      if (tab) tab.click();
    });
  });

  /* ===== REDISEÑO: la galería se muestra completa en celular (se desliza) ===== */
  if (movil.matches && verMasBtn && !expanded) { verMasBtn.click(); }

  /* ===== REDISEÑO: "Reservar con ella" no abre la ficha del equipo ===== */
  document.querySelectorAll('.team-reservar').forEach(function (a) {
    a.addEventListener('click', function (e) { e.stopPropagation(); });
    a.addEventListener('keydown', function (e) { e.stopPropagation(); });
  });

  /* ===== REDISEÑO: datos en vivo de la plataforma de citas ===== */
  var HORARIO_PAGINA = [[11, 17], [9, 19], [9, 19], [9, 19], [9, 19], [9, 19], [10, 19]]; // dom..sáb (respaldo)
  function horaTexto(min) {
    var h = Math.floor(min / 60), m = min % 60, suf = h >= 12 ? 'p. m.' : 'a. m.';
    var h12 = h % 12 || 12;
    return h12 + (m ? ':' + String(m).padStart(2, '0') : '') + ' ' + suf;
  }
  var FESTIVOS = [];
  function pintarEstado(horario) {
    var el = document.getElementById('heroEstado');
    if (!el) return;
    // Hora de Medellín (UTC-5, sin horario de verano)
    var ahora = new Date(Date.now() - 5 * 3600e3);
    var dia = ahora.getUTCDay(), min = ahora.getUTCHours() * 60 + ahora.getUTCMinutes();
    var fechaHoy = ahora.toISOString().slice(0, 10);
    var esFestivo = function (offset) {
      var f = new Date(ahora.getTime() + offset * 864e5).toISOString().slice(0, 10);
      return FESTIVOS.indexOf(f) !== -1;
    };
    var hoy = esFestivo(0) ? null : horario[dia];
    if (hoy && min >= hoy[0] && min < hoy[1]) {
      el.textContent = 'Abierto ahora · hasta las ' + horaTexto(hoy[1]);
      el.classList.remove('cerrado');
    } else {
      var d = dia, txt = '';
      for (var i = 0; i < 7; i++) {
        var h2 = esFestivo(i) ? null : horario[d];
        if (h2 && (i > 0 || min < h2[0])) {
          txt = (i === 0 ? 'hoy' : i === 1 ? 'mañana' : ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][d]) + ' a las ' + horaTexto(h2[0]);
          break;
        }
        d = (d + 1) % 7;
      }
      el.textContent = (esFestivo(0) ? 'Hoy es festivo · abrimos ' : 'Cerrado · abrimos ') + txt;
      el.classList.add('cerrado');
    }
    el.hidden = false;
  }
  pintarEstado(HORARIO_PAGINA.map(function (r) { return r && [r[0] * 60, r[1] * 60]; }));

  function esc(t) { var d = document.createElement('div'); d.textContent = t == null ? '' : String(t); return d.innerHTML; }
  function pesos(n) { return '$' + Number(n).toLocaleString('es-CO'); }

  if (window.fetch) {
    fetch('/api/public/catalogo', { headers: { accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d) return;
        // Horario real de la plataforma (lo edita Erika en el panel) y festivos
        if (Array.isArray(d.festivos)) FESTIVOS = d.festivos;
        if (Array.isArray(d.horario) && d.horario.length) {
          var hz = [];
          d.horario.forEach(function (x) { hz[x.dia] = x.abierto ? [x.abre, x.cierra] : null; });
          pintarEstado(hz);
        }
        // Combos (lo que más se vende) y promociones vigentes: todos se agendan con un toque
        var cont = document.getElementById('destPromos');
        var combos = Array.isArray(d.servicios) ? d.servicios.filter(function (x) { return x.tipo === 'combo'; }) : [];
        var promos = Array.isArray(d.promociones) ? d.promociones : [];
        if (cont && (combos.length || promos.length)) {
          var tarjeta = function (etiqueta, titulo, texto, foto, precio, antes, href) {
            return '<a class="promo-card" href="' + href + '">' +
              (foto ? '<img loading="lazy" decoding="async" src="' + esc(foto) + '" alt="">' : '') +
              '<div><small>' + etiqueta + '</small><strong>' + esc(titulo) + '</strong>' +
              (texto ? '<p>' + esc(texto) + '</p>' : '') +
              (precio != null ? '<span class="precio">' + (antes && antes > precio ? '<s>' + pesos(antes) + '</s> ' : '') + pesos(precio) + '</span>' : '') +
              '<span class="promo-card-cta">Agendar →</span></div></a>';
          };
          cont.innerHTML = combos.slice(0, 4).map(function (c) {
            return tarjeta('Combo', c.nombre, (c.incluye || c.descripcion || '').split('\n').filter(Boolean).join(' + '), c.foto, c.precio, c.precio_antes, '/reservar/?servicio=' + encodeURIComponent(c.slug));
          }).concat(promos.slice(0, 4).map(function (p) {
            return tarjeta('Promoción', p.titulo, p.descripcion, p.foto, p.precio_promo, p.precio_normal, '/reservar/?promo=' + p.id);
          })).join('');
          cont.hidden = false;
        }
        // Lo más pedido primero
        var rail = document.getElementById('destRail');
        if (rail && Array.isArray(d.populares) && Array.isArray(d.servicios)) {
          d.populares.slice().reverse().forEach(function (id) {
            var s = d.servicios.filter(function (x) { return x.id === id; })[0];
            var card = s && rail.querySelector('[data-servicio="' + s.slug + '"]');
            if (card) rail.insertBefore(card, rail.firstChild);
          });
        }
      })
      .catch(function () {});
  }

  /* ===== Smooth scroll para anclas internas ===== */
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      if (id.length > 1) {
        var target = document.querySelector(id);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    });
  });

  
});
