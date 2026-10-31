/* Referenzen – Projektfilter, Bildvorschau am Cursor, Lightbox (Vanilla JS) */
(function () {
  'use strict';

  var root = document.documentElement;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var reduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  /* ---------- Filter ---------- */
  function initFilter() {
    var list = $('[data-idx]');
    var buttons = $$('[data-filter]');
    if (!list || !buttons.length) return;
    var rows = $$('.idx__row', list);
    var status = $('[data-idx-status]');
    var token = 0;

    function apply(cat) {
      var t = ++token;
      var shown = 0;
      buttons.forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-filter') === cat ? 'true' : 'false'); });
      rows.forEach(function (row) {
        var match = cat === 'alle' || row.getAttribute('data-cat') === cat;
        if (match) shown++;
        if (match) {
          if (row.hidden) {
            row.hidden = false;
            if (!reduce.matches) {
              row.classList.add('is-leaving');
              void row.offsetWidth;
              window.requestAnimationFrame(function () { row.classList.remove('is-leaving'); });
            }
          } else { row.classList.remove('is-leaving'); }
        } else if (!row.hidden) {
          if (reduce.matches) { row.hidden = true; }
          else {
            row.classList.add('is-leaving');
            window.setTimeout(function () {
              if (t === token) { row.hidden = true; row.classList.remove('is-leaving'); }
            }, 340);
          }
        }
      });
      if (status) status.textContent = cat === 'alle' ? '' : shown + ' von ' + rows.length + ' Projekten angezeigt.';
      hidePreview();
    }
    buttons.forEach(function (b) {
      b.addEventListener('click', function () { apply(b.getAttribute('data-filter')); });
    });
  }

  /* ---------- Bildvorschau am Cursor ---------- */
  var preview = null, pImg = null, pOn = false, pX = 0, pY = 0, cX = 0, cY = 0, pW = 0, pH = 0, raf = 0, lastRow = null;
  function hidePreview() {
    lastRow = null;
    if (preview) preview.classList.remove('is-on');
    pOn = false;
  }
  function initPreview() {
    preview = $('[data-idx-preview]');
    var list = $('[data-idx]');
    if (!preview || !list || !window.matchMedia) return;
    var fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    if (!fine.matches || reduce.matches) return;
    pImg = $('img', preview);
    var lastX = 0, lastY = 0, hasPointer = false;

    function frame() {
      raf = 0;
      pX += (cX - pX) * 0.18;
      pY += (cY - pY) * 0.18;
      preview.style.transform = 'translate3d(' + pX.toFixed(1) + 'px,' + pY.toFixed(1) + 'px,0)';
      if (pOn && (Math.abs(cX - pX) > 0.4 || Math.abs(cY - pY) > 0.4)) raf = window.requestAnimationFrame(frame);
    }
    function target(x, y) {
      var gap = 28, vw = window.innerWidth, vh = window.innerHeight;
      var tx = x + gap, ty = y - pH / 2;
      if (tx + pW > vw - 12) tx = x - gap - pW;
      ty = Math.max(12, Math.min(ty, vh - pH - 12));
      cX = tx; cY = ty;
    }
    function show(row) {
      var a = $('.idx__link', row);
      if (!a) return hidePreview();
      var tw = +a.getAttribute('data-tw'), th = +a.getAttribute('data-th');
      var k = Math.min(320 / tw, 360 / th);
      pW = Math.round(tw * k); pH = Math.round(th * k);
      preview.style.width = pW + 'px'; preview.style.height = pH + 'px';
      pImg.width = pW; pImg.height = pH;
      pImg.src = a.getAttribute('data-thumb');
      target(lastX, lastY);
      if (!pOn) { pX = cX; pY = cY; }
      pOn = true; lastRow = row;
      preview.classList.add('is-on');
      if (!raf) raf = window.requestAnimationFrame(frame);
    }
    function update(e) {
      lastX = e.clientX; lastY = e.clientY; hasPointer = true;
      var row = e.target && e.target.closest ? e.target.closest('.idx__row.has-photo') : null;
      if (!row || row.hidden || root.classList.contains('lb-open')) { if (pOn) hidePreview(); return; }
      if (row !== lastRow) show(row);
      else { target(lastX, lastY); if (!raf) raf = window.requestAnimationFrame(frame); }
    }
    list.addEventListener('pointermove', function (e) { if (e.pointerType === 'mouse') update(e); });
    list.addEventListener('pointerleave', hidePreview);
    window.addEventListener('scroll', function () {
      if (!hasPointer || !pOn) return;
      var el = document.elementFromPoint(lastX, lastY);
      var row = el && el.closest ? el.closest('.idx__row.has-photo') : null;
      if (!row) hidePreview(); else if (row !== lastRow) show(row);
    }, { passive: true });
  }

  /* ---------- Lightbox ---------- */
  function initLightbox() {
    var box = $('[data-lb-root]');
    var triggers = $$('a[data-lb]');
    if (!box || !triggers.length) return;
    var img = $('.lb__img', box), cap = $('[data-lb-caption]', box), count = $('[data-lb-count]', box);
    var closeBtn = $('.lb__close', box), prevBtn = $('[data-lb-prev]', box), nextBtn = $('[data-lb-next]', box);

    // Eindeutige Bildliste in DOM-Reihenfolge
    var items = [], seen = {};
    triggers.forEach(function (a) {
      var f = a.getAttribute('data-full');
      if (seen[f] !== undefined) return;
      seen[f] = items.length;
      items.push({ full: f, w: a.getAttribute('data-w'), h: a.getAttribute('data-h'), caption: a.getAttribute('data-caption') });
    });

    var current = 0, lastFocus = null, isOpen = false, swapId = 0;
    var outside = $$('.skip-link, .site-header, .mobile-menu, main, .site-footer, .proto-bar');

    function setInert(on) {
      outside.forEach(function (el) { if (on) el.setAttribute('inert', ''); else el.removeAttribute('inert'); });
    }
    function load(i, instant) {
      var it = items[i];
      var id = ++swapId;
      cap.textContent = it.caption;
      count.textContent = (i + 1) + ' / ' + items.length;
      img.setAttribute('alt', 'Referenzprojekt ' + it.caption);
      function apply() {
        if (id !== swapId) return;
        img.width = +it.w; img.height = +it.h;
        img.src = it.full;
        img.classList.remove('is-swapping');
      }
      if (instant || reduce.matches) { apply(); }
      else {
        img.classList.add('is-swapping');
        var pre = new Image();
        pre.onload = pre.onerror = function () { window.setTimeout(apply, 120); };
        pre.src = it.full;
      }
      // Nachbarn vorladen
      [i - 1, i + 1].forEach(function (n) {
        var k = (n + items.length) % items.length;
        var p = new Image(); p.src = items[k].full;
      });
    }
    function go(d) {
      current = (current + d + items.length) % items.length;
      load(current, false);
    }
    function open(i, from) {
      lastFocus = from || document.activeElement;
      current = i;
      var sbw = window.innerWidth - root.clientWidth;
      if (sbw > 0) document.body.style.paddingRight = sbw + 'px';
      root.classList.add('lb-open');
      hidePreview();
      box.setAttribute('aria-hidden', 'false');
      setInert(true);
      box.classList.add('is-open');
      isOpen = true;
      load(current, true);
      closeBtn.focus({ preventScroll: true });
    }
    function close() {
      if (!isOpen) return;
      isOpen = false;
      box.classList.remove('is-open');
      box.setAttribute('aria-hidden', 'true');
      setInert(false);
      root.classList.remove('lb-open');
      document.body.style.paddingRight = '';
      if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    }

    triggers.forEach(function (a) {
      a.addEventListener('click', function (e) {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button > 0) return;
        e.preventDefault();
        open(seen[a.getAttribute('data-full')], a);
      });
    });
    $$('[data-lb-close]', box).forEach(function (b) { b.addEventListener('click', close); });
    prevBtn.addEventListener('click', function () { go(-1); });
    nextBtn.addEventListener('click', function () { go(1); });

    document.addEventListener('keydown', function (e) {
      if (!isOpen) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
      else if (e.key === 'Tab') {
        var f = [closeBtn, prevBtn, nextBtn];
        var first = f[0], last = f[f.length - 1], a = document.activeElement;
        if (f.indexOf(a) === -1) { e.preventDefault(); first.focus(); }
        else if (e.shiftKey && a === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && a === last) { e.preventDefault(); first.focus(); }
      }
    });

    // Wischgeste
    var sx = null, sy = 0;
    box.addEventListener('touchstart', function (e) { var t = e.changedTouches[0]; sx = t.clientX; sy = t.clientY; }, { passive: true });
    box.addEventListener('touchend', function (e) {
      if (sx === null) return;
      var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
      sx = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
    }, { passive: true });
  }

  function run(fn) { try { fn(); } catch (e) { if (window.console) console.error(e); } }
  function init() { run(initFilter); run(initPreview); run(initLightbox); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
