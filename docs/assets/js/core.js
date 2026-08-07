/* ==========================================================================
   Núcleo compartilhado pelas 3 páginas (catálogo, player, galeria).
   Carrega os dados (assets/data/data.json) e expõe helpers em window.EP.
   ========================================================================== */
window.EP = (function () {
  "use strict";
  var api = {};

  // Caminho do data.json resolvido RELATIVO a este core.js (assets/js/core.js ->
  // ../data/data.json). Assim funciona igual seja qual for a profundidade da página
  // que o carregou (docs/index.html ou docs/pages/*.html).
  var CORE_SRC = (document.currentScript && document.currentScript.src) || '';
  var DATA_URL = CORE_SRC ? new URL('../data/data.json', CORE_SRC).href : 'assets/data/data.json';

  // ---- URLs de origem do conteúdo (EduPlay/RNP) ----
  api.H5P = 'https://eduplay.rnp.br/api/v1/videos/';       // + id + '/h5p-url' (302 -> mp4)
  api.EMBED = 'https://eduplay.rnp.br/app/video/embed/';   // + id (iframe fallback)

  // Carrega o JSON e chama onReady() quando pronto.
  // Em GitHub Pages (HTTP) o fetch funciona. Abrindo via file:// o navegador
  // bloqueia — nesse caso onError(e) é chamado (ver README p/ servidor local).
  api.load = function (onReady, onError) {
    fetch(DATA_URL)
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (DATA) { init(DATA); onReady(api); })
      .catch(function (e) { (onError || function () { })(e); });
  };

  function init(DATA) {
    api.assetPrefix = DATA.assetPrefix;
    api.catalog = DATA.catalog;
    api.slides = DATA.slides;
    api.noMp4 = {}; (DATA.noMp4 || []).forEach(function (id) { api.noMp4[id] = 1; });
    api.hls = DATA.hls || {};
  }

  // ---- consultas sobre uma aula ----
  api.hasSlides = function (id) { return !!api.slides[id]; };
  api.hasMp4 = function (id) { return !api.noMp4[id]; };
  api.hasHls = function (id) { return !!api.hls[id]; };
  api.playable = function (id) { return api.hasMp4(id) || api.hasHls(id); };   // toca no player próprio
  api.slidesFor = function (id) {
    var raw = api.slides[id]; if (!raw) return [];
    return raw.s.map(function (p) { return { vlStart: p[0], src: api.assetPrefix + id + '/' + raw.p + p[1] }; });
  };

  // localiza { aula, disc } a partir do id (usado pelas páginas de player/galeria)
  api.findAula = function (id) {
    id = String(id);
    for (var i = 0; i < api.catalog.length; i++) {
      var d = api.catalog[i];
      for (var j = 0; j < d.aulas.length; j++) {
        if (String(d.aulas[j].id) === id) return { aula: d.aulas[j], disc: d };
      }
    }
    return null;
  };
  // aulas navegáveis (com vídeo) de uma disciplina, na ordem do catálogo
  api.navList = function (disc) { return disc ? disc.aulas.filter(function (a) { return !a.na; }) : []; };

  // ---- utilidades ----
  api.fmt = function (ms) { var s = Math.max(0, Math.round(ms / 1000)), m = Math.floor(s / 60), r = s % 60; return (m < 10 ? '0' : '') + m + ':' + (r < 10 ? '0' : '') + r; };
  api.esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  api.param = function (name) { try { return new URLSearchParams(location.search).get(name); } catch (e) { return null; } };
  api.discCode = function (disc) { return disc.materia.split(/\s+-\s+/)[0]; };

  return api;
})();
