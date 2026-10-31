/* Raumausstattung Enver Hajzeraj – Basis-Skript (Vanilla JS, keine Abhängigkeiten)
   Jedes Modul prüft, ob seine Elemente existieren, und bricht sonst still ab. */
(function () {
  'use strict';

  var root = document.documentElement;
  root.classList.add('js');

  var NAV_BP = 1040; // identisch mit Media Query in style.css
  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  var storage = {
    get: function (k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* ignorieren */ } }
  };

  /* ---------- Header: Scroll-Verhalten ---------- */
  function initHeader() {
    var header = $('[data-header]');
    if (!header) return;
    var lastY = window.pageYOffset || 0;
    var ticking = false;

    function update() {
      ticking = false;
      var y = Math.max(0, window.pageYOffset || 0);
      var menuOpen = root.classList.contains('menu-open');
      header.classList.toggle('is-scrolled', y > 40);
      if (!menuOpen) {
        var delta = y - lastY;
        if (y > 240 && delta > 6) header.classList.add('is-hidden');
        else if (delta < -6 || y <= 240) header.classList.remove('is-hidden');
      }
      lastY = y;
    }
    function onScroll() {
      if (!ticking) { ticking = true; window.requestAnimationFrame(update); }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    header.addEventListener('focusin', function () { header.classList.remove('is-hidden'); });
    update();
  }

  /* ---------- Mobile-Menü ---------- */
  function initMenu() {
    var burger = $('[data-menu-toggle]');
    var menu = $('[data-mobile-menu]');
    if (!burger || !menu) return;

    var outside = $$('main, footer, .skip-link, .proto-bar');
    var lastFocus = null;

    function focusables() {
      return [burger].concat($$('a[href], button:not([disabled])', menu)).filter(function (el) {
        return el.offsetParent !== null || el === burger;
      });
    }
    function setOutsideInert(on) {
      outside.forEach(function (el) {
        if (on) el.setAttribute('inert', ''); else el.removeAttribute('inert');
      });
    }
    function open() {
      lastFocus = document.activeElement;
      root.classList.add('menu-open');
      burger.setAttribute('aria-expanded', 'true');
      burger.setAttribute('aria-label', 'Menü schließen');
      menu.removeAttribute('inert');
      setOutsideInert(true);
      var first = $('a[href]', menu);
      if (first) window.setTimeout(function () { first.focus({ preventScroll: true }); }, 60);
    }
    function close(restoreFocus) {
      if (!root.classList.contains('menu-open')) return;
      root.classList.remove('menu-open');
      burger.setAttribute('aria-expanded', 'false');
      burger.setAttribute('aria-label', 'Menü öffnen');
      menu.setAttribute('inert', '');
      setOutsideInert(false);
      if (restoreFocus !== false) burger.focus({ preventScroll: true });
    }

    menu.setAttribute('inert', '');
    burger.addEventListener('click', function () {
      if (root.classList.contains('menu-open')) close(); else open();
    });
    $$('a', menu).forEach(function (a) {
      a.addEventListener('click', function () { close(false); });
    });
    document.addEventListener('keydown', function (e) {
      if (!root.classList.contains('menu-open')) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key === 'Tab') {
        var list = focusables();
        if (!list.length) return;
        var first = list[0], last = list[list.length - 1], active = document.activeElement;
        if (e.shiftKey && (active === first || !menu.contains(active) && active !== burger)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
      }
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth >= NAV_BP) close(false);
    });
  }

  /* ---------- Reveal (IntersectionObserver) ---------- */
  function initReveal() {
    var targets = $$('.reveal, .img-reveal, .lines');
    if (!targets.length) return;

    // Automatische Staffelung innerhalb von [data-stagger]
    $$('[data-stagger]').forEach(function (group) {
      var step = parseFloat(group.getAttribute('data-stagger')) || 0.1;
      $$('.reveal, .img-reveal', group).forEach(function (el, i) {
        if (!el.style.getPropertyValue('--delay')) el.style.setProperty('--delay', (i * step).toFixed(2) + 's');
      });
    });
    // Zeilen-Index für Headlines
    $$('.lines').forEach(function (h) {
      $$('.line', h).forEach(function (l, i) { l.style.setProperty('--i', i); });
    });

    function show(el) { el.classList.add('is-visible'); }
    if (!('IntersectionObserver' in window)) { targets.forEach(show); return; }

    // .img-reveal ist per clip-path vollständig beschnitten und würde nie als sichtbar gemeldet:
    // daher das (unbeschnittene) Elternelement beobachten und die Klasse am .img-reveal setzen.
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var t = entry.target;
        var el = t._reveal || t;
        show(el);
        io.unobserve(t);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    targets.forEach(function (el) {
      if (el.classList.contains('img-reveal') && el.parentElement) {
        var p = el.parentElement;
        p._reveal = el;
        io.observe(p);
      } else { io.observe(el); }
    });
  }

  /* ---------- Hero-Intro ---------- */
  function initHero() {
    var heroes = $$('[data-hero]');
    if (!heroes.length) return;
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        heroes.forEach(function (h) {
          h.classList.add('is-loaded');
          $$('.lines', h).forEach(function (l) { l.classList.add('is-visible'); });
        });
      });
    });
  }

  /* ---------- Prototyp-Schalter (Prüfhinweise) ---------- */
  function initProto() {
    var btn = $('[data-todo-toggle]');
    var hidden = storage.get('hz-hide-todos') === '1';
    root.classList.toggle('hide-todos', hidden);
    if (!btn) return;
    var state = $('[data-todo-state]', btn);
    function render() {
      var off = root.classList.contains('hide-todos');
      btn.setAttribute('aria-pressed', off ? 'false' : 'true');
      if (state) state.textContent = off ? 'aus' : 'ein';
    }
    btn.addEventListener('click', function () {
      var off = root.classList.toggle('hide-todos');
      storage.set('hz-hide-todos', off ? '1' : '0');
      render();
    });
    render();
  }

  /* ---------- Jahr im Footer ---------- */
  function initYear() {
    $$('[data-year]').forEach(function (el) { el.textContent = String(new Date().getFullYear()); });
  }

  function run(fn) { try { fn(); } catch (e) { if (window.console) console.error(e); } }
  function init() {
    run(initProto); run(initHeader); run(initMenu); run(initReveal); run(initHero); run(initYear);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
