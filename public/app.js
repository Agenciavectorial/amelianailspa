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
    lbImg.src = img.src;
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
      if (base === '/reservar') agendaBtn.setAttribute('href', con ? '/reservar?con=' + encodeURIComponent(con) : '/reservar');
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
