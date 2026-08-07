/* ==========================================================================
   Página do player (player.html?id=<id>).
   Vídeo + slide sincronizado. A aula vem pela URL, então F5 recarrega a MESMA
   aula (não volta pro catálogo). Anterior/próximo navegam para player.html?id=…
   ========================================================================== */
(function () {
  "use strict";

  document.body.style.overflow = 'hidden';

  EP.load(function () {
    var id = EP.param('id');
    var found = id ? EP.findAula(id) : null;
    if (!found) { location.replace('../index.html'); return; }   // id inválido -> catálogo
    start(found.aula, found.disc);
  }, function (e) {
    var vt = document.getElementById('vtitle');
    if (vt) vt.textContent = 'Erro ao carregar dados — veja o README (' + String(e && e.message || e) + ')';
  });

  function start(aula, disc) {
    var fmt = EP.fmt;

    // ---- DOM ----
    var viewer = document.getElementById('viewer');
    var vid = document.getElementById('vid'), vframe = document.getElementById('vframe');
    var slidePane = document.getElementById('slidePane');
    var slideImg = document.getElementById('slideImg'), slideBadge = document.getElementById('slideBadge'), noSlide = document.getElementById('noSlide');
    var vstrip = document.getElementById('vstrip'), vtitle = document.getElementById('vtitle'), fallnote = document.getElementById('fallnote');
    var prevBtn = document.getElementById('prevBtn'), nextBtn = document.getElementById('nextBtn'), stripBtn = document.getElementById('stripBtn');

    var slides = EP.slidesFor(aula.id), curIdx = -1;
    var embedMode = false;

    vtitle.textContent = EP.discCode(disc) + ' · ' + aula.label;
    document.title = EP.discCode(disc) + ' · ' + aula.label + ' · CEDERJ';

    // ---- retomar de onde parou (localStorage) ----
    var curAulaId = null, seekPending = 0, lastSaveT = 0;
    var RESUME_PREFIX = 'eduplay:resume:';
    function resumeKey(id) { return RESUME_PREFIX + id; }
    function loadResume(id) { try { var v = parseFloat(localStorage.getItem(resumeKey(id))); return isFinite(v) && v > 0 ? v : 0; } catch (e) { return 0; } }
    function saveResume(id, sec) { if (!id) return; try { localStorage.setItem(resumeKey(id), String(Math.floor(sec))); } catch (e) { } }
    function clearResume(id) { if (!id) return; try { localStorage.removeItem(resumeKey(id)); } catch (e) { } }
    function persistNow() {
      if (!curAulaId || vid.hidden || !isFinite(vid.currentTime)) return;
      var dur = vid.duration, t = vid.currentTime;
      if (t < 5 || (isFinite(dur) && dur > 0 && t >= dur - 15)) clearResume(curAulaId);
      else saveResume(curAulaId, t);
    }
    window.addEventListener('beforeunload', persistNow);   // salva ao sair/navegar (prev/next/exit/F5)
    vid.addEventListener('pause', persistNow);
    vid.addEventListener('loadedmetadata', function () {
      if (seekPending > 0) {
        var t = seekPending; seekPending = 0;
        if (!isFinite(vid.duration) || t < vid.duration - 2) { try { vid.currentTime = t; } catch (e) { } }
      }
    });

    // ---- slide sincronizado ----
    function idxFor(ms) { var idx = -1; for (var i = 0; i < slides.length; i++) { if (slides[i].vlStart <= ms) idx = i; else break; } return idx; }
    function showSlide(idx) {
      if (idx < 0 || idx >= slides.length) return;
      if (idx !== curIdx) {
        curIdx = idx; slideImg.src = slides[idx].src;
        var t = vstrip.children[idx];
        if (t) { for (var i = 0; i < vstrip.children.length; i++) vstrip.children[i].classList.remove('active'); t.classList.add('active'); t.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }); }
      }
      slideBadge.textContent = (idx + 1) + ' / ' + slides.length + '  ·  ' + fmt(slides[idx].vlStart);
    }
    vid.addEventListener('timeupdate', function () {
      if (slides.length) { var i = idxFor(vid.currentTime * 1000); if (i >= 0) showSlide(i); }
      if (curAulaId) { var t = vid.currentTime; if (Math.abs(t - lastSaveT) >= 5) { lastSaveT = t; persistNow(); } }
    });
    vid.addEventListener('ended', function () { clearResume(curAulaId); });

    function buildStrip() {
      vstrip.innerHTML = '';
      if (!slides.length) { vstrip.classList.add('hidden'); return; }
      vstrip.classList.remove('hidden');
      slides.forEach(function (s, i) {
        var d = document.createElement('div'); d.className = 'thumb';
        d.innerHTML = '<span class="tn">' + (i + 1) + '</span><img loading="lazy" src="' + s.src + '"><div class="tt">' + fmt(s.vlStart) + '</div>';
        d.addEventListener('click', function () { if (!vid.hidden && vid.src) { vid.currentTime = s.vlStart / 1000; showSlide(i); } });
        vstrip.appendChild(d);
      });
    }

    // ---- colapsar / descolapsar a timeline de slides ----
    var STRIP_KEY = 'eduplay:stripCollapsed';
    var stripCollapsed = false;
    try { stripCollapsed = localStorage.getItem(STRIP_KEY) === '1'; } catch (e) { }
    function applyStrip() {
      var canShow = !embedMode && slides.length > 0;
      stripBtn.style.display = canShow ? '' : 'none';
      if (canShow && !stripCollapsed) vstrip.classList.remove('hidden');
      else vstrip.classList.add('hidden');
      stripBtn.textContent = stripCollapsed ? '▤ Timeline' : '▦ Timeline';
      stripBtn.title = stripCollapsed ? 'Mostrar timeline de slides' : 'Ocultar timeline de slides';
      stripBtn.setAttribute('aria-pressed', stripCollapsed ? 'true' : 'false');
    }
    stripBtn.addEventListener('click', function () {
      stripCollapsed = !stripCollapsed;
      try { localStorage.setItem(STRIP_KEY, stripCollapsed ? '1' : '0'); } catch (e) { }
      applyStrip();
    });

    // ---- navegação entre aulas (anterior / próxima) dentro da disciplina ----
    var arr = EP.navList(disc), pos = arr.indexOf(aula);
    prevBtn.disabled = !(pos > 0);
    nextBtn.disabled = !(pos >= 0 && pos < arr.length - 1);
    function goTo(a) { location.href = 'player.html?id=' + encodeURIComponent(a.id); }
    prevBtn.addEventListener('click', function () { if (pos > 0) goTo(arr[pos - 1]); });
    nextBtn.addEventListener('click', function () { if (pos >= 0 && pos < arr.length - 1) goTo(arr[pos + 1]); });

    // ---- tela cheia (contêiner: mantém vídeo + slide juntos) ----
    function isFs() { return document.fullscreenElement || document.webkitFullscreenElement; }
    function enterFs(el) { var fn = el.requestFullscreen || el.webkitRequestFullscreen; if (fn) { try { fn.call(el); } catch (e) { } } }
    function exitFs() { var fn = document.exitFullscreen || document.webkitExitFullscreen; if (fn) { try { fn.call(document); } catch (e) { } } }
    var fsBtn = document.getElementById('fsBtn');
    fsBtn.addEventListener('click', function () { if (isFs()) exitFs(); else enterFs(viewer); });
    ['fullscreenchange', 'webkitfullscreenchange'].forEach(function (ev) { document.addEventListener(ev, function () { fsBtn.textContent = isFs() ? '⤢ Sair' : '⛶ Tela cheia'; }); });

    // ---- sair -> catálogo ----
    document.getElementById('exitBtn').addEventListener('click', function () {
      persistNow(); if (isFs()) exitFs(); location.href = '../index.html';
    });

    // ---- vídeo/HLS ----
    // .ts do HLS só libera CORS p/ eduplay.rnp.br, então hls.js não funciona de fora.
    // HLS NATIVO (<video src=m3u8>) não passa por CORS e toca no iOS/Safari.
    // No Chrome/Android (sem HLS nativo real) o vídeo trava e caímos no embed.
    function resetVideo() { try { vid.pause(); } catch (e) { } vid.removeAttribute('src'); vid.load(); }
    var hlsWatchdog = null, hlsErrHandler = null;
    function clearHlsGuards() {
      if (hlsWatchdog) { clearTimeout(hlsWatchdog); hlsWatchdog = null; }
      if (hlsErrHandler) { vid.removeEventListener('error', hlsErrHandler); hlsErrHandler = null; }
    }
    function showPlayerPane() {
      embedMode = false;
      vframe.style.display = 'none'; vframe.src = 'about:blank';
      vid.style.display = '';
      if (slides.length) {
        slidePane.style.display = ''; slideImg.style.display = ''; noSlide.style.display = 'none';
        buildStrip(); showSlide(0);
      } else { slidePane.style.display = 'none'; vstrip.classList.add('hidden'); }
      fallnote.classList.add('hidden'); fallnote.textContent = '';
      applyStrip();
    }
    function showEmbedFallback(note) {
      embedMode = true;
      curAulaId = null; // embed cross-origin: não dá pra ler/gravar o tempo
      clearHlsGuards(); resetVideo(); vid.style.display = 'none';
      slidePane.style.display = 'none'; vstrip.classList.add('hidden');
      vframe.style.display = ''; vframe.src = EP.EMBED + aula.id;
      fallnote.classList.remove('hidden'); fallnote.textContent = note;
      applyStrip();
    }

    // ---- carrega o vídeo da aula ----
    if (EP.hasMp4(aula.id)) {
      showPlayerPane();
      curAulaId = aula.id; seekPending = loadResume(aula.id);
      vid.src = EP.H5P + aula.id + '/h5p-url'; vid.load();
    } else if (EP.hasHls(aula.id)) {
      showPlayerPane();
      curAulaId = aula.id; seekPending = loadResume(aula.id);
      vid.src = EP.hls[aula.id]; vid.load();
      hlsErrHandler = function () { showEmbedFallback('Seu navegador não toca este vídeo (formato HLS) — abrindo no EduPlay. Em iPhone/Safari ele toca aqui com o slide ao lado.'); };
      vid.addEventListener('error', hlsErrHandler);
      hlsWatchdog = setTimeout(function () { if (vid.readyState < 1 && hlsErrHandler) hlsErrHandler(); }, 8000);
      vid.addEventListener('loadedmetadata', function () { if (hlsWatchdog) { clearTimeout(hlsWatchdog); hlsWatchdog = null; } }, { once: true });
    } else {
      showEmbedFallback('Este vídeo não tem versão direta — abrindo o player do EduPlay.' + (slides.length ? ' Os slides estão em “Slides” no catálogo.' : ''));
    }
  }
})();
